import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'Triomphe Remates Bancarios';
const SITE_URL = 'https://rematesbancarios.net';
const DEFAULT_DESCRIPTION = 'Encuentra propiedades en remate bancario en Chihuahua, Ciudad Juárez y Querétaro. Casas, departamentos y terrenos hasta 40% por debajo del valor comercial.';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

export default function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  property = null,
}) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const fullUrl = url ? `${SITE_URL}${url}` : SITE_URL;

  const formatPrice = (price) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(price);

  return (
    <Helmet>
      {/* Básico */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph (Facebook, WhatsApp, LinkedIn) */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:locale" content="es_MX" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Schema.org para propiedades inmobiliarias */}
      {property && (
        <script type="application/ld+json">
          {JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'RealEstateListing',
            name: property.title,
            description: property.description || description,
            url: fullUrl,
            image: image,
            offers: {
              '@type': 'Offer',
              price: property.price,
              priceCurrency: 'MXN',
              availability: property.status === 'disponible'
                ? 'https://schema.org/InStock'
                : 'https://schema.org/OutOfStock',
            },
            address: property.address ? {
              '@type': 'PostalAddress',
              streetAddress: property.address,
              addressCountry: 'MX',
            } : undefined,
            numberOfRooms: property.bedrooms || undefined,
            floorSize: property.squareMeters ? {
              '@type': 'QuantitativeValue',
              value: property.squareMeters,
              unitCode: 'MTK',
            } : undefined,
          })}
        </script>
      )}

      {/* Keywords para inmuebles */}
      <meta
        name="keywords"
        content={
          property
            ? `remate bancario, ${property.type}, ${property.city}, ${property.bank || ''}, ${property.title}, bienes raices chihuahua`
            : 'remates bancarios, propiedades remate, casas baratas chihuahua, juarez, queretaro, bienes raices'
        }
      />
    </Helmet>
  );
}
