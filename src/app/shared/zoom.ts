/**
 * Zoom CSS efectivo de un elemento (producto de los `zoom` de sus ancestros).
 *
 * Las pantallas que crecen en 2K/4K con `:host { zoom: … }` hacen que un popup
 * `position: fixed` herede ese zoom: las coordenadas de getBoundingClientRect
 * (en px de la ventana) hay que dividirlas por él antes de asignarlas a
 * `style.top/left`, o el menú aparece lejos del campo que lo abrió.
 */
export function zoomDe(el: HTMLElement): number {
  const z = (el as HTMLElement & { currentCSSZoom?: number }).currentCSSZoom;
  return typeof z === 'number' && z > 0 ? z : 1;
}
