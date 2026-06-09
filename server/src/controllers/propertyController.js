const { Op } = require('sequelize');
const { cloudinary } = require('../config/cloudinary');
const { Property, Image, Analytics, PropertyAlert, PropertyStatusHistory } = require('../models/index');
const { generateSlug } = require('../utils/helpers');
const { sendPropertyAlertNotification } = require('../services/emailService');
const { logAudit } = require('../utils/audit');

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
      minM2,
      maxM2,
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

    if (minM2 || maxM2) {
      where.squareMeters = {};
      if (minM2) where.squareMeters[Op.gte] = parseFloat(minM2);
      if (maxM2) where.squareMeters[Op.lte] = parseFloat(maxM2);
    }

    if (minBedrooms) where.bedrooms = { [Op.gte]: parseInt(minBedrooms) };
    if (minBathrooms) where.bathrooms = { [Op.gte]: parseInt(minBathrooms) };

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Property.findAndCountAll({
      where,
      attributes: { exclude: ['internalNotes'] },
      include: [{ model: Image, as: 'images', where: { isCover: true }, required: false }],
      order: [['isFeatured', 'DESC'], ['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return res.json({
      data: rows,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error en getProperties:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/properties/:id
const getPropertyById = async (req, res) => {
  try {
    const isStaff = req.user && ['admin', 'editor'].includes(req.user.role);
    const property = await Property.findByPk(req.params.id, {
      attributes: isStaff ? undefined : { exclude: ['internalNotes'] },
      include: [{ model: Image, as: 'images', order: [['order', 'ASC']] }],
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
      include: [{ model: Image, as: 'images', order: [['order', 'ASC']] }],
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
      address, auctionDate, acquisitionStage, isFeatured, internalNotes,
    } = req.body;

    if (!title || !city || !type) {
      return res.status(400).json({ error: 'Título, precio, ciudad y tipo son requeridos' });
    }

    let slug = generateSlug(title);

    // Asegurar slug único
    const existing = await Property.findOne({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const property = await Property.create({
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
      slug,
    });

    PropertyStatusHistory.create({
      propertyId: property.id,
      fromStatus: null,
      toStatus: property.status,
      userName: req.user?.name || null,
    }).catch((e) => console.error('Error registrando historial de estatus:', e));

    // Notificar a suscriptores con alertas coincidentes (sin bloquear la respuesta)
    if ((status || 'disponible') === 'disponible') {
      const alertWhere = { isActive: true };
      if (city) alertWhere[Op.or] = [{ city: null }, { city }];
      if (type) {
        const typeFilter = [{ type: null }, { type }];
        alertWhere[Op.or] = alertWhere[Op.or]
          ? alertWhere[Op.or].concat(typeFilter)
          : typeFilter;
      }

      PropertyAlert.findAll({ where: alertWhere }).then((alerts) => {
        const parsedPrice = price ? parseFloat(price) : null;
        const matching = alerts.filter((a) => {
          if (a.city && a.city !== city) return false;
          if (a.type && a.type !== type) return false;
          if (a.maxPrice && parsedPrice && parsedPrice > parseFloat(a.maxPrice)) return false;
          return true;
        });
        matching.forEach((a) => {
          sendPropertyAlertNotification(a, property).catch((e) =>
            console.error('Error enviando alerta de propiedad:', e)
          );
        });
      }).catch((e) => console.error('Error buscando alertas:', e));
    }

    logAudit(req, 'create', 'property', property.id, { title: property.title, city, type });

    return res.status(201).json({
      message: 'Propiedad creada exitosamente',
      data: property,
    });
  } catch (error) {
    console.error('Error en createProperty:', error);
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
      address, auctionDate, acquisitionStage, isFeatured, internalNotes,
    } = req.body;

    if (title && title !== property.title) {
      let slug = generateSlug(title);
      const existing = await Property.findOne({ where: { slug } });
      if (existing && existing.id !== property.id) slug = `${slug}-${Date.now()}`;
      req.body.slug = slug;
    }

    const previousStatus = property.status;

    await property.update({
      title, description,
      price: nullIfEmpty(price),
      city, type, status,
      squareMeters: nullIfEmpty(squareMeters),
      terrainMeters: nullIfEmpty(terrainMeters),
      constructionMeters: nullIfEmpty(constructionMeters),
      bedrooms: nullIfEmpty(bedrooms),
      bathrooms: nullIfEmpty(bathrooms),
      address, auctionDate: auctionDate || null,
      acquisitionStage: acquisitionStage || 'sin_proceso',
      isFeatured, internalNotes: internalNotes || null,
      slug: req.body.slug,
    });

    if (status && status !== previousStatus) {
      PropertyStatusHistory.create({
        propertyId: property.id,
        fromStatus: previousStatus,
        toStatus: status,
        userName: req.user?.name || null,
      }).catch((e) => console.error('Error registrando historial de estatus:', e));
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
      include: [{ model: Image, as: 'images', order: [['order', 'ASC']] }],
    });
    return res.json({ data: property || null });
  } catch (error) {
    console.error('Error en getPromotedProperty:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/properties/:id/promote
const promoteProperty = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    if (property.isPromoted) {
      await property.update({ isPromoted: false });
      return res.json({ message: 'Propiedad quitada de promoción', data: property });
    }

    // Quitar la promoción a cualquier otra propiedad y activar esta
    await Property.update({ isPromoted: false }, { where: { isPromoted: true } });
    await property.update({ isPromoted: true });

    return res.json({ message: 'Propiedad promocionada exitosamente', data: property });
  } catch (error) {
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
};
