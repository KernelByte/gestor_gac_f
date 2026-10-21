import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { geoKinks } from '../utils/geo-math.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { firstValueFrom, forkJoin, timeout } from 'rxjs';
import { TerritoriosService, PublicadorOpcion } from '../services/territorios.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { nombreMostrado } from '../../../core/utils/nombre.util';
import { AuthStore } from '../../../core/auth/auth.store';
import { TerritorioMapComponent } from '../components/territorio-map.component';
import { TerritorioCardComponent } from '../components/territorio-card.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PickerOption, SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';
import { exportTerritorioCard } from '../utils/territorio-export.util';
import {
  Territorio,
  Sector,
  Manzana,
  CoberturaManzana,
  TerritorioStats,
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  AsignacionTerritorio,
  Punto,
  ResumenTerritorio,
  ViviendaDeTerritorio,
  textoDiasSinTrabajar,
  textoDireccion,
} from '../models/territorio.model';

@Component({
   standalone: true,
   selector: 'app-territorios-page',
   imports: [CommonModule, FormsModule, TerritorioMapComponent, TerritorioCardComponent, PageHeaderComponent, SelectPickerComponent],
   animations: [
      trigger('slideOver', [
         transition(':enter', [
            style({ transform: 'translateX(24px)', opacity: 0 }),
            animate('240ms cubic-bezier(0.23, 1, 0.32, 1)', style({ transform: 'translateX(0)', opacity: 1 }))
         ]),
         transition(':leave', [
            animate('160ms cubic-bezier(0.23, 1, 0.32, 1)', style({ transform: 'translateX(24px)', opacity: 0 }))
         ])
      ])
   ],
   template: `
    <!-- En móvil la página se desplaza entera (la lista siempre se ve); desde md encaja en la
         ventana y solo se desplazan la lista y el detalle. -->
    <div class="flex flex-col h-full gap-4 overflow-y-auto md:overflow-hidden">

      <!-- 1. Encabezado: el subtítulo es el resumen vivo, no un texto de relleno -->
      <app-page-header spacing="none" title="Territorios" [subtitle]="resumenEncabezado()">
        <button (click)="navigateToMap()" class="btn-secondary focus-ring-green whitespace-nowrap active:scale-[0.97] transition-transform">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"></polygon></svg>
          Mapa general
        </button>
        <button (click)="irASectores()" class="btn-secondary focus-ring-green whitespace-nowrap active:scale-[0.97] transition-transform">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
          Barrios o sectores
        </button>
        <button *ngIf="puedeEditar()" (click)="openCreateModal()" class="btn-primary-green focus-ring-green whitespace-nowrap active:scale-[0.97] transition-transform">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Nueva tarjeta
        </button>
      </app-page-header>

      <!-- 2. Una sola barra: buscar, estado y filtros de actividad -->
      <div class="shrink-0 flex flex-wrap items-center gap-2" role="search">
        <label class="relative flex-1 min-w-[min(100%,16rem)] group">
          <span class="sr-only">Buscar territorio</span>
          <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input
            [(ngModel)]="searchQuery"
            type="search"
            placeholder="Buscar por código o nombre"
            class="w-full h-11 pl-10 pr-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-[border-color,box-shadow]"
          >
        </label>
        <app-select-picker class="w-full sm:w-56 shrink-0" colorScheme="emerald" ariaLabel="Estado"
          [(ngModel)]="estadoFilter" [options]="opcionesEstadoFiltro" placeholder="Todos los estados" [searchable]="false" />
        @if (sectores().length > 0) {
          <app-select-picker class="w-full sm:w-56 shrink-0" colorScheme="emerald" ariaLabel="Sector"
            [(ngModel)]="sectorFilter" [options]="opcionesSectorFiltro()" placeholder="Todos los sectores" [searchable]="false" />
        }
        <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por actividad">
          @for (c of chips(); track c.id) {
            <button type="button" (click)="chip.set(chip() === c.id ? '' : c.id)"
              [attr.aria-pressed]="chip() === c.id"
              class="h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors active:scale-[0.97] whitespace-nowrap"
              [ngClass]="chip() === c.id ? c.activo : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'">
              {{ c.etiqueta }} <span class="font-bold ml-0.5">{{ c.cuenta }}</span>
            </button>
          }
        </div>
      </div>

      <!-- 3. Lista + detalle -->
      <div class="md:flex-1 flex gap-4 md:min-h-0 relative">

        <!-- Lista. Es un contenedor: las columnas aparecen según el ancho que le queda, no según la ventana. -->
        <section aria-label="Lista de territorios" class="@container flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">

           <div class="md:flex-1 md:overflow-y-auto simple-scrollbar relative">
              @if (loading()) {
                <div class="divide-y divide-slate-100 dark:divide-slate-800" role="status" aria-label="Cargando territorios">
                  @for (i of [1,2,3,4,5,6]; track i) {
                    <div class="px-5 py-4 flex items-center gap-4 animate-pulse">
                      <div class="flex-1 space-y-2"><div class="h-4 w-16 rounded bg-slate-200 dark:bg-slate-700"></div><div class="h-3 w-40 rounded bg-slate-100 dark:bg-slate-800"></div></div>
                      <div class="h-6 w-24 rounded-full bg-slate-100 dark:bg-slate-800"></div>
                    </div>
                  }
                </div>
              } @else if (loadError()) {
                <div class="flex flex-col items-center justify-center py-16 px-6 gap-4 text-center" role="alert">
                  <p class="text-base font-bold text-slate-800 dark:text-slate-100">No se pudieron cargar los territorios</p>
                  <p class="text-sm text-slate-500 dark:text-slate-400 -mt-2">Revise la conexión e intente de nuevo.</p>
                  <button (click)="loadTerritorios()" class="h-10 px-5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors active:scale-[0.97]">Reintentar</button>
                </div>
              } @else if (filteredTerritorios().length === 0) {
                <div class="flex flex-col items-center justify-center py-16 px-6 gap-3 text-center">
                  @if (searchQuery || estadoFilter || sectorFilter || chip()) {
                    <p class="text-base font-bold text-slate-800 dark:text-slate-100">Ningún territorio coincide</p>
                    <p class="text-sm text-slate-500 dark:text-slate-400">Pruebe con otra búsqueda o quite los filtros.</p>
                    <button (click)="limpiarFiltros()" class="h-10 px-5 text-sm font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">Quitar filtros</button>
                  } @else {
                    <p class="text-base font-bold text-slate-800 dark:text-slate-100">Aún no hay territorios</p>
                    <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm">Cree el primero: le pedirá código y nombre y luego abrirá el mapa para dibujar su límite.</p>
                    <button *ngIf="puedeEditar()" (click)="openCreateModal()" class="h-10 px-5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors active:scale-[0.97]">Nueva tarjeta</button>
                  }
                </div>
              } @else {
              <table class="w-full text-left border-collapse">
                 <thead class="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm">
                    <tr class="border-b border-slate-200 dark:border-slate-800">
                       <th scope="col" class="pl-4 @md:pl-5 pr-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Territorio</th>
                       <th scope="col" class="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Estado</th>
                       <th scope="col" class="hidden @xl:table-cell px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Última predicación</th>
                       <th scope="col" class="hidden @3xl:table-cell px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 w-44">Vuelta actual</th>
                       <th scope="col" class="hidden @4xl:table-cell px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">Asignado a</th>
                       <th scope="col" class="hidden @md:table-cell w-10 pr-4"><span class="sr-only">Abrir</span></th>
                    </tr>
                 </thead>
                  <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                    @for (t of paginatedTerritorios(); track t.id_territorio) {
                    @let r = resumenDe(t.id_territorio);
                    @let activo = selectedTerritorio()?.id_territorio === t.id_territorio;
                    <tr
                      (click)="selectTerritorio(t)"
                      (keydown.enter)="selectTerritorio(t)"
                      tabindex="0"
                      [attr.aria-selected]="activo"
                      class="group cursor-pointer transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-500"
                      [ngClass]="activo ? 'bg-emerald-50/80 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'"
                    >
                       <td class="pl-4 @md:pl-5 pr-3 py-3.5">
                          <div class="flex items-baseline gap-2 min-w-0">
                            <span class="font-display text-base font-bold tabular-nums shrink-0"
                              [ngClass]="activo ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'">{{ t.codigo }}</span>
                            <span class="text-sm text-slate-600 dark:text-slate-300 truncate">{{ t.nombre }}</span>
                            @if (sectorDe(t); as sec) {
                              <span class="hidden @lg:inline-flex items-center gap-1.5 shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                                <span class="w-2 h-2 rounded-full" [style.background-color]="sec.color || '#94a3b8'"></span>{{ sec.nombre }}
                              </span>
                            }
                          </div>
                          <!-- Con la lista angosta, lo que no cabe en columnas va aquí debajo -->
                          <p class="@xl:hidden mt-1 flex items-center gap-1.5 text-[13px] text-slate-500 dark:text-slate-400">
                            <span class="w-2 h-2 rounded-full shrink-0" [ngClass]="alertaDe(t.id_territorio)"></span>
                            {{ textoUltima(r) }}
                            @if (r?.asignado_a) { <span aria-hidden="true">·</span> {{ r!.asignado_a }} }
                          </p>
                       </td>
                       <td class="px-3 py-3.5">
                          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap" [ngClass]="getStatusColor(t.estado_territorio)">
                             <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getStatusDotColor(t.estado_territorio)"></span>
                             {{ t.estado_territorio }}
                          </span>
                       </td>
                       <td class="hidden @xl:table-cell px-3 py-3.5">
                          <span class="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            <span class="w-2 h-2 rounded-full shrink-0" [ngClass]="alertaDe(t.id_territorio)"></span>
                            {{ textoUltima(r) }}
                          </span>
                       </td>
                       <td class="hidden @3xl:table-cell px-3 py-3.5">
                          @if (r?.en_curso) {
                            <div class="flex items-center gap-2.5">
                              <div class="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" [attr.aria-valuenow]="r!.porcentaje" aria-valuemin="0" aria-valuemax="100" aria-label="Avance de la vuelta">
                                <div class="h-full rounded-full bg-emerald-500" [style.width.%]="r!.porcentaje"></div>
                              </div>
                              <span class="text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-300 w-10 text-right">{{ r!.porcentaje }} %</span>
                            </div>
                          } @else if (r?.ultimo_completado) {
                            <span class="text-sm text-slate-500 dark:text-slate-400">Completa el {{ r!.ultimo_completado | date:'d MMM y' }}</span>
                          } @else {
                            <span class="text-sm text-slate-400 dark:text-slate-500">Sin empezar</span>
                          }
                       </td>
                       <td class="hidden @4xl:table-cell px-3 py-3.5 text-sm text-slate-700 dark:text-slate-300 max-w-[14rem] truncate">
                          {{ r?.asignado_a || '—' }}
                       </td>
                       <td class="hidden @md:table-cell pr-4 py-3.5 text-right" aria-hidden="true">
                          <svg class="w-4 h-4 inline-block text-slate-300 dark:text-slate-600 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-[color,transform]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                       </td>
                    </tr>
                    }
                 </tbody>
              </table>
              }
           </div>

           @if (!loading() && !loadError() && totalPages().length > 1) {
           <div class="shrink-0 px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span class="text-[13px] text-slate-500 dark:text-slate-400">{{ paginationStart() }}–{{ paginationEnd() }} de {{ filteredTerritorios().length }}</span>
              <div class="flex gap-1">
                @for (p of totalPages(); track p) {
                  <button (click)="currentPage.set(p)" [attr.aria-current]="currentPage() === p ? 'page' : null"
                    class="w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-colors"
                    [ngClass]="currentPage() === p ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'">{{ p }}</button>
                }
              </div>
           </div>
           }
        </section>

        <!-- Detalle: panel al lado desde 1280 px; por debajo, cajón encima de la lista -->
        @if (selectedTerritorio()) {
        <div class="xl:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px]" (click)="closeDetails()" aria-hidden="true"></div>
        <aside
          @slideOver
          aria-label="Detalle del territorio"
          class="fixed inset-0 z-40 md:inset-y-3 md:right-3 md:left-auto md:w-[min(500px,calc(100vw-1.5rem))] md:rounded-2xl xl:static xl:z-auto xl:w-[440px] 2xl:w-[500px] shrink-0 bg-white dark:bg-slate-900 border-0 md:border border-slate-200 dark:border-slate-800 shadow-2xl xl:shadow-none overflow-hidden flex flex-col"
        >
           <!-- Encabezado -->
           <div class="px-5 pt-4 pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2.5">
                    <h3 class="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight leading-none tabular-nums">{{ selectedTerritorio()!.codigo }}</h3>
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border" [ngClass]="getStatusColor(selectedTerritorio()!.estado_territorio)">
                      <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getStatusDotColor(selectedTerritorio()!.estado_territorio)"></span>{{ selectedTerritorio()!.estado_territorio }}
                    </span>
                  </div>
                  <p class="text-[15px] font-medium text-slate-600 dark:text-slate-300 mt-1.5">{{ selectedTerritorio()!.nombre }}</p>
                </div>
                <button (click)="closeDetails()" aria-label="Cerrar detalle" class="w-10 h-10 -mr-2 -mt-1 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
              <dl class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-slate-500 dark:text-slate-400">
                @if (selectedStats()) {
                  <div class="flex items-baseline gap-1"><dt class="sr-only">Manzanas</dt><dd class="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{{ selectedStats()!.manzanas_count }}</dd> manzanas</div>
                  <div class="flex items-baseline gap-1"><dt class="sr-only">Direcciones</dt><dd class="font-bold text-slate-800 dark:text-slate-100 tabular-nums">{{ selectedStats()!.viviendas_count }}</dd> direcciones</div>
                }
                @if (resumenDe(selectedTerritorio()!.id_territorio); as rs) {
                  <div class="flex items-center gap-1.5"><dt class="sr-only">Última predicación</dt>
                    <span class="w-2 h-2 rounded-full" [ngClass]="alertaDe(selectedTerritorio()!.id_territorio)"></span>
                    <dd>{{ textoUltima(rs) }}</dd>
                  </div>
                }
              </dl>
           </div>

           <!-- Pestañas: las cuatro caben siempre -->
           <div class="grid grid-cols-4 border-b border-slate-100 dark:border-slate-800 shrink-0" role="tablist">
             @for (tab of tabs; track tab.id) {
               <button
                 role="tab"
                 [attr.aria-selected]="activeDetailTab() === tab.id"
                 (click)="setDetailTab($any(tab.id))"
                 class="h-11 px-1 text-[13px] font-semibold border-b-2 -mb-px transition-colors truncate"
                 [ngClass]="activeDetailTab() === tab.id
                   ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                   : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'"
               >{{ tab.label }}</button>
             }
           </div>
           <!-- Content -->
           <div class="flex-1 overflow-y-auto p-5 simple-scrollbar space-y-5">

             <!-- TAB: Info -->
             @if (activeDetailTab() === 'info') {
               <!-- Mini-map -->
               @if (selectedTerritorioPolygon()) {
                 <app-territorio-map
                   style="height: auto"
                   [geojson]="selectedTerritorioPolygon()"
                   [manzanasGeojson]="selectedManzanasGeoJSON()"
                   [puntosGeojson]="selectedPuntosGeoJSON()"
                   height="clamp(220px, 36vh, 420px)"
                   [interactive]="false" />
               } @else {
                 <div class="w-full h-36 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700/50 flex flex-col items-center justify-center gap-2">
                   <svg class="w-8 h-8 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                   <span class="text-xs text-slate-400 font-medium">Aún sin dibujar — use el botón «Dibujar»</span>
                 </div>
               }

               <!-- Puntos de lugar -->
               @if (puntos().length > 0) {
                 <section>
                   <h4 class="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">Puntos en el mapa <span class="font-semibold text-slate-400">{{ puntos().length }}</span></h4>
                   <ul class="grid grid-cols-1 gap-2">
                     @for (p of puntos(); track p.id_punto) {
                       <li class="flex items-center gap-3 pl-2.5 pr-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700/70">
                         <span class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white shrink-0"
                              [ngClass]="p.tipo === 'Salida' ? 'bg-rose-500' : p.tipo === 'Lugar' ? 'bg-sky-600' : 'bg-slate-400'" aria-hidden="true">
                           {{ p.tipo === 'Salida' ? 'S' : p.tipo === 'Lugar' ? 'L' : 'P' }}
                         </span>
                         <div class="min-w-0 flex-1">
                           <p class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">{{ p.nombre }}</p>
                           <p class="text-xs text-slate-500 dark:text-slate-400">{{ p.tipo === 'Salida' ? 'Punto de salida' : p.tipo === 'Lugar' ? 'Lugar de referencia' : 'Otro' }}</p>
                         </div>
                         <button *ngIf="puedeEditar()" (click)="deletePunto(p.id_punto)" [attr.aria-label]="'Borrar ' + p.nombre"
                           class="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors shrink-0">
                           <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                         </button>
                       </li>
                     }
                   </ul>
                 </section>
               }

               @if (selectedTerritorio()!.notas) {
                 <div class="bg-amber-50/60 dark:bg-amber-900/10 rounded-xl p-3.5 border border-amber-100 dark:border-amber-800/30 flex gap-2.5">
                   <svg class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                   <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{{ selectedTerritorio()!.notas }}</p>
                 </div>
               }
             }

             <!-- TAB: Manzanas -->
             @if (activeDetailTab() === 'manzanas') {
               @if (coberturaLoading()) {
                 <div class="flex flex-col items-center justify-center py-10 gap-3">
                   <div class="w-7 h-7 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                   <span class="text-xs text-slate-400">Cargando manzanas...</span>
                 </div>
               } @else if (manzanasConCobertura().length === 0) {
                 <div class="text-center py-10 text-slate-400">
                   <svg class="w-10 h-10 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                   <p class="text-sm font-semibold">Sin manzanas</p>
                   <p class="text-xs mt-1">Dibuja manzanas con el editor de mapa</p>
                 </div>
               } @else {
                 <!-- Summary bar -->
                 <div class="bg-gradient-to-r from-emerald-50 to-emerald-50/40 dark:from-emerald-900/20 dark:to-transparent rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800/30">
                   <div class="flex justify-between items-center mb-2">
                     <span class="text-xs font-black text-emerald-700 dark:text-emerald-400">{{ manzanasPredicadasCount() }} de {{ manzanasConCobertura().length }} predicadas</span>
                     <span class="text-lg font-black text-emerald-600 dark:text-emerald-400">{{ manzanasPorcentaje() | number:'1.0-0' }}%</span>
                   </div>
                   <div class="w-full h-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-full overflow-hidden">
                     <div class="h-full bg-emerald-500 rounded-full transition-all duration-700" [style.width.%]="manzanasPorcentaje()"></div>
                   </div>
                 </div>
                 <!-- Manzana list -->
                 <div class="space-y-1.5">
                   @for (m of manzanasConCobertura(); track m.id_manzana) {
                     @let isPredicada = m.ultimaCobertura?.estado === 'Predicada';
                     <div class="flex items-center gap-3 p-3 rounded-xl border transition-all"
                          [class]="isPredicada ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/30' : 'bg-white dark:bg-slate-800/60 border-slate-100 dark:border-slate-700/40 hover:border-emerald-200 dark:hover:border-emerald-800/40'">
                       <div class="min-w-[2.25rem] h-9 px-2 rounded-xl font-black text-xs flex items-center justify-center shrink-0 transition-colors text-center leading-tight"
                            [class]="isPredicada ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900' : 'bg-slate-100 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300'">
                         {{ m.numero_manzana }}
                       </div>
                       @if (editingManzanaId() === m.id_manzana) {
                         <!-- Inline edit mode -->
                         <input
                           type="text"
                           [value]="editingManzanaNombre()"
                           (input)="editingManzanaNombre.set($any($event.target).value)"
                           (keydown.enter)="saveEditManzana(m.id_manzana)"
                           (keydown.escape)="cancelEditManzana()"
                           class="flex-1 min-w-0 px-2 py-1 text-xs font-bold rounded-lg border border-blue-400 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                           autofocus
                         />
                         <button (click)="saveEditManzana(m.id_manzana)"
                           [disabled]="!editingManzanaNombre().trim() || manzanaRenaming() === m.id_manzana"
                           class="text-xs font-bold px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 shrink-0">
                           {{ manzanaRenaming() === m.id_manzana ? '...' : 'Ok' }}
                         </button>
                         <button (click)="cancelEditManzana()"
                           class="text-xs font-bold px-2 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 text-slate-600 dark:text-slate-200 rounded-lg transition-colors shrink-0">
                           ✕
                         </button>
                       } @else {
                         <div class="flex-1 min-w-0">
                           <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{{ m.numero_manzana }}</p>
                           @if (isPredicada) {
                             <p class="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                               <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                               Predicada · {{ m.ultimaCobertura!.fecha_inicio | date:'dd/MM/yy' }}
                             </p>
                           } @else {
                             <p class="text-xs text-slate-400">Pendiente</p>
                           }
                         </div>
                         <!-- Edit pencil button -->
                         <button *ngIf="puedeEditar()" (click)="startEditManzana(m)"
                           class="p-1.5 text-slate-300 hover:text-blue-500 dark:text-slate-600 dark:hover:text-blue-400 rounded-lg transition-colors shrink-0">
                           <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                         </button>
                         <!-- Delete button -->
                         <button *ngIf="puedeEditar()" (click)="deleteManzana(m.id_manzana)"
                           [disabled]="manzanaDeleting() === m.id_manzana"
                           class="p-1.5 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 rounded-lg transition-colors shrink-0 disabled:opacity-50">
                           @if (manzanaDeleting() === m.id_manzana) {
                             <div class="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                           } @else {
                             <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                           }
                         </button>
                         @if (!isPredicada) {
                           <button (click)="marcarManzanaPredicada(m.id_manzana)"
                             [disabled]="coberturaSaving() === m.id_manzana"
                             class="text-xs font-bold px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0">
                             {{ coberturaSaving() === m.id_manzana ? '...' : '✓ Marcar' }}
                           </button>
                         } @else {
                           <svg class="w-4 h-4 text-emerald-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                         }
                       }
                     </div>
                   }
                 </div>
               }
             }

             <!-- TAB: Asignaciones -->
             @if (activeDetailTab() === 'direcciones') {
               <div class="flex items-start justify-between gap-3">
                 <p class="text-xs text-slate-600 dark:text-slate-400">
                   Las direcciones marcadas <strong>No visitar</strong> salen en la tarjeta impresa y como aviso al registrar una salida.
                 </p>
                 @if (puedeEditar()) {
                   <button type="button" (click)="openDireccionModal()" [disabled]="manzanasLista().length === 0"
                     class="shrink-0 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                     Agregar dirección
                   </button>
                 }
               </div>

               @if (direccionesLoading()) {
                 <p class="text-sm text-slate-500">Cargando direcciones...</p>
               } @else if (manzanasLista().length === 0) {
                 <div class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-slate-500">
                   <p class="text-sm font-semibold">Primero hacen falta manzanas</p>
                   <p class="text-xs mt-1">Dibuja las manzanas del territorio y luego agrega sus direcciones.</p>
                 </div>
               } @else if (direccionesPorManzana().length === 0) {
                 <div class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-slate-500">
                   <p class="text-sm font-semibold">Aún no hay direcciones</p>
                   <p class="text-xs mt-1">Agrega las direcciones que quieras tener anotadas, por ejemplo las que no se deben visitar.</p>
                 </div>
               } @else {
                 @for (g of direccionesPorManzana(); track g.manzana) {
                   <div>
                     <h4 class="text-[0.6875rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Manzana {{ g.manzana }}</h4>
                     <ul class="space-y-2">
                       @for (v of g.items; track v.id_vivienda) {
                         <li class="rounded-xl border p-3"
                             [ngClass]="v.no_visitar
                               ? 'border-red-200 bg-red-50/60 dark:border-red-900/50 dark:bg-red-900/10'
                               : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'">
                           <div class="flex items-start justify-between gap-2">
                             <div class="min-w-0">
                               <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ textoDir(v) }}</p>
                               @if (v.idioma) { <p class="text-xs text-slate-500 dark:text-slate-400">Idioma: {{ v.idioma }}</p> }
                               @if (v.no_visitar) {
                                 <p class="mt-1 text-xs font-bold text-red-700 dark:text-red-400">No visitar
                                   @if (v.motivo_no_visitar) { <span class="font-medium"> · {{ v.motivo_no_visitar }}</span> }
                                 </p>
                                 @if (v.por_revisar) {
                                   <p class="text-xs font-semibold text-amber-700 dark:text-amber-400">Hace más de un año que no se confirma. ¿Sigue siendo así?</p>
                                 }
                               }
                               @if (v.notas) { <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ v.notas }}</p> }
                             </div>
                             @if (puedeEditar()) {
                               <div class="flex items-center gap-1 shrink-0">
                                 @if (v.no_visitar && v.por_revisar) {
                                   <button type="button" (click)="marcarRevisada(v)" class="px-2 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800 hover:bg-amber-200">Sigue igual</button>
                                 }
                                 <button type="button" (click)="openDireccionModal(v)" class="px-2 py-1 rounded-md text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Editar</button>
                                 @if (confirmarEliminarDireccion() === v.id_vivienda) {
                                   <button type="button" (click)="eliminarDireccion(v)" class="px-2 py-1 rounded-md text-xs font-bold bg-red-600 text-white">Sí, borrar</button>
                                   <button type="button" (click)="confirmarEliminarDireccion.set(null)" class="px-2 py-1 rounded-md text-xs font-bold text-slate-500">No</button>
                                 } @else {
                                   <button type="button" (click)="confirmarEliminarDireccion.set(v.id_vivienda)" class="px-2 py-1 rounded-md text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Borrar</button>
                                 }
                               </div>
                             }
                           </div>
                         </li>
                       }
                     </ul>
                   </div>
                 }
               }
             }

             @if (activeDetailTab() === 'asignaciones') {
               <!-- Asignación activa -->
               @if (asignacionActiva()) {
                 <div class="rounded-2xl border bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/40 p-4">
                   <div class="flex items-center gap-2 mb-3">
                     <div class="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                       <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                     </div>
                     <div>
                       <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Asignado a</p>
                       <p class="text-sm font-black text-slate-800 dark:text-white">{{ asignacionActiva()!.nombre_publicador ?? 'Publicador #' + asignacionActiva()!.id_publicador }}</p>
                     </div>
                   </div>
                   <p class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                     Desde {{ asignacionActiva()!.fecha_asignacion | date:'dd/MM/yyyy' }}
                   </p>
                   @if (asignacionActiva()!.notas) {
                     <p class="text-xs text-slate-500 italic mb-3 border-l-2 border-emerald-300 dark:border-emerald-700 pl-2">{{ asignacionActiva()!.notas }}</p>
                   }
                   <button (click)="openDevolverModal()" class="w-full py-2.5 text-xs font-bold bg-white dark:bg-slate-700 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2">
                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.51"/></svg>
                     Registrar Devolución
                   </button>
                 </div>
               } @else {
                 <div class="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
                   <svg class="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                   <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Disponible para asignar</p>
                   <button *ngIf="puedeEditar()" (click)="openAsignarModal()" class="w-full py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm shadow-emerald-900/10 flex items-center justify-center gap-2">
                     <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                     Asignar Territorio
                   </button>
                 </div>
               }

               <!-- Historial -->
               @if (historialAsignaciones().length > 0) {
               <div>
                 <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2.5">Historial</h4>
                 <div class="space-y-1.5">
                   @for (a of historialAsignaciones(); track a.id_asignacion) {
                     @if (!a.activa) {
                     <div class="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700/50">
                       <div class="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                         <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                       </div>
                       <div class="min-w-0 flex-1">
                         <p class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{{ a.nombre_publicador ?? 'Publicador #' + a.id_publicador }}</p>
                         <p class="text-xs text-slate-400">{{ a.fecha_asignacion | date:'dd/MM/yy' }} → {{ a.fecha_devolucion | date:'dd/MM/yy' }}</p>
                       </div>
                       <span class="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">Devuelto</span>
                     </div>
                     }
                   }
                 </div>
               </div>
               }
             }


           </div>

           <!-- Footer Actions -->
           <div class="p-4 border-t border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm grid grid-cols-3 gap-2">
              <button *ngIf="puedeEditar()" (click)="openEditInfoModal()"
                class="py-2.5 bg-slate-50 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex flex-col items-center justify-center gap-1 hover:border-slate-300 dark:hover:border-slate-500">
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                 Editar
              </button>
              <button *ngIf="puedeEditar()" (click)="openMapEditor()"
                class="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm shadow-emerald-900/15 transition-all flex flex-col items-center justify-center gap-1 active:scale-95">
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                 Dibujar
              </button>
              <button (click)="printCard()"
                class="py-2.5 bg-slate-50 dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-all flex flex-col items-center justify-center gap-1 hover:border-slate-300 dark:hover:border-slate-500">
                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                 Imprimir
              </button>
           </div>
        </aside>
        }

        <!-- Hidden card for print (offscreen) -->
        @if (showPrintCard() && selectedTerritorio()) {
          <div style="position: fixed; left: -9999px; top: 0;">
            <app-territorio-card
              [territorio]="selectedTerritorio()"
              [geojson]="selectedTerritorioGeoJSON()"
              [manzanasGeojson]="selectedManzanasGeoJSON()"
              [stats]="selectedStats()"
              [noVisitar]="noVisitarTarjeta()"
            />
          </div>
        }

      </div>
      
      <!-- Modal Asignar Territorio -->
      <!-- Modal: dirección -->
      @if (showDireccionModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="dir-titulo">
          <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="showDireccionModal.set(false)"></div>
          <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
              <h3 id="dir-titulo" class="text-base font-black text-slate-900 dark:text-white">{{ direccionForm.id_vivienda ? 'Editar dirección' : 'Agregar dirección' }}</h3>
            </div>
            <div class="p-5 space-y-4">
              @if (direccionError()) {
                <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-700 dark:text-red-400 font-medium">{{ direccionError() }}</div>
              }
              <div>
                <label for="dir-manzana" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Manzana *</label>
                <app-select-picker colorScheme="emerald" ariaLabel="Manzana" [(ngModel)]="direccionForm.id_manzana"
                  [options]="opcionesManzana()" placeholder="— Elige la manzana —" [clearable]="false"
                  [disabled]="!!direccionForm.id_vivienda" />
              </div>
              <div>
                <label for="dir-direccion" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Calle o dirección *</label>
                <input id="dir-direccion" type="text" [(ngModel)]="direccionForm.direccion" placeholder="Ej: Calle 5"
                  class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label for="dir-numero" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Número</label>
                  <input id="dir-numero" type="text" [(ngModel)]="direccionForm.numero" class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label for="dir-edificio" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Edificio</label>
                  <input id="dir-edificio" type="text" [(ngModel)]="direccionForm.edificio" class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label for="dir-apto" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Apto.</label>
                  <input id="dir-apto" type="text" [(ngModel)]="direccionForm.apartamento" class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
                </div>
              </div>
              <div>
                <label for="dir-idioma" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Idioma (opcional)</label>
                <input id="dir-idioma" type="text" [(ngModel)]="direccionForm.idioma" class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
              </div>
              <label class="flex items-start gap-3 p-3 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10 cursor-pointer">
                <input type="checkbox" [(ngModel)]="direccionForm.no_visitar" class="mt-0.5 w-4 h-4 accent-red-600" />
                <span class="text-sm font-semibold text-slate-800 dark:text-slate-100">No visitar esta dirección
                  <span class="block text-xs font-normal text-slate-500 dark:text-slate-400">Se confirmará cada año.</span>
                </span>
              </label>
              @if (direccionForm.no_visitar) {
                <div>
                  <label for="dir-motivo" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Motivo (opcional)</label>
                  <input id="dir-motivo" type="text" [(ngModel)]="direccionForm.motivo_no_visitar" placeholder="Ej: Lo pidió el dueño"
                    class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
                </div>
              }
              <div>
                <label for="dir-notas" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas (opcional)</label>
                <input id="dir-notas" type="text" [(ngModel)]="direccionForm.notas" class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
              </div>
            </div>
            <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 flex justify-end gap-2">
              <button type="button" (click)="showDireccionModal.set(false)" class="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button>
              <button type="button" (click)="saveDireccion()" [disabled]="direccionSaving() || !direccionForm.id_manzana || !direccionForm.direccion?.trim()"
                class="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                {{ direccionSaving() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (showAsignarModal()) {
      <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="showAsignarModal.set(false)"></div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm relative z-10 shadow-2xl overflow-hidden animate-fadeIn">
          <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
            <h3 class="text-base font-black text-slate-900 dark:text-white">Asignar Territorio</h3>
            <p class="text-xs text-slate-500 mt-0.5">{{ selectedTerritorio()?.codigo }} — {{ selectedTerritorio()?.nombre }}</p>
          </div>
          <div class="p-5 space-y-4">
            @if (asignacionError()) {
              <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-700 dark:text-red-400 font-medium">{{ asignacionError() }}</div>
            }
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Publicador *</label>
              <input type="text" [(ngModel)]="busquedaPublicador" placeholder="Escribe para buscar..."
                class="w-full mb-2 px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <app-select-picker colorScheme="emerald" ariaLabel="Publicador" [(ngModel)]="newAsignacion.id_publicador"
                [options]="opcionesPublicador()" placeholder="— Elige un publicador —" [clearable]="false" [searchable]="false" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha de Asignación</label>
              <input type="date" [(ngModel)]="newAsignacion.fecha_asignacion"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas (opcional)</label>
              <input type="text" [(ngModel)]="newAsignacion.notas" placeholder="Observaciones..."
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 flex gap-3">
            <button (click)="showAsignarModal.set(false)" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button (click)="saveAsignacion()" [disabled]="!newAsignacion.id_publicador || asignacionSaving()"
              class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-50">
              {{ asignacionSaving() ? 'Guardando...' : 'Asignar' }}
            </button>
          </div>
        </div>
      </div>
      }

      <!-- Modal Devolver Territorio -->
      @if (showDevolverModal()) {
      <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="showDevolverModal.set(false)"></div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm relative z-10 shadow-2xl overflow-hidden animate-fadeIn">
          <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
            <h3 class="text-base font-black text-slate-900 dark:text-white">Registrar Devolución</h3>
            <p class="text-xs text-slate-500 mt-0.5">Asignado a: {{ asignacionActiva()?.nombre_publicador }}</p>
          </div>
          <div class="p-5 space-y-4">
            @if (asignacionError()) {
              <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-700 dark:text-red-400 font-medium">{{ asignacionError() }}</div>
            }
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha de Devolución</label>
              <input type="date" [(ngModel)]="devolucionData.fecha_devolucion"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas (opcional)</label>
              <input type="text" [(ngModel)]="devolucionData.notas" placeholder="Observaciones..."
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 flex gap-3">
            <button (click)="showDevolverModal.set(false)" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
            <button (click)="saveDevolucion()" [disabled]="asignacionSaving()"
              class="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors disabled:opacity-50">
              {{ asignacionSaving() ? 'Guardando...' : 'Registrar Devolución' }}
            </button>
          </div>
        </div>
      </div>
      }

      <!-- Modal Nuevo Territorio -->
      @if (showCreateModal()) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="closeCreateModal()"></div>
        
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-fadeIn">
          <div class="p-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between">
            <h3 class="text-lg font-black text-slate-900 dark:text-white">Nueva tarjeta</h3>
            <button (click)="closeCreateModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Código</label>
              <input type="text" [(ngModel)]="newTerritorio.codigo" placeholder="Ej: T-01" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Nombre</label>
              <input type="text" [(ngModel)]="newTerritorio.nombre" placeholder="Ej: Centro Norte" class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Estado Inicial</label>
              <app-select-picker colorScheme="emerald" ariaLabel="Estado inicial" [(ngModel)]="newTerritorio.estado_territorio"
                [options]="opcionesEstadoNuevo" [clearable]="false" [searchable]="false" />
            </div>
            @if (sectores().length > 0) {
              <div>
                <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Sector <span class="font-normal normal-case text-slate-400">(opcional)</span></label>
                <app-select-picker colorScheme="emerald" ariaLabel="Sector" [(ngModel)]="newTerritorio.id_sector"
                  [options]="opcionesSector()" placeholder="Sin sector" [searchable]="false" />
              </div>
            }
          </div>
          
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end gap-3">
            <button (click)="closeCreateModal()" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">Cancelar</button>
            <button (click)="saveNewTerritorio()" [disabled]="!newTerritorio.codigo || !newTerritorio.nombre || saving()" class="px-5 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-purple-600/20 flex items-center gap-2">
              @if (saving()) {
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              }
              Guardar
            </button>
          </div>
        </div>
      </div>
      }

      <!-- Modal Editar Info -->
      @if (showEditInfoModal() && selectedTerritorio()) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="closeEditInfoModal()"></div>

        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md relative z-10 shadow-2xl overflow-hidden animate-fadeIn">

          <!-- Header -->
          <div class="px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-gradient-to-r from-emerald-50/60 to-white dark:from-emerald-900/10 dark:to-slate-800">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg class="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              </div>
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white leading-tight">Editar Territorio</h3>
                <p class="text-[0.7rem] text-slate-400 font-medium">{{ selectedTerritorio()!.codigo }} · {{ selectedTerritorio()!.nombre }}</p>
              </div>
            </div>
            <button (click)="closeEditInfoModal()" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
              <svg class="w-4.5 h-4.5" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Form -->
          <div class="px-6 py-5 space-y-4">

            <!-- Error feedback -->
            @if (editInfoError()) {
              <div class="flex items-center gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3">
                <svg class="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <p class="text-xs font-semibold text-red-600 dark:text-red-400">{{ editInfoError() }}</p>
              </div>
            }

            <!-- Código -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Código</label>
              <input
                type="text"
                [(ngModel)]="editingTerritorioInfo.codigo"
                placeholder="Ej: T-01"
                class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              >
            </div>

            <!-- Nombre -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Nombre</label>
              <input
                type="text"
                [(ngModel)]="editingTerritorioInfo.nombre"
                placeholder="Ej: Centro Norte"
                class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              >
            </div>

            <!-- Estado -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Estado</label>
              <app-select-picker colorScheme="emerald" ariaLabel="Estado" [(ngModel)]="editingTerritorioInfo.estado_territorio"
                [options]="opcionesEstadoEditar" [clearable]="false" [searchable]="false" />
            </div>

            <!-- Sector -->
            @if (sectores().length > 0) {
              <div>
                <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Sector <span class="font-normal normal-case text-slate-400">(opcional)</span></label>
                <app-select-picker colorScheme="emerald" ariaLabel="Sector" [(ngModel)]="editingTerritorioInfo.id_sector"
                  [options]="opcionesSector()" placeholder="Sin sector" [searchable]="false" />
              </div>
            }

            <!-- Notas -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Notas / Instrucciones <span class="font-normal normal-case text-slate-400">(opcional)</span></label>
              <textarea
                [(ngModel)]="editingTerritorioInfo.notas"
                rows="3"
                placeholder="Ej: Zona residencial, muchas rejas..."
                class="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none"
              ></textarea>
            </div>
          </div>

          <!-- Eliminar territorio -->
          @if (puedeEditar()) {
            <div class="px-6 py-3 border-t border-slate-100 dark:border-slate-700/50">
              @if (!confirmandoEliminar()) {
                <button type="button" (click)="confirmandoEliminar.set(true)" class="text-sm font-bold text-red-600 dark:text-red-400 hover:underline">Eliminar este territorio</button>
              } @else {
                <div class="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-3 space-y-2" role="alert">
                  <p class="text-sm font-semibold text-red-800 dark:text-red-300">
                    ¿Eliminar {{ selectedTerritorio()!.codigo }}? Se borran también sus manzanas, direcciones y puntos. No se puede deshacer.
                  </p>
                  <div class="flex flex-wrap gap-2">
                    <button type="button" (click)="eliminarTerritorio()" [disabled]="saving()" class="px-3 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">Sí, eliminar</button>
                    <button type="button" (click)="confirmandoEliminar.set(false)" class="px-3 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700 rounded-lg">No</button>
                    @if (puedeRetirar()) {
                      <button type="button" (click)="retirarTerritorio()" class="px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-lg">Marcar como Inactivo</button>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- Footer -->
          <div class="px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end gap-3">
            <button (click)="closeEditInfoModal()" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">
              Cancelar
            </button>
            <button
              (click)="saveEditInfo()"
              [disabled]="!editingTerritorioInfo.nombre || !editingTerritorioInfo.codigo || saving()"
              class="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
            >
              @if (saving()) {
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              } @else {
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              }
              Guardar Cambios
            </button>
          </div>
        </div>
      </div>
      }
        
      <!-- Modal Editar Mapa -->
      @if (showMapEditModal() && selectedTerritorio()) {
      <div class="fixed inset-0 z-[100] flex items-center justify-center sm:p-4">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="closeMapEditor()"></div>

        <div class="bg-white dark:bg-slate-800 sm:rounded-2xl sm:border border-slate-200 dark:border-slate-700 w-full max-w-6xl h-[100dvh] sm:h-[88vh] flex flex-col relative z-10 shadow-2xl overflow-hidden animate-fadeIn">

          <!-- Header -->
          <div class="px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-4 shrink-0 bg-gradient-to-r from-purple-50/60 to-white dark:from-purple-900/10 dark:to-slate-800">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                <svg class="text-[#6D28D9] dark:text-purple-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">Editor cartográfico</h3>
                  <span class="px-2 py-0.5 rounded-md bg-slate-900/5 dark:bg-white/10 text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">{{ selectedTerritorio()!.codigo }}</span>
                </div>
                <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium truncate mt-0.5">
                  {{ selectedTerritorio()!.nombre }}<span class="hidden md:inline"> · Siga los pasos 1, 2 y 3 de la barra del mapa</span>
                </p>
              </div>
            </div>
            <button (click)="closeMapEditor()" title="Cerrar editor" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors shrink-0">
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div class="flex-1 min-h-0 p-2 sm:p-3 bg-slate-50 dark:bg-slate-900/40">
           <div class="relative h-full rounded-xl ring-1 ring-slate-200 dark:ring-slate-700 bg-slate-100 dark:bg-slate-900">
            <app-territorio-map
              [geojson]="editingGeoJSON()"
              [manzanasGeojson]="selectedManzanasGeoJSON()"
              [puntosGeojson]="selectedPuntosGeoJSON()"
              height="100%"
              [enableDrawing]="true"
              [interactive]="true"
              [referenciasGeojson]="editorReferencias()"
              [centroInicial]="editorCentro()"
              [propuestasGeojson]="propuestasManzanas()"
              [detectando]="detectandoManzanas()"
              [guardandoPropuestas]="guardandoPropuestas()"
              [avisoEditor]="avisoEditor()"
              (geometryChanged)="onGeometryChanged($event)"
              (manzanaDrawn)="onManzanaDrawn($event)"
              (puntoPlaced)="onPuntoPlaced($event)"
              (detectar)="onDetectarManzanas($event)"
              (guardarPropuestas)="onGuardarPropuestas($event)"
              (descartarPropuestas)="propuestasManzanas.set(null)"
              (manzanaBorrar)="deleteManzana($event)"
            />
           </div>
          </div>

          <div class="px-4 sm:px-6 py-3.5 border-t border-slate-100 dark:border-slate-700/50 flex flex-col gap-3 shrink-0">
            @if (geoSaveError()) {
              <div class="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3">
                <svg class="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                <p class="text-xs font-semibold text-red-600 dark:text-red-400 leading-snug">{{ geoSaveError() }}</p>
              </div>
            }
            <div class="flex flex-wrap items-center justify-end gap-3">
              <p class="mr-auto inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors"
                 [class]="limiteSinGuardar() ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-800/50' : 'text-slate-500 dark:text-slate-400'">
                <span class="relative flex w-2 h-2">
                  @if (limiteSinGuardar()) { <span class="absolute inset-0 rounded-full bg-amber-500 animate-ping opacity-60"></span> }
                  <span class="relative w-2 h-2 rounded-full" [class]="limiteSinGuardar() ? 'bg-amber-500' : 'bg-emerald-500'"></span>
                </span>
                {{ limiteSinGuardar() ? 'El límite tiene cambios sin guardar' : 'Todo guardado · las manzanas y los puntos se guardan solos' }}
              </p>
              <div class="flex w-full sm:w-auto gap-2">
                <button (click)="closeMapEditor()" class="flex-1 sm:flex-none whitespace-nowrap px-4 sm:px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors active:scale-[0.97]">Cerrar editor</button>
                <button (click)="saveGeometry()" [disabled]="saving() || !limiteSinGuardar()" class="flex-[2] sm:flex-none justify-center px-5 py-2.5 text-sm font-bold rounded-xl transition-[background-color,box-shadow,transform] flex items-center gap-2 active:scale-[0.97] text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed disabled:active:scale-100 dark:disabled:bg-slate-700/60 dark:disabled:text-slate-500">
                  @if (saving()) {
                    <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  } @else {
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  }
                  Guardar límite
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      }
    </div>
  `,
   styles: [`
    :host { display: block; height: 100%; }
    .simple-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
    .simple-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .simple-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .simple-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  `]
})
export class TerritoriosPage implements OnInit {
   private territoriosService = inject(TerritoriosService);
   private authStore = inject(AuthStore);
   /** Crear, editar o borrar del catálogo exige 'territorios.editar' (el
    *  backend también). Registrar la predicación y devolver solo 'ver'. */
   puedeEditar = computed(() => {
      this.authStore.user();
      return this.authStore.hasPermission('territorios.editar');
   });
   private router = inject(Router);
   private route = inject(ActivatedRoute);
   private congregacionCtx = inject(CongregacionContextService);

