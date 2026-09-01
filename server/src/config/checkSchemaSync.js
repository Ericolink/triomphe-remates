const logger = require('../utils/logger');

// HOTFIX 2026-09 — incidente en producción: GET /api/properties devolvía 500 en cada
// petición. Causa raíz: la migración que agrega waterDebt/electricityDebt/propertyTaxDebt/
// debtsUpdateDate a `properties` (y quita template/cadastralPlan/technicalSheet/
// facebookPage/zoneType) nunca llegó a aplicarse en la base de datos de producción, aunque
// el modelo Property SÍ espera esas columnas — propertyController.getProperties usa
// `attributes: { exclude: ['internalNotes'] }`, que selecciona TODAS las demás columnas del
// modelo, así que cualquier columna faltante rompe la consulta con un
// `SequelizeDatabaseError: Unknown column '...' in 'field list'` en CADA petición.
//
// `checkPendingMigrations` (mismo directorio) no detectó esto porque solo compara los
// NOMBRES de los archivos de migración presentes en ESTE despliegue contra la tabla
// SequelizeMeta de la base de datos — si el archivo de migración nunca se subió por FTP al
// servidor de producción (el flujo de deploy es manual, ver CLAUDE.md), ese chequeo ni
// siquiera sabe que la migración debería existir, y no encuentra nada "pendiente".
//
// Esta verificación es independiente de esa bitácora: compara directamente, columna por
// columna, lo que cada modelo espera contra el esquema REAL de la base de datos ya
// conectada — así que detecta el drift sin importar la causa (migración no subida,
// migración corrida a medias, edición manual de la base de datos, etc.), y falla el arranque
// con un mensaje que nombra la tabla y las columnas exactas que faltan, en vez de dejar que
// el síntoma aparezca más tarde como cientos de 500 confusos para un usuario real.
async function checkSchemaSync(sequelize, models) {
  const queryInterface = sequelize.getQueryInterface();
  const problems = [];

  for (const model of models) {
    const tableName = model.getTableName();
    let description;
    try {
      description = await queryInterface.describeTable(tableName);
    } catch (error) {
      problems.push(`no se pudo leer el esquema de "${tableName}" (${error.message})`);
      continue;
    }

    const dbColumns = new Set(Object.keys(description));
    const missing = Object.keys(model.rawAttributes).filter((column) => !dbColumns.has(column));
    if (missing.length > 0) {
      problems.push(`"${tableName}" no tiene la(s) columna(s) [${missing.join(', ')}] que el modelo espera`);
    }

    // Mismo incidente, otra cara: un índice (ej. FULLTEXT) declarado en el modelo puede
    // faltar en la base de datos real aunque las columnas coincidan — se confirmó
    // exactamente este caso con idx_properties_fulltext_search. describeTable no reporta
    // índices, así que se revisan aparte con showIndex.
    const declaredIndexes = model.options?.indexes || [];
    if (declaredIndexes.length > 0) {
      let existingIndexes;
      try {
        existingIndexes = await queryInterface.showIndex(tableName);
      } catch (error) {
        problems.push(`no se pudieron leer los índices de "${tableName}" (${error.message})`);
        existingIndexes = null;
      }
      if (existingIndexes) {
        const existingNames = new Set(existingIndexes.map((idx) => idx.name));
        const missingIndexes = declaredIndexes
          .map((idx) => idx.name)
          .filter((name) => name && !existingNames.has(name));
        if (missingIndexes.length > 0) {
          problems.push(`"${tableName}" no tiene el/los índice(s) [${missingIndexes.join(', ')}] que el modelo espera`);
        }
      }
    }
  }

  if (problems.length > 0) {
    const message =
      'Esquema de base de datos desincronizado con los modelos — probablemente falta ' +
      'correr una migración contra esta base de datos (o el archivo de migración nunca ' +
      `llegó a este despliegue): ${problems.join('; ')}`;
    logger.error(message);
    throw new Error(message);
  }
}

module.exports = { checkSchemaSync };
