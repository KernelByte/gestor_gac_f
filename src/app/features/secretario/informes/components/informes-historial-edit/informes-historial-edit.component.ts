import { Component, Input, Output, EventEmitter, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InformesService } from '../../services/informes.service';
import { InformeHistorialDetalle, InformeHistorialEdit } from '../../models/informe.model';
import { forkJoin, of } from 'rxjs';

@Component({
   selector: 'app-informes-historial-edit',
   standalone: true,
   imports: [CommonModule, FormsModule],
   templateUrl: './informes-historial-edit.component.html',
})
export class InformesHistorialEditComponent implements OnInit {
   @Input() publicadorId!: number;
   @Input() publicadorNombre: string = '';
   @Input() initialAno!: number;
   @Input() initialMes!: number;
   
   @Output() close = new EventEmitter<boolean>(); // Emitimos `true` si se guardó, `false` si se canceló
   
   informesService = inject(InformesService);
   
   anos = Array.from({length: 10}, (_, i) => new Date().getFullYear() - i + 1);
   meses = [
      { num: 1, name: 'Enero' }, { num: 2, name: 'Febrero' }, { num: 3, name: 'Marzo' },
      { num: 4, name: 'Abril' }, { num: 5, name: 'Mayo' }, { num: 6, name: 'Junio' },
      { num: 7, name: 'Julio' }, { num: 8, name: 'Agosto' }, { num: 9, name: 'Septiembre' },
      { num: 10, name: 'Octubre' }, { num: 11, name: 'Noviembre' }, { num: 12, name: 'Diciembre' }
   ];

   selectedAno = signal<number>(new Date().getFullYear());
   selectedMes = signal<number>(1);
   
   loading = signal<boolean>(false);
   saving = signal<boolean>(false);
   
   // Form state
   participo = signal<boolean>(false);
   horas = signal<number>(0);
   cursosBiblicos = signal<number>(0);
   observaciones = signal<string>('');
   
   // Privileges
   esAuxiliar = signal<boolean>(false);
   esRegular = signal<boolean>(false);
   esEspecial = signal<boolean>(false);

   // Local cache for unsaved changes: key is "YYYY-MM"
   pendingChanges = new Map<string, InformeHistorialEdit>();
   originalValues = new Map<string, InformeHistorialDetalle>();
   
   ngOnInit() {
      if (this.initialAno) this.selectedAno.set(this.initialAno);
      if (this.initialMes) this.selectedMes.set(this.initialMes);
      
      this.loadDetails();
   }
   
   onAnoSelect(ano: number) {
      if (this.selectedAno() === ano || this.loading() || this.saving()) return;
      this.saveCurrentToPending();
      this.selectedAno.set(ano);
      this.loadDetails();
   }
   
   onMesSelect(mes: number) {
      if (this.selectedMes() === mes || this.loading() || this.saving()) return;
      this.saveCurrentToPending();
      this.selectedMes.set(mes);
      this.loadDetails();
   }

   private saveCurrentToPending() {
      const key = `${this.selectedAno()}-${this.selectedMes()}`;
      const data: InformeHistorialEdit = {
         id_publicador: this.publicadorId,
         ano: this.selectedAno(),
         mes: this.selectedMes(),
         participo: this.participo(),
         horas: this.horas(),
         cursos_biblicos: this.cursosBiblicos(),
         observaciones: this.observaciones() || null,
         privilegio: this.activoPrivilegio
      };
      this.pendingChanges.set(key, data);
   }
   
   loadDetails() {
      if (!this.publicadorId) return;
      
      const key = `${this.selectedAno()}-${this.selectedMes()}`;
      
      // If we already have pending changes for this month, use them
      if (this.pendingChanges.has(key)) {
         const data = this.pendingChanges.get(key)!;
         this.applyDataToForm(data);
         return;
      }

      this.loading.set(true);
      this.informesService.getDetalleHistorial(this.publicadorId, this.selectedAno(), this.selectedMes()).subscribe({
         next: (data: InformeHistorialDetalle) => {
            this.originalValues.set(key, data);
            this.applyDataToForm(data);
            this.loading.set(false);
         },
         error: (err) => {
             console.error('Error fetching historial detalle', err);
             this.loading.set(false);
         }
      });
   }

