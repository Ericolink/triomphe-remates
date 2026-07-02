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

const PORT = process.env.HTTP_PLATFORM_PORT || process.env.PORT || 3001;
console.log(`[startup] HTTP_PLATFORM_PORT=${process.env.HTTP_PLATFORM_PORT} PORT=${process.env.PORT} → usando ${PORT}`);

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

  // v1.9 — source en leads
  const leadsCols = await qi.describeTable('leads').catch(() => null);
  if (leadsCols && !leadsCols.source) {
    await sequelize.query(
      `ALTER TABLE leads ADD COLUMN source ENUM('google','facebook','whatsapp','directo','referido','otro') NOT NULL DEFAULT 'directo'`
    );
    console.log('✅ Migración: columna source agregada a leads');
  }

  // v1.9 — changeType y fromPrice/toPrice en property_status_history
  const historyCols = await qi.describeTable('property_status_history').catch(() => null);
  if (historyCols && !historyCols.changeType) {
    await sequelize.query(
      `ALTER TABLE property_status_history ADD COLUMN changeType ENUM('status','price') NOT NULL DEFAULT 'status'`
    );
    await sequelize.query(
      `ALTER TABLE property_status_history ADD COLUMN fromPrice DECIMAL(15,2) NULL`
    );
    await sequelize.query(
      `ALTER TABLE property_status_history ADD COLUMN toPrice DECIMAL(15,2) NULL`
    );
    console.log('✅ Migración: columnas changeType/fromPrice/toPrice agregadas a property_status_history');
  }

  // v1.9 — code en properties
  if (propertiesCols && !propertiesCols.code) {
    await sequelize.query(`ALTER TABLE properties ADD COLUMN code VARCHAR(50) NULL`);
    console.log('✅ Migración: columna code agregada a properties');
  }

  // v1.9 — tabla property_documents
  const tables = await qi.showAllTables().catch(() => []);
  if (!tables.includes('property_documents')) {
    await sequelize.query(`
      CREATE TABLE property_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        propertyId INT NOT NULL,
        name VARCHAR(200) NOT NULL,
        url VARCHAR(500) NOT NULL,
        filename VARCHAR(300) NOT NULL,
        size INT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_propdoc_property FOREIGN KEY (propertyId) REFERENCES properties(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Migración: tabla property_documents creada');
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
    require('./src/utils/logger').error('Error al iniciar el servidor', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}
  
startServer();
