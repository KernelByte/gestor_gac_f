import { Component, signal, computed, inject, effect, OnInit } from '@angular/core';
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
    <div class="flex flex-col gap-4 sm:gap-6 min-h-full pb-12 overflow-y-auto">

      <!-- Toast — full-width bottom on mobile, top-right on sm+ -->
      @if (toast()) {
        <div class="fixed bottom-4 left-4 right-4 sm:bottom-auto sm:top-6 sm:left-auto sm:right-6 sm:max-w-xs z-50 animate-slideDown flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-lg"
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

      <!-- Header -->
      <div class="shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 px-1">
        <div>
          <h1 class="font-display font-black text-2xl sm:text-3xl text-slate-900 dark:text-white tracking-tight text-glow">Registro de Asistencia</h1>
          <p class="text-slate-500 font-medium text-xs sm:text-sm">Control de asistencia semanal por reunión</p>
        </div>
        @if (activeTab() === 'registro') {
          <div class="flex gap-2 w-full sm:w-auto">
            <button (click)="onExportPdf()"
                    [disabled]="!currentPeriodo() || loading()"
                    class="inline-flex items-center gap-1.5 px-3 sm:px-5 h-9 sm:h-11 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-xs sm:text-sm shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
              <svg class="w-4 h-4 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
              <span class="hidden xs:inline">Exportar</span><span class="hidden sm:inline"> PDF</span>
            </button>
            <button (click)="onSave()"
                    *ngIf="hasEditPermission()"
                    [disabled]="saving() || !currentPeriodo() || loading() || !hasChanges()"
                    class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 sm:px-6 h-9 sm:h-11 bg-brand-purple hover:bg-purple-800 text-white rounded-xl font-display font-bold text-xs sm:text-sm shadow-xl shadow-purple-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed">
              @if (saving()) {
                <svg class="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="30 70" stroke-linecap="round"/></svg>
                Guardando...
              } @else {
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Guardar Cambios
              }
            </button>
          </div>
        }
      </div>

      <!-- Tabs — full width on mobile -->
      <div class="shrink-0 flex bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl gap-1">
        <button (click)="activeTab.set('registro')"
                *ngIf="hasEditPermission()"
                class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all"
                [ngClass]="activeTab() === 'registro'
                  ? 'bg-brand-purple text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:text-slate-300 dark:hover:bg-slate-700/50'">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Registro Mensual
        </button>
        <button (click)="activeTab.set('resumen')"
                class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all"
                [ngClass]="activeTab() === 'resumen'
                  ? 'bg-brand-purple text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/60 dark:hover:text-slate-300 dark:hover:bg-slate-700/50'">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
          Resumen Anual
        </button>
      </div>

      @if (activeTab() === 'registro') {

      <!-- Month/Year Navigator -->
      <div class="shrink-0 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-3 sm:px-4 py-2.5 sm:py-3">
        <!-- Date picker pill -->
        <div class="flex items-center gap-0.5">
          <button (click)="prevMonth()" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <select [ngModel]="selectedMonth()" (ngModelChange)="selectedMonth.set($event); selectedWeek.set(1)"
                  class="bg-transparent border-0 text-sm font-bold text-slate-800 dark:text-slate-100 cursor-pointer focus:ring-0 pr-5">
            @for (m of meses; track m.value) {
              <option [value]="m.value">{{ m.label }}</option>
            }
          </select>
          <select [ngModel]="selectedYear()" (ngModelChange)="selectedYear.set($event)"
                  class="bg-transparent border-0 text-sm font-bold text-slate-800 dark:text-slate-100 cursor-pointer focus:ring-0 pr-5">
            @for (a of anos; track a) {
              <option [value]="a">{{ a }}</option>
            }
          </select>
          <button (click)="nextMonth()" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        <!-- Status indicators -->
        <div class="flex items-center gap-2">
          @if (loading()) {
            <div class="flex items-center gap-1.5 text-xs font-medium text-slate-400">
              <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="30 70" stroke-linecap="round"/></svg>
              <span class="hidden sm:inline">Cargando...</span>
            </div>
          }
          @if (currentPeriodo() && !loading() && isViewingCurrentMonth()) {
            <span class="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0"></span>
              <span class="hidden xs:inline">Periodo activo</span>
            </span>
          }
          @if (!currentPeriodo() && !loading()) {
            <span class="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg border border-amber-200 dark:border-amber-800/50">
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span class="hidden sm:inline">Sin periodo</span>
            </span>
          }
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fadeIn flex-1 min-h-0 pb-6">
        <!-- Left Column: Main Entry (2/3 width) -->
        <div class="xl:col-span-2 flex flex-col gap-6">

          <!-- Weekly Entry Card -->
          <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 sm:p-6 md:p-8">

            <!-- Card Header / Tabs -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8 border-b border-slate-100 dark:border-slate-700 pb-5 sm:pb-6">
              <div class="flex items-center gap-3">
                <div class="p-2 sm:p-2.5 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-brand-purple">
                  <svg class="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <h2 class="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-wider">{{ mesLabel() }} {{ selectedYear() }}</h2>
                  <p class="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-none">Registro Semanal</p>
                </div>
              </div>

              <!-- Week Selector Tabs — scrollable on mobile -->
              <div class="w-full sm:w-auto overflow-x-auto pb-0.5 -mb-0.5">
                <div class="flex bg-slate-50 dark:bg-slate-900/50 p-1 rounded-xl w-fit min-w-full sm:min-w-0">
                  @for (week of weeksArray(); track week) {
                    <button
                      (click)="selectWeek(week)"
                      class="px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-lg text-xs font-bold transition-all relative flex flex-col items-center gap-0.5 min-w-[50px] sm:min-w-[60px]"
                      [ngClass]="{
                        'bg-white dark:bg-slate-800 text-brand-purple dark:text-purple-400 shadow-sm': selectedWeek() === week,
                        'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800': selectedWeek() !== week
                      }">
                      <span class="text-[0.5rem] sm:text-[0.625rem] uppercase tracking-wider opacity-70">Sem</span>
                      <span class="text-sm sm:text-base leading-none">{{ week }}</span>
                      @if (weekHasData(week)) {
                        <span class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400"></span>
                      }
                    </button>
                  }
                </div>
              </div>
            </div>

            <!-- Input Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x md:divide-slate-100 dark:md:divide-slate-700">

              <!-- Midweek Meeting -->
              <div class="flex flex-col gap-4 sm:gap-5 md:pr-8">

                <!-- Section header -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <div class="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-900/30">
                      <svg class="w-4.5 h-4.5 text-brand-purple" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div>
                      <h3 class="font-bold text-slate-800 dark:text-slate-100">Entre Semana</h3>
                      @if (congregacionConfig()?.dia_reunion_entre_semana) {
                        <p class="text-[0.625rem] font-bold text-slate-400 leading-none mt-0.5">
                          {{ congregacionConfig()!.dia_reunion_entre_semana }}
                          @if (congregacionConfig()!.hora_reunion_entre_semana) { · {{ formatTime12(congregacionConfig()!.hora_reunion_entre_semana) }} }
                        </p>
                      }
                      @if (nextMidweekDate()) {
                        <span class="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md text-[0.6rem] font-bold"
                              [class]="nextMidweekDate()!.isToday
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-purple-50 dark:bg-purple-900/20 text-brand-purple'">
                          <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          {{ nextMidweekDate()!.isToday ? 'Hoy' : 'Próxima: ' + nextMidweekDate()!.label }}
                        </span>
                      }
                    </div>
                  </div>
                  @if (currentMidweekDate()) {
                    <span class="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-brand-purple text-[0.6875rem] font-bold border border-purple-100 dark:border-purple-800/40">
                      {{ currentMidweekDate() }}
                    </span>
                  }
                </div>

                <!-- Inputs or empty state -->
                @if (selectedWeek() > midweekWeekCount()) {
                  <div class="flex items-center justify-center h-[8.5rem] rounded-2xl bg-slate-50 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <span class="text-xs font-bold text-slate-400">Sin reunión esta semana</span>
                  </div>
                } @else {
                  <!-- Editable inputs: white bg + colored border signals interactivity -->
                  <div class="grid gap-3" [class.grid-cols-2]="congregacionConfig()?.usa_zoom !== 0" [class.grid-cols-1]="congregacionConfig()?.usa_zoom === 0">
                    <div class="flex flex-col gap-1.5 group">
                      <label class="flex items-center gap-1.5 text-[0.625rem] font-bold text-brand-purple uppercase tracking-wide">
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Presencial
                      </label>
                      <input type="number" min="0"
                             [ngModel]="midweekWeeks()[selectedWeek() - 1]"
                             (ngModelChange)="updateMidweekWeek($event)"
                             [disabled]="!hasEditPermission()"
                             class="w-full h-16 bg-white dark:bg-slate-800 border-2 border-purple-200 dark:border-purple-700/60 rounded-xl text-center text-2xl font-black text-slate-800 dark:text-slate-100 hover:border-purple-400 focus:border-brand-purple focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900/30 transition-all outline-none cursor-text shadow-sm disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:disabled:bg-slate-900/40 dark:disabled:border-slate-800/50"
                             placeholder="0">
                    </div>
                    @if (congregacionConfig()?.usa_zoom !== 0) {
                      <div class="flex flex-col gap-1.5 group">
                        <label class="flex items-center gap-1.5 text-[0.625rem] font-bold text-brand-purple uppercase tracking-wide">
                          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Zoom
                        </label>
                        <input type="number" min="0"
                               [ngModel]="midweekZoomWeeks()[selectedWeek() - 1]"
                               (ngModelChange)="updateMidweekZoomWeek($event)"
                               [disabled]="!hasEditPermission()"
                               class="w-full h-16 bg-white dark:bg-slate-800 border-2 border-purple-200 dark:border-purple-700/60 rounded-xl text-center text-2xl font-black text-slate-800 dark:text-slate-100 hover:border-purple-400 focus:border-brand-purple focus:ring-4 focus:ring-purple-100 dark:focus:ring-purple-900/30 transition-all outline-none cursor-text shadow-sm disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:disabled:bg-slate-900/40 dark:disabled:border-slate-800/50"
                               placeholder="0">
                      </div>
                    }
                  </div>
                }

                <!-- Read-only total semana: muted, no edit cue -->
                <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/60">
                  <div class="flex items-center gap-2">
                    <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">Total semana</span>
                  </div>
                  <span class="text-2xl font-black text-slate-700 dark:text-slate-200">{{ currentMidweekTotal() }}</span>
                </div>

                <!-- Read-only total mes: accent color but clearly non-editable -->
                <div class="flex items-center justify-between px-4 py-3.5 bg-purple-50/60 dark:bg-purple-900/10 rounded-2xl border border-purple-100/80 dark:border-purple-800/30">
                  <div class="flex items-center gap-2">
                    <svg class="w-3.5 h-3.5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span class="font-bold text-slate-500 dark:text-slate-400 text-sm">Total Mes</span>
                  </div>
                  <span class="text-2xl font-black text-brand-purple">{{ midweekMonthTotal() }}</span>
                </div>

              </div>

              <!-- Weekend Meeting -->
              <div class="flex flex-col gap-4 sm:gap-5 md:pl-8 mt-6 pt-6 border-t border-slate-100 dark:border-slate-700 md:mt-0 md:pt-0 md:border-0">

                <!-- Section header -->
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <div class="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-900/30">
                      <svg class="w-4.5 h-4.5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div>
                      <h3 class="font-bold text-slate-800 dark:text-slate-100">Fin de Semana</h3>
                      @if (congregacionConfig()?.dia_reunion_fin_semana) {
                        <p class="text-[0.625rem] font-bold text-slate-400 leading-none mt-0.5">
                          {{ congregacionConfig()!.dia_reunion_fin_semana }}
                          @if (congregacionConfig()!.hora_reunion_fin_semana) { · {{ formatTime12(congregacionConfig()!.hora_reunion_fin_semana) }} }
                        </p>
                      }
                      @if (nextWeekendDate()) {
                        <span class="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-md text-[0.6rem] font-bold"
                              [class]="nextWeekendDate()!.isToday
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'">
                          <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          {{ nextWeekendDate()!.isToday ? 'Hoy' : 'Próxima: ' + nextWeekendDate()!.label }}
                        </span>
                      }
                    </div>
                  </div>
                  @if (currentWeekendDate()) {
                    <span class="px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 text-[0.6875rem] font-bold border border-orange-100 dark:border-orange-800/40">
                      {{ currentWeekendDate() }}
                    </span>
                  }
                </div>

                <!-- Inputs or empty state -->
                @if (selectedWeek() > weekendWeekCount()) {
                  <div class="flex items-center justify-center h-[8.5rem] rounded-2xl bg-slate-50 dark:bg-slate-900/40 border-2 border-dashed border-slate-200 dark:border-slate-700">
                    <span class="text-xs font-bold text-slate-400">Sin reunión esta semana</span>
                  </div>
                } @else {
                  <div class="grid gap-3" [class.grid-cols-2]="congregacionConfig()?.usa_zoom !== 0" [class.grid-cols-1]="congregacionConfig()?.usa_zoom === 0">
                    <div class="flex flex-col gap-1.5 group">
                      <label class="flex items-center gap-1.5 text-[0.625rem] font-bold text-orange-500 uppercase tracking-wide">
                        <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Presencial
                      </label>
                      <input type="number" min="0"
                             [ngModel]="weekendWeeks()[selectedWeek() - 1]"
                             (ngModelChange)="updateWeekendWeek($event)"
                             [disabled]="!hasEditPermission()"
                             class="w-full h-16 bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-700/60 rounded-xl text-center text-2xl font-black text-slate-800 dark:text-slate-100 hover:border-orange-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 transition-all outline-none cursor-text shadow-sm disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:disabled:bg-slate-900/40 dark:disabled:border-slate-800/50"
                             placeholder="0">
                    </div>
                    @if (congregacionConfig()?.usa_zoom !== 0) {
                      <div class="flex flex-col gap-1.5 group">
                        <label class="flex items-center gap-1.5 text-[0.625rem] font-bold text-orange-500 uppercase tracking-wide">
                          <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          Zoom
                        </label>
                        <input type="number" min="0"
                               [ngModel]="weekendZoomWeeks()[selectedWeek() - 1]"
                               (ngModelChange)="updateWeekendZoomWeek($event)"
                               [disabled]="!hasEditPermission()"
                               class="w-full h-16 bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-700/60 rounded-xl text-center text-2xl font-black text-slate-800 dark:text-slate-100 hover:border-orange-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100 dark:focus:ring-orange-900/30 transition-all outline-none cursor-text shadow-sm disabled:bg-slate-50 disabled:border-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed dark:disabled:bg-slate-900/40 dark:disabled:border-slate-800/50"
                               placeholder="0">
                      </div>
                    }
                  </div>
                }

                <!-- Read-only total semana -->
                <div class="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700/60">
                  <div class="flex items-center gap-2">
                    <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                    <span class="text-xs font-bold text-slate-400 uppercase tracking-wide">Total semana</span>
                  </div>
                  <span class="text-2xl font-black text-slate-700 dark:text-slate-200">{{ currentWeekendTotal() }}</span>
                </div>

                <!-- Read-only total mes -->
                <div class="flex items-center justify-between px-4 py-3.5 bg-orange-50/60 dark:bg-orange-900/10 rounded-2xl border border-orange-100/80 dark:border-orange-800/30">
                  <div class="flex items-center gap-2">
                    <svg class="w-3.5 h-3.5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <span class="font-bold text-slate-500 dark:text-slate-400 text-sm">Total Mes</span>
                  </div>
                  <span class="text-2xl font-black text-orange-500">{{ weekendMonthTotal() }}</span>
                </div>

              </div>

            </div>
          </div>

        </div>

        <!-- Right Column: Sidebar Widgets -->
        <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 sm:gap-6 xl:sticky xl:top-0 content-start">

          <!-- Averages Widget -->
          <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div class="flex items-center gap-3 mb-6">
              <div class="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
              </div>
              <h3 class="font-bold text-slate-800 dark:text-slate-100 leading-tight text-glow-indigo">Promedios<br>Mes Actual</h3>
            </div>

            <div class="space-y-4">
              <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div class="p-2.5 bg-purple-100 dark:bg-purple-900/40 text-brand-purple rounded-lg">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div class="flex-1">
                  <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wide">Entre Semana</p>
                  <div class="flex items-baseline gap-2">
                    <span class="text-2xl font-black text-slate-800 dark:text-slate-100">{{ midweekAverage() }}</span>
                    @if (midweekFilledCount() > 0) {
                      <span class="text-[0.625rem] font-bold text-slate-400">{{ midweekFilledCount() }} sem.</span>
                    }
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div class="p-2.5 bg-orange-100 dark:bg-orange-900/40 text-orange-600 rounded-lg">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div class="flex-1">
                  <p class="text-[0.625rem] font-bold text-slate-400 uppercase tracking-wide">Fin de Semana</p>
                  <div class="flex items-baseline gap-2">
                    <span class="text-2xl font-black text-slate-800 dark:text-slate-100">{{ weekendAverage() }}</span>
                    @if (weekendFilledCount() > 0) {
                      <span class="text-[0.625rem] font-bold text-slate-400">{{ weekendFilledCount() }} sem.</span>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Week Summary Widget -->
          <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
            <div class="flex items-center gap-3 mb-5">
              <div class="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm">Semanas Registradas</h3>
            </div>

            <div class="grid grid-cols-5 gap-2">
              @for (week of weeksArray(); track week) {
                <div class="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-colors"
                     [ngClass]="weekHasData(week) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-slate-50 dark:bg-slate-900/30'">
                  <span class="text-[0.625rem] font-bold uppercase text-slate-400">S{{ week }}</span>
                  @if (weekHasData(week)) {
                    <svg class="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                  } @else {
                    <svg class="w-4 h-4 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Info Tip -->
          <div class="bg-amber-50 dark:bg-amber-900/10 rounded-2xl p-5 border border-amber-200/60 dark:border-amber-800/40 flex gap-4">
            <div class="shrink-0">
              <svg class="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            </div>
            <p class="text-xs font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
              Ingrese la asistencia <b>Presencial</b> y por <b>Zoom</b> por separado. El sistema sumará ambas automáticamente.
            </p>
          </div>
          
          <!-- Bottom visual closure -->
          <div class="flex items-center justify-center py-4 opacity-20 pointer-events-none">
            <div class="w-12 h-1 bg-slate-400 rounded-full"></div>
          </div>

        </div>

      </div>

      } @else {

      <!-- Resumen Anual Tab -->
      <div class="animate-fadeIn flex flex-col gap-6">

        <!-- Year selector -->
        <div class="shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3 w-full sm:w-fit">
          <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Año de Servicio</span>
          <select [ngModel]="resumenServiceYear()" (ngModelChange)="resumenServiceYear.set(+$event)"
                  class="bg-transparent border-0 text-sm font-bold text-slate-800 dark:text-slate-100 cursor-pointer focus:ring-0 pr-6">
            @for (y of serviceYears; track y) {
              <option [value]="y">{{ y }}</option>
            }
          </select>
          <span class="text-xs font-medium text-slate-400">Sep {{ resumenServiceYear() - 1 }} – Ago {{ resumenServiceYear() }}</span>
        </div>

        <!-- Summary Table Card -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/30">
            <div class="flex items-center gap-3">
              <div class="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
              </div>
              <div>
                <h3 class="font-bold text-slate-800 dark:text-slate-100 text-lg leading-tight">Resumen Anual</h3>
                <p class="text-xs text-slate-400 font-medium">Año de Servicio {{ resumenServiceYear() }}</p>
              </div>
            </div>
            @if (loadingResumen()) {
              <div class="flex items-center gap-2 text-xs font-medium text-slate-400">
                <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="30 70" stroke-linecap="round"/></svg>
                Cargando...
              </div>
            }
          </div>

          <div class="overflow-x-auto">
            <table class="w-full">
              <thead class="bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th class="px-5 py-3.5 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Mes</th>
                  <th colspan="3" class="px-3 py-3.5 text-center text-xs font-bold text-purple-500 uppercase tracking-wider border-l border-slate-100 dark:border-slate-700">Entre Semana</th>
                  <th colspan="3" class="px-3 py-3.5 text-center text-xs font-bold text-orange-500 uppercase tracking-wider border-l border-slate-100 dark:border-slate-700">Fin de Semana</th>
                </tr>
                <tr class="text-[0.625rem] uppercase tracking-wider">
                  <th class="px-5 py-2"></th>
                  <th class="px-2 py-2 text-center text-slate-400 border-l border-slate-100 dark:border-slate-700">Reun.</th>
                  <th class="px-2 py-2 text-center text-slate-400">Total</th>
                  <th class="px-2 py-2 text-center text-brand-purple font-extrabold">Prom.</th>
                  <th class="px-2 py-2 text-center text-slate-400 border-l border-slate-100 dark:border-slate-700">Reun.</th>
                  <th class="px-2 py-2 text-center text-slate-400">Total</th>
                  <th class="px-2 py-2 text-center text-orange-600 dark:text-orange-400 font-extrabold">Prom.</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/50">
                @for (row of resumenAnualHistorico(); track row.mes) {
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td class="px-5 py-3.5 font-bold text-sm"
                        [ngClass]="row.midweek_total !== null || row.weekend_total !== null ? 'text-slate-700 dark:text-slate-200' : 'text-slate-300 dark:text-slate-600'">
                      {{ row.nombre_mes }}
                    </td>
                    <td class="px-2 py-3.5 text-center text-sm font-medium border-l border-slate-100 dark:border-slate-700"
                        [ngClass]="row.midweek_reuniones > 0 ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600'">
                      {{ row.midweek_reuniones > 0 ? row.midweek_reuniones : '–' }}
                    </td>
                    <td class="px-2 py-3.5 text-center text-sm font-medium"
                        [ngClass]="row.midweek_total !== null ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600'">
                      {{ row.midweek_total !== null ? row.midweek_total : '–' }}
                    </td>
                    <td class="px-2 py-3.5 text-center text-sm font-bold"
                        [ngClass]="row.midweek_promedio !== null ? 'text-brand-purple' : 'text-slate-300 dark:text-slate-600'">
                      {{ row.midweek_promedio !== null ? row.midweek_promedio : '–' }}
                    </td>
                    <td class="px-2 py-3.5 text-center text-sm font-medium border-l border-slate-100 dark:border-slate-700"
                        [ngClass]="row.weekend_reuniones > 0 ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600'">
                      {{ row.weekend_reuniones > 0 ? row.weekend_reuniones : '–' }}
                    </td>
                    <td class="px-2 py-3.5 text-center text-sm font-medium"
                        [ngClass]="row.weekend_total !== null ? 'text-slate-500' : 'text-slate-300 dark:text-slate-600'">
                      {{ row.weekend_total !== null ? row.weekend_total : '–' }}
                    </td>
                    <td class="px-2 py-3.5 text-center text-sm font-bold"
                        [ngClass]="row.weekend_promedio !== null ? 'text-orange-600 dark:text-orange-400' : 'text-slate-300 dark:text-slate-600'">
                      {{ row.weekend_promedio !== null ? row.weekend_promedio : '–' }}
                    </td>
                  </tr>
                }
                @empty {
                  <tr>
                    <td colspan="7" class="px-5 py-8 text-center text-sm text-slate-400">
                      Sin datos de resumen para este año de servicio
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

      </div>

      }

    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-slideDown {
      animation: slideDown 0.3s ease-out;
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-12px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .text-glow {
      text-shadow: 0 0 15px rgba(100, 116, 139, 0.1);
    }
    .text-glow-indigo {
      text-shadow: 0 0 15px rgba(79, 70, 229, 0.2);
    }
    .shadow-inner-sm {
      box-shadow: inset 0 1px 2px 0 rgba(0, 0, 0, 0.05);
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

  // ── Dirty tracking: snapshot of last loaded/saved state ──
  private savedSnapshot = signal<{
    mwPres: (number | null)[];
    mwZoom: (number | null)[];
    wePres: (number | null)[];
    weZoom: (number | null)[];
  }>({ mwPres: [null,null,null,null,null], mwZoom: [null,null,null,null,null], wePres: [null,null,null,null,null], weZoom: [null,null,null,null,null] });

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
  activeTab = signal<'registro' | 'resumen'>('registro');
  resumenServiceYear = signal<number>(this.defaultResumenServiceYear());
  resumenAnualHistorico = signal<ResumenMensualAsistencia[]>([]);
  loadingResumen = signal(false);

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
    const meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const dias  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
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

    // Load resumen historico when resumen tab is active or year changes
    effect(() => {
      const tab = this.activeTab();
      const anoServicio = this.resumenServiceYear();
      const congId = this.congregacionCtx.effectiveCongregacionId();
      if (tab === 'resumen' && congId) {
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
      error: () => {},
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
    const year  = today.getFullYear();
    const month = today.getMonth() + 1;
    const d     = today.getDate();

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
