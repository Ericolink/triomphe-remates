// AUDIT-008: multer (memoryStorage) solo valida extensión + Content-Type declarado por el
// cliente — ambos falsificables. Esto verifica los primeros bytes reales del archivo antes
// de subirlo a Cloudinary, sin depender de una librería externa.

const matchesSignature = (buffer, signature) =>
  buffer.length >= signature.length && signature.every((byte, i) => buffer[i] === byte);

const IMAGE_SIGNATURES = [
  { type: 'image', bytes: [0xff, 0xd8, 0xff] }, // jpeg
  { type: 'image', bytes: [0x89, 0x50, 0x4e, 0x47] }, // png
  { type: 'image', bytes: [0x52, 0x49, 0x46, 0x46] }, // webp (RIFF....WEBP)
];

// Para webp, RIFF debe ir seguido de "WEBP" en el byte 8
const isWebp = (buffer) =>
  matchesSignature(buffer, [0x52, 0x49, 0x46, 0x46]) &&
  buffer.length >= 12 &&
  buffer.slice(8, 12).toString('ascii') === 'WEBP';

const isValidImageBuffer = (buffer) => {
  if (!buffer || buffer.length < 4) return false;
  if (matchesSignature(buffer, [0x52, 0x49, 0x46, 0x46])) return isWebp(buffer);
  return IMAGE_SIGNATURES.some((sig) => matchesSignature(buffer, sig.bytes));
};

module.exports = { isValidImageBuffer };
