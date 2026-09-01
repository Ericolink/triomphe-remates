const { Analytics, Property, Lead, LeadProperty } = require('../models/index');
const { Op, fn, col, literal } = require('sequelize');
const { ApiError } = require('../middleware/errorHandler');
const { sanitizeEventInput, recordEvent } = require('../services/analyticsService');
const {
  DAY_MS,
  mexicoMidnightUtc,
  mexicoMidnightUtcFromParts,
  mexicoDateKey,
  mexicoWeekStartKey,
  formatDateKeyLabel,
} = require('../utils/mexicoTime');

// GET /api/analytics/dashboard
const getDashboard = async (req, res) => {
  // Ancladas a la hora de México, no a la del proceso/SO (ver mexicoTime.js) — antes usaban
  // new Date().setDate(...), que corta "hoy" según la zona horaria del servidor, no
  // controlada en producción.
  const thirtyDaysAgo = mexicoMidnightUtc(-30);
  const eightWeeksAgo = mexicoMidnightUtc(-56);

  // Ninguna de estas 20 consultas depende del resultado de otra — solo de las fechas ya
  // calculadas arriba — así que se lanzan todas en paralelo en vez de una por una.
  const [
    totalProperties,
    availableProperties,
    enRevisionProperties,
    apartadoProperties,
    soldProperties,
    deVueltaProperties,
    propertiesByCity,
    propertiesByType,
    topProperties,
    totalViews,
    totalLeads,
    newLeads,
    closedLeads,
    leadsByStatusRaw,
    leadsByTypeRaw,
    leadsBySourceRaw,
    recentLeads,
    recentClosedLeads,
    leadsRaw,
    viewsRaw,
  ] = await Promise.all([
    Property.count(),
    Property.count({ where: { status: 'disponible' } }),
    Property.count({ where: { status: 'en_revision' } }),
    Property.count({ where: { status: 'apartado' } }),
    Property.count({ where: { status: 'vendido' } }),
    Property.count({ where: { status: 'de_vuelta' } }),
    Property.findAll({
      attributes: ['city', [fn('COUNT', col('id')), 'total']],
      group: ['city'],
      raw: true,
    }),
    Property.findAll({
      attributes: ['type', [fn('COUNT', col('id')), 'total']],
      group: ['type'],
      raw: true,
    }),
    Property.findAll({
      attributes: ['id', 'title', 'city', 'views', 'slug'],
      order: [['views', 'DESC']],
      limit: 5,
    }),
    Analytics.count({
      where: {
        event: 'property_view',
        createdAt: { [Op.gte]: thirtyDaysAgo },
      },
    }),
    Lead.count(),
    Lead.count({ where: { status: 'nuevo' } }),
    Lead.count({ where: { status: 'cerrado' } }),
    Lead.findAll({
      attributes: ['status', [fn('COUNT', col('id')), 'total']],
      group: ['status'],
      raw: true,
    }),
    Lead.findAll({
      attributes: ['type', [fn('COUNT', col('id')), 'total']],
      group: ['type'],
      raw: true,
    }),
    Lead.findAll({
      attributes: ['source', [fn('COUNT', col('id')), 'total']],
      group: ['source'],
      raw: true,
    }),
    // Embudo de conversión (últimos 30 días): vistas → leads → cerrados
    Lead.count({ where: { createdAt: { [Op.gte]: thirtyDaysAgo } } }),
    Lead.count({ where: { status: 'cerrado', createdAt: { [Op.gte]: thirtyDaysAgo } } }),
    // createdAt crudo (sin GROUP BY DATE() de MySQL) — el bucketing por semana se hace en
    // JS con mexicoWeekStartKey, anclado a hora de México, no a la del proceso ni a la
    // sesión UTC de MySQL (ver mexicoTime.js). Volumen bajo (8 semanas), sin costo real.
    Lead.findAll({
      attributes: ['createdAt'],
      where: { createdAt: { [Op.gte]: eightWeeksAgo } },
      raw: true,
    }),
    Analytics.findAll({
      attributes: ['createdAt'],
      where: { event: 'property_view', isBot: false, createdAt: { [Op.gte]: eightWeeksAgo } },
      raw: true,
    }),
  ]);

  const leadsByStatus = ['nuevo', 'contactado', 'cerrado', 'descartado'].map((status) => ({
    status,
    total: parseInt(leadsByStatusRaw.find((r) => r.status === status)?.total || 0),
  }));

  const leadsByType = [
    'comprar_propiedad',
    'rentar_propiedad',
    'vender_propiedad',
    'invertir_remates',
    'contacto',
    'cita',
    'asesoria_financiera',
    'otro',
    'informacion',
    'propiedades_similares',
  ].map((type) => ({
    type,
    total: parseInt(leadsByTypeRaw.find((r) => r.type === type)?.total || 0),
  }));

  const leadsBySource = ['google', 'facebook', 'whatsapp', 'directo', 'referido', 'otro'].map(
    (source) => ({
      source,
      total: parseInt(leadsBySourceRaw.find((r) => r.source === source)?.total || 0),
    })
  );

  const conversionRate = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0;
  const viewToLeadRate = totalViews > 0 ? (recentLeads / totalViews) * 100 : 0;

  // Agrupar por semana, ancladas a hora de México (ver mexicoTime.js) — leadsRaw/viewsRaw
  // ahora traen createdAt crudo, no un DATE() ya agrupado por MySQL en UTC.
  const weekMap = new Map();
  leadsRaw.forEach(({ createdAt }) => {
    const key = mexicoWeekStartKey(new Date(createdAt));
    weekMap.set(key, (weekMap.get(key) || 0) + 1);
  });
  const leadsOverTime = [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([date, count]) => ({ date, label: formatDateKeyLabel(date), count }));

  // Vistas por semana — últimas 8 semanas
  const viewWeekMap = new Map();
  viewsRaw.forEach(({ createdAt }) => {
    const key = mexicoWeekStartKey(new Date(createdAt));
    viewWeekMap.set(key, (viewWeekMap.get(key) || 0) + 1);
  });
  const viewsOverTime = [...viewWeekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([date, count]) => ({ date, label: formatDateKeyLabel(date), count }));

  return res.json({
    data: {
      properties: {
        total: totalProperties,
        disponible: availableProperties,
        en_revision: enRevisionProperties,
        apartado: apartadoProperties,
        vendido: soldProperties,
        de_vuelta: deVueltaProperties,
      },
      byCity: propertiesByCity,
      byType: propertiesByType,
      topProperties,
      views: { last30Days: totalViews },
      leads: { total: totalLeads, new: newLeads, closed: closedLeads },
      leadsByStatus,
      leadsByType,
      leadsBySource,
      conversion: {
        rate: Math.round(conversionRate * 10) / 10,
        viewToLeadRate: Math.round(viewToLeadRate * 10) / 10,
        funnel: { views: totalViews, leads: recentLeads, closed: recentClosedLeads },
      },
      leadsOverTime,
      viewsOverTime,
    },
  });
};

