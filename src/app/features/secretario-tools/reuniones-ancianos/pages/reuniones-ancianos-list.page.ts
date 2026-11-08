import { Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ReunionAncianosService } from '../../services/reunion-ancianos.service';
import { ESTADO_REUNION_LABEL, EstadoReunion, ReunionOut, ReunionResumen, TIPOS_REUNION, TipoReunion, tipoReunion } from '../../models/reunion-ancianos.model';
import { AuthStore } from '../../../../core/auth/auth.store';
import { puedeEditarActas, puedeGestionarReunionesAncianos } from '../../../../core/auth/acceso-modulos';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LucideAngularModule } from '../../../../shared/icons';
import { cuandoRelativo, diaSemana, diaYMes, fechaCompleta, fechaLocal, hora12, hoyIso, minutosTexto } from '../reunion-ancianos-formato';

type FiltroLista = 'todas' | 'por-convocar' | 'sin-avisar' | 'propuestas' | 'sin-acta' | `tipo:${TipoReunion}`;

/** Minúsculas y sin tildes, para que «reunion» encuentre «Reunión». */
function normalizar(t: string | null | undefined): string {
  return (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Una línea del programa: una parte numerada o una de las dos oraciones. */
interface LineaPrograma {
  clave: string;
  numero: number | null;
  titulo: string;
  persona: string;
  minutos: number | null;
  /** Objetivo (o texto bíblico): solo se ve en pantallas altas. */
  nota: string | null;
}

/**
 * Reuniones de organización: del cuerpo de ancianos, del Comité de Servicio,
 * con los precursores, etc. (el tipo de cada una).
 *
 * La pantalla ocupa exactamente el alto disponible y NO hace scroll de página:
 * lo que no cabe se resuelve dentro del panel que lo contiene (lista de
 * reuniones, programa muy largo), nunca moviendo la pantalla entera.
 *
 *  · Ancho (≥ 56 rem de contenido): a la izquierda el detalle de una reunión
 *    (la próxima, al abrir) con su programa; a la derecha el resumen y la lista
 *    de todas. Tocar una reunión de la lista muestra su detalle a la izquierda
 *    sin salir de la pantalla; editarla es una acción aparte («Editar reunión»).
 *  · Angosto (teléfono, tableta vertical, ventana pequeña): las mismas dos
 *    piezas, una a la vez, con pestañas «Próxima reunión» / «Todas». Al tocar
 *    una reunión en «Todas» se pasa solo al detalle.
 *  · El reparto depende del ancho real del contenido (container queries), no
 *    de la ventana: con el menú lateral abierto o cerrado se acomoda solo.
 *    La densidad (márgenes, renglones) depende del alto de la pantalla.
 *  · En pantallas muy bajas (celular horizontal) rige un alto mínimo y ahí sí
 *    puede haber scroll, para no aplastar el contenido.
 *
 * Los gestores (Coordinador, Secretario, Administrador) ven también los
 * borradores y crean reuniones; los demás solo ven las convocadas y realizadas
 * a las que los convocaron (el backend ya filtra).
 */
@Component({
  selector: 'app-reuniones-ancianos-list',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, EmptyStateComponent, LucideAngularModule],
  template: `
  <div class="ra @container flex-1 min-h-[30rem] w-full flex flex-col gap-3 @3xl:gap-4">

    <!-- ═════════ Cabecera ═════════ -->
    <!-- Sin título visible: el menú ya dice dónde está. El h1 queda para lectores de pantalla. -->
    <h1 class="sr-only">Reuniones teocráticas</h1>

    @if (cargando()) {
      <!-- Esqueleto con la silueta de la pantalla ya cargada -->
      <div class="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)] gap-4 @4xl:grid-cols-[minmax(0,1fr)_18rem] @6xl:grid-cols-[minmax(0,1fr)_22rem]"
           aria-busy="true" aria-label="Cargando reuniones">
        <div class="card-elevated dark:!bg-slate-900 p-5 flex flex-col gap-4 min-h-0 overflow-hidden">
          <div class="flex gap-4"><div class="skeleton h-16 w-16 rounded-2xl"></div>
            <div class="flex-1 flex flex-col gap-2"><div class="skeleton h-4 w-40"></div><div class="skeleton h-7 w-64 max-w-full"></div><div class="skeleton h-4 w-56 max-w-full"></div></div></div>
          @for (_ of [1, 2, 3, 4, 5]; track $index) { <div class="skeleton h-10 w-full"></div> }
        </div>
        <div class="card hidden @4xl:flex p-4 flex-col gap-3 min-h-0 overflow-hidden">
          @for (_ of [1, 2, 3, 4]; track $index) { <div class="skeleton h-12 w-full"></div> }
        </div>
      </div>
    } @else if (error()) {
      <div class="card flex-1 min-h-0 grid place-items-center">
        <app-empty-state variant="error" title="No se pudieron cargar las reuniones"
          description="Revise su conexión e intente de nuevo." actionLabel="Intentar de nuevo" (action)="cargar()" />
      </div>
    } @else if (!reuniones().length) {
      <div class="card flex-1 min-h-0 grid place-items-center">
        <app-empty-state icon="calendar" accent="violet"
          [title]="gestor ? 'Todavía no hay reuniones' : 'No tiene reuniones convocadas'"
          [description]="gestor
            ? 'Cree la primera reunión: elija el tipo, ponga la fecha y las partes. Cuando esté lista, avise a los convocados con «Convocar».'
            : 'Cuando lo convoquen a una reunión, aparecerá aquí y recibirá un aviso.'"
          [actionLabel]="gestor ? 'Nueva reunión' : ''" (action)="nueva()" />
      </div>
    } @else {

      <!-- ═════════ Pestañas (solo anchos angostos) ═════════ -->
      <div class="fila-tabs flex items-stretch gap-2 shrink-0">
      <div class="segmented flex-1 min-w-0" role="tablist" aria-label="Qué quiere ver">
        <button type="button" role="tab" class="segmented-item flex-1" id="tab-proxima" aria-controls="panel-proxima"
                [attr.aria-selected]="vista() === 'programa'" (click)="vista.set('programa')">
          {{ esProximaVisible() ? 'Próxima reunión' : 'Reunión elegida' }}
        </button>
        <button type="button" role="tab" class="segmented-item flex-1" id="tab-todas" aria-controls="panel-todas"
                [attr.aria-selected]="vista() === 'reuniones'" (click)="vista.set('reuniones')">
          Todas<span class="tab-count">{{ reuniones().length }}</span>
        </button>
      </div>
      @if (gestor) {
        <button type="button" class="btn-primary-violet focus-ring shrink-0 justify-center !px-3.5" (click)="nueva()" aria-label="Nueva reunión" title="Nueva reunión">
          <lucide-icon name="plus" [size]="20" aria-hidden="true"></lucide-icon>
        </button>
      }
      </div>

      <div class="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)] gap-4
                  @4xl:grid-cols-[minmax(0,1fr)_18rem] @6xl:grid-cols-[minmax(0,1fr)_22rem] @7xl:grid-cols-[minmax(0,1fr)_26rem] @min-[140rem]:grid-cols-[minmax(0,1fr)_32rem]">

        <!-- ═════════ Próxima reunión + programa ═════════ -->
        <section id="panel-proxima" role="tabpanel" aria-labelledby="tab-proxima"
                 [class]="vista() === 'programa' ? 'flex' : 'hidden @4xl:flex'" class="entra min-h-0 flex-col">
          <article class="card-elevated dark:!bg-slate-900 @container flex-1 min-h-0 flex flex-col overflow-hidden" aria-label="Detalle de la reunión">
            @if (visible(); as p) {
             @for (v of [p]; track v.id_reunion) {

              <!-- Datos de la reunión -->
              <div class="hero cambia panel-datos shrink-0 p-4 @md:p-5 @3xl:p-6 flex flex-wrap items-center gap-x-5 gap-y-3">
                <div class="bloque-fecha shrink-0 rounded-2xl text-center bg-violet-50 dark:bg-violet-500/10 text-brand-purple dark:text-violet-300" aria-hidden="true">
                  <p class="text-xs font-semibold uppercase tracking-wide leading-none">{{ mesCorto(p.fecha) }}</p>
                  <p class="text-3xl @3xl:text-4xl font-bold leading-none mt-1 tabular-nums">{{ dia(p.fecha) }}</p>
                </div>

                <div class="flex-1 min-w-[13rem]">
                  <p class="rotulo-sel eyebrow mb-1.5">{{ rotulo(p) }}</p>
                  <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    @if (tipoCorto(p); as t) { <span class="chip-tipo">{{ t }}</span> }
                    <span class="chip-estado" [attr.data-estado]="p.estado">{{ estadoLabel[p.estado] }}</span>
                    @if (sinAvisar(p)) { <span class="chip-sin-avisar" title="Está confirmada, pero los convocados todavía no recibieron aviso">Sin avisar</span> }
                    <span class="text-sm font-semibold text-slate-600 dark:text-slate-300">{{ relativo(p.fecha) }}</span>
                    @if (p.propuestas_pendientes) {
                      <span class="chip-aviso">
                        <lucide-icon name="lightbulb" [size]="13" aria-hidden="true"></lucide-icon>
                        {{ p.propuestas_pendientes }} {{ p.propuestas_pendientes === 1 ? (gestor ? 'punto por revisar' : 'propuesta suya') : (gestor ? 'puntos por revisar' : 'propuestas suyas') }}
                      </span>
                    }
                  </div>
                  <p class="titulo-fecha font-bold tracking-tight text-slate-900 dark:text-slate-50 mt-1">{{ completa(p.fecha) }}</p>
                  <ul class="meta mt-2">
                    <li><lucide-icon name="clock" [size]="15" aria-hidden="true"></lucide-icon>{{ hora(p.hora) || 'Sin hora' }}</li>
                    <li><lucide-icon name="map-pin" [size]="15" aria-hidden="true"></lucide-icon>{{ p.lugar ? 'Lugar: ' + p.lugar : 'Sin lugar' }}</li>
                    <li class="meta-sec"><lucide-icon name="user" [size]="15" aria-hidden="true"></lucide-icon>{{ p.secretario_nombre ? 'Secretario: ' + p.secretario_nombre : 'Sin secretario' }}</li>
                  </ul>
                </div>

                <!-- Ver el detalle ya está a la vista; editar es una acción aparte -->
                <div class="w-full @lg:w-auto shrink-0 flex flex-col gap-1.5">
                  <div class="flex gap-2">
                    @if (gestor) {
                      <a [routerLink]="ruta(p)" class="btn-primary-violet focus-ring justify-center flex-1">
                        <lucide-icon [name]="textoEditar(p) === 'Editar reunión' ? 'edit-2' : 'send'" [size]="16" aria-hidden="true"></lucide-icon>
                        {{ textoEditar(p) }}
                      </a>
                    } @else {
                      <a [routerLink]="ruta(p)" class="btn-primary-violet focus-ring justify-center flex-1">
                        Ver el programa completo
                        <lucide-icon name="chevron-right" [size]="18" aria-hidden="true"></lucide-icon>
                      </a>
                    }
                    @if (p.id_acta && puedeActas) {
                      <a [routerLink]="['/administracion/actas-reunion', p.id_acta]" class="btn-secondary focus-ring justify-center" title="Abrir el acta de esta reunión">
                        <lucide-icon name="book-open" [size]="16" aria-hidden="true"></lucide-icon>Acta
                      </a>
                    }
                  </div>
                  @if (gestor && (p.estado === 'borrador' || sinAvisar(p)) && p.fecha >= hoy) {
                    <p class="ra-nota text-xs text-center text-slate-500 dark:text-slate-400">Los convocados aún no tienen el aviso.</p>
                  }
                </div>
              </div>

              <!-- Programa -->
              <div class="programa cambia @container flex-1 min-h-0 flex flex-col border-t border-slate-100 dark:border-slate-700/60">
                <!-- Franja propia: separa el programa de los datos de arriba -->
                <div class="franja-programa shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 @md:px-5 @3xl:px-6 py-2.5">
                  <h2 class="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                    <lucide-icon name="file-text" [size]="17" class="text-brand-purple dark:text-violet-300" aria-hidden="true"></lucide-icon>
                    Programa de la reunión
                  </h2>
                  <p class="flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                    <span class="dato-prog">{{ p.num_partes }} {{ p.num_partes === 1 ? 'parte' : 'partes' }}</span>
                    <span class="dato-prog dato-prog-min"><lucide-icon name="clock" [size]="13" aria-hidden="true"></lucide-icon>{{ minutos(p.total_minutos) }}</span>
                  </p>
                </div>

                <div class="lista-interna flex-1 min-h-0 overflow-y-auto px-4 @md:px-5 @3xl:px-6 pb-2">
                  @if (detalle()) {
                    @if (lineas().length > 2) {
                      <ol class="prog" [style.--filas]="filas()">
                        @for (l of lineas(); track l.clave) {
                          <li class="fila" [class.fila-oracion]="l.numero === null">
                            <span class="num" aria-hidden="true">{{ l.numero ?? '' }}</span>
                            <div class="min-w-0">
                              <p class="t" [attr.title]="l.titulo">{{ l.titulo }}</p>
                              <p class="r">{{ l.persona }}</p>
                              @if (l.nota) { <p class="obj">{{ l.nota }}</p> }
                            </div>
                            @if (l.minutos) { <span class="min-pill tabular-nums">{{ l.minutos }} min</span> }
                          </li>
                        }
                      </ol>
                    } @else {
                      <p class="py-6 text-center text-slate-500 dark:text-slate-400">
                        Todavía no tiene partes.
                        @if (gestor) { <a [routerLink]="ruta(p)" class="font-semibold text-brand-purple dark:text-violet-300 hover:underline underline-offset-2">Añadir partes</a> }
                      </p>
                    }
                  } @else if (errorDetalle()) {
                    <p class="py-6 text-center text-slate-500 dark:text-slate-400">No se pudo cargar el programa. Ábrala para verlo.</p>
                  } @else {
                    <div class="flex flex-col gap-2.5 pt-2" aria-busy="true">
                      @for (_ of [1, 2, 3, 4, 5]; track $index) { <div class="skeleton h-9 w-full"></div> }
                    </div>
                  }
                </div>
              </div>
             }

            } @else {
              <!-- No hay ninguna reunión -->
              <div class="flex-1 min-h-0 grid place-items-center p-6 text-center">
                <div class="max-w-sm flex flex-col items-center gap-3">
                  <span class="grid place-items-center w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-500/10 text-brand-purple dark:text-violet-300">
                    <lucide-icon name="calendar" [size]="22" aria-hidden="true"></lucide-icon>
                  </span>
                  <p class="font-semibold text-slate-900 dark:text-slate-100">No hay ninguna reunión programada</p>
                  <p class="text-sm text-slate-600 dark:text-slate-300">
                    {{ gestor ? 'Programe la siguiente: la hora y el lugar se copian de la última.' : 'Cuando lo convoquen a una, aparecerá aquí.' }}
                  </p>
                  @if (gestor) {
                    <button type="button" class="btn-primary-violet focus-ring" (click)="nueva()">
                      <lucide-icon name="plus" [size]="18" aria-hidden="true"></lucide-icon> Programar reunión
                    </button>
                  }
                </div>
              </div>
            }
          </article>
        </section>

        <!-- ═════════ Resumen + lista de reuniones ═════════ -->
        <aside id="panel-todas" role="tabpanel" aria-labelledby="tab-todas"
               [class]="vista() === 'reuniones' ? 'flex' : 'hidden @4xl:flex'" class="entra min-h-0 flex-col gap-3 @4xl:gap-4">

          @if (gestor) {
            <div class="stats shrink-0 grid grid-cols-2 gap-2">
              <div class="tile"><span class="tile-n">{{ resumen().delAnio }}</span><span class="tile-t">Reuniones este año</span></div>
              <div class="tile"><span class="tile-n">{{ resumen().media ? minutos(resumen().media) : '—' }}</span><span class="tile-t">Duración media</span></div>
            </div>
          }

          <section class="card flex-1 min-h-0 flex flex-col overflow-hidden" aria-label="Lista de reuniones">
            <!-- Buscador y filtros -->
            <div class="shrink-0 flex flex-col gap-2 px-3 pt-3 pb-2.5 border-b border-slate-100 dark:border-slate-700/60">
              <div class="flex items-center justify-between gap-3 px-1">
                <h2 class="eyebrow flex items-baseline gap-2">
                  Reuniones
                  <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums normal-case tracking-normal" aria-live="polite">
                    {{ filtrando() ? encontradas().length + ' de ' + reuniones().length : reuniones().length }}
                  </span>
                </h2>
                @if (gestor) {
                  <button type="button" class="btn-primary-violet focus-ring nueva-ancha !py-1.5 !px-3 !text-sm" (click)="nueva()">
                    <lucide-icon name="plus" [size]="16" aria-hidden="true"></lucide-icon>Nueva reunión
                  </button>
                }
              </div>
              <div class="buscador">
                <lucide-icon name="search" [size]="17" class="buscador-lupa" aria-hidden="true"></lucide-icon>
                <input #q type="search" enterkeyhint="search" autocomplete="off" spellcheck="false"
                       [value]="busqueda()" (input)="busqueda.set(q.value)" (keydown.escape)="limpiarBusqueda(q)"
                       placeholder="Tema, lugar o fecha"
                       aria-label="Buscar reuniones por tema, lugar, fecha o hermano"
                       title="Busca en los temas, objetivos, textos bíblicos, responsables, lugar y fecha" />
                @if (busqueda()) {
                  <button type="button" class="buscador-x" (click)="limpiarBusqueda(q)" aria-label="Borrar búsqueda">
                    <lucide-icon name="x" [size]="16" aria-hidden="true"></lucide-icon>
                  </button>
                }
              </div>
              @if (filtros().length) {
                <!-- Tocar un filtro lo activa; tocarlo de nuevo vuelve a mostrar todas -->
                <div class="filtros" role="group" aria-label="Filtrar la lista">
                  @for (f of filtros(); track f.id) {
                    <button type="button" class="filtro" [attr.aria-pressed]="filtro() === f.id"
                            (click)="filtro.set(filtro() === f.id ? 'todas' : f.id)" [attr.title]="f.ayuda">
                      {{ f.texto }}<span class="filtro-n">{{ f.n }}</span>
                      @if (filtro() === f.id) { <lucide-icon name="x" [size]="13" class="-mr-0.5" aria-hidden="true"></lucide-icon> }
                    </button>
                  }
                </div>
              }
            </div>

            <div class="lista-interna flex-1 min-h-0 overflow-y-auto">
              @if (!encontradas().length) {
                <div class="px-5 py-8 flex flex-col items-center gap-2 text-center">
                  <span class="grid place-items-center w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-300">
                    <lucide-icon name="search" [size]="18" aria-hidden="true"></lucide-icon>
                  </span>
                  <p class="font-semibold text-slate-900 dark:text-slate-100">Ninguna reunión coincide</p>
                  <p class="text-sm text-slate-600 dark:text-slate-300">
                    @if (busqueda().trim()) { No se encontró «{{ busqueda().trim() }}». Pruebe con otra palabra. }
                    @else { No hay reuniones con este filtro. }
                  </p>
                  <button type="button" class="btn-secondary focus-ring mt-1" (click)="verTodas(q)">Ver todas</button>
                </div>
              }
              @if (proximasLista().length) {
                <h3 class="anio">Programadas</h3>
                <ul>
                  @for (r of proximasLista(); track r.id_reunion) {
                    <li><ng-container *ngTemplateOutlet="fila; context: { $implicit: r, activa: true }" /></li>
                  }
                </ul>
              }
              @for (g of anterioresPorAnio(); track g.anio) {
                <h3 class="anio">{{ g.anio }}</h3>
                <ul>
                  @for (r of g.reuniones; track r.id_reunion) {
                    <li><ng-container *ngTemplateOutlet="fila; context: { $implicit: r, activa: false }" /></li>
                  }
                </ul>
              }
            </div>
          </section>
        </aside>
      </div>
    }
  </div>

  <!-- Fila de reunión (lista lateral): al tocarla, su detalle se ve a la izquierda -->
  <ng-template #fila let-r let-activa="activa">
    <button type="button" class="fila-lista group focus-visible:outline-none" (click)="seleccionar(r)"
            [attr.aria-current]="visible()?.id_reunion === r.id_reunion ? 'true' : null"
            [attr.aria-label]="'Ver ' + (r.titulo ? r.titulo + ', ' : '') + completa(r.fecha)">
      <div class="hoja-fecha shrink-0" [attr.data-prox]="activa ? 'si' : null" aria-hidden="true">
        <span class="hoja-mes">{{ mesCorto(r.fecha) }}</span>
        <span class="hoja-dia">{{ dia(r.fecha) }}</span>
      </div>
      <div class="flex-1 min-w-0">
        <p class="font-semibold text-slate-900 dark:text-slate-100 break-words" [attr.title]="completa(r.fecha)">
          {{ semana(r.fecha) }}<span class="font-normal text-slate-500 dark:text-slate-400"> · {{ activa ? (hora(r.hora) || 'Sin hora') : (r.num_partes + (r.num_partes === 1 ? ' parte' : ' partes')) }}</span>
        </p>
        <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
          @if (activa) {
            <span class="chip-estado" [attr.data-estado]="r.estado">{{ etiquetaEstado(r.estado) }}</span>
            @if (sinAvisar(r)) { <span class="chip-sin-avisar" title="Está confirmada, pero los convocados todavía no recibieron aviso">Sin avisar</span> }
            @if (r.id_reunion === proxima()?.id_reunion) { <span class="chip-prox">Próxima</span> }
          } @else if (r.id_acta) {
            <span class="chip-acta" data-acta="si" title="Ya tiene acta"><lucide-icon name="check" [size]="13" aria-hidden="true"></lucide-icon>Acta</span>
          } @else if (gestor && llevaActa(r)) {
            <span class="chip-acta" data-acta="no">Sin acta</span>
          }
          <span class="text-sm text-slate-500 dark:text-slate-400 break-words min-w-0">
            @if (tipoCorto(r); as t) {<span class="fila-tipo">{{ t }}</span> · }{{ r.lugar || 'Sin lugar' }}
          </span>
        </div>
        @if (coincidencia(r.id_reunion); as c) {
          <p class="coincide">
            <span class="coincide-et">{{ c.etiqueta }}</span>
            @for (t of resaltar(c.texto); track $index) {@if (t.m) {<mark>{{ t.t }}</mark>} @else {<ng-container>{{ t.t }}</ng-container>}}
          </p>
        }
      </div>
    </button>
  </ng-template>
  `,
  styles: [`
    :host { display: block; }

    /* ── Chips ─────────────────────────────────────────────── */
    .chip-estado {
      display: inline-flex; align-items: center; gap: 0.375rem; flex-shrink: 0;
      padding: 0.1875rem 0.625rem; border-radius: 9999px;
      font-size: 0.75rem; font-weight: 600; border: 1px solid transparent;
    }
    .chip-estado::before { content: ''; width: 0.375rem; height: 0.375rem; border-radius: 9999px; background: currentColor; }
    .chip-estado[data-estado='borrador']  { background: #fffbeb; color: #b45309; border-color: #fde68a; }
    .chip-estado[data-estado='convocada'] { background: #f5f3ff; color: var(--color-brand-purple); border-color: #ddd6fe; }
    .chip-sin-avisar {
      display: inline-flex; align-items: center; padding: 0.1875rem 0.625rem; border-radius: 9999px;
      font-size: 0.75rem; font-weight: 600; border: 1px solid #fde68a; background: #fffbeb; color: #b45309; cursor: default;
    }
    :host-context(.dark) .chip-sin-avisar { background: rgba(245,158,11,0.12); color: #fcd34d; border-color: rgba(245,158,11,0.3); }
    .chip-estado[data-estado='realizada'] { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    :host-context(.dark) .chip-estado[data-estado='borrador']  { background: rgba(245,158,11,0.12); color: #fcd34d; border-color: rgba(245,158,11,0.3); }
    :host-context(.dark) .chip-estado[data-estado='convocada'] { background: rgba(139,92,246,0.14); color: #c4b5fd; border-color: rgba(139,92,246,0.3); }
    :host-context(.dark) .chip-estado[data-estado='realizada'] { background: rgba(16,185,129,0.12); color: #6ee7b7; border-color: rgba(16,185,129,0.3); }

    /* Tipo de reunión: violeta, sin punto, para no confundirse con el estado */
    .chip-tipo {
      display: inline-flex; align-items: center; padding: 0.1875rem 0.625rem; border-radius: 0.5rem;
      font-size: 0.75rem; font-weight: 600; line-height: 1.3; background: #ede9fe; color: #5b21b6;
      overflow-wrap: anywhere;
    }
    :host-context(.dark) .chip-tipo { background: rgba(139,92,246,0.22); color: #ddd6fe; }
    .fila-tipo { font-weight: 600; color: var(--color-brand-purple); }
    :host-context(.dark) .fila-tipo { color: #c4b5fd; }

    .chip-aviso {
      display: inline-flex; align-items: center; gap: 0.3125rem; padding: 0.1875rem 0.625rem;
      border-radius: 9999px; font-size: 0.75rem; font-weight: 600; background: #fffbeb; color: #92400e;
    }
    :host-context(.dark) .chip-aviso { background: rgba(245,158,11,0.12); color: #fcd34d; }

    .chip-acta {
      display: inline-flex; align-items: center; gap: 0.25rem; flex-shrink: 0;
      padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;
    }
    .chip-acta[data-acta='si'] { background: #ecfdf5; color: #047857; }
    .chip-acta[data-acta='no'] { background: #f1f5f9; color: #62748e; }
    :host-context(.dark) .chip-acta[data-acta='si'] { background: rgba(16,185,129,0.12); color: #6ee7b7; }
    :host-context(.dark) .chip-acta[data-acta='no'] { background: rgba(148,163,184,0.12); color: #90a1b9; }

    /* Las pestañas de arriba solo existen mientras los dos paneles no caben
       lado a lado (mismo umbral que @4xl de la rejilla). */
    @container (min-width: 56rem) { .fila-tabs { display: none; } }

    /* ── Tarjeta de la próxima reunión ─────────────────────── */
    .panel-datos { background: linear-gradient(180deg, rgba(139,92,246,0.06), rgba(139,92,246,0.015)); }
    :host-context(.dark) .panel-datos { background: linear-gradient(180deg, rgba(139,92,246,0.10), rgba(139,92,246,0.02)); }
    .bloque-fecha { width: 4rem; padding: 0.5rem 0; }
    @container (min-width: 48rem) { .bloque-fecha { width: 5rem; padding: 0.75rem 0; } }
    /* Teléfono: lo justo arriba (estado, fecha, hora y lugar, botón) para
       dejarle el alto al programa. El título ya dice la fecha. */
    @container (max-width: 27.99rem) {
      .bloque-fecha, .meta .meta-sec, .ra-nota { display: none; }
    }
    /* cqi = ancho de la tarjeta: la fecha crece con el espacio real (720p → 4K) */
    .titulo-fecha { font-size: clamp(1.25rem, 0.9rem + 1.6cqi, 2.25rem); line-height: 1.15; }
    /* Hora, lugar y secretario en cápsulas */
    .meta { display: flex; flex-wrap: wrap; gap: 0.375rem; font-size: 0.875rem; }
    .meta li {
      display: inline-flex; align-items: center; gap: 0.4375rem; min-width: 0; padding: 0.25rem 0.75rem 0.25rem 0.625rem;
      border-radius: 9999px; background: #f5f3ff; border: 1px solid #ddd6fe; color: #4c1d95; font-weight: 500;
    }
    .meta lucide-icon { color: #7c3aed; flex-shrink: 0; }
    :host-context(.dark) .meta li { background: rgba(139,92,246,0.14); border-color: rgba(139,92,246,0.3); color: #ede9fe; }
    :host-context(.dark) .meta lucide-icon { color: #a78bfa; }

    /* ── Programa ──────────────────────────────────────────── */
    .franja-programa { background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    :host-context(.dark) .franja-programa { background: rgba(15,23,42,0.45); border-bottom-color: rgba(148,163,184,0.18); }
    .dato-prog {
      display: inline-flex; align-items: center; gap: 0.3125rem; padding: 0.125rem 0.625rem;
      border-radius: 9999px; font-size: 0.8125rem; font-weight: 600; background: #fff; border: 1px solid #e2e8f0; color: #314158;
    }
    .dato-prog-min { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
    :host-context(.dark) .dato-prog { background: #1d293d; border-color: #314158; color: #e2e8f0; }
    :host-context(.dark) .dato-prog-min { background: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.3); color: #6ee7b7; }
    .prog { display: grid; grid-template-columns: minmax(0, 1fr); padding-right: 0.75rem; }
    @container (min-width: 56rem) { .prog { padding-right: 2.5rem; } }
    @container (min-width: 80rem) { .prog { padding-right: 4.5rem; } }
    .fila {
      display: grid; grid-template-columns: 1.5rem minmax(0, 1fr) auto; align-items: center;
      column-gap: 0.625rem; padding: 0.4375rem 0; border-bottom: 1px solid #f1f5f9;
    }
    :host-context(.dark) .fila { border-color: rgba(148,163,184,0.12); }
    .prog > .fila:last-child { border-bottom: 0; }
    .num { font-size: 0.875rem; font-weight: 700; color: #90a1b9; font-variant-numeric: tabular-nums; text-align: center; }
    /* Los textos nunca se recortan: si no caben en un renglón, pasan al siguiente. */
    .t { font-weight: 600; line-height: 1.3; color: #0f172b; overflow-wrap: break-word; text-wrap: pretty; }
    :host-context(.dark) .t { color: #f1f5f9; }
    .r { font-size: 0.8125rem; font-weight: 500; color: var(--color-brand-purple); }
    :host-context(.dark) .r { color: #c4b5fd; }
    .fila-oracion .t { font-weight: 500; color: #62748e; }
    :host-context(.dark) .fila-oracion .t { color: #90a1b9; }
    .min-pill {
      padding: 0.125rem 0.5rem; border-radius: 9999px; white-space: nowrap;
      font-size: 0.8125rem; font-weight: 600; background: #ecfdf5; color: #047857;
    }
    :host-context(.dark) .min-pill { background: rgba(16,185,129,0.12); color: #6ee7b7; }

    .obj { display: none; font-size: 0.8125rem; line-height: 1.55; color: #62748e; margin-top: 0.1875rem;
           overflow-wrap: break-word; }
    :host-context(.dark) .obj { color: #90a1b9; }

    /* Con ancho suficiente cada parte va en un renglón, como la tabla del PDF:
       número · parte · responsable · minutos (y el objetivo debajo si hay alto). */
    @container (min-width: 34rem) {
      .fila { grid-template-columns: 1.5rem minmax(0, 1fr) minmax(7rem, 12rem) 4.25rem; padding-block: 0.5rem; }
      .fila > div { display: contents; }
      .num { grid-row: 1; grid-column: 1; }
      .t { grid-row: 1; grid-column: 2; }
      .r { grid-row: 1; grid-column: 3; }
      .min-pill { grid-row: 1; grid-column: 4; justify-self: end; }
      /* Solo bajo el título, con un largo de renglón cómodo: no llega hasta el responsable */
      .obj { grid-row: 2; grid-column: 2; max-width: 96ch; padding-right: 1.5rem; }
    }

    /* Pantalla baja y ancha (720p, 768p): dos columnas ordenadas de arriba
       abajo para que el programa entero quepa sin scroll. */
    @media (max-height: 900px) {
      @container (min-width: 40rem) {
        .prog {
          grid-auto-flow: column; grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: repeat(var(--filas, 5), auto); column-gap: 2.5rem;
        }
        .fila { grid-template-columns: 1.5rem minmax(0, 1fr) auto; }
        .fila > div { display: block; }
        .num, .t, .r, .min-pill { grid-row: auto; grid-column: auto; }
      }
    }

    /* ── Lista lateral ─────────────────────────────────────── */
    .fila-lista {
      width: 100%; text-align: left;
      display: flex; align-items: center; gap: 0.75rem; padding: 0.625rem 1rem;
      transition: background-color 150ms ease-out, box-shadow 150ms ease-out;
    }
    /* Fecha en un cuadro liviano. El violeta marca las que aún no pasan. */
    .hoja-fecha {
      width: 2.75rem; padding: 0.4375rem 0; display: flex; flex-direction: column; align-items: center; line-height: 1;
      border-radius: 0.75rem; border: 1px solid #e2e8f0; background: #f8fafc;
    }
    .hoja-fecha[data-prox='si'] { border-color: #ddd6fe; background: #f5f3ff; }
    :host-context(.dark) .hoja-fecha { border-color: #314158; background: rgba(51,65,85,0.35); }
    :host-context(.dark) .hoja-fecha[data-prox='si'] { border-color: rgba(139,92,246,0.4); background: rgba(139,92,246,0.12); }
    .hoja-mes { font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #90a1b9; }
    .hoja-dia { margin-top: 0.1875rem; font-size: 1.375rem; font-weight: 700; font-variant-numeric: tabular-nums; color: #314158; }
    .hoja-fecha[data-prox='si'] .hoja-mes { color: #7c3aed; }
    .hoja-fecha[data-prox='si'] .hoja-dia { color: var(--color-brand-purple); }
    :host-context(.dark) .hoja-mes { color: #62748e; }
    :host-context(.dark) .hoja-dia { color: #e2e8f0; }
    :host-context(.dark) .hoja-fecha[data-prox='si'] .hoja-mes { color: #a78bfa; }
    :host-context(.dark) .hoja-fecha[data-prox='si'] .hoja-dia { color: #c4b5fd; }
    @media (hover: hover) {
      .fila-lista:hover { background: #f8fafc; }
      :host-context(.dark) .fila-lista:hover { background: rgba(255,255,255,0.03); }
    }
    .fila-lista:active { background: #f1f5f9; }
    :host-context(.dark) .fila-lista:active { background: rgba(255,255,255,0.06); }
    /* La reunión que se está viendo a la izquierda */
    .fila-lista[aria-current='true'] { background: #f5f3ff; box-shadow: inset 3px 0 0 #7c3aed; }
    :host-context(.dark) .fila-lista[aria-current='true'] { background: rgba(139,92,246,0.14); box-shadow: inset 3px 0 0 #a78bfa; }
    .fila-lista:focus-visible { box-shadow: inset 0 0 0 2px #8b5cf6; }
    .chip-prox {
      flex-shrink: 0; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600;
      background: #ede9fe; color: var(--color-brand-purple);
    }
    :host-context(.dark) .chip-prox { background: rgba(139,92,246,0.22); color: #ddd6fe; }
    ul > li + li > .fila-lista { border-top: 1px solid #f1f5f9; }
    :host-context(.dark) ul > li + li > .fila-lista { border-top-color: rgba(148,163,184,0.12); }
    .anio {
      position: sticky; top: 0; z-index: 1; padding: 0.375rem 1rem; font-size: 0.75rem; font-weight: 600;
      letter-spacing: 0.06em; color: #62748e; background: #f8fafc;
      border-top: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9;
    }
    .lista-interna > .anio:first-child { border-top: 0; }
    :host-context(.dark) .anio { color: #90a1b9; background: #1d293d; border-color: rgba(148,163,184,0.12); }

    /* En angosto el botón vive junto a las pestañas; en ancho, en la lista */
    @container (max-width: 55.99rem) { .nueva-ancha { display: none; } }

    /* ── Buscador y filtros ─────────────────────────────────── */
    .buscador { position: relative; display: flex; align-items: center; }
    .buscador-lupa { position: absolute; left: 0.75rem; color: #90a1b9; pointer-events: none; }
    .buscador input {
      width: 100%; min-height: 2.5rem; padding: 0.5rem 2.5rem 0.5rem 2.375rem; border-radius: 0.75rem;
      font-size: 0.9375rem; color: #0f172b; background: #f8fafc; border: 1px solid #e2e8f0;
      transition: border-color 150ms ease-out, box-shadow 150ms ease-out, background-color 150ms ease-out;
    }
    .buscador input::placeholder { color: #90a1b9; }
    .buscador input::-webkit-search-cancel-button { display: none; }
    .buscador input:focus { outline: none; background: #fff; border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.18); }
    :host-context(.dark) .buscador input { color: #f1f5f9; background: rgba(15,23,42,0.6); border-color: #314158; }
    :host-context(.dark) .buscador input::placeholder { color: #62748e; }
    :host-context(.dark) .buscador input:focus { background: rgba(15,23,42,0.85); border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.2); }
    .buscador-x {
      position: absolute; right: 0.375rem; display: grid; place-items: center; width: 1.875rem; height: 1.875rem;
      border-radius: 0.5rem; color: #62748e; transition: background-color 150ms ease-out;
    }
    .buscador-x:hover { background: #e2e8f0; }
    :host-context(.dark) .buscador-x { color: #90a1b9; }
    :host-context(.dark) .buscador-x:hover { background: rgba(148,163,184,0.16); }
    .buscador-x:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 0; }

    .filtros { display: flex; flex-wrap: wrap; gap: 0.3125rem; }
    .filtro {
      display: inline-flex; align-items: center; gap: 0.3125rem; min-height: 1.75rem; padding: 0 0.5rem 0 0.625rem;
      border-radius: 9999px; font-size: 0.75rem; font-weight: 600; white-space: nowrap;
      color: #45556c; background: #fff; border: 1px solid #e2e8f0;
      transition: background-color 150ms ease-out, color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out;
    }
    .filtro:active { transform: scale(0.97); }
    .filtro:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 1px; }
    @media (hover: hover) { .filtro:hover { border-color: #c4b5fd; } }
    .filtro[aria-pressed='true'] { background: var(--color-brand-purple); border-color: var(--color-brand-purple); color: #fff; }
    :host-context(.dark) .filtro { color: #cbd5e1; background: transparent; border-color: #314158; }
    :host-context(.dark) .filtro[aria-pressed='true'] { background: #7c3aed; border-color: #7c3aed; color: #fff; }
    .filtro-n {
      min-width: 1.125rem; padding: 0 0.25rem; border-radius: 9999px; font-size: 0.75rem; line-height: 1.125rem;
      text-align: center; font-variant-numeric: tabular-nums; background: rgba(100,116,139,0.14);
    }
    .filtro[aria-pressed='true'] .filtro-n { background: rgba(255,255,255,0.22); }

    /* Dónde coincidió la búsqueda (tema, objetivo, responsable…) */
    .coincide { margin-top: 0.3125rem; font-size: 0.8125rem; line-height: 1.4; color: #45556c; overflow-wrap: break-word; }
    .coincide-et { font-weight: 700; color: #62748e; margin-right: 0.25rem; }
    .coincide mark { background: #fef3c7; color: #78350f; border-radius: 0.1875rem; padding: 0 0.0625rem; }
    :host-context(.dark) .coincide { color: #cbd5e1; }
    :host-context(.dark) .coincide-et { color: #90a1b9; }
    :host-context(.dark) .coincide mark { background: rgba(245,158,11,0.28); color: #fde68a; }

    /* ── Resumen ───────────────────────────────────────────── */
    .tile {
      display: flex; flex-direction: column-reverse; padding: 0.625rem 0.875rem; border-radius: 0.75rem;
      background: #fff; border: 1px solid #e2e8f0;
    }
    :host-context(.dark) .tile { background: #1d293d; border-color: #314158; }
    .tile-n { font-size: 1.375rem; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; color: #0f172b; }
    .tile-t { font-size: 0.75rem; color: #62748e; }
    :host-context(.dark) .tile-n { color: #f1f5f9; }
    :host-context(.dark) .tile-t { color: #90a1b9; }

    /* Scroll interno discreto: solo aparece si la lista no cabe */
    .lista-interna { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.45) transparent; overscroll-behavior: contain; }

    /* ── Densidad según el alto de la pantalla ─────────────── */
    @media (max-height: 800px) {
      .stats, .ra-nota, .rotulo-sel { display: none !important; }
      /* Cabecera de la tarjeta más baja: el título ya dice la fecha completa y
         el secretario sale en el PDF; así el programa entero cabe sin scroll. */
      .hero { padding-block: 0.75rem !important; row-gap: 0.5rem; }
      .bloque-fecha, .meta .meta-sec { display: none; }
      .titulo-fecha { font-size: 1.375rem; }
      .fila { padding: 0.25rem 0; }
      .r { font-size: 0.75rem; }
      .fila-lista { padding-block: 0.4375rem; }
      .hoja-dia { font-size: 1.1875rem; }
    }
    @media (min-height: 1000px) {
      .fila { padding: 0.75rem 0; }
      .obj { display: block; }
      .fila-lista { padding-block: 0.875rem; }
    }
    @media (min-height: 1400px) {
      .fila { padding: 1rem 0; }
      .t { font-size: 1.0625rem; }
    }

    /* Monitores 2K/4K a escala 100 %: todo crece en proporción (como haría el
       sistema operativo con escala 150–200 %) para que se lea a distancia normal
       y el contenido ocupe el alto en vez de quedar diminuto. */
    @media (min-width: 2400px) and (min-height: 1300px) { :host { zoom: 1.2; } }
    @media (min-width: 3200px) and (min-height: 1800px) { :host { zoom: 1.5; } }

    /* Al elegir otra reunión, el detalle aparece con un fundido corto */
    .cambia { animation: cambia 160ms ease-out both; }
    @keyframes cambia { from { opacity: 0; } }

    .entra { animation: entra 220ms cubic-bezier(0.23, 1, 0.32, 1) both; }
    @keyframes entra { from { opacity: 0; transform: translateY(6px); } }
    @media (prefers-reduced-motion: reduce) {
      .entra, .cambia { animation: none; }
      .fila-lista, .filtro, .buscador input { transition: none; }
    }
  `],
})
export class ReunionesAncianosListPage implements OnInit {
  private svc = inject(ReunionAncianosService);
  private router = inject(Router);
  private store = inject(AuthStore);
  private ctx = inject(CongregacionContextService);

  readonly gestor = puedeGestionarReunionesAncianos(this.store);
  readonly estadoLabel: Record<EstadoReunion, string> = ESTADO_REUNION_LABEL;

  reuniones = signal<ReunionResumen[]>([]);
  cargando = signal(true);
  error = signal(false);

  /** Pestaña visible en anchos angostos: la próxima reunión o la lista. */
  vista = signal<'programa' | 'reuniones'>('programa');

  /** Solo el secretario entra al módulo de Actas; los demás leen la carta desde la reunión. */
  readonly puedeActas = puedeEditarActas(this.store);
  readonly hoy = hoyIso();

  /** La reunión que el usuario eligió en la lista (null = la próxima). */
  private seleccionId = signal<number | null>(null);

  /** Programa de la reunión que se está viendo, para mostrarlo sin abrirla. */
  detalle = signal<ReunionOut | null>(null);
  errorDetalle = signal(false);

  /** Oración inicial, partes numeradas y oración final, en el orden del PDF. */
  lineas = computed<LineaPrograma[]>(() => {
    const d = this.detalle();
    if (!d) return [];
    const partes = d.partes.filter(p => p.estado === 'aceptada');
    return [
      { clave: 'ini', numero: null, titulo: 'Oración inicial', persona: d.oracion_inicial_nombre || 'Sin asignar', minutos: null, nota: null },
      ...partes.map((p, i) => ({
        clave: 'p' + p.id_parte, numero: i + 1, titulo: p.titulo,
        persona: p.responsable_nombre || 'Sin responsable', minutos: p.minutos,
        nota: p.objetivo || p.texto_biblico || null,
      })),
      { clave: 'fin', numero: null, titulo: 'Oración final', persona: d.oracion_final_nombre || 'Sin asignar', minutos: null, nota: null },
    ];
  });
  /** Filas por columna cuando el programa se muestra en dos columnas. */
  filas = computed(() => Math.max(1, Math.ceil(this.lineas().length / 2)));

  /** El backend ya ordena: próximas (la más cercana primero) y luego pasadas. */
  proximas = computed(() => {
    const hoy = hoyIso();
    return this.reuniones().filter(r => r.fecha >= hoy && r.estado !== 'realizada');
  });
  proxima = computed(() => this.proximas()[0] ?? null);
  anteriores = computed(() => {
    const proximas = new Set(this.proximas().map(r => r.id_reunion));
    return this.reuniones().filter(r => !proximas.has(r.id_reunion));
  });
  /** La que se ve a la izquierda: la elegida; si no hay, la próxima o la última celebrada. */
  visible = computed(() => {
    const id = this.seleccionId();
    return (id !== null ? this.reuniones().find(r => r.id_reunion === id) : null)
      ?? this.proxima() ?? this.anteriores()[0] ?? null;
  });
  private visibleId = computed(() => this.visible()?.id_reunion ?? null);
  esProximaVisible = computed(() => this.visibleId() !== null && this.visibleId() === this.proxima()?.id_reunion);

  // ── Búsqueda y filtros de la lista ────────────────────────
  busqueda = signal('');
  filtro = signal<FiltroLista>('todas');

  /** Texto normalizado de cada reunión, preparado una sola vez por carga. */
  private indice = computed(() => new Map(this.reuniones().map(r => {
    const partes = (r.partes_busqueda ?? []).map(p => ({
      titulo: p.titulo, responsable: p.responsable ?? '', lineas: p.texto ? p.texto.split('\n') : [],
    }));
    const base = [
      fechaCompleta(r.fecha), r.fecha.slice(0, 4), hora12(r.hora), r.lugar, r.secretario_nombre,
      ESTADO_REUNION_LABEL[r.estado], r.tipo_etiqueta, r.titulo,
    ];
    const todo = normalizar([...base, ...partes.flatMap(p => [p.titulo, p.responsable, ...p.lineas])].filter(Boolean).join(' '));
    return [r.id_reunion, { todo, partes }] as const;
  })));

  private palabras = computed(() => normalizar(this.busqueda()).split(/\s+/).filter(Boolean));
  /** Cada palabra debe coincidir con el comienzo de una palabra («salon» no encuentra «Tesalonicenses»). */
  private patrones = computed(() => this.palabras().map(p =>
    new RegExp('(?<![\\p{L}\\p{N}])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gu')));

  sinAvisar(r: ReunionResumen): boolean {
    return r.estado === 'convocada' && !r.avisada_en;
  }

  /** Los tipos que gestiona el secretario llevan acta; mantenimiento y «otra» no. */
  llevaActa(r: ReunionResumen): boolean {
    return tipoReunion(r.tipo).con_acta;
  }

  private cumpleFiltro(r: ReunionResumen, f: FiltroLista): boolean {
    switch (f) {
      case 'por-convocar': return r.estado === 'borrador' && r.fecha >= this.hoy;
      case 'sin-avisar': return this.sinAvisar(r) && r.fecha >= this.hoy;
      case 'propuestas': return r.propuestas_pendientes > 0;
      case 'sin-acta': return r.fecha < this.hoy && !r.id_acta && this.llevaActa(r);
      case 'todas': return true;
      default: return f === `tipo:${r.tipo}`;
    }
  }

  /** Filtros que tiene sentido ofrecer: solo los que hoy encuentran algo. */
  filtros = computed(() => {
    const todas = this.reuniones();
    const n = (f: FiltroLista) => todas.filter(r => this.cumpleFiltro(r, f)).length;
    const lista: { id: FiltroLista; texto: string; ayuda: string; n: number }[] = [];
    const poner = (id: FiltroLista, texto: string, ayuda: string) => {
      const c = n(id);
      if (c || this.filtro() === id) lista.push({ id, texto, ayuda, n: c });
    };
    if (this.gestor) {
      poner('por-convocar', 'Por convocar', 'Reuniones en borrador: los convocados aún no tienen el aviso');
      poner('sin-avisar', 'Sin avisar', 'Reuniones confirmadas cuyos convocados todavía no recibieron aviso');
      poner('propuestas', 'Por revisar', 'Reuniones con puntos propuestos por revisar');
      poner('sin-acta', 'Sin acta', 'Reuniones pasadas que todavía no tienen acta');
    } else {
      poner('propuestas', 'Mis propuestas', 'Reuniones donde usted propuso puntos');
    }
    // Un filtro por tipo, solo si hay reuniones de más de un tipo.
    if (this.variosTipos()) {
      for (const t of TIPOS_REUNION) {
        if (todas.some(r => r.tipo === t.clave)) poner(`tipo:${t.clave}`, t.etiqueta, `Solo las reuniones de tipo «${t.etiqueta}»`);
      }
    }
    return lista;
  });

  /** Hay reuniones de más de un tipo: entonces cada una dice el suyo. */
  variosTipos = computed(() => new Set(this.reuniones().map(r => r.tipo)).size > 1);

  /**
   * El tipo en pocas palabras, para la tarjeta y la lista: el título propio si
   * lo tiene, si no la etiqueta del tipo. Si todas son del cuerpo de ancianos
   * no se muestra (no aporta nada).
   */
  tipoCorto(r: ReunionResumen): string | null {
    if (!this.variosTipos() && r.tipo === 'ancianos' && !r.titulo_propio) return null;
    return r.titulo_propio || r.tipo_etiqueta || null;
  }

  filtrando = computed(() => this.palabras().length > 0 || this.filtro() !== 'todas');

  /** Las reuniones que se ven en la lista: todas las palabras deben aparecer. */
  encontradas = computed(() => {
    const pat = this.patrones(), f = this.filtro(), idx = this.indice();
    return this.reuniones().filter(r => {
      const todo = idx.get(r.id_reunion)!.todo;
      return this.cumpleFiltro(r, f) && pat.every(re => { re.lastIndex = 0; return re.test(todo); });
    });
  });
  private encontradasIds = computed(() => new Set(this.encontradas().map(r => r.id_reunion)));
  proximasLista = computed(() => this.proximas().filter(r => this.encontradasIds().has(r.id_reunion)));

  /** Si lo buscado está en una parte, cuál: así se ve por qué salió la reunión. */
  private coincidencias = computed(() => {
    const pat = this.patrones(), idx = this.indice();
    const m = new Map<number, { etiqueta: string; texto: string }>();
    if (!pat.length) return m;
    const tiene = (t: string) => { const n = normalizar(t); return pat.some(re => { re.lastIndex = 0; return re.test(n); }); };
    for (const r of this.encontradas()) {
      for (const p of idx.get(r.id_reunion)!.partes) {
        if (tiene(p.titulo)) { m.set(r.id_reunion, { etiqueta: 'Tema:', texto: p.titulo }); break; }
        const linea = p.lineas.find(tiene);
        if (linea) { m.set(r.id_reunion, { etiqueta: p.titulo + ':', texto: linea }); break; }
        if (p.responsable && tiene(p.responsable)) { m.set(r.id_reunion, { etiqueta: p.titulo + ':', texto: p.responsable }); break; }
      }
    }
    return m;
  });

  coincidencia(id: number) {
    return this.coincidencias().get(id) ?? null;
  }

  /** Parte el texto en trozos para marcar lo buscado (sin tildes ni mayúsculas). */
  resaltar(texto: string): { t: string; m: boolean }[] {
    const pat = this.patrones();
    if (!pat.length) return [{ t: texto, m: false }];
    // Un carácter normalizado por cada carácter original, para que los índices coincidan.
    const norm = Array.from(texto, c => normalizar(c).charAt(0) || c).join('');
    const marca = new Array<boolean>(texto.length).fill(false);
    for (const re of pat) {
      for (const x of norm.matchAll(re)) marca.fill(true, x.index!, x.index! + x[0].length);
    }
    const trozos: { t: string; m: boolean }[] = [];
    for (let i = 0; i < texto.length; i++) {
      const ult = trozos[trozos.length - 1];
      if (ult && ult.m === marca[i]) ult.t += texto[i];
      else trozos.push({ t: texto[i], m: marca[i] });
    }
    return trozos;
  }

  limpiarBusqueda(q: HTMLInputElement) {
    this.busqueda.set('');
    q.value = '';
    q.focus();
  }

  verTodas(q: HTMLInputElement) {
    this.filtro.set('todas');
    this.limpiarBusqueda(q);
  }

  anterioresPorAnio = computed(() => {
    const grupos: { anio: string; reuniones: ReunionResumen[] }[] = [];
    const ids = this.encontradasIds();
    for (const r of this.anteriores()) {
      if (!ids.has(r.id_reunion)) continue;
      const anio = r.fecha.slice(0, 4);
      const ultimo = grupos[grupos.length - 1];
      if (ultimo?.anio === anio) ultimo.reuniones.push(r);
      else grupos.push({ anio, reuniones: [r] });
    }
    return grupos;
  });

  resumen = computed(() => {
    const hoy = hoyIso();
    const anio = hoy.slice(0, 4);
    const delAnio = this.reuniones().filter(r => r.fecha.startsWith(anio));
    const conMinutos = delAnio.filter(r => r.total_minutos > 0);
    return {
      delAnio: delAnio.length,
      media: conMinutos.length ? Math.round(conMinutos.reduce((s, r) => s + r.total_minutos, 0) / conMinutos.length) : 0,
    };
  });

  readonly completa = fechaCompleta;
  readonly hora = hora12;
  readonly relativo = cuandoRelativo;
  readonly minutos = minutosTexto;

  /** «Miércoles»: el bloque de color ya dice el día y el mes. */
  semana(iso: string): string {
    const d = diaSemana(iso);
    return d.charAt(0).toUpperCase() + d.slice(1);
  }

  /** Para descartar la respuesta de una reunión que ya no es la elegida. */
  private pedido = 0;

  constructor() {
    // Cada vez que cambia la reunión que se ve, se trae su programa.
    effect(() => {
      const id = this.visibleId();
      untracked(() => this.cargarDetalle(id));
    });
  }

  private cargarDetalle(id: number | null) {
    this.detalle.set(null);
    this.errorDetalle.set(false);
    if (id === null) return;
    const n = ++this.pedido;
    this.svc.get(id).subscribe({
      next: d => { if (n === this.pedido) this.detalle.set(d); },
      error: () => { if (n === this.pedido) this.errorDetalle.set(true); },
    });
  }

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargando.set(true);
    this.error.set(false);
    const idCong = this.store.isAdministrador() ? this.ctx.effectiveCongregacionId() : null;
    this.svc.list(idCong).subscribe({
      next: r => {
        this.reuniones.set(r);
        // En anchos angostos se abre en lo más útil: la próxima, si la hay.
        this.vista.set(this.proxima() ? 'programa' : 'reuniones');
        this.cargando.set(false);
      },
      error: () => { this.error.set(true); this.cargando.set(false); },
    });
  }

  /** Ver el detalle de esta reunión a la izquierda (en el teléfono, pasa a esa pestaña). */
  seleccionar(r: ReunionResumen) {
    this.seleccionId.set(r.id_reunion);
    this.vista.set('programa');
  }

  /** Qué reunión es la que se ve, para el rótulo de la tarjeta. */
  rotulo(r: ReunionResumen): string {
    if (r.id_reunion === this.proxima()?.id_reunion) return 'Próxima reunión';
    return r.fecha >= this.hoy && r.estado !== 'realizada' ? 'Reunión programada' : 'Reunión anterior';
  }

  /** El botón de editar dice lo que de verdad toca hacer con esa reunión. */
  textoEditar(r: ReunionResumen): string {
    return r.estado === 'borrador' && r.fecha >= this.hoy ? 'Revisar y convocar' : 'Editar reunión';
  }

  nueva() {
    this.router.navigate(['/administracion/reuniones-teocraticas', 'nueva']);
  }

  ruta(r: ReunionResumen) {
    return ['/administracion/reuniones-teocraticas', r.id_reunion];
  }

  /** En el ng-template la fila llega sin tipo. */
  etiquetaEstado(estado: EstadoReunion): string {
    return ESTADO_REUNION_LABEL[estado] ?? estado;
  }

  dia(iso: string): number {
    return fechaLocal(iso)?.getDate() ?? 0;
  }

  mesCorto(iso: string): string {
    return diaYMes(iso).split(' de ')[1]?.slice(0, 3) ?? '';
  }
}
