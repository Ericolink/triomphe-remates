const { AuditLog } = require('../models/index');
const { paginate } = require('../utils/pagination');

// GET /api/audit
const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 30, action, resource, userId } = req.query;
    const where = {};
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;

    const result = await paginate(AuditLog, { page, limit, where, order: [['createdAt', 'DESC']] });

    return res.json(result);
  } catch (error) {
    console.error('Error en getAuditLogs:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getAuditLogs };
