import {
  Component, EventEmitter, Input, OnDestroy, Output, computed, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExhibidorMapComponent } from './exhibidor-map.component';
import { GeoJSONPoint, PuntoSacada, UbicacionExhibidor } from '../models/exhibidor.model';

/**
 * Campo compacto para fijar una coordenada, con el mapa a pantalla completa.
 *
 * El problema que resuelve: un mapa embebido dentro de la columna de un modal
 * queda en ~330×200 px. A ese tamaño no se distingue una manzana de otra, hay
 * que hacer zoom a ciegas y el gesto de arrastrar pelea con el scroll del
 * formulario. Aquí el formulario solo muestra el estado ("Ubicado" + las
 * coordenadas) y el mapa se abre grande, encima de todo, cuando de verdad se
 * necesita.
 *
 * El valor solo se confirma al pulsar "Confirmar": mover el pin y cerrar con
 * Escape o Cancelar deja el formulario intacto.
 */
@Component({
  selector: 'app-selector-ubicacion',
  standalone: true,
  imports: [CommonModule, ExhibidorMapComponent],
  template: `
    <!-- ── Campo compacto ────────────────────────────────── -->
    <div class="flex items-center gap-2">
      <button type="button"
              class="flex-1 min-w-0 flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left
                     transition-colors focus-ring-blue min-h-11
                     bg-white dark:bg-slate-800
                     border-slate-200 dark:border-slate-700
                     hover:border-slate-300 dark:hover:border-slate-600
                     disabled:opacity-60 disabled:cursor-not-allowed"
              [disabled]="disabled"
              (click)="abrir()">
        <svg class="w-4 h-4 shrink-0" [class.text-exh-600]="value" [class.text-slate-400]="!value"
             fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round"
                d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>

        <span class="flex-1 min-w-0">
          <span class="block text-sm truncate"
                [class.text-slate-800]="value"
                [class.dark:text-slate-100]="value"
                [class.text-slate-400]="!value"
                [class.italic]="!value">
            {{ value ? 'Ubicado en el mapa' : 'Sin ubicar' }}
          </span>
          <span *ngIf="value as v" class="block text-xs text-slate-400 dark:text-slate-500 truncate data-num">
            {{ v.coordinates[1] | number:'1.5-5' }}, {{ v.coordinates[0] | number:'1.5-5' }}
          </span>
        </span>

        <span class="shrink-0 text-xs font-semibold text-exh-600 dark:text-exh-400">
          {{ value ? 'Cambiar' : 'Ubicar en el mapa' }}
        </span>
      </button>

      <!-- Quitar: acción destructiva, fuera del botón principal para no
           convertirlo en un control con dos zonas de clic. -->
      <button *ngIf="value && !disabled" type="button"
              class="shrink-0 p-2 rounded-lg text-slate-400 transition-colors focus-ring-blue
                     hover:text-red-600 hover:bg-red-50
                     dark:hover:text-red-400 dark:hover:bg-red-950/40"
              title="Quitar ubicación" aria-label="Quitar ubicación"
              (click)="limpiar()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>

    <!-- ── Overlay con el mapa grande ────────────────────── -->
    <div *ngIf="overlay()"
         class="overlay-mapa fixed inset-0 flex items-center justify-center p-4"
         role="dialog" aria-modal="true" aria-label="Ubicar en el mapa">

      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
           (click)="cancelar()"></div>

      <div class="panel-mapa relative flex flex-col w-full max-w-5xl rounded-2xl overflow-hidden
                  bg-white dark:bg-slate-800 shadow-2xl animate-scale-in">

        <!-- Cabecera -->
        <div class="flex items-start justify-between gap-4 px-5 py-3.5 shrink-0
                    border-b border-slate-100 dark:border-slate-700">
          <div class="min-w-0">
            <h2 class="display-section text-lg truncate">Ubicar en el mapa</h2>
            <!-- La instrucción no va aquí: la lleva la píldora sobre el mapa,
                 que es donde el ojo está mirando. -->
            <p *ngIf="titulo" class="text-sm text-slate-500 dark:text-slate-400 truncate">
              {{ titulo }}
            </p>
          </div>
          <button type="button" aria-label="Cerrar"
                  class="shrink-0 p-1.5 rounded-lg text-slate-400 transition
                         hover:text-slate-700 hover:bg-slate-100
                         dark:hover:text-slate-200 dark:hover:bg-slate-700 focus-ring-blue"
                  (click)="cancelar()">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Mapa: min-h-0 es obligatorio para que flex-1 pueda encoger dentro
             de un contenedor flex y el mapa no desborde la altura del panel. -->
        <div class="relative flex-1 min-h-0">
          <app-exhibidor-map
            class="absolute inset-0"
            [redondeado]="false"
            [ubicaciones]="ubicacionesRef"
            [puntosSacada]="puntosRef"
            [modoSeleccion]="true"
            [autoUbicar]="true"
            [puntoProvisional]="borrador()"
            [tipoProvisional]="tipo"
            height="100%"
            (coordenadaSeleccionada)="borrador.set($event)"
          />

          <!-- Instrucción flotante mientras no hay punto -->
          <div *ngIf="!borrador()"
               class="absolute top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1.5 rounded-full
                      text-xs font-medium shadow-md backdrop-blur-sm pointer-events-none
                      bg-white/95 dark:bg-slate-800/95
                      text-slate-600 dark:text-slate-300
                      border border-slate-200 dark:border-slate-600">
            Haz clic en el mapa para colocar el punto
          </div>
        </div>

        <!-- Pie -->
        <div class="flex items-center justify-between gap-3 px-5 py-3.5 shrink-0
                    border-t border-slate-100 dark:border-slate-700
                    bg-slate-50/60 dark:bg-slate-900/30">
          <p class="text-xs truncate" [class.text-slate-400]="!borrador()"
             [class.text-slate-600]="borrador()" [class.dark:text-slate-300]="borrador()">
            <span *ngIf="borrador() as b" class="data-num">
              {{ b.coordinates[1] | number:'1.5-5' }}, {{ b.coordinates[0] | number:'1.5-5' }}
            </span>
            <span *ngIf="!borrador()">Sin punto colocado</span>
          </p>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" class="btn-secondary focus-ring-blue" (click)="cancelar()">Cancelar</button>
            <button type="button" class="btn-primary-blue focus-ring-blue"
                    [disabled]="!borrador()" [class.opacity-50]="!borrador()"
                    (click)="confirmar()">
              Confirmar ubicación
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* 70 = --z-popover de la escala de styles.scss (base 1, dropdown 30,
       sticky 40, modal 50-60, popover 70, paleta 90, toast 100). Va en literal
       y no con var(): Tailwind v4 elimina del CSS las variables de @theme que
       nadie usa, y --z-popover es una de ellas — var(--z-popover) no resuelve.
       Tiene que ganarle al modal que contiene este campo, no al toast. */
    .overlay-mapa { z-index: 70; }

    /* En CSS del componente y no como h-[min(86dvh,780px)]: Tailwind v4 no
       genera los valores arbitrarios que llevan coma — la clase se escribe,
       no sale ninguna regla y el panel colapsa sin avisar. dvh, no vh, para
       que la barra del navegador móvil no recorte el pie con los botones. */
    .panel-mapa { height: min(86dvh, 780px); }
  `],
})
export class SelectorUbicacionComponent implements OnDestroy {
  @Input() value: GeoJSONPoint | null = null;
  @Output() valueChange = new EventEmitter<GeoJSONPoint | null>();

