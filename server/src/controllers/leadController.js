const { Op } = require('sequelize');
const {
  sequelize,
  Lead,
  LeadNote,
  Property,
  Analytics,
  Campaign,
  User,
  Deal,
  Appointment,
} = require('../models/index');

// AUDIT-024: valores permitidos explícitos en vez de confiar solo en el ENUM de MySQL —
// falla con un 400 claro en vez de un error 500 genérico de Sequelize si llega un valor inválido.
const VALID_LEAD_STATUS = ['nuevo', 'contactado', 'cerrado', 'descartado'];
const VALID_LEAD_SOURCE = ['google', 'facebook', 'whatsapp', 'directo', 'referido', 'otro'];
// CRM Comercial — mismo patrón de arrays explícitos para las nuevas ENUMs.
const VALID_PIPELINE_STAGES = [
  'nuevo',
  'contactado',
  'interesado',
  'cita_agendada',
  'cita_realizada',
  'negociacion',
  'venta_realizada',
  'no_interesado',
];
const VALID_CLOSE_REASONS = [
  'compro',
  'no_respondio',
  'sin_presupuesto',
  'compro_competencia',
  'solo_info',
  'perdio_interes',
  'otro',
];
const VALID_PAYMENT_METHODS = ['credito_hipotecario', 'contado'];
// Motivos de contacto seleccionables para leads nuevos. 'informacion' y
// 'propiedades_similares' siguen existiendo en el ENUM de la base (leads históricos ya
// los tienen guardados) pero se excluyen aquí a propósito para que ya no puedan asignarse
// a leads nuevos — ver LEAD_TYPE_LABELS en client/src/utils/constants.js.
const VALID_LEAD_TYPE = [
  'comprar_propiedad',
  'rentar_propiedad',
  'vender_propiedad',
  'invertir_remates',
  'contacto',
  'cita',
  'asesoria_financiera',
  'otro',
];

// Horario comercial anunciado en ContactPage.jsx ("Lun - Vie: 9:00 AM - 6:00 PM") —
// mismo rango que valida el formulario público "Contactar asesor" al elegir "Agendar cita".
const APPOINTMENT_MIN_HOUR = 9;
const APPOINTMENT_MAX_HOUR = 18;
const APPOINTMENT_MIN_LEAD_MS = 24 * 60 * 60 * 1000;

// No existe todavía un sistema de disponibilidad (el Appointment/Calendario es admin-only,
// sin endpoint público de horarios ocupados) — esto valida solo las reglas de negocio
// (24h de anticipación, horario/día hábil), no choques de horario entre citas. La hora se
// lee directamente del string en vez de con Date#getHours() para no depender de la
// zona horaria del proceso del servidor (que puede no coincidir con la de México).
function validateAppointmentDate(appointmentDate) {
  if (!appointmentDate) return { error: 'Fecha y hora de la cita son requeridas' };

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(appointmentDate);
  if (!match) return { error: 'Fecha y hora de la cita inválidas' };

  const [, year, month, day, hourStr] = match;
  const hour = Number(hourStr);
  const date = new Date(appointmentDate);
  if (Number.isNaN(date.getTime())) return { error: 'Fecha y hora de la cita inválidas' };

  if (hour < APPOINTMENT_MIN_HOUR || hour >= APPOINTMENT_MAX_HOUR) {
    return {
      error: `El horario debe estar entre las ${APPOINTMENT_MIN_HOUR}:00 AM y las ${APPOINTMENT_MAX_HOUR - 12}:00 PM`,
    };
  }

  // Día de la semana calculado a partir de year/month/day como fecha local "naive"
  // (mismo criterio que la hora, sin pasar por el huso horario del proceso).
  const weekday = new Date(Number(year), Number(month) - 1, Number(day)).getDay();
  if (weekday === 0 || weekday === 6) {
    return { error: 'No se pueden agendar citas en fin de semana' };
  }

  if (date.getTime() - Date.now() < APPOINTMENT_MIN_LEAD_MS) {
    return { error: 'La cita debe programarse con al menos 24 horas de anticipación' };
  }

  return { date };
}

