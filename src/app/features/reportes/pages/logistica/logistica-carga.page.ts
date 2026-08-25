import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartCardComponent } from '../../shared/chart-card.component';
import { KpiCardComponent } from '../../shared/kpi-card.component';
import { barOption } from '../../shared/chart-options';
import {
  CargaPersona,
  LogisticaCargaFiltros,
  LogisticaCargaReporte,
  NivelCarga,
  ReportesService,
} from '../../services/reportes.service';
// Fuente única de los nombres de categoría: los mismos que rotula la pestaña
// de Logística. Una copia aquí acabaría diciendo "Sonido" donde la otra
// pantalla dice "Audio".
import { PERMISO_LABEL, PUESTOS_LABEL } from '../../../reuniones/models/logistica.models';

const CATEGORIA_LABEL: Record<string, string> = { ...PERMISO_LABEL, aseo: 'Aseo' };

/** Atajos de rango. Escribir dos fechas para "los últimos 6 meses" es trabajo. */
type Preset = { id: string; label: string; meses: number };
const PRESETS: Preset[] = [
  { id: '1',  label: 'Este mes',  meses: 1 },
  { id: '3',  label: '3 meses',   meses: 3 },
  { id: '6',  label: '6 meses',   meses: 6 },
  { id: '12', label: '12 meses',  meses: 12 },
];

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ChartCardComponent, KpiCardComponent],
  styleUrls: ['../../shared/reportes-tokens.scss'],
  styles: [`
    /* Cabecera: el rotulo situa, el titulo nombra, la entradilla explica. */
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

    /* Controles: un solo alto, un solo filete, un solo radio para selector,
       boton, fecha y buscador. La coherencia hace mas por la sensacion de
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
      transition: border-color 140ms cubic-bezier(0.25, 1, 0.5, 1),
                  color 140ms cubic-bezier(0.25, 1, 0.5, 1),
                  transform 140ms cubic-bezier(0.25, 1, 0.5, 1);
    }
    .control:focus-visible {
      outline: 2px solid var(--acento);
      outline-offset: 2px;
      border-color: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      .control:hover:not(:disabled) { border-color: var(--txt-4); color: var(--txt-1); }
    }
    .control-boton:active:not(:disabled) { transform: scale(0.975); }
    .control-boton:disabled { opacity: 0.4; cursor: not-allowed; }
    .control-busqueda { padding-left: 2.25rem; }
    .control-busqueda::placeholder { color: var(--txt-4); }
    .icono-busqueda { color: var(--txt-4); }

    /* Atajo de rango activo: relleno tenue del acento, sin sombra ni brillo. */
    .preset-activo {
      border-color: transparent;
      background: color-mix(in oklch, var(--acento) 12%, transparent);
      color: var(--acento);
      font-weight: 700;
    }

    .rotulo-filtro {
      display: block;
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--txt-4);
      margin-bottom: 0.25rem;
    }

    /* Superficies: un filete basta para separar del lienzo. */
    .panel {
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      background: var(--superficie);
    }
    .panel-titulo {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 0.9375rem;
      letter-spacing: -0.02em;
      color: var(--txt-1);
    }
    .panel-sub {
      font-size: 0.75rem;
      line-height: 1.5;
      color: var(--txt-3);
    }

    /* Tabla: filetes horizontales, sin rejilla vertical ni cebra. */
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla th {
      font-size: 0.625rem;
      font-weight: 600;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--txt-4);
      text-align: left;
      padding: 0 0.75rem 0.5rem;
      white-space: nowrap;
    }
    .tabla td {
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      color: var(--txt-2);
      border-top: 1px solid var(--linea-suave);
      vertical-align: middle;
    }
    .tabla tbody tr:hover td { background: var(--superficie-alt); }
    .fila-persona { cursor: pointer; }
    .celda-nombre { color: var(--txt-1); font-weight: 500; }

    /* Fila clicable: boton transparente, mismo tipo que el resto del texto. */
    .btn-fila {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      text-align: left;
      background: none;
      border: none;
      padding: 0;
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .chevron {
      flex-shrink: 0;
      transition: transform 180ms cubic-bezier(0.25, 1, 0.5, 1);
      color: var(--txt-4);
    }
    .chevron-abierto { transform: rotate(90deg); }

    /* Fila de detalle: chips de solo lectura, sin filete propio para no
       competir con el de la fila que despliegan. */
    .fila-detalle td {
      padding-top: 0;
      padding-bottom: 0.75rem;
      border-top: none;
    }
    .chips-detalle {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
      padding-left: 1.375rem;
    }
    .chip-asignacion {
      display: inline-flex;
      align-items: center;
      height: 1.625rem;
      padding-inline: 0.625rem;
      border-radius: 999px;
      background: var(--superficie-alt);
      border: 1px solid var(--linea);
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--txt-3);
    }
    .celda-num {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      text-align: right;
      color: var(--txt-1);
      font-weight: 600;
    }
    .celda-sec { color: var(--txt-3); font-size: 0.75rem; }

    /* Barra de la fila: apoyo visual. El numero y el chip llevan el dato. */
    .barra {
      display: block;
      width: 100%;
      max-width: 7rem;
      height: 0.3125rem;
      border-radius: 999px;
      background: color-mix(in oklch, var(--linea) 60%, transparent);
      overflow: hidden;
    }
    .barra > i {
      display: block;
      height: 100%;
      border-radius: 999px;
      transition: width 320ms cubic-bezier(0.25, 1, 0.5, 1);
    }

    /* Nivel de carga. Ambar para la alta, no rojo: una carga desigual no es un
       error que impida nada. Azul para la baja: es margen, no fallo. Verde
       para la normal. Nunca solo color -el chip lleva siempre su palabra-. */
    .chip {
      display: inline-block;
      min-width: 3.75rem;
      text-align: center;
      padding: 0.125rem 0.5rem;
      border: 1px solid;
      border-radius: 999px;
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    .chip-alta {
      color: var(--aviso);
      border-color: color-mix(in oklch, var(--aviso) 35%, transparent);
      background: color-mix(in oklch, var(--aviso) 10%, transparent);
    }
    .chip-normal {
      color: var(--pos);
      border-color: color-mix(in oklch, var(--pos) 35%, transparent);
      background: color-mix(in oklch, var(--pos) 10%, transparent);
    }
    .chip-baja {
      color: var(--exento);
      border-color: color-mix(in oklch, var(--exento) 35%, transparent);
      background: color-mix(in oklch, var(--exento) 10%, transparent);
    }
    .relleno-alta   { background: var(--aviso); }
    .relleno-normal { background: var(--pos); }
    .relleno-baja   { background: var(--exento); }

    .leyenda { font-size: 0.6875rem; line-height: 1.7; color: var(--txt-4); }

    /* Estados vacio / error / carga. */
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
      max-width: 42ch;
      color: var(--txt-3);
    }
    .esqueleto {
      border-radius: 0.75rem;
      background: color-mix(in oklch, var(--linea) 55%, transparent);
      animation: latido 1.6s ease-in-out infinite;
    }
    @keyframes latido { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

    @media (prefers-reduced-motion: reduce) {
      .control, .barra > i { transition: none; }
      .esqueleto { animation: none; }
    }

    /* Filas mas altas y chips mas grandes solo en tactil: en escritorio la
       tabla se beneficia de estar compacta, pero un dedo necesita bastante
       mas margen que un cursor para acertarle a la fila o al chip correctos. */
    @media (max-width: 640px) {
      .fila-persona td { padding-block: 0.75rem; }
      .chip-asignacion { height: 2rem; padding-inline: 0.75rem; font-size: 0.75rem; }
    }
  `],
  template: `
    <!-- Sin padding propio: el margen exterior lo pone el shell una sola vez. -->
    <div class="space-y-5">

      <!-- ===== CABECERA ===== -->
      <header>
        <p class="rotulo-seccion">Reportes</p>
        <h1 class="titulo-pagina">Carga de Logística</h1>
        <p class="entradilla">
          Cómo se ha repartido el trabajo de las reuniones en el periodo consultado.
          Solo consulta: esta pantalla no asigna ni cambia nada.
        </p>
      </header>

      <!-- ===== FILTROS ===== -->
      <!-- Los atajos de rango van primero y separados: son lo que casi todo el
           mundo usa, y obligar a escribir dos fechas para ver "los ultimos 6
           meses" seria cobrar un peaje por la consulta mas comun. -->
      <section class="panel p-4 space-y-3" aria-label="Filtros del reporte">
        <div class="flex flex-wrap items-center gap-2">
          <span class="rotulo-filtro" style="margin-bottom:0">Periodo</span>
          @for (p of presets; track p.id) {
            <button
              type="button"
              class="control control-boton"
              [class.preset-activo]="presetActivo() === p.id"
              [attr.aria-pressed]="presetActivo() === p.id"
              (click)="aplicarPreset(p)">{{ p.label }}</button>
          }
          <span class="hidden sm:block h-5 w-px" style="background: var(--linea)"></span>
          <label class="sr-only" for="f-desde">Desde</label>
          <input id="f-desde" type="date" class="control" [(ngModel)]="desde" (change)="rangoManual()" />
          <span class="text-xs" style="color: var(--txt-4)">a</span>
          <label class="sr-only" for="f-hasta">Hasta</label>
          <input id="f-hasta" type="date" class="control" [(ngModel)]="hasta" (change)="rangoManual()" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label class="rotulo-filtro" for="f-persona">Persona</label>
            <select id="f-persona" class="control w-full" [(ngModel)]="idPublicador" (change)="recargar()">
              <option [ngValue]="null">Todas</option>
              @for (p of personasOpciones(); track p.id_publicador) {
                <option [ngValue]="p.id_publicador">{{ p.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="rotulo-filtro" for="f-cat">Categoría</label>
            <select id="f-cat" class="control w-full" [(ngModel)]="categoria" (change)="recargar()">
              <option [ngValue]="null">Todas</option>
              @for (c of categoriasFiltro; track c) {
                <option [ngValue]="c">{{ etiquetaCategoria(c) }}</option>
              }
            </select>
          </div>
          <div>
            <label class="rotulo-filtro" for="f-grupo">Grupo</label>
            <select id="f-grupo" class="control w-full" [(ngModel)]="idGrupo" (change)="recargar()">
              <option [ngValue]="null">Todos</option>
              @for (g of data()?.grupos ?? []; track g.id_grupo) {
                <option [ngValue]="g.id_grupo">{{ g.nombre_grupo }}</option>
              }
            </select>
          </div>
          <div>
            <label class="rotulo-filtro" for="f-sexo">Sexo</label>
            <select id="f-sexo" class="control w-full" [(ngModel)]="sexo" (change)="recargar()">
              <option [ngValue]="null">Todos</option>
              <option ngValue="M">Hombres</option>
              <option ngValue="F">Mujeres</option>
            </select>
          </div>
          <div>
            <label class="rotulo-filtro" for="f-priv">Privilegio</label>
            <select id="f-priv" class="control w-full" [(ngModel)]="idPrivilegio" (change)="recargar()">
              <option [ngValue]="null">Todos</option>
              @for (p of data()?.privilegios ?? []; track p.id_privilegio) {
                <option [ngValue]="p.id_privilegio">{{ p.nombre_privilegio }}</option>
              }
            </select>
          </div>
        </div>

        @if (hayFiltros()) {
          <button type="button" class="control control-boton" (click)="limpiarFiltros()">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            Quitar filtros
          </button>
        }
      </section>

      <!-- ===== ERROR ===== -->
      @if (error()) {
        <div class="panel p-6 flex flex-col items-center text-center gap-2" role="alert"
             style="border-color: color-mix(in oklch, var(--neg) 40%, transparent)">
          <p class="vacio-titulo">No se pudo cargar el reporte</p>
          <p class="vacio-texto">{{ error() }}</p>
          <button type="button" class="control control-boton mt-1" (click)="recargar()">Reintentar</button>
        </div>
      }

      <!-- ===== CARGANDO ===== -->
      @else if (cargando()) {
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3" aria-hidden="true">
          @for (n of [1,2,3,4]; track n) { <div class="esqueleto h-24"></div> }
        </div>
        <div class="esqueleto h-80" aria-hidden="true"></div>
        <p class="sr-only" role="status">Cargando el reporte de carga de logística.</p>
      }

      @else if (data(); as d) {
        <!-- ===== KPIs ===== -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
          @for (k of d.kpis; track k.label) {
            <app-kpi-card [label]="k.label" [value]="k.value" [hint]="k.hint" />
          }
        </div>

        <!-- ===== POR PERSONA ===== -->
        <section class="panel overflow-hidden">
          <div class="p-4 flex flex-wrap items-end justify-between gap-3 border-b" style="border-color: var(--linea)">
            <div class="min-w-0">
              <h2 class="panel-titulo">Carga por persona</h2>
              <p class="panel-sub">
                {{ d.periodo_label }} · media de
                <strong style="color: var(--txt-1)">{{ d.promedio | number:'1.0-1' }}</strong> tareas por persona.
                El aseo no entra aquí: se asigna por grupo.
              </p>
            </div>
            <div class="flex items-center gap-2">
              <div class="relative">
                <svg class="icono-busqueda w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                <input
                  type="search"
                  class="control control-busqueda w-full sm:w-52"
                  placeholder="Buscar persona…"
                  aria-label="Buscar persona"
                  [ngModel]="busqueda()"
                  (ngModelChange)="busqueda.set($event)" />
              </div>
              <button
                type="button"
                class="control control-boton"
                [disabled]="!personasFiltradas().length"
                (click)="exportarCsv()">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 12 5 5 5-5"/><path d="M5 21h14"/></svg>
                Exportar CSV
              </button>
              <button
                type="button"
                class="control control-boton"
                [disabled]="!d.por_persona.length || exportandoXlsx()"
                title="Incluye las 3 tablas (persona, categoría, grupo) del periodo filtrado, en hojas separadas"
                (click)="exportarXlsx()">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
                {{ exportandoXlsx() ? 'Generando…' : 'Exportar Excel' }}
              </button>
            </div>
          </div>

          @if (personasFiltradas().length) {
            <div class="overflow-x-auto">
              <table class="tabla">
                <caption class="sr-only">Tareas de logística por persona en {{ d.periodo_label }}</caption>
                <thead>
                  <tr>
                    <th scope="col" class="pt-3">Persona</th>
                    <th scope="col" class="pt-3">Grupo</th>
                    <th scope="col" class="pt-3">Reparto</th>
                    <th scope="col" class="pt-3 text-right">Tareas</th>
                    <th scope="col" class="pt-3">Carga</th>
                    <th scope="col" class="pt-3">Última vez</th>
                  </tr>
                </thead>
                <tbody>
                  @for (f of personasFiltradas(); track f.id_publicador) {
                    <tr
                      class="fila-persona"
                      (click)="toggleFila(f.id_publicador)"
                      [attr.aria-expanded]="filaExpandida() === f.id_publicador">
                      <td class="celda-nombre">
                        <button type="button" class="btn-fila">
                          <svg class="chevron w-3 h-3" [class.chevron-abierto]="filaExpandida() === f.id_publicador"
                               fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                          {{ f.nombre }}
                        </button>
                      </td>
                      <td class="celda-sec">{{ f.grupo || '—' }}</td>
                      <td>
                        <span class="barra" [title]="detalleCategorias(f)">
                          <i [class]="'relleno-' + f.nivel" [style.width.%]="anchoBarra(f)"></i>
                        </span>
                      </td>
                      <td class="celda-num">{{ f.total }}</td>
                      <td><span class="chip" [class]="'chip-' + f.nivel">{{ etiquetaNivel(f.nivel) }}</span></td>
                      <td class="celda-sec">{{ f.ultima_fecha ? (f.ultima_fecha | date:'d MMM y':'UTC':'es') : 'Nunca' }}</td>
                    </tr>
                    @if (filaExpandida() === f.id_publicador) {
                      <tr class="fila-detalle">
                        <td colspan="6">
                          @if (f.asignaciones.length) {
                            <div class="chips-detalle">
                              @for (a of f.asignaciones; track a.fecha + a.puesto) {
                                <span class="chip-asignacion">{{ a.fecha | date:'d MMM':'UTC':'es' }} · {{ etiquetaPuesto(a.puesto) }}</span>
                              }
                            </div>
                          } @else {
                            <p class="chips-detalle" style="color: var(--txt-4)">Sin asignaciones individuales en este periodo.</p>
                          }
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
            <p class="leyenda px-4 py-3 border-t" style="border-color: var(--linea-suave)">
              <strong style="color: var(--txt-3)">Alta</strong> o <strong style="color: var(--txt-3)">baja</strong>
              es respecto a la media del periodo consultado, no a un número fijo de tareas.
            </p>
          } @else {
            <div class="p-10 flex flex-col items-center text-center gap-2">
              <p class="vacio-titulo">{{ busqueda() ? 'Ningún nombre coincide' : 'Sin asignaciones en este periodo' }}</p>
              <p class="vacio-texto">
                {{ busqueda()
                    ? 'Prueba con otra parte del nombre o quita la búsqueda.'
                    : 'Amplía el rango de fechas o quita algún filtro para ver más resultados.' }}
              </p>
            </div>
          }
        </section>

        <!-- ===== POR CATEGORÍA Y POR GRUPO ===== -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div class="space-y-4">
            <app-chart-card
              title="Veces que se cubrió cada tarea"
              [subtitle]="d.periodo_label"
              [option]="categoriaOption()"
              [height]="260" />
            <section class="panel overflow-hidden">
              <div class="p-4 border-b" style="border-color: var(--linea)">
                <h2 class="panel-titulo">Reparto por categoría</h2>
                <p class="panel-sub">
                  Cuántas de las personas habilitadas llegaron a cubrir cada tarea.
                  Un porcentaje bajo significa que recae siempre en los mismos.
                </p>
              </div>
              @if (d.por_categoria.length) {
                <div class="overflow-x-auto">
                  <table class="tabla">
                    <thead>
                      <tr>
                        <th scope="col" class="pt-3">Tarea</th>
                        <th scope="col" class="pt-3 text-right">Veces</th>
                        <th scope="col" class="pt-3 text-right">Personas</th>
                        <th scope="col" class="pt-3 text-right">Reparto</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (c of d.por_categoria; track c.categoria) {
                        <tr>
                          <td class="celda-nombre">{{ etiquetaCategoria(c.categoria) }}</td>
                          <td class="celda-num">{{ c.total }}</td>
                          <td class="celda-num">{{ c.personas }} <span style="color: var(--txt-4)">/ {{ c.disponibles }}</span></td>
                          <td class="celda-num">{{ c.reparto_pct | number:'1.0-0' }}%</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="p-6 vacio-texto text-center mx-auto">Sin datos de categorías en este periodo.</p>
              }
            </section>
          </div>

          <div class="space-y-4">
            <app-chart-card
              title="Rotación del aseo por grupo"
              [subtitle]="d.periodo_label"
              [option]="grupoOption()"
              [height]="260" />
            <section class="panel overflow-hidden">
              <div class="p-4 border-b" style="border-color: var(--linea)">
                <h2 class="panel-titulo">Carga por grupo</h2>
                <p class="panel-sub">
                  Aseo del salón, que se asigna a un grupo entero y no a una persona.
                  No incluye hospitalidad: ese hospedaje se registra por orador visitante en
                  Discursos Públicos, no como una rotación de los grupos de servicio.
                </p>
              </div>
              @if (d.por_grupo.length) {
                <div class="overflow-x-auto">
                  <table class="tabla">
                    <thead>
                      <tr>
                        <th scope="col" class="pt-3">Grupo</th>
                        <th scope="col" class="pt-3 text-right">Veces</th>
                        <th scope="col" class="pt-3">Carga</th>
                        <th scope="col" class="pt-3">Última vez</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (g of d.por_grupo; track g.id_grupo) {
                        <tr>
                          <td class="celda-nombre">{{ g.nombre }}</td>
                          <td class="celda-num">{{ g.total }}</td>
                          <td><span class="chip" [class]="'chip-' + g.nivel">{{ etiquetaNivel(g.nivel) }}</span></td>
                          <td class="celda-sec">{{ g.ultima_fecha ? (g.ultima_fecha | date:'d MMM y':'UTC':'es') : 'Nunca' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <p class="p-6 vacio-texto text-center mx-auto">Esta congregación aún no tiene grupos registrados.</p>
              }
            </section>
          </div>
        </div>
      }
    </div>
  `,
})
export class LogisticaCargaPage implements OnInit {
  private api = inject(ReportesService);

