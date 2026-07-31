import { useId, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Phone,
  Building2,
  Calendar,
  Trash2,
  FileSpreadsheet,
  LayoutList,
  Columns,
  MessageCircle,
  MessageSquare,
  X,
  PhoneCall,
  ArrowRightLeft,
  Plus,
  Search,
  UserCheck,
  Wallet,
  Activity,
  FileText,
  Flag,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  deleteLead,
  batchUpdateLeads,
  batchDeleteLeads,
  getLeadNotes,
  addLeadNote,
  deleteLeadNote,
  sendLeadWhatsApp,
  closeLeadAsWon,
  closeLeadAsLost,
  addLeadProperty,
  removeLeadProperty,
} from '../../../services/leadService';
import { getLeadActivities, createLeadActivity } from '../../../services/activityService';
import { getLeadAppointments, createAppointment } from '../../../services/appointmentService';
import { getTasks, completeTask } from '../../../services/taskService';
import { getUsers } from '../../../services/usersService';
import useAuthStore from '../../../store/authStore';
import { downloadBlob } from '../../../utils/download';
import Badge from '../../ui/Badge';
import Spinner from '../../ui/Spinner';
import ConfirmDialog from '../../ui/ConfirmDialog';
import BatchActionBar from '../../ui/BatchActionBar';
import CloseLeadModal from '../CloseLeadModal';
import StageBottomSheet from '../StageBottomSheet';
import CreateLeadModal from '../CreateLeadModal';
import KanbanBoard, { NextActionLine } from '../KanbanBoard';
import PropertyPicker from '../PropertyPicker';
import useModalA11y from '../../../hooks/useModalA11y';
import { fadeIn, fadeInUp, fadeInRight, staggerContainer } from '../../../utils/animations';
import {
  formatDate,
  formatDateTime,
  toWhatsAppLink,
  formatBudget,
  todayISODate,
} from '../../../utils/formatters';
import {
  SOURCE_LABELS,
  LEAD_TYPE_LABELS as typeLabel,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_VARIANTS,
  TERMINAL_STAGES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_COLORS,
  PAYMENT_METHOD_LABELS,
} from '../../../utils/constants';

const LEADS_LIST_PAGE_SIZE = 20;

const NON_TERMINAL_STAGE_OPTIONS = Object.entries(PIPELINE_STAGE_LABELS)
  .filter(([value]) => !TERMINAL_STAGES.includes(value))
  .map(([value, label]) => ({ value, label }));

