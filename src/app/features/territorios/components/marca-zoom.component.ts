import { Component, Input } from '@angular/core';

/**
 * Distintivo de una salida por Zoom: cámara blanca sobre un cuadro azul, para
 * reconocerla de un vistazo entre las salidas a la calle. Es decorativo: el
 * texto «Zoom» siempre va al lado (nunca solo el color).
 */
@Component({
  standalone: true,
  selector: 'app-marca-zoom',
  template: `
    <span class="marca" [style.width.px]="tam" [style.height.px]="tam" aria-hidden="true">
      <svg [attr.width]="tam * 0.62" [attr.height]="tam * 0.62" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
        <path d="m16 13 5.2 3.5a.5.5 0 0 0 .8-.4V7.9a.5.5 0 0 0-.8-.4L16 11"/>
        <rect x="2" y="6" width="14" height="12" rx="2.5" fill="currentColor"/>
      </svg>
    </span>
  `,
  styles: [`
    :host { display: inline-flex; flex-shrink: 0; }
    .marca {
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 28%; background: rgb(37 99 235); color: #fff;
    }
    :host-context(.dark) .marca { background: rgb(59 130 246); }
  `],
})
export class MarcaZoomComponent {
  /** Lado en px. */
  @Input() tam = 18;
}
