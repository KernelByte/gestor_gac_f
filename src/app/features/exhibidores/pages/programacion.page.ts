import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DropdownComponent, DropdownItem } from '../../../shared/components/dropdown/dropdown.component';
import { Hora12Pipe } from '../../../shared/pipes/hora12.pipe';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { PublicadorLite, PublicadorLookupService } from '../../../shared/components/publicador-picker/publicador-lookup.service';
import { ExhibidoresTabsComponent } from '../components/exhibidores-tabs.component';
import { ExhibidoresService } from '../services/exhibidores.service';
import {
  CandidatoSlot, CandidatosSlotResponse, ConflictoDetalle, DIAS_SEMANA,
  DIAS_SEMANA_CORTO, ExhibidorAsignacion, FechaBloqueada, MESES_ES,
  Periodicidad, ProgramacionMes, Quincena, TurnoGrilla,
} from '../models/exhibidor.model';

interface CeldaTurno {
  turno: TurnoGrilla;
  asignaciones: ExhibidorAsignacion[];
  bloqueada: string | null; // motivo del bloqueo
}

/** Franja horaria para el filtro rápido de la grilla (AM = mañana, PM = tarde). */
type FranjaFiltro = 'am' | 'pm';

interface GrupoFecha {
  fecha: string;
  diaNombre: string;
  diaNumero: number;
  diaIdx: number; // 0 = lunes … 6 = domingo, para el filtro por día
  celdas: CeldaTurno[];
  bloqueoGlobal: string | null;
}

