const { Op } = require('sequelize');
const { sequelize, AuditLog } = require('../models/index');
const { paginate } = require('../utils/pagination');
const logger = require('../utils/logger');
const {
  classifyAuditEvent,
  resourcesForArea,
  searchableLabelMatches,
  criticalWhereClause,
} = require('../constants/auditTaxonomy');

const DATE_RANGE_DAYS = { hoy: 0, '7d': 7, '30d': 30 };

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Mismo patrón defensivo que propertyController.js: MATCH/AGAINST requiere el índice
// FULLTEXT idx_audit_logs_fulltext (migración 20260904000001 / models/AuditLog.js) — si
// llegara a faltar en una base de datos (ver el incidente ya documentado para
// properties), esto no debe tumbar la búsqueda completa, solo perder el camino rápido.
function buildFulltextBooleanQuery(search) {
  const tokens = search
    .split(/\s+/)
    .map((t) => t.replace(/[+\-><()~*"@]/g, ''))
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `+${t}*`).join(' ');
}

function parseDetail(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function presentLog(log) {
  const plain = log.get ? log.get({ plain: true }) : log;
  const detail = parseDetail(plain.detail);
  const classification = classifyAuditEvent({
    action: plain.action,
    resource: plain.resource,
    resourceId: plain.resourceId,
    detail,
    result: plain.result,
  });
  return { ...plain, detail, ...classification };
}

// Traduce los filtros de "Área" y "Resultado" del panel a un WHERE de Sequelize.
// Seguridad es un caso especial: no corresponde a ningún `resource` propio, es
// `action:'login', result:'failed'` — mismo evento que Autenticación, otra lectura.
function applyAreaFilter(where, andConditions, area) {
  if (!area) return;
  if (area === 'Seguridad') {
    andConditions.push({ action: 'login', result: 'failed' });
    return;
  }
  const resources = resourcesForArea(area);
  if (area === 'Autenticación') {
    andConditions.push({
      [Op.or]: [{ action: 'login', result: 'success' }, ...(resources.length ? [{ resource: { [Op.in]: resources } }] : [])],
    });
    return;
  }
  where.resource = { [Op.in]: resources.length ? resources : ['__none__'] };
}

function applyDateRangeFilter(where, range, from, to) {
  if (range && DATE_RANGE_DAYS[range] !== undefined) {
    const days = DATE_RANGE_DAYS[range];
    const start = startOfDay(new Date());
    start.setDate(start.getDate() - days);
    where.createdAt = { [Op.gte]: start };
    return;
  }
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt[Op.gte] = new Date(from);
    if (to) where.createdAt[Op.lte] = new Date(`${to}T23:59:59.999`);
  }
}

async function buildSearchCondition(search) {
  const andConditions = [];
  const orConditions = [];

  if (/^\d+$/.test(search.trim())) {
    orConditions.push({ resourceId: parseInt(search.trim(), 10) });
  }

  const labelMatches = searchableLabelMatches(search);
  for (const match of labelMatches) {
    orConditions.push({ action: match.action, resource: match.resource });
  }

  const booleanQuery = buildFulltextBooleanQuery(search);
  if (booleanQuery) {
    try {
      const matches = await sequelize.query(
        'SELECT id FROM audit_logs WHERE MATCH(userName, userEmail, detail) AGAINST(:query IN BOOLEAN MODE)',
        { replacements: { query: booleanQuery }, type: sequelize.QueryTypes.SELECT }
      );
      if (matches.length > 0) orConditions.push({ id: { [Op.in]: matches.map((m) => m.id) } });
    } catch (error) {
      logger.error('Búsqueda FULLTEXT de audit_logs falló, usando fallback LIKE', {
        message: error.message,
        search,
      });
      orConditions.push(
        { userName: { [Op.like]: `%${search}%` } },
        { userEmail: { [Op.like]: `%${search}%` } },
        { detail: { [Op.like]: `%${search}%` } }
      );
    }
  } else {
    orConditions.push(
      { userName: { [Op.like]: `%${search}%` } },
      { userEmail: { [Op.like]: `%${search}%` } }
    );
  }

  if (orConditions.length > 0) andConditions.push({ [Op.or]: orConditions });
  return andConditions;
}

// Construye el WHERE compartido por getAuditLogs y getAuditSummary a partir de los
// mismos filtros — el resumen respeta lo que el usuario está viendo, no solo el total
// global, siguiendo el mismo criterio "no inventar métricas" de la sección 8 del pedido.
async function buildWhere(query) {
  const { action, resource, userId, area, result, range, from, to, q, critical } = query;
  const where = {};
  const andConditions = [];

  if (action) where.action = action;
  if (resource) where.resource = resource;
  if (userId) where.userId = userId;
  if (result) where.result = result;
  // Mismo criterio de "crítico" que classifyAuditEvent (server/src/constants/auditTaxonomy.js)
  // — permite que el KPI "Acciones críticas" del panel sea clickeable y filtre en SQL, no
  // solo se muestre como número suelto.
  if (critical === 'true') andConditions.push(criticalWhereClause(Op));

  applyAreaFilter(where, andConditions, area);
  applyDateRangeFilter(where, range, from, to);

  if (q && q.trim()) {
    andConditions.push(...(await buildSearchCondition(q.trim())));
  }

  if (andConditions.length > 0) where[Op.and] = andConditions;
  return where;
}

// GET /api/audit
const getAuditLogs = async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const where = await buildWhere(req.query);

  const result = await paginate(AuditLog, { page, limit, where, order: [['createdAt', 'DESC']] });

  return res.json({ ...result, data: result.data.map(presentLog) });
};

// GET /api/audit/summary
const getAuditSummary = async (req, res) => {
  const where = await buildWhere(req.query);
  const todayWhere = { ...where, createdAt: { ...(where.createdAt || {}), [Op.gte]: startOfDay(new Date()) } };

  const [total, today, todaysRows] = await Promise.all([
    AuditLog.count({ where }),
    AuditLog.count({ where: todayWhere }),
    AuditLog.findAll({
      where: todayWhere,
      attributes: ['userId', 'userName', 'action', 'resource', 'resourceId', 'detail', 'result'],
    }),
  ]);

  // El número solo no dice QUIÉN ni QUÉ — se devuelve también el detalle que lo respalda,
  // para que el panel pueda mostrarlo (lista de usuarios) o filtrar por él (crítico) en vez
  // de dejar el KPI como un dato suelto sin forma de indagar más.
  const activeUsersMap = new Map();
  for (const row of todaysRows) {
    if (row.userId != null && !activeUsersMap.has(row.userId)) {
      activeUsersMap.set(row.userId, { id: row.userId, name: row.userName || `Usuario #${row.userId}` });
    }
  }
  const activeUsersTodayList = [...activeUsersMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  const criticalToday = todaysRows.filter((row) => presentLog(row).critical).length;

  return res.json({
    data: {
      total,
      today,
      activeUsersToday: activeUsersTodayList.length,
      activeUsersTodayList,
      criticalToday,
    },
  });
};

module.exports = { getAuditLogs, getAuditSummary };
