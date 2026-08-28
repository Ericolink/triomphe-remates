import { forwardRef } from 'react';
import { BedDouble, Bath, Droplets, Maximize2, LandPlot, MapPin } from 'lucide-react';
import Badge from './Badge';
import { buildImageUrl } from '../../utils/images';
import { formatPrice } from '../../utils/formatters';
import {
  CITY_LABELS,
  TYPE_LABELS,
  STATUS_LABELS,
  STATUS_VARIANTS,
  CATEGORY_LABELS,
  OFFICES,
  WHATSAPP_NUMBER,
} from '../../utils/constants';

// Plantilla de la ficha técnica descargable (ver DownloadQuoteButton, que la rasteriza a PNG
// con html2canvas). El contenedor tiene ancho y alto FIJOS (proporción A4) con overflow oculto:
// esa es la garantía real de "una sola ficha, una sola página": el alto NO es fijo (una propiedad
// con poca información no debe arrastrar un hueco en blanco hasta el pie) — cada sección crece
// solo lo que su contenido necesita (hero y footer sí son de altura fija, para mantener el
// mismo "esqueleto" de marca en todas las fichas), y `maxHeight` + overflow-hidden en el
// contenedor exterior es el único límite duro que evita una "segunda página" en el caso
// patológico de una propiedad con muchísima información. El título/descripción además se
// truncan en JS con truncateText() antes de llegar al DOM en vez de confiar en `line-clamp`
// (html2canvas no siempre lo rasteriza igual que el navegador), así que ese límite duro nunca
// debería activarse en la práctica. Nunca usa clases `dark:` a propósito: la ficha debe verse
// igual sin importar el tema del sitio.
const PAGE_WIDTH = 1000;
const PAGE_MAX_HEIGHT = 1500;
const HERO_HEIGHT = 560;
const THUMB_STRIP_HEIGHT = 84;
const FOOTER_HEIGHT = 130;
const TITLE_MAX_CHARS = 88;
const DESCRIPTION_MAX_CHARS = 560;

