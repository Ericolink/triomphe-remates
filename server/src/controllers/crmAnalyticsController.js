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

    // Las primeras 8 consultas no dependen entre sí — se lanzan en paralelo. campaigns/
    // dealCounts sí dependen de campaignIds (derivado de campaignLeadCounts), así que esos
    // se quedan en un segundo paso, pero entre ellos dos tampoco hay dependencia mutua.
    const [
      prospectosNuevos,
      prospectosPendientes,
      seguimientosVencidos,
      citasHoy,
      [ventasSemanaRaw],
      [ventasMesRaw],
      actividadReciente,
      campaignLeadCounts,
    ] = await Promise.all([
      Lead.count({ where: { pipelineStage: 'nuevo' } }),
      Lead.count({ where: { pipelineStage: { [Op.in]: ['nuevo', 'contactado'] } } }),
      Task.count({ where: { done: false, dueDate: { [Op.lt]: now } } }),
      Appointment.findAll({
        where: { scheduledAt: { [Op.between]: [startOfToday, endOfToday] }, status: { [Op.ne]: 'cancelada' } },
        include: [
          { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'] },
          { model: Property, as: 'property', attributes: ['id', 'title'], required: false },
        ],
        order: [['scheduledAt', 'ASC']],
      }),
      Deal.findAll({
        where: { closedAt: { [Op.gte]: startOfWeek } },
        attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total']],
        raw: true,
      }),
      Deal.findAll({
        where: { closedAt: { [Op.gte]: startOfMonth } },
        attributes: [[fn('COUNT', col('id')), 'count'], [fn('SUM', col('amount')), 'total']],
        raw: true,
      }),
      Activity.findAll({
        order: [['occurredAt', 'DESC']],
        limit: 15,
        include: [
          { model: Lead, as: 'lead', attributes: ['id', 'name'] },
          { model: User, as: 'user', attributes: ['id', 'name'], required: false },
        ],
      }),
      // Campaña con mejor rendimiento — top 5 por volumen de prospectos, con su conversión.
      Lead.findAll({
        attributes: ['campaignId', [fn('COUNT', col('id')), 'leadCount']],
        where: { campaignId: { [Op.ne]: null } },
        group: ['campaignId'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        limit: 5,
        raw: true,
      }),
    ]);

    const campaignIds = campaignLeadCounts.map((r) => r.campaignId);
    const [campaigns, dealCounts] = campaignIds.length
      ? await Promise.all([
        Campaign.findAll({ where: { id: { [Op.in]: campaignIds } }, raw: true }),
        Deal.findAll({
          include: [{ model: Lead, as: 'lead', attributes: [], where: { campaignId: { [Op.in]: campaignIds } }, required: true }],
          attributes: [[col('lead.campaignId'), 'campaignId'], [fn('COUNT', col('Deal.id')), 'dealCount']],
          group: ['lead.campaignId'],
          raw: true,
        }),
      ])
      : [[], []];
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
    // Las 4 consultas de base no dependen entre sí — se lanzan en paralelo. advisorUsers/
    // advisorDeals sí dependen de advisorIds (derivado de advisorLeadCounts), así que van
    // en un segundo paso, aunque tampoco dependen entre sí.
    const [
      funnelRaw,
      closeReasonsRaw,
      advisorLeadCounts,
      appointmentStatusRaw,
    ] = await Promise.all([
      Lead.findAll({
        attributes: ['pipelineStage', [fn('COUNT', col('id')), 'total']],
        group: ['pipelineStage'],
        raw: true,
      }),
      Lead.findAll({
        attributes: ['closeReason', [fn('COUNT', col('id')), 'total']],
        where: { pipelineStage: 'no_interesado', closeReason: { [Op.ne]: null } },
        group: ['closeReason'],
        raw: true,
      }),
      // Por asesor — tabla plana con números, deliberadamente sin ranking/medallas (esa
      // funcionalidad de "leaderboard" queda fuera del alcance de la Fase 1).
      Lead.findAll({
        attributes: ['assignedToUserId', [fn('COUNT', col('id')), 'leadCount']],
        where: { assignedToUserId: { [Op.ne]: null } },
        group: ['assignedToUserId'],
        raw: true,
      }),
      Appointment.findAll({
        attributes: ['status', [fn('COUNT', col('id')), 'total']],
        group: ['status'],
        raw: true,
      }),
    ]);

    const funnel = PIPELINE_STAGES.map((stage) => ({
      stage,
      total: parseInt(funnelRaw.find((r) => r.pipelineStage === stage)?.total || 0, 10),
    }));

    const closeReasons = CLOSE_REASONS.map((reason) => ({
      reason,
      total: parseInt(closeReasonsRaw.find((r) => r.closeReason === reason)?.total || 0, 10),
    }));

    const advisorIds = advisorLeadCounts.map((r) => r.assignedToUserId);
    const [advisorUsers, advisorDeals] = advisorIds.length
      ? await Promise.all([
        User.findAll({ where: { id: { [Op.in]: advisorIds } }, attributes: ['id', 'name'], raw: true }),
        Deal.findAll({
          include: [{ model: Lead, as: 'lead', attributes: [], where: { assignedToUserId: { [Op.in]: advisorIds } }, required: true }],
          attributes: [[col('lead.assignedToUserId'), 'assignedToUserId'], [fn('COUNT', col('Deal.id')), 'dealCount'], [fn('SUM', col('amount')), 'revenue']],
          group: ['lead.assignedToUserId'],
          raw: true,
        }),
      ])
      : [[], []];
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
