const { hasCrmAccess } = require('../utils/leadAccess');

// Separado a propósito de roleMiddleware.js: authorize() solo entiende `role`
// (admin/editor) y no debe empezar a entender `crmRole` — este middleware es el único
// punto que gatea acceso al CRM de leads en base al rol de CRM del usuario.
const requireCrmAccess = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  if (!hasCrmAccess(req.user)) {
    return res.status(403).json({ error: 'No tienes permisos para acceder al CRM de prospectos' });
  }

  next();
};

module.exports = { requireCrmAccess };
