const { Op, fn, col } = require('sequelize');
const { cloudinary } = require('../config/cloudinary');
const { sequelize, Property, Image, Analytics, PropertyStatusHistory } = require('../models/index');
const { generateSlug } = require('../utils/helpers');
const alertService = require('../services/alertService');
const { isValidImageBuffer } = require('../utils/fileSignature');
const { paginate } = require('../utils/pagination');
const { logAudit } = require('../utils/audit');
const logger = require('../utils/logger');
const { destroyCloudinaryAsset } = require('../utils/cloudinaryCleanup');
const { ApiError } = require('../middleware/errorHandler');

// Convierte string vacío a null para campos numéricos
const nullIfEmpty = (val) => (val === '' || val === undefined ? null : val);

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

// GET /api/properties
const getProperties = async (req, res) => {
  const {
    page = 1,
    limit = 12,
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
  } = req.query;

  const where = {};

  // El inventario público solo muestra "disponible": apartado/vendido salen de circulación
  // y de ahí en adelante solo son visibles desde el panel admin (getPropertyById/By Slug ya
  // aplican la misma regla). El staff autenticado sí puede filtrar por cualquier status.
  // Todo usuario autenticado en `users` es staff (ya no hay un rol "no-staff"): los 4
  // roles (admin/coordinador_ventas/asesor_ventas/asistente_administrativo) pueden ver
  // borradores/internalNotes — el detalle de qué puede EDITAR sigue gateado aparte por ruta.
  const isStaff = Boolean(req.user);

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
      const matches = await sequelize.query(
        'SELECT id FROM properties WHERE MATCH(title, address, description) AGAINST(:query IN BOOLEAN MODE)',
        { replacements: { query: booleanQuery }, type: sequelize.QueryTypes.SELECT }
      );
      if (matches.length > 0) matchedIds = matches.map((m) => m.id);
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

  const result = await paginate(Property, {
    page,
    limit,
    where,
    attributes: { exclude: ['internalNotes'] },
    include: [{ model: Image, as: 'images', where: { isCover: true }, required: false }],
    order: [
      ['isFeatured', 'DESC'],
      ['createdAt', 'DESC'],
    ],
  });

  return res.json(result);
};

// GET /api/properties/sync?ids=1,2,3
// Revalida en lote precio/estatus de propiedades guardadas localmente
// (Favoritos, Comparador). Solo devuelve los campos dinámicos — nunca
// filtra por status, a diferencia de getProperties, porque el cliente
// necesita saber también si una propiedad pasó a "vendido". Los ids que
// no vienen en la respuesta ya no existen (fueron eliminadas).
const MAX_SYNC_IDS = 200;
const getPropertiesSync = async (req, res) => {
  const idsParam = req.query.ids;
  if (!idsParam) throw new ApiError(400, 'Parámetro ids requerido');

  const ids = [
    ...new Set(
      String(idsParam)
        .split(',')
        .map((v) => parseInt(v, 10))
        .filter((n) => Number.isInteger(n) && n > 0)
    ),
  ];

  if (ids.length === 0) return res.json({ data: [] });
  if (ids.length > MAX_SYNC_IDS) {
    throw new ApiError(400, `Máximo ${MAX_SYNC_IDS} propiedades por consulta`);
  }

  const properties = await Property.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ['id', 'price', 'status'],
  });

  return res.json({ data: properties });
};

// GET /api/properties/stats — usado solo por páginas públicas (HomePage, AboutPage); cuenta
// únicamente inventario disponible, igual que getProperties para clientes no-staff.
// `businessLine` es opcional: HomePage/InfonavitHomePage lo pasan para que su tarjeta de stats
// solo cuente su propia línea; AboutPage lo omite a propósito para mostrar el total combinado.
const getPropertyStats = async (req, res) => {
  const { businessLine } = req.query;
  const where = { status: 'disponible' };
  if (businessLine) where.businessLine = businessLine;

  const total = await Property.count({ where });
  const byCityRaw = await Property.findAll({
    where,
    attributes: ['city', [fn('COUNT', col('id')), 'total']],
    group: ['city'],
    raw: true,
  });

  const byCity = { juarez: 0, chihuahua: 0, queretaro: 0 };
  byCityRaw.forEach((row) => {
    byCity[row.city] = parseInt(row.total);
  });

  return res.json({ total, byCity });
};

