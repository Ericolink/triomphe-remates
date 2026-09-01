const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

// Fase 1 de analítica de tráfico propia — ver migración 20260903000002-extend-analytics-events
// para el porqué de cada columna. `ip`/`userAgent`/`referrer` se conservan solo por las filas
// históricas que ya los tienen (creadas antes de esta fase, con event='view'/'share') — el
// código nuevo (analyticsService.recordEvent) ya no escribe ahí; usa `visitorId`/`sessionId`
// para identidad anónima y `referrerHost` para atribución, nunca la IP ni la URL completa.
const Analytics = sequelize.define(
  'Analytics',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    event: {
      // 'contact'/'download' son legacy — ver migración 20260903000002: hay filas
      // históricas reales con event='contact', así que se conservan en el ENUM aunque
      // ningún código nuevo los escriba (analyticsService.ALLOWED_EVENTS no los incluye).
      type: DataTypes.ENUM(
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
    },
    // Deprecadas — ver comentario de arriba. Se dejan `allowNull` para no romper las filas
    // nuevas, que ya no las llenan.
    ip: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    referrer: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    visitorId: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: 'UUID anónimo del visitante (localStorage del cliente) — no es información personal.',
    },
    sessionId: {
      type: DataTypes.CHAR(36),
      allowNull: true,
      comment: 'UUID de sesión — se rota tras 30 min de inactividad (ver analytics.js del cliente).',
    },
    path: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Ruta pública donde ocurrió el evento, ej. /propiedades/casa-polanco.',
    },
    referrerHost: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Solo el host del referrer (ej. "google.com") — nunca la URL completa.',
    },
    utmSource: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    utmMedium: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    utmCampaign: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    utmContent: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    device: {
      type: DataTypes.ENUM('desktop', 'mobile', 'tablet', 'unknown'),
      allowNull: true,
      comment: 'Resuelto en el servidor a partir del User-Agent — nunca lo manda el cliente.',
    },
    browser: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    os: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    isBot: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Marcado (no descartado) cuando el User-Agent coincide con un bot conocido.',
    },
  },
  {
    tableName: 'analytics',
    timestamps: true,
    // Declarados también aquí (no solo en la migración) — idioma ya usado en Campaign.js:
    // sin esto, una base de datos bootstrapeada desde cero vía sync() (ver
    // checkPendingMigrations.js) quedaría sin estos índices.
    indexes: [
      { fields: ['event', 'createdAt'], name: 'idx_analytics_event_created' },
      {
        fields: ['propertyId', 'event', 'createdAt'],
        name: 'idx_analytics_property_event_created',
      },
      { fields: ['sessionId'], name: 'idx_analytics_session' },
      { fields: ['visitorId'], name: 'idx_analytics_visitor' },
    ],
  }
);

module.exports = Analytics;
