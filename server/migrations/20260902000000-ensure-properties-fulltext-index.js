'use strict';

// HOTFIX — incidente de producción: GET /api/properties?search=... devolvía 500 en cada
// petición. Causa raíz confirmada: el índice FULLTEXT `idx_properties_fulltext_search`
// (creado originalmente por la migración 20260721000000) puede faltar en una base de datos
// aunque SequelizeMeta la liste como aplicada — esto ocurre cuando la base de datos se
// bootstrapea "fresca" vía sync() (ver checkPendingMigrations.js): ese bootstrap construye
// el esquema a partir de los `indexes` declarados en el MODELO, no de las migraciones (que
// marca como aplicadas sin ejecutar su up() para una BD nueva), y el índice FULLTEXT solo
// vivía en la migración, no en el modelo (ya corregido en models/Property.js). Sin el
// índice, `MATCH(title, address, description) AGAINST(...)` lanza
// "Can't find FULLTEXT index matching the column list" en CADA búsqueda — y como el
// buscador no tiene debounce (a propósito, ver esa misma migración), cada tecleo dispara su
// propia petición fallida.
//
// Esta migración es idempotente a propósito (verifica antes de crear): en una base de datos
// donde el índice SÍ existe (creado correctamente por la migración original o por sync()
// después de este fix al modelo), no hace nada.
module.exports = {
  up: async (queryInterface) => {
    const [existing] = await queryInterface.sequelize.query(
      "SHOW INDEX FROM properties WHERE Key_name = 'idx_properties_fulltext_search'"
    );
    if (existing.length > 0) return;

    await queryInterface.addIndex('properties', {
      fields: ['title', 'address', 'description'],
      type: 'FULLTEXT',
      name: 'idx_properties_fulltext_search',
    });
  },

  down: async () => {
    // No revierte nada a propósito: esta migración solo RECREA un índice que la migración
    // 20260721000000 (que sí tiene su propio down()) ya es responsable de eliminar. Un
    // down() aquí que también lo borre dejaría el estado ambiguo entre las dos migraciones.
  },
};
