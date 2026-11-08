import { Directive, ElementRef, Input, OnChanges, OnDestroy, inject } from '@angular/core';
import { REDUCED_MOTION } from './dashboard-charts';

/**
 * Cuenta desde el último valor mostrado hasta el nuevo. Escribe directo en el
 * DOM (sin signals) para no disparar detección de cambios en cada frame.
 */
@Directive({ selector: '[countUp]', standalone: true })
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('countUp') value: number | null | undefined = 0;
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private shown = 0;
  private raf = 0;

  ngOnChanges() {
    cancelAnimationFrame(this.raf);
    const from = this.shown;
    const to = this.value ?? 0;
    if (REDUCED_MOTION || from === to) { this.paint(to); return; }
    const inicio = performance.now();
    const duracion = 800;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion);
      const e = 1 - Math.pow(1 - p, 4);
      this.paint(Math.round(from + (to - from) * e));
      if (p < 1) this.raf = requestAnimationFrame(paso);
    };
    this.raf = requestAnimationFrame(paso);
  }

  ngOnDestroy() { cancelAnimationFrame(this.raf); }

  private paint(v: number) {
    this.shown = v;
    this.el.nativeElement.textContent = v.toLocaleString('es-CO');
  }
}
