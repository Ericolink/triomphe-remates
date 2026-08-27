'use strict';

// CRM Comercial — rediseño del calendario de citas: `Appointment` no tenía ninguna relación
// con `User`, así que no había forma de saber quién agendó una cita en particular (solo se
// podía inferir "quién atiende" vía Lead.assignedToUserId). Mismo patrón exacto que
// 20260803000001-add-lead-creator-and-assignedat.js (que agregó Lead.createdByUserId): sin
// backfill, no hay forma confiable de reconstruir quién agendó citas históricas.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('appointments', 'createdByUserId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('appointments', ['createdByUserId'], {
      name: 'idx_appointments_created_by_user_id',
    });
  },

  down: async (queryInterface) => {
    // El índice explícito es el mismo que sostiene el FK (mismo patrón que
    // Lead.createdByUserId) — hay que soltar el constraint antes de poder soltar el índice.
    await queryInterface.removeConstraint('appointments', 'appointments_createdByUserId_foreign_idx');
    await queryInterface.removeIndex('appointments', 'idx_appointments_created_by_user_id');
    await queryInterface.removeColumn('appointments', 'createdByUserId');
  },
};
