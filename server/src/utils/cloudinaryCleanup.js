const { cloudinary } = require('../config/cloudinary');
const logger = require('./logger');

// Borrado de un recurso en Cloudinary a "mejor esfuerzo": si falla, no debe abortar la
// operación principal (borrar el registro en BD, etc.) — solo se registra para poder
// detectar archivos huérfanos después. Antes cada controlador silenciaba este error de
// forma distinta (catch vacío, .catch(console.error)); esto unifica el logging.
const destroyCloudinaryAsset = async (publicId, context, options = {}) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, options);
  } catch (error) {
    logger.error('Error eliminando recurso de Cloudinary', {
      ...context,
      publicId,
      error: error.message,
    });
  }
};

module.exports = { destroyCloudinaryAsset };
