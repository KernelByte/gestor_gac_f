import { Component, ViewEncapsulation, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { TerritoriosService } from '../services/territorios.service';
import { RegistroS13 } from '../models/territorio.model';
import { AvisoComponent } from '../../../shared/components/aviso/aviso.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PickerOption, SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';

/**
 * Registro de asignación de territorio (S-13) por año de servicio (sep–ago).
 * Se arma solo con las salidas y las vueltas completadas; no hay que llevarlo a mano.
 */
@Component({
  standalone: true,
  selector: 'app-registro-s13-page',
  host: { class: 'tema-territorios' },
  imports: [CommonModule, FormsModule, DatePipe, PageHeaderComponent, SelectPickerComponent, AvisoComponent, EmptyStateComponent],
  encapsulation: ViewEncapsulation.None,
  styles: [`
    #registro-s13 .s13-solo-impresion { display: none; }
    @media print {
      @page { size: A4 landscape; margin: 12mm 14mm; }
      html, body { background: #fff !important; }
      body * { visibility: hidden !important; }
      #registro-s13, #registro-s13 * { visibility: visible !important; }
      .no-imprimir { display: none !important; }
      #registro-s13 {
        position: absolute; left: 0; top: 0; width: 100%;
        padding: 0 !important; margin: 0 !important;
        border: 0 !important; border-radius: 0 !important; box-shadow: none !important;
        background: #fff !important; color: #1e293b !important;
        font-size: 9.5pt; line-height: 1.35;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      #registro-s13 .s13-solo-impresion { display: flex !important; }
      #registro-s13 .s13-pantalla { display: none !important; }
      #registro-s13 .overflow-x-auto { overflow: visible !important; }
      #registro-s13 .s13-cab { align-items: flex-end; justify-content: space-between; gap: 12mm;
        padding-bottom: 4mm; margin-bottom: 5mm; border-bottom: 1.5pt solid #047857; }
      #registro-s13 .s13-marca { font-size: 8pt; font-weight: 800; letter-spacing: .14em; color: #047857 !important; }
      #registro-s13 .s13-titulo { font-size: 16pt; font-weight: 800; color: #0f172a !important; margin: 1mm 0 0; letter-spacing: -.01em; }
      #registro-s13 .s13-rango { text-align: right; font-size: 9pt; color: #475569 !important; }
      #registro-s13 .s13-rango strong { display: block; font-size: 12pt; color: #0f172a !important; }
      #registro-s13 table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9.5pt; }
      #registro-s13 thead { display: table-header-group; }
      #registro-s13 th { background: #f1f5f9 !important; color: #334155 !important; font-size: 8pt !important;
        font-weight: 700 !important; letter-spacing: .06em; text-transform: uppercase;
        padding: 2.2mm 3mm !important; border-bottom: 1pt solid #94a3b8 !important; }
      #registro-s13 th span { color: #64748b !important; text-transform: none; letter-spacing: 0; }
      #registro-s13 td { padding: 2.6mm 3mm !important; border-bottom: .6pt solid #e2e8f0 !important; }
      #registro-s13 tr { break-inside: avoid; page-break-inside: avoid; }
      #registro-s13 .s13-cod { font-size: 12pt; font-weight: 800; color: #0f172a !important; }
      #registro-s13 .s13-mut { color: #64748b !important; }
      #registro-s13 .s13-ult { font-weight: 700; color: #065f46 !important; font-size: 10.5pt; }
      #registro-s13 .s13-nombre { font-weight: 700; color: #0f172a !important; }
      #registro-s13 .s13-curso { color: #b45309 !important; font-weight: 700; }
      #registro-s13 .s13-pie { display: flex !important; justify-content: space-between; margin-top: 5mm;
        font-size: 8pt; color: #64748b !important; }
    }
  `],
  template: `
    <div>
      <div class="no-imprimir">
        <app-page-header
          title="Registro de territorios (S-13)"
          subtitle="Cuándo se terminó de trabajar cada territorio y quién lo trabajó">
          <button type="button" (click)="imprimir()" [disabled]="!data() || loading() || error()"
            class="btn-secondary whitespace-nowrap disabled:opacity-50">
            Imprimir
          </button>
          <button type="button" (click)="descargarPdf()" [disabled]="!data() || descargando()"
            class="btn-primary whitespace-nowrap disabled:opacity-50">
            {{ descargando() ? 'Generando…' : 'Descargar PDF (S-13)' }}
          </button>
        </app-page-header>

        <div class="flex flex-wrap items-center gap-3 mb-4">
          <label for="anio-servicio" class="text-sm font-semibold text-slate-700 dark:text-slate-300">Año de servicio</label>
          <app-select-picker class="w-60" colorScheme="emerald" ariaLabel="Año de servicio" [ngModel]="anio()"
            (ngModelChange)="cambiarAnio($event)" [options]="opcionesAnio" [clearable]="false" [searchable]="false" />
          @if (errorPdf()) {
            <app-aviso tone="danger" [dense]="true">No se pudo generar el PDF. Intenta de nuevo.</app-aviso>
          }
        </div>
      </div>

      <div id="registro-s13" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-800 p-5">
        @if (loading()) {
          <div class="flex items-center gap-2 text-sm text-slate-500" role="status"><span class="spinner-sm"></span>Cargando...</div>
        } @else if (error()) {
          <app-aviso tone="danger">No se pudo cargar el registro. Intenta de nuevo.</app-aviso>
        } @else if (data(); as d) {
          <div class="s13-solo-impresion s13-cab">
            <div>
              <div class="s13-marca">GAC · REGISTRO DE TERRITORIOS</div>
              <h1 class="s13-titulo">Registro de asignación de territorio</h1>
            </div>
            <div class="s13-rango">
              <strong>Año de servicio {{ d.anio_servicio }}–{{ d.anio_servicio + 1 }}</strong>
              Del {{ d.desde | date:'d MMM yyyy':'':'es' }} al {{ d.hasta | date:'d MMM yyyy':'':'es' }}
            </div>
          </div>
          <div class="s13-pantalla">
            <h2 class="text-base font-bold text-slate-900 dark:text-white mb-1">
              Registro de asignación de territorio · Año de servicio {{ d.anio_servicio }}–{{ d.anio_servicio + 1 }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Del {{ d.desde | date:'d MMM yyyy':'':'es' }} al {{ d.hasta | date:'d MMM yyyy':'':'es' }}
            </p>
          </div>

          @if (d.territorios.length === 0) {
            <app-empty-state [compact]="true" accent="green" title="Aún no hay territorios registrados." />
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse text-sm">
                <thead>
                  <tr class="border-b-2 border-slate-300 dark:border-slate-600">
                    <th scope="col" class="py-2 pr-3 font-bold" style="width:15%">Territorio</th>
                    <th scope="col" class="py-2 pr-3 font-bold" style="width:19%">Última fecha en que se completó<span class="block text-xs font-normal text-slate-500 dark:text-slate-400">la más reciente de la tarjeta</span></th>
                    @for (n of columnas(); track n) {
                      <th scope="col" class="py-2 pr-3 font-bold">Asignado a <span class="font-normal text-slate-500 dark:text-slate-400">({{ n }})</span></th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (t of d.territorios; track t.id_territorio) {
                    <tr class="border-b border-slate-200 dark:border-slate-700 align-top">
                      <td class="py-2 pr-3">
                        <p class="font-bold s13-cod">{{ t.codigo }}</p>
                        <p class="text-xs text-slate-500 dark:text-slate-400 s13-mut">{{ t.nombre }}</p>
                      </td>
                      <td class="py-2 pr-3 s13-ult">
                        {{ t.ultima_completada ? (t.ultima_completada | date:'d/M/yy':'':'es') : '—' }}
                      </td>
                      @for (n of columnas(); track n) {
                        <td class="py-2 pr-3">
                          @if (t.ciclos[n - 1]; as c) {
                            <p class="font-semibold s13-nombre" [class.text-slate-400]="!c.asignado_a">{{ c.asignado_a || 'Sin capitán anotado' }}</p>
                            <p class="text-xs text-slate-500 dark:text-slate-400 s13-mut">
                              {{ c.tipo === 'publicador' ? (c.parcial ? 'Publicador · parte de la tarjeta' : 'Publicador') : 'Salidas en grupo' }}@if (c.tipo === 'grupo' && c.capitanes.length > 1) { <span [title]="c.capitanes.join(', ')"> · {{ c.capitanes.length }} capitanes</span> }
                            </p>
                            <p class="mt-1"><span class="s13-mut">Se asignó:</span> {{ c.fecha_inicio | date:'d/M/yy':'':'es' }}</p>
                            <p>
                              @if (c.fecha_fin) { <span class="s13-mut">Se completó:</span> {{ c.fecha_fin | date:'d/M/yy':'':'es' }}@if (c.cierre_manual) { <span class="text-xs text-slate-500 dark:text-slate-400"> (cerrada a mano)</span> } }
                              @else { <span class="font-semibold text-amber-700 dark:text-amber-400 s13-curso">{{ c.tipo === 'publicador' ? 'Aún la tiene' : 'En curso' }}</span> }
                            </p>
                          } @else {
                            <span class="text-slate-400">—</span>
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          <div class="s13-solo-impresion s13-pie">
            <span>Registro S-13 · generado con GAC</span>
            <span>Impreso el {{ hoy | date:'d MMM yyyy':'':'es' }}</span>
          </div>
        }
      </div>
    </div>
  `,
})
export class RegistroS13Page implements OnInit {
  private territoriosService = inject(TerritoriosService);

  /** El año de servicio empieza en septiembre. */
  private static anioActual(): number {
    const hoy = new Date();
    return hoy.getMonth() >= 8 ? hoy.getFullYear() : hoy.getFullYear() - 1;
  }

  hoy = new Date();
  anios = [0, 1, 2, 3].map(i => RegistroS13Page.anioActual() - i);
  opcionesAnio: PickerOption[] = this.anios.map(a => ({ value: a, label: `${a} – ${a + 1}`, hint: 'septiembre a agosto' }));
  anio = signal(RegistroS13Page.anioActual());
  data = signal<RegistroS13 | null>(null);
  loading = signal(true);
  error = signal(false);

  /** Tantas columnas "Vuelta n" como la mayor cantidad de vueltas de un territorio (mínimo 1). */
  columnas = computed(() => {
    const max = Math.max(1, ...(this.data()?.territorios ?? []).map(t => t.ciclos.length));
    return Array.from({ length: max }, (_, i) => i + 1);
  });

  ngOnInit(): void {
    this.cargar();
  }

  cambiarAnio(a: number): void {
    this.anio.set(a);
    this.cargar();
  }

  private carga?: Subscription;

  private cargar(): void {
    // Al cambiar de año rápido, la respuesta de un año anterior no debe pisar la del elegido.
    this.carga?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.carga = this.territoriosService.getRegistroS13(this.anio()).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: () => { this.data.set(null); this.error.set(true); this.loading.set(false); },
    });
  }

  imprimir(): void {
    window.print();
  }

  descargando = signal(false);
  errorPdf = signal(false);

  descargarPdf(): void {
    const anio = this.anio();
    this.descargando.set(true);
    this.errorPdf.set(false);
    this.territoriosService.getRegistroS13Pdf(anio).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `S-13_${anio}-${anio + 1}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.descargando.set(false);
      },
      error: () => { this.descargando.set(false); this.errorPdf.set(true); },
    });
  }
}
