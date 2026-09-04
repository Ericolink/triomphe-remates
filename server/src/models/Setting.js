const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

// Configuración global clave/valor, persistente en BD (ver migración
// 20260904000007-create-settings). `value` guarda JSON serializado — ver
// services/settingsService.js, que es el único punto que debe leer/escribir este modelo
// directamente (controllers/otros módulos deben pasar por ahí, no por Setting.* a mano).
const Setting = sequelize.define(
  'Setting',
  {
    key: {
      type: DataTypes.STRING(100),
      primaryKey: true,
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    updatedByUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: 'settings',
    timestamps: true,
  }
);

module.exports = Setting;
