import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Maximize2, Bed, Bath, Building, ChevronLeft, ChevronRight, Phone, ZoomIn } from 'lucide-react';
import { getPropertyBySlug } from '../../services/propertyService';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ContactForm from '../../components/ui/ContactForm';
import SEO from '../../components/ui/SEO';
import ShareButton from '../../components/ui/ShareButton';
import FavoriteButton from '../../components/ui/FavoriteButton';
import Lightbox from '../../components/ui/Lightbox';

const statusVariant = { disponible: 'success', apartado: 'warning', vendido: 'danger' };
const statusLabel = { disponible: 'Disponible', apartado: 'Apartado', vendido: 'Vendido' };
const cityLabel = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };
const typeLabel = { casa: 'Casa', departamento: 'Departamento', terreno: 'Terreno', local: 'Local', bodega: 'Bodega' };

export default function PropertyDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [imgIndex, setImgIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '');
  const buildImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    return `${apiBase}${url}`;
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['property', slug],
    queryFn: () => getPropertyBySlug(slug),
  });

  const property = data?.data;
  const images = property?.images || [];
  const coverImage = images.find((i) => i.isCover) || images[0];
  const coverUrl = coverImage ? buildImageUrl(coverImage.url) : null;

  const formatPrice = (price) => {
    if (price === null || price === undefined || price === '') return 'PENDIENTE';
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);
  };

  const buildDescription = (p) => {
    const parts = [
      `${typeLabel[p.type] || p.type} en remate bancario`,
      p.price ? `a ${formatPrice(p.price)}` : '',
      p.city ? `en ${cityLabel[p.city]}` : '',
      p.squareMeters ? `· ${p.squareMeters} m²` : '',
      p.bedrooms ? `· ${p.bedrooms} recámaras` : '',
    ];
    return parts.filter(Boolean).join(' ');
  };

  if (isLoading) return <Spinner size="lg" className="py-40" />;
  if (isError || !property) return (
    <div className="text-center py-40">
      <SEO title="Propiedad no encontrada" />
      <p className="text-xl text-gray-500">Propiedad no encontrada</p>
      <button onClick={() => navigate('/propiedades')} className="mt-4 text-blue-600 hover:underline">
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
          apiBase={apiBase}
          onClose={() => setLightboxOpen(false)}
          onPrev={() => setImgIndex((i) => (i - 1 + images.length) % images.length)}
          onNext={() => setImgIndex((i) => (i + 1) % images.length)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-blue-900 transition-colors">
          <ChevronLeft size={18} /> Regresar
        </button>
        <div className="flex items-center gap-2">
          <FavoriteButton property={property} size={18} className="w-10 h-10" />
          <ShareButton title={property.title} url={`/propiedades/${property.slug}`} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">

          {/* Galería con lightbox */}
          <div
            className="relative bg-gray-100 dark:bg-[#242938] rounded-2xl overflow-hidden h-80 md:h-96 mb-3 cursor-zoom-in group"
            onClick={() => images.length > 0 && setLightboxOpen(true)}
          >
            {images.length > 0 ? (
              <>
                <img
                  src={buildImageUrl(images[imgIndex]?.url)}
                  alt={`${property.title} - imagen ${imgIndex + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn size={32} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {images.length > 1 && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setImgIndex((i) => (i - 1 + images.length) % images.length); }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow transition-colors">
                      <ChevronLeft size={20} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setImgIndex((i) => (i + 1) % images.length); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow transition-colors">
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
                <button key={img.id} onClick={() => setImgIndex(i)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIndex ? 'border-blue-600' : 'border-transparent hover:border-gray-300'}`}>
                  <img src={buildImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge variant={statusVariant[property.status]}>{statusLabel[property.status]}</Badge>
            {property.isFeatured && <Badge variant="primary">Destacado</Badge>}
            <span className="text-gray-400 text-sm capitalize">{typeLabel[property.type] || property.type}</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 mb-2">{property.title}</h1>

          {property.address && (
            <p className="flex items-center gap-1 text-gray-500 mb-4">
              <MapPin size={16} /> {property.address}, {cityLabel[property.city]}
            </p>
          )}

          <div className="flex flex-wrap gap-6 text-gray-600 dark:text-gray-300 mb-6 p-4 bg-gray-50 dark:bg-[#242938] rounded-xl">
            {property.constructionMeters && (
              <span className="flex items-center gap-2"><Maximize2 size={18} className="text-blue-700" />
                <span><span className="font-medium">{property.constructionMeters}</span> m² construcción</span>
              </span>
            )}
            {property.terrainMeters && (
              <span className="flex items-center gap-2"><Maximize2 size={18} className="text-blue-700" />
                <span><span className="font-medium">{property.terrainMeters}</span> m² terreno</span>
              </span>
            )}
            {!property.constructionMeters && !property.terrainMeters && property.squareMeters && (
              <span className="flex items-center gap-2"><Maximize2 size={18} className="text-blue-700" /> {property.squareMeters} m²</span>
            )}
            {property.bedrooms && <span className="flex items-center gap-2"><Bed size={18} className="text-blue-700" /> {property.bedrooms} recámaras</span>}
            {property.bathrooms && <span className="flex items-center gap-2"><Bath size={18} className="text-blue-700" /> {property.bathrooms} baños</span>}
          </div>

          {property.description && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">Descripción</h2>
              <p className="text-gray-600 leading-relaxed">{property.description}</p>
            </div>
          )}

        </div>

        <div className="space-y-6">
          <div className="bg-blue-900 text-white rounded-2xl p-6">
            <p className="text-sm text-blue-200 mb-1">Precio de remate</p>
            <p className={`text-3xl font-bold ${property.price ? 'text-yellow-400' : 'text-yellow-300'}`}>
              {formatPrice(property.price)}
            </p>
            <p className="text-xs text-blue-300 mt-1">{cityLabel[property.city]}</p>
          </div>

          <div className="bg-white dark:bg-[#242938] border border-gray-100 dark:border-[#2e3650] rounded-2xl p-6 shadow-md">
            <h3 className="font-bold text-blue-900 mb-4 flex items-center gap-2">
              <Phone size={18} /> Contactar asesor
            </h3>
            <ContactForm propertyId={property.id} propertyTitle={property.title} />
          </div>
        </div>
      </div>
    </div>
  );
}
