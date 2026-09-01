'use strict';

// Fase 3a del rediseño del CRM: permite marcar una Campaign con el mismo valor de
// utm_campaign que se usa en los anuncios reales, para que leadController.createLead pueda
// auto-vincular campaignId sin que nadie tenga que elegirla a mano. Nullable y sin índice
// único a propósito: dos campañas distintas podrían compartir temporalmente el mismo slug
// de anuncio durante una transición, y no vale la pena bloquear la creación de una campaña
// por eso — el match de createLead simplemente toma la primera que encuentre.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('campaigns', 'utmCampaign', {
      type: Sequelize.STRING(150),
      allowNull: true,
      comment: 'Valor de utm_campaign usado en los anuncios de esta campaña, para auto-vincular leads.',
    });
    await queryInterface.addIndex('campaigns', ['utmCampaign'], { name: 'idx_campaigns_utm_campaign' });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('campaigns', 'idx_campaigns_utm_campaign');
    await queryInterface.removeColumn('campaigns', 'utmCampaign');
  },
};
