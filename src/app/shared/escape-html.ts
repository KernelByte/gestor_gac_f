/**
 * Escapa texto para insertarlo en HTML construido a mano (L.divIcon, bindTooltip,
 * bindPopup con cadenas). Leaflet asigna esas cadenas a innerHTML, así que todo
 * dato que venga de la API/BD debe pasar por aquí.
 */
export function escapeHtml(valor: unknown): string {
  return String(valor ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!
  ));
}
