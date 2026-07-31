import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Maximize2, LandPlot, Bed, Bath, Building, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import Badge from './Badge';
import FavoriteButton from './FavoriteButton';
import ComparatorButton from './ComparatorButton';
import { buildImageUrl } from '../../utils/images';
import { formatPrice, toWhatsAppLink } from '../../utils/formatters';
import {
  CITY_LABELS,
  CATEGORY_LABELS,
  CATEGORY_VARIANTS,
  WHATSAPP_NUMBER,
} from '../../utils/constants';

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.532 5.85L.057 23.25l5.565-1.453A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.007-1.371l-.36-.214-3.305.863.88-3.217-.235-.371A9.818 9.818 0 1112 21.818z" />
  </svg>
);

export default function PropertyCard({ property }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const coverImage = property.images?.find((i) => i.isCover) || property.images?.[0];
  const imageUrl = buildImageUrl(coverImage?.url, 600);

  const daysLeft = property.auctionDate
    ? Math.ceil((new Date(property.auctionDate) - new Date()) / 86400000)
    : null;
  const showCountdown = daysLeft !== null && daysLeft > 0;
  const countdownLabel = daysLeft > 100 ? '+100' : `${daysLeft}d`;

  const waMessage = `Hola, me interesa esta propiedad: ${property.title}${property.price ? ` (${formatPrice(property.price)})` : ''}\n${window.location.origin}/propiedades/${property.slug}`;
  const waHref = toWhatsAppLink(WHATSAPP_NUMBER, waMessage);

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
              {!imageLoaded && (
                <div className="absolute inset-0 animate-pulse bg-gray-200 dark:bg-[#2e3650]" />
              )}
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
          <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
            <Badge variant={CATEGORY_VARIANTS[property.category]}>
              {CATEGORY_LABELS[property.category] || property.category}
            </Badge>
            {showCountdown && (
              <span className="flex items-center gap-1 bg-brand-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow">
                <Clock size={10} /> {countdownLabel}
              </span>
            )}
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
          <ComparatorButton
            property={property}
            size={14}
            className="absolute bottom-3 left-3 w-8 h-8"
          />
        </div>
        <div className="p-5">
          <p className="text-2xl font-bold text-primary-900 dark:text-accent-400 mb-1">
            {formatPrice(property.price)}
          </p>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2 line-clamp-2">
            {property.title}
          </h3>
          <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 text-sm mb-4">
            <MapPin size={14} />
            <span>{CITY_LABELS[property.city]}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 dark:border-[#2e3650] pt-3">
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              {property.constructionMeters && (
                <span className="flex items-center gap-1" title="Metros de construcción">
                  <Maximize2 size={14} />
                  {property.constructionMeters} m²c
                </span>
              )}
              {property.terrainMeters && (
                <span className="flex items-center gap-1" title="Metros de terreno">
                  <LandPlot size={14} />
                  {property.terrainMeters} m²t
                </span>
              )}
              {!property.constructionMeters && !property.terrainMeters && property.squareMeters && (
                <span className="flex items-center gap-1">
                  <Maximize2 size={14} />
                  {property.squareMeters} m²
                </span>
              )}
              {property.bedrooms && (
                <span className="flex items-center gap-1">
                  <Bed size={14} />
                  {property.bedrooms}
                </span>
              )}
              {property.bathrooms && (
                <span className="flex items-center gap-1">
                  <Bath size={14} />
                  {property.bathrooms}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(waHref, '_blank', 'noopener,noreferrer');
              }}
              className="text-green-600 hover:text-green-700 flex-shrink-0 p-1 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              title="Consultar por WhatsApp"
            >
              <WhatsAppIcon />
            </button>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
