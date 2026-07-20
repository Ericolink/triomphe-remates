import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitCompare, X, MapPin, Building, PackageX } from 'lucide-react';
import useComparator from '../../hooks/useComparator';
import usePropertySync from '../../hooks/usePropertySync';
import SEO from '../../components/ui/SEO';
import Badge from '../../components/ui/Badge';
import SyncStatusBar from '../../components/ui/SyncStatusBar';
import { fadeInUp, staggerContainer } from '../../utils/animations';
import { buildImageUrl } from '../../utils/images';
import { formatPrice } from '../../utils/formatters';
import { CITY_LABELS, TYPE_LABELS, STATUS_LABELS, STATUS_VARIANTS } from '../../utils/constants';

const val = (v, unit = '') => (v != null && v !== '') ? `${v}${unit}` : <span className="text-gray-300 dark:text-gray-600">—</span>;
const notAvailable = () => <span className="text-gray-300 dark:text-gray-600 italic">No disponible</span>;

const ROWS = [
  { label: 'Precio',         render: (p) => <span className="font-bold text-blue-900 dark:text-yellow-400">{formatPrice(p.price)}</span> },
  { label: 'Ciudad',         render: (p) => val(CITY_LABELS[p.city] || p.city) },
  { label: 'Tipo',           render: (p) => val(TYPE_LABELS[p.type] || p.type) },
  { label: 'Estatus',        render: (p) => <Badge variant={STATUS_VARIANTS[p.status]}>{STATUS_LABELS[p.status] || p.status}</Badge> },
  { label: 'Construcción',   render: (p) => val(p.constructionMeters, ' m²') },
  { label: 'Terreno',        render: (p) => val(p.terrainMeters, ' m²') },
  { label: 'Recámaras',      render: (p) => val(p.bedrooms) },
  { label: 'Baños',          render: (p) => val(p.bathrooms) },
  { label: 'Dirección',      render: (p) => p.address ? <span className="text-xs">{p.address}</span> : <span className="text-gray-300 dark:text-gray-600">—</span> },
];

export default function ComparatorPage() {
  const { items: stored, clear, toggle, patchMany } = useComparator();
  const { items, syncState, retry } = usePropertySync(stored, { onUpdate: patchMany });

  if (items.length < 2) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <SEO title="Comparar propiedades" url="/comparar" />
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <GitCompare size={52} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Comparador de propiedades</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">Agrega al menos 2 propiedades para compararlas.</p>
          <Link to="/propiedades" className="px-6 py-3 bg-blue-900 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors">
            Ver propiedades
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <SEO title="Comparar propiedades" url="/comparar" />
      <motion.div variants={staggerContainer} initial="hidden" animate="visible"
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <motion.div variants={fadeInUp}>
          <h1 className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-white flex items-center gap-2">
            <GitCompare size={22} className="flex-shrink-0" />
            <span>Comparando {items.length} propiedades</span>
          </h1>
        </motion.div>
        <motion.button variants={fadeInUp} onClick={clear}
          className="self-start sm:self-auto text-sm text-red-500 border border-red-200 dark:border-red-800 px-4 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors whitespace-nowrap">
          Limpiar comparador
        </motion.button>
      </motion.div>

      <SyncStatusBar syncState={syncState} onRetry={retry} />

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr>
              <th className="w-24 sm:w-32 md:w-40" />
              {items.map((p) => (
                <th key={p.id} className="px-2 sm:px-3 pb-4 align-top">
                  <div className={`bg-white dark:bg-[#242938] rounded-2xl overflow-hidden border shadow-sm ${p.unavailable ? 'border-dashed border-gray-200 dark:border-[#2e3650] opacity-60' : 'border-gray-100 dark:border-[#2e3650]'}`}>
                    <div className="relative h-24 sm:h-32 md:h-40 bg-gray-100 dark:bg-[#2e3650]">
                      {p.unavailable ? (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                          <PackageX size={32} />
                        </div>
                      ) : p.images?.[0] ? (
                        <img src={buildImageUrl(p.images[0].url, 300)} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                          <Building size={36} />
                        </div>
                      )}
                      <button onClick={() => toggle(p)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                    <div className="p-2 sm:p-3">
                      {p.unavailable ? (
                        <p className="font-semibold text-xs sm:text-sm text-gray-400 dark:text-gray-500 line-clamp-2">{p.title}</p>
                      ) : (
                        <Link to={`/propiedades/${p.slug}`} className="font-semibold text-xs sm:text-sm text-gray-800 dark:text-gray-100 hover:text-blue-600 line-clamp-2 block">
                          {p.title}
                        </Link>
                      )}
                      {p.unavailable ? (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Ya no disponible</p>
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                          <MapPin size={10} className="flex-shrink-0" /> {CITY_LABELS[p.city] || p.city}
                        </p>
                      )}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map(({ label, render }) => (
              <tr key={label} className="border-t border-gray-100 dark:border-[#2e3650]">
                <td className="py-3 pr-2 sm:pr-4 text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">{label}</td>
                {items.map((p) => (
                  <td key={p.id} className="px-2 sm:px-3 py-3 text-xs sm:text-sm text-gray-700 dark:text-gray-200 text-center">
                    {p.unavailable ? notAvailable() : render(p)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 justify-center">
        {items.filter((p) => !p.unavailable).map((p) => (
          <Link key={p.id} to={`/propiedades/${p.slug}`}
            className="px-5 py-2.5 bg-blue-900 text-white rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors">
            Ver {p.title.slice(0, 20)}…
          </Link>
        ))}
      </div>
    </div>
  );
}