// GET /api/properties/:id — usado únicamente por el panel admin (PropertyFormPage). No
// registra vistas: el registro de vistas vive solo en trackView, disparado explícitamente
// por la ficha pública. Ver POST /:id/view.
const getPropertyById = async (req, res) => {
  // Todo usuario autenticado en `users` es staff (ya no hay un rol "no-staff"): los 4
  // roles (admin/coordinador_ventas/asesor_ventas/asistente_administrativo) pueden ver
  // borradores/internalNotes — el detalle de qué puede EDITAR sigue gateado aparte por ruta.
  const isStaff = Boolean(req.user);
  const property = await Property.findByPk(req.params.id, {
    attributes: isStaff ? undefined : { exclude: ['internalNotes'] },
    include: [{ model: Image, as: 'images', separate: true, order: [['order', 'ASC']] }],
  });

  if (!property) throw new ApiError(404, 'Propiedad no encontrada');
  if (!isStaff && property.status !== 'disponible') {
    throw new ApiError(404, 'Propiedad no encontrada');
  }

  return res.json({ data: property });
};

// GET /api/properties/slug/:slug — usado por la ficha pública. Tampoco registra vistas
// (ver nota en getPropertyById); el cliente llama a POST /:id/view por separado una vez
// que la propiedad carga.
const getPropertyBySlug = async (req, res) => {
  // Todo usuario autenticado en `users` es staff (ya no hay un rol "no-staff"): los 4
  // roles (admin/coordinador_ventas/asesor_ventas/asistente_administrativo) pueden ver
  // borradores/internalNotes — el detalle de qué puede EDITAR sigue gateado aparte por ruta.
  const isStaff = Boolean(req.user);
  const property = await Property.findOne({
    where: { slug: req.params.slug },
    attributes: { exclude: ['internalNotes'] },
    include: [{ model: Image, as: 'images', separate: true, order: [['order', 'ASC']] }],
  });

  if (!property) throw new ApiError(404, 'Propiedad no encontrada');
  if (!isStaff && property.status !== 'disponible') {
    throw new ApiError(404, 'Propiedad no encontrada');
  }

  return res.json({ data: property });
};

