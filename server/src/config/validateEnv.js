// AUDIT-020: si falta JWT_SECRET, jwt.sign genera tokens válidos pero firmados con un
// secreto vacío/undefined — el servidor arranca normalmente y todas las rutas autenticadas
// fallan después con 401 indistinguibles, sin ningún error visible en logs de arranque (ya
// señalado en la auditoría anterior). Lo mismo para la conexión a BD: sin estas variables
// sequelize.authenticate() falla con un error genérico más difícil de diagnosticar.
//
// Hardening JWT (2026-07-21): JWT_EXPIRES_IN pasó de "recomendada" a obligatoria — si falta,
// jwt.sign() (ver utils/helpers.js#generateToken) omite el claim `exp` y emite tokens que
// nunca caducan, sin que nada lo advierta en tiempo de ejecución. Además JWT_SECRET ahora se
// valida contra un mínimo de seguridad: un secreto corto o trivial degrada silenciosamente la
// firma HS256 a algo adivinable por fuerza bruta. Estrategia fail-fast: el proceso se detiene
// en el arranque en vez de servir peticiones con una configuración insegura.
const REQUIRED = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET', 'JWT_EXPIRES_IN'];

// Variables de features/comportamiento que ya degradan con gracia si faltan (emailService
// .verifyConnection, whatsappService.isConfigured, CORS cayendo solo a los orígenes de
// localhost) — solo se advierte, no se bloquea el arranque.
const RECOMMENDED = [
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_TO',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'CLIENT_URL',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
];

// HS256 firma con HMAC-SHA256: el mínimo de seguridad ampliamente recomendado (OWASP JWT
// Cheat Sheet, NIST SP 800-107) es que la clave tenga al menos tantos bits como la salida
// del hash, es decir 256 bits = 32 bytes. Usamos 32 caracteres como proxy simple para un
// secreto en texto plano (un secreto generado con crypto.randomBytes(32).toString('hex')
// ya produce 64 caracteres, así que 32 es un piso conservador, no el objetivo).
const MIN_JWT_SECRET_LENGTH = 32;

// Valores de ejemplo, placeholders de documentación o secretos triviales conocidos que no
// deben usarse en ningún entorno real, incluso si por casualidad superan el largo mínimo.
const WEAK_JWT_SECRETS = new Set([
  'secret',
  'secretkey',
  'mysecretkey',
  'jwtsecret',
  'jwt_secret',
  'jsonwebtokensecret',
  'changeme',
  'change_me',
  'changethissecret',
  'password',
  'password123',
  '12345678',
  '123456789',
  'qwertyuiop',
  'your-256-bit-secret',
  'your_jwt_secret',
  'your_jwt_secret_here',
  'supersecret',
  'supersecretkey',
  'topsecret',
  'test_secret_key',
  'triomphe',
  'triomphe_db',
  'triomphe_secret',
  'triomphe_jwt_super_secreto_2024', // secreto real filtrado en web.config (AUDITORIA_CTO_EXTREMA.md) — nunca reutilizar
]);

// Devuelve la lista de problemas encontrados en JWT_SECRET (vacía si es válido).
const validateJwtSecret = (secret) => {
  const errors = [];

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(
      `demasiado corto (${secret.length} caracteres, mínimo ${MIN_JWT_SECRET_LENGTH}). ` +
        `Genera uno seguro con: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
    );
    // El resto de chequeos (lista de triviales, repetición) son ruido si ya es demasiado corto.
    return errors;
  }

  if (WEAK_JWT_SECRETS.has(secret.trim().toLowerCase())) {
    errors.push('es un valor trivial o de ejemplo conocido y no debe usarse en ningún entorno');
  }

  if (/^(.)\1+$/.test(secret)) {
    errors.push('no puede consistir en un único carácter repetido');
  }

  return errors;
};

const validateEnvironment = () => {
  const errors = [];

  const missing = REQUIRED.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    errors.push(`Variables de entorno requeridas ausentes: ${missing.join(', ')}`);
  }

  // Solo evaluamos la fortaleza si JWT_SECRET está presente — si falta, ya quedó
  // reportado arriba y validarlo aquí solo produciría un mensaje redundante.
  if (process.env.JWT_SECRET) {
    const jwtSecretErrors = validateJwtSecret(process.env.JWT_SECRET);
    jwtSecretErrors.forEach((detail) => errors.push(`JWT_SECRET inválido: ${detail}`));
  }

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  const missingRecommended = RECOMMENDED.filter((key) => !process.env[key]);
  if (missingRecommended.length > 0) {
    console.warn(
      `⚠️  Variables de entorno recomendadas ausentes (features degradadas): ${missingRecommended.join(', ')}`
    );
  }
};

module.exports = { validateEnvironment, validateJwtSecret, MIN_JWT_SECRET_LENGTH };
