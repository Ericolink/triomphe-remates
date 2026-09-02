import { useId, useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail,
  Phone,
  Building2,
  Calendar,
  Trash2,
  MessageSquare,
  X,
  PhoneCall,
  Plus,
  Activity,
  AlertTriangle,
  Check,
  Loader2,
  Landmark,
  Banknote,
  Target,
  Settings2,
  ShieldAlert,
  LayoutGrid,
  Radio,
  CalendarClock,
  HelpCircle,
  Briefcase,
  Wallet,
  CircleDollarSign,
  MapPin,
  Home,
  Navigation,
  ListChecks,
  Layers,
  UserCheck,
  MessageCircle,
  UserX,
  ExternalLink,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getLeadById,
  getLeadNotes,
  addLeadNote,
  deleteLeadNote,
  addLeadProperty,
  removeLeadProperty,
} from '../../services/leadService';
import { getLeadActivities } from '../../services/activityService';
import { getLeadAppointments, createAppointment } from '../../services/appointmentService';
import useAuthStore from '../../store/authStore';
import { canAssignLeads, canEditLead, canDeleteLeads } from '../../utils/permissions';
import { isInvalidOptionalAmount } from '../../utils/validation';
import { PHONE_PATTERN, PHONE_PATTERN_TITLE } from '../../utils/phone';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import TabBar from '../ui/TabBar';
import PropertyPicker from './PropertyPicker';
import useModalA11y from '../../hooks/useModalA11y';
import { fadeIn, fadeInRight } from '../../utils/animations';
import {
  formatDateTime,
  formatPrice,
  toWhatsAppLink,
  formatBudget,
  todayISODate,
} from '../../utils/formatters';
import {
  SOURCE_LABELS,
  LEAD_TYPE_LABELS,
  LEAD_TYPE_OPTIONS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_VARIANTS,
  TERMINAL_STAGES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_COLORS,
  PAYMENT_METHOD_LABELS,
  BUSINESS_LINE_LABELS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_VARIANTS,
  CITY_LABELS,
  TYPE_LABELS,
  LEAD_SEARCH_CITY_OPTIONS,
  LEAD_SEARCH_TYPE_OPTIONS,
  LEAD_URGENCY_LABELS,
} from '../../utils/constants';

// Estilos compartidos por todos los campos del panel.
const FIELD_LABEL_CLASS =
  'flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';
const FIELD_CONTROL_CLASS =
  'w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-500';
// Compone una fila de "input + botón": min-w-0 + flex-1 hace que el control ceda ante el
// botón en vez de imponer su propio 100% de ancho.
const ROW_CONTROL_CLASS =
  'min-w-0 flex-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500';
const ROW_BUTTON_CLASS =
  'flex-shrink-0 px-2.5 py-2 bg-accent-400 text-primary-900 rounded-xl text-xs font-medium hover:bg-accent-300 disabled:opacity-40 transition-colors';
const SECTION_LABEL_CLASS =
  'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5';
const SUBSECTION_LABEL_CLASS =
  'text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2 mt-4 first:mt-0';
const CARD_CLASS = 'rounded-xl bg-gray-50 dark:bg-[#1a1f2e] p-3';

// Tipos de Activity que representan una interacción humana real. 'sistema' (creación del
// prospecto, cambios de etapa, citas agendadas) y 'reasignacion' quedan fuera a propósito:
// todo prospecto recibe un Activity 'sistema' de "Prospecto creado" al registrarse, así que
// contarlo rompería el badge de "no se ha dado seguimiento" (nunca se apagaría).
const HUMAN_ACTIVITY_TYPES = new Set(['llamada', 'whatsapp', 'email', 'visita', 'nota']);

// PHONE_PATTERN es un string estático propio (utils/phone.js, ya usado como atributo
// `pattern` en los formularios públicos), no entrada de usuario.
// eslint-disable-next-line security/detect-non-literal-regexp
const PHONE_RE = new RegExp(PHONE_PATTERN);

// Mismo ícono que WhatsAppButton.jsx/Footer.jsx (lucide-react no trae el logo de marca) —
// reemplaza a MessageCircle en los dos lugares de este panel que son específicamente
// WhatsApp (botón del encabezado y tab de "Seguimiento"), para no verse como un mensaje
// genérico.
const WhatsAppIcon = ({ size = 16, className = '' }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width={size} height={size} className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.85L.057 23.25l5.565-1.453A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.371l-.36-.214-3.305.863.88-3.217-.235-.371A9.818 9.818 0 1112 21.818z" />
  </svg>
);

// "750000" -> "750,000" — solo para mostrar mientras el campo de presupuesto no tiene foco
// (lead.budgetAmount llega del API como string DECIMAL, ej. "750000.00"); mientras se edita
// se muestra el número plano para no pelear con la posición del cursor al tipear. Mismo
// patrón que formatPriceInput en PropertyFormPage.jsx.
const formatBudgetInput = (value) =>
  value === '' || value === null || value === undefined
    ? ''
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);

// Etapas no terminales, en el mismo orden que PIPELINE_STAGE_LABELS — usado para dibujar
// la barra de progreso de <StageProgress>. Las terminales (venta/no interesado) tienen su
// propia representación (badge de cierre), no forman parte de la barra.
const ACTIVE_STAGES = Object.keys(PIPELINE_STAGE_LABELS).filter(
  (s) => !TERMINAL_STAGES.includes(s)
);

// Pestañas del panel de detalle (rediseño CRM, ago-2026; fusión Resumen+Datos, sep-2026,
// pedido del dueño del negocio) — antes era una sola columna con scroll y dos secciones
// colapsables ("Seguimiento"/"Información adicional"). Se separó en pestañas explícitas
// para que un asesor pueda ir directo a lo que necesita ("Datos" para los criterios de
// búsqueda detallados, "Seguimiento" para registrar avance) sin desplazarse por todo lo
// demás. "Resumen" es la pestaña por defecto: responde en pocos segundos quién es, sus
// datos de contacto, qué busca, en qué etapa está y qué sigue — los campos que muestra son
// editables ahí mismo (ya no hay una pestaña "Datos" aparte solo para eso); los criterios
// de búsqueda más detallados y las propiedades relacionadas siguen viviendo en su propia
// pestaña (Datos) para no duplicar esa UI.
const TABS = [
  { key: 'resumen', label: 'Resumen', icon: <LayoutGrid size={14} /> },
  { key: 'datos', label: 'Datos', icon: <Target size={14} /> },
  { key: 'seguimiento', label: 'Seguimiento', icon: <Activity size={14} /> },
  { key: 'citas', label: 'Citas', icon: <Calendar size={14} /> },
];

