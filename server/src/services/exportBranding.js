// AUDIT-017: paleta de marca extraída de exportController.js — antes vivía mezclada con
// queries, helpers de imagen y la lógica de generación de Excel/PDF en un solo archivo
// de 838 líneas.
const PRIMARY = '#22273A';
const ACCENT = '#D2A057';
const BG_ALT = '#f0f4f8';
const TEXT = '#374151';
const ST_GREEN = '#10b981';
const ST_YELLOW = '#f59e0b';
const ST_RED = '#ef4444';

const PRIMARY_ARGB = 'FF22273A';
const ACCENT_ARGB = 'FFD2A057';
const BG_ALT_ARGB = 'FFf0f4f8';
const WHITE_ARGB = 'FFFFFFFF';
const TEXT_ARGB = 'FF374151';
const ST_GREEN_ARGB = 'FF10b981';
const ST_YELLOW_ARGB = 'FFf59e0b';
const ST_RED_ARGB = 'FFef4444';

const statusArgb = { disponible: ST_GREEN_ARGB, apartado: ST_YELLOW_ARGB, vendido: ST_RED_ARGB };
const statusHex = { disponible: ST_GREEN, apartado: ST_YELLOW, vendido: ST_RED };

const COMPANY_PHONE = '+52 (656) 579-2750';
const COMPANY_WHATSAPP = '526565792750';
const COMPANY_EMAIL = 't.bienesraicesmx@gmail.com';
// Misma dirección de oficina que client/src/utils/constants.js OFFICES (Cd. Juárez).
const COMPANY_ADDRESS = 'Av. Paseo Triunfo de la República 215-INT 24, San Lorenzo, 32320 Juárez, Chih.';
const COMPANY_ADDRESS_MAPS_URL = 'https://maps.app.goo.gl/iRTMK1476tSHDiw36';

module.exports = {
  PRIMARY,
  ACCENT,
  BG_ALT,
  TEXT,
  ST_GREEN,
  ST_YELLOW,
  PRIMARY_ARGB,
  ACCENT_ARGB,
  BG_ALT_ARGB,
  WHITE_ARGB,
  TEXT_ARGB,
  ST_GREEN_ARGB,
  ST_YELLOW_ARGB,
  statusArgb,
  statusHex,
  COMPANY_PHONE,
  COMPANY_WHATSAPP,
  COMPANY_EMAIL,
  COMPANY_ADDRESS,
  COMPANY_ADDRESS_MAPS_URL,
};
