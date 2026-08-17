'use strict';

// Pedido del dueño del negocio: simplifica `category` fusionando compra_venta_credito y
// compra_venta_contado (distinción de forma de pago) en un solo valor `compra_venta` — esa
// distinción de crédito/contado ya no se necesita en este campo. `remate`/`renta` no cambian.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Paso 1: ampliar el ENUM para aceptar transitoriamente el valor viejo y el nuevo.
    await queryInterface.changeColumn('properties', 'category', {
      type: Sequelize.ENUM(
        'remate',
        'renta',
        'compra_venta_credito',
        'compra_venta_contado',
        'compra_venta'
      ),
      allowNull: false,
      defaultValue: 'remate',
    });

    await queryInterface.sequelize.query(`
      UPDATE properties
      SET category = 'compra_venta'
      WHERE category IN ('compra_venta_credito', 'compra_venta_contado')
    `);

    // Paso 2: angostar el ENUM a los 3 valores finales.
    await queryInterface.changeColumn('properties', 'category', {
      type: Sequelize.ENUM('remate', 'renta', 'compra_venta'),
      allowNull: false,
      defaultValue: 'remate',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('properties', 'category', {
      type: Sequelize.ENUM(
        'remate',
        'renta',
        'compra_venta_credito',
        'compra_venta_contado',
        'compra_venta'
      ),
      allowNull: false,
      defaultValue: 'remate',
    });

    // Best-effort: no hay forma de recuperar cuál de los 2 valores viejos era cada fila,
    // así que todas vuelven a compra_venta_credito (mismo criterio de otras down() de este
    // repo que no revierten datos perfectamente, solo la forma del esquema).
    await queryInterface.sequelize.query(`
      UPDATE properties SET category = 'compra_venta_credito' WHERE category = 'compra_venta'
    `);

    await queryInterface.changeColumn('properties', 'category', {
      type: Sequelize.ENUM('remate', 'renta', 'compra_venta_credito', 'compra_venta_contado'),
      allowNull: false,
      defaultValue: 'remate',
    });
  },
};
