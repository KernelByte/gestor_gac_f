import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { RolesService } from './services/roles.service';
import { Rol } from './models/rol.model';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { getInitialAvatarStyle } from '../../../core/utils/avatar-style.util';

@Component({
  standalone: true,
  selector: 'app-roles-page',
  imports: [CommonModule, ReactiveFormsModule],
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
            <div>
              <h1 class="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">Gestión de Roles</h1>
              <p class="text-slate-500 dark:text-slate-400 mt-1 max-w-2xl text-base">Configure los niveles de acceso y permisos.</p>
            </div>
            <button (click)="openCreatePanel()" 
               class="group shrink-0 inline-flex items-center gap-2 px-6 h-12 bg-[#6D28D9] hover:bg-[#5b21b6] text-white rounded-xl font-display font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-95 hover:shadow-purple-900/30">
               <svg class="w-5 h-5 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
               <span>Nuevo Rol</span>
            </button>
          </div>

          <!-- Filters -->
          <div class="shrink-0 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center gap-2">
             <div class="relative flex-1 w-full group">
                <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#6D28D9] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
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
             <button class="w-full sm:w-auto px-4 py-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600">
                Filtros
             </button>
          </div>

          <!-- Roles Table -->
          <div class="flex-1 min-h-0 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col transition-all duration-300">
            <div class="flex-1 overflow-x-auto overflow-y-auto simple-scrollbar">
            
            <!-- Loading Skeleton -->
            <div *ngIf="loading()" class="p-6 space-y-4">
               <div class="flex items-center gap-4 animate-pulse" *ngFor="let i of [1,2,3,4,5]">
                  <div class="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-lg"></div>
                  <div class="flex-1 h-4 bg-slate-100 dark:bg-slate-800 rounded"></div>
                  <div class="w-24 h-4 bg-slate-100 dark:bg-slate-800 rounded"></div>
               </div>
            </div>

            <table class="w-full border-collapse text-left min-w-[700px]" *ngIf="!loading()">
              <thead class="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Rol</th>
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden lg:table-cell">Descripción</th>
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center">Usuarios</th>
                  <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center">Estado</th>
                  <th class="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"></th>
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
                        <p class="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-tight">{{ rol.nombre_rol }}</p>
                        <p class="text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">ID: {{ rol.id_rol }}</p>
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
                        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-purple-200 dark:hover:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-700 dark:hover:text-purple-400 transition-all active:scale-95 group/btn"
                        title="Ver usuarios con este rol"
                     >
                        <svg class="w-3.5 h-3.5 opacity-70 group-hover/btn:text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        {{ getRoleUserCount(rol.id_rol) }}
                     </button>
                  </td>

                  <!-- Status -->
                  <td class="px-6 py-4 text-center">
                    <div class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-800/30">
                       <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                       Activo
                    </div>
                  </td>

                  <!-- Actions -->
                  <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                       <button (click)="editRol(rol)" class="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-[#6D28D9] transition-all shadow-sm hover:shadow-md hover:shadow-purple-200" title="Editar Rol">
                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                       </button>
                       <button (click)="confirmDelete(rol)" class="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-red-500 transition-all shadow-sm hover:shadow-md hover:shadow-red-200" title="Eliminar Rol">
                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                       </button>
                    </div>
                  </td>
                </tr>

                <!-- Empty State -->
                <tr *ngIf="filteredRoles().length === 0 && !loading()" class="text-center">
                  <td colspan="5" class="py-20">
                    <div class="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                       <div class="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                          <svg class="w-8 h-8 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                       </div>
                       <p class="font-medium">No se encontraron roles</p>
                       <p class="text-sm mt-1 opacity-70">Intenta ajustar tu búsqueda</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            </div>
          </div>
        </div>
      </div>

      <!-- 2. Slide Over Panel (Sibling layout, matches Usuarios standard) -->
      <div class="shrink-0 flex flex-col overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
           fixed inset-0 z-50 md:static md:z-auto md:h-full" [class.w-full]="panelOpen()"
         [class.md:w-[480px]]="panelOpen()" [class.w-0]="!panelOpen()" [class.opacity-100]="panelOpen()"
         [class.opacity-0]="!panelOpen()">

         <!-- Inner container -->
         <div
            class="h-full flex flex-col bg-white dark:bg-slate-900 rounded-l-3xl shadow-2xl shadow-slate-900/10 dark:shadow-black/50 border-l border-slate-100 dark:border-slate-800 overflow-hidden">

            <!-- Gradient Header -->
            <div class="shrink-0 relative overflow-hidden">
               <div class="absolute inset-0 bg-gradient-to-br from-purple-50 via-white to-fuchsia-50/30 dark:from-purple-900/20 dark:via-slate-900 dark:to-slate-800"></div>
               <div
                  class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-purple-100/50 to-transparent rounded-full -mr-16 -mt-16 blur-2xl">
               </div>

               <div class="relative px-8 pt-8 pb-6">
                  <div class="flex items-start justify-between">
                     <div class="flex gap-4">
                        <div
                           class="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6D28D9] to-purple-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-purple-500/30 ring-4 ring-white dark:ring-slate-800">
                           <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                              stroke-linecap="round" stroke-linejoin="round">
                              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                              <circle cx="8.5" cy="7" r="4"></circle>
                              <line x1="20" y1="8" x2="20" y2="14"></line>
                              <line x1="23" y1="11" x2="17" y2="11"></line>
                           </svg>
                        </div>
                        <div>
                           <div class="flex items-center gap-2 mb-1.5">
                              <span class="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest"
                                 [ngClass]="editingRol() ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'">
                                 {{ editingRol() ? 'Modo Edición' : 'Nuevo Registro' }}
                              </span>
                           </div>
                           <h2 class="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight">
                              {{ editingRol() ? 'Editar Rol' : 'Nuevo Rol' }}
                           </h2>
                           <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Defina los datos del rol de usuario</p>
                        </div>
                     </div>
                     <button (click)="closePanel()"
                        class="p-2.5 -mr-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all rounded-xl hover:bg-white/80 dark:hover:bg-slate-700 hover:shadow-sm group">
                        <svg class="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" viewBox="0 0 24 24"
                           fill="none" stroke="currentColor" stroke-width="2.5">
                           <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                     </button>
                  </div>
               </div>
            </div>

            <!-- Form Body -->
            <div class="flex-1 overflow-y-auto simple-scrollbar bg-white dark:bg-slate-900">
               <div class="px-8 py-4">
                  <form [formGroup]="rolForm" class="space-y-8">

                     <!-- Información del Rol -->
                     <div class="space-y-5">
                        <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                           <span class="w-8 h-px bg-slate-200 dark:bg-slate-700"></span>
                           Información del Rol
                        </h3>

                        <div class="space-y-4">
                           <!-- Name Input -->
                           <div class="space-y-1">
                              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300">Nombre del Rol</label>
                              <div class="relative group">
                                 <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <svg class="h-5 w-5 text-slate-400 group-focus-within:text-[#6D28D9] transition-colors"
                                       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                       <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </svg>
                                 </div>
                                 <input type="text" formControlName="nombre_rol" 
                                    class="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl leading-5 bg-slate-50 dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/10 transition-all font-medium sm:text-sm text-slate-800 dark:text-slate-200"
                                    placeholder="Ej: Administrador">
                              </div>
                           </div>

                           <!-- Description Input -->
                           <div class="space-y-1">
                              <label class="block text-sm font-bold text-slate-700 dark:text-slate-300">Descripción</label>
                              <div class="relative group">
                                 <div class="absolute top-3 left-0 pl-3 pointer-events-none">
                                    <svg class="h-5 w-5 text-slate-400 group-focus-within:text-[#6D28D9] transition-colors"
                                       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                       <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                       <polyline points="14 2 14 8 20 8"></polyline>
                                       <line x1="16" y1="13" x2="8" y2="13"></line>
                                       <line x1="16" y1="17" x2="8" y2="17"></line>
                                       <polyline points="10 9 9 9 8 9"></polyline>
                                    </svg>
                                 </div>
                                 <textarea formControlName="descripcion_rol" rows="3" 
                                    class="block w-full pl-10 pr-3 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/10 transition-all font-medium sm:text-sm text-slate-800 dark:text-slate-200 resize-none"
                                    placeholder="Descripción breve del rol..."></textarea>
                              </div>
                           </div>
                        </div>
                     </div>

                  </form>
               </div>
            </div>

            <!-- Footer Actions -->
            <div class="shrink-0 px-4 py-4 sm:px-8 sm:py-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
               <div class="flex items-center justify-between">
                  <p class="text-xs text-slate-400 hidden sm:block">
                     <span class="text-red-400">*</span> Campos obligatorios
                  </p>
                  <div class="flex items-center gap-3 ml-auto">
                     <button (click)="closePanel()"
                        class="px-5 h-11 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm transition-all focus:outline-none hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95">
                        Cancelar
                     </button>
                     <button (click)="save()" [disabled]="rolForm.invalid || saving()"
                        class="px-6 h-11 rounded-xl bg-gradient-to-r from-[#6D28D9] to-purple-700 text-white font-display font-bold text-sm hover:from-purple-700 hover:to-purple-600 shadow-lg shadow-purple-500/25 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none disabled:from-slate-300 disabled:to-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 flex items-center gap-2">
                        <span *ngIf="saving()"
                           class="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></span>
                        {{ saving() ? 'Guardando...' : (editingRol() ? 'Guardar Cambios' : 'Crear Rol') }}
                     </button>
                  </div>
               </div>
            </div>

         </div>
      </div>

      <!-- Modal Confirmación de Eliminación -->
      <div *ngIf="showDeleteModal()" @fadeIn class="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" (click)="cancelDelete()"></div>
        
        <!-- Modal Content -->
        <div class="relative bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-800 p-8 text-center ring-1 ring-slate-900/5">
           
           <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 mb-6 ring-8 ring-red-50/50 dark:ring-red-900/10">
              <svg class="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
           </div>
           
           <h3 class="text-2xl font-display font-black text-slate-900 dark:text-white mb-3">Eliminar Rol</h3>
           
           <p class="text-[15px] leading-relaxed text-slate-500 dark:text-slate-400 mb-8 px-2">
              ¿Estás seguro de eliminar el rol <strong class="text-slate-800 dark:text-white font-bold">"{{ rolToDelete()?.nombre_rol }}"</strong>? Esta acción no se puede deshacer.
           </p>
           
           <div class="flex gap-3 w-full">
              <button (click)="cancelDelete()"
                 class="flex-1 px-4 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold text-[15px] transition-all focus:outline-none hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 border border-slate-200/50 dark:border-slate-700/50">
                 Cancelar
              </button>
              <button (click)="executeDelete()"
                 class="flex-1 px-4 h-12 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-[15px] transition-all focus:outline-none focus:ring-4 focus:ring-red-500/20 active:scale-95 shadow-sm shadow-red-500/20">
                 Sí, Eliminar
              </button>
           </div>
        </div>
      </div>
    </div>
  `
})
export class RolesPage implements OnInit {
  private rolesService = inject(RolesService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private http = inject(HttpClient);

  roles = signal<Rol[]>([]);
  usuarios = signal<any[]>([]); // For counting users per role
  searchTerm = signal('');

  // Computed Signal for Filtering
  filteredRoles = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.roles().filter(r =>
      r.nombre_rol.toLowerCase().includes(term)
    );
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

  // --- Mock Helpers for UI ---
  getRoleStyle(roleName: string): string {
    return getInitialAvatarStyle(roleName);
  }

  getRoleDescription(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('admin')) return 'Acceso total al sistema y configuración global';
    if (n.includes('secret')) return 'Gestión de registros, actas y comunicaciones';
    if (n.includes('super')) return 'Supervisión de grupos de servicio y reportes';
    if (n.includes('coord')) return 'Gestión de actividades, grupos y cronogramas';
    if (n.includes('publicador')) return 'Acceso básico de lectura y reporte personal';
    return 'Rol personalizado del sistema con permisos específicos.';
  }

  getRoleUserCount(id: number): number {
    // Real count based on loaded users
    return this.usuarios().filter(u => u.id_rol_usuario === id).length;
  }

  navigateToUsers(rolId: number) {
    this.router.navigate(['/usuarios'], { queryParams: { rol: rolId } });
  }

  // --- Logic ---

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
      alert('Error al guardar: ' + (err.error?.detail || err.message || 'Error desconocido'));
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
      alert('Error al eliminar: ' + (err.error?.detail || err.message || 'Error desconocido'));
    }
  }
}
