import { forwardRef } from 'react';
import Badge from './Badge';
import { buildImageUrl } from '../../utils/images';
import { formatPrice } from '../../utils/formatters';
import { CITY_LABELS, TYPE_LABELS, STATUS_LABELS, STATUS_VARIANTS, OFFICES, WHATSAPP_NUMBER } from '../../utils/constants';

// Plantilla de la ficha técnica descargable (ver DownloadQuoteButton, que la rasteriza a
// PNG con html2canvas). Antes esto se dibujaba en el backend con pdfkit — ahora es HTML/CSS
// normal, así que replica el mismo contenido de la versión en PDF con los componentes y
// tokens de marca (primary-900/accent-400) que ya existen en el resto del sitio. Nunca usa
// clases `dark:` a propósito: la ficha debe verse igual sin importar el tema activo del sitio.
const FichaTecnica = forwardRef(function FichaTecnica({ property }, ref) {
  const coverImage = property.images?.find((img) => img.isCover) || property.images?.[0];
  const coverUrl = buildImageUrl(coverImage?.url, 1200);

  const locationRows = [
    property.city && { label: 'Ciudad', value: CITY_LABELS[property.city] || property.city },
    property.state && { label: 'Estado', value: property.state },
    property.colonia && { label: 'Fraccionamiento/Colonia', value: property.colonia },
    property.address && { label: 'Calle', value: property.address },
  ].filter(Boolean);

  const featureRows = [
    { label: 'Tipo', value: TYPE_LABELS[property.type] || property.type },
    property.terrainMeters && { label: 'M² terreno', value: `${property.terrainMeters} m²` },
    property.constructionMeters && {
      label: 'M² construcción',
      value: `${property.constructionMeters} m²`,
    },
    !property.terrainMeters &&
      !property.constructionMeters &&
      property.squareMeters && { label: 'M²', value: `${property.squareMeters} m²` },
    property.bedrooms && { label: 'Recámaras', value: String(property.bedrooms) },
    property.bathrooms && { label: 'Baños completos', value: String(property.bathrooms) },
    property.halfBathrooms && { label: 'Medios baños', value: String(property.halfBathrooms) },
  ].filter(Boolean);

  const generatedAt = new Date().toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div ref={ref} style={{ width: 900 }} className="bg-white text-gray-800">
      <div className="bg-primary-900 px-10 py-6 flex items-center justify-between">
        <img src="/logo.png" alt="Triomphe" className="h-11 w-auto brightness-0 invert" />
        <div className="text-right">
          <p className="text-accent-400 text-sm font-bold tracking-wide">
            FICHA DE PROPIEDAD EN REMATE
          </p>
          <p className="text-white text-xs mt-1">Generado el {generatedAt}</p>
        </div>
      </div>

      <div style={{ height: 340 }} className="w-full bg-gray-100 flex items-center justify-center overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            crossOrigin="anonymous"
            alt={property.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <p className="text-gray-400 text-sm">Sin imagen disponible</p>
        )}
      </div>

      <div className="px-10 py-8">
        <div className="flex items-center justify-between mb-4">
          <Badge variant={STATUS_VARIANTS[property.status]}>
            {STATUS_LABELS[property.status] || property.status}
          </Badge>
          {property.code && (
            <span className="text-gray-400 text-sm font-mono">{property.code}</span>
          )}
        </div>

        <h1 className="text-primary-900 text-3xl font-bold mb-2">{property.title}</h1>
        <p className={`text-4xl font-bold mb-6 ${property.price ? 'text-accent-500' : 'text-accent-300'}`}>
          {formatPrice(property.price)}
        </p>

        {locationRows.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-5 mb-4">
            <p className="text-accent-600 text-xs font-bold tracking-wide mb-3">UBICACIÓN</p>
            <div className="grid grid-cols-2 gap-4">
              {locationRows.map((row) => (
                <div key={row.label}>
                  <p className="text-gray-500 text-[10px] font-bold tracking-wide uppercase">
                    {row.label}
                  </p>
                  <p className="text-gray-800 text-sm mt-0.5">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {featureRows.length > 0 && (
          <div className="bg-gray-50 rounded-xl p-5 mb-6">
            <p className="text-accent-600 text-xs font-bold tracking-wide mb-3">CARACTERÍSTICAS</p>
            <div className="grid grid-cols-3 gap-4">
              {featureRows.map((row) => (
                <div key={row.label}>
                  <p className="text-gray-500 text-[10px] font-bold tracking-wide uppercase">
                    {row.label}
                  </p>
                  <p className="text-gray-800 text-sm mt-0.5">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {property.description && (
          <div>
            <p className="text-primary-900 font-bold text-lg mb-2">Descripción</p>
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">
              {property.description}
            </p>
          </div>
        )}
      </div>

      <div className="bg-primary-900 px-10 py-6 grid grid-cols-2 gap-8">
        <div>
          <p className="text-accent-400 text-sm font-bold mb-2">
            ¿Te interesa esta propiedad? Contáctanos:
          </p>
          <p className="text-white text-xs">Tel / WhatsApp: {OFFICES[0].phone}</p>
          <p className="text-white text-xs mt-1">Email: {OFFICES[0].email}</p>
          <p className="text-white text-xs mt-1">https://wa.me/{WHATSAPP_NUMBER}</p>
        </div>
        <div>
          <p className="text-accent-400 text-xs font-bold mb-2">Oficinas</p>
          {OFFICES.map((office) => (
            <p key={office.city} className="text-white text-xs mb-1">
              {office.cityLabel}: {office.street}, {office.location}
            </p>
          ))}
        </div>
      </div>
      <p className="bg-primary-900 text-gray-400 text-[10px] text-center pb-4">
        © Triomphe Bienes Raíces — Documento informativo. Precio e información sujetos a cambios
        sin previo aviso.
      </p>
    </div>
  );
});

export default FichaTecnica;
