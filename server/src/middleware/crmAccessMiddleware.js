const { hasCrmAccess } = require('../utils/leadAccess');

// Separado a propósito de roleMiddleware.js: authorize() solo entiende listas literales
// de `role` — este middleware es el único punto que gatea acceso al CRM de leads en base
// a si el rol del usuario tiene acceso al CRM (ver hasCrmAccess en utils/leadAccess.js),
// que no siempre coincide 1:1 con una lista fija de roles.
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
