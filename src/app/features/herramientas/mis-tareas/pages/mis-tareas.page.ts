import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ActaService } from '../../../secretario-tools/services/acta.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { Tarea } from '../../../secretario-tools/models/acta.model';
import { TareaDetailPanelComponent } from '../../../secretario-tools/tareas/components/tarea-detail-panel.component';
import { TareaCrearModalComponent } from '../components/tarea-crear-modal.component';
import { SelectPickerComponent, PickerOption } from '../../../../shared/components/select-picker/select-picker.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';

/** Qué parte de "mis tareas" mirar. El backend ya solo devuelve creadas + asignadas. */
type Vista = 'todas' | 'asignadas' | 'creadas';
/** Filtro de situación. "Abiertas" = pendientes + en progreso: lo que queda por hacer. */
type Filtro = 'abiertas' | 'vencidas' | 'hoy' | 'completadas' | 'todas';
type FiltroPrioridad = 'todas' | Tarea['prioridad'];
type Grupo = 'vencidas' | 'hoy' | 'semana' | 'despues' | 'sinfecha' | 'cerradas';

const GRUPOS: { key: Grupo; label: string }[] = [
  { key: 'vencidas', label: 'Vencidas' },
  { key: 'hoy',      label: 'Hoy' },
  { key: 'semana',   label: 'Próximos 7 días' },
  { key: 'despues',  label: 'Más adelante' },
  { key: 'sinfecha', label: 'Sin fecha límite' },
  { key: 'cerradas', label: 'Completadas y canceladas' },
];
const ORDEN_PRIORIDAD: Record<Tarea['prioridad'], number> = { alta: 0, media: 1, baja: 2 };

