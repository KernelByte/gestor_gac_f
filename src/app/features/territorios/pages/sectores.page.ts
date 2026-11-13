import { Component, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ConfirmService } from '../../../shared/components/confirm-dialog/confirm.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { AvisoComponent } from '../../../shared/components/aviso/aviso.component';
import { TerritoriosService } from '../services/territorios.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { TerritorioMapComponent } from '../components/territorio-map.component';
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
  host: { class: 'tema-territorios' },
  imports: [CommonModule, FormsModule, TerritorioMapComponent, ModalComponent, ConfirmDialogComponent, AvisoComponent],
  template: `
    <div class="flex flex-col h-full min-h-0 gap-3">
      <!-- Cabecera en una fila: el mapa recibe casi toda la altura -->
      <header class="shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="flex items-center gap-1 min-w-0">
          <button type="button" (click)="volver()" aria-label="Volver a Territorios" title="Volver a Territorios"
            class="-ml-2 w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.97]">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          </button>
          <div class="min-w-0">
            <h1 class="page-title">Barrios</h1>
            <p class="hidden lg:block text-sm text-slate-500 dark:text-slate-400 truncate">Divida el territorio en barrios, cada uno con su color. Después las tarjetas se agrupan dentro de ellos.</p>
          </div>
        </div>
        @if (puedeEditar() && sectores().length > 0) {
          <button type="button" (click)="nuevoSector()" class="btn-primary whitespace-nowrap">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Nuevo barrio
          </button>
        }
      </header>

      @if (aviso()) {
        <app-aviso tone="warning" class="shrink-0 block" [dismissible]="true" (dismissed)="aviso.set(null)">{{ aviso() }}</app-aviso>
      }

      <!-- Mapa arriba en el teléfono; a la derecha desde lg. La lista nunca queda tapada. -->
      <div class="flex-1 min-h-0 grid gap-3 lg:gap-4 grid-rows-[minmax(13rem,36dvh)_minmax(0,1fr)] lg:grid-rows-1 lg:grid-cols-[minmax(21rem,26rem)_minmax(0,1fr)]">

        <section class="relative order-1 lg:order-2 min-h-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900" aria-label="Mapa de los barrios">
          <app-territorio-map #mapaGeneral
            [geojson]="null" [referenciasGeojson]="referenciasMapa()" [centroInicial]="centro()"
            height="100%" [interactive]="true" />
          @if (hayLimite() && sectores().length === 0 && !cargando()) {
            <p class="pointer-events-none absolute left-3 bottom-3 right-3 sm:right-auto sm:max-w-xs z-[500] rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 shadow-sm">
              La línea punteada es el límite de la congregación. Los barrios se dibujan dentro de ella.
            </p>
          }
        </section>

        <section class="order-2 lg:order-1 min-h-0 flex flex-col gap-3 overflow-y-auto simple-scrollbar pr-1 [&>*]:shrink-0" aria-label="Lista de barrios">

          @if (!hayLimite() && !cargando()) {
            <app-aviso tone="warning" title="Falta el territorio de la congregación">
              <p>Los barrios se dibujan dentro de ese límite. Suba el archivo .kml en Mapa general y vuelva aquí.</p>
              <button type="button" (click)="irAMapaGeneral()" class="btn-primary mt-3">Ir a Mapa general</button>
            </app-aviso>
          }

          @if (cargando()) {
            <div class="space-y-2" aria-hidden="true">
              @for (n of [1,2,3]; track n) { <div class="h-[4.25rem] rounded-xl skeleton"></div> }
            </div>
          } @else if (sectores().length === 0) {
            <!-- Estado vacío que enseña el camino -->
            <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div>
                <h2 class="text-lg font-bold text-slate-900 dark:text-white">Cree su primer barrio</h2>
                <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Son tres pasos y lo verá aquí mismo en el mapa.</p>
              </div>
              <ol class="space-y-3 text-base text-slate-700 dark:text-slate-200">
                <li class="flex items-center gap-3"><span class="w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center shrink-0" aria-hidden="true">1</span> Póngale nombre y elija un color</li>
                <li class="flex items-center gap-3"><span class="w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center shrink-0" aria-hidden="true">2</span> Marque la zona tocando el mapa</li>
                <li class="flex items-center gap-3"><span class="w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center shrink-0" aria-hidden="true">3</span> Confirme las tarjetas que quedan dentro</li>
              </ol>
              @if (puedeEditar()) {
                <button type="button" (click)="nuevoSector()" class="btn-primary w-full justify-center">
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  Nuevo barrio
                </button>
              }
            </div>
          } @else {
            <div class="flex items-baseline justify-between px-1">
              <h2 class="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{{ sectores().length }} {{ sectores().length === 1 ? 'barrio' : 'barrios' }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">Toque uno para verlo en el mapa</p>
            </div>

            <ul class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              @for (s of sectores(); track s.id_sector) {
                <li [ngClass]="seleccionado() === s.id_sector ? 'bg-slate-50 dark:bg-slate-800/40' : ''" class="transition-colors">
                  <button type="button" (click)="elegir(s)" [attr.aria-expanded]="seleccionado() === s.id_sector"
                    class="w-full min-h-[4rem] flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <span class="w-4 h-4 rounded-full shrink-0 ring-2 ring-white dark:ring-slate-900" [style.background-color]="s.color || '#94a3b8'" aria-hidden="true"></span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-base font-bold text-slate-900 dark:text-white truncate">{{ s.nombre }}</span>
                      <span class="block text-sm text-slate-500 dark:text-slate-400">
                        {{ s.tarjetas_count }} {{ s.tarjetas_count === 1 ? 'tarjeta' : 'tarjetas' }}
                        @if (!s.coordenada) { <span class="ml-1 inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-semibold px-2 py-0.5">Falta dibujarlo</span> }
                      </span>
                    </span>
                    <svg class="w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200" [class.rotate-90]="seleccionado() === s.id_sector" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </button>

                  @if (seleccionado() === s.id_sector) {
                    <div class="revelar px-4 pb-4 flex flex-wrap gap-2">
                      @if (puedeEditar()) {
                        @if (!s.coordenada) {
                          <button type="button" (click)="editarSector(s)" class="btn-primary flex-1 justify-center whitespace-nowrap">
                            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 22 8.5 18 21 6 21 2 8.5 12 2"></polygon></svg>
                            Dibujar en el mapa
                          </button>
                          <button type="button" (click)="elegirTarjetas(s)" class="btn-secondary whitespace-nowrap">Elegir tarjetas</button>
                        } @else {
                          <button type="button" (click)="elegirTarjetas(s)" class="btn-primary flex-1 justify-center whitespace-nowrap">Elegir tarjetas</button>
                          <button type="button" (click)="editarSector(s)" class="btn-secondary whitespace-nowrap">Editar</button>
                        }
                        <button type="button" (click)="verTarjetas(s)" class="btn-secondary whitespace-nowrap">Ver tarjetas</button>
                        <button type="button" (click)="pedirBorrar(s)" aria-label="Borrar este barrio" title="Borrar este barrio"
                          class="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-lg border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors active:scale-[0.97]">
                          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                      } @else {
                        <button type="button" (click)="verTarjetas(s)" class="btn-secondary flex-1 whitespace-nowrap">Ver tarjetas</button>
                      }
                    </div>
                  }
                </li>
              }
            </ul>

            <!-- Lo que queda por hacer, sin pasos numerados -->
            <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 flex flex-wrap items-center gap-3">
              @if (sinSector() === 0) {
                <svg class="w-5 h-5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
                <p class="flex-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Todas las tarjetas ya tienen barrio.</p>
                @if (todosDibujados()) {
                  <button type="button" (click)="volver()" class="btn-primary whitespace-nowrap">Siguiente: las tarjetas →</button>
                }
              } @else {
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-bold text-slate-900 dark:text-white">{{ sinSector() }} {{ sinSector() === 1 ? 'tarjeta' : 'tarjetas' }} sin barrio</p>
                  <p class="text-sm text-slate-500 dark:text-slate-400">Abra un barrio y use «Elegir tarjetas».</p>
                </div>
                <button type="button" (click)="verSinSector()" class="btn-secondary whitespace-nowrap">Verlas</button>
              }
            </div>
          }
        </section>
      </div>
    </div>

    @if (sinLimite()) {
      <app-modal [open]="true" size="md" title="Primero suba el territorio de la congregación" [hasFooter]="true" (openChange)="$event || sinLimite.set(false)">
        <p class="text-base text-slate-600 dark:text-slate-400">
          Los barrios se dibujan dentro del límite de la congregación. Suba el archivo .kml en Mapa general y vuelva aquí.
        </p>
        <ng-container slot="footer">
          <button (click)="sinLimite.set(false)" class="btn-secondary">Entendido</button>
          <button (click)="irAMapaGeneral()" class="btn-primary">Ir a Mapa general</button>
        </ng-container>
      </app-modal>
    }

    <!-- ═══ Editor de barrio: panel con pasos + mapa ═══ -->
    @if (editor(); as e) {
      <!-- z 59: tapa el shell (≤ 50) pero queda bajo --z-modal (60), así el «¿Cerrar sin guardar?» de ConfirmService se ve encima. -->
      <div class="fixed inset-0 z-[59] flex flex-col lg:flex-row bg-white dark:bg-slate-950" role="dialog" aria-modal="true" aria-labelledby="tituloBarrio">

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
              <p class="text-xs font-semibold tracking-wide uppercase text-slate-500 dark:text-slate-400">Barrio</p>
              <h2 id="tituloBarrio" class="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{{ e.id_sector ? 'Editar barrio' : 'Nuevo barrio' }}</h2>
            </div>
            <button type="button" (click)="cerrarEditor()" aria-label="Cerrar sin guardar" title="Cerrar sin guardar"
              class="-mr-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </header>

          <ol class="flex-1 overflow-y-auto simple-scrollbar px-6 pb-4 space-y-6">
            <!-- 1 · Nombre -->
            <li class="flex gap-3">
              <span class="mt-0.5 w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm font-bold transition-colors"
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
                      class="relative w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-90"
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
              <span class="mt-0.5 w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-sm font-bold transition-colors"
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
                    <div class="mt-3 flex flex-wrap items-center gap-2">
                      <button type="button" (click)="mapaBarrio.undoLastVertex()" [disabled]="mapaBarrio.puntosColocados() < 1"
                        class="h-11 px-4 inline-flex items-center gap-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-sm font-bold text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.97]">
                        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-4.51"></path></svg>
                        Quitar el último punto
                      </button>
                      <button type="button" (click)="mapaBarrio.cancelarDibujo()" class="h-11 px-4 rounded-lg text-sm font-bold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/30">Cancelar</button>
                    </div>
                    <p class="mt-2 text-sm text-emerald-800/80 dark:text-emerald-300/80">
                      También puede presionar <kbd class="px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 text-xs font-bold">{{ mapaBarrio.atajoDeshacer }}</kbd>.
                    </p>
                  </div>
                } @else if (hayDibujo()) {
                  <div class="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                    <p class="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      <span class="w-3 h-3 rounded-full shrink-0" [style.background-color]="e.color"></span>
                      Zona marcada@if (mapaBarrio.realtimeArea()) { <span class="font-normal text-slate-500 dark:text-slate-400 tabular-nums">· {{ mapaBarrio.realtimeArea() }}</span> }
                    </p>
                    @if (mapaBarrio.editMode()) {
                      <p class="text-sm text-slate-600 dark:text-slate-400 mt-2">Arrastre un punto blanco para moverlo. Para agregar uno nuevo, arrastre o toque un punto verde con «+» a mitad de una línea.</p>
                    }
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button type="button" (click)="mapaBarrio.alternarEdicion()" [attr.aria-pressed]="mapaBarrio.editMode()"
                        class="h-10 px-4 rounded-lg border text-sm font-bold transition-colors"
                        [ngClass]="mapaBarrio.editMode() ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'">
                        {{ mapaBarrio.editMode() ? 'Listo' : 'Acomodar los bordes' }}
                      </button>
                      <button type="button" (click)="mapaBarrio.deshacerZona()" [disabled]="!mapaBarrio.puedeDeshacerZona()"
                        [attr.title]="'Deshace el último cambio de la zona (' + mapaBarrio.atajoDeshacer + ')'"
                        class="btn-secondary btn-sm">
                        <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-4.51"></path></svg>
                        Deshacer
                      </button>
                      <button type="button" (click)="dibujarDeNuevo(mapaBarrio)"
                        class="btn-secondary btn-sm">Dibujar de nuevo</button>
                    </div>
                  </div>
                } @else {
                  <p class="text-sm text-slate-500 dark:text-slate-400">Dibuje el contorno del barrio sobre el mapa.</p>
                  @if (mapaBarrio.puedeDeshacerZona()) {
                    <button type="button" (click)="mapaBarrio.deshacerZona()" class="mt-3 btn-secondary">
                      <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 .49-4.51"></path></svg>
                      Recuperar la zona anterior
                    </button>
                  }
                  <button type="button" (click)="mapaBarrio.empezarDibujo()" class="mt-3 btn-secondary">
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
              <button type="button" (click)="cerrarEditor()" class="btn-ghost">Cancelar</button>
              <button type="button" (click)="guardarSector()" [disabled]="!e.nombre.trim() || guardando()" class="btn-primary">
                {{ guardando() ? 'Guardando…' : 'Guardar barrio' }}
              </button>
            </div>
          </footer>
        </aside>
      </div>
    }

    <!-- ═══ Ventana: tarjetas que encontró dentro del barrio / elegir a mano ═══ -->
    @if (eleccion(); as e) {
      <app-modal [open]="true" size="lg" [title]="e.titulo" [subtitle]="e.ayuda" [padding]="false" [hasFooter]="true" (openChange)="$event || cerrarEleccion()">
        <div class="p-2">
          @if (e.tarjetas.length === 0) {
            <p class="p-4 text-sm text-slate-500">No hay tarjetas para mostrar.</p>
          }
          @for (t of e.tarjetas; track t.id_territorio) {
            <label class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer">
              <input type="checkbox" [(ngModel)]="t.marcada" class="w-5 h-5 accent-emerald-600">
              <span class="font-display font-bold text-slate-900 dark:text-white tabular-nums">{{ t.codigo }}</span>
              <span class="text-sm text-slate-600 dark:text-slate-300 truncate flex-1">{{ t.nombre }}</span>
              @if (t.sectorActual) { <span class="text-xs text-slate-500 shrink-0">Hoy: {{ t.sectorActual }}</span> }
            </label>
          }
        </div>
        <ng-container slot="footer">
          <button (click)="cerrarEleccion()" class="btn-ghost">{{ e.soloLectura ? 'Cerrar' : 'Ahora no' }}</button>
          <button (click)="asignarElegidas()" [disabled]="guardando()" class="btn-primary">Asignar al barrio</button>
        </ng-container>
      </app-modal>
    }

    <!-- ═══ Confirmar borrar ═══ -->
    @if (porBorrar(); as s) {
      <app-confirm-dialog [open]="true" severity="danger" [title]="'¿Borrar «' + s.nombre + '»?'"
        [message]="'Las ' + s.tarjetas_count + ' tarjetas de este barrio no se borran: solo quedan sin barrio.'"
        confirmLabel="Sí, borrar" cancelLabel="Cancelar"
        (confirmed)="confirmarBorrar()" (openChange)="$event || porBorrar.set(null)" />
    }

  `,
  styles: [`
    :host { display: block; height: 100%; }
    .revelar { animation: revelar 180ms cubic-bezier(0.23, 1, 0.32, 1); }
    @keyframes revelar { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .revelar { animation: none; } }
    .simple-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
    .simple-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
  `],
})
export class SectoresPage implements OnInit {
  private svc = inject(TerritoriosService);
  private confirmar = inject(ConfirmService);
  private router = inject(Router);
  private authStore = inject(AuthStore);
  @ViewChild('mapaGeneral') private mapaGeneral?: TerritorioMapComponent;

