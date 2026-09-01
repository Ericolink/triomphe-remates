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
  }
);

module.exports = sequelize;
