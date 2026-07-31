const { Op } = require('sequelize');
const { sequelize, Lead, Property, Appointment } = require('../models/index');
const { logActivity, ensureOpenTask } = require('../utils/pipelineHelpers');
const { logAudit } = require('../utils/audit');
const { paginate } = require('../utils/pagination');

const VALID_APPOINTMENT_STATUS = ['programada', 'confirmada', 'completada', 'no_show', 'cancelada'];

// GET /api/appointments — alimenta el Calendario (reemplaza el filtro sobre
// Lead.appointmentDate que usaba CalendarPage.jsx). AUDIT: antes tenía un `limit=500`
// fijo sin devolver total/hasNext — un mes con más de 500 citas se truncaba en
// silencio. `maxLimit: 500` conserva el mismo techo práctico pero ahora es honesto sobre
// si se truncó (pagination.hasNext), en vez de simplemente no decir nada.
const getAppointments = async (req, res) => {
  try {
    const { from, to, status, leadId, page, limit = 500 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (leadId) where.leadId = leadId;
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt[Op.gte] = new Date(from);
      if (to) where.scheduledAt[Op.lte] = new Date(to);
    }

    const result = await paginate(Appointment, {
      page,
      limit,
      maxLimit: 500,
      where,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone', 'email'] },
        { model: Property, as: 'property', attributes: ['id', 'title'], required: false },
      ],
      order: [['scheduledAt', 'ASC']],
    });

    return res.json(result);
  } catch (error) {
    console.error('Error en getAppointments:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/leads/:id/appointments
const getLeadAppointments = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const appointments = await Appointment.findAll({
      where: { leadId: req.params.id },
      include: [{ model: Property, as: 'property', attributes: ['id', 'title'], required: false }],
      order: [['scheduledAt', 'DESC']],
    });

    return res.json({ data: appointments });
  } catch (error) {
    console.error('Error en getLeadAppointments:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/appointments
const createAppointment = async (req, res) => {
  try {
    const { leadId, propertyId, scheduledAt } = req.body;
    if (!leadId || !scheduledAt)
      return res.status(400).json({ error: 'leadId y scheduledAt son requeridos' });

    const lead = await Lead.findByPk(leadId);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    if (propertyId) {
      const property = await Property.findByPk(propertyId);
      if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    const appointment = await sequelize.transaction(async (transaction) => {
      const created = await Appointment.create(
        {
          leadId,
          propertyId: propertyId || null,
          scheduledAt,
        },
        { transaction }
      );

      await logActivity({
        leadId,
        type: 'sistema',
        content: `Cita agendada para ${new Date(scheduledAt).toLocaleString('es-MX')}`,
        userId: req.user?.id ?? null,
        transaction,
      });

      return created;
    });

    logAudit(req, 'create', 'appointment', appointment.id, { leadId });

    return res.status(201).json({ message: 'Cita agendada exitosamente', data: appointment });
  } catch (error) {
    console.error('Error en createAppointment:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PATCH /api/appointments/:id
const updateAppointmentStatus = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [{ model: Lead, as: 'lead', attributes: ['id', 'assignedToUserId'] }],
    });
    if (!appointment) return res.status(404).json({ error: 'Cita no encontrada' });

    const { status, outcome } = req.body;
    if (status !== undefined && !VALID_APPOINTMENT_STATUS.includes(status)) {
      return res.status(400).json({
        error: `Estatus inválido. Valores permitidos: ${VALID_APPOINTMENT_STATUS.join(', ')}`,
      });
    }

    await sequelize.transaction(async (transaction) => {
      const updates = {};
      if (status !== undefined) updates.status = status;
      if (outcome !== undefined) updates.outcome = outcome;
      await appointment.update(updates, { transaction });

      if (status !== undefined) {
        await logActivity({
          leadId: appointment.leadId,
          type: 'sistema',
          content: `Cita ${status}`,
          userId: req.user?.id ?? null,
          transaction,
        });

        // Una cita cancelada o a la que no se presentó el prospecto necesita una nueva
        // próxima acción — sin esto, el prospecto se queda "olvidado" sin seguimiento.
        if (
          (status === 'cancelada' || status === 'no_show') &&
          appointment.lead?.assignedToUserId
        ) {
          await ensureOpenTask({
            leadId: appointment.leadId,
            assignedToUserId: appointment.lead.assignedToUserId,
            type: 'llamar',
            transaction,
          });
        }
      }
    });

    logAudit(req, 'update', 'appointment', appointment.id, { status });

    return res.json({ message: 'Cita actualizada exitosamente', data: appointment });
  } catch (error) {
    console.error('Error en updateAppointmentStatus:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/appointments/:id/reschedule — conserva la cita anterior (marcada cancelada,
// enlazada vía rescheduledFromId) en vez de sobreescribir la fecha.
const rescheduleAppointment = async (req, res) => {
  try {
    const oldAppointment = await Appointment.findByPk(req.params.id);
    if (!oldAppointment) return res.status(404).json({ error: 'Cita no encontrada' });

    const { scheduledAt } = req.body;
    if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt requerido' });

    const newAppointment = await sequelize.transaction(async (transaction) => {
      await oldAppointment.update({ status: 'cancelada' }, { transaction });

      const created = await Appointment.create(
        {
          leadId: oldAppointment.leadId,
          propertyId: oldAppointment.propertyId,
          scheduledAt,
          rescheduledFromId: oldAppointment.id,
        },
        { transaction }
      );

      await logActivity({
        leadId: oldAppointment.leadId,
        type: 'sistema',
        content: `Cita reagendada de ${new Date(oldAppointment.scheduledAt).toLocaleString('es-MX')} a ${new Date(scheduledAt).toLocaleString('es-MX')}`,
        userId: req.user?.id ?? null,
        transaction,
      });

      return created;
    });

    logAudit(req, 'update', 'appointment', oldAppointment.id, { rescheduledTo: newAppointment.id });

    return res.json({ message: 'Cita reagendada exitosamente', data: newAppointment });
  } catch (error) {
    console.error('Error en rescheduleAppointment:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/appointments/:id — solo para registros creados por error
const deleteAppointment = async (req, res) => {
  try {
    const appointment = await Appointment.findByPk(req.params.id);
    if (!appointment) return res.status(404).json({ error: 'Cita no encontrada' });

    await appointment.destroy();
    logAudit(req, 'delete', 'appointment', req.params.id);

    return res.json({ message: 'Cita eliminada exitosamente' });
  } catch (error) {
    console.error('Error en deleteAppointment:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getAppointments,
  getLeadAppointments,
  createAppointment,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment,
};
