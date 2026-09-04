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
  PropertyAlert,
} = require('../models/index');
const {
  VALID_CITIES: VALID_ALERT_CITIES,
  VALID_TYPES: VALID_ALERT_TYPES,
} = require('../utils/propertyAlertValidation');

// AUDIT-024: valores permitidos explícitos en vez de confiar solo en el ENUM de MySQL —
// falla con un 400 claro en vez de un error 500 genérico de Sequelize si llega un valor inválido.
const VALID_LEAD_STATUS = ['nuevo', 'contactado', 'cerrado', 'descartado'];
const VALID_LEAD_SOURCE = ['google', 'facebook', 'whatsapp', 'directo', 'referido', 'otro'];
// CRM Comercial — mismo patrón de arrays explícitos para las nuevas ENUMs.
const VALID_PIPELINE_STAGES = [
  'nuevo',
  'contactado',
  'interesado',
  'negociacion',
  'cita_agendada',
  'cita_realizada',
  'cita_con_seguimiento',
  'venta_realizada',
  'no_interesado',
  'lista_espera',
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
// Rediseño CRM — "¿qué está buscando?" estructurado. searchCity/desiredType reutilizan los
// mismos valores que Property.city/Property.type (vía VALID_ALERT_CITIES/VALID_ALERT_TYPES,
// ya importados arriba para sendLeadToWaitingList) en vez de duplicar los arrays.
const VALID_URGENCY = ['inmediata', '1_3_meses', '3_6_meses', 'mas_6_meses'];
// Se elige manualmente al crear/editar el prospecto — a diferencia de Property, un lead no
// siempre tiene una propiedad asociada de la que derivarlo (ver Lead.js businessLine). Mismos
// 5 valores que Property.businessLine.
const VALID_BUSINESS_LINES = ['remate', 'credito', 'renta', 'contado', 'inversion'];

// Línea de negocio del lead inferida de la propiedad de origen — Property.businessLine ya es
// directamente una de las 5 líneas, así que se copia tal cual.
function inferBusinessLineFromProperty(property) {
  return property?.businessLine ?? null;
}
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
// CAL-001: zona horaria de referencia para las reglas de "horario comercial" de citas —
// Chihuahua (sede principal, ver OFFICES en client/src/utils/constants.js) no observa
// horario de verano desde la reforma de 2022, así que su offset es fijo (UTC-6) todo el
// año. Ciudad Juárez, en cambio, sí sigue el horario de verano de EE. UU. por ser
// frontera — un `Intl.DateTimeFormat` con IANA timezone (no un offset fijo) es lo que
// permite manejar esa clase de reglas correctamente si en el futuro se necesita
// diferenciar por ciudad; por ahora, sin ese contexto de ciudad disponible en este punto,
// se usa una sola zona de referencia para todo el negocio.
const APPOINTMENT_BUSINESS_TIMEZONE = 'America/Chihuahua';

// Devuelve la hora (0-23) y el día de la semana de `date` EN la zona horaria indicada,
// usando el tz database de ICU (bundled con Node) — nunca aritmética manual de offsets,
// que se rompería en cualquier ciudad/fecha con horario de verano.
function getZonedHourAndWeekday(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hour12: false, hour: '2-digit', weekday: 'short' })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  // Algunas versiones de ICU devuelven "24" para la medianoche con hour12:false.
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  return { hour, weekday: parts.weekday };
}

// No existe todavía un sistema de disponibilidad (el Appointment/Calendario es admin-only,
// sin endpoint público de horarios ocupados) — esto valida solo las reglas de negocio
// (24h de anticipación, horario/día hábil), no choques de horario entre citas.
//
// CAL-001: `appointmentDate` llega como un ISO string YA convertido a UTC explícito (con
// sufijo Z) por el cliente (ver ContactForm.jsx) — antes llegaba como un string "naive"
// (sin zona horaria) y la hora se leía con una regex directamente del texto para evitar
// depender de la zona horaria del proceso del servidor. Ahora que el string SÍ es UTC
// real, leer la hora así devolvería la hora UTC, no la de México. `getZonedHourAndWeekday`
// convierte correctamente el instante UTC a la zona horaria de negocio usando el tz
// database de ICU, sea cual sea la zona horaria del proceso donde corra Node.
function validateAppointmentDate(appointmentDate) {
  if (!appointmentDate) return { error: 'Fecha y hora de la cita son requeridas' };

  const date = new Date(appointmentDate);
  if (Number.isNaN(date.getTime())) return { error: 'Fecha y hora de la cita inválidas' };

  const { hour, weekday } = getZonedHourAndWeekday(date, APPOINTMENT_BUSINESS_TIMEZONE);

  if (hour < APPOINTMENT_MIN_HOUR || hour >= APPOINTMENT_MAX_HOUR) {
    return {
      error: `El horario debe estar entre las ${APPOINTMENT_MIN_HOUR}:00 AM y las ${APPOINTMENT_MAX_HOUR - 12}:00 PM`,
    };
  }

  if (weekday === 'Sat' || weekday === 'Sun') {
    return { error: 'No se pueden agendar citas en fin de semana' };
  }

  if (date.getTime() - Date.now() < APPOINTMENT_MIN_LEAD_MS) {
    return { error: 'La cita debe programarse con al menos 24 horas de anticipación' };
  }

  return { date };
}

