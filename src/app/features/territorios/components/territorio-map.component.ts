import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { geoPolygon, geoArea, geoCircle } from '../utils/geo-math.util';

import { GeoJSONFeatureCollection, GeoJSONFeature } from '../models/territorio.model';
import { TerritoriosService } from '../services/territorios.service';

export type LayerMode = 'territorio' | 'manzana' | 'punto';

@Component({
  standalone: true,
  selector: 'app-territorio-map',
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Wrapper with dynamic height -->
    <div class="relative w-full overflow-visible" [style.height]="height">

      <!-- Map canvas fills the wrapper -->
      <div #mapContainer style="position:absolute;inset:0;border-radius:12px;overflow:hidden;z-index:0;"></div>

      <!-- ════════════════════════════════════════════
           DRAWING OVERLAYS (only when enableDrawing)
           ════════════════════════════════════════════ -->
      @if (enableDrawing) {

        <!-- ── TOP RIGHT: Layer mode + Geocoder + Geolocate ── -->
        <div class="absolute top-2 right-2 z-[1000] flex items-start gap-1.5">

          <!-- Layer mode switcher -->
          <div class="flex items-center bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-600 rounded-xl shadow-md backdrop-blur-sm overflow-hidden">
            <button
              (click)="setLayerMode('territorio')"
              [class]="layerMode() === 'territorio'
                ? 'px-2.5 py-1.5 text-[0.65rem] font-black text-white bg-purple-600 transition-colors'
                : 'px-2.5 py-1.5 text-[0.65rem] font-bold text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors'"
              title="Dibujar límite del territorio"
            >Territorio</button>
            <div class="w-px h-4 bg-slate-200 dark:bg-slate-600"></div>
            <button
              (click)="setLayerMode('manzana')"
              [class]="layerMode() === 'manzana'
                ? 'px-2.5 py-1.5 text-[0.65rem] font-black text-white bg-blue-600 transition-colors'
                : 'px-2.5 py-1.5 text-[0.65rem] font-bold text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors'"
              title="Dibujar manzanas (bloques)"
            >Manzanas</button>
            <div class="w-px h-4 bg-slate-200 dark:bg-slate-600"></div>
            <button
              (click)="setLayerMode('punto')"
              [class]="layerMode() === 'punto'
                ? 'px-2.5 py-1.5 text-[0.65rem] font-black text-white bg-rose-600 transition-colors'
                : 'px-2.5 py-1.5 text-[0.65rem] font-bold text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors'"
              title="Colocar puntos de lugar (salida, etc.)"
            >Puntos</button>
          </div>

          <!-- Geolocate button -->
          <button
            (click)="geolocate()"
            [disabled]="geolocating()"
            title="Ir a mi ubicación actual"
            class="w-9 h-9 flex items-center justify-center rounded-xl bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-600 shadow-md text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all disabled:opacity-60 backdrop-blur-sm"
          >
            @if (geolocating()) {
              <div class="w-4 h-4 border-2 border-slate-400 border-t-emerald-500 rounded-full animate-spin"></div>
            } @else {
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <line x1="12" y1="2" x2="12" y2="6"></line>
                <line x1="12" y1="18" x2="12" y2="22"></line>
                <line x1="2" y1="12" x2="6" y2="12"></line>
                <line x1="18" y1="12" x2="22" y2="12"></line>
              </svg>
            }
          </button>

          <!-- Geocoder -->
          <div class="relative w-56">
            <div class="flex items-center bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-600 rounded-xl shadow-md backdrop-blur-sm overflow-hidden transition-all" [class.rounded-b-none]="geocodeResults().length > 0" [class.border-b-0]="geocodeResults().length > 0">
              <svg class="w-4 h-4 text-slate-400 ml-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input
                type="text"
                [(ngModel)]="geocodeQueryStr"
                (keydown.enter)="searchGeocode()"
                placeholder="Buscar dirección..."
                class="flex-1 px-2 py-2 bg-transparent text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
              >
              @if (geocodeQueryStr) {
                <button (click)="clearGeocode()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              } @else {
                <button (click)="searchGeocode()" class="p-2 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
              }
            </div>
            @if (geocodeResults().length > 0) {
              <ul class="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 border-t-0 rounded-b-xl shadow-xl z-10 overflow-hidden max-h-52 overflow-y-auto">
                @for (r of geocodeResults(); track r.place_id) {
                  <li
                    (click)="selectGeocode(r)"
                    class="px-3 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer border-b border-slate-100 dark:border-slate-700/50 last:border-0 transition-colors leading-snug"
                  >
                    <p class="font-semibold text-slate-800 dark:text-slate-200 truncate">{{ r.name || r.display_name.split(',')[0] }}</p>
                    <p class="text-slate-400 text-[0.65rem] truncate mt-0.5">{{ r.display_name }}</p>
                  </li>
                }
                @if (geocodeLoading()) {
                  <li class="px-3 py-3 text-xs text-slate-400 text-center">Buscando...</li>
                }
              </ul>
            }
            @if (geocodeLoading() && geocodeResults().length === 0) {
              <div class="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 border-t-0 rounded-b-xl shadow-xl z-10 px-3 py-3">
                <p class="text-xs text-slate-400 text-center">Buscando...</p>
              </div>
            }
            @if (geocodeError()) {
              <div class="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 border-t-0 rounded-b-xl shadow-xl z-10 px-3 py-3">
                <p class="text-xs text-red-500 text-center">{{ geocodeError() }}</p>
              </div>
            }
          </div>
        </div>

        <!-- ── BOTTOM LEFT: Hint panel ── -->
        <div class="absolute bottom-2 left-2 z-[1000] flex flex-col gap-1.5 max-w-[calc(100%-100px)]">
          <div class="flex items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-2 shadow-md">
            <div class="w-5 h-5 rounded-lg flex items-center justify-center shrink-0"
                 [class]="layerMode() === 'territorio' ? 'bg-purple-100 dark:bg-purple-900/40' : layerMode() === 'manzana' ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-rose-100 dark:bg-rose-900/40'">
              <svg class="w-3 h-3"
                   [class]="layerMode() === 'territorio' ? 'text-purple-600 dark:text-purple-400' : layerMode() === 'manzana' ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'"
                   viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            </div>
            <span class="text-[0.65rem] font-semibold text-slate-600 dark:text-slate-300 leading-tight">{{ activeToolHint() }}</span>
          </div>
          @if (realtimeArea()) {
            <div class="flex items-center gap-2 bg-emerald-600/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-md">
              <svg class="w-3.5 h-3.5 text-emerald-100 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
              <span class="text-[0.65rem] font-bold text-white leading-tight">{{ realtimeArea() }}</span>
            </div>
          }
        </div>

        <!-- ── BOTTOM RIGHT: Action buttons ── -->
        <div class="absolute bottom-2 right-2 z-[1000] flex flex-col items-end gap-1.5">
          @if (!showClearConfirm()) {
            @if (drawingActive()) {
              <button
                (click)="undoLastVertex()"
                title="Deshacer último vértice (Ctrl+Z)"
                class="flex items-center gap-1.5 px-3 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl shadow-md text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-300 transition-all"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-4.51"></path></svg>
                Deshacer
              </button>
            }
            @if (layerMode() === 'territorio') {
              <button
                (click)="showClearConfirm.set(true)"
                title="Limpiar todos los trazos del territorio"
                class="flex items-center gap-1.5 px-3 py-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-600 rounded-xl shadow-md text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 transition-all"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                Limpiar territorio
              </button>
            }
          } @else {
            <div class="flex items-center gap-1.5 bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-red-200 dark:border-red-800/50 rounded-xl shadow-lg px-3 py-2">
              <svg class="w-3.5 h-3.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span class="text-[0.65rem] font-bold text-slate-600 dark:text-slate-300">¿Borrar territorio?</span>
              <button (click)="clearAll()" class="px-2.5 py-1 text-[0.65rem] font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">Sí</button>
              <button (click)="showClearConfirm.set(false)" class="px-2.5 py-1 text-[0.65rem] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">No</button>
            </div>
          }
        </div>

        <!-- ── Geolocation error toast ── -->
        @if (geolocateError()) {
          <div class="absolute top-14 right-2 z-[1000] flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-xl px-3 py-2 shadow-md">
            <svg class="w-3.5 h-3.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span class="text-xs font-semibold text-red-600 dark:text-red-400">{{ geolocateError() }}</span>
          </div>
        }

        <!-- ── Modo Punto: cursor hint ── -->
        @if (layerMode() === 'punto' && !showPuntoPrompt()) {
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[999] pointer-events-none">
            <div class="flex items-center gap-2 bg-rose-600/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg">
              <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span class="text-[0.65rem] font-bold text-white">Clic en el mapa para colocar un punto</span>
            </div>
          </div>
        }

        <!-- ── Prompt: Número de manzana ── -->
        @if (showManzanaPrompt()) {
          <div class="absolute inset-0 z-[1100] flex items-center justify-center">
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-72 shadow-2xl overflow-hidden">
              <div class="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-blue-50/50 dark:bg-blue-900/20">
                <h4 class="text-sm font-black text-slate-800 dark:text-white">Número de manzana</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Asigna un número o código a esta manzana</p>
              </div>
              <div class="p-4">
                <input
                  #manzanaInput
                  type="text"
                  [(ngModel)]="pendingManzanaNumero"
                  placeholder="Ej: 1, 2, A, 10B..."
                  (keydown.enter)="confirmManzana()"
                  (keydown.escape)="cancelManzana()"
                  class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  autofocus
                />
              </div>
              <div class="p-4 pt-0 flex gap-2">
                <button (click)="cancelManzana()" class="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button (click)="confirmManzana()" [disabled]="!pendingManzanaNumero" class="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors disabled:opacity-50">Guardar manzana</button>
              </div>
            </div>
          </div>
        }

        <!-- ── Prompt: Datos del punto ── -->
        @if (showPuntoPrompt()) {
          <div class="absolute inset-0 z-[1100] flex items-center justify-center">
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-72 shadow-2xl overflow-hidden">
              <div class="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-rose-50/50 dark:bg-rose-900/20">
                <h4 class="text-sm font-black text-slate-800 dark:text-white">Nuevo punto</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Describe este lugar en el mapa</p>
              </div>
              <div class="p-4 space-y-3">
                <div>
                  <label class="block text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre *</label>
                  <input
                    type="text"
                    [(ngModel)]="pendingPuntoNombre"
                    placeholder="Ej: Salida Males, Parque..."
                    (keydown.escape)="cancelPunto()"
                    class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                    autofocus
                  />
                </div>
                <div>
                  <label class="block text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
                  <select [(ngModel)]="pendingPuntoTipo" class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all cursor-pointer">
                    <option value="Salida">Salida</option>
                    <option value="Lugar">Lugar de interés</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label class="block text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider mb-1">Notas (opcional)</label>
                  <input
                    type="text"
                    [(ngModel)]="pendingPuntoNotas"
                    placeholder="Observaciones..."
                    class="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all"
                  />
                </div>
              </div>
              <div class="p-4 pt-0 flex gap-2">
                <button (click)="cancelPunto()" class="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button (click)="confirmPunto()" [disabled]="!pendingPuntoNombre" class="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors disabled:opacity-50">Guardar punto</button>
              </div>
            </div>
          </div>
        }

      } <!-- end @if enableDrawing -->

    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; width: 100%; }
  `],
})
export class TerritorioMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  @Input() geojson: GeoJSONFeatureCollection | null = null;
  @Input() manzanasGeojson: GeoJSONFeatureCollection | null = null;
  @Input() puntosGeojson: GeoJSONFeatureCollection | null = null;
  @Input() height = '300px';
  @Input() selectedId: number | null = null;
  @Input() interactive = true;
  @Input() showPopups = false;
  @Input() enableDrawing = false;

  @Output() featureClick = new EventEmitter<any>();
  @Output() geometryChanged = new EventEmitter<GeoJSONFeatureCollection>();
  /** Emite { geojson: GeoJSON Polygon, numero: string } cuando se confirma una manzana dibujada */
  @Output() manzanaDrawn = new EventEmitter<{ geojson: any; numero: string }>();
  /** Emite datos del punto cuando se confirma su creación */
  @Output() puntoPlaced = new EventEmitter<{ geojson: any; nombre: string; tipo: string; notas: string }>();

  private map: L.Map | null = null;
  private geoLayer: L.GeoJSON | null = null;
  private manzanasLayer: L.LayerGroup | null = null;
  private puntosLayer: L.LayerGroup | null = null;
  private tileProvider = 'osm';
  private tileLayer: L.TileLayer | null = null;
  private geolocateMarker: L.Marker | null = null;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private geolocateErrorTimer: ReturnType<typeof setTimeout> | null = null;
  private mapClickHandler: ((e: L.LeafletMouseEvent) => void) | null = null;

  // ── Pending layers for prompts ─────────────────────────────────────────
  private pendingManzanaLayerObj: any = null;
  private pendingPuntoLatLng: L.LatLng | null = null;
  private pendingPuntoMarker: L.Marker | null = null;

  // ── Signals ────────────────────────────────────────────────────────────
  layerMode = signal<LayerMode>('territorio');
  activeToolHint = signal('Selecciona una herramienta para dibujar el límite del territorio.');
  drawingActive = signal(false);
  realtimeArea = signal<string | null>(null);
  showClearConfirm = signal(false);
  geolocating = signal(false);
  geolocateError = signal<string | null>(null);
  geocodeResults = signal<any[]>([]);
  geocodeLoading = signal(false);
  geocodeError = signal<string | null>(null);

  // ── Manzana prompt ─────────────────────────────────────────────────────
  showManzanaPrompt = signal(false);
  pendingManzanaNumero = '';

  // ── Punto prompt ───────────────────────────────────────────────────────
  showPuntoPrompt = signal(false);
  pendingPuntoNombre = '';
  pendingPuntoTipo = 'Salida';
  pendingPuntoNotas = '';

  geocodeQueryStr = '';

  private territoriosService = inject(TerritoriosService);

  // ── Lifecycle ──────────────────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.initMap();
    this.loadTileProvider();
    if (this.enableDrawing) {
      this.setupKeyboardShortcuts();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['geojson'] && this.map) {
      this.renderGeoJSON();
    }
    if (changes['selectedId'] && this.map && this.geoLayer) {
      this.highlightSelected();
    }
    if (changes['manzanasGeojson'] && this.map) {
      this.renderManzanasLayer();
    }
    if (changes['puntosGeojson'] && this.map) {
      this.renderPuntosLayer();
    }
  }

  ngOnDestroy(): void {
    if (this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener);
    }
    if (this.geolocateErrorTimer) clearTimeout(this.geolocateErrorTimer);
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  // ── Map Initialization ─────────────────────────────────────────────────

  private initMap(): void {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [4.711, -74.072],
      zoom: 13,
      zoomControl: this.interactive,
      dragging: this.interactive,
      scrollWheelZoom: this.interactive,
      doubleClickZoom: this.interactive,
      touchZoom: this.interactive,
      attributionControl: false,
    });

    this.setTileLayer('osm');

    if (this.geojson) this.renderGeoJSON();
    if (this.manzanasGeojson) this.renderManzanasLayer();
    if (this.puntosGeojson) this.renderPuntosLayer();

    if (this.enableDrawing) {
      this.initDrawingControls();
    }
  }

  // ── Layer Mode ─────────────────────────────────────────────────────────

  setLayerMode(mode: LayerMode): void {
    this.layerMode.set(mode);

    // Cancel any pending prompts
    this.cancelManzana();
    this.cancelPunto();

    // Remove point-mode click handler
    if (this.mapClickHandler && this.map) {
      this.map.off('click', this.mapClickHandler as any);
      this.mapClickHandler = null;
    }

    if (!this.map) return;

    if (mode === 'territorio') {
      this.activeToolHint.set('Selecciona una herramienta para dibujar el límite del territorio.');
      // Restore polygon drawing tools visibility
      this.map.pm.addControls({
        position: 'topleft',
        drawPolygon: true,
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: true,
        drawCircle: true,
        drawText: false,
        editMode: true,
        dragMode: true,
        cutPolygon: false,
        removalMode: true,
      });
    } else if (mode === 'manzana') {
      this.activeToolHint.set('Dibuja el polígono de cada manzana. Luego asigna su número.');
      this.map.pm.addControls({
        position: 'topleft',
        drawPolygon: true,
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: true,
        drawCircle: false,
        drawText: false,
        editMode: false,
        dragMode: false,
        cutPolygon: false,
        removalMode: false,
      });
    } else if (mode === 'punto') {
      this.activeToolHint.set('Haz clic en el mapa para colocar un punto de lugar.');
      // Hide all geoman tools — we use our own click handler
      this.map.pm.addControls({
        position: 'topleft',
        drawPolygon: false,
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: false,
        drawCircle: false,
        drawText: false,
        editMode: false,
        dragMode: false,
        cutPolygon: false,
        removalMode: false,
      });
      // Register click handler for punto placement
      this.mapClickHandler = (e: L.LeafletMouseEvent) => this.onMapClickForPunto(e);
      this.map.on('click', this.mapClickHandler as any);
    }
  }

  // ── Drawing Controls ────────────────────────────────────────────────────

  private initDrawingControls(): void {
    if (!this.map) return;

    try {
      if (!this.map.pm) {
        console.warn('Geoman plugin (pm) no disponible en L.Map.');
        return;
      }

      this.map.pm.setLang('es');
      (this.map.pm as any).setGlobalOptions({
        snappable: true,
        snapDistance: 15,
        allowSelfIntersection: false,
      });

      this.map.pm.addControls({
        position: 'topleft',
        drawPolygon: true,
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: true,
        drawCircle: true,
        drawText: false,
        editMode: true,
        dragMode: true,
        cutPolygon: false,
        removalMode: true,
      });

      // ── Drawing lifecycle events ─────────────────────────────────────

      this.map.on('pm:drawstart', (e: any) => {
        this.drawingActive.set(true);
        this.realtimeArea.set(null);
        const shape = e.shape;
        if (shape === 'Polygon') {
          const mode = this.layerMode();
          if (mode === 'manzana') {
            this.activeToolHint.set('Dibuja la manzana · Doble clic para finalizar · ESC para cancelar');
          } else {
            this.activeToolHint.set('Clic para agregar vértices · Doble clic para finalizar · ESC para cancelar');
          }
        } else if (shape === 'Rectangle') {
          this.activeToolHint.set('Arrastra para definir el rectángulo');
        } else if (shape === 'Circle') {
          this.activeToolHint.set('Clic para colocar el centro · Arrastra para definir el radio');
        } else {
          this.activeToolHint.set('Dibuja la figura en el mapa');
        }
      });

      this.map.on('pm:drawend', () => {
        this.drawingActive.set(false);
        const mode = this.layerMode();
        if (mode === 'manzana') {
          this.activeToolHint.set('Dibuja el polígono de cada manzana. Luego asigna su número.');
        } else {
          this.activeToolHint.set('Selecciona una herramienta para comenzar.');
        }
      });

      this.map.on('pm:create', (e: any) => {
        this.drawingActive.set(false);
        const mode = this.layerMode();

        if (mode === 'manzana') {
          // Store the layer and show number prompt — don't emit geometryChanged
          this.pendingManzanaLayerObj = e.layer;
          this.pendingManzanaNumero = '';
          this.showManzanaPrompt.set(true);
          this.activeToolHint.set('Ingresa el número para esta manzana.');
        } else {
          // Territorio mode: existing behavior
          e.layer.on('pm:edit', () => this.emitGeometryUpdate());
          e.layer.on('pm:dragend', () => this.emitGeometryUpdate());
          this.emitGeometryUpdate();
          this.recalculateAreaFromAllLayers();
          this.activeToolHint.set('Figura creada. Puedes editar con las herramientas de edición.');
        }
      });

      this.map.on('pm:remove', () => {
        if (this.layerMode() === 'territorio') {
          this.emitGeometryUpdate();
          this.recalculateAreaFromAllLayers();
        }
      });

      this.map.on('pm:vertexadded', (e: any) => {
        this.updateRealtimeArea(e.workingLayer);
      });

      this.map.on('pm:globaleditmodetoggled', (e: any) => {
        if (e.enabled) {
          this.activeToolHint.set('Arrastra los vértices para editar · Clic fuera para salir');
        } else {
          this.emitGeometryUpdate();
          this.recalculateAreaFromAllLayers();
          this.activeToolHint.set('Selecciona una herramienta para comenzar.');
        }
      });

      this.map.on('pm:globaldragmodetoggled', (e: any) => {
        if (e.enabled) {
          this.activeToolHint.set('Arrastra el polígono completo a su nueva posición');
        } else {
          this.emitGeometryUpdate();
          this.activeToolHint.set('Selecciona una herramienta para comenzar.');
        }
      });

      this.map.on('pm:globalremovalmodetoggled', (e: any) => {
        if (e.enabled) {
          this.activeToolHint.set('Clic sobre una figura para eliminarla del mapa');
        } else {
          this.activeToolHint.set('Selecciona una herramienta para comenzar.');
        }
      });

    } catch (err) {
      console.error('Error inicializando controles Geoman:', err);
    }
  }

  // ── Manzana prompt ─────────────────────────────────────────────────────

  confirmManzana(): void {
    if (!this.pendingManzanaNumero?.trim() || !this.pendingManzanaLayerObj || !this.map) {
      return;
    }
    const geojson = this.pendingManzanaLayerObj.toGeoJSON();
    this.manzanaDrawn.emit({ geojson, numero: this.pendingManzanaNumero.trim() });
    // Remove the temporary layer — parent will reload manzanasGeojson
    this.map.removeLayer(this.pendingManzanaLayerObj);
    this.pendingManzanaLayerObj = null;
    this.showManzanaPrompt.set(false);
    this.pendingManzanaNumero = '';
    this.activeToolHint.set('Manzana guardada. Dibuja la siguiente o cambia de capa.');
  }

  cancelManzana(): void {
    if (this.pendingManzanaLayerObj && this.map) {
      this.map.removeLayer(this.pendingManzanaLayerObj);
      this.pendingManzanaLayerObj = null;
    }
    this.showManzanaPrompt.set(false);
    this.pendingManzanaNumero = '';
  }

  // ── Punto placement ────────────────────────────────────────────────────

  private onMapClickForPunto(e: L.LeafletMouseEvent): void {
    if (this.showPuntoPrompt()) return;
    this.pendingPuntoLatLng = e.latlng;

    // Show a temporary marker
    if (this.pendingPuntoMarker && this.map) {
      this.map.removeLayer(this.pendingPuntoMarker);
    }
    const icon = L.divIcon({
      html: `<div style="width:20px;height:20px;background:#e11d48;border:3px solid white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 20],
      className: '',
    });
    if (this.map) {
      this.pendingPuntoMarker = L.marker(e.latlng, { icon }).addTo(this.map);
    }

    this.pendingPuntoNombre = '';
    this.pendingPuntoTipo = 'Salida';
    this.pendingPuntoNotas = '';
    this.showPuntoPrompt.set(true);
  }

  confirmPunto(): void {
    if (!this.pendingPuntoNombre?.trim() || !this.pendingPuntoLatLng) return;
    const geojson = {
      type: 'Point',
      coordinates: [this.pendingPuntoLatLng.lng, this.pendingPuntoLatLng.lat],
    };
    this.puntoPlaced.emit({
      geojson,
      nombre: this.pendingPuntoNombre.trim(),
      tipo: this.pendingPuntoTipo || 'Otro',
      notas: this.pendingPuntoNotas?.trim() || '',
    });
    // Remove temp marker — parent will reload puntosGeojson
    if (this.pendingPuntoMarker && this.map) {
      this.map.removeLayer(this.pendingPuntoMarker);
      this.pendingPuntoMarker = null;
    }
    this.pendingPuntoLatLng = null;
    this.showPuntoPrompt.set(false);
    this.pendingPuntoNombre = '';
    this.activeToolHint.set('Punto guardado. Haz clic en otro lugar para añadir más.');
  }

  cancelPunto(): void {
    if (this.pendingPuntoMarker && this.map) {
      this.map.removeLayer(this.pendingPuntoMarker);
      this.pendingPuntoMarker = null;
    }
    this.pendingPuntoLatLng = null;
    this.showPuntoPrompt.set(false);
    this.pendingPuntoNombre = '';
  }

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────

  private setupKeyboardShortcuts(): void {
    this.keydownListener = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        this.undoLastVertex();
      }
      if (e.key === 'Escape') {
        if (this.showManzanaPrompt()) this.cancelManzana();
        if (this.showPuntoPrompt()) this.cancelPunto();
      }
    };
    document.addEventListener('keydown', this.keydownListener);
  }

  // ── Undo last vertex ───────────────────────────────────────────────────

  undoLastVertex(): void {
    if (!this.map || !this.drawingActive()) return;
    try {
      const pm = (this.map as any).pm;
      if (pm?.Draw?.Polygon?._enabled) {
        pm.Draw.Polygon.deleteLastVertex();
      }
    } catch (e) {
      console.warn('No se pudo deshacer el vértice:', e);
    }
  }

  // ── Clear all territory layers ─────────────────────────────────────────

  clearAll(): void {
    if (!this.map) return;
    this.showClearConfirm.set(false);
    try {
      const geomanLayers = (this.map.pm as any).getGeomanLayers() as L.Layer[];
      geomanLayers.forEach(layer => this.map!.removeLayer(layer));
      if (this.geoLayer) {
        this.map.removeLayer(this.geoLayer);
        this.geoLayer = null;
      }
    } catch {
      const toRemove: L.Layer[] = [];
      this.map.eachLayer((layer: any) => {
        if (layer instanceof L.Polygon || layer instanceof L.Circle) {
          toRemove.push(layer);
        }
      });
      toRemove.forEach(l => this.map!.removeLayer(l));
    }
    this.realtimeArea.set(null);
    this.emitGeometryUpdate();
    this.activeToolHint.set('Lienzo limpiado. Selecciona una herramienta para comenzar.');
  }


  // ── Manzanas layer rendering ───────────────────────────────────────────

  renderManzanasLayer(): void {
    if (!this.map) return;
    if (this.manzanasLayer) {
      this.map.removeLayer(this.manzanasLayer);
      this.manzanasLayer = null;
    }
    if (!this.manzanasGeojson?.features?.length) return;

    this.manzanasLayer = L.layerGroup().addTo(this.map);

    this.manzanasGeojson.features.forEach((feature: any) => {
      if (!feature.geometry) return;
      const props = feature.properties || {};
      const isPredicada = props.predicada === true;

      // When predicada: green. Otherwise: default slate.
      const strokeColor = isPredicada ? '#16a34a' : '#475569';
      const fillColor  = isPredicada ? '#bbf7d0' : '#f1f5f9';
      const labelBg    = isPredicada ? '#16a34a' : '#475569';

      // Polygon fill
      const poly = L.geoJSON(feature, {
        style: {
          color: strokeColor,
          weight: isPredicada ? 2.5 : 2,
          fillColor,
          fillOpacity: isPredicada ? 0.55 : 0.40,
          opacity: 0.9,
        },
      });
      poly.addTo(this.manzanasLayer!);

      // Centroid label with number
      const numero = props.numero_manzana;
      if (numero) {
        try {
          const centroid = this.getCentroid(feature.geometry);
          if (centroid) {
            const checkmark = isPredicada ? '&nbsp;✓' : '';
            const labelIcon = L.divIcon({
              html: `<div style="
                display:inline-block;
                transform:translate(-50%,-50%);
                background:${labelBg};
                color:white;
                font-weight:700;
                font-size:12px;
                padding:3px 8px;
                border-radius:8px;
                white-space:nowrap;
                box-shadow:0 2px 6px rgba(0,0,0,0.45);
                font-family:system-ui,sans-serif;
                border:1.5px solid rgba(255,255,255,0.55);
                line-height:1.4;
              ">${numero}${checkmark}</div>`,
              className: '',
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            });
            L.marker(centroid, { icon: labelIcon, interactive: false }).addTo(this.manzanasLayer!);
          }
        } catch {}
      }
    });
  }

  // ── Puntos layer rendering ─────────────────────────────────────────────

  renderPuntosLayer(): void {
    if (!this.map) return;
    if (this.puntosLayer) {
      this.map.removeLayer(this.puntosLayer);
      this.puntosLayer = null;
    }
    if (!this.puntosGeojson?.features?.length) return;

    this.puntosLayer = L.layerGroup().addTo(this.map);

    this.puntosGeojson.features.forEach((feature: any) => {
      if (!feature.geometry || feature.geometry.type !== 'Point') return;
      const props = feature.properties || {};
      const tipo = props.tipo || 'Otro';
      const coords = feature.geometry.coordinates; // [lng, lat]

      const bgColor = tipo === 'Salida' ? '#e11d48' : tipo === 'Lugar' ? '#2563eb' : '#64748b';
      const label = tipo === 'Salida' ? 'S' : tipo === 'Lugar' ? 'L' : 'P';

      const icon = L.divIcon({
        html: `<div style="
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:1px;
        ">
          <div style="
            background:${bgColor};
            color:white;
            width:28px;
            height:28px;
            border-radius:50% 50% 50% 0;
            transform:rotate(-45deg);
            display:flex;
            align-items:center;
            justify-content:center;
            border:2px solid white;
            box-shadow:0 2px 6px rgba(0,0,0,0.3);
          ">
            <span style="transform:rotate(45deg);font-size:11px;font-weight:900;font-family:system-ui">${label}</span>
          </div>
          <div style="
            background:${bgColor};
            color:white;
            font-size:9px;
            font-weight:700;
            padding:1px 4px;
            border-radius:4px;
            white-space:nowrap;
            max-width:80px;
            overflow:hidden;
            text-overflow:ellipsis;
            box-shadow:0 1px 3px rgba(0,0,0,0.2);
            font-family:system-ui;
          ">${props.nombre || tipo}</div>
        </div>`,
        className: '',
        iconSize: [28, 48],
        iconAnchor: [14, 48],
      });

      const marker = L.marker([coords[1], coords[0]], { icon });
      if (props.nombre || props.notas) {
        marker.bindPopup(`
          <div style="font-family:system-ui;min-width:120px">
            <strong style="font-size:13px;color:#1e293b">${props.nombre || ''}</strong>
            <p style="margin:2px 0 0;color:#64748b;font-size:11px">${tipo}</p>
            ${props.notas ? `<p style="margin:4px 0 0;color:#64748b;font-size:11px">${props.notas}</p>` : ''}
          </div>
        `);
      }
      marker.addTo(this.puntosLayer!);
    });
  }

  // ── Centroid helper ────────────────────────────────────────────────────

  private getCentroid(geometry: any): L.LatLng | null {
    try {
      if (geometry.type === 'Polygon') {
        const coords = geometry.coordinates[0];
        if (!coords?.length) return null;
        let latSum = 0, lngSum = 0;
        coords.forEach((c: number[]) => { lngSum += c[0]; latSum += c[1]; });
        return L.latLng(latSum / coords.length, lngSum / coords.length);
      }
      return null;
    } catch {
      return null;
    }
  }

  // ── Real-time area calculation ─────────────────────────────────────────

  private updateRealtimeArea(workingLayer: any): void {
    if (!workingLayer) return;
    try {
      const rawLatLngs = workingLayer.getLatLngs?.();
      const latlngs: L.LatLng[] = Array.isArray(rawLatLngs?.[0]) ? rawLatLngs[0] : rawLatLngs;
      if (!latlngs || latlngs.length < 3) {
        this.realtimeArea.set(null);
        return;
      }
      const coords = [...latlngs, latlngs[0]].map((ll: L.LatLng) => [ll.lng, ll.lat] as [number, number]);
      const poly = geoPolygon([coords]);
      const area = geoArea(poly);
      this.realtimeArea.set(this.formatArea(area));
    } catch {
      this.realtimeArea.set(null);
    }
  }

  private recalculateAreaFromAllLayers(): void {
    if (!this.map) return;
    let totalArea = 0;
    this.map.eachLayer((layer: any) => {
      try {
        if (layer instanceof L.Circle) {
          const r = layer.getRadius();
          totalArea += Math.PI * r * r;
        } else if (layer instanceof L.Polygon) {
          const geo = layer.toGeoJSON();
          totalArea += geoArea(geo as any);
        }
      } catch {}
    });
    this.realtimeArea.set(totalArea > 1 ? this.formatArea(totalArea) : null);
  }

  private formatArea(areaM2: number): string {
    if (areaM2 >= 10_000) {
      return `Área: ${(areaM2 / 10_000).toFixed(2)} ha`;
    }
    return `Área: ${Math.round(areaM2).toLocaleString('es-CO')} m²`;
  }

  // ── Geocoding (Nominatim) ──────────────────────────────────────────────

  searchGeocode(): void {
    const q = this.geocodeQueryStr?.trim();
    if (!q) return;

    this.geocodeLoading.set(true);
    this.geocodeError.set(null);
    this.geocodeResults.set([]);

    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&accept-language=es`)
      .then(res => {
        if (!res.ok) throw new Error('Error de red');
        return res.json();
      })
      .then((data: any[]) => {
        this.geocodeLoading.set(false);
        if (!data?.length) {
          this.geocodeError.set('No se encontraron resultados para esa búsqueda.');
        } else {
          this.geocodeResults.set(data);
        }
      })
      .catch(() => {
        this.geocodeLoading.set(false);
        this.geocodeError.set('Error al buscar. Verifica tu conexión.');
      });
  }

  selectGeocode(result: any): void {
    if (!this.map) return;
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    this.map.flyTo([lat, lon], 16, { animate: true, duration: 1.2 });
    this.geocodeResults.set([]);
    this.geocodeQueryStr = result.display_name.split(',')[0];
  }

  clearGeocode(): void {
    this.geocodeQueryStr = '';
    this.geocodeResults.set([]);
    this.geocodeError.set(null);
  }

  // ── Geolocation ────────────────────────────────────────────────────────

  geolocate(): void {
    if (!navigator.geolocation) {
      this.showGeolocateError('Tu navegador no soporta geolocalización.');
      return;
    }
    this.geolocating.set(true);
    this.geolocateError.set(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!this.map) return;
        this.geolocating.set(false);
        const { latitude, longitude } = pos.coords;
        this.map.flyTo([latitude, longitude], 16, { animate: true, duration: 1.2 });

        if (this.geolocateMarker) this.map.removeLayer(this.geolocateMarker);

        const icon = L.divIcon({
          html: `<div style="width:16px;height:16px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(16,185,129,0.3);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          className: '',
        });
        this.geolocateMarker = L.marker([latitude, longitude], { icon }).addTo(this.map);
      },
      (err) => {
        this.geolocating.set(false);
        const msg = err.code === 1 ? 'Permiso de ubicación denegado.' : 'No se pudo obtener tu ubicación.';
        this.showGeolocateError(msg);
      },
      { timeout: 10_000 }
    );
  }

  private showGeolocateError(msg: string): void {
    this.geolocateError.set(msg);
    if (this.geolocateErrorTimer) clearTimeout(this.geolocateErrorTimer);
    this.geolocateErrorTimer = setTimeout(() => this.geolocateError.set(null), 4000);
  }

  // ── Geometry Emit (territorio only) ───────────────────────────────────

  private emitGeometryUpdate(): void {
    if (!this.map) return;

    const features: any[] = [];
    this.map.eachLayer((layer: any) => {
      if (layer instanceof L.Circle) {
        try {
          const center = layer.getLatLng();
          const radiusKm = layer.getRadius() / 1000;
          const circlePoly = geoCircle([center.lng, center.lat], radiusKm, 64);
          features.push(circlePoly);
        } catch {}
      } else if (layer instanceof L.Polygon) {
        // Exclude manzanas layer polygons — they are in manzanasLayer
        if (this.manzanasLayer && this.manzanasLayer.hasLayer(layer)) return;
        features.push(layer.toGeoJSON());
      }
    });

    const fc: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: features as GeoJSONFeature[],
    };
    this.geometryChanged.emit(fc);
  }

  // ── Tile Layer ─────────────────────────────────────────────────────────

  private loadTileProvider(): void {
    this.territoriosService.getTileProvider().subscribe({
      next: (res) => {
        this.tileProvider = res.tile_provider || 'osm';
        this.setTileLayer(this.tileProvider);
      },
      error: () => this.setTileLayer('osm'),
    });
  }

  setTileLayer(provider: string): void {
    if (!this.map) return;
    if (this.tileLayer) this.map.removeLayer(this.tileLayer);

    const tileUrl =
      provider === 'google'
        ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    this.tileLayer = L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(this.map);
  }

  // ── GeoJSON Rendering (territory outline) ─────────────────────────────

  private renderGeoJSON(): void {
    if (!this.map || !this.geojson) return;

    if (this.geoLayer) {
      this.map.removeLayer(this.geoLayer);
    }

    this.geoLayer = L.geoJSON(this.geojson as any, {
      style: (feature: any) => this.getFeatureStyle(feature),
      onEachFeature: (feature: any, layer: L.Layer) => {
        layer.on('click', () => this.featureClick.emit(feature));

        if (this.showPopups && feature.properties) {
          const p = feature.properties;
          const stateColor =
            p.estado_territorio === 'Disponible' ? { bg: '#ecfdf5', text: '#047857' }
            : p.estado_territorio === 'Asignado' ? { bg: '#f5f3ff', text: '#6d28d9' }
            : { bg: '#f1f5f9', text: '#64748b' };
          layer.bindPopup(`
            <div style="font-family:system-ui;min-width:160px">
              <strong style="font-size:14px;color:#1e293b">${p.codigo || ''}</strong>
              <p style="margin:4px 0 0;color:#64748b;font-size:12px">${p.nombre || ''}</p>
              <span style="display:inline-block;margin-top:6px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;background:${stateColor.bg};color:${stateColor.text}">
                ${p.estado_territorio || ''}
              </span>
            </div>
          `);
        }
      },
    }).addTo(this.map);

    if (this.enableDrawing) {
      this.geoLayer.eachLayer((layer: any) => {
        layer.on?.('pm:edit', () => this.emitGeometryUpdate());
        layer.on?.('pm:dragend', () => this.emitGeometryUpdate());
      });
      this.recalculateAreaFromAllLayers();
    }

    const bounds = this.geoLayer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [30, 30] });
    }

    this.highlightSelected();
  }

  private getFeatureStyle(feature: any): L.PathOptions {
    const estado = feature?.properties?.estado_territorio || '';
    const isSelected = feature?.id === this.selectedId;

    let color = '#94a3b8';
    let fillColor = '#f1f5f9';

    if (estado === 'Disponible') {
      color = '#059669';
      fillColor = '#d1fae5';
    } else if (estado === 'Asignado') {
      color = '#7c3aed';
      fillColor = '#ede9fe';
    }

    return {
      color: isSelected ? '#f59e0b' : color,
      weight: isSelected ? 3 : 2,
      fillColor,
      fillOpacity: isSelected ? 0.5 : 0.3,
      opacity: 0.9,
    };
  }

  private highlightSelected(): void {
    if (!this.geoLayer) return;
    this.geoLayer.setStyle((feature: any) => this.getFeatureStyle(feature));
  }
}
