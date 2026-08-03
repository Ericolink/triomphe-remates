const { Lead, Activity, User } = require('../models/index');
const { logAudit } = require('../utils/audit');
const { canViewLead } = require('../utils/leadAccess');

const VALID_ACTIVITY_TYPES = ['llamada', 'whatsapp', 'email', 'visita', 'nota'];

// GET /api/leads/:id/activities
const getLeadActivities = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (!canViewLead(req.user, lead)) {
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }

    const activities = await Activity.findAll({
      where: { leadId: req.params.id },
      include: [{ model: User, as: 'user', attributes: ['id', 'name'], required: false }],
      order: [['occurredAt', 'DESC']],
    });

    return res.json({ data: activities });
  } catch (error) {
    console.error('Error en getLeadActivities:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/leads/:id/activities
const createLeadActivity = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (!canViewLead(req.user, lead)) {
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }

    const { type, content, occurredAt } = req.body;
    // 'sistema' está reservado para actividades autogeneradas (ver pipelineHelpers.logActivity)
    // — un humano no puede forjar una entrada de sistema.
    if (!type || !VALID_ACTIVITY_TYPES.includes(type)) {
      return res
        .status(400)
        .json({ error: `Tipo inválido. Valores permitidos: ${VALID_ACTIVITY_TYPES.join(', ')}` });
    }
    if (!content || !content.trim()) return res.status(400).json({ error: 'Contenido requerido' });

    const activity = await Activity.create({
      leadId: lead.id,
      type,
      content: content.trim(),
      userId: req.user?.id ?? null,
      occurredAt: occurredAt || new Date(),
    });

    logAudit(req, 'update', 'lead', lead.id, { addedActivity: activity.id });

    return res.status(201).json({ data: activity });
  } catch (error) {
    console.error('Error en createLeadActivity:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getLeadActivities, createLeadActivity };
