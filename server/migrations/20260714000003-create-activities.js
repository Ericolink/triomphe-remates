'use strict';

// CRM Comercial — Fase 1: timeline de un prospecto. Registra tanto interacciones humanas
// (llamada, whatsapp, email, visita, nota) como eventos automáticos del sistema
// (type: 'sistema' — etapa actualizada, cita agendada/reagendada/cancelada, venta
// registrada, responsable cambiado). A diferencia de LeadNote (que se conserva sin cambios
// para no romper el flujo de WhatsApp existente), Activity referencia userId real en vez de
// un nombre de autor desnormalizado.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('activities', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      leadId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'leads', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('llamada', 'whatsapp', 'email', 'visita', 'nota', 'sistema'),
        allowNull: false,
      },
      content: { type: Sequelize.TEXT, allowNull: false },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      occurredAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('activities', ['leadId'], { name: 'idx_activities_lead_id' });
    await queryInterface.addIndex('activities', ['occurredAt'], { name: 'idx_activities_occurred_at' });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('activities');
  },
};