// GET /api/analytics/properties/:id — usada por PropertyFormPage.jsx (panel admin) para
// mostrar vistas/contactos/compartidos de ESA propiedad al editarla.
const getPropertyAnalytics = async (req, res) => {
  const property = await Property.findByPk(req.params.id);
  if (!property) throw new ApiError(404, 'Propiedad no encontrada');

  const thirtyDaysAgo = mexicoMidnightUtc(-30);

  const [viewsByDayRaw, eventCounts, directContacts, viaInterestContacts] = await Promise.all([
    // createdAt crudo — el bucketing por día se hace en JS anclado a hora de México (ver
    // mexicoTime.js), no con DATE(createdAt) de MySQL (agrupa en UTC).
    Analytics.findAll({
      where: {
        propertyId: req.params.id,
        event: 'property_view',
        isBot: false,
        createdAt: { [Op.gte]: thirtyDaysAgo },
      },
      attributes: ['createdAt'],
      raw: true,
    }),
    Analytics.findAll({
      where: { propertyId: req.params.id },
      attributes: ['event', [fn('COUNT', col('id')), 'total']],
      group: ['event'],
      raw: true,
    }),
    // Contactos reales — igual que en getTrafficDashboard, no el evento legacy 'contact'
    // (nunca lo escribe código nuevo, ver analyticsService.ALLOWED_EVENTS): propiedad de
    // origen (Lead.propertyId) + propiedades de interés adicionales (lead_properties).
    Lead.count({ where: { propertyId: req.params.id } }),
    LeadProperty.count({ where: { propertyId: req.params.id } }),
  ]);

  const byDate = new Map();
  viewsByDayRaw.forEach(({ createdAt }) => {
    const key = mexicoDateKey(new Date(createdAt));
    byDate.set(key, (byDate.get(key) || 0) + 1);
  });
  const viewsByDay = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, views]) => ({ date, views }));

  const totals = { views: 0, contacts: directContacts + viaInterestContacts, shares: 0 };
  eventCounts.forEach((row) => {
    if (row.event === 'property_view') totals.views = parseInt(row.total, 10);
    if (row.event === 'property_share') totals.shares = parseInt(row.total, 10);
  });

  return res.json({
    data: {
      property: { id: property.id, title: property.title, views: property.views },
      viewsByDay,
      totals,
    },
  });
};

