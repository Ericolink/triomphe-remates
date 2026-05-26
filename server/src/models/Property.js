const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const Property = sequelize.define('Property', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  city: {
    type: DataTypes.ENUM('juarez', 'chihuahua', 'queretaro'),
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('casa', 'departamento', 'terreno', 'local', 'bodega'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('disponible', 'apartado', 'vendido'),
    defaultValue: 'disponible',
  },
  squareMeters: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
  },
  bedrooms: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  bathrooms: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  loanNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Número de crédito bancario del remate',
  },
  bank: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Banco que ejecuta el remate',
  },
  auctionDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Fecha del remate',
  },
  views: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Destacar en el sitio público',
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    comment: 'URL amigable para SEO',
  },
}, {
  tableName: 'properties',
  timestamps: true,
});

module.exports = Property;