// POST /api/properties
const createProperty = async (req, res) => {
  const {
    title,
    description,
    price,
    city,
    state,
    type,
    category,
    businessLine,
    status,
    squareMeters,
    terrainMeters,
    constructionMeters,
    bedrooms,
    bathrooms,
    halfBathrooms,
    address,
    colonia,
    propertyNumber,
    postalCode,
    auctionDate,
    acquisitionStage,
    isFeatured,
    internalNotes,
    code,
    lot,
    block,
    portfolio,
    legalProcessType,
    template,
    cadastralPlan,
    technicalSheet,
    facebookPage,
    zone,
    zoneType,
    commercialPrice1,
    commercialPrice1Date,
    commercialPrice2,
    commercialPrice2Date,
    utility,
    inventoryEntryDate,
    showBasicInfo,
    showLocationInfo,
    showDetailsInfo,
    showAuctionInfo,
    showLegalInfo,
    showValuationInfo,
  } = req.body;

  if (!title || !city || !type) {
    throw new ApiError(400, 'Título, precio, ciudad y tipo son requeridos');
  }

  let slug = generateSlug(title);

  // Asegurar slug único
  const existing = await Property.findOne({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  // AUDIT-018: Property + su primer registro de historial deben crearse juntos —
  // sin transacción, un fallo en PropertyStatusHistory.create dejaba la propiedad
  // creada sin su historial inicial.
  const property = await sequelize.transaction(async (transaction) => {
    const created = await Property.create(
      {
        title,
        description,
        price: nullIfEmpty(price),
        city,
        state: nullIfEmpty(state),
        type,
        category: category || 'remate',
        businessLine: businessLine || 'remate',
        status: status || 'disponible',
        squareMeters: nullIfEmpty(squareMeters),
        terrainMeters: nullIfEmpty(terrainMeters),
        constructionMeters: nullIfEmpty(constructionMeters),
        bedrooms: nullIfEmpty(bedrooms),
        bathrooms: nullIfEmpty(bathrooms),
        halfBathrooms: nullIfEmpty(halfBathrooms),
        address,
        colonia,
        propertyNumber: nullIfEmpty(propertyNumber),
        postalCode: nullIfEmpty(postalCode),
        auctionDate: auctionDate || null,
        acquisitionStage: acquisitionStage || 'sin_proceso',
        isFeatured: isFeatured || false,
        internalNotes: internalNotes || null,
        code: nullIfEmpty(code),
        lot: nullIfEmpty(lot),
        block: nullIfEmpty(block),
        portfolio: nullIfEmpty(portfolio),
        legalProcessType: nullIfEmpty(legalProcessType),
        template: nullIfEmpty(template),
        cadastralPlan: nullIfEmpty(cadastralPlan),
        technicalSheet: nullIfEmpty(technicalSheet),
        facebookPage: nullIfEmpty(facebookPage),
        zone: nullIfEmpty(zone),
        zoneType: nullIfEmpty(zoneType),
        commercialPrice1: nullIfEmpty(commercialPrice1),
        commercialPrice1Date: commercialPrice1Date || null,
        commercialPrice2: nullIfEmpty(commercialPrice2),
        commercialPrice2Date: commercialPrice2Date || null,
        utility: nullIfEmpty(utility),
        inventoryEntryDate: inventoryEntryDate || null,
        showBasicInfo: showBasicInfo ?? true,
        showLocationInfo: showLocationInfo ?? true,
        showDetailsInfo: showDetailsInfo ?? true,
        showAuctionInfo: showAuctionInfo ?? true,
        showLegalInfo: showLegalInfo ?? true,
        showValuationInfo: showValuationInfo ?? true,
        slug,
      },
      { transaction }
    );

    await PropertyStatusHistory.create(
      {
        propertyId: created.id,
        fromStatus: null,
        toStatus: created.status,
        userName: req.user?.name || null,
      },
      { transaction }
    );

    return created;
  });

  logger.info('Propiedad creada', {
    propertyId: property.id,
    userId: req.user?.id,
    city,
    type,
    status: property.status,
  });

  // Notificar a suscriptores con alertas coincidentes (sin bloquear la respuesta)
  if ((status || 'disponible') === 'disponible') {
    alertService.notifyAndSend(property);
  }

  logAudit(req, 'create', 'property', property.id, { title: property.title, city, type });

  return res.status(201).json({
    message: 'Propiedad creada exitosamente',
    data: property,
  });
};

// PUT /api/properties/:id
const updateProperty = async (req, res) => {
  const property = await Property.findByPk(req.params.id);
  if (!property) throw new ApiError(404, 'Propiedad no encontrada');

  const {
    title,
    description,
    price,
    city,
    state,
    type,
    category,
    businessLine,
    status,
    squareMeters,
    terrainMeters,
    constructionMeters,
    bedrooms,
    bathrooms,
    halfBathrooms,
    address,
    colonia,
    propertyNumber,
    postalCode,
    auctionDate,
    acquisitionStage,
    isFeatured,
    internalNotes,
    code,
    lot,
    block,
    portfolio,
    legalProcessType,
    template,
    cadastralPlan,
    technicalSheet,
    facebookPage,
    zone,
    zoneType,
    commercialPrice1,
    commercialPrice1Date,
    commercialPrice2,
    commercialPrice2Date,
    utility,
    inventoryEntryDate,
    showBasicInfo,
    showLocationInfo,
    showDetailsInfo,
    showAuctionInfo,
    showLegalInfo,
    showValuationInfo,
  } = req.body;

  if (title && title !== property.title) {
    let slug = generateSlug(title);
    const existing = await Property.findOne({ where: { slug } });
    if (existing && existing.id !== property.id) slug = `${slug}-${Date.now()}`;
    req.body.slug = slug;
  }

  const previousStatus = property.status;
  const previousPrice = property.price;

  // AUDIT-021: solo se incluyen en el UPDATE los campos que el request realmente
  // envió. Antes se pasaban TODOS los campos desestructurados (incluyendo los
  // ausentes, como `undefined`), y nullIfEmpty() convertía esos `undefined` en
  // `null` — cada actualización parcial (ej. arrastrar una propiedad en el Kanban
  // para solo cambiar `status`) borraba silenciosamente price/m²/recámaras/baños/code.
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (price !== undefined) updates.price = nullIfEmpty(price);
  if (city !== undefined) updates.city = city;
  if (state !== undefined) updates.state = nullIfEmpty(state);
  if (type !== undefined) updates.type = type;
  if (category !== undefined) updates.category = category;
  if (businessLine !== undefined) updates.businessLine = businessLine;
  if (status !== undefined) updates.status = status;
  if (squareMeters !== undefined) updates.squareMeters = nullIfEmpty(squareMeters);
  if (terrainMeters !== undefined) updates.terrainMeters = nullIfEmpty(terrainMeters);
  if (constructionMeters !== undefined)
    updates.constructionMeters = nullIfEmpty(constructionMeters);
  if (bedrooms !== undefined) updates.bedrooms = nullIfEmpty(bedrooms);
  if (bathrooms !== undefined) updates.bathrooms = nullIfEmpty(bathrooms);
  if (halfBathrooms !== undefined) updates.halfBathrooms = nullIfEmpty(halfBathrooms);
  if (address !== undefined) updates.address = address;
  if (colonia !== undefined) updates.colonia = colonia;
  if (propertyNumber !== undefined) updates.propertyNumber = nullIfEmpty(propertyNumber);
  if (postalCode !== undefined) updates.postalCode = nullIfEmpty(postalCode);
  if (auctionDate !== undefined) updates.auctionDate = auctionDate || null;
  if (acquisitionStage !== undefined)
    updates.acquisitionStage = acquisitionStage || 'sin_proceso';
  if (isFeatured !== undefined) updates.isFeatured = isFeatured;
  if (internalNotes !== undefined) updates.internalNotes = internalNotes || null;
  if (code !== undefined) updates.code = nullIfEmpty(code);
  if (lot !== undefined) updates.lot = nullIfEmpty(lot);
  if (block !== undefined) updates.block = nullIfEmpty(block);
  if (portfolio !== undefined) updates.portfolio = nullIfEmpty(portfolio);
  if (legalProcessType !== undefined)
    updates.legalProcessType = nullIfEmpty(legalProcessType);
  if (template !== undefined) updates.template = nullIfEmpty(template);
  if (cadastralPlan !== undefined) updates.cadastralPlan = nullIfEmpty(cadastralPlan);
  if (technicalSheet !== undefined) updates.technicalSheet = nullIfEmpty(technicalSheet);
  if (facebookPage !== undefined) updates.facebookPage = nullIfEmpty(facebookPage);
  if (zone !== undefined) updates.zone = nullIfEmpty(zone);
  if (zoneType !== undefined) updates.zoneType = nullIfEmpty(zoneType);
  if (commercialPrice1 !== undefined) updates.commercialPrice1 = nullIfEmpty(commercialPrice1);
  if (commercialPrice1Date !== undefined)
    updates.commercialPrice1Date = commercialPrice1Date || null;
  if (commercialPrice2 !== undefined) updates.commercialPrice2 = nullIfEmpty(commercialPrice2);
  if (commercialPrice2Date !== undefined)
    updates.commercialPrice2Date = commercialPrice2Date || null;
  if (utility !== undefined) updates.utility = nullIfEmpty(utility);
  if (inventoryEntryDate !== undefined)
    updates.inventoryEntryDate = inventoryEntryDate || null;
  if (showBasicInfo !== undefined) updates.showBasicInfo = showBasicInfo;
  if (showLocationInfo !== undefined) updates.showLocationInfo = showLocationInfo;
  if (showDetailsInfo !== undefined) updates.showDetailsInfo = showDetailsInfo;
  if (showAuctionInfo !== undefined) updates.showAuctionInfo = showAuctionInfo;
  if (showLegalInfo !== undefined) updates.showLegalInfo = showLegalInfo;
  if (showValuationInfo !== undefined) updates.showValuationInfo = showValuationInfo;
  if (req.body.slug) updates.slug = req.body.slug;

  await property.update(updates);

  if (status && status !== previousStatus) {
    PropertyStatusHistory.create({
      propertyId: property.id,
      changeType: 'status',
      fromStatus: previousStatus,
      toStatus: status,
      userName: req.user?.name || null,
    }).catch((e) => console.error('Error registrando historial de estatus:', e));

    // AUDIT-005: createProperty ya notificaba a suscriptores con alertas coincidentes,
    // pero updateProperty nunca lo hacía — una propiedad reactivada vía edición no
    // disparaba ningún email/WhatsApp. Ahora ambos comparten alertService.
    if (status === 'disponible' && previousStatus !== 'disponible') {
      alertService.notifyAndSend(property);
    }
  }

  const newPrice = nullIfEmpty(price);
  const prevPrice =
    previousPrice !== null && previousPrice !== undefined ? parseFloat(previousPrice) : null;
  const nextPrice = newPrice !== null && newPrice !== undefined ? parseFloat(newPrice) : null;
  if (price !== undefined && prevPrice !== nextPrice) {
    PropertyStatusHistory.create({
      propertyId: property.id,
      changeType: 'price',
      fromPrice: prevPrice,
      toPrice: nextPrice,
      userName: req.user?.name || null,
    }).catch((e) => console.error('Error registrando historial de precio:', e));
  }

  logAudit(req, 'update', 'property', property.id, { title: property.title });

  return res.json({
    message: 'Propiedad actualizada exitosamente',
    data: property,
  });
};

// DELETE /api/properties/:id
const deleteProperty = async (req, res) => {
  const property = await Property.findByPk(req.params.id, {
    include: [{ model: Image, as: 'images' }],
  });

  if (!property) throw new ApiError(404, 'Propiedad no encontrada');

  // Eliminar imágenes de Cloudinary
  for (const image of property.images) {
    if (image.filename) {
      await destroyCloudinaryAsset(image.filename, {
        controller: 'propertyController',
        operation: 'deleteProperty',
        resourceId: property.id,
        imageId: image.id,
      });
    }
  }

  logAudit(req, 'delete', 'property', property.id, { title: property.title });
  await property.destroy();

  return res.json({ message: 'Propiedad eliminada exitosamente' });
};

// POST /api/properties/:id/images
const uploadImages = async (req, res) => {
  const property = await Property.findByPk(req.params.id);
  if (!property) throw new ApiError(404, 'Propiedad no encontrada');

  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'No se enviaron imágenes');
  }

  // AUDIT-008: multer ya filtró por extensión/mimetype declarado (falsificable); esto
  // verifica los bytes reales del archivo antes de subirlo a Cloudinary.
  if (req.files.some((file) => !isValidImageBuffer(file.buffer))) {
    throw new ApiError(400, 'Uno o más archivos no son imágenes válidas (JPG, PNG o WEBP)');
  }

  const existingImages = await Image.count({ where: { propertyId: property.id } });

  const uploadToCloudinary = (buffer) =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'triomphe/properties',
          transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(buffer);
    });

  const images = await Promise.all(
    req.files.map(async (file, index) => {
      const result = await uploadToCloudinary(file.buffer);
      return Image.create({
        propertyId: property.id,
        url: result.secure_url,
        filename: result.public_id,
        order: existingImages + index,
        isCover: existingImages === 0 && index === 0,
      });
    })
  );

  logAudit(req, 'create', 'property', property.id, { imagesAdded: images.length });

  return res.status(201).json({
    message: `${images.length} imagen(es) subida(s) exitosamente`,
    data: images,
  });
};

