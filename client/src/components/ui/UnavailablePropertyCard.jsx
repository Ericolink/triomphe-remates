import { motion } from 'framer-motion';
import { PackageX, Trash2 } from 'lucide-react';

// Reemplaza a PropertyCard cuando la sincronización con el servidor detecta
// que la propiedad ya no existe. No enlaza a la ficha (sería un 404) y deja
// la decisión de quitarla en manos del usuario en vez de borrarla sola —
// así no desaparece nada de la lista sin que el usuario lo note o lo pida.
export default function UnavailablePropertyCard({ title, onRemove }) {
  return (
    <motion.div className="h-full flex flex-col items-center justify-center text-center gap-3 p-6 bg-white dark:bg-[#242938] rounded-2xl border border-dashed border-gray-200 dark:border-[#2e3650]">
      <PackageX size={32} className="text-gray-300 dark:text-gray-600" />
      <div>
        <p className="font-medium text-gray-500 dark:text-gray-400 line-clamp-2">{title}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Esta propiedad ya no está disponible
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 dark:border-red-800 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
      >
        <Trash2 size={13} /> Quitar de la lista
      </button>
    </motion.div>
  );
}
