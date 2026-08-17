'use strict';

// Varios campos nuevos/ajustados del formulario de edición de propiedad, pedidos juntos por
// el dueño del negocio:
//  - `propertyNumber`: número de la casa/lote (ej. "2512"), distinto de `code` (código
//    interno de Triomphe, ej. "JRCH-0164").
//  - `postalCode`: código postal.
//  - `halfBathrooms`: baños incompletos — `bathrooms` (ya existente) pasa a representar
//    específicamente baños completos, sin necesidad de backfill (los valores ya cargados
//    eran conteos simples de baño, lo más cercano a "completos" que había hasta ahora).
//  - Fusiona `fraccionamiento` en `colonia`: un solo campo de texto libre en vez de dos
//    (pedido explícito de "unir input Fraccionamiento/Colonia"). Backfill concatena ambos
//    valores cuando una propiedad tenía los dos capturados.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'propertyNumber', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Número de la casa/lote, ej. 2512 — distinto de `code` (código interno)',
    });

    await queryInterface.addColumn('properties', 'postalCode', {
      type: Sequelize.STRING(10),
      allowNull: true,
    });

    await queryInterface.addColumn('properties', 'halfBathrooms', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Baños incompletos — `bathrooms` representa baños completos',
    });

    // Backfill: concatenar fraccionamiento + colonia en colonia cuando ambos existan, antes
    // de eliminar la columna fraccionamiento.
    await queryInterface.sequelize.query(`
      UPDATE properties
      SET colonia = CASE
        WHEN fraccionamiento IS NOT NULL AND fraccionamiento != ''
             AND colonia IS NOT NULL AND colonia != '' THEN CONCAT(fraccionamiento, ' ', colonia)
        WHEN fraccionamiento IS NOT NULL AND fraccionamiento != '' THEN fraccionamiento
        ELSE colonia
      END
    `);
    await queryInterface.removeColumn('properties', 'fraccionamiento');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'fraccionamiento', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    // No hay forma de separar de vuelta el valor concatenado — se deja `fraccionamiento`
    // vacío y `colonia` con el texto combinado (mismo criterio de otras down() del repo,
    // solo revierte la forma del esquema, no reconstruye datos perdidos).
    await queryInterface.removeColumn('properties', 'halfBathrooms');
    await queryInterface.removeColumn('properties', 'postalCode');
    await queryInterface.removeColumn('properties', 'propertyNumber');
  },
};
