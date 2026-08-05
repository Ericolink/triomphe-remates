const { Testimonial, Property } = require('../models/index');
const { cloudinary } = require('../config/cloudinary');
const { logAudit } = require('../utils/audit');
const { paginate } = require('../utils/pagination');
const { destroyCloudinaryAsset } = require('../utils/cloudinaryCleanup');
const { ApiError } = require('../middleware/errorHandler');

const uploadToCloudinary = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, transformation: [{ quality: 'auto', fetch_format: 'auto' }] },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });

// GET /api/testimonials/public
const getPublicTestimonials = async (req, res) => {
  const { limit = 6 } = req.query;
  const testimonials = await Testimonial.findAll({
    where: { status: 'publicado' },
    order: [
      ['order', 'ASC'],
      ['createdAt', 'DESC'],
    ],
    limit: parseInt(limit, 10),
  });
  return res.json({ data: testimonials });
};

// GET /api/testimonials/admin/all
const getAllTestimonials = async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const where = {};
  if (status) where.status = status;

  const result = await paginate(Testimonial, {
    page,
    limit,
    where,
    order: [
      ['order', 'ASC'],
      ['createdAt', 'DESC'],
    ],
  });

  return res.json(result);
};

// GET /api/testimonials/:id
const getTestimonialById = async (req, res) => {
  const testimonial = await Testimonial.findByPk(req.params.id);
  if (!testimonial) throw new ApiError(404, 'Testimonio no encontrado');
  return res.json({ data: testimonial });
};

// POST /api/testimonials
const createTestimonial = async (req, res) => {
  try {
    const { clientName, clientRole, clientCity, testimonialText, rating, propertyId } = req.body;

    if (!clientName || !testimonialText) {
      throw new ApiError(400, 'Nombre del cliente y texto del testimonio son requeridos');
    }

    if (propertyId) {
      const property = await Property.findByPk(propertyId);
      if (!property) throw new ApiError(404, 'Propiedad no encontrada');
    }

    const data = {
      clientName: clientName.trim(),
      clientRole: clientRole?.trim() || null,
      clientCity: clientCity || null,
      testimonialText: testimonialText.trim(),
      rating: rating ? parseInt(rating, 10) : 5,
      propertyId: propertyId || null,
      status: 'pendiente',
    };

    if (req.files?.beforeImage?.[0]) {
      const result = await uploadToCloudinary(
        req.files.beforeImage[0].buffer,
        'triomphe/testimonials/before'
      );
      data.beforeImageUrl = result.secure_url;
      data.beforeImageFilename = result.public_id;
    }

    if (req.files?.afterImage?.[0]) {
      const result = await uploadToCloudinary(
        req.files.afterImage[0].buffer,
        'triomphe/testimonials/after'
      );
      data.afterImageUrl = result.secure_url;
      data.afterImageFilename = result.public_id;
    }

    const testimonial = await Testimonial.create(data);
    logAudit(req, 'create', 'testimonial', testimonial.id, { clientName });

    return res.status(201).json({ message: 'Testimonio creado', data: testimonial });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error al crear testimonio', { cause: error });
  }
};

// PUT /api/testimonials/:id
const updateTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findByPk(req.params.id);
    if (!testimonial) throw new ApiError(404, 'Testimonio no encontrado');

    const {
      clientName,
      clientRole,
      clientCity,
      testimonialText,
      rating,
      status,
      order,
      propertyId,
    } = req.body;

    if (propertyId) {
      const property = await Property.findByPk(propertyId);
      if (!property) throw new ApiError(404, 'Propiedad no encontrada');
    }

    const updates = {};
    if (clientName !== undefined) updates.clientName = clientName.trim();
    if (clientRole !== undefined) updates.clientRole = clientRole.trim() || null;
    if (clientCity !== undefined) updates.clientCity = clientCity || null;
    if (testimonialText !== undefined) updates.testimonialText = testimonialText.trim();
    if (rating !== undefined) updates.rating = parseInt(rating, 10);
    if (status !== undefined) updates.status = status;
    if (order !== undefined) updates.order = parseInt(order, 10);
    if (propertyId !== undefined) updates.propertyId = propertyId || null;

    if (req.files?.beforeImage?.[0]) {
      if (testimonial.beforeImageFilename) {
        await destroyCloudinaryAsset(testimonial.beforeImageFilename, {
          controller: 'testimonialController',
          operation: 'updateTestimonial',
          resourceId: testimonial.id,
        });
      }
      const result = await uploadToCloudinary(
        req.files.beforeImage[0].buffer,
        'triomphe/testimonials/before'
      );
      updates.beforeImageUrl = result.secure_url;
      updates.beforeImageFilename = result.public_id;
    }

    if (req.files?.afterImage?.[0]) {
      if (testimonial.afterImageFilename) {
        await destroyCloudinaryAsset(testimonial.afterImageFilename, {
          controller: 'testimonialController',
          operation: 'updateTestimonial',
          resourceId: testimonial.id,
        });
      }
      const result = await uploadToCloudinary(
        req.files.afterImage[0].buffer,
        'triomphe/testimonials/after'
      );
      updates.afterImageUrl = result.secure_url;
      updates.afterImageFilename = result.public_id;
    }

    await testimonial.update(updates);
    logAudit(req, 'update', 'testimonial', testimonial.id, {
      clientName: testimonial.clientName,
      status: testimonial.status,
    });

    return res.json({ message: 'Testimonio actualizado', data: testimonial });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error al actualizar testimonio', { cause: error });
  }
};

// DELETE /api/testimonials/:id
const deleteTestimonial = async (req, res) => {
  try {
    const testimonial = await Testimonial.findByPk(req.params.id);
    if (!testimonial) throw new ApiError(404, 'Testimonio no encontrado');

    if (testimonial.beforeImageFilename) {
      await destroyCloudinaryAsset(testimonial.beforeImageFilename, {
        controller: 'testimonialController',
        operation: 'deleteTestimonial',
        resourceId: testimonial.id,
      });
    }
    if (testimonial.afterImageFilename) {
      await destroyCloudinaryAsset(testimonial.afterImageFilename, {
        controller: 'testimonialController',
        operation: 'deleteTestimonial',
        resourceId: testimonial.id,
      });
    }

    await testimonial.destroy();
    logAudit(req, 'delete', 'testimonial', req.params.id);

    return res.json({ message: 'Testimonio eliminado' });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error al eliminar testimonio', { cause: error });
  }
};

module.exports = {
  getPublicTestimonials,
  getAllTestimonials,
  getTestimonialById,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
};
