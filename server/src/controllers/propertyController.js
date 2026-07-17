const { Op, fn, col } = require('sequelize');
const { cloudinary } = require('../config/cloudinary');
const { sequelize, Property, Image, Analytics, PropertyStatusHistory } = require('../models/index');
const { generateSlug } = require('../utils/helpers');
const alertService = require('../services/alertService');
const { isValidImageBuffer } = require('../utils/fileSignature');
const { paginate } = require('../utils/pagination');
const { logAudit } = require('../utils/audit');
const logger = require('../utils/logger');

// Convierte string vacío a null para campos numéricos
const nullIfEmpty = (val) => (val === '' || val === undefined) ? null : val;

// GET /api/properties
const getProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      city,
      type,
      status,
      minPrice,
      maxPrice,
      minTerrainM2,
      maxTerrainM2,
      minConstructionM2,
      maxConstructionM2,
      minBedrooms,
      minBathrooms,
      featured,
      search,
    } = req.query;

    const where = {};

    if (city) where.city = city;
    if (type) where.type = type;
    if (status) where.status = status;
    else where.status = { [Op.ne]: 'vendido' };
    if (featured) where.isFeatured = featured === 'true';

    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
      if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
    }

    if (minTerrainM2 || maxTerrainM2) {
      where.terrainMeters = {};
      if (minTerrainM2) where.terrainMeters[Op.gte] = parseFloat(minTerrainM2);
      if (maxTerrainM2) where.terrainMeters[Op.lte] = parseFloat(maxTerrainM2);
    }

    if (minConstructionM2 || maxConstructionM2) {
      where.constructionMeters = {};
      if (minConstructionM2) where.constructionMeters[Op.gte] = parseFloat(minConstructionM2);
      if (maxConstructionM2) where.constructionMeters[Op.lte] = parseFloat(maxConstructionM2);
    }

    const andConditions = [];

    if (minBedrooms) where.bedrooms = { [Op.gte]: parseInt(minBedrooms) };
    if (minBathrooms) where.bathrooms = { [Op.gte]: parseInt(minBathrooms) };

    if (search) {
      andConditions.push({
        [Op.or]: [
          { title:       { [Op.like]: `%${search}%` } },
          { address:     { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
        ],
      });
    }

    if (andConditions.length > 0) where[Op.and] = andConditions;

    const result = await paginate(Property, {
      page,
      limit,
      where,
      attributes: { exclude: ['internalNotes'] },
      include: [{ model: Image, as: 'images', where: { isCover: true }, required: false }],
      order: [['isFeatured', 'DESC'], ['createdAt', 'DESC']],
    });

    return res.json(result);
  } catch (error) {
    console.error('Error en getProperties:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/properties/stats
const getPropertyStats = async (req, res) => {
  try {
    const where = { status: { [Op.ne]: 'vendido' } };

    const total = await Property.count({ where });
    const byCityRaw = await Property.findAll({
      where,
      attributes: ['city', [fn('COUNT', col('id')), 'total']],
      group: ['city'],
      raw: true,
    });

    const byCity = { juarez: 0, chihuahua: 0, queretaro: 0 };
    byCityRaw.forEach((row) => { byCity[row.city] = parseInt(row.total); });

    return res.json({ total, byCity });
  } catch (error) {
    console.error('Error en getPropertyStats:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/properties/:id
const getPropertyById = async (req, res) => {
  try {
    const isStaff = req.user && ['admin', 'editor'].includes(req.user.role);
    const property = await Property.findByPk(req.params.id, {
      attributes: isStaff ? undefined : { exclude: ['internalNotes'] },
      include: [{ model: Image, as: 'images', separate: true, order: [['order', 'ASC']] }],
    });

    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    // Registrar visita
    await Analytics.create({
      event: 'view',
      propertyId: property.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer'] || null,
    });

    await property.increment('views');

    return res.json({ data: property });
  } catch (error) {
    console.error('Error en getPropertyById:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/properties/slug/:slug
const getPropertyBySlug = async (req, res) => {
  try {
    const property = await Property.findOne({
      where: { slug: req.params.slug },
      attributes: { exclude: ['internalNotes'] },
      include: [{ model: Image, as: 'images', separate: true, order: [['order', 'ASC']] }],
    });

    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    await Analytics.create({
      event: 'view',
      propertyId: property.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer'] || null,
    });

    await property.increment('views');

    return res.json({ data: property });
  } catch (error) {
    console.error('Error en getPropertyBySlug:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/properties
const createProperty = async (req, res) => {
  try {
    const {
      title, description, price, city, type,
      status, squareMeters, terrainMeters, constructionMeters, bedrooms, bathrooms,
      address, auctionDate, acquisitionStage, isFeatured, internalNotes, code,
    } = req.body;

    if (!title || !city || !type) {
      return res.status(400).json({ error: 'Título, precio, ciudad y tipo son requeridos' });
    }

    let slug = generateSlug(title);

    // Asegurar slug único
    const existing = await Property.findOne({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    // AUDIT-018: Property + su primer registro de historial deben crearse juntos —
    // sin transacción, un fallo en PropertyStatusHistory.create dejaba la propiedad
    // creada sin su historial inicial.
    const property = await sequelize.transaction(async (transaction) => {
      const created = await Property.create({
        title, description,
        price: nullIfEmpty(price),
        city, type,
        status: status || 'disponible',
        squareMeters: nullIfEmpty(squareMeters),
        terrainMeters: nullIfEmpty(terrainMeters),
        constructionMeters: nullIfEmpty(constructionMeters),
        bedrooms: nullIfEmpty(bedrooms),
        bathrooms: nullIfEmpty(bathrooms),
        address, auctionDate: auctionDate || null,
        acquisitionStage: acquisitionStage || 'sin_proceso',
        isFeatured: isFeatured || false,
        internalNotes: internalNotes || null,
        code: nullIfEmpty(code),
        slug,
      }, { transaction });

      await PropertyStatusHistory.create({
        propertyId: created.id,
        fromStatus: null,
        toStatus: created.status,
        userName: req.user?.name || null,
      }, { transaction });

      return created;
    });

    logger.info('Propiedad creada', { propertyId: property.id, userId: req.user?.id, city, type, status: property.status });

    // Notificar a suscriptores con alertas coincidentes (sin bloquear la respuesta)
    if ((status || 'disponible') === 'disponible') {
      alertService.notifyAndSend(property);
    }

    logAudit(req, 'create', 'property', property.id, { title: property.title, city, type });

    return res.status(201).json({
      message: 'Propiedad creada exitosamente',
      data: property,
    });
  } catch (error) {
    logger.error('Error en createProperty', { userId: req.user?.id, error: error.message });
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/properties/:id
const updateProperty = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const {
      title, description, price, city, type,
      status, squareMeters, terrainMeters, constructionMeters, bedrooms, bathrooms,
      address, auctionDate, acquisitionStage, isFeatured, internalNotes, code,
    } = req.body;

    if (title && title !== property.title) {
      let slug = generateSlug(title);
      const existing = await Property.findOne({ where: { slug } });
      if (existing && existing.id !== property.id) slug = `${slug}-${Date.now()}`;
      req.body.slug = slug;
    }

    const previousStatus = property.status;
    const previousPrice  = property.price;

    // AUDIT-021: solo se incluyen en el UPDATE los campos que el request realmente
    // envió. Antes se pasaban TODOS los campos desestructurados (incluyendo los
    // ausentes, como `undefined`), y nullIfEmpty() convertía esos `undefined` en
    // `null` — cada actualización parcial (ej. arrastrar una propiedad en el Kanban
    // para solo cambiar `status`) borraba silenciosamente price/m²/recámaras/baños/code.
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = nullIfEmpty(price);
    if (city !== undefined) updates.city = city;
    if (type !== undefined) updates.type = type;
    if (status !== undefined) updates.status = status;
    if (squareMeters !== undefined) updates.squareMeters = nullIfEmpty(squareMeters);
    if (terrainMeters !== undefined) updates.terrainMeters = nullIfEmpty(terrainMeters);
    if (constructionMeters !== undefined) updates.constructionMeters = nullIfEmpty(constructionMeters);
    if (bedrooms !== undefined) updates.bedrooms = nullIfEmpty(bedrooms);
    if (bathrooms !== undefined) updates.bathrooms = nullIfEmpty(bathrooms);
    if (address !== undefined) updates.address = address;
    if (auctionDate !== undefined) updates.auctionDate = auctionDate || null;
    if (acquisitionStage !== undefined) updates.acquisitionStage = acquisitionStage || 'sin_proceso';
    if (isFeatured !== undefined) updates.isFeatured = isFeatured;
    if (internalNotes !== undefined) updates.internalNotes = internalNotes || null;
    if (code !== undefined) updates.code = nullIfEmpty(code);
    if (req.body.slug) updates.slug = req.body.slug;

    await property.update(updates);

    if (status && status !== previousStatus) {
      PropertyStatusHistory.create({
        propertyId: property.id,
        changeType: 'status',
        fromStatus: previousStatus,
        toStatus: status,
        userName: req.user?.name || null,
      }).catch((e) => console.error('Error registrando historial de estatus:', e));

      // AUDIT-005: createProperty ya notificaba a suscriptores con alertas coincidentes,
      // pero updateProperty nunca lo hacía — una propiedad reactivada vía edición no
      // disparaba ningún email/WhatsApp. Ahora ambos comparten alertService.
      if (status === 'disponible' && previousStatus !== 'disponible') {
        alertService.notifyAndSend(property);
      }
    }

    const newPrice = nullIfEmpty(price);
    const prevPrice = previousPrice !== null && previousPrice !== undefined ? parseFloat(previousPrice) : null;
    const nextPrice = newPrice !== null && newPrice !== undefined ? parseFloat(newPrice) : null;
    if (price !== undefined && prevPrice !== nextPrice) {
      PropertyStatusHistory.create({
        propertyId: property.id,
        changeType: 'price',
        fromPrice: prevPrice,
        toPrice: nextPrice,
        userName: req.user?.name || null,
      }).catch((e) => console.error('Error registrando historial de precio:', e));
    }

    logAudit(req, 'update', 'property', property.id, { title: property.title });

    return res.json({
      message: 'Propiedad actualizada exitosamente',
      data: property,
    });
  } catch (error) {
    console.error('Error en updateProperty:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/properties/:id
const deleteProperty = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id, {
      include: [{ model: Image, as: 'images' }],
    });

    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    // Eliminar imágenes de Cloudinary
    for (const image of property.images) {
      if (image.filename) {
        try { await cloudinary.uploader.destroy(image.filename); } catch { /* ignorado */ }
      }
    }

    logAudit(req, 'delete', 'property', property.id, { title: property.title });
    await property.destroy();

    return res.json({ message: 'Propiedad eliminada exitosamente' });
  } catch (error) {
    console.error('Error en deleteProperty:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/properties/:id/images
const uploadImages = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se enviaron imágenes' });
    }

    // AUDIT-008: multer ya filtró por extensión/mimetype declarado (falsificable); esto
    // verifica los bytes reales del archivo antes de subirlo a Cloudinary.
    if (req.files.some((file) => !isValidImageBuffer(file.buffer))) {
      return res.status(400).json({ error: 'Uno o más archivos no son imágenes válidas (JPG, PNG o WEBP)' });
    }

    const existingImages = await Image.count({ where: { propertyId: property.id } });

    const uploadToCloudinary = (buffer) =>
      new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'triomphe/properties', transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(buffer);
      });

    const images = await Promise.all(
      req.files.map(async (file, index) => {
        const result = await uploadToCloudinary(file.buffer);
        return Image.create({
          propertyId: property.id,
          url: result.secure_url,
          filename: result.public_id,
          order: existingImages + index,
          isCover: existingImages === 0 && index === 0,
        });
      })
    );

    logAudit(req, 'create', 'property', property.id, { imagesAdded: images.length });

    return res.status(201).json({
      message: `${images.length} imagen(es) subida(s) exitosamente`,
      data: images,
    });
  } catch (error) {
    console.error('Error en uploadImages:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/properties/:id/images/:imageId
const deleteImage = async (req, res) => {
  try {
    const image = await Image.findOne({
      where: { id: req.params.imageId, propertyId: req.params.id },
    });

    if (!image) return res.status(404).json({ error: 'Imagen no encontrada' });

    // Eliminar de Cloudinary si tiene public_id
    if (image.filename) {
      try { await cloudinary.uploader.destroy(image.filename); } catch { /* ignorado */ }
    }

    await image.destroy();

    // Si era la portada, asignar la siguiente
    if (image.isCover) {
      const nextImage = await Image.findOne({
        where: { propertyId: req.params.id },
        order: [['order', 'ASC']],
      });
      if (nextImage) await nextImage.update({ isCover: true });
    }

    logAudit(req, 'delete', 'property', req.params.id, { imageId: image.id });

    return res.json({ message: 'Imagen eliminada exitosamente' });
  } catch (error) {
    console.error('Error en deleteImage:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/properties/:id/images/:imageId/cover
const setCoverImage = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    await Image.update({ isCover: false }, { where: { propertyId: req.params.id } });

    const image = await Image.findOne({
      where: { id: req.params.imageId, propertyId: req.params.id },
    });

    if (!image) return res.status(404).json({ error: 'Imagen no encontrada' });

    await image.update({ isCover: true });

    logAudit(req, 'update', 'property', req.params.id, { coverImageId: image.id });

    return res.json({ message: 'Imagen de portada actualizada', data: image });
  } catch (error) {
    console.error('Error en setCoverImage:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/properties/:id/images/reorder — recibe { imageIds: [id1, id2, ...] } en el orden deseado
const reorderImages = async (req, res) => {
  try {
    const { imageIds } = req.body;
    if (!Array.isArray(imageIds) || imageIds.length === 0) {
      return res.status(400).json({ error: 'imageIds debe ser un arreglo no vacío' });
    }

    const images = await Image.findAll({ where: { propertyId: req.params.id } });
    if (images.length !== imageIds.length || !images.every((img) => imageIds.includes(img.id))) {
      return res.status(400).json({ error: 'El listado de imágenes no coincide con la propiedad' });
    }

    await Promise.all(imageIds.map((imgId, index) => Image.update({ order: index }, { where: { id: imgId, propertyId: req.params.id } })));

    logAudit(req, 'update', 'property', req.params.id, { imageIds });

    return res.json({ message: 'Orden de imágenes actualizado' });
  } catch (error) {
    console.error('Error en reorderImages:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/properties/promoted
const getPromotedProperty = async (req, res) => {
  try {
    const property = await Property.findOne({
      where: { isPromoted: true },
      include: [{ model: Image, as: 'images', separate: true, order: [['order', 'ASC']] }],
    });
    return res.json({ data: property || null });
  } catch (error) {
    console.error('Error en getPromotedProperty:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/properties/:id/promote
const promoteProperty = async (req, res) => {
  // AUDIT-004: las dos operaciones (quitar promoción anterior + activar la nueva) deben
  // ser atómicas — sin transacción, dos admins promoviendo propiedades distintas casi al
  // mismo tiempo pueden terminar con 0 o 2 propiedades isPromoted:true.
  const transaction = await sequelize.transaction();
  try {
    const property = await Property.findByPk(req.params.id, { transaction });
    if (!property) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    if (property.isPromoted) {
      await property.update({ isPromoted: false }, { transaction });
      await transaction.commit();
      logAudit(req, 'update', 'property', property.id, { isPromoted: false });
      return res.json({ message: 'Propiedad quitada de promoción', data: property });
    }

    // Quitar la promoción a cualquier otra propiedad y activar esta
    await Property.update({ isPromoted: false }, { where: { isPromoted: true }, transaction });
    await property.update({ isPromoted: true }, { transaction });

    await transaction.commit();
    logAudit(req, 'update', 'property', property.id, { isPromoted: true });
    return res.json({ message: 'Propiedad promocionada exitosamente', data: property });
  } catch (error) {
    await transaction.rollback();
    console.error('Error en promoteProperty:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/properties/:id/status-history
const getStatusHistory = async (req, res) => {
  try {
    const history = await PropertyStatusHistory.findAll({
      where: { propertyId: req.params.id },
      order: [['createdAt', 'DESC']],
    });
    return res.json({ data: history });
  } catch (error) {
    console.error('Error en getStatusHistory:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/properties/:id/price-history (público — sin datos internos)
const getPublicPriceHistory = async (req, res) => {
  try {
    const history = await PropertyStatusHistory.findAll({
      where: { propertyId: req.params.id },
      attributes: ['id', 'fromStatus', 'toStatus', 'changeType', 'fromPrice', 'toPrice', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });
    return res.json({ data: history });
  } catch (error) {
    console.error('Error en getPublicPriceHistory:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/properties/:id/share — registra evento de compartir
const trackShare = async (req, res) => {
  try {
    await Analytics.create({
      event: 'share',
      propertyId: req.params.id,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer'] || null,
    });
    return res.status(204).send();
  } catch (error) {
    console.error('Error en trackShare:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

module.exports = {
  getProperties,
  getPropertyById,
  getPropertyBySlug,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadImages,
  deleteImage,
  setCoverImage,
  reorderImages,
  getPromotedProperty,
  promoteProperty,
  getStatusHistory,
  getPublicPriceHistory,
  trackShare,
  getPropertyStats,
};