  /** Nombre de lo que se está ubicando; se muestra bajo el título del overlay. */
  @Input() titulo = '';
  /** Elige la silueta del marcador provisional: gota "S" para sacada, círculo "+" para exhibidor. */
  @Input() tipo: 'exhibidor' | 'sacada' = 'sacada';
  @Input() disabled = false;

  /** Marcadores de referencia: ayudan a situarse respecto a lo ya existente. */
  @Input() ubicacionesRef: UbicacionExhibidor[] = [];
  @Input() puntosRef: PuntoSacada[] = [];

  overlay = signal(false);
  /** Punto en edición. No se propaga al formulario hasta "Confirmar". */
  borrador = signal<GeoJSONPoint | null>(null);

  private escListener: ((e: KeyboardEvent) => void) | null = null;

  abrir(): void {
    if (this.disabled) return;
    this.borrador.set(this.value);
    this.overlay.set(true);
    this.escucharEscape();
  }

  /**
   * Escape en fase de captura sobre window, no un @HostListener normal.
   *
   * Este campo vive dentro de <app-modal>, que cierra con un listener de
   * Escape en `document`. Un listener propio en document se dispararía a la
   * vez que el suyo y Escape cerraría el modal entero perdiendo el formulario.
   * En captura sobre window llegamos antes y cortamos la propagación.
   */
  private escucharEscape(): void {
    this.dejarDeEscuchar();
    this.escListener = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      this.cancelar();
    };
    window.addEventListener('keydown', this.escListener, true);
  }

  private dejarDeEscuchar(): void {
    if (!this.escListener) return;
    window.removeEventListener('keydown', this.escListener, true);
    this.escListener = null;
  }

  private cerrarOverlay(): void {
    this.overlay.set(false);
    this.dejarDeEscuchar();
  }

  cancelar(): void {
    this.cerrarOverlay();
  }

  confirmar(): void {
    const punto = this.borrador();
    if (!punto) return;
    this.value = punto;
    this.valueChange.emit(punto);
    this.cerrarOverlay();
  }

  limpiar(): void {
    this.value = null;
    this.valueChange.emit(null);
  }

  ngOnDestroy(): void {
    this.dejarDeEscuchar();
  }
}
