import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import { GruposService } from '../services/grupos.service';
import { Grupo } from '../models/grupo.model';
import { AuthStore } from '../../../../core/auth/auth.store';

@Component({
   standalone: true,
   selector: 'app-grupos-list',
   imports: [CommonModule, ReactiveFormsModule],
   templateUrl: './grupos.page.html',
   styles: [`
    :host { 
      display: block;
      height: 100%;
      overflow: hidden;
    }
    .simple-scrollbar::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    .simple-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .simple-scrollbar::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 4px;
    }
    .simple-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #cbd5e1;
    }
  `]
})
export class GruposListComponent implements OnInit {
   private gruposService = inject(GruposService);
   private authStore = inject(AuthStore);
   private fb = inject(FormBuilder);
   private router = inject(Router);
   private http = inject(HttpClient);

   grupos = signal<Grupo[]>([]);
   totalSinAsignar = signal(0);
   searchControl = this.fb.control('');
   Math = Math;

   // Pagination
   currentPage = signal(1);
   pageSize = 10;

   // Computed & Filtering with Pagination
   filteredGrupos = computed(() => {
      let data = this.grupos();
      const query = this.searchControl.value?.toLowerCase() || '';
      if (query) {
         data = data.filter(g => g.nombre_grupo.toLowerCase().includes(query) || g.capitan_grupo?.toLowerCase().includes(query));
      }
      return data;
   });

   // Paginated list
   pagedList = computed(() => {
      const start = (this.currentPage() - 1) * this.pageSize;
      const end = start + this.pageSize;
      return this.filteredGrupos().slice(start, end);
   });

   totalAsignados = computed(() => this.grupos().reduce((acc, g) => acc + (g.cantidad_publicadores || 0), 0));

   // Check if current user is Admin or Gestor Aplicación
   isAdminOrGestor = computed(() => {
      const user = this.authStore.user();
      const rol = user?.rol?.toLowerCase() || '';
      return rol.includes('admin') || rol.includes('gestor');
   });

   loading = signal(false);
   saving = signal(false);
   panelOpen = signal(false);
   editingGrupo = signal<Grupo | null>(null);

   // Autocomplete for Capitán and Auxiliar
   publicadores = signal<any[]>([]);
   capitanDropdownOpen = signal(false);
   auxiliarDropdownOpen = signal(false);
   capitanSearch = signal('');
   auxiliarSearch = signal('');

   // Filtered publicadores for autocomplete
   filteredCapitanes = computed(() => {
      const query = this.capitanSearch().toLowerCase();
      if (!query) return this.publicadores().slice(0, 10);
      return this.publicadores().filter(p =>
         this.getFullName(p).toLowerCase().includes(query)
      ).slice(0, 10);
   });

   filteredAuxiliares = computed(() => {
      const query = this.auxiliarSearch().toLowerCase();
      if (!query) return this.publicadores().slice(0, 10);
      return this.publicadores().filter(p =>
         this.getFullName(p).toLowerCase().includes(query)
      ).slice(0, 10);
   });

   grupoForm: FormGroup;

   constructor() {
      this.grupoForm = this.fb.group({
         nombre_grupo: ['', [Validators.required]],
         capitan_grupo: [''],
         auxiliar_grupo: ['']
      });

      // this.searchControl.valueChanges.subscribe(() => {
      //    this.currentPage.set(1);
      // });
   }

   ngOnInit() {
      this.loadGrupos();
      this.loadSinAsignar();
   }

   loadSinAsignar() {
      const user = this.authStore.user();
      const params: any = {};

      if (user?.id_congregacion) {
         params.id_congregacion = user.id_congregacion;
      }

      this.http.get<any[]>('/api/publicadores/', { params }).subscribe({
         next: (pubs) => {
            const count = pubs.filter(p => !p.id_grupo_publicador).length;
            this.totalSinAsignar.set(count);
         },
         error: (err) => console.error('Error loading unassigned stats', err)
      });
   }

   async loadGrupos() {
      this.loading.set(true);
      try {
         const user = this.authStore.user();
         const params: any = {};

         if (user?.id_congregacion) {
            params.id_congregacion = user.id_congregacion;
         }

         const data = await lastValueFrom(this.gruposService.getGrupos(params));
         console.log('Grupos cargados:', data);
         console.log('Total asignados calculado:', data.reduce((acc, g) => acc + (g.cantidad_publicadores || 0), 0));
         this.grupos.set(data);
      } catch (err: any) {
         console.error('Error cargando grupos', err);
         // Optional: show toast or alert if needed for debugging
         // alert(err?.error?.detail || 'Error al cargar grupos');
      } finally {
         this.loading.set(false);
      }
   }

   // Helpers - Same orange style for all groups
   getAvatarClass(id: number): string {
      return 'bg-orange-50 text-brand-orange';
   }

   // Helper to get full name
   getFullName(pub: any): string {
      const parts = [
         pub.primer_nombre,
         pub.segundo_nombre,
         pub.primer_apellido,
         pub.segundo_apellido
      ].filter(Boolean);
      return parts.join(' ');
   }

