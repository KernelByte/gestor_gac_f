import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChartCardComponent } from '../../shared/chart-card.component';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import { lineMetaOption } from '../../shared/chart-options';
import { MatrizPrecursoresComponent } from './components/matriz-precursores.component';
import { AuthStore } from '../../../../core/auth/auth.store';
import { ReportesService, PrecursoresMatriz, PrecursorFila, ObjetivoPrecursor } from '../../services/reportes.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SelectPickerComponent, PickerOption } from '../../../../shared/components/select-picker/select-picker.component';

/**
 * Análisis de la actividad en el ministerio de los precursores regulares
 * por año de servicio (Sep–Ago).
 *
 * El selector "Objetivo" elige el número anual contra el que se calcula todo:
 * vista del publicador (600 h → 50 h/mes, por defecto) o vista del comité de
 * servicio (560 h, el mínimo para continuar). El objetivo se prorratea por los
 * meses en que cada persona fue precursora regular, de modo que un nombramiento
 * a mitad de año no exige el objetivo entero (columna Total: horas / meta).
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ChartCardComponent, KpiCardComponent, MatrizPrecursoresComponent, PageHeaderComponent, SelectPickerComponent],
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

    /* Selectores de cabecera con el componente propio de la app. Ancho fijo
       para que el desplegable no salte al cambiar la etiqueta. */
    .sel-objetivo { display: block; width: 14rem; }
    .sel-anio { display: block; width: 8.5rem; }
    @media (max-width: 480px) {
      .sel-objetivo, .sel-anio { width: 100%; }
    }
    .icono-busqueda { color: var(--txt-4); }

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
    <!-- Sin padding propio: el margen exterior lo pone el shell una sola vez. -->
    <div class="space-y-5 sm:space-y-6 mbp:space-y-4 mbp16:space-y-5">
      <!-- spacing por defecto (mb-6), no "none": el space-y del contenedor se
           comprime a 16px en pantallas anchas (mbp) y con una entradilla de
           varias líneas las tarjetas quedaban pegadas al párrafo. -->
      <app-page-header
        [eyebrow]="'Año de servicio ' + (anioSeleccionado() ? (anioSeleccionado()! - 1) + '–' + anioSeleccionado() : '')"
        title="Análisis de Precursores"
        [subtitleWide]="true"
        [subtitle]="'Actividad de los precursores regulares: ritmo de ' + ritmoMensual() + ' h/mes y objetivo anual de ' + objetivoAnual() + ' h (con horas acreditadas), prorrateado según los meses de nombramiento de cada persona. ' + (objetivo() === 'comite' ? 'Vista del comité: 560 h es el mínimo para continuar como precursor regular.' : 'Vista del publicador: 600 h (50 h/mes) es la orientación mensual.') + ' Quien tiene consideración especial queda fuera de ese cálculo.'">
        <div class="flex items-center gap-2 flex-wrap">
          <app-select-picker
            class="sel-objetivo"
            [ngModel]="objetivo()"
            (ngModelChange)="seleccionarObjetivo($event)"
            [ngModelOptions]="{ standalone: true }"
            [options]="opcionesObjetivo"
            [clearable]="false"
            [searchable]="false"
            colorScheme="violet"
            ariaLabel="Objetivo del cálculo" />
          <app-select-picker
            class="sel-anio"
            [ngModel]="anioSeleccionado()"
            (ngModelChange)="seleccionarAnio($event)"
            [ngModelOptions]="{ standalone: true }"
            [options]="opcionesAnio()"
            [clearable]="false"
            [searchable]="false"
            colorScheme="violet"
            ariaLabel="Año de servicio" />
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
      </app-page-header>

      <ng-container *ngIf="data() as d; else loadingTpl">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <app-kpi-card *ngFor="let k of d.kpis" [label]="k.label" [value]="k.value" [hint]="k.hint" />
        </div>

        <ng-container *ngIf="d.precursores.length; else emptyTpl">
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

          <app-matriz-precursores
            [filasInput]="filasFiltradas()"
            [meses]="d.meses"
            [objetivoAnual]="d.objetivo_anual"
            [clickable]="puedeGestionar"
            (rowClick)="abrirDetalle($event)" />

          <app-chart-card title="Horas de la congregación por mes"
                          [subtitle]="'Predicación + crédito de los precursores regulares vs meta (' + ritmoMensual() + ' h × precursores vigentes)'"
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
  private route = inject(ActivatedRoute);
  private auth = inject(AuthStore);

  readonly data = signal<PrecursoresMatriz | null>(null);
  readonly error = signal<string | null>(null);
  readonly anioSeleccionado = signal<number>(0);
  readonly objetivo = signal<ObjetivoPrecursor>('publicador');
  readonly filtro = signal('');

  /** Objetivo anual activo (600 publicador / 560 comité). */
  readonly objetivoAnual = computed(() => this.data()?.objetivo_anual ?? 600);
  /** Ritmo mensual derivado del objetivo (50 / 47 h/mes). */
  readonly ritmoMensual = computed(() => Math.round(this.objetivoAnual() / 12));

  readonly puedeGestionar = this.auth.hasPermission('reportes.precursores.gestionar');

  readonly opcionesObjetivo: PickerOption[] = [
    { value: 'publicador', label: 'Vista publicador (600 h)' },
    { value: 'comite', label: 'Comité de servicio (560 h)' },
  ];
  readonly opcionesAnio = computed<PickerOption[]>(() =>
    (this.data()?.anios_disponibles ?? []).map(a => ({ value: a, label: `${a - 1}–${a}` })),
  );

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

  ngOnInit(): void {
    // El año y el objetivo se guardan en la URL para que al volver del detalle
    // (o al recargar) se conserve lo que estaba seleccionado.
    const qp = this.route.snapshot.queryParamMap;
    const obj = qp.get('objetivo') as ObjetivoPrecursor | null;
    if (obj === 'publicador' || obj === 'comite') this.objetivo.set(obj);
    this.cargar(Number(qp.get('anio')) || undefined);
  }

  cargar(anio?: number): void {
    this.error.set(null);
    this.data.set(null);
    this.api.getPrecursores(anio, this.objetivo()).subscribe({
      next: (res) => {
        this.data.set(res);
        this.anioSeleccionado.set(res.anio_servicio);
        this.objetivo.set(res.objetivo);
        this.sincronizarUrl();
      },
      error: (err) => this.error.set(err?.error?.detail ?? 'No fue posible cargar el análisis.'),
    });
  }

  private sincronizarUrl(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { anio: this.anioSeleccionado(), objetivo: this.objetivo() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  seleccionarAnio(v: unknown): void {
    const anio = Number(v);
    if (anio && anio !== this.anioSeleccionado()) this.cargar(anio);
  }

  seleccionarObjetivo(v: unknown): void {
    const obj = v as ObjetivoPrecursor;
    if (obj && obj !== this.objetivo()) {
      this.objetivo.set(obj);
      this.cargar(this.anioSeleccionado() || undefined);
    }
  }

  abrirDetalle(f: PrecursorFila): void {
    this.router.navigate(['/reportes/precursores', f.id_publicador], {
      queryParams: { anio: this.anioSeleccionado(), objetivo: this.objetivo() },
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
    a.download = `precursores_${d.anio_servicio - 1}-${d.anio_servicio}_${d.objetivo}-${d.objetivo_anual}h.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