   publicadores = signal<PublicadorOpcion[]>([]);
   busquedaPublicadorSig = signal('');
   get busquedaPublicador(): string { return this.busquedaPublicadorSig(); }
   set busquedaPublicador(v: string) { this.busquedaPublicadorSig.set(v ?? ''); }
   publicadoresFiltrados = computed(() => {
      const q = this.busquedaPublicadorSig().trim().toLowerCase();
      const lista = this.publicadores()
         .map(p => ({ p, n: nombreMostrado(p) }))
         .sort((a, b) => a.n.localeCompare(b.n, 'es'));
      return (q ? lista.filter(x => x.n.toLowerCase().includes(q)) : lista).map(x => x.p);
   });
   nombreDe = (p: PublicadorOpcion) => nombreMostrado(p);

   // Opciones de los selectores propios (select-picker). Las listas fijas son constantes;
   // las que dependen de datos son computed para no recrear el arreglo en cada ciclo.
   readonly opcionesEstadoFiltro: PickerOption[] = [
      { value: 'Disponible', label: 'Disponible' },
      { value: 'Asignado', label: 'Asignado' },
      { value: 'En Pausa', label: 'En pausa' },
      { value: 'Inactivo', label: 'Inactivo (retirados)' },
   ];
   readonly opcionesEstadoNuevo: PickerOption[] = this.opcionesEstadoFiltro.slice(0, 3);
   readonly opcionesEstadoEditar: PickerOption[] = this.opcionesEstadoFiltro.map(o =>
      o.value === 'Inactivo' ? { ...o, label: 'Inactivo', hint: 'Retirado; conserva su historial' } : o);
   opcionesManzana = computed<PickerOption[]>(() =>
      this.manzanasLista().map(m => ({ value: m.id_manzana, label: `Manzana ${m.numero_manzana || m.id_manzana}` })));
   opcionesPublicador = computed<PickerOption[]>(() =>
      this.publicadoresFiltrados().map(p => ({ value: p.id_publicador, label: this.nombreDe(p) })));

