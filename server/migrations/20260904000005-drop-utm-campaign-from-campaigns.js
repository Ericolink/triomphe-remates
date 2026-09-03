'use strict';

// Se elimina el campo "utm_campaign del anuncio (opcional)" del formulario de Campañas del
// CRM (ver migración 20260903000001) junto con la lógica que auto-vinculaba un lead público
// a esta campaña por coincidencia de utm_campaign (leadController.createLead). El
// utm_campaign propio del lead (Lead.utmCampaign, capturado de la URL del formulario
// público) no se toca — sigue existiendo como dato de atribución independiente.
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.removeIndex('campaigns', 'idx_campaigns_utm_campaign');
    await queryInterface.removeColumn('campaigns', 'utmCampaign');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('campaigns', 'utmCampaign', {
      type: Sequelize.STRING(150),
      allowNull: true,
      comment: 'Valor de utm_campaign usado en los anuncios de esta campaña, para auto-vincular leads.',
    });
    await queryInterface.addIndex('campaigns', ['utmCampaign'], { name: 'idx_campaigns_utm_campaign' });
  },
};
