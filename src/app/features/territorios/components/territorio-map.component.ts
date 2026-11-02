import { avisoNumeroRepetido, NumeracionManzanas, siguienteLibre } from '../utils/numeracion-manzanas.util';
import { PickerOption, SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';
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
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { geoPolygon, geoArea, geoCircle } from '../utils/geo-math.util';
import { crearCapaBasePropia, callesDelMapa } from '../utils/mapa-base-propio';

import { GeoJSONFeatureCollection, GeoJSONFeature, GeoJSONGeometry } from '../models/territorio.model';
import { TerritoriosService } from '../services/territorios.service';
import { firstValueFrom } from 'rxjs';

export type LayerMode = 'territorio' | 'manzana' | 'punto';

@Component({
  standalone: true,
  selector: 'app-territorio-map',
  imports: [CommonModule, FormsModule, SelectPickerComponent],
  template: `
    <!-- Wrapper with dynamic height -->
    <div class="relative w-full overflow-visible" [style.height]="height">

      <!-- Map canvas fills the wrapper -->
      <div #mapContainer style="position:absolute;inset:0;border-radius:12px;overflow:hidden;z-index:0;"></div>

      <!-- ════════════════════════════════════════════
           DRAWING OVERLAYS (only when enableDrawing)
           ════════════════════════════════════════════ -->
      @if (enableDrawing) {

        <!-- ── TOP: pasos (junto a la barra de herramientas) · ubicación + buscador ── -->
        <div class="absolute top-3 left-[60px] right-3 z-30 flex flex-wrap items-start justify-between gap-2 pointer-events-none">

          <!-- Pasos 1 · 2 · 3 -->
          @if (!soloLimite && !panelExterno) {
          <div class="gac-float pointer-events-auto flex items-center gap-0.5 p-1 rounded-xl" role="tablist" aria-label="Pasos del editor">
            @for (paso of pasos; track paso.modo) {
              <button
                (click)="setLayerMode(paso.modo)"
                role="tab"
                [attr.aria-selected]="layerMode() === paso.modo"
                [title]="paso.titulo"
                class="flex items-center gap-2 pl-1.5 pr-3 h-8 rounded-lg text-[13px] font-bold transition-[background-color,color,transform] duration-150 active:scale-[0.97]"
                [class]="layerMode() === paso.modo ? paso.activo : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/70'"
              >
                <span class="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black tabular-nums transition-colors"
                      [class]="layerMode() === paso.modo ? 'bg-white/25 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'">{{ paso.n }}</span>
                {{ paso.label }}
              </button>
            }
          </div>
          } @else { <span></span> }

          <div class="pointer-events-auto flex items-start gap-1.5">
          <!-- Geolocate button -->
          <button
            (click)="geolocate()"
            [disabled]="geolocating()"
            title="Ir a mi ubicación actual"
            class="gac-float w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors disabled:opacity-60 active:scale-[0.96]"
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
          <div class="relative w-[min(16rem,calc(100vw-9rem))]">
            <div class="gac-float h-10 flex items-center rounded-xl overflow-hidden transition-[border-radius] focus-within:ring-2 focus-within:ring-purple-500/40" [class.rounded-b-none]="geocodeResults().length > 0">
              <svg class="w-4 h-4 text-slate-400 ml-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input
                type="text"
                [(ngModel)]="geocodeQueryStr"
                (keydown.enter)="searchGeocode()"
                placeholder="Buscar dirección..."
                class="flex-1 min-w-0 px-2 py-2 bg-transparent text-[13px] font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
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
                    <p class="text-slate-400 text-xs truncate mt-0.5">{{ r.display_name }}</p>
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
        </div>

        <!-- ── BOTTOM LEFT: Hint panel (mientras se revisan propuestas, el panel de revisión ocupa su lugar) ── -->
        @if (!propuestasActivas()) {
        <div class="absolute bottom-3 left-3 z-30 flex flex-col items-start gap-2 max-w-[calc(100%-4.5rem)] sm:max-w-[min(calc(100%-11rem),36rem)]">
          @if (leyendaAsignadas().length > 0) {
            <!-- Quién tiene cada manzana: el mismo color que en el dibujo -->
            <div class="gac-float rounded-xl px-3 py-2 space-y-1" role="list" aria-label="Manzanas asignadas">
              @for (l of leyendaAsignadas(); track l.nombre + l.texto) {
                <div class="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200" role="listitem">
                  <span class="w-3.5 h-3.5 rounded-[4px] shrink-0 border" [style.background-color]="l.color" [style.border-color]="l.color" aria-hidden="true"></span>
                  <span><span class="font-bold">{{ l.nombre }}</span> · {{ l.texto }}</span>
                </div>
              }
            </div>
          }
          @if (layerMode() === 'manzana' && !propuestasActivas() && !panelExterno) {
            <button
              (click)="detectarManzanas()"
              [disabled]="detectando || extrayendo()"
              class="flex items-center gap-2 px-4 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold shadow-lg shadow-blue-900/20 transition-[background-color,transform] active:scale-[0.97]"
              title="Propone las manzanas con las calles del mapa; usted revisa antes de guardar"
            >
              @if (detectando || extrayendo()) {
                <div class="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                Buscando manzanas…
              } @else {
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>
                Detectar manzanas automáticamente
              }
            </button>
          }
          @if (!soloLimite) {
          <div class="gac-float flex items-center gap-2.5 rounded-xl pl-2 pr-3.5 py-2">
            <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[12px] font-black tabular-nums"
                 [class]="layerMode() === 'territorio' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : layerMode() === 'manzana' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'">
              {{ layerMode() === 'territorio' ? 1 : layerMode() === 'manzana' ? 2 : 3 }}
            </div>
            <span class="text-[13px] font-semibold text-slate-700 dark:text-slate-200 leading-snug">{{ activeToolHint() }}</span>
          </div>
          }
          @if (realtimeArea() && !soloLimite) {
            <div class="gac-float flex items-center gap-2 rounded-xl px-3 h-9">
              <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
              <span class="text-[13px] font-bold text-slate-800 dark:text-slate-100 tabular-nums">{{ realtimeArea() }}</span>
            </div>
          }
        </div>
        }

        <!-- ── Revisión de manzanas propuestas ── -->
        @if (propuestasActivas()) {
          <div class="absolute bottom-2 left-2 z-35 w-[min(calc(100%-1rem),440px)] bg-white/95 dark:bg-slate-800/95 backdrop-blur-sm border border-amber-300 dark:border-amber-700/60 rounded-2xl shadow-xl p-4">
            <p class="text-sm font-black text-slate-800 dark:text-white">Se encontraron {{ propuestasTotal() }} manzanas</p>
            <p class="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-snug">
              Compárelas con las cuadras reales. Toque una manzana para quitarla (o para incluirla otra vez).
              Las que falten las puede dibujar después a mano.
            </p>
            <div class="flex gap-2 mt-3">
              <button (click)="descartarPropuestas.emit()" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Descartar</button>
              <button (click)="confirmarPropuestas()" [disabled]="propuestasIncluidas() === 0 || guardandoPropuestas"
                class="flex-[2] py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold transition-colors">
                {{ guardandoPropuestas ? 'Guardando…' : 'Guardar ' + propuestasIncluidas() + ' manzanas' }}
              </button>
            </div>
          </div>
        }

        @if (aviso()) {
          <div class="absolute top-16 left-1/2 -translate-x-1/2 z-36 w-[min(92%,460px)] flex items-start gap-2 bg-amber-50 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-700/60 rounded-xl px-3 py-2.5 shadow-lg">
            <svg class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <p class="flex-1 text-sm font-semibold text-amber-800 dark:text-amber-200 leading-snug">{{ aviso() }}</p>
            <button (click)="aviso.set(null)" class="text-amber-700 dark:text-amber-300 text-sm font-bold px-1" title="Cerrar aviso">✕</button>
          </div>
        }

        <!-- ── BOTTOM RIGHT: Action buttons ── -->
        <div class="absolute bottom-3 right-3 z-30 flex flex-col items-end gap-2">
          @if (!showClearConfirm()) {
            @if (drawingActive() && panelExterno) {
              <button
                (click)="map?.pm?.disableDraw()"
                title="Cancelar el dibujo (Esc)"
                class="gac-float flex items-center justify-center gap-2 min-w-9 px-3 sm:px-4 h-10 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 transition-colors active:scale-[0.97]"
              >Cancelar dibujo</button>
            }
            @if (drawingActive()) {
              <button
                (click)="undoLastVertex()"
                title="Deshacer último vértice (Ctrl+Z)"
                class="gac-float flex items-center justify-center gap-2 min-w-9 px-2.5 sm:px-3.5 h-9 rounded-xl text-[13px] font-bold text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-colors active:scale-[0.97]"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-4.51"></path></svg>
                <span class="hidden sm:inline">Deshacer</span>
              </button>
            }
            @if (layerMode() === 'territorio' && !soloLimite && !panelExterno) {
              <button
                (click)="showClearConfirm.set(true)"
                title="Limpiar todos los trazos del territorio"
                class="gac-float flex items-center justify-center gap-2 min-w-9 px-2.5 sm:px-3.5 h-9 rounded-xl text-[13px] font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors active:scale-[0.97]"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>
                <span class="hidden sm:inline">Limpiar territorio</span>
              </button>
            }
          } @else {
            <div class="gac-float flex items-center gap-2 rounded-xl pl-3 pr-1.5 h-10 !border-red-200 dark:!border-red-800/60">
              <svg class="w-3.5 h-3.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              <span class="text-[13px] font-bold text-slate-700 dark:text-slate-200 mr-1">¿Borrar el límite dibujado?</span>
              <button (click)="clearAll()" class="px-3 h-7 text-xs font-bold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">Sí, borrar</button>
              <button (click)="showClearConfirm.set(false)" class="px-3 h-7 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">No</button>
            </div>
          }
        </div>

        <!-- ── Panel externo: terminar de ajustar una figura ── -->
        @if (panelExterno && (editandoForma() || editMode())) {
          <div class="absolute top-16 left-1/2 -translate-x-1/2 z-36 w-[min(94%,520px)] gac-float rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3">
            <p class="flex-1 min-w-[180px] text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
              {{ editandoForma() && editTipo === 'punto' ? 'Arrastre el punto al lugar correcto.' : 'Arrastre las esquinas para corregir la forma.' }}
            </p>
            <div class="flex gap-2">
              @if (editandoForma()) {
                <button (click)="terminarEdicion(false)" class="px-4 h-10 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.97]">Cancelar</button>
                <button (click)="terminarEdicion(true)" class="px-5 h-10 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors active:scale-[0.97]">Listo, guardar</button>
              } @else {
                <button (click)="map?.pm?.disableGlobalEditMode()" class="px-5 h-10 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors active:scale-[0.97]">Listo</button>
              }
            </div>
          </div>
        }

        <!-- ── Geolocation error toast ── -->
        @if (geolocateError()) {
          <div class="absolute top-16 right-3 z-30 flex items-center gap-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-xl px-3 py-2 shadow-md">
            <svg class="w-3.5 h-3.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span class="text-xs font-semibold text-red-600 dark:text-red-400">{{ geolocateError() }}</span>
          </div>
        }

        <!-- ── Modo Punto: cursor hint ── -->
        @if ((panelExterno ? colocandoPunto() : layerMode() === 'punto') && !showPuntoPrompt()) {
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-29 pointer-events-none">
            <div class="flex items-center gap-2 bg-rose-600/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow-lg">
              <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span class="text-xs font-bold text-white">Clic en el mapa para colocar un punto</span>
            </div>
          </div>
        }

        <!-- ── Prompt: Número de manzana ── -->
        @if (showManzanaPrompt()) {
          <div class="absolute inset-0 z-40 flex items-center justify-center">
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-72 shadow-2xl overflow-hidden">
              <div class="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-blue-50/50 dark:bg-blue-900/20">
                <h4 class="text-sm font-black text-slate-800 dark:text-white">Número de manzana</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ya va el siguiente número; cámbielo si hace falta</p>
              </div>
              <div class="p-4">
                <input
                  #manzanaInput
                  type="text"
                  [(ngModel)]="pendingManzanaNumero"
                  [attr.aria-invalid]="!!avisoNumeroManzana()"
                  [attr.aria-describedby]="avisoNumeroManzana() ? 'avisoNumeroManzana' : null"
                  placeholder="Ej: 1, 2, A, 10B..."
                  (keydown.enter)="confirmManzana()"
                  (keydown.escape)="cancelManzana()"
                  (focus)="$any($event.target).select()"
                  class="w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:ring-2 transition-all"
                  [class]="avisoNumeroManzana() ? 'border-red-400 focus:ring-red-500' : 'border-slate-300 dark:border-slate-600 focus:ring-blue-500'"
                  autofocus
                />
                @if (avisoNumeroManzana(); as aviso) {
                  <div id="avisoNumeroManzana" class="mt-3 space-y-2" role="alert">
                    <p class="text-xs font-semibold text-red-700 dark:text-red-300">{{ aviso }}</p>
                    <p class="text-xs text-slate-600 dark:text-slate-300">Su dibujo no se pierde. Elija cómo seguir:</p>
                    <button type="button" (click)="confirmManzana(true)"
                            class="w-full text-left rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 transition-colors active:scale-[0.98]">
                      <span class="block text-xs font-bold">Guardar y renumerar todo en orden</span>
                      <span class="block text-xs font-normal opacity-90 mt-0.5">La manzana queda en su lugar y las demás se corren solas.</span>
                    </button>
                    <button type="button" (click)="usarNumeroSugerido()"
                            class="w-full text-left rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2.5 transition-colors active:scale-[0.98]">
                      <span class="block text-xs font-bold text-slate-800 dark:text-slate-100">Usar el {{ numeroSugeridoManzana() }}</span>
                      <span class="block text-xs font-normal text-slate-500 dark:text-slate-400 mt-0.5">Las demás no cambian.</span>
                    </button>
                  </div>
                }
              </div>
              <div class="p-4 pt-0 flex gap-2">
                <button (click)="cancelManzana()" class="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
                <button (click)="confirmManzana()" [disabled]="!pendingManzanaNumero || !!avisoNumeroManzana()" class="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors disabled:opacity-50">Guardar manzana</button>
              </div>
            </div>
          </div>
        }

        <!-- ── Prompt: Datos del punto ── -->
        @if (showPuntoPrompt()) {
          <div class="absolute inset-0 z-40 flex items-center justify-center">
            <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-72 shadow-2xl overflow-hidden">
              <div class="p-4 border-b border-slate-100 dark:border-slate-700/50 bg-rose-50/50 dark:bg-rose-900/20">
                <h4 class="text-sm font-black text-slate-800 dark:text-white">Nuevo punto</h4>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Describe este lugar en el mapa</p>
              </div>
              <div class="p-4 space-y-3">
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre *</label>
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
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tipo</label>
                  <app-select-picker colorScheme="rose" ariaLabel="Tipo de punto" [(ngModel)]="pendingPuntoTipo"
                    [options]="opcionesTipoPunto" [clearable]="false" [searchable]="false" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notas (opcional)</label>
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
    :host ::ng-deep .gac-ref-label {
      background: rgba(255,255,255,0.85); border: 1px solid #cbd5e1; box-shadow: none;
      color: #475569; font: 700 12px system-ui, sans-serif; padding: 1px 6px;
    }
    :host ::ng-deep .gac-ref-label::before { display: none; }

    /* Mapa general: código sobre cada territorio y ficha al pasar el cursor */
    :host ::ng-deep .gac-terr-code {
      background: rgba(255,255,255,0.92); border: 0; border-radius: 6px; padding: 1px 6px;
      color: #0f172a; font: 800 11px/16px system-ui, sans-serif; letter-spacing: 0.02em;
      box-shadow: 0 1px 3px rgba(15,23,42,0.25); pointer-events: none;
    }
    :host ::ng-deep .gac-terr-code::before { display: none; }
    :host ::ng-deep .gac-tt-wrap {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px;
      box-shadow: 0 10px 28px -8px rgba(15,23,42,0.35); font-family: system-ui, sans-serif;
    }
    :host ::ng-deep .gac-tt-wrap::before { display: none; }
    :host ::ng-deep .gac-tt { min-width: 170px; }
    :host ::ng-deep .gac-tt__top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
    :host ::ng-deep .gac-tt__top strong { font-size: 15px; color: #0f172a; font-weight: 800; }
    :host ::ng-deep .gac-tt__estado { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
    :host ::ng-deep .gac-tt__estado--ok { background: #ecfdf5; color: #047857; }
    :host ::ng-deep .gac-tt__estado--asig { background: #f5f3ff; color: #6d28d9; }
    :host ::ng-deep .gac-tt__estado--pausa { background: #f1f5f9; color: #475569; }
    :host ::ng-deep .gac-tt__nombre { margin-top: 4px; font-size: 13px; color: #475569; font-weight: 500; }
    :host ::ng-deep .gac-tt__cta { margin-top: 8px; padding-top: 7px; border-top: 1px solid #f1f5f9; font-size: 11px; color: #94a3b8; font-weight: 600; }
    :host-context(.dark) ::ng-deep .gac-tt-wrap { background: #1e293b; border-color: #334155; }
    :host-context(.dark) ::ng-deep .gac-tt__top strong { color: #f8fafc; }
    :host-context(.dark) ::ng-deep .gac-tt__nombre { color: #cbd5e1; }
    :host-context(.dark) ::ng-deep .gac-tt__cta { border-top-color: #334155; color: #94a3b8; }
    :host-context(.dark) ::ng-deep .gac-tt__estado--ok { background: rgba(16,185,129,0.15); color: #6ee7b7; }
    :host-context(.dark) ::ng-deep .gac-tt__estado--asig { background: rgba(139,92,246,0.18); color: #c4b5fd; }
    :host-context(.dark) ::ng-deep .gac-tt__estado--pausa { background: rgba(148,163,184,0.15); color: #cbd5e1; }

    /* Superficie de los controles que flotan sobre el mapa */
    .gac-float {
      background: rgba(255,255,255,0.94);
      border: 1px solid rgb(226 232 240);
      box-shadow: 0 1px 2px rgba(15,23,42,0.06), 0 6px 16px -4px rgba(15,23,42,0.14);
      backdrop-filter: blur(8px);
    }
    :host-context(.dark) .gac-float {
      background: rgba(30,41,59,0.92);
      border-color: rgb(51 65 85);
      box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 8px 20px -6px rgba(0,0,0,0.5);
    }

    /* Zoom y herramientas de dibujo con el mismo lenguaje */
    :host ::ng-deep .leaflet-top .leaflet-control { margin-top: 12px; }
    :host ::ng-deep .leaflet-left .leaflet-control { margin-left: 12px; }
    :host ::ng-deep .leaflet-bar {
      border: 1px solid rgb(226 232 240) !important;
      border-radius: 12px;
      background: rgba(255,255,255,0.96);
      box-shadow: 0 1px 2px rgba(15,23,42,0.06), 0 6px 16px -4px rgba(15,23,42,0.14);
    }
    :host ::ng-deep .leaflet-bar a,
    :host ::ng-deep .leaflet-pm-toolbar .button-container a.leaflet-buttons-control-button {
      width: 36px; height: 36px; line-height: 36px;
      background-color: transparent;
      border-bottom: 1px solid rgb(241 245 249);
      color: rgb(51 65 85); font-size: 18px;
      transition: background-color 120ms ease-out;
    }
    :host ::ng-deep .leaflet-bar a:first-child,
    :host ::ng-deep .leaflet-pm-toolbar .button-container:first-child a.leaflet-buttons-control-button { border-radius: 11px 11px 0 0; }
    :host ::ng-deep .leaflet-bar a:last-child,
    :host ::ng-deep .leaflet-pm-toolbar .button-container:last-child a.leaflet-buttons-control-button { border-radius: 0 0 11px 11px; border-bottom: none; }
    :host ::ng-deep .leaflet-bar a:hover,
    :host ::ng-deep .leaflet-buttons-control-button:hover { background-color: rgb(248 250 252); }
    :host ::ng-deep .leaflet-pm-toolbar .leaflet-buttons-control-button { padding: 8px; }
    :host ::ng-deep .leaflet-pm-toolbar .control-icon { opacity: 0.85; }
    /* El ícono de polígono de Geoman no se lee como lápiz; la ayuda lo nombra así. */
    :host ::ng-deep .leaflet-pm-toolbar .leaflet-pm-icon-polygon {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 20h9'/%3E%3Cpath d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z'/%3E%3C/svg%3E");
      background-size: 22px 22px;
    }
    :host ::ng-deep .active > .leaflet-buttons-control-button {
      box-shadow: inset 3px 0 0 #7c3aed;
      background-color: rgb(245 243 255) !important;
    }
    :host ::ng-deep .active > .leaflet-buttons-control-button .control-icon { opacity: 1; }
    :host ::ng-deep .button-container .leaflet-pm-actions-container { margin-left: 8px; top: 2px; }
    :host ::ng-deep .button-container .leaflet-pm-actions-container .leaflet-pm-action {
      height: 32px; line-height: 32px; padding: 0 12px;
      background-color: rgb(15 23 42); color: #fff;
      font-family: inherit; font-size: 13px; font-weight: 600; border-right: 1px solid rgba(255,255,255,0.12);
    }
    :host ::ng-deep .button-container .leaflet-pm-actions-container .leaflet-pm-action:first-child { border-radius: 10px 0 0 10px; }
    :host ::ng-deep .button-container .leaflet-pm-actions-container .leaflet-pm-action:last-child { border-radius: 0 10px 10px 0; border-right: 0; }
    :host ::ng-deep .button-container .leaflet-pm-actions-container .leaflet-pm-action:only-child { border-radius: 10px; }
    :host ::ng-deep .button-container .leaflet-pm-actions-container .leaflet-pm-action:hover { background-color: rgb(51 65 85); }

    :host-context(.dark) ::ng-deep .leaflet-bar {
      border-color: rgb(51 65 85) !important;
      background: rgba(30,41,59,0.94);
      box-shadow: 0 1px 2px rgba(0,0,0,0.3), 0 8px 20px -6px rgba(0,0,0,0.5);
    }
    :host-context(.dark) ::ng-deep .leaflet-bar a,
    :host-context(.dark) ::ng-deep .leaflet-pm-toolbar .button-container a.leaflet-buttons-control-button {
      color: rgb(226 232 240); border-bottom-color: rgb(51 65 85);
    }
    :host-context(.dark) ::ng-deep .leaflet-bar a:hover,
    :host-context(.dark) ::ng-deep .leaflet-buttons-control-button:hover { background-color: rgba(51,65,85,0.7); }
    :host-context(.dark) ::ng-deep .leaflet-pm-toolbar .control-icon { filter: invert(1) brightness(1.6); }
    :host-context(.dark) ::ng-deep .active > .leaflet-buttons-control-button { background-color: rgba(124,58,237,0.22) !important; box-shadow: inset 3px 0 0 #a78bfa; }
    :host-context(.dark) ::ng-deep .leaflet-buttons-control-button.pm-disabled { background-color: rgba(51,65,85,0.5); }
    :host-context(.dark) ::ng-deep .button-container .leaflet-pm-actions-container .leaflet-pm-action { background-color: rgb(241 245 249); color: rgb(15 23 42); border-right-color: rgb(203 213 225); }
    :host-context(.dark) ::ng-deep .button-container .leaflet-pm-actions-container .leaflet-pm-action:hover { background-color: #fff; }

    @media (prefers-reduced-motion: reduce) {
      :host ::ng-deep .leaflet-bar a, :host button { transition: none !important; }
    }
  `],
})
export class TerritorioMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  @Input() geojson: GeoJSONFeatureCollection | null = null;
  @Input() manzanasGeojson: GeoJSONFeatureCollection | null = null;
  @Input() puntosGeojson: GeoJSONFeatureCollection | null = null;
  /**
   * Mapa general: encuadra el territorio completo de la congregación (su límite y
   * las tarjetas), no solo las tarjetas. Desactivado, encuadra solo las tarjetas
   * (p. ej. al filtrar por barrio).
   */
  @Input() encuadrarCongregacion = false;
  @Input() height = '300px';
  @Input() selectedId: number | null = null;
  @Input() interactive = true;
  @Input() showPopups = false;
  @Input() enableDrawing = false;
  /** Dibujar un solo polígono (sectores): sin los pasos de manzanas y puntos. */
  @Input() soloLimite = false;
  /**
   * El editor lo maneja un panel lateral (con botones de texto): el mapa no pinta la barra de
   * herramientas ni los pasos, y expone seleccionar / ajustar / borrar para ese panel.
   */
  @Input() panelExterno = false;
  /** Con `soloLimite`: color con el que se dibuja y se ve la zona (el del barrio). */
  @Input() set colorForma(v: string | null) {
    this._colorForma = v;
    this.aplicarColorForma();
  }
  private _colorForma: string | null = null;
  /** Los demás territorios de la congregación: se ven en gris y sirven de imán al dibujar. */
  @Input() referenciasGeojson: GeoJSONFeatureCollection | null = null;
  /** Límite de la congregación en edición: se pinta aparte, con los vértices movibles. */
  @Input() limiteEdicion: GeoJSONGeometry | null = null;
  /** Dónde abrir el mapa si el territorio aún no tiene límite (el salón). */
  @Input() centroInicial: { lat: number; lng: number } | null = null;
  /** Manzanas propuestas por la detección, pendientes de revisar. */
  /** Territorio que se edita: para pedir al servidor calles y cuadras de su zona. */
  @Input() idTerritorio: number | null = null;
  /** Números ya usados en la congregación y el que sigue (secuencia continua entre tarjetas). */
  @Input() numeracion: NumeracionManzanas | null = null;
  /** Números que acabo de guardar y que `numeracion` aún no refleja (dibujo continuo). */
  private recienGuardados: string[] = [];
  @Input() propuestasGeojson: GeoJSONFeatureCollection | null = null;
  @Input() detectando = false;
  @Input() guardandoPropuestas = false;
  @Input() set avisoEditor(v: string | null) { this.aviso.set(v); }

  @Output() featureClick = new EventEmitter<any>();
  /** Geometría resultante cada vez que se mueve un vértice del límite en edición. */
  @Output() limiteEditado = new EventEmitter<GeoJSONGeometry>();
  @Output() geometryChanged = new EventEmitter<GeoJSONFeatureCollection>();
  /** Emite { geojson: GeoJSON Polygon, numero: string } cuando se confirma una manzana dibujada */
  @Output() manzanaDrawn = new EventEmitter<{ geojson: any; numero: string; renumerarTodo?: boolean }>();
  /** Emite datos del punto cuando se confirma su creación */
  @Output() puntoPlaced = new EventEmitter<{ geojson: any; nombre: string; tipo: string; notas: string }>();
  /** Calles visibles (MultiLineString) con las que el padre pide las manzanas propuestas. */
  @Output() detectar = new EventEmitter<any>();
  @Output() guardarPropuestas = new EventEmitter<any[]>();
  @Output() descartarPropuestas = new EventEmitter<void>();
  @Output() manzanaBorrar = new EventEmitter<number>();
  /** Con `panelExterno`: nueva forma de una manzana ya guardada. */
  @Output() manzanaForma = new EventEmitter<{ id: number; geojson: any }>();
  /** Con `panelExterno`: nuevo lugar de un punto ya guardado. */
  @Output() puntoMovido = new EventEmitter<{ id: number; geojson: any }>();

  /** Público: la plantilla cancela el dibujo y la edición directamente. */
  map: L.Map | null = null;
  private redimensionador: ResizeObserver | null = null;
  private geoLayer: L.GeoJSON | null = null;
  private manzanasLayer: L.LayerGroup | null = null;
  private puntosLayer: L.LayerGroup | null = null;
  private referenciasLayer: L.GeoJSON | null = null;
  private limiteEdicionLayer: L.GeoJSON | null = null;
  private propuestasLayer: L.LayerGroup | null = null;
  /** Por propuesta: su polígono y su etiqueta, para renumerar al quitar o incluir. */
  private numerosPropuestos: number[] = [];
  private propuestasCapas: { id: number; feature: any; poligono: L.GeoJSON; etiqueta: L.Marker }[] = [];
  /** La vista inicial (salón o territorios vecinos) se aplica una sola vez. */
  private vistaInicialAplicada = false;
  /** Con `encuadrarCongregacion`: el límite llegó después de las tarjetas y ya se reencuadró. */
  private congregacionEncuadrada = false;
  private ultimaFormaManzana: string | null = null;
  private tileProvider = 'osm';
  private tileLayer: L.Layer | null = null;
  /** Cada cambio de proveedor invalida los anteriores: la capa propia se carga de forma asíncrona. */
  private tileLayerToken = 0;
  private geolocateMarker: L.Marker | null = null;
  private keydownListener: ((e: KeyboardEvent) => void) | null = null;
  private geolocateErrorTimer: ReturnType<typeof setTimeout> | null = null;
  private mapClickHandler: ((e: L.LeafletMouseEvent) => void) | null = null;

  // ── Pending layers for prompts ─────────────────────────────────────────
  private pendingManzanaLayerObj: any = null;
  private pendingPuntoLatLng: L.LatLng | null = null;
  private pendingPuntoMarker: L.Marker | null = null;

  // ── Signals ────────────────────────────────────────────────────────────
  readonly opcionesTipoPunto: PickerOption[] = [
    { value: 'Salida', label: 'Salida' },
    { value: 'Lugar', label: 'Lugar de interés' },
    { value: 'Otro', label: 'Otro' },
  ];
  layerMode = signal<LayerMode>('territorio');
  readonly pasos: { modo: LayerMode; n: number; label: string; titulo: string; activo: string }[] = [
    { modo: 'territorio', n: 1, label: 'Límite',   titulo: 'Dibujar el límite del territorio',      activo: 'bg-purple-600 text-white shadow-sm shadow-purple-900/20' },
    { modo: 'manzana',    n: 2, label: 'Manzanas', titulo: 'Dibujar las manzanas (cuadras)',        activo: 'bg-blue-600 text-white shadow-sm shadow-blue-900/20' },
    { modo: 'punto',      n: 3, label: 'Puntos',   titulo: 'Marcar el punto de salida u otro lugar', activo: 'bg-rose-600 text-white shadow-sm shadow-rose-900/20' },
  ];
  activeToolHint = signal(Hint.limite);
  drawingActive = signal(false);
  /** Con `soloLimite`: esquinas ya puestas en el dibujo que está en curso. */
  puntosColocados = signal(0);
  /** Con `soloLimite`: hay un cambio de la zona que se puede deshacer. */
  puedeDeshacerZona = signal(false);
  /** Teclas del atajo para mostrarlo en los botones (⌘Z en Mac, Ctrl+Z en el resto). */
  readonly atajoDeshacer = /Mac|iPhone|iPad/i.test(typeof navigator !== 'undefined' ? navigator.platform : '') ? '⌘Z' : 'Ctrl+Z';
  private historialZona: (GeoJSONGeometry | null)[] = [];
  private zonaActual: GeoJSONGeometry | null = null;
  private restaurandoZona = false;
  /** Con `soloLimite`: se están moviendo las esquinas de la zona ya dibujada. */
  editMode = signal(false);
  realtimeArea = signal<string | null>(null);
  showClearConfirm = signal(false);
  geolocating = signal(false);
  geolocateError = signal<string | null>(null);
  geocodeResults = signal<any[]>([]);
  geocodeLoading = signal(false);
  geocodeError = signal<string | null>(null);
  aviso = signal<string | null>(null);
  extrayendo = signal(false);
  propuestasTotal = signal(0);
  propuestasExcluidas = signal<Set<number>>(new Set());
  propuestasActivas = computed(() => this.propuestasTotal() > 0);
  propuestasIncluidas = computed(() => this.propuestasTotal() - this.propuestasExcluidas().size);

  // ── Manzana prompt ─────────────────────────────────────────────────────
  showManzanaPrompt = signal(false);
  pendingManzanaNumero = '';

  // ── Punto prompt ───────────────────────────────────────────────────────
  showPuntoPrompt = signal(false);
  pendingPuntoNombre = '';
  pendingPuntoTipo = 'Salida';
  pendingPuntoNotas = '';

  geocodeQueryStr = '';

  // ── Panel externo: selección y ajuste de figuras ───────────────────────
  seleccion = signal<{ tipo: 'manzana' | 'punto'; id: number } | null>(null);
  /** Se está corrigiendo la forma de una manzana o el lugar de un punto. */
  editandoForma = signal(false);
  /** Hay que confirmar el borrado de la figura seleccionada. */
  borrando = signal(false);
  /** El próximo clic en el mapa pone un punto nuevo. */
  colocandoPunto = signal(false);
  /** Hay un límite dibujado (para ofrecer "Ajustar" en vez de "Dibujar"). */
  tieneLimite = signal(false);
  editTipo: 'manzana' | 'punto' | null = null;
  private manzanaCapas = new Map<number, L.GeoJSON>();
  private manzanaProps = new Map<number, any>();
  private puntoMarcas = new Map<number, L.Marker>();
  private anilloPunto: L.CircleMarker | null = null;
  private formaTemporal: L.Polygon | null = null;
  private puntoOriginal: L.LatLng | null = null;

  // ── Límite por cuadras e imán a las calles ─────────────────────────────
  eligiendoCuadras = signal(false);
  cuadrasCargando = signal(false);
  cuadrasElegidas = signal(0);
  /** Se movió el mapa después de buscar: se ofrece «Buscar cuadras aquí». */
  cuadrasDesactualizadas = signal(false);
  private cuadrasLayer: L.LayerGroup | null = null;
  private cuadrasCapas: { geometry: any; elegida: boolean; bloqueada: boolean; capa: L.GeoJSON }[] = [];
  private cuadrasMoverHandler: (() => void) | null = null;
  private imanLayer: L.LayerGroup | null = null;
  private imanToken = 0;
  private renumeracionPrevia: Map<number, string> | null = null;

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
    // El servidor ya devolvió la lista al día: los recién guardados ahora aparecen en ella.
    if (changes['numeracion']) this.recienGuardados = [];
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
    if (changes['referenciasGeojson'] && this.map) {
      this.renderReferencias();
    }
    if (changes['propuestasGeojson'] && this.map) {
      this.renderPropuestas();
    }
    if (changes['limiteEdicion'] && this.map) {
      this.renderLimiteEdicion();
    }
    if (changes['centroInicial'] && this.map) {
      this.aplicarVistaInicial();
    }
  }

  ngOnDestroy(): void {
    if (this.keydownListener) {
      document.removeEventListener('keydown', this.keydownListener);
    }
    if (this.geolocateErrorTimer) clearTimeout(this.geolocateErrorTimer);
    this.redimensionador?.disconnect();
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

    // El fondo lo pone loadTileProvider() (y cae a OSM si falla): añadir OSM aquí pediría teselas
    // que se descartan enseguida cuando el proveedor configurado es otro.

    // Los números de manzana van en su propia capa: lejos se amontonan y tapan el mapa.
    this.map.createPane('etiquetasManzana').style.zIndex = '640';
    this.map.on('zoomend', () => this.ajustarEtiquetasManzana());

    if (this.geojson) this.renderGeoJSON();
    if (this.manzanasGeojson) this.renderManzanasLayer();
    if (this.puntosGeojson) this.renderPuntosLayer();
    if (this.referenciasGeojson) this.renderReferencias();
    this.aplicarVistaInicial();

    if (this.enableDrawing) {
      this.initDrawingControls();
    }
    if (this.panelExterno && typeof ResizeObserver !== 'undefined') {
      // El panel lateral se pliega y despliega: el mapa debe ocupar el espacio que queda.
      this.redimensionador = new ResizeObserver(() => this.map?.invalidateSize());
      this.redimensionador.observe(this.mapContainer.nativeElement);
    }
  }

  /**
   * Sin límite dibujado, el mapa no debe abrir en Bogotá: se encuadran los
   * territorios vecinos o, si es el primero, el salón de la congregación.
   */
  private aplicarVistaInicial(): void {
    if (!this.map || this.vistaInicialAplicada) return;
    if (this.geojson?.features?.length) {
      this.vistaInicialAplicada = true; // renderGeoJSON ya encuadró el territorio
      return;
    }
    const vecinos = this.referenciasLayer?.getBounds();
    if (vecinos?.isValid()) {
      this.map.fitBounds(vecinos, { padding: [30, 30] });
      this.vistaInicialAplicada = true;
    } else if (this.centroInicial) {
      this.map.setView([this.centroInicial.lat, this.centroInicial.lng], 16);
      this.vistaInicialAplicada = true;
    }
  }

  // ── Layer Mode ─────────────────────────────────────────────────────────

  setLayerMode(mode: LayerMode): void {
    if (this.panelExterno && this.layerMode() !== mode) {
      if (this.eligiendoCuadras()) this.cancelarCuadras();
      this.terminarEdicion(false);
      this.map?.pm?.disableDraw();
      this.seleccion.set(null);
      this.borrando.set(false);
      this.aplicarSeleccion();
    }
    this.layerMode.set(mode);
    this.colocandoPunto.set(false);

    // Cancel any pending prompts
    this.cancelManzana();
    this.cancelPunto();

    // Remove point-mode click handler
    if (this.mapClickHandler && this.map) {
      this.map.off('click', this.mapClickHandler as any);
      this.mapClickHandler = null;
    }

    if (!this.map) return;

    if (this.panelExterno) {
      this.activeToolHint.set(mode === 'territorio' ? this.hint('limite') : mode === 'manzana' ? this.hint('manzanas')
        : 'Toque un punto para elegirlo, o use «Poner un punto» en el panel.');
      if (mode === 'manzana') this.manzanasAlFrente();
      return;
    }

    if (mode === 'territorio') {
      this.activeToolHint.set(Hint.limite);
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
      this.activeToolHint.set(Hint.manzanas);
      this.manzanasAlFrente();
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
      this.activeToolHint.set('Haga clic en el mapa donde se reúnen para salir (o en otro lugar de referencia).');
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
        // La ayuda dice "doble clic para terminar": sin esto solo cierra tocando el primer vértice.
        finishOn: 'dblclick',
      });

      // En modo barrio no hay barra de herramientas: el panel de al lado dibuja, ajusta y borra.
      if (!this.soloLimite && !this.panelExterno) {
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
      }
      this.aplicarColorForma();
      if (this.panelExterno) {
        this.activeToolHint.set(this.hint('limite'));
        // Tocar un lugar vacío quita la selección.
        this.map.on('click', () => {
          if (this.drawingActive() || this.editandoForma() || this.editMode() || this.colocandoPunto()) return;
          if (this.seleccion()) { this.seleccion.set(null); this.borrando.set(false); this.aplicarSeleccion(); }
        });
      }

      // ── Drawing lifecycle events ─────────────────────────────────────

      this.map.on('pm:drawstart', (e: any) => {
        this.drawingActive.set(true);
        this.puntosColocados.set(0);
        this.realtimeArea.set(null);
        const shape = e.shape;
        if (shape === 'Polygon') {
          const mode = this.layerMode();
          if (mode === 'manzana') {
            this.activeToolHint.set('Clic en cada esquina de la manzana · Doble clic para terminar · Esc para salir');
          } else {
            this.activeToolHint.set('Clic en cada esquina del territorio · Doble clic para terminar · Esc para salir');
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
        // Con el dibujo continuo de manzanas la herramienta se vuelve a abrir enseguida; el imán se queda.
        setTimeout(() => { if (!this.drawingActive()) this.quitarImanCalles(); }, 0);
        this.puntosColocados.set(0);
        if (this.showManzanaPrompt()) return; // la ayuda la pone el aviso del número
        this.activeToolHint.set(this.layerMode() === 'manzana' ? this.hint('manzanas') : this.hint('limite'));
      });

      this.map.on('pm:create', (e: any) => {
        this.drawingActive.set(false);
        const mode = this.layerMode();

        if (mode === 'manzana') {
          // Store the layer and show number prompt — don't emit geometryChanged
          this.pendingManzanaLayerObj = e.layer;
          this.ultimaFormaManzana = e.shape;
          this.pendingManzanaNumero = this.sugerirNumeroManzana();
          this.showManzanaPrompt.set(true);
          this.activeToolHint.set('Ingresa el número para esta manzana.');
        } else {
          // Un barrio es una sola zona: la nueva reemplaza a la anterior.
          if (this.soloLimite) {
            this.capasDelLimite().filter((l: any) => l !== e.layer).forEach((l) => this.map!.removeLayer(l));
          }
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
        this.contarPuntos(e.workingLayer);
        this.updateRealtimeArea(e.workingLayer);
      });

      this.map.on('pm:globaleditmodetoggled', (e: any) => {
        this.editMode.set(!!e.enabled);
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

      // Sin zona todavía, se deja la herramienta lista: no hay que buscar ningún lápiz.
      if (this.soloLimite && this.capasDelLimite().length === 0) {
        setTimeout(() => this.empezarDibujo());
      }

    } catch (err) {
      console.error('Error inicializando controles Geoman:', err);
    }
  }

  // ── Manzana prompt ─────────────────────────────────────────────────────

  /** `renumerarTodo`: guarda el dibujo aunque el número esté repetido y renumera toda la secuencia. */
  confirmManzana(renumerarTodo = false): void {
    if (!this.pendingManzanaNumero?.trim() || !this.pendingManzanaLayerObj || !this.map) return;
    if (!renumerarTodo && this.avisoNumeroManzana()) return;
    const geojson = this.pendingManzanaLayerObj.toGeoJSON();
    const numero = renumerarTodo ? this.numeroSugeridoManzana() : this.pendingManzanaNumero.trim();
    // Con renumerar todo, los números cambian en el servidor: no hay recién guardado que recordar.
    if (!renumerarTodo) this.recienGuardados.push(numero);
    this.manzanaDrawn.emit({ geojson, numero, renumerarTodo });
    // Remove the temporary layer — parent will reload manzanasGeojson
    this.map.removeLayer(this.pendingManzanaLayerObj);
    this.pendingManzanaLayerObj = null;
    this.showManzanaPrompt.set(false);
    this.pendingManzanaNumero = '';
    // Dibujo continuo: la herramienta queda lista para la siguiente manzana (Esc para salir).
    if (this.ultimaFormaManzana) { this.map.pm.enableDraw(this.ultimaFormaManzana as any); void this.activarImanCalles(); }
    this.activeToolHint.set('Manzana guardada. Dibuje la siguiente · Esc para terminar');
  }

  /** El que sigue en la secuencia de la congregación (T01 1–4, T02 desde el 5…); nunca repite. */
  numeroSugeridoManzana(): string {
    if (this.numeracion) return String(siguienteLibre(this.numeracion, this.recienGuardados));
    // Sin la lista del servidor: el siguiente al mayor de lo que se ve en el mapa.
    const enteros = (this.manzanasGeojson?.features ?? [])
      .map((f: any) => String(f.properties?.numero_manzana ?? '').trim())
      .filter((n: string) => /^\d+$/.test(n)).map(Number);
    return String((enteros.length ? Math.max(...enteros) : 0) + 1);
  }

  /** Aviso si el número escrito ya existe; dice dónde y cuál seguiría. */
  avisoNumeroManzana(): string | null {
    return avisoNumeroRepetido(this.pendingManzanaNumero ?? '', this.numeracion, this.idTerritorio, undefined, this.recienGuardados);
  }

  usarNumeroSugerido(): void {
    this.pendingManzanaNumero = this.numeroSugeridoManzana();
  }

  private sugerirNumeroManzana(): string {
    return this.numeroSugeridoManzana();
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
    this.activeToolHint.set(this.panelExterno
      ? 'Punto guardado. Haga clic en otro lugar para añadir más, o pulse «Terminar» en el panel.'
      : 'Punto guardado. Haz clic en otro lugar para añadir más.');
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
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        // En un campo de texto, Ctrl+Z es de ese texto (p. ej. el nombre del barrio).
        const t = e.target as HTMLElement | null;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        if (this.drawingActive()) {
          e.preventDefault();
          this.undoLastVertex();
        } else if (this.soloLimite) {
          e.preventDefault();
          this.deshacerZona();
        } else {
          e.preventDefault();
        }
      }
      if (e.key === 'Escape') {
        if (this.showManzanaPrompt()) this.cancelManzana();
        if (this.showPuntoPrompt()) this.cancelPunto();
        if (this.drawingActive()) this.map?.pm.disableDraw();
        if (this.panelExterno) {
          if (this.editandoForma()) this.terminarEdicion(false);
          else if (this.colocandoPunto() && !this.showPuntoPrompt()) this.detenerPunto();
          else if (this.seleccion() && !this.drawingActive()) { this.seleccion.set(null); this.borrando.set(false); this.aplicarSeleccion(); }
        }
      }
      if (this.panelExterno && (e.key === 'Delete' || e.key === 'Supr') && this.seleccion() && !this.editandoForma()) {
        const t = e.target as HTMLElement | null;
        if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
        e.preventDefault();
        this.borrando.set(true);
      }
    };
    document.addEventListener('keydown', this.keydownListener);
  }

  // ── Undo last vertex ───────────────────────────────────────────────────

  undoLastVertex(): void {
    if (!this.map || !this.drawingActive()) return;
    try {
      const pm = (this.map as any).pm;
      const poligono = pm?.Draw?.Polygon;
      if (!poligono?._enabled) return;
      if ((poligono._markers?.length ?? 0) <= 1) {
        // Con un solo punto, Geoman cancela el dibujo; se vuelve a armar para seguir marcando.
        this.map.pm.disableDraw();
        this.map.pm.enableDraw('Polygon');
        return;
      }
      poligono._removeLastVertex();
      this.contarPuntos(poligono._layer);
      this.updateRealtimeArea(poligono._layer);
    } catch (e) {
      console.warn('No se pudo deshacer el vértice:', e);
    }
  }

  private contarPuntos(capa: any): void {
    const raw = capa?.getLatLngs?.();
    const puntos = Array.isArray(raw?.[0]) ? raw[0] : raw;
    this.puntosColocados.set(Array.isArray(puntos) ? puntos.length : 0);
  }

  /** Anota la zona para poder volver a ella; null = sin zona (p. ej. tras "Dibujar de nuevo"). */
  private registrarZona(fc: GeoJSONFeatureCollection): void {
    if (!this.soloLimite || this.restaurandoZona) return;
    const nueva = (fc.features.find(f => f.geometry?.type === 'Polygon')?.geometry ?? null) as GeoJSONGeometry | null;
    if (JSON.stringify(nueva) === JSON.stringify(this.zonaActual)) return;
    if (this.zonaActual) this.historialZona.push(this.zonaActual);
    if (this.historialZona.length > 30) this.historialZona.shift();
    this.zonaActual = nueva;
    this.puedeDeshacerZona.set(this.historialZona.length > 0);
  }

  /** Vuelve la zona al estado anterior: esquina movida, zona redibujada o borrada. */
  deshacerZona(): void {
    if (!this.map || !this.soloLimite || this.historialZona.length === 0) return;
    const previa = this.historialZona.pop()!;
    const edicionActiva = this.editMode();
    this.restaurandoZona = true;
    try {
      this.map.pm.disableGlobalEditMode();
      this.capasDelLimite().forEach((l) => this.map!.removeLayer(l));
      const c = this._colorForma;
      const estilo = c ? { color: c, fillColor: c, weight: 3, fillOpacity: 0.25 } : {};
      const capa = L.geoJSON({ type: 'Feature', properties: {}, geometry: previa } as any, { style: () => estilo }).addTo(this.map);
      capa.eachLayer((l: any) => {
        l.on('pm:edit', () => this.emitGeometryUpdate());
        l.on('pm:dragend', () => this.emitGeometryUpdate());
      });
      this.zonaActual = previa;
      this.emitGeometryUpdate();
      this.recalculateAreaFromAllLayers();
      if (edicionActiva) this.map.pm.enableGlobalEditMode();
    } finally {
      this.restaurandoZona = false;
    }
    this.puedeDeshacerZona.set(this.historialZona.length > 0);
  }

  // ── Modo barrio: el panel de al lado maneja el dibujo ──────────────────

  /** Empieza a marcar la zona: cada toque es una esquina, doble toque termina. */
  empezarDibujo(): void {
    if (!this.map?.pm) return;
    if (this.eligiendoCuadras()) this.cancelarCuadras();
    this.map.pm.disableGlobalEditMode();
    this.map.pm.enableDraw('Polygon');
    void this.activarImanCalles();
  }

  cancelarDibujo(): void {
    this.map?.pm?.disableDraw();
  }

  /** Activa o desactiva el arrastre de esquinas de la zona ya dibujada. */
  alternarEdicion(): void {
    this.map?.pm?.toggleGlobalEditMode();
  }

  /** Aplica el color del barrio a lo que se dibuje y a lo ya dibujado. */
  private aplicarColorForma(): void {
    const c = this._colorForma;
    if (!this.map || !this.soloLimite || !c) return;
    const estilo = { color: c, fillColor: c, weight: 3, fillOpacity: 0.25 };
    try { (this.map.pm as any).setGlobalOptions({ pathOptions: estilo }); } catch { /* sin Geoman */ }
    this.capasDelLimite().forEach((l: any) => l.setStyle?.(estilo));
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
    this.manzanaCapas.clear();
    this.manzanaProps.clear();
    this.prepararColoresAsignacion();
    if (this.formaTemporal) { this.map.removeLayer(this.formaTemporal); this.formaTemporal = null; }
    if (!this.manzanasGeojson?.features?.length) { this.sincronizarSeleccion(); return; }

    this.manzanasLayer = L.layerGroup().addTo(this.map);

    this.manzanasGeojson.features.forEach((feature: any) => {
      if (!feature.geometry) return;
      const props = feature.properties || {};
      const isPredicada = props.predicada === true;
      const numeroPrevio = feature.id != null ? this.renumeracionPrevia?.get(Number(feature.id)) : undefined;

      // Predicada: verde. Asignada: el color de la persona. Si no, gris.
      const colorAsig = this.colorAsignada(props);
      const strokeColor = isPredicada ? '#16a34a' : colorAsig ?? '#475569';
      const fillColor  = isPredicada ? '#bbf7d0' : colorAsig ? this.aclarar(colorAsig) : '#f1f5f9';
      const labelBg    = numeroPrevio ? '#d97706' : isPredicada ? '#16a34a' : colorAsig ?? '#475569';

      // Polygon fill
      const poly = L.geoJSON(feature, {
        ...CAPA_AUXILIAR,
        style: {
          color: strokeColor,
          weight: isPredicada || colorAsig ? 2.5 : 2,
          fillColor,
          fillOpacity: isPredicada ? 0.55 : colorAsig ? 0.55 : 0.40,
          opacity: 0.9,
          // Marcada por la IA: borde punteado hasta que alguien la revise.
          dashArray: props.origen === 'ia' ? '6 5' : undefined,
        },
        onEachFeature: (_f: any, capa: any) => { capa._capaAuxiliar = true; },
      } as any);
      // Al pasar el cursor: «Manzana 2 · Asignada a Gersain».
      if (props.asignada_a) {
        poly.bindTooltip(`Manzana ${props.numero_manzana ?? ''} · Asignada a ${props.asignada_a}`, { sticky: true, direction: 'top' });
      }
      if (this.panelExterno && feature.id != null) {
        this.manzanaCapas.set(Number(feature.id), poly);
        this.manzanaProps.set(Number(feature.id), props);
        poly.on('click', (ev: L.LeafletMouseEvent) => {
          // Poniendo un punto, la manzana es solo fondo: el clic sigue al mapa y ahí se coloca.
          if (this.colocandoPunto()) return;
          L.DomEvent.stopPropagation(ev);
          if (this.drawingActive() || this.editandoForma() || this.propuestasActivas()) return;
          this.seleccionar('manzana', Number(feature.id));
        });
      } else if (this.enableDrawing && feature.id != null) {
        poly.on('click', (ev: L.LeafletMouseEvent) => this.abrirMenuManzana(Number(feature.id), props.numero_manzana, ev.latlng));
      }
      poly.addTo(this.manzanasLayer!);

      // Centroid label with number
      const numero = numeroPrevio ?? props.numero_manzana;
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
            L.marker(centroid, { icon: labelIcon, interactive: false, pane: 'etiquetasManzana' }).addTo(this.manzanasLayer!);
          }
        } catch {}
      }
    });
    this.sincronizarSeleccion();
  }

  /** Tras recargar capas: si la figura elegida ya no existe se quita la selección; si no, se vuelve a resaltar. */
  private sincronizarSeleccion(): void {
    if (!this.panelExterno) return;
    const sel = this.seleccion();
    if (sel && ((sel.tipo === 'manzana' && !this.manzanaCapas.has(sel.id)) || (sel.tipo === 'punto' && !this.puntoMarcas.has(sel.id)))) {
      // Los puntos se recargan por separado: solo se descarta cuando su capa ya está dibujada.
      if (sel.tipo === 'manzana' || this.puntosLayer) { this.seleccion.set(null); this.borrando.set(false); }
    }
    this.aplicarSeleccion();
  }

  // ── Manzanas asignadas: un color por asignación ────────────────────────

  /** Colores que no se confunden con lo predicado (verde) ni con lo elegido (azul). */
  private static readonly COLORES_ASIGNACION = ['#7c3aed', '#ea580c', '#db2777', '#0891b2', '#a16207', '#4f46e5'];
  private coloresAsignacion = new Map<number, string>();
  /** Para la leyenda del mapa: quién tiene qué. Vacío si nada está asignado. */
  leyendaAsignadas = signal<{ color: string; nombre: string; texto: string }[]>([]);

  private prepararColoresAsignacion(): void {
    this.coloresAsignacion.clear();
    const porAsignacion = new Map<number, { nombre: string; completa: boolean; numeros: string[] }>();
    for (const f of this.manzanasGeojson?.features ?? []) {
      const p: any = (f as any).properties ?? {};
      if (p.id_asignacion == null) continue;
      const g = porAsignacion.get(p.id_asignacion) ?? { nombre: p.asignada_a as string, completa: !!p.asignacion_completa, numeros: [] as string[] };
      g.numeros.push(String(p.numero_manzana ?? ''));
      porAsignacion.set(p.id_asignacion, g);
    }
    const paleta = TerritorioMapComponent.COLORES_ASIGNACION;
    const ids = [...porAsignacion.keys()].sort((a, b) => a - b);
    ids.forEach((id, i) => this.coloresAsignacion.set(id, paleta[i % paleta.length]));
    const lista = (n: string[]) => n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
    this.leyendaAsignadas.set(ids.map((id) => {
      const g = porAsignacion.get(id)!;
      const nums = [...g.numeros].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
      return { color: this.coloresAsignacion.get(id)!, nombre: g.nombre, texto: g.completa ? 'Toda la tarjeta' : `${nums.length === 1 ? 'Manzana' : 'Manzanas'} ${lista(nums)}` };
    }));
  }

  private colorAsignada(props: any): string | null {
    return props?.id_asignacion != null ? this.coloresAsignacion.get(props.id_asignacion) ?? null : null;
  }

  /** Mezcla el color con blanco para el relleno del polígono. */
  private aclarar(hex: string): string {
    const n = parseInt(hex.slice(1), 16);
    const mezcla = (c: number) => Math.round(c + (255 - c) * 0.72);
    return `rgb(${mezcla(n >> 16)}, ${mezcla((n >> 8) & 255)}, ${mezcla(n & 255)})`;
  }

  /** En los mapas de consulta, los números solo se ven con el mapa cerca (en el editor, siempre). */
  private ajustarEtiquetasManzana(): void {
    const pane = this.map?.getPane('etiquetasManzana');
    if (!pane || !this.map) return;
    pane.style.display = this.enableDrawing || this.map.getZoom() >= 17 ? '' : 'none';
  }

  /** El límite dibujado después queda encima de las manzanas y se lleva los clics. */
  private manzanasAlFrente(): void {
    this.manzanasLayer?.eachLayer((capa: any) => capa.bringToFront?.());
    this.propuestasLayer?.eachLayer((capa: any) => capa.bringToFront?.());
  }

  /** Menú de una manzana guardada (capa Manzanas): por ahora, borrarla sin salir del editor. */
  private abrirMenuManzana(id: number, numero: string, latlng: L.LatLng): void {
    if (!this.map || this.layerMode() !== 'manzana' || this.drawingActive() || this.propuestasActivas()) return;
    const caja = document.createElement('div');
    caja.style.cssText = 'font-family:system-ui;min-width:150px';
    caja.innerHTML = `<p style="margin:0 0 8px;font-weight:800;font-size:14px;color:#1e293b">Manzana ${numero ?? ''}</p>`;
    const borrar = document.createElement('button');
    borrar.textContent = 'Borrar manzana';
    borrar.style.cssText = 'width:100%;padding:8px;border-radius:10px;background:#dc2626;color:#fff;font-weight:700;font-size:13px;border:0;cursor:pointer';
    borrar.onclick = () => { this.map?.closePopup(); this.manzanaBorrar.emit(id); };
    caja.appendChild(borrar);
    L.popup().setLatLng(latlng).setContent(caja).openOn(this.map);
  }

  // ── Territorios vecinos (referencia) ───────────────────────────────────

  private renderReferencias(): void {
    if (!this.map) return;
    if (this.referenciasLayer) {
      this.map.removeLayer(this.referenciasLayer);
      this.referenciasLayer = null;
    }
    if (!this.referenciasGeojson?.features?.length) return;
    this.referenciasLayer = L.geoJSON(this.referenciasGeojson as any, {
      ...CAPA_AUXILIAR,
      interactive: false,
      // Gris para las tarjetas vecinas; los sectores con su color y el límite de la congregación destacado.
      style: (f: any) => {
        const p = f?.properties ?? {};
        if (p.limite) return { color: '#0f766e', weight: 3, dashArray: '8 6', fillColor: '#14b8a6', fillOpacity: 0.05 };
        if (p.color && p.sel) return { color: p.color, weight: 4, fillColor: p.color, fillOpacity: 0.42 };
        if (p.color) return { color: p.color, weight: 2, fillColor: p.color, fillOpacity: 0.18 };
        return { color: '#64748b', weight: 1.5, dashArray: '5 5', fillColor: '#94a3b8', fillOpacity: 0.12 };
      },
      onEachFeature: (f: any, capa: any) => {
        capa._capaAuxiliar = true;
        if (f.properties?.codigo) {
          capa.bindTooltip(String(f.properties.codigo), { permanent: true, direction: 'center', className: 'gac-ref-label' });
        }
      },
    } as any).addTo(this.map);
    this.referenciasLayer.bringToBack();
    this.aplicarVistaInicial();
    if (this.encuadrarCongregacion && this.geoLayer && !this.congregacionEncuadrada) {
      const b = this.boundsParaEncuadrar();
      if (b?.isValid()) { this.map.fitBounds(b, { padding: [30, 30] }); this.congregacionEncuadrada = true; }
    }
  }

  /** Tarjetas y, con `encuadrarCongregacion`, también el límite de la congregación. */
  private boundsParaEncuadrar(): L.LatLngBounds | null {
    const bounds = this.geoLayer?.getBounds();
    if (!this.encuadrarCongregacion) return bounds ?? null;
    const todo = bounds?.isValid() ? L.latLngBounds(bounds.getSouthWest(), bounds.getNorthEast()) : L.latLngBounds([]);
    this.referenciasLayer?.eachLayer((l: any) => {
      if (l.feature?.properties?.limite) todo.extend(l.getBounds());
    });
    return todo;
  }

  private renderLimiteEdicion(): void {
    if (!this.map) return;
    if (this.limiteEdicionLayer) {
      this.limiteEdicionLayer.pm?.disable();
      this.map.removeLayer(this.limiteEdicionLayer);
      this.limiteEdicionLayer = null;
    }
    if (!this.limiteEdicion) return;
    const capa = L.geoJSON(this.limiteEdicion as any, {
      style: { color: '#0f766e', weight: 3, dashArray: '8 6', fillColor: '#14b8a6', fillOpacity: 0.08 },
    }).addTo(this.map);
    this.limiteEdicionLayer = capa;
    capa.eachLayer((l: any) => {
      l.pm.enable({ allowSelfIntersection: false, snappable: false });
      const emitir = () => this.limiteEditado.emit((capa.toGeoJSON() as any).features[0].geometry as GeoJSONGeometry);
      l.on('pm:edit', emitir);
      l.on('pm:vertexremoved', emitir);
    });
    const b = capa.getBounds();
    if (b.isValid()) this.map.fitBounds(b, { padding: [30, 30] });
  }

  /** Acerca el mapa a una de las referencias (p. ej. el barrio elegido en la lista). */
  encuadrarReferencia(id: string): void {
    if (!this.map) return;
    this.map.invalidateSize();
    let destino: L.LatLngBounds | null = null;
    this.referenciasLayer?.eachLayer((l: any) => {
      if (l.feature?.id === id) destino = l.getBounds?.() ?? null;
    });
    const b = destino as L.LatLngBounds | null;
    if (b?.isValid()) this.map.fitBounds(b, { padding: [40, 40], maxZoom: 17 });
  }

  /** Vuelve a encuadrar las referencias (p. ej. tras subir el límite de la congregación). */
  encuadrarReferencias(): void {
    if (!this.map) return;
    this.map.invalidateSize(); // el contenedor pudo cambiar de ancho (p. ej. al abrir un panel)
    const b = this.referenciasLayer?.getBounds();
    if (b?.isValid()) this.map.fitBounds(b, { padding: [30, 30] });
  }

  // ── Manzanas propuestas (detección automática) ─────────────────────────

  /** Encuadra el territorio, lee las calles del mapa propio y se las pasa al padre. */
  async detectarManzanas(): Promise<void> {
    if (!this.map) return;
    this.aviso.set(null);
    const limite = this.capasDelLimite();
    if (!limite.length) {
      this.aviso.set('Primero dibuje el límite del territorio en "1 · Límite".');
      return;
    }
    this.extrayendo.set(true);
    try {
      this.map.fitBounds(L.featureGroup(limite).getBounds(), { padding: [40, 40], animate: false });
      await new Promise((r) => setTimeout(r, 400)); // MapLibre sigue a Leaflet en el siguiente cuadro
      const calles = await this.obtenerCalles();
      if (!calles) return;
      if (!calles.coordinates.length) {
        this.aviso.set('El mapa no tiene calles en esta zona. Dibuje las manzanas a mano.');
        return;
      }
      this.detectar.emit(calles);
    } finally {
      this.extrayendo.set(false);
    }
  }

  /**
   * Calles de lo que se ve en pantalla. Con el mapa propio salen de las teselas
   * del navegador; con OSM o Google (imágenes) se piden al servidor. Devuelve
   * null y deja el aviso si no se pudieron traer.
   *
   * `completas`: las teselas cortan las calles en sus bordes y a veces les falta
   * un tramo. Para la detección no importa (el límite cierra los huecos), pero
   * para elegir cuadras sí, así que primero se piden al servidor y las teselas
   * quedan de respaldo.
   */
  private async obtenerCalles(completas = false): Promise<{ type: 'MultiLineString'; coordinates: number[][][] } | null> {
    if (!this.map) return null;
    if (this.map.getZoom() < ZOOM_MINIMO_CALLES) {
      this.aviso.set('Acerque más el mapa para buscar las calles.');
      return null;
    }
    const conTeselas = this.tileProvider === 'propio' && !!(this.tileLayer as any)?.getMaplibreMap;
    if (conTeselas && !completas) return callesDelMapa(this.tileLayer);
    const delServidor = await this.callesDelServidor(!conTeselas);
    return delServidor ?? (conTeselas ? callesDelMapa(this.tileLayer) : null);
  }

  private async callesDelServidor(avisarFallo: boolean): Promise<{ type: 'MultiLineString'; coordinates: number[][][] } | null> {
    if (!this.map || this.idTerritorio == null) return null;
    const b = this.map.getBounds();
    try {
      return await firstValueFrom(this.territoriosService.callesEnBbox(this.idTerritorio, {
        s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast(),
      }));
    } catch (err: any) {
      if (avisarFallo) this.aviso.set(err?.error?.detail ?? 'No se pudieron traer las calles del mapa. Intente de nuevo.');
      return null;
    }
  }

  // ── Límite por cuadras ──────────────────────────────────────────────────

  /** Muestra las cuadras de la zona visible para armar el límite tocándolas. */
  async empezarCuadras(): Promise<void> {
    if (!this.map) return;
    this.map.pm?.disableDraw();
    // Apagar la edición cuando ya está apagada igual emite el evento y marcaría el límite como cambiado.
    if ((this.map.pm as any)?.globalEditModeEnabled?.()) this.map.pm.disableGlobalEditMode();
    this.eligiendoCuadras.set(true);
    if (!this.cuadrasMoverHandler) {
      this.cuadrasMoverHandler = () => { if (this.cuadrasLayer) this.cuadrasDesactualizadas.set(true); };
      this.map.on('moveend', this.cuadrasMoverHandler);
    }
    await this.buscarCuadrasAqui();
  }

  async buscarCuadrasAqui(): Promise<void> {
    if (!this.map || this.idTerritorio == null) return;
    this.aviso.set(null);
    this.cuadrasCargando.set(true);
    try {
      const calles = await this.obtenerCalles(true);
      if (!calles) return;
      if (!calles.coordinates.length) {
        this.aviso.set('El mapa no tiene calles en esta zona. Dibuje el límite a mano.');
        return;
      }
      const fc = await firstValueFrom(this.territoriosService.cuadras(this.idTerritorio, calles));
      // Se conservan las ya elegidas que vuelvan a salir (misma forma) al mover el mapa.
      const antes = new Set(this.cuadrasElegidasGeojson().map((g) => JSON.stringify(g)));
      this.renderCuadras(fc.features ?? [], antes);
      if (!fc.features?.length) this.aviso.set('No se encontraron cuadras cerradas por calles en esta zona.');
    } catch (err: any) {
      this.aviso.set(err?.error?.detail ?? 'No se pudieron buscar las cuadras. Intente de nuevo.');
    } finally {
      this.cuadrasCargando.set(false);
      this.cuadrasDesactualizadas.set(false);
    }
  }

  private renderCuadras(features: any[], elegidasAntes: Set<string>): void {
    if (!this.map) return;
    if (this.cuadrasLayer) this.map.removeLayer(this.cuadrasLayer);
    this.cuadrasLayer = L.layerGroup().addTo(this.map);
    this.cuadrasCapas = [];
    for (const f of features) {
      const p = f.properties ?? {};
      const bloqueada = !!(p.ocupada || p.fuera);
      const item = { geometry: f.geometry, elegida: !bloqueada && (p.actual || elegidasAntes.has(JSON.stringify(f.geometry))), bloqueada, capa: null as any };
      item.capa = L.geoJSON(f, {
        pmIgnore: true,
        snapIgnore: true,
        style: this.estiloCuadra(item.elegida, bloqueada),
        onEachFeature: (_f: any, capa: any) => { capa._capaAuxiliar = true; },
      } as any).addTo(this.cuadrasLayer);
      if (bloqueada) {
        item.capa.bindTooltip(p.fuera ? 'Fuera del territorio de la congregación' : 'Ya pertenece a otra tarjeta', { sticky: true });
      } else {
        item.capa.on('click', (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev);
          item.elegida = !item.elegida;
          item.capa.setStyle(this.estiloCuadra(item.elegida, false));
          this.contarCuadras();
        });
      }
      this.cuadrasCapas.push(item);
    }
    this.contarCuadras();
  }

  private contarCuadras(): void {
    this.cuadrasElegidas.set(this.cuadrasCapas.filter((c) => c.elegida).length);
  }

  private cuadrasElegidasGeojson(): any[] {
    return this.cuadrasCapas.filter((c) => c.elegida).map((c) => c.geometry);
  }

  private estiloCuadra(elegida: boolean, bloqueada: boolean): L.PathOptions {
    if (bloqueada) return { color: '#94a3b8', weight: 1, fillColor: '#cbd5e1', fillOpacity: 0.45, opacity: 0.8 };
    return elegida
      ? { color: '#047857', weight: 2, fillColor: '#10b981', fillOpacity: 0.45, opacity: 1 }
      : { color: '#7c3aed', weight: 1.5, fillColor: '#ffffff', fillOpacity: 0.15, opacity: 0.9, dashArray: '4 4' };
  }

  /** Une las cuadras elegidas y las pone como el límite (queda sin guardar, se puede ajustar). */
  async armarLimiteConCuadras(): Promise<void> {
    if (!this.map || this.idTerritorio == null) return;
    const poligonos = this.cuadrasElegidasGeojson();
    if (!poligonos.length) return;
    this.aviso.set(null);
    this.cuadrasCargando.set(true);
    try {
      const geometria = await firstValueFrom(this.territoriosService.unirCuadras(this.idTerritorio, poligonos));
      this.capasDelLimite().forEach((l) => this.map!.removeLayer(l));
      if (this.geoLayer) this.map.removeLayer(this.geoLayer);
      this.geoLayer = L.geoJSON({ type: 'Feature', geometry: geometria, properties: {} } as any, {
        style: (feature: any) => this.getFeatureStyle(feature),
      }).addTo(this.map);
      this.geoLayer.eachLayer((layer: any) => {
        layer.on?.('pm:edit', () => this.emitGeometryUpdate());
        layer.on?.('pm:dragend', () => this.emitGeometryUpdate());
      });
      this.cancelarCuadras();
      this.emitGeometryUpdate();
      this.recalculateAreaFromAllLayers();
      this.manzanasAlFrente();
      this.activeToolHint.set('Límite armado. Revise el contorno y pulse «Guardar límite».');
    } catch (err: any) {
      this.aviso.set(err?.error?.detail ?? 'No se pudo armar el límite con esas cuadras.');
    } finally {
      this.cuadrasCargando.set(false);
    }
  }

  cancelarCuadras(): void {
    if (this.map && this.cuadrasLayer) this.map.removeLayer(this.cuadrasLayer);
    if (this.map && this.cuadrasMoverHandler) this.map.off('moveend', this.cuadrasMoverHandler);
    this.cuadrasMoverHandler = null;
    this.cuadrasLayer = null;
    this.cuadrasCapas = [];
    this.cuadrasElegidas.set(0);
    this.cuadrasDesactualizadas.set(false);
    this.eligiendoCuadras.set(false);
  }

  // ── Imán a las calles ───────────────────────────────────────────────────

  /**
   * Mientras se dibuja a mano, las calles de la pantalla quedan como líneas
   * casi invisibles a las que Geoman pega el lápiz (esquinas y ejes).
   * No bloquea el dibujo: si las calles tardan, el imán llega después.
   */
  private async activarImanCalles(): Promise<void> {
    if (!this.map || !this.panelExterno) return;
    const token = ++this.imanToken;
    const avisoPrevio = this.aviso();
    const calles = await this.obtenerCalles();
    // Un fallo del imán no debe dejar un aviso encima del dibujo.
    if (this.aviso() !== avisoPrevio) this.aviso.set(avisoPrevio);
    if (!calles?.coordinates.length || token !== this.imanToken || !this.drawingActive()) return;
    this.quitarImanCalles(false);
    this.imanLayer = L.layerGroup().addTo(this.map);
    for (const linea of calles.coordinates) {
      const capa: any = L.polyline(linea.map(([lng, lat]) => [lat, lng] as [number, number]), {
        ...CAPA_AUXILIAR, interactive: false, color: '#7c3aed', weight: 1, opacity: 0.25,
      } as any);
      capa._capaAuxiliar = true;
      capa.addTo(this.imanLayer);
    }
  }

  private quitarImanCalles(invalidar = true): void {
    if (invalidar) this.imanToken++;
    if (this.map && this.imanLayer) this.map.removeLayer(this.imanLayer);
    this.imanLayer = null;
  }

  // ── Renumeración (vista previa sobre el mapa) ──────────────────────────

  /** Muestra en ámbar los números que quedarían; null vuelve a los actuales. */
  mostrarRenumeracion(nuevos: Map<number, string> | null): void {
    this.renumeracionPrevia = nuevos;
    this.renderManzanasLayer();
  }

  private renderPropuestas(): void {
    if (!this.map) return;
    if (this.propuestasLayer) {
      this.map.removeLayer(this.propuestasLayer);
      this.propuestasLayer = null;
    }
    this.propuestasCapas = [];
    this.propuestasExcluidas.set(new Set());
    const features = this.propuestasGeojson?.features ?? [];
    this.propuestasTotal.set(features.length);
    if (!features.length) return;

    this.propuestasLayer = L.layerGroup().addTo(this.map);
    features.forEach((feature: any, i: number) => {
      const id = feature.id ?? i;
      const poligono = L.geoJSON(feature, {
        pmIgnore: true,
        snapIgnore: true,
        style: this.estiloPropuesta(false),
        onEachFeature: (_f: any, capa: any) => { capa._capaAuxiliar = true; },
      } as any);
      poligono.on('click', () => this.alternarPropuesta(id));
      poligono.addTo(this.propuestasLayer!);
      const etiqueta = L.marker(this.getCentroid(feature.geometry) ?? poligono.getBounds().getCenter(), {
        interactive: false,
        icon: this.iconoEtiqueta('', '#d97706'),
      }).addTo(this.propuestasLayer!);
      this.propuestasCapas.push({ id, feature, poligono, etiqueta });
    });
    // Los números que el servidor propuso (los siguientes libres de la secuencia), de menor a mayor.
    this.numerosPropuestos = features
      .map((f: any) => parseInt(f.properties?.numero_manzana, 10))
      .filter((n: number) => Number.isFinite(n))
      .sort((a: number, b: number) => a - b);
    this.numerarPropuestas();
  }

  private alternarPropuesta(id: number): void {
    const excluidas = new Set(this.propuestasExcluidas());
    if (excluidas.has(id)) excluidas.delete(id);
    else excluidas.add(id);
    this.propuestasExcluidas.set(excluidas);
    this.numerarPropuestas();
  }

  /** Las incluidas se numeran seguidas desde el primer número propuesto; las quitadas llevan ✕. */
  private numerarPropuestas(): void {
    const excluidas = this.propuestasExcluidas();
    // Las incluidas toman los números propuestos por el servidor en orden: siguen la secuencia y no repiten.
    let i = 0;
    for (const p of this.propuestasCapas) {
      const fuera = excluidas.has(p.id);
      const n = fuera ? null : String(this.numerosPropuestos[i++] ?? i);
      p.poligono.setStyle(this.estiloPropuesta(fuera));
      p.etiqueta.setIcon(this.iconoEtiqueta(fuera ? '✕' : n!, fuera ? '#94a3b8' : '#d97706'));
      p.feature.properties = { ...p.feature.properties, numero_manzana: n };
    }
  }

  confirmarPropuestas(): void {
    const excluidas = this.propuestasExcluidas();
    this.guardarPropuestas.emit(this.propuestasCapas.filter((p) => !excluidas.has(p.id)).map((p) => p.feature));
  }

  private estiloPropuesta(fuera: boolean): L.PathOptions {
    return fuera
      ? { color: '#94a3b8', weight: 1.5, dashArray: '4 4', fillColor: '#e2e8f0', fillOpacity: 0.25 }
      : { color: '#d97706', weight: 2, dashArray: '6 4', fillColor: '#fde68a', fillOpacity: 0.45 };
  }

  private iconoEtiqueta(texto: string, fondo: string): L.DivIcon {
    return L.divIcon({
      html: `<div style="display:inline-block;transform:translate(-50%,-50%);background:${fondo};color:#fff;font:700 12px system-ui,sans-serif;padding:3px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.35);border:1.5px solid rgba(255,255,255,.6)">${texto}</div>`,
      className: '',
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });
  }

  // ── Puntos layer rendering ─────────────────────────────────────────────

  renderPuntosLayer(): void {
    if (!this.map) return;
    if (this.puntosLayer) {
      this.map.removeLayer(this.puntosLayer);
      this.puntosLayer = null;
    }
    this.puntoMarcas.clear();
    this.anilloPunto = null;
    if (!this.puntosGeojson?.features?.length) { this.sincronizarSeleccion(); return; }

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
      if (this.panelExterno && feature.id != null) {
        this.puntoMarcas.set(Number(feature.id), marker);
        marker.on('click', (ev: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(ev);
          if (this.drawingActive() || this.editandoForma() || this.colocandoPunto()) return;
          this.seleccionar('punto', Number(feature.id));
        });
      } else if (props.nombre || props.notas) {
        marker.bindPopup(`
          <div style="font-family:system-ui;min-width:120px">
            <strong style="font-size:13px;color:#1e293b">${props.nombre || ''}</strong>
            <p style="margin:2px 0 0;color:#64748b;font-size:11px">${tipo}${props.codigo ? ' · Tarjeta ' + props.codigo : ''}</p>
            ${props.notas ? `<p style="margin:4px 0 0;color:#64748b;font-size:11px">${props.notas}</p>` : ''}
          </div>
        `);
      }
      marker.addTo(this.puntosLayer!);
    });
    this.sincronizarSeleccion();
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

  /** Figuras que forman el límite: lo dibujado en "Límite", sin manzanas, vecinos, propuestas ni trazos temporales. */
  private capasDelLimite(): L.Layer[] {
    const capas: L.Layer[] = [];
    this.map?.eachLayer((layer: any) => {
      if (layer._capaAuxiliar || layer._pmTempLayer) return;
      if (layer instanceof L.Circle || layer instanceof L.Polygon) capas.push(layer);
    });
    return capas;
  }

  private recalculateAreaFromAllLayers(): void {
    if (!this.map) return;
    let totalArea = 0;
    this.capasDelLimite().forEach((layer: any) => {
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
    this.tieneLimite.set(this.capasDelLimite().length > 0);
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
    this.capasDelLimite().forEach((layer: any) => {
      if (layer instanceof L.Circle) {
        try {
          const center = layer.getLatLng();
          const radiusKm = layer.getRadius() / 1000;
          const circlePoly = geoCircle([center.lng, center.lat], radiusKm, 64);
          features.push(circlePoly);
        } catch {}
      } else {
        features.push(layer.toGeoJSON());
      }
    });

    const fc: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: features as GeoJSONFeature[],
    };
    this.registrarZona(fc);
    this.tieneLimite.set(features.length > 0);
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
    this.tileLayer = null;
    const token = ++this.tileLayerToken;

    if (provider === 'propio') {
      // La capa propia se importa bajo demanda; si el archivo no responde se vuelve a OSM.
      crearCapaBasePropia()
        .then((capa) => {
          if (token !== this.tileLayerToken || !this.map) return;
          if (!capa) return this.setTileLayer('osm');
          this.tileLayer = capa.addTo(this.map);
        })
        .catch(() => {
          if (token === this.tileLayerToken) this.setTileLayer('osm');
        });
      return;
    }

    const tileUrl =
      provider === 'google'
        ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    this.tileLayer = L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(this.map);
  }

  // ── GeoJSON Rendering (territory outline) ─────────────────────────────

  private codigoLabels: { bounds: L.LatLngBounds; tooltip: L.Tooltip; visible: boolean }[] = [];
  private zoomLabelsHandler: (() => void) | null = null;

  /**
   * Con muchos territorios las etiquetas se pisarían: cada código solo se muestra
   * si su polígono mide lo bastante en pantalla para contenerlo. Al acercar el zoom aparecen.
   */
  private actualizarCodigos(): void {
    const map = this.map;
    if (!map) return;
    for (const l of this.codigoLabels) {
      const a = map.latLngToContainerPoint(l.bounds.getNorthWest());
      const b = map.latLngToContainerPoint(l.bounds.getSouthEast());
      const cabe = Math.abs(b.x - a.x) >= 56 && Math.abs(b.y - a.y) >= 30;
      if (cabe && !l.visible) l.tooltip.addTo(map);
      else if (!cabe && l.visible) l.tooltip.remove();
      l.visible = cabe;
    }
  }

  private renderGeoJSON(): void {
    if (!this.map || !this.geojson) return;

    if (this.geoLayer) {
      this.map.removeLayer(this.geoLayer);
    }
    this.codigoLabels.forEach(l => l.tooltip.remove());
    this.codigoLabels = [];

    this.geoLayer = L.geoJSON(this.geojson as any, {
      style: (feature: any) => this.getFeatureStyle(feature),
      onEachFeature: (feature: any, layer: L.Layer) => {
        layer.on('click', () => this.featureClick.emit(feature));

        if (this.showPopups && feature.properties) {
          const p = feature.properties;
          const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
          const estado = p.estado_territorio || 'Sin estado';
          const tono = estado === 'Disponible' ? 'ok' : estado === 'Asignado' ? 'asig' : 'pausa';
          // El clic navega al territorio, así que la ficha va al pasar el cursor, no en un popup.
          layer.bindTooltip(`
            <div class="gac-tt">
              <div class="gac-tt__top"><strong>${esc(p.codigo)}</strong><span class="gac-tt__estado gac-tt__estado--${tono}">${esc(estado)}</span></div>
              <div class="gac-tt__nombre">${esc(p.nombre)}</div>
              <div class="gac-tt__cta">Clic para abrir el territorio</div>
            </div>
          `, { sticky: true, direction: 'top', offset: [0, -8], opacity: 1, className: 'gac-tt-wrap' });
          layer.on('mouseover', () => (layer as L.Path).setStyle({ weight: 3, fillOpacity: 0.55 }));
          layer.on('mouseout', () => this.geoLayer?.resetStyle(layer as L.Path));
        }
      },
    }).addTo(this.map);

    if (this.showPopups) {
      // Código de cada territorio sobre su polígono, para ubicarlos sin pasar el cursor.
      this.geoLayer.eachLayer((layer: any) => {
        const codigo = layer.feature?.properties?.codigo;
        if (!codigo) return;
        const centro = (layer.getBounds?.() as L.LatLngBounds | undefined)?.getCenter();
        if (!centro) return;
        this.codigoLabels.push({
          bounds: layer.getBounds(),
          tooltip: L.tooltip({ permanent: true, direction: 'center', className: 'gac-terr-code', interactive: false })
            .setContent(String(codigo)).setLatLng(centro),
          visible: false,
        });
      });
    }

    if (this.showPopups && this.map) {
      if (this.zoomLabelsHandler) this.map.off('zoomend', this.zoomLabelsHandler);
      this.zoomLabelsHandler = () => this.actualizarCodigos();
      this.map.on('zoomend', this.zoomLabelsHandler);
    }

    if (this.soloLimite) {
      // La zona con la que se abre el editor es el punto de partida del historial.
      this.historialZona = [];
      this.zonaActual = (this.geojson.features.find(f => f.geometry?.type === 'Polygon')?.geometry ?? null) as GeoJSONGeometry | null;
      this.puedeDeshacerZona.set(false);
    }

    if (this.enableDrawing) {
      this.geoLayer.eachLayer((layer: any) => {
        layer.on?.('pm:edit', () => this.emitGeometryUpdate());
        layer.on?.('pm:dragend', () => this.emitGeometryUpdate());
      });
      this.recalculateAreaFromAllLayers();
    }

    const bounds = this.boundsParaEncuadrar();
    if (bounds?.isValid()) {
      this.map.fitBounds(bounds, { padding: [30, 30] });
      if (this.encuadrarCongregacion && this.referenciasLayer) this.congregacionEncuadrada = true;
    }
    this.ajustarEtiquetasManzana();
    this.actualizarCodigos();

    this.highlightSelected();
  }

  private getFeatureStyle(feature: any): L.PathOptions {
    if (this.soloLimite && this._colorForma) {
      return { color: this._colorForma, fillColor: this._colorForma, weight: 3, fillOpacity: 0.25 };
    }
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

  private hint(cual: 'limite' | 'manzanas'): string {
    if (!this.panelExterno) return Hint[cual];
    return cual === 'limite'
      ? 'Pulse «Dibujar el límite» en el panel y haga clic en cada esquina. Doble clic para terminar.'
      : 'Toque una manzana para elegirla, o pulse «Dibujar una manzana» en el panel.';
  }

  // ── Panel externo: seleccionar, ajustar y borrar ───────────────────────

  private estiloManzana(props: any, elegida: boolean): L.PathOptions {
    const predicada = props?.predicada === true;
    const asig = this.colorAsignada(props);
    if (elegida) return { color: '#1d4ed8', weight: 4, fillColor: '#93c5fd', fillOpacity: 0.6, opacity: 1 };
    return {
      color: predicada ? '#16a34a' : asig ?? '#475569', weight: predicada || asig ? 2.5 : 2,
      fillColor: predicada ? '#bbf7d0' : asig ? this.aclarar(asig) : '#f1f5f9', fillOpacity: predicada || asig ? 0.55 : 0.4, opacity: 0.9,
      dashArray: props?.origen === 'ia' ? '6 5' : undefined,
    };
  }

  /** Pinta la figura elegida (y quita el resalte de las demás). */
  private aplicarSeleccion(): void {
    const sel = this.seleccion();
    this.manzanaCapas.forEach((capa, id) => {
      if (this.formaTemporal && sel?.tipo === 'manzana' && sel.id === id) return; // la oculta el ajuste
      capa.setStyle(this.estiloManzana(this.manzanaProps.get(id), sel?.tipo === 'manzana' && sel.id === id));
    });
    if (this.anilloPunto && this.puntosLayer) { this.puntosLayer.removeLayer(this.anilloPunto); this.anilloPunto = null; }
    this.puntoMarcas.forEach((m, id) => m.setZIndexOffset(sel?.tipo === 'punto' && sel.id === id ? 1000 : 0));
    if (sel?.tipo === 'punto' && this.puntosLayer) {
      const m = this.puntoMarcas.get(sel.id);
      if (m) {
        this.anilloPunto = L.circleMarker(m.getLatLng(), { radius: 30, color: '#e11d48', weight: 3, fillColor: '#fb7185', fillOpacity: 0.15, interactive: false, pmIgnore: true } as any)
          .addTo(this.puntosLayer);
        m.off('drag').on('drag', () => this.anilloPunto?.setLatLng(m.getLatLng()));
      }
    }
  }

  /** Elige una manzana o un punto (desde el mapa o desde la lista del panel). */
  seleccionar(tipo: 'manzana' | 'punto', id: number, centrar = false): void {
    if (!this.map || !this.panelExterno) return;
    if (this.drawingActive()) this.map.pm.disableDraw();
    this.terminarEdicion(false);
    const modo: LayerMode = tipo === 'manzana' ? 'manzana' : 'punto';
    if (this.layerMode() !== modo) this.setLayerMode(modo);
    this.borrando.set(false);
    this.seleccion.set({ tipo, id });
    this.aplicarSeleccion();
    if (centrar) {
      if (tipo === 'manzana') {
        const b = this.manzanaCapas.get(id)?.getBounds();
        if (b?.isValid()) this.map.flyToBounds(b, { padding: [80, 80], maxZoom: 19, duration: 0.5 });
      } else {
        const m = this.puntoMarcas.get(id);
        if (m) this.map.panTo(m.getLatLng());
      }
    }
  }

  quitarSeleccion(): void {
    this.terminarEdicion(false);
    this.borrando.set(false);
    this.seleccion.set(null);
    this.aplicarSeleccion();
  }

  /** Corregir la forma de la manzana elegida: se arrastran sus esquinas. */
  ajustarForma(): void {
    const sel = this.seleccion();
    if (!this.map || !sel || sel.tipo !== 'manzana') return;
    const original = this.manzanaCapas.get(sel.id);
    const geom = (original?.toGeoJSON() as any)?.features?.[0]?.geometry;
    if (!original || geom?.type !== 'Polygon') return;
    this.terminarEdicion(false);
    const temporal = L.polygon(L.GeoJSON.coordsToLatLngs(geom.coordinates, 1) as any, {
      color: '#1d4ed8', weight: 3, fillColor: '#60a5fa', fillOpacity: 0.35,
    });
    (temporal as any)._capaAuxiliar = true;
    temporal.addTo(this.map);
    original.setStyle({ opacity: 0, fillOpacity: 0 });
    temporal.pm.enable({ allowSelfIntersection: false, snappable: true, snapDistance: 15 });
    this.formaTemporal = temporal;
    this.editTipo = 'manzana';
    this.editandoForma.set(true);
    this.activeToolHint.set('Arrastre las esquinas de la manzana. Al terminar pulse «Listo, guardar».');
  }

  /** Mover el punto elegido: se arrastra el marcador. */
  moverPunto(): void {
    const sel = this.seleccion();
    const m = sel?.tipo === 'punto' ? this.puntoMarcas.get(sel.id) : null;
    if (!this.map || !m) return;
    this.terminarEdicion(false);
    m.closePopup();
    this.puntoOriginal = m.getLatLng();
    m.dragging?.enable();
    this.editTipo = 'punto';
    this.editandoForma.set(true);
    this.activeToolHint.set('Arrastre el punto al lugar correcto. Al terminar pulse «Listo, guardar».');
  }

  /** Cierra el ajuste en curso: guarda la nueva forma/lugar o vuelve a como estaba. */
  terminarEdicion(guardar: boolean): void {
    const sel = this.seleccion();
    if (this.editTipo === 'manzana' && this.formaTemporal) {
      const t = this.formaTemporal;
      t.pm.disable();
      if (guardar && sel) {
        // La forma queda a la vista hasta que el padre recargue las manzanas (renderManzanasLayer la quita).
        this.manzanaForma.emit({ id: sel.id, geojson: (t.toGeoJSON() as any).geometry });
      } else {
        this.map?.removeLayer(t);
        this.formaTemporal = null;
      }
    } else if (this.editTipo === 'punto' && sel) {
      const m = this.puntoMarcas.get(sel.id);
      m?.dragging?.disable();
      if (m && guardar) {
        const ll = m.getLatLng();
        this.puntoMovido.emit({ id: sel.id, geojson: { type: 'Point', coordinates: [ll.lng, ll.lat] } });
      } else if (m && this.puntoOriginal) {
        m.setLatLng(this.puntoOriginal);
        this.anilloPunto?.setLatLng(this.puntoOriginal);
      }
    }
    this.puntoOriginal = null;
    this.editTipo = null;
    if (this.editandoForma()) {
      this.editandoForma.set(false);
      this.aplicarSeleccion();
      this.activeToolHint.set(this.layerMode() === 'manzana' ? this.hint('manzanas') : 'Toque un punto para elegirlo, o use «Poner un punto» en el panel.');
    }
  }

  /** Dibujar una manzana nueva: la herramienta queda lista, sin buscar nada en el mapa. */
  empezarManzana(): void {
    if (!this.map) return;
    if (this.layerMode() !== 'manzana') this.setLayerMode('manzana');
    this.quitarSeleccion();
    this.map.pm.enableDraw('Polygon');
    void this.activarImanCalles();
  }

  cancelarDibujoActual(): void { this.map?.pm?.disableDraw(); }

  /** El próximo clic en el mapa pone un punto (sigue armado hasta `detenerPunto`). */
  empezarPunto(): void {
    if (!this.map) return;
    if (this.layerMode() !== 'punto') this.setLayerMode('punto');
    this.quitarSeleccion();
    if (!this.mapClickHandler) {
      this.mapClickHandler = (e: L.LeafletMouseEvent) => this.onMapClickForPunto(e);
      this.map.on('click', this.mapClickHandler as any);
    }
    this.colocandoPunto.set(true);
    this.activeToolHint.set('Haga clic en el mapa donde va el punto (por ejemplo, el lugar de salida).');
  }

  detenerPunto(): void {
    if (this.mapClickHandler && this.map) { this.map.off('click', this.mapClickHandler as any); this.mapClickHandler = null; }
    this.cancelPunto();
    this.colocandoPunto.set(false);
    this.activeToolHint.set('Toque un punto para elegirlo, o use «Poner un punto» en el panel.');
  }

  /** Borra el límite dibujado y deja la herramienta lista para dibujarlo otra vez. */
  dibujarLimiteDeNuevo(): void {
    this.clearAll();
    this.empezarDibujo();
  }
}

/**
 * Capas que no son el límite (manzanas, vecinos): Geoman no las edita ni las
 * borra, pero el lápiz se pega a sus bordes para que los límites coincidan.
 */
const CAPA_AUXILIAR = { pmIgnore: true, snapIgnore: false };

/** Más lejos que esto la pantalla abarca demasiadas calles para buscar cuadras o hacer de imán. */
const ZOOM_MINIMO_CALLES = 15;

const Hint = {
  limite: 'Elija el lápiz (izquierda) y haga clic en cada esquina del territorio. Doble clic para terminar.',
  manzanas: 'Use "Detectar manzanas" o dibuje cada una con el lápiz. Toque una manzana guardada para borrarla.',
};
