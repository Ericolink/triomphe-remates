import { Link } from 'react-router-dom';
import { MapPin, Maximize2, LandPlot, Bed, Bath, Star, ArrowRight, Building } from 'lucide-react';
import { motion } from 'framer-motion';
import Badge from './Badge';
import { buildImageUrl } from '../../utils/images';
import { formatPrice } from '../../utils/formatters';
import {
  CITY_LABELS,
  CATEGORY_LABELS,
  CATEGORY_VARIANTS,
  TYPE_LABELS,
} from '../../utils/constants';

// Etiqueta pequeña en mayúsculas + valor destacado debajo — mismo patrón repetido
// para Categoría, Tipo de inmueble, Ciudad y Colonia (ver punto 6/7 del
// ticket "Propiedad Estrella": los títulos deben pesar menos que los valores).
function InfoField({ label, children }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
        {label}
      </p>
      {children}
    </div>
  );
}

export default function PromotedPropertyBanner({ property }) {
  const coverImage = property.images?.find((i) => i.isCover) || property.images?.[0];
  const imageUrl = buildImageUrl(coverImage?.url, 800);

  return (
    <section className="max-w-7xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <motion.div
          animate={{ rotate: [0, 15, -15, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <Star size={22} className="text-accent-400 fill-accent-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-primary-900 dark:text-white">Propiedad Estrella</h2>
        <span className="bg-accent-400 text-primary-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
          Oferta especial
        </span>
      </div>

      <Link to={`/propiedades/${property.slug}`} className="block group">
        <motion.div
          whileHover={{ y: -4, boxShadow: '0 24px 48px -8px rgba(0,0,0,0.2)' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative bg-white dark:bg-[#242938] rounded-3xl overflow-hidden shadow-xl border-2 border-accent-400 dark:border-accent-500 flex flex-col md:flex-row"
        >
          {/* Imagen */}
          <div className="relative w-full md:w-1/2 h-64 md:h-auto min-h-[280px] bg-gray-100 dark:bg-[#2e3650] overflow-hidden flex-shrink-0">
            {imageUrl ? (
              <motion.img
                src={imageUrl}
                alt={property.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.5 }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
                <Building size={64} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-1 text-white text-sm font-medium bg-black/50 rounded-lg px-3 py-1 backdrop-blur-sm">
              <MapPin size={14} />
              {CITY_LABELS[property.city]}
            </div>
          </div>

          {/* Detalles */}
          <div className="flex flex-col justify-between p-6 sm:p-8 flex-1">
            <div>
              <InfoField label="Precio">
                <p className="text-3xl md:text-4xl font-bold text-primary-900 dark:text-accent-400">
                  {formatPrice(property.price)}
                </p>
              </InfoField>

              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mt-3 mb-4 leading-snug">
                {property.title}
              </h3>

              {property.description && (
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6 line-clamp-3">
                  {property.description}
                </p>
              )}

              {/* Datos comerciales — grupo bien definido, mismo tratamiento visual que la
                  caja de metros/recámaras en PropertyDetailPage para mantener consistencia. */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4 bg-gray-50 dark:bg-[#1a1f2e] rounded-xl p-4 mb-6">
                <InfoField label="Categoría">
                  <Badge variant={CATEGORY_VARIANTS[property.category]}>
                    {CATEGORY_LABELS[property.category] || property.category}
                  </Badge>
                </InfoField>
                <InfoField label="Tipo de inmueble">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {TYPE_LABELS[property.type] || property.type}
                  </p>
                </InfoField>
                <InfoField label="Ciudad">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    {CITY_LABELS[property.city]}
                  </p>
                </InfoField>
                <InfoField label="Colonia">
                  <p
                    className={
                      property.colonia
                        ? 'text-sm font-semibold text-gray-800 dark:text-gray-100'
                        : 'text-sm italic text-gray-400 dark:text-gray-500'
                    }
                  >
                    {property.colonia || 'No especificada'}
                  </p>
                </InfoField>
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
                {property.constructionMeters && (
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1f2e] px-3 py-1.5 rounded-lg">
                    <Maximize2 size={15} className="text-primary-600 dark:text-primary-400" />
                    {property.constructionMeters} m²c
                  </span>
                )}
                {property.terrainMeters && (
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1f2e] px-3 py-1.5 rounded-lg">
                    <LandPlot size={15} className="text-primary-600 dark:text-primary-400" />
                    {property.terrainMeters} m²t
                  </span>
                )}
                {!property.constructionMeters &&
                  !property.terrainMeters &&
                  property.squareMeters && (
                    <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1f2e] px-3 py-1.5 rounded-lg">
                      <Maximize2 size={15} className="text-primary-600 dark:text-primary-400" />
                      {property.squareMeters} m²
                    </span>
                  )}
                {property.bedrooms && (
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1f2e] px-3 py-1.5 rounded-lg">
                    <Bed size={15} className="text-primary-600 dark:text-primary-400" />
                    {property.bedrooms} rec.
                  </span>
                )}
                {property.bathrooms && (
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1f2e] px-3 py-1.5 rounded-lg">
                    <Bath size={15} className="text-primary-600 dark:text-primary-400" />
                    {property.bathrooms} baños
                  </span>
                )}
              </div>
            </div>

            <motion.div
              className="flex items-center gap-2 text-primary-700 dark:text-accent-400 font-semibold"
              whileHover={{ x: 6 }}
              transition={{ duration: 0.2 }}
            >
              Ver detalles completos <ArrowRight size={18} />
            </motion.div>
          </div>
        </motion.div>
      </Link>
    </section>
  );
}
