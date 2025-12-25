import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { lastValueFrom } from 'rxjs';

import { UsuariosService, Rol, Congregacion, UsuarioCreatePublicador } from '../services/usuarios.service';
import { Usuario } from '../models/usuario.model';
import { AuthStore } from '../../../../core/auth/auth.store';

@Component({
   standalone: true,
   selector: 'app-usuarios-page',
   imports: [CommonModule, ReactiveFormsModule],
   animations: [
      trigger('slideOver', [
         transition(':enter', [
            style({ transform: 'translateX(100%)', opacity: 0.5 }),
            animate('500ms cubic-bezier(0.16, 1, 0.3, 1)', style({ transform: 'translateX(0)', opacity: 1 }))
         ]),
         transition(':leave', [
            animate('400ms cubic-bezier(0.4, 0, 0.2, 1)', style({ transform: 'translateX(100%)', opacity: 0 }))
         ])
      ]),
      trigger('backdropFade', [
         transition(':enter', [
            style({ opacity: 0 }),
            animate('300ms ease-out', style({ opacity: 1 }))
         ]),
         transition(':leave', [
            animate('200ms ease-in', style({ opacity: 0 }))
         ])
      ]),
      trigger('listAnimation', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(10px)' }),
            animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
         ])
      ]),
      trigger('fadeIn', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateY(-5px)' }),
            animate('200ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
         ]),
         transition(':leave', [
            animate('150ms ease-in', style({ opacity: 0, transform: 'translateY(-5px)' }))
         ])
      ])
   ],
   template: `
    <div class="flex flex-col gap-6">
      
       <!-- 1. Header Section -->
       <div class="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6">
         <div>
           <h1 class="text-3xl font-display font-black text-slate-900 tracking-tight">Gestión de Usuarios</h1>
           <p class="text-slate-500 mt-1 max-w-2xl text-base">Administra los accesos y credenciales de los miembros del sistema.</p>
         </div>
         <button 
           (click)="openCreatePanel()"
           class="group shrink-0 inline-flex items-center gap-2 px-6 h-12 bg-[#6D28D9] hover:bg-[#5b21b6] text-white rounded-xl font-display font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-95 hover:shadow-purple-900/30"
         >
           <svg class="w-5 h-5 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
           <span>Nuevo Usuario</span>
         </button>
       </div>

       <!-- 2. Filters & Search Block -->
       <div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center gap-2">
          <div class="relative flex-1 w-full group">
             <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#6D28D9] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
             <input 
                [formControl]="searchControl" 
                type="text" 
                placeholder="Buscar por nombre, correo o rol..." 
                class="w-full pl-12 pr-4 py-3 bg-transparent border-none rounded-xl text-slate-700 font-medium placeholder:text-slate-400 outline-none"
             >
          </div>
          
          <!-- Active Role Filter Badge -->
          <div *ngIf="selectedRolFilter()" class="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-xl">
             <span class="text-xs font-bold text-purple-700">Rol: {{ getSelectedRolFilterName() }}</span>
             <button 
                (click)="clearRolFilter()"
                class="p-1 rounded-full hover:bg-purple-100 text-purple-500 hover:text-purple-700 transition-colors"
                title="Quitar filtro de rol"
             >
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
             </button>
          </div>
          
          <div class="h-8 w-px bg-slate-100 hidden sm:block"></div>
          <div class="w-full sm:w-auto px-2">
             <button 
                (click)="clearAllFilters()"
                [disabled]="!searchControl.value && !selectedRolFilter()"
                class="w-full sm:w-auto flex items-center justify-between gap-3 px-4 py-2 bg-white hover:bg-slate-50 text-slate-500 hover:text-red-500 rounded-xl font-bold text-sm transition-colors border border-slate-200 hover:border-red-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-slate-500 disabled:hover:border-slate-200"
             >
                <span>Limpiar Filtros</span>
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
             </button>
          </div>
       </div>

       <!-- 3. User List Table -->
       <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative min-h-[500px]">
          <div class="overflow-x-auto simple-scrollbar">
             <table class="w-full text-left border-collapse">
                <thead class="sticky top-0 bg-slate-50/80 backdrop-blur-md z-10 border-b border-slate-200">
                   <tr>
                      <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-left">Usuario</th>
                      <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Rol</th>
                      <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Teléfono</th>
                      <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Estado</th>
                      <th class="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                   </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                   <tr *ngFor="let u of filteredUsuarios()" @listAnimation class="group hover:bg-slate-50 transition-colors">
                      <!-- User Info -->
                      <td class="px-6 py-4">
                         <div class="flex items-center gap-4">
                            <div [ngClass]="getUserStyle(u.nombre)" class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-lg shadow-sm ring-1 ring-white border border-white/50">
                               {{ u.nombre.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                               <p class="font-bold text-slate-900 text-sm tracking-tight">{{ u.nombre }}</p>
                               <p class="text-xs text-slate-500 font-medium">{{ u.correo }}</p>
                            </div>
                         </div>
                      </td>
                      
                      <!-- Role Badge -->
                      <td class="px-6 py-4 text-center">
                         <div 
                            [ngClass]="getRolBadgeStyle(u)"
                            class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
                         >
                            {{ getRolName(u) }}
                         </div>
                      </td>

                      <!-- Phone -->
                      <td class="px-6 py-4 text-center">
                         <span class="text-sm text-slate-600 font-mono">{{ u.telefono || '—' }}</span>
                      </td>

                      <!-- Status Badge (Mock) -->
                      <td class="px-6 py-4 text-center">
                         <div class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-100/50">
                            <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            Activo
                         </div>
                      </td>

                      <!-- Actions -->
                      <td class="px-6 py-4 text-right">
                         <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                            <button (click)="editUsuario(u)" class="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-[#6D28D9] transition-all shadow-sm hover:shadow-md hover:shadow-purple-200" title="Editar">
                               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button class="p-2.5 rounded-full text-slate-400 hover:text-white hover:bg-red-500 transition-all shadow-sm hover:shadow-md hover:shadow-red-200" title="Eliminar">
                               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                         </div>
                      </td>
                   </tr>
                   
                   <!-- Empty State -->
                   <tr *ngIf="filteredUsuarios().length === 0" class="text-center">
                       <td colspan="5" class="py-20">
                          <div class="flex flex-col items-center justify-center text-slate-400">
                             <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <svg class="w-8 h-8 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                             </div>
                             <p class="font-medium">No se encontraron usuarios</p>
                             <p class="text-sm mt-1 opacity-70">Intenta ajustar tu búsqueda</p>
                          </div>
                       </td>
                   </tr>
                </tbody>
             </table>
          </div>
       </div>

       <!-- 4. Create/Edit Drawer (Slide Over) -->
       <div *ngIf="panelOpen()" class="fixed inset-0 z-50 overflow-hidden" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          <!-- Backdrop -->
          <div @backdropFade class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" (click)="closePanel()"></div>

          <div class="absolute inset-y-0 right-0 max-w-full flex pl-10">
             <div @slideOver class="w-screen max-w-md pointer-events-auto">
                <div class="h-full flex flex-col bg-white shadow-2xl overflow-y-scroll">
                   
                   <!-- Header -->
                   <div class="px-8 py-6 border-b border-slate-100 bg-white flex items-center justify-between shrink-0 z-10">
                      <div class="flex items-center gap-4">
                         <div class="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center text-[#6D28D9] border border-purple-100">
                            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                         </div>
                         <div>
                            <h2 class="text-xl font-display font-black text-slate-900 tracking-tight" id="slide-over-title">{{ editingUser() ? 'Editar Usuario' : 'Nuevo Usuario' }}</h2>
                            <p class="text-sm text-slate-500 font-medium mt-0.5">Información de cuenta y permisos</p>
                         </div>
                      </div>
                      <button (click)="closePanel()" class="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                         <span class="sr-only">Cerrar panel</span>
                         <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                   </div>

                   <!-- Body -->
                   <div class="relative flex-1 px-6 py-6 sm:px-8">
                     <form [formGroup]="userForm" class="space-y-8">
                        
                        <!-- Personal Info -->
                        <div class="space-y-5">
                           <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <span class="w-8 h-px bg-slate-200"></span> 
                             Datos Personales
                           </h3>
                           
                           <div class="space-y-4">
                              <div class="space-y-1">
                                 <label class="block text-sm font-bold text-slate-700">Nombre Completo</label>
                                 <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                       <svg class="h-5 w-5 text-slate-400 group-focus-within:text-[#6D28D9] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                    <input formControlName="nombre" type="text" class="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/10 transition-all font-medium sm:text-sm" placeholder="Ej. Ana García">
                                 </div>
                              </div>

                              <div class="space-y-1">
                                 <label class="block text-sm font-bold text-slate-700">Correo Electrónico</label>
                                 <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                       <svg class="h-5 w-5 text-slate-400 group-focus-within:text-[#6D28D9] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
                                    </div>
                                    <input formControlName="correo" type="email" class="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/10 transition-all font-medium sm:text-sm" placeholder="ana@ejemplo.com">
                                 </div>
                              </div>

                              <div class="space-y-1">
                                 <label class="block text-sm font-bold text-slate-700">Teléfono</label>
                                 <div class="relative group">
                                    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                       <svg class="h-5 w-5 text-slate-400 group-focus-within:text-[#6D28D9] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                    </div>
                                    <input formControlName="telefono" type="text" class="block w-full pl-10 pr-3 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/10 transition-all font-medium sm:text-sm" placeholder="Ej. 300 123 4567">
                                 </div>
                              </div>

                              <div class="grid grid-cols-3 gap-4">
                                  <div class="col-span-1 space-y-1">
                                      <label class="block text-sm font-bold text-slate-700">Tipo ID</label>
                                      <select formControlName="tipo_identificacion" class="block w-full px-3 py-3 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:bg-white focus:border-[#6D28D9] font-medium text-sm">
                                          <option value="">Seleccione</option>
                                          <option value="CC">C.C.</option>
                                          <option value="CE">C.E.</option>
                                          <option value="TI">T.I.</option>
                                          <option value="PASSPORT">Pasaporte</option>
                                      </select>
                                  </div>
                                  <div class="col-span-2 space-y-1">
                                      <label class="block text-sm font-bold text-slate-700">Número ID</label>
                                      <input formControlName="id_identificacion" type="text" class="block w-full px-3 py-3 border border-slate-200 rounded-xl bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#6D28D9] text-sm" placeholder="Ej. 123456789">
                                  </div>
                              </div>
                           </div>
                        </div>

                        <!-- Roles & Permissions -->
                        <div class="space-y-5">
                           <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <span class="w-8 h-px bg-slate-200"></span> 
                             Acceso y Rol
                           </h3>


                           <div class="bg-purple-50 rounded-xl p-4 border border-purple-100">
                              <div class="space-y-4">
                                 <!-- Rol fijo para Coordinador/Secretario -->
                                 <div *ngIf="!isAdmin()" class="space-y-1">
                                    <label class="block text-sm font-bold text-[#6D28D9]">Rol de Usuario</label>
                                    <div class="w-full bg-cyan-50 border border-cyan-200 rounded-xl px-4 py-3 flex items-center gap-2">
                                       <svg class="w-5 h-5 text-cyan-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                                       <span class="font-medium text-cyan-800">Usuario Publicador</span>
                                       <span class="text-xs text-cyan-600 ml-auto">(asignado automáticamente)</span>
                                    </div>
                                 </div>

                                 <!-- Custom Role Select (Solo Admin) -->
                                 <div *ngIf="isAdmin()" class="space-y-1 relative">
                                    <label class="block text-sm font-bold text-[#6D28D9]">Rol de Usuario</label>
                                    
                                    <!-- Trigger Button -->
                                    <button type="button" (click)="roleDropdownOpen.set(!roleDropdownOpen())" 
                                       class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-left flex items-center justify-between outline-none focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/10 transition-all hover:bg-white active:bg-slate-50 group">
                                       <span [class.text-slate-400]="!userForm.get('id_rol_usuario')?.value" class="font-medium text-slate-700 block truncate">
                                          {{ getSelectedRoleName() || 'Seleccione un rol...' }}
                                       </span>
                                       <svg class="w-5 h-5 text-slate-400 transition-transform duration-200" [class.rotate-180]="roleDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                                    </button>

                                    <!-- Backdrop for click-outside -->
                                    <div *ngIf="roleDropdownOpen()" (click)="roleDropdownOpen.set(false)" class="fixed inset-0 z-10 cursor-default"></div>

                                    <!-- Dropdown Menu -->
                                    <div *ngIf="roleDropdownOpen()" @fadeIn class="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 z-20 overflow-hidden max-h-60 overflow-y-auto simple-scrollbar origin-top">
                                       <div class="p-1 space-y-0.5">
                                          <button type="button" *ngFor="let r of roles()" 
                                             (click)="selectRole(r.id_rol)"
                                             class="w-full px-4 py-2.5 text-left text-sm transition-all flex items-center justify-between rounded-lg group"
                                             [ngClass]="{'text-[#6D28D9] font-bold bg-purple-50/30': isRoleSelected(r.id_rol), 'text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50': !isRoleSelected(r.id_rol)}">
                                             <span>{{ r.descripcion_rol }}</span>
                                             <svg *ngIf="isRoleSelected(r.id_rol)" class="w-4 h-4 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                          </button>
                                       </div>
                                    </div>
                                 </div>
                                 
                                 <!-- Custom Congregation Select (Solo Admin) -->
                                 <div *ngIf="isAdmin()" class="space-y-1 relative">
                                    <label class="block text-sm font-bold text-[#6D28D9]">
                                       Congregación <span *ngIf="isCongregationRequired()" class="text-red-500">*</span>
                                    </label>
                                    
                                    <!-- Trigger Button -->
                                    <button type="button" (click)="congDropdownOpen.set(!congDropdownOpen())" 
                                       class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-left flex items-center justify-between outline-none focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/10 transition-all hover:bg-white active:bg-slate-50 group"
                                       [class.border-red-300]="userForm.get('id_congregacion')?.invalid && userForm.get('id_congregacion')?.touched">
                                       <span [class.text-slate-400]="!userForm.get('id_congregacion')?.value" class="font-medium text-slate-700 block truncate">
                                          {{ getSelectedCongName() || 'Seleccione congregación...' }}
                                       </span>
                                       <svg class="w-5 h-5 text-slate-400 transition-transform duration-200" [class.rotate-180]="congDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                                    </button>
                                    
                                    <p *ngIf="userForm.get('id_congregacion')?.invalid && userForm.get('id_congregacion')?.touched" class="text-xs text-red-500 font-bold ml-1">Requerido para este rol</p>

                                    <!-- Backdrop for click-outside -->
                                    <div *ngIf="congDropdownOpen()" (click)="congDropdownOpen.set(false)" class="fixed inset-0 z-10 cursor-default"></div>

                                    <!-- Dropdown Menu -->
                                    <div *ngIf="congDropdownOpen()" @fadeIn class="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 z-20 overflow-hidden max-h-72 overflow-y-auto simple-scrollbar origin-top flex flex-col">
                                       
                                       <!-- Search Input -->
                                       <div class="sticky top-0 bg-white p-2 border-b border-slate-50">
                                          <input type="text" placeholder="Buscar congregación..." 
                                             [value]="congSearch()" 
                                             (input)="congSearch.set($any($event.target).value)"
                                             class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/10 transition-all font-medium placeholder:font-normal">
                                       </div>

                                       <div class="p-1 space-y-0.5">
                                          <button type="button" *ngFor="let c of filteredCongregaciones()" 
                                             (click)="selectCongregacion(c.id_congregacion)"
                                             class="w-full px-4 py-2.5 text-left text-sm transition-all flex items-center justify-between rounded-lg group"
                                             [ngClass]="{'text-[#6D28D9] font-bold bg-purple-50/30': isCongSelected(c.id_congregacion), 'text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50': !isCongSelected(c.id_congregacion)}">
                                             <span>{{ c.nombre_congregacion }}</span>
                                             <svg *ngIf="isCongSelected(c.id_congregacion)" class="w-4 h-4 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                          </button>
                                          
                                          <div *ngIf="filteredCongregaciones().length === 0" class="px-4 py-8 text-center">
                                             <p class="text-xs text-slate-400 font-medium">No se encontraron resultados</p>
                                          </div>
                                       </div>
                                    </div>
                                 </div>


                                 <!-- Custom Publisher Select -->
                                 <div class="space-y-1 relative">
                                    <label class="block text-sm font-bold text-[#6D28D9]">
                                       Publicador Asociado <span class="text-red-500">*</span>
                                    </label>
                                    
                                    <!-- Trigger Button -->
                                    <button type="button" 
                                       (click)="pubDropdownOpen.set(!pubDropdownOpen())" 
                                       [disabled]="isAdmin() && !userForm.get('id_congregacion')?.value"
                                       class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-left flex items-center justify-between outline-none focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/10 transition-all hover:bg-white active:bg-slate-50 group disabled:opacity-50 disabled:cursor-not-allowed"
                                       [class.border-red-300]="userForm.get('id_usuario_publicador')?.invalid && userForm.get('id_usuario_publicador')?.touched">
                                       <span [class.text-slate-400]="!userForm.get('id_usuario_publicador')?.value" class="font-medium text-slate-700 block truncate">
                                          {{ getSelectedPubName() || 'Seleccione publicador...' }}
                                       </span>
                                       <svg class="w-5 h-5 text-slate-400 transition-transform duration-200" [class.rotate-180]="pubDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                                    </button>
                                    
                                    <p *ngIf="userForm.get('id_usuario_publicador')?.invalid && userForm.get('id_usuario_publicador')?.touched" class="text-xs text-red-500 font-bold ml-1">Debes asociar un publicador</p>

                                    <!-- Backdrop for click-outside -->
                                    <div *ngIf="pubDropdownOpen()" (click)="pubDropdownOpen.set(false)" class="fixed inset-0 z-10 cursor-default"></div>

                                    <!-- Dropdown Menu -->
                                    <div *ngIf="pubDropdownOpen()" @fadeIn class="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 z-20 overflow-hidden max-h-72 overflow-y-auto simple-scrollbar origin-top flex flex-col">
                                       
                                       <!-- Search Input -->
                                       <div class="sticky top-0 bg-white p-2 border-b border-slate-50">
                                          <input type="text" placeholder="Buscar publicador..." 
                                             [value]="pubSearch()" 
                                             (input)="pubSearch.set($any($event.target).value)"
                                             class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6D28D9] focus:ring-2 focus:ring-[#6D28D9]/10 transition-all font-medium placeholder:font-normal">
                                       </div>

                                       <div class="p-1 space-y-0.5">
                                          <button type="button" *ngFor="let p of filteredPublicadores()" 
                                             (click)="selectPublicador(p.id_publicador)"
                                             class="w-full px-4 py-2.5 text-left text-sm transition-all flex items-center justify-between rounded-lg group"
                                             [ngClass]="{'text-[#6D28D9] font-bold bg-purple-50/30': isPubSelected(p.id_publicador), 'text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50': !isPubSelected(p.id_publicador)}">
                                             <span>{{ p.primer_nombre }} {{ p.primer_apellido }}</span>
                                             <svg *ngIf="isPubSelected(p.id_publicador)" class="w-4 h-4 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                          </button>
                                          
                                          <div *ngIf="filteredPublicadores().length === 0" class="px-4 py-8 text-center">
                                             <p class="text-xs text-slate-400 font-medium">No se encontraron resultados</p>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>

                        <!-- Security -->
                        <div class="space-y-5">
                           <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                             <span class="w-8 h-px bg-slate-200"></span> 
                             Seguridad
                           </h3>

                           <div class="space-y-4">
                              <div class="space-y-1">
                                 <label class="block text-sm font-bold text-slate-700">Contraseña</label>
                                 <div class="relative group">
                                    <input [type]="showPassword() ? 'text' : 'password'" formControlName="contrasena" class="block w-full pl-4 pr-12 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/10 transition-all font-medium sm:text-sm" placeholder="Min. 6 caracteres">
                                    <button type="button" (click)="showPassword.set(!showPassword())" class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors">
                                       <svg *ngIf="!showPassword()" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                       <svg *ngIf="showPassword()" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                    </button>
                                 </div>
                              </div>

                              <div class="space-y-1">
                                 <label class="block text-sm font-bold text-slate-700">Confirmar</label>
                                 <input type="password" formControlName="confirmPassword" class="block w-full px-4 py-3 border border-slate-200 rounded-xl leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/10 transition-all font-medium sm:text-sm"
                                        [class.border-red-300]="userForm.hasError('mismatch') && userForm.get('confirmPassword')?.touched">
                                 <p *ngIf="userForm.hasError('mismatch') && userForm.get('confirmPassword')?.touched" class="text-xs text-red-500 mt-1 font-bold">Las contraseñas no coinciden</p>
                              </div>
                           </div>
                        </div>

                     </form>
                   </div>

                   <!-- Actions -->
                   <div class="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center gap-3 shrink-0 backdrop-blur-sm z-10">
                      <button (click)="closePanel()" class="flex-1 py-3.5 px-6 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm">
                         Cancelar
                      </button>
                      <button (click)="save()" [disabled]="userForm.invalid || saving()" 
                         class="flex-[2] py-3.5 px-6 bg-[#6D28D9] hover:bg-[#5b21b6] text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 hover:shadow-purple-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95">
                         <span *ngIf="saving()" class="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></span>
                         <span *ngIf="!saving()">{{ editingUser() ? 'Guardar Cambios' : 'Crear Usuario' }}</span>
                      </button>
                   </div>
                </div>
             </div>
          </div>
       </div>

    </div>
  `,
   styles: [`
    :host { display: block; height: 100%; }
    .simple-scrollbar::-webkit-scrollbar { width: 5px; }
    .simple-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .simple-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
    .simple-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  `]
})
export class UsuariosPage implements OnInit {
   private service = inject(UsuariosService);
   private fb = inject(FormBuilder);
   private route = inject(ActivatedRoute);
   private authStore = inject(AuthStore);

