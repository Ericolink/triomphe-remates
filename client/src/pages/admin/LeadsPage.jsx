import { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, Building2, Calendar, Trash2, FileSpreadsheet, LayoutList, Columns, MessageCircle, X, PhoneCall, ArrowRightLeft, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { createLead, getLeads, getLeadById, updateLead, deleteLead, batchUpdateLeads, batchDeleteLeads, getLeadNotes, addLeadNote, deleteLeadNote, sendLeadWhatsApp, closeLeadAsWon, closeLeadAsLost, addLeadProperty, removeLeadProperty } from '../../services/leadService';
import { getLeadActivities, createLeadActivity } from '../../services/activityService';
import { getLeadAppointments, createAppointment } from '../../services/appointmentService';
import { getTasks, completeTask } from '../../services/taskService';
import { getUsers } from '../../services/usersService';
import { getProperties } from '../../services/propertyService';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import BatchActionBar from '../../components/ui/BatchActionBar';
import CloseLeadModal from '../../components/admin/CloseLeadModal';
import StageBottomSheet from '../../components/admin/StageBottomSheet';
import CreateLeadModal from '../../components/admin/CreateLeadModal';
import { fadeIn, fadeInUp, fadeInRight, staggerContainer } from '../../utils/animations';
import { formatDate, formatDateTime } from '../../utils/formatters';
import {
  SOURCE_LABELS, LEAD_TYPE_LABELS as typeLabel,
  PIPELINE_STAGE_LABELS, PIPELINE_STAGE_VARIANTS, TERMINAL_STAGES,
  ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS, TASK_TYPE_LABELS,
} from '../../utils/constants';

const NON_TERMINAL_STAGE_OPTIONS = Object.entries(PIPELINE_STAGE_LABELS)
  .filter(([value]) => !TERMINAL_STAGES.includes(value))
  .map(([value, label]) => ({ value, label }));

const KANBAN_COLUMNS = Object.entries(PIPELINE_STAGE_LABELS).map(([key, label]) => ({
  key, label,
  color: TERMINAL_STAGES.includes(key)
    ? (key === 'venta_realizada' ? 'border-green-400' : 'border-gray-300 dark:border-gray-600')
    : 'border-blue-400',
  headerBg: TERMINAL_STAGES.includes(key)
    ? (key === 'venta_realizada' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-[#2e3650]')
    : 'bg-blue-50 dark:bg-blue-900/20',
  dot: TERMINAL_STAGES.includes(key)
    ? (key === 'venta_realizada' ? 'bg-green-500' : 'bg-gray-400')
    : 'bg-blue-500',
}));

// Deja solo dígitos y antepone 52 si es un número mexicano de 10 dígitos sin lada —
// mismo criterio que validatePhone en el backend (server/src/utils/validators.js).
function toWhatsAppLink(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  const withCountry = digits.length === 10 ? `52${digits}` : digits;
  return `https://wa.me/${withCountry}`;
}

function NextActionLine({ task }) {
  if (!task) return null;
  const overdue = new Date(task.dueDate) < new Date();
  return (
    <p className={`text-xs mt-1.5 flex items-center gap-1 ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
      {overdue ? '🔴' : '📌'} {TASK_TYPE_LABELS[task.type] || task.type} · {formatDate(task.dueDate)}
    </p>
  );
}

function LeadDetailPanel({ selected, onDeselect, onDelete, updateMutation, users, openTask, onAttemptStageChange }) {
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState('');
  const [activityType, setActivityType] = useState('llamada');
  const [activityContent, setActivityContent] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentPropertyId, setAppointmentPropertyId] = useState('');
  const [addPropertyId, setAddPropertyId] = useState('');

  const { data: detailData } = useQuery({
    queryKey: ['lead-detail', selected?.id],
    queryFn: () => getLeadById(selected.id),
    enabled: !!selected?.id,
  });
  const lead = detailData?.data || selected;

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ['lead-notes', selected?.id],
    queryFn: () => getLeadNotes(selected.id),
    enabled: !!selected?.id,
  });
  const notes = notesData?.data ?? [];

  const { data: activitiesData } = useQuery({
    queryKey: ['lead-activities', selected?.id],
    queryFn: () => getLeadActivities(selected.id),
    enabled: !!selected?.id,
  });
  const activities = activitiesData?.data ?? [];

  const { data: appointmentsData } = useQuery({
    queryKey: ['lead-appointments', selected?.id],
    queryFn: () => getLeadAppointments(selected.id),
    enabled: !!selected?.id,
  });
  const appointments = appointmentsData?.data ?? [];

  const { data: propertiesData } = useQuery({
    queryKey: ['properties-for-picker'],
    queryFn: () => getProperties({ limit: 50 }),
  });
  const allProperties = propertiesData?.data ?? [];

  const addNoteMutation = useMutation({
    mutationFn: ({ id, content }) => addLeadNote(id, content),
    onSuccess: () => { setNoteText(''); queryClient.invalidateQueries(['lead-notes', selected.id]); },
    onError: () => toast.error('Error al guardar nota'),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: ({ leadId, noteId }) => deleteLeadNote(leadId, noteId),
    onSuccess: () => queryClient.invalidateQueries(['lead-notes', selected.id]),
  });

  const addActivityMutation = useMutation({
    mutationFn: ({ id, data }) => createLeadActivity(id, data),
    onSuccess: () => {
      setActivityContent('');
      queryClient.invalidateQueries(['lead-activities', selected.id]);
      toast.success('Actividad registrada');
    },
    onError: () => toast.error('Error al registrar actividad'),
  });

  const scheduleMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      setAppointmentDate(''); setAppointmentPropertyId('');
      queryClient.invalidateQueries(['lead-appointments', selected.id]);
      queryClient.invalidateQueries(['lead-activities', selected.id]);
      queryClient.invalidateQueries(['leads']);
      toast.success('Cita agendada');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al agendar cita'),
  });

  const addPropertyMutation = useMutation({
    mutationFn: ({ leadId, propertyId }) => addLeadProperty(leadId, propertyId),
    onSuccess: () => { setAddPropertyId(''); queryClient.invalidateQueries(['lead-detail', selected.id]); },
    onError: () => toast.error('Error al agregar propiedad'),
  });

  const removePropertyMutation = useMutation({
    mutationFn: ({ leadId, propertyId }) => removeLeadProperty(leadId, propertyId),
    onSuccess: () => queryClient.invalidateQueries(['lead-detail', selected.id]),
  });

  const completeTaskMutation = useMutation({
    mutationFn: (id) => completeTask(id),
    onSuccess: () => {
      toast.success('Tarea completada');
      queryClient.invalidateQueries(['open-tasks']);
      queryClient.invalidateQueries(['lead-activities', selected.id]);
    },
    onError: () => toast.error('Error al completar la tarea'),
  });

  const [whatsappMessage, setWhatsappMessage] = useState('');
  const whatsappMutation = useMutation({
    mutationFn: ({ id, message }) => sendLeadWhatsApp(id, message),
    onSuccess: (data) => {
      setWhatsappMessage('');
      queryClient.invalidateQueries(['lead-notes', selected.id]);
      if (data?.warning) toast(data.warning, { icon: '⚠️' });
      else toast.success('Mensaje de WhatsApp enviado');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al enviar WhatsApp'),
  });

  const interestedProperties = lead.interestedProperties || [];
  const availableToAdd = allProperties.filter(
    (p) => p.id !== lead.propertyId && !interestedProperties.some((ip) => ip.id === p.id)
  );

  const inputClass = "w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100";

  return (
    <motion.div key={selected.id} variants={fadeInRight} initial="hidden" animate="visible" exit={{ opacity: 0, x: 20 }}
      className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] sticky top-6 overflow-y-auto max-h-[calc(100vh-120px)]">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 dark:text-gray-100">Detalle del prospecto</h2>
          <div className="flex items-center gap-1">
            {selected.phone && (
              <a href={`tel:${selected.phone}`} title="Llamar"
                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                <PhoneCall size={18} />
              </a>
            )}
            {selected.phone && (
              <a href={toWhatsAppLink(selected.phone)} target="_blank" rel="noopener noreferrer" title="WhatsApp"
                className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors">
                <MessageCircle size={18} />
              </a>
            )}
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={onDelete} title="Eliminar prospecto"
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
              <Trash2 size={18} />
            </motion.button>
            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={onDeselect} title="Cerrar detalle"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-[#2e3650] rounded-lg transition-colors">
              <X size={20} />
            </motion.button>
          </div>
        </div>

        {/* Próxima acción — siempre arriba, es lo más importante */}
        <div className="mb-5 p-3 rounded-xl bg-gray-50 dark:bg-[#1a1f2e]">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5">Próxima acción</p>
          {openTask ? (
            <div className="flex items-center justify-between gap-2">
              <NextActionLine task={openTask} />
              <button onClick={() => completeTaskMutation.mutate(openTask.id)} disabled={completeTaskMutation.isPending}
                className="text-xs font-medium px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0">
                Completar
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              {lead.assignedToUserId ? 'Sin próxima acción pendiente.' : 'Asigna un responsable para generar la primera tarea.'}
            </p>
          )}
        </div>

        {/* Timeline de actividad — justo debajo de la próxima acción, antes que los
            campos editables: es lo primero que se quiere leer al abrir un prospecto. */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Actividad</p>
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-1">
            {activities.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin actividad registrada.</p>
            ) : activities.map((a) => (
              <div key={a.id} className="flex items-start gap-2 text-xs">
                <span className={`px-1.5 py-0.5 rounded-full flex-shrink-0 ${ACTIVITY_TYPE_COLORS[a.type]}`}>{ACTIVITY_TYPE_LABELS[a.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 dark:text-gray-300">{a.content}</p>
                  <p className="text-gray-400 mt-0.5">{formatDateTime(a.occurredAt)}{a.user ? ` · ${a.user.name}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <select value={activityType} onChange={(e) => setActivityType(e.target.value)}
              className={`${inputClass} flex-shrink-0 w-28`}>
              {['llamada', 'whatsapp', 'email', 'visita', 'nota'].map((t) => <option key={t} value={t}>{ACTIVITY_TYPE_LABELS[t]}</option>)}
            </select>
            <input value={activityContent} onChange={(e) => setActivityContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && activityContent.trim() && addActivityMutation.mutate({ id: selected.id, data: { type: activityType, content: activityContent.trim() } })}
              placeholder="Registrar interacción..." className={inputClass} />
            <button onClick={() => activityContent.trim() && addActivityMutation.mutate({ id: selected.id, data: { type: activityType, content: activityContent.trim() } })}
              disabled={!activityContent.trim() || addActivityMutation.isPending}
              className="px-2.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0">
              +
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-5 text-sm">
          {[{ label: 'Nombre', value: selected.name }, { label: 'Email', value: selected.email }, { label: 'Teléfono', value: selected.phone }, { label: 'Propiedad de origen', value: selected.property?.title }]
            .filter(({ value }) => value).map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
              <p className="font-medium text-gray-800 dark:text-gray-100">{value}</p>
            </div>
          ))}
          {selected.message && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Mensaje</p>
              <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">{selected.message}</p>
            </div>
          )}
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Etapa</label>
            <button onClick={() => onAttemptStageChange(lead)}
              className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors">
              <Badge variant={PIPELINE_STAGE_VARIANTS[lead.pipelineStage]}>{PIPELINE_STAGE_LABELS[lead.pipelineStage]}</Badge>
              <ArrowRightLeft size={14} className="text-gray-400" />
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Responsable</label>
            <select value={lead.assignedToUserId || ''}
              onChange={(e) => updateMutation.mutate({ id: selected.id, data: { assignedToUserId: e.target.value ? Number(e.target.value) : null } })}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none">
              <option value="">Sin asignar</option>
              {users.filter((u) => u.isActive).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fuente</label>
            <select value={selected.source || 'directo'}
              onChange={(e) => { updateMutation.mutate({ id: selected.id, data: { source: e.target.value } }); }}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none">
              {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* Propiedades de interés */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Propiedades de interés</p>
          <div className="space-y-1.5 mb-2">
            {interestedProperties.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">Ninguna todavía.</p>
            )}
            {interestedProperties.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-[#1a1f2e] rounded-lg px-3 py-1.5 text-xs">
                <span className="text-gray-700 dark:text-gray-300 truncate">{p.title}</span>
                <button onClick={() => removePropertyMutation.mutate({ leadId: selected.id, propertyId: p.id })}
                  className="text-gray-400 hover:text-red-500 flex-shrink-0"><X size={13} /></button>
              </div>
            ))}
          </div>
          {availableToAdd.length > 0 && (
            <div className="flex gap-2">
              <select value={addPropertyId} onChange={(e) => setAddPropertyId(e.target.value)} className={inputClass}>
                <option value="">Agregar propiedad...</option>
                {availableToAdd.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <button onClick={() => addPropertyId && addPropertyMutation.mutate({ leadId: selected.id, propertyId: Number(addPropertyId) })}
                disabled={!addPropertyId}
                className="px-2.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0">
                <Plus size={13} />
              </button>
            </div>
          )}
        </div>

        {/* Citas */}
        <div className="mb-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Calendar size={13} /> Citas
          </p>
          <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto pr-1">
            {appointments.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin citas registradas.</p>}
            {appointments.map((a) => (
              <div key={a.id} className="bg-gray-50 dark:bg-[#1a1f2e] rounded-lg px-3 py-1.5 text-xs flex items-center justify-between">
                <span className="text-gray-700 dark:text-gray-300">{formatDateTime(a.scheduledAt)}</span>
                <Badge variant={a.status === 'completada' ? 'success' : a.status === 'cancelada' ? 'default' : 'primary'}>{a.status}</Badge>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="datetime-local" value={appointmentDate} onChange={(e) => setAppointmentDate(e.target.value)} className={inputClass} />
            <button onClick={() => appointmentDate && scheduleMutation.mutate({ leadId: selected.id, propertyId: appointmentPropertyId || undefined, scheduledAt: appointmentDate })}
              disabled={!appointmentDate || scheduleMutation.isPending}
              className="px-2.5 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors flex-shrink-0">
              Agendar
            </button>
          </div>
        </div>

        {/* Envío de WhatsApp */}
        {selected.phone && (
          <div className="mb-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <MessageCircle size={13} className="text-green-500" /> Enviar WhatsApp
            </p>
            <div className="flex gap-2">
              <textarea value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)}
                rows={2} placeholder="Mensaje de seguimiento..."
                className="flex-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500" />
              <button onClick={() => whatsappMessage.trim() && whatsappMutation.mutate({ id: selected.id, message: whatsappMessage.trim() })}
                disabled={!whatsappMessage.trim() || whatsappMutation.isPending}
                className="px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors flex-shrink-0">
                {whatsappMutation.isPending ? '...' : 'Enviar'}
              </button>
            </div>
          </div>
        )}

        {/* Notas rápidas */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Notas</p>
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-1">
            {notesLoading ? <Spinner size="sm" className="py-2" /> : notes.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin notas de seguimiento aún.</p>
            ) : notes.map((note) => (
              <div key={note.id} className="group bg-gray-50 dark:bg-[#1a1f2e] rounded-lg px-3 py-2 text-xs relative">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{note.content}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-400">{formatDateTime(note.createdAt)}</span>
                  <button onClick={() => deleteNoteMutation.mutate({ leadId: selected.id, noteId: note.id })}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && noteText.trim() && addNoteMutation.mutate({ id: selected.id, content: noteText.trim() })}
              placeholder="Agregar nota..."
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500" />
            <button onClick={() => noteText.trim() && addNoteMutation.mutate({ id: selected.id, content: noteText.trim() })}
              disabled={!noteText.trim() || addNoteMutation.isPending}
              className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
              +
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function KanbanCard({ lead, openTask, onSelect, onAttemptStageChange, draggable, onDragStart, onDragEnd, isDragging }) {
  return (
    <div draggable={draggable}
      onDragStart={onDragStart} onDragEnd={onDragEnd}
      onClick={() => onSelect(lead)}
      className={`bg-white dark:bg-[#242938] rounded-xl p-3 shadow-sm border border-gray-100 dark:border-[#2e3650] cursor-pointer hover:shadow-md transition-shadow select-none ${draggable ? 'active:cursor-grabbing' : ''} ${isDragging ? 'opacity-40' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm truncate">{lead.name}</p>
        <button onClick={(e) => { e.stopPropagation(); onAttemptStageChange(lead); }} title="Cambiar etapa"
          className="p-1 text-gray-300 hover:text-blue-500 flex-shrink-0">
          <ArrowRightLeft size={13} />
        </button>
      </div>
      {lead.campaign && <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5 truncate">{lead.campaign.name}</p>}
      {lead.property && (
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 truncate">
          <Building2 size={10} /> {lead.property.title}
        </p>
      )}
      <NextActionLine task={openTask} />
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} title="Llamar"
              className="p-1 text-gray-400 hover:text-blue-500"><PhoneCall size={12} /></a>
          )}
          {lead.phone && (
            <a href={toWhatsAppLink(lead.phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="WhatsApp"
              className="p-1 text-gray-400 hover:text-green-500"><MessageCircle size={12} /></a>
          )}
        </div>
        <Badge variant="default" className="text-xs">{typeLabel[lead.type]}</Badge>
      </div>
    </div>
  );
}

function KanbanBoard({ leads, openTaskByLead, onSelect, onAttemptStageChange, onOpenSheet }) {
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const handleDragStart = (e, lead) => {
    setDragging(lead);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(colKey);
  };

  const handleDrop = (e, colKey) => {
    e.preventDefault();
    setDragOver(null);
    if (dragging && dragging.pipelineStage !== colKey) {
      onAttemptStageChange(dragging, colKey);
    }
    setDragging(null);
  };

  const handleDragEnd = () => { setDragging(null); setDragOver(null); };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const colLeads = leads.filter((l) => l.pipelineStage === col.key);
        const isOver = dragOver === col.key;
        return (
          <div key={col.key}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDrop={(e) => handleDrop(e, col.key)}
            onDragLeave={() => setDragOver(null)}
            className={`rounded-2xl border-2 transition-colors min-h-[200px] ${col.color} ${isOver ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-gray-50/60 dark:bg-[#1a1f2e]/60'}`}>
            <div className={`px-4 py-3 rounded-t-xl flex items-center gap-2 ${col.headerBg}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
              <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">{col.label}</span>
              <span className="ml-auto text-xs bg-white dark:bg-[#242938] text-gray-500 rounded-full px-2 py-0.5 font-medium">
                {colLeads.length}
              </span>
            </div>
            <div className="p-3 space-y-2">
              {colLeads.map((lead) => (
                <KanbanCard key={lead.id} lead={lead} openTask={openTaskByLead[lead.id]} onSelect={onSelect}
                  onAttemptStageChange={() => onOpenSheet(lead)}
                  draggable onDragStart={(e) => handleDragStart(e, lead)} onDragEnd={handleDragEnd}
                  isDragging={dragging?.id === lead.id} />
              ))}
              {colLeads.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 italic">Sin prospectos</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const location = useLocation();
  // Permite llegar aquí ya filtrado desde el dashboard (ej. tarjeta "Prospectos nuevos").
  const [stage, setStage] = useState(location.state?.pipelineStage || location.state?.status || '');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [checked, setChecked] = useState([]);
  const [view, setView] = useState('list');
  const [closeTarget, setCloseTarget] = useState(null); // { lead, targetStage }
  const [sheetLead, setSheetLead] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', stage],
    queryFn: () => getLeads({ pipelineStage: stage, limit: 100 }),
  });
  const leads = useMemo(() => data?.data ?? [], [data]);

  const { data: usersData } = useQuery({ queryKey: ['users-all'], queryFn: getUsers });
  const users = usersData?.data ?? [];

  const leadIds = useMemo(() => leads.map((l) => l.id), [leads]);
  const { data: openTasksData } = useQuery({
    queryKey: ['open-tasks', leadIds.join(',')],
    queryFn: () => getTasks({ leadIds: leadIds.join(','), done: false }),
    enabled: leadIds.length > 0,
  });
  const openTaskByLead = useMemo(() => {
    const map = {};
    (openTasksData?.data ?? []).forEach((t) => { map[t.leadId] = t; });
    return map;
  }, [openTasksData]);

  const { data: closeLeadDetail } = useQuery({
    queryKey: ['lead-detail-for-close', closeTarget?.lead?.id],
    queryFn: () => getLeadById(closeTarget.lead.id),
    enabled: !!closeTarget?.lead?.id,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateLead(id, data),
    onSuccess: (res, { data: updated }) => {
      toast.success('Prospecto actualizado');
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['lead-detail']);
      queryClient.invalidateQueries(['open-tasks']);
      if (updated.pipelineStage) setSelected((s) => (s ? { ...s, pipelineStage: updated.pipelineStage } : s));
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al actualizar'),
  });

  const closeWonMutation = useMutation({
    mutationFn: ({ id, data }) => closeLeadAsWon(id, data),
    onSuccess: () => {
      toast.success('Venta registrada exitosamente');
      setCloseTarget(null); setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['open-tasks']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al registrar la venta'),
  });

  const closeLostMutation = useMutation({
    mutationFn: ({ id, data }) => closeLeadAsLost(id, data),
    onSuccess: () => {
      toast.success('Prospecto cerrado');
      setCloseTarget(null); setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['open-tasks']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al cerrar el prospecto'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => { toast.success('Prospecto eliminado'); setSelected(null); queryClient.invalidateQueries(['leads']); },
  });

  const createMutation = useMutation({
    mutationFn: createLead,
    onSuccess: () => { toast.success('Prospecto creado exitosamente'); setCreateOpen(false); queryClient.invalidateQueries(['leads']); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al crear el prospecto'),
  });

  const batchStatusMutation = useMutation({
    mutationFn: ({ ids, stage: s }) => batchUpdateLeads(ids, s),
    onSuccess: (_, { ids }) => { toast.success(`${ids.length} prospecto(s) actualizados`); setChecked([]); queryClient.invalidateQueries(['leads']); },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al actualizar en lote'),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteLeads,
    onSuccess: (_, ids) => { toast.success(`${ids.length} prospecto(s) eliminados`); setChecked([]); setSelected(null); queryClient.invalidateQueries(['leads']); },
  });

  // Único punto de entrada para cambiar de etapa (drag, bottom sheet o botón del
  // detalle): las etapas terminales siempre pasan por el modal de cierre.
  const attemptStageChange = (lead, newStage) => {
    if (newStage === lead.pipelineStage) return;
    if (TERMINAL_STAGES.includes(newStage)) {
      setCloseTarget({ lead, targetStage: newStage });
      setSheetLead(null);
    } else {
      updateMutation.mutate({ id: lead.id, data: { pipelineStage: newStage } });
      setSheetLead(null);
    }
  };
  const openStageSheet = (lead) => setSheetLead(lead);

  const toggleCheck = (e, id) => {
    e.stopPropagation();
    setChecked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    const ids = leads.map((l) => l.id);
    setChecked(checked.length === ids.length ? [] : ids);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (stage) params.append('status', stage);
      const response = await api.get(`/export/leads/excel?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `triomphe-prospectos-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al exportar');
    }
  };

  const allChecked = leads.length > 0 && checked.length === leads.length;
  const closeLeadForModal = closeLeadDetail?.data || closeTarget?.lead;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Prospectos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{data?.pagination?.total ?? 0} prospectos registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={16} /> Nuevo prospecto
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors">
            <FileSpreadsheet size={16} className="text-green-600" /> Excel
          </button>
          <div className="flex border border-gray-200 dark:border-[#2e3650] rounded-xl overflow-hidden">
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#242938] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650]'}`}>
              <LayoutList size={15} /> Lista
            </button>
            <button onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#242938] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650]'}`}>
              <Columns size={15} /> Kanban
            </button>
          </div>
          {view === 'list' && (
            <select value={stage} onChange={(e) => { setStage(e.target.value); setChecked([]); }}
              className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none">
              <option value="">Todas las etapas</option>
              {Object.entries(PIPELINE_STAGE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
        </div>
      </motion.div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
            {isLoading ? <Spinner size="lg" className="py-16" /> : (
              <KanbanBoard leads={leads} openTaskByLead={openTaskByLead} onSelect={setSelected} onAttemptStageChange={attemptStageChange} onOpenSheet={openStageSheet} />
            )}
          </div>
          <div className="xl:col-span-1">
            <AnimatePresence mode="wait">
              {selected ? (
                <LeadDetailPanel key={selected.id} selected={selected} updateMutation={updateMutation}
                  users={users} openTask={openTaskByLead[selected.id]}
                  onAttemptStageChange={(lead) => setSheetLead(lead)}
                  onDeselect={() => setSelected(null)}
                  onDelete={() => setConfirm({ title: '¿Eliminar este prospecto?', message: `Se eliminará el contacto de ${selected.name} permanentemente.`, onConfirm: () => { deleteMutation.mutate(selected.id); setConfirm(null); } })} />
              ) : (
                <motion.div key="empty-kanban" variants={fadeIn} initial="hidden" animate="visible" exit={{ opacity: 0 }}
                  className="bg-white dark:bg-[#242938] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-[#2e3650] text-center text-gray-400 dark:text-gray-500">
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Mail size={32} className="mx-auto mb-2 opacity-30" />
                  </motion.div>
                  <p className="text-sm">Haz clic en un prospecto para ver el detalle</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="lg:col-span-2 space-y-3">
            {leads.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <input type="checkbox" checked={allChecked} onChange={toggleAll}
                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {allChecked ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </span>
              </div>
            )}

            {isLoading ? <Spinner size="lg" className="py-16" /> : (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                <AnimatePresence>
                  {leads.map((lead) => (
                    <motion.div key={lead.id} variants={fadeInUp} layout
                      onClick={() => setSelected(lead)}
                      whileHover={{ x: 4, transition: { duration: 0.15 } }}
                      className={`bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border cursor-pointer transition-all ${
                        selected?.id === lead.id
                          ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500'
                          : 'border-gray-100 dark:border-[#2e3650]'
                      }`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={checked.includes(lead.id)} onChange={(e) => toggleCheck(e, lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 w-4 h-4 rounded accent-blue-600 flex-shrink-0 cursor-pointer" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-100">{lead.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {formatDate(lead.createdAt)} · {typeLabel[lead.type]}
                                {lead.source && lead.source !== 'directo' ? ` · ${SOURCE_LABELS[lead.source]}` : ''}
                              </p>
                            </div>
                            <Badge variant={PIPELINE_STAGE_VARIANTS[lead.pipelineStage]}>{PIPELINE_STAGE_LABELS[lead.pipelineStage]}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                            {lead.email && <span className="flex items-center gap-1"><Mail size={12} /> {lead.email}</span>}
                            {lead.phone && <span className="flex items-center gap-1"><Phone size={12} /> {lead.phone}</span>}
                            {lead.property && <span className="flex items-center gap-1"><Building2 size={12} /> {lead.property.title}</span>}
                          </div>
                          <NextActionLine task={openTaskByLead[lead.id]} />
                          {lead.message && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 line-clamp-2">{lead.message}</p>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
            {!isLoading && leads.length === 0 && (
              <motion.div variants={fadeIn} initial="hidden" animate="visible"
                className="text-center py-16 text-gray-400 dark:text-gray-500">
                {stage ? (
                  <>
                    <p>No hay prospectos en esta etapa.</p>
                    <button type="button" onClick={() => setStage('')}
                      className="mt-2 text-blue-600 dark:text-blue-400 text-sm font-medium hover:underline">
                      Ver todos los prospectos
                    </button>
                  </>
                ) : (
                  <p>Todavía no se ha recibido ningún prospecto.</p>
                )}
              </motion.div>
            )}
          </div>

          {/* Detalle */}
          <div className="lg:col-span-1">
            <AnimatePresence mode="wait">
              {selected ? (
                <LeadDetailPanel key={selected.id} selected={selected} updateMutation={updateMutation}
                  users={users} openTask={openTaskByLead[selected.id]}
                  onAttemptStageChange={(lead) => setSheetLead(lead)}
                  onDeselect={() => setSelected(null)}
                  onDelete={() => setConfirm({ title: '¿Eliminar este prospecto?', message: `Se eliminará el contacto de ${selected.name} permanentemente.`, onConfirm: () => { deleteMutation.mutate(selected.id); setConfirm(null); } })} />
              ) : (
                <motion.div key="empty" variants={fadeIn} initial="hidden" animate="visible" exit={{ opacity: 0 }}
                  className="bg-white dark:bg-[#242938] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-[#2e3650] text-center text-gray-400 dark:text-gray-500">
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Mail size={32} className="mx-auto mb-2 opacity-30" />
                  </motion.div>
                  <p className="text-sm">Selecciona un prospecto para ver el detalle</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message}
        confirmLabel="Eliminar" onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />

      <CloseLeadModal
        open={!!closeTarget}
        lead={closeLeadForModal}
        targetStage={closeTarget?.targetStage}
        isPending={closeWonMutation.isPending || closeLostMutation.isPending}
        onClose={() => setCloseTarget(null)}
        onConfirmWon={(payload) => closeWonMutation.mutate({ id: closeTarget.lead.id, data: payload })}
        onConfirmLost={(payload) => closeLostMutation.mutate({ id: closeTarget.lead.id, data: payload })}
      />

      <StageBottomSheet
        open={!!sheetLead}
        lead={sheetLead}
        onClose={() => setSheetLead(null)}
        onSelectStage={(newStage) => attemptStageChange(sheetLead, newStage)}
      />

      <CreateLeadModal
        open={createOpen}
        isPending={createMutation.isPending}
        onClose={() => setCreateOpen(false)}
        onSubmit={(payload) => createMutation.mutate(payload)}
      />

      {view === 'list' && (
        <BatchActionBar
          count={checked.length}
          onClear={() => setChecked([])}
          statusOptions={NON_TERMINAL_STAGE_OPTIONS}
          onStatus={(s) => batchStatusMutation.mutate({ ids: checked, stage: s })}
          onDelete={() => setConfirm({
            title: `¿Eliminar ${checked.length} prospecto(s)?`,
            message: 'Esta acción no se puede deshacer.',
            onConfirm: () => { batchDeleteMutation.mutate(checked); setConfirm(null); },
          })}
        />
      )}
    </motion.div>
  );
}
