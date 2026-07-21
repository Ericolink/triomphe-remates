const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

// CRM Comercial — Fase 1. Una venta cerrada. Solo se crea desde
// leadController.closeLeadAsWon (no hay POST /api/deals) para garantizar que nunca exista
// un Deal sin el cambio correspondiente de Lead.pipelineStage a 'venta_realizada'.
const Deal = sequelize.define(
  'Deal',
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
    propertyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: 'deals',
    timestamps: true,
    indexes: [{ unique: true, fields: ['leadId'], name: 'idx_deals_lead_id_unique' }],
  }
);

module.exports = Deal;
