import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Calendar, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getAppointments,
  updateAppointmentStatus,
  rescheduleAppointment,
} from '../../../services/appointmentService';
import Spinner from '../../ui/Spinner';
import Badge from '../../ui/Badge';
import OverflowMenu from '../../ui/OverflowMenu';
import { fadeIn, fadeInUp } from '../../../utils/animations';
import { APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_VARIANTS } from '../../../utils/constants';

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

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// Fila de cita compartida entre "día seleccionado" y "próximas citas" para que ambas
// secciones se lean con el mismo estilo. CRM Comercial: ahora lee de la entidad
// Appointment (no de Lead.appointmentDate) e incluye acciones rápidas de estatus.
function AppointmentRow({ appointment, showDate, onStatusChange, onReschedule }) {
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState('');

  return (
    <div className="bg-gray-50 dark:bg-[#1a1f2e] rounded-xl p-3">
      <div className="flex items-start gap-2">
        {showDate && (
          <span className="mt-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded text-xs font-mono whitespace-nowrap flex-shrink-0">
            {new Date(appointment.scheduledAt).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'short',
            })}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-800 dark:text-gray-100 flex items-center gap-1.5 truncate">
            <User size={12} className="text-gray-400 flex-shrink-0" /> {appointment.lead?.name}
          </p>
          {(appointment.lead?.phone || appointment.property) && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
              {[appointment.lead?.phone, appointment.property?.title].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <Badge variant={APPOINTMENT_STATUS_VARIANTS[appointment.status]}>
          {APPOINTMENT_STATUS_LABELS[appointment.status]}
        </Badge>
        <OverflowMenu
          items={[
            appointment.status !== 'confirmada' && {
              label: 'Confirmar',
              onClick: () => onStatusChange(appointment.id, 'confirmada'),
            },
            appointment.status !== 'completada' && {
              label: 'Marcar completada',
              onClick: () => onStatusChange(appointment.id, 'completada'),
            },
            appointment.status !== 'no_show' && {
              label: 'No asistió',
              onClick: () => onStatusChange(appointment.id, 'no_show'),
            },
            { label: 'Reagendar', onClick: () => setRescheduling((v) => !v) },
            appointment.status !== 'cancelada' && {
              label: 'Cancelar',
              danger: true,
              onClick: () => onStatusChange(appointment.id, 'cancelada'),
            },
          ].filter(Boolean)}
        />
      </div>
      {rescheduling && (
        <div className="flex gap-2 mt-2 pl-1">
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="flex-1 px-2 py-1.5 border border-gray-200 dark:border-[#2e3650] rounded-lg text-xs bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
          />
          <button
            onClick={() => {
              if (newDate) {
                onReschedule(appointment.id, newDate);
                setRescheduling(false);
                setNewDate('');
              }
            }}
            disabled={!newDate}
            className="px-2.5 py-1.5 bg-accent-400 text-primary-900 rounded-lg text-xs font-medium hover:bg-accent-300 disabled:opacity-40 transition-colors flex-shrink-0"
          >
            Confirmar
          </button>
        </div>
      )}
    </div>
  );
}

export default function CalendarioSection() {
  const queryClient = useQueryClient();
  const today = new Date();
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(null);

  const monthStart = new Date(current.year, current.month, 1);
  const monthEnd = new Date(current.year, current.month + 1, 0, 23, 59, 59);

  const { data, isLoading } = useQuery({
    queryKey: ['appointments-month', current.year, current.month],
    queryFn: () =>
      getAppointments({ from: monthStart.toISOString(), to: monthEnd.toISOString(), limit: 500 }),
  });
  const appointments = data?.data ?? [];

  const { data: upcomingData } = useQuery({
    queryKey: ['appointments-upcoming'],
    queryFn: () => getAppointments({ from: today.toISOString(), limit: 8 }),
  });
  const upcoming = upcomingData?.data ?? [];

  const invalidateAll = () => {
    queryClient.invalidateQueries(['appointments-month']);
    queryClient.invalidateQueries(['appointments-upcoming']);
  };

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateAppointmentStatus(id, { status }),
    onSuccess: () => {
      toast.success('Cita actualizada');
      invalidateAll();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al actualizar la cita'),
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, scheduledAt }) => rescheduleAppointment(id, { scheduledAt }),
    onSuccess: () => {
      toast.success('Cita reagendada');
      invalidateAll();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al reagendar'),
  });

  const prevMonth = () =>
    setCurrent(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 }
    );
  const nextMonth = () =>
    setCurrent(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }
    );

  const firstDay = new Date(current.year, current.month, 1).getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  const appointmentsOnDay = (day) => {
    if (!day) return [];
    const d = new Date(current.year, current.month, day);
    return appointments.filter((a) => isSameDay(new Date(a.scheduledAt), d));
  };

  const selectedAppointments = selected ? appointmentsOnDay(selected) : [];

  if (isLoading) return <Spinner size="lg" className="py-20" />;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible" className="max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {appointments.length} cita{appointments.length !== 1 ? 's' : ''} este mes
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario */}
        <div className="lg:col-span-2 bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          {/* Navegación */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2e3650] transition-colors"
            >
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-300" />
            </button>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {MONTH_NAMES[current.month]} {current.year}
            </h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2e3650] transition-colors"
            >
              <ChevronRight size={18} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Cabecera días */}
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

          {/* Celdas */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              const dayAppointments = appointmentsOnDay(day);
              const isToday = day && isSameDay(new Date(current.year, current.month, day), today);
              const isSel = day && selected === day;
              return (
                <button
                  key={i}
                  onClick={() => day && setSelected(isSel ? null : day)}
                  disabled={!day}
                  className={`
                    relative min-h-[60px] rounded-xl p-1 text-xs transition-colors text-left
                    ${!day ? '' : 'hover:bg-gray-50 dark:hover:bg-[#2e3650] cursor-pointer'}
                    ${isToday ? 'ring-2 ring-accent-400 bg-accent-50 dark:bg-accent-900/20' : ''}
                    ${isSel ? 'bg-accent-50 dark:bg-accent-900/30 ring-2 ring-accent-500' : ''}
                  `}
                >
                  {day && (
                    <>
                      <span className="font-medium text-gray-700 dark:text-gray-300">{day}</span>
                      {dayAppointments.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-0.5">
                          {dayAppointments.slice(0, 3).map((a) => (
                            <span
                              key={a.id}
                              className="block w-full truncate text-[12px] bg-primary-600 text-white px-1 py-0.5 rounded"
                            >
                              {a.lead?.name?.split(' ')[0]}
                            </span>
                          ))}
                          {dayAppointments.length > 3 && (
                            <span className="text-[12px] text-gray-400">
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
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          {/* Citas del día seleccionado */}
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0 }}
                className="bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650]"
              >
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Calendar size={15} className="text-primary-600" />
                  {selected} de {MONTH_NAMES[current.month]}
                </h3>
                {selectedAppointments.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                    Sin citas este día.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedAppointments.map((a) => (
                      <AppointmentRow
                        key={a.id}
                        appointment={a}
                        onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                        onReschedule={(id, scheduledAt) =>
                          rescheduleMutation.mutate({ id, scheduledAt })
                        }
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

          {/* Próximas citas */}
          {upcoming.length > 0 && (
            <div className="bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650]">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 text-sm">
                Próximas citas
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {upcoming.map((a) => (
                  <AppointmentRow
                    key={a.id}
                    appointment={a}
                    showDate
                    onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
                    onReschedule={(id, scheduledAt) =>
                      rescheduleMutation.mutate({ id, scheduledAt })
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
