'use strict';

// CRM Comercial — Fase 1: la "próxima acción" — la función más importante del módulo según
// el equipo comercial. La invariante de negocio "un prospecto activo siempre tiene exactamente
// una tarea abierta" se aplica en el controlador (ensureOpenTask en pipelineHelpers.js), no a
// nivel de base de datos — MySQL no soporta índices únicos parciales (WHERE done=false).
// assignedToUserId es NOT NULL con onDelete RESTRICT (no se puede borrar un usuario con
// tareas abiertas asignadas — coherente con que el proyecto ya solo desactiva usuarios
// (isActive) en vez de borrarlos).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('tasks', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      leadId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'leads', key: 'id' },
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.STRING(50), allowNull: false },
      dueDate: { type: Sequelize.DATE, allowNull: false },
      assignedToUserId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'RESTRICT',
      },
      done: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      doneAt: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('tasks', ['leadId'], { name: 'idx_tasks_lead_id' });
    await queryInterface.addIndex('tasks', ['assignedToUserId', 'done'], { name: 'idx_tasks_assigned_done' });
    await queryInterface.addIndex('tasks', ['dueDate'], { name: 'idx_tasks_due_date' });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('tasks');
  },
};
