import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mail, Phone, Building2, Calendar, Trash2, FileSpreadsheet, LayoutList, Columns } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { getLeads, updateLead, deleteLead, batchUpdateLeads, batchDeleteLeads, getLeadNotes, addLeadNote, deleteLeadNote } from '../../services/leadService';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import BatchActionBar from '../../components/ui/BatchActionBar';
import { fadeIn, fadeInUp, fadeInRight, staggerContainer } from '../../utils/animations';
import { formatDate, formatDateTime } from '../../utils/formatters';
import { SOURCE_LABELS, SOURCE_COLORS } from '../../utils/constants';

const statusVariant = { nuevo: 'primary', contactado: 'warning', cerrado: 'success', descartado: 'default' };
const typeLabel = { contacto: 'Contacto', cita: 'Cita', informacion: 'Información' };
const LEAD_STATUS_OPTIONS = [
  { value: 'contactado', label: 'Contactado' },
  { value: 'cerrado',    label: 'Cerrado' },
  { value: 'descartado', label: 'Descartado' },
];

const KANBAN_COLUMNS = [
  { key: 'nuevo',      label: 'Nuevos',      color: 'border-blue-400',   headerBg: 'bg-blue-50 dark:bg-blue-900/20',   dot: 'bg-blue-500' },
  { key: 'contactado', label: 'Contactados', color: 'border-yellow-400', headerBg: 'bg-yellow-50 dark:bg-yellow-900/20', dot: 'bg-yellow-500' },
  { key: 'cerrado',    label: 'Cerrados',    color: 'border-green-400',  headerBg: 'bg-green-50 dark:bg-green-900/20',  dot: 'bg-green-500' },
  { key: 'descartado', label: 'Descartados', color: 'border-gray-300 dark:border-gray-600',   headerBg: 'bg-gray-50 dark:bg-[#2e3650]',    dot: 'bg-gray-400' },
];

