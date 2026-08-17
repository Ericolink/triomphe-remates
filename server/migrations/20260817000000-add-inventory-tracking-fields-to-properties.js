'use strict';

// Alinea el inventario de la app con la hoja maestra de Excel que el negocio ya usaba
// internamente (LT/MZ/Portafolio/tipo de proceso legal/plantilla/plano catastral/ficha
// técnica/página FB/zona/tipo de zona/2 precios comerciales con fecha/utilidad/fecha de
// ingreso a inventario) — ver export de propiedades (exportController.js) y el formulario
// admin (PropertyFormPage.jsx), que ahora capturan y muestran estos 16 campos nuevos.
//
// `legalProcessType` es el único ENUM: los únicos valores vistos en la hoja maestra
// (CESIÓN/DACIÓN/ADJUDICACIÓN) forman un catálogo cerrado. El resto se deja como texto
// libre (STRING) a propósito — columnas como "plantilla"/"plano catastral"/"ficha técnica"/
// "página FB" mezclan en la hoja original valores tipo "SI/C", "SI/CG" o fechas en la misma
// celda, no un simple booleano; forzar un tipo más estricto perdería esa información.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'lot', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Lote (LT en la hoja de inventario)',
    });

    await queryInterface.addColumn('properties', 'block', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Manzana (MZ en la hoja de inventario)',
    });

    await queryInterface.addColumn('properties', 'portfolio', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });

    await queryInterface.addColumn('properties', 'legalProcessType', {
      type: Sequelize.ENUM('cesion', 'dacion', 'adjudicacion'),
      allowNull: true,
      comment: 'Tipo de proceso legal de adquisición (columna COFINAVIT/VIABILIDAD/TIPO)',
    });

    await queryInterface.addColumn('properties', 'template', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Plantilla — texto libre, no booleano (ver comentario de cabecera)',
    });

    await queryInterface.addColumn('properties', 'cadastralPlan', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Plano catastral — texto libre, no booleano (ver comentario de cabecera)',
    });

    await queryInterface.addColumn('properties', 'technicalSheet', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Ficha técnica — texto libre, no booleano (ver comentario de cabecera)',
    });

    await queryInterface.addColumn('properties', 'facebookPage', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });

    await queryInterface.addColumn('properties', 'zone', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await queryInterface.addColumn('properties', 'zoneType', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await queryInterface.addColumn('properties', 'commercialPrice1', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Primer precio de avalúo comercial capturado',
    });

    await queryInterface.addColumn('properties', 'commercialPrice1Date', {
      type: Sequelize.DATE,
      allowNull: true,
    });

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
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('properties', 'inventoryEntryDate');
    await queryInterface.removeColumn('properties', 'utility');
    await queryInterface.removeColumn('properties', 'commercialPrice2Date');
    await queryInterface.removeColumn('properties', 'commercialPrice2');
    await queryInterface.removeColumn('properties', 'commercialPrice1Date');
    await queryInterface.removeColumn('properties', 'commercialPrice1');
    await queryInterface.removeColumn('properties', 'zoneType');
    await queryInterface.removeColumn('properties', 'zone');
    await queryInterface.removeColumn('properties', 'facebookPage');
    await queryInterface.removeColumn('properties', 'technicalSheet');
    await queryInterface.removeColumn('properties', 'cadastralPlan');
    await queryInterface.removeColumn('properties', 'template');
    await queryInterface.removeColumn('properties', 'legalProcessType');
    await queryInterface.removeColumn('properties', 'portfolio');
    await queryInterface.removeColumn('properties', 'block');
    await queryInterface.removeColumn('properties', 'lot');
  },
};
