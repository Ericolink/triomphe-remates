const app = require('./app');
const { sequelize } = require('./src/models/index');
const { verifyConnection } = require('./src/services/emailService');
require('dotenv').config();

const PORT = process.env.PORT || 3001;

async function runMigrations() {
  const qi = sequelize.getQueryInterface();

  // v1.8 — acquisitionStage en properties
  const propertiesCols = await qi.describeTable('properties').catch(() => null);
  if (propertiesCols && !propertiesCols.acquisitionStage) {
    await sequelize.query(
      `ALTER TABLE properties ADD COLUMN acquisitionStage ENUM('sin_proceso','documentacion','avaluo','negociacion','firma','entrega') NOT NULL DEFAULT 'sin_proceso'`
    );
    console.log('✅ Migración: columna acquisitionStage agregada a properties');
  }
}

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a MySQL establecida');

    await sequelize.sync({ alter: false });
    console.log('✅ Modelos sincronizados con la base de datos');

    await runMigrations();

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
