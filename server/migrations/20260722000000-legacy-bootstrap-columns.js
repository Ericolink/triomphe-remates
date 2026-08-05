'use strict';

// Formaliza en Sequelize CLI los 6 cambios de esquema que antes vivían en un
// runMigrations() ad-hoc dentro de server.js (mecanismo pre-Sequelize-CLI, tags
// v1.8/v1.9/v2.4). Cada paso se guarda igual de defensivo que el original —
// describeTable/showAllTables antes de actuar — porque esta migración correrá contra
// bases de datos donde estas columnas casi siempre YA existen (cualquier entorno que
// ya arrancó una vez con el server.js viejo), así que debe ser un no-op seguro ahí, y
// solo aplicar el cambio real en una instalación hipotética que nunca llegó a correrlo.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const propertiesCols = await queryInterface.describeTable('properties').catch(() => null);
    if (propertiesCols && !propertiesCols.acquisitionStage) {
      await queryInterface.addColumn('properties', 'acquisitionStage', {
        type: Sequelize.ENUM('sin_proceso', 'documentacion', 'avaluo', 'negociacion', 'firma', 'entrega'),
        allowNull: false,
        defaultValue: 'sin_proceso',
      });
    }
    if (propertiesCols && !propertiesCols.code) {
      await queryInterface.addColumn('properties', 'code', {
        type: Sequelize.STRING(50),
        allowNull: true,
      });
    }

    const leadsCols = await queryInterface.describeTable('leads').catch(() => null);
    if (leadsCols && !leadsCols.source) {
      await queryInterface.addColumn('leads', 'source', {
        type: Sequelize.ENUM('google', 'facebook', 'whatsapp', 'directo', 'referido', 'otro'),
        allowNull: false,
        defaultValue: 'directo',
      });
    }

    const historyCols = await queryInterface.describeTable('property_status_history').catch(() => null);
    if (historyCols && !historyCols.changeType) {
      await queryInterface.addColumn('property_status_history', 'changeType', {
        type: Sequelize.ENUM('status', 'price'),
        allowNull: false,
        defaultValue: 'status',
      });
      await queryInterface.addColumn('property_status_history', 'fromPrice', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      });
      await queryInterface.addColumn('property_status_history', 'toPrice', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
      });
    }

    const usersCols = await queryInterface.describeTable('users').catch(() => null);
    if (usersCols && !usersCols.tokenVersion) {
      await queryInterface.addColumn('users', 'tokenVersion', {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }

    const tables = await queryInterface.showAllTables();
    if (!tables.includes('property_documents')) {
      await queryInterface.createTable('property_documents', {
        id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
        propertyId: {
          type: Sequelize.INTEGER,
          allowNull: false,
          references: { model: 'properties', key: 'id' },
          onDelete: 'CASCADE',
        },
        name: { type: Sequelize.STRING(200), allowNull: false },
        url: { type: Sequelize.STRING(500), allowNull: false },
        filename: { type: Sequelize.STRING(300), allowNull: false },
        size: { type: Sequelize.INTEGER, allowNull: true },
        isPublic: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
        createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      });
    }
  },

  // No-op deliberado: es un bootstrap defensivo de columnas que en casi todos los
  // entornos ya existían antes de que esta migración se escribiera; revertirlo no
  // tiene un estado "anterior" real al que volver (mismo criterio que
  // 20260629000000-fix-duplicate-unique-indexes.js).
  down: async () => {},
};
