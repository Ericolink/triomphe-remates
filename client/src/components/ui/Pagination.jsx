import { motion } from 'framer-motion';

// Ventana de páginas alrededor de la actual + primera/última, con "…" para los huecos —
// evita renderizar un botón por página cuando totalPages crece con el catálogo.
function getPageWindow(page, totalPages, siblingCount = 2) {
  const pages = new Set([1, totalPages]);
  for (let p = page - siblingCount; p <= page + siblingCount; p++) {
    if (p >= 1 && p <= totalPages) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const items = [];
  let prev = null;
  for (const p of sorted) {
    if (prev !== null && p - prev > 1) items.push(`ellipsis-${p}`);
    items.push(p);
    prev = p;
  }
  return items;
}

// Numeración de páginas reutilizada por las tablas/listados de catálogo completo
// (AdminPropertiesPage, AuditPage, UsersPage, JobsAdminPage) — antes duplicada
// idéntica en cada pantalla.
export default function Pagination({ pagination, page, onPageChange, className = '' }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  const items = getPageWindow(page, pagination.totalPages);

  return (
    <div className={`flex justify-center gap-2 ${className}`}>
      {items.map((item) =>
        typeof item === 'number' ? (
          <motion.button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className={`min-w-9 h-9 px-1 rounded-lg text-sm font-medium transition-colors ${
              page === item
                ? 'bg-primary-900 dark:bg-primary-700 text-white'
                : 'bg-gray-100 dark:bg-[#2e3650] text-gray-700 dark:text-gray-300 hover:bg-gray-200'
            }`}
          >
            {item}
          </motion.button>
        ) : (
          <span
            key={item}
            className="min-w-9 h-9 flex items-center justify-center text-sm text-gray-400 dark:text-gray-500"
          >
            …
          </span>
        )
      )}
    </div>
  );
}
