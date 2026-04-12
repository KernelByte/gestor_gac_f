import { Component, Input, OnChanges, SimpleChanges, inject, signal, computed, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InformesService } from '../../services/informes.service';
import { HistorialAnualOut, InformeHistorialItem } from '../../models/informe.model';
import { Grupo } from '../../../grupos/models/grupo.model';
import { getInitialAvatarStyle } from '../../../../../core/utils/avatar-style.util';
import { InformesHistorialEditComponent } from '../informes-historial-edit/informes-historial-edit.component';

@Component({
   selector: 'app-informes-historial',
   standalone: true,
   imports: [CommonModule, FormsModule, InformesHistorialEditComponent],
   templateUrl: './informes-historial.component.html',
   styles: [`
    :host {
      display: block;
      height: 100%;
    }
    @keyframes progress-fast {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
    .animate-progress-fast {
      animation: progress-fast 0.8s infinite linear;
    }
  `]
})
export class InformesHistorialComponent implements OnChanges {
   private informesService = inject(InformesService);
   @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

   @Input() selectedAno: number = new Date().getFullYear();
   @Input() congregacionId: number = 0;
   @Input() grupos: Grupo[] = [];
   @Input() canEdit: boolean = false;
   @Input() canExport: boolean = false;
   @Input() lockedGroupId: number | null = null;

   get sortedGrupos(): Grupo[] {
      return [...this.grupos].sort((a, b) => 
         a.nombre_grupo.localeCompare(b.nombre_grupo, undefined, { numeric: true, sensitivity: 'base' })
      );
   }

   // State
   historial = signal<HistorialAnualOut | null>(null);
   loading = signal<boolean>(false);
   selectedPublicadorId = signal<number | null>(null);
   showMobileList = signal<boolean>(true);

   // Filters
   filterGrupoId = signal<number | null>(null);
   searchQuery = signal<string>('');
   viewType = signal<'ano_servicio' | 'ultimos_12' | 'maximos_meses'>('ano_servicio');

   // UI Filter State
   activeFilter = signal<'all' | 'precursores' | number>('all');

   // Computed
   filteredPublicadores = computed(() => {
      const data = this.historial();
      if (!data) return [];

      let pubs = data.publicadores;
      const currentFilter = this.activeFilter();

      // Filter by Mode (Precursores or Group)
      if (currentFilter === 'precursores') {
         pubs = pubs.filter(p => p.es_precursor_regular);
      } else if (typeof currentFilter === 'number') {
         pubs = pubs.filter(p => p.id_grupo === currentFilter);
      }

      // Filter by Search
      if (this.searchQuery()) {
         const q = this.searchQuery().toLowerCase();
         pubs = pubs.filter(p => p.nombre_completo.toLowerCase().includes(q));
      }

      return pubs;
   });

   selectedPublicador = computed(() => {
      const pid = this.selectedPublicadorId();
      if (!pid) return null;
      return this.historial()?.publicadores.find(p => p.id_publicador === pid) || null;
   });

   /** Total de horas extra acumuladas de todas las observaciones con "N Hrs" del publicador */
   totalHrsCreditos = computed(() => {
      const pub = this.selectedPublicador();
      if (!pub?.informes?.length) return 0;
      return pub.informes.reduce((sum, inf) => {
         const match = inf.observaciones?.match(/(\d+)\s*Hrs/i);
         return sum + (match ? parseInt(match[1], 10) : 0);
      }, 0);
   });

   // Group informes by year for visual separation
   groupedInformesByYear = computed(() => {
      const pub = this.selectedPublicador();
      if (!pub || !pub.informes?.length) return [];

      const groups: { ano: number; meses: InformeHistorialItem[] }[] = [];
      let currentGroup: { ano: number; meses: InformeHistorialItem[] } | null = null;

      for (const informe of pub.informes) {
         if (!currentGroup || currentGroup.ano !== informe.ano) {
            currentGroup = { ano: informe.ano, meses: [] };
            groups.push(currentGroup);
         }
         currentGroup.meses.push(informe);
      }

      return groups;
   });