@Component({
  standalone: true,
  selector: 'app-mis-tareas',
  imports: [CommonModule, FormsModule, TareaDetailPanelComponent, TareaCrearModalComponent, SelectPickerComponent],
  template: `
    <div class="h-full rounded-2xl overflow-x-hidden overflow-y-auto bg-gray-50/50 dark:bg-slate-900">

      <!-- ── Cabecera ── -->
      <header class="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-500 flex items-center justify-center shadow-sm shadow-rose-500/20 shrink-0">
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          </div>
          <div class="min-w-0">
            <h1 class="font-display font-bold text-sm sm:text-base leading-tight text-gray-900 dark:text-white">Mis Tareas</h1>
            <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
              @if (!loading() && resumenCabecera()) { {{ resumenCabecera() }} } @else { Las que creaste y las que te asignaron }
            </p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button type="button" (click)="cargarTareas()" [disabled]="loading()" title="Actualizar" aria-label="Actualizar lista"
            class="pressable w-9 h-9 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors">
            <svg class="w-4 h-4" [class.animate-spin]="loading()" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
          <button type="button" (click)="modalCrear.set(true)" data-testid="btn-nueva-tarea"
            class="pressable inline-flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold shadow-sm shadow-rose-600/25 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-width="2.5" d="M12 5v14m-7-7h14"/></svg>
            Nueva<span class="hidden sm:inline"> tarea</span>
          </button>
        </div>
      </header>

      <main class="p-4 sm:p-5 lg:p-6 space-y-4">

        <!-- ── Resumen: cada tarjeta es también un filtro ── -->
        <section class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3" aria-label="Resumen">
          @for (c of tarjetas; track c.value) {
            <button type="button" class="resumen pressable" [attr.data-tono]="c.tono" [class.resumen--on]="filtro() === c.value"
              [attr.aria-pressed]="filtro() === c.value" [attr.data-testid]="'filtro-' + c.value"
              (click)="filtro.set(filtro() === c.value ? 'todas' : c.value)">
              <span class="resumen-icono" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" [attr.d]="c.icono"/></svg>
              </span>
              <span class="min-w-0 text-left">
                <span class="resumen-num">{{ c.value === 'completadas' ? conteoCompletadas() : conteo()[c.value] }}</span>
                <span class="resumen-label">{{ c.label }}</span>
              </span>
            </button>
          }
        </section>

        <!-- ── Barra de herramientas ── -->
        <section class="barra" aria-label="Filtros">
          <div class="grid grid-cols-3 sm:inline-flex p-1 rounded-lg bg-gray-100 dark:bg-slate-900/60 shrink-0" role="tablist" aria-label="Qué tareas ver">
            @for (v of vistas; track v.value) {
              <button type="button" role="tab" [attr.aria-selected]="vista() === v.value" (click)="vista.set(v.value)"
                class="seg min-h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap" [class.seg--on]="vista() === v.value">
                <span class="sm:hidden">{{ v.corto }}</span><span class="hidden sm:inline">{{ v.label }}</span>
              </button>
            }
          </div>
          <label class="barra-buscar relative min-w-0 block">
            <span class="sr-only">Buscar tarea</span>
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
            </svg>
            <input type="search" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" placeholder="Buscar tarea…"
              class="w-full h-10 pl-9 pr-3 rounded-lg text-sm bg-gray-50 dark:bg-slate-700/50 border border-transparent text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-700 focus:border-gray-200 dark:focus:border-slate-600 focus:ring-2 focus:ring-rose-500/10 transition-[background-color,border-color,box-shadow]"/>
          </label>
          <div class="barra-prio w-full sm:w-52 shrink-0">
            <app-select-picker [options]="opcionesPrioridad" [ngModel]="prioridad()" (ngModelChange)="prioridad.set($event)"
              [clearable]="false" [searchable]="false" colorScheme="rose" ariaLabel="Filtrar por prioridad"/>
          </div>
        </section>

        <!-- Qué se está viendo -->
        @if (!loading() && !error()) {
          <div class="flex items-center justify-between gap-3 px-1 text-xs text-gray-500 dark:text-slate-400">
            <p>
              <span class="font-semibold text-gray-700 dark:text-gray-300 tabular-nums">{{ totalVisible() }}</span>
              {{ totalVisible() === 1 ? 'tarea' : 'tareas' }} · {{ etiquetaFiltro() }}
            </p>
            @if (filtro() !== 'abiertas') {
              <button type="button" class="font-semibold text-rose-600 dark:text-rose-400 hover:underline underline-offset-2" (click)="filtro.set('abiertas')">Ver por hacer</button>
            }
          </div>
        }

        <!-- ── Contenido ── -->
        <section aria-live="polite" [attr.aria-busy]="loading()">
          @if (loading()) {
            <div class="lista" aria-hidden="true">
              @for (i of [1,2,3,4,5]; track i) {
                <div class="flex items-start gap-3 px-4 py-4">
                  <div class="skel w-5 h-5 rounded-full mt-0.5"></div>
                  <div class="flex-1 space-y-2">
                    <div class="skel h-4 rounded" [style.width.%]="40 + (i * 9) % 45"></div>
                    <div class="skel h-3 w-40 rounded"></div>
                  </div>
                </div>
              }
            </div>
          } @else if (error()) {
            <div class="vacio">
              <p class="vacio-titulo">No se pudieron cargar tus tareas</p>
              <p class="vacio-texto">{{ error() }}</p>
              <button type="button" class="btn-rosa pressable mt-4" (click)="cargarTareas()">Reintentar</button>
            </div>
          } @else if (grupos().length === 0) {
            <div class="vacio">
              <div class="vacio-icono" aria-hidden="true">
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.6" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
              </div>
              <p class="vacio-titulo">{{ vacio().titulo }}</p>
              <p class="vacio-texto">{{ vacio().texto }}</p>
              <div class="flex flex-wrap justify-center gap-2 mt-4">
                @if (vacio().accion === 'limpiar') {
                  <button type="button" class="btn-sec pressable" (click)="limpiarFiltros()">Quitar filtros</button>
                }
                @if (vacio().accion === 'completadas') {
                  <button type="button" class="btn-sec pressable" (click)="filtro.set('completadas')">Ver completadas</button>
                }
                @if (vacio().accion === 'crear') {
                  <button type="button" class="btn-rosa pressable" (click)="modalCrear.set(true)">Crear tarea</button>
                }
              </div>
            </div>
          } @else {
            <div class="space-y-6">
              @for (g of grupos(); track g.key) {
                <section [attr.aria-labelledby]="'grupo-' + g.key">
                  <h2 [id]="'grupo-' + g.key" class="grupo-titulo" [class.grupo-titulo--alerta]="g.key === 'vencidas'">
                    {{ g.label }} <span class="grupo-num">{{ g.tareas.length }}</span>
                  </h2>
                  <ul class="lista">
                    @for (t of g.tareas; track t.id_tarea; let i = $index) {
                      <li class="fila" [class.fila--hecha]="cerrada(t)" [style.--i]="i < 12 ? i : 12" data-testid="tarea-row">
                        <button type="button" class="check" role="checkbox" [attr.aria-checked]="t.estado === 'completada'"
                          [disabled]="t.estado === 'cancelada' || actualizando().has(t.id_tarea)"
                          [attr.aria-label]="(t.estado === 'completada' ? 'Reabrir: ' : 'Completar: ') + t.titulo"
                          (click)="alternarCompletada(t)">
                          <span class="check-caja" [class.check-caja--on]="t.estado === 'completada'" [class.check-caja--alta]="t.prioridad === 'alta' && !cerrada(t)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path class="check-trazo" stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                          </span>
                        </button>

                        <div class="fila-cuerpo" role="button" tabindex="0" data-testid="tarea-abrir"
                          [attr.aria-label]="'Abrir ' + t.titulo" (click)="abrirDetalle(t)" (keydown.enter)="abrirDetalle(t)" (keydown.space)="abrirDetalle(t); $event.preventDefault()">
                          <div class="flex items-start gap-2">
                            <p class="fila-titulo">{{ t.titulo }}</p>
                            @if (t.prioridad === 'alta' && !cerrada(t)) {
                              <span class="prio-alta" title="Prioridad alta">
                                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3a1 1 0 011 1v.5l11.4-.9a1 1 0 01.9 1.5L16.5 8l1.8 2.9a1 1 0 01-.9 1.5L6 13.3V20a1 1 0 11-2 0V4a1 1 0 011-1z"/></svg>
                                Alta
                              </span>
                            }
                          </div>
                          @if (t.descripcion) {
                            <p class="fila-desc">{{ t.descripcion }}</p>
                          }
                          <div class="fila-meta">
                            @if (t.estado === 'en_progreso') {
                              <span class="meta meta--progreso"><span class="punto"></span>En progreso</span>
                            }
                            @if (t.estado === 'cancelada') {
                              <span class="meta">Cancelada</span>
                            }
                            @if (t.fecha_limite) {
                              <span class="meta" [ngClass]="claseFecha(t)">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                                {{ textoFecha(t) }}
                              </span>
                            }
                            @if (relacion(t); as rel) {
                              <span class="meta" [title]="rel.texto">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                                  @if (rel.tipo === 'para') {
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                                  } @else if (rel.tipo === 'sin') {
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" stroke-dasharray="2 3" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                  } @else {
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 17l-5-5m0 0l5-5m-5 5h12"/>
                                  }
                                </svg>
                                <span class="truncate max-w-[11rem]">{{ rel.texto }}</span>
                              </span>
                            }
                            @if (t.subtareas_total) {
                              <span class="meta" [title]="t.subtareas_completadas + ' de ' + t.subtareas_total + ' pasos hechos'">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>
                                <span class="tabular-nums">{{ t.subtareas_completadas }}/{{ t.subtareas_total }}</span>
                              </span>
                            }
                            @if (t.origen_tipo === 'acta_reunion' && t.origen_id) {
                              <button type="button" class="meta meta--enlace" (click)="irAActa(t); $event.stopPropagation()">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                                Acta #{{ t.origen_id }}
                              </button>
                            }
                          </div>
                        </div>

                        <svg class="fila-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                      </li>
                    }
                  </ul>
                </section>
              }
            </div>
          }
        </section>
      </main>

      <app-tarea-crear-modal [open]="modalCrear()" (openChange)="modalCrear.set($event)" (creada)="onTareaCreada($event)"/>

      <!-- ── Detalle: panel lateral (hoja inferior en móvil) ── -->
      @if (tareaDrawerId(); as idDrawer) {
        <div class="drawer-fondo" [class.drawer-fondo--sale]="cerrandoDrawer()" (click)="cerrarDetalle()"></div>
        <aside class="drawer" [class.drawer--sale]="cerrandoDrawer()" role="dialog" aria-modal="true" aria-label="Detalle de la tarea">
          <app-tarea-detail-panel
            [tareaId]="idDrawer"
            [modoDrawer]="true"
            (cerrar)="cerrarDetalle()"
            (tareaActualizada)="onTareaActualizada($event)"
            (tareaEliminada)="onTareaEliminada($event)"
          />
        </aside>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; --ease: cubic-bezier(0.23, 1, 0.32, 1); }

    .pressable { transition-property: transform, background-color, color, border-color, box-shadow; transition-duration: 160ms; transition-timing-function: var(--ease); }
    .pressable:active:not(:disabled) { transform: scale(0.97); }
    .pressable:focus-visible, .seg:focus-visible, .fila-cuerpo:focus-visible, .check:focus-visible, .meta--enlace:focus-visible {
      outline: 2px solid rgb(244 63 94); outline-offset: 2px;
    }

    /* Segmentado de vista */
    .seg { color: rgb(107 114 128); transition: background-color 160ms var(--ease), color 160ms var(--ease), box-shadow 160ms var(--ease); }
    .seg:hover { color: rgb(55 65 81); }
    .seg--on { background: #fff; color: rgb(17 24 39); box-shadow: 0 1px 2px rgb(15 23 42 / 0.06), 0 1px 3px rgb(15 23 42 / 0.08); }
    :host-context(.dark) .seg { color: rgb(148 163 184); }
    :host-context(.dark) .seg:hover { color: rgb(226 232 240); }
    :host-context(.dark) .seg--on { background: rgb(51 65 85); color: #fff; box-shadow: none; }

    /* Tarjetas de resumen (mismo idioma que el resto del portal) */
    .resumen {
      display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 12px; text-align: left;
      background: #fff; border: 1px solid rgb(243 244 246);
    }
    @media (hover: hover) and (pointer: fine) { .resumen:hover { box-shadow: 0 6px 16px -8px rgb(15 23 42 / 0.15); } }
    :host-context(.dark) .resumen { background: rgb(30 41 59); border-color: rgb(51 65 85); }
    .resumen-icono { width: 40px; height: 40px; flex-shrink: 0; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .resumen-icono svg { width: 20px; height: 20px; }
    .resumen-num { display: block; font-family: var(--font-display); font-size: 24px; font-weight: 700; line-height: 1; color: rgb(17 24 39); font-variant-numeric: tabular-nums; }
    .resumen-label { display: block; margin-top: 4px; font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: rgb(107 114 128); white-space: nowrap; }
    :host-context(.dark) .resumen-num { color: #fff; }
    :host-context(.dark) .resumen-label { color: rgb(148 163 184); }
    .resumen[data-tono="rosa"] .resumen-icono { background: rgb(255 241 242); color: rgb(244 63 94); }
    .resumen[data-tono="rojo"] .resumen-icono { background: rgb(254 242 242); color: rgb(239 68 68); }
    .resumen[data-tono="ambar"] .resumen-icono { background: rgb(255 247 237); color: rgb(249 115 22); }
    .resumen[data-tono="verde"] .resumen-icono { background: rgb(236 253 245); color: rgb(16 185 129); }
    :host-context(.dark) .resumen .resumen-icono { background: rgb(255 255 255 / 0.06); }
    .resumen--on[data-tono="rosa"] { border-color: rgb(253 164 175); box-shadow: 0 0 0 3px rgb(244 63 94 / 0.08); }
    .resumen--on[data-tono="rojo"] { border-color: rgb(252 165 165); box-shadow: 0 0 0 3px rgb(239 68 68 / 0.08); }
    .resumen--on[data-tono="ambar"] { border-color: rgb(253 186 116); box-shadow: 0 0 0 3px rgb(249 115 22 / 0.08); }
    .resumen--on[data-tono="verde"] { border-color: rgb(110 231 183); box-shadow: 0 0 0 3px rgb(16 185 129 / 0.08); }
    /* Entre 640 y 1023 px van 4 en fila: más compactas para que quepan las etiquetas. */
    @media (max-width: 1023px) {
      .resumen { padding: 12px; gap: 10px; }
      .resumen-icono { width: 34px; height: 34px; border-radius: 10px; }
      .resumen-icono svg { width: 18px; height: 18px; }
      .resumen-num { font-size: 20px; }
    }

    /* Barra de herramientas */
    .barra {
      position: relative; z-index: 10; display: flex; flex-direction: column; gap: 8px; padding: 8px; border-radius: 12px;
      background: #fff; border: 1px solid rgb(243 244 246);
    }
    .barra-buscar { flex: 1 1 auto; }
    /* 640–1023 px: vista + prioridad arriba, buscador a todo el ancho debajo. */
    @media (min-width: 640px) {
      .barra { flex-direction: row; flex-wrap: wrap; align-items: center; }
      .barra-prio { margin-left: auto; }
      .barra-buscar { order: 3; flex-basis: 100%; }
    }
    @media (min-width: 1024px) {
      .barra { flex-wrap: nowrap; }
      .barra-prio { margin-left: 0; }
      .barra-buscar { order: 0; flex-basis: auto; }
    }
    :host-context(.dark) .barra { background: rgb(30 41 59 / 0.8); border-color: rgb(51 65 85); }

    /* Grupos */
    .grupo-titulo {
      display: flex; align-items: baseline; gap: 8px; margin: 0 0 8px 4px;
      font-family: var(--font-display); font-size: 13px; font-weight: 700; letter-spacing: 0.01em;
      color: rgb(55 65 81);
    }
    .grupo-titulo--alerta { color: rgb(185 28 28); }
    .grupo-num { font-family: var(--font-sans); font-size: 12px; font-weight: 600; color: rgb(156 163 175); font-variant-numeric: tabular-nums; }
    :host-context(.dark) .grupo-titulo { color: rgb(203 213 225); }
    :host-context(.dark) .grupo-titulo--alerta { color: rgb(252 165 165); }

    /* Lista */
    .lista {
      list-style: none; margin: 0; padding: 0; background: #fff; border: 1px solid rgb(229 231 235);
      border-radius: 14px; overflow: hidden;
    }
    :host-context(.dark) .lista { background: rgb(30 41 59 / 0.6); border-color: rgb(51 65 85); }
    .fila {
      position: relative; display: grid; grid-template-columns: 44px 1fr auto; align-items: start;
      padding: 6px 12px 6px 4px; border-top: 1px solid rgb(243 244 246);
      animation: filaEntra 260ms var(--ease) both; animation-delay: calc(var(--i, 0) * 28ms);
      transition: background-color 160ms ease;
    }
    .fila:first-child { border-top: none; }
    :host-context(.dark) .fila { border-top-color: rgb(51 65 85 / 0.7); }
    @media (hover: hover) and (pointer: fine) {
      .fila:hover { background: rgb(249 250 251); }
      :host-context(.dark) .fila:hover { background: rgb(51 65 85 / 0.35); }
      .fila:hover .fila-chevron { opacity: 1; transform: translateX(0); }
    }
    @keyframes filaEntra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

    .check { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 10px; cursor: pointer; }
    .check:disabled { cursor: default; }
    .check-caja {
      width: 20px; height: 20px; border-radius: 999px; border: 1.75px solid rgb(209 213 219);
      display: flex; align-items: center; justify-content: center; color: #fff;
      transition: background-color 180ms var(--ease), border-color 180ms var(--ease), transform 180ms var(--ease);
    }
    .check-caja--alta { border-color: rgb(248 113 113); }
    .check:hover:not(:disabled) .check-caja:not(.check-caja--on) { border-color: rgb(16 185 129); background: rgb(16 185 129 / 0.08); }
    .check:active:not(:disabled) .check-caja { transform: scale(0.88); }
    .check-caja svg { width: 12px; height: 12px; }
    .check-trazo { stroke-dasharray: 24; stroke-dashoffset: 24; transition: stroke-dashoffset 220ms var(--ease) 60ms; }
    .check-caja--on { background: rgb(16 185 129); border-color: rgb(16 185 129); }
    .check-caja--on .check-trazo { stroke-dashoffset: 0; }
    :host-context(.dark) .check-caja:not(.check-caja--on):not(.check-caja--alta) { border-color: rgb(100 116 139); }

    .fila-cuerpo { min-width: 0; padding: 10px 0 10px 2px; cursor: pointer; border-radius: 8px; }
    .fila-titulo {
      font-size: 15px; font-weight: 600; line-height: 1.35; color: rgb(17 24 39);
      overflow-wrap: anywhere; transition: color 200ms ease;
    }
    :host-context(.dark) .fila-titulo { color: rgb(241 245 249); }
    .fila-desc {
      margin-top: 2px; font-size: 13px; line-height: 1.45; color: rgb(107 114 128);
      display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; max-width: 70ch;
    }
    :host-context(.dark) .fila-desc { color: rgb(148 163 184); }
    .fila--hecha .fila-titulo { color: rgb(156 163 175); text-decoration: line-through; text-decoration-color: rgb(209 213 219); }
    .fila--hecha .fila-desc { display: none; }
    :host-context(.dark) .fila--hecha .fila-titulo { color: rgb(100 116 139); text-decoration-color: rgb(71 85 105); }

    .fila-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin-top: 6px; }
    .fila-meta:empty { display: none; }
    .meta { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: rgb(107 114 128); }
    .meta svg { width: 13px; height: 13px; flex-shrink: 0; }
    :host-context(.dark) .meta { color: rgb(148 163 184); }
    .meta--vencida { color: rgb(220 38 38); font-weight: 600; }
    .meta--hoy { color: rgb(217 119 6); font-weight: 600; }
    :host-context(.dark) .meta--vencida { color: rgb(248 113 113); }
    :host-context(.dark) .meta--hoy { color: rgb(251 191 36); }
    .meta--progreso { color: rgb(180 83 9); }
    :host-context(.dark) .meta--progreso { color: rgb(252 211 77); }
    .punto { width: 6px; height: 6px; border-radius: 999px; background: currentColor; }
    .meta--enlace { color: rgb(190 18 60); border-radius: 4px; }
    .meta--enlace:hover { text-decoration: underline; text-underline-offset: 2px; }
    :host-context(.dark) .meta--enlace { color: rgb(251 113 133); }

    .prio-alta {
      display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; margin-top: 2px;
      padding: 1px 6px; border-radius: 6px; font-size: 11px; font-weight: 700;
      color: rgb(185 28 28); background: rgb(254 242 242);
    }
    :host-context(.dark) .prio-alta { color: rgb(252 165 165); background: rgb(127 29 29 / 0.35); }

    .fila-chevron {
      width: 16px; height: 16px; margin: 22px 0 0 8px; color: rgb(209 213 219); opacity: 0;
      transform: translateX(-4px); transition: opacity 160ms ease, transform 200ms var(--ease);
    }
    @media (hover: none) { .fila-chevron { display: none; } .fila { grid-template-columns: 44px 1fr; } }

    /* Estados vacío / error */
    .vacio {
      display: flex; flex-direction: column; align-items: center; text-align: center;
      padding: 56px 24px; border: 1px dashed rgb(229 231 235); border-radius: 16px; background: #fff;
    }
    :host-context(.dark) .vacio { background: rgb(30 41 59 / 0.4); border-color: rgb(51 65 85); }
    .vacio-icono { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; color: rgb(225 29 72); background: rgb(255 241 242); }
    :host-context(.dark) .vacio-icono { color: rgb(251 113 133); background: rgb(136 19 55 / 0.3); }
    .vacio-titulo { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: rgb(17 24 39); }
    .vacio-texto { margin-top: 4px; font-size: 14px; line-height: 1.5; color: rgb(107 114 128); max-width: 44ch; }
    :host-context(.dark) .vacio-titulo { color: rgb(241 245 249); }
    :host-context(.dark) .vacio-texto { color: rgb(148 163 184); }

    .btn-rosa { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 16px; border-radius: 10px; background: rgb(225 29 72); color: #fff; font-size: 14px; font-weight: 600; }
    .btn-rosa:hover { background: rgb(190 18 60); }
    .btn-sec { display: inline-flex; align-items: center; height: 40px; padding: 0 16px; border-radius: 10px; border: 1px solid rgb(229 231 235); background: #fff; color: rgb(55 65 81); font-size: 14px; font-weight: 600; }
    .btn-sec:hover { background: rgb(249 250 251); }
    :host-context(.dark) .btn-sec { background: rgb(30 41 59); border-color: rgb(51 65 85); color: rgb(226 232 240); }

    /* Esqueleto */
    .skel { background: linear-gradient(90deg, rgb(243 244 246) 0%, rgb(249 250 251) 50%, rgb(243 244 246) 100%); background-size: 200% 100%; animation: brillo 1.4s linear infinite; }
    :host-context(.dark) .skel { background: linear-gradient(90deg, rgb(51 65 85 / 0.5) 0%, rgb(71 85 105 / 0.5) 50%, rgb(51 65 85 / 0.5) 100%); background-size: 200% 100%; }
    @keyframes brillo { from { background-position: 200% 0; } to { background-position: -200% 0; } }

    /* Panel de detalle */
    .drawer-fondo {
      position: fixed; inset: 0; z-index: var(--z-modal-backdrop, 50); background: rgb(15 23 42 / 0.4);
      animation: fundido 200ms ease-out both;
    }
    .drawer {
      position: fixed; z-index: var(--z-modal, 60); top: 0; right: 0; bottom: 0; width: min(520px, 100vw);
      background: #fff; border-left: 1px solid rgb(229 231 235); overflow: hidden;
      box-shadow: -16px 0 40px -12px rgb(15 23 42 / 0.18);
      animation: entraLado 280ms var(--ease) both;
    }
    :host-context(.dark) .drawer { background: rgb(15 23 42); border-color: rgb(30 41 59); }
    .drawer-fondo--sale { animation: fundidoSale 160ms ease-in both; }
    .drawer--sale { animation: saleLado 180ms ease-in both; }
    @keyframes fundido { from { opacity: 0; } }
    @keyframes fundidoSale { to { opacity: 0; } }
    @keyframes entraLado { from { transform: translateX(100%); } }
    @keyframes saleLado { to { transform: translateX(100%); } }
    @media (prefers-reduced-motion: reduce) {
      .fila, .drawer, .drawer-fondo, .drawer--sale, .drawer-fondo--sale { animation: none !important; }
      .check-trazo, .check-caja, .fila-chevron { transition: none !important; }
      .skel { animation: none; }
    }
  `],
})
export class MisTareasPage implements OnInit {
  private svc = inject(ActaService);
  private store = inject(AuthStore);
  private router = inject(Router);
  private toast = inject(ToastService);

