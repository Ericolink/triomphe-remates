'use strict';

// El formulario de suscripción a alertas ("Recibir alerta cuando llegue una propiedad")
// solo filtraba por precio máximo — se agrega `minPrice` (opcional, misma forma que
// `maxPrice`) para que el usuario también pueda acotar el rango por abajo.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('property_alerts');
    if (!columns.minPrice) {
      await queryInterface.addColumn('property_alerts', 'minPrice', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        comment: 'null = sin límite inferior de precio',
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('property_alerts', 'minPrice');
  },
};
