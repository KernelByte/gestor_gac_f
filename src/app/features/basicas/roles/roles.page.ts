import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { RolesService } from './services/roles.service';
import { Rol } from './models/rol.model';
import { lastValueFrom } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-roles-page',
  imports: [CommonModule, ReactiveFormsModule],
  animations: [
    trigger('slidePanel', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateX(40px) scale(0.95)' }),
        animate('600ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateX(0) scale(1)' }))
      ]),
      transition(':leave', [
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, transform: 'translateX(20px) scale(0.95)' }))
      ])
    ])
  ],
  template: `
    <div class="min-h-screen pb-12">
      <!-- Header Section -->
      <div class="mb-8">
        <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 tracking-tight">
          Gestión de Roles
        </h1>
        <p class="text-slate-500 mt-2 text-lg">Define los perfiles y niveles de acceso del sistema.</p>
      </div>

      <!-- Stats Cards Row -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
         <div class="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-6 shadow-sm border border-slate-200/60 relative overflow-hidden group">
            <div class="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full -mr-4 -mt-4 transition-transform duration-500 group-hover:scale-110"></div>
            <div class="relative z-10 flex items-center justify-between">
                <div>
                   <div class="text-sm font-semibold text-purple-600 mb-1">Total Registrados</div>
                   <div class="text-3xl font-bold text-slate-800 tracking-tight">{{ roles().length }}</div>
                </div>
                <div class="p-3 bg-purple-100/50 rounded-xl text-purple-600 group-hover:rotate-12 transition-transform duration-300">
                   <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
            </div>
         </div>
      </div>

      <!-- Main Layout: Split View -->
      <div class="flex flex-col lg:flex-row gap-6 items-stretch relative">
        
        <!-- List Section (Shrinks when form is open) -->
        <div class="flex-1 w-full bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden flex flex-col transition-all duration-500 cubic-bezier(0.2, 0.8, 0.2, 1)"
             [ngClass]="{'lg:w-2/3': panelOpen()}">
          
          <!-- Toolbar -->
          <div class="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
             <div class="flex items-center gap-2 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                <span class="font-medium text-sm">Listado Maestro</span>
             </div>
             
             <button *ngIf="!panelOpen()" (click)="openCreatePanel()" 
                class="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 active:scale-95 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Nuevo Rol
             </button>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="bg-slate-50/50 border-b border-slate-100">
                  <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">ID</th>
                  <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rol / Descripción</th>
                  <th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr *ngFor="let rol of roles()" class="group hover:bg-slate-50/80 transition-colors cursor-default">
                  <td class="px-6 py-4 text-sm font-semibold text-slate-400">#{{ rol.id_rol }}</td>
                  <td class="px-6 py-4">
                     <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-lg bg-orange-100/50 text-orange-600 flex items-center justify-center">
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                        <span class="font-medium text-slate-700">{{ rol.descripcion_rol }}</span>
                     </div>
                  </td>
                  <td class="px-6 py-4 text-right">
                     <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button (click)="editRol(rol)" class="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Editar">
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        </button>
                        <button (click)="confirmDelete(rol)" class="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Eliminar">
                           <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                     </div>
                  </td>
                </tr>
                <tr *ngIf="roles().length === 0 && !loading()">
                   <td colspan="3" class="px-6 py-12 text-center">
                      <div class="flex flex-col items-center justify-center text-slate-400">
                         <div class="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                         </div>
                         <p>No se encontraron roles.</p>
                      </div>
                   </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Inline Form Panel with Animation -->
        <div *ngIf="panelOpen()" @slidePanel
             class="w-full lg:w-96 shrink-0 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden flex flex-col">
           
           <div class="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 class="font-bold text-slate-800 text-lg flex items-center gap-2">
                 <span class="w-2 h-6 bg-slate-900 rounded-full"></span>
                 {{ editingRol() ? 'Editar Rol' : 'Nuevo Rol' }}
              </h3>
              <button (click)="closePanel()" class="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
           </div>

           <div class="p-6 flex-1">
              <form [formGroup]="rolForm" (ngSubmit)="save()" class="space-y-5">
                 <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-2">Nombre / Descripción</label>
                    <input type="text" formControlName="descripcion_rol" 
                       class="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-2.5 text-slate-700 focus:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all placeholder:text-slate-400"
                       placeholder="Ej: Publicador Auxiliar">
                     <p *ngIf="rolForm.get('descripcion_rol')?.touched && rolForm.get('descripcion_rol')?.invalid" 
                        class="mt-2 text-xs text-red-500 font-medium flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        Campo requerido
                     </p>
                 </div>

                 <div class="pt-6 flex flex-col gap-3">
                    <button type="submit" [disabled]="rolForm.invalid || saving()"
                       class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl transition-all shadow-lg shadow-slate-900/10 hover:shadow-slate-900/20 active:translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                       <svg *ngIf="!saving()" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                       <span *ngIf="saving()" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                       {{ saving() ? 'Guardando...' : 'Guardar Cambios' }}
                    </button>
                    <button type="button" (click)="closePanel()" class="w-full py-3 text-slate-500 hover:text-slate-700 hover:bg-slate-50 font-medium rounded-xl transition-all">
                       Cancelar
                    </button>
                 </div>
              </form>
           </div>
           
           <div class="px-6 py-4 bg-slate-50/50 border-t border-slate-100">
               <p class="text-xs text-slate-400 text-center">Los roles definen permisos críticos en el sistema.</p>
           </div>
        </div>

      </div>
    </div>
  `
})
export class RolesPage implements OnInit {
  private rolesService = inject(RolesService);
  private fb = inject(FormBuilder);

  roles = signal<Rol[]>([]);
  loading = signal(false);
  saving = signal(false);
  panelOpen = signal(false);
  editingRol = signal<Rol | null>(null);

  rolForm: FormGroup;

  constructor() {
    this.rolForm = this.fb.group({
      descripcion_rol: ['', [Validators.required, Validators.minLength(3)]]
    });
  }

  ngOnInit() {
    this.loadRoles();
  }

  async loadRoles() {
    this.loading.set(true);
    try {
      const data = await lastValueFrom(this.rolesService.getRoles());
      this.roles.set(data);
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
      this.loadRoles(); // Recargar lista
    } catch (err) {
      console.error('Error guardando rol', err);
      // Aquí podrías mostrar un toast de error
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(rol: Rol) {
    if (confirm(`¿Estás seguro de eliminar el rol "${rol.descripcion_rol}"?`)) {
      this.deleteRol(rol.id_rol);
    }
  }

  async deleteRol(id: number) {
    try {
      await lastValueFrom(this.rolesService.deleteRol(id));
      this.loadRoles();
    } catch (err) {
      console.error("Error al eliminar", err);
      alert("No se pudo eliminar el rol. Puede estar en uso.");
    }
  }
}
