import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
        style({ opacity: 0, transform: 'translateX(100%)' }),
        animate('500ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateX(0)' }))
      ]),
      transition(':leave', [
        animate('300ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 0, transform: 'translateX(100%)' }))
      ])
    ]),
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(10px)' }),
        animate('400ms ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ],
  template: `
    <div class="min-h-full pb-8">
      
      <!-- 1. Header Section -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">Gestión de Roles del Sistema</h1>
          <p class="text-slate-500 mt-1 text-base">Configure los niveles de acceso y permisos para los usuarios de la congregación.</p>
        </div>
        <button (click)="openCreatePanel()" 
           class="group relative inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#6D28D9] hover:bg-[#5b21b6] text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-900/20 hover:shadow-purple-900/30 active:scale-95">
           <svg class="w-5 h-5 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
           <span>Nuevo Rol</span>
        </button>
      </div>

      <!-- 2. Filters & Search -->
      <div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-col sm:flex-row items-center gap-2">
         <div class="relative flex-1 w-full group">
            <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#6D28D9] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              [value]="searchTerm()"
              (input)="updateSearch($event)"
              placeholder="Buscar por nombre de rol..." 
              class="w-full pl-12 pr-4 py-3 bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400 font-medium"
            >
         </div>
         <div class="h-8 w-px bg-slate-100 hidden sm:block"></div>
         <div class="w-full sm:w-auto px-2">
             <button class="w-full sm:w-auto flex items-center justify-between gap-3 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-sm transition-colors border border-transparent hover:border-slate-200">
                <span>Todos los estados</span>
                <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
             </button>
         </div>
      </div>

      <!-- 3. Roles Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="bg-slate-50/80 border-b border-slate-100">
                <th class="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Nombre del Rol</th>
                <th class="px-6 py-4 text-left text-[11px] font-bold text-slate-400 uppercase tracking-widest">Descripción</th>
                <th class="px-6 py-4 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest w-32">Usuarios</th>
                <th class="px-6 py-4 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest w-32">Estado</th>
                <th class="px-6 py-4 text-right text-[11px] font-bold text-slate-400 uppercase tracking-widest w-40">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr *ngFor="let rol of filteredRoles()" @fadeIn class="group hover:bg-slate-50/50 transition-colors">
                <!-- Nombre del Rol -->
                <td class="px-6 py-4">
                  <div class="flex items-center gap-4">
                     <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shadow-sm ring-1 ring-inset ring-slate-900/5"
                         [ngClass]="getRoleColor(rol.descripcion_rol)">
                        {{ rol.descripcion_rol.charAt(0).toUpperCase() }}
                     </div>
                     <div>
                        <div class="font-bold text-slate-800">{{ rol.descripcion_rol }}</div>
                        <div class="text-[10px] font-mono text-slate-400">ID: ROL-00{{ rol.id_rol }}</div>
                     </div>
                  </div>
                </td>
                
                <!-- Descripción Mock -->
                <td class="px-6 py-4">
                  <span class="text-sm text-slate-500 font-medium">{{ getRoleDescription(rol.descripcion_rol) }}</span>
                </td>

                <!-- Usuarios Mock -->
                <td class="px-6 py-4 text-center">
                   <div class="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">
                      {{ getRoleUserCount(rol.id_rol) }}
                   </div>
                </td>

                <!-- Estado Mock -->
                <td class="px-6 py-4 text-center">
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                     <span class="relative flex h-2 w-2">
                       <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                       <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                     </span>
                     <span class="text-[11px] font-bold tracking-wide">Activo</span>
                  </div>
                </td>

                <!-- Acciones -->
                <td class="px-6 py-4">
                   <div class="flex items-center justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button (click)="editRol(rol)" class="p-2 text-slate-400 hover:text-[#6D28D9] hover:bg-purple-50 rounded-lg transition-all" title="Editar">
                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      </button>
                      <button (click)="confirmDelete(rol)" class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Eliminar">
                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                   </div>
                </td>
              </tr>
              
              <tr *ngIf="filteredRoles().length === 0" class="bg-slate-50/50">
                 <td colspan="5" class="px-6 py-16 text-center">
                    <div class="flex flex-col items-center justify-center text-slate-400">
                       <div class="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-4 transform -rotate-6">
                          <svg class="w-8 h-8 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                       </div>
                       <h3 class="font-bold text-slate-900 text-lg">No se encontraron roles</h3>
                       <p class="text-sm mt-1">Intenta con otro término de búsqueda o crea un nuevo rol.</p>
                       <button (click)="openCreatePanel()" class="mt-4 text-[#6D28D9] font-bold text-sm hover:underline">Crear nuevo rol</button>
                    </div>
                 </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 4. Floating Overlay Panel (Improved) -->
      <div *ngIf="panelOpen()" class="fixed inset-0 z-50 flex justify-end">
         <!-- Backdrop -->
         <div class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" (click)="closePanel()"></div>
         
         <!-- Panel -->
         <div @slidePanel class="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
            
            <div class="px-8 py-6 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
               <div>
                  <h2 class="text-2xl font-black text-slate-900">{{ editingRol() ? 'Editar Rol' : 'Nuevo Rol' }}</h2>
                  <p class="text-sm text-slate-500 font-medium mt-0.5">Complete la información del rol.</p>
               </div>
               <button (click)="closePanel()" class="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                  <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
               </button>
            </div>

            <div class="flex-1 overflow-y-auto p-8">
               <form [formGroup]="rolForm" (ngSubmit)="save()" class="space-y-6">
                  <!-- Name Input -->
                  <div class="space-y-2">
                     <label class="block text-sm font-bold text-slate-700">Nombre del Rol</label>
                     <div class="relative">
                        <input type="text" formControlName="descripcion_rol" 
                           class="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-800 font-medium focus:border-purple-300 focus:ring-4 focus:ring-purple-100 transition-all placeholder:text-slate-400 outline-none"
                           placeholder="Ej: Administrador">
                     </div>
                     <p *ngIf="rolForm.get('descripcion_rol')?.touched && rolForm.get('descripcion_rol')?.invalid" 
                        class="text-xs text-red-500 font-bold flex items-center gap-1.5 animate-fadeIn">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                        El nombre es requerido (mínimo 3 caracteres)
                     </p>
                  </div>

                  <!-- Mock Description Input (Visual Only) -->
                  <div class="space-y-2 opacity-70 pointer-events-none grayscale">
                     <label class="block text-sm font-bold text-slate-700">Descripción (Opcional)</label>
                     <textarea rows="3" class="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-slate-500 font-medium resize-none" placeholder="Este campo se autogenera..."></textarea>
                     <p class="text-[10px] text-slate-400 bg-slate-100 p-2 rounded-lg">Nota: En esta versión, la descripción se deduce automáticamente del rol.</p>
                  </div>
               </form>
            </div>

            <div class="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 shrink-0">
                <button (click)="closePanel()" class="flex-1 py-3.5 px-4 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors">
                   Cancelar
                </button>
                <button (click)="save()" [disabled]="rolForm.invalid || saving()"
                   class="flex-1 py-3.5 px-4 bg-[#6D28D9] hover:bg-[#5b21b6] text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                   <span *ngIf="saving()" class="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span>
                   {{ saving() ? 'Guardando...' : (editingRol() ? 'Actualizar Rol' : 'Crear Rol') }}
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

  roles = signal<Rol[]>([]);
  searchTerm = signal('');

  // Computed Signal for Filtering
  filteredRoles = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.roles().filter(r =>
      r.descripcion_rol.toLowerCase().includes(term)
    );
  });

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

  updateSearch(event: any) {
    this.searchTerm.set(event.target.value);
  }

  // --- Mock Helpers for UI ---
  getRoleColor(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('admin')) return 'bg-purple-100 text-purple-700';
    if (n.includes('secret')) return 'bg-orange-100 text-orange-700';
    if (n.includes('super')) return 'bg-blue-100 text-blue-700';
    if (n.includes('gestor')) return 'bg-pink-100 text-pink-700';
    if (n.includes('coord')) return 'bg-emerald-100 text-emerald-700';
    return 'bg-slate-100 text-slate-700';
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
    // Deterministic mock number based on ID
    return (id * 7) % 20 + 1;
  }

  // --- Logic ---

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
      this.loadRoles();
    } catch (err) {
      console.error('Error guardando rol', err);
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
      // alert("No se pudo eliminar el rol. Puede estar en uso."); 
    }
  }
}
