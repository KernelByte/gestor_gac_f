import { Component, Input, OnChanges, SimpleChanges, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InformesService } from '../../services/informes.service';
import { HistorialAnualOut } from '../../models/informe.model';
import { Grupo } from '../../../grupos/models/grupo.model';

@Component({
   selector: 'app-informes-historial',
   standalone: true,
   imports: [CommonModule, FormsModule],
   templateUrl: './informes-historial.component.html',
   styles: [`
    :host {
      display: block;
      height: 100%;
    }
  `]
})
export class InformesHistorialComponent implements OnChanges {
   private informesService = inject(InformesService);

   @Input() selectedAno: number = new Date().getFullYear();
   @Input() congregacionId: number = 0;
   @Input() grupos: Grupo[] = [];

   get sortedGrupos(): Grupo[] {
      return [...this.grupos].sort((a, b) => a.id_grupo - b.id_grupo);
   }

   // State
   historial = signal<HistorialAnualOut | null>(null);
   loading = signal<boolean>(false);
   selectedPublicadorId = signal<number | null>(null);

   // Filters
   filterGrupoId = signal<number | null>(null);
   searchQuery = signal<string>('');
   viewType = signal<'ano_servicio' | 'ultimos_12' | 'ultimos_6'>('ano_servicio');

   // UI Filter State
   activeFilter = signal<'all' | 'precursores' | number>('all');

   // Computed
   filteredPublicadores = computed(() => {
      const data = this.historial();
      if (!data) return [];

      let pubs = data.publicadores;

      // Filter by "Precursores Only" mode
      if (this.activeFilter() === 'precursores') {
         pubs = pubs.filter(p => p.es_precursor_regular);
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

   constructor() {
      // Effect to auto-select first publisher when data loads if none selected
      effect(() => {
         const pubs = this.filteredPublicadores();
         if (pubs.length > 0 && !this.selectedPublicadorId()) {
            this.selectedPublicadorId.set(pubs[0].id_publicador);
         }
      }, { allowSignalWrites: true });
   }

   ngOnChanges(changes: SimpleChanges): void {
      if (changes['selectedAno'] || changes['congregacionId']) {
         this.loadData();
      }
   }

   setFilter(filter: 'all' | 'precursores' | number) {
      this.activeFilter.set(filter);

      // If filtering by specific group, set ID for backend. Otherwise null (fetch all).
      const groupId = typeof filter === 'number' ? filter : null;
      this.filterGrupoId.set(groupId);

      this.loadData();
   }

   onViewTypeChange(type: 'ano_servicio' | 'ultimos_12' | 'ultimos_6') {
      this.viewType.set(type);
      this.loadData();
   }

   loadData() {
      if (!this.congregacionId) return;

      this.loading.set(true);
      this.informesService.getHistorialAnual(
         this.congregacionId,
         this.selectedAno,
         this.filterGrupoId() || undefined,
         this.viewType()
      ).subscribe({
         // I need to update the service method in frontend to match the new backend endpoint.
         next: (data) => {
            this.historial.set(data);
            this.loading.set(false);
            // Reset selection if current selection is not in new list
            /* Logic handled by effect or manual check */
            this.selectedPublicadorId.set(null);
         },
         error: (err) => {
            console.error('Error loading history', err);
            this.loading.set(false);
         }
      });
   }

   selectPublicador(id: number) {
      this.selectedPublicadorId.set(id);
   }

   // --- Export Logic ---
   exporting = signal(false);

   // --- Groups Dropdown Logic ---
   showGroupsDropdown = signal(false);

   toggleGroupsDropdown() {
      this.showGroupsDropdown.update(v => !v);
   }

   selectGroupFilter(groupId: number) {
      this.setFilter(groupId);
      this.showGroupsDropdown.set(false);
   }

   isGroupFilterActive(): boolean {
      return typeof this.activeFilter() === 'number';
   }

   getActiveGroupLabel(): string {
      const filter = this.activeFilter();
      if (typeof filter === 'number') {
         return `Grupo ${filter}`;
      }
      return 'Grupos';
   }

   // Dynamic Label for Global Export
   globalExportLabel = computed(() => {
      const filter = this.activeFilter();
      if (filter === 'all') return 'Exportar Todos';
      if (filter === 'precursores') return 'Exportar Precursores';
      if (typeof filter === 'number') return `Exportar Grupo ${filter}`;
      return 'Exportar Lista';
   });

   onExport(scope: 'global' | 'single') {
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
            const filename = scope === 'single'
               ? `Historial_${this.selectedPublicador()?.nombre_completo || 'Publicador'}.pdf`
               : `Historial_General_${this.selectedAno}.pdf`;
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
}
