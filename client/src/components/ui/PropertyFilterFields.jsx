import { useId } from 'react';
import { CITY_LABELS, TYPE_LABELS, CATEGORY_LABELS, labelsToOptions } from '../../utils/constants';

// Opciones compartidas por el panel de filtros de PropertiesPage y por el formulario de
// descarga de inventario (CatalogDownloadForm) — una sola fuente de verdad para las
// etiquetas visibles, aunque cada uno mantenga su propio estado de filtros. No exportadas
// (react-refresh exige que un archivo de componente solo exporte el componente) — viven
// solo dentro de este módulo, que es el único consumidor.
const CITIES = [
  { value: '', label: 'Todas las ciudades' },
  ...labelsToOptions(CITY_LABELS, ['otra']),
];
const TYPES = [{ value: '', label: 'Todos los tipos' }, ...labelsToOptions(TYPE_LABELS)];
const CATEGORIES = [
  { value: '', label: 'Todas las categorías' },
  ...labelsToOptions(CATEGORY_LABELS),
];
const BEDROOMS = [
  { value: '', label: 'Cualquier cantidad' },
  { value: '1', label: '1+ recámara' },
  { value: '2', label: '2+ recámaras' },
  { value: '3', label: '3+ recámaras' },
  { value: '4', label: '4+ recámaras' },
];
const BATHROOMS = [
  { value: '', label: 'Cualquier cantidad' },
  { value: '1', label: '1+ baño' },
  { value: '2', label: '2+ baños' },
  { value: '3', label: '3+ baños' },
];

// Grid de campos de filtrado de propiedades (ciudad/tipo/categoría/precio/recámaras/baños/
// terreno/construcción, más búsqueda por texto opcional) — reutilizado tal cual por
// PropertiesPage (filtros del listado, siempre visibles) y por CatalogDownloadForm (filtros
// de la descarga del inventario, con su propio estado independiente). Mantener esta lógica
// en un solo lugar evita que ambos terminen aplicando criterios de filtrado distintos.
export default function PropertyFilterFields({
  filters,
  onChange,
  showCategory = false,
  showSearch = false,
  idPrefix,
}) {
  const reactId = useId();
  const prefix = idPrefix || reactId;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {showSearch && (
        <div className="col-span-2 md:col-span-4">
          <label
            htmlFor={`${prefix}-search`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            Buscar
          </label>
          <input
            id={`${prefix}-search`}
            type="text"
            placeholder="Buscar por título, dirección..."
            value={filters.search || ''}
            onChange={(e) => onChange('search', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500"
          />
        </div>
      )}
      {[
        { key: 'city', options: CITIES, label: 'Ciudad' },
        { key: 'type', options: TYPES, label: 'Tipo' },
        ...(showCategory ? [{ key: 'category', options: CATEGORIES, label: 'Categoría de propiedad' }] : []),
      ].map(({ key, options, label }) => (
        <div key={key}>
          <label
            htmlFor={`${prefix}-${key}`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            {label}
          </label>
          <select
            id={`${prefix}-${key}`}
            value={filters[key] || ''}
            onChange={(e) => onChange(key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <div className="col-span-2 md:col-span-1">
        <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
          Precio
        </span>
        <div className="flex gap-2">
          <div className="w-1/2">
            <label htmlFor={`${prefix}-minPrice`} className="sr-only">
              Precio mínimo
            </label>
            <input
              id={`${prefix}-minPrice`}
              type="text"
              placeholder="Mín."
              value={filters.minPrice ? Number(filters.minPrice).toLocaleString('es-MX') : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                onChange('minPrice', raw);
              }}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500"
            />
          </div>
          <div className="w-1/2">
            <label htmlFor={`${prefix}-maxPrice`} className="sr-only">
              Precio máximo
            </label>
            <input
              id={`${prefix}-maxPrice`}
              type="text"
              placeholder="Máx."
              value={filters.maxPrice ? Number(filters.maxPrice).toLocaleString('es-MX') : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                onChange('maxPrice', raw);
              }}
              className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500"
            />
          </div>
        </div>
        {(filters.minPrice || filters.maxPrice) && (
          <p className="text-xs text-primary-600 mt-1">
            {filters.minPrice ? `$${Number(filters.minPrice).toLocaleString('es-MX')}` : '$0'}
            {' – '}
            {filters.maxPrice ? `$${Number(filters.maxPrice).toLocaleString('es-MX')} MXN` : 'sin máximo'}
          </p>
        )}
      </div>
      {[
        { key: 'minBedrooms', options: BEDROOMS, label: 'Recámaras' },
        { key: 'minBathrooms', options: BATHROOMS, label: 'Baños' },
      ].map(({ key, options, label }) => (
        <div key={key}>
          <label
            htmlFor={`${prefix}-${key}`}
            className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
          >
            {label}
          </label>
          <select
            id={`${prefix}-${key}`}
            value={filters[key] || ''}
            onChange={(e) => onChange(key, e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {[
        { groupLabel: 'Terreno m²', minKey: 'minTerrainM2', maxKey: 'maxTerrainM2' },
        { groupLabel: 'Construcción m²', minKey: 'minConstructionM2', maxKey: 'maxConstructionM2' },
      ].map(({ groupLabel, minKey, maxKey }) => (
        <div key={minKey} className="col-span-2 md:col-span-1">
          <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {groupLabel}
          </span>
          <div className="flex gap-2">
            <div className="w-1/2">
              <label htmlFor={`${prefix}-${minKey}`} className="sr-only">
                {groupLabel} mínimo
              </label>
              <input
                id={`${prefix}-${minKey}`}
                type="number"
                placeholder="Mín."
                min="0"
                value={filters[minKey] || ''}
                onChange={(e) => onChange(minKey, e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500"
              />
            </div>
            <div className="w-1/2">
              <label htmlFor={`${prefix}-${maxKey}`} className="sr-only">
                {groupLabel} máximo
              </label>
              <input
                id={`${prefix}-${maxKey}`}
                type="number"
                placeholder="Máx."
                min="0"
                value={filters[maxKey] || ''}
                onChange={(e) => onChange(maxKey, e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