  cargando = signal(true);
  seleccionado = signal<number | null>(null);
  hayLimite = computed(() => this.unidades().some(u => u.coordenada));

  /** Lo que muestra el mapa de la página: el límite y todos los barrios con su color (el elegido, resaltado). */
  referenciasMapa = computed<GeoJSONFeatureCollection | null>(() => {
    const sel = this.seleccionado();
    const features = [
      ...this.mapaCongregacion().features,
      ...this.sectores().filter(s => s.coordenada).map(s => ({
        type: 'Feature' as const, id: `s${s.id_sector}`,
        properties: { codigo: s.nombre, color: s.color || '#94a3b8', sel: s.id_sector === sel },
        geometry: s.coordenada!,
      })),
    ];
    return features.length ? { type: 'FeatureCollection' as const, features } : null;
  });

  puedeEditar = computed(() => {
    this.authStore.user();
    return this.authStore.hasPermission('territorios.sectores_editar');
  });

  readonly colores = COLORES_SECTOR;
  aviso = signal<string | null>(null);
  guardando = signal(false);
  centro = signal<{ lat: number; lng: number } | null>(null);

  /** Límite de la congregación: solo se ve de fondo al dibujar; se sube en el Mapa general. */
  unidades = signal<UnidadCongregacion[]>([]);
  mapaCongregacion = computed(() => this.aFeatures(this.unidades()));
  sinLimite = signal(false);
  private notaAjuste = '';