// DELETE /api/properties/:id/images/:imageId
const deleteImage = async (req, res) => {
  const image = await Image.findOne({
    where: { id: req.params.imageId, propertyId: req.params.id },
  });

  if (!image) throw new ApiError(404, 'Imagen no encontrada');

  // Eliminar de Cloudinary si tiene public_id
  if (image.filename) {
    await destroyCloudinaryAsset(image.filename, {
      controller: 'propertyController',
      operation: 'deleteImage',
      resourceId: req.params.id,
      imageId: image.id,
    });
  }

  await image.destroy();

  // Si era la portada, asignar la siguiente
  if (image.isCover) {
    const nextImage = await Image.findOne({
      where: { propertyId: req.params.id },
      order: [['order', 'ASC']],
    });
    if (nextImage) await nextImage.update({ isCover: true });
  }

  logAudit(req, 'delete', 'property', req.params.id, { imageId: image.id });

  return res.json({ message: 'Imagen eliminada exitosamente' });
};

// PUT /api/properties/:id/images/:imageId/cover
const setCoverImage = async (req, res) => {
  const property = await Property.findByPk(req.params.id);
  if (!property) throw new ApiError(404, 'Propiedad no encontrada');

  await Image.update({ isCover: false }, { where: { propertyId: req.params.id } });

  const image = await Image.findOne({
    where: { id: req.params.imageId, propertyId: req.params.id },
  });

  if (!image) throw new ApiError(404, 'Imagen no encontrada');

  await image.update({ isCover: true });

  logAudit(req, 'update', 'property', req.params.id, { coverImageId: image.id });

  return res.json({ message: 'Imagen de portada actualizada', data: image });
};

