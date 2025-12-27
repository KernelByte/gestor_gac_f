import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { trigger, transition, style, animate, state } from '@angular/animations';

import { PermisosService, PermisoConEstado } from '../services/permisos.service';
import { UsuariosService } from '../services/usuarios.service';
import { Usuario } from '../models/usuario.model';

interface CategoriaPermisos {
   categoria: string;
   icono: SafeHtml;
   permisos: PermisoConEstado[];
   expandido: boolean;
}

@Component({
   selector: 'app-usuario-permisos',
   standalone: true,
   imports: [CommonModule, FormsModule, RouterLink],
   animations: [
      trigger('fadeIn', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(8px)' }),
            animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
         ])
      ]),
      trigger('expandCollapse', [
         state('collapsed', style({ height: '0', opacity: 0, overflow: 'hidden' })),
         state('expanded', style({ height: '*', opacity: 1 })),
         transition('collapsed <=> expanded', animate('250ms ease-in-out'))
      ]),
      trigger('slideUp', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(20px)' }),
            animate('300ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
         ]),
         transition(':leave', [
            animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(20px)' }))
         ])
      ])
   ],
   template: `
   <div class="h-full flex flex-col relative">
      
      <!-- Top Section: Navigation & Header -->
      <div class="shrink-0 flex flex-col gap-4 md:gap-6 mb-4 md:mb-6">
         <!-- Navigation Breadcrumb -->
         <nav class="flex items-center">
            <a routerLink="/usuarios" 
               class="group inline-flex items-center gap-2 text-slate-500 hover:text-purple-600 transition-all duration-200 text-sm font-medium">
               <div class="w-8 h-8 rounded-lg bg-white shadow-sm border border-slate-200 flex items-center justify-center group-hover:shadow-md group-hover:border-purple-200 transition-all">
                  <svg class="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
               </div>
               <span class="group-hover:underline underline-offset-2">Volver a Usuarios</span>
            </a>
         </nav>
         
         <!-- Header Card -->
         <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 md:p-5">
            <div class="flex flex-col sm:flex-row sm:items-center gap-4">
               <!-- Icon & Title -->
               <div class="flex items-center gap-4 flex-1 min-w-0">
                  <div class="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                     <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                  <div class="min-w-0">
                     <h1 class="text-xl font-bold text-slate-800">Permisos de Usuario</h1>
                     <p class="text-sm text-slate-500">Configura los accesos y permisos especiales</p>
                  </div>
               </div>
               
               <!-- User Info -->
               <div *ngIf="usuario()" class="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                  <div class="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                     {{ getInitials(usuario()!) }}
                  </div>
                  <div class="min-w-0">
                     <p class="font-semibold text-slate-700 text-sm truncate">{{ usuario()!.nombre }}</p>
                     <p class="text-xs text-slate-400 truncate">{{ usuario()!.correo }}</p>
                  </div>
                  <span class="ml-2 px-3 py-1.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full whitespace-nowrap">
                     {{ getRolName(usuario()!) }}
                  </span>
               </div>
            </div>
         </div>

         <!-- Toolbar (Search & Stats) -->
         <div *ngIf="!loading()" @fadeIn class="bg-white/80 backdrop-blur-xl rounded-2xl shadow-sm border border-slate-200 p-3 md:p-4">
            <div class="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
               <!-- Stats Badge -->
               <div class="flex items-center gap-2 sm:gap-4 flex-wrap">
                  <div class="flex items-center gap-3 px-3 py-2 md:px-4 md:py-2.5 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200">
                     <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                     <span class="text-sm font-semibold text-emerald-700">
                        {{ totalAsignados() }} de {{ totalPermisos() }} activos
                     </span>
                  </div>
                  
                  <!-- Quick Actions -->
                  <div class="hidden sm:flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                     <button (click)="toggleTodos(true)" 
                        class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Activar todos
                     </button>
                     <button (click)="toggleTodos(false)" 
                        class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                        Desactivar
                     </button>
                  </div>
               </div>
               
               <!-- Search Input -->
               <div class="relative w-full sm:w-72">
                  <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input type="text" 
                     [(ngModel)]="searchQuery"
                     placeholder="Buscar permisos..."
                     class="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-medium focus:outline-none focus:bg-white focus:border-purple-400 focus:shadow-lg focus:shadow-purple-500/10 transition-all placeholder:text-slate-400">
               </div>
            </div>
         </div>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading()" class="flex-1 flex flex-col items-center justify-center gap-5">
         <div class="relative">
            <div class="w-16 h-16 border-4 border-purple-200 rounded-full"></div>
            <div class="absolute inset-0 w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
         </div>
         <p class="text-slate-500 font-medium">Cargando permisos...</p>
      </div>

      <!-- Categories Scrollable Grid -->
      <div *ngIf="!loading()" @fadeIn class="flex-1 min-h-0 overflow-y-auto simple-scrollbar pb-6">
         
         <div class="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 pb-24">
            <div *ngFor="let cat of filteredCategorias()" 
               class="group bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-300 hover:shadow-lg"
               [class.border-slate-200]="true"
               [class.hover:border-amber-300]="getCategoryTheme(cat.categoria) === 'amber'"
               [class.hover:border-purple-300]="getCategoryTheme(cat.categoria) === 'purple'"
               [class.hover:border-emerald-300]="getCategoryTheme(cat.categoria) === 'emerald'"
               [class.hover:border-blue-300]="getCategoryTheme(cat.categoria) === 'blue'">
               
               <!-- Category Header -->
               <button (click)="toggleCategoria(cat)" 
                  class="w-full px-4 py-4 md:px-6 md:py-5 flex items-center gap-4 transition-colors"
                  [ngClass]="getCategoryHoverClass(cat.categoria)">
                  <div class="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:scale-105"
                     [ngClass]="getCategoryBgClass(cat.categoria)">
                     <div class="w-5 h-5 md:w-6 md:h-6" [innerHTML]="getCategoryIcon(cat.categoria)"></div>
                  </div>
                  <div class="flex-1 text-left">
                     <h3 class="text-base md:text-lg font-bold text-slate-800">{{ cat.categoria }}</h3>
                     <p class="text-xs md:text-sm text-slate-500">{{ cat.permisos.length }} permisos disponibles</p>
                  </div>
                  
                  <!-- Progress & Toggle -->
                  <div class="flex items-center gap-3 md:gap-4">
                     <div class="hidden sm:flex flex-col items-end gap-1">
                        <span class="text-sm font-bold"
                           [class.text-amber-600]="getCategoryTheme(cat.categoria) === 'amber'"
                           [class.text-purple-600]="getCategoryTheme(cat.categoria) === 'purple'"
                           [class.text-emerald-600]="getCategoryTheme(cat.categoria) === 'emerald'"
                           [class.text-blue-600]="getCategoryTheme(cat.categoria) === 'blue'">
                           {{ getAssignedCount(cat) }}/{{ cat.permisos.length }}
                        </span>
                        <div class="w-16 md:w-24 h-1.5 md:h-2 bg-slate-200 rounded-full overflow-hidden">
                           <div class="h-full rounded-full transition-all duration-500"
                              [class.bg-amber-500]="getCategoryTheme(cat.categoria) === 'amber'"
                              [class.bg-purple-500]="getCategoryTheme(cat.categoria) === 'purple'"
                              [class.bg-emerald-500]="getCategoryTheme(cat.categoria) === 'emerald'"
                              [class.bg-blue-500]="getCategoryTheme(cat.categoria) === 'blue'"
                              [style.width.%]="(getAssignedCount(cat) / cat.permisos.length) * 100"></div>
                        </div>
                     </div>
                     <div class="w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all"
                        [class.bg-amber-100]="getCategoryTheme(cat.categoria) === 'amber' && cat.expandido"
                        [class.bg-purple-100]="getCategoryTheme(cat.categoria) === 'purple' && cat.expandido"
                        [class.bg-emerald-100]="getCategoryTheme(cat.categoria) === 'emerald' && cat.expandido"
                        [class.bg-blue-100]="getCategoryTheme(cat.categoria) === 'blue' && cat.expandido"
                        [class.bg-slate-100]="!cat.expandido">
                        <svg class="w-4 h-4 md:w-5 md:h-5 transition-transform duration-300" 
                           [class.rotate-180]="cat.expandido"
                           [class.text-amber-600]="getCategoryTheme(cat.categoria) === 'amber'"
                           [class.text-purple-600]="getCategoryTheme(cat.categoria) === 'purple'"
                           [class.text-emerald-600]="getCategoryTheme(cat.categoria) === 'emerald'"
                           [class.text-blue-600]="getCategoryTheme(cat.categoria) === 'blue'"
                           fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                           <path d="M19 9l-7 7-7-7"/>
                        </svg>
                     </div>
                  </div>
               </button>
               
               <!-- Permissions List -->
               <div [@expandCollapse]="cat.expandido ? 'expanded' : 'collapsed'">
                  <!-- Quick Actions Bar -->
                  <div class="px-4 py-3 md:px-6 flex items-center justify-between border-t border-b"
                     [class.bg-amber-50]="getCategoryTheme(cat.categoria) === 'amber'"
                     [class.border-amber-100]="getCategoryTheme(cat.categoria) === 'amber'"
                     [class.bg-purple-50]="getCategoryTheme(cat.categoria) === 'purple'"
                     [class.border-purple-100]="getCategoryTheme(cat.categoria) === 'purple'"
                     [class.bg-emerald-50]="getCategoryTheme(cat.categoria) === 'emerald'"
                     [class.border-emerald-100]="getCategoryTheme(cat.categoria) === 'emerald'"
                     [class.bg-blue-50]="getCategoryTheme(cat.categoria) === 'blue'"
                     [class.border-blue-100]="getCategoryTheme(cat.categoria) === 'blue'">
                     <span class="text-[10px] md:text-xs font-bold uppercase tracking-wider"
                        [class.text-amber-700]="getCategoryTheme(cat.categoria) === 'amber'"
                        [class.text-purple-700]="getCategoryTheme(cat.categoria) === 'purple'"
                        [class.text-emerald-700]="getCategoryTheme(cat.categoria) === 'emerald'"
                        [class.text-blue-700]="getCategoryTheme(cat.categoria) === 'blue'">
                        Permisos
                     </span>
                     <div class="flex items-center gap-2">
                        <button (click)="toggleCategoriaTodos(cat, true); $event.stopPropagation()"
                           class="px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-xs font-bold rounded-lg transition-colors"
                           [class.text-amber-700]="getCategoryTheme(cat.categoria) === 'amber'"
                           [class.hover:bg-amber-100]="getCategoryTheme(cat.categoria) === 'amber'"
                           [class.text-purple-700]="getCategoryTheme(cat.categoria) === 'purple'"
                           [class.hover:bg-purple-100]="getCategoryTheme(cat.categoria) === 'purple'"
                           [class.text-emerald-700]="getCategoryTheme(cat.categoria) === 'emerald'"
                           [class.hover:bg-emerald-100]="getCategoryTheme(cat.categoria) === 'emerald'"
                           [class.text-blue-700]="getCategoryTheme(cat.categoria) === 'blue'"
                           [class.hover:bg-blue-100]="getCategoryTheme(cat.categoria) === 'blue'">
                           <div class="flex items-center gap-1.5">
                              <svg class="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                              <span>Todos</span>
                           </div>
                        </button>
                        <button (click)="toggleCategoriaTodos(cat, false); $event.stopPropagation()"
                           class="px-2 py-1 md:px-3 md:py-1.5 text-[10px] md:text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                           <div class="flex items-center gap-1.5">
                              <svg class="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
                              <span>Nada</span>
                           </div>
                        </button>
                     </div>
                  </div>
                  
                  <div class="divide-y divide-slate-100">
                     <div *ngFor="let permiso of cat.permisos">
                        <div class="px-4 py-3 md:px-6 md:py-4 flex items-center gap-3 md:gap-4 cursor-pointer transition-colors"
                           (click)="togglePermiso(permiso)"
                           [ngClass]="getCategoryHoverClass(cat.categoria)">
                           
                           <!-- Permission Info -->
                           <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-3">
                                 <div class="w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0"
                                    [class.bg-slate-100]="!permiso.asignado"
                                    [class.text-slate-400]="!permiso.asignado"
                                    [class.bg-purple-100]="permiso.asignado && getCategoryTheme(cat.categoria) === 'purple'"
                                    [class.text-purple-600]="permiso.asignado && getCategoryTheme(cat.categoria) === 'purple'"
                                    [class.bg-amber-100]="permiso.asignado && getCategoryTheme(cat.categoria) === 'amber'"
                                    [class.text-amber-600]="permiso.asignado && getCategoryTheme(cat.categoria) === 'amber'"
                                    [class.bg-emerald-100]="permiso.asignado && getCategoryTheme(cat.categoria) === 'emerald'"
                                    [class.text-emerald-600]="permiso.asignado && getCategoryTheme(cat.categoria) === 'emerald'"
                                    [class.bg-blue-100]="permiso.asignado && getCategoryTheme(cat.categoria) === 'blue'"
                                    [class.text-blue-600]="permiso.asignado && getCategoryTheme(cat.categoria) === 'blue'">
                                    <div class="w-4 h-4" [innerHTML]="getPermisoIconSvg(permiso.codigo)"></div>
                                 </div>
                                 <div>
                                    <h4 class="text-sm md:text-base font-semibold transition-colors leading-tight"
                                       [class.text-slate-800]="permiso.asignado"
                                       [class.text-slate-500]="!permiso.asignado">
                                       {{ permiso.nombre }}
                                    </h4>
                                    <p *ngIf="permiso.descripcion" class="text-[10px] md:text-xs text-slate-400 mt-0.5 line-clamp-1">
                                       {{ permiso.descripcion }}
                                    </p>
                                 </div>
                              </div>
                           </div>
                           
                           <!-- Themed Toggle Switch -->
                           <div class="relative w-10 h-6 md:w-12 md:h-7 rounded-full transition-all duration-300 cursor-pointer flex-shrink-0"
                              [class.bg-amber-500]="permiso.asignado && getCategoryTheme(cat.categoria) === 'amber'"
                              [class.shadow-amber-500/40]="permiso.asignado && getCategoryTheme(cat.categoria) === 'amber'"
                              [class.bg-purple-500]="permiso.asignado && getCategoryTheme(cat.categoria) === 'purple'"
                              [class.shadow-purple-500/40]="permiso.asignado && getCategoryTheme(cat.categoria) === 'purple'"
                              [class.bg-emerald-500]="permiso.asignado && getCategoryTheme(cat.categoria) === 'emerald'"
                              [class.shadow-emerald-500/40]="permiso.asignado && getCategoryTheme(cat.categoria) === 'emerald'"
                              [class.bg-blue-500]="permiso.asignado && getCategoryTheme(cat.categoria) === 'blue'"
                              [class.shadow-blue-500/40]="permiso.asignado && getCategoryTheme(cat.categoria) === 'blue'"
                              [class.bg-slate-300]="!permiso.asignado"
                              [class.shadow-lg]="permiso.asignado">
                              <div class="absolute top-1 left-1 w-4 h-4 md:w-5 md:h-5 bg-white rounded-full shadow-md transition-transform duration-300 flex items-center justify-center mr-1"
                                 [class.translate-x-4]="permiso.asignado" 
                                 [class.md:translate-x-5]="permiso.asignado">
                                 <svg *ngIf="permiso.asignado" class="w-2.5 h-2.5 md:w-3 md:h-3" 
                                    [class.text-amber-500]="getCategoryTheme(cat.categoria) === 'amber'"
                                    [class.text-purple-500]="getCategoryTheme(cat.categoria) === 'purple'"
                                    [class.text-emerald-500]="getCategoryTheme(cat.categoria) === 'emerald'"
                                    [class.text-blue-500]="getCategoryTheme(cat.categoria) === 'blue'"
                                    fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                                    <path d="M5 13l4 4L19 7"/>
                                 </svg>
                              </div>
                           </div>
                        </div>

                        <!-- Config Panel for Informes.Editar -->
                        <div *ngIf="permiso.codigo === 'informes.editar' && permiso.asignado" 
                             class="px-4 pb-3 pl-14 md:px-6 md:pb-4 md:pl-16">
                           <div class="bg-purple-50 rounded-xl border border-purple-200 p-3 md:p-4">
                              <label class="block text-[10px] md:text-xs font-bold text-purple-700 uppercase tracking-wider mb-2 md:mb-3">
                                 Alcance de edición
                              </label>
                              <div class="flex flex-col sm:flex-row flex-wrap sm:items-center gap-2 sm:gap-4">
                                 <label class="flex items-center gap-2 cursor-pointer group">
                                    <input type="radio" name="scope_edit" [value]="'todos'" 
                                           [(ngModel)]="permiso.alcance" (ngModelChange)="updateScope(permiso)" (click)="$event.stopPropagation()"
                                           class="w-4 h-4 text-purple-600 focus:ring-purple-500 border-purple-300">
                                    <span class="text-xs md:text-sm font-medium text-slate-700 group-hover:text-purple-700">Todos los grupos</span>
                                 </label>
                                 <label class="flex items-center gap-2 cursor-pointer group">
                                    <input type="radio" name="scope_edit" [value]="'asignados'" 
                                           [(ngModel)]="permiso.alcance" (ngModelChange)="updateScope(permiso)" (click)="$event.stopPropagation()"
                                           class="w-4 h-4 text-purple-600 focus:ring-purple-500 border-purple-300">
                                    <span class="text-xs md:text-sm font-medium text-slate-700 group-hover:text-purple-700">Solo asignados</span>
                                 </label>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </div>
         
         <!-- Empty State -->
         <div *ngIf="!loading() && filteredCategorias().length === 0" 
            class="flex flex-col items-center justify-center py-20 text-center">
            <div class="w-16 h-16 md:w-20 md:h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
               <svg class="w-8 h-8 md:w-10 md:h-10 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
               </svg>
            </div>
            <p class="text-slate-500 font-medium">No se encontraron permisos</p>
         </div>
      </div>

      <!-- Floating Save Button -->
      <div *ngIf="!loading() && hasChanges()" @slideUp
         class="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pointer-events-none z-30">
         <div class="pointer-events-auto">
            <button (click)="guardar()" [disabled]="saving()"
               class="w-full py-3.5 md:py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed">
               <svg *ngIf="!saving()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                  <polyline points="17 21 17 13 7 13 7 21"/>
                  <polyline points="7 3 7 8 15 8"/>
               </svg>
               <div *ngIf="saving()" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
               {{ saving() ? 'Guardando cambios...' : 'Guardar ' + changesCount() + ' cambios' }}
            </button>
         </div>
      </div>

      <!-- Success Toast -->
      <div *ngIf="showSuccess()" @slideUp
         class="absolute top-6 right-6 left-6 md:left-auto z-50 px-5 py-4 bg-emerald-500 text-white font-semibold rounded-2xl shadow-xl flex items-center gap-3">
         <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center shrink-0">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
               <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
               <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
         </div>
         <div>
            <p class="font-bold">¡Permisos actualizados!</p>
            <p class="text-sm text-emerald-100">Los cambios se guardaron correctamente</p>
         </div>
      </div>
   </div>
   `,
   styles: [`
      .bg-size-200 { background-size: 200% 100%; }
      @keyframes gradient-x {
         0%, 100% { background-position: 0% 50%; }
         50% { background-position: 100% 50%; }
      }
      .animate-gradient-x { animation: gradient-x 3s ease infinite; }
   `]
})
export class UsuarioPermisosPage implements OnInit {
   private route = inject(ActivatedRoute);
   private router = inject(Router);
   private permisosService = inject(PermisosService);
   private usuariosService = inject(UsuariosService);
   private sanitizer = inject(DomSanitizer);

