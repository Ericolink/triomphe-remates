import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, Building2, Calendar, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { getLeads, updateLead, deleteLead } from '../../services/leadService';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';

const statusVariant = { nuevo: 'primary', contactado: 'warning', cerrado: 'success', descartado: 'default' };
const typeLabel = { contacto: 'Contacto', cita: 'Cita', informacion: 'Información' };

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['leads', status],
    queryFn: () => getLeads({ status, limit: 50 }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateLead(id, data),
    onSuccess: () => { toast.success('Lead actualizado'); queryClient.invalidateQueries(['leads']); },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => { toast.success('Lead eliminado'); setSelected(null); queryClient.invalidateQueries(['leads']); },
  });

  const formatDate = (date) =>
    date ? new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Leads</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{data?.pagination?.total ?? 0} contactos registrados</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none">
          <option value="">Todos</option>
          <option value="nuevo">Nuevos</option>
          <option value="contactado">Contactados</option>
          <option value="cerrado">Cerrados</option>
          <option value="descartado">Descartados</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista */}
        <div className="lg:col-span-2 space-y-3">
          {isLoading ? <Spinner size="lg" className="py-16" /> : data?.data?.map((lead) => (
            <div key={lead.id} onClick={() => setSelected(lead)}
              className={`bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border cursor-pointer transition-all hover:shadow-md ${
                selected?.id === lead.id
                  ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500 dark:ring-blue-400'
                  : 'border-gray-100 dark:border-[#2e3650]'
              }`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-gray-100">{lead.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(lead.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="default">{typeLabel[lead.type]}</Badge>
                  <Badge variant={statusVariant[lead.status]}>{lead.status}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Mail size={12} /> {lead.email}</span>
                {lead.phone && <span className="flex items-center gap-1"><Phone size={12} /> {lead.phone}</span>}
                {lead.property && <span className="flex items-center gap-1"><Building2 size={12} /> {lead.property.title}</span>}
              </div>
              {lead.message && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 line-clamp-2">{lead.message}</p>}
            </div>
          ))}
          {!isLoading && data?.data?.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-gray-500">No hay leads con este filtro</div>
          )}
        </div>

        {/* Detalle */}
        <div className="lg:col-span-1">
          {selected ? (
            <div className="bg-white dark:bg-[#242938] rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-[#2e3650] sticky top-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-800 dark:text-gray-100">Detalle del lead</h2>
                <button onClick={() => { if (window.confirm('¿Eliminar este lead?')) deleteMutation.mutate(selected.id); }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-3 mb-6 text-sm">
                {[
                  { label: 'Nombre', value: selected.name },
                  { label: 'Email', value: selected.email },
                  { label: 'Teléfono', value: selected.phone },
                  { label: 'Propiedad', value: selected.property?.title },
                ].filter(({ value }) => value).map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
                    <p className="font-medium text-gray-800 dark:text-gray-100">{value}</p>
                  </div>
                ))}
                {selected.appointmentDate && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Cita solicitada</p>
                    <p className="flex items-center gap-1 text-gray-800 dark:text-gray-100">
                      <Calendar size={12} />{formatDate(selected.appointmentDate)}
                    </p>
                  </div>
                )}
                {selected.message && (
                  <div>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Mensaje</p>
                    <p className="text-gray-600 dark:text-gray-300">{selected.message}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estatus</label>
                  <select value={selected.status}
                    onChange={(e) => {
                      updateMutation.mutate({ id: selected.id, data: { status: e.target.value } });
                      setSelected((s) => ({ ...s, status: e.target.value }));
                    }}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none">
                    <option value="nuevo">Nuevo</option>
                    <option value="contactado">Contactado</option>
                    <option value="cerrado">Cerrado</option>
                    <option value="descartado">Descartado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notas internas</label>
                  <textarea
                    defaultValue={selected.notes || ''}
                    onBlur={(e) => updateMutation.mutate({ id: selected.id, data: { notes: e.target.value } })}
                    rows={3}
                    placeholder="Agrega notas sobre este lead..."
                    className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#242938] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-[#2e3650] text-center text-gray-400 dark:text-gray-500">
              <Mail size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Selecciona un lead para ver el detalle</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