   usuarios = signal<Usuario[]>([]);
   roles = signal<Rol[]>([]);
   congregaciones = signal<Congregacion[]>([]);
   publicadores = signal<any[]>([]);

   // Modo restringido para Coordinador/Secretario
   isAdmin = computed(() => {
      const user = this.authStore.user();
      const roles = user?.roles ?? (user?.rol ? [user.rol] : []);
      return roles.map(r => (r || '').toLowerCase()).includes('administrador');
   });

   currentUserCongregacion = computed(() => {
      return this.authStore.user()?.id_congregacion ?? null;
   });

   panelOpen = signal(false);
   saving = signal(false);
   showPassword = signal(false);
   editingUser = signal<Usuario | null>(null);

   // Custom Select States
   roleDropdownOpen = signal(false);
   congDropdownOpen = signal(false);
   pubDropdownOpen = signal(false); // New

   // Filtering states for dropdowns
   congSearch = signal('');
   pubSearch = signal('');
   selectedRolFilter = signal<number | null>(null); // Filter by role from query params
   searchQuery = signal(''); // Signal for reactive search

   searchControl = this.fb.control('');

   userForm: FormGroup;

   constructor() {
      this.userForm = this.fb.group({
         nombre: ['', Validators.required],
         correo: ['', [Validators.required, Validators.email]],
         contrasena: ['', [Validators.required, Validators.minLength(6)]],
         confirmPassword: ['', Validators.required],
         id_rol_usuario: [null, Validators.required],
         id_congregacion: [null],
         id_usuario_publicador: [null],
         telefono: [''],
         tipo_identificacion: [''],
         id_identificacion: ['']
      }, { validators: this.passwordMatchValidator });
   }

