/**
 * Fecha de hoy (zona horaria del navegador) en el formato ISO corto
 * `YYYY-MM-DD` que usan el date-picker y la API.
 *
 * No usar `new Date().toISOString().split('T')[0]`: eso es la fecha en UTC y
 * en Colombia (UTC-5) desde las 19:00 ya devuelve el día siguiente.
 */
export function hoyIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
