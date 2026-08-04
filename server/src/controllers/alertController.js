const { PropertyAlert } = require('../models/index');
const { validateEmail, validatePhone } = require('../utils/validators');
const { paginate } = require('../utils/pagination');
const { logAudit } = require('../utils/audit');
const { ApiError } = require('../middleware/errorHandler');

// POST /api/alerts
const subscribe = async (req, res) => {
  const { name, email, phone, city, type, maxPrice } = req.body;

  if (!name || !email) throw new ApiError(400, 'Nombre y email son requeridos');
  if (!validateEmail(email)) throw new ApiError(400, 'Email inválido');
  if (!validatePhone(phone))
    throw new ApiError(400, 'Teléfono inválido — usa 10 dígitos, con o sin +52');

  const existing = await PropertyAlert.findOne({
    where: { email: email.trim().toLowerCase(), isActive: true },
  });
  if (existing) {
    throw new ApiError(
      409,
      'Ya tienes una alerta activa con este email. Revisa tu bandeja de entrada para modificarla.'
    );
  }

  const alert = await PropertyAlert.create({
    name: name.trim(),
    email: email.trim().toLowerCase(),
    phone: phone?.trim() || null,
    city: city || null,
    type: type || null,
    maxPrice: maxPrice ? parseFloat(maxPrice) : null,
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

// GET /api/alerts  (admin)
const getAlerts = async (req, res) => {
  const { page = 1, limit = 30, isActive } = req.query;
  const where = {};
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
  const alert = await PropertyAlert.findByPk(req.params.id);
  if (!alert) throw new ApiError(404, 'Alerta no encontrada');
  await alert.destroy();
  logAudit(req, 'delete', 'alert', req.params.id, { email: alert.email });
  return res.json({ message: 'Alerta eliminada' });
};

module.exports = { subscribe, unsubscribe, getAlerts, deleteAlert };
