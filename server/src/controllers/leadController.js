const { Lead, LeadNote, Property, Analytics } = require('../models/index');
const { validateEmail, validatePhone } = require('../utils/validators');
const { sendNewLeadNotification, sendLeadConfirmation } = require('../services/emailService');
const { sendLeadFollowUpWhatsApp, isConfigured: isWhatsappConfigured } = require('../services/whatsappService');
const { logAudit } = require('../utils/audit');
const leadEvents = require('../utils/leadEvents');
const { paginate } = require('../utils/pagination');
const logger = require('../utils/logger');

// POST /api/leads
const createLead = async (req, res) => {
  try {
    const { name, email, phone, message, type, propertyId, appointmentDate, source } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Teléfono inválido — usa 10 dígitos, con o sin +52' });
    }

    let property = null;
    if (propertyId) {
      property = await Property.findByPk(propertyId);
      if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    const lead = await Lead.create({
      name, email, phone, message,
      type: type || 'contacto',
      source: source || 'directo',
      propertyId: propertyId || null,
      appointmentDate: appointmentDate || null,
    });

    Promise.all([
      sendNewLeadNotification(lead, property).catch((e) => console.error('Error email notificación:', e)),
      sendLeadConfirmation(lead).catch((e) => console.error('Error email confirmación:', e)),
    ]);

    if (property) {
      Analytics.create({
        event: 'contact',
        propertyId: property.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'] || null,
      }).catch((e) => console.error('Error registrando analytics contact:', e));
    }

    leadEvents.emit('new-lead', {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      type: lead.type,
      status: lead.status,
      createdAt: lead.createdAt,
      property: property ? { id: property.id, title: property.title } : null,
    });

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
    const { page = 1, limit = 20, status, type, propertyId, source } = req.query;
    const where = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (source) where.source = source;
    if (propertyId) where.propertyId = propertyId;

    const result = await paginate(Lead, {
      page,
      limit,
      where,
      include: [{
        model: Property,
        as: 'property',
        attributes: ['id', 'title', 'city', 'slug'],
        required: false,
      }],
      order: [['createdAt', 'DESC']],
    });

    return res.json(result);
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

    const { status, notes, appointmentDate, source } = req.body;
    const updates = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (appointmentDate !== undefined) updates.appointmentDate = appointmentDate;
    if (source !== undefined) updates.source = source;
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

const SSE_ALLOWED_ORIGINS = new Set(
  [process.env.CLIENT_URL, 'http://localhost:5173'].filter(Boolean)
);

// GET /api/leads/stream — notificaciones en tiempo real vía Server-Sent Events
const streamLeads = (req, res) => {
  // CORS headers must be set explicitly here — the cors() middleware may not flush
  // them before flushHeaders() is called for long-lived SSE connections.
  // Only reflect the origin if it's in the whitelist to prevent credential leaks.
  const origin = req.headers.origin;
  if (origin && SSE_ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(': conectado\n\n');

  const onNewLead = (lead) => {
    res.write(`event: new-lead\ndata: ${JSON.stringify(lead)}\n\n`);
  };
  leadEvents.on('new-lead', onNewLead);

  // Mantiene viva la conexión a través de proxies/balanceadores
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    leadEvents.off('new-lead', onNewLead);
  });
};

// GET /api/leads/:id/notes
const getLeadNotes = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const notes = await LeadNote.findAll({
      where: { leadId: req.params.id },
      order: [['createdAt', 'DESC']],
    });

    return res.json({ data: notes });
  } catch (error) {
    console.error('Error en getLeadNotes:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/leads/:id/notes
const addLeadNote = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Contenido requerido' });

    const note = await LeadNote.create({
      leadId: lead.id,
      content: content.trim(),
      authorName: req.user?.name || null,
    });

    return res.status(201).json({ data: note });
  } catch (error) {
    console.error('Error en addLeadNote:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/leads/:id/notes/:noteId
const deleteLeadNote = async (req, res) => {
  try {
    const note = await LeadNote.findOne({
      where: { id: req.params.noteId, leadId: req.params.id },
    });
    if (!note) return res.status(404).json({ error: 'Nota no encontrada' });

    await note.destroy();
    return res.json({ message: 'Nota eliminada' });
  } catch (error) {
    console.error('Error en deleteLeadNote:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/leads/:id/whatsapp
const sendLeadWhatsApp = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Mensaje requerido' });
    if (!lead.phone) return res.status(400).json({ error: 'Este lead no tiene un teléfono registrado' });

    const agentName = req.user?.name || 'Triomphe Bienes Raíces';
    let warning = null;
    let sendError = null;

    if (!isWhatsappConfigured()) {
      warning = 'WhatsApp no está configurado en el servidor; se guardó la nota de seguimiento pero el mensaje no se envió.';
    } else {
      // AUDIT-009: antes, si esto lanzaba (token expirado, plantilla no aprobada, teléfono
      // inválido), el catch exterior se saltaba la creación de LeadNote y el audit log,
      // perdiendo todo rastro de que se intentó el contacto.
      try {
        await sendLeadFollowUpWhatsApp(lead.phone, lead.name, agentName, message.trim());
      } catch (whatsappError) {
        sendError = whatsappError;
        logger.error('Error enviando WhatsApp de seguimiento', { leadId: lead.id, error: whatsappError.message });
        warning = 'No se pudo enviar el mensaje de WhatsApp (revisa el teléfono o la configuración del servicio). Se guardó el intento en el seguimiento.';
      }
    }

    const note = await LeadNote.create({
      leadId: lead.id,
      content: sendError
        ? `WhatsApp NO enviado (falló el envío): ${message.trim()}`
        : `WhatsApp enviado: ${message.trim()}`,
      authorName: req.user?.name || null,
    });

    logAudit(req, 'update', 'lead', lead.id, { whatsapp: true, success: !sendError, error: sendError?.message || null });

    return res.json({ message: warning || 'Mensaje de WhatsApp enviado', data: note, warning });
  } catch (error) {
    console.error('Error en sendLeadWhatsApp:', error);
    return res.status(500).json({ error: 'Error al enviar el mensaje de WhatsApp' });
  }
};

module.exports = { createLead, getLeads, getLeadById, updateLead, deleteLead, batchUpdateLeads, batchDeleteLeads, streamLeads, getLeadNotes, addLeadNote, deleteLeadNote, sendLeadWhatsApp };
