const { Lead, Property } = require('../models/index');
const { validateEmail } = require('../utils/validators');
const { sendNewLeadNotification, sendLeadConfirmation } = require('../services/emailService');

// POST /api/leads
const createLead = async (req, res) => {
  try {
    const { name, email, phone, message, type, propertyId, appointmentDate } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    let property = null;
    if (propertyId) {
      property = await Property.findByPk(propertyId);
      if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    const lead = await Lead.create({
      name, email, phone, message,
      type: type || 'contacto',
      propertyId: propertyId || null,
      appointmentDate: appointmentDate || null,
    });

    Promise.all([
      sendNewLeadNotification(lead, property).catch((e) => console.error('Error email notificación:', e)),
      sendLeadConfirmation(lead).catch((e) => console.error('Error email confirmación:', e)),
    ]);

    return res.status(201).json({
      message: 'Mensaje enviado exitosamente. Un asesor se pondrá en contacto contigo pronto.',
      data: { id: lead.id },
    });
  } catch (error) {
    console.error('Error en createLead:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/leads
const getLeads = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, type, propertyId } = req.query;
    const where = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (propertyId) where.propertyId = propertyId;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Lead.findAndCountAll({
      where,
      include: [{
        model: Property,
        as: 'property',
        attributes: ['id', 'title', 'city', 'slug'],
        required: false,
      }],
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
    console.error('Error en getLeads:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/leads/:id
const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [{
        model: Property,
        as: 'property',
        attributes: ['id', 'title', 'city', 'slug'],
      }],
    });

    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    return res.json({ data: lead });
  } catch (error) {
    console.error('Error en getLeadById:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/leads/:id
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const { status, notes, appointmentDate } = req.body;
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (appointmentDate !== undefined) updates.appointmentDate = appointmentDate;
    await lead.update(updates);

    return res.json({ message: 'Lead actualizado exitosamente', data: lead });
  } catch (error) {
    console.error('Error en updateLead:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/leads/:id
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    await lead.destroy();
    return res.json({ message: 'Lead eliminado exitosamente' });
  } catch (error) {
    console.error('Error en deleteLead:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PATCH /api/leads/batch
const batchUpdateLeads = async (req, res) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids requeridos' });
    if (!status) return res.status(400).json({ error: 'status requerido' });
    await Lead.update({ status }, { where: { id: ids } });
    return res.json({ message: `${ids.length} lead(s) actualizados` });
  } catch (error) {
    console.error('Error en batchUpdateLeads:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/leads/batch
const batchDeleteLeads = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids requeridos' });
    await Lead.destroy({ where: { id: ids } });
    return res.json({ message: `${ids.length} lead(s) eliminados` });
  } catch (error) {
    console.error('Error en batchDeleteLeads:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { createLead, getLeads, getLeadById, updateLead, deleteLead, batchUpdateLeads, batchDeleteLeads };
