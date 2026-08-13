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
    // Único campo de rol para todo el sistema (ver server/src/utils/leadAccess.js para el
    // detalle de qué puede hacer cada uno dentro del CRM de leads, y las rutas admin para
    // el resto de módulos). Reemplaza el viejo par role(admin/editor)+crmRole — unificados
    // en la migración 20260813000000-unify-user-roles.
    //  - admin: acceso total a todo el sistema.
    //  - coordinador_ventas: solo inventario — ver y exportar propiedades a Excel/PDF. Sin
    //    acceso al CRM de leads (antes de la unificación este valor significaba lo opuesto:
    //    acceso total a leads; no confundir con ese comportamiento previo).
    //  - asesor_ventas: ve/edita únicamente los prospectos que tiene asignados; inventario
    //    de solo lectura (sin exportar).
    //  - asistente_administrativo: acceso total al CRM de leads (ver/editar/asignar/crear
    //    todos los prospectos), inventario (crear/editar, sin eliminar), campañas, y el
    //    resto de módulos operativos (vacantes, testimonios, buzón, alertas, analytics) —
    //    salvo gestión de usuarios/auditoría, exclusiva de admin.
    role: {
      type: DataTypes.ENUM(
        'admin',
        'coordinador_ventas',
        'asesor_ventas',
        'asistente_administrativo'
      ),
      defaultValue: 'asistente_administrativo',
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