@Component({
  selector: 'app-programacion-exhibidores-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, PageHeaderComponent, ModalComponent,
    ConfirmDialogComponent, EmptyStateComponent, DatePickerComponent,
    ExhibidoresTabsComponent, DropdownComponent, Hora12Pipe,
  ],
  template: `
    <app-page-header
      title="Exhibidores"
      [subtitle]="esQuincenal()
        ? 'Programación quincenal de turnos con asignación inteligente.'
        : 'Programación mensual de turnos con asignación inteligente.'">
      <button class="btn-secondary" (click)="abrirBloqueadas()">Fechas bloqueadas</button>
      <button class="btn-secondary" *ngIf="estadoPeriodo()?.generado" (click)="descargarPdf()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/>
        </svg>
        PDF
      </button>
      <button class="btn-primary-blue" *ngIf="!estadoPeriodo()?.generado" [disabled]="generando()" (click)="generar(false)">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/>
        </svg>
        {{ generando() ? 'Generando…' : 'Generar ' + nombrePeriodo() }}
      </button>
      <button class="btn-primary-blue" *ngIf="estadoPeriodo()?.generado && !estadoPeriodo()?.confirmado"
              [disabled]="confirmando()" (click)="confirmar()">
        {{ confirmando() ? 'Confirmando…' : 'Confirmar ' + nombrePeriodo() }}
      </button>
    </app-page-header>

    <app-exhibidores-tabs />

    <!-- Navegación temporal -->
    <div class="flex flex-wrap items-center gap-3 mb-4">
      <div class="flex items-center gap-1.5">
        <button class="btn-icon-edit" (click)="cambiarMes(-1)" aria-label="Mes anterior">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
          </svg>
        </button>
        <div class="px-3 py-1.5 min-w-44 text-center">
          <span class="font-display font-bold text-lg text-slate-900 dark:text-slate-100">
            {{ nombreMes() }} {{ ano() }}
          </span>
        </div>
        <button class="btn-icon-edit" (click)="cambiarMes(1)" aria-label="Mes siguiente">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
          </svg>
        </button>
      </div>

      <!-- Selector de quincena (solo si la congregación programa por quincenas) -->
      <div *ngIf="esQuincenal()"
           class="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 self-start">
        <button *ngFor="let q of [1, 2]"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                [ngClass]="quincenaSel() === q
                  ? 'bg-white dark:bg-slate-700 text-exh-600 dark:text-exh-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
                (click)="seleccionarQuincena($any(q))">
          {{ q }}ª quincena
          <span class="font-normal opacity-70">{{ q === 1 ? '1–15' : '16–fin' }}</span>
        </button>
      </div>
    </div>

    <!-- Estado del periodo: resultado del generador (izq.) vs. ajustes y acciones (der.) -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6 px-4 py-3 rounded-2xl
                bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60">
      <!-- Informativo: qué generó el sistema -->
      <div class="flex flex-wrap items-center gap-3">
        <ng-container *ngIf="estadoPeriodo() as e">
          <span *ngIf="e.confirmado" class="badge-active">Confirmado</span>
          <span *ngIf="e.generado && !e.confirmado" class="badge-warning">Borrador</span>
          <div *ngIf="e.generado" class="flex items-center gap-2.5">
            <span class="data-num text-sm font-bold text-slate-700 dark:text-slate-200">
              {{ e.cobertura.cubiertas }}<span class="font-normal text-slate-400">/{{ e.cobertura.total }}</span>
            </span>
            <div class="w-28 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div class="h-full rounded-full bg-exh-600 transition-all"
                   [style.width.%]="porcentajeCobertura()"></div>
            </div>
            <span class="text-xs text-slate-400">cubiertos</span>
          </div>
          <span *ngIf="!e.generado" class="text-sm text-slate-400 italic">Sin generar todavía</span>
        </ng-container>
      </div>

      <!-- Acciones sobre el periodo -->
      <div class="flex items-center gap-2">
        <ng-container *ngIf="estadoPeriodo() as e">
          <!-- «Regenerar» solo tiene sentido en borrador: el backend rechaza
               (409) reescribir un periodo ya confirmado. Antes el botón se
               mostraba siempre y el error solo aparecía después de confirmar
               el diálogo — la acción parecía disponible sin estarlo. Para
               empezar de cero un periodo confirmado, la vía es «Eliminar
               programación» en el menú «⋯». -->
          <span *ngIf="e.generado && e.confirmado"
                class="text-xs text-slate-400 dark:text-slate-500 italic"
                title="Ya está confirmado. Para rehacerlo desde cero, elimina la programación en el menú «⋯».">
            No se puede regenerar
          </span>
          <button *ngIf="e.generado && !e.confirmado" class="btn-secondary !px-3 !py-1.5 text-xs"
                  (click)="confirmRegenerar.set(true)">Regenerar</button>
          <app-dropdown *ngIf="e.generado" [items]="accionesPeriodo" align="right" (itemClick)="onAccionPeriodo($event)">
            <button slot="trigger" class="btn-icon-edit" aria-label="Más acciones de este periodo">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
              </svg>
            </button>
          </app-dropdown>
        </ng-container>
      </div>
    </div>

    <!-- Conflictos de generación -->
    <div *ngIf="conflictos().length > 0"
         class="mb-5 p-4 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/40">
      <p class="font-semibold text-sm text-amber-800 dark:text-amber-300 mb-1.5">
        {{ conflictos().length }} hueco(s) sin cubrir — revísalos y asígnalos a mano:
      </p>
      <ul class="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
        <li *ngFor="let c of conflictos() | slice:0:6">
          {{ c.fecha }} · {{ c.ubicacion_nombre }} — {{ c.motivo }}
        </li>
        <li *ngIf="conflictos().length > 6" class="italic">…y {{ conflictos().length - 6 }} más.</li>
      </ul>
    </div>

    <!-- Estado vacío -->
    <div *ngIf="!cargando() && mesData() && !estadoPeriodo()?.generado">
      <app-empty-state
        accent="blue"
        icon="calendar-plus"
        [title]="esQuincenal()
          ? 'Esta quincena aún no tiene programación'
          : 'Este mes aún no tiene programación'"
        [description]="mesData()!.turnos.length === 0
          ? 'Primero configura ubicaciones con turnos en la pestaña Ubicaciones.'
          : 'Genera el borrador automático: el sistema asigna a los participantes respetando reglas, disponibilidad e historial.'"
        [actionLabel]="mesData()!.turnos.length === 0 ? '' : 'Generar ' + nombrePeriodo()"
        (action)="generar(false)" />
    </div>

    <!-- Skeleton -->
    <div *ngIf="cargando()" class="space-y-3">
      <div class="skeleton h-20 rounded-xl" *ngFor="let i of [1,2,3,4]"></div>
    </div>

    <!-- Filtros rápidos: día de la semana y franja horaria -->
    <div *ngIf="!cargando() && estadoPeriodo()?.generado && hayFiltros()"
         class="flex flex-wrap items-center gap-1.5 mb-4">
      <ng-container *ngIf="diasDisponibles().length > 1">
        <span class="text-xs font-medium text-slate-400 dark:text-slate-500 mr-0.5">Día</span>
        <button class="chip-filtro" [ngClass]="clasesChip(diaFiltro() === null)"
                (click)="filtrarDia(null)">Todos</button>
        <button *ngFor="let d of diasDisponibles()"
                class="chip-filtro" [ngClass]="clasesChip(diaFiltro() === d.idx)"
                (click)="filtrarDia(d.idx)">{{ d.nombre }}</button>
      </ng-container>

      <ng-container *ngIf="hayAmbasFranjas()">
        <div class="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1.5"></div>
        <span class="text-xs font-medium text-slate-400 dark:text-slate-500 mr-0.5">Horario</span>
        <button class="chip-filtro" [ngClass]="clasesChip(franjaFiltro() === 'am')"
                (click)="filtrarFranja('am')" title="Turnos de la mañana">AM</button>
        <button class="chip-filtro" [ngClass]="clasesChip(franjaFiltro() === 'pm')"
                (click)="filtrarFranja('pm')" title="Turnos de la tarde">PM</button>
      </ng-container>
    </div>

    <!--
      Una sola columna por filas: cada día es una fila a ancho completo y dentro
      de ella los turnos se alinean en columnas (punto · horario · asignados),
      así la vista se lee de corrido como una planilla. Se descartó el layout de
      dos columnas porque los días tienen distinta cantidad de turnos y las
      tarjetas quedaban descuadradas entre sí.
    -->
    <div *ngIf="!cargando() && estadoPeriodo()?.generado" class="space-y-3">
      <div *ngFor="let grupo of gruposVisibles()"
           class="card-elevated overflow-hidden">
        <div class="flex items-center gap-3 px-4 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-700/60"
             [class.opacity-60]="grupo.bloqueoGlobal">
          <div class="flex items-baseline gap-2">
            <span class="data-num text-xl font-bold leading-none"
                  [ngClass]="grupo.bloqueoGlobal ? 'text-slate-400' : 'text-slate-900 dark:text-slate-100'">
              {{ grupo.diaNumero }}
            </span>
            <span class="text-sm font-semibold"
                  [ngClass]="grupo.bloqueoGlobal ? 'text-slate-400' : 'text-exh-600 dark:text-exh-400'">
              {{ grupo.diaNombre }}
            </span>
          </div>
          <p *ngIf="grupo.bloqueoGlobal"
             class="text-xs font-medium text-amber-600 dark:text-amber-400">
            {{ grupo.bloqueoGlobal }}
          </p>
          <span *ngIf="!grupo.bloqueoGlobal" class="ml-auto text-xs text-slate-400">
            {{ grupo.celdas.length }} {{ grupo.celdas.length === 1 ? 'turno' : 'turnos' }}
          </span>
        </div>

        <div *ngIf="!grupo.bloqueoGlobal" class="divide-y divide-slate-100 dark:divide-slate-700/60">
          <div *ngFor="let celda of grupo.celdas" class="px-4 py-2.5">
            <div class="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
              <p class="sm:w-52 shrink-0 font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
                {{ celda.turno.ubicacion_nombre }}
              </p>
              <p class="sm:w-36 shrink-0 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400 data-num">
                {{ celda.turno.hora_inicio | hora12 }} – {{ celda.turno.hora_fin | hora12 }}
              </p>
              <p *ngIf="celda.bloqueada" class="text-xs font-medium text-amber-600 dark:text-amber-400">
                {{ celda.bloqueada }}
              </p>
              <div *ngIf="!celda.bloqueada" class="flex flex-wrap gap-2 flex-1">
                <button *ngFor="let a of celda.asignaciones"
                        class="group inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm transition-all focus-ring-blue"
                        [ngClass]="clasesSlot(a)"
                        (click)="abrirAsignar(a, celda)">
                  <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        [ngClass]="a.publicador
                          ? 'bg-exh-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'">
                    {{ a.publicador ? iniciales(a.publicador.nombre_completo) : '?' }}
                  </span>
                  <span class="truncate max-w-40">
                    {{ a.publicador?.nombre_completo ?? 'Sin asignar' }}
                  </span>
                  <span *ngIf="a.estado === 'reasignado'"
                        class="text-[10px] font-bold uppercase text-exh-700 dark:text-exh-300"
                        title="Reemplazo">R</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div *ngIf="gruposVisibles().length === 0"
           class="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        No hay turnos con ese filtro en este periodo.
        <button class="ml-1 font-semibold text-exh-600 dark:text-exh-400 hover:underline"
                (click)="limpiarFiltros()">Quitar filtros</button>
      </div>
    </div>

    <!-- ══ Modal Asignar slot ══ -->
    <app-modal [open]="modalAsignar()" (openChange)="cerrarAsignar($event)"
               title="Asignar turno"
               [subtitle]="subtituloSlot()" size="lg">
      <!-- ── Quién está asignado ahora ─────────────────────────────
           Paso 1 del diálogo: primero se ve a quién afecta el cambio y
           qué se puede hacer con él; recién después viene la lista. -->
      <div *ngIf="asignacionActiva()?.publicador as pub"
           class="mb-4 rounded-2xl border transition-colors"
           [ngClass]="modoAusencia()
             ? 'border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30'
             : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'">

        <!-- Estado normal: quién va y el botón de ausencia -->
        <div *ngIf="!modoAusencia()" class="flex items-center gap-3 p-3">
          <span class="w-9 h-9 rounded-full bg-exh-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {{ iniciales(pub.nombre_completo) }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{{ pub.nombre_completo }}</p>
            <p class="text-xs text-slate-500 dark:text-slate-400">Asignado a este turno</p>
          </div>
          <button *ngIf="puedeMarcarAusencia()" class="btn-secondary !py-1.5 !px-3 text-xs shrink-0"
                  (click)="iniciarAusencia()">
            No puede asistir
          </button>
        </div>

        <!-- Modo ausencia: el diálogo cambia de color y de instrucciones para
             que nunca quede duda de qué hace un clic en la lista de abajo. -->
        <div *ngIf="modoAusencia()" class="p-3.5">
          <div class="flex items-start gap-2.5 mb-3">
            <svg class="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5"
                 fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 8v4.5M12 16h.01"/>
            </svg>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-sm text-amber-900 dark:text-amber-200">
                {{ pub.nombre_completo }} no puede asistir
              </p>
              <p class="text-xs text-amber-700 dark:text-amber-400/90 mt-0.5">
                Paso 1 · Indica el motivo (opcional)
              </p>
            </div>
            <button class="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline shrink-0"
                    (click)="cancelarAusencia()">Cancelar</button>
          </div>

          <!-- Motivos de un toque: la mayoría de las ausencias caben en estos
               cuatro casos, así el coordinador no tiene que escribir nada. -->
          <div class="flex flex-wrap gap-1.5">
            <button *ngFor="let m of MOTIVOS_AUSENCIA"
                    class="chip-filtro !border-amber-200 dark:!border-amber-800/60"
                    [ngClass]="motivoSel() === m
                      ? 'bg-amber-500 !border-amber-500 text-white'
                      : 'bg-white dark:bg-slate-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60'"
                    (click)="elegirMotivo(m)">{{ m }}</button>
          </div>
          <input *ngIf="motivoSel() === 'Otro'" class="form-control mt-2 !text-sm"
                 [(ngModel)]="motivoOtro" placeholder="¿Cuál es el motivo?"
                 aria-label="Motivo de la ausencia" />

          <p class="text-xs font-medium text-amber-800 dark:text-amber-300 mt-3.5 mb-2">
            Paso 2 · ¿Quién lo reemplaza?
          </p>
          <button class="btn-secondary !py-1.5 !px-3 text-xs w-full justify-center"
                  (click)="guardarAusencia(null)">
            Nadie por ahora — dejar el turno sin cubrir
          </button>
        </div>
      </div>

      <!-- Candidatos: una sola búsqueda, una sola lista. Escribir filtra a los
           ya sugeridos y, si nadie calza, deja ver a cualquier otro publicador
           de la congregación debajo — antes esto era un segundo buscador
           aparte (el picker "fuera de la lista"), con su propio look flotante
           y su propio clic para abrir; dos formas distintas de buscar a
           alguien en el mismo diálogo. -->
      <p class="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
        {{ modoAusencia()
          ? 'Elige el reemplazo — la sugerencia de arriba es la mejor opción'
          : 'Sugeridos para este turno, del más recomendado al menos' }}
      </p>

      <div class="relative mb-3">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
             fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M20 20l-3.5-3.5"/>
        </svg>
        <input class="search-input focus:!ring-exh-500/20 focus:!border-exh-500" placeholder="Buscar por nombre…"
               [ngModel]="busquedaCandidato()" (ngModelChange)="busquedaCandidato.set($event)"
               aria-label="Buscar publicador para este turno" />
      </div>

      <div *ngIf="cargandoCandidatos()" class="space-y-2">
        <div class="skeleton h-12 rounded-xl" *ngFor="let i of [1,2,3,4,5]"></div>
      </div>

      <div *ngIf="!cargandoCandidatos()" class="max-h-[42vh] overflow-y-auto -mx-1 px-1 space-y-1.5">
        <button *ngFor="let c of candidatosFiltrados()"
                class="w-full flex items-start gap-3 p-2.5 rounded-xl border text-left transition-all focus-ring-blue"
                [disabled]="c.id_publicador === asignacionActiva()?.publicador?.id_publicador"
                [ngClass]="c.elegible
                  ? 'border-slate-200 dark:border-slate-700 hover:border-exh-400 dark:hover:border-exh-600 hover:bg-exh-50/60 dark:hover:bg-exh-950/40'
                  : 'border-slate-100 dark:border-slate-800 opacity-55'"
                (click)="elegirCandidato(c)">
          <span class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                [ngClass]="c.elegible ? 'bg-exh-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'">
            {{ iniciales(c.nombre) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center gap-2">
              <span class="font-medium text-sm text-slate-800 dark:text-slate-200 truncate min-w-0 flex-1">{{ c.nombre }}</span>
              <span *ngIf="c.tiene_fluidez" class="badge-neutral !text-[10px] shrink-0">Fluidez</span>
              <span *ngIf="c.es_precursor" class="badge-neutral !text-[10px] shrink-0">Precursor</span>
              <span *ngIf="c.id_publicador === asignacionActiva()?.publicador?.id_publicador"
                    class="badge-active !text-[10px] shrink-0">Actual</span>
            </span>
            <!-- Sin truncate: el motivo de inelegibilidad es justo lo que el
                 coordinador necesita leer completo, no un texto cortado a la mitad. -->
            <span class="block text-xs mt-0.5 leading-relaxed"
                  [ngClass]="c.elegible ? 'text-slate-500 dark:text-slate-400' : 'text-amber-600 dark:text-amber-500'">
              {{ c.notas.join(' · ') }}
            </span>
          </span>
        </button>

        <ng-container *ngIf="otrosFiltrados().length > 0">
          <p class="eyebrow !text-[10px] px-1 pt-2 pb-0.5">Otros publicadores</p>
          <button *ngFor="let p of otrosFiltrados()" type="button"
                  class="w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all focus-ring-blue
                         border-slate-200 dark:border-slate-700 hover:border-exh-400 dark:hover:border-exh-600 hover:bg-exh-50/60 dark:hover:bg-exh-950/40"
                  (click)="elegirExterno(p)">
            <span class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                         bg-slate-200 dark:bg-slate-700 text-slate-500">
              {{ iniciales(p.nombre_completo) }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{{ p.nombre_completo }}</span>
              <span class="block text-xs text-slate-400 dark:text-slate-500 truncate">
                {{ p.nombre_grupo }}<span *ngIf="p.nombre_grupo && p.telefono"> · </span>{{ p.telefono }}
              </span>
            </span>
          </button>
        </ng-container>

        <p *ngIf="candidatosFiltrados().length === 0 && otrosFiltrados().length === 0"
           class="text-sm text-slate-400 italic py-3 text-center">
          {{ busquedaCandidato().trim()
            ? 'Ningún publicador coincide con «' + busquedaCandidato().trim() + '».'
            : 'No hay participantes configurados todavía.' }}
        </p>
      </div>

      <!-- Conflicto detectado -->
      <div *ngIf="conflictoPendiente() as cf"
           class="mt-4 p-3 rounded-xl border border-red-300 dark:border-red-800/60 bg-red-50 dark:bg-red-950/40">
        <p class="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
          {{ cf.nombre }} ya tiene asignaciones ese día:
        </p>
        <ul class="text-xs text-red-600 dark:text-red-400 space-y-0.5 mb-3">
          <li *ngFor="let d of cf.detalles">• {{ d.detalle }}</li>
        </ul>
        <div class="flex gap-2 justify-end">
          <button class="btn-secondary !py-1.5 !px-3 text-xs" (click)="conflictoPendiente.set(null)">Cancelar</button>
          <button class="btn-primary-blue !py-1.5 !px-3 text-xs" (click)="confirmarEleccion()">Asignar de todos modos</button>
        </div>
      </div>

      <div class="flex justify-between items-center mt-5">
        <!-- En modo ausencia se oculta: allí «dejar sin cubrir» ya cumple ese
             papel, y dos botones que vacían el turno con distinto significado
             (uno deja rastro en el historial y el otro no) confunden. -->
        <button *ngIf="asignacionActiva()?.publicador && !modoAusencia()" class="btn-ghost-danger !text-xs"
                (click)="vaciarSlot()">Quitar asignación</button>
        <span *ngIf="!asignacionActiva()?.publicador || modoAusencia()"></span>
        <button class="btn-secondary" (click)="cerrarAsignar(false)">Cerrar</button>
      </div>
    </app-modal>

    <!-- ══ Modal Fechas bloqueadas ══ -->
    <app-modal [open]="modalBloqueadas()" (openChange)="modalBloqueadas.set($event)"
               title="Fechas bloqueadas"
               subtitle="Asambleas, congresos o eventos: esos días no se generan turnos."
               size="lg">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div class="space-y-2 max-h-72 overflow-y-auto">
          <div *ngFor="let f of fechasBloqueadas()"
               class="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-800 dark:text-slate-200 data-num">{{ f.fecha }}</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                {{ f.motivo || 'Sin motivo' }} · {{ f.ubicacion_nombre || 'Todas las ubicaciones' }}
              </p>
            </div>
            <button class="btn-icon-delete shrink-0" (click)="eliminarBloqueada(f)" aria-label="Quitar bloqueo">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <p *ngIf="fechasBloqueadas().length === 0" class="text-sm text-slate-400 italic py-2">
            No hay fechas bloqueadas este año.
          </p>
        </div>
        <div class="space-y-3">
          <p class="eyebrow">Bloquear fecha</p>
          <div>
            <label class="form-label">Fecha</label>
            <app-date-picker [(ngModel)]="nuevaBloqueada.fecha" colorScheme="blue" />
          </div>
          <div>
            <label class="form-label">Motivo</label>
            <input class="form-control" [(ngModel)]="nuevaBloqueada.motivo" placeholder="Ej. Asamblea de circuito" />
          </div>
          <div>
            <label class="form-label">Alcance</label>
            <select class="form-select" [(ngModel)]="nuevaBloqueada.id_ubicacion">
              <option [ngValue]="null">Todas las ubicaciones</option>
              <option *ngFor="let t of ubicacionesUnicas()" [ngValue]="t.id">{{ t.nombre }}</option>
            </select>
          </div>
          <div class="flex justify-end">
            <button class="btn-primary-blue" [disabled]="!nuevaBloqueada.fecha" (click)="crearBloqueada()">
              Bloquear
            </button>
          </div>
        </div>
      </div>
    </app-modal>

    <app-confirm-dialog
      [open]="confirmRegenerar()" (openChange)="confirmRegenerar.set($event)"
      [title]="'¿Regenerar ' + (esQuincenal() ? 'la ' : 'el ') + nombrePeriodo() + '?'"
      message="Se descartará el borrador actual (incluidos los cambios manuales) y se generará uno nuevo. Lo que ya está confirmado no se puede regenerar."
      confirmLabel="Regenerar"
      (confirmed)="generar(true)" />

    <app-confirm-dialog
      [open]="confirmEliminarMes()" (openChange)="confirmEliminarMes.set($event)"
      [title]="'¿Eliminar la programación ' + (esQuincenal() ? 'de la ' : 'del ') + nombrePeriodo() + '?'"
      message="Se borran todas esas asignaciones, incluidas las confirmadas. Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      (confirmed)="eliminarMes()" />
  `,
})
export class ProgramacionExhibidoresPage implements OnInit {
  private svc = inject(ExhibidoresService);
  private ctx = inject(CongregacionContextService);
  private toast = inject(ToastService);
  private lookup = inject(PublicadorLookupService);