// PUT /api/properties/:id/images/reorder — recibe { imageIds: [id1, id2, ...] } en el orden deseado
const reorderImages = async (req, res) => {
  const { imageIds } = req.body;
  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    throw new ApiError(400, 'imageIds debe ser un arreglo no vacío');
  }

  const images = await Image.findAll({ where: { propertyId: req.params.id } });
  if (images.length !== imageIds.length || !images.every((img) => imageIds.includes(img.id))) {
    throw new ApiError(400, 'El listado de imágenes no coincide con la propiedad');
  }

  await Promise.all(
    imageIds.map((imgId, index) =>
      Image.update({ order: index }, { where: { id: imgId, propertyId: req.params.id } })
    )
  );

  logAudit(req, 'update', 'property', req.params.id, { imageIds });

  return res.json({ message: 'Orden de imágenes actualizado' });
};

// GET /api/properties/promoted — `businessLine` opcional para que la propiedad estrella de
// cada home solo pueda salir de esa línea (una propiedad de remate promovida no debe aparecer
// como estrella en la sección Infonavit y viceversa).
const getPromotedProperty = async (req, res) => {
  const { businessLine } = req.query;
  const where = { isPromoted: true, status: 'disponible' };
  if (businessLine) where.businessLine = businessLine;

  const property = await Property.findOne({
    where,
    include: [{ model: Image, as: 'images', separate: true, order: [['order', 'ASC']] }],
  });
  return res.json({ data: property || null });
};

