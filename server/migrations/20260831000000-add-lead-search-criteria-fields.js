'use strict';

// Rediseño del CRM de prospectos: la ficha del prospecto no tenía ningún campo estructurado
// de "qué está buscando" (zona, tipo de propiedad, recámaras/baños, urgencia) — solo motivo
// de contacto, línea de negocio, forma de pago y presupuesto. Un asesor tenía que leer el
// mensaje libre o llamar al prospecto para saber esto. Todas las columnas son nullable y
// ninguna se pregunta obligatoriamente en la captura (mismo criterio ya usado para
// paymentMethod/budgetAmount/businessLine/firstContactDate) — se llenan durante la captura
// pública (searchCity/desiredType únicamente, ver ContactForm.jsx) o durante el seguimiento
// desde el CRM.
//
// searchCity/desiredType reutilizan los mismos ENUMs que Property.city/Property.type y
// PropertyAlert.city/PropertyAlert.type (sin 'otra' — mismo criterio que PropertyAlert).
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leads', 'searchCity', {
      type: Sequelize.ENUM('juarez', 'chihuahua', 'queretaro'),
      allowNull: true,
      comment: 'Ciudad de interés para su búsqueda. null = sin especificar.',
    });
    await queryInterface.addColumn('leads', 'searchZone', {
      type: Sequelize.STRING(150),
      allowNull: true,
      comment: 'Colonia/zona específica de interés, texto libre.',
    });
    await queryInterface.addColumn('leads', 'desiredType', {
      type: Sequelize.ENUM('casa', 'departamento', 'terreno', 'local', 'bodega'),
      allowNull: true,
      comment: 'Tipo de propiedad que busca.',
    });
    await queryInterface.addColumn('leads', 'minBedrooms', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Recámaras mínimas deseadas.',
    });
    await queryInterface.addColumn('leads', 'minBathrooms', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Baños mínimos deseados.',
    });
    await queryInterface.addColumn('leads', 'desiredFeatures', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Características deseadas en texto libre, ej. "con cochera, una planta".',
    });
    await queryInterface.addColumn('leads', 'urgency', {
      type: Sequelize.ENUM('inmediata', '1_3_meses', '3_6_meses', 'mas_6_meses'),
      allowNull: true,
      comment: 'Urgencia/tiempo estimado para realizar la operación. null = sin preguntar.',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('leads', 'searchCity');
    await queryInterface.removeColumn('leads', 'searchZone');
    await queryInterface.removeColumn('leads', 'desiredType');
    await queryInterface.removeColumn('leads', 'minBedrooms');
    await queryInterface.removeColumn('leads', 'minBathrooms');
    await queryInterface.removeColumn('leads', 'desiredFeatures');
    await queryInterface.removeColumn('leads', 'urgency');
  },
};
