import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ReunionAncianosService } from '../../services/reunion-ancianos.service';
import {
  CategoriaOut, HermanoParticipacion, ParticipacionItem, ParticipacionOut, TIPOS_REUNION, TipoReunion,
} from '../../models/reunion-ancianos.model';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { SelectPickerComponent, PickerOption } from '../../../../shared/components/select-picker/select-picker.component';
import { LucideAngularModule } from '../../../../shared/icons';
import { CategoriasModalComponent } from './categorias-modal.component';
import { diaYMes, fechaCompleta, hoyIso } from '../reunion-ancianos-formato';

type Orden = 'nombre' | 'total' | 'ultima' | `cat:${number}`;

interface FichaHermano {
  h: HermanoParticipacion;
  activo: boolean;
  retirado_en: string | null;
  categorias: { id_categoria: number; etiqueta: string; color: string; icono: string; habilitado: boolean; saldo_inicial: number }[];
}

/**
 * Participación del cuerpo de ancianos: cuántas asignaciones, oraciones,
 * perlas, nombramientos… lleva cada hermano (saldo inicial + reuniones
 * realizadas), quién lleva más tiempo sin participar y la tabla completa con
 * filtros y Excel. Tocar un hermano abre su ficha (historial, saldo y en qué
 * categorías se le considera).
 *
 * Hasta que se configura (fecha de corte), solo muestra cómo empezar.
 */
