import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ExhibidoresTabsComponent } from '../components/exhibidores-tabs.component';
import { ExhibidoresService } from '../services/exhibidores.service';
import { Hora12Pipe } from '../../../shared/pipes/hora12.pipe';
import {
  DIAS_SEMANA, DIAS_SEMANA_CORTO, ExhibidorAsignacion, MESES_ES, MiTurno,
  ProgramacionMes, TurnoGrilla,
} from '../models/exhibidor.model';

interface EventoDia {
  idUbicacion: number;
  ubicacion: string;
  color: number;        // 1..8, índice de la paleta .loc-N de styles.scss
  hora: string;
  horaFin: string;
  personas: string[];
  esMio: boolean;
}

interface CeldaCalendario {
  fecha: string;        // ISO YYYY-MM-DD
  dia: number;
  diaNombre: string;
  otroMes: boolean;
  esHoy: boolean;
  esFinde: boolean;
  bloqueado: string | null;
  eventos: EventoDia[];
  tieneMio: boolean;
}

interface LugarLeyenda {
  id: number;
  nombre: string;
  color: number;
  salidas: number;
}

/** Cuántos turnos caben en una celda antes de resumir con "+N más". */
const MAX_PILDORAS_CELDA = 3;

@Component({
  selector: 'app-calendario-exhibidores-page',
  standalone: true,
  imports: [CommonModule, PageHeaderComponent, EmptyStateComponent, ExhibidoresTabsComponent, Hora12Pipe],
  template: `
    <app-page-header
      title="Calendario de exhibidores"
      subtitle="Todo el mes de un vistazo. Cada color es un lugar de salida distinto.">
      <button *ngIf="mesData()?.generado" class="btn-secondary" (click)="descargarPdf()">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"/>
        </svg>
        Descargar PDF
      </button>
    </app-page-header>

    <app-exhibidores-tabs />

    <!-- Tarjeta de turno propio. Vive en un template porque se pinta en dos
         sitios: la tira horizontal (hasta 16") y el raíl lateral (16" y más).
         Todas se ven igual — cuál es la más próxima ya lo dice el propio
         texto ("Hoy", "Mañana", "En 3 días"), así que no hace falta una
         insignia ni un borde especial encima para señalarlo. -->
    <ng-template #turnoCard let-t>
      <div class="px-4 py-3 rounded-2xl bg-exh-700 text-white" style="box-shadow: var(--shadow-blue)">
        <p class="text-xs font-bold uppercase tracking-wide text-exh-100">
          {{ t.dia_nombre }} · {{ relativoTexto(t.fecha) }}
        </p>
        <p class="font-display font-extrabold text-xl leading-tight text-white">{{ formatearFecha(t.fecha) }}</p>
        <p class="text-sm font-semibold text-white mt-0.5">{{ t.ubicacion_nombre }}</p>
        <p class="text-sm text-exh-100 font-medium whitespace-nowrap">{{ t.hora_inicio | hora12 }} – {{ t.hora_fin | hora12 }}</p>
      </div>
    </ng-template>

    <!-- ── Mis próximos turnos · tira horizontal ────────────────────
         Lo primero que busca el publicador es "cuándo me toca a mí".
         Desde 1680px se muda al raíl derecho: en un portátil esta tira
         come 130px de alto y empuja media cuadrícula fuera de pantalla. -->
    <section *ngIf="misTurnos().length > 0" class="mb-6 mbp16:hidden" aria-label="Mis próximos turnos">
      <h2 class="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100 mb-2.5">
        <svg class="w-5 h-5 text-exh-600 dark:text-exh-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.12 4.6 5.02.62c.47.06.66.65.31.97l-3.7 3.42.97 4.96c.09.47-.4.83-.82.6L12 16.2l-4.42 2.47c-.42.23-.91-.13-.82-.6l.97-4.96-3.7-3.42c-.35-.32-.16-.91.31-.97l5.02-.62 2.12-4.6Z"/>
        </svg>
        Mis próximos turnos
      </h2>
      <div class="flex gap-3 overflow-x-auto pb-1.5">
        <div *ngFor="let t of misTurnos()" class="shrink-0 min-w-48">
          <ng-container *ngTemplateOutlet="turnoCard; context: { $implicit: t }" />
        </div>
      </div>
    </section>

    <!-- ── Rejilla de página ────────────────────────────────────────
         En 16" (>=1680px) sobra ancho y falta alto: el calendario se
         queda con la columna principal y "mis turnos" pasa a un raíl de
         280px, con lo que el mes entero entra sin hacer scroll. En 14"
         (1440-1679px) no hay ancho para el raíl sin estrechar las celdas
         por debajo de lo legible, así que se mantiene una sola columna. -->
    <div [ngClass]="misTurnos().length > 0
          ? 'mbp16:grid mbp16:grid-cols-[minmax(0,1fr)_280px] mbp16:gap-6 mbp16:items-start'
          : ''">
    <div class="min-w-0">

    <!-- ── Barra de control ─────────────────────────────────────────
         Navegación de mes, botón Hoy y cambio de vista. Los botones son
         de 44px reales: el público de esta pantalla incluye personas
         mayores y punteros poco precisos. -->
    <div class="card-elevated p-3 sm:p-4 mbp:p-3 mb-4 mbp:mb-3">
      <div class="flex flex-wrap items-center gap-2.5">
        <div class="flex items-center gap-2">
          <button type="button" (click)="cambiarMes(-1)" aria-label="Ver el mes anterior"
                  class="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition active:scale-95 focus-ring-blue">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"/>
            </svg>
          </button>
          <h2 class="font-display font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-slate-50 min-w-44 sm:min-w-52 text-center"
              aria-live="polite">
            {{ nombreMes() }} {{ ano() }}
          </h2>
          <button type="button" (click)="cambiarMes(1)" aria-label="Ver el mes siguiente"
                  class="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition active:scale-95 focus-ring-blue">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
            </svg>
          </button>
        </div>

        <button *ngIf="!esMesActual()" type="button" (click)="irAHoy()"
                class="h-9 px-3.5 rounded-xl border border-exh-600 text-exh-700 dark:text-exh-300 dark:border-exh-500 font-semibold text-sm hover:bg-exh-50 dark:hover:bg-exh-950/50 transition active:scale-95 focus-ring-blue">
          Volver a hoy
        </button>

        <!-- Grupo derecho: turnos propios + cambio de vista, uno junto al
             otro en la misma fila que la navegación de mes. Antes "Ver solo
             mis turnos" vivía en el renglón de la leyenda con un separador
             suelto — en cuanto no cabía se quedaba huérfano en su propia
             línea. Aquí arriba hay más ancho libre y nunca se desprende. -->
        <div class="ml-auto flex items-center gap-2">
          <button *ngIf="tengoTurnos()" type="button" (click)="soloMios.set(!soloMios())" [attr.aria-pressed]="soloMios()"
                  class="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-sm font-semibold border transition active:scale-95"
                  [ngClass]="soloMios()
                    ? 'bg-exh-600 border-exh-600 text-white'
                    : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'">
            <svg class="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.12 4.6 5.02.62c.47.06.66.65.31.97l-3.7 3.42.97 4.96c.09.47-.4.83-.82.6L12 16.2l-4.42 2.47c-.42.23-.91-.13-.82-.6l.97-4.96-3.7-3.42c-.35-.32-.16-.91.31-.97l5.02-.62 2.12-4.6Z"/>
            </svg>
            <span class="hidden sm:inline">{{ soloMios() ? 'Mostrando solo mis turnos' : 'Ver solo mis turnos' }}</span>
            <span class="sm:hidden">Mis turnos</span>
          </button>

          <!-- Cambio de vista. La vista de lista existe para quien prefiere
               leer día por día en vez de interpretar una cuadrícula. -->
          <div class="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/70" role="group" aria-label="Forma de ver el calendario">
            <button type="button" (click)="vista.set('mes')" [attr.aria-pressed]="vista() === 'mes'"
                    class="h-9 px-3.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
                    [ngClass]="vista() === 'mes'
                      ? 'bg-exh-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/>
              </svg>
              Mes
            </button>
            <button type="button" (click)="vista.set('lista')" [attr.aria-pressed]="vista() === 'lista'"
                    class="h-9 px-3.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5"
                    [ngClass]="vista() === 'lista'
                      ? 'bg-exh-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700'">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>
              </svg>
              Lista
            </button>
          </div>
        </div>
      </div>

      <!-- ── Leyenda de lugares ──────────────────────────────────────
           Es a la vez leyenda y filtro. Cada chip lleva el nombre escrito
           además del color, así nadie depende de distinguir tonos.

           La etiqueta y la explicación viven en la MISMA fila que los
           chips (antes cada una tenía su propio renglón): en un 14"/16"
           esa fila de más era la diferencia entre ver 5 o 6 semanas
           enteras sin recortar la última. El texto de ayuda se mueve al
           aria-label del grupo — sigue anunciándose por teclado/lector de
           pantalla, sin gastar una línea visible. -->
      <div *ngIf="lugares().length > 0" class="mt-2.5 pt-2.5 mbp:mt-2 mbp:pt-2 border-t border-slate-200 dark:border-slate-700">
        <div class="flex flex-wrap items-center gap-x-2 gap-y-1.5"
             role="group" aria-label="Lugares de salida. Toca uno para ver solo ese lugar.">
          <span class="text-sm font-semibold text-slate-700 dark:text-slate-300 mr-0.5 shrink-0">
            Lugares:
          </span>
          <button *ngFor="let l of lugares()" type="button"
                  (click)="alternarLugar(l.id)"
                  [attr.aria-pressed]="lugarFiltro() === l.id"
                  [class]="'loc-chip loc-' + l.color"
                  [class.loc-chip-activo]="lugarFiltro() === l.id"
                  [class.loc-chip-apagado]="lugarFiltro() !== null && lugarFiltro() !== l.id">
            <span class="loc-dot"></span>
            {{ l.nombre }}
            <span class="opacity-70 font-medium">{{ l.salidas }}</span>
          </button>
          <button *ngIf="lugarFiltro() !== null" type="button" (click)="lugarFiltro.set(null)"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>
            </svg>
            Ver todos
          </button>
        </div>
      </div>
    </div>

    <!-- Skeleton -->
    <div *ngIf="cargando()" class="skeleton h-[32rem] rounded-2xl"></div>

    <app-empty-state *ngIf="!cargando() && mesData() && !mesData()!.generado"
      accent="blue"
      icon="calendar-off"
      title="Todavía no hay programación para este mes"
      description="El coordinador aún no la ha generado. Usa las flechas de arriba para mirar otro mes." />

    <!-- ═══ Vista MES ═══════════════════════════════════════════════ -->
    <div *ngIf="!cargando() && mesData()?.generado && vista() === 'mes'" class="card-elevated overflow-hidden">
      <!-- Cabecera de días. Nombre completo desde md: "Miércoles" se lee
           sin esfuerzo, "Mié" hay que descifrarlo. -->
      <div class="grid grid-cols-7 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
        <div *ngFor="let d of diasCorto; let i = index"
             class="py-2.5 text-center text-sm font-bold uppercase tracking-wide"
             [ngClass]="i >= 5 ? 'text-exh-700 dark:text-exh-300' : 'text-slate-700 dark:text-slate-300'">
          <span class="md:hidden">{{ d }}</span>
          <span class="hidden md:inline">{{ diasLargos[i] }}</span>
        </div>
      </div>

      <div *ngFor="let semana of semanas()" class="grid grid-cols-7">
        <button *ngFor="let celda of semana" type="button"
                (click)="abrirDia(celda)"
                [disabled]="celda.otroMes || (celda.eventos.length === 0 && !celda.bloqueado)"
                [attr.aria-label]="etiquetaDia(celda)"
                class="relative text-left min-h-28 md:min-h-32 mbp16:min-h-36 border-b border-r border-slate-200 dark:border-slate-700 p-2 mbp:p-2.5 last:border-r-0 transition-colors
                       enabled:hover:bg-exh-50/60 dark:enabled:hover:bg-exh-950/30 disabled:cursor-default focus-ring-blue"
                [ngClass]="celda.otroMes
                  ? 'bg-slate-100/70 dark:bg-slate-900/50'
                  : celda.esFinde ? 'bg-slate-50/70 dark:bg-slate-900/25' : 'bg-white dark:bg-slate-800'"
                [class.dia-bloqueado]="!!celda.bloqueado">

          <!-- Barra superior: número de día + marca de turno propio -->
          <div class="flex items-center justify-between mb-1.5">
            <span class="min-w-7 h-7 px-1.5 flex items-center justify-center rounded-lg text-base font-bold"
                  [ngClass]="celda.esHoy
                    ? 'bg-exh-600 text-white'
                    : celda.otroMes
                      ? 'text-slate-400 dark:text-slate-600'
                      : 'text-slate-900 dark:text-slate-100'">
              {{ celda.dia }}
            </span>
            <span *ngIf="celda.esHoy" class="text-[11px] font-bold uppercase tracking-wide text-exh-700 dark:text-exh-300">Hoy</span>
            <svg *ngIf="celda.tieneMio && !celda.esHoy" class="w-4 h-4 text-exh-600 dark:text-exh-400" fill="currentColor" viewBox="0 0 24 24">
              <title>Tienes un turno este día</title>
              <path d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.12 4.6 5.02.62c.47.06.66.65.31.97l-3.7 3.42.97 4.96c.09.47-.4.83-.82.6L12 16.2l-4.42 2.47c-.42.23-.91-.13-.82-.6l.97-4.96-3.7-3.42c-.35-.32-.16-.91.31-.97l5.02-.62 2.12-4.6Z"/>
            </svg>
          </div>

          <p *ngIf="celda.bloqueado"
             class="flex items-center gap-1 text-xs font-bold text-amber-800 dark:text-amber-300 mb-1 truncate">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 8v4.5M12 16h.01"/>
            </svg>
            {{ celda.bloqueado }}
          </p>

          <div class="space-y-1">
            <div *ngFor="let e of celda.eventos | slice:0:maxPildoras"
                 [class]="'loc-pill loc-' + e.color"
                 [class.opacity-25]="estaApagado(e)"
                 [class.ring-2]="e.esMio"
                 [class.ring-exh-600]="e.esMio">
              <!-- Sin hora aquí: en la cuadrícula lo que importa es "dónde" y
                   "quién", la hora exacta se consulta abriendo el día. El
                   nombre del lugar se parte en dos líneas en vez de cortarse:
                   "Parque del Ara" recortado a "Parque del ..." obliga a abrir
                   el día para saber de qué lugar se trata. Cada persona va en
                   su propia fila — unidas por comas, un nombre largo se
                   tragaba a los demás en el truncate. -->
              <span class="block text-xs mbp:text-[13px] font-bold line-clamp-2">
                {{ e.ubicacion }}
              </span>
              <span *ngFor="let p of e.personas" class="block text-xs mbp:text-[13px] truncate opacity-85">
                {{ p }}
              </span>
              <span *ngIf="e.personas.length === 0" class="block text-xs mbp:text-[13px] italic opacity-70">
                Sin asignar
              </span>
            </div>
            <p *ngIf="celda.eventos.length > maxPildoras"
               class="text-xs font-bold text-exh-700 dark:text-exh-300 pl-1">
              +{{ celda.eventos.length - maxPildoras }} más
            </p>
          </div>
        </button>
      </div>
    </div>

    <!-- ═══ Vista LISTA ═════════════════════════════════════════════ -->
    <div *ngIf="!cargando() && mesData()?.generado && vista() === 'lista'" class="card-elevated overflow-hidden">
      <div *ngIf="diasConSalida().length === 0" class="p-10 text-center">
        <p class="text-base font-semibold text-slate-700 dark:text-slate-200">No hay salidas que mostrar</p>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">Prueba a quitar el filtro de lugar o de turnos propios.</p>
      </div>

      <div *ngFor="let celda of diasConSalida()"
           class="flex gap-4 p-4 border-b border-slate-200 dark:border-slate-700 last:border-b-0"
           [ngClass]="celda.esHoy ? 'bg-exh-50 dark:bg-exh-950/30' : ''">
        <!-- Columna de fecha, ancho fijo para que todo el listado se alinee -->
        <div class="w-16 shrink-0 text-center">
          <p class="text-xs font-bold uppercase tracking-wide"
             [ngClass]="celda.esHoy ? 'text-exh-700 dark:text-exh-300' : 'text-slate-500 dark:text-slate-400'">
            {{ celda.diaNombre }}
          </p>
          <p class="font-display font-extrabold text-3xl leading-none"
             [ngClass]="celda.esHoy ? 'text-exh-700 dark:text-exh-300' : 'text-slate-900 dark:text-slate-100'">
            {{ celda.dia }}
          </p>
          <p *ngIf="celda.esHoy" class="text-[11px] font-bold uppercase text-exh-700 dark:text-exh-300 mt-0.5">Hoy</p>
        </div>

        <div class="flex-1 min-w-0 space-y-2">
          <p *ngIf="celda.bloqueado"
             class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 8v4.5M12 16h.01"/>
            </svg>
            {{ celda.bloqueado }}
          </p>
          <div *ngFor="let e of celda.eventos"
               [class]="'loc-pill loc-pill-md loc-' + e.color"
               [class.ring-2]="e.esMio"
               [class.ring-exh-600]="e.esMio">
            <p class="flex flex-wrap items-center gap-x-2 text-base font-bold">
              <span class="font-mono tabular-nums whitespace-nowrap">{{ e.hora | hora12 }} – {{ e.horaFin | hora12 }}</span>
              <span>{{ e.ubicacion }}</span>
              <span *ngIf="e.esMio" class="px-2 py-0.5 rounded-full text-xs font-bold bg-exh-600 text-white">Te toca</span>
            </p>
            <p class="text-sm mt-0.5 opacity-90">{{ e.personas.join(' y ') || 'Sin asignar' }}</p>
          </div>
        </div>
      </div>
    </div>
    </div><!-- /columna principal -->

    <!-- Raíl de 16": mis turnos en vertical, junto al mes y no encima -->
    <aside *ngIf="misTurnos().length > 0" class="hidden mbp16:block" aria-label="Mis próximos turnos">
      <h2 class="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100 mb-2.5">
        <svg class="w-5 h-5 text-exh-600 dark:text-exh-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.48 3.5a.56.56 0 0 1 1.04 0l2.12 4.6 5.02.62c.47.06.66.65.31.97l-3.7 3.42.97 4.96c.09.47-.4.83-.82.6L12 16.2l-4.42 2.47c-.42.23-.91-.13-.82-.6l.97-4.96-3.7-3.42c-.35-.32-.16-.91.31-.97l5.02-.62 2.12-4.6Z"/>
        </svg>
        Mis próximos turnos
      </h2>
      <div class="space-y-3">
        <ng-container *ngFor="let t of misTurnos()">
          <ng-container *ngTemplateOutlet="turnoCard; context: { $implicit: t }" />
        </ng-container>
      </div>
    </aside>
    </div><!-- /rejilla de página -->

    <!-- ═══ Detalle de un día ═══════════════════════════════════════
         Al tocar una celda se abre el día en grande. Es la red de
         seguridad de la cuadrícula: nada queda escondido en 12px. -->
    <div *ngIf="diaAbierto() as d"
         class="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
         style="z-index: var(--z-modal)"
         (click)="diaAbierto.set(null)">
      <div class="w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl"
           role="dialog" aria-modal="true" [attr.aria-label]="'Salidas del ' + d.dia + ' de ' + nombreMes()"
           (click)="$event.stopPropagation()">
        <div class="flex items-start justify-between gap-4 p-5 border-b border-slate-200 dark:border-slate-700">
          <div>
            <p class="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ diaNombreLargo(d.fecha) }}</p>
            <p class="font-display font-extrabold text-2xl text-slate-900 dark:text-slate-50">
              {{ d.dia }} de {{ nombreMes() }}
            </p>
          </div>
          <button type="button" (click)="diaAbierto.set(null)" aria-label="Cerrar"
                  class="w-11 h-11 shrink-0 flex items-center justify-center rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>

        <div class="p-5 space-y-3">
          <p *ngIf="d.bloqueado"
             class="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            <svg class="w-5 h-5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 8v4.5M12 16h.01"/>
            </svg>
            {{ d.bloqueado }}
          </p>

          <p *ngIf="d.eventos.length === 0" class="text-base text-slate-600 dark:text-slate-300">
            No hay salidas programadas este día.
          </p>

          <div *ngFor="let e of d.eventos" [class]="'loc-pill loc-pill-lg loc-' + e.color">
            <p class="flex flex-wrap items-center gap-x-2 text-lg font-bold">
              <span class="font-mono tabular-nums whitespace-nowrap">{{ e.hora | hora12 }} – {{ e.horaFin | hora12 }}</span>
              <span *ngIf="e.esMio" class="px-2 py-0.5 rounded-full text-xs font-bold bg-exh-600 text-white">Te toca</span>
            </p>
            <p class="text-base font-semibold">{{ e.ubicacion }}</p>
            <ul class="mt-1.5 space-y-0.5">
              <li *ngFor="let p of e.personas" class="text-base">{{ p }}</li>
              <li *ngIf="e.personas.length === 0" class="text-base italic opacity-80">Sin asignar</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CalendarioExhibidoresPage implements OnInit {
  private svc = inject(ExhibidoresService);
  private ctx = inject(CongregacionContextService);
  private auth = inject(AuthStore);
  private toast = inject(ToastService);

  readonly diasCorto = DIAS_SEMANA_CORTO;
  readonly diasLargos = DIAS_SEMANA;
  readonly maxPildoras = MAX_PILDORAS_CELDA;

  cargando = signal(true);
  mesData = signal<ProgramacionMes | null>(null);
  misTurnos = signal<MiTurno[]>([]);
  soloMios = signal(false);
  vista = signal<'mes' | 'lista'>('mes');
  lugarFiltro = signal<number | null>(null);
  diaAbierto = signal<CeldaCalendario | null>(null);

  ano = signal(new Date().getFullYear());
  mes = signal(new Date().getMonth() + 1);
  nombreMes = computed(() => MESES_ES[this.mes() - 1]);

  esMesActual = computed(() => {
    const hoy = new Date();
    return this.ano() === hoy.getFullYear() && this.mes() === hoy.getMonth() + 1;
  });

  private get idPublicador(): number | null {
    return this.auth.user()?.id_usuario_publicador ?? null;
  }

  tengoTurnos = computed(() => {
    const id = this.idPublicador;
    if (!id) return false;
    return (this.mesData()?.asignaciones ?? []).some(a => a.publicador?.id_publicador === id);
  });

  /**
   * Índice de color (1..8) por ubicación. Se asigna sobre la lista de
   * ubicaciones ordenada por nombre para que un lugar conserve su color
   * al cambiar de mes; si se ordenara por id de turno, el color bailaría.
   */
  private colorPorUbicacion = computed<Map<number, number>>(() => {
    const m = this.mesData();
    const mapa = new Map<number, number>();
    if (!m) return mapa;
    const nombres = new Map<number, string>();
    for (const t of m.turnos) nombres.set(t.id_ubicacion_exhibidor, t.ubicacion_nombre);
    const ordenadas = [...nombres.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    ordenadas.forEach(([id], i) => mapa.set(id, (i % 8) + 1));
    return mapa;
  });

  /** Leyenda: un lugar por color, con el número de salidas del mes. */
  lugares = computed<LugarLeyenda[]>(() => {
    const m = this.mesData();
    if (!m) return [];
    const colores = this.colorPorUbicacion();
    const nombres = new Map<number, string>();
    for (const t of m.turnos) nombres.set(t.id_ubicacion_exhibidor, t.ubicacion_nombre);

    // Contar salidas = pares fecha+turno con al menos una asignación
    const turnoAUbicacion = new Map<number, number>();
    for (const t of m.turnos) turnoAUbicacion.set(t.id_turno_exhibidor, t.id_ubicacion_exhibidor);
    const vistos = new Set<string>();
    const conteo = new Map<number, number>();
    for (const a of m.asignaciones) {
      const idUb = turnoAUbicacion.get(a.id_turno_exhibidor);
      if (idUb == null) continue;
      const clave = a.fecha + '#' + a.id_turno_exhibidor;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      conteo.set(idUb, (conteo.get(idUb) ?? 0) + 1);
    }

    return [...nombres.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, nombre]) => ({
        id,
        nombre,
        color: colores.get(id) ?? 1,
        salidas: conteo.get(id) ?? 0,
      }));
  });

  celdas = computed<CeldaCalendario[]>(() => {
    const m = this.mesData();
    if (!m) return [];
    const idMio = this.idPublicador;
    const colores = this.colorPorUbicacion();

    const turnosPorId = new Map<number, TurnoGrilla>();
    for (const t of m.turnos) turnosPorId.set(t.id_turno_exhibidor, t);

    const bloqueos = new Map<string, string>();
    for (const b of m.fechas_bloqueadas) {
      if (b.id_ubicacion_exhibidor == null) bloqueos.set(b.fecha, b.motivo || 'Bloqueado');
    }

    // fecha → turno → asignaciones
    const porFechaTurno = new Map<string, Map<number, ExhibidorAsignacion[]>>();
    for (const a of m.asignaciones) {
      if (!porFechaTurno.has(a.fecha)) porFechaTurno.set(a.fecha, new Map());
      const mapa = porFechaTurno.get(a.fecha)!;
      if (!mapa.has(a.id_turno_exhibidor)) mapa.set(a.id_turno_exhibidor, []);
      mapa.get(a.id_turno_exhibidor)!.push(a);
    }

    // 42 celdas, lunes primero (patrón actas-list)
    const year = m.ano;
    const month = m.mes - 1;
    const firstDow = new Date(year, month, 1).getDay();
    const startDow = firstDow === 0 ? 6 : firstDow - 1;
    const hoy = new Date();
    const celdas: CeldaCalendario[] = [];

    for (let i = 0; i < 42; i++) {
      const d = new Date(year, month, 1 - startDow + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const otroMes = d.getMonth() !== month;
      const eventos: EventoDia[] = [];
      let tieneMio = false;

      if (!otroMes) {
        const mapa = porFechaTurno.get(iso);
        if (mapa) {
          const lista = [...mapa.entries()]
            .map(([idTurno, asigs]) => ({ turno: turnosPorId.get(idTurno), asigs }))
            .filter(x => x.turno)
            .sort((a, b) =>
              a.turno!.hora_inicio.localeCompare(b.turno!.hora_inicio)
              || a.turno!.ubicacion_nombre.localeCompare(b.turno!.ubicacion_nombre));
          for (const { turno, asigs } of lista) {
            const esMio = idMio != null && asigs.some(a => a.publicador?.id_publicador === idMio);
            if (esMio) tieneMio = true;
            eventos.push({
              idUbicacion: turno!.id_ubicacion_exhibidor,
              ubicacion: turno!.ubicacion_nombre,
              color: colores.get(turno!.id_ubicacion_exhibidor) ?? 1,
              hora: turno!.hora_inicio,
              horaFin: turno!.hora_fin,
              personas: asigs
                .sort((a, b) => a.posicion - b.posicion)
                .map(a => a.publicador?.nombre_completo ?? '—'),
              esMio,
            });
          }
        }
      }

      const dow = d.getDay();
      celdas.push({
        fecha: iso,
        dia: d.getDate(),
        diaNombre: DIAS_SEMANA_CORTO[dow === 0 ? 6 : dow - 1],
        otroMes,
        esHoy: d.getFullYear() === hoy.getFullYear() && d.getMonth() === hoy.getMonth() && d.getDate() === hoy.getDate(),
        esFinde: dow === 0 || dow === 6,
        bloqueado: otroMes ? null : (bloqueos.get(iso) ?? null),
        eventos,
        tieneMio,
      });
    }
    return celdas;
  });

  /**
   * Semanas del mes. Se descarta la última fila si es toda de otro mes:
   * una sexta fila vacía obliga a barrer con la vista una franja muerta.
   */
  semanas = computed<CeldaCalendario[][]>(() => {
    const todas = this.celdas();
    const filas: CeldaCalendario[][] = [];
    for (let i = 0; i < todas.length; i += 7) filas.push(todas.slice(i, i + 7));
    while (filas.length > 4 && filas[filas.length - 1].every(c => c.otroMes)) filas.pop();
    return filas;
  });

  /** Vista de lista: solo los días del mes que tienen algo que contar. */
  diasConSalida = computed<CeldaCalendario[]>(() =>
    this.celdas()
      .filter(c => !c.otroMes)
      .map(c => ({ ...c, eventos: c.eventos.filter(e => !this.estaApagado(e)) }))
      .filter(c => c.eventos.length > 0 || !!c.bloqueado));

  private get idCong(): number | null {
    return this.ctx.effectiveCongregacionId();
  }

  ngOnInit(): void {
    this.cargar();
    this.svc.getMisTurnos(this.idCong).subscribe({
      next: data => this.misTurnos.set(data.slice(0, 6)),
      error: () => {},
    });
  }

  /** Un turno se atenúa si no pasa el filtro de lugar o el de turnos propios. */
  estaApagado(e: EventoDia): boolean {
    const filtro = this.lugarFiltro();
    if (filtro !== null && e.idUbicacion !== filtro) return true;
    return this.soloMios() && !e.esMio;
  }

  alternarLugar(id: number): void {
    this.lugarFiltro.set(this.lugarFiltro() === id ? null : id);
  }

  abrirDia(celda: CeldaCalendario): void {
    if (celda.otroMes || (celda.eventos.length === 0 && !celda.bloqueado)) return;
    this.diaAbierto.set(celda);
  }

  @HostListener('document:keydown.escape')
  cerrarDia(): void {
    this.diaAbierto.set(null);
  }

  etiquetaDia(celda: CeldaCalendario): string {
    if (celda.otroMes) return `${celda.dia}, fuera del mes`;
    const base = `${celda.diaNombre} ${celda.dia} de ${this.nombreMes()}`;
    if (celda.eventos.length === 0) return `${base}, sin salidas`;
    return `${base}, ${celda.eventos.length} salida${celda.eventos.length === 1 ? '' : 's'}`;
  }

  irAHoy(): void {
    const hoy = new Date();
    this.ano.set(hoy.getFullYear());
    this.mes.set(hoy.getMonth() + 1);
    this.cargar();
  }

  cambiarMes(delta: number): void {
    let m = this.mes() + delta;
    let a = this.ano();
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    this.mes.set(m);
    this.ano.set(a);
    this.cargar();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.diaAbierto.set(null);
    this.svc.getMes(this.ano(), this.mes(), this.idCong).subscribe({
      next: data => { this.mesData.set(data); this.cargando.set(false); },
      error: () => {
        this.cargando.set(false);
        this.toast.error('Error', 'No se pudo cargar el calendario.');
      },
    });
  }

  descargarPdf(): void {
    this.svc.descargarPdf(this.ano(), this.mes(), this.idCong).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `exhibidores_${this.ano()}_${String(this.mes()).padStart(2, '0')}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.error('Error', 'No se pudo descargar el PDF.'),
    });
  }

  formatearFecha(fecha: string): string {
    const d = new Date(fecha + 'T00:00:00');
    return `${d.getDate()} ${MESES_ES[d.getMonth()].slice(0, 3)}`;
  }

  /** Nombre completo del día ("Jueves") para el detalle expandido; en la
   *  cuadrícula y la lista se usa la forma corta porque ahí el espacio
   *  es limitado, pero el modal tiene sitio de sobra para escribirlo entero. */
  diaNombreLargo(fecha: string): string {
    const dow = new Date(fecha + 'T00:00:00').getDay();
    return DIAS_SEMANA[dow === 0 ? 6 : dow - 1];
  }

  /** "Hoy" / "Mañana" / "En 3 días" / "En 2 semanas": para que el usuario
   *  vea cuánto falta de un vistazo, sin tener que restar fechas él mismo
   *  al comparar las tarjetas de "mis próximos turnos". */
  relativoTexto(fecha: string): string {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const d = new Date(fecha + 'T00:00:00');
    const dias = Math.round((d.getTime() - hoy.getTime()) / 86400000);
    if (dias <= 0) return 'Hoy';
    if (dias === 1) return 'Mañana';
    if (dias < 7) return `En ${dias} días`;
    const semanas = Math.round(dias / 7);
    return `En ${semanas} semana${semanas === 1 ? '' : 's'}`;
  }
}