// Normaliza forma de pago / monto disponible / fecha de primer contacto / criterios de
// búsqueda (zona, tipo, recámaras/baños, características, urgencia) — usado tanto por
// createLead como updateLead para no duplicar las reglas de validación.
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

  if (body.businessLine !== undefined) {
    if (body.businessLine !== null && !VALID_BUSINESS_LINES.includes(body.businessLine)) {
      return {
        error: `Línea de negocio inválida. Valores permitidos: ${VALID_BUSINESS_LINES.join(', ')}`,
      };
    }
    values.businessLine = body.businessLine || null;
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

  if (body.searchCity !== undefined) {
    if (body.searchCity !== null && !VALID_ALERT_CITIES.includes(body.searchCity)) {
      return { error: `Ciudad de búsqueda inválida. Valores permitidos: ${VALID_ALERT_CITIES.join(', ')}` };
    }
    values.searchCity = body.searchCity || null;
  }

  if (body.searchZone !== undefined) {
    values.searchZone = body.searchZone ? body.searchZone.trim().slice(0, 150) : null;
  }

  if (body.desiredType !== undefined) {
    if (body.desiredType !== null && !VALID_ALERT_TYPES.includes(body.desiredType)) {
      return { error: `Tipo de propiedad inválido. Valores permitidos: ${VALID_ALERT_TYPES.join(', ')}` };
    }
    values.desiredType = body.desiredType || null;
  }

  for (const key of ['minBedrooms', 'minBathrooms']) {
    if (body[key] === undefined) continue;
    if (body[key] === null || body[key] === '') {
      values[key] = null;
      continue;
    }
    const parsed = Number(body[key]);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return { error: `${key === 'minBedrooms' ? 'Recámaras' : 'Baños'} mínimos inválido` };
    }
    values[key] = parsed;
  }

  if (body.desiredFeatures !== undefined) {
    values.desiredFeatures = body.desiredFeatures ? body.desiredFeatures.trim() : null;
  }

  if (body.urgency !== undefined) {
    if (body.urgency !== null && !VALID_URGENCY.includes(body.urgency)) {
      return { error: `Urgencia inválida. Valores permitidos: ${VALID_URGENCY.join(', ')}` };
    }
    values.urgency = body.urgency || null;
  }

  return { values };
}
const { validateEmail, validatePhone, normalizePhone } = require('../utils/validators');
const { formatPrice } = require('../utils/formatters');
const { sendNewLeadNotification, sendLeadConfirmation } = require('../services/emailService');
const {
  sendLeadFollowUpWhatsApp,
  isConfigured: isWhatsappConfigured,
} = require('../services/whatsappService');
const { logAudit, snapshotFields, buildChanges } = require('../utils/audit');
const leadEvents = require('../utils/leadEvents');
const { paginate } = require('../utils/pagination');
const logger = require('../utils/logger');
const { isOriginAllowed } = require('../utils/corsOrigins');
const { validateBatchIds } = require('../utils/batchValidation');
const {
  TERMINAL_STAGES,
  logActivity,
  legacyStatusFor,
  staleSinceExpr,
} = require('../utils/pipelineHelpers');
const {
  crmAccessLevel,
  getTeamUserIds,
  getLeadVisibilityWhere,
  canViewLead,
  canEditLead,
  canAssignLeadTo,
} = require('../utils/leadAccess');
const { ApiError } = require('../middleware/errorHandler');
// Etapas a las que un prospecto cerrado puede volver al reabrirse — cualquier etapa no
// terminal es un destino válido para PUT /:id/reopen.
const REOPEN_STAGES = VALID_PIPELINE_STAGES.filter((s) => !TERMINAL_STAGES.includes(s));

// Pedido del dueño del negocio: un mismo teléfono no puede repetirse entre prospectos. La
// comparación es por valor normalizado (normalizePhone), no por string exacto — el teléfono
// se guarda tal cual lo capturó quien lo creó (con o sin +52, con o sin separadores, ver
// CreateLeadModal.jsx que no fuerza formato), así que "656-123-4567" y "6561234567" deben
// detectarse como el mismo número aunque el texto guardado sea distinto.
//
// DB-001: antes esto traía toda la tabla (`Lead.findAll` sin WHERE) y comparaba en
// JavaScript porque no había forma barata de normalizar en SQL las variantes de formato de
// `phone` — full-table-scan en la ruta más transitada del CRM, y una condición de carrera
// real (dos creaciones casi simultáneas del mismo teléfono podían pasar esta comprobación
// antes de que cualquiera hubiera insertado). Ahora `phoneNormalized` (columna mantenida
// por un hook del modelo, ver models/Lead.js) tiene un índice único: este lookup ya es
// directo/indexado, y el índice único de la base de datos es el respaldo real contra la
// condición de carrera — ver el catch de ER_DUP_ENTRY en createLead/updateLead, que
// traduce una violación de esa restricción al mismo error de negocio que este chequeo.
async function findDuplicatePhoneLead(phone, excludeId) {
  const target = normalizePhone(phone);
  if (!target) return null;

  return Lead.findOne({
    attributes: ['id', 'name', 'phone'],
    where: {
      phoneNormalized: target,
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
    },
  });
}

// DB-001: `findDuplicatePhoneLead` de arriba es un check-then-insert — dos creaciones/
// ediciones casi simultáneas del mismo teléfono todavía podrían pasarlo ambas antes de que
// cualquiera commitee. El respaldo real contra esa carrera es el índice único de
// `phoneNormalized` en la base de datos (migración 20260901000000): si de todos modos
// ambas llegan a intentar el INSERT/UPDATE, MySQL rechaza a la segunda con ER_DUP_ENTRY.
// Esto traduce esa violación al mismo error de negocio (409) que ya usa el chequeo previo,
// en vez de dejar que se propague como un 500 crudo de Sequelize.
function isDuplicatePhoneConstraintError(error) {
  if (error?.name !== 'SequelizeUniqueConstraintError') return false;
  // Sequelize indexa `error.fields` por el NOMBRE DEL ÍNDICE de MySQL cuando lo puede leer
  // del mensaje de error del driver (no siempre por el nombre de columna) — verificado
  // directamente contra un ER_DUP_ENTRY real: `fields` viene como
  // `{ idx_leads_phone_normalized_unique: '...' }`, no `{ phoneNormalized: '...' }`.
  const fieldKeys = Object.keys(error.fields || {});
  return fieldKeys.includes('phoneNormalized') || fieldKeys.includes('idx_leads_phone_normalized_unique');
}

