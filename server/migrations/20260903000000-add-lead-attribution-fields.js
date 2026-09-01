'use strict';

// Fase 3a del rediseño del CRM (ver AUDITORIA/análisis de prospectos): capturar
// automáticamente más atribución de marketing sin pedirle nada nuevo al prospecto —
// `source`/`campaignId` ya existían pero solo se llenan si alguien los manda a mano
// (CreateLeadModal) o si la URL trae `?source`/`?utm_source`. Estas columnas capturan el
// resto de la cadena UTM más la página exacta donde se originó el contacto, todo nullable:
// un lead sin ningún parámetro UTM (la mayoría, por ahora) simplemente no las llena.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('leads', 'utmMedium', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'utm_medium de la URL de origen (ej. "cpc", "social") — null si no venía en la URL.',
    });
    await queryInterface.addColumn('leads', 'utmCampaign', {
      type: Sequelize.STRING(150),
      allowNull: true,
      comment:
        'utm_campaign de la URL de origen, tal cual — se usa además para intentar auto-vincular ' +
        'campaignId contra Campaign.utmCampaign (ver leadController.createLead). null si no venía.',
    });
    await queryInterface.addColumn('leads', 'utmContent', {
      type: Sequelize.STRING(150),
      allowNull: true,
      comment: 'utm_content de la URL de origen (ej. variante de anuncio A/B) — null si no venía.',
    });
    await queryInterface.addColumn('leads', 'landingPageUrl', {
      type: Sequelize.STRING(500),
      allowNull: true,
      comment:
        'Página exacta donde se envió el formulario (Referer del request) — ej. la ficha de ' +
        'una propiedad específica. Se captura automáticamente, nunca la escribe un humano.',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('leads', 'landingPageUrl');
    await queryInterface.removeColumn('leads', 'utmContent');
    await queryInterface.removeColumn('leads', 'utmCampaign');
    await queryInterface.removeColumn('leads', 'utmMedium');
  },
};
