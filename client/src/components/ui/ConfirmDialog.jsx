import { useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { buttonHover, buttonTap } from '../../utils/animations';
import useModalA11y from '../../hooks/useModalA11y';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Eliminar',
  onConfirm,
  onCancel,
  danger = true,
}) {
  const panelRef = useModalA11y(open, onCancel);
  const titleId = useId();

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ scale: 0.9, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#242938] rounded-2xl shadow-2xl border border-gray-100 dark:border-[#2e3650] w-full max-w-sm p-6"
          >
            {/* Ícono */}
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
                danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-primary-100 dark:bg-primary-900/30'
              }`}
            >
              <AlertTriangle size={24} className={danger ? 'text-red-500' : 'text-primary-600 dark:text-primary-400'} />
            </div>

            {/* Texto */}
            <h3
              id={titleId}
              className="text-base font-bold text-gray-800 dark:text-gray-100 text-center mb-2"
            >
              {title}
            </h3>
            {message && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-6 leading-relaxed">
                {message}
              </p>
            )}

            {/* Botones */}
            <div className="flex gap-3">
              <motion.button
                type="button"
                onClick={onCancel}
                whileHover={buttonHover}
                whileTap={buttonTap}
                className="flex-1 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
              >
                Cancelar
              </motion.button>
              <motion.button
                type="button"
                onClick={onConfirm}
                whileHover={buttonHover}
                whileTap={buttonTap}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${
                  danger ? 'bg-red-500 hover:bg-red-600' : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {confirmLabel}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