  tareas = signal<Tarea[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  vista = signal<Vista>('todas');
  filtro = signal<Filtro>('abiertas');
  prioridad = signal<FiltroPrioridad>('todas');
  busqueda = signal('');
  actualizando = signal<Set<number>>(new Set());
  /** Completadas en esta visita: siguen a la vista para que el check se vea y se pueda deshacer. */
  recientes = signal<Set<number>>(new Set());
  tareaDrawerId = signal<number | null>(null);
  cerrandoDrawer = signal(false);
  modalCrear = signal(false);

  readonly vistas: { value: Vista; label: string; corto: string }[] = [
    { value: 'todas',     label: 'Todas',          corto: 'Todas' },
    { value: 'asignadas', label: 'Asignadas a mí', corto: 'Para mí' },
    { value: 'creadas',   label: 'Creadas por mí', corto: 'Creadas' },
  ];
  readonly tarjetas: { value: Exclude<Filtro, 'todas'>; label: string; tono: string; icono: string }[] = [
    { value: 'abiertas',    label: 'Por hacer',   tono: 'rosa',  icono: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { value: 'vencidas',    label: 'Vencidas',    tono: 'rojo',  icono: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
    { value: 'hoy',         label: 'Para hoy',    tono: 'ambar', icono: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
    { value: 'completadas', label: 'Completadas', tono: 'verde', icono: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  ];
  private readonly etiquetas: Record<Filtro, string> = {
    abiertas: 'por hacer', vencidas: 'vencidas', hoy: 'para hoy', completadas: 'completadas o canceladas', todas: 'todas',
  };
  readonly opcionesPrioridad: PickerOption[] = [
    { value: 'todas', label: 'Cualquier prioridad' },
    { value: 'alta',  label: 'Prioridad alta' },
    { value: 'media', label: 'Prioridad media' },
    { value: 'baja',  label: 'Prioridad baja' },
  ];

  private get miId(): number | null {
    const id = this.store.user()?.id;
    return id != null ? Number(id) : null;
  }

  /** YYYY-MM-DD en hora local (toISOString daría el día siguiente por la noche en Colombia). */
  private hoy(): string { return new Date().toLocaleDateString('en-CA'); }
  private enDias(n: number): string { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); }

  cerrada(t: Tarea): boolean { return t.estado === 'completada' || t.estado === 'cancelada'; }
  private vencida(t: Tarea): boolean { return !!t.fecha_limite && !this.cerrada(t) && t.fecha_limite < this.hoy(); }
  private esHoy(t: Tarea): boolean { return !!t.fecha_limite && !this.cerrada(t) && t.fecha_limite === this.hoy(); }

  private tareasVista = computed(() => {
    const yo = this.miId;
    const v = this.vista();
    const lista = this.tareas();
    if (v === 'asignadas') return lista.filter(t => t.asignado_a === yo);
    if (v === 'creadas') return lista.filter(t => t.creado_por === yo);
    return lista;
  });

  conteo = computed(() => {
    const l = this.tareasVista();
    return {
      abiertas: l.filter(t => !this.cerrada(t)).length,
      vencidas: l.filter(t => this.vencida(t)).length,
      hoy: l.filter(t => this.esHoy(t)).length,
    } as Record<Filtro, number>;
  });

  conteoCompletadas = computed(() => this.tareasVista().filter(t => this.cerrada(t)).length);
  totalVisible = computed(() => this.grupos().reduce((n, g) => n + g.tareas.length, 0));
  etiquetaFiltro = computed(() => this.etiquetas[this.filtro()]);

  resumenCabecera = computed(() => {
    const c = this.conteo();
    if (!this.tareas().length) return '';
    if (!c['abiertas']) return 'Estás al día: no tienes tareas por hacer';
    const partes = [`${c['abiertas']} por hacer`];
    if (c['vencidas']) partes.push(`${c['vencidas']} vencida${c['vencidas'] === 1 ? '' : 's'}`);
    if (c['hoy']) partes.push(`${c['hoy']} para hoy`);
    return partes.join(' · ');
  });

  private filtradas = computed(() => {
    const f = this.filtro();
    const rec = this.recientes();
    let lista = this.tareasVista().filter(t => {
      switch (f) {
        case 'abiertas':    return !this.cerrada(t) || rec.has(t.id_tarea);
        case 'vencidas':    return this.vencida(t) || (rec.has(t.id_tarea) && !!t.fecha_limite && t.fecha_limite < this.hoy());
        case 'hoy':         return this.esHoy(t) || (rec.has(t.id_tarea) && t.fecha_limite === this.hoy());
        case 'completadas': return this.cerrada(t);
        default:            return true;
      }
    });
    const p = this.prioridad();
    if (p !== 'todas') lista = lista.filter(t => t.prioridad === p);
    const q = this.busqueda().trim().toLowerCase();
    if (q) lista = lista.filter(t => t.titulo.toLowerCase().includes(q) || (t.descripcion ?? '').toLowerCase().includes(q));
    return lista;
  });

  grupos = computed(() => {
    const hoy = this.hoy();
    const semana = this.enDias(7);
    const rec = this.recientes();
    const f = this.filtro();
    const porGrupo = new Map<Grupo, Tarea[]>();
    for (const t of this.filtradas()) {
      // Las recién completadas se quedan en su sitio para no "saltar" bajo el dedo.
      const comoAbierta = !this.cerrada(t) || (rec.has(t.id_tarea) && f !== 'completadas' && f !== 'todas');
      let g: Grupo;
      if (!comoAbierta) g = 'cerradas';
      else if (!t.fecha_limite) g = 'sinfecha';
      else if (t.fecha_limite < hoy) g = 'vencidas';
      else if (t.fecha_limite === hoy) g = 'hoy';
      else if (t.fecha_limite <= semana) g = 'semana';
      else g = 'despues';
      if (!porGrupo.has(g)) porGrupo.set(g, []);
      porGrupo.get(g)!.push(t);
    }
    return GRUPOS.filter(g => porGrupo.has(g.key)).map(g => ({
      ...g,
      tareas: porGrupo.get(g.key)!.sort((a, b) =>
        g.key === 'cerradas'
          ? (b.completado_en ?? b.actualizado_en).localeCompare(a.completado_en ?? a.actualizado_en)
          : (ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad])
            || (a.fecha_limite ?? '9999').localeCompare(b.fecha_limite ?? '9999')
            || b.creado_en.localeCompare(a.creado_en)),
    }));
  });

  vacio = computed((): { titulo: string; texto: string; accion: 'crear' | 'limpiar' | 'completadas' | null } => {
    if (this.busqueda().trim() || this.prioridad() !== 'todas') {
      return { titulo: 'Ninguna tarea coincide', texto: 'Prueba con otra palabra o quita el filtro de prioridad.', accion: 'limpiar' };
    }
    if (!this.tareasVista().length) {
      if (this.vista() === 'asignadas') return { titulo: 'Nadie te ha asignado tareas', texto: 'Cuando alguien te asigne una, aparecerá aquí y recibirás un aviso.', accion: null };
      if (this.vista() === 'creadas') return { titulo: 'Aún no has creado tareas', texto: 'Crea una para ti o asígnala a alguien de tu congregación.', accion: 'crear' };
      return { titulo: 'Aún no tienes tareas', texto: 'Crea una para ti o asígnala a alguien. Las que te asignen también aparecerán aquí.', accion: 'crear' };
    }
    switch (this.filtro()) {
      case 'abiertas':    return { titulo: 'Estás al día', texto: 'No tienes nada por hacer en este momento.', accion: 'completadas' };
      case 'vencidas':    return { titulo: 'Nada vencido', texto: 'Ninguna tarea abierta ha pasado su fecha límite.', accion: null };
      case 'hoy':         return { titulo: 'Nada para hoy', texto: 'Ninguna tarea abierta vence hoy.', accion: null };
      case 'completadas': return { titulo: 'Aún no hay tareas completadas', texto: 'Las que marques como hechas se guardarán aquí.', accion: null };
      default:            return { titulo: 'Sin tareas', texto: '', accion: 'crear' };
    }
  });

  ngOnInit() { this.cargarTareas(); }

  cargarTareas() {
    this.loading.set(true);
    this.error.set(null);
    this.recientes.set(new Set());
    this.svc.listarTareasGlobal().subscribe({
      next: (data) => { this.tareas.set(data); this.loading.set(false); },
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'Revisa tu conexión e inténtalo de nuevo.');
        this.loading.set(false);
      },
    });
  }

  limpiarFiltros() {
    this.busqueda.set('');
    this.prioridad.set('todas');
  }

  /** "Para X" si la delegué; "De X" si me la asignó otra persona. Nada si es mía para mí. */
  relacion(t: Tarea): { tipo: 'para' | 'de' | 'sin'; texto: string } | null {
    const yo = this.miId;
    if (t.creado_por === yo && t.asignado_a !== yo) {
      return t.asignado_a_nombre ? { tipo: 'para', texto: `Para ${t.asignado_a_nombre}` } : { tipo: 'sin', texto: 'Sin asignar' };
    }
    if (t.asignado_a === yo && t.creado_por !== yo && t.creado_por_nombre) {
      return { tipo: 'de', texto: `De ${t.creado_por_nombre}` };
    }
    return null;
  }

  textoFecha(t: Tarea): string {
    const d = new Date(t.fecha_limite + 'T00:00:00');
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dias = Math.round((d.getTime() - hoy.getTime()) / 86400000);
    if (!this.cerrada(t)) {
      if (dias < 0) return dias === -1 ? 'Venció ayer' : `Venció hace ${-dias} días`;
      if (dias === 0) return 'Vence hoy';
      if (dias === 1) return 'Mañana';
      if (dias < 7) return d.toLocaleDateString('es', { weekday: 'long' });
    }
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: d.getFullYear() !== hoy.getFullYear() ? 'numeric' : undefined });
  }

  claseFecha(t: Tarea): string {
    if (this.vencida(t)) return 'meta--vencida';
    if (this.esHoy(t)) return 'meta--hoy';
    return '';
  }

  alternarCompletada(t: Tarea) {
    if (this.actualizando().has(t.id_tarea)) return;
    const nuevo: Tarea['estado'] = t.estado === 'completada' ? 'pendiente' : 'completada';
    const previo = t.estado;
    this.marcarActualizando(t.id_tarea, true);
    if (nuevo === 'completada') this.recientes.update(s => new Set(s).add(t.id_tarea));
    this.reemplazar({ ...t, estado: nuevo });
    this.svc.actualizarEstadoTarea(t.id_tarea, nuevo).subscribe({
      next: (u) => { this.reemplazar(u); this.marcarActualizando(t.id_tarea, false); },
      error: (err) => {
        this.reemplazar({ ...t, estado: previo });
        this.marcarActualizando(t.id_tarea, false);
        this.toast.error('No se pudo actualizar la tarea', err?.error?.detail ?? 'Inténtalo de nuevo.');
      },
    });
  }

  private marcarActualizando(id: number, on: boolean) {
    this.actualizando.update(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  }

  private reemplazar(t: Tarea) {
    this.tareas.update(list => list.map(x => x.id_tarea === t.id_tarea ? t : x));
  }

  abrirDetalle(t: Tarea) {
    this.cerrandoDrawer.set(false);
    this.tareaDrawerId.set(t.id_tarea);
  }

  cerrarDetalle() {
    if (!this.tareaDrawerId() || this.cerrandoDrawer()) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { this.tareaDrawerId.set(null); return; }
    this.cerrandoDrawer.set(true);
    setTimeout(() => { this.tareaDrawerId.set(null); this.cerrandoDrawer.set(false); }, 170);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    // Si hay un diálogo encima (confirmar borrado), Esc lo cierra a él, no al panel.
    if (this.modalCrear() || document.querySelector('app-confirm-dialog [aria-modal="true"], app-confirm-dialog [role="alertdialog"]')) return;
    this.cerrarDetalle();
  }

  onTareaCreada(t: Tarea) {
    this.tareas.update(list => [t, ...list]);
    // Que se vea la recién creada aunque un filtro la ocultara.
    this.limpiarFiltros();
    this.filtro.set('abiertas');
    if (this.vista() === 'asignadas' && t.asignado_a !== this.miId) this.vista.set('creadas');
  }

  onTareaActualizada(updated: Tarea) {
    if (updated.estado === 'completada') this.recientes.update(s => new Set(s).add(updated.id_tarea));
    this.reemplazar(updated);
  }

  onTareaEliminada(id: number) {
    this.tareas.update(list => list.filter(t => t.id_tarea !== id));
    this.tareaDrawerId.set(null);
    this.cerrandoDrawer.set(false);
  }

  irAActa(t: Tarea) {
    if (t.origen_tipo === 'acta_reunion' && t.origen_id) {
      this.router.navigate(['/secretario-tools/actas-reunion', t.origen_id]);
    }
  }
}