@Component({
  selector: 'app-participacion-panel',
  standalone: true,
  imports: [
    FormsModule, ModalComponent, EmptyStateComponent, DatePickerComponent, SelectPickerComponent,
    LucideAngularModule, CategoriasModalComponent,
  ],
  template: `
  <div class="pp @container flex flex-col gap-4 pb-6">
    @if (cargando() && !datos()) {
      <div class="grid gap-3 grid-cols-2 @3xl:grid-cols-6" aria-busy="true">@for (_ of [1,2,3,4,5,6]; track $index) { <div class="skeleton h-24"></div> }</div>
      <div class="skeleton h-72"></div>
    } @else if (error()) {
      <div class="card p-6"><app-empty-state variant="error" title="No se pudo cargar la participación" description="Revise su conexión e intente de nuevo."
        actionLabel="Intentar de nuevo" (action)="cargar()" /></div>
    } @else if (datos(); as d) {

      @if (!d.config.configurada) {
        <!-- ══════ Empezar ══════ -->
        <section class="card p-6 @3xl:p-8 max-w-2xl mx-auto w-full flex flex-col gap-5">
          <div class="flex items-start gap-4">
            <span class="icono-grande"><lucide-icon name="users" [size]="26" aria-hidden="true"></lucide-icon></span>
            <div>
              <h2 class="section-title">Lleve la cuenta de quién ha participado</h2>
              <p class="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-prose">
                Verá cuántas asignaciones, oraciones, perlas y nombramientos lleva cada hermano, quién lleva más tiempo sin participar,
                y al asignar una parte le sugerirá a quién le toca.
              </p>
            </div>
          </div>
          <ol class="pasos-config">
            <li>
              <span class="form-label">Desde cuándo cuenta GAC</span>
              <app-date-picker colorScheme="violet" [fieldLike]="true" [(ngModel)]="corte" placeholder="Fecha de corte" [maxDate]="hoy" />
              <p class="caption mt-1">Lo de antes se pone como saldo inicial de cada hermano (después, en «Hermanos»). Desde el día siguiente cuentan solas las reuniones realizadas en GAC.</p>
            </li>
            <li>
              <span class="form-label">Qué reuniones cuentan</span>
              <div class="flex flex-wrap gap-2">
                @for (t of tiposElegibles; track t.clave) {
                  <button type="button" class="chip-opcion" role="checkbox" [attr.aria-checked]="tiposSel.has(t.clave)" (click)="alternarTipo(t.clave)">
                    @if (tiposSel.has(t.clave)) { <lucide-icon name="check" [size]="14" aria-hidden="true"></lucide-icon> }{{ t.etiqueta }}
                  </button>
                }
              </div>
            </li>
          </ol>
          <button type="button" class="btn-primary self-start" [disabled]="!corte || !tiposSel.size || guardando()" (click)="guardarConfig()">
            @if (guardando()) { <span class="spinner-sm" aria-hidden="true"></span> } Empezar a contar
          </button>
        </section>

      } @else {

        <!-- ══════ Encabezado ══════ -->
        <div class="flex flex-wrap items-start gap-3">
          <div class="flex-1 min-w-[16rem]">
            <h2 class="section-title">Participación del cuerpo de ancianos</h2>
            <p class="caption mt-0.5">Saldo inicial al {{ fechaCorta(d.config.fecha_corte) }} + {{ d.reuniones }} {{ d.reuniones === 1 ? 'reunión realizada' : 'reuniones realizadas' }} en GAC{{ filtroFechas() ? ' (en el rango elegido)' : '' }}.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-secondary" (click)="categoriasAbierto.set(true)"><lucide-icon name="tag" [size]="16" aria-hidden="true"></lucide-icon>Categorías</button>
            <button type="button" class="btn-secondary" (click)="abrirConfig()"><lucide-icon name="settings" [size]="16" aria-hidden="true"></lucide-icon>Ajustes</button>
            <button type="button" class="btn-secondary" [disabled]="exportando()" (click)="excel()">
              @if (exportando()) { <span class="spinner-sm" aria-hidden="true"></span> } @else { <lucide-icon name="download" [size]="16" aria-hidden="true"></lucide-icon> }Excel
            </button>
          </div>
        </div>

        <!-- ══════ Cifras ══════ -->
        <div class="cifras">
          <div class="card tile"><span class="tile-n">{{ visibles().length }}</span><span class="tile-t">Hermanos</span></div>
          <div class="card tile"><span class="tile-n">{{ totalGeneral() }}</span><span class="tile-t">Participaciones</span></div>
          @for (c of d.categorias; track c.id_categoria) {
            <div class="card tile cat-color" [attr.data-color]="c.color">
              <span class="tile-ico"><lucide-icon [name]="c.icono" [size]="16" aria-hidden="true"></lucide-icon></span>
              <span class="tile-n">{{ totalCat(c) }}</span>
              <span class="tile-t">{{ c.plural }} <span class="opacity-90">· {{ porcentaje(totalCat(c)) }}%</span></span>
            </div>
          }
        </div>

        <!-- ══════ Gráficos ══════ -->
        <div class="graficos">
          <section class="card p-4 @3xl:p-5" aria-labelledby="t-por-hermano">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 id="t-por-hermano" class="card-title">Por hermano</h3>
              <ul class="leyenda" aria-label="Colores">
                @for (c of d.categorias; track c.id_categoria) { <li class="cat-color" [attr.data-color]="c.color"><span></span>{{ c.plural }}</li> }
              </ul>
            </div>
            <ul class="barras">
              @for (h of porTotal(); track h.id_publicador) {
                <li>
                  <button type="button" class="barra-fila" (click)="abrirFicha(h)" [attr.aria-label]="h.nombre + ': ' + h.total + ' participaciones. Ver ficha'">
                    <span class="barra-nombre">{{ h.nombre }}</span>
                    <span class="barra-pista" aria-hidden="true">
                      @for (c of d.categorias; track c.id_categoria) {
                        @if (h.por_categoria[c.id_categoria]?.total) {
                          <span class="barra-seg cat-color" [attr.data-color]="c.color" [style.width.%]="(h.por_categoria[c.id_categoria].total / maximo()) * 100"
                                [title]="c.plural + ': ' + h.por_categoria[c.id_categoria].total"></span>
                        }
                      }
                    </span>
                    <span class="barra-n">{{ h.total }}</span>
                  </button>
                </li>
              }
            </ul>
          </section>

          <section class="card p-4 @3xl:p-5" aria-labelledby="t-sin-participar">
            <h3 id="t-sin-participar" class="card-title">Llevan más tiempo sin participar</h3>
            <p class="caption mt-0.5 mb-3">Primero quienes no tienen ninguna con fecha.</p>
            <ol class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              @for (h of masTiempo(); track h.id_publicador; let i = $index) {
                <li>
                  <button type="button" class="fila-simple" (click)="abrirFicha(h)">
                    <span class="caption tabular-nums w-4">{{ i + 1 }}</span>
                    <span class="flex-1 font-semibold text-left text-slate-900 dark:text-slate-100">{{ h.nombre }}</span>
                    <span class="caption">{{ h.dias === null ? 'Sin fecha' : h.dias === 0 ? 'Hoy' : 'Hace ' + h.dias + (h.dias === 1 ? ' día' : ' días') }}</span>
                  </button>
                </li>
              }
            </ol>
            @if (sinNinguna().length) {
              <p class="caption mt-3">Sin participaciones: {{ sinNinguna().join(', ') }}.</p>
            }
          </section>
        </div>

        <!-- ══════ Tabla ══════ -->
        <section class="card overflow-hidden" aria-labelledby="t-tabla">
          <div class="p-4 flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800">
            <h3 id="t-tabla" class="card-title">Participaciones por hermano</h3>
            <div class="filtros">
              <label class="search-field flex-1 min-w-[12rem]">
                <lucide-icon name="search"></lucide-icon>
                <input class="search-input" placeholder="Buscar hermano" aria-label="Buscar hermano" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)" />
              </label>
              <app-select-picker class="w-48" colorScheme="violet" ariaLabel="Categoría" [options]="opcionesCategoria()" [clearable]="false" [searchable]="false"
                [ngModel]="filtroCat()" (ngModelChange)="filtroCat.set($event)" />
              <app-date-picker class="w-40" colorScheme="violet" [fieldLike]="true" placeholder="Desde" [ngModel]="desde()" (ngModelChange)="cambiarFecha('desde', $event)" />
              <app-date-picker class="w-40" colorScheme="violet" [fieldLike]="true" placeholder="Hasta" [ngModel]="hasta()" (ngModelChange)="cambiarFecha('hasta', $event)" />
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" class="w-5 h-5 accent-current" [ngModel]="soloCero()" (ngModelChange)="soloCero.set($event)" />Solo sin participaciones
              </label>
              <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input type="checkbox" class="w-5 h-5" [ngModel]="conRetirados()" (ngModelChange)="conRetirados.set($event); cargar()" />Incluir retirados
              </label>
            </div>
          </div>
          <div class="table-wrapper overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr>
                  <th class="table-header-cell text-left"><button type="button" class="orden" (click)="ordenar('nombre')">Hermano {{ flecha('nombre') }}</button></th>
                  @for (c of categoriasTabla(); track c.id_categoria) {
                    <th class="table-header-cell text-right"><button type="button" class="orden ml-auto" (click)="ordenar(ordenCat(c))">{{ c.plural }} {{ flecha(ordenCat(c)) }}</button></th>
                  }
                  <th class="table-header-cell text-right"><button type="button" class="orden ml-auto" (click)="ordenar('total')">Total {{ flecha('total') }}</button></th>
                  <th class="table-header-cell text-left"><button type="button" class="orden" (click)="ordenar('ultima')">Última participación {{ flecha('ultima') }}</button></th>
                </tr>
              </thead>
              <tbody>
                @for (h of tabla(); track h.id_publicador) {
                  <tr class="table-row cursor-pointer" (click)="abrirFicha(h)">
                    <td class="table-cell font-semibold text-slate-900 dark:text-slate-100">
                      {{ h.nombre }}
                      @if (!h.es_anciano || h.retirado_en) { <span class="badge-neutral ml-1">Retirado</span> }
                      @else if (!h.activo) { <span class="badge-warning ml-1">Inactivo</span> }
                      @else if (!h.total) { <span class="badge-warning ml-1">Sin registros</span> }
                    </td>
                    @for (c of categoriasTabla(); track c.id_categoria) {
                      <td class="table-cell text-right tabular-nums" [class.text-slate-400]="!h.por_categoria[c.id_categoria]?.habilitado">
                        {{ h.por_categoria[c.id_categoria]?.total ?? 0 }}
                      </td>
                    }
                    <td class="table-cell text-right tabular-nums font-bold">{{ totalFila(h) }}</td>
                    <td class="table-cell text-slate-600 dark:text-slate-300">{{ h.ultima ? fechaCorta(h.ultima) + ' · ' + hace(h.dias) : 'Sin fecha registrada' }}</td>
                  </tr>
                } @empty {
                  <tr><td class="table-cell text-center text-slate-500" [attr.colspan]="categoriasTabla().length + 3">Nadie coincide con estos filtros.</td></tr>
                }
              </tbody>
              @if (tabla().length) {
                <tfoot>
                  <tr class="font-bold">
                    <td class="table-cell">Total</td>
                    @for (c of categoriasTabla(); track c.id_categoria) { <td class="table-cell text-right tabular-nums">{{ sumaTabla(c.id_categoria) }}</td> }
                    <td class="table-cell text-right tabular-nums">{{ sumaTabla(null) }}</td>
                    <td class="table-cell"></td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        </section>
        <p class="caption">La cantidad no mide la idoneidad espiritual de nadie: es una ayuda para repartir el trabajo. Decide el cuerpo de ancianos.</p>
      }
    }
  </div>

  <!-- ══════ Ficha del hermano ══════ -->
  <app-modal [open]="!!ficha()" (closed)="ficha.set(null)" [title]="ficha()?.h?.nombre || 'Hermano'" variant="drawer" size="lg" [hasFooter]="true"
             subtitle="Historial y ajustes para la participación">
    @if (ficha(); as f) {
      <div class="flex flex-col gap-5">
        <div class="grid gap-2 grid-cols-3">
          <div class="card-section !p-3"><p class="caption">Total</p><p class="tile-n">{{ f.h.total }}</p></div>
          <div class="card-section !p-3"><p class="caption">Programadas</p><p class="tile-n">{{ f.h.programadas }}</p></div>
          <div class="card-section !p-3"><p class="caption">Última</p><p class="text-sm font-semibold mt-1">{{ f.h.ultima ? fechaCorta(f.h.ultima) : 'Sin fecha' }}</p></div>
        </div>

        <section>
          <h4 class="card-title mb-2">Ajustes</h4>
          <label class="flex items-center gap-3 py-2">
            <button type="button" role="switch" class="switch" [attr.aria-checked]="f.activo" aria-label="Activo" (click)="f.activo = !f.activo"><span class="toggle-thumb"></span></button>
            <span class="text-sm"><strong class="block text-slate-900 dark:text-slate-100">Activo</strong><span class="caption">Inactivo: no se le sugieren partes (enfermedad, viaje largo…).</span></span>
          </label>
          <div class="mt-2 max-w-xs">
            <span class="form-label">Retirado desde <span class="font-normal text-slate-500">(si dejó de ser anciano)</span></span>
            <app-date-picker colorScheme="violet" [fieldLike]="true" placeholder="No se ha retirado" [(ngModel)]="f.retirado_en" />
          </div>
        </section>

        <section>
          <h4 class="card-title">Por categoría</h4>
          <p class="caption mb-2">El saldo es lo que ya había hecho hasta el {{ fechaCorta(datos()?.config?.fecha_corte ?? null) }}.</p>
          <ul class="flex flex-col gap-2">
            @for (c of f.categorias; track c.id_categoria) {
              <li class="card-section !p-3 flex flex-wrap items-center gap-3">
                <span class="cat-chip" [attr.data-color]="c.color"><lucide-icon [name]="c.icono"></lucide-icon>{{ c.etiqueta }}</span>
                <span class="flex-1"></span>
                @if (!c.habilitado) { <span class="badge-neutral">No se le considera</span> }
                <span class="text-sm">Saldo <strong class="text-slate-900 dark:text-slate-100">{{ c.saldo_inicial }}</strong></span>
              </li>
            }
          </ul>
        </section>

        <section>
          <h4 class="card-title mb-2">Historial</h4>
          @if (cargandoHistorial()) {
            <div class="flex flex-col gap-2">@for (_ of [1,2,3]; track $index) { <div class="skeleton h-10"></div> }</div>
          } @else if (historial().length) {
            <ul class="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              @for (it of historial(); track $index) {
                <li class="py-2.5 flex items-start gap-3">
                  <span class="caption w-24 shrink-0 tabular-nums pt-0.5">{{ fechaCorta(it.fecha) }}</span>
                  <span class="flex-1 min-w-0">
                    <span class="block text-sm font-medium text-slate-900 dark:text-slate-100">{{ it.titulo }}</span>
                    <span class="flex flex-wrap gap-1.5 mt-1">
                      @if (catPorId().get(it.id_categoria ?? -1); as c) { <span class="cat-chip" [attr.data-color]="c.color">{{ c.etiqueta }}</span> }
                      @if (it.estado === 'programada') { <span class="badge-info">Programada · no suma</span> }
                      @else if (it.en_saldo) { <span class="badge-neutral" title="Es anterior a la fecha de corte: ya está contada en el saldo inicial">Documenta el saldo</span> }
                    </span>
                  </span>
                </li>
              }
            </ul>
          } @else {
            <p class="text-sm text-slate-500 dark:text-slate-400">Todavía no tiene participaciones con fecha en GAC.</p>
          }
        </section>
      </div>
    }
    <div slot="footer" class="flex gap-3">
      <button type="button" class="btn-ghost" (click)="ficha.set(null)">Cerrar</button>
      <button type="button" class="btn-primary" [disabled]="guardando()" (click)="guardarFicha()">
        @if (guardando()) { <span class="spinner-sm" aria-hidden="true"></span> } Guardar cambios
      </button>
    </div>
  </app-modal>

  <!-- ══════ Ajustes de la cuenta ══════ -->
  <app-modal [open]="configAbierta()" (closed)="configAbierta.set(false)" title="Ajustes de la participación" size="md" [hasFooter]="true">
    <div class="flex flex-col gap-5">
      <div>
        <span class="form-label">Fecha de corte</span>
        <app-date-picker colorScheme="violet" [fieldLike]="true" [(ngModel)]="corte" [maxDate]="hoy" />
        <p class="caption mt-1">Hasta esta fecha cuenta el saldo inicial; desde el día siguiente, las reuniones realizadas.</p>
      </div>
      <div>
        <span class="form-label">Qué reuniones cuentan</span>
        <div class="flex flex-wrap gap-2">
          @for (t of tiposElegibles; track t.clave) {
            <button type="button" class="chip-opcion" role="checkbox" [attr.aria-checked]="tiposSel.has(t.clave)" (click)="alternarTipo(t.clave)">
              @if (tiposSel.has(t.clave)) { <lucide-icon name="check" [size]="14" aria-hidden="true"></lucide-icon> }{{ t.etiqueta }}
            </button>
          }
        </div>
      </div>
    </div>
    <div slot="footer" class="flex gap-3">
      <button type="button" class="btn-ghost" (click)="configAbierta.set(false)">Cancelar</button>
      <button type="button" class="btn-primary" [disabled]="!corte || !tiposSel.size || guardando()" (click)="guardarConfig()">Guardar</button>
    </div>
  </app-modal>

  <app-categorias-modal [open]="categoriasAbierto()" (openChange)="categoriasAbierto.set($event)" [idCongregacion]="idCongregacion" (cambiaron)="cargar()" />
  `,
  styles: [`
    :host { display: block; }
    .icono-grande { flex-shrink: 0; width: 3.25rem; height: 3.25rem; border-radius: 1rem; display: grid; place-items: center; color: var(--accent); background: color-mix(in oklab, var(--accent) 10%, transparent); }
    .pasos-config { display: flex; flex-direction: column; gap: 1.25rem; counter-reset: paso; }
    .pasos-config > li { position: relative; padding-left: 2.25rem; }
    .pasos-config > li::before { counter-increment: paso; content: counter(paso); position: absolute; left: 0; top: 0; width: 1.5rem; height: 1.5rem; border-radius: 9999px;
      display: grid; place-items: center; font-size: 0.75rem; font-weight: 700; color: #fff; background: var(--accent); }
    .chip-opcion { display: inline-flex; align-items: center; gap: 0.375rem; min-height: 2.5rem; padding: 0 0.875rem; border-radius: 9999px; font-size: 0.875rem; font-weight: 600;
      border: 1px solid var(--color-slate-300); color: var(--color-slate-700); transition: background-color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out; }
    .chip-opcion:active { transform: scale(0.97); }
    .chip-opcion[aria-checked='true'] { border-color: var(--accent); color: var(--accent); background: color-mix(in oklab, var(--accent) 8%, transparent); }
    :host-context(.dark) .chip-opcion { border-color: var(--color-slate-700); color: var(--color-slate-200); }
    :host-context(.dark) .chip-opcion[aria-checked='true'] { color: color-mix(in oklab, var(--accent) 45%, white); }
    .chip-opcion:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 2px; }

    .cifras { display: grid; gap: 0.75rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    @container (min-width: 40rem) { .cifras { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @container (min-width: 64rem) { .cifras { grid-template-columns: repeat(6, minmax(0, 1fr)); } }
    .tile { padding: 0.875rem 1rem; display: flex; flex-direction: column; gap: 0.125rem; position: relative; }
    .tile.cat-color { background: var(--color-white); }
    :host-context(.dark) .tile.cat-color { background: var(--color-slate-900); }
    .tile-ico { width: 1.75rem; height: 1.75rem; border-radius: 0.5rem; display: grid; place-items: center; color: var(--cat); background: color-mix(in oklab, var(--cat) 12%, transparent); margin-bottom: 0.25rem; }
    .tile-n { font-family: var(--font-display, inherit); font-size: 1.5rem; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; color: var(--color-slate-900); }
    :host-context(.dark) .tile-n { color: var(--color-slate-50); }
    .tile-t { font-size: 0.75rem; font-weight: 600; color: var(--color-slate-600); }
    :host-context(.dark) .tile-t { color: var(--color-slate-300); }

    .graficos { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); }
    @container (min-width: 64rem) { .graficos { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); } }
    .leyenda { display: flex; flex-wrap: wrap; gap: 0.25rem 0.875rem; font-size: 0.75rem; font-weight: 600; color: var(--color-slate-600); }
    :host-context(.dark) .leyenda { color: var(--color-slate-300); }
    .leyenda li { display: inline-flex; align-items: center; gap: 0.375rem; background: none !important; border: 0 !important; }
    .leyenda li > span { width: 0.625rem; height: 0.625rem; border-radius: 0.1875rem; background: var(--cat); }
    .barras { display: flex; flex-direction: column; gap: 0.25rem; }
    .barra-fila { width: 100%; display: grid; grid-template-columns: minmax(7rem, 11rem) minmax(0, 1fr) 2rem; align-items: center; gap: 0.75rem;
      padding: 0.3125rem 0.375rem; border-radius: 0.5rem; transition: background-color 150ms ease-out; }
    .barra-fila:hover { background: var(--color-slate-50); }
    :host-context(.dark) .barra-fila:hover { background: rgb(255 255 255 / 0.04); }
    .barra-fila:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 1px; }
    .barra-nombre { font-size: 0.875rem; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-slate-800); }
    :host-context(.dark) .barra-nombre { color: var(--color-slate-100); }
    .barra-pista { display: flex; gap: 2px; height: 0.875rem; border-radius: 0.25rem; overflow: hidden; background: var(--color-slate-100); }
    :host-context(.dark) .barra-pista { background: var(--color-slate-800); }
    .barra-seg { display: block; height: 100%; background: var(--cat) !important; border: 0 !important; transition: width 400ms cubic-bezier(0.23, 1, 0.32, 1); }
    .barra-n { font-size: 0.875rem; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
    .fila-simple { width: 100%; display: flex; align-items: center; gap: 0.75rem; min-height: 2.75rem; padding: 0 0.25rem; border-radius: 0.5rem; }
    .fila-simple:hover { background: var(--color-slate-50); }
    :host-context(.dark) .fila-simple:hover { background: rgb(255 255 255 / 0.04); }

    .filtros { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; }
    .orden { display: inline-flex; align-items: center; gap: 0.25rem; font: inherit; }
    .orden:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 2px; border-radius: 0.25rem; }
    @media (prefers-reduced-motion: reduce) { .barra-seg { transition: none; } .chip-opcion:active { transform: none; } }
  `],
})
export class ParticipacionPanelComponent implements OnInit {
  private svc = inject(ReunionAncianosService);
  private toast = inject(ToastService);

