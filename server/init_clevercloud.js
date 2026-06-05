process.env.DB_HOST = 'b070t3c0zull0q0jcuot-mysql.services.clever-cloud.com';
process.env.DB_USER = 'uz4e7idr9wzfdoxn';
process.env.DB_PASSWORD = 'dauAWOCJ6mosQeRS6v6u';
process.env.DB_NAME = 'b070t3c0zull0q0jcuot';
process.env.DB_PORT = '3306';
process.env.JWT_SECRET = 'triomphe_jwt_super_secreto_2024';
process.env.NODE_ENV = 'production';

const { sequelize } = require('./src/models/index');

async function init() {
  try {
    await sequelize.authenticate();
    console.log('Conectado');
    await sequelize.sync({ force: false });
    console.log('Tablas creadas');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
}
init();
