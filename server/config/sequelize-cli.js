require('dotenv').config();

// AUDIT-010: config separada para sequelize-cli (usa el formato config.json clásico de
// Sequelize, distinto del objeto Sequelize() que usa config/db.js para la app en runtime).
// Misma fuente de variables de entorno que config/db.js — no duplica valores, solo el shape.
const base = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: 'mysql',
};

module.exports = {
  development: base,
  test: base,
  production: base,
};
