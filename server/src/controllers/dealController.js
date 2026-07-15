const { Op } = require('sequelize');
const { Deal, Lead, Property, Image } = require('../models/index');

// `city` + portada van en ambos endpoints para la pantalla "Casos de éxito" (galería con
// miniatura por caso) — el resto de datos del prospecto (actividades, notas, citas) se
// resuelve en el frontend reutilizando /api/leads/:id/activities|notes|appointments, ya
// que un Deal siempre tiene un Lead asociado.
const propertyAttributes = ['id', 'title', 'city'];
const propertyInclude = {
  model: Property, as: 'property', attributes: propertyAttributes,
  include: [{ model: Image, as: 'images', attributes: ['id', 'url', 'isCover'] }],
};

// GET /api/deals — no hay create/update/delete directo: un Deal solo nace de
// leadController.closeLeadAsWon, para garantizar que nunca exista sin el cambio
// correspondiente de Lead.pipelineStage.
const getDeals = async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};
    if (from || to) {
      where.closedAt = {};
      if (from) where.closedAt[Op.gte] = new Date(from);
      if (to) where.closedAt[Op.lte] = new Date(to);
    }

    const deals = await Deal.findAll({
      where,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'assignedToUserId'] },
        propertyInclude,
      ],
      order: [['closedAt', 'DESC']],
    });

    return res.json({ data: deals });
  } catch (error) {
    console.error('Error en getDeals:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/deals/:id
const getDealById = async (req, res) => {
  try {
    const deal = await Deal.findByPk(req.params.id, {
      include: [
        { model: Lead, as: 'lead' },
        propertyInclude,
      ],
    });
    if (!deal) return res.status(404).json({ error: 'Venta no encontrada' });

    return res.json({ data: deal });
  } catch (error) {
    console.error('Error en getDealById:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = { getDeals, getDealById };
