import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TerritoriosService } from '../services/territorios.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { TerritorioMapComponent } from '../components/territorio-map.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import {
  COLORES_SECTOR,
  GeoJSONFeatureCollection,
  Sector,
  TarjetaSugerida,
  Territorio,
  UnidadCongregacion,
} from '../models/territorio.model';

const FC_VACIA: GeoJSONFeatureCollection = { type: 'FeatureCollection', features: [] };

/** Tarjeta de la lista "Elegir tarjetas": con el sector que ya tiene, para no mover una por error. */
interface TarjetaElegible {
  id_territorio: number;
  codigo: string;
  nombre: string;
  sectorActual: string | null;
  marcada: boolean;
}

@Component({
  standalone: true,
  selector: 'app-sectores-page',
  imports: [CommonModule, FormsModule, TerritorioMapComponent, PageHeaderComponent],
  template: `
    <div class="flex flex-col h-full gap-5 overflow-y-auto simple-scrollbar pb-6">
      <app-page-header spacing="none" title="Barrios o sectores"
        subtitle="Marque en el mapa, con un color, cada barrio o sector. Luego creará dentro de ellos las tarjetas de territorio.">
        <button (click)="volver()" class="btn-secondary focus-ring-green whitespace-nowrap">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Volver a Territorios
        </button>
      </app-page-header>

      @if (aviso()) {
        <div role="alert" class="flex items-start justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <p class="text-sm font-medium text-amber-900 dark:text-amber-200">{{ aviso() }}</p>
          <button (click)="aviso.set(null)" class="text-sm font-bold text-amber-800 dark:text-amber-300 shrink-0">Entendido</button>
        </div>
      }

      <!-- ═══ Paso 1: barrios ═══ -->
      <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4" aria-labelledby="paso2">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="flex items-start gap-3 min-w-0">
            <span class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-black shrink-0" aria-hidden="true">1</span>
            <div class="min-w-0">
              <h2 id="paso2" class="text-lg font-black text-slate-900 dark:text-white">Barrios o sectores</h2>
              <p class="text-sm text-slate-600 dark:text-slate-400">
                Cada barrio se dibuja en el mapa con su color. El límite de la congregación se ve de fondo; si aún no aparece, súbalo desde «Mapa general».
              </p>
            </div>
          </div>
          @if (puedeEditar()) {
            <button (click)="nuevoSector()" class="btn-primary-green focus-ring-green whitespace-nowrap">Nuevo barrio</button>
          }
        </div>

        @if (sectores().length === 0) {
          <p class="text-sm text-slate-500 dark:text-slate-400 rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4">
            Todavía no hay barrios. Cree el primero con «Nuevo barrio»: le pone un nombre, elige un color y lo dibuja en el mapa.
          </p>
        } @else {
          <ul class="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            @for (s of sectores(); track s.id_sector) {
              <li class="flex flex-wrap items-center gap-3 px-4 py-3">
                <span class="w-4 h-4 rounded-full shrink-0" [style.background-color]="s.color || '#94a3b8'" aria-hidden="true"></span>
                <div class="min-w-0 flex-1">
                  <p class="text-base font-bold text-slate-900 dark:text-white truncate">{{ s.nombre }}</p>
                  <p class="text-sm text-slate-500 dark:text-slate-400">
                    {{ s.tarjetas_count }} {{ s.tarjetas_count === 1 ? 'tarjeta' : 'tarjetas' }} ·
                    {{ s.coordenada ? 'Dibujado en el mapa' : 'Sin dibujar' }}
                  </p>
                </div>
                <button (click)="verTarjetas(s)"
                   class="text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:underline">Ver tarjetas</button>
                @if (puedeEditar()) {
                  <button (click)="elegirTarjetas(s)" class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">Elegir tarjetas</button>
                  <button (click)="editarSector(s)" class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">Editar</button>
                  <button (click)="pedirBorrar(s)" class="h-9 px-3 rounded-lg border border-red-200 dark:border-red-900/50 text-sm font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">Borrar</button>
                }
              </li>
            }
          </ul>
        }
      </section>

      <!-- ═══ Paso 2: tarjetas sin barrio ═══ -->
      @if (sectores().length > 0) {
        <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-wrap items-center gap-4" aria-labelledby="paso3">
          <span class="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center text-sm font-black shrink-0" aria-hidden="true">2</span>
          <div class="min-w-0 flex-1">
            <h2 id="paso3" class="text-lg font-black text-slate-900 dark:text-white">Tarjetas sin barrio</h2>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              @if (sinSector() === 0) { Todas las tarjetas ya tienen barrio. }
              @else { Hay {{ sinSector() }} {{ sinSector() === 1 ? 'tarjeta' : 'tarjetas' }} sin barrio. Use «Elegir tarjetas» en un barrio, o cámbielas una por una al editar la tarjeta. }
            </p>
          </div>
          @if (sinSector() > 0) {
            <button (click)="verSinSector()" class="btn-secondary focus-ring-green whitespace-nowrap">Ver las tarjetas sin barrio</button>
          }
        </section>
      }
    </div>

    <!-- ═══ Editor de barrio: panel con pasos + mapa ═══ -->
    @if (editor(); as e) {
      <div class="fixed inset-0 z-[100] flex flex-col lg:flex-row bg-white dark:bg-slate-950" role="dialog" aria-modal="true" aria-labelledby="tituloBarrio">

        <!-- Mapa: se dibuja directamente aquí -->
        <div class="relative order-first lg:order-last flex-1 min-h-[38dvh] bg-slate-100 dark:bg-slate-900">
          <div class="absolute inset-0">
            <app-territorio-map #mapaBarrio
              [geojson]="e.inicial" [referenciasGeojson]="e.referencias" [centroInicial]="centro()"
              [colorForma]="e.color" height="100%" [enableDrawing]="true" [soloLimite]="true" [interactive]="true"
              (geometryChanged)="alDibujar($event)" />
          </div>
        </div>

        <!-- Panel de pasos -->
        <aside class="lg:w-[24rem] shrink-0 flex flex-col min-h-0 max-h-[62dvh] lg:max-h-none border-t lg:border-t-0 lg:border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <header class="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
            <div class="min-w-0">
              <p class="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">Barrios o sectores</p>
              <h2 id="tituloBarrio" class="text-xl font-black text-slate-900 dark:text-white mt-0.5">{{ e.id_sector ? 'Editar barrio' : 'Nuevo barrio' }}</h2>
            </div>
            <button type="button" (click)="cerrarEditor()" aria-label="Cerrar sin guardar" title="Cerrar sin guardar"
              class="-mr-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus-ring-green transition-colors active:scale-95">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </header>

          <ol class="flex-1 overflow-y-auto simple-scrollbar px-6 pb-4 space-y-6">
            <!-- 1 · Nombre -->
            <li class="flex gap-3">
              <span class="mt-0.5 w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm font-black transition-colors"
                [ngClass]="e.nombre.trim() ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'" aria-hidden="true">
                @if (e.nombre.trim()) {
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                } @else { 1 }
              </span>
              <div class="min-w-0 flex-1">
                <label for="nombreBarrio" class="block text-base font-bold text-slate-900 dark:text-white">Póngale un nombre</label>
                <input id="nombreBarrio" type="text" [(ngModel)]="e.nombre" (ngModelChange)="errorForm.set(null)" maxlength="120" autocomplete="off"
                  placeholder="Ejemplo: La Aldea"
                  [attr.aria-invalid]="errorForm() ? 'true' : null" [attr.aria-describedby]="errorForm() ? 'errorBarrio' : null"
                  class="mt-2 w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border rounded-xl text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-[border-color,box-shadow]"
                  [ngClass]="errorForm() ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 dark:border-slate-700 focus:border-emerald-500 focus:ring-emerald-500/10'">
                @if (errorForm()) { <p id="errorBarrio" role="alert" class="mt-1.5 text-sm font-semibold text-red-600 dark:text-red-400">{{ errorForm() }}</p> }
              </div>
            </li>

            <!-- 2 · Color -->
            <li class="flex gap-3">
              <span class="mt-0.5 w-7 h-7 rounded-full shrink-0 flex items-center justify-center bg-emerald-600 text-white" aria-hidden="true">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </span>
              <div class="min-w-0 flex-1">
                <p id="etiquetaColor" class="text-base font-bold text-slate-900 dark:text-white">Elija su color</p>
                <p class="text-sm text-slate-500 dark:text-slate-400">Así se verá este barrio en el mapa.</p>
                <div class="mt-3 flex flex-wrap gap-2.5" role="radiogroup" aria-labelledby="etiquetaColor">
                  @for (c of colores; track c) {
                    <button type="button" role="radio" [attr.aria-checked]="e.color === c" (click)="e.color = c"
                      [attr.aria-label]="nombreColor(c)" [title]="colorEnUso(c, e.id_sector) ? 'Ya lo usa ' + colorEnUso(c, e.id_sector) : nombreColor(c)"
                      class="relative w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90 focus-ring-green"
                      [ngClass]="e.color === c ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : ''"
                      [style.background-color]="c" [style.--tw-ring-color]="c">
                      @if (e.color === c) {
                        <svg class="w-5 h-5 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      } @else if (colorEnUso(c, e.id_sector)) {
                        <span class="w-1.5 h-1.5 rounded-full bg-white/80" aria-hidden="true"></span>
                      }
                    </button>
                  }
                </div>
              </div>
            </li>

            <!-- 3 · Zona en el mapa -->
            <li class="flex gap-3">
              <span class="mt-0.5 w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm font-black transition-colors"
                [ngClass]="hayDibujo() ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'" aria-hidden="true">
                @if (hayDibujo()) {
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                } @else { 3 }
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-base font-bold text-slate-900 dark:text-white">Marque la zona en el mapa</p>

                @if (mapaBarrio.drawingActive()) {
                  <div class="mt-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-900/10 p-4" aria-live="polite">
                    <p class="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Toque el mapa en cada esquina del barrio.</p>
                    <p class="text-sm text-emerald-800/80 dark:text-emerald-300/80 mt-1">Para terminar, toque dos veces la última esquina.</p>
                    @if (mapaBarrio.realtimeArea()) { <p class="text-sm font-bold text-emerald-900 dark:text-emerald-200 mt-2 tabular-nums">{{ mapaBarrio.realtimeArea() }}</p> }
                    <button type="button" (click)="mapaBarrio.cancelarDibujo()" class="mt-3 h-10 px-4 rounded-lg text-sm font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/30 focus-ring-green">Cancelar</button>
                  </div>
                } @else if (hayDibujo()) {
                  <div class="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <p class="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <span class="w-3 h-3 rounded-full shrink-0" [style.background-color]="e.color"></span>
                      Zona marcada@if (mapaBarrio.realtimeArea()) { <span class="font-normal text-slate-500 dark:text-slate-400 tabular-nums">· {{ mapaBarrio.realtimeArea() }}</span> }
                    </p>
                    @if (mapaBarrio.editMode()) {
                      <p class="text-sm text-slate-600 dark:text-slate-400 mt-2">Arrastre los puntos blancos del borde para acomodar la zona.</p>
                    }
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" (click)="mapaBarrio.alternarEdicion()" [attr.aria-pressed]="mapaBarrio.editMode()"
                        class="h-10 px-4 rounded-lg border text-sm font-bold transition-colors focus-ring-green"
                        [ngClass]="mapaBarrio.editMode() ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'">
                        {{ mapaBarrio.editMode() ? 'Listo' : 'Acomodar los bordes' }}
                      </button>
                      <button type="button" (click)="dibujarDeNuevo(mapaBarrio)"
                        class="h-10 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 focus-ring-green">Dibujar de nuevo</button>
                    </div>
                  </div>
                } @else {
                  <p class="text-sm text-slate-500 dark:text-slate-400">Dibuje el contorno del barrio sobre el mapa.</p>
                  <button type="button" (click)="mapaBarrio.empezarDibujo()" class="mt-3 btn-secondary focus-ring-green">
                    <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 22 8.5 18 21 6 21 2 8.5 12 2"></polygon></svg>
                    Empezar a dibujar
                  </button>
                }
              </div>
            </li>
          </ol>

          <footer class="shrink-0 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            @if (!hayDibujo() && !mapaBarrio.drawingActive()) {
              <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">Sin la zona marcada, el barrio no se verá en el mapa.</p>
            }
            <div class="flex items-center justify-end gap-3">
              <button type="button" (click)="cerrarEditor()" class="h-11 px-5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-ring-green">Cancelar</button>
              <button type="button" (click)="guardarSector()" [disabled]="!e.nombre.trim() || guardando()" class="btn-primary-green focus-ring-green h-11">
                {{ guardando() ? 'Guardando…' : 'Guardar barrio' }}
              </button>
            </div>
          </footer>
        </aside>
      </div>
    }

    <!-- ═══ Ventana: tarjetas que encontró dentro del barrio / elegir a mano ═══ -->
    @if (eleccion(); as e) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="tituloEleccion">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="cerrarEleccion()"></div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg max-h-[85vh] flex flex-col relative z-10 shadow-2xl overflow-hidden">
          <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
            <h3 id="tituloEleccion" class="text-lg font-black text-slate-900 dark:text-white">{{ e.titulo }}</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">{{ e.ayuda }}</p>
          </div>
          <div class="flex-1 overflow-y-auto p-2">
            @if (e.tarjetas.length === 0) {
              <p class="p-4 text-sm text-slate-500">No hay tarjetas para mostrar.</p>
            }
            @for (t of e.tarjetas; track t.id_territorio) {
              <label class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/40 cursor-pointer">
                <input type="checkbox" [(ngModel)]="t.marcada" class="w-5 h-5 accent-emerald-600">
                <span class="font-display font-bold text-slate-900 dark:text-white tabular-nums">{{ t.codigo }}</span>
                <span class="text-sm text-slate-600 dark:text-slate-300 truncate flex-1">{{ t.nombre }}</span>
                @if (t.sectorActual) { <span class="text-xs text-slate-500 shrink-0">Hoy: {{ t.sectorActual }}</span> }
              </label>
            }
          </div>
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end gap-3">
            <button (click)="cerrarEleccion()" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">{{ e.soloLectura ? 'Cerrar' : 'Ahora no' }}</button>
            <button (click)="asignarElegidas()" [disabled]="guardando()" class="btn-primary-green focus-ring-green">Asignar al barrio</button>
          </div>
        </div>
      </div>
    }

    <!-- ═══ Confirmar borrar ═══ -->
    @if (porBorrar(); as s) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="porBorrar.set(null)"></div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm relative z-10 shadow-2xl p-5 space-y-4">
          <h3 class="text-lg font-black text-slate-900 dark:text-white">¿Borrar «{{ s.nombre }}»?</h3>
          <p class="text-sm text-slate-600 dark:text-slate-400">Las {{ s.tarjetas_count }} tarjetas de este barrio no se borran: solo quedan sin barrio.</p>
          <div class="flex justify-end gap-3">
            <button (click)="porBorrar.set(null)" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">Cancelar</button>
            <button (click)="confirmarBorrar()" class="px-5 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl">Sí, borrar</button>
          </div>
        </div>
      </div>
    }

  `,
  styles: [`
    :host { display: block; height: 100%; }
    .simple-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
    .simple-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  `],
})
export class SectoresPage implements OnInit {
  private svc = inject(TerritoriosService);
  private router = inject(Router);
  private authStore = inject(AuthStore);