   loading = signal(true);
   saving = signal(false);
   showSuccess = signal(false);
   searchQuery = '';

   usuario = signal<Usuario | null>(null);
   permisos = signal<PermisoConEstado[]>([]);
   permisosOriginales = signal<Set<number>>(new Set());
   categoriasExpandidas = signal<Set<string>>(new Set());

   categorias = computed(() => {
      const porCategoria: Map<string, PermisoConEstado[]> = new Map();

      for (const p of this.permisos()) {
         // Combinar Publicadores y Grupos en una sola categoría
         let catKey = this.getCategoriaNombre(p.codigo);
         if (catKey === 'Grupos') {
            catKey = 'Publicadores y Grupos';
         } else if (catKey === 'Publicadores') {
            catKey = 'Publicadores y Grupos';
         }

         if (!porCategoria.has(catKey)) {
            porCategoria.set(catKey, []);
         }
         porCategoria.get(catKey)!.push(p);
      }

      // Ordenar categorías en un orden específico
      const ordenCategorias = [
         'Publicadores y Grupos',
         'Informes',
         'Territorios',
         'Reuniones',
         'Exhibidores'
      ];

      const expandidas = this.categoriasExpandidas();
      const categoriasOrdenadas = Array.from(porCategoria.entries())
         .sort(([a], [b]) => {
            const indexA = ordenCategorias.indexOf(a);
            const indexB = ordenCategorias.indexOf(b);
            if (indexA === -1 && indexB === -1) return a.localeCompare(b);
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
         })
         .map(([cat, permisos]) => ({
            categoria: cat,
            icono: this.getCategoryIcon(cat),
            permisos,
            expandido: expandidas.has(cat)
         }));

      return categoriasOrdenadas;
   });

