const jwt = require('jsonwebtoken');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

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

// AUDIT: 200/15min se agotaba con uso normal del panel admin — el Kanban de 8 columnas
// hace 2 queries por columna solo al montar (leads-column + open-tasks-column), y cada
// cambio de etapa/responsable las vuelve a pedir todas. Todas estas rutas ya están detrás
// de authenticate/authorize (JWT), así que este límite es una segunda capa, no el control
// de acceso principal — subirlo no abre una puerta nueva.
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

module.exports = {
  authLimiter,
  publicFormLimiter,
  apiLimiter,
  changePasswordLimiter,
  uploadLimiter,
  exportLimiter,
  alertSubscribeLimiter,
  resolveUserKey,
};
