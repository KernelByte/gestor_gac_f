import {
  Component, signal, computed, inject, OnInit, effect, untracked,
} from '@angular/core';
import { Observable, Subject, debounceTime, distinctUntilChanged, forkJoin, switchMap, EMPTY } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { TimePickerComponent } from '../../../shared/components/time-picker/time-picker.component';
import { UbicacionPickerComponent } from './ubicacion-picker.component';
import { DiscursoCatalogoInputComponent } from './discurso-catalogo-input.component';
import { CongregacionContactoInputComponent } from './congregacion-contacto-input.component';
import { HistorialDiscursosComponent } from './historial-discursos.component';
import { DiscursosService } from '../services/discursos.service';
import { ConflictosService } from '../services/conflictos.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  CatalogoDiscurso,
  CongregacionContacto,
  ContactoPersona,
  CrearTemaRequest,
  DiscursoEntranteOut,
  DiscursosMesOut,
  DiscursoSalienteOut,
  EditarTemaRequest,
  GrupoSimple,
  HistorialOcurrenciaEntrante,
  MesDiscursosDisponible,
  MESES_ES,
  PublicadorSimple,
  TemaPublicador,
  UbicacionSaliente,
} from '../models/discursos.models';

type Estado = 'idle' | 'loading' | 'ready' | 'error';
type SubTab = 'entrantes' | 'salientes' | 'temas' | 'congregaciones';

