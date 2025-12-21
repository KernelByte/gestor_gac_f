import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { lastValueFrom } from 'rxjs';

import { UsuariosService, Rol, Congregacion } from '../services/usuarios.service';
import { Usuario, UsuarioCreate } from '../models/usuario.model';

@Component({
   standalone: true,
   selector: 'app-usuarios-page',
   imports: [CommonModule, ReactiveFormsModule],
   animations: [
      trigger('slidePanel', [
         transition(':enter', [
            style({ opacity: 0, transform: 'translateX(20px)' }),
            animate('400ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
         ]),
         transition(':leave', [
            animate('300ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 0, transform: 'translateX(20px)' }))
         ])
      ])
   ],
   template: `
    <div class="h-full flex flex-col w-full max-w-[1600px] mx-auto p-6 md:p-8 bg-gray-50/50">
      
       <!-- Header -->
      <div class="shrink-0 flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">Gestión de Usuarios</h1>
          <p class="text-slate-500 mt-1 max-w-2xl">Administra los accesos y credenciales del sistema.</p>
        </div>
        <button 
          if="!panelOpen()"
          (click)="openCreatePanel()"
          class="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-[#5B3C88] hover:bg-[#4a2f73] text-white rounded-xl font-bold shadow-lg shadow-purple-900/20 transition-all active:scale-95"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
          Nuevo Usuario
        </button>
      </div>

      <!-- Main Content -->
      <div class="flex-1 flex gap-6 overflow-hidden">
         
         <!-- User List (Left Side) -->
         <div class="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col overflow-hidden transition-all duration-300"
              [ngClass]="{'hidden lg:flex lg:w-1/2': panelOpen(), 'w-full': !panelOpen()}">
            
            <!-- Toolbar -->
            <div class="p-4 border-b border-slate-100 flex items-center gap-4">
                <div class="relative flex-1">
                   <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                   <input 
                      [formControl]="searchControl" 
                      type="text" 
                      placeholder="Buscar usuarios..." 
                      class="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#5B3C88]/20 outline-none"
                   >
                </div>
            </div>

            <!-- Table -->
            <div class="flex-1 overflow-auto simple-scrollbar">
               <table class="w-full text-left border-collapse">
                  <thead class="sticky top-0 bg-white z-10 box-decoration-clone">
                     <tr class="border-b border-slate-100">
                        <th class="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Usuario</th>
                        <th class="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rol</th>
                        <th class="px-6 py-4 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Acciones</th>
                     </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50">
                     <tr *ngFor="let u of filteredUsuarios()" class="group hover:bg-slate-50 transition-colors">
                        <td class="px-6 py-4">
                           <div class="flex items-center gap-3">
                              <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-[#5B3C88]">
                                 {{ u.nombre.charAt(0).toUpperCase() }}
                              </div>
                              <div>
                                 <p class="font-bold text-slate-900 text-sm">{{ u.nombre }}</p>
                                 <p class="text-xs text-slate-500">{{ u.correo }}</p>
                              </div>
                           </div>
                        </td>
                        <td class="px-6 py-4">
                           <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                              {{ getRolName(u) }}
                           </span>
                        </td>
                        <td class="px-6 py-4 text-right">
                           <button class="text-slate-400 hover:text-slate-600 transition-colors">
                              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                           </button>
                        </td>
                     </tr>
                     <tr *ngIf="filteredUsuarios().length === 0" class="text-center">
                         <td colspan="3" class="py-12 text-slate-400">No se encontraron usuarios</td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </div>

         <!-- Right Panel (Create Form) - Visible based on state or separate floating panel look -->
         <!-- Using a static column approach when open, as per typical dashboard layout, or absolute if requested. 
              The prompt image is a clean form. I'll implement it as a split view or overlay panel.
              Let's using the 'Grupos' style sliding panel for consistency. -->
         
         <div *ngIf="panelOpen()" @slidePanel class="relative w-full lg:w-[600px] shrink-0 flex flex-col bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
             <!-- Header -->
             <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
               <div>
                  <h2 class="text-xl font-black text-slate-900">Crear Nuevo Usuario</h2>
                  <p class="text-xs font-medium text-slate-500 mt-1">Complete el formulario para registrar un nuevo miembro.</p>
               </div>
               <button (click)="closePanel()" class="p-2 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 hover:shadow-sm transition-all">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
               </button>
             </div>

             <!-- Scrollable Content -->
             <div class="flex-1 overflow-y-auto p-8 simple-scrollbar">
                <form [formGroup]="userForm" class="space-y-8">
                   
                   <!-- Section 1 -->
                   <div>
                       <div class="flex items-center gap-2 mb-4 text-[#5B3C88]">
                          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          <h3 class="font-bold text-sm uppercase tracking-wide">Información del Usuario</h3>
                       </div>
                       
                       <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <!-- Nombre -->
                           <div class="space-y-1.5 col-span-1 md:col-span-2">
                             <label class="text-xs font-bold text-slate-700">Nombre Completo</label>
                             <div class="relative">
                                <input formControlName="nombre" type="text" placeholder="Ej. Juan Pérez" class="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-[#5B3C88] focus:ring-4 focus:ring-[#5B3C88]/5 transition-all outline-none">
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                   <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                </div>
                             </div>
                           </div>

                           <!-- Correo -->
                           <div class="space-y-1.5 col-span-1 md:col-span-2">
                             <label class="text-xs font-bold text-slate-700">Correo Electrónico</label>
                             <div class="relative">
                                <input formControlName="correo" type="email" placeholder="juan@ejemplo.com" class="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-[#5B3C88] focus:ring-4 focus:ring-[#5B3C88]/5 transition-all outline-none">
                                <div class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                                   <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                </div>
                             </div>
                           </div>
                           
                           <!-- Rol -->
                           <div class="space-y-1.5">
                             <label class="text-xs font-bold text-slate-700">Rol de Usuario</label>
                             <select formControlName="id_rol_usuario" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-[#5B3C88] focus:ring-4 focus:ring-[#5B3C88]/5 transition-all outline-none appearance-none cursor-pointer">
                                <option [ngValue]="null">Seleccione un rol</option>
                                <option *ngFor="let r of roles()" [ngValue]="r.id_rol">{{ r.nombre_rol }}</option>
                             </select>
                           </div>

                           <!-- Congregación -->
                           <div class="space-y-1.5">
                             <label class="text-xs font-bold text-slate-700">Congregación Asignada</label>
                             <select formControlName="id_congregacion" class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-[#5B3C88] focus:ring-4 focus:ring-[#5B3C88]/5 transition-all outline-none appearance-none cursor-pointer">
                                <option [ngValue]="null">Seleccione congregación</option>
                                <option *ngFor="let c of congregaciones()" [ngValue]="c.id_congregacion">{{ c.nombre_congregacion }}</option>
                             </select>
                           </div>
                       </div>
                   </div>
                   
                   <div class="h-px bg-slate-100 w-full"></div>

                   <!-- Section 2: Security -->
                   <div>
                       <div class="flex items-center gap-2 mb-4 text-[#5B3C88]">
                          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                          <h3 class="font-bold text-sm uppercase tracking-wide">Seguridad</h3>
                       </div>

                       <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                          <!-- Contraseña -->
                          <div class="space-y-1.5">
                             <label class="text-xs font-bold text-slate-700">Contraseña</label>
                             <div class="relative">
                                <input 
                                  [type]="showPassword() ? 'text' : 'password'" 
                                  formControlName="contrasena" 
                                  placeholder="••••••••" 
                                  class="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-[#5B3C88] focus:ring-4 focus:ring-[#5B3C88]/5 transition-all outline-none"
                                >
                                <button type="button" (click)="showPassword.set(!showPassword())" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                   <svg *ngIf="!showPassword()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                   <svg *ngIf="showPassword()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                </button>
                             </div>
                          </div>

                          <!-- Confirmar Contraseña -->
                          <div class="space-y-1.5">
                             <label class="text-xs font-bold text-slate-700">Confirmar Contraseña</label>
                             <input 
                                type="password" 
                                formControlName="confirmPassword" 
                                placeholder="••••••••" 
                                class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-[#5B3C88] focus:ring-4 focus:ring-[#5B3C88]/5 transition-all outline-none"
                                [class.border-red-300]="userForm.hasError('mismatch') && userForm.get('confirmPassword')?.touched"
                             >
                          </div>
                          
                          <p *ngIf="userForm.hasError('mismatch') && userForm.get('confirmPassword')?.touched" class="text-xs text-red-500 font-bold col-span-2">
                             Las contraseñas no coinciden
                          </p>
                       </div>
                   </div>

                </form>
             </div>

             <!-- Footer -->
             <div class="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50">
                <button (click)="closePanel()" class="px-6 py-3 rounded-xl border border-slate-200 bg-white text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
                <button (click)="save()" [disabled]="userForm.invalid || saving()" class="px-8 py-3 rounded-xl bg-[#5B3C88] text-white font-bold text-sm hover:bg-[#4a2f73] shadow-lg shadow-purple-900/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
                    <svg *ngIf="!saving()" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                    {{ saving() ? 'Guardando...' : 'Guardar Usuario' }}
                </button>
             </div>
         </div>

      </div>
    </div>
  `,
   styles: [`
    :host { display: block; height: 100%; }
    .simple-scrollbar::-webkit-scrollbar { width: 4px; }
    .simple-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .simple-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 4px; }
    .simple-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
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
      this.userForm.reset();
      this.panelOpen.set(true);
   }

   closePanel() {
      this.panelOpen.set(false);
   }

   async save() {
      if (this.userForm.invalid) return;

      this.saving.set(true);
      const val = this.userForm.value;

      this.service.createUsuario({
         nombre: val.nombre,
         correo: val.correo,
         contrasena: val.contrasena,
         id_rol_usuario: val.id_rol_usuario,
         // We are not sending id_congregacion because backend doesn't support it directly on user table
         // default state is usually 1 (active)
         id_usuario_estado: 1
      }).subscribe({
         next: (newUser) => {
            this.usuarios.update(list => [newUser, ...list]);
            this.closePanel();
            this.saving.set(false);
            // Show Success Toast?
         },
         error: (err) => {
            console.error('Create error', err);
            alert('Error al crear usuario: ' + (err.error?.detail || 'Desconocido'));
            this.saving.set(false);
         }
      })
   }

   passwordMatchValidator(g: AbstractControl) {
      return g.get('contrasena')?.value === g.get('confirmPassword')?.value
         ? null : { mismatch: true };
   }

   getRolName(u: Usuario): string {
      // Backend returns rol array names? or just id? 
      // Based on shell, it's u.roles which is string[]
      if (u.roles && u.roles.length > 0) return u.roles[0];
      // Fallback using loaded roles list if we have id_rol_usuario
      if (u.id_rol_usuario) {
         const r = this.roles().find(r => r.id_rol === u.id_rol_usuario);
         if (r) return r.nombre_rol;
      }
      return 'Sin Rol';
   }
}
