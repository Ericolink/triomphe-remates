'use strict';

// HALLAZGO NUEVO (descubierto en pruebas de humo de AUDIT-013): el modelo PropertyAlert ya
// tenía el campo `phone` (parte del working tree sin commitear de la feature WhatsApp), pero
// la columna nunca se agregó a la base de datos real — sync({alter:false}) no la crea y
// runMigrations() en server.js no tenía un bloque para ella. Resultado: cualquier consulta a
// property_alerts (incluida la simple suscripción a una alerta) fallaba con
// "Unknown column 'phone' in 'field list'". El feature de alertas por WhatsApp estaba roto
// de punta a punta en este entorno hasta esta migración.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const columns = await queryInterface.describeTable('property_alerts');
    if (!columns.phone) {
      await queryInterface.addColumn('property_alerts', 'phone', {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Para notificaciones por WhatsApp',
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('property_alerts', 'phone');
  },
};
