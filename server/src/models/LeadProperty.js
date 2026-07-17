const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

// CRM Comercial — Fase 1. Join table N:M — propiedades de interés adicionales a la de
// origen (Lead.propertyId). Ver Lead.belongsToMany(Property) en models/index.js.
const LeadProperty = sequelize.define('LeadProperty', {
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
}, {
  tableName: 'lead_properties',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['leadId', 'propertyId'], name: 'lead_properties_lead_property_unique' },
  ],
});

module.exports = LeadProperty;
