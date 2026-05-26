const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const Image = sequelize.define('Image', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  url: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  filename: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  order: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    comment: 'Orden de aparición en la galería',
  },
  isCover: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Imagen principal de la propiedad',
  },
}, {
  tableName: 'images',
  timestamps: true,
});

module.exports = Image;