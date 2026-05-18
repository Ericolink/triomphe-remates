import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X } from 'lucide-react';
import { getProperties } from '../../services/propertyService';
import PropertyCard from '../../components/ui/PropertyCard';
import Spinner from '../../components/ui/Spinner';
import SEO from '../../components/ui/SEO';

const CITIES = [{ value: '', label: 'Todas las ciudades' }, { value: 'juarez', label: 'Cd. Juárez' }, { value: 'chihuahua', label: 'Chihuahua' }, { value: 'queretaro', label: 'Querétaro' }];
const TYPES = [{ value: '', label: 'Todos los tipos' }, { value: 'casa', label: 'Casa' }, { value: 'departamento', label: 'Departamento' }, { value: 'terreno', label: 'Terreno' }, { value: 'local', label: 'Local' }, { value: 'bodega', label: 'Bodega' }];
const STATUS = [{ value: '', label: 'Todos los estatus' }, { value: 'disponible', label: 'Disponible' }, { value: 'apartado', label: 'Apartado' }];

export default function PropertiesPage() {
  const [filters, setFilters] = useState({
    city: '',
    type: '',
    status: '',
    minPrice: '',
    maxPrice: '',
    search: '',
    page: 1,
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['properties', filters],
    queryFn: () => getProperties({ ...filters, limit: 12 }),
    keepPreviousData: true,
  });

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value, page: 1 }));

  const clearFilters = () => setFilters({ city: '', type: '', status: '', minPrice: '', maxPrice: '', search: '', page: 1 });

  const hasFilters = filters.city || filters.type || filters.status || filters.minPrice || filters.maxPrice || filters.search;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <SEO
        title="Propiedades en Remate"
        description="Explora nuestro inventario de remates bancarios en Chihuahua, Ciudad Juárez y Querétaro. Filtra por ciudad, tipo y precio."
        url="/propiedades"
      />
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-blue-900">Propiedades en Remate</h1>
        <p className="text-gray-500 mt-1">
          {data?.pagination?.total ?? '...'} propiedades disponibles
        </p>
      </div>

      {/* Barra de búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar por título, banco, dirección..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <SlidersHorizontal size={16} />
          Filtros
          {hasFilters && <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">!</span>}
        </button>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-2 px-4 py-2.5 text-red-500 border border-red-200 rounded-xl text-sm hover:bg-red-50 transition-colors">
            <X size={16} /> Limpiar
          </button>
        )}
      </div>

      {/* Filtros expandibles */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-xl">
          {[
            { key: 'city', options: CITIES, label: 'Ciudad' },
            { key: 'type', options: TYPES, label: 'Tipo' },
            { key: 'status', options: STATUS, label: 'Estatus' },
          ].map(({ key, options, label }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
              <select
                value={filters[key]}
                onChange={(e) => setFilter(key, e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Precio máx.</label>
            <input
              type="number"
              placeholder="Ej: 1000000"
              value={filters.maxPrice}
              onChange={(e) => setFilter('maxPrice', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Grid de propiedades */}
      {isLoading ? (
        <Spinner size="lg" className="py-20" />
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-xl font-medium">No se encontraron propiedades</p>
          <p className="text-sm mt-2">Intenta con otros filtros</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.data?.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>

          {/* Paginación */}
          {data?.pagination?.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-10">
              {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setFilters((f) => ({ ...f, page: p }))}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    filters.page === p ? 'bg-blue-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}