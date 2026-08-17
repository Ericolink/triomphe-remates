import { useId, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Search, FileSpreadsheet, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  getWaitingList,
  createWaitingListEntry,
  updateWaitingListEntry,
  deleteWaitingListEntry,
} from '../../services/waitingListService';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import AdminFormModal from '../../components/ui/AdminFormModal';
import Pagination from '../../components/ui/Pagination';
import api from '../../services/api';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import { fadeIn, fadeInUp, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';
import { formatPrice, formatDate } from '../../utils/formatters';
import { CITY_LABELS, TYPE_LABELS, BUSINESS_LINE_LABELS, labelsToOptions } from '../../utils/constants';
import { downloadBlob } from '../../utils/download';

const EMPTY_FORM = {
  name: '',
  phone: '',
  email: '',
  city: '',
  state: '',
  businessLine: '',
  type: '',
  minPrice: '',
  maxPrice: '',
};

// Lista de espera de clientes esperando una propiedad a un precio específico — captura
// manual del staff, distinta de "Alertas de propiedad" (suscripción pública del sitio)
// aunque comparta modelo y motor de matching en el backend (ver PropertyAlert/alertService).
export default function WaitingListPage() {
  const queryClient = useQueryClient();
  const formId = useId();
  const [search, setSearch] = useState({ name: '', phone: '', state: '' });
  const debouncedSearch = useDebouncedValue(search, 300);
  const [city, setCity] = useState('');
  const [businessLine, setBusinessLine] = useState('');
  const [amount, setAmount] = useState('');
  const debouncedAmount = useDebouncedValue(amount, 300);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null); // null | 'create' | { entry }
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirm, setConfirm] = useState(null);
  const [exporting, setExporting] = useState(null);

  const queryParams = {
    page,
    limit: 20,
    city: city || undefined,
    businessLine: businessLine || undefined,
    amount: debouncedAmount || undefined,
    name: debouncedSearch.name || undefined,
    phone: debouncedSearch.phone || undefined,
    state: debouncedSearch.state || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['waiting-list', queryParams],
    queryFn: () => getWaitingList(queryParams),
  });

  const createMutation = useMutation({
    mutationFn: createWaitingListEntry,
    onSuccess: () => {
      toast.success('Cliente agregado a la lista de espera');
      queryClient.invalidateQueries(['waiting-list']);
      closeModal();
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Error al agregar'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data: body }) => updateWaitingListEntry(id, body),
    onSuccess: () => {
      toast.success('Registro actualizado');
      queryClient.invalidateQueries(['waiting-list']);
      closeModal();
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Error al actualizar'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWaitingListEntry,
    onSuccess: () => {
      toast.success('Registro eliminado');
      queryClient.invalidateQueries(['waiting-list']);
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Error al eliminar'),
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setModal('create');
  };
  const openEdit = (entry) => {
    setForm({
      name: entry.name,
      phone: entry.phone,
      email: entry.email || '',
      city: entry.city || '',
      state: entry.state || '',
      businessLine: entry.businessLine || '',
      type: entry.type || '',
      minPrice: entry.minPrice ?? '',
      maxPrice: entry.maxPrice ?? '',
    });
    setModal({ entry });
  };
  const closeModal = () => setModal(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const body = { ...form, email: form.email || undefined };
    if (modal === 'create') createMutation.mutate(body);
    else updateMutation.mutate({ id: modal.entry.id, data: body });
  };

  const confirmDelete = (entry) => {
    setConfirm({
      title: `¿Eliminar a "${entry.name}"?`,
      message: 'Esta acción no se puede deshacer.',
      onConfirm: () => {
        deleteMutation.mutate(entry.id);
        setConfirm(null);
      },
    });
  };

  const handleExport = async (format) => {
    try {
      setExporting(format);
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([k, v]) => {
        if (v !== undefined && k !== 'page' && k !== 'limit') params.set(k, v);
      });
      const response = await api.get(`/export/waiting-list/${format}?${params.toString()}`, {
        responseType: 'blob',
      });
      downloadBlob(
        response.data,
        `triomphe-lista-espera-${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      );
      toast.success(`Exportado a ${format === 'excel' ? 'Excel' : 'PDF'}`);
    } catch {
      toast.error('Error al exportar. Verifica tu conexión e intenta de nuevo.');
    } finally {
      setExporting(null);
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;
  const isEditing = modal && modal !== 'create';

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
      >
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Lista de espera
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            {data?.pagination?.total ?? 0} clientes esperando una propiedad
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <motion.button
            whileHover={buttonHover}
            whileTap={buttonTap}
            onClick={openCreate}
            className="flex items-center gap-1.5 bg-accent-400 dark:bg-accent-500 text-primary-900 px-4 py-2 rounded-xl text-xs font-medium hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors"
          >
            <Plus size={16} /> Nuevo
          </motion.button>
        </div>
      </motion.div>

      {/* Filtros */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-wrap gap-3 mb-6"
      >
        <div className="flex items-center gap-2 min-w-[180px] bg-white dark:bg-[#242938] border border-gray-200 dark:border-[#2e3650] rounded-xl px-3 py-2">
          <Search size={16} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Nombre..."
            value={search.name}
            onChange={(e) => {
              setSearch((s) => ({ ...s, name: e.target.value }));
              setPage(1);
            }}
            className="flex-1 min-w-0 text-sm focus:outline-none bg-transparent dark:text-gray-100 dark:placeholder-gray-500"
          />
        </div>
        <input
          type="text"
          placeholder="Teléfono..."
          value={search.phone}
          onChange={(e) => {
            setSearch((s) => ({ ...s, phone: e.target.value }));
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none w-36"
        />
        <input
          type="text"
          placeholder="Estado..."
          value={search.state}
          onChange={(e) => {
            setSearch((s) => ({ ...s, state: e.target.value }));
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none w-36"
        />
        <input
          type="number"
          placeholder="Monto..."
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none w-32"
        />
        <select
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
        >
          <option value="">Todas las ciudades</option>
          {labelsToOptions(CITY_LABELS, ['otra']).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={businessLine}
          onChange={(e) => {
            setBusinessLine(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none"
        >
          <option value="">Todas las líneas</option>
          {labelsToOptions(BUSINESS_LINE_LABELS).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-gray-50 dark:bg-[#1a1f2e] border-b border-gray-100 dark:border-[#2e3650]">
                <tr>
                  {['Nombre', 'Teléfono', 'Ciudad', 'Estado', 'Línea', 'Monto', 'Fecha', 'Acciones'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <motion.tbody
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="divide-y divide-gray-50 dark:divide-[#2e3650]"
              >
                <AnimatePresence>
                  {(data?.data ?? []).map((entry) => (
                    <motion.tr
                      key={entry.id}
                      variants={fadeInUp}
                      className="hover:bg-gray-50 dark:hover:bg-[#2e3650]/40 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                        {entry.name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{entry.phone}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {CITY_LABELS[entry.city] || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {entry.state || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {BUSINESS_LINE_LABELS[entry.businessLine] || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {entry.minPrice && entry.maxPrice
                          ? `${formatPrice(entry.minPrice)} – ${formatPrice(entry.maxPrice)}`
                          : entry.maxPrice
                            ? `Hasta ${formatPrice(entry.maxPrice)}`
                            : entry.minPrice
                              ? `Desde ${formatPrice(entry.minPrice)}`
                              : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(entry)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-[#2e3650] rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => confirmDelete(entry)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </motion.tbody>
            </table>
            {(data?.data ?? []).length === 0 && (
              <div className="text-center py-16 text-gray-400 dark:text-gray-500">
                <p>Nadie en la lista de espera todavía.</p>
              </div>
            )}
          </div>
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
        confirmLabel="Eliminar"
        danger
        onConfirm={confirm?.onConfirm}
        onCancel={() => setConfirm(null)}
      />

      <AdminFormModal
        open={Boolean(modal)}
        onClose={closeModal}
        title={isEditing ? 'Editar cliente' : 'Nuevo cliente en espera'}
        maxWidth="max-w-lg"
      >
        {modal && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor={`${formId}-name`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Nombre *
                </label>
                <input
                  id={`${formId}-name`}
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor={`${formId}-phone`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Teléfono *
                </label>
                <input
                  id={`${formId}-phone`}
                  type="text"
                  required
                  placeholder="6141234567"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor={`${formId}-email`}
                className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
              >
                Email (opcional)
              </label>
              <input
                id={`${formId}-email`}
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor={`${formId}-city`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Ciudad (opcional)
                </label>
                <select
                  id={`${formId}-city`}
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
                >
                  <option value="">Cualquiera</option>
                  {labelsToOptions(CITY_LABELS, ['otra']).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor={`${formId}-state`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Estado (opcional)
                </label>
                <input
                  id={`${formId}-state`}
                  type="text"
                  value={form.state}
                  onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor={`${formId}-businessLine`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Línea de negocio (opcional)
                </label>
                <select
                  id={`${formId}-businessLine`}
                  value={form.businessLine}
                  onChange={(e) => setForm({ ...form, businessLine: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
                >
                  <option value="">Cualquiera</option>
                  {labelsToOptions(BUSINESS_LINE_LABELS).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor={`${formId}-type`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Tipo (opcional)
                </label>
                <select
                  id={`${formId}-type`}
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
                >
                  <option value="">Cualquiera</option>
                  {labelsToOptions(TYPE_LABELS).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor={`${formId}-minPrice`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Monto mínimo (opcional)
                </label>
                <input
                  id={`${formId}-minPrice`}
                  type="number"
                  min="0"
                  value={form.minPrice}
                  onChange={(e) => setForm({ ...form, minPrice: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor={`${formId}-maxPrice`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Monto máximo (opcional)
                </label>
                <input
                  id={`${formId}-maxPrice`}
                  type="number"
                  min="0"
                  value={form.maxPrice}
                  onChange={(e) => setForm({ ...form, maxPrice: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="flex-1 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
              >
                Cancelar
              </button>
              <motion.button
                type="submit"
                disabled={isBusy}
                whileHover={buttonHover}
                whileTap={buttonTap}
                className="flex-1 py-2.5 bg-accent-400 dark:bg-accent-500 text-primary-900 rounded-xl text-sm font-medium hover:bg-accent-300 dark:hover:bg-accent-400 transition-colors disabled:opacity-50"
              >
                {isBusy ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Agregar'}
              </motion.button>
            </div>
          </form>
        )}
      </AdminFormModal>
    </motion.div>
  );
}
