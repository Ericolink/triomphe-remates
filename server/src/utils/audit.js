const { AuditLog } = require('../models/index');

const logAudit = (req, action, resource, resourceId = null, detail = null) => {
  AuditLog.create({
    userId: req.user?.id ?? null,
    userEmail: req.user?.email ?? null,
    userName: req.user?.name ?? null,
    action,
    resource,
    resourceId,
    detail: detail ? JSON.stringify(detail) : null,
    ip: req.ip ?? null,
  }).catch((e) => console.error('Error en logAudit:', e));
};

module.exports = { logAudit };
