import { useQuery } from '@tanstack/react-query';
import { Target, XCircle, Users, CalendarCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { getCrmReports } from '../../services/crmAnalyticsService';
import Spinner from '../../components/ui/Spinner';
import { staggerContainer, fadeInUp, fadeIn } from '../../utils/animations';
import { formatPrice } from '../../utils/formatters';
import {
  PIPELINE_STAGE_LABELS, PIPELINE_STAGE_BAR_COLORS,
  CLOSE_REASON_LABELS, CLOSE_REASON_BAR_COLORS,
  APPOINTMENT_STATUS_LABELS, APPOINTMENT_STATUS_BAR_COLORS,
} from '../../utils/constants';

const DEFAULT_BAR_COLOR = 'bg-blue-900 dark:bg-blue-500';

// El color ahora depende de la rama/categoría de cada barra (etapa, motivo de cierre o
// estado de cita) en vez de un azul uniforme — ver los mapas *_BAR_COLORS en constants.js.
function ProgressRow({ label, total, max, index, color = DEFAULT_BAR_COLOR }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 dark:text-gray-300">{label}</span>
        <span className="font-semibold text-gray-800 dark:text-gray-100">{total}</span>
      </div>
      <div className="h-2 bg-gray-100 dark:bg-[#2e3650] rounded-full overflow-hidden">
        <motion.div className={`h-full rounded-full ${color}`}
          initial={{ width: 0 }} animate={{ width: `${max > 0 ? (total / max) * 100 : 0}%` }}
          transition={{ duration: 0.8, delay: 0.2 + index * 0.08, ease: 'easeOut' }} />
      </div>
    </div>
  );
}

// Reportes — deliberadamente limitado a un puñado de vistas simples (embudo, motivos de
// cierre, desempeño por asesor sin ranking, citas completadas vs no-show), separado del
// Dashboard Comercial que es para actuar, no para analizar. Ver CRM_UX_DESIGN.md §10.f.
export default function CrmReportsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['crm-reports'], queryFn: getCrmReports });
  const d = data?.data;

  if (isLoading) return <Spinner size="lg" className="py-20" />;

  const funnelMax = Math.max(...(d?.funnel ?? []).map((f) => f.total), 1);
  const closeReasonsMax = Math.max(...(d?.closeReasons ?? []).map((r) => r.total), 1);
  const citasMax = Math.max(...(d?.citasPorEstado ?? []).map((c) => c.total), 1);

  return (
    <div>
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Reportes</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Análisis del embudo comercial</p>
      </motion.div>

      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6" variants={staggerContainer} initial="hidden" animate="visible">
        <motion.div variants={fadeInUp} className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Target size={16} className="text-blue-700 dark:text-blue-400" /> Embudo comercial
          </h2>
          <div className="space-y-3">
            {(d?.funnel ?? []).map(({ stage, total }, i) => (
              <ProgressRow key={stage} label={PIPELINE_STAGE_LABELS[stage] || stage} total={total} max={funnelMax} index={i}
                color={PIPELINE_STAGE_BAR_COLORS[stage]} />
            ))}
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <XCircle size={16} className="text-red-500" /> Motivos de cierre (perdidos)
          </h2>
          {(d?.closeReasons ?? []).every((r) => r.total === 0) ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">Sin prospectos cerrados como perdidos aún.</p>
          ) : (
            <div className="space-y-3">
              {(d?.closeReasons ?? []).filter((r) => r.total > 0).map(({ reason, total }, i) => (
                <ProgressRow key={reason} label={CLOSE_REASON_LABELS[reason] || reason} total={total} max={closeReasonsMax} index={i}
                  color={CLOSE_REASON_BAR_COLORS[reason]} />
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>

      <motion.div className="grid grid-cols-1 lg:grid-cols-2 gap-6" variants={staggerContainer} initial="hidden" whileInView="visible" viewport={{ once: true }}>
        <motion.div variants={fadeInUp} className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Users size={16} className="text-yellow-500" /> Desempeño por asesor
          </h2>
          {(d?.porAsesor ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 italic">Todavía no hay prospectos asignados.</p>
          ) : (
            <div className="space-y-2">
              {d.porAsesor.map((a) => (
                <div key={a.userId} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1f2e] text-sm">
                  <span className="font-medium text-gray-700 dark:text-gray-200">{a.name}</span>
                  <span className="text-gray-500 dark:text-gray-400 text-xs">
                    {a.leadCount} prospectos · {a.dealCount} ventas · {formatPrice(a.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={fadeInUp} className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <CalendarCheck size={16} className="text-green-600" /> Citas por estado
          </h2>
          <div className="space-y-3">
            {(d?.citasPorEstado ?? []).map(({ status, total }, i) => (
              <ProgressRow key={status} label={APPOINTMENT_STATUS_LABELS[status] || status} total={total} max={citasMax} index={i}
                color={APPOINTMENT_STATUS_BAR_COLORS[status]} />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
