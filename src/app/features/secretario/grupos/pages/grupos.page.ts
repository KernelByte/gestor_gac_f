import { Component, inject, OnInit, signal, computed, effect, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import { GruposService } from '../services/grupos.service';
import { Grupo } from '../models/grupo.model';
import { AuthStore } from '../../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';

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
    /* Stagger table rows on load */
    tbody tr:nth-child(1) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 0ms; }
    tbody tr:nth-child(2) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 30ms; }
    tbody tr:nth-child(3) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 60ms; }
    tbody tr:nth-child(4) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 90ms; }
    tbody tr:nth-child(5) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 120ms; }
    tbody tr:nth-child(6) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 150ms; }
    tbody tr:nth-child(7) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 180ms; }
    tbody tr:nth-child(8) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 210ms; }
    tbody tr:nth-child(9) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 240ms; }
    tbody tr:nth-child(10) { animation: rowIn 0.2s cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: 270ms; }
    @keyframes rowIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      tbody tr { animation: none !important; opacity: 1; }
    }
  `]
})
export class GruposListComponent implements OnInit {
   private gruposService = inject(GruposService);
   private authStore = inject(AuthStore);
   private congregacionContext = inject(CongregacionContextService);
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

   // Check if current user is Admin or Gestor Aplicaci?n
   isAdminOrGestor = computed(() => {
      const user = this.authStore.user();
      const rol = user?.rol?.toLowerCase() || '';
      return rol.includes('admin') || rol.includes('gestor');
   });

   // Admin/Gestor/Secretario siempre tienen acceso completo a grupos.
   // Coordinador NO está incluido aquí — su acceso se controla por permisos.
   isFullyPrivilegedForGrupos = computed(() => {
      const user = this.authStore.user();
      const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
      return this.isAdminOrGestor() || roles.includes('secretario');
   });

   // Mantener isPrivilegedRole para compatibilidad con otras partes del template
   isPrivilegedRole = computed(() => {
      const user = this.authStore.user();
      const roles = (user?.roles ?? (user?.rol ? [user.rol] : [])).map(r => (r || '').toLowerCase());
      return this.isAdminOrGestor() ||
             roles.includes('secretario') ||
             roles.includes('coordinador');
   });

   canCreateGrupos = computed(() => this.isFullyPrivilegedForGrupos());

   canEditGrupos = computed(() =>
      this.isFullyPrivilegedForGrupos() || this.authStore.hasPermission('grupos.editar')
   );

   isScopedToGroup = computed(() =>
      !this.isFullyPrivilegedForGrupos() && !this.authStore.hasPermission('grupos.ver_todos')
   );

   loading = signal(false);
   saving = signal(false);
   exporting = signal(false);
   panelOpen = signal(false);
   editingGrupo = signal<Grupo | null>(null);

   showExportMenu = signal(false);
   exportFormat = signal<'pdf' | 'excel'>('pdf');

   @ViewChild('exportWrapper') exportWrapperRef?: ElementRef<HTMLElement>;

   @HostListener('document:click', ['$event'])
   onDocumentClick(event: MouseEvent) {
      if (!this.showExportMenu()) return;
      const el = this.exportWrapperRef?.nativeElement;
      if (el?.contains(event.target as Node)) return;
      this.closeExportMenu();
   }

   toggleExportMenu() {
      this.showExportMenu.update(v => !v);
   }

   closeExportMenu() {
      this.showExportMenu.set(false);
   }

   async confirmExport(type: 'all' | 'active') {
      this.showExportMenu.set(false);

      // Para el admin: si no hay congregaci?n seleccionada no podemos generar el reporte
      const idCongregacion = this.congregacionContext.effectiveCongregacionId();
      if (this.congregacionContext.isAdmin() && !idCongregacion) {
         alert('Selecciona una congregaci?n en el encabezado para exportar el reporte.');
         return;
      }

      const format = this.exportFormat();
      const params: any = {};
      if (type === 'active') {
         params.solo_activos = true;
      }
      if (idCongregacion) {
         params.id_congregacion = idCongregacion;
      }
      if (this.isScopedToGroup()) {
         const idGrupo = this.authStore.user()?.id_grupo_publicador;
         if (idGrupo != null) {
            params.id_grupo = idGrupo;
         }
      }

      const endpoint = format === 'pdf' ? '/api/grupos/exportar-pdf' : '/api/grupos/exportar-excel';
      const defaultFilename = format === 'pdf' ? 'Reporte_Grupos.pdf' : 'Reporte_Grupos.xlsx';

      this.exporting.set(true);
      try {
         const response = await lastValueFrom(
            this.http.get(endpoint, {
               params,
               responseType: 'blob',
               observe: 'response'
            })
         );

         const blob = response.body;
         if (!blob) throw new Error('No se recibi? archivo');

         const url = window.URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;

         const contentDisposition = response.headers.get('content-disposition');
         let filename = defaultFilename;
         if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
            if (filenameMatch && filenameMatch.length > 1) {
               filename = filenameMatch[1];
            }
         }
         a.download = filename;

         document.body.appendChild(a);
         a.click();
         window.URL.revokeObjectURL(url);
         document.body.removeChild(a);

      } catch (err) {
         console.error(`Error exportando ${format.toUpperCase()}`, err);
         alert(format === 'pdf' ? 'Error al generar el reporte PDF.' : 'Error al generar el reporte Excel.');
      } finally {
         this.exporting.set(false);
      }
   }

   // Autocomplete for Capit?n and Auxiliar
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

      // Recargar datos autom?ticamente cuando el admin cambia de congregaci?n en el header
      effect(() => {
         this.congregacionContext.effectiveCongregacionId();
         this.loadGrupos();
         this.loadSinAsignar();
      });
   }

   ngOnInit() {
      // La carga inicial ya la dispara el effect() del constructor
   }

   loadSinAsignar() {
      const params: any = { limit: 1000 };
      const idCongregacion = this.congregacionContext.effectiveCongregacionId();
      if (idCongregacion) {
         params.id_congregacion = idCongregacion;
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
         const params: any = {};
         const idCongregacion = this.congregacionContext.effectiveCongregacionId();
         if (idCongregacion) {
            params.id_congregacion = idCongregacion;
         }
         params.limit = 1000;

         let data = await lastValueFrom(this.gruposService.getGrupos(params));
         console.log('Grupos cargados:', data);
         console.log('Total asignados calculado:', data.reduce((acc, g) => acc + (g.cantidad_publicadores || 0), 0));
         if (this.isScopedToGroup()) {
            const idGrupo = this.authStore.user()?.id_grupo_publicador;
            data = idGrupo != null ? data.filter(g => g.id_grupo === idGrupo) : [];
         }
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
      const params: any = { limit: 1000 };
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
      const idCongregacion = this.congregacionContext.effectiveCongregacionId();
      if (idCongregacion) {
         this.loadPublicadoresForAutocomplete(idCongregacion);
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
      // ID de congregaci?n efectivo (respeta la selecci?n del admin en el header)
      const effectiveId = this.congregacionContext.effectiveCongregacionId() ?? user?.id_congregacion;

      const isAdminOrGestor = user?.rol?.toLowerCase().includes('admin') || user?.rol?.toLowerCase().includes('gestor');

      if (!effectiveId && !isAdminOrGestor) {
         alert('Error: No se ha detectado tu congregaci?n.');
         return;
      }

      this.saving.set(true);
      const formVal = this.grupoForm.value;

      // Si estoy editando, conservo la congregaci?n original del grupo
      let idCongregacion = this.editingGrupo()
         ? this.editingGrupo()!.id_congregacion_grupo
         : effectiveId;

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
      if (confirm(`?Est?s seguro de eliminar el grupo "${grupo.nombre_grupo}"?`)) {
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