// Confirmación contextual junto al campo que acaba de cambiar — reemplaza el toast
// genérico "Prospecto actualizado" (indistinguible entre campos si se editan varios
// seguidos). "saving"/"saved" son de solo-lectura visual; "saved" desaparece solo después
// de un rato (ver saveField). "error" se queda hasta el siguiente intento de guardado.
function FieldStatus({ status }) {
  if (!status) return null;
  if (status.state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500">
        <Loader2 size={11} className="animate-spin" /> Guardando…
      </span>
    );
  }
  if (status.state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-green-600 dark:text-green-400">
        <Check size={11} /> Guardado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400">
      <AlertTriangle size={11} /> {status.message || 'No se pudo guardar'}
    </span>
  );
}

// Subtítulo de un campo con ícono — un vistazo a la pestaña debe bastar para ubicar cada
// input sin leer todos los textos (pedido explícito del usuario). `htmlFor` decide si se
// renderiza como <label> (campos con control propio) o <p> (campos sin un único control,
// ej. "Forma de pago" que son 2 botones).
function FieldLabel({ icon: Icon, htmlFor, children }) {
  const Tag = htmlFor ? 'label' : 'p';
  return (
    <Tag htmlFor={htmlFor} className={FIELD_LABEL_CLASS}>
      <Icon size={12} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
      {children}
    </Tag>
  );
}

