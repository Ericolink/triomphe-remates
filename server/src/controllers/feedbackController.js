const { Op } = require('sequelize');
const { Feedback } = require('../models/index');
const { validateEmail } = require('../utils/validators');
const { sendFeedbackNotification } = require('../services/emailService');
const { paginate } = require('../utils/pagination');
const { logAudit } = require('../utils/audit');
const { validateBatchIds } = require('../utils/batchValidation');
const { ApiError } = require('../middleware/errorHandler');

const VALID_FEEDBACK_STATUS = ['nuevo', 'leido'];

// POST /api/feedback
const createFeedback = async (req, res) => {
  const { category, name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    throw new ApiError(400, 'Nombre, email, asunto y mensaje son requeridos');
  }

  if (!validateEmail(email)) {
    throw new ApiError(400, 'Email inválido');
  }

  const validCategories = ['queja', 'comentario', 'sugerencia'];
  if (category && !validCategories.includes(category)) {
    throw new ApiError(400, 'Categoría inválida');
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
};

// GET /api/feedback
const getFeedbacks = async (req, res) => {
  const { page = 1, limit = 20, status, category, search } = req.query;
  const where = {};

  if (status) where.status = status;
  if (category) where.category = category;
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { subject: { [Op.like]: `%${search}%` } },
      { message: { [Op.like]: `%${search}%` } },
    ];
  }

  const result = await paginate(Feedback, { page, limit, where, order: [['createdAt', 'DESC']] });

  return res.json(result);
};

// PUT /api/feedback/:id
const updateFeedback = async (req, res) => {
  const feedback = await Feedback.findByPk(req.params.id);
  if (!feedback) throw new ApiError(404, 'Feedback no encontrado');

  if (req.body.status !== undefined && !VALID_FEEDBACK_STATUS.includes(req.body.status)) {
    throw new ApiError(
      400,
      `Estatus inválido. Valores permitidos: ${VALID_FEEDBACK_STATUS.join(', ')}`
    );
  }

  const updates = {};
  if (req.body.status !== undefined) updates.status = req.body.status;
  if (req.body.notes !== undefined) updates.notes = req.body.notes;

  await feedback.update(updates);
  logAudit(req, 'update', 'feedback', feedback.id, updates);
  return res.json({ message: 'Feedback actualizado', data: feedback });
};

// DELETE /api/feedback/:id
const deleteFeedback = async (req, res) => {
  const feedback = await Feedback.findByPk(req.params.id);
  if (!feedback) throw new ApiError(404, 'Feedback no encontrado');

  await feedback.destroy();
  logAudit(req, 'delete', 'feedback', req.params.id, { subject: feedback.subject });
  return res.json({ message: 'Feedback eliminado exitosamente' });
};

// PATCH /api/feedback/batch
const batchUpdateFeedback = async (req, res) => {
  const { status } = req.body;
  const { error: idsError, ids } = validateBatchIds(req.body.ids);
  if (idsError) throw new ApiError(400, idsError);
  if (!status) throw new ApiError(400, 'status requerido');
  if (!VALID_FEEDBACK_STATUS.includes(status)) {
    throw new ApiError(
      400,
      `Estatus inválido. Valores permitidos: ${VALID_FEEDBACK_STATUS.join(', ')}`
    );
  }
  await Feedback.update({ status }, { where: { id: ids } });
  logAudit(req, 'update', 'feedback', null, { ids, status });
  return res.json({ message: `${ids.length} mensaje(s) actualizados` });
};

// DELETE /api/feedback/batch
const batchDeleteFeedback = async (req, res) => {
  const { error: idsError, ids } = validateBatchIds(req.body.ids);
  if (idsError) throw new ApiError(400, idsError);
  await Feedback.destroy({ where: { id: ids } });
  logAudit(req, 'delete', 'feedback', null, { ids });
  return res.json({ message: `${ids.length} mensaje(s) eliminados` });
};

module.exports = {
  createFeedback,
  getFeedbacks,
  updateFeedback,
  deleteFeedback,
  batchUpdateFeedback,
  batchDeleteFeedback,
};
