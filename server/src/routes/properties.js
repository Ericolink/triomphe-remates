const router = require('express').Router();
const {
  getProperties, getPropertyById, getPropertyBySlug,
  createProperty, updateProperty, deleteProperty,
  uploadImages, deleteImage, setCoverImage,
} = require('../controllers/propertyController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const upload = require('../middleware/uploadMiddleware');

/**
 * @swagger
 * tags:
 *   name: Properties
 *   description: Gestión de propiedades
 */

// Rutas públicas
/**
 * @swagger
 * /api/properties:
 *   get:
 *     summary: Listar propiedades con filtros y paginación
 *     tags: [Properties]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 12 }
 *       - in: query
 *         name: city
 *         schema: { type: string, enum: [juarez, chihuahua, queretaro] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [casa, departamento, terreno, local, bodega] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [disponible, apartado, vendido] }
 *       - in: query
 *         name: minPrice
 *         schema: { type: number }
 *       - in: query
 *         name: maxPrice
 *         schema: { type: number }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Lista de propiedades paginada }
 */
router.get('/', getProperties);

/**
 * @swagger
 * /api/properties/slug/{slug}:
 *   get:
 *     summary: Obtener propiedad por slug (SEO)
 *     tags: [Properties]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Propiedad encontrada }
 *       404: { description: No encontrada }
 */
router.get('/slug/:slug', getPropertyBySlug);

/**
 * @swagger
 * /api/properties/{id}:
 *   get:
 *     summary: Obtener propiedad por ID
 *     tags: [Properties]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Propiedad encontrada }
 *       404: { description: No encontrada }
 */
router.get('/:id', getPropertyById);

// Rutas protegidas — requieren autenticación
/**
 * @swagger
 * /api/properties:
 *   post:
 *     summary: Crear propiedad
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201: { description: Propiedad creada }
 *       401: { description: No autenticado }
 */
router.post('/', authenticate, authorize('admin', 'editor'), createProperty);

/**
 * @swagger
 * /api/properties/{id}:
 *   put:
 *     summary: Actualizar propiedad
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Propiedad actualizada }
 */
router.put('/:id', authenticate, authorize('admin', 'editor'), updateProperty);

/**
 * @swagger
 * /api/properties/{id}:
 *   delete:
 *     summary: Eliminar propiedad
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Propiedad eliminada }
 */
router.delete('/:id', authenticate, authorize('admin'), deleteProperty);

// Rutas de imágenes
/**
 * @swagger
 * /api/properties/{id}/images:
 *   post:
 *     summary: Subir imágenes a una propiedad
 *     tags: [Properties]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201: { description: Imágenes subidas }
 */
router.post('/:id/images', authenticate, authorize('admin', 'editor'), upload.array('images', 20), uploadImages);
router.delete('/:id/images/:imageId', authenticate, authorize('admin', 'editor'), deleteImage);
router.put('/:id/images/:imageId/cover', authenticate, authorize('admin', 'editor'), setCoverImage);

module.exports = router;