// Progreso visual de la etapa — mismo mecanismo de selección de siempre (abre
// StageBottomSheet vía onOpen), solo cambia cómo se ve: una barra de avance en vez de un
// botón con apariencia de <select>. Si el prospecto ya está cerrado, muestra el resultado
// (venta/no interesado) como insignia en vez de la barra — seguir tocándola abre el mismo
// selector, que es como hoy se reabre un prospecto.
function StageProgress({ lead, canEdit, onOpen }) {
  const isTerminal = TERMINAL_STAGES.includes(lead.pipelineStage);

  if (isTerminal) {
    const won = lead.pipelineStage === 'venta_realizada';
    return (
      <button
        type="button"
        onClick={onOpen}
        disabled={!canEdit}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1f2e] disabled:cursor-default"
      >
        <span className="flex items-center gap-2">
          <Badge variant={PIPELINE_STAGE_VARIANTS[lead.pipelineStage]}>
            {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
          </Badge>
          {won && lead.deal?.amount != null && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {formatPrice(Number(lead.deal.amount))}
            </span>
          )}
        </span>
        {canEdit && <span className="text-[11px] text-gray-400 dark:text-gray-500">Reabrir</span>}
      </button>
    );
  }

  const index = ACTIVE_STAGES.indexOf(lead.pipelineStage);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!canEdit}
      title="Cambiar etapa"
      className="w-full text-left disabled:cursor-default group"
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
        </span>
        {canEdit && (
          <span className="text-[11px] text-gray-400 group-hover:text-accent-500 transition-colors">
            Cambiar
          </span>
        )}
      </div>
      <div className="flex gap-1">
        {ACTIVE_STAGES.map((stage, i) => (
          <span
            key={stage}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= index ? 'bg-accent-400' : 'bg-gray-200 dark:bg-[#2e3650]'
            }`}
          />
        ))}
      </div>
    </button>
  );
}

// Exportado además como default (no solo vía DetailPanelSlot) para que otras pantallas
// puedan mostrar la misma tarjeta con su propio contenedor/overlay — ver
// crm/LeadDetailWithActions.jsx (usado por CalendarioSection).
export default function LeadDetailPanel({
  selected,
  onDeselect,
  onDelete,
  updateMutation,
  users,
  onOpenStagePicker,
  onChangeStage,
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const formId = useId();
  const currentUser = useAuthStore((s) => s.user);
  const canAssign = canAssignLeads(currentUser);

  const [activeTab, setActiveTab] = useState('resumen');
  const [nameInput, setNameInput] = useState(selected.name || '');
  const [phoneInput, setPhoneInput] = useState(selected.phone || '');
  const [emailInput, setEmailInput] = useState(selected.email || '');
  const [budgetAmountInput, setBudgetAmountInput] = useState(
    selected.budgetAmount != null ? String(selected.budgetAmount) : ''
  );
  const [budgetAmountFocused, setBudgetAmountFocused] = useState(false);
  const [searchZoneInput, setSearchZoneInput] = useState(selected.searchZone || '');
  const [desiredFeaturesInput, setDesiredFeaturesInput] = useState(
    selected.desiredFeatures || ''
  );
  const [addPropertyId, setAddPropertyId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentPropertyId, setAppointmentPropertyId] = useState('');
  const [composerText, setComposerText] = useState('');
  // Fase 3 del rediseño del CRM: tras registrar una interacción, ofrece saltar directo a
  // Citas para agendar la siguiente acción — sin esto, "registrar" y "agendar" quedan en
  // pestañas separadas y el asesor tiene que acordarse de volver por su cuenta.
  const [justLoggedInteraction, setJustLoggedInteraction] = useState(false);

  // Confirmación por campo (ver FieldStatus) — una entrada por clave de campo, se limpia
  // sola un rato después de "saved". `statusTimers` guarda los setTimeout activos para
  // poder cancelarlos si el campo se vuelve a guardar antes de que termine el anterior.
  const [fieldStatus, setFieldStatus] = useState({});
  const statusTimers = useRef({});
  useEffect(() => () => Object.values(statusTimers.current).forEach(clearTimeout), []);
  // CRM-006: contador de peticiones en vuelo por campo. Si el usuario edita y confirma
  // (blur) el mismo campo de nuevo antes de que la petición anterior resuelva, esa
  // petición anterior queda "obsoleta" — sin esto, si llega a resolver DESPUÉS de la
  // nueva, su callback (éxito o error) pisaría el indicador de la petición más reciente
  // con información que ya no corresponde a lo que el usuario ve/espera.
  const saveRequestSeq = useRef({});

  const budgetAmountInvalid = isInvalidOptionalAmount(budgetAmountInput);

  const { data: detailData } = useQuery({
    queryKey: ['lead-detail', selected?.id],
    queryFn: () => getLeadById(selected.id),
    enabled: !!selected?.id,
  });
  const lead = detailData?.data || selected;
  // Espejo de canEditLead del backend — gatea los mismos campos que el PUT genérico,
  // agendar citas y agregar/quitar propiedades de interés. Notas/actividad/WhatsApp NO se
  // incluyen: el backend solo exige `canViewLead` para esos (cualquiera con acceso de
  // lectura puede seguir registrando avance aunque ya no pueda editar el lead).
  const canEdit = canEditLead(currentUser, lead);

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ['lead-notes', selected?.id],
    queryFn: () => getLeadNotes(selected.id),
    enabled: !!selected?.id,
  });

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ['lead-activities', selected?.id],
    queryFn: () => getLeadActivities(selected.id),
    enabled: !!selected?.id,
  });

  const { data: appointmentsData } = useQuery({
    queryKey: ['lead-appointments', selected?.id],
    queryFn: () => getLeadAppointments(selected.id),
    enabled: !!selected?.id,
  });
  const appointments = appointmentsData?.data ?? [];

  // Línea de tiempo unificada — LeadNote y LeadActivity siguen siendo dos entidades
  // distintas en el backend (ver leadService/activityService); esto solo las combina para
  // que el usuario vea "lo que ha pasado con el prospecto" como una sola lista, sin tener
  // que saber cuál es cuál.
  const timeline = useMemo(() => {
    const noteEntries = (notesData?.data ?? []).map((n) => ({
      id: `note-${n.id}`,
      kind: 'note',
      rawId: n.id,
      type: 'nota',
      content: n.content,
      date: n.createdAt,
      userId: n.userId,
      authorLabel: n.authorName,
    }));
    const activityEntries = (activitiesData?.data ?? []).map((a) => ({
      id: `activity-${a.id}`,
      kind: 'activity',
      type: a.type,
      content: a.content,
      date: a.occurredAt,
      userId: a.user?.id,
      authorLabel: a.user?.name,
    }));
    return [...noteEntries, ...activityEntries].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );
  }, [notesData, activitiesData]);

  // "Qué busca" (pestaña Resumen, solo lectura) — antes se armaba como una sola línea
  // condensada ("Casa · en Cd. Juárez — División del Norte · hasta $1,500,000"), pero eso
  // ocultaba en qué campo exacto quedó cada dato. Pedido explícito del dueño del negocio:
  // mostrar el nombre de cada campo que el prospecto llenó (típicamente desde el formulario
  // público de una propiedad), no una frase armada — así el asesor ve de un vistazo qué puso
  // en cada input, igual que se ve en la pestaña "Datos" donde son editables.
  const searchFields = useMemo(() => {
    const rows = [];
    if (lead.desiredType) {
      rows.push({ label: 'Tipo de propiedad', value: TYPE_LABELS[lead.desiredType] || lead.desiredType });
    }
    if (lead.searchCity) {
      rows.push({ label: 'Ciudad', value: CITY_LABELS[lead.searchCity] || lead.searchCity });
    }
    if (lead.searchZone) {
      rows.push({ label: 'Colonia/zona', value: lead.searchZone });
    }
    if (lead.minBedrooms) rows.push({ label: 'Recámaras mínimas', value: `${lead.minBedrooms}+` });
    if (lead.minBathrooms) rows.push({ label: 'Baños mínimos', value: `${lead.minBathrooms}+` });
    if (lead.budgetNotSpecified) {
      rows.push({ label: 'Presupuesto', value: 'No especificó' });
    } else if (lead.budgetAmount != null) {
      rows.push({ label: 'Presupuesto', value: formatBudget(lead.budgetAmount, false) });
    }
    return rows;
  }, [lead]);

  // Guarda un campo vía el PUT genérico y refleja el resultado junto al campo (ver
  // FieldStatus) en vez del toast global que usaba todo el panel antes. `updateMutation`
  // es una única mutation COMPARTIDA por todos los campos del panel (y por
  // attemptStageChange) — ver useLeadDetailActions.js.
  //
  // CRM-006: por eso NO se le pasan callbacks por-llamada (`.mutate(vars, {onSuccess,
  // onError})`) como antes. React Query guarda esos callbacks en un único campo del
  // observer de la mutation, que se SOBREESCRIBE en cada `.mutate()` — si el usuario
  // confirma OTRO campo (o el mismo, dos veces) antes de que la petición anterior
  // resuelva, esa petición anterior se queda sin observador y su callback nunca se
  // invoca: el indicador de ESE campo se quedaba en "Guardando…" para siempre, aunque el
  // PUT sí hubiera terminado en el servidor. `mutateAsync` en cambio devuelve la promesa
  // real de ESA llamada específica (`.mutate` normal siempre devuelve `undefined` — ver
  // node_modules/@tanstack/react-query/src/useMutation.ts), que resuelve de forma
  // independiente sin importar qué otras llamadas se hagan después — por eso se usa
  // `.then()` sobre ella en vez de las opciones. `isStale()` cubre el caso restante: que
  // la respuesta de una edición VIEJA del MISMO campo llegue después de una más reciente
  // (el usuario editó y confirmó el mismo campo dos veces seguidas) — sin esto, esa
  // respuesta tardía podría pisar el indicador ya actualizado por la petición más nueva.
  const saveField = (key, data) => {
    const seq = (saveRequestSeq.current[key] = (saveRequestSeq.current[key] || 0) + 1);
    const isStale = () => saveRequestSeq.current[key] !== seq;

    setFieldStatus((s) => ({ ...s, [key]: { state: 'saving' } }));
    clearTimeout(statusTimers.current[key]);
    updateMutation.mutateAsync({ id: selected.id, data }).then(
      () => {
        if (isStale()) return;
        setFieldStatus((s) => ({ ...s, [key]: { state: 'saved' } }));
        statusTimers.current[key] = setTimeout(() => {
          setFieldStatus((s) => {
            if (s[key]?.state !== 'saved') return s;
            const next = { ...s };
            delete next[key];
            return next;
          });
        }, 2500);
      },
      (e) => {
        if (isStale()) return;
        const message = e?.response?.data?.error || 'No se pudo guardar';
        // Además del indicador inline (que solo existe mientras la pestaña/prospecto de
        // este campo sigan montados — ver comentario de FieldStatus más arriba), un toast
        // global garantiza que el usuario se entere de un guardado fallido aunque ya haya
        // cambiado de pestaña o de prospecto antes de que la respuesta llegara.
        toast.error(message);
        setFieldStatus((s) => ({ ...s, [key]: { state: 'error', message } }));
      }
    );
  };

  const commitName = () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setFieldStatus((s) => ({ ...s, name: { state: 'error', message: 'El nombre es requerido' } }));
      setNameInput(lead.name || '');
      return;
    }
    if (trimmed === lead.name) return;
    saveField('name', { name: trimmed });
  };

  const commitPhone = () => {
    const trimmed = phoneInput.trim();
    if (trimmed && !PHONE_RE.test(trimmed)) {
      setFieldStatus((s) => ({
        ...s,
        phone: { state: 'error', message: `Teléfono inválido — ${PHONE_PATTERN_TITLE}` },
      }));
      return;
    }
    if (trimmed === (lead.phone || '')) return;
    saveField('phone', { phone: trimmed || null });
  };

  const commitEmail = () => {
    const trimmed = emailInput.trim();
    if (trimmed === (lead.email || '')) return;
    saveField('email', { email: trimmed || null });
  };

  const commitBudget = () => {
    if (budgetAmountInvalid || lead.budgetNotSpecified) return;
    const amount = budgetAmountInput.trim() === '' ? null : Number(budgetAmountInput);
    if (amount === (lead.budgetAmount != null ? Number(lead.budgetAmount) : null)) return;
    saveField('budgetAmount', { budgetAmount: amount, budgetNotSpecified: false });
  };

  const commitSearchZone = () => {
    const trimmed = searchZoneInput.trim();
    if (trimmed === (lead.searchZone || '')) return;
    saveField('searchZone', { searchZone: trimmed || null });
  };

  const commitDesiredFeatures = () => {
    const trimmed = desiredFeaturesInput.trim();
    if (trimmed === (lead.desiredFeatures || '')) return;
    saveField('desiredFeatures', { desiredFeatures: trimmed || null });
  };

  const addNoteMutation = useMutation({
    mutationFn: ({ id, content }) => addLeadNote(id, content),
    onSuccess: () => {
      setComposerText('');
      setFieldStatus((s) => ({ ...s, composer: undefined }));
      setJustLoggedInteraction(true);
      queryClient.invalidateQueries(['lead-notes', selected.id]);
    },
    onError: (e) =>
      setFieldStatus((s) => ({
        ...s,
        composer: { state: 'error', message: e?.response?.data?.error || 'No se pudo guardar la nota' },
      })),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: ({ leadId, noteId }) => deleteLeadNote(leadId, noteId),
    onSuccess: () => queryClient.invalidateQueries(['lead-notes', selected.id]),
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

  const composerPending = addNoteMutation.isPending;

  // Composer simplificado a solo texto (pedido explícito del usuario) — cada entrada se
  // guarda siempre como Nota. Antes se podía elegir tipo (llamada/whatsapp/email/visita)
  // vía una fila de botones; "whatsapp" además disparaba un envío real por
  // sendLeadWhatsApp, que quedó sin punto de entrada en la UI al quitar esa fila (decisión
  // confirmada con el usuario). El ícono de WhatsApp del encabezado sigue abriendo
  // wa.me para escribir manualmente. Los tipos llamada/email/visita/reasignación/sistema
  // siguen existiendo y mostrándose en la línea de tiempo — solo ya no se pueden crear
  // manualmente desde aquí.
  const handleComposerSubmit = () => {
    const text = composerText.trim();
    if (!text) return;
    addNoteMutation.mutate({ id: selected.id, content: text });
  };

  const interestedProperties = lead.interestedProperties || [];
  const excludePropertyIds = [
    lead.propertyId,
    ...interestedProperties.map((ip) => ip.id),
  ].filter(Boolean);

  const isTerminal = TERMINAL_STAGES.includes(lead.pipelineStage);
  const knownType = LEAD_TYPE_OPTIONS.some((o) => o.value === lead.type);

  // Fase 3 del rediseño del CRM: "necesita seguimiento" no es un campo que alguien tenga que
  // mantener a mano — se calcula de si ya existe alguna interacción humana real (llamada,
  // whatsapp, email, visita o nota) registrada. La urgencia declarada por el prospecto ya no
  // decide esto (sigue visible/editable en "Qué busca"): un lead puede llegar con urgencia
  // inmediata y aun así no haber sido tocado por nadie, que es justo el caso que se quiere
  // señalar. Mientras las notas/actividades siguen cargando, no se muestra nada (evita un
  // parpadeo del badge). Un lead cerrado nunca se marca.
  const hasFollowUp =
    (notesData?.data?.length ?? 0) > 0 ||
    (activitiesData?.data ?? []).some((a) => HUMAN_ACTIVITY_TYPES.has(a.type));
  const needsFollowUp = !isTerminal && !notesLoading && !activitiesLoading && !hasFollowUp;

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
        {/* ── Encabezado: siempre visible, nunca se colapsa ni depende de la pestaña
            activa. Nombre y teléfono ya son editables, y "Llamar"/"WhatsApp"/"Cerrar" son
            acciones de alta frecuencia sin importar en qué pestaña esté el asesor. */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
                Detalle del prospecto
              </p>
              {needsFollowUp && (
                <span
                  title="Sin llamada, whatsapp, email, visita ni nota registrada"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 flex-shrink-0"
                >
                  <UserX size={11} /> No se ha dado seguimiento
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                disabled={!canEdit}
                placeholder="Nombre del prospecto"
                aria-label="Nombre"
                className="min-w-0 flex-1 font-bold text-gray-800 dark:text-gray-100 bg-transparent border border-transparent rounded-lg px-1.5 -mx-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:bg-white dark:focus:bg-[#1a1f2e] disabled:opacity-100"
              />
            </div>
            <FieldStatus status={fieldStatus.name} />
            <div className="flex items-center gap-1.5 mt-1">
              <Phone size={11} className="flex-shrink-0 text-gray-400" />
              <input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                onBlur={commitPhone}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                disabled={!canEdit}
                type="tel"
                placeholder="Sin teléfono"
                aria-label="Teléfono"
                className="min-w-0 flex-1 text-xs text-gray-500 dark:text-gray-400 bg-transparent border border-transparent rounded-lg px-1.5 -mx-1.5 py-0.5 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:bg-white dark:focus:bg-[#1a1f2e]"
              />
            </div>
            <FieldStatus status={fieldStatus.phone} />
            {selected.property?.title && (
              <a
                href={selected.property.slug ? `/propiedades/${selected.property.slug}` : undefined}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver propiedad"
                className="flex items-center gap-1 mt-1 text-xs text-gray-500 dark:text-gray-400 min-w-0 hover:text-accent-500 dark:hover:text-accent-400 hover:underline"
              >
                <Building2 size={11} className="flex-shrink-0" />
                <span className="truncate">{selected.property.title}</span>
              </a>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {lead.phone && (
              <a
                href={`tel:${lead.phone}`}
                title="Llamar"
                className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
              >
                <PhoneCall size={18} />
              </a>
            )}
            {lead.phone && (
              <a
                href={toWhatsAppLink(lead.phone)}
                target="_blank"
                rel="noopener noreferrer"
                title="WhatsApp"
                className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
              >
                <WhatsAppIcon size={18} />
              </a>
            )}
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

        <div className="mt-4">
          <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
        </div>

        {/* ── Resumen: responde en pocos segundos quién es, qué busca, en qué etapa está
            y qué sigue — incluye sus datos de contacto (fusionado desde la antigua pestaña
            "Datos", pedido del dueño del negocio) y por eso ya son editables aquí mismo,
            junto con la urgencia. Los criterios de búsqueda más detallados y las
            propiedades relacionadas se siguen editando en su pestaña dedicada (Datos, antes
            "Búsqueda") para no duplicar esa UI. */}
        {activeTab === 'resumen' && (
          <div>
            <div className="mb-4">
              <StageProgress lead={lead} canEdit={canEdit} onOpen={() => onOpenStagePicker(lead)} />
              {canEdit && !isTerminal && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <button
                    onClick={() => onChangeStage(lead, 'venta_realizada')}
                    className="flex-1 min-w-[6rem] py-2.5 rounded-xl text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                  >
                    Marcar venta
                  </button>
                  <button
                    onClick={() => onChangeStage(lead, 'no_interesado')}
                    className="flex-1 min-w-[6rem] py-2.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
                  >
                    No interesado
                  </button>
                  <button
                    onClick={() => onChangeStage(lead, 'lista_espera')}
                    className="flex-1 min-w-[6rem] py-2.5 rounded-xl text-xs font-semibold border border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
                  >
                    Lista de espera
                  </button>
                </div>
              )}
            </div>

            {/* Datos de contacto — antes vivían en su propia pestaña "Datos"; el dueño del
                negocio pidió fusionarla con Resumen (un prospecto sin abrir una segunda
                pestaña ya muestra sus datos, no solo su etapa). */}
            <div className={`mb-3 ${CARD_CLASS}`}>
              <p className={SECTION_LABEL_CLASS}>
                <Settings2 size={13} /> Datos de contacto
              </p>
              <div className="space-y-3 mt-1.5">
                <div>
                  <FieldLabel icon={Mail} htmlFor={`${formId}-email`}>
                    Email
                  </FieldLabel>
                  <input
                    id={`${formId}-email`}
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onBlur={commitEmail}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    disabled={!canEdit}
                    placeholder="Sin email"
                    className={`${FIELD_CONTROL_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  <FieldStatus status={fieldStatus.email} />
                </div>
                <div>
                  <FieldLabel icon={Radio} htmlFor={`${formId}-source`}>
                    Fuente
                  </FieldLabel>
                  <select
                    id={`${formId}-source`}
                    value={selected.source || 'directo'}
                    onChange={(e) => saveField('source', { source: e.target.value })}
                    disabled={!canEdit}
                    className={`${FIELD_CONTROL_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                  <FieldStatus status={fieldStatus.source} />
                </div>
                <div>
                  <FieldLabel icon={CalendarClock} htmlFor={`${formId}-firstContactDate`}>
                    Fecha de primer contacto
                  </FieldLabel>
                  <input
                    id={`${formId}-firstContactDate`}
                    type="date"
                    max={todayISODate()}
                    value={lead.firstContactDate ? lead.firstContactDate.slice(0, 10) : ''}
                    onChange={(e) =>
                      saveField('firstContactDate', { firstContactDate: e.target.value || null })
                    }
                    disabled={!canEdit}
                    className={`${FIELD_CONTROL_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                  <FieldStatus status={fieldStatus.firstContactDate} />
                </div>
              </div>
              {(lead.campaign ||
                lead.createdByUser ||
                lead.assignedAt ||
                lead.utmMedium ||
                lead.utmCampaign ||
                lead.utmContent ||
                lead.landingPageUrl) && (
                <div className="text-xs text-gray-400 dark:text-gray-500 space-y-0.5 mt-3 pt-2 border-t border-gray-200 dark:border-[#2e3650]">
                  {lead.campaign && <p>Campaña: {lead.campaign.name}</p>}
                  {lead.createdByUser && <p>Creado por: {lead.createdByUser.name}</p>}
                  {lead.assignedAt && <p>Asignado el: {formatDateTime(lead.assignedAt)}</p>}
                  {/* Fase 3a del rediseño del CRM — atribución capturada automáticamente,
                      nunca editable a mano (refleja lo que realmente pasó). */}
                  {(lead.utmMedium || lead.utmCampaign || lead.utmContent) && (
                    <p>
                      UTM:{' '}
                      {[lead.utmMedium, lead.utmCampaign, lead.utmContent].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {lead.landingPageUrl && <p className="truncate">Página de origen: {lead.landingPageUrl}</p>}
                </div>
              )}
            </div>

            <div className={`mb-3 ${CARD_CLASS}`}>
              <p className={SECTION_LABEL_CLASS}>
                <Target size={13} /> Qué busca
              </p>
              {searchFields.length > 0 ? (
                <dl className="space-y-1 mt-1.5">
                  {searchFields.map(({ label, value }) => (
                    <div key={label} className="flex items-baseline gap-1.5 text-sm">
                      <dt className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                        {label}:
                      </dt>
                      <dd className="text-gray-700 dark:text-gray-200">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-1.5">
                  Sin información de búsqueda todavía — complétala en la pestaña "Datos".
                </p>
              )}
              {lead.desiredFeatures && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 italic">
                  "{lead.desiredFeatures}"
                </p>
              )}
              {/* Fase 3 del rediseño del CRM: urgencia editable aquí mismo — es el campo
                  que más cambia según cómo va el seguimiento (y el que alimenta el badge de
                  prioridad del encabezado), así que forzar un cambio de pestaña a "Datos"
                  solo para actualizarlo era la fricción más evitable. El resto de los
                  criterios de búsqueda no se duplican aquí — ya están completos en
                  `searchFields` arriba, y editarlos vive en su pestaña dedicada. */}
              <div className="flex items-center gap-2 mt-2">
                <select
                  aria-label="Urgencia"
                  value={lead.urgency || ''}
                  onChange={(e) => saveField('urgency', { urgency: e.target.value || null })}
                  disabled={!canEdit}
                  className="px-2 py-1 border border-gray-200 dark:border-[#2e3650] rounded-lg text-xs bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Urgencia: sin especificar</option>
                  {Object.entries(LEAD_URGENCY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      Urgencia: {l}
                    </option>
                  ))}
                </select>
                <FieldStatus status={fieldStatus.urgency} />
              </div>
            </div>

            {selected.message && (
              <div className={`mb-3 ${CARD_CLASS}`}>
                <p className={SECTION_LABEL_CLASS}>
                  <MessageSquare size={13} /> Mensaje inicial
                </p>
                <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed mt-1.5">
                  {selected.message}
                </p>
              </div>
            )}

            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Registrado el {formatDateTime(lead.createdAt)}
            </p>
          </div>
        )}

        {/* ── Datos (antes "Búsqueda", renombrada cuando "Datos de contacto" se fusionó con
            Resumen y dejó libre el nombre): todo lo que describe la necesidad del
            prospecto — motivo, forma de pago/presupuesto (ya existían) más los criterios
            estructurados (zona, tipo, recámaras/baños, características, urgencia) y las
            propiedades relacionadas. */}
        {activeTab === 'datos' && (
          <div>
            <p className={SUBSECTION_LABEL_CLASS}>Necesidad</p>
            <div className="space-y-3">
              <div>
                <FieldLabel icon={HelpCircle} htmlFor={`${formId}-type`}>
                  Motivo de contacto
                </FieldLabel>
                <select
                  id={`${formId}-type`}
                  value={lead.type}
                  onChange={(e) => saveField('type', { type: e.target.value })}
                  disabled={!canEdit}
                  className={`${FIELD_CONTROL_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {!knownType && (
                    <option value={lead.type} disabled>
                      {LEAD_TYPE_LABELS[lead.type] || lead.type}
                    </option>
                  )}
                  {LEAD_TYPE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <FieldStatus status={fieldStatus.type} />
              </div>
              <div>
                <FieldLabel icon={Briefcase} htmlFor={`${formId}-businessLine`}>
                  Línea de negocio
                </FieldLabel>
                <select
                  id={`${formId}-businessLine`}
                  value={lead.businessLine || ''}
                  onChange={(e) => saveField('businessLine', { businessLine: e.target.value || null })}
                  disabled={!canEdit}
                  className={`${FIELD_CONTROL_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="">Sin especificar</option>
                  {Object.entries(BUSINESS_LINE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <FieldStatus status={fieldStatus.businessLine} />
              </div>

              {/* Forma de pago: 2 opciones nada más, así que son 2 botones visibles en vez
                  de un <select> — se ve de un vistazo cuál está elegida y toma un solo toque. */}
              <div>
                <FieldLabel icon={Wallet}>Forma de pago</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => {
                    const Icon = value === 'credito_hipotecario' ? Landmark : Banknote;
                    const active = lead.paymentMethod === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          saveField('paymentMethod', { paymentMethod: active ? null : value })
                        }
                        disabled={!canEdit}
                        className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          active
                            ? 'bg-accent-400 border-accent-400 text-primary-900'
                            : 'bg-white dark:bg-[#1a1f2e] border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650]'
                        }`}
                      >
                        <Icon size={16} />
                        {label}
                      </button>
                    );
                  })}
                </div>
                <FieldStatus status={fieldStatus.paymentMethod} />
              </div>

              {/* Presupuesto: un input + "No especificó" nada más. Se guarda solo al salir
                  del campo, sin botón aparte. */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <FieldLabel icon={CircleDollarSign} htmlFor={`${formId}-budgetAmount`}>
                    Presupuesto
                  </FieldLabel>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!lead.budgetNotSpecified}
                      onChange={(e) => {
                        setBudgetAmountInput('');
                        saveField('budgetNotSpecified', {
                          budgetNotSpecified: e.target.checked,
                          budgetAmount: e.target.checked ? null : undefined,
                        });
                      }}
                      disabled={!canEdit}
                      className="w-3.5 h-3.5 rounded accent-accent-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    No especificó
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-gray-400 dark:text-gray-500">$</span>
                  <input
                    id={`${formId}-budgetAmount`}
                    type="text"
                    inputMode="numeric"
                    value={budgetAmountFocused ? budgetAmountInput : formatBudgetInput(budgetAmountInput)}
                    disabled={!canEdit || lead.budgetNotSpecified}
                    onFocus={() => setBudgetAmountFocused(true)}
                    onChange={(e) => setBudgetAmountInput(e.target.value.replace(/\D/g, ''))}
                    onBlur={() => {
                      setBudgetAmountFocused(false);
                      commitBudget();
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    placeholder="1,500,000"
                    className={`${ROW_CONTROL_CLASS} text-sm disabled:opacity-50 disabled:cursor-not-allowed ${budgetAmountInvalid ? 'ring-2 ring-red-400' : ''}`}
                  />
                </div>
                {budgetAmountInvalid ? (
                  <p className="text-xs text-red-500 mt-1">Ingresa un monto válido</p>
                ) : (
                  <FieldStatus status={fieldStatus.budgetAmount || fieldStatus.budgetNotSpecified} />
                )}
                {!lead.budgetNotSpecified && lead.budgetAmount != null && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {formatBudget(lead.budgetAmount, false)}
                  </p>
                )}
              </div>
            </div>

            <p className={SUBSECTION_LABEL_CLASS}>Criterios de búsqueda</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel icon={MapPin} htmlFor={`${formId}-searchCity`}>
                    Ciudad
                  </FieldLabel>
                  <select
                    id={`${formId}-searchCity`}
                    value={lead.searchCity || ''}
                    onChange={(e) => saveField('searchCity', { searchCity: e.target.value || null })}
                    disabled={!canEdit}
                    className={`${FIELD_CONTROL_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <option value="">Sin especificar</option>
                    {LEAD_SEARCH_CITY_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <FieldStatus status={fieldStatus.searchCity} />
                </div>
                <div>
                  <FieldLabel icon={Home} htmlFor={`${formId}-desiredType`}>
                    Tipo de propiedad
                  </FieldLabel>
                  <select
                    id={`${formId}-desiredType`}
                    value={lead.desiredType || ''}
                    onChange={(e) => saveField('desiredType', { desiredType: e.target.value || null })}
                    disabled={!canEdit}
                    className={`${FIELD_CONTROL_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <option value="">Sin especificar</option>
                    {LEAD_SEARCH_TYPE_OPTIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <FieldStatus status={fieldStatus.desiredType} />
                </div>
              </div>
              <div>
                <FieldLabel icon={Navigation} htmlFor={`${formId}-searchZone`}>
                  Colonia/zona específica
                </FieldLabel>
                <input
                  id={`${formId}-searchZone`}
                  type="text"
                  value={searchZoneInput}
                  onChange={(e) => setSearchZoneInput(e.target.value)}
                  onBlur={commitSearchZone}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  disabled={!canEdit}
                  placeholder="Ej. Campestre, Las Águilas..."
                  className={`${FIELD_CONTROL_CLASS} disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                <FieldStatus status={fieldStatus.searchZone} />
              </div>
              <div>
                <FieldLabel icon={ListChecks} htmlFor={`${formId}-desiredFeatures`}>
                  Características deseadas
                </FieldLabel>
                <textarea
                  id={`${formId}-desiredFeatures`}
                  value={desiredFeaturesInput}
                  onChange={(e) => setDesiredFeaturesInput(e.target.value)}
                  onBlur={commitDesiredFeatures}
                  disabled={!canEdit}
                  rows={2}
                  placeholder="Ej. con cochera, una planta, cerca de escuelas..."
                  className={`${FIELD_CONTROL_CLASS} resize-none disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                <FieldStatus status={fieldStatus.desiredFeatures} />
              </div>
            </div>

            <p className={SUBSECTION_LABEL_CLASS}>Propiedades</p>
            <div className="space-y-3">
              {/* Propiedad de origen — con la que llegó el prospecto (lead.propertyId), ya
                  vinculada automáticamente desde el formulario público (ver ContactForm). */}
              <div>
                <FieldLabel icon={Building2}>Propiedad de origen</FieldLabel>
                {canEdit ? (
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 min-w-0">
                      <PropertyPicker
                        value={lead.propertyId || ''}
                        initialLabel={lead.property?.title || ''}
                        onChange={(id) =>
                          saveField('propertyId', { propertyId: id ? Number(id) : null })
                        }
                        placeholder="Sin propiedad vinculada"
                        className="flex items-center gap-2 min-w-0 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs focus-within:ring-2 focus-within:ring-accent-500 bg-white dark:bg-[#242938]"
                      />
                    </div>
                    {lead.property?.slug && (
                      <a
                        href={`/propiedades/${lead.property.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver propiedad"
                        className="p-2 text-gray-400 hover:text-accent-500 flex-shrink-0"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ) : lead.property?.slug ? (
                  <a
                    href={`/propiedades/${lead.property.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Ver propiedad"
                    className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 py-1 hover:text-accent-500 dark:hover:text-accent-400 hover:underline w-fit"
                  >
                    {lead.property.title}
                    <ExternalLink size={12} className="flex-shrink-0" />
                  </a>
                ) : (
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 py-1">
                    {lead.property?.title || 'Sin propiedad vinculada'}
                  </p>
                )}
                <FieldStatus status={fieldStatus.propertyId} />
              </div>

              {/* Propiedades de interés — ver/buscar/agregar/quitar. */}
              <div>
                <FieldLabel icon={Layers}>Otras propiedades de interés</FieldLabel>
                <div className="space-y-1.5 mb-2">
                  {interestedProperties.length === 0 && (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">Ninguna todavía.</p>
                  )}
                  {interestedProperties.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 bg-white dark:bg-[#242938] rounded-lg px-3 py-1.5 text-xs"
                    >
                      <span className="text-gray-700 dark:text-gray-300 truncate">{p.title}</span>
                      {canEdit && (
                        <button
                          onClick={() =>
                            removePropertyMutation.mutate({ leadId: selected.id, propertyId: p.id })
                          }
                          className="text-gray-400 hover:text-red-500 flex-shrink-0"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {canEdit && (
                  <div className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <PropertyPicker
                        value={addPropertyId}
                        onChange={setAddPropertyId}
                        excludeIds={excludePropertyIds}
                        placeholder="Agregar propiedad..."
                        className="flex items-center gap-2 min-w-0 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs focus-within:ring-2 focus-within:ring-accent-500 bg-white dark:bg-[#242938]"
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
                      className={ROW_BUTTON_CLASS}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Seguimiento — Notas y Actividad (y el envío real de WhatsApp) fusionados en
            una sola experiencia: un compositor con "tipo de interacción" + texto, y una
            línea de tiempo cronológica debajo. El backend sigue guardando LeadNote y
            LeadActivity como entidades separadas — esto es solo presentación. Se
            deliberadamente NO se separó en "Seguimiento" + "Notas" (aunque el pedido
            original lo sugería como ejemplo): partirlo en dos pestañas fragmentaría de
            vuelta la línea de tiempo unificada que ya se construyó a propósito. Responsable
            vive aquí también (a quién le toca dar seguimiento). */}
        {activeTab === 'seguimiento' && (
          <div>
            {/* Responsable: exclusivo de admin/asistente_administrativo (únicos roles que
                pueden reasignar, ver canAssignLeads) — un asesor_ventas solo ve leads que ya
                son suyos, así que mostrárselo aquí era información redundante, no útil. */}
            {canAssign && (
              <div className="mb-3">
                <FieldLabel icon={UserCheck} htmlFor={`${formId}-assignedToUserId`}>
                  Responsable
                </FieldLabel>
                <select
                  id={`${formId}-assignedToUserId`}
                  value={lead.assignedToUserId || ''}
                  onChange={(e) =>
                    saveField('assignedToUserId', {
                      assignedToUserId: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  className={FIELD_CONTROL_CLASS}
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
                <FieldStatus status={fieldStatus.assignedToUserId} />
              </div>
            )}

            <div className="mb-3">
              <FieldLabel icon={MessageCircle}>¿Qué pasó con este prospecto?</FieldLabel>
              <div className="flex gap-2">
                <textarea
                  value={composerText}
                  onChange={(e) => {
                    setComposerText(e.target.value);
                    setJustLoggedInteraction(false);
                  }}
                  rows={2}
                  placeholder="Escribe una nota o registra una interacción..."
                  className="min-w-0 flex-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs resize-none focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500"
                />
                <button
                  onClick={handleComposerSubmit}
                  disabled={!composerText.trim() || composerPending}
                  className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-40 transition-colors bg-accent-400 text-primary-900 hover:bg-accent-300"
                >
                  {composerPending ? '...' : 'Agregar'}
                </button>
              </div>
              <FieldStatus status={fieldStatus.composer} />
              {/* Fase 3 del rediseño del CRM: cierra el ciclo "registrar → agendar" sin
                  obligar al asesor a acordarse de cambiar de pestaña por su cuenta. */}
              {justLoggedInteraction && (
                <div className="flex items-center justify-between gap-2 mt-2 px-3 py-2 rounded-xl bg-accent-50 dark:bg-accent-900/10 border border-accent-200 dark:border-accent-800/40">
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Interacción registrada. ¿Agendar la siguiente acción?
                  </p>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        setActiveTab('citas');
                        setJustLoggedInteraction(false);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-accent-400 text-primary-900 hover:bg-accent-300 transition-colors"
                    >
                      Agendar
                    </button>
                    <button
                      onClick={() => setJustLoggedInteraction(false)}
                      aria-label="Descartar"
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {notesLoading ? (
                <Spinner size="sm" className="py-2" />
              ) : timeline.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  Sin actividad registrada todavía.
                </p>
              ) : (
                timeline.map((entry) => (
                  <div
                    key={entry.id}
                    className="group flex items-start gap-2 text-xs bg-gray-50 dark:bg-[#1a1f2e] rounded-lg px-3 py-2"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded-full flex-shrink-0 ${ACTIVITY_TYPE_COLORS[entry.type] || ACTIVITY_TYPE_COLORS.nota}`}
                    >
                      {ACTIVITY_TYPE_LABELS[entry.type] || 'Nota'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {entry.content}
                      </p>
                      <p className="text-gray-400 mt-0.5">
                        {formatDateTime(entry.date)}
                        {entry.authorLabel ? ` · ${entry.authorLabel}` : ''}
                      </p>
                    </div>
                    {entry.kind === 'note' && (canEdit || entry.userId === currentUser?.id) && (
                      <button
                        onClick={() =>
                          deleteNoteMutation.mutate({ leadId: selected.id, noteId: entry.rawId })
                        }
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity flex-shrink-0"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Citas: mismo contenido de siempre, ahora en su propia pestaña en vez de
            tarjeta siempre visible. */}
        {activeTab === 'citas' && (
          <div className={CARD_CLASS}>
            <p className={SECTION_LABEL_CLASS}>
              <Calendar size={13} /> Citas
            </p>
            <div className="space-y-1.5 mt-2 mb-2 max-h-64 overflow-y-auto pr-1">
              {appointments.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                  Sin citas registradas.
                </p>
              )}
              {appointments.map((a) => (
                <div
                  key={a.id}
                  className="bg-white dark:bg-[#242938] rounded-lg px-3 py-1.5 text-xs flex items-center justify-between gap-2"
                >
                  <span className="text-gray-700 dark:text-gray-300">
                    {formatDateTime(a.scheduledAt)}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge variant={APPOINTMENT_STATUS_VARIANTS[a.status]}>
                      {APPOINTMENT_STATUS_LABELS[a.status]}
                    </Badge>
                    <button
                      onClick={() =>
                        navigate(
                          `/admin/crm?tab=calendario&date=${encodeURIComponent(a.scheduledAt)}&appointmentId=${a.id}`
                        )
                      }
                      title="Ver cita en el calendario"
                      className="p-1 text-gray-400 hover:text-primary-500"
                    >
                      <ExternalLink size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  className={ROW_CONTROL_CLASS}
                />
                <button
                  onClick={() =>
                    // CAL-001: el valor crudo de <input type="datetime-local"> no trae
                    // zona horaria — new Date(...) lo interpreta como hora LOCAL DEL
                    // NAVEGADOR (correcto, es la zona horaria real de quien agenda) y
                    // toISOString() lo manda como UTC explícito, para que el servidor lo
                    // interprete igual sin importar en qué zona horaria esté corriendo.
                    appointmentDate &&
                    scheduleMutation.mutate({
                      leadId: selected.id,
                      propertyId: appointmentPropertyId || undefined,
                      scheduledAt: new Date(appointmentDate).toISOString(),
                    })
                  }
                  disabled={!appointmentDate || scheduleMutation.isPending}
                  className={ROW_BUTTON_CLASS}
                >
                  Agendar
                </button>
              </div>
            )}
          </div>
        )}

        {/* Zona de peligro — separada del resto por espacio, borde y color; nunca en la
            misma fila que Llamar/WhatsApp/Cerrar/Marcar venta, ni dentro de ninguna
            pestaña (para que no dependa de dónde esté el asesor viendo). Mismo gate y mismo
            diálogo de confirmación de siempre (ver ProspectosSection). */}
        {canDeleteLeads(currentUser) && (
          <div className="mt-4 pt-4 border-t border-red-100 dark:border-red-900/30">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide mb-2">
              <ShieldAlert size={13} /> Zona de peligro
            </p>
            <button
              onClick={onDelete}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <Trash2 size={15} /> Eliminar prospecto
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// En pantallas angostas (mobile/tablet) el detalle no cabe como tercera columna, así que
// se muestra como overlay a pantalla completa (mismo patrón de slide-in que
// StageBottomSheet). De xl en adelante vuelve a ser la columna lateral fija de siempre.
export function DetailPanelSlot({ selected, emptyText, onDeselect, ...panelProps }) {
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
              {/* CRM-001: key atado a selected.id — sin esto React reutiliza la misma
                  instancia si `selected` cambia mientras el overlay sigue montado (ej.
                  dos "Ver prospecto" resolviendo fuera de orden), dejando los inputs con
                  el texto del prospecto anterior y arriesgando que un blur posterior lo
                  guarde sobre el id del prospecto nuevo. Misma protección que ya tenía la
                  rama de escritorio de abajo. */}
              <LeadDetailPanel
                key={selected.id}
                selected={selected}
                onDeselect={onDeselect}
                {...panelProps}
              />
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
