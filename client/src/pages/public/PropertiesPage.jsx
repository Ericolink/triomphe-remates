import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X, Bell, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getProperties } from '../../services/propertyService';
import PropertyCard from '../../components/ui/PropertyCard';
import Spinner from '../../components/ui/Spinner';
import SEO from '../../components/ui/SEO';
import AlertSubscriptionForm from '../../components/ui/AlertSubscriptionForm';
import { fadeInUp, fadeIn, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';

const CITIES = [{ value: '', label: 'Todas las ciudades' }, { value: 'juarez', label: 'Cd. Juárez' }, { value: 'chihuahua', label: 'Chihuahua' }, { value: 'queretaro', label: 'Querétaro' }];
const TYPES = [{ value: '', label: 'Todos los tipos' }, { value: 'casa', label: 'Casa' }, { value: 'departamento', label: 'Departamento' }, { value: 'terreno', label: 'Terreno' }, { value: 'local', label: 'Local' }, { value: 'bodega', label: 'Bodega' }];
const STATUS = [{ value: '', label: 'Todos los estatus' }, { value: 'disponible', label: 'Disponible' }, { value: 'apartado', label: 'Apartado' }];

export default function PropertiesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [page, setPage] = useState(1);
  const [localFilters, setLocalFilters] = useState({
    city: '', type: '', status: '', maxPrice: '', search: '',
  });

  const filters = {
    city: searchParams.get('city') || localFilters.city,
    type: searchParams.get('type') || localFilters.type,
    status: localFilters.status,
    maxPrice: localFilters.maxPrice,
    search: searchParams.get('search') || localFilters.search,
    page,
  };

  const { data, isLoading } = useQuery({
    queryKey: ['properties', filters],
    queryFn: () => getProperties({ ...filters, limit: 12 }),
    keepPreviousData: true,
  });

  const setFilter = (key, value) => {
    setLocalFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
    if (searchParams.has(key)) {
      const next = new URLSearchParams(searchParams);
      next.delete(key);
      setSearchParams(next);
    }
  };

  const clearFilters = () => {
    setLocalFilters({ city: '', type: '', status: '', maxPrice: '', search: '' });
    setSearchParams({});
    setPage(1);
  };

  const hasFilters = filters.city || filters.type || filters.status || filters.maxPrice || filters.search;

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto px-4 py-10"
    >
      <SEO title="Propiedades en Remate" description="Explora nuestro inventario de remates bancarios." url="/propiedades" />

      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-8">
        <h1 className="text-3xl font-bold text-blue-900 dark:text-white">Propiedades en Remate</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {data?.pagination?.total ?? '...'} propiedades disponibles
          {filters.search && <span className="ml-2 text-blue-600 font-medium">· Buscando: &quot;{filters.search}&quot;</span>}
        </p>
      </motion.div>

      {/* Barra de búsqueda */}
      <motion.div
        variants={fadeInUp} initial="hidden" animate="visible"
        className="flex flex-col sm:flex-row gap-3 mb-6"
      >
        <input type="text" placeholder="Buscar por título, dirección..."
          value={filters.search} onChange={(e) => setFilter('search', e.target.value)}
          className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#242938] dark:text-white dark:placeholder-gray-500" />
        <motion.button whileHover={buttonHover} whileTap={buttonTap}
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#242938] transition-colors dark:text-gray-200">
          <SlidersHorizontal size={16} />
          Filtros
          {hasFilters && (
            <motion.span
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              !
            </motion.span>
          )}
        </motion.button>
        <AnimatePresence>
          {hasFilters && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              onClick={clearFilters} whileHover={buttonHover} whileTap={buttonTap}
              className="flex items-center gap-2 px-4 py-2.5 text-red-500 border border-red-200 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <X size={16} /> Limpiar
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Filtros expandibles */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 dark:bg-[#242938] rounded-xl border border-transparent dark:border-[#2e3650]">
              {[
                { key: 'city', options: CITIES, label: 'Ciudad' },
                { key: 'type', options: TYPES, label: 'Tipo' },
                { key: 'status', options: STATUS, label: 'Estatus' },
              ].map(({ key, options, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
                  <select value={filters[key]} onChange={(e) => setFilter(key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-white">
                    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Precio máx.</label>
                <input type="text" placeholder="Ej: 1,000,000"
                  value={filters.maxPrice ? Number(filters.maxPrice).toLocaleString('es-MX') : ''}
                  onChange={(e) => { const raw = e.target.value.replace(/[^0-9]/g, ''); setFilter('maxPrice', raw); }}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500" />
                {filters.maxPrice && <p className="text-xs text-blue-600 mt-1">$ {Number(filters.maxPrice).toLocaleString('es-MX')} MXN</p>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alertas por email */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-6">
        <button onClick={() => setShowAlertForm((v) => !v)}
          className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-400 font-medium hover:underline">
          <Bell size={15} /> Recibir alerta cuando llegue una propiedad
          <ChevronDown size={14} className={`transition-transform ${showAlertForm ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence>
          {showAlertForm && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }} className="overflow-hidden mt-4">
              <div className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-5 shadow-sm max-w-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Te notificaremos por email cuando publiquemos una propiedad que coincida con tu búsqueda.
                </p>
                <AlertSubscriptionForm />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Grid */}
      {isLoading ? (
        <Spinner size="lg" className="py-20" />
      ) : data?.data?.length === 0 ? (
        <motion.div variants={fadeIn} initial="hidden" animate="visible" className="text-center py-20 text-gray-400">
          <p className="text-xl font-medium">No se encontraron propiedades</p>
          <p className="text-sm mt-2">Intenta con otros filtros</p>
          <motion.button onClick={clearFilters} whileHover={buttonHover} whileTap={buttonTap}
            className="mt-4 text-blue-600 hover:underline text-sm">
            Limpiar filtros
          </motion.button>
        </motion.div>
      ) : (
        <>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {data?.data?.map((property) => (
              <motion.div key={property.id} variants={fadeInUp}>
                <PropertyCard property={property} />
              </motion.div>
            ))}
          </motion.div>

          {data?.pagination?.totalPages > 1 && (
            <motion.div
              variants={fadeIn} initial="hidden" animate="visible"
              className="flex justify-center gap-2 mt-10"
            >
              {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <motion.button key={p} onClick={() => setPage(p)}
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
                  className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                    page === p ? 'bg-blue-900 text-white' : 'bg-gray-100 dark:bg-[#242938] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2e3650]'
                  }`}>
                  {p}
                </motion.button>
              ))}
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
