import { Component, signal, computed, inject, OnInit, viewChild } from '@angular/core';
import { geoKinks } from '../utils/geo-math.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { firstValueFrom, forkJoin, timeout } from 'rxjs';
import { TerritoriosService, PublicadorOpcion, RenumeracionManzana } from '../services/territorios.service';
import { DibujoLoteDialogComponent } from '../components/dibujo-lote-dialog.component';
import { RenumerarManzanasDialogComponent } from '../components/renumerar-manzanas-dialog.component';
import { DestinoGuia, GuiaConfiguracionComponent } from '../components/guia-configuracion.component';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { nombreMostrado } from '../../../core/utils/nombre.util';
import { hoyIso } from '../../../core/utils/fecha.util';
import { AuthStore } from '../../../core/auth/auth.store';
import { TerritorioMapComponent } from '../components/territorio-map.component';
import { EditorPanelComponent } from '../components/editor-panel.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PickerOption, SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';
import { descargarTarjetaS12 } from '../utils/tarjeta-s12.util';
import { avisoNumeroRepetido, NumeracionManzanas } from '../utils/numeracion-manzanas.util';
import {
  Territorio,
  Sector,
  Manzana,
  CoberturaManzana,
  TerritorioStats,
  GeoJSONFeatureCollection,
  GeoJSONFeature,
  AsignacionTerritorio,
  OcupacionManzanas,
  Punto,
  ResumenTerritorio,
  ProgresoConfiguracion,
  ViviendaDeTerritorio,
  textoDiasSinTrabajar,
  textoDireccion,
  TIPOS_AVISO,
  tipoAviso,
} from '../models/territorio.model';