   // --- Custom Select Helpers ---

   getSelectedRoleName(): string | null {
      const id = this.userForm.get('id_rol_usuario')?.value;
      if (!id) return null;
      return this.roles().find(r => r.id_rol === id)?.descripcion_rol || null;
   }

   selectRole(id: number) {
      this.userForm.patchValue({ id_rol_usuario: id });
      this.roleDropdownOpen.set(false);
      this.updateRoleValidators(id);
   }

   updateRoleValidators(roleId: number) {
      const selectedRole = this.roles().find(r => r.id_rol === roleId);
      if (!selectedRole) return;

      const roleName = selectedRole.descripcion_rol.toLowerCase().trim();
      const isGlobal = roleName === 'administrador' || roleName === 'gestor aplicación';

      const congControl = this.userForm.get('id_congregacion');
      const pubControl = this.userForm.get('id_usuario_publicador');

      if (isGlobal) {
         congControl?.clearValidators();
         pubControl?.clearValidators();
      } else {
         congControl?.setValidators(Validators.required);
         pubControl?.setValidators(Validators.required);
      }

      congControl?.updateValueAndValidity();
      pubControl?.updateValueAndValidity();
   }

   isCongregationRequired(): boolean {
      const control = this.userForm.get('id_congregacion');
      return control ? control.hasValidator(Validators.required) : false;
   }

