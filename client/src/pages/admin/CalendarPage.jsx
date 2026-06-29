import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Calendar, MapPin, User, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getLeads } from '../../services/leadService';
import Spinner from '../../components/ui/Spinner';
import { fadeIn, fadeInUp } from '../../utils/animations';
import { LEAD_TYPE_LABELS as typeLabel } from '../../utils/constants';

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export default function CalendarPage() {
  const today = new Date();
  const [current, setCurrent] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leads-calendar'],
    queryFn: () => getLeads({ limit: 500 }),
  });

  const leads = (data?.data ?? []).filter((l) => l.appointmentDate);

  const prevMonth = () => setCurrent(({ year, month }) =>
    month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  const nextMonth = () => setCurrent(({ year, month }) =>
    month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });

  const firstDay = new Date(current.year, current.month, 1).getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) =>
    i < firstDay ? null : i - firstDay + 1
  );

  const leadsOnDay = (day) => {
    if (!day) return [];
    const d = new Date(current.year, current.month, day);
    return leads.filter((l) => isSameDay(new Date(l.appointmentDate), d));
  };

  const selectedLeads = selected ? leadsOnDay(selected) : [];
  const todayLeads    = leads.filter((l) => isSameDay(new Date(l.appointmentDate), today));

  if (isLoading) return <Spinner size="lg" className="py-20" />;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible" className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Calendario de citas</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {leads.length} cita{leads.length !== 1 ? 's' : ''} programada{leads.length !== 1 ? 's' : ''}
          {todayLeads.length > 0 && (
            <span className="ml-2 text-yellow-600 dark:text-yellow-400 font-medium">
              · {todayLeads.length} hoy
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario */}
        <div className="lg:col-span-2 bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          {/* Navegación */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2e3650] transition-colors">
              <ChevronLeft size={18} className="text-gray-600 dark:text-gray-300" />
            </button>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
              {MONTH_NAMES[current.month]} {current.year}
            </h2>
            <button onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-[#2e3650] transition-colors">
              <ChevronRight size={18} className="text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          {/* Cabecera días */}
          <div className="grid grid-cols-7 mb-2">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-gray-500 py-1">{d}</div>
            ))}
          </div>

          {/* Celdas */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              const dayLeads = leadsOnDay(day);
              const isToday  = day && isSameDay(new Date(current.year, current.month, day), today);
              const isSel    = day && selected === day;
              return (
                <button key={i} onClick={() => day && setSelected(isSel ? null : day)}
                  disabled={!day}
                  className={`
                    relative min-h-[52px] rounded-xl p-1 text-xs transition-colors text-left
                    ${!day ? '' : 'hover:bg-gray-50 dark:hover:bg-[#2e3650] cursor-pointer'}
                    ${isToday  ? 'ring-2 ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : ''}
                    ${isSel    ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500' : ''}
                  `}>
                  {day && (
                    <>
                      <span className={`font-medium ${isToday ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {day}
                      </span>
                      {dayLeads.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-0.5">
                          {dayLeads.slice(0, 3).map((l) => (
                            <span key={l.id}
                              className="block w-full truncate text-[10px] bg-blue-600 text-white px-1 py-0.5 rounded">
                              {l.name.split(' ')[0]}
                            </span>
                          ))}
                          {dayLeads.length > 3 && (
                            <span className="text-[10px] text-gray-400">+{dayLeads.length - 3}</span>
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
              <motion.div key={selected} variants={fadeInUp} initial="hidden" animate="visible" exit={{ opacity: 0 }}
                className="bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650]">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <Calendar size={15} className="text-blue-600" />
                  {selected} de {MONTH_NAMES[current.month]}
                </h3>
                {selectedLeads.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 italic">Sin citas este día.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedLeads.map((l) => (
                      <div key={l.id} className="bg-gray-50 dark:bg-[#1a1f2e] rounded-xl p-3">
                        <p className="font-medium text-sm text-gray-800 dark:text-gray-100 flex items-center gap-1.5">
                          <User size={12} className="text-gray-400" /> {l.name}
                        </p>
                        {l.phone && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1.5">
                            <Phone size={11} /> {l.phone}
                          </p>
                        )}
                        {l.property && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1.5 truncate">
                            <MapPin size={11} /> {l.property.title}
                          </p>
                        )}
                        <span className="inline-block mt-1.5 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-medium">
                          {typeLabel[l.type] || l.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="empty" variants={fadeInUp} initial="hidden" animate="visible"
                className="bg-gray-50 dark:bg-[#242938] rounded-2xl p-5 border border-dashed border-gray-200 dark:border-[#2e3650]">
                <p className="text-sm text-gray-400 dark:text-gray-500 text-center">Selecciona un día para ver las citas.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Próximas citas */}
          {leads.length > 0 && (
            <div className="bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650]">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3 text-sm">Próximas citas</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {leads
                  .filter((l) => new Date(l.appointmentDate) >= today)
                  .sort((a, b) => new Date(a.appointmentDate) - new Date(b.appointmentDate))
                  .slice(0, 8)
                  .map((l) => (
                    <div key={l.id} className="flex items-start gap-2 text-xs">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">
                        {new Date(l.appointmentDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300 truncate">{l.name}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