  puedeEditar = computed(() => {
    this.authStore.user();
    return this.authStore.hasPermission('territorios.editar');
  });

  readonly colores = COLORES_SECTOR;
  aviso = signal<string | null>(null);
  guardando = signal(false);
  centro = signal<{ lat: number; lng: number } | null>(null);

  /** Límite de la congregación: solo se ve de fondo al dibujar; se sube en el Mapa general. */
  unidades = signal<UnidadCongregacion[]>([]);
  mapaCongregacion = computed(() => this.aFeatures(this.unidades()));

  // Paso 2 y 3
  sectores = signal<Sector[]>([]);
  sinSector = signal(0);
  tarjetas = signal<Territorio[]>([]);
  /** Editor de barrio abierto (nuevo o existente); el mapa y el panel comparten este objeto. */
  editor = signal<{
    id_sector?: number; nombre: string; color: string; coordenada: any;
    inicial: GeoJSONFeatureCollection; referencias: GeoJSONFeatureCollection;
  } | null>(null);
  errorForm = signal<string | null>(null);
  porBorrar = signal<Sector | null>(null);
  private dibujoActual: any = null;
  hayDibujo = signal(false);
  eleccion = signal<{
    idSector: number; titulo: string; ayuda: string; tarjetas: TarjetaElegible[]; soloLectura: boolean;
  } | null>(null);

