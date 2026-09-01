'use strict';

// Fase 1 de analítica de tráfico propia (ver AUDITORIA/análisis previo). Extiende la tabla
// `analytics` ya existente en vez de crear una tabla paralela — solo dos eventos ('view' y
// 'share') se escribían hasta ahora, exclusivamente desde propertyController. Este cambio:
//
//   1. Le suma las columnas de visitante/sesión/dispositivo/atribución que necesita el
//      dashboard de "Tráfico del sitio".
//   2. Amplía el ENUM `event` con el vocabulario final de Fase 1 (algunos, como
//      `property_search`/`property_filter`/`phone_click`, quedan reservados para Fase 2 —
//      declararlos ahora evita una segunda migración de ENUM cuando se instrumenten).
//   3. Migra las filas históricas 'view'/'share' a sus nombres nuevos ('property_view'/
//      'property_share') en vez de dejarlas huérfanas — no se borra ningún dato.
//   4. Conserva 'contact'/'download' en el ENUM: aunque ningún código actual los escribe
//      (confirmado por grep), SÍ hay filas históricas reales con event='contact' en la base
//      (verificado con una consulta directa antes de angostar el ENUM — el grep del código
//      no basta para decidir esto, hay que mirar los datos). Se dejan como legacy/no
//      escribibles por código nuevo en vez de forzar una re-etiquetación que inventaría un
//      significado que no se puede reconstruir con certeza.
//
// IMPORTANTE de privacidad: a partir de este cambio, propertyController.trackView/trackShare
// dejan de escribir `ip` y `referrer` completo en filas nuevas (ver analyticsService.js) —
// esas dos columnas se conservan sin borrar por las filas históricas que ya las tienen, pero
// quedan deprecadas para escritura.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Paso 1: ampliar el ENUM para aceptar transitoriamente los valores viejos y los nuevos.
    await queryInterface.changeColumn('analytics', 'event', {
      type: Sequelize.ENUM(
        'view',
        'contact',
        'share',
        'download',
        'page_view',
        'property_view',
        'property_search',
        'property_filter',
        'whatsapp_click',
        'phone_click',
        'email_click',
        'property_share',
        'technical_sheet_download'
      ),
      allowNull: false,
    });

    await queryInterface.sequelize.query(`
      UPDATE analytics SET event = 'property_view' WHERE event = 'view'
    `);
    await queryInterface.sequelize.query(`
      UPDATE analytics SET event = 'property_share' WHERE event = 'share'
    `);

    // Paso 2: angostar el ENUM — sin 'view'/'share' (ya renombrados arriba), pero
    // conservando 'contact'/'download' por las filas históricas reales (ver comentario de
    // cabecera). Ningún código nuevo los escribe.
    await queryInterface.changeColumn('analytics', 'event', {
      type: Sequelize.ENUM(
        'page_view',
        'property_view',
        'property_search',
        'property_filter',
        'whatsapp_click',
        'phone_click',
        'email_click',
        'property_share',
        'technical_sheet_download',
        'contact',
        'download'
      ),
      allowNull: false,
    });

    await queryInterface.addColumn('analytics', 'visitorId', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      comment: 'UUID anónimo del visitante (localStorage del cliente) — no es información personal.',
    });
    await queryInterface.addColumn('analytics', 'sessionId', {
      type: Sequelize.CHAR(36),
      allowNull: true,
      comment: 'UUID de sesión — se rota tras 30 min de inactividad (ver analytics.js del cliente).',
    });
    await queryInterface.addColumn('analytics', 'path', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Ruta pública donde ocurrió el evento, ej. /propiedades/casa-polanco.',
    });
    await queryInterface.addColumn('analytics', 'referrerHost', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Solo el host del referrer (ej. "google.com") — nunca la URL completa.',
    });
    await queryInterface.addColumn('analytics', 'utmSource', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.addColumn('analytics', 'utmMedium', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.addColumn('analytics', 'utmCampaign', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.addColumn('analytics', 'utmContent', {
      type: Sequelize.STRING(150),
      allowNull: true,
    });
    await queryInterface.addColumn('analytics', 'device', {
      type: Sequelize.ENUM('desktop', 'mobile', 'tablet', 'unknown'),
      allowNull: true,
      comment: 'Resuelto en el servidor a partir del User-Agent — nunca lo manda el cliente.',
    });
    await queryInterface.addColumn('analytics', 'browser', {
      type: Sequelize.STRING(30),
      allowNull: true,
    });
    await queryInterface.addColumn('analytics', 'os', {
      type: Sequelize.STRING(30),
      allowNull: true,
    });
    await queryInterface.addColumn('analytics', 'isBot', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Marcado (no descartado) cuando el User-Agent coincide con un bot conocido.',
    });

    await queryInterface.addIndex('analytics', ['event', 'createdAt'], {
      name: 'idx_analytics_event_created',
    });
    await queryInterface.addIndex('analytics', ['propertyId', 'event', 'createdAt'], {
      name: 'idx_analytics_property_event_created',
    });
    await queryInterface.addIndex('analytics', ['sessionId'], { name: 'idx_analytics_session' });
    await queryInterface.addIndex('analytics', ['visitorId'], { name: 'idx_analytics_visitor' });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('analytics', 'idx_analytics_visitor');
    await queryInterface.removeIndex('analytics', 'idx_analytics_session');
    await queryInterface.removeIndex('analytics', 'idx_analytics_property_event_created');
    await queryInterface.removeIndex('analytics', 'idx_analytics_event_created');

    await queryInterface.removeColumn('analytics', 'isBot');
    await queryInterface.removeColumn('analytics', 'os');
    await queryInterface.removeColumn('analytics', 'browser');
    await queryInterface.removeColumn('analytics', 'device');
    await queryInterface.removeColumn('analytics', 'utmContent');
    await queryInterface.removeColumn('analytics', 'utmCampaign');
    await queryInterface.removeColumn('analytics', 'utmMedium');
    await queryInterface.removeColumn('analytics', 'utmSource');
    await queryInterface.removeColumn('analytics', 'referrerHost');
    await queryInterface.removeColumn('analytics', 'path');
    await queryInterface.removeColumn('analytics', 'sessionId');
    await queryInterface.removeColumn('analytics', 'visitorId');

    // El ENUM actual (el angostado por up(), Paso 2) ya NO incluye 'view'/'share' como
    // valores legales — hay que volver a ampliarlo antes de poder escribirlos, mismo
    // problema en espejo que el widen/narrow de up(). No se angosta de vuelta a los 4
    // valores originales: para entonces pueden existir filas con eventos que no tienen
    // equivalente viejo (page_view, whatsapp_click, etc.) y forzar el ENUM a un set más
    // chico las corrompería silenciosamente (MySQL las convertiría a ''). Se deja el ENUM
    // ampliado y solo se revierten los nombres que sí tienen equivalente 1:1, priorizando
    // "no perder datos" sobre "dejar el esquema idéntico al de antes" — mismo criterio de
    // otras down() de este repo (ver consolidate-property-category.js).
    await queryInterface.changeColumn('analytics', 'event', {
      type: Sequelize.ENUM(
        'view',
        'contact',
        'share',
        'download',
        'page_view',
        'property_view',
        'property_search',
        'property_filter',
        'whatsapp_click',
        'phone_click',
        'email_click',
        'property_share',
        'technical_sheet_download'
      ),
      allowNull: false,
    });
    await queryInterface.sequelize.query(`
      UPDATE analytics SET event = 'view' WHERE event = 'property_view'
    `);
    await queryInterface.sequelize.query(`
      UPDATE analytics SET event = 'share' WHERE event = 'property_share'
    `);
  },
};