// POST /api/leads
const createLead = async (req, res) => {
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
    // Fase 3a del rediseño del CRM — atribución de marketing, capturada automáticamente
    // por el frontend desde la URL (ver ContactForm.jsx), nunca preguntada al prospecto.
    utmMedium,
    utmCampaign,
    utmContent,
  } = req.body;

  // Nombre ya no es obligatorio: un prospecto capturado de prisa (llamada, feria) a
  // veces solo trae teléfono. Se usa un placeholder en vez de dejarlo null para no
  // tener que blindar cada vista/email que ya asume lead.name como string.
  const resolvedName = (name && name.trim()) || 'Prospecto sin nombre';
  // CRM Comercial: email ya no es obligatorio (prospectos de solo-WhatsApp/Facebook).
  if (email && !validateEmail(email)) {
    throw new ApiError(400, 'Email inválido');
  }

  // El teléfono es obligatorio para el formulario público "Contactar asesor" (mejora la
  // calidad de los prospectos captados) pero se mantiene opcional para la captura manual
  // del CRM (CreateLeadModal / "Nuevo prospecto"), donde req.user viene presente porque
  // el equipo comercial ya está autenticado — ver attachUserIfPresent en routes/leads.js.
  if (!req.user && (!phone || !phone.trim())) {
    throw new ApiError(400, 'Teléfono es requerido');
  }

  if (!validatePhone(phone)) {
    throw new ApiError(400, 'Teléfono inválido — usa 10 dígitos, con o sin +52');
  }

  if (phone) {
    const duplicate = await findDuplicatePhoneLead(phone);
    if (duplicate) {
      throw new ApiError(409, `Ya existe un prospecto con este teléfono: ${duplicate.name}`);
    }
  }

  // CRM de Leads: un Asesor de Ventas SÍ puede crear prospectos manualmente (pedido
  // explícito del dueño del negocio, excepción a la regla original de "solo trabaja lo que
  // ya se le asignó") — pero SIEMPRE quedan asignados a él mismo, nunca puede elegir otro
  // responsable, sin importar qué venga en el body (no se confía en el cliente). El caso de
  // uso típico es agendarle una cita de inmediato desde el Calendario cuando no encuentra al
  // prospecto ya capturado (ver AgendarCitaModal.jsx).
  //
  // BUG real reportado por el dueño del negocio: esta rama antes solo revisaba
  // `assignedToUserId && req.user && !canAssignLeads(req.user)` — como el `&& req.user`
  // cortocircuitaba a `false` en cuanto NO había usuario autenticado, una request pública
  // (sin token, ej. el formulario "Contactar asesor") que incluyera `assignedToUserId` en
  // el body pasaba de largo sin ningún chequeo y el valor inyectado se guardaba tal cual —
  // cualquiera, sin sesión, podía preasignar un prospecto público a cualquier usuario.
  // Ahora el `else if` cubre explícitamente el caso "no hay usuario que pueda asignar"
  // (`!req.user`), no solo "hay usuario pero no puede".
  let resolvedAssignedToUserId = null;
  if (req.user && crmAccessLevel(req.user) === 'asesor_ventas') {
    resolvedAssignedToUserId = req.user.id;
  } else if (assignedToUserId) {
    // Un coordinador puede asignar de una vez a sí mismo o a un asesor de su equipo (ver
    // canAssignLeadTo); admin/asistente pueden asignar a cualquiera, sin cambios.
    if (!req.user || !canAssignLeadTo(req.user, assignedToUserId)) {
      throw new ApiError(403, 'No tienes permisos para asignar un responsable');
    }
    resolvedAssignedToUserId = assignedToUserId;
  }

  if (type && !VALID_LEAD_TYPE.includes(type)) {
    throw new ApiError(
      400,
      `Motivo de contacto inválido. Valores permitidos: ${VALID_LEAD_TYPE.join(', ')}`
    );
  }

  const resolvedType = type || 'contacto';
  if (resolvedType === 'cita') {
    const { error: appointmentError } = validateAppointmentDate(appointmentDate);
    if (appointmentError) throw new ApiError(400, appointmentError);
  }

  const { error: commercialError, values: commercialFields } = parseCommercialFields(req.body);
  if (commercialError) throw new ApiError(400, commercialError);

  let property = null;
  if (propertyId) {
    property = await Property.findByPk(propertyId);
    if (!property) throw new ApiError(404, 'Propiedad no encontrada');
  }
  // Si no vino explícita en el body, se infiere de la propiedad de origen — así el
  // formulario público no tiene que preguntarla y el asesor la ve lista en el CRM.
  const resolvedBusinessLine =
    commercialFields.businessLine !== undefined
      ? commercialFields.businessLine
      : inferBusinessLineFromProperty(property);

  let resolvedCampaignId = campaignId || null;
  if (resolvedCampaignId) {
    const campaign = await Campaign.findByPk(resolvedCampaignId);
    if (!campaign) throw new ApiError(404, 'Campaña no encontrada');
  }

  if (assignedToUserId) {
    const assignedUser = await User.findByPk(assignedToUserId);
    if (!assignedUser) throw new ApiError(404, 'Usuario asignado no encontrado');
  }

  let lead;
  try {
    lead = await sequelize.transaction(async (transaction) => {
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
        campaignId: resolvedCampaignId,
        assignedToUserId: resolvedAssignedToUserId,
        assignedAt: resolvedAssignedToUserId ? new Date() : null,
        createdByUserId: req.user?.id ?? null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        utmContent: utmContent || null,
        // Referer refleja la página exacta desde la que el navegador envió este POST
        // (mismo header que ya usa Analytics para el evento "contact") — nunca lo escribe
        // un humano.
        landingPageUrl: req.headers['referer'] || null,
        ...commercialFields,
        businessLine: resolvedBusinessLine,
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
          createdByUserId: req.user?.id ?? null,
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

    return created;
    });
  } catch (error) {
    if (isDuplicatePhoneConstraintError(error)) {
      throw new ApiError(409, 'Ya existe un prospecto con este teléfono');
    }
    throw error;
  }

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
    // SEC-003/BUG-001: streamLeads necesita este campo para poder aplicar canViewLead por
    // conexión antes de reenviar el evento — sin él no hay forma de saber si el prospecto
    // es visible para un `asesor_ventas` conectado al stream.
    assignedToUserId: lead.assignedToUserId,
    property: property ? { id: property.id, title: property.title } : null,
  });

  return res.status(201).json({
    message: 'Mensaje enviado exitosamente. Un asesor se pondrá en contacto contigo pronto.',
    data: { id: lead.id },
  });
};

