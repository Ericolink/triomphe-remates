import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Maximize2,
  LandPlot,
  Bed,
  Bath,
  Building,
  ChevronLeft,
  ChevronRight,
  Phone,
  ZoomIn,
  Clock,
  CheckCircle2,
  FileText,
  Download,
} from 'lucide-react';
import {
  getPropertyBySlug,
  getProperties,
  getDocuments,
  getPriceHistory,
  trackView,
} from '../../services/propertyService';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ContactForm from '../../components/ui/ContactForm';
import SEO from '../../components/ui/SEO';
import ShareButton from '../../components/ui/ShareButton';
import WhatsAppButton from '../../components/ui/WhatsAppButton';
import DownloadQuoteButton from '../../components/ui/DownloadQuoteButton';
import FavoriteButton from '../../components/ui/FavoriteButton';
import ComparatorButton from '../../components/ui/ComparatorButton';
import PropertyCard from '../../components/ui/PropertyCard';
import Lightbox from '../../components/ui/Lightbox';
import PriceHistoryTimeline from '../../components/ui/PriceHistoryTimeline';
import { buildImageUrl } from '../../utils/images';
import { formatPrice } from '../../utils/formatters';
import {
  CITY_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_VARIANTS,
  ACQUISITION_STAGE_LABELS,
  labelsToOptions,
} from '../../utils/constants';

const ACQUISITION_STAGES = labelsToOptions(ACQUISITION_STAGE_LABELS, ['sin_proceso']).map(
  ({ value, label }) => ({ key: value, label })
);