  readonly presets = PRESETS;
  /** Sin 'aseo': filtrar por él vacía el corte por persona y confunde más de lo que ayuda. */
  readonly categoriasFiltro = Object.keys(PERMISO_LABEL);

  readonly data = signal<LogisticaCargaReporte | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly busqueda = signal('');

  /** Fila cuyo detalle de asignaciones está desplegado. Una a la vez. */
  readonly filaExpandida = signal<number | null>(null);

  toggleFila(idPublicador: number): void {
    this.filaExpandida.set(this.filaExpandida() === idPublicador ? null : idPublicador);
  }

  // Filtros. Se enlazan con ngModel y disparan una recarga al cambiar: el
  // servidor es quien sabe agregar, y filtrar en cliente sobre una página ya
  // recortada daría totales que no cuadran con los KPIs.
  desde: string | null = null;
  hasta: string | null = null;
  categoria: string | null = null;
  idGrupo: number | null = null;
  sexo: string | null = null;
  idPrivilegio: number | null = null;
  idPublicador: number | null = null;

  readonly presetActivo = signal<string | null>('6');

  /**
   * Opciones del selector de persona. No se derivan de `data()` con un
   * `computed`: una vez elegida una persona, la respuesta filtrada trae solo
   * esa fila en `por_persona`, y el selector se quedaría con una única opción
   * sin forma de volver a elegir otra. Por eso es un signal aparte que solo se
   * actualiza en `recargar()` cuando la petición NO iba acotada por persona —
   * conserva la última lista completa vista.
   */
  readonly personasOpciones = signal<{ id_publicador: number; nombre: string }[]>([]);

