'use strict';

// Mantiene PropertyAlert.businessLine sincronizado con la expansión de Property.businessLine a
// 5 valores (ver 20260827000000-expand-property-businessline.js): 'infonavit'->'credito', se
// agregan 'renta'/'contado'. Antes este modelo se había quedado deliberadamente en 3 valores
// (sin 'compra_venta') — con esto queda alineado 1:1 con Property/Lead, así que el frontend ya
// no necesita excluir ningún valor de sus selects (ver WaitingListPage.jsx).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('property_alerts', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit', 'credito', 'renta', 'contado', 'inversion'),
      allowNull: true,
      comment: 'null = cualquier línea de negocio',
    });

    await queryInterface.sequelize.query(`
      UPDATE property_alerts SET businessLine = 'credito' WHERE businessLine = 'infonavit'
    `);

    await queryInterface.changeColumn('property_alerts', 'businessLine', {
      type: Sequelize.ENUM('remate', 'credito', 'renta', 'contado', 'inversion'),
      allowNull: true,
      comment: 'null = cualquier línea de negocio',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('property_alerts', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit', 'credito', 'renta', 'contado', 'inversion'),
      allowNull: true,
      comment: 'null = cualquier línea de negocio',
    });

    await queryInterface.sequelize.query(`
      UPDATE property_alerts SET businessLine = 'infonavit' WHERE businessLine = 'credito'
    `);
    // Best-effort: 'renta'/'contado' no tenían equivalente antes de este cambio.
    await queryInterface.sequelize.query(`
      UPDATE property_alerts SET businessLine = NULL WHERE businessLine IN ('renta', 'contado')
    `);

    await queryInterface.changeColumn('property_alerts', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit', 'inversion'),
      allowNull: true,
      comment: 'null = cualquier línea de negocio',
    });
  },
};