// Normaliza forma de pago / monto disponible / fecha de primer contacto — usado tanto
// por createLead como updateLead para no duplicar las reglas de validación.
// Devuelve { error } o { values } con solo las llaves presentes en el body.
function parseCommercialFields(body) {
  const values = {};

  if (body.paymentMethod !== undefined) {
    if (body.paymentMethod !== null && !VALID_PAYMENT_METHODS.includes(body.paymentMethod)) {
      return {
        error: `Forma de pago inválida. Valores permitidos: ${VALID_PAYMENT_METHODS.join(', ')}`,
      };
    }
    values.paymentMethod = body.paymentMethod || null;
  }

  if (body.budgetNotSpecified !== undefined) values.budgetNotSpecified = !!body.budgetNotSpecified;

  const budgetNotSpecified = body.budgetNotSpecified ?? false;
  if (budgetNotSpecified) {
    // Marcado explícitamente como "no especificó" — el monto no se conserva aunque
    // venga en el body (evita datos contradictorios: no puede estar "sin especificar"
    // y tener un monto a la vez).
    if (body.budgetAmount !== undefined) values.budgetAmount = null;
  } else if (body.budgetAmount !== undefined) {
    if (body.budgetAmount === null || body.budgetAmount === '') {
      values.budgetAmount = null;
    } else {
      const amount = Number(body.budgetAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        return { error: 'Monto disponible inválido' };
      }
      values.budgetAmount = amount;
    }
  }

  if (body.firstContactDate !== undefined) {
    if (body.firstContactDate === null || body.firstContactDate === '') {
      values.firstContactDate = null;
    } else {
      const date = new Date(body.firstContactDate);
      if (Number.isNaN(date.getTime())) {
        return { error: 'Fecha de primer contacto inválida' };
      }
      if (date.getTime() > Date.now()) {
        return { error: 'La fecha de primer contacto no puede ser futura' };
      }
      values.firstContactDate = body.firstContactDate;
    }
  }

  return { values };
}
const { validateEmail, validatePhone } = require('../utils/validators');
const { sendNewLeadNotification, sendLeadConfirmation } = require('../services/emailService');
const {
  sendLeadFollowUpWhatsApp,
  isConfigured: isWhatsappConfigured,
} = require('../services/whatsappService');
const { logAudit } = require('../utils/audit');
const leadEvents = require('../utils/leadEvents');
const { paginate } = require('../utils/pagination');
const logger = require('../utils/logger');
const { isOriginAllowed } = require('../utils/corsOrigins');
const { validateBatchIds } = require('../utils/batchValidation');
const {
  TERMINAL_STAGES,
  logActivity,
  ensureOpenTask,
  closeOpenTask,
  legacyStatusFor,
} = require('../utils/pipelineHelpers');
const {
  crmAccessLevel,
  getLeadVisibilityWhere,
  canViewLead,
  canEditLead,
  canAssignLeads,
} = require('../utils/leadAccess');
// Etapas a las que un prospecto cerrado puede volver al reabrirse — cualquier etapa no
// terminal es un destino válido para PUT /:id/reopen.
const REOPEN_STAGES = VALID_PIPELINE_STAGES.filter((s) => !TERMINAL_STAGES.includes(s));

