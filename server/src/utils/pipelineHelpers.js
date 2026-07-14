const { Activity, Task } = require('../models/index');

// CRM Comercial — lógica compartida entre leadController, appointmentController y
// taskController. A diferencia de los VALID_X arrays (que cada controller repite inline
// por convención del proyecto), esto es lógica de negocio transversal y sí se centraliza.

const TERMINAL_STAGES = ['venta_realizada', 'no_interesado'];

async function logActivity({ leadId, type, content, userId = null, transaction }) {
  return Activity.create({ leadId, type, content, userId, occurredAt: new Date() }, { transaction });
}

// Decisión de producto: un prospecto sin responsable asignado no tiene "próxima acción"
// todavía (Task.assignedToUserId es NOT NULL) — la tarea se crea la primera vez que se
// asigna un responsable, no al crear el prospecto públicamente sin dueño.
async function ensureOpenTask({ leadId, assignedToUserId, type = 'dar_seguimiento', dueDate, transaction }) {
  if (!assignedToUserId) return null;

  const existingOpen = await Task.findOne({ where: { leadId, done: false }, transaction });
  if (existingOpen) return existingOpen;

  return Task.create({
    leadId,
    assignedToUserId,
    type,
    dueDate: dueDate || defaultDueDate(),
  }, { transaction });
}

async function closeOpenTask({ leadId, transaction }) {
  const [count] = await Task.update(
    { done: true, doneAt: new Date() },
    { where: { leadId, done: false }, transaction }
  );
  return count;
}

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

// Mapea pipelineStage (8 etapas) al status legacy (4 valores) para que
// analyticsController.js y cualquier código que aún lea Lead.status durante la transición
// sigan funcionando sin tocarlos — ver AUDIT del CRM, decisión de mantener `status` deprecado.
const LEGACY_STATUS_MAP = {
  nuevo: 'nuevo',
  contactado: 'contactado',
  interesado: 'contactado',
  cita_agendada: 'contactado',
  cita_realizada: 'contactado',
  negociacion: 'contactado',
  venta_realizada: 'cerrado',
  no_interesado: 'descartado',
};

function legacyStatusFor(pipelineStage) {
  return LEGACY_STATUS_MAP[pipelineStage] || 'nuevo';
}

module.exports = { TERMINAL_STAGES, logActivity, ensureOpenTask, closeOpenTask, legacyStatusFor };
