import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeoJSONFeatureCollection } from '../models/territorio.model';
import { TerritorioMapComponent } from './territorio-map.component';

interface ManzanaItem { id: number; numero: string }
interface PuntoItem { id: number; nombre: string; tipo: string; notas: string }

const CLAVE_PLEGADO = 'gac.editorTerritorio.panelPlegado';

/**
 * Panel del editor cartográfico: guía los pasos 1-2-3, lista lo dibujado y ofrece, con botones de
 * texto, dibujar / ajustar / renombrar / mover / borrar. Habla con el mapa (`mapa`) para lo visual
 * y emite al padre lo que hay que guardar en el servidor.
 */
@Component({
  standalone: true,
  selector: 'app-editor-panel',
  imports: [CommonModule],
  template: `
  @if (mapa(); as m) {
  <aside class="flex flex-col min-h-0 bg-white dark:bg-slate-800 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700 transition-[width,height] duration-200"
         [class]="plegado() ? 'lg:w-14 h-14 lg:h-auto' : 'lg:w-[380px] h-[48dvh] lg:h-auto'">

    <button (click)="alternarPlegado()" type="button"
            class="shrink-0 flex items-center gap-2 px-4 h-14 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
            [attr.aria-expanded]="!plegado()">
      <svg class="w-5 h-5 shrink-0 transition-transform" [class.rotate-180]="plegado()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
      @if (!plegado()) { <span>Ocultar panel</span> } @else { <span class="lg:sr-only">Mostrar panel</span> }
    </button>

    @if (!plegado()) {
    <div class="flex-1 min-h-0 overflow-y-auto border-t border-slate-100 dark:border-slate-700/60 divide-y divide-slate-100 dark:divide-slate-700/60">

      <!-- ═════ 1 · Límite ═════ -->
      <section>
        <button (click)="m.setLayerMode('territorio')" type="button" class="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors" [attr.aria-expanded]="m.layerMode() === 'territorio'">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0" [class]="m.layerMode() === 'territorio' ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'">1</span>
          <span class="flex-1 text-base font-extrabold text-slate-900 dark:text-white">Límite del territorio</span>
          @if (m.tieneLimite()) { <span class="text-emerald-600 dark:text-emerald-400 text-sm font-bold">✓ Listo</span> }
        </button>
        @if (m.layerMode() === 'territorio') {
        <div class="px-4 pb-4 space-y-3">
          @if (!m.tieneLimite()) {
            <ol class="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-decimal pl-5">
              <li>Pulse «Dibujar el límite».</li>
              <li>Haga clic en cada esquina del territorio.</li>
              <li>Doble clic en la última esquina para terminar.</li>
            </ol>
            @if (m.drawingActive()) {
              <button (click)="m.cancelarDibujoActual()" type="button" class="btn-sec w-full">Cancelar dibujo</button>
            } @else {
              <button (click)="m.empezarDibujo()" type="button" class="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-base font-bold transition-colors active:scale-[0.98]">Dibujar el límite</button>
            }
          } @else {
            @if (m.realtimeArea()) { <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ m.realtimeArea() }}</p> }
            @if (m.editMode()) {
              <p class="text-sm text-slate-600 dark:text-slate-300">Arrastre las esquinas del mapa para corregir el contorno.</p>
              <button (click)="m.map?.pm?.disableGlobalEditMode()" type="button" class="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold transition-colors active:scale-[0.98]">Listo, terminé de ajustar</button>
            } @else {
              <div class="grid grid-cols-2 gap-2">
                <button (click)="m.alternarEdicion()" type="button" class="btn-sec">Ajustar esquinas</button>
                <button (click)="confirmarRedibujo.set(true)" type="button" class="btn-sec">Dibujar de nuevo</button>
              </div>
            }
            @if (confirmarRedibujo()) {
              <div class="rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 p-3 space-y-2">
                <p class="text-sm font-semibold text-red-800 dark:text-red-200">¿Borrar el límite y dibujarlo otra vez?</p>
                <div class="flex gap-2">
                  <button (click)="redibujar(m)" type="button" class="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Sí, dibujar de nuevo</button>
                  <button (click)="confirmarRedibujo.set(false)" type="button" class="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">No</button>
                </div>
              </div>
            }
          }
          @if (geoSaveError()) {
            <p class="text-sm font-semibold text-red-600 dark:text-red-400 leading-snug" role="alert">{{ geoSaveError() }}</p>
          }
          <button (click)="guardarLimite.emit()" type="button" [disabled]="saving() || !limiteSinGuardar()"
                  class="w-full h-12 rounded-xl text-base font-bold transition-colors active:scale-[0.98] text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:disabled:bg-slate-700/60 dark:disabled:text-slate-500">
            {{ saving() ? 'Guardando…' : limiteSinGuardar() ? 'Guardar límite' : 'Límite guardado' }}
          </button>
        </div>
        }
      </section>

      <!-- ═════ 2 · Manzanas ═════ -->
      <section>
        <button (click)="m.setLayerMode('manzana')" type="button" class="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors" [attr.aria-expanded]="m.layerMode() === 'manzana'">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0" [class]="m.layerMode() === 'manzana' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'">2</span>
          <span class="flex-1 text-base font-extrabold text-slate-900 dark:text-white">Manzanas</span>
          <span class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ manzanas().length }}</span>
        </button>
        @if (m.layerMode() === 'manzana') {
        <div class="px-4 pb-4 space-y-3">
          @if (m.drawingActive()) {
            <p class="text-sm text-slate-600 dark:text-slate-300">Haga clic en cada esquina de la manzana. Doble clic para terminar.</p>
            <button (click)="m.cancelarDibujoActual()" type="button" class="btn-sec w-full">Cancelar dibujo</button>
          } @else {
            <button (click)="m.empezarManzana()" type="button" class="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-base font-bold transition-colors active:scale-[0.98]">Dibujar una manzana</button>
            <button (click)="m.detectarManzanas()" type="button" [disabled]="detectando() || m.extrayendo()" class="btn-sec w-full disabled:opacity-60">
              {{ detectando() || m.extrayendo() ? 'Buscando manzanas…' : 'Detectar manzanas automáticamente' }}
            </button>
          }

          @if (manzanas().length === 0) {
            <p class="text-sm text-slate-500 dark:text-slate-400">Todavía no hay manzanas. Dibuje la primera o use la detección automática.</p>
          } @else {
            <p class="text-sm text-slate-500 dark:text-slate-400">Toque una manzana, aquí o en el mapa, para corregirla o borrarla.</p>
            <ul class="space-y-1.5">
              @for (z of manzanas(); track z.id) {
                <li>
                  @if (esManzanaElegida(m, z.id)) {
                    <div class="rounded-xl border-2 border-blue-500 bg-blue-50/60 dark:bg-blue-900/20 p-3 space-y-3">
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-base font-extrabold text-slate-900 dark:text-white">Manzana {{ z.numero }}</p>
                        <button (click)="m.quitarSeleccion()" type="button" class="text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white px-2 h-9">Cerrar</button>
                      </div>
                      <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Número de la manzana
                        <div class="mt-1 flex gap-2">
                          <input type="text" [value]="numeroBorrador()" (input)="numeroBorrador.set($any($event.target).value)" (keydown.enter)="guardarNumero(z.id)"
                                 class="flex-1 min-w-0 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <button (click)="guardarNumero(z.id)" type="button" [disabled]="!numeroBorrador().trim() || numeroBorrador().trim() === z.numero"
                                  class="px-4 h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 text-white text-sm font-bold">Guardar</button>
                        </div>
                      </label>
                      @if (m.borrando()) {
                        <div class="rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 p-3 space-y-2">
                          <p class="text-sm font-semibold text-red-800 dark:text-red-200">¿Borrar la manzana {{ z.numero }}? No se puede deshacer.</p>
                          <div class="flex gap-2">
                            <button (click)="borrarManzana.emit(z.id); m.borrando.set(false)" type="button" class="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Sí, borrar</button>
                            <button (click)="m.borrando.set(false)" type="button" class="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">No</button>
                          </div>
                        </div>
                      } @else if (m.editandoForma()) {
                        <p class="text-sm text-slate-600 dark:text-slate-300">Arrastre las esquinas en el mapa y pulse «Listo, guardar».</p>
                      } @else {
                        <div class="grid grid-cols-2 gap-2">
                          <button (click)="m.ajustarForma()" type="button" class="btn-sec">Ajustar forma</button>
                          <button (click)="m.borrando.set(true)" type="button" class="btn-sec !text-red-700 dark:!text-red-300 !border-red-200 dark:!border-red-800/60">Borrar</button>
                        </div>
                      }
                    </div>
                  } @else {
                    <button (click)="m.seleccionar('manzana', z.id, true)" type="button" class="w-full flex items-center gap-3 px-3 h-12 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors">
                      <span class="min-w-8 h-8 px-1.5 rounded-lg bg-slate-600 text-white text-sm font-black flex items-center justify-center">{{ z.numero }}</span>
                      <span class="flex-1 text-base font-semibold text-slate-800 dark:text-slate-100">Manzana {{ z.numero }}</span>
                    </button>
                  }
                </li>
              }
            </ul>
          }
        </div>
        }
      </section>

      <!-- ═════ 3 · Puntos ═════ -->
      <section>
        <button (click)="m.setLayerMode('punto')" type="button" class="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors" [attr.aria-expanded]="m.layerMode() === 'punto'">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0" [class]="m.layerMode() === 'punto' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'">3</span>
          <span class="flex-1 text-base font-extrabold text-slate-900 dark:text-white">Puntos de salida y lugares</span>
          <span class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ puntos().length }}</span>
        </button>
        @if (m.layerMode() === 'punto') {
        <div class="px-4 pb-4 space-y-3">
          @if (m.colocandoPunto()) {
            <p class="text-sm text-slate-600 dark:text-slate-300">Haga clic en el mapa donde va el punto.</p>
            <button (click)="m.detenerPunto()" type="button" class="btn-sec w-full">Terminar de poner puntos</button>
          } @else {
            <button (click)="m.empezarPunto()" type="button" class="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-base font-bold transition-colors active:scale-[0.98]">Poner un punto en el mapa</button>
          }

          @if (puntos().length === 0) {
            <p class="text-sm text-slate-500 dark:text-slate-400">Todavía no hay puntos. Marque, por ejemplo, el lugar donde se reúnen para salir.</p>
          } @else {
            <ul class="space-y-1.5">
              @for (p of puntos(); track p.id) {
                <li>
                  @if (esPuntoElegido(m, p.id)) {
                    <div class="rounded-xl border-2 border-rose-500 bg-rose-50/60 dark:bg-rose-900/20 p-3 space-y-3">
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-base font-extrabold text-slate-900 dark:text-white truncate">{{ p.nombre || 'Punto sin nombre' }}</p>
                        <button (click)="m.quitarSeleccion()" type="button" class="text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white px-2 h-9">Cerrar</button>
                      </div>
                      <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Nombre
                        <input type="text" [value]="pNombre()" (input)="pNombre.set($any($event.target).value)"
                               class="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
                      </label>
                      <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Tipo
                        <select [value]="pTipo()" (change)="pTipo.set($any($event.target).value)"
                                class="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500">
                          <option value="Salida" [selected]="pTipo() === 'Salida'">Salida</option>
                          <option value="Lugar" [selected]="pTipo() === 'Lugar'">Lugar de interés</option>
                          <option value="Otro" [selected]="pTipo() === 'Otro'">Otro</option>
                        </select>
                      </label>
                      <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Notas (opcional)
                        <input type="text" [value]="pNotas()" (input)="pNotas.set($any($event.target).value)"
                               class="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
                      </label>
                      <button (click)="guardarPunto(p.id)" type="button" [disabled]="!pNombre().trim() || !puntoCambiado(p)"
                              class="w-full h-11 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 text-white text-sm font-bold">Guardar cambios</button>
                      @if (m.borrando()) {
                        <div class="rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 p-3 space-y-2">
                          <p class="text-sm font-semibold text-red-800 dark:text-red-200">¿Borrar este punto? No se puede deshacer.</p>
                          <div class="flex gap-2">
                            <button (click)="borrarPunto.emit(p.id); m.borrando.set(false)" type="button" class="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Sí, borrar</button>
                            <button (click)="m.borrando.set(false)" type="button" class="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">No</button>
                          </div>
                        </div>
                      } @else if (m.editandoForma()) {
                        <p class="text-sm text-slate-600 dark:text-slate-300">Arrastre el punto en el mapa y pulse «Listo, guardar».</p>
                      } @else {
                        <div class="grid grid-cols-2 gap-2">
                          <button (click)="m.moverPunto()" type="button" class="btn-sec">Mover en el mapa</button>
                          <button (click)="m.borrando.set(true)" type="button" class="btn-sec !text-red-700 dark:!text-red-300 !border-red-200 dark:!border-red-800/60">Borrar</button>
                        </div>
                      }
                    </div>
                  } @else {
                    <button (click)="m.seleccionar('punto', p.id, true)" type="button" class="w-full flex items-center gap-3 px-3 h-12 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors">
                      <span class="w-8 h-8 rounded-lg bg-rose-600 text-white text-sm font-black flex items-center justify-center shrink-0">{{ p.tipo === 'Salida' ? 'S' : p.tipo === 'Lugar' ? 'L' : 'P' }}</span>
                      <span class="flex-1 min-w-0 truncate text-base font-semibold text-slate-800 dark:text-slate-100">{{ p.nombre || 'Punto sin nombre' }}</span>
                    </button>
                  }
                </li>
              }
            </ul>
          }
        </div>
        }
      </section>
    </div>
    }
  </aside>
  }
  `,
  styles: [`
    :host { display: contents; }
    .btn-sec {
      display: flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 12px;
      border-radius: 12px; border: 1px solid rgb(203 213 225); background: transparent;
      font-size: 14px; font-weight: 700; color: rgb(51 65 85); transition: background-color 120ms ease-out, transform 120ms;
    }
    .btn-sec:hover { background: rgb(248 250 252); }
    .btn-sec:active { transform: scale(0.98); }
    :host-context(.dark) .btn-sec { border-color: rgb(71 85 105); color: rgb(226 232 240); }
    :host-context(.dark) .btn-sec:hover { background: rgba(51,65,85,0.6); }
    @media (prefers-reduced-motion: reduce) { aside, .btn-sec { transition: none !important; } }
  `],
})
export class EditorPanelComponent {
  /** El mapa del editor: el panel lee sus señales (modo, selección, dibujo) y le pide las acciones visuales. */
  readonly mapa = input<TerritorioMapComponent | undefined>();
  readonly manzanasGeojson = input<GeoJSONFeatureCollection | null>(null);
  readonly puntosGeojson = input<GeoJSONFeatureCollection | null>(null);
  readonly limiteSinGuardar = input(false);
  readonly saving = input(false);
  readonly geoSaveError = input<string | null>(null);
  readonly detectando = input(false);

