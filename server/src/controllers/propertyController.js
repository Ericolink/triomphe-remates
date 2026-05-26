const { Op } = require('sequelize');
const { Property, Image, Analytics } = require('../models/index');
const { generateSlug } = require('../utils/helpers');
const path = require('path');
const fs = require('fs');

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

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { address: { [Op.like]: `%${search}%` } },
        { bank: { [Op.like]: `%${search}%` } },
      ];
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await Property.findAndCountAll({
      where,
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
    const property = await Property.findByPk(req.params.id, {
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
      status, squareMeters, bedrooms, bathrooms,
      address, loanNumber, bank, auctionDate, isFeatured,
    } = req.body;

    if (!title || !price || !city || !type) {
      return res.status(400).json({ error: 'Título, precio, ciudad y tipo son requeridos' });
    }

    let slug = generateSlug(title);

    // Asegurar slug único
    const existing = await Property.findOne({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now()}`;

    const property = await Property.create({
      title, description, price, city, type,
      status: status || 'disponible',
      squareMeters, bedrooms, bathrooms,
      address, loanNumber, bank, auctionDate,
      isFeatured: isFeatured || false,
      slug,
    });

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
      status, squareMeters, bedrooms, bathrooms,
      address, loanNumber, bank, auctionDate, isFeatured,
    } = req.body;

    if (title && title !== property.title) {
      let slug = generateSlug(title);
      const existing = await Property.findOne({ where: { slug } });
      if (existing && existing.id !== property.id) slug = `${slug}-${Date.now()}`;
      req.body.slug = slug;
    }

    await property.update({
      title, description, price, city, type,
      status, squareMeters, bedrooms, bathrooms,
      address, loanNumber, bank, auctionDate,
      isFeatured, slug: req.body.slug,
    });

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

    // Eliminar imágenes del disco
    for (const image of property.images) {
      const filePath = path.join(__dirname, '../../uploads/properties', image.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

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

    const images = await Promise.all(
      req.files.map((file, index) =>
        Image.create({
          propertyId: property.id,
          url: `/uploads/properties/${file.filename}`,
          filename: file.filename,
          order: existingImages + index,
          isCover: existingImages === 0 && index === 0,
        })
      )
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

    const filePath = path.join(__dirname, '../../uploads/properties', image.filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

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
};
