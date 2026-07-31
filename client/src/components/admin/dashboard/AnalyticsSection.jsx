import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Eye,
  TrendingUp,
  MapPin,
  Home,
  Target,
  ArrowRight,
  Users,
  BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import CollapsibleSection from '../../ui/CollapsibleSection';
import TabBar from '../../ui/TabBar';
import Badge from '../../ui/Badge';
import { BarChart, AreaChart } from '../../ui/MiniChart';
import { staggerContainer, fadeInUp } from '../../../utils/animations';
import { formatPrice } from '../../../utils/formatters';
import {
  CITY_LABELS,
  TYPE_LABELS_SHORT,
  SOURCE_LABELS,
  SOURCE_COLORS,
  STATUS_LABELS,
  STATUS_VARIANTS,
  STATUS_STAT_COLORS,
  LEAD_TYPE_LABELS,
} from '../../../utils/constants';

const leadStatusLabel = {
  nuevo: 'Nuevos',
  contactado: 'Contactados',
  cerrado: 'Cerrados',
  descartado: 'Descartados',
};

const TABS = [
  { key: 'inventario', label: 'Inventario y tráfico' },
  { key: 'leads', label: 'Leads y conversión' },
];

// Nivel 3 — analítica y tendencias. Colapsado por defecto y dividido en pestañas para no
// mostrar las ~10 tarjetas de golpe (principio "no muro de gráficas" del rediseño).
export default function AnalyticsSection({ d, recentProperties }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState('inventario');

  return (
    <CollapsibleSection
      title="Analítica"
      icon={<BarChart3 size={16} className="text-primary-700 dark:text-primary-400" />}
      subtitle="gráficas y desgloses a detalle"
    >
      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'inventario' && (
        <motion.div key="inventario" initial="hidden" animate="visible" variants={staggerContainer}>
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
            variants={staggerContainer}
          >
            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Users size={16} className="text-accent-500" /> Leads por semana
              </h3>
              <BarChart data={d?.leadsOverTime ?? []} color="#C08D3E" />
            </motion.div>
            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Eye size={16} className="text-primary-600 dark:text-primary-400" /> Vistas por semana
              </h3>
              <AreaChart data={d?.viewsOverTime ?? []} color="#343C56" />
            </motion.div>
          </motion.div>

          <motion.div
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"
            variants={staggerContainer}
          >
            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <MapPin size={16} className="text-primary-700 dark:text-primary-400" /> Por ciudad
              </h3>
              <div className="space-y-3">
                {d?.byCity?.map(({ city, total }) => (
                  <div key={city}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-300">
                        {CITY_LABELS[city] || city}
                      </span>
                      <span className="font-semibold text-gray-800 dark:text-gray-100">
                        {total}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-[#2e3650] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-900 dark:bg-primary-500 rounded-full"
                        style={{
                          width: `${d.properties.total > 0 ? (total / d.properties.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Home size={16} className="text-primary-700 dark:text-primary-400" /> Por tipo
              </h3>
              <div className="space-y-3">
                {d?.byType?.map(({ type, total }) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {TYPE_LABELS_SHORT[type] || type}
                    </span>
                    <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                      {total}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-primary-700 dark:text-primary-400" /> Más visitadas
              </h3>
              <div className="space-y-3">
                {d?.topProperties?.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="w-7 h-7 shrink-0 bg-gray-100 dark:bg-[#2e3650] rounded-full flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                        {p.title}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {CITY_LABELS[p.city]}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                      <Eye size={12} /> {p.views}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            variants={fadeInUp}
            className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5 mb-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <Building2 size={16} className="text-primary-700 dark:text-primary-400" /> Propiedades
                recientes
              </h3>
              <button
                onClick={() => navigate('/admin/propiedades')}
                className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
              >
                Ver todas
              </button>
            </div>
            {(recentProperties ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Todavía no hay propiedades cargadas.
              </p>
            ) : (
              <div className="space-y-2">
                {recentProperties.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/admin/propiedades/${p.id}/editar`)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white dark:hover:bg-[#2e3650]/40 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">
                        {p.title}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {CITY_LABELS[p.city]} · {formatPrice(p.price)}
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANTS[p.status]}>{STATUS_LABELS[p.status]}</Badge>
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div variants={fadeInUp} className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">
              Estatus del inventario
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { key: 'disponible', label: 'Disponibles', value: d?.properties?.disponible },
                { key: 'apartado', label: 'Apartadas', value: d?.properties?.apartado },
                { key: 'vendido', label: 'Vendidas', value: d?.properties?.vendido },
              ].map(({ key, label, value }) => (
                <div
                  key={label}
                  className={`rounded-xl p-4 text-center ${STATUS_STAT_COLORS[key]}`}
                >
                  <p className="text-2xl font-bold">{value ?? 0}</p>
                  <p className="text-sm font-medium mt-1">{label}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}

      {tab === 'leads' && (
        <motion.div key="leads" initial="hidden" animate="visible" variants={staggerContainer}>
          <motion.div
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"
            variants={staggerContainer}
          >
            <motion.div
              variants={fadeInUp}
              className="lg:col-span-1 bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Target size={16} className="text-green-600" /> Embudo de conversión (30 días)
              </h3>
              <div className="flex items-center justify-between gap-2 mb-5">
                {[
                  { label: 'Vistas', value: d?.conversion?.funnel?.views ?? 0 },
                  { label: 'Leads', value: d?.conversion?.funnel?.leads ?? 0 },
                  { label: 'Cerrados', value: d?.conversion?.funnel?.closed ?? 0 },
                ].map(({ label, value }, i, arr) => (
                  <div key={label} className="flex items-center gap-2 flex-1">
                    <div className="text-center flex-1">
                      <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{label}</p>
                    </div>
                    {i < arr.length - 1 && (
                      <ArrowRight
                        size={16}
                        className="text-gray-300 dark:text-gray-600 flex-shrink-0"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-[#2e3650]">
                <div className="flex justify-between items-center text-sm">
                  <span
                    className="text-gray-500 dark:text-gray-400 cursor-help"
                    title="De cada 100 personas que vieron una propiedad, cuántas dejaron sus datos de contacto"
                  >
                    Tasa de vista → lead
                  </span>
                  <span className="font-semibold text-primary-700 dark:text-primary-400">
                    {d?.conversion?.viewToLeadRate ?? 0}%
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span
                    className="text-gray-500 dark:text-gray-400 cursor-help"
                    title="De cada 100 leads recibidos, cuántos terminaron en una operación cerrada"
                  >
                    Tasa de cierre (lead → cerrado)
                  </span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {d?.conversion?.rate ?? 0}%
                  </span>
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Users size={16} className="text-accent-500" /> Leads por estatus
              </h3>
              <div className="space-y-3">
                {d?.leadsByStatus?.map(({ status, total }) => (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600 dark:text-gray-300">
                        {leadStatusLabel[status] || status}
                      </span>
                      <span className="font-semibold text-gray-800 dark:text-gray-100">
                        {total}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 dark:bg-[#2e3650] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-900 dark:bg-primary-500 rounded-full"
                        style={{
                          width: `${d.leads.total > 0 ? (total / d.leads.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <Users size={16} className="text-primary-700 dark:text-primary-400" /> Leads por tipo
              </h3>
              <div className="space-y-3">
                {d?.leadsByType?.map(({ type, total }) => (
                  <div key={type} className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {LEAD_TYPE_LABELS[type] || type}
                    </span>
                    <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-900 dark:text-primary-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                      {total}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>

          <motion.div variants={fadeInUp} className="bg-gray-50 dark:bg-[#1a1f2e] rounded-2xl p-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
              <TrendingUp size={16} className="text-accent-500" /> Leads por fuente
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {d?.leadsBySource
                ?.filter(({ total }) => total > 0)
                .map(({ source, total }) => (
                  <div
                    key={source}
                    className={`rounded-xl p-3 text-center ${SOURCE_COLORS[source] || SOURCE_COLORS.otro}`}
                  >
                    <p className="text-xl font-bold">{total}</p>
                    <p className="text-xs font-medium mt-0.5">{SOURCE_LABELS[source] || source}</p>
                  </div>
                ))}
              {!d?.leadsBySource?.some(({ total }) => total > 0) && (
                <p className="col-span-full text-sm text-gray-400 dark:text-gray-500 italic">
                  Sin datos de fuente aún.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </CollapsibleSection>
  );
}
