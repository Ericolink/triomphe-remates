'use strict';

// CRM Comercial — Fase 1: una venta cerrada. Solo se crea a través de
// leadController.closeLeadAsWon (no hay POST /api/deals directo) para garantizar que nunca
// exista un Deal sin el cambio correspondiente de Lead.pipelineStage a 'venta_realizada'.
// Índice único en leadId: un prospecto solo puede cerrarse como ganado una vez.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('deals', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      leadId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'leads', key: 'id' },
        onDelete: 'CASCADE',
      },
      propertyId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'properties', key: 'id' },
        onDelete: 'RESTRICT',
      },
      amount: { type: Sequelize.DECIMAL(12, 2), allowNull: false },
      closedAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('deals', ['leadId'], { unique: true, name: 'idx_deals_lead_id_unique' });
    await queryInterface.addIndex('deals', ['closedAt'], { name: 'idx_deals_closed_at' });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('deals');
  },
};
