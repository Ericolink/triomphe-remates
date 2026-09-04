const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const logger = require('../utils/logger');

// IIS/httpPlatformHandler agrega IP:puerto en X-Forwarded-For — hay que quitar el puerto
// antes de pasarlo a ipKeyGenerator (si no, cada puerto de origen distinto cuenta como un
// cliente distinto, y el IPv6 crudo con puerto tampoco matchea como dirección válida).
// Extraído aquí (antes vivía solo en app.js) para que el limiter de login use exactamente
// la misma normalización que el limiter global, sin duplicar la regex en dos archivos.
const resolveClientIp = (req) => {
  const raw = req.ip || req.socket.remoteAddress || '';
  const bracketedIpv6 = raw.match(/^\[(.+)\]:\d+$/);
  const ipv4WithPort = raw.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d+$/);
  return bracketedIpv6?.[1] || ipv4WithPort?.[1] || raw;
};

// Varias personas (staff distinto) probando desde la misma red de oficina comparten IP/NAT,
// así que un limiter puramente por IP les hace compartir un solo cupo. Cuando la petición
// trae un JWT válido, usamos el id del usuario como key en su lugar — cada quien tiene su
// propio presupuesto independientemente de la red desde la que se conecte. Se exporta por
// separado (sin fallback a IP) para que app.js pueda combinarla con su propia normalización
// de IP (necesita quitar el puerto que IIS agrega en X-Forwarded-For).
const resolveUserKey = (req) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (decoded?.id) return `user:${decoded.id}`;
  } catch {
    // token ausente/inválido — el caller cae a IP, igual que un anónimo
  }
  return null;
};

const resolveUserOrIpKey = (req, res) => resolveUserKey(req) || ipKeyGenerator(req, res);

// Limita intentos de suscripción por email (además del límite por IP) para evitar
// que se use el formulario para enviar correos de confirmación en cadena a una misma dirección
const alertSubscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  message: {
    error: 'Demasiados intentos de suscripción con este email. Intenta de nuevo en 1 hora.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    const email = (req.body?.email || '').trim().toLowerCase();
    return email || ipKeyGenerator(req, res);
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const normalizeEmail = (email) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

// Identificador anonimizado para logs de seguridad: nunca se escribe el email intentado tal
// cual en los logs de archivo (winston, ver utils/logger.js) — a diferencia del AuditLog en
// BD (con control de acceso propio), estos logs solo sirven para correlacionar intentos, no
// para identificar la cuenta.
const hashForLog = (value) => {
  const normalized = normalizeEmail(value);
  if (!normalized) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 12);
};

// Key = IP + email normalizado. Ata el cupo de 5 intentos fallidos/15min a UN origen contra
// UNA cuenta puntual — es la política "5 intentos → bloqueo 15min" que pide el issue,
// aplicada por combinación (no por email solo) para que un atacante no pueda tumbar la cuenta
// de un admin legítimo con solo 5 requests desde una IP cualquiera (ver loginAccountLimiter
// para la protección complementaria contra fuerza bruta distribuida). Cambiar de IP o de
// email hace que este contador puntual arranque de cero — por diseño: el límite amplio por
// IP (authLimiter, 20/15min, ya existente) y el límite amplio por cuenta (loginAccountLimiter,
// abajo) son los que evitan que eso sea una forma de evadir el control por completo.
const buildLoginComboKey = (req) => {
  const email = normalizeEmail(req.body?.email) || 'no-email';
  return `${ipKeyGenerator(resolveClientIp(req))}:${email}`;
};

// Key = solo el email normalizado (sin IP). Red de seguridad contra fuerza bruta distribuida
// (credential stuffing rotando IPs) sobre UNA cuenta específica: el combo de arriba no la
// detecta porque cada IP nueva reinicia su propio contador. El techo (15) es intencionalmente
// más alto que el del combo (5) — si fuera igual de bajo, cualquiera podría bloquear a un
// admin legítimo con un puñado de intentos triviales desde varias IPs; con 15/15min se eleva
// el costo real de un ataque distribuido sin convertir errores de tecleo normales (desde
// varias redes: casa/oficina/celular) en un bloqueo accidental.
const buildLoginAccountKey = (req) => normalizeEmail(req.body?.email) || ipKeyGenerator(resolveClientIp(req));

