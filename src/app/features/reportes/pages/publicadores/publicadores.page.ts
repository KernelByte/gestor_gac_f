import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartCardComponent } from '../../shared/chart-card.component';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import {
  barOption,
  divergingBarOption,
  lineOption,
  multiBarOption,
  multiLineOption,
  pyramidOption,
} from '../../shared/chart-options';
import { EstadoBadgeComponent } from '../precursores/components/estado-badge.component';
import { ReportesService, PublicadoresReporte } from '../../services/reportes.service';

/**
 * Análisis de publicadores por año de servicio (Sep–Ago): demografía,
 * patrones de actividad (riesgo de inactividad, entrega de informes),
 * capacidad de servicio por grupo y tendencias de crecimiento.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChartCardComponent, KpiCardComponent, EstadoBadgeComponent],
  template: `
    <div class="p-4 sm:p-6 space-y-5">
      <header class="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 class="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white">Análisis de Publicadores</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            Demografía, actividad, capacidad de servicio y crecimiento de los publicadores activos.
          </p>
        </div>
        <div *ngIf="data() as d">
          <label for="anio-servicio-pub" class="sr-only">Año de servicio</label>
          <select id="anio-servicio-pub"
                  class="h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm font-medium text-slate-700 dark:text-slate-200"
                  (change)="cambiarAnio($event)">
            <option *ngFor="let a of d.anios_disponibles" [value]="a" [selected]="a === anioSeleccionado()">
              {{ a - 1 }}–{{ a }}
            </option>
          </select>
        </div>
      </header>

      <ng-container *ngIf="data() as d; else loadingTpl">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <app-kpi-card *ngFor="let k of d.kpis" [label]="k.label" [value]="k.value" [hint]="k.hint" />
        </div>

        <!-- ── Actividad y riesgo ─────────────────────────────────────── -->
        <h2 class="pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          Actividad y riesgo de inactividad
        </h2>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <app-chart-card title="Actividad mensual"
                          subtitle="Publicadores que participaron en el ministerio vs sin informe registrado (año de servicio)"
                          [option]="actividadOption()" />
          <app-chart-card title="Entrega de informes por grupo"
                          subtitle="% de la cohorte activa con informe registrado el último mes cerrado"
                          [option]="entregaOption()" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <app-chart-card title="Flujo de actividad"
                          subtitle="Reactivaciones (arriba) vs publicadores que cumplen 6 meses sin participar (abajo)"
                          [option]="flujoOption()" />

          <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
            <div>
              <h3 class="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                Riesgo de inactividad
              </h3>
              <p class="text-[0.8125rem] text-slate-700 dark:text-slate-200 mt-0.5">
                Meses cerrados consecutivos sin participar. A los 6 meses la pauta los considera inactivos.
              </p>
            </div>
            <div *ngIf="d.riesgo_inactividad.length; else sinRiesgoTpl" class="overflow-x-auto overflow-y-auto max-h-72">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-[0.6875rem] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <th class="py-1.5 pr-3 font-semibold">Publicador</th>
                    <th class="py-1.5 pr-3 font-semibold">Grupo</th>
                    <th class="py-1.5 pr-3 font-semibold">Último informe</th>
                    <th class="py-1.5 pr-3 font-semibold text-right">Meses</th>
                    <th class="py-1.5 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let r of d.riesgo_inactividad" class="border-t border-slate-100 dark:border-slate-800">
                    <td class="py-2 pr-3 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{{ r.nombre }}</td>
                    <td class="py-2 pr-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ r.grupo || '—' }}</td>
                    <td class="py-2 pr-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ r.ultimo_mes || 'Sin registro' }}</td>
                    <td class="py-2 pr-3 text-right tabular-nums text-slate-800 dark:text-slate-100">{{ r.meses_sin_informar }}</td>
                    <td class="py-2"><app-estado-badge [estado]="r.estado" /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ng-template #sinRiesgoTpl>
              <div class="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500 min-h-32">
                Nadie lleva 2 o más meses sin informar.
              </div>
            </ng-template>
          </div>
        </div>

        <!-- ── Capacidad de servicio ──────────────────────────────────── -->
        <h2 class="pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          Capacidad de servicio
        </h2>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <app-chart-card title="Pastoreo por grupo"
                          subtitle="Publicadores, ancianos y siervos ministeriales de cada grupo"
                          [option]="capacidadOption()"
                          [height]="320" />
          <app-chart-card title="Precursores auxiliares por mes"
                          subtitle="Nombramientos vigentes en cada mes del año de servicio (respuesta a campañas)"
                          [option]="auxiliaresOption()"
                          [height]="320" />
        </div>

        <!-- ── Crecimiento ────────────────────────────────────────────── -->
        <h2 class="pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          Crecimiento
        </h2>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <app-chart-card title="Bautismos por año de servicio"
                          subtitle="Últimos 10 años de servicio (todo el historial de la congregación)"
                          [option]="bautismosOption()" />
          <app-chart-card title="Antigüedad de bautismo"
                          subtitle="Años desde el bautismo de los publicadores activos"
                          [option]="antiguedadOption()" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <app-chart-card title="Cursos bíblicos por mes"
                          subtitle="Total de cursos informados por la congregación (año de servicio)"
                          [option]="cursosOption()" />

          <div class="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col gap-3">
            <div>
              <h3 class="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                Publicadores no bautizados
              </h3>
              <p class="text-[0.8125rem] text-slate-700 dark:text-slate-200 mt-0.5">
                Activos sin fecha de bautismo, ordenados por tiempo como publicador.
              </p>
            </div>
            <div *ngIf="d.sin_bautizar.length; else sinPnbTpl" class="overflow-x-auto overflow-y-auto max-h-72">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-[0.6875rem] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    <th class="py-1.5 pr-3 font-semibold">Publicador</th>
                    <th class="py-1.5 pr-3 font-semibold">Grupo</th>
                    <th class="py-1.5 pr-3 font-semibold">Publicador desde</th>
                    <th class="py-1.5 font-semibold text-right">Meses</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let s of d.sin_bautizar" class="border-t border-slate-100 dark:border-slate-800">
                    <td class="py-2 pr-3 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{{ s.nombre }}</td>
                    <td class="py-2 pr-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">{{ s.grupo || '—' }}</td>
                    <td class="py-2 pr-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {{ s.publicador_desde ? (s.publicador_desde | date: 'MMM y') : 'Sin dato' }}
                    </td>
                    <td class="py-2 text-right tabular-nums text-slate-800 dark:text-slate-100">
                      {{ s.meses_como_publicador ?? '—' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ng-template #sinPnbTpl>
              <div class="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-slate-500 min-h-32">
                Todos los publicadores activos están bautizados.
              </div>
            </ng-template>
          </div>
        </div>

        <!-- ── Demografía ─────────────────────────────────────────────── -->
        <h2 class="pt-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
          Demografía
        </h2>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <app-chart-card title="Pirámide de edad y género"
                          subtitle="Hombres a la izquierda, mujeres a la derecha"
                          [option]="piramideOption()"
                          [height]="320" />
          <app-chart-card title="Publicadores por grupo"
                          subtitle="Cantidad de publicadores activos"
                          [option]="grupoOption()"
                          [height]="320" />
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <app-chart-card title="Edad promedio por grupo"
                          subtitle="Grupos que envejecen y podrían necesitar ayuda práctica"
                          [option]="edadGrupoOption()" />
          <app-chart-card title="Horas promedio por rango de edad"
                          subtitle="Promedio de horas por informe con participación (año de servicio)"
                          [option]="horasEdadOption()" />
        </div>
      </ng-container>

      <ng-template #loadingTpl>
        <div *ngIf="error(); else spinTpl" class="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10 p-4 text-sm text-red-700 dark:text-red-300 flex items-center gap-3 flex-wrap">
          <span>{{ error() }}</span>
          <button type="button"
                  class="h-8 px-3 rounded-lg border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 text-sm font-medium"
                  (click)="cargar(anioSeleccionado() || undefined)">
            Reintentar
          </button>
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
  readonly anioSeleccionado = signal<number>(0);

  // ── Actividad ──────────────────────────────────────────────────────
  readonly actividadOption = computed(() => {
    const a = this.data()?.actividad_mensual ?? [];
    return multiLineOption(
      a.map(x => x.label),
      [
        { nombre: 'Participaron', valores: a.map(x => x.participaron) },
        { nombre: 'Sin informe', valores: a.map(x => x.sin_informe) },
      ],
      { colores: ['#6366f1', '#ef4444'], area: true },
    );
  });

  readonly entregaOption = computed(() =>
    barOption(this.data()?.entrega_por_grupo ?? [], { horizontal: true, valueSuffix: '%' }));

  readonly flujoOption = computed(() => {
    const f = this.data()?.flujo_actividad ?? [];
    return divergingBarOption(
      f.map(x => x.label),
      { nombre: 'Reactivados', valores: f.map(x => x.reactivados) },
      { nombre: 'Nuevos inactivos', valores: f.map(x => x.nuevos_inactivos) },
    );
  });

  // ── Capacidad de servicio ──────────────────────────────────────────
  readonly capacidadOption = computed(() => {
    const c = this.data()?.capacidad_grupos ?? [];
    return multiBarOption(
      c.map(x => x.grupo),
      [
        { nombre: 'Publicadores', valores: c.map(x => x.publicadores) },
        { nombre: 'Ancianos', valores: c.map(x => x.ancianos) },
        { nombre: 'Siervos ministeriales', valores: c.map(x => x.siervos) },
      ],
      { colores: ['#6366f1', '#22c55e', '#06b6d4'], horizontal: true },
    );
  });

  readonly auxiliaresOption = computed(() =>
    lineOption(this.data()?.auxiliares_por_mes ?? [], { area: true }));

  // ── Crecimiento ────────────────────────────────────────────────────
  readonly bautismosOption = computed(() => barOption(this.data()?.bautismos_por_anio ?? []));
  readonly antiguedadOption = computed(() => barOption(this.data()?.antiguedad_bautismo ?? []));
  readonly cursosOption = computed(() => lineOption(this.data()?.cursos_mensuales ?? [], { area: true }));

  // ── Demografía ─────────────────────────────────────────────────────
  readonly piramideOption = computed(() => pyramidOption(this.data()?.piramide_edad ?? []));
  readonly grupoOption = computed(() =>
    barOption(this.data()?.distribucion_grupo ?? [], { horizontal: true }));
  readonly edadGrupoOption = computed(() =>
    barOption(this.data()?.edad_promedio_grupo ?? [], { horizontal: true, valueSuffix: ' años' }));
  readonly horasEdadOption = computed(() =>
    barOption(this.data()?.horas_por_edad ?? [], { valueSuffix: 'h' }));

  ngOnInit(): void {
    this.cargar();
  }

  cargar(anio?: number): void {
    this.error.set(null);
    this.data.set(null);
    this.api.getPublicadores(anio).subscribe({
      next: (res) => {
        this.data.set(res);
        this.anioSeleccionado.set(res.anio_servicio);
      },
      error: (err) => this.error.set(err?.error?.detail ?? 'No fue posible cargar el reporte.'),
    });
  }

  cambiarAnio(ev: Event): void {
    const anio = Number((ev.target as HTMLSelectElement).value);
    if (anio && anio !== this.anioSeleccionado()) this.cargar(anio);
  }
}
