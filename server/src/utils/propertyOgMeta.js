const fs = require('fs');
const path = require('path');
const { Property, Image } = require('../models/index');
const { isPublicPropertiesEnabled } = require('../services/settingsService');

const SITE_NAME = 'Triomphe Remates Bancarios';

// Mismos enums que Property.city/type/businessLine (ver VALID_CITIES/VALID_TYPES en
// propertyController.js) traducidos a texto legible — duplican a propósito el subconjunto
// mínimo de CITY_LABELS/TYPE_LABELS/BUSINESS_LINE_CONTENT que usa client/src/utils/constants.js
// para construir el mismo título/descripción que ya arma PropertyDetailPage.jsx, porque este
// archivo corre en el server (CommonJS) y esos mapas viven en el bundle de Vite del cliente.
const CITY_LABELS = { juarez: 'Cd. Juárez', chihuahua: 'Chihuahua', queretaro: 'Querétaro' };
const TYPE_LABELS = {
  casa: 'Casa',
  departamento: 'Departamento',
  terreno: 'Terreno',
  local: 'Local',
  bodega: 'Bodega',
};
const BUSINESS_LINE_SUFFIX = {
  remate: 'en remate bancario',
  credito: 'con crédito',
  renta: 'en renta',
  contado: 'de contado',
  inversion: 'para inversión',
};

const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );

const formatPrice = (price) =>
  price === null || price === undefined
    ? null
    : new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        maximumFractionDigits: 0,
      }).format(price);

const buildTitle = (property) => {
  const type = TYPE_LABELS[property.type] || property.type;
  const suffix = BUSINESS_LINE_SUFFIX[property.businessLine] || BUSINESS_LINE_SUFFIX.remate;
  const cityPart = property.city ? ` en ${CITY_LABELS[property.city] || property.city}` : '';
  return `${property.title} - ${type} ${suffix}${cityPart} | ${SITE_NAME}`;
};

// Misma composición que buildDescription() en PropertyDetailPage.jsx — se reconstruye en
// vez de usar property.description directamente: ese campo es texto libre del panel admin
// (largo, puede venir vacío) y Facebook recomienda descripciones cortas de una línea.
const buildDescription = (property) => {
  const type = TYPE_LABELS[property.type] || property.type;
  const suffix = BUSINESS_LINE_SUFFIX[property.businessLine] || BUSINESS_LINE_SUFFIX.remate;
  const price = formatPrice(property.price);
  const parts = [
    `${type} ${suffix}`,
    price ? `a ${price}` : '',
    property.city ? `en ${CITY_LABELS[property.city] || property.city}` : '',
    property.squareMeters ? `· ${property.squareMeters} m²` : '',
    property.bedrooms ? `· ${property.bedrooms} recámaras` : '',
  ];
  return parts.filter(Boolean).join(' ');
};

// Mismo criterio que buildImageUrl() en client/src/utils/images.js, pero con c_fill/w_1200/
// h_630 (proporción 1.91:1) en vez de c_limit — buildImageUrl está pensado para encajar en un
// contenedor de la UI; og:image debe ser una sola imagen de dimensiones fijas, que es lo que
// Facebook/WhatsApp/LinkedIn recomiendan para la tarjeta de previsualización.
const buildImageUrl = (images, baseUrl) => {
  const cover = (images || []).find((img) => img.isCover) || (images || [])[0];
  if (!cover) return `${baseUrl}/logo.png`;
  if (!cover.url.startsWith('http')) return `${baseUrl}${cover.url}`;
  if (!cover.url.includes('/upload/')) return cover.url;
  return cover.url.replace('/upload/', '/upload/f_auto,q_auto,c_fill,w_1200,h_630/');
};

const injectMeta = (template, { title, description, image, url }) => {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeUrl = escapeHtml(url);

  const metaTags = `
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${safeUrl}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:url" content="${safeUrl}" />
    <meta property="og:locale" content="es_MX" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />
  </head>`;

  return template
    .replace(/<title>.*?<\/title>/, `<title>${safeTitle}</title>`)
    .replace('</head>', metaTags);
};

// Renderiza el index.html compilado con metadata Open Graph específica de una propiedad, para
// crawlers de redes sociales que no ejecutan JS (ver botDetection.js) y por lo tanto nunca ven
// el <Helmet> dinámico de SEO.jsx. Devuelve null si la propiedad no existe o no es visible
// públicamente — mismas reglas que GET /api/properties/slug/:slug (isPublicPropertiesEnabled +
// status 'disponible') para no filtrar metadata de propiedades no públicas.
async function renderPropertyOgHtml(slug, clientBuildPath) {
  if (!(await isPublicPropertiesEnabled())) return null;

  const property = await Property.findOne({
    where: { slug, status: 'disponible' },
    attributes: [
      'title',
      'price',
      'city',
      'type',
      'businessLine',
      'squareMeters',
      'bedrooms',
      'slug',
    ],
    include: [{ model: Image, as: 'images', separate: true, order: [['order', 'ASC']] }],
  });
  if (!property) return null;

  const baseUrl = (process.env.CLIENT_URL || 'https://rematesbancarios.net').replace(/\/$/, '');
  // clientBuildPath viene fijo de app.js (path.join(__dirname, 'client')), nunca de
  // request/DB — el plugin de seguridad solo no puede probarlo estáticamente porque pasa
  // por path.join() (mismo caso que exportHelpers.js/emailService.js).
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const template = fs.readFileSync(path.join(clientBuildPath, 'index.html'), 'utf-8');

  return injectMeta(template, {
    title: buildTitle(property),
    description: buildDescription(property),
    image: buildImageUrl(property.images, baseUrl),
    url: `${baseUrl}/propiedades/${property.slug}`,
  });
}

module.exports = { renderPropertyOgHtml };