   filteredCategorias = computed(() => {
      const query = this.searchQuery.toLowerCase().trim();
      if (!query) return this.categorias();

      return this.categorias()
         .map(cat => ({
            ...cat,
            permisos: cat.permisos.filter(p =>
               p.nombre.toLowerCase().includes(query) ||
               p.descripcion?.toLowerCase().includes(query) ||
               p.codigo.toLowerCase().includes(query)
            ),
            expandido: true
         }))
         .filter(cat => cat.permisos.length > 0);
   });

   totalAsignados = computed(() => this.permisos().filter(p => p.asignado).length);
   totalPermisos = computed(() => this.permisos().length);

   hasChanges = computed(() => {
      const originales = this.permisosOriginales();
      const actuales = new Set(this.permisos().filter(p => p.asignado).map(p => p.id_permiso));

      // Add logic for global globalEditPermisoId if present in scope
      const globalId = (this as any)._globalEditPermisoId;
      if (globalId) {
         const editPermiso = this.permisos().find(p => p.codigo === 'informes.editar');
         if (editPermiso?.asignado && editPermiso.alcance === 'todos') {
            actuales.add(globalId);
         }
      }

      if (originales.size !== actuales.size) return true;
      for (const id of originales) {
         if (!actuales.has(id)) return true;
      }
      return false;
   });