// POST /api/leads
const createLead = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      message,
      type,
      propertyId,
      appointmentDate,
      source,
      campaignId,
      assignedToUserId,
    } = req.body;

    // Nombre ya no es obligatorio: un prospecto capturado de prisa (llamada, feria) a
    // veces solo trae teléfono. Se usa un placeholder en vez de dejarlo null para no
    // tener que blindar cada vista/email que ya asume lead.name como string.
    const resolvedName = (name && name.trim()) || 'Prospecto sin nombre';
    // CRM Comercial: email ya no es obligatorio (prospectos de solo-WhatsApp/Facebook).
    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'Email inválido' });
    }

    // El teléfono es obligatorio para el formulario público "Contactar asesor" (mejora la
    // calidad de los prospectos captados) pero se mantiene opcional para la captura manual
    // del CRM (CreateLeadModal / "Nuevo prospecto"), donde req.user viene presente porque
    // el equipo comercial ya está autenticado — ver attachUserIfPresent en routes/leads.js.
    if (!req.user && (!phone || !phone.trim())) {
      return res.status(400).json({ error: 'Teléfono es requerido' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Teléfono inválido — usa 10 dígitos, con o sin +52' });
    }

    // CRM de Leads: un Asesor de Ventas no puede crear prospectos manualmente (solo
    // trabaja los que ya se le asignaron); el formulario público no tiene req.user, así
    // que esto solo aplica a la captura manual desde el CRM.
    if (req.user && crmAccessLevel(req.user) === 'asesor_ventas') {
      return res.status(403).json({ error: 'Los asesores de ventas no pueden crear prospectos' });
    }
    // Asignar responsable al crear queda reservado a quien puede asignar (admin/
    // coordinador_ventas) — ver utils/leadAccess.js. El formulario público nunca envía
    // este campo, así que esto solo bloquea una captura manual mal intencionada.
    if (assignedToUserId && req.user && !canAssignLeads(req.user)) {
      return res.status(403).json({ error: 'No tienes permisos para asignar un responsable' });
    }

    if (type && !VALID_LEAD_TYPE.includes(type)) {
      return res.status(400).json({
        error: `Motivo de contacto inválido. Valores permitidos: ${VALID_LEAD_TYPE.join(', ')}`,
      });
    }

    const resolvedType = type || 'contacto';
    if (resolvedType === 'cita') {
      const { error: appointmentError } = validateAppointmentDate(appointmentDate);
      if (appointmentError) return res.status(400).json({ error: appointmentError });
    }

    const { error: commercialError, values: commercialFields } = parseCommercialFields(req.body);
    if (commercialError) return res.status(400).json({ error: commercialError });

    let property = null;
    if (propertyId) {
      property = await Property.findByPk(propertyId);
      if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    if (campaignId) {
      const campaign = await Campaign.findByPk(campaignId);
      if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    if (assignedToUserId) {
      const assignedUser = await User.findByPk(assignedToUserId);
      if (!assignedUser) return res.status(404).json({ error: 'Usuario asignado no encontrado' });
    }

    const lead = await sequelize.transaction(async (transaction) => {
      const created = await Lead.create(
        {
          name: resolvedName,
          email: email || null,
          phone,
          message,
          type: resolvedType,
          source: source || 'directo',
          propertyId: propertyId || null,
          appointmentDate: appointmentDate || null,
          campaignId: campaignId || null,
          assignedToUserId: assignedToUserId || null,
          assignedAt: assignedToUserId ? new Date() : null,
          createdByUserId: req.user?.id ?? null,
          ...commercialFields,
        },
        { transaction }
      );

      await logActivity({
        leadId: created.id,
        type: 'sistema',
        content: 'Prospecto creado',
        transaction,
      });

      // "Agendar cita" crea también la Appointment que alimenta el Calendario admin —
      // mismo patrón que appointmentController.createAppointment — para que la solicitud
      // del formulario público quede visible ahí de inmediato, sin depender del
      // Lead.appointmentDate deprecado (que solo se conserva para el email de confirmación).
      if (resolvedType === 'cita') {
        await Appointment.create(
          {
            leadId: created.id,
            propertyId: propertyId || null,
            scheduledAt: appointmentDate,
          },
          { transaction }
        );
        await logActivity({
          leadId: created.id,
          type: 'sistema',
          content: `Cita agendada para ${new Date(appointmentDate).toLocaleString('es-MX')}`,
          transaction,
        });
      }

      // Diferido hasta asignar: un prospecto público sin responsable no tiene "próxima
      // acción" todavía (ver CRM_UX_DESIGN.md / plan de Fase 1).
      if (assignedToUserId) {
        await ensureOpenTask({ leadId: created.id, assignedToUserId, type: 'llamar', transaction });
      }

      return created;
    });

    Promise.all([
      sendNewLeadNotification(lead, property).catch((e) =>
        console.error('Error email notificación:', e)
      ),
      sendLeadConfirmation(lead).catch((e) => console.error('Error email confirmación:', e)),
    ]);

    if (property) {
      Analytics.create({
        event: 'contact',
        propertyId: property.id,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'] || null,
      }).catch((e) => console.error('Error registrando analytics contact:', e));
    }

    leadEvents.emit('new-lead', {
      id: lead.id,
      name: lead.name,
      email: lead.email,
      type: lead.type,
      status: lead.status,
      createdAt: lead.createdAt,
      property: property ? { id: property.id, title: property.title } : null,
    });

    return res.status(201).json({
      message: 'Mensaje enviado exitosamente. Un asesor se pondrá en contacto contigo pronto.',
      data: { id: lead.id },
    });
  } catch (error) {
    console.error('Error en createLead:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/leads
const getLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      propertyId,
      source,
      pipelineStage,
      campaignId,
      assignedToUserId,
      search,
    } = req.query;
    const where = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (source) where.source = source;
    if (propertyId) where.propertyId = propertyId;
    if (pipelineStage) where.pipelineStage = pipelineStage;
    if (campaignId) where.campaignId = campaignId;
    if (assignedToUserId) where.assignedToUserId = assignedToUserId;
    // Búsqueda instantánea (Kanban/Lista) — mismo patrón Op.or/Op.like que propertyController.
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    Object.assign(where, getLeadVisibilityWhere(req.user) || {});

    const result = await paginate(Lead, {
      page,
      limit,
      where,
      include: [
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'title', 'city', 'slug'],
          required: false,
        },
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name', 'platform'],
          required: false,
        },
        { model: User, as: 'assignedUser', attributes: ['id', 'name'], required: false },
      ],
      order: [['createdAt', 'DESC']],
    });

    return res.json(result);
  } catch (error) {
    console.error('Error en getLeads:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/leads/:id
const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        { model: Property, as: 'property', attributes: ['id', 'title', 'city', 'slug', 'price'] },
        {
          model: Campaign,
          as: 'campaign',
          attributes: ['id', 'name', 'platform'],
          required: false,
        },
        { model: User, as: 'assignedUser', attributes: ['id', 'name'], required: false },
        { model: User, as: 'createdByUser', attributes: ['id', 'name'], required: false },
        {
          model: Property,
          as: 'interestedProperties',
          // `price` viaja para que CloseLeadModal pueda preasignar el monto de venta al
          // elegir la propiedad (evita que el usuario tenga que ir a buscarlo aparte).
          attributes: ['id', 'title', 'city', 'slug', 'price'],
          through: { attributes: [] },
          required: false,
        },
        { model: Deal, as: 'deal', required: false },
      ],
    });

    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (!canViewLead(req.user, lead)) {
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }
    return res.json({ data: lead });
  } catch (error) {
    console.error('Error en getLeadById:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/leads/:id
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (!canEditLead(req.user, lead)) {
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }

    const { status, notes, appointmentDate, source, pipelineStage, assignedToUserId, campaignId } =
      req.body;

    // Asignar/reasignar responsable queda reservado a admin/coordinador_ventas — ver
    // utils/leadAccess.js. Un Asesor o Capturista con permiso de edición sobre este lead
    // puede seguir cambiando otros campos, solo no este.
    if (assignedToUserId !== undefined && !canAssignLeads(req.user)) {
      return res.status(403).json({ error: 'No tienes permisos para asignar un responsable' });
    }
    if (status !== undefined && !VALID_LEAD_STATUS.includes(status)) {
      return res
        .status(400)
        .json({ error: `Estatus inválido. Valores permitidos: ${VALID_LEAD_STATUS.join(', ')}` });
    }
    if (source !== undefined && !VALID_LEAD_SOURCE.includes(source)) {
      return res
        .status(400)
        .json({ error: `Fuente inválida. Valores permitidos: ${VALID_LEAD_SOURCE.join(', ')}` });
    }
    if (pipelineStage !== undefined) {
      if (!VALID_PIPELINE_STAGES.includes(pipelineStage)) {
        return res.status(400).json({
          error: `Etapa inválida. Valores permitidos: ${VALID_PIPELINE_STAGES.join(', ')}`,
        });
      }
      // Las etapas terminales solo se alcanzan a través de /close-won o /close-lost, que
      // capturan los datos obligatorios (monto+propiedad, o motivo) en la misma transacción.
      if (TERMINAL_STAGES.includes(pipelineStage)) {
        return res
          .status(400)
          .json({ error: 'Para cerrar un prospecto usa PUT /:id/close-won o PUT /:id/close-lost' });
      }
      // AUDIT: simétrico al bloqueo de arriba — un lead ya cerrado tampoco puede salir de
      // su etapa terminal por esta vía genérica, porque cerrar/reabrir tiene efectos
      // colaterales (Deal, Task, Activity) que este endpoint no conoce. Usa PUT /:id/reopen.
      if (TERMINAL_STAGES.includes(lead.pipelineStage)) {
        return res
          .status(400)
          .json({ error: 'Este prospecto está cerrado — usa PUT /:id/reopen para reactivarlo' });
      }
    }

    const { error: commercialError, values: commercialFields } = parseCommercialFields(req.body);
    if (commercialError) return res.status(400).json({ error: commercialError });

    if (campaignId) {
      const campaign = await Campaign.findByPk(campaignId);
      if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    }

    if (assignedToUserId) {
      const assignedUser = await User.findByPk(assignedToUserId);
      if (!assignedUser) return res.status(404).json({ error: 'Usuario asignado no encontrado' });
    }

    const previousStage = lead.pipelineStage;
    const previousAssignee = lead.assignedToUserId;

    const updates = {};
    await sequelize.transaction(async (transaction) => {
      if (status !== undefined) updates.status = status;
      if (notes !== undefined) updates.notes = notes;
      if (appointmentDate !== undefined) updates.appointmentDate = appointmentDate;
      if (source !== undefined) updates.source = source;
      if (campaignId !== undefined) updates.campaignId = campaignId;
      if (pipelineStage !== undefined) {
        updates.pipelineStage = pipelineStage;
        updates.status = legacyStatusFor(pipelineStage);
      }
      if (assignedToUserId !== undefined) {
        updates.assignedToUserId = assignedToUserId;
        updates.assignedAt = assignedToUserId ? new Date() : null;
      }
      Object.assign(updates, commercialFields);

      await lead.update(updates, { transaction });

      if (pipelineStage !== undefined && pipelineStage !== previousStage) {
        await logActivity({
          leadId: lead.id,
          type: 'sistema',
          content: `Etapa actualizada: ${previousStage} → ${pipelineStage}`,
          userId: req.user?.id ?? null,
          transaction,
        });
      }

      if (assignedToUserId !== undefined && assignedToUserId !== previousAssignee) {
        await logActivity({
          leadId: lead.id,
          type: 'reasignacion',
          content: 'Responsable cambiado',
          userId: req.user?.id ?? null,
          previousAssignedToUserId: previousAssignee,
          newAssignedToUserId: assignedToUserId,
          transaction,
        });
        // Un prospecto que no tenía responsable y recién se reclama obtiene su primera
        // "próxima acción" en este momento (ver decisión de diferir en createLead).
        if (assignedToUserId && !previousAssignee) {
          await ensureOpenTask({ leadId: lead.id, assignedToUserId, type: 'llamar', transaction });
        }
      }
    });

    logAudit(req, 'update', 'lead', lead.id, updates);

    return res.json({ message: 'Lead actualizado exitosamente', data: lead });
  } catch (error) {
    console.error('Error en updateLead:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/leads/:id/close-won
const closeLeadAsWon = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const lead = await Lead.findByPk(req.params.id, { transaction });
    if (!lead) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    if (!canEditLead(req.user, lead)) {
      await transaction.rollback();
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }
    // Un prospecto cerrado por error como "No interesado" se puede corregir a venta —
    // pero si ya está registrado como venta, no tiene caso repetirlo (ver "reversible
    // antes que perfecto" en CRM_UX_DESIGN.md).
    if (lead.pipelineStage === 'venta_realizada') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Este prospecto ya tiene una venta registrada' });
    }
    const wasLost = lead.pipelineStage === 'no_interesado';

    const { propertyId, amount, closedAt } = req.body;
    if (!propertyId || !amount) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Propiedad y monto son requeridos' });
    }

    const property = await Property.findByPk(propertyId, { transaction });
    if (!property) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    const deal = await Deal.create(
      {
        leadId: lead.id,
        propertyId,
        amount,
        closedAt: closedAt || new Date(),
      },
      { transaction }
    );

    await lead.update(
      {
        pipelineStage: 'venta_realizada',
        status: legacyStatusFor('venta_realizada'),
        // Limpia el motivo de pérdida si se está corrigiendo un cierre equivocado.
        closeReason: null,
        closeReasonDetail: null,
      },
      { transaction }
    );

    await logActivity({
      leadId: lead.id,
      type: 'sistema',
      content: wasLost
        ? `Venta registrada: ${property.title} (corrección de cierre anterior)`
        : `Venta registrada: ${property.title}`,
      userId: req.user?.id ?? null,
      transaction,
    });

    // Etapa terminal — no se crea una tarea siguiente.
    await closeOpenTask({ leadId: lead.id, transaction });

    await transaction.commit();

    logAudit(req, 'update', 'lead', lead.id, { closedAs: 'won', dealId: deal.id });

    return res.json({ message: 'Venta registrada exitosamente', data: { lead, deal } });
  } catch (error) {
    await transaction.rollback();
    console.error('Error en closeLeadAsWon:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/leads/:id/close-lost
const closeLeadAsLost = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const lead = await Lead.findByPk(req.params.id, { transaction });
    if (!lead) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    if (!canEditLead(req.user, lead)) {
      await transaction.rollback();
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }
    // Un prospecto marcado por error como "Venta realizada" se puede corregir a
    // perdido — pero si ya está marcado como perdido, no tiene caso repetirlo.
    if (lead.pipelineStage === 'no_interesado') {
      await transaction.rollback();
      return res.status(400).json({ error: 'Este prospecto ya está marcado como no interesado' });
    }
    const wasWon = lead.pipelineStage === 'venta_realizada';

    const { closeReason, closeReasonDetail } = req.body;
    if (!closeReason || !VALID_CLOSE_REASONS.includes(closeReason)) {
      await transaction.rollback();
      return res
        .status(400)
        .json({ error: `Motivo inválido. Valores permitidos: ${VALID_CLOSE_REASONS.join(', ')}` });
    }
    if (closeReason === 'otro' && !closeReasonDetail?.trim()) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Especifica el motivo en el detalle' });
    }

    // Un prospecto perdido no debe conservar el registro de venta de un cierre
    // anterior equivocado.
    if (wasWon) {
      await Deal.destroy({ where: { leadId: lead.id }, transaction });
    }

    await lead.update(
      {
        pipelineStage: 'no_interesado',
        status: legacyStatusFor('no_interesado'),
        closeReason,
        closeReasonDetail: closeReasonDetail || null,
      },
      { transaction }
    );

    await logActivity({
      leadId: lead.id,
      type: 'sistema',
      content: wasWon
        ? `Prospecto marcado como perdido: ${closeReason} (corrección de venta registrada por error)`
        : `Prospecto marcado como perdido: ${closeReason}`,
      userId: req.user?.id ?? null,
      transaction,
    });

    await closeOpenTask({ leadId: lead.id, transaction });

    await transaction.commit();

    logAudit(req, 'update', 'lead', lead.id, { closedAs: 'lost', closeReason });

    return res.json({ message: 'Prospecto cerrado', data: lead });
  } catch (error) {
    await transaction.rollback();
    console.error('Error en closeLeadAsLost:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PUT /api/leads/:id/reopen — única vía para sacar un prospecto de una etapa terminal.
// Reabrir no es "cambiar un campo": si venía de venta_realizada implica que la venta
// registrada ya no es válida (mismo criterio que closeLeadAsLost usa al corregir un cierre
// equivocado), y todo prospecto activo debe recuperar su Task abierta si tiene responsable.
const reopenLead = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const lead = await Lead.findByPk(req.params.id, { transaction });
    if (!lead) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Lead no encontrado' });
    }
    if (!canEditLead(req.user, lead)) {
      await transaction.rollback();
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }
    if (!TERMINAL_STAGES.includes(lead.pipelineStage)) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Este prospecto no está cerrado' });
    }

    const { pipelineStage: targetStage } = req.body;
    const resolvedTarget = targetStage || 'contactado';
    if (!REOPEN_STAGES.includes(resolvedTarget)) {
      await transaction.rollback();
      return res.status(400).json({
        error: `Etapa de reapertura inválida. Valores permitidos: ${REOPEN_STAGES.join(', ')}`,
      });
    }

    const previousStage = lead.pipelineStage;
    const wasWon = previousStage === 'venta_realizada';

    // La venta registrada deja de ser válida si el prospecto se reabre — igual que al
    // corregir un cierre equivocado en closeLeadAsLost.
    if (wasWon) {
      await Deal.destroy({ where: { leadId: lead.id }, transaction });
    }

    await lead.update(
      {
        pipelineStage: resolvedTarget,
        status: legacyStatusFor(resolvedTarget),
        closeReason: null,
        closeReasonDetail: null,
      },
      { transaction }
    );

    await logActivity({
      leadId: lead.id,
      type: 'sistema',
      content: wasWon
        ? `Prospecto reabierto (antes: ${previousStage} — se eliminó la venta registrada)`
        : `Prospecto reabierto (antes: ${previousStage})`,
      userId: req.user?.id ?? null,
      transaction,
    });

    // Restaura la invariante "todo prospecto activo con responsable tiene una task
    // abierta" — closeOpenTask la había cerrado al cerrar el prospecto y nada más la
    // vuelve a crear automáticamente.
    if (lead.assignedToUserId) {
      await ensureOpenTask({
        leadId: lead.id,
        assignedToUserId: lead.assignedToUserId,
        type: 'llamar',
        transaction,
      });
    }

    await transaction.commit();

    logAudit(req, 'update', 'lead', lead.id, {
      reopened: true,
      fromStage: previousStage,
      toStage: resolvedTarget,
      dealDeleted: wasWon,
    });

    return res.json({ message: 'Prospecto reabierto exitosamente', data: lead });
  } catch (error) {
    await transaction.rollback();
    console.error('Error en reopenLead:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/leads/:id
const deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });

    await lead.destroy();
    logAudit(req, 'delete', 'lead', req.params.id, { name: lead.name });
    return res.json({ message: 'Lead eliminado exitosamente' });
  } catch (error) {
    console.error('Error en deleteLead:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// PATCH /api/leads/batch — restringido a etapas no terminales; usar los endpoints de
// cierre individuales para venta_realizada/no_interesado (necesitan datos adicionales).
const batchUpdateLeads = async (req, res) => {
  try {
    const { pipelineStage } = req.body;
    const { error: idsError, ids } = validateBatchIds(req.body.ids);
    if (idsError) return res.status(400).json({ error: idsError });
    if (!pipelineStage) return res.status(400).json({ error: 'pipelineStage requerido' });
    if (!VALID_PIPELINE_STAGES.includes(pipelineStage)) {
      return res
        .status(400)
        .json({ error: `Etapa inválida. Valores permitidos: ${VALID_PIPELINE_STAGES.join(', ')}` });
    }
    if (TERMINAL_STAGES.includes(pipelineStage)) {
      return res.status(400).json({
        error:
          'Para cerrar prospectos usa los endpoints de cierre individuales (/close-won, /close-lost)',
      });
    }

    // Rechaza el lote completo si incluye algún lead fuera del alcance del actor — sin
    // escritura parcial (consistente con el resto de la validación de este endpoint, que
    // también rechaza todo-o-nada ante cualquier valor inválido).
    const leadsToUpdate = await Lead.findAll({ where: { id: ids } });
    if (leadsToUpdate.some((l) => !canEditLead(req.user, l))) {
      return res
        .status(403)
        .json({ error: 'No tienes acceso a uno o más de los prospectos seleccionados' });
    }

    await Lead.update(
      { pipelineStage, status: legacyStatusFor(pipelineStage) },
      { where: { id: ids } }
    );
    logAudit(req, 'update', 'lead', null, { ids, pipelineStage });
    return res.json({ message: `${ids.length} lead(s) actualizados` });
  } catch (error) {
    console.error('Error en batchUpdateLeads:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/leads/batch
const batchDeleteLeads = async (req, res) => {
  try {
    const { error: idsError, ids } = validateBatchIds(req.body.ids);
    if (idsError) return res.status(400).json({ error: idsError });
    await Lead.destroy({ where: { id: ids } });
    logAudit(req, 'delete', 'lead', null, { ids });
    return res.json({ message: `${ids.length} lead(s) eliminados` });
  } catch (error) {
    console.error('Error en batchDeleteLeads:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// GET /api/leads/stream — notificaciones en tiempo real vía Server-Sent Events
const streamLeads = (req, res) => {
  // CORS headers must be set explicitly here — the cors() middleware may not flush
  // them before flushHeaders() is called for long-lived SSE connections.
  // Only reflect the origin if it's in the whitelist (utils/corsOrigins.js — the same
  // one used by the main cors() middleware in app.js) to prevent credential leaks.
  const origin = req.headers.origin;
  if (isOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(': conectado\n\n');

  const onNewLead = (lead) => {
    res.write(`event: new-lead\ndata: ${JSON.stringify(lead)}\n\n`);
  };
  leadEvents.on('new-lead', onNewLead);

  // Mantiene viva la conexión a través de proxies/balanceadores
  const heartbeat = setInterval(() => res.write(': ping\n\n'), 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
    leadEvents.off('new-lead', onNewLead);
  });
};

// GET /api/leads/:id/notes
const getLeadNotes = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (!canViewLead(req.user, lead)) {
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }

    const notes = await LeadNote.findAll({
      where: { leadId: req.params.id },
      order: [['createdAt', 'DESC']],
    });

    return res.json({ data: notes });
  } catch (error) {
    console.error('Error en getLeadNotes:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/leads/:id/notes
const addLeadNote = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (!canViewLead(req.user, lead)) {
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }

    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ error: 'Contenido requerido' });

    const note = await LeadNote.create({
      leadId: lead.id,
      content: content.trim(),
      authorName: req.user?.name || null,
      userId: req.user?.id ?? null,
    });

    logAudit(req, 'update', 'lead', lead.id, { addedNote: note.id });

    return res.status(201).json({ data: note });
  } catch (error) {
    console.error('Error en addLeadNote:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// DELETE /api/leads/:id/notes/:noteId
const deleteLeadNote = async (req, res) => {
  try {
    const note = await LeadNote.findOne({
      where: { id: req.params.noteId, leadId: req.params.id },
    });
    if (!note) return res.status(404).json({ error: 'Nota no encontrada' });

    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    // Cualquiera puede borrar su propia nota; borrar la de alguien más requiere permiso
    // de edición sobre el lead (admin/coordinador_ventas, o el asesor/capturista dueño).
    if (!canEditLead(req.user, lead) && note.userId !== req.user.id) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar esta nota' });
    }

    await note.destroy();
    logAudit(req, 'update', 'lead', req.params.id, { removedNote: req.params.noteId });
    return res.json({ message: 'Nota eliminada' });
  } catch (error) {
    console.error('Error en deleteLeadNote:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

// POST /api/leads/:id/whatsapp
const sendLeadWhatsApp = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
    if (!canViewLead(req.user, lead)) {
      return res.status(403).json({ error: 'No tienes acceso a este prospecto' });
    }

    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Mensaje requerido' });
    if (!lead.phone)
      return res.status(400).json({ error: 'Este lead no tiene un teléfono registrado' });

    const agentName = req.user?.name || 'Triomphe Bienes Raíces';
    let warning = null;
    let sendError = null;

    if (!isWhatsappConfigured()) {
      warning =
        'WhatsApp no está configurado en el servidor; se guardó la nota de seguimiento pero el mensaje no se envió.';
    } else {
      // AUDIT-009: antes, si esto lanzaba (token expirado, plantilla no aprobada, teléfono
      // inválido), el catch exterior se saltaba la creación de LeadNote y el audit log,
      // perdiendo todo rastro de que se intentó el contacto.
      try {
        await sendLeadFollowUpWhatsApp(lead.phone, lead.name, agentName, message.trim());
      } catch (whatsappError) {
        sendError = whatsappError;
        logger.error('Error enviando WhatsApp de seguimiento', {
          leadId: lead.id,
          error: whatsappError.message,
        });
        warning =
          'No se pudo enviar el mensaje de WhatsApp (revisa el teléfono o la configuración del servicio). Se guardó el intento en el seguimiento.';
      }
    }

    const note = await LeadNote.create({
      leadId: lead.id,
      content: sendError
        ? `WhatsApp NO enviado (falló el envío): ${message.trim()}`
        : `WhatsApp enviado: ${message.trim()}`,
      authorName: req.user?.name || null,
      userId: req.user?.id ?? null,
    });

    logAudit(req, 'update', 'lead', lead.id, {
      whatsapp: true,
      success: !sendError,
      error: sendError?.message || null,
    });

    return res.json({ message: warning || 'Mensaje de WhatsApp enviado', data: note, warning });
  } catch (error) {
    console.error('Error en sendLeadWhatsApp:', error);
    return res.status(500).json({ error: 'Error al enviar el mensaje de WhatsApp' });
  }
};

module.exports = {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  batchUpdateLeads,
  batchDeleteLeads,
  streamLeads,
  getLeadNotes,
  addLeadNote,
  deleteLeadNote,
  sendLeadWhatsApp,
  closeLeadAsWon,
  closeLeadAsLost,
  reopenLead,
};
