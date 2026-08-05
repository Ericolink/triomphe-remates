'use strict';

// Propiedad Estrella (home) necesitaba mostrar "Categoría comercial" (remate/renta/
// compra-venta) y "Colonia", ninguno de los dos existía en el modelo — ver
// server/src/models/Property.js. `category` por defecto 'remate' porque el negocio
// nació como plataforma de remates bancarios y todo el inventario existente lo es.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'category', {
      type: Sequelize.ENUM('remate', 'renta', 'compra_venta_credito', 'compra_venta_contado'),
      allowNull: false,
      defaultValue: 'remate',
    });

    await queryInterface.addColumn('properties', 'colonia', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('properties', 'colonia');
    await queryInterface.removeColumn('properties', 'category');
  },
};
