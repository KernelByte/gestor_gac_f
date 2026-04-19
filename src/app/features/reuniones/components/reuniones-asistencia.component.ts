import { Component, signal, computed, inject, effect, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AsistenciaService, CongregacionConfig } from '../services/asistencia.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  Periodo, AsistenciaRecord, AsistenciaUpsert,
  ResumenMensualAsistencia, FechaSemanaReunion,
} from '../models/asistencia.models';
import { lastValueFrom } from 'rxjs';
import { saveAs } from 'file-saver';

@Component({
  standalone: true,
  selector: 'app-reuniones-asistencia',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col gap-2 md:gap-3 2xl:gap-4 h-full overflow-hidden">

      <!-- Toast -->
      @if (toast()) {
        <div class="fixed bottom-24 left-1/2 -translate-x-1/2 md:bottom-auto md:top-6 md:left-auto md:right-6 md:translate-x-0 md:max-w-xs z-50 animate-toastIn flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl backdrop-blur-xl"
             [class]="toast()!.type === 'success'
               ? 'bg-emerald-50/90 dark:bg-emerald-950/90 border-emerald-200/50 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
               : 'bg-red-50/90 dark:bg-red-950/90 border-red-200/50 dark:border-red-500/30 text-red-800 dark:text-red-200'">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
               [class]="toast()!.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-red-100 dark:bg-red-500/20'">
            @if (toast()!.type === 'success') {
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            } @else {
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            }
          </div>
          <span class="text-sm font-bold tracking-tight">{{ toast()!.message }}</span>
        </div>
      }

      <!-- Toolbar: month selector + desktop actions -->
      <div class="shrink-0 relative z-20 flex items-center justify-between gap-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-200/60 dark:border-slate-800 shadow-sm px-3 sm:px-4 py-2.5">
        <div class="flex items-center gap-1 bg-slate-50 dark:bg-slate-950/50 rounded-xl p-0.5">
          <button (click)="prevMonth()" class="press-btn p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>
          </button>

          <div class="flex items-center">
            <!-- Year -->
            <div class="relative" (click)="$event.stopPropagation()">
              <button (click)="toggleYearDrop()" class="dropdown-trigger flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-black text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800">
                {{ selectedYear() }}
                <svg class="w-3.5 h-3.5 text-slate-400 chevron" [class.rotate-180]="yearDropOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              @if (yearDropOpen()) {
                <div class="dropdown-panel absolute top-full left-0 mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1.5 min-w-[100px]">
                  @for (a of anos; track a; let i = $index) {
                    <button (click)="selectedYear.set(a); yearDropOpen.set(false)"
                            class="dropdown-item w-full text-left px-3 py-2 text-sm font-bold"
                            [class.text-brand-purple]="a === +selectedYear()"
                            [class.text-slate-600]="a !== +selectedYear()"
                            [class.dark:text-slate-300]="a !== +selectedYear()"
                            [class.hover:bg-slate-50]="true"
                            [class.dark:hover:bg-slate-800]="true"
                            [style.transition-delay]="i * 15 + 'ms'">
                      {{ a }}
                    </button>
                  }
                </div>
              }
            </div>
            <!-- Month -->
            <div class="relative" (click)="$event.stopPropagation()">
              <button (click)="toggleMonthDrop()" class="dropdown-trigger flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-black text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-800">
                {{ mesLabel() }}
                <svg class="w-3.5 h-3.5 text-slate-400 chevron" [class.rotate-180]="monthDropOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              @if (monthDropOpen()) {
                <div class="dropdown-panel absolute top-full left-0 mt-1.5 z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl py-1.5 min-w-[140px] max-h-[300px] overflow-y-auto custom-scrollbar">
                  @for (m of meses; track m.value; let i = $index) {
                    <button (click)="selectedMonth.set(m.value); selectedWeek.set(1); monthDropOpen.set(false)"
                            class="dropdown-item w-full text-left px-3 py-2 text-sm font-bold"
                            [class.text-brand-purple]="m.value === +selectedMonth()"
                            [class.text-slate-600]="m.value !== +selectedMonth()"
                            [class.dark:text-slate-300]="m.value !== +selectedMonth()"
                            [class.hover:bg-slate-50]="true"
                            [class.dark:hover:bg-slate-800]="true"
                            [style.transition-delay]="i * 15 + 'ms'">
                      {{ m.label }}
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <button (click)="nextMonth()" class="press-btn p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        <!-- Header Actions Desktop (md+) -->
        <div class="hidden md:flex items-center gap-2">
          <button (click)="onExportPdf()" [disabled]="!currentPeriodo() || loading()"
                  class="press-btn h-10 px-4 flex items-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-black text-xs disabled:opacity-40">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
            PDF
          </button>
          <button (click)="onSave()" *ngIf="hasEditPermission()" [disabled]="saving() || !currentPeriodo() || loading() || !hasChanges()"
                  class="press-btn h-10 px-6 bg-brand-purple hover:bg-purple-800 text-white rounded-xl font-black text-xs shadow-lg shadow-purple-900/20 disabled:opacity-50">
            @if (saving()) { <span>Guardando...</span> } @else { <span>Guardar</span> }
          </button>
        </div>
      </div>

      <!-- Mobile Segmented Tabs (< md) -->
      <div class="md:hidden shrink-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/60 dark:border-slate-800 rounded-2xl p-1 shadow-sm">
        <div class="relative grid grid-cols-3">
          <div class="absolute inset-y-0 left-0 w-1/3 bg-brand-purple rounded-xl shadow-md shadow-purple-900/25 segmented-indicator"
               [style.transform]="'translateX(' + indicatorPosition() + '%)'"></div>
          <button (click)="setMobileTab('registro')"
                  class="relative z-10 h-9 flex items-center justify-center text-[0.65rem] font-black uppercase tracking-widest transition-colors duration-200"
                  [class.text-white]="activeMobileTab() === 'registro'"
                  [class.text-slate-500]="activeMobileTab() !== 'registro'"
                  [class.dark:text-slate-400]="activeMobileTab() !== 'registro'">Registro</button>
          <button (click)="setMobileTab('resumen')"
                  class="relative z-10 h-9 flex items-center justify-center text-[0.65rem] font-black uppercase tracking-widest transition-colors duration-200"
                  [class.text-white]="activeMobileTab() === 'resumen'"
                  [class.text-slate-500]="activeMobileTab() !== 'resumen'"
                  [class.dark:text-slate-400]="activeMobileTab() !== 'resumen'">Resumen</button>
          <button (click)="setMobileTab('historial')"
                  class="relative z-10 h-9 flex items-center justify-center text-[0.65rem] font-black uppercase tracking-widest transition-colors duration-200"
                  [class.text-white]="activeMobileTab() === 'historial'"
                  [class.text-slate-500]="activeMobileTab() !== 'historial'"
                  [class.dark:text-slate-400]="activeMobileTab() !== 'historial'">Historial</button>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="flex-1 min-h-0 overflow-hidden
                  grid gap-3 md:gap-4 2xl:gap-6
                  grid-cols-1
                  md:grid-cols-2 md:grid-rows-[auto_1fr]
                  xl:grid-cols-[1fr_340px_280px] xl:grid-rows-1
                  pb-24 md:pb-0">

        <!-- REGISTRO CARD — md: row1 col1 · xl: col2 (middle) -->
        <div class="md:flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-4 lg:p-5 relative overflow-hidden min-h-0 md:order-1 xl:order-2"
             [class.flex]="activeMobileTab() === 'registro'"
             [class.hidden]="activeMobileTab() !== 'registro'">

          @if (!currentPeriodo() && !loading()) {
            <div class="absolute inset-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-6 text-center">
              <div class="max-w-xs animate-fadeIn">
                <p class="text-lg font-black text-slate-800 dark:text-white mb-2">Período no disponible</p>
                <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Selecciona un mes configurado en el sistema para comenzar el registro.</p>
              </div>
            </div>
          }

          <!-- Weekly Navigator -->
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-5 shrink-0">
            <div class="flex items-center gap-3">
              <div class="hidden lg:flex w-10 h-10 rounded-2xl bg-brand-purple/10 items-center justify-center text-brand-purple shrink-0">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <div>
                <h3 class="text-base lg:text-lg font-black text-slate-900 dark:text-white tracking-tight">Registro de Asistencia</h3>
                <p class="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest mt-0.5">Semana {{ selectedWeek() }}</p>
              </div>
            </div>

            <div class="flex bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-2xl w-full sm:w-auto overflow-x-auto custom-scrollbar">
              @for (week of weeksArray(); track week) {
                <button (click)="selectWeek(week)"
                        class="press-btn shrink-0 h-9 px-3 rounded-xl text-xs font-black relative"
                        [ngClass]="selectedWeek() === week ? 'bg-white dark:bg-slate-700 text-brand-purple shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'">
                  S{{ week }}
                  @if (weekHasData(week)) { <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500"></span> }
                </button>
              }
            </div>
          </div>

          <!-- Entry Fields: on mobile only the closest meeting section shows; md+ shows both -->
          <div class="flex-1 min-h-0 flex flex-col gap-0">

            <!-- MIDWEEK: hidden on mobile when weekend is closer; always shown md+ -->
            <div class="md:flex flex-col gap-3 pb-4"
                 [class.flex]="activeMeetingSection() === 'midweek'"
                 [class.hidden]="activeMeetingSection() !== 'midweek'">
              <div class="flex justify-between items-end">
                <div>
                  <h4 class="text-[0.65rem] font-black text-brand-purple uppercase tracking-[0.2em] mb-1">Entre Semana</h4>
                  <div class="flex items-center gap-2">
                     <p class="text-xl font-black text-slate-900 dark:text-white leading-none tabular-nums">{{ currentMidweekTotal() }}</p>
                     <span class="text-[0.6rem] font-bold text-slate-400">Asistentes</span>
                  </div>
                </div>
                @if (nextMidweekDate()) {
                   <span class="text-[0.6rem] font-bold px-2 py-1 rounded-lg" [class]="nextMidweekDate()!.isToday ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'">{{ nextMidweekDate()!.isToday ? 'HOY' : nextMidweekDate()!.label }}</span>
                }
              </div>

              <div class="grid gap-3" [class.grid-cols-2]="congregacionConfig()?.usa_zoom !== 0">
                <div class="flex flex-col gap-1.5">
                   <label class="text-[0.6rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Presencial</label>
                   <input type="number" min="0" inputmode="numeric" [ngModel]="midweekWeeks()[selectedWeek() - 1]" (ngModelChange)="updateMidweekWeek($event)" [disabled]="!hasEditPermission() || !currentPeriodo()" class="attendance-input attendance-input--purple" placeholder="0">
                </div>
                @if (congregacionConfig()?.usa_zoom !== 0) {
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[0.6rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Zoom</label>
                    <input type="number" min="0" inputmode="numeric" [ngModel]="midweekZoomWeeks()[selectedWeek() - 1]" (ngModelChange)="updateMidweekZoomWeek($event)" [disabled]="!hasEditPermission() || !currentPeriodo()" class="attendance-input attendance-input--purple" placeholder="0">
                  </div>
                }
              </div>
            </div>

            <!-- Divider: only shown on md+ when both sections are visible -->
            <div class="hidden md:block h-px bg-slate-100 dark:bg-slate-800 my-4 shrink-0"></div>

            <!-- WEEKEND: hidden on mobile when midweek is closer; always shown md+ -->
            <div class="md:flex flex-col gap-3"
                 [class.flex]="activeMeetingSection() === 'weekend'"
                 [class.hidden]="activeMeetingSection() !== 'weekend'">
              <div class="flex justify-between items-end">
                <div>
                  <h4 class="text-[0.65rem] font-black text-orange-500 uppercase tracking-[0.2em] mb-1">Fin de Semana</h4>
                  <div class="flex items-center gap-2">
                     <p class="text-xl font-black text-slate-900 dark:text-white leading-none tabular-nums">{{ currentWeekendTotal() }}</p>
                     <span class="text-[0.6rem] font-bold text-slate-400">Asistentes</span>
                  </div>
                </div>
                @if (nextWeekendDate()) {
                   <span class="text-[0.6rem] font-bold px-2 py-1 rounded-lg" [class]="nextWeekendDate()!.isToday ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'">{{ nextWeekendDate()!.isToday ? 'HOY' : nextWeekendDate()!.label }}</span>
                }
              </div>

              <div class="grid gap-3" [class.grid-cols-2]="congregacionConfig()?.usa_zoom !== 0">
                <div class="flex flex-col gap-1.5">
                   <label class="text-[0.6rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Presencial</label>
                   <input type="number" min="0" inputmode="numeric" [ngModel]="weekendWeeks()[selectedWeek() - 1]" (ngModelChange)="updateWeekendWeek($event)" [disabled]="!hasEditPermission() || !currentPeriodo()" class="attendance-input attendance-input--orange" placeholder="0">
                </div>
                @if (congregacionConfig()?.usa_zoom !== 0) {
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[0.6rem] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest pl-1">Zoom</label>
                    <input type="number" min="0" inputmode="numeric" [ngModel]="weekendZoomWeeks()[selectedWeek() - 1]" (ngModelChange)="updateWeekendZoomWeek($event)" [disabled]="!hasEditPermission() || !currentPeriodo()" class="attendance-input attendance-input--orange" placeholder="0">
                  </div>
                }
              </div>
            </div>
          </div>
        </div>

        <!-- RESUMEN MENSUAL CARD — md: row1 col2 · xl: col3 (narrowest) -->
        <div class="md:flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm p-4 lg:p-5 min-h-0 overflow-hidden md:order-2 xl:order-3"
             [class.flex]="activeMobileTab() === 'resumen'"
             [class.hidden]="activeMobileTab() !== 'resumen'">
          <div class="flex items-center gap-3 mb-4 shrink-0">
            <div class="w-9 h-9 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div>
              <h3 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Resumen Mensual</h3>
              <p class="text-[0.6rem] font-black text-slate-400 uppercase tracking-widest mt-0.5">{{ mesLabel() }} {{ selectedYear() }}</p>
            </div>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            @for (week of weeksArray(); track week; let i = $index) {
              <div class="flex items-center justify-between px-4 py-2.5 rounded-2xl stagger-row"
                   [style.--row-index]="i"
                   [ngClass]="weekHasData(week) ? 'bg-emerald-50/50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-800/40 text-slate-400'">
                <span class="text-[0.65rem] font-black uppercase tracking-widest">Semana {{ week }}</span>
                <div class="flex items-center gap-1.5 tabular-nums text-xs font-black">
                  @if (weekData(week).midweek) {
                    <span class="text-brand-purple">{{ weekData(week).midweek }}</span>
                  } @else {
                    <span class="text-slate-300 dark:text-slate-700">·</span>
                  }
                  <span class="text-slate-300 dark:text-slate-700">/</span>
                  @if (weekData(week).weekend) {
                    <span class="text-orange-500">{{ weekData(week).weekend }}</span>
                  } @else {
                    <span class="text-slate-300 dark:text-slate-700">·</span>
                  }
                  @if (weekHasData(week)) {
                    <svg class="w-3.5 h-3.5 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  } @else {
                    <div class="w-3.5 h-3.5 ml-1 rounded-full border-2 border-slate-200 dark:border-slate-700"></div>
                  }
                </div>
              </div>
            }
          </div>

          <div class="grid grid-cols-2 gap-3 mt-4 shrink-0">
            <div class="bg-brand-purple/5 dark:bg-brand-purple/10 rounded-2xl p-3 border border-brand-purple/10 text-center">
              <p class="text-[0.55rem] font-black text-brand-purple uppercase tracking-widest mb-1">M. Semana</p>
              <p class="text-xl font-black text-slate-900 dark:text-white tabular-nums leading-none">{{ midweekMonthTotal() }}</p>
            </div>
            <div class="bg-orange-500/5 dark:bg-orange-500/10 rounded-2xl p-3 border border-orange-500/10 text-center">
              <p class="text-[0.55rem] font-black text-orange-500 uppercase tracking-widest mb-1">F. Semana</p>
              <p class="text-xl font-black text-slate-900 dark:text-white tabular-nums leading-none">{{ weekendMonthTotal() }}</p>
            </div>
          </div>
        </div>

        <!-- DESGLOSE ANUAL CARD — md: row2 full-width · xl: col1 (widest) -->
        <div class="md:flex flex-col bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/70 dark:border-slate-800 shadow-sm overflow-hidden md:col-span-2 md:order-3 xl:col-span-1 xl:order-1 min-h-0"
             [class.flex]="activeMobileTab() === 'historial'"
             [class.hidden]="activeMobileTab() !== 'historial'">
          <div class="px-4 lg:px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/20 shrink-0">
            <div>
              <h4 class="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Desglose Anual</h4>
              <p class="text-[0.6rem] font-black text-slate-400 mt-0.5 uppercase tracking-widest">Año {{ resumenServiceYear() }}</p>
            </div>
            <button (click)="onExportS88Pdf()" class="press-btn h-8 px-3 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-[0.65rem] font-black shadow-lg shadow-indigo-500/20">PDF S-88</button>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
            <table class="w-full text-[0.7rem] font-black">
              <thead class="bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th class="px-4 lg:px-5 py-3 text-left">Mes</th>
                  <th class="px-4 py-3 text-center text-brand-purple">M. Sem.</th>
                  <th class="px-4 py-3 text-center text-orange-500">F. Sem.</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                @for (row of resumenAnualHistorico(); track row.mes; let i = $index) {
                  <tr class="stagger-row hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      [style.--row-index]="i"
                      [class.bg-brand-purple/5]="+row.mes === +selectedMonth()">
                    <td class="px-4 lg:px-5 py-3 text-slate-700 dark:text-slate-200">{{ row.nombre_mes }}</td>
                    <td class="px-4 py-3 text-center text-sm tabular-nums text-brand-purple">{{ row.midweek_promedio ?? '–' }}</td>
                    <td class="px-4 py-3 text-center text-sm tabular-nums text-orange-500">{{ row.weekend_promedio ?? '–' }}</td>
                  </tr>
                }
                @empty {
                  <tr><td colspan="3" class="px-4 py-10 text-center text-slate-400 font-bold">Cargando historial...</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Mobile Sticky Action Bar (< md) -->
      <div class="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/50 dark:border-slate-800/80 p-2.5 flex gap-2.5 animate-fadeIn">
        <button (click)="onExportPdf()" [disabled]="!currentPeriodo() || loading()"
                class="press-btn flex-1 h-12 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-300 rounded-xl font-black text-sm">
          PDF
        </button>
        <button (click)="onSave()" *ngIf="hasEditPermission() && activeMobileTab() === 'registro'" [disabled]="saving() || !currentPeriodo() || loading() || !hasChanges()"
                class="press-btn flex-[2.5] h-12 bg-brand-purple text-white rounded-xl font-black text-sm shadow-xl shadow-purple-950/30">
          {{ saving() ? 'Guardando...' : 'Guardar Registro' }}
        </button>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .animate-fadeIn {
      animation: fadeIn 0.35s cubic-bezier(0.23, 1, 0.32, 1) forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .animate-toastIn {
      animation: toastIn 0.4s cubic-bezier(0.23, 1, 0.32, 1) forwards;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translate(-50%, 12px) scale(0.95); }
      to { opacity: 1; transform: translate(-50%, 0) scale(1); }
    }
    @media (min-width: 768px) {
      @keyframes toastIn {
        from { opacity: 0; transform: translate(0, -12px) scale(0.95); }
        to { opacity: 1; transform: translate(0, 0) scale(1); }
      }
    }

    /* Shared press feedback — Emil's scale(0.97) rule applied consistently */
    .press-btn {
      transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1),
                  background-color 200ms ease,
                  color 200ms ease,
                  opacity 200ms ease;
    }
    .press-btn:active:not(:disabled) { transform: scale(0.97); }

    .dropdown-trigger {
      transition: transform 150ms cubic-bezier(0.23, 1, 0.32, 1),
                  background-color 200ms ease;
    }
    .dropdown-trigger:active { transform: scale(0.97); }

    .chevron { transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1); }

    .dropdown-panel {
      transform-origin: top left;
      animation: dropdownIn 200ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
    }
    @keyframes dropdownIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    .dropdown-item {
      opacity: 0;
      animation: itemFadeIn 250ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
      transition: background-color 200ms ease, color 200ms ease;
    }
    @keyframes itemFadeIn {
      from { opacity: 0; transform: translateX(-4px); }
      to { opacity: 1; transform: translateX(0); }
    }

    /* Mobile segmented control indicator — clip-path-like slide */
    .segmented-indicator {
      transition: transform 250ms cubic-bezier(0.23, 1, 0.32, 1);
      will-change: transform;
    }

    /* Stagger animation for data-rich rows (Resumen + Desglose) */
    .stagger-row {
      opacity: 0;
      animation: rowFadeIn 260ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
      animation-delay: calc(var(--row-index, 0) * 30ms);
      transition: background-color 200ms ease;
    }
    @keyframes rowFadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Compact attendance input — 52px tall, 1.5rem font */
    .attendance-input {
      width: 100%;
      height: 3.25rem;
      background-color: #f8fafc;
      border: 3px solid transparent;
      border-radius: 1rem;
      text-align: center;
      font-size: 1.5rem;
      font-weight: 900;
      color: #0f172a;
      outline: none;
      transition: background-color 200ms ease,
                  border-color 200ms ease,
                  box-shadow 200ms cubic-bezier(0.23, 1, 0.32, 1),
                  transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
      box-shadow: inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
      -moz-appearance: textfield;
    }
    .attendance-input::-webkit-outer-spin-button,
    .attendance-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

    .attendance-input:focus {
      background-color: white;
      box-shadow: 0 12px 24px -8px rgba(0,0,0,0.08), inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
    }

    /* Lift-on-focus only on pointer devices (avoids jitter with touch keyboard) */
    @media (hover: hover) and (pointer: fine) {
      .attendance-input:focus { transform: translateY(-2px); }
    }

    .attendance-input--purple:hover:not(:disabled) { border-color: rgba(139, 92, 246, 0.2); }
    .attendance-input--purple:focus:not(:disabled) { border-color: #8b5cf6; }

    .attendance-input--orange:hover:not(:disabled) { border-color: rgba(249, 115, 22, 0.2); }
    .attendance-input--orange:focus:not(:disabled) { border-color: #f97316; }

    :host-context(.dark) .attendance-input {
      background-color: #0f172a;
      color: #f1f5f9;
      box-shadow: inset 0 2px 8px 0 rgb(0 0 0 / 0.4);
    }
    :host-context(.dark) .attendance-input:focus {
      background-color: #1e293b;
      box-shadow: 0 12px 32px -12px rgba(0,0,0,0.4), inset 0 2px 4px 0 rgb(0 0 0 / 0.05);
    }

    .attendance-input:disabled {
      opacity: 0.3;
      cursor: not-allowed;
      transform: none !important;
    }

    .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
    :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }

    /* Respect user's motion preference — keep opacity/color, remove transforms */
    @media (prefers-reduced-motion: reduce) {
      .animate-fadeIn,
      .animate-toastIn,
      .dropdown-panel,
      .dropdown-item,
      .stagger-row {
        animation-duration: 0.01ms !important;
        animation-delay: 0ms !important;
      }
      .press-btn,
      .dropdown-trigger,
      .chevron,
      .segmented-indicator,
      .attendance-input {
        transition-duration: 0.01ms !important;
      }
      .attendance-input:focus { transform: none; }
    }
  `]
})
export class ReunionesAsistenciaComponent implements OnInit {
  private asistenciaService = inject(AsistenciaService);
  private congregacionCtx = inject(CongregacionContextService);
  private store = inject(AuthStore);

  hasEditPermission = computed(() => {
    return this.store.hasPermission('reuniones.asistencia_editar') || !!this.store.user()?.roles?.includes('Secretario');
  });

  // ── Selection state ──
  selectedYear = signal<number>(this.defaultYear());
  selectedMonth = signal<number>(this.defaultMonth());
  selectedWeek = signal(1);

  // ── Mobile tab state ──
  activeMobileTab = signal<'registro' | 'resumen' | 'historial'>('registro');
  indicatorPosition = computed(() => {
    const tab = this.activeMobileTab();
    return tab === 'registro' ? 0 : tab === 'resumen' ? 100 : 200;
  });

  setMobileTab(tab: 'registro' | 'resumen' | 'historial'): void {
    this.activeMobileTab.set(tab);
  }

  // ── Loaded data ──
  periodos = signal<Periodo[]>([]);
  midweekRecord = signal<AsistenciaRecord | null>(null);
  weekendRecord = signal<AsistenciaRecord | null>(null);
  fechasReuniones = signal<FechaSemanaReunion[]>([]);
  resumenAnualHistorico = signal<ResumenMensualAsistencia[]>([]);
  congregacionConfig = signal<CongregacionConfig | null>(null);

  // ── Editable week arrays (5 slots) ──
  midweekWeeks = signal<(number | null)[]>([null, null, null, null, null]);
  weekendWeeks = signal<(number | null)[]>([null, null, null, null, null]);
  midweekZoomWeeks = signal<(number | null)[]>([null, null, null, null, null]);
  weekendZoomWeeks = signal<(number | null)[]>([null, null, null, null, null]);

  // ── UI state ──
  loading = signal(false);
  saving = signal(false);
  toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Dirty tracking ──
  private savedSnapshot = signal<{
    mwPres: (number | null)[];
    mwZoom: (number | null)[];
    wePres: (number | null)[];
    weZoom: (number | null)[];
  }>({ mwPres: [null, null, null, null, null], mwZoom: [null, null, null, null, null], wePres: [null, null, null, null, null], weZoom: [null, null, null, null, null] });

  // ── Reference data ──
  meses = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
  ];
  anos = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - 2 + i);

  resumenServiceYear = signal<number>(this.defaultResumenServiceYear());
  loadingResumen = signal(false);

  // ── Dropdown open states ──
  monthDropOpen = signal(false);
  yearDropOpen = signal(false);

  // Which meeting type is coming up soonest — used to focus mobile view
  activeMeetingSection = computed<'midweek' | 'weekend'>(() => {
    const cfg = this.congregacionConfig();
    if (!cfg?.dia_reunion_entre_semana || !cfg?.dia_reunion_fin_semana) return 'midweek';
    const mw = this.daysUntilDay(cfg.dia_reunion_entre_semana);
    const we = this.daysUntilDay(cfg.dia_reunion_fin_semana);
    return we <= mw ? 'weekend' : 'midweek';
  });

  private daysUntilDay(dayName: string): number {
    const target = this.DAY_MAP[dayName];
    if (target === undefined) return 7;
    return (target - new Date().getDay() + 7) % 7;
  }

  toggleMonthDrop(): void {
    const next = !this.monthDropOpen();
    this.monthDropOpen.set(next);
    this.yearDropOpen.set(false);
  }

  toggleYearDrop(): void {
    const next = !this.yearDropOpen();
    this.yearDropOpen.set(next);
    this.monthDropOpen.set(false);
  }

  @HostListener('document:click')
  onDocumentClick() {
    this.monthDropOpen.set(false);
    this.yearDropOpen.set(false);
  }

  // ── Computed ──
  currentPeriodo = computed(() => {
    const year = +this.selectedYear();
    const month = +this.selectedMonth();
    return this.periodos().find(p => p.codigo_ano === year && p.codigo_mes === month) ?? null;
  });

  mesLabel = computed(() => this.meses.find(m => m.value === +this.selectedMonth())?.label ?? '');

  midweekMonthTotal = computed(() => {
    const presencial = this.midweekWeeks().reduce((sum: number, v: number | null) => sum + (v ?? 0), 0);
    const zoom = this.midweekZoomWeeks().reduce((sum: number, v: number | null) => sum + (v ?? 0), 0);
    return presencial + zoom;
  });

  weekendMonthTotal = computed(() => {
    const presencial = this.weekendWeeks().reduce((sum: number, v: number | null) => sum + (v ?? 0), 0);
    const zoom = this.weekendZoomWeeks().reduce((sum: number, v: number | null) => sum + (v ?? 0), 0);
    return presencial + zoom;
  });

  currentMidweekTotal = computed(() => {
    const p = this.midweekWeeks()[this.selectedWeek() - 1] ?? 0;
    const z = this.midweekZoomWeeks()[this.selectedWeek() - 1] ?? 0;
    return p + z;
  });

  currentWeekendTotal = computed(() => {
    const p = this.weekendWeeks()[this.selectedWeek() - 1] ?? 0;
    const z = this.weekendZoomWeeks()[this.selectedWeek() - 1] ?? 0;
    return p + z;
  });

  midweekFilledCount = computed(() => {
    return this.midweekWeeks().filter((v, i) => {
      const p = v ?? 0;
      const z = this.midweekZoomWeeks()[i] ?? 0;
      return p + z > 0;
    }).length;
  });

  weekendFilledCount = computed(() => {
    return this.weekendWeeks().filter((v, i) => {
      const p = v ?? 0;
      const z = this.weekendZoomWeeks()[i] ?? 0;
      return p + z > 0;
    }).length;
  });

  private readonly DAY_MAP: Record<string, number> = {
    'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miercoles': 3,
    'Jueves': 4, 'Viernes': 5, 'Sabado': 6,
  };

  midweekWeekCount = computed(() => {
    const cfg = this.congregacionConfig();
    if (!cfg?.dia_reunion_entre_semana) return 5;
    return this.countDayOccurrences(+this.selectedYear(), +this.selectedMonth(), cfg.dia_reunion_entre_semana);
  });

  weekendWeekCount = computed(() => {
    const cfg = this.congregacionConfig();
    if (!cfg?.dia_reunion_fin_semana) return 5;
    return this.countDayOccurrences(+this.selectedYear(), +this.selectedMonth(), cfg.dia_reunion_fin_semana);
  });

  totalWeeksInMonth = computed(() => Math.max(this.midweekWeekCount(), this.weekendWeekCount()));
  weeksArray = computed(() => Array.from({ length: this.totalWeeksInMonth() }, (_, i) => i + 1));

  hasChanges = computed(() => {
    const snap = this.savedSnapshot();
    const arrEq = (a: (number | null)[], b: (number | null)[]) =>
      a.every((v, i) => (v ?? null) === (b[i] ?? null));
    return !arrEq(this.midweekWeeks(), snap.mwPres)
      || !arrEq(this.midweekZoomWeeks(), snap.mwZoom)
      || !arrEq(this.weekendWeeks(), snap.wePres)
      || !arrEq(this.weekendZoomWeeks(), snap.weZoom);
  });

  nextMidweekDate = computed(() => {
    const cfg = this.congregacionConfig();
    if (!cfg?.dia_reunion_entre_semana) return null;
    return this.calcNextMeetingDate(cfg.dia_reunion_entre_semana);
  });

  nextWeekendDate = computed(() => {
    const cfg = this.congregacionConfig();
    if (!cfg?.dia_reunion_fin_semana) return null;
    return this.calcNextMeetingDate(cfg.dia_reunion_fin_semana);
  });

  private calcNextMeetingDate(dayName: string): { label: string; isToday: boolean } | null {
    const targetDay = this.DAY_MAP[dayName];
    if (targetDay === undefined) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const next = new Date(today);
    const diff = (targetDay - today.getDay() + 7) % 7;
    next.setDate(today.getDate() + diff);
    const isToday = diff === 0;
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const dNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const label = isToday
      ? 'Hoy'
      : `${dNames[next.getDay()]} ${next.getDate()} ${meses[next.getMonth()]}`;
    return { label, isToday };
  }

  constructor() {
    effect(() => {
      const year = this.selectedYear();
      const month = this.selectedMonth();
      const congId = this.congregacionCtx.effectiveCongregacionId();
      const _periodos = this.periodos();
      if (congId && _periodos.length > 0) {
        this.loadData(+year, +month, congId);
      }
    });

    effect(() => {
      const max = this.totalWeeksInMonth();
      if (this.selectedWeek() > max) this.selectedWeek.set(max);
    });

    effect(() => {
      const anoServicio = this.resumenServiceYear();
      const congId = this.congregacionCtx.effectiveCongregacionId();
      if (congId) {
        this.loadResumenHistorico(anoServicio, congId);
      }
    });
  }

  ngOnInit(): void {
    this.asistenciaService.getPeriodos().subscribe({
      next: (periodos) => this.periodos.set(periodos),
      error: () => this.showToast('error', 'Error al cargar periodos'),
    });
    this.asistenciaService.getCongregacionConfig().subscribe({
      next: (cfg) => {
        this.congregacionConfig.set(cfg);
      },
      error: () => { },
    });
  }

  private loadData(year: number, month: number, congId: number): void {
    this.loading.set(true);

    const periodo = this.periodos().find(p => p.codigo_ano === year && p.codigo_mes === month);

    // Load fechas reuniones
    this.asistenciaService.getFechasReuniones(congId, year, month).subscribe({
      next: (res) => this.fechasReuniones.set(res.semanas),
      error: () => this.fechasReuniones.set([]),
    });

    if (periodo) {
      this.asistenciaService.getAsistencias(periodo.id_periodo, congId).subscribe({
        next: (items) => {
          const mw = items.find(i => i.asistencia_tipo_reunion === 1) || null;
          const we = items.find(i => i.asistencia_tipo_reunion === 2) || null;
          this.midweekRecord.set(mw);
          this.weekendRecord.set(we);
          this.updateWeekArrays(mw, we);
          this.loading.set(false);
        },
        error: () => {
          this.resetWeekArrays();
          this.loading.set(false);
        }
      });
    } else {
      this.resetWeekArrays();
      this.loading.set(false);
    }
  }

  private loadResumenHistorico(anoServicio: number, congId: number): void {
    this.loadingResumen.set(true);
    this.asistenciaService.getResumenAnual(congId, anoServicio).subscribe({
      next: (res) => {
        this.resumenAnualHistorico.set(res.meses);
        this.loadingResumen.set(false);
      },
      error: () => {
        this.resumenAnualHistorico.set([]);
        this.loadingResumen.set(false);
      }
    });
  }

  private updateWeekArrays(mw: AsistenciaRecord | null, we: AsistenciaRecord | null): void {
    const mwPres = [mw?.asistencia_semana_01 ?? null, mw?.asistencia_semana_02 ?? null, mw?.asistencia_semana_03 ?? null, mw?.asistencia_semana_04 ?? null, mw?.asistencia_semana_05 ?? null];
    const mwZoom = [mw?.asistencia_zoom_semana_01 ?? null, mw?.asistencia_zoom_semana_02 ?? null, mw?.asistencia_zoom_semana_03 ?? null, mw?.asistencia_zoom_semana_04 ?? null, mw?.asistencia_zoom_semana_05 ?? null];
    const wePres = [we?.asistencia_semana_01 ?? null, we?.asistencia_semana_02 ?? null, we?.asistencia_semana_03 ?? null, we?.asistencia_semana_04 ?? null, we?.asistencia_semana_05 ?? null];
    const weZoom = [we?.asistencia_zoom_semana_01 ?? null, we?.asistencia_zoom_semana_02 ?? null, we?.asistencia_zoom_semana_03 ?? null, we?.asistencia_zoom_semana_04 ?? null, we?.asistencia_zoom_semana_05 ?? null];

    this.midweekWeeks.set(mwPres);
    this.midweekZoomWeeks.set(mwZoom);
    this.weekendWeeks.set(wePres);
    this.weekendZoomWeeks.set(weZoom);

    // Save snapshot
    this.savedSnapshot.set({ mwPres: [...mwPres], mwZoom: [...mwZoom], wePres: [...wePres], weZoom: [...weZoom] });
  }

  private resetWeekArrays(): void {
    const clean = [null, null, null, null, null];
    this.midweekWeeks.set([...clean]);
    this.midweekZoomWeeks.set([...clean]);
    this.weekendWeeks.set([...clean]);
    this.weekendZoomWeeks.set([...clean]);
    this.savedSnapshot.set({ mwPres: [...clean], mwZoom: [...clean], wePres: [...clean], weZoom: [...clean] });
    this.midweekRecord.set(null);
    this.weekendRecord.set(null);
  }

  updateMidweekWeek(val: number): void {
    const arr = [...this.midweekWeeks()];
    arr[this.selectedWeek() - 1] = val;
    this.midweekWeeks.set(arr);
  }
  updateMidweekZoomWeek(val: number): void {
    const arr = [...this.midweekZoomWeeks()];
    arr[this.selectedWeek() - 1] = val;
    this.midweekZoomWeeks.set(arr);
  }
  updateWeekendWeek(val: number): void {
    const arr = [...this.weekendWeeks()];
    arr[this.selectedWeek() - 1] = val;
    this.weekendWeeks.set(arr);
  }
  updateWeekendZoomWeek(val: number): void {
    const arr = [...this.weekendZoomWeeks()];
    arr[this.selectedWeek() - 1] = val;
    this.weekendZoomWeeks.set(arr);
  }

  async onSave(): Promise<void> {
    const periodo = this.currentPeriodo();
    const congId = this.congregacionCtx.effectiveCongregacionId();
    if (!periodo || !congId || this.saving()) return;

    this.saving.set(true);
    try {
      const mwData: AsistenciaUpsert = {
        asistencia_tipo_reunion: 1,
        id_periodo_asistencia: periodo.id_periodo,
        id_congregacion_asistencia: congId,
        asistencia_semana_01: this.midweekWeeks()[0],
        asistencia_semana_02: this.midweekWeeks()[1],
        asistencia_semana_03: this.midweekWeeks()[2],
        asistencia_semana_04: this.midweekWeeks()[3],
        asistencia_semana_05: this.midweekWeeks()[4],
        asistencia_zoom_semana_01: this.midweekZoomWeeks()[0],
        asistencia_zoom_semana_02: this.midweekZoomWeeks()[1],
        asistencia_zoom_semana_03: this.midweekZoomWeeks()[2],
        asistencia_zoom_semana_04: this.midweekZoomWeeks()[3],
        asistencia_zoom_semana_05: this.midweekZoomWeeks()[4],
      };
      const weData: AsistenciaUpsert = {
        asistencia_tipo_reunion: 2,
        id_periodo_asistencia: periodo.id_periodo,
        id_congregacion_asistencia: congId,
        asistencia_semana_01: this.weekendWeeks()[0],
        asistencia_semana_02: this.weekendWeeks()[1],
        asistencia_semana_03: this.weekendWeeks()[2],
        asistencia_semana_04: this.weekendWeeks()[3],
        asistencia_semana_05: this.weekendWeeks()[4],
        asistencia_zoom_semana_01: this.weekendZoomWeeks()[0],
        asistencia_zoom_semana_02: this.weekendZoomWeeks()[1],
        asistencia_zoom_semana_03: this.weekendZoomWeeks()[2],
        asistencia_zoom_semana_04: this.weekendZoomWeeks()[3],
        asistencia_zoom_semana_05: this.weekendZoomWeeks()[4],
      };

      await lastValueFrom(this.asistenciaService.upsertAsistencia(mwData));
      await lastValueFrom(this.asistenciaService.upsertAsistencia(weData));

      this.showToast('success', 'Asistencia guardada correctamente');
      this.loadData(+this.selectedYear(), +this.selectedMonth(), congId);
      this.loadResumenHistorico(this.resumenServiceYear(), congId);
    } catch {
      this.showToast('error', 'Error al guardar asistencia');
    } finally {
      this.saving.set(false);
    }
  }

  onExportPdf(): void {
    const p = this.currentPeriodo();
    const cId = this.congregacionCtx.effectiveCongregacionId();
    if (!p || !cId) return;
    this.asistenciaService.exportarPdf(cId, p.id_periodo).subscribe({
      next: (blob) => saveAs(blob, `Asistencia_${this.mesLabel()}_${this.selectedYear()}.pdf`),
      error: () => this.showToast('error', 'Error al generar PDF'),
    });
  }

  onExportS88Pdf(): void {
    const cId = this.congregacionCtx.effectiveCongregacionId();
    if (!cId) return;
    this.asistenciaService.exportarS88Pdf(cId, this.resumenServiceYear()).subscribe({
      next: (blob) => saveAs(blob, `S88_Anual_${this.resumenServiceYear()}.pdf`),
      error: () => this.showToast('error', 'Error al generar S-88'),
    });
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    setTimeout(() => this.toast.set(null), 3000);
  }

  private defaultYear(): number { return new Date().getFullYear(); }
  private defaultMonth(): number { return new Date().getMonth() + 1; }
  private defaultResumenServiceYear(): number {
    const now = new Date();
    return now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
  }

  prevMonth(): void {
    let m = +this.selectedMonth() - 1;
    let y = +this.selectedYear();
    if (m < 1) { m = 12; y--; }
    this.selectedMonth.set(m);
    this.selectedYear.set(y);
  }

  nextMonth(): void {
    let m = +this.selectedMonth() + 1;
    let y = +this.selectedYear();
    if (m > 12) { m = 1; y++; }
    this.selectedMonth.set(m);
    this.selectedYear.set(y);
  }

  selectWeek(w: number): void { this.selectedWeek.set(w); }

  weekHasData(w: number): boolean {
    const i = w - 1;
    return !!(this.midweekWeeks()[i] || this.midweekZoomWeeks()[i] || this.weekendWeeks()[i] || this.weekendZoomWeeks()[i]);
  }

  private countDayOccurrences(year: number, month: number, dayName: string): number {
    const target = this.DAY_MAP[dayName];
    if (target === undefined) return 5;
    let count = 0;
    const date = new Date(year, month - 1, 1);
    while (date.getMonth() === month - 1) {
      if (date.getDay() === target) count++;
      date.setDate(date.getDate() + 1);
    }
    return count;
  }

  weekData(w: number): { midweek: number; weekend: number } {
     const i = w - 1;
     return {
       midweek: (this.midweekWeeks()[i] ?? 0) + (this.midweekZoomWeeks()[i] ?? 0),
       weekend: (this.weekendWeeks()[i] ?? 0) + (this.weekendZoomWeeks()[i] ?? 0)
     };
  }
}