   changesCount = computed(() => {
      const originales = this.permisosOriginales();
      const actuales = new Set(this.permisos().filter(p => p.asignado).map(p => p.id_permiso));

      // Add logic for global globalEditPermisoId if present in scope
      const globalId = (this as any)._globalEditPermisoId;
      if (globalId) {
         const editPermiso = this.permisos().find(p => p.codigo === 'informes.editar');
         if (editPermiso?.asignado && editPermiso.alcance === 'todos') {
            actuales.add(globalId);
         }
      }

      let count = 0;

      for (const id of originales) {
         if (!actuales.has(id)) count++;
      }
      for (const id of actuales) {
         if (!originales.has(id)) count++;
      }
      return count;
   });

   async ngOnInit() {
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (!id) {
         this.router.navigate(['/usuarios']);
         return;
      }

      await this.loadData(id);
   }

   async loadData(idUsuario: number) {
      this.loading.set(true);
      try {
         const [usuarios, permisos] = await Promise.all([
            lastValueFrom(this.usuariosService.getUsuarios()),
            lastValueFrom(this.permisosService.getPermisosUsuario(idUsuario))
         ]);

         const usuario = usuarios.find(u => u.id_usuario === idUsuario);
         if (!usuario) {
            this.router.navigate(['/usuarios']);
            return;
         }

         // Detect Global Scope Permission
         const globalEditPermiso = permisos.find(p => p.codigo === 'informes.editar_todos');
         const hasGlobalEdit = globalEditPermiso?.asignado ?? false;

         // Set scope for informes.editar
         const editPermiso = permisos.find(p => p.codigo === 'informes.editar');
         if (editPermiso) {
            editPermiso.alcance = hasGlobalEdit ? 'todos' : 'asignados';
         }

         // Hide informes.editar_todos from the UI list (it's handled via the scope radio)
         const visiblePermisos = permisos.filter(p => p.codigo !== 'informes.editar_todos');

         // Check/Add mock perms if needed (for visual completeness if not in DB yet, though we added it)
         const hasHistorial = visiblePermisos.some(p => p.codigo === 'informes.historial');
         if (!hasHistorial) {
            visiblePermisos.push({
               id_permiso: 99999,
               codigo: 'informes.historial',
               nombre: 'Ver Historial',
               descripcion: 'Acceso al historial de informes de servicio',
               asignado: false,
               alcance: 'todos'
            });
         }
         visiblePermisos.forEach(p => { if (!p.alcance) p.alcance = 'todos'; });

         this.usuario.set(usuario);
         this.permisos.set(visiblePermisos);

         // Store all original IDs including the hidden global one if assigned
         const originalIds = new Set(permisos.filter(p => p.asignado).map(p => p.id_permiso));
         this.permisosOriginales.set(originalIds);

         // Store reference to hidden permission ID for saving later
         if (globalEditPermiso) {
            (this as any)._globalEditPermisoId = globalEditPermiso.id_permiso;
         }

         this.categoriasExpandidas.set(new Set<string>());
      } catch (err) {
         console.error('Error loading data', err);
      } finally {
         this.loading.set(false);
      }
   }