  ngOnInit(): void {
    this.cargar();
    this.svc.getMapaContexto().subscribe({ next: (r) => this.centro.set(r.centro) });
  }

  private cargar(): void {
    forkJoin({
      unidades: this.svc.getCongregacionLimite(),
      sectores: this.svc.getSectores(),
      tarjetas: this.svc.getTerritorios(0, 500, false),
    }).subscribe({
      next: (r) => {
        this.unidades.set(r.unidades);
        this.sectores.set(r.sectores.sectores);
        this.sinSector.set(r.sectores.sin_sector);
        this.tarjetas.set(r.tarjetas);
      },
      error: () => this.aviso.set('No se pudo cargar la información. Revise la conexión e intente de nuevo.'),
    });
  }

  private aFeatures(us: UnidadCongregacion[]): GeoJSONFeatureCollection {
    return {
      type: 'FeatureCollection',
      features: us.filter(u => u.coordenada).map((u, i) => ({
        type: 'Feature' as const, id: u.id_unidad ?? i,
        properties: { codigo: '', limite: true },
        geometry: u.coordenada!,
      })),
    };
  }

  volver(): void { this.router.navigate(['/territorios']); }

  // ── Barrios ────────────────────────────────────────────────────────
  private static readonly NOMBRES_COLOR: Record<string, string> = {
    '#0ea5e9': 'Azul', '#14b8a6': 'Verde azulado', '#8b5cf6': 'Violeta', '#f59e0b': 'Naranja',
    '#ec4899': 'Rosa', '#84cc16': 'Lima', '#f97316': 'Mandarina', '#6366f1': 'Índigo',
  };
  nombreColor(c: string): string { return 'Color ' + (SectoresPage.NOMBRES_COLOR[c] ?? c).toLowerCase(); }

