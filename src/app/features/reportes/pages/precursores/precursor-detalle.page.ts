import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { EChartsOption } from 'echarts';
import { ChartCardComponent } from '../../shared/chart-card.component';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import { EstadoBadgeComponent } from './components/estado-badge.component';
import { SeguimientosPanelComponent } from './components/seguimientos-panel.component';
import { ReportesService, PrecursorDetalle } from '../../services/reportes.service';

/**
 * Detalle individual de un precursor regular: matriz mensual, progreso hacia
 * las 560 h anuales, histórico de años anteriores y seguimientos.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, ChartCardComponent, KpiCardComponent, EstadoBadgeComponent, SeguimientosPanelComponent],
  styleUrls: ['../../shared/reportes-tokens.scss'],
  styles: [`
    /* ── Cabecera ──────────────────────────────────────────────────────
       El nombre es el contenido de esta pantalla: se le da el peso de un
       título, con las señas debajo como anotaciones al margen. */
    .titulo-persona {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.75rem;
      line-height: 1.05;
      letter-spacing: -0.035em;
      color: var(--txt-1);
    }
    .senas { display: flex; align-items: center; gap: 0.625rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .sena {
      font-size: 0.6875rem;
      letter-spacing: 0.02em;
      color: var(--txt-3);
    }
    .sena .cifra { font-family: var(--font-mono); color: var(--txt-2); }
    /* Punto medio como separador: menos ruido que una píldora por dato. */
    .senas .sena + .sena::before {
      content: '·';
      margin-right: 0.625rem;
      color: var(--linea);
    }
    .sena-acento { color: var(--acento); }

    /* ── Controles ─────────────────────────────────────────────────── */
    .control {
      height: 2.25rem;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding-inline: 0.75rem;
      border: 1px solid var(--linea);
      border-radius: 0.5rem;
      background: var(--superficie);
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--txt-2);
      transition: border-color 140ms var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1)),
                  color 140ms var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1)),
                  transform 140ms var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1));
    }
    .control:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; border-color: transparent; }
    @media (hover: hover) and (pointer: fine) {
      .control:hover { border-color: var(--txt-4); color: var(--txt-1); }
    }
    .control-icono { width: 2.25rem; padding-inline: 0; justify-content: center; }
    .control-icono:active { transform: scale(0.94); }

    /* ── Paneles ───────────────────────────────────────────────────────
       Un filete, sin sombra: el contenido es lo que separa, no el relieve. */
    .panel {
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      background: var(--superficie);
      overflow: hidden;
    }
    .panel-titulo {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--txt-3);
    }
    .panel-apostilla {
      font-size: 0.8125rem;
      line-height: 1.5;
      max-width: 60ch;
      color: var(--txt-1);
      margin-top: 0.125rem;
    }

    /* ── Recuadro de pauta ─────────────────────────────────────────────
       Lo importante son las tres cifras, no el color del recuadro: el
       fondo se queda neutro y el acento va sobre los números. */
    .pauta { display: flex; align-items: baseline; gap: 0.5rem 1.5rem; flex-wrap: wrap; }
    /* Ancho justo para que la frase entre en una línea en portátil: dejar
       "40.5 h/mes" huérfano en un segundo renglón la afea sin motivo. */
    .pauta-texto { font-size: 0.875rem; line-height: 1.65; color: var(--txt-2); max-width: 90ch; }
    .pauta-texto strong {
      font-family: var(--font-mono);
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--txt-1);
      /* Una cifra y su unidad no se parten entre dos líneas. */
      white-space: nowrap;
    }
    .pauta-texto .clave { color: var(--aviso); }
    .pauta-texto.al-dia .clave { color: var(--pos); }
    .pauta-nota { display: block; margin-top: 0.375rem; font-size: 0.75rem; color: var(--txt-4); }
    /* Énfasis sobre texto, no sobre cifras: hereda la tipografía del párrafo y
       vuelve a permitir el salto de línea que <strong> desactiva para números. */
    .pauta-texto .frase {
      font-family: inherit;
      letter-spacing: normal;
      white-space: normal;
    }

    /* Consideración especial: el panel es informativo, nunca una alarma. */
    .panel-exento { border-color: color-mix(in oklch, var(--exento) 35%, var(--linea)); }
    .panel-exento .clave { color: var(--exento); }

    /* ── Tabla de actividad mensual ────────────────────────────────── */
    /* Anchos fijos: las cinco columnas de cifras tienen tamaño conocido y
       Observaciones absorbe lo que sobre. Así la tabla nunca desborda su
       panel, mida lo que mida la ventana. */
    .tabla { border-collapse: separate; border-spacing: 0; width: 100%; table-layout: fixed; }
    .tabla th:nth-child(1) { width: 5.25rem; }
    .tabla th:nth-child(2) { width: 3.75rem; }
    .tabla th:nth-child(3) { width: 4.75rem; }
    .tabla th:nth-child(4) { width: 3.5rem; }
    .tabla th:nth-child(5) { width: 4.25rem; }
    .tabla th, .tabla td { padding: 0.5rem 0.75rem; }
    .tabla thead th {
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--txt-4);
      white-space: nowrap;
      background: var(--superficie-alt);
      box-shadow: inset 0 -1px 0 var(--linea);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .tabla tbody td { box-shadow: inset 0 1px 0 var(--linea-suave); }
    .celda-num {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      font-size: 0.75rem;
      letter-spacing: -0.02em;
      color: var(--txt-2);
    }
    .mes { font-size: 0.8125rem; font-weight: 500; color: var(--txt-1); white-space: nowrap; }
    .total { font-weight: 600; color: var(--txt-1); }
    .credito { color: var(--acento); }
    .nulo { color: var(--txt-4); }
    .obs {
      font-size: 0.75rem;
      color: var(--txt-3);
      /* El texto completo sigue disponible en el title. */
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sin-dato { font-size: 0.6875rem; letter-spacing: 0.02em; color: var(--txt-4); }
    .fila-inactiva .mes { color: var(--txt-4); font-weight: 400; }

    /* ── Histórico de años ─────────────────────────────────────────────
       Rejilla real de tres columnas: el año, las horas y el veredicto se
       alinean entre filas en vez de flotar con justify-between. */
    .historico { display: grid; gap: 0.125rem; }
    .historico-fila {
      display: grid;
      grid-template-columns: 1fr auto 5.5rem;
      align-items: baseline;
      gap: 0.75rem;
      padding: 0.4375rem 0;
      box-shadow: inset 0 1px 0 var(--linea-suave);
    }
    .historico-fila:first-child { box-shadow: none; }
    .historico-anio { font-size: 0.8125rem; color: var(--txt-2); }
    .historico-horas { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 0.75rem; color: var(--txt-1); }
    .historico-horas .meta { color: var(--txt-4); }
    .veredicto {
      justify-self: end;
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }
    .veredicto.si { color: var(--pos); }
    .veredicto.no { color: var(--neg); }
    /* Gana sobre .no: un año exento no se juzga, aunque no llegara a la meta. */
    .veredicto.exento, .veredicto.no.exento {
      color: var(--exento);
      letter-spacing: 0.04em;
      text-align: right;
    }

    /* ── Adaptación a portátil ─────────────────────────────────────────
       En un MacBook la pantalla es ancha pero baja. La tabla mensual no
       necesita la mitad del ancho —doce filas y cinco cifras— así que
       cede espacio a la gráfica, que sí lo aprovecha. */
    @media (min-width: 1440px) {
      .rejilla-detalle { grid-template-columns: minmax(0, 0.85fr) minmax(0, 1fr); }
      .titulo-persona { font-size: 1.625rem; }
    }
    @media (min-width: 1680px) {
      .rejilla-detalle { grid-template-columns: minmax(0, 0.8fr) minmax(0, 1fr); }
      .titulo-persona { font-size: 1.875rem; }
    }
    /* Alto acotado, pero con sitio para los doce meses: ver el año entero
       de un vistazo es justamente lo que hace útil este panel. El tope
       sólo actúa si la ventana es más baja de lo normal. */
    @media (min-width: 1440px) {
      .tabla-scroll { max-height: min(62vh, 31rem); overflow: auto; scrollbar-width: thin; }
    }

    .esqueleto { border-radius: 0.75rem; background: color-mix(in oklch, var(--linea) 55%, transparent); }

    @media (prefers-reduced-motion: reduce) {
      .control { transition: none; }
    }
  `],
  template: `
    <div class="p-4 sm:p-6 mbp:py-4 space-y-5 sm:space-y-6 mbp:space-y-4">
      <ng-container *ngIf="data() as d; else loadingTpl">
        <header class="flex items-start justify-between gap-4 flex-wrap">
          <div class="flex items-start gap-3 min-w-0">
            <a [routerLink]="['/reportes/precursores']"
               class="control control-icono mt-1.5"
               aria-label="Volver al análisis de precursores">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </a>
            <div class="min-w-0">
              <h1 class="titulo-persona">{{ d.nombre }}</h1>
              <div class="senas">
                <app-estado-badge [estado]="d.resumen.estado" [motivo]="d.resumen.consideracion?.motivo_label" />
                <span *ngIf="d.grupo" class="sena">{{ d.grupo }}</span>
                <span *ngIf="d.edad != null" class="sena"><span class="cifra">{{ d.edad }}</span> años</span>
                <span *ngIf="d.antiguedad_anios != null" class="sena"
                      [title]="'Precursor(a) regular desde ' + (d.fecha_inicio_precursor | date:'MMM y')">
                  <span class="cifra">{{ d.antiguedad_anios }}</span> años como precursor(a)
                </span>
                <span *ngIf="d.mes_inicio_privilegio" class="sena sena-acento">
                  Nombramiento desde {{ d.mes_inicio_privilegio }}
                </span>
              </div>
            </div>
          </div>
          <label for="anio-servicio-det" class="sr-only">Año de servicio</label>
          <select id="anio-servicio-det" class="control mt-1.5" (change)="cambiarAnio($event)">
            <option *ngFor="let a of d.anios_disponibles" [value]="a" [selected]="a === d.anio_servicio">{{ a - 1 }}–{{ a }}</option>
          </select>
        </header>

        <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
          <app-kpi-card label="Horas acumuladas" [value]="d.resumen.total_anual" [hint]="metaHint()" />
          <app-kpi-card label="Promedio mensual" [value]="d.resumen.promedio" suffix="h" [hint]="d.resumen.exento ? 'sin requisito' : 'meta 50 h/mes'" />
          <app-kpi-card *ngIf="!d.resumen.exento" label="Balance (Acu)" [value]="d.resumen.acu" suffix="h" [hint]="d.resumen.acu < 0 ? 'atrasado vs 50 h/mes' : 'al día vs 50 h/mes'" />
          <app-kpi-card *ngIf="!d.resumen.exento" label="Proyección anual" [value]="d.resumen.proyeccion_anual" suffix="h" [hint]="proyeccionHint()" />
          <app-kpi-card class="col-span-2 sm:col-span-1" label="Cursos bíblicos" [value]="d.resumen.cursos_total" [hint]="'prom ' + d.resumen.cursos_promedio + '/mes'" />
        </div>

        <!-- Consideración especial: reemplaza la pauta de horas, no la acompaña -->
        <div *ngIf="d.resumen.exento && d.resumen.consideracion as c" class="panel px-4 py-3.5 panel-exento">
          <p class="pauta-texto">
            Tiene <strong class="frase">consideración especial</strong> desde
            <strong>{{ c.fecha_inicio | date:'d MMM y' }}</strong> — {{ c.motivo_label }}.
            <strong class="frase clave">No se le aplica el requisito de 50 h/mes ni las 560 h del año.</strong>
            <span class="pauta-nota">
              Conserva el nombramiento de precursor(a) regular. Sus horas se siguen registrando de forma informativa.
              <ng-container *ngIf="c.descripcion"><br>{{ c.descripcion }}</ng-container>
            </span>
          </p>
        </div>

        <div *ngIf="!d.resumen.exento && d.resumen.meses_restantes > 0" class="panel px-4 py-3.5">
          <p class="pauta-texto" [class.al-dia]="d.resumen.estado === 'en_meta'">
            Para llegar a las <strong>{{ d.resumen.meta_prorrateada }} h</strong> de su meta anual le faltan
            <strong class="clave">{{ d.resumen.horas_restantes }} h</strong> en
            <strong>{{ d.resumen.meses_restantes }}</strong> {{ d.resumen.meses_restantes === 1 ? 'mes' : 'meses' }}:
            necesita un promedio de <strong class="clave">{{ d.resumen.promedio_necesario_restante }} h/mes</strong>.
            <span *ngIf="d.resumen.meses_exigibles < d.resumen.meses_vigentes" class="pauta-nota">
              La meta solo cuenta los {{ d.resumen.meses_exigibles }} de {{ d.resumen.meses_vigentes }} meses
              sin consideración especial.
            </span>
            <span *ngIf="d.resumen.meses_exigibles === d.resumen.meses_vigentes && d.resumen.meses_vigentes < 12" class="pauta-nota">
              Meta prorrateada: las 560 h del requisito anual × {{ d.resumen.meses_vigentes }} de los 12 meses
              del año de servicio en que es precursor(a) regular.
            </span>
          </p>
        </div>

        <div class="rejilla-detalle grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div class="panel">
            <div class="px-4 pt-4 pb-3">
              <h3 class="panel-titulo">Actividad mensual</h3>
              <p class="panel-apostilla">Horas informadas, crédito detectado en observaciones y cursos bíblicos.</p>
            </div>
            <div class="tabla-scroll overflow-x-auto">
              <table class="tabla">
                <thead>
                  <tr>
                    <th class="text-left">Mes</th>
                    <th class="text-right">Horas</th>
                    <th class="text-right">Crédito</th>
                    <th class="text-right">Total</th>
                    <th class="text-right">Cursos</th>
                    <th class="text-left">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let m of d.meses" [class.fila-inactiva]="!m.vigente">
                    <td class="mes">{{ m.label }}</td>
                    <ng-container *ngIf="m.vigente && m.informado; else sinDatoTpl">
                      <td class="text-right celda-num">{{ m.horas }}</td>
                      <td class="text-right celda-num" [ngClass]="m.horas_credito > 0 ? 'credito' : 'nulo'">
                        {{ m.horas_credito || '–' }}
                      </td>
                      <td class="text-right celda-num total">{{ m.total }}</td>
                      <td class="text-right celda-num" [ngClass]="m.cursos_biblicos ? '' : 'nulo'">{{ m.cursos_biblicos || '–' }}</td>
                      <td><div class="obs" [title]="m.observaciones ?? ''">{{ m.observaciones ?? '' }}</div></td>
                    </ng-container>
                    <ng-template #sinDatoTpl>
                      <td colspan="5" class="sin-dato">
                        {{ !m.vigente ? 'No era precursor(a) regular' : (esCerrado(d, m) ? 'Sin informe' : 'Mes en curso') }}
                      </td>
                    </ng-template>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="space-y-4">
            <app-chart-card [title]="progresoTitulo()"
                            [subtitle]="progresoSubtitulo()"
                            [option]="progresoOption()"
                            [height]="260" />

            <div *ngIf="d.historico_anios.length" class="panel p-4">
              <h3 class="panel-titulo mb-2.5">Años de servicio anteriores</h3>
              <div class="historico">
                <div *ngFor="let h of d.historico_anios" class="historico-fila">
                  <span class="historico-anio">{{ h.anio_servicio - 1 }}–{{ h.anio_servicio }}</span>
                  <span class="historico-horas">{{ h.total }} <span class="meta">{{ h.exento ? 'h' : '/ ' + h.meta + ' h' }}</span></span>
                  <!-- Un año con consideración especial no se juzga: ni "Cumplió" ni "No llegó" -->
                  <span class="veredicto" [class.si]="h.cumplio && !h.exento" [class.no]="!h.cumplio" [class.exento]="h.exento"
                        [title]="h.exento ? 'Año cubierto por consideración especial: sin requisito de horas' : ''">
                    {{ h.exento ? 'Consideración especial' : (h.cumplio ? 'Cumplió' : 'No llegó') }}
                  </span>
                </div>
              </div>
            </div>

            <app-seguimientos-panel [idPublicador]="d.id_publicador" [seguimientos]="d.seguimientos" />
          </div>
        </div>
      </ng-container>

      <ng-template #loadingTpl>
        <div *ngIf="error(); else skeletonTpl" class="panel px-4 py-3.5 flex items-center gap-3 flex-wrap">
          <span class="pauta-texto">{{ error() }}</span>
          <a [routerLink]="['/reportes/precursores']" class="control">Volver al análisis</a>
        </div>
        <ng-template #skeletonTpl>
          <div class="space-y-5 animate-pulse" aria-label="Cargando detalle" aria-busy="true">
            <div class="h-14 esqueleto w-2/3"></div>
            <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
              <div *ngFor="let i of [1,2,3,4,5]" class="h-[6.5rem] esqueleto"></div>
            </div>
            <div class="rejilla-detalle grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="h-96 esqueleto"></div>
              <div class="h-96 esqueleto"></div>
            </div>
          </div>
        </ng-template>
      </ng-template>
    </div>
  `,
})
export class PrecursorDetallePage {
  private api = inject(ReportesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly data = signal<PrecursorDetalle | null>(null);
  readonly error = signal<string | null>(null);

  readonly progresoOption = computed<EChartsOption | null>(() => {
    const d = this.data();
    if (!d) return null;
    const cerrados = d.meses.filter(m => m.vigente);
    let acumulado = 0;
    let meta = 0;
    const reales: (number | null)[] = [];
    const metas: number[] = [];
    const labels: string[] = [];
    for (const m of cerrados) {
      labels.push(m.label.split(' ')[0]);
      meta += 50;
      metas.push(meta);
      if (this.esCerrado(d, m)) {
        acumulado += m.total;
        reales.push(acumulado);
      } else {
        reales.push(null);
      }
    }
    if (!labels.length) return null;
    return {
      color: ['#6366f1', '#94a3b8'],
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(15,23,42,0.92)', borderWidth: 0, padding: [8, 12], textStyle: { color: '#f1f5f9', fontFamily: 'Manrope, sans-serif', fontSize: 12 } },
      legend: { bottom: 0, itemGap: 28, itemWidth: 16, itemHeight: 9, icon: 'roundRect', textStyle: { color: '#94a3b8', fontFamily: 'Manrope, sans-serif', fontSize: 11 } },
      // `right` deja sitio a la etiqueta de la meta, que antes se salía
      // del área de trazado y pisaba la propia línea.
      grid: { top: 24, right: 56, bottom: 78, left: 48 },
      xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#64748b' } },
      yAxis: { type: 'value', axisLine: { lineStyle: { color: '#cbd5e1' } }, axisLabel: { color: '#64748b' }, splitLine: { lineStyle: { color: 'rgba(148,163,184,0.2)' } } },
      series: [
        {
          name: 'Acumulado', type: 'line', data: reales, symbol: 'circle', symbolSize: 7,
          areaStyle: { opacity: 0.12 }, lineStyle: { width: 2 },
          // Sin requisito no hay línea de meta que dibujar: trazarla sugeriría
          // una exigencia que esta persona no tiene.
          ...(d.resumen.exento ? {} : {
            markLine: {
              silent: true, symbol: 'none' as const,
              label: { formatter: `${d.resumen.meta_prorrateada} h`, position: 'insideEndTop' as const, color: '#64748b' },
              lineStyle: { color: '#f59e0b', type: 'dotted' as const, width: 1.5 },
              data: [{ yAxis: d.resumen.meta_prorrateada }],
            },
          }),
        },
        ...(d.resumen.exento ? [] : [
          { name: 'Ritmo 50 h/mes', type: 'line' as const, data: metas, symbol: 'none' as const, lineStyle: { width: 2, type: 'dashed' as const } },
        ]),
      ],
    };
  });

  proyeccionHint(): string {
    const d = this.data();
    if (!d) return '';
    return d.resumen.proyeccion_anual >= d.resumen.meta_prorrateada ? 'alcanzaría la meta' : 'no alcanzaría la meta';
  }

  /** La meta del gráfico es la prorrateada; se aclara cuando no son 12 meses. */
  progresoSubtitulo(): string {
    const d = this.data();
    if (!d) return '';
    if (d.resumen.exento) return 'Horas acumuladas (pred + crédito) · sin requisito por consideración especial';
    const base = 'Horas acumuladas (pred + crédito) vs ritmo de 50 h/mes';
    return d.resumen.meses_vigentes < 12
      ? `${base} · meta prorrateada a ${d.resumen.meses_vigentes} meses`
      : base;
  }

  /** Título del gráfico: sin meta no se puede hablar de "progreso hacia X h". */
  progresoTitulo(): string {
    const d = this.data();
    if (!d) return 'Progreso';
    return d.resumen.exento
      ? 'Horas acumuladas en el año'
      : `Progreso hacia las ${d.resumen.meta_prorrateada} horas`;
  }

  /** Hint del KPI de horas: deja claro si la meta viene prorrateada. */
  metaHint(): string {
    const d = this.data();
    if (!d) return '';
    if (d.resumen.exento) return 'sin requisito de horas';
    return d.resumen.meses_exigibles < 12
      ? `meta ${d.resumen.meta_prorrateada} h · ${d.resumen.meses_exigibles} meses`
      : `meta ${d.resumen.meta_prorrateada} h`;
  }

  esCerrado(d: PrecursorDetalle, m: { anio: number; mes: number }): boolean {
    const hoy = new Date();
    return new Date(m.anio, m.mes - 1, 1) < new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      const anio = Number(this.route.snapshot.queryParamMap.get('anio')) || undefined;
      if (id) this.cargar(id, anio);
    });
  }

  cargar(id: number, anio?: number): void {
    this.error.set(null);
    this.data.set(null);
    this.api.getPrecursorDetalle(id, anio).subscribe({
      next: (res) => this.data.set(res),
      error: (err) => this.error.set(err?.error?.detail ?? 'No fue posible cargar el detalle.'),
    });
  }

  cambiarAnio(ev: Event): void {
    const anio = Number((ev.target as HTMLSelectElement).value);
    const d = this.data();
    if (!d || !anio || anio === d.anio_servicio) return;
    this.router.navigate([], { relativeTo: this.route, queryParams: { anio }, queryParamsHandling: 'merge' });
    this.cargar(d.id_publicador, anio);
  }
}