// POST /api/analytics/events — endpoint público y anónimo (sin JWT) de ingesta de eventos
// de tráfico (Fase 1 de analítica). `express.text()` en la ruta deja pasar tanto
// application/json (fallback fetch keepalive) como text/plain (navigator.sendBeacon, que en
// cross-origin no puede usar application/json sin disparar un preflight) — por eso el body
// puede llegar como string u objeto ya parseado, se normaliza aquí.
const createEvent = async (req, res) => {
  let raw = req.body;
  if (typeof raw === 'string') {
    try {
      raw = raw ? JSON.parse(raw) : null;
    } catch {
      throw new ApiError(400, 'JSON inválido');
    }
  }
  const input = sanitizeEventInput(raw);
  await recordEvent({ ...input, userAgent: req.headers['user-agent'] });
  return res.status(204).send();
};

const RANGE_DAYS = { today: 1, '7d': 7, '30d': 30, '3m': 90, '6m': 180, '12m': 365 };

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Resuelve el rango [start, end) del periodo solicitado y el rango equivalente
// inmediatamente anterior (misma duración) para las comparaciones "vs. periodo anterior".
// `end` siempre es el inicio de mañana (00:00 hora México) para que "Hoy" quede completo.
// Todos los límites se calculan anclados a hora de México (ver mexicoTime.js) — nunca con
// la zona horaria del proceso de Node, que en producción no está garantizado que coincida
// con México (ver AUDITORIA Fase 1, hallazgo de timezone).
function resolvePeriod(query) {
  let start, end, days;
  if (query.from && query.to && DATE_ONLY_RE.test(query.from) && DATE_ONLY_RE.test(query.to)) {
    const [fy, fm, fd] = query.from.split('-').map(Number);
    const [ty, tm, td] = query.to.split('-').map(Number);
    start = mexicoMidnightUtcFromParts(fy, fm, fd);
    end = mexicoMidnightUtcFromParts(ty, tm, td + 1);
    // from/to invertidos o iguales: se trata como 1 solo día en vez de una ventana negativa
    // (que produciría "periodo anterior" con signo invertido y confundiría las comparaciones).
    if (end <= start) end = mexicoMidnightUtcFromParts(fy, fm, fd + 1);
    days = Math.max(1, Math.round((end - start) / DAY_MS));
  } else {
    const rangeKey = RANGE_DAYS[query.range] ? query.range : '30d';
    days = RANGE_DAYS[rangeKey];
    end = mexicoMidnightUtc(1);
    start = mexicoMidnightUtc(1 - days);
  }
  const previousEnd = start;
  const previousStart = new Date(start.getTime() - days * DAY_MS);
  return { start, end, previousStart, previousEnd, days };
}

