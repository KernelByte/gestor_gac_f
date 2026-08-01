import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EstadoBadgeComponent } from './estado-badge.component';
import type { MesColumna, PrecursorFila } from '../../../services/reportes.service';

type ColumnaOrden = 'nombre' | 'total' | 'promedio' | 'acu' | 'estado';

// Orden al pulsar "Estado": primero lo que exige acción. Los exentos van al
// final porque no hay nada que hacer con ellos — no compiten en la escala.
const PESO_ESTADO = { riesgo: 0, atencion: 1, en_meta: 2, exento: 3 } as const;

/**
 * Matriz precursor × mes del año de servicio (réplica mejorada del Excel):
 * meses agrupados por trimestre con Total/Prom y balance acumulado (Acu)
 * contra el ritmo de 50 h/mes.
 *
 * La columna Total muestra debajo la meta individual, que se prorratea con
 * los meses en que la persona fue precursora regular: a quien fue nombrado
 * en noviembre se le exigen 10/12 de las 560 h, no las 560 completas.
 */
@Component({
  selector: 'app-matriz-precursores',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, EstadoBadgeComponent],
  styles: [`
    :host { display: block; }

    /* ── Paleta del libro mayor ────────────────────────────────────────
       Las superficies base se mantienen idénticas a las del resto de la
       app (blanco / slate-900) para que la tarjeta no desentone junto a
       sus vecinas. Filetes, texto y color semántico sí usan una rampa
       OKLCH: pasos perceptualmente iguales y neutros tintados hacia el
       violeta de marca, que es lo que da cohesión sin llamar la atención.

       Las celdas ancladas (sticky) tapan a las que pasan por debajo, así
       que sus fondos no pueden ser transparentes. */
    .matriz {
      --bg-row:        #ffffff;
      --bg-row-hover:  oklch(97.6% 0.004 295);
      --bg-head:       oklch(99.1% 0.003 295);
      --bg-band:       oklch(98.6% 0.004 295);
      --bg-foot:       oklch(98.2% 0.004 295);

      /* Dos pesos de filete: estructural y separador de filas. */
      --linea:         oklch(91.5% 0.006 295);
      --linea-suave:   oklch(95.5% 0.004 295);

      /* Rampa de texto: del dato principal al apagado. */
      --txt-1:         oklch(27% 0.015 295);
      --txt-2:         oklch(44% 0.012 295);
      --txt-3:         oklch(60% 0.010 295);
      --txt-4:         oklch(76% 0.008 295);

      /* Color semántico: sólo balance, falta de informe y crédito. */
      --pos:           oklch(52% 0.13 162);
      --neg:           oklch(54% 0.19 25);
      --credito:       oklch(52% 0.17 295);

      /* Densidad de celda. Por defecto cómoda (escritorio ancho, tablet). */
      --cell-px: 0.5rem;
      --cell-py: 0.5rem;
      --nombre-px: 0.75rem;
      --nombre-max: 18rem;

      /* Anchos fijos del bloque de métricas anclado a la derecha. */
      --w-total:   3.5rem;
      --w-prom:    3rem;
      --w-balance: 4rem;
      --w-estado:  6.75rem;
    }
    :host-context(.dark) .matriz {
      --bg-row:        #0f172a;
      --bg-row-hover:  oklch(24.5% 0.028 265);
      --bg-head:       oklch(23% 0.028 265);
      --bg-band:       oklch(22.5% 0.028 265);
      --bg-foot:       oklch(23% 0.028 265);

      --linea:         oklch(32% 0.026 265);
      --linea-suave:   oklch(26.5% 0.026 265);

      --txt-1:         oklch(96% 0.006 265);
      --txt-2:         oklch(80% 0.012 265);
      --txt-3:         oklch(64% 0.014 265);
      --txt-4:         oklch(50% 0.014 265);

      /* En oscuro el color se aclara y pierde croma: a alta luminosidad
         el croma alto se vuelve chillón. */
      --pos:           oklch(76% 0.13 162);
      --neg:           oklch(71% 0.14 25);
      --credito:       oklch(73% 0.12 295);
    }

    /* ── MacBook Pro 14" (1512 px de viewport ≈ 1100 px útiles) ────────
       Se compacta el padding y se limita la columna de nombre para que
       los 12 meses + 4 trimestres + métricas quepan de una sola vista. */
    @media (min-width: 1440px) {
      .matriz {
        --cell-px: 0.3125rem;
        --cell-py: 0.4375rem;
        --nombre-px: 0.5rem;
        --nombre-max: 8.5rem;
        --w-total:   3.25rem;
        --w-prom:    2.75rem;
        --w-balance: 3.5rem;
        --w-estado:  5.75rem;
      }
    }

    /* ── MacBook Pro 16" (1728 px ≈ 1316 px útiles) ───────────────────
       Cabe todo con holgura: se devuelve aire a las celdas y al nombre. */
    @media (min-width: 1680px) {
      .matriz {
        --cell-px: 0.4375rem;
        --cell-py: 0.5rem;
        --nombre-px: 0.75rem;
        --nombre-max: 14rem;
        --w-total:   3.75rem;
        --w-prom:    3.25rem;
        --w-balance: 4.25rem;
        --w-estado:  7rem;
      }
    }

    /* ── Región de scroll con alto acotado ─────────────────────────────
       En portátiles la pantalla es ancha pero baja (860–985 px). Sin
       acotar, 33 filas empujan la gráfica a tres pantallas de distancia.
       Con el alto acotado, la tabla se recorre por dentro y la gráfica
       queda siempre a un golpe de scroll. */
    .matriz-scroll {
      overflow: auto;
      overscroll-behavior-x: contain;
      /* Barra delgada: en 14" cada píxel de ancho decide si la matriz
         entra completa o arrastra scroll horizontal. */
      scrollbar-width: thin;
      scrollbar-color: rgb(148 163 184 / 0.5) transparent;
    }
    @media (min-width: 1440px) { .matriz-scroll { max-height: min(59vh, 32rem); } }
    @media (min-width: 1680px) { .matriz-scroll { max-height: min(62vh, 40rem); } }

    .matriz-table { border-collapse: separate; border-spacing: 0; }
    .matriz-table th,
    .matriz-table td {
      padding-inline: var(--cell-px);
      padding-block: var(--cell-py);
    }

    /* ── Tipografía del dato ───────────────────────────────────────────
       Las cifras van en la monoespaciada del sistema (JetBrains Mono) con
       cifras tabulares: las columnas se alinean solas y la tabla deja de
       leerse como una web para leerse como un registro. */
    .celda-num {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      font-size: 0.75rem;
      letter-spacing: -0.02em;
      color: var(--txt-2);
    }
    .celda-num .sup {
      font-size: 0.5625rem;
      letter-spacing: 0;
      color: var(--credito);
      vertical-align: super;
      margin-left: 0.0625rem;
    }

    /* Cabecera: microetiquetas versalitas, no títulos. Anclada arriba,
       separada del cuerpo por un solo filete, sin fondo con peso. */
    .matriz-table thead th {
      position: sticky;
      top: 0;
      z-index: 20;
      background: var(--bg-head);
      box-shadow: inset 0 -1px 0 var(--linea);
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--txt-4);
      white-space: nowrap;
    }
    .mes-abierto { color: color-mix(in oklch, var(--txt-4) 55%, transparent); }
    .matriz-table tfoot td {
      position: sticky;
      bottom: 0;
      z-index: 20;
      background: var(--bg-foot);
      box-shadow: inset 0 1px 0 var(--linea);
      color: var(--txt-1);
    }
    tfoot .rotulo-total {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--txt-2);
    }

    /* Nombre: el único texto con peso de "contenido" en toda la tabla. */
    .col-nombre .nombre-txt {
      font-size: 0.8125rem;
      font-weight: 500;
      letter-spacing: -0.006em;
      color: var(--txt-1);
    }

    /* ── Nombre anclado a la izquierda ─────────────────────────────── */
    .col-nombre {
      position: sticky;
      left: 0;
      padding-inline: var(--nombre-px);
      background: var(--bg-row);
    }
    thead .col-nombre, tfoot .col-nombre { z-index: 30; }
    tbody .col-nombre { z-index: 10; }
    .col-nombre .nombre-txt {
      display: block;
      max-width: var(--nombre-max);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Marca de nombramiento parcial: una anotación al margen, no una
       etiqueta de color. Comparte el violeta del crédito porque ambos
       dicen lo mismo — "esta cifra tiene una salvedad". */
    .chip-desde {
      font-family: var(--font-mono);
      font-size: 0.5625rem;
      letter-spacing: 0.02em;
      color: var(--credito);
      border: 1px solid color-mix(in oklch, var(--credito) 28%, transparent);
      border-radius: 0.25rem;
      padding: 0.0625rem 0.25rem;
      line-height: 1.4;
    }
    /* Misma geometría que .chip-desde: ambos explican por qué la meta de esa
       fila es menor que 560 h, así que deben leerse como el mismo tipo de
       anotación. Sólo cambia el tono, que enlaza con el token de exento. */
    .chip-consid {
      font-family: var(--font-mono);
      font-size: 0.5625rem;
      letter-spacing: 0.02em;
      color: var(--exento);
      border: 1px solid color-mix(in oklch, var(--exento) 30%, transparent);
      border-radius: 0.25rem;
      padding: 0.0625rem 0.25rem;
      line-height: 1.4;
      display: inline-flex;
      align-items: center;
      gap: 0.1875rem;
    }
    .chip-consid svg { width: 0.5625rem; height: 0.5625rem; flex: none; }

    .icono-seg { width: 0.8125rem; height: 0.8125rem; color: var(--txt-4); }

    /* Los chips pierden el prefijo en portátil: el contexto ya los explica y
       la columna gana ~28 px. */
    @media (min-width: 1440px) and (max-width: 1679.98px) {
      .chip-desde-txt { display: none; }
      .chip-consid-txt { display: none; }
    }

    /* ── Métricas ancladas a la derecha ────────────────────────────────
       Total / Prom / Balance / Estado nunca se pierden aunque el bloque
       de meses tenga que desplazarse en la pantalla más estrecha.
       Sólo a partir de 1280 px: por debajo, ese bloque se comería el
       40 % del ancho útil y no dejaría ver ningún mes. */
    .col-total { box-shadow: inset 1px 0 0 var(--linea); }

    @media (min-width: 1280px) {
      .col-total, .col-prom, .col-balance, .col-estado {
        position: sticky;
        background: var(--bg-row);
      }
      thead .col-total, thead .col-prom, thead .col-balance, thead .col-estado,
      tfoot .col-total, tfoot .col-prom, tfoot .col-balance, tfoot .col-estado { z-index: 30; }
      tbody .col-total, tbody .col-prom, tbody .col-balance, tbody .col-estado { z-index: 10; }

      .col-estado  { right: 0; width: var(--w-estado); }
      .col-balance { right: var(--w-estado); width: var(--w-balance); }
      .col-prom    { right: calc(var(--w-estado) + var(--w-balance)); width: var(--w-prom); }
      .col-total   {
        right: calc(var(--w-estado) + var(--w-balance) + var(--w-prom));
        width: var(--w-total);
      }
    }
    thead .col-total { box-shadow: inset 1px 0 0 var(--linea), inset 0 -1px 0 var(--linea); }
    tfoot .col-total { box-shadow: inset 1px 0 0 var(--linea), inset 0 1px 0 var(--linea); }

    /* ── Ritmo trimestral sin cromo ────────────────────────────────────
       El trimestre se marca con un filete suave y un fondo apenas
       perceptible, no con una banda rellena: la retícula debe estructurar
       la lectura, no competir con las cifras. */
    .col-trim { background: var(--bg-band); box-shadow: inset 1px 0 0 var(--linea-suave); }
    thead .col-trim { box-shadow: inset 1px 0 0 var(--linea-suave), inset 0 -1px 0 var(--linea); }
    tfoot .col-trim { box-shadow: inset 1px 0 0 var(--linea-suave), inset 0 1px 0 var(--linea); }
    .col-trim .trim-total { font-weight: 600; color: var(--txt-1); }
    .col-trim .trim-acu,
    .col-total .meta { font-size: 0.625rem; letter-spacing: -0.01em; }
    .col-total .meta { color: var(--txt-4); }
    .col-total .meta.parcial { color: var(--credito); }
    .col-total .meta.parcial-consid { color: var(--exento); }
    /* Con consideración especial no hay meta contra la que comparar; el hueco
       se rotula en vez de dejarse vacío para que no parezca un dato faltante. */
    .col-total .meta.sin-meta { font-style: italic; opacity: 0.75; }
    .col-total .total-num { font-weight: 600; color: var(--txt-1); }

    /* Separadores de fila: un filete suave, sin reglas verticales. */
    tbody td { box-shadow: inset 0 1px 0 var(--linea-suave); }
    tbody td.col-trim { box-shadow: inset 1px 0 0 var(--linea-suave), inset 0 1px 0 var(--linea-suave); }
    tbody td.col-total { box-shadow: inset 1px 0 0 var(--linea), inset 0 1px 0 var(--linea-suave); }

    /* ── Estados del dato ──────────────────────────────────────────── */
    /* Ganan al color heredado de thead/tfoot, que es más específico. */
    .matriz-table .c-dato    { color: var(--txt-2); }
    .matriz-table .c-apagado { color: var(--txt-4); }
    .matriz-table .c-falta   { color: var(--neg); font-weight: 600; }
    .matriz-table .c-pos     { color: var(--pos); }
    .matriz-table .c-neg     { color: var(--neg); }
    .col-balance.c-pos, .col-balance.c-neg { font-weight: 600; }
    /* El pie fija su propio color de texto y es más específico. */
    .matriz-table tfoot td.c-pos { color: var(--pos); }
    .matriz-table tfoot td.c-neg { color: var(--neg); }

    /* ── Interacción ───────────────────────────────────────────────────
       Sólo el fondo cambia: nada se mueve, nada desplaza el layout. */
    .clickable tbody tr { transition: background-color 120ms var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1)); }
    @media (hover: hover) and (pointer: fine) {
      .clickable tbody tr:hover td { background: var(--bg-row-hover); }
      .clickable tbody tr:hover td.col-trim { background: var(--bg-band); }
      th.ordenable:hover { color: var(--txt-2); }
    }

    th.ordenable {
      cursor: pointer;
      user-select: none;
      transition: color 120ms var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1));
    }
    /* La flecha de orden ocupa sitio siempre: al ordenar, las cabeceras
       no deben desplazarse un píxel. */
    .flecha { display: inline-block; width: 0.6em; color: var(--txt-2); }

    @media (prefers-reduced-motion: reduce) {
      .matriz-scroll { scroll-behavior: auto; }
      .clickable tbody tr, th.ordenable { transition: none; }
    }
  `],
  template: `
    <div class="matriz rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
         [class.clickable]="clickable">
      <div class="matriz-scroll">
        <table class="matriz-table min-w-full">
          <thead>
            <tr>
              <th class="col-nombre text-left ordenable min-w-[9rem]"
                  (click)="ordenarPor('nombre')">
                Precursor(a) <span class="flecha">{{ flecha('nombre') }}</span>
              </th>
              <ng-container *ngFor="let t of [0,1,2,3]">
                <th *ngFor="let m of mesesTrimestre(t)"
                    class="text-right"
                    [class.mes-abierto]="!m.cerrado">{{ m.label }}</th>
                <th class="col-trim text-right"
                    [title]="'Trimestre ' + (t + 1) + ': total de horas del trimestre y, debajo, el balance acumulado al cierre (horas − 50 h × meses transcurridos)'">
                  T{{ t + 1 }}
                </th>
              </ng-container>
              <th class="col-total text-right ordenable" (click)="ordenarPor('total')"
                  title="Total de horas del año de servicio (predicación + crédito) y, debajo, la meta individual: 560 h prorrateadas según los meses como precursor(a) regular.">Total <span class="flecha">{{ flecha('total') }}</span></th>
              <th class="col-prom text-right ordenable" (click)="ordenarPor('promedio')"
                  title="Promedio mensual de los meses informados (meta: 50 h/mes)">Prom <span class="flecha">{{ flecha('promedio') }}</span></th>
              <th class="col-balance text-right ordenable" (click)="ordenarPor('acu')"
                  title="Balance acumulado: horas acumuladas (predicación + crédito) menos 50 h por cada mes transcurrido. Positivo = va adelantado a la meta; negativo = va atrasado.">
                Balance <span class="flecha">{{ flecha('acu') }}</span>
              </th>
              <th class="col-estado text-left ordenable" (click)="ordenarPor('estado')">Estado <span class="flecha">{{ flecha('estado') }}</span></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let f of filasOrdenadas(); trackBy: trackFila"
                [class.cursor-pointer]="clickable"
                (click)="clickable && rowClick.emit(f)">
              <td class="col-nombre">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="nombre-txt" [title]="f.nombre">{{ f.nombre }}</span>
                  <span *ngIf="f.mes_inicio_privilegio"
                        class="chip-desde shrink-0"
                        [title]="'Nombrado dentro del año de servicio: ' + mesInicioLabel(f.mes_inicio_privilegio)">
                    <span class="chip-desde-txt">Desde </span>{{ mesInicioLabel(f.mes_inicio_privilegio) }}
                  </span>
                  <!-- Sólo en el caso parcial: si está exento todo el año ya lo
                       dice el badge de Estado y repetirlo recargaría la fila. -->
                  <span *ngIf="f.consideracion && !f.exento"
                        class="chip-consid shrink-0"
                        [title]="tituloConsideracion(f)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round"
                            d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 000-7.8z"/>
                    </svg>
                    <span class="chip-consid-txt">Consideración </span>especial
                  </span>
                  <svg *ngIf="f.seguimientos_count > 0" class="icono-seg shrink-0"
                       viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                       [attr.aria-label]="f.seguimientos_count + ' seguimientos'"
                       title="Tiene seguimientos registrados">
                    <path stroke-linecap="round" stroke-linejoin="round"
                          d="M8 10h8m-8 4h5m-9 6V6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H8l-4 3z"/>
                  </svg>
                </div>
              </td>
              <ng-container *ngFor="let t of [0,1,2,3]">
                <td *ngFor="let c of mesesFilaTrimestre(f, t)"
                    class="text-right celda-num"
                    [ngClass]="claseCelda(c)"
                    [title]="tituloCelda(c)">
                  {{ textoCelda(c) }}<span *ngIf="c.horas_credito > 0" class="sup">+{{ c.horas_credito }}</span>
                </td>
                <td class="col-trim text-right celda-num"
                    [title]="f.exento ? 'Sin requisito de horas (consideración especial)' : tituloAcu(f.trimestres[t].acu, 'al cierre del trimestre ' + (t + 1))">
                  <div class="trim-total">{{ f.trimestres[t].total || '·' }}</div>
                  <div class="trim-acu" [ngClass]="f.exento ? 'c-apagado' : claseAcu(f.trimestres[t].acu)">{{ f.exento ? '–' : acuTexto(f.trimestres[t].acu) }}</div>
                </td>
              </ng-container>
              <td class="col-total text-right celda-num" [title]="tituloMeta(f)">
                <div class="total-num">{{ f.total_anual }}</div>
                <!-- Sin consideración: total / meta. Con consideración: no hay meta que mostrar. -->
                <!-- Dos causas distintas de meta reducida, dos tonos: violeta =
                     nombrado a mitad de año, teal = consideración especial. -->
                <div class="meta" *ngIf="!f.exento"
                     [class.parcial]="f.meses_exigibles < 12 && !f.consideracion"
                     [class.parcial-consid]="f.meses_exigibles < 12 && !!f.consideracion">/ {{ f.meta_prorrateada }}</div>
                <div class="meta sin-meta" *ngIf="f.exento">sin meta</div>
              </td>
              <td class="col-prom text-right celda-num">{{ f.promedio | number:'1.0-1' }}</td>
              <td class="col-balance text-right celda-num" [ngClass]="f.exento ? 'c-apagado' : claseAcu(f.acu)"
                  [title]="f.exento ? 'No se le aplica el requisito de horas (consideración especial)' : tituloAcu(f.acu, 'en lo que va del año de servicio')">{{ f.exento ? '–' : acuTexto(f.acu) }}</td>
              <td class="col-estado"><app-estado-badge [estado]="f.estado" [motivo]="f.consideracion?.motivo_label" /></td>
            </tr>
          </tbody>
          <tfoot *ngIf="filas.length > 1">
            <tr>
              <td class="col-nombre"><span class="rotulo-total">Congregación ({{ filas.length }})</span></td>
              <ng-container *ngFor="let t of [0,1,2,3]">
                <td *ngFor="let m of mesesTrimestre(t)" class="text-right celda-num">
                  {{ totalMes(m) || '·' }}
                </td>
                <td class="col-trim text-right celda-num">
                  <span class="trim-total">{{ totalTrimestre(t) || '·' }}</span>
                </td>
              </ng-container>
              <td class="col-total text-right celda-num"
                  [title]="'Horas de la congregación frente a la suma de las metas individuales prorrateadas.'">
                <div class="total-num">{{ granTotal() }}</div>
                <div class="meta">/ {{ granMeta() }}</div>
              </td>
              <td class="col-prom"></td>
              <td class="col-balance text-right celda-num" [ngClass]="claseAcu(granAcu())">{{ acuTexto(granAcu()) }}</td>
              <td class="col-estado"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `,
})
export class MatrizPrecursoresComponent {
  @Input() set filasInput(v: PrecursorFila[]) { this._filas.set(v ?? []); }
  @Input() meses: MesColumna[] = [];
  @Input() clickable = false;
  @Output() rowClick = new EventEmitter<PrecursorFila>();

