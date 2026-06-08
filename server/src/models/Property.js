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
    allowNull: true,
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
  terrainMeters: {
    type: DataTypes.DECIMAL(8, 2),
    allowNull: true,
  },
  constructionMeters: {
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
  isPromoted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Propiedad estrella — solo una activa a la vez',
  },
  slug: {
    type: DataTypes.STRING(255),
    allowNull: true,
    unique: true,
    comment: 'URL amigable para SEO',
  },
  internalNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas internas — solo visibles para administradores',
  },
}, {
  tableName: 'properties',
  timestamps: true,
});

module.exports = Property;