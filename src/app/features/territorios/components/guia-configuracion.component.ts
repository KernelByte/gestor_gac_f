import { Component, computed, input, output, signal } from '@angular/core';
import { ProgresoConfiguracion } from '../models/territorio.model';

export type DestinoGuia =
  | { a: 'mapa' }
  | { a: 'barrios' }
  | { a: 'nueva-tarjeta' }
  | { a: 'tarjeta'; id: number }
  | { a: 'manzanas-lote' };

interface Paso {
  n: number;
  titulo: string;
  /** Nombre en la ficha del paso. */
  corto: string;
  hecho: boolean;
  /** Avance corto a la derecha: «18 de 30 con límite». */
  detalle: string;
  /** Qué hacer, solo en el paso actual. */
  instruccion: string;
  boton: string;
  destino: DestinoGuia | null;
  /** Segundo botón (solo el paso 4, para Admin/Gestor). */
  boton2?: string;
  destino2?: DestinoGuia;
}

const CLAVE_CERRADA = 'gac.territorios.guiaCompletaCerrada';

function leerCerrada(): boolean {
  try { return localStorage.getItem(CLAVE_CERRADA) === '1'; } catch { return false; }
}

/**
 * «Prepare su territorio»: los cuatro pasos en orden (mapa → barrios → límites → manzanas).
 * Solo el paso actual está abierto con un botón; los hechos llevan ✓ y los siguientes esperan.
 */
@Component({
  standalone: true,
  selector: 'app-guia-configuracion',
  template: `
  @if (progreso(); as p) {
    @if (completo()) {
      @if (!cerrada()) {
        <div class="flex items-center gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-3" role="status">
          <svg class="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 aparecer" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <p class="flex-1 text-sm font-semibold text-emerald-900 dark:text-emerald-100">Territorio completo: mapa, barrios, límites y manzanas listos.</p>
          <button type="button" (click)="cerrar()" class="h-9 px-3 rounded-lg text-sm font-bold text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">Cerrar</button>
        </div>
      }
    } @else {
      <!-- Una sola franja: los pasos como fichas y, a la derecha, lo que hay que hacer ahora. -->
      <section class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 sm:px-4 flex flex-col lg:flex-row lg:items-center gap-x-5 gap-y-2.5"
               aria-label="Prepare su territorio">
        <ol class="flex items-center gap-1 shrink-0 overflow-x-auto simple-scrollbar -mx-1 px-1">
          @for (s of pasos(); track s.n) {
            @let esActual = s.n === actual();
            @if (s.n > 1) {
              <li aria-hidden="true" class="w-3 sm:w-5 h-px shrink-0" [class]="s.hecho || esActual ? 'bg-emerald-500/60' : 'bg-slate-200 dark:bg-slate-700'"></li>
            }
            <li class="shrink-0">
              <button type="button" (click)="s.hecho && s.destino && ir.emit(s.destino)" [disabled]="!s.hecho"
                      [attr.aria-current]="esActual ? 'step' : null"
                      [attr.title]="s.hecho ? s.titulo + ': listo. Toque para verlo.' : esActual ? s.titulo + ': paso actual' : s.titulo + ': primero termine el paso ' + (s.n - 1)"
                      class="h-9 pl-1 pr-3.5 inline-flex items-center gap-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                      [class]="esActual ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/20 dark:bg-emerald-500 dark:text-emerald-950'
                             : s.hecho ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                             : 'text-slate-400 dark:text-slate-500 cursor-default'">
                @if (s.hecho) {
                  <span class="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center aparecer" aria-hidden="true">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </span>
                } @else {
                  <!-- Tres estados que se distinguen sin leer: ✓ lleno (hecho), círculo invertido (ahora), contorno (después). -->
                  <span class="w-7 h-7 rounded-full text-sm font-bold tabular-nums flex items-center justify-center" aria-hidden="true"
                        [class]="esActual ? 'bg-white text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'border-[1.5px] border-dashed border-slate-300 dark:border-slate-600'">{{ s.n }}</span>
                }
                <span class="sr-only">Paso {{ s.n }}: </span>
                <!-- En el teléfono solo se nombra el paso actual; los demás quedan como número o ✓. -->
                <span [class]="esActual ? '' : 'hidden sm:inline'">{{ s.corto }}</span>
              </button>
            </li>
          }
        </ol>

        @if (pasoActual(); as s) {
          <p class="flex-1 min-w-0 text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
            <span class="font-bold text-slate-900 dark:text-white">{{ s.detalle }}.</span>
            {{ s.instruccion }}
          </p>
          @if (puedeEditar()) {
            <div class="flex flex-wrap gap-2 shrink-0">
              @if (s.destino) {
                <button type="button" (click)="ir.emit(s.destino)" class="btn-primary h-10 whitespace-nowrap">{{ s.boton }}</button>
              }
              @if (s.boton2 && s.destino2) {
                <button type="button" (click)="ir.emit(s.destino2)" class="btn-secondary h-10 whitespace-nowrap">{{ s.boton2 }}</button>
              }
            </div>
          }
        }
      </section>
    }
  }
  `,
  styles: [`
    .aparecer { animation: aparecer 180ms cubic-bezier(0.23, 1, 0.32, 1); }
    @keyframes aparecer { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .aparecer { animation: none; } }
  `],
})
export class GuiaConfiguracionComponent {
  progreso = input<ProgresoConfiguracion | null>(null);
  puedeEditar = input(false);
  /** Admin/Gestor: ofrece dibujar las manzanas de todas las tarjetas a la vez. */
  puedeDibujarLote = input(false);
  ir = output<DestinoGuia>();

