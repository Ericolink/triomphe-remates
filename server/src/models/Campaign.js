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
    // Fase 3a del rediseño del CRM — ver migración 20260903000001. Permite que
    // leadController.createLead auto-vincule un lead público a esta campaña por
    // utm_campaign, sin que nadie tenga que elegirla a mano en CreateLeadModal.
    utmCampaign: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Valor de utm_campaign usado en los anuncios de esta campaña.',
    },
  },
  {
    tableName: 'campaigns',
    timestamps: true,
    // Declarado también aquí (no solo en la migración 20260903000001) — una lección del
    // hotfix de idx_properties_fulltext_search: un índice que solo vive en su migración
    // queda sin crear en cualquier base de datos bootstrapeada "fresca" vía sync() (ver
    // checkPendingMigrations.js/checkSchemaSync.js).
    indexes: [{ fields: ['utmCampaign'], name: 'idx_campaigns_utm_campaign' }],
  }
);

module.exports = Campaign;
