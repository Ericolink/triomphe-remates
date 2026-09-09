const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

// Un registro por login/token emitido — es lo que permite invalidar UN dispositivo sin
// tocar tokenVersion (que sigue siendo el mecanismo de invalidación GLOBAL, ver
// authMiddleware.js y sessionService.js). El id de esta tabla es exactamente el claim `sid`
// que se embebe en el JWT.
const UserSession = sequelize.define(
  'UserSession',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    userAgent: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'User-Agent crudo, para poder re-derivar device/browser si el clasificador mejora',
    },
    device: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Derivado del User-Agent al crear la sesión — ver utils/userAgentInfo.js',
    },
    browser: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
      comment: 'IPv4 o IPv6 — resuelta vía resolveClientIp() (rateLimitMiddleware.js)',
    },
    lastActivity: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: 'Se actualiza con throttling (ver sessionService.touchActivity), no en cada request',
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
      comment: 'Espeja la expiración del JWT emitido para esta sesión (JWT_EXPIRES_IN)',
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'null = sesión activa. Se marca al cerrar sesión individualmente, "cerrar las demás", o cualquier bump de tokenVersion (password/rol/desactivación)',
    },
  },
  {
    tableName: 'user_sessions',
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        name: 'idx_user_sessions_user_active',
        fields: ['userId', 'revokedAt', 'expiresAt'],
      },
    ],
  }
);

module.exports = UserSession;
