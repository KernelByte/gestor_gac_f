import { Component, Input, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
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
   
   @Output() close = new EventEmitter<boolean>();
   
   informesService = inject(InformesService);
   
   // All available periods from DB
   allPeriodos = signal<{ ano: number; mes: number }[]>([]);
   loadingPeriodos = signal<boolean>(true);

   // Static month names lookup
   mesesNombres: { [key: number]: string } = {
      1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
      5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
      9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre'
   };

   // Computed: distinct available years
   availableAnos = computed(() => {
      const periodos = this.allPeriodos();
      const years = [...new Set(periodos.map(p => p.ano))];
      return years.sort((a, b) => b - a);
   });

   // Computed: available months for currently selected year
   availableMeses = computed(() => {
      const periodos = this.allPeriodos();
      const ano = this.selectedAno();
      const months = periodos
         .filter(p => p.ano === ano)
         .map(p => p.mes)
         .sort((a, b) => a - b);
      return [...new Set(months)].map(m => ({ num: m, name: this.mesesNombres[m] || `Mes ${m}` }));
   });

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

   // Validation: horas > 0 requires a precursor type
   horasRequierePrecursor = computed(() => {
      return this.horas() > 0 && !this.esAuxiliar() && !this.esRegular() && !this.esEspecial();
   });

   /** Horas extra extraídas de la observación (patrón "N Hrs") */
   hrsFromObservacion = computed(() => {
      const obs = this.observaciones();
      if (!obs) return null;
      const match = obs.match(/(\d+)\s*Hrs/i);
      return match ? parseInt(match[1], 10) : null;
   });

   /** Total horas + horas de la observación */
   totalHorasConCreditos = computed(() => {
      const extra = this.hrsFromObservacion();
      if (extra === null) return null;
      return (this.horas() || 0) + extra;
   });

   showValidationError = signal<boolean>(false);

   // Local cache for unsaved changes: key is "YYYY-MM"
   pendingChanges = new Map<string, InformeHistorialEdit>();
   originalValues = new Map<string, InformeHistorialDetalle>();
   
   ngOnInit() {
      if (this.initialAno) this.selectedAno.set(this.initialAno);
      if (this.initialMes) this.selectedMes.set(this.initialMes);
      
      this.loadPeriodosDisponibles();
   }

   private loadPeriodosDisponibles() {
      this.loadingPeriodos.set(true);
      this.informesService.getPeriodosDisponibles().subscribe({
         next: (data) => {
            this.allPeriodos.set(data.periodos);
            this.loadingPeriodos.set(false);

            // Validate that the initial selection exists; if not, pick the first available
            const periodos = data.periodos;
            const currentValid = periodos.some(p => p.ano === this.selectedAno() && p.mes === this.selectedMes());
            if (!currentValid && periodos.length > 0) {
               this.selectedAno.set(periodos[0].ano);
               const mesInYear = periodos.find(p => p.ano === periodos[0].ano);
               if (mesInYear) this.selectedMes.set(mesInYear.mes);
            }

            this.loadDetails();
         },
         error: (err) => {
            console.error('Error loading periodos disponibles', err);
            this.loadingPeriodos.set(false);
         }
      });
   }
   
   onAnoSelect(ano: number) {
      if (this.selectedAno() === ano || this.loading() || this.saving()) return;
      if (this.horasRequierePrecursor()) {
         this.showValidationError.set(true);
         return;
      }
      this.showValidationError.set(false);
      this.saveCurrentToPending();
      this.selectedAno.set(ano);

      // Auto-select first available month in new year
      const mesesInYear = this.availableMeses();
      if (mesesInYear.length > 0) {
         this.selectedMes.set(mesesInYear[0].num);
      }

      this.loadDetails();
   }
   
   onMesSelect(mes: number) {
      if (this.selectedMes() === mes || this.loading() || this.saving()) return;
      if (this.horasRequierePrecursor()) {
         this.showValidationError.set(true);
         return;
      }
      this.showValidationError.set(false);
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

      // Only store if actually different from original
      const orig = this.originalValues.get(key);
      if (orig) {
         const changed =
            data.participo !== orig.participo ||
            (data.horas || 0) !== (orig.horas || 0) ||
            (data.cursos_biblicos || 0) !== (orig.cursos_biblicos || 0) ||
            (data.observaciones || null) !== (orig.observaciones || null) ||
            data.privilegio !== orig.privilegio;

         if (changed) {
            this.pendingChanges.set(key, data);
         } else {
            this.pendingChanges.delete(key);
         }
      } else {
         // No original loaded yet — only save if it looks like real data
         if (data.participo || data.horas || data.cursos_biblicos || data.observaciones || data.privilegio) {
            this.pendingChanges.set(key, data);
         }
      }
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
      
      // Force UI refresh by explicitly triggering change detection on the form state if needed, but signals handle this.
      // The issue is likely that if priv is somehow undefined instead of null, it might evaluate differently, but strict equality covers both.
   }
   
   onHorasChange(valor: number | null) {
      const h = valor || 0;
      this.horas.set(h);
      
      if (h > 0) {
         this.participo.set(true);
      } else if (h === 0) {
         this.participo.set(false);
      }
   }

   togglePrivilegio(tipo: 'Auxiliar' | 'Regular' | 'Especial') {
      if (tipo === 'Auxiliar') {
         this.esAuxiliar.set(!this.esAuxiliar());
         if (this.esAuxiliar()) {
             this.esRegular.set(false);
             this.esEspecial.set(false);
             this.showValidationError.set(false);
         }
      } else if (tipo === 'Regular') {
         this.esRegular.set(!this.esRegular());
         if (this.esRegular()) {
             this.esAuxiliar.set(false);
             this.esEspecial.set(false);
             this.showValidationError.set(false);
         }
      } else if (tipo === 'Especial') {
         this.esEspecial.set(!this.esEspecial());
         if (this.esEspecial()) {
             this.esAuxiliar.set(false);
             this.esRegular.set(false);
             this.showValidationError.set(false);
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
      const mesNombre = this.mesesNombres[this.selectedMes()] || '';
      return `${mesNombre} ${this.selectedAno()}`;
   }

   hasChanges(ano: number, mes: number): boolean {
      const key = `${ano}-${mes}`;
      const val = this.pendingChanges.get(key);
      if (!val) return false;

      const orig = this.originalValues.get(key);
      if (!orig) return true;

      return val.participo !== orig.participo ||
             (val.horas || 0) !== (orig.horas || 0) ||
             (val.cursos_biblicos || 0) !== (orig.cursos_biblicos || 0) ||
             val.observaciones !== orig.observaciones ||
             val.privilegio !== orig.privilegio;
   }

   hasChangesInYear(ano: number): boolean {
      const mesesInYear = this.allPeriodos().filter(p => p.ano === ano).map(p => p.mes);
      return mesesInYear.some(m => this.hasChanges(ano, m));
   }
   
   guardar() {
      if (this.saving() || this.loading()) return;
      if (this.horasRequierePrecursor()) {
         this.showValidationError.set(true);
         return;
      }
      this.showValidationError.set(false);
      this.saving.set(true);
      
      this.saveCurrentToPending();

      const updates: InformeHistorialEdit[] = [];
      this.pendingChanges.forEach((val, key) => {
         const orig = this.originalValues.get(key);
         
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