   private applyDataToForm(data: InformeHistorialDetalle | InformeHistorialEdit) {
      this.participo.set(data.participo);
      this.horas.set(data.horas || 0);
      this.cursosBiblicos.set(data.cursos_biblicos || 0);
      this.observaciones.set(data.observaciones || '');
      
      const priv = data.privilegio;
      this.esAuxiliar.set(priv === 'Precursor Auxiliar');
      this.esRegular.set(priv === 'Precursor Regular');
      this.esEspecial.set(priv === 'Precursor Especial');
   }
   
   togglePrivilegio(tipo: 'Auxiliar' | 'Regular' | 'Especial') {
      if (tipo === 'Auxiliar') {
         this.esAuxiliar.set(!this.esAuxiliar());
         if (this.esAuxiliar()) {
             this.esRegular.set(false);
             this.esEspecial.set(false);
         }
      } else if (tipo === 'Regular') {
         this.esRegular.set(!this.esRegular());
         if (this.esRegular()) {
             this.esAuxiliar.set(false);
             this.esEspecial.set(false);
         }
      } else if (tipo === 'Especial') {
         this.esEspecial.set(!this.esEspecial());
         if (this.esEspecial()) {
             this.esAuxiliar.set(false);
             this.esRegular.set(false);
         }
      }
   }
   
   get activoPrivilegio(): string | null {
      if (this.esEspecial()) return 'Precursor Especial';
      if (this.esRegular()) return 'Precursor Regular';
      if (this.esAuxiliar()) return 'Precursor Auxiliar';
      return null;
   }
   
   get titleText(): string {
      const mesNombre = this.meses.find(m => m.num === this.selectedMes())?.name || '';
      return `${mesNombre} ${this.selectedAno()}`;
   }

   hasChanges(ano: number, mes: number): boolean {
      const key = `${ano}-${mes}`;
      const val = this.pendingChanges.get(key);
      if (!val) return false;

      const orig = this.originalValues.get(key);
      if (!orig) return true; // If we don't have original, assume it's new/modified

      return val.participo !== orig.participo ||
             (val.horas || 0) !== (orig.horas || 0) ||
             (val.cursos_biblicos || 0) !== (orig.cursos_biblicos || 0) ||
             val.observaciones !== orig.observaciones ||
             val.privilegio !== orig.privilegio;
   }

   hasChangesInYear(ano: number): boolean {
      return this.meses.some(m => this.hasChanges(ano, m.num));
   }
   
   guardar() {
      if (this.saving() || this.loading()) return;
      
      this.saving.set(true);
      
      // 1. Ensure current form is in pending changes
      this.saveCurrentToPending();

      // 2. Identify which ones actually changed compared to original
      const updates: InformeHistorialEdit[] = [];
      this.pendingChanges.forEach((val, key) => {
         const orig = this.originalValues.get(key);
         
         // Simple check: if not in originalValues, it might be new. 
         // If it is, compare values.
         if (!orig) {
            updates.push(val);
         } else {
            const hasChanged = 
               val.participo !== orig.participo ||
               (val.horas || 0) !== (orig.horas || 0) ||
               (val.cursos_biblicos || 0) !== (orig.cursos_biblicos || 0) ||
               val.observaciones !== orig.observaciones ||
               val.privilegio !== orig.privilegio;
               
            if (hasChanged) {
               updates.push(val);
            }
         }
      });

      if (updates.length === 0) {
         this.saving.set(false);
         this.close.emit(false);
         return;
      }

      // 3. Send all updates
      const requests = updates.map(u => this.informesService.editarHistorial(u));
      
      forkJoin(requests).subscribe({
         next: () => {
            this.saving.set(false);
            this.close.emit(true);
         },
         error: (err) => {
            console.error('Error saving all historial updates', err);
            this.saving.set(false);
         }
      });
   }
   
   cancelar() {
      this.close.emit(false);
   }
}
