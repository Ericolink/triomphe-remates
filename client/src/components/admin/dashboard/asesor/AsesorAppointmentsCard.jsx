import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, PhoneCall, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../../../utils/animations';
import { toWhatsAppLink } from '../../../../utils/formatters';
import TabBar from '../../../ui/TabBar';

const TABS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'manana', label: 'Mañana' },
  { key: 'proximos7', label: 'Próximos 7 días' },
];

// Citas propias — Hoy/Mañana/Próximos 7 días, mismo criterio de "próximos 7 días incluye
// hoy/mañana" que ya usa CalendarioSection.jsx en su propio indicador.
export default function AsesorAppointmentsCard({ citasHoy, citasManana, citasProximas7Dias }) {
  const [tab, setTab] = useState('hoy');
  const navigate = useNavigate();

  const listByTab = { hoy: citasHoy, manana: citasManana, proximos7: citasProximas7Dias };
  const appointments = listByTab[tab];

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <CalendarClock size={16} className="text-primary-700 dark:text-primary-400" /> Tus citas
        </h2>
        <button
          onClick={() => navigate('/admin/crm?tab=calendario')}
          className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
        >
          Ver calendario
        </button>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {appointments.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Sin citas programadas.</p>
      ) : (
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {appointments.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1f2e]"
            >
              <span className="text-xs font-mono text-primary-600 dark:text-primary-400 flex-shrink-0">
                {new Date(a.scheduledAt).toLocaleString('es-MX', {
                  ...(tab !== 'hoy' && { day: '2-digit', month: 'short' }),
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              <button
                onClick={() => navigate(`/admin/crm?tab=prospectos&leadId=${a.lead?.id}`)}
                className="text-sm text-gray-700 dark:text-gray-200 truncate text-left flex-1 min-w-0 hover:underline"
              >
                {a.lead?.name}
              </button>
              {a.property && (
                <span className="text-xs text-gray-400 truncate hidden sm:inline">
                  {a.property.title}
                </span>
              )}
              <div className="flex items-center gap-1 flex-shrink-0">
                {a.lead?.phone && (
                  <a
                    href={`tel:${a.lead.phone}`}
                    title="Llamar"
                    className="p-1 text-gray-400 hover:text-primary-500"
                  >
                    <PhoneCall size={14} />
                  </a>
                )}
                {a.lead?.phone && (
                  <a
                    href={toWhatsAppLink(a.lead.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp"
                    className="p-1 text-gray-400 hover:text-green-500"
                  >
                    <MessageCircle size={14} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
