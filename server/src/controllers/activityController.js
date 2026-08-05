const { Lead, Activity, User } = require('../models/index');
const { logAudit } = require('../utils/audit');
const { canViewLead } = require('../utils/leadAccess');
const { ApiError } = require('../middleware/errorHandler');

const VALID_ACTIVITY_TYPES = ['llamada', 'whatsapp', 'email', 'visita', 'nota'];

// GET /api/leads/:id/activities
const getLeadActivities = async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');
  if (!canViewLead(req.user, lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  const activities = await Activity.findAll({
    where: { leadId: req.params.id },
    include: [{ model: User, as: 'user', attributes: ['id', 'name'], required: false }],
    order: [['occurredAt', 'DESC']],
  });

  return res.json({ data: activities });
};

// POST /api/leads/:id/activities
const createLeadActivity = async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');
  if (!canViewLead(req.user, lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  const { type, content, occurredAt } = req.body;
  // 'sistema' está reservado para actividades autogeneradas (ver pipelineHelpers.logActivity)
  // — un humano no puede forjar una entrada de sistema.
  if (!type || !VALID_ACTIVITY_TYPES.includes(type)) {
    throw new ApiError(400, `Tipo inválido. Valores permitidos: ${VALID_ACTIVITY_TYPES.join(', ')}`);
  }
  if (!content || !content.trim()) throw new ApiError(400, 'Contenido requerido');

  const activity = await Activity.create({
    leadId: lead.id,
    type,
    content: content.trim(),
    userId: req.user?.id ?? null,
    occurredAt: occurredAt || new Date(),
  });

  logAudit(req, 'update', 'lead', lead.id, { addedActivity: activity.id });

  return res.status(201).json({ data: activity });
};

module.exports = { getLeadActivities, createLeadActivity };