   isRoleSelected(id: number): boolean {
      return this.userForm.get('id_rol_usuario')?.value === id;
   }

   getSelectedCongName(): string | null {
      const id = this.userForm.get('id_congregacion')?.value;
      if (!id) return null;
      return this.congregaciones().find(c => c.id_congregacion === id)?.nombre_congregacion || null;
   }

   selectCongregacion(id: number) {
      this.userForm.patchValue({
         id_congregacion: id,
         id_usuario_publicador: null // Reset publisher when changing congregation
      });
      this.congDropdownOpen.set(false);
      this.loadPublicadores(id);
   }

   isCongSelected(id: number): boolean {
      return this.userForm.get('id_congregacion')?.value === id;
   }

   // --- Publisher Helpers ---

   getSelectedPubName(): string | null {
      const id = this.userForm.get('id_usuario_publicador')?.value;
      if (!id) return null;
      const p = this.publicadores().find(p => p.id_publicador === id);
      return p ? `${p.primer_nombre} ${p.primer_apellido}` : null;
   }

   selectPublicador(id: number) {
      this.userForm.patchValue({ id_usuario_publicador: id });
      this.pubDropdownOpen.set(false);
   }

   isPubSelected(id: number): boolean {
      return this.userForm.get('id_usuario_publicador')?.value === id;
   }

