const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');
const { KNOWN_RESOURCES } = require('../constants/auditTaxonomy');

const AuditLog = sequelize.define(
  'AuditLog',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: true },
    userEmail: { type: DataTypes.STRING(150), allowNull: true },
    userName: { type: DataTypes.STRING(100), allowNull: true },
    action: {
      type: DataTypes.ENUM('create', 'update', 'delete', 'login', 'logout', 'export'),
      allowNull: false,
    },
    // VARCHAR + validación de aplicación en vez de ENUM (migración 20260904000001): un
    // ENUM ya se quedó corto una vez (20260714000007) y una segunda vez en silencio
    // ('testimonial' nunca se agregó — cada insert fallaba y logAudit solo hace
    // catch+console.error). Con VARCHAR + isIn, un resource inválido sigue fallando,
    // pero de forma explícita y detectable, no como una fila perdida sin rastro.
    resource: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: { isIn: [KNOWN_RESOURCES] },
    },
    resourceId: { type: DataTypes.INTEGER, allowNull: true },
    detail: { type: DataTypes.TEXT, allowNull: true, comment: 'JSON con info adicional' },
    ip: { type: DataTypes.STRING(45), allowNull: true },
    // Filas históricas (pre-migración 20260904000001) no tienen este dato real, pero
    // representan acciones que sí se completaron — 'success' es la lectura correcta para
    // ellas, no una invención. Solo 'success'/'failed' están implementados: nada en el
    // sistema hoy detecta un estado "bloqueado" o "automático" de forma confiable.
    result: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'success',
      validate: { isIn: [['success', 'failed']] },
    },
  },
  {
    tableName: 'audit_logs',
    timestamps: true,
    updatedAt: false,
    // Deben coincidir con la migración 20260904000001 — un índice que solo vive en la
    // migración se pierde en silencio cuando una base de datos nueva se bootstrapea vía
    // sync() (ver el mismo problema ya documentado y resuelto en models/Property.js).
    indexes: [
      // Esta ya existía SOLO en la migración 20260629000001, nunca aquí — mismo riesgo de
      // faltar en silencio en un bootstrap fresco vía sync(); se declara también aquí de
      // paso, ya que este archivo se está tocando por el mismo motivo para las nuevas.
      { fields: ['createdAt'], name: 'idx_audit_logs_created_at' },
      { fields: ['resource'], name: 'idx_audit_logs_resource' },
      { fields: ['action'], name: 'idx_audit_logs_action' },
      { fields: ['userId'], name: 'idx_audit_logs_user_id' },
      { fields: ['result'], name: 'idx_audit_logs_result' },
      {
        fields: ['userName', 'userEmail', 'detail'],
        type: 'FULLTEXT',
        name: 'idx_audit_logs_fulltext',
      },
    ],
  }
);

module.exports = AuditLog;
