const { Op } = require('sequelize');
const { PropertyAlert } = require('../models/index');
const { sendPropertyAlertNotification } = require('./emailService');
const { sendPropertyAlertWhatsApp } = require('./whatsappService');
const logger = require('../utils/logger');

// AUDIT-005: lógica de matching de alertas extraída de propertyController para que
// createProperty y updateProperty la compartan — antes solo createProperty la invocaba,
// así que una propiedad reactivada vía edición nunca notificaba a los suscriptores.
const notifyMatchingAlerts = async (property) => {
  try {
    const alertWhere = { isActive: true };
    if (property.city) alertWhere[Op.or] = [{ city: null }, { city: property.city }];
    if (property.type) {
      const typeFilter = [{ type: null }, { type: property.type }];
      alertWhere[Op.or] = alertWhere[Op.or] ? alertWhere[Op.or].concat(typeFilter) : typeFilter;
    }

    const alerts = await PropertyAlert.findAll({ where: alertWhere });
    const parsedPrice = property.price ? parseFloat(property.price) : null;
    const matching = alerts.filter((a) => {
      if (a.city && a.city !== property.city) return false;
      if (a.type && a.type !== property.type) return false;
      if (a.businessLine && a.businessLine !== property.businessLine) return false;
      if (a.maxPrice && parsedPrice && parsedPrice > parseFloat(a.maxPrice)) return false;
      if (a.minPrice && parsedPrice && parsedPrice < parseFloat(a.minPrice)) return false;
      return true;
    });

    logger.info('Alertas coincidentes encontradas', {
      propertyId: property.id,
      city: property.city,
      type: property.type,
      matchCount: matching.length,
    });

    return matching;
  } catch (e) {
    logger.error('Error buscando alertas coincidentes', {
      propertyId: property.id,
      error: e.message,
    });
    return [];
  }
};

// AUDIT-011: envío en lotes con concurrencia limitada (sin dependencia externa) para no
// disparar 2N llamadas HTTP simultáneas a Gmail/Meta cuando hay muchas alertas coincidentes.
const CONCURRENCY_LIMIT = 5;

const sendAlertBatch = async (matching, property) => {
  for (let i = 0; i < matching.length; i += CONCURRENCY_LIMIT) {
    const batch = matching.slice(i, i + CONCURRENCY_LIMIT);
    await Promise.allSettled(
      batch.flatMap((a) => {
        // El email dejó de ser obligatorio (ver PropertyAlert.js) — una entrada de lista de
        // espera capturada por staff puede no tener uno.
        const tasks = [];
        if (a.email) {
          tasks.push(
            sendPropertyAlertNotification(a, property).catch((e) =>
              logger.error('Error enviando alerta de propiedad por email', {
                alertId: a.id,
                propertyId: property.id,
                error: e.message,
              })
            )
          );
        }
        if (a.phone) {
          tasks.push(
            sendPropertyAlertWhatsApp(a, property).catch((e) =>
              logger.error('Error enviando WhatsApp de alerta', {
                alertId: a.id,
                propertyId: property.id,
                error: e.message,
              })
            )
          );
        }
        return tasks;
      })
    );
  }
};

// Punto de entrada único: buscar alertas coincidentes y notificarlas, sin bloquear al caller.
const notifyAndSend = (property) => {
  notifyMatchingAlerts(property)
    .then((matching) => sendAlertBatch(matching, property))
    .catch((e) =>
      logger.error('Error en notifyAndSend de alertas', {
        propertyId: property.id,
        error: e.message,
      })
    );
};

module.exports = { notifyMatchingAlerts, sendAlertBatch, notifyAndSend };