   // Filtered lists for dropdowns
   filteredCongregaciones = computed(() => {
      const q = this.congSearch().toLowerCase();
      return this.congregaciones().filter(c => c.nombre_congregacion.toLowerCase().includes(q));
   });

   filteredPublicadores = computed(() => {
      const q = this.pubSearch().toLowerCase();
      return this.publicadores().filter(p =>
         p.primer_nombre.toLowerCase().includes(q) ||
         p.primer_apellido.toLowerCase().includes(q)
      );
   });

   getUserStyle(name: string): string {
      const n = (name || '').toLowerCase();
      const char = n.charCodeAt(0);

      // Deterministic pastel color mapping based on first char
      if (char % 5 === 0) return 'bg-purple-100 text-purple-700 ring-purple-600/20';
      if (char % 5 === 1) return 'bg-blue-100 text-blue-700 ring-blue-600/20';
      if (char % 5 === 2) return 'bg-emerald-100 text-emerald-700 ring-emerald-600/20';
      if (char % 5 === 3) return 'bg-orange-100 text-orange-700 ring-orange-600/20';
      return 'bg-cyan-100 text-cyan-700 ring-cyan-600/20';
   }

   // -----------------------------

   ngOnInit() {
      // Check for role filter from query params
      this.route.queryParams.subscribe(params => {
         if (params['rol']) {
            this.selectedRolFilter.set(Number(params['rol']));
         }
      });

      // Connect FormControl to signal for reactive filtering
      this.searchControl.valueChanges.subscribe(value => {
         this.searchQuery.set(value || '');
      });

      this.loadData();
      this.loadAuxData();
   }