function truncateText(text, maxChars) {
  if (!text) return '';
  const clean = text.trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : maxChars).trimEnd()}…`;
}

function InfoRow({ label, value }) {
  return (
    <div>
      <p className="text-gray-400 text-[9px] font-bold tracking-wide uppercase">{label}</p>
      <p className="text-gray-800 text-[13px] mt-0.5 leading-snug">{value}</p>
    </div>
  );
}

function FeatureChip({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-1.5 text-gray-700">
      <Icon size={17} className="text-accent-500 shrink-0" />
      <span className="text-sm font-semibold whitespace-nowrap">{value}</span>
      <span className="text-[10px] text-gray-400 whitespace-nowrap">{label}</span>
    </div>
  );
}

const FichaTecnica = forwardRef(function FichaTecnica({ property }, ref) {
  const images = property.images || [];
  const coverImage = images.find((img) => img.isCover) || images[0];
  const coverUrl = buildImageUrl(coverImage?.url, 1400);
  const thumbnails = images.filter((img) => img.id !== coverImage?.id).slice(0, 5);

  const heroLocation = [CITY_LABELS[property.city] || property.city, property.colonia]
    .filter(Boolean)
    .join(' · ');

  const panelLocationRows = [
    property.state && { label: 'Estado', value: property.state },
    property.colonia && { label: 'Colonia / Fraccionamiento', value: property.colonia },
    property.address && { label: 'Calle', value: property.address },
  ].filter(Boolean);

  const featureChips = [
    property.bedrooms && { icon: BedDouble, value: property.bedrooms, label: 'Rec.' },
    property.bathrooms && { icon: Bath, value: property.bathrooms, label: 'Baños' },
    property.halfBathrooms && {
      icon: Droplets,
      value: property.halfBathrooms,
      label: '1/2 baños',
    },
    property.terrainMeters && {
      icon: LandPlot,
      value: property.terrainMeters,
      label: 'm² terreno',
    },
    property.constructionMeters && {
      icon: Maximize2,
      value: property.constructionMeters,
      label: 'm² constr.',
    },
    !property.terrainMeters &&
      !property.constructionMeters &&
      property.squareMeters && { icon: Maximize2, value: property.squareMeters, label: 'm²' },
  ].filter(Boolean);

  const title = truncateText(property.title, TITLE_MAX_CHARS);
  const description = truncateText(property.description, DESCRIPTION_MAX_CHARS);
  const hasDescription = description.length > 0;
  const hasInfoPanel = panelLocationRows.length > 0 || Boolean(property.category) || Boolean(property.code);

  const typeCategoryLabel = [TYPE_LABELS[property.type], CATEGORY_LABELS[property.category]]
    .filter(Boolean)
    .join(' · ');

  const generatedAt = new Date().toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      ref={ref}
      style={{ width: PAGE_WIDTH, maxHeight: PAGE_MAX_HEIGHT }}
      className="relative flex flex-col bg-white text-gray-800 overflow-hidden"
    >
      {/* Hero: fotografía principal a toda anchura, con degradados para el logo (arriba) y
          el título/ubicación (abajo) — la foto es el elemento dominante de la ficha. */}
      <div style={{ height: HERO_HEIGHT }} className="relative shrink-0 bg-gray-100 overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            crossOrigin="anonymous"
            alt={property.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-400 text-sm">Sin imagen disponible</p>
          </div>
        )}

        <div
          className="absolute inset-x-0 top-0 h-28 flex items-start justify-between px-8 py-6"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.65), rgba(0,0,0,0))' }}
        >
          <img src="/logo.png" alt="Triomphe" className="h-9 w-auto brightness-0 invert" />
          {typeCategoryLabel && (
            <div className="text-right">
              <p className="text-white text-[11px] font-bold tracking-widest uppercase">
                {typeCategoryLabel}
              </p>
              <p className="text-white/60 text-[10px] mt-1">Generado el {generatedAt}</p>
            </div>
          )}
        </div>

        <div
          className="absolute inset-x-0 bottom-0 px-8 pb-6 pt-24"
          style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={STATUS_VARIANTS[property.status]}>
              {STATUS_LABELS[property.status] || property.status}
            </Badge>
            {property.code && (
              <span className="text-white/70 text-xs font-mono">{property.code}</span>
            )}
          </div>
          <h1 className="text-white text-[32px] font-bold leading-tight line-clamp-2">{title}</h1>
          {heroLocation && (
            <p className="text-white/80 text-sm mt-1.5 flex items-center gap-1.5">
              <MapPin size={14} className="shrink-0" />
              {heroLocation}
            </p>
          )}
        </div>
      </div>

      {/* Fotografías secundarias — franja compacta de altura fija; nunca agrega una segunda
          "página" porque el número de miniaturas está topado y su alto es constante. */}
      {thumbnails.length > 0 && (
        <div
          style={{ height: THUMB_STRIP_HEIGHT }}
          className="shrink-0 flex items-center gap-2 px-8 border-b border-gray-100"
        >
          {thumbnails.map((img) => (
            <div key={img.id} className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
              <img
                src={buildImageUrl(img.url, 200)}
                crossOrigin="anonymous"
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}

      {/* Precio + características esenciales en una sola fila compacta */}
      <div className="shrink-0 bg-gray-50 px-8 py-4 flex items-center justify-between gap-6 border-b border-gray-100">
        <div>
          <p className="text-gray-400 text-[10px] font-bold tracking-wide uppercase">Precio</p>
          <p
            className={`text-[28px] font-bold leading-tight ${
              property.price ? 'text-accent-500' : 'text-accent-300'
            }`}
          >
            {formatPrice(property.price)}
          </p>
        </div>
        {featureChips.length > 0 && (
          <div className="flex items-center gap-5">
            {featureChips.map((chip) => (
              <FeatureChip key={chip.label} {...chip} />
            ))}
          </div>
        )}
      </div>

      {/* Descripción + información adicional — alto natural (no `flex-1`): una propiedad con
          poca información no debe dejar un hueco en blanco antes del footer. El truncado previo
          del texto ya la mantiene acotada; `overflow-hidden` es solo el respaldo. */}
      {(hasDescription || hasInfoPanel) && (
        <div
          className={`overflow-hidden px-8 py-6 grid gap-8 ${
            hasDescription && hasInfoPanel ? 'grid-cols-[1fr_280px]' : 'grid-cols-1'
          }`}
        >
          {hasDescription && (
            <div className="overflow-hidden">
              <p className="text-primary-900 font-bold text-base mb-2">Descripción</p>
              <p className="text-gray-600 text-[13.5px] leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            </div>
          )}
          {hasInfoPanel && (
            <div className="bg-gray-50 rounded-xl p-4 overflow-hidden flex flex-col gap-4">
              {panelLocationRows.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-accent-600 text-[10px] font-bold tracking-wide mb-1">
                    UBICACIÓN
                  </p>
                  {panelLocationRows.map((row) => (
                    <InfoRow key={row.label} {...row} />
                  ))}
                </div>
              )}
              {(property.category || property.code) && (
                <div className="pt-3 border-t border-gray-200 space-y-2.5">
                  {property.category && (
                    <InfoRow
                      label="Categoría"
                      value={CATEGORY_LABELS[property.category] || property.category}
                    />
                  )}
                  {property.code && <InfoRow label="Código" value={property.code} />}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Branding / contacto */}
      <div
        style={{ height: FOOTER_HEIGHT }}
        className="shrink-0 bg-primary-900 px-8 py-4 flex flex-col justify-center gap-2"
      >
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-accent-400 text-xs font-bold mb-1.5">
              ¿Te interesa esta propiedad? Contáctanos:
            </p>
            <p className="text-white text-xs">Tel / WhatsApp: {OFFICES[0].phone}</p>
            <p className="text-white text-xs mt-0.5">{OFFICES[0].email}</p>
            <p className="text-white text-xs mt-0.5">wa.me/{WHATSAPP_NUMBER}</p>
          </div>
          <div>
            <p className="text-accent-400 text-[11px] font-bold mb-1.5">Oficinas</p>
            {OFFICES.map((office) => (
              <p key={office.city} className="text-white text-[11px] mb-0.5">
                {office.cityLabel}: {office.street}, {office.location}
              </p>
            ))}
          </div>
        </div>
        <p className="text-gray-400 text-[9px] text-center">
          © Triomphe Bienes Raíces — Documento informativo. Precio e información sujetos a cambios
          sin previo aviso.
        </p>
      </div>
    </div>
  );
});

export default FichaTecnica;
