import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Grupo } from '../../../grupos/models/grupo.model';

@Component({
   selector: 'app-informes-filters',
   standalone: true,
   imports: [CommonModule, FormsModule],
   templateUrl: './informes-filters.component.html',
   styles: [`:host { display: block; }`]
})
export class InformesFiltersComponent {
   @Input() activeDropdown: string | null = null;
   @Input() isRestrictedUser: boolean = false;

   @Input() selectedMes: string = '';
   @Input() selectedAno: string = '';
   @Input() selectedGrupo: number | null = null;

   @Input() meses: { value: string; label: string }[] = [];
   @Input() anos: string[] = [];
   @Input() grupos: Grupo[] = [];

   @Input() vistaGrupo: boolean = false;

   @Input() searchQuery: string = '';
   @Input() soloSinInforme: boolean = false;

   @Output() toggleDropdown = new EventEmitter<string>();
   @Output() closeDropdown = new EventEmitter<void>();

   @Output() selectMes = new EventEmitter<string>();
   @Output() selectAno = new EventEmitter<string>();
   @Output() selectGrupo = new EventEmitter<number | null>();
   @Output() setVista = new EventEmitter<boolean>();

   @Output() searchQueryChange = new EventEmitter<string>();
   @Output() soloSinInformeChange = new EventEmitter<boolean>();

   getMesLabel(mesValue: string): string {
      return this.meses.find(m => m.value === mesValue)?.label || mesValue;
   }

   getGrupoLabel(grupoId: number | null): string {
      if (grupoId === null) return 'Todos los grupos';
      return this.grupos.find(g => g.id_grupo === grupoId)?.nombre_grupo || 'Grupo Desconocido';
   }

   onSearchQueryChange(value: string) {
      this.searchQuery = value;
      this.searchQueryChange.emit(value);
   }

   onSoloSinInformeChange(value: boolean) {
      this.soloSinInforme = value;
      this.soloSinInformeChange.emit(value);
   }
}
