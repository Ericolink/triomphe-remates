'use strict';

// El home ahora anuncia inventario a nivel nacional y la ficha técnica PDF ya asume
// un bloque de ubicación "Estado → Ciudad → Fraccionamiento → Colonia → Calle" (ver
// comentario de 20260724000000-add-fraccionamiento-to-properties.js), pero el estado
// nunca se guardaba. STRING libre (no ENUM) a propósito: a diferencia de `city`, el
// negocio va a seguir sumando ciudades/estados nuevos y una lista fija habría que
// migrarla cada vez — mismo criterio que colonia/fraccionamiento.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('properties', 'state', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('properties', 'state');
  },
};
