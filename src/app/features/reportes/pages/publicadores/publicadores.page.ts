import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartCardComponent } from '../../shared/chart-card.component';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import { barOption, pieOption } from '../../shared/chart-options';
import { ReportesService, PublicadoresReporte } from '../../services/reportes.service';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChartCardComponent, KpiCardComponent],
  template: `
    <div class="p-4 sm:p-6 space-y-5">
      <header class="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">Análisis de Publicadores</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">Distribución demográfica y por grupo de los publicadores activos.</p>
        </div>
      </header>

      <ng-container *ngIf="data() as d; else loadingTpl">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <app-kpi-card *ngFor="let k of d.kpis" [label]="k.label" [value]="k.value" [hint]="k.hint" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <app-chart-card title="Distribución por género"
                          [option]="generoOption()" />
          <app-chart-card title="Distribución por rango de edad"
                          [option]="edadOption()" />
        </div>

        <app-chart-card title="Publicadores por grupo"
                        subtitle="Cantidad de publicadores activos"
                        [option]="grupoOption()"
                        [height]="360" />
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
export class PublicadoresPage {
  private api = inject(ReportesService);

  readonly data = signal<PublicadoresReporte | null>(null);
  readonly error = signal<string | null>(null);

  readonly generoOption = computed(() => {
    const d = this.data();
    return d ? pieOption(d.distribucion_genero, 'Género') : null;
  });

  readonly edadOption = computed(() => {
    const d = this.data();
    return d ? barOption(d.distribucion_edad) : null;
  });

  readonly grupoOption = computed(() => {
    const d = this.data();
    return d ? barOption(d.distribucion_grupo, { horizontal: true }) : null;
  });

  ngOnInit(): void {
    this.api.getPublicadores().subscribe({
      next: (res) => this.data.set(res),
      error: (err) => this.error.set(err?.error?.detail ?? 'No fue posible cargar el reporte.'),
    });
  }
}
