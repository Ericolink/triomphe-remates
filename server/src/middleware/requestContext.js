const crypto = require('crypto');

// Cada request recibe un id corto y una marca de tiempo de alta resolución, montado como
// primer middleware en app.js para que cubra absolutamente todo (incluyendo respuestas de
// CORS/rate-limit que nunca llegan a un controller). El id se expone también en el header
// `X-Request-Id` de la respuesta — permite correlacionar "un admin reporta que algo falló"
// con la entrada exacta en logs/error.log sin depender de la consola del navegador (ver
// errorHandler.js, que lo agrega también al body de cualquier error).
const requestContext = (req, res, next) => {
  req.id = crypto.randomBytes(4).toString('hex');
  req.startTime = process.hrtime.bigint();
  res.setHeader('X-Request-Id', req.id);
  next();
};

module.exports = requestContext;
