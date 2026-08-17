import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Eye, Search, FileSpreadsheet, FileText, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getProperties,
  deleteProperty,
  updateProperty,
  promoteProperty,
} from '../../services/propertyService';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Pagination from '../../components/ui/Pagination';
import api from '../../services/api';
import { fadeIn, fadeInUp, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';
import { formatPrice, formatDate } from '../../utils/formatters';
import Badge from '../../components/ui/Badge';
import {
  CITY_LABELS,
  CATEGORY_LABELS,
  STATUS_LABELS,
  STATUS_SELECT_COLORS,
  BUSINESS_LINE_LABELS,
  BUSINESS_LINE_VARIANTS,
  labelsToOptions,
} from '../../utils/constants';
import { downloadBlob } from '../../utils/download';
import useAuthStore from '../../store/authStore';
import { canManageInventory, canExportInventory, isAdmin } from '../../utils/permissions';

// Versión mobile/tablet-angosto (<lg) de una fila de la tabla — mismos datos, reorganizados
// verticalmente en vez de en 9 columnas que forzaban scroll horizontal. Recibe handlers ya
// resueltos (en vez de mutations crudas) para no duplicar la lógica de negocio de
// AdminPropertiesPage, solo la presentación.
function AdminPropertyCardRow({
  property,
  canManage,
  canDelete,
  promotePending,
  onStatusChange,
  onPromote,
  onView,
  onEdit,
  onDelete,
}) {
  return (
    <motion.div variants={fadeInUp} className="p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
            {property.title}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
            {property.type}
            {property.code ? ` · ${property.code}` : ''}
          </p>
        </div>
        <motion.button
          type="button"
          onClick={canManage ? onPromote : undefined}
          disabled={!canManage || promotePending}
          whileHover={canManage ? { scale: 1.2 } : undefined}
          whileTap={canManage ? { scale: 0.85 } : undefined}
          title={
            canManage
              ? property.isPromoted
                ? 'Quitar promoción'
                : 'Promover como estrella'
              : undefined
          }
          className={`flex-shrink-0 p-1.5 -m-1.5 rounded-lg transition-colors ${canManage ? 'hover:bg-accent-50 dark:hover:bg-accent-900/20' : ''}`}
        >
          <Star
            size={18}
            className={
              property.isPromoted ? 'text-accent-400 fill-accent-400' : 'text-gray-300 dark:text-gray-600'
            }
          />
        </motion.button>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3 text-xs text-gray-500 dark:text-gray-400">
        <Badge variant={BUSINESS_LINE_VARIANTS[property.businessLine]}>
          {BUSINESS_LINE_LABELS[property.businessLine] || property.businessLine}
        </Badge>
        <span>{CITY_LABELS[property.city]}</span>
        <span>· {property.views ?? 0} visitas</span>
        <span title={`Alta: ${formatDate(property.createdAt)}`}>
          · Act. {formatDate(property.updatedAt)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p
          className={`font-semibold ${property.price ? 'text-primary-900 dark:text-accent-400' : 'text-yellow-500 dark:text-yellow-400'}`}
        >
          {formatPrice(property.price)}
        </p>
        {canManage ? (
          <select
            value={property.status}
            onChange={(e) => onStatusChange(e.target.value)}
            className={`text-xs border-0 rounded-lg px-2 py-1.5 font-medium focus:outline-none focus:ring-2 focus:ring-accent-400 ${STATUS_SELECT_COLORS[property.status]}`}
          >
            {labelsToOptions(STATUS_LABELS).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <span
            className={`text-xs rounded-lg px-2 py-1.5 font-medium ${STATUS_SELECT_COLORS[property.status]}`}
          >
            {STATUS_LABELS[property.status]}
          </span>
        )}
      </div>

      <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-gray-50 dark:border-[#2e3650]">
        <motion.button
          onClick={onView}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          title="Ver en el sitio público"
          className="p-2 text-gray-400 rounded-lg transition-colors hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
        >
          <Eye size={20} />
        </motion.button>
        {canManage && (
          <motion.button
            onClick={onEdit}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            title="Editar"
            className="p-2 text-gray-400 rounded-lg transition-colors hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-[#2e3650]"
          >
            <Pencil size={20} />
          </motion.button>
        )}
        {canDelete && (
          <motion.button
            onClick={onDelete}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            title="Eliminar"
            className="p-2 text-gray-400 rounded-lg transition-colors hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            <Trash2 size={20} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export default function AdminPropertiesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const canManage = canManageInventory(user);
  const canExport = canExportInventory(user);
  const canDelete = isAdmin(user);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [category, setCategory] = useState('');
  const [businessLine, setBusinessLine] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-properties', search, city, category, businessLine, page],
    queryFn: () => getProperties({ search, city, category, businessLine, page, limit: 15 }),
  });

  // Selector combinado "Línea": línea de negocio (remate/infonavit) y categoría
  // (remate/renta/compra_venta, subclasificación solo dentro de la línea remate — ver
  // BUSINESS_LINE_LABELS/CATEGORY_LABELS en utils/constants.js) viven en dos campos
  // distintos del modelo, pero antes se filtraban desde dos <select> separados. Se
  // unificaron en uno solo (a pedido, para no ocupar dos filas en mobile); el prefijo
  // bl:/cat: en el value de cada <option> es lo único que distingue a qué estado real
  // escribir, ya que ambos comparten el valor "remate" con significados distintos.
  const lineFilterValue = businessLine ? `bl:${businessLine}` : category ? `cat:${category}` : '';
  const handleLineFilterChange = (raw) => {
    if (raw.startsWith('bl:')) {
      setBusinessLine(raw.slice(3));
      setCategory('');
    } else if (raw.startsWith('cat:')) {
      setCategory(raw.slice(4));
      setBusinessLine('');
    } else {
      setBusinessLine('');
      setCategory('');
    }
    setPage(1);
  };

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

  const promoteMutation = useMutation({
    mutationFn: (id) => promoteProperty(id),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries(['admin-properties']);
      queryClient.invalidateQueries(['property', 'promoted']);
    },
    onError: () => toast.error('Error al cambiar promoción'),
  });

  const confirmDelete = (id, title) => {
    setConfirm({
      title: `¿Eliminar "${title}"?`,
      message: 'La propiedad y sus imágenes serán eliminadas permanentemente.',
      onConfirm: () => {
        deleteMutation.mutate(id);
        setConfirm(null);
      },
    });
  };

  // Marcar "vendido" es un cambio de negocio poco frecuente y difícil de deshacer por
  // error (a diferencia de disponible ↔ apartado, que son ajustes rutinarios) — pide
  // confirmación solo para esta transición.
  const handleStatusChange = (property, newStatus) => {
    if (newStatus === 'vendido' && property.status !== 'vendido') {
      setConfirm({
        title: `¿Marcar "${property.title}" como vendida?`,
        message: 'Dejará de mostrarse como disponible en el sitio público.',
        confirmLabel: 'Marcar como vendida',
        danger: false,
        onConfirm: () => {
          statusMutation.mutate({ id: property.id, status: newStatus });
          setConfirm(null);
        },
      });
    } else {
      statusMutation.mutate({ id: property.id, status: newStatus });
    }
  };

  const handleExport = async (format) => {
    try {
      setExporting(format);
      const params = new URLSearchParams();
      if (city) params.set('city', city);
      if (category) params.set('category', category);
      if (businessLine) params.set('businessLine', businessLine);
      const response = await api.get(`/export/${format}?${params.toString()}`, {
        responseType: 'blob',
      });
      downloadBlob(
        response.data,
        `triomphe-inventario-${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      );
      toast.success(`Exportado a ${format === 'excel' ? 'Excel' : 'PDF'}`);
    } catch (err) {
      let msg = 'Error al exportar. Verifica tu conexión e intenta de nuevo.';
      if (err.response?.data instanceof Blob) {
        try {
          const body = JSON.parse(await err.response.data.text());
          if (body?.error) msg = body.error;
        } catch {
          /* respuesta no era JSON */
        }
      }
      toast.error(msg);
    } finally {
      setExporting(null);
    }
  };

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      {/* Header */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Propiedades</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {data?.pagination?.total ?? 0} en total
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canExport && (
            <div className="flex gap-2 mr-2">
              <motion.button
                whileHover={buttonHover}
                whileTap={buttonTap}
                onClick={() => handleExport('excel')}
                disabled={exporting === 'excel'}
                className="flex items-center gap-1.5 px-3 py-2 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-xl text-xs font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet size={14} /> {exporting === 'excel' ? 'Generando...' : 'Excel'}
              </motion.button>
              <motion.button
                whileHover={buttonHover}
                whileTap={buttonTap}
                onClick={() => handleExport('pdf')}
                disabled={exporting === 'pdf'}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-xl text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
              >
                <FileText size={14} /> {exporting === 'pdf' ? 'Generando...' : 'PDF'}
              </motion.button>
            </div>
          )}
          {canManage && (
            <motion.button
              whileHover={buttonHover}
              whileTap={buttonTap}
              onClick={() => navigate('/admin/propiedades/nueva')}
              className="flex items-center gap-1.5 bg-accent-400 dark:bg-accent-500 text-primary-900 px-4 py-2 rounded-xl text-xs font-medium hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors"
            >
              <Plus size={16} /> Nueva propiedad
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Filtros — buscador en su propia fila con más peso visual (es la acción principal
          de esta sección), ciudad/línea en una fila compacta de 2 columnas debajo. */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-6">
        <div className="flex items-center gap-2.5 bg-white dark:bg-[#242938] border-2 border-gray-200 dark:border-[#2e3650] focus-within:border-accent-400 dark:focus-within:border-accent-500 rounded-xl px-4 py-3 mb-3 shadow-sm transition-colors">
          <Search size={20} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="flex-1 min-w-0 text-base focus:outline-none bg-transparent dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <select
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setPage(1);
            }}
            className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
          >
            {[{ value: '', label: 'Todas las ciudades' }, ...labelsToOptions(CITY_LABELS, ['otra'])].map(
              (o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              )
            )}
          </select>

          <select
            value={lineFilterValue}
            onChange={(e) => handleLineFilterChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
          >
            <option value="">Todas las líneas</option>
            <optgroup label="Línea de negocio">
              {labelsToOptions(BUSINESS_LINE_LABELS).map((o) => (
                <option key={`bl:${o.value}`} value={`bl:${o.value}`}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Categoría (dentro de Remates)">
              {labelsToOptions(CATEGORY_LABELS).map((o) => (
                <option key={`cat:${o.value}`} value={`cat:${o.value}`}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </motion.div>

      {/* Tabla */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] overflow-hidden"
      >
        {isLoading ? (
          <Spinner size="lg" className="py-16" />
        ) : (
          <>
          {/* Tabla — desde lg (1024px). Antes de eso, 9 columnas no caben sin scroll
              horizontal (min-w-[900px] forzaba ese scroll incluso en tablet); en mobile
              se usa la lista de tarjetas de abajo con la misma información reorganizada
              verticalmente en vez de recortada en columnas. */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 dark:bg-[#1a1f2e] border-b border-gray-100 dark:border-[#2e3650]">
                <tr>
                  {[
                    'Propiedad',
                    'Línea',
                    'Ciudad',
                    'Precio',
                    'Estatus',
                    'Visitas',
                    'Actualizado',
                    'Destacada',
                    'Acciones',
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
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
                    <motion.tr
                      key={property.id}
                      variants={fadeInUp}
                      className="hover:bg-gray-50 dark:hover:bg-[#2e3650]/40 transition-colors"
                    >
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-gray-800 dark:text-gray-100 truncate">
                          {property.title}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                          {property.type}
                          {property.code ? ` · ${property.code}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={BUSINESS_LINE_VARIANTS[property.businessLine]}>
                          {BUSINESS_LINE_LABELS[property.businessLine] || property.businessLine}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {CITY_LABELS[property.city]}
                      </td>
                      <td
                        className={`px-4 py-3 font-semibold whitespace-nowrap ${
                          property.price
                            ? 'text-primary-900 dark:text-accent-400'
                            : 'text-yellow-500 dark:text-yellow-400'
                        }`}
                      >
                        {formatPrice(property.price)}
                      </td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <select
                            value={property.status}
                            onChange={(e) => handleStatusChange(property, e.target.value)}
                            className={`text-xs border-0 rounded-lg px-2 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-accent-400 ${STATUS_SELECT_COLORS[property.status]}`}
                          >
                            {labelsToOptions(STATUS_LABELS).map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            className={`text-xs rounded-lg px-2 py-1 font-medium ${STATUS_SELECT_COLORS[property.status]}`}
                          >
                            {STATUS_LABELS[property.status]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-center">
                        {property.views ?? 0}
                      </td>
                      <td
                        className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs"
                        title={`Alta: ${formatDate(property.createdAt)}`}
                      >
                        {formatDate(property.updatedAt)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {canManage ? (
                          <motion.button
                            onClick={() => promoteMutation.mutate(property.id)}
                            disabled={promoteMutation.isPending}
                            whileHover={{ scale: 1.2 }}
                            whileTap={{ scale: 0.85 }}
                            title={
                              property.isPromoted ? 'Quitar promoción' : 'Promover como estrella'
                            }
                            className="p-1.5 rounded-lg transition-colors hover:bg-accent-50 dark:hover:bg-accent-900/20 disabled:opacity-50"
                          >
                            <Star
                              size={18}
                              className={
                                property.isPromoted
                                  ? 'text-accent-400 fill-accent-400'
                                  : 'text-gray-300 dark:text-gray-600'
                              }
                            />
                          </motion.button>
                        ) : (
                          <Star
                            size={18}
                            className={
                              property.isPromoted
                                ? 'text-accent-400 fill-accent-400 mx-auto'
                                : 'text-gray-300 dark:text-gray-600 mx-auto'
                            }
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {[
                            {
                              icon: <Eye size={20} />,
                              color:
                                'hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20',
                              action: () => window.open(`/propiedades/${property.slug}`, '_blank'),
                            },
                            ...(canManage
                              ? [
                                  {
                                    icon: <Pencil size={20} />,
                                    color:
                                      'hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-[#2e3650]',
                                    action: () =>
                                      navigate(`/admin/propiedades/${property.id}/editar`),
                                  },
                                ]
                              : []),
                            ...(canDelete
                              ? [
                                  {
                                    icon: <Trash2 size={20} />,
                                    color:
                                      'hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20',
                                    action: () => confirmDelete(property.id, property.title),
                                  },
                                ]
                              : []),
                          ].map(({ icon, color, action }, i) => (
                            <motion.button
                              key={i}
                              onClick={action}
                              whileHover={{ scale: 1.15 }}
                              whileTap={{ scale: 0.9 }}
                              className={`p-1.5 text-gray-400 rounded-lg transition-colors ${color}`}
                            >
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
          </div>

          {/* Tarjetas — hasta lg (1024px). Misma info que la tabla, reorganizada: título
              arriba, línea/ciudad/visitas/actualizado en una fila secundaria compacta,
              precio + estatus en su propia fila, acciones al final separadas por borde
              (mismo patrón que PropertyCard.jsx en el sitio público). */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="lg:hidden divide-y divide-gray-50 dark:divide-[#2e3650]"
          >
            <AnimatePresence>
              {data?.data?.map((property) => (
                <AdminPropertyCardRow
                  key={property.id}
                  property={property}
                  canManage={canManage}
                  canDelete={canDelete}
                  promotePending={promoteMutation.isPending}
                  onStatusChange={(status) => handleStatusChange(property, status)}
                  onPromote={() => promoteMutation.mutate(property.id)}
                  onView={() => window.open(`/propiedades/${property.slug}`, '_blank')}
                  onEdit={() => navigate(`/admin/propiedades/${property.id}/editar`)}
                  onDelete={() => confirmDelete(property.id, property.title)}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          {data?.data?.length === 0 && (
            <motion.div
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              className="text-center py-16 text-gray-400 dark:text-gray-500"
            >
              {search || city || category || businessLine ? (
                <>
                  <p>Ningún resultado coincide con los filtros actuales.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setCity('');
                      setCategory('');
                      setBusinessLine('');
                      setPage(1);
                    }}
                    className="mt-2 text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                  >
                    Quitar filtros
                  </button>
                </>
              ) : (
                <>
                  <p>Todavía no hay propiedades cargadas.</p>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => navigate('/admin/propiedades/nueva')}
                      className="mt-2 text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    >
                      Crear la primera propiedad
                    </button>
                  )}
                </>
              )}
            </motion.div>
          )}
          </>
        )}
        <Pagination
          pagination={data?.pagination}
          page={page}
          onPageChange={setPage}
          className="p-4 border-t border-gray-100 dark:border-[#2e3650]"
        />
      </motion.div>
      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel || 'Eliminar'}
        danger={confirm?.danger ?? true}
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </motion.div>
  );
}
