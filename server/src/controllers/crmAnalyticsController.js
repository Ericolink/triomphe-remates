const { Op, fn, col } = require('sequelize');
const { Lead, Task, Appointment, Deal, Activity, Campaign, Property, User } = require('../models/index');

// Separado de analyticsController.js: ese archivo es específico del funnel de marketing de
// propiedades (vistas/leads por status legacy); mezclar ahí la agregación de
// Task/Appointment/Deal/Activity sobrecargaría un dominio con otro.

const PIPELINE_STAGES = ['nuevo', 'contactado', 'interesado', 'cita_agendada', 'cita_realizada', 'negociacion', 'venta_realizada', 'no_interesado'];
const CLOSE_REASONS = ['compro', 'no_respondio', 'sin_presupuesto', 'compro_competencia', 'solo_info', 'perdio_interes', 'otro'];
const APPOINTMENT_STATUSES = ['programada', 'confirmada', 'completada', 'no_show', 'cancelada'];

// GET /api/crm/dashboard
const getCrmDashboard = async (req, res) => {
  try {
    const now = new Date();
    const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() + 1); startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const prospectosNuevos = await Lead.count({ where: { pipelineStage: 'nuevo' } });
    const prospectosPendientes = await Lead.count({ where: { pipelineStage: { [Op.in]: ['nuevo', 'contactado'] } } });
    const seguimientosVencidos = await Task.count({ where: { done: false, dueDate: { [Op.lt]: now } } });

    const citasHoy = await Appointment.findAll({
      where: { scheduledAt: { [Op.between]: [startOfToday, endOfToday] }, status: { [Op.ne]: 'cancelada' } },
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'] },
        { model: Property, as: 'property', attributes: ['id', 'title'], required: false },
      ],
      order: [['scheduledAt', 'ASC']],
    });

    const [ventasSemanaRaw] = await Deal.findAll({
      where: { closedAt: { [Op.gte]: startOfWeek } },
      attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total']],
      raw: true,
    });
    const [ventasMesRaw] = await Deal.findAll({
      where: { closedAt: { [Op.gte]: startOfMonth } },
      attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total']],
      raw: true,
    });

    const actividadReciente = await Activity.findAll({
      order: [['occurredAt', 'DESC']],
      limit: 15,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name'] },
        { model: User, as: 'user', attributes: ['id', 'name'], required: false },
      ],
    });

    // Campaña con mejor rendimiento — top 5 por volumen de prospectos, con su conversión.
    const campaignLeadCounts = await Lead.findAll({
      attributes: ['campaignId', [fn('COUNT', col('id')), 'leadCount']],
      where: { campaignId: { [Op.ne]: null } },
      group: ['campaignId'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      limit: 5,
      raw: true,
    });
    const campaignIds = campaignLeadCounts.map((r) => r.campaignId);
    const campaigns = campaignIds.length
      ? await Campaign.findAll({ where: { id: { [Op.in]: campaignIds } }, raw: true })
      : [];
    const dealCounts = campaignIds.length
      ? await Deal.findAll({
        include: [{ model: Lead, as: 'lead', attributes: [], where: { campaignId: { [Op.in]: campaignIds } }, required: true }],
        attributes: [[col('lead.campaignId'), 'campaignId'], [fn('COUNT', col('Deal.id')), 'dealCount']],
        group: ['lead.campaignId'],
        raw: true,
      })
      : [];
    const mejoresCampanas = campaignLeadCounts
      .map((row) => {
        const campaign = campaigns.find((c) => c.id === row.campaignId);
        const dealRow = dealCounts.find((d) => d.campaignId === row.campaignId);
        const leadCount = parseInt(row.leadCount, 10);
        const dealCount = parseInt(dealRow?.dealCount || 0, 10);
        return {
          campaignId: row.campaignId,
          name: campaign?.name || 'Desconocida',
          platform: campaign?.platform || null,
          leadCount,
          dealCount,
          conversionRate: leadCount > 0 ? Math.round((dealCount / leadCount) * 1000) / 10 : 0,
        };
      })
      .sort((a, b) => b.leadCount - a.leadCount);

    return res.json({
      data: {
        prospectosNuevos,
        prospectosPendientes,
        seguimientosVencidos,
        citasHoy,
        ventasSemana: { count: parseInt(ventasSemanaRaw?.count || 0, 10), total: parseFloat(ventasSemanaRaw?.total || 0) },
        ventasMes: { count: parseInt(ventasMesRaw?.count || 0, 10), total: parseFloat(ventasMesRaw?.total || 0) },
        actividadReciente,
        mejoresCampanas,
      },
    });
  } catch (error) {
    console.error('Error en getCrmDashboard:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/crm/reports
const getCrmReports = async (req, res) => {
  try {
    const funnelRaw = await Lead.findAll({
      attributes: ['pipelineStage', [fn('COUNT', col('id')), 'total']],
      group: ['pipelineStage'],
      raw: true,
    });
    const funnel = PIPELINE_STAGES.map((stage) => ({
      stage,
      total: parseInt(funnelRaw.find((r) => r.pipelineStage === stage)?.total || 0, 10),
    }));

    const closeReasonsRaw = await Lead.findAll({
      attributes: ['closeReason', [fn('COUNT', col('id')), 'total']],
      where: { pipelineStage: 'no_interesado', closeReason: { [Op.ne]: null } },
      group: ['closeReason'],
      raw: true,
    });
    const closeReasons = CLOSE_REASONS.map((reason) => ({
      reason,
      total: parseInt(closeReasonsRaw.find((r) => r.closeReason === reason)?.total || 0, 10),
    }));

    // Por asesor — tabla plana con números, deliberadamente sin ranking/medallas (esa
    // funcionalidad de "leaderboard" queda fuera del alcance de la Fase 1).
    const advisorLeadCounts = await Lead.findAll({
      attributes: ['assignedToUserId', [fn('COUNT', col('id')), 'leadCount']],
      where: { assignedToUserId: { [Op.ne]: null } },
      group: ['assignedToUserId'],
      raw: true,
    });
    const advisorIds = advisorLeadCounts.map((r) => r.assignedToUserId);
    const advisorUsers = advisorIds.length
      ? await User.findAll({ where: { id: { [Op.in]: advisorIds } }, attributes: ['id', 'name'], raw: true })
      : [];
    const advisorDeals = advisorIds.length
      ? await Deal.findAll({
        include: [{ model: Lead, as: 'lead', attributes: [], where: { assignedToUserId: { [Op.in]: advisorIds } }, required: true }],
        attributes: [[col('lead.assignedToUserId'), 'assignedToUserId'], [fn('COUNT', col('Deal.id')), 'dealCount'], [fn('SUM', col('amount')), 'revenue']],
        group: ['lead.assignedToUserId'],
        raw: true,
      })
      : [];
    const porAsesor = advisorLeadCounts.map((row) => {
      const user = advisorUsers.find((u) => u.id === row.assignedToUserId);
      const dealRow = advisorDeals.find((d) => d.assignedToUserId === row.assignedToUserId);
      return {
        userId: row.assignedToUserId,
        name: user?.name || 'Desconocido',
        leadCount: parseInt(row.leadCount, 10),
        dealCount: parseInt(dealRow?.dealCount || 0, 10),
        revenue: parseFloat(dealRow?.revenue || 0),
      };
    });

    const appointmentStatusRaw = await Appointment.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'total']],
      group: ['status'],
      raw: true,
    });
    const citasPorEstado = APPOINTMENT_STATUSES.map((status) => ({
      status,
      total: parseInt(appointmentStatusRaw.find((r) => r.status === status)?.total || 0, 10),
    }));

    return res.json({ data: { funnel, closeReasons, porAsesor, citasPorEstado } });
  } catch (error) {
    console.error('Error en getCrmReports:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getCrmDashboard, getCrmReports };