  /** Nombre del otro barrio que ya usa ese color, para no repetirlo sin querer. */
  colorEnUso(c: string, idPropio?: number): string | null {
    return this.sectores().find(s => s.color === c && s.id_sector !== idPropio)?.nombre ?? null;
  }

  nuevoSector(): void { void this.abrirEditor(); }
  editarSector(s: Sector): void { void this.abrirEditor(s); }

  private async abrirEditor(s?: Sector): Promise<void> {
    const usados = new Set(this.sectores().map(x => x.color));
    const referencias = await this.referencias(s?.id_sector);
    this.errorForm.set(null);
    this.dibujoActual = s?.coordenada ?? null;
    this.hayDibujo.set(!!s?.coordenada);
    this.editor.set({
      id_sector: s?.id_sector,
      nombre: s?.nombre ?? '',
      color: s?.color ?? this.colores.find(c => !usados.has(c)) ?? this.colores[0],
      coordenada: s?.coordenada ?? null,
      inicial: s?.coordenada
        ? { type: 'FeatureCollection', features: [{ type: 'Feature', id: 0, properties: {}, geometry: s.coordenada }] }
        : FC_VACIA,
      referencias,
    });
  }

  cerrarEditor(): void {
    const e = this.editor();
    const conCambios = !!e && (!e.id_sector && (e.nombre.trim() !== '' || this.hayDibujo()));
    if (conCambios && !confirm('¿Cerrar sin guardar este barrio?')) return;
    this.editor.set(null);
  }

