import { Link } from 'react-router-dom';
import { MapPin, Maximize2, Bed, Bath, Building } from 'lucide-react';
import { motion } from 'framer-motion';
import Badge from './Badge';
import FavoriteButton from './FavoriteButton';

const statusVariant = { disponible: 'success', apartado: 'warning', vendido: 'danger' };
const statusLabel = { disponible: 'Disponible', apartado: 'Apartado', vendido: 'Vendido' };
const cityLabel = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };

const buildUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${import.meta.env.VITE_API_URL?.replace('/api', '')}${url}`;
};

export default function PropertyCard({ property }) {
  const coverImage = property.images?.find((i) => i.isCover) || property.images?.[0];
  const imageUrl = buildUrl(coverImage?.url);

  const formatPrice = (price) => {
    if (price === null || price === undefined || price === '') return 'PENDIENTE';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);
  };

  return (
    <Link to={`/propiedades/${property.slug}`} className="block">
      <motion.div
        whileHover={{ y: -6, boxShadow: '0 20px 40px -8px rgba(0,0,0,0.18)' }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className="bg-white dark:bg-[#242938] rounded-2xl overflow-hidden shadow-md border border-gray-100 dark:border-[#2e3650]"
      >
        <div className="relative h-52 bg-gray-100 dark:bg-[#2e3650] overflow-hidden">
          {imageUrl ? (
            <motion.img
              src={imageUrl}
              alt={property.title}
              className="w-full h-full object-cover"
              whileHover={{ scale: 1.07 }}
              transition={{ duration: 0.4 }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-600">
              <Building size={48} />
            </div>
          )}
          <div className="absolute top-3 left-3">
            <Badge variant={statusVariant[property.status]}>{statusLabel[property.status]}</Badge>
          </div>
          {property.isFeatured && (
            <div className="absolute top-3 right-3">
              <Badge variant="primary">Destacado</Badge>
            </div>
          )}
          <FavoriteButton
            property={property}
            size={15}
            className="absolute bottom-3 right-3 w-8 h-8"
          />
        </div>
        <div className="p-5">
          <p className="text-2xl font-bold text-blue-900 dark:text-yellow-400 mb-1">{formatPrice(property.price)}</p>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 line-clamp-2">{property.title}</h3>
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm mb-4">
            <MapPin size={14} />
            <span>{cityLabel[property.city]}</span>
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