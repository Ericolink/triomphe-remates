const { DataTypes } = require('sequelize');
const sequelize = require('../../config/db');

const Property = sequelize.define(
  'Property',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    city: {
      type: DataTypes.ENUM('juarez', 'chihuahua', 'queretaro'),
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
      comment: 'Estado de la república (texto libre, no ligado al ENUM de city)',
    },
    type: {
      type: DataTypes.ENUM('casa', 'departamento', 'terreno', 'local', 'bodega'),
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM('remate', 'renta', 'compra_venta'),
      allowNull: false,
      defaultValue: 'remate',
      comment: 'Categoría comercial de la propiedad',
    },
    businessLine: {
      type: DataTypes.ENUM('remate', 'credito', 'renta', 'contado', 'inversion'),
      allowNull: false,
      defaultValue: 'remate',
      comment: 'Línea de negocio comercial de la propiedad (5 secciones públicas de /propiedades)',
    },
    status: {
      type: DataTypes.ENUM('disponible', 'en_revision', 'apartado', 'vendido', 'de_vuelta'),
      defaultValue: 'disponible',
    },
    squareMeters: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    terrainMeters: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    constructionMeters: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
    },
    bedrooms: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    // Baños completos — `halfBathrooms` (más abajo) cubre los incompletos.
    bathrooms: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    halfBathrooms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Baños incompletos',
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    // Fraccionamiento y Colonia se fusionaron en un solo campo de texto libre — ver
    // migración 20260813000007-property-form-fields.
    colonia: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: 'Fraccionamiento/Colonia',
    },
    propertyNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Número de la casa/lote, ej. 2512 — distinto de `code` (código interno)',
    },
    postalCode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    auctionDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha del remate',
    },
    views: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Destacar en el sitio público',
    },
    isPromoted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Propiedad estrella — solo una activa a la vez',
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'URL amigable para SEO',
    },
    acquisitionStage: {
      type: DataTypes.ENUM(
        'sin_proceso',
        'documentacion',
        'avaluo',
        'negociacion',
        'firma',
        'entrega'
      ),
      defaultValue: 'sin_proceso',
      allowNull: true,
      comment: 'Etapa del proceso de adquisición visible al público',
    },
    internalNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'Notas internas — solo visibles para administradores',
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Código interno de Triomphe, ej. JRCH-0164',
    },
    // Campos de seguimiento de inventario alineados con la hoja maestra de Excel del
    // negocio — ver migración 20260817000000-add-inventory-tracking-fields-to-properties.
    // Varios se dejan como texto libre a propósito (ver comentario de esa migración).
    lot: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Lote — columna "LT" en la hoja de inventario',
    },
    block: {
      type: DataTypes.STRING(20),
      allowNull: true,
      comment: 'Manzana — columna "MZ" en la hoja de inventario',
    },
    portfolio: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    legalProcessType: {
      type: DataTypes.ENUM('cesion', 'dacion', 'adjudicacion'),
      allowNull: true,
      comment: 'Tipo de proceso legal de adquisición (columna COFINAVIT/VIABILIDAD/TIPO)',
    },
    zone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    // Adeudos de la propiedad — texto libre (no DECIMAL) porque en la práctica llegan con
    // notas tipo "AL CORRIENTE" o un monto con año, no siempre un número puro. Los 3 comparten
    // una sola fecha de actualización (debtsUpdateDate) en vez de una por adeudo porque se
    // capturan/revisan juntos.
    waterDebt: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Adeudo de agua',
    },
    electricityDebt: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Adeudo de luz',
    },
    propertyTaxDebt: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'Adeudo predial',
    },
    debtsUpdateDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha de actualización de los 3 adeudos (agua/luz/predial)',
    },
    commercialPrice1: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Primer precio de avalúo comercial capturado',
    },
    commercialPrice1Date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    commercialPrice2: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Segundo precio de avalúo comercial capturado (actualización posterior)',
    },
    commercialPrice2Date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    utility: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: 'Utilidad — se captura a mano, no se calcula automáticamente',
    },
    inventoryEntryDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: 'Fecha en que la propiedad ingresó al inventario',
    },
    // Control de visibilidad pública por apartado — uno por cada sección de SECTIONS en
    // PropertyFormPage.jsx, ver migración 20260818000000-add-public-visibility-flags-to-
    // properties. Todos default true (una propiedad nueva se ve completa hasta que alguien
    // oculte un apartado a propósito). showLegalInfo/showValuationInfo se guardan pero hoy
    // no tienen ningún efecto visible: esos 2 apartados nunca se renderizan al público.
    showBasicInfo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Mostrar la descripción (Datos básicos) en la página pública',
    },
    showLocationInfo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment:
        'Mostrar dirección exacta/número/código postal en la página pública. Ciudad/estado/' +
        'tipo/categoría/colonia son estructurales y siempre se muestran, sin importar esto ' +
        '(ver PropertyDetailPage.jsx y el apartado "Dirección exacta" en PropertyFormPage.jsx)',
    },
    showDetailsInfo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Mostrar m²/recámaras/baños (Detalles) en la página pública',
    },
    showAuctionInfo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Mostrar el panel de precio e historial (Remate y estatus) en la página pública',
    },
    showLegalInfo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Reservado — Datos catastrales y legales no se muestran hoy en ningún lado',
    },
    showValuationInfo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Reservado — Valuación comercial no se muestra hoy en ningún lado',
    },
  },
  {
    tableName: 'properties',
    timestamps: true,
    // Índice único con nombre fijo (ver migración fix-duplicate-unique-indexes): un `unique:
    // true` inline sin nombre hacía que cada ciclo de sync({alter:true}) creara un índice
    // nuevo en vez de reconocer el existente, hasta llegar al máximo de 64 claves de MySQL.
    //
    // HOTFIX: el índice FULLTEXT (migración 20260721000000) vivía SOLO en la migración, no
    // aquí — cuando checkPendingMigrations.js bootstrapea una base de datos nueva vía
    // sync(), construye el esquema a partir de ESTOS `indexes`, no de las migraciones (que
    // marca como "ya aplicadas" sin ejecutar su up() para una BD nueva). Un índice que solo
    // existe en su migración y no aquí queda silenciosamente sin crear en cualquier base de
    // datos bootstrapeada así — se confirmó exactamente este caso en la práctica.
    indexes: [
      { unique: true, fields: ['slug'], name: 'properties_slug_unique' },
      {
        fields: ['title', 'address', 'description'],
        type: 'FULLTEXT',
        name: 'idx_properties_fulltext_search',
      },
    ],
  }
);

module.exports = Property;
