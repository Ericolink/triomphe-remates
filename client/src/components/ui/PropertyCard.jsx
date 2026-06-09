import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Maximize2, Bed, Bath, Building } from 'lucide-react';
import { motion } from 'framer-motion';
import Badge from './Badge';
import FavoriteButton from './FavoriteButton';
import ComparatorButton from './ComparatorButton';
import { buildImageUrl } from '../../utils/images';
import { formatPrice } from '../../utils/formatters';
import { CITY_LABELS, STATUS_LABELS, STATUS_VARIANTS } from '../../utils/constants';

export default function PropertyCard({ property }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const coverImage = property.images?.find((i) => i.isCover) || property.images?.[0];
  const imageUrl = buildImageUrl(coverImage?.url, 600);

  return (
    <Link to={`/propiedades/${property.slug}`} className="block">
      <motion.div
        whileHover={{ y: -6, boxShadow: '0 20px 40px -8px rgba(0,0,0,0.18)' }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-white dark:bg-[#242938] rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-[#2e3650]"
      >
        <div className="relative h-52 bg-gray-100 dark:bg-[#2e3650] overflow-hidden">
          {imageUrl ? (
            <>
              {!imageLoaded && <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-[#2e3650]" />}
              <motion.img
                src={imageUrl}
                alt={property.title}
                loading="lazy"
                decoding="async"
                onLoad={() => setImageLoaded(true)}
                className="w-full h-full object-cover"
                initial={{ opacity: 0 }}
                animate={{ opacity: imageLoaded ? 1 : 0 }}
                whileHover={{ scale: 1.07 }}
                transition={{ duration: 0.4 }}
              />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
              <Building size={48} />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <Badge variant={STATUS_VARIANTS[property.status]}>{STATUS_LABELS[property.status]}</Badge>
          </div>
          {property.isFeatured && (
            <div className="absolute top-3 right-3">
              <Badge variant="primary">Destacado</Badge>
            </div>
          )}
          <FavoriteButton property={property} size={15} className="absolute bottom-3 right-3 w-8 h-8" />
          <ComparatorButton property={property} size={14} className="absolute bottom-3 left-3 w-8 h-8" />
        </div>
        <div className="p-5">
          <p className="text-2xl font-bold text-blue-900 dark:text-yellow-400 mb-1">{formatPrice(property.price)}</p>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 line-clamp-2">{property.title}</h3>
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm mb-4">
            <MapPin size={14} />
            <span>{CITY_LABELS[property.city]}</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-[#2e3650] pt-3">
            {property.constructionMeters && <span className="flex items-center gap-1"><Maximize2 size={14} />{property.constructionMeters} m² const.</span>}
            {property.terrainMeters && <span className="flex items-center gap-1"><Maximize2 size={14} />{property.terrainMeters} m² ter.</span>}
            {!property.constructionMeters && !property.terrainMeters && property.squareMeters && <span className="flex items-center gap-1"><Maximize2 size={14} />{property.squareMeters} m²</span>}
            {property.bedrooms && <span className="flex items-center gap-1"><Bed size={14} />{property.bedrooms} rec</span>}
            {property.bathrooms && <span className="flex items-center gap-1"><Bath size={14} />{property.bathrooms} baños</span>}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}