   // Signals con getter/setter: ngModel sigue enlazando campos, pero los computed
   // (filteredTerritorios, chips) se recalculan al escribir o cambiar el filtro.
   private searchQuerySig = signal('');
   private estadoFilterSig = signal('');
   private sectorFilterSig = signal<string>('');
   get sectorFilter(): string { return this.sectorFilterSig(); }
   set sectorFilter(v: string | number | null) { this.sectorFilterSig.set(v == null ? '' : String(v)); this.currentPage.set(1); }

   /** Sectores de la congregación (vacío si aún no se crearon: entonces no se muestra nada de sectores). */
   sectores = signal<Sector[]>([]);
   private sectoresPorId = computed(() => new Map(this.sectores().map(s => [s.id_sector, s])));
   sectorDe(t: Territorio): Sector | null {
      return t.id_sector != null ? this.sectoresPorId().get(t.id_sector) ?? null : null;
   }
   opcionesSector = computed<PickerOption[]>(() =>
      this.sectores().map(s => ({ value: s.id_sector, label: s.nombre })));
   opcionesSectorFiltro = computed<PickerOption[]>(() => {
      const activos = this.territoriosActivos();
      const cuenta = (id: number) => activos.filter(t => t.id_sector === id).length;
      const sin = activos.filter(t => t.id_sector == null).length;
      return [
         ...this.sectores().map(s => ({ value: String(s.id_sector), label: `${s.nombre} (${cuenta(s.id_sector)})` })),
         { value: 'sin', label: `Sin sector (${sin})` },
      ];
   });

