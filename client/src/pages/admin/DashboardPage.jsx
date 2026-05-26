import { useQuery } from '@tanstack/react-query';
import { Building2, Users, Eye, TrendingUp, MapPin, Home } from 'lucide-react';
import { getDashboard } from '../../services/analyticsService';
import Spinner from '../../components/ui/Spinner';

const cityLabel = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };
const typeLabel = { casa: 'Casa', departamento: 'Depto.', terreno: 'Terreno', local: 'Local', bodega: 'Bodega' };

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboard,
    refetchInterval: 60000,
  });

  const d = data?.data;
  if (isLoading) return <Spinner size="lg" className="py-20" />;

  const stats = [
    { label: 'Total propiedades', value: d?.properties?.total ?? 0, icon: <Building2 size={22} />, color: 'bg-blue-900' },
    { label: 'Disponibles', value: d?.properties?.disponible ?? 0, icon: <Home size={22} />, color: 'bg-green-600' },
    { label: 'Leads nuevos', value: d?.leads?.new ?? 0, icon: <Users size={22} />, color: 'bg-yellow-500' },
    { label: 'Vistas (30 días)', value: d?.views?.last30Days ?? 0, icon: <Eye size={22} />, color: 'bg-purple-600' },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Dashboard</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Resumen general del sistema</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-[#2e3650]">
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white mb-3`}>
              {icon}
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
            <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-blue-700 dark:text-blue-400" /> Por ciudad
          </h2>
          <div className="space-y-3">
            {d?.byCity?.map(({ city, total }) => (
              <div key={city}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-300">{cityLabel[city] || city}</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{total}</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-[#2e3650] rounded-full overflow-hidden">
                  <div className="h-full bg-blue-900 dark:bg-blue-500 rounded-full"
                    style={{ width: `${(total / d.properties.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Home size={16} className="text-blue-700 dark:text-blue-400" /> Por tipo
          </h2>
          <div className="space-y-3">
            {d?.byType?.map(({ type, total }) => (
              <div key={type} className="flex justify-between items-center">
                <span className="text-sm text-gray-600 dark:text-gray-300">{typeLabel[type] || type}</span>
                <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-full">{total}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
          <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-700 dark:text-blue-400" /> Más visitadas
          </h2>
          <div className="space-y-3">
            {d?.topProperties?.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="w-6 h-6 bg-gray-100 dark:bg-[#2e3650] rounded-full flex items-center justify-center text-xs font-bold text-gray-500 dark:text-gray-400">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{cityLabel[p.city]}</p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <Eye size={12} /> {p.views}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650]">
        <h2 className="font-semibold text-gray-800 dark:text-gray-100 mb-4">Estatus del inventario</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Disponibles', value: d?.properties?.disponible, color: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400' },
            { label: 'Apartadas', value: d?.properties?.apartado, color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400' },
            { label: 'Vendidas', value: d?.properties?.vendido, color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl p-4 text-center ${color}`}>
              <p className="text-2xl font-bold">{value ?? 0}</p>
              <p className="text-sm font-medium mt-1">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
