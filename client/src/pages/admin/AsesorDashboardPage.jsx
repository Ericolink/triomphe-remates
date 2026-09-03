import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { RefreshCcw } from 'lucide-react';
import { getMyCrmDashboard } from '../../services/crmAnalyticsService';
import useAuthStore from '../../store/authStore';
import Spinner from '../../components/ui/Spinner';
import AsesorKpiRow from '../../components/admin/dashboard/asesor/AsesorKpiRow';
import AsesorAttentionList from '../../components/admin/dashboard/asesor/AsesorAttentionList';
import AsesorAppointmentsCard from '../../components/admin/dashboard/asesor/AsesorAppointmentsCard';
import AsesorPipelineCard from '../../components/admin/dashboard/asesor/AsesorPipelineCard';
import AsesorActivityCard from '../../components/admin/dashboard/asesor/AsesorActivityCard';
import AsesorReportsSection from '../../components/admin/dashboard/asesor/AsesorReportsSection';
import { fadeIn } from '../../utils/animations';

// Dashboard personal del asesor de ventas — no es una copia del dashboard admin
// (DashboardPage.jsx): responde "¿cómo va mi cartera y qué debo atender hoy?" con datos
// acotados exclusivamente a los prospectos asignados a este usuario (ver
// GET /api/crm/my-dashboard, filtrado server-side por getLeadVisibilityWhere). Una sola
// llamada HTTP para toda la pantalla — no una cascada de requests por tarjeta.
export default function AsesorDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isCoordinador = user?.role === 'coordinador_ventas';

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['crm-my-dashboard'],
    queryFn: getMyCrmDashboard,
    refetchInterval: 60000,
  });
  const d = data?.data;

  if (isLoading) return <Spinner size="lg" className="py-20" />;

  if (isError) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          No se pudo cargar tu información. Intenta de nuevo.
        </p>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-900 text-white text-sm font-medium hover:bg-primary-800 transition-colors"
        >
          <RefreshCcw size={15} /> Reintentar
        </button>
      </div>
    );
  }

  const isEmpty =
    d.prospectosActivos === 0 &&
    d.citasHoy.length === 0 &&
    d.citasManana.length === 0 &&
    d.requierenAtencion.length === 0;

  return (
    <div>
      <motion.div
        variants={fadeIn}
        initial="hidden"
        animate="visible"
        className="mb-8 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Hola, {user?.name?.split(' ')[0] || 'asesor'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {isCoordinador
              ? 'Aquí tienes el resumen de la actividad comercial de tu equipo'
              : 'Aquí tienes el resumen de tu actividad comercial'}
          </p>
        </div>
        {isFetching && <Spinner size="sm" />}
      </motion.div>

      {isEmpty ? (
        <div className="bg-white dark:bg-[#242938] rounded-2xl p-10 shadow-sm border border-gray-100 dark:border-[#2e3650] text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {isCoordinador
              ? 'Tu equipo aún no tiene prospectos asignados. En cuanto les asignen uno, aparecerá aquí.'
              : 'Aún no tienes prospectos asignados. En cuanto te asignen uno, aparecerá aquí.'}
          </p>
        </div>
      ) : (
        <>
          <AsesorKpiRow d={d} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <AsesorAttentionList items={d.requierenAtencion} />
            <AsesorAppointmentsCard
              citasHoy={d.citasHoy}
              citasManana={d.citasManana}
              citasProximas7Dias={d.citasProximas7Dias}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <AsesorPipelineCard pipeline={d.pipeline} />
            <AsesorActivityCard
              actividadReciente={d.actividadReciente}
              propiedadesInteres={d.propiedadesInteres}
            />
          </div>

          <AsesorReportsSection reportes={d.reportes} />
        </>
      )}
    </div>
  );
}
