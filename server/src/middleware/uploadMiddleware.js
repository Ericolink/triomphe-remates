const multer = require('multer');
const { ApiError } = require('./errorHandler');
const { isValidImageBuffer } = require('../utils/fileSignature');

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const isValid =
    allowedTypes.test(file.originalname.toLowerCase().split('.').pop()) &&
    allowedTypes.test(file.mimetype);
  if (isValid) {
    cb(null, true);
  } else {
    // AUDITORÍA 500s: un `Error` genérico aquí llegaba a errorHandler.js como un error no
    // reconocido → 500 "Error interno del servidor", ocultando un rechazo de negocio
    // perfectamente claro (tipo de archivo no permitido) detrás del mismo mensaje opaco que
    // una falla real del servidor. ApiError se propaga igual (multer solo reenvía lo que
    // fileFilter le pase a cb) pero ahora sí responde 400 con el mensaje real.
    cb(new ApiError(400, 'Solo se permiten imágenes JPG, PNG o WEBP'));
  }
};

// Usar memoria en vez de disco — Cloudinary recibe el buffer
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// SEC-004: `fileFilter` de arriba solo valida extensión + Content-Type declarados por el
// cliente en el multipart/form-data — ambos falsificables con solo renombrar un archivo.
// Este middleware corre después de multer (necesita `req.file`/`req.files` ya parseados) y
// verifica los primeros bytes reales de cada archivo recibido contra las firmas de
// JPEG/PNG/WEBP (ver utils/fileSignature.js), sin importar si llegó vía upload.single,
// .array o .fields — usarlo siempre inmediatamente después del middleware de multer
// correspondiente, en cualquier ruta que reciba imágenes.
const validateImageSignature = (req, res, next) => {
  const buffers = [];
  if (req.file) buffers.push(req.file.buffer);
  if (Array.isArray(req.files)) {
    buffers.push(...req.files.map((file) => file.buffer));
  } else if (req.files && typeof req.files === 'object') {
    for (const fieldFiles of Object.values(req.files)) {
      buffers.push(...fieldFiles.map((file) => file.buffer));
    }
  }

  if (buffers.some((buffer) => !isValidImageBuffer(buffer))) {
    throw new ApiError(400, 'Uno o más archivos no son imágenes válidas (JPG, PNG o WEBP)');
  }

  next();
};

module.exports = upload;
module.exports.validateImageSignature = validateImageSignature;
