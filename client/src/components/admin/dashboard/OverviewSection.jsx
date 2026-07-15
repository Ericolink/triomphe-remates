import { useNavigate } from 'react-router-dom';
import { TrendingUp, Target, Home, Eye, Megaphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { staggerContainer, fadeInUp } from '../../../utils/animations';
import { formatPrice, formatDateTime } from '../../../utils/formatters';

// Nivel 2 — resumen general: "¿cómo va la empresa hoy?" en 4 números clave + qué campaña
// está funcionando + qué acaba de pasar. Sin duplicar los conteos ya mostrados en Nivel 1.
export default function OverviewSection({ ventasSemana, tasaCierre, propiedadesDisponibles, vistas30Dias, mejoresCampanas, actividadReciente }) {
  const navigate = useNavigate();

  const kpis = [
    { label: 'Ventas esta semana', value: `${ventasSemana?.count ?? 0} · ${formatPrice(ventasSemana?.total)}`, icon: <TrendingUp size={22} />, color: 'bg-green-600',
      onClick: () => navigate('/admin/leads', { state: { pipelineStage: 'venta_realizada' } }) },
    { label: 'Tasa de cierre', value: `${tasaCierre ?? 0}%`, icon: <Target size={22} />, color: 'bg-blue-900',
      onClick: () => navigate('/admin/leads') },
    { label: 'Propiedades disponibles', value: propiedadesDisponibles ?? 0, icon: <Home size={22} />, color: 'bg-blue-600',
      onClick: () => navigate('/admin/propiedades', { state: { status: 'disponible' } }) },
    { label: 'Vistas del sitio (30 días)', value: vistas30Dias ?? 0, icon: <Eye size={22} />, color: 'bg-purple-600' },
  ];

  return (
    <div className="mb-6">
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6" variants={staggerContainer} initial="hidden" animate="visible">
        {kpis.map(({ label, value, icon, color, onClick }) => (
          <motion.div key={label} variants={fadeInUp}
            {...(onClick ? { whileHover: { y: -4, transition: { duration: 0.2 } }, onClick, role: 'button', tabIndex: 0,
              onKeyDown: (e) => { if (e.key === 'Enter') onClick(); } } : {})}
            className={`bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650] transition-shadow ${
              onClick ? 'cursor-pointer hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800' : ''}`}>
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white mb-3`}>{icon}</div>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              {label}{onClick && <span className="text-blue-500 dark:text-blue-400"> · ver detalle</span>}
            </p>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={fadeInUp} initial="hidden" animate="visible"
          className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
              <Megaphone size={16} className="text-yellow-500" /> Mejor campaña
            </h2>
            <button onClick={() => navigate('/admin/campanas')} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
              Ver campañas
            </button>
          </div>
          {(mejoresCampanas ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Todavía no hay prospectos asociados a una campaña.</p>
          ) : (
            <div className="space-y-2">
              {mejoresCampanas.slice(0, 3).map((c) => (
                <div key={c.campaignId} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1f2e]">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.leadCount} prospectos · {c.dealCount} ventas</p>
                  </div>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">{c.conversionRate}%</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div variants={fadeInUp} initial="hidden" animate="visible"
          className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Actividad reciente</h2>
          {(actividadReciente ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Sin actividad reciente.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {actividadReciente.map((a) => (
                <div key={a.id} className="px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1f2e]">
                  <p className="text-sm text-gray-700 dark:text-gray-200">
                    <span className="font-medium">{a.lead?.name}</span> — {a.content}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(a.occurredAt)}{a.user ? ` · ${a.user.name}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
