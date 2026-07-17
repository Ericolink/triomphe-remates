'use strict';

// Rediseño del formulario de alta/edición de prospectos (ver conversación 2026-07-15):
//  - `paymentMethod`: cómo planea comprar el prospecto (crédito hipotecario / contado).
//  - `budgetAmount`/`budgetNotSpecified`: monto disponible, con bandera explícita para
//    distinguir "no se preguntó" de "se preguntó y no lo especificó" (ver comentario en
//    server/src/models/Lead.js).
//  - `firstContactDate`: fecha del primer contacto real, que puede no coincidir con
//    `createdAt` (fecha de alta en el sistema).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leads', 'paymentMethod', {
      type: Sequelize.ENUM('credito_hipotecario', 'contado'),
      allowNull: true,
    });

    await queryInterface.addColumn('leads', 'budgetAmount', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
    });

    await queryInterface.addColumn('leads', 'budgetNotSpecified', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('leads', 'firstContactDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('leads', 'firstContactDate');
    await queryInterface.removeColumn('leads', 'budgetNotSpecified');
    await queryInterface.removeColumn('leads', 'budgetAmount');
    await queryInterface.removeColumn('leads', 'paymentMethod');
  },
};
