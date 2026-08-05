const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
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
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('admin', 'editor'),
      defaultValue: 'editor',
    },
    // Rol dentro del CRM de Leads — SOLO afecta autorización en el módulo de prospectos
    // (ver server/src/utils/leadAccess.js). No debe leerse en ningún otro controller: el
    // resto del sistema (propiedades, vacantes, testimonios, usuarios, auditoría, exports
    // de propiedades) sigue gateado exclusivamente por `role` (admin/editor), sin cambios.
    // null = sin acceso al CRM de leads. Un admin no necesita este campo: role==='admin'
    // ya implica acceso total, incluido el CRM.
    crmRole: {
      type: DataTypes.ENUM('coordinador_ventas', 'capturista', 'asesor_ventas'),
      allowNull: true,
      defaultValue: null,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    profilePhoto: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'URL de foto de perfil en Cloudinary',
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    tokenVersion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Se incrementa al cambiar password/rol/desactivar — invalida JWT ya emitidos',
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    // Índice único con nombre fijo — ver migración fix-duplicate-unique-indexes y el mismo
    // comentario en Property.js (mismo bug de Sequelize+MySQL con unique:true inline).
    indexes: [{ unique: true, fields: ['email'], name: 'users_email_unique' }],
  }
);

module.exports = User;
