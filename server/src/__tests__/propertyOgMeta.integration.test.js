const request = require('supertest');
const app = require('../../app');
const { sequelize, Property, Image } = require('../models/index');
const { createProperty } = require('./helpers/factories');
const { generateSlug } = require('../utils/helpers');

// La factory createProperty() llama a Property.create() directamente (no pasa por
// propertyController), y slug no tiene default ni hook a nivel modelo — solo
// propertyController.createProperty lo genera a partir del título. Hay que fijarlo a mano
// aquí (con un sufijo único, como hace el propio controller ante colisiones) para poder
// pedir la propiedad por su slug real en vez de por un slug null compartido entre filas.
const uniqueSlug = (title) => `${generateSlug(title)}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// Facebook/WhatsApp/LinkedIn no ejecutan JS al generar la tarjeta de previsualización de un
// link — nunca ven el <Helmet> dinámico de SEO.jsx (client-side). Este test cubre el render
// server-side de metadata Open Graph en app.js (ver propertyOgMeta.js), que es lo único que
// esos crawlers realmente reciben.
const FACEBOOK_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const REAL_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

describe('Metadata Open Graph server-side de propiedades (/propiedades/:slug)', () => {
  beforeAll(async () => {
    await sequelize.sync({ alter: false });
  });

  afterEach(async () => {
    await Property.destroy({ where: {}, force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  test('un crawler recibe og:title/description/image/url específicos de la propiedad', async () => {
    const property = await createProperty({
      title: 'Casa en venta en Ciudad Juárez',
      slug: uniqueSlug('Casa en venta en Ciudad Juárez'),
      city: 'juarez',
      type: 'casa',
      businessLine: 'remate',
      price: 850000,
      bedrooms: 3,
    });
    await Image.create({
      propertyId: property.id,
      url: 'https://res.cloudinary.com/demo/image/upload/v1/triomphe/properties/foto.jpg',
      filename: 'foto.jpg',
      isCover: true,
    });

    const res = await request(app)
      .get(`/propiedades/${property.slug}`)
      .set('User-Agent', FACEBOOK_UA);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Casa en venta en Ciudad Juárez');
    expect(res.text).toContain('og:title');
    expect(res.text).toMatch(
      /<meta property="og:image" content="https:\/\/res\.cloudinary\.com\/demo\/image\/upload\/f_auto,q_auto,c_fill,w_1200,h_630\/v1\/triomphe\/properties\/foto\.jpg" \/>/
    );
    const baseUrl = process.env.CLIENT_URL.replace(/\/$/, '');
    expect(res.text).toContain(
      `<meta property="og:url" content="${baseUrl}/propiedades/${property.slug}" />`
    );
  });

  test('dos propiedades distintas generan metadata distinta', async () => {
    const propertyA = await createProperty({
      title: 'Casa en venta en Ciudad Juárez',
      slug: uniqueSlug('Casa en venta en Ciudad Juárez A'),
    });
    const propertyB = await createProperty({
      title: 'Departamento en renta en Chihuahua',
      slug: uniqueSlug('Departamento en renta en Chihuahua B'),
    });

    const resA = await request(app)
      .get(`/propiedades/${propertyA.slug}`)
      .set('User-Agent', FACEBOOK_UA);
    const resB = await request(app)
      .get(`/propiedades/${propertyB.slug}`)
      .set('User-Agent', FACEBOOK_UA);

    expect(resA.text).toContain('Casa en venta en Ciudad Juárez');
    expect(resA.text).not.toContain('Departamento en renta en Chihuahua');
    expect(resB.text).toContain('Departamento en renta en Chihuahua');
    expect(resB.text).not.toContain('Casa en venta en Ciudad Juárez');
  });

  test('una propiedad sin imágenes usa el logo como fallback de og:image', async () => {
    const property = await createProperty({
      title: 'Terreno sin fotos',
      slug: uniqueSlug('Terreno sin fotos'),
    });

    const res = await request(app)
      .get(`/propiedades/${property.slug}`)
      .set('User-Agent', FACEBOOK_UA);

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/<meta property="og:image" content="[^"]*\/logo\.png" \/>/);
  });

  test('un navegador real recibe el index.html genérico sin metadata inyectada', async () => {
    const property = await createProperty({
      title: 'Casa en venta en Ciudad Juárez',
      slug: uniqueSlug('Casa en venta en Ciudad Juárez real browser'),
    });

    const res = await request(app)
      .get(`/propiedades/${property.slug}`)
      .set('User-Agent', REAL_BROWSER_UA);

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('og:title');
    expect(res.text).toContain('<title>Triomphe Remates Bancarios</title>');
  });

  test('una propiedad no disponible no expone metadata pública a un crawler', async () => {
    const property = await createProperty({
      title: 'Casa apartada no pública',
      slug: uniqueSlug('Casa apartada no publica'),
      status: 'apartado',
    });

    const res = await request(app)
      .get(`/propiedades/${property.slug}`)
      .set('User-Agent', FACEBOOK_UA);

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Casa apartada no pública');
  });

  test('un slug inexistente cae al index.html genérico en vez de fallar', async () => {
    const res = await request(app)
      .get('/propiedades/este-slug-no-existe')
      .set('User-Agent', FACEBOOK_UA);

    expect(res.status).toBe(200);
    expect(res.text).not.toContain('og:title');
  });
});
