import { Component, Input, Output, EventEmitter, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InformesService } from '../../services/informes.service';
import { InformeHistorialDetalle, InformeHistorialEdit } from '../../models/informe.model';
import { PrivilegiosService } from '../../../privilegios/infrastructure/privilegios.service';
import { PublicadorPrivilegio } from '../../../privilegios/domain/models/publicador-privilegio';
import { Privilegio } from '../../../privilegios/domain/models/privilegio';
import { DatePickerComponent } from '../../../../../shared/components/date-picker/date-picker.component';
import { forkJoin, of } from 'rxjs';

@Component({
   selector: 'app-informes-historial-edit',
   standalone: true,
   imports: [CommonModule, FormsModule, DatePickerComponent],
   templateUrl: './informes-historial-edit.component.html',
})
export class InformesHistorialEditComponent implements OnInit {
   @Input() publicadorId!: number;
   @Input() publicadorNombre: string = '';
   @Input() initialAno!: number;
   @Input() initialMes!: number;
   
   @Output() close = new EventEmitter<boolean>();
   
   informesService = inject(InformesService);
   privilegiosService = inject(PrivilegiosService);
   
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

   // Tab navigation
   activeTab = signal<'informe' | 'privilegios'>('informe');

   // Privileges history panel
   private catalogoPrivilegios = signal<Privilegio[]>([]);
   privilegiosPrecursor = signal<(PublicadorPrivilegio & { nombre: string })[]>([]);
   loadingPrivilegios = signal<boolean>(false);
   showPrivilegiosPanel = signal<boolean>(true);
   editingPrivilegioId = signal<number | null>(null);
   editFechaInicio = signal<string>('');
   editFechaFin = signal<string>('');
   savingPrivilegio = signal<boolean>(false);
   deletingPrivilegioId = signal<number | null>(null);
   privNoEliminableMotivo = signal<string | null>(null);

   // New privilege form
   showNewPrivilegioForm = signal<boolean>(false);
   newPrivTipo = signal<string>('');
   newPrivFechaInicio = signal<string>('');
   newPrivFechaFin = signal<string>('');
   savingNewPrivilegio = signal<boolean>(false);

   private readonly PRECURSOR_NOMBRES = ['Precursor Auxiliar', 'Precursor Regular', 'Precursor Especial'];

   // True once privileges have loaded and publisher has at least one precursor record,
   // OR the current month's data already has a precursor type set
   esPrecursor = computed(() => {
      return this.privilegiosPrecursor().length > 0 ||
             this.esAuxiliar() || this.esRegular() || this.esEspecial();
   });

   // Conflict detection for edit form
   editPrivConflicts = computed(() => {
      const id = this.editingPrivilegioId();
      const inicio = this.editFechaInicio();
      if (!id || !inicio) return [];
      return this.privilegiosPrecursor().filter(p =>
         p.id_publicador_privilegio !== id &&
         this.datesOverlap(inicio, this.editFechaFin() || null, p.fecha_inicio, p.fecha_fin ?? null)
      );
   });

   editPrivMultipleActivo = computed(() => {
      const id = this.editingPrivilegioId();
      if (this.editFechaFin()) return false;
      return this.privilegiosPrecursor().some(p => p.id_publicador_privilegio !== id && !p.fecha_fin);
   });

   // Conflict detection for new privilege form
   newPrivConflicts = computed(() => {
      const inicio = this.newPrivFechaInicio();
      if (!inicio) return [];
      return this.privilegiosPrecursor().filter(p =>
         this.datesOverlap(inicio, this.newPrivFechaFin() || null, p.fecha_inicio, p.fecha_fin ?? null)
      );
   });

   newPrivMultipleActivo = computed(() => {
      if (this.newPrivFechaFin()) return false;
      return this.privilegiosPrecursor().some(p => !p.fecha_fin);
   });

   // Local cache for unsaved changes: key is "YYYY-MM"
   pendingChanges = new Map<string, InformeHistorialEdit>();
   originalValues = new Map<string, InformeHistorialDetalle>();
   
