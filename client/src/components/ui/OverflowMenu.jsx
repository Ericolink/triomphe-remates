import { useEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// Agrupa acciones poco frecuentes o destructivas (desactivar, eliminar) detrás de un
// menú, para que no compitan visualmente con la acción común (editar) en cada fila.
export default function OverflowMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((o) => !o)}
        title="Más acciones"
        aria-label="Más acciones"
        aria-haspopup="true"
        aria-expanded={open}
        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-[#2e3650] dark:hover:text-gray-200 rounded-lg transition-colors"
      >
        <MoreVertical size={18} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 mt-1 w-44 bg-white dark:bg-[#242938] rounded-xl shadow-lg border border-gray-100 dark:border-[#2e3650] py-1 z-20"
          >
            {items.map(({ label, icon, onClick, danger }) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onClick();
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors ${
                  danger
                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650]'
                }`}
              >
                {icon} {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
