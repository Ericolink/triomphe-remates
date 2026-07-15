import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Building2, MessageCircle, PhoneCall, AlertCircle, Pin } from 'lucide-react';
import { getLeads } from '../../services/leadService';
import { getTasks } from '../../services/taskService';
import Badge from '../ui/Badge';
import Spinner from '../ui/Spinner';
import { formatDate, toWhatsAppLink } from '../../utils/formatters';
import {
  PIPELINE_STAGE_LABELS, TERMINAL_STAGES,
  LEAD_TYPE_LABELS as typeLabel, TASK_TYPE_LABELS,
} from '../../utils/constants';

// Prospectos por página/columna — suficiente para llenar varias pantallas antes de que
// el scroll virtualizado pida la siguiente página; ver useColumnLeads más abajo.
const COLUMN_PAGE_SIZE = 30;

const KANBAN_COLUMNS = Object.entries(PIPELINE_STAGE_LABELS).map(([key, label]) => ({
  key, label,
  color: TERMINAL_STAGES.includes(key)
    ? (key === 'venta_realizada' ? 'border-green-400' : 'border-gray-300 dark:border-gray-600')
    : 'border-blue-400',
  headerBg: TERMINAL_STAGES.includes(key)
    ? (key === 'venta_realizada' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-[#2e3650]')
    : 'bg-blue-50 dark:bg-blue-900/20',
  dot: TERMINAL_STAGES.includes(key)
    ? (key === 'venta_realizada' ? 'bg-green-500' : 'bg-gray-400')
    : 'bg-blue-500',
}));

export function NextActionLine({ task }) {
  if (!task) return null;
  const overdue = new Date(task.dueDate) < new Date();
  return (
    <p className={`text-xs mt-1.5 flex items-center gap-1 ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
      {overdue ? <AlertCircle size={12} className="flex-shrink-0" /> : <Pin size={12} className="flex-shrink-0" />}
      {TASK_TYPE_LABELS[task.type] || task.type} · {formatDate(task.dueDate)}
    </p>
  );
}

// Prioriza vencidas > por vencer > sin tarea, dentro de lo ya cargado en la columna —
// evita un JOIN nuevo en el backend solo para ordenar (ver análisis: "mostrar primero
// lo urgente" aplicado sobre el lote visible, no sobre el pipeline completo).
function sortByUrgency(leads, openTaskByLead) {
  const rank = (lead) => {
    const task = openTaskByLead[lead.id];
    if (!task) return [2, 0];
    const due = new Date(task.dueDate).getTime();
    return [due < Date.now() ? 0 : 1, due];
  };
  return [...leads].sort((a, b) => {
    const [rankA, dueA] = rank(a);
    const [rankB, dueB] = rank(b);
    if (rankA !== rankB) return rankA - rankB;
    return rankA === 2 ? 0 : dueA - dueB;
  });
}

// En celular solo se muestra una columna a la vez (la que el selector de etapa del
// encabezado tenga activa); en pc se ven las 8 al mismo tiempo, sin scroll horizontal.
function useIsMobile() {
  const query = '(max-width: 767px)';
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

function useColumnLeads(stageKey, filters) {
  return useInfiniteQuery({
    queryKey: ['leads-column', stageKey, filters.search, filters.assignedToUserId],
    queryFn: ({ pageParam = 1 }) => getLeads({
      pipelineStage: stageKey,
      page: pageParam,
      limit: COLUMN_PAGE_SIZE,
      search: filters.search || undefined,
      assignedToUserId: filters.assignedToUserId || undefined,
    }),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined,
    initialPageParam: 1,
  });
}

// Sin ícono de cambiar etapa en la tarjeta: a 8 columnas simultáneas en pc no sobra
// espacio junto al nombre. La etapa se sigue cambiando por drag&drop (desktop) o desde
// el panel de detalle (mobile y desktop) — ver botón "Etapa" en LeadDetailPanel.
export function KanbanCard({ lead, openTask, onSelect, draggable, onDragStart, onDragEnd, isDragging }) {
  return (
    <div draggable={draggable}
      onDragStart={onDragStart} onDragEnd={onDragEnd}
      onClick={() => onSelect(lead)}
      className={`bg-white dark:bg-[#242938] rounded-xl p-3 shadow-sm border border-gray-100 dark:border-[#2e3650] cursor-pointer hover:shadow-md transition-shadow select-none ${draggable ? 'active:cursor-grabbing' : ''} ${isDragging ? 'opacity-40' : ''}`}>
      <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm line-clamp-2 break-words">{lead.name}</p>
      {lead.campaign && <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5 truncate">{lead.campaign.name}</p>}
      {lead.property && (
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1 truncate">
          <Building2 size={10} /> {lead.property.title}
        </p>
      )}
      <NextActionLine task={openTask} />
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          {lead.phone && (
            <a href={`tel:${lead.phone}`} onClick={(e) => e.stopPropagation()} title="Llamar"
              className="p-2 -m-1 text-gray-400 hover:text-blue-500"><PhoneCall size={12} /></a>
          )}
          {lead.phone && (
            <a href={toWhatsAppLink(lead.phone)} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="WhatsApp"
              className="p-2 -m-1 text-gray-400 hover:text-green-500"><MessageCircle size={12} /></a>
          )}
        </div>
        <Badge variant="default">{typeLabel[lead.type]}</Badge>
      </div>
    </div>
  );
}

function KanbanColumn({ col, filters, fullWidth, onSelect,
  dragging, onDragStart, onDragEnd, onDrop, isDragOver, onDragOver, onDragLeave, columnRef }) {
  const parentRef = useRef(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useColumnLeads(col.key, filters);
  const rawLeads = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const total = data?.pages?.[0]?.pagination?.total ?? 0;

  const leadIds = useMemo(() => rawLeads.map((l) => l.id), [rawLeads]);
  const { data: openTasksData } = useQuery({
    queryKey: ['open-tasks-column', col.key, leadIds.join(',')],
    queryFn: () => getTasks({ leadIds: leadIds.join(','), done: false }),
    enabled: leadIds.length > 0,
  });
  const openTaskByLead = useMemo(() => {
    const map = {};
    (openTasksData?.data ?? []).forEach((t) => { map[t.leadId] = t; });
    return map;
  }, [openTasksData]);

  const leads = useMemo(() => sortByUrgency(rawLeads, openTaskByLead), [rawLeads, openTaskByLead]);

  const rowVirtualizer = useVirtualizer({
    count: hasNextPage ? leads.length + 1 : leads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 112,
    overscan: 4,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= leads.length - 1 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualItems, leads.length, hasNextPage, isFetchingNextPage]);

  return (
    <div ref={columnRef} data-stage={col.key}
      onDragOver={(e) => onDragOver(e, col.key)}
      onDrop={(e) => onDrop(e, col.key)}
      onDragLeave={onDragLeave}
      className={`flex flex-col rounded-2xl border-2 transition-colors ${fullWidth ? 'w-full flex-shrink-0' : 'flex-1 min-w-0'} ${col.color} ${isDragOver ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-gray-50/60 dark:bg-[#1a1f2e]/60'}`}>
      {/* Encabezado a una sola línea siempre: con 8 columnas simultáneas en pc, algunas
          etiquetas ("Cita agendada", "Venta realizada") no caben enteras junto al contador.
          Envolver a 2 líneas rompía la alineación (el contador, centrado con `items-center`
          contra el bloque completo, quedaba flotando entre ambas líneas en vez de junto al
          texto). `truncate` + `title` (tooltip) es el mismo patrón que usan Trello/Jira para
          títulos de columna angostos: nunca se rompe la fila, el nombre completo sigue
          disponible al pasar el cursor. */}
      <div className={`px-3 py-2.5 rounded-t-xl flex items-center gap-2 flex-shrink-0 ${col.headerBg}`}>
        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${col.dot}`} />
        <span className="font-semibold text-sm text-gray-700 dark:text-gray-200 truncate min-w-0 flex-1" title={col.label}>{col.label}</span>
        <span className="flex-shrink-0 text-xs bg-white dark:bg-[#242938] text-gray-500 dark:text-gray-400 rounded-full px-2 py-0.5 font-medium">
          {isLoading ? '…' : total}
        </span>
      </div>
      <div ref={parentRef} className="flex-1 min-h-0 overflow-y-auto p-3">
        {isLoading ? (
          <Spinner size="sm" className="py-8" />
        ) : leads.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-4 italic">Sin prospectos</p>
        ) : (
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {virtualItems.map((virtualRow) => {
              const isLoaderRow = virtualRow.index > leads.length - 1;
              const lead = leads[virtualRow.index];
              return (
                <div key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${virtualRow.start}px)` }}
                  className="pb-2">
                  {isLoaderRow ? (
                    <div className="py-3 flex justify-center"><Spinner size="sm" /></div>
                  ) : (
                    <KanbanCard lead={lead} openTask={openTaskByLead[lead.id]} onSelect={onSelect}
                      draggable onDragStart={(e) => onDragStart(e, lead)} onDragEnd={onDragEnd}
                      isDragging={dragging?.id === lead.id} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Kanban a escala: cada columna pagina y virtualiza su propio scroll (soporta cientos/miles
// de prospectos sin cargarlos todos de golpe ni renderizar nodos DOM fuera de pantalla).
// En celular solo se monta la columna activa (la del selector de etapa del encabezado,
// compartido con la vista Lista) — así solo esa etapa se ve y además evita pedir datos de
// las otras 7 columnas en una conexión móvil. En pc se muestran las 8 al mismo tiempo,
// repartiéndose el ancho disponible sin scroll horizontal.
export default function KanbanBoard({ filters, focusStage, onSelect, onAttemptStageChange }) {
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const isMobile = useIsMobile();
  const columnRefs = useRef({});

  const handleDragStart = (e, lead) => { setDragging(lead); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e, colKey) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(colKey); };
  const handleDrop = (e, colKey) => {
    e.preventDefault();
    setDragOver(null);
    if (dragging && dragging.pipelineStage !== colKey) onAttemptStageChange(dragging, colKey);
    setDragging(null);
  };
  const handleDragEnd = () => { setDragging(null); setDragOver(null); };

  useEffect(() => {
    if (isMobile || !focusStage) return;
    columnRefs.current[focusStage]?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }, [focusStage, isMobile]);

  const visibleColumns = isMobile
    ? KANBAN_COLUMNS.filter((col) => col.key === (focusStage || KANBAN_COLUMNS[0].key))
    : KANBAN_COLUMNS;

  return (
    <div className="flex flex-col h-[70vh] min-h-[440px]">
      <div className={`flex-1 min-h-0 flex ${isMobile ? '' : 'gap-2'}`}>
        {visibleColumns.map((col) => (
          <KanbanColumn key={col.key} col={col} filters={filters} fullWidth={isMobile}
            onSelect={onSelect}
            dragging={dragging} onDragStart={handleDragStart} onDragEnd={handleDragEnd}
            onDrop={handleDrop} isDragOver={dragOver === col.key}
            onDragOver={handleDragOver} onDragLeave={() => setDragOver(null)}
            columnRef={(el) => { columnRefs.current[col.key] = el; }} />
        ))}
      </div>
    </div>
  );
}