// GET /api/leads
const getLeads = async (req, res) => {
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
    staleDays,
    allStages,
  } = req.query;
  const where = {};

  if (status) where.status = status;
  if (type) where.type = type;
  if (source) where.source = source;
  if (propertyId) where.propertyId = propertyId;
  if (pipelineStage) where.pipelineStage = pipelineStage;
  if (campaignId) where.campaignId = campaignId;
  if (assignedToUserId) where.assignedToUserId = assignedToUserId;
  // Búsqueda instantánea — mismo patrón Op.or/Op.like que propertyController.
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }

  // staleDays: prospectos sin actividad hace N+ días — ver staleSinceExpr() en
  // pipelineHelpers.js. Entero positivo requerido; no restringido a los 4 valores del
  // <select> del CRM (5/10/15/30) porque el deep link del Dashboard usa 7.
  let staleCutoff = null;
  if (staleDays !== undefined) {
    const staleDaysNum = Number(staleDays);
    if (!Number.isInteger(staleDaysNum) || staleDaysNum <= 0) {
      throw new ApiError(400, 'staleDays debe ser un entero positivo');
    }
    staleCutoff = new Date(Date.now() - staleDaysNum * 24 * 60 * 60 * 1000);
  }

  Object.assign(where, getLeadVisibilityWhere(req.user) || {});

  // Los prospectos enviados a lista de espera o que ya cerraron como venta realizada
  // desaparecen de "Todas las etapas" — siguen accesibles filtrando explícitamente por esa
  // etapa (o, para venta_realizada, también en CasosExitoSection, que lee la tabla `deals`
  // en vez de Lead). No_interesado NO se toca (decisión explícita: solo se ordena al final,
  // sigue visible, ver comentario de abajo).
  // ?allStages=true se salta este default — lo usa CampanasSection para listar TODOS los
  // prospectos de una campaña (incluidos lista de espera y venta realizada): ahí el punto es
  // completitud frente al conteo de "Prospectos generados" de getCampaignById (Lead.count sin
  // filtrar por etapa), no la vista de triage de "Todas las etapas".
  if (!pipelineStage && allStages !== 'true') {
    where.pipelineStage = { [Op.notIn]: ['lista_espera', 'venta_realizada'] };
  }

  // Un lead en etapa terminal no puede estar "estancado" (un cierre no atendido no es un
  // problema). Se compone como Op.and (no se sobrescribe where.pipelineStage) para que
  // conviva con un ?pipelineStage= explícito — si se combina "Negociación" + "10+ días", el
  // resultado sigue siendo prospectos en Negociación con 10+ días sin tocar; si se combina
  // una etapa terminal explícita + staleDays, el resultado correcto es 0 filas.
  if (staleCutoff) {
    where[Op.and] = [
      ...(where[Op.and] || []),
      { pipelineStage: { [Op.notIn]: TERMINAL_STAGES } },
      sequelize.where(sequelize.literal(staleSinceExpr()), Op.lt, staleCutoff),
    ];
  }

  // Pedido del dueño del negocio: en la vista "Todas las etapas" (sin filtro explícito de
  // pipelineStage) los prospectos "No interesado" quedaban mezclados por fecha con los
  // activos, enterrando lo accionable. Se mandan al final en vez de ocultarse (siguen
  // apareciendo si se filtra explícitamente a esa etapa) — orden por SQL, no en el cliente,
  // para que la página siga siendo correcta con la paginación.
  const order = pipelineStage
    ? [['createdAt', 'DESC']]
    : [
        [sequelize.literal("(pipelineStage = 'no_interesado')"), 'ASC'],
        ['createdAt', 'DESC'],
      ];

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
    order,
    ...(staleCutoff && {
      attributes: { include: [[sequelize.literal(staleSinceExpr()), 'lastTouchedAt']] },
    }),
  });

  return res.json(result);
};