   // --- Role Filter Helpers ---
   getSelectedRolFilterName(): string {
      const id = this.selectedRolFilter();
      if (!id) return '';
      const rol = this.roles().find(r => r.id_rol === id);
      return rol ? rol.descripcion_rol : `Rol #${id}`;
   }

   clearRolFilter() {
      this.selectedRolFilter.set(null);
   }

   clearAllFilters() {
      this.searchControl.setValue('');
      this.selectedRolFilter.set(null);
   }

   filteredUsuarios = computed(() => {
      const q = this.searchQuery().toLowerCase();
      const rolFilter = this.selectedRolFilter();

      return this.usuarios().filter(u => {
         const matchesSearch = u.nombre.toLowerCase().includes(q) || u.correo.toLowerCase().includes(q);
         const matchesRol = rolFilter === null || u.id_rol_usuario === rolFilter;
         return matchesSearch && matchesRol;
      });
   });

   async loadData() {
      try {
         // Usar endpoint apropiado según rol del usuario
         let data: Usuario[];
         if (this.isAdmin()) {
            // Admin: ver todos los usuarios
            data = await lastValueFrom(this.service.getUsuarios());
         } else {
            // Coordinador/Secretario: solo usuarios de su congregación
            data = await lastValueFrom(this.service.getUsuariosMiCongregacion());
         }
         this.usuarios.set(data);
      } catch (err) {
         console.error(err);
      }
   }

