'use strict';

// Segundo flag en la tabla `settings` genérica (ver 20260904000007-create-settings) — solo
// un INSERT de fila nueva, sin tocar el esquema. Sembrado explícitamente en `true` para que
// el comportamiento actual (propiedades visibles al público) no cambie ni un segundo tras
// el deploy; settingsService.getSetting también trae `true` como default si la fila no
// existiera, pero sembrarla aquí deja el estado real en BD sin depender de ese fallback.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkInsert('settings', [
      {
        key: 'publicPropertiesEnabled',
        value: JSON.stringify(true),
        updatedByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('settings', { key: 'publicPropertiesEnabled' });
  },
};