  readonly guardarLimite = output<void>();
  readonly renombrarManzana = output<{ id: number; numero: string }>();
  readonly borrarManzana = output<number>();
  readonly actualizarPunto = output<{ id: number; nombre: string; tipo: string; notas: string }>();
  readonly borrarPunto = output<number>();

  readonly plegado = signal(leerPlegado());
  readonly confirmarRedibujo = signal(false);
  readonly numeroBorrador = signal('');
  readonly pNombre = signal('');
  readonly pTipo = signal('Salida');
  readonly pNotas = signal('');

  readonly manzanas = computed<ManzanaItem[]>(() =>
    (this.manzanasGeojson()?.features ?? [])
      .filter((f: any) => f.id != null)
      .map((f: any) => ({ id: Number(f.id), numero: String(f.properties?.numero_manzana ?? '') }))
      .sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true })),
  );

  readonly puntos = computed<PuntoItem[]>(() =>
    (this.puntosGeojson()?.features ?? [])
      .filter((f: any) => f.id != null)
      .map((f: any) => ({
        id: Number(f.id),
        nombre: String(f.properties?.nombre ?? ''),
        tipo: String(f.properties?.tipo ?? 'Otro'),
        notas: String(f.properties?.notas ?? ''),
      })),
  );

  constructor() {
    // Al elegir otra figura (o al recargar la lista) los campos parten de lo guardado.
    effect(() => {
      const sel = this.mapa()?.seleccion();
      const zs = this.manzanas();
      const ps = this.puntos();
      untracked(() => {
        this.confirmarRedibujo.set(false);
        if (sel?.tipo === 'manzana') this.numeroBorrador.set(zs.find((z) => z.id === sel.id)?.numero ?? '');
        if (sel?.tipo === 'punto') {
          const p = ps.find((x) => x.id === sel.id);
          this.pNombre.set(p?.nombre ?? '');
          this.pTipo.set(p?.tipo || 'Salida');
          this.pNotas.set(p?.notas ?? '');
        }
      });
    });
  }

  esManzanaElegida(m: TerritorioMapComponent, id: number): boolean {
    const s = m.seleccion();
    return s?.tipo === 'manzana' && s.id === id;
  }

  esPuntoElegido(m: TerritorioMapComponent, id: number): boolean {
    const s = m.seleccion();
    return s?.tipo === 'punto' && s.id === id;
  }

  puntoCambiado(p: PuntoItem): boolean {
    return this.pNombre().trim() !== p.nombre || this.pTipo() !== p.tipo || this.pNotas().trim() !== p.notas;
  }

  guardarNumero(id: number): void {
    const numero = this.numeroBorrador().trim();
    if (numero) this.renombrarManzana.emit({ id, numero });
  }

  guardarPunto(id: number): void {
    const nombre = this.pNombre().trim();
    if (nombre) this.actualizarPunto.emit({ id, nombre, tipo: this.pTipo(), notas: this.pNotas().trim() });
  }

  redibujar(m: TerritorioMapComponent): void {
    this.confirmarRedibujo.set(false);
    m.dibujarLimiteDeNuevo();
  }

  alternarPlegado(): void {
    this.plegado.update((v) => !v);
    try { localStorage.setItem(CLAVE_PLEGADO, this.plegado() ? '1' : '0'); } catch { /* sin almacenamiento */ }
  }
}

function leerPlegado(): boolean {
  try { return localStorage.getItem(CLAVE_PLEGADO) === '1'; } catch { return false; }
}

