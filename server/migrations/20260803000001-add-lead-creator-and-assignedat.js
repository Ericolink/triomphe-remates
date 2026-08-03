'use strict';

// CRM de Leads — roles y visibilidad por fila.
//  - `createdByUserId`: quién capturó el prospecto, usado por el rol Capturista para ver
//    solo lo que él creó (ver getLeadVisibilityWhere en utils/leadAccess.js). Sin backfill:
//    no hay forma confiable de reconstruir el creador de leads históricos.
//  - `assignedAt`: fecha de la última asignación de responsable. Backfill de mejor
//    esfuerzo con `updatedAt` para leads ya asignados — no es la fecha real de la primera
//    asignación, solo la última modificación conocida al momento de este deploy.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leads', 'createdByUserId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('leads', 'assignedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      `UPDATE leads SET assignedAt = updatedAt WHERE assignedToUserId IS NOT NULL`
    );

    await queryInterface.addIndex('leads', ['createdByUserId'], {
      name: 'idx_leads_created_by_user_id',
    });
  },

  down: async (queryInterface) => {
    // El índice explícito es el mismo que sostiene el FK (mismo patrón que
    // assignedToUserId en 20260714000001) — hay que soltar el constraint antes de poder
    // soltar el índice, o MySQL rechaza el removeIndex.
    await queryInterface.removeConstraint('leads', 'leads_createdByUserId_foreign_idx');
    await queryInterface.removeIndex('leads', 'idx_leads_created_by_user_id');
    await queryInterface.removeColumn('leads', 'assignedAt');
    await queryInterface.removeColumn('leads', 'createdByUserId');
  },
};
