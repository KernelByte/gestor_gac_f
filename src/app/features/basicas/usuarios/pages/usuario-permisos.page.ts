import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { lastValueFrom } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';

import { PermisosService, PermisoConEstado } from '../services/permisos.service';
import { UsuariosService } from '../services/usuarios.service';
import { Usuario } from '../models/usuario.model';

interface CategoriaPermisos {
   categoria: string;
   icono: string;
   permisos: PermisoConEstado[];
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
      ])
   ],
   template: `
   <div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30 p-6">
      <div class="max-w-4xl mx-auto">
         
         <!-- Header -->
         <div class="mb-8">
            <a routerLink="/usuarios" class="inline-flex items-center gap-2 text-slate-500 hover:text-purple-600 transition-colors mb-4">
               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
               <span class="font-medium">Volver a Usuarios</span>
            </a>
            
            <div class="flex items-center gap-4">
               <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20">
                  <svg class="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
               </div>
               <div>
                  <h1 class="text-2xl font-bold text-slate-800">Permisos de Usuario</h1>
                  <p class="text-slate-500">Configura los accesos y permisos especiales</p>
               </div>
            </div>
         </div>

         <!-- Loading State -->
         <div *ngIf="loading()" class="flex items-center justify-center py-20">
            <div class="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
         </div>

         <!-- User Info Card -->
         <div *ngIf="!loading() && usuario()" @fadeIn class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
            <div class="flex items-center gap-4">
               <div class="w-14 h-14 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-md">
                  {{ getInitials(usuario()!) }}
               </div>
               <div class="flex-1">
                  <h2 class="text-lg font-bold text-slate-800">{{ usuario()!.nombre }}</h2>
                  <p class="text-slate-500 text-sm">{{ usuario()!.correo }}</p>
               </div>
               <div class="px-4 py-2 bg-cyan-50 rounded-xl">
                  <span class="text-cyan-700 font-semibold text-sm">{{ getRolName(usuario()!) }}</span>
               </div>
            </div>
         </div>

         <!-- Permissions by Category -->
         <div *ngIf="!loading()" @fadeIn class="space-y-4">
            <div *ngFor="let cat of categorias()" 
               class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
               
               <!-- Category Header -->
               <div class="px-6 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                     <span class="text-purple-600 text-lg">{{ getCategoryIcon(cat.categoria) }}</span>
                  </div>
                  <h3 class="font-bold text-slate-700">{{ cat.categoria }}</h3>
                  <span class="ml-auto text-xs text-slate-400 font-medium">
                     {{ getAssignedCount(cat) }}/{{ cat.permisos.length }} activos
                  </span>
               </div>
               
               <!-- Permissions List -->
               <div class="divide-y divide-slate-50">
                  <div *ngFor="let permiso of cat.permisos" 
                     class="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors">
                     
                     <div class="flex-1">
                        <h4 class="font-semibold text-slate-700">{{ permiso.nombre }}</h4>
                        <p *ngIf="permiso.descripcion" class="text-sm text-slate-400">{{ permiso.descripcion }}</p>
                     </div>
                     
                     <!-- Toggle Switch -->
                     <button type="button" (click)="togglePermiso(permiso)"
                        class="relative w-14 h-8 rounded-full transition-colors duration-200 focus:outline-none focus:ring-4 focus:ring-purple-500/20"
                        [class.bg-purple-600]="permiso.asignado"
                        [class.bg-slate-200]="!permiso.asignado">
                        <span class="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200"
                           [class.translate-x-6]="permiso.asignado">
                        </span>
                     </button>
                  </div>
               </div>
            </div>
         </div>

         <!-- Save Button -->
         <div *ngIf="!loading() && hasChanges()" @fadeIn 
            class="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
            <button (click)="guardar()" [disabled]="saving()"
               class="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-2xl shadow-xl shadow-purple-500/30 hover:shadow-purple-500/40 hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50">
               <svg *ngIf="!saving()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
               <div *ngIf="saving()" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
               {{ saving() ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
         </div>

         <!-- Success Toast -->
         <div *ngIf="showSuccess()" @fadeIn
            class="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 bg-emerald-500 text-white font-semibold rounded-2xl shadow-xl flex items-center gap-3">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            Permisos actualizados correctamente
         </div>
      </div>
   </div>
   `
})
export class UsuarioPermisosPage implements OnInit {
   private route = inject(ActivatedRoute);
   private router = inject(Router);
   private permisosService = inject(PermisosService);
   private usuariosService = inject(UsuariosService);

   loading = signal(true);
   saving = signal(false);
   showSuccess = signal(false);

   usuario = signal<Usuario | null>(null);
   permisos = signal<PermisoConEstado[]>([]);
   permisosOriginales = signal<Set<number>>(new Set());

   categorias = computed(() => {
      const agrupados: Map<string, PermisoConEstado[]> = new Map();
      for (const p of this.permisos()) {
         const cat = agrupados.get(p.codigo.split('.')[0]) || [];
         cat.push(p);
         agrupados.set(p.codigo.split('.')[0], cat);
      }

      // Agrupar por categoría real del permiso
      const porCategoria: Map<string, PermisoConEstado[]> = new Map();
      for (const p of this.permisos()) {
         // Usar primera parte del código como categoría si no tenemos otra
         const catKey = this.getCategoriaNombre(p.codigo);
         if (!porCategoria.has(catKey)) {
            porCategoria.set(catKey, []);
         }
         porCategoria.get(catKey)!.push(p);
      }

      return Array.from(porCategoria.entries()).map(([cat, permisos]) => ({
         categoria: cat,
         icono: this.getCategoryIcon(cat),
         permisos
      }));
   });

   hasChanges = computed(() => {
      const originales = this.permisosOriginales();
      const actuales = new Set(this.permisos().filter(p => p.asignado).map(p => p.id_permiso));

      if (originales.size !== actuales.size) return true;
      for (const id of originales) {
         if (!actuales.has(id)) return true;
      }
      return false;
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
         // Cargar usuario y permisos en paralelo
         const [usuarios, permisos] = await Promise.all([
            lastValueFrom(this.usuariosService.getUsuarios()),
            lastValueFrom(this.permisosService.getPermisosUsuario(idUsuario))
         ]);

         const usuario = usuarios.find(u => u.id_usuario === idUsuario);
         if (!usuario) {
            this.router.navigate(['/usuarios']);
            return;
         }

         this.usuario.set(usuario);
         this.permisos.set(permisos);
         this.permisosOriginales.set(new Set(permisos.filter(p => p.asignado).map(p => p.id_permiso)));
      } catch (err) {
         console.error('Error loading data', err);
      } finally {
         this.loading.set(false);
      }
   }

   togglePermiso(permiso: PermisoConEstado) {
      this.permisos.update(list =>
         list.map(p => p.id_permiso === permiso.id_permiso
            ? { ...p, asignado: !p.asignado }
            : p
         )
      );
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

         // Actualizar originales
         this.permisosOriginales.set(new Set(permisosActivos));

         // Mostrar éxito
         this.showSuccess.set(true);
         setTimeout(() => this.showSuccess.set(false), 3000);

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

   getCategoryIcon(categoria: string): string {
      const iconos: Record<string, string> = {
         'Publicadores': '👥',
         'Grupos': '📁',
         'Informes': '📊',
         'Territorios': '🗺️',
         'Reuniones': '📅',
         'Exhibidores': '📺'
      };
      return iconos[categoria] || '📋';
   }

   getAssignedCount(cat: CategoriaPermisos): number {
      return cat.permisos.filter(p => p.asignado).length;
   }
}
