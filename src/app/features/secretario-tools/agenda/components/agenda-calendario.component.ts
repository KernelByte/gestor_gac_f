import { Component, DestroyRef, ElementRef, HostListener, Injector, OnInit, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, catchError, forkJoin, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AvisoComponent } from '../../../../shared/components/aviso/aviso.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { TareaCrearModalComponent } from '../../../herramientas/mis-tareas/components/tarea-crear-modal.component';
import { RecordatoriosModalComponent } from './recordatorios-modal.component';
import { AgendaService } from '../../services/agenda.service';
import { EventoAgenda, ModoAgenda, TIPOS_EVENTO, TipoEvento } from '../../models/agenda.model';
import { esCoordinador, modoAgenda } from '../../../../core/auth/acceso-modulos';
import { DIAS, MESES, desdeIso, fechaLarga, hoyIso, iso, relativo, sumarDias } from '../agenda-fechas';

interface Celda {
  fecha: string;
  dia: number;
  otroMes: boolean;
  esHoy: boolean;
  eventos: EventoAgenda[];
  /** Nombre del festivo si el día lo es. */
  festivo?: string;
}

interface Grupo {
  clave: string;
  titulo: string;
  tono: 'rojo' | 'rosa' | 'normal';
  eventos: EventoAgenda[];
}

/** Para hoy, o ya empezado y sin terminar (la visita del SC en curso): lo pendiente que no está atrasado ni es futuro. */
function esDeHoy(e: EventoAgenda, hoy: string): boolean {
  return e.estado !== 'vencido' && !!e.fecha && e.fecha <= hoy;
}

const CLAVE_AVISO_TAREAS = 'agenda_aviso_tareas_cerrado';
function leerAvisoTareasCerrado(): boolean {
  try { return localStorage.getItem(CLAVE_AVISO_TAREAS) === '1'; } catch { return false; }
}

/** Semanas completas (lunes a domingo) que cubren un mes: de la que contiene el día 1 a la que contiene el último. */
function rangoDelMes(anio: number, mes: number): { desde: string; hasta: string } {
  const primero = new Date(anio, mes - 1, 1);
  const ultimo = new Date(anio, mes, 0);
  return {
    desde: sumarDias(iso(primero), -((primero.getDay() + 6) % 7)),
    hasta: sumarDias(iso(ultimo), (7 - ultimo.getDay()) % 7),
  };
}

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DIAS_LARGOS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Lo que no escala con la pantalla: separación entre píldoras, margen bajo el número y relleno de la celda (px). */
const SEPARACION = 4;
const MARGEN_NUMERO = 6;
const CELDA_PADDING = 12;
const MEDIA_ANCHA = '(min-width: 1280px)';

/**
 * Vista «Calendario» de la Agenda (la del secretario o la personal; la elige AgendaPage).
 *
 * Desde 1280px la página ocupa exactamente la ventana: el calendario reparte
 * el alto entre las semanas y cada celda muestra tantas píldoras como caben
 * (medido con ResizeObserver), y el panel lateral es lo único que hace scroll.
 * En teléfono y tableta vertical se lee como lista: "Lo que viene" primero y
 * luego los días del mes, con el detalle del día en una hoja inferior.
 */