// Variación porcentual vs. el periodo anterior. null cuando no es un cálculo con sentido
// (ambos periodos en cero, o el anterior en cero y el actual no — división por cero).
function percentChange(current, previous) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// Serie diaria 0-rellenada (sin huecos) entre [start, end) para un evento dado — el
// dashboard nunca confía en que MySQL devuelva una fila por cada día con datos. Trae
// createdAt crudo (no DATE(createdAt) de MySQL, que agrupa en UTC) y bucketea en JS anclado
// a hora de México — ver mexicoTime.js.
async function getDailySeries(event, start, end) {
  const rows = await Analytics.findAll({
    where: { event, isBot: false, createdAt: { [Op.gte]: start, [Op.lt]: end } },
    attributes: ['createdAt'],
    raw: true,
  });
  const byDate = new Map();
  rows.forEach(({ createdAt }) => {
    const key = mexicoDateKey(new Date(createdAt));
    byDate.set(key, (byDate.get(key) || 0) + 1);
  });

  const series = [];
  let cursor = start;
  while (cursor < end) {
    const key = mexicoDateKey(cursor);
    series.push({ date: key, label: formatDateKeyLabel(key), count: byDate.get(key) || 0 });
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  return series;
}

// Clasifica una visita en una de las fuentes que el negocio pidió ver explícitamente
// (Google/Instagram/Facebook/WhatsApp/Directo/Otros) a partir de utm_source y, si no hay,
// del host del referrer. No inventa fuentes nuevas fuera de esta lista.
function classifySource({ utmSource, referrerHost }) {
  const src = (utmSource || '').toLowerCase();
  if (src.includes('google')) return 'google';
  if (src.includes('facebook') || src === 'fb') return 'facebook';
  if (src.includes('instagram') || src === 'ig') return 'instagram';
  if (src.includes('whatsapp')) return 'whatsapp';

  const host = (referrerHost || '').toLowerCase();
  if (!host) return 'directo';
  if (host.includes('google.')) return 'google';
  if (host.includes('facebook.') || host === 'fb.com' || host === 'lm.facebook.com') return 'facebook';
  if (host.includes('instagram.')) return 'instagram';
  if (host.includes('whatsapp.') || host === 'wa.me') return 'whatsapp';
  return 'otros';
}

// Cuenta leads asociados a cada propertyId dentro de [start, end): tanto la propiedad de
// origen (Lead.propertyId) como las "propiedades de interés" adicionales (tabla puente
// lead_properties, ver LeadProperty.js/models/index.js). Ambas rutas son mutuamente
// excluyentes por diseño (LeadProperty guarda solo propiedades ADICIONALES a la de origen),
// así que sumarlas no duplica un mismo lead para la misma propiedad.
async function getContactCountsByProperty(propertyIds, start, end) {
  if (propertyIds.length === 0) return new Map();

  const directRows = await Lead.findAll({
    where: { propertyId: { [Op.in]: propertyIds }, createdAt: { [Op.gte]: start, [Op.lt]: end } },
    attributes: ['propertyId', [fn('COUNT', col('id')), 'count']],
    group: ['propertyId'],
    raw: true,
  });

  const junctionRows = await LeadProperty.findAll({
    where: { propertyId: { [Op.in]: propertyIds } },
    attributes: ['propertyId', 'leadId'],
    raw: true,
  });
  const junctionLeadIds = [...new Set(junctionRows.map((r) => r.leadId))];
  const leadsInRange = junctionLeadIds.length
    ? await Lead.findAll({
        where: { id: { [Op.in]: junctionLeadIds }, createdAt: { [Op.gte]: start, [Op.lt]: end } },
        attributes: ['id'],
        raw: true,
      })
    : [];
  const leadsInRangeSet = new Set(leadsInRange.map((l) => l.id));

  const counts = new Map();
  directRows.forEach((r) => counts.set(r.propertyId, parseInt(r.count, 10)));
  junctionRows.forEach((r) => {
    if (!leadsInRangeSet.has(r.leadId)) return;
    counts.set(r.propertyId, (counts.get(r.propertyId) || 0) + 1);
  });
  return counts;
}

// GET /api/analytics/traffic — dashboard de "Tráfico del sitio" (Fase 1). Todas las
// consultas excluyen isBot=true. Se agrega en vivo con GROUP BY (mismo patrón que
// getDashboard arriba) en vez de una tabla de resumen diario: al volumen esperado de Fase 1
// (ver AUDITORIA/análisis de costos y escalabilidad) esto es suficientemente rápido y evita
// mantener dos estructuras de datos en paralelo antes de que el volumen real lo justifique.
const getTrafficDashboard = async (req, res) => {
  const { start, end, previousStart, previousEnd, days } = resolvePeriod(req.query);
  const notBot = { isBot: false };

  const [
    pageViews,
    prevPageViews,
    uniqueVisitors,
    prevUniqueVisitors,
    sessions,
    prevSessions,
    propertyViews,
    prevPropertyViews,
    contacts,
    prevContacts,
    dailySeries,
    prevDailySeries,
    attributionRows,
    topPagesRaw,
    topPropertyViewsRaw,
  ] = await Promise.all([
    Analytics.count({ where: { ...notBot, event: 'page_view', createdAt: { [Op.gte]: start, [Op.lt]: end } } }),
    Analytics.count({
      where: { ...notBot, event: 'page_view', createdAt: { [Op.gte]: previousStart, [Op.lt]: previousEnd } },
    }),
    Analytics.count({
      where: { ...notBot, visitorId: { [Op.ne]: null }, createdAt: { [Op.gte]: start, [Op.lt]: end } },
      distinct: true,
      col: 'visitorId',
    }),
    Analytics.count({
      where: {
        ...notBot,
        visitorId: { [Op.ne]: null },
        createdAt: { [Op.gte]: previousStart, [Op.lt]: previousEnd },
      },
      distinct: true,
      col: 'visitorId',
    }),
    Analytics.count({
      where: { ...notBot, sessionId: { [Op.ne]: null }, createdAt: { [Op.gte]: start, [Op.lt]: end } },
      distinct: true,
      col: 'sessionId',
    }),
    Analytics.count({
      where: {
        ...notBot,
        sessionId: { [Op.ne]: null },
        createdAt: { [Op.gte]: previousStart, [Op.lt]: previousEnd },
      },
      distinct: true,
      col: 'sessionId',
    }),
    Analytics.count({
      where: { ...notBot, event: 'property_view', createdAt: { [Op.gte]: start, [Op.lt]: end } },
    }),
    Analytics.count({
      where: { ...notBot, event: 'property_view', createdAt: { [Op.gte]: previousStart, [Op.lt]: previousEnd } },
    }),
    Lead.count({ where: { createdAt: { [Op.gte]: start, [Op.lt]: end } } }),
    Lead.count({ where: { createdAt: { [Op.gte]: previousStart, [Op.lt]: previousEnd } } }),
    getDailySeries('page_view', start, end),
    getDailySeries('page_view', previousStart, previousEnd),
    // Una fila por sesión (la más antigua) para fuentes/dispositivos — evita contar la misma
    // sesión varias veces si tuvo más de un page_view.
    Analytics.findAll({
      where: { ...notBot, event: 'page_view', sessionId: { [Op.ne]: null }, createdAt: { [Op.gte]: start, [Op.lt]: end } },
      attributes: ['sessionId', 'utmSource', 'referrerHost', 'device', 'createdAt'],
      order: [['createdAt', 'ASC']],
      raw: true,
    }),
    Analytics.findAll({
      where: { ...notBot, event: 'page_view', createdAt: { [Op.gte]: start, [Op.lt]: end } },
      attributes: ['path', [fn('COUNT', col('id')), 'views'], [fn('COUNT', fn('DISTINCT', col('visitorId'))), 'visitors']],
      group: ['path'],
      order: [[literal('views'), 'DESC']],
      limit: 10,
      raw: true,
    }),
    Analytics.findAll({
      where: { ...notBot, event: 'property_view', createdAt: { [Op.gte]: start, [Op.lt]: end } },
      attributes: ['propertyId', [fn('COUNT', col('id')), 'views']],
      group: ['propertyId'],
      order: [[literal('views'), 'DESC']],
      limit: 10,
      raw: true,
    }),
  ]);

  // Fuentes/dispositivos — una sola vez por sesión (primer page_view visto, gracias al
  // ORDER BY createdAt ASC de arriba).
  const seenSessions = new Set();
  const sourceCounts = new Map();
  const deviceCounts = new Map();
  for (const row of attributionRows) {
    if (seenSessions.has(row.sessionId)) continue;
    seenSessions.add(row.sessionId);
    const source = classifySource(row);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    const device = row.device || 'unknown';
    deviceCounts.set(device, (deviceCounts.get(device) || 0) + 1);
  }
  const totalClassifiedSessions = seenSessions.size || 1;
  const sources = ['google', 'instagram', 'facebook', 'whatsapp', 'directo', 'otros'].map((source) => ({
    source,
    total: sourceCounts.get(source) || 0,
  }));
  const devices = ['desktop', 'mobile', 'tablet', 'unknown']
    .map((device) => ({
      device,
      total: deviceCounts.get(device) || 0,
      percent: Math.round(((deviceCounts.get(device) || 0) / totalClassifiedSessions) * 1000) / 10,
    }))
    .filter((d) => d.device !== 'unknown' || d.total > 0);

  const topPages = topPagesRaw.map((r) => ({
    path: r.path,
    views: parseInt(r.views, 10),
    visitors: parseInt(r.visitors, 10),
  }));

  const propertyIds = topPropertyViewsRaw.map((r) => r.propertyId).filter(Boolean);
  const [properties, contactCounts] = await Promise.all([
    propertyIds.length
      ? Property.findAll({ where: { id: { [Op.in]: propertyIds } }, attributes: ['id', 'title', 'city', 'slug'] })
      : [],
    getContactCountsByProperty(propertyIds, start, end),
  ]);
  // OJO: no se filtra por `propertyById.has(...)` — una propiedad borrada DESPUÉS de haber
  // sido vista sigue teniendo filas reales en Analytics; ocultarla del todo subestimaría el
  // tráfico del periodo (y dejaría la tabla con menos de 10 filas sin explicación). Se
  // muestra con el título de reemplazo en vez de desaparecer.
  const propertyById = new Map(properties.map((p) => [p.id, p]));
  const topProperties = topPropertyViewsRaw.map((r) => {
    const property = propertyById.get(r.propertyId);
    const views = parseInt(r.views, 10);
    const propertyContacts = contactCounts.get(r.propertyId) || 0;
    return {
      propertyId: r.propertyId,
      title: property?.title || 'Propiedad eliminada',
      city: property?.city || null,
      slug: property?.slug || null,
      views,
      contacts: propertyContacts,
      conversionRate: views > 0 ? Math.round((propertyContacts / views) * 1000) / 10 : null,
    };
  });

  const conversionRate = propertyViews > 0 ? Math.round((contacts / propertyViews) * 1000) / 10 : null;

  return res.json({
    data: {
      period: { start, end, days },
      totals: {
        pageViews: { value: pageViews, change: percentChange(pageViews, prevPageViews) },
        uniqueVisitors: { value: uniqueVisitors, change: percentChange(uniqueVisitors, prevUniqueVisitors) },
        sessions: { value: sessions, change: percentChange(sessions, prevSessions) },
        propertyViews: { value: propertyViews, change: percentChange(propertyViews, prevPropertyViews) },
        contacts: { value: contacts, change: percentChange(contacts, prevContacts) },
        conversionRate,
      },
      traffic: { current: dailySeries, previous: prevDailySeries },
      sources,
      devices,
      topPages,
      topProperties,
    },
  });
};

module.exports = { getDashboard, getPropertyAnalytics, createEvent, getTrafficDashboard };