   irASectores(): void {
      this.router.navigate(['/territorios/sectores']);
   }

   private cargarSectores(): void {
      this.territoriosService.getSectores().subscribe({
         next: (r) => this.sectores.set(r.sectores),
         error: () => this.sectores.set([]),
      });
   }
   get searchQuery(): string { return this.searchQuerySig(); }
   set searchQuery(v: string) { this.searchQuerySig.set(v ?? ''); this.currentPage.set(1); }
   get estadoFilter(): string { return this.estadoFilterSig(); }
   set estadoFilter(v: string) { this.estadoFilterSig.set(v ?? ''); this.currentPage.set(1); }
   chip = signal<'' | 'atrasados' | 'nunca' | 'en_curso' | 'por_revisar'>('');
   resumen = signal<Map<number, ResumenTerritorio>>(new Map());
   textoDias = textoDiasSinTrabajar;
   loading = signal(true);
   loadError = signal(false);
   saving = signal(false);
   showPrintCard = signal(false);
   showCreateModal = signal(false);
   showMapEditModal = signal(false);
   geoSaveError = signal<string | null>(null);
   // Editor de mapa
   editorReferencias = signal<GeoJSONFeatureCollection | null>(null);
   editorCentro = signal<{ lat: number; lng: number } | null>(null);
   propuestasManzanas = signal<GeoJSONFeatureCollection | null>(null);
   detectandoManzanas = signal(false);
   guardandoPropuestas = signal(false);
   avisoEditor = signal<string | null>(null);
   limiteSinGuardar = signal(false);
   showEditInfoModal = signal(false);
   confirmandoEliminar = signal(false);
   /** Tras un 409 (tiene historial) se ofrece retirarlo en vez de borrarlo. */
   puedeRetirar = signal(false);
   editInfoError = signal<string | null>(null);