function LeadDetailPanel({
  selected,
  onDeselect,
  onDelete,
  updateMutation,
  users,
  openTask,
  onAttemptStageChange,
}) {
  const queryClient = useQueryClient();
  const formId = useId();
  const [noteText, setNoteText] = useState('');
  const [activityType, setActivityType] = useState('llamada');
  const [activityContent, setActivityContent] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentPropertyId, setAppointmentPropertyId] = useState('');
  const [addPropertyId, setAddPropertyId] = useState('');
  // Inicializados desde `selected` (no `lead`, que llega async vía detailData) — el panel
  // se remonta con key={selected.id} en cada cambio de prospecto, así que basta un solo
  // useState por selección.
  const [budgetAmountInput, setBudgetAmountInput] = useState(
    selected.budgetAmount != null ? String(selected.budgetAmount) : ''
  );
  const [firstContactInput, setFirstContactInput] = useState(
    selected.firstContactDate ? selected.firstContactDate.slice(0, 10) : ''
  );
  const budgetAmountInvalid =
    budgetAmountInput.trim() !== '' &&
    (Number.isNaN(Number(budgetAmountInput)) || Number(budgetAmountInput) < 0);

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

  const addNoteMutation = useMutation({
    mutationFn: ({ id, content }) => addLeadNote(id, content),
    onSuccess: () => {
      setNoteText('');
      queryClient.invalidateQueries(['lead-notes', selected.id]);
    },
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
      setAppointmentDate('');
      setAppointmentPropertyId('');
      queryClient.invalidateQueries(['lead-appointments', selected.id]);
      queryClient.invalidateQueries(['lead-activities', selected.id]);
      queryClient.invalidateQueries(['leads']);
      toast.success('Cita agendada');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al agendar cita'),
  });

  const addPropertyMutation = useMutation({
    mutationFn: ({ leadId, propertyId }) => addLeadProperty(leadId, propertyId),
    onSuccess: () => {
      setAddPropertyId('');
      queryClient.invalidateQueries(['lead-detail', selected.id]);
    },
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
      if (data?.warning)
        toast(data.warning, { icon: <AlertTriangle size={16} className="text-amber-500" /> });
      else toast.success('Mensaje de WhatsApp enviado');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al enviar WhatsApp'),
  });

  const interestedProperties = lead.interestedProperties || [];
  const excludePropertyIds = [
    lead.propertyId,
    ...interestedProperties.map((ip) => ip.id),
  ].filter(Boolean);

  // Reutilizados por todos los campos de solo-un-control ("Responsable", "Fuente",
  // "Forma de pago") para que compartan tamaño de fuente, radio y foco.
  const fieldLabelClass = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
  const fieldControlClass =
    'w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-500';
  // Compone una fila de "input + botón": min-w-0 + flex-1 hace que el control ceda ante
  // el botón en vez de imponer su propio 100% de ancho (bug original: `w-full` dentro de
  // un `flex` fuerza al hijo a pedir el ancho completo del contenedor y empuja al botón
  // fuera de vista → scroll horizontal para llegar a escribir).
  const rowControlClass =
    'min-w-0 flex-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500';
  const rowButtonClass =
    'flex-shrink-0 px-2.5 py-2 bg-accent-400 text-primary-900 rounded-xl text-xs font-medium hover:bg-accent-300 disabled:opacity-40 transition-colors';
  const sectionLabelClass =
    'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5';
  const cardClass = 'rounded-xl bg-gray-50 dark:bg-[#1a1f2e] p-3';

  return (
    <motion.div
      key={selected.id}
      variants={fadeInRight}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, x: 20 }}
      className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] sticky top-6 overflow-y-auto max-h-[calc(100vh-170px)]"
    >
      <div className="p-6">
        {/* Identidad — el nombre del prospecto va en el encabezado (antes solo aparecía
            varias secciones más abajo, en la lista plana de datos): es lo primero que hay
            que poder confirmar al abrir el panel, sin desplazarse. */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Detalle del prospecto
            </p>
            <h2 className="font-bold text-gray-800 dark:text-gray-100 truncate">{selected.name}</h2>
            {(selected.phone || selected.property?.title) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                {selected.phone && (
                  <span className="flex items-center gap-1">
                    <Phone size={11} className="flex-shrink-0" />
                    {selected.phone}
                  </span>
                )}
                {selected.property?.title && (
                  <span className="flex items-center gap-1 min-w-0">
                    <Building2 size={11} className="flex-shrink-0" />
                    <span className="truncate">{selected.property.title}</span>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {selected.phone && (
              <a
                href={`tel:${selected.phone}`}
                title="Llamar"
                className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              >
                <PhoneCall size={18} />
              </a>
            )}
            {selected.phone && (
              <a
                href={toWhatsAppLink(selected.phone)}
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp"
                className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
              >
                <MessageCircle size={18} />
              </a>
            )}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onDelete}
              title="Eliminar prospecto"
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 size={18} />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onDeselect}
              title="Cerrar detalle"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-[#2e3650] rounded-lg transition-colors"
            >
              <X size={20} />
            </motion.button>
          </div>
        </div>

        {selected.message && (
          <div className={`mb-4 ${cardClass}`}>
            <p className={sectionLabelClass}>
              <MessageSquare size={13} /> Mensaje inicial
            </p>
            <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">
              {selected.message}
            </p>
          </div>
        )}

        {/* Próxima acción — siempre arriba, es lo más importante */}
        <div className={`mb-4 ${cardClass}`}>
          <p className={sectionLabelClass}>
            <Flag size={13} /> Próxima acción
          </p>
          {openTask ? (
            <div className="flex items-center justify-between gap-2">
              <NextActionLine task={openTask} />
              <button
                onClick={() => completeTaskMutation.mutate(openTask.id)}
                disabled={completeTaskMutation.isPending}
                className="text-xs font-medium px-2.5 py-1 bg-accent-400 text-primary-900 rounded-lg hover:bg-accent-300 disabled:opacity-40 transition-colors flex-shrink-0"
              >
                Completar
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
              {lead.assignedToUserId
                ? 'Sin próxima acción pendiente.'
                : 'Asigna un responsable para generar la primera tarea.'}
            </p>
          )}
        </div>

        {/* Timeline de actividad — justo debajo de la próxima acción, antes que los
            campos editables: es lo primero que se quiere leer al abrir un prospecto. */}
        <div className="mb-4">
          <p className={sectionLabelClass}>
            <Activity size={13} /> Actividad
          </p>
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-1">
            {activities.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                Sin actividad registrada.
              </p>
            ) : (
              activities.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <span
                    className={`px-1.5 py-0.5 rounded-full flex-shrink-0 ${ACTIVITY_TYPE_COLORS[a.type]}`}
                  >
                    {ACTIVITY_TYPE_LABELS[a.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 dark:text-gray-300">{a.content}</p>
                    <p className="text-gray-400 mt-0.5">
                      {formatDateTime(a.occurredAt)}
                      {a.user ? ` · ${a.user.name}` : ''}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          {/* Tipo y mensaje van en filas separadas (en vez de compartir una sola fila
              angosta): así el campo de texto siempre tiene ancho completo para escribir
              cómodo, sin importar qué tan angosto sea el panel. */}
          <div className="space-y-2">
            <select
              value={activityType}
              onChange={(e) => setActivityType(e.target.value)}
              className="w-40 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-500"
            >
              {['llamada', 'whatsapp', 'email', 'visita', 'nota'].map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                value={activityContent}
                onChange={(e) => setActivityContent(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  activityContent.trim() &&
                  addActivityMutation.mutate({
                    id: selected.id,
                    data: { type: activityType, content: activityContent.trim() },
                  })
                }
                placeholder="Registrar interacción..."
                className={rowControlClass}
              />
              <button
                onClick={() =>
                  activityContent.trim() &&
                  addActivityMutation.mutate({
                    id: selected.id,
                    data: { type: activityType, content: activityContent.trim() },
                  })
                }
                disabled={!activityContent.trim() || addActivityMutation.isPending}
                title="Registrar interacción"
                className={rowButtonClass}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Seguimiento — los dos campos que más se tocan durante la jornada. */}
        <div className={`space-y-3 mb-4 ${cardClass}`}>
          <p className={sectionLabelClass}>
            <ArrowRightLeft size={13} /> Seguimiento
          </p>
          <div>
            <label htmlFor={`${formId}-stage`} className={fieldLabelClass}>
              Etapa
            </label>
            <button
              id={`${formId}-stage`}
              onClick={() => onAttemptStageChange(lead)}
              className="w-full flex items-center justify-between px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
            >
              <span>{PIPELINE_STAGE_LABELS[lead.pipelineStage]}</span>
              <ArrowRightLeft size={14} className="text-gray-400 flex-shrink-0" />
            </button>
          </div>
          <div>
            <label htmlFor={`${formId}-assignedToUserId`} className={fieldLabelClass}>
              Responsable
            </label>
            <select
              id={`${formId}-assignedToUserId`}
              value={lead.assignedToUserId || ''}
              onChange={(e) =>
                updateMutation.mutate({
                  id: selected.id,
                  data: { assignedToUserId: e.target.value ? Number(e.target.value) : null },
                })
              }
              className={fieldControlClass}
            >
              <option value="">Sin asignar</option>
              {users
                .filter((u) => u.isActive)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Datos comerciales — información de perfil, se toca con menos frecuencia que
            Seguimiento; separada en su propia tarjeta para no competir visualmente. */}
        <div className={`space-y-3 mb-4 ${cardClass}`}>
          <p className={sectionLabelClass}>
            <Wallet size={13} /> Datos comerciales
          </p>
          <div>
            <label htmlFor={`${formId}-source`} className={fieldLabelClass}>
              Fuente
            </label>
            <select
              id={`${formId}-source`}
              value={selected.source || 'directo'}
              onChange={(e) => {
                updateMutation.mutate({ id: selected.id, data: { source: e.target.value } });
              }}
              className={fieldControlClass}
            >
              {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`${formId}-firstContactDate`} className={fieldLabelClass}>
              Fecha de primer contacto
            </label>
            <div className="flex gap-2">
              <input
                id={`${formId}-firstContactDate`}
                type="date"
                max={todayISODate()}
                value={firstContactInput}
                onChange={(e) => setFirstContactInput(e.target.value)}
                className={`${rowControlClass} text-sm`}
              />
              <button
                onClick={() =>
                  updateMutation.mutate({
                    id: selected.id,
                    data: { firstContactDate: firstContactInput || null },
                  })
                }
                disabled={
                  firstContactInput ===
                  (lead.firstContactDate ? lead.firstContactDate.slice(0, 10) : '')
                }
                className={`${rowButtonClass} text-sm`}
              >
                Guardar
              </button>
            </div>
          </div>
          <div>
            <label htmlFor={`${formId}-paymentMethod`} className={fieldLabelClass}>
              Forma de pago
            </label>
            <select
              id={`${formId}-paymentMethod`}
              value={lead.paymentMethod || ''}
              onChange={(e) =>
                updateMutation.mutate({
                  id: selected.id,
                  data: { paymentMethod: e.target.value || null },
                })
              }
              className={fieldControlClass}
            >
              <option value="">Sin especificar</option>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor={`${formId}-budgetAmount`}
                className="block text-xs font-medium text-gray-500 dark:text-gray-400"
              >
                Monto disponible
              </label>
              <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!lead.budgetNotSpecified}
                  onChange={(e) => {
                    setBudgetAmountInput('');
                    updateMutation.mutate({
                      id: selected.id,
                      data: {
                        budgetNotSpecified: e.target.checked,
                        budgetAmount: e.target.checked ? null : undefined,
                      },
                    });
                  }}
                  className="w-3.5 h-3.5 rounded accent-accent-400"
                />
                No especificó
              </label>
            </div>
            <div className="flex gap-2">
              <input
                id={`${formId}-budgetAmount`}
                type="number"
                min="0"
                step="1000"
                value={budgetAmountInput}
                disabled={lead.budgetNotSpecified}
                onChange={(e) => setBudgetAmountInput(e.target.value)}
                placeholder="Ej. 1500000"
                className={`${rowControlClass} text-sm disabled:opacity-50 disabled:cursor-not-allowed ${budgetAmountInvalid ? 'ring-2 ring-red-400' : ''}`}
              />
              <button
                onClick={() =>
                  updateMutation.mutate({
                    id: selected.id,
                    data: {
                      budgetAmount:
                        budgetAmountInput.trim() === '' ? null : Number(budgetAmountInput),
                      budgetNotSpecified: false,
                    },
                  })
                }
                disabled={
                  lead.budgetNotSpecified ||
                  budgetAmountInvalid ||
                  (budgetAmountInput.trim() === ''
                    ? lead.budgetAmount == null
                    : Number(budgetAmountInput) === Number(lead.budgetAmount))
                }
                className={`${rowButtonClass} text-sm`}
              >
                Guardar
              </button>
            </div>
            {budgetAmountInvalid && (
              <p className="text-xs text-red-500 mt-1">Ingresa un monto válido</p>
            )}
            {!lead.budgetNotSpecified && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {formatBudget(lead.budgetAmount, false)}
              </p>
            )}
          </div>
        </div>

        {/* Propiedades de interés */}
        <div className="mb-4">
          <p className={sectionLabelClass}>
            <Building2 size={13} /> Propiedades de interés
          </p>
          <div className="space-y-1.5 mb-2">
            {interestedProperties.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">Ninguna todavía.</p>
            )}
            {interestedProperties.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 bg-gray-50 dark:bg-[#1a1f2e] rounded-lg px-3 py-1.5 text-xs"
              >
                <span className="text-gray-700 dark:text-gray-300 truncate">{p.title}</span>
                <button
                  onClick={() =>
                    removePropertyMutation.mutate({ leadId: selected.id, propertyId: p.id })
                  }
                  className="text-gray-400 hover:text-red-500 flex-shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0">
              <PropertyPicker
                value={addPropertyId}
                onChange={setAddPropertyId}
                excludeIds={excludePropertyIds}
                placeholder="Agregar propiedad..."
                className="flex items-center gap-2 min-w-0 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs focus-within:ring-2 focus-within:ring-accent-500 bg-white dark:bg-[#1a1f2e]"
              />
            </div>
            <button
              onClick={() =>
                addPropertyId &&
                addPropertyMutation.mutate({
                  leadId: selected.id,
                  propertyId: Number(addPropertyId),
                })
              }
              disabled={!addPropertyId}
              title="Agregar propiedad"
              className={rowButtonClass}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {/* Citas */}
        <div className="mb-4">
          <p className={sectionLabelClass}>
            <Calendar size={13} /> Citas
          </p>
          <div className="space-y-1.5 mb-2 max-h-32 overflow-y-auto pr-1">
            {appointments.length === 0 && (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                Sin citas registradas.
              </p>
            )}
            {appointments.map((a) => (
              <div
                key={a.id}
                className="bg-gray-50 dark:bg-[#1a1f2e] rounded-lg px-3 py-1.5 text-xs flex items-center justify-between"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {formatDateTime(a.scheduledAt)}
                </span>
                <Badge
                  variant={
                    a.status === 'completada'
                      ? 'success'
                      : a.status === 'cancelada'
                        ? 'default'
                        : 'primary'
                  }
                >
                  {a.status}
                </Badge>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              className={rowControlClass}
            />
            <button
              onClick={() =>
                appointmentDate &&
                scheduleMutation.mutate({
                  leadId: selected.id,
                  propertyId: appointmentPropertyId || undefined,
                  scheduledAt: appointmentDate,
                })
              }
              disabled={!appointmentDate || scheduleMutation.isPending}
              className={rowButtonClass}
            >
              Agendar
            </button>
          </div>
        </div>

        {/* Envío de WhatsApp */}
        {selected.phone && (
          <div className="mb-4">
            <p className={sectionLabelClass}>
              <MessageCircle size={13} className="text-green-500" /> Enviar WhatsApp
            </p>
            <div className="flex gap-2">
              <textarea
                value={whatsappMessage}
                onChange={(e) => setWhatsappMessage(e.target.value)}
                rows={2}
                placeholder="Mensaje de seguimiento..."
                className="min-w-0 flex-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500"
              />
              <button
                onClick={() =>
                  whatsappMessage.trim() &&
                  whatsappMutation.mutate({ id: selected.id, message: whatsappMessage.trim() })
                }
                disabled={!whatsappMessage.trim() || whatsappMutation.isPending}
                className="flex-shrink-0 px-3 py-2 bg-green-600 text-white rounded-xl text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
              >
                {whatsappMutation.isPending ? '...' : 'Enviar'}
              </button>
            </div>
          </div>
        )}

        {/* Notas rápidas */}
        <div>
          <p className={sectionLabelClass}>
            <FileText size={13} /> Notas
          </p>
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-1">
            {notesLoading ? (
              <Spinner size="sm" className="py-2" />
            ) : notes.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                Sin notas de seguimiento aún.
              </p>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="group bg-gray-50 dark:bg-[#1a1f2e] rounded-lg px-3 py-2 text-xs relative"
                >
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{note.content}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-400">{formatDateTime(note.createdAt)}</span>
                    <button
                      onClick={() =>
                        deleteNoteMutation.mutate({ leadId: selected.id, noteId: note.id })
                      }
                      className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) =>
                e.key === 'Enter' &&
                !e.shiftKey &&
                noteText.trim() &&
                addNoteMutation.mutate({ id: selected.id, content: noteText.trim() })
              }
              placeholder="Agregar nota..."
              className={rowControlClass}
            />
            <button
              onClick={() =>
                noteText.trim() &&
                addNoteMutation.mutate({ id: selected.id, content: noteText.trim() })
              }
              disabled={!noteText.trim() || addNoteMutation.isPending}
              title="Agregar nota"
              className={rowButtonClass}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// En pantallas angostas (mobile/tablet) el detalle no cabe como tercera columna, así que
// se muestra como overlay a pantalla completa (mismo patrón de slide-in que StageBottomSheet).
// De xl en adelante vuelve a ser la columna lateral fija de siempre.
function DetailPanelSlot({ selected, emptyText, onDeselect, ...panelProps }) {
  const panelRef = useModalA11y(Boolean(selected), onDeselect);
  return (
    <>
      <AnimatePresence>
        {selected && (
          <motion.div
            key="detail-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDeselect}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end xl:hidden"
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-label={selected?.name || 'Detalle de prospecto'}
              tabIndex={-1}
              onClick={(e) => e.stopPropagation()}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="w-full max-w-md h-full overflow-y-auto bg-white dark:bg-[#242938]"
            >
              <LeadDetailPanel selected={selected} onDeselect={onDeselect} {...panelProps} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="hidden xl:block">
        <AnimatePresence mode="wait">
          {selected ? (
            <LeadDetailPanel
              key={selected.id}
              selected={selected}
              onDeselect={onDeselect}
              {...panelProps}
            />
          ) : (
            <motion.div
              key="detail-empty"
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="bg-white dark:bg-[#242938] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-[#2e3650] text-center text-gray-400 dark:text-gray-500"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Mail size={32} className="mx-auto mb-2 opacity-30" />
              </motion.div>
              <p className="text-sm">{emptyText}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default function ProspectosSection() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const currentUserId = useAuthStore((s) => s.user?.id);
  // Permite llegar aquí ya filtrado desde el dashboard (ej. tarjeta "Prospectos nuevos"),
  // vía ?stage= en la URL en vez de location.state — así sobrevive un refresh.
  const [stage, setStage] = useState(searchParams.get('stage') || '');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [checked, setChecked] = useState([]);
  const [view, setView] = useState('list');
  const [closeTarget, setCloseTarget] = useState(null); // { lead, targetStage }
  const [sheetLead, setSheetLead] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const assignedToUserId = onlyMine ? currentUserId : '';

  // Búsqueda y "Mis prospectos" son compartidos entre Lista y Kanban — barra persistente
  // por encima de ambas vistas, tal como pide CRM_UX_DESIGN.md §2g.
  // AUDIT: pedía `limit: 100` y nunca avanzaba de página — el backend (getLeads) ya pagina
  // correctamente, así que con >100 prospectos el conteo mostrado era real pero la lista
  // se veía truncada en silencio. Ahora usa el mismo patrón useInfiniteQuery + "Cargar más"
  // que ya prueba el Kanban de esta misma pantalla (useColumnLeads en KanbanBoard.jsx).
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['leads', stage, search, assignedToUserId],
    queryFn: ({ pageParam = 1 }) =>
      getLeads({
        pipelineStage: stage,
        page: pageParam,
        limit: LEADS_LIST_PAGE_SIZE,
        search: search || undefined,
        assignedToUserId: assignedToUserId || undefined,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages
        ? lastPage.pagination.page + 1
        : undefined,
    initialPageParam: 1,
  });
  const leads = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const leadsTotal = data?.pages?.[0]?.pagination?.total ?? 0;

  const { data: usersData } = useQuery({ queryKey: ['users-all'], queryFn: getUsers });
  const users = usersData?.data ?? [];

  // Usada por la vista Lista (que sigue trayendo un solo lote de prospectos). El Kanban
  // ya no depende de esto: cada columna resuelve sus propias tareas abiertas. `leadIds` se
  // recorta a MAX_BATCH_IDS (100) porque /api/tasks lo exige — con "Cargar más" acumulando
  // páginas, una sesión larga puede superar ese tope; el indicador de "próxima acción" solo
  // deja de calcularse para el excedente, no rompe el resto de la lista.
  const leadIds = useMemo(() => leads.slice(0, 100).map((l) => l.id), [leads]);
  const { data: openTasksData } = useQuery({
    queryKey: ['open-tasks', leadIds.join(',')],
    queryFn: () => getTasks({ leadIds: leadIds.join(','), done: false }),
    enabled: leadIds.length > 0,
  });
  const openTaskByLead = useMemo(() => {
    const map = {};
    (openTasksData?.data ?? []).forEach((t) => {
      map[t.leadId] = t;
    });
    return map;
  }, [openTasksData]);

  // El panel de detalle se abre tanto desde Lista como desde Kanban; en Kanban el
  // prospecto seleccionado puede no estar en el lote de arriba, así que resuelve su
  // próxima acción con una consulta puntual en vez de depender de openTaskByLead.
  const { data: selectedTaskData } = useQuery({
    queryKey: ['open-task-selected', selected?.id],
    queryFn: () => getTasks({ leadIds: String(selected.id), done: false }),
    enabled: !!selected?.id,
  });
  const selectedOpenTask = selectedTaskData?.data?.[0];

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
      // Este mutation se usa para cualquier campo editable del detalle (fuente, forma de
      // pago, monto, fecha de primer contacto, etc.), pero las 8 columnas del Kanban y sus
      // tareas abiertas solo cambian si se movió de etapa o se (re)asignó responsable —
      // invalidar siempre esas ~16 queries en cada edición menor agotaba el rate limit
      // (ver AUDIT: 429 en /api/leads tras editar un campo cualquiera del detalle).
      const affectsColumns = updated.pipelineStage !== undefined;
      const affectsTasks = affectsColumns || updated.assignedToUserId !== undefined;
      if (affectsColumns) queryClient.invalidateQueries(['leads-column']);
      if (affectsTasks) {
        queryClient.invalidateQueries(['open-tasks']);
        queryClient.invalidateQueries(['open-tasks-column']);
        queryClient.invalidateQueries(['open-task-selected']);
      }
      if (updated.pipelineStage)
        setSelected((s) => (s ? { ...s, pipelineStage: updated.pipelineStage } : s));
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al actualizar'),
  });

  const closeWonMutation = useMutation({
    mutationFn: ({ id, data }) => closeLeadAsWon(id, data),
    onSuccess: () => {
      toast.success('Venta registrada exitosamente');
      setCloseTarget(null);
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
      queryClient.invalidateQueries(['open-tasks']);
      queryClient.invalidateQueries(['open-tasks-column']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al registrar la venta'),
  });

  const closeLostMutation = useMutation({
    mutationFn: ({ id, data }) => closeLeadAsLost(id, data),
    onSuccess: () => {
      toast.success('Prospecto cerrado');
      setCloseTarget(null);
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
      queryClient.invalidateQueries(['open-tasks']);
      queryClient.invalidateQueries(['open-tasks-column']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al cerrar el prospecto'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => {
      toast.success('Prospecto eliminado');
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
    },
  });

  const createMutation = useMutation({
    mutationFn: createLead,
    onSuccess: () => {
      toast.success('Prospecto creado exitosamente');
      setCreateOpen(false);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al crear el prospecto'),
  });

  const batchStatusMutation = useMutation({
    mutationFn: ({ ids, stage: s }) => batchUpdateLeads(ids, s),
    onSuccess: (_, { ids }) => {
      toast.success(`${ids.length} prospecto(s) actualizados`);
      setChecked([]);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
      queryClient.invalidateQueries(['open-tasks-column']);
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al actualizar en lote'),
  });

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteLeads,
    onSuccess: (_, ids) => {
      toast.success(`${ids.length} prospecto(s) eliminados`);
      setChecked([]);
      setSelected(null);
      queryClient.invalidateQueries(['leads']);
      queryClient.invalidateQueries(['leads-column']);
    },
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

  const toggleCheck = (e, id) => {
    e.stopPropagation();
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
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
      downloadBlob(response.data, `triomphe-prospectos-${Date.now()}.xlsx`);
    } catch {
      toast.error('Error al exportar');
    }
  };

  const allChecked = leads.length > 0 && checked.length === leads.length;
  const closeLeadForModal = closeLeadDetail?.data || closeTarget?.lead;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-wrap items-center justify-between gap-3 mb-6"
      >
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {leadsTotal} prospectos registrados
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white dark:bg-[#242938] border border-gray-200 dark:border-[#2e3650] rounded-xl px-3 py-2 w-full sm:w-auto">
            <Search size={16} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar por nombre o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 sm:w-48 text-sm focus:outline-none bg-transparent dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>
          {currentUserId && (
            <button
              onClick={() => setOnlyMine((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
                onlyMine
                  ? 'bg-primary-600 border-primary-600 text-white'
                  : 'bg-white dark:bg-[#242938] border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650]'
              }`}
            >
              <UserCheck size={15} /> Mis prospectos
            </button>
          )}
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-3 py-2 bg-accent-400 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 transition-colors"
          >
            <Plus size={16} /> Nuevo prospecto
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
          >
            <FileSpreadsheet size={16} className="text-green-600" /> Excel
          </button>
          <div className="flex border border-gray-200 dark:border-[#2e3650] rounded-xl overflow-hidden">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'list' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-[#242938] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650]'}`}
            >
              <LayoutList size={15} /> Lista
            </button>
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'kanban' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-[#242938] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650]'}`}
            >
              <Columns size={15} /> Kanban
            </button>
          </div>
          <select
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setChecked([]);
            }}
            className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
          >
            <option value="">Todas las etapas</option>
            {Object.entries(PIPELINE_STAGE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </motion.div>

      {view === 'kanban' ? (
        <div className="flex flex-col xl:flex-row gap-6">
          <div className="flex-1 min-w-0">
            <KanbanBoard
              filters={{ search, assignedToUserId }}
              focusStage={stage}
              onSelect={setSelected}
              onAttemptStageChange={attemptStageChange}
            />
          </div>
          {/* Sin prospecto seleccionado no se reserva ancho para el panel — así el Kanban
              usa el espacio completo para mostrar las 8 columnas; en cuanto se selecciona
              un prospecto, el panel reclama sus 320px habituales. */}
          <div
            className={
              selected ? 'xl:w-80 flex-shrink-0' : 'xl:w-0 xl:flex-shrink-0 xl:overflow-hidden'
            }
          >
            <DetailPanelSlot
              selected={selected}
              updateMutation={updateMutation}
              users={users}
              openTask={selectedOpenTask}
              onAttemptStageChange={(lead) => setSheetLead(lead)}
              onDeselect={() => setSelected(null)}
              emptyText="Haz clic en un prospecto para ver el detalle"
              onDelete={() =>
                setConfirm({
                  title: '¿Eliminar este prospecto?',
                  message: `Se eliminará el contacto de ${selected.name} permanentemente.`,
                  onConfirm: () => {
                    deleteMutation.mutate(selected.id);
                    setConfirm(null);
                  },
                })
              }
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="xl:col-span-2 space-y-3">
            {leads.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="w-4 h-4 rounded accent-accent-400 cursor-pointer"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {allChecked ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </span>
              </div>
            )}

            {isLoading ? (
              <Spinner size="lg" className="py-16" />
            ) : (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                <AnimatePresence>
                  {leads.map((lead) => (
                    <motion.div
                      key={lead.id}
                      variants={fadeInUp}
                      layout
                      onClick={() => setSelected(lead)}
                      whileHover={{ x: 4, transition: { duration: 0.15 } }}
                      className={`bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border cursor-pointer transition-all ${
                        selected?.id === lead.id
                          ? 'border-accent-500 dark:border-accent-400 ring-1 ring-accent-500'
                          : 'border-gray-100 dark:border-[#2e3650]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={checked.includes(lead.id)}
                          onChange={(e) => toggleCheck(e, lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 w-4 h-4 rounded accent-accent-400 flex-shrink-0 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-100">
                                {lead.name}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {formatDate(lead.createdAt)} · {typeLabel[lead.type]}
                                {lead.source && lead.source !== 'directo'
                                  ? ` · ${SOURCE_LABELS[lead.source]}`
                                  : ''}
                              </p>
                            </div>
                            <Badge variant={PIPELINE_STAGE_VARIANTS[lead.pipelineStage]}>
                              {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                            {lead.email && (
                              <span className="flex items-center gap-1">
                                <Mail size={12} /> {lead.email}
                              </span>
                            )}
                            {lead.phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={12} /> {lead.phone}
                              </span>
                            )}
                            {lead.property && (
                              <span className="flex items-center gap-1">
                                <Building2 size={12} /> {lead.property.title}
                              </span>
                            )}
                            {lead.paymentMethod && (
                              <span className="flex items-center gap-1">
                                <Wallet size={12} /> {PAYMENT_METHOD_LABELS[lead.paymentMethod]} ·{' '}
                                {formatBudget(lead.budgetAmount, lead.budgetNotSpecified)}
                              </span>
                            )}
                          </div>
                          <NextActionLine task={openTaskByLead[lead.id]} />
                          {lead.message && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 line-clamp-2">
                              {lead.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
            {hasNextPage && (
              <div className="flex justify-center pt-1">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-4 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-[#242938] hover:bg-gray-50 dark:hover:bg-[#2e3650] disabled:opacity-50 transition-colors"
                >
                  {isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
                </button>
              </div>
            )}
            {!isLoading && leads.length === 0 && (
              <motion.div
                variants={fadeIn}
                initial="hidden"
                animate="visible"
                className="text-center py-16 text-gray-400 dark:text-gray-500"
              >
                {stage ? (
                  <>
                    <p>No hay prospectos en esta etapa.</p>
                    <button
                      type="button"
                      onClick={() => setStage('')}
                      className="mt-2 text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    >
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
          <div className="xl:col-span-1">
            <DetailPanelSlot
              selected={selected}
              updateMutation={updateMutation}
              users={users}
              openTask={selectedOpenTask}
              onAttemptStageChange={(lead) => setSheetLead(lead)}
              onDeselect={() => setSelected(null)}
              emptyText="Selecciona un prospecto para ver el detalle"
              onDelete={() =>
                setConfirm({
                  title: '¿Eliminar este prospecto?',
                  message: `Se eliminará el contacto de ${selected.name} permanentemente.`,
                  onConfirm: () => {
                    deleteMutation.mutate(selected.id);
                    setConfirm(null);
                  },
                })
              }
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel="Eliminar"
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      <CloseLeadModal
        open={!!closeTarget}
        lead={closeLeadForModal}
        targetStage={closeTarget?.targetStage}
        isPending={closeWonMutation.isPending || closeLostMutation.isPending}
        onClose={() => setCloseTarget(null)}
        onConfirmWon={(payload) =>
          closeWonMutation.mutate({ id: closeTarget.lead.id, data: payload })
        }
        onConfirmLost={(payload) =>
          closeLostMutation.mutate({ id: closeTarget.lead.id, data: payload })
        }
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
          onDelete={() =>
            setConfirm({
              title: `¿Eliminar ${checked.length} prospecto(s)?`,
              message: 'Esta acción no se puede deshacer.',
              onConfirm: () => {
                batchDeleteMutation.mutate(checked);
                setConfirm(null);
              },
            })
          }
        />
      )}
    </motion.div>
  );
}
