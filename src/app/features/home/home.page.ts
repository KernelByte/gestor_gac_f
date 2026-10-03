import { Component, Directive, ElementRef, Input, OnChanges, OnDestroy, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthStore } from '../../core/auth/auth.store';
import { CongregacionContextService } from '../../core/congregacion-context/congregacion-context.service';
import { RouterModule } from '@angular/router';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { VisitaService } from '../secretario-tools/services/visita.service';
import { Visita } from '../secretario-tools/models/visita.model';
import {
  trigger,
  transition,
  style,
  animate,
  query,
  stagger
} from '@angular/animations';

const REDUCED_MOTION =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Cuenta desde el último valor mostrado hasta el nuevo. Escribe directo en el
 * DOM (sin signals) para no disparar detección de cambios en cada frame.
 */
@Directive({ selector: '[countUp]', standalone: true })
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input('countUp') value = 0;
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private shown = 0;
  private raf = 0;

  ngOnChanges() {
    cancelAnimationFrame(this.raf);
    const from = this.shown;
    const to = this.value ?? 0;
    if (REDUCED_MOTION || from === to) { this.paint(to); return; }
    const inicio = performance.now();
    const duracion = 700;
    const paso = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracion);
      const e = 1 - Math.pow(1 - p, 4); // ease-out-quart
      this.paint(Math.round(from + (to - from) * e));
      if (p < 1) this.raf = requestAnimationFrame(paso);
    };
    this.raf = requestAnimationFrame(paso);
  }

  ngOnDestroy() { cancelAnimationFrame(this.raf); }

  private paint(v: number) {
    this.shown = v;
    this.el.nativeElement.textContent = v.toLocaleString('es-CO');
  }
}

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, NgxEchartsDirective, CountUpDirective],
  animations: [
    trigger('staggerIn', [
      transition(':enter', [
        query(':scope > *', [
          style({ opacity: 0, transform: 'translateY(10px)' }),
          stagger(60, [
            animate('420ms cubic-bezier(0.22,1,0.36,1)', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ],
  template: `
  <!-- Sin padding horizontal propio: el margen exterior lo pone el shell una
       sola vez (px-4 md:px-8). Sin overflow propio: el host ya es el contenedor
       de scroll (ver .router-container en shell.page.ts); otro aquí creaba un
       segundo scroll anidado en móvil.
       @container: las columnas responden al ancho REAL del contenido (que
       cambia con el sidebar abierto/colapsado), no al del viewport.
       .dash crece hasta el alto disponible y los gráficos absorben el sobrante:
       en pantallas altas no queda hueco abajo y en bajas se compacta (ver CSS). -->
  <div @staggerIn [@.disabled]="prefersReducedMotion" class="dash @container mx-auto flex w-full max-w-[1600px] flex-col">

    <!-- 1. Encabezado: saludo + lo único que pide acción hoy -->
    <header class="hero-card dash-hero">
      <div class="relative z-[1] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-4 @3xl:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div class="col-start-1 row-start-1 min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-violet-100">{{ currentDateShort() }}</p>
          <h1 class="dash-title mt-2 font-display font-bold leading-[1.1] tracking-tight text-white text-balance">
            {{ saludo() }}, {{ firstName() }}
          </h1>
          <p class="mt-2 max-w-[60ch] text-sm leading-relaxed text-violet-50 sm:text-[0.9375rem]">{{ resumenHero() }}</p>
        </div>
        @if (heroCta(); as cta) {
          <a [routerLink]="cta.link" class="hero-cta col-start-1 row-start-2 inline-flex items-center gap-2 justify-self-start rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-violet-700 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700 @3xl:col-start-2 @3xl:row-start-1">
            {{ cta.texto }}
            <svg class="hero-cta-arrow h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14m-6-6 6 6-6 6" /></svg>
          </a>
        }
        <!-- Rayo del encabezado original, plano y levemente rotado. Decorativo. -->
        <div aria-hidden="true" class="col-start-2 row-span-2 row-start-1 hidden h-16 w-16 shrink-0 rotate-6 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-inset ring-white/25 sm:flex @3xl:col-start-3 @3xl:row-span-1">
          <svg class="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
      </div>
    </header>

    <!-- Bloque «el mes y qué hacer»: métricas, visita y accesos van juntos (gap corto);
         el aire grande queda entre bloques (encabezado · este bloque · tendencias). -->
    <div class="dash-group">

    <!-- 2. Métricas — un solo panel con divisores, no cuatro tarjetas sueltas.
         2 columnas en angosto · 4 desde @3xl (48rem) del contenedor. -->
    @if (canViewPublicadores() || mostrarInformes()) {
      <section aria-label="Indicadores del mes" class="stat-panel grid" [ngClass]="mostrarInformes() ? 'grid-cols-2 @3xl:grid-cols-[1fr_1.5fr_1fr_1fr]' : 'grid-cols-1'">

        @if (canViewPublicadores()) {
          <div class="stat-cell">
            <p class="stat-label">Publicadores</p>
            @if (publicadoresListo() && (!esGrupo() || statsListo())) {
              <p class="stat-value" [countUp]="esGrupo() ? informesTotal() : totalPublicadores()">0</p>
              <p class="stat-meta">{{ esGrupo() ? 'Activos en tu grupo' : 'Activos en la congregación' }}</p>
            } @else {
              <div class="skeleton h-9 w-16 rounded-md"></div>
              <div class="skeleton mt-2 h-3 w-24 rounded"></div>
            }
          </div>
        }

        @if (mostrarInformes()) {
          <div class="stat-cell">
            <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p class="stat-label">Informes</p>
              @if (statsListo() && informesPendientes() > 0) {
                <span class="inline-flex items-center rounded-full bg-red-50 px-1.5 py-px text-[11px] font-semibold tabular-nums text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/25"
                  [attr.title]="informesPendientes() + ' publicadores aún no han enviado su informe'">
                  {{ informesPendientes() }} pend.
                </span>
              }
            </div>
            @if (statsListo()) {
              <p class="stat-value"><span [countUp]="porcentajeInformes()">0</span><span class="ml-0.5 text-base font-semibold text-gray-400 dark:text-slate-500">%</span></p>
              <div class="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-slate-700/60"
                role="progressbar" aria-label="Informes recibidos" [attr.aria-valuenow]="porcentajeInformes()" aria-valuemin="0" aria-valuemax="100">
                <div class="bar-grow h-full w-full origin-left rounded-full bg-exh-600 dark:bg-exh-400"
                  [style.transform]="'scaleX(' + (porcentajeInformes() / 100) + ')'"></div>
              </div>
              <p class="stat-meta">{{ informesRecibidos() | number }} de {{ informesTotal() | number }}{{ esGrupo() ? ' en tu grupo' : '' }}{{ periodoNombre() ? ' · ' + periodoNombre() : '' }}</p>
            } @else {
              <div class="skeleton h-9 w-14 rounded-md"></div>
              <div class="skeleton mt-3 h-1.5 w-full rounded-full"></div>
            }
          </div>

          <div class="stat-cell">
            <p class="stat-label">Cursos bíblicos</p>
            @if (statsListo()) {
              <p class="stat-value" [countUp]="totalCursos()">0</p>
              <p class="stat-meta">{{ esGrupo() ? 'Tu grupo' : '' }}{{ esGrupo() && periodoNombre() ? ' · ' : '' }}{{ periodoNombre() || (esGrupo() ? '' : 'Último mes con informes') }}</p>
            } @else {
              <div class="skeleton h-9 w-12 rounded-md"></div>
              <div class="skeleton mt-2 h-3 w-24 rounded"></div>
            }
          </div>

          <div class="stat-cell">
            <p class="stat-label">Precursores</p>
            @if (statsListo()) {
              <p class="stat-value"><span [countUp]="horasPrecursoresRegulares() + horasPrecursoresAuxiliares()">0</span><span class="ml-1 text-base font-semibold text-gray-400 dark:text-slate-500">h</span></p>
              <p class="stat-meta tabular-nums">{{ esGrupo() ? 'Tu grupo · ' : '' }}Horas · Reg. {{ horasPrecursoresRegulares() | number }} · Aux. {{ horasPrecursoresAuxiliares() | number }}</p>
            } @else {
              <div class="skeleton h-9 w-20 rounded-md"></div>
              <div class="skeleton mt-2 h-3 w-28 rounded"></div>
            }
          </div>
        }
      </section>
    }

    <!-- 2.5 Próxima visita del superintendente — toda la franja es el enlace
         (antes la flecha se ocultaba en móvil y no había forma de entrar). -->
    @if (proximaVisita(); as v) {
      <a [routerLink]="v.link" class="surface group flex items-center gap-4 p-4 sm:p-5 transition-[border-color,background-color,transform] duration-200 hover:border-violet-300 dark:hover:border-violet-500/40 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
        <div class="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25">
          <span class="font-display text-lg font-bold leading-none tabular-nums">{{ v.diasRestantes }}</span>
          <span class="mt-0.5 text-[10px] font-semibold uppercase tracking-wide">{{ v.diasRestantes === 1 ? 'día' : 'días' }}</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="stat-label">Próxima visita del superintendente</p>
          <p class="mt-1 text-sm font-semibold text-gray-900 dark:text-slate-100 sm:text-base">
            {{ v.fechaTexto }}@if (v.nombreSC) {<span class="font-medium text-gray-500 dark:text-slate-400"> · {{ v.nombreSC }}</span>}
          </p>
        </div>
        <svg class="h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-violet-600 dark:text-slate-500 dark:group-hover:text-violet-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m9 6 6 6-6 6" /></svg>
      </a>
    }

    <!-- 3. Accesos rápidos — enlaces (navegan), no botones. Una columna en
         angosto; en ancho, tantas columnas como accesos tenga el rol. -->
    @if (canManagePublicadores() || canViewReuniones() || mostrarInformes()) {
      <nav aria-label="Accesos rápidos" class="quick-strip grid grid-cols-1 @3xl:grid-flow-col @3xl:auto-cols-fr">
        @if (canManagePublicadores()) {
          <a routerLink="/secretario/publicadores" class="quick-link quick-orange group">
            <span class="quick-icon ring-1 ring-inset bg-orange-50 text-orange-600 ring-orange-200/70 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/25">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M18 18.72a9.1 9.1 0 0 0 3.74-.48 3 3 0 0 0-4.68-2.72M18 18.72v.03c0 .22-.01.45-.04.67A11.95 11.95 0 0 1 12 21c-2.17 0-4.2-.58-5.96-1.58A6.1 6.1 0 0 1 6 18.72m12 0a5.97 5.97 0 0 0-.94-3.2M6 18.72a9.1 9.1 0 0 1-3.74-.48 3 3 0 0 1 4.68-2.72M6 18.72a5.97 5.97 0 0 1 .94-3.2m0 0A6 6 0 0 1 12 12.75a6 6 0 0 1 5.06 2.77M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-gray-900 dark:text-slate-100">Publicadores</span>
              <span class="block text-xs text-gray-500 dark:text-slate-400">Añadir o editar fichas</span>
            </span>
            <svg class="quick-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m9 6 6 6-6 6" /></svg>
          </a>
        }
        @if (canViewReuniones()) {
          <a routerLink="/reuniones/resumen" class="quick-link quick-violet group">
            <span class="quick-icon ring-1 ring-inset bg-violet-50 text-violet-600 ring-violet-200/70 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/25">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-gray-900 dark:text-slate-100">Reuniones</span>
              <span class="block text-xs text-gray-500 dark:text-slate-400">Resumen de asistencia</span>
            </span>
            <svg class="quick-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m9 6 6 6-6 6" /></svg>
          </a>
        }
        @if (mostrarInformes()) {
          <a routerLink="/secretario/informes" class="quick-link quick-blue group">
            <span class="quick-icon ring-1 ring-inset bg-exh-50 text-exh-600 ring-exh-200/70 dark:bg-exh-500/10 dark:text-exh-300 dark:ring-exh-400/25">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-gray-900 dark:text-slate-100">Informes</span>
              <span class="block text-xs text-gray-500 dark:text-slate-400">{{ periodoNombre() ? 'Resumen de ' + periodoNombre() : 'Resumen del mes' }}</span>
            </span>
            <svg class="quick-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m9 6 6 6-6 6" /></svg>
          </a>
        }
      </nav>
    }

    </div>

    <!-- 4. Tendencias — apiladas hasta que el CONTENEDOR mide 56rem; ambas
         tarjetas estiran el gráfico para quedar a la misma altura. -->
    @if (puedeVerAsistencia() || mostrarInformes()) {
      <div class="dash-charts grid grid-cols-1 @4xl:grid-cols-2">

        <!-- Asistencia — tendencia -->
        @if (!asistenciaListo()) {
          <div class="surface chart-card flex flex-col" role="status" aria-label="Cargando gráfico">
            <div class="skeleton h-4 w-44 rounded"></div>
            <div class="skeleton mt-2.5 h-3 w-56 max-w-full rounded"></div>
            <div class="skeleton chart-canvas mt-4 w-full flex-1 !rounded-lg"></div>
          </div>
        } @else if (asistenciaChartOption() !== null) {
          <section class="surface chart-card chart-enter flex flex-col">
            <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
              <div>
                <h2 class="section-heading">Asistencia a reuniones</h2>
                <p class="stat-meta !mt-1">Promedio mensual · último: {{ asistenciaMesNombre() }}</p>
              </div>
              <!-- Leyenda y valor actual en un solo lugar -->
              <dl class="flex shrink-0 items-start gap-4">
                @if (asistenciaMidweekActual() !== null) {
                  <div>
                    <dt class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                      <span class="h-2 w-2 rounded-full bg-violet-600 dark:bg-violet-400"></span><abbr title="Entre semana" class="no-underline">Entre sem.</abbr>
                    </dt>
                    <dd class="mt-1 flex items-baseline gap-1.5">
                      <span class="font-display text-xl font-bold tabular-nums text-gray-900 dark:text-slate-50">{{ asistenciaMidweekActual() | number:'1.0-0' }}</span>
                      @if (asistenciaMidweekAnterior() !== null) {
                        <ng-container *ngTemplateOutlet="deltaTpl; context: { $implicit: delta(asistenciaMidweekActual()!, asistenciaMidweekAnterior()!) }"></ng-container>
                      }
                    </dd>
                  </div>
                }
                @if (asistenciaWeekendActual() !== null) {
                  <div>
                    <dt class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                      <span class="h-2 w-2 rounded-full bg-orange-500 dark:bg-orange-400"></span><abbr title="Fin de semana" class="no-underline">Fin de sem.</abbr>
                    </dt>
                    <dd class="mt-1 flex items-baseline gap-1.5">
                      <span class="font-display text-xl font-bold tabular-nums text-gray-900 dark:text-slate-50">{{ asistenciaWeekendActual() | number:'1.0-0' }}</span>
                      @if (asistenciaWeekendAnterior() !== null) {
                        <ng-container *ngTemplateOutlet="deltaTpl; context: { $implicit: delta(asistenciaWeekendActual()!, asistenciaWeekendAnterior()!) }"></ng-container>
                      }
                    </dd>
                  </div>
                }
              </dl>
            </div>
            <div echarts [options]="asistenciaChartOption()!" [autoResize]="true" class="chart-canvas mt-3 w-full flex-1"
              role="img" [attr.aria-label]="'Asistencia promedio de los últimos meses, hasta ' + asistenciaMesNombre()"></div>
          </section>
        }

        <!-- Informes — barras -->
        @if (!informesChartListo()) {
          <div class="surface chart-card flex flex-col" role="status" aria-label="Cargando gráfico">
            <div class="skeleton h-4 w-44 rounded"></div>
            <div class="skeleton mt-2.5 h-3 w-56 max-w-full rounded"></div>
            <div class="skeleton chart-canvas mt-4 w-full flex-1 !rounded-lg"></div>
          </div>
        } @else if (informesChartOption() !== null) {
          <section class="surface chart-card chart-enter flex flex-col">
            <div>
              <h2 class="section-heading">Informes recibidos</h2>
              <p class="stat-meta !mt-1">{{ esGrupo() ? 'Tu grupo · por mes' : 'Por mes · últimos seis meses' }}</p>
            </div>
            <div echarts [options]="informesChartOption()!" [autoResize]="true" class="chart-canvas mt-3 w-full flex-1"
              role="img" aria-label="Informes recibidos por mes en los últimos meses"></div>
          </section>
        }

      </div>
    }

    <!-- 5. Pie: estado, sin caja — información de fondo, no un bloque más -->
    <p class="flex items-center gap-2 px-1 text-xs text-gray-500 dark:text-slate-400">
      <span class="relative flex h-2 w-2 shrink-0">
        <span class="status-ping absolute inset-0 rounded-full bg-emerald-400"></span>
        <span class="relative h-2 w-2 rounded-full bg-emerald-500"></span>
      </span>
      Todos los servicios operando con normalidad.
    </p>

  </div>

  <ng-template #deltaTpl let-d>
    <span class="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums"
      [ngClass]="d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
      [attr.aria-label]="(d >= 0 ? 'Subió ' : 'Bajó ') + (d < 0 ? -d : d) + ' respecto al mes anterior'">
      <svg class="h-3 w-3" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        @if (d >= 0) { <path d="M6 2.5 10 8H2z" /> } @else { <path d="M6 9.5 2 4h8z" /> }
      </svg>{{ d < 0 ? -d : d }}
    </span>
  </ng-template>
 `,
  styles: [`
  :host { display: block; }

  /* ── Página ────────────────────────────────────────────────────────────
     flex: 1 0 auto → crece hasta el alto del contenedor de scroll del shell,
     nunca se encoge por debajo de su contenido. Los gráficos (flex: 1) se
     quedan con el sobrante, así una pantalla alta no deja un hueco abajo. */
  .dash { flex: 1 0 auto; gap: 1rem; padding-bottom: 1.5rem; }
  /* Ritmo: corto dentro del bloque (12px), generoso entre bloques (16/20px). */
  .dash-group { display: flex; flex-direction: column; gap: 0.75rem; }
  .dash-group:not(:has(*)) { display: none; }
  /* Tope de alto: en 1440p+ un gráfico de 800px estira las barras sin aportar
     nada; mejor un poco de aire al final. */
  .dash-charts { flex: 1 1 auto; gap: 1rem; }
  /* Solo lado a lado: apilados, cada gráfico conserva su mínimo propio. */
  @container (min-width: 56rem) { .dash-charts { max-height: 30rem; } }
  /* Si el rol solo ve uno de los dos gráficos, que ocupe todo el ancho. */
  .dash-charts > :only-child { grid-column: 1 / -1; }
  @media (min-width: 640px) { .dash, .dash-charts { gap: 1.25rem; } }
  @media (min-width: 640px) { .dash-group { gap: 0.875rem; } }
  @media (min-width: 1024px) { .dash { padding-bottom: 0.25rem; } }

  /* Encabezado: violeta 700→600 en vez del degradado global que acaba en
     lila claro; blanco sobre #7c3aed = 5.7:1, así el texto pasa AA en todo
     el ancho (sobre #c084fc caía a ~2.6:1). */
  .dash-hero {
    padding: 1.5rem 1.25rem;
    background: linear-gradient(120deg, #5b21b6 0%, #6d28d9 55%, #7c3aed 100%);
    box-shadow: 0 10px 30px -14px rgb(76 29 149 / 0.55);
  }
  @media (min-width: 640px) { .dash-hero { padding: 1.75rem 2rem; } }
  .dash-title { font-size: 1.75rem; }
  @media (min-width: 640px) { .dash-title { font-size: 2.25rem; } }

  .hero-cta {
    transition: transform 160ms cubic-bezier(0.23,1,0.32,1), background-color 150ms ease;
  }
  .hero-cta:active { transform: scale(0.97); }
  .hero-cta-arrow { transition: transform 200ms cubic-bezier(0.23,1,0.32,1); }

  /* ── Superficies: borde 1px, radio 12px como .card-elevated del sistema ── */
  .surface, .stat-panel, .quick-strip {
    border-radius: 0.75rem;
    border: 1px solid var(--color-gray-200, #e5e7eb);
  }
  .surface { background: white; box-shadow: 0 1px 2px rgb(15 23 42 / 0.04); }
  :host-context(.dark) .surface,
  :host-context(.dark) .stat-panel,
  :host-context(.dark) .quick-strip { border-color: rgb(51 65 85 / 0.6); }
  :host-context(.dark) .surface { background: rgb(15 23 42 / 0.6); box-shadow: none; }

  .chart-card { padding: 1.25rem; min-height: 15rem; }
  /* Arranca en .35, no en 0: el esqueleto desaparece al instante y de 0 habría
     un parpadeo en blanco entre ambos. La segunda tarjeta entra 70ms después. */
  .chart-enter { animation: chartEnter 420ms cubic-bezier(0.23,1,0.32,1) both; }
  .dash-charts > .chart-enter:nth-child(2) { animation-delay: 70ms; }
  @keyframes chartEnter {
    from { opacity: 0.35; transform: translateY(10px); }
    to   { opacity: 1;    transform: translateY(0); }
  }
  .chart-canvas { min-height: 9rem; }
  @media (min-width: 640px) { .chart-card { padding: 1.25rem 1.5rem; } }

  /* Panel de métricas: la rejilla con gap de 1px sobre el color del borde
     dibuja los divisores sin importar cuántas columnas haya. */
  .stat-panel {
    gap: 1px;
    overflow: hidden;
    background: var(--color-gray-200, #e5e7eb);
    box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
  }
  :host-context(.dark) .stat-panel { background: rgb(51 65 85 / 0.6); }
  .stat-cell {
    display: flex;
    flex-direction: column;
    min-width: 0;
    padding: 1rem;
    background: white;
  }
  :host-context(.dark) .stat-cell { background: var(--color-slate-900, #0f172a); }
  @container (min-width: 40rem) { .stat-cell { padding: 1.25rem 1.5rem; } }

  .stat-label {
    font-size: 0.6875rem;
    line-height: 1rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--color-gray-500, #6b7280);
  }
  :host-context(.dark) .stat-label { color: var(--color-slate-400, #94a3b8); }

  .stat-value {
    margin-top: 0.5rem;
    font-family: var(--font-display, 'Urbanist', sans-serif);
    font-weight: 700;
    font-size: 1.875rem;
    line-height: 1;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
    color: var(--color-gray-900, #111827);
  }
  :host-context(.dark) .stat-value { color: var(--color-slate-50, #f8fafc); }
  @container (min-width: 56rem) { .stat-value { font-size: 2.25rem; } }

  .stat-meta {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    line-height: 1.1rem;
    color: var(--color-gray-500, #6b7280);
  }
  :host-context(.dark) .stat-meta { color: var(--color-slate-400, #94a3b8); }

  .section-heading {
    font-family: var(--font-display, 'Urbanist', sans-serif);
    font-weight: 700;
    font-size: 1rem;
    letter-spacing: -0.01em;
    color: var(--color-gray-900, #111827);
  }
  :host-context(.dark) .section-heading { color: var(--color-slate-100, #f1f5f9); }

  /* ── Accesos rápidos ── */
  .quick-link {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    min-height: 4.5rem;
    padding: 0.875rem 1rem;
    background: white;
    transition: border-color 150ms ease, background-color 150ms ease, transform 160ms cubic-bezier(0.23,1,0.32,1);
    -webkit-tap-highlight-color: transparent;
  }
  .quick-strip {
    gap: 1px;
    overflow: hidden;
    background: var(--color-gray-200, #e5e7eb);
  }
  :host-context(.dark) .quick-strip { background: rgb(51 65 85 / 0.6); }
  .quick-strip .quick-link { border: 0; border-radius: 0; }
  .quick-strip .quick-link:focus-visible { outline-offset: -2px; }
  /* En la franja no se escala (dejaría ver el divisor): el toque tiñe la celda. */
  .quick-strip .quick-link:active { transform: none; background: color-mix(in srgb, var(--q) 14%, white); }
  :host-context(.dark) .quick-strip .quick-link:active { background: color-mix(in srgb, var(--q) 22%, #0f172a); }
  .quick-link:active { transform: scale(0.98); }
  :host-context(.dark) .quick-link { background: rgb(15 23 42 / 0.6); }
  .quick-icon {
    display: flex; align-items: center; justify-content: center;
    width: 2.5rem; height: 2.5rem; flex-shrink: 0;
    border-radius: 0.625rem;
    transition: background-color 150ms ease;
  }
  .quick-arrow {
    width: 1.125rem; height: 1.125rem; flex-shrink: 0;
    color: var(--color-gray-400, #9ca3af);
    transition: transform 200ms cubic-bezier(0.23,1,0.32,1), color 150ms ease;
  }
  :host-context(.dark) .quick-arrow { color: var(--color-slate-500, #64748b); }

  /* Hover solo con puntero fino: en táctil el :hover se queda "pegado" tras el toque. */
  @media (hover: hover) and (pointer: fine) {
    .hero-cta:hover .hero-cta-arrow { transform: translateX(3px); }
  }

  /* Cada acceso toma el color de su módulo al apuntarlo (o enfocarlo con teclado):
     tinte de fondo, borde definido, icono más lleno y flecha del mismo tono.
     --q es el color del módulo; el resto sale de mezclarlo con la superficie. */
  .quick-orange { --q: #f97316; --q-fuerte: #c2410c; }
  .quick-violet { --q: #7c3aed; --q-fuerte: #6d28d9; }
  .quick-blue   { --q: #3b73fc; --q-fuerte: #165cfc; }
  :host-context(.dark) .quick-orange { --q-fuerte: #fdba74; }
  :host-context(.dark) .quick-violet { --q-fuerte: #c4b5fd; }
  :host-context(.dark) .quick-blue   { --q-fuerte: #94b7fd; }

  .quick-link:focus-visible {
    outline: 2px solid var(--q);
    outline-offset: 2px;
  }
  .quick-link:focus-visible {
    background: color-mix(in srgb, var(--q) 9%, white);
    border-color: color-mix(in srgb, var(--q) 50%, white);
  }
  :host-context(.dark) .quick-link:focus-visible {
    background: color-mix(in srgb, var(--q) 16%, #0f172a);
    border-color: color-mix(in srgb, var(--q) 50%, #0f172a);
  }
  .quick-link:focus-visible .quick-icon { background: color-mix(in srgb, var(--q) 22%, white); }
  :host-context(.dark) .quick-link:focus-visible .quick-icon { background: color-mix(in srgb, var(--q) 30%, #0f172a); }
  .quick-link:focus-visible .quick-arrow { color: var(--q-fuerte); transform: translateX(3px); }

  @media (hover: hover) and (pointer: fine) {
    .quick-link:hover {
      background: color-mix(in srgb, var(--q) 9%, white);
      border-color: color-mix(in srgb, var(--q) 50%, white);
    }
    :host-context(.dark) .quick-link:hover {
      background: color-mix(in srgb, var(--q) 16%, #0f172a);
      border-color: color-mix(in srgb, var(--q) 50%, #0f172a);
    }
    .quick-link:hover .quick-icon { background: color-mix(in srgb, var(--q) 22%, white); }
    :host-context(.dark) .quick-link:hover .quick-icon { background: color-mix(in srgb, var(--q) 30%, #0f172a); }
    .quick-link:hover .quick-arrow { color: var(--q-fuerte); transform: translateX(3px); }
  }

  /* ── Pantallas de escritorio bajas (laptops 720–860px de alto) ──────────
     Mismo contenido, menos aire: así 1280×720 y 1366×768 entran sin scroll. */
  @media (min-width: 1024px) and (max-height: 860px) {
    .dash, .dash-charts { gap: 0.875rem; }
    .dash-group { gap: 0.625rem; }
    .dash-hero { padding: 1.25rem 1.75rem; }
    .dash-title { font-size: 1.875rem; }
    .stat-cell { padding: 0.875rem 1.25rem; }
    .stat-value { margin-top: 0.375rem; font-size: 1.75rem; }
    .stat-meta { margin-top: 0.375rem; }
    .quick-link { min-height: 3.5rem; padding: 0.5rem 1rem; }
    .quick-icon { width: 2.25rem; height: 2.25rem; }
    .chart-card { padding: 1rem 1.25rem; min-height: 13rem; }
    .chart-canvas { min-height: 7rem; }
  }

  /* ── Monitores grandes (27" 2K ≈ 2560px) ────────────────────────────────
     Solo suma por encima de lo existente: por debajo de 1920px no cambia nada.
     1920+: la columna deja de toparse en 1600px. 2200+: mismas proporciones
     con más cuerpo (tipografía, celdas y gráficos), no más contenido. */
  @media (min-width: 1920px) {
    .dash { max-width: 1900px; }
    .dash, .dash-charts { gap: 1.5rem; }
    .dash-group { gap: 1rem; }
  }
  @media (min-width: 2200px) {
    .dash { max-width: 2200px; }
    .dash-hero { padding: 2.25rem 2.5rem; }
    .dash-title { font-size: 2.75rem; }
    .stat-cell { padding: 1.5rem 1.75rem; }
    .stat-label { font-size: 0.75rem; }
    .stat-value { font-size: 3rem; }
    .stat-meta { font-size: 0.875rem; line-height: 1.25rem; }
    .section-heading { font-size: 1.125rem; }
    .quick-link { min-height: 5.5rem; padding: 1rem 1.5rem; }
    .quick-icon { width: 3rem; height: 3rem; }
    .chart-card { padding: 1.75rem 2rem; min-height: 20rem; }
    .chart-canvas { min-height: 14rem; }
  }
  /* El tope de alto de los gráficos crece con el monitor (solo lado a lado). */
  @container (min-width: 90rem) { .dash-charts { max-height: 40rem; } }

  /* Barra de informes: crece desde la izquierda al aparecer (transform, no width) */
  .bar-grow {
    transition: transform 600ms cubic-bezier(0.23,1,0.32,1);
    animation: barGrow 600ms cubic-bezier(0.23,1,0.32,1);
  }
  @keyframes barGrow { from { transform: scaleX(0); } }

  /* Pulso de estado: tenue y lento, no un "ping" que reclame atención */
  .status-ping { animation: statusPing 2.4s cubic-bezier(0,0,0.2,1) infinite; }
  @keyframes statusPing {
    0% { transform: scale(1); opacity: 0.55; }
    70%, 100% { transform: scale(2.2); opacity: 0; }
  }

  /* /animate: además de apagar la coreografía de Angular Animations
     ([@.disabled] en la plantilla), respeta reduced-motion para las
     transiciones CSS declaradas en este componente. */
  @media (prefers-reduced-motion: reduce) {
    :host * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
 `]
})
export class HomePage implements OnInit {
  private store = inject(AuthStore);
  private http = inject(HttpClient);
  private congregacionContext = inject(CongregacionContextService);
  private visitaService = inject(VisitaService);

  /* /animate exige respetar prefers-reduced-motion: apaga la coreografía de
     entrada (Angular Animations) para quien lo pida en el sistema. */
  readonly prefersReducedMotion = REDUCED_MOTION;

  userName = signal('Usuario');
  currentDateShort = signal('');
  /** Descripción del periodo de informes que alimenta las métricas ("Septiembre 2026"). */
  periodoNombre = signal('');

  /**
   * Hasta dónde llegan los informes de este usuario. Espeja informe_router.py
   * (resumen-mensual): Administrador, Gestor y Secretario ven la congregación;
   * quien tiene informes.editar_todos también. Con informes.ver / informes.editar
   * a secas el backend fuerza su propio grupo. Sin ninguno, no hay informes.
   */
  alcanceInformes = signal<'congregacion' | 'grupo' | null>(null);
  /** El backend rechazó la consulta (p. ej. sin grupo asignado): se ocultan las piezas de informes. */
  private informesRechazados = signal(false);
  readonly mostrarInformes = computed(() => this.alcanceInformes() !== null && !this.informesRechazados());
  readonly esGrupo = computed(() => this.alcanceInformes() === 'grupo');
  /** Publicadores activos dentro del alcance del usuario (congregación o su grupo). */
  informesTotal = signal(0);

  readonly firstName = computed(() => this.userName().trim().split(/\s+/)[0] || 'Usuario');

  readonly saludo = computed(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  });

  /** Una sola frase con lo que pide atención hoy; si no hay nada, lo dice. */
  readonly resumenHero = computed(() => {
    if (this.mostrarInformes() && this.statsListo()) {
      const n = this.informesPendientes();
      const periodo = this.periodoNombre() ? ` de ${this.periodoNombre().toLowerCase()}` : '';
      const grupo = this.esGrupo() ? ' de tu grupo' : '';
      if (n > 0) return `Faltan ${n.toLocaleString('es-CO')} ${n === 1 ? 'informe' : 'informes'}${grupo}${periodo} por recibir.`;
      if (this.informesRecibidos() > 0) return `Todos los informes${grupo}${periodo} están recibidos.`;
    }
    const v = this.proximaVisita();
    if (v && v.diasRestantes <= 14) {
      return v.diasRestantes === 0 ? 'La visita del superintendente comienza hoy.'
        : `La visita del superintendente comienza en ${v.diasRestantes} ${v.diasRestantes === 1 ? 'día' : 'días'}.`;
    }
    return 'Este es el resumen de actividad de tu congregación.';
  });

  readonly heroCta = computed<{ texto: string; link: string } | null>(() =>
    this.mostrarInformes() && this.statsListo() && this.informesPendientes() > 0
      ? { texto: 'Revisar informes', link: '/secretario/informes' }
      : null
  );
  totalPublicadores = signal(0);
  informesPendientes = signal(0);
  informesRecibidos = signal(0);
  porcentajeInformes = signal(0);
  totalCursos = signal(0);
  horasPrecursoresRegulares = signal(0);
  horasPrecursoresAuxiliares = signal(0);

  asistenciaMidweekActual   = signal<number | null>(null);
  asistenciaWeekendActual   = signal<number | null>(null);
  asistenciaMidweekAnterior = signal<number | null>(null);
  asistenciaWeekendAnterior = signal<number | null>(null);
  asistenciaMesNombre       = signal<string>('');
  asistenciaChartOption     = signal<EChartsOption | null>(null);

  informesChartOption = signal<EChartsOption | null>(null);

  proximaVisita = signal<{ fechaTexto: string; diasRestantes: number; nombreSC: string | null; link: string | null } | null>(null);

  canViewPublicadores = signal(false);
  canManagePublicadores = signal(false);
  /** Asistencia: el backend la abre a roles privilegiados o a reuniones.ver / reuniones.asistencia. */
  puedeVerAsistencia = signal(false);
  canViewReuniones = signal(false);
  canManageVisitaSC = signal(false);

  /* /animate: "Loading states: show skeleton... don't just jump from 0 to
     the real value" — evita el salto brusco mientras responde la API. */
  publicadoresListo  = signal(false);
  statsListo         = signal(false);
  asistenciaListo    = signal(false);
  informesChartListo = signal(false);

  ngOnInit() {
   const user = this.store.user();
   if (user) {
     this.userName.set(user.nombre || user.username);

     const rolesPublicadores = ['Administrador', 'Gestor Aplicación', 'Coordinador', 'Secretario', 'Superintendente de servicio', 'Gestor', 'Publicador'];
     const rolesManagePublicadores = ['Administrador', 'Gestor Aplicación', 'Secretario', 'Coordinador'];
     const rolesGestionVisitaSC = ['Administrador', 'Secretario'];

     const currentRole = user.rol || '';
     const rolesTotal = ['Administrador', 'Gestor Aplicación', 'Secretario'];
     const esRolTotal = [currentRole, ...(user.roles ?? [])].some(r => rolesTotal.includes(r));
     if (esRolTotal || this.store.hasPermission('informes.editar_todos')) {
       this.alcanceInformes.set('congregacion');
     } else if (this.store.hasPermission('informes.ver') || this.store.hasPermission('informes.editar')) {
       this.alcanceInformes.set('grupo');
     }

     this.canViewPublicadores.set(rolesPublicadores.includes(currentRole));
     this.canManagePublicadores.set(rolesManagePublicadores.includes(currentRole));
     this.puedeVerAsistencia.set(
       ['Administrador', 'Gestor Aplicación', 'Secretario', 'Coordinador'].includes(currentRole) ||
       this.store.hasPermission('reuniones.ver') || this.store.hasPermission('reuniones.asistencia')
     );
     this.canViewReuniones.set(this.store.hasPermission('reuniones.ver'));
     this.canManageVisitaSC.set(rolesGestionVisitaSC.includes(currentRole));

     const congregacionId = this.congregacionContext.effectiveCongregacionId();

     if (this.canViewPublicadores()) {
        this.loadPublicadoresCount();
     } else {
        this.publicadoresListo.set(true);
     }
     if (this.alcanceInformes() !== null) {
        this.loadInformesStats(congregacionId);
        this.loadInformesChart(congregacionId);
     } else {
        this.statsListo.set(true);
        this.informesChartListo.set(true);
     }
     if (this.puedeVerAsistencia()) {
        this.loadAsistenciaStats(congregacionId);
     } else {
        this.asistenciaListo.set(true);
     }
     if (this.canManageVisitaSC()) {
        this.loadProximaVisita(congregacionId);
     } else {
        this.loadProximaVisitaColaborador();
     }
   }

   const fecha = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
   this.currentDateShort.set(fecha.charAt(0).toUpperCase() + fecha.slice(1));
  }

  private loadPublicadoresCount() {
   this.http.get<any[]>('/api/publicadores/?limit=1000').subscribe({
     next: (publicadores) => {
      this.totalPublicadores.set(publicadores.length);
      this.publicadoresListo.set(true);
     },
     error: (err) => {
      console.error('Error cargando publicadores:', err);
      this.publicadoresListo.set(true);
     }
   });
  }

  private loadInformesStats(congregacionId: number | null | undefined) {
    if (!congregacionId) { this.statsListo.set(true); return; }

    // El periodo activo de informes (normalmente el mes anterior, ver
    // periodo_informes_scheduler.py) es la fuente de verdad para estas
    // tarjetas — no el mes calendario en curso, que aún está incompleto.
    this.http.get<any>('/api/periodos/activo').subscribe({
      next: (periodoActivo) => {
        this.tryLoadInformesStatsFromPeriods([periodoActivo], 0, congregacionId);
      },
      error: err => {
        console.error('Error cargando periodo activo de informes, usando fallback', err);
        this.loadInformesStatsFallback(congregacionId);
      }
    });
  }

  private loadInformesStatsFallback(congregacionId: number) {
    const now = new Date();
    const mesActual = now.getMonth() + 1;
    const anoActual = now.getFullYear();

    this.http.get<any[]>('/api/periodos/').subscribe({
      next: (periodos) => {
        const pasados = periodos
          .filter(p => {
            const ano = parseInt(p.codigo_ano, 10);
            const mes = parseInt(p.codigo_mes, 10);
            return ano < anoActual || (ano === anoActual && mes <= mesActual);
          })
          .sort((a, b) => {
            const da = parseInt(a.codigo_ano, 10) * 100 + parseInt(a.codigo_mes, 10);
            const db = parseInt(b.codigo_ano, 10) * 100 + parseInt(b.codigo_mes, 10);
            return db - da;
          });

        if (pasados.length === 0) { this.statsListo.set(true); return; }
        this.tryLoadInformesStatsFromPeriods(pasados.slice(0, 3), 0, congregacionId);
      },
      error: err => {
        console.error('Error cargando periodos para stats', err);
        this.statsListo.set(true);
      }
    });
  }

  private tryLoadInformesStatsFromPeriods(periods: any[], index: number, congregacionId: number) {
    if (index >= periods.length) { this.statsListo.set(true); return; }
    const p = periods[index];

    this.http.get<any>(`/api/informes/resumen-mensual?periodo_id=${p.id_periodo}&congregacion_id=${congregacionId}`).subscribe({
      next: (stats) => {
        if (stats.informes_recibidos === 0 && index < periods.length - 1) {
          this.tryLoadInformesStatsFromPeriods(periods, index + 1, congregacionId);
          return;
        }
        this.periodoNombre.set(p.descripcion ?? '');
        this.informesRecibidos.set(stats.informes_recibidos);
        const pending = stats.total_publicadores - stats.informes_recibidos;
        this.informesPendientes.set(pending > 0 ? pending : 0);
        const pct = stats.total_publicadores > 0 ? Math.round((stats.informes_recibidos / stats.total_publicadores) * 100) : 0;
        this.porcentajeInformes.set(pct);
        this.totalCursos.set(stats.total_cursos);
        this.horasPrecursoresRegulares.set(stats.horas_precursores_regulares ?? 0);
        this.horasPrecursoresAuxiliares.set(stats.horas_precursores_auxiliares ?? 0);
        this.informesTotal.set(stats.total_publicadores);
        // El total de la tarjeta "Publicadores" es de la congregación: solo se
        // completa con este dato si el alcance también lo es, no si es un grupo.
        if (stats.total_publicadores > 0 && !this.esGrupo()) {
          this.totalPublicadores.set(stats.total_publicadores);
        }
        this.statsListo.set(true);
      },
      error: err => {
        console.error('Error loading resumen', err);
        this.informesRechazados.set(true);
        this.statsListo.set(true);
      }
    });
  }

  private loadAsistenciaStats(congregacionId: number | null | undefined) {
    if (!congregacionId) { this.asistenciaListo.set(true); return; }
    const now = new Date();
    const anoServicio = now.getMonth() + 1 >= 9 ? now.getFullYear() + 1 : now.getFullYear();

    this.http.get<any>(`/api/asistencias/resumen-anual?congregacion_id=${congregacionId}&ano_servicio=${anoServicio}`)
      .subscribe({
        next: (res) => {
          const conDatosActual = this.filtrarConDatosAsistencia(res.meses);
          if (conDatosActual.length >= 6) {
            this.aplicarAsistenciaStats(conDatosActual);
            return;
          }
          // Año de servicio recién iniciado: completar la ventana de 6 meses
          // con el año de servicio anterior en vez de dejar la gráfica vacía.
          this.http.get<any>(`/api/asistencias/resumen-anual?congregacion_id=${congregacionId}&ano_servicio=${anoServicio - 1}`)
            .subscribe({
              next: (resPrev) => {
                const conDatosPrev = this.filtrarConDatosAsistencia(resPrev.meses);
                const combinados = [...conDatosPrev, ...conDatosActual];
                if (combinados.length === 0) { this.asistenciaListo.set(true); return; }
                this.aplicarAsistenciaStats(combinados);
              },
              error: () => {
                if (conDatosActual.length > 0) this.aplicarAsistenciaStats(conDatosActual);
                else this.asistenciaListo.set(true);
              }
            });
        },
        error: err => {
          console.error('Error asistencia stats', err);
          this.asistenciaListo.set(true);
        }
      });
  }

  private filtrarConDatosAsistencia(meses: any[]) {
    return (meses as any[]).filter(m => m.midweek_promedio !== null || m.weekend_promedio !== null);
  }

  private aplicarAsistenciaStats(conDatos: any[]) {
    const actual   = conDatos[conDatos.length - 1];
    const anterior = conDatos.length > 1 ? conDatos[conDatos.length - 2] : null;

    this.asistenciaMidweekActual.set(actual.midweek_promedio);
    this.asistenciaWeekendActual.set(actual.weekend_promedio);
    this.asistenciaMidweekAnterior.set(anterior?.midweek_promedio ?? null);
    this.asistenciaWeekendAnterior.set(anterior?.weekend_promedio ?? null);
    this.asistenciaMesNombre.set(actual.nombre_mes);

    this.asistenciaChartOption.set(this.buildAsistenciaChart(conDatos.slice(-6)));
    this.asistenciaListo.set(true);
  }

  private buildAsistenciaChart(meses: any[]): EChartsOption {
    const labels = meses.map(m => (m.nombre_mes as string).substring(0, 3).toUpperCase());
    return {
      color: ['#8b5cf6', '#f97316'],
      // Las líneas se dibujan de izquierda a derecha una vez que la tarjeta ya
      // entró (150ms), con deceleración. Reduced-motion: sin animación.
      animation: !REDUCED_MOTION,
      animationDuration: 900,
      animationEasing: 'cubicOut',
      animationDelay: 150,
      animationDurationUpdate: 250,
      grid: { top: 12, right: 12, bottom: 22, left: 12 },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#7b8494',
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.14)', width: 1, type: 'dashed' } },
        splitNumber: 3,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: '#e2e8f0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
        formatter: (params: any) => {
          const label = params[0]?.axisValueLabel ?? '';
          const rows = params.map((p: any) =>
            `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${p.color};margin-right:6px;vertical-align:middle"></span>${p.seriesName}: <strong>${p.value ?? '—'}</strong>`
          ).join('<br/>');
          return `<div style="font-size:10px;letter-spacing:.05em;opacity:.6;margin-bottom:4px">${label}</div>${rows}`;
        },
        axisPointer: {
          type: 'line',
          lineStyle: { color: 'rgba(148,163,184,0.15)', width: 1, type: 'solid' },
        },
      },
      series: [
        {
          name: 'Entre Semana',
          type: 'line',
          smooth: 0.4,
          data: meses.map(m => m.midweek_promedio),
          symbol: 'none',
          lineStyle: { width: 2, color: '#8b5cf6' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(139,92,246,0.18)' },
                { offset: 1, color: 'rgba(139,92,246,0)' }
              ]
            }
          },
          connectNulls: false,
          emphasis: { disabled: true },
        },
        {
          name: 'Fin de Semana',
          type: 'line',
          smooth: 0.4,
          data: meses.map(m => m.weekend_promedio),
          symbol: 'none',
          lineStyle: { width: 2, color: '#f97316' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(249,115,22,0.10)' },
                { offset: 1, color: 'rgba(249,115,22,0)' }
              ]
            }
          },
          connectNulls: false,
          emphasis: { disabled: true },
        }
      ]
    };
  }

  private loadInformesChart(congregacionId: number | null | undefined) {
    if (!congregacionId) { this.informesChartListo.set(true); return; }
    const now = new Date();
    const mesActual = now.getMonth() + 1;
    const anoActual = now.getFullYear();

    // Fetch all periods then keep a rolling window of non-future months,
    // regardless of service year boundary (Sep–Aug is not used here: labels
    // come from codigo_mes, and this chart should keep showing trailing
    // months across the year rollover instead of resetting to empty).
    this.http.get<any[]>('/api/periodos/').subscribe({
      next: (periodos) => {
        const candidatos = periodos.filter(p => {
          const mes = parseInt(p.codigo_mes, 10);
          const ano = parseInt(p.codigo_ano, 10);
          return ano < anoActual || (ano === anoActual && mes <= mesActual);
        }).sort((a, b) => {
          const dateA = parseInt(a.codigo_ano) * 100 + parseInt(a.codigo_mes);
          const dateB = parseInt(b.codigo_ano) * 100 + parseInt(b.codigo_mes);
          return dateA - dateB;
        }).slice(-9); // margen para que, tras descartar meses sin datos, sobrevivan 6

        // Fetch resumen for each period in parallel — cap to last 6 with data
        const requests = candidatos.map(p =>
          this.http.get<any>(`/api/informes/resumen-mensual?periodo_id=${p.id_periodo}&congregacion_id=${congregacionId}`)
        );

        const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

        Promise.all(
          requests.map((req, i) =>
            new Promise<{label: string; pct: number; recibidos: number; total: number} | null>(resolve => {
              req.subscribe({
                next: (stats) => {
                  if (!stats.total_publicadores) { resolve(null); return; }
                  const pct = Math.round((stats.informes_recibidos / stats.total_publicadores) * 100);
                  const p = candidatos[i];
                  const mesIdx = parseInt(p.codigo_mes, 10) - 1;
                  resolve({ label: MESES_ES[mesIdx], pct, recibidos: stats.informes_recibidos, total: stats.total_publicadores });
                },
                error: () => resolve(null)
              });
            })
          )
        ).then(results => {
          const conDatos = results.filter(Boolean) as {label: string; pct: number; recibidos: number; total: number}[];
          if (conDatos.length === 0) { this.informesChartListo.set(true); return; }
          const last6 = conDatos.slice(-6);
          this.informesChartOption.set(this.buildInformesChart(last6));
          this.informesChartListo.set(true);
        });
      },
      error: err => {
        console.error('Error cargando periodos para chart', err);
        this.informesChartListo.set(true);
      }
    });
  }

  private buildInformesChart(meses: {label: string; pct: number; recibidos: number; total: number}[]): EChartsOption {
    return {
      // Las barras crecen desde la base en cascada de 50ms, de la más antigua
      // a la más reciente: se lee como una línea de tiempo.
      animation: !REDUCED_MOTION,
      animationDuration: 650,
      animationEasing: 'cubicOut',
      animationDelay: (i: number) => 150 + i * 50,
      animationDurationUpdate: 250,
      grid: { top: 22, right: 4, bottom: 22, left: 4, containLabel: false },
      xAxis: {
        type: 'category',
        data: meses.map(m => m.label.toUpperCase()),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#7b8494',
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.14)', width: 1, type: 'dashed' } },
        splitNumber: 4,
      },
      tooltip: {
        trigger: 'axis',
        triggerOn: 'mousemove',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: '#e2e8f0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
        formatter: (params: any) => {
          const d = params[0];
          const m = meses[d.dataIndex];
          return `<div style="font-size:10px;letter-spacing:.05em;opacity:.6;margin-bottom:4px">${m.label}</div><span style="color:#94b7fd;font-size:15px;font-weight:700">${m.recibidos}</span><span style="opacity:.6;font-size:10px"> de ${m.total} informes</span>`;
        },
        axisPointer: { type: 'none' },
      },
      series: [
        {
          name: 'Informes recibidos',
          type: 'bar',
          data: meses.map(m => ({
            value: m.recibidos,
            itemStyle: { color: '#3b73fc', borderRadius: [4, 4, 0, 0] },
            label: { color: '#6091fb' },
          })),
          barMaxWidth: 32,
          barCategoryGap: '40%',
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => `${meses[params.dataIndex].recibidos}`,
            fontSize: 10,
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
          },
        }
      ]
    };
  }

  private loadProximaVisita(congregacionId: number | null | undefined) {
    if (!congregacionId) return;
    this.visitaService.list(congregacionId).subscribe({
      next: (visitas) => this.aplicarProximaVisita(visitas, '/secretario-tools/visita-superintendente'),
      error: err => console.error('Error cargando visita del superintendente', err)
    });
  }

  private loadProximaVisitaColaborador() {
    this.visitaService.misColaboraciones().subscribe({
      next: (visitas) => this.aplicarProximaVisita(visitas, '/herramientas/visita-colaborador'),
      error: () => {} // no es colaborador de ninguna visita; sin card, sin ruido en consola
    });
  }

  private aplicarProximaVisita(visitas: Visita[], link: string) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const futuras = visitas
      .filter(v => new Date(v.fecha_inicio) >= hoy)
      .sort((a, b) => new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime());
    if (futuras.length === 0) return;

    const proxima = futuras[0];
    const fechaInicio = new Date(proxima.fecha_inicio);

    // Solo se muestra desde el primer día del mes anterior al de la visita
    // (o antes, si la visita cae en el mes en curso) hasta la fecha de la visita.
    const inicioVentana = new Date(fechaInicio.getFullYear(), fechaInicio.getMonth() - 1, 1);
    if (hoy < inicioVentana) return;

    const diasRestantes = Math.round((fechaInicio.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));

    this.proximaVisita.set({
      fechaTexto: fechaInicio.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
      diasRestantes,
      nombreSC: proxima.nombre_superintendente ?? null,
      link
    });
  }

  delta(actual: number, anterior: number): number {
    return Math.round(actual - anterior);
  }
}