   async loadAuxData() {
      try {
         const roles = await lastValueFrom(this.service.getRoles());
         this.roles.set(roles);
         const congs = await lastValueFrom(this.service.getCongregaciones());
         this.congregaciones.set(congs);
      } catch (err) {
         console.error('Aux data error', err);
      }
   }

   async loadPublicadores(congId: number) {
      try {
         const pubs = await lastValueFrom(this.service.getPublicadores(congId));
         this.publicadores.set(pubs || []);
      } catch (err) {
         console.error('Error loading publicadores', err);
         this.publicadores.set([]);
      }
   }

   openCreatePanel() {
      this.editingUser.set(null);
      this.userForm.reset();

      // Re-enable password validators for new users
      this.userForm.get('contrasena')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('confirmPassword')?.setValidators([Validators.required]);

      if (this.isAdmin()) {
         // Admin: opcional hasta que seleccione rol que lo requiera
         this.userForm.get('id_congregacion')?.clearValidators();
         this.userForm.get('id_usuario_publicador')?.clearValidators();
         this.userForm.get('id_rol_usuario')?.setValidators([Validators.required]);
      } else {
         // Coordinador/Secretario: publicador requerido, rol NO requerido (forzado en servidor)
         this.userForm.get('id_rol_usuario')?.clearValidators();
         this.userForm.get('id_congregacion')?.clearValidators();
         this.userForm.get('id_usuario_publicador')?.setValidators([Validators.required]);

         // Auto-cargar publicadores de su congregación
         const congId = this.currentUserCongregacion();
         if (congId) {
            this.loadPublicadores(congId);
         }
      }

      this.userForm.updateValueAndValidity();

      this.panelOpen.set(true);
   }

   editUsuario(u: Usuario) {
      this.editingUser.set(u);
      this.userForm.patchValue({
         nombre: u.nombre,
         correo: u.correo,
         id_rol_usuario: u.id_rol_usuario,
         id_congregacion: u.id_congregacion,
         id_usuario_publicador: u.id_usuario_publicador,
         telefono: u.telefono,
         tipo_identificacion: u.tipo_identificacion,
         id_identificacion: u.id_identificacion
      });

      if (u.id_congregacion) {
         this.loadPublicadores(u.id_congregacion);
      } else {
         this.publicadores.set([]);
      }

      // Disable password requirements for edit (optional update)
      this.userForm.get('contrasena')?.clearValidators();
      this.userForm.get('confirmPassword')?.clearValidators();
      this.userForm.get('contrasena')?.updateValueAndValidity();
      this.userForm.get('confirmPassword')?.updateValueAndValidity();

      // Update validators based on existing role
      if (u.id_rol_usuario) {
         this.updateRoleValidators(u.id_rol_usuario);
      }

      this.panelOpen.set(true);
   }

   closePanel() {
      this.panelOpen.set(false);
      this.editingUser.set(null);
      this.userForm.reset();
   }

