const { Op, fn, col } = require('sequelize');
const {
  sequelize,
  Lead,
  Task,
  Appointment,
  Deal,
  Activity,
  Campaign,
  Property,
  User,
} = require('../models/index');
const { TERMINAL_STAGES, staleSinceExpr } = require('../utils/pipelineHelpers');
const { getLeadVisibilityWhere } = require('../utils/leadAccess');
const {
  mexicoMidnightUtc,
  mexicoMidnightUtcFromParts,
  MEXICO_UTC_OFFSET_HOURS,
} = require('../utils/mexicoTime');

// Separado de analyticsController.js: ese archivo es específico del funnel de marketing de
// propiedades (vistas/leads por status legacy); mezclar ahí la agregación de
// Task/Appointment/Deal/Activity sobrecargaría un dominio con otro.

const PIPELINE_STAGES = [
  'nuevo',
  'contactado',
  'interesado',
  'negociacion',
  'cita_agendada',
  'cita_realizada',
  'cita_con_seguimiento',
  'venta_realizada',
  'no_interesado',
  'lista_espera',
];
const CLOSE_REASONS = [
  'compro',
  'no_respondio',
  'sin_presupuesto',
  'compro_competencia',
  'solo_info',
  'perdio_interes',
  'otro',
];
const APPOINTMENT_STATUSES = ['programada', 'confirmada', 'completada', 'no_show', 'cancelada'];
const VALID_BUSINESS_LINES = ['remate', 'credito', 'renta', 'contado', 'inversion'];

// `month` viene como "YYYY-MM" del selector del Dashboard — se traduce al rango
// [primer día, último día] en hora local para filtrar por `createdAt`/`scheduledAt`.
// Valores inválidos se ignoran (sin filtro) en vez de fallar: este es un endpoint de
// reportes internos, no un boundary público que necesite rechazar input con un 400.
function monthRange(month) {
  if (!/^\d{4}-\d{2}$/.test(month || '')) return null;
  const [year, m] = month.split('-').map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 0, 23, 59, 59, 999);
  return { start, end };
}

// GET /api/crm/dashboard
const getCrmDashboard = async (req, res) => {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const staleCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Las primeras 9 consultas no dependen entre sí — se lanzan en paralelo. campaigns/
  // dealCounts sí dependen de campaignIds (derivado de campaignLeadCounts), así que esos
  // se quedan en un segundo paso, pero entre ellos dos tampoco hay dependencia mutua.
  const [
    prospectosNuevos,
    prospectosPendientes,
    prospectosEstancados,
    seguimientosVencidos,
    citasHoy,
    [ventasSemanaRaw],
    [ventasMesRaw],
    actividadReciente,
    campaignLeadCounts,
  ] = await Promise.all([
    Lead.count({ where: { pipelineStage: 'nuevo' } }),
    Lead.count({ where: { pipelineStage: { [Op.in]: ['nuevo', 'contactado'] } } }),
    // SEC-001: este count (y el resto del Promise.all de abajo — citasHoy con PII de
    // teléfono, actividadReciente, ventas/campañas de toda la empresa) son agregados
    // globales por diseño. Antes eran alcanzables también por `asesor_ventas` (vía
    // requireCrmAccess), lo que filtraba esos datos entre asesores; ahora la ruta
    // (routes/crm.js) está restringida a admin/asistente_administrativo, los únicos dos
    // roles para los que getLeadVisibilityWhere ya devuelve `null` (sin restricción) — así
    // que este filtro sigue siendo un no-op para quien de verdad llega aquí, y se deja
    // como defensa en profundidad en vez de quitarlo.
    Lead.count({
      where: {
        pipelineStage: { [Op.notIn]: TERMINAL_STAGES },
        [Op.and]: [sequelize.where(sequelize.literal(staleSinceExpr()), Op.lt, staleCutoff)],
        ...(getLeadVisibilityWhere(req.user) || {}),
      },
    }),
    Task.count({ where: { done: false, dueDate: { [Op.lt]: now } } }),
    Appointment.findAll({
      where: {
        scheduledAt: { [Op.between]: [startOfToday, endOfToday] },
        status: { [Op.ne]: 'cancelada' },
      },
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'] },
        { model: Property, as: 'property', attributes: ['id', 'title'], required: false },
      ],
      order: [['scheduledAt', 'ASC']],
    }),
    Deal.findAll({
      where: { closedAt: { [Op.gte]: startOfWeek } },
      attributes: [
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('amount')), 'total'],
      ],
      raw: true,
    }),
    Deal.findAll({
      where: { closedAt: { [Op.gte]: startOfMonth } },
      attributes: [
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('amount')), 'total'],
      ],
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
          include: [
            {
              model: Lead,
              as: 'lead',
              attributes: [],
              where: { campaignId: { [Op.in]: campaignIds } },
              required: true,
            },
          ],
          attributes: [
            [col('lead.campaignId'), 'campaignId'],
            [fn('COUNT', col('Deal.id')), 'dealCount'],
          ],
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
      prospectosEstancados,
      seguimientosVencidos,
      citasHoy,
      ventasSemana: {
        count: parseInt(ventasSemanaRaw?.count || 0, 10),
        total: parseFloat(ventasSemanaRaw?.total || 0),
      },
      ventasMes: {
        count: parseInt(ventasMesRaw?.count || 0, 10),
        total: parseFloat(ventasMesRaw?.total || 0),
      },
      actividadReciente,
      mejoresCampanas,
    },
  });
};

