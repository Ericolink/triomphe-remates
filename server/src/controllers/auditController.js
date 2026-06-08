const { AuditLog } = require('../models/index');

// GET /api/audit
const getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 30, action, resource, userId } = req.query;
    const where = {};
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return res.json({
      data: rows,
      pagination: { total: count, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(count / parseInt(limit)) },
    });
  } catch (error) {
    console.error('Error en getAuditLogs:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getAuditLogs };