  /** La búsqueda por nombre sí es local: no cambia ningún total, solo recorta la vista. */
  readonly personasFiltradas = computed<CargaPersona[]>(() => {
    const filas = this.data()?.por_persona ?? [];
    const q = this.normalizar(this.busqueda().trim());
    if (!q) return filas;
    return filas.filter((f) => this.normalizar(f.nombre).includes(q));
  });

  private readonly maxTotal = computed(() =>
    Math.max(1, ...(this.data()?.por_persona ?? []).map((f) => f.total)),
  );

  readonly categoriaOption = computed(() => {
    const d = this.data();
    if (!d?.por_categoria.length) return null;
    return barOption(
      d.por_categoria.map((c) => ({ label: this.etiquetaCategoria(c.categoria), value: c.total })),
      { horizontal: true },
    );
  });

  readonly grupoOption = computed(() => {
    const d = this.data();
    if (!d?.por_grupo.length) return null;
    return barOption(
      d.por_grupo.map((g) => ({ label: g.nombre, value: g.total })),
      { horizontal: true },
    );
  });

  /**
   * Método y no `computed`: los selectores se enlazan con ngModel a campos
   * normales, no a señales. Un `computed` se quedaría con el valor de la
   * primera evaluación y el botón de quitar filtros no aparecería al elegir uno.
   */
  hayFiltros(): boolean {
    return !!(this.categoria || this.idGrupo || this.sexo || this.idPrivilegio || this.idPublicador || this.busqueda());
  }

