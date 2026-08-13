const { User } = require('../models/index');
const { hashPassword } = require('../utils/helpers');

// Única fuente de verdad para los roles válidos del sistema (antes duplicado en
// usersController.createUser y usersController.updateUser). Ver el comentario en
// server/src/models/User.js para el detalle de qué puede hacer cada uno.
const VALID_ROLES = ['admin', 'coordinador_ventas', 'asesor_ventas', 'asistente_administrativo'];

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  profilePhoto: user.profilePhoto,
  lastLogin: user.lastLogin,
  createdAt: user.createdAt,
});

/**
 * Única fuente de verdad para la creación de usuarios — usada por
 * POST /api/auth/register y POST /api/users. No conoce Express (sin req/res)
 * ni genera JWT: el caller es responsable de la respuesta HTTP y del token.
 *
 * `audit`, si se pasa, se invoca con el usuario creado para que el caller decida
 * cómo registrar la auditoría (logAudit necesita el req real de Express, que este
 * servicio no debe conocer). Si se omite, no se audita — así se preserva el
 * comportamiento actual de /api/auth/register, que nunca auditó sus altas.
 *
 * Lanza un Error con `.code` ('INVALID_ROLE' | 'DUPLICATE_EMAIL') en vez de
 * responder HTTP directamente; el caller lo traduce al status code que ya usaba.
 */
const createUser = async ({ name, email, password, role }, { audit } = {}) => {
  if (role && !VALID_ROLES.includes(role)) {
    const err = new Error(`Rol inválido. Valores permitidos: ${VALID_ROLES.join(', ')}`);
    err.code = 'INVALID_ROLE';
    throw err;
  }

  const existing = await User.findOne({ where: { email } });
  if (existing) {
    const err = new Error('El email ya está registrado');
    err.code = 'DUPLICATE_EMAIL';
    throw err;
  }

  const hashedPassword = await hashPassword(password);
  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    role: role || 'asistente_administrativo',
  });

  if (typeof audit === 'function') audit(user);

  return user;
};

module.exports = { createUser, safeUser, VALID_ROLES };
