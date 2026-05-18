import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Eye, Search, FileSpreadsheet, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { getProperties, deleteProperty, updateProperty } from '../../services/propertyService';
import Spinner from '../../components/ui/Spinner';
import useAuthStore from '../../store/authStore';

const cityLabel = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };

export default function AdminPropertiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-properties', search, city, status, page],
    queryFn: () => getProperties({ search, city, status, page, limit: 15 }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProperty,
    onSuccess: () => {
      toast.success('Propiedad eliminada');
      queryClient.invalidateQueries(['admin-properties']);
    },
    onError: () => toast.error('Error al eliminar'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateProperty(id, { status }),
    onSuccess: () => {
      toast.success('Estatus actualizado');
      queryClient.invalidateQueries(['admin-properties']);
    },
  });

  const confirmDelete = (id, title) => {
    if (window.confirm(`¿Eliminar "${title}"? Esta acción no se puede deshacer.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleExport = async (format) => {
    try {
      setExporting(format);
      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (status) params.set('status', status);
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/export/${format}?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `triomphe-inventario-${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Inventario exportado a ${format === 'excel' ? 'Excel' : 'PDF'}`);
    } catch {
      toast.error('Error al exportar');
    } finally {
      setExporting(null);
    }
  };

  const formatPrice = (price) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Propiedades</h1>
          <p className="text-gray-500 text-sm mt-1">{data?.pagination?.total ?? 0} propiedades en total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting === 'excel'}
            className="flex items-center gap-2 px-3 py-2.5 border border-green-200 text-green-700 rounded-xl text-sm font-medium hover:bg-green-50 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet size={16} />
            {exporting === 'excel' ? 'Generando...' : 'Excel'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting === 'pdf'}
            className="flex items-center gap-2 px-3 py-2.5 border border-red-200 text-red-700 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            <FileText size={16} />
            {exporting === 'pdf' ? 'Generando...' : 'PDF'}
          </button>
          <button
            onClick={() => navigate('/admin/propiedades/nueva')}
            className="flex items-center gap-2 bg-blue-900 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} /> Nueva propiedad
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 flex-1 min-w-48 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 text-sm focus:outline-none"
          />
        </div>
        <select value={city} onChange={(e) => { setCity(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
          <option value="">Todas las ciudades</option>
          <option value="juarez">Cd. Juárez</option>
          <option value="chihuahua">Chihuahua</option>
          <option value="queretaro">Querétaro</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none">
          <option value="">Todos los estatus</option>
          <option value="disponible">Disponible</option>
          <option value="apartado">Apartado</option>
          <option value="vendido">Vendido</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <Spinner size="lg" className="py-16" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Propiedad', 'Ciudad', 'Precio', 'Estatus', 'Vistas', 'Acciones'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data?.data?.map((property) => (
                  <tr key={property.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800 line-clamp-1 max-w-xs">{property.title}</p>
                      <p className="text-xs text-gray-400 capitalize">{property.type}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cityLabel[property.city]}</td>
                    <td className="px-4 py-3 font-semibold text-blue-900">{formatPrice(property.price)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={property.status}
                        onChange={(e) => statusMutation.mutate({ id: property.id, status: e.target.value })}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none bg-white"
                      >
                        <option value="disponible">Disponible</option>
                        <option value="apartado">Apartado</option>
                        <option value="vendido">Vendido</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{property.views}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => window.open(`/propiedades/${property.slug}`, '_blank')}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/propiedades/${property.id}/editar`)}
                          className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => confirmDelete(property.id, property.title)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data?.data?.length === 0 && (
              <div className="text-center py-16 text-gray-400">
                <p>No se encontraron propiedades</p>
              </div>
            )}
          </div>
        )}
        {data?.pagination?.totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-100">
            {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                  page === p ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}