  private _filas = signal<PrecursorFila[]>([]);
  readonly orden = signal<ColumnaOrden>('nombre');
  readonly ascendente = signal(true);

  get filas(): PrecursorFila[] { return this._filas(); }

  readonly filasOrdenadas = computed(() => {
    const col = this.orden();
    const dir = this.ascendente() ? 1 : -1;
    return [...this._filas()].sort((a, b) => {
      let r: number;
      switch (col) {
        case 'total': r = a.total_anual - b.total_anual; break;
        case 'promedio': r = a.promedio - b.promedio; break;
        case 'acu': r = a.acu - b.acu; break;
        case 'estado': r = PESO_ESTADO[a.estado] - PESO_ESTADO[b.estado]; break;
        default: r = a.nombre.localeCompare(b.nombre, 'es');
      }
      return r * dir || a.nombre.localeCompare(b.nombre, 'es');
    });
  });

  ordenarPor(col: ColumnaOrden): void {
    if (this.orden() === col) {
      this.ascendente.update(v => !v);
    } else {
      this.orden.set(col);
      // Para métricas, primero los que peor van (más útil para la pauta)
      this.ascendente.set(col === 'nombre' ? true : col !== 'total' && col !== 'promedio');
    }
  }

  flecha(col: ColumnaOrden): string {
    return this.orden() === col ? (this.ascendente() ? '↑' : '↓') : '';
  }