   constructor() {
      // Auto-select first publisher only when no publisher is selected AND data loads for the first time.
      // We do NOT want this to override existing selections when the view type changes.
      effect(() => {
         const pubs = this.filteredPublicadores();
         const currentId = this.selectedPublicadorId();
         
         if (pubs.length === 0) return;

         // If no selection yet, picks first
         if (!currentId) {
            this.selectedPublicadorId.set(pubs[0].id_publicador);
            return;
         }

         // If current selection is still present, leave it alone
         const stillPresent = pubs.some(p => p.id_publicador === currentId);
         if (!stillPresent) {
            // Only jump to first if previous selection truly no longer exists
            this.selectedPublicadorId.set(pubs[0].id_publicador);
         }
      }, { allowSignalWrites: true });
   }

   ngOnChanges(changes: SimpleChanges): void {
      if (changes['selectedAno'] || changes['congregacionId']) {
         this.loadData();
      }
      if (changes['lockedGroupId']) {
         if (this.lockedGroupId) {
            this.setFilter(this.lockedGroupId);
         }
      }
   }

   setFilter(filter: 'all' | 'precursores' | number) {
      if (this.lockedGroupId && typeof filter === 'number' && filter !== this.lockedGroupId) {
         return;
      }
      this.activeFilter.set(filter);

      // If filtering by specific group, set ID for backend. Otherwise null (fetch all).
      const groupId = this.lockedGroupId ?? (typeof filter === 'number' ? filter : null);
      this.filterGrupoId.set(groupId);

      this.loadData();
   }

   onViewTypeChange(type: 'ano_servicio' | 'ultimos_12' | 'maximos_meses') {
      this.viewType.set(type);
      this.loadData();
   }

   loadData() {
      if (!this.congregacionId) return;

      this.loading.set(true);

      // Guardar la posición actual del scroll
      const scrollPosition = this.scrollContainer?.nativeElement.scrollTop || 0;

      this.informesService.getHistorialAnual(
         this.congregacionId,
         this.selectedAno,
         this.filterGrupoId() || undefined,
         this.viewType()
      ).subscribe({
         next: (data) => {
            this.historial.set(data);
            this.loading.set(false);

            // Restaurar la posición del scroll después de que Angular actualice la vista
            setTimeout(() => {
               requestAnimationFrame(() => {
                  if (this.scrollContainer) {
                     this.scrollContainer.nativeElement.scrollTop = scrollPosition;
                  }
               });
            }, 10);
            
            // Retain selection across reloads:
            // - If the selected publicador still exists in the new data, keep it selected.
            // - Only clear selection if they no longer exist in the updated list.
            const currentSelected = this.selectedPublicadorId();
            if (currentSelected) {
               const exists = data.publicadores.some(p => p.id_publicador === currentSelected);
               if (!exists) {
                  // Publisher no longer in list (e.g. filtered out), clear selection so effect picks first.
                  this.selectedPublicadorId.set(null);
               }
               // Otherwise: preserve exact same selection — do NOT reset to null.
            }
         },
         error: (err) => {
            console.error('Error loading history', err);
            this.loading.set(false);
         }
      });
   }

   selectPublicador(id: number) {
      this.selectedPublicadorId.set(id);
      this.showMobileList.set(false);
   }

   volverLista() {
      this.showMobileList.set(true);
   }

   trackByPubId(index: number, pub: any): number {
      return pub.id_publicador;
   }

   // --- Edit Modal State ---
   showEditModal = signal<boolean>(false);
   editPublicadorId = signal<number>(0);
   editPublicadorNombre = signal<string>('');
   editInitialAno = signal<number>(new Date().getFullYear());
   editInitialMes = signal<number>(new Date().getMonth()); // Default to previous month

