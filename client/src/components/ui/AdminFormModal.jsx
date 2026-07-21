import { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import useModalA11y from '../../hooks/useModalA11y';

// Esqueleto compartido de los modales de formulario del admin (crear/editar vacante,
// usuario, testimonio, ...). Antes cada página reimplementaba el mismo backdrop + panel
// + header + botón cerrar sin foco trap ni Escape; ahora todos heredan useModalA11y.
export default function AdminFormModal({ open, onClose, title, maxWidth = 'max-w-2xl', children }) {
  const titleId = useId();
  const panelRef = useModalA11y(open, onClose);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-[#2e3650]">
              <h2 id={titleId} className="text-lg font-bold text-gray-800 dark:text-gray-100">
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-[#2e3650] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
