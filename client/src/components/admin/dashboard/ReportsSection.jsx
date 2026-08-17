/* eslint-disable security/detect-object-injection -- este archivo solo indexa los mapas de
   labels/colores de utils/constants.js con claves de enum devueltas por la API (stage, reason,
   status), nunca con datos de entrada de usuario. */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Target, XCircle, Users, CalendarCheck, PieChart } from 'lucide-react';
import { motion } from 'framer-motion';
import CollapsibleSection from '../../ui/CollapsibleSection';
import ProgressRow from '../../ui/ProgressRow';
import Spinner from '../../ui/Spinner';
import TabBar from '../../ui/TabBar';
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
  BUSINESS_LINE_LABELS,
} from '../../../utils/constants';

const BUSINESS_LINE_TABS = [
  { key: '', label: 'Todas' },
  ...Object.entries(BUSINESS_LINE_LABELS).map(([key, label]) => ({ key, label })),
];

// Últimos 12 meses (incluido el actual), más reciente primero — generado en el cliente en
// vez de pedirle al backend la lista de meses con datos, que no se necesita para este caso.
function buildMonthOptions() {
  const now = new Date();
  const options = [{ value: '', label: 'Todo el tiempo' }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return options;
}

// Nivel 4 — reportes comerciales, integrados como panel colapsable en vez de una sección
// de navegación aparte. La query solo se dispara la primera vez que el usuario lo abre.
export default function ReportsSection() {
  const [everOpened, setEverOpened] = useState(false);
  const [businessLine, setBusinessLine] = useState('');
  const [month, setMonth] = useState('');
  const monthOptions = useMemo(() => buildMonthOptions(), []);

  const { data, isLoading } = useQuery({
    queryKey: ['crm-reports', businessLine, month],
    queryFn: () => getCrmReports({ businessLine: businessLine || undefined, month: month || undefined }),
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
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
        <TabBar tabs={BUSINESS_LINE_TABS} active={businessLine} onChange={setBusinessLine} />
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="mb-6 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
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
                  {d.porAsesor.map((a) => {
                    // Solo se listan las líneas con al menos 1 prospecto — evita ruido
                    // ("0 remates · 0 infonavit · 0 inversión") en la mayoría de los casos.
                    const lineParts = Object.entries(a.byLine || {})
                      .filter(([, count]) => count > 0)
                      .map(
                        ([line, count]) =>
                          `${count} ${line === 'sin_especificar' ? 'sin línea' : (BUSINESS_LINE_LABELS[line] || line)}`
                      );
                    return (
                      <div
                        key={a.userId}
                        className="px-3 py-2.5 rounded-xl bg-white dark:bg-[#242938] text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-700 dark:text-gray-200">
                            {a.name}
                          </span>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">
                            {a.leadCount} prospectos · {a.dealCount} ventas · {formatPrice(a.revenue)}
                          </span>
                        </div>
                        {lineParts.length > 0 && (
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {lineParts.join(' · ')}
                          </p>
                        )}
                      </div>
                    );
                  })}
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
