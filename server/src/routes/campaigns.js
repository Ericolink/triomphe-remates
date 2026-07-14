const router = require('express').Router();
const { createCampaign, getCampaigns, getCampaignById, updateCampaign, deleteCampaign } = require('../controllers/campaignController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { apiLimiter } = require('../middleware/rateLimitMiddleware');

/**
 * @swagger
 * tags:
 *   name: Campaigns
 *   description: Campañas publicitarias de origen (CRM Comercial)
 */

router.post('/',    apiLimiter, authenticate, authorize('admin', 'editor'), createCampaign);
router.get('/',     apiLimiter, authenticate, authorize('admin', 'editor'), getCampaigns);
router.get('/:id',  apiLimiter, authenticate, authorize('admin', 'editor'), getCampaignById);
router.put('/:id',  apiLimiter, authenticate, authorize('admin', 'editor'), updateCampaign);
router.delete('/:id', apiLimiter, authenticate, authorize('admin'), deleteCampaign);

module.exports = router;
