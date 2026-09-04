'use strict';

// Primer mecanismo de configuración persistente del sistema — no existía ninguno hasta
// ahora (ver AUDITORIA_INVENTARIO_TOGGLE). Tabla clave/valor genérica (en vez de una tabla
// de una sola fila) para que un próximo flag de sistema reutilice esta tabla sin necesitar
// otra migración de esquema — solo un INSERT/UPSERT de fila nueva. `value` guarda JSON
// serializado (ver settingsService.js) para poder representar booleanos, strings o números
// sin cambiar el tipo de columna según el flag.
//
// Se siembra `inventoryDownloadEnabled=true` explícitamente para que el comportamiento
// actual (descarga siempre entregada) no cambie ni un segundo tras el deploy de esta
// migración — settingsService.getSetting también trae `true` como default si la fila no
// existiera, pero sembrarla aquí deja el estado real en BD sin depender de ese fallback.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('settings', {
      key: { type: Sequelize.STRING(100), primaryKey: true },
      value: { type: Sequelize.TEXT, allowNull: true },
      updatedByUserId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });

    await queryInterface.bulkInsert('settings', [
      {
        key: 'inventoryDownloadEnabled',
        value: JSON.stringify(true),
        updatedByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('settings');
  },
};
