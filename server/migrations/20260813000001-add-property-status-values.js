'use strict';

// Amplía los 3 estados de propiedad (disponible/apartado/vendido) a 5, pedido directo del
// dueño del negocio: `en_revision` (se está revisando la propiedad antes de publicarla) y
// `de_vuelta` (se apartó pero el cliente ya no la quiso y volvió al inventario). No hay
// state-machine en el backend (propertyController.updateProperty acepta cualquier
// transición), así que esto es solo ampliar el ENUM — ver server/src/models/Property.js.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('properties', 'status', {
      type: Sequelize.ENUM('disponible', 'en_revision', 'apartado', 'vendido', 'de_vuelta'),
      defaultValue: 'disponible',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('properties', 'status', {
      type: Sequelize.ENUM('disponible', 'apartado', 'vendido'),
      defaultValue: 'disponible',
    });
  },
};
