import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ActaService } from '../../../secretario-tools/services/acta.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { Tarea } from '../../../secretario-tools/models/acta.model';
import { TareaDetailPanelComponent } from '../../../secretario-tools/tareas/components/tarea-detail-panel.component';

type FiltroEstado = 'todas' | 'pendiente' | 'en_progreso' | 'completada' | 'cancelada';
type FiltroPrioridad = 'todas' | 'alta' | 'media' | 'baja';

@Component({
  standalone: true,
  selector: 'app-mis-tareas',
  imports: [CommonModule, FormsModule, TareaDetailPanelComponent],
  template: `
    <div class="h-full rounded-2xl overflow-x-hidden overflow-y-auto bg-gray-50/50 dark:bg-slate-900">

      <!-- Page Header -->
      <div class="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <div class="header-icon w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-500 flex items-center justify-center shadow-sm shadow-rose-500/20 shrink-0">
            <svg class="w-4 h-4 sm:w-5 sm:h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <div class="header-text min-w-0">
            <h1 class="font-display font-bold text-sm sm:text-base leading-tight text-gray-900 dark:text-white">Mis Tareas</h1>
            <p class="text-xs text-gray-400 dark:text-slate-500 mt-0.5 hidden sm:block">Asignaciones y recordatorios personales</p>
          </div>
        </div>
        <!-- Mobile: icon-only, Desktop: icon + text -->
        <button
          (click)="recargar()"
          [disabled]="loading()"
          title="Actualizar"
          class="header-action inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-600 disabled:opacity-50 transition-all duration-200 shrink-0 w-8 h-8 justify-center sm:w-auto sm:h-auto sm:px-3 sm:py-1.5">
          <svg class="w-3.5 h-3.5 shrink-0" [class.animate-spin]="loading()" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          <span class="hidden sm:inline text-xs font-medium">{{ loading() ? 'Cargando...' : 'Actualizar' }}</span>
        </button>
      </div>

      <!-- Content -->
      <div class="p-4 sm:p-5 lg:p-6 space-y-4">

        <!-- Stats: iconos compactos en móvil -->
        <div class="flex gap-2 sm:hidden">

          <button (click)="setFiltroEstado('pendiente')" title="Pendientes"
            class="stat-chip relative shrink-0 w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border flex items-center justify-center transition-all duration-200 active:scale-95"
            [ngClass]="filtroEstado() === 'pendiente' && !mostrandoVencidas() && !mostrandoHoy()
              ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/20'
              : 'border-gray-100 dark:border-slate-700'">
            <svg class="w-4 h-4 text-rose-500 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <span *ngIf="statsPendientes() > 0"
              class="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold tabular-nums flex items-center justify-center leading-none">
              {{ statsPendientes() }}
            </span>
          </button>

          <button (click)="setFiltroEstado('en_progreso')" title="En progreso"
            class="stat-chip relative shrink-0 w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border flex items-center justify-center transition-all duration-200 active:scale-95"
            [ngClass]="filtroEstado() === 'en_progreso' && !mostrandoVencidas() && !mostrandoHoy()
              ? 'border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20'
              : 'border-gray-100 dark:border-slate-700'">
            <svg class="w-4 h-4 text-amber-500 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <span *ngIf="statsEnProgreso() > 0"
              class="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold tabular-nums flex items-center justify-center leading-none">
              {{ statsEnProgreso() }}
            </span>
          </button>

          <button (click)="setFiltroVencidas()" title="Vencidas"
            class="stat-chip relative shrink-0 w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border flex items-center justify-center transition-all duration-200 active:scale-95"
            [ngClass]="mostrandoVencidas()
              ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-100 dark:border-slate-700'">
            <svg class="w-4 h-4 text-red-500 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <span *ngIf="statsVencidas() > 0"
              class="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold tabular-nums flex items-center justify-center leading-none">
              {{ statsVencidas() }}
            </span>
          </button>

          <button (click)="setFiltroHoy()" title="Para hoy"
            class="stat-chip relative shrink-0 w-11 h-11 rounded-xl bg-white dark:bg-slate-800 border flex items-center justify-center transition-all duration-200 active:scale-95"
            [ngClass]="mostrandoHoy()
              ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20'
              : 'border-gray-100 dark:border-slate-700'">
            <svg class="w-4 h-4 text-orange-500 dark:text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span *ngIf="statsParaHoy() > 0"
              class="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold tabular-nums flex items-center justify-center leading-none">
              {{ statsParaHoy() }}
            </span>
          </button>

        </div>

        <!-- Stats: grilla 2×2 / 4 columnas en sm+ -->
        <div class="hidden sm:grid sm:grid-cols-4 gap-3">

          <button (click)="setFiltroEstado('pendiente')"
            class="stat-card group bg-white dark:bg-slate-800 rounded-xl border p-4 flex items-center gap-3 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-px"
            [class.border-rose-200]="filtroEstado() === 'pendiente' && !mostrandoVencidas() && !mostrandoHoy()"
            [class.dark:border-rose-800]="filtroEstado() === 'pendiente' && !mostrandoVencidas() && !mostrandoHoy()"
            [class.shadow-sm]="filtroEstado() === 'pendiente' && !mostrandoVencidas() && !mostrandoHoy()"
            [class.border-gray-100]="!(filtroEstado() === 'pendiente' && !mostrandoVencidas() && !mostrandoHoy())"
            [class.dark:border-slate-700]="!(filtroEstado() === 'pendiente' && !mostrandoVencidas() && !mostrandoHoy())"
            style="animation-delay:0s">
            <div class="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-900/20 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/30 flex items-center justify-center shrink-0 transition-colors duration-200">
              <svg class="w-5 h-5 text-rose-500 dark:text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-2xl font-bold text-gray-900 dark:text-white leading-none tabular-nums">{{ statsPendientes() }}</p>
              <p class="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest mt-1">Pendientes</p>
            </div>
          </button>

          <button (click)="setFiltroEstado('en_progreso')"
            class="stat-card group bg-white dark:bg-slate-800 rounded-xl border p-4 flex items-center gap-3 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-px"
            [class.border-amber-200]="filtroEstado() === 'en_progreso' && !mostrandoVencidas() && !mostrandoHoy()"
            [class.dark:border-amber-800]="filtroEstado() === 'en_progreso' && !mostrandoVencidas() && !mostrandoHoy()"
            [class.shadow-sm]="filtroEstado() === 'en_progreso' && !mostrandoVencidas() && !mostrandoHoy()"
            [class.border-gray-100]="!(filtroEstado() === 'en_progreso' && !mostrandoVencidas() && !mostrandoHoy())"
            [class.dark:border-slate-700]="!(filtroEstado() === 'en_progreso' && !mostrandoVencidas() && !mostrandoHoy())"
            style="animation-delay:0.07s">
            <div class="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 flex items-center justify-center shrink-0 transition-colors duration-200">
              <svg class="w-5 h-5 text-amber-500 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-2xl font-bold text-gray-900 dark:text-white leading-none tabular-nums">{{ statsEnProgreso() }}</p>
              <p class="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest mt-1">En progreso</p>
            </div>
          </button>

          <button (click)="setFiltroVencidas()"
            class="stat-card group bg-white dark:bg-slate-800 rounded-xl border p-4 flex items-center gap-3 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-px"
            [class.border-red-200]="mostrandoVencidas()"
            [class.dark:border-red-800]="mostrandoVencidas()"
            [class.shadow-sm]="mostrandoVencidas()"
            [class.border-gray-100]="!mostrandoVencidas()"
            [class.dark:border-slate-700]="!mostrandoVencidas()"
            style="animation-delay:0.14s">
            <div class="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/20 group-hover:bg-red-100 dark:group-hover:bg-red-900/30 flex items-center justify-center shrink-0 transition-colors duration-200">
              <svg class="w-5 h-5 text-red-500 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-2xl font-bold text-gray-900 dark:text-white leading-none tabular-nums">{{ statsVencidas() }}</p>
              <p class="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest mt-1">Vencidas</p>
            </div>
          </button>

          <button (click)="setFiltroHoy()"
            class="stat-card group bg-white dark:bg-slate-800 rounded-xl border p-4 flex items-center gap-3 text-left transition-all duration-200 hover:shadow-md hover:-translate-y-px"
            [class.border-orange-200]="mostrandoHoy()"
            [class.dark:border-orange-800]="mostrandoHoy()"
            [class.shadow-sm]="mostrandoHoy()"
            [class.border-gray-100]="!mostrandoHoy()"
            [class.dark:border-slate-700]="!mostrandoHoy()"
            style="animation-delay:0.21s">
            <div class="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 group-hover:bg-orange-100 dark:group-hover:bg-orange-900/30 flex items-center justify-center shrink-0 transition-colors duration-200">
              <svg class="w-5 h-5 text-orange-500 dark:text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div class="min-w-0">
              <p class="text-2xl font-bold text-gray-900 dark:text-white leading-none tabular-nums">{{ statsParaHoy() }}</p>
              <p class="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-widest mt-1">Para hoy</p>
            </div>
          </button>

        </div>

        <!-- Toolbar -->
        <div class="toolbar relative z-10 bg-white dark:bg-slate-800/80 rounded-xl border border-gray-100 dark:border-slate-700 p-2 flex flex-col gap-2">
          <!-- Row 1: Search -->
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-slate-500 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input
              type="text"
              [(ngModel)]="searchQueryModel"
              (ngModelChange)="onSearchChange($event)"
              placeholder="Buscar tarea..."
              class="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-gray-50 dark:bg-slate-700/50 border border-transparent text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-700 focus:border-gray-200 dark:focus:border-slate-600 focus:ring-2 focus:ring-rose-500/10 transition-all duration-200"/>
          </div>

          <!-- Row 2: Filters + Priority (same row on mobile) -->
          <div class="flex items-center gap-1.5">
            <div class="hidden sm:flex gap-0.5 overflow-x-auto flex-1 min-w-0">
              <button
                *ngFor="let tab of estadoTabs"
                (click)="setFiltroEstado(tab.value)"
                class="shrink-0 px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-200"
                [ngClass]="filtroEstado() === tab.value && !mostrandoVencidas() && !mostrandoHoy()
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-gray-300'">
                {{ tab.label }}
              </button>
            </div>

            <div class="hidden sm:block h-5 w-px bg-gray-100 dark:bg-slate-700 shrink-0"></div>

            <!-- Custom priority dropdown -->
            <div class="relative shrink-0" (click)="$event.stopPropagation()">
            <button
              (click)="togglePrioridadOpen()"
              class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border"
              [ngClass]="prioridadOpen()
                ? 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-700 dark:text-gray-200 shadow-sm'
                : 'bg-gray-50 dark:bg-slate-700/50 border-transparent text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'">
              <!-- Dot indicator for active filter -->
              <span class="w-2 h-2 rounded-full shrink-0 transition-colors duration-200"
                [ngClass]="getPrioridadDotClass(filtroPrioridad())"></span>
              {{ getPrioridadLabel2(filtroPrioridad()) }}
              <svg class="w-3 h-3 text-gray-400 dark:text-slate-500 transition-transform duration-200"
                [class.rotate-180]="prioridadOpen()"
                viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            <!-- Dropdown panel -->
            <div *ngIf="prioridadOpen()"
              class="prio-dropdown absolute right-0 top-[calc(100%+6px)] w-44 bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 shadow-lg dark:shadow-black/30 overflow-hidden z-50 py-1">
              <button *ngFor="let opt of prioridadOpts"
                (click)="seleccionarPrioridad(opt.value)"
                class="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-colors duration-150"
                [ngClass]="filtroPrioridad() === opt.value
                  ? 'bg-gray-50 dark:bg-slate-700/60 text-gray-900 dark:text-white font-semibold'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700/40 hover:text-gray-900 dark:hover:text-white'">
                <span class="w-2 h-2 rounded-full shrink-0" [ngClass]="opt.dotClass"></span>
                <span>{{ opt.label }}</span>
                <!-- Check for selected -->
                <svg *ngIf="filtroPrioridad() === opt.value"
                  class="w-3 h-3 ml-auto shrink-0 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                </svg>
              </button>
            </div>
          </div>
          </div>
        </div>

        <!-- Loading -->
        <div *ngIf="loading()" class="flex flex-col items-center justify-center py-20 gap-3">
          <div class="w-7 h-7 rounded-full border-2 border-rose-500 border-t-transparent animate-spin"></div>
          <p class="text-sm text-gray-400 dark:text-slate-500">Cargando tareas...</p>
        </div>

        <!-- Error -->
        <div *ngIf="!loading() && error()" class="bg-white dark:bg-slate-800 rounded-xl border border-red-100 dark:border-red-900/30 p-10 flex flex-col items-center gap-3 text-center">
          <div class="w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div>
            <p class="font-semibold text-gray-800 dark:text-gray-200 text-sm">Error al cargar</p>
            <p class="text-xs text-gray-400 dark:text-slate-500 mt-0.5 max-w-xs">{{ error() }}</p>
          </div>
          <button (click)="recargar()" class="px-4 py-2 rounded-lg bg-rose-500 text-white text-xs font-medium hover:bg-rose-600 transition">
            Reintentar
          </button>
        </div>

        <!-- Task list -->
        <div *ngIf="!loading() && !error()">

          <!-- Empty state -->
          <div *ngIf="tareasFiltradas().length === 0" class="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 py-16 sm:py-20 flex flex-col items-center justify-center gap-4 text-center">
            <div class="w-16 h-16 rounded-2xl bg-gray-50 dark:bg-slate-700 flex items-center justify-center">
              <svg class="w-7 h-7 text-gray-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
              </svg>
            </div>
            <div>
              <p class="font-semibold text-gray-700 dark:text-gray-300 text-sm">Sin tareas</p>
              <p class="text-xs text-gray-400 dark:text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">
                <ng-container *ngIf="searchQuery() || filtroEstado() !== 'todas' || filtroPrioridad() !== 'todas' || mostrandoVencidas() || mostrandoHoy()">
                  No hay tareas que coincidan con los filtros aplicados.
                </ng-container>
                <ng-container *ngIf="!searchQuery() && filtroEstado() === 'todas' && filtroPrioridad() === 'todas' && !mostrandoVencidas() && !mostrandoHoy()">
                  Aquí aparecerán las tareas asignadas desde las actas de reunión.
                </ng-container>
              </p>
            </div>
            <button
              *ngIf="searchQuery() || filtroEstado() !== 'todas' || filtroPrioridad() !== 'todas' || mostrandoVencidas() || mostrandoHoy()"
              (click)="limpiarFiltros()"
              class="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-slate-700 transition">
              Limpiar filtros
            </button>
          </div>

          <!-- Count bar -->
          <div *ngIf="tareasFiltradas().length > 0" class="flex items-center justify-between mb-3 px-1">
            <p class="text-xs text-gray-500 dark:text-slate-400">
              <span class="font-semibold text-gray-700 dark:text-gray-300">{{ tareasFiltradas().length }}</span>
              {{ tareasFiltradas().length === 1 ? 'tarea' : 'tareas' }}
            </p>
            <p class="text-xs text-gray-500 dark:text-slate-400">Ordenado por urgencia</p>
          </div>

          <!-- Cards -->
          <div class="space-y-2">
            <div
              *ngFor="let tarea of tareasFiltradas(); let i = index; trackBy: trackTarea"
              class="task-card group bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 flex overflow-hidden hover:shadow-md dark:hover:shadow-black/20 hover:-translate-y-px transition-all duration-200"
              [ngClass]="getCardClass(tarea)"
              [style.animation-delay]="(i * 0.045) + 's'">

              <!-- Main content — clickeable para abrir detalle -->
              <div class="flex-1 p-3 sm:p-4 min-w-0 cursor-pointer" (click)="abrirDetalle(tarea)">

                <!-- Title row -->
                <div class="flex items-start gap-3">
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      class="w-2.5 h-2.5 rounded-full shrink-0 mt-px"
                      [class.animate-pulse]="isVencida(tarea)"
                      [ngClass]="getDotClass(tarea)">
                    </span>
                    <p class="font-semibold text-sm text-gray-900 dark:text-white leading-snug truncate" [title]="tarea.titulo">
                      {{ tarea.titulo }}
                    </p>
                  </div>
                  <span class="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide" [ngClass]="getPrioridadBadge(tarea.prioridad)">
                    {{ getPrioridadLabel(tarea.prioridad) }}
                  </span>
                </div>

                <!-- Description -->
                <p *ngIf="tarea.descripcion" class="text-xs text-gray-500 dark:text-slate-400 mt-1.5 line-clamp-1 ml-3.5">
                  {{ tarea.descripcion }}
                </p>

                <!-- Meta chips -->
                <div class="flex items-center gap-2 mt-2.5 ml-3.5 flex-wrap">

                  <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold" [ngClass]="getEstadoBadge(tarea.estado)">
                    {{ getEstadoLabel(tarea.estado) }}
                  </span>

                  <span *ngIf="esCoordinadorOSuperior"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium"
                    [ngClass]="tarea.asignado_a_nombre
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-400 dark:text-slate-500'">
                    <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                    {{ tarea.asignado_a_nombre ?? 'Sin asignar' }}
                  </span>

                  <button
                    *ngIf="tarea.origen_tipo === 'acta_reunion' && tarea.origen_id"
                    (click)="irAActa(tarea); $event.stopPropagation()"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors duration-150">
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    Acta #{{ tarea.origen_id }}
                  </button>

                  <span
                    *ngIf="tarea.origen_tipo && tarea.origen_tipo !== 'acta_reunion'"
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400">
                    {{ getOrigenLabel(tarea.origen_tipo) }}
                  </span>

                  <span *ngIf="tarea.fecha_limite" class="inline-flex items-center gap-1 text-[10px] font-medium" [ngClass]="getFechaClass(tarea)">
                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                    {{ formatFecha(tarea.fecha_limite) }}
                  </span>

                </div>
              </div>

              <!-- Actions -->
              <div class="flex flex-col items-center justify-center gap-2 px-3.5 border-l border-gray-100 dark:border-slate-700 shrink-0">

                <button
                  *ngIf="tarea.estado !== 'completada' && tarea.estado !== 'cancelada'"
                  (click)="toggleCompletada(tarea); $event.stopPropagation()"
                  [disabled]="updatingIds().has(tarea.id_tarea)"
                  class="w-8 h-8 rounded-lg border border-gray-200 dark:border-slate-600 flex items-center justify-center hover:border-green-300 dark:hover:border-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 transition-all duration-200 group/btn"
                  title="Marcar como completada">
                  <svg
                    class="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover/btn:text-green-500 dark:group-hover/btn:text-green-400 transition-colors duration-150"
                    [class.animate-spin]="updatingIds().has(tarea.id_tarea)"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                </button>

                <div
                  *ngIf="tarea.estado === 'completada'"
                  class="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center" title="Completada">
                  <svg class="w-3.5 h-3.5 text-green-500 dark:text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
                  </svg>
                </div>

                <button
                  (click)="abrirDetalle(tarea); $event.stopPropagation()"
                  class="w-8 h-8 rounded-lg border border-gray-200 dark:border-slate-600 flex items-center justify-center hover:border-rose-300 dark:hover:border-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200 group/view"
                  title="Ver detalle">
                  <svg class="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover/view:text-rose-500 dark:group-hover/view:text-rose-400 transition-colors duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>

              </div>
            </div>
          </div>

        </div>

      </div>

      <!-- Drawer de detalle de tarea -->
      @if (tareaDrawerId()) {
        <div class="fixed inset-0 z-[200] bg-black/30" (click)="tareaDrawerId.set(null)"></div>
        <div class="tarea-drawer fixed top-0 right-0 bottom-0 z-[201] overflow-y-auto"
             style="width:min(480px,100vw);padding:1.25rem;background:#fff;border-left:1px solid #e5e7eb;">
          <app-tarea-detail-panel
            [tareaId]="tareaDrawerId()!"
            [modoDrawer]="true"
            (cerrar)="tareaDrawerId.set(null)"
            (tareaActualizada)="onTareaActualizadaEnDrawer($event)"
            (tareaEliminada)="onTareaEliminadaEnDrawer($event)"
          />
        </div>
      }

    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    @keyframes headerIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes statIn {
      from { opacity: 0; transform: scale(0.96) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes toolbarIn {
      from { opacity: 0; transform: translateY(5px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes taskIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .header-icon { animation: headerIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
    .header-text { animation: headerIn 0.4s cubic-bezier(0.16,1,0.3,1) 0.05s both; }
    .header-action { animation: headerIn 0.4s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
    .stat-card { animation: statIn 0.45s cubic-bezier(0.16,1,0.3,1) both; }
    .stat-chip { animation: statIn 0.4s cubic-bezier(0.16,1,0.3,1) both; }
    .stat-chips-scroll::-webkit-scrollbar { display: none; }
    .toolbar { animation: toolbarIn 0.4s cubic-bezier(0.16,1,0.3,1) 0.25s both; }
    .task-card { opacity: 0; animation: taskIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards; }
    @keyframes dropIn {
      from { opacity: 0; transform: translateY(-4px) scale(0.98); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .prio-dropdown { animation: dropIn 0.15s cubic-bezier(0.16,1,0.3,1) both; }
    @media (prefers-reduced-motion: reduce) {
      .header-icon, .header-text, .header-action,
      .stat-card, .toolbar, .task-card {
        animation: none !important;
        transition: none !important;
      }
      .task-card { opacity: 1 !important; }
    }
    .tarea-drawer { animation: drawerSlideIn 240ms cubic-bezier(0.23, 1, 0.32, 1); }
    @keyframes drawerSlideIn {
      from { transform: translateX(100%); opacity: 0.4; }
      to   { transform: translateX(0);    opacity: 1; }
    }
    :host-context(.dark) .tarea-drawer { background: #0a1120 !important; border-color: #1e2d45 !important; }
  `]
})
export class MisTareasPage implements OnInit {
  private svc = inject(ActaService);
  private store = inject(AuthStore);
  private router = inject(Router);

