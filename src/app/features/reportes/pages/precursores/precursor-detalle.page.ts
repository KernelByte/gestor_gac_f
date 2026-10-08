import { ChangeDetectionStrategy, Component, HostListener, ViewChild, computed, inject, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { EChartsOption } from 'echarts';
import { ChartCardComponent } from '../../shared/chart-card.component';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import { EstadoBadgeComponent } from './components/estado-badge.component';
import { SeguimientosPanelComponent } from './components/seguimientos-panel.component';
import { ReportesService, PrecursorDetalle, ObjetivoPrecursor } from '../../services/reportes.service';
import { SelectPickerComponent, PickerOption } from '../../../../shared/components/select-picker/select-picker.component';

/** Qué cuenta el recuadro de situación, y en qué tono. */
type Situacion =
  | { tipo: 'exento' }
  | { tipo: 'pendiente'; tono: 'pos' | 'aviso' | 'neg' }
  | { tipo: 'alcanzada' };

/**
 * Detalle individual de un precursor regular: matriz mensual, progreso hacia el
 * objetivo anual (600 h vista publicador / 560 h vista comité, prorrateado),
 * histórico de años anteriores y seguimientos.
 *
 * Orden de lectura: dónde estoy (volver / anterior / siguiente) → quién es y
 * en qué estado está → qué le falta (situación) → cifras → mes a mes, gráfica,
 * seguimiento e histórico. La acción frecuente (registrar un seguimiento)
 * está en la cabecera, sin tener que bajar hasta el panel.
 */
@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NgTemplateOutlet, FormsModule, RouterLink, ChartCardComponent, KpiCardComponent, EstadoBadgeComponent, SeguimientosPanelComponent, SelectPickerComponent],
  styleUrls: ['../../shared/reportes-tokens.scss'],
  styles: [`
    /* ── Barra de navegación ───────────────────────────────────────────
       Antes "volver" y "anterior" eran dos botones con la misma flecha,
       uno al lado del otro. Ahora volver es un enlace con texto (dice a
       dónde lleva) y anterior/siguiente forman un paginador aparte. */
    .barra-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
    }
    .enlace-volver {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      min-height: 2.75rem;
      padding-right: 0.5rem;
      border-radius: 0.5rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--txt-2);
      transition: color 160ms var(--ease-out-quart);
    }
    .enlace-volver svg { width: 1rem; height: 1rem; flex: none; transition: transform 160ms var(--ease-out-quart); }
    .enlace-volver:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }
    @media (hover: hover) and (pointer: fine) {
      .enlace-volver:hover { color: var(--acento); }
      .enlace-volver:hover svg { transform: translateX(-2px); }
    }

    .enlace-volver { margin-right: auto; }

    /* ── Búsqueda de precursor ─────────────────────────────────────────
       Un combobox: escribir filtra el roster del año y Enter (o un clic)
       salta a esa persona conservando año y objetivo. */
    .buscador { position: relative; width: 100%; order: 3; }
    @media (min-width: 640px) { .buscador { width: 14rem; order: 0; } }
    .buscador > svg {
      position: absolute; left: 0.75rem; top: 50%;
      width: 0.9375rem; height: 0.9375rem;
      transform: translateY(-50%); pointer-events: none; color: var(--txt-3);
    }
    .control.buscador-campo { width: 100%; justify-content: flex-start; padding-left: 2.125rem; cursor: text; }
    .buscador-campo::placeholder { color: var(--txt-3); }
    /* El anillo de foco va por dentro: el contenedor de la página recorta
       (overflow) todo lo que sobresale, y el campo está pegado al borde. */
    .control.buscador-campo:focus-visible {
      outline: none;
      border-color: var(--acento);
      box-shadow: inset 0 0 0 1px var(--acento);
    }
    .sugerencias {
      position: absolute; z-index: 40; top: calc(100% + 0.25rem); left: 0; right: 0;
      min-width: 15rem; max-height: 15rem; overflow-y: auto; scrollbar-width: thin;
      padding: 0.25rem; list-style: none; margin: 0;
      border: 1px solid var(--linea); border-radius: 0.625rem;
      background: var(--superficie);
      box-shadow: 0 8px 24px -8px color-mix(in oklch, black 35%, transparent);
      animation: aparecer 140ms var(--ease-out-quart) both;
    }
    @media (min-width: 640px) { .sugerencias { left: auto; right: 0; width: 18rem; } }
    .sugerencia {
      display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
      padding: 0.4375rem 0.625rem; border-radius: 0.4375rem;
      font-size: 0.8125rem; color: var(--txt-2); cursor: pointer;
    }
    .sugerencia.activa { background: color-mix(in oklch, var(--acento) 12%, transparent); color: var(--txt-1); }
    .sugerencia.actual { color: var(--txt-3); cursor: default; }
    .sugerencia .aqui { font-size: 0.6875rem; color: var(--txt-3); }
    .sugerencias .sin-resultados { padding: 0.5rem 0.625rem; font-size: 0.8125rem; color: var(--txt-3); }

    .paginador { display: flex; align-items: center; gap: 0.375rem; }
    .nav-contador {
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
      color: var(--txt-3);
      padding-inline: 0.375rem;
      white-space: nowrap;
    }
    .nav-contador strong { font-weight: 600; color: var(--txt-1); }

    /* ── Control base ──────────────────────────────────────────────────
       Mismo alto que app-select-picker (44 px): una sola medida para todo
       lo pulsable de la cabecera. */
    .control {
      min-height: 2.75rem;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      padding-inline: 0.75rem;
      border: 1px solid var(--linea);
      border-radius: 0.625rem;
      background: var(--superficie);
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--txt-2);
      white-space: nowrap;
      transition: border-color 160ms var(--ease-out-quart),
                  color 160ms var(--ease-out-quart),
                  background-color 160ms var(--ease-out-quart),
                  transform 160ms var(--ease-out-quart);
    }
    .control svg { width: 1rem; height: 1rem; flex: none; }
    .control:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; border-color: transparent; }
    @media (hover: hover) and (pointer: fine) {
      .control:not(.nav-off):hover { border-color: var(--txt-4); color: var(--txt-1); }
    }
    .control:not(.nav-off):active { transform: scale(0.97); }
    .nav-off { opacity: 0.35; cursor: not-allowed; }
    .control .texto-nav { display: none; }
    @media (min-width: 640px) { .control .texto-nav { display: inline; } }
    .control-nav { min-width: 2.75rem; }

    .control-primario {
      border-color: transparent;
      background: var(--acento);
      color: #ffffff;
      font-weight: 600;
    }
    :host-context(.dark) .control-primario { color: #0f172a; }
    @media (hover: hover) and (pointer: fine) {
      .control-primario:hover { background: color-mix(in oklch, var(--acento) 88%, black); color: #ffffff; }
      :host-context(.dark) .control-primario:hover { background: color-mix(in oklch, var(--acento) 88%, white); color: #0f172a; }
    }

    /* ── Identidad ─────────────────────────────────────────────────────
       El nombre es el contenido de esta pantalla: se le da el peso de un
       título, con las señas debajo como anotaciones al margen. */
    .identidad {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem 1.5rem;
    }
    .titulo-persona {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.625rem;
      line-height: 1.1;
      letter-spacing: -0.035em;
      color: var(--txt-1);
      overflow-wrap: anywhere;
    }
    @media (min-width: 640px) { .titulo-persona { font-size: 1.75rem; } }
    @media (min-width: 1680px) { .titulo-persona { font-size: 1.875rem; } }
    .senas { display: flex; align-items: center; gap: 0.375rem 0.625rem; flex-wrap: wrap; margin-top: 0.5rem; }
    .sena { font-size: 0.75rem; color: var(--txt-3); }
    .sena .cifra { font-family: var(--font-mono); color: var(--txt-2); }
    /* Punto medio como separador: menos ruido que una píldora por dato. */
    .senas .sena + .sena::before {
      content: '·';
      margin-right: 0.625rem;
      color: var(--txt-4);
    }
    .sena-credito { color: var(--credito); }
    /* El estado es la seña principal: un fondo tintado muy leve lo separa
       de las demás sin convertirlo en un botón de color sólido. */
    .sena-estado {
      display: inline-flex;
      align-items: center;
      padding: 0.1875rem 0.5rem;
      border-radius: 9999px;
      background: color-mix(in oklch, var(--tono) 10%, transparent);
    }
    .tono-pos    { --tono: var(--pos); }
    .tono-aviso  { --tono: var(--aviso); }
    .tono-neg    { --tono: var(--neg); }
    .tono-exento { --tono: var(--exento); }
    .tono-neutro { --tono: var(--txt-3); }

    .acciones { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 0.75rem; }
    .campo { display: flex; flex-direction: column; gap: 0.3125rem; }
    .campo-rotulo {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--txt-3);
    }
    .sel-objetivo { display: block; width: 12.5rem; }
    .sel-anio { display: block; width: 8.5rem; }
    @media (max-width: 639.98px) {
      .acciones { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); width: 100%; }
      .sel-objetivo, .sel-anio { width: 100%; }
      .acciones .campo:first-child, .acciones .control-primario { grid-column: 1 / -1; }
    }
    @media (max-width: 379.98px) {
      .acciones { grid-template-columns: 1fr; }
    }

    /* ── Situación ─────────────────────────────────────────────────────
       La frase más útil de la pantalla ("le faltan X h en Y meses"). Va
       en un recuadro neutro con una franja y un icono del color del
       estado: se orienta con el color, pero se lee en el texto. */
    .situacion {
      --tono: var(--txt-3);
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.5rem 0.875rem;
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      /* Sin franja lateral: el estado lo dan el icono, el título y un borde
         tintado de todo el recuadro. */
      border-color: color-mix(in oklch, var(--tono) 28%, var(--linea));
      background: color-mix(in oklch, var(--tono) 4%, var(--superficie));
    }
    .situacion-icono {
      width: 1.5rem;
      height: 1.5rem;
      flex: none;
      display: grid;
      place-items: center;
      border-radius: 9999px;
      color: var(--tono);
      background: color-mix(in oklch, var(--tono) 12%, transparent);
    }
    .situacion-icono svg { width: 0.8125rem; height: 0.8125rem; }
    .situacion-titulo {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--txt-3);
      margin-bottom: 0;
      line-height: 1.3;
    }
    .pauta-texto { font-size: 0.8125rem; line-height: 1.45; color: var(--txt-2); max-width: 90ch; }
    .pauta-texto strong {
      font-family: var(--font-mono);
      font-weight: 600;
      letter-spacing: -0.02em;
      color: var(--txt-1);
      /* Una cifra y su unidad no se parten entre dos líneas. */
      white-space: nowrap;
    }
    .pauta-texto .clave { color: var(--tono); }
    .pauta-nota { display: block; margin-top: 0.375rem; font-size: 0.75rem; line-height: 1.5; color: var(--txt-3); }
    /* Énfasis sobre texto, no sobre cifras: hereda la tipografía del párrafo y
       vuelve a permitir el salto de línea que <strong> desactiva para números. */
    .pauta-texto .frase { font-family: inherit; letter-spacing: normal; white-space: normal; }

    /* ── Fila de KPIs ──────────────────────────────────────────────────
       3 tarjetas con consideración especial, 5 sin ella: "auto-fit" con
       "minmax" las mantiene en una sola fila mientras quepan. */
    .kpis-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
      gap: 0.5rem;
    }
    @media (min-width: 640px) { .kpis-grid { gap: 0.75rem; } }
    /* Los grupos solo agrupan en escritorio; antes son transparentes. */
    .kpis-grupo { display: contents; }

    /* ── Paneles ───────────────────────────────────────────────────────
       Un filete, sin sombra: el contenido es lo que separa, no el relieve. */
    .panel {
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      background: var(--superficie);
      overflow: hidden;
    }
    .panel-titulo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1rem;
      letter-spacing: -0.015em;
      color: var(--txt-1);
    }
    .panel-titulo::before {
      content: '';
      width: 0.1875rem;
      height: 1.05em;
      border-radius: 9999px;
      background: var(--acento);
    }
    .panel-apostilla {
      font-size: 0.8125rem;
      line-height: 1.5;
      max-width: 60ch;
      color: var(--txt-3);
      margin-top: 0.125rem;
      padding-left: 0.6875rem;
    }

    /* ── Tabla de actividad mensual ────────────────────────────────── */
    /* Anchos fijos: las cinco columnas de cifras tienen tamaño conocido y
       Observaciones absorbe lo que sobre. Así la tabla nunca desborda su
       panel, mida lo que mida la ventana. */
    .tabla { border-collapse: separate; border-spacing: 0; width: 100%; table-layout: fixed; }
    .tabla thead th:nth-child(1) { width: 5.25rem; }
    .tabla thead th:nth-child(2) { width: 3.75rem; }
    .tabla thead th:nth-child(3) { width: 4.75rem; }
    .tabla thead th:nth-child(4) { width: 3.5rem; }
    .tabla thead th:nth-child(5) { width: 4.25rem; }
    .tabla th, .tabla td { padding: 0.5rem 0.75rem; vertical-align: top; }
    .tabla thead th {
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--txt-3);
      white-space: nowrap;
      background: var(--superficie-alt);
      box-shadow: inset 0 -1px 0 var(--linea);
      position: sticky;
      top: 0;
      z-index: 10;
    }
    .tabla tbody td, .tabla tbody th { box-shadow: inset 0 1px 0 var(--linea-suave); }
    .tabla tbody tr:first-child > * { box-shadow: none; }
    .celda-num {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      font-size: 0.75rem;
      letter-spacing: -0.02em;
      color: var(--txt-2);
    }
    .mes { font-size: 0.8125rem; font-weight: 500; color: var(--txt-1); white-space: nowrap; text-align: left; }
    .total { font-weight: 600; color: var(--txt-1); }
    .credito { color: var(--credito); font-weight: 600; }
    .nulo { color: var(--txt-4); }
    /* Dos líneas de observación en vez de una con "…": casi siempre cabe
       la nota entera. El texto completo sigue en el title. */
    .obs {
      font-size: 0.75rem;
      line-height: 1.45;
      color: var(--txt-3);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .sin-dato { font-size: 0.75rem; color: var(--txt-3); }
    .sin-dato .marca { display: inline-flex; align-items: center; gap: 0.3125rem; }
    .sin-dato svg { width: 0.75rem; height: 0.75rem; flex: none; }
    /* Un mes cerrado sin informe es una falta: mismo rojo que la "×" de la matriz. */
    .sin-dato.falta { color: var(--neg); font-weight: 600; }
    .fila-inactiva .mes { color: var(--txt-4); font-weight: 400; }
    .fila-inactiva .sin-dato { color: var(--txt-4); }

    /* ── Tabla de actividad mensual en móvil ─────────────────────────────
       Cinco columnas de cifras + observaciones no caben en 360 px sin un
       scroll horizontal incómodo para leer un solo mes. La misma tabla se
       reacomoda: cada fila pasa a ser una tarjeta y cada celda una línea
       "etiqueta: valor" (la etiqueta sale de data-label). */
    @media (max-width: 639.98px) {
      .tabla-scroll { padding: 0 0.75rem 0.75rem; }
      .tabla, .tabla thead, .tabla tbody, .tabla tr, .tabla th, .tabla td { display: block; }
      .tabla thead { position: static; }
      .tabla thead tr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
      .tabla tbody tr {
        border: 1px solid var(--linea);
        border-radius: 0.625rem;
        padding: 0.625rem 0.75rem;
        margin-block: 0.5rem;
      }
      .tabla tbody tr:first-child { margin-top: 0; }
      .tabla tbody td {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.3125rem 0;
        text-align: right;
        box-shadow: inset 0 1px 0 var(--linea-suave);
      }
      .tabla tbody tr:first-child > td { box-shadow: inset 0 1px 0 var(--linea-suave); }
      .tabla tbody td[data-label]::before {
        content: attr(data-label);
        font-size: 0.625rem;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--txt-3);
        text-align: left;
      }
      .tabla tbody th.mes { font-size: 0.9375rem; padding: 0 0 0.5rem; box-shadow: none; }
      .tabla tbody td.sin-dato { justify-content: flex-start; text-align: left; padding-block: 0.25rem 0; box-shadow: none; }
      /* Observaciones ya no compite por una columna angosta: puede
         envolver en varias líneas. */
      .tabla tbody td[data-label="Observaciones"] { flex-direction: column; align-items: flex-start; gap: 0.1875rem; }
      .tabla tbody .obs { display: block; -webkit-line-clamp: unset; overflow: visible; text-align: left; }
    }


    /* ── Página: columna con separación uniforme ───────────────────────── */
    .pagina { --columnas: minmax(0, 1fr) minmax(0, 1fr); display: flex; flex-direction: column; gap: 0.75rem; }
    @media (min-width: 640px) { .pagina { gap: 1rem; } }
    .columna-der { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
    .inferior { display: flex; flex-direction: column; gap: 1rem; }

    /* ── Ajuste a la ventana ───────────────────────────────────────────
       En una pantalla de escritorio con alto suficiente la página no
       desplaza: cabecera y cifras ocupan lo suyo y el resto se reparte la
       altura que queda. Lo que no cabe (los doce meses, la lista de
       seguimientos) se desplaza dentro de su propio panel. Por debajo de
       1280 px o de 600 px de alto vuelve el flujo normal con desplazamiento
       de página, que es lo correcto en tablet y móvil. */
    @media (min-width: 1280px) and (min-height: 600px) {
      .pagina { flex: 1 1 0; min-height: 0; gap: 0.75rem; }
      /* Identidad y acciones en una sola fila: las señas envuelven si falta ancho. */
      .identidad { flex-wrap: nowrap; align-items: flex-end; }
      .identidad > .min-w-0 { flex: 1 1 0; }
      .acciones { flex: none; flex-wrap: nowrap; }
      .sel-objetivo { width: 11rem; }
      .sel-anio { width: 9rem; }
      .rejilla-detalle {
        grid-template-columns: var(--columnas);
        flex: 1 1 0;
        min-height: 0;
        align-items: stretch;
        grid-template-rows: minmax(0, 1fr);
      }
      .rejilla-detalle > .panel { display: flex; flex-direction: column; min-height: 0; }
      .rejilla-detalle > .panel .tabla-scroll { flex: 1 1 0; min-height: 0; max-height: none; overflow: auto; scrollbar-width: thin; }
      .obs { -webkit-line-clamp: 3; }
      /* Las cifras siguen las mismas dos columnas que la tabla y la gráfica. */
      .kpis-grid { grid-template-columns: var(--columnas); gap: 1rem; }
      .kpis-grupo { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 1rem; }
      .columna-der { min-height: 0; gap: 0.75rem; }
      .columna-der > app-chart-card { flex: 1 1 0; min-height: 11rem; }
      .columna-der:has(app-seguimientos-panel.vacio), .inferior:has(app-seguimientos-panel.vacio) { gap: 0; }
      .inferior {
        flex: 0 1 auto;
        max-height: 45%;
        min-height: 0;
        display: grid;
        grid-template-columns: minmax(0, 1fr);
        grid-auto-rows: minmax(0, 1fr);
        gap: 0.75rem;
      }
      .celda { min-height: 0; overflow: auto; scrollbar-width: thin; border-radius: 0.75rem; }
      .celda:has(> app-seguimientos-panel.vacio) { display: contents; }
      .celda:focus-visible { outline: 2px solid var(--acento); outline-offset: -2px; }
    }
    @media (min-width: 1280px) and (min-height: 600px) and (pointer: fine) {
      .control, .enlace-volver { min-height: 2.25rem; }
      .control-nav { min-width: 2.25rem; }
      .tabla tbody tr { transition: background-color 120ms var(--ease-out-quart); }
      .tabla tbody tr:hover { background: color-mix(in oklch, var(--txt-1) 3%, transparent); }
    }

    /* ── Paneles de error ──────────────────────────────────────────── */
    .panel-error {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      padding: 1.5rem;
      border-color: color-mix(in oklch, var(--neg) 30%, var(--linea));
      background: color-mix(in oklch, var(--neg) 5%, var(--superficie));
    }
    .panel-error .situacion-icono { --tono: var(--neg); width: 2.5rem; height: 2.5rem; }
    .error-titulo {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1.0625rem;
      letter-spacing: -0.02em;
      color: var(--txt-1);
    }
    .error-texto { margin-top: 0.25rem; font-size: 0.8125rem; line-height: 1.6; max-width: 56ch; color: var(--txt-2); }
    @media (max-width: 479.98px) {
      .panel-error { flex-direction: column; padding: 1.25rem; }
    }

    /* ── Adaptación a portátil ─────────────────────────────────────────
       En un MacBook la pantalla es ancha pero baja. La tabla mensual
       lleva las observaciones, que son texto libre, así que recibe más
       ancho que la gráfica. */
    @media (min-width: 1440px) {
      .pagina { --columnas: minmax(0, 1fr) minmax(0, 1fr); }
      .rejilla-detalle { grid-template-columns: var(--columnas); }
      /* Alto acotado, pero con sitio para los doce meses. */
      .tabla-scroll { max-height: min(62vh, 31rem); overflow: auto; scrollbar-width: thin; }
    }
    @media (min-width: 1680px) {
      .pagina { --columnas: minmax(0, 1fr) minmax(0, 1fr); }
      .rejilla-detalle { grid-template-columns: var(--columnas); }
    }
    .tabla-scroll:focus-visible { outline: 2px solid var(--acento); outline-offset: -2px; }

    .esqueleto { border-radius: 0.75rem; background: color-mix(in oklch, var(--linea) 55%, transparent); }

    /* Una sola entrada al cargar (y al cambiar de precursor con ← →): la
       pantalla cambia de contenido, no de sitio. */
    .aparecer { animation: aparecer 220ms var(--ease-out-quart) backwards; }
    @keyframes aparecer {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      .control, .enlace-volver, .enlace-volver svg { transition: none; }
      .control:not(.nav-off):active { transform: none; }
      .enlace-volver:hover svg { transform: none; }
      .aparecer { animation: none; }
    }
  `],
  template: `
    <!-- Sin padding propio: el margen exterior lo pone el shell una sola vez.
         La cabecera NO usa app-page-header a propósito: no es un título de
         pantalla sino de entidad (nombre dinámico + estado + paginador). -->
    <div class="pagina">
      <nav class="barra-nav" aria-label="Navegación entre precursores">
        <a [routerLink]="['/reportes/precursores']"
           [queryParams]="volverQueryParams()"
           class="enlace-volver">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
          </svg>
          Análisis de precursores
        </a>

        @if (data(); as d) {
          <div class="buscador">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/>
            </svg>
            <input type="search" class="control buscador-campo" autocomplete="off"
                   placeholder="Buscar precursor…"
                   aria-label="Buscar otro precursor por nombre"
                   role="combobox" aria-autocomplete="list" aria-controls="lista-precursores"
                   [attr.aria-expanded]="abierto()"
                   [attr.aria-activedescendant]="abierto() && resultados().length ? 'sug-' + activo() : null"
                   [value]="q()"
                   (focus)="abrirBusqueda()"
                   (input)="escribir($any($event.target).value)"
                   (blur)="abierto.set(false)"
                   (keydown)="teclaBusqueda($event)" />
            @if (abierto()) {
              <ul class="sugerencias" id="lista-precursores" role="listbox" aria-label="Precursores">
                @for (r of resultados(); track r.id_publicador; let i = $index) {
                  <li class="sugerencia" role="option" [id]="'sug-' + i"
                      [class.activa]="i === activo()"
                      [class.actual]="r.id_publicador === d.id_publicador"
                      [attr.aria-selected]="i === activo()"
                      (mousedown)="$event.preventDefault(); elegir(r.id_publicador)"
                      (mouseenter)="activo.set(i)">
                    <span>{{ r.nombre }}</span>
                    @if (r.id_publicador === d.id_publicador) { <span class="aqui">aquí</span> }
                  </li>
                } @empty {
                  <li class="sin-resultados" role="option" aria-disabled="true" aria-selected="false">Sin coincidencias</li>
                }
              </ul>
            }
          </div>
          @if (d.total_roster) {
            <div class="paginador">
              @if (d.anterior; as ant) {
                <a [routerLink]="['/reportes/precursores', ant.id_publicador]"
                   [queryParams]="{ anio: d.anio_servicio, objetivo: d.objetivo }"
                   class="control control-nav"
                   [attr.aria-label]="'Precursor anterior: ' + ant.nombre"
                   [title]="'Anterior: ' + ant.nombre">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                  <span class="texto-nav">Anterior</span>
                </a>
              } @else {
                <span class="control control-nav nav-off" role="link" aria-disabled="true" aria-label="No hay precursor anterior" title="Es el primero del listado">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                  <span class="texto-nav">Anterior</span>
                </span>
              }
              <span class="nav-contador" [attr.aria-label]="'Precursor ' + d.posicion + ' de ' + d.total_roster">
                <strong>{{ d.posicion }}</strong> de {{ d.total_roster }}
              </span>
              @if (d.siguiente; as sig) {
                <a [routerLink]="['/reportes/precursores', sig.id_publicador]"
                   [queryParams]="{ anio: d.anio_servicio, objetivo: d.objetivo }"
                   class="control control-nav"
                   [attr.aria-label]="'Precursor siguiente: ' + sig.nombre"
                   [title]="'Siguiente: ' + sig.nombre">
                  <span class="texto-nav">Siguiente</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </a>
              } @else {
                <span class="control control-nav nav-off" role="link" aria-disabled="true" aria-label="No hay precursor siguiente" title="Es el último del listado">
                  <span class="texto-nav">Siguiente</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                </span>
              }
            </div>
          }
        }
      </nav>

      @if (data(); as d) {
        <header class="identidad aparecer">
          <div class="min-w-0">
            <h1 class="titulo-persona">{{ d.nombre }}</h1>
            <div class="senas">
              <span class="sena-estado" [class]="'tono-' + tonoEstado(d.resumen.estado)">
                <app-estado-badge [estado]="d.resumen.estado" [motivo]="d.resumen.consideracion?.motivo_label" />
              </span>
              @if (d.grupo) { <span class="sena">{{ d.grupo }}</span> }
              @if (d.edad != null) { <span class="sena"><span class="cifra">{{ d.edad }}</span> años de edad</span> }
              @if (d.antiguedad_anios != null) {
                <span class="sena" [title]="'Precursor(a) regular desde ' + (d.fecha_inicio_precursor | date:'MMMM y')">
                  <span class="cifra">{{ d.antiguedad_anios }}</span> años como precursor(a)
                </span>
              }
              @if (d.mes_inicio_privilegio) {
                <span class="sena sena-credito">Nombrado en {{ d.mes_inicio_privilegio }}</span>
              }
            </div>
          </div>
          <div class="acciones">
            <div class="campo">
              <span class="campo-rotulo" aria-hidden="true">Objetivo</span>
              <app-select-picker
                class="sel-objetivo"
                [ngModel]="d.objetivo"
                (ngModelChange)="seleccionarObjetivo($event)"
                [ngModelOptions]="{ standalone: true }"
                [options]="opcionesObjetivo"
                [clearable]="false"
                [searchable]="false"
                colorScheme="violet"
                ariaLabel="Objetivo del cálculo" />
            </div>
            <div class="campo">
              <span class="campo-rotulo" aria-hidden="true">Año de servicio</span>
              <app-select-picker
                class="sel-anio"
                [ngModel]="d.anio_servicio"
                (ngModelChange)="seleccionarAnio($event)"
                [ngModelOptions]="{ standalone: true }"
                [options]="opcionesAnio(d)"
                [clearable]="false"
                [searchable]="false"
                colorScheme="violet"
                ariaLabel="Año de servicio" />
            </div>
            <button type="button" class="control control-primario" (click)="registrarSeguimiento()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
              </svg>
              Registrar seguimiento
            </button>
          </div>
        </header>

        <!-- Situación: una sola frase que dice qué le falta. -->
        @if (situacion(); as s) {
          <section class="situacion aparecer" aria-labelledby="titulo-situacion"
                   [class]="'tono-' + tonoSituacion(s)">
            <span class="situacion-icono" aria-hidden="true">
              @switch (s.tipo) {
                @case ('exento') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 000-7.8z"/>
                  </svg>
                }
                @case ('pendiente') {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                  </svg>
                }
                @default {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                }
              }
            </span>
            <div class="min-w-0">
              @switch (s.tipo) {
                @case ('exento') {
                  <h2 id="titulo-situacion" class="situacion-titulo">Consideración especial</h2>
                  @if (d.resumen.consideracion; as c) {
                    <p class="pauta-texto">
                      Desde <strong>{{ c.fecha_inicio | date:'d MMM y' }}</strong>{{ c.motivo_label ? ' — ' + c.motivo_label : '' }}.
                      <strong class="frase clave">No se le aplica el requisito de {{ ritmoMensual() }} h/mes ni las {{ d.objetivo_anual }} h del año.</strong>
                      <span class="pauta-nota">
                        Conserva el nombramiento de precursor(a) regular. Sus horas se siguen registrando de forma informativa.
                        @if (c.descripcion) { <br>{{ c.descripcion }} }
                      </span>
                    </p>
                  }
                }
                @case ('pendiente') {
                  <h2 id="titulo-situacion" class="situacion-titulo">Lo que le falta para su meta</h2>
                  <p class="pauta-texto">
                    Para llegar a las <strong>{{ d.resumen.meta_prorrateada }} h</strong> de su meta anual le faltan
                    <strong class="clave">{{ d.resumen.horas_restantes }} h</strong> en
                    <strong>{{ d.resumen.meses_restantes }}</strong> {{ d.resumen.meses_restantes === 1 ? 'mes' : 'meses' }}:
                    necesita un promedio de <strong class="clave">{{ d.resumen.promedio_necesario_restante }} h/mes</strong>.
                    <ng-container *ngTemplateOutlet="notaMeta" />
                  </p>
                }
                @case ('alcanzada') {
                  <h2 id="titulo-situacion" class="situacion-titulo">Meta alcanzada</h2>
                  <p class="pauta-texto">
                    Ya lleva <strong class="clave">{{ d.resumen.total_anual }} h</strong> de las
                    <strong>{{ d.resumen.meta_prorrateada }} h</strong> de su meta anual, con
                    <strong>{{ d.resumen.meses_restantes }}</strong> {{ d.resumen.meses_restantes === 1 ? 'mes' : 'meses' }} por delante.
                    <ng-container *ngTemplateOutlet="notaMeta" />
                  </p>
                }
              }
            </div>
          </section>
          <ng-template #notaMeta>
            @if (d.resumen.meses_exigibles < d.resumen.meses_vigentes) {
              <span class="pauta-nota">
                La meta solo cuenta los {{ d.resumen.meses_exigibles }} de {{ d.resumen.meses_vigentes }} meses
                sin consideración especial.
              </span>
            } @else if (d.resumen.meses_vigentes < 12) {
              <span class="pauta-nota">
                Meta prorrateada: las {{ d.objetivo_anual }} h del objetivo anual × {{ d.resumen.meses_vigentes }} de los 12 meses
                del año de servicio en que es precursor(a) regular.
              </span>
            }
          </ng-template>
        }

        <section class="aparecer" aria-labelledby="titulo-cifras">
          <h2 id="titulo-cifras" class="sr-only">Cifras del año de servicio</h2>
          <div class="kpis-grid">
            <div class="kpis-grupo">
            <app-kpi-card compacta label="Horas acumuladas" [value]="d.resumen.total_anual" [hint]="metaHint()" />
            <app-kpi-card compacta label="Promedio mensual" [value]="d.resumen.promedio" suffix="h" [hint]="d.resumen.exento ? 'sin requisito' : ('ritmo ' + ritmoMensual() + ' h/mes')" />
            </div>
            <div class="kpis-grupo">
            @if (!d.resumen.exento) {
              <app-kpi-card compacta label="Balance acumulado" [value]="d.resumen.acu" suffix="h" [hint]="(d.resumen.acu < 0 ? 'por debajo del ritmo de ' : 'al ritmo o por encima de ') + ritmoMensual() + ' h/mes'" />
            }
            <app-kpi-card compacta label="Cursos bíblicos" [value]="d.resumen.cursos_total" [hint]="'promedio ' + d.resumen.cursos_promedio + ' al mes'" />
            </div>
          </div>
        </section>

        <div class="rejilla-detalle grid grid-cols-1 lg:grid-cols-2 gap-4 items-start aparecer">
          <section class="panel" aria-labelledby="titulo-actividad">
            <div class="px-4 pt-4 pb-3">
              <h2 id="titulo-actividad" class="panel-titulo">Actividad mes a mes</h2>
              <p class="panel-apostilla">Horas, crédito y cursos bíblicos por mes.</p>
            </div>
            <div class="tabla-scroll overflow-x-auto" tabindex="0" role="region" aria-labelledby="titulo-actividad">
              <table class="tabla">
                <thead>
                  <tr>
                    <th scope="col" class="text-left">Mes</th>
                    <th scope="col" class="text-right">Horas</th>
                    <th scope="col" class="text-right">Crédito</th>
                    <th scope="col" class="text-right">Total</th>
                    <th scope="col" class="text-right">Cursos</th>
                    <th scope="col" class="text-left">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (m of d.meses; track m.anio + '-' + m.mes) {
                    <tr [class.fila-inactiva]="!m.vigente">
                      <th scope="row" class="mes">{{ m.label }}</th>
                      @if (m.vigente && m.informado) {
                        <td class="text-right celda-num" data-label="Horas">{{ m.horas }}</td>
                        <td class="text-right celda-num" data-label="Crédito" [class]="m.horas_credito > 0 ? 'credito' : 'nulo'">
                          {{ m.horas_credito ? '+' + m.horas_credito : '–' }}
                        </td>
                        <td class="text-right celda-num total" data-label="Total">{{ m.total }}</td>
                        <td class="text-right celda-num" data-label="Cursos" [class.nulo]="!m.cursos_biblicos">{{ m.cursos_biblicos || '–' }}</td>
                        <td data-label="Observaciones">
                          @if (m.observaciones) {
                            <div class="obs" [title]="m.observaciones">{{ m.observaciones }}</div>
                          } @else {
                            <span class="nulo celda-num">–</span>
                          }
                        </td>
                      } @else {
                        <td colspan="5" class="sin-dato" [class.falta]="m.vigente && esCerrado(d, m) && !m.exento">
                          @if (!m.vigente) {
                            No era precursor(a) regular
                          } @else if (esCerrado(d, m)) {
                            <span class="marca">
                              @if (!m.exento) {
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                </svg>
                              }
                              Sin informe{{ m.exento ? ' (con consideración especial)' : '' }}
                            </span>
                          } @else {
                            Mes en curso
                          }
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>

          <div class="columna-der">
            <app-chart-card [title]="progresoTitulo()"
                            [subtitle]="progresoSubtitulo()"
                            [option]="progresoOption()"
                            [height]="altoGrafica()" />

            <div class="inferior">
            <div class="celda">
            <app-seguimientos-panel [idPublicador]="d.id_publicador" [seguimientos]="d.seguimientos" />
            </div>

            </div>
          </div>
        </div>
      } @else if (error()) {
        <div class="panel panel-error" role="alert">
          <span class="situacion-icono" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.3 4.3l-8 14A1.9 1.9 0 004 21h16a1.9 1.9 0 001.7-2.7l-8-14a1.9 1.9 0 00-3.4 0z"/>
            </svg>
          </span>
          <div>
            <p class="error-titulo">No se pudo cargar el detalle</p>
            <p class="error-texto">{{ error() }} Vuelve a intentarlo; si el precursor ya no figura en el listado, regresa al análisis y elígelo de nuevo.</p>
            <div class="flex flex-wrap gap-2 mt-3.5">
              <button type="button" class="control" (click)="reintentar()">Volver a cargar</button>
              <a [routerLink]="['/reportes/precursores']" [queryParams]="volverQueryParams()" class="control">Ir al análisis de precursores</a>
            </div>
          </div>
        </div>
      } @else {
        <div class="space-y-5 animate-pulse motion-reduce:animate-none" aria-busy="true">
          <p class="sr-only" role="status">Cargando el detalle del precursor…</p>
          <div class="h-16 esqueleto w-2/3"></div>
          <div class="h-20 esqueleto"></div>
          <div class="kpis-grid">
            @for (i of [1, 2, 3, 4, 5]; track i) {
              <div class="h-[6.5rem] esqueleto"></div>
            }
          </div>
          <div class="rejilla-detalle grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div class="h-96 esqueleto"></div>
            <div class="h-96 esqueleto"></div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PrecursorDetallePage {
  private api = inject(ReportesService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  @ViewChild(SeguimientosPanelComponent) private panelSeguimientos?: SeguimientosPanelComponent;

  /** Alto de la ventana: la gráfica se reparte lo que deja el resto de la pantalla. */
  private readonly ventana = signal({ w: window.innerWidth, h: window.innerHeight });
  readonly altoGrafica = computed(() => {
    const { w, h } = this.ventana();
    // En el modo "a la ventana" la gráfica rellena el espacio sobrante.
    return w < 1280 || h < 600 ? 260 : null;
  });
  @HostListener('window:resize')
  alRedimensionar() { this.ventana.set({ w: window.innerWidth, h: window.innerHeight }); }

  readonly data = signal<PrecursorDetalle | null>(null);

  // ── Búsqueda de precursor ──
  readonly q = signal('');
  readonly abierto = signal(false);
  readonly activo = signal(0);
  private readonly roster = signal<{ id_publicador: number; nombre: string }[]>([]);
  private rosterClave = '';
  private static sinTildes(t: string): string {
    return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  readonly resultados = computed(() => {
    const q = PrecursorDetallePage.sinTildes(this.q().trim());
    const todos = this.roster();
    return (q ? todos.filter(r => PrecursorDetallePage.sinTildes(r.nombre).includes(q)) : todos).slice(0, 50);
  });

  abrirBusqueda(): void {
    this.abierto.set(true);
    this.activo.set(0);
    const d = this.data();
    if (!d) return;
    const clave = `${d.anio_servicio}|${d.objetivo}`;
    if (clave === this.rosterClave) return;
    this.rosterClave = clave;
    this.api.getPrecursores(d.anio_servicio, d.objetivo).subscribe({
      next: (m) => this.roster.set(m.precursores.map(p => ({ id_publicador: p.id_publicador, nombre: p.nombre }))),
      error: () => { this.rosterClave = ''; },
    });
  }
  escribir(v: string): void { this.q.set(v); this.abierto.set(true); this.activo.set(0); }
  teclaBusqueda(ev: KeyboardEvent): void {
    const n = this.resultados().length;
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.abierto.set(true);
      if (n) this.activo.set((this.activo() + (ev.key === 'ArrowDown' ? 1 : n - 1)) % n);
    } else if (ev.key === 'Enter') {
      const r = this.resultados()[this.activo()];
      if (this.abierto() && r) { ev.preventDefault(); this.elegir(r.id_publicador); }
    } else if (ev.key === 'Escape') {
      if (this.q() || this.abierto()) { ev.preventDefault(); this.q.set(''); this.abierto.set(false); }
    }
  }
  elegir(id: number): void {
    const d = this.data();
    this.q.set('');
    this.abierto.set(false);
    if (!d || id === d.id_publicador) return;
    this.router.navigate(['/reportes/precursores', id], { queryParams: { anio: d.anio_servicio, objetivo: d.objetivo } });
  }
  readonly error = signal<string | null>(null);
  /** Última petición, para "Volver a cargar" tras un error. */
  private readonly ultimaPeticion = signal<{ id: number; anio?: number; objetivo?: ObjetivoPrecursor } | null>(null);

  readonly opcionesObjetivo: PickerOption[] = [
    { value: 'publicador', label: 'Publicador · 600 h' },
    { value: 'comite', label: 'Comité · 560 h' },
  ];
  opcionesAnio(d: PrecursorDetalle): PickerOption[] {
    return d.anios_disponibles.map(a => ({ value: a, label: `${a - 1}–${a}` }));
  }

  /** Query params para volver al listado conservando año y objetivo. */
  readonly volverQueryParams = computed(() => {
    const d = this.data();
    if (d) return { anio: d.anio_servicio, objetivo: d.objetivo };
    const u = this.ultimaPeticion();
    return { anio: u?.anio ?? null, objetivo: u?.objetivo ?? null };
  });

  /**
   * Qué cuenta el recuadro de situación. Antes solo existía el caso "le
   * faltan X h"; con el año cerrado o la meta ya cumplida el recuadro
   * desaparecía (o decía "le faltan 0 h"), justo cuando el veredicto es
   * lo que se busca.
   */
  readonly situacion = computed<Situacion | null>(() => {
    const d = this.data();
    if (!d) return null;
    const r = d.resumen;
    if (r.exento) return r.consideracion ? { tipo: 'exento' } : null;
    if (r.meses_restantes > 0) {
      if (r.horas_restantes <= 0) return { tipo: 'alcanzada' };
      const tono = r.estado === 'en_meta' ? 'pos' : r.estado === 'riesgo' ? 'neg' : 'aviso';
      return { tipo: 'pendiente', tono };
    }
    // Año cerrado: el veredicto ya lo dan la insignia de estado y la cifra de
    // horas frente a la meta; un recuadro más solo repetiría eso.
    return null;
  });

  tonoSituacion(s: Situacion): string {
    switch (s.tipo) {
      case 'exento': return 'exento';
      case 'pendiente': return s.tono;
      case 'alcanzada': return 'pos';
    }
  }

  tonoEstado(estado: PrecursorDetalle['resumen']['estado']): string {
    return estado === 'en_meta' ? 'pos' : estado === 'atencion' ? 'aviso' : estado === 'riesgo' ? 'neg' : 'exento';
  }

  readonly progresoOption = computed<EChartsOption | null>(() => {
    const d = this.data();
    if (!d) return null;
    const cerrados = d.meses.filter(m => m.vigente);
    let acumulado = 0;
    let meta = 0;
    const reales: (number | null)[] = [];
    const metas: number[] = [];
    const labels: string[] = [];
    const ritmo = this.ritmoMensual();
    for (const m of cerrados) {
      labels.push(m.label.split(' ')[0]);
      meta += ritmo;
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
          { name: `Ritmo ${this.ritmoMensual()} h/mes`, type: 'line' as const, data: metas, symbol: 'none' as const, lineStyle: { width: 2, type: 'dashed' as const } },
        ]),
      ],
    };
  });

  /** La meta del gráfico es la prorrateada; se aclara cuando no son 12 meses. */
  progresoSubtitulo(): string {
    const d = this.data();
    if (!d) return '';
    if (d.resumen.exento) return 'Horas acumuladas (predicación + crédito) · sin requisito por consideración especial';
    const base = `Horas acumuladas (predicación + crédito) frente al ritmo de ${this.ritmoMensual()} h/mes`;
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

  /** Ritmo mensual derivado del objetivo activo: 50 h/mes (600) o 47 h/mes (560). */
  ritmoMensual(): number {
    return Math.round((this.data()?.objetivo_anual ?? 600) / 12);
  }

  esCerrado(d: PrecursorDetalle, m: { anio: number; mes: number }): boolean {
    const hoy = new Date();
    return new Date(m.anio, m.mes - 1, 1) < new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      const qp = this.route.snapshot.queryParamMap;
      const anio = Number(qp.get('anio')) || undefined;
      const objetivo = (qp.get('objetivo') as ObjetivoPrecursor) || undefined;
      if (id) this.cargar(id, anio, objetivo);
    });
  }

  cargar(id: number, anio?: number, objetivo?: ObjetivoPrecursor): void {
    this.ultimaPeticion.set({ id, anio, objetivo });
    this.error.set(null);
    this.data.set(null);
    this.api.getPrecursorDetalle(id, anio, objetivo).subscribe({
      next: (res) => this.data.set(res),
      error: (err) => this.error.set(err?.error?.detail ?? 'No fue posible cargar el detalle.'),
    });
  }

  reintentar(): void {
    const u = this.ultimaPeticion();
    if (u) this.cargar(u.id, u.anio, u.objetivo);
  }

  /** Atajo de la cabecera: abre el formulario del panel y lo trae a la vista. */
  registrarSeguimiento(): void {
    this.panelSeguimientos?.abrirFormulario();
  }

  seleccionarAnio(v: unknown): void {
    const anio = Number(v);
    const d = this.data();
    if (!d || !anio || anio === d.anio_servicio) return;
    this.router.navigate([], { relativeTo: this.route, queryParams: { anio }, queryParamsHandling: 'merge' });
    this.cargar(d.id_publicador, anio, d.objetivo);
  }

  seleccionarObjetivo(v: unknown): void {
    const objetivo = v as ObjetivoPrecursor;
    const d = this.data();
    if (!d || !objetivo || objetivo === d.objetivo) return;
    this.router.navigate([], { relativeTo: this.route, queryParams: { objetivo }, queryParamsHandling: 'merge' });
    this.cargar(d.id_publicador, d.anio_servicio, objetivo);
  }

  /** Navega al precursor contiguo del roster, conservando año y objetivo. */
  irA(vecino?: { id_publicador: number } | null): void {
    const d = this.data();
    if (!d || !vecino) return;
    this.router.navigate(['/reportes/precursores', vecino.id_publicador], {
      queryParams: { anio: d.anio_servicio, objetivo: d.objetivo },
    });
  }

  /**
   * ← / → saltan entre precursores. Se ignoran si el foco está en un campo,
   * en un desplegable o un diálogo abiertos (donde las flechas ya mueven la
   * selección) o en una zona con scroll horizontal propio.
   */
  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
    if (ev.defaultPrevented || ev.ctrlKey || ev.metaKey || ev.altKey || ev.shiftKey) return;
    const t = ev.target as HTMLElement | null;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (t?.closest?.('app-select-picker, [role="listbox"], [role="dialog"], [role="region"]')) return;
    const d = this.data();
    if (!d) return;
    const vecino = ev.key === 'ArrowLeft' ? d.anterior : d.siguiente;
    if (vecino) { ev.preventDefault(); this.irA(vecino); }
  }
}
