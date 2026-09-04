const router = require('express').Router();
const { Property } = require('../models/index');
const { isPublicPropertiesEnabled } = require('../services/settingsService');

router.get('/', async (req, res) => {
  try {
    // publicPropertiesEnabled=false: no listar URLs de propiedades individuales en el
    // sitemap mientras la sección pública está oculta (no tiene sentido indexar páginas que
    // hoy responden 404) — las páginas estáticas se mantienen igual.
    const publicPropertiesEnabled = await isPublicPropertiesEnabled();
    const properties = publicPropertiesEnabled
      ? await Property.findAll({
          where: { status: 'disponible' },
          attributes: ['slug', 'updatedAt'],
        })
      : [];

    const baseUrl = (process.env.CLIENT_URL || 'https://rematesbancarios.net').replace(/\/$/, '');

    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'weekly' },
      { url: '/propiedades', priority: '0.9', changefreq: 'daily' },
      { url: '/contacto', priority: '0.7', changefreq: 'monthly' },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map(
    ({ url, priority, changefreq }) => `  <url>
    <loc>${baseUrl}${url}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
  )
  .join('\n')}
${properties
  .map(
    (p) => `  <url>
    <loc>${baseUrl}/propiedades/${p.slug}</loc>
    <lastmod>${new Date(p.updatedAt).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generando sitemap:', error);
    res.status(500).send('Error generando sitemap');
  }
});

module.exports = router;
