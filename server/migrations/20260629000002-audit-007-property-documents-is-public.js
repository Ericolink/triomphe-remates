'use strict';

// AUDIT-007: separa documentos públicos (mostrados en la ficha pública de la propiedad)
// de privados (solo visibles en el panel admin). Default true para no romper la ficha
// pública existente — el admin marca como privados los documentos sensibles.
//
// Guard defensivo: el modelo PropertyDocument ya declara isPublic, así que en una
// instalación nueva sync({alter:false}) crea la tabla completa (con isPublic incluido)
// antes de que corra esta migración — sin este check, addColumn revienta con
// "duplicate column" contra esa tabla ya creada.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const cols = await queryInterface.describeTable('property_documents').catch(() => null);
    if (cols && cols.isPublic) return;

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