// GET /api/leads/:id
const getLeadById = async (req, res) => {
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

  if (!lead) throw new ApiError(404, 'Lead no encontrado');
  if (!canViewLead(req.user, lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }
  return res.json({ data: lead });
};

// PUT /api/leads/:id
const updateLead = async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');

  const {
    status,
    notes,
    appointmentDate,
    source,
    pipelineStage,
    assignedToUserId,
    campaignId,
    name,
    email,
    phone,
    type,
    propertyId,
  } = req.body;

  // Un coordinador no tiene edición general sobre los leads de su equipo (canEditLead es
  // false salvo que el lead ya sea suyo) — pero sí puede reasignar uno que sea de su
  // equipo, siempre que la request solo traiga ese campo (nada de colarse una edición
  // general vía este atajo) y el nuevo responsable también sea válido para él (ver
  // canAssignLeadTo). admin/asistente/asesor no usan esta rama: canEditLead ya los cubre.
  const canEdit = canEditLead(req.user, lead);
  const onlyAssignmentField = Object.keys(req.body).every(
    (k) => req.body[k] === undefined || k === 'assignedToUserId'
  );
  const wantsReassignOnly =
    !canEdit &&
    crmAccessLevel(req.user) === 'coordinador_ventas' &&
    onlyAssignmentField &&
    assignedToUserId !== undefined &&
    getTeamUserIds(req.user).includes(lead.assignedToUserId) &&
    canAssignLeadTo(req.user, assignedToUserId);

  if (!canEdit && !wantsReassignOnly) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  // Asignar/reasignar responsable: admin/asistente a cualquiera, coordinador solo a sí
  // mismo o a un asesor de su equipo (ver canAssignLeadTo) — un asesor con permiso de
  // edición sobre este lead puede seguir cambiando otros campos, solo no este.
  if (assignedToUserId !== undefined && !canAssignLeadTo(req.user, assignedToUserId)) {
    throw new ApiError(403, 'No tienes permisos para asignar este responsable');
  }
  if (status !== undefined && !VALID_LEAD_STATUS.includes(status)) {
    throw new ApiError(400, `Estatus inválido. Valores permitidos: ${VALID_LEAD_STATUS.join(', ')}`);
  }
  if (source !== undefined && !VALID_LEAD_SOURCE.includes(source)) {
    throw new ApiError(400, `Fuente inválida. Valores permitidos: ${VALID_LEAD_SOURCE.join(', ')}`);
  }
  // Edición de información básica de contacto — mismo patrón de validación que createLead
  // (validateEmail/validatePhone, VALID_LEAD_TYPE), pero aquí cada campo es opcional en el
  // body: solo se valida/actualiza lo que realmente vino en la petición.
  if (name !== undefined && (!name || !name.trim())) {
    throw new ApiError(400, 'El nombre es requerido');
  }
  if (email !== undefined && email && !validateEmail(email)) {
    throw new ApiError(400, 'Email inválido');
  }
  if (phone !== undefined && !validatePhone(phone)) {
    throw new ApiError(400, 'Teléfono inválido — usa 10 dígitos, con o sin +52');
  }
  if (phone) {
    const duplicate = await findDuplicatePhoneLead(phone, lead.id);
    if (duplicate) {
      throw new ApiError(409, `Ya existe un prospecto con este teléfono: ${duplicate.name}`);
    }
  }
  if (type !== undefined && !VALID_LEAD_TYPE.includes(type)) {
    throw new ApiError(
      400,
      `Motivo de contacto inválido. Valores permitidos: ${VALID_LEAD_TYPE.join(', ')}`
    );
  }
  if (pipelineStage !== undefined) {
    if (!VALID_PIPELINE_STAGES.includes(pipelineStage)) {
      throw new ApiError(
        400,
        `Etapa inválida. Valores permitidos: ${VALID_PIPELINE_STAGES.join(', ')}`
      );
    }
    // Las etapas terminales solo se alcanzan a través de /close-won o /close-lost, que
    // capturan los datos obligatorios (monto+propiedad, o motivo) en la misma transacción.
    if (TERMINAL_STAGES.includes(pipelineStage)) {
      throw new ApiError(
        400,
        'Para cerrar un prospecto o mandarlo a lista de espera usa PUT /:id/close-won, PUT /:id/close-lost o PUT /:id/send-to-waiting-list'
      );
    }
    // AUDIT: simétrico al bloqueo de arriba — un lead ya cerrado tampoco puede salir de
    // su etapa terminal por esta vía genérica, porque cerrar/reabrir tiene efectos
    // colaterales (Deal, Activity) que este endpoint no conoce. Usa PUT /:id/reopen.
    if (TERMINAL_STAGES.includes(lead.pipelineStage)) {
      throw new ApiError(400, 'Este prospecto está cerrado — usa PUT /:id/reopen para reactivarlo');
    }
  }

  const { error: commercialError, values: commercialFields } = parseCommercialFields(req.body);
  if (commercialError) throw new ApiError(400, commercialError);

  if (campaignId) {
    const campaign = await Campaign.findByPk(campaignId);
    if (!campaign) throw new ApiError(404, 'Campaña no encontrada');
  }

  if (assignedToUserId) {
    const assignedUser = await User.findByPk(assignedToUserId);
    if (!assignedUser) throw new ApiError(404, 'Usuario asignado no encontrado');
  }

  // La propiedad de origen (con la que llegó el prospecto) es editable después de creado —
  // a veces el interés real se aclara/cambia en una llamada posterior. `null` la desvincula.
  let newProperty = null;
  if (propertyId !== undefined && propertyId !== null) {
    newProperty = await Property.findByPk(propertyId);
    if (!newProperty) throw new ApiError(404, 'Propiedad no encontrada');
  }

  const previousStage = lead.pipelineStage;
  const previousAssignee = lead.assignedToUserId;
  const previousPropertyId = lead.propertyId;

  const updates = {};
  let beforeSnapshot = {};
  try {
  await sequelize.transaction(async (transaction) => {
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (appointmentDate !== undefined) updates.appointmentDate = appointmentDate;
    if (source !== undefined) updates.source = source;
    if (campaignId !== undefined) updates.campaignId = campaignId;
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email ? email.trim() : null;
    if (phone !== undefined) updates.phone = phone ? phone.trim() : null;
    if (type !== undefined) updates.type = type;
    if (propertyId !== undefined) updates.propertyId = newProperty ? newProperty.id : null;
    if (pipelineStage !== undefined) {
      updates.pipelineStage = pipelineStage;
      updates.status = legacyStatusFor(pipelineStage);
    }
    if (assignedToUserId !== undefined) {
      updates.assignedToUserId = assignedToUserId;
      updates.assignedAt = assignedToUserId ? new Date() : null;
    }
    Object.assign(updates, commercialFields);

    beforeSnapshot = snapshotFields(lead, Object.keys(updates));
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

    if (propertyId !== undefined && newProperty?.id !== previousPropertyId) {
      const previousProperty = previousPropertyId
        ? await Property.findByPk(previousPropertyId, { attributes: ['title'], transaction })
        : null;
      const from = previousProperty?.title || 'ninguna propiedad';
      const to = newProperty?.title || 'ninguna propiedad';
      await logActivity({
        leadId: lead.id,
        type: 'sistema',
        content: `Propiedad de interés actualizada: ${from} → ${to}`,
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
    }
  });
  } catch (error) {
    if (isDuplicatePhoneConstraintError(error)) {
      throw new ApiError(409, 'Ya existe un prospecto con este teléfono');
    }
    throw error;
  }

  logAudit(req, 'update', 'lead', lead.id, { changes: buildChanges(beforeSnapshot, lead) });

  return res.json({ message: 'Lead actualizado exitosamente', data: lead });
};

// PUT /api/leads/:id/close-won
const closeLeadAsWon = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const lead = await Lead.findByPk(req.params.id, { transaction });
    if (!lead) throw new ApiError(404, 'Lead no encontrado');
    if (!canEditLead(req.user, lead)) {
      throw new ApiError(403, 'No tienes acceso a este prospecto');
    }
    // Un prospecto cerrado por error como "No interesado" se puede corregir a venta —
    // pero si ya está registrado como venta, no tiene caso repetirlo (ver "reversible
    // antes que perfecto" en CRM_UX_DESIGN.md).
    if (lead.pipelineStage === 'venta_realizada') {
      throw new ApiError(400, 'Este prospecto ya tiene una venta registrada');
    }
    const wasLost = lead.pipelineStage === 'no_interesado';

    const { propertyId, amount, closedAt } = req.body;
    if (!propertyId || !amount) {
      throw new ApiError(400, 'Propiedad y monto son requeridos');
    }

    const property = await Property.findByPk(propertyId, { transaction });
    if (!property) throw new ApiError(404, 'Propiedad no encontrada');

    const deal = await Deal.create(
      {
        leadId: lead.id,
        propertyId,
        amount,
        closedAt: closedAt || new Date(),
      },
      { transaction }
    );

    const beforeSnapshot = snapshotFields(lead, ['pipelineStage', 'status', 'closeReason', 'closeReasonDetail']);
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

    await transaction.commit();

    logAudit(req, 'update', 'lead', lead.id, {
      closedAs: 'won',
      dealId: deal.id,
      changes: buildChanges(beforeSnapshot, lead),
    });

    return res.json({ message: 'Venta registrada exitosamente', data: { lead, deal } });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

// PUT /api/leads/:id/close-lost
const closeLeadAsLost = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const lead = await Lead.findByPk(req.params.id, { transaction });
    if (!lead) throw new ApiError(404, 'Lead no encontrado');
    if (!canEditLead(req.user, lead)) {
      throw new ApiError(403, 'No tienes acceso a este prospecto');
    }
    // Un prospecto marcado por error como "Venta realizada" se puede corregir a
    // perdido — pero si ya está marcado como perdido, no tiene caso repetirlo.
    if (lead.pipelineStage === 'no_interesado') {
      throw new ApiError(400, 'Este prospecto ya está marcado como no interesado');
    }
    const wasWon = lead.pipelineStage === 'venta_realizada';

    const { closeReason, closeReasonDetail } = req.body;
    if (!closeReason || !VALID_CLOSE_REASONS.includes(closeReason)) {
      throw new ApiError(400, `Motivo inválido. Valores permitidos: ${VALID_CLOSE_REASONS.join(', ')}`);
    }
    if (closeReason === 'otro' && !closeReasonDetail?.trim()) {
      throw new ApiError(400, 'Especifica el motivo en el detalle');
    }

    // Un prospecto perdido no debe conservar el registro de venta de un cierre
    // anterior equivocado.
    if (wasWon) {
      await Deal.destroy({ where: { leadId: lead.id }, transaction });
    }

    const beforeSnapshot = snapshotFields(lead, ['pipelineStage', 'status', 'closeReason', 'closeReasonDetail']);
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

    await transaction.commit();

    logAudit(req, 'update', 'lead', lead.id, {
      closedAs: 'lost',
      closeReason,
      changes: buildChanges(beforeSnapshot, lead),
    });

    return res.json({ message: 'Prospecto cerrado', data: lead });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

// PUT /api/leads/:id/send-to-waiting-list — manda el prospecto a la lista de espera del panel
// admin (crea una fila en PropertyAlert con source:'staff', mismo modelo que WaitingListPage).
// name/phone/email/businessLine se toman siempre del lead, nunca del body, para que no puedan
// divergir del prospecto original.
const sendLeadToWaitingList = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const lead = await Lead.findByPk(req.params.id, { transaction });
    if (!lead) throw new ApiError(404, 'Lead no encontrado');
    if (!canEditLead(req.user, lead)) {
      throw new ApiError(403, 'No tienes acceso a este prospecto');
    }
    if (TERMINAL_STAGES.includes(lead.pipelineStage)) {
      throw new ApiError(
        400,
        'Este prospecto ya está cerrado — usa PUT /:id/reopen para reactivarlo'
      );
    }

    const { city, type, minPrice, maxPrice, state } = req.body;
    if (city && !VALID_ALERT_CITIES.includes(city)) {
      throw new ApiError(400, `Ciudad inválida. Valores permitidos: ${VALID_ALERT_CITIES.join(', ')}`);
    }
    if (type && !VALID_ALERT_TYPES.includes(type)) {
      throw new ApiError(400, `Tipo inválido. Valores permitidos: ${VALID_ALERT_TYPES.join(', ')}`);
    }
    if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
      if (!Number.isFinite(Number(minPrice)) || Number(minPrice) < 0) {
        throw new ApiError(400, 'Monto mínimo inválido');
      }
    }
    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
      if (!Number.isFinite(Number(maxPrice)) || Number(maxPrice) < 0) {
        throw new ApiError(400, 'Monto máximo inválido');
      }
    }

    const alert = await PropertyAlert.create(
      {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        businessLine: lead.businessLine,
        city: city || null,
        type: type || null,
        minPrice: minPrice !== undefined && minPrice !== null && minPrice !== '' ? Number(minPrice) : null,
        maxPrice: maxPrice !== undefined && maxPrice !== null && maxPrice !== '' ? Number(maxPrice) : null,
        state: state ? state.trim() : null,
        source: 'staff',
      },
      { transaction }
    );

    const beforeSnapshot = snapshotFields(lead, ['pipelineStage', 'status']);
    await lead.update(
      {
        pipelineStage: 'lista_espera',
        status: legacyStatusFor('lista_espera'),
      },
      { transaction }
    );

    await logActivity({
      leadId: lead.id,
      type: 'sistema',
      content: 'Prospecto enviado a lista de espera',
      userId: req.user?.id ?? null,
      transaction,
    });

    await transaction.commit();

    logAudit(req, 'update', 'lead', lead.id, {
      sentToWaitingList: true,
      propertyAlertId: alert.id,
      changes: buildChanges(beforeSnapshot, lead),
    });

    return res.json({ message: 'Prospecto enviado a lista de espera', data: { lead, alert } });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