  @Input() idCongregacion: number | null = null;

  readonly hoy = hoyIso();
  readonly tiposElegibles = TIPOS_REUNION.filter(t => t.con_acta);

  datos = signal<ParticipacionOut | null>(null);
  cargando = signal(true);
  error = signal(false);
  guardando = signal(false);
  exportando = signal(false);
  configAbierta = signal(false);
  categoriasAbierto = signal(false);

  busqueda = signal('');
  filtroCat = signal<number | 'todas'>('todas');
  desde = signal<string | null>(null);
  hasta = signal<string | null>(null);
  soloCero = signal(false);
  conRetirados = signal(false);
  orden = signal<Orden>('total');
  asc = signal(false);

  ficha = signal<FichaHermano | null>(null);
  historial = signal<ParticipacionItem[]>([]);
  cargandoHistorial = signal(false);

  corte: string | null = null;
  tiposSel = new Set<TipoReunion>(['ancianos', 'ancianos_sc']);

  ngOnInit() { this.cargar(); }

  cargar() {
    this.cargando.set(true);
    this.error.set(false);
    this.svc.participacion({ desde: this.desde(), hasta: this.hasta(), conRetirados: this.conRetirados() }, this.idCongregacion).subscribe({
      next: d => {
        this.datos.set(d);
        this.cargando.set(false);
        if (!d.config.configurada) this.corte = this.hoy;
      },
      error: () => { this.cargando.set(false); this.error.set(true); },
    });
  }

