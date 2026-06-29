const { PropertyAlert } = require('../models/index');
const { validateEmail, validatePhone } = require('../utils/validators');
const { paginate } = require('../utils/pagination');

// POST /api/alerts
const subscribe = async (req, res) => {
  try {
    const { name, email, phone, city, type, maxPrice } = req.body;

    if (!name || !email) return res.status(400).json({ error: 'Nombre y email son requeridos' });
    if (!validateEmail(email)) return res.status(400).json({ error: 'Email inválido' });
    if (!validatePhone(phone)) return res.status(400).json({ error: 'Teléfono inválido — usa 10 dígitos, con o sin +52' });

    const existing = await PropertyAlert.findOne({ where: { email: email.trim().toLowerCase(), isActive: true } });
    if (existing) {
      return res.status(409).json({ error: 'Ya tienes una alerta activa con este email. Revisa tu bandeja de entrada para modificarla.' });
    }

    const alert = await PropertyAlert.create({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      city: city || null,
      type: type || null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
    });

    return res.status(201).json({ message: 'Alerta activada. Te notificaremos cuando llegue una propiedad que coincida.', data: { id: alert.id } });
  } catch (error) {
    console.error('Error en subscribe:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/alerts/unsubscribe?token=xxx
const unsubscribe = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    const alert = await PropertyAlert.findOne({ where: { token } });
    if (!alert) return res.status(404).json({ error: 'Alerta no encontrada' });

    await alert.update({ isActive: false });
    return res.json({ message: 'Alerta cancelada exitosamente. Ya no recibirás notificaciones.' });
  } catch (error) {
    console.error('Error en unsubscribe:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/alerts  (admin)
const getAlerts = async (req, res) => {
  try {
    const { page = 1, limit = 30, isActive } = req.query;
    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const result = await paginate(PropertyAlert, { page, limit, where, order: [['createdAt', 'DESC']] });

    return res.json(result);
  } catch (error) {
    console.error('Error en getAlerts:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/alerts/:id  (admin)
const deleteAlert = async (req, res) => {
  try {
    const alert = await PropertyAlert.findByPk(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alerta no encontrada' });
    await alert.destroy();
    return res.json({ message: 'Alerta eliminada' });
  } catch (error) {
    console.error('Error en deleteAlert:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { subscribe, unsubscribe, getAlerts, deleteAlert };
