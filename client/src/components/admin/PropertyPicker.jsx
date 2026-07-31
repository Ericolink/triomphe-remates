import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Building2 } from 'lucide-react';
import { getProperties } from '../../services/propertyService';
import { CITY_LABELS } from '../../utils/constants';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import usePopoverA11y from '../../hooks/usePopoverA11y';

const defaultInputClass =
  'flex items-center gap-2 w-full px-3 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm bg-white dark:bg-[#1a1f2e] focus-within:ring-2 focus-within:ring-accent-500';

// Combobox de búsqueda remota para elegir UNA propiedad dentro de un formulario del CRM
// (propiedad de interés de un prospecto). Reemplaza el <select> que solo traía las
// primeras 50 propiedades: con cientos o miles de propiedades esa lista ocultaba en
// silencio todo lo que quedara fuera del límite y nunca avisaba al usuario. Aquí se
// busca por texto contra el mismo endpoint/paginación que el resto del catálogo
// (propertyController.getProperties), así que cualquier propiedad existente es
// alcanzable escribiendo su título — nunca queda "oculta".
export default function PropertyPicker({
  id,
  value,
  onChange,
  excludeIds = [],
  placeholder = 'Buscar propiedad por título...',
  className = defaultInputClass,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const { panelRef } = usePopoverA11y(open, () => setOpen(false));

  // `selectedLabel` solo es válido mientras `value` siga presente — si el formulario
  // contenedor resetea `value` externamente (envío exitoso, cancelar), se ignora en vez
  // de sincronizarse con un efecto (evita el cascading-render que eso produciría).
  const displayLabel = value ? selectedLabel : '';

  const { data, isFetching } = useQuery({
    queryKey: ['property-picker', debouncedQuery],
    queryFn: () => getProperties({ search: debouncedQuery || undefined, limit: 8 }),
    enabled: open,
  });

  const results = useMemo(
    () => (data?.data ?? []).filter((p) => !excludeIds.includes(p.id)),
    [data, excludeIds]
  );

  const handleSelect = (property) => {
    onChange(property.id);
    setSelectedLabel(property.title);
    setQuery('');
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSelectedLabel('');
    setQuery('');
  };

  return (
    <div className="relative" ref={panelRef}>
      <div className={className}>
        <Search size={14} className="text-gray-400 flex-shrink-0" />
        <input
          id={id}
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
            title="Quitar propiedad"
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
                ? 'Ninguna propiedad coincide con la búsqueda.'
                : 'Sin propiedades disponibles.'}
            </p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-[#2e3650] transition-colors"
              >
                <Building2 size={13} className="text-gray-400 flex-shrink-0" />
                <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200">
                  {p.title}
                </span>
                {p.city && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {CITY_LABELS[p.city] || p.city}
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