  trackFila = (_: number, f: PrecursorFila) => f.id_publicador;

  /** "2025-11" → "Nov 2025" usando las etiquetas de las columnas. */
  mesInicioLabel(mesInicio: string): string {
    const [anio, mes] = mesInicio.split('-').map(Number);
    const col = this.meses.find(m => m.anio === anio && m.mes === mes);
    return col ? `${col.label} ${anio}` : mesInicio;
  }

  mesesTrimestre(t: number): MesColumna[] {
    return this.meses.slice(t * 3, t * 3 + 3);
  }

  mesesFilaTrimestre(f: PrecursorFila, t: number) {
    return f.meses.slice(t * 3, t * 3 + 3);
  }

  textoCelda(c: PrecursorFila['meses'][number]): string {
    const col = this.meses.find(m => m.anio === c.anio && m.mes === c.mes);
    if (!c.vigente) return '–';
    if (!col?.cerrado) return '';
    if (!c.informado) return '×';
    return String(c.horas);
  }

  claseCelda(c: PrecursorFila['meses'][number]): string {
    const col = this.meses.find(m => m.anio === c.anio && m.mes === c.mes);
    if (!c.vigente || !col?.cerrado) return 'c-apagado';
    // Un mes sin informe deja de ser una falta si no se le exige el requisito
    if (!c.informado) return c.exento ? 'c-apagado' : 'c-falta';
    return 'c-dato';
  }

