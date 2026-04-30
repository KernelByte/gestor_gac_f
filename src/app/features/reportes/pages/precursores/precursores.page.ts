import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartCardComponent } from '../../shared/chart-card.component';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import { barOption, lineOption, pieOption } from '../../shared/chart-options';
import { ReportesService, PrecursoresReporte } from '../../services/reportes.service';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChartCardComponent, KpiCardComponent],
  template: `
    <div class="p-4 sm:p-6 space-y-5">
      <header class="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">Análisis de Precursores</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Panorama general de los precursores activos de la congregación.</p>
        </div>
      </header>

      <ng-container *ngIf="data() as d; else loadingTpl">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <app-kpi-card *ngFor="let k of d.kpis" [label]="k.label" [value]="k.value" [hint]="k.hint" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <app-chart-card title="Distribución por tipo"
                          subtitle="Precursores activos"
                          [option]="distOption()" />
          <app-chart-card title="Horas promedio mensuales"
                          subtitle="Por tipo de precursor (últimos 12 meses)"
                          [option]="horasOption()" />
        </div>

        <app-chart-card title="Tendencia de precursores activos"
                        subtitle="Últimos 12 meses"
                        [option]="tendenciaOption()"
                        [height]="320" />
      </ng-container>

      <ng-template #loadingTpl>
        <div *ngIf="error(); else spinTpl" class="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-700 dark:text-red-300">
          {{ error() }}
        </div>
        <ng-template #spinTpl>
          <div class="text-sm text-slate-500 dark:text-slate-400">Cargando análisis…</div>
        </ng-template>
      </ng-template>
    </div>
  `,
})
export class PrecursoresPage {
  private api = inject(ReportesService);

  readonly data = signal<PrecursoresReporte | null>(null);
  readonly error = signal<string | null>(null);

  readonly distOption = computed(() => {
    const d = this.data();
    return d ? pieOption(d.distribucion_tipo, 'Tipo') : null;
  });

  readonly horasOption = computed(() => {
    const d = this.data();
    return d ? barOption(d.horas_promedio_tipo, { valueSuffix: 'h' }) : null;
  });

  readonly tendenciaOption = computed(() => {
    const d = this.data();
    return d ? lineOption(d.tendencia_activos, { area: true }) : null;
  });

  ngOnInit(): void {
    this.api.getPrecursores().subscribe({
      next: (res) => this.data.set(res),
      error: (err) => this.error.set(err?.error?.detail ?? 'No fue posible cargar el reporte.'),
    });
  }
}
