const { JobPosition, JobApplication } = require('../models/index');
const { validateEmail } = require('../utils/validators');
const {
  sendJobApplicationNotification,
  sendJobApplicationConfirmation,
} = require('../services/emailService');
const { logAudit } = require('../utils/audit');

const VALID_APPLICATION_STATUS = ['nueva', 'en_revision', 'entrevista', 'aceptada', 'rechazada'];

// ===== VACANTES =====

// GET /api/jobs
const getPositions = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error en getPositions:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/jobs/admin — todas las vacantes para el admin
const getAllPositions = async (req, res) => {
  try {
    const positions = await JobPosition.findAll({
      include: [
        {
          model: JobApplication,
          as: 'applications',
          attributes: ['id', 'status'],
        },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json({ data: positions });
  } catch (error) {
    console.error('Error en getAllPositions:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/jobs/:id
const getPositionById = async (req, res) => {
  try {
    const position = await JobPosition.findByPk(req.params.id);
    if (!position) return res.status(404).json({ error: 'Vacante no encontrada' });
    return res.json({ data: position });
  } catch (error) {
    console.error('Error en getPositionById:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/jobs
const createPosition = async (req, res) => {
  try {
    const { title, description, requirements, benefits, city, type, isUrgent } = req.body;
    if (!title || !description || !requirements) {
      return res.status(400).json({ error: 'Título, descripción y requisitos son requeridos' });
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
  } catch (error) {
    console.error('Error en createPosition:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/jobs/:id
const updatePosition = async (req, res) => {
  try {
    const position = await JobPosition.findByPk(req.params.id);
    if (!position) return res.status(404).json({ error: 'Vacante no encontrada' });
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
  } catch (error) {
    console.error('Error en updatePosition:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/jobs/:id
const deletePosition = async (req, res) => {
  try {
    const position = await JobPosition.findByPk(req.params.id);
    if (!position) return res.status(404).json({ error: 'Vacante no encontrada' });
    await position.destroy();
    logAudit(req, 'delete', 'job', req.params.id, { title: position.title });
    return res.json({ message: 'Vacante eliminada' });
  } catch (error) {
    console.error('Error en deletePosition:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// ===== POSTULACIONES =====

// POST /api/jobs/:id/apply
const applyToPosition = async (req, res) => {
  try {
    const { name, email, phone, city, experience, hasVehicle, motivation } = req.body;

    if (!name || !email || !phone || !city || !experience) {
      return res
        .status(400)
        .json({ error: 'Nombre, email, teléfono, ciudad y experiencia son requeridos' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    let position = null;
    const positionId = req.params.id;

    if (positionId && positionId !== 'general') {
      position = await JobPosition.findByPk(positionId);
      if (!position || position.status !== 'activa') {
        return res.status(404).json({ error: 'Vacante no disponible' });
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
  } catch (error) {
    console.error('Error en applyToPosition:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/jobs/applications — admin
const getApplications = async (req, res) => {
  try {
    const { status, positionId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (positionId) where.jobPositionId = positionId;

    const applications = await JobApplication.findAll({
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
    });

    return res.json({ data: applications });
  } catch (error) {
    console.error('Error en getApplications:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/jobs/applications/:id
const updateApplication = async (req, res) => {
  try {
    const application = await JobApplication.findByPk(req.params.id);
    if (!application) return res.status(404).json({ error: 'Postulación no encontrada' });
    const { status, notes } = req.body;
    if (status !== undefined && !VALID_APPLICATION_STATUS.includes(status)) {
      return res.status(400).json({
        error: `Estatus inválido. Valores permitidos: ${VALID_APPLICATION_STATUS.join(', ')}`,
      });
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
  } catch (error) {
    console.error('Error en updateApplication:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/jobs/applications/:id
const deleteApplication = async (req, res) => {
  try {
    const application = await JobApplication.findByPk(req.params.id);
    if (!application) return res.status(404).json({ error: 'Postulación no encontrada' });
    await application.destroy();
    logAudit(req, 'delete', 'application', req.params.id, {
      name: application.name,
      email: application.email,
    });
    return res.json({ message: 'Postulación eliminada' });
  } catch (error) {
    console.error('Error en deleteApplication:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
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
