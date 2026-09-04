'use strict';

// Pedido del dueño del negocio: completar en la base de datos el resto de columnas de la
// hoja maestra de Excel del inventario (ver orden exacto pedido en exportExcel/headers,
// exportController.js). `technicalSheet` ("Ficha Técnica"), `zoneType` ("Tipo de zona") y
// `utility` ("Utilidad") existieron antes con este mismo nombre/tipo — se habían quitado en
// 20260817000000→20260828000000 (technicalSheet/zoneType) y 20260904000004 (utility) por "no
// usarse en la práctica"; se reincorporan a pedido explícito. `photoType` ("Tipo de Foto") es
// enteramente nueva, sin precedente en el modelo — se agrega como texto libre siguiendo el
// mismo criterio que el resto de columnas de esta hoja maestra (ver comentario de cabecera de
// 20260817000000: valores mixtos tipo "SI/C" en la hoja original, no un booleano).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'photoType', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Tipo de foto — texto libre, no booleano',
    });

    await queryInterface.addColumn('properties', 'technicalSheet', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Ficha técnica — texto libre, no booleano',
    });

    await queryInterface.addColumn('properties', 'zoneType', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });

    await queryInterface.addColumn('properties', 'utility', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Utilidad — se captura a mano, no se calcula automáticamente',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('properties', 'utility');
    await queryInterface.removeColumn('properties', 'zoneType');
    await queryInterface.removeColumn('properties', 'technicalSheet');
    await queryInterface.removeColumn('properties', 'photoType');
  },
};
