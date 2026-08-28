'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(
      "UPDATE feedback SET status = 'leido' WHERE status = 'archivado'"
    );
    await queryInterface.changeColumn('feedback', 'status', {
      type: Sequelize.ENUM('nuevo', 'leido'),
      defaultValue: 'nuevo',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('feedback', 'status', {
      type: Sequelize.ENUM('nuevo', 'leido', 'archivado'),
      defaultValue: 'nuevo',
    });
  },
};
