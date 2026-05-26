const router = require('express').Router();
const { Property } = require('../models/index');

router.get('/', async (req, res) => {
  try {
    const properties = await Property.findAll({
      where: { status: 'disponible' },
      attributes: ['slug', 'updatedAt'],
    });

    const baseUrl = 'https://rematesbancarios.net';

    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'weekly' },
      { url: '/propiedades', priority: '0.9', changefreq: 'daily' },
      { url: '/contacto', priority: '0.7', changefreq: 'monthly' },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(({ url, priority, changefreq }) => `  <url>
    <loc>${baseUrl}${url}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n')}
${properties.map((p) => `  <url>
    <loc>${baseUrl}/propiedades/${p.slug}</loc>
    <lastmod>${new Date(p.updatedAt).toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Error generando sitemap:', error);
    res.status(500).send('Error generando sitemap');
  }
});

module.exports = router;
