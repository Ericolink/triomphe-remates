import { useMemo, useState } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  LayoutList,
  Search,
  User,
  Plus,
  CalendarPlus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
  deleteAppointment,
} from '../../../services/appointmentService';
import { getLeadById } from '../../../services/leadService';
import { getUsers } from '../../../services/usersService';
import useAuthStore from '../../../store/authStore';
import { crmAccessLevel } from '../../../utils/permissions';
import Spinner from '../../ui/Spinner';
import Badge from '../../ui/Badge';
import AppointmentDetailModal from './AppointmentDetailModal';
import AgendarCitaModal from './AgendarCitaModal';
import LeadDetailWithActions from './LeadDetailWithActions';
import { fadeIn, fadeInUp, staggerContainer } from '../../../utils/animations';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_VARIANTS } from '../../../utils/constants';

const AGENDA_PAGE_SIZE = 20;

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

// Mismos 5 colores que Badge (default/success/warning/danger/primary), en versión sólida
// para que se distingan como bloques pequeños dentro de una celda del mes en vez del fondo
// suave que usa Badge — mismo mapeo de color por estado (APPOINTMENT_STATUS_VARIANTS), no un
// sistema nuevo.
const CHIP_VARIANT_CLASSES = {
  primary: 'bg-accent-500 text-primary-900',
  success: 'bg-green-600 text-white',
  warning: 'bg-yellow-500 text-primary-900',
  danger: 'bg-red-500 text-white',
  default: 'bg-gray-400 text-white',
};

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
// Semana Dom-Sáb, mismo orden que DAY_NAMES/la cuadrícula del mes.
function startOfWeek(d) {
  return addDays(startOfDay(d), -d.getDay());
}

const DATE_RANGE_PRESETS = {
  today: (today) => [startOfDay(today), endOfDay(today)],
  tomorrow: (today) => [startOfDay(addDays(today, 1)), endOfDay(addDays(today, 1))],
  week: (today) => [startOfWeek(today), endOfDay(addDays(startOfWeek(today), 6))],
  nextWeek: (today) => [
    addDays(startOfWeek(today), 7),
    endOfDay(addDays(startOfWeek(today), 13)),
  ],
};
const DATE_RANGE_LABELS = {
  today: 'Hoy',
  tomorrow: 'Mañana',
  week: 'Esta semana',
  nextWeek: 'Próxima semana',
  custom: 'Rango personalizado',
};

