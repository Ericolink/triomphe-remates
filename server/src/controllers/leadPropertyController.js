const { Lead, Property, LeadProperty } = require('../models/index');
const { logAudit } = require('../utils/audit');
const { canEditLead } = require('../utils/leadAccess');

// POST /api/leads/:id/properties — agrega una propiedad de interés adicional (además de la
// propiedad de origen en Lead.propertyId).
const addLeadProperty = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (!canEditLead(req.user, lead)) {
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }

    const { propertyId } = req.body;
    if (!propertyId) return res.status(400).json({ error: 'propertyId requerido' });

    const property = await Property.findByPk(propertyId);
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const [link] = await LeadProperty.findOrCreate({
      where: { leadId: lead.id, propertyId },
    });

    logAudit(req, 'update', 'lead', lead.id, { addedInterestedProperty: propertyId });

    return res.status(201).json({ data: link });
  } catch (error) {
    console.error('Error en addLeadProperty:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/leads/:id/properties/:propertyId
const removeLeadProperty = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (!canEditLead(req.user, lead)) {
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }

    const link = await LeadProperty.findOne({
      where: { leadId: req.params.id, propertyId: req.params.propertyId },
    });
    if (!link) return res.status(404).json({ error: 'Relación no encontrada' });

    await link.destroy();
    logAudit(req, 'update', 'lead', req.params.id, {
      removedInterestedProperty: req.params.propertyId,
    });

    return res.json({ message: 'Propiedad de interés eliminada' });
  } catch (error) {
    console.error('Error en removeLeadProperty:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { addLeadProperty, removeLeadProperty };