   ngOnInit() {
      if (this.initialAno) this.selectedAno.set(this.initialAno);
      if (this.initialMes) this.selectedMes.set(this.initialMes);
      
      this.loadPeriodosDisponibles();
      this.cargarPrivilegiosPrecursor();
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
      this.saveCurrentToPending();
      this.showValidationError.set(false);
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
      this.saveCurrentToPending();
      this.showValidationError.set(false);
      this.cancelarAuxiliarRapido();
      this.cancelarQuickPriv();
      this.selectedMes.set(mes);
      this.loadDetails();
   }

   hasValidationError(ano: number, mes: number): boolean {
      const key = `${ano}-${mes}`;
      const val = this.pendingChanges.get(key);
      if (!val) return false;
      return (val.horas || 0) > 0 && !val.privilegio;
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
             this.cancelarQuickPriv();
         }
      } else if (tipo === 'Regular') {
         const turningOn = !this.esRegular();
         this.esRegular.set(turningOn);
         if (turningOn) {
             this.esAuxiliar.set(false);
             this.esEspecial.set(false);
             this.showValidationError.set(false);
             this.abrirQuickPrivForm('Regular');
         } else {
             this.cancelarQuickPriv();
         }
      } else if (tipo === 'Especial') {
         const turningOn = !this.esEspecial();
         this.esEspecial.set(turningOn);
         if (turningOn) {
             this.esAuxiliar.set(false);
             this.esRegular.set(false);
             this.showValidationError.set(false);
             this.abrirQuickPrivForm('Especial');
         } else {
             this.cancelarQuickPriv();
         }
      }
   }

   private abrirQuickPrivForm(tipo: 'Regular' | 'Especial') {
      const ano = this.selectedAno();
      const mes = this.selectedMes();
      const pad = (n: number) => String(n).padStart(2, '0');
      this.quickPrivFechaInicio.set(`${ano}-${pad(mes)}-01`);
      this.showQuickPrivForm.set(tipo);
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

      // Save current month to pending first
      this.saveCurrentToPending();

      // Validate all pending changes: any month with horas > 0 must have a precursor type
      const errorEntry = Array.from(this.pendingChanges.entries()).find(
         ([, val]) => (val.horas || 0) > 0 && !val.privilegio
      );
      if (errorEntry) {
         const [key] = errorEntry;
         const [ano, mes] = key.split('-').map(Number);
         // Navigate to the offending month
         this.selectedAno.set(ano);
         this.selectedMes.set(mes);
         this.loadDetails();
         this.showValidationError.set(true);
         return;
      }

      this.showValidationError.set(false);

      // Also validate current month (may not be in pending yet)
      if (this.horasRequierePrecursor()) {
         this.showValidationError.set(true);
         return;
      }

      this.saving.set(true);

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
            this.showToast('Informe guardado correctamente');
            setTimeout(() => this.close.emit(true), 800);
         },
         error: (err) => {
            console.error('Error saving all historial updates', err);
            this.saving.set(false);
         }
      });
   }
   
   cargarPrivilegiosPrecursor() {
      if (!this.publicadorId) return;
      this.loadingPrivilegios.set(true);

      forkJoin({
         catalogo: this.privilegiosService.getPrivilegios(),
         asignados: this.privilegiosService.getPublicadorPrivilegios(this.publicadorId)
      }).subscribe({
         next: ({ catalogo, asignados }) => {
            this.catalogoPrivilegios.set(catalogo);
            const precursorIds = new Set(
               catalogo
                  .filter(p => this.PRECURSOR_NOMBRES.includes(p.nombre_privilegio))
                  .map(p => p.id_privilegio)
            );
            const enriquecidos = asignados
               .filter(a => precursorIds.has(a.id_privilegio))
               .map(a => ({
                  ...a,
                  nombre: catalogo.find(c => c.id_privilegio === a.id_privilegio)?.nombre_privilegio ?? ''
               }))
               .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
            this.privilegiosPrecursor.set(enriquecidos);
            this.loadingPrivilegios.set(false);
         },
         error: () => this.loadingPrivilegios.set(false)
      });
   }

   iniciarEdicionPrivilegio(priv: PublicadorPrivilegio & { nombre: string }) {
      this.editingPrivilegioId.set(priv.id_publicador_privilegio);
      this.editFechaInicio.set(priv.fecha_inicio);
      this.editFechaFin.set(priv.fecha_fin ?? '');
      this.deletingPrivilegioId.set(null);
      this.privNoEliminableMotivo.set(null);
   }

   cancelarEdicionPrivilegio() {
      this.editingPrivilegioId.set(null);
      this.editFechaInicio.set('');
      this.editFechaFin.set('');
   }

   guardarEdicionPrivilegio() {
      const id = this.editingPrivilegioId();
      if (!id || this.savingPrivilegio()) return;
      this.savingPrivilegio.set(true);
      this.privilegiosService.updatePublicadorPrivilegio(id, {
         fecha_inicio: this.editFechaInicio(),
         fecha_fin: this.editFechaFin() || null
      }).subscribe({
         next: () => {
            this.savingPrivilegio.set(false);
            this.cancelarEdicionPrivilegio();
            this.cargarPrivilegiosPrecursor();
            this.showToast('Fechas actualizadas correctamente');
         },
         error: () => this.savingPrivilegio.set(false)
      });
   }

   iniciarEliminacionPrivilegio(id: number) {
      this.deletingPrivilegioId.set(id);
      this.privNoEliminableMotivo.set(null);
      this.editingPrivilegioId.set(null);
      this.privilegiosService.isPrivilegioEliminable(id).subscribe({
         next: ({ eliminable, motivo }) => {
            if (!eliminable) {
               this.privNoEliminableMotivo.set(motivo ?? 'No se puede eliminar este registro.');
            }
         }
      });
   }

   cancelarEliminacionPrivilegio() {
      this.deletingPrivilegioId.set(null);
      this.privNoEliminableMotivo.set(null);
   }

   confirmarEliminarPrivilegio() {
      const id = this.deletingPrivilegioId();
      if (!id || this.privNoEliminableMotivo()) return;
      this.privilegiosService.deletePublicadorPrivilegio(id).subscribe({
         next: () => {
            this.deletingPrivilegioId.set(null);
            this.cargarPrivilegiosPrecursor();
            this.showToast('Privilegio eliminado');
         }
      });
   }

   // Toast notification
   toastMessage = signal<string | null>(null);
   private toastTimer: ReturnType<typeof setTimeout> | null = null;

   showToast(msg: string) {
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastMessage.set(msg);
      this.toastTimer = setTimeout(() => this.toastMessage.set(null), 3000);
   }

   switchTab(tab: 'informe' | 'privilegios') {
      if (this.horasRequierePrecursor() && tab === 'privilegios') {
         this.showValidationError.set(true);
         return;
      }
      this.activeTab.set(tab);
      // Reset privilege inline forms when switching back
      if (tab === 'informe') {
         this.cancelarEdicionPrivilegio();
         this.cancelarEliminacionPrivilegio();
         this.cancelarNuevoPrivilegio();
      }
      if (tab === 'privilegios') {
         this.cancelarAuxiliarRapido();
      }
   }

   private datesOverlap(aStart: string, aEnd: string | null, bStart: string, bEnd: string | null): boolean {
      const aEndEff = aEnd || '9999-12-31';
      const bEndEff = bEnd || '9999-12-31';
      return aStart <= bEndEff && bStart <= aEndEff;
   }

   mostrarFormNuevo() {
      this.showNewPrivilegioForm.set(true);
      this.newPrivTipo.set('');
      this.newPrivFechaInicio.set('');
      this.newPrivFechaFin.set('');
      this.editingPrivilegioId.set(null);
      this.deletingPrivilegioId.set(null);
   }

   cancelarNuevoPrivilegio() {
      this.showNewPrivilegioForm.set(false);
      this.newPrivTipo.set('');
      this.newPrivFechaInicio.set('');
      this.newPrivFechaFin.set('');
   }

   crearPrivilegio() {
      const tipo = this.newPrivTipo();
      const inicio = this.newPrivFechaInicio();
      if (!tipo || !inicio || this.savingNewPrivilegio()) return;

      const idPrivilegio = this.catalogoPrivilegios().find(p => p.nombre_privilegio === tipo)?.id_privilegio;
      if (!idPrivilegio) return;

      this.savingNewPrivilegio.set(true);
      this.privilegiosService.createPublicadorPrivilegio({
         id_publicador: this.publicadorId,
         id_privilegio: idPrivilegio,
         fecha_inicio: inicio,
         fecha_fin: this.newPrivFechaFin() || null
      }).subscribe({
         next: () => {
            this.savingNewPrivilegio.set(false);
            this.cancelarNuevoPrivilegio();
            this.cargarPrivilegiosPrecursor();
            this.showToast('Privilegio registrado correctamente');
         },
         error: () => this.savingNewPrivilegio.set(false)
      });
   }

   formatFecha(fecha: string | null | undefined): string {
      if (!fecha) return 'Activo';
      const [y, m, d] = fecha.split('-');
      return `${d}/${m}/${y}`;
   }

   getNombreCorto(nombre: string): string {
      return nombre.replace('Precursor ', '');
   }

   // Quick Auxiliar creation (single click from Informe tab)
   savingQuickAuxiliar = signal<boolean>(false);

   cancelarAuxiliarRapido() {}

   crearAuxiliarRapido() {
      if (this.savingQuickAuxiliar()) return;

      const ano = this.selectedAno();
      const mes = this.selectedMes();
      const pad = (n: number) => String(n).padStart(2, '0');
      const lastDay = new Date(ano, mes, 0).getDate();
      const fechaInicio = `${ano}-${pad(mes)}-01`;
      const fechaFin = `${ano}-${pad(mes)}-${pad(lastDay)}`;

      const idPrivilegio = this.catalogoPrivilegios().find(p => p.nombre_privilegio === 'Precursor Auxiliar')?.id_privilegio;
      if (!idPrivilegio) return;

      this.savingQuickAuxiliar.set(true);
      this.privilegiosService.createPublicadorPrivilegio({
         id_publicador: this.publicadorId,
         id_privilegio: idPrivilegio,
         fecha_inicio: fechaInicio,
         fecha_fin: fechaFin
      }).subscribe({
         next: () => {
            this.savingQuickAuxiliar.set(false);
            this.esAuxiliar.set(true);
            this.esRegular.set(false);
            this.esEspecial.set(false);
            this.cargarPrivilegiosPrecursor();
            this.showToast('Privilegio de Auxiliar registrado');
         },
         error: () => this.savingQuickAuxiliar.set(false)
      });
   }

   // Quick Regular / Especial creation inline below the toggle grid
   showQuickPrivForm = signal<'Regular' | 'Especial' | null>(null);
   quickPrivFechaInicio = signal<string>('');
   savingQuickPriv = signal<boolean>(false);

   /** True if the publisher already has any precursor privilege with no fecha_fin (open-ended/active) */
   tienePrivActivoSinFin = computed(() =>
      this.privilegiosPrecursor().some(p => !p.fecha_fin)
   );

   cancelarQuickPriv() {
      this.showQuickPrivForm.set(null);
      this.quickPrivFechaInicio.set('');
   }

   crearPrivRapido() {
      const tipo = this.showQuickPrivForm();
      const inicio = this.quickPrivFechaInicio();
      if (!tipo || !inicio || this.savingQuickPriv()) return;

      const nombrePrivilegio = `Precursor ${tipo}`;
      const idPrivilegio = this.catalogoPrivilegios().find(p => p.nombre_privilegio === nombrePrivilegio)?.id_privilegio;
      if (!idPrivilegio) return;

      this.savingQuickPriv.set(true);
      this.privilegiosService.createPublicadorPrivilegio({
         id_publicador: this.publicadorId,
         id_privilegio: idPrivilegio,
         fecha_inicio: inicio,
         fecha_fin: null
      }).subscribe({
         next: () => {
            this.savingQuickPriv.set(false);
            this.cancelarQuickPriv();
            this.cargarPrivilegiosPrecursor();
            this.showToast(`Privilegio de ${tipo} registrado`);
         },
         error: () => this.savingQuickPriv.set(false)
      });
   }

   cancelar() {
      this.close.emit(false);
   }
}
