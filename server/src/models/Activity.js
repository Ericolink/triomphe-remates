const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

// CRM Comercial — Fase 1. Timeline de un prospecto: interacciones humanas (llamada,
// whatsapp, email, visita, nota) y eventos automáticos del sistema (type: 'sistema' —
// reservado, un usuario no puede crear una actividad de este tipo, ver activityController).
// A diferencia de LeadNote (que se conserva intacta), referencia userId real en vez de un
// nombre de autor desnormalizado.
const Activity = sequelize.define(
  'Activity',
  {
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
      type: DataTypes.ENUM('llamada', 'whatsapp', 'email', 'visita', 'nota', 'sistema'),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: 'activities',
    timestamps: true,
  }
);

module.exports = Activity;
