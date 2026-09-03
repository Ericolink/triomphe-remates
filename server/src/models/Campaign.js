const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

// CRM Comercial — Fase 1. Solo campos propios de la campaña; métricas derivadas
// (prospectos, ventas, conversión, costo por venta) se calculan siempre al vuelo en
// campaignController, nunca se guardan como columnas — ver CRM_UX_DESIGN.md.
const Campaign = sequelize.define(
  'Campaign',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    platform: {
      type: DataTypes.ENUM('facebook', 'google', 'instagram', 'tiktok', 'otro'),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    budget: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
  },
  {
    tableName: 'campaigns',
    timestamps: true,
  }
);

module.exports = Campaign;
