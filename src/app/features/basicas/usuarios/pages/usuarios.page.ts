import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { lastValueFrom } from 'rxjs';

import { UsuariosService, Rol, Congregacion } from '../services/usuarios.service';
import { Usuario } from '../models/usuario.model';

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
    <div class="h-full flex flex-col w-full max-w-[1600px] mx-auto pb-6 relative">
      
       <!-- 1. Header Section -->
       <div class="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pt-2">
         <div>
           <h1 class="text-3xl font-black text-slate-900 tracking-tight">Gestión de Usuarios</h1>
           <p class="text-slate-500 mt-1 max-w-2xl text-base">Administra los accesos y credenciales de los miembros del sistema.</p>
         </div>
         <button 
           (click)="openCreatePanel()"
           class="group shrink-0 inline-flex items-center gap-2 px-6 py-3.5 bg-[#6D28D9] hover:bg-[#5b21b6] text-white rounded-xl font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-95 hover:shadow-purple-900/30"
         >
           <svg class="w-5 h-5 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
           <span>Nuevo Usuario</span>
         </button>
       </div>

       <!-- 2. Filters & Search Block -->
       <div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row items-center gap-2">
          <div class="relative flex-1 w-full group">
             <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#6D28D9] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
             <input 
                [formControl]="searchControl" 
                type="text" 
                placeholder="Buscar por nombre, correo o rol..." 
                class="w-full pl-12 pr-4 py-3 bg-transparent border-none rounded-xl text-slate-700 font-medium placeholder:text-slate-400 outline-none"
             >
          </div>
          <div class="h-8 w-px bg-slate-100 hidden sm:block"></div>
          <div class="w-full sm:w-auto px-2">
             <button class="w-full sm:w-auto flex items-center justify-between gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-sm transition-colors border border-transparent hover:border-slate-200">
                <span>Más Filtros</span>
                <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
             </button>
          </div>
       </div>

       <!-- 3. User List Table -->
       <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-1 flex flex-col">
          <div class="overflow-x-auto flex-1 simple-scrollbar">
             <table class="w-full text-left border-collapse">
                <thead class="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 border-b border-slate-200">
                   <tr>
                      <th class="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Usuario</th>
                      <th class="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest">Rol</th>
                      <th class="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-center">Estado</th>
                      <th class="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-widest text-right">Acciones</th>
                   </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                   <tr *ngFor="let u of filteredUsuarios()" @listAnimation class="group hover:bg-purple-50/30 transition-colors">
                      <!-- User Info -->
                      <td class="px-6 py-4">
                         <div class="flex items-center gap-4">
                            <div class="w-11 h-11 rounded-full bg-gradient-to-br from-[#6D28D9] to-[#5b21b6] text-white flex items-center justify-center shrink-0 font-bold text-lg shadow-md shadow-purple-200 ring-2 ring-white">
                               {{ u.nombre.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                               <p class="font-bold text-slate-900 text-sm group-hover:text-[#6D28D9] transition-colors">{{ u.nombre }}</p>
                               <p class="text-xs text-slate-500 font-medium">{{ u.correo }}</p>
                            </div>
                         </div>
                      </td>
                      
                      <!-- Role Badge -->
                      <td class="px-6 py-4">
                         <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-600 shadow-sm group-hover:border-purple-200 group-hover:text-purple-700 transition-colors">
                            <span class="w-1.5 h-1.5 rounded-full bg-[#6D28D9] mr-2"></span>
                            {{ getRolName(u) }}
                         </span>
                      </td>

                      <!-- Status Badge (Mock) -->
                      <td class="px-6 py-4 text-center">
                         <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Activo
                         </span>
                      </td>

                      <!-- Actions -->
                      <td class="px-6 py-4 text-right">
                         <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                            <button (click)="editUsuario(u)" class="p-2 text-slate-400 hover:text-[#6D28D9] hover:bg-purple-50 rounded-lg transition-all" title="Editar">
                               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Eliminar">
                               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                            </button>
                         </div>
                      </td>
                   </tr>
                   
                   <!-- Empty State -->
                   <tr *ngIf="filteredUsuarios().length === 0" class="text-center">
                       <td colspan="4" class="py-20">
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
                   <div class="px-6 py-6 bg-[#6D28D9] text-white shrink-0 relative overflow-hidden">
                      <div class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                      <div class="relative z-10 flex items-start justify-between">
                         <div>
                            <h2 class="text-xl font-black text-white" id="slide-over-title">{{ editingUser() ? 'Editar Usuario' : 'Nuevo Usuario' }}</h2>
                            <p class="text-sm text-purple-200 mt-1">Información de cuenta y permisos</p>
                         </div>
                         <button (click)="closePanel()" class="rounded-lg p-2 text-purple-200 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white">
                            <span class="sr-only">Cerrar panel</span>
                            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                      </div>
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
                                 <!-- Custom Role Select -->
                                 <div class="space-y-1 relative">
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
                                 
                                 <!-- Custom Congregation Select -->
                                 <div class="space-y-1 relative">
                                    <label class="block text-sm font-bold text-[#6D28D9]">Congregación</label>
                                    
                                    <!-- Trigger Button -->
                                    <button type="button" (click)="congDropdownOpen.set(!congDropdownOpen())" 
                                       class="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-left flex items-center justify-between outline-none focus:border-[#6D28D9] focus:ring-4 focus:ring-[#6D28D9]/10 transition-all hover:bg-white active:bg-slate-50 group">
                                       <span [class.text-slate-400]="!userForm.get('id_congregacion')?.value" class="font-medium text-slate-700 block truncate">
                                          {{ getSelectedCongName() || 'Seleccione congregación...' }}
                                       </span>
                                       <svg class="w-5 h-5 text-slate-400 transition-transform duration-200" [class.rotate-180]="congDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                                    </button>

                                    <!-- Backdrop for click-outside -->
                                    <div *ngIf="congDropdownOpen()" (click)="congDropdownOpen.set(false)" class="fixed inset-0 z-10 cursor-default"></div>

                                    <!-- Dropdown Menu -->
                                    <div *ngIf="congDropdownOpen()" @fadeIn class="absolute left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl shadow-slate-200/50 z-20 overflow-hidden max-h-60 overflow-y-auto simple-scrollbar origin-top">
                                       <div class="p-1 space-y-0.5">
                                          <button type="button" *ngFor="let c of congregaciones()" 
                                             (click)="selectCongregacion(c.id_congregacion)"
                                             class="w-full px-4 py-2.5 text-left text-sm transition-all flex items-center justify-between rounded-lg group"
                                             [ngClass]="{'text-[#6D28D9] font-bold bg-purple-50/30': isCongSelected(c.id_congregacion), 'text-slate-500 font-medium hover:text-slate-900 hover:bg-slate-50': !isCongSelected(c.id_congregacion)}">
                                             <span>{{ c.nombre_congregacion }}</span>
                                             <svg *ngIf="isCongSelected(c.id_congregacion)" class="w-4 h-4 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                          </button>
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
                   <div class="shrink-0 px-6 py-5 bg-slate-50/80 backdrop-blur-sm border-t border-slate-200 grid grid-cols-2 gap-4">
                      <button (click)="closePanel()" class="w-full inline-flex justify-center items-center px-4 py-3 border border-slate-300 shadow-sm font-bold rounded-xl text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:text-sm transition-colors">
                         Cancelar
                      </button>
                      <button (click)="save()" [disabled]="userForm.invalid || saving()" type="submit" class="w-full inline-flex justify-center items-center px-4 py-3 border border-transparent font-bold rounded-xl text-white bg-[#6D28D9] hover:bg-[#5b21b6] shadow-lg shadow-purple-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6D28D9] sm:text-sm disabled:opacity-50 transition-all active:scale-95">
                         <span *ngIf="saving()" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white border-2 border-white/30 border-t-white rounded-full"></span>
                         {{ saving() ? 'Guardando...' : (editingUser() ? 'Guardar Cambios' : 'Crear Usuario') }}
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

   usuarios = signal<Usuario[]>([]);
   roles = signal<Rol[]>([]);
   congregaciones = signal<Congregacion[]>([]);

   panelOpen = signal(false);
   saving = signal(false);
   showPassword = signal(false);
   editingUser = signal<Usuario | null>(null);

   // Custom Select States
   roleDropdownOpen = signal(false);
   congDropdownOpen = signal(false);

   searchControl = this.fb.control('');

   userForm: FormGroup;

   constructor() {
      this.userForm = this.fb.group({
         nombre: ['', Validators.required],
         correo: ['', [Validators.required, Validators.email]],
         contrasena: ['', [Validators.required, Validators.minLength(6)]],
         confirmPassword: ['', Validators.required],
         id_rol_usuario: [null, Validators.required],
         id_congregacion: [null]
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
      this.userForm.patchValue({ id_congregacion: id });
      this.congDropdownOpen.set(false);
   }

   isCongSelected(id: number): boolean {
      return this.userForm.get('id_congregacion')?.value === id;
   }

   // -----------------------------

   ngOnInit() {
      this.loadData();
      this.loadAuxData();
   }

   filteredUsuarios = computed(() => {
      const q = this.searchControl.value?.toLowerCase() || '';
      return this.usuarios().filter(u =>
         u.nombre.toLowerCase().includes(q) ||
         u.correo.toLowerCase().includes(q)
      );
   });

   async loadData() {
      try {
         const data = await lastValueFrom(this.service.getUsuarios());
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

   openCreatePanel() {
      this.editingUser.set(null);
      this.userForm.reset();

      // Re-enable password validators for new users
      this.userForm.get('contrasena')?.setValidators([Validators.required, Validators.minLength(6)]);
      this.userForm.get('confirmPassword')?.setValidators([Validators.required]);
      this.userForm.updateValueAndValidity();

      this.panelOpen.set(true);
   }

   editUsuario(u: Usuario) {
      this.editingUser.set(u);
      this.userForm.patchValue({
         nombre: u.nombre,
         correo: u.correo,
         id_rol_usuario: u.id_rol_usuario,
         id_congregacion: u.id_congregacion
      });

      // Disable password requirements for edit (optional update)
      this.userForm.get('contrasena')?.clearValidators();
      this.userForm.get('confirmPassword')?.clearValidators();
      this.userForm.get('contrasena')?.updateValueAndValidity();
      this.userForm.get('confirmPassword')?.updateValueAndValidity();

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
      const val = this.userForm.value;

      try {
         const formValue = this.userForm.value;

         // Extract only backend-accepted fields
         const basePayload = {
            nombre: formValue.nombre,
            correo: formValue.correo,
            id_rol_usuario: formValue.id_rol_usuario
         };

         if (this.editingUser()) {
            const id = this.editingUser()!.id_usuario;
            if (id === undefined) {
               throw new Error('El usuario no tiene ID válido para editar');
            }

            const updatePayload: any = { ...basePayload };
            if (formValue.contrasena) {
               updatePayload.contrasena = formValue.contrasena;
            }

            await lastValueFrom(this.service.updateUsuario(id, updatePayload));

            this.loadData();

         } else {
            const createPayload = {
               ...basePayload,
               contrasena: formValue.contrasena,
               id_usuario_estado: 1
            };

            const newUser = await lastValueFrom(this.service.createUsuario(createPayload));

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
      // Priority 3: Lookup by ID
      if (u.id_rol_usuario) {
         const r = this.roles().find(r => r.id_rol === u.id_rol_usuario);
         if (r) return r.descripcion_rol;
      }
      return 'Sin Rol';
   }
}
