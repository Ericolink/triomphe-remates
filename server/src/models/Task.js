const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

// CRM Comercial — Fase 1. La "próxima acción" de un prospecto. La invariante de negocio
// "un prospecto activo siempre tiene exactamente una tarea abierta" se aplica en
// server/src/utils/pipelineHelpers.js (ensureOpenTask/closeOpenTask), no a nivel de base de
// datos — MySQL no soporta índices únicos parciales. No hay create/update/delete genérico
// expuesto por el controlador: la única vía de creación es ensureOpenTask.
const Task = sequelize.define('Task', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  assignedToUserId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  done: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  doneAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'tasks',
  timestamps: true,
});

module.exports = Task;