  cargando = signal(true);
  generando = signal(false);
  confirmando = signal(false);
  mesData = signal<ProgramacionMes | null>(null);
  conflictos = signal<{ fecha: string; ubicacion_nombre: string; motivo: string }[]>([]);
  fechasBloqueadas = signal<FechaBloqueada[]>([]);

  ano = signal(new Date().getFullYear());
  mes = signal(new Date().getMonth() + 1);
  nombreMes = computed(() => MESES_ES[this.mes() - 1]);

  /** Quincena visible; solo se usa si la congregación programa por quincenas. */
  quincenaSel = signal<Quincena>(new Date().getDate() <= 15 ? 1 : 2);

  /** Filtro por día de la semana (0 = lunes … 6 = domingo). null = todos. */
  diaFiltro = signal<number | null>(null);

  /** Filtro por franja horaria. null = todo el día. */
  franjaFiltro = signal<FranjaFiltro | null>(null);
  periodicidad = computed<Periodicidad>(() => this.mesData()?.periodicidad ?? 'mensual');
  esQuincenal = computed(() => this.periodicidad() === 'quincenal');

  /** Quincena que se envía al backend: null cuando la congregación es mensual. */
  quincenaActiva = computed<Quincena | null>(() =>
    this.esQuincenal() ? this.quincenaSel() : null);

