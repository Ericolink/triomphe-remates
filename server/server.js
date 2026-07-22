require('dotenv').config();

// AUDIT-020: validar ANTES de cargar app/models — si falta JWT_SECRET o las variables de
// BD, abortar aquí con un mensaje claro en vez de fallar después con errores genéricos.
const { validateEnvironment } = require('./src/config/validateEnv');
try {
  validateEnvironment();
} catch (error) {
  console.error('❌', error.message);
  process.exit(1);
}

const app = require('./app');
const { sequelize } = require('./src/models/index');
const { verifyConnection } = require('./src/services/emailService');
const { checkPendingMigrations } = require('./src/config/checkPendingMigrations');

const PORT = process.env.HTTP_PLATFORM_PORT || process.env.PORT || 3001;
console.log(`[startup] HTTP_PLATFORM_PORT=${process.env.HTTP_PLATFORM_PORT} PORT=${process.env.PORT} → usando ${PORT}`);

async function startServer() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexión a MySQL establecida');

    // sync() solo bootstrapea tablas que no existan (a partir de los modelos actuales) —
    // nunca altera tablas existentes (alter:false). Toda evolución de esquema posterior
    // vive exclusivamente en server/migrations/ (sequelize-cli); checkPendingMigrations
    // aborta el arranque si esta base de datos no está al día con esa carpeta.
    await sequelize.sync({ alter: false });
    console.log('✅ Modelos sincronizados con la base de datos');

    await checkPendingMigrations(sequelize);

    await verifyConnection();

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📚 Swagger docs: http://localhost:${PORT}/api/docs`);
    });
  } catch (error) {
    require('./src/utils/logger').error('Error al iniciar el servidor', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}
  
startServer();
