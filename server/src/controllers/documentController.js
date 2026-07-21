const { cloudinary } = require('../config/cloudinary');
const { PropertyDocument, Property } = require('../models');
const { logAudit } = require('../utils/audit');
const { isValidDocumentBuffer } = require('../utils/fileSignature');
const { destroyCloudinaryAsset } = require('../utils/cloudinaryCleanup');

const uploadToCloudinary = (buffer, name) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'triomphe/documents',
        resource_type: 'raw',
        public_id: name,
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result);
      }
    );
    stream.end(buffer);
  });

// GET /api/properties/:id/documents (público) — AUDIT-007: solo documentos marcados isPublic
exports.getDocuments = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const docs = await PropertyDocument.findAll({
      where: { propertyId: req.params.id, isPublic: true },
      order: [['createdAt', 'ASC']],
    });
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
};

// GET /api/properties/:id/documents/all (admin) — incluye documentos privados, para el panel
exports.getAllDocuments = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    const docs = await PropertyDocument.findAll({
      where: { propertyId: req.params.id },
      order: [['createdAt', 'ASC']],
    });
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (!req.file) return res.status(400).json({ error: 'No se envió ningún archivo' });

    // AUDIT-008: validar bytes reales, no solo la extensión declarada por el cliente
    if (!isValidDocumentBuffer(req.file.buffer)) {
      return res
        .status(400)
        .json({ error: 'El archivo no es un documento válido (PDF, DOC, DOCX, XLS o XLSX)' });
    }

    const existing = await PropertyDocument.count({ where: { propertyId: property.id } });
    if (existing >= 10)
      return res.status(400).json({ error: 'Máximo 10 documentos por propiedad' });

    const originalName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const result = await uploadToCloudinary(req.file.buffer, originalName);

    const doc = await PropertyDocument.create({
      propertyId: property.id,
      name: req.body.name || req.file.originalname,
      url: result.secure_url,
      filename: result.public_id,
      size: req.file.size,
      isPublic:
        req.body.isPublic === undefined
          ? true
          : req.body.isPublic === 'true' || req.body.isPublic === true,
    });

    logAudit(req, 'create', 'property', property.id, `Documento subido: ${doc.name}`);
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir documento' });
  }
};

// PATCH /api/properties/:id/documents/:docId/visibility (admin)
exports.setDocumentVisibility = async (req, res) => {
  try {
    const doc = await PropertyDocument.findOne({
      where: { id: req.params.docId, propertyId: req.params.id },
    });
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    await doc.update({ isPublic: Boolean(req.body.isPublic) });
    logAudit(
      req,
      'update',
      'property',
      req.params.id,
      `Visibilidad de documento cambiada: ${doc.name} → ${doc.isPublic ? 'público' : 'privado'}`
    );
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar visibilidad del documento' });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const doc = await PropertyDocument.findOne({
      where: { id: req.params.docId, propertyId: req.params.id },
    });
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    await destroyCloudinaryAsset(
      doc.filename,
      {
        controller: 'documentController',
        operation: 'deleteDocument',
        resourceId: req.params.id,
        documentId: doc.id,
      },
      { resource_type: 'raw' }
    );

    await doc.destroy();
    logAudit(req, 'delete', 'property', req.params.id, `Documento eliminado: ${doc.name}`);
    res.json({ message: 'Documento eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
};
