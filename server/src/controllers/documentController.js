const { cloudinary } = require('../config/cloudinary');
const { PropertyDocument, Property } = require('../models');
const { logAudit } = require('../utils/audit');

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

exports.getDocuments = async (req, res) => {
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

    const existing = await PropertyDocument.count({ where: { propertyId: property.id } });
    if (existing >= 10) return res.status(400).json({ error: 'Máximo 10 documentos por propiedad' });

    const originalName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const result = await uploadToCloudinary(req.file.buffer, originalName);

    const doc = await PropertyDocument.create({
      propertyId: property.id,
      name: req.body.name || req.file.originalname,
      url: result.secure_url,
      filename: result.public_id,
      size: req.file.size,
    });

    logAudit(req, 'create', 'property', property.id, `Documento subido: ${doc.name}`);
    res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al subir documento' });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const doc = await PropertyDocument.findOne({
      where: { id: req.params.docId, propertyId: req.params.id },
    });
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado' });

    try { await cloudinary.uploader.destroy(doc.filename, { resource_type: 'raw' }); } catch { /* ignorado */ }

    await doc.destroy();
    logAudit(req, 'delete', 'property', req.params.id, `Documento eliminado: ${doc.name}`);
    res.json({ message: 'Documento eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar documento' });
  }
};