   async save() {
      if (this.userForm.invalid) return;

      this.saving.set(true);

      try {
         const formValue = this.userForm.value;

         if (this.editingUser()) {
            // --- Modo edición (solo Admin puede editar actualmente) ---
            const id = this.editingUser()!.id_usuario;
            if (id === undefined) {
               throw new Error('El usuario no tiene ID válido para editar');
            }

            const updatePayload: any = {
               nombre: formValue.nombre,
               correo: formValue.correo,
               id_rol_usuario: formValue.id_rol_usuario,
               id_usuario_publicador: formValue.id_usuario_publicador,
               telefono: formValue.telefono,
               tipo_identificacion: formValue.tipo_identificacion,
               id_identificacion: formValue.id_identificacion
            };
            if (formValue.contrasena) {
               updatePayload.contrasena = formValue.contrasena;
            }

            await lastValueFrom(this.service.updateUsuario(id, updatePayload));
            this.loadData();

         } else {
            // --- Modo creación ---
            let newUser: Usuario;

            if (this.isAdmin()) {
               // Admin: crear usuario con cualquier rol
               const createPayload = {
                  nombre: formValue.nombre,
                  correo: formValue.correo,
                  contrasena: formValue.contrasena,
                  id_rol_usuario: formValue.id_rol_usuario,
                  id_usuario_publicador: formValue.id_usuario_publicador,
                  telefono: formValue.telefono,
                  tipo_identificacion: formValue.tipo_identificacion,
                  id_identificacion: formValue.id_identificacion,
                  id_usuario_estado: 1
               };
               newUser = await lastValueFrom(this.service.createUsuario(createPayload));
            } else {
               // Coordinador/Secretario: usar endpoint restringido
               // El rol se fuerza a 6 (Usuario Publicador) en el servidor
               const restrictedPayload: UsuarioCreatePublicador = {
                  nombre: formValue.nombre,
                  correo: formValue.correo,
                  contrasena: formValue.contrasena,
                  id_usuario_publicador: formValue.id_usuario_publicador,
                  telefono: formValue.telefono,
                  tipo_identificacion: formValue.tipo_identificacion,
                  id_identificacion: formValue.id_identificacion
               };
               newUser = await lastValueFrom(this.service.createUsuarioPublicador(restrictedPayload));
            }

            this.usuarios.update(list => [newUser, ...list]);
         }

         this.closePanel();

      } catch (err: any) {
         console.error('Save error', err);
         alert('Error al guardar: ' + (err.error?.detail || 'Desconocido'));
      } finally {
         this.saving.set(false);
      }
   }

   passwordMatchValidator(g: AbstractControl) {
      return g.get('contrasena')?.value === g.get('confirmPassword')?.value
         ? null : { mismatch: true };
   }

   getRolName(u: Usuario): string {
      // Priority 1: Direct role name if available
      if (u.rol) return u.rol;
      // Priority 2: Roles array
      if (u.roles && u.roles.length > 0) return u.roles[0];
      // Priority 3: Lookup by ID in loaded roles
      if (u.id_rol_usuario) {
         const r = this.roles().find(r => r.id_rol === u.id_rol_usuario);
         if (r) return r.nombre_rol;

         // Fallback: Si el rol es 6 (Usuario Publicador) y no tenemos roles cargados
         if (u.id_rol_usuario === 6) return 'Usuario Publicador';
      }
      return 'Sin Rol';
   }

   getRolBadgeStyle(u: Usuario): string {
      const rolName = this.getRolName(u).toLowerCase();

      // Specific color mapping based on role name keywords
      if (rolName.includes('admin')) {
         return 'bg-emerald-50 text-emerald-700 border border-emerald-100/50';
      }
      if (rolName.includes('secret')) {
         return 'bg-indigo-50 text-indigo-700 border border-indigo-100/50';
      }
      if (rolName.includes('super')) {
         return 'bg-blue-50 text-blue-700 border border-blue-100/50';
      }
      if (rolName.includes('coord')) {
         return 'bg-amber-50 text-amber-700 border border-amber-100/50';
      }
      if (rolName.includes('gestor')) {
         return 'bg-purple-50 text-purple-700 border border-purple-100/50';
      }
      if (rolName.includes('public')) {
         return 'bg-cyan-50 text-cyan-700 border border-cyan-100/50';
      }

      // Fallback: Use ID-based color if available
      const id = u.id_rol_usuario || 0;
      const colors = [
         'bg-rose-50 text-rose-700 border border-rose-100/50',
         'bg-teal-50 text-teal-700 border border-teal-100/50',
         'bg-orange-50 text-orange-700 border border-orange-100/50',
         'bg-pink-50 text-pink-700 border border-pink-100/50',
         'bg-sky-50 text-sky-700 border border-sky-100/50'
      ];
      return colors[id % colors.length];
   }

   clearSearch() {
      this.searchControl.setValue('');
   }
}
