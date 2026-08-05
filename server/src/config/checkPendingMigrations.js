const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');
const logger = require('../utils/logger');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');
const META_TABLE = 'SequelizeMeta';

const listMigrationFiles = () =>
  fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.js'))
    .sort();

// Primera vez que esta base de datos ve la app: sync({alter:false}) ya construyó el
// esquema completo a partir de los modelos actuales, así que las migraciones no tienen
// nada nuevo que aplicar contra ella. Se registran como ya aplicadas sin ejecutar su
// up() — mismo patrón que la recuperación manual usada el 2026-07-17 tras el incidente
// de schema drift en producción, ahora automatizado solo para este caso (DB vacía).
const bootstrapFreshDatabase = async (sequelize, files) => {
  const queryInterface = sequelize.getQueryInterface();

  await queryInterface.createTable(META_TABLE, {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      primaryKey: true,
    },
  });

  if (files.length > 0) {
    await queryInterface.bulkInsert(
      META_TABLE,
      files.map((name) => ({ name }))
    );
  }

  logger.warn(
    `Base de datos nueva detectada: se registraron ${files.length} migraciones como ya aplicadas (el esquema ya fue creado por sync() a partir de los modelos actuales).`
  );
};

// Gate de arranque: si faltan migraciones por aplicar contra esta base de datos, el
// servidor no debe arrancar sirviendo un esquema desincronizado en silencio (así se
// originó el incidente de julio). Falla rápido, igual que validateEnvironment().
async function checkPendingMigrations(sequelize) {
  const files = listMigrationFiles();

  let rows;
  try {
    [rows] = await sequelize.query(`SELECT name FROM \`${META_TABLE}\``);
  } catch (error) {
    if (error.original?.code === 'ER_NO_SUCH_TABLE') {
      await bootstrapFreshDatabase(sequelize, files);
      return;
    }
    throw error;
  }

  const applied = new Set(rows.map((row) => row.name));
  const pending = files.filter((file) => !applied.has(file));

  if (pending.length > 0) {
    throw new Error(
      `Migraciones pendientes sin aplicar: ${pending.join(', ')}. ` +
        'Ejecuta "npm run migrate" contra esta base de datos antes de reiniciar el servidor.'
    );
  }
}

module.exports = { checkPendingMigrations };