  /** Estado (generado / confirmado / cobertura) del periodo que se está viendo. */
  estadoPeriodo = computed(() => {
    const m = this.mesData();
    if (!m) return null;
    const q = this.quincenaActiva();
    if (q === null) {
      return { generado: m.generado, confirmado: m.confirmado, cobertura: m.cobertura };
    }
    const estado = m.quincenas?.find(x => x.quincena === q);
    return estado
      ? { generado: estado.generado, confirmado: estado.confirmado, cobertura: estado.cobertura }
      : { generado: false, confirmado: false, cobertura: { total: 0, cubiertas: 0 } };
  });

  /** Etiqueta del periodo para textos y botones («el mes» / «la 1ª quincena»). */
  nombrePeriodo = computed(() =>
    this.esQuincenal() ? `${this.quincenaSel()}ª quincena` : 'mes');

  modalAsignar = signal(false);
  asignacionActiva = signal<ExhibidorAsignacion | null>(null);
  celdaActiva = signal<CeldaTurno | null>(null);
  candidatos = signal<CandidatoSlot[]>([]);
  cargandoCandidatos = signal(false);
  slotInfo = signal<CandidatosSlotResponse['slot'] | null>(null);
  conflictoPendiente = signal<{ nombre: string; id: number; detalles: ConflictoDetalle[] } | null>(null);
  modoAusencia = signal(false);