  tareas = signal<Tarea[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  filtroEstado = signal<FiltroEstado>('pendiente');
  filtroPrioridad = signal<FiltroPrioridad>('todas');
  searchQuery = signal('');
  updatingIds = signal<Set<number>>(new Set());
  mostrandoVencidas = signal(false);
  mostrandoHoy = signal(false);
  tareaDrawerId = signal<number | null>(null);

  searchQueryModel = '';
  prioridadOpen = signal(false);

  prioridadOpts: { value: FiltroPrioridad; label: string; dotClass: string }[] = [
    { value: 'todas', label: 'Toda prioridad', dotClass: 'bg-gray-300 dark:bg-slate-600' },
    { value: 'alta',  label: 'Alta prioridad',  dotClass: 'bg-red-500' },
    { value: 'media', label: 'Media prioridad', dotClass: 'bg-amber-400' },
    { value: 'baja',  label: 'Baja prioridad',  dotClass: 'bg-gray-400 dark:bg-slate-500' },
  ];

  estadoTabs = [
    { label: 'Todas',       value: 'todas'       as FiltroEstado },
    { label: 'Pendientes',  value: 'pendiente'   as FiltroEstado },
    { label: 'En progreso', value: 'en_progreso' as FiltroEstado },
    { label: 'Completadas', value: 'completada'  as FiltroEstado },
  ];

  statsPendientes = computed(() => this.tareas().filter(t => t.estado === 'pendiente').length);
  statsEnProgreso = computed(() => this.tareas().filter(t => t.estado === 'en_progreso').length);

  statsVencidas = computed(() => {
    const hoy = this.hoyStr();
    return this.tareas().filter(t =>
      t.fecha_limite && t.fecha_limite < hoy &&
      t.estado !== 'completada' && t.estado !== 'cancelada'
    ).length;
  });

  statsParaHoy = computed(() => {
    const hoy = this.hoyStr();
    return this.tareas().filter(t =>
      t.fecha_limite && t.fecha_limite.startsWith(hoy) &&
      t.estado !== 'completada' && t.estado !== 'cancelada'
    ).length;
  });

  tareasFiltradas = computed(() => {
    const hoy = this.hoyStr();
    let lista = [...this.tareas()];

    if (this.mostrandoVencidas()) {
      lista = lista.filter(t =>
        t.fecha_limite && t.fecha_limite < hoy &&
        t.estado !== 'completada' && t.estado !== 'cancelada'
      );
    } else if (this.mostrandoHoy()) {
      lista = lista.filter(t =>
        t.fecha_limite && t.fecha_limite.startsWith(hoy) &&
        t.estado !== 'completada' && t.estado !== 'cancelada'
      );
    } else if (this.filtroEstado() !== 'todas') {
      lista = lista.filter(t => t.estado === this.filtroEstado());
    }

    if (this.filtroPrioridad() !== 'todas') {
      lista = lista.filter(t => t.prioridad === this.filtroPrioridad());
    }

    const q = this.searchQuery().toLowerCase().trim();
    if (q) {
      lista = lista.filter(t =>
        t.titulo.toLowerCase().includes(q) ||
        (t.descripcion ?? '').toLowerCase().includes(q)
      );
    }

    return lista.sort((a, b) => {
      const aV = this.isVencida(a) ? 0 : 1;
      const bV = this.isVencida(b) ? 0 : 1;
      if (aV !== bV) return aV - bV;
      const prioOrd: Record<string, number> = { alta: 0, media: 1, baja: 2 };
      const pDiff = (prioOrd[a.prioridad] ?? 1) - (prioOrd[b.prioridad] ?? 1);
      if (pDiff !== 0) return pDiff;
      if (a.fecha_limite && b.fecha_limite) return a.fecha_limite.localeCompare(b.fecha_limite);
      if (a.fecha_limite) return -1;
      if (b.fecha_limite) return 1;
      return b.creado_en.localeCompare(a.creado_en);
    });
  });

  get esCoordinadorOSuperior(): boolean {
    const u = this.store.user();
    const roles = (u?.roles ?? (u?.rol ? [u.rol] : [])).map(r => r.toLowerCase());
    return roles.some(r => ['administrador', 'coordinador', 'secretario', 'gestor aplicación'].includes(r));
  }

  ngOnInit() { this.cargarTareas(); }

  cargarTareas() {
    this.loading.set(true);
    this.error.set(null);
    const userId = this.store.user()?.id;
    const params = this.esCoordinadorOSuperior ? {} : (userId != null ? { asignado_a: userId } : {});
    this.svc.listarTareasGlobal(params).subscribe({
      next: (data) => { this.tareas.set(data); this.loading.set(false); },
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'No se pudo cargar las tareas.');
        this.loading.set(false);
      }
    });
  }

  recargar() { this.cargarTareas(); }

  trackTarea(_: number, tarea: Tarea) { return tarea.id_tarea; }

  setFiltroEstado(v: FiltroEstado) {
    this.mostrandoVencidas.set(false);
    this.mostrandoHoy.set(false);
    this.filtroEstado.set(v);
  }

  setFiltroVencidas() {
    this.mostrandoVencidas.update(v => !v);
    this.mostrandoHoy.set(false);
    this.filtroEstado.set('todas');
  }

  setFiltroHoy() {
    this.mostrandoHoy.update(v => !v);
    this.mostrandoVencidas.set(false);
    this.filtroEstado.set('todas');
  }

  limpiarFiltros() {
    this.mostrandoVencidas.set(false);
    this.mostrandoHoy.set(false);
    this.filtroEstado.set('todas');
    this.filtroPrioridad.set('todas');
    this.searchQuery.set('');
    this.searchQueryModel = '';
  }

  onSearchChange(v: string) { this.searchQuery.set(v); }

  toggleCompletada(tarea: Tarea) {
    const ids = new Set(this.updatingIds());
    ids.add(tarea.id_tarea);
    this.updatingIds.set(ids);
    const prev = tarea.estado;
    this.tareas.update(list =>
      list.map(t => t.id_tarea === tarea.id_tarea ? { ...t, estado: 'completada' as const } : t)
    );
    this.svc.actualizarEstadoTarea(tarea.id_tarea, 'completada').subscribe({
      next: (updated) => {
        this.tareas.update(list => list.map(t => t.id_tarea === updated.id_tarea ? updated : t));
        const s = new Set(this.updatingIds()); s.delete(tarea.id_tarea); this.updatingIds.set(s);
      },
      error: () => {
        this.tareas.update(list =>
          list.map(t => t.id_tarea === tarea.id_tarea ? { ...t, estado: prev } : t)
        );
        const s = new Set(this.updatingIds()); s.delete(tarea.id_tarea); this.updatingIds.set(s);
      }
    });
  }

  abrirDetalle(tarea: Tarea) {
    if (window.innerWidth >= 768) {
      this.tareaDrawerId.set(tarea.id_tarea);
    } else {
      const qp: Record<string, any> = { desde: 'mis-tareas' };
      if (tarea.origen_tipo === 'acta_reunion' && tarea.origen_id) qp['origen_acta'] = tarea.origen_id;
      this.router.navigate(['/herramientas/tareas', tarea.id_tarea], { queryParams: qp });
    }
  }

  onTareaActualizadaEnDrawer(updated: Tarea) {
    this.tareas.update(list => list.map(t => t.id_tarea === updated.id_tarea ? updated : t));
  }

  onTareaEliminadaEnDrawer(id: number) {
    this.tareas.update(list => list.filter(t => t.id_tarea !== id));
    this.tareaDrawerId.set(null);
  }

  irAActa(tarea: Tarea) {
    if (tarea.origen_tipo === 'acta_reunion' && tarea.origen_id)
      this.router.navigate(['/secretario-tools/actas-reunion', tarea.origen_id]);
  }

  private hoyStr(): string { return new Date().toISOString().split('T')[0]; }

  isVencida(t: Tarea): boolean {
    if (!t.fecha_limite || t.estado === 'completada' || t.estado === 'cancelada') return false;
    return t.fecha_limite < this.hoyStr();
  }

  isParaHoy(t: Tarea): boolean {
    return !!t.fecha_limite && t.fecha_limite.startsWith(this.hoyStr());
  }

  getCardClass(t: Tarea): string {
    return t.estado === 'completada' ? 'opacity-60' : '';
  }

  getDotClass(t: Tarea): string {
    if (this.isVencida(t)) return 'bg-red-500';
    if (this.isParaHoy(t)) return 'bg-amber-500';
    if (t.prioridad === 'alta') return 'bg-rose-500';
    if (t.estado === 'completada') return 'bg-green-500';
    if (t.estado === 'en_progreso') return 'bg-amber-500';
    return 'bg-gray-400 dark:bg-slate-500';
  }

  getPrioridadBadge(p: Tarea['prioridad']): string {
    switch (p) {
      case 'alta':  return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
      case 'media': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'baja':  return 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400';
    }
  }

  getPrioridadLabel(p: Tarea['prioridad']): string {
    return { alta: 'Alta', media: 'Media', baja: 'Baja' }[p];
  }

  getEstadoBadge(e: Tarea['estado']): string {
    switch (e) {
      case 'pendiente':   return 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400';
      case 'en_progreso': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
      case 'completada':  return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400';
      case 'cancelada':   return 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400';
    }
  }

  getEstadoLabel(e: Tarea['estado']): string {
    return { pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada', cancelada: 'Cancelada' }[e];
  }

  getFechaClass(t: Tarea): string {
    if (this.isVencida(t)) return 'text-red-500 dark:text-red-400 font-semibold';
    if (this.isParaHoy(t)) return 'text-amber-500 dark:text-amber-400 font-semibold';
    return 'text-gray-400 dark:text-slate-500';
  }

  formatFecha(fecha: string): string {
    const d = new Date(fecha + 'T00:00:00');
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - hoy.getTime()) / 86400000);
    if (diff < 0)  return `Venció hace ${Math.abs(diff)} día${Math.abs(diff) !== 1 ? 's' : ''}`;
    if (diff === 0) return 'Hoy';
    if (diff === 1) return 'Mañana';
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }

  getOrigenLabel(tipo: string): string {
    return { visita_sc: 'Visita SC', transferencia: 'Transferencia', manual: 'Manual' }[tipo] ?? tipo;
  }

  togglePrioridadOpen() { this.prioridadOpen.update(v => !v); }

  seleccionarPrioridad(v: FiltroPrioridad) {
    this.filtroPrioridad.set(v);
    this.prioridadOpen.set(false);
  }

  getPrioridadLabel2(v: FiltroPrioridad): string {
    return this.prioridadOpts.find(o => o.value === v)?.label ?? 'Prioridad';
  }

  getPrioridadDotClass(v: FiltroPrioridad): string {
    return this.prioridadOpts.find(o => o.value === v)?.dotClass ?? 'bg-gray-300';
  }

  @HostListener('document:click')
  onDocumentClick() { this.prioridadOpen.set(false); }
}
