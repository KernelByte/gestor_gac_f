import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { EstadoBadgeComponent } from './estado-badge.component';
import type { MesColumna, PrecursorFila } from '../../../services/reportes.service';

type ColumnaOrden = 'nombre' | 'total' | 'acu' | 'estado';

// Orden al pulsar "Estado": primero lo que exige acción. Los exentos van al
// final porque no hay nada que hacer con ellos — no compiten en la escala.
const PESO_ESTADO = { riesgo: 0, atencion: 1, en_meta: 2, exento: 3 } as const;

const OPCIONES_ORDEN: { valor: ColumnaOrden; texto: string }[] = [
  { valor: 'nombre', texto: 'Nombre (A–Z)' },
  { valor: 'estado', texto: 'Estado (primero los que necesitan atención)' },
  { valor: 'acu', texto: 'Balance (primero los más atrasados)' },
  { valor: 'total', texto: 'Horas acumuladas (de más a menos)' },
];

/**
 * Matriz precursor × mes del año de servicio.
 *
 * Un solo marcado, tres presentaciones según el ANCHO DEL CONTENEDOR (no de la
 * ventana: con la barra lateral abierta o cerrada el espacio cambia):
 *
 *  - ≥ 60 rem  · tabla: nombre, 12 meses, total/meta, balance y estado en una
 *                fila. Sin scroll: los meses se estiran para llenar el ancho.
 *  - 36–60 rem · tarjeta con los 12 meses en una fila.
 *  - < 36 rem  · tarjeta con los meses en dos filas de seis (móvil).
 *
 * Cada mes se tiñe según el ritmo mensual (objetivoAnual / 12): verde si lo
 * alcanzó, ámbar si quedó por debajo, rojo con × si no hubo informe. La cifra
 * siempre está escrita, así que el color orienta pero no es el único indicador.
 * La barra bajo "Total" muestra el avance contra la meta individual, que se
 * prorratea por los meses en que la persona fue precursora regular.
 */
