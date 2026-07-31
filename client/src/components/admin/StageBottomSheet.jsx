import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { PIPELINE_STAGE_LABELS } from '../../utils/constants';
import useModalA11y from '../../hooks/useModalA11y';

// Alternativa táctil al drag & drop del Kanban — en mobile arrastrar tarjetas con el dedo
// es impreciso, así que tocar la tarjeta abre esta hoja inferior con las etapas como
// opciones grandes de una sola columna (1 tap = cambio de etapa). Dispara el mismo
// callback que el drop de escritorio (onSelectStage), así que la lógica de "si es una
// etapa terminal, abre CloseLeadModal" vive en un solo lugar (LeadsPage), no duplicada.
export default function StageBottomSheet({ open, lead, onClose, onSelectStage }) {
  const panelRef = useModalA11y(Boolean(open && lead), onClose);

  if (!lead) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Cambiar etapa de ${lead.name}`}
            tabIndex={-1}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#242938] rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full sm:max-w-sm max-h-[80vh] overflow-y-auto"
          >
            <div className="p-4 border-b border-gray-100 dark:border-[#2e3650]">
              <p className="text-xs text-gray-400 dark:text-gray-500">Cambiar etapa</p>
              <p className="font-semibold text-gray-800 dark:text-gray-100">{lead.name}</p>
            </div>
            <div className="p-2">
              {Object.entries(PIPELINE_STAGE_LABELS).map(([stage, label]) => (
                <button
                  key={stage}
                  onClick={() => onSelectStage(stage)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-sm text-left transition-colors ${
                    lead.pipelineStage === stage
                      ? 'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-300 font-medium'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650]'
                  }`}
                >
                  {label}
                  {lead.pipelineStage === stage && <Check size={16} />}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
