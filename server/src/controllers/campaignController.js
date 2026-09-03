const { Campaign, Lead, Deal } = require('../models/index');
const { fn, col } = require('sequelize');
const { logAudit, snapshotFields, buildChanges } = require('../utils/audit');
const { paginate } = require('../utils/pagination');
const { ApiError } = require('../middleware/errorHandler');

const VALID_PLATFORMS = ['facebook', 'google', 'instagram', 'tiktok', 'otro'];

// POST /api/campaigns
const createCampaign = async (req, res) => {
  const { platform, name, startDate, endDate, budget } = req.body;

  if (!platform || !name || !startDate) {
    throw new ApiError(400, 'Plataforma, nombre y fecha de inicio son requeridos');
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    throw new ApiError(400, `Plataforma inválida. Valores permitidos: ${VALID_PLATFORMS.join(', ')}`);
  }

  const campaign = await Campaign.create({
    platform,
    name,
    startDate,
    endDate: endDate || null,
    budget: budget ?? null,
  });

  logAudit(req, 'create', 'campaign', campaign.id);

  return res.status(201).json({ message: 'Campaña creada exitosamente', data: campaign });
};

// GET /api/campaigns
const getCampaigns = async (req, res) => {
  const { page = 1, limit = 20, platform } = req.query;
  const where = {};
  if (platform) where.platform = platform;

  const result = await paginate(Campaign, {
    page,
    limit,
    where,
    order: [['startDate', 'DESC']],
  });

  return res.json(result);
};

// GET /api/campaigns/:id — incluye métricas calculadas al vuelo, nunca almacenadas
const getCampaignById = async (req, res) => {
  const campaign = await Campaign.findByPk(req.params.id);
  if (!campaign) throw new ApiError(404, 'Campaña no encontrada');

  const leadCount = await Lead.count({ where: { campaignId: campaign.id } });

  const dealsRaw = await Deal.findAll({
    include: [
      {
        model: Lead,
        as: 'lead',
        attributes: [],
        where: { campaignId: campaign.id },
        required: true,
      },
    ],
    attributes: [
      [fn('COUNT', col('Deal.id')), 'dealCount'],
      [fn('SUM', col('amount')), 'revenue'],
    ],
    raw: true,
  });
  const dealCount = parseInt(dealsRaw[0]?.dealCount || 0, 10);
  const revenue = parseFloat(dealsRaw[0]?.revenue || 0);

  return res.json({
    data: {
      ...campaign.toJSON(),
      metrics: { leadCount, dealCount, revenue },
    },
  });
};

// PUT /api/campaigns/:id
const updateCampaign = async (req, res) => {
  const campaign = await Campaign.findByPk(req.params.id);
  if (!campaign) throw new ApiError(404, 'Campaña no encontrada');

  const { platform, name, startDate, endDate, budget } = req.body;
  if (platform !== undefined && !VALID_PLATFORMS.includes(platform)) {
    throw new ApiError(400, `Plataforma inválida. Valores permitidos: ${VALID_PLATFORMS.join(', ')}`);
  }

  const updates = {};
  if (platform !== undefined) updates.platform = platform;
  if (name !== undefined) updates.name = name;
  if (startDate !== undefined) updates.startDate = startDate;
  if (endDate !== undefined) updates.endDate = endDate;
  if (budget !== undefined) updates.budget = budget;
  const beforeSnapshot = snapshotFields(campaign, Object.keys(updates));
  await campaign.update(updates);

  logAudit(req, 'update', 'campaign', campaign.id, { changes: buildChanges(beforeSnapshot, campaign) });

  return res.json({ message: 'Campaña actualizada exitosamente', data: campaign });
};

// DELETE /api/campaigns/:id — Lead.campaignId es SET NULL, no hay riesgo de cascada
const deleteCampaign = async (req, res) => {
  const campaign = await Campaign.findByPk(req.params.id);
  if (!campaign) throw new ApiError(404, 'Campaña no encontrada');

  await campaign.destroy();
  logAudit(req, 'delete', 'campaign', req.params.id);

  return res.json({ message: 'Campaña eliminada exitosamente' });
};

module.exports = { createCampaign, getCampaigns, getCampaignById, updateCampaign, deleteCampaign };
