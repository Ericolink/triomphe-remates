const multer = require('multer');

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const isValid =
    allowedTypes.test(file.originalname.toLowerCase().split('.').pop()) &&
    allowedTypes.test(file.mimetype);
  if (isValid) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
  }
};

// Usar memoria en vez de disco — Cloudinary recibe el buffer
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadDoc = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowed = /pdf|doc|docx|xlsx|xls/;
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (allowed.test(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF, DOC, DOCX, XLSX o XLS'));
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
});

module.exports = upload;
module.exports.uploadDoc = uploadDoc;
