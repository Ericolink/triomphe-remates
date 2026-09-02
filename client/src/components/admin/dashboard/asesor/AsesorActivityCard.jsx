import { Link } from 'react-router-dom';
import { Clock3, Home } from 'lucide-react';
import { motion } from 'framer-motion';
import { fadeInUp } from '../../../../utils/animations';
import { formatDateTime } from '../../../../utils/formatters';

// Actividad reciente de mi cartera (mismo formato que la tarjeta homónima de
// OverviewSection.jsx, ya scoped) + "Propiedades de interés" — Lead.propertyId ya existe,
// así que se muestra sin agregar una sección aparte de propiedades (PASO 9: solo con datos
// reales, sin llenar el dashboard).
export default function AsesorActivityCard({ actividadReciente, propiedadesInteres }) {
  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]"
    >
      <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
        <Clock3 size={16} className="text-primary-700 dark:text-primary-400" /> Actividad reciente
      </h2>
      {actividadReciente.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500">Sin actividad reciente.</p>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {actividadReciente.map((a) => (
            <div key={a.id} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1f2e]">
              <p className="text-sm text-gray-700 dark:text-gray-200">
                <span className="font-medium">{a.lead?.name}</span> — {a.content}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDateTime(a.occurredAt)}
                {a.user ? ` · ${a.user.name}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {propiedadesInteres.length > 0 && (
        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-[#2e3650]">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-3 flex items-center gap-1.5">
            <Home size={13} /> Propiedades de interés
          </h3>
          <div className="space-y-1.5">
            {propiedadesInteres.map((p) => (
              <Link
                key={p.propertyId}
                to={`/propiedades/${p.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1f2e] text-sm hover:bg-gray-100 dark:hover:bg-[#242938] transition-colors"
              >
                <span className="text-gray-700 dark:text-gray-200 truncate">{p.title}</span>
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {p.leadCount} prospecto{p.leadCount !== 1 ? 's' : ''}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
