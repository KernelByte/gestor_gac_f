import {
  Component, signal, computed, inject, OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiscursosService } from '../services/discursos.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  DiscursoEntranteOut,
  DiscursosMesOut,
  DiscursoSalienteOut,
  GrupoSimple,
  MesDiscursosDisponible,
  MESES_ES,
  PublicadorSimple,
} from '../models/discursos.models';

type Estado = 'idle' | 'loading' | 'ready' | 'error';
type SubTab = 'entrantes' | 'salientes';

@Component({
  selector: 'app-reuniones-discursos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col h-full gap-0">

      <!-- PAGE HEADER -->
      <div class="shrink-0 flex items-center justify-between gap-3 pb-3">
        <div class="min-w-0">
          <h1 class="text-xl sm:text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight truncate">
            Discursos Públicos
          </h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Salientes · Entrantes · Hospitalidad</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0 md:hidden">
          @if (hasEditPermission()) {
            <button (click)="abrirModalGenerar()" [disabled]="estado() === 'loading'"
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

      <!-- LAYOUT -->
      <div class="flex-1 min-h-0 flex flex-col md:flex-row gap-3 md:gap-4 overflow-hidden">

        <!-- SIDEBAR -->
        <aside class="hidden md:flex md:w-60 lg:w-64 xl:w-72 shrink-0 flex-col gap-3 overflow-y-auto simple-scrollbar py-0.5 pr-0.5">

          @if (hasEditPermission()) {
            <button (click)="abrirModalGenerar()" [disabled]="estado() === 'loading'"
              class="w-full flex items-center justify-center gap-2 px-4 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 text-xs font-bold text-white transition-all shadow-sm active:scale-95 shrink-0">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Generar Mes
            </button>
          }

          @if (mesesDisponibles().length > 0) {
            <div class="flex flex-col gap-1.5">
              <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 pb-0.5">Meses programados</p>
              @for (m of mesesDisponibles(); track m.ano + '-' + m.mes) {
                <div class="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <button (click)="cargarMes(m.ano, m.mes)" [disabled]="estado() === 'loading'"
                    class="flex-1 flex items-center justify-between px-2.5 h-9 text-slate-700 dark:text-slate-200 text-xs font-medium transition-all hover:bg-violet-50 dark:hover:bg-violet-900/20 active:scale-[0.98] disabled:opacity-40 group">
                    <span class="flex items-center gap-1.5">
                      @if (m.confirmado) {
                        <svg class="w-3 h-3 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                      }
                      {{ mesLabel(m.ano, m.mes) }}
                    </span>
                    <svg class="w-3 h-3 text-slate-400 group-hover:text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                  </button>
                  <!-- PDF entrantes -->
                  <button (click)="descargarPdf('entrantes', m.ano, m.mes, $event)" [disabled]="descargandoPdf()"
                    title="PDF Entrantes" class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-500 hover:text-blue-700 transition-all active:scale-95 disabled:opacity-40">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                  </button>
                  <!-- PDF salientes -->
                  <button (click)="descargarPdf('salientes', m.ano, m.mes, $event)" [disabled]="descargandoPdf()"
                    title="PDF Salientes" class="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-500 hover:text-violet-700 transition-all active:scale-95 disabled:opacity-40 mr-1">
                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                  </button>
                </div>
              }
            </div>
          }
        </aside>

        <!-- MAIN -->
        <div class="flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">

          @if (estado() === 'loading') {
            <div class="flex-1 flex items-center justify-center">
              <div class="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-violet-500 animate-spin"></div>
            </div>
          } @else if (!mesDatos()) {
            <div class="flex-1 flex flex-col items-center justify-center gap-4 text-center px-6">
              <div class="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center">
                <svg class="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
              </div>
              <div>
                <p class="text-sm font-bold text-slate-700 dark:text-slate-200">Sin programación seleccionada</p>
                <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Genera un mes o selecciona uno del historial</p>
              </div>
            </div>
          } @else {
            <!-- MES header -->
            <div class="shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="text-sm font-black text-slate-900 dark:text-white">{{ mesLabel(mesDatos()!.ano, mesDatos()!.mes) }}</p>
                <p class="text-[0.65rem] text-slate-400 mt-0.5">{{ mesDatos()!.fechas.length }} fecha(s) de fin de semana</p>
              </div>
              @if (hasEditPermission()) {
                <div class="flex items-center gap-1.5 shrink-0 flex-wrap">
                  @if (!mesDatos()!.confirmado) {
                    <button (click)="confirmarMes()" [disabled]="estado() === 'loading'"
                      class="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-xs font-bold text-white transition-all active:scale-95">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                      Confirmar
                    </button>
                  }
                  <button (click)="descargarPdf('entrantes', mesDatos()!.ano, mesDatos()!.mes, $event)" [disabled]="descargandoPdf()"
                    title="PDF Entrantes" class="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-bold text-white transition-all active:scale-95">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                    PDF Entrantes
                  </button>
                  <button (click)="descargarPdf('salientes', mesDatos()!.ano, mesDatos()!.mes, $event)" [disabled]="descargandoPdf()"
                    title="PDF Salientes" class="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-xs font-bold text-white transition-all active:scale-95">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                    PDF Salientes
                  </button>
                  <button (click)="borrarMes()" [disabled]="estado() === 'loading'"
                    class="flex items-center gap-1.5 px-3 h-8 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-xs font-bold text-white transition-all active:scale-95">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    Borrar
                  </button>
                </div>
              }
            </div>

            <!-- Sub-tab selector -->
            <div class="shrink-0 inline-flex items-center gap-1 bg-white dark:bg-[#1a1b26] rounded-xl p-1 shadow-sm border border-slate-200/60 dark:border-slate-800 self-start">
              <button (click)="subTab.set('entrantes')"
                class="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold transition-all duration-150 active:scale-[0.97]"
                [class]="subTab() === 'entrantes'
                  ? 'bg-[#2E5FA3] text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18M10 4v16"/></svg>
                Entrantes
              </button>
              <button (click)="subTab.set('salientes')"
                class="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-bold transition-all duration-150 active:scale-[0.97]"
                [class]="subTab() === 'salientes'
                  ? 'bg-[#2E5FA3] text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'">
                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                Salientes
              </button>
            </div>

            <!-- CONTENT area -->
            <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar">

              <!-- ENTRANTES -->
              @if (subTab() === 'entrantes') {
                <div class="flex flex-col gap-3">
                  @for (entrante of mesDatos()!.entrantes; track entrante.id_discurso_entrante) {
                    <div class="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden transition-colors"
                      [class]="isEditandoEntrante(entrante.id_discurso_entrante)
                        ? 'border-amber-400 dark:border-amber-500'
                        : 'border-slate-200 dark:border-slate-700'">
                      <!-- fecha header -->
                      <div class="bg-slate-50 dark:bg-slate-800/80 px-4 py-2 flex items-center gap-2">
                        <svg class="w-3.5 h-3.5 text-[#2E5FA3] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span class="text-xs font-black text-slate-800 dark:text-slate-200">{{ formatFecha(entrante.fecha) }}</span>
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
                                class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all active:scale-95">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </button>
                            }
                          }
                        }
                      </div>
                      <!-- fields -->
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Discurso / Tema</label>
                          <input type="text"
                            [value]="entrante.titulo_discurso ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (blur)="onEntranteChange(entrante, 'titulo_discurso', $event)"
                            placeholder="Título del discurso"
                            class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#2E5FA3] disabled:opacity-60 disabled:cursor-not-allowed transition-colors w-full">
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Orador</label>
                          <input type="text"
                            [value]="entrante.nombre_orador ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (blur)="onEntranteChange(entrante, 'nombre_orador', $event)"
                            placeholder="Nombre del orador"
                            class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#2E5FA3] disabled:opacity-60 disabled:cursor-not-allowed transition-colors w-full">
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Congregación Origen</label>
                          <input type="text"
                            [value]="entrante.congregacion_origen ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (blur)="onEntranteChange(entrante, 'congregacion_origen', $event)"
                            placeholder="Congregación"
                            class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#2E5FA3] disabled:opacity-60 disabled:cursor-not-allowed transition-colors w-full">
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Hospitalidad</label>
                          <select
                            [value]="entrante.id_grupo_hospitalidad ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (change)="onEntranteGrupoChange(entrante, $event)"
                            class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#2E5FA3] disabled:opacity-60 disabled:cursor-not-allowed transition-colors w-full">
                            <option value="">— Sin asignar —</option>
                            @for (g of grupos(); track g.id_grupo) {
                              <option [value]="g.id_grupo">{{ g.nombre_grupo }}</option>
                            }
                          </select>
                        </div>
                        <div class="flex flex-col gap-1 sm:col-span-2">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Notas</label>
                          <input type="text"
                            [value]="entrante.notas ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (blur)="onEntranteChange(entrante, 'notas', $event)"
                            placeholder="Notas adicionales"
                            class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-[#2E5FA3] disabled:opacity-60 disabled:cursor-not-allowed transition-colors w-full">
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- SALIENTES -->
              @if (subTab() === 'salientes') {
                <div class="flex flex-col gap-3">
                  @if (hasEditPermission() && !mesDatos()!.confirmado) {
                    <button (click)="abrirModalSaliente()"
                      class="self-start flex items-center gap-2 px-4 h-9 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all active:scale-95">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Añadir saliente
                    </button>
                  }

                  @if (mesDatos()!.salientes.length === 0) {
                    <div class="flex flex-col items-center justify-center py-12 text-center">
                      <p class="text-sm font-bold text-slate-500 dark:text-slate-400">Sin salientes programados</p>
                      <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Añade publicadores que salen a dar discursos</p>
                    </div>
                  }

                  @for (saliente of mesDatos()!.salientes; track saliente.id_discurso_saliente) {
                    <div class="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden transition-colors"
                      [class]="isEditandoSaliente(saliente.id_discurso_saliente)
                        ? 'border-amber-400 dark:border-amber-500'
                        : 'border-slate-200 dark:border-slate-700'">
                      <div class="bg-slate-50 dark:bg-slate-800/80 px-4 py-2 flex items-center gap-2">
                        <svg class="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                        <span class="text-xs font-black text-slate-800 dark:text-slate-200">{{ formatFecha(saliente.fecha) }}</span>
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
                                class="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all active:scale-95">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </button>
                            }
                          }
                        }
                        @if (hasEditPermission() && !saliente.confirmado) {
                          <button (click)="eliminarSaliente(saliente)"
                            class="ml-auto w-7 h-7 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 flex items-center justify-center transition-all active:scale-95">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        }
                      </div>
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Publicador</label>
                          <select
                            [value]="saliente.id_publicador ?? ''"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            (change)="onSalientePublicadorChange(saliente, $event)"
                            class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500 disabled:opacity-60 disabled:cursor-not-allowed w-full">
                            <option value="">— Sin asignar —</option>
                            @for (p of publicadores(); track p.id_publicador) {
                              <option [value]="p.id_publicador">{{ p.nombre_completo }}</option>
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
                            class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500 disabled:opacity-60 disabled:cursor-not-allowed w-full">
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Tema del Discurso</label>
                          <input type="text"
                            [value]="saliente.tema_discurso ?? ''"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            (blur)="onSalienteChange(saliente, 'tema_discurso', $event)"
                            placeholder="Título del tema"
                            class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500 disabled:opacity-60 disabled:cursor-not-allowed w-full">
                        </div>
                        <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Notas</label>
                          <input type="text"
                            [value]="saliente.notas ?? ''"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            (blur)="onSalienteChange(saliente, 'notas', $event)"
                            placeholder="Notas adicionales"
                            class="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500 disabled:opacity-60 disabled:cursor-not-allowed w-full">
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>

    <!-- ===== MODAL GENERAR MES ===== -->
    @if (modalGenerarVisible()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="cerrarModalGenerar()">
        <div class="bg-white dark:bg-[#1a1b26] rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4" (click)="$event.stopPropagation()">
          <h2 class="text-base font-black text-slate-900 dark:text-white">Generar Mes — Discursos Públicos</h2>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-bold text-slate-500">Mes</label>
              <select [(ngModel)]="genMes" class="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500">
                @for (m of MESES; track m.v) {
                  <option [value]="m.v">{{ m.l }}</option>
                }
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-bold text-slate-500">Año</label>
              <input type="number" [(ngModel)]="genAno" min="2020" max="2099" class="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500">
            </div>
          </div>
          <div class="flex gap-2 justify-end">
            <button (click)="cerrarModalGenerar()" class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button (click)="generarMes()" [disabled]="estado() === 'loading'"
              class="px-4 h-9 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 text-xs font-bold text-white transition-all active:scale-95">
              Generar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL AÑADIR SALIENTE ===== -->
    @if (modalSalienteVisible()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="cerrarModalSaliente()">
        <div class="bg-white dark:bg-[#1a1b26] rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4" (click)="$event.stopPropagation()">
          <h2 class="text-base font-black text-slate-900 dark:text-white">Añadir Saliente</h2>
          <div class="flex flex-col gap-3">
            <div class="flex flex-col gap-1">
              <label class="text-xs font-bold text-slate-500">Fecha</label>
              <select [(ngModel)]="nuevoSaliente.fecha" class="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500">
                <option value="">Seleccionar fecha</option>
                @for (f of mesDatos()!.fechas; track f) {
                  <option [value]="f">{{ formatFecha(f) }}</option>
                }
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-bold text-slate-500">Publicador</label>
              <select [(ngModel)]="nuevoSaliente.id_publicador" class="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500">
                <option [value]="null">— Sin asignar —</option>
                @for (p of publicadores(); track p.id_publicador) {
                  <option [value]="p.id_publicador">{{ p.nombre_completo }}</option>
                }
              </select>
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-bold text-slate-500">Congregación Destino</label>
              <input type="text" [(ngModel)]="nuevoSaliente.congregacion_destino" placeholder="Nombre congregación"
                class="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500">
            </div>
            <div class="flex flex-col gap-1">
              <label class="text-xs font-bold text-slate-500">Tema del Discurso</label>
              <input type="text" [(ngModel)]="nuevoSaliente.tema_discurso" placeholder="Título del discurso"
                class="h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500">
            </div>
          </div>
          <div class="flex gap-2 justify-end">
            <button (click)="cerrarModalSaliente()" class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button (click)="guardarSaliente()" [disabled]="!nuevoSaliente.fecha || estado() === 'loading'"
              class="px-4 h-9 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-xs font-bold text-white transition-all active:scale-95">
              Añadir
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ReunionesDiscursosComponent implements OnInit {
  private svc = inject(DiscursosService);
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

  modalGenerarVisible = signal(false);
  modalSalienteVisible = signal(false);

  editandoEntrantes = signal<Set<number>>(new Set());
  editandoSalientes = signal<Set<number>>(new Set());

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

  nuevoSaliente: { fecha: string; id_publicador: number | null; congregacion_destino: string; tema_discurso: string } = {
    fecha: '', id_publicador: null, congregacion_destino: '', tema_discurso: '',
  };

  private get idCong(): number | null {
    return this.congCtx.effectiveCongregacionId();
  }

  ngOnInit(): void {
    this.cargarMeses();
    this.cargarGrupos();
    this.cargarPublicadores();
  }

  hasEditPermission(): boolean {
    const user = this.auth.user();
    if (!user) return false;
    const rol = (user as any).rol ?? '';
    if (['Administrador', 'Secretario', 'Gestor Aplicación'].includes(rol)) return true;
    const permisos: string[] = (user as any).permisos ?? [];
    return permisos.includes('reuniones.fin_semana_editar');
  }

  mesLabel(ano: number, mes: number): string {
    return `${MESES_ES[mes - 1]} ${ano}`;
  }

  formatFecha(fechaStr: string): string {
    const d = new Date(fechaStr + 'T00:00:00');
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
  }

  private cargarMeses(): void {
    this.svc.getMeses(this.idCong).subscribe({
      next: (m) => this.mesesDisponibles.set(m),
      error: () => {},
    });
  }

  private cargarGrupos(): void {
    this.svc.getGrupos(this.idCong).subscribe({
      next: (g) => this.grupos.set(g),
      error: () => {},
    });
  }

  private cargarPublicadores(): void {
    this.svc.getPublicadores(this.idCong).subscribe({
      next: (p) => this.publicadores.set(p),
      error: () => {},
    });
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
    if (!confirm(`¿Eliminar toda la programación de discursos de ${this.mesLabel(d.ano, d.mes)}? Esta acción no se puede deshacer.`)) return;
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
    this.svc.editarEntrante(entrante.id_discurso_entrante, { [campo]: val }).subscribe({
      next: (updated) => this.updateEntrante(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  onEntranteGrupoChange(entrante: DiscursoEntranteOut, event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const id = val ? +val : null;
    this.svc.editarEntrante(entrante.id_discurso_entrante, { id_grupo_hospitalidad: id }).subscribe({
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
    this.svc.editarSaliente(saliente.id_discurso_saliente, { [campo]: val }).subscribe({
      next: (updated) => this.updateSaliente(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  onSalientePublicadorChange(saliente: DiscursoSalienteOut, event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const id = val ? +val : null;
    this.svc.editarSaliente(saliente.id_discurso_saliente, { id_publicador: id }).subscribe({
      next: (updated) => this.updateSaliente(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
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
    if (!confirm('¿Eliminar este saliente?')) return;
    this.svc.eliminarSaliente(saliente.id_discurso_saliente).subscribe({
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
  }

  abrirModalSaliente(): void {
    this.nuevoSaliente = { fecha: '', id_publicador: null, congregacion_destino: '', tema_discurso: '' };
    this.modalSalienteVisible.set(true);
  }

  cerrarModalSaliente(): void {
    this.modalSalienteVisible.set(false);
  }

  guardarSaliente(): void {
    if (!this.nuevoSaliente.fecha) return;
    this.cerrarModalSaliente();
    this.svc.crearSaliente({
      fecha: this.nuevoSaliente.fecha,
      id_publicador: this.nuevoSaliente.id_publicador,
      congregacion_destino: this.nuevoSaliente.congregacion_destino || null,
      tema_discurso: this.nuevoSaliente.tema_discurso || null,
    }, this.idCong).subscribe({
      next: (nuevo) => {
        const d = this.mesDatos();
        if (!d) return;
        this.mesDatos.set({ ...d, salientes: [...d.salientes, nuevo] });
      },
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al añadir saliente'),
    });
  }
}
