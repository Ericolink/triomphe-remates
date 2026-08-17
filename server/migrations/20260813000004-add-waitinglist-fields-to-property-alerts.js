'use strict';

// Lista de espera de clientes (pedido directo del dueño del negocio): en vez de un modelo
// nuevo desde cero, extiende `property_alerts` — ya es exactamente "criterios de búsqueda +
// matching automático contra propiedades nuevas" (ver server/src/services/alertService.js),
// que es lo mismo que necesita la lista de espera. `source` separa las suscripciones
// públicas del sitio (`POST /api/alerts`, sin cambios) de las entradas manuales de staff
// (nuevo `POST /api/waiting-list`) — ambas comparten tabla, motor de matching y export.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('property_alerts', 'source', {
      type: Sequelize.ENUM('public', 'staff'),
      allowNull: false,
      defaultValue: 'public',
    });

    await queryInterface.addColumn('property_alerts', 'businessLine', {
      type: Sequelize.ENUM('remate', 'infonavit', 'inversion'),
      allowNull: true,
      comment: 'null = cualquier línea de negocio',
    });

    await queryInterface.addColumn('property_alerts', 'state', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Estado de la república (texto libre), como Property.state',
    });

    // Una entrada de lista de espera capturada por staff no siempre tiene correo — el
    // flujo público (`subscribe`) lo sigue exigiendo a nivel de controller, no de columna.
    await queryInterface.changeColumn('property_alerts', 'email', {
      type: Sequelize.STRING(150),
      allowNull: true,
      validate: { isEmail: true },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('property_alerts', 'email', {
      type: Sequelize.STRING(150),
      allowNull: false,
      validate: { isEmail: true },
    });
    await queryInterface.removeColumn('property_alerts', 'state');
    await queryInterface.removeColumn('property_alerts', 'businessLine');
    await queryInterface.removeColumn('property_alerts', 'source');
  },
};