// PUT /api/leads/:id/reopen — única vía para sacar un prospecto de una etapa terminal.
// Reabrir no es "cambiar un campo": si venía de venta_realizada implica que la venta
// registrada ya no es válida (mismo criterio que closeLeadAsLost usa al corregir un cierre
// equivocado).
const reopenLead = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const lead = await Lead.findByPk(req.params.id, { transaction });
    if (!lead) throw new ApiError(404, 'Lead no encontrado');
    if (!canEditLead(req.user, lead)) {
      throw new ApiError(403, 'No tienes acceso a este prospecto');
    }
    if (!TERMINAL_STAGES.includes(lead.pipelineStage)) {
      throw new ApiError(400, 'Este prospecto no está cerrado');
    }

    const { pipelineStage: targetStage } = req.body;
    const resolvedTarget = targetStage || 'contactado';
    if (!REOPEN_STAGES.includes(resolvedTarget)) {
      throw new ApiError(
        400,
        `Etapa de reapertura inválida. Valores permitidos: ${REOPEN_STAGES.join(', ')}`
      );
    }

    const previousStage = lead.pipelineStage;
    const wasWon = previousStage === 'venta_realizada';

    // La venta registrada deja de ser válida si el prospecto se reabre — igual que al
    // corregir un cierre equivocado en closeLeadAsLost.
    //
    // CRM-003: `deals.leadId` tiene un índice ÚNICO (ver models/Deal.js) — un lead solo
    // puede tener un Deal a la vez, así que no hay forma de simplemente "desactivar" este
    // sin borrarlo si el prospecto necesita poder volver a cerrarse como venta más
    // adelante (el flujo que este mismo endpoint ya soporta). Convertir Deal a `paranoid`
    // (soft-delete) chocaría con ese índice único de MySQL (que no distingue filas
    // borradas-lógicamente) al intentar crear un Deal nuevo para el mismo lead. En vez de
    // cambiar el esquema, se guarda una copia completa de los datos financieros (monto,
    // propiedad, fecha de cierre) en el audit log y en la propia actividad del prospecto
    // ANTES de borrar — así la información nunca desaparece, aunque el registro Deal en sí
    // sí se elimine.
    let deletedDealSnapshot = null;
    if (wasWon) {
      const dealToDelete = await Deal.findOne({ where: { leadId: lead.id }, transaction });
      if (dealToDelete) {
        const dealProperty = await Property.findByPk(dealToDelete.propertyId, {
          attributes: ['title'],
          transaction,
        });
        deletedDealSnapshot = {
          id: dealToDelete.id,
          amount: dealToDelete.amount,
          propertyId: dealToDelete.propertyId,
          propertyTitle: dealProperty?.title || null,
          closedAt: dealToDelete.closedAt,
        };
      }
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
      content: deletedDealSnapshot
        ? `Prospecto reabierto (antes: ${previousStage} — se eliminó la venta registrada: ` +
          `${formatPrice(deletedDealSnapshot.amount)} en "${deletedDealSnapshot.propertyTitle || 'propiedad eliminada'}", ` +
          `cerrada el ${new Date(deletedDealSnapshot.closedAt).toLocaleDateString('es-MX')})`
        : wasWon
          ? `Prospecto reabierto (antes: ${previousStage} — se eliminó la venta registrada)`
          : `Prospecto reabierto (antes: ${previousStage})`,
      userId: req.user?.id ?? null,
      transaction,
    });

    await transaction.commit();

    logAudit(req, 'update', 'lead', lead.id, {
      reopened: true,
      fromStage: previousStage,
      toStage: resolvedTarget,
      dealDeleted: wasWon,
      // CRM-003: snapshot completo del Deal borrado (monto/propiedad/fecha de cierre) —
      // antes solo quedaba el booleano `dealDeleted`, sin forma de reconstruir qué venta
      // se eliminó si hacía falta investigarlo después.
      deletedDeal: deletedDealSnapshot,
    });

    return res.json({ message: 'Prospecto reabierto exitosamente', data: lead });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