  /**
   * Motivos de un toque. Cubren la mayoría de las ausencias reales, así el
   * coordinador registra una sin escribir nada; «Otro» abre el campo libre.
   */
  readonly MOTIVOS_AUSENCIA = ['Viaje', 'Salud', 'Trabajo', 'Asunto familiar', 'Otro'];
  motivoSel = signal<string | null>(null);
  motivoOtro = '';

  /** La ausencia solo tiene sentido sobre una programación ya publicada: en
   *  borrador se cambia la persona y ya. Guarda además el historial de quién
   *  faltó, que es lo que se pierde si simplemente se reasigna. */
  puedeMarcarAusencia = computed(() =>
    !!this.asignacionActiva()?.publicador && !!this.estadoPeriodo()?.confirmado);

  /**
   * Búsqueda única para el modal de asignar: filtra los candidatos ya
   * puntuados y, si nadie calza, revela otros publicadores de la
   * congregación (cargados una sola vez, igual que hacía el picker viejo).
   */
  busquedaCandidato = signal('');
  private otrosPublicadores = signal<PublicadorLite[]>([]);
  private otrosCargadosPara: number | null = null;

  private normalizarBusqueda(s: string): string {
    return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  candidatosFiltrados = computed(() => {
    const q = this.normalizarBusqueda(this.busquedaCandidato());
    if (!q) return this.candidatos();
    return this.candidatos().filter(c => this.normalizarBusqueda(c.nombre).includes(q));
  });

  otrosFiltrados = computed(() => {
    const q = this.normalizarBusqueda(this.busquedaCandidato());
    if (!q) return [];
    const yaListados = new Set(this.candidatos().map(c => c.id_publicador));
    return this.otrosPublicadores()
      .filter(p => !yaListados.has(p.id_publicador) && this.normalizarBusqueda(p.nombre_completo).includes(q))
      .slice(0, 8);
  });

  modalBloqueadas = signal(false);
  nuevaBloqueada: { fecha: string | null; motivo: string; id_ubicacion: number | null } = {
    fecha: null, motivo: '', id_ubicacion: null,
  };

  confirmRegenerar = signal(false);
  confirmEliminarMes = signal(false);

  /** Menú "⋯" junto a Regenerar: agrupa la acción destructiva sin ocultarla al fondo de la página. */
  accionesPeriodo: DropdownItem[] = [
    { key: 'eliminar', label: 'Eliminar programación', danger: true },
  ];

  onAccionPeriodo(key: string): void {
    if (key === 'eliminar') this.confirmEliminarMes.set(true);
  }

  porcentajeCobertura = computed(() => {
    const e = this.estadoPeriodo();
    if (!e || e.cobertura.total === 0) return 0;
    return Math.round((e.cobertura.cubiertas / e.cobertura.total) * 100);
  });

  /** Asignaciones agrupadas por fecha → turno, en orden cronológico. */
  gruposFecha = computed<GrupoFecha[]>(() => {
    const m = this.mesData();
    if (!m) return [];
    const turnosPorId = new Map<number, TurnoGrilla>();
    for (const t of m.turnos) turnosPorId.set(t.id_turno_exhibidor, t);

    const bloqueoGlobal = new Map<string, string>();
    const bloqueoUbic = new Map<string, string>();
    for (const b of m.fechas_bloqueadas) {
      if (b.id_ubicacion_exhibidor == null) bloqueoGlobal.set(b.fecha, b.motivo || 'Bloqueado');
      else bloqueoUbic.set(`${b.fecha}|${b.id_ubicacion_exhibidor}`, b.motivo || 'Bloqueado');
    }

    const porFecha = new Map<string, Map<number, ExhibidorAsignacion[]>>();
    for (const a of m.asignaciones) {
      if (!porFecha.has(a.fecha)) porFecha.set(a.fecha, new Map());
      const porTurno = porFecha.get(a.fecha)!;
      if (!porTurno.has(a.id_turno_exhibidor)) porTurno.set(a.id_turno_exhibidor, []);
      porTurno.get(a.id_turno_exhibidor)!.push(a);
    }

    const quincena = this.quincenaActiva();
    const fechas = [...new Set([...porFecha.keys(), ...bloqueoGlobal.keys()])].sort();
    return fechas
      .filter(f => f.startsWith(`${m.ano}-${String(m.mes).padStart(2, '0')}`))
      .filter(f => {
        if (quincena === null) return true;
        const dia = Number(f.slice(8, 10));
        return quincena === 1 ? dia <= 15 : dia >= 16;
      })
      .map(fecha => {
        const d = new Date(fecha + 'T00:00:00');
        const diaIdx = (d.getDay() + 6) % 7; // 0 = lunes
        const porTurno = porFecha.get(fecha) ?? new Map();
        const celdas: CeldaTurno[] = [...porTurno.entries()]
          .map(([idTurno, asigs]) => {
            const turno = turnosPorId.get(idTurno);
            if (!turno) return null;
            return {
              turno,
              asignaciones: asigs.sort((a: ExhibidorAsignacion, b: ExhibidorAsignacion) => a.posicion - b.posicion),
              bloqueada: bloqueoUbic.get(`${fecha}|${turno.id_ubicacion_exhibidor}`) ?? null,
            } as CeldaTurno;
          })
          .filter((c): c is CeldaTurno => c !== null)
          .sort((a, b) =>
            a.turno.ubicacion_nombre.localeCompare(b.turno.ubicacion_nombre)
            || a.turno.hora_inicio.localeCompare(b.turno.hora_inicio));
        return {
          fecha,
          diaNombre: DIAS_SEMANA[diaIdx],
          diaNumero: d.getDate(),
          diaIdx,
          celdas,
          bloqueoGlobal: bloqueoGlobal.get(fecha) ?? null,
        };
      });
  });

  /** Días de la semana presentes en el periodo (el filtro aplica a todas sus fechas). */
  diasDisponibles = computed(() => {
    const vistos = new Set<number>();
    for (const g of this.gruposFecha()) vistos.add(g.diaIdx);
    return [...vistos].sort((a, b) => a - b).map(idx => ({ idx, nombre: DIAS_SEMANA_CORTO[idx] }));
  });

  /**
   * Franja de un turno por su punto medio — misma regla que el backend
   * (engine/franjas.py), para que 11:00–13:00 caiga donde el generador dice.
   */
  private franjaDeTurno(turno: TurnoGrilla): FranjaFiltro {
    const minutos = (hora: string) => Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
    const medio = (minutos(turno.hora_inicio) + minutos(turno.hora_fin)) / 2;
    return medio < 12 * 60 ? 'am' : 'pm';
  }

  /** Solo se ofrece AM/PM si el periodo realmente tiene turnos en las dos franjas. */
  hayAmbasFranjas = computed(() => {
    const franjas = new Set<FranjaFiltro>();
    for (const g of this.gruposFecha()) {
      for (const c of g.celdas) franjas.add(this.franjaDeTurno(c.turno));
    }
    return franjas.size > 1;
  });

  hayFiltros = computed(() => this.diasDisponibles().length > 1 || this.hayAmbasFranjas());

  /** Lo que se pinta tras aplicar los filtros de día y franja. */
  gruposVisibles = computed(() => {
    const dia = this.diaFiltro();
    const franja = this.franjaFiltro();
    let grupos = this.gruposFecha();
    if (dia !== null) grupos = grupos.filter(g => g.diaIdx === dia);
    if (franja !== null) {
      grupos = grupos
        .map(g => ({ ...g, celdas: g.celdas.filter(c => this.franjaDeTurno(c.turno) === franja) }))
        // Las fechas bloqueadas siguen visibles: explican por qué no hay turnos.
        .filter(g => g.bloqueoGlobal !== null || g.celdas.length > 0);
    }
    return grupos;
  });

  filtrarDia(idx: number | null): void {
    this.diaFiltro.set(this.diaFiltro() === idx ? null : idx);
  }

  filtrarFranja(f: FranjaFiltro): void {
    this.franjaFiltro.set(this.franjaFiltro() === f ? null : f);
  }

  limpiarFiltros(): void {
    this.diaFiltro.set(null);
    this.franjaFiltro.set(null);
  }

  clasesChip(activo: boolean): string {
    return activo
      ? 'bg-exh-600 border-exh-600 text-white shadow-sm'
      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-exh-300 dark:hover:border-exh-700 hover:text-exh-600 dark:hover:text-exh-400';
  }

  ubicacionesUnicas = computed(() => {
    const m = this.mesData();
    if (!m) return [];
    const vistos = new Map<number, string>();
    for (const t of m.turnos) vistos.set(t.id_ubicacion_exhibidor, t.ubicacion_nombre);
    return [...vistos.entries()].map(([id, nombre]) => ({ id, nombre }));
  });

  get idCong(): number | null {
    return this.ctx.effectiveCongregacionId();
  }

  ngOnInit(): void {
    this.cargarMes();
  }

  cambiarMes(delta: number): void {
    let m = this.mes() + delta;
    let a = this.ano();
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    this.mes.set(m);
    this.ano.set(a);
    this.conflictos.set([]);
    this.limpiarFiltros(); // otro mes puede no tener ese día de la semana
    this.cargarMes();
  }

  cargarMes(): void {
    this.cargando.set(true);
    this.svc.getMes(this.ano(), this.mes(), this.idCong).subscribe({
      next: data => { this.mesData.set(data); this.cargando.set(false); },
      error: () => {
        this.cargando.set(false);
        this.toast.error('Error', 'No se pudo cargar la programación.');
      },
    });
  }

  /** Cambia de quincena sin recargar: el mes ya trae ambas. */
  seleccionarQuincena(q: Quincena): void {
    if (this.quincenaSel() === q) return;
    this.quincenaSel.set(q);
    this.conflictos.set([]);
  }

  generar(regenerar: boolean): void {
    this.generando.set(true);
    this.svc.generar(this.ano(), this.mes(), regenerar, this.idCong, this.quincenaActiva()).subscribe({
      next: data => {
        this.generando.set(false);
        this.mesData.set(data);
        this.conflictos.set((data.conflictos ?? []).map(c => ({
          fecha: c.fecha, ubicacion_nombre: c.ubicacion_nombre, motivo: c.motivo,
        })));
        const huecos = data.conflictos?.length ?? 0;
        if (huecos > 0) {
          this.toast.warning('Borrador generado', `${huecos} hueco(s) quedaron sin candidato.`);
        } else {
          this.toast.success('Borrador generado', 'Todos los turnos quedaron cubiertos.');
        }
      },
      error: err => {
        this.generando.set(false);
        this.toast.error('No se pudo generar', err?.error?.detail ?? 'Inténtalo de nuevo.');
      },
    });
  }

  confirmar(): void {
    this.confirmando.set(true);
    this.svc.confirmar(this.ano(), this.mes(), this.idCong, this.quincenaActiva()).subscribe({
      next: () => {
        this.confirmando.set(false);
        this.toast.success(
          this.esQuincenal() ? 'Quincena confirmada' : 'Mes confirmado',
          'La programación quedó publicada.',
        );
        this.cargarMes();
      },
      error: err => {
        this.confirmando.set(false);
        this.toast.error('Error al confirmar', err?.error?.detail ?? 'Inténtalo de nuevo.');
      },
    });
  }

  eliminarMes(): void {
    this.svc.eliminarMes(this.ano(), this.mes(), this.idCong, this.quincenaActiva()).subscribe({
      next: () => {
        this.toast.success('Programación eliminada');
        this.conflictos.set([]);
        this.cargarMes();
      },
      error: err => this.toast.error('Error', err?.error?.detail ?? 'No se pudo eliminar.'),
    });
  }

  descargarPdf(): void {
    const quincena = this.quincenaActiva();
    this.svc.descargarPdf(this.ano(), this.mes(), this.idCong, quincena).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const sufijo = quincena !== null ? `_q${quincena}` : '';
        a.download = `exhibidores_${this.ano()}_${String(this.mes()).padStart(2, '0')}${sufijo}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.error('Error', 'No se pudo descargar el PDF.'),
    });
  }

  // ── Asignar slot ───────────────────────────────────────────
  abrirAsignar(a: ExhibidorAsignacion, celda: CeldaTurno): void {
    this.asignacionActiva.set(a);
    this.celdaActiva.set(celda);
    this.candidatos.set([]);
    this.slotInfo.set(null);
    this.conflictoPendiente.set(null);
    this.modoAusencia.set(false);
    this.motivoSel.set(null);
    this.motivoOtro = '';
    this.busquedaCandidato.set('');
    this.modalAsignar.set(true);
    this.cargandoCandidatos.set(true);
    this.cargarOtrosPublicadores();
    this.svc.getCandidatos(a.id_exhibidor_asignacion, this.idCong).subscribe({
      next: res => {
        this.candidatos.set(res.candidatos);
        this.slotInfo.set(res.slot);
        this.cargandoCandidatos.set(false);
      },
      error: () => {
        this.cargandoCandidatos.set(false);
        this.toast.error('Error', 'No se pudieron cargar los candidatos.');
      },
    });
  }

  /** Carga perezosa y cacheada por congregación — solo se pide una vez. */
  private cargarOtrosPublicadores(): void {
    const id = this.idCong;
    if (!id || this.otrosCargadosPara === id) return;
    this.lookup.listar(id).subscribe(lista => {
      this.otrosPublicadores.set(lista);
      this.otrosCargadosPara = id;
    });
  }

  subtituloSlot(): string {
    const s = this.slotInfo();
    const a = this.asignacionActiva();
    if (!s) return a ? `${a.fecha} · posición ${a.posicion}` : '';
    const hora = new Hora12Pipe();
    return `${s.dia_nombre} ${s.fecha} · ${s.ubicacion_nombre} · ${hora.transform(s.hora_inicio)} – ${hora.transform(s.hora_fin)}`;
  }

  cerrarAsignar(open: boolean): void {
    if (!open) {
      this.modalAsignar.set(false);
      this.asignacionActiva.set(null);
      this.conflictoPendiente.set(null);
    }
  }

  elegirCandidato(c: CandidatoSlot): void {
    if (this.modoAusencia()) {
      this.guardarAusencia(c.id_publicador, c.nombre);
      return;
    }
    if (c.elegible) {
      this.asignar(c.id_publicador);
    } else {
      // No elegible: verificar conflictos reales y pedir confirmación
      this.verificarYProponer(c.id_publicador, c.nombre);
    }
  }

  elegirExterno(p: PublicadorLite | null): void {
    if (!p) return;
    if (this.modoAusencia()) {
      this.guardarAusencia(p.id_publicador, p.nombre_completo);
      return;
    }
    this.verificarYProponer(p.id_publicador, p.nombre_completo);
  }

  private verificarYProponer(idPublicador: number, nombre: string): void {
    const a = this.asignacionActiva();
    if (!a) return;
    this.svc.verificarConflicto(idPublicador, a.fecha, this.idCong).subscribe({
      next: res => {
        if (res.tiene_conflicto) {
          this.conflictoPendiente.set({ id: idPublicador, nombre, detalles: res.asignaciones });
        } else {
          this.asignar(idPublicador);
        }
      },
      error: () => this.asignar(idPublicador),
    });
  }

  confirmarEleccion(): void {
    const cf = this.conflictoPendiente();
    if (cf) this.asignar(cf.id);
  }

  private asignar(idPublicador: number | null): void {
    const a = this.asignacionActiva();
    if (!a) return;
    this.svc.editarItem(a.id_exhibidor_asignacion, { id_publicador: idPublicador }, this.idCong).subscribe({
      next: () => {
        this.toast.success(idPublicador ? 'Turno asignado' : 'Asignación quitada');
        this.cerrarAsignar(false);
        this.cargarMes();
      },
      error: err => this.toast.error('Error', err?.error?.detail ?? 'No se pudo guardar.'),
    });
  }

  vaciarSlot(): void {
    this.asignar(null);
  }

  iniciarAusencia(): void {
    this.modoAusencia.set(true);
    this.motivoSel.set(null);
    this.motivoOtro = '';
    this.busquedaCandidato.set('');
  }

  cancelarAusencia(): void {
    this.modoAusencia.set(false);
    this.motivoSel.set(null);
    this.motivoOtro = '';
  }

  /** Volver a tocar el motivo activo lo deselecciona: el motivo es opcional. */
  elegirMotivo(motivo: string): void {
    this.motivoSel.set(this.motivoSel() === motivo ? null : motivo);
    if (this.motivoSel() !== 'Otro') this.motivoOtro = '';
  }

  private motivoAusenciaFinal(): string | null {
    const sel = this.motivoSel();
    if (!sel) return null;
    return sel === 'Otro' ? (this.motivoOtro.trim() || null) : sel;
  }

  guardarAusencia(idReemplazo: number | null, nombreReemplazo?: string): void {
    const a = this.asignacionActiva();
    if (!a) return;
    const ausente = a.publicador?.nombre_completo ?? 'La persona asignada';
    this.svc.marcarAusencia(a.id_exhibidor_asignacion, {
      motivo: this.motivoAusenciaFinal(),
      id_publicador_reemplazo: idReemplazo,
    }, this.idCong).subscribe({
      next: () => {
        this.toast.success(
          idReemplazo ? 'Reemplazo registrado' : 'Ausencia registrada',
          idReemplazo
            ? `${nombreReemplazo ?? 'El reemplazo'} cubre a ${ausente}. Queda en el historial.`
            : `${ausente} no asistirá y el turno quedó libre para cubrirlo.`,
        );
        this.cerrarAsignar(false);
        this.cargarMes();
      },
      error: err => this.toast.error('Error', err?.error?.detail ?? 'No se pudo guardar.'),
    });
  }

  // ── Fechas bloqueadas ──────────────────────────────────────
  abrirBloqueadas(): void {
    this.modalBloqueadas.set(true);
    this.cargarBloqueadas();
  }

  private cargarBloqueadas(): void {
    this.svc.getFechasBloqueadas(this.idCong, this.ano()).subscribe({
      next: data => this.fechasBloqueadas.set(data),
      error: () => {},
    });
  }

  crearBloqueada(): void {
    if (!this.nuevaBloqueada.fecha) return;
    this.svc.crearFechaBloqueada({
      fecha: this.nuevaBloqueada.fecha,
      motivo: this.nuevaBloqueada.motivo.trim() || null,
      id_ubicacion_exhibidor: this.nuevaBloqueada.id_ubicacion,
    }, this.idCong).subscribe({
      next: () => {
        this.toast.success('Fecha bloqueada');
        this.nuevaBloqueada = { fecha: null, motivo: '', id_ubicacion: null };
        this.cargarBloqueadas();
        this.cargarMes();
      },
      error: err => this.toast.error('Error', err?.error?.detail ?? 'No se pudo bloquear.'),
    });
  }

  eliminarBloqueada(f: FechaBloqueada): void {
    this.svc.eliminarFechaBloqueada(f.id_fecha_bloqueada, this.idCong).subscribe({
      next: () => { this.cargarBloqueadas(); this.cargarMes(); },
      error: err => this.toast.error('Error', err?.error?.detail ?? 'No se pudo quitar.'),
    });
  }

  // ── Helpers ────────────────────────────────────────────────
  iniciales(nombre: string): string {
    return nombre.split(/\s+/).slice(0, 2).map(p => p[0] ?? '').join('').toUpperCase();
  }

  /**
   * Estados del slot. Los tres estados "normales" se separan por peso visual
   * dentro de la misma familia azul en vez de meter otro tono de marca:
   *   asignado   → neutro (blanco/slate): es el caso mayoritario, no compite
   *   reasignado → azul suave relleno: cambió respecto al plan original
   *   sin asignar→ borde punteado neutro
   * El rojo queda reservado para la ausencia sin cubrir, que sí es una alerta.
   */
  clasesSlot(a: ExhibidorAsignacion): string {
    if (a.estado === 'ausente' || (!a.publicador && a.publicador_original)) {
      return 'border-red-300 dark:border-red-800/70 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300';
    }
    if (!a.publicador) {
      return 'border-dashed border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-exh-400 dark:hover:border-exh-600';
    }
    if (a.estado === 'reasignado') {
      // Borde en -500, no -300: es el escalón más claro que llega a 3:1 contra
      // el fondo de página y contra el relleno del propio chip (WCAG 1.4.11).
      return 'border-exh-500 dark:border-exh-500/70 bg-exh-50 dark:bg-exh-950/50 text-exh-800 dark:text-exh-300 hover:border-exh-600 dark:hover:border-exh-400';
    }
    return 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:border-exh-400 dark:hover:border-exh-600';
  }
}
