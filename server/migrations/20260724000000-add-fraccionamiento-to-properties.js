'use strict';

// Ficha técnica PDF (exportPropertyQuotePDF): el bloque de ubicación necesita mostrar
// Estado → Ciudad → Fraccionamiento → Colonia → Calle, pero 'fraccionamiento' no existía
// en el modelo — mismo patrón que la migración de 'colonia'
// (20260723000001-add-category-colonia-to-properties.js).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'fraccionamiento', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('properties', 'fraccionamiento');
  },
};
