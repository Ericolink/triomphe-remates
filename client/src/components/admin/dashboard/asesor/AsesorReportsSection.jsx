import { XCircle, CalendarCheck, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import CollapsibleSection from '../../../ui/CollapsibleSection';
import ProgressRow from '../../../ui/ProgressRow';
import { staggerContainer, fadeInUp } from '../../../../utils/animations';
import {
  CLOSE_REASON_LABELS,
  CLOSE_REASON_BAR_COLORS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_BAR_COLORS,
} from '../../../../utils/constants';

// Colapsada por defecto, mismo criterio que ReportsSection.jsx (dashboard admin) — datos
// secundarios que no compiten por atención con lo urgente/resumen de arriba. A diferencia
// de esa, no incluye "desempeño por asesor" (no aplica: es la propia cartera) ni el filtro
// por línea de negocio/mes (se mantiene simple para esta primera versión).
export default function AsesorReportsSection({ reportes }) {
  const closeReasonsMax = Math.max(...reportes.closeReasons.map((r) => r.total), 1);
  const citasMax = Math.max(...reportes.citasPorEstado.map((c) => c.total), 1);
  const hasCloseReasons = reportes.closeReasons.some((r) => r.total > 0);

  return (
    <CollapsibleSection
      title="Más detalles"
      icon={<PieChart size={16} className="text-primary-700 dark:text-primary-400" />}
      subtitle="motivos de cierre, citas por estado"
    >
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeInUp} className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <XCircle size={16} className="text-red-500" /> Motivos de cierre (perdidos)
          </h3>
          {!hasCloseReasons ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">
              Sin prospectos cerrados como perdidos aún.
            </p>
          ) : (
            <div className="space-y-3">
              {reportes.closeReasons
                .filter((r) => r.total > 0)
                .map(({ reason, total }, i) => (
                  <ProgressRow
                    key={reason}
                    label={CLOSE_REASON_LABELS[reason] || reason}
                    total={total}
                    max={closeReasonsMax}
                    index={i}
                    color={CLOSE_REASON_BAR_COLORS[reason]}
                  />
                ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={fadeInUp} className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <CalendarCheck size={16} className="text-green-600" /> Citas por estado
          </h3>
          <div className="space-y-3">
            {reportes.citasPorEstado.map(({ status, total }, i) => (
              <ProgressRow
                key={status}
                label={APPOINTMENT_STATUS_LABELS[status] || status}
                total={total}
                max={citasMax}
                index={i}
                color={APPOINTMENT_STATUS_BAR_COLORS[status]}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </CollapsibleSection>
  );
}
