import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Users, CalendarClock, TrendingUp, PhoneCall, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getCrmDashboard } from '../../services/crmAnalyticsService';
import { getTasks, completeTask } from '../../services/taskService';
import Spinner from '../../components/ui/Spinner';
import { staggerContainer, fadeInUp, fadeIn } from '../../utils/animations';
import { formatPrice, formatDateTime } from '../../utils/formatters';
import { TASK_TYPE_LABELS } from '../../utils/constants';

// Dashboard Comercial — separado del Dashboard general (propiedades). Responde "¿qué
// requiere mi atención hoy?" antes que cualquier gráfica; ver CRM_UX_DESIGN.md §7.
export default function CrmDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: getCrmDashboard,
    refetchInterval: 60000,
  });
  const d = data?.data;

  const { data: overdueData } = useQuery({
    queryKey: ['tasks-overdue'],
    queryFn: () => getTasks({ overdue: true }),
  });
  const overdueTasks = overdueData?.data ?? [];

  const completeMutation = useMutation({
    mutationFn: (id) => completeTask(id),
    onSuccess: () => {
      toast.success('Tarea completada');
      queryClient.invalidateQueries(['tasks-overdue']);
      queryClient.invalidateQueries(['crm-dashboard']);
    },
    onError: () => toast.error('Error al completar la tarea'),
  });

  if (isLoading) return <Spinner size="lg" className="py-20" />;

  const kpis = [
    { label: 'Prospectos nuevos', value: d?.prospectosNuevos ?? 0, icon: <Users size={22} />, color: 'bg-blue-600',
      onClick: () => navigate('/admin/leads', { state: { pipelineStage: 'nuevo' } }) },
    { label: 'Pendientes de responder', value: d?.prospectosPendientes ?? 0, icon: <MessageCircle size={22} />, color: 'bg-yellow-500',
      onClick: () => navigate('/admin/leads', { state: { pipelineStage: 'contactado' } }) },
    { label: 'Citas hoy', value: d?.citasHoy?.length ?? 0, icon: <CalendarClock size={22} />, color: 'bg-blue-900',
      onClick: () => navigate('/admin/calendario') },
    { label: 'Ventas esta semana', value: `${d?.ventasSemana?.count ?? 0} · ${formatPrice(d?.ventasSemana?.total)}`, icon: <TrendingUp size={22} />, color: 'bg-green-600',
      onClick: () => navigate('/admin/leads', { state: { pipelineStage: 'venta_realizada' } }) },
  ];

  return (
    <div>
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard Comercial</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Esto requiere tu atención hoy</p>
      </motion.div>

      {/* KPIs */}
      <motion.div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8" variants={staggerContainer} initial="hidden" animate="visible">
        {kpis.map(({ label, value, icon, color, onClick }) => (
          <motion.div key={label} variants={fadeInUp} whileHover={{ y: -4, transition: { duration: 0.2 } }}
            onClick={onClick} role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
            className="bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650] transition-shadow cursor-pointer hover:shadow-md hover:border-blue-200 dark:hover:border-blue-800">
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white mb-3`}>{icon}</div>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
              {label}<span className="text-blue-500 dark:text-blue-400"> · ver detalle</span>
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* Requiere acción inmediata */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650] mb-6">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
          <AlertTriangle size={16} className="text-red-500" /> Requiere acción inmediata
        </h2>
        {overdueTasks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Todo al día — no hay seguimientos vencidos.</p>
        ) : (
          <div className="space-y-2">
            {overdueTasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-900/10">
                <button onClick={() => navigate('/admin/leads')} className="text-left flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{task.lead?.name}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block">
                    {TASK_TYPE_LABELS[task.type] || task.type} — venció {formatDateTime(task.dueDate)}
                  </span>
                </button>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {task.lead?.phone && (
                    <a href={`tel:${task.lead.phone}`} title="Llamar" className="p-1.5 text-gray-400 hover:text-blue-500"><PhoneCall size={15} /></a>
                  )}
                  {task.lead?.phone && (
                    <a href={`https://wa.me/${task.lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="p-1.5 text-gray-400 hover:text-green-500"><MessageCircle size={15} /></a>
                  )}
                  <button onClick={() => completeMutation.mutate(task.id)}
                    className="text-xs font-medium px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Completar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Citas de hoy */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible"
          className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-100">Citas de hoy</h2>
            <button onClick={() => navigate('/admin/calendario')} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Ver calendario</button>
          </div>
          {(d?.citasHoy ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Sin citas programadas para hoy.</p>
          ) : (
            <div className="space-y-2">
              {d.citasHoy.map((a) => (
                <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1f2e]">
                  <span className="text-xs font-mono text-blue-600 dark:text-blue-400 flex-shrink-0">
                    {new Date(a.scheduledAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{a.lead?.name}</span>
                  {a.property && <span className="text-xs text-gray-400 truncate">{a.property.title}</span>}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Actividad reciente */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible"
          className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Actividad reciente</h2>
          {(d?.actividadReciente ?? []).length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Sin actividad reciente.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {d.actividadReciente.map((a) => (
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

      {/* Campaña con mejor rendimiento */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100">Campaña con mejor rendimiento</h2>
          <button onClick={() => navigate('/admin/campanas')} className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">Ver campañas</button>
        </div>
        {(d?.mejoresCampanas ?? []).length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Todavía no hay prospectos asociados a una campaña.</p>
        ) : (
          <div className="space-y-2">
            {d.mejoresCampanas.slice(0, 3).map((c) => (
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
    </div>
  );
}
