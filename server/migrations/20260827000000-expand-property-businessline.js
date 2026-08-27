'use strict';

// Pedido del dueño del negocio: /propiedades pasa de 2 pestañas (Remates Bancarios/Infonavit)
// a 5 (Remates Bancarios/Con Crédito/En Renta/De Contado/Inversiones). Renombra 'infonavit' a
// 'credito' y agrega 'renta'/'contado'/'inversion' — mismo patrón ensanchar→UPDATE→angostar que
// 20260813000006-consolidate-property-category.js. No se remapea ningún dato desde `category`
// (remate/renta/compra_venta) hacia los nuevos valores — el equipo re-clasifica manualmente
// desde el admin las propiedades que quiera mover a las pestañas nuevas.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Paso 1: ampliar el ENUM para aceptar transitoriamente el valor viejo y los nuevos.
    await queryInterface.changeColumn('properties', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit', 'credito', 'renta', 'contado', 'inversion'),
      allowNull: false,
      defaultValue: 'remate',
    });

    await queryInterface.sequelize.query(`
      UPDATE properties SET businessLine = 'credito' WHERE businessLine = 'infonavit'
    `);

    // Paso 2: angostar el ENUM a los 5 valores finales.
    await queryInterface.changeColumn('properties', 'businessLine', {
      type: Sequelize.ENUM('remate', 'credito', 'renta', 'contado', 'inversion'),
      allowNull: false,
      defaultValue: 'remate',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('properties', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit', 'credito', 'renta', 'contado', 'inversion'),
      allowNull: false,
      defaultValue: 'remate',
    });

    await queryInterface.sequelize.query(`
      UPDATE properties SET businessLine = 'infonavit' WHERE businessLine = 'credito'
    `);
    // Best-effort: 'renta'/'contado'/'inversion' no tenían equivalente antes de este cambio,
    // así que vuelven a 'remate' (mismo criterio de otras down() de este repo que no revierten
    // datos perfectamente, solo la forma del esquema).
    await queryInterface.sequelize.query(`
      UPDATE properties SET businessLine = 'remate' WHERE businessLine IN ('renta', 'contado', 'inversion')
    `);

    await queryInterface.changeColumn('properties', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit'),
      allowNull: false,
      defaultValue: 'remate',
    });
  },
};
