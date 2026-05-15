import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Maximize2, Bed, Bath, Building, ChevronLeft, ChevronRight, Phone } from 'lucide-react';
import { getPropertyBySlug } from '../../services/propertyService';
import Badge from '../../components/ui/Badge';
import Spinner from '../../components/ui/Spinner';
import ContactForm from '../../components/ui/ContactForm';

const statusVariant = { disponible: 'success', apartado: 'warning', vendido: 'danger' };
const statusLabel = { disponible: 'Disponible', apartado: 'Apartado', vendido: 'Vendido' };
const cityLabel = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };

export default function PropertyDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [imgIndex, setImgIndex] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['property', slug],
    queryFn: () => getPropertyBySlug(slug),
  });

  const property = data?.data;
  const images = property?.images || [];
  const apiBase = import.meta.env.VITE_API_URL?.replace('/api', '');

  const formatPrice = (price) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(price);

  if (isLoading) return <Spinner size="lg" className="py-40" />;
  if (isError || !property) return (
    <div className="text-center py-40">
      <p className="text-xl text-gray-500">Propiedad no encontrada</p>
      <button onClick={() => navigate('/propiedades')} className="mt-4 text-blue-600 hover:underline">
        Ver todas las propiedades
      </button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-blue-900 mb-6 transition-colors">
        <ChevronLeft size={18} /> Regresar
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Columna izquierda */}
        <div className="lg:col-span-2">
          {/* Galería */}
          <div className="relative bg-gray-100 rounded-2xl overflow-hidden h-80 md:h-96 mb-3">
            {images.length > 0 ? (
              <>
                <img
                  src={`${apiBase}${images[imgIndex]?.url}`}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setImgIndex((i) => (i - 1 + images.length) % images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full p-2 shadow transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => setImgIndex((i) => (i + 1) % images.length)}
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
                <button key={img.id} onClick={() => setImgIndex(i)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === imgIndex ? 'border-blue-600' : 'border-transparent'}`}>
                  <img src={`${apiBase}${img.url}`} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Info */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <Badge variant={statusVariant[property.status]}>{statusLabel[property.status]}</Badge>
            {property.isFeatured && <Badge variant="primary">Destacado</Badge>}
            <span className="text-gray-400 text-sm capitalize">{property.type}</span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-blue-900 mb-2">{property.title}</h1>

          {property.address && (
            <p className="flex items-center gap-1 text-gray-500 mb-4">
              <MapPin size={16} /> {property.address}, {cityLabel[property.city]}
            </p>
          )}

          <div className="flex flex-wrap gap-6 text-gray-600 mb-6 p-4 bg-gray-50 rounded-xl">
            {property.squareMeters && <span className="flex items-center gap-2"><Maximize2 size={18} className="text-blue-700" /> {property.squareMeters} m²</span>}
            {property.bedrooms && <span className="flex items-center gap-2"><Bed size={18} className="text-blue-700" /> {property.bedrooms} recámaras</span>}
            {property.bathrooms && <span className="flex items-center gap-2"><Bath size={18} className="text-blue-700" /> {property.bathrooms} baños</span>}
          </div>

          {property.description && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">Descripción</h2>
              <p className="text-gray-600 leading-relaxed">{property.description}</p>
            </div>
          )}

          {(property.bank || property.loanNumber) && (
            <div className="p-4 bg-blue-50 rounded-xl">
              <h2 className="text-sm font-semibold text-blue-900 mb-2">Datos del remate</h2>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                {property.bank && <span><strong>Banco:</strong> {property.bank}</span>}
                {property.loanNumber && <span><strong>No. crédito:</strong> {property.loanNumber}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div className="space-y-6">
          <div className="bg-blue-900 text-white rounded-2xl p-6">
            <p className="text-sm text-blue-200 mb-1">Precio de remate</p>
            <p className="text-3xl font-bold text-yellow-400">{formatPrice(property.price)}</p>
            <p className="text-xs text-blue-300 mt-1">{cityLabel[property.city]}</p>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-md">
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
