const { Feedback } = require('../models/index');
const { validateEmail } = require('../utils/validators');
const { sendFeedbackNotification } = require('../services/emailService');

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

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Feedback.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return res.json({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
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

    const updates = {};
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    await feedback.update(updates);
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
    return res.json({ message: 'Feedback eliminado exitosamente' });
  } catch (error) {
    console.error('Error en deleteFeedback:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { createFeedback, getFeedbacks, updateFeedback, deleteFeedback };
