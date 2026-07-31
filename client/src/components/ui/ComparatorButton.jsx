import { GitCompare } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import useComparator from '../../hooks/useComparator';

export default function ComparatorButton({ property, size = 16, className = '' }) {
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
    toast.success(active ? 'Quitado del comparador' : 'Agregado al comparador', { duration: 1500 });
  };

  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      whileHover={{ scale: 1.1 }}
      onClick={handleClick}
      title={
        active
          ? 'Quitar del comparador'
          : isFull
            ? 'Comparador lleno (máx. 3)'
            : 'Comparar propiedad'
      }
      className={`flex items-center justify-center rounded-full transition-colors ${
        active
          ? 'bg-primary-600 text-white shadow-md'
          : 'bg-white/85 text-gray-400 hover:text-primary-600 shadow'
      } ${className}`}
    >
      <GitCompare size={size} strokeWidth={2} />
    </motion.button>
  );
}