  // ── Configuración ────────────────────────────────────────────────────────

  alternarTipo(t: TipoReunion) {
    if (this.tiposSel.has(t)) this.tiposSel.delete(t); else this.tiposSel.add(t);
  }

  abrirConfig() {
    const c = this.datos()?.config;
    this.corte = c?.fecha_corte ?? this.hoy;
    this.tiposSel = new Set((c?.tipos_que_cuentan ?? ['ancianos', 'ancianos_sc']) as TipoReunion[]);
    this.configAbierta.set(true);
  }

  guardarConfig() {
    if (!this.corte) return;
    this.guardando.set(true);
    this.svc.guardarConfigParticipacion(this.corte, [...this.tiposSel], this.idCongregacion).subscribe({
      next: () => { this.guardando.set(false); this.configAbierta.set(false); this.toast.success('Listo', 'La participación ya se está contando.'); this.cargar(); },
      error: (e: HttpErrorResponse) => { this.guardando.set(false); this.toast.error('No se pudo guardar', detalle(e)); },
    });
  }

  // ── Cálculos ─────────────────────────────────────────────────────────────

  visibles = computed(() => this.datos()?.hermanos ?? []);
  catPorId = computed(() => new Map((this.datos()?.categorias ?? []).map(c => [c.id_categoria, c])));
  totalCat(c: CategoriaOut): number { return this.visibles().reduce((s, h) => s + (h.por_categoria[c.id_categoria]?.total ?? 0), 0); }
  totalGeneral = computed(() => this.visibles().reduce((s, h) => s + h.total, 0));
  porcentaje(n: number): number { const t = this.totalGeneral(); return t ? Math.round((n / t) * 100) : 0; }
  porTotal = computed(() => [...this.visibles()].sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es')));
  maximo = computed(() => Math.max(1, ...this.visibles().map(h => h.total)));
  filtroFechas = computed(() => !!(this.desde() || this.hasta()));

  masTiempo = computed(() => [...this.visibles()]
    .filter(h => h.activo && h.es_anciano && !h.retirado_en)
    .sort((a, b) => (a.ultima === null ? -1 : 0) - (b.ultima === null ? -1 : 0) || (b.dias ?? 1e9) - (a.dias ?? 1e9) || a.total - b.total)
    .slice(0, 5));
  sinNinguna = computed(() => this.visibles().filter(h => !h.total).map(h => h.nombre));

  opcionesCategoria = computed<PickerOption[]>(() => [
    { value: 'todas', label: 'Todas las categorías' },
    ...(this.datos()?.categorias ?? []).map(c => ({ value: c.id_categoria, label: c.plural })),
  ]);
  categoriasTabla = computed(() => {
    const f = this.filtroCat();
    const cats = this.datos()?.categorias ?? [];
    return f === 'todas' ? cats : cats.filter(c => c.id_categoria === f);
  });

  totalFila(h: HermanoParticipacion): number {
    const f = this.filtroCat();
    return f === 'todas' ? h.total : h.por_categoria[f]?.total ?? 0;
  }

  tabla = computed(() => {
    const q = normalizar(this.busqueda());
    const o = this.orden(), asc = this.asc() ? 1 : -1;
    const valor = (h: HermanoParticipacion): number | string => {
      if (o === 'nombre') return h.nombre.toLowerCase();
      if (o === 'total') return this.totalFila(h);
      if (o === 'ultima') return h.ultima ?? '';
      return h.por_categoria[Number(o.slice(4))]?.total ?? 0;
    };
    return this.visibles()
      .filter(h => !q || normalizar(h.nombre).includes(q))
      .filter(h => !this.soloCero() || this.totalFila(h) === 0)
      .sort((a, b) => {
        const va = valor(a), vb = valor(b);
        const c = typeof va === 'string' ? va.localeCompare(vb as string, 'es') : (va as number) - (vb as number);
        return c * asc || a.nombre.localeCompare(b.nombre, 'es');
      });
  });

  sumaTabla(idCat: number | null): number {
    return this.tabla().reduce((s, h) => s + (idCat === null ? this.totalFila(h) : h.por_categoria[idCat]?.total ?? 0), 0);
  }

  ordenar(o: Orden) {
    if (this.orden() === o) this.asc.update(a => !a);
    else { this.orden.set(o); this.asc.set(o === 'nombre'); }
  }
  ordenCat(c: CategoriaOut): Orden { return `cat:${c.id_categoria}`; }
  flecha(o: Orden): string { return this.orden() === o ? (this.asc() ? '↑' : '↓') : ''; }

  cambiarFecha(cual: 'desde' | 'hasta', v: string | null) {
    (cual === 'desde' ? this.desde : this.hasta).set(v);
    this.cargar();
  }

  fechaCorta(iso: string | null): string {
    if (!iso) return '—';
    const anio = iso.slice(0, 4);
    return `${diaYMes(iso)}${anio !== this.hoy.slice(0, 4) ? ' de ' + anio : ''}`;
  }
  hace(dias: number | null): string {
    if (dias === null) return '';
    return dias === 0 ? 'hoy' : `hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
  }
  readonly fechaCompleta = fechaCompleta;

  // ── Ficha ────────────────────────────────────────────────────────────────

  abrirFicha(h: HermanoParticipacion) {
    const cats = this.datos()?.categorias ?? [];
    this.ficha.set({
      h, activo: h.activo, retirado_en: h.retirado_en,
      categorias: cats.map(c => ({
        id_categoria: c.id_categoria, etiqueta: c.etiqueta, color: c.color, icono: c.icono,
        habilitado: h.por_categoria[c.id_categoria]?.habilitado ?? true,
        saldo_inicial: h.por_categoria[c.id_categoria]?.saldo ?? 0,
      })),
    });
    this.cargandoHistorial.set(true);
    this.historial.set([]);
    this.svc.historialHermano(h.id_publicador, this.idCongregacion).subscribe({
      next: it => { this.historial.set(it); this.cargandoHistorial.set(false); },
      error: () => this.cargandoHistorial.set(false),
    });
  }

  guardarFicha() {
    const f = this.ficha();
    if (!f) return;
    this.guardando.set(true);
    this.svc.guardarHermano(f.h.id_publicador, {
      activo: f.activo, retirado_en: f.retirado_en || null,
      categorias: f.categorias.map(c => ({ id_categoria: c.id_categoria, habilitado: c.habilitado, saldo_inicial: Math.max(0, Math.round(Number(c.saldo_inicial) || 0)) })),
    }, this.idCongregacion).subscribe({
      next: () => { this.guardando.set(false); this.ficha.set(null); this.toast.success('Cambios guardados'); this.cargar(); },
      error: (e: HttpErrorResponse) => { this.guardando.set(false); this.toast.error('No se pudo guardar', detalle(e)); },
    });
  }

  excel() {
    this.exportando.set(true);
    this.svc.exportarParticipacion({ desde: this.desde(), hasta: this.hasta(), conRetirados: this.conRetirados() }, this.idCongregacion).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Participacion_hermanos_${this.hoy}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.exportando.set(false);
      },
      error: () => { this.exportando.set(false); this.toast.error('No se pudo descargar el Excel', 'Intente de nuevo.'); },
    });
  }
}

function normalizar(t: string): string {
  return (t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function detalle(e: HttpErrorResponse): string {
  return typeof e?.error?.detail === 'string' ? e.error.detail : 'Intente de nuevo.';
}