  // Paso 2 y 3
  sectores = signal<Sector[]>([]);
  sinSector = signal(0);
  /** Paso 2 de la guía terminado: todos los barrios tienen su zona dibujada. */
  todosDibujados = computed(() => this.sectores().length > 0 && this.sectores().every(s => !!s.coordenada));
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
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.aviso.set('No se pudo cargar la información. Revise la conexión e intente de nuevo.');
      },
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

  /** Elegir un barrio de la lista lo resalta y lo acerca en el mapa; volver a tocarlo lo suelta. */
  elegir(s: Sector): void {
    const ya = this.seleccionado() === s.id_sector;
    this.seleccionado.set(ya ? null : s.id_sector);
    setTimeout(() => (ya || !s.coordenada)
      ? this.mapaGeneral?.encuadrarReferencias()
      : this.mapaGeneral?.encuadrarReferencia(`s${s.id_sector}`));
  }

  nuevoSector(): void { void this.abrirEditor(); }
  editarSector(s: Sector): void { void this.abrirEditor(s); }

  private async abrirEditor(s?: Sector): Promise<void> {
    // Sin el territorio de la congregación no hay dentro de qué dibujar.
    if (!this.unidades().some(u => u.coordenada)) { this.sinLimite.set(true); return; }
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

  irAMapaGeneral(): void {
    this.sinLimite.set(false);
    void this.router.navigate(['/territorios/mapa']);
  }

  async cerrarEditor(): Promise<void> {
    const e = this.editor();
    const conCambios = !!e && (!e.id_sector && (e.nombre.trim() !== '' || this.hayDibujo()));
    if (conCambios && !(await this.confirmar.ask({ title: '¿Cerrar sin guardar este barrio?', confirmLabel: 'Cerrar sin guardar', severity: 'warning' }))) return;
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
        this.notaAjuste = s.ajustado_al_limite ? 'Se ajustó el dibujo al límite de la congregación: lo que quedaba fuera se recortó. ' : '';
        if (this.notaAjuste) this.aviso.set(this.notaAjuste.trim());
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
          this.aviso.set(`${this.notaAjuste}Barrio «${s.nombre}» guardado. Todavía no hay tarjetas dibujadas dentro de esa zona; cuando las cree aparecerán aquí, o puede elegirlas a mano con «Elegir tarjetas».`);
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
