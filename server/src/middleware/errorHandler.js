// Middleware de error centralizado. ApiError es el mecanismo estándar para errores de
// dominio (validación, permisos, recursos inexistentes, conflictos): los controllers
// hacen `throw new ApiError(statusCode, mensaje)` y Express 5 reenvía automáticamente
// el rechazo hasta este handler, registrado al final de app.js.
const logger = require('../utils/logger');

class ApiError extends Error {
  // `code` es un identificador estable y opcional (ej. 'INVALID_CURRENT_PASSWORD') para
  // que el frontend distinga variantes del mismo statusCode sin parsear `message` (que es
  // texto para humanos y puede cambiar de redacción). Ver client/src/services/api.js.
  constructor(statusCode = 500, message = 'Error interno del servidor', options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code;
  }
}

// AUDITORÍA 500s (2026-09-01): antes de esto, CUALQUIER error que no fuera un ApiError
// explícito caía siempre al mismo 500 genérico "Error interno del servidor" — sin importar
// si en realidad era un dato de entrada inválido (un ENUM que ya no existe tras un deploy
// que renombró valores, un archivo mal subido) o una falla real de infraestructura (MySQL
// caído, pool agotado). Cada módulo iba parcheando casos puntuales por su cuenta (ver
// AUDIT-024 en leadController.js, o el traductor de teléfono duplicado ahí mismo) en vez de
// existir una sola red de seguridad — por eso el mismo patrón de "500 genérico donde debería
// haber un 400/409/503 claro" reaparecía en módulo tras módulo. Este traductor es esa red:
// mapea las clases de error MÁS COMUNES de Sequelize/Multer a una respuesta segura y útil,
// sin tener que enumerar cada campo/endpoint a mano. Devuelve null si no reconoce el error —
// en ese caso se mantiene el 500 genérico de siempre (nunca se expone `err.message` crudo).
const MULTER_ERROR_MESSAGES = {
  LIMIT_FILE_SIZE: 'La imagen excede el tamaño máximo permitido (5MB).',
  LIMIT_FILE_COUNT: 'Se excedió el número máximo de archivos permitido.',
  LIMIT_UNEXPECTED_FILE: 'Se enviaron demasiados archivos o un campo de archivo inesperado.',
};

// Códigos de MySQL (mysql2) que representan un dato de ENTRADA inválido — un ENUM fuera de
// rango, un texto más largo que la columna, un NULL en un campo obligatorio. Son seguros de
// traducir a un 400 genérico porque el problema está en lo que se envió, no en el servidor.
// Cualquier otro SequelizeDatabaseError (columna inexistente, error de sintaxis SQL, etc.)
// SIGUE siendo un 500 opaco a propósito: es un bug real, no algo que el cliente pueda
// corregir reenviando, y su mensaje crudo puede incluir nombres de tabla/columna internos.
const SAFE_DB_INPUT_ERROR_CODES = new Set([
  'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', // valor de ENUM (o fecha/número) inválido
  'ER_DATA_TOO_LONG',
  'ER_BAD_NULL_ERROR',
  'ER_WARN_DATA_OUT_OF_RANGE',
  'WARN_DATA_TRUNCATED',
]);

// Errores de conexión (MySQL caído, pool agotado, DNS, red) — un 503 le dice correctamente
// al cliente/frontend "no es tu culpa, reintenta en un momento", en vez del mismo 500 opaco
// que un bug real de código. Todas estas heredan de SequelizeConnectionError, pero se listan
// explícitas (en vez de usar instanceof contra la clase base) para no depender de requerir
// el paquete `sequelize` completo solo por sus clases de error en este archivo.
const CONNECTION_ERROR_NAMES = new Set([
  'SequelizeConnectionError',
  'SequelizeConnectionRefusedError',
  'SequelizeConnectionTimedOutError',
  'SequelizeHostNotFoundError',
  'SequelizeHostNotReachableError',
  'SequelizeInvalidConnectionError',
]);

