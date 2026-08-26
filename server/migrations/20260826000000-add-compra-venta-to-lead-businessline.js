'use strict';

// Pedido del dueño del negocio: además de remate/infonavit/inversión, Lead.businessLine
// necesita distinguir prospectos de propiedades de categoría compra-venta (Property.category)
// — antes cualquier lead sobre una propiedad compra-venta se hubiera quedado con la línea de
// negocio en null/remate por defecto, sin forma de diferenciarlo en el embudo comercial.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('leads', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit', 'inversion', 'compra_venta'),
      allowNull: true,
      comment: 'null = sin línea de negocio asignada (leads previos a este campo)',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Best-effort: no hay un valor equivalente al que volver, así que los leads
    // compra_venta quedan sin línea de negocio en vez de mapearse a uno incorrecto.
    await queryInterface.sequelize.query(`
      UPDATE leads SET businessLine = NULL WHERE businessLine = 'compra_venta'
    `);

    await queryInterface.changeColumn('leads', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit', 'inversion'),
      allowNull: true,
      comment: 'null = sin línea de negocio asignada (leads previos a este campo)',
    });
  },
};
