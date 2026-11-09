import {
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { Subscription, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ProximaReunion, ReunionesService } from '../services/reuniones.service';
import { LogisticaService } from '../services/logistica.service';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { DiscursosService } from '../services/discursos.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AsignacionDraft, ProgramaSemana } from '../models/reuniones.models';
import { LogisticaItemOut, LogisticaAseoOut } from '../models/logistica.models';
import { DiscursoEntranteOut } from '../models/discursos.models';

// ─────────────────────────────────────────────
// Interfaces
// ─────────────────────────────────────────────

interface NextMeetingInfo {
  tipo: 'entre_semana' | 'fin_semana';
  tipoLabel: string;
  fecha: Date;
  hora: string;
  dateLabel: string;
  dateFormatted: string;
}

/** Cuántas reuniones por delante se pueden recorrer (entre semana y fin de semana juntas). */
const REUNIONES_ADELANTE = 12;

interface ResultadoCarga {
  prog: ProgramaSemana | null;
  log: LogisticaData | null;
  disc: DiscursoEntranteOut | null;
}

const CARGA_VACIA: ResultadoCarga = { prog: null, log: null, disc: null };

interface ParteRow {
  principal: AsignacionDraft;
  ayudante?: AsignacionDraft;
  salaB?: AsignacionDraft;
  ayudanteB?: AsignacionDraft;
  esMia: boolean;
  esMiaAyudante: boolean;
  esMiaSalaB: boolean;
  esMiaAyudanteB: boolean;
}

interface SeccionGroup {
  seccion: string;
  color: string;
  iconPath: string;
  partes: ParteRow[];
}

interface LogisticaRow {
  label: string;
  valor: string | null;
  esMia: boolean;
}

interface LogisticaGrupo {
  titulo: string;
  items: LogisticaRow[];
}

interface MiAsignacion {
  label: string;
  tipo: 'parte' | 'logistica';
}

interface LogisticaData {
  asignaciones: LogisticaItemOut[];
  aseo: LogisticaAseoOut[];
}

// ─────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// Colores exactos del componente de programación
const SECTION_MAP: { match: string[]; color: string; iconPath: string }[] = [
  {
    match: ['tesoro'],
    color: '#3c7f8b',
    iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    match: ['mejor', 'maestr', 'discipul', 'discípul', 'enseñ'],
    color: '#d68f00',
    iconPath: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  },
  {
    match: ['cristiana', 'vida'],
    color: '#bf2f13',
    iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  },
  {
    match: ['discurso'],
    color: '#2563eb',
    iconPath: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
  },
  {
    match: ['atalaya', 'estudio'],
    color: '#059669',
    iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  },
  {
    match: ['introducci'],
    color: '#6366f1',
    iconPath: 'M9 18V5l12-2v13M6 18a3 3 0 100-6 3 3 0 000 6zM18 16a3 3 0 100-6 3 3 0 000 6z',
  },
];
const SECTION_DEFAULT = {
  color: '#6D28D9',
  iconPath: 'M4 6h16M4 12h16M4 18h7',
};

// Nombres legibles para códigos de sección de la BD
const SECCION_LABELS: Record<string, string> = {
  tesoros: 'Tesoros de la Biblia',
  seamos_mejores: 'Seamos Mejores Maestros',
  nuestra_vida: 'Nuestra Vida Cristiana',
  fds_principal: 'Programa de la Reunión',
};

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

@Component({
  standalone: true,
  selector: 'app-reuniones-resumen',
  host: { class: 'tema-reuniones' },
  imports: [CommonModule, NgStyle, EmptyStateComponent],
  template: `<div class="resumen-host">
  <div class="resumen-layout">
  <div class="resumen-container">

    <!-- ══════════ CAMBIAR DE REUNIÓN ══════════ -->
    <nav *ngIf="reuniones().length > 1" class="reunion-nav" aria-label="Cambiar de reunión">
      <button *ngIf="indice() > 0" type="button" class="nav-centro nav-volver" (click)="irA(0)">
        Ir a la próxima
      </button>
      <span *ngIf="indice() === 0" class="nav-centro">Próxima reunión</span>

      <div class="nav-botones">
        <button type="button" class="nav-btn" (click)="irA(indice() - 1)"
                [disabled]="indice() === 0"
                aria-label="Ver la reunión anterior" title="Reunión anterior">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
        </button>
        <button type="button" class="nav-btn" (click)="irA(indice() + 1)"
                [disabled]="indice() >= reuniones().length - 1"
                aria-label="Ver la reunión siguiente" title="Reunión siguiente">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
        </button>
      </div>
    </nav>

    <!-- ══════════ SKELETON ══════════ -->
    <ng-container *ngIf="loading()">
      <div class="skeleton-wrap" aria-busy="true" aria-live="polite">
        <span class="sr-only">Cargando el resumen de la próxima reunión…</span>
        <!-- Header card -->
        <div class="skel-card">
          <div class="skel-row">
            <div class="skeleton h-4 w-40 rounded-full"></div>
            <div class="skeleton h-5 w-24 rounded-lg"></div>
          </div>
          <div class="skeleton h-8 w-3/4 rounded-lg mt-4"></div>
          <div class="skeleton h-4 w-32 rounded mt-3"></div>
        </div>
        <!-- Banner -->
        <div class="skel-card">
          <div class="skel-row">
            <div class="skeleton h-9 w-9 rounded-xl shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton h-4 w-1/2 rounded"></div>
              <div class="skeleton h-4 w-2/5 rounded-full"></div>
            </div>
          </div>
        </div>
        <!-- Secciones -->
        <div class="skel-card">
          <div class="skeleton h-4 w-44 rounded"></div>
          <div class="skel-row mt-4">
            <div class="skeleton h-7 w-7 rounded-full shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton h-4 w-3/4 rounded"></div>
              <div class="skeleton h-3 w-2/5 rounded"></div>
            </div>
          </div>
          <div class="skel-row mt-4">
            <div class="skeleton h-7 w-7 rounded-full shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton h-4 w-2/3 rounded"></div>
              <div class="skeleton h-3 w-1/3 rounded"></div>
            </div>
          </div>
        </div>
        <div class="skel-card">
          <div class="skeleton h-4 w-36 rounded"></div>
          <div class="skel-row mt-4">
            <div class="skeleton h-7 w-7 rounded-full shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skeleton h-4 w-5/6 rounded"></div>
              <div class="skeleton h-3 w-2/5 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- ══════════ ERROR ══════════ -->
    <app-empty-state *ngIf="!loading() && error()" variant="error" title="No pudimos cargar el resumen"
      [description]="error() || ''" actionLabel="Reintentar" (action)="reintentar()"></app-empty-state>

    <!-- ══════════ NO PUBLICADO ══════════ -->
    <div *ngIf="!loading() && !error() && noPublicado()" class="empty-state fade-in">
      <div class="empty-icon-wrap empty-icon-brand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
      </div>
      <p class="empty-title">El programa todavía no está publicado</p>
      <p class="empty-body">
        Aquí verás las partes, quién las tiene y la logística en cuanto la congregación publique el programa.
        <ng-container *ngIf="nextMeeting()">
          Vuelve a consultar más cerca del <span class="empty-date">{{ nextMeeting()!.dateFormatted }}</span>.
        </ng-container>
      </p>
    </div>

    <!-- ══════════ CONTENIDO ══════════ -->
    <ng-container *ngIf="!loading() && !error() && !noPublicado() && programa()">

      <!-- ── Header: info de la reunión ── -->
      <div class="resumen-rail">
      <header class="header-card fade-in">
        <!-- Row 1: tipo (eyebrow) + badge fecha -->
        <div class="header-top-row">
          <p class="tipo-eyebrow">
            <svg class="tipo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <ng-container *ngIf="nextMeeting()!.tipo === 'entre_semana'">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </ng-container>
              <ng-container *ngIf="nextMeeting()!.tipo === 'fin_semana'">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </ng-container>
            </svg>
            <span>{{ nextMeeting()!.tipoLabel }}</span>
          </p>
          <span class="date-badge" [ngClass]="getDateBadgeClass(nextMeeting()!.dateLabel)">
            {{ nextMeeting()!.dateLabel }}
          </span>
        </div>

        <!-- Fecha larga + hora -->
        <div class="header-main">
          <h1 class="header-date">
            <time [attr.datetime]="isoNextMeeting()">{{ nextMeeting()!.dateFormatted }}</time>
          </h1>

          <div class="header-hora-row">
            <p *ngIf="nextMeeting()!.hora" class="header-hora">
              <svg class="header-hora-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>{{ formatHora12(nextMeeting()!.hora) }}</span>
            </p>
            <span *ngIf="getDuracionTotal() > 0" class="duracion-inline">
              {{ formatDuracion(getDuracionTotal()) }} de programa
            </span>
          </div>
        </div>
      </header>

      <!-- ── Discurso público (solo fin de semana) ── -->
      <section *ngIf="discursoInvitado() as disc" class="discurso-card fade-in" aria-labelledby="resumen-discurso">
        <p class="discurso-eyebrow" id="resumen-discurso">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>
          </svg>
          <span>Discurso público</span>
        </p>
        <h2 class="discurso-tema">{{ disc.titulo_discurso || 'Tema por confirmar' }}</h2>
        <p class="discurso-meta">
          <span class="discurso-orador">{{ disc.nombre_orador || 'Orador por confirmar' }}</span>
          <ng-container *ngIf="disc.congregacion_origen">
            <span class="discurso-meta-sep" aria-hidden="true">·</span>
            <span class="discurso-cong">{{ disc.congregacion_origen }}</span>
          </ng-container>
        </p>
      </section>

      <!-- ── Banner: mis asignaciones / sin asignaciones ── -->
      <div *ngIf="misAsignaciones().length === 0" class="banner-sin-partes fade-in">
        <svg class="banner-sp-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
        <div class="banner-sp-body">
          <p class="banner-sp-title">Esta semana no tienes asignaciones</p>
          <p class="banner-sp-sub">Abajo está el programa completo por si quieres prepararte.</p>
        </div>
      </div>

      <div *ngIf="misAsignaciones().length > 0" class="banner-mis-partes banner-clicable"
           role="button" tabindex="0"
           title="Ir a mi parte en el programa"
           (click)="irAMiParte()" (keydown.enter)="irAMiParte()" (keydown.space)="irAMiParte(); $event.preventDefault()">
        <div class="banner-icon-wrap" aria-hidden="true">
          <svg class="banner-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <div class="banner-body">
          <p class="banner-title">
            {{ misAsignaciones().length === 1 ? 'Tienes una asignación' : 'Tienes ' + misAsignaciones().length + ' asignaciones' }}
          </p>
          <ul class="banner-partes-list">
            <li *ngFor="let a of misAsignaciones()" class="banner-parte-chip"
                [class.chip-logistica]="a.tipo === 'logistica'">
              {{ a.label }}
            </li>
          </ul>
          <span class="banner-ir">Toca para ir a tu parte ↓</span>
        </div>
      </div>

      </div><!-- /resumen-rail -->

      <!-- ── Secciones ── -->
      <div class="resumen-programa">
      <ng-container *ngFor="let grupo of partesAgrupadas(); let gi = index">
        <section class="seccion-card"
                 [ngStyle]="{ '--sec': grupo.color }"
                 [style.animation-delay]="(gi * 50 + 40) + 'ms'">

          <!-- Cabecera de sección (sticky mientras se recorre la sección) -->
          <header class="seccion-header">
            <div class="seccion-header-left">
              <svg class="seccion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   aria-hidden="true">
                <path [attr.d]="grupo.iconPath"/>
              </svg>
              <h2 class="seccion-titulo">{{ humanizeSeccion(grupo.seccion) }}</h2>
            </div>
            <span *ngIf="duracionSeccion(grupo) > 0" class="seccion-meta">{{ duracionSeccion(grupo) }} min</span>
          </header>

          <!-- Partes -->
          <ol class="partes-list">
            <ng-container *ngFor="let parte of grupo.partes; let pi = index">
              <li class="parte-card"
                   [class.parte-mia]="esMiaLaParte(parte)"
                   [attr.data-mi-parte]="esMiaLaParte(parte) ? 'true' : null"
                   [style.animation-delay]="(gi * 50 + pi * 30 + 80) + 'ms'">

                <!-- Ranura de orden: número, nota musical (cánticos) o vacío -->
                <div class="orden-slot" aria-hidden="true">
                  <span *ngIf="extraerNumero(parte.principal.nombre_parte)"
                        class="orden-num"
                        [ngStyle]="getOrdenStyle(grupo.color, esMiaLaParte(parte), grupo.seccion)">
                    {{ extraerNumero(parte.principal.nombre_parte) }}
                  </span>
                  <svg *ngIf="!extraerNumero(parte.principal.nombre_parte) && esCanticoParte(parte)"
                       class="orden-cantico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                    <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                  </svg>
                </div>

                <div class="parte-body">
                  <div class="parte-main">
                    <!-- Título + duración -->
                    <div class="parte-title-row">
                      <h3 class="parte-name">{{ tituloParte(parte) }}</h3>
                      <span *ngIf="parte.principal.duracion_minutos" class="duracion-text">
                        {{ parte.principal.duracion_minutos }} min
                      </span>
                    </div>

                    <!-- Etiquetas: reemplazo / sala (cuando no hay bloque de salas) -->
                    <div *ngIf="parte.principal.es_reemplazo || (!parte.salaB && salaTagLabel(parte))"
                         class="parte-tags-row">
                      <span *ngIf="parte.principal.es_reemplazo" class="badge-reemplazo">Reemplazo</span>
                      <span *ngIf="!parte.salaB && salaTagLabel(parte)" class="sala-tag">{{ salaTagLabel(parte) }}</span>
                    </div>

                    <!-- Fuente de información (referencia bíblica, o el tema
                         de La Atalaya cuando el PDF ya se importó para esa
                         semana) -->
                    <p *ngIf="parte.principal.fuente_informacion" class="fuente-info">
                      {{ parte.principal.fuente_informacion }}
                    </p>
                    <p *ngIf="parte.principal.cantico" class="parte-cantico">
                      {{ parte.principal.cantico }}
                    </p>
                  </div>

                  <div class="parte-asig"
                       *ngIf="parte.salaB || parte.principal.nombre_completo || parte.ayudante">

                    <!-- ── Caso 1: Sin Sala B (layout simple) ── -->
                    <ng-container *ngIf="!parte.salaB">
                      <p class="asignado-row">
                        <span class="asignado-dot" aria-hidden="true"
                              [style.background]="(parte.esMia || parte.esMiaAyudante) ? '#8b5cf6' : grupo.color"></span>
                        <span class="asignado-text">
                          <span *ngIf="parte.principal.nombre_completo" [class.asignado-mio]="parte.esMia">{{ parte.principal.nombre_completo }}</span>
                          <ng-container *ngIf="parte.ayudante">
                            <span class="ayudante-sep">{{ esEstudioBiblico(parte.principal.nombre_parte) ? 'lector' : 'con' }}</span>
                            <span [class.asignado-mio]="parte.esMiaAyudante">{{ parte.ayudante.nombre_completo }}</span>
                          </ng-container>
                          <span *ngIf="parte.esMia || parte.esMiaAyudante" class="badge-tu inline-badge">Tú</span>
                        </span>
                      </p>
                    </ng-container>

                    <!-- ── Caso 2: Con Sala B (dos bloques) ── -->
                    <ng-container *ngIf="parte.salaB">
                      <div class="salas-stack">
                        <!-- Sala Principal -->
                        <div class="sala-block">
                          <span class="sala-letter sala-letter-p"
                                [style.color]="textoLegible(grupo.color)"
                                [style.background]="hexToRgba(grupo.color, 0.12)"
                                [style.border-color]="hexToRgba(grupo.color, 0.3)"
                                aria-hidden="true">P</span>
                          <span class="sala-block-body">
                            <span class="sala-block-label">Sala principal</span>
                            <span class="asignado-text">
                              <span [class.asignado-mio]="parte.esMia">{{ parte.principal.nombre_completo || 'Sin asignar' }}</span>
                              <ng-container *ngIf="parte.ayudante">
                                <span class="ayudante-sep">con</span>
                                <span [class.asignado-mio]="parte.esMiaAyudante">{{ parte.ayudante.nombre_completo }}</span>
                              </ng-container>
                              <span *ngIf="parte.esMia || parte.esMiaAyudante" class="badge-tu inline-badge">Tú</span>
                            </span>
                          </span>
                        </div>

                        <!-- Sala B -->
                        <div class="sala-block">
                          <span class="sala-letter sala-letter-b" aria-hidden="true">B</span>
                          <span class="sala-block-body">
                            <span class="sala-block-label">Sala B</span>
                            <span class="asignado-text">
                              <span [class.asignado-mio]="parte.esMiaSalaB">{{ parte.salaB!.nombre_completo || 'Sin asignar' }}</span>
                              <ng-container *ngIf="parte.ayudanteB">
                                <span class="ayudante-sep">con</span>
                                <span [class.asignado-mio]="parte.esMiaAyudanteB">{{ parte.ayudanteB!.nombre_completo }}</span>
                              </ng-container>
                              <span *ngIf="parte.esMiaSalaB || parte.esMiaAyudanteB" class="badge-tu inline-badge">Tú</span>
                            </span>
                          </span>
                        </div>
                      </div>
                    </ng-container>
                  </div>
                </div>
              </li>
            </ng-container>
          </ol>

        </section><!-- /seccion-card -->
      </ng-container>

      </div><!-- /resumen-programa -->

      <!-- ── Logística de la reunión ── -->
      <section class="seccion-card logistica-card"
               [style.animation-delay]="(partesAgrupadas().length * 50 + 120) + 'ms'">
        <header class="seccion-header">
          <div class="seccion-header-left">
            <svg class="seccion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
            <h2 class="seccion-titulo">Logística de la reunión</h2>
          </div>
        </header>

        <!-- No publicado -->
        <div *ngIf="logisticaNoPublicada()" class="logistica-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="12" cy="12" r="9"/>
            <path d="M12 8v4M12 16h.01"/>
          </svg>
          <p>La logística de este mes aún no está publicada.</p>
        </div>

        <!-- Contenido -->
        <div *ngIf="!logisticaNoPublicada() && logisticaGrupos().length"
             class="logistica-groups">
          <div *ngFor="let grupo of logisticaGrupos()" class="logistica-group">
            <p *ngIf="grupo.titulo" class="logistica-group-title">{{ grupo.titulo }}</p>
            <ul class="logistica-grid">
              <li *ngFor="let row of grupo.items"
                  class="logistica-item"
                  [class.logistica-item-mia]="row.esMia"
                  [attr.data-mi-parte]="row.esMia ? 'true' : null">
                <span class="logistica-item-label">{{ row.label }}</span>
                <span class="logistica-item-value" [class.sin-asignar]="!row.valor">
                  <span [class.asignado-mio]="row.esMia">{{ row.valor || 'Sin asignar' }}</span>
                  <span *ngIf="row.esMia" class="badge-tu inline-badge">Tú</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section><!-- /logistica-card -->

    </ng-container>
  </div><!-- /resumen-container -->

  </div><!-- /resumen-layout -->
</div><!-- /resumen-host -->
  
  `,
  styles: [`    /* ──────────────────────────────────────────
       TOKENS
    ────────────────────────────────────────── */
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --ease-expo: cubic-bezier(0.16, 1, 0.3, 1);
      --ease-smooth: cubic-bezier(0.22, 1, 0.36, 1);
      --bg: #f3f4fb;
      --surface: #ffffff;
      --border: rgba(109, 40, 217, 0.09);
      --border-std: rgba(15, 23, 42, 0.09);
      --border-soft: rgba(15, 23, 42, 0.05);
      --text: #0d1322;
      --text-2: #3d4966;
      /* #8490a8 se quedaba en 3.2:1 sobre blanco y casi todo lo que lo usa es
         texto de 10-11px (duraciones, fuentes, etiquetas de sala). */
      --text-3: #5b6580;
      --brand: var(--color-brand-purple);
      --brand-2: #7c3aed;
      --radius-card: 16px;
      --radius-soft: 10px;
      --radius-pill: 999px;
    }
    :host-context(.dark) {
      --bg: #0b0f1a;
      --surface: #131826;
      --border: rgba(255, 255, 255, 0.07);
      --border-std: rgba(255, 255, 255, 0.07);
      --border-soft: rgba(255, 255, 255, 0.04);
      --text: #f0f4ff;
      --text-2: #c4cde0;
      --text-3: #8490a8;
    }

    .sr-only {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; overflow: hidden;
      clip: rect(0 0 0 0); white-space: nowrap; border: 0;
    }

    /* ──────────────────────────────────────────
       HOST & LAYOUT (mobile-first)
    ────────────────────────────────────────── */
    .resumen-host {
      min-height: 100%;
      /* 12px lateral da más aire en 375px; safe-area cubre notch de iPhone en landscape */
      padding: 10px
               max(12px, env(safe-area-inset-right))
               max(16px, env(safe-area-inset-bottom))
               max(12px, env(safe-area-inset-left));
    }

    .resumen-layout {
      width: 100%;
      /* 760px hasta que sobra ancho de verdad: por debajo de eso el ancho es
         el mismo de siempre, para no mover nada en móvil ni tablet. De ahí
         crece con la ventana hasta 1120px, que es donde cada parte ya puede
         partirse en dos columnas (qué se hace | quién lo hace) sin que el
         título pase de ~60 caracteres por línea. */
      max-width: clamp(760px, 86vw, 1120px);
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .resumen-container {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    /* 320px — pantallas muy pequeñas */
    @media (max-width: 359px) {
      .header-date { font-size: 1.25rem; }
    }

    /* ≥ sm — tablet */
    @media (min-width: 640px) {
      .resumen-host { padding: 16px 20px 48px; }
      .resumen-container { gap: 12px; }
    }
    /* ≥ md */
    @media (min-width: 768px) {
      .resumen-host { padding: 20px 28px 56px; }
    }
    /* ≥ lg — desktop */
    @media (min-width: 1024px) {
      .resumen-host { padding: 28px 40px 64px; }
      .resumen-container { gap: 14px; }
    }

    /* Por debajo de 2200px el panel lateral y el programa no existen como
       cajas: sus hijos se apilan como siempre, y la logística va al final. */
    .resumen-rail, .resumen-programa { display: contents; }
    @media (min-width: 1700px) and (max-width: 2199px) {
      .resumen-layout { max-width: 1320px; }
    }
    .logistica-card { order: 1; }

    /* ≥ 2K / 4K — el ancho de 1120px dejaba más de la mitad de la pantalla
       vacía. Panel lateral con lo que hay que saber de un vistazo (cuándo,
       qué me toca, logística) y, a la derecha, el programa en columnas que se
       leen de arriba abajo y de izquierda a derecha, en orden de reunión. */
    @media (min-width: 2200px) {
      .resumen-host { padding: 32px 56px 72px; }
      .resumen-layout { max-width: min(94vw, 2000px); }
      .resumen-container {
        display: grid;
        grid-template-columns: 380px minmax(0, 1fr);
        grid-template-rows: auto auto 1fr;
        column-gap: 28px;
        row-gap: 14px;
        align-items: start;
      }
      .resumen-container > :not(.resumen-rail):not(.resumen-programa):not(.logistica-card) {
        grid-column: 1 / -1;
      }
      .resumen-rail {
        display: flex; flex-direction: column; gap: 14px;
        grid-column: 1; grid-row: 2;
      }
      .logistica-card { order: 0; grid-column: 1; grid-row: 3; margin-top: 0; }
      .resumen-programa {
        display: block;
        grid-column: 2; grid-row: 2 / span 2;
        column-count: 2;
        column-gap: 20px;
      }
      .resumen-programa > .seccion-card {
        break-inside: avoid;
        margin: 0 0 14px;
      }
      /* La cabecera cabe en 380px: fecha arriba, hora debajo. */
      .header-card { padding: 20px 20px 18px; }
      .header-main { flex-direction: column; align-items: flex-start; gap: 10px; }
      .header-date { font-size: 1.75rem; }
    }
    /* 4K sin escalar: más panel y más aire entre columnas. */
    @media (min-width: 3000px) {
      .resumen-layout { max-width: 2900px; }
      .resumen-container { grid-template-columns: 440px minmax(0, 1fr); column-gap: 36px; }
      .resumen-programa { column-gap: 28px; }
    }

    /* Landscape phone — reducir padding vertical para ganar altura */
    @media (max-height: 500px) and (orientation: landscape) {
      .resumen-host { padding-top: 6px; padding-bottom: max(8px, env(safe-area-inset-bottom)); }
      .header-card { padding: 12px 16px 10px; }
      .banner-mis-partes, .banner-sin-partes { padding: 10px 14px; }
    }

    /* ──────────────────────────────────────────
       SHIMMER SKELETON
    ────────────────────────────────────────── */
    .skeleton-wrap { display: flex; flex-direction: column; gap: 10px; }

    .skel-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      padding: 14px;
    }
    @media (min-width: 640px) { .skel-card { padding: 18px; } }

    .skel-row { display: flex; align-items: center; gap: 10px; }
    .space-y-2 > * + * { margin-top: 8px; }

    /* ──────────────────────────────────────────
       ESTADOS VACÍOS
    ────────────────────────────────────────── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 56px 20px;
      gap: 10px;
      /* Centrado en el alto disponible: si no hay programa, la pantalla es
         solo este mensaje y colgarlo del borde superior se ve inacabado. */
      min-height: min(62vh, 460px);
    }
    @media (min-width: 640px) { .empty-state { padding: 64px 24px; } }
    .empty-icon-wrap {
      width: 52px; height: 52px;
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 4px;
    }
    .empty-icon-wrap svg { width: 24px; height: 24px; }
    .empty-icon-brand {
      background: rgba(109, 40, 217, 0.08);
      border: 1px solid rgba(109, 40, 217, 0.16);
      color: var(--brand-2);
    }
    :host-context(.dark) .empty-icon-brand {
      background: rgba(167, 139, 250, 0.12);
      border-color: rgba(167, 139, 250, 0.2);
      color: #c4b5fd;
    }
    .empty-title {
      font-size: 1.0625rem; font-weight: 800;
      color: var(--text); margin: 0;
      letter-spacing: -0.015em;
      font-family: var(--font-display);
    }
    .empty-body {
      font-size: 0.875rem;
      color: var(--text-2);
      line-height: 1.6;
      max-width: 42ch;
      margin: 0;
      text-wrap: pretty;
    }
    .empty-date { color: var(--text); font-weight: 700; white-space: nowrap; }

    .empty-action {
      margin-top: 6px;
      padding: 8px 18px;
      border-radius: var(--radius-soft);
      border: 1px solid rgba(109, 40, 217, 0.28);
      background: transparent;
      color: var(--brand);
      font-size: 0.8125rem;
      font-weight: 700;
      font-family: var(--font-display);
      cursor: pointer;
      transition: background 160ms var(--ease-out), transform 120ms var(--ease-out);
    }
    .empty-action:hover { background: rgba(109, 40, 217, 0.07); }
    .empty-action:active { transform: scale(0.98); }
    .empty-action:focus-visible {
      outline: 2px solid var(--brand-2);
      outline-offset: 2px;
    }
    :host-context(.dark) .empty-action {
      border-color: rgba(167, 139, 250, 0.3);
      color: #c4b5fd;
    }
    :host-context(.dark) .empty-action:hover { background: rgba(167, 139, 250, 0.12); }

    /* ──────────────────────────────────────────
       CAMBIAR DE REUNIÓN
    ────────────────────────────────────────── */
    /* Una sola fila fina: la etiqueta a la izquierda y las dos flechas juntas
       a la derecha. Sin texto en los botones, así no ocupan ancho de pantalla. */
    .reunion-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 10px;
    }
    .nav-botones { display: inline-flex; gap: 8px; flex-shrink: 0; }
    .nav-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      /* 44px es el mínimo táctil; el icono es lo único visible dentro. */
      width: 44px;
      height: 44px;
      padding: 0;
      border-radius: var(--radius-soft);
      border: 1px solid var(--border-std);
      background: var(--surface);
      color: var(--text);
      cursor: pointer;
      touch-action: manipulation;
      transition: background 160ms var(--ease-out), transform 160ms var(--ease-out);
    }
    .nav-btn svg { width: 20px; height: 20px; flex-shrink: 0; }
    @media (hover: hover) and (pointer: fine) {
      .nav-btn:hover:not(:disabled) { background: rgba(109, 40, 217, 0.07); }
    }
    .nav-btn:active:not(:disabled) { transform: scale(0.97); }
    .nav-btn:disabled { opacity: 0.4; cursor: default; }
    .nav-btn:focus-visible,
    .nav-volver:focus-visible {
      outline: 2px solid var(--brand-2);
      outline-offset: 2px;
    }
    .nav-centro {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--text-2);
    }
    .nav-volver {
      min-height: 44px;
      padding: 0;
      text-align: left;
      border: 0;
      background: transparent;
      color: var(--brand);
      font-family: var(--font-display);
      cursor: pointer;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    :host-context(.dark) .nav-volver { color: #c4b5fd; }
    @media (hover: hover) and (pointer: fine) {
      :host-context(.dark) .nav-btn:hover:not(:disabled) { background: rgba(167, 139, 250, 0.12); }
    }

    /* ──────────────────────────────────────────
       HEADER CARD
    ────────────────────────────────────────── */
    /* Tarjeta blanca: se distingue del aviso «Tienes una asignación», que es el que lleva el tinte violeta. */
    .header-card {
      background: var(--surface);
      border: 1px solid var(--border-std);
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px -4px rgba(15, 23, 42, 0.06);
      border-radius: var(--radius-card);
      padding: 16px 16px 15px;
    }
    .header-card.fade-in {
      animation: fadeUpHero 420ms var(--ease-expo) both;
    }
    :host-context(.dark) .header-card {
      background: rgba(109, 40, 217, 0.08);
      border-color: rgba(167, 139, 250, 0.18);
      box-shadow: none;
    }
    @media (min-width: 640px) {
      .header-card { padding: 22px 24px 20px; }
    }

    .header-top-row {
      display: flex; align-items: center;
      justify-content: space-between;
      flex-wrap: wrap; gap: 6px 12px;
      margin-bottom: 10px;
    }

    .tipo-eyebrow {
      display: inline-flex; align-items: center; gap: 7px;
      margin: 0;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--color-brand-purple);
      font-family: var(--font-display);
    }
    :host-context(.dark) .tipo-eyebrow { color: #c4b5fd; }
    .tipo-icon { width: 14px; height: 14px; flex-shrink: 0; }

    .date-badge {
      display: inline-flex; align-items: center;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .date-hoy    { background: rgba(5, 150, 105, 0.12); color: #065f46; border: 1px solid rgba(5, 150, 105, 0.28); }
    .date-manana { background: rgba(217, 119, 6, 0.12); color: #92400e; border: 1px solid rgba(217, 119, 6, 0.28); }
    .date-pronto { background: rgba(37, 99, 235, 0.10); color: #1e40af; border: 1px solid rgba(37, 99, 235, 0.22); }
    :host-context(.dark) .date-hoy    { background: rgba(16, 185, 129, 0.16); color: #34d399; border-color: rgba(16, 185, 129, 0.3); }
    :host-context(.dark) .date-manana { background: rgba(245, 158, 11, 0.16); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3); }
    :host-context(.dark) .date-pronto { background: rgba(59, 130, 246, 0.16); color: #60a5fa; border-color: rgba(59, 130, 246, 0.25); }

    /* En escritorio la fecha y la hora comparten línea base: la fecha manda,
       la hora queda al otro extremo como dato de apoyo. */
    .header-main {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    @media (min-width: 720px) {
      .header-main {
        flex-direction: row;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px 24px;
        flex-wrap: wrap;
      }
    }

    .header-date {
      font-size: 1.5625rem;
      font-weight: 900;
      color: var(--text);
      margin: 0;
      line-height: 1.12;
      letter-spacing: -0.03em;
      font-family: var(--font-display);
      text-wrap: balance;
    }
    @media (min-width: 640px) {
      .header-date { font-size: 2rem; }
    }

    .header-hora-row {
      display: flex; align-items: baseline; gap: 6px 12px;
      flex-wrap: wrap;
    }
    .header-hora {
      display: inline-flex; align-items: center; gap: 7px;
      margin: 0;
      color: var(--text);
      font-size: 1.0625rem;
      font-weight: 700;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.02em;
    }
    .header-hora-icon { width: 15px; height: 15px; color: var(--brand); flex-shrink: 0; }
    :host-context(.dark) .header-hora-icon { color: #a78bfa; }
    .duracion-inline {
      font-size: 0.8125rem;
      color: var(--text-3);
      font-variant-numeric: tabular-nums;
    }

    /* ──────────────────────────────────────────
       DISCURSO PÚBLICO (bloque destacado)
    ────────────────────────────────────────── */
    .discurso-card {
      background: rgba(37, 99, 235, 0.035);
      border: 1px solid rgba(37, 99, 235, 0.16);
      border-radius: var(--radius-card);
      padding: 14px 16px 15px;
    }
    :host-context(.dark) .discurso-card {
      background: rgba(96, 165, 250, 0.06);
      border-color: rgba(96, 165, 250, 0.18);
    }
    @media (min-width: 640px) { .discurso-card { padding: 18px 22px 19px; } }

    .discurso-eyebrow {
      display: flex; align-items: center; gap: 7px;
      margin: 0 0 8px;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #2563eb;
      font-family: var(--font-display);
    }
    :host-context(.dark) .discurso-eyebrow { color: #60a5fa; }
    .discurso-eyebrow svg { width: 14px; height: 14px; flex-shrink: 0; }

    .discurso-tema {
      margin: 0 0 6px;
      font-size: 1.1875rem;
      font-weight: 800;
      color: var(--text);
      line-height: 1.25;
      letter-spacing: -0.018em;
      font-family: var(--font-display);
      overflow-wrap: break-word;
      text-wrap: balance;
      max-width: 46ch;
    }
    @media (min-width: 640px) { .discurso-tema { font-size: 1.375rem; } }

    .discurso-meta {
      display: flex; align-items: baseline; gap: 7px;
      flex-wrap: wrap;
      margin: 0;
      font-size: 0.875rem;
      line-height: 1.45;
    }
    .discurso-orador {
      font-weight: 700;
      color: var(--text-2);
    }
    .discurso-meta-sep { color: var(--text-3); }
    .discurso-cong {
      color: var(--text-3);
      font-weight: 500;
    }

    /* ──────────────────────────────────────────
       BANNER SIN ASIGNACIONES
    ────────────────────────────────────────── */
    .banner-sin-partes {
      display: flex; align-items: flex-start; gap: 10px;
      background: rgba(15,23,42,0.035);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      padding: 12px 14px;
    }
    :host-context(.dark) .banner-sin-partes {
      background: rgba(255,255,255,0.03);
    }
    .banner-sp-icon {
      width: 18px; height: 18px;
      color: var(--text-3);
      flex-shrink: 0;
      margin-top: 1px;
    }
    .banner-sp-body { flex: 1; min-width: 0; }
    .banner-sp-title {
      font-size: 0.8125rem;
      font-weight: 700;
      color: var(--text-2);
      margin: 0 0 2px;
    }
    .banner-sp-sub {
      font-size: 0.75rem;
      color: var(--text-3);
      margin: 0;
      line-height: 1.45;
    }

    /* ──────────────────────────────────────────
       BANNER MIS ASIGNACIONES
    ────────────────────────────────────────── */
    .banner-mis-partes {
      display: flex; align-items: flex-start; gap: 12px;
      background: rgba(109, 40, 217, 0.07);
      border: 1px solid rgba(109, 40, 217, 0.22);
      border-radius: var(--radius-card);
      padding: 14px 16px;
      animation: slideDown 220ms var(--ease-out) 40ms both;
    }
    :host-context(.dark) .banner-mis-partes {
      background: rgba(167, 139, 250, 0.10);
      border-color: rgba(167, 139, 250, 0.22);
    }
    @media (min-width: 640px) {
      .banner-mis-partes { padding: 16px 18px; gap: 14px; }
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .banner-icon-wrap {
      width: 36px; height: 36px; min-width: 36px;
      border-radius: 10px;
      background: rgba(109, 40, 217, 0.16);
      border: 1px solid rgba(109, 40, 217, 0.22);
      display: flex; align-items: center; justify-content: center;
      color: #5b21b6;
      animation: iconBreath 3.2s var(--ease-smooth) 1.2s infinite;
      transform-origin: center;
    }
    :host-context(.dark) .banner-icon-wrap {
      background: rgba(167, 139, 250, 0.20);
      border-color: rgba(167, 139, 250, 0.28);
      color: #c4b5fd;
    }
    .banner-body { flex: 1; min-width: 0; }
    .banner-title {
      color: #5b21b6;
      font-size: 0.9375rem;
      font-weight: 800;
      margin: 0 0 7px;
      line-height: 1.3;
      letter-spacing: -0.005em;
      font-family: var(--font-display);
    }
    :host-context(.dark) .banner-title { color: #c4b5fd; }
    @media (min-width: 640px) { .banner-title { font-size: 1.0625rem; } }
    .banner-clicable { cursor: pointer; }
    .banner-clicable:focus-visible { outline: 2px solid #7c3aed; outline-offset: 2px; }
    .banner-ir { display: inline-block; margin-top: 6px; font-size: 0.75rem; font-weight: 600; color: #6d28d9; }
    :host-context(.dark) .banner-ir { color: #c4b5fd; }
    .parte-card, .logistica-item-mia { scroll-margin-top: 96px; }
    /* Llegada a «mi parte»: un aro del color del módulo se dibuja y se
       desvanece, y un destello recorre la fila una sola vez. Solo opacity y
       transform; empieza cuando el desplazamiento ya casi ha llegado. */
    .parte-card, .logistica-item-mia { position: relative; }
    .parte-card.llegada, .logistica-item-mia.llegada { overflow: clip; }
    .parte-card.llegada::before, .logistica-item-mia.llegada::before,
    .parte-card.llegada::after, .logistica-item-mia.llegada::after {
      content: ''; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
    }
    .parte-card.llegada::after, .logistica-item-mia.llegada::after {
      box-shadow: inset 0 0 0 1.5px rgba(124, 58, 237, 0.5), inset 0 0 28px rgba(124, 58, 237, 0.10);
      animation: llegada-aro 1500ms cubic-bezier(0.23, 1, 0.32, 1) both;
    }
    .parte-card.llegada::before, .logistica-item-mia.llegada::before {
      background: linear-gradient(100deg, transparent 0%, rgba(167, 139, 250, 0.22) 50%, transparent 100%);
      width: 55%; transform: translateX(-110%);
      animation: llegada-destello 900ms cubic-bezier(0.77, 0, 0.175, 1) 80ms both;
    }
    .parte-card.llegada .badge-tu { animation: llegada-tu 420ms cubic-bezier(0.23, 1, 0.32, 1) 120ms both; }
    @keyframes llegada-aro {
      0%   { opacity: 0; transform: scale(0.985); }
      22%  { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1); }
    }
    @keyframes llegada-destello {
      from { transform: translateX(-110%); }
      to   { transform: translateX(200%); }
    }
    @keyframes llegada-tu {
      0%   { opacity: 0.4; transform: scale(0.9); }
      100% { opacity: 1; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .parte-card.llegada::before, .logistica-item-mia.llegada::before { display: none; }
      .parte-card.llegada::after, .logistica-item-mia.llegada::after { animation-name: llegada-fundido; }
      .parte-card.llegada .badge-tu { animation: none; }
      @keyframes llegada-fundido { 0%, 100% { opacity: 0; } 30% { opacity: 1; } }
    }
    .banner-partes-list {
      display: flex; flex-wrap: wrap; gap: 5px;
      list-style: none; margin: 0; padding: 0;
    }
    .banner-parte-chip {
      display: inline-block;
      padding: 3px 10px;
      border-radius: var(--radius-pill);
      background: rgba(109, 40, 217, 0.1);
      color: #5b21b6;
      border: 1px solid rgba(109, 40, 217, 0.18);
      font-size: 0.75rem;
      font-weight: 600;
    }
    :host-context(.dark) .banner-parte-chip {
      background: rgba(167, 139, 250, 0.14);
      color: #c4b5fd;
      border-color: rgba(167, 139, 250, 0.25);
    }
    /* Los puestos de logística son asignaciones de otro tipo: mismo chip,
       relleno vacío, para que se distingan de las partes del programa. */
    .banner-parte-chip.chip-logistica {
      background: transparent;
      border-style: dashed;
    }

    /* ──────────────────────────────────────────
       SECCIÓN (card unificada)
    ────────────────────────────────────────── */
    .seccion-card {
      background: var(--surface);
      border: 1px solid var(--border-std);
      border-radius: var(--radius-card);
      /* clip en vez de hidden: recorta las esquinas igual, pero no crea un
         contenedor de scroll y deja que la cabecera se quede fija. */
      overflow: clip;
      animation: fadeUp 240ms var(--ease-out) both;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
    }
    :host-context(.dark) .seccion-card {
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeUpHero {
      from { opacity: 0; transform: translateY(14px) scale(0.982); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes popIn {
      from { opacity: 0; transform: scale(0.6); }
      to   { opacity: 1; transform: scale(1); }
    }
    @keyframes iconBreath {
      0%, 100% { transform: scale(1); }
      50%       { transform: scale(1.08); }
    }

    .banner-icon-svg { width: 18px; height: 18px; }

    .seccion-header {
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px;
      padding: 11px 16px;
      /* El color de la sección se mezcla con la superficie en vez de ir
         traslúcido: la cabecera es opaca (se queda fija al hacer scroll) y el
         texto se oscurece o aclara lo justo para pasar AA en los dos temas —
         el ámbar y el teal puros no llegaban sobre fondo claro. */
      background: color-mix(in oklab, var(--sec, var(--brand)) 7%, var(--surface));
      border-bottom: 1px solid color-mix(in oklab, var(--sec, var(--brand)) 22%, transparent);
      /* Se queda pegada arriba mientras se recorre su sección: en un programa
         de ~10 partes siempre se sabe en qué parte de la reunión vas. */
      position: sticky;
      top: 0;
      z-index: 2;
    }
    @media (min-width: 640px) { .seccion-header { padding: 12px 20px; } }

    .seccion-header-left {
      display: flex; align-items: center; gap: 9px;
      min-width: 0;
    }
    .seccion-icon {
      width: 17px; height: 17px;
      flex-shrink: 0;
      color: color-mix(in oklab, var(--sec, var(--brand)) 80%, #0b1020);
    }
    .seccion-titulo {
      color: color-mix(in oklab, var(--sec, var(--brand)) 72%, #0b1020);
      font-size: 0.8125rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.055em;
      line-height: 1;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      -webkit-font-smoothing: antialiased;
      font-family: var(--font-display);
    }
    /* En móvil el título se parte en dos líneas antes que recortarse:
       "Seamos Mejores Maestros" no cabe de una sola en 320-400px. */
    @media (max-width: 480px) {
      .seccion-titulo {
        white-space: normal;
        overflow: visible;
        line-height: 1.25;
      }
    }
    :host-context(.dark) .seccion-icon {
      color: color-mix(in oklab, var(--sec, var(--brand)) 74%, #ffffff);
    }
    :host-context(.dark) .seccion-titulo {
      color: color-mix(in oklab, var(--sec, var(--brand)) 68%, #ffffff);
    }
    .seccion-meta {
      font-size: 0.75rem;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      color: var(--text-3);
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* ──────────────────────────────────────────
       LISTA DE PARTES
    ────────────────────────────────────────── */
    .partes-list {
      display: flex;
      flex-direction: column;
      padding: 4px 10px;
      margin: 0;
      list-style: none;
    }
    @media (min-width: 640px) { .partes-list { padding: 6px 14px; } }

    /* ──────────────────────────────────────────
       PARTE
    ────────────────────────────────────────── */
    .parte-card {
      display: grid;
      grid-template-columns: 28px minmax(0, 1fr);
      column-gap: 12px;
      padding: 13px 8px;
      border-bottom: 1px solid var(--border-soft);
      border-radius: 8px;
      animation: fadeUp 200ms var(--ease-out) both;
      transition: background 180ms var(--ease-out);
    }
    .parte-card:last-child { border-bottom: none; }
    .parte-card:hover { background: rgba(109, 40, 217, 0.025); }
    .parte-card:hover .orden-num { transform: scale(1.08); }
    :host-context(.dark) .parte-card:hover { background: rgba(109, 40, 217, 0.06); }
    .parte-card.parte-mia { background: rgba(139, 92, 246, 0.07); }
    :host-context(.dark) .parte-card.parte-mia { background: rgba(139, 92, 246, 0.09); }

    /* Ranura de orden: reserva siempre el ancho, tenga número o no, para que
       los cánticos y las oraciones queden alineados con las partes numeradas. */
    .orden-slot {
      width: 28px; min-width: 28px;
      display: flex; align-items: flex-start; justify-content: center;
      padding-top: 1px;
    }
    .orden-num {
      width: 28px; height: 28px;
      border-radius: 999px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      border-width: 1px;
      border-style: solid;
      border-color: transparent;
      transform-origin: center;
      transition: transform 180ms var(--ease-expo);
    }
    .orden-cantico {
      width: 15px; height: 15px;
      color: var(--text-3);
      opacity: 0.75;
      margin-top: 6px;
    }

    /* Cuerpo: en escritorio, qué se hace a la izquierda y quién lo hace a la
       derecha; así el nombre no queda a media pantalla del título. */
    .parte-body {
      min-width: 0;
      display: grid;
      gap: 6px;
    }
    @media (min-width: 900px) {
      .parte-body {
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
        column-gap: 28px;
        align-items: start;
      }
    }
    .parte-main { min-width: 0; }

    .parte-title-row {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: 10px;
      margin-bottom: 3px;
    }
    .parte-name {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text);
      line-height: 1.35;
      margin: 0;
      letter-spacing: -0.008em;
      text-wrap: pretty;
    }
    .duracion-text {
      font-size: 0.75rem;
      color: var(--text-3);
      white-space: nowrap;
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }

    /* Etiquetas de la parte */
    .parte-tags-row {
      display: flex; gap: 5px; flex-wrap: wrap;
      margin: 5px 0 0;
    }
    .badge-reemplazo {
      display: inline-flex; align-items: center;
      padding: 1px 7px;
      border-radius: var(--radius-pill);
      background: rgba(245, 158, 11, 0.12);
      color: #b45309;
      font-size: 0.75rem;
      font-weight: 700;
    }
    :host-context(.dark) .badge-reemplazo { background: rgba(245, 158, 11, 0.16); color: #fbbf24; }

    .sala-tag {
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1;
      padding: 3px 7px;
      border-radius: 5px;
      background: rgba(15, 23, 42, 0.05);
      color: var(--text-2);
      border: 1px solid var(--border);
    }
    :host-context(.dark) .sala-tag {
      background: rgba(30, 41, 59, 0.5);
      color: var(--text-3);
      border-color: rgba(51, 65, 85, 0.6);
    }

    /* Cántico y fuente: metadatos de la parte, un peldaño por debajo */
    .fuente-info,
    .parte-cantico {
      font-size: 0.75rem;
      color: var(--text-3);
      margin: 5px 0 0;
      line-height: 1.45;
    }
    .fuente-info { font-family: var(--font-mono); letter-spacing: -0.01em; }
    .parte-cantico { font-style: italic; }

    /* ──────────────────────────────────────────
       ASIGNADOS
    ────────────────────────────────────────── */
    .parte-asig { min-width: 0; }
    @media (min-width: 900px) {
      .parte-asig { padding-top: 1px; }
    }

    .asignado-row {
      display: flex; align-items: baseline; gap: 7px;
      margin: 0;
    }
    .asignado-dot {
      width: 6px; height: 6px; min-width: 6px;
      border-radius: 999px;
      flex-shrink: 0;
      display: inline-block;
      transform: translateY(-1px);
    }
    .asignado-text {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--text-2);
      margin: 0;
      line-height: 1.45;
      overflow-wrap: break-word;
      word-break: break-word;
    }
    :host-context(.dark) .asignado-text { color: #c4cde0; font-weight: 400; }
    .sin-asignar {
      font-style: italic;
      color: var(--text-3);
    }
    .asignado-mio {
      color: var(--color-brand-purple);
      font-weight: 700;
    }
    :host-context(.dark) .asignado-mio { color: #c4b5fd; }
    .ayudante-sep {
      color: var(--text-3);
      margin: 0 5px;
      font-size: 0.75rem;
    }

    /* Badge Tú */
    .badge-tu {
      display: inline-flex; align-items: center;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: rgba(109, 40, 217, 0.14);
      color: var(--color-brand-purple);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      animation: popIn 280ms var(--ease-expo) both;
      transform-origin: center;
    }
    :host-context(.dark) .badge-tu { background: rgba(167, 139, 250, 0.18); color: #c4b5fd; }
    .inline-badge { margin-left: 5px; }

    /* Salas (Sala Principal + Sala B) */
    .salas-stack {
      display: flex; flex-direction: column; gap: 8px;
    }
    .sala-block {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      column-gap: 8px;
      align-items: start;
    }
    .sala-letter {
      width: 18px; height: 18px;
      border-radius: 5px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      font-family: var(--font-mono);
      border: 1px solid;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .sala-letter-b {
      background: rgba(45, 212, 191, 0.12);
      color: #0f766e;
      border-color: rgba(45, 212, 191, 0.3);
    }
    :host-context(.dark) .sala-letter-b {
      background: rgba(45, 212, 191, 0.14);
      color: #2dd4bf;
    }
    .sala-block-body {
      display: flex; flex-direction: column; gap: 1px;
      min-width: 0;
    }
    .sala-block-label {
      font-size: 0.75rem;
      color: var(--text-3);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* ──────────────────────────────────────────
       LOGÍSTICA
    ────────────────────────────────────────── */
    .logistica-card {
      margin-top: 6px;
    }
    @media (min-width: 640px) {
      .logistica-card { margin-top: 10px; }
    }

    /* La logística es una sección más: hereda el mismo mecanismo de color. */
    .logistica-card { --sec: #1c5c66; }
    :host-context(.dark) .logistica-card { --sec: #7dd3df; }

    .logistica-groups {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 14px 16px 16px;
    }
    @media (min-width: 640px) {
      .logistica-groups { padding: 16px 20px 18px; }
    }
    .logistica-group + .logistica-group {
      padding-top: 16px;
      border-top: 1px solid var(--border-soft);
    }
    .logistica-group-title {
      margin: 0 0 10px;
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.09em;
      color: var(--text-3);
      font-family: var(--font-display);
    }

    /* Rejilla en vez de filas etiqueta···valor: en escritorio la etiqueta y el
       nombre quedan juntos, sin 600px de vacío entre uno y otro. */
    .logistica-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2px;
      list-style: none;
      margin: 0; padding: 0;
    }
    @media (min-width: 600px) {
      .logistica-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 16px; }
    }
    @media (min-width: 1000px) {
      .logistica-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }
    .logistica-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px 10px;
      border-radius: 8px;
      min-width: 0;
    }
    .logistica-item-label {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-3);
      line-height: 1.3;
    }
    .logistica-item-value {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text);
      line-height: 1.4;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    .logistica-item-value.sin-asignar { font-weight: 500; }
    .logistica-item-mia {
      background: rgba(139, 92, 246, 0.08);
      box-shadow: inset 0 0 0 1px rgba(139, 92, 246, 0.18);
    }
    :host-context(.dark) .logistica-item-mia {
      background: rgba(167, 139, 250, 0.10);
      box-shadow: inset 0 0 0 1px rgba(167, 139, 250, 0.2);
    }

    .logistica-empty {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px;
      color: var(--text-3);
      font-size: 0.8125rem;
    }
    @media (min-width: 640px) { .logistica-empty { padding: 18px 20px; } }
    .logistica-empty svg {
      width: 18px; height: 18px;
      flex-shrink: 0;
      opacity: 0.75;
    }
    .logistica-empty p { margin: 0; line-height: 1.4; }

    /* ──────────────────────────────────────────
       FADE-IN GENÉRICO
    ────────────────────────────────────────── */
    .fade-in {
      animation: fadeUp 220ms var(--ease-out) both;
    }

    /* ──────────────────────────────────────────
       REDUCE MOTION
    ────────────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .banner-mis-partes,
      .seccion-card,
      .parte-card,
      .header-card,
      .header-card.fade-in,
      .logistica-card,
      .fade-in,
      .badge-tu {
        animation: fadeOnly 150ms ease both;
      }
      .banner-icon-wrap { animation: none; }
      .orden-num { transition: none; }
    }
    @keyframes fadeOnly {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  

  `],
})
export class ReunionesResumenComponent {
  private reunionesService = inject(ReunionesService);
  private logisticaService = inject(LogisticaService);
  private discursosService = inject(DiscursosService);
  private authStore = inject(AuthStore);
  private congregacionCtx = inject(CongregacionContextService);

  // ─── State ───
  loading = signal(true);
  error = signal<string | null>(null);
  noPublicado = signal(false);
  nextMeeting = signal<NextMeetingInfo | null>(null);
  /** Las próximas reuniones en orden; la de la posición 0 es la que toca. */
  reuniones = signal<NextMeetingInfo[]>([]);
  indice = signal(0);
  private carga: Subscription | null = null;
  programa = signal<ProgramaSemana | null>(null);
  logistica = signal<LogisticaData | null>(null);
  logisticaNoPublicada = signal(false);
  discursoInvitado = signal<DiscursoEntranteOut | null>(null);
  private scrollDone = false;
  private miParteIdx = 0;

  // ─── Computed ───
  // El conductor del Estudio de La Atalaya se escondía aquí porque el tema
  // importado del PDF entraba como una parte asignable de 60 minutos y hacía
  // de conductor de hecho, así que la de verdad salía siempre vacía. Ahora el
  // tema es un dato que cuelga de esta misma parte ("Tema: ...", más el
  // cántico), y quien conduce sí se asigna: se ve como una parte más.

  misPartes = computed(() => {
    const userId = this.authStore.user()?.id_usuario_publicador;
    if (!userId) return [];
    return (this.programa()?.partes ?? [])
      .filter(p => p.id_publicador === userId);
  });

  // Lo que le toca al usuario esta semana, venga del programa o de la
  // logística: antes el banner solo contaba partes, así que quien únicamente
  // tenía micrófonos o plataforma leía "no tienes partes asignadas" y se le
  // pasaba su puesto, que estaba doce pantallas más abajo.
  misAsignaciones = computed((): MiAsignacion[] => {
    const partes: MiAsignacion[] = this.misPartes().map(p => ({
      label: this.quitarPrefijoNumero(this.formatNombreParte(p.nombre_parte ?? '')),
      tipo: 'parte',
    }));
    const logistica: MiAsignacion[] = this.logisticaGrupos()
      .flatMap(g => g.items)
      .filter(item => item.esMia)
      .map(item => ({ label: item.label, tipo: 'logistica' as const }));
    return [...partes, ...logistica];
  });

  partesAgrupadas = computed((): SeccionGroup[] => {
    const partes = this.programa()?.partes ?? [];
    const userId = this.authStore.user()?.id_usuario_publicador;

    const normName = (n?: string) =>
      (n ?? '').replace(/\s*\((sala b[^)]*|ayudante[^)]*)\)/gi, '').trim().toLowerCase();

    const isSalaB = (p: AsignacionDraft) =>
      p.sala === 'Auxiliar' || p.sala === 'B' ||
      /(sala b)/i.test(p.nombre_parte ?? '');

    const usedIdx = new Set<number>();
    const rows: ParteRow[] = [];

    for (let i = 0; i < partes.length; i++) {
      if (usedIdx.has(i) || partes[i].es_ayudante) continue;

      const principal = partes[i];
      usedIdx.add(i);

      let ayudante: AsignacionDraft | undefined;
      let salaB: AsignacionDraft | undefined;
      let ayudanteB: AsignacionDraft | undefined;

      if (principal.aplica_sala_b) {
        const baseNombre = normName(principal.nombre_parte);
        const orden = principal.orden_visual;

        // Recolectar todos los maestros y ayudantes del mismo grupo
        const grupoMaestros: { idx: number; p: AsignacionDraft }[] = [{ idx: i, p: principal }];
        const grupoAyudantes: { idx: number; p: AsignacionDraft }[] = [];

        for (let j = i + 1; j < partes.length; j++) {
          if (usedIdx.has(j)) continue;
          const p = partes[j];
          const samePart = normName(p.nombre_parte) === baseNombre || p.orden_visual === orden;
          if (!samePart) break; // grupos están contiguos en el array

          if (p.es_ayudante) {
            grupoAyudantes.push({ idx: j, p });
            usedIdx.add(j);
          } else if (!p.es_ayudante && samePart) {
            grupoMaestros.push({ idx: j, p });
            usedIdx.add(j);
          }
        }

        // Separar Sala Principal y Sala B
        const maestroPrincipal = grupoMaestros.find(m => !isSalaB(m.p)) ?? grupoMaestros[0];
        const maestroB = grupoMaestros.find(m => m !== maestroPrincipal);

        // Emparejar ayudantes por campo sala o por posición
        const ayudantePrincipal = grupoAyudantes.find(a =>
          !isSalaB(a.p) && (a.p.sala === maestroPrincipal.p.sala || !a.p.sala || a.p.sala === 'Principal'));
        const ayudanteBloque = grupoAyudantes.find(a => a !== ayudantePrincipal);

        ayudante  = ayudantePrincipal?.p;
        salaB     = maestroB?.p;
        ayudanteB = ayudanteBloque?.p;

      } else {
        // Pareja simple: siguiente inmediato si es_ayudante
        if (partes[i + 1]?.es_ayudante && !usedIdx.has(i + 1)) {
          ayudante = partes[i + 1];
          usedIdx.add(i + 1);
        }
      }

      rows.push({
        principal,
        ayudante,
        salaB,
        ayudanteB,
        esMia:          !!userId && principal.id_publicador === userId,
        esMiaAyudante:  !!userId && !!ayudante && ayudante.id_publicador === userId,
        esMiaSalaB:     !!userId && !!salaB && salaB.id_publicador === userId,
        esMiaAyudanteB: !!userId && !!ayudanteB && ayudanteB.id_publicador === userId,
      });
    }

    const groupMap = new Map<string, ParteRow[]>();
    for (const row of rows) {
      const sec = row.principal.seccion ?? 'General';
      if (!groupMap.has(sec)) groupMap.set(sec, []);
      groupMap.get(sec)!.push(row);
    }

    return Array.from(groupMap.entries())
      .sort(([a], [b]) => this.getSectionPriority(a) - this.getSectionPriority(b))
      .map(([seccion, secPartes]) => {
        const info = this.getSectionInfo(seccion);
        return { seccion, color: info.color, iconPath: info.iconPath, partes: secPartes };
      });
  });

  logisticaGrupos = computed((): LogisticaGrupo[] => {
    const data = this.logistica();
    if (!data) return [];
    const userId = this.authStore.user()?.id_usuario_publicador ?? null;

    const get = (puesto: string) => data.asignaciones.find(a => a.puesto === puesto) ?? null;
    const esMia = (it: LogisticaItemOut | null) =>
      !!userId && !!it?.publicador && it.publicador.id_publicador === userId;

    const pair = (label: string, p1: string, p2: string): LogisticaRow | null => {
      const a = get(p1);
      const b = get(p2);
      if (!a && !b) return null;
      const partes = [a?.publicador?.nombre_completo, b?.publicador?.nombre_completo]
        .filter(Boolean) as string[];
      return {
        label,
        valor: partes.length ? partes.join(' - ') : null,
        esMia: esMia(a) || esMia(b),
      };
    };

    const single = (label: string, puesto: string): LogisticaRow | null => {
      const it = get(puesto);
      if (!it) return null;
      return {
        label,
        valor: it.publicador?.nombre_completo ?? null,
        esMia: esMia(it),
      };
    };

    const apoyo: LogisticaRow[] = [
      pair('Micrófonos', 'microfono_1', 'microfono_2'),
      pair('Acomodadores', 'acomodador_1', 'acomodador_2'),
      pair('Vigilancia', 'vigilancia_1', 'vigilancia_2'),
      single('Plataforma', 'plataforma'),
    ].filter((x): x is LogisticaRow => x !== null);

    const tecnica: LogisticaRow[] = [
      single('Audio', 'audio'),
      single('Video', 'video'),
    ].filter((x): x is LogisticaRow => x !== null);

    const aseoNombres = data.aseo.map(s => s.grupo.nombre_grupo).filter(Boolean);
    const grupos: LogisticaGrupo[] = [];
    if (apoyo.length)   grupos.push({ titulo: 'Apoyo en el auditorio', items: apoyo });
    if (tecnica.length) grupos.push({ titulo: 'Sonido y video', items: tecnica });
    if (aseoNombres.length) {
      grupos.push({
        titulo: 'Aseo del salón',
        items: [{ label: 'Grupo encargado', valor: aseoNombres.join(' · '), esMia: false }],
      });
    }
    return grupos;
  });

  constructor() {
    effect(() => {
      const idCong = this.congregacionCtx.effectiveCongregacionId();
      this.scrollDone = false;
      this.loadData(idCong);
    });

    effect(() => {
      const hay = this.misAsignaciones().length > 0;
      const isLoading = this.loading();
      if (hay && !isLoading && !this.scrollDone) {
        // El DOM tarda en pintarse tras la carga: se reintenta hasta que aparezca.
        this.irAMiParte(true);
      }
    });
  }

  /** Lleva la vista a la parte (o puesto) del usuario y la resalta un momento. */
  irAMiParte(automatico = false, intento = 0): void {
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-mi-parte="true"]'));
    if (!els.length) {
      if (automatico && intento < 20) setTimeout(() => this.irAMiParte(true, intento + 1), 150);
      return;
    }
    // Pulsaciones seguidas recorren sus partes una tras otra.
    let el = els[0];
    if (!automatico) {
      this.miParteIdx = (this.miParteIdx + 1) % els.length;
      el = els[this.miParteIdx];
    } else {
      this.scrollDone = true;
      this.miParteIdx = 0;
    }
    const reducir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'center' });
    // El resalte arranca cuando el desplazamiento está por llegar.
    el.classList.remove('llegada');
    setTimeout(() => {
      el.classList.add('llegada');
      setTimeout(() => el.classList.remove('llegada'), 1700);
    }, reducir ? 0 : 350);
  }

  // ─── Template helpers ────────────────────

  getDuracionTotal(): number {
    return (this.programa()?.partes ?? [])
      .filter(p => !p.es_ayudante)
      .reduce((acc, p) => acc + (p.duracion_minutos ?? 0), 0);
  }

  reintentar(): void {
    this.scrollDone = false;
    this.loadData(this.congregacionCtx.effectiveCongregacionId());
  }

  formatDuracion(min: number): string {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  duracionSeccion(grupo: SeccionGroup): number {
    return grupo.partes.reduce((acc, r) => acc + (r.principal.duracion_minutos ?? 0), 0);
  }

  esMiaLaParte(parte: ParteRow): boolean {
    return parte.esMia || parte.esMiaAyudante || parte.esMiaSalaB || parte.esMiaAyudanteB;
  }

  esCanticoParte(parte: ParteRow): boolean {
    return /^\s*(c[áa]ntico|canci[óo]n)/i.test(parte.principal.nombre_parte ?? '');
  }

  isoNextMeeting(): string | null {
    const next = this.nextMeeting();
    if (!next) return null;
    return next.hora ? `${this.toIsoDate(next.fecha)}T${next.hora}` : this.toIsoDate(next.fecha);
  }

  /**
   * Título de la parte tal como se lee en la tarjeta. El bloque de salas (o la
   * etiqueta de sala) ya dice dónde ocurre, así que dejar "(Sala B)" colgando
   * del título duplicaba el dato —y en las partes que se dan en las dos salas
   * lo contradecía.
   */
  tituloParte(parte: ParteRow): string {
    const nombre = this.quitarPrefijoNumero(this.formatNombreParte(parte.principal.nombre_parte ?? ''));
    return nombre.replace(/\s*\(\s*sala\s*(b|principal|auxiliar)\s*\)\s*$/i, '').trim();
  }

  /** Etiqueta de sala para las partes que no traen bloque de Sala B. */
  salaTagLabel(parte: ParteRow): string | null {
    const nombre = parte.principal.nombre_parte ?? '';
    const sala = parte.principal.sala ?? '';
    // Si el título ya nombra la sala (p. ej. "Responsable de Sala B"), la
    // etiqueta sobra.
    if (/sala\s*b/i.test(this.tituloParte(parte))) return null;
    if (/\(\s*sala\s*b\s*\)/i.test(nombre) || sala === 'Auxiliar' || sala === 'B') return 'Sala B';
    if (this.requiereEtiquetaSala(nombre)) return 'Sala Principal';
    return null;
  }

  getDateBadgeClass(label: string): string {
    if (label === 'Hoy') return 'date-hoy';
    if (label === 'Mañana') return 'date-manana';
    return 'date-pronto';
  }

  humanizeSeccion(seccion: string): string {
    const key = seccion.trim().toLowerCase();
    return SECCION_LABELS[key] ?? seccion.replace(/_/g, ' ');
  }

  extraerNumero(nombre?: string): string {
    const match = (nombre ?? '').match(/^(\d+)\./);
    return match ? match[1] : '';
  }

  quitarPrefijoNumero(nombre: string): string {
    return nombre.replace(/^\d+\.\s*/, '');
  }

  requiereEtiquetaSala(nombre?: string): boolean {
    if (!nombre) return false;
    const n = nombre.toLowerCase();
    return (
      (n.includes('lectura') && (n.includes('biblia') || n.includes('bíblica'))) ||
      n.includes('empiece') ||
      n.includes('revisita') ||
      n.includes('discípulo') ||
      n.includes('discipulo') ||
      n.includes('haga disc') ||
      n.includes('explique')
    );
  }

  esEstudioBiblico(nombre?: string): boolean {
    if (!nombre) return false;
    const n = nombre.toLowerCase();
    return n.includes('estudio') && (n.includes('bíblico') || n.includes('biblico'));
  }

  formatHora12(hora: string): string {
    const [h, m] = hora.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
  }

  formatNombreParte(nombre: string): string {
    const lower = nombre.toLowerCase();
    if (lower.includes('oración') && lower.includes('introducción')) {
      return 'Oración y Palabras de introducción (Presidente)';
    }
    if (lower.includes('palabras de introducción') && lower.includes('oración')) {
      return 'Palabras de introducción y Oración (Presidente)';
    }
    return nombre;
  }

  private get isDarkMode(): boolean {
    return document.documentElement.classList.contains('dark');
  }

  getOrdenStyle(color: string, esMia: boolean, seccion = ''): Record<string, string> {
    if (esMia) {
      return {
        background: 'rgba(139, 92, 246, 0.12)',
        color: this.isDarkMode ? '#a78bfa' : '#6d28d9',
        borderColor: 'rgba(139, 92, 246, 0.3)',
      };
    }
    const esNeutral = /apertura|intermedio|clausura/i.test(seccion);
    if (esNeutral) {
      return this.isDarkMode
        ? { background: '#1e293b', color: '#94a3b8', borderColor: '#334155' }
        : { background: '#f1f5f9', color: '#475569', borderColor: '#cbd5e1' };
    }
    return {
      background: this.hexToRgba(color, 0.1),
      color: this.textoLegible(color),
      borderColor: this.hexToRgba(color, 0.3),
    };
  }

  /** El color de la sección sirve para rellenos; como texto en tema claro se oscurece hasta superar 4,5:1. */
  textoLegible(color: string): string {
    return this.isDarkMode ? color : `color-mix(in oklab, ${color} 70%, black)`;
  }

  hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ─── Carga de datos ──────────────────────

  private loadData(idCong: number | null): void {
    this.loading.set(true);
    this.error.set(null);
    this.noPublicado.set(false);
    this.programa.set(null);
    this.nextMeeting.set(null);
    this.logistica.set(null);
    this.logisticaNoPublicada.set(false);
    this.discursoInvitado.set(null);

    if (!idCong) {
      this.error.set('Selecciona una congregación para ver el resumen de la reunión.');
      this.loading.set(false);
      return;
    }

    this.carga?.unsubscribe();
    this.carga = this.reunionesService
      .getProximasReuniones(idCong, REUNIONES_ADELANTE)
      .pipe(
        switchMap(proximas => {
          const lista = this.aProximaReunion(proximas);
          if (!lista.length) {
            this.noPublicado.set(true);
            return of(CARGA_VACIA);
          }
          // Siempre se abre en la que toca; las demás quedan a un clic.
          this.reuniones.set(lista);
          this.indice.set(0);
          this.nextMeeting.set(lista[0]);
          return this.cargarReunion$(idCong, lista[0]);
        }),
        catchError(() => this.falloDeCarga()),
      )
      .subscribe(resultado => this.aplicarResultado(resultado));
  }

  /** Cambia a otra de las próximas reuniones sin volver a pedir la configuración. */
  irA(i: number): void {
    const lista = this.reuniones();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || i < 0 || i >= lista.length || i === this.indice()) return;

    // Una petición vieja que llegue tarde no debe pisar a la reunión elegida
    // después: al pulsar varias veces seguidas solo cuenta la última.
    this.carga?.unsubscribe();
    this.indice.set(i);
    this.nextMeeting.set(lista[i]);
    this.loading.set(true);
    this.error.set(null);
    this.noPublicado.set(false);
    this.programa.set(null);
    this.logistica.set(null);
    this.logisticaNoPublicada.set(false);
    this.discursoInvitado.set(null);
    // Quien navega a propósito no espera que la pantalla salte a su parte.
    this.scrollDone = true;

    this.carga = this.cargarReunion$(idCong, lista[i])
      .pipe(catchError(() => this.falloDeCarga()))
      .subscribe(resultado => this.aplicarResultado(resultado));
  }

  private falloDeCarga() {
    this.error.set('No se pudo cargar la información. Verifica tu conexión e intenta de nuevo.');
    return of(CARGA_VACIA);
  }

  /** Programa, logística y discurso de una reunión concreta. */
  private cargarReunion$(idCong: number, next: NextMeetingInfo) {
    const ano = next.fecha.getFullYear();
    const mes = next.fecha.getMonth() + 1;
    const tipo = next.tipo;
    const targetWeek = this.getISOWeek(next.fecha);
    const fechaIso = this.toIsoDate(next.fecha);

    const prog$ = this.reunionesService
      .getProgramaMes(tipo, ano, mes, idCong, true)
      .pipe(
        switchMap(semanas => {
          const match = semanas.find(s => s.semana_iso === targetWeek);
          if (match) return of(match);
          const prevMes = mes === 1 ? 12 : mes - 1;
          const prevAno = mes === 1 ? ano - 1 : ano;
          return this.reunionesService
            .getProgramaMes(tipo, prevAno, prevMes, idCong, true)
            .pipe(map(s2 => s2.find(s => s.semana_iso === targetWeek) ?? null));
        }),
        catchError(() => of(null as ProgramaSemana | null))
      );

    const log$ = this.logisticaService.getMes(ano, mes, idCong).pipe(
      map(mesData => ({
        // El Resumen es de solo lectura para la congregación: solo debe
        // ver lo ya publicado, igual que el resumen de la app móvil.
        // `getMes` también alimenta el editor de logística (que sí
        // necesita ver el borrador), así que el filtro va aquí y no
        // en el backend.
        asignaciones: mesData.asignaciones.filter(
          a => a.fecha === fechaIso && a.tipo_reunion === tipo && a.confirmado,
        ),
        aseo: mesData.aseo.filter(
          a => a.fecha === fechaIso && a.tipo_reunion === tipo && a.confirmado,
        ),
      }) as LogisticaData),
      catchError(() => of(null as LogisticaData | null)),
    );

    const disc$ = tipo === 'fin_semana'
      ? this.discursosService.getMes(ano, mes, idCong).pipe(
          map(mesData => mesData.entrantes.find(e => e.fecha === fechaIso) ?? null),
          catchError(() => of(null as DiscursoEntranteOut | null)),
        )
      : of(null as DiscursoEntranteOut | null);

    return forkJoin({ prog: prog$, log: log$, disc: disc$ });
  }

  private aplicarResultado({ prog, log, disc }: ResultadoCarga): void {
    if (prog) {
      this.programa.set(prog);
    } else if (!this.noPublicado()) {
      this.noPublicado.set(true);
    }
    if (log && (log.asignaciones.length > 0 || log.aseo.length > 0)) {
      this.logistica.set(log);
      this.logisticaNoPublicada.set(false);
    } else {
      this.logistica.set(null);
      this.logisticaNoPublicada.set(true);
    }
    this.discursoInvitado.set(disc ?? null);
    this.loading.set(false);
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ─── Próximas reuniones ──────────────────

  /**
   * Las próximas reuniones de la congregación, de la más cercana a la más
   * lejana, mezclando entre semana y fin de semana. La primera es la que toca.
   */
  /**
   * Las próximas reuniones las calcula el servidor con el horario que rige en
   * cada fecha (rotación anual de salones compartidos): la semana del cambio
   * ya sale con el día nuevo. Aquí solo se les pone la etiqueta.
   */
  private aProximaReunion(proximas: ProximaReunion[]): NextMeetingInfo[] {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return proximas.map(p => {
      const fecha = new Date(p.fecha + 'T00:00:00');
      const dias = Math.round((fecha.getTime() - hoy.getTime()) / 86_400_000);
      return {
        tipo: p.tipo,
        tipoLabel: p.tipo === 'entre_semana' ? 'Reunión Entre Semana' : 'Reunión Fin de Semana',
        fecha,
        hora: p.hora ?? '',
        dateLabel: this.computeDateLabel(dias),
        dateFormatted: this.formatDateSpanish(fecha),
      };
    });
  }

  private computeDateLabel(d: number): string {
    if (d === 0) return 'Hoy';
    if (d === 1) return 'Mañana';
    if (d === 2) return 'Pasado mañana';
    return `En ${d} días`;
  }

  private formatDateSpanish(date: Date): string {
    return `${DAYS_ES[date.getDay()]}, ${date.getDate()} de ${MONTHS_ES[date.getMonth()]} de ${date.getFullYear()}`;
  }

  private getISOWeek(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const jan4 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  }

  // ─── Secciones ───────────────────────────

  private getSectionInfo(seccion: string): { color: string; iconPath: string } {
    const s = seccion.toLowerCase();
    for (const entry of SECTION_MAP) {
      if (entry.match.some(k => s.includes(k))) return entry;
    }
    return SECTION_DEFAULT;
  }

  private getSectionPriority(seccion: string): number {
    const s = seccion.toLowerCase();
    // Orden de la reunión entre semana y fin de semana
    if (s.includes('apertura'))                                                      return 0;
    if (s.includes('tesoro'))                                                        return 1;
    if (s.includes('mejor') || s.includes('maestr') || s.includes('discipul') || s.includes('enseñ')) return 2;
    if (s.includes('intermedio'))                                                    return 3;
    if (s.includes('cristiana') || s.includes('vida'))                              return 4;
    // Fin de semana
    if (s.includes('introducci'))                                                    return 1;
    if (s.includes('discurso'))                                                      return 2;
    if (s.includes('atalaya') || s.includes('estudio'))                             return 4;
    // Siempre al final
    if (s.includes('conclusi') || s.includes('clausura'))                           return 10;
    return 5;
  }
}

