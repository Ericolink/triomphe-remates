const { Activity } = require('../models/index');

// CRM Comercial — lógica compartida entre leadController y appointmentController. A
// diferencia de los VALID_X arrays (que cada controller repite inline por convención del
// proyecto), esto es lógica de negocio transversal y sí se centraliza.

const TERMINAL_STAGES = ['venta_realizada', 'no_interesado', 'lista_espera'];

async function logActivity({ leadId, type, content, userId = null, transaction, ...extra }) {
  return Activity.create(
    { leadId, type, content, userId, occurredAt: new Date(), ...extra },
    { transaction }
  );
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
  lista_espera: 'descartado',
};

function legacyStatusFor(pipelineStage) {
  return LEGACY_STATUS_MAP[pipelineStage] || 'nuevo';
}

// Última vez que un lead recibió atención humana REAL — deliberadamente NO incluye
// Lead.updatedAt (bug reportado por el dueño del negocio: un prospecto sin seguimiento
// desde el 27 de agosto no aparecía en "sin actividad +5 días" porque alguien había tocado
// un campo cualquiera del lead después de esa fecha — ej. completar `urgency`/
// `budgetAmount` durante una limpieza de datos, o cualquier otra edición administrativa que
// no es contacto real con el prospecto). Cada acción que sí representa seguimiento real ya
// queda registrada de forma independiente y no depende de Lead.updatedAt: cambio de etapa,
// reasignación y cambio de propiedad de interés generan su propia Activity (ver
// leadController.updateLead), igual que llamadas/WhatsApp/visitas/citas agendadas
// (logActivity) y las notas (LeadNote). La señal real es entonces el máximo entre la última
// Activity.occurredAt y la última LeadNote.createdAt de ese lead, con Lead.createdAt como
// piso cuando todavía no tiene ni actividades ni notas. MySQL GREATEST() devuelve NULL si
// cualquier argumento es NULL, por eso cada rama va envuelta en COALESCE antes de entrar al
// GREATEST. Devuelve el fragmento SQL crudo (usar con sequelize.literal); el caller define
// su propio cutoff (Date) por separado — getLeads usa un ?staleDays= arbitrario,
// getCrmDashboard/getMyCrmDashboard usan un umbral fijo. Depende de que Sequelize alias
// siempre la tabla principal como `Lead` (nombre del modelo, no el tableName `leads`) —
// verificado contra la BD tanto en count() como en findAndCountAll() con includes.
function staleSinceExpr() {
  return `GREATEST(
    COALESCE((SELECT MAX(a.occurredAt) FROM activities a WHERE a.leadId = Lead.id), Lead.createdAt),
    COALESCE((SELECT MAX(n.createdAt) FROM lead_notes n WHERE n.leadId = Lead.id), Lead.createdAt)
  )`;
}

module.exports = {
  TERMINAL_STAGES,
  logActivity,
  legacyStatusFor,
  staleSinceExpr,
};
