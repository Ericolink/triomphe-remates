import { Link } from 'react-router-dom';
import { GitCompare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useComparator from '../../hooks/useComparator';

const buildUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${import.meta.env.VITE_API_URL?.replace('/api', '')}${url}`;
};

export default function ComparatorBar() {
  const { items, clear, toggle, count } = useComparator();

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-[#242938] border border-gray-200 dark:border-[#2e3650] rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3"
        >
          <GitCompare size={18} className="text-blue-700 dark:text-blue-400 flex-shrink-0" />
          <div className="flex items-center gap-2">
            {items.map((p) => {
              const img = p.images?.[0];
              const imgUrl = img ? buildUrl(img.url) : null;
              return (
                <div key={p.id} className="relative">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-[#2e3650]">
                    {imgUrl
                      ? <img src={imgUrl} alt={p.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30" />}
                  </div>
                  <button onClick={() => toggle(p)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center">
                    <X size={9} />
                  </button>
                </div>
              );
            })}
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
            {count}/3 propiedades
          </span>
          {count >= 2 && (
            <Link to="/comparar"
              className="px-4 py-1.5 bg-blue-900 text-white text-sm font-medium rounded-xl hover:bg-blue-800 transition-colors whitespace-nowrap">
              Comparar →
            </Link>
          )}
          <button onClick={clear} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Limpiar comparador">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