// Handler común: nunca revela si el email corresponde a una cuenta real (mismo mensaje
// genérico sea cual sea la razón del bloqueo) y registra un evento de seguridad mínimo —
// timestamp (vía winston), endpoint, IP, motivo, y un hash truncado del email (nunca el
// valor real, ni la contraseña). El volumen de este log está naturalmente acotado por el
// propio rate limit: solo se loguea una vez por request bloqueado, y esos ya están limitados
// a unos pocos por ventana de 15 minutos.
const loginRateLimitHandler = (reason) => (req, res) => {
  logger.warn('login_rate_limit_exceeded', {
    event: 'login_rate_limit_exceeded',
    reason,
    ip: resolveClientIp(req),
    emailHash: hashForLog(req.body?.email),
    endpoint: req.originalUrl,
  });
  res.status(429).json({ error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' });
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildLoginComboKey,
  handler: loginRateLimitHandler('ip_email_combo'),
});

const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: buildLoginAccountKey,
  handler: loginRateLimitHandler('account_wide'),
});

// Instancia independiente de authLimiter: protege los formularios públicos de conversión
// (leads, feedback, postulaciones, alertas) sin compartir contador con el login, para que
// intentos de login desde una IP (oficina/NAT) no bloqueen envíos legítimos de estos formularios.
const publicFormLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// AUDIT: 200/15min se agotaba con uso normal del panel admin (origen histórico: el Kanban
// de Prospectos, ya eliminado, hacía ráfagas de queries por columna). Todas estas rutas ya
// están detrás de authenticate/authorize (JWT), así que este límite es una segunda capa, no
// el control de acceso principal — subirlo no abre una puerta nueva.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  // La mayoría de las rutas que usan apiLimiter van detrás de authenticate, así que casi
  // todo su tráfico trae JWT — key por usuario evita que varios miembros del staff en la
  // misma red compartan un solo cupo de 500 (ver resolveUserOrIpKey arriba).
  keyGenerator: resolveUserOrIpKey,
});

// Independiente de authLimiter: change-password ya requiere un JWT válido, así que el
// atacante relevante es alguien con un token robado intentando fuerza bruta sobre
// currentPassword, no un anónimo haciendo credential stuffing. Por eso la key es el
// usuario (verificado vía jwt.verify, sin findByPk — igual de barato que dejar que
// authenticate resuelva el request) y no la IP: así no comparte presupuesto con otros
// usuarios detrás de la misma IP/NAT intentando login, ni al revés. Fallback a IP si el
// token es inválido o falta, mismo patrón que alertSubscribeLimiter con el email.
const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos, igual que authLimiter/publicFormLimiter
  max: 10,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveUserOrIpKey,
});

// uploadLimiter/exportLimiter también van siempre detrás de authenticate — key por usuario
// para que, ej., dos asesores subiendo fotos de propiedades a la vez desde la misma oficina
// no compartan el mismo cupo de 50/hora.
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50,
  message: { error: 'Límite de subidas alcanzado. Intenta de nuevo en 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveUserOrIpKey,
});

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Límite de exportaciones alcanzado. Intenta de nuevo en 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveUserOrIpKey,
});

// POST /api/analytics/events — endpoint anónimo por diseño (nunca lleva JWT), así que su
// única defensa contra abuso es este limiter + la detección de bots por User-Agent (ver
// botDetection.js). Se agrupa por visitorId (el UUID anónimo del cliente) cuando el body ya
// trae uno válido, en vez de por IP: varios visitantes reales detrás de la misma IP/NAT
// (oficina, red móvil compartida) no deben compartir un solo cupo. Cae a IP cuando el body
// todavía no se pudo leer/parsear o no trae un visitorId con forma de UUID.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const resolveVisitorOrIpKey = (req, res) => {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = null;
    }
  }
  const visitorId = body?.visitorId;
  if (typeof visitorId === 'string' && UUID_RE.test(visitorId)) return `visitor:${visitorId}`;
  return ipKeyGenerator(req, res);
};

const analyticsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 120,
  message: { error: 'Demasiados eventos. Intenta de nuevo en unos minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: resolveVisitorOrIpKey,
});

module.exports = {
  authLimiter,
  loginLimiter,
  loginAccountLimiter,
  publicFormLimiter,
  apiLimiter,
  changePasswordLimiter,
  uploadLimiter,
  exportLimiter,
  alertSubscribeLimiter,
  analyticsLimiter,
  resolveUserKey,
  resolveClientIp,
  buildLoginComboKey,
  buildLoginAccountKey,
};
