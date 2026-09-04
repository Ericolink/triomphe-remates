'use strict';

// Pedido del dueño del negocio: el apartado "Datos catastrales y legales" gana 3 campos
// nuevos que resultan de desglosar lo que hoy es una sola columna (`legalProcessType`, cuyo
// encabezado original en la hoja de Excel era "COFINAVIT/VIABILIDAD/TIPO") en 3 campos reales
// independientes — `legalProcessType` se deja intacto (no se toca ni se borra) porque ya tiene
// datos capturados y el Excel lo sigue usando tal cual.
//
// También se vuelven a agregar `template` y `cadastralPlan` (columnas "Plantilla"/"Plano
// Catastral"), que existían con ese mismo nombre/tipo hasta que la migración
// 20260828000000-update-property-legal-section-fields las quitó por "no usarse en la
// práctica" — el dueño del negocio pidió explícitamente reincorporarlas.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'cofinavit', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Monto Cofinavit — apartado Datos catastrales y legales',
    });

    await queryInterface.addColumn('properties', 'viabilidad', {
      type: Sequelize.STRING(150),
      allowNull: true,
      comment: 'Viabilidad — texto libre, apartado Datos catastrales y legales',
    });

    await queryInterface.addColumn('properties', 'tipo', {
      type: Sequelize.STRING(150),
      allowNull: true,
      comment:
        'Tipo (proceso legal) — texto libre, apartado Datos catastrales y legales; distinto ' +
        'de `type` (tipo de inmueble: casa/departamento/terreno/local/bodega)',
    });

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
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('properties', 'cadastralPlan');
    await queryInterface.removeColumn('properties', 'template');
    await queryInterface.removeColumn('properties', 'tipo');
    await queryInterface.removeColumn('properties', 'viabilidad');
    await queryInterface.removeColumn('properties', 'cofinavit');
  },
};