   newTerritorio: Partial<Territorio> = {
      codigo: '',
      nombre: '',
      estado_territorio: 'Disponible'
   };
   
   editingTerritorioInfo: Partial<Territorio> = {
      codigo: '',
      nombre: '',
      estado_territorio: 'Disponible',
      notas: ''
   };

   territorios = signal<Territorio[]>([]);
   selectedTerritorio = signal<Territorio | null>(null);
   selectedStats = signal<TerritorioStats | null>(null);
   selectedTerritorioGeoJSON = signal<GeoJSONFeatureCollection | null>(null);
   selectedTerritorioPolygon = signal<GeoJSONFeatureCollection | null>(null);
   selectedManzanasGeoJSON = signal<GeoJSONFeatureCollection | null>(null);
   selectedPuntosGeoJSON = signal<GeoJSONFeatureCollection | null>(null);
   puntos = signal<Punto[]>([]);

   // Asignaciones
   asignacionActiva = signal<AsignacionTerritorio | null>(null);
   historialAsignaciones = signal<AsignacionTerritorio[]>([]);
   showAsignarModal = signal(false);
   showDevolverModal = signal(false);
   asignacionSaving = signal(false);
   asignacionError = signal<string | null>(null);
   newAsignacion: { id_publicador: number | null; fecha_asignacion: string; notas: string } = {
     id_publicador: null,
     fecha_asignacion: new Date().toISOString().split('T')[0],
     notas: '',
   };
   devolucionData: { fecha_devolucion: string; notas: string } = {
     fecha_devolucion: new Date().toISOString().split('T')[0],
     notas: '',
   };

   // Manzanas con cobertura (Fase 4)
   manzanasConCobertura = signal<Array<Manzana & { ultimaCobertura?: CoberturaManzana }>>([]);
   coberturaLoading = signal(false);
   coberturaSaving = signal<number | null>(null); // id_manzana siendo guardado
   editingManzanaId = signal<number | null>(null);
   editingManzanaNombre = signal('');
   manzanaRenaming = signal<number | null>(null);
   manzanaDeleting = signal<number | null>(null);
   activeDetailTab = signal<'info' | 'manzanas' | 'direcciones' | 'asignaciones'>('info');
   manzanaSaving = signal(false);

