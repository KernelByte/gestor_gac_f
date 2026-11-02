import { Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { RenumeracionManzana, TerritoriosService } from '../services/territorios.service';

interface Tramo { id: number; codigo: string; manzanas: number; desde: number; hasta: number; cambian: number }

/**
 * Renumera las manzanas de toda la congregación en una sola secuencia: T01 del 1 al N, T02 sigue, etc.
 * Muestra primero cómo quedaría cada tarjeta y solo guarda cuando se confirma.
 */
@Component({
  standalone: true,
  selector: 'app-renumerar-manzanas-dialog',
  template: `
  <div class="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="renum-titulo">
    <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="cerrar.emit(false)"></div>
    <div class="relative z-10 w-full max-w-lg max-h-[90dvh] rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
      <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
        <h3 id="renum-titulo" class="text-lg font-black text-slate-900 dark:text-white">Numerar las manzanas en secuencia</h3>
        <p class="text-sm text-slate-600 dark:text-slate-300 mt-1">Cada tarjeta sigue donde terminó la anterior. Dentro de cada una se numera de arriba a la izquierda, fila por fila.</p>
      </div>

      <div class="p-5 space-y-4 overflow-y-auto">
        @if (cargando()) {
          <p class="text-base text-slate-600 dark:text-slate-300">Calculando…</p>
        } @else if (error()) {
          <p class="text-sm font-semibold text-red-700 dark:text-red-300" role="alert">{{ error() }}</p>
        } @else if (cambian() === 0) {
          <p class="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-4 text-base font-bold text-emerald-900 dark:text-emerald-100">
            La numeración ya está en secuencia. No hay nada que cambiar.
          </p>
        } @else {
          <p class="text-base font-bold text-slate-900 dark:text-white">Cambian {{ cambian() }} de {{ total() }} manzanas.</p>
          <ul class="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700">
            @for (t of tramos(); track t.id) {
              <li class="flex items-center gap-3 px-3 py-2 text-sm">
                <span class="min-w-14 font-black text-slate-800 dark:text-slate-100">{{ t.codigo }}</span>
                <span class="flex-1 text-slate-700 dark:text-slate-200 tabular-nums">
                  {{ t.desde === t.hasta ? 'Manzana ' + t.desde : 'Del ' + t.desde + ' al ' + t.hasta }}
                  <span class="text-slate-500 dark:text-slate-400">· {{ t.manzanas }} {{ t.manzanas === 1 ? 'manzana' : 'manzanas' }}</span>
                </span>
                @if (t.cambian) { <span class="text-xs font-bold text-amber-700 dark:text-amber-300">{{ t.cambian }} {{ t.cambian === 1 ? 'cambia' : 'cambian' }}</span> }
                @else { <span class="text-xs text-slate-400">igual</span> }
              </li>
            }
          </ul>
          <p class="text-sm text-slate-600 dark:text-slate-300">Si ya imprimió tarjetas con los números anteriores, tendrá que imprimirlas de nuevo.</p>
        }
      </div>

      <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        @if (!cargando() && !error() && cambian() > 0) {
          <button type="button" (click)="cerrar.emit(false)" class="btn-secondary focus-ring-green justify-center">No cambiar nada</button>
          <button type="button" (click)="aplicar()" [disabled]="guardando()" class="btn-primary-green focus-ring-green justify-center disabled:opacity-60">
            {{ guardando() ? 'Guardando…' : 'Sí, cambiar los números' }}
          </button>
        } @else {
          <button type="button" (click)="cerrar.emit(false)" class="btn-primary-green focus-ring-green justify-center">Cerrar</button>
        }
      </div>
    </div>
  </div>
  `,
})
export class RenumerarManzanasDialogComponent implements OnInit {
  private service = inject(TerritoriosService);

  /** `true` si se cambiaron números (para recargar la pantalla). */
  readonly cerrar = output<boolean>();

  readonly cargando = signal(true);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);
  private filas = signal<RenumeracionManzana[]>([]);

  readonly total = computed(() => this.filas().length);
  readonly cambian = computed(() => this.filas().filter((f) => f.numero_anterior !== f.numero_manzana).length);
  readonly tramos = computed<Tramo[]>(() => {
    const por = new Map<number, Tramo>();
    for (const f of this.filas()) {
      const n = Number(f.numero_manzana);
      const t = por.get(f.id_territorio) ?? { id: f.id_territorio, codigo: f.codigo ?? '#' + f.id_territorio, manzanas: 0, desde: n, hasta: n, cambian: 0 };
      t.manzanas++;
      t.desde = Math.min(t.desde, n);
      t.hasta = Math.max(t.hasta, n);
      if (f.numero_anterior !== f.numero_manzana) t.cambian++;
      por.set(f.id_territorio, t);
    }
    return [...por.values()];
  });

  ngOnInit(): void {
    this.service.renumerarSecuencia(false).subscribe({
      next: (filas) => { this.filas.set(filas); this.cargando.set(false); },
      error: (err) => { this.error.set(err?.error?.detail ?? 'No se pudo calcular la numeración. Intente de nuevo.'); this.cargando.set(false); },
    });
  }

  aplicar(): void {
    this.guardando.set(true);
    this.service.renumerarSecuencia(true).subscribe({
      next: () => this.cerrar.emit(true),
      error: (err) => { this.guardando.set(false); this.error.set(err?.error?.detail ?? 'No se pudieron cambiar los números. Intente de nuevo.'); },
    });
  }
}
