import { Component, DestroyRef, OnInit, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription, catchError, interval, of, startWith, switchMap } from 'rxjs';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { DibujoLote, DibujoLoteResumen, TerritoriosService } from '../services/territorios.service';

/**
 * Dibujado avanzado de manzanas de todas las tarjetas (solo Administrador y Gestor).
 *
 * 1. Resumen: cuántas tarjetas tienen límite.
 * 2. Calles (gratis): el servidor detecta las manzanas con el mapa de calles.
 * 3. Si quedan tarjetas sin manzanas, se ofrece aparte usar la IA, con su costo y el tope de hoy.
 */
@Component({
  standalone: true,
  selector: 'app-dibujo-lote-dialog',
  imports: [CommonModule, ModalComponent],
  template: `
  <app-modal [open]="true" size="lg" title="Dibujar las manzanas de todas las tarjetas" (openChange)="$event || cerrarDialogo()">
      <div class="space-y-4">
        @if (cargando()) {
          <p class="text-base text-slate-600 dark:text-slate-300">Cargando…</p>
        } @else if (resumen(); as r) {

          <!-- Paso 1: resumen -->
          @if (todoListo() && !enCurso()) {
            <div class="rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20 p-4 flex items-start gap-3" role="status">
              <span class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0" aria-hidden="true">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <div class="space-y-1">
                <p class="text-base font-bold text-emerald-900 dark:text-emerald-100">
                  {{ r.con_limite === 1 ? 'La tarjeta ya tiene manzanas' : 'Las ' + r.con_limite + ' tarjetas ya tienen manzanas' }}
                </p>
                <p class="text-sm text-emerald-900/80 dark:text-emerald-200/80">No hace falta dibujar nada más. Puede revisarlas o corregirlas en cada tarjeta.</p>
              </div>
            </div>
          } @else {
          <div class="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 space-y-1">
            <p class="text-base font-bold text-slate-900 dark:text-white">
              {{ r.con_limite }} {{ r.con_limite === 1 ? 'tarjeta tiene' : 'tarjetas tienen' }} el límite dibujado
            </p>
            @if (r.sin_limite) {
              <p class="text-sm text-slate-600 dark:text-slate-300">
                {{ r.sin_limite }} sin límite (se omiten): {{ codigos(r.sin_limite_codigos) }}
              </p>
            }
            <p class="text-sm text-slate-600 dark:text-slate-300">{{ r.con_manzanas }} ya {{ r.con_manzanas === 1 ? 'tiene' : 'tienen' }} manzanas: solo se agregan las cuadras que falten.</p>
          </div>
          }

          @if (lote(); as l) {
            @if (l.estado === 'en_curso') {
              <!-- Paso 2: progreso -->
              <div class="space-y-2" aria-live="polite">
                <p class="text-base font-bold text-slate-900 dark:text-white">
                  {{ l.fase === 'ia' ? 'La IA está marcando las manzanas…' : 'Buscando las manzanas con el mapa de calles…' }}
                </p>
                <div class="h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div class="h-full rounded-full bg-emerald-600 transition-[width] duration-500" [style.width.%]="porcentaje(l)"></div>
                </div>
                <p class="text-sm text-slate-600 dark:text-slate-300">Tarjeta {{ l.procesados }} de {{ l.total }}. Puede cerrar esta ventana: el trabajo sigue.</p>
              </div>
            } @else {
              <!-- Paso 3: resultado. Si no se lanzó en esta sesión, es el historial: se pliega para no parecer una acción nueva. -->
              <details class="space-y-2" [open]="lanzadoAqui() || l.estado === 'error'">
                <summary class="list-none cursor-pointer text-base font-bold flex items-center justify-between gap-2" [class]="l.estado === 'error' ? 'text-red-700 dark:text-red-300' : lanzadoAqui() ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-300'">
                  <span>
                    @if (l.estado === 'error') { No se pudo terminar. } @else if (lanzadoAqui()) {
                      Listo: {{ totalManzanas(l) }} {{ totalManzanas(l) === 1 ? 'manzana nueva' : 'manzanas nuevas' }}
                      {{ l.fase === 'ia' ? 'marcadas por la IA' : 'con el mapa de calles' }}.
                    } @else {
                      Último dibujado: {{ totalManzanas(l) }} {{ totalManzanas(l) === 1 ? 'manzana' : 'manzanas' }}
                      {{ l.fase === 'ia' ? 'con la IA' : 'con el mapa de calles' }}
                    }
                  </span>
                  @if (!lanzadoAqui() && l.estado !== 'error') { <span class="text-sm font-semibold text-slate-500 dark:text-slate-400 underline">Ver detalle</span> }
                </summary>
                @if (l.mensaje) { <p class="text-sm text-red-700 dark:text-red-300">{{ l.mensaje }}</p> }
                <ul class="mt-2 divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-200 dark:border-slate-700">
                  @for (f of l.resultado; track f.id_territorio) {
                    <li class="flex items-start gap-3 px-3 py-2">
                      <span class="min-w-12 text-sm font-bold text-slate-800 dark:text-slate-100 tabular-nums">{{ f.codigo || ('#' + f.id_territorio) }}</span>
                      @if (f.manzanas) {
                        <span class="text-sm text-slate-700 dark:text-slate-200">{{ f.manzanas }} {{ f.manzanas === 1 ? 'manzana' : 'manzanas' }}</span>
                      } @else {
                        <span class="text-sm text-amber-800 dark:text-amber-200">{{ f.aviso || 'Sin manzanas nuevas' }}</span>
                      }
                    </li>
                  }
                </ul>
                @if (l.fase === 'ia' && totalManzanas(l)) {
                  <p class="text-sm text-violet-800 dark:text-violet-200">Las manzanas de la IA se ven con borde punteado y la etiqueta «IA · revisar». Revíselas en cada tarjeta.</p>
                }
              </details>
            }
          }

          @if (error()) { <p class="text-sm font-semibold text-red-700 dark:text-red-300" role="alert">{{ error() }}</p> }

          @if (!enCurso()) {
            @if (confirmandoIA()) {
              <div class="rounded-xl border border-violet-300 dark:border-violet-700/60 bg-violet-50 dark:bg-violet-900/20 p-4 space-y-3">
                <p class="text-base font-bold text-violet-900 dark:text-violet-100">¿Usar la IA en {{ r.pendientes_ia.length }} {{ r.pendientes_ia.length === 1 ? 'tarjeta' : 'tarjetas' }}?</p>
                <ul class="text-sm text-violet-900 dark:text-violet-100 space-y-1 list-disc pl-5">
                  <li>Cada tarjeta es un uso de IA y tiene costo.</li>
                  <li>Hoy quedan {{ usosRestantes() }} de {{ r.max_ia_por_dia }} usos.</li>
                  <li>La IA mira la foto satelital: revise lo que marque.</li>
                </ul>
                <p class="text-sm text-violet-900 dark:text-violet-100">Tarjetas: {{ codigos(codigosPendientes()) }}</p>
                <div class="flex gap-2">
                  <button (click)="usarIA()" type="button" [disabled]="iniciando()" class="flex-1 btn-primary">Sí, usar la IA</button>
                  <button (click)="confirmandoIA.set(false)" type="button" class="flex-1 btn-secondary">No</button>
                </div>
              </div>
            } @else {
              @if (todoListo()) {
                <button (click)="cerrarDialogo()" type="button"
                        class="w-full btn-primary">
                  Listo
                </button>
                <button (click)="buscarConCalles()" type="button" [disabled]="iniciando()"
                        class="w-full btn-ghost">
                  Volver a buscar por si falta alguna cuadra
                </button>
              } @else if (r.con_limite) {
                <button (click)="buscarConCalles()" type="button" [disabled]="iniciando()"
                        class="w-full btn-primary">
                  {{ r.con_manzanas > 0 ? 'Buscar las que faltan con el mapa de calles (gratis)' : 'Buscar manzanas con el mapa de calles (gratis)' }}
                </button>
              }
              @if (r.pendientes_ia.length && yaSeBuscoConCalles()) {
                <div class="space-y-1">
                  <p class="text-sm text-slate-600 dark:text-slate-300">
                    {{ r.pendientes_ia.length }} {{ r.pendientes_ia.length === 1 ? 'tarjeta sigue' : 'tarjetas siguen' }} sin manzanas porque el mapa no tiene sus calles.
                  </p>
                  <button (click)="confirmandoIA.set(true)" type="button" [disabled]="usosRestantes() < r.pendientes_ia.length"
                          class="w-full btn-secondary btn-lg">
                    Usar IA en {{ r.pendientes_ia.length === 1 ? 'esta tarjeta' : 'estas ' + r.pendientes_ia.length + ' tarjetas' }}
                  </button>
                  @if (usosRestantes() < r.pendientes_ia.length) {
                    <p class="text-sm text-amber-800 dark:text-amber-200">Hoy solo quedan {{ usosRestantes() }} usos de IA. Dibuje algunas a mano o intente mañana.</p>
                  }
                </div>
              }
            }
          }
        }
      </div>
  </app-modal>
  `,
})
export class DibujoLoteDialogComponent implements OnInit {
  private territoriosService = inject(TerritoriosService);
  private destroyRef = inject(DestroyRef);

