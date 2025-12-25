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
   <div class="min-h-screen" style="background-color: #f3f4f6;">
      
      <!-- Main Content Container -->
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
         
         <!-- Page Header -->
         <div class="mb-6">
            <!-- Back Link -->
            <a routerLink="/usuarios" 
               class="inline-flex items-center gap-2 text-slate-500 hover:text-purple-600 transition-colors mb-4 text-sm font-medium">
               <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
               Volver a Usuarios
            </a>
            
            <!-- Header Card -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
               <div class="flex flex-col sm:flex-row sm:items-center gap-4">
                  <!-- Icon & Title -->
                  <div class="flex items-center gap-4 flex-1 min-w-0">
                     <div class="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <svg class="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                     </div>
                     <div class="min-w-0">
                        <h1 class="text-xl sm:text-2xl font-bold text-slate-800 truncate">Permisos de Usuario</h1>
                        <p class="text-sm text-slate-500">Configura los accesos y permisos especiales</p>
                     </div>
                  </div>
                  
                  <!-- User Info -->
                  <div *ngIf="usuario()" class="flex items-center gap-3 sm:ml-auto bg-slate-50 px-4 py-3 rounded-xl border border-slate-100">
                     <div class="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
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
         </div>

         <!-- Content Below Header -->
         
         <!-- Loading State -->
         <div *ngIf="loading()" class="flex flex-col items-center justify-center py-20 gap-4">
            <div class="animate-spin w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full"></div>
            <p class="text-slate-500">Cargando permisos...</p>
         </div>

         <!-- Stats & Search Bar -->
         <div *ngIf="!loading()" @fadeIn class="mb-6">
            <div class="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
               <!-- Stats -->
               <div class="flex items-center gap-4">
                  <div class="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                     <div class="w-3 h-3 rounded-full bg-emerald-500"></div>
                     <span class="text-sm font-medium text-slate-600">
                        <span class="text-emerald-600 font-bold">{{ totalAsignados() }}</span> de {{ totalPermisos() }} permisos activos
                     </span>
                  </div>
                  
                  <!-- Quick Actions -->
                  <button (click)="toggleTodos(true)" 
                     class="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                     <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                     Activar todos
                  </button>
                  <button (click)="toggleTodos(false)" 
                     class="hidden sm:flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">
                     <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                     Desactivar todos
                  </button>
               </div>
               
               <!-- Search -->
               <div class="relative w-full sm:w-64">
                  <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                  <input type="text" 
                     [(ngModel)]="searchQuery"
                     placeholder="Buscar permiso..."
                     class="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition-all">
               </div>
            </div>
         </div>

         <!-- Categories Grid -->
         <div *ngIf="!loading()" @fadeIn class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <div *ngFor="let cat of filteredCategorias()" 
               class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md transition-shadow">
               
               <!-- Category Header -->
               <button (click)="toggleCategoria(cat)" 
                  class="w-full px-5 py-4 flex items-center gap-3 bg-slate-50 hover:bg-purple-50 transition-colors">
                  <div class="w-11 h-11 rounded-xl flex items-center justify-center"
                     [ngClass]="getCategoryBgClass(cat.categoria)">
                     <div class="w-5 h-5" [innerHTML]="getCategoryIcon(cat.categoria)"></div>
                  </div>
                  <div class="flex-1 text-left">
                     <h3 class="font-bold text-slate-700">{{ cat.categoria }}</h3>
                     <p class="text-xs text-slate-400">{{ cat.permisos.length }} permisos disponibles</p>
                  </div>
                  
                  <!-- Progress & Toggle -->
                  <div class="flex items-center gap-3">
                     <div class="hidden sm:flex items-center gap-2">
                        <div class="w-20 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div class="h-full bg-purple-500 rounded-full transition-all duration-300"
                              [style.width.%]="(getAssignedCount(cat) / cat.permisos.length) * 100"></div>
                        </div>
                        <span class="text-xs font-semibold text-slate-500 w-8">{{ getAssignedCount(cat) }}/{{ cat.permisos.length }}</span>
                     </div>
                     <svg class="w-5 h-5 text-slate-400 transition-transform duration-200" 
                        [class.rotate-180]="cat.expandido"
                        fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M19 9l-7 7-7-7"/>
                     </svg>
                  </div>
               </button>
               
               <!-- Permissions List -->
               <div [@expandCollapse]="cat.expandido ? 'expanded' : 'collapsed'" class="border-t border-slate-100">
                  <!-- Toggle All for Category -->
                  <div class="px-5 py-3 bg-slate-50/50 flex items-center justify-between border-b border-slate-100">
                     <span class="text-xs font-medium text-slate-500">Permisos de {{ cat.categoria }}</span>
                     <div class="flex items-center gap-2">
                        <button (click)="toggleCategoriaTodos(cat, true); $event.stopPropagation()"
                           class="px-2 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
                           Activar todo
                        </button>
                        <span class="text-slate-300">|</span>
                        <button (click)="toggleCategoriaTodos(cat, false); $event.stopPropagation()"
                           class="px-2 py-1 text-xs font-medium text-slate-400 hover:bg-slate-100 rounded transition-colors">
                           Desactivar
                        </button>
                     </div>
                  </div>
                  
                  <div class="divide-y divide-slate-50">
                      <div *ngFor="let permiso of cat.permisos">
                        <div class="px-5 py-3.5 flex items-center gap-4 hover:bg-purple-50/30 transition-colors group cursor-pointer"
                           (click)="togglePermiso(permiso)">
                           
                           <!-- Permission Icon & Info -->
                           <div class="flex-1 min-w-0">
                              <div class="flex items-center gap-2">
                                 <span class="text-sm" [class.text-emerald-500]="permiso.asignado" [class.text-slate-400]="!permiso.asignado">
                                    {{ getPermisoIcon(permiso.codigo) }}
                                 </span>
                                 <h4 class="font-semibold text-sm truncate"
                                    [class.text-slate-700]="permiso.asignado"
                                    [class.text-slate-500]="!permiso.asignado">
                                    {{ permiso.nombre }}
                                 </h4>
                              </div>
                              <p *ngIf="permiso.descripcion" class="text-xs text-slate-400 mt-0.5 truncate">
                                 {{ permiso.descripcion }}
                              </p>
                           </div>
                           
                           <!-- Toggle Switch -->
                           <div class="relative w-11 h-6 rounded-full transition-all duration-200 cursor-pointer flex-shrink-0"
                              [class.bg-emerald-500]="permiso.asignado"
                              [class.bg-slate-200]="!permiso.asignado"
                              [class.shadow-emerald-500/30]="permiso.asignado"
                              [class.shadow-lg]="permiso.asignado">
                              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 flex items-center justify-center"
                                 [class.translate-x-5]="permiso.asignado">
                                 <svg *ngIf="permiso.asignado" class="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                                    <path d="M5 13l4 4L19 7"/>
                                 </svg>
                              </div>
                           </div>
                        </div>

                        <!-- Config Panel for Informes.Editar -->
                        <div *ngIf="permiso.codigo === 'informes.editar' && permiso.asignado" 
                             class="px-5 pb-4 pl-[3.25rem] animate-fadeIn">
                           <div class="bg-slate-50 rounded-xl border border-slate-200 p-3 shadow-sm">
                              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                 Alcance de edición
                              </label>
                              <div class="flex items-center gap-3">
                                 <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="scope_edit" [value]="'todos'" 
                                           [(ngModel)]="permiso.alcance" (click)="$event.stopPropagation()"
                                           class="text-purple-600 focus:ring-purple-500 border-gray-300">
                                    <span class="text-sm text-slate-700">Todos los grupos</span>
                                 </label>
                                 <label class="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="scope_edit" [value]="'asignados'" 
                                           [(ngModel)]="permiso.alcance" (click)="$event.stopPropagation()"
                                           class="text-purple-600 focus:ring-purple-500 border-gray-300">
                                    <span class="text-sm text-slate-700">Solo asignados</span>
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
            class="flex flex-col items-center justify-center py-16 text-center">
            <div class="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
               <svg class="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"/>
               </svg>
            </div>
            <p class="text-slate-500 font-medium">No se encontraron permisos</p>
            <p class="text-sm text-slate-400 mt-1">Intenta con otro término de búsqueda</p>
         </div>
      </div>

      <!-- Floating Save Button -->
      <div *ngIf="!loading() && hasChanges()" @slideUp
         class="fixed bottom-0 inset-x-0 p-4 pointer-events-none">
         <div class="max-w-md mx-auto pointer-events-auto">
            <button (click)="guardar()" [disabled]="saving()"
               class="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed">
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
         class="fixed top-20 right-4 sm:right-8 z-50 px-5 py-4 bg-emerald-500 text-white font-semibold rounded-2xl shadow-xl flex items-center gap-3">
         <div class="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
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

      if (originales.size !== actuales.size) return true;
      for (const id of originales) {
         if (!actuales.has(id)) return true;
      }
      return false;
   });

   changesCount = computed(() => {
      const originales = this.permisosOriginales();
      const actuales = new Set(this.permisos().filter(p => p.asignado).map(p => p.id_permiso));
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

         // Mock informes.historial if missing (Visual request)
         const hasHistorial = permisos.some(p => p.codigo === 'informes.historial');
         if (!hasHistorial) {
            permisos.push({
               id_permiso: 99999, // Temp ID
               codigo: 'informes.historial',
               nombre: 'Ver Historial',
               descripcion: 'Acceso al historial de informes de servicio',
               asignado: false, // Removed categoria
               alcance: 'todos'
            });
         }
         permisos.forEach(p => { if (!p.alcance) p.alcance = 'todos'; });

         this.usuario.set(usuario);
         this.permisos.set(permisos);
         this.permisosOriginales.set(new Set(permisos.filter(p => p.asignado).map(p => p.id_permiso)));

         // Mantener categorías colapsadas por defecto (Set vacío)
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

   async guardar() {
      if (this.saving() || !this.usuario()) return;

      this.saving.set(true);
      try {
         const permisosActivos = this.permisos()
            .filter(p => p.asignado)
            .map(p => p.id_permiso);

         await lastValueFrom(
            this.permisosService.updatePermisosUsuario(this.usuario()!.id_usuario!, permisosActivos)
         );

         this.permisosOriginales.set(new Set(permisosActivos));

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

   getCategoryBgClass(categoria: string): string {
      const clases: Record<string, string> = {
         'Publicadores y Grupos': 'bg-blue-100 text-blue-600',
         'Publicadores': 'bg-blue-100 text-blue-600',
         'Grupos': 'bg-amber-100 text-amber-600',
         'Informes': 'bg-emerald-100 text-emerald-600',
         'Territorios': 'bg-teal-100 text-teal-600',
         'Reuniones': 'bg-purple-100 text-purple-600',
         'Exhibidores': 'bg-rose-100 text-rose-600'
      };
      return clases[categoria] || 'bg-slate-100 text-slate-600';
   }

   getPermisoIcon(codigo: string): string {
      if (codigo.includes('ver')) return '👁️';
      if (codigo.includes('editar')) return '✏️';
      if (codigo.includes('crear')) return '➕';
      if (codigo.includes('crear')) return '➕';
      if (codigo.includes('enviar')) return '📤';
      if (codigo.includes('historial')) return '⏳';
      return '🔐';
   }

   getAssignedCount(cat: CategoriaPermisos): number {
      return cat.permisos.filter(p => p.asignado).length;
   }
}