@Component({
  selector: 'app-agenda-calendario',
  standalone: true,
  imports: [CommonModule, TareaCrearModalComponent, RecordatoriosModalComponent, AvisoComponent],
  // AgendaService lo provee AgendaPage, ya en el modo de esta persona.
  // Sin gap en el host: los modales son hermanos de .agenda y sumarían huecos.
  host: { class: 'flex flex-col xl:flex-1 xl:min-h-0' },
  template: `
  <div class="agenda flex flex-col gap-3 xl:gap-4 xl:flex-1 xl:min-h-0">

    <!-- ── Barra superior ─────────────────────────────────────── -->
    <header class="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div class="flex items-center gap-1.5">
        <button type="button" (click)="cambiarMes(-1)" aria-label="Mes anterior" class="icono-btn">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/></svg>
        </button>
        <h2 class="mes-titulo" aria-live="polite">{{ nombreMes() }} <span class="text-slate-600 dark:text-slate-400 font-semibold">{{ anio() }}</span></h2>
        <button type="button" (click)="cambiarMes(1)" aria-label="Mes siguiente" class="icono-btn">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/></svg>
        </button>
        <button type="button" (click)="irAHoy()" class="btn-hoy" [class.invisible]="esMesActual()" [attr.aria-hidden]="esMesActual()" [attr.tabindex]="esMesActual() ? -1 : null">Hoy</button>
      </div>

      <div class="flex flex-wrap items-center gap-2 ml-auto">
        <!-- Qué tipos se ven: un solo botón con los colores de la leyenda; el menú trae nombre y cantidad. -->
        <div class="filtro-wrap" (click)="$event.stopPropagation()">
          <button type="button" id="btn-tipos" class="btn-secondary" (click)="filtrosAbiertos.set(!filtrosAbiertos())"
                  [attr.aria-expanded]="filtrosAbiertos()" aria-haspopup="true" aria-controls="menu-tipos" aria-label="Filtrar por tipo de pendiente">
            <span class="puntos" aria-hidden="true">
              @for (t of tipos; track t) { <span class="chip-dot" [ngClass]="ocultos().has(t) ? 'bg-slate-300 dark:bg-slate-600' : estilo(t).dot"></span> }
            </span>
            <span>Filtrar</span>
            @if (ocultos().size) { <span class="filtro-n">{{ tipos.length - ocultos().size }}/{{ tipos.length }}</span> }
          </button>
          @if (filtrosAbiertos()) {
            <div class="popover" id="menu-tipos" role="group" aria-label="Mostrar u ocultar cada tipo">
              @for (t of tipos; track t) {
                <label class="op">
                  <input type="checkbox" class="sr-only" [checked]="!ocultos().has(t)" (change)="alternarTipo(t)"/>
                  <span class="op-check" aria-hidden="true">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3.4" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7"/></svg>
                  </span>
                  <span class="chip-dot" [ngClass]="estilo(t).dot"></span>
                  <span class="flex-1 min-w-0 truncate">{{ estilo(t).label }}</span>
                  <span class="op-n">{{ conteo()[t] ?? 0 }}</span>
                </label>
              }
              @if (ocultos().size) { <button type="button" class="op-todos" (click)="ocultos.set(emptySet)">Mostrar todos</button> }
            </div>
          }
        </div>
        @if (!soloExhibidor) {
          <button type="button" class="btn-secondary" (click)="recordatoriosAbierto.set(true)">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16 9.35h5V4.36M3 19.64v-5h5M3.6 9.35a8.25 8.25 0 0 1 13.8-3.7l3.18 3.18M3.4 14.65l3.18 3.18a8.25 8.25 0 0 0 13.8-3.7"/></svg>
            <span>Recordatorios periódicos</span>
          </button>
        }
      </div>

    </header>

    @if (!conTareas && !avisoTareasCerrado()) {
      <app-aviso tone="info" title="Sus tareas no aparecen en esta agenda.">
        Para verlas y crearlas aquí, pida al administrador el permiso «Ver Mis Tareas».
        <button type="button" class="btn-secondary btn-sm block mt-2" (click)="cerrarAvisoTareas()">Entendido</button>
      </app-aviso>
    }

    @if (sinCongregacion()) {
      <app-aviso tone="info" title="Elija una congregación.">
        La agenda es de cada congregación: escójala en el selector del menú lateral.
      </app-aviso>
    } @else if (errorCarga()) {
      <app-aviso tone="danger" title="No se pudo cargar la agenda.">
        Revise su conexión e inténtelo otra vez.
        <button type="button" class="btn-primary btn-sm block mt-2" (click)="recargar()">Reintentar</button>
      </app-aviso>
    }

    <!-- ═══ Escritorio: calendario + panel ═══ -->
    @if (esAncho()) {
      <div class="cuerpo flex-1 min-h-0 grid gap-4">
        <section class="superficie relative flex flex-col min-h-0 overflow-hidden" aria-label="Calendario del mes" [attr.aria-busy]="cargando()">
          <!-- Solo se ve si la carga tarda (aparece a los 250 ms): lo normal es que el mes cambie al instante. -->
          @if (cargando()) { <div class="barra" aria-hidden="true"></div> }
          <div class="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700/80">
            @for (d of diasCortos; track d; let i = $index) {
              <div class="dia-cab"
                   [class.dia-cab--finde]="i >= 5">
                <span class="mbp:hidden">{{ d }}</span><span class="hidden mbp:inline">{{ diasLargos[i] }}</span>
              </div>
            }
          </div>

          <p id="ayuda-calendario" class="sr-only">Use las flechas para moverse entre días, Inicio y Fin para ir al lunes o al domingo, Re Pág y Av Pág para cambiar de mes, y Enter para abrir el día.</p>
          <div #semanasEl class="semanas flex-1 min-h-0 grid" [style.grid-template-rows]="'repeat(' + semanas().length + ', minmax(0, 1fr))'">
            @for (semana of semanas(); track $index) {
              <div class="grid grid-cols-7 min-h-0">
                @for (c of semana; track c.fecha) {
                  <button type="button" class="celda" (click)="seleccionar(c.fecha)" (keydown)="teclaCelda($event, c)"
                          [attr.data-fecha]="c.fecha" [attr.tabindex]="fechaTab() === c.fecha ? 0 : -1"
                          [attr.aria-describedby]="fechaTab() === c.fecha ? 'ayuda-calendario' : null"
                          [class.celda--otro]="c.otroMes" [class.celda--sel]="diaSeleccionado() === c.fecha" [class.celda--festivo]="!!c.festivo"
                          [attr.aria-label]="etiquetaDia(c)" [attr.aria-pressed]="diaSeleccionado() === c.fecha">
                    <span class="celda-num" [class.celda-num--hoy]="c.esHoy">{{ c.dia }}</span>
                    @if (c.festivo) { <span class="marca-festivo" [title]="c.festivo">Festivo</span> }
                    <span class="flex flex-col gap-1 min-w-0">
                      @for (e of c.eventos | slice:0:visibles(c.eventos.length); track e.id) {
                        <span class="pildora" [ngClass]="claseEvento(e)" [class.pildora--multi]="lineas(c.eventos.length) > 1" [style.--lineas]="lineas(c.eventos.length)" [title]="e.titulo">
                          @if (e.estado === 'vencido') {
                            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" d="M12 6v7M12 17.5h.01"/></svg>
                          } @else if (e.estado === 'hecho') {
                            <svg class="w-3 h-3 shrink-0" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7"/></svg>
                          }
                          <span class="pildora-txt">{{ lineas(c.eventos.length) > 1 ? e.titulo : (e.titulo_corto || e.titulo) }}</span>
                        </span>
                      }
                      @if (c.eventos.length > visibles(c.eventos.length)) {
                        <span class="mas">+{{ c.eventos.length - visibles(c.eventos.length) }} más</span>
                      }
                    </span>
                  </button>
                }
              </div>
            }
          </div>
        </section>

        <aside class="superficie flex flex-col min-h-0 overflow-hidden">
          @if (celdaSeleccionada(); as d) {
            <div class="panel-cabecera">
              <button type="button" class="volver" (click)="diaSeleccionado.set(null)">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/></svg>
                Lo que viene
              </button>
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto px-3 pb-3 panel-entra" [attr.data-k]="d.fecha">
              <ng-container *ngTemplateOutlet="detalleDia; context: { $implicit: d }"/>
            </div>
          } @else {
            <div class="panel-cabecera">
              <h2 class="panel-titulo">Lo que viene</h2>
            </div>
            <div class="flex-1 min-h-0 overflow-y-auto px-2 pb-3 panel-entra">
              <ng-container *ngTemplateOutlet="loQueViene"/>
            </div>
          }
        </aside>
      </div>
    } @else {
      <!-- ═══ Teléfono / tableta vertical ═══ -->
      <section class="superficie" aria-label="Lo que viene">
        <div class="px-4 pt-4 flex flex-col gap-2">
          <h2 class="panel-titulo">Lo que viene</h2>
        </div>
        <div class="px-1 pb-2"><ng-container *ngTemplateOutlet="loQueViene"/></div>
      </section>

      <section class="superficie overflow-hidden" [attr.aria-label]="'Días de ' + nombreMesVista()">
        <h2 class="panel-titulo px-4 pt-4 pb-1 first-letter:uppercase">{{ nombreMesVista() }}</h2>
        <!-- Mes en miniatura: sirve para elegir cualquier día, también uno sin nada, y ver de un vistazo dónde hay cosas. -->
        <div class="mini px-2 pb-2">
          @for (d of diasCortos; track d) { <span class="mini-cab" aria-hidden="true">{{ d.charAt(0) }}</span> }
          @for (c of semanas().flat(); track c.fecha) {
            <button type="button" class="mini-dia" [class.mini-dia--otro]="c.otroMes" [class.mini-dia--hoy]="c.esHoy"
                    [class.mini-dia--sel]="diaSeleccionado() === c.fecha" [class.mini-dia--festivo]="!!c.festivo"
                    [attr.aria-label]="etiquetaDia(c)" (click)="seleccionar(c.fecha)">
              <span>{{ c.dia }}</span>
              <span class="mini-puntos" aria-hidden="true">
                @for (e of c.eventos | slice:0:3; track e.id) { <span class="chip-dot" [ngClass]="estilo(e.tipo).dot"></span> }
              </span>
            </button>
          }
        </div>
        @if (hayFestivosMes()) {
          <p class="leyenda-festivo"><span class="leyenda-festivo-muestra" aria-hidden="true"></span> Los días en amarillo son festivos.</p>
        }
        @if (!cargando() && !diasConEventos().length) {
          <p class="px-4 pb-5 text-base text-slate-600 dark:text-slate-300">No hay nada este mes.</p>
        }
        @for (c of diasConEventos(); track c.fecha) {
          <button type="button" (click)="seleccionar(c.fecha)" class="dia-fila" [class.dia-fila--hoy]="c.esHoy">
            <span class="w-11 shrink-0 text-center">
              <span class="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{{ diaCorto(c.fecha) }}</span>
              <span class="block font-display font-extrabold text-2xl leading-none text-slate-900 dark:text-slate-100">{{ c.dia }}</span>
            </span>
            <span class="flex-1 min-w-0 flex flex-col gap-1">
              @for (e of c.eventos; track e.id) {
                <span class="pildora pildora--lista" [ngClass]="claseEvento(e)"><span class="line-clamp-2">{{ e.titulo }}</span></span>
              }
            </span>
          </button>
        }
      </section>

      @if (celdaSeleccionada(); as d) {
        <div class="hoja-fondo" (click)="diaSeleccionado.set(null)"></div>
        <div #hojaEl class="hoja" role="dialog" aria-modal="true" tabindex="-1" [attr.aria-label]="larga(d.fecha)" (keydown)="teclaHoja($event)">
          <!-- Asa y cabecera: se arrastran hacia abajo para cerrar (un empujón rápido basta). -->
          <div class="hoja-cab" (pointerdown)="arrastreInicio($event)" (pointermove)="arrastreMueve($event)"
               (pointerup)="arrastreFin($event)" (pointercancel)="arrastreFin($event)">
          <div class="hoja-asa" aria-hidden="true"></div>
          <div class="flex justify-end px-3">
            <button type="button" (click)="diaSeleccionado.set(null)" aria-label="Cerrar" class="icono-btn">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          </div>
          </div>
          <div class="px-4 pb-6 overflow-y-auto">
            <ng-container *ngTemplateOutlet="detalleDia; context: { $implicit: d }"/>
          </div>
        </div>
      }
    }

    <!-- ═══ Lo que viene (lista agrupada) ═══ -->
    <ng-template #loQueViene>
      @if (cargandoProximos()) {
        <div class="space-y-2 p-2">
          <div class="skeleton h-14 rounded-lg"></div><div class="skeleton h-14 rounded-lg"></div><div class="skeleton h-14 rounded-lg"></div>
        </div>
      } @else if (!grupos().length) {
        <div class="py-10 px-4 text-center">
          <span class="inline-flex w-11 h-11 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7"/></svg>
          </span>
          <p class="mt-3 text-base font-semibold text-slate-800 dark:text-slate-100">Todo al día</p>
          <p class="text-sm text-slate-500 dark:text-slate-400">Nada pendiente en las próximas dos semanas.</p>
          <!-- Sin ocupar espacio fijo: el que empieza descubre aquí los recordatorios periódicos. -->
          <button type="button" class="pista" (click)="recordatoriosAbierto.set(true)">
            ¿Algo que repetir cada cierto tiempo? Agregue un recordatorio periódico
          </button>
        </div>
      } @else {
        @for (g of grupos(); track g.clave) {
          <section class="mt-3 first:mt-1">
            <h3 class="grupo-titulo" [ngClass]="'grupo-titulo--' + g.tono">
              {{ g.titulo }} <span class="font-semibold">{{ g.eventos.length }}</span>
            </h3>
            <ul>
              @for (e of g.eventos | slice:0:visiblesGrupo(g); track e.id) {
                <li><ng-container *ngTemplateOutlet="fila; context: { $implicit: e, compacta: true, grupo: g.clave }"/></li>
              }
            </ul>
            @if (g.eventos.length > visiblesGrupo(g)) {
              <button type="button" class="ver-mas" (click)="expandirGrupo(g.clave)">
                Ver {{ g.eventos.length - visiblesGrupo(g) }} más
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m19 9-7 7-7-7"/></svg>
              </button>
            } @else if (g.eventos.length > POR_GRUPO && gruposAbiertos().has(g.clave)) {
              <button type="button" class="ver-mas" (click)="expandirGrupo(g.clave)">
                Ver menos
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m5 15 7-7 7 7"/></svg>
              </button>
            }
          </section>
        }
      }
    </ng-template>

    <!-- ═══ Detalle de un día ═══ -->
    <ng-template #detalleDia let-d>
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0 mb-1.5">
        <h2 class="font-display font-extrabold text-lg leading-tight text-slate-900 dark:text-slate-50 first-letter:uppercase">{{ larga(d.fecha) }}</h2>
        <span class="text-sm font-semibold text-rose-700 dark:text-rose-300">{{ relativo(d.fecha) }}</span>
      </div>
      @if (d.festivo) {
        <p class="aviso-festivo"><span class="marca-festivo marca-festivo--fija">Festivo</span> {{ d.festivo }}</p>
      }
      @if (!d.eventos.length) {
        <p class="text-sm text-slate-600 dark:text-slate-300 mb-1">No hay nada para este día.</p>
      }
      <ul class="-mx-1.5">
        @for (e of d.eventos; track e.id) {
          <li><ng-container *ngTemplateOutlet="fila; context: { $implicit: e, compacta: false }"/></li>
        }
      </ul>
      @if (conTareas && !esPasado(d.fecha)) {
        <button type="button" class="btn-primary w-full justify-center mt-2 !h-9 !text-sm" (click)="nuevaTarea(d.fecha)">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path stroke-linecap="round" d="M12 5v14m-7-7h14"/></svg>
          Nueva tarea este día
        </button>
      }
    </ng-template>

    <!-- ═══ Una fila de evento ═══ -->
    <ng-template #fila let-e let-compacta="compacta" let-grupo="grupo">
      @if (compacta) {
        <!-- En la lista corta toda la fila abre; solo "Ya lo hice" queda como botón aparte. -->
        <div class="fila fila--compacta" [class.fila--hecho]="e.estado === 'hecho'">
          @if (e.ruta || e.enlace) {
            <button type="button" class="fila-abrir" (click)="abrir(e)">
              <ng-container *ngTemplateOutlet="filaTexto; context: { $implicit: e, grupo: grupo }"/>
              <svg class="fila-flecha" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" aria-hidden="true">
                @if (e.ruta) { <path stroke-linecap="round" stroke-linejoin="round" d="m9 5 7 7-7 7"/> }
                @else { <path stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/> }
              </svg>
            </button>
          } @else {
            <div class="fila-abrir fila-abrir--quieta"><ng-container *ngTemplateOutlet="filaTexto; context: { $implicit: e, grupo: grupo }"/></div>
          }
          @if (e.se_puede_marcar) {
            <button type="button" class="hecho-btn" [class.hecho-btn--deshacer]="e.estado === 'hecho'" [disabled]="marcando() === e.id" (click)="marcar(e)">
              @if (e.estado === 'hecho') { Desmarcar } @else {
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7"/></svg>
                Ya lo hice
              }
            </button>
          }
        </div>
      } @else {
      <div class="fila" [class.fila--hecho]="e.estado === 'hecho'">
        <span class="fila-dot" [ngClass]="estilo(e.tipo).dot"></span>
        <div class="flex-1 min-w-0">
          <p class="fila-titulo">{{ e.titulo }}</p>
          <p class="fila-meta">
            @if (e.estado === 'vencido') { <span class="font-semibold text-red-700 dark:text-red-400">Atrasado · </span> }
            @if (e.en_progreso && e.estado !== 'hecho') { <span class="font-semibold text-sky-700 dark:text-sky-300">En progreso · </span> }
            {{ estilo(e.tipo).label }}
            @if (compacta && e.fecha) { · {{ relativo(e.fecha) }} }
            @if (e.fecha_fin) { · hasta el {{ larga(e.fecha_fin) }} }
            @if (!e.fecha) { · sin fecha }
          </p>
          @if (e.detalle && !compacta) { <p class="fila-detalle">{{ e.detalle }}</p> }
          @if (e.se_puede_marcar || e.ruta || e.enlace) {
            <div class="flex flex-wrap gap-1.5 mt-2">
              @if (e.se_puede_marcar) {
                <button type="button" class="accion" [class.accion--ok]="e.estado !== 'hecho'" [disabled]="marcando() === e.id" (click)="marcar(e)">
                  @if (e.estado === 'hecho') { Desmarcar } @else {
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7"/></svg>
                    Ya lo hice
                  }
                </button>
              }
              @if (e.enlace) {
                <a class="accion" [href]="e.enlace" target="_blank" rel="noopener">
                  Abrir la página
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>
                </a>
              }
              @if (e.ruta) { <button type="button" class="accion" (click)="abrir(e)">Abrir</button> }
            </div>
          }
        </div>
      </div>
      }
    </ng-template>

    <!-- Título y una sola línea de contexto; lo que ya dice el título del grupo no se repite. -->
    <ng-template #filaTexto let-e let-grupo="grupo">
      <span class="fila-dot" [ngClass]="estilo(e.tipo).dot"></span>
      <span class="flex-1 min-w-0">
        <span class="fila-titulo block">{{ e.titulo }}</span>
        <span class="fila-meta block">
          @if (e.en_progreso && e.estado !== 'hecho') { <span class="font-semibold text-sky-700 dark:text-sky-300">En progreso · </span> }
          {{ metaCompacta(e, grupo) }}
        </span>
      </span>
    </ng-template>
  </div>

  <!-- Fuera de .agenda: dentro sumarían dos gaps vacíos bajo el calendario. -->
  <!-- Los modales salen del primer paquete: se descargan cuando el navegador está libre, antes de que alguien los abra. -->
  @defer (on idle) {
    <app-tarea-crear-modal [open]="modalTarea()" [fechaInicial]="fechaNuevaTarea()"
                           (openChange)="modalTarea.set($event)" (creada)="recargar()"/>
    <app-recordatorios-modal [open]="recordatoriosAbierto()" (openChange)="recordatoriosAbierto.set($event)"
                             [modo]="modo" [coordinador]="esCoordinador"
                             (cambiado)="recargar()"/>
  }
  `,
  styles: [`
    :host { --accent: #e11d48; --accent-hover: #be123c; --accent-focus: #e11d48; --accent-ring: color-mix(in oklab, #e11d48 20%, transparent); --accent-shadow: 0 6px 16px -8px rgb(225 29 72 / 0.6); --ease: var(--ease-out-strong, cubic-bezier(0.23, 1, 0.32, 1)); }

    /* Panel lateral de ancho fluido: 280px mínimo, ~19% hasta 360px en pantallas grandes. */
    .cuerpo { grid-template-columns: minmax(0, 1fr) clamp(280px, 19vw, 360px); grid-template-rows: minmax(0, 1fr); }
    /* El panel mide lo que su contenido; si hay mucho, tope al alto de la pantalla y scroll interno. */
    .cuerpo > aside { align-self: start; max-height: 100%; }

    .superficie {
      background: #fff; border: 1px solid rgb(226 232 240); border-radius: 16px; box-shadow: var(--shadow-card);
    }
    :host-context(.dark) .superficie { background: rgb(15 23 42); border-color: rgb(30 41 59 / 0.8); box-shadow: none; }

    /* ── Barra ── */
    .mes-titulo {
      font-family: var(--font-display, inherit); font-weight: 800; font-size: 1.5rem; line-height: 1;
      min-width: 12.5rem; text-align: center; text-transform: capitalize; color: rgb(15 23 42); letter-spacing: -0.01em;
    }
    :host-context(.dark) .mes-titulo { color: rgb(248 250 252); }
    .icono-btn {
      width: 40px; height: 40px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px;
      color: rgb(71 85 105); transition: background var(--duration-fast, 120ms) ease, transform 100ms var(--ease);
    }
    .icono-btn:hover { background: rgb(241 245 249); color: rgb(15 23 42); }
    .icono-btn:active { transform: scale(0.94); }
    :host-context(.dark) .icono-btn { color: rgb(203 213 225); }
    :host-context(.dark) .icono-btn:hover { background: rgb(51 65 85); color: #fff; }
    .btn-hoy {
      margin-left: 4px; height: 32px; padding: 0 12px; border-radius: 999px; font-size: 13px; font-weight: 700;
      color: rgb(225 29 72); background: rgb(255 241 242); transition: background var(--duration-fast, 120ms) ease;
    }
    .btn-hoy:hover { background: rgb(255 228 230); }
    :host-context(.dark) .btn-hoy { color: rgb(253 164 175); background: rgb(136 19 55 / 0.35); }


    .chip-dot { width: 8px; height: 8px; border-radius: 999px; flex-shrink: 0; }
    .puntos { display: inline-flex; align-items: center; gap: 3px; }
    .filtro-n { font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; color: rgb(225 29 72); }
    :host-context(.dark) .filtro-n { color: rgb(253 164 175); }

    /* Menú de tipos: nace en su botón (esquina superior derecha), no en el centro. */
    .filtro-wrap { position: relative; }
    .popover {
      position: absolute; right: 0; top: calc(100% + 6px); z-index: 40; width: min(260px, calc(100vw - 32px)); padding: 6px; border-radius: 14px;
      background: #fff; border: 1px solid rgb(226 232 240); box-shadow: 0 12px 32px -8px rgb(15 23 42 / 0.25);
      transform-origin: top right; animation: popin 150ms var(--ease);
    }
    :host-context(.dark) .popover { background: rgb(15 23 42); border-color: rgb(30 41 59); box-shadow: 0 12px 32px -8px rgb(0 0 0 / 0.6); }
    @keyframes popin { from { opacity: 0; transform: scale(0.96); } }
    .op {
      display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 10px; border-radius: 9px; cursor: pointer;
      font-size: 14px; font-weight: 600; color: rgb(30 41 59); transition: background var(--duration-fast, 120ms) ease;
    }
    .op:hover { background: rgb(248 250 252); }
    .op:has(input:focus-visible) { outline: 2px solid rgb(244 63 94); outline-offset: -2px; }
    :host-context(.dark) .op { color: rgb(226 232 240); }
    :host-context(.dark) .op:hover { background: rgb(51 65 85 / 0.6); }
    .op-check {
      width: 18px; height: 18px; border-radius: 6px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      border: 1.5px solid rgb(148 163 184); color: transparent; transition: background 150ms var(--ease), border-color 150ms var(--ease), color 150ms var(--ease);
    }
    .op input:checked ~ .op-check { background: #e11d48; border-color: #e11d48; color: #fff; }
    .op-n { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; color: rgb(100 116 139); }
    :host-context(.dark) .op-n { color: rgb(148 163 184); }
    .op-todos { display: block; width: 100%; margin-top: 2px; padding: 8px 10px; text-align: left; font-size: 13px; font-weight: 600; color: rgb(225 29 72); border-top: 1px solid rgb(226 232 240); border-radius: 0 0 9px 9px; }
    .op-todos:hover { background: rgb(255 241 242); }
    :host-context(.dark) .op-todos { color: rgb(253 164 175); border-color: rgb(30 41 59); }
    :host-context(.dark) .op-todos:hover { background: rgb(136 19 55 / 0.3); }

    .pista { margin-top: 10px; max-width: 240px; font-size: 13px; line-height: 1.4; font-weight: 600; color: rgb(225 29 72); text-decoration: underline; text-underline-offset: 3px; border-radius: 6px; }
    .pista:hover { color: rgb(190 18 60); }
    :host-context(.dark) .pista { color: rgb(253 164 175); }
    :host-context(.dark) .pista:hover { color: #fff; }
    @media (pointer: coarse) { .pista { min-height: 44px; } }


    /* ── Calendario ── */
    .celda {
      position: relative; display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; text-align: left;
      padding: 6px; border-right: 1px solid rgb(226 232 240); border-bottom: 1px solid rgb(226 232 240);
      transition: background var(--duration-fast, 120ms) ease;
    }
    .celda:nth-child(7n) { border-right: 0; }
    .semanas > div:last-child .celda { border-bottom: 0; }
    .celda:hover { background: rgb(255 241 242 / 0.6); }
    .celda:focus-visible { outline: 2px solid rgb(244 63 94); outline-offset: -2px; z-index: 1; }
    .celda--festivo { background: rgb(254 243 199 / 0.65); }
    .celda--festivo:hover { background: rgb(253 230 138 / 0.6); }
    .marca-festivo {
      position: absolute; top: 6px; right: 6px; padding: 1px 6px; border-radius: 6px; border: 1px solid rgb(252 211 77);
      background: rgb(254 243 199); color: rgb(120 53 15); font-size: 12px; font-weight: 700; line-height: 1.3; pointer-events: none;
    }
    .marca-festivo--fija { position: static; display: inline-block; pointer-events: auto; }
    .aviso-festivo { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 14px; font-weight: 600; color: rgb(120 53 15); }
    .leyenda-festivo { display: flex; align-items: center; gap: 8px; margin: 0; padding: 0 16px 8px; font-size: 13px; color: rgb(71 85 105); }
    .leyenda-festivo-muestra { width: 14px; height: 14px; border-radius: 4px; border: 1px solid rgb(252 211 77); background: rgb(254 243 199); }
    :host-context(.dark) .aviso-festivo { color: rgb(253 230 138); }
    :host-context(.dark) .leyenda-festivo { color: rgb(203 213 225); }
    :host-context(.dark) .marca-festivo, :host-context(.dark) .leyenda-festivo-muestra { background: rgb(120 53 15 / 0.45); border-color: rgb(180 83 9); color: rgb(253 230 138); }
    :host-context(.dark) .celda--festivo { background: rgb(120 53 15 / 0.22); }
    :host-context(.dark) .celda--festivo:hover { background: rgb(120 53 15 / 0.32); }
    .celda--otro { background: rgb(248 250 252); }
    .celda--otro .celda-num { color: rgb(100 116 139); font-weight: 600; }
    .celda:has(.celda-num--hoy):not(.celda--sel) { background: rgb(255 241 242 / 0.55); }
    .celda--sel, .celda--sel:hover { background: rgb(255 228 230 / 0.7); box-shadow: inset 0 0 0 2px rgb(244 63 94); }
    :host-context(.dark) .celda { border-color: rgb(30 41 59 / 0.8); }
    :host-context(.dark) .celda:hover { background: rgb(136 19 55 / 0.15); }
    :host-context(.dark) .celda--otro { background: rgb(15 23 42 / 0.45); }
    :host-context(.dark) .celda--otro .celda-num { color: rgb(71 85 105); }
    :host-context(.dark) .celda--sel { background: rgb(136 19 55 / 0.25); }

    /* Medidas que crecen con la pantalla; el ResizeObserver de la clase las lee para saber cuántas píldoras caben. */
    /* Barra de carga: solo transform y opacity, y solo si la respuesta tarda más de 250 ms. */
    .barra { position: absolute; top: 0; left: 0; right: 0; height: 2px; overflow: hidden; opacity: 0; z-index: 2; animation: barraVisible 1ms 250ms forwards; }
    .barra::after { content: ''; position: absolute; inset: 0; width: 35%; background: #e11d48; animation: barraCorre 900ms var(--ease) infinite; }
    @keyframes barraVisible { to { opacity: 1; } }
    @keyframes barraCorre { from { transform: translateX(-100%); } to { transform: translateX(290%); } }
    .semanas { --p-alto: 20px; --p-fuente: 12px; --n-alto: 26px; --n-fuente: 14px; --dia-fuente: 12px; }
    @media (min-width: 1536px) { .semanas { --dia-fuente: 13px; } }
    @media (min-width: 1920px) { .semanas { --p-alto: 24px; --p-fuente: 13px; --n-alto: 28px; --n-fuente: 15px; --dia-fuente: 14px; } }
    @media (min-width: 2560px) { .semanas { --p-alto: 30px; --p-fuente: 16px; --n-alto: 34px; --n-fuente: 18px; --dia-fuente: 16px; } }
    @media (min-width: 3200px) { .semanas { --p-alto: 38px; --p-fuente: 20px; --n-alto: 42px; --n-fuente: 22px; --dia-fuente: 20px; } }
    .dia-cab {
      background: rgb(248 250 252); padding: 8px 0; text-align: center; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
      color: rgb(71 85 105);
    }
    .dia-cab--finde { color: rgb(71 85 105); }
    :host-context(.dark) .dia-cab { color: rgb(148 163 184); background: rgb(30 41 59 / 0.35); }
    :host-context(.dark) .dia-cab--finde { color: rgb(100 116 139); }
    @media (min-width: 1920px) { .dia-cab { font-size: 14px; padding: 10px 0; } }
    @media (min-width: 2560px) { .dia-cab { font-size: 16px; padding: 12px 0; } }
    @media (min-width: 3200px) { .dia-cab { font-size: 20px; padding: 14px 0; } }

    .celda-num {
      align-self: flex-start; min-width: var(--n-alto, 26px); height: var(--n-alto, 26px); padding: 0 6px; margin-bottom: 6px; border-radius: 8px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: var(--n-fuente, 14px); font-weight: 700; font-variant-numeric: tabular-nums; color: rgb(15 23 42);
    }
    :host-context(.dark) .celda-num { color: rgb(241 245 249); }
    .celda-num--hoy, :host-context(.dark) .celda-num--hoy { background: #e11d48; color: #fff; }

    .pildora {
      display: flex; align-items: center; gap: 4px; height: var(--p-alto, 20px); padding: 0 6px; border-radius: 6px; border-width: 1px; border-style: solid;
      font-size: var(--p-fuente, 12px); font-weight: 600; line-height: 1; min-width: 0;
    }
    .pildora-txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    /* Con espacio de sobra en el día, el título completo en 2 o 3 líneas (n líneas siempre caben en n huecos de una línea). */
    .pildora--multi { height: auto; min-height: var(--p-alto, 20px); padding-top: 2px; padding-bottom: 2px; line-height: 1.15; }
    .pildora--multi .pildora-txt { white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: var(--lineas, 2); }
    .pildora--lista { height: auto; padding: 4px 8px; font-size: 13px; line-height: 1.3; }
    .ev-hecho { opacity: 0.75; text-decoration: line-through; }
    .ev-vencido { border-color: rgb(248 113 113) !important; color: rgb(185 28 28) !important; background: rgb(254 242 242) !important; }
    :host-context(.dark) .ev-vencido { border-color: rgb(185 28 28) !important; color: rgb(254 202 202) !important; background: rgb(69 10 10 / 0.6) !important; }
    .mas { font-size: var(--p-fuente, 12px); font-weight: 700; color: rgb(225 29 72); padding-left: 4px; }
    :host-context(.dark) .mas { color: rgb(253 164 175); }

    /* ── Panel ── */
    .panel-cabecera { padding: 10px 12px 6px; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; }
    .panel-titulo { font-family: var(--font-display, inherit); font-weight: 800; font-size: 1.125rem; color: rgb(15 23 42); }
    :host-context(.dark) .panel-titulo { color: rgb(248 250 252); }
    .volver {
      display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 10px 0 6px; margin-left: -6px; border-radius: 8px;
      font-size: 14px; font-weight: 600; color: rgb(225 29 72); transition: background var(--duration-fast, 120ms) ease;
    }
    .volver:hover { background: rgb(255 241 242); }
    :host-context(.dark) .volver { color: rgb(253 164 175); }
    :host-context(.dark) .volver:hover { background: rgb(136 19 55 / 0.3); }
    .panel-entra { animation: panelEntra var(--duration-base, 200ms) var(--ease); }
    @keyframes panelEntra { from { opacity: 0; transform: translateY(4px); } }

    .grupo-titulo { padding: 0 8px 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
    .grupo-titulo--rojo { color: rgb(185 28 28); }
    .grupo-titulo--rosa { color: rgb(225 29 72); }
    .grupo-titulo--normal { color: rgb(100 116 139); }
    :host-context(.dark) .grupo-titulo--rojo { color: rgb(248 113 113); }
    :host-context(.dark) .grupo-titulo--rosa { color: rgb(253 164 175); }
    :host-context(.dark) .grupo-titulo--normal { color: rgb(148 163 184); }

    .fila { display: flex; gap: 8px; padding: 7px 6px; border-radius: 10px; transition: background var(--duration-fast, 120ms) ease; }
    .fila:hover { background: rgb(248 250 252); }
    :host-context(.dark) .fila:hover { background: rgb(51 65 85 / 0.4); }
    .fila-dot { width: 8px; height: 8px; border-radius: 999px; margin-top: 7px; flex-shrink: 0; }
    .fila-titulo { font-size: 15px; font-weight: 600; line-height: 1.35; color: rgb(15 23 42); }
    :host-context(.dark) .fila-titulo { color: rgb(241 245 249); }
    .fila-meta { font-size: 13px; color: rgb(100 116 139); margin-top: 1px; }
    :host-context(.dark) .fila-meta { color: rgb(148 163 184); }
    .fila-detalle { font-size: 13px; line-height: 1.4; color: rgb(71 85 105); margin-top: 4px; max-width: 65ch; }
    :host-context(.dark) .fila-detalle { color: rgb(203 213 225); }
    .fila--hecho .fila-titulo { text-decoration: line-through; color: rgb(148 163 184); }

    /* Lista corta: la fila entera es el botón de abrir. */
    .fila--compacta { flex-direction: column; gap: 6px; padding: 4px; }
    .fila--compacta:hover { background: transparent; }
    .fila-abrir {
      width: 100%; display: flex; align-items: flex-start; gap: 10px; padding: 8px 8px 8px 6px; border-radius: 10px; text-align: left;
      transition: background var(--duration-fast, 120ms) ease, transform 100ms var(--ease);
    }
    button.fila-abrir:hover { background: rgb(248 250 252); }
    button.fila-abrir:active { transform: scale(0.99); }
    button.fila-abrir:focus-visible { outline: 2px solid rgb(244 63 94); outline-offset: 1px; }
    :host-context(.dark) button.fila-abrir:hover { background: rgb(51 65 85 / 0.45); }
    .fila-flecha { width: 18px; height: 18px; margin-top: 2px; flex-shrink: 0; color: rgb(148 163 184); transition: transform 150ms var(--ease), color 150ms ease; }
    button.fila-abrir:hover .fila-flecha { color: rgb(225 29 72); transform: translateX(2px); }
    :host-context(.dark) button.fila-abrir:hover .fila-flecha { color: rgb(253 164 175); }
    .hecho-btn {
      align-self: flex-start; margin-left: 24px; display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px;
      border-radius: 9px; font-size: 14px; font-weight: 600; color: rgb(4 120 87); background: rgb(236 253 245); border: 1px solid rgb(167 243 208);
      transition: background 120ms ease, transform 100ms var(--ease);
    }
    .hecho-btn:hover { background: rgb(209 250 229); }
    .hecho-btn:active { transform: scale(0.96); }
    .hecho-btn:disabled { opacity: 0.6; }
    .hecho-btn--deshacer { color: rgb(71 85 105); background: transparent; border-color: rgb(226 232 240); }
    :host-context(.dark) .hecho-btn { color: rgb(110 231 183); background: rgb(6 78 59 / 0.35); border-color: rgb(6 95 70 / 0.7); }
    :host-context(.dark) .hecho-btn:hover { background: rgb(6 78 59 / 0.55); }
    :host-context(.dark) .hecho-btn--deshacer { color: rgb(203 213 225); background: transparent; border-color: rgb(71 85 105); }
    .ver-mas {
      display: inline-flex; align-items: center; gap: 4px; margin: 2px 0 0 4px; min-height: 36px; padding: 0 10px; border-radius: 8px;
      font-size: 14px; font-weight: 600; color: rgb(225 29 72); transition: background 120ms ease;
    }
    .ver-mas:hover { background: rgb(255 241 242); }
    :host-context(.dark) .ver-mas { color: rgb(253 164 175); }
    :host-context(.dark) .ver-mas:hover { background: rgb(136 19 55 / 0.3); }
    @media (pointer: coarse) { .hecho-btn, .ver-mas { min-height: 44px; } }

    .accion {
      display: inline-flex; align-items: center; gap: 4px; height: 32px; padding: 0 10px; border-radius: 8px;
      font-size: 13px; font-weight: 600; text-decoration: none; color: rgb(51 65 85); border: 1px solid rgb(226 232 240); background: #fff;
      transition: background var(--duration-fast, 120ms) ease, transform 100ms var(--ease);
    }
    .accion:hover { background: rgb(248 250 252); border-color: rgb(203 213 225); }
    .accion:active { transform: scale(0.96); }
    .accion:disabled { opacity: 0.6; }
    :host-context(.dark) .accion { color: rgb(226 232 240); border-color: rgb(71 85 105); background: rgb(15 23 42 / 0.5); }
    .accion--ok, :host-context(.dark) .accion--ok { background: rgb(5 150 105); border-color: rgb(5 150 105); color: #fff; }
    .accion--ok:hover { background: rgb(4 120 87); border-color: rgb(4 120 87); }

    /* ── Teléfono ── */
    .dia-fila { width: 100%; display: flex; gap: 12px; padding: 12px 16px; text-align: left; border-top: 1px solid rgb(226 232 240); }
    .dia-fila--hoy { background: rgb(255 241 242); }
    :host-context(.dark) .dia-fila { border-color: rgb(30 41 59); }
    :host-context(.dark) .dia-fila--hoy { background: rgb(136 19 55 / 0.2); }
    .hoja-fondo { position: fixed; inset: 0; background: rgb(15 23 42 / 0.5); z-index: var(--z-modal-backdrop, 50); animation: fondo 200ms ease; }
    .hoja {
      position: fixed; left: 0; right: 0; bottom: 0; max-height: 85dvh; display: flex; flex-direction: column;
      background: #fff; border-radius: 20px 20px 0 0; z-index: var(--z-modal, 60);
      padding-bottom: env(safe-area-inset-bottom); animation: hoja 320ms var(--ease);
    }
    :host-context(.dark) .hoja { background: rgb(15 23 42); }
    .hoja-asa { width: 40px; height: 4px; border-radius: 999px; background: rgb(203 213 225); margin: 8px auto 0; }
    @keyframes hoja { from { transform: translateY(100%); } }
    @keyframes fondo { from { opacity: 0; } }

    .hoja:focus { outline: none; }
    .hoja { overscroll-behavior: contain; }
    .hoja-cab { touch-action: none; cursor: grab; }
    .hoja-cab:active { cursor: grabbing; }

    /* Mes en miniatura (teléfono) */
    .mini { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
    .mini-cab { padding: 4px 0; text-align: center; font-size: 12px; font-weight: 700; text-transform: uppercase; color: rgb(100 116 139); }
    .mini-dia {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 48px; border-radius: 12px;
      font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; color: rgb(15 23 42);
      transition: background var(--duration-fast, 120ms) ease, transform 100ms var(--ease);
    }
    .mini-dia:active { transform: scale(0.94); }
    .mini-dia--otro { color: rgb(148 163 184); }
    .mini-dia--hoy > span:first-child { background: #e11d48; color: #fff; border-radius: 8px; padding: 0 7px; }
    .mini-dia--festivo { background: rgb(254 243 199 / 0.8); }
    .mini-dia--sel { background: rgb(255 228 230); box-shadow: inset 0 0 0 2px rgb(244 63 94); }
    .mini-puntos { display: flex; gap: 3px; height: 8px; }
    :host-context(.dark) .mini-dia { color: rgb(241 245 249); }
    :host-context(.dark) .mini-dia--otro { color: rgb(71 85 105); }
    :host-context(.dark) .mini-dia--festivo { background: rgb(120 53 15 / 0.3); }
    :host-context(.dark) .mini-dia--sel { background: rgb(136 19 55 / 0.3); }

    /* Pantallas táctiles: todo lo que se pulsa mide al menos 44 px. */
    @media (pointer: coarse) {
      .icono-btn { width: 44px; height: 44px; }
      .accion, .btn-hoy, .volver, .op, .op-todos { min-height: 44px; height: auto; }
      .btn-hoy, .accion { padding-top: 0; padding-bottom: 0; }
    }

    button:focus-visible, a:focus-visible { outline: 2px solid rgb(244 63 94); outline-offset: 2px; }

    @media (prefers-reduced-motion: reduce) {
      .panel-entra, .hoja, .hoja-fondo { animation: none; }
      .barra::after { animation: none; width: 100%; opacity: 0.5; }
      * { transition-duration: 0.01ms !important; }
    }
  `],
})
export class AgendaCalendarioComponent implements OnInit {
  private svc = inject(AgendaService);
  private ctx = inject(CongregacionContextService);
  private auth = inject(AuthStore);
  private toast = inject(ToastService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private injector = inject(Injector);

  /** Quien solo tiene tareas no ve calendario. */
  readonly modo: ModoAgenda = (() => {
    const m = modoAgenda(this.auth);
    return m === 'personal' || m === 'exhibidor' ? m : 'secretaria';
  })();
  /** Calendario de solo lectura con las salidas de exhibidor de esta persona. */
  readonly soloExhibidor = this.modo === 'exhibidor';
  readonly esCoordinador = esCoordinador(this.auth);

  /**
   * Las tareas (y crearlas) solo si tiene acceso al módulo de Tareas, igual que el menú "Mis Tareas".
   * En el calendario de solo exhibidores no: ahí no saldrían (están en la pestaña Tareas).
   */
  readonly conTareas = this.auth.hasPermission('tareas.ver') && !this.soloExhibidor;
  /** Aviso de que falta el permiso de Tareas: se cierra una vez por navegador. */
  avisoTareasCerrado = signal(leerAvisoTareasCerrado());
  cerrarAvisoTareas() {
    this.avisoTareasCerrado.set(true);
    try { localStorage.setItem(CLAVE_AVISO_TAREAS, '1'); } catch { /* sin almacenamiento: vuelve a salir */ }
  }
  /** La agenda personal no tiene informes, bautismos ni traslados: son trabajo del secretario. */
  readonly tipos: TipoEvento[] = (this.modo === 'exhibidor'
    ? ['exhibidor']
    : this.modo === 'personal'
      ? ['tarea', 'recordatorio', 'visita', 'reunion_ancianos', 'exhibidor']
      : ['tarea', 'recordatorio', 'informes', 'visita', 'reunion_ancianos', 'bautismo', 'transferencia', 'exhibidor'] as TipoEvento[])
    .filter(t => t !== 'tarea' || this.conTareas) as TipoEvento[];
  readonly diasCortos = DIAS_CORTOS;
  readonly diasLargos = DIAS_LARGOS;
  readonly larga = fechaLarga;
  readonly relativo = relativo;

  anio = signal(new Date().getFullYear());
  mes = signal(new Date().getMonth() + 1);
  nombreMes = computed(() => MESES[this.mes() - 1]);
  /**
   * El mes que se está viendo. Va un paso por detrás del pedido: al pulsar una flecha el título
   * cambia al instante, pero la cuadrícula conserva el mes anterior hasta que llegan los datos
   * del nuevo y los cambia de una vez, sin pasar por una cuadrícula vacía o atenuada.
   */
  anioVista = signal(new Date().getFullYear());
  mesVista = signal(new Date().getMonth() + 1);
  nombreMesVista = computed(() => MESES[this.mesVista() - 1]);
  esMesActual = computed(() => {
    const h = new Date();
    return this.anio() === h.getFullYear() && this.mes() === h.getMonth() + 1;
  });

  cargando = signal(true);
  cargandoProximos = signal(true);
  eventos = signal<EventoAgenda[]>([]);
  proximos = signal<EventoAgenda[]>([]);
  ocultos = signal<Set<TipoEvento>>(new Set());
  readonly emptySet = new Set<TipoEvento>();
  filtrosAbiertos = signal(false);
  diaSeleccionado = signal<string | null>(null);
  marcando = signal<string | null>(null);
  modalTarea = signal(false);
  fechaNuevaTarea = signal<string | null>(null);
  recordatoriosAbierto = signal(false);
  errorMes = signal(false);
  errorProximos = signal(false);
  errorCarga = computed(() => this.errorMes() || this.errorProximos());
  /** Administrador con «Todas las congregaciones»: el backend pide una (400), no es un fallo de conexión. */
  sinCongregacion = computed(() => this.modo === 'secretaria' && this.auth.hasRole('Administrador') && !this.ctx.effectiveCongregacionId());

  /** Desde 1280px: calendario + panel a pantalla completa. */
  esAncho = signal(typeof window !== 'undefined' && window.matchMedia(MEDIA_ANCHA).matches);
  /** Píldoras que caben en una celda; lo fija el ResizeObserver de la cuadrícula. */
  private capacidad = signal(3);
  private semanasEl = viewChild<ElementRef<HTMLElement>>('semanasEl');

  /** Primer y último día de la cuadrícula (semanas completas de lunes a domingo). */
  private rango = computed(() => rangoDelMes(this.anio(), this.mes()));
  private rangoVista = computed(() => rangoDelMes(this.anioVista(), this.mesVista()));

  /** Festivos del mes visible por fecha (YYYY-MM-DD → nombre). */
  private festivos = signal<Map<string, string>>(new Map());
  hayFestivosMes = computed(() => this.semanas().some(s => s.some(c => c.festivo && !c.otroMes)));

  private visiblesEventos = computed(() => this.eventos().filter(e => !this.ocultos().has(e.tipo)));

  /** Cuántos hay de cada tipo en el mes visible (para los chips). */
  conteo = computed(() => {
    const n: Partial<Record<TipoEvento, number>> = {};
    const { mes, anio } = { mes: this.mesVista(), anio: this.anioVista() };
    for (const e of this.eventos()) {
      if (!e.fecha) continue;
      const d = desdeIso(e.fecha);
      if (d.getMonth() + 1 === mes && d.getFullYear() === anio) n[e.tipo] = (n[e.tipo] ?? 0) + 1;
    }
    return n;
  });

  semanas = computed<Celda[][]>(() => {
    const { desde, hasta } = this.rangoVista();
    const hoy = hoyIso();
    const festivos = this.festivos();
    const porDia = new Map<string, EventoAgenda[]>();
    for (const e of this.visiblesEventos()) {
      if (!e.fecha) continue;
      // Los de varios días (la visita) se pintan en cada día.
      for (let f = e.fecha; f <= (e.fecha_fin ?? e.fecha); f = sumarDias(f, 1)) {
        if (!porDia.has(f)) porDia.set(f, []);
        porDia.get(f)!.push(e);
      }
    }
    const semanas: Celda[][] = [];
    for (let f = desde; f <= hasta;) {
      const semana: Celda[] = [];
      for (let i = 0; i < 7; i++, f = sumarDias(f, 1)) {
        const d = desdeIso(f);
        semana.push({ fecha: f, dia: d.getDate(), otroMes: d.getMonth() + 1 !== this.mesVista(), esHoy: f === hoy, eventos: porDia.get(f) ?? [], festivo: festivos.get(f) });
      }
      semanas.push(semana);
    }
    return semanas;
  });

  diasConEventos = computed(() => this.semanas().flat().filter(c => !c.otroMes && c.eventos.length));

  celdaSeleccionada = computed(() => {
    const f = this.diaSeleccionado();
    return f ? this.semanas().flat().find(c => c.fecha === f) ?? null : null;
  });

  grupos = computed<Grupo[]>(() => {
    const hoy = hoyIso();
    const manana = sumarDias(hoy, 1);
    const semana = sumarDias(hoy, 7);
    // Lo que no tiene fecha (tareas) se ve en la pestaña Tareas, no aquí.
    const lista = this.proximos().filter(e => !!e.fecha && !this.ocultos().has(e.tipo));
    const defs: Array<[string, string, Grupo['tono'], (e: EventoAgenda) => boolean]> = [
      ['vencidas', 'Atrasado', 'rojo', e => e.estado === 'vencido'],
      ['hoy', 'Hoy', 'rosa', e => esDeHoy(e, hoy)],
      ['manana', 'Mañana', 'rosa', e => e.fecha === manana],
      ['semana', 'Esta semana', 'normal', e => !!e.fecha && e.fecha > manana && e.fecha <= semana],
      ['luego', 'Más adelante', 'normal', e => !!e.fecha && e.fecha > semana],
    ];
    const usados = new Set<string>();
    return defs
      .map(([clave, titulo, tono, cumple]) => {
        const eventos = lista.filter(e => !usados.has(e.id) && cumple(e));
        eventos.forEach(e => usados.add(e.id));
        return { clave, titulo, tono, eventos };
      })
      .filter(g => g.eventos.length);
  });

  constructor() {
    // Recarga al cambiar de mes o (Administrador) de congregación.
    effect(() => {
      this.rango();
      this.ctx.effectiveCongregacionId();
      untracked(() => this.cargarMes());
    });
    effect(() => {
      this.ctx.effectiveCongregacionId();
      untracked(() => this.cargarProximos());
    });

    // Cuántas píldoras caben: alto de una semana menos la cabecera de la celda.
    effect(onCleanup => {
      const el = this.semanasEl()?.nativeElement;
      const filas = this.semanas().length;
      if (!el) return;
      const ro = new ResizeObserver(() => {
        // Las medidas de píldora y número salen del CSS (--p-alto, --n-alto): crecen en 2K y 4K.
        const css = getComputedStyle(el);
        const medida = (v: string, defecto: number) => parseFloat(css.getPropertyValue(v)) || defecto;
        const pildora = medida('--p-alto', 20) + SEPARACION;
        const cabecera = medida('--n-alto', 26) + MARGEN_NUMERO;
        const alto = el.clientHeight / filas;
        this.capacidad.set(Math.max(1, Math.floor((alto - cabecera - CELDA_PADDING + SEPARACION) / pildora)));
      });
      ro.observe(el);
      onCleanup(() => ro.disconnect());
    });

    // Al abrir el menú de tipos el foco entra en él.
    effect(() => {
      if (this.filtrosAbiertos()) {
        setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('#menu-tipos input')?.focus(), 0);
      }
    });

    // Hoja del día: al abrirse recibe el foco; al cerrarse, el foco vuelve a lo que la abrió.
    effect(() => {
      const hoja = this.hojaEl()?.nativeElement;
      untracked(() => {
        if (hoja) {
          this.elementoPrevio = document.activeElement as HTMLElement | null;
          hoja.focus();
        } else if (this.elementoPrevio) {
          this.elementoPrevio.focus();
          this.elementoPrevio = null;
        }
      });
    });

    const mq = window.matchMedia(MEDIA_ANCHA);
    const alCambiar = (e: MediaQueryListEvent) => this.esAncho.set(e.matches);
    mq.addEventListener('change', alCambiar);
    this.destroyRef.onDestroy(() => mq.removeEventListener('change', alCambiar));
  }

