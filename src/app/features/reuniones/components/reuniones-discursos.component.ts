import {
  Component, signal, computed, inject, OnInit, effect, untracked,
} from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, switchMap, EMPTY } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { TimePickerComponent } from '../../../shared/components/time-picker/time-picker.component';
import { UbicacionPickerComponent } from './ubicacion-picker.component';
import { DiscursosService } from '../services/discursos.service';
import { ConflictosService } from '../services/conflictos.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  CrearTemaRequest,
  DiscursoEntranteOut,
  DiscursosMesOut,
  DiscursoSalienteOut,
  EditarTemaRequest,
  GrupoSimple,
  MesDiscursosDisponible,
  MESES_ES,
  PublicadorSimple,
  TemaPublicador,
  UbicacionSaliente,
} from '../models/discursos.models';

type Estado = 'idle' | 'loading' | 'ready' | 'error';
type SubTab = 'entrantes' | 'salientes' | 'temas';

@Component({
  selector: 'app-reuniones-discursos',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, TimePickerComponent, UbicacionPickerComponent],
  template: `
    <div class="flex flex-col h-full gap-0">

      <!-- PAGE HEADER -->
      <div class="shrink-0 flex items-center justify-between gap-3 pb-3">
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
            Discursos Públicos
          </h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 min-h-[1rem] truncate">Salientes · Entrantes · Hospitalidad</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0 md:hidden">
          @if (!mesDatos() && hasEditPermission()) {
            <button (click)="abrirModalGenerar()" [disabled]="estado() === 'loading'"
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
        <aside class="hidden md:flex md:w-60 lg:w-64 xl:w-72 2xl:w-80 shrink-0 flex-col gap-3 overflow-y-auto simple-scrollbar p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">

          @if (mesesDisponibles().length > 0) {
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between px-1 pb-0.5">
                <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Meses programados</p>
                <span class="min-w-[1.25rem] h-4 px-1 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 text-[0.6rem] font-black flex items-center justify-center">{{ mesesDisponibles().length }}</span>
              </div>
              <div class="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                <div class="flex flex-col gap-0.5 p-1.5">
                  @for (m of mesesDisponibles(); track m.ano + '-' + m.mes) {
                    <div class="flex items-center gap-1">
                      <button (click)="cargarMes(m.ano, m.mes)" [disabled]="estado() === 'loading'"
                        class="flex-1 flex items-center justify-between px-2.5 h-10 rounded-lg text-slate-700 dark:text-slate-200 text-xs font-medium transition-all hover:bg-violet-50 dark:hover:bg-violet-900/20 active:scale-[0.98] disabled:opacity-40 group">
                        <span class="flex items-center gap-1.5">
                          @if (m.confirmado) {
                            <svg class="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                          }
                          {{ mesLabel(m.ano, m.mes) }}
                        </span>
                        <svg class="w-3 h-3 text-slate-400 group-hover:text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                      </button>
                      <button (click)="descargarPdf('entrantes', m.ano, m.mes, $event)" [disabled]="descargandoPdf()"
                        title="PDF Entrantes" aria-label="Descargar PDF Entrantes"
                        class="shrink-0 w-9 h-9 flex flex-col items-center justify-center gap-0.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 hover:text-blue-700 transition-all active:scale-95 disabled:opacity-40">
                        <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                        <span class="text-[0.45rem] font-black leading-none uppercase tracking-wide">Ent</span>
                      </button>
                      <button (click)="descargarPdf('salientes', m.ano, m.mes, $event)" [disabled]="descargandoPdf()"
                        title="PDF Salientes" aria-label="Descargar PDF Salientes"
                        class="shrink-0 w-9 h-9 flex flex-col items-center justify-center gap-0.5 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-500 hover:text-violet-700 transition-all active:scale-95 disabled:opacity-40">
                        <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                        <span class="text-[0.45rem] font-black leading-none uppercase tracking-wide">Sal</span>
                      </button>
                    </div>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Generar Mes -->
          @if (hasEditPermission()) {
            <div class="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-800/60 shrink-0">
              <button (click)="abrirModalGenerar()" [disabled]="estado() === 'loading'"
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
            <!-- Right: Temas button (always visible, independent of month) -->
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
          </div>

          @if (subTab() === 'temas') {
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
                  <button (click)="abrirModalGenerar()"
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
                    <div class="flex items-center gap-2">
                      <button (click)="cargarMes(m.ano, m.mes)" [disabled]="estado() === 'loading'"
                        class="flex-1 flex items-center justify-between px-4 h-12 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-800 dark:text-slate-100 text-sm font-medium transition-[transform,background-color] duration-150 ease-out active:scale-[0.98] disabled:opacity-40 border border-slate-200 dark:border-slate-700">
                        <span class="flex items-center gap-2">
                          @if (m.confirmado) {
                            <svg class="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                          }
                          {{ mesLabel(m.ano, m.mes) }}
                        </span>
                        <svg class="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                      </button>
                      <button (click)="descargarPdf('entrantes', m.ano, m.mes, $event)" [disabled]="descargandoPdf()"
                        title="PDF Entrantes"
                        class="shrink-0 w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 text-blue-600 transition-[transform,background-color] duration-150 ease-out active:scale-[0.97] flex items-center justify-center disabled:opacity-40 border border-blue-200 dark:border-blue-800/50">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                      </button>
                    </div>
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
                  @for (entrante of mesDatos()!.entrantes; track entrante.id_discurso_entrante) {
                    <div class="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden transition-colors"
                      [class]="isEditandoEntrante(entrante.id_discurso_entrante)
                        ? 'border-amber-400 dark:border-amber-500'
                        : 'border-slate-200 dark:border-slate-700'">
                      <!-- fecha header -->
                      <div class="bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
                        <svg class="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span class="text-sm font-black text-slate-800 dark:text-slate-200">{{ formatFecha(entrante.fecha) }}</span>
                        @if (entrante.confirmado) {
                          @if (isEditandoEntrante(entrante.id_discurso_entrante)) {
                            <button (click)="toggleEditEntrante(entrante.id_discurso_entrante)"
                              class="ml-auto flex items-center gap-1.5 px-3 h-6 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[0.65rem] font-bold transition-all active:scale-95">
                              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                              Guardar
                            </button>
                          } @else {
                            <span class="ml-auto text-[0.6rem] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">Confirmado</span>
                            @if (hasEditPermission()) {
                              <button (click)="toggleEditEntrante(entrante.id_discurso_entrante)" title="Editar"
                                class="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-500 transition-all active:scale-95">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </button>
                            }
                          }
                        }
                      </div>
                      <!-- fields -->
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 p-3 sm:p-4">
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Discurso / Tema</label>
                          <input type="text"
                            [value]="entrante.titulo_discurso ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (blur)="onEntranteChange(entrante, 'titulo_discurso', $event)"
                            placeholder="Título del discurso"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
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
                          <input type="text"
                            [value]="entrante.congregacion_origen ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (blur)="onEntranteChange(entrante, 'congregacion_origen', $event)"
                            placeholder="Congregación"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
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
                        <div class="ml-auto flex items-center gap-1">
                          @if (saliente.id_publicador) {
                            <button (click)="abrirWhatsapp(saliente)"
                              title="Notificar al orador por WhatsApp"
                              aria-label="Notificar al orador por WhatsApp"
                              class="w-9 h-9 rounded-lg flex items-center justify-center text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-95">
                              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
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
                          <input type="text"
                            [value]="saliente.congregacion_destino ?? ''"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            (blur)="onSalienteChange(saliente, 'congregacion_destino', $event)"
                            placeholder="Congregación destino"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
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
                          <input type="text"
                            [value]="saliente.tema_discurso ?? ''"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            (blur)="onSalienteChange(saliente, 'tema_discurso', $event)"
                            placeholder="Título del tema"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
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
          <h2 class="text-base font-black text-slate-900 dark:text-white">Generar Mes — Discursos Públicos</h2>

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
                <button (click)="genMes = m.v"
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
            <button (click)="generarMes()" [disabled]="estado() === 'loading'"
              class="px-4 h-9 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 text-xs font-bold text-white transition-all active:scale-95">
              Generar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL AÑADIR/EDITAR TEMA ===== -->
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
              <input type="text" [(ngModel)]="nuevoTema.titulo" placeholder="Ej. El amor de Dios hacia nosotros"
                class="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-[border-color,background-color] duration-150 ease-out w-full">
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
                    (click)="nuevoSaliente.id_publicador = null; nuevoSaliente.tema_discurso = ''; busquedaPublicador.set('')"
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
              <input type="text" [(ngModel)]="nuevoSaliente.congregacion_destino" placeholder="Nombre congregación"
                (blur)="autorellenarUbicacion()"
                class="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out w-full">
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
              @if (temasDelPublicadorSeleccionado().length > 0) {
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
              } @else {
                <input type="text" [(ngModel)]="nuevoSaliente.tema_discurso" placeholder="Título del discurso"
                  [disabled]="!nuevoSaliente.id_publicador"
                  class="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out w-full disabled:opacity-50 disabled:cursor-not-allowed">
                @if (!nuevoSaliente.id_publicador) {
                  <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1">Selecciona primero un publicador.</p>
                } @else {
                  <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1">Este publicador no tiene temas registrados.</p>
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
  grupos = signal<GrupoSimple[]>([]);
  publicadores = signal<PublicadorSimple[]>([]);
  descargandoPdf = signal(false);
  subTab = signal<SubTab>('entrantes');

  temas = signal<TemaPublicador[]>([]);
  loadingTemas = signal(false);
  temasLoaded = signal(false);
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

  modalGenerarVisible = signal(false);
  modalSalienteVisible = signal(false);

  busquedaPublicador = signal('');
  resultadosBusqueda = signal<PublicadorSimple[]>([]);
  buscandoPublicador = signal(false);
  mostrarDropdownBusqueda = signal(false);
  mostrarDropdownTemas = signal(false);
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
    const val = (event.target as HTMLInputElement).value.trim() || null;
    if ((entrante as any)[campo] === val) return;
    this.svc.editarEntrante(entrante.id_discurso_entrante, { [campo]: val }, this.idCong).subscribe({
      next: (updated) => this.updateEntrante(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
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
    const val = (event.target as HTMLInputElement).value.trim() || null;
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

  abrirModalSaliente(): void {
    this.nuevoSaliente = { fecha: '', id_publicador: null, congregacion_destino: '', tema_discurso: '', hora: '', ubicacion: null };
    this.ubicacionAutorellenada.set(false);
    this.busquedaPublicador.set('');
    this.resultadosBusqueda.set(this.publicadores());
    this.mostrarDropdownBusqueda.set(false);
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

  /** Al salir de "Congregación Destino", recupera la ubicación usada la última vez. */
  autorellenarUbicacion(): void {
    const nombre = this.nuevoSaliente.congregacion_destino?.trim();
    if (!nombre || this.nuevoSaliente.ubicacion || !this.idCong) return;
    this.svc.ubicacionSugerida(nombre, this.idCong).subscribe({
      next: (u) => {
        if (!u?.url_mapa || this.nuevoSaliente.ubicacion) return;
        this.nuevoSaliente.ubicacion = {
          direccion_destino: u.direccion_destino ?? null,
          url_mapa: u.url_mapa,
          lat: u.lat ?? null,
          lon: u.lon ?? null,
        };
        this.ubicacionAutorellenada.set(true);
      },
      error: () => {},
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

