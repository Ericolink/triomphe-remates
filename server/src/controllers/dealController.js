const { Op } = require('sequelize');
const { Deal, Lead, Property, Image } = require('../models/index');
const { paginate } = require('../utils/pagination');
const { getLeadVisibilityWhere, canViewLead } = require('../utils/leadAccess');
const { ApiError } = require('../middleware/errorHandler');

// `city` + portada van en ambos endpoints para la pantalla "Casos de éxito" (galería con
// miniatura por caso) — el resto de datos del prospecto (actividades, notas, citas) se
// resuelve en el frontend reutilizando /api/leads/:id/activities|notes|appointments, ya
// que un Deal siempre tiene un Lead asociado.
const propertyAttributes = ['id', 'title', 'city'];
const propertyInclude = {
  model: Property,
  as: 'property',
  attributes: propertyAttributes,
  include: [{ model: Image, as: 'images', attributes: ['id', 'url', 'isCover'] }],
};

// GET /api/deals — no hay create/update/delete directo: un Deal solo nace de
// leadController.closeLeadAsWon, para garantizar que nunca exista sin el cambio
// correspondiente de Lead.pipelineStage.
// AUDIT: `findAll` sin límite descargaba todo el historial de ventas en cada visita a
// "Casos de éxito" — paginado igual que el resto de listados (ver paginate()). `totalAmount`
// se agrega aparte (mismo `where`, sin paginar) para que el monto total mostrado en el
// header nunca sea una suma parcial de solo la página cargada.
const getDeals = async (req, res) => {
  const { from, to, search, page = 1, limit = 12 } = req.query;
  const where = {};
  if (from || to) {
    where.closedAt = {};
    if (from) where.closedAt[Op.gte] = new Date(from);
    if (to) where.closedAt[Op.lte] = new Date(to);
  }
  if (search) {
    where[Op.or] = [
      { '$lead.name$': { [Op.like]: `%${search}%` } },
      { '$property.title$': { [Op.like]: `%${search}%` } },
    ];
  }
  // CRM de Leads: cierra la fuga de "ver todas las ventas cerradas vía Casos de éxito".
  Object.assign(where, getLeadVisibilityWhere(req.user, { alias: 'lead' }) || {});

  const [result, totalAmount] = await Promise.all([
    paginate(Deal, {
      page,
      limit,
      where,
      include: [
        {
          model: Lead,
          as: 'lead',
          attributes: ['id', 'name', 'assignedToUserId', 'createdByUserId'],
        },
        propertyInclude,
      ],
      order: [['closedAt', 'DESC']],
      subQuery: false,
    }),
    Deal.sum('amount', {
      where,
      include: [
        { model: Lead, as: 'lead', attributes: [] },
        { model: Property, as: 'property', attributes: [] },
      ],
    }),
  ]);

  return res.json({ ...result, totalAmount: totalAmount || 0 });
};

// GET /api/deals/:id
const getDealById = async (req, res) => {
  const deal = await Deal.findByPk(req.params.id, {
    include: [{ model: Lead, as: 'lead' }, propertyInclude],
  });
  if (!deal) throw new ApiError(404, 'Venta no encontrada');
  if (!canViewLead(req.user, deal.lead)) {
    throw new ApiError(403, 'No tienes acceso a esta venta');
  }

  return res.json({ data: deal });
};

module.exports = { getDeals, getDealById };
