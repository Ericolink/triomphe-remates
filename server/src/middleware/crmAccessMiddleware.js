const { User } = require('../models/index');
const { hasCrmAccess } = require('../utils/leadAccess');

// Precalcula `user.supervisedUserIds` (ids de los asesor_ventas que supervisa este
// coordinador, ver User.supervisorId) y lo cuelga del objeto — leadAccess.js es síncrono a
// propósito y depende de que este dato ya venga listo en vez de hacer su propia query cada
// vez que necesita saber "el equipo de este coordinador". No-op para cualquier otro rol.
const attachSupervisedTeam = async (user) => {
  if (!user || user.role !== 'coordinador_ventas') return;
  const supervised = await User.findAll({
    where: { supervisorId: user.id, isActive: true },
    attributes: ['id'],
  });
  user.supervisedUserIds = supervised.map((u) => u.id);
};

// Separado a propósito de roleMiddleware.js: authorize() solo entiende listas literales
// de `role` — este middleware es el único punto que gatea acceso al CRM de leads en base
// a si el rol del usuario tiene acceso al CRM (ver hasCrmAccess en utils/leadAccess.js),
// que no siempre coincide 1:1 con una lista fija de roles.
const requireCrmAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  if (!hasCrmAccess(req.user)) {
    return res.status(403).json({ error: 'No tienes permisos para acceder al CRM de prospectos' });
  }

  await attachSupervisedTeam(req.user);
  next();
};

// Variante para rutas que no requieren CRM access de por sí (ej. POST /api/leads, que
// también recibe el formulario público sin sesión vía attachUserIfPresent) pero sí
// necesitan `supervisedUserIds` listo si el actor autenticado resulta ser un coordinador —
// nunca bloquea la request, solo enriquece req.user cuando aplica.
const attachSupervisedTeamIfPresent = async (req, res, next) => {
  await attachSupervisedTeam(req.user);
  next();
};

module.exports = { requireCrmAccess, attachSupervisedTeamIfPresent };