@Component({
   standalone: true,
   selector: 'app-territorios-page',
   imports: [CommonModule, FormsModule, TerritorioMapComponent, EditorPanelComponent, DibujoLoteDialogComponent, PageHeaderComponent, SelectPickerComponent, GuiaConfiguracionComponent, RenumerarManzanasDialogComponent],
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
          Barrios
        </button>
        <!-- Dibujar manzanas en lote solo tiene sentido con tarjetas ya marcadas (paso 4 de la guía). -->
        @if (puedeDibujarLote() && (progreso()?.tarjetas_con_limite ?? 0) > 0) {
          <button (click)="showDibujoLote.set(true)" class="btn-secondary focus-ring-green whitespace-nowrap active:scale-[0.97] transition-transform">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect></svg>
            Dibujar manzanas de todas
          </button>
        }
        <button *ngIf="puedeEditar()" (click)="openCreateModal()" class="btn-primary-green focus-ring-green whitespace-nowrap active:scale-[0.97] transition-transform">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Nueva tarjeta
        </button>
      </app-page-header>

      @if (showDibujoLote()) {
        <app-dibujo-lote-dialog (cerrar)="onCerrarDibujoLote($event)" />
      }

      @if (showRenumerar()) {
        <app-renumerar-manzanas-dialog (cerrar)="onCerrarRenumerar($event)" />
      }

      <!-- La secuencia de manzanas (T01 del 1 al N, T02 sigue…) quedó con huecos o cruces. -->
      @if (puedeEditar() && progreso(); as pr) {
        @if (pr.manzanas_total > 0 && !pr.numeracion_en_orden) {
          <div class="shrink-0 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5" role="status">
            <p class="flex-1 min-w-[14rem] text-sm font-semibold text-amber-900 dark:text-amber-100">
              Los números de las manzanas no siguen una sola secuencia entre tarjetas.
            </p>
            <button type="button" (click)="showRenumerar.set(true)" class="btn-secondary focus-ring-green h-10 whitespace-nowrap">Numerar en secuencia</button>
          </div>
        }
      }

      <!-- «Nueva tarjeta» antes de tiempo: explica qué falta y lleva directo a ese paso. -->
      @if (faltaParaCrear(); as falta) {
        <div class="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="tituloFaltaCrear">
          <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="faltaParaCrear.set(null)"></div>
          <div class="relative z-10 w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 text-center shadow-2xl space-y-4">
            <h3 id="tituloFaltaCrear" class="text-lg font-black text-slate-900 dark:text-white">
              {{ falta === 'mapa' ? 'Primero suba el mapa de la congregación' : 'Primero cree los barrios' }}
            </h3>
            <p class="text-base text-slate-600 dark:text-slate-400">
              @if (falta === 'mapa') {
                Las tarjetas se marcan dentro del límite de la congregación. Suba el archivo .kml en Mapa general; después cree los barrios y ya podrá crear tarjetas.
              } @else {
                Cada tarjeta pertenece a un barrio. Cree al menos uno y dibuje su zona; después vuelva aquí para crear tarjetas.
              }
            </p>
            <div class="flex flex-col sm:flex-row gap-2 justify-center">
              <button (click)="faltaParaCrear.set(null); irGuia(falta === 'mapa' ? { a: 'mapa' } : { a: 'barrios' })" class="btn-primary-green focus-ring-green justify-center">
                {{ falta === 'mapa' ? 'Ir a Mapa general' : 'Ir a Barrios' }}
              </button>
              <button (click)="faltaParaCrear.set(null)" class="btn-secondary focus-ring-green justify-center">Ahora no</button>
            </div>
          </div>
        </div>
      }

      <!-- Guía de preparación: mapa → barrios → límites → manzanas -->
      @if (puedeEditar()) {
        <app-guia-configuracion class="shrink-0" [progreso]="progreso()" [puedeEditar]="puedeEditar()"
          [puedeDibujarLote]="puedeDibujarLote()" (ir)="irGuia($event)" />
      }

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
          <app-select-picker class="w-full sm:w-56 shrink-0" colorScheme="emerald" ariaLabel="Barrio"
            [(ngModel)]="sectorFilter" [options]="opcionesSectorFiltro()" placeholder="Todos los barrios" [searchable]="false" />
        }
        <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por actividad">
          @for (c of chips(); track c.id) {
            <button type="button" (click)="alternarChip(c.id)"
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
                    <p class="text-sm text-slate-500 dark:text-slate-400 max-w-sm">Cree el primero: le pedirá el código y el barrio, y luego abrirá el mapa para marcar su límite.</p>
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
                  @if (selectedTerritorio()!.nombre) {
                    <p class="text-[15px] font-medium text-slate-600 dark:text-slate-300 mt-1.5">{{ selectedTerritorio()!.nombre }}</p>
                  }
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
                         <div class="flex-1 min-w-0 space-y-1">
                           <input
                             type="text"
                             [value]="editingManzanaNombre()"
                             (input)="editingManzanaNombre.set($any($event.target).value); editManzanaError.set(null)"
                             (keydown.enter)="saveEditManzana(m.id_manzana)"
                             (keydown.escape)="cancelEditManzana()"
                             [attr.aria-invalid]="!!avisoNumeroPestana(m.id_manzana)"
                             class="w-full px-2 py-1 text-xs font-bold rounded-lg border bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2"
                             [class]="avisoNumeroPestana(m.id_manzana) ? 'border-red-400 focus:ring-red-500' : 'border-blue-400 focus:ring-blue-500'"
                             autofocus
                           />
                           @if (avisoNumeroPestana(m.id_manzana); as aviso) {
                             <p class="text-xs font-semibold text-red-700 dark:text-red-300" role="alert">{{ aviso }}</p>
                           }
                         </div>
                         <button (click)="saveEditManzana(m.id_manzana)"
                           [disabled]="!editingManzanaNombre().trim() || !!avisoNumeroPestana(m.id_manzana) || manzanaRenaming() === m.id_manzana"
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
                   Anote lo que el publicador debe saber en la puerta: casas que no se visitan, perros bravos, conjuntos cerrados u horarios.
                   Salen en la tarjeta impresa y como aviso al registrar una salida.
                 </p>
                 @if (puedeEditar()) {
                   <button type="button" (click)="openDireccionModal()" [disabled]="manzanasLista().length === 0"
                     class="shrink-0 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                     Agregar aviso
                   </button>
                 }
               </div>

               @if (direccionesLoading()) {
                 <p class="text-sm text-slate-500">Cargando avisos...</p>
               } @else if (manzanasLista().length === 0) {
                 <div class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-slate-500">
                   <p class="text-sm font-semibold">Primero hacen falta manzanas</p>
                   <p class="text-xs mt-1">Dibuja las manzanas del territorio y luego agrega sus avisos.</p>
                 </div>
               } @else if (direccionesPorManzana().length === 0) {
                 <div class="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-slate-500">
                   <p class="text-sm font-semibold">Aún no hay avisos en esta tarjeta</p>
                   <p class="text-xs mt-1">Agregue una dirección que no se visita, una con perro bravo, un conjunto cerrado o una que solo atiende a cierta hora.</p>
                 </div>
               } @else {
                 @for (g of direccionesPorManzana(); track g.manzana) {
                   <div>
                     <h4 class="text-[0.6875rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Manzana {{ g.manzana }}</h4>
                     <ul class="space-y-2">
                       @for (v of g.items; track v.id_vivienda) {
                         <li class="rounded-xl border p-3"
                             [ngClass]="v.tipo_aviso === 'otro' ? 'border-dashed border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800' : chipAviso(v)">
                           <div class="flex items-start justify-between gap-2">
                             <div class="min-w-0">
                               <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ textoDir(v) }}</p>
                               @if (v.tipo_aviso === 'otro') {
                                 <p class="mt-1 text-xs font-bold text-slate-500 dark:text-slate-400">Sin clasificar · elija el tipo con «Editar» para que salga en la tarjeta</p>
                               } @else {
                                 <p class="mt-1 text-xs font-bold">{{ etiquetaAviso(v) }}
                                   @if (v.motivo_no_visitar) { <span class="font-medium"> · {{ v.motivo_no_visitar }}</span> }
                                 </p>
                                 @if (v.no_visitar && v.por_revisar) {
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
               <!-- Asignaciones activas: una por persona (la tarjeta completa o solo algunas manzanas) -->
               @for (act of asignacionesActivas(); track act.id_asignacion) {
                 <div class="rounded-2xl border bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200 dark:border-emerald-800/40 p-4">
                   <div class="flex items-center gap-2 mb-3">
                     <div class="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shrink-0">
                       <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                     </div>
                     <div>
                       <p class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Asignado a</p>
                       <p class="text-sm font-black text-slate-800 dark:text-white">{{ act.nombre_publicador ?? 'Publicador #' + act.id_publicador }}</p>
                     </div>
                   </div>
                   <p class="mb-3 inline-flex items-center rounded-lg bg-white/70 dark:bg-slate-900/40 border border-emerald-200 dark:border-emerald-800/50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                     {{ textoAlcance(act) }}
                   </p>
                   <p class="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-3">
                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                     Desde {{ act.fecha_asignacion | date:'dd/MM/yyyy' }}
                   </p>
                   @if (act.notas) {
                     <p class="text-xs text-slate-500 italic mb-3 border-l-2 border-emerald-300 dark:border-emerald-700 pl-2">{{ act.notas }}</p>
                   }
                   <button (click)="openDevolverModal(act)" class="w-full py-2.5 text-xs font-bold bg-white dark:bg-slate-700 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/40 transition-colors flex items-center justify-center gap-2">
                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.51"/></svg>
                     Registrar Devolución
                   </button>
                   @if (puedeEditar()) {
                     <!-- Corregir un error de captura: distinto de devolver, que sí deja registro -->
                     @if (confirmarEliminarAsignacion() === act.id_asignacion) {
                       <div class="mt-3 rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 p-3 space-y-2" role="alert">
                         <p class="text-sm font-semibold text-red-800 dark:text-red-200">¿Eliminar esta asignación? Se borra sin dejar registro, como si nunca se hubiera hecho.</p>
                         <div class="flex gap-2">
                           <button type="button" (click)="eliminarAsignacion(act)" [disabled]="asignacionSaving()" class="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-60">Sí, eliminar</button>
                           <button type="button" (click)="confirmarEliminarAsignacion.set(null)" class="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">No</button>
                         </div>
                       </div>
                     } @else {
                       <div class="mt-2 flex items-center justify-center gap-1">
                         <button type="button" (click)="openAsignarModal(act)" class="h-9 px-3 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors">Editar</button>
                         <span class="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                         <button type="button" (click)="confirmarEliminarAsignacion.set(act.id_asignacion)" class="h-9 px-3 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Fue un error · Eliminar</button>
                       </div>
                     }
                   }
                 </div>
               }
               @if (asignacionesActivas().length === 0) {
                 <div class="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6 text-center">
                   <svg class="w-10 h-10 mx-auto mb-3 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                   <p class="text-sm text-slate-500 dark:text-slate-400 mb-4">Disponible para asignar</p>
                   <button *ngIf="puedeEditar()" (click)="openAsignarModal()" class="w-full py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors shadow-sm shadow-emerald-900/10 flex items-center justify-center gap-2">
                     <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                     Asignar Territorio
                   </button>
                 </div>
               } @else if (puedeEditar() && hayManzanasLibres()) {
                 <!-- Ya hay alguna asignación parcial y quedan manzanas libres: se puede dar otra parte -->
                 <button (click)="openAsignarModal()" class="w-full py-2.5 text-sm font-bold border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors flex items-center justify-center gap-2">
                   <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                   Asignar otra parte
                 </button>
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
                         <p class="text-xs text-slate-400">{{ textoAlcance(a) }} · {{ a.fecha_asignacion | date:'dd/MM/yy' }} → {{ a.fecha_devolucion | date:'dd/MM/yy' }}</p>
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
           <div class="px-4 py-3 border-t border-slate-100 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm flex flex-wrap gap-2">
              <!-- «Editar mapa» es lo que se busca casi siempre: va primero y en verde. «Editar datos» es el formulario. -->
              <button *ngIf="puedeEditar()" (click)="openMapEditor()" type="button"
                title="Dibujar o corregir el límite de la tarjeta y sus manzanas en el mapa"
                class="btn-primary-green focus-ring-green h-10 flex-1 min-w-[8rem] justify-center whitespace-nowrap">
                 <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
                 Editar mapa
              </button>
              <button *ngIf="puedeEditar()" (click)="openEditInfoModal()" type="button"
                title="Cambiar el código, el nombre, el barrio, el estado y las notas"
                class="btn-secondary focus-ring-green h-10 flex-1 min-w-[7.5rem] justify-center whitespace-nowrap">
                 <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                 Editar datos
              </button>
              <button (click)="printCard()" [disabled]="generandoTarjeta()" type="button"
                title="Descargar la tarjeta S-12 con el mapa, lista para imprimir"
                class="btn-secondary focus-ring-green h-10 flex-1 min-w-[7.5rem] justify-center whitespace-nowrap disabled:opacity-60">
                 <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                 {{ generandoTarjeta() ? 'Generando…' : 'Imprimir' }}
              </button>
           </div>
           @if (errorTarjeta()) {
              <p class="px-4 pb-3 text-sm font-semibold text-red-600 dark:text-red-400" role="alert">{{ errorTarjeta() }}</p>
           }
        </aside>
        }


      </div>
      
      <!-- Modal Asignar Territorio -->
      <!-- Modal: dirección -->
      @if (showDireccionModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="dir-titulo">
          <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="showDireccionModal.set(false)"></div>
          <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md relative z-10 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
              <h3 id="dir-titulo" class="text-base font-black text-slate-900 dark:text-white">{{ direccionForm.id_vivienda ? 'Editar aviso' : 'Agregar aviso' }}</h3>
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
                  class="placeholder:font-normal placeholder:text-slate-400/60 dark:placeholder:text-slate-500/70 w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
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
              <fieldset>
                <legend class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">¿Qué debe saber el publicador? *</legend>
                <div class="grid grid-cols-2 gap-2">
                  @for (t of tiposAviso; track t.id) {
                    <label class="relative flex flex-col gap-0.5 rounded-xl border p-3 cursor-pointer transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-emerald-500/30"
                           [ngClass]="direccionForm.tipo_aviso === t.id ? t.chip + ' ring-2 ring-current' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'">
                      <input type="radio" name="tipo-aviso" class="sr-only" [value]="t.id" [(ngModel)]="direccionForm.tipo_aviso" />
                      <span class="text-sm font-bold text-slate-900 dark:text-white">{{ t.etiqueta }}</span>
                      <span class="text-xs text-slate-600 dark:text-slate-300 leading-snug">{{ t.ayuda }}</span>
                    </label>
                  }
                </div>
              </fieldset>
              <div>
                <label for="dir-motivo" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Detalle <span class="font-normal normal-case text-slate-500">(se imprime en la tarjeta)</span></label>
                <input id="dir-motivo" type="text" [(ngModel)]="direccionForm.motivo_no_visitar" [placeholder]="ejemploAviso()" maxlength="140"
                  class="placeholder:font-normal placeholder:text-slate-400/60 dark:placeholder:text-slate-500/70 w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
                <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Escriba la razón corta, sin nombres de personas: la tarjeta se imprime y se reparte.</p>
              </div>
            </div>
            <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 flex justify-end gap-2">
              <button type="button" (click)="showDireccionModal.set(false)" class="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button>
              <button type="button" (click)="saveDireccion()" [disabled]="direccionSaving() || !direccionForm.id_manzana || !direccionForm.direccion?.trim() || !direccionForm.tipo_aviso || direccionForm.tipo_aviso === 'otro'"
                class="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50">
                {{ direccionSaving() ? 'Guardando...' : 'Guardar' }}
              </button>
            </div>
          </div>
        </div>
      }

      @if (showAsignarModal()) {
      <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="cerrarAsignarModal()"></div>
        <!-- Cabecera y pie fijos; solo el cuerpo se desplaza, así los botones nunca quedan cortados. -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md max-h-[calc(100dvh-2rem)] relative z-10 shadow-2xl overflow-hidden animate-fadeIn flex flex-col"
             role="dialog" aria-modal="true" aria-labelledby="asignar-titulo">
          <div class="shrink-0 px-5 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 id="asignar-titulo" class="text-base font-black text-slate-900 dark:text-white">{{ asignacionEditando() ? 'Editar asignación' : 'Asignar tarjeta' }}</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5 truncate">{{ selectedTerritorio()?.codigo }}{{ selectedTerritorio()?.nombre ? ' — ' + selectedTerritorio()?.nombre : '' }}</p>
            </div>
            <button type="button" (click)="cerrarAsignarModal()" aria-label="Cerrar" class="-mr-2 -mt-1 w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar px-5 py-4 space-y-5">
            @if (asignacionError()) {
              <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-sm text-red-700 dark:text-red-400 font-medium" role="alert">{{ asignacionError() }}</div>
            }

            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Publicador *</label>
              <app-select-picker colorScheme="emerald" ariaLabel="Publicador" [(ngModel)]="newAsignacion.id_publicador"
                [options]="opcionesPublicador()" placeholder="Elija un publicador" [clearable]="false" [searchable]="true" />
            </div>

            <div>
              <span id="alcance-etiqueta" class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">¿Qué se asigna? *</span>
              <!-- Control de dos opciones, de una sola altura: se ve de un vistazo cuál está activa. -->
              <div class="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/60" role="radiogroup" aria-labelledby="alcance-etiqueta">
                <button type="button" role="radio" [attr.aria-checked]="newAsignacion.alcance === 'completa'" (click)="elegirAlcance('completa')" [disabled]="hayOcupadas()"
                        class="h-10 rounded-lg text-sm font-bold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                        [ngClass]="newAsignacion.alcance === 'completa' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'">
                  Toda la tarjeta
                </button>
                <button type="button" role="radio" [attr.aria-checked]="newAsignacion.alcance === 'manzanas'" (click)="elegirAlcance('manzanas')" [disabled]="!puedeRepartir()"
                        class="h-10 rounded-lg text-sm font-bold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                        [ngClass]="newAsignacion.alcance === 'manzanas' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'">
                  Solo algunas manzanas
                </button>
              </div>

              @if (ocupacion(); as oc) {
                @if (oc.manzanas.length === 0) {
                  <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Esta tarjeta aún no tiene manzanas dibujadas, por eso se asigna completa.</p>
                } @else if (oc.hay_completa) {
                  <p class="mt-2 text-sm text-amber-700 dark:text-amber-300">La tarjeta completa ya está asignada. Devuélvala para repartirla.</p>
                } @else if (newAsignacion.alcance === 'completa') {
                  <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Las {{ oc.manzanas.length }} manzanas de la tarjeta quedan con esta persona.</p>
                }

                @if (newAsignacion.alcance === 'manzanas' && oc.manzanas.length > 0) {
                  <div class="mt-4">
                    <div class="flex items-center justify-between gap-2 mb-2">
                      <span class="text-sm font-semibold text-slate-700 dark:text-slate-200" aria-live="polite">
                        <span class="tabular-nums">{{ manzanasElegidas().size }}</span> de <span class="tabular-nums">{{ manzanasLibres() }}</span> libres elegidas
                      </span>
                      <span class="flex items-center gap-1">
                        <button type="button" (click)="elegirTodasLasLibres()" class="h-8 px-2.5 rounded-md text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors">Todas</button>
                        <button type="button" (click)="manzanasElegidas.set(vacioSet)" [disabled]="manzanasElegidas().size === 0" class="h-8 px-2.5 rounded-md text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40">Ninguna</button>
                      </span>
                    </div>

                    <!-- Una casilla por manzana: se toca para elegir. Las ocupadas quedan rayadas y no se pueden tocar. -->
                    <div class="grid grid-cols-[repeat(auto-fill,minmax(3.75rem,1fr))] gap-2" role="group" aria-label="Manzanas de la tarjeta">
                      @for (m of oc.manzanas; track m.id_manzana) {
                        @let elegida = manzanasElegidas().has(m.id_manzana);
                        <button type="button" (click)="alternarManzanaAsignar(m.id_manzana)" [disabled]="!m.libre"
                                [attr.aria-pressed]="m.libre ? elegida : null"
                                [attr.aria-label]="'Manzana ' + m.numero + (m.libre ? '' : ', ocupada por ' + m.asignada_a?.nombre_publicador)"
                                [attr.title]="m.libre ? null : 'Ocupada por ' + m.asignada_a?.nombre_publicador"
                                class="relative h-14 rounded-xl border text-base font-black tabular-nums transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.95] focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/30"
                                [ngClass]="!m.libre ? 'cursor-not-allowed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgb(148_163_184/0.18)_5px_6px)]'
                                         : elegida ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-900/20'
                                         : 'border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-100 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'">
                          {{ m.numero }}
                          @if (elegida) {
                            <svg class="absolute top-1 right-1 w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                          } @else if (!m.libre) {
                            <svg class="absolute top-1 right-1 w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
                          }
                        </button>
                      }
                    </div>

                    @for (o of ocupadasResumen(); track o.nombre) {
                      <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        <span class="font-semibold">{{ o.manzanas }}</span> con {{ o.nombre }}
                      </p>
                    }
                    @if (manzanasElegidas().size > 0) {
                      <p class="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 px-3 py-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
                        Se asignará: {{ textoElegidas() }}
                      </p>
                    }
                  </div>
                }
              }
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-4">
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha</label>
                <input type="date" [(ngModel)]="newAsignacion.fecha_asignacion"
                  class="w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas <span class="font-normal normal-case">(opcional)</span></label>
                <input type="text" [(ngModel)]="newAsignacion.notas" placeholder="Observaciones..."
                  class="placeholder:font-normal placeholder:text-slate-400/60 dark:placeholder:text-slate-500/70 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
          </div>

          <div class="shrink-0 px-5 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/60 dark:bg-slate-900/30 flex gap-3">
            <button (click)="cerrarAsignarModal()" class="btn-secondary focus-ring-green h-11 flex-1 justify-center">Cancelar</button>
            <button (click)="saveAsignacion()" [disabled]="!newAsignacion.id_publicador || asignacionSaving() || (newAsignacion.alcance === 'manzanas' && manzanasElegidas().size === 0)"
              class="btn-primary-green focus-ring-green h-11 flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed">
              {{ asignacionSaving() ? 'Guardando...' : asignacionEditando() ? 'Guardar cambios' : 'Asignar' }}
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
            <p class="text-xs text-slate-500 mt-0.5">Asignado a: {{ asignacionADevolver()?.nombre_publicador }} · {{ asignacionADevolver() ? textoAlcance(asignacionADevolver()!) : '' }}</p>
          </div>
          <div class="p-5 space-y-4">
            @if (asignacionError()) {
              <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg text-xs text-red-700 dark:text-red-400 font-medium">{{ asignacionError() }}</div>
            }
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha de Devolución</label>
              <input type="date" [(ngModel)]="devolucionData.fecha_devolucion" [min]="asignacionADevolver()?.fecha_asignacion?.slice(0, 10) ?? ''"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas (opcional)</label>
              <input type="text" [(ngModel)]="devolucionData.notas" placeholder="Observaciones..."
                class="placeholder:font-normal placeholder:text-slate-400/60 dark:placeholder:text-slate-500/70 w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
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
              <input type="text" [(ngModel)]="newTerritorio.codigo" placeholder="T-01" class="placeholder:font-normal placeholder:text-slate-400/60 dark:placeholder:text-slate-500/70 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all">
              @if (intentoCrear() && !newTerritorio.codigo) { <p class="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400" role="alert">Escriba el código de la tarjeta.</p> }
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Nombre <span class="font-normal normal-case text-slate-500 dark:text-slate-400">(opcional)</span></label>
              <input type="text" [(ngModel)]="newTerritorio.nombre" placeholder="Una referencia, si la quiere" class="placeholder:font-normal placeholder:text-slate-400/60 dark:placeholder:text-slate-500/70 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all">
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Estado Inicial</label>
              <app-select-picker colorScheme="emerald" ariaLabel="Estado inicial" [(ngModel)]="newTerritorio.estado_territorio"
                [options]="opcionesEstadoNuevo" [clearable]="false" [searchable]="false" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Barrio</label>
              @if (sectores().length > 0) {
                <app-select-picker colorScheme="emerald" ariaLabel="Barrio" [(ngModel)]="newTerritorio.id_sector"
                  [options]="opcionesSector()" placeholder="Elija un barrio" [clearable]="false" [searchable]="false" />
              } @else {
                <p class="text-sm text-amber-600 dark:text-amber-400">Primero cree un barrio en «Barrios».</p>
              }
              @if (intentoCrear() && !newTerritorio.id_sector) { <p class="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400" role="alert">El barrio es obligatorio. Elija uno de la lista.</p> }
            </div>
            @if (crearError()) {
              <p class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300" role="alert">{{ crearError() }}</p>
            }
          </div>
          
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end gap-3">
            <button (click)="closeCreateModal()" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all">Cancelar</button>
            <button (click)="saveNewTerritorio()" [disabled]="saving()" class="px-5 py-2.5 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-all shadow-md shadow-purple-600/20 flex items-center gap-2">
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
                <p class="text-[0.7rem] text-slate-400 font-medium">{{ selectedTerritorio()!.codigo }}{{ selectedTerritorio()!.nombre ? ' · ' + selectedTerritorio()!.nombre : '' }}</p>
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
                placeholder="T-01"
                class="placeholder:font-normal placeholder:text-slate-400/60 dark:placeholder:text-slate-500/70 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              >
            </div>

            <!-- Nombre -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Nombre <span class="font-normal normal-case text-slate-500 dark:text-slate-400">(opcional)</span></label>
              <input
                type="text"
                [(ngModel)]="editingTerritorioInfo.nombre"
                placeholder="Una referencia, si la quiere"
                class="placeholder:font-normal placeholder:text-slate-400/60 dark:placeholder:text-slate-500/70 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all"
              >
            </div>

            <!-- Estado -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Estado</label>
              <app-select-picker colorScheme="emerald" ariaLabel="Estado" [(ngModel)]="editingTerritorioInfo.estado_territorio"
                [options]="opcionesEstadoEditar()" [clearable]="false" [searchable]="false" [disabled]="estadoBloqueado()" />
              @if (estadoBloqueado()) {
                <p class="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Está asignada. Para cambiar el estado, registre primero la devolución en la pestaña Asignación.</p>
              }
            </div>

            <!-- Barrio -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Barrio</label>
              @if (sectores().length > 0) {
                <app-select-picker colorScheme="emerald" ariaLabel="Barrio" [(ngModel)]="editingTerritorioInfo.id_sector"
                  [options]="opcionesSector()" placeholder="Elija un barrio" [clearable]="false" [searchable]="false" />
              } @else {
                <p class="text-sm text-amber-600 dark:text-amber-400">Primero cree un barrio en «Barrios».</p>
              }
              @if (intentoEditar() && !editingTerritorioInfo.id_sector && editingTerritorioInfo.estado_territorio !== 'Inactivo') { <p class="mt-1.5 text-xs font-semibold text-red-600 dark:text-red-400" role="alert">El barrio es obligatorio. Elija uno de la lista.</p> }
            </div>

            <!-- Notas -->
            <div>
              <label class="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Notas / Instrucciones <span class="font-normal normal-case text-slate-400">(opcional)</span></label>
              <textarea
                [(ngModel)]="editingTerritorioInfo.notas"
                rows="3"
                placeholder="Ej: muchas rejas"
                class="placeholder:font-normal placeholder:text-slate-400/60 dark:placeholder:text-slate-500/70 w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none"
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
              [disabled]="saving()"
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
        
      <!-- Editor cartográfico: pantalla completa, mapa + panel lateral -->
      @if (showMapEditModal() && selectedTerritorio()) {
      <div class="fixed inset-0 z-[100] flex flex-col bg-white dark:bg-slate-900 animate-fadeIn">

        <div class="px-3 sm:px-5 h-14 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 shrink-0 bg-white dark:bg-slate-800">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
              <svg class="text-[#6D28D9] dark:text-purple-400" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>
            </div>
            <h3 class="text-base font-black text-slate-900 dark:text-white truncate">
              Editor cartográfico
              <span class="ml-1.5 px-2 py-0.5 rounded-md bg-slate-900/5 dark:bg-white/10 text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums">{{ selectedTerritorio()!.codigo }}</span>
              @if (selectedTerritorio()!.nombre) { <span class="hidden md:inline text-sm font-medium text-slate-500 dark:text-slate-400"> · {{ selectedTerritorio()!.nombre }}</span> }
            </h3>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <p class="hidden sm:inline-flex items-center gap-2 text-sm font-semibold"
               [class]="limiteSinGuardar() ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'">
              <span class="w-2 h-2 rounded-full" [class]="limiteSinGuardar() ? 'bg-amber-500' : 'bg-emerald-500'"></span>
              {{ limiteSinGuardar() ? 'El límite tiene cambios sin guardar' : 'Todo guardado' }}
            </p>
            <button (click)="closeMapEditor()" class="px-4 h-10 text-sm font-bold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors active:scale-[0.97]">Cerrar editor</button>
          </div>
        </div>

        <div class="flex-1 min-h-0 flex flex-col lg:flex-row">
          <div class="relative flex-1 min-w-0 min-h-0 bg-slate-100 dark:bg-slate-900">
            @if (sinLimiteCongregacion()) {
              <div class="absolute inset-0 z-40 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]" role="alert">
                <div class="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 p-6 text-center shadow-2xl space-y-4">
                  <p class="text-lg font-black text-slate-900 dark:text-white">Primero suba el territorio de la congregación</p>
                  <p class="text-base text-slate-600 dark:text-slate-400">
                    Las tarjetas se dibujan dentro del límite de la congregación. Suba el archivo .kml en Mapa general y vuelva aquí.
                  </p>
                  <div class="flex flex-col sm:flex-row gap-2 justify-center">
                    <button (click)="irAMapaGeneral()" class="btn-primary-green focus-ring-green justify-center">Ir a Mapa general</button>
                    <button (click)="closeMapEditor()" class="btn-secondary focus-ring-green justify-center">Cerrar</button>
                  </div>
                </div>
              </div>
            }
            <app-territorio-map
              #mapaEditor
              [idTerritorio]="selectedTerritorio()!.id_territorio"
              [geojson]="editingGeoJSON()"
              [manzanasGeojson]="selectedManzanasGeoJSON()"
              [puntosGeojson]="selectedPuntosGeoJSON()"
              height="100%"
              [enableDrawing]="true"
              [panelExterno]="true"
              [interactive]="true"
              [referenciasGeojson]="editorReferencias()"
              [centroInicial]="editorCentro()"
              [propuestasGeojson]="propuestasManzanas()"
              [detectando]="detectandoManzanas()"
              [guardandoPropuestas]="guardandoPropuestas()"
              [avisoEditor]="avisoEditor()"
              [numeracion]="numeracion()"
              (geometryChanged)="onGeometryChanged($event)"
              (manzanaDrawn)="onManzanaDrawn($event)"
              (puntoPlaced)="onPuntoPlaced($event)"
              (detectar)="onDetectarManzanas($event)"
              (guardarPropuestas)="onGuardarPropuestas($event)"
              (descartarPropuestas)="propuestasManzanas.set(null)"
              (manzanaForma)="onManzanaForma($event)"
              (puntoMovido)="onPuntoMovido($event)"
            />
          </div>

          <app-editor-panel
            [mapa]="mapaEditorRef()"
            [manzanasGeojson]="selectedManzanasGeoJSON()"
            [puntosGeojson]="selectedPuntosGeoJSON()"
            [limiteSinGuardar]="limiteSinGuardar()"
            [saving]="saving()"
            [geoSaveError]="geoSaveError()"
            [detectando]="detectandoManzanas()"
            [renumeracion]="renumeracionPrevia()"
            [renumerando]="renumerando()"
            [numeracion]="numeracion()"
            [idTerritorio]="selectedTerritorio()?.id_territorio ?? null"
            (guardarLimite)="saveGeometry()"
            (renumerar)="onRenumerar()"
            (confirmarRenumeracion)="onConfirmarRenumeracion()"
            (cancelarRenumeracion)="cerrarRenumeracion()"
            (renombrarManzana)="onRenombrarManzana($event)"
            (borrarManzana)="deleteManzana($event, false)"
            (actualizarPunto)="onActualizarPunto($event)"
            (borrarPunto)="deletePunto($event)"
          />
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
   /** Ordenados por nombre; la búsqueda la hace el propio selector. */
   publicadoresOrdenados = computed(() =>
      this.publicadores()
         .map(p => ({ p, n: nombreMostrado(p) }))
         .sort((a, b) => a.n.localeCompare(b.n, 'es'))
         .map(x => x.p));
   nombreDe = (p: PublicadorOpcion) => nombreMostrado(p);

   // Opciones de los selectores propios (select-picker). Las listas fijas son constantes;
   // las que dependen de datos son computed para no recrear el arreglo en cada ciclo.
   readonly opcionesEstadoFiltro: PickerOption[] = [
      { value: 'Disponible', label: 'Disponible' },
      { value: 'Asignado', label: 'Asignado' },
      { value: 'En Pausa', label: 'En pausa' },
      { value: 'Inactivo', label: 'Inactivo (retirados)' },
   ];
   /** «Asignado» no se elige a mano: lo pone «Asignar» y lo quita la devolución (el servidor también lo exige). */
   readonly opcionesEstadoNuevo: PickerOption[] = this.opcionesEstadoFiltro.filter(o => o.value === 'Disponible' || o.value === 'En Pausa');
   private readonly opcionesEstadoManual: PickerOption[] = this.opcionesEstadoFiltro
      .filter(o => o.value !== 'Asignado')
      .map(o => o.value === 'Inactivo' ? { ...o, label: 'Inactivo', hint: 'Retirado; conserva su historial' } : o);
   /** Con asignaciones vigentes el estado queda fijo en «Asignado» hasta registrar la devolución. */
   estadoBloqueado = computed(() => this.asignacionesActivas().length > 0);
   opcionesEstadoEditar(): PickerOption[] {
      return this.selectedTerritorio()?.estado_territorio === 'Asignado'
         ? [{ value: 'Asignado', label: 'Asignado' }, ...this.opcionesEstadoManual]
         : this.opcionesEstadoManual;
   }
   opcionesManzana = computed<PickerOption[]>(() =>
      this.manzanasLista().map(m => ({ value: m.id_manzana, label: `Manzana ${m.numero_manzana || m.id_manzana}` })));
   opcionesPublicador = computed<PickerOption[]>(() =>
      this.publicadoresOrdenados().map(p => ({ value: p.id_publicador, label: this.nombreDe(p) })));

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
         { value: 'sin', label: `Sin barrio (${sin})` },
      ];
   });

   /** Avance de la preparación (mapa, barrios, límites, manzanas); null mientras carga. */
   progreso = signal<ProgresoConfiguracion | null>(null);
   /** Qué falta antes de poder crear tarjetas, cuando se pulsa «Nueva tarjeta» antes de tiempo. */
   faltaParaCrear = signal<'mapa' | 'barrios' | null>(null);

   loadProgreso(): void {
      this.territoriosService.getProgresoConfiguracion().subscribe({
         next: (p) => this.progreso.set(p),
         error: () => this.progreso.set(null),
      });
   }

   irGuia(d: DestinoGuia): void {
      switch (d.a) {
         case 'mapa': this.navigateToMap(); break;
         case 'barrios': this.irASectores(); break;
         case 'nueva-tarjeta': this.openCreateModal(); break;
         case 'manzanas-lote': this.showDibujoLote.set(true); break;
         case 'tarjeta': {
            const t = this.territorios().find(x => x.id_territorio === d.id);
            if (!t) return;
            this.selectTerritorio(t);
            this.openMapEditor();
            break;
         }
      }
   }

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
   /** Mapa del editor a pantalla completa: el panel lateral lo maneja. */
   mapaEditorRef = viewChild<TerritorioMapComponent>('mapaEditor');
   renumeracionPrevia = signal<RenumeracionManzana[] | null>(null);
   showDibujoLote = signal(false);
   /** Dibujar las manzanas de todas las tarjetas: solo Administrador y Gestor (controla el uso de IA). */
   puedeDibujarLote = computed(() => {
      this.authStore.user();
      return this.authStore.isAdministrador() || this.authStore.isGestor();
   });
   renumerando = signal(false);
   saving = signal(false);
   generandoTarjeta = signal(false);
   errorTarjeta = signal<string | null>(null);
   showCreateModal = signal(false);
   showRenumerar = signal(false);
   /** Números de manzana usados en la congregación y el que sigue para la tarjeta abierta. */
   numeracion = signal<NumeracionManzanas | null>(null);
   /** Se activa al pulsar Guardar para mostrar qué campos obligatorios faltan. */
   intentoCrear = signal(false);
   intentoEditar = signal(false);
   crearError = signal<string | null>(null);
   showMapEditModal = signal(false);
   geoSaveError = signal<string | null>(null);
   // Editor de mapa
   editorReferencias = signal<GeoJSONFeatureCollection | null>(null);
   editorCentro = signal<{ lat: number; lng: number } | null>(null);
   sinLimiteCongregacion = signal(false);
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
   /** Todas las asignaciones vigentes: la tarjeta completa o varias personas con manzanas distintas. */
   asignacionesActivas = computed(() => this.historialAsignaciones().filter(a => a.activa));
   /** La asignación que se está devolviendo (puede haber varias activas). */
   asignacionADevolver = signal<AsignacionTerritorio | null>(null);
   /** La asignación que se está corrigiendo (null = se está creando una nueva). */
   asignacionEditando = signal<AsignacionTerritorio | null>(null);
   confirmarEliminarAsignacion = signal<number | null>(null);
   ocupacion = signal<OcupacionManzanas | null>(null);
   manzanasElegidas = signal<Set<number>>(new Set());
   hayOcupadas = computed(() => !!this.ocupacion()?.manzanas.some(m => !m.libre));
   readonly vacioSet = new Set<number>();
   puedeRepartir = computed(() => (this.ocupacion()?.manzanas.length ?? 0) > 0 && !this.ocupacion()?.hay_completa);
   manzanasLibres = computed(() => this.ocupacion()?.manzanas.filter(m => m.libre).length ?? 0);
   elegirAlcance(a: 'completa' | 'manzanas'): void { this.newAsignacion.alcance = a; }
   /** «1, 2 y 4»: lista de números en lenguaje corriente. */
   private listaNumeros(nums: string[]): string {
      return nums.length <= 1 ? nums.join('') : `${nums.slice(0, -1).join(', ')} y ${nums[nums.length - 1]}`;
   }
   /** «Manzanas 2 y 3» según lo marcado. */
   textoElegidas = computed(() => {
      const n = (this.ocupacion()?.manzanas ?? []).filter(m => this.manzanasElegidas().has(m.id_manzana)).map(m => m.numero);
      return n.length === 1 ? `la manzana ${n[0]}` : `las manzanas ${this.listaNumeros(n)}`;
   });
   /** Recarga solo los polígonos (con el color de quien los tiene) tras cambiar una asignación. */
   private refrescarMapaAsignaciones(idTerritorio: number): void {
      this.territoriosService.getManzanasGeoJSON(idTerritorio).subscribe(gj => { if (this.sigueAbierto(idTerritorio)) this.selectedManzanasGeoJSON.set(gj); });
      this.loadNumeracion(idTerritorio);
   }

   /** Quién tiene las manzanas ocupadas: «Manzanas 3 y 4 con Gersain». */
   ocupadasResumen = computed(() => {
      const por = new Map<string, string[]>();
      for (const m of this.ocupacion()?.manzanas ?? []) {
         if (m.libre || !m.asignada_a) continue;
         por.set(m.asignada_a.nombre_publicador, [...(por.get(m.asignada_a.nombre_publicador) ?? []), m.numero]);
      }
      return [...por].map(([nombre, nums]) => ({ nombre, manzanas: `${nums.length === 1 ? 'Manzana' : 'Manzanas'} ${this.listaNumeros(nums)}` }));
   });
   hayManzanasLibres = computed(() => !!this.ocupacion()?.manzanas.some(m => m.libre) && !this.ocupacion()?.hay_completa);
   /** «Toda la tarjeta» o «Manzanas 3 y 4». */
   textoAlcance(a: AsignacionTerritorio): string {
      const n = a.numeros_manzanas ?? [];
      if (a.completa !== false && n.length === 0) return 'Toda la tarjeta';
      if (n.length === 1) return `Manzana ${n[0]}`;
      return `Manzanas ${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}`;
   }
   alternarManzanaAsignar(id: number): void {
      const s = new Set(this.manzanasElegidas());
      if (s.has(id)) s.delete(id); else s.add(id);
      this.manzanasElegidas.set(s);
   }
   elegirTodasLasLibres(): void {
      this.manzanasElegidas.set(new Set((this.ocupacion()?.manzanas ?? []).filter(m => m.libre).map(m => m.id_manzana)));
   }
   showAsignarModal = signal(false);
   showDevolverModal = signal(false);
   asignacionSaving = signal(false);
   asignacionError = signal<string | null>(null);
   newAsignacion: { id_publicador: number | null; fecha_asignacion: string; notas: string; alcance: 'completa' | 'manzanas' } = {
     alcance: 'completa',
     id_publicador: null,
     fecha_asignacion: hoyIso(),
     notas: '',
   };
   devolucionData: { fecha_devolucion: string; notas: string } = {
     fecha_devolucion: hoyIso(),
     notas: '',
   };

   // Manzanas con cobertura (Fase 4)
   manzanasConCobertura = signal<Array<Manzana & { ultimaCobertura?: CoberturaManzana }>>([]);
   coberturaLoading = signal(false);
   coberturaSaving = signal<number | null>(null); // id_manzana siendo guardado
   editingManzanaId = signal<number | null>(null);
   editingManzanaNombre = signal('');
   manzanaRenaming = signal<number | null>(null);
   editManzanaError = signal<string | null>(null);
   manzanaDeleting = signal<number | null>(null);
   activeDetailTab = signal<'info' | 'manzanas' | 'direcciones' | 'asignaciones'>('info');
   manzanaSaving = signal(false);

   readonly tabs: Array<{ id: 'info' | 'manzanas' | 'direcciones' | 'asignaciones'; label: string; icon: string }> = [
     { id: 'info',        label: 'Resumen',  icon: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>' },
     { id: 'manzanas',   label: 'Manzanas',     icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>' },
     { id: 'direcciones', label: 'Avisos', icon: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>' },
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
            this.direccionesLoading.set(false);
            if (!this.sigueAbierto(t.id_territorio)) return;
            this.manzanasLista.set(manzanas);
            this.direcciones.set(viviendas);
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

   readonly tiposAviso = TIPOS_AVISO;
   etiquetaAviso = (v: ViviendaDeTerritorio) => tipoAviso(v.tipo_aviso)?.etiqueta ?? 'Aviso';
   chipAviso = (v: ViviendaDeTerritorio) => tipoAviso(v.tipo_aviso)?.chip ?? '';
   /** Ejemplo del campo Detalle según el tipo elegido. */
   ejemploAviso(): string {
      return tipoAviso(this.direccionForm.tipo_aviso)?.ejemplo ?? 'Escriba la razón corta';
   }

   openDireccionModal(v?: ViviendaDeTerritorio): void {
      this.direccionError.set(null);
      // Las antiguas sin clasificar parten sin tipo: hay que elegir uno al guardarlas.
      this.direccionForm = v
         ? { ...v, tipo_aviso: v.tipo_aviso === 'otro' ? undefined : v.tipo_aviso }
         : {
            id_manzana: this.manzanasLista().length === 1 ? this.manzanasLista()[0].id_manzana : null,
            direccion: '', numero: '', edificio: '', apartamento: '', notas: '',
            tipo_aviso: undefined, motivo_no_visitar: '',
         };
      this.showDireccionModal.set(true);
   }

   saveDireccion(): void {
      const f = this.direccionForm;
      if (!f.id_manzana || !f.direccion?.trim() || !f.tipo_aviso || f.tipo_aviso === 'otro') return;
      this.direccionSaving.set(true);
      this.direccionError.set(null);
      const cuerpo = {
         direccion: f.direccion.trim(),
         numero: f.numero ?? '',
         edificio: f.edificio ?? '',
         apartamento: f.apartamento ?? '',
         notas: f.notas ?? '',
         tipo_aviso: f.tipo_aviso,
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

   /** Un filtro rápido cambia la lista: se vuelve a la primera página para no quedar en una vacía. */
   alternarChip(id: '' | 'atrasados' | 'nunca' | 'en_curso' | 'por_revisar'): void {
      this.chip.set(this.chip() === id ? '' : id);
      this.currentPage.set(1);
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
           (t.nombre ?? '').toLowerCase().includes(q) ||
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
      this.loadProgreso();
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

   /** Una respuesta que llega tarde no debe pintar los datos de otra tarjeta si se cambió de fila mientras tanto. */
   private sigueAbierto(id: number): boolean {
      return this.selectedTerritorio()?.id_territorio === id;
   }

   selectTerritorio(t: Territorio): void {
      this.selectedTerritorio.set(t);
      this.numeracion.set(null);
      this.loadNumeracion(t.id_territorio);
      this.selectedStats.set(null);
      this.selectedTerritorioGeoJSON.set(null);
      this.selectedTerritorioPolygon.set(null);
      this.selectedManzanasGeoJSON.set(null);
      this.selectedPuntosGeoJSON.set(null);
      this.puntos.set([]);
      this.activeDetailTab.set('info');
      this.asignacionActiva.set(null);
      this.historialAsignaciones.set([]);
      this.ocupacion.set(null);
      this.confirmarEliminarAsignacion.set(null);
      this.asignacionError.set(null);
      this.errorTarjeta.set(null);
      this.manzanasConCobertura.set([]);
      this.direcciones.set([]);
      this.manzanasLista.set([]);
      this.confirmarEliminarDireccion.set(null);
      this.cancelEditManzana();

      const id = t.id_territorio;
      this.territoriosService.getTerritorioStats(id).subscribe({
         next: (stats) => { if (this.sigueAbierto(id)) this.selectedStats.set(stats); },
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

         this.territoriosService.getManzanasGeoJSON(id).subscribe({
            next: (manzanasGeo) => {
               if (this.sigueAbierto(id) && manzanasGeo?.features?.length > 0) {
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
      this.ocupacion.set(null);
      this.numeracion.set(null);
      this.direcciones.set([]);
      this.manzanasLista.set([]);
   }

   // ── Asignaciones ────────────────────────────────────────────────────
   /** Historial y ocupación de manzanas: la pestaña decide con ella si se puede «Asignar otra parte». */
   private loadAsignaciones(idTerritorio: number): void {
      this.territoriosService.getAsignaciones(idTerritorio).subscribe({
         next: (list) => {
            if (!this.sigueAbierto(idTerritorio)) return;
            this.historialAsignaciones.set(list);
            this.asignacionActiva.set(list.find(a => a.activa) ?? null);
         },
      });
      this.territoriosService.getOcupacion(idTerritorio).subscribe({
         next: (o) => { if (this.sigueAbierto(idTerritorio) && !this.showAsignarModal()) this.ocupacion.set(o); },
      });
   }

   /** Sin argumento: asigna. Con una asignación: la corrige (persona, fecha, nota o manzanas). */
   openAsignarModal(editar?: AsignacionTerritorio): void {
      const t = this.selectedTerritorio();
      this.asignacionEditando.set(editar ?? null);
      this.ocupacion.set(null);
      this.manzanasElegidas.set(new Set(editar?.ids_manzanas ?? []));
      this.newAsignacion = {
         alcance: editar && editar.completa === false ? 'manzanas' : 'completa',
         id_publicador: editar?.id_publicador ?? null,
         fecha_asignacion: editar?.fecha_asignacion?.slice(0, 10) ?? hoyIso(),
         notas: editar?.notas ?? '',
      };
      if (t) {
         this.territoriosService.getOcupacion(t.id_territorio).subscribe({
            next: (o) => {
               // Al editar, lo suyo cuenta como libre: se puede quedar con lo que ya tenía.
               if (editar) {
                  o = {
                     hay_completa: o.hay_completa && editar.completa === false,
                     manzanas: o.manzanas.map(m => m.asignada_a?.id_asignacion === editar.id_asignacion ? { ...m, libre: true, asignada_a: null } : m),
                  };
                  if (editar.completa !== false) o = { ...o, hay_completa: false };
               }
               this.ocupacion.set(o);
               // Con algo ya asignado a otros, lo único posible es repartir las manzanas libres.
               if (!editar && o.manzanas.some(m => !m.libre)) this.newAsignacion.alcance = 'manzanas';
            },
         });
      }
      this.asignacionError.set(null);
      this.showAsignarModal.set(true);
   }

   /** Al cancelar, la ocupación vuelve a la real (al editar, lo propio se mostraba como libre). */
   cerrarAsignarModal(): void {
      this.showAsignarModal.set(false);
      this.asignacionEditando.set(null);
      const t = this.selectedTerritorio();
      if (t) this.loadAsignaciones(t.id_territorio);
   }

   openDevolverModal(a: AsignacionTerritorio): void {
      this.asignacionADevolver.set(a);
      this.devolucionData = {
         fecha_devolucion: hoyIso(),
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
      const editando = this.asignacionEditando();
      if (editando) {
         this.territoriosService.updateAsignacion(t.id_territorio, editando.id_asignacion, {
            id_publicador: this.newAsignacion.id_publicador,
            fecha_asignacion: this.newAsignacion.fecha_asignacion,
            notas: this.newAsignacion.notas,
            ids_manzanas: this.newAsignacion.alcance === 'manzanas' ? [...this.manzanasElegidas()] : [],
         }).subscribe({
            next: () => {
               this.asignacionSaving.set(false);
               this.showAsignarModal.set(false);
               this.asignacionEditando.set(null);
               this.loadAsignaciones(t.id_territorio); this.refrescarMapaAsignaciones(t.id_territorio);
               this.loadResumen();
            },
            error: (err) => {
               this.asignacionSaving.set(false);
               this.asignacionError.set(err?.error?.detail || 'No se pudieron guardar los cambios.');
            },
         });
         return;
      }
      this.territoriosService.createAsignacion(t.id_territorio, {
         id_publicador: this.newAsignacion.id_publicador,
         fecha_asignacion: this.newAsignacion.fecha_asignacion,
         notas: this.newAsignacion.notas || undefined,
         ids_manzanas: this.newAsignacion.alcance === 'manzanas' ? [...this.manzanasElegidas()] : undefined,
      }).subscribe({
         next: () => {
            this.asignacionSaving.set(false);
            this.showAsignarModal.set(false);
            // Update territory state locally
            const updated = { ...t, estado_territorio: 'Asignado' };
            this.selectedTerritorio.set(updated);
            this.territorios.update(list => list.map(x => x.id_territorio === t.id_territorio ? updated : x));
            this.loadAsignaciones(t.id_territorio); this.refrescarMapaAsignaciones(t.id_territorio);
            this.loadResumen();
         },
         error: (err) => {
            this.asignacionSaving.set(false);
            this.asignacionError.set(err?.error?.detail || 'Error al guardar la asignación.');
         },
      });
   }

   /** Borra una asignación hecha por error: no deja registro ni historial. */
   eliminarAsignacion(a: AsignacionTerritorio): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.asignacionSaving.set(true);
      this.territoriosService.deleteAsignacion(t.id_territorio, a.id_asignacion).subscribe({
         next: () => {
            this.asignacionSaving.set(false);
            this.confirmarEliminarAsignacion.set(null);
            const quedan = this.asignacionesActivas().filter(x => x.id_asignacion !== a.id_asignacion).length;
            const updated = { ...t, estado_territorio: quedan > 0 ? 'Asignado' : 'Disponible' };
            this.selectedTerritorio.set(updated);
            this.territorios.update(list => list.map(x => x.id_territorio === t.id_territorio ? updated : x));
            this.loadAsignaciones(t.id_territorio); this.refrescarMapaAsignaciones(t.id_territorio);
            this.loadResumen();
         },
         error: (err) => {
            this.asignacionSaving.set(false);
            this.confirmarEliminarAsignacion.set(null);
            this.asignacionError.set(err?.error?.detail || 'No se pudo eliminar la asignación.');
         },
      });
   }

   saveDevolucion(): void {
      const t = this.selectedTerritorio();
      const activa = this.asignacionADevolver();
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
            // Sigue «Asignado» si queda otra persona con otra parte de la tarjeta.
            const quedan = this.asignacionesActivas().filter(x => x.id_asignacion !== activa.id_asignacion).length;
            const updated = { ...t, estado_territorio: quedan > 0 ? 'Asignado' : 'Disponible' };
            this.selectedTerritorio.set(updated);
            this.territorios.update(list => list.map(x => x.id_territorio === t.id_territorio ? updated : x));
            this.loadAsignaciones(t.id_territorio); this.refrescarMapaAsignaciones(t.id_territorio);
            this.loadResumen();
         },
         error: (err) => {
            this.asignacionSaving.set(false);
            this.asignacionError.set(err?.error?.detail || 'Error al registrar la devolución.');
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
            this.coberturaLoading.set(false);
            if (!this.sigueAbierto(t.id_territorio)) return;
            this.manzanasConCobertura.set(
               manzanas.map(m => {
                  const deLaManzana = coberturas[m.id_manzana] ?? [];
                  const ultimaCobertura = deLaManzana.length ? deLaManzana[deLaManzana.length - 1] : undefined;
                  return { ...m, ultimaCobertura };
               })
            );
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
         fecha_inicio: hoyIso(),
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

   /** Aviso en la edición de la pestaña Manzanas: número repetido o rechazo del servidor. */
   avisoNumeroPestana(idManzana: number): string | null {
      return avisoNumeroRepetido(this.editingManzanaNombre(), this.numeracion(), this.selectedTerritorio()?.id_territorio ?? null, idManzana)
         ?? this.editManzanaError();
   }

   cancelEditManzana(): void {
      this.editManzanaError.set(null);
      this.editingManzanaId.set(null);
      this.editingManzanaNombre.set('');
   }

   saveEditManzana(idManzana: number): void {
      const t = this.selectedTerritorio();
      const nombre = this.editingManzanaNombre().trim();
      if (!t || !nombre || this.avisoNumeroPestana(idManzana)) return;
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
            this.loadNumeracion(t.id_territorio);
            this.loadProgreso();
         },
         error: (err) => {
            this.manzanaRenaming.set(null);
            this.editManzanaError.set(err?.error?.detail ?? 'No se pudo cambiar el número. Intente de nuevo.');
         },
      });
   }

   deleteManzana(idManzana: number, confirmar = true): void {
      const t = this.selectedTerritorio();
      if (!t || (confirmar && !confirm('¿Eliminar esta manzana? Esta acción no se puede deshacer.'))) return;
      this.manzanaDeleting.set(idManzana);
      this.territoriosService.deleteManzana(t.id_territorio, idManzana).subscribe({
         next: () => {
            this.manzanaDeleting.set(null);
            // Contadores, mapa, numeración, guía y la lista de la pestaña (también los avisos de esa manzana).
            this.recargarManzanas(t.id_territorio);
            if (this.activeDetailTab() === 'direcciones') this.loadDirecciones();
         },
         error: (err) => {
            this.manzanaDeleting.set(null);
            this.avisoEditor.set(err?.error?.detail ?? 'No se pudo borrar la manzana. Intente de nuevo.');
         },
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
            if (!this.sigueAbierto(idTerritorio)) return;
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
   /** Editor: cambia el número de una manzana y refresca el mapa. */
   onRenombrarManzana(e: { id: number; numero: string }): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.territoriosService.updateManzana(t.id_territorio, e.id, { numero_manzana: e.numero }).subscribe({
         next: () => this.recargarManzanas(t.id_territorio),
         error: (err) => this.avisoEditor.set(err?.error?.detail ?? 'No se pudo cambiar el número. Intente de nuevo.'),
      });
   }

   /** Editor: guarda la nueva forma de una manzana; siempre se recarga para que el mapa muestre lo guardado. */
   onManzanaForma(e: { id: number; geojson: any }): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.territoriosService.updateManzana(t.id_territorio, e.id, { coordenada: e.geojson }).subscribe({
         next: () => this.recargarManzanas(t.id_territorio),
         error: (err) => {
            this.avisoEditor.set(err?.error?.detail ?? 'No se pudo guardar la nueva forma. Intente de nuevo.');
            this.recargarManzanas(t.id_territorio);
         },
      });
   }

   /** Editor: guarda el nuevo lugar de un punto. */
   onPuntoMovido(e: { id: number; geojson: any }): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.territoriosService.updatePunto(t.id_territorio, e.id, { coordenadas: e.geojson }).subscribe({
         next: () => this.loadPuntos(t.id_territorio),
         error: (err) => {
            this.avisoEditor.set(err?.error?.detail ?? 'No se pudo mover el punto. Intente de nuevo.');
            this.loadPuntos(t.id_territorio);
         },
      });
   }

   onActualizarPunto(e: { id: number; nombre: string; tipo: string; notas: string }): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.territoriosService.updatePunto(t.id_territorio, e.id, { nombre: e.nombre, tipo: e.tipo, notas: e.notas }).subscribe({
         next: () => this.loadPuntos(t.id_territorio),
         error: (err) => this.avisoEditor.set(err?.error?.detail ?? 'No se pudieron guardar los cambios del punto.'),
      });
   }

   onManzanaDrawn(event: { geojson: any; numero: string; renumerarTodo?: boolean }): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.manzanaSaving.set(true);
      this.territoriosService.createManzana(t.id_territorio, {
         id_territorio: t.id_territorio,
         numero_manzana: event.numero,
         coordenada: event.geojson.geometry ?? event.geojson,
         renumerar_todo: event.renumerarTodo ?? false,
      } as any).subscribe({
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
         next: (manzanasGeo) => { if (this.sigueAbierto(idTerritorio)) this.selectedManzanasGeoJSON.set(manzanasGeo); },
      });
      this.territoriosService.getTerritorioStats(idTerritorio).subscribe({
         next: (stats) => { if (this.sigueAbierto(idTerritorio)) this.selectedStats.set(stats); },
      });
      this.loadNumeracion(idTerritorio);
      this.loadProgreso();
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
            // Si ya había manzanas, las nuevas siguen su numeración y el orden puede quedar salteado.
            if ((this.selectedManzanasGeoJSON()?.features.length ?? 0) > 0) {
               this.avisoEditor.set('Manzanas guardadas. Si los números quedaron salteados, use «Numerar en secuencia» en el paso 2.');
            }
            this.recargarManzanas(t.id_territorio);
         },
         error: (err) => {
            this.guardandoPropuestas.set(false);
            this.avisoEditor.set(err?.error?.detail ?? 'No se pudieron guardar las manzanas. Intente de nuevo.');
         },
      });
   }

   onCerrarRenumerar(huboCambios: boolean): void {
      this.showRenumerar.set(false);
      if (!huboCambios) return;
      this.loadProgreso();
      const t = this.selectedTerritorio();
      if (t) this.recargarManzanas(t.id_territorio);
   }

   loadNumeracion(idTerritorio: number): void {
      this.territoriosService.getNumeracion(idTerritorio).subscribe({
         next: (n) => { if (this.sigueAbierto(idTerritorio)) this.numeracion.set(n); },
         error: () => { if (this.sigueAbierto(idTerritorio)) this.numeracion.set(null); },
      });
   }

   /** Vista previa: el mapa muestra en naranja los números nuevos hasta que se confirme. */
   onRenumerar(): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.renumerando.set(true);
      this.territoriosService.renumerarManzanas(t.id_territorio, false).subscribe({
         next: (filas) => {
            this.renumerando.set(false);
            this.renumeracionPrevia.set(filas);
            // La secuencia es de toda la congregación; en el mapa solo se ven los números de esta tarjeta.
            this.mapaEditorRef()?.mostrarRenumeracion(new Map(filas.filter(f => f.id_territorio === t.id_territorio).map(f => [f.id_manzana, f.numero_manzana])));
         },
         error: (err) => {
            this.renumerando.set(false);
            this.avisoEditor.set(err?.error?.detail ?? 'No se pudo calcular el nuevo orden. Intente de nuevo.');
         },
      });
   }

   onConfirmarRenumeracion(): void {
      const t = this.selectedTerritorio();
      if (!t) return;
      this.renumerando.set(true);
      this.territoriosService.renumerarManzanas(t.id_territorio, true).subscribe({
         next: () => {
            this.renumerando.set(false);
            this.cerrarRenumeracion();
            this.recargarManzanas(t.id_territorio);
         },
         error: (err) => {
            this.renumerando.set(false);
            this.avisoEditor.set(err?.error?.detail ?? 'No se pudieron cambiar los números. Intente de nuevo.');
         },
      });
   }

   onCerrarDibujoLote(huboCambios: boolean): void {
      this.showDibujoLote.set(false);
      if (!huboCambios) return;
      this.loadTerritorios();
      const t = this.selectedTerritorio();
      if (t) this.recargarManzanas(t.id_territorio);
   }

   cerrarRenumeracion(): void {
      this.renumeracionPrevia.set(null);
      this.mapaEditorRef()?.mostrarRenumeracion(null);
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
      // El orden es obligatorio (la API también lo exige): mapa → barrios → tarjetas.
      const p = this.progreso();
      if (p && !p.tiene_limite) { this.faltaParaCrear.set('mapa'); return; }
      if (p && p.barrios === 0) { this.faltaParaCrear.set('barrios'); return; }
      this.newTerritorio = { codigo: this.siguienteCodigo(), nombre: '', estado_territorio: 'Disponible' };
      this.intentoCrear.set(false);
      this.crearError.set(null);
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
      this.sinLimiteCongregacion.set(false);
      // Además de los vecinos: el límite de la congregación y los sectores, para dibujar dentro de la raya.
      forkJoin({
         tarjetas: this.territoriosService.getTerritoriosGeoJSON(),
         unidades: this.territoriosService.getCongregacionLimite(),
      }).subscribe({
         next: ({ tarjetas, unidades }) => {
            const limite = unidades.filter(u => u.coordenada).map(u => ({
               type: 'Feature' as const, id: `u${u.id_unidad}`, properties: { codigo: '', limite: true }, geometry: u.coordenada!,
            }));
            this.sinLimiteCongregacion.set(limite.length === 0);
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

   irAMapaGeneral(): void {
      this.closeMapEditor();
      void this.router.navigate(['/territorios/mapa']);
   }

   closeMapEditor(): void {
      if (this.limiteSinGuardar() && !confirm('El límite del territorio tiene cambios sin guardar. ¿Cerrar sin guardarlos?')) return;
      this.limiteSinGuardar.set(false);
      this.propuestasManzanas.set(null);
      this.renumeracionPrevia.set(null);
      this.showMapEditModal.set(false);
      this.loadProgreso();
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
      this.intentoEditar.set(false);
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
      // El barrio es obligatorio, salvo al retirar una tarjeta antigua que nunca lo tuvo.
      this.intentoEditar.set(true);
      const retirando = this.editingTerritorioInfo.estado_territorio === 'Inactivo';
      if (!t) return;
      if (!this.editingTerritorioInfo.codigo) { this.editInfoError.set('Escriba el código de la tarjeta.'); return; }
      if (!this.editingTerritorioInfo.id_sector && !retirando) { this.editInfoError.set(null); return; }

      this.saving.set(true);
      this.editInfoError.set(null);
      this.territoriosService.updateTerritorio(t.id_territorio, {
         codigo: this.editingTerritorioInfo.codigo,
         nombre: (this.editingTerritorioInfo.nombre ?? '').trim(),
         estado_territorio: this.editingTerritorioInfo.estado_territorio,
         notas: this.editingTerritorioInfo.notas,
         ...(this.editingTerritorioInfo.id_sector ? { id_sector: this.editingTerritorioInfo.id_sector } : {}),
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
            if (updated.ajustado_al_limite) {
               // El servidor recortó lo que se salía: se repinta la forma que quedó guardada.
               this.editingGeoJSON.set(poligono);
               this.avisoEditor.set('Se ajustó el dibujo al límite de la congregación: lo que quedaba fuera se recortó.');
            }
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
      this.intentoCrear.set(true);
      this.crearError.set(null);
      if (!this.newTerritorio.codigo || !this.newTerritorio.id_sector) return;
      
      this.saving.set(true);
      this.territoriosService.createTerritorio({ ...this.newTerritorio, nombre: (this.newTerritorio.nombre ?? '').trim(), id_sector: this.newTerritorio.id_sector || null }).subscribe({
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
            const d = err?.error?.detail;
            this.crearError.set(typeof d === 'string' ? d : 'No se pudo crear la tarjeta. Intente de nuevo.');
            this.saving.set(false);
         }
      });
   }

   async printCard(): Promise<void> {
      const t = this.selectedTerritorio();
      if (!t || this.generandoTarjeta()) return;
      this.generandoTarjeta.set(true);
      this.errorTarjeta.set(null);

      if (!t.coordenada) {
         this.errorTarjeta.set('Primero dibuje el límite de la tarjeta con «Editar mapa»; sin él no hay mapa que imprimir.');
         this.generandoTarjeta.set(false);
         return;
      }
      try {
         // Las manzanas se piden de nuevo: así salen con los números al día aunque se acaben de renumerar.
         const manzanas = await firstValueFrom(this.territoriosService.getManzanasGeoJSON(t.id_territorio)).catch(() => this.selectedManzanasGeoJSON());
         await descargarTarjetaS12({
            codigo: t.codigo,
            localidad: this.sectorDe(t)?.nombre ?? t.nombre ?? '',
            limite: t.coordenada,
            manzanas,
         });
      } catch (err) {
         console.error('No se pudo generar la tarjeta:', err);
         this.errorTarjeta.set('No se pudo generar el PDF de la tarjeta. Intente de nuevo.');
      } finally {
         this.generandoTarjeta.set(false);
      }
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
