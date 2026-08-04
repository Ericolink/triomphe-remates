const { User } = require('../models/index');
const { hashPassword } = require('../utils/helpers');

// Única fuente de verdad para los roles de CRM válidos en creación de usuarios
// (antes duplicado en usersController.createUser y usersController.updateUser).
const VALID_CRM_ROLES = ['coordinador_ventas', 'capturista', 'asesor_ventas'];

const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  crmRole: user.crmRole,
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
 * Lanza un Error con `.code` ('INVALID_CRM_ROLE' | 'DUPLICATE_EMAIL') en vez de
 * responder HTTP directamente; el caller lo traduce al status code que ya usaba.
 * El orden de estas dos validaciones (crmRole antes que duplicado de email) se
 * preserva tal cual estaba en usersController.createUser para no alterar qué
 * error gana cuando ambas condiciones aplican a la vez.
 */
const createUser = async ({ name, email, password, role, crmRole }, { audit } = {}) => {
  if (crmRole && !VALID_CRM_ROLES.includes(crmRole)) {
    const err = new Error(`Rol de CRM inválido. Valores permitidos: ${VALID_CRM_ROLES.join(', ')}`);
    err.code = 'INVALID_CRM_ROLE';
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
    role: role || 'editor',
    // Sin default: un editor nuevo no obtiene acceso al CRM de leads automáticamente,
    // solo si un admin lo asigna explícitamente aquí (ver migración de backfill, que
    // solo migró a los editores YA existentes al momento del deploy).
    crmRole: crmRole || null,
  });

  if (typeof audit === 'function') audit(user);

  return user;
};

module.exports = { createUser, safeUser, VALID_CRM_ROLES };