// Tiempo (hora local) + nombre — usado tanto en la lista del día seleccionado (vista Mes)
// como en cada fila de la vista Agenda, para no duplicar el mismo marcado dos veces.
function AppointmentListItem({ appointment, showDate, onClick }) {
  const lead = appointment.lead;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left bg-gray-50 dark:bg-[#1a1f2e] hover:bg-gray-100 dark:hover:bg-[#232a3d] rounded-xl p-3 transition-colors"
    >
      <div className="flex items-start gap-2">
        <span className="mt-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded text-xs font-mono whitespace-nowrap flex-shrink-0">
          {showDate
            ? new Date(appointment.scheduledAt).toLocaleDateString('es-MX', {
                day: '2-digit',
                month: 'short',
              })
            : new Date(appointment.scheduledAt).toLocaleTimeString('es-MX', {
                hour: '2-digit',
                minute: '2-digit',
              })}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-800 dark:text-gray-100 flex items-center gap-1.5 truncate">
            <User size={12} className="text-gray-400 flex-shrink-0" /> {lead?.name || 'Sin nombre'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
            {lead?.assignedUser?.name ? `Atiende: ${lead.assignedUser.name}` : 'Sin asesor asignado'}
            {appointment.createdByUser?.name && ` · Agendó: ${appointment.createdByUser.name}`}
          </p>
        </div>
        <Badge variant={APPOINTMENT_STATUS_VARIANTS[appointment.status]}>
          {APPOINTMENT_STATUS_LABELS[appointment.status]}
        </Badge>
      </div>
    </button>
  );
}

function IndicatorCard({ label, value, accent }) {
  return (
    <div className="bg-white dark:bg-[#242938] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#2e3650]">
      <p className={`text-2xl font-bold ${accent || 'text-gray-800 dark:text-gray-100'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function CalendarioSection() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const level = crmAccessLevel(currentUser);
  // Los filtros de Asesor/Agendó solo tienen sentido para quien ve todas las citas — un
  // Asesor de Ventas ya solo recibe las suyas (getLeadVisibilityWhere en el backend), así
  // que filtrar por sí mismo no aporta nada.
  const canFilterByUser = level === 'admin' || level === 'asistente_administrativo';

  const today = new Date();
  const [view, setView] = useState('month');
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState(null);
  const [openAppointment, setOpenAppointment] = useState(null);
  // Prospecto abierto desde "Ver prospecto" de una cita — misma tarjeta reutilizada de
  // Prospectos (ver LeadDetailWithActions), para revisar toda la información sin salir del
  // calendario ni cambiar de pestaña.
  const [selectedLead, setSelectedLead] = useState(null);
  const [dateRangeMode, setDateRangeMode] = useState('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  // scheduleModal: null (cerrado) | { initialDate: Date|null } — abierto desde el botón
  // "Nueva cita" (sin fecha) o desde "+ Agendar cita este día" (con el día ya elegido).
  const [scheduleModal, setScheduleModal] = useState(null);
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    status: '',
    assignedToUserId: '',
    createdByUserId: '',
    search: '',
  });
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const { data: usersData } = useQuery({
    queryKey: ['users-all'],
    queryFn: getUsers,
    enabled: canFilterByUser,
  });
  const users = usersData?.data ?? [];

  // "Ver prospecto" desde una cita — trae el registro completo del lead (el que viene con
  // la cita está recortado a lo que necesita ese modal) y abre la misma tarjeta de detalle
  // que usa Prospectos, sin salir de esta pestaña.
  const handleViewLead = (leadId) => {
    getLeadById(leadId)
      .then((res) => setSelectedLead(res.data))
      .catch(() => toast.error('No se pudo abrir el prospecto'));
  };

  // Indicadores — siempre "hoy real" y "próximos 7 días reales", sin importar el mes que
  // se esté navegando ni los filtros activos (dan una foto general, no una del filtro).
  const { data: todayData } = useQuery({
    queryKey: ['appointments-today'],
    queryFn: () =>
      getAppointments({ from: startOfDay(today).toISOString(), to: endOfDay(today).toISOString(), limit: 200 }),
  });
  const todayAppointments = todayData?.data ?? [];

  const next7From = startOfDay(today);
  const next7To = endOfDay(addDays(today, 7));
  const { data: next7Data } = useQuery({
    queryKey: ['appointments-next7'],
    queryFn: () =>
      getAppointments({ from: next7From.toISOString(), to: next7To.toISOString(), limit: 200 }),
  });
  const next7Appointments = next7Data?.data ?? [];
  const pendingNext7 = next7Appointments.filter((a) =>
    ['programada', 'confirmada'].includes(a.status)
  ).length;
  const canceledNext7 = next7Appointments.filter((a) => a.status === 'cancelada').length;

  // Vista Mes
  const monthStart = new Date(current.year, current.month, 1);
  const monthEnd = new Date(current.year, current.month + 1, 0, 23, 59, 59);
  const monthQueryParams = {
    from: monthStart.toISOString(),
    to: monthEnd.toISOString(),
    limit: 500,
    status: filters.status || undefined,
    assignedToUserId: filters.assignedToUserId || undefined,
    createdByUserId: filters.createdByUserId || undefined,
    search: filters.search || undefined,
  };
  const { data: monthData, isLoading: monthLoading } = useQuery({
    queryKey: ['appointments-month', current.year, current.month, filters],
    queryFn: () => getAppointments(monthQueryParams),
    enabled: view === 'month',
  });
  const monthAppointments = monthData?.data ?? [];
  const monthTotal = monthData?.pagination?.total ?? monthAppointments.length;
  const monthTruncated = Boolean(monthData?.pagination?.hasNext);

  const appointmentsOnDay = (day) => {
    if (!day) return [];
    const d = new Date(current.year, current.month, day);
    return monthAppointments.filter((a) => isSameDay(new Date(a.scheduledAt), d));
  };
  const selectedAppointments = selectedDay ? appointmentsOnDay(selectedDay) : [];

  // "Ver cita" desde LeadDetailPanel (?tab=calendario&date=...&appointmentId=...) — ajuste de
  // estado durante el render (no un useEffect, ver mismo criterio en AgendarCitaModal.jsx),
  // reactivo a los valores de la URL porque el detalle de un prospecto también se abre
  // DENTRO de este mismo Calendario (LeadDetailWithActions más abajo): un segundo "Ver cita"
  // sin cambiar de pestaña no vuelve a montar este componente, así que no basta con "solo al
  // montar" como el patrón ?leadId= de ProspectosSection.
  const dateParam = searchParams.get('date');
  const appointmentIdParam = searchParams.get('appointmentId');
  const [positionedForDate, setPositionedForDate] = useState(null);
  if (dateParam && dateParam !== positionedForDate) {
    setPositionedForDate(dateParam);
    const d = new Date(dateParam);
    if (!Number.isNaN(d.getTime())) {
      setCurrent({ year: d.getFullYear(), month: d.getMonth() });
      setSelectedDay(d.getDate());
      setView('month');
    }
  }

  // `autoOpenedApptId` recuerda qué cita ya se auto-abrió — sin esto, cada refetch de
  // monthAppointments (invalidateAll tras cambiar estado/reagendar) reabriría el modal aunque
  // el usuario ya lo hubiera cerrado. Antes de que la query del mes resuelva, `found` es
  // undefined y este bloque simplemente no hace nada — se vuelve a evaluar solo en el
  // siguiente render que sí traiga `monthAppointments` actualizado.
  const [autoOpenedApptId, setAutoOpenedApptId] = useState(null);
  if (appointmentIdParam && appointmentIdParam !== autoOpenedApptId) {
    const found = monthAppointments.find((a) => String(a.id) === appointmentIdParam);
    if (found) {
      setAutoOpenedApptId(appointmentIdParam);
      setOpenAppointment(found);
    }
  }

  // Vista Agenda
  const [agendaFrom, agendaTo] =
    dateRangeMode === 'custom'
      ? [
          customFrom ? startOfDay(new Date(`${customFrom}T00:00`)) : null,
          customTo ? endOfDay(new Date(`${customTo}T00:00`)) : null,
        ]
      : DATE_RANGE_PRESETS[dateRangeMode](today);
  const agendaQueryParams = {
    from: agendaFrom ? agendaFrom.toISOString() : undefined,
    to: agendaTo ? agendaTo.toISOString() : undefined,
    limit: AGENDA_PAGE_SIZE,
    status: filters.status || undefined,
    assignedToUserId: filters.assignedToUserId || undefined,
    createdByUserId: filters.createdByUserId || undefined,
    search: filters.search || undefined,
  };
  // En "Rango personalizado" sin ambas fechas todavía, `agendaFrom`/`agendaTo` quedan null —
  // la consulta se deshabilita en vez de pedir el historial completo sin límite de fecha.
  const customRangeIncomplete = dateRangeMode === 'custom' && (!agendaFrom || !agendaTo);
  const {
    data: agendaData,
    isLoading: agendaLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['appointments-agenda', dateRangeMode, customFrom, customTo, filters],
    queryFn: ({ pageParam = 1 }) => getAppointments({ ...agendaQueryParams, page: pageParam }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasNext ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
    enabled: view === 'agenda' && !customRangeIncomplete,
  });
  const agendaAppointments = useMemo(
    () => agendaData?.pages.flatMap((p) => p.data) ?? [],
    [agendaData]
  );
  const agendaTotal = agendaData?.pages?.[0]?.pagination?.total ?? 0;

  const invalidateAll = () => {
    queryClient.invalidateQueries(['appointments-month']);
    queryClient.invalidateQueries(['appointments-agenda']);
    queryClient.invalidateQueries(['appointments-today']);
    queryClient.invalidateQueries(['appointments-next7']);
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateAppointmentStatus(id, { status }),
    onSuccess: (res) => {
      toast.success('Cita actualizada');
      setOpenAppointment((prev) => (prev ? { ...prev, status: res.data.status } : prev));
      invalidateAll();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al actualizar la cita'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, scheduledAt }) => rescheduleAppointment(id, { scheduledAt }),
    onSuccess: () => {
      toast.success('Cita reagendada');
      setOpenAppointment(null);
      invalidateAll();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al reagendar'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => deleteAppointment(id),
    onSuccess: () => {
      toast.success('Cita eliminada');
      setOpenAppointment(null);
      invalidateAll();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al eliminar la cita'),
  });

  const isPending =
    statusMutation.isPending || rescheduleMutation.isPending || deleteMutation.isPending;

  const prevMonth = () =>
    setCurrent(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  const nextMonth = () =>
    setCurrent(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );
  const goToday = () => {
    setCurrent({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDay(today.getDate());
  };

  const firstDay = new Date(current.year, current.month, 1).getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  const selectClass =
    'px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none';

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      {/* Indicadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <IndicatorCard label="Citas de hoy" value={todayAppointments.length} />
        <IndicatorCard label="Próximos 7 días" value={next7Appointments.length} />
        <IndicatorCard
          label="Pendientes (7 días)"
          value={pendingNext7}
          accent="text-accent-600 dark:text-accent-400"
        />
        <IndicatorCard
          label="Canceladas (7 días)"
          value={canceledNext7}
          accent="text-red-500 dark:text-red-400"
        />
      </div>

      {/* Barra de vista + filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex border border-gray-200 dark:border-[#2e3650] rounded-xl overflow-hidden">
          <button
            onClick={() => setView('month')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'month' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-[#242938] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650]'}`}
          >
            <CalendarDays size={15} /> Mes
          </button>
          <button
            onClick={() => setView('agenda')}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'agenda' ? 'bg-primary-600 text-white' : 'bg-white dark:bg-[#242938] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650]'}`}
          >
            <LayoutList size={15} /> Agenda
          </button>
        </div>

        <button
          onClick={() => setScheduleModal({ initialDate: null })}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium bg-accent-400 text-primary-900 hover:bg-accent-300 transition-colors"
        >
          <Plus size={15} /> Nueva cita
        </button>

        <select
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          className={selectClass}
        >
          <option value="">Todos los estados</option>
          {Object.entries(APPOINTMENT_STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        {canFilterByUser && (
          <>
            <select
              value={filters.assignedToUserId}
              onChange={(e) => setFilter('assignedToUserId', e.target.value)}
              className={selectClass}
            >
              <option value="">Todos los asesores (atiende)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <select
              value={filters.createdByUserId}
              onChange={(e) => setFilter('createdByUserId', e.target.value)}
              className={selectClass}
            >
              <option value="">Todos (agendó)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="flex items-center gap-2 bg-white dark:bg-[#242938] border border-gray-200 dark:border-[#2e3650] rounded-xl px-3 py-2">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Buscar prospecto, teléfono, asesor..."
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-44 text-sm focus:outline-none bg-transparent dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>
      </div>

      {view === 'month' ? (
        <>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
            {monthTotal} cita{monthTotal !== 1 ? 's' : ''} este mes
            {monthTruncated && ' · no se muestran todas las citas de este rango'}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendario */}
            <div className="lg:col-span-2 bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
              <div className="flex items-center justify-between mb-5">
                <button
                  onClick={prevMonth}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2e3650] transition-colors"
                >
                  <ChevronLeft size={18} className="text-gray-600 dark:text-gray-300" />
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                    {MONTH_NAMES[current.month]} {current.year}
                  </h2>
                  <button
                    onClick={goToday}
                    className="text-xs font-medium px-2 py-1 rounded-lg border border-gray-200 dark:border-[#2e3650] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
                  >
                    Hoy
                  </button>
                </div>
                <button
                  onClick={nextMonth}
                  className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2e3650] transition-colors"
                >
                  <ChevronRight size={18} className="text-gray-600 dark:text-gray-300" />
                </button>
              </div>

              <div className="grid grid-cols-7 mb-2">
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-1"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {monthLoading ? (
                <Spinner size="lg" className="py-16" />
              ) : (
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((day, i) => {
                    const dayAppointments = appointmentsOnDay(day);
                    const isToday = day && isSameDay(new Date(current.year, current.month, day), today);
                    const isSel = day && selectedDay === day;
                    return (
                      <button
                        key={i}
                        onClick={() => day && setSelectedDay(isSel ? null : day)}
                        disabled={!day}
                        className={`
                          relative min-h-[68px] rounded-xl p-1 text-xs transition-colors text-left
                          ${!day ? '' : 'hover:bg-gray-50 dark:hover:bg-[#2e3650] cursor-pointer'}
                          ${isToday ? 'ring-2 ring-accent-400 bg-accent-50 dark:bg-accent-900/20' : ''}
                          ${isSel ? 'bg-accent-50 dark:bg-accent-900/30 ring-2 ring-accent-500' : ''}
                        `}
                      >
                        {day && (
                          <>
                            <span className="font-medium text-gray-700 dark:text-gray-300">{day}</span>
                            {dayAppointments.length > 0 && (
                              <div className="mt-0.5 flex flex-col gap-0.5">
                                {dayAppointments.slice(0, 3).map((a) => (
                                  <span
                                    key={a.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOpenAppointment(a);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.stopPropagation();
                                        setOpenAppointment(a);
                                      }
                                    }}
                                    className={`block w-full truncate text-[11px] px-1 py-0.5 rounded cursor-pointer hover:opacity-80 ${CHIP_VARIANT_CLASSES[APPOINTMENT_STATUS_VARIANTS[a.status]]}`}
                                  >
                                    {new Date(a.scheduledAt).toLocaleTimeString('es-MX', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}{' '}
                                    {a.lead?.name?.split(' ')[0]}
                                  </span>
                                ))}
                                {dayAppointments.length > 3 && (
                                  <span className="text-[11px] text-gray-400">
                                    +{dayAppointments.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Día seleccionado */}
            <div>
              <AnimatePresence mode="wait">
                {selectedDay ? (
                  <motion.div
                    key={selectedDay}
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0 }}
                    className="bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650]"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                        <CalendarDays size={15} className="text-primary-600" />
                        {selectedDay} de {MONTH_NAMES[current.month]}
                      </h3>
                      <button
                        onClick={() =>
                          setScheduleModal({
                            initialDate: new Date(current.year, current.month, selectedDay),
                          })
                        }
                        className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0"
                      >
                        <CalendarPlus size={13} /> Agendar cita este día
                      </button>
                    </div>
                    {selectedAppointments.length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                        Sin citas este día.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {selectedAppointments.map((a) => (
                          <AppointmentListItem
                            key={a.id}
                            appointment={a}
                            onClick={() => setOpenAppointment(a)}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    className="bg-gray-50 dark:bg-[#242938] rounded-2xl p-5 border border-dashed border-gray-200 dark:border-[#2e3650]"
                  >
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center">
                      Selecciona un día para ver las citas.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </>
      ) : (
        <div>
          {/* Rango rápido de la Agenda */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {Object.entries(DATE_RANGE_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setDateRangeMode(key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateRangeMode === key ? 'bg-primary-600 text-white' : 'bg-white dark:bg-[#242938] border border-gray-200 dark:border-[#2e3650] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650]'}`}
              >
                {label}
              </button>
            ))}
            {dateRangeMode === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 dark:border-[#2e3650] rounded-lg text-xs bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
                />
                <span className="text-xs text-gray-400">a</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-2 py-1.5 border border-gray-200 dark:border-[#2e3650] rounded-lg text-xs bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
                />
              </div>
            )}
          </div>

          {!customRangeIncomplete && (
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
              {agendaTotal} cita{agendaTotal !== 1 ? 's' : ''} en este rango
            </p>
          )}

          {customRangeIncomplete ? (
            <div className="bg-gray-50 dark:bg-[#242938] rounded-2xl p-8 border border-dashed border-gray-200 dark:border-[#2e3650] text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Elige fecha de inicio y de fin para ver las citas de ese rango.
              </p>
            </div>
          ) : agendaLoading ? (
            <Spinner size="lg" className="py-16" />
          ) : agendaAppointments.length === 0 ? (
            <div className="bg-gray-50 dark:bg-[#242938] rounded-2xl p-8 border border-dashed border-gray-200 dark:border-[#2e3650] text-center">
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No hay citas que coincidan con este rango y estos filtros.
              </p>
            </div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2 max-w-3xl">
              {agendaAppointments.map((a) => (
                <AppointmentListItem
                  key={a.id}
                  appointment={a}
                  showDate
                  onClick={() => setOpenAppointment(a)}
                />
              ))}
            </motion.div>
          )}

          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="px-4 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-white dark:bg-[#242938] hover:bg-gray-50 dark:hover:bg-[#2e3650] disabled:opacity-50 transition-colors"
              >
                {isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
              </button>
            </div>
          )}
        </div>
      )}

      <AppointmentDetailModal
        appointment={openAppointment}
        open={Boolean(openAppointment)}
        onClose={() => setOpenAppointment(null)}
        currentUser={currentUser}
        isPending={isPending}
        onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
        onReschedule={(id, scheduledAt) => rescheduleMutation.mutate({ id, scheduledAt })}
        onDelete={(id) => deleteMutation.mutate(id)}
        onViewLead={handleViewLead}
      />

      <LeadDetailWithActions selected={selectedLead} setSelected={setSelectedLead} users={users} />

      <AgendarCitaModal
        open={Boolean(scheduleModal)}
        initialDate={scheduleModal?.initialDate}
        onClose={() => setScheduleModal(null)}
        onScheduled={invalidateAll}
      />
    </motion.div>
  );
}
