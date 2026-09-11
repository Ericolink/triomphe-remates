import { useState } from 'react';
import { Type, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import usePopoverA11y from '../../hooks/usePopoverA11y';
import useTextSizeStore, { TEXT_SIZES, TEXT_SIZE_LABELS } from '../../store/textSizeStore';

// Selector de accesibilidad "Tamaño del texto" — escala la tipografía de toda la app
// vía la variable CSS --app-text-scale (ver tailwind.config.js e index.css), sin tocar
// spacing/layout. La preferencia persiste en localStorage (textSizeStore).
export default function TextSizeControl({ className = '', iconClassName = '' }) {
  const [open, setOpen] = useState(false);
  const { panelRef, triggerRef } = usePopoverA11y(open, () => setOpen(false));
  const textSize = useTextSizeStore((state) => state.textSize);
  const setTextSize = useTextSizeStore((state) => state.setTextSize);

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        title="Tamaño del texto"
        aria-label="Tamaño del texto"
        aria-haspopup="true"
        aria-expanded={open}
        className={`w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${className}`}
      >
        <Type size={22} className={iconClassName} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-1 w-52 bg-white dark:bg-[#242938] rounded-xl shadow-lg border border-gray-100 dark:border-[#2e3650] py-1 z-20"
          >
            <p className="px-3 pt-1.5 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Tamaño del texto
            </p>
            {TEXT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                role="menuitemradio"
                aria-checked={textSize === size}
                onClick={() => {
                  setTextSize(size);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
              >
                {TEXT_SIZE_LABELS[size]}
                {textSize === size && <Check size={16} className="text-accent-500" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
