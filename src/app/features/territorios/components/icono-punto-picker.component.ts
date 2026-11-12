import { Component, computed, input, model } from '@angular/core';
import { LucideAngularModule } from '../../../shared/icons';
import { colorTipoPunto, ICONOS_PUNTO, iconoPunto, letraTipoPunto } from '../utils/iconos-punto';

/**
 * Elige el icono del marcador de un punto. La primera opción deja la letra del tipo (S, L, P).
 * Debajo se nombra lo elegido: un dibujo solo no siempre se entiende.
 */
@Component({
  standalone: true,
  selector: 'app-icono-punto-picker',
  imports: [LucideAngularModule],
  template: `
    <div class="space-y-2">
      <p class="form-label !mb-0" [id]="idEtiqueta">Icono en el mapa (opcional)</p>
      <div class="grid grid-cols-[repeat(auto-fill,minmax(40px,1fr))] gap-1.5" role="radiogroup" [attr.aria-labelledby]="idEtiqueta">
        <button type="button" role="radio" [attr.aria-checked]="!valor()" aria-label="Sin icono: la letra del tipo" title="Sin icono"
                (click)="valor.set(null)" class="opcion" [class.elegida]="!valor()" [style.--c]="color()">
          <span class="text-sm font-bold">{{ letra() }}</span>
        </button>
        @for (i of iconos; track i.clave) {
          <button type="button" role="radio" [attr.aria-checked]="valor() === i.clave" [attr.aria-label]="i.etiqueta" [title]="i.etiqueta"
                  (click)="valor.set(i.clave)" class="opcion" [class.elegida]="valor() === i.clave" [style.--c]="color()">
            <lucide-icon [img]="i.datos" [size]="18" [strokeWidth]="2"></lucide-icon>
          </button>
        }
      </div>
      <p class="caption text-slate-600 dark:text-slate-300" aria-live="polite">
        {{ elegido() ? 'Elegido: ' + elegido()!.etiqueta : 'Sin icono: se ve la letra ' + letra() + '.' }}
      </p>
    </div>
  `,
  styles: [`
    .opcion {
      height: 40px; border-radius: 0.75rem; display: flex; align-items: center; justify-content: center;
      border: 1px solid rgb(226 232 240); color: rgb(71 85 105); background: transparent;
      transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 120ms ease-out;
    }
    .opcion:hover { background: rgb(248 250 252); }
    .opcion:active { transform: scale(0.95); }
    .opcion:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }
    .opcion.elegida { background: var(--c); border-color: var(--c); color: #fff; }
    :host-context(.dark) .opcion { border-color: rgb(51 65 85); color: rgb(203 213 225); }
    :host-context(.dark) .opcion:hover { background: rgb(30 41 59); }
    :host-context(.dark) .opcion.elegida { background: var(--c); border-color: var(--c); color: #fff; }
    @media (prefers-reduced-motion: reduce) { .opcion { transition: none; } }
  `],
})
export class IconoPuntoPickerComponent {
  /** Clave elegida; null = sin icono. */
  readonly valor = model<string | null>(null);
  /** Tipo del punto: da el color y la letra de la opción «sin icono». */
  readonly tipo = input<string | null>('Salida');

  readonly iconos = ICONOS_PUNTO;
  readonly idEtiqueta = `icono-punto-${Math.random().toString(36).slice(2, 8)}`;
  readonly color = computed(() => colorTipoPunto(this.tipo()));
  readonly letra = computed(() => letraTipoPunto(this.tipo()));
  readonly elegido = computed(() => iconoPunto(this.valor()));
}
