// Middleware de error centralizado. ApiError es el mecanismo estándar para errores de
// dominio (validación, permisos, recursos inexistentes, conflictos): los controllers
// hacen `throw new ApiError(statusCode, mensaje)` y Express 5 reenvía automáticamente
// el rechazo hasta este handler, registrado al final de app.js.
const logger = require('../utils/logger');

class ApiError extends Error {
  constructor(statusCode = 500, message = 'Error interno del servidor', options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.statusCode = statusCode;
  }
}

// Debe registrarse DESPUÉS de todas las rutas en app.js.
const errorHandler = (err, req, res, _next) => {
  const isApiError = err instanceof ApiError;
  const statusCode = isApiError ? err.statusCode : 500;
  // Un error inesperado (no ApiError) nunca expone err.message al cliente — puede
  // contener detalles internos (query, columna, stack de una librería). Se loguea
  // completo pero se responde con el mensaje genérico, igual que hacían antes todos
  // los catch-all manuales de los controllers.
  const message = isApiError ? err.message : 'Error interno del servidor';
  logger.error(`${req.method} ${req.originalUrl}`, {
    statusCode,
    message: err.message,
    cause: err.cause?.message,
    userId: req.user?.id || 'anonymous',
    stack: err.stack,
  });
  res.status(statusCode).json({ error: message });
};

module.exports = { ApiError, errorHandler };
