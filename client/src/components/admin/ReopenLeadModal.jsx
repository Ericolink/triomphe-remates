import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import { buttonHover, buttonTap } from '../../utils/animations';
import { NON_TERMINAL_PIPELINE_STAGE_OPTIONS } from '../../utils/constants';
import useModalA11y from '../../hooks/useModalA11y';

// Modal obligatorio al reabrir un prospecto cerrado (drag a una columna activa del Kanban,
// o selección de etapa desde el botón "Etapa" del detalle / bottom sheet móvil) — mismo
// patrón visual y de accesibilidad que CloseLeadModal. La advertencia de venta eliminada es
// obligatoria (no un checkbox opcional): reopenLead en el backend borra el Deal asociado si
// el prospecto venía de `venta_realizada`, y ese efecto debe quedar explícito antes de confirmar.
//
// El caller remonta este componente (key={lead.id + targetStage}) por cada intento de
// reapertura nuevo — mismo truco que LeadDetailPanel (ver ese archivo) para inicializar
// `stage` desde targetStage sin sincronizarlo vía efecto.
export default function ReopenLeadModal({ open, lead, targetStage, onClose, onConfirm, isPending }) {
  const [stage, setStage] = useState(targetStage || 'contactado');
  const titleId = useId();
  const formId = useId();

  const handleClose = () => onClose();
  const panelRef = useModalA11y(open, handleClose);

  if (!lead) return null;

  const wasWon = lead.pipelineStage === 'venta_realizada';
  const canSubmit = Boolean(stage);

  const handleSubmit = () => {
    if (!canSubmit) return;
    onConfirm(stage);
  };

  const inputClass =
    'w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100';

  return (
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
            aria-describedby={wasWon ? `${formId}-warning` : undefined}
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full max-w-sm p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id={titleId} className="text-base font-bold text-gray-800 dark:text-gray-100">
                Reabrir prospecto
              </h3>
              <button
                onClick={handleClose}
                aria-label="Cerrar"
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{lead.name}</p>

            {wasWon && (
              <div
                id={`${formId}-warning`}
                className="flex items-start gap-2 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-2.5 mb-4"
              >
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>La venta asociada será eliminada y el prospecto volverá al pipeline.</span>
              </div>
            )}

            <div className="mb-5">
              <label
                htmlFor={`${formId}-stage`}
                className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Etapa destino
              </label>
              <select
                id={`${formId}-stage`}
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                className={inputClass}
              >
                {NON_TERMINAL_PIPELINE_STAGE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
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
                disabled={!canSubmit || isPending}
                whileHover={buttonHover}
                whileTap={buttonTap}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-primary-900 bg-accent-400 hover:bg-accent-300 disabled:opacity-40 transition-colors"
              >
                {isPending ? 'Reabriendo...' : 'Confirmar'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