  cerrada = signal(leerCerrada());

  pasos = computed<Paso[]>(() => {
    const p = this.progreso();
    if (!p) return [];
    const sinLimite = p.tarjetas - p.tarjetas_con_limite;
    const sinManzanas = p.tarjetas_con_limite - p.tarjetas_con_manzanas;
    return [
      {
        n: 1, titulo: 'Mapa de la congregación', corto: 'Mapa', hecho: p.tiene_limite,
        detalle: 'Falta subir el archivo .kml',
        instruccion: 'Descárguelo del sitio de la organización y súbalo en Mapa general.',
        boton: 'Ir a Mapa general', destino: { a: 'mapa' },
      },
      {
        n: 2, titulo: 'Barrios', corto: 'Barrios', hecho: p.barrios > 0 && p.barrios_sin_dibujar === 0,
        detalle: p.barrios === 0 ? 'Todavía no hay barrios'
          : `${p.barrios_sin_dibujar} de ${p.barrios} ${p.barrios === 1 ? 'barrio' : 'barrios'} sin dibujar`,
        instruccion: p.barrios === 0
          ? 'Divida el territorio en barrios; cada tarjeta pertenecerá a uno.'
          : 'Dibuje en el mapa la zona de los que faltan.',
        boton: 'Ir a Barrios', destino: { a: 'barrios' },
      },
      {
        n: 3, titulo: 'Tarjetas y su límite', corto: 'Tarjetas', hecho: p.tarjetas > 0 && sinLimite === 0,
        detalle: p.tarjetas === 0 ? 'Todavía no hay tarjetas'
          : `${p.tarjetas_con_limite} de ${p.tarjetas} ${p.tarjetas === 1 ? 'tarjeta' : 'tarjetas'} con límite`,
        instruccion: p.tarjetas === 0
          ? 'Cree la primera y marque su límite en el mapa.'
          : 'Marque en el mapa el límite de las que faltan.',
        boton: p.tarjetas === 0 ? 'Nueva tarjeta' : 'Marcar la siguiente',
        destino: p.tarjetas === 0 || p.primera_sin_limite == null ? { a: 'nueva-tarjeta' } : { a: 'tarjeta', id: p.primera_sin_limite },
        boton2: p.tarjetas > 0 ? 'Nueva tarjeta' : undefined,
        destino2: p.tarjetas > 0 ? { a: 'nueva-tarjeta' } : undefined,
      },
      {
        n: 4, titulo: 'Manzanas', corto: 'Manzanas', hecho: p.tarjetas_con_limite > 0 && sinManzanas === 0,
        detalle: `${p.tarjetas_con_manzanas} de ${p.tarjetas_con_limite} ${p.tarjetas_con_limite === 1 ? 'tarjeta' : 'tarjetas'} con manzanas`,
        instruccion: this.puedeDibujarLote()
          ? 'Márquelas una por una o todas a la vez.'
          : 'Márquelas dentro de cada tarjeta.',
        boton: 'Marcar la siguiente',
        destino: p.primera_sin_manzanas != null ? { a: 'tarjeta', id: p.primera_sin_manzanas } : null,
        boton2: this.puedeDibujarLote() ? 'Dibujar las de todas' : undefined,
        destino2: this.puedeDibujarLote() ? { a: 'manzanas-lote' } : undefined,
      },
    ];
  });

  hechos = computed(() => this.pasos().filter(s => s.hecho).length);
  /** El primer paso sin terminar: el orden manda aunque uno posterior esté hecho. */
  actual = computed(() => this.pasos().find(s => !s.hecho)?.n ?? 5);
  pasoActual = computed(() => this.pasos().find(s => s.n === this.actual()) ?? null);
  completo = computed(() => this.pasos().length > 0 && this.hechos() === 4);

  cerrar(): void {
    this.cerrada.set(true);
    try { localStorage.setItem(CLAVE_CERRADA, '1'); } catch { /* sin almacenamiento: se vuelve a mostrar */ }
  }
}
