const router = require('express').Router();
const { createLead, getLeads, getLeadById, updateLead, deleteLead } = require('../controllers/leadController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: Gestión de contactos y citas
 */

/**
 * @swagger
 * /api/leads:
 *   post:
 *     summary: Crear lead desde el sitio público
 *     tags: [Leads]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               phone: { type: string }
 *               message: { type: string }
 *               type: { type: string, enum: [contacto, cita, informacion] }
 *               propertyId: { type: integer }
 *               appointmentDate: { type: string, format: date-time }
 *     responses:
 *       201: { description: Lead creado exitosamente }
 *       400: { description: Datos inválidos }
 */
router.post('/', createLead);

/**
 * @swagger
 * /api/leads:
 *   get:
 *     summary: Listar leads (solo admin/editor)
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [nuevo, contactado, cerrado, descartado] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [contacto, cita, informacion] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200: { description: Lista de leads }
 */
router.get('/', authenticate, authorize('admin', 'editor'), getLeads);

/**
 * @swagger
 * /api/leads/{id}:
 *   get:
 *     summary: Obtener lead por ID
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Lead encontrado }
 */
router.get('/:id', authenticate, authorize('admin', 'editor'), getLeadById);

/**
 * @swagger
 * /api/leads/{id}:
 *   put:
 *     summary: Actualizar status y notas de un lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Lead actualizado }
 */
router.put('/:id', authenticate, authorize('admin', 'editor'), updateLead);

/**
 * @swagger
 * /api/leads/{id}:
 *   delete:
 *     summary: Eliminar lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Lead eliminado }
 */
router.delete('/:id', authenticate, authorize('admin'), deleteLead);

module.exports = router;
