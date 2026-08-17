import { Link, useLocation } from 'react-router-dom';
import { GitCompare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import useComparator from '../../hooks/useComparator';
import { buildImageUrl } from '../../utils/images';

export default function ComparatorBar() {
  const { items, clear, toggle, count } = useComparator();
  const { pathname } = useLocation();

  // En la página del comparador la barra flotante es redundante y tapa la tabla
  if (pathname === '/comparar') return null;

  return (
    <AnimatePresence>
      {count > 0 && (
        // Wrapper fijo centrado con flexbox (sin transform): si el centrado y la
        // animación de Framer Motion vivieran en el mismo elemento, el `transform`
        // que Framer Motion aplica para `y` pisaría el `-translate-x-1/2` de Tailwind
        // y la barra quedaría desplazada y cortada en pantallas angostas
        <div className="fixed bottom-[calc(1.5rem_+_env(safe-area-inset-bottom))] inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="pointer-events-auto max-w-full bg-white dark:bg-[#242938] border border-gray-200 dark:border-[#2e3650] rounded-2xl shadow-2xl px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 overflow-x-auto"
          >
            <GitCompare size={18} className="text-primary-700 dark:text-primary-400 flex-shrink-0" />
            <div className="flex items-center gap-2">
              {items.map((p) => {
                const img = p.images?.[0];
                const imgUrl = img ? buildImageUrl(img.url, 80) : null;
                return (
                  <div key={p.id} className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 dark:bg-[#2e3650]">
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={p.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-primary-100 dark:bg-primary-900/30" />
                      )}
                    </div>
                    <button
                      onClick={() => toggle(p)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center"
                    >
                      <X size={9} />
                    </button>
                  </div>
                );
              })}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block whitespace-nowrap">
              {count}/3 propiedades
            </span>
            {count >= 2 ? (
              <Link
                to="/comparar"
                className="px-4 py-1.5 bg-accent-400 text-primary-900 text-sm font-medium rounded-xl hover:bg-accent-300 transition-colors whitespace-nowrap flex-shrink-0"
              >
                Comparar →
              </Link>
            ) : (
              <span
                title="Selecciona al menos 2 propiedades para comparar"
                className="px-4 py-1.5 bg-gray-100 dark:bg-[#2e3650] text-gray-400 dark:text-gray-500 text-sm font-medium rounded-xl whitespace-nowrap cursor-not-allowed select-none flex-shrink-0"
              >
                Comparar →
              </span>
            )}
            <button
              onClick={clear}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
              title="Limpiar comparador"
            >
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