function LeadDetailPanel({ selected, onClose, updateMutation }) {
  const queryClient = useQueryClient();
  const [noteText, setNoteText] = useState('');

  const { data: notesData, isLoading: notesLoading } = useQuery({
    queryKey: ['lead-notes', selected?.id],
    queryFn: () => getLeadNotes(selected.id),
    enabled: !!selected?.id,
  });
  const notes = notesData?.data ?? [];

  const addNoteMutation = useMutation({
    mutationFn: ({ id, content }) => addLeadNote(id, content),
    onSuccess: () => {
      setNoteText('');
      queryClient.invalidateQueries(['lead-notes', selected.id]);
    },
    onError: () => toast.error('Error al guardar nota'),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: ({ leadId, noteId }) => deleteLeadNote(leadId, noteId),
    onSuccess: () => queryClient.invalidateQueries(['lead-notes', selected.id]),
  });

  const handleAddNote = () => {
    const content = noteText.trim();
    if (!content) return;
    addNoteMutation.mutate({ id: selected.id, content });
  };

  return (
    <motion.div key={selected.id} variants={fadeInRight} initial="hidden" animate="visible" exit={{ opacity: 0, x: 20 }}
      className="bg-white dark:bg-[#242938] rounded-2xl shadow-sm border border-gray-100 dark:border-[#2e3650] sticky top-6 overflow-y-auto max-h-[calc(100vh-120px)]">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 dark:text-gray-100">Detalle del lead</h2>
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
            <Trash2 size={20} />
          </motion.button>
        </div>
        <div className="space-y-3 mb-5 text-sm">
          {[{ label: 'Nombre', value: selected.name }, { label: 'Email', value: selected.email }, { label: 'Teléfono', value: selected.phone }, { label: 'Propiedad', value: selected.property?.title }]
            .filter(({ value }) => value).map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
              <p className="font-medium text-gray-800 dark:text-gray-100">{value}</p>
            </div>
          ))}
          {selected.appointmentDate && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Cita solicitada</p>
              <p className="flex items-center gap-1 text-gray-800 dark:text-gray-100"><Calendar size={12} />{formatDate(selected.appointmentDate)}</p>
            </div>
          )}
          {selected.message && (
            <div>
              <p className="text-xs text-gray-400 dark:text-gray-500">Mensaje</p>
              <p className="text-gray-600 dark:text-gray-300 text-xs leading-relaxed">{selected.message}</p>
            </div>
          )}
        </div>
        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Estatus</label>
            <select value={selected.status}
              onChange={(e) => { updateMutation.mutate({ id: selected.id, data: { status: e.target.value } }); }}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none">
              <option value="nuevo">Nuevo</option>
              <option value="contactado">Contactado</option>
              <option value="cerrado">Cerrado</option>
              <option value="descartado">Descartado</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fuente</label>
            <select value={selected.source || 'directo'}
              onChange={(e) => { updateMutation.mutate({ id: selected.id, data: { source: e.target.value } }); }}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] dark:text-gray-100 focus:outline-none">
              {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Notas rápidas</label>
            <textarea defaultValue={selected.notes || ''} onBlur={(e) => updateMutation.mutate({ id: selected.id, data: { notes: e.target.value } })}
              rows={2} placeholder="Nota rápida..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500" />
          </div>
        </div>

        {/* Seguimiento / historial de notas */}
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Seguimiento</p>
          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto pr-1">
            {notesLoading ? <Spinner size="sm" className="py-2" /> : notes.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">Sin notas de seguimiento aún.</p>
            ) : notes.map((note) => (
              <div key={note.id} className="group bg-gray-50 dark:bg-[#1a1f2e] rounded-lg px-3 py-2 text-xs relative">
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{note.content}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-gray-400">{formatDateTime(note.createdAt)}</span>
                  <button onClick={() => deleteNoteMutation.mutate({ leadId: selected.id, noteId: note.id })}
                    className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={noteText} onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddNote()}
              placeholder="Agregar nota..."
              className="flex-1 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-gray-100 dark:placeholder-gray-500" />
            <button onClick={handleAddNote} disabled={!noteText.trim() || addNoteMutation.isPending}
              className="px-3 py-2 bg-blue-600 text-white rounded-xl text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors">
              +
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function KanbanBoard({ leads, onSelect, updateMutation }) {
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const handleDragStart = (e, lead) => {
    setDragging(lead);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(colKey);
  };

  const handleDrop = (e, colKey) => {
    e.preventDefault();
    setDragOver(null);
    if (dragging && dragging.status !== colKey) {
      updateMutation.mutate({ id: dragging.id, data: { status: colKey } });
    }
    setDragging(null);
  };

  const handleDragEnd = () => { setDragging(null); setDragOver(null); };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((col) => {
        const colLeads = leads.filter((l) => l.status === col.key);
        const isOver = dragOver === col.key;
        return (
          <div key={col.key}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDrop={(e) => handleDrop(e, col.key)}
            onDragLeave={() => setDragOver(null)}
            className={`rounded-2xl border-2 transition-colors min-h-[200px] ${col.color} ${isOver ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-gray-50/60 dark:bg-[#1a1f2e]/60'}`}>
            <div className={`px-4 py-3 rounded-t-xl flex items-center gap-2 ${col.headerBg}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${col.dot}`} />
              <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">{col.label}</span>
              <span className="ml-auto text-xs bg-white dark:bg-[#242938] text-gray-500 rounded-full px-2 py-0.5 font-medium">
                {colLeads.length}
              </span>
            </div>
            <div className="p-3 space-y-2">
              {colLeads.map((lead) => (
                <div key={lead.id} draggable
                  onDragStart={(e) => handleDragStart(e, lead)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onSelect(lead)}
                  className={`bg-white dark:bg-[#242938] rounded-xl p-3 shadow-sm border border-gray-100 dark:border-[#2e3650] cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow select-none ${dragging?.id === lead.id ? 'opacity-40' : ''}`}>
                  <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">{lead.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{lead.email}</p>
                  {lead.property && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 truncate">
                      <Building2 size={10} /> {lead.property.title}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">{formatDate(lead.createdAt)}</span>
                    <Badge variant="default" className="text-xs">{typeLabel[lead.type]}</Badge>
                  </div>
                </div>
              ))}
              {colLeads.length === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 italic">Sin leads</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [checked, setChecked] = useState([]);
  const [view, setView] = useState('list');

  const { data, isLoading } = useQuery({
    queryKey: ['leads', status],
    queryFn: () => getLeads({ status, limit: 100 }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateLead(id, data),
    onSuccess: (res, { data: updated }) => {
      toast.success('Lead actualizado');
      queryClient.invalidateQueries(['leads']);
      if (updated.status) setSelected((s) => s ? { ...s, status: updated.status } : s);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLead,
    onSuccess: () => { toast.success('Lead eliminado'); setSelected(null); queryClient.invalidateQueries(['leads']); },
  });

  const batchStatusMutation = useMutation({
    mutationFn: ({ ids, status: s }) => batchUpdateLeads(ids, s),
    onSuccess: (_, { ids }) => { toast.success(`${ids.length} lead(s) actualizados`); setChecked([]); queryClient.invalidateQueries(['leads']); },
  });

  const batchDeleteMutation = useMutation({
    mutationFn: batchDeleteLeads,
    onSuccess: (_, ids) => { toast.success(`${ids.length} lead(s) eliminados`); setChecked([]); setSelected(null); queryClient.invalidateQueries(['leads']); },
  });

  const toggleCheck = (e, id) => {
    e.stopPropagation();
    setChecked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    const ids = data?.data?.map((l) => l.id) ?? [];
    setChecked(checked.length === ids.length ? [] : ids);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      const response = await api.get(`/export/leads/excel?${params}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `triomphe-leads-${Date.now()}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Error al exportar');
    }
  };

  const leads = data?.data ?? [];
  const allChecked = leads.length > 0 && checked.length === leads.length;

  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} initial="hidden" animate="visible"
        className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Leads</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{data?.pagination?.total ?? 0} contactos registrados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors">
            <FileSpreadsheet size={16} className="text-green-600" /> Excel
          </button>
          <div className="flex border border-gray-200 dark:border-[#2e3650] rounded-xl overflow-hidden">
            <button onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#242938] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650]'}`}>
              <LayoutList size={15} /> Lista
            </button>
            <button onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors ${view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#242938] text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#2e3650]'}`}>
              <Columns size={15} /> Kanban
            </button>
          </div>
          {view === 'list' && (
            <select value={status} onChange={(e) => { setStatus(e.target.value); setChecked([]); }}
              className="px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none">
              <option value="">Todos</option>
              <option value="nuevo">Nuevos</option>
              <option value="contactado">Contactados</option>
              <option value="cerrado">Cerrados</option>
              <option value="descartado">Descartados</option>
            </select>
          )}
        </div>
      </motion.div>

      {view === 'kanban' ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
            {isLoading ? <Spinner size="lg" className="py-16" /> : (
              <KanbanBoard leads={leads} onSelect={setSelected} updateMutation={updateMutation} />
            )}
          </div>
          <div className="xl:col-span-1">
            <AnimatePresence mode="wait">
              {selected ? (
                <LeadDetailPanel key={selected.id} selected={selected} updateMutation={updateMutation}
                  onClose={() => setConfirm({ title: '¿Eliminar este lead?', message: `Se eliminará el contacto de ${selected.name} permanentemente.`, onConfirm: () => { deleteMutation.mutate(selected.id); setConfirm(null); } })} />
              ) : (
                <motion.div key="empty-kanban" variants={fadeIn} initial="hidden" animate="visible" exit={{ opacity: 0 }}
                  className="bg-white dark:bg-[#242938] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-[#2e3650] text-center text-gray-400 dark:text-gray-500">
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Mail size={32} className="mx-auto mb-2 opacity-30" />
                  </motion.div>
                  <p className="text-sm">Haz clic en un lead para ver el detalle</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista */}
          <div className="lg:col-span-2 space-y-3">
            {leads.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <input type="checkbox" checked={allChecked} onChange={toggleAll}
                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer" />
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {allChecked ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </span>
              </div>
            )}

            {isLoading ? <Spinner size="lg" className="py-16" /> : (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-3">
                <AnimatePresence>
                  {leads.map((lead) => (
                    <motion.div key={lead.id} variants={fadeInUp} layout
                      onClick={() => setSelected(lead)}
                      whileHover={{ x: 4, transition: { duration: 0.15 } }}
                      className={`bg-white dark:bg-[#242938] rounded-2xl p-5 shadow-sm border cursor-pointer transition-all ${
                        selected?.id === lead.id
                          ? 'border-blue-500 dark:border-blue-400 ring-1 ring-blue-500'
                          : 'border-gray-100 dark:border-[#2e3650]'
                      }`}>
                      <div className="flex items-start gap-3">
                        <input type="checkbox" checked={checked.includes(lead.id)} onChange={(e) => toggleCheck(e, lead.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 w-4 h-4 rounded accent-blue-600 flex-shrink-0 cursor-pointer" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <p className="font-semibold text-gray-800 dark:text-gray-100">{lead.name}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(lead.createdAt)}</p>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant="default">{typeLabel[lead.type]}</Badge>
                              <Badge variant={statusVariant[lead.status]}>{lead.status}</Badge>
                              {lead.source && lead.source !== 'directo' && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_COLORS[lead.source] || SOURCE_COLORS.otro}`}>
                                  {SOURCE_LABELS[lead.source]}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1"><Mail size={12} /> {lead.email}</span>
                            {lead.phone && <span className="flex items-center gap-1"><Phone size={12} /> {lead.phone}</span>}
                            {lead.property && <span className="flex items-center gap-1"><Building2 size={12} /> {lead.property.title}</span>}
                          </div>
                          {lead.message && <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 line-clamp-2">{lead.message}</p>}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
            {!isLoading && leads.length === 0 && (
              <motion.div variants={fadeIn} initial="hidden" animate="visible"
                className="text-center py-16 text-gray-400 dark:text-gray-500">
                No hay leads con este filtro
              </motion.div>
            )}
          </div>

          {/* Detalle */}
          <div className="lg:col-span-1">
            <AnimatePresence mode="wait">
              {selected ? (
                <LeadDetailPanel key={selected.id} selected={selected} updateMutation={updateMutation}
                  onClose={() => setConfirm({ title: '¿Eliminar este lead?', message: `Se eliminará el contacto de ${selected.name} permanentemente.`, onConfirm: () => { deleteMutation.mutate(selected.id); setConfirm(null); } })} />
              ) : (
                <motion.div key="empty" variants={fadeIn} initial="hidden" animate="visible" exit={{ opacity: 0 }}
                  className="bg-white dark:bg-[#242938] rounded-2xl p-8 shadow-sm border border-gray-100 dark:border-[#2e3650] text-center text-gray-400 dark:text-gray-500">
                  <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Mail size={32} className="mx-auto mb-2 opacity-30" />
                  </motion.div>
                  <p className="text-sm">Selecciona un lead para ver el detalle</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      <ConfirmDialog open={!!confirm} title={confirm?.title} message={confirm?.message}
        confirmLabel="Eliminar" onConfirm={confirm?.onConfirm} onCancel={() => setConfirm(null)} />

      {view === 'list' && (
        <BatchActionBar
          count={checked.length}
          onClear={() => setChecked([])}
          statusOptions={LEAD_STATUS_OPTIONS}
          onStatus={(s) => batchStatusMutation.mutate({ ids: checked, status: s })}
          onDelete={() => setConfirm({
            title: `¿Eliminar ${checked.length} lead(s)?`,
            message: 'Esta acción no se puede deshacer.',
            onConfirm: () => { batchDeleteMutation.mutate(checked); setConfirm(null); },
          })}
        />
      )}
    </motion.div>
  );
}
