import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getDashboard } from '../../services/analyticsService';
import { getCrmDashboard } from '../../services/crmAnalyticsService';
import { getFeedbacks } from '../../services/feedbackService';
import { getProperties } from '../../services/propertyService';
import { getTasks, completeTask } from '../../services/taskService';
import Spinner from '../../components/ui/Spinner';
import UrgentSection from '../../components/admin/dashboard/UrgentSection';
import OverviewSection from '../../components/admin/dashboard/OverviewSection';
import AnalyticsSection from '../../components/admin/dashboard/AnalyticsSection';
import ReportsSection from '../../components/admin/dashboard/ReportsSection';
import { fadeIn } from '../../utils/animations';

// Dashboard único: reemplaza los antiguos Dashboard / Dashboard Comercial / Estadísticas /
// Reportes. Organizado en 4 niveles de jerarquía visual — urgente, resumen, analítica,
// reportes — para que toda la información importante viva en una sola pantalla sin
// obligar al usuario a adivinar en qué sección buscarla.
export default function DashboardPage() {
  const queryClient = useQueryClient();

  const { data: dashboardData, isLoading: loadingDashboard } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60000,
  });
  const d = dashboardData?.data;

  const { data: crmData, isLoading: loadingCrm } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: getCrmDashboard,
    refetchInterval: 60000,
  });
  const crm = crmData?.data;

  // AUDIT: sin `limit`, este widget descargaba TODAS las tareas vencidas del sistema desde
  // siempre — crece indefinidamente con la vida del negocio. `limit` es opcional en
  // getTasks (ver taskController.js); acotarlo aquí no afecta a Kanban/detalle de lead,
  // que llaman getTasks con `leadIds` y sin `limit`. `total` viene del backend para poder
  // avisar cuántas quedan fuera en vez de ocultarlas en silencio.
  const { data: overdueData } = useQuery({
    queryKey: ['tasks-overdue'],
    queryFn: () => getTasks({ overdue: true, limit: 20 }),
  });
  const overdueTasks = overdueData?.data ?? [];
  const overdueTotal = overdueData?.total ?? overdueTasks.length;

  const { data: newFeedbackData } = useQuery({
    queryKey: ['dashboard-new-feedback'],
    queryFn: () => getFeedbacks({ status: 'nuevo', limit: 5 }),
  });
  const newFeedback = newFeedbackData?.data ?? [];

  const { data: recentPropertiesData } = useQuery({
    queryKey: ['dashboard-recent-properties'],
    queryFn: () => getProperties({ limit: 5 }),
  });
  const recentProperties = recentPropertiesData?.data ?? [];

  const completeMutation = useMutation({
    mutationFn: (id) => completeTask(id),
    onSuccess: () => {
      toast.success('Tarea completada');
      queryClient.invalidateQueries(['tasks-overdue']);
      queryClient.invalidateQueries(['crm-dashboard']);
    },
    onError: () => toast.error('Error al completar la tarea'),
  });

  if (loadingDashboard || loadingCrm) return <Spinner size="lg" className="py-20" />;

  return (
    <div>
      <motion.div variants={fadeIn} initial="hidden" animate="visible" className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Todo lo importante, en un solo lugar
        </p>
      </motion.div>

      <UrgentSection
        overdueTasks={overdueTasks}
        overdueTotal={overdueTotal}
        onCompleteTask={(id) => completeMutation.mutate(id)}
        prospectosNuevos={crm?.prospectosNuevos ?? 0}
        prospectosPendientes={crm?.prospectosPendientes ?? 0}
        newFeedbackCount={newFeedback.length}
        citasHoy={crm?.citasHoy ?? []}
      />

      <OverviewSection
        ventasSemana={crm?.ventasSemana}
        tasaCierre={d?.conversion?.rate}
        propiedadesDisponibles={d?.properties?.disponible}
        vistas30Dias={d?.views?.last30Days}
        mejoresCampanas={crm?.mejoresCampanas}
        actividadReciente={crm?.actividadReciente}
      />

      <div className="space-y-6">
        <AnalyticsSection d={d} recentProperties={recentProperties} />
        <ReportsSection />
      </div>
    </div>
  );
}
