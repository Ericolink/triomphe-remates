const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const PropertyDocument = sequelize.define('PropertyDocument', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  propertyId: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(200), allowNull: false },
  url: { type: DataTypes.STRING(500), allowNull: false },
  filename: { type: DataTypes.STRING(300), allowNull: false },
  size: { type: DataTypes.INTEGER, allowNull: true },
}, {
  tableName: 'property_documents',
  timestamps: true,
});

module.exports = PropertyDocument;
