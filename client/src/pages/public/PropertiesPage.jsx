import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  X,
  Bell,
  Download,
  ChevronDown,
  Loader2,
  Gavel,
  CreditCard,
  KeyRound,
  Banknote,
  TrendingUp,
  EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getPublicProperties } from '../../services/propertyService';
import PropertyCard from '../../components/ui/PropertyCard';
import { PropertyCardSkeletonGrid } from '../../components/ui/PropertyCardSkeleton';
import SEO from '../../components/ui/SEO';
import TabBar from '../../components/ui/TabBar';
import AlertSubscriptionForm from '../../components/ui/AlertSubscriptionForm';
import CatalogDownloadForm from '../../components/ui/CatalogDownloadForm';
import ContactForm from '../../components/ui/ContactForm';
import PropertyFilterFields from '../../components/ui/PropertyFilterFields';
import { fadeInUp, fadeIn, staggerContainer, buttonHover, buttonTap } from '../../utils/animations';
import { BUSINESS_LINE_CONTENT } from '../../utils/constants';

// Selector de inventario dentro del mismo módulo de propiedades — las 5 líneas de negocio
// conviven en /propiedades sin landing separada; el cambio de tab solo actualiza qué
// `businessLine` se consulta, no navega a otra ruta. Mismas claves/labels que
// BUSINESS_LINE_TABS en pages/admin/PropertyFormPage.jsx.
const PROPERTY_LINE_TABS = [
  { key: 'remate', label: 'Remates Bancarios', icon: <Gavel size={16} /> },
  { key: 'credito', label: 'Con Crédito', icon: <CreditCard size={16} /> },
  { key: 'renta', label: 'En Renta', icon: <KeyRound size={16} /> },
  { key: 'contado', label: 'De Contado', icon: <Banknote size={16} /> },
  { key: 'inversion', label: 'Inversiones', icon: <TrendingUp size={16} /> },
];

export default function PropertiesPage() {
  const [businessLine, setBusinessLine] = useState('remate');
  const content = BUSINESS_LINE_CONTENT[businessLine];
  const [searchParams, setSearchParams] = useSearchParams();
  const [showAlertForm, setShowAlertForm] = useState(false);
  const [showDownloadForm, setShowDownloadForm] = useState(false);
  const [localFilters, setLocalFilters] = useState({
    city: '',
    type: '',
    category: '',
    minPrice: '',
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
    minPrice: localFilters.minPrice,
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
      getPublicProperties({ ...filters, businessLine, page: pageParam, limit: 12 }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, hasNext } = lastPage.pagination;
      return hasNext ? page + 1 : undefined;
    },
  });

  const properties = data?.pages?.flatMap((p) => p.data) ?? [];
  const total = data?.pages?.[0]?.pagination?.total ?? 0;
  // Backend responde `propertiesAvailable: false` (en vez de una lista vacía) cuando el
  // admin desactivó publicPropertiesEnabled — así se distingue "sin resultados para estos
  // filtros" de "la sección está temporalmente desactivada" (ver propertyController.js).
  const propertiesUnavailable = data?.pages?.[0]?.propertiesAvailable === false;

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
  // y no tiene sentido (ni opción visible) en el resto de las líneas.
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
      minPrice: '',
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
    filters.minPrice ||
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
          {propertiesUnavailable ? (
            'Propiedades no disponibles'
          ) : (
            <>
              {total || '...'} propiedades disponibles
              {filters.search && (
                <span className="ml-2 text-primary-600 font-medium">
                  · Buscando: &quot;{filters.search}&quot;
                </span>
              )}
            </>
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
              <X size={16} /> Limpiar filtros
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Filtros — siempre visibles */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="mb-6 p-4 bg-gray-50 dark:bg-[#242938] rounded-xl border border-transparent dark:border-[#2e3650]"
      >
        <PropertyFilterFields
          filters={filters}
          onChange={setFilter}
          showCategory={businessLine === 'remate'}
        />
      </motion.div>

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
          <span>Solicitar catálogo de propiedades</span>
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
              <div className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-5 shadow-sm max-w-2xl">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Elige los filtros del inventario que quieres recibir y déjanos tus datos de
                  contacto.
                </p>
                <CatalogDownloadForm
                  filters={{
                    businessLine,
                    city: filters.city || undefined,
                    type: filters.type || undefined,
                    category: filters.category || undefined,
                    search: filters.search || undefined,
                    minPrice: filters.minPrice || undefined,
                    maxPrice: filters.maxPrice || undefined,
                    minBedrooms: filters.minBedrooms || undefined,
                    minBathrooms: filters.minBathrooms || undefined,
                    minTerrainM2: filters.minTerrainM2 || undefined,
                    maxTerrainM2: filters.maxTerrainM2 || undefined,
                    minConstructionM2: filters.minConstructionM2 || undefined,
                    maxConstructionM2: filters.maxConstructionM2 || undefined,
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
      ) : propertiesUnavailable ? (
        <motion.div
          variants={fadeIn}
          initial="hidden"
          animate="visible"
          className="text-center py-16 px-6 max-w-lg mx-auto"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gray-100 dark:bg-[#242938] flex items-center justify-center mb-5">
            <EyeOff size={26} className="text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-xl font-semibold text-primary-900 dark:text-white">
            Propiedades no disponibles
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-8">
            Actualmente el listado no está disponible en línea, pero cuéntanos qué buscas y un
            asesor te contacta directamente.
          </p>
          {/* Con publicPropertiesEnabled=false el listado se oculta, pero el negocio sigue
              activo — este formulario mantiene abierto el único canal de contacto público de
              la sección, y llega al CRM como cualquier otro prospecto (createPublicLead). */}
          <div className="text-left bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 shadow-md">
            {/* 'otro': Lead.source es un ENUM de MySQL (ver Lead.js) — no admite un valor
                libre como 'propiedades-no-disponibles'. */}
            <ContactForm defaultSource="otro" />
          </div>
        </motion.div>
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
