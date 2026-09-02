const { Op, Transaction } = require('sequelize');
const { sequelize, Lead, Property, Appointment, User } = require('../models/index');
const { logActivity } = require('../utils/pipelineHelpers');
const { logAudit, snapshotFields, buildChanges } = require('../utils/audit');
const { paginate } = require('../utils/pagination');
const { getLeadVisibilityWhere, canViewLead, canEditLead } = require('../utils/leadAccess');
const { ApiError } = require('../middleware/errorHandler');

const VALID_APPOINTMENT_STATUS = ['programada', 'confirmada', 'completada', 'no_show', 'cancelada'];

// CAL-002: no existía ninguna verificación de traslape de horario para el mismo asesor —
// dos citas para el mismo `Lead.assignedToUserId` en horarios encimados podían crearse
// sin ningún aviso. El modelo Appointment no tiene un campo de duración, así que se asume
// una duración fija de 1 hora por cita (mismo criterio que el ejemplo de la auditoría:
// "10:00–11:00"), suficiente para detectar el caso real de doble reserva sin necesitar una
// migración nueva.
const APPOINTMENT_DURATION_MS = 60 * 60 * 1000;

// Busca una cita NO cancelada del mismo asesor dentro de +/- 1 hora del horario propuesto.
// Debe llamarse dentro de una transacción con aislamiento SERIALIZABLE (ver
// createAppointment/rescheduleAppointment): bajo InnoDB, SERIALIZABLE convierte incluso un
// SELECT plano en un gap lock sobre el rango leído, así que dos requests concurrentes para
// el mismo horario/asesor no pueden "no verse" entre sí — uno de los dos se bloquea hasta
// que el otro termine (commit o rollback), en vez de que ambos pasen la verificación antes
// de que cualquiera haya insertado nada.
async function findOverlappingAppointment({ assignedToUserId, scheduledAt, excludeAppointmentId, transaction }) {
  if (!assignedToUserId) return null; // sin responsable asignado, no hay agenda con quién chocar
  const start = new Date(scheduledAt);
  const windowStart = new Date(start.getTime() - APPOINTMENT_DURATION_MS + 1);
  const windowEnd = new Date(start.getTime() + APPOINTMENT_DURATION_MS - 1);

  return Appointment.findOne({
    where: {
      scheduledAt: { [Op.between]: [windowStart, windowEnd] },
      status: { [Op.ne]: 'cancelada' },
      ...(excludeAppointmentId ? { id: { [Op.ne]: excludeAppointmentId } } : {}),
      '$lead.assignedToUserId$': assignedToUserId,
    },
    include: [{ model: Lead, as: 'lead', attributes: [] }],
    transaction,
  });
}

// Dos transacciones SERIALIZABLE concurrentes tomando gap locks sobre el mismo rango
// pueden desembocar en un deadlock genuino de InnoDB (ER_LOCK_DEADLOCK) en vez de que una
// de ellas simplemente "vea" la fila de la otra — MySQL aborta una de las dos para
// resolverlo. Sin este wrapper, esa transacción abortada se propagaría como un 500 crudo
// de Sequelize; aquí se traduce al mismo 409 de conflicto que ya usa el chequeo de
// traslape, ya que semánticamente significa lo mismo: "alguien más agendó ahí primero".
async function runAppointmentTransaction(fn) {
  try {
    return await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, fn);
  } catch (error) {
    const code = error.original?.code || error.parent?.code;
    if (code === 'ER_LOCK_DEADLOCK') {
      throw new ApiError(
        409,
        'Otra persona agendó una cita para ese horario justo antes que tú — verifica la agenda e intenta de nuevo'
      );
    }
    throw error;
  }
}