function AcquisitionProgress({ stage }) {
  const currentIdx = ACQUISITION_STAGES.findIndex((s) => s.key === stage);
  if (currentIdx === -1) return null;
  const isComplete = stage === 'entrega';
  return (
    <div className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 shadow-md">
      <h3 className="font-bold text-blue-900 dark:text-gray-100 mb-4 flex items-center gap-2">
        <CheckCircle2 size={18} className={isComplete ? 'text-green-500' : 'text-yellow-500'} />{' '}
        Proceso de adquisición
      </h3>
      <div className="flex items-center gap-1">
        {ACQUISITION_STAGES.map((s, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full h-1.5 rounded-full ${i === 0 ? 'rounded-l-full' : ''} ${i === ACQUISITION_STAGES.length - 1 ? 'rounded-r-full' : ''} ${done ? (isComplete ? 'bg-green-500' : 'bg-yellow-500') : 'bg-gray-200 dark:bg-[#2e3650]'}`}
              />
              <span
                className={`text-xs font-medium text-center leading-tight ${active ? (isComplete ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400') : done ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PropertyDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [imgIndex, setImgIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['property', slug],
    queryFn: () => getPropertyBySlug(slug),
  });

  const property = data?.data;
  const images = property?.images || [];
  const coverImage = images.find((i) => i.isCover) || images[0];
  const coverUrl = coverImage ? buildImageUrl(coverImage.url, 1200) : null;

  // Única fuente de vistas reales: se dispara al cargar la ficha pública, nunca desde el
  // panel admin (que usa getPropertyById, sin efectos secundarios). Ver propertyController.
  useEffect(() => {
    if (property?.id) trackView(property.id).catch(() => {});
  }, [property?.id]);

  const { data: similarData } = useQuery({
    queryKey: ['similar', property?.city, property?.type],
    queryFn: () => getProperties({ city: property.city, type: property.type, limit: 6 }),
    enabled: !!property,
  });
  const similar = similarData?.data?.filter((p) => p.id !== property?.id).slice(0, 3) ?? [];

  const { data: documents } = useQuery({
    queryKey: ['property-documents', property?.id],
    queryFn: () => getDocuments(property.id),
    enabled: !!property,
  });

  const { data: priceHistoryData } = useQuery({
    queryKey: ['property-price-history', property?.id],
    queryFn: () => getPriceHistory(property.id),
    enabled: !!property,
  });
  const priceHistory = priceHistoryData?.data ?? [];

  const daysLeft = property?.auctionDate
    ? Math.ceil((new Date(property.auctionDate) - new Date()) / 86400000)
    : null;
  const showCountdown = daysLeft !== null && daysLeft > 0;

  const buildDescription = (p) => {
    const parts = [
      `${TYPE_LABELS[p.type] || p.type} en remate bancario`,
      p.price ? `a ${formatPrice(p.price)}` : '',
      p.city ? `en ${CITY_LABELS[p.city]}` : '',
      p.squareMeters ? `· ${p.squareMeters} m²` : '',
      p.bedrooms ? `· ${p.bedrooms} recámaras` : '',
    ];
    return parts.filter(Boolean).join(' ');
  };

  if (isLoading) return <Spinner size="lg" className="py-40" />;
  if (isError || !property)
    return (
      <div className="text-center py-40">
        <SEO title="Propiedad no encontrada" />
        <p className="text-xl text-gray-500">Propiedad no encontrada</p>
        <button
          onClick={() => navigate('/propiedades')}
          className="mt-4 text-blue-600 hover:underline"
        >
          Ver todas las propiedades
        </button>
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 dark:bg-[#1a1f2e]">
      <SEO
        title={property.title}
        description={buildDescription(property)}
        image={coverUrl}
        url={`/propiedades/${property.slug}`}
        type="article"
        property={property}
      />

      {lightboxOpen && (
        <Lightbox
          images={images}
          currentIndex={imgIndex}
          onClose={() => setLightboxOpen(false)}
          onPrev={() => setImgIndex((i) => (i - 1 + images.length) % images.length)}
          onNext={() => setImgIndex((i) => (i + 1) % images.length)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-blue-900 dark:hover:text-blue-300 transition-colors"
        >
          <ChevronLeft size={18} /> Regresar
        </button>
        <div className="flex items-center gap-2">
          <ComparatorButton property={property} size={18} className="w-10 h-10" />
          <FavoriteButton property={property} size={18} className="w-10 h-10" />
          <ShareButton
            title={property.title}
            subtitle={`${formatPrice(property.price)} · ${CITY_LABELS[property.city]}`}
            url={`/propiedades/${property.slug}`}
            propertyId={property.id}
          />
        </div>
      </div>

      {showCountdown && (
        <div
          className={`mb-6 rounded-xl px-5 py-3 flex items-center gap-3 ${daysLeft <= 7 ? 'bg-red-600 text-white' : daysLeft <= 14 ? 'bg-orange-500 text-white' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'}`}
        >
          <Clock size={18} className="flex-shrink-0" />
          <span className="font-semibold text-sm">
            {daysLeft === 1 ? '¡El remate es mañana!' : `Remate en ${daysLeft} días`}
          </span>
          <span className="text-sm opacity-80">
            —{' '}
            {new Date(property.auctionDate).toLocaleDateString('es-MX', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          {/* Galería con lightbox — role="button" en vez de <button>: contiene sus propios
              botones (anterior/siguiente). El guard target===currentTarget evita que
              Enter/Espacio en esos botones internos también abra el lightbox. */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Ver imágenes en pantalla completa"
            className="relative bg-gray-100 dark:bg-[#242938] rounded-2xl overflow-hidden h-80 md:h-96 mb-3 cursor-zoom-in group"
            onClick={() => images.length > 0 && setLightboxOpen(true)}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (images.length > 0) setLightboxOpen(true);
              }
            }}
          >
            {images.length > 0 ? (
              <>
                <img
                  src={buildImageUrl(images[imgIndex]?.url, 1000)}
                  alt={`${property.title} - imagen ${imgIndex + 1}`}
                  fetchPriority="high"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn
                    size={32}
                    className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </div>
                {images.length > 1 && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setImgIndex((i) => (i - 1 + images.length) % images.length);
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setImgIndex((i) => (i + 1) % images.length);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                    <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                      {imgIndex + 1} / {images.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                <Building size={64} />
              </div>
            )}
          </div>

          {/* Thumbnails */}
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setImgIndex(i)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIndex ? 'border-blue-600' : 'border-transparent hover:border-gray-300'}`}
                >
                  <img
                    src={buildImageUrl(img.url, 120)}
                    alt={`Miniatura ${i + 1} de ${property.title}`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge variant={STATUS_VARIANTS[property.status]}>
              {STATUS_LABELS[property.status]}
            </Badge>
            {property.isFeatured && <Badge variant="primary">Destacado</Badge>}
            <span className="text-gray-400 text-sm capitalize">
              {TYPE_LABELS[property.type] || property.type}
            </span>
            {property.code && (
              <span className="text-gray-400 text-sm font-mono">· {property.code}</span>
            )}
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 dark:text-white mb-2">
            {property.title}
          </h1>

          {property.address && (
            <p className="flex items-center gap-1 text-gray-500 mb-4">
              <MapPin size={16} /> {property.address}, {CITY_LABELS[property.city]}
            </p>
          )}

          <div className="flex flex-wrap gap-6 text-gray-600 dark:text-gray-300 mb-6 p-4 bg-gray-50 dark:bg-[#242938] rounded-xl">
            {property.constructionMeters && (
              <span className="flex items-center gap-2">
                <Maximize2 size={18} className="text-blue-700 dark:text-blue-400" />
                <span>
                  <span className="font-medium">{property.constructionMeters}</span> m² construcción
                </span>
              </span>
            )}
            {property.terrainMeters && (
              <span className="flex items-center gap-2">
                <LandPlot size={18} className="text-blue-700 dark:text-blue-400" />
                <span>
                  <span className="font-medium">{property.terrainMeters}</span> m² terreno
                </span>
              </span>
            )}
            {!property.constructionMeters && !property.terrainMeters && property.squareMeters && (
              <span className="flex items-center gap-2">
                <Maximize2 size={18} className="text-blue-700 dark:text-blue-400" />{' '}
                {property.squareMeters} m²
              </span>
            )}
            {property.bedrooms && (
              <span className="flex items-center gap-2">
                <Bed size={18} className="text-blue-700 dark:text-blue-400" /> {property.bedrooms}{' '}
                recámaras
              </span>
            )}
            {property.bathrooms && (
              <span className="flex items-center gap-2">
                <Bath size={18} className="text-blue-700 dark:text-blue-400" /> {property.bathrooms}{' '}
                baños
              </span>
            )}
          </div>

          {property.description && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2">
                Descripción
              </h2>
              <p className="text-gray-600 leading-relaxed">{property.description}</p>
            </div>
          )}

          {documents?.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2">
                Documentos
              </h2>
              <div className="space-y-2">
                {documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 bg-gray-50 dark:bg-[#1a1f2e] border border-gray-100 dark:border-[#2e3650] rounded-xl px-4 py-3 hover:bg-gray-100 dark:hover:bg-[#2e3650] transition-colors"
                  >
                    <FileText size={18} className="text-blue-700 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
                      {doc.name}
                    </span>
                    <Download size={16} className="text-gray-400 flex-shrink-0" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {priceHistory.length > 1 && (
            <div className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 shadow-md mb-6">
              <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-4">
                Historial de precio
              </h2>
              <PriceHistoryTimeline history={priceHistory} />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-blue-900 text-white rounded-2xl p-6">
            <p className="text-sm text-blue-200 mb-1">Precio de remate</p>
            <p
              className={`text-3xl font-bold ${property.price ? 'text-yellow-400' : 'text-yellow-300'}`}
            >
              {formatPrice(property.price)}
            </p>
            <p className="text-xs text-blue-300 mt-1">{CITY_LABELS[property.city]}</p>
          </div>

          <WhatsAppButton
            title={property.title}
            priceLabel={formatPrice(property.price)}
            url={`/propiedades/${property.slug}`}
          />

          <DownloadQuoteButton propertyId={property.id} slug={property.slug} />

          {property.acquisitionStage && property.acquisitionStage !== 'sin_proceso' && (
            <AcquisitionProgress stage={property.acquisitionStage} />
          )}

          <div className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 shadow-md">
            <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-4 flex items-center gap-2">
              <Phone size={18} /> Contactar asesor
            </h3>
            <ContactForm propertyId={property.id} propertyTitle={property.title} />
          </div>
        </div>
      </div>

      {similar.length > 0 && (
        <div className="mt-14">
          <h2 className="text-xl font-bold text-blue-900 dark:text-white mb-6">
            Propiedades similares
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {similar.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
