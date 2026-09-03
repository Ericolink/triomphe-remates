'use strict';

// "Datos básicos" (título/descripción) pasó a ser un apartado estructural, siempre visible
// al público, igual que "Ubicación y tipo" — ya no tiene casilla "Mostrar al público" en el
// formulario admin (ver SECTIONS en PropertyFormPage.jsx), así que la bandera queda sin uso.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeColumn('properties', 'showBasicInfo');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'showBasicInfo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Mostrar la descripción (Datos básicos) en la página pública',
    });
  },
};
