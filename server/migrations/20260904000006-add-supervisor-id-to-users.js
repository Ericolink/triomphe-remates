'use strict';

// Jerarquía coordinador_ventas -> asesor_ventas: un asesor tiene un único coordinador fijo
// que lo supervisa (ver server/src/utils/leadAccess.js). Mismo patrón exacto que
// 20260827000003-add-createdbyuserid-to-appointments.js (FK auto-referenciada a users).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'supervisorId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Coordinador de ventas que supervisa a este usuario (solo aplica a asesor_ventas)',
    });

    await queryInterface.addIndex('users', ['supervisorId'], {
      name: 'idx_users_supervisor_id',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeConstraint('users', 'users_supervisorId_foreign_idx');
    await queryInterface.removeIndex('users', 'idx_users_supervisor_id');
    await queryInterface.removeColumn('users', 'supervisorId');
  },
};