@Component({
  selector: 'app-matriz-precursores',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, NgClass, EstadoBadgeComponent],
  styleUrls: ['../../../shared/reportes-tokens.scss'],
  styles: [`
    :host { display: block; }

    .matriz {
      container-type: inline-size;
      container-name: matriz;
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      background: var(--superficie);
      overflow: hidden;
    }

    .matriz-table { width: 100%; border-collapse: separate; border-spacing: 0; }
    .matriz-table thead { display: none; }
    .matriz-table tbody, .matriz-table tfoot { display: block; }
    .matriz-table tr { display: grid; }
    .matriz-table th, .matriz-table td { padding: 0; font-weight: 400; text-align: left; }

    /* ── Ordenar (solo en tarjetas) ────────────────────────────────────
       En tarjeta no hay cabecera donde pulsar, así que el orden se elige en
       un desplegable nativo: en móvil abre el selector del sistema. */
    .barra-orden {
      display: none;
      align-items: center;
      gap: 0.625rem;
      padding: 0.625rem 1rem;
      border-bottom: 1px solid var(--linea);
      background: var(--superficie-alt);
    }
    .barra-orden label {
      flex: none;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--txt-2);
    }
    .barra-orden select {
      flex: 1;
      min-width: 0;
      min-height: 2.75rem;
      padding: 0 0.625rem;
      border: 1px solid var(--linea);
      border-radius: 0.5rem;
      background: var(--superficie);
      font-size: 0.8125rem;
      color: var(--txt-1);
    }
    .barra-orden select:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }

    /* ── Nombre ────────────────────────────────────────────────────── */
    .col-nombre { min-width: 0; }
    .nombre-btn {
      display: block;
      max-width: 100%;
      text-align: left;
      font: inherit;
      color: inherit;
      border-radius: 0.25rem;
      cursor: pointer;
    }
    .nombre-btn:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }
    .nombre-txt {
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 0.875rem;
      font-weight: 600;
      letter-spacing: -0.006em;
      color: var(--txt-1);
    }
    .fila-nombre { display: flex; flex-direction: column; gap: 0.1875rem; min-width: 0; }
    .linea-nombre { display: flex; align-items: center; gap: 0.375rem; min-width: 0; }
    .icono-seg { width: 0.8125rem; height: 0.8125rem; flex: none; color: var(--txt-3); }

    /* Segunda línea: salvedades sobre la meta de la fila. Icono + texto de
       color, sin cajas; si son varias, envuelven. */
    .linea-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      column-gap: 0.625rem;
      row-gap: 0.0625rem;
      font-family: var(--font-mono);
      font-size: 0.6875rem;
      color: var(--txt-3);
    }
    .meta-item { display: inline-flex; align-items: center; gap: 0.1875rem; white-space: nowrap; }
    .meta-item svg { width: 0.6875rem; height: 0.6875rem; flex: none; }
    .meta-desde { color: var(--credito); }
    .meta-consid { color: var(--exento); }

    /* ── Meses ─────────────────────────────────────────────────────────
       Cada celda es un pequeño bloque tintado con la cifra dentro. El tinte
       es el mismo semáforo que el badge de Estado (mismos tokens). */
    .celda-mes {
      --tinte: transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.0625rem;
      min-height: 2.5rem;
      border-radius: 0.375rem;
      background: var(--tinte);
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      color: var(--txt-1);
    }
    .mes-lbl {
      font-size: 0.625rem;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--txt-2);
    }
    .mes-val { font-size: 0.8125rem; font-weight: 500; letter-spacing: -0.02em; line-height: 1.2; }
    .mes-val sup {
      margin-left: 0.0625rem;
      font-size: 0.5625rem;
      letter-spacing: 0;
      color: var(--credito);
      vertical-align: super;
    }
    .c-ok     { --tinte: color-mix(in oklch, var(--pos) 15%, transparent); }
    .c-bajo   { --tinte: color-mix(in oklch, var(--aviso) 18%, transparent); }
    .c-falta  { --tinte: color-mix(in oklch, var(--neg) 12%, transparent); }
    .c-falta .mes-val { color: var(--neg); font-weight: 700; }
    .c-apagado .mes-val { color: var(--txt-3); font-weight: 400; }
    .c-apagado .mes-lbl { color: var(--txt-3); }

    /* ── Total y meta ──────────────────────────────────────────────── */
    .col-total, .col-balance, .col-estado { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .lbl {
      display: block;
      font-size: 0.625rem;
      font-weight: 500;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--txt-2);
    }
    .total-linea { display: flex; align-items: baseline; gap: 0.3125rem; }
    .total-num { font-size: 0.9375rem; font-weight: 700; letter-spacing: -0.02em; color: var(--txt-1); }
    .meta { font-size: 0.75rem; letter-spacing: -0.01em; color: var(--txt-2); }
    .meta.parcial { color: var(--credito); }
    .meta.parcial-consid { color: var(--exento); }
    .meta.sin-meta { font-style: italic; }

    /* Avance contra la meta: una línea fina, no una barra de progreso con
       peso. El color es el del estado; el número ya está escrito al lado. */
    .barra {
      --relleno: var(--pos);
      height: 0.25rem;
      margin-top: 0.3125rem;
      border-radius: 9999px;
      background: color-mix(in oklch, var(--txt-3) 20%, transparent);
      overflow: hidden;
    }
    .barra > i { display: block; height: 100%; border-radius: inherit; background: var(--relleno); }
    .fila-atencion .barra { --relleno: var(--aviso); }
    .fila-riesgo .barra { --relleno: var(--neg); }

    .col-balance { font-size: 0.8125rem; color: var(--txt-2); }
    .col-balance .valor { font-weight: 600; }
    .c-pos { color: var(--pos); }
    .c-neg { color: var(--neg); }
    .c-apagado-txt { color: var(--txt-3); }

    /* ── Fila ──────────────────────────────────────────────────────── */
    tbody tr { border-top: 1px solid var(--linea-suave); }
    tbody tr:first-child { border-top: 0; }
    .clickable tbody tr { cursor: pointer; transition: background-color 120ms var(--ease-out-quart); }
    .clickable tbody tr:focus-within { background: color-mix(in oklch, var(--acento) 5%, transparent); }
    @media (hover: hover) and (pointer: fine) {
      .clickable tbody tr:hover { background: color-mix(in oklch, var(--acento) 5%, transparent); }
      .clickable tbody tr:hover .nombre-txt {
        text-decoration: underline;
        text-decoration-color: color-mix(in oklch, var(--acento) 45%, transparent);
        text-underline-offset: 0.2em;
      }
    }

    tfoot tr { border-top: 1px solid var(--linea); background: var(--superficie-alt); }
    .rotulo-total { font-size: 0.75rem; font-weight: 600; color: var(--txt-1); }
    .celda-pie { font-family: var(--font-mono); font-variant-numeric: tabular-nums; font-size: 0.75rem; color: var(--txt-2); text-align: center; }

    /* ══ Tarjeta (contenedor < 60 rem) ═════════════════════════════════
       Se construye sobre una cuadrícula de 12 columnas: nombre y estado en
       la primera fila, los meses en una sola fila, y total y balance debajo. */
    @container matriz (max-width: 59.99rem) {
      .barra-orden { display: flex; }
      .matriz-table tr {
        grid-template-columns: repeat(12, minmax(0, 1fr));
        gap: 0.375rem 0.25rem;
        padding: 0.875rem 1rem;
        align-items: center;
      }
      .col-nombre  { grid-column: 1 / 10; order: 0; }
      .col-estado  { grid-column: 10 / 13; order: 1; justify-self: end; }
      .celda-mes   { grid-column: span 1; order: 2; }
      .col-total   { grid-column: 1 / 8; order: 3; margin-top: 0.375rem; }
      .col-balance { grid-column: 8 / 13; order: 4; margin-top: 0.375rem; }
      .celda-pie   { display: none; }
      tfoot .col-nombre { grid-column: 1 / 13; }
      tfoot .col-total { grid-column: 1 / 8; margin-top: 0; }
      tfoot .col-balance { grid-column: 8 / 13; margin-top: 0; }
      tfoot .col-estado { display: none; }
    }
    /* Móvil: seis meses por fila para que cada cifra respire (≥ 44 px). */
    @container matriz (max-width: 35.99rem) {
      .matriz-table tr { grid-template-columns: repeat(6, minmax(0, 1fr)); }
      .col-nombre  { grid-column: 1 / 5; }
      .col-estado  { grid-column: 5 / 7; }
      .col-total   { grid-column: 1 / 4; }
      .col-balance { grid-column: 4 / 7; }
      .celda-mes { min-height: 2.75rem; }
      tfoot .col-nombre { grid-column: 1 / 7; }
      tfoot .col-total { grid-column: 1 / 4; }
      tfoot .col-balance { grid-column: 4 / 7; }
    }

    /* ══ Tabla (contenedor ≥ 60 rem) ═══════════════════════════════════
       Nombre elástico, 12 meses elásticos y tres columnas de ancho fijo. */
    @container matriz (min-width: 60rem) {
      .matriz-table thead { display: block; }
      .matriz-table tr {
        grid-template-columns:
          minmax(10.5rem, 2.6fr)
          repeat(12, minmax(1.75rem, 1fr))
          6.5rem 4.5rem 10.5rem;
        column-gap: 0.1875rem;
        align-items: center;
        padding: 0.5rem 0.75rem;
      }
      .col-nombre { padding-right: 0.5rem; }
      .celda-mes { min-height: 2.25rem; }
      .mes-lbl, .lbl { display: none; }
      .col-total { padding-left: 0.75rem; }
      .matriz-table .col-balance { text-align: right; padding-right: 0.5rem; }
      .col-estado { padding-left: 0.25rem; }

      /* Separador de trimestre: un pequeño hueco, no una banda. Los hijos 5,
         8 y 11 son el primer mes de T2, T3 y T4 (el 1 es el nombre). */
      tbody tr > :nth-child(5),  tbody tr > :nth-child(8),  tbody tr > :nth-child(11),
      tfoot tr > :nth-child(5),  tfoot tr > :nth-child(8),  tfoot tr > :nth-child(11),
      thead tr > :nth-child(5),  thead tr > :nth-child(8),  thead tr > :nth-child(11) {
        margin-left: 0.3125rem;
      }

      thead tr {
        padding-block: 0.5rem;
        border-bottom: 1px solid var(--linea);
        background: var(--superficie-alt);
      }
      .matriz-table thead th {
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--txt-2);
        white-space: nowrap;
        text-align: center;
      }
      .matriz-table thead th.col-nombre, .matriz-table thead th.col-estado, .matriz-table thead th.col-total { text-align: left; }
      .matriz-table thead th.col-balance { text-align: right; }
      .matriz-table thead th.mes-abierto { color: var(--txt-3); font-weight: 500; }
      .matriz-table .celda-pie { display: block; }
      tfoot .col-nombre { grid-column: auto; }
      tfoot .col-total, tfoot .col-balance { grid-column: auto; }
      tfoot .col-estado { display: block; }
      tfoot tr { padding-block: 0.625rem; }
    }

    /* Pantallas anchas: el cuerpo gana aire en vez de estirarse. */
    @container matriz (min-width: 90rem) {
      .matriz-table tr { column-gap: 0.375rem; padding-inline: 1.25rem; }
      .celda-mes { min-height: 2.5rem; }
      .mes-val { font-size: 0.875rem; }
    }

    /* ── Orden en cabecera (solo tabla) ────────────────────────────── */
    .orden-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.125rem;
      font: inherit;
      letter-spacing: inherit;
      text-transform: inherit;
      color: inherit;
      cursor: pointer;
      border-radius: 0.25rem;
      transition: color 120ms var(--ease-out-quart);
    }
    .orden-btn:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }
    th[aria-sort='ascending'] .orden-btn,
    th[aria-sort='descending'] .orden-btn { color: var(--txt-1); }
    /* La flecha ocupa sitio siempre: al ordenar, las cabeceras no se mueven. */
    .flecha { display: inline-block; width: 0.75em; text-align: center; }
    .flecha.inactiva { opacity: 0; transition: opacity 120ms var(--ease-out-quart); }
    .orden-btn:focus-visible .flecha.inactiva { opacity: 0.6; }
    @media (hover: hover) and (pointer: fine) {
      .orden-btn:hover { color: var(--txt-1); }
      .orden-btn:hover .flecha.inactiva { opacity: 0.6; }
    }

    @media (prefers-reduced-motion: reduce) {
      .clickable tbody tr, .orden-btn, .flecha.inactiva { transition: none; }
    }
  `],
  template: `
    <div class="matriz" [class.clickable]="clickable">
      <!-- Solo se ve en tarjeta: sustituye a las cabeceras pulsables. -->
      <div class="barra-orden">
        <label for="orden-matriz">Ordenar por</label>
        <select id="orden-matriz" [value]="orden()" (change)="fijarOrden($any($event.target).value)">
          @for (o of opcionesOrden; track o.valor) {
            <option [value]="o.valor">{{ o.texto }}</option>
          }
        </select>
      </div>

      <table class="matriz-table" role="table">
        <caption class="sr-only">
          Horas por mes de cada precursor(a) regular, con el total frente a su meta,
          el balance acumulado y el estado.
        </caption>
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" scope="col" class="col-nombre" [attr.aria-sort]="ariaSort('nombre')">
              <button type="button" class="orden-btn" (click)="ordenarPor('nombre')">
                Precursor(a) <span class="flecha" [class.inactiva]="orden() !== 'nombre'" aria-hidden="true">{{ flecha('nombre') }}</span>
              </button>
            </th>
            @for (m of meses; track m.anio + '-' + m.mes) {
              <th role="columnheader" scope="col" [class.mes-abierto]="!m.cerrado"
                  [attr.title]="m.cerrado ? null : 'Mes aún no cerrado'">{{ m.label }}</th>
            }
            <th role="columnheader" scope="col" class="col-total" [attr.aria-sort]="ariaSort('total')"
                [title]="'Horas del año de servicio (predicación + crédito) y su meta individual: ' + objetivoAnual + ' h prorrateadas según los meses como precursor(a) regular.'">
              <button type="button" class="orden-btn" (click)="ordenarPor('total')">
                Total / meta <span class="flecha" [class.inactiva]="orden() !== 'total'" aria-hidden="true">{{ flecha('total') }}</span>
              </button>
            </th>
            <th role="columnheader" scope="col" class="col-balance" [attr.aria-sort]="ariaSort('acu')"
                [title]="'Balance: horas acumuladas menos ' + ritmoMensual + ' h por cada mes transcurrido. Positivo = va adelantado; negativo = va atrasado.'">
              <button type="button" class="orden-btn" (click)="ordenarPor('acu')">
                Balance <span class="flecha" [class.inactiva]="orden() !== 'acu'" aria-hidden="true">{{ flecha('acu') }}</span>
              </button>
            </th>
            <th role="columnheader" scope="col" class="col-estado" [attr.aria-sort]="ariaSort('estado')">
              <button type="button" class="orden-btn" (click)="ordenarPor('estado')">
                Estado <span class="flecha" [class.inactiva]="orden() !== 'estado'" aria-hidden="true">{{ flecha('estado') }}</span>
              </button>
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          @for (f of filasOrdenadas(); track f.id_publicador) {
            <tr role="row" [ngClass]="'fila-' + f.estado" (click)="clickable && rowClick.emit(f)">
              <th role="rowheader" scope="row" class="col-nombre">
                <div class="fila-nombre">
                  <div class="linea-nombre">
                    @if (clickable) {
                      <button type="button" class="nombre-btn"
                              [attr.aria-label]="'Ver detalle de ' + f.nombre"
                              (click)="$event.stopPropagation(); rowClick.emit(f)">
                        <span class="nombre-txt" [title]="f.nombre">{{ f.nombre }}</span>
                      </button>
                    } @else {
                      <span class="nombre-txt" [title]="f.nombre">{{ f.nombre }}</span>
                    }
                    @if (f.seguimientos_count > 0) {
                      <svg class="icono-seg" role="img" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                           [attr.aria-label]="textoSeguimientos(f.seguimientos_count)">
                        <title>{{ textoSeguimientos(f.seguimientos_count) }}</title>
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M8 10h8m-8 4h5m-9 6V6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H8l-4 3z"/>
                      </svg>
                    }
                  </div>
                  @if (f.antiguedad_anios != null || f.mes_inicio_privilegio || (f.consideracion && !f.exento)) {
                    <div class="linea-meta">
                      @if (f.antiguedad_anios != null) {
                        <span class="meta-item"
                              [title]="'Precursor(a) regular desde hace ' + f.antiguedad_anios + ' años (primer nombramiento, historial completo)'">
                          {{ antiguedadTexto(f.antiguedad_anios) }}
                        </span>
                      }
                      @if (f.mes_inicio_privilegio) {
                        <span class="meta-item meta-desde"
                              [title]="'Nombrado dentro del año de servicio: ' + mesInicioLabel(f.mes_inicio_privilegio)">
                          Desde {{ mesInicioLabel(f.mes_inicio_privilegio) }}
                        </span>
                      }
                      @if (f.consideracion && !f.exento) {
                        <span class="meta-item meta-consid" [title]="tituloConsideracion(f)">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 000-7.8z"/>
                          </svg>
                          Consideración especial
                        </span>
                      }
                    </div>
                  }
                </div>
              </th>

              @for (c of f.meses; track c.anio + '-' + c.mes) {
                <td role="cell" class="celda-mes" [ngClass]="claseCelda(c)"
                    [title]="tituloCelda(c)"
                    [attr.aria-label]="labelMes(c) + ': ' + tituloCelda(c)">
                  <span class="mes-lbl" aria-hidden="true">{{ labelMes(c) }}</span>
                  <span class="mes-val" aria-hidden="true">{{ textoCelda(c) }}@if (c.horas_credito > 0) {<sup>+{{ c.horas_credito }}</sup>}</span>
                </td>
              }

              <td role="cell" class="col-total" [title]="tituloMeta(f) + ' Promedio: ' + (f.promedio | number:'1.0-1') + ' h/mes.'">
                <span class="lbl">Horas / meta</span>
                <div class="total-linea">
                  <span class="total-num">{{ f.total_anual }}</span>
                  @if (!f.exento) {
                    <span class="meta"
                          [class.parcial]="f.meses_exigibles < 12 && !f.consideracion"
                          [class.parcial-consid]="f.meses_exigibles < 12 && !!f.consideracion">/ {{ f.meta_prorrateada }} h</span>
                  } @else {
                    <span class="meta sin-meta">sin meta</span>
                  }
                </div>
                @if (!f.exento) {
                  <div class="barra" aria-hidden="true"><i [style.width.%]="avance(f)"></i></div>
                }
              </td>

              <td role="cell" class="col-balance" [title]="f.exento ? 'No se le aplica el requisito de horas (consideración especial)' : tituloAcu(f.acu, 'en lo que va del año de servicio')">
                <span class="lbl">Balance</span>
                <span class="valor" [ngClass]="f.exento ? 'c-apagado-txt' : claseAcu(f.acu)">{{ f.exento ? '–' : acuTexto(f.acu) }}</span>
              </td>

              <td role="cell" class="col-estado"><app-estado-badge [estado]="f.estado" [motivo]="f.consideracion?.motivo_label" /></td>
            </tr>
          }
        </tbody>
        @if (filas.length > 1) {
          <tfoot role="rowgroup">
            <tr role="row">
              <th role="rowheader" scope="row" class="col-nombre"><span class="rotulo-total">Congregación ({{ filas.length }})</span></th>
              @for (m of meses; track m.anio + '-' + m.mes) {
                <td role="cell" class="celda-pie">{{ totalMes(m) || '·' }}</td>
              }
              <td role="cell" class="col-total" [title]="'Horas de la congregación frente a la suma de las metas individuales prorrateadas.'">
                <span class="lbl">Horas / meta</span>
                <div class="total-linea">
                  <span class="total-num">{{ granTotal() }}</span>
                  <span class="meta">/ {{ granMeta() }} h</span>
                </div>
              </td>
              <td role="cell" class="col-balance">
                <span class="lbl">Balance</span>
                <span class="valor" [ngClass]="claseAcu(granAcu())">{{ acuTexto(granAcu()) }}</span>
              </td>
              <td role="cell" class="col-estado"></td>
            </tr>
          </tfoot>
        }
      </table>
    </div>
  `,
})
export class MatrizPrecursoresComponent {
  @Input() set filasInput(v: PrecursorFila[]) { this._filas.set(v ?? []); }
  @Input() meses: MesColumna[] = [];
  /** Objetivo anual activo (600 vista publicador / 560 vista comité). */
  @Input() objetivoAnual = 600;
  @Input() clickable = false;
  @Output() rowClick = new EventEmitter<PrecursorFila>();

