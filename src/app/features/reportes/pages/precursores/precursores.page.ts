import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChartCardComponent } from '../../shared/chart-card.component';
import { lineMetaOption } from '../../shared/chart-options';
import { MatrizPrecursoresComponent } from './components/matriz-precursores.component';
import { EstadoBadgeComponent } from './components/estado-badge.component';
import { AuthStore } from '../../../../core/auth/auth.store';
import { ReportesService, KPIItem, PrecursoresMatriz, PrecursorFila, ObjetivoPrecursor, EstadoPrecursor } from '../../services/reportes.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { SelectPickerComponent, PickerOption } from '../../../../shared/components/select-picker/select-picker.component';

type FiltroEstado = 'todos' | EstadoPrecursor;

/** Chips de filtro rápido, en el orden en que el secretario los consulta. */
const CHIPS_ESTADO: { valor: FiltroEstado; texto: string }[] = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'riesgo', texto: 'Riesgo' },
  { valor: 'atencion', texto: 'Atención' },
  { valor: 'en_meta', texto: 'En meta' },
  { valor: 'exento', texto: 'Consideración especial' },
];

/**
 * Análisis de la actividad en el ministerio de los precursores regulares
 * por año de servicio (Sep–Ago).
 *
 * El selector "Objetivo" elige el número anual contra el que se calcula todo:
 * vista del publicador (600 h → 50 h/mes, por defecto) o vista del comité de
 * servicio (560 h, el mínimo para continuar). El objetivo se prorratea por los
 * meses en que cada persona fue precursora regular, de modo que un nombramiento
 * a mitad de año no exige el objetivo entero (columna Total: horas / meta).
 *
 * Estructura: cabecera con el alcance (objetivo + año) → explicación plegable
 * del cálculo → resumen (KPIs) → detalle mes a mes (filtros, leyenda, matriz)
 * → tendencia. Cada bloque responde a una sola pregunta.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, FormsModule, ChartCardComponent, MatrizPrecursoresComponent, EstadoBadgeComponent, PageHeaderComponent, SelectPickerComponent],
  styleUrls: ['../../shared/reportes-tokens.scss'],
  styles: [`
    /* En monitores muy anchos (2K, 4K, 32") el contenido se queda en una
       medida legible y centrada en vez de estirarse de borde a borde. */
    .pagina { max-width: 108rem; margin-inline: auto; width: 100%; }
    /* El host de la cabecera es inline: sin esto, el margen entre bloques no le aplica. */
    app-page-header { display: block; }

    /* ── Controles de cabecera ─────────────────────────────────────────
       Cada selector lleva su rótulo visible: "600 h" sin "Objetivo" encima
       obligaba a abrir el desplegable para saber qué cambiaba. Los controles
       se alinean por abajo para que el botón quede a ras de los selectores. */
    .acciones {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .campo { display: flex; }
    .sel-objetivo { display: block; width: 14.5rem; }
    .sel-anio { display: block; width: 8.5rem; }
    @media (max-width: 479.98px) {
      .acciones { display: grid; grid-template-columns: 1fr; width: 100%; }
      .sel-objetivo, .sel-anio { width: 100%; }
    }

    /* ── Control base ──────────────────────────────────────────────────
       Mismo alto que app-select-picker (2.75rem = 44 px): antes el botón
       medía 36 px y quedaba descolgado junto a los selectores, además de
       quedarse corto como objetivo táctil. */
    .control {
      min-height: 2.75rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding-inline: 0.875rem;
      border: 1px solid var(--linea);
      border-radius: 0.625rem;
      background: var(--superficie);
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--txt-2);
      white-space: nowrap;
      transition: border-color 160ms var(--ease-out-quart),
                  color 160ms var(--ease-out-quart),
                  transform 160ms var(--ease-out-quart);
    }
    .control svg { width: 1rem; height: 1rem; flex: none; }
    .control:focus-visible {
      outline: 2px solid var(--acento);
      outline-offset: 2px;
      border-color: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      .control:hover:not(:disabled) { border-color: var(--txt-4); color: var(--txt-1); }
    }
    .control-boton:active:not(:disabled) { transform: scale(0.97); }
    /* Acción secundaria sin caja: no compite con Exportar ni con los filtros. */
    .control-texto { border-color: transparent; background: transparent; color: var(--txt-2); }
    .control-texto[aria-expanded='true'] { color: var(--acento); }
    .control-boton:disabled { opacity: 0.45; cursor: not-allowed; }

    /* ── Explicación del cálculo ───────────────────────────────────────
       La cabecera dice lo esencial en una frase; el detalle (vistas,
       prorrateo, qué significa cada estado) se abre desde el botón
       "¿Cómo se calcula?" de la sección, sin ocupar una fila fija. */
    .explicacion {
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      background: var(--superficie);
    }
    .explicacion-cuerpo {
      display: grid;
      gap: 1.25rem;
      padding: 1rem 1.25rem 1.125rem;
      animation: aparecer 200ms var(--ease-out-quart) both;
    }
    @media (min-width: 1024px) {
      .explicacion-cuerpo { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 2.5rem; }
    }
    .explicacion-cuerpo h3 {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--txt-3);
      margin-bottom: 0.375rem;
    }
    .explicacion-cuerpo p {
      font-size: 0.8125rem;
      line-height: 1.6;
      color: var(--txt-2);
      max-width: 62ch;
    }
    .explicacion-cuerpo p + p { margin-top: 0.5rem; }
    .explicacion-cuerpo strong { font-weight: 600; color: var(--txt-1); }
    .reglas { display: grid; gap: 0.5rem; }
    .regla {
      display: grid;
      grid-template-columns: 11rem minmax(0, 1fr);
      align-items: baseline;
      gap: 0.75rem;
      font-size: 0.8125rem;
      line-height: 1.5;
      color: var(--txt-2);
    }
    @media (max-width: 479.98px) {
      .regla { grid-template-columns: 1fr; gap: 0.125rem; }
    }

    /* ── Encabezado de sección ─────────────────────────────────────────
       Un filete corto de acento marca dónde empieza cada bloque: es el
       único color "de marca" de la página fuera de lo interactivo. */
    .cabecera-seccion {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    .acciones-seccion { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    @media (max-width: 479.98px) { .acciones-seccion { width: 100%; } .acciones-seccion .control { flex: 1; } }
    .seccion-titulo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.0625rem;
      letter-spacing: -0.015em;
      color: var(--txt-1);
    }
    .seccion-titulo::before {
      content: '';
      width: 0.1875rem;
      height: 1.05em;
      border-radius: 9999px;
      background: var(--acento);
    }
    .seccion-nota {
      margin-top: 0.125rem;
      padding-left: 0.6875rem;
      font-size: 0.75rem;
      color: var(--txt-3);
    }
    .seccion-nota strong { font-weight: 600; color: var(--txt-2); font-variant-numeric: tabular-nums; }

    /* ── Barra de filtros ──────────────────────────────────────────── */
    .barra-filtros {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    @media (min-width: 768px) {
      .barra-filtros { flex-direction: row; align-items: center; }
    }
    .busqueda { position: relative; width: 100%; }
    @media (min-width: 768px) { .busqueda { width: 16rem; flex: none; } }
    .busqueda svg {
      position: absolute;
      left: 0.8125rem;
      top: 50%;
      width: 1rem;
      height: 1rem;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--txt-3);
    }
    .control-busqueda {
      width: 100%;
      justify-content: flex-start;
      padding-left: 2.375rem;
      cursor: text;
    }
    .control-busqueda::placeholder { color: var(--txt-3); }

    /* ── Filtro rápido por estado ──────────────────────────────────────
       El estado vive al fondo de una matriz de 20 columnas; los chips
       convierten "¿quién está en riesgo?" en un clic. Cada chip lleva el
       icono de su estado siempre en color (también inactivo), así se
       reconoce sin leer; el relleno tintado se reserva para el activo. */
    .chips-estado { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .chip-estado {
      --tono: var(--txt-2);
      min-height: 2.25rem;
      display: inline-flex;
      align-items: center;
      gap: 0.4375rem;
      padding-inline: 0.75rem;
      border-radius: 9999px;
      border: 1px solid var(--linea);
      background: var(--superficie);
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--txt-2);
      transition: border-color 160ms var(--ease-out-quart),
                  background-color 160ms var(--ease-out-quart),
                  color 160ms var(--ease-out-quart),
                  transform 160ms var(--ease-out-quart);
    }
    .chip-estado .punto { width: 0.4375rem; height: 0.4375rem; flex: none; border-radius: 9999px; background: var(--tono); }
    .chip-estado .contador {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--txt-3);
    }
    .chip-estado.c-riesgo   { --tono: var(--neg); }
    .chip-estado.c-atencion { --tono: var(--aviso); }
    .chip-estado.c-en_meta  { --tono: var(--pos); }
    .chip-estado.c-exento   { --tono: var(--exento); }
    @media (hover: hover) and (pointer: fine) {
      .chip-estado:hover:not(.activo) { border-color: var(--txt-4); color: var(--txt-1); }
    }
    .chip-estado:active { transform: scale(0.96); }
    .chip-estado:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }
    .chip-estado.activo {
      border-color: color-mix(in oklch, var(--tono) 35%, transparent);
      background: color-mix(in oklch, var(--tono) 12%, transparent);
      color: var(--txt-1);
    }
    .chip-estado.activo .contador { color: var(--txt-2); }
    .chip-estado.c-todos.activo {
      border-color: transparent;
      background: color-mix(in oklch, var(--txt-2) 12%, transparent);
    }

    /* ── Leyenda de símbolos ───────────────────────────────────────────
       ×, –, +n y "/ meta" antes solo se explicaban en tooltips, que no
       existen en pantallas táctiles. Una línea discreta bajo los filtros. */
    .leyenda {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      column-gap: 1rem;
      row-gap: 0.25rem;
      font-size: 0.6875rem;
      color: var(--txt-3);
    }
    .leyenda dt {
      display: inline;
      font-family: var(--font-mono);
      font-weight: 600;
      margin-right: 0.3125rem;
      color: var(--txt-2);
    }
    .leyenda dd { display: inline; }
    .leyenda .item { white-space: nowrap; }
    .leyenda .sim-credito { color: var(--credito); font-size: 0.625rem; vertical-align: super; }
    /* Muestras del tinte de cada mes: la leyenda enseña el código de color
       con las mismas celdas que la matriz, y con la cifra escrita. */
    .leyenda .muestra {
      display: inline-grid;
      place-items: center;
      min-width: 1.75rem;
      height: 1.375rem;
      padding-inline: 0.25rem;
      border-radius: 0.3125rem;
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--txt-1);
    }
    .leyenda .m-ok    { background: color-mix(in oklch, var(--pos) 15%, transparent); }
    .leyenda .m-bajo  { background: color-mix(in oklch, var(--aviso) 18%, transparent); }
    .leyenda .m-falta { background: color-mix(in oklch, var(--neg) 12%, transparent); color: var(--neg); font-weight: 700; }

    /* ── Paneles: vacío y error ────────────────────────────────────── */
    .panel {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.75rem 1.5rem;
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      background: var(--superficie);
    }
    .panel-icono {
      width: 2.5rem;
      height: 2.5rem;
      flex: none;
      display: grid;
      place-items: center;
      border-radius: 9999px;
      color: var(--txt-3);
      background: var(--superficie-alt);
    }
    .panel-icono svg { width: 1.25rem; height: 1.25rem; }
    .panel-error {
      border-color: color-mix(in oklch, var(--neg) 30%, var(--linea));
      background: color-mix(in oklch, var(--neg) 5%, var(--superficie));
    }
    .panel-error .panel-icono {
      color: var(--neg);
      background: color-mix(in oklch, var(--neg) 12%, transparent);
    }
    .vacio-titulo {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.0625rem;
      letter-spacing: -0.02em;
      color: var(--txt-1);
    }
    .vacio-texto {
      margin-top: 0.25rem;
      font-size: 0.8125rem;
      line-height: 1.6;
      max-width: 52ch;
      color: var(--txt-2);
    }
    .vacio-acciones { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.875rem; }
    @media (max-width: 479.98px) {
      .panel { flex-direction: column; padding: 1.25rem; }
      .vacio-acciones .control { width: 100%; }
    }

    /* ── Tarjetas de cifras ────────────────────────────────────────────
       Una tarjeta por cifra, pero planas y bajas: filete de 1 px, sin
       sombra, rótulo en frase normal y la cifra con su apostilla en la misma
       línea. Ocupan ~80 px de alto en vez de los ~130 de la tarjeta estándar. */
    .cifras {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
      gap: 0.75rem;
      margin: 0;
    }
    @media (min-width: 640px) { .cifras { grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr)); gap: 1rem; } }
    .cifra-clave {
      --tono: var(--txt-1);
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      min-width: 0;
      padding: 0.75rem 1rem 0.8125rem;
      border: 1px solid var(--linea);
      border-radius: 0.625rem;
      background: var(--superficie);
    }
    .cifra-clave dt { font-size: 0.75rem; font-weight: 500; line-height: 1.3; color: var(--txt-2); }
    .cifra-clave dd { margin: 0; display: flex; align-items: baseline; flex-wrap: wrap; column-gap: 0.5rem; }
    .cifra-valor {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.75rem;
      line-height: 1.1;
      letter-spacing: -0.03em;
      font-variant-numeric: tabular-nums;
      color: var(--tono);
    }
    .cifra-hint { font-size: 0.75rem; color: var(--txt-3); }
    .cifra-clave.tono-pos    { --tono: var(--pos); }
    .cifra-clave.tono-neg    { --tono: var(--neg); }
    .cifra-clave.tono-exento { --tono: var(--exento); }

    /* ── Fila de KPIs ──────────────────────────────────────────────────
       Hay 4 o 5 tarjetas según haya consideración especial: "auto-fit" con
       "minmax" las mantiene en una fila mientras quepan, sin un breakpoint
       por cada conteo posible. */
    .kpis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
      gap: 0.75rem;
    }
    @media (min-width: 640px) { .kpis-grid { gap: 1rem; } }

    .esqueleto {
      border-radius: 0.75rem;
      background: color-mix(in oklch, var(--linea) 55%, transparent);
    }

    /* ── Movimiento ────────────────────────────────────────────────────
       Una sola entrada al cargar (opacidad + 4 px), para que el cambio de
       año u objetivo se perciba como "datos nuevos" y no como un salto. */
    .aparecer { animation: aparecer 220ms var(--ease-out-quart) both; }
    @keyframes aparecer {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: none; }
    }

    /* Objetivos táctiles de 44 px en pantallas de dedo. */
    @media (pointer: coarse) {
      .chip-estado { min-height: 2.75rem; padding-inline: 0.875rem; }
    }

    @media (prefers-reduced-motion: reduce) {
      .control, .chip-estado, .explicacion .chevron { transition: none; }
      .control-boton:active:not(:disabled), .chip-estado:active { transform: none; }
      .aparecer, .explicacion-cuerpo { animation: none; }
    }
  `],
  template: `
    <!-- Sin padding propio: el margen exterior lo pone el shell una sola vez. -->
    <div class="pagina space-y-5 sm:space-y-6 mbp:space-y-4 mbp16:space-y-5">
      <app-page-header title="Análisis de precursores" spacing="none">
        <div class="acciones">
          <div class="campo">
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
          </div>
          <div class="campo">
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
          </div>
        </div>
      </app-page-header>


      @if (data(); as d) {
        <section class="aparecer" aria-labelledby="titulo-resumen">
          <h2 id="titulo-resumen" class="sr-only">Resumen del año de servicio</h2>
          <dl class="cifras">
            @for (k of d.kpis; track k.label) {
              <div class="cifra-clave" [class]="'cifra-clave ' + (tonoKpi(k) ? 'tono-' + tonoKpi(k) : '')">
                <dt>{{ k.label }}</dt>
                <dd>
                  <span class="cifra-valor">{{ k.value | number:'1.0-1' }}</span>
                  @if (k.hint) { <span class="cifra-hint">{{ k.hint }}</span> }
                </dd>
              </div>
            }
          </dl>
        </section>

        @if (d.precursores.length) {
          <section class="space-y-3 aparecer" aria-labelledby="titulo-detalle">
            <div class="cabecera-seccion">
              <div>
                <h2 id="titulo-detalle" class="seccion-titulo">Detalle mes a mes</h2>
                <p class="seccion-nota" aria-live="polite">
                  @if (hayFiltros()) {
                    Mostrando <strong>{{ filasFiltradas().length }}</strong> de {{ d.precursores.length }} precursores
                  } @else {
                    <strong>{{ d.precursores.length }}</strong> precursores regulares
                  }
                </p>
              </div>
              <div class="acciones-seccion">
                <button type="button" class="control control-boton control-texto"
                        [attr.aria-expanded]="verAyuda()" aria-controls="ayuda-calculo"
                        (click)="verAyuda.set(!verAyuda())">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  ¿Cómo se calcula?
                </button>
                @if (puedeGestionar) {
                  <button type="button"
                          (click)="exportarCsv()"
                          class="control control-boton"
                          title="Descarga la matriz completa del año seleccionado, sin aplicar los filtros">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0 0l-4-4m4 4l4-4"/>
                    </svg>
                    Exportar CSV
                  </button>
                }
              </div>
            </div>

            @if (verAyuda()) {
              <div id="ayuda-calculo" class="explicacion" role="region" aria-label="Cómo se calcula el estado">
            <div class="explicacion-cuerpo">
              <div>
                <h3>Objetivo y meta individual</h3>
                <p>
                  Se suman las horas de predicación y las de crédito. El objetivo anual es de
                  <strong>{{ objetivoAnual() }} h</strong> ({{ ritmoMensual() }} h por mes) y se
                  prorratea: a quien fue nombrado a mitad de año solo se le cuentan sus meses como
                  precursor(a). Esa meta aparece en la columna Total, debajo de las horas.
                </p>
                <p>
                  <strong>Objetivo del publicador (600 h):</strong> la orientación de 50 h al mes.
                  <strong>Mínimo del comité (560 h):</strong> lo necesario para continuar como precursor(a) regular.
                  Quien tiene consideración especial queda fuera del cálculo durante esos meses.
                </p>
              </div>
              <div>
                <h3>Símbolos de la tabla</h3>
                <p>
                  <strong>–</strong> no era precursor(a) ese mes · <strong>+5</strong> junto a una cifra son horas de crédito ·
                  la barra bajo «Total / meta» es el avance del año.
                </p>
                <h3 class="mt-3">Qué significa cada estado</h3>
                <dl class="reglas">
                  <div class="regla">
                    <dt><app-estado-badge [estado]="'en_meta'" /></dt>
                    <dd>El balance acumulado va al ritmo o por encima.</dd>
                  </div>
                  <div class="regla">
                    <dt><app-estado-badge [estado]="'atencion'" /></dt>
                    <dd>Va por debajo del ritmo, hasta 25 h.</dd>
                  </div>
                  <div class="regla">
                    <dt><app-estado-badge [estado]="'riesgo'" /></dt>
                    <dd>Más de 25 h por debajo del ritmo, o dos meses o más sin informe.</dd>
                  </div>
                  <div class="regla">
                    <dt><app-estado-badge [estado]="'exento'" /></dt>
                    <dd>No se le aplica el requisito de horas; conserva el nombramiento.</dd>
                  </div>
                </dl>
              </div>
            </div>
              </div>
            }

            <div class="barra-filtros">
              <div class="busqueda">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/>
                </svg>
                <input type="search"
                       placeholder="Buscar por nombre…"
                       aria-label="Buscar precursor por nombre"
                       class="control control-busqueda"
                       [value]="filtro()"
                       (input)="filtro.set($any($event.target).value)"
                       (keydown.escape)="filtro.set('')" />
              </div>

              <div class="chips-estado" role="group" aria-label="Filtrar por estado">
                @for (c of chips; track c.valor) {
                  @if (c.valor === 'todos' || conteoEstados()[c.valor] || estadoFiltro() === c.valor) {
                    <button type="button"
                            class="chip-estado"
                            [class]="'c-' + c.valor"
                            [class.activo]="estadoFiltro() === c.valor"
                            [attr.aria-pressed]="estadoFiltro() === c.valor"
                            (click)="seleccionarEstado(c.valor)">
                      @if (c.valor !== 'todos') { <span class="punto" aria-hidden="true"></span> }
                      {{ c.texto }} <span class="contador">{{ conteoEstados()[c.valor] }}</span>
                    </button>
                  }
                }
              </div>
            </div>

            <dl class="leyenda" aria-label="Leyenda de la matriz">
              <div class="item"><dt><span class="muestra m-ok" aria-hidden="true">{{ ritmoMensual() }}</span></dt><dd>alcanzó las {{ ritmoMensual() }} h del mes</dd></div>
              <div class="item"><dt><span class="muestra m-bajo" aria-hidden="true">{{ ritmoMensual() - 8 }}</span></dt><dd>quedó por debajo</dd></div>
              <div class="item"><dt><span class="muestra m-falta" aria-hidden="true">×</span></dt><dd>sin informe</dd></div>
            </dl>

            @if (filasFiltradas().length) {
              <app-matriz-precursores
                [filasInput]="filasFiltradas()"
                [meses]="d.meses"
                [objetivoAnual]="d.objetivo_anual"
                [clickable]="puedeGestionar"
                (rowClick)="abrirDetalle($event)" />
            } @else {
              <div class="panel" role="status">
                <span class="panel-icono" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/>
                  </svg>
                </span>
                <div>
                  <p class="vacio-titulo">Ningún precursor coincide</p>
                  <p class="vacio-texto">{{ textoSinCoincidencias() }}</p>
                  <div class="vacio-acciones">
                    <button type="button" class="control control-boton" (click)="limpiarFiltros()">Quitar búsqueda y filtros</button>
                  </div>
                </div>
              </div>
            }
          </section>

          <section class="aparecer" aria-labelledby="titulo-tendencia">
            <h2 id="titulo-tendencia" class="sr-only">Tendencia mensual</h2>
            <app-chart-card title="Horas de los precursores por mes"
                            [subtitle]="'Predicación más crédito de todos los precursores regulares, frente a la meta del mes (' + ritmoMensual() + ' h × precursores con nombramiento ese mes).'"
                            [option]="tendenciaOption()"
                            [height]="300" />
          </section>
        } @else {
          <div class="panel aparecer" role="status">
            <span class="panel-icono" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </span>
            <div>
              <p class="vacio-titulo">Sin precursores regulares en {{ anioSeleccionado() - 1 }}–{{ anioSeleccionado() }}</p>
              <p class="vacio-texto">
                Nadie tuvo nombramiento de precursor(a) regular con actividad en este año de servicio.
                Elige otro año o revisa los nombramientos en Publicadores.
              </p>
              @if (anioAnteriorDisponible()) {
                <div class="vacio-acciones">
                  <button type="button" class="control control-boton" (click)="seleccionarAnio(anioSeleccionado() - 1)">
                    Ver {{ anioSeleccionado() - 2 }}–{{ anioSeleccionado() - 1 }}
                  </button>
                </div>
              }
            </div>
          </div>
        }
      } @else if (error()) {
        <div class="panel panel-error" role="alert">
          <span class="panel-icono" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.3 4.3l-8 14A1.9 1.9 0 004 21h16a1.9 1.9 0 001.7-2.7l-8-14a1.9 1.9 0 00-3.4 0z"/>
            </svg>
          </span>
          <div>
            <p class="vacio-titulo">No se pudo cargar el análisis</p>
            <p class="vacio-texto">{{ error() }} Comprueba la conexión y vuelve a intentarlo; si persiste, avisa al administrador.</p>
            <div class="vacio-acciones">
              <button type="button" class="control control-boton" (click)="cargar(anioSeleccionado() || undefined)">Volver a cargar</button>
            </div>
          </div>
        </div>
      } @else {
        <div class="space-y-5 animate-pulse motion-reduce:animate-none" aria-busy="true">
          <p class="sr-only" role="status">Cargando el análisis de precursores…</p>
          <div class="kpis-grid">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="h-[4.75rem] esqueleto"></div>
            }
          </div>
          <div class="h-[22rem] esqueleto"></div>
          <div class="h-64 esqueleto"></div>
        </div>
      }
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
  readonly estadoFiltro = signal<FiltroEstado>('todos');

  readonly chips = CHIPS_ESTADO;
  /** Panel "¿Cómo se calcula?": plegado por defecto para no empujar los datos. */
  readonly verAyuda = signal(false);

  /** Tono de una cifra clave: solo las que tienen un significado propio. */
  tonoKpi(k: KPIItem): 'pos' | 'neg' | 'exento' | '' {
    const l = k.label.toLowerCase();
    if (l.includes('riesgo')) return k.value > 0 ? 'neg' : '';
    if (l.startsWith('en meta')) return 'pos';
    if (l.includes('consideraci')) return 'exento';
    return '';
  }

  /** Objetivo anual activo (600 publicador / 560 comité). */
  readonly objetivoAnual = computed(() => this.data()?.objetivo_anual ?? (this.objetivo() === 'comite' ? 560 : 600));
  /** Ritmo mensual derivado del objetivo (50 / 47 h/mes). */
  readonly ritmoMensual = computed(() => Math.round(this.objetivoAnual() / 12));

  readonly puedeGestionar = this.auth.hasPermission('reportes.precursores.gestionar');

  readonly opcionesObjetivo: PickerOption[] = [
    { value: 'publicador', label: 'Meta publicador · 600 h' },
    { value: 'comite', label: 'Mínimo comité · 560 h' },
  ];
  readonly opcionesAnio = computed<PickerOption[]>(() =>
    (this.data()?.anios_disponibles ?? []).map(a => ({ value: a, label: `${a - 1}–${a}` })),
  );

  readonly anioAnteriorDisponible = computed(() =>
    (this.data()?.anios_disponibles ?? []).includes(this.anioSeleccionado() - 1),
  );

  /** Solo el filtro de texto: base de los contadores por estado. */
  private readonly filasBuscadas = computed(() => {
    const d = this.data();
    if (!d) return [];
    const q = this.filtro().trim().toLowerCase();
    return q ? d.precursores.filter(f => f.nombre.toLowerCase().includes(q)) : d.precursores;
  });

  /** Cuántas filas de la búsqueda actual caen en cada estado, para los chips. */
  readonly conteoEstados = computed(() => {
    const c: Record<FiltroEstado, number> = { todos: 0, en_meta: 0, atencion: 0, riesgo: 0, exento: 0 };
    for (const f of this.filasBuscadas()) {
      c.todos++;
      c[f.estado]++;
    }
    return c;
  });

  readonly filasFiltradas = computed(() => {
    const base = this.filasBuscadas();
    const ef = this.estadoFiltro();
    return ef === 'todos' ? base : base.filter(f => f.estado === ef);
  });

  readonly hayFiltros = computed(() => !!this.filtro().trim() || this.estadoFiltro() !== 'todos');

  /** Explica qué filtro dejó la tabla vacía, para que se sepa qué quitar. */
  readonly textoSinCoincidencias = computed(() => {
    const q = this.filtro().trim();
    const chip = CHIPS_ESTADO.find(c => c.valor === this.estadoFiltro());
    const estado = chip && chip.valor !== 'todos' ? `en estado «${chip.texto}»` : '';
    if (q && estado) return `No hay nadie llamado «${q}» ${estado}. Cambia la búsqueda o elige otro estado.`;
    if (q) return `No hay ningún precursor(a) cuyo nombre contenga «${q}». Revisa la ortografía o prueba con el apellido.`;
    return `No hay precursores ${estado} este año. Elige otro estado o quita el filtro.`;
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

  seleccionarEstado(e: FiltroEstado): void {
    this.estadoFiltro.set(this.estadoFiltro() === e ? 'todos' : e);
  }

  limpiarFiltros(): void {
    this.filtro.set('');
    this.estadoFiltro.set('todos');
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
