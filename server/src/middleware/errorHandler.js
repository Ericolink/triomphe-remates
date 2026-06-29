// AUDIT-014: middleware de error centralizado. Los controllers existentes ya manejan sus
// propios try/catch de forma consistente (siempre devuelven {error: '...'} con el status
// correcto) — esto no los reemplaza automáticamente, sino que da un punto único para
// controllers NUEVOS que prefieran usar `next(error)` en vez de duplicar el bloque
// try/catch → console.error → res.status(500).json(...).
const logger = require('../utils/logger');

class ApiError extends Error {
  constructor(statusCode = 500, message = 'Error interno del servidor') {
    super(message);
    this.statusCode = statusCode;
  }
}

// Debe registrarse DESPUÉS de todas las rutas en app.js.
const errorHandler = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  logger.error(`${req.method} ${req.originalUrl}`, {
    statusCode,
    message: err.message,
    userId: req.user?.id || 'anonymous',
    stack: err.stack,
  });
  res.status(statusCode).json({ error: err.message || 'Error interno del servidor' });
};

module.exports = { ApiError, errorHandler };