// GET /api/crm/reports?businessLine=remate|credito|renta|contado|inversion&month=YYYY-MM
const getCrmReports = async (req, res) => {
  const { businessLine, month } = req.query;
  const validBusinessLine = VALID_BUSINESS_LINES.includes(businessLine) ? businessLine : null;
  const range = monthRange(month);

  // Filtro compartido por las 3 consultas basadas en Lead (funnel/closeReasons/porAsesor) —
  // Appointment no tiene businessLine propio (no siempre está ligado a un Lead con línea
  // asignada), así que "Citas por estado" solo respeta el filtro de mes, no el de línea.
  const leadWhere = {
    ...(validBusinessLine && { businessLine: validBusinessLine }),
    ...(range && { createdAt: { [Op.between]: [range.start, range.end] } }),
  };
  const appointmentWhere = range ? { scheduledAt: { [Op.between]: [range.start, range.end] } } : {};

  // Las 4 consultas de base no dependen entre sí — se lanzan en paralelo. advisorUsers/
  // advisorDeals sí dependen de advisorIds (derivado de advisorLeadCounts), así que van
  // en un segundo paso, aunque tampoco dependen entre sí.
  const [funnelRaw, closeReasonsRaw, advisorLeadCounts, appointmentStatusRaw] = await Promise.all([
    Lead.findAll({
      attributes: ['pipelineStage', [fn('COUNT', col('id')), 'total']],
      where: leadWhere,
      group: ['pipelineStage'],
      raw: true,
    }),
    Lead.findAll({
      attributes: ['closeReason', [fn('COUNT', col('id')), 'total']],
      where: { ...leadWhere, pipelineStage: 'no_interesado', closeReason: { [Op.ne]: null } },
      group: ['closeReason'],
      raw: true,
    }),
    // Por asesor — tabla plana con números, deliberadamente sin ranking/medallas (esa
    // funcionalidad de "leaderboard" queda fuera del alcance de la Fase 1). Se agrupa
    // también por businessLine para poder mostrar de qué línea es cada prospecto sin
    // tener que cambiar de tab (ver `byLine` en el reshape de abajo).
    Lead.findAll({
      attributes: [
        'assignedToUserId',
        'businessLine',
        [fn('COUNT', col('id')), 'leadCount'],
      ],
      where: { ...leadWhere, assignedToUserId: { [Op.ne]: null } },
      group: ['assignedToUserId', 'businessLine'],
      raw: true,
    }),
    Appointment.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'total']],
      where: appointmentWhere,
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

  const advisorIds = [...new Set(advisorLeadCounts.map((r) => r.assignedToUserId))];
  const [advisorUsers, advisorDeals] = advisorIds.length
    ? await Promise.all([
        User.findAll({
          where: { id: { [Op.in]: advisorIds } },
          attributes: ['id', 'name'],
          raw: true,
        }),
        Deal.findAll({
          include: [
            {
              model: Lead,
              as: 'lead',
              attributes: [],
              where: { ...leadWhere, assignedToUserId: { [Op.in]: advisorIds } },
              required: true,
            },
          ],
          attributes: [
            [col('lead.assignedToUserId'), 'assignedToUserId'],
            [fn('COUNT', col('Deal.id')), 'dealCount'],
            [fn('SUM', col('amount')), 'revenue'],
          ],
          group: ['lead.assignedToUserId'],
          raw: true,
        }),
      ])
    : [[], []];

  const porAsesorMap = new Map();
  for (const row of advisorLeadCounts) {
    const leadCount = parseInt(row.leadCount, 10);
    const entry = porAsesorMap.get(row.assignedToUserId) || {
      userId: row.assignedToUserId,
      leadCount: 0,
      byLine: { remate: 0, credito: 0, renta: 0, contado: 0, inversion: 0, sin_especificar: 0 },
    };
    entry.leadCount += leadCount;
    entry.byLine[row.businessLine || 'sin_especificar'] += leadCount;
    porAsesorMap.set(row.assignedToUserId, entry);
  }
  const porAsesor = [...porAsesorMap.values()].map((entry) => {
    const user = advisorUsers.find((u) => u.id === entry.userId);
    const dealRow = advisorDeals.find((d) => d.assignedToUserId === entry.userId);
    return {
      ...entry,
      name: user?.name || 'Desconocido',
      dealCount: parseInt(dealRow?.dealCount || 0, 10),
      revenue: parseFloat(dealRow?.revenue || 0),
    };
  });

  const citasPorEstado = APPOINTMENT_STATUSES.map((status) => ({
    status,
    total: parseInt(appointmentStatusRaw.find((r) => r.status === status)?.total || 0, 10),
  }));

  return res.json({ data: { funnel, closeReasons, porAsesor, citasPorEstado } });
};

