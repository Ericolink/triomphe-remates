const { Activity, Task } = require('../models/index');

// CRM Comercial — lógica compartida entre leadController, appointmentController y
// taskController. A diferencia de los VALID_X arrays (que cada controller repite inline
// por convención del proyecto), esto es lógica de negocio transversal y sí se centraliza.

const TERMINAL_STAGES = ['venta_realizada', 'no_interesado'];

async function logActivity({ leadId, type, content, userId = null, transaction, ...extra }) {
  return Activity.create(
    { leadId, type, content, userId, occurredAt: new Date(), ...extra },
    { transaction }
  );
}

// Decisión de producto: un prospecto sin responsable asignado no tiene "próxima acción"
// todavía (Task.assignedToUserId es NOT NULL) — la tarea se crea la primera vez que se
// asigna un responsable, no al crear el prospecto públicamente sin dueño.
async function ensureOpenTask({
  leadId,
  assignedToUserId,
  type = 'dar_seguimiento',
  dueDate,
  transaction,
}) {
  if (!assignedToUserId) return null;

  const existingOpen = await Task.findOne({ where: { leadId, done: false }, transaction });
  if (existingOpen) return existingOpen;

  return Task.create(
    {
      leadId,
      assignedToUserId,
      type,
      dueDate: dueDate || defaultDueDate(),
    },
    { transaction }
  );
}

async function closeOpenTask({ leadId, transaction }) {
  const [count] = await Task.update(
    { done: true, doneAt: new Date() },
    { where: { leadId, done: false }, transaction }
  );
  return count;
}

// Mantiene la invariante "la task abierta de un lead pertenece a su responsable actual"
// cuando Lead.assignedToUserId cambia — llamado desde leadController.updateLead. No crea
// una segunda task ni toca tasks cerradas: reutiliza ensureOpenTask/closeOpenTask para los
// casos límite (sin responsable, sin task abierta todavía) en vez de duplicar esa lógica.
// `pipelineStage` es opcional pero debe pasarse la etapa resultante del lead cuando se
// conozca: un lead en etapa terminal no debe ganar una task nueva solo porque cambió de
// dueño — mismo criterio que closeLeadAsWon/closeLeadAsLost ("etapa terminal, no se crea
// tarea siguiente"), ya que updateLead permite reasignar un lead cerrado sin pasar por
// /reopen.
async function syncOpenTaskAssignee({ leadId, assignedToUserId, pipelineStage, transaction }) {
  if (!assignedToUserId) {
    // Un prospecto sin responsable no tiene "próxima acción" (misma regla que
    // ensureOpenTask al crear) — cierra la(s) task(s) abierta(s) en vez de dejarlas con
    // un assignedToUserId que ya no es dueño del lead.
    return closeOpenTask({ leadId, transaction });
  }

  const hasOpenTask = await Task.findOne({ where: { leadId, done: false }, transaction });
  if (!hasOpenTask) {
    if (pipelineStage && TERMINAL_STAGES.includes(pipelineStage)) return null;
    return ensureOpenTask({ leadId, assignedToUserId, type: 'llamar', transaction });
  }

  // Bulk update por `where` (no se guarda la instancia de arriba) para que, si por drift
  // existiera más de una task abierta, todas queden sincronizadas — mismo criterio que
  // closeOpenTask.
  await Task.update({ assignedToUserId }, { where: { leadId, done: false }, transaction });
  return hasOpenTask;
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
  cita_con_seguimiento: 'contactado',
  negociacion: 'contactado',
  venta_realizada: 'cerrado',
  no_interesado: 'descartado',
};

function legacyStatusFor(pipelineStage) {
  return LEGACY_STATUS_MAP[pipelineStage] || 'nuevo';
}

module.exports = {
  TERMINAL_STAGES,
  logActivity,
  ensureOpenTask,
  closeOpenTask,
  syncOpenTaskAssignee,
  legacyStatusFor,
};