   readonly tabs: Array<{ id: 'info' | 'manzanas' | 'direcciones' | 'asignaciones'; label: string; icon: string }> = [
     { id: 'info',        label: 'Resumen',  icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' },
     { id: 'manzanas',   label: 'Manzanas',     icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
     { id: 'direcciones', label: 'Direcciones', icon: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
     { id: 'asignaciones', label: 'Asignación', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' },
   ];

   // Editor State
   editingGeoJSON = signal<GeoJSONFeatureCollection | null>(null);
   lastEditedGeoJSON = signal<GeoJSONFeatureCollection | null>(null);


   // Direcciones y "no visitar"
   textoDir = textoDireccion;
   direcciones = signal<ViviendaDeTerritorio[]>([]);
   manzanasLista = signal<Manzana[]>([]);
   direccionesLoading = signal(false);
   showDireccionModal = signal(false);
   direccionSaving = signal(false);
   direccionError = signal<string | null>(null);
   confirmarEliminarDireccion = signal<number | null>(null);
   porRevisar = signal<Record<string, number>>({});
   noVisitarTarjeta = signal<ViviendaDeTerritorio[]>([]);
   direccionForm: Omit<Partial<ViviendaDeTerritorio>, 'id_manzana'> & { id_manzana: number | null } = { id_manzana: null };

   direccionesPorManzana = computed(() => {
      const grupos = new Map<string, ViviendaDeTerritorio[]>();
      for (const v of this.direcciones()) {
         const clave = v.numero_manzana || String(v.id_manzana);
         grupos.set(clave, [...(grupos.get(clave) ?? []), v]);
      }
      return [...grupos.entries()].map(([manzana, items]) => ({ manzana, items }));
   });

   loadDirecciones(): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.direccionesLoading.set(true);
      forkJoin({
         manzanas: this.territoriosService.getManzanas(t.id_territorio),
         viviendas: this.territoriosService.getViviendasTerritorio(t.id_territorio),
      }).subscribe({
         next: ({ manzanas, viviendas }) => {
            this.manzanasLista.set(manzanas);
            this.direcciones.set(viviendas);
            this.direccionesLoading.set(false);
         },
         error: () => this.direccionesLoading.set(false),
      });
   }

   loadPorRevisar(): void {
      this.territoriosService.getNoVisitarPorRevisar().subscribe({
         next: (r) => this.porRevisar.set(r),
         error: () => this.porRevisar.set({}),
      });
   }

   openDireccionModal(v?: ViviendaDeTerritorio): void {
      this.direccionError.set(null);
      this.direccionForm = v
         ? { ...v }
         : {
            id_manzana: this.manzanasLista().length === 1 ? this.manzanasLista()[0].id_manzana : null,
            direccion: '', numero: '', edificio: '', apartamento: '', idioma: '', notas: '',
            no_visitar: false, motivo_no_visitar: '',
         };
      this.showDireccionModal.set(true);
   }

   saveDireccion(): void {
      const f = this.direccionForm;
      if (!f.id_manzana || !f.direccion?.trim()) return;
      this.direccionSaving.set(true);
      this.direccionError.set(null);
      const cuerpo = {
         direccion: f.direccion.trim(),
         numero: f.numero ?? '',
         edificio: f.edificio ?? '',
         apartamento: f.apartamento ?? '',
         idioma: f.idioma ?? '',
         notas: f.notas ?? '',
         no_visitar: !!f.no_visitar,
         motivo_no_visitar: f.motivo_no_visitar ?? '',
      };
      const obs = f.id_vivienda
         ? this.territoriosService.updateVivienda(f.id_manzana, f.id_vivienda, cuerpo)
         : this.territoriosService.createVivienda(f.id_manzana, cuerpo);
      obs.subscribe({
         next: () => {
            this.direccionSaving.set(false);
            this.showDireccionModal.set(false);
            this.loadDirecciones();
            this.loadPorRevisar();
         },
         error: (err) => {
            this.direccionSaving.set(false);
            this.direccionError.set(err?.error?.detail || 'No se pudo guardar la dirección.');
         },
      });
   }

   marcarRevisada(v: ViviendaDeTerritorio): void {
      this.territoriosService.revisarVivienda(v.id_manzana, v.id_vivienda).subscribe({
         next: () => { this.loadDirecciones(); this.loadPorRevisar(); },
      });
   }

   eliminarDireccion(v: ViviendaDeTerritorio): void {
      this.territoriosService.deleteVivienda(v.id_manzana, v.id_vivienda).subscribe({
         next: () => {
            this.confirmarEliminarDireccion.set(null);
            this.loadDirecciones();
            this.loadPorRevisar();
         },
      });
   }

   // Pagination
   pageSize = 20;
   currentPage = signal(1);

   // Computed KPIs
   /** Los Inactivos solo se ven al filtrar por ellos; no cuentan en los KPIs. */
   territoriosActivos = computed(() =>
     this.territorios().filter(t => t.estado_territorio !== 'Inactivo')
   );
   asignadosCount = computed(() =>
     this.territorios().filter(t => t.estado_territorio === 'Asignado').length
   );
   disponiblesCount = computed(() =>
     this.territorios().filter(t => t.estado_territorio === 'Disponible').length
   );

   /** Pasados estos días sin predicar, el territorio pide atención (4 meses). */
   readonly DIAS_ATRASADO = 120;
   /** Pasados estos, es urgente (6 meses). */
   readonly DIAS_CRITICO = 180;

   resumenDe(id: number): ResumenTerritorio | undefined {
      return this.resumen().get(id);
   }

   /** Punto de color junto a la última predicación: verde al día, ámbar 4 meses, rojo 6 meses. */
   alertaDe(id: number): string {
      const r = this.resumenDe(id);
      if (!r || r.dias_sin_trabajar === null) return 'bg-slate-300 dark:bg-slate-600';
      if (r.dias_sin_trabajar >= this.DIAS_CRITICO) return 'bg-red-500';
      if (r.dias_sin_trabajar >= this.DIAS_ATRASADO) return 'bg-amber-500';
      return 'bg-emerald-500';
   }

   textoUltima(r: ResumenTerritorio | undefined): string {
      if (!r || r.dias_sin_trabajar === null) return 'Nunca trabajado';
      const t = this.textoDias(r.dias_sin_trabajar);
      return t.charAt(0).toUpperCase() + t.slice(1);
   }

   /** Subtítulo de la página: el estado de un vistazo en lugar de tarjetas de cifras. */
   resumenEncabezado = computed(() => {
      if (this.loading()) return 'Cargando…';
      const total = this.territoriosActivos().length;
      if (total === 0) return 'Aún no hay territorios registrados.';
      const partes = [
         `${total} ${total === 1 ? 'territorio' : 'territorios'}`,
         `${this.asignadosCount()} ${this.asignadosCount() === 1 ? 'asignado' : 'asignados'}`,
         `${this.disponiblesCount()} ${this.disponiblesCount() === 1 ? 'disponible' : 'disponibles'}`,
      ];
      return partes.join(' · ');
   });

   limpiarFiltros(): void {
      this.searchQuery = '';
      this.estadoFilter = '';
      this.sectorFilter = '';
      this.chip.set('');
   }

   chips = computed(() => {
      const sector = this.sectorFilterSig();
      const enSector = this.territoriosActivos().filter(t =>
         !sector || (sector === 'sin' ? t.id_sector == null : String(t.id_sector) === sector));
      const filas = enSector.map(t => this.resumen().get(t.id_territorio));
      const cuenta = {
         atrasados: filas.filter(r => r && r.dias_sin_trabajar !== null && r.dias_sin_trabajar >= this.DIAS_ATRASADO).length,
         nunca: filas.filter(r => r && r.dias_sin_trabajar === null).length,
         en_curso: filas.filter(r => r?.en_curso).length,
      };
      const porRevisar = Object.keys(this.porRevisar()).length;
      const extra = porRevisar > 0
         ? [{ id: 'por_revisar' as const, etiqueta: 'No visitar por revisar', cuenta: porRevisar, activo: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700' }]
         : [];
      return [
         ...extra,
         { id: 'atrasados' as const, etiqueta: 'Más de 4 meses sin trabajar', cuenta: cuenta.atrasados, activo: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700' },
         { id: 'nunca' as const, etiqueta: 'Nunca trabajados', cuenta: cuenta.nunca, activo: 'bg-slate-200 text-slate-800 border-slate-400 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-500' },
         { id: 'en_curso' as const, etiqueta: 'Vuelta en curso', cuenta: cuenta.en_curso, activo: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700' },
      ];
   });

   filteredTerritorios = computed(() => {
      const q = this.searchQuerySig().toLowerCase();
      const estado = this.estadoFilterSig();
      const sector = this.sectorFilterSig();
      const chip = this.chip();
      const resumen = this.resumen();
      const lista = this.territorios().filter(t => {
         const matchesSearch =
           t.nombre.toLowerCase().includes(q) ||
           t.codigo.toLowerCase().includes(q);
         const matchesEstado = estado
           ? t.estado_territorio === estado
           : t.estado_territorio !== 'Inactivo';
         const r = resumen.get(t.id_territorio);
         const matchesChip =
           !chip ||
           (chip === 'atrasados' && !!r && r.dias_sin_trabajar !== null && r.dias_sin_trabajar >= this.DIAS_ATRASADO) ||
           (chip === 'nunca' && !!r && r.dias_sin_trabajar === null) ||
           (chip === 'en_curso' && !!r?.en_curso) ||
           (chip === 'por_revisar' && (this.porRevisar()[String(t.id_territorio)] ?? 0) > 0);
         const matchesSector = !sector
           || (sector === 'sin' ? t.id_sector == null : String(t.id_sector) === sector);
         return matchesSearch && matchesEstado && matchesSector && matchesChip;
      });
      // Por código (T2 antes que T10); con el chip de atrasados, lo más urgente primero.
      lista.sort((a, b) => (a.codigo ?? '').localeCompare(b.codigo ?? '', 'es', { numeric: true }));
      if (chip === 'atrasados') {
         lista.sort((a, b) => (resumen.get(b.id_territorio)?.dias_sin_trabajar ?? 0) - (resumen.get(a.id_territorio)?.dias_sin_trabajar ?? 0));
      }
      return lista;
   });

   totalPages = computed(() => {
      const total = Math.ceil(this.filteredTerritorios().length / this.pageSize);
      return Array.from({ length: total }, (_, i) => i + 1);
   });

   paginatedTerritorios = computed(() => {
      const start = (this.currentPage() - 1) * this.pageSize;
      return this.filteredTerritorios().slice(start, start + this.pageSize);
   });

   paginationStart = computed(() => {
      if (this.filteredTerritorios().length === 0) return 0;
      return (this.currentPage() - 1) * this.pageSize + 1;
   });

   paginationEnd = computed(() => {
      const end = this.currentPage() * this.pageSize;
      return Math.min(end, this.filteredTerritorios().length);
   });

   ngOnInit(): void {
      this.cargarSectores();
      const sectorUrl = this.route.snapshot.queryParamMap.get('sector');
      if (sectorUrl) this.sectorFilter = sectorUrl;
      this.loadTerritorios();
      this.territoriosService.getPublicadores(this.congregacionCtx.effectiveCongregacionId())
         .subscribe({ next: (list) => this.publicadores.set(list) });
   }

   loadResumen(): void {
      this.territoriosService.getResumen().subscribe({
         next: (filas) => this.resumen.set(new Map(filas.map(f => [f.id_territorio, f]))),
         error: () => this.resumen.set(new Map()),
      });
   }

   loadTerritorios(): void {
      this.loading.set(true);
      this.loadError.set(false);
      this.territoriosService.getTerritorios(0, 500, true).pipe(timeout(15000)).subscribe({
         next: (data) => {
            this.territorios.set(data);
            this.loading.set(false);
            this.loadResumen();
            this.loadPorRevisar();
            this.abrirSeleccionDeUrl(data);
         },
         error: () => {
            this.loading.set(false);
            this.loadError.set(true);
         },
      });
   }

   /** Llegar desde el mapa general (?selected=id): abre ese territorio y limpia la URL. */
   private abrirSeleccionDeUrl(lista: Territorio[]): void {
      const id = Number(this.route.snapshot.queryParamMap.get('selected'));
      if (!id) return;
      const t = lista.find(x => x.id_territorio === id);
      if (t) {
         this.selectTerritorio(t);
         // En la lista paginada puede quedar en otra página: llevarla a la del territorio.
         const idx = this.filteredTerritorios().findIndex(x => x.id_territorio === id);
         if (idx >= 0) this.currentPage.set(Math.floor(idx / this.pageSize) + 1);
      }
      this.router.navigate([], { relativeTo: this.route, queryParams: { selected: null }, queryParamsHandling: 'merge', replaceUrl: true });
   }

   selectTerritorio(t: Territorio): void {
      this.selectedTerritorio.set(t);
      this.selectedStats.set(null);
      this.selectedTerritorioGeoJSON.set(null);
      this.selectedTerritorioPolygon.set(null);
      this.selectedManzanasGeoJSON.set(null);
      this.selectedPuntosGeoJSON.set(null);
      this.puntos.set([]);
      this.activeDetailTab.set('info');
      this.asignacionActiva.set(null);
      this.historialAsignaciones.set([]);
      this.manzanasConCobertura.set([]);
      this.direcciones.set([]);
      this.manzanasLista.set([]);
      this.confirmarEliminarDireccion.set(null);

      // Load stats
      this.territoriosService.getTerritorioStats(t.id_territorio).subscribe({
         next: (stats) => this.selectedStats.set(stats),
      });

      // Load asignacion activa + historial
      this.loadAsignaciones(t.id_territorio);

      // Load geojson for mini-map
      if (t.coordenada) {
         const fc: GeoJSONFeatureCollection = {
            type: 'FeatureCollection',
            features: [{
               type: 'Feature',
               id: t.id_territorio,
               properties: { codigo: t.codigo, nombre: t.nombre, estado_territorio: t.estado_territorio },
               geometry: t.coordenada,
            }],
         };
         // Store territory polygon separately for map editor and info-tab mini-map
         this.selectedTerritorioPolygon.set(fc);
         this.selectedTerritorioGeoJSON.set(fc);

         this.territoriosService.getManzanasGeoJSON(t.id_territorio).subscribe({
            next: (manzanasGeo) => {
               if (manzanasGeo?.features?.length > 0) {
                  this.selectedManzanasGeoJSON.set(manzanasGeo);
               }
            },
         });
      }

      // Load puntos
      this.loadPuntos(t.id_territorio);
   }

   closeDetails(): void {
      this.selectedTerritorio.set(null);
      this.selectedStats.set(null);
      this.selectedTerritorioGeoJSON.set(null);
      this.selectedTerritorioPolygon.set(null);
      this.selectedManzanasGeoJSON.set(null);
      this.selectedPuntosGeoJSON.set(null);
      this.puntos.set([]);
      this.asignacionActiva.set(null);
      this.historialAsignaciones.set([]);
      this.manzanasConCobertura.set([]);
   }

   // ── Asignaciones ────────────────────────────────────────────────────
   private loadAsignaciones(idTerritorio: number): void {
      this.territoriosService.getAsignaciones(idTerritorio).subscribe({
         next: (list) => {
            this.historialAsignaciones.set(list);
            this.asignacionActiva.set(list.find(a => a.activa) ?? null);
         },
      });
   }

   openAsignarModal(): void {
      this.newAsignacion = {
         id_publicador: null,
         fecha_asignacion: new Date().toISOString().split('T')[0],
         notas: '',
      };
      this.asignacionError.set(null);
      this.busquedaPublicadorSig.set('');
      this.showAsignarModal.set(true);
   }

   openDevolverModal(): void {
      this.devolucionData = {
         fecha_devolucion: new Date().toISOString().split('T')[0],
         notas: '',
      };
      this.asignacionError.set(null);
      this.showDevolverModal.set(true);
   }

   saveAsignacion(): void {
      const t = this.selectedTerritorio();
      if (!t || !this.newAsignacion.id_publicador) return;
      this.asignacionSaving.set(true);
      this.asignacionError.set(null);
      this.territoriosService.createAsignacion(t.id_territorio, {
         id_publicador: this.newAsignacion.id_publicador,
         fecha_asignacion: this.newAsignacion.fecha_asignacion,
         notas: this.newAsignacion.notas || undefined,
      }).subscribe({
         next: () => {
            this.asignacionSaving.set(false);
            this.showAsignarModal.set(false);
            // Update territory state locally
            const updated = { ...t, estado_territorio: 'Asignado' };
            this.selectedTerritorio.set(updated);
            this.territorios.update(list => list.map(x => x.id_territorio === t.id_territorio ? updated : x));
            this.loadAsignaciones(t.id_territorio);
         },
         error: (err) => {
            this.asignacionSaving.set(false);
            this.asignacionError.set(err?.error?.detail || 'Error al guardar la asignación.');
         },
      });
   }

   saveDevolucion(): void {
      const t = this.selectedTerritorio();
      const activa = this.asignacionActiva();
      if (!t || !activa) return;
      this.asignacionSaving.set(true);
      this.asignacionError.set(null);
      this.territoriosService.devolverAsignacion(t.id_territorio, activa.id_asignacion, {
         fecha_devolucion: this.devolucionData.fecha_devolucion,
         notas: this.devolucionData.notas || undefined,
      }).subscribe({
         next: () => {
            this.asignacionSaving.set(false);
            this.showDevolverModal.set(false);
            const updated = { ...t, estado_territorio: 'Disponible' };
            this.selectedTerritorio.set(updated);
            this.territorios.update(list => list.map(x => x.id_territorio === t.id_territorio ? updated : x));
            this.loadAsignaciones(t.id_territorio);
         },
         error: () => {
            this.asignacionSaving.set(false);
            this.asignacionError.set('Error al registrar la devolución.');
         },
      });
   }

   manzanasPredicadasCount(): number {
      return this.manzanasConCobertura().filter(m => m.ultimaCobertura?.estado === 'Predicada').length;
   }

   manzanasPorcentaje(): number {
      const total = this.manzanasConCobertura().length;
      return total > 0 ? (this.manzanasPredicadasCount() / total * 100) : 0;
   }

   // ── Manzanas cobertura (Fase 4) ──────────────────────────────────────
   loadManzanasCobertura(): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.coberturaLoading.set(true);
      // Dos peticiones en paralelo (manzanas + todas sus coberturas) en vez de
      // una por manzana: un territorio de 40 manzanas lanzaba 41 peticiones.
      forkJoin({
         manzanas: this.territoriosService.getManzanas(t.id_territorio),
         coberturas: this.territoriosService.getCoberturasDelTerritorio(t.id_territorio),
      }).subscribe({
         next: ({ manzanas, coberturas }) => {
            this.manzanasConCobertura.set(
               manzanas.map(m => {
                  const deLaManzana = coberturas[m.id_manzana] ?? [];
                  const ultimaCobertura = deLaManzana.length ? deLaManzana[deLaManzana.length - 1] : undefined;
                  return { ...m, ultimaCobertura };
               })
            );
            this.coberturaLoading.set(false);
         },
         error: () => {
            this.manzanasConCobertura.set([]);
            this.coberturaLoading.set(false);
         },
      });
   }

   marcarManzanaPredicada(idManzana: number): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.coberturaSaving.set(idManzana);
      this.territoriosService.createCobertura(idManzana, {
         id_manzana: idManzana,
         estado: 'Predicada',
         fecha_inicio: new Date().toISOString().split('T')[0],
      }).subscribe({
         next: (cobertura) => {
            this.coberturaSaving.set(null);
            this.manzanasConCobertura.update(list =>
               list.map(m => m.id_manzana === idManzana ? { ...m, ultimaCobertura: cobertura } : m)
            );
         },
         error: () => this.coberturaSaving.set(null),
      });
   }

   startEditManzana(m: Manzana): void {
      this.editingManzanaId.set(m.id_manzana);
      this.editingManzanaNombre.set(m.numero_manzana);
   }

   cancelEditManzana(): void {
      this.editingManzanaId.set(null);
      this.editingManzanaNombre.set('');
   }

   saveEditManzana(idManzana: number): void {
      const t = this.selectedTerritorio();
      const nombre = this.editingManzanaNombre().trim();
      if (!t || !nombre) return;
      this.manzanaRenaming.set(idManzana);
      this.territoriosService.updateManzana(t.id_territorio, idManzana, { numero_manzana: nombre }).subscribe({
         next: () => {
            this.manzanasConCobertura.update(list =>
               list.map(m => m.id_manzana === idManzana ? { ...m, numero_manzana: nombre } : m)
            );
            this.manzanaRenaming.set(null);
            this.editingManzanaId.set(null);
            this.editingManzanaNombre.set('');
            // Reload manzanas GeoJSON so map label updates
            this.territoriosService.getManzanasGeoJSON(t.id_territorio).subscribe(gj => this.selectedManzanasGeoJSON.set(gj));
         },
         error: () => this.manzanaRenaming.set(null),
      });
   }

   deleteManzana(idManzana: number): void {
      const t = this.selectedTerritorio();
      if (!t || !confirm('¿Eliminar esta manzana? Esta acción no se puede deshacer.')) return;
      this.manzanaDeleting.set(idManzana);
      this.territoriosService.deleteManzana(t.id_territorio, idManzana).subscribe({
         next: () => {
            this.manzanasConCobertura.update(list => list.filter(m => m.id_manzana !== idManzana));
            this.manzanaDeleting.set(null);
            this.territoriosService.getManzanasGeoJSON(t.id_territorio).subscribe(gj => this.selectedManzanasGeoJSON.set(gj));
         },
         error: () => this.manzanaDeleting.set(null),
      });
   }

   setDetailTab(tab: 'info' | 'manzanas' | 'direcciones' | 'asignaciones'): void {
      this.activeDetailTab.set(tab);
      if (tab === 'direcciones') this.loadDirecciones();
      if (tab === 'manzanas' && this.manzanasConCobertura().length === 0) {
         this.loadManzanasCobertura();
      }
   }

   navigateToMap(): void {
      this.router.navigate(['/territorios/mapa']);
   }

   // ── Puntos ───────────────────────────────────────────────────────────
   loadPuntos(idTerritorio: number): void {
      this.territoriosService.getPuntos(idTerritorio).subscribe({
         next: (pts) => {
            this.puntos.set(pts);
            // Build GeoJSON for map rendering
            if (pts.length > 0) {
               const features = pts
                 .filter(p => p.coordenadas)
                 .map(p => ({
                   type: 'Feature' as const,
                   id: p.id_punto,
                   properties: { nombre: p.nombre, tipo: p.tipo, notas: p.notas, id_territorio: p.id_territorio },
                   geometry: p.coordenadas!,
                 }));
               this.selectedPuntosGeoJSON.set({ type: 'FeatureCollection', features });
            } else {
               this.selectedPuntosGeoJSON.set(null);
            }
         },
      });
   }

   deletePunto(idPunto: number): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.territoriosService.deletePunto(t.id_territorio, idPunto).subscribe({
         next: () => {
            this.puntos.update(list => list.filter(p => p.id_punto !== idPunto));
            this.loadPuntos(t.id_territorio); // refresh GeoJSON
         },
      });
   }

   // ── Mapa editor events ────────────────────────────────────────────────
   onManzanaDrawn(event: { geojson: any; numero: string }): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.manzanaSaving.set(true);
      this.territoriosService.createManzana(t.id_territorio, {
         id_territorio: t.id_territorio,
         numero_manzana: event.numero,
         coordenada: event.geojson.geometry ?? event.geojson,
      }).subscribe({
         next: () => {
            this.manzanaSaving.set(false);
            this.recargarManzanas(t.id_territorio);
         },
         error: (err) => {
            this.manzanaSaving.set(false);
            this.avisoEditor.set(err?.error?.detail ?? 'No se pudo guardar la manzana. Intente de nuevo.');
         },
      });
   }

   /** Tras crear o borrar manzanas: mapa, pestaña Manzanas y contadores. */
   private recargarManzanas(idTerritorio: number): void {
      this.territoriosService.getManzanasGeoJSON(idTerritorio).subscribe({
         next: (manzanasGeo) => this.selectedManzanasGeoJSON.set(manzanasGeo),
      });
      this.territoriosService.getTerritorioStats(idTerritorio).subscribe({
         next: (stats) => this.selectedStats.set(stats),
      });
      // La pestaña Manzanas se recarga al abrirla si su lista está vacía.
      this.manzanasConCobertura.set([]);
      if (this.activeDetailTab() === 'manzanas') this.loadManzanasCobertura();
      this.loadResumen();
   }

   /** El mapa ya leyó las calles visibles; si el límite tiene cambios, se guardan antes. */
   onDetectarManzanas(calles: any): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.avisoEditor.set(null);
      const proponer = () => {
         const actual = this.selectedTerritorio()!;
         if (!actual.coordenada) {
            this.avisoEditor.set('Primero dibuje el límite del territorio en "1 · Límite".');
            return;
         }
         this.detectandoManzanas.set(true);
         this.territoriosService.proponerManzanas(actual.id_territorio, calles).subscribe({
            next: (fc) => {
               this.detectandoManzanas.set(false);
               if (!fc.features.length) {
                  const yaHay = (this.selectedManzanasGeoJSON()?.features.length ?? 0) > 0;
                  this.avisoEditor.set(yaHay
                     ? 'No quedan manzanas nuevas por detectar: las cuadras de este territorio ya están dibujadas.'
                     : 'No se encontraron cuadras cerradas por calles dentro del límite. Dibuje las manzanas a mano.');
                  return;
               }
               this.propuestasManzanas.set(fc);
            },
            error: (err) => {
               this.detectandoManzanas.set(false);
               this.avisoEditor.set(err?.error?.detail ?? 'No se pudieron detectar las manzanas. Intente de nuevo.');
            },
         });
      };
      if (this.limiteSinGuardar()) this.saveGeometry(proponer);
      else proponer();
   }

   onGuardarPropuestas(features: any[]): void {
      const t = this.selectedTerritorio();
      if (!t || !features.length) return;
      this.guardandoPropuestas.set(true);
      this.territoriosService.createManzanasLote(t.id_territorio, features.map(f => ({
         numero_manzana: String(f.properties.numero_manzana),
         coordenada: f.geometry,
      }))).subscribe({
         next: () => {
            this.guardandoPropuestas.set(false);
            this.propuestasManzanas.set(null);
            this.recargarManzanas(t.id_territorio);
         },
         error: (err) => {
            this.guardandoPropuestas.set(false);
            this.avisoEditor.set(err?.error?.detail ?? 'No se pudieron guardar las manzanas. Intente de nuevo.');
         },
      });
   }

   onPuntoPlaced(event: { geojson: any; nombre: string; tipo: string; notas: string }): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.territoriosService.createPunto(t.id_territorio, {
         id_territorio: t.id_territorio,
         nombre: event.nombre,
         tipo: event.tipo,
         coordenadas: event.geojson,
         notas: event.notas || undefined,
      }).subscribe({
         next: () => this.loadPuntos(t.id_territorio),
      });
   }

   openCreateModal(): void {
      this.newTerritorio = { codigo: this.siguienteCodigo(), nombre: '', estado_territorio: 'Disponible' };
      this.showCreateModal.set(true);
   }

   /** "T07" si el último es "T06": mismo prefijo y mismo ancho que los códigos existentes. */
   private siguienteCodigo(): string {
      let mejor: { prefijo: string; numero: number; ancho: number } | null = null;
      for (const t of this.territorios()) {
         const m = /^(.*?)(\d+)$/.exec((t.codigo ?? '').trim());
         if (!m) continue;
         const numero = Number(m[2]);
         if (!mejor || numero > mejor.numero) mejor = { prefijo: m[1], numero, ancho: m[2].length };
      }
      return mejor ? mejor.prefijo + String(mejor.numero + 1).padStart(mejor.ancho, '0') : '';
   }

   closeCreateModal(): void {
      this.showCreateModal.set(false);
   }

   openMapEditor(): void {
      // Use the territory polygon only (not merged with manzanas)
      const polygon = this.selectedTerritorioPolygon();
      const fc: GeoJSONFeatureCollection = polygon ?? { type: 'FeatureCollection', features: [] };
      this.editingGeoJSON.set(fc);
      this.lastEditedGeoJSON.set(null);
      this.geoSaveError.set(null);
      this.limiteSinGuardar.set(false);
      this.propuestasManzanas.set(null);
      this.avisoEditor.set(null);
      this.showMapEditModal.set(true);

      // Los vecinos se ven de referencia; el salón centra el mapa si aún no hay nada dibujado.
      const actual = this.selectedTerritorio()?.id_territorio;
      this.editorReferencias.set(null);
      // Además de los vecinos: el límite de la congregación y los sectores, para dibujar dentro de la raya.
      forkJoin({
         tarjetas: this.territoriosService.getTerritoriosGeoJSON(),
         unidades: this.territoriosService.getCongregacionLimite(),
      }).subscribe({
         next: ({ tarjetas, unidades }) => {
            const limite = unidades.filter(u => u.coordenada).map(u => ({
               type: 'Feature' as const, id: `u${u.id_unidad}`, properties: { codigo: '' }, geometry: u.coordenada!,
            }));
            const sectoresDibujados = this.sectores().filter(s => s.coordenada).map(s => ({
               type: 'Feature' as const, id: `s${s.id_sector}`, properties: { codigo: s.nombre }, geometry: s.coordenada!,
            }));
            this.editorReferencias.set({
               ...tarjetas,
               features: [...limite, ...sectoresDibujados, ...tarjetas.features.filter(f => f.id !== actual && f.geometry)],
            });
         },
      });
      if (!this.editorCentro()) {
         this.territoriosService.getMapaContexto().subscribe({ next: (r) => this.editorCentro.set(r.centro) });
      }
   }

   closeMapEditor(): void {
      if (this.limiteSinGuardar() && !confirm('El límite del territorio tiene cambios sin guardar. ¿Cerrar sin guardarlos?')) return;
      this.limiteSinGuardar.set(false);
      this.propuestasManzanas.set(null);
      this.showMapEditModal.set(false);
      this.editingGeoJSON.set(null);
      this.lastEditedGeoJSON.set(null);
      this.geoSaveError.set(null);
   }

   openEditInfoModal(): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.editingTerritorioInfo = {
         codigo: t.codigo,
         nombre: t.nombre,
         estado_territorio: t.estado_territorio,
         notas: t.notas || '',
         id_sector: t.id_sector ?? null,
      };
      this.editInfoError.set(null);
      this.confirmandoEliminar.set(false);
      this.puedeRetirar.set(false);
      this.showEditInfoModal.set(true);
   }

