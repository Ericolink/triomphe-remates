// AUDIT-020: si falta JWT_SECRET, jwt.sign genera tokens válidos pero firmados con un
// secreto vacío/undefined — el servidor arranca normalmente y todas las rutas autenticadas
// fallan después con 401 indistinguibles, sin ningún error visible en logs de arranque (ya
// señalado en la auditoría anterior). Lo mismo para la conexión a BD: sin estas variables
// sequelize.authenticate() falla con un error genérico más difícil de diagnosticar.
const REQUIRED = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];

// Variables de features/comportamiento que ya degradan con gracia si faltan (emailService
// .verifyConnection, whatsappService.isConfigured, CORS cayendo solo a los orígenes de
// localhost, JWT sin expiración explícita) — solo se advierte, no se bloquea el arranque.
const RECOMMENDED = [
  'EMAIL_USER', 'EMAIL_PASS', 'EMAIL_TO',
  'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
  'CLIENT_URL',
  'WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID',
  'JWT_EXPIRES_IN',
];

const validateEnvironment = () => {
  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Variables de entorno requeridas ausentes: ${missing.join(', ')}`);
  }

  const missingRecommended = RECOMMENDED.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn(`⚠️  Variables de entorno recomendadas ausentes (features degradadas): ${missingRecommended.join(', ')}`);
  }
};

module.exports = { validateEnvironment };