  tituloCelda(c: PrecursorFila['meses'][number]): string {
    const col = this.meses.find(m => m.anio === c.anio && m.mes === c.mes);
    if (!c.vigente) return 'No era precursor(a) regular este mes';
    if (!col?.cerrado) return 'Mes aún no cerrado';
    const exento = c.exento ? ' · Con consideración especial: este mes no exige horas' : '';
    if (!c.informado) return `Sin informe${exento}`;
    const credito = c.horas_credito > 0 ? ` + ${c.horas_credito} h de crédito = ${c.total} h` : '';
    return `${c.horas} h${credito}${c.cursos_biblicos ? ` · ${c.cursos_biblicos} cursos` : ''}${exento}`;
  }

  acuTexto(acu: number): string {
    return acu > 0 ? `+${acu}` : String(acu);
  }

  tituloAcu(acu: number, contexto: string): string {
    if (acu === 0) return `Va exactamente al ritmo de 50 h/mes ${contexto}`;
    return acu > 0
      ? `Lleva ${acu} h por encima del ritmo de 50 h/mes ${contexto}`
      : `Le faltan ${Math.abs(acu)} h para ir al ritmo de 50 h/mes ${contexto}`;
  }

  claseAcu(acu: number): string {
    return acu < 0 ? 'c-neg' : 'c-pos';
  }

