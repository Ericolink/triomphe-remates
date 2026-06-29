'use strict';

// AUDIT-007: separa documentos públicos (mostrados en la ficha pública de la propiedad)
// de privados (solo visibles en el panel admin). Default true para no romper la ficha
// pública existente — el admin marca como privados los documentos sensibles.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('property_documents', 'isPublic', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('property_documents', 'isPublic');
  },
};
