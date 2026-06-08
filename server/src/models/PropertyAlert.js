const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');
const crypto = require('crypto');

const PropertyAlert = sequelize.define('PropertyAlert', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  email: { type: DataTypes.STRING(150), allowNull: false, validate: { isEmail: true } },
  city: {
    type: DataTypes.ENUM('juarez', 'chihuahua', 'queretaro'),
    allowNull: true,
    comment: 'null = cualquier ciudad',
  },
  type: {
    type: DataTypes.ENUM('casa', 'departamento', 'terreno', 'local', 'bodega'),
    allowNull: true,
    comment: 'null = cualquier tipo',
  },
  maxPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: true, comment: 'null = sin límite de precio' },
  token: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
    defaultValue: () => crypto.randomBytes(32).toString('hex'),
  },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  tableName: 'property_alerts',
  timestamps: true,
});

module.exports = PropertyAlert;
