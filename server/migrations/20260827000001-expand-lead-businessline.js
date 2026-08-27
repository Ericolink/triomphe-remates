'use strict';

// Mantiene Lead.businessLine sincronizado con la expansión de Property.businessLine a 5
// valores (ver 20260827000000-expand-property-businessline.js): 'infonavit'->'credito',
// 'compra_venta'->'contado', se agrega 'renta'. Mismo patrón ensanchar→UPDATE→angostar.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('leads', 'businessLine', {
      type: Sequelize.ENUM(
        'remate',
        'infonavit',
        'compra_venta',
        'credito',
        'renta',
        'contado',
        'inversion'
      ),
      allowNull: true,
      comment: 'null = sin línea de negocio asignada (leads previos a este campo)',
    });

    await queryInterface.sequelize.query(`
      UPDATE leads SET businessLine = 'credito' WHERE businessLine = 'infonavit'
    `);
    await queryInterface.sequelize.query(`
      UPDATE leads SET businessLine = 'contado' WHERE businessLine = 'compra_venta'
    `);

    await queryInterface.changeColumn('leads', 'businessLine', {
      type: Sequelize.ENUM('remate', 'credito', 'renta', 'contado', 'inversion'),
      allowNull: true,
      comment: 'null = sin línea de negocio asignada (leads previos a este campo)',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('leads', 'businessLine', {
      type: Sequelize.ENUM(
        'remate',
        'infonavit',
        'compra_venta',
        'credito',
        'renta',
        'contado',
        'inversion'
      ),
      allowNull: true,
      comment: 'null = sin línea de negocio asignada (leads previos a este campo)',
    });

    await queryInterface.sequelize.query(`
      UPDATE leads SET businessLine = 'infonavit' WHERE businessLine = 'credito'
    `);
    await queryInterface.sequelize.query(`
      UPDATE leads SET businessLine = 'compra_venta' WHERE businessLine = 'contado'
    `);
    // Best-effort: 'renta' no tenía equivalente antes de este cambio, queda sin línea.
    await queryInterface.sequelize.query(`
      UPDATE leads SET businessLine = NULL WHERE businessLine = 'renta'
    `);

    await queryInterface.changeColumn('leads', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit', 'inversion', 'compra_venta'),
      allowNull: true,
      comment: 'null = sin línea de negocio asignada (leads previos a este campo)',
    });
  },
};
