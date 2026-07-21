import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarClock, PhoneCall, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../../utils/animations';
import { formatDateTime, toWhatsAppLink } from '../../../utils/formatters';
import { TASK_TYPE_LABELS } from '../../../utils/constants';

// Nivel 1 — lo urgente: seguimientos vencidos, prospectos sin atender, mensajes nuevos y
// citas del día. Es lo único que el usuario debe leer para saber "qué debo atender hoy".
export default function UrgentSection({
  overdueTasks,
  overdueTotal,
  onCompleteTask,
  prospectosNuevos,
  prospectosPendientes,
  newFeedbackCount,
  citasHoy,
}) {
  const navigate = useNavigate();

  const attentionItems = [
    ...(prospectosNuevos > 0
      ? [
          {
            key: 'nuevos',
            text: `${prospectosNuevos} prospecto${prospectosNuevos !== 1 ? 's' : ''} nuevo${prospectosNuevos !== 1 ? 's' : ''} sin contactar`,
            onClick: () => navigate('/admin/crm?tab=prospectos&stage=nuevo'),
          },
        ]
      : []),
    ...(prospectosPendientes > 0
      ? [
          {
            key: 'pendientes',
            text: `${prospectosPendientes} prospecto${prospectosPendientes !== 1 ? 's' : ''} pendiente${prospectosPendientes !== 1 ? 's' : ''} de responder`,
            onClick: () => navigate('/admin/crm?tab=prospectos&stage=contactado'),
          },
        ]
      : []),
    ...(newFeedbackCount > 0
      ? [
          {
            key: 'feedback',
            text: `${newFeedbackCount} mensaje${newFeedbackCount !== 1 ? 's' : ''} nuevo${newFeedbackCount !== 1 ? 's' : ''} en el buzón`,
            onClick: () => navigate('/admin/buzon'),
          },
        ]
      : []),
  ];

  const nothingUrgent = overdueTasks.length === 0 && attentionItems.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]"
      >
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" /> Requiere tu atención hoy
        </h2>
        {nothingUrgent ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Todo al día — no hay pendientes.
          </p>
        ) : (
          <div className="space-y-2">
            {overdueTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10"
              >
                <button
                  onClick={() => navigate('/admin/crm?tab=prospectos')}
                  className="text-left flex-1 min-w-0"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {task.lead?.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    {TASK_TYPE_LABELS[task.type] || task.type} — venció{' '}
                    {formatDateTime(task.dueDate)}
                  </span>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {task.lead?.phone && (
                    <a
                      href={`tel:${task.lead.phone}`}
                      title="Llamar"
                      className="p-1.5 text-gray-400 hover:text-blue-500"
                    >
                      <PhoneCall size={15} />
                    </a>
                  )}
                  {task.lead?.phone && (
                    <a
                      href={toWhatsAppLink(task.lead.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="WhatsApp"
                      className="p-1.5 text-gray-400 hover:text-green-500"
                    >
                      <MessageCircle size={15} />
                    </a>
                  )}
                  <button
                    onClick={() => onCompleteTask(task.id)}
                    className="text-xs font-medium px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Completar
                  </button>
                </div>
              </div>
            ))}
            {overdueTotal > overdueTasks.length && (
              <button
                onClick={() => navigate('/admin/crm?tab=prospectos')}
                className="w-full text-center text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 py-1"
              >
                Mostrando {overdueTasks.length} de {overdueTotal} vencidas — ver todas
              </button>
            )}
            {attentionItems.map(({ key, text, onClick }) => (
              <button
                key={key}
                onClick={onClick}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 hover:bg-yellow-100 dark:hover:bg-yellow-900/20 transition-colors text-left"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{text}</span>
              </button>
            ))}
          </div>
        )}
      </motion.div>

      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <CalendarClock size={16} className="text-blue-700 dark:text-blue-400" /> Citas de hoy
          </h2>
          <button
            onClick={() => navigate('/admin/crm?tab=calendario')}
            className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Ver calendario
          </button>
        </div>
        {citasHoy.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Sin citas programadas para hoy.
          </p>
        ) : (
          <div className="space-y-2">
            {citasHoy.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1f2e]"
              >
                <span className="text-xs font-mono text-blue-600 dark:text-blue-400 flex-shrink-0">
                  {new Date(a.scheduledAt).toLocaleTimeString('es-MX', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-200 truncate">
                  {a.lead?.name}
                </span>
                {a.property && (
                  <span className="text-xs text-gray-400 truncate">{a.property.title}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