// PUT /api/properties/:id/promote
const promoteProperty = async (req, res) => {
  // AUDIT-004: las dos operaciones (quitar promoción anterior + activar la nueva) deben
  // ser atómicas — sin transacción, dos admins promoviendo propiedades distintas casi al
  // mismo tiempo pueden terminar con 0 o 2 propiedades isPromoted:true.
  const transaction = await sequelize.transaction();
  try {
    const property = await Property.findByPk(req.params.id, { transaction });
    if (!property) throw new ApiError(404, 'Propiedad no encontrada');

    if (property.isPromoted) {
      await property.update({ isPromoted: false }, { transaction });
      await transaction.commit();
      logAudit(req, 'update', 'property', property.id, { isPromoted: false });
      return res.json({ message: 'Propiedad quitada de promoción', data: property });
    }

    // Quitar la promoción a cualquier otra propiedad y activar esta
    await Property.update({ isPromoted: false }, { where: { isPromoted: true }, transaction });
    await property.update({ isPromoted: true }, { transaction });

    await transaction.commit();
    logAudit(req, 'update', 'property', property.id, { isPromoted: true });
    return res.json({ message: 'Propiedad promocionada exitosamente', data: property });
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    throw error;
  }
};

// GET /api/properties/:id/status-history
const getStatusHistory = async (req, res) => {
  const history = await PropertyStatusHistory.findAll({
    where: { propertyId: req.params.id },
    order: [['createdAt', 'DESC']],
  });
  return res.json({ data: history });
};

// GET /api/properties/:id/price-history (público — sin datos internos)
const getPublicPriceHistory = async (req, res) => {
  const history = await PropertyStatusHistory.findAll({
    where: { propertyId: req.params.id },
    attributes: [
      'id',
      'fromStatus',
      'toStatus',
      'changeType',
      'fromPrice',
      'toPrice',
      'createdAt',
    ],
    order: [['createdAt', 'DESC']],
  });
  return res.json({ data: history });
};

// POST /api/properties/:id/view — registra una visita real a la ficha pública. Separado
// del GET para que ese GET (y el de admin) queden libres de efectos secundarios: cacheables,
// y sin riesgo de que abrir una propiedad para editarla infle el contador de vistas.
const trackView = async (req, res) => {
  await Analytics.create({
    event: 'view',
    propertyId: req.params.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    referrer: req.headers['referer'] || null,
  });

  await Property.increment('views', { where: { id: req.params.id } });

  return res.status(204).send();
};

// POST /api/properties/:id/share — registra evento de compartir
const trackShare = async (req, res) => {
  await Analytics.create({
    event: 'share',
    propertyId: req.params.id,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    referrer: req.headers['referer'] || null,
  });
  return res.status(204).send();
};

module.exports = {
  getProperties,
  getPropertyById,
  getPropertyBySlug,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadImages,
  deleteImage,
  setCoverImage,
  reorderImages,
  getPromotedProperty,
  promoteProperty,
  getStatusHistory,
  getPublicPriceHistory,
  trackView,
  trackShare,
  getPropertyStats,
  getPropertiesSync,
};