function translateKnownError(err) {
  if (err.name === 'MulterError') {
    return {
      statusCode: 400,
      message: MULTER_ERROR_MESSAGES[err.code] || 'Error al procesar el archivo enviado.',
    };
  }
  if (err.name === 'SequelizeValidationError') {
    // A diferencia de SequelizeDatabaseError, estos mensajes SÍ son seguros de mostrar tal
    // cual: los generan los validadores del propio modelo (longitud, formato, etc.), nunca
    // contienen SQL ni detalles internos.
    const detail = err.errors?.map((e) => e.message).join('; ');
    return { statusCode: 400, message: detail || 'Datos inválidos.' };
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return { statusCode: 409, message: 'Ya existe un registro con estos datos.' };
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return {
      statusCode: 400,
      message: 'La operación hace referencia a un registro relacionado inválido o inexistente.',
    };
  }
  if (err.name === 'SequelizeDatabaseError' && SAFE_DB_INPUT_ERROR_CODES.has(err.original?.code)) {
    return { statusCode: 400, message: 'Datos inválidos: revisa los valores enviados.' };
  }
  if (CONNECTION_ERROR_NAMES.has(err.name)) {
    return {
      statusCode: 503,
      message: 'Servicio temporalmente no disponible, intenta de nuevo en unos segundos.',
    };
  }
  return null;
}

// Campos que nunca deben llegar a un log, ni siquiera en un request fallido.
const SENSITIVE_BODY_KEYS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'refreshToken',
]);

function sanitizeBodyForLog(body) {
  if (!body || typeof body !== 'object') return undefined;
  const keys = Object.keys(body);
  if (keys.length === 0) return undefined;
  const sanitized = {};
  for (const key of keys) {
    sanitized[key] = SENSITIVE_BODY_KEYS.has(key) ? '[redacted]' : body[key];
  }
  return sanitized;
}

// Debe registrarse DESPUÉS de todas las rutas en app.js.
const errorHandler = (err, req, res, _next) => {
  const isApiError = err instanceof ApiError;
  const translated = !isApiError ? translateKnownError(err) : null;
  const statusCode = isApiError ? err.statusCode : translated ? translated.statusCode : 500;
  // Un error inesperado y no traducible nunca expone err.message al cliente — puede
  // contener detalles internos (query, columna, stack de una librería). Se loguea
  // completo pero se responde con el mensaje genérico. Un error SÍ traducido usa el
  // mensaje seguro de translateKnownError, nunca el crudo tampoco.
  const message = isApiError ? err.message : translated ? translated.message : 'Error interno del servidor';

  const durationMs = req.startTime
    ? Math.round(Number(process.hrtime.bigint() - req.startTime) / 1e5) / 10
    : undefined;

  logger.error(`${req.method} ${req.originalUrl}`, {
    requestId: req.id,
    statusCode,
    message: err.message,
    // Nombre de la clase de error de Sequelize/Multer (ej. 'SequelizeUniqueConstraintError')
    // y el código nativo de MySQL cuando existe — permite diagnosticar en logs sin adivinar
    // a partir del mensaje genérico que ve el cliente.
    errorClass: err.name,
    sqlCode: err.original?.code,
    cause: err.cause?.message,
    userId: req.user?.id || 'anonymous',
    role: req.user?.role,
    durationMs,
    body: sanitizeBodyForLog(req.body),
    stack: err.stack,
  });

  const body = { error: message };
  // Solo ApiError puede traer `code` (errores 500 genéricos nunca lo exponen). El campo
  // es aditivo — consumidores que ya solo leen `error` no se ven afectados.
  if (isApiError && err.code) body.code = err.code;
  // Permite reportar un problema por su requestId sin depender de la consola del
  // navegador — ver requestContext.js.
  if (req.id) body.requestId = req.id;
  res.status(statusCode).json(body);
};

module.exports = { ApiError, errorHandler, translateKnownError };
