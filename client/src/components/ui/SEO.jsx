import { Helmet } from 'react-helmet-async';
import { BUSINESS_LINE_CONTENT } from '../../utils/constants';

const SITE_NAME = 'Triomphe Remates Bancarios';
const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;
const DEFAULT_DESCRIPTION =
  'Compra casas, departamentos y terrenos en remate bancario en Chihuahua, Ciudad Juárez y Querétaro, del 30% al 70% por debajo del valor comercial.';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;

const cityName = { juarez: 'Ciudad Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };
const cityRegion = { juarez: 'Chihuahua', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };

const ORGANIZATION = {
  '@type': 'RealEstateAgent',
  '@id': `${SITE_URL}/#organization`,
  name: 'Triomphe Bienes Raíces',
  url: SITE_URL,
  logo: `${SITE_URL}/logo.png`,
  description: DEFAULT_DESCRIPTION,
  areaServed: ['Ciudad Juárez', 'Chihuahua', 'Querétaro'],
  sameAs: ['https://www.facebook.com/TriomphePagOficial', 'https://www.instagram.com/triomphejrz'],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+52-656-579-2750',
    contactType: 'customer service',
    availableLanguage: 'Spanish',
  },
};

const buildPropertySchema = (property, fullUrl, image, description) => {
  const floorSize =
    property.constructionMeters || property.squareMeters
      ? {
          '@type': 'QuantitativeValue',
          value: property.constructionMeters || property.squareMeters,
          unitCode: 'MTK',
        }
      : undefined;

  const landSize = property.terrainMeters
    ? { '@type': 'QuantitativeValue', value: property.terrainMeters, unitCode: 'MTK' }
    : undefined;

  const address = {
    '@type': 'PostalAddress',
    ...(property.address ? { streetAddress: property.address } : {}),
    ...(property.city
      ? {
          addressLocality: cityName[property.city] || property.city,
          addressRegion: cityRegion[property.city] || property.city,
        }
      : {}),
    addressCountry: 'MX',
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    '@id': fullUrl,
    name: property.title,
    description: property.description || description,
    url: fullUrl,
    image,
    datePosted: property.createdAt,
    offers: {
      '@type': 'Offer',
      price: property.price || undefined,
      priceCurrency: 'MXN',
      availability:
        property.status === 'disponible'
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      seller: { '@id': `${SITE_URL}/#organization` },
    },
    address,
    ...(property.bedrooms ? { numberOfBedrooms: property.bedrooms } : {}),
    ...(property.bathrooms ? { numberOfBathroomsTotal: property.bathrooms } : {}),
    ...(floorSize ? { floorSize } : {}),
    ...(landSize ? { landSize } : {}),
    broker: { '@id': `${SITE_URL}/#organization` },
  };
};

const buildBreadcrumb = (property, fullUrl) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Inicio', item: SITE_URL },
    { '@type': 'ListItem', position: 2, name: 'Propiedades', item: `${SITE_URL}/propiedades` },
    { '@type': 'ListItem', position: 3, name: property.title, item: fullUrl },
  ],
});

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

  return (
    <Helmet>
      {/* Básico */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph */}
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

      {/* Keywords */}
      <meta
        name="keywords"
        content={
          property
            ? `${(BUSINESS_LINE_CONTENT[property.businessLine] || BUSINESS_LINE_CONTENT.remate).keywordsPrefix}, ${property.type}, ${cityName[property.city] || property.city}, ${property.title}, bienes raices chihuahua`
            : 'remates bancarios, propiedades remate, casas baratas chihuahua, juarez, queretaro, bienes raices'
        }
      />

      {/* Organization — siempre presente */}
      <script type="application/ld+json">{JSON.stringify(ORGANIZATION)}</script>

      {/* RealEstateListing + BreadcrumbList — solo en detalle de propiedad */}
      {property && (
        <script type="application/ld+json">
          {JSON.stringify(buildPropertySchema(property, fullUrl, image, description))}
        </script>
      )}
      {property && (
        <script type="application/ld+json">
          {JSON.stringify(buildBreadcrumb(property, fullUrl))}
        </script>
      )}
    </Helmet>
  );
}
