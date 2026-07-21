const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const LeadNote = sequelize.define(
  'LeadNote',
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
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    authorName: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
  },
  {
    tableName: 'lead_notes',
    timestamps: true,
  }
);

module.exports = LeadNote;
