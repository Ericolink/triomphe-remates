import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { X, User, Clock, Building2, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { buttonHover, buttonTap } from '../../../utils/animations';
import { createAppointment } from '../../../services/appointmentService';
import { createLead } from '../../../services/leadService';
import useModalA11y from '../../../hooks/useModalA11y';
import LeadPicker from '../LeadPicker';
import PropertyPicker from '../PropertyPicker';
import CreateLeadModal from '../CreateLeadModal';

const FIELD_LABEL_CLASS =
  'flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 mb-1';

function FieldLabel({ icon: Icon, children }) {
  return (
    <label className={FIELD_LABEL_CLASS}>
      <Icon size={12} className="flex-shrink-0 text-gray-400 dark:text-gray-500" />
      {children}
    </label>
  );
}

// Fecha -> valor de <input type="datetime-local"> en hora LOCAL del navegador (mismo
// criterio que ya usa el input de "Agendar" en LeadDetailPanel.jsx — CAL-001: hora local,
// nunca UTC, para que lo que se ve en pantalla sea lo que el usuario realmente eligió).
function toDatetimeLocalValue(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Agendar una cita desde el Calendario — a diferencia del formulario "Agendar" que ya existe
// dentro de la pestaña Citas de un prospecto (que ya sabe para quién es la cita), este modal
// necesita preguntar primero A QUIÉN se le agenda: buscar un prospecto existente (LeadPicker,
// ya scoped por rol) o crear uno nuevo ahí mismo si no está (reutiliza CreateLeadModal tal
// cual, sin duplicar su formulario). Disponible para cualquier rol con acceso al CRM — un
// asesor_ventas ahora puede crear prospectos (ver leadController.createLead) y el nuevo
// prospecto queda auto-asignado a él, así que createAppointment (que exige canEditLead) lo
// acepta sin fricción.
export default function AgendarCitaModal({ open, onClose, initialDate, onScheduled }) {
  const [selectedLead, setSelectedLead] = useState(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [propertyId, setPropertyId] = useState('');
  const [createLeadOpen, setCreateLeadOpen] = useState(false);
  // Ajuste de estado durante el render (no un useEffect) al estilo "guardar info de renders
  // anteriores" que recomienda React — evita el round-trip de re-render extra que un efecto
  // metería solo para copiar `initialDate` a `scheduledAt` la primera vez que se abre con un
  // día ya elegido. `prefilledFor` recuerda qué `initialDate` ya se copió, para no
  // sobreescribir lo que el asesor ya haya tecleado en renders posteriores.
  const [prefilledFor, setPrefilledFor] = useState(null);
  const titleId = useId();
  const formId = useId();

  if (open && initialDate && initialDate !== prefilledFor) {
    const d = new Date(initialDate);
    d.setHours(10, 0, 0, 0);
    setPrefilledFor(initialDate);
    setScheduledAt(toDatetimeLocalValue(d));
  }

  const handleClose = () => {
    setSelectedLead(null);
    setScheduledAt('');
    setPropertyId('');
    setPrefilledFor(null);
    onClose();
  };
  const panelRef = useModalA11y(open, handleClose);

  const createAppointmentMutation = useMutation({
    mutationFn: createAppointment,
    onSuccess: () => {
      toast.success('Cita agendada exitosamente');
      onScheduled?.();
      handleClose();
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al agendar la cita'),
  });

  const createLeadMutation = useMutation({
    mutationFn: createLead,
    onSuccess: (res, payload) => {
      // createLead solo responde { data: { id } } (pensado para el formulario público) — se
      // arma un prospecto "de vista" con lo que ya se capturó en el formulario, sin pedirlo
      // de nuevo con un GET aparte.
      setSelectedLead({
        id: res.data.id,
        name: payload.name || 'Prospecto sin nombre',
        phone: payload.phone || null,
      });
      setCreateLeadOpen(false);
      toast.success('Prospecto creado exitosamente');
    },
    onError: (e) => toast.error(e?.response?.data?.error || 'Error al crear el prospecto'),
  });

  const handleSubmit = () => {
    if (!selectedLead || !scheduledAt) return;
    createAppointmentMutation.mutate({
      leadId: selectedLead.id,
      propertyId: propertyId || undefined,
      scheduledAt: new Date(scheduledAt).toISOString(),
    });
  };

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100';

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          >
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={{ scale: 0.95, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full max-w-md p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 id={titleId} className="text-base font-bold text-gray-800 dark:text-gray-100">
                  Agendar cita
                </h3>
                <button
                  onClick={handleClose}
                  aria-label="Cerrar"
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <FieldLabel icon={User}>Prospecto</FieldLabel>
                  <LeadPicker value={selectedLead} onChange={setSelectedLead} />
                  <button
                    type="button"
                    onClick={() => setCreateLeadOpen(true)}
                    className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    <UserPlus size={13} /> ¿No lo encuentras? Crear nuevo prospecto
                  </button>
                </div>
                <div>
                  <FieldLabel icon={Clock}>Fecha y hora</FieldLabel>
                  <input
                    id={`${formId}-scheduledAt`}
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <FieldLabel icon={Building2}>Propiedad relacionada (opcional)</FieldLabel>
                  <PropertyPicker
                    id={`${formId}-propertyId`}
                    value={propertyId}
                    onChange={setPropertyId}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  type="button"
                  onClick={handleClose}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
                >
                  Cancelar
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!selectedLead || !scheduledAt || createAppointmentMutation.isPending}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium text-primary-900 bg-accent-400 hover:bg-accent-300 disabled:opacity-40 transition-colors"
                >
                  {createAppointmentMutation.isPending ? 'Agendando...' : 'Agendar cita'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <CreateLeadModal
        open={createLeadOpen}
        onClose={() => setCreateLeadOpen(false)}
        isPending={createLeadMutation.isPending}
        onSubmit={(payload) => createLeadMutation.mutate(payload)}
      />
    </>
  );
}
