'use strict';

// PropertyStatusHistory.fromStatus/toStatus tenían su propio ENUM de 3 valores, separado
// del de `properties.status` (ver migración 20260813000001) — sin este cambio, registrar
// una transición hacia/desde `en_revision`/`de_vuelta` en el historial fallaría con un
// error de ENUM inválido en propertyController.updateProperty.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('property_status_history', 'fromStatus', {
      type: Sequelize.ENUM('disponible', 'en_revision', 'apartado', 'vendido', 'de_vuelta'),
      allowNull: true,
    });
    await queryInterface.changeColumn('property_status_history', 'toStatus', {
      type: Sequelize.ENUM('disponible', 'en_revision', 'apartado', 'vendido', 'de_vuelta'),
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('property_status_history', 'fromStatus', {
      type: Sequelize.ENUM('disponible', 'apartado', 'vendido'),
      allowNull: true,
    });
    await queryInterface.changeColumn('property_status_history', 'toStatus', {
      type: Sequelize.ENUM('disponible', 'apartado', 'vendido'),
      allowNull: false,
    });
  },
};
