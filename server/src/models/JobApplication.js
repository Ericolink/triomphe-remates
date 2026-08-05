const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const JobApplication = sequelize.define(
  'JobApplication',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false },
    email: { type: DataTypes.STRING(150), allowNull: false },
    phone: { type: DataTypes.STRING(20), allowNull: false },
    city: {
      type: DataTypes.ENUM('juarez', 'chihuahua', 'queretaro', 'otra'),
      allowNull: false,
    },
    experience: {
      type: DataTypes.ENUM('sin_experiencia', 'menos_1_año', '1_3_años', 'mas_3_años'),
      allowNull: false,
    },
    hasVehicle: { type: DataTypes.BOOLEAN, defaultValue: false },
    motivation: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM('nueva', 'en_revision', 'entrevista', 'aceptada', 'rechazada'),
      defaultValue: 'nueva',
    },
    notes: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    tableName: 'job_applications',
    timestamps: true,
  }
);

module.exports = JobApplication;
