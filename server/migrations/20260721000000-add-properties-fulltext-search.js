'use strict';

// Buscador público: LIKE '%term%' sobre title/address/description invalida cualquier
// B-Tree y fuerza full table scan en cada búsqueda (no hay debounce en el input, así que
// esto corre en cada tecleo). InnoDB FULLTEXT usa un índice invertido — el costo no crece
// linealmente con las filas. No sustituye LIKE por completo: FULLTEXT no hace *infix*
// matching (a mitad de palabra) ni indexa tokens de <3 caracteres, así que el controller
// lo usa como camino rápido y cae a LIKE solo cuando MATCH/AGAINST no devuelve nada —
// evita perder resultados que antes sí aparecían.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.addIndex('properties', {
      fields: ['title', 'address', 'description'],
      type: 'FULLTEXT',
      name: 'idx_properties_fulltext_search',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('properties', 'idx_properties_fulltext_search');
  },
};
