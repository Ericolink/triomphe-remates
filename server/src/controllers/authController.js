const { User } = require('../models/index');
const { generateToken, hashPassword, comparePassword } = require('../utils/helpers');
const { validateRegister, validateLogin } = require('../utils/validators');
const { logAudit } = require('../utils/audit');
const userService = require('../services/userService');
const { ApiError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { isOriginAllowed } = require('../utils/corsOrigins');

// User-Agents típicos de herramientas de prueba manual de API, no del panel admin
// (`client/src`). Solo se usa para el log de uso de `register` (ver más abajo) — es
// una heurística de mejor esfuerzo, nunca bloquea ni altera la respuesta.
const MANUAL_CLIENT_UA_PATTERNS = [/postmanruntime/i, /insomnia/i, /thunder client/i, /^curl\//i, /httpie/i];
const isLikelyManualClient = (userAgent) =>
  !!userAgent && MANUAL_CLIENT_UA_PATTERNS.some((pattern) => pattern.test(userAgent));

// Instrumentación temporal de `POST /api/auth/register` (ver AUDITORIA_CREACION_USUARIOS.md,
// §Recomendación): ese endpoint quedó duplicado por `POST /api/users` y no tiene consumidor
// verificable en el repo, pero antes de eliminarlo se decidió medir uso real en producción
// durante algunas semanas. Solo observa la request/response ya resueltas — no participa del
// control de flujo del endpoint ni puede alterar su comportamiento o contrato HTTP.
const logRegisterUsage = (req, res, startedAt) => {
  const durationMs = Date.now() - startedAt;
  const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
  const origin = req.headers.origin || null;
  const userAgent = req.headers['user-agent'] || null;

  logger.info('legacy_register_endpoint_used', {
    event: 'legacy_register_endpoint_used',
    endpoint: 'POST /api/auth/register',
    actorId: req.user?.id ?? null,
    actorName: req.user?.name ?? null,
    actorRole: req.user?.role ?? null,
    ip: req.ip,
    userAgent,
    targetEmail: req.body?.email || null,
    result: isSuccess ? 'success' : 'error',
    statusCode: res.statusCode,
    durationMs,
    origin,
    referer: req.headers.referer || req.headers.referrer || null,
    host: req.headers.host || null,
    fromAdminPanel: isOriginAllowed(origin),
    likelyManualClient: isLikelyManualClient(userAgent),
  });
};

// POST /api/auth/register
const register = async (req, res) => {
  const startedAt = Date.now();
  res.on('finish', () => logRegisterUsage(req, res, startedAt));

  const errors = validateRegister(req.body);
  if (errors.length > 0) return res.status(400).json({ errors });

  const { name, email, password, role } = req.body;

  let user;
  try {
    // El `audit` callback se agrega aquí —mismo patrón que usersController.createUser—
    // pero únicamente como parte de la instrumentación de uso de arriba, para poder
    // consultar después quién usó este endpoint legacy (ver AUDITORIA_CREACION_USUARIOS.md);
    // no reemplaza la recomendación de esa auditoría de consolidar ambos endpoints en un
    // servicio único.
    user = await userService.createUser(
      { name, email, password, role },
      {
        audit: (created) =>
          logAudit(req, 'create', 'user', created.id, {
            event: 'REGISTER_ENDPOINT_USED',
            email: created.email,
            role: created.role,
          }),
      }
    );
  } catch (err) {
    if (err.code === 'DUPLICATE_EMAIL') {
      throw new ApiError(409, err.message);
    }
    throw err;
  }

  const token = generateToken({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });

  return res.status(201).json({
    message: 'Usuario creado exitosamente',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

// POST /api/auth/login
const login = async (req, res) => {
  const errors = validateLogin(req.body);
  if (errors.length > 0) return res.status(400).json({ errors });

  const { email, password } = req.body;

  const user = await User.findOne({ where: { email } });
  if (!user || !user.isActive) {
    // No hay `req.user` en un login fallido (nunca se autenticó) — se registra igual
    // pasando { ip: req.ip } directo, mismo patrón que el login exitoso de abajo. Solo se
    // guarda el email intentado, nunca la contraseña.
    logAudit({ ip: req.ip }, 'login', 'user', null, {
      emailAttempted: email,
      reason: user ? 'inactive' : 'user_not_found',
    }, 'failed');
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    logAudit({ ip: req.ip }, 'login', 'user', user.id, { emailAttempted: email, reason: 'invalid_password' }, 'failed');
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  await user.update({ lastLogin: new Date() });
  logAudit({ user, ip: req.ip }, 'login', 'user', user.id, { email: user.email });

  const token = generateToken({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });

  return res.json({
    message: 'Login exitoso',
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
};

// GET /api/auth/me
const getMe = async (req, res) => {
  return res.json({ user: req.user });
};

// PUT /api/auth/change-password
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) {
    throw new ApiError(400, 'La nueva contraseña debe tener al menos 8 caracteres');
  }

  const user = await User.findByPk(req.user.id);
  const isMatch = await comparePassword(currentPassword, user.password);

  if (!isMatch) {
    // authMiddleware ya validó el token antes de llegar aquí — este 401 es un rechazo de
    // negocio (contraseña actual incorrecta), no una sesión inválida. El `code` distingue
    // ambos casos de forma estable para el interceptor global de axios (client/src/services/
    // api.js), que de otro modo trataría cualquier 401 como "sesión expirada" y cerraría
    // sesión al usuario en medio del formulario.
    logAudit(req, 'update', 'user', user.id, { event: 'change_password_failed' }, 'failed');
    throw new ApiError(401, 'Contraseña actual incorrecta', { code: 'INVALID_CURRENT_PASSWORD' });
  }

  const hashedPassword = await hashPassword(newPassword);
  await user.update({ password: hashedPassword, tokenVersion: user.tokenVersion + 1 });
  logAudit(req, 'update', 'user', user.id, { event: 'change_password' });

  // El token actual quedó invalidado por el cambio de tokenVersion — se reemite uno
  // nuevo en la respuesta para que el usuario no se quede sin sesión tras el cambio.
  const token = generateToken({ id: user.id, role: user.role, tokenVersion: user.tokenVersion });

  return res.json({ message: 'Contraseña actualizada exitosamente', token });
};

module.exports = { register, login, getMe, changePassword };
