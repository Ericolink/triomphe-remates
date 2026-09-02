import { useQuery } from '@tanstack/react-query';
import { Search, AlertTriangle } from 'lucide-react';
import { getUsers } from '../../../services/usersService';
import { AUDIT_RESULT_LABELS } from '../../../utils/constants';

const AREAS = [
  '',
  'CRM',
  'Propiedades',
  'Usuarios',
  'Autenticación',
  'Marketing',
  'Configuración',
  'Analytics',
  'Seguridad',
  'Sistema',
];
const ACTIONS = ['', 'create', 'update', 'delete', 'login', 'export'];
const ACTION_LABELS = { create: 'Crear', update: 'Editar', delete: 'Eliminar', login: 'Login', export: 'Exportar' };
const RANGES = [
  { value: '', label: 'Cualquier fecha' },
  { value: 'hoy', label: 'Hoy' },
  { value: '7d', label: 'Últimos 7 días' },
  { value: '30d', label: 'Últimos 30 días' },
  { value: 'custom', label: 'Rango personalizado' },
];

const selectClass =
  'px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#242938] dark:text-gray-100 focus:outline-none';

export default function AuditFilters({
  area,
  onAreaChange,
  action,
  onActionChange,
  userId,
  onUserIdChange,
  result,
  onResultChange,
  range,
  onRangeChange,
  from,
  onFromChange,
  to,
  onToChange,
  search,
  onSearchChange,
  critical,
  onCriticalChange,
}) {
  // Staff del panel admin — universo pequeño (decenas, no miles), un solo <select>
  // poblado una vez es más simple y preciso que intentar resolver nombres desde el texto
  // de búsqueda libre.
  const { data: usersData } = useQuery({
    queryKey: ['users-for-audit-filter'],
    queryFn: () => getUsers({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por usuario, #id, acción o texto del evento…"
          className={`${selectClass} w-full pl-9`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={area} onChange={(e) => onAreaChange(e.target.value)} className={selectClass}>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a || 'Todas las áreas'}
            </option>
          ))}
        </select>

        <select value={action} onChange={(e) => onActionChange(e.target.value)} className={selectClass}>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a ? ACTION_LABELS[a] : 'Todas las acciones'}
            </option>
          ))}
        </select>

        <select value={userId} onChange={(e) => onUserIdChange(e.target.value)} className={selectClass}>
          <option value="">Todos los usuarios</option>
          {usersData?.data?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <select value={result} onChange={(e) => onResultChange(e.target.value)} className={selectClass}>
          <option value="">Todos los resultados</option>
          <option value="success">{AUDIT_RESULT_LABELS.success}</option>
          <option value="failed">{AUDIT_RESULT_LABELS.failed}</option>
        </select>

        <select value={range} onChange={(e) => onRangeChange(e.target.value)} className={selectClass}>
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>

        {range === 'custom' && (
          <>
            <input
              type="date"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
              className={selectClass}
            />
            <input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className={selectClass} />
          </>
        )}

        <button
          type="button"
          onClick={() => onCriticalChange(!critical)}
          aria-pressed={critical}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border transition-colors ${
            critical
              ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-900/40 dark:text-red-300'
              : 'bg-white dark:bg-[#242938] border-gray-200 dark:border-[#2e3650] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#2e3650]'
          }`}
        >
          <AlertTriangle size={14} /> Solo críticos
        </button>
      </div>
    </div>
  );
}