// DELETE /api/leads/:id
const deleteLead = async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');

  await lead.destroy();
  logAudit(req, 'delete', 'lead', req.params.id, { name: lead.name });
  return res.json({ message: 'Lead eliminado exitosamente' });
};

// PATCH /api/leads/batch — restringido a etapas no terminales; usar los endpoints de
// cierre individuales para venta_realizada/no_interesado (necesitan datos adicionales).
const batchUpdateLeads = async (req, res) => {
  const { pipelineStage } = req.body;
  const { error: idsError, ids } = validateBatchIds(req.body.ids);
  if (idsError) throw new ApiError(400, idsError);
  if (!pipelineStage) throw new ApiError(400, 'pipelineStage requerido');
  if (!VALID_PIPELINE_STAGES.includes(pipelineStage)) {
    throw new ApiError(
      400,
      `Etapa inválida. Valores permitidos: ${VALID_PIPELINE_STAGES.join(', ')}`
    );
  }
  if (TERMINAL_STAGES.includes(pipelineStage)) {
    throw new ApiError(
      400,
      'Para cerrar prospectos o mandarlos a lista de espera usa los endpoints individuales (/close-won, /close-lost, /send-to-waiting-list)'
    );
  }

  // Rechaza el lote completo si incluye algún lead fuera del alcance del actor — sin
  // escritura parcial (consistente con el resto de la validación de este endpoint, que
  // también rechaza todo-o-nada ante cualquier valor inválido).
  const leadsToUpdate = await Lead.findAll({ where: { id: ids } });
  if (leadsToUpdate.some((l) => !canEditLead(req.user, l))) {
    throw new ApiError(403, 'No tienes acceso a uno o más de los prospectos seleccionados');
  }

  await Lead.update(
    { pipelineStage, status: legacyStatusFor(pipelineStage) },
    { where: { id: ids } }
  );
  logAudit(req, 'update', 'lead', null, { ids, pipelineStage });
  return res.json({ message: `${ids.length} lead(s) actualizados` });
};

