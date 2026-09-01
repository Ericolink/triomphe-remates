import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Phone, Mail, Home, RotateCcw, Trash2, ExternalLink } from 'lucide-react';
import Badge from '../../ui/Badge';
import ConfirmDialog from '../../ui/ConfirmDialog';
import { buttonHover, buttonTap } from '../../../utils/animations';
import { formatDateTime } from '../../../utils/formatters';
import {
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_VARIANTS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_VARIANTS,
  BUSINESS_LINE_LABELS,
  BUSINESS_LINE_VARIANTS,
  LEAD_TYPE_LABELS,
  CITY_LABELS,
  TYPE_LABELS,
} from '../../../utils/constants';
import { canEditLead, canAssignLeads } from '../../../utils/permissions';
import useModalA11y from '../../../hooks/useModalA11y';

// Ficha de detalle de una cita — pensada para abrirse tanto desde un chip del mes como
// desde una fila de la vista Agenda, así que recibe el `appointment` ya resuelto (con
// lead/property/createdByUser incluidos por el backend, ver appointmentController) en vez
// de volver a pedirlo. Mismo patrón visual que StageBottomSheet.jsx (hoja inferior en
// mobile, modal centrado en desktop, una sola implementación responsive) combinado con las
// secciones de CloseLeadModal.jsx (encabezado + botón X + acciones al pie).
export default function AppointmentDetailModal({
  appointment,
  open,
  onClose,
  currentUser,
  onStatusChange,
  onReschedule,
  onDelete,
  onViewLead,
  isPending,
}) {
  const [rescheduling, setRescheduling] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleId = useId();

  const handleClose = () => {
    setRescheduling(false);
    setNewDate('');
    onClose();
  };
  const panelRef = useModalA11y(Boolean(open && appointment), handleClose);

  if (!appointment) return null;

  const lead = appointment.lead;
  const canEdit = canEditLead(currentUser, lead);
  const canDelete = canAssignLeads(currentUser); // mismo criterio de rol que admin/asistente en routes/appointments.js

  // La tarjeta reusada de Prospectos necesita el registro completo del lead (presupuesto,
  // campaña, propiedades de interés, etc.) — mucho más de lo que trae `appointment.lead`
  // (recortado a lo que necesita esta ficha). CalendarioSection es quien pide ese registro
  // completo (getLeadById). Esta ficha de la cita se queda abierta detrás (no se cierra) —
  // el panel del prospecto se abre encima, así el recuadro de la cita no desaparece.
  const handleViewLead = () => {
    onViewLead(lead.id);
  };

  const rowClass = 'flex items-start gap-2.5 text-sm';
  const labelClass = 'text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5';

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50"
            onClick={handleClose}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#242938] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full sm:max-w-lg max-h-[85vh] overflow-y-auto"
            >
              {/* Encabezado */}
              <div className="sticky top-0 bg-white dark:bg-[#242938] border-b border-gray-100 dark:border-[#2e3650] p-5 flex items-start justify-between gap-3 z-10">
                <div className="min-w-0">
                  <h3
                    id={titleId}
                    className="text-base font-bold text-gray-800 dark:text-gray-100 truncate"
                  >
                    {lead?.name || 'Prospecto sin nombre'}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatDateTime(appointment.scheduledAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant={APPOINTMENT_STATUS_VARIANTS[appointment.status]}>
                    {APPOINTMENT_STATUS_LABELS[appointment.status]}
                  </Badge>
                  <button
                    onClick={handleClose}
                    aria-label="Cerrar"
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-5">
                {appointment.rescheduledFromId && (
                  <p className="text-xs text-accent-600 dark:text-accent-400 flex items-center gap-1.5">
                    <RotateCcw size={12} /> Esta cita es resultado de un reagendado.
                  </p>
                )}

                {/* Prospecto */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                    Prospecto
                  </h4>
                  <div className="space-y-2">
                    <div className={rowClass}>
                      <Phone size={14} className={labelClass} />
                      <span className="text-gray-700 dark:text-gray-200">
                        {lead?.phone || 'Sin información'}
                      </span>
                    </div>
                    <div className={rowClass}>
                      <Mail size={14} className={labelClass} />
                      <span className="text-gray-700 dark:text-gray-200 break-all">
                        {lead?.email || 'Sin información'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {lead?.pipelineStage && (
                        <Badge variant={PIPELINE_STAGE_VARIANTS[lead.pipelineStage]}>
                          {PIPELINE_STAGE_LABELS[lead.pipelineStage]}
                        </Badge>
                      )}
                      {lead?.businessLine && (
                        <Badge variant={BUSINESS_LINE_VARIANTS[lead.businessLine]}>
                          {BUSINESS_LINE_LABELS[lead.businessLine]}
                        </Badge>
                      )}
                    </div>
                    {lead?.type && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Motivo de contacto: {LEAD_TYPE_LABELS[lead.type] || lead.type}
                      </p>
                    )}
                    {appointment.property && (
                      <div className={rowClass}>
                        <Home size={14} className={labelClass} />
                        <span className="text-gray-700 dark:text-gray-200">
                          {appointment.property.title}
                          {appointment.property.city &&
                            ` — ${CITY_LABELS[appointment.property.city] || appointment.property.city}`}
                          {appointment.property.type &&
                            ` · ${TYPE_LABELS[appointment.property.type] || appointment.property.type}`}
                        </span>
                      </div>
                    )}
                    {lead?.notes && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-[#1a1f2e] rounded-lg p-2.5 whitespace-pre-wrap">
                        {lead.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Resultado de la cita */}
                {appointment.outcome && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                      Resultado / notas de la cita
                    </h4>
                    <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                      {appointment.outcome}
                    </p>
                  </div>
                )}

                {/* Responsables */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-2">
                    Responsables
                  </h4>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-700 dark:text-gray-200">
                      <span className="text-gray-400 dark:text-gray-500">Agendó: </span>
                      {appointment.createdByUser?.name || 'No especificado'}
                    </p>
                    <p className="text-gray-700 dark:text-gray-200">
                      <span className="text-gray-400 dark:text-gray-500">Atiende: </span>
                      {lead?.assignedUser?.name || 'Sin asignar'}
                    </p>
                  </div>
                </div>

                {rescheduling && (
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none"
                    />
                    <motion.button
                      whileHover={buttonHover}
                      whileTap={buttonTap}
                      disabled={!newDate || isPending}
                      onClick={() => {
                        if (!newDate) return;
                        // CAL-001: convertir a ISO/UTC explícito antes de enviar — ver
                        // el mismo comentario en LeadDetailPanel.jsx (agendar cita).
                        onReschedule(appointment.id, new Date(newDate).toISOString());
                        setRescheduling(false);
                        setNewDate('');
                      }}
                      className="px-3 py-2 bg-accent-400 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 disabled:opacity-40 transition-colors flex-shrink-0"
                    >
                      Confirmar
                    </motion.button>
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="sticky bottom-0 bg-white dark:bg-[#242938] border-t border-gray-100 dark:border-[#2e3650] p-4 flex flex-wrap items-center gap-2">
                {lead && (
                  <motion.button
                    whileHover={buttonHover}
                    whileTap={buttonTap}
                    onClick={handleViewLead}
                    className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
                  >
                    <ExternalLink size={14} /> Ver prospecto
                  </motion.button>
                )}
                {canEdit && (
                  <>
                    {appointment.status !== 'completada' && (
                      <button
                        disabled={isPending}
                        onClick={() => onStatusChange(appointment.id, 'completada')}
                        className="px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors disabled:opacity-40"
                      >
                        Asistió
                      </button>
                    )}
                    {appointment.status !== 'no_show' && (
                      <button
                        disabled={isPending}
                        onClick={() => onStatusChange(appointment.id, 'no_show')}
                        className="px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors disabled:opacity-40"
                      >
                        No asistió
                      </button>
                    )}
                    <button
                      disabled={isPending}
                      onClick={() => setRescheduling((v) => !v)}
                      className="px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors disabled:opacity-40"
                    >
                      Reagendar
                    </button>
                    {appointment.status !== 'cancelada' && (
                      <button
                        disabled={isPending}
                        onClick={() => onStatusChange(appointment.id, 'cancelada')}
                        className="px-3 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                      >
                        Canceló
                      </button>
                    )}
                  </>
                )}
                {canDelete && (
                  <button
                    disabled={isPending}
                    onClick={() => setConfirmDelete(true)}
                    aria-label="Eliminar cita"
                    title="Eliminar cita"
                    className="ml-auto p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={confirmDelete}
        title="¿Eliminar esta cita?"
        message={`Se eliminará permanentemente la cita con ${lead?.name || 'este prospecto'}.`}
        confirmLabel="Eliminar"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          onDelete(appointment.id);
        }}
      />
    </>
  );
}
