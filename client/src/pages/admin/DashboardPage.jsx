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
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Resumen general del sistema</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center text-white mb-3`}>
              {icon}
            </div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-gray-500 text-xs mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Por ciudad */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <MapPin size={16} className="text-blue-700" /> Propiedades por ciudad
          </h2>
          <div className="space-y-3">
            {d?.byCity?.map(({ city, total }) => (
              <div key={city}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{cityLabel[city] || city}</span>
                  <span className="font-semibold">{total}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-900 rounded-full"
                    style={{ width: `${(total / d.properties.total) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Por tipo */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Home size={16} className="text-blue-700" /> Por tipo de propiedad
          </h2>
          <div className="space-y-3">
            {d?.byType?.map(({ type, total }) => (
              <div key={type} className="flex justify-between items-center">
                <span className="text-sm text-gray-600">{typeLabel[type] || type}</span>
                <span className="bg-blue-50 text-blue-900 text-xs font-semibold px-2.5 py-1 rounded-full">{total}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top propiedades */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-blue-700" /> Más visitadas
          </h2>
          <div className="space-y-3">
            {d?.topProperties?.map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-500">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{p.title}</p>
                  <p className="text-xs text-gray-400">{cityLabel[p.city]}</p>
                </div>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Eye size={12} /> {p.views}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Estatus */}
      <div className="mt-6 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 mb-4">Estatus del inventario</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Disponibles', value: d?.properties?.disponible, color: 'text-green-600 bg-green-50' },
            { label: 'Apartadas', value: d?.properties?.apartado, color: 'text-yellow-600 bg-yellow-50' },
            { label: 'Vendidas', value: d?.properties?.vendido, color: 'text-red-600 bg-red-50' },
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
// componente ya actualizado — el badge viene del NotificationBell en el header