   // Load publicadores for autocomplete
   loadPublicadoresForAutocomplete(idCongregacion?: number) {
      const params: any = {};
      if (idCongregacion) {
         params.id_congregacion = idCongregacion;
      }
      this.http.get<any[]>('/api/publicadores/', { params }).subscribe({
         next: (pubs) => {
            this.publicadores.set(pubs);
         },
         error: (err) => console.error('Error loading publicadores for autocomplete', err)
      });
   }

   // Autocomplete handlers
   onCapitanInput(event: Event) {
      const value = (event.target as HTMLInputElement).value;
      this.capitanSearch.set(value);
      this.capitanDropdownOpen.set(true);
   }

   onAuxiliarInput(event: Event) {
      const value = (event.target as HTMLInputElement).value;
      this.auxiliarSearch.set(value);
      this.auxiliarDropdownOpen.set(true);
   }

   selectCapitan(pub: any) {
      const fullName = this.getFullName(pub);
      this.grupoForm.patchValue({ capitan_grupo: fullName });
      this.capitanDropdownOpen.set(false);
      this.capitanSearch.set('');
   }

   selectAuxiliar(pub: any) {
      const fullName = this.getFullName(pub);
      this.grupoForm.patchValue({ auxiliar_grupo: fullName });
      this.auxiliarDropdownOpen.set(false);
      this.auxiliarSearch.set('');
   }

   closeCapitanDropdown() {
      setTimeout(() => this.capitanDropdownOpen.set(false), 200);
   }

   closeAuxiliarDropdown() {
      setTimeout(() => this.auxiliarDropdownOpen.set(false), 200);
   }

   // CRUD Actions
   openCreatePanel() {
      this.editingGrupo.set(null);
      this.grupoForm.reset();
      this.capitanSearch.set('');
      this.auxiliarSearch.set('');
      // Load publicadores for current user's congregation
      const user = this.authStore.user();
      if (user?.id_congregacion) {
         this.loadPublicadoresForAutocomplete(user.id_congregacion);
      }
      this.panelOpen.set(true);
   }

   editGrupo(grupo: Grupo) {
      this.editingGrupo.set(grupo);
      this.grupoForm.patchValue({
         nombre_grupo: grupo.nombre_grupo,
         capitan_grupo: grupo.capitan_grupo,
         auxiliar_grupo: grupo.auxiliar_grupo
      });
      this.capitanSearch.set('');
      this.auxiliarSearch.set('');
      // Load publicadores for the group's congregation
      if (grupo.id_congregacion_grupo) {
         this.loadPublicadoresForAutocomplete(grupo.id_congregacion_grupo);
      }
      this.panelOpen.set(true);
   }

   closePanel() {
      this.panelOpen.set(false);
      setTimeout(() => { // Wait for animation
         this.grupoForm.reset();
         this.editingGrupo.set(null);
      }, 300);
   }

   async save() {
      if (this.grupoForm.invalid) return;

      const user = this.authStore.user();

      // Validar si tiene congregación o es Admin/Gestor (que no tienen)
      const isAdminOrGestor = user?.rol?.toLowerCase().includes('admin') || user?.rol?.toLowerCase().includes('gestor');

      if (!user?.id_congregacion && !isAdminOrGestor) {
         alert('Error: No se ha detectado tu congregación.');
         return;
      }

      this.saving.set(true);
      const formVal = this.grupoForm.value;

      // Determinar ID congregación
      let idCongregacion = user?.id_congregacion;

      // Si soy Admin y estoy editando, mantengo la congregación del grupo original
      if (this.editingGrupo()) {
         idCongregacion = this.editingGrupo()!.id_congregacion_grupo;
      }
      // Nota: Si soy Admin y creo uno nuevo, actualmente fallará si no hay selector.
      // Pero el usuario pidió arreglar la EDICIÓN.

      const payload = {
         ...formVal,
         id_congregacion_grupo: idCongregacion
      };

      try {
         if (this.editingGrupo()) {
            const id = this.editingGrupo()!.id_grupo;
            await lastValueFrom(this.gruposService.updateGrupo(id, payload));
         } else {
            await lastValueFrom(this.gruposService.createGrupo(payload));
         }
         this.closePanel();
         this.loadGrupos();
         this.loadSinAsignar(); // Reload unassigned count after saving
      } catch (err) {
         console.error('Error guardando grupo', err);
      } finally {
         this.saving.set(false);
      }
   }

   confirmDelete(grupo: Grupo) {
      if (confirm(`¿Estás seguro de eliminar el grupo "${grupo.nombre_grupo}"?`)) {
         this.deleteGrupo(grupo.id_grupo);
      }
   }

   async deleteGrupo(id: number) {
      try {
         await lastValueFrom(this.gruposService.deleteGrupo(id));
         this.loadGrupos();
      } catch (err) {
         console.error("Error al eliminar", err);
         alert("No se pudo eliminar el grupo. Puede tener publicadores asignados.");
      }
   }

   goToDynamicAssignment() {
      this.router.navigate(['/secretario/grupos/asignacion']);
   }

   goToAssignment(grupo: Grupo) {
      this.router.navigate(['/secretario/grupos/detalle-asignacion', grupo.id_grupo]);
   }

   // Pagination Methods
   nextPage() {
      if (this.currentPage() * this.pageSize < this.filteredGrupos().length) {
         this.currentPage.update(p => p + 1);
      }
   }

   prevPage() {
      if (this.currentPage() > 1) {
         this.currentPage.update(p => p - 1);
      }
   }
}
