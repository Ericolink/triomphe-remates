require('dotenv').config();
const { CITY_LABEL } = require('../utils/labels');

const API_VERSION = 'v21.0';

const isConfigured = () => Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

// AUDIT-006: defensivo ante null/undefined/no-string — antes un phone inválido lanzaba
// TypeError dentro de sendTemplateMessage, lo que en sendLeadFollowUpWhatsApp se perdía
// en el catch genérico junto con el audit log (ver AUDIT-009).
const toE164 = (phone) => {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Número de teléfono inválido o ausente');
  }
  const digits = phone.replace(/[^\d+]/g, '');
  return digits.startsWith('+') ? digits : `+52${digits}`;
};

const sendTemplateMessage = async (to, templateName, components) => {
  if (!isConfigured()) {
    console.warn(`WhatsApp no configurado, mensaje "${templateName}" no enviado a ${to}`);
    return;
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: toE164(to),
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'es_MX' },
        components: [{ type: 'body', parameters: components.map((text) => ({ type: 'text', text: String(text) })) }],
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error de WhatsApp API (${response.status}): ${error}`);
  }
};

const sendPropertyAlertWhatsApp = async (alert, property) => {
  const formatPrice = (p) =>
    p ? new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(p) : 'Consultar';
  const propertyUrl = `${process.env.CLIENT_URL}/propiedades/${property.slug}`;
  const templateName = process.env.WHATSAPP_TEMPLATE_ALERT || 'alerta_propiedad';

  return sendTemplateMessage(alert.phone, templateName, [
    alert.name,
    CITY_LABEL[property.city] || property.city,
    property.title,
    formatPrice(property.price),
    propertyUrl,
  ]);
};

const sendLeadFollowUpWhatsApp = async (phone, leadName, agentName, message) => {
  const templateName = process.env.WHATSAPP_TEMPLATE_FOLLOWUP || 'seguimiento_lead';
  return sendTemplateMessage(phone, templateName, [leadName, agentName, message]);
};

module.exports = { sendPropertyAlertWhatsApp, sendLeadFollowUpWhatsApp, isConfigured };
