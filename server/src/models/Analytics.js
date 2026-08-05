const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const Analytics = sequelize.define(
  'Analytics',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    event: {
      type: DataTypes.ENUM('view', 'contact', 'share', 'download'),
      allowNull: false,
    },
    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    referrer: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    tableName: 'analytics',
    timestamps: true,
  }
);

module.exports = Analytics;
