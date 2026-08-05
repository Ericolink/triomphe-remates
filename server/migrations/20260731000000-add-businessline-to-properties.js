'use strict';

// Segunda línea de negocio (Infonavit) además de remates bancarios — ver
// server/src/models/Property.js. A diferencia de `category` (subclasificación:
// remate/renta/compra-venta, migración 20260723000001), `businessLine` es el eje que
// separa las dos experiencias públicas completas (secciones, filtros, nav). Default
// 'remate' porque todo el inventario existente es remate bancario.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit'),
      allowNull: false,
      defaultValue: 'remate',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('properties', 'businessLine');
  },
};
