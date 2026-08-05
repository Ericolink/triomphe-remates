const { Op } = require('sequelize');
const { sequelize, Lead, Task, User } = require('../models/index');
const { TERMINAL_STAGES, logActivity, ensureOpenTask } = require('../utils/pipelineHelpers');
const { logAudit } = require('../utils/audit');
const { MAX_BATCH_IDS } = require('../utils/batchValidation');
const { paginate } = require('../utils/pagination');
const {
  getLeadVisibilityWhere,
  canViewLead,
  canEditLead,
  canAssignLeads,
} = require('../utils/leadAccess');
const { ApiError } = require('../middleware/errorHandler');

// GET /api/tasks — filtros para el panel "seguimientos vencidos" y para pintar la
// "próxima acción" en cada tarjeta del Kanban (leadIds CSV + done=false)
// AUDIT: sin `leadIds` (widget "Seguimientos vencidos" del Dashboard, o cualquier otro
// caller futuro) siempre pagina — el tope ya no depende de que el caller recuerde pasar
// `limit`. La rama `leadIds` sigue sin paginar a propósito: Kanban/detalle de lead
// necesitan *todas* las tareas de su lote acotado de leadIds (ya limitado por
// MAX_BATCH_IDS), no una página de ellas.
const getTasks = async (req, res) => {
  const { assignedToUserId, done, overdue, leadIds, page, limit } = req.query;
  const where = {};
  if (assignedToUserId) where.assignedToUserId = assignedToUserId;
  if (done !== undefined) where.done = done === 'true';
  if (overdue === 'true') {
    where.done = false;
    where.dueDate = { [Op.lt]: new Date() };
  }
  // CRM de Leads: cierra la fuga de "ver todas las tareas/leads vía el widget de
  // seguimientos" — mismo filtrado por fila que getLeads, contra el lead incluido.
  Object.assign(where, getLeadVisibilityWhere(req.user, { alias: 'lead' }) || {});

  const queryOptions = {
    where,
    include: [
      { model: User, as: 'assignedTo', attributes: ['id', 'name'], required: false },
      {
        model: Lead,
        as: 'lead',
        attributes: ['id', 'name', 'phone', 'assignedToUserId', 'createdByUserId'],
        required: false,
      },
    ],
    order: [['dueDate', 'ASC']],
  };

  if (leadIds) {
    const parsedLeadIds = leadIds
      .split(',')
      .map((id) => parseInt(id, 10))
      .filter(Boolean);
    if (parsedLeadIds.length > MAX_BATCH_IDS) {
      throw new ApiError(400, `No se pueden consultar más de ${MAX_BATCH_IDS} leadIds por solicitud`);
    }
    queryOptions.where = { ...where, leadId: { [Op.in]: parsedLeadIds } };
    const tasks = await Task.findAll(queryOptions);
    return res.json({ data: tasks });
  }

  const result = await paginate(Task, { page, limit, ...queryOptions });
  return res.json(result);
};

// GET /api/leads/:id/tasks
const getLeadTasks = async (req, res) => {
  const lead = await Lead.findByPk(req.params.id);
  if (!lead) throw new ApiError(404, 'Lead no encontrado');
  if (!canViewLead(req.user, lead)) {
    throw new ApiError(403, 'No tienes acceso a este prospecto');
  }

  const tasks = await Task.findAll({
    where: { leadId: req.params.id },
    include: [{ model: User, as: 'assignedTo', attributes: ['id', 'name'], required: false }],
    order: [['createdAt', 'DESC']],
  });

  return res.json({ data: tasks });
};

// PATCH /api/tasks/:id/complete — no hay create/update/delete genérico: la única vía de
// creación de tareas es ensureOpenTask, para proteger la invariante "una tarea abierta a
// la vez". Al completar, si el prospecto sigue en etapa no terminal, se crea la siguiente.
const completeTask = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const task = await Task.findByPk(req.params.id, {
      include: [{ model: Lead, as: 'lead' }],
      transaction,
    });
    if (!task) throw new ApiError(404, 'Tarea no encontrada');
    if (task.done) throw new ApiError(400, 'Esta tarea ya está completada');
    if (!canEditLead(req.user, task.lead)) {
      throw new ApiError(403, 'No tienes acceso a este prospecto');
    }

    await task.update({ done: true, doneAt: new Date() }, { transaction });
    await logActivity({
      leadId: task.leadId,
      type: 'sistema',
      content: `Tarea completada: ${task.type}`,
      userId: req.user?.id ?? null,
      transaction,
    });

    const { nextType, nextDueDate } = req.body;
    let nextTask = null;
    if (task.lead && !TERMINAL_STAGES.includes(task.lead.pipelineStage)) {
      nextTask = await ensureOpenTask({
        leadId: task.leadId,
        assignedToUserId: task.assignedToUserId,
        type: nextType || 'dar_seguimiento',
        dueDate: nextDueDate ? new Date(nextDueDate) : undefined,
        transaction,
      });
    }

    await transaction.commit();
    logAudit(req, 'update', 'task', task.id, { completed: true });

    return res.json({ message: 'Tarea completada', data: { task, nextTask } });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

// PATCH /api/tasks/:id/reassign
const reassignTask = async (req, res) => {
  const task = await Task.findByPk(req.params.id, {
    include: [{ model: Lead, as: 'lead' }],
  });
  if (!task) throw new ApiError(404, 'Tarea no encontrada');
  // Reasignar una tarea sigue la misma regla que reasignar el lead — reservado a
  // admin/coordinador_ventas — y requiere poder ver el lead al que pertenece.
  if (!canAssignLeads(req.user) || !canViewLead(req.user, task.lead)) {
    throw new ApiError(403, 'No tienes permisos para reasignar esta tarea');
  }

  const { assignedToUserId } = req.body;
  if (!assignedToUserId) throw new ApiError(400, 'assignedToUserId requerido');

  const assignedUser = await User.findByPk(assignedToUserId);
  if (!assignedUser) throw new ApiError(404, 'Usuario asignado no encontrado');

  await sequelize.transaction(async (transaction) => {
    await task.update({ assignedToUserId }, { transaction });
    await logActivity({
      leadId: task.leadId,
      type: 'sistema',
      content: 'Responsable de tarea cambiado',
      userId: req.user?.id ?? null,
      transaction,
    });
  });

  logAudit(req, 'update', 'task', task.id, { reassignedTo: assignedToUserId });

  return res.json({ message: 'Tarea reasignada exitosamente', data: task });
};

module.exports = { getTasks, getLeadTasks, completeTask, reassignTask };
