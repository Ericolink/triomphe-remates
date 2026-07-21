const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const JobPosition = sequelize.define(
  'JobPosition',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: false },
    requirements: { type: DataTypes.TEXT, allowNull: false },
    benefits: { type: DataTypes.TEXT, allowNull: true },
    city: {
      type: DataTypes.ENUM('juarez', 'chihuahua', 'queretaro', 'todas'),
      defaultValue: 'todas',
    },
    type: {
      type: DataTypes.ENUM('tiempo_completo', 'medio_tiempo', 'por_comision'),
      defaultValue: 'por_comision',
    },
    status: {
      type: DataTypes.ENUM('activa', 'cerrada', 'pausada'),
      defaultValue: 'activa',
    },
    isUrgent: { type: DataTypes.BOOLEAN, defaultValue: false },
  },
  {
    tableName: 'job_positions',
    timestamps: true,
  }
);

module.exports = JobPosition;
