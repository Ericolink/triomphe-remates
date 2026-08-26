const router = require('express').Router();
const {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
} = require('../controllers/campaignController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Campaigns
 *   description: Campañas publicitarias de origen (CRM Comercial)
 */

// Campañas vive dentro del CRM Comercial (tab dentro de CrmPage) pero es un módulo
// aparte de leads: Coordinador de ventas y Asesor de ventas no tienen acceso aunque sí
// tengan CRM de leads (Asesor) o ninguno (Coordinador) — solo Admin y Asistente
// administrativo, que es quien pidió explícitamente poder "modificar campañas".
router.post('/', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), createCampaign);
router.get('/', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), getCampaigns);
router.get('/:id', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), getCampaignById);
router.put('/:id', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), updateCampaign);
router.delete('/:id', apiLimiter, authenticate, authorize('admin', 'asistente_administrativo'), deleteCampaign);

module.exports = router;
