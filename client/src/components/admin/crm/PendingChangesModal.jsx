import { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pencil } from 'lucide-react';
import { buttonHover, buttonTap } from '../../../utils/animations';
import useModalA11y from '../../../hooks/useModalA11y';

// Se muestra al intentar salir de un prospecto (cerrar el detalle o abrir otro) mientras
// quedan campos editados sin guardar — LeadDetailPanel dejó de guardar cada campo al vuelo
// (ver queueChange ahí) para poder juntarlos en un solo PUT y mostrar aquí exactamente qué
// va a cambiar antes de mandarlo. Mismo patrón visual que CloseLeadModal/ReopenLeadModal,
// pero con 3 acciones en vez de 2 (Guardar/Descartar/Seguir editando) porque "cancelar" aquí
// significa quedarse en el prospecto actual, no simplemente cerrar el diálogo.
export default function PendingChangesModal({ open, changes, isSaving, onSave, onDiscard, onCancel }) {
  const titleId = useId();
  const panelRef = useModalA11y(open, onCancel);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onCancel}
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
            className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full max-w-sm p-6"
          >
            <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 bg-accent-100 dark:bg-accent-900/30">
              <Pencil size={22} className="text-accent-600 dark:text-accent-400" />
            </div>

            <h3
              id={titleId}
              className="text-base font-bold text-gray-800 dark:text-gray-100 text-center mb-1"
            >
              Cambios sin guardar
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
              ¿Quieres guardar estos cambios antes de continuar?
            </p>

            <dl className="space-y-2 mb-6 max-h-52 overflow-y-auto rounded-xl bg-gray-50 dark:bg-[#1a1f2e] p-3">
              {changes.map(({ key, label, before, after }) => (
                <div key={key} className="text-xs">
                  <dt className="font-semibold text-gray-600 dark:text-gray-300">{label}</dt>
                  <dd className="text-gray-500 dark:text-gray-400 flex items-center gap-1 flex-wrap">
                    <span className="line-through opacity-70">{before}</span>
                    <span>→</span>
                    <span className="text-gray-700 dark:text-gray-200 font-medium">{after}</span>
                  </dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-2">
              <motion.button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                whileHover={buttonHover}
                whileTap={buttonTap}
                className="py-2.5 rounded-xl text-sm font-medium text-white bg-accent-500 hover:bg-accent-600 disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'Guardando…' : 'Guardar cambios'}
              </motion.button>
              <div className="flex gap-2">
                <motion.button
                  type="button"
                  onClick={onCancel}
                  disabled={isSaving}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  className="flex-1 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] disabled:opacity-50 transition-colors"
                >
                  Seguir editando
                </motion.button>
                <motion.button
                  type="button"
                  onClick={onDiscard}
                  disabled={isSaving}
                  whileHover={buttonHover}
                  whileTap={buttonTap}
                  className="flex-1 py-2.5 border border-red-200 dark:border-red-900/40 rounded-xl text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors"
                >
                  Descartar
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
