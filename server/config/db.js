const { Sequelize } = require('sequelize');
require('dotenv').config();

// Defensa en profundidad, en espejo con el guardia de config/sequelize-cli.js (ver ese
// archivo para el incidente completo): esta es la conexión que usan server.js, todos los
// modelos, Y Jest (vía jest.setup.js, que fija NODE_ENV=test + DB_NAME=triomphe_test antes
// de que este módulo se cargue). Si alguien corre algo con NODE_ENV=test pero DB_NAME no
// tiene cara de ser una base de test — típicamente porque jest.setup.js no se cargó, o
// porque alguien fijó las variables a mano sin darse cuenta — se aborta en vez de conectar
// en silencio a la base equivocada.
if (process.env.NODE_ENV === 'test' && !/test/i.test(process.env.DB_NAME || '')) {
  throw new Error(
    `[config/db.js] Configuración peligrosa: NODE_ENV=test pero DB_NAME="${process.env.DB_NAME}" ` +
      'no contiene "test". Esto normalmente significa que jest.setup.js no se cargó, o que ' +
      'DB_NAME se fijó a mano sin querer. Se aborta para no conectar a la base equivocada.'
  );
}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    // AUDITORÍA 500s (2026-09-01) — REVERTIDO tras revisión previa al deploy: se había
    // agregado aquí un `retry` para errores de conexión transitorios (ETIMEDOUT, ECONNRESET,
    // etc.), pero Sequelize aplica `retry` alrededor de CADA `sequelize.query()` individual —
    // incluida una consulta de ESCRITURA ya en vuelo — y `retry-as-promised` (la librería que
    // lo implementa) solo recibe el `Error`, nunca la query ni su tipo, así que no hay forma
    // de acotar el retry a "solo lecturas" desde aquí sin envolver cada llamada a mano (el
    // refactor masivo que se quiere evitar). Si la conexión se cae DESPUÉS de que MySQL ya
    // comprometió un INSERT pero ANTES de que el cliente reciba el ack (ventana angosta pero
    // real para ECONNRESET/EPIPE/ETIMEDOUT), un retry automático reenvía el mismo INSERT.
    // `Lead.create()` permite `phone` nulo en captura manual de staff — sin ningún índice
    // único que lo respalde — así que ese reintento podía crear un prospecto duplicado real,
    // no solo un error confuso. `Property`/`Lead` con teléfono sí tienen un índice único de
    // respaldo, pero ahí el resultado tampoco era mejor: un 409 "ya existe" sobre una
    // operación que en realidad SÍ se había completado. Un error de conexión transitorio
    // ahora se traduce a un 503 claro en errorHandler.js (ver CONNECTION_ERROR_NAMES) — el
    // admin ve "intenta de nuevo" y decide él mismo si reintentar, sin el riesgo de que el
    // propio framework duplique una escritura por su cuenta.
  }
);

module.exports = sequelize;
