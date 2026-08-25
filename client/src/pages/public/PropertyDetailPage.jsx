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
} from 'lucide-react';
import {
  getPropertyBySlug,
  getProperties,
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
import { formatPrice, formatMetric } from '../../utils/formatters';
import {
  CITY_LABELS,
  TYPE_LABELS,
  CATEGORY_LABELS,
  CATEGORY_VARIANTS,
  BUSINESS_LINE_LABELS,
  BUSINESS_LINE_VARIANTS,
  BUSINESS_LINE_CONTENT,
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
      <h3 className="font-bold text-primary-900 dark:text-gray-100 mb-4 flex items-center gap-2">
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
    queryKey: ['similar', property?.city, property?.type, property?.businessLine],
    queryFn: () =>
      getProperties({
        city: property.city,
        type: property.type,
        businessLine: property.businessLine,
        limit: 6,
      }),
    enabled: !!property,
  });
  const similar = similarData?.data?.filter((p) => p.id !== property?.id).slice(0, 3) ?? [];

  const { data: priceHistoryData } = useQuery({
    queryKey: ['property-price-history', property?.id],
    queryFn: () => getPriceHistory(property.id),
    enabled: !!property,
  });
  const priceHistory = (priceHistoryData?.data ?? []).filter((e) => e.changeType === 'price');

  const daysLeft = property?.auctionDate
    ? Math.ceil((new Date(property.auctionDate) - new Date()) / 86400000)
    : null;
  const showCountdown = daysLeft !== null && daysLeft > 0;

  const buildDescription = (p) => {
    const content = BUSINESS_LINE_CONTENT[p.businessLine] || BUSINESS_LINE_CONTENT.remate;
    const parts = [
      `${TYPE_LABELS[p.type] || p.type} ${content.descriptionSuffix}`,
      p.price ? `a ${formatPrice(p.price)}` : '',
      p.city ? `en ${CITY_LABELS[p.city]}` : '',
      p.squareMeters ? `· ${p.squareMeters} m²` : '',
      p.bedrooms ? `· ${p.bedrooms} recámaras` : '',
    ];
    return parts.filter(Boolean).join(' ');
  };

  // Título de pestaña/buscador — property.title solo (ej. "LOS ARCOS") no dice nada de tipo
  // ni ciudad, que es justo lo que la gente busca ("casa en remate en Cd. Juárez"). El <h1>
  // visible más abajo sigue usando property.title solo, este título es solo para <SEO>.
  const buildSeoTitle = (p) => {
    const content = BUSINESS_LINE_CONTENT[p.businessLine] || BUSINESS_LINE_CONTENT.remate;
    const parts = [TYPE_LABELS[p.type] || p.type, content.descriptionSuffix];
    if (p.city) parts.push(`en ${CITY_LABELS[p.city]}`);
    return `${p.title} - ${parts.join(' ')}`;
  };

  if (isLoading) return <Spinner size="lg" className="py-40" />;
  if (isError || !property)
    return (
      <div className="text-center py-40">
        <SEO title="Propiedad no encontrada" />
        <p className="text-xl text-gray-500 dark:text-gray-300">Propiedad no encontrada</p>
        <button
          onClick={() => navigate('/propiedades')}
          className="mt-4 text-primary-600 hover:underline"
        >
          Ver todas las propiedades
        </button>
      </div>
    );

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 dark:bg-[#1a1f2e]">
      <SEO
        title={buildSeoTitle(property)}
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
          className="flex items-center gap-2 text-gray-500 hover:text-primary-900 dark:hover:text-primary-300 transition-colors"
        >
          <ChevronLeft size={18} /> Regresar
        </button>
        <div className="flex items-center gap-2">
          <ComparatorButton property={property} size={18} showLabel className="h-11" />
          <FavoriteButton property={property} size={19} className="w-11 h-11" />
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
          className={`mb-6 rounded-xl px-5 py-3 flex items-center gap-3 ${daysLeft <= 7 ? 'bg-brand-red-600 text-white' : daysLeft <= 14 ? 'bg-orange-500 text-white' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'}`}
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

      {/*
        Desktop (lg:) mantiene exactamente el grid de 2 columnas original: los wrappers
        de abajo vuelven a ser bloques normales (lg:block) y el orden es el del DOM.

        Mobile usa `contents` en ambos wrappers: desaparecen como caja y sus hijos pasan
        a ser items directos de este grid de 1 columna, donde cada bloque lleva su propio
        `order-*` para reflejar la jerarquía de la ficha en mobile (precio y WhatsApp
        suben justo después de ubicación, antes de características/descripción) sin
        duplicar ningún componente. gap-0 en mobile porque cada bloque ya trae su propio
        margen inferior (mb-*) o hereda el space-y-6 del wrapper de precio/CTA — sumar
        además el gap del grid duplicaría esos espacios.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 lg:gap-10">
        <div className="contents lg:block lg:col-span-2">
          {/* Galería con lightbox — role="button" en vez de <button>: contiene sus propios
              botones (anterior/siguiente). El guard target===currentTarget evita que
              Enter/Espacio en esos botones internos también abra el lightbox. */}
          <div className="order-1">
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
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIndex ? 'border-accent-500' : 'border-transparent hover:border-gray-300'}`}
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
          </div>

          <div className="order-2 flex flex-wrap items-center gap-3 mb-4">
            {property.businessLine === 'infonavit' ? (
              <Badge variant={BUSINESS_LINE_VARIANTS.infonavit}>
                {BUSINESS_LINE_LABELS.infonavit}
              </Badge>
            ) : (
              <Badge variant={CATEGORY_VARIANTS[property.category]}>
                {property.category === 'remate'
                  ? 'Remate bancario (Cesión de Derechos)'
                  : CATEGORY_LABELS[property.category] || property.category}
              </Badge>
            )}
            {property.isFeatured && <Badge variant="primary">Destacado</Badge>}
            <span className="text-gray-400 text-sm capitalize">
              {TYPE_LABELS[property.type] || property.type}
            </span>
            {property.code && (
              <span className="text-gray-400 text-sm font-mono">· {property.code}</span>
            )}
          </div>

          <h1 className="order-3 text-2xl md:text-3xl font-bold text-primary-900 dark:text-white mb-2">
            {property.title}
          </h1>

          {/* showLocationInfo: casilla "Mostrar al público" del apartado Ubicación en el
              formulario admin — el título y la ciudad siguen mostrándose siempre (son
              estructurales: SEO, filtros del catálogo, breadcrumbs), solo se oculta esta
              línea de dirección/colonia. */}
          {property.showLocationInfo !== false && (property.address || property.colonia) && (
            <p className="order-4 flex items-center gap-1 text-gray-500 dark:text-gray-300 mb-4">
              <MapPin size={16} />
              {[property.address, property.colonia, CITY_LABELS[property.city], property.state]
                .filter(Boolean)
                .join(', ')}
            </p>
          )}

          {/* showDetailsInfo: casilla del apartado Detalles (m²/recámaras/baños). */}
          {property.showDetailsInfo !== false && (
            <div className="order-8 flex flex-wrap gap-6 text-gray-600 dark:text-gray-300 mb-6 p-6 bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl shadow-md">
              <span className="flex items-center gap-2">
                <Maximize2 size={18} className="text-primary-700 dark:text-primary-400" />
                <span>
                  <span className="font-medium">
                    {formatMetric(property.constructionMeters ?? property.squareMeters)}
                  </span>{' '}
                  M² Construcción
                </span>
              </span>
              <span className="flex items-center gap-2">
                <LandPlot size={18} className="text-primary-700 dark:text-primary-400" />
                <span>
                  <span className="font-medium">{formatMetric(property.terrainMeters)}</span> M²
                  Terreno
                </span>
              </span>
              <span className="flex items-center gap-2">
                <Bed size={18} className="text-primary-700 dark:text-primary-400" />{' '}
                {formatMetric(property.bedrooms)} Recámaras
              </span>
              <span className="flex items-center gap-2">
                <Bath size={18} className="text-primary-700 dark:text-primary-400" />{' '}
                {formatMetric(property.bathrooms)} Baños
                {property.halfBathrooms
                  ? ` + ${property.halfBathrooms} medio${property.halfBathrooms > 1 ? 's' : ''}`
                  : ''}
              </span>
            </div>
          )}

          {/* showBasicInfo: casilla del apartado Datos básicos — el título es estructural
              (H1 de la página) y siempre se muestra; solo se oculta la descripción. */}
          {property.showBasicInfo !== false && property.description && (
            <div className="order-9 mb-6">
              <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-300 mb-2">
                Descripción
              </h2>
              <p className="text-gray-600 dark:text-white leading-relaxed">{property.description}</p>
            </div>
          )}

          {/* showAuctionInfo: casilla del apartado Remate y estatus — también controla el
              historial de precio, ya que es información derivada del mismo precio. */}
          {property.showAuctionInfo !== false && priceHistory.length > 1 && (
            <div className="order-10 bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 shadow-md mb-6">
              <h2 className="text-lg font-semibold text-primary-900 dark:text-primary-300 mb-4">
                Historial de precio
              </h2>
              <PriceHistoryTimeline history={priceHistory} />
            </div>
          )}
        </div>

        {/* Ya no usa space-y-6: esa utilidad de Tailwind no solo agrega margin-top entre
            hermanos, también fija margin-bottom:0 en cada uno con una selector de mayor
            especificidad que un simple mb-6 (`.space-y-6 > :not([hidden]) ~ :not([hidden])`
            le gana a `.mb-6` sin importar el orden en la hoja de estilos) — por eso el
            mb-6 de abajo no se veía. Con margen explícito en cada bloque el resultado es
            el mismo (1.5rem entre todos), pero determinista y sin pelear con esa regla. */}
        <div className="contents lg:block lg:col-span-1">
          {/* showAuctionInfo: casilla del apartado Remate y estatus. Los botones de
              WhatsApp/cotización de abajo NO se ocultan con este apartado — siguen
              permitiendo contactar aunque el precio no se muestre. */}
          {property.showAuctionInfo !== false && (
            <div className="order-5 mb-6 bg-primary-900 text-white rounded-2xl p-6">
              <p className="text-sm text-primary-200 mb-1">
                {(BUSINESS_LINE_CONTENT[property.businessLine] || BUSINESS_LINE_CONTENT.remate)
                  .priceLabel}
              </p>
              <p
                className={`text-3xl font-bold ${property.price ? 'text-accent-400' : 'text-accent-300'}`}
              >
                {formatPrice(property.price)}
              </p>
              <p className="text-xs text-primary-300 mt-1">
                {[CITY_LABELS[property.city], property.state].filter(Boolean).join(', ')}
              </p>
            </div>
          )}

          <WhatsAppButton
            title={property.title}
            priceLabel={formatPrice(property.price)}
            url={`/propiedades/${property.slug}`}
            className="order-6 mb-6"
          />

          {/* w-full explícito en vez de confiar en el stretch por defecto del grid: un
              <button> anidado un nivel más adentro de un div contenedor perdía el ancho
              completo y se achicaba a su contenido. */}
          <DownloadQuoteButton property={property} className="order-7 w-full mb-6" />

          {property.acquisitionStage && property.acquisitionStage !== 'sin_proceso' && (
            <div className="order-7 w-full mb-6">
              <AcquisitionProgress stage={property.acquisitionStage} />
            </div>
          )}

          <div className="order-11 bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 shadow-md">
            <h3 className="font-bold text-primary-900 dark:text-primary-300 mb-4 flex items-center gap-2">
              <Phone size={18} /> Contactar asesor
            </h3>
            <ContactForm propertyId={property.id} propertyTitle={property.title} />
          </div>
        </div>
      </div>

      {similar.length > 0 && (
        <div className="mt-14">
          <h2 className="text-xl font-bold text-primary-900 dark:text-white mb-6">
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
