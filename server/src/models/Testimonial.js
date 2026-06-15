const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const Testimonial = sequelize.define('Testimonial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  clientName: { type: DataTypes.STRING(150), allowNull: false },
  clientRole: { type: DataTypes.STRING(100), allowNull: true, comment: 'Ej: Inversionista, Comprador' },
  clientCity: {
    type: DataTypes.ENUM('juarez', 'chihuahua', 'queretaro'),
    allowNull: true,
  },
  testimonialText: { type: DataTypes.TEXT, allowNull: false },
  beforeImageUrl: { type: DataTypes.STRING(500), allowNull: true },
  beforeImageFilename: { type: DataTypes.STRING(300), allowNull: true },
  afterImageUrl: { type: DataTypes.STRING(500), allowNull: true },
  afterImageFilename: { type: DataTypes.STRING(300), allowNull: true },
  rating: {
    type: DataTypes.INTEGER,
    defaultValue: 5,
    validate: { min: 1, max: 5 },
  },
  status: {
    type: DataTypes.ENUM('pendiente', 'publicado', 'archivado'),
    defaultValue: 'pendiente',
  },
  propertyId: { type: DataTypes.INTEGER, allowNull: true },
  order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  tableName: 'testimonials',
  timestamps: true,
});

module.exports = Testimonial;
