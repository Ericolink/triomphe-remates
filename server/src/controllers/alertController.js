const { PropertyAlert } = require('../models/index');
const { validateEmail, validatePhone } = require('../utils/validators');
const { VALID_CITIES, VALID_TYPES } = require('../utils/propertyAlertValidation');
const { paginate } = require('../utils/pagination');
const { logAudit } = require('../utils/audit');
const { ApiError } = require('../middleware/errorHandler');

// Campos de solo-criterios expuestos/editables vía token — mismo subconjunto que acepta el
// formulario público (subscribe): nunca incluye email/id/token/source, así que un token no
// sirve para reasignar a quién le llegan los correos ni para tocar entradas de la lista de
// espera (source:'staff') fuera de estos campos.
const alertCriteriaJSON = (alert) => ({
  name: alert.name,
  email: alert.email,
  phone: alert.phone,
  city: alert.city,
  type: alert.type,
  minPrice: alert.minPrice,
  maxPrice: alert.maxPrice,
  isActive: alert.isActive,
});

// POST /api/alerts
const subscribe = async (req, res) => {
  const { name, email, phone, city, type, minPrice, maxPrice } = req.body;

  if (!name || !email || !phone) {
    throw new ApiError(400, 'Nombre, email y teléfono son requeridos');
  }
  if (!validateEmail(email)) throw new ApiError(400, 'Email inválido');
  if (!validatePhone(phone))
    throw new ApiError(400, 'Teléfono inválido — usa 10 dígitos, con o sin +52');

  const attrs = {
    name: name.trim(),
    phone: phone.trim(),
    city: city || null,
    type: type || null,
    minPrice: minPrice ? parseFloat(minPrice) : null,
    maxPrice: maxPrice ? parseFloat(maxPrice) : null,
  };

  // Un mismo email puede volver a suscribirse con un rango/filtro distinto (p. ej.
  // cambió de idea sobre el precio) — en vez de rechazar el registro repetido con un
  // 409, la suscripción activa existente se actualiza con los datos nuevos. `token`
  // e `id` nunca se tocan: el link de baja ya enviado por correo con el token viejo
  // debe seguir funcionando después de esta actualización.
  // Acotado a source:'public' — un email que coincida con una entrada de la lista de
  // espera capturada por staff (source:'staff') nunca debe actualizarse desde acá.
  const existing = await PropertyAlert.findOne({
    where: { email: email.trim().toLowerCase(), isActive: true, source: 'public' },
  });

  if (existing) {
    await existing.update(attrs);
    return res.status(200).json({
      message: 'Tu alerta ya estaba activa — se actualizó con los nuevos datos.',
      data: { id: existing.id },
    });
  }

  const alert = await PropertyAlert.create({
    ...attrs,
    email: email.trim().toLowerCase(),
    source: 'public',
  });

  return res.status(201).json({
    message: 'Alerta activada. Te notificaremos cuando llegue una propiedad que coincida.',
    data: { id: alert.id },
  });
};

// GET /api/alerts/unsubscribe?token=xxx
const unsubscribe = async (req, res) => {
  const { token } = req.query;
  if (!token) throw new ApiError(400, 'Token requerido');

  const alert = await PropertyAlert.findOne({ where: { token } });
  if (!alert) throw new ApiError(404, 'Alerta no encontrada');

  await alert.update({ isActive: false });
  return res.json({ message: 'Alerta cancelada exitosamente. Ya no recibirás notificaciones.' });
};

// GET /api/alerts/manage?token=xxx — el cliente ve sus propios criterios sin iniciar sesión,
// usando el mismo token no-adivinable (256 bits) que ya autoriza /unsubscribe. Nunca revela si
// un email tiene o no una alerta a quien no trae el token — solo hay dos respuestas posibles:
// "encontrada" (200, para el dueño del token) o "no encontrada" (404, para cualquier otro).
const getAlertByToken = async (req, res) => {
  const { token } = req.query;
  if (!token) throw new ApiError(400, 'Token requerido');

  const alert = await PropertyAlert.findOne({ where: { token } });
  if (!alert) throw new ApiError(404, 'Alerta no encontrada');

  return res.json({ data: alertCriteriaJSON(alert) });
};

// PUT /api/alerts/manage?token=xxx — actualiza la alerta existente identificada por token
// (nunca crea una segunda). Una alerta ya cancelada no se puede editar: se le pide al cliente
// crear una nueva desde el sitio en vez de reactivar en silencio una que decidió apagar.
const updateAlertByToken = async (req, res) => {
  const { token } = req.query;
  if (!token) throw new ApiError(400, 'Token requerido');

  const alert = await PropertyAlert.findOne({ where: { token } });
  if (!alert) throw new ApiError(404, 'Alerta no encontrada');
  if (!alert.isActive) {
    throw new ApiError(409, 'Esta alerta ya no está activa', { code: 'ALERT_INACTIVE' });
  }

  const { name, phone, city, type, minPrice, maxPrice } = req.body;
  if (!name || !name.trim()) throw new ApiError(400, 'El nombre es requerido');
  if (!phone || !validatePhone(phone)) {
    throw new ApiError(400, 'Teléfono inválido — usa 10 dígitos, con o sin +52');
  }
  if (city && !VALID_CITIES.includes(city)) throw new ApiError(400, 'Ciudad inválida');
  if (type && !VALID_TYPES.includes(type)) throw new ApiError(400, 'Tipo inválido');

  await alert.update({
    name: name.trim(),
    phone: phone.trim(),
    city: city || null,
    type: type || null,
    minPrice: minPrice ? parseFloat(minPrice) : null,
    maxPrice: maxPrice ? parseFloat(maxPrice) : null,
  });

  return res.json({
    message: 'Tu alerta fue actualizada correctamente.',
    data: alertCriteriaJSON(alert),
  });
};

// GET /api/alerts  (admin) — solo suscripciones públicas del sitio; las entradas de la
// lista de espera (source:'staff') se administran aparte, ver waitingListController.js.
const getAlerts = async (req, res) => {
  const { page = 1, limit = 30, isActive } = req.query;
  const where = { source: 'public' };
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const result = await paginate(PropertyAlert, {
    page,
    limit,
    where,
    order: [['createdAt', 'DESC']],
  });

  return res.json(result);
};

// DELETE /api/alerts/:id  (admin)
const deleteAlert = async (req, res) => {
  const alert = await PropertyAlert.findOne({
    where: { id: req.params.id, source: 'public' },
  });
  if (!alert) throw new ApiError(404, 'Alerta no encontrada');
  await alert.destroy();
  logAudit(req, 'delete', 'alert', req.params.id, { email: alert.email });
  return res.json({ message: 'Alerta eliminada' });
};

module.exports = {
  subscribe,
  unsubscribe,
  getAlertByToken,
  updateAlertByToken,
  getAlerts,
  deleteAlert,
};
