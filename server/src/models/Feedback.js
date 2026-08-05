const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const Feedback = sequelize.define(
  'Feedback',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    category: {
      type: DataTypes.ENUM('queja', 'comentario', 'sugerencia'),
      allowNull: false,
      defaultValue: 'comentario',
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: { isEmail: true },
    },
    subject: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('nuevo', 'leido', 'archivado'),
      defaultValue: 'nuevo',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas internas del equipo',
    },
  },
  {
    tableName: 'feedback',
    timestamps: true,
  }
);

module.exports = Feedback;
