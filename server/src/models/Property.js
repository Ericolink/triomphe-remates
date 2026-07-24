const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const Property = sequelize.define(
  'Property',
  {
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
    category: {
      type: DataTypes.ENUM('remate', 'renta', 'compra_venta_credito', 'compra_venta_contado'),
      allowNull: false,
      defaultValue: 'remate',
      comment: 'Categoría comercial de la propiedad',
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
    colonia: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    fraccionamiento: {
      type: DataTypes.STRING(150),
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
      comment: 'URL amigable para SEO',
    },
    acquisitionStage: {
      type: DataTypes.ENUM(
        'sin_proceso',
        'documentacion',
        'avaluo',
        'negociacion',
        'firma',
        'entrega'
      ),
      defaultValue: 'sin_proceso',
      allowNull: true,
      comment: 'Etapa del proceso de adquisición visible al público',
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas internas — solo visibles para administradores',
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Código interno de Triomphe, ej. JRCH-0164',
    },
  },
  {
    tableName: 'properties',
    timestamps: true,
    // Índice único con nombre fijo (ver migración fix-duplicate-unique-indexes): un `unique:
    // true` inline sin nombre hacía que cada ciclo de sync({alter:true}) creara un índice
    // nuevo en vez de reconocer el existente, hasta llegar al máximo de 64 claves de MySQL.
    indexes: [{ unique: true, fields: ['slug'], name: 'properties_slug_unique' }],
  }
);

module.exports = Property;
