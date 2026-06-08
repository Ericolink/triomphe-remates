const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: true },
  userEmail: { type: DataTypes.STRING(150), allowNull: true },
  userName: { type: DataTypes.STRING(100), allowNull: true },
  action: {
    type: DataTypes.ENUM('create', 'update', 'delete', 'login', 'logout', 'export'),
    allowNull: false,
  },
  resource: {
    type: DataTypes.ENUM('property', 'lead', 'feedback', 'user', 'job', 'application', 'alert'),
    allowNull: false,
  },
  resourceId: { type: DataTypes.INTEGER, allowNull: true },
  detail: { type: DataTypes.TEXT, allowNull: true, comment: 'JSON con info adicional' },
  ip: { type: DataTypes.STRING(45), allowNull: true },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
});

module.exports = AuditLog;
