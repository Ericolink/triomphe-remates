import { useNavigate } from 'react-router-dom';
import { AlertTriangle, PhoneCall, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../../../utils/animations';
import { toWhatsAppLink } from '../../../../utils/formatters';

// Motivo -> color del punto, de mayor a menor urgencia (mismo orden de prioridad que ya
// decide el backend en getMyCrmDashboard.requierenAtencion).
const REASON_DOT_COLOR = {
  cita_hoy: 'bg-red-500',
  sin_contacto: 'bg-orange-500',
  cita_manana: 'bg-yellow-500',
};

// "Necesitan tu atención" — un lead por fila con su motivo, priorizado por el backend.
// Equivalente para el asesor de "Requiere tu atención hoy" en UrgentSection.jsx (dashboard
// admin), pero acotado a su propia cartera.
export default function AsesorAttentionList({ items }) {
  const navigate = useNavigate();

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]"
    >
      <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-500" /> Necesitan tu atención
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">
          Todo al día — ningún prospecto requiere atención ahora mismo.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.leadId}
              className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-[#1a1f2e]"
            >
              <button
                onClick={() => navigate(`/admin/crm?tab=prospectos&leadId=${item.leadId}`)}
                className="text-left flex-1 min-w-0 flex items-start gap-2"
              >
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${REASON_DOT_COLOR[item.reasonType] || 'bg-gray-400'}`}
                />
                <span className="min-w-0">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 block truncate">
                    {item.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    {item.reason}
                  </span>
                </span>
              </button>
              <div className="flex items-center gap-1 flex-shrink-0">
                {item.phone && (
                  <a
                    href={`tel:${item.phone}`}
                    title="Llamar"
                    className="p-1.5 text-gray-400 hover:text-primary-500"
                  >
                    <PhoneCall size={15} />
                  </a>
                )}
                {item.phone && (
                  <a
                    href={toWhatsAppLink(item.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp"
                    className="p-1.5 text-gray-400 hover:text-green-500"
                  >
                    <MessageCircle size={15} />
                  </a>
                )}
                <button
                  onClick={() => navigate(`/admin/crm?tab=prospectos&leadId=${item.leadId}`)}
                  className="text-xs font-medium px-2.5 py-1.5 bg-accent-400 text-primary-900 rounded-lg hover:bg-accent-300 transition-colors"
                >
                  Ver
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
