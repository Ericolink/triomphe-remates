import { GitCompare, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import useComparator from '../../hooks/useComparator';

export default function ComparatorButton({ property, size = 16, className = '', showLabel = false }) {
  const { isInComparator, toggle, isFull } = useComparator();
  const active = isInComparator(property.id);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!active && isFull) {
      toast.error('Máximo 3 propiedades para comparar', { duration: 2000 });
      return;
    }
    toggle(property);
    toast.success(active ? 'Quitado del comparador' : 'Agregado al comparador ✓', {
      duration: 1500,
    });
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.06 }}
      onClick={handleClick}
      aria-label={
        active
          ? 'Quitar del comparador'
          : isFull
            ? 'Comparador lleno (máx. 3)'
            : 'Comparar propiedad'
      }
      title={
        active
          ? 'Quitar del comparador'
          : isFull
            ? 'Comparador lleno (máx. 3)'
            : 'Comparar propiedad'
      }
      className={`flex items-center justify-center gap-1.5 rounded-full transition-colors ${
        active
          ? 'bg-primary-600 text-white shadow-md ring-2 ring-white/60'
          : 'bg-white/90 text-gray-600 hover:text-primary-600 shadow'
      } ${showLabel ? 'px-3' : ''} ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {active ? (
          <motion.span
            key="check"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center"
          >
            <Check size={size} strokeWidth={3} />
          </motion.span>
        ) : (
          <motion.span
            key="compare"
            initial={{ scale: 0.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center"
          >
            <GitCompare size={size} strokeWidth={2} />
          </motion.span>
        )}
      </AnimatePresence>
      {showLabel && (
        <span className="text-xs font-semibold whitespace-nowrap">
          {active ? 'Añadida' : 'Comparar'}
        </span>
      )}
    </motion.button>
  );
}
