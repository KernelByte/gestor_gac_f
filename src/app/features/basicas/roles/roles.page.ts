import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { ModalComponent, ConfirmDialogComponent, ConfirmService } from '../../../shared/components';
import { RolesService } from './services/roles.service';
import { Rol } from './models/rol.model';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { getInitialAvatarStyle } from '../../../core/utils/avatar-style.util';
import { etiquetaRol } from '../../../core/auth/rol-label';

@Component({
  standalone: true,
  selector: 'app-roles-page',
  imports: [CommonModule, ReactiveFormsModule, ModalComponent, ConfirmDialogComponent],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ],
  template: `
    <div class="flex flex-col md:flex-row h-full overflow-hidden relative" [class.gap-5]="panelOpen()">

      <!-- 1. Main Content Area -->
      <div class="flex-1 flex flex-col min-w-0 h-full transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]">

        <div class="flex flex-col gap-5 h-full w-full overflow-hidden">

          <!-- Header Section -->
          <div class="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div class="hidden md:block">
              <h1 class="page-title">Gestión de Roles</h1>
              <p class="text-slate-500 dark:text-slate-400 mt-1 max-w-2xl text-base">Configure los niveles de acceso y permisos.</p>
            </div>
            <button (click)="openCreatePanel()"
               class="btn-primary btn-lg group shrink-0">
               <svg class="w-5 h-5 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
               <span>Nuevo Rol</span>
            </button>
          </div>

          <!-- KPI Stat Cards -->
          <div @fadeIn class="shrink-0 hidden md:grid grid-cols-3 gap-4">

            <!-- Total Roles -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 md:p-4 flex items-center gap-2 md:gap-3">
              <div class="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 md:w-5 md:h-5 text-brand-purple dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-xs md:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 leading-none mb-1 truncate">Total Roles</p>
                <p class="text-lg md:text-2xl font-bold text-slate-900 dark:text-white leading-none tabular-nums">{{ roles().length }}</p>
              </div>
            </div>

            <!-- Roles Activos -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 md:p-4 flex items-center gap-2 md:gap-3">
              <div class="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 md:w-5 md:h-5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-xs md:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 leading-none mb-1 truncate">Activos</p>
                <p class="text-lg md:text-2xl font-bold text-slate-900 dark:text-white leading-none tabular-nums">{{ roles().length }}</p>
              </div>
            </div>

            <!-- Usuarios Totales -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 md:p-4 flex items-center gap-2 md:gap-3">
              <div class="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-slate-50 dark:bg-slate-950 flex items-center justify-center shrink-0">
                <svg class="w-4 h-4 md:w-5 md:h-5 text-slate-500 dark:text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div class="min-w-0">
                <p class="text-xs md:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 leading-none mb-1 truncate">Usuarios</p>
                <p class="text-lg md:text-2xl font-bold text-slate-900 dark:text-white leading-none tabular-nums">{{ usuarios().length }}</p>
              </div>
            </div>

          </div>

          <!-- Filters -->
          <div class="shrink-0 relative">
            <div class="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-2">
               <div class="relative flex-1 w-full group">
                  <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-brand-purple transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input
                    type="text"
                    [value]="searchTerm()"
                    (input)="updateSearch($event)"
                    (keydown.escape)="clearSearch()"
                    placeholder="Buscar rol..."
                    class="w-full pl-12 pr-4 py-3 bg-transparent border-none rounded-xl text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
                  >
               </div>
               <div class="h-8 w-px bg-slate-100 dark:bg-slate-700 hidden sm:block"></div>
               <button (click)="filtersOpen.set(!filtersOpen())"
                  class="w-full sm:w-auto px-4 py-2 rounded-xl font-bold text-sm transition-colors border flex items-center justify-center gap-2"
                  [class]="filtersOpen() || sortOrder() !== 'az'
                    ? 'bg-brand-purple/10 border-brand-purple/30 text-brand-purple dark:bg-brand-purple/20 dark:border-brand-purple/40 dark:text-purple-300'
                    : 'bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:border-slate-200 dark:hover:border-slate-600'">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="4" y1="6" x2="20" y2="6"></line><line x1="8" y1="12" x2="16" y2="12"></line><line x1="11" y1="18" x2="13" y2="18"></line>
                  </svg>
                  <span>Ordenar</span>
                  <span *ngIf="sortOrder() !== 'az'"
                    class="inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-purple text-white text-xs font-bold leading-none">1</span>
               </button>
            </div>

            <!-- Backdrop para cerrar dropdown -->
            <div *ngIf="filtersOpen()" (click)="filtersOpen.set(false)"
                 class="fixed inset-0 z-40"></div>

            <!-- Dropdown de ordenamiento -->
            <div *ngIf="filtersOpen()" @fadeIn
                 class="absolute right-0 top-full mt-2 z-50 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-lg shadow-slate-900/10 dark:shadow-black/40 border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div class="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                <p class="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Ordenar por</p>
              </div>
              <div class="p-1.5 space-y-0.5">
                <button (click)="setSortOrder('az')"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
                  [class]="sortOrder() === 'az' ? 'bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 dark:text-purple-300 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'">
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h4l2-4 3 12 2-6 2 4h3"/><path d="M3 17h18"/></svg>
                  Nombre A → Z
                  <svg *ngIf="sortOrder() === 'az'" class="w-4 h-4 ml-auto text-brand-purple dark:text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <button (click)="setSortOrder('za')"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
                  [class]="sortOrder() === 'za' ? 'bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 dark:text-purple-300 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'">
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h4l2-4 3 12 2-6 2 4h3"/><path d="M3 17h18"/></svg>
                  Nombre Z → A
                  <svg *ngIf="sortOrder() === 'za'" class="w-4 h-4 ml-auto text-brand-purple dark:text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
                <button (click)="setSortOrder('most-users')"
                  class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left"
                  [class]="sortOrder() === 'most-users' ? 'bg-brand-purple/10 text-brand-purple dark:bg-brand-purple/20 dark:text-purple-300 font-bold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'">
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  Más usuarios primero
                  <svg *ngIf="sortOrder() === 'most-users'" class="w-4 h-4 ml-auto text-brand-purple dark:text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
              </div>
              <div *ngIf="sortOrder() !== 'az'" class="px-3 pb-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button (click)="setSortOrder('az')"
                  class="w-full text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-medium py-1 transition-colors text-center">
                  Restablecer orden
                </button>
              </div>
            </div>
          </div>

          <!-- ═══════════════════════════════════════════════════ -->
          <!-- MOBILE CARD VIEW (md:hidden)                        -->
          <!-- ═══════════════════════════════════════════════════ -->
          <div class="md:hidden flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div class="h-full overflow-y-auto simple-scrollbar">

              <!-- Mobile Loading Skeleton -->
              <div *ngIf="loading()" class="animate-pulse p-3 space-y-2">
                <div *ngFor="let i of [1,2,3,4,5]"
                     class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 flex-1 min-w-0">
                      <div class="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-700 shrink-0"></div>
                      <div class="space-y-1.5 flex-1 min-w-0">
                        <div class="h-3.5 w-28 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                        <div class="h-2.5 w-20 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                      </div>
                    </div>
                    <div class="flex items-center gap-1 shrink-0">
                      <div class="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                      <div class="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                    </div>
                  </div>
                  <div class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-2">
                    <div class="h-5 w-14 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                    <div class="h-5 w-16 bg-slate-100 dark:bg-slate-700 rounded-full"></div>
                  </div>
                </div>
              </div>

              <!-- Mobile Role Cards -->
              <div *ngIf="!loading()" class="p-3 space-y-2">

                <div *ngFor="let rol of filteredRoles()"
                     class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 transition-colors active:bg-slate-50 dark:active:bg-slate-700/50">

                  <!-- Top row: avatar + name + actions -->
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-start gap-3 flex-1 min-w-0">
                      <div [ngClass]="getRoleStyle(rol.nombre_rol)"
                           class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm shadow-sm ring-1 ring-white border border-white/50 mt-0.5">
                        {{ rol.nombre_rol.charAt(0).toUpperCase() }}
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight break-words">{{ etiquetaRol(rol.nombre_rol) }}</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 break-words">{{ rol.descripcion_rol || 'Sin descripción' }}</p>
                      </div>
                    </div>
                    <div class="row-actions shrink-0">
                      <button (click)="editRol(rol)"
                              class="btn-icon-sm"
                              aria-label="Editar rol">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button (click)="confirmDelete(rol)"
                              class="btn-icon-sm tone-danger"
                              aria-label="Eliminar rol">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  </div>

                  <!-- Bottom row: status badge + user count -->
                  <div class="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                    <div class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border"
                         [ngClass]="(rol.activo ?? true)
                           ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                           : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-700'">
                      <div class="w-1.5 h-1.5 rounded-full"
                           [ngClass]="(rol.activo ?? true) ? 'bg-emerald-500 animate-[pulse_2.5s_ease-in-out_infinite]' : 'bg-slate-400'"></div>
                      {{ (rol.activo ?? true) ? 'Activo' : 'Inactivo' }}
                    </div>
                    <button (click)="navigateToUsers(rol.id_rol)"
                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold border border-slate-200 dark:border-slate-600 hover:border-brand-purple/30 hover:bg-brand-purple/10 hover:text-brand-purple dark:hover:text-purple-400 transition-all"
                            title="Ver usuarios con este rol">
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                      {{ getRoleUserCount(rol.id_rol) }} usuarios
                    </button>
                  </div>
                </div>

                <!-- Mobile Empty State — sin búsqueda -->
                <div *ngIf="filteredRoles().length === 0 && !searchTerm()" class="py-16 flex flex-col items-center justify-center text-center">
                  <div class="w-14 h-14 bg-slate-50 dark:bg-slate-950 rounded-full flex items-center justify-center mb-4">
                    <svg class="w-7 h-7 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  </div>
                  <p class="font-semibold text-slate-700 dark:text-slate-300 text-sm">Aún no hay roles</p>
                  <p class="text-xs text-slate-400 dark:text-slate-500 mt-1 mb-5">Crea el primer rol para empezar.</p>
                  <button (click)="openCreatePanel()"
                     class="btn-primary">
                     <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                     Crear primer rol
                  </button>
                </div>

                <!-- Mobile Empty State — búsqueda sin resultados -->
                <div *ngIf="filteredRoles().length === 0 && searchTerm()" class="py-16 flex flex-col items-center justify-center text-center">
                  <div class="w-14 h-14 bg-slate-50 dark:bg-slate-950 rounded-full flex items-center justify-center mb-4">
                    <svg class="w-7 h-7 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </div>
                  <p class="font-medium text-slate-600 dark:text-slate-400 text-sm">Sin resultados para "{{ searchTerm() }}"</p>
                  <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Intenta con otro término.</p>
                </div>

              </div>
            </div>
          </div>

          <!-- ═══════════════════════════════════════════════════ -->
          <!-- DESKTOP TABLE VIEW (hidden on mobile)               -->
          <!-- ═══════════════════════════════════════════════════ -->
          <div class="hidden md:flex flex-col flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300">
            <div class="flex-1 overflow-x-auto overflow-y-auto simple-scrollbar">

              <!-- Desktop Loading Skeleton -->
              <div *ngIf="loading()" class="animate-pulse min-w-[700px]">
                 <div *ngFor="let i of [1,2,3,4,5]"
                      class="flex items-center gap-4 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                    <!-- Rol: avatar + texto -->
                    <div class="flex items-center gap-3 flex-1">
                       <div class="skeleton h-10 w-10 rounded-full shrink-0"></div>
                       <div class="space-y-1.5">
                          <div class="skeleton h-3.5 w-28 rounded-full"></div>
                          <div class="skeleton h-2.5 w-14 rounded-full"></div>
                       </div>
                    </div>
                    <!-- Descripción -->
                    <div class="flex-1 hidden lg:block">
                       <div class="skeleton h-3 w-40 rounded-full"></div>
                    </div>
                    <!-- Usuarios: badge pill -->
                    <div class="w-20 flex justify-center">
                       <div class="skeleton h-6 w-14 rounded-full"></div>
                    </div>
                    <!-- Estado: badge pill -->
                    <div class="w-20 flex justify-center">
                       <div class="skeleton h-6 w-16 rounded-full"></div>
                    </div>
                    <!-- Acciones: dos circles -->
                    <div class="flex items-center gap-1">
                       <div class="skeleton h-8 w-8 rounded-full"></div>
                       <div class="skeleton h-8 w-8 rounded-full"></div>
                    </div>
                 </div>
              </div>

              <table class="w-full border-collapse text-left min-w-[700px]" *ngIf="!loading()">
                <thead class="bg-white/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Rol</th>
                    <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hidden lg:table-cell">Descripción</th>
                    <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 text-center">Usuarios</th>
                    <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 text-center">Estado</th>
                    <th class="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                  <tr *ngFor="let rol of filteredRoles()" class="group transition-colors duration-200 hover:bg-slate-50 dark:hover:bg-slate-800/30">

                    <!-- Name & Avatar -->
                    <td class="px-6 py-4">
                      <div class="flex items-center gap-4">
                        <div [ngClass]="getRoleStyle(rol.nombre_rol)"
                             class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-semibold text-sm shadow-sm ring-1 ring-white border border-white/50">
                          {{ rol.nombre_rol.charAt(0).toUpperCase() }}
                        </div>
                        <div>
                          <p class="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">{{ etiquetaRol(rol.nombre_rol) }}</p>
                          <p class="text-xs font-medium text-slate-500 dark:text-slate-500 mt-0.5">ID: {{ rol.id_rol }}</p>
                        </div>
                      </div>
                    </td>

                    <!-- Description -->
                    <td class="px-6 py-4 hidden lg:table-cell">
                      <p class="text-sm text-slate-600 dark:text-slate-400 font-medium max-w-xs truncate" [title]="rol.descripcion_rol">
                        {{ rol.descripcion_rol || '—' }}
                      </p>
                    </td>

                    <!-- Users Count -->
                    <td class="px-6 py-4 text-center">
                       <button
                          (click)="navigateToUsers(rol.id_rol)"
                          class="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-brand-purple/30 hover:bg-brand-purple/10 hover:text-brand-purple dark:hover:text-purple-400 transition-all active:scale-95 group/btn"
                          title="Ver usuarios con este rol"
                       >
                          <svg class="w-3.5 h-3.5 opacity-70 group-hover/btn:text-brand-purple" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                          {{ getRoleUserCount(rol.id_rol) }}
                       </button>
                    </td>

                    <!-- Status -->
                    <td class="px-6 py-4 text-center">
                      <div class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border"
                           [ngClass]="(rol.activo ?? true)
                             ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                             : 'bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200/50 dark:border-slate-700/50'">
                         <div class="w-1.5 h-1.5 rounded-full"
                              [ngClass]="(rol.activo ?? true) ? 'bg-emerald-500 animate-[pulse_2.5s_ease-in-out_infinite]' : 'bg-slate-400'"></div>
                         {{ (rol.activo ?? true) ? 'Activo' : 'Inactivo' }}
                      </div>
                    </td>

                    <!-- Actions -->
                    <td class="px-6 py-4 text-right">
                      <div class="row-actions transition-all duration-200 opacity-60 group-hover:opacity-100 md:translate-x-1 md:group-hover:translate-x-0">
                         <button (click)="editRol(rol)" class="btn-icon-sm" title="Editar Rol" aria-label="Editar rol">
                           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                         </button>
                         <button (click)="confirmDelete(rol)" class="btn-icon-sm tone-danger" title="Eliminar Rol" aria-label="Eliminar rol">
                           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                         </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Empty State — sin búsqueda activa -->
                  <tr *ngIf="filteredRoles().length === 0 && !loading() && !searchTerm()" class="text-center">
                    <td colspan="5" class="py-20">
                      <div class="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                         <div class="w-16 h-16 bg-slate-50 dark:bg-slate-950 rounded-full flex items-center justify-center mb-4">
                            <svg class="w-8 h-8 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                         </div>
                         <p class="font-semibold text-slate-700 dark:text-slate-300">Aún no hay roles configurados</p>
                         <p class="text-sm mt-1 opacity-70">Crea el primer rol con el botón <button (click)="openCreatePanel()" class="font-bold text-brand-purple dark:text-purple-400 hover:underline">'Nuevo Rol'</button>.</p>
                         <button (click)="openCreatePanel()"
                            class="btn-primary mt-5">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            Crear primer rol
                         </button>
                      </div>
                    </td>
                  </tr>

                  <!-- Empty State — búsqueda sin resultados -->
                  <tr *ngIf="filteredRoles().length === 0 && !loading() && searchTerm()" class="text-center">
                    <td colspan="5" class="py-20">
                      <div class="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                         <div class="w-16 h-16 bg-slate-50 dark:bg-slate-950 rounded-full flex items-center justify-center mb-4">
                            <svg class="w-8 h-8 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                         </div>
                         <p class="font-medium">Sin resultados para "{{ searchTerm() }}"</p>
                         <p class="text-sm mt-1 opacity-70">Intenta con otro término de búsqueda.</p>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

            </div>
          </div>

        </div>
      </div>

      <!-- Panel de creación / edición -->
      <app-modal [open]="panelOpen()" variant="drawer" size="md"
         [title]="editingRol() ? 'Editar Rol' : 'Nuevo Rol'"
         subtitle="Defina los datos del rol de usuario"
         [hasFooter]="true" (openChange)="$event || closePanel()">
         <form [formGroup]="rolForm" class="space-y-4">
            <div>
               <label class="form-label">Nombre del Rol</label>
               <input type="text" formControlName="nombre_rol" class="form-control" placeholder="Ej: Administrador">
            </div>
            <div>
               <label class="form-label">Descripción</label>
               <textarea formControlName="descripcion_rol" rows="3" class="form-control resize-none"
                  placeholder="Descripción breve del rol..."></textarea>
            </div>
         </form>
         <ng-container slot="footer">
            <p class="text-xs text-slate-500 mr-auto"><span class="text-red-500">*</span> Obligatorio</p>
            <button type="button" (click)="closePanel()" class="btn-secondary">Cancelar</button>
            <button type="button" (click)="save()" [disabled]="rolForm.invalid || saving()" class="btn-primary">
               <span *ngIf="saving()" class="spinner-sm text-white"></span>
               {{ saving() ? 'Guardando...' : (editingRol() ? 'Guardar' : 'Crear Rol') }}
            </button>
         </ng-container>
      </app-modal>

      <!-- Confirmación de eliminación -->
      <app-confirm-dialog [open]="showDeleteModal()" title="Eliminar Rol"
         [message]="'¿Estás seguro de eliminar el rol &quot;' + etiquetaRol(rolToDelete()?.nombre_rol) + '&quot;? Esta acción no se puede deshacer.'"
         confirmLabel="Sí, Eliminar" severity="danger"
         (confirmed)="executeDelete()" (openChange)="$event || cancelDelete()"></app-confirm-dialog>

    </div>
  `
})
export class RolesPage implements OnInit {
  /** Texto visible del rol (el nombre real es un identificador). */
  etiquetaRol = etiquetaRol;

