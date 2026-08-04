const { JobPosition, JobApplication } = require('../models/index');
const { validateEmail } = require('../utils/validators');
const {
  sendJobApplicationNotification,
  sendJobApplicationConfirmation,
} = require('../services/emailService');
const { logAudit } = require('../utils/audit');
const { paginate } = require('../utils/pagination');
const { ApiError } = require('../middleware/errorHandler');

const VALID_APPLICATION_STATUS = ['nueva', 'en_revision', 'entrevista', 'aceptada', 'rechazada'];

// ===== VACANTES =====

// GET /api/jobs
const getPositions = async (req, res) => {
  const { status, city } = req.query;
  const where = {};
  if (status) where.status = status;
  else where.status = 'activa';
  if (city) where.city = city;

  const positions = await JobPosition.findAll({
    where,
    order: [
      ['isUrgent', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });

  return res.json({ data: positions });
};

// GET /api/jobs/admin — todas las vacantes para el admin
const getAllPositions = async (req, res) => {
  const { page, limit } = req.query;
  const queryOptions = {
    include: [
      {
        model: JobApplication,
        as: 'applications',
        attributes: ['id', 'status'],
      },
    ],
    order: [['createdAt', 'DESC']],
    // JobPosition->applications es hasMany: sin distinct, el JOIN infla el COUNT
    // de findAndCountAll (una vacante con 5 postulaciones contaría como 5).
    distinct: true,
  };

  // page/limit opcionales: sin ellos, comportamiento sin cambios (lista completa).
  if (page === undefined && limit === undefined) {
    const positions = await JobPosition.findAll(queryOptions);
    return res.json({ data: positions });
  }

  const result = await paginate(JobPosition, { page, limit, ...queryOptions });
  return res.json(result);
};

// GET /api/jobs/:id
const getPositionById = async (req, res) => {
  const position = await JobPosition.findByPk(req.params.id);
  if (!position) throw new ApiError(404, 'Vacante no encontrada');
  return res.json({ data: position });
};

// POST /api/jobs
const createPosition = async (req, res) => {
  const { title, description, requirements, benefits, city, type, isUrgent } = req.body;
  if (!title || !description || !requirements) {
    throw new ApiError(400, 'Título, descripción y requisitos son requeridos');
  }
  const position = await JobPosition.create({
    title,
    description,
    requirements,
    benefits,
    city: city || 'todas',
    type: type || 'por_comision',
    isUrgent: isUrgent || false,
  });
  logAudit(req, 'create', 'job', position.id, { title: position.title, city, type });
  return res.status(201).json({ message: 'Vacante creada exitosamente', data: position });
};

// PUT /api/jobs/:id
const updatePosition = async (req, res) => {
  const position = await JobPosition.findByPk(req.params.id);
  if (!position) throw new ApiError(404, 'Vacante no encontrada');
  const { title, description, requirements, benefits, city, type, status, isUrgent } = req.body;
  // Preventivo, mismo patrón que AUDIT-021/AUDIT-025: no asumir que el request
  // siempre trae el formulario completo, aunque hoy el único caller sí lo hace.
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (requirements !== undefined) updates.requirements = requirements;
  if (benefits !== undefined) updates.benefits = benefits;
  if (city !== undefined) updates.city = city;
  if (type !== undefined) updates.type = type;
  if (status !== undefined) updates.status = status;
  if (isUrgent !== undefined) updates.isUrgent = isUrgent;
  await position.update(updates);
  logAudit(req, 'update', 'job', position.id, updates);
  return res.json({ message: 'Vacante actualizada', data: position });
};

// DELETE /api/jobs/:id
const deletePosition = async (req, res) => {
  const position = await JobPosition.findByPk(req.params.id);
  if (!position) throw new ApiError(404, 'Vacante no encontrada');
  await position.destroy();
  logAudit(req, 'delete', 'job', req.params.id, { title: position.title });
  return res.json({ message: 'Vacante eliminada' });
};

// ===== POSTULACIONES =====

// POST /api/jobs/:id/apply
const applyToPosition = async (req, res) => {
  const { name, email, phone, city, experience, hasVehicle, motivation } = req.body;

  if (!name || !email || !phone || !city || !experience) {
    throw new ApiError(400, 'Nombre, email, teléfono, ciudad y experiencia son requeridos');
  }

  if (!validateEmail(email)) {
    throw new ApiError(400, 'Email inválido');
  }

  let position = null;
  const positionId = req.params.id;

  if (positionId && positionId !== 'general') {
    position = await JobPosition.findByPk(positionId);
    if (!position || position.status !== 'activa') {
      throw new ApiError(404, 'Vacante no disponible');
    }
  }

  const application = await JobApplication.create({
    name,
    email,
    phone,
    city,
    experience,
    hasVehicle: hasVehicle || false,
    motivation,
    jobPositionId: position ? position.id : null,
  });

  Promise.all([
    sendJobApplicationNotification(application, position).catch((e) =>
      console.error('Error email notif:', e)
    ),
    sendJobApplicationConfirmation(application, position).catch((e) =>
      console.error('Error email confirm:', e)
    ),
  ]);

  return res.status(201).json({
    message: 'Tu postulación fue enviada exitosamente. Te contactaremos pronto.',
    data: { id: application.id },
  });
};

// GET /api/jobs/applications — admin
const getApplications = async (req, res) => {
  const { status, positionId, page, limit } = req.query;
  const where = {};
  if (status) where.status = status;
  if (positionId) where.jobPositionId = positionId;

  const queryOptions = {
    where,
    include: [
      {
        model: JobPosition,
        as: 'position',
        attributes: ['id', 'title', 'city'],
        required: false,
      },
    ],
    order: [['createdAt', 'DESC']],
  };

  // page/limit opcionales: sin ellos, comportamiento sin cambios (lista completa).
  if (page === undefined && limit === undefined) {
    const applications = await JobApplication.findAll(queryOptions);
    return res.json({ data: applications });
  }

  const result = await paginate(JobApplication, { page, limit, ...queryOptions });
  return res.json(result);
};

// PUT /api/jobs/applications/:id
const updateApplication = async (req, res) => {
  const application = await JobApplication.findByPk(req.params.id);
  if (!application) throw new ApiError(404, 'Postulación no encontrada');
  const { status, notes } = req.body;
  if (status !== undefined && !VALID_APPLICATION_STATUS.includes(status)) {
    throw new ApiError(
      400,
      `Estatus inválido. Valores permitidos: ${VALID_APPLICATION_STATUS.join(', ')}`
    );
  }
  // AUDIT-025: mismo bug que updateProperty (AUDIT-021) — pasar status/notes sin
  // filtrar sobreescribía el campo ausente a null en cada actualización parcial
  // (ej. cambiar solo el estatus borraba las notas ya escritas, y viceversa).
  const updates = {};
  if (status !== undefined) updates.status = status;
  if (notes !== undefined) updates.notes = notes;
  await application.update(updates);
  logAudit(req, 'update', 'application', application.id, updates);
  return res.json({ message: 'Postulación actualizada', data: application });
};

// DELETE /api/jobs/applications/:id
const deleteApplication = async (req, res) => {
  const application = await JobApplication.findByPk(req.params.id);
  if (!application) throw new ApiError(404, 'Postulación no encontrada');
  await application.destroy();
  logAudit(req, 'delete', 'application', req.params.id, {
    name: application.name,
    email: application.email,
  });
  return res.json({ message: 'Postulación eliminada' });
};

module.exports = {
  getPositions,
  getAllPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deletePosition,
  applyToPosition,
  getApplications,
  updateApplication,
  deleteApplication,
};
