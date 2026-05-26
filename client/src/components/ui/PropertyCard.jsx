import { Link } from 'react-router-dom';
import { MapPin, Maximize2, Bed, Bath, Building } from 'lucide-react';
import { motion } from 'framer-motion';
import Badge from './Badge';

const statusVariant = { disponible: 'success', apartado: 'warning', vendido: 'danger' };
const statusLabel = { disponible: 'Disponible', apartado: 'Apartado', vendido: 'Vendido' };
const cityLabel = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };

export default function PropertyCard({ property }) {
  const coverImage = property.images?.find((i) => i.isCover) || property.images?.[0];
  const imageUrl = coverImage
    ? `${import.meta.env.VITE_API_URL?.replace('/api', '')}${coverImage.url}`
    : null;

  const formatPrice = (price) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);

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
        </div>

        <div className="p-5">
          <p className="text-2xl font-bold text-blue-900 dark:text-yellow-400 mb-1">{formatPrice(property.price)}</p>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 line-clamp-2">
            {property.title}
          </h3>
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm mb-4">
            <MapPin size={14} />
            <span>{cityLabel[property.city]}</span>
            {property.bank && <span className="ml-auto text-xs text-gray-400 dark:text-gray-500">{property.bank}</span>}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-[#2e3650] pt-3">
            {property.squareMeters && <span className="flex items-center gap-1"><Maximize2 size={14} />{property.squareMeters} m²</span>}
            {property.bedrooms && <span className="flex items-center gap-1"><Bed size={14} />{property.bedrooms} rec</span>}
            {property.bathrooms && <span className="flex items-center gap-1"><Bath size={14} />{property.bathrooms} baños</span>}
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