  totalMes(m: MesColumna): number {
    return this._filas().reduce((s, f) => {
      const c = f.meses.find(x => x.anio === m.anio && x.mes === m.mes);
      return s + (c && c.vigente ? c.total : 0);
    }, 0);
  }

  totalTrimestre(t: number): number {
    return this._filas().reduce((s, f) => s + (f.trimestres[t]?.total ?? 0), 0);
  }

  granTotal(): number {
    return this._filas().reduce((s, f) => s + f.total_anual, 0);
  }

  granAcu(): number {
    return this._filas().reduce((s, f) => s + f.acu, 0);
  }

  granMeta(): number {
    return this._filas().reduce((s, f) => s + f.meta_prorrateada, 0);
  }

  /**
   * Texto completo del chip de consideración especial. El chip va abreviado por
   * densidad, así que el tooltip carga el motivo y el recuento de meses: es lo
   * que explica por qué la meta de esa fila no son 560 h.
   */
  tituloConsideracion(f: PrecursorFila): string {
    const c = f.consideracion;
    if (!c) return '';
    const motivo = c.motivo_label ? ` (${c.motivo_label})` : '';
    const hasta = c.fecha_fin ? ` hasta ${this.fechaCorta(c.fecha_fin)}` : '';
    const eximidos = f.meses_vigentes - f.meses_exigibles;
    return `Consideración especial${motivo} desde ${this.fechaCorta(c.fecha_inicio)}${hasta}. `
      + `${eximidos} de sus ${f.meses_vigentes} meses no exigen horas, así que la meta del año `
      + `baja a ${f.meta_prorrateada} h.`;
  }

  private fechaCorta(iso: string): string {
    const [a, m, d] = iso.split('-').map(Number);
    return new Date(a, m - 1, d).toLocaleDateString('es', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  /**
   * Explica de dónde sale la meta de la fila. Para quien fue nombrado a mitad
   * del año de servicio la meta es menor, y conviene que se vea el porqué.
   */
  tituloMeta(f: PrecursorFila): string {
    if (f.exento) {
      const motivo = f.consideracion?.motivo_label ? ` (${f.consideracion.motivo_label})` : '';
      return `${f.total_anual} h acumuladas. Con consideración especial${motivo}: no se le aplica el requisito de horas.`;
    }
    const base = `${f.total_anual} h acumuladas (predicación + crédito) de una meta de ${f.meta_prorrateada} h`;
    if (f.meses_exigibles < f.meses_vigentes) {
      return `${base}. La meta solo cuenta los ${f.meses_exigibles} de ${f.meses_vigentes} meses sin consideración especial.`;
    }
    return f.meses_vigentes < 12
      ? `${base}. Meta prorrateada: 560 h × ${f.meses_vigentes} de los 12 meses del año de servicio en que fue precursor(a) regular.`
      : `${base}, el requisito anual completo (12 meses como precursor(a) regular).`;
  }
}
