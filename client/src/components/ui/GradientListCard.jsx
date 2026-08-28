import { motion } from 'framer-motion';
import { fadeInUp } from '../../utils/animations';

// Shell compartido por las tarjetas de lista con degradado de color (BuzonAdminPage,
// ProspectosSection, ApplicationsPage) — motion.div, checkbox opcional, franja de
// degradado, estado seleccionado/hover y acciones que aparecen al pasar el mouse. El
// contenido (título/badge/meta/preview) sigue siendo JSX propio de cada página vía
// `children`, porque varía demasiado entre dominios como para forzarlo a una plantilla
// genérica.
export default function GradientListCard({
  checked,
  onCheckToggle,
  checkLabel,
  onClick,
  selected,
  unread,
  gradientClass,
  actions,
  children,
}) {
  return (
    <motion.div
      variants={fadeInUp}
      layout
      onClick={onClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      whileHover={{ x: 4, transition: { duration: 0.15 } }}
      className={`group relative overflow-hidden rounded-2xl p-5 shadow-sm border cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 ${
        unread ? 'bg-primary-50/50 dark:bg-primary-900/10' : 'bg-white dark:bg-[#242938]'
      } ${
        selected
          ? 'border-accent-500 dark:border-accent-400 ring-1 ring-accent-500'
          : 'border-gray-100 dark:border-[#2e3650]'
      }`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-y-0 right-0 w-1/3 sm:w-2/5 bg-gradient-to-l ${gradientClass} to-transparent`}
      />
      <div className="relative z-10 flex items-start gap-3">
        {onCheckToggle && (
          <input
            type="checkbox"
            checked={checked}
            onChange={onCheckToggle}
            onClick={(e) => e.stopPropagation()}
            aria-label={checkLabel}
            className="mt-1 w-4 h-4 rounded accent-accent-400 flex-shrink-0 cursor-pointer"
          />
        )}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      {actions?.length > 0 && (
        <div className="absolute bottom-3 right-3 z-10 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {actions.map((a) => (
            <button
              key={a.key}
              onClick={(e) => {
                e.stopPropagation();
                a.onClick(e);
              }}
              title={a.label}
              aria-label={a.label}
              className={`p-1.5 bg-white/90 dark:bg-[#1a1f2e]/90 text-gray-400 rounded-lg transition-colors shadow-sm ${a.hoverClass || 'hover:text-gray-600'}`}
            >
              {a.icon}
            </button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
