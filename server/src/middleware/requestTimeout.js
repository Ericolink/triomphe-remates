// Timeout de request acotado a rutas puntuales (ej. /auth/login) — distinto de:
//   - el cooldown de rateLimitMiddleware.js (cuántos intentos se permiten en una ventana),
//   - la expiración del JWT (JWT_EXPIRES_IN, cuánto dura una sesión ya emitida).
// Esto solo responde al cliente si el propio procesamiento del request (típicamente una
// consulta a MySQL colgada) se extiende más de lo razonable, en vez de dejarlo esperando
// indefinidamente. No cancela el trabajo en curso en el servidor (Sequelize no expone una
// forma de abortar una query ya enviada) — solo evita que la conexión HTTP quede abierta
// para siempre; el pool de conexiones (config/db.js, acquire: 30000ms) y errorHandler.js
// (SequelizeConnectionAcquireTimeoutError → 503) siguen siendo la defensa real contra un
// MySQL caído.
const requestTimeout = (ms) => (req, res, next) => {
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(503).json({ error: 'La solicitud tardó demasiado, intenta de nuevo.' });
    }
  }, ms);
  // unref: nunca debe mantener vivo el proceso solo por este timer (relevante en tests,
  // donde jest podría quedarse esperando un handle abierto).
  timer.unref?.();
  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  next();
};

module.exports = { requestTimeout };
