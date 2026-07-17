import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

// Envoltorio de progressive disclosure: mismo look que las demás cards del admin, pero
// con el contenido oculto hasta que el usuario lo pide explícitamente. Usado para las
// secciones "avanzadas" del Dashboard (Analítica, Reportes) que no deben competir por
// atención con lo urgente/resumen.
export default function CollapsibleSection({ title, icon, subtitle, defaultOpen = false, onOpen, children }) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) onOpen?.();
  };

  return (
    <div className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between gap-3 px-6 py-5 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            {icon} {title}
          </h2>
          {subtitle && <span className="text-xs text-gray-400 dark:text-gray-500 truncate">· {subtitle}</span>}
        </div>
        <ChevronDown size={18} className={`text-gray-400 flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="overflow-hidden">
            <div className="px-6 pb-6 border-t border-gray-100 dark:border-[#2e3650] pt-5">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