   toggleCategoria(cat: CategoriaPermisos) {
      this.categoriasExpandidas.update(set => {
         const newSet = new Set(set);
         if (newSet.has(cat.categoria)) {
            newSet.delete(cat.categoria);
         } else {
            newSet.add(cat.categoria);
         }
         return newSet;
      });
   }

   togglePermiso(permiso: PermisoConEstado) {
      this.permisos.update(list =>
         list.map(p => p.id_permiso === permiso.id_permiso
            ? { ...p, asignado: !p.asignado }
            : p
         )
      );
   }

   toggleCategoriaTodos(cat: CategoriaPermisos, value: boolean) {
      const ids = new Set(cat.permisos.map(p => p.id_permiso));
      this.permisos.update(list =>
         list.map(p => ids.has(p.id_permiso) ? { ...p, asignado: value } : p)
      );
   }

   toggleTodos(value: boolean) {
      this.permisos.update(list => list.map(p => ({ ...p, asignado: value })));
   }

   updateScope(permiso: PermisoConEstado) {
      // Force update of permissions signal to trigger hasChanges check
      this.permisos.update(list => [...list]);
   }

   async guardar() {
      if (this.saving() || !this.usuario()) return;

      this.saving.set(true);
      try {
         // Get currently visible active permissions
         const activeIds = this.permisos()
            .filter(p => p.asignado)
            .map(p => p.id_permiso);

         // Helper to add/remove global permission ID
         const globalId = (this as any)._globalEditPermisoId;

         if (globalId) {
            const editPermiso = this.permisos().find(p => p.codigo === 'informes.editar');

            // If Edit is ON and Scope is 'todos', add global ID
            if (editPermiso?.asignado && editPermiso.alcance === 'todos') {
               if (!activeIds.includes(globalId)) {
                  activeIds.push(globalId);
               }
            }
            // Logic to ensure it's NOT in the list is implicit as it wasn't in visiblePermisos 
            // and we built activeIds only from visiblePermisos.
         }

         await lastValueFrom(
            this.permisosService.updatePermisosUsuario(this.usuario()!.id_usuario!, activeIds)
         );

         this.permisosOriginales.set(new Set(activeIds));

         this.showSuccess.set(true);
         setTimeout(() => this.showSuccess.set(false), 4000);

      } catch (err) {
         console.error('Error saving permissions', err);
         alert('Error al guardar permisos');
      } finally {
         this.saving.set(false);
      }
   }

