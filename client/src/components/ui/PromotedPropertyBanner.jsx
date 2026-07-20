import { Link } from 'react-router-dom';
import { MapPin, Maximize2, Bed, Bath, Star, ArrowRight, Building } from 'lucide-react';
import { motion } from 'framer-motion';
import Badge from './Badge';
import { buildImageUrl } from '../../utils/images';
import { formatPrice } from '../../utils/formatters';
import { CITY_LABELS, STATUS_LABELS, STATUS_VARIANTS } from '../../utils/constants';

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
          <Star size={22} className="text-yellow-400 fill-yellow-400" />
        </motion.div>
        <h2 className="text-2xl font-bold text-blue-900 dark:text-white">Propiedad Estrella</h2>
        <span className="bg-yellow-400 text-blue-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
          Oferta especial
        </span>
      </div>

      <Link to={`/propiedades/${property.slug}`} className="block group">
        <motion.div
          whileHover={{ y: -4, boxShadow: '0 24px 48px -8px rgba(0,0,0,0.2)' }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="relative bg-white dark:bg-[#242938] rounded-3xl overflow-hidden shadow-xl border-2 border-yellow-400 dark:border-yellow-500 flex flex-col md:flex-row"
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
            <div className="absolute top-4 left-4 flex gap-2">
              <Badge variant={STATUS_VARIANTS[property.status]}>{STATUS_LABELS[property.status]}</Badge>
            </div>
            <div className="absolute bottom-4 left-4 flex items-center gap-1 text-white text-sm font-medium bg-black/50 rounded-lg px-3 py-1 backdrop-blur-sm">
              <MapPin size={14} />
              {CITY_LABELS[property.city]}
            </div>
          </div>

          {/* Detalles */}
          <div className="flex flex-col justify-between p-8 flex-1">
            <div>
              <p className="text-3xl md:text-4xl font-bold text-blue-900 dark:text-yellow-400 mb-3">
                {formatPrice(property.price)}
              </p>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4 leading-snug">
                {property.title}
              </h3>
              {property.description && (
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-6 line-clamp-3">
                  {property.description}
                </p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400 mb-6">
                {property.constructionMeters && (
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1f2e] px-3 py-1.5 rounded-lg">
                    <Maximize2 size={15} className="text-blue-600 dark:text-blue-400" />
                    {property.constructionMeters} m² const.
                  </span>
                )}
                {property.terrainMeters && (
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1f2e] px-3 py-1.5 rounded-lg">
                    <Maximize2 size={15} className="text-blue-600 dark:text-blue-400" />
                    {property.terrainMeters} m² ter.
                  </span>
                )}
                {!property.constructionMeters && !property.terrainMeters && property.squareMeters && (
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1f2e] px-3 py-1.5 rounded-lg">
                    <Maximize2 size={15} className="text-blue-600 dark:text-blue-400" />
                    {property.squareMeters} m²
                  </span>
                )}
                {property.bedrooms && (
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1f2e] px-3 py-1.5 rounded-lg">
                    <Bed size={15} className="text-blue-600 dark:text-blue-400" />
                    {property.bedrooms} rec.
                  </span>
                )}
                {property.bathrooms && (
                  <span className="flex items-center gap-1.5 bg-gray-50 dark:bg-[#1a1f2e] px-3 py-1.5 rounded-lg">
                    <Bath size={15} className="text-blue-600 dark:text-blue-400" />
                    {property.bathrooms} baños
                  </span>
                )}
              </div>
            </div>

            <motion.div
              className="flex items-center gap-2 text-blue-700 dark:text-yellow-400 font-semibold"
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
