import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { RolesService } from './services/roles.service';
import { Rol } from './models/rol.model';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

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
    <div class="flex flex-col gap-6 h-full">
      
      <!-- 1. Header Section -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 class="text-3xl font-display font-black text-slate-900 tracking-tight">Gestión de Roles</h1>
          <p class="text-slate-500 mt-1 text-base">Configure los niveles de acceso y permisos.</p>
        </div>
        <button (click)="openCreatePanel()" 
           class="group relative inline-flex items-center justify-center gap-2 px-6 h-12 bg-[#6D28D9] hover:bg-[#5b21b6] text-white font-display font-bold rounded-xl transition-all shadow-lg shadow-purple-900/20 active:scale-95">
           <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
           <span>Nuevo Rol</span>
        </button>
      </div>

      <!-- 2. Filters -->
      <div class="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-center gap-2 shrink-0">
         <div class="relative flex-1 w-full group">
            <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-[#6D28D9] transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="text" 
              [value]="searchTerm()"
              (input)="updateSearch($event)"
              placeholder="Buscar rol..." 
              class="w-full pl-12 pr-4 py-3 bg-transparent border-none outline-none text-slate-700 placeholder:text-slate-400 font-medium"
            >
         </div>
         <div class="h-8 w-px bg-slate-100 hidden sm:block"></div>
         <button class="w-full sm:w-auto px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl font-bold text-sm transition-colors border border-transparent hover:border-slate-200">
            Filtros
         </button>
      </div>

      <!-- 3. Roles Table (Pro Standard) -->
      <div class="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm relative min-h-0">
        
        <!-- Loading Skeleton -->
        <div *ngIf="loading()" class="absolute inset-0 bg-white z-10 p-6 space-y-4">
           <div class="flex items-center gap-4 animate-pulse" *ngFor="let i of [1,2,3,4,5]">
              <div class="h-10 w-10 bg-slate-100 rounded-lg"></div>
              <div class="flex-1 h-4 bg-slate-100 rounded"></div>
              <div class="w-24 h-4 bg-slate-100 rounded"></div>
           </div>
        </div>

        <table class="w-full border-collapse text-left" *ngIf="!loading()">
          <thead class="bg-slate-50/80 border-b border-slate-200 sticky top-0 z-10 backdrop-blur-md">
            <tr>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400">Rol</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 hidden lg:table-cell">Descripción</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Usuarios</th>
              <th class="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 text-center">Estado</th>
              <th class="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-400"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr *ngFor="let rol of filteredRoles()" class="group transition-colors duration-200 hover:bg-slate-50">
              <!-- Name & Avatar -->
              <td class="px-6 py-4">
                <div class="flex items-center gap-4">
                  <!-- Dynamic Light Color Avatar -->
                  <div [ngClass]="getRoleStyle(rol.nombre_rol)" 
                       class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-lg shadow-sm ring-1 ring-white border border-white/50">
                    {{ rol.nombre_rol.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <p class="text-sm font-bold text-slate-800 tracking-tight">{{ rol.nombre_rol }}</p>
                    <p class="text-[11px] font-medium text-slate-400 mt-0.5">ID: {{ rol.id_rol }}</p>
                  </div>
                </div>
              </td>

              <!-- Description (Separate Column) -->
              <td class="px-6 py-4 hidden lg:table-cell">
                <p class="text-sm text-slate-600 font-medium max-w-xs truncate" [title]="rol.descripcion_rol">
                  {{ rol.descripcion_rol || '—' }}
                </p>
              </td>

              <!-- Users Count (Interactive Pill) -->
              <td class="px-6 py-4 text-center">
                 <button 
                    (click)="navigateToUsers(rol.id_rol)" 
                    class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 text-slate-600 text-xs font-bold border border-slate-200 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 transition-all active:scale-95 group/btn"
                    title="Ver usuarios con este rol"
                 >
                    <svg class="w-3.5 h-3.5 opacity-70 group-hover/btn:text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    {{ getRoleUserCount(rol.id_rol) }}
                 </button>
              </td>

              <!-- Status -->
              <td class="px-6 py-4 text-center">
                <div class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 border border-emerald-100/50">
                   <div class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                   Activo
                </div>
              </td>

              <!-- Actions (Reveal on Hover) -->
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
          </tbody>
        </table>

        <!-- Empty State -->
        <div *ngIf="filteredRoles().length === 0 && !loading()" class="flex flex-col items-center justify-center py-16 text-center">
           <div class="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
              <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
           </div>
           <p class="text-slate-900 font-medium">No hay registros</p>
           <p class="text-slate-500 text-sm mt-1">No se encontraron roles coincidentes.</p>
        </div>
      </div>

      <!-- 4. Overlay Panel (Cleaned up outer margins if necessary) -->
      <!-- ... (Keep existing panel logic but ensure z-index handles it) ... -->
      <div *ngIf="panelOpen()" class="fixed inset-0 z-50 flex justify-end">
         <!-- Backdrop -->
         <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" (click)="closePanel()"></div>
         
         <!-- Slide-over Panel -->
         <div @slidePanel class="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-100">
            
            <!-- Header -->
            <div class="px-8 py-6 border-b border-slate-100 bg-white flex items-center justify-between shrink-0 z-10">
               <div class="flex items-center gap-4">
                  <div class="h-12 w-12 rounded-2xl bg-purple-50 flex items-center justify-center text-[#6D28D9] border border-purple-100">
                     <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                  </div>
                  <div>
                     <h2 class="text-xl font-display font-black text-slate-900 tracking-tight">{{ editingRol() ? 'Editar Rol' : 'Crear Nuevo Rol' }}</h2>
                     <p class="text-sm text-slate-500 font-medium mt-0.5">Defina los datos del rol de usuario.</p>
                  </div>
               </div>
               <button (click)="closePanel()" class="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
               </button>
            </div>
            
            <!-- Body -->
            <div class="flex-1 overflow-y-auto p-8 bg-white relative">
               <form [formGroup]="rolForm" (ngSubmit)="save()" class="space-y-6">
                  
                  <!-- Name Input -->
                  <div class="space-y-2 group">
                     <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Nombre del Rol</label>
                     <div class="relative">
                        <input type="text" formControlName="nombre_rol" 
                           class="peer w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3.5 text-slate-900 font-bold focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none placeholder:text-slate-400 placeholder:font-normal"
                           placeholder="Ej: Administrador">
                     </div>
                  </div>

                  <!-- Description Input -->
                  <div class="space-y-2 group">
                     <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Descripción</label>
                     <textarea formControlName="descripcion_rol" rows="3" 
                        class="w-full rounded-xl border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 text-sm font-medium resize-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all placeholder:text-slate-400"
                        placeholder="Descripción breve del rol..."></textarea>
                  </div>

               </form>
            </div>

            <!-- Footer -->
            <div class="p-8 border-t border-slate-100 bg-slate-50/50 flex items-center gap-3 shrink-0 backdrop-blur-sm z-10">
                 <button (click)="closePanel()" class="flex-1 py-3.5 px-6 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm">
                    Cancelar
                 </button>
                 <button (click)="save()" [disabled]="rolForm.invalid || saving()" 
                    class="flex-[2] py-3.5 px-6 bg-[#6D28D9] hover:bg-[#5b21b6] text-white font-bold rounded-xl shadow-lg shadow-purple-900/20 hover:shadow-purple-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-95">
                    <span *ngIf="saving()" class="animate-spin h-5 w-5 border-2 border-white/30 border-t-white rounded-full"></span>
                    <span *ngIf="!saving()">{{ editingRol() ? 'Guardar Cambios' : 'Crear Rol' }}</span>
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

  // --- Mock Helpers for UI ---
  getRoleStyle(roleName: string): string {
    const n = (roleName || '').toLowerCase();
    const char = n.charCodeAt(0);

    // Deterministic pastel color mapping based on first char (Homologated with Users Page)
    if (char % 5 === 0) return 'bg-purple-100 text-purple-700 ring-purple-600/20';
    if (char % 5 === 1) return 'bg-blue-100 text-blue-700 ring-blue-600/20';
    if (char % 5 === 2) return 'bg-emerald-100 text-emerald-700 ring-emerald-600/20';
    if (char % 5 === 3) return 'bg-orange-100 text-orange-700 ring-orange-600/20';
    return 'bg-cyan-100 text-cyan-700 ring-cyan-600/20';
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
    } catch (err) {
      console.error('Error guardando rol', err);
    } finally {
      this.saving.set(false);
    }
  }

  confirmDelete(rol: Rol) {
    if (confirm(`¿Estás seguro de eliminar el rol "${rol.nombre_rol}"?`)) {
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
