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

   // State
   historial = signal<HistorialAnualOut | null>(null);
   loading = signal<boolean>(false);
   selectedPublicadorId = signal<number | null>(null);

   // Filters
   filterGrupoId = signal<number | null>(null);
   searchQuery = signal<string>('');
   viewType = signal<'ano_servicio' | 'ultimos_12' | 'ultimos_6'>('ano_servicio');

   // Computed
   filteredPublicadores = computed(() => {
      const data = this.historial();
      if (!data) return [];

      let pubs = data.publicadores;

      // Filter by Group (logic might need adjustment if backend doesn't return group_id in PublicadorHistorial yet, 
      // but assuming backend filters or we filter here if we had group info)
      // Note: Backend endpoint accepts group_id, so usually best to reload data on group change.
      // However, for search/client-side filtering:

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

   onGrupoChange(grupoId: number | null) {
      this.filterGrupoId.set(grupoId);
      // Reload from backend to filter by group efficiently
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
}