// DELETE /api/leads/batch
const batchDeleteLeads = async (req, res) => {
  const { error: idsError, ids } = validateBatchIds(req.body.ids);
  if (idsError) throw new ApiError(400, idsError);
  await Lead.destroy({ where: { id: ids } });
  logAudit(req, 'delete', 'lead', null, { ids });
  return res.json({ message: `${ids.length} lead(s) eliminados` });
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

  // SEC-003/BUG-001: `leadEvents` es un EventEmitter global — sin este filtro, cada
  // conexión SSE recibía el evento `new-lead` de TODO prospecto nuevo del sistema, sin
  // importar a quién esté asignado, aunque cada endpoint REST del módulo (getLeads,
  // getLeadById, appointments, deals, export) sí aplica canViewLead/
  // getLeadVisibilityWhere. `req.user` es el usuario de ESTA conexión (capturado por
  // authenticateSSE antes de llegar aquí), así que el mismo evento puede reenviarse a
  // unos clientes conectados y filtrarse para otros.
  const onNewLead = (lead) => {
    if (!canViewLead(req.user, lead)) return;
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
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');
  if (!canViewLead(req.user, lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  const notes = await LeadNote.findAll({
    where: { leadId: req.params.id },
    order: [['createdAt', 'DESC']],
  });

  return res.json({ data: notes });
};

// POST /api/leads/:id/notes
const addLeadNote = async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');
  if (!canViewLead(req.user, lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  const { content } = req.body;
  if (!content || !content.trim()) throw new ApiError(400, 'Contenido requerido');

  const note = await LeadNote.create({
    leadId: lead.id,
    content: content.trim(),
    authorName: req.user?.name || null,
    userId: req.user?.id ?? null,
  });

  logAudit(req, 'update', 'lead', lead.id, { addedNote: note.id });

  return res.status(201).json({ data: note });
};

// DELETE /api/leads/:id/notes/:noteId
const deleteLeadNote = async (req, res) => {
  const note = await LeadNote.findOne({
    where: { id: req.params.noteId, leadId: req.params.id },
  });
  if (!note) throw new ApiError(404, 'Nota no encontrada');

  const lead = await Lead.findByPk(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');
  // Cualquiera puede borrar su propia nota; borrar la de alguien más requiere permiso
  // de edición sobre el lead (admin/asistente_administrativo, o el asesor dueño).
  if (!canEditLead(req.user, lead) && note.userId !== req.user.id) {
    throw new ApiError(403, 'No tienes permisos para eliminar esta nota');
  }

  await note.destroy();
  logAudit(req, 'update', 'lead', req.params.id, { removedNote: req.params.noteId });
  return res.json({ message: 'Nota eliminada' });
};

// POST /api/leads/:id/whatsapp
const sendLeadWhatsApp = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) throw new ApiError(404, 'Lead no encontrado');
    if (!canViewLead(req.user, lead)) {
      throw new ApiError(403, 'No tienes acceso a este prospecto');
    }

    const { message } = req.body;
    if (!message || !message.trim()) throw new ApiError(400, 'Mensaje requerido');
    if (!lead.phone) throw new ApiError(400, 'Este lead no tiene un teléfono registrado');

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

    logAudit(
      req,
      'update',
      'lead',
      lead.id,
      { whatsapp: true, success: !sendError, error: sendError?.message || null },
      sendError ? 'failed' : 'success'
    );

    return res.json({ message: warning || 'Mensaje de WhatsApp enviado', data: note, warning });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, 'Error al enviar el mensaje de WhatsApp', { cause: error });
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
  sendLeadToWaitingList,
  reopenLead,
};
