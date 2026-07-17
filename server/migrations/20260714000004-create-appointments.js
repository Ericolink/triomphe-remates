'use strict';

// CRM Comercial — Fase 1: reemplaza Lead.appointmentDate (un solo campo suelto) como fuente
// de verdad de citas. `rescheduledFromId` conserva el enlace a la cita anterior cuando se
// reagenda, en vez de sobreescribir la fecha y perder el historial. El FK de auto-referencia
// se agrega en un addConstraint aparte (después de crear la tabla) para evitar problemas de
// orden en el DDL de creación.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('appointments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      leadId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'leads', key: 'id' },
        onDelete: 'CASCADE',
      },
      propertyId: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'properties', key: 'id' },
        onDelete: 'SET NULL',
      },
      scheduledAt: { type: Sequelize.DATE, allowNull: false },
      status: {
        type: Sequelize.ENUM('programada', 'confirmada', 'completada', 'no_show', 'cancelada'),
        allowNull: false,
        defaultValue: 'programada',
      },
      outcome: { type: Sequelize.TEXT, allowNull: true },
      rescheduledFromId: { type: Sequelize.INTEGER, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addConstraint('appointments', {
      fields: ['rescheduledFromId'],
      type: 'foreign key',
      name: 'fk_appointments_rescheduled_from',
      references: { table: 'appointments', field: 'id' },
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('appointments', ['leadId'], { name: 'idx_appointments_lead_id' });
    await queryInterface.addIndex('appointments', ['scheduledAt'], { name: 'idx_appointments_scheduled_at' });
    await queryInterface.addIndex('appointments', ['status'], { name: 'idx_appointments_status' });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('appointments');
  },
};
