import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import useFavorites from '../../hooks/useFavorites';

export default function FavoriteButton({ property, size = 16, className = '' }) {
  const { isFavorite, toggle } = useFavorites();
  const active = isFavorite(property.id);

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(property);
    toast.success(active ? 'Eliminado de favoritos' : 'Guardado en favoritos', {
      duration: 1500,
      icon: active ? '💔' : '❤️',
    });
  };

  return (
    <motion.button
      whileTap={{ scale: 0.8 }}
      whileHover={{ scale: 1.1 }}
      onClick={handleClick}
      aria-label={active ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      title={active ? 'Quitar de favoritos' : 'Guardar en favoritos'}
      className={`flex items-center justify-center rounded-full transition-colors ${
        active
          ? 'bg-red-500 text-white shadow-md'
          : 'bg-white/85 text-gray-400 hover:text-red-500 shadow'
      } ${className}`}
    >
      <Heart size={size} fill={active ? 'currentColor' : 'none'} strokeWidth={2} />
    </motion.button>
  );
}
