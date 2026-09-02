'use strict';

// Se elimina el sistema de "próxima acción" (pedido explícito del dueño del negocio): un
// asesor debe poder trabajar su prospecto como quiera, sin que el sistema le dicte qué hacer
// a continuación. Se quita de raíz — modelo Task, su creación/cierre automático
// (ensureOpenTask/closeOpenTask/syncOpenTaskAssignee en pipelineHelpers.js), los endpoints
// (/api/tasks, /api/leads/:id/tasks) y esta tabla. Ver también NextActionLine (eliminado de
// KanbanBoard.jsx/LeadDetailPanel.jsx) y el widget "Seguimientos vencidos" del Dashboard
// admin (eliminado de UrgentSection.jsx).
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.dropTable('tasks');
  },

  // Recrea la tabla exactamente como la dejó 20260714000005-create-tasks.js, para que la
  // migración siga siendo reversible.
  down: async (queryInterface, Sequelize) => {
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
};