   getInitials(u: Usuario): string {
      return u.nombre?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '?';
   }

   getRolName(u: Usuario): string {
      if (u.rol) return u.rol;
      if (u.id_rol_usuario === 6) return 'Usuario Publicador';
      return 'Sin Rol';
   }

   getCategoriaNombre(codigo: string): string {
      const prefijo = codigo.split('.')[0];
      const nombres: Record<string, string> = {
         'publicadores': 'Publicadores',
         'grupos': 'Grupos',
         'informes': 'Informes',
         'territorios': 'Territorios',
         'reuniones': 'Reuniones',
         'exhibidores': 'Exhibidores'
      };
      return nombres[prefijo] || prefijo.charAt(0).toUpperCase() + prefijo.slice(1);
   }

   getCategoryIcon(categoria: string): SafeHtml {
      const iconos: Record<string, string> = {
         'Publicadores y Grupos': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>',
         'Grupos': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>',
         'Informes': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>',
         'Territorios': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>',
         'Reuniones': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>',
         'Exhibidores': '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>'
      };

      const svg = iconos[categoria] || '<svg class="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>';
      return this.sanitizer.bypassSecurityTrustHtml(svg);
   }

   getCategoryTheme(categoria: string): 'amber' | 'purple' | 'emerald' | 'blue' | 'slate' {
      const themes: Record<string, string> = {
         'Publicadores y Grupos': 'amber',
         'Publicadores': 'amber',
         'Grupos': 'amber',
         'Informes': 'purple',
         'Territorios': 'emerald',
         'Reuniones': 'purple',
         'Exhibidores': 'blue'
      };
      return (themes[categoria] || 'slate') as any;
   }