@Component({
  selector: 'app-reuniones-discursos',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, TimePickerComponent, UbicacionPickerComponent, DiscursoCatalogoInputComponent, CongregacionContactoInputComponent, HistorialDiscursosComponent],
  template: `
    <div class="flex flex-col h-full gap-0">

      <!-- PAGE HEADER (solo móvil: en escritorio el título ya se muestra
           junto al selector de tipo de reunión, en el componente padre). -->
      <div class="md:hidden shrink-0 flex items-center justify-between gap-3 pb-3">
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
            Discursos Públicos
          </h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 min-h-[1rem] truncate">Salientes · Entrantes · Hospitalidad</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          @if (!mesDatos() && hasEditPermission()) {
            <button data-testid="disc-btn-generar-mes" (click)="abrirModalGenerar()" [disabled]="estado() === 'loading'"
              aria-label="Generar mes"
              class="flex items-center gap-1.5 px-3 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 text-xs font-bold text-white transition-all shadow-sm active:scale-95">
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </button>
          }
        </div>
      </div>


      <!-- ERROR -->
      @if (estado() === 'error') {
        <div class="shrink-0 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 mb-3 flex items-center gap-3">
          <svg class="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p class="flex-1 min-w-0 text-red-600 dark:text-red-400 text-xs font-medium truncate">{{ errorMsg() }}</p>
          <button (click)="estado.set('idle')" class="shrink-0 px-3 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 text-xs text-red-600 font-bold">Cerrar</button>
        </div>
      }

      <!-- CONFIRMADO banner -->
      @if (confirmadoBanner()) {
        <div class="shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/50 px-4 py-3 mb-3 flex items-center gap-3">
          <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <p class="text-emerald-700 dark:text-emerald-300 text-xs font-bold">Discursos confirmados correctamente.</p>
        </div>
      }

      <!-- MODAL DE CONFIRMACIÓN (reemplaza window.confirm) -->
      @if (confirmPendiente()) {
        <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4 border border-slate-200 dark:border-slate-700">
            <div class="flex items-start gap-3">
              <div class="shrink-0 w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg class="w-4.5 h-4.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
              </div>
              <div>
                <p class="text-sm font-bold text-slate-900 dark:text-white">{{ confirmPendiente()!.titulo }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ confirmPendiente()!.mensaje }}</p>
              </div>
            </div>
            <div class="flex gap-2 justify-end">
              <button (click)="cancelarConfirm()"
                class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                Cancelar
              </button>
              <button (click)="aceptarConfirm()"
                class="px-4 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-all active:scale-95">
                {{ confirmPendiente()!.accionLabel }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- LAYOUT -->
      <div class="flex-1 min-h-0 flex flex-col md:flex-row gap-3 md:gap-4 overflow-hidden">

        <!-- SIDEBAR -->
        <aside class="hidden md:flex md:w-52 lg:w-56 xl:w-60 2xl:w-64 shrink-0 flex-col gap-3 overflow-y-auto simple-scrollbar p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">

          @if (mesesDisponibles().length > 0) {
            <div class="flex flex-col gap-0.5">
              <div class="flex items-center justify-between px-1.5 pb-1.5">
                <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Meses programados</p>
                <!-- Mismo pill violeta que ya usa el resto del módulo
                     (p.ej. las etiquetas de "Historial" en Entre semana). -->
                <span class="min-w-[1.25rem] h-[1.15rem] px-1.5 rounded-full bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-400 text-[0.6rem] font-bold data-num flex items-center justify-center">{{ mesesDisponibles().length }}</span>
              </div>
              <!-- Sin caja propia: el aside ya es el contenedor, envolver la
                   lista en otra caja adentro solo apilaba bordes. -->
              @for (grupo of mesesPorAno(); track grupo.ano) {
                <!-- Año como divisor del grupo, no repetido por fila; mismo
                     filete que separa las secciones de la tabla principal. -->
                <div class="flex items-center gap-2 px-1.5 pt-3 pb-1.5 first:pt-0.5">
                  <span class="text-[0.65rem] font-bold text-slate-400 dark:text-slate-500 data-num">{{ grupo.ano }}</span>
                  <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
                </div>
                <!-- Misma tarjeta bordeada que el historial de Entre semana:
                     borde propio + fondo blanco en reposo, violeta al pasar
                     el mouse. -->
                <div class="flex flex-col gap-1.5">
                  @for (m of grupo.meses; track m.ano + '-' + m.mes) {
                    <!-- Sin botones de PDF por fila: ya estan en la barra de
                         acciones del detalle cuando el mes esta abierto. -->
                    <button data-testid="disc-fila-mes" [attr.data-ano]="m.ano" [attr.data-mes]="m.mes" (click)="cargarMes(m.ano, m.mes)" [disabled]="estado() === 'loading'"
                      class="w-full flex items-center justify-between gap-1 px-2.5 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:border-violet-300 dark:hover:border-violet-700 text-slate-700 dark:text-slate-200 text-xs font-medium transition-all active:scale-[0.98] disabled:opacity-40 group">
                      <span class="min-w-0 flex items-center gap-1.5">
                        @if (m.confirmado) {
                          <svg class="w-3 h-3 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                        }
                        <span class="truncate">{{ mesSoloLabel(m.mes) }}</span>
                      </span>
                      <svg class="w-3 h-3 shrink-0 text-slate-400 group-hover:text-violet-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                  }
                </div>
              }
            </div>
          }

          <!-- Generar Mes -->
          @if (hasEditPermission()) {
            <div class="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 shrink-0">
              <button data-testid="disc-btn-generar-mes" (click)="abrirModalGenerar()" [disabled]="estado() === 'loading'"
                class="w-full flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-all shadow-sm shadow-purple-900/20 active:scale-95">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Generar Mes
              </button>
            </div>
          }
        </aside>

        <!-- MAIN -->
        <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative">

          <!-- Tab bar: Entrantes/Salientes (left) only when a month is loaded; Temas (right) always -->
          <div class="shrink-0 flex items-center justify-between gap-2 px-1.5 py-1.5 border-b border-slate-100 dark:border-slate-800">
            <!-- Left: Entrantes / Salientes tabs -->
            <div class="flex items-center">
              @if (mesDatos()) {
                <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1" role="tablist">
                  <button (click)="subTab.set('entrantes')"
                    role="tab" [attr.aria-selected]="subTab() === 'entrantes'"
                    class="flex items-center justify-center gap-1.5 px-3 h-10 rounded-lg text-xs font-bold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]"
                    [class]="subTab() === 'entrantes'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
                    <!-- Entrantes: flecha apuntando hacia adentro (descarga/recepción) -->
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h13M10 6l-6 6 6 6"/>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M21 5v14" opacity=".4"/>
                    </svg>
                    <span>Entrantes</span>
                  </button>
                  <button (click)="subTab.set('salientes')"
                    role="tab" [attr.aria-selected]="subTab() === 'salientes'"
                    class="flex items-center justify-center gap-1.5 px-3 h-10 rounded-lg text-xs font-bold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]"
                    [class]="subTab() === 'salientes'
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
                    <!-- Salientes: flecha apuntando hacia afuera (envío/salida) -->
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M21 12H8M14 6l6 6-6 6"/>
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 5v14" opacity=".4"/>
                    </svg>
                    <span>Salientes</span>
                  </button>
                </div>
              }
            </div>
            <!-- Right: Historial / Temas buttons (always visible, independent of month) -->
            <div class="flex items-center gap-1.5 shrink-0">
              <button (click)="abrirModalHistorial()"
                title="Historial de discursos" aria-label="Historial de discursos"
                class="w-9 h-9 sm:w-auto sm:px-3 sm:gap-1.5 flex items-center justify-center rounded-xl text-xs font-bold border transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97] border-sky-300 dark:border-sky-700/60 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="9"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 3"/>
                </svg>
                <span class="hidden sm:inline">Historial</span>
              </button>
              <button (click)="subTab.set('temas')"
                role="tab" [attr.aria-selected]="subTab() === 'temas'"
                title="Portafolio de temas"
                class="flex items-center gap-1.5 px-3 h-10 rounded-xl text-xs font-bold border transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97]"
                [class]="subTab() === 'temas'
                  ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/25'
                  : 'border-amber-300 dark:border-amber-700/60 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
                </svg>
                <span>Temas</span>
              </button>
              <button (click)="subTab.set('congregaciones')"
                role="tab" [attr.aria-selected]="subTab() === 'congregaciones'"
                title="Congregaciones de contacto"
                class="flex items-center gap-1.5 px-3 h-10 rounded-xl text-xs font-bold border transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97]"
                [class]="subTab() === 'congregaciones'
                  ? 'bg-teal-500 border-teal-500 text-white shadow-md shadow-teal-500/25'
                  : 'border-teal-300 dark:border-teal-700/60 text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20'">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                  <circle cx="12" cy="12" r="2"/>
                </svg>
                <span class="hidden sm:inline">Congregaciones</span>
              </button>
            </div>
          </div>

          @if (subTab() === 'congregaciones') {
            <!-- CONGREGACIONES DE CONTACTO tab -->
            <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar flex flex-col gap-3 p-3 sm:p-4">
              @if (hasEditPermission()) {
                <button (click)="abrirModalCongregacionContacto()"
                  class="self-start flex items-center gap-2 px-4 h-9 rounded-xl border-2 border-dashed border-teal-400 dark:border-teal-600 text-xs font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all active:scale-95">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Añadir congregación
                </button>
              }
              @if (loadingCongregacionesContacto()) {
                <div class="flex items-center justify-center py-12">
                  <div class="w-7 h-7 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-teal-500 animate-spin"></div>
                </div>
              } @else if (congregacionesContacto().length === 0) {
                <div class="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <svg class="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  </div>
                  <div>
                    <p class="text-sm font-bold text-slate-600 dark:text-slate-500">Sin congregaciones registradas</p>
                    <p class="text-xs text-slate-400 mt-0.5">Guarda las congregaciones con las que coordinas discursos para autocompletar hora y ubicación</p>
                  </div>
                </div>
              } @else {
                @for (c of congregacionesContacto(); track c.id_congregacion_contacto) {
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                    <div class="bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <div class="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-xs font-black text-teal-600 dark:text-teal-400 shrink-0">
                        {{ c.nombre.charAt(0).toUpperCase() }}
                      </div>
                      <div class="min-w-0">
                        <span class="text-sm font-black text-slate-800 dark:text-slate-100 truncate block">{{ c.nombre }}</span>
                        @if (c.dia_reunion_fin_semana || c.hora_reunion_fin_semana) {
                          <span class="text-[0.65rem] text-slate-400">
                            {{ diaLabel(c.dia_reunion_fin_semana) }}{{ c.hora_reunion_fin_semana ? ' ' + c.hora_reunion_fin_semana : '' }}
                          </span>
                        }
                      </div>
                      @if (hasEditPermission()) {
                        <div class="ml-auto flex items-center gap-1">
                          <button (click)="abrirModalCongregacionContacto(c)" title="Editar"
                            class="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button (click)="confirmarEliminarCongregacionContacto(c)" title="Eliminar"
                            class="w-9 h-9 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      }
                    </div>
                    <div class="flex flex-col gap-2.5 p-3">
                      @if (c.url_mapa) {
                        <app-ubicacion-picker size="sm" [ngModel]="ubicacionDeContacto(c)" [ngModelOptions]="{ standalone: true }" [disabled]="true"></app-ubicacion-picker>
                      }
                      <div class="flex flex-col gap-1">
                        @for (p of c.personas; track p.id_contacto_persona; let last = $last) {
                          <div class="flex items-center gap-2 py-1.5" [class]="!last ? 'border-b border-slate-100 dark:border-slate-800' : ''">
                            <span class="min-w-0 flex-1 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{{ p.nombre }}</span>
                            @if (p.cargo) { <span class="min-w-0 flex-1 text-xs text-slate-500 dark:text-slate-400 truncate">{{ p.cargo }}</span> }
                            @if (p.telefono) { <span class="shrink-0 text-xs text-slate-500 dark:text-slate-400">{{ p.telefono }}</span> }
                            @if (p.telefono) {
                              <!-- Enlace y no botón: 'tel:' es cosa del sistema
                                   operativo, y así se puede abrir en otra
                                   aplicación o copiar con el menú del ratón.
                                   Es como enlaza teléfonos el resto de la app. -->
                              <a [href]="'tel:' + p.telefono"
                                [title]="'Llamar a ' + p.nombre"
                                [attr.aria-label]="'Llamar a ' + p.nombre"
                                class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sky-500 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-all active:scale-95">
                                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                              </a>
                              <button (click)="contactarPersona(p)" [title]="'Escribir a ' + p.nombre + ' por WhatsApp'"
                                [attr.aria-label]="'Escribir a ' + p.nombre + ' por WhatsApp'"
                                class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-95">
                                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                              </button>
                            }
                          </div>
                        }
                        @if (c.personas.length === 0) {
                          <p class="text-xs text-slate-400 py-1">Sin personas de contacto registradas. Edita la congregación para añadir.</p>
                        }
                      </div>
                    </div>
                  </div>
                }
              }
            </div>
          } @else if (subTab() === 'temas') {
            <!-- TEMAS tab -->
            <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar flex flex-col gap-3 p-3 sm:p-4">
              @if (hasEditPermission()) {
                <button (click)="abrirModalTema()"
                  class="self-start flex items-center gap-2 px-4 h-9 rounded-xl border-2 border-dashed border-amber-400 dark:border-amber-600 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-95">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Añadir tema
                </button>
              }
              @if (loadingTemas()) {
                <div class="flex items-center justify-center py-12">
                  <div class="w-7 h-7 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-amber-500 animate-spin"></div>
                </div>
              } @else if (temas().length === 0) {
                <div class="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <svg class="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                  </div>
                  <div>
                    <p class="text-sm font-bold text-slate-600 dark:text-slate-500">Sin temas registrados</p>
                    <p class="text-xs text-slate-400 mt-0.5">Registra los temas preparados de los discursantes</p>
                  </div>
                </div>
              } @else {
                @for (grupo of temasAgrupados(); track grupo.nombre) {
                  <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                    <div class="bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-black text-amber-600 dark:text-amber-400 shrink-0">
                          {{ grupo.nombre.charAt(0).toUpperCase() }}
                        </div>
                        <span class="text-sm font-black text-slate-800 dark:text-slate-100">{{ grupo.nombre }}</span>
                        <span class="text-[0.6rem] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{{ grupo.temas.length }}</span>
                      </div>
                      @if (hasEditPermission()) {
                        <button (click)="abrirModalTema(); nuevoTema.id_publicador = grupo.temas[0].id_publicador"
                          title="Añadir tema a este publicador"
                          class="w-9 h-9 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-95">
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                      }
                    </div>
                    <div class="flex flex-col">
                      @for (tema of grupo.temas; track tema.id_tema; let last = $last) {
                        <div class="flex items-center gap-2 px-3 py-2.5" [class]="!last ? 'border-b border-slate-100 dark:border-slate-800' : ''">
                          @if (tema.numero_tema != null) {
                            <span class="shrink-0 w-8 h-6 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[0.65rem] font-black flex items-center justify-center border border-amber-200 dark:border-amber-800/50">{{ tema.numero_tema }}</span>
                          }
                          <span class="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200">{{ tema.titulo }}</span>
                          @if (!tema.activo) {
                            <span class="shrink-0 text-[0.6rem] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">Inactivo</span>
                          }
                          @if (hasEditPermission()) {
                            <button (click)="abrirModalTema(tema)" title="Editar"
                              class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button (click)="confirmarEliminarTema(tema)" title="Eliminar"
                              class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              }
            </div>
          } @else if (estado() === 'loading') {
            <div class="flex-1 flex items-center justify-center">
              <div class="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-violet-500 animate-spin"></div>
            </div>
          } @else if (!mesDatos()) {
            <div class="flex-1 flex flex-col gap-4 p-4 md:items-center md:justify-center md:p-8 overflow-y-auto simple-scrollbar">
              <!-- Icono/texto — oculto en móvil cuando ya hay meses -->
              <div [class]="mesesDisponibles().length > 0 ? 'hidden md:flex flex-col items-center gap-3 text-center' : 'flex flex-col items-center gap-3 text-center pt-4 md:pt-0'">
                <div class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <svg class="w-7 h-7 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Ninguna programación seleccionada</h3>
                  <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                    @if (mesesDisponibles().length > 0) {
                      Selecciona un mes del historial para verlo.
                    } @else if (hasEditPermission()) {
                      Genera una nueva programación para comenzar.
                    } @else {
                      No hay discursos programados. Consulta con el secretario.
                    }
                  </p>
                </div>
                @if (mesesDisponibles().length === 0 && hasEditPermission()) {
                  <button data-testid="disc-btn-generar-mes" (click)="abrirModalGenerar()"
                    class="flex items-center gap-2 px-4 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] text-xs font-bold text-white transition-[transform,background-color] duration-150 ease-out shadow-sm active:scale-[0.97]">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Generar mes
                  </button>
                }
              </div>
              <!-- Lista de meses — solo móvil -->
              @if (mesesDisponibles().length > 0) {
                <div class="md:hidden flex flex-col gap-2 pb-4">
                  <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">Meses programados</p>
                  @for (m of mesesDisponibles(); track m.ano + '-' + m.mes) {
                    <!-- Sin boton de PDF: ya esta en la barra de acciones del
                         detalle cuando el mes esta abierto. -->
                    <button data-testid="disc-fila-mes" [attr.data-ano]="m.ano" [attr.data-mes]="m.mes" (click)="cargarMes(m.ano, m.mes)" [disabled]="estado() === 'loading'"
                      class="w-full flex items-center justify-between px-4 h-12 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-800 dark:text-slate-100 text-sm font-medium transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] disabled:opacity-40 border border-slate-200 dark:border-slate-700">
                      <span class="flex items-center gap-2">
                        @if (m.confirmado) {
                          <svg class="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                        }
                        {{ mesLabel(m.ano, m.mes) }}
                      </span>
                      <svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                  }
                </div>
              }
            </div>
          } @else {
            <!-- MES header -->
            <div class="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-2 min-w-0">
                <!-- Volver — solo móvil -->
                <button (click)="mesDatos.set(null); estado.set('idle')"
                  class="md:hidden shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors active:scale-[0.95]"
                  title="Volver"
                  aria-label="Volver">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <div class="min-w-0">
                  <p class="text-sm font-black text-slate-900 dark:text-white">{{ mesLabel(mesDatos()!.ano, mesDatos()!.mes) }}</p>
                  <p class="text-[0.65rem] text-slate-400 mt-0.5">{{ mesDatos()!.fechas.length }} fecha(s) de fin de semana</p>
                </div>
              </div>
              @if (hasEditPermission()) {
                <div class="flex items-center gap-1.5 shrink-0">
                  @if (!mesDatos()!.confirmado) {
                    <button (click)="confirmarMes()" [disabled]="estado() === 'loading'"
                      title="Confirmar" aria-label="Confirmar"
                      class="w-9 h-9 sm:w-auto sm:px-3 sm:gap-1.5 flex items-center justify-center rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-xs font-bold text-white transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]">
                      <svg class="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                      <span class="hidden sm:inline">Confirmar</span>
                    </button>
                  }
                  <button (click)="descargarPdf('entrantes', mesDatos()!.ano, mesDatos()!.mes, $event)" [disabled]="descargandoPdf()"
                    title="PDF Entrantes" aria-label="PDF Entrantes"
                    class="w-9 h-9 sm:w-auto sm:px-3 sm:gap-1.5 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:border-blue-300 dark:hover:border-blue-500/40 disabled:opacity-40 text-xs font-semibold text-blue-600 dark:text-blue-400 transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                    <span class="hidden sm:inline">PDF Entrantes</span>
                  </button>
                  <button (click)="descargarPdf('salientes', mesDatos()!.ano, mesDatos()!.mes, $event)" [disabled]="descargandoPdf()"
                    title="PDF Salientes" aria-label="PDF Salientes"
                    class="w-9 h-9 sm:w-auto sm:px-3 sm:gap-1.5 flex items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 hover:bg-violet-100 dark:hover:bg-violet-500/20 hover:border-violet-300 dark:hover:border-violet-500/40 disabled:opacity-40 text-xs font-semibold text-violet-600 dark:text-violet-400 transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                    <span class="hidden sm:inline">PDF Salientes</span>
                  </button>
                  <button (click)="borrarMes()" [disabled]="estado() === 'loading'"
                    title="Borrar mes" aria-label="Borrar mes"
                    class="w-9 h-9 sm:w-auto sm:px-3 sm:gap-1.5 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 hover:border-red-300 dark:hover:border-red-500/40 disabled:opacity-40 text-xs font-semibold text-red-600 dark:text-red-400 transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.96]">
                    <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              }
            </div>

            <!-- CONTENT area -->
            <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar p-3 sm:p-4">

              <!-- ENTRANTES -->
              <div [hidden]="subTab() !== 'entrantes'" class="flex flex-col gap-3">
                  <!-- Cuántas llamadas quedan por hacer este mes -->
                  @if (mesDatos()!.entrantes.length > 0) {
                    <div class="flex items-center gap-2.5 px-3 py-2 rounded-xl border"
                      [class]="entrantesConfirmados() === mesDatos()!.entrantes.length
                        ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200/70 dark:border-emerald-800/40'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-700/60'">
                      <svg class="w-3.5 h-3.5 shrink-0"
                        [class]="entrantesConfirmados() === mesDatos()!.entrantes.length ? 'text-emerald-500' : 'text-slate-400'"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      <span class="text-[0.7rem] font-bold text-slate-600 dark:text-slate-300">
                        Oradores confirmados: {{ entrantesConfirmados() }} de {{ mesDatos()!.entrantes.length }}
                      </span>
                      @if (mesDatos()!.entrantes.length > entrantesConfirmados()) {
                        <span class="text-[0.65rem] text-slate-400">
                          Faltan {{ mesDatos()!.entrantes.length - entrantesConfirmados() }} por llamar
                        </span>
                      }
                      <!-- Antes de llamar hay que tener a quién: sin este dato,
                           "faltan N por llamar" cuenta también fechas que
                           todavía no tienen orador y no se pueden trabajar. -->
                      @if (entrantesSinOrador() > 0) {
                        <span class="flex items-center gap-1.5 text-[0.65rem] font-bold text-amber-600 dark:text-amber-400">
                          <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12" stroke-linecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" stroke-linecap="round"/></svg>
                          {{ entrantesSinOrador() }} sin orador
                        </span>
                      }
                      @if (entrantesPresentados() > 0) {
                        <span class="ml-auto flex items-center gap-1.5 text-[0.65rem] font-bold text-violet-600 dark:text-violet-400">
                          <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                          {{ entrantesPresentados() }} ya presentado{{ entrantesPresentados() === 1 ? '' : 's' }}
                        </span>
                      }
                      @if (entrantesRepetidos() > 0) {
                        <span class="flex items-center gap-1.5 text-[0.65rem] font-bold text-amber-600 dark:text-amber-400"
                          [class.ml-auto]="entrantesPresentados() === 0">
                          <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          {{ entrantesRepetidos() }} repetido{{ entrantesRepetidos() === 1 ? '' : 's' }}
                        </span>
                      }
                    </div>
                  }
                  @for (entrante of mesDatos()!.entrantes; track entrante.id_discurso_entrante) {
                    <div class="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden transition-colors"
                      [class]="isEditandoEntrante(entrante.id_discurso_entrante)
                        ? 'border-amber-400 dark:border-amber-500'
                        : 'border-slate-200 dark:border-slate-700'">
                      <!-- Cabecera de fecha: lleva el estado de la tarjeta, que
                           es lo que permite recorrer el mes sin abrir cada una. -->
                      <div class="px-3 py-2.5 flex items-center gap-2 border-b transition-colors duration-200"
                        [class]="cabeceraEntranteClass(entrante)">
                        <svg class="w-3.5 h-3.5 shrink-0 transition-colors duration-200"
                          [class]="iconoEntranteClass(entrante)"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span class="text-sm font-black text-slate-800 dark:text-slate-200">{{ formatFecha(entrante.fecha) }}</span>

                        <!-- El único estado sin palabras propias: los otros tres
                             ya los dicen los botones de confirmar y presentar, y
                             repetirlos sería ruido. Sin esta etiqueta, "falta
                             orador" viviría solo en el color. -->
                        @if (estadoEntrante(entrante) === 'pendiente') {
                          <span class="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[0.6rem] font-bold">
                            Falta orador
                          </span>
                        }

                        <div class="ml-auto flex items-center gap-2">
                          <!-- Confirmación del orador: seguimiento del organizador.
                               Sigue disponible con el mes cerrado, porque la llamada a
                               la congregación de origen se hace casi siempre después. -->
                          @if (hasEditPermission()) {
                            <button type="button"
                              (click)="toggleOradorConfirmado(entrante)"
                              [disabled]="confirmandoOrador().has(entrante.id_discurso_entrante)"
                              [title]="tituloConfirmacion(entrante)"
                              class="flex items-center gap-1.5 pl-1.5 pr-2.5 h-7 rounded-full border text-[0.65rem] font-bold transition-[background-color,border-color,color] duration-150 ease-out active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                              [class]="entrante.orador_confirmado
                                ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600 hover:border-emerald-600'
                                : 'bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400'">
                              @if (entrante.orador_confirmado) {
                                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <span>Orador confirmado</span>
                              } @else {
                                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                <span>Sin confirmar</span>
                              }
                            </button>
                          } @else if (entrante.orador_confirmado) {
                            <span class="flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[0.65rem] font-bold">
                              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                              Orador confirmado
                            </span>
                          }

                          <!-- Presentado: el discurso ya se dio. El sistema lo marca
                               solo al pasar la hora de la reunión; esto permite
                               adelantarlo o deshacerlo si el orador no vino. -->
                          @if (hasEditPermission()) {
                            <button type="button"
                              (click)="togglePresentado(entrante)"
                              [disabled]="marcandoPresentado().has(entrante.id_discurso_entrante)"
                              [title]="tituloPresentado(entrante)"
                              class="flex items-center gap-1.5 pl-1.5 pr-2.5 h-7 rounded-full border text-[0.65rem] font-bold transition-[background-color,border-color,color] duration-150 ease-out active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                              [class]="entrante.presentado
                                ? 'bg-violet-500 border-violet-500 text-white hover:bg-violet-600 hover:border-violet-600'
                                : 'bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400'">
                              <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>
                              </svg>
                              <span>{{ entrante.presentado ? 'Presentado' : 'Sin presentar' }}</span>
                            </button>
                          } @else if (entrante.presentado) {
                            <span class="flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-[0.65rem] font-bold">
                              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                              Presentado
                            </span>
                          }

                          @if (entrante.confirmado) {
                            @if (isEditandoEntrante(entrante.id_discurso_entrante)) {
                              <button (click)="toggleEditEntrante(entrante.id_discurso_entrante)"
                                class="flex items-center gap-1.5 px-3 h-6 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[0.65rem] font-bold transition-all active:scale-95">
                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                                Guardar
                              </button>
                            } @else {
                              <span class="text-[0.6rem] font-bold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700/70 px-2 py-0.5 rounded-full" title="El mes está cerrado: para cambiar los datos usa el lápiz.">Mes cerrado</span>
                              @if (hasEditPermission()) {
                                <button (click)="toggleEditEntrante(entrante.id_discurso_entrante)" title="Editar"
                                  class="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-500 transition-all active:scale-95">
                                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                </button>
                              }
                            }
                          }
                        </div>
                      </div>
                      <!-- fields -->
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 p-3 sm:p-4">
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Discurso / Tema</label>
                          <app-discurso-catalogo-input
                            [value]="entrante.titulo_discurso ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (commit)="guardarCampoEntrante(entrante, 'titulo_discurso', $event)"
                            placeholder="Nº o palabra del discurso"
                            inputClass="h-10 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full"></app-discurso-catalogo-input>
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Orador</label>
                          <input type="text"
                            [value]="entrante.nombre_orador ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (blur)="onEntranteChange(entrante, 'nombre_orador', $event)"
                            placeholder="Nombre del orador"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Congregación Origen</label>
                          <!-- Mismo campo del directorio que usa Salientes: la
                               congregación de la que viene un orador es una
                               congregación del circuito, igual que aquella a la
                               que se sale. Con permitirCrear se ofrece además
                               apuntarla si es la primera vez que viene. -->
                          <app-congregacion-contacto-input
                            [value]="entrante.congregacion_origen ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            [idCong]="idCongActual()"
                            [permitirCrear]="hasEditPermission()"
                            (commit)="guardarCampoEntrante(entrante, 'congregacion_origen', $event)"
                            placeholder="Congregación"
                            inputClass="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full"></app-congregacion-contacto-input>
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Hospitalidad</label>
                          <select
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (change)="onEntranteGrupoChange(entrante, $event)"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
                            <option value="" [selected]="!entrante.id_grupo_hospitalidad">— Sin asignar —</option>
                            @for (g of grupos(); track g.id_grupo) {
                              <option [value]="g.id_grupo + ''" [selected]="entrante.id_grupo_hospitalidad === g.id_grupo">{{ g.nombre_grupo }}</option>
                            }
                          </select>
                        </div>
                        <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3 xl:col-span-4">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Notas</label>
                          <input type="text"
                            [value]="entrante.notas ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (blur)="onEntranteChange(entrante, 'notas', $event)"
                            placeholder="Notas adicionales"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
                        </div>
                      </div>

                      <!-- Aviso de discurso repetido: solo informa, nunca bloquea. -->
                      @if ((repeticiones()[entrante.id_discurso_entrante] ?? []).length > 0) {
                        <div class="flex items-start gap-2.5 px-3 sm:px-4 py-2.5 border-t border-amber-200/60 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/15">
                          <svg class="w-4 h-4 mt-0.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          <div class="flex-1 min-w-0">
                            <p class="text-[0.7rem] font-bold text-amber-700 dark:text-amber-400">
                              Ya se presentó en esta congregación en los últimos 12 meses
                            </p>
                            <p class="text-[0.65rem] text-amber-600/90 dark:text-amber-400/80">
                              @for (r of (repeticiones()[entrante.id_discurso_entrante] ?? []).slice(0, 3); track r.fecha; let last = $last) {
                                {{ formatFecha(r.fecha) }}@if (r.nombre_orador) { · {{ r.nombre_orador }} }@if (!last) {, }
                              }
                              @if ((repeticiones()[entrante.id_discurso_entrante] ?? []).length > 3) {
                                <span> y {{ (repeticiones()[entrante.id_discurso_entrante] ?? []).length - 3 }} más</span>
                              }
                            </p>
                          </div>
                        </div>
                      }
                    </div>
                  }
              </div>

              <!-- SALIENTES -->
              <div [hidden]="subTab() !== 'salientes'" class="flex flex-col gap-3">
                  @if (hasEditPermission()) {
                    <button (click)="abrirModalSaliente()"
                      class="self-start flex items-center gap-2 px-4 h-9 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all active:scale-95">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Añadir saliente
                    </button>
                  }

                  @if (mesDatos()!.salientes.length > 0) {
                    <div class="flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-700/60">
                      <span class="text-[0.7rem] font-bold text-slate-600 dark:text-slate-300">
                        {{ salientesProgramados() }} programado{{ salientesProgramados() === 1 ? '' : 's' }}
                      </span>
                      @if (salientesRealizados() > 0) {
                        <span class="flex items-center gap-1.5 text-[0.65rem] font-bold text-violet-600 dark:text-violet-400">
                          <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                          {{ salientesRealizados() }} realizada{{ salientesRealizados() === 1 ? '' : 's' }}
                        </span>
                      }
                      @if (salientesCancelados() > 0) {
                        <span class="flex items-center gap-1.5 text-[0.65rem] font-bold text-red-600 dark:text-red-400">
                          <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          {{ salientesCancelados() }} cancelada{{ salientesCancelados() === 1 ? '' : 's' }}
                        </span>
                      }
                    </div>
                  }

                  @if (mesDatos()!.salientes.length === 0) {
                    <div class="flex flex-col items-center justify-center py-10 text-center gap-3">
                      <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <svg class="w-6 h-6 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                      </div>
                      <div>
                        <p class="text-sm font-bold text-slate-500 dark:text-slate-400">Sin salientes programados</p>
                        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Añade publicadores que salen a dar discursos</p>
                      </div>
                    </div>
                  }

                  @for (saliente of mesDatos()!.salientes; track saliente.id_discurso_saliente) {
                    <div class="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden transition-colors"
                      [class]="isEditandoSaliente(saliente.id_discurso_saliente)
                        ? 'border-amber-400 dark:border-amber-500'
                        : 'border-slate-200 dark:border-slate-700'">
                      <div class="bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
                        <svg class="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                        <span class="text-sm font-black text-slate-800 dark:text-slate-200">{{ formatFecha(saliente.fecha) }}</span>
                        @if (saliente.confirmado) {
                          @if (isEditandoSaliente(saliente.id_discurso_saliente)) {
                            <button (click)="toggleEditSaliente(saliente.id_discurso_saliente)"
                              class="ml-auto flex items-center gap-1.5 px-3 h-6 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[0.65rem] font-bold transition-all active:scale-95">
                              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                              Guardar
                            </button>
                          } @else {
                            <span class="ml-auto text-[0.6rem] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">Confirmado</span>
                            @if (hasEditPermission()) {
                              <button (click)="toggleEditSaliente(saliente.id_discurso_saliente)" title="Editar"
                                class="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-500 transition-all active:scale-95">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </button>
                            }
                          }
                        }
                        <div class="ml-auto flex items-center gap-2">
                          <!-- Estado: Programado / Realizada / Cancelado. El chip alterna
                               Programado↔Realizada (marca a mano, el planificador la marca
                               solo al pasar fecha+hora); reactivar una cancelada vuelve a
                               Programado. Cancelar (programado→cancelado) es el botón aparte
                               de más abajo, porque no es un simple toggle. -->
                          @if (hasEditPermission()) {
                            @if (saliente.estado === 'cancelado') {
                              <button type="button"
                                (click)="reactivarSaliente(saliente)"
                                [disabled]="cancelandoSaliente().has(saliente.id_discurso_saliente)"
                                [title]="tituloEstadoSaliente(saliente)"
                                class="flex items-center gap-1.5 pl-1.5 pr-2.5 h-7 rounded-full border text-[0.65rem] font-bold transition-[background-color,border-color,color] duration-150 ease-out active:scale-95 disabled:opacity-60 disabled:cursor-wait bg-red-500 border-red-500 text-white hover:bg-red-600 hover:border-red-600">
                                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                <span>Cancelado</span>
                              </button>
                            } @else {
                              <button type="button"
                                (click)="togglePresentadoSaliente(saliente)"
                                [disabled]="marcandoPresentadoSaliente().has(saliente.id_discurso_saliente)"
                                [title]="tituloEstadoSaliente(saliente)"
                                class="flex items-center gap-1.5 pl-1.5 pr-2.5 h-7 rounded-full border text-[0.65rem] font-bold transition-[background-color,border-color,color] duration-150 ease-out active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                                [class]="saliente.estado === 'realizada'
                                  ? 'bg-violet-500 border-violet-500 text-white hover:bg-violet-600 hover:border-violet-600'
                                  : 'bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400'">
                                @if (saliente.estado === 'realizada') {
                                  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                }
                                <span>{{ saliente.estado === 'realizada' ? 'Realizada' : 'Programado' }}</span>
                              </button>
                            }
                          } @else if (saliente.estado !== 'programado') {
                            <span class="flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[0.65rem] font-bold"
                              [class]="saliente.estado === 'realizada'
                                ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'">
                              {{ saliente.estado === 'realizada' ? 'Realizada' : 'Cancelado' }}
                            </span>
                          }
                          @if (saliente.id_publicador) {
                            <button (click)="abrirWhatsapp(saliente)"
                              title="Notificar al orador por WhatsApp"
                              aria-label="Notificar al orador por WhatsApp"
                              class="w-9 h-9 rounded-lg flex items-center justify-center text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-95">
                              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            </button>
                          }
                          @if (hasEditPermission() && saliente.estado === 'programado' && !isEditandoSaliente(saliente.id_discurso_saliente)) {
                            <button (click)="cancelarSaliente(saliente)"
                              title="Cancelar esta salida"
                              aria-label="Cancelar esta salida"
                              class="w-9 h-9 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500 hover:text-amber-600 flex items-center justify-center transition-all active:scale-95">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><line x1="7" y1="17" x2="17" y2="7"/></svg>
                            </button>
                          }
                          @if (hasEditPermission() && !isEditandoSaliente(saliente.id_discurso_saliente)) {
                            <button (click)="eliminarSaliente(saliente)"
                              aria-label="Eliminar saliente"
                              class="w-9 h-9 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 flex items-center justify-center transition-all active:scale-95">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          }
                        </div>
                      </div>
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3 sm:p-4">
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Publicador</label>
                          <select
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            (change)="onSalientePublicadorChange(saliente, $event)"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
                            <option value="" [selected]="!saliente.id_publicador">— Sin asignar —</option>
                            @for (p of opcionesPublicador(saliente); track p.id_publicador) {
                              <option [value]="p.id_publicador + ''" [selected]="saliente.id_publicador === p.id_publicador">{{ p.nombre_completo }}</option>
                            }
                          </select>
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Congregación Destino</label>
                          <app-congregacion-contacto-input
                            [value]="saliente.congregacion_destino ?? ''"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            [idCong]="idCongActual()"
                            (commit)="guardarCampoSaliente(saliente, 'congregacion_destino', $event)"
                            (seleccion)="onSalienteCongregacionSeleccionada(saliente, $event)"
                            placeholder="Congregación destino"
                            inputClass="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full"></app-congregacion-contacto-input>
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Hora</label>
                          <app-time-picker
                            [ngModel]="saliente.hora"
                            (ngModelChange)="onSalienteHoraChange(saliente, $event)"
                            [ngModelOptions]="{ standalone: true }"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            colorScheme="violet" placeholder="Hora"></app-time-picker>
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Tema del Discurso</label>
                          <app-discurso-catalogo-input
                            [value]="saliente.tema_discurso ?? ''"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            (commit)="guardarCampoSaliente(saliente, 'tema_discurso', $event)"
                            placeholder="Nº o palabra del tema"
                            inputClass="h-10 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full"></app-discurso-catalogo-input>
                        </div>
                        <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Ubicación del Salón</label>
                          <app-ubicacion-picker
                            size="sm"
                            [ngModel]="ubicacionDe(saliente)"
                            (ngModelChange)="onSalienteUbicacionChange(saliente, $event)"
                            [ngModelOptions]="{ standalone: true }"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))">
                          </app-ubicacion-picker>
                        </div>
                        <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Notas</label>
                          <input type="text"
                            [value]="saliente.notas ?? ''"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            (blur)="onSalienteChange(saliente, 'notas', $event)"
                            placeholder="Notas adicionales"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
                        </div>
                      </div>
                    </div>
                  }
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    <!-- ===== MODAL GENERAR MES ===== -->
    @if (modalGenerarVisible()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="cerrarModalGenerar()">
        <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4" (click)="$event.stopPropagation()">
          <h2 data-testid="disc-modal-generar" class="text-base font-black text-slate-900 dark:text-white">Generar Mes — Discursos Públicos</h2>

          <!-- Año -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Año</label>
            <div class="flex items-center gap-2">
              <button (click)="genAno = genAno - 1" class="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-500 hover:text-violet-600 transition-all flex items-center justify-center active:scale-95">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <span class="flex-1 text-center text-sm font-black text-slate-900 dark:text-white tabular-nums">{{ genAno }}</span>
              <button (click)="genAno = genAno + 1" class="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-500 hover:text-violet-600 transition-all flex items-center justify-center active:scale-95">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>

          <!-- Mes grid -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Mes</label>
            <div class="grid grid-cols-4 gap-1.5">
              @for (m of MESES; track m.v) {
                <button data-testid="disc-opcion-mes" [attr.data-mes]="m.v" (click)="genMes = m.v"
                  class="h-9 rounded-xl text-xs font-bold transition-all active:scale-95"
                  [class]="genMes === m.v
                    ? 'bg-[#6D28D9] text-white shadow-md shadow-violet-200 dark:shadow-violet-900/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-500 hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-700 dark:hover:text-violet-300 border border-transparent hover:border-violet-200 dark:hover:border-violet-800'">
                  {{ m.l.slice(0, 3) }}
                </button>
              }
            </div>
          </div>
          <div class="flex gap-2 justify-end">
            <button (click)="cerrarModalGenerar()" class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button data-testid="disc-btn-generar" (click)="generarMes()" [disabled]="estado() === 'loading'"
              class="px-4 h-9 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 text-xs font-bold text-white transition-all active:scale-95">
              Generar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL AÑADIR/EDITAR TEMA ===== -->
    @if (modalCongregacionContactoVisible()) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" (click)="cerrarModalCongregacionContacto()">
        <div class="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm flex flex-col border border-slate-200/60 dark:border-slate-700/60 overflow-hidden" (click)="$event.stopPropagation()">
          <div class="flex justify-center pt-3 pb-1 sm:hidden">
            <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          </div>
          <div class="px-5 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-black text-slate-900 dark:text-white">{{ editandoCongregacionContacto() ? 'Editar Congregación' : 'Añadir Congregación' }}</h2>
              <button (click)="cerrarModalCongregacionContacto()"
                class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-[background-color,color] duration-150 ease-out active:scale-[0.95]">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-3 px-5 py-4 max-h-[70vh] overflow-y-auto simple-scrollbar">
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nombre</label>
              <input type="text" [(ngModel)]="nuevaCongregacionContacto.nombre" placeholder="Nombre de la congregación"
                class="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out w-full">
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              <div class="flex flex-col gap-1.5">
                <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Día de reunión</label>
                <div class="relative">
                  @if (diaDropdownAbierto()) {
                    <div class="fixed inset-0 z-[59]" (click)="diaDropdownAbierto.set(false)"></div>
                  }
                  <button type="button" (click)="diaDropdownAbierto.set(!diaDropdownAbierto())"
                    class="h-11 w-full px-3 rounded-xl border bg-slate-50 dark:bg-slate-800 text-sm text-left flex items-center justify-between gap-2 outline-none transition-[border-color,background-color] duration-150 ease-out"
                    [class]="diaDropdownAbierto() ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600'">
                    <span [class]="nuevaCongregacionContacto.dia_reunion_fin_semana ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'">
                      {{ nuevaCongregacionContacto.dia_reunion_fin_semana ? diaLabel(nuevaCongregacionContacto.dia_reunion_fin_semana) : '— Sin definir —' }}
                    </span>
                    <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-150" [class.rotate-180]="diaDropdownAbierto()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  @if (diaDropdownAbierto()) {
                    <div class="absolute left-0 top-full mt-1.5 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[60] py-1.5">
                      <button type="button" (click)="seleccionarDiaCongregacionContacto(null)"
                        class="w-full flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-left transition-colors duration-100"
                        [class]="!nuevaCongregacionContacto.dia_reunion_fin_semana ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'">
                        — Sin definir —
                      </button>
                      @for (dia of diasFinSemanaOpciones; track dia) {
                        <button type="button" (click)="seleccionarDiaCongregacionContacto(dia)"
                          class="w-full flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-left transition-colors duration-100"
                          [class]="nuevaCongregacionContacto.dia_reunion_fin_semana === dia ? 'bg-teal-50 text-teal-600 dark:bg-teal-900/20 dark:text-teal-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'">
                          {{ diaLabel(dia) }}
                        </button>
                      }
                    </div>
                  }
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hora</label>
                <app-time-picker [(ngModel)]="nuevaCongregacionContacto.hora_reunion_fin_semana" [ngModelOptions]="{ standalone: true }"
                  colorScheme="violet" placeholder="Hora"></app-time-picker>
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ubicación del salón</label>
              <app-ubicacion-picker [ngModel]="nuevaCongregacionContacto.ubicacion" (ngModelChange)="nuevaCongregacionContacto.ubicacion = $event"
                [ngModelOptions]="{ standalone: true }"></app-ubicacion-picker>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Personas de contacto <span class="normal-case font-normal opacity-60">(opcional)</span></label>
              <div class="flex flex-col gap-1.5">
                @for (p of nuevaCongregacionContacto.personas; track $index; let i = $index) {
                  <div class="flex items-center gap-1.5">
                    <input type="text" [(ngModel)]="p.nombre" [ngModelOptions]="{ standalone: true }" placeholder="Nombre"
                      class="min-w-0 flex-[1.3] h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out">
                    <input type="text" [(ngModel)]="p.cargo" [ngModelOptions]="{ standalone: true }" placeholder="Cargo"
                      class="min-w-0 flex-1 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out">
                    <input type="text" [(ngModel)]="p.telefono" [ngModelOptions]="{ standalone: true }" placeholder="Teléfono"
                      class="min-w-0 flex-1 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out">
                    <button type="button" (click)="quitarPersonaModal(i)" title="Quitar"
                      class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                }
              </div>
              <button type="button" (click)="anadirPersonaModal()"
                class="self-start flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-[0.7rem] font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all active:scale-95">
                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Añadir persona
              </button>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Notas <span class="normal-case font-normal opacity-60">(opcional)</span></label>
              <input type="text" [(ngModel)]="nuevaCongregacionContacto.notas" placeholder="Notas adicionales"
                class="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out w-full">
            </div>
          </div>
          <div class="flex gap-2 px-5 pb-6 sm:pb-5 pt-1">
            <button (click)="cerrarModalCongregacionContacto()"
              class="flex-1 h-11 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color] duration-150 ease-out active:scale-[0.97]">
              Cancelar
            </button>
            <button (click)="guardarCongregacionContacto()" [disabled]="!nuevaCongregacionContacto.nombre.trim()"
              class="flex-1 h-11 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-sm font-bold text-white transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] shadow-md shadow-teal-500/20">
              {{ editandoCongregacionContacto() ? 'Guardar cambios' : 'Añadir' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (modalTemaVisible()) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" (click)="cerrarModalTema()">
        <div class="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm flex flex-col border border-slate-200/60 dark:border-slate-700/60 overflow-hidden" (click)="$event.stopPropagation()">
          <div class="flex justify-center pt-3 pb-1 sm:hidden">
            <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          </div>
          <div class="px-5 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-black text-slate-900 dark:text-white">{{ editandoTema() ? 'Editar Tema' : 'Añadir Tema' }}</h2>
              <button (click)="cerrarModalTema()"
                class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-[background-color,color] duration-150 ease-out active:scale-[0.95]">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-3 px-5 py-4">
            @if (!editandoTema()) {
              <div class="flex flex-col gap-1.5">
                <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Publicador</label>
                <select [(ngModel)]="nuevoTema.id_publicador"
                  class="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 transition-[border-color,background-color] duration-150 ease-out w-full">
                  <option [value]="null">— Seleccionar publicador —</option>
                  @for (p of publicadores(); track p.id_publicador) {
                    <option [value]="p.id_publicador">{{ p.nombre_completo }}</option>
                  }
                </select>
              </div>
            }
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nº Tema <span class="normal-case font-normal opacity-60">(opcional)</span></label>
              <input type="number" [(ngModel)]="nuevoTema.numero_tema" placeholder="Ej. 15"
                class="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-[border-color,background-color] duration-150 ease-out w-full">
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Título del Discurso</label>
              <app-discurso-catalogo-input
                [(ngModel)]="nuevoTema.titulo"
                [ngModelOptions]="{ standalone: true }"
                formato="titulo"
                (seleccion)="onTemaDelCatalogo($event)"
                placeholder="Nº o palabra del discurso"
                inputClass="h-11 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-[border-color,background-color] duration-150 ease-out w-full"></app-discurso-catalogo-input>
              <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1">Al elegir del catálogo se rellena también el número.</p>
            </div>
          </div>
          <div class="flex gap-2 px-5 pb-6 sm:pb-5 pt-1">
            <button (click)="cerrarModalTema()"
              class="flex-1 h-11 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color] duration-150 ease-out active:scale-[0.97]">
              Cancelar
            </button>
            <button (click)="guardarTema()" [disabled]="!nuevoTema.titulo.trim() || (!editandoTema() && !nuevoTema.id_publicador)"
              class="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-sm font-bold text-white transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] shadow-md shadow-amber-500/20">
              {{ editandoTema() ? 'Guardar cambios' : 'Añadir' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL AÑADIR SALIENTE ===== -->
    @if (modalSalienteVisible()) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" (click)="cerrarModalSaliente()">
        <div class="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm flex flex-col gap-0 border border-slate-200/60 dark:border-slate-700/60 overflow-hidden" (click)="$event.stopPropagation()">

          <!-- Handle bar (móvil) -->
          <div class="flex justify-center pt-3 pb-1 sm:hidden">
            <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          </div>

          <!-- Header -->
          <div class="px-5 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-black text-slate-900 dark:text-white">Añadir Saliente</h2>
              <button (click)="cerrarModalSaliente()"
                class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-[background-color,color] duration-150 ease-out active:scale-[0.95]">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <!-- Fields -->
          <div class="flex flex-col gap-3 px-5 py-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha</label>
              <app-date-picker
                [(ngModel)]="nuevoSaliente.fecha"
                [minDate]="mesMinDate()"
                [maxDate]="mesMaxDate()"
                placeholder="Seleccionar fecha">
              </app-date-picker>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hora de la reunión</label>
              <app-time-picker [(ngModel)]="nuevoSaliente.hora" [ngModelOptions]="{ standalone: true }"
                colorScheme="violet" placeholder="Seleccionar hora"></app-time-picker>
              <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1">Hora de la reunión en la congregación destino.</p>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Publicador</label>
              <div class="relative">
                <input
                  type="text"
                  [value]="busquedaPublicador()"
                  (input)="onBusquedaPublicadorInput($any($event.target).value)"
                  (focus)="mostrarDropdownBusqueda.set(true); resultadosBusqueda.set(publicadores())"
                  (blur)="$any($event.relatedTarget)?.closest('.pub-dropdown') ? null : mostrarDropdownBusqueda.set(false)"
                  placeholder="Buscar conferenciante…"
                  class="h-11 px-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out">
                @if (nuevoSaliente.id_publicador) {
                  <button type="button"
                    (click)="nuevoSaliente.id_publicador = null; nuevoSaliente.tema_discurso = ''; busquedaPublicador.set(''); buscarEnCatalogo.set(false)"
                    class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color,color] duration-150 ease-out">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                }
                @if (mostrarDropdownBusqueda()) {
                  <div class="pub-dropdown absolute z-10 mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-black/10 max-h-48 overflow-y-auto py-1">
                    @if (buscandoPublicador()) {
                      <div class="px-4 py-3 text-xs text-slate-400">Buscando…</div>
                    } @else if (resultadosBusqueda().length === 0) {
                      <div class="px-4 py-3 text-xs text-slate-400">Sin resultados</div>
                    } @else {
                      @for (p of resultadosBusqueda(); track p.id_publicador) {
                        <button type="button"
                          (mousedown)="seleccionarPublicadorBusqueda(p)"
                          class="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-[background-color] duration-100 ease-out">
                          {{ p.nombre_completo }}
                        </button>
                      }
                    }
                  </div>
                }
              </div>
              @if (nuevoSaliente.id_publicador) {
                <p class="text-[0.7rem] text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                  {{ publicadorSeleccionadoNombre() }}
                </p>
              }
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Congregación Destino</label>
              <app-congregacion-contacto-input [(ngModel)]="nuevoSaliente.congregacion_destino" [ngModelOptions]="{ standalone: true }"
                [idCong]="idCongActual()"
                (commit)="autorellenarUbicacion()"
                (seleccion)="onNuevoSalienteCongregacionSeleccionada($event)"
                placeholder="Nombre congregación"
                inputClass="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out w-full"></app-congregacion-contacto-input>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ubicación del Salón</label>
              <app-ubicacion-picker [ngModel]="nuevoSaliente.ubicacion" (ngModelChange)="onUbicacionModalChange($event)"
                [ngModelOptions]="{ standalone: true }"></app-ubicacion-picker>
              @if (ubicacionAutorellenada() && nuevoSaliente.ubicacion) {
                <p class="text-[0.65rem] text-violet-600 dark:text-violet-400 px-1">Ubicación recordada de una asignación anterior.</p>
              }
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tema del Discurso</label>
              @if (temasDelPublicadorSeleccionado().length > 0 && !buscarEnCatalogo()) {
                <!-- Custom dropdown -->
                <div class="relative tema-dropdown">
                  <button type="button"
                    (click)="mostrarDropdownTemas.set(!mostrarDropdownTemas())"
                    (blur)="$any($event.relatedTarget)?.closest('.tema-dropdown') ? null : mostrarDropdownTemas.set(false)"
                    class="w-full h-11 px-3 pr-9 rounded-xl border text-left text-sm transition-[border-color,background-color] duration-150 ease-out flex items-center gap-2"
                    [class]="mostrarDropdownTemas()
                      ? 'border-violet-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100'">
                    @if (nuevoSaliente.tema_discurso) {
                      @for (t of temasDelPublicadorSeleccionado(); track t.id_tema) {
                        @if (t.titulo === nuevoSaliente.tema_discurso) {
                          @if (t.numero_tema != null) {
                            <span class="shrink-0 min-w-[1.5rem] h-5 px-1.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[0.65rem] font-black flex items-center justify-center">{{ t.numero_tema }}</span>
                          }
                          <span class="truncate font-medium">{{ t.titulo }}</span>
                        }
                      }
                    } @else {
                      <span class="text-slate-400">Seleccionar tema…</span>
                    }
                    <!-- chevron -->
                    <svg class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform duration-150"
                      [class.rotate-180]="mostrarDropdownTemas()"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  @if (mostrarDropdownTemas()) {
                    <div class="tema-dropdown absolute z-30 left-0 right-0 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                      <div class="flex flex-col p-1.5 gap-0.5 max-h-52 overflow-y-auto simple-scrollbar">
                        @for (t of temasDelPublicadorSeleccionado(); track t.id_tema) {
                          <button type="button"
                            (mousedown)="nuevoSaliente.tema_discurso = t.titulo; mostrarDropdownTemas.set(false)"
                            class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-[background-color] duration-100 ease-out active:scale-[0.98] group"
                            [class]="nuevoSaliente.tema_discurso === t.titulo
                              ? 'bg-amber-50 dark:bg-amber-900/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'">
                            <!-- número badge -->
                            @if (t.numero_tema != null) {
                              <span class="shrink-0 min-w-[2rem] h-6 px-1.5 rounded-md text-[0.65rem] font-black flex items-center justify-center transition-colors duration-100"
                                [class]="nuevoSaliente.tema_discurso === t.titulo
                                  ? 'bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200'
                                  : 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 group-hover:text-amber-700 dark:group-hover:text-amber-300'">
                                {{ t.numero_tema }}
                              </span>
                            } @else {
                              <span class="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 mt-0.5"></span>
                            }
                            <!-- título -->
                            <span class="flex-1 min-w-0 text-sm font-medium truncate transition-colors duration-100"
                              [class]="nuevoSaliente.tema_discurso === t.titulo
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-slate-700 dark:text-slate-200'">
                              {{ t.titulo }}
                            </span>
                            <!-- check activo -->
                            @if (nuevoSaliente.tema_discurso === t.titulo) {
                              <svg class="shrink-0 w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                            }
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
                <button type="button" (click)="buscarEnCatalogo.set(true)"
                  class="self-start text-[0.65rem] font-bold text-violet-600 dark:text-violet-400 hover:underline px-1">
                  ¿Otro discurso? Buscar en el catálogo
                </button>
              } @else {
                <app-discurso-catalogo-input
                  [(ngModel)]="nuevoSaliente.tema_discurso"
                  [ngModelOptions]="{ standalone: true }"
                  placeholder="Nº o palabra del discurso"
                  [disabled]="!nuevoSaliente.id_publicador"
                  inputClass="h-11 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out w-full disabled:opacity-50 disabled:cursor-not-allowed"></app-discurso-catalogo-input>
                @if (!nuevoSaliente.id_publicador) {
                  <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1">Selecciona primero un publicador.</p>
                } @else if (temasDelPublicadorSeleccionado().length > 0) {
                  <button type="button" (click)="buscarEnCatalogo.set(false)"
                    class="self-start text-[0.65rem] font-bold text-violet-600 dark:text-violet-400 hover:underline px-1">
                    Volver a sus temas registrados
                  </button>
                } @else {
                  <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1">Sin temas registrados: escribe el número o una palabra para buscar en el catálogo.</p>
                }
              }
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 px-5 pb-6 sm:pb-5 pt-1">
            <button (click)="cerrarModalSaliente()"
              class="flex-1 h-11 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color] duration-150 ease-out active:scale-[0.97]">
              Cancelar
            </button>
            <button (click)="guardarSaliente()" [disabled]="!nuevoSaliente.fecha || estado() === 'loading'"
              class="flex-1 h-11 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-sm font-bold text-white transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] shadow-md shadow-violet-500/20">
              Añadir
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL NOTIFICAR POR WHATSAPP ===== -->
    @if (whatsappPendiente(); as wa) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" (click)="cerrarWhatsapp()">
        <div class="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col border border-slate-200/60 dark:border-slate-700/60 overflow-hidden" (click)="$event.stopPropagation()">

          <div class="flex justify-center pt-3 pb-1 sm:hidden">
            <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          </div>

          <div class="px-5 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-black text-slate-900 dark:text-white">Notificar por WhatsApp</h2>
              <button (click)="cerrarWhatsapp()"
                class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-[background-color,color] duration-150 ease-out active:scale-[0.95]">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-3 px-5 py-4">
            <div class="flex items-center gap-2 text-sm">
              <span class="text-slate-500 dark:text-slate-400">Para:</span>
              <span class="font-bold text-slate-800 dark:text-slate-100">{{ wa.nombre }}</span>
              @if (wa.telefono) {
                <span class="text-slate-400 dark:text-slate-500">· +{{ wa.telefono }}</span>
              }
            </div>
            @if (!wa.telefono) {
              <div class="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                <svg class="w-4 h-4 shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
                <p class="text-xs text-amber-700 dark:text-amber-300">
                  Este publicador no tiene teléfono registrado. Se abrirá WhatsApp para que elijas el contacto.
                </p>
              </div>
            }
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mensaje</label>
              <textarea rows="11"
                [value]="wa.mensaje"
                (input)="onMensajeWhatsappChange($any($event.target).value)"
                class="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out w-full resize-none leading-relaxed"></textarea>
            </div>
          </div>

          <div class="flex gap-2 px-5 pb-6 sm:pb-5 pt-1">
            <button (click)="cerrarWhatsapp()"
              class="flex-1 h-11 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color] duration-150 ease-out active:scale-[0.97]">
              Cancelar
            </button>
            <button (click)="enviarWhatsapp()" [disabled]="!wa.mensaje.trim()"
              class="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-sm font-bold text-white flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] shadow-md shadow-emerald-500/20">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              Abrir WhatsApp
            </button>
          </div>
        </div>
      </div>
    }

    @if (modalHistorialVisible()) {
      <app-historial-discursos
        [idCong]="idCongActual()"
        [desdeInicial]="rangoHistorialPorDefecto().desde"
        [hastaInicial]="rangoHistorialPorDefecto().hasta"
        (cerrar)="modalHistorialVisible.set(false)">
      </app-historial-discursos>
    }
  `,
})
export class ReunionesDiscursosComponent implements OnInit {
  private svc = inject(DiscursosService);
  private conflictosSvc = inject(ConflictosService);
  private congCtx = inject(CongregacionContextService);
  private auth = inject(AuthStore);