   eliminarTerritorio(): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.saving.set(true);
      this.editInfoError.set(null);
      this.territoriosService.deleteTerritorio(t.id_territorio).subscribe({
         next: () => {
            this.saving.set(false);
            this.closeEditInfoModal();
            this.territorios.update(l => l.filter(x => x.id_territorio !== t.id_territorio));
            this.selectedTerritorio.set(null);
            this.loadResumen();
         },
         error: (err) => {
            this.saving.set(false);
            this.puedeRetirar.set(err?.status === 409);
            const d = err?.error?.detail;
            this.editInfoError.set(typeof d === 'string' ? d : 'No se pudo eliminar el territorio. Intente de nuevo.');
         },
      });
   }

   /** Retirar sin perder el historial: lo mismo que cambiar el estado a Inactivo. */
   retirarTerritorio(): void {
      this.editingTerritorioInfo.estado_territorio = 'Inactivo';
      this.confirmandoEliminar.set(false);
      this.saveEditInfo();
   }

   closeEditInfoModal(): void {
      this.showEditInfoModal.set(false);
      this.editInfoError.set(null);
   }

   saveEditInfo(): void {
      const t = this.selectedTerritorio();
      if (!t || !this.editingTerritorioInfo.nombre || !this.editingTerritorioInfo.codigo) return;

      this.saving.set(true);
      this.editInfoError.set(null);
      this.territoriosService.updateTerritorio(t.id_territorio, {
         codigo: this.editingTerritorioInfo.codigo,
         nombre: this.editingTerritorioInfo.nombre,
         estado_territorio: this.editingTerritorioInfo.estado_territorio,
         notas: this.editingTerritorioInfo.notas,
         id_sector: this.editingTerritorioInfo.id_sector || null,
      }).subscribe({
         next: (updated) => {
            this.saving.set(false);
            this.closeEditInfoModal();
            this.territorios.update(list => list.map(item => item.id_territorio === updated.id_territorio ? updated : item));
            this.selectedTerritorio.set(updated);
         },
         error: (err) => {
            console.error('Error al actualizar info de territorio:', err);
            const msg = err?.error?.detail ?? 'Error al guardar los cambios. Intenta de nuevo.';
            this.editInfoError.set(typeof msg === 'string' ? msg : 'Error al guardar los cambios.');
            this.saving.set(false);
         }
      });
   }

   onGeometryChanged(fc: GeoJSONFeatureCollection): void {
      this.lastEditedGeoJSON.set(fc);
      this.limiteSinGuardar.set(true);
   }

   /** Guarda el límite y deja el editor abierto: lo siguiente suele ser dibujar las manzanas. */
   saveGeometry(despues?: () => void): void {
      const fc = this.lastEditedGeoJSON();
      const t = this.selectedTerritorio();
      if (!t || !fc) {
         despues?.();
         return;
      }

      this.geoSaveError.set(null);

      // Antes se guardaba solo la primera figura y las demás se perdían sin aviso.
      if (fc.features.length > 1) {
         this.geoSaveError.set(`Hay ${fc.features.length} figuras en la capa Límite y el territorio debe ser una sola. Borre las que sobran con la goma de la izquierda.`);
         return;
      }

      // Validate self-intersections with turf.kinks
      for (const feature of fc.features) {
         if (feature.geometry?.type === 'Polygon') {
            try {
               const kinks = geoKinks(feature as any);
               if (kinks.features.length > 0) {
                  this.geoSaveError.set('El polígono tiene líneas que se cruzan (auto-intersección). Edítalo para corregirlo antes de guardar.');
                  return;
               }
            } catch {}
         }
      }

      let geometryToSave = null;
      if (fc.features.length > 0) {
         geometryToSave = fc.features[0].geometry;
      }

      this.saving.set(true);
      this.territoriosService.updateTerritorio(t.id_territorio, { coordenada: geometryToSave }).subscribe({
         next: (updated) => {
            this.saving.set(false);
            this.limiteSinGuardar.set(false);
            this.lastEditedGeoJSON.set(null);
            this.selectedTerritorio.set(updated);
            this.territorios.update(list => list.map(item => item.id_territorio === updated.id_territorio ? updated : item));
            const poligono: GeoJSONFeatureCollection | null = updated.coordenada ? {
               type: 'FeatureCollection',
               features: [{
                  type: 'Feature',
                  id: updated.id_territorio,
                  properties: { codigo: updated.codigo, nombre: updated.nombre, estado_territorio: updated.estado_territorio },
                  geometry: updated.coordenada,
               }],
            } : null;
            this.selectedTerritorioPolygon.set(poligono);
            this.selectedTerritorioGeoJSON.set(poligono);
            despues?.();
         },
         error: (err) => {
            console.error('Error al guardar geometría:', err);
            const msg = err?.error?.detail ?? 'Error al guardar la geometría. Intenta de nuevo.';
            this.geoSaveError.set(typeof msg === 'string' ? msg : 'Error al guardar la geometría.');
            this.saving.set(false);
         }
      });
   }

   saveNewTerritorio(): void {
      if (!this.newTerritorio.codigo || !this.newTerritorio.nombre) return;
      
      this.saving.set(true);
      this.territoriosService.createTerritorio({ ...this.newTerritorio, id_sector: this.newTerritorio.id_sector || null }).subscribe({
         next: (created) => {
            // Add to the signals instead of reloading completely (optional)
            this.territorios.update(list => [created, ...list]);
            this.saving.set(false);
            this.closeCreateModal();
            this.selectTerritorio(created);
            this.loadResumen();
            // Lo siguiente siempre es dibujarlo: se abre el editor sin otro clic.
            this.openMapEditor();
         },
         error: (err) => {
            console.error('Error al crear territorio:', err);
            this.saving.set(false);
         }
      });
   }

   async printCard(): Promise<void> {
      const t = this.selectedTerritorio();
      if (!t) return;

      // La tarjeta lleva las direcciones "no visitar": se piden antes de dibujarla.
      try {
         this.noVisitarTarjeta.set(await firstValueFrom(this.territoriosService.getNoVisitar(t.id_territorio)));
      } catch {
         this.noVisitarTarjeta.set([]);
      }
      this.showPrintCard.set(true);

      // Wait for card to render
      await new Promise(resolve => setTimeout(resolve, 1500));

      await exportTerritorioCard(
         `territorio-card-${t.id_territorio}`,
         t.codigo,
         'pdf'
      );

      this.showPrintCard.set(false);
   }

   getStatusColor(estado: string): string {
      switch (estado) {
         case 'Disponible': return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-300 dark:border-emerald-800/60';
         case 'Asignado': return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/25 dark:text-violet-300 dark:border-violet-800/60';
         case 'En Pausa': return 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600';
         default: return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
      }
   }

   getStatusDotColor(estado: string): string {
      switch (estado) {
         case 'Disponible': return 'bg-emerald-500';
         case 'Asignado': return 'bg-violet-600';
         case 'En Pausa': return 'bg-slate-400';
         default: return 'bg-slate-400';
      }
   }
}
