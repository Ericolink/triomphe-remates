'use strict';

// Tabla de sesiones activas por dispositivo/login — ver server/src/models/UserSession.js.
// El id autoincrement de esta tabla es exactamente el claim `sid` que se embebe en el JWT
// (server/src/services/sessionService.js), lo que permite invalidar UN dispositivo sin
// tocar tokenVersion (mecanismo de invalidación global existente, sin cambios).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_sessions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      userAgent: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      device: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      browser: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      lastActivity: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      expiresAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      revokedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    // Único patrón de consulta real: "sesiones no revocadas/no vencidas de este usuario".
    await queryInterface.addIndex('user_sessions', ['userId', 'revokedAt', 'expiresAt'], {
      name: 'idx_user_sessions_user_active',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('user_sessions');
  },
};