  private rolesService = inject(RolesService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private http = inject(HttpClient);
  private confirm = inject(ConfirmService);

  roles = signal<Rol[]>([]);
  usuarios = signal<any[]>([]);
  searchTerm = signal('');
  filtersOpen = signal(false);
  sortOrder = signal<'az' | 'za' | 'most-users'>('az');

  filteredRoles = computed(() => {
    const term = this.searchTerm().toLowerCase();
    const order = this.sortOrder();
    const filtered = this.roles().filter(r =>
      r.nombre_rol.toLowerCase().includes(term)
    );
    if (order === 'za') {
      return [...filtered].sort((a, b) => b.nombre_rol.localeCompare(a.nombre_rol));
    }
    if (order === 'most-users') {
      return [...filtered].sort((a, b) => this.getRoleUserCount(b.id_rol) - this.getRoleUserCount(a.id_rol));
    }
    return [...filtered].sort((a, b) => a.nombre_rol.localeCompare(b.nombre_rol));
  });

  loading = signal(false);
  saving = signal(false);
  panelOpen = signal(false);
  editingRol = signal<Rol | null>(null);

  showDeleteModal = signal(false);
  rolToDelete = signal<Rol | null>(null);

  rolForm: FormGroup;

  constructor() {
    this.rolForm = this.fb.group({
      nombre_rol: ['', [Validators.required, Validators.minLength(3)]],
      descripcion_rol: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    this.loadRoles();
  }

  updateSearch(event: any) {
    this.searchTerm.set(event.target.value);
  }

  clearSearch() {
    this.searchTerm.set('');
  }

  setSortOrder(order: 'az' | 'za' | 'most-users') {
    this.sortOrder.set(order);
    this.filtersOpen.set(false);
  }

  getRoleStyle(roleName: string): string {
    return getInitialAvatarStyle(roleName);
  }

  getRoleUserCount(id: number): number {
    return this.usuarios().filter(u => u.id_rol_usuario === id).length;
  }

  navigateToUsers(rolId: number) {
    this.router.navigate(['/usuarios'], { queryParams: { rol: rolId } });
  }

  async loadRoles() {
    this.loading.set(true);
    try {
      const [roles, usuarios] = await Promise.all([
        lastValueFrom(this.rolesService.getRoles()),
        lastValueFrom(this.http.get<any[]>('/api/usuarios/'))
      ]);
      this.roles.set(roles);
      this.usuarios.set(usuarios || []);
    } catch (err) {
      console.error('Error cargando roles', err);
    } finally {
      this.loading.set(false);
    }
  }

  openCreatePanel() {
    this.editingRol.set(null);
    this.rolForm.reset();
    this.panelOpen.set(true);
  }

  editRol(rol: Rol) {
    this.editingRol.set(rol);
    this.rolForm.patchValue({
      nombre_rol: rol.nombre_rol,
      descripcion_rol: rol.descripcion_rol
    });
    this.panelOpen.set(true);
  }

  closePanel() {
    this.panelOpen.set(false);
    this.rolForm.reset();
    this.editingRol.set(null);
  }

  async save() {
    if (this.rolForm.invalid) return;

    this.saving.set(true);
    const formVal = this.rolForm.value;

    try {
      if (this.editingRol()) {
        const id = this.editingRol()!.id_rol;
        await lastValueFrom(this.rolesService.updateRol(id, formVal));
      } else {
        await lastValueFrom(this.rolesService.createRol(formVal));
      }
      this.closePanel();
      this.loadRoles();
    } catch (err: any) {
      console.error('Error guardando rol', err);
      await this.confirm.notify({ title: 'Error', message: 'Error al guardar: ' + (err.error?.detail || err.message || 'Error desconocido') });
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(rol: Rol) {
    this.rolToDelete.set(rol);
    this.showDeleteModal.set(true);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
    this.rolToDelete.set(null);
  }

  async executeDelete() {
    const rol = this.rolToDelete();
    if (!rol) return;
    try {
      await lastValueFrom(this.rolesService.deleteRol(rol.id_rol));
      this.cancelDelete();
      this.loadRoles();
    } catch (err: any) {
      console.error("Error al eliminar", err);
      await this.confirm.notify({ title: 'Error', message: 'Error al eliminar: ' + (err.error?.detail || err.message || 'Error desconocido') });
    }
  }
}
