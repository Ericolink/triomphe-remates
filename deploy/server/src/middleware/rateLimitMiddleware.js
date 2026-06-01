const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  message: { error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
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

module.exports = { authLimiter, apiLimiter, uploadLimiter, exportLimiter };