  readonly opcionesOrden = OPCIONES_ORDEN;

  /** Ritmo mensual redondeado, para mostrar: 50 h/mes (600) o 47 h/mes (560). */
  get ritmoMensual(): number { return Math.round(this.objetivoAnual / 12); }

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
        case 'acu': r = a.acu - b.acu; break;
        case 'estado': r = PESO_ESTADO[a.estado] - PESO_ESTADO[b.estado]; break;
        default: r = a.nombre.localeCompare(b.nombre, 'es');
      }
      return r * dir || a.nombre.localeCompare(b.nombre, 'es');
    });
  });

  /** Dirección inicial al elegir una columna: lo más útil primero. */
  private ascendentePorDefecto(col: ColumnaOrden): boolean {
    // Nombre A–Z; balance y estado, primero los peores; horas, de más a menos.
    return col !== 'total';
  }

  ordenarPor(col: ColumnaOrden): void {
    if (this.orden() === col) {
      this.ascendente.update(v => !v);
    } else {
      this.orden.set(col);
      this.ascendente.set(this.ascendentePorDefecto(col));
    }
  }

  /** Desde el desplegable de tarjetas: siempre la dirección por defecto. */
  fijarOrden(col: string): void {
    if (!OPCIONES_ORDEN.some(o => o.valor === col)) return;
    this.orden.set(col as ColumnaOrden);
    this.ascendente.set(this.ascendentePorDefecto(col as ColumnaOrden));
  }

  flecha(col: ColumnaOrden): string {
    return this.orden() === col ? (this.ascendente() ? '↑' : '↓') : '↕';
  }

  /** Valor de aria-sort de una cabecera ordenable (null = sin orden). */
  ariaSort(col: ColumnaOrden): 'ascending' | 'descending' | null {
    return this.orden() === col ? (this.ascendente() ? 'ascending' : 'descending') : null;
  }

  textoSeguimientos(n: number): string {
    return n === 1 ? '1 seguimiento registrado' : `${n} seguimientos registrados`;
  }

  /** Años de precursorado con un decimal: "3.5 años", o "5 años" si es exacto. */
  antiguedadTexto(anios: number): string {
    const texto = anios.toFixed(1).replace(/\.0$/, '');
    return texto === '1' ? '1 año' : `${texto} años`;
  }

  /** "2025-11" → "Nov 2025" usando las etiquetas de las columnas. */
  mesInicioLabel(mesInicio: string): string {
    const [anio, mes] = mesInicio.split('-').map(Number);
    const col = this.meses.find(m => m.anio === anio && m.mes === mes);
    return col ? `${col.label} ${anio}` : mesInicio;
  }

  labelMes(c: PrecursorFila['meses'][number]): string {
    return this.meses.find(m => m.anio === c.anio && m.mes === c.mes)?.label ?? '';
  }

  textoCelda(c: PrecursorFila['meses'][number]): string {
    const col = this.meses.find(m => m.anio === c.anio && m.mes === c.mes);
    if (!c.vigente) return '–';
    if (!col?.cerrado) return '·';
    if (!c.informado) return '×';
    return String(c.horas);
  }

  /**
   * Tinte del mes: ok = alcanzó el ritmo mensual, bajo = quedó por debajo,
   * falta = mes cerrado sin informe. Quien no tiene requisito ese mes
   * (consideración especial) no se juzga: sin tinte.
   */
  claseCelda(c: PrecursorFila['meses'][number]): string {
    const col = this.meses.find(m => m.anio === c.anio && m.mes === c.mes);
    if (!c.vigente || !col?.cerrado) return 'c-apagado';
    // Un mes sin informe deja de ser una falta si no se le exige el requisito
    if (!c.informado) return c.exento ? 'c-apagado' : 'c-falta';
    if (c.exento) return '';
    return c.total >= this.objetivoAnual / 12 ? 'c-ok' : 'c-bajo';
  }

  tituloCelda(c: PrecursorFila['meses'][number]): string {
    const col = this.meses.find(m => m.anio === c.anio && m.mes === c.mes);
    if (!c.vigente) return 'No era precursor(a) regular este mes';
    if (!col?.cerrado) return 'Mes aún no cerrado';
    const exento = c.exento ? ' · Con consideración especial: este mes no exige horas' : '';
    if (!c.informado) return `Sin informe${exento}`;
    const credito = c.horas_credito > 0 ? ` + ${c.horas_credito} h de crédito = ${c.total} h` : '';
    const ritmo = !c.exento
      ? (c.total >= this.objetivoAnual / 12 ? ` · Alcanzó el ritmo de ${this.ritmoMensual} h` : ` · Por debajo del ritmo de ${this.ritmoMensual} h`)
      : '';
    return `${c.horas} h${credito}${c.cursos_biblicos ? ` · ${c.cursos_biblicos} cursos` : ''}${ritmo}${exento}`;
  }

  /** Avance del año contra la meta individual, acotado a 0–100 %. */
  avance(f: PrecursorFila): number {
    if (f.exento || f.meta_prorrateada <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((f.total_anual / f.meta_prorrateada) * 100)));
  }

  acuTexto(acu: number): string {
    return acu > 0 ? `+${acu}` : String(acu);
  }

  tituloAcu(acu: number, contexto: string): string {
    const ritmo = `${this.ritmoMensual} h/mes`;
    if (acu === 0) return `Va exactamente al ritmo de ${ritmo} ${contexto}`;
    return acu > 0
      ? `Lleva ${acu} h por encima del ritmo de ${ritmo} ${contexto}`
      : `Le faltan ${Math.abs(acu)} h para ir al ritmo de ${ritmo} ${contexto}`;
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
   * Texto completo de la consideración especial. La etiqueta va abreviada por
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
      ? `${base}. Meta prorrateada: ${this.objetivoAnual} h × ${f.meses_vigentes} de los 12 meses del año de servicio en que fue precursor(a) regular.`
      : `${base}, el objetivo anual completo (12 meses como precursor(a) regular).`;
  }
}
