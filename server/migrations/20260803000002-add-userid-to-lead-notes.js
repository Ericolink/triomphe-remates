'use strict';

// CRM de Leads — roles y visibilidad por fila. `userId` es el autor real de la nota (FK),
// a diferencia de `authorName` (snapshot de texto que se conserva intacta para notas
// históricas y como fallback de display). Sin backfill: no se puede mapear `authorName` de
// vuelta a un `User.id` único de forma confiable (nombres duplicados, usuarios renombrados).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('lead_notes', 'userId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('lead_notes', 'userId');
  },
};
