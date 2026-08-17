import { useId, useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { SlidersHorizontal, X, Bell, Download, ChevronDown, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getProperties } from '../../services/propertyService';
import PropertyCard from '../../components/ui/PropertyCard';
import { PropertyCardSkeletonGrid } from '../../components/ui/PropertyCardSkeleton';
import SEO from '../../components/ui/SEO';
import TabBar from '../../components/ui/TabBar';
import AlertSubscriptionForm from '../../components/ui/AlertSubscriptionForm';
import CatalogDownloadForm from '../../components/ui/CatalogDownloadForm';
import { fadeInUp, fadeIn, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';
import {
  CITY_LABELS,
  TYPE_LABELS,
  CATEGORY_LABELS,
  BUSINESS_LINE_CONTENT,
  labelsToOptions,
} from '../../utils/constants';

// Selector de inventario dentro del mismo módulo de propiedades — Remates Bancarios (línea
// principal del negocio) y Casas Infonavit conviven en /propiedades sin landing separada; el
// cambio de tab solo actualiza qué `businessLine` se consulta, no navega a otra ruta.
const PROPERTY_LINE_TABS = [
  { key: 'remate', label: 'Remates Bancarios' },
  { key: 'infonavit', label: 'Casas Infonavit' },
];

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

export default function PropertiesPage() {
  const [businessLine, setBusinessLine] = useState('remate');
  const content = BUSINESS_LINE_CONTENT[businessLine];
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [showDownloadForm, setShowDownloadForm] = useState(false);
  const filtersFormId = useId();
  const [localFilters, setLocalFilters] = useState({
    city: '',
    type: '',
    category: '',
    maxPrice: '',
    search: '',
    minBedrooms: '',
    minBathrooms: '',
    minTerrainM2: '',
    maxTerrainM2: '',
    minConstructionM2: '',
    maxConstructionM2: '',
  });
  const sentinelRef = useRef(null);

  const filters = {
    city: searchParams.get('city') || localFilters.city,
    type: searchParams.get('type') || localFilters.type,
    category: searchParams.get('category') || localFilters.category,
    maxPrice: localFilters.maxPrice,
    search: searchParams.get('search') || localFilters.search,
    minBedrooms: localFilters.minBedrooms,
    minBathrooms: localFilters.minBathrooms,
    minTerrainM2: localFilters.minTerrainM2,
    maxTerrainM2: localFilters.maxTerrainM2,
    minConstructionM2: localFilters.minConstructionM2,
    maxConstructionM2: localFilters.maxConstructionM2,
  };

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['properties', businessLine, filters],
    queryFn: ({ pageParam }) =>
      getProperties({ ...filters, businessLine, page: pageParam, limit: 12 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, hasNext } = lastPage.pagination;
      return hasNext ? page + 1 : undefined;
    },
  });

  const properties = data?.pages?.flatMap((p) => p.data) ?? [];
  const total = data?.pages?.[0]?.pagination?.total ?? 0;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: '400px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Al cambiar de inventario se conservan el resto de filtros (ciudad, tipo, precio...) —
  // solo se limpia `category`, que es una subclasificación exclusiva de la línea de remates
  // y no tiene sentido (ni opción visible) dentro de Casas Infonavit.
  const handleBusinessLineChange = (nextLine) => {
    setBusinessLine(nextLine);
    if (nextLine !== 'remate') setFilter('category', '');
  };

  const setFilter = (key, value) => {
    setLocalFilters((f) => ({ ...f, [key]: value }));
    if (searchParams.has(key)) {
      const next = new URLSearchParams(searchParams);
      next.delete(key);
      setSearchParams(next);
    }
  };

  const clearFilters = () => {
    setLocalFilters({
      city: '',
      type: '',
      category: '',
      maxPrice: '',
      search: '',
      minBedrooms: '',
      minBathrooms: '',
      minTerrainM2: '',
      maxTerrainM2: '',
      minConstructionM2: '',
      maxConstructionM2: '',
    });
    setSearchParams({});
  };

  const hasFilters =
    filters.city ||
    filters.type ||
    filters.category ||
    filters.maxPrice ||
    filters.search ||
    filters.minBedrooms ||
    filters.minBathrooms ||
    filters.minTerrainM2 ||
    filters.maxTerrainM2 ||
    filters.minConstructionM2 ||
    filters.maxConstructionM2;

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      className="max-w-7xl mx-auto px-4 py-10"
    >
      <SEO title={content.listingTitle} description={content.listingDescription} url="/propiedades" />

      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-4">
        <TabBar tabs={PROPERTY_LINE_TABS} active={businessLine} onChange={handleBusinessLineChange} />
      </motion.div>

      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-8">
        <h1 className="text-3xl font-bold text-primary-900 dark:text-white">{content.listingTitle}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {total || '...'} propiedades disponibles
          {filters.search && (
            <span className="ml-2 text-primary-600 font-medium">
              · Buscando: &quot;{filters.search}&quot;
            </span>
          )}
        </p>
      </motion.div>

      {/* Barra de búsqueda */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="flex flex-col sm:flex-row gap-3 mb-6"
      >
        <input
          type="text"
          placeholder="Buscar por título, dirección..."
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#242938] dark:text-white dark:placeholder-gray-500"
        />
        <motion.button
          whileHover={buttonHover}
          whileTap={buttonTap}
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-[#2e3650] rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#242938] transition-colors dark:text-gray-200"
        >
          <SlidersHorizontal size={16} />
          Filtros
          {hasFilters && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="bg-primary-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center"
            >
              !
            </motion.span>
          )}
        </motion.button>
        <AnimatePresence>
          {hasFilters && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={clearFilters}
              whileHover={buttonHover}
              whileTap={buttonTap}
              className="flex items-center gap-2 px-4 py-2.5 text-red-500 border border-red-200 rounded-xl text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
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
                ...(businessLine === 'remate'
                  ? [{ key: 'category', options: CATEGORIES, label: 'Categoría de propiedad' }]
                  : []),
              ].map(({ key, options, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {label}
                  </label>
                  <select
                    value={filters[key]}
                    onChange={(e) => setFilter(key, e.target.value)}
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
              <div>
                <label
                  htmlFor={`${filtersFormId}-maxPrice`}
                  className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"
                >
                  Precio máx.
                </label>
                <input
                  id={`${filtersFormId}-maxPrice`}
                  type="text"
                  placeholder="Ej: 1,000,000"
                  value={filters.maxPrice ? Number(filters.maxPrice).toLocaleString('es-MX') : ''}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9]/g, '');
                    setFilter('maxPrice', raw);
                  }}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500"
                />
                {filters.maxPrice && (
                  <p className="text-xs text-primary-600 mt-1">
                    $ {Number(filters.maxPrice).toLocaleString('es-MX')} MXN
                  </p>
                )}
              </div>
              {[
                { key: 'minBedrooms', options: BEDROOMS, label: 'Recámaras' },
                { key: 'minBathrooms', options: BATHROOMS, label: 'Baños' },
              ].map(({ key, options, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {label}
                  </label>
                  <select
                    value={filters[key]}
                    onChange={(e) => setFilter(key, e.target.value)}
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
                {
                  groupLabel: 'Terreno m²',
                  minKey: 'minTerrainM2',
                  maxKey: 'maxTerrainM2',
                },
                {
                  groupLabel: 'Construcción m²',
                  minKey: 'minConstructionM2',
                  maxKey: 'maxConstructionM2',
                },
              ].map(({ groupLabel, minKey, maxKey }) => (
                <div key={minKey} className="col-span-2 md:col-span-1">
                  <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    {groupLabel}
                  </span>
                  <div className="flex gap-2">
                    <div className="w-1/2">
                      <label htmlFor={`${filtersFormId}-${minKey}`} className="sr-only">
                        {groupLabel} mínimo
                      </label>
                      <input
                        id={`${filtersFormId}-${minKey}`}
                        type="number"
                        placeholder="Mín."
                        min="0"
                        value={filters[minKey]}
                        onChange={(e) => setFilter(minKey, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                    <div className="w-1/2">
                      <label htmlFor={`${filtersFormId}-${maxKey}`} className="sr-only">
                        {groupLabel} máximo
                      </label>
                      <input
                        id={`${filtersFormId}-${maxKey}`}
                        type="number"
                        placeholder="Máx."
                        min="0"
                        value={filters[maxKey]}
                        onChange={(e) => setFilter(maxKey, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 dark:border-[#2e3650] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 bg-white dark:bg-[#1a1f2e] dark:text-white dark:placeholder-gray-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alertas por email */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-8">
        <motion.button
          whileHover={buttonHover}
          whileTap={buttonTap}
          onClick={() => setShowAlertForm((v) => !v)}
          aria-expanded={showAlertForm}
          className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 sm:px-8 py-4 bg-accent-400 dark:bg-accent-500 text-primary-900 rounded-2xl text-base sm:text-lg font-bold shadow-md hover:bg-accent-300 dark:hover:bg-accent-400 active:bg-accent-500 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-300 dark:focus-visible:ring-accent-900"
        >
          <Bell size={22} className="flex-shrink-0" />
          <span>Recibir alerta cuando llegue una propiedad</span>
          <ChevronDown
            size={20}
            className={`flex-shrink-0 transition-transform ${showAlertForm ? 'rotate-180' : ''}`}
          />
        </motion.button>
        <AnimatePresence>
          {showAlertForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mt-4"
            >
              <div className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-5 shadow-sm max-w-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Te notificaremos por email cuando publiquemos una propiedad que coincida con tu
                  búsqueda.
                </p>
                <AlertSubscriptionForm />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Descargar catálogo */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-8">
        <motion.button
          whileHover={buttonHover}
          whileTap={buttonTap}
          onClick={() => setShowDownloadForm((v) => !v)}
          aria-expanded={showDownloadForm}
          className="w-full sm:w-auto flex items-center justify-center gap-3 px-6 sm:px-8 py-4 border-2 border-accent-400 dark:border-accent-500 text-accent-600 dark:text-accent-400 rounded-2xl text-base sm:text-lg font-bold hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-accent-300 dark:focus-visible:ring-accent-900"
        >
          <Download size={22} className="flex-shrink-0" />
          <span>Descargar catálogo de propiedades</span>
          <ChevronDown
            size={20}
            className={`flex-shrink-0 transition-transform ${showDownloadForm ? 'rotate-180' : ''}`}
          />
        </motion.button>
        <AnimatePresence>
          {showDownloadForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden mt-4"
            >
              <div className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-5 shadow-sm max-w-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Déjanos tus datos y descarga el catálogo completo de propiedades disponibles
                  en Excel o PDF.
                </p>
                <CatalogDownloadForm
                  filters={{
                    businessLine,
                    city: filters.city || undefined,
                    type: filters.type || undefined,
                    category: filters.category || undefined,
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Grid */}
      {isLoading ? (
        <PropertyCardSkeletonGrid
          count={6}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        />
      ) : properties.length === 0 ? (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="text-center py-20 text-gray-400"
        >
          <p className="text-xl font-medium">No se encontraron propiedades</p>
          <p className="text-sm mt-2">Intenta con otros filtros</p>
          <motion.button
            onClick={clearFilters}
            whileHover={buttonHover}
            whileTap={buttonTap}
            className="mt-4 text-primary-600 hover:underline text-sm"
          >
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
            {properties.map((property) => (
              <motion.div key={property.id} variants={fadeInUp}>
                <PropertyCard property={property} />
              </motion.div>
            ))}
          </motion.div>

          {/* Disparador de scroll infinito */}
          <div ref={sentinelRef} className="h-1" />

          {isFetchingNextPage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center items-center gap-2 mt-10 text-gray-400 text-sm"
            >
              <Loader2 size={18} className="animate-spin" /> Cargando más propiedades…
            </motion.div>
          )}

          {!hasNextPage && properties.length > 0 && (
            <p className="text-center text-gray-400 dark:text-gray-500 text-sm mt-10">
              Has llegado al final · {properties.length} de {total} propiedades
            </p>
          )}
        </>
      )}
    </motion.div>
  );
}
