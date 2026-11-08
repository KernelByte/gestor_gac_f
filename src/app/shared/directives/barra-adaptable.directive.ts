import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input } from '@angular/core';

/**
 * Barra de herramientas que se compacta por niveles según el ancho que de
 * verdad tiene, en vez de dejar que flexbox recorte lo primero que encuentre.
 *
 * Antes, en Reuniones, la píldora de pestañas compartía fila con la bandeja
 * del mes y era ella la que cedía: con un mes en "Cambios sin publicar" la
 * bandeja crecía y la pestaña activa quedaba cortada a media palabra. Ahora la
 * píldora no cede nunca y lo que se compacta es lo secundario, en orden:
 *
 *   nivel 1 → se ocultan los elementos `.barra-cede-1` (datos de apoyo)
 *   nivel 2 → también los `.barra-cede-2` (rótulos de botones que tienen
 *             icono y aria-label: quedan como botón de icono)
 *
 * Se elige el nivel más bajo con el que todo cabe en una línea. Si ni el
 * último alcanza, la fila envuelve (flex-wrap) y la bandeja baja entera a la
 * línea siguiente; ahí se vuelve a buscar el nivel más bajo que le basta a
 * ella sola, para no quitar rótulos que en su propia línea sí caben.
 *
 * Mide con el ancho natural de cada hijo (sin encoger ni envolver) mediante
 * `data-midiendo`, que vive solo durante la medición síncrona: nunca se pinta.
 * Corre fuera de la zona de Angular y solo toca atributos del DOM, así que no
 * dispara detección de cambios (ver el bucle del indicador de pestañas).
 */
@Directive({
  selector: '[barraAdaptable]',
  standalone: true,
  host: { class: 'barra-adaptable' },
})
export class BarraAdaptableDirective implements OnInit, OnDestroy {
  /** Cuántos niveles de compactación existen (clases `.barra-cede-N`). */
  readonly niveles = input(2, { alias: 'barraAdaptable', transform: (v: number | string) => Number(v) || 2 });

  private el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private zone = inject(NgZone);
  private ro?: ResizeObserver;
  private mo?: MutationObserver;
  private raf = 0;

  ngOnInit() {
    if (typeof ResizeObserver === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      this.ro = new ResizeObserver(() => this.programar());
      this.ro.observe(this.el);
      // El ancho del contenido cambia sin que cambie el de la fila: un @if
      // que monta la bandeja, "Publicado" que pasa a "Cambios sin publicar".
      // Solo hijos y texto, no atributos: data-compacto los cambia esta misma
      // directiva y observarlos sería un bucle.
      this.mo = new MutationObserver(() => this.programar());
      this.mo.observe(this.el, { childList: true, subtree: true, characterData: true });
      document.fonts?.ready.then(() => this.programar());
      this.programar();
    });
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.mo?.disconnect();
  }

  private programar() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.ajustar());
  }

  private ajustar() {
    const fila = this.el;
    const max = this.niveles();
    if (!fila.isConnected || fila.clientWidth === 0) return;

    fila.setAttribute('data-midiendo', '');
    const disponible = fila.clientWidth;

    // 1) ¿Cabe todo en una línea?
    let nivel = this.primerNivel(max, () => fila.scrollWidth <= disponible + 1);

    // 2) No: la bandeja ([data-bandeja]) baja a su propia línea, bajo las
    //    pestañas, y el resto de la fila se queda arriba. Basta con que ella
    //    sola quepa a lo ancho.
    const envuelta = nivel < 0;
    if (envuelta) {
      const bandeja = fila.querySelector<HTMLElement>('[data-bandeja]');
      nivel = bandeja ? this.primerNivel(max, () => bandeja.scrollWidth <= disponible + 1) : -1;
      if (nivel < 0) nivel = max;
    }

    fila.dataset['compacto'] = String(nivel);
    fila.toggleAttribute('data-envuelta', envuelta);
    fila.removeAttribute('data-midiendo');
  }

  private primerNivel(max: number, cabe: () => boolean): number {
    for (let n = 0; n <= max; n++) {
      this.el.dataset['compacto'] = String(n);
      if (cabe()) return n;
    }
    return -1;
  }
}
