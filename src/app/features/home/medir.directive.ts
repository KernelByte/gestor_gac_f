import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, output } from '@angular/core';

export interface Medida { ancho: number; alto: number }

/**
 * Emite el tamaño del elemento cada vez que cambia. El dashboard no hace scroll:
 * listas, puntos y mosaicos deciden cuánto mostrar según el espacio real.
 */
@Directive({ selector: '[medir]', standalone: true })
export class MedirDirective implements OnInit, OnDestroy {
  readonly medir = output<Medida>();
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);
  private ro?: ResizeObserver;
  private raf = 0;

  ngOnInit() {
    if (typeof ResizeObserver === 'undefined') return;
    this.ro = new ResizeObserver(([e]) => {
      cancelAnimationFrame(this.raf);
      // Un frame después: evita el bucle «ResizeObserver loop» al cambiar el contenido medido.
      this.raf = requestAnimationFrame(() => this.zone.run(() =>
        this.medir.emit({ ancho: Math.floor(e.contentRect.width), alto: Math.floor(e.contentRect.height) })));
    });
    this.ro.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
  }
}
