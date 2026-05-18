const router = require('express').Router();
const { exportExcel, exportPDF } = require('../controllers/exportController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

/**
 * @swagger
 * tags:
 *   name: Export
 *   description: Exportación de inventario
 */

/**
 * @swagger
 * /api/export/excel:
 *   get:
 *     summary: Exportar inventario a Excel
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: city
 *         schema: { type: string, enum: [juarez, chihuahua, queretaro] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Archivo Excel generado
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/excel', authenticate, authorize('admin', 'editor'), exportExcel);

/**
 * @swagger
 * /api/export/pdf:
 *   get:
 *     summary: Exportar inventario a PDF
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: city
 *         schema: { type: string, enum: [juarez, chihuahua, queretaro] }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Archivo PDF generado
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 */
router.get('/pdf', authenticate, authorize('admin', 'editor'), exportPDF);

module.exports = router;
