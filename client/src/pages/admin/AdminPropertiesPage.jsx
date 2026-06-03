import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Eye, Search, FileSpreadsheet, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { getProperties, deleteProperty, updateProperty } from '../../services/propertyService';
import Spinner from '../../components/ui/Spinner';
import useAuthStore from '../../store/authStore';
import { fadeIn, fadeInUp, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';

const cityLabel = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };
const statusColors = {
  disponible: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  apartado:   'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  vendido:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const formatPrice = (price) => {
  if (price === null || price === undefined || price === '') return 'PENDIENTE';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);
};

const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function AdminPropertiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token } = useAuthStore();
  const [search, setSearch]   = useState('');
  const [city, setCity]       = useState('');
  const [status, setStatus]   = useState('');
  const [page, setPage]       = useState(1);
  const [exporting, setExporting] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-properties', search, city, status, page],
    queryFn: () => getProperties({ search, city, status, page, limit: 15 }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProperty,
    onSuccess: () => { toast.success('Propiedad eliminada'); queryClient.invalidateQueries(['admin-properties']); },
    onError: () => toast.error('Error al eliminar'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }) => updateProperty(id, { status }),
    onSuccess: () => { toast.success('Estatus actualizado'); queryClient.invalidateQueries(['admin-properties']); },
  });

  const confirmDelete = (id, title) => {
    if (window.confirm(`¿Eliminar "${title}"?`)) deleteMutation.mutate(id);
  };

  const handleExport = async (format) => {
    try {
      setExporting(format);
      const params = new URLSearchParams();
      if (city)   params.set('city', city);
      if (status) params.set('status', status);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/export/${format}?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `triomphe-inventario-${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exportado a ${format === 'excel' ? 'Excel' : 'PDF'}`);
    } catch { toast.error('Error al exportar'); }
    finally { setExporting(null); }
  };

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Propiedades</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{data?.pagination?.total ?? 0} en total</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <motion.button whileHover={buttonHover} whileTap={buttonTap}
            onClick={() => handleExport('excel')} disabled={exporting === 'excel'}
            className="flex items-center gap-1.5 px-3 py-2 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-xl text-xs font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50">
            <FileSpreadsheet size={14} /> {exporting === 'excel' ? 'Generando...' : 'Excel'}
          </motion.button>
          <motion.button whileHover={buttonHover} whileTap={buttonTap}
            onClick={() => handleExport('pdf')} disabled={exporting === 'pdf'}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50">
            <FileText size={14} /> {exporting === 'pdf' ? 'Generando...' : 'PDF'}
          </motion.button>
          <motion.button whileHover={buttonHover} whileTap={buttonTap}
            onClick={() => navigate('/admin/propiedades/nueva')}
            className="flex items-center gap-1.5 bg-blue-900 dark:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-medium hover:bg-blue-700 transition-colors">
            <Plus size={16} /> Nueva propiedad
          </motion.button>
        </div>
      </motion.div>

      {/* Filtros */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2 flex-1 min-w-0 bg-white dark:bg-[#242938] border border-gray-200 dark:border-[#2e3650] rounded-xl px-3 py-2">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input type="text" placeholder="Buscar..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 min-w-0 text-sm focus:outline-none bg-transparent dark:text-gray-100 dark:placeholder-gray-500" />
        </div>
        {[
          { value: city,   onChange: setCity,   options: [['', 'Todas las ciudades'], ['juarez', 'Cd. Juárez'], ['chihuahua', 'Chihuahua'], ['queretaro', 'Querétaro']] },
          { value: status, onChange: setStatus, options: [['', 'Todos'], ['disponible', 'Disponible'], ['apartado', 'Apartado'], ['vendido', 'Vendido']] },
        ].map((sel, i) => (
          <select key={i} value={sel.value} onChange={(e) => { sel.onChange(e.target.value); setPage(1); }}
            className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none">
            {sel.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
      </motion.div>

      {/* Tabla */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] overflow-hidden">
        {isLoading ? <Spinner size="lg" className="py-16" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 dark:bg-[#1a1f2e] border-b border-gray-100 dark:border-[#2e3650]">
                <tr>
                  {['Propiedad', 'Ciudad', 'Precio', 'Estatus', 'Visitas', 'Fecha alta', 'Última modif.', 'Acciones'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <motion.tbody
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="divide-y divide-gray-50 dark:divide-[#2e3650]"
              >
                <AnimatePresence>
                  {data?.data?.map((property) => (
                    <motion.tr key={property.id}
                      variants={fadeInUp}
                      className="hover:bg-gray-50 dark:hover:bg-[#2e3650]/40 transition-colors">
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-gray-800 dark:text-gray-100 truncate">{property.title}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{property.type}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {cityLabel[property.city]}
                      </td>
                      <td className="px-4 py-3 font-semibold whitespace-nowrap"
                        style={{ color: property.price ? undefined : '#f59e0b' }}
                        className={property.price ? 'text-blue-900 dark:text-yellow-400' : 'text-yellow-500 dark:text-yellow-400'}>
                        {formatPrice(property.price)}
                      </td>
                      <td className="px-4 py-3">
                        <select value={property.status}
                          onChange={(e) => statusMutation.mutate({ id: property.id, status: e.target.value })}
                          className={`text-xs border-0 rounded-lg px-2 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 ${statusColors[property.status]}`}>
                          <option value="disponible">Disponible</option>
                          <option value="apartado">Apartado</option>
                          <option value="vendido">Vendido</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center">
                        {property.views ?? 0}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {formatDate(property.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                        {formatDate(property.updatedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {[
                            { icon: <Eye size={20} />,    color: 'hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20',     action: () => window.open(`/propiedades/${property.slug}`, '_blank') },
                            { icon: <Pencil size={20} />, color: 'hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20', action: () => navigate(`/admin/propiedades/${property.id}/editar`) },
                            { icon: <Trash2 size={20} />, color: 'hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',          action: () => confirmDelete(property.id, property.title) },
                          ].map(({ icon, color, action }, i) => (
                            <motion.button key={i} onClick={action}
                              whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }}
                              className={`p-1.5 text-gray-400 rounded-lg transition-colors ${color}`}>
                              {icon}
                            </motion.button>
                          ))}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </motion.tbody>
            </table>
            {data?.data?.length === 0 && (
              <motion.div variants={fadeIn} initial="hidden" animate="visible"
                className="text-center py-16 text-gray-400 dark:text-gray-500">
                No se encontraron propiedades
              </motion.div>
            )}
          </div>
        )}
        {data?.pagination?.totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t border-gray-100 dark:border-[#2e3650]">
            {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <motion.button key={p} onClick={() => setPage(p)}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                  page === p ? 'bg-blue-900 dark:bg-blue-700 text-white' : 'bg-gray-100 dark:bg-[#2e3650] text-gray-700 dark:text-gray-300'
                }`}>
                {p}
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}