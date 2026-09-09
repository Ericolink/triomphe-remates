// Construcción del `where` de Sequelize para propiedades — única fuente de verdad
// compartida entre el listado (GET /api/properties, propertyController.getProperties) y las
// exportaciones (Excel/PDF admin en exportHelpers.js, catálogo público en
// exportController.js), para que ambos devuelvan exactamente el mismo conjunto de
// propiedades ante los mismos filtros (ver AUDITORIA_EXPORT_FILTROS). Extraído tal cual del
// `where` que ya armaba getProperties — mismo orden, mismos nombres de parámetro, mismas
// transformaciones — sin cambiar su comportamiento.
const { Op } = require('sequelize');
const { sequelize } = require('../models/index');
const logger = require('../utils/logger');

// Arma el query en IN BOOLEAN MODE para el índice FULLTEXT de properties (title, address,
// description). Tokens <3 caracteres se descartan porque innodb_ft_min_token_size (default 3)
// nunca los indexa — incluirlos con '+' forzaría el AND a fallar siempre. Se despojan los
// operadores propios de BOOLEAN MODE (+ - > < ( ) ~ * ") del texto del usuario antes de
// envolver cada token con '+' (requerido) y '*' (prefijo), para que un search como "casa-remate"
// no se interprete como sintaxis de MySQL. Devuelve null si no queda ningún token indexable,
// señal para que el caller use directamente el fallback LIKE.
const buildFulltextBooleanQuery = (search) => {
  const tokens = search
    .split(/\s+/)
    .map((t) => t.replace(/[+\-><()~*"@]/g, ''))
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return null;
  return tokens.map((t) => `+${t}*`).join(' ');
};

// `isStaff: false` fuerza status='disponible' y descarta cualquier `status` recibido en
// `query` — un visitante público (o un parámetro manipulado en el body del catálogo) nunca
// puede ampliar esa restricción, solo un caller con `isStaff: true` (rutas ya protegidas por
// authenticate/authorize) puede filtrar por cualquier status.
const buildPropertyWhereClause = async (query, { isStaff }) => {
  const {
    city,
    type,
    category,
    businessLine,
    status,
    minPrice,
    maxPrice,
    minTerrainM2,
    maxTerrainM2,
    minConstructionM2,
    maxConstructionM2,
    minBedrooms,
    minBathrooms,
    featured,
    search,
  } = query;

  const where = {};

  if (city) where.city = city;
  if (type) where.type = type;
  if (category) where.category = category;
  if (businessLine) where.businessLine = businessLine;
  if (isStaff) {
    if (status) where.status = status;
  } else {
    where.status = 'disponible';
  }
  if (featured) where.isFeatured = featured === 'true';

  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
    if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
  }

  if (minTerrainM2 || maxTerrainM2) {
    where.terrainMeters = {};
    if (minTerrainM2) where.terrainMeters[Op.gte] = parseFloat(minTerrainM2);
    if (maxTerrainM2) where.terrainMeters[Op.lte] = parseFloat(maxTerrainM2);
  }

  if (minConstructionM2 || maxConstructionM2) {
    where.constructionMeters = {};
    if (minConstructionM2) where.constructionMeters[Op.gte] = parseFloat(minConstructionM2);
    if (maxConstructionM2) where.constructionMeters[Op.lte] = parseFloat(maxConstructionM2);
  }

  const andConditions = [];

  if (minBedrooms) where.bedrooms = { [Op.gte]: parseInt(minBedrooms) };
  if (minBathrooms) where.bathrooms = { [Op.gte]: parseInt(minBathrooms) };

  if (search) {
    // Camino rápido: FULLTEXT usa el índice invertido idx_properties_fulltext_search en
    // vez de escanear la tabla completa. Solo cuando no encuentra nada (término corto,
    // código con guion, substring a mitad de palabra) se cae al LIKE '%search%' original
    // como red de seguridad — así nunca se pierden resultados que antes sí aparecían.
    const booleanQuery = buildFulltextBooleanQuery(search);
    let matchedIds = null;

    if (booleanQuery) {
      // HOTFIX: si el índice FULLTEXT (idx_properties_fulltext_search, migración
      // 20260721000000) falta en esta base de datos por cualquier razón, MATCH/AGAINST
      // lanza "Can't find FULLTEXT index matching the column list". Se degrada al
      // fallback LIKE que ya existía para "sin resultados", en vez de dejar que una
      // consulta rota reviente el listado/exportación completos.
      try {
        const matches = await sequelize.query(
          'SELECT id FROM properties WHERE MATCH(title, address, description) AGAINST(:query IN BOOLEAN MODE)',
          { replacements: { query: booleanQuery }, type: sequelize.QueryTypes.SELECT }
        );
        if (matches.length > 0) matchedIds = matches.map((m) => m.id);
      } catch (error) {
        logger.error('Búsqueda FULLTEXT de propiedades falló, usando fallback LIKE', {
          message: error.message,
          search,
        });
      }
    }

    // `code` (ej. JRCH-0227) no forma parte del índice FULLTEXT y su guion lo rompe como
    // token de una sola palabra, así que se busca aparte con LIKE siempre, sin importar si
    // el camino rápido de FULLTEXT ya encontró algo por título/dirección/descripción.
    if (matchedIds) {
      andConditions.push({
        [Op.or]: [{ id: { [Op.in]: matchedIds } }, { code: { [Op.like]: `%${search}%` } }],
      });
    } else {
      andConditions.push({
        [Op.or]: [
          { title: { [Op.like]: `%${search}%` } },
          { address: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
          { code: { [Op.like]: `%${search}%` } },
        ],
      });
    }
  }

  if (andConditions.length > 0) where[Op.and] = andConditions;

  return where;
};

module.exports = { buildPropertyWhereClause };