  ngOnInit() {
    // ?fecha=YYYY-MM-DD (desde un aviso): ir a ese mes y abrir el día.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => {
      const fecha = p.get('fecha');
      if (fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        const d = desdeIso(fecha);
        this.anio.set(d.getFullYear());
        this.mes.set(d.getMonth() + 1);
        this.diaSeleccionado.set(fecha);
      }
    });
  }

  /** El menú de tipos se cierra al pulsar fuera (el propio menú detiene el clic). */
  @HostListener('document:click')
  cerrarFiltros() {
    if (this.filtrosAbiertos()) this.filtrosAbiertos.set(false);
  }

  /** Escape: cierra el menú de tipos (y devuelve el foco a su botón) o, en el teléfono, la hoja del día. */
  @HostListener('document:keydown.escape')
  alEscape() {
    if (this.filtrosAbiertos()) {
      this.filtrosAbiertos.set(false);
      this.host.nativeElement.querySelector<HTMLElement>('#btn-tipos')?.focus();
    } else if (!this.esAncho() && this.diaSeleccionado() && !this.modalTarea() && !this.recordatoriosAbierto()) {
      this.diaSeleccionado.set(null);
    }
  }

  // ── Teclado en la cuadrícula: una sola parada de Tab y flechas entre días ──

  /** Día que lleva el foco del teclado en la cuadrícula: el último movido, el abierto, hoy o el 1.º del mes. */
  foco = signal<string | null>(null);
  private focoPendiente: string | null = null;

  fechaTab = computed(() => {
    const dias = this.semanas().flat();
    const f = this.foco() ?? this.diaSeleccionado();
    if (f && dias.some(c => c.fecha === f)) return f;
    const hoy = hoyIso();
    return dias.find(c => c.fecha === hoy && !c.otroMes)?.fecha ?? dias.find(c => !c.otroMes)?.fecha ?? null;
  });

  teclaCelda(ev: KeyboardEvent, c: Celda) {
    const lunes = (desdeIso(c.fecha).getDay() + 6) % 7;
    let destino: string;
    switch (ev.key) {
      case 'ArrowLeft': destino = sumarDias(c.fecha, -1); break;
      case 'ArrowRight': destino = sumarDias(c.fecha, 1); break;
      case 'ArrowUp': destino = sumarDias(c.fecha, -7); break;
      case 'ArrowDown': destino = sumarDias(c.fecha, 7); break;
      case 'Home': destino = sumarDias(c.fecha, -lunes); break;
      case 'End': destino = sumarDias(c.fecha, 6 - lunes); break;
      case 'PageUp':
      case 'PageDown': {
        const d = desdeIso(c.fecha);
        const mes = new Date(d.getFullYear(), d.getMonth() + (ev.key === 'PageUp' ? -1 : 1), 1);
        const ultimo = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
        destino = iso(new Date(mes.getFullYear(), mes.getMonth(), Math.min(d.getDate(), ultimo)));
        break;
      }
      default: return;
    }
    ev.preventDefault();
    // Re Pág / Av Pág cambian de mes aunque el día destino ya asome en la cuadrícula.
    this.irAFecha(destino, ev.key === 'PageUp' || ev.key === 'PageDown');
  }

  /**
   * Mueve el foco a un día; si cae fuera del mes que se ve (o `cambiarMes` y es de otro mes),
   * cambia de mes y lo enfoca cuando lleguen los datos.
   */
  private irAFecha(fecha: string, cambiarMes = false) {
    this.foco.set(fecha);
    const otroMes = desdeIso(fecha).getMonth() + 1 !== this.mes();
    if (!(cambiarMes && otroMes) && this.semanas().flat().some(c => c.fecha === fecha)) {
      this.enfocarCelda(fecha);
      return;
    }
    const d = desdeIso(fecha);
    this.focoPendiente = fecha;
    this.diaSeleccionado.set(null);
    this.anio.set(d.getFullYear());
    this.mes.set(d.getMonth() + 1);
  }

  /** Tras dibujar: al cambiar de mes la celda aún no existe cuando llegan los datos. */
  private enfocarCelda(fecha: string) {
    const enfocar = () => this.host.nativeElement.querySelector<HTMLElement>(`[data-fecha="${fecha}"]`)?.focus();
    afterNextRender(enfocar, { injector: this.injector });
    setTimeout(enfocar, 0); // por si no hay un dibujado pendiente
  }

  // ── Hoja inferior del día (teléfono): foco, Tab atrapado y arrastre para cerrar ──

  private hojaEl = viewChild<ElementRef<HTMLElement>>('hojaEl');
  private elementoPrevio: HTMLElement | null = null;
  private arrastre: { y0: number; t0: number } | null = null;

  teclaHoja(ev: KeyboardEvent) {
    if (ev.key !== 'Tab') return;
    const hoja = this.hojaEl()?.nativeElement;
    if (!hoja) return;
    const foco = [...hoja.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input, select, textarea')]
      .filter(el => el.offsetParent !== null);
    if (!foco.length) return;
    const primero = foco[0], ultimo = foco[foco.length - 1];
    const activo = document.activeElement;
    if (ev.shiftKey && (activo === primero || activo === hoja)) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && activo === ultimo) { ev.preventDefault(); primero.focus(); }
  }

  arrastreInicio(ev: PointerEvent) {
    if ((ev.target as HTMLElement).closest('button')) return;
    (ev.currentTarget as HTMLElement).setPointerCapture(ev.pointerId);
    this.arrastre = { y0: ev.clientY, t0: ev.timeStamp };
    const hoja = this.hojaEl()?.nativeElement;
    if (hoja) hoja.style.transition = 'none';
  }

  /** La hoja sigue al dedo; el transform se toca directo en el elemento (no en una señal) para no recalcular nada más. */
  arrastreMueve(ev: PointerEvent) {
    const hoja = this.hojaEl()?.nativeElement;
    if (!this.arrastre || !hoja) return;
    hoja.style.transform = `translateY(${Math.max(0, ev.clientY - this.arrastre.y0)}px)`;
  }

  /** Se cierra si se bajó lo suficiente o si fue un empujón rápido; si no, vuelve a su sitio. */
  arrastreFin(ev: PointerEvent) {
    const hoja = this.hojaEl()?.nativeElement;
    if (!this.arrastre || !hoja) return;
    const dy = Math.max(0, ev.clientY - this.arrastre.y0);
    const velocidad = dy / Math.max(1, ev.timeStamp - this.arrastre.t0);
    this.arrastre = null;
    hoja.style.transition = 'transform 220ms var(--ease)';
    if (dy > 120 || (velocidad > 0.11 && dy > 20)) {
      hoja.style.transform = 'translateY(100%)';
      setTimeout(() => this.diaSeleccionado.set(null), 180);
    } else {
      hoja.style.transform = '';
    }
  }

  /** Líneas de cada tarjeta (1 a 3): tantas como permita repartir los huecos del día entre sus eventos. */
  lineas(total: number): number {
    return Math.max(1, Math.min(3, Math.floor(this.capacidad() / Math.max(1, total))));
  }

  /** Si cabe todo, todo; si no, uno menos para dejar sitio al "+N más". */
  visibles(total: number): number {
    const cap = this.capacidad();
    return total <= cap ? total : Math.max(0, cap - 1);
  }

  /** Peticiones en curso: al pedir otra (otro mes, otra congregación) se cancela la anterior para que no pise a la nueva. */
  private pideMes?: Subscription;
  private pideProximos?: Subscription;

  private cargarMes() {
    const { desde, hasta } = this.rango();
    const anio = this.anio(), mes = this.mes();
    this.cargando.set(true);
    this.pideMes?.unsubscribe();
    // Si los festivos fallan, la agenda sigue funcionando sin ellos.
    this.pideMes = forkJoin({
      ev: this.svc.eventos(desde, hasta),
      festivos: this.svc.festivos(desde, hasta).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ ev, festivos }) => {
        // Datos y mes visible cambian juntos: nunca se ve un mes nuevo con los eventos del anterior.
        this.eventos.set(ev);
        this.festivos.set(new Map(festivos.map(f => [f.fecha, f.nombre])));
        this.anioVista.set(anio);
        this.mesVista.set(mes);
        this.errorMes.set(false);
        this.cargando.set(false);
        if (this.focoPendiente) {
          this.enfocarCelda(this.focoPendiente);
          this.focoPendiente = null;
        }
      },
      error: () => { this.cargando.set(false); this.errorMes.set(true); this.focoPendiente = null; },
    });
  }

  private cargarProximos() {
    this.cargandoProximos.set(true);
    this.pideProximos?.unsubscribe();
    this.pideProximos = this.svc.proximos().subscribe({
      next: ev => { this.proximos.set(ev); this.errorProximos.set(false); this.cargandoProximos.set(false); },
      error: () => { this.cargandoProximos.set(false); this.errorProximos.set(true); },
    });
  }

  recargar() {
    this.cargarMes();
    this.cargarProximos();
  }

  cambiarMes(delta: number) {
    const d = new Date(this.anio(), this.mes() - 1 + delta, 1);
    this.anio.set(d.getFullYear());
    this.mes.set(d.getMonth() + 1);
    this.diaSeleccionado.set(null);
  }

  irAHoy() {
    const h = new Date();
    this.anio.set(h.getFullYear());
    this.mes.set(h.getMonth() + 1);
    this.diaSeleccionado.set(null);
  }

  alternarTipo(t: TipoEvento) {
    const s = new Set(this.ocultos());
    s.has(t) ? s.delete(t) : s.add(t);
    this.ocultos.set(s);
  }

  /** Cuántas filas enseña cada grupo antes de "Ver más": lo justo para ver de un vistazo. */
  readonly POR_GRUPO = 3;
  gruposAbiertos = signal<ReadonlySet<string>>(new Set());

  visiblesGrupo(g: Grupo): number {
    return this.gruposAbiertos().has(g.clave) ? g.eventos.length : this.POR_GRUPO;
  }

  expandirGrupo(clave: string) {
    const s = new Set(this.gruposAbiertos());
    if (s.has(clave)) s.delete(clave); else s.add(clave);
    this.gruposAbiertos.set(s);
  }

  /** Una línea de contexto sin repetir lo que dice el título del grupo (Atrasado, Hoy…). */
  metaCompacta(e: EventoAgenda, grupo: string): string {
    const partes = [this.estilo(e.tipo).label];
    if (e.fecha_fin && grupo === 'hoy') partes.push('hasta el ' + this.larga(e.fecha_fin));
    else if (e.fecha && grupo !== 'hoy') partes.push(this.relativo(e.fecha));
    return partes.join(' · ');
  }

  /** Un segundo clic en el mismo día vuelve a "Lo que viene". */
  seleccionar(fecha: string) {
    this.diaSeleccionado.set(this.diaSeleccionado() === fecha && this.esAncho() ? null : fecha);
  }

  esPasado(fecha: string): boolean {
    return fecha < hoyIso();
  }

  /** También la llama el botón «Nueva tarea» de la cabecera de AgendaPage (con fecha null). */
  nuevaTarea(fecha: string | null) {
    if (!this.esAncho()) this.diaSeleccionado.set(null);
    // Una tarea no puede vencer en el pasado: si el día ya pasó, se abre sin fecha.
    this.fechaNuevaTarea.set(fecha && !this.esPasado(fecha) ? fecha : null);
    this.modalTarea.set(true);
  }

  marcar(e: EventoAgenda) {
    const hecho = e.estado !== 'hecho';
    // Las tareas cambian su estado en Mis Tareas; los automáticos (DPA) se marcan por clave;
    // los recordatorios, por su id y fecha.
    const peticion = e.tipo === 'tarea' && e.origen_id
      ? this.svc.estadoTarea(e.origen_id, hecho ? 'completada' : 'pendiente')
      : e.clave_hecho
        ? this.svc.marcarHechoAuto(e.clave_hecho, hecho)
        : e.origen_id && e.fecha ? this.svc.marcarHecho(e.origen_id, e.fecha, hecho) : null;
    if (!peticion) return;
    this.marcando.set(e.id);
    peticion.subscribe({
      next: () => {
        this.marcando.set(null);
        if (hecho) this.toast.success('Marcado como hecho');
        this.recargar();
      },
      error: () => { this.marcando.set(null); this.toast.error('No se pudo guardar'); },
    });
  }

  abrir(e: EventoAgenda) {
    if (e.ruta) this.router.navigateByUrl(e.ruta);
    else if (e.enlace && /^https?:\/\//i.test(e.enlace.trim())) window.open(e.enlace.trim(), '_blank', 'noopener');
  }

  estilo(t: TipoEvento) {
    return TIPOS_EVENTO[t];
  }

  claseEvento(e: EventoAgenda): string {
    const base = TIPOS_EVENTO[e.tipo].pill;
    if (e.estado === 'hecho') return `${base} ev-hecho`;
    if (e.estado === 'vencido') return `${base} ev-vencido`;
    return base;
  }

  diaCorto(fecha: string): string {
    return DIAS[desdeIso(fecha).getDay()].slice(0, 3);
  }

  etiquetaDia(c: Celda): string {
    const n = c.eventos.length;
    const fest = c.festivo ? `Festivo, ${c.festivo}. ` : '';
    if (!n) return `${fechaLarga(c.fecha)}: ${fest}nada pendiente`;
    const nombres = c.eventos.slice(0, 3).map(e => e.titulo_corto || e.titulo).join('; ');
    return `${fechaLarga(c.fecha)}: ${fest}${n === 1 ? '1 cosa' : n + ' cosas'}. ${nombres}${n > 3 ? ` y ${n - 3} más` : ''}`;
  }
}
