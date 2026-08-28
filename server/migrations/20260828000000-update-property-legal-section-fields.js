'use strict';

// Pedido del dueño del negocio: en el apartado "Datos catastrales y legales" del formulario
// admin, 5 de los campos que trajo 20260817000000 (plantilla/plano catastral/ficha técnica/
// página FB/tipo de zona) resultaron no usarse en la práctica — se quitan. A cambio se
// agregan los adeudos de la propiedad (agua/luz/predial, montos de texto libre porque en la
// práctica llegan con notas tipo "AL CORRIENTE" o "$1,200 (2025)", no siempre un número puro
// — mismo criterio que ya usa este apartado para plantilla/plano catastral/ficha técnica en
// la migración original) y una sola fecha de actualización para los 3 adeudos juntos.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('properties', 'template');
    await queryInterface.removeColumn('properties', 'cadastralPlan');
    await queryInterface.removeColumn('properties', 'technicalSheet');
    await queryInterface.removeColumn('properties', 'facebookPage');
    await queryInterface.removeColumn('properties', 'zoneType');

    await queryInterface.addColumn('properties', 'waterDebt', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Adeudo de agua — texto libre (ej. "AL CORRIENTE", montos con nota)',
    });

    await queryInterface.addColumn('properties', 'electricityDebt', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Adeudo de luz — texto libre (ej. "AL CORRIENTE", montos con nota)',
    });

    await queryInterface.addColumn('properties', 'propertyTaxDebt', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Adeudo predial — texto libre (ej. "AL CORRIENTE", montos con nota)',
    });

    await queryInterface.addColumn('properties', 'debtsUpdateDate', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Fecha de actualización de los 3 adeudos (agua/luz/predial)',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('properties', 'debtsUpdateDate');
    await queryInterface.removeColumn('properties', 'propertyTaxDebt');
    await queryInterface.removeColumn('properties', 'electricityDebt');
    await queryInterface.removeColumn('properties', 'waterDebt');

    await queryInterface.addColumn('properties', 'template', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Plantilla — texto libre, no booleano',
    });

    await queryInterface.addColumn('properties', 'cadastralPlan', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Plano catastral — texto libre, no booleano',
    });

    await queryInterface.addColumn('properties', 'technicalSheet', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Ficha técnica — texto libre, no booleano',
    });

    await queryInterface.addColumn('properties', 'facebookPage', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.addColumn('properties', 'zoneType', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
  },
};
