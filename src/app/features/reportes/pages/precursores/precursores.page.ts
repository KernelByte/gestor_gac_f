import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ChartCardComponent } from '../../shared/chart-card.component';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import { lineMetaOption } from '../../shared/chart-options';
import { MatrizPrecursoresComponent } from './components/matriz-precursores.component';
import { AuthStore } from '../../../../core/auth/auth.store';
import { ReportesService, PrecursoresMatriz, PrecursorFila } from '../../services/reportes.service';

/**
 * Análisis de la actividad en el ministerio de los precursores regulares
 * por año de servicio (Sep–Ago): meta 50 h/mes, requisito anual 560 h.
 *
 * El requisito anual se prorratea por los meses en que cada persona fue
 * precursora regular, de modo que un nombramiento a mitad de año no exige
 * las 560 h completas (columna Total: horas / meta).
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ChartCardComponent, KpiCardComponent, MatrizPrecursoresComponent],
  styleUrls: ['../../shared/reportes-tokens.scss'],
  styles: [`
    /* ── Cabecera ──────────────────────────────────────────────────────
       Tres niveles con salto real de tamaño y peso: el rótulo sitúa, el
       título nombra, la entradilla explica. */
    .rotulo-seccion {
      font-family: var(--font-mono);
      font-size: 0.6875rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--txt-4);
      margin-bottom: 0.25rem;
    }
    .titulo-pagina {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.75rem;
      line-height: 1.05;
      letter-spacing: -0.035em;
      color: var(--txt-1);
    }
    .entradilla {
      margin-top: 0.5rem;
      font-size: 0.8125rem;
      line-height: 1.6;
      max-width: 72ch;
      color: var(--txt-3);
    }

    /* ── Controles ─────────────────────────────────────────────────────
       Una sola forma para selector, botón y buscador: mismo alto, mismo
       filete, mismo radio. La coherencia hace más por la sensación de
       acabado que cualquier adorno. */
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
    .control:focus-visible {
      outline: 2px solid var(--acento);
      outline-offset: 2px;
      border-color: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      .control:hover:not(:disabled) { border-color: var(--txt-4); color: var(--txt-1); }
    }
    /* Respuesta al pulsar: el control debe sentirse escuchado. */
    .control-boton:active:not(:disabled) { transform: scale(0.975); }
    .control-boton:disabled { opacity: 0.4; cursor: not-allowed; }
    .control-busqueda { padding-left: 2.25rem; }
    .control-busqueda::placeholder { color: var(--txt-4); }
    .icono-busqueda { color: var(--txt-4); }

    /* ── Leyenda ───────────────────────────────────────────────────────
       Es una clave de lectura, no prosa: los símbolos van en la
       monoespaciada, igual que en la tabla que describen. */
    .leyenda {
      font-size: 0.6875rem;
      line-height: 1.7;
      color: var(--txt-4);
    }
    .leyenda .clave {
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--txt-3);
    }
    /* La clave se tiñe con el mismo token que el chip de la fila: es la pista
       que permite descifrarlo sin tener que pasar el ratón por encima. */
    .leyenda .clave-exento { color: var(--exento); }
    .leyenda .glifo { font-family: var(--font-mono); color: var(--txt-3); }
    .leyenda .sep { color: var(--linea); margin-inline: 0.25rem; }

    /* ── Estado vacío y error ──────────────────────────────────────── */
    .panel {
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      background: var(--superficie);
    }
    .vacio-titulo {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.0625rem;
      letter-spacing: -0.02em;
      color: var(--txt-1);
    }
    .vacio-texto {
      font-size: 0.8125rem;
      line-height: 1.6;
      max-width: 38ch;
      color: var(--txt-3);
    }

    .esqueleto {
      border-radius: 0.75rem;
      background: color-mix(in oklch, var(--linea) 55%, transparent);
    }
    @media (prefers-reduced-motion: reduce) {
      .control { transition: none; }
    }
  `],
  template: `
    <div class="p-4 sm:p-6 mbp:py-4 space-y-5 sm:space-y-6 mbp:space-y-4 mbp16:space-y-5">
      <header class="flex items-end justify-between gap-4 flex-wrap">
        <div class="min-w-0">
          <p class="rotulo-seccion">Año de servicio {{ anioSeleccionado() ? (anioSeleccionado() - 1) + '–' + anioSeleccionado() : '' }}</p>
          <h1 class="titulo-pagina">Análisis de Precursores</h1>
          <p class="entradilla mbp:max-w-2xl mbp16:max-w-4xl">
            Actividad de los precursores regulares: promedio de 50 h/mes y requisito anual de 560 h (con horas acreditadas),
            prorrateado según los meses de nombramiento de cada persona. Quien tiene consideración especial queda fuera de ese cálculo.
          </p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <label for="anio-servicio" class="sr-only">Año de servicio</label>
          <select id="anio-servicio" class="control" (change)="cambiarAnio($event)">
            <option *ngFor="let a of data()?.anios_disponibles ?? []" [value]="a" [selected]="a === anioSeleccionado()">{{ a - 1 }}–{{ a }}</option>
          </select>
          <button *ngIf="puedeGestionar"
                  type="button"
                  (click)="exportarCsv()"
                  [disabled]="!data()?.precursores?.length"
                  class="control control-boton">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4"/>
            </svg>
            Exportar CSV
          </button>
        </div>
      </header>

      <ng-container *ngIf="data() as d; else loadingTpl">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <app-kpi-card *ngFor="let k of d.kpis" [label]="k.label" [value]="k.value" [hint]="k.hint" />
        </div>

        <ng-container *ngIf="d.precursores.length; else emptyTpl">
          <div class="flex items-center justify-between gap-4 flex-wrap">
            <div class="relative w-full sm:w-auto">
              <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none icono-busqueda" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/>
              </svg>
              <input type="search"
                     placeholder="Buscar precursor…"
                     class="control control-busqueda w-full sm:w-56"
                     [value]="filtro()"
                     (input)="filtro.set($any($event.target).value)" />
            </div>
            <p class="leyenda">
              <span class="clave">Total</span> horas <span class="glifo">/</span> meta prorrateada
              <span class="sep">·</span>
              <span class="clave">Balance</span> horas acumuladas <span class="glifo">−</span> 50 h <span class="glifo">×</span> meses como precursor(a)
              <span class="sep">·</span>
              <span class="glifo">×</span> sin informe
              <span class="sep">·</span>
              <span class="glifo">–</span> no era precursor(a)
              <span class="sep">·</span>
              <span class="clave clave-exento">Consideración especial</span> meses sin requisito de horas
              <ng-container *ngIf="otrosHint()"><span class="sep">·</span> {{ otrosHint() }}</ng-container>
            </p>
          </div>

          <app-matriz-precursores
            [filasInput]="filasFiltradas()"
            [meses]="d.meses"
            [clickable]="puedeGestionar"
            (rowClick)="abrirDetalle($event)" />

          <app-chart-card title="Horas de la congregación por mes"
                          subtitle="Predicación + crédito de los precursores regulares vs meta (50 h × precursores vigentes)"
                          [option]="tendenciaOption()"
                          [height]="300" />
        </ng-container>

        <ng-template #emptyTpl>
          <div class="panel flex flex-col items-start justify-center py-14 px-8 gap-2">
            <p class="vacio-titulo">Sin precursores regulares</p>
            <p class="vacio-texto">
              Nadie figura como precursor(a) regular con actividad en {{ anioSeleccionado() - 1 }}–{{ anioSeleccionado() }}.
              Elige otro año de servicio arriba, o revisa los nombramientos en Publicadores.
            </p>
          </div>
        </ng-template>
      </ng-container>

      <ng-template #loadingTpl>
        <div *ngIf="error(); else skeletonTpl" class="panel px-4 py-3.5 flex items-center gap-3 flex-wrap">
          <span class="text-[0.8125rem]" style="color: var(--txt-2)">{{ error() }}</span>
          <button type="button" class="control control-boton" (click)="cargar()">Reintentar</button>
        </div>
        <ng-template #skeletonTpl>
          <div class="space-y-5 animate-pulse" aria-label="Cargando análisis" aria-busy="true">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <div *ngFor="let i of [1,2,3,4]" class="h-[6.5rem] esqueleto"></div>
            </div>
            <div class="h-[22rem] esqueleto"></div>
            <div class="h-64 esqueleto"></div>
          </div>
        </ng-template>
      </ng-template>
    </div>
  `,
})
export class PrecursoresPage {
  private api = inject(ReportesService);
  private router = inject(Router);
  private auth = inject(AuthStore);

  readonly data = signal<PrecursoresMatriz | null>(null);
  readonly error = signal<string | null>(null);
  readonly anioSeleccionado = signal<number>(0);
  readonly filtro = signal('');

  readonly puedeGestionar = this.auth.hasPermission('reportes.precursores.gestionar');

  readonly filasFiltradas = computed(() => {
    const d = this.data();
    if (!d) return [];
    const q = this.filtro().trim().toLowerCase();
    return q ? d.precursores.filter(f => f.nombre.toLowerCase().includes(q)) : d.precursores;
  });

  readonly tendenciaOption = computed(() => {
    const d = this.data();
    return d ? lineMetaOption(d.tendencia_horas, { nombreValor: 'Horas (pred + crédito)' }) : null;
  });

  readonly otrosHint = computed(() => {
    const o = this.data()?.kpis_otros;
    if (!o) return '';
    const partes: string[] = [];
    if (o.auxiliares) partes.push(`${o.auxiliares} aux.`);
    if (o.especiales) partes.push(`${o.especiales} esp.`);
    return partes.length ? `Además: ${partes.join(', ')}` : '';
  });

  ngOnInit(): void {
    this.cargar();
  }

  cargar(anio?: number): void {
    this.error.set(null);
    this.data.set(null);
    this.api.getPrecursores(anio).subscribe({
      next: (res) => {
        this.data.set(res);
        this.anioSeleccionado.set(res.anio_servicio);
      },
      error: (err) => this.error.set(err?.error?.detail ?? 'No fue posible cargar el análisis.'),
    });
  }

  cambiarAnio(ev: Event): void {
    const anio = Number((ev.target as HTMLSelectElement).value);
    if (anio && anio !== this.anioSeleccionado()) this.cargar(anio);
  }

  abrirDetalle(f: PrecursorFila): void {
    this.router.navigate(['/reportes/precursores', f.id_publicador], {
      queryParams: { anio: this.anioSeleccionado() },
    });
  }

  exportarCsv(): void {
    const d = this.data();
    if (!d?.precursores.length) return;
    const sep = ';';
    const cab = [
      'Precursor(a)',
      ...d.meses.map(m => `${m.label} ${m.anio}`),
      'Total', 'Promedio', 'Acu', 'Proyección', 'Meta', 'Meses como precursor(a)',
      'Meses con requisito', 'Consideración especial', 'Cursos', 'Estado',
    ];
    const filas = d.precursores.map(f => [
      f.nombre,
      ...f.meses.map(c => (c.vigente && c.informado ? String(c.total) : '')),
      f.total_anual, f.promedio,
      // Sin requisito no hay balance ni proyección contra meta que exportar
      f.exento ? '' : f.acu,
      f.exento ? '' : f.proyeccion_anual,
      f.exento ? '' : f.meta_prorrateada,
      f.meses_vigentes, f.meses_exigibles,
      f.consideracion?.motivo_label ?? '',
      f.cursos_total,
      f.estado === 'en_meta' ? 'En meta'
        : f.estado === 'atencion' ? 'Atención'
        : f.estado === 'exento' ? 'Consideración especial'
        : 'Riesgo',
    ]);
    const csv = [cab, ...filas]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(sep))
      .join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `precursores_${d.anio_servicio - 1}-${d.anio_servicio}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