  /** Se cerró; `cambios` indica si se crearon manzanas (para recargar la lista). */
  readonly cerrar = output<boolean>();

  readonly cargando = signal(true);
  readonly iniciando = signal(false);
  readonly confirmandoIA = signal(false);
  readonly error = signal<string | null>(null);
  readonly resumen = signal<DibujoLoteResumen | null>(null);
  readonly lote = signal<DibujoLote | null>(null);
  private huboCambios = false;
  private sondeo: Subscription | null = null;

  /** Se lanzó un dibujado desde esta ventana (no es el historial de otra vez). */
  readonly lanzadoAqui = signal(false);
  /** Todas las tarjetas con límite ya tienen manzanas: no queda nada que dibujar. */
  readonly todoListo = computed(() => {
    const r = this.resumen();
    return !!r && r.con_limite > 0 && r.con_manzanas >= r.con_limite;
  });

  readonly enCurso = computed(() => this.lote()?.estado === 'en_curso');
  readonly usosRestantes = computed(() => {
    const r = this.resumen();
    return r ? Math.max(r.max_ia_por_dia - r.usos_ia_hoy, 0) : 0;
  });
  readonly codigosPendientes = computed(() => (this.resumen()?.pendientes_ia ?? []).map((p) => p.codigo));
  /** La IA se ofrece solo después de probar con las calles (el último lote fue de calles y terminó). */
  readonly yaSeBuscoConCalles = computed(() => {
    const l = this.lote();
    return !!l && l.estado !== 'en_curso';
  });

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.sondeo?.unsubscribe());
    this.cargarResumen();
  }

  private cargarResumen(): void {
    this.territoriosService.dibujoLoteResumen().subscribe({
      next: (r) => {
        this.cargando.set(false);
        this.resumen.set(r);
        this.lote.set(r.lote);
        if (r.lote?.estado === 'en_curso') this.seguir();
      },
      error: (err) => {
        this.cargando.set(false);
        this.error.set(err?.error?.detail ?? 'No se pudo cargar el resumen.');
      },
    });
  }

  buscarConCalles(): void {
    this.iniciar(this.territoriosService.iniciarDibujoCalles());
  }

  usarIA(): void {
    const n = this.resumen()?.pendientes_ia.length ?? 0;
    this.iniciar(this.territoriosService.iniciarDibujoIA(n));
  }

  private iniciar(peticion: ReturnType<TerritoriosService['iniciarDibujoCalles']>): void {
    this.error.set(null);
    this.iniciando.set(true);
    peticion.subscribe({
      next: (l) => {
        this.iniciando.set(false);
        this.confirmandoIA.set(false);
        this.lanzadoAqui.set(true);
        this.lote.set(l);
        this.seguir();
      },
      error: (err) => {
        this.iniciando.set(false);
        this.error.set(err?.error?.detail ?? 'No se pudo iniciar. Intente de nuevo.');
        this.cargarResumen();
      },
    });
  }

  /** Consulta el progreso cada 2 s hasta que el lote termine. */
  private seguir(): void {
    this.sondeo?.unsubscribe();
    this.sondeo = interval(2000).pipe(
      startWith(0),
      // Un fallo de red puntual no corta el seguimiento: el siguiente intento lo resuelve.
      switchMap(() => this.territoriosService.dibujoLoteEstado().pipe(catchError(() => of(undefined)))),
    ).subscribe({
      next: (l) => {
        if (l === undefined) return;
        this.lote.set(l);
        if (l && l.estado !== 'en_curso') {
          this.sondeo?.unsubscribe();
          this.sondeo = null;
          if (this.totalManzanas(l)) this.huboCambios = true;
          this.cargarResumen();
        }
      },
    });
  }

  porcentaje(l: DibujoLote): number {
    return l.total ? Math.round((l.procesados / l.total) * 100) : 0;
  }

  totalManzanas(l: DibujoLote): number {
    return l.resultado.reduce((s, f) => s + (f.manzanas || 0), 0);
  }

  codigos(lista: (string | null)[]): string {
    const visibles = lista.filter(Boolean).slice(0, 12).join(', ');
    return lista.length > 12 ? `${visibles} y ${lista.length - 12} más` : visibles;
  }

  cerrarDialogo(): void {
    this.cerrar.emit(this.huboCambios);
  }
}
