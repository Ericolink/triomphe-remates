const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Limita intentos de suscripción por email (además del límite por IP) para evitar
// que se use el formulario para enviar correos de confirmación en cadena a una misma dirección
const alertSubscribeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3,
  message: { error: 'Demasiados intentos de suscripción con este email. Intenta de nuevo en 1 hora.' },
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
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 50,
  message: { error: 'Límite de subidas alcanzado. Intenta de nuevo en 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: 'Límite de exportaciones alcanzado. Intenta de nuevo en 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  authLimiter,
  publicFormLimiter,
  apiLimiter,
  uploadLimiter,
  exportLimiter,
  alertSubscribeLimiter,
};
