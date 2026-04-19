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
    <div class="flex flex-col gap-1.5 sm:gap-2 lg:gap-3 2xl:gap-4 h-full overflow-hidden">

      <!-- Toast — full-width bottom on mobile, top-right on sm+ -->
      @if (toast()) {
        <div class="fixed bottom-4 left-4 right-4 sm:bottom-auto sm:top-6 sm:left-auto sm:right-6 sm:max-w-xs z-50 toast-enter flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-lg"
             [class]="toast()!.type === 'success'
               ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/60 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
               : 'bg-red-50 dark:bg-red-900/20 border-red-200/60 dark:border-red-800/50 text-red-700 dark:text-red-300'">
          <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
               [class]="toast()!.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'">
            @if (toast()!.type === 'success') {
              <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
            } @else {
              <svg class="w-3.5 h-3.5 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            }
          </div>
          <span class="text-xs font-bold">{{ toast()!.message }}</span>
        </div>
      }



      <!-- Unified Main Grid -->
      <!-- Add pb-20 on mobile to leave space for the static bottom action bar -->
      <div class="flex flex-col xl:flex-row gap-4 sm:gap-6 xl:gap-8 flex-1 min-h-0 overflow-hidden pr-1 pb-20 sm:pb-4">

        <!-- LEFT PANEL: REGISTRO MENSUAL -->
        <div class="shrink-0 xl:flex-1 flex flex-col gap-2 sm:gap-3 xl:min-w-[500px] xl:overflow-hidden overflow-visible">
          <!-- Month/Year Navigator + Actions -->
      <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-2 sm:px-3 lg:px-4 2xl:px-5 py-1.5 lg:py-2.5 2xl:py-3">
        <!-- Date picker pill -->
        <div class="flex items-center gap-1 lg:gap-1.5">
          <button (click)="prevMonth()" class="p-1.5 lg:p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 [transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_160ms_cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]">
            <svg class="w-4 h-4 lg:w-5 lg:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>

          <!-- Custom Year Dropdown -->
          <div class="relative" (click)="$event.stopPropagation()">
            <button
              (click)="toggleYearDrop()"
              class="dropdown-trigger flex items-center gap-1.5 px-2.5 py-1.5 lg:px-3 lg:py-2 2xl:px-4 2xl:py-2.5 rounded-lg text-sm lg:text-base 2xl:text-lg font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/70">
              {{ selectedYear() }}
              <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4 text-slate-400 chevron" [class.rotate-180]="yearDropOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            @if (yearDropOpen()) {
              <div class="dropdown-panel absolute top-full left-0 mt-1.5 z-50 bg-white dark:bg-[#1e2535] border border-slate-200 dark:border-slate-600/60 rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40 py-1.5 min-w-[90px] overflow-hidden">
                @for (a of anos; track a; let i = $index) {
                  <button
                    (click)="selectedYear.set(a); yearDropOpen.set(false)"
                    class="dropdown-item w-full text-left px-3 py-1.5 text-sm font-semibold"
                    [style.--i]="i"
                    [class]="a === +selectedYear()
                      ? 'bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'">
                    {{ a }}
                  </button>
                }
              </div>
            }
          </div>

          <!-- Custom Month Dropdown -->
          <div class="relative" (click)="$event.stopPropagation()">
            <button
              (click)="toggleMonthDrop()"
              class="dropdown-trigger flex items-center gap-1.5 px-2.5 py-1.5 lg:px-3 lg:py-2 2xl:px-4 2xl:py-2.5 rounded-lg text-sm lg:text-base 2xl:text-lg font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700/70">
              {{ mesLabel() }}
              <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4 text-slate-400 chevron" [class.rotate-180]="monthDropOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg>
            </button>
            @if (monthDropOpen()) {
              <div class="dropdown-panel absolute top-full left-0 mt-1.5 z-50 bg-white dark:bg-[#1e2535] border border-slate-200 dark:border-slate-600/60 rounded-xl shadow-xl shadow-black/10 dark:shadow-black/40 py-1.5 min-w-[130px] overflow-hidden">
                @for (m of meses; track m.value; let i = $index) {
                  <button
                    (click)="selectedMonth.set(m.value); selectedWeek.set(1); monthDropOpen.set(false)"
                    class="dropdown-item w-full text-left px-3 py-1.5 text-sm font-semibold"
                    [style.--i]="i"
                    [class]="m.value === +selectedMonth()
                      ? 'bg-brand-purple/10 dark:bg-brand-purple/20 text-brand-purple'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'">
                    {{ m.label }}
                  </button>
                }
              </div>
            }
          </div>

          <button (click)="nextMonth()" class="p-1.5 lg:p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 [transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),transform_160ms_cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]">
            <svg class="w-4 h-4 lg:w-5 lg:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        <!-- Right Side: Status + Actions (Hidden on mobile, pushed to bottom bar) -->
        <div class="hidden sm:flex items-center gap-2">
          @if (loading()) {
            <div class="flex items-center gap-1.5 text-xs font-medium text-slate-400 mr-2">
              <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="30 70" stroke-linecap="round"/></svg>
              <span class="hidden sm:inline">Cargando...</span>
            </div>
          }

          <div class="flex items-center gap-2">
            <button (click)="onExportPdf()"
                    [disabled]="!currentPeriodo() || loading()"
                    class="inline-flex items-center gap-1.5 px-3 lg:px-4 2xl:px-5 h-8 lg:h-9 2xl:h-10 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs lg:text-sm shadow-sm [transition:transform_160ms_cubic-bezier(0.23,1,0.32,1),background-color_160ms_cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed">
              <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
              <span>PDF</span>
            </button>
            <button (click)="onSave()"
                    *ngIf="hasEditPermission()"
                    [disabled]="saving() || !currentPeriodo() || loading() || !hasChanges()"
                    class="inline-flex items-center justify-center gap-1.5 px-4 lg:px-5 2xl:px-6 h-8 lg:h-9 2xl:h-10 bg-brand-purple hover:bg-purple-800 text-white rounded-xl font-display font-bold text-xs lg:text-sm shadow-xl shadow-purple-900/20 [transition:transform_160ms_cubic-bezier(0.23,1,0.32,1),background-color_160ms_cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed">
              @if (saving()) {
                <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="30 70" stroke-linecap="round"/></svg>
                <span>Guardando...</span>
              } @else {
                <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span>Guardar</span>
              }
            </button>
          </div>
        </div>
      </div>

      <!-- SIDE-BY-SIDE CONTAINER FOR REGISTRO & ESTADISTICAS -->
      <div class="flex flex-col lg:flex-row items-stretch gap-2.5 shrink-0">
        
        <!-- REGISTRO SEMANAL -->
        <div class="flex-1 min-w-0 flex flex-col">

          <!-- Weekly Entry Card -->
          <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 sm:p-2.5 lg:p-4 2xl:p-5 flex flex-col h-full">

            <!-- Card Header -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 lg:gap-3 mb-2 lg:mb-3 border-b border-slate-100 dark:border-slate-700 pb-2 lg:pb-3 shrink-0">
              <div class="flex items-center gap-2 lg:gap-2.5">
                <div class="p-1.5 lg:p-2 2xl:p-2.5 rounded-lg bg-purple-50 dark:bg-purple-900/30 text-brand-purple">
                  <svg class="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <p class="text-base sm:text-lg lg:text-xl 2xl:text-2xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">Registro Semanal</p>
                </div>
              </div>

              <!-- Week Selector -->
              <div class="w-full sm:w-auto overflow-x-auto">
                <div class="flex bg-slate-50 dark:bg-slate-900/50 p-0.5 lg:p-1 rounded-lg w-fit min-w-full sm:min-w-0">
                  @for (week of weeksArray(); track week) {
                    <button
                      (click)="selectWeek(week)"
                      class="px-2.5 py-1 sm:py-1.5 lg:px-3.5 lg:py-2 2xl:px-4 2xl:py-2.5 rounded-md text-xs font-bold [transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1),color_150ms_cubic-bezier(0.23,1,0.32,1),box-shadow_150ms_cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] relative flex items-center justify-center min-w-[36px] lg:min-w-[44px]"
                      [ngClass]="{
                        'bg-white dark:bg-slate-800 text-brand-purple dark:text-purple-400 shadow-sm': selectedWeek() === week,
                        'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800': selectedWeek() !== week
                      }">
                      <span class="text-[0.65rem] lg:text-xs 2xl:text-sm font-bold tracking-wide">S{{ week }}</span>
                      @if (weekHasData(week)) {
                        <span class="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-emerald-400"></span>
                      }
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Mobile Meeting Toggle Switcher -->
            <div class="md:hidden flex bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl mt-3">
              <button (click)="activeMobileTab.set('midweek')"
                      class="flex-1 py-1.5 text-[0.65rem] sm:text-xs font-bold rounded-lg transition-all"
                      [ngClass]="activeMobileTab() === 'midweek' ? 'bg-white dark:bg-slate-800 text-brand-purple shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'">
                Entre Semana
              </button>
              <button (click)="activeMobileTab.set('weekend')"
                      class="flex-1 py-1.5 text-[0.65rem] sm:text-xs font-bold rounded-lg transition-all"
                      [ngClass]="activeMobileTab() === 'weekend' ? 'bg-white dark:bg-slate-800 text-orange-500 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'">
                Fin de Semana
              </button>
            </div>

            <!-- Grid with new layout -->
            <div class="flex-1 mt-1.5 lg:mt-3 flex flex-col md:grid md:grid-cols-2 lg:gap-x-8 2xl:gap-x-10 gap-x-4 gap-y-2 lg:gap-y-3 md:divide-x md:divide-slate-100 dark:md:divide-slate-700">

              <!-- MIDWEEK -->
              <div class="meeting-col meeting-col--midweek flex-col gap-1 lg:gap-2.5 lg:pr-5 2xl:pr-6 md:pr-3 h-full"
                   [ngClass]="activeMobileTab() === 'midweek' ? 'flex' : 'hidden md:flex'">

                <!-- Header block -->
                <div class="flex justify-between items-center">
                  <div class="flex flex-col">
                    <div class="flex items-center gap-1 lg:gap-1.5">
                      <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4 2xl:w-5 2xl:h-5 text-brand-purple" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      <h3 class="font-bold text-slate-800 dark:text-slate-100 text-xs lg:text-sm 2xl:text-base tracking-tight">Entre Semana</h3>
                    </div>
                     @if (nextMidweekDate()) { <span class="text-[0.6rem] lg:text-[0.7rem] 2xl:text-xs font-bold mt-0.5" [class]="nextMidweekDate()!.isToday ? 'text-emerald-500' : 'text-brand-purple'">{{ nextMidweekDate()!.isToday ? 'Hoy' : 'Próx: ' + nextMidweekDate()!.label }}</span> }
                  </div>
                  <div class="flex flex-col items-end leading-none">
                    <span class="text-[0.55rem] lg:text-[0.65rem] 2xl:text-xs font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
                    <span class="text-lg lg:text-2xl 2xl:text-3xl font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">{{ currentMidweekTotal() }}</span>
                  </div>
                </div>

                <!-- Inputs block -->
                <div class="flex-1 flex flex-col justify-end">
                  @if (selectedWeek() > midweekWeekCount()) {
                    <div class="flex items-center justify-center flex-1 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-700">
                      <span class="text-xs font-bold text-slate-400">Sin reunión esta semana</span>
                    </div>
                  } @else {
                    <div class="grid gap-1.5 lg:gap-2.5 2xl:gap-3" [class.grid-cols-2]="congregacionConfig()?.usa_zoom !== 0" [class.grid-cols-1]="congregacionConfig()?.usa_zoom === 0">

                      <!-- Presencial Card MIDWEEK -->
                      <div class="bg-slate-50 dark:bg-[#171923] border border-brand-purple/20 dark:border-brand-purple/40 rounded-xl p-2 lg:p-3 2xl:p-4 flex flex-col shadow-sm transition-colors hover:border-brand-purple/40 dark:hover:border-brand-purple/70 group">
                        <div class="flex items-center mb-1.5 lg:mb-2.5">
                          <label class="flex items-center gap-1 lg:gap-1.5 text-[0.65rem] lg:text-xs 2xl:text-sm font-semibold text-slate-500 dark:text-slate-400 group-focus-within:text-brand-purple transition-colors cursor-pointer">
                            <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            Presencial
                          </label>
                        </div>
                        <div class="mt-auto relative">
                          <input type="number" min="0" inputmode="numeric"
                                 [ngModel]="midweekWeeks()[selectedWeek() - 1]"
                                 (ngModelChange)="updateMidweekWeek($event)"
                                 [disabled]="!hasEditPermission()"
                                 class="block w-full attendance-input attendance-input--purple h-12 lg:h-14 2xl:h-16 text-xl lg:text-2xl 2xl:text-3xl placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                 placeholder="0">
                        </div>
                      </div>

                      <!-- Zoom Card -->
                      @if (congregacionConfig()?.usa_zoom !== 0) {
                        <div class="bg-slate-50 dark:bg-[#171923] border border-brand-purple/20 dark:border-brand-purple/40 rounded-xl p-2 lg:p-3 2xl:p-4 flex flex-col shadow-sm transition-colors hover:border-brand-purple/40 dark:hover:border-brand-purple/70 group">
                          <div class="flex items-center mb-1.5 lg:mb-2.5">
                            <label class="flex items-center gap-1 lg:gap-1.5 text-[0.65rem] lg:text-xs 2xl:text-sm font-semibold text-slate-500 dark:text-slate-400 group-focus-within:text-brand-purple transition-colors cursor-pointer">
                              <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                              Zoom
                            </label>
                          </div>
                          <div class="mt-auto relative">
                            <input type="number" min="0" inputmode="numeric"
                                   [ngModel]="midweekZoomWeeks()[selectedWeek() - 1]"
                                   (ngModelChange)="updateMidweekZoomWeek($event)"
                                   [disabled]="!hasEditPermission()"
                                   class="block w-full attendance-input attendance-input--purple h-12 lg:h-14 2xl:h-16 text-xl lg:text-2xl 2xl:text-3xl placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                   placeholder="0">
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>

              </div>


              <!-- WEEKEND -->
              <div class="meeting-col meeting-col--weekend flex-col gap-1 lg:gap-2.5 lg:pl-5 2xl:pl-6 md:pl-3 pt-2 md:pt-0 border-t border-slate-100 dark:border-slate-700 md:border-0 h-full"
                   [ngClass]="activeMobileTab() === 'weekend' ? 'flex' : 'hidden md:flex'">

                <!-- Header block -->
                <div class="flex justify-between items-center">
                  <div class="flex flex-col">
                    <div class="flex items-center gap-1 lg:gap-1.5">
                      <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4 2xl:w-5 2xl:h-5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <h3 class="font-bold text-slate-800 dark:text-slate-100 text-xs lg:text-sm 2xl:text-base tracking-tight">Fin de Semana</h3>
                    </div>
                     @if (nextWeekendDate()) { <span class="text-[0.6rem] lg:text-[0.7rem] 2xl:text-xs font-bold mt-0.5" [class]="nextWeekendDate()!.isToday ? 'text-emerald-500' : 'text-orange-500'">{{ nextWeekendDate()!.isToday ? 'Hoy' : 'Próx: ' + nextWeekendDate()!.label }}</span> }
                  </div>
                  <div class="flex flex-col items-end leading-none">
                    <span class="text-[0.55rem] lg:text-[0.65rem] 2xl:text-xs font-bold text-slate-400 uppercase tracking-widest">Subtotal</span>
                    <span class="text-lg lg:text-2xl 2xl:text-3xl font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">{{ currentWeekendTotal() }}</span>
                  </div>
                </div>

                <!-- Inputs block -->
                <div class="flex-1 flex flex-col justify-end">
                  @if (selectedWeek() > weekendWeekCount()) {
                    <div class="flex items-center justify-center flex-1 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-700">
                      <span class="text-xs font-bold text-slate-400">Sin reunión esta semana</span>
                    </div>
                  } @else {
                    <div class="grid gap-1.5 lg:gap-2.5 2xl:gap-3" [class.grid-cols-2]="congregacionConfig()?.usa_zoom !== 0" [class.grid-cols-1]="congregacionConfig()?.usa_zoom === 0">

                      <!-- Presencial Card WEEKEND -->
                      <div class="bg-slate-50 dark:bg-[#1a1514] border border-orange-500/20 dark:border-orange-500/30 rounded-xl p-2 lg:p-3 2xl:p-4 flex flex-col shadow-sm transition-colors hover:border-orange-500/40 dark:hover:border-orange-500/60 group">
                        <div class="flex items-center mb-1.5 lg:mb-2.5">
                          <label class="flex items-center gap-1 lg:gap-1.5 text-[0.65rem] lg:text-xs 2xl:text-sm font-semibold text-slate-500 dark:text-slate-400 group-focus-within:text-orange-500 transition-colors cursor-pointer">
                            <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            Presencial
                          </label>
                        </div>
                        <div class="mt-auto relative">
                          <input type="number" min="0" inputmode="numeric"
                                 [ngModel]="weekendWeeks()[selectedWeek() - 1]"
                                 (ngModelChange)="updateWeekendWeek($event)"
                                 [disabled]="!hasEditPermission()"
                                 class="block w-full attendance-input attendance-input--orange h-12 lg:h-14 2xl:h-16 text-xl lg:text-2xl 2xl:text-3xl placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                 placeholder="0">
                        </div>
                      </div>

                      <!-- Zoom Card -->
                      @if (congregacionConfig()?.usa_zoom !== 0) {
                        <div class="bg-slate-50 dark:bg-[#1a1514] border border-orange-500/20 dark:border-orange-500/30 rounded-xl p-2 lg:p-3 2xl:p-4 flex flex-col shadow-sm transition-colors hover:border-orange-500/40 dark:hover:border-orange-500/60 group">
                          <div class="flex items-center mb-1.5 lg:mb-2.5">
                            <label class="flex items-center gap-1 lg:gap-1.5 text-[0.65rem] lg:text-xs 2xl:text-sm font-semibold text-slate-500 dark:text-slate-400 group-focus-within:text-orange-500 transition-colors cursor-pointer">
                               <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                              Zoom
                            </label>
                          </div>
                          <div class="mt-auto relative">
                            <input type="number" min="0" inputmode="numeric"
                                   [ngModel]="weekendZoomWeeks()[selectedWeek() - 1]"
                                   (ngModelChange)="updateWeekendZoomWeek($event)"
                                   [disabled]="!hasEditPermission()"
                                   class="block w-full attendance-input attendance-input--orange h-12 lg:h-14 2xl:h-16 text-xl lg:text-2xl 2xl:text-3xl placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                   placeholder="0">
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>

              </div>

            </div>
          </div>

        </div>

        <!-- ESTADÍSTICAS DEL MES -->
        <div class="w-full lg:w-[320px] xl:w-[400px] 2xl:w-[450px] shrink-0 flex flex-col">
           <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 lg:p-4 2xl:p-5 flex flex-col h-full justify-center">

             <div>
               <div class="flex items-center gap-1.5 lg:gap-2 mb-2 lg:mb-3">
                 <div class="p-1 lg:p-1.5 2xl:p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 shrink-0">
                   <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4 2xl:w-5 2xl:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                 </div>
                 <h3 class="font-bold text-slate-800 dark:text-slate-100 text-xs lg:text-sm 2xl:text-base leading-none lg:block flex gap-1 tracking-tight">Estado <span class="lg:hidden block">del Mes</span><span class="hidden lg:block">Mensual</span></h3>
               </div>

               <!-- Vertical weeks for lg screens, horizontal for smaller -->
               <div class="grid grid-cols-5 lg:flex lg:flex-wrap lg:gap-2 2xl:gap-2.5 gap-1 mb-2 lg:mb-3">
                 @for (week of weeksArray(); track week) {
                   <div class="flex flex-col lg:flex-row lg:flex-1 items-center justify-center lg:justify-between p-1 lg:px-3 lg:py-2 2xl:px-4 2xl:py-2.5 rounded-lg [transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1)]"
                        [ngClass]="weekHasData(week) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-slate-900/30'">
                     <span class="text-[0.6rem] lg:text-xs 2xl:text-sm font-bold uppercase text-slate-500 tracking-wider">
                        <span class="lg:hidden">S</span><span class="hidden lg:inline">SEM </span>{{ week }}
                     </span>
                     @if (weekHasData(week)) {
                       <svg class="w-3 h-3 lg:w-4 lg:h-4 2xl:w-5 2xl:h-5 text-emerald-500 shrink-0 mt-0.5 lg:mt-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                     } @else {
                       <svg class="w-3 h-3 lg:w-4 lg:h-4 2xl:w-5 2xl:h-5 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5 lg:mt-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                     }
                   </div>
                 }
               </div>
             </div>

             <!-- Totals -->
             <div class="grid grid-cols-2 lg:grid-cols-2 gap-1.5 lg:gap-2.5 2xl:gap-3 mt-auto pt-1 lg:pt-2 shrink-0">
               <div class="flex flex-col justify-center items-center py-1 px-1.5 lg:py-2.5 lg:px-3 2xl:py-3 2xl:px-4 bg-purple-50/60 dark:bg-[#1a1728] rounded-lg border border-purple-100/80 dark:border-brand-purple/20">
                 <span class="font-bold text-slate-500 dark:text-slate-400 text-[0.55rem] lg:text-[0.65rem] 2xl:text-xs uppercase tracking-widest text-center">T. ES</span>
                 <span class="text-sm lg:text-xl 2xl:text-2xl font-black text-brand-purple dark:text-[#a586ff] tabular-nums text-center leading-none mt-0.5 lg:mt-1">{{ midweekMonthTotal() }}</span>
               </div>
               <div class="flex flex-col justify-center items-center py-1 px-1.5 lg:py-2.5 lg:px-3 2xl:py-3 2xl:px-4 bg-orange-50/60 dark:bg-[#281d1b] rounded-lg border border-orange-100/80 dark:border-orange-500/20">
                 <span class="font-bold text-slate-500 dark:text-slate-400 text-[0.55rem] lg:text-[0.65rem] 2xl:text-xs uppercase tracking-widest text-center">T. FS</span>
                 <span class="text-sm lg:text-xl 2xl:text-2xl font-black text-orange-500 dark:text-[#ff8f3d] tabular-nums text-center leading-none mt-0.5 lg:mt-1">{{ weekendMonthTotal() }}</span>
               </div>
             </div>

           </div>
        </div>

        </div> <!-- /Left Panel -->

        <!-- RIGHT PANEL: RESUMEN ANUAL -->
        <div class="hidden xl:flex flex-1 flex-col gap-2 sm:gap-3 xl:min-w-[450px] min-h-0 overflow-hidden">
        
        <!-- Year selector (se oculta en laptops 720p para ganar espacio vertical) -->
        <div class="shrink-0 [@media(min-width:768px)_and_(max-height:800px)]:hidden flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-3 sm:px-4 lg:px-5 2xl:px-6 py-2.5 sm:py-3 lg:py-4 2xl:py-5">
          <div class="flex items-center gap-2 sm:gap-3 lg:gap-4">
            <svg class="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span class="text-xs lg:text-sm 2xl:text-base font-bold text-slate-400 uppercase tracking-wider">Año de Servicio</span>
            <select [ngModel]="resumenServiceYear()" (ngModelChange)="resumenServiceYear.set(+$event)"
                    class="bg-transparent border-0 text-sm lg:text-base 2xl:text-lg font-bold text-slate-800 dark:text-slate-100 cursor-pointer focus:ring-0 pr-6">
              @for (y of serviceYears; track y) {
                <option [value]="y">{{ y }}</option>
              }
            </select>
            <span class="hidden sm:inline text-xs lg:text-sm 2xl:text-base font-medium text-slate-400">Sep {{ resumenServiceYear() - 1 }} – Ago {{ resumenServiceYear() }}</span>
          </div>
          @if (loadingResumen()) {
            <div class="flex items-center gap-1.5 text-xs lg:text-sm font-medium text-slate-400">
              <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="30 70" stroke-linecap="round"/></svg>
              <span class="hidden sm:inline">Cargando...</span>
            </div>
          }
        </div>

        <!-- Main grid: Table only -->
        <div class="flex flex-col flex-1 min-h-0">

          <!-- Summary Table Card (en 720p colapsa a solo el header con el S-88 PDF) -->
          <div class="w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col flex-1 min-h-0 [@media(min-width:768px)_and_(max-height:800px)]:flex-none">
            <div class="px-4 py-2 sm:px-5 sm:py-2.5 lg:px-6 lg:py-3.5 2xl:px-8 2xl:py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2.5 bg-slate-50/50 dark:bg-slate-900/30">
              <div class="flex items-center gap-2.5 lg:gap-3">
                <div class="p-1.5 lg:p-2 2xl:p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                  <svg class="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                </div>
                <div>
                  <h3 class="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base lg:text-lg 2xl:text-xl leading-none tracking-tight">Desglose Mensual</h3>
                  <p class="text-[0.65rem] lg:text-xs 2xl:text-sm text-slate-400 font-bold mt-0.5 lg:mt-1">Año de Servicio {{ resumenServiceYear() }}</p>
                </div>
              </div>
              <button (click)="onExportS88Pdf()"
                      class="shrink-0 flex items-center justify-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2.5 2xl:px-5 2xl:py-3 text-xs lg:text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg shadow-sm shadow-indigo-500/20 [transition:background-color_160ms_cubic-bezier(0.23,1,0.32,1),transform_160ms_cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]">
                <svg class="w-3.5 h-3.5 lg:w-4 lg:h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="12" y1="18" x2="12" y2="12"></line>
                  <line x1="9" y1="15" x2="12" y2="18"></line>
                  <line x1="15" y1="15" x2="12" y2="18"></line>
                </svg>
                <span class="hidden sm:inline">S-88 PDF</span>
              </button>
            </div>

            <div class="overflow-y-auto overflow-x-auto flex-1 custom-scrollbar [@media(min-width:768px)_and_(max-height:800px)]:hidden">
              <table class="w-full">
                <thead class="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10">
                  <tr>
                    <th rowspan="2" class="px-4 lg:px-5 2xl:px-6 py-1 lg:py-2 2xl:py-3 text-left text-[0.65rem] lg:text-xs 2xl:text-sm font-bold text-slate-400 uppercase tracking-wider align-bottom">Mes</th>
                    <th colspan="2" class="px-2 lg:px-3 py-1 lg:py-2 text-center text-[0.65rem] lg:text-xs 2xl:text-sm font-bold text-brand-purple uppercase tracking-wider border-l border-slate-100 dark:border-slate-700">
                      <span class="inline-flex items-center gap-1.5 lg:gap-2">
                        <span class="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-brand-purple"></span>
                        Entre Semana
                      </span>
                    </th>
                    <th colspan="2" class="px-2 lg:px-3 py-1 lg:py-2 text-center text-[0.65rem] lg:text-xs 2xl:text-sm font-bold text-orange-500 uppercase tracking-wider border-l border-slate-100 dark:border-slate-700">
                      <span class="inline-flex items-center gap-1.5 lg:gap-2">
                        <span class="w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full bg-orange-500"></span>
                        Fin de Semana
                      </span>
                    </th>
                  </tr>
                  <tr class="text-[0.6rem] lg:text-[0.7rem] 2xl:text-xs uppercase tracking-wider">
                    <th class="px-2 lg:px-3 py-1 lg:py-1.5 text-center text-slate-400 font-bold border-l border-slate-100 dark:border-slate-700">Reun.</th>
                    <th class="px-2 lg:px-3 py-1 lg:py-1.5 text-center text-brand-purple font-black">Prom.</th>
                    <th class="px-2 lg:px-3 py-1 lg:py-1.5 text-center text-slate-400 font-bold border-l border-slate-100 dark:border-slate-700">Reun.</th>
                    <th class="px-2 lg:px-3 py-1 lg:py-1.5 text-center text-orange-500 font-black">Prom.</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                  @for (row of resumenAnualHistorico(); track row.mes) {
                    <tr class="resumen-row hover:bg-slate-50/70 dark:hover:bg-slate-800/50 [transition:background-color_150ms_cubic-bezier(0.23,1,0.32,1)]"
                        [class.resumen-row--current]="+row.mes === +selectedMonth()">
                      <td class="px-4 lg:px-5 2xl:px-6 py-1.5 lg:py-3 2xl:py-4 font-bold text-sm lg:text-base 2xl:text-lg"
                          [ngClass]="row.midweek_total !== null || row.weekend_total !== null ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'">
                        <div class="flex items-center gap-2 lg:gap-2.5">
                          @if (+row.mes === +selectedMonth()) {
                            <span class="w-1 h-4 lg:w-1.5 lg:h-5 rounded-full bg-brand-purple shrink-0"></span>
                          } @else {
                            <span class="w-1 h-4 lg:w-1.5 lg:h-5 shrink-0"></span>
                          }
                          <span>{{ row.nombre_mes }}</span>
                        </div>
                      </td>
                      <td class="px-2 lg:px-3 py-1.5 lg:py-3 2xl:py-4 text-center text-sm lg:text-base 2xl:text-lg font-medium tabular-nums border-l border-slate-100 dark:border-slate-700"
                          [ngClass]="row.midweek_reuniones > 0 ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600'">
                        {{ row.midweek_reuniones > 0 ? row.midweek_reuniones : '–' }}
                      </td>
                      <td class="px-2 lg:px-3 py-1.5 lg:py-3 2xl:py-4 text-center text-sm lg:text-base 2xl:text-lg font-black tabular-nums"
                          [ngClass]="row.midweek_promedio !== null ? 'text-brand-purple' : 'text-slate-300 dark:text-slate-600'">
                        {{ row.midweek_promedio !== null ? row.midweek_promedio : '–' }}
                      </td>
                      <td class="px-2 lg:px-3 py-1.5 lg:py-3 2xl:py-4 text-center text-sm lg:text-base 2xl:text-lg font-medium tabular-nums border-l border-slate-100 dark:border-slate-700"
                          [ngClass]="row.weekend_reuniones > 0 ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600'">
                        {{ row.weekend_reuniones > 0 ? row.weekend_reuniones : '–' }}
                      </td>
                      <td class="px-2 lg:px-3 py-1.5 lg:py-3 2xl:py-4 text-center text-sm lg:text-base 2xl:text-lg font-black tabular-nums"
                          [ngClass]="row.weekend_promedio !== null ? 'text-orange-500' : 'text-slate-300 dark:text-slate-600'">
                        {{ row.weekend_promedio !== null ? row.weekend_promedio : '–' }}
                      </td>
                    </tr>
                  }
                  @empty {
                    <tr>
                      <td colspan="5" class="px-5 py-12 lg:py-16 text-center text-sm lg:text-base text-slate-400">
                        <div class="flex flex-col items-center gap-2 lg:gap-3">
                          <svg class="w-8 h-8 lg:w-10 lg:h-10 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                          <span class="font-bold">Sin datos para este año de servicio</span>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
                @if (resumenMesesConDatos() > 0) {
                  <tfoot class="bg-slate-50 dark:bg-slate-900/40 border-t-2 border-slate-200 dark:border-slate-700">
                    <tr class="text-sm lg:text-base 2xl:text-lg font-black">
                      <td class="px-5 lg:px-6 2xl:px-7 py-3 lg:py-4 2xl:py-5 text-slate-700 dark:text-slate-200 uppercase text-xs lg:text-sm 2xl:text-base tracking-wider">Total</td>
                      <td class="px-2 lg:px-3 py-3 lg:py-4 2xl:py-5 text-center tabular-nums text-slate-500 border-l border-slate-100 dark:border-slate-700">{{ resumenMidweekReuniones() }}</td>
                      <td class="px-2 lg:px-3 py-3 lg:py-4 2xl:py-5 text-center tabular-nums text-brand-purple">{{ resumenMidweekPromedio() }}</td>
                      <td class="px-2 lg:px-3 py-3 lg:py-4 2xl:py-5 text-center tabular-nums text-slate-500 border-l border-slate-100 dark:border-slate-700">{{ resumenWeekendReuniones() }}</td>
                      <td class="px-2 lg:px-3 py-3 lg:py-4 2xl:py-5 text-center tabular-nums text-orange-500">{{ resumenWeekendPromedio() }}</td>
                    </tr>
                  </tfoot>
                }
              </table>
            </div>
          </div>


        </div>

      </div>

      </div> <!-- /Right Panel -->

    </div> <!-- /Unified Layout -->

    <!-- Mobile Sticky Action Bar -->
    <div class="sm:hidden fixed bottom-4 left-4 right-4 z-40 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border border-slate-100 dark:border-slate-700/60 p-2 flex gap-2">
       <button (click)="onExportPdf()"
               [disabled]="!currentPeriodo() || loading()"
               class="flex-1 shrink-0 h-12 inline-flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-sm transition-colors active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
         <svg class="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
         PDF
       </button>
       <button (click)="onSave()"
               *ngIf="hasEditPermission()"
               [disabled]="saving() || !currentPeriodo() || loading() || !hasChanges()"
               class="flex-[2] shrink-0 h-12 inline-flex items-center justify-center gap-2 bg-brand-purple hover:bg-purple-800 text-white rounded-xl font-bold text-sm shadow-md shadow-brand-purple/20 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
         @if (saving()) {
           <svg class="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="30 70" stroke-linecap="round"/></svg>
           Guardando...
         } @else {
           <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
           Guardar
         }
       </button>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    /* ── Enter animation (Emil: custom ease-out curve) ── */
    .animate-fadeIn {
      animation: fadeIn 0.3s cubic-bezier(0.23, 1, 0.32, 1) forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Toast: @starting-style modern + fallback ── */
    .toast-enter {
      transition: opacity 300ms cubic-bezier(0.23, 1, 0.32, 1),
                  transform 300ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    @starting-style {
      .toast-enter {
        opacity: 0;
        transform: translateY(-8px) scale(0.97);
      }
    }

    /* ── Hover guard para touch devices ── */
    @media (hover: hover) and (pointer: fine) {
      .sidebar-item-hover:hover {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        transition: box-shadow 150ms ease-out;
      }
    }

    /* ── Sidebar colapsable en mobile con <details> ── */
    @media (min-width: 1280px) {
      details.sidebar-details { display: contents; }
      details.sidebar-details > summary { display: none; }
    }

    /* ── 3xl breakpoint (1920px+) para 4K / ultrawide ── */
    @media (min-width: 1920px) {
      .c3xl-col-span-4 { grid-column: span 4 / span 4; }
      .c3xl-grid-cols-5 { grid-template-columns: repeat(5, minmax(0, 1fr)); }
      .c3xl-p-12 { padding: 3rem; }
    }

    /* ── Attendance input: unified design for both colors ── */
    .attendance-input {
      width: 100%;
      height: 4rem;
      background-color: #ffffff;
      border-width: 2px;
      border-radius: 0.75rem;
      text-align: center;
      font-size: 1.75rem;
      font-weight: 900;
      color: rgb(30 41 59);
      outline: none;
      cursor: text;
      box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.04);
      font-variant-numeric: tabular-nums;
      transition: border-color 150ms ease-out, box-shadow 150ms ease-out, transform 160ms cubic-bezier(0.23, 1, 0.32, 1);
      -moz-appearance: textfield;
    }
    .attendance-input::-webkit-outer-spin-button,
    .attendance-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .attendance-input:active:not(:disabled) { transform: scale(0.99); }
    .attendance-input:disabled {
      background-color: rgb(248 250 252);
      color: rgb(148 163 184);
      cursor: not-allowed;
      border-color: rgb(226 232 240) !important;
    }
    :host-context(.dark) .attendance-input {
      background-color: rgb(30 41 59);
      color: rgb(241 245 249);
    }
    :host-context(.dark) .attendance-input:disabled {
      background-color: rgb(15 23 42 / 0.4);
      color: rgb(100 116 139);
      border-color: rgb(30 41 59 / 0.5) !important;
    }

    .attendance-input--purple { border-color: rgb(233 213 255); }
    .attendance-input--purple:hover:not(:disabled) { border-color: rgb(192 132 252); }
    .attendance-input--purple:focus:not(:disabled) {
      border-color: rgb(109 40 217);
      box-shadow: 0 0 0 4px rgb(243 232 255 / 0.8);
    }
    :host-context(.dark) .attendance-input--purple { border-color: rgb(107 33 168 / 0.6); }
    :host-context(.dark) .attendance-input--purple:focus:not(:disabled) {
      box-shadow: 0 0 0 4px rgb(107 33 168 / 0.3);
    }

    .attendance-input--orange { border-color: rgb(254 215 170); }
    .attendance-input--orange:hover:not(:disabled) { border-color: rgb(251 146 60); }
    .attendance-input--orange:focus:not(:disabled) {
      border-color: rgb(249 115 22);
      box-shadow: 0 0 0 4px rgb(255 237 213 / 0.8);
    }
    :host-context(.dark) .attendance-input--orange { border-color: rgb(154 52 18 / 0.6); }
    :host-context(.dark) .attendance-input--orange:focus:not(:disabled) {
      box-shadow: 0 0 0 4px rgb(154 52 18 / 0.3);
    }

    /* ── Resumen table: current-month highlight ── */
    .resumen-row--current {
      background-color: rgb(250 245 255 / 0.6);
    }
    :host-context(.dark) .resumen-row--current {
      background-color: rgb(59 7 100 / 0.2);
    }

    /* ── Reduced motion: disable transforms, keep opacity ── */
    @media (prefers-reduced-motion: reduce) {
      .animate-fadeIn { animation: none; opacity: 1; }
      .attendance-input:active:not(:disabled) { transform: none; }
    }
    /* ── Dropdown trigger: press feedback + hover curve ── */
    .dropdown-trigger {
      transition: background-color 150ms cubic-bezier(0.23, 1, 0.32, 1),
                  transform 160ms cubic-bezier(0.23, 1, 0.32, 1);
    }
    .dropdown-trigger:active { transform: scale(0.97); }

    /* ── Chevron: strong ease-out, snappy ── */
    .chevron {
      transition: transform 180ms cubic-bezier(0.23, 1, 0.32, 1);
    }

    /* ── Custom Dropdown: origin-aware (scales from trigger, not center) ── */
    .dropdown-panel {
      transform-origin: top left;
      animation: dropdownIn 180ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
      will-change: transform, opacity;
    }
    @keyframes dropdownIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }

    /* ── Dropdown items: subtle stagger + ease-out color transitions ── */
    .dropdown-item {
      transition: background-color 150ms cubic-bezier(0.23, 1, 0.32, 1),
                  color 150ms cubic-bezier(0.23, 1, 0.32, 1);
      opacity: 0;
      animation: itemIn 200ms cubic-bezier(0.23, 1, 0.32, 1) forwards;
      animation-delay: calc(var(--i, 0) * 14ms + 40ms);
    }
    @keyframes itemIn {
      from { opacity: 0; transform: translateY(-2px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Resumen row: current-month pulse on select ── */
    .resumen-row--current {
      position: relative;
    }

    /* ── Reduced motion: keep opacity, drop transforms/stagger ── */
    @media (prefers-reduced-motion: reduce) {
      .dropdown-panel { animation: dropdownFade 150ms ease forwards; }
      .dropdown-item {
        animation: none;
        opacity: 1;
      }
      .dropdown-trigger:active { transform: none; }
      .chevron { transition: none; }
    }
    @keyframes dropdownFade {
      from { opacity: 0; }
      to   { opacity: 1; }
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

  // ── Loaded data ──
  periodos = signal<Periodo[]>([]);
  midweekRecord = signal<AsistenciaRecord | null>(null);
  weekendRecord = signal<AsistenciaRecord | null>(null);
  fechasReuniones = signal<FechaSemanaReunion[]>([]);
  resumenAnual = signal<ResumenMensualAsistencia[]>([]);
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
  activeMobileTab = signal<'midweek' | 'weekend'>('midweek');

  // ── Dirty tracking: snapshot of last loaded/saved state ──
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
  anos = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i);
  serviceYears = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 4 + i);

  // ── Tab & Resumen state ──
  resumenServiceYear = signal<number>(this.defaultResumenServiceYear());
  resumenAnualHistorico = signal<ResumenMensualAsistencia[]>([]);
  loadingResumen = signal(false);

  // ── Dropdown open states ──
  monthDropOpen = signal(false);
  yearDropOpen = signal(false);

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

  // ── Resumen KPI computeds ──
  resumenMesesConDatos = computed(() =>
    this.resumenAnualHistorico().filter(r => r.midweek_total !== null || r.weekend_total !== null).length
  );

  resumenMidweekTotal = computed(() =>
    this.resumenAnualHistorico().reduce((sum, r) => sum + (r.midweek_total ?? 0), 0)
  );

  resumenWeekendTotal = computed(() =>
    this.resumenAnualHistorico().reduce((sum, r) => sum + (r.weekend_total ?? 0), 0)
  );

  resumenTotalAnual = computed(() => this.resumenMidweekTotal() + this.resumenWeekendTotal());

  resumenMidweekReuniones = computed(() =>
    this.resumenAnualHistorico().reduce((sum, r) => sum + (r.midweek_reuniones ?? 0), 0)
  );

  resumenWeekendReuniones = computed(() =>
    this.resumenAnualHistorico().reduce((sum, r) => sum + (r.weekend_reuniones ?? 0), 0)
  );

  resumenMidweekPromedio = computed(() => {
    const n = this.resumenMidweekReuniones();
    return n > 0 ? Math.round(this.resumenMidweekTotal() / n) : 0;
  });

  resumenWeekendPromedio = computed(() => {
    const n = this.resumenWeekendReuniones();
    return n > 0 ? Math.round(this.resumenWeekendTotal() / n) : 0;
  });

  resumenMejorMesMidweek = computed(() => {
    const rows = this.resumenAnualHistorico().filter(r => r.midweek_promedio !== null);
    if (!rows.length) return null;
    return rows.reduce((best, r) => (r.midweek_promedio! > (best.midweek_promedio ?? 0) ? r : best), rows[0]);
  });

  resumenMejorMesWeekend = computed(() => {
    const rows = this.resumenAnualHistorico().filter(r => r.weekend_promedio !== null);
    if (!rows.length) return null;
    return rows.reduce((best, r) => (r.weekend_promedio! > (best.weekend_promedio ?? 0) ? r : best), rows[0]);
  });

  /** Máximo valor entre todos los promedios para normalizar barras de la tabla */
  resumenMaxPromedio = computed(() => {
    const all: number[] = [];
    this.resumenAnualHistorico().forEach(r => {
      if (r.midweek_promedio !== null) all.push(r.midweek_promedio);
      if (r.weekend_promedio !== null) all.push(r.weekend_promedio);
    });
    return all.length ? Math.max(...all) : 0;
  });

  // ── Computed ──
  currentPeriodo = computed(() => {
    const year = +this.selectedYear();
    const month = +this.selectedMonth();
    return this.periodos().find(p => p.codigo_ano === year && p.codigo_mes === month) ?? null;
  });

  mesLabel = computed(() => this.meses.find(m => m.value === +this.selectedMonth())?.label ?? '');

  isViewingCurrentMonth = computed(() => {
    const now = new Date();
    return +this.selectedMonth() === (now.getMonth() + 1) && +this.selectedYear() === now.getFullYear();
  });

  currentServiceYear = computed(() => {
    const m = +this.selectedMonth();
    const y = +this.selectedYear();
    return m >= 9 ? y + 1 : y;
  });

  midweekMonthTotal = computed(() => {
    const presencial = this.midweekWeeks().reduce((sum: number, v) => sum + (v ?? 0), 0);
    const zoom = this.midweekZoomWeeks().reduce((sum: number, v) => sum + (v ?? 0), 0);
    return presencial + zoom;
  });

  weekendMonthTotal = computed(() => {
    const presencial = this.weekendWeeks().reduce((sum: number, v) => sum + (v ?? 0), 0);
    const zoom = this.weekendZoomWeeks().reduce((sum: number, v) => sum + (v ?? 0), 0);
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

  // Cuántos slots tienen datos registrados (para promedios)
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

  // Cuántas veces ocurre el día de reunión en el mes seleccionado
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

  midweekAverage = computed(() => {
    const count = this.midweekFilledCount();
    if (count === 0) return '–';
    return Math.round(this.midweekMonthTotal() / count);
  });

  weekendAverage = computed(() => {
    const count = this.weekendFilledCount();
    if (count === 0) return '–';
    return Math.round(this.weekendMonthTotal() / count);
  });

  hasChanges = computed(() => {
    const snap = this.savedSnapshot();
    const arrEq = (a: (number | null)[], b: (number | null)[]) =>
      a.every((v, i) => (v ?? null) === (b[i] ?? null));
    return !arrEq(this.midweekWeeks(), snap.mwPres)
      || !arrEq(this.midweekZoomWeeks(), snap.mwZoom)
      || !arrEq(this.weekendWeeks(), snap.wePres)
      || !arrEq(this.weekendZoomWeeks(), snap.weZoom);
  });

  currentMidweekDate = computed(() => {
    const w = this.selectedWeek();
    const f = this.fechasReuniones().find(s => s.semana === w);
    return f?.fecha_entre_semana ? this.formatDateShort(f.fecha_entre_semana) : null;
  });

  currentWeekendDate = computed(() => {
    const w = this.selectedWeek();
    const f = this.fechasReuniones().find(s => s.semana === w);
    return f?.fecha_fin_semana ? this.formatDateShort(f.fecha_fin_semana) : null;
  });

  /** Próxima fecha de reunión entre semana a partir de hoy */
  nextMidweekDate = computed(() => {
    const cfg = this.congregacionConfig();
    if (!cfg?.dia_reunion_entre_semana) return null;
    return this.calcNextMeetingDate(cfg.dia_reunion_entre_semana);
  });

  /** Próxima fecha de reunión de fin de semana a partir de hoy */
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
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const label = isToday
      ? 'Hoy'
      : `${dias[next.getDay()]} ${next.getDate()} ${meses[next.getMonth()]}`;
    return { label, isToday };
  }

  constructor() {
    effect(() => {
      const year = this.selectedYear();
      const month = this.selectedMonth();
      const congId = this.congregacionCtx.effectiveCongregacionId();
      const _periodos = this.periodos(); // track periodos signal
      if (congId && _periodos.length > 0) {
        this.loadData(+year, +month, congId);
      }
    });

    // Auto-reset selected week when the month has fewer weeks than current selection
    effect(() => {
      const max = this.totalWeeksInMonth();
      if (this.selectedWeek() > max) this.selectedWeek.set(max);
    });

    // Load resumen historico when year changes
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
        this.autoSelectCurrentWeek();
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

    // Load resumen anual
    const anoServicio = month >= 9 ? year + 1 : year;
    this.asistenciaService.getResumenAnual(congId, anoServicio).subscribe({
      next: (res) => this.resumenAnual.set(res.meses),
      error: () => this.resumenAnual.set([]),
    });

    if (!periodo) {
      this.midweekRecord.set(null);
      this.weekendRecord.set(null);
      this._resetWeeks();
      this.loading.set(false);
      return;
    }

    // Load attendance records
    this.asistenciaService.getAsistencias(periodo.id_periodo, congId).subscribe({
      next: (records) => {
        const midweek = records.find(r => r.asistencia_tipo_reunion === 1) ?? null;
        const weekend = records.find(r => r.asistencia_tipo_reunion === 2) ?? null;

        this.midweekRecord.set(midweek);
        this.weekendRecord.set(weekend);

        this.midweekWeeks.set([
          midweek?.asistencia_semana_01 ?? null,
          midweek?.asistencia_semana_02 ?? null,
          midweek?.asistencia_semana_03 ?? null,
          midweek?.asistencia_semana_04 ?? null,
          midweek?.asistencia_semana_05 ?? null,
        ]);

        this.midweekZoomWeeks.set([
          midweek?.asistencia_zoom_semana_01 ?? null,
          midweek?.asistencia_zoom_semana_02 ?? null,
          midweek?.asistencia_zoom_semana_03 ?? null,
          midweek?.asistencia_zoom_semana_04 ?? null,
          midweek?.asistencia_zoom_semana_05 ?? null,
        ]);

        this.weekendWeeks.set([
          weekend?.asistencia_semana_01 ?? null,
          weekend?.asistencia_semana_02 ?? null,
          weekend?.asistencia_semana_03 ?? null,
          weekend?.asistencia_semana_04 ?? null,
          weekend?.asistencia_semana_05 ?? null,
        ]);

        this.weekendZoomWeeks.set([
          weekend?.asistencia_zoom_semana_01 ?? null,
          weekend?.asistencia_zoom_semana_02 ?? null,
          weekend?.asistencia_zoom_semana_03 ?? null,
          weekend?.asistencia_zoom_semana_04 ?? null,
          weekend?.asistencia_zoom_semana_05 ?? null,
        ]);

        this.saveSnapshot();
        this.loading.set(false);
        this.autoSelectCurrentWeek();
      },
      error: () => {
        this.loading.set(false);
        this.showToast('error', 'Error al cargar asistencias');
      },
    });
  }

  private _resetWeeks() {
    this.midweekWeeks.set([null, null, null, null, null]);
    this.weekendWeeks.set([null, null, null, null, null]);
    this.midweekZoomWeeks.set([null, null, null, null, null]);
    this.weekendZoomWeeks.set([null, null, null, null, null]);
    this.saveSnapshot();
  }

  private saveSnapshot(): void {
    this.savedSnapshot.set({
      mwPres: [...this.midweekWeeks()],
      mwZoom: [...this.midweekZoomWeeks()],
      wePres: [...this.weekendWeeks()],
      weZoom: [...this.weekendZoomWeeks()],
    });
  }

  // ── Week editing ──
  selectWeek(week: number): void {
    this.selectedWeek.set(week);
  }

  updateMidweekWeek(value: number | null): void {
    const weeks = [...this.midweekWeeks()];
    weeks[this.selectedWeek() - 1] = value !== null && value >= 0 ? value : null;
    this.midweekWeeks.set(weeks);
  }

  updateMidweekZoomWeek(value: number | null): void {
    const weeks = [...this.midweekZoomWeeks()];
    weeks[this.selectedWeek() - 1] = value !== null && value >= 0 ? value : null;
    this.midweekZoomWeeks.set(weeks);
  }

  updateWeekendWeek(value: number | null): void {
    const weeks = [...this.weekendWeeks()];
    weeks[this.selectedWeek() - 1] = value !== null && value >= 0 ? value : null;
    this.weekendWeeks.set(weeks);
  }

  updateWeekendZoomWeek(value: number | null): void {
    const weeks = [...this.weekendZoomWeeks()];
    weeks[this.selectedWeek() - 1] = value !== null && value >= 0 ? value : null;
    this.weekendZoomWeeks.set(weeks);
  }

  weekHasData(week: number): boolean {
    const idx = week - 1;
    const mw = (this.midweekWeeks()[idx] ?? 0) + (this.midweekZoomWeeks()[idx] ?? 0);
    const we = (this.weekendWeeks()[idx] ?? 0) + (this.weekendZoomWeeks()[idx] ?? 0);
    return mw > 0 || we > 0;
  }

  // ── Month navigation ──
  prevMonth(): void {
    let m = +this.selectedMonth();
    let y = +this.selectedYear();
    if (m === 1) { m = 12; y--; } else { m--; }
    this.selectedYear.set(y);
    this.selectedMonth.set(m);
    this.selectedWeek.set(1);
    // Si navegamos al mes actual, aplicar semana inteligente
    const now = new Date();
    if (y === now.getFullYear() && m === now.getMonth() + 1) {
      setTimeout(() => this.autoSelectCurrentWeek());
    }
  }

  nextMonth(): void {
    let m = +this.selectedMonth();
    let y = +this.selectedYear();
    if (m === 12) { m = 1; y++; } else { m++; }
    this.selectedYear.set(y);
    this.selectedMonth.set(m);
    this.selectedWeek.set(1);
    const now = new Date();
    if (y === now.getFullYear() && m === now.getMonth() + 1) {
      setTimeout(() => this.autoSelectCurrentWeek());
    }
  }

  // ── Save ──
  onSave(): void {
    const periodo = this.currentPeriodo();
    const congId = this.congregacionCtx.effectiveCongregacionId();
    if (!periodo || !congId) return;

    this.saving.set(true);
    const mwPres = this.midweekWeeks();
    const mwZoom = this.midweekZoomWeeks();
    const wePres = this.weekendWeeks();
    const weZoom = this.weekendZoomWeeks();

    const hasMidweekData = mwPres.some(v => (v ?? 0) > 0) || mwZoom.some(v => (v ?? 0) > 0);
    const hasWeekendData = wePres.some(v => (v ?? 0) > 0) || weZoom.some(v => (v ?? 0) > 0);

    const requests: Promise<any>[] = [];

    if (hasMidweekData || this.midweekRecord()) {
      const payload: AsistenciaUpsert = {
        id_periodo_asistencia: periodo.id_periodo,
        id_congregacion_asistencia: congId,
        asistencia_tipo_reunion: 1,
        asistencia_semana_01: mwPres[0],
        asistencia_semana_02: mwPres[1],
        asistencia_semana_03: mwPres[2],
        asistencia_semana_04: mwPres[3],
        asistencia_semana_05: mwPres[4],
        asistencia_zoom_semana_01: mwZoom[0],
        asistencia_zoom_semana_02: mwZoom[1],
        asistencia_zoom_semana_03: mwZoom[2],
        asistencia_zoom_semana_04: mwZoom[3],
        asistencia_zoom_semana_05: mwZoom[4],
      };
      requests.push(lastValueFrom(this.asistenciaService.upsertAsistencia(payload)));
    }

    if (hasWeekendData || this.weekendRecord()) {
      const payload: AsistenciaUpsert = {
        id_periodo_asistencia: periodo.id_periodo,
        id_congregacion_asistencia: congId,
        asistencia_tipo_reunion: 2,
        asistencia_semana_01: wePres[0],
        asistencia_semana_02: wePres[1],
        asistencia_semana_03: wePres[2],
        asistencia_semana_04: wePres[3],
        asistencia_semana_05: wePres[4],
        asistencia_zoom_semana_01: weZoom[0],
        asistencia_zoom_semana_02: weZoom[1],
        asistencia_zoom_semana_03: weZoom[2],
        asistencia_zoom_semana_04: weZoom[3],
        asistencia_zoom_semana_05: weZoom[4],
      };
      requests.push(lastValueFrom(this.asistenciaService.upsertAsistencia(payload)));
    }

    if (requests.length === 0) {
      this.saving.set(false);
      this.showToast('error', 'No hay datos para guardar');
      return;
    }

    Promise.all(requests)
      .then(() => {
        this.saving.set(false);
        this.saveSnapshot();
        this.showToast('success', 'Asistencia guardada correctamente');
        // Reload resumen anual
        const anoServicio = this.currentServiceYear();
        this.asistenciaService.getResumenAnual(congId, anoServicio).subscribe({
          next: (res) => this.resumenAnual.set(res.meses),
        });
      })
      .catch((err) => {
        this.saving.set(false);
        this.showToast('error', err?.error?.detail || 'Error al guardar asistencia');
      });
  }

  // ── PDF Export ──
  onExportPdf(): void {
    const periodo = this.currentPeriodo();
    const congId = this.congregacionCtx.effectiveCongregacionId();
    if (!periodo || !congId) return;

    this.asistenciaService.exportarPdf(congId, periodo.id_periodo).subscribe({
      next: (blob) => {
        saveAs(blob, `asistencia_${this.selectedYear()}_${this.selectedMonth()}.pdf`);
      },
      error: () => this.showToast('error', 'Error al exportar PDF'),
    });
  }

  onExportS88Pdf(): void {
    const congId = this.congregacionCtx.effectiveCongregacionId();
    if (!congId) return;

    this.asistenciaService.exportarS88Pdf(congId, this.resumenServiceYear()).subscribe({
      next: (blob) => {
        saveAs(blob, `S-88_${this.resumenServiceYear()}.pdf`);
        this.showToast('success', 'Formulario S-88 generado correctamente.');
      },
      error: () => this.showToast('error', 'Error al generar el S-88 PDF'),
    });
  }

  // ── Helpers ──
  isCurrentMonth(row: ResumenMensualAsistencia): boolean {
    const now = new Date();
    return row.ano === now.getFullYear() && row.mes === (now.getMonth() + 1);
  }

  formatTime12(time: string | null | undefined): string {
    if (!time) return '';
    const [hStr, mStr] = time.split(':');
    const h = parseInt(hStr, 10);
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 || 12;
    return `${h12}:${mStr} ${period}`;
  }

  private formatDateShort(isoDate: string): string {
    const d = new Date(isoDate + 'T12:00:00');
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
  }

  private defaultMonth(): number {
    return new Date().getMonth() + 1;
  }

  private defaultYear(): number {
    return new Date().getFullYear();
  }

  /** Devuelve el número de semana calendario del mes en que cae hoy.
   *
   *  Definición: semana 1 = día 1 del mes hasta el primer domingo;
   *  semanas siguientes = lunes a domingo consecutivos.
   *
   *  Ejemplo abril 2026 (empieza miércoles):
   *    Sem 1: 1–5  | Sem 2: 6–12 | Sem 3: 13–19 | Sem 4: 20–26 | Sem 5: 27–30
   */
  private calcCurrentWeek(): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const d = today.getDate();

    // Día de semana del 1° del mes (0=Dom … 6=Sáb)
    const firstDow = new Date(year, month - 1, 1).getDay();

    // Último día de la semana 1 = primer domingo del mes
    // Si el mes empieza en domingo, la semana 1 es solo ese día (día 1)
    const endOfWeek1 = firstDow === 0 ? 1 : 1 + (7 - firstDow);

    if (d <= endOfWeek1) return 1;

    const week = 1 + Math.ceil((d - endOfWeek1) / 7);
    return Math.max(1, Math.min(week, this.totalWeeksInMonth()));
  }

  private autoSelectCurrentWeek(): void {
    if (!this.isViewingCurrentMonth()) return;
    this.selectedWeek.set(this.calcCurrentWeek());
    
    // Auto-select tab on mobile based on the nearest upcoming meeting
    const cfg = this.congregacionConfig();
    // Fallbacks: 3 = Miércoles, 0 = Domingo
    const mwDay = cfg?.dia_reunion_entre_semana ? this.DAY_MAP[cfg.dia_reunion_entre_semana] : 3; 
    const weDay = cfg?.dia_reunion_fin_semana ? this.DAY_MAP[cfg.dia_reunion_fin_semana] : 0; 

    const todayDay = new Date().getDay();
    const diffMw = (mwDay - todayDay + 7) % 7;
    const diffWe = (weDay - todayDay + 7) % 7;

    // The meeting with the smallest diff is the next one occurring
    if (diffWe < diffMw) {
      this.activeMobileTab.set('weekend');
    } else {
      this.activeMobileTab.set('midweek');
    }
  }

  private defaultResumenServiceYear(): number {
    const now = new Date();
    const m = now.getMonth() + 1;
    return m >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  }

  private loadResumenHistorico(anoServicio: number, congId: number): void {
    this.loadingResumen.set(true);
    this.asistenciaService.getResumenAnual(congId, anoServicio).subscribe({
      next: (res) => { this.resumenAnualHistorico.set(res.meses); this.loadingResumen.set(false); },
      error: () => { this.resumenAnualHistorico.set([]); this.loadingResumen.set(false); },
    });
  }

  private countDayOccurrences(year: number, month: number, dayName: string): number {
    const target = this.DAY_MAP[dayName];
    if (target === undefined) return 5;
    const daysInMonth = new Date(year, month, 0).getDate();
    let count = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, month - 1, d).getDay() === target) count++;
    }
    return count;
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
