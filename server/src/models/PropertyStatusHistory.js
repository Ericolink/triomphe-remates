const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const PropertyStatusHistory = sequelize.define('PropertyStatusHistory', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  propertyId: { type: DataTypes.INTEGER, allowNull: false },
  fromStatus: {
    type: DataTypes.ENUM('disponible', 'apartado', 'vendido'),
    allowNull: true,
  },
  toStatus: {
    type: DataTypes.ENUM('disponible', 'apartado', 'vendido'),
    allowNull: false,
  },
  userName: { type: DataTypes.STRING(100), allowNull: true },
  changeType: {
    type: DataTypes.ENUM('status', 'price'),
    defaultValue: 'status',
    allowNull: false,
  },
  fromPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
  toPrice:   { type: DataTypes.DECIMAL(15, 2), allowNull: true },
}, {
  tableName: 'property_status_history',
  timestamps: true,
  updatedAt: false,
});

module.exports = PropertyStatusHistory;
