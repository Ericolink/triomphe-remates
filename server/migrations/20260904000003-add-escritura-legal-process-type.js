'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('properties', 'legalProcessType', {
      type: Sequelize.ENUM('cesion', 'dacion', 'adjudicacion', 'escritura'),
      allowNull: true,
      comment: 'Tipo de proceso legal de adquisición (columna COFINAVIT/VIABILIDAD/TIPO)',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('properties', 'legalProcessType', {
      type: Sequelize.ENUM('cesion', 'dacion', 'adjudicacion'),
      allowNull: true,
      comment: 'Tipo de proceso legal de adquisición (columna COFINAVIT/VIABILIDAD/TIPO)',
    });
  },
};
