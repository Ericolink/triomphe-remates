'use strict';

// Se elimina la función de documentos de propiedades — se decidió que los documentos
// legales/administrativos no deben subirse desde el sitio (son privados por naturaleza y
// se gestionan fuera del sistema), así que la tabla completa deja de tener uso. Ver también
// la baja de PropertyDocument (model), documentController y las rutas /:id/documents en
// server/src/routes/properties.js.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.dropTable('property_documents');
  },

  down: async (queryInterface, Sequelize) => {
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
  },
};
