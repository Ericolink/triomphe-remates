import { Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function BatchActionBar({ count, onClear, onDelete, statusOptions = [], onStatus }) {
  if (count === 0) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-blue-900 text-white px-5 py-3 rounded-2xl shadow-2xl"
      >
        <span className="text-sm font-medium">{count} seleccionado{count !== 1 ? 's' : ''}</span>
        <div className="w-px h-5 bg-blue-700" />
        {statusOptions.length > 0 && (
          <select onChange={(e) => { if (e.target.value) onStatus(e.target.value); e.target.value = ''; }}
            defaultValue=""
            className="text-sm bg-blue-800 border border-blue-700 rounded-lg px-2 py-1 text-white focus:outline-none cursor-pointer">
            <option value="" disabled>Cambiar estatus</option>
            {statusOptions.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        )}
        <button onClick={onDelete}
          className="flex items-center gap-1.5 text-sm bg-red-500 hover:bg-red-600 transition-colors px-3 py-1.5 rounded-lg">
          <Trash2 size={14} /> Eliminar
        </button>
        <button onClick={onClear} className="p-1.5 hover:bg-blue-800 rounded-lg transition-colors">
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
