import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Target, XCircle, Users, CalendarCheck, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import CollapsibleSection from '../../ui/CollapsibleSection';
import ProgressRow from '../../ui/ProgressRow';
import Spinner from '../../ui/Spinner';
import { getCrmReports } from '../../../services/crmAnalyticsService';
import { staggerContainer, fadeInUp } from '../../../utils/animations';
import { formatPrice } from '../../../utils/formatters';
import {
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_BAR_COLORS,
  CLOSE_REASON_LABELS,
  CLOSE_REASON_BAR_COLORS,
  APPOINTMENT_STATUS_LABELS,
  APPOINTMENT_STATUS_BAR_COLORS,
} from '../../../utils/constants';

// Nivel 4 — reportes comerciales, integrados como panel colapsable en vez de una sección
// de navegación aparte. La query solo se dispara la primera vez que el usuario lo abre.
export default function ReportsSection() {
  const [everOpened, setEverOpened] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['crm-reports'],
    queryFn: getCrmReports,
    enabled: everOpened,
  });
  const d = data?.data;

  const funnelMax = Math.max(...(d?.funnel ?? []).map((f) => f.total), 1);
  const closeReasonsMax = Math.max(...(d?.closeReasons ?? []).map((r) => r.total), 1);
  const citasMax = Math.max(...(d?.citasPorEstado ?? []).map((c) => c.total), 1);

  return (
    <CollapsibleSection
      title="Reportes comerciales"
      icon={<PieChart size={16} className="text-primary-700 dark:text-primary-400" />}
      subtitle="embudo, motivos de cierre, desempeño por asesor"
      onOpen={() => setEverOpened(true)}
    >
      {isLoading || !d ? (
        <Spinner size="md" className="py-10" />
      ) : (
        <>
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Target size={16} className="text-primary-700 dark:text-primary-400" /> Embudo comercial
              </h3>
              <div className="space-y-3">
                {(d?.funnel ?? []).map(({ stage, total }, i) => (
                  <ProgressRow
                    key={stage}
                    label={PIPELINE_STAGE_LABELS[stage] || stage}
                    total={total}
                    max={funnelMax}
                    index={i}
                    color={PIPELINE_STAGE_BAR_COLORS[stage]}
                  />
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <XCircle size={16} className="text-red-500" /> Motivos de cierre (perdidos)
              </h3>
              {(d?.closeReasons ?? []).every((r) => r.total === 0) ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                  Sin prospectos cerrados como perdidos aún.
                </p>
              ) : (
                <div className="space-y-3">
                  {(d?.closeReasons ?? [])
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
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Users size={16} className="text-accent-500" /> Desempeño por asesor
              </h3>
              {(d?.porAsesor ?? []).length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                  Todavía no hay prospectos asignados.
                </p>
              ) : (
                <div className="space-y-2">
                  {d.porAsesor.map((a) => (
                    <div
                      key={a.userId}
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white dark:bg-[#242938] text-sm"
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-200">{a.name}</span>
                      <span className="text-gray-500 dark:text-gray-400 text-xs">
                        {a.leadCount} prospectos · {a.dealCount} ventas · {formatPrice(a.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <CalendarCheck size={16} className="text-green-600" /> Citas por estado
              </h3>
              <div className="space-y-3">
                {(d?.citasPorEstado ?? []).map(({ status, total }, i) => (
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
        </>
      )}
    </CollapsibleSection>
  );
}
