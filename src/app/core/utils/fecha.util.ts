/**
 * Fecha de hoy (zona horaria del navegador) en el formato ISO corto
 * `YYYY-MM-DD` que usan el date-picker y la API.
 *
 * No usar `new Date().toISOString().split('T')[0]`: eso es la fecha en UTC y
 * en Colombia (UTC-5) desde las 19:00 ya devuelve el día siguiente.
 */
export function hoyIso(): string {
  return fechaIsoLocal(new Date());
}

/** Cualquier fecha en `YYYY-MM-DD` según la zona del navegador (ver `hoyIso`). */
export function fechaIsoLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Año de servicio que contiene `d`: va de septiembre a agosto y se nombra por
 * el año en que termina (sep-2025 → ago-2026 es el 2026).
 */
export function anoServicioDe(d = new Date()): number {
  return d.getMonth() + 1 >= 9 ? d.getFullYear() + 1 : d.getFullYear();
}