// GET /api/crm/my-dashboard — dashboard personal de un asesor_ventas ("¿cómo va mi cartera y
// qué debo atender hoy?"). A diferencia de getCrmDashboard/getCrmReports (ver comentario en
// routes/crm.js — SEC-001/SEC-002, agregados globales sin filtrar por fila), este endpoint
// se diseñó desde cero para exponer solo la cartera de quien lo pide: cada consulta aplica
// getLeadVisibilityWhere, la misma fuente de verdad que ya usan leadController/taskController/
// appointmentController/dealController. La ruta además restringe con authorize('asesor_ventas')
// (routes/crm.js) — el filtro de aquí es defensa en profundidad, no la única barrera.
const getMyCrmDashboard = async (req, res) => {
  const nowMx = new Date(Date.now() + MEXICO_UTC_OFFSET_HOURS * 60 * 60 * 1000);
  const now = new Date();
  const startOfToday = mexicoMidnightUtc(0);
  const startOfTomorrow = mexicoMidnightUtc(1);
  const startOfDayAfterTomorrow = mexicoMidnightUtc(2);
  const startOfNext7 = mexicoMidnightUtc(7);
  const start7DaysAgo = mexicoMidnightUtc(-7);
  const startOfMonth = mexicoMidnightUtcFromParts(nowMx.getUTCFullYear(), nowMx.getUTCMonth() + 1, 1);

  const leadWhere = getLeadVisibilityWhere(req.user) || {};
  const leadAliasWhere = getLeadVisibilityWhere(req.user, { alias: 'lead' }) || {};
  // Objeto nuevo en cada llamada a propósito — varias de estas queries corren en paralelo
  // dentro del mismo Promise.all, y no vale la pena arriesgar que Sequelize mute/comparta
  // estado interno de un `include` reutilizado entre queries concurrentes.
  const makeLeadInclude = () => ({
    model: Lead,
    as: 'lead',
    attributes: ['id', 'name', 'phone'],
    required: false,
  });

  // Primer lote: todas independientes entre sí, se lanzan en paralelo. `activeLeads` alimenta
  // tanto "requierenAtencion" como "propiedadesInteres" sin necesitar una query aparte para
  // cada uno (mismo criterio de reutilización que mejoresCampanas/porAsesor arriba).
  const [
    prospectosActivos,
    nuevosHoy,
    nuevos7dias,
    nuevosMes,
    seguimientosVencidos,
    citasHoy,
    citasManana,
    citasProximas7Dias,
    pipelineRaw,
    [ventasMesRaw],
    activeLeads,
    actividadReciente,
    citasPorEstadoRaw,
    closeReasonsRaw,
  ] = await Promise.all([
    Lead.count({ where: { ...leadWhere, pipelineStage: { [Op.notIn]: TERMINAL_STAGES } } }),
    Lead.count({ where: { ...leadWhere, assignedAt: { [Op.gte]: startOfToday } } }),
    Lead.count({ where: { ...leadWhere, assignedAt: { [Op.gte]: start7DaysAgo } } }),
    Lead.count({ where: { ...leadWhere, assignedAt: { [Op.gte]: startOfMonth } } }),
    Task.count({
      where: { done: false, dueDate: { [Op.lt]: now }, ...leadAliasWhere },
      include: [makeLeadInclude()],
    }),
    Appointment.findAll({
      where: {
        scheduledAt: { [Op.gte]: startOfToday, [Op.lt]: startOfTomorrow },
        status: { [Op.ne]: 'cancelada' },
        ...leadAliasWhere,
      },
      include: [makeLeadInclude(), { model: Property, as: 'property', attributes: ['id', 'title'], required: false }],
      order: [['scheduledAt', 'ASC']],
    }),
    Appointment.findAll({
      where: {
        scheduledAt: { [Op.gte]: startOfTomorrow, [Op.lt]: startOfDayAfterTomorrow },
        status: { [Op.ne]: 'cancelada' },
        ...leadAliasWhere,
      },
      include: [makeLeadInclude(), { model: Property, as: 'property', attributes: ['id', 'title'], required: false }],
      order: [['scheduledAt', 'ASC']],
    }),
    // "Próximos 7 días" incluye hoy/mañana (superconjunto) — mismo criterio que ya usa
    // CalendarioSection.jsx para su propio indicador de próximos 7 días.
    Appointment.findAll({
      where: {
        scheduledAt: { [Op.gte]: startOfToday, [Op.lt]: startOfNext7 },
        status: { [Op.ne]: 'cancelada' },
        ...leadAliasWhere,
      },
      include: [makeLeadInclude(), { model: Property, as: 'property', attributes: ['id', 'title'], required: false }],
      order: [['scheduledAt', 'ASC']],
    }),
    Lead.findAll({
      attributes: ['pipelineStage', [fn('COUNT', col('id')), 'total']],
      where: leadWhere,
      group: ['pipelineStage'],
      raw: true,
    }),
    Deal.findAll({
      where: { closedAt: { [Op.gte]: startOfMonth }, ...leadAliasWhere },
      include: [{ model: Lead, as: 'lead', attributes: [], required: true }],
      attributes: [
        [fn('COUNT', col('Deal.id')), 'count'],
        [fn('SUM', col('amount')), 'total'],
      ],
      raw: true,
    }),
    Lead.findAll({
      where: { ...leadWhere, pipelineStage: { [Op.notIn]: TERMINAL_STAGES } },
      attributes: [
        'id',
        'name',
        'phone',
        'pipelineStage',
        'propertyId',
        [sequelize.literal(staleSinceExpr()), 'lastTouchedAt'],
      ],
      include: [{ model: Property, as: 'property', attributes: ['id', 'title', 'slug'], required: false }],
      order: [['createdAt', 'DESC']],
    }),
    Activity.findAll({
      where: leadAliasWhere,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name'], required: true },
        { model: User, as: 'user', attributes: ['id', 'name'], required: false },
      ],
      order: [['occurredAt', 'DESC']],
      limit: 10,
    }),
    Appointment.findAll({
      // col('Appointment.id') calificado a propósito: con el join a Lead presente, un `id`
      // sin calificar es ambiguo entre appointments.id y leads.id (mismo criterio que ya usa
      // getCrmDashboard con col('Deal.id') cuando también hay un join).
      attributes: ['status', [fn('COUNT', col('Appointment.id')), 'total']],
      where: leadAliasWhere,
      include: [{ model: Lead, as: 'lead', attributes: [], required: true }],
      group: ['status'],
      raw: true,
    }),
    Lead.findAll({
      attributes: ['closeReason', [fn('COUNT', col('id')), 'total']],
      where: { ...leadWhere, pipelineStage: 'no_interesado', closeReason: { [Op.ne]: null } },
      group: ['closeReason'],
      raw: true,
    }),
  ]);

  // Segundo lote: depende de los ids de activeLeads (tareas abiertas + total gestionado
  // histórico para la conversión) — no dependen entre sí, se lanzan juntos.
  const activeLeadIds = activeLeads.map((l) => l.id);
  const [openTasks, gestionados] = await Promise.all([
    activeLeadIds.length
      ? Task.findAll({
          where: { leadId: { [Op.in]: activeLeadIds }, done: false },
          attributes: ['id', 'leadId', 'type', 'dueDate'],
        })
      : [],
    Lead.count({ where: { ...leadWhere, pipelineStage: { [Op.ne]: 'lista_espera' } } }),
  ]);
  const openTaskByLeadId = new Map(openTasks.map((t) => [t.leadId, t]));

  // "Requieren tu atención" — un lead por fila, motivo de mayor a menor prioridad (PASO 6):
  // 1) cita hoy, 2) tarea vencida, 3) sin contacto ≥7 días, 4) cita mañana, 5) etapa avanzada
  // sin cita ni tarea programada. Un lead con cita hoy y tarea vencida solo aparece una vez,
  // con el motivo de mayor prioridad.
  const citasHoyByLeadId = new Set(citasHoy.map((a) => a.leadId));
  const citasMananaByLeadId = new Set(citasManana.map((a) => a.leadId));
  const ADVANCED_STAGES = ['negociacion', 'cita_con_seguimiento', 'cita_realizada'];
  const requierenAtencion = activeLeads
    .map((lead) => {
      const task = openTaskByLeadId.get(lead.id);
      const isTaskOverdue = task && new Date(task.dueDate) < now;
      const lastTouchedAt = lead.get('lastTouchedAt');
      const staleDays = lastTouchedAt
        ? Math.floor((now - new Date(lastTouchedAt)) / (24 * 60 * 60 * 1000))
        : null;

      let reasonType = null;
      let reason = null;
      let priority = 99;
      if (citasHoyByLeadId.has(lead.id)) {
        reasonType = 'cita_hoy';
        reason = 'Tiene cita agendada para hoy';
        priority = 1;
      } else if (isTaskOverdue) {
        reasonType = 'tarea_vencida';
        reason = 'Seguimiento vencido';
        priority = 2;
      } else if (staleDays !== null && staleDays >= 7) {
        reasonType = 'sin_contacto';
        reason = `Sin contacto hace ${staleDays} días`;
        priority = 3;
      } else if (citasMananaByLeadId.has(lead.id)) {
        reasonType = 'cita_manana';
        reason = 'Tiene cita agendada para mañana';
        priority = 4;
      } else if (ADVANCED_STAGES.includes(lead.pipelineStage) && !task) {
        reasonType = 'etapa_avanzada_sin_seguimiento';
        reason = 'En etapa avanzada sin próxima acción programada';
        priority = 5;
      }

      if (!reasonType) return null;
      return {
        leadId: lead.id,
        name: lead.name,
        phone: lead.phone,
        pipelineStage: lead.pipelineStage,
        reasonType,
        reason,
        priority,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 10);

  // "Propiedades de interés" — Lead.propertyId ya existe (de dónde vino el contacto); se
  // agrupa lo ya traído en activeLeads en vez de una query aparte (PASO 9: solo si el dato ya
  // existe, sin llenar el dashboard de propiedades).
  const propiedadesInteresMap = new Map();
  for (const lead of activeLeads) {
    const property = lead.property;
    if (!property) continue;
    const entry = propiedadesInteresMap.get(property.id) || {
      propertyId: property.id,
      title: property.title,
      slug: property.slug,
      leadCount: 0,
    };
    entry.leadCount += 1;
    propiedadesInteresMap.set(property.id, entry);
  }
  const propiedadesInteres = [...propiedadesInteresMap.values()]
    .sort((a, b) => b.leadCount - a.leadCount)
    .slice(0, 5);

  const pipeline = PIPELINE_STAGES.map((stage) => ({
    stage,
    total: parseInt(pipelineRaw.find((r) => r.pipelineStage === stage)?.total || 0, 10),
  }));
  const ventaRealizadaTotal = pipeline.find((p) => p.stage === 'venta_realizada')?.total || 0;
  const conversionRate =
    gestionados > 0 ? Math.round((ventaRealizadaTotal / gestionados) * 1000) / 10 : 0;

  const citasPorEstado = APPOINTMENT_STATUSES.map((status) => ({
    status,
    total: parseInt(citasPorEstadoRaw.find((r) => r.status === status)?.total || 0, 10),
  }));
  const closeReasons = CLOSE_REASONS.map((reason) => ({
    reason,
    total: parseInt(closeReasonsRaw.find((r) => r.closeReason === reason)?.total || 0, 10),
  }));

  return res.json({
    data: {
      prospectosActivos,
      nuevos: { hoy: nuevosHoy, ultimos7dias: nuevos7dias, esteMes: nuevosMes },
      seguimientosVencidos,
      citasHoy,
      citasManana,
      citasProximas7Dias,
      pipeline,
      conversion: { rate: conversionRate, convertidos: ventaRealizadaTotal, gestionados },
      ventasMes: {
        count: parseInt(ventasMesRaw?.count || 0, 10),
        total: parseFloat(ventasMesRaw?.total || 0),
      },
      requierenAtencion,
      propiedadesInteres,
      actividadReciente,
      reportes: { citasPorEstado, closeReasons },
    },
  });
};

module.exports = { getCrmDashboard, getCrmReports, getMyCrmDashboard };
