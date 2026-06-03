const app = require('./app');
const { sequelize } = require('./src/models/index');
const { verifyConnection } = require('./src/services/emailService');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a MySQL establecida');

    await sequelize.sync({ alter: false });
    console.log('✅ Modelos sincronizados con la base de datos');

    await verifyConnection();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📚 Swagger docs: http://localhost:${PORT}/api/docs`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
}
  
startServer();