   abrirEditorHistorial(pubId: number, pubNombre: string) {
      if (!this.canEdit) return;
      
      const today = new Date();
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      
      this.editPublicadorId.set(pubId);
      this.editPublicadorNombre.set(pubNombre);
      this.editInitialAno.set(lastMonth.getFullYear());
      this.editInitialMes.set(lastMonth.getMonth() + 1); 
      this.showEditModal.set(true);
   }

   onEditorClosed(saved: boolean) {
      this.showEditModal.set(false);
      if (saved) {
         this.loadData();
      }
   }

   getAvatarStyle(nombre: string): string {
      return getInitialAvatarStyle(nombre || '');
   }

   // --- Export Logic ---
   exporting = signal(false);

   // --- Groups Dropdown Logic ---
   showGroupsDropdown = signal(false);

   toggleGroupsDropdown() {
      if (this.lockedGroupId) return;
      this.showGroupsDropdown.update(v => !v);
   }

   selectGroupFilter(groupId: number) {
      if (this.lockedGroupId) return;
      this.setFilter(groupId);
      this.showGroupsDropdown.set(false);
   }

   isGroupFilterActive(): boolean {
      return typeof this.activeFilter() === 'number';
   }

   getActiveGroupLabel(): string {
      if (this.lockedGroupId) {
         const g = this.grupos.find(x => x.id_grupo === this.lockedGroupId);
         return g ? g.nombre_grupo : `Grupo ${this.lockedGroupId}`;
      }
      const filter = this.activeFilter();
      if (typeof filter === 'number') {
         const g = this.grupos.find(x => x.id_grupo === filter);
         return g ? g.nombre_grupo : `Grupo ${filter}`;
      }
      return 'Grupos';
   }

   // Dynamic Label for Global Export
   globalExportLabel = computed(() => {
      const filter = this.activeFilter();
      if (filter === 'all') return 'Exportar Todos';
      if (filter === 'precursores') return 'Exportar Precursores';
      if (typeof filter === 'number') {
         const g = this.grupos.find(x => x.id_grupo === filter);
         return `Exportar ${g ? g.nombre_grupo : `Grupo ${filter}`}`;
      }
      return 'Exportar Lista';
   });

   onExport(scope: 'global' | 'single') {
      if (!this.canExport) return;
      if (this.exporting()) return;
      if (scope === 'single' && !this.selectedPublicadorId()) return;

      this.exporting.set(true);

      const filters: any = {};

      if (scope === 'single') {
         filters.publicadorId = this.selectedPublicadorId();
      } else {
         // Global scope - respect active filters
         const filter = this.activeFilter();
         if (filter === 'precursores') {
            filters.soloPrecursores = true;
         } else if (typeof filter === 'number') {
            filters.grupoId = filter;
         }
      }

      this.informesService.exportHistorialPdf(
         this.congregacionId,
         this.selectedAno,
         this.viewType(),
         filters
      ).subscribe({
         next: (blob) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            let filename = `Historial_${this.selectedAno}.pdf`;
            if (scope === 'single') {
               filename = `Historial_${this.selectedPublicador()?.nombre_completo || 'Publicador'}.pdf`;
            } else {
               const filter = this.activeFilter();
               if (filter === 'all') filename = `Historial_Todos_${this.selectedAno}.pdf`;
               else if (filter === 'precursores') filename = `Historial_Precursores_${this.selectedAno}.pdf`;
               else if (typeof filter === 'number') filename = `Historial_Grupo_${filter}_${this.selectedAno}.pdf`;
            }
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
            this.exporting.set(false);
         },
         error: (err) => {
            console.error('Error exporting PDF', err);
            this.exporting.set(false);
         }
      });
   }

   getShortPrivilegeLabel(priv: string | null | undefined): string {
      if (!priv) return '';
      return priv.replace('Precursor ', '');
   }

   /** Extrae el número de horas del texto de observación si contiene patrón "N Hrs" */
   getHrsFromObservacion(obs: string | null | undefined): number | null {
      if (!obs) return null;
      const match = obs.match(/(\d+)\s*Hrs/i);
      return match ? parseInt(match[1], 10) : null;
   }
}
