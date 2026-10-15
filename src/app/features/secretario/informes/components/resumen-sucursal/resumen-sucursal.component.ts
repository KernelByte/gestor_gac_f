import { Component, Input, OnChanges, SimpleChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InformesService } from '../../services/informes.service';
import { ResumenSucursal } from '../../models/informe.model';

@Component({
  selector: 'app-resumen-sucursal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './resumen-sucursal.component.html',
  styles: [`
    :host { display: block; height: 100%; }

    @media print {
      :host {
        height: auto !important;
        overflow: visible !important;
      }
      .no-print { display: none !important; }
      .print-container {
        background: white !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0 !important;
        color: black !important;
      }
      .print-container * {
        color: black !important;
        border-color: #ccc !important;
      }
      table { page-break-inside: avoid; }
    }
  `]
})
export class ResumenSucursalComponent implements OnChanges {
  private informesService = inject(InformesService);

  @Input() selectedMes = '';
  @Input() selectedAno = '';
  @Input() congregacionId = 0;
  @Input() grupoId: number | null = null;
  @Input() showAsistencia: boolean = true;
  /** Puede marcar el mes como enviado a la sucursal. */
  @Input() puedeCerrar = false;
  /** Puede reabrir un mes ya enviado (solo secretario o administrador). */
  @Input() puedeReabrir = false;

  resumen = signal<ResumenSucursal | null>(null);
  loading = signal(false);

  // Envío a la sucursal
  confirmandoCierre = signal(false);
  reabriendo = signal(false);
  guardandoCierre = signal(false);
  errorCierre = signal<string | null>(null);
  motivoReapertura = '';

  meses = [
    { value: '1', label: 'Enero' }, { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' }, { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' }, { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' }, { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
  ];

  localMes = '';
  localAno = '';

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedMes'] || changes['selectedAno'] || changes['congregacionId'] || changes['grupoId']) {
      this.localMes = this.selectedMes;
      this.localAno = this.selectedAno;
      this.loadResumen();
    }
  }

  onMesChange(mes: string) {
    this.localMes = mes;
    this.loadResumen();
  }

  onAnoChange(ano: string) {
    this.localAno = ano;
    this.loadResumen();
  }

  loadResumen() {
    const periodoId = this.getPeriodoId();
    if (!periodoId || !this.congregacionId) return;
    this.cancelarAccionCierre();

    this.loading.set(true);
    this.informesService.getResumenSucursal(periodoId, this.congregacionId, this.grupoId).subscribe({
      next: (data) => {
        this.resumen.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.resumen.set(null);
        this.loading.set(false);
      }
    });
  }

  getPeriodoId(): number {
    const ano = parseInt(this.localAno);
    const mes = parseInt(this.localMes);
    if (isNaN(ano) || isNaN(mes)) return 0;
    return (ano - 2010) * 12 + mes;
  }

  getMesLabel(): string {
    const m = this.meses.find(m => m.value === this.localMes);
    return m ? m.label : '';
  }

  getAnos(): string[] {
    const currentYear = new Date().getFullYear();
    const years: string[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      years.push(y.toString());
    }
    return years;
  }

  print() {
    window.print();
  }

  // --- Envío a la sucursal ---

  cancelarAccionCierre() {
    this.confirmandoCierre.set(false);
    this.reabriendo.set(false);
    this.errorCierre.set(null);
    this.motivoReapertura = '';
  }

  marcarComoEnviado() {
    const periodoId = this.getPeriodoId();
    if (!periodoId || !this.congregacionId) return;
    this.guardandoCierre.set(true);
    this.errorCierre.set(null);
    this.informesService.cerrarPeriodo(periodoId, this.congregacionId).subscribe({
      next: () => {
        this.guardandoCierre.set(false);
        this.loadResumen();
      },
      error: (err) => {
        this.guardandoCierre.set(false);
        this.errorCierre.set(err?.error?.detail || 'No se pudo marcar el mes como enviado. Inténtalo de nuevo.');
      }
    });
  }

  reabrirMes() {
    const periodoId = this.getPeriodoId();
    const motivo = this.motivoReapertura.trim();
    if (!periodoId || !this.congregacionId) return;
    if (motivo.length < 3) {
      this.errorCierre.set('Escribe el motivo para reabrir el mes.');
      return;
    }
    this.guardandoCierre.set(true);
    this.errorCierre.set(null);
    this.informesService.reabrirPeriodo(periodoId, this.congregacionId, motivo).subscribe({
      next: () => {
        this.guardandoCierre.set(false);
        this.loadResumen();
      },
      error: (err) => {
        this.guardandoCierre.set(false);
        this.errorCierre.set(err?.error?.detail || 'No se pudo reabrir el mes. Inténtalo de nuevo.');
      }
    });
  }

  /** "12 de septiembre de 2026" */
  fechaLarga(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
  }
}