// GET /api/appointments — alimenta el Calendario (reemplaza el filtro sobre
// Lead.appointmentDate que usaba CalendarPage.jsx). AUDIT: antes tenía un `limit=500`
// fijo sin devolver total/hasNext — un mes con más de 500 citas se truncaba en
// silencio. `maxLimit: 500` conserva el mismo techo práctico pero ahora es honesto sobre
// si se truncó (pagination.hasNext), en vez de simplemente no decir nada.
const getAppointments = async (req, res) => {
  const {
    from,
    to,
    status,
    leadId,
    assignedToUserId,
    createdByUserId,
    search,
    page,
    limit = 500,
  } = req.query;
  const where = {};
  if (status) where.status = status;
  if (leadId) where.leadId = leadId;
  if (createdByUserId) where.createdByUserId = createdByUserId;
  // Filtra por el asesor responsable del lead (no de la cita) — "Atiende" en el calendario.
  if (assignedToUserId) where['$lead.assignedToUserId$'] = assignedToUserId;
  if (from || to) {
    where.scheduledAt = {};
    if (from) where.scheduledAt[Op.gte] = new Date(from);
    if (to) where.scheduledAt[Op.lte] = new Date(to);
  }
  // Búsqueda del calendario (rediseño CRM) — mismo criterio Op.or/Op.like que
  // leadController.getLeads, extendido al nombre del asesor asignado.
  if (search) {
    where[Op.or] = [
      { '$lead.name$': { [Op.like]: `%${search}%` } },
      { '$lead.phone$': { [Op.like]: `%${search}%` } },
      { '$lead.email$': { [Op.like]: `%${search}%` } },
      { '$lead.assignedUser.name$': { [Op.like]: `%${search}%` } },
    ];
  }
  // CRM de Leads: cierra la fuga de "ver todos los leads vía Calendario" — mismo
  // filtrado por fila que getLeads, pero contra el lead incluido ($lead.col$).
  Object.assign(where, getLeadVisibilityWhere(req.user, { alias: 'lead' }) || {});

  const result = await paginate(Appointment, {
    page,
    limit,
    maxLimit: 500,
    where,
    include: [
      {
        model: Lead,
        as: 'lead',
        attributes: [
          'id',
          'name',
          'phone',
          'email',
          'pipelineStage',
          'businessLine',
          'notes',
          'type',
          'assignedToUserId',
          'createdByUserId',
        ],
        include: [{ model: User, as: 'assignedUser', attributes: ['id', 'name'], required: false }],
      },
      {
        model: Property,
        as: 'property',
        attributes: ['id', 'title', 'city', 'type'],
        required: false,
      },
      { model: User, as: 'createdByUser', attributes: ['id', 'name'], required: false },
    ],
    order: [['scheduledAt', 'ASC']],
  });

  return res.json(result);
};