  readonly MESES = MESES_ES.map((l, i) => ({ l, v: i + 1 }));

  estado = signal<Estado>('idle');
  errorMsg = signal('');
  confirmadoBanner = signal(false);
  mesDatos = signal<DiscursosMesOut | null>(null);
  mesesDisponibles = signal<MesDiscursosDisponible[]>([]);

  /**
   * Agrupa `mesesDisponibles` por año consecutivo, para mostrar el año una
   * sola vez por grupo en vez de repetirlo en cada fila del historial.
   * Asume que la lista ya llega ordenada por año/mes (la da así el backend).
   */
  mesesPorAno = computed<{ ano: number; meses: MesDiscursosDisponible[] }[]>(() => {
    const grupos: { ano: number; meses: MesDiscursosDisponible[] }[] = [];
    for (const m of this.mesesDisponibles()) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.ano === m.ano) {
        ultimo.meses.push(m);
      } else {
        grupos.push({ ano: m.ano, meses: [m] });
      }
    }
    return grupos;
  });
  grupos = signal<GrupoSimple[]>([]);
  publicadores = signal<PublicadorSimple[]>([]);
  descargandoPdf = signal(false);
  subTab = signal<SubTab>('entrantes');

  temas = signal<TemaPublicador[]>([]);
  loadingTemas = signal(false);
  temasLoaded = signal(false);

  congregacionesContacto = signal<CongregacionContacto[]>([]);
  loadingCongregacionesContacto = signal(false);
  congregacionesContactoLoaded = signal(false);
  temasAgrupados = computed(() => {
    const map = new Map<number, { nombre: string; temas: TemaPublicador[] }>();
    for (const t of this.temas()) {
      if (!map.has(t.id_publicador)) map.set(t.id_publicador, { nombre: t.nombre_publicador, temas: [] });
      map.get(t.id_publicador)!.temas.push(t);
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  });
  temasDelPublicadorSeleccionado(): TemaPublicador[] {
    const id = this.nuevoSaliente?.id_publicador;
    if (!id) return [];
    return this.temas().filter(t => t.id_publicador === id && t.activo);
  }

  modalTemaVisible = signal(false);
  editandoTema = signal<TemaPublicador | null>(null);
  nuevoTema: { id_publicador: number | null; numero_tema: string; titulo: string } = {
    id_publicador: null, numero_tema: '', titulo: '',
  };

  modalCongregacionContactoVisible = signal(false);
  editandoCongregacionContacto = signal<CongregacionContacto | null>(null);
  nuevaCongregacionContacto: {
    nombre: string; dia_reunion_fin_semana: string | null;
    hora_reunion_fin_semana: string | null; notas: string | null; ubicacion: UbicacionSaliente | null;
    personas: { id_contacto_persona?: number; nombre: string; cargo: string | null; telefono: string | null }[];
  } = { nombre: '', dia_reunion_fin_semana: null, hora_reunion_fin_semana: null, notas: null, ubicacion: null, personas: [] };

  modalGenerarVisible = signal(false);
  modalSalienteVisible = signal(false);
  modalHistorialVisible = signal(false);

  /**
   * Rango por defecto al abrir el historial: desde el primer día de hace 12
   * meses hasta el último mes ya programado (incluye lo agendado a futuro),
   * o el mes actual si todavía no hay ningún mes generado.
   */
  rangoHistorialPorDefecto = computed<{ desde: string; hasta: string }>(() => {
    const hoy = new Date();
    const desdeD = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
    const desde = `${desdeD.getFullYear()}-${String(desdeD.getMonth() + 1).padStart(2, '0')}-01`;

    const meses = this.mesesDisponibles();
    let anoHasta = hoy.getFullYear();
    let mesHasta = hoy.getMonth() + 1;
    if (meses.length > 0) {
      // mesesDisponibles llega ordenada desc (ano, mes) desde el backend.
      anoHasta = meses[0].ano;
      mesHasta = meses[0].mes;
    }
    const ultimoDia = new Date(anoHasta, mesHasta, 0).getDate();
    const hasta = `${anoHasta}-${String(mesHasta).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    return { desde, hasta };
  });

  abrirModalHistorial(): void {
    this.modalHistorialVisible.set(true);
  }

  busquedaPublicador = signal('');
  resultadosBusqueda = signal<PublicadorSimple[]>([]);
  buscandoPublicador = signal(false);
  mostrarDropdownBusqueda = signal(false);
  mostrarDropdownTemas = signal(false);
  /** En el modal de saliente: buscar en el catálogo del S-34 en vez de en los
      temas ya registrados del publicador. */
  buscarEnCatalogo = signal(false);
  private busqueda$ = new Subject<string>();

  confirmPendiente = signal<{ titulo: string; mensaje: string; accionLabel: string; callback: () => void } | null>(null);
  editandoEntrantes = signal<Set<number>>(new Set());
  editandoSalientes = signal<Set<number>>(new Set());

  aceptarConfirm(): void {
    this.confirmPendiente()?.callback();
    this.confirmPendiente.set(null);
  }

  cancelarConfirm(): void {
    this.confirmPendiente.set(null);
  }

  isEditandoEntrante(id: number): boolean {
    return this.editandoEntrantes().has(id);
  }

  toggleEditEntrante(id: number): void {
    const s = new Set(this.editandoEntrantes());
    s.has(id) ? s.delete(id) : s.add(id);
    this.editandoEntrantes.set(s);
  }

  isEditandoSaliente(id: number): boolean {
    return this.editandoSalientes().has(id);
  }

  toggleEditSaliente(id: number): void {
    const s = new Set(this.editandoSalientes());
    s.has(id) ? s.delete(id) : s.add(id);
    this.editandoSalientes.set(s);
  }

  genMes = new Date().getMonth() + 1;
  genAno = new Date().getFullYear();

  nuevoSaliente: {
    fecha: string; id_publicador: number | null; congregacion_destino: string;
    tema_discurso: string; hora: string; ubicacion: UbicacionSaliente | null;
  } = {
    fecha: '', id_publicador: null, congregacion_destino: '', tema_discurso: '', hora: '', ubicacion: null,
  };

  /** true cuando la ubicación del modal viene del autorelleno por congregación. */
  readonly ubicacionAutorellenada = signal(false);

  private get idCong(): number | null {
    return this.congCtx.effectiveCongregacionId();
  }

  /** Expone `idCong` a la plantilla: el getter es privado, `strictTemplates` no deja enlazarlo directo. */
  idCongActual(): number | null {
    return this.idCong;
  }

  constructor() {
    effect(() => {
      const id = this.idCong;
      if (id) {
        untracked(() => {
          this.cargarMeses();
          this.cargarGrupos();
          this.cargarPublicadores();
          this.temasLoaded.set(false);
          this.temas.set([]);
          this.loadTemas();
          this.congregacionesContactoLoaded.set(false);
          this.congregacionesContacto.set([]);
          this.loadCongregacionesContacto();
        });
      }
    });
  }

  ngOnInit(): void {
    this.busqueda$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((q) => {
        if (!q.trim()) {
          this.resultadosBusqueda.set(this.publicadores());
          this.buscandoPublicador.set(false);
          return EMPTY;
        }
        this.buscandoPublicador.set(true);
        return this.svc.buscarPublicadores(this.idCong, q.trim());
      }),
    ).subscribe({
      next: (r) => { this.resultadosBusqueda.set(r); this.buscandoPublicador.set(false); },
      error: () => this.buscandoPublicador.set(false),
    });
  }

  hasEditPermission(): boolean {
    return this.auth.hasPermission('reuniones.discursos');
  }

  mesLabel(ano: number, mes: number): string {
    return `${MESES_ES[mes - 1]} ${ano}`;
  }

  /** Solo el nombre del mes, para listas ya agrupadas por año. */
  mesSoloLabel(mes: number): string {
    return MESES_ES[mes - 1];
  }

  mesMinDate(): string {
    const d = this.mesDatos();
    if (!d) return '';
    return `${d.ano}-${String(d.mes).padStart(2, '0')}-01`;
  }

  mesMaxDate(): string {
    const d = this.mesDatos();
    if (!d) return '';
    const last = new Date(d.ano, d.mes, 0).getDate();
    return `${d.ano}-${String(d.mes).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }

  formatFecha(fechaStr: string): string {
    const d = new Date(fechaStr + 'T00:00:00');
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
  }

  private cargarMeses(): void {
    if (!this.idCong) return;
    this.svc.getMeses(this.idCong).subscribe({
      next: (m) => this.mesesDisponibles.set(m),
      error: () => {},
    });
  }

  private cargarGrupos(): void {
    if (!this.idCong) return;
    this.svc.getGrupos(this.idCong).subscribe({
      next: (g) => this.grupos.set(g),
      error: () => {},
    });
  }

  private cargarPublicadores(): void {
    if (!this.idCong) return;
    this.svc.getPublicadores(this.idCong).subscribe({
      next: (p) => {
        // Si la congregación aún no tiene nadie con el permiso "orador",
        // caemos a todos los activos para que el desplegable sea usable.
        if (p.length === 0) {
          this.svc.getPublicadores(this.idCong, false).subscribe({
            next: (todos) => this.publicadores.set(todos),
            error: () => {},
          });
          return;
        }
        this.publicadores.set(p);
      },
      error: () => {},
    });
  }

  /**
   * Opciones del desplegable de una tarjeta: la lista de conferenciantes más el
   * publicador ya asignado si no figura en ella (p. ej. porque perdió el
   * permiso "orador"), para que la asignación guardada siempre se vea.
   */
  opcionesPublicador(saliente: DiscursoSalienteOut): PublicadorSimple[] {
    const lista = this.publicadores();
    const asignado = saliente.publicador;
    if (!asignado || lista.some(p => p.id_publicador === asignado.id_publicador)) return lista;
    return [asignado, ...lista];
  }

  cargarMes(ano: number, mes: number): void {
    this.estado.set('loading');
    this.editandoEntrantes.set(new Set());
    this.editandoSalientes.set(new Set());
    this.svc.getMes(ano, mes, this.idCong).subscribe({
      next: (data) => {
        this.mesDatos.set(data);
        this.estado.set('ready');
        // También avisa de los que ya traían título antes de esta sesión.
        data.entrantes.filter(e => e.titulo_discurso?.trim()).forEach(e => this.verificarRepetido(e));
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'Error al cargar el mes');
        this.estado.set('error');
      },
    });
  }

  abrirModalGenerar(): void {
    this.modalGenerarVisible.set(true);
  }

  cerrarModalGenerar(): void {
    this.modalGenerarVisible.set(false);
  }

  generarMes(): void {
    this.estado.set('loading');
    this.cerrarModalGenerar();
    this.svc.generar({ ano: this.genAno, mes: this.genMes }, this.idCong).subscribe({
      next: (data) => {
        this.mesDatos.set(data);
        this.estado.set('ready');
        this.cargarMeses();
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'Error al generar el mes');
        this.estado.set('error');
      },
    });
  }

  confirmarMes(): void {
    const d = this.mesDatos();
    if (!d) return;
    this.estado.set('loading');
    this.svc.confirmar({ ano: d.ano, mes: d.mes }, this.idCong).subscribe({
      next: (data) => {
        this.mesDatos.set(data);
        this.estado.set('ready');
        this.confirmadoBanner.set(true);
        this.cargarMeses();
        setTimeout(() => this.confirmadoBanner.set(false), 4000);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'Error al confirmar');
        this.estado.set('error');
      },
    });
  }

  borrarMes(): void {
    const d = this.mesDatos();
    if (!d) return;
    this.confirmPendiente.set({
      titulo: `Eliminar ${this.mesLabel(d.ano, d.mes)}`,
      mensaje: 'Se eliminará toda la programación de discursos de este mes. Esta acción no se puede deshacer.',
      accionLabel: 'Eliminar',
      callback: () => {
        this.estado.set('loading');
        this.svc.eliminarMes(d.ano, d.mes, this.idCong).subscribe({
          next: () => {
            this.mesDatos.set(null);
            this.estado.set('idle');
            this.cargarMeses();
          },
          error: (e) => {
            this.errorMsg.set(e?.error?.detail ?? 'Error al borrar el mes');
            this.estado.set('error');
          },
        });
      },
    });
  }

  descargarPdf(tipo: 'entrantes' | 'salientes', ano: number, mes: number, event: Event): void {
    event.stopPropagation();
    this.descargandoPdf.set(true);
    const obs = tipo === 'entrantes'
      ? this.svc.descargarPdfEntrantes(ano, mes, this.idCong)
      : this.svc.descargarPdfSalientes(ano, mes, this.idCong);
    obs.subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `discursos_${tipo}_${MESES_ES[mes - 1]}_${ano}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.descargandoPdf.set(false);
      },
      error: () => this.descargandoPdf.set(false),
    });
  }

  onEntranteChange(entrante: DiscursoEntranteOut, campo: string, event: Event): void {
    this.guardarCampoEntrante(entrante, campo, (event.target as HTMLInputElement).value);
  }

  /**
   * Guarda un campo del entrante con el valor ya resuelto. Los inputs normales
   * llegan por `onEntranteChange` (evento de blur) y el campo con catálogo por
   * su salida `(commit)`, que emite el texto directamente.
   */
  guardarCampoEntrante(entrante: DiscursoEntranteOut, campo: string, valor: string | null): void {
    const val = (valor ?? '').trim() || null;
    if ((entrante as any)[campo] === val) return;
    this.svc.editarEntrante(entrante.id_discurso_entrante, { [campo]: val }, this.idCong).subscribe({
      next: (updated) => {
        this.updateEntrante(updated);
        if (campo === 'titulo_discurso') this.verificarRepetido(updated);
      },
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  // ── Aviso de discurso repetido ──────────────────────────────────────────────
  //
  // Al escribir el título de un entrante, avisa si ese mismo discurso (por
  // número de bosquejo o por texto) ya se dio en esta congregación en los
  // últimos meses. Es solo informativo: nunca bloquea el guardado, y si la
  // consulta falla se ignora en silencio para no molestar por algo accesorio.

  repeticiones = signal<Record<number, HistorialOcurrenciaEntrante[]>>({});

  private verificarRepetido(entrante: DiscursoEntranteOut): void {
    const id = entrante.id_discurso_entrante;
    if (!entrante.titulo_discurso?.trim()) {
      this.repeticiones.update(m => {
        if (!(id in m)) return m;
        const { [id]: _, ...resto } = m;
        return resto;
      });
      return;
    }
    this.svc.verificarRepeticion(entrante.titulo_discurso, entrante.fecha, id, this.idCong).subscribe({
      next: (res) => {
        this.repeticiones.update(m => {
          if (res.repeticiones.length === 0) {
            if (!(id in m)) return m;
            const { [id]: _, ...resto } = m;
            return resto;
          }
          return { ...m, [id]: res.repeticiones };
        });
      },
      error: () => {}, // aviso de cortesía: un fallo aquí no debe interrumpir nada
    });
  }

  onEntranteGrupoChange(entrante: DiscursoEntranteOut, event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const id = val ? +val : null;
    this.svc.editarEntrante(entrante.id_discurso_entrante, { id_grupo_hospitalidad: id }, this.idCong).subscribe({
      next: (updated) => this.updateEntrante(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  private updateEntrante(updated: DiscursoEntranteOut): void {
    const d = this.mesDatos();
    if (!d) return;
    this.mesDatos.set({
      ...d,
      entrantes: d.entrantes.map(e => e.id_discurso_entrante === updated.id_discurso_entrante ? updated : e),
    });
  }

  onSalienteChange(saliente: DiscursoSalienteOut, campo: string, event: Event): void {
    this.guardarCampoSaliente(saliente, campo, (event.target as HTMLInputElement).value);
  }

  // ── Confirmación telefónica del orador entrante ────────────────────────────

  /** Ids con una petición en vuelo, para no permitir doble clic. */
  confirmandoOrador = signal<Set<number>>(new Set());

  /** Cuántos entrantes del mes tienen ya confirmado el orador. */
  entrantesConfirmados = computed(() =>
    (this.mesDatos()?.entrantes ?? []).filter(e => e.orador_confirmado).length
  );

  /** Fechas del mes que todavía no tienen a nadie asignado. */
  entrantesSinOrador = computed(() =>
    (this.mesDatos()?.entrantes ?? []).filter(e => !e.nombre_orador?.trim()).length
  );

  // ── Estado de cada fecha, para poder leer el mes de un vistazo ─────────────
  //
  // Doce sábados pintados todos igual no dicen dónde queda trabajo por hacer:
  // hay que abrir cada tarjeta y mirar si el campo Orador está vacío. Con el
  // estado en la cabecera, recorrer la columna de fechas basta para saberlo.
  //
  // Los cuatro estados son excluyentes y van en orden de avance: sin nadie
  // asignado → asignado pero sin llamar → llamada hecha → ya se dio.
  //
  // Ojo con el orden: "sin orador" pesa MÁS que "confirmado". Los dos campos
  // son independientes en la base de datos y se ven fechas con la confirmación
  // puesta y el nombre vacío, que es imposible —no se confirma una llamada a
  // nadie— y casi siempre significa que alguien pulsó el botón antes de
  // apuntar el nombre. Dando prioridad a "confirmado" la fecha se pintaría de
  // verde y el hueco pasaría inadvertido justo hasta el sábado.

  estadoEntrante(e: DiscursoEntranteOut): 'pendiente' | 'asignado' | 'confirmado' | 'presentado' {
    if (e.presentado) return 'presentado';
    if (!e.nombre_orador?.trim()) return 'pendiente';
    return e.orador_confirmado ? 'confirmado' : 'asignado';
  }

  /**
   * Fondo de la cabecera de fecha según su estado.
   *
   * Tintes muy bajos (de 40 a 60 de saturación en claro, /20 en oscuro): la
   * cabecera tiene que distinguirse al recorrer la lista, no competir con el
   * contenido de la tarjeta. El color reutiliza el significado que ya tiene en
   * el resto del módulo —ámbar avisa, esmeralda confirma, violeta es Reuniones—
   * en vez de estrenar una paleta propia.
   */
  cabeceraEntranteClass(e: DiscursoEntranteOut): string {
    switch (this.estadoEntrante(e)) {
      case 'pendiente':
        return 'bg-amber-50/80 dark:bg-amber-950/25 border-amber-100 dark:border-amber-900/40';
      case 'confirmado':
        return 'bg-emerald-50/80 dark:bg-emerald-950/25 border-emerald-100 dark:border-emerald-900/40';
      case 'presentado':
        return 'bg-violet-50/70 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/40';
      default:
        return 'bg-slate-50 dark:bg-slate-800/80 border-slate-100 dark:border-slate-800';
    }
  }

  /** Color del icono de calendario, del mismo estado que la cabecera. */
  iconoEntranteClass(e: DiscursoEntranteOut): string {
    switch (this.estadoEntrante(e)) {
      case 'pendiente':   return 'text-amber-500';
      case 'confirmado':  return 'text-emerald-500';
      case 'presentado':  return 'text-violet-400 dark:text-violet-500';
      default:            return 'text-violet-500';
    }
  }

  toggleOradorConfirmado(entrante: DiscursoEntranteOut): void {
    const id = entrante.id_discurso_entrante;
    if (this.confirmandoOrador().has(id)) return;

    this.confirmandoOrador.update(s => new Set(s).add(id));
    const nuevoValor = !entrante.orador_confirmado;

    this.svc.confirmarOrador(id, nuevoValor, this.idCong).subscribe({
      next: (updated) => {
        this.updateEntrante(updated);
        this.confirmandoOrador.update(s => { const n = new Set(s); n.delete(id); return n; });
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'No se pudo guardar la confirmación');
        this.confirmandoOrador.update(s => { const n = new Set(s); n.delete(id); return n; });
      },
    });
  }

  /** Texto del tooltip: quién confirmó y cuándo, o qué significa marcarlo. */
  tituloConfirmacion(entrante: DiscursoEntranteOut): string {
    if (!entrante.orador_confirmado) {
      return 'Marcar cuando hayas llamado a la congregación de origen y te confirmen que el orador viene';
    }
    const partes: string[] = ['Orador confirmado'];
    if (entrante.orador_confirmado_por) partes.push(`por ${entrante.orador_confirmado_por}`);
    if (entrante.orador_confirmado_en) {
      const f = new Date(entrante.orador_confirmado_en);
      partes.push(`el ${f.toLocaleDateString('es')} a las ${f.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`);
    }
    return partes.join(' ') + '. Pulsa para quitar la confirmación.';
  }

  // ── Discurso presentado ────────────────────────────────────────────────────

  /** Ids con una petición en vuelo, para no permitir doble clic. */
  marcandoPresentado = signal<Set<number>>(new Set());

  /** Cuántos discursos del mes ya se dieron. */
  entrantesPresentados = computed(() =>
    (this.mesDatos()?.entrantes ?? []).filter(e => e.presentado).length
  );

  /**
   * Cuántos entrantes del mes tienen un aviso de repetición activo. Filtra por
   * los ids del mes actual (no cuenta el mapa entero) porque `repeticiones()`
   * puede conservar entradas de meses vistos antes en la misma sesión.
   */
  entrantesRepetidos = computed(() =>
    (this.mesDatos()?.entrantes ?? []).filter(e => (this.repeticiones()[e.id_discurso_entrante] ?? []).length > 0).length
  );

  togglePresentado(entrante: DiscursoEntranteOut): void {
    const id = entrante.id_discurso_entrante;
    if (this.marcandoPresentado().has(id)) return;

    this.marcandoPresentado.update(s => new Set(s).add(id));
    const quitar = (n: Set<number>) => { const c = new Set(n); c.delete(id); return c; };

    this.svc.marcarPresentado(id, !entrante.presentado, this.idCong).subscribe({
      next: (updated) => {
        this.updateEntrante(updated);
        this.marcandoPresentado.update(quitar);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'No se pudo guardar la marca de presentado');
        this.marcandoPresentado.update(quitar);
      },
    });
  }

  /** Tooltip: si lo marcó el sistema o una persona, y cuándo. */
  tituloPresentado(entrante: DiscursoEntranteOut): string {
    if (!entrante.presentado) {
      return 'El sistema lo marcará solo al pasar la hora de la reunión. Púlsalo para marcarlo ya.';
    }
    const cuando = entrante.presentado_en
      ? (() => {
          const f = new Date(entrante.presentado_en!);
          return ` el ${f.toLocaleDateString('es')} a las ${f.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
        })()
      : '';
    const quien = entrante.presentado_por
      ? `Marcado por ${entrante.presentado_por}`
      : 'Marcado automáticamente al pasar la hora de la reunión';
    return `${quien}${cuando}. Pulsa si el discurso no llegó a darse.`;
  }

  /** Igual que `guardarCampoEntrante`, para el saliente. */
  guardarCampoSaliente(saliente: DiscursoSalienteOut, campo: string, valor: string | null): void {
    const val = (valor ?? '').trim() || null;
    if ((saliente as any)[campo] === val) return;
    this.svc.editarSaliente(saliente.id_discurso_saliente, { [campo]: val }, this.idCong).subscribe({
      next: (updated) => this.updateSaliente(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  onSalientePublicadorChange(saliente: DiscursoSalienteOut, event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const id = val ? +val : null;
    const idCong = this.idCong;

    const doEditar = () => {
      this.svc.editarSaliente(saliente.id_discurso_saliente, { id_publicador: id }, this.idCong).subscribe({
        next: (updated) => this.updateSaliente(updated),
        error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
      });
    };

    if (!id || !idCong) {
      doEditar();
      return;
    }

    const pub = this.publicadores().find(p => p.id_publicador === id);
    const nombre = pub?.nombre_completo ?? 'Este publicador';

    this.conflictosSvc
      .confirmarSiHayConflicto(
        id, saliente.fecha, idCong, nombre,
        { tipo: 'discurso_saliente', id: saliente.id_discurso_saliente },
      )
      .subscribe((proceder) => { if (proceder) doEditar(); });
  }

  private updateSaliente(updated: DiscursoSalienteOut): void {
    const d = this.mesDatos();
    if (!d) return;
    this.mesDatos.set({
      ...d,
      salientes: d.salientes.map(s => s.id_discurso_saliente === updated.id_discurso_saliente ? updated : s),
    });
  }

  eliminarSaliente(saliente: DiscursoSalienteOut): void {
    const pubNombre = saliente.publicador?.nombre_completo ?? 'este saliente';
    this.confirmPendiente.set({
      titulo: 'Eliminar saliente',
      mensaje: `Se eliminará a ${pubNombre} del ${this.formatFecha(saliente.fecha)}. Esta acción no se puede deshacer.`,
      accionLabel: 'Eliminar',
      callback: () => {
        this.svc.eliminarSaliente(saliente.id_discurso_saliente, this.idCong).subscribe({
          next: () => {
            const d = this.mesDatos();
            if (!d) return;
            this.mesDatos.set({
              ...d,
              salientes: d.salientes.filter(s => s.id_discurso_saliente !== saliente.id_discurso_saliente),
            });
          },
          error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al eliminar'),
        });
      },
    });
  }

  // ── Estado de la salida: Programado / Realizada / Cancelado ───────────────

  /** Ids con una petición en vuelo, para no permitir doble clic. */
  marcandoPresentadoSaliente = signal<Set<number>>(new Set());
  cancelandoSaliente = signal<Set<number>>(new Set());

  salientesProgramados = computed(() =>
    (this.mesDatos()?.salientes ?? []).filter(s => s.estado === 'programado').length
  );
  salientesRealizados = computed(() =>
    (this.mesDatos()?.salientes ?? []).filter(s => s.estado === 'realizada').length
  );
  salientesCancelados = computed(() =>
    (this.mesDatos()?.salientes ?? []).filter(s => s.estado === 'cancelado').length
  );

  /** Alterna Programado↔Realizada a mano. El planificador la marca solo al pasar fecha+hora. */
  togglePresentadoSaliente(saliente: DiscursoSalienteOut): void {
    const id = saliente.id_discurso_saliente;
    if (this.marcandoPresentadoSaliente().has(id)) return;

    this.marcandoPresentadoSaliente.update(s => new Set(s).add(id));
    const quitar = (n: Set<number>) => { const c = new Set(n); c.delete(id); return c; };

    this.svc.marcarPresentadoSaliente(id, saliente.estado !== 'realizada', this.idCong).subscribe({
      next: (updated) => {
        this.updateSaliente(updated);
        this.marcandoPresentadoSaliente.update(quitar);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'No se pudo guardar el estado');
        this.marcandoPresentadoSaliente.update(quitar);
      },
    });
  }

  /** Cancela una salida antes de la fecha; el orador queda libre para otra. */
  cancelarSaliente(saliente: DiscursoSalienteOut): void {
    const pubNombre = saliente.publicador?.nombre_completo ?? 'este saliente';
    this.confirmPendiente.set({
      titulo: 'Cancelar salida',
      mensaje: `Se marcará como cancelada la salida de ${pubNombre} del ${this.formatFecha(saliente.fecha)}. Podrás reactivarla o volver a programar a la misma persona en otra fecha.`,
      accionLabel: 'Cancelar salida',
      callback: () => this.marcarCanceladoSaliente(saliente, true),
    });
  }

  /** Deshace la cancelación: la salida vuelve a Programado. */
  reactivarSaliente(saliente: DiscursoSalienteOut): void {
    this.marcarCanceladoSaliente(saliente, false);
  }

  private marcarCanceladoSaliente(saliente: DiscursoSalienteOut, cancelado: boolean): void {
    const id = saliente.id_discurso_saliente;
    if (this.cancelandoSaliente().has(id)) return;

    this.cancelandoSaliente.update(s => new Set(s).add(id));
    const quitar = (n: Set<number>) => { const c = new Set(n); c.delete(id); return c; };

    this.svc.marcarCanceladoSaliente(id, cancelado, this.idCong).subscribe({
      next: (updated) => {
        this.updateSaliente(updated);
        this.cancelandoSaliente.update(quitar);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'No se pudo guardar la cancelación');
        this.cancelandoSaliente.update(quitar);
      },
    });
  }

  /** Tooltip del chip de estado: quién lo marcó y cuándo. */
  tituloEstadoSaliente(saliente: DiscursoSalienteOut): string {
    if (saliente.estado === 'cancelado') {
      const cuando = saliente.cancelado_en
        ? (() => {
            const f = new Date(saliente.cancelado_en!);
            return ` el ${f.toLocaleDateString('es')} a las ${f.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
          })()
        : '';
      const quien = saliente.cancelado_por ? `Cancelado por ${saliente.cancelado_por}` : 'Cancelado';
      return `${quien}${cuando}. Pulsa para reactivar.`;
    }
    if (saliente.estado === 'realizada') {
      const cuando = saliente.presentado_en
        ? (() => {
            const f = new Date(saliente.presentado_en!);
            return ` el ${f.toLocaleDateString('es')} a las ${f.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
          })()
        : '';
      const quien = saliente.presentado_por
        ? `Marcado por ${saliente.presentado_por}`
        : 'Marcado automáticamente al pasar la fecha de la reunión';
      return `${quien}${cuando}. Pulsa si el discurso no llegó a darse.`;
    }
    return 'El sistema lo marcará solo al pasar la fecha de la reunión. Púlsalo para marcarlo ya.';
  }

  abrirModalSaliente(): void {
    this.nuevoSaliente = { fecha: '', id_publicador: null, congregacion_destino: '', tema_discurso: '', hora: '', ubicacion: null };
    this.ubicacionAutorellenada.set(false);
    this.busquedaPublicador.set('');
    this.resultadosBusqueda.set(this.publicadores());
    this.mostrarDropdownBusqueda.set(false);
    this.buscarEnCatalogo.set(false);
    this.modalSalienteVisible.set(true);
  }

  onBusquedaPublicadorInput(valor: string): void {
    this.busquedaPublicador.set(valor);
    this.mostrarDropdownBusqueda.set(true);
    this.busqueda$.next(valor);
  }

  seleccionarPublicadorBusqueda(p: PublicadorSimple): void {
    this.nuevoSaliente.id_publicador = p.id_publicador;
    this.nuevoSaliente.tema_discurso = '';
    this.busquedaPublicador.set(p.nombre_completo);
    this.mostrarDropdownBusqueda.set(false);
    this.mostrarDropdownTemas.set(false);
    this.buscarEnCatalogo.set(false);
  }

  /**
   * En el modal de Temas el número y el título se guardan por separado, así que
   * al elegir del catálogo se rellenan los dos campos de una vez.
   */
  onTemaDelCatalogo(d: CatalogoDiscurso): void {
    this.nuevoTema.numero_tema = String(d.numero);
    this.nuevoTema.titulo = d.titulo;
  }

  publicadorSeleccionadoNombre(): string {
    if (!this.nuevoSaliente.id_publicador) return '';
    const p = [...this.publicadores(), ...this.resultadosBusqueda()].find(x => x.id_publicador === this.nuevoSaliente.id_publicador);
    return p?.nombre_completo ?? '';
  }

  cerrarModalSaliente(): void {
    this.modalSalienteVisible.set(false);
  }

  // ── Notificación por WhatsApp al orador ────────────────────────────────────

  readonly whatsappPendiente = signal<{
    nombre: string; telefono: string | null; mensaje: string;
  } | null>(null);

  abrirWhatsapp(saliente: DiscursoSalienteOut): void {
    const nombre = saliente.publicador?.nombre_completo ?? 'Publicador';
    this.whatsappPendiente.set({
      nombre,
      telefono: this.normalizarTelefono(saliente.publicador?.telefono),
      mensaje: this.mensajeWhatsapp(saliente),
    });
  }

  cerrarWhatsapp(): void {
    this.whatsappPendiente.set(null);
  }

  onMensajeWhatsappChange(texto: string): void {
    const actual = this.whatsappPendiente();
    if (actual) this.whatsappPendiente.set({ ...actual, mensaje: texto });
  }

  /** Abre WhatsApp con el mensaje; sin teléfono deja elegir el contacto. */
  enviarWhatsapp(): void {
    const w = this.whatsappPendiente();
    if (!w) return;
    const texto = encodeURIComponent(w.mensaje);
    const url = w.telefono
      ? `https://wa.me/${w.telefono}?text=${texto}`
      : `https://wa.me/?text=${texto}`;
    window.open(url, '_blank');
    this.cerrarWhatsapp();
  }

  private mensajeWhatsapp(s: DiscursoSalienteOut): string {
    const primerNombre = (s.publicador?.nombre_completo ?? '').split(' ')[0] || 'hermano';
    const lineas = [
      `Hola ${primerNombre},`,
      '',
      'Has sido programado para dar un discurso público:',
      '',
      `◆ *Fecha:* ${this.fechaLarga(s.fecha)}`,
    ];
    if (s.hora) lineas.push(`◆ *Hora:* ${this.formatHora(s.hora)}`);
    if (s.congregacion_destino) lineas.push(`◆ *Congregación:* ${s.congregacion_destino}`);
    if (s.tema_discurso) lineas.push(`◆ *Discurso:* ${s.tema_discurso}`);
    if (s.direccion_destino) lineas.push(`◆ *Lugar:* ${s.direccion_destino}`);
    if (s.url_mapa) lineas.push(`◆ *Cómo llegar:* ${s.url_mapa}`);
    if (s.notas) lineas.push(`◆ *Notas:* ${s.notas}`);
    lineas.push('', 'Por favor confirma que puedes atender esta asignación. ¡Gracias!');
    return lineas.join('\n');
  }

  private fechaLarga(fechaStr: string): string {
    const d = new Date(fechaStr + 'T00:00:00');
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  }

  /** "14:30" → "2:30 p. m." */
  private formatHora(hora: string): string {
    const [h, m] = hora.split(':').map(Number);
    if (isNaN(h)) return hora;
    const sufijo = h < 12 ? 'a. m.' : 'p. m.';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m ?? 0).padStart(2, '0')} ${sufijo}`;
  }

  /** Deja sólo dígitos y antepone el indicativo de Colombia a los móviles. */
  private normalizarTelefono(telefono?: string | null): string | null {
    if (!telefono) return null;
    const limpio = telefono.replace(/\D/g, '');
    if (!limpio) return null;
    return !limpio.startsWith('57') && limpio.length === 10 ? `57${limpio}` : limpio;
  }

  onUbicacionModalChange(ubic: UbicacionSaliente | null): void {
    this.nuevoSaliente.ubicacion = ubic;
    this.ubicacionAutorellenada.set(false);
  }

  /**
   * Al salir de "Congregación Destino" sin haber elegido del directorio,
   * recupera hora y ubicación de la última vez que se fue a esa congregación
   * (fallback histórico; el directorio de contacto, si la tiene guardada, ya
   * autocompletó al elegirla — ver `onNuevoSalienteCongregacionSeleccionada`).
   */
  autorellenarUbicacion(): void {
    const nombre = this.nuevoSaliente.congregacion_destino?.trim();
    if (!nombre || !this.idCong) return;
    if (this.nuevoSaliente.ubicacion && this.nuevoSaliente.hora) return;
    this.svc.ubicacionSugerida(nombre, this.idCong).subscribe({
      next: (u) => {
        if (!this.nuevoSaliente.ubicacion && u?.url_mapa) {
          this.nuevoSaliente.ubicacion = {
            direccion_destino: u.direccion_destino ?? null,
            url_mapa: u.url_mapa,
            lat: u.lat ?? null,
            lon: u.lon ?? null,
          };
          this.ubicacionAutorellenada.set(true);
        }
        if (!this.nuevoSaliente.hora && u?.hora) {
          this.nuevoSaliente.hora = u.hora;
        }
      },
      error: () => {},
    });
  }

  /** Al elegir una congregación del directorio en el modal "Añadir saliente": autocompleta hora y ubicación sin pisar lo ya escrito. */
  onNuevoSalienteCongregacionSeleccionada(c: CongregacionContacto): void {
    if (!this.nuevoSaliente.hora && c.hora_reunion_fin_semana) {
      this.nuevoSaliente.hora = c.hora_reunion_fin_semana;
    }
    if (!this.nuevoSaliente.ubicacion && c.url_mapa) {
      this.nuevoSaliente.ubicacion = { direccion_destino: c.direccion, url_mapa: c.url_mapa, lat: c.lat, lon: c.lon };
      this.ubicacionAutorellenada.set(true);
    }
  }

  /** Igual que la anterior, pero al elegir en la tarjeta inline de un saliente ya creado. */
  onSalienteCongregacionSeleccionada(saliente: DiscursoSalienteOut, c: CongregacionContacto): void {
    if (!this.idCong) return;
    const payload: { congregacion_destino: string; hora?: string; direccion_destino?: string | null; url_mapa?: string; lat?: number | null; lon?: number | null } = {
      congregacion_destino: c.nombre,
    };
    if (!saliente.hora && c.hora_reunion_fin_semana) payload.hora = c.hora_reunion_fin_semana;
    if (!saliente.url_mapa && c.url_mapa) {
      payload.direccion_destino = c.direccion;
      payload.url_mapa = c.url_mapa;
      payload.lat = c.lat;
      payload.lon = c.lon;
    }
    this.svc.editarSaliente(saliente.id_discurso_saliente, payload, this.idCong).subscribe({
      next: (updated) => this.updateSaliente(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  /**
   * Objeto de ubicación memoizado por saliente: devolver una referencia nueva
   * en cada ciclo de detección haría que ngModel reescribiera el picker sin
   * parar (bucle infinito).
   */
  private ubicacionCache = new Map<number, UbicacionSaliente | null>();

  ubicacionDe(saliente: DiscursoSalienteOut): UbicacionSaliente | null {
    const cacheado = this.ubicacionCache.get(saliente.id_discurso_saliente);
    if (cacheado !== undefined
      && (cacheado?.url_mapa ?? null) === (saliente.url_mapa ?? null)
      && (cacheado?.direccion_destino ?? null) === (saliente.direccion_destino ?? null)) {
      return cacheado;
    }
    const ubic: UbicacionSaliente | null = saliente.url_mapa
      ? {
          direccion_destino: saliente.direccion_destino,
          url_mapa: saliente.url_mapa,
          lat: saliente.lat,
          lon: saliente.lon,
        }
      : null;
    this.ubicacionCache.set(saliente.id_discurso_saliente, ubic);
    return ubic;
  }

  onSalienteHoraChange(saliente: DiscursoSalienteOut, hora: string | null): void {
    const nueva = hora || null;
    if ((saliente.hora ?? null) === nueva) return;
    this.svc.editarSaliente(saliente.id_discurso_saliente, { hora: nueva }, this.idCong).subscribe({
      next: (updated) => this.updateSaliente(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar la hora'),
    });
  }

  onSalienteUbicacionChange(saliente: DiscursoSalienteOut, ubic: UbicacionSaliente | null): void {
    if ((saliente.url_mapa ?? null) === (ubic?.url_mapa ?? null)) return;
    this.svc.editarSaliente(saliente.id_discurso_saliente, {
      direccion_destino: ubic?.direccion_destino ?? null,
      url_mapa: ubic?.url_mapa ?? null,
      lat: ubic?.lat ?? null,
      lon: ubic?.lon ?? null,
    }, this.idCong).subscribe({
      next: (updated) => this.updateSaliente(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar la ubicación'),
    });
  }

  loadTemas(): void {
    if (this.temasLoaded() || !this.idCong) return;
    this.loadingTemas.set(true);
    this.svc.getTemas(this.idCong).subscribe({
      next: (t) => { this.temas.set(t); this.temasLoaded.set(true); this.loadingTemas.set(false); },
      error: () => this.loadingTemas.set(false),
    });
  }

  // ── Directorio de congregaciones de contacto ──────────────────────────────

  loadCongregacionesContacto(): void {
    if (this.congregacionesContactoLoaded() || !this.idCong) return;
    this.loadingCongregacionesContacto.set(true);
    this.svc.getCongregacionesContacto(this.idCong).subscribe({
      next: (r) => {
        this.congregacionesContacto.set(r);
        this.congregacionesContactoLoaded.set(true);
        this.loadingCongregacionesContacto.set(false);
      },
      error: () => this.loadingCongregacionesContacto.set(false),
    });
  }

  readonly diaLabelMap: Record<string, string> = { Sabado: 'Sábado', Domingo: 'Domingo' };
  readonly diasFinSemanaOpciones = ['Sabado', 'Domingo'];
  diaLabel(dia: string | null): string {
    return dia ? (this.diaLabelMap[dia] ?? dia) : '';
  }

  diaDropdownAbierto = signal(false);
  seleccionarDiaCongregacionContacto(dia: string | null): void {
    this.nuevaCongregacionContacto.dia_reunion_fin_semana = dia;
    this.diaDropdownAbierto.set(false);
  }

  private ubicacionContactoCache = new Map<number, UbicacionSaliente | null>();
  ubicacionDeContacto(c: CongregacionContacto): UbicacionSaliente | null {
    const cacheado = this.ubicacionContactoCache.get(c.id_congregacion_contacto);
    if (cacheado !== undefined && cacheado?.url_mapa === c.url_mapa) return cacheado;
    const u: UbicacionSaliente | null = c.url_mapa
      ? { direccion_destino: c.direccion, url_mapa: c.url_mapa, lat: c.lat, lon: c.lon }
      : null;
    this.ubicacionContactoCache.set(c.id_congregacion_contacto, u);
    return u;
  }

  abrirModalCongregacionContacto(c?: CongregacionContacto): void {
    if (c) {
      this.editandoCongregacionContacto.set(c);
      this.nuevaCongregacionContacto = {
        nombre: c.nombre, dia_reunion_fin_semana: c.dia_reunion_fin_semana,
        hora_reunion_fin_semana: c.hora_reunion_fin_semana, notas: c.notas,
        ubicacion: c.url_mapa ? { direccion_destino: c.direccion, url_mapa: c.url_mapa, lat: c.lat, lon: c.lon } : null,
        personas: c.personas.map(p => ({ id_contacto_persona: p.id_contacto_persona, nombre: p.nombre, cargo: p.cargo, telefono: p.telefono })),
      };
    } else {
      this.editandoCongregacionContacto.set(null);
      this.nuevaCongregacionContacto = { nombre: '', dia_reunion_fin_semana: null, hora_reunion_fin_semana: null, notas: null, ubicacion: null, personas: [] };
    }
    this.modalCongregacionContactoVisible.set(true);
  }

  cerrarModalCongregacionContacto(): void {
    this.modalCongregacionContactoVisible.set(false);
    this.editandoCongregacionContacto.set(null);
    this.diaDropdownAbierto.set(false);
  }

  anadirPersonaModal(): void {
    this.nuevaCongregacionContacto.personas = [...this.nuevaCongregacionContacto.personas, { nombre: '', cargo: null, telefono: null }];
  }

  quitarPersonaModal(i: number): void {
    this.nuevaCongregacionContacto.personas = this.nuevaCongregacionContacto.personas.filter((_, idx) => idx !== i);
  }

  guardarCongregacionContacto(): void {
    if (!this.nuevaCongregacionContacto.nombre.trim() || !this.idCong) return;
    const n = this.nuevaCongregacionContacto;
    const payload = {
      nombre: n.nombre.trim(),
      dia_reunion_fin_semana: n.dia_reunion_fin_semana || null,
      hora_reunion_fin_semana: n.hora_reunion_fin_semana || null,
      direccion: n.ubicacion?.direccion_destino ?? null,
      url_mapa: n.ubicacion?.url_mapa ?? null,
      lat: n.ubicacion?.lat ?? null,
      lon: n.ubicacion?.lon ?? null,
      notas: n.notas || null,
    };
    const actual = this.editandoCongregacionContacto();
    const guardarBase$ = actual
      ? this.svc.editarCongregacionContacto(actual.id_congregacion_contacto, payload, this.idCong)
      : this.svc.crearCongregacionContacto(payload, this.idCong);

    guardarBase$.subscribe({
      next: (base) => this.guardarPersonasDelModal(base, actual?.personas ?? []),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? (actual ? 'Error al guardar' : 'Error al crear')),
    });
  }

  /**
   * Reconcilia la lista de personas del modal contra las que tenía la
   * congregación antes de abrirlo: crea las nuevas (sin id), edita las que ya
   * existían y borra las que se quitaron de la lista. Al terminar, recarga el
   * directorio para reflejar los ids reales de las personas recién creadas.
   */
  private guardarPersonasDelModal(base: CongregacionContacto, originales: ContactoPersona[]): void {
    const idCong = this.idCong;
    if (!idCong) { this.cerrarModalCongregacionContacto(); return; }
    const idCongContacto = base.id_congregacion_contacto;
    const actuales = this.nuevaCongregacionContacto.personas;
    const idsConservados = new Set(actuales.filter(p => p.id_contacto_persona != null).map(p => p.id_contacto_persona));

    const peticiones: Observable<unknown>[] = [];
    for (const p of actuales) {
      if (!p.nombre.trim()) continue;
      const datos = { nombre: p.nombre.trim(), cargo: p.cargo || null, telefono: p.telefono || null };
      peticiones.push(
        p.id_contacto_persona != null
          ? this.svc.editarContactoPersona(idCongContacto, p.id_contacto_persona, datos, idCong)
          : this.svc.crearContactoPersona(idCongContacto, datos, idCong)
      );
    }
    for (const orig of originales) {
      if (!idsConservados.has(orig.id_contacto_persona)) {
        peticiones.push(this.svc.eliminarContactoPersona(idCongContacto, orig.id_contacto_persona, idCong));
      }
    }

    const finalizar = () => {
      this.svc.getCongregacionesContacto(idCong).subscribe({
        next: (lista) => this.congregacionesContacto.set(lista),
        error: () => {},
      });
      // El directorio que alimenta los autocompletados es otro y vive en el
      // servicio: sin invalidarlo, renombrar una congregación aquí la seguiría
      // ofreciendo con el nombre viejo en las tarjetas del mes.
      this.svc.invalidarDirectorioContacto();
      this.cerrarModalCongregacionContacto();
    };

    if (peticiones.length === 0) { finalizar(); return; }
    forkJoin(peticiones).subscribe({
      next: finalizar,
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar los contactos'),
    });
  }

  confirmarEliminarCongregacionContacto(c: CongregacionContacto): void {
    this.confirmPendiente.set({
      titulo: 'Eliminar congregación',
      mensaje: `Se eliminará "${c.nombre}" y sus ${c.personas.length} contacto(s). Esta acción no se puede deshacer.`,
      accionLabel: 'Eliminar',
      callback: () => {
        this.svc.eliminarCongregacionContacto(c.id_congregacion_contacto, this.idCong).subscribe({
          next: () => {
            this.congregacionesContacto.set(this.congregacionesContacto().filter(x => x.id_congregacion_contacto !== c.id_congregacion_contacto));
            this.svc.invalidarDirectorioContacto();
          },
          error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al eliminar'),
        });
      },
    });
  }

  /** Reutiliza el modal de WhatsApp ya existente para escribir a un contacto. */
  contactarPersona(p: ContactoPersona): void {
    this.whatsappPendiente.set({
      nombre: p.nombre,
      telefono: this.normalizarTelefono(p.telefono),
      mensaje: `Hola${p.nombre ? ' ' + p.nombre : ''}, te escribo para coordinar un discurso público.`,
    });
  }

  abrirModalTema(tema?: TemaPublicador): void {
    if (tema) {
      this.editandoTema.set(tema);
      this.nuevoTema = { id_publicador: tema.id_publicador, numero_tema: tema.numero_tema != null ? String(tema.numero_tema) : '', titulo: tema.titulo };
    } else {
      this.editandoTema.set(null);
      this.nuevoTema = { id_publicador: null, numero_tema: '', titulo: '' };
    }
    this.modalTemaVisible.set(true);
  }

  cerrarModalTema(): void {
    this.modalTemaVisible.set(false);
    this.editandoTema.set(null);
  }

  guardarTema(): void {
    if (!this.nuevoTema.titulo.trim() || !this.idCong) return;
    const numeroTema = this.nuevoTema.numero_tema ? +this.nuevoTema.numero_tema : null;
    const tema = this.editandoTema();
    if (tema) {
      const payload: EditarTemaRequest = { titulo: this.nuevoTema.titulo.trim(), numero_tema: numeroTema };
      this.svc.editarTema(tema.id_tema, payload, this.idCong).subscribe({
        next: (updated) => {
          this.temas.set(this.temas().map(t => t.id_tema === updated.id_tema ? updated : t));
          this.cerrarModalTema();
        },
        error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
      });
    } else {
      if (!this.nuevoTema.id_publicador) return;
      const payload: CrearTemaRequest = { id_publicador: this.nuevoTema.id_publicador, titulo: this.nuevoTema.titulo.trim(), numero_tema: numeroTema };
      this.svc.crearTema(payload, this.idCong).subscribe({
        next: (nuevo) => { this.temas.set([...this.temas(), nuevo]); this.cerrarModalTema(); },
        error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al crear'),
      });
    }
  }

  confirmarEliminarTema(tema: TemaPublicador): void {
    this.confirmPendiente.set({
      titulo: 'Eliminar tema',
      mensaje: `Se eliminará "${tema.titulo}" de ${tema.nombre_publicador}. Esta acción no se puede deshacer.`,
      accionLabel: 'Eliminar',
      callback: () => {
        this.svc.eliminarTema(tema.id_tema, this.idCong).subscribe({
          next: () => this.temas.set(this.temas().filter(t => t.id_tema !== tema.id_tema)),
          error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al eliminar'),
        });
      },
    });
  }

  guardarSaliente(): void {
    if (!this.nuevoSaliente.fecha) return;
    const idCong = this.idCong;
    if (!idCong) return;

    const doCrear = () => {
      this.cerrarModalSaliente();
      this.svc.crearSaliente({
        fecha: this.nuevoSaliente.fecha!,
        id_publicador: this.nuevoSaliente.id_publicador,
        congregacion_destino: this.nuevoSaliente.congregacion_destino || null,
        tema_discurso: this.nuevoSaliente.tema_discurso || null,
        hora: this.nuevoSaliente.hora || null,
        direccion_destino: this.nuevoSaliente.ubicacion?.direccion_destino ?? null,
        url_mapa: this.nuevoSaliente.ubicacion?.url_mapa ?? null,
        lat: this.nuevoSaliente.ubicacion?.lat ?? null,
        lon: this.nuevoSaliente.ubicacion?.lon ?? null,
      }, idCong).subscribe({
        next: (nuevo) => {
          const d = this.mesDatos();
          if (!d) return;
          this.mesDatos.set({ ...d, salientes: [...d.salientes, nuevo] });
        },
        error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al añadir saliente'),
      });
    };

    // Solo verificar conflicto si hay publicador seleccionado
    if (!this.nuevoSaliente.id_publicador) {
      doCrear();
      return;
    }

    const pub = this.publicadores().find(p => p.id_publicador === this.nuevoSaliente.id_publicador);
    const nombre = pub?.nombre_completo ?? 'Este publicador';

    this.conflictosSvc
      .confirmarSiHayConflicto(this.nuevoSaliente.id_publicador, this.nuevoSaliente.fecha, idCong, nombre)
      .subscribe((proceder) => { if (proceder) doCrear(); });
  }
}

