'use strict';

// Se elimina la sección "Valuación comercial" del formulario admin. Precio/fecha comercial 1
// se conservan (se movieron a "Datos catastrales y legales"); el resto de la sección
// (precio/fecha comercial 2, utilidad, fecha de ingreso a inventario) y su bandera de
// visibilidad (showValuationInfo, que nunca tuvo efecto visible al público) se eliminan
// por completo.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeColumn('properties', 'commercialPrice2');
    await queryInterface.removeColumn('properties', 'commercialPrice2Date');
    await queryInterface.removeColumn('properties', 'utility');
    await queryInterface.removeColumn('properties', 'inventoryEntryDate');
    await queryInterface.removeColumn('properties', 'showValuationInfo');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'commercialPrice2', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Segundo precio de avalúo comercial capturado (actualización posterior)',
    });
    await queryInterface.addColumn('properties', 'commercialPrice2Date', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('properties', 'utility', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Utilidad — se captura a mano, no se calcula automáticamente',
    });
    await queryInterface.addColumn('properties', 'inventoryEntryDate', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha en que la propiedad ingresó al inventario',
    });
    await queryInterface.addColumn('properties', 'showValuationInfo', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Reservado — Valuación comercial no se muestra hoy en ningún lado',
    });
  },
};
