import { forwardRef } from 'react';
import { BedDouble, Bath, Droplets, Maximize2, LandPlot } from 'lucide-react';
import { buildImageUrl } from '../../utils/images';
import { formatPrice } from '../../utils/formatters';
import {
  CITY_LABELS,
  TYPE_LABELS,
  CATEGORY_LABELS,
  OFFICES,
  WHATSAPP_NUMBER,
} from '../../utils/constants';

// Plantilla de la ficha técnica descargable (ver DownloadQuoteButton, que la rasteriza a PNG
// con html2canvas). El ancho es FIJO (proporción A4) pero el alto es totalmente libre: cada
// sección crece solo lo que su contenido necesita (hero y footer sí son de altura fija, para
// mantener el mismo "esqueleto" de marca en todas las fichas). Una propiedad con poca
// información da una ficha corta; una con descripción larga da una ficha larga — no hay límite
// de alto ni recorte, la ficha siempre muestra el contenido completo. El título sí se trunca en
// JS con truncateText() antes de llegar al DOM en vez de confiar en `line-clamp` (html2canvas no
// siempre lo rasteriza igual que el navegador y puede recortar ascendentes/acentos), porque es
// el único texto pensado para una sola línea de encabezado. Nunca usa clases `dark:` a propósito:
// la ficha debe verse igual sin importar el tema del sitio.
const PAGE_WIDTH = 1000;
const HERO_HEIGHT = 560;
const THUMB_STRIP_HEIGHT = 84;
const FOOTER_HEIGHT = 200;
const TITLE_MAX_CHARS = 88;

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
      <p className="text-gray-400 text-sm font-bold tracking-wide uppercase">{label}</p>
      <p className="text-gray-800 text-lg mt-1 leading-snug">{value}</p>
    </div>
  );
}

function FeatureChip({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-2 text-gray-700">
      <Icon size={22} className="text-accent-500 shrink-0 mt-[3px]" />
      <span className="text-lg font-semibold whitespace-nowrap">{value}</span>
      <span className="text-sm text-gray-400 whitespace-nowrap">{label}</span>
    </div>
  );
}

const FichaTecnica = forwardRef(function FichaTecnica({ property }, ref) {
  const images = property.images || [];
  const coverImage = images.find((img) => img.isCover) || images[0];
  const coverUrl = buildImageUrl(coverImage?.url, 1400);
  const thumbnails = images.filter((img) => img.id !== coverImage?.id).slice(0, 5);

  const cityLabel = CITY_LABELS[property.city] || property.city;
  const cityState = [cityLabel, property.state].filter(Boolean).join(', ');

  const panelLocationRows = [
    cityState && { label: 'Ciudad, Estado', value: cityState },
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
  const description = (property.description || '').trim();
  const hasDescription = description.length > 0;
  const hasInfoPanel = panelLocationRows.length > 0 || Boolean(property.code);

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
      // --app-text-scale fijo en 1: la ficha es un documento exportado para el cliente
      // final, no debe variar según la preferencia de accesibilidad de texto del
      // usuario admin que la genera (ver tailwind.config.js / textSizeStore.js).
      style={{ width: PAGE_WIDTH, '--app-text-scale': 1 }}
      className="relative flex flex-col bg-white text-gray-800"
    >
      {/* Hero: fotografía principal a toda anchura, sin texto encima — solo el logo como marca
          de agua — para que la foto se aprecie completa. El título y la ubicación viven debajo,
          en el recuadro blanco. */}
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

        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src="/logo.png"
            alt=""
            className="h-72 w-auto object-contain opacity-70 brightness-0 invert"
          />
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

      {/* Recuadro gris único: título, precio, características y tipo/categoría. La ubicación
          (ciudad, estado, colonia, calle) vive únicamente en el panel de UBICACIÓN de abajo,
          para no duplicarla. El badge de estatus se eliminó. */}
      <div className="shrink-0 bg-gray-50 px-8 pt-8 pb-6 border-b border-gray-100">
        <h1 className="text-primary-900 text-[42px] font-bold leading-snug">{title}</h1>
        <div className="flex items-start justify-between gap-6 mt-6">
          <div>
            <p className="text-gray-400 text-base font-bold tracking-wide uppercase">Precio</p>
            <p
              className={`text-[38px] font-bold leading-tight ${
                property.price ? 'text-accent-500' : 'text-accent-300'
              }`}
            >
              {formatPrice(property.price)}
            </p>
          </div>
          {typeCategoryLabel && (
            <div className="text-right shrink-0">
              <p className="text-primary-900 text-lg font-bold tracking-widest uppercase">
                {typeCategoryLabel}
              </p>
            </div>
          )}
        </div>
        {featureChips.length > 0 && (
          <div className="flex items-center flex-wrap gap-x-6 gap-y-3 mt-5">
            {featureChips.map((chip) => (
              <FeatureChip key={chip.label} {...chip} />
            ))}
          </div>
        )}
      </div>

      {/* Descripción + información adicional — alto natural (no `flex-1`, sin límite de alto):
          una propiedad con poca información no deja un hueco en blanco antes del footer, y una
          con descripción larga simplemente hace la ficha más alta — nunca se recorta. */}
      {(hasDescription || hasInfoPanel) && (
        <div
          className={`px-8 py-8 grid gap-8 ${
            hasDescription && hasInfoPanel ? 'grid-cols-[1fr_340px]' : 'grid-cols-1'
          }`}
        >
          {hasDescription && (
            <div>
              <p className="text-primary-900 font-bold text-xl mb-3">Descripción</p>
              <p className="text-gray-600 text-base leading-relaxed whitespace-pre-wrap">
                {description}
              </p>
            </div>
          )}
          {hasInfoPanel && (
            <div className="bg-gray-50 rounded-xl p-5 flex flex-col gap-5">
              {panelLocationRows.length > 0 && (
                <div className="space-y-3.5">
                  <p className="text-accent-600 text-base font-bold tracking-wide mb-1">
                    UBICACIÓN
                  </p>
                  {panelLocationRows.map((row) => (
                    <InfoRow key={row.label} {...row} />
                  ))}
                </div>
              )}
              {property.code && (
                <div className="pt-4 border-t border-gray-200">
                  <InfoRow label="Código" value={property.code} />
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
            <p className="text-accent-400 text-sm font-bold mb-2">
              ¿Te interesa esta propiedad? Contáctanos:
            </p>
            <p className="text-white text-sm">Tel / WhatsApp: {OFFICES[0].phone}</p>
            <p className="text-white text-sm mt-1">{OFFICES[0].email}</p>
            <p className="text-white text-sm mt-1">wa.me/{WHATSAPP_NUMBER}</p>
          </div>
          <div>
            <p className="text-accent-400 text-sm font-bold mb-2">Oficinas</p>
            {OFFICES.map((office) => (
              <p key={office.city} className="text-white text-xs mb-1 leading-snug">
                {office.cityLabel}: {office.street}, {office.location}
              </p>
            ))}
          </div>
        </div>
        <p className="text-gray-400 text-xs text-center pt-1">
          © Triomphe Bienes Raíces — Documento informativo. Precio e información sujetos a cambios
          sin previo aviso. · Generado el {generatedAt}
        </p>
      </div>
    </div>
  );
});

export default FichaTecnica;