  /** Lo que se ve de fondo mientras se dibuja: el territorio, los demás barrios y las tarjetas. */
  private referencias(idPropio?: number): Promise<GeoJSONFeatureCollection> {
    return new Promise((ok) => {
      this.svc.getTerritoriosGeoJSON().subscribe({
        next: (tarjetas) => {
          const features = [
            ...this.mapaCongregacion().features,
            ...this.sectores().filter(s => s.coordenada && s.id_sector !== idPropio).map(s => ({
              type: 'Feature' as const, id: `s${s.id_sector}`,
              properties: { codigo: s.nombre, color: s.color || '#94a3b8' }, geometry: s.coordenada!,
            })),
            ...tarjetas.features.filter(f => f.geometry),
          ];
          ok({ type: 'FeatureCollection', features });
        },
        error: () => ok(this.mapaCongregacion()),
      });
    });
  }

  alDibujar(fc: GeoJSONFeatureCollection): void {
    const poligono = fc.features.find(x => x.geometry?.type === 'Polygon');
    this.dibujoActual = poligono?.geometry ?? null;
    this.hayDibujo.set(!!poligono);
  }

  dibujarDeNuevo(mapa: TerritorioMapComponent): void {
    mapa.clearAll();
    mapa.empezarDibujo();
  }

  guardarSector(): void {
    const e = this.editor();
    if (!e || !e.nombre.trim()) return;
    this.guardando.set(true);
    this.errorForm.set(null);
    const coordenada = this.dibujoActual ?? null;
    const datos: Partial<Sector> = { nombre: e.nombre.trim(), color: e.color, coordenada };
    const zonaNueva = !!coordenada && coordenada !== e.coordenada;
    const peticion = e.id_sector
      ? this.svc.actualizarSector(e.id_sector, datos)
      : this.svc.crearSector(datos);
    peticion.subscribe({
      next: (s) => {
        this.guardando.set(false);
        this.editor.set(null);
        this.cargar();
        if (s.coordenada && (zonaNueva || !e.id_sector)) this.proponerTarjetas(s);
      },
      error: (err) => {
        this.guardando.set(false);
        const d = err?.error?.detail;
        this.errorForm.set(typeof d === 'string' ? d : 'No se pudo guardar el barrio. Intente de nuevo.');
      },
    });
  }

