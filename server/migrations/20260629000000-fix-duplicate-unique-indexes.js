'use strict';

// HALLAZGO NUEVO (descubierto al ejecutar AUDIT-010): properties.slug y users.email tenían
// 63 índices únicos duplicados cada uno (slug, slug_2...slug_63 / email, email_2...email_63),
// sumando exactamente 64 — el máximo de claves por tabla en MySQL. La causa raíz es un bug
// conocido de Sequelize+MySQL: un atributo con `unique: true` inline (sin nombre de índice
// explícito) hace que cada ciclo de `sync({ alter: true })` —el flujo de migración manual
// que este proyecto usa para cambios de esquema, según CLAUDE.md— cree un índice nuevo en
// vez de reconocer el existente. Ambas tablas ya estaban en el límite exacto: la siguiente
// vez que alguien corriera `alter: true` sobre properties o users, el arranque del servidor
// habría lanzado "Too many keys specified" y tronado en producción. property_alerts.token
// tiene el mismo riesgo (unique: true sin nombre) aunque hoy solo tiene 1 índice — se limpia
// preventivamente para que no acumule lo mismo.
async function dropAllIndexesOnColumn(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT DISTINCT INDEX_NAME FROM information_schema.statistics
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table AND COLUMN_NAME = :column AND INDEX_NAME != 'PRIMARY'`,
    { replacements: { table, column } }
  );
  for (const row of rows) {
    await queryInterface.removeIndex(table, row.INDEX_NAME).catch(() => {});
  }
}

module.exports = {
  up: async (queryInterface) => {
    await dropAllIndexesOnColumn(queryInterface, 'properties', 'slug');
    await queryInterface.addIndex('properties', ['slug'], { unique: true, name: 'properties_slug_unique' });

    await dropAllIndexesOnColumn(queryInterface, 'users', 'email');
    await queryInterface.addIndex('users', ['email'], { unique: true, name: 'users_email_unique' });

    await dropAllIndexesOnColumn(queryInterface, 'property_alerts', 'token');
    await queryInterface.addIndex('property_alerts', ['token'], { unique: true, name: 'property_alerts_token_unique' });
  },

  down: async () => {
    // No-op deliberado: revertir recrearía el problema original (índices sin nombre fijo).
  },
};