// GET /api/leads/:id/appointments
const getLeadAppointments = async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');
  if (!canViewLead(req.user, lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  const appointments = await Appointment.findAll({
    where: { leadId: req.params.id },
    include: [
      {
        model: Property,
        as: 'property',
        attributes: ['id', 'title', 'city', 'type'],
        required: false,
      },
      { model: User, as: 'createdByUser', attributes: ['id', 'name'], required: false },
    ],
    order: [['scheduledAt', 'DESC']],
  });

  return res.json({ data: appointments });
};

// POST /api/appointments
const createAppointment = async (req, res) => {
  const { leadId, propertyId, scheduledAt } = req.body;
  if (!leadId || !scheduledAt) throw new ApiError(400, 'leadId y scheduledAt son requeridos');

  const lead = await Lead.findByPk(leadId);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');
  if (!canEditLead(req.user, lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  if (propertyId) {
    const property = await Property.findByPk(propertyId);
    if (!property) throw new ApiError(404, 'Propiedad no encontrada');
  }

  const appointment = await runAppointmentTransaction(async (transaction) => {
    const conflict = await findOverlappingAppointment({
      assignedToUserId: lead.assignedToUserId,
      scheduledAt,
      transaction,
    });
    if (conflict) {
      throw new ApiError(
        409,
        `El asesor ya tiene otra cita agendada cerca de ese horario (${new Date(conflict.scheduledAt).toLocaleString('es-MX')})`
      );
    }

    const created = await Appointment.create(
      {
        leadId,
        propertyId: propertyId || null,
        scheduledAt,
        createdByUserId: req.user?.id ?? null,
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
};

// PATCH /api/appointments/:id
const updateAppointmentStatus = async (req, res) => {
  const appointment = await Appointment.findByPk(req.params.id, {
    include: [{ model: Lead, as: 'lead', attributes: ['id', 'assignedToUserId', 'createdByUserId'] }],
  });
  if (!appointment) throw new ApiError(404, 'Cita no encontrada');
  if (!canEditLead(req.user, appointment.lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  const { status, outcome } = req.body;
  if (status !== undefined && !VALID_APPOINTMENT_STATUS.includes(status)) {
    throw new ApiError(
      400,
      `Estatus inválido. Valores permitidos: ${VALID_APPOINTMENT_STATUS.join(', ')}`
    );
  }

  const updates = {};
  let beforeSnapshot = {};
  await sequelize.transaction(async (transaction) => {
    if (status !== undefined) updates.status = status;
    if (outcome !== undefined) updates.outcome = outcome;
    beforeSnapshot = snapshotFields(appointment, Object.keys(updates));
    await appointment.update(updates, { transaction });

    if (status !== undefined) {
      await logActivity({
        leadId: appointment.leadId,
        type: 'sistema',
        content: `Cita ${status}`,
        userId: req.user?.id ?? null,
        transaction,
      });
    }
  });

  logAudit(req, 'update', 'appointment', appointment.id, {
    status,
    changes: buildChanges(beforeSnapshot, appointment),
  });

  return res.json({ message: 'Cita actualizada exitosamente', data: appointment });
};

// POST /api/appointments/:id/reschedule — conserva la cita anterior (marcada cancelada,
// enlazada vía rescheduledFromId) en vez de sobreescribir la fecha.
const rescheduleAppointment = async (req, res) => {
  const oldAppointment = await Appointment.findByPk(req.params.id, {
    include: [{ model: Lead, as: 'lead', attributes: ['id', 'assignedToUserId', 'createdByUserId'] }],
  });
  if (!oldAppointment) throw new ApiError(404, 'Cita no encontrada');
  if (!canEditLead(req.user, oldAppointment.lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  const { scheduledAt } = req.body;
  if (!scheduledAt) throw new ApiError(400, 'scheduledAt requerido');

  const newAppointment = await runAppointmentTransaction(async (transaction) => {
    await oldAppointment.update({ status: 'cancelada' }, { transaction });

    // CAL-002: excluye explícitamente a oldAppointment.id aunque ya quede 'cancelada'
    // arriba (y por lo tanto ya no calificaría de todos modos) — defensivo por claridad,
    // no por necesidad estricta.
    const conflict = await findOverlappingAppointment({
      assignedToUserId: oldAppointment.lead?.assignedToUserId,
      scheduledAt,
      excludeAppointmentId: oldAppointment.id,
      transaction,
    });
    if (conflict) {
      throw new ApiError(
        409,
        `El asesor ya tiene otra cita agendada cerca de ese horario (${new Date(conflict.scheduledAt).toLocaleString('es-MX')})`
      );
    }

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
};

// DELETE /api/appointments/:id — solo para registros creados por error
const deleteAppointment = async (req, res) => {
  const appointment = await Appointment.findByPk(req.params.id);
  if (!appointment) throw new ApiError(404, 'Cita no encontrada');

  await appointment.destroy();
  logAudit(req, 'delete', 'appointment', req.params.id);

  return res.json({ message: 'Cita eliminada exitosamente' });
};

module.exports = {
  getAppointments,
  getLeadAppointments,
  createAppointment,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment,
};
