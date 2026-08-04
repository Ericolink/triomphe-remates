const { Lead, Property, LeadProperty } = require('../models/index');
const { logAudit } = require('../utils/audit');
const { canEditLead } = require('../utils/leadAccess');
const { ApiError } = require('../middleware/errorHandler');

// POST /api/leads/:id/properties — agrega una propiedad de interés adicional (además de la
// propiedad de origen en Lead.propertyId).
const addLeadProperty = async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');
  if (!canEditLead(req.user, lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  const { propertyId } = req.body;
  if (!propertyId) throw new ApiError(400, 'propertyId requerido');

  const property = await Property.findByPk(propertyId);
  if (!property) throw new ApiError(404, 'Propiedad no encontrada');

  const [link] = await LeadProperty.findOrCreate({
    where: { leadId: lead.id, propertyId },
  });

  logAudit(req, 'update', 'lead', lead.id, { addedInterestedProperty: propertyId });

  return res.status(201).json({ data: link });
};

// DELETE /api/leads/:id/properties/:propertyId
const removeLeadProperty = async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');
  if (!canEditLead(req.user, lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  const link = await LeadProperty.findOne({
    where: { leadId: req.params.id, propertyId: req.params.propertyId },
  });
  if (!link) throw new ApiError(404, 'Relación no encontrada');

  await link.destroy();
  logAudit(req, 'update', 'lead', req.params.id, {
    removedInterestedProperty: req.params.propertyId,
  });

  return res.json({ message: 'Propiedad de interés eliminada' });
};

module.exports = { addLeadProperty, removeLeadProperty };
