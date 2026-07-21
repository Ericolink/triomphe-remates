const { Feedback } = require('../models/index');
const { validateEmail } = require('../utils/validators');
const { sendFeedbackNotification } = require('../services/emailService');
const { paginate } = require('../utils/pagination');
const { logAudit } = require('../utils/audit');

const VALID_FEEDBACK_STATUS = ['nuevo', 'leido', 'archivado'];

// POST /api/feedback
const createFeedback = async (req, res) => {
  try {
    const { category, name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'Nombre, email, asunto y mensaje son requeridos' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    const validCategories = ['queja', 'comentario', 'sugerencia'];
    if (category && !validCategories.includes(category)) {
      return res.status(400).json({ error: 'Categoría inválida' });
    }

    const feedback = await Feedback.create({
      category: category || 'comentario',
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    });

    sendFeedbackNotification(feedback).catch((e) =>
      console.error('Error email notificación de feedback:', e)
    );

    return res.status(201).json({
      message: 'Tu mensaje fue recibido. Gracias por tu opinión.',
      data: { id: feedback.id },
    });
  } catch (error) {
    console.error('Error en createFeedback:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/feedback
const getFeedbacks = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category } = req.query;
    const where = {};

    if (status) where.status = status;
    if (category) where.category = category;

    const result = await paginate(Feedback, { page, limit, where, order: [['createdAt', 'DESC']] });

    return res.json(result);
  } catch (error) {
    console.error('Error en getFeedbacks:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/feedback/:id
const updateFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findByPk(req.params.id);
    if (!feedback) return res.status(404).json({ error: 'Feedback no encontrado' });

    if (req.body.status !== undefined && !VALID_FEEDBACK_STATUS.includes(req.body.status)) {
      return res.status(400).json({
        error: `Estatus inválido. Valores permitidos: ${VALID_FEEDBACK_STATUS.join(', ')}`,
      });
    }

    const updates = {};
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    await feedback.update(updates);
    logAudit(req, 'update', 'feedback', feedback.id, updates);
    return res.json({ message: 'Feedback actualizado', data: feedback });
  } catch (error) {
    console.error('Error en updateFeedback:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/feedback/:id
const deleteFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.findByPk(req.params.id);
    if (!feedback) return res.status(404).json({ error: 'Feedback no encontrado' });

    await feedback.destroy();
    logAudit(req, 'delete', 'feedback', req.params.id, { subject: feedback.subject });
    return res.json({ message: 'Feedback eliminado exitosamente' });
  } catch (error) {
    console.error('Error en deleteFeedback:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PATCH /api/feedback/batch
const batchUpdateFeedback = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: 'ids requeridos' });
    if (!status) return res.status(400).json({ error: 'status requerido' });
    if (!VALID_FEEDBACK_STATUS.includes(status)) {
      return res.status(400).json({
        error: `Estatus inválido. Valores permitidos: ${VALID_FEEDBACK_STATUS.join(', ')}`,
      });
    }
    await Feedback.update({ status }, { where: { id: ids } });
    logAudit(req, 'update', 'feedback', null, { ids, status });
    return res.json({ message: `${ids.length} mensaje(s) actualizados` });
  } catch (error) {
    console.error('Error en batchUpdateFeedback:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/feedback/batch
const batchDeleteFeedback = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ error: 'ids requeridos' });
    await Feedback.destroy({ where: { id: ids } });
    logAudit(req, 'delete', 'feedback', null, { ids });
    return res.json({ message: `${ids.length} mensaje(s) eliminados` });
  } catch (error) {
    console.error('Error en batchDeleteFeedback:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  createFeedback,
  getFeedbacks,
  updateFeedback,
  deleteFeedback,
  batchUpdateFeedback,
  batchDeleteFeedback,
};
