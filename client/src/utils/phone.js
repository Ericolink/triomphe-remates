// Regla de teléfono mexicano compartida por los formularios públicos (ContactForm,
// AlertSubscriptionForm): opcional +52/52 seguido de 10 dígitos, sin separadores.
// Usado como atributo `pattern` nativo de <input>, por eso se exporta como string.
export const PHONE_PATTERN = '^(\\+?52)?\\d{10}$';
export const PHONE_PATTERN_TITLE = '10 dígitos, con o sin +52';
