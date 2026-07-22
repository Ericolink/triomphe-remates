import { motion } from 'framer-motion';

// Numeración de páginas reutilizada por las tablas/listados de catálogo completo
// (AdminPropertiesPage, AuditPage, UsersPage, JobsAdminPage) — antes duplicada
// idéntica en cada pantalla.
export default function Pagination({ pagination, page, onPageChange, className = '' }) {
  if (!pagination || pagination.totalPages <= 1) return null;

  return (
    <div className={`flex justify-center gap-2 ${className}`}>
      {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
        <motion.button
          key={p}
          type="button"
          onClick={() => onPageChange(p)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
            page === p
              ? 'bg-blue-900 dark:bg-blue-700 text-white'
              : 'bg-gray-100 dark:bg-[#2e3650] text-gray-700 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          {p}
        </motion.button>
      ))}
    </div>
  );
}
