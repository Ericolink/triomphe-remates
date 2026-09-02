import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, User } from 'lucide-react';
import { getLeads } from '../../services/leadService';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import usePopoverA11y from '../../hooks/usePopoverA11y';

const defaultInputClass =
  'flex items-center gap-2 w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] focus-within:ring-2 focus-within:ring-accent-500';

// Combobox de búsqueda remota para elegir UN prospecto — mismo patrón que PropertyPicker.jsx
// (mismo directorio), contra `getLeads` en vez de `getProperties`. Ya viene scoped por rol
// desde el backend (getLeadVisibilityWhere): un asesor_ventas solo encuentra sus propios
// prospectos aquí, sin lógica extra de este lado.
//
// A diferencia de PropertyPicker (que separa `value`/`initialLabel`), `onChange` entrega el
// prospecto COMPLETO en vez de solo el id — el caller (AgendarCitaModal) necesita poder
// preseleccionar el prospecto recién creado desde el mismo flujo sin tener que sincronizar un
// label aparte.
export default function LeadPicker({
  value,
  onChange,
  placeholder = 'Buscar prospecto por nombre o teléfono...',
  className = defaultInputClass,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const { panelRef } = usePopoverA11y(open, () => setOpen(false));

  const displayLabel = value ? `${value.name}${value.phone ? ` · ${value.phone}` : ''}` : '';

  const { data, isFetching } = useQuery({
    queryKey: ['lead-picker', debouncedQuery],
    queryFn: () => getLeads({ search: debouncedQuery || undefined, limit: 8 }),
    enabled: open,
  });
  const results = data?.data ?? [];

  const handleSelect = (lead) => {
    onChange(lead);
    setQuery('');
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setQuery('');
  };

  return (
    <div className="relative" ref={panelRef}>
      <div className={className}>
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          type="text"
          value={open ? query : displayLabel}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          placeholder={value ? '' : placeholder}
          className="flex-1 min-w-0 text-sm bg-transparent focus:outline-none dark:text-gray-100 dark:placeholder-gray-500"
        />
        {value && !open && (
          <button
            type="button"
            onClick={handleClear}
            title="Quitar prospecto"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-white dark:bg-[#242938] border border-gray-200 dark:border-[#2e3650] rounded-xl shadow-lg py-1">
          {isFetching ? (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">Buscando...</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500 italic">
              {debouncedQuery
                ? 'Ningún prospecto coincide con la búsqueda.'
                : 'Sin prospectos disponibles.'}
            </p>
          ) : (
            results.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => handleSelect(lead)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
              >
                <User size={13} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200">
                  {lead.name}
                  {lead.phone && (
                    <span className="text-gray-400 dark:text-gray-500"> · {lead.phone}</span>
                  )}
                </span>
                {lead.assignedUser?.name && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0 truncate max-w-[7rem]">
                    {lead.assignedUser.name}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
