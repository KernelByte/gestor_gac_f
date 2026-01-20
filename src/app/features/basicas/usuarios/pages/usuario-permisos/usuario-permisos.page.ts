import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { trigger, transition, style, animate, state } from '@angular/animations';

import { PermisosService, PermisoConEstado } from '../../services/permisos.service';
import { UsuariosService } from '../../services/usuarios.service';
import { Usuario } from '../../models/usuario.model';

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
   templateUrl: './usuario-permisos.page.html',
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