  ngOnInit(): void {
    this.aplicarPreset(PRESETS.find((p) => p.id === '6')!);
  }

  // ── Rango ───────────────────────────────────────────────────

  aplicarPreset(p: Preset): void {
    const hoy = new Date();
    const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const ini = new Date(hoy.getFullYear(), hoy.getMonth() - (p.meses - 1), 1);
    this.desde = this.iso(ini);
    this.hasta = this.iso(fin);
    this.presetActivo.set(p.id);
    this.recargar();
  }

  /** Tocar una fecha a mano desactiva el atajo: ya no es "6 meses". */
  rangoManual(): void {
    this.presetActivo.set(null);
    this.recargar();
  }

  limpiarFiltros(): void {
    this.categoria = null;
    this.idGrupo = null;
    this.sexo = null;
    this.idPrivilegio = null;
    this.idPublicador = null;
    this.busqueda.set('');
    this.recargar();
  }

  recargar(): void {
    const filtros: LogisticaCargaFiltros = {
      fecha_desde: this.desde,
      fecha_hasta: this.hasta,
      categoria: this.categoria,
      id_grupo: this.idGrupo,
      sexo: this.sexo,
      id_privilegio: this.idPrivilegio,
      id_publicador: this.idPublicador,
    };
    this.cargando.set(true);
    this.error.set(null);
    this.api.getLogisticaCarga(filtros).subscribe({
      next: (res) => {
        this.data.set(res);
        // Congela la lista de personas la última vez que se vio sin acotar por
        // persona, para que elegir una no borre las demás del selector.
        if (!this.idPublicador) {
          this.personasOpciones.set(
            res.por_persona.map((p) => ({ id_publicador: p.id_publicador, nombre: p.nombre })),
          );
        }
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'No fue posible cargar el reporte.');
        this.cargando.set(false);
      },
    });
  }

  // ── Presentación ────────────────────────────────────────────

  etiquetaCategoria(clave: string): string {
    return CATEGORIA_LABEL[clave] ?? clave;
  }

  /** Etiqueta del puesto concreto ("Acomodador 1"), no de la categoría que lo agrupa. */
  etiquetaPuesto(puesto: string): string {
    return PUESTOS_LABEL[puesto] ?? puesto;
  }

  etiquetaNivel(nivel: NivelCarga): string {
    switch (nivel) {
      case 'alta': return 'Alta';
      case 'baja': return 'Baja';
      default:     return 'Normal';
    }
  }

  anchoBarra(f: CargaPersona): number {
    return Math.round((f.total / this.maxTotal()) * 100);
  }

  /** "Audio 4 · Micrófono 1" — el desglose va en el title de la barra. */
  detalleCategorias(f: CargaPersona): string {
    const partes = Object.entries(f.por_categoria)
      .sort((a, b) => b[1] - a[1])
      .map(([clave, n]) => `${this.etiquetaCategoria(clave)} ${n}`);
    return partes.length ? partes.join(' · ') : 'Sin tareas en este periodo';
  }

  // ── Exportar ────────────────────────────────────────────────

  /**
   * CSV en el propio navegador: el reporte ya está entero en memoria y pedirle
   * al servidor que lo vuelva a construir sólo para descargarlo añadiría un
   * endpoint que puede quedar desincronizado con lo que se ve en pantalla.
   *
   * Punto y coma y BOM porque el destino real es Excel en español: con coma
   * mete todo en una columna, y sin BOM se come los acentos.
   */
  exportarCsv(): void {
    const d = this.data();
    const filas = this.personasFiltradas();
    if (!d || !filas.length) return;

    const categorias = this.categoriasFiltro;
    const cabecera = [
      'Persona', 'Grupo', 'Tareas', 'Carga', 'Última vez',
      ...categorias.map((c) => this.etiquetaCategoria(c)),
    ];
    const cuerpo = filas.map((f) => [
      f.nombre,
      f.grupo ?? '',
      f.total,
      this.etiquetaNivel(f.nivel),
      f.ultima_fecha ?? 'Nunca',
      ...categorias.map((c) => f.por_categoria[c] ?? 0),
    ]);

    const csv = [cabecera, ...cuerpo]
      .map((fila) => fila.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carga_logistica_${d.desde}_${d.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  readonly exportandoXlsx = signal(false);

  /**
   * A diferencia del CSV, este sí se genera en el servidor: son 3 hojas (no
   * solo la tabla visible) y reconstruirlas en el cliente hubiera duplicado
   * el mismo cálculo de reparto/nivel que ya vive en el backend. Usa los
   * filtros del servidor tal cual están (rango, categoría, grupo, sexo,
   * privilegio, persona) — no la búsqueda local por nombre, que solo recorta
   * la vista de esta página.
   */
  exportarXlsx(): void {
    const d = this.data();
    if (!d) return;
    const filtros: LogisticaCargaFiltros = {
      fecha_desde: this.desde,
      fecha_hasta: this.hasta,
      categoria: this.categoria,
      id_grupo: this.idGrupo,
      sexo: this.sexo,
      id_privilegio: this.idPrivilegio,
      id_publicador: this.idPublicador,
    };
    this.exportandoXlsx.set(true);
    this.api.exportarLogisticaXlsx(filtros).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `carga_logistica_${d.desde}_${d.hasta}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.exportandoXlsx.set(false);
      },
      error: () => this.exportandoXlsx.set(false),
    });
  }

  // ── Utilidades ──────────────────────────────────────────────

  private iso(d: Date): string {
    // Local, no toISOString: en husos negativos éste retrocede un día y el
    // rango empezaría el 30 del mes anterior.
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mes}-${dia}`;
  }

  private normalizar(s: string): string {
    return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
}
