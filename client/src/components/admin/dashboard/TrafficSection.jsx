import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Eye,
  Users,
  Layers,
  Home,
  MessageCircle,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Monitor,
  FileText,
} from 'lucide-react';
import { motion } from 'framer-motion';
import Spinner from '../../ui/Spinner';
import TabBar from '../../ui/TabBar';
import { AreaChart } from '../../ui/MiniChart';
import { getTrafficDashboard } from '../../../services/analyticsService';
import { staggerContainer, fadeInUp } from '../../../utils/animations';
import { CITY_LABELS, TRAFFIC_SOURCE_LABELS, TRAFFIC_SOURCE_COLORS, DEVICE_LABELS } from '../../../utils/constants';

const RANGE_TABS = [
  { key: 'today', label: 'Hoy' },
  { key: '7d', label: '7 días' },
  { key: '30d', label: '30 días' },
  { key: '3m', label: '3 meses' },
  { key: '6m', label: '6 meses' },
  { key: '12m', label: '12 meses' },
];

function Delta({ change }) {
  if (change === null || change === undefined) return null;
  if (change === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-gray-400 dark:text-gray-500">
        <Minus size={12} /> sin cambio
      </span>
    );
  }
  const positive = change > 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        positive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
      }`}
    >
      <Icon size={12} /> {positive ? '+' : ''}
      {change}% vs. periodo anterior
    </span>
  );
}

function StatCard({ icon, label, value, change }) {
  return (
    <motion.div
      variants={fadeInUp}
      className="bg-white dark:bg-[#242938] rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-[#2e3650]"
    >
      <div className="w-9 h-9 bg-primary-900 dark:bg-primary-600 rounded-xl flex items-center justify-center text-white mb-3">
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
      <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{label}</p>
      <div className="mt-1.5">
        <Delta change={change} />
      </div>
    </motion.div>
  );
}

// Pestaña "Tráfico del sitio" de la sección Analítica del dashboard admin — Fase 1 de
// analítica propia. Consume GET /api/analytics/traffic; solo se monta (y solo entonces
// dispara su query) cuando el usuario selecciona esta pestaña, mismo patrón que
// 'inventario'/'leads' en AnalyticsSection.jsx.
export default function TrafficSection() {
  const [range, setRange] = useState('30d');

  const { data, isLoading } = useQuery({
    queryKey: ['traffic-dashboard', range],
    queryFn: () => getTrafficDashboard({ range }),
  });
  const d = data?.data;
  const totals = d?.totals;

  return (
    <div>
      <TabBar tabs={RANGE_TABS} active={range} onChange={setRange} />

      {isLoading || !d ? (
        <Spinner size="md" className="py-10" />
      ) : (
        <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
          <motion.div
            className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6"
            variants={staggerContainer}
          >
            <StatCard icon={<Eye size={18} />} label="Páginas vistas" value={totals.pageViews.value} change={totals.pageViews.change} />
            <StatCard icon={<Users size={18} />} label="Visitantes" value={totals.uniqueVisitors.value} change={totals.uniqueVisitors.change} />
            <StatCard icon={<Layers size={18} />} label="Sesiones" value={totals.sessions.value} change={totals.sessions.change} />
            <StatCard icon={<Home size={18} />} label="Vistas de propiedades" value={totals.propertyViews.value} change={totals.propertyViews.change} />
            <StatCard icon={<MessageCircle size={18} />} label="Contactos" value={totals.contacts.value} change={totals.contacts.change} />
            <StatCard
              icon={<Target size={18} />}
              label="Conversión"
              value={totals.conversionRate === null ? '—' : `${totals.conversionRate}%`}
            />
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5 mb-6"
          >
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-2">
              <TrendingUp size={16} className="text-primary-700 dark:text-primary-400" /> Páginas vistas
              a lo largo del tiempo
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              Línea punteada = mismo número de días, periodo anterior
            </p>
            <AreaChart data={d.traffic.current} compareData={d.traffic.previous} color="#343C56" />
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
            variants={staggerContainer}
          >
            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Globe size={16} className="text-accent-500" /> Fuentes de tráfico
              </h3>
              {d.sources.every((s) => s.total === 0) ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">Sin visitas aún en este periodo.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {d.sources
                    .filter((s) => s.total > 0)
                    .map(({ source, total }) => (
                      <div key={source} className={`rounded-xl p-3 text-center ${TRAFFIC_SOURCE_COLORS[source]}`}>
                        <p className="text-xl font-bold">{total}</p>
                        <p className="text-xs font-medium mt-0.5">{TRAFFIC_SOURCE_LABELS[source]}</p>
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
                <Monitor size={16} className="text-primary-700 dark:text-primary-400" /> Dispositivos
              </h3>
              {d.devices.every((dv) => dv.total === 0) ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">Sin visitas aún en este periodo.</p>
              ) : (
                <div className="space-y-3">
                  {d.devices.map(({ device, total, percent }) => (
                    <div key={device}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-300">{DEVICE_LABELS[device]}</span>
                        <span className="font-semibold text-gray-800 dark:text-gray-100">
                          {total} · {percent}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-[#2e3650] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-900 dark:bg-primary-500 rounded-full"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            variants={staggerContainer}
          >
            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <FileText size={16} className="text-primary-700 dark:text-primary-400" /> Páginas más
                visitadas
              </h3>
              {d.topPages.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">Sin datos aún en este periodo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 dark:text-gray-500">
                        <th className="font-medium pb-2">Página</th>
                        <th className="font-medium pb-2 text-right">Visitas</th>
                        <th className="font-medium pb-2 text-right">Visitantes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.topPages.map((p) => (
                        <tr key={p.path} className="border-t border-gray-100 dark:border-[#2e3650]">
                          <td className="py-2 text-gray-700 dark:text-gray-200 truncate max-w-[180px]">{p.path}</td>
                          <td className="py-2 text-right font-semibold text-gray-800 dark:text-gray-100">{p.views}</td>
                          <td className="py-2 text-right text-gray-500 dark:text-gray-400">{p.visitors}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Home size={16} className="text-primary-700 dark:text-primary-400" /> Propiedades más
                vistas
              </h3>
              {d.topProperties.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">Sin datos aún en este periodo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-gray-400 dark:text-gray-500">
                        <th className="font-medium pb-2">Propiedad</th>
                        <th className="font-medium pb-2 text-right">Vistas</th>
                        <th className="font-medium pb-2 text-right">Contactos</th>
                        <th className="font-medium pb-2 text-right">Conversión</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.topProperties.map((p) => (
                        <tr key={p.propertyId} className="border-t border-gray-100 dark:border-[#2e3650]">
                          <td className="py-2 text-gray-700 dark:text-gray-200 truncate max-w-[160px]">
                            {p.title}
                            {p.city && (
                              <span className="text-gray-400 dark:text-gray-500"> · {CITY_LABELS[p.city]}</span>
                            )}
                          </td>
                          <td className="py-2 text-right font-semibold text-gray-800 dark:text-gray-100">{p.views}</td>
                          <td className="py-2 text-right text-gray-500 dark:text-gray-400">{p.contacts}</td>
                          <td className="py-2 text-right text-gray-500 dark:text-gray-400">
                            {p.conversionRate === null ? '—' : `${p.conversionRate}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