  /** Tras dibujar: "Encontramos N tarjetas dentro de este barrio". */
  private proponerTarjetas(s: Sector): void {
    this.svc.sugerirTarjetas(s.id_sector).subscribe({
      next: (sug: TarjetaSugerida[]) => {
        if (!sug.length) {
          this.aviso.set(`Barrio «${s.nombre}» guardado. Todavía no hay tarjetas dibujadas dentro de esa zona; cuando las cree aparecerán aquí, o puede elegirlas a mano con «Elegir tarjetas».`);
          return;
        }
        const propias = this.tarjetas().filter(t => t.id_sector === s.id_sector).map(t => t.id_territorio);
        const lista: TarjetaElegible[] = sug.map(t => ({
          id_territorio: t.id_territorio, codigo: t.codigo, nombre: t.nombre,
          sectorActual: t.id_sector_actual && t.id_sector_actual !== s.id_sector ? t.sector_actual : null,
          marcada: true,
        }));
        // Las que ya eran del barrio y quedaron fuera del dibujo se conservan, desmarcadas visibles.
        for (const id of propias) {
          if (!lista.some(x => x.id_territorio === id)) {
            const t = this.tarjetas().find(x => x.id_territorio === id)!;
            lista.push({ id_territorio: id, codigo: t.codigo, nombre: t.nombre, sectorActual: null, marcada: true });
          }
        }
        this.eleccion.set({
          idSector: s.id_sector,
          titulo: `Encontramos ${sug.length} ${sug.length === 1 ? 'tarjeta' : 'tarjetas'} dentro de «${s.nombre}»`,
          ayuda: 'Quite la marca a las que no pertenezcan a este barrio y pulse «Asignar al barrio».',
          tarjetas: lista, soloLectura: false,
        });
      },
    });
  }

  elegirTarjetas(s: Sector): void {
    const lista: TarjetaElegible[] = this.tarjetas()
      .slice()
      .sort((a, b) => (a.codigo ?? '').localeCompare(b.codigo ?? '', 'es', { numeric: true }))
      .map(t => ({
        id_territorio: t.id_territorio, codigo: t.codigo, nombre: t.nombre,
        sectorActual: t.id_sector && t.id_sector !== s.id_sector
          ? this.sectores().find(x => x.id_sector === t.id_sector)?.nombre ?? null : null,
        marcada: t.id_sector === s.id_sector,
      }));
    this.eleccion.set({
      idSector: s.id_sector,
      titulo: `Tarjetas de «${s.nombre}»`,
      ayuda: 'Marque las tarjetas que pertenecen a este barrio. Si una ya está en otro barrio, pasará a este.',
      tarjetas: lista, soloLectura: false,
    });
  }

  cerrarEleccion(): void { this.eleccion.set(null); }

  asignarElegidas(): void {
    const e = this.eleccion();
    if (!e) return;
    this.guardando.set(true);
    this.svc.asignarTarjetas(e.idSector, e.tarjetas.filter(t => t.marcada).map(t => t.id_territorio)).subscribe({
      next: () => {
        this.guardando.set(false);
        this.eleccion.set(null);
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        this.aviso.set(err?.error?.detail ?? 'No se pudieron asignar las tarjetas. Intente de nuevo.');
      },
    });
  }

  pedirBorrar(s: Sector): void { this.porBorrar.set(s); }

  confirmarBorrar(): void {
    const s = this.porBorrar();
    if (!s) return;
    this.svc.borrarSector(s.id_sector).subscribe({
      next: () => { this.porBorrar.set(null); this.cargar(); },
      error: () => { this.porBorrar.set(null); this.aviso.set('No se pudo borrar el barrio. Intente de nuevo.'); },
    });
  }

  verTarjetas(s: Sector): void {
    this.router.navigate(['/territorios'], { queryParams: { sector: s.id_sector } });
  }

  verSinSector(): void {
    this.router.navigate(['/territorios'], { queryParams: { sector: 'sin' } });
  }
}