   getCategoryBgClass(categoria: string): string {
      const theme = this.getCategoryTheme(categoria);
      return `bg-${theme}-100 text-${theme}-600`;
   }

   getCategoryHoverClass(categoria: string): string {
      const theme = this.getCategoryTheme(categoria);
      return `hover:bg-${theme}-50`;
   }

   // Helper para clases dinámicas de los toggles y barras
   getThemeColorClasses(categoria: string) {
      const theme = this.getCategoryTheme(categoria);
      return {
         toggleActive: `bg-${theme}-500`,
         toggleShadow: `shadow-${theme}-500/30`,
         textActive: `text-${theme}-700`,
         bar: `bg-${theme}-500`,
         lightBg: `bg-${theme}-50`,
         border: `border-${theme}-200`,
         ring: `focus:ring-${theme}-500`
      };
   }

   getPermisoIcon(codigo: string): string {
      if (codigo.includes('ver')) return '👁️';
      if (codigo.includes('editar')) return '✏️';
      if (codigo.includes('crear')) return '➕';
      if (codigo.includes('enviar')) return '📤';
      if (codigo.includes('historial')) return '⏳';
      return '🔐';
   }

   getPermisoIconSvg(codigo: string): SafeHtml {
      const icons: Record<string, string> = {
         'ver': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
         'editar': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
         'crear': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
         'enviar': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>',
         'historial': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
      };

      let iconKey = 'default';
      if (codigo.includes('ver')) iconKey = 'ver';
      else if (codigo.includes('editar')) iconKey = 'editar';
      else if (codigo.includes('crear')) iconKey = 'crear';
      else if (codigo.includes('enviar')) iconKey = 'enviar';
      else if (codigo.includes('historial')) iconKey = 'historial';

      const svg = icons[iconKey] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>';
      return this.sanitizer.bypassSecurityTrustHtml(svg);
   }

   getAssignedCount(cat: CategoriaPermisos): number {
      return cat.permisos.filter(p => p.asignado).length;
   }
}
