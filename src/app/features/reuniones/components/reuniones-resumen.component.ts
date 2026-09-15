import {
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { ReunionesService } from '../services/reuniones.service';
import { AsistenciaService, CongregacionConfig } from '../services/asistencia.service';
import { LogisticaService } from '../services/logistica.service';
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

const DIA_MAP: Record<string, number> = {
  domingo: 0, sunday: 0,
  lunes: 1, monday: 1,
  martes: 2, tuesday: 2,
  'miércoles': 3, miercoles: 3, wednesday: 3,
  jueves: 4, thursday: 4,
  viernes: 5, friday: 5,
  'sábado': 6, sabado: 6, saturday: 6,
};

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
  imports: [CommonModule, NgStyle],
  template: `<div class="resumen-host">
  <div class="resumen-layout">
  <div class="resumen-container">

    <!-- ══════════ SKELETON ══════════ -->
    <ng-container *ngIf="loading()">
      <div class="skeleton-wrap" aria-busy="true" aria-live="polite">
        <span class="sr-only">Cargando el resumen de la próxima reunión…</span>
        <!-- Header card -->
        <div class="skel-card">
          <div class="skel-row">
            <div class="skel h-4 w-40 rounded-full"></div>
            <div class="skel h-5 w-24 rounded-lg"></div>
          </div>
          <div class="skel h-8 w-3/4 rounded-lg mt-4"></div>
          <div class="skel h-4 w-32 rounded mt-3"></div>
        </div>
        <!-- Banner -->
        <div class="skel-card">
          <div class="skel-row">
            <div class="skel h-9 w-9 rounded-xl shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skel h-4 w-1/2 rounded"></div>
              <div class="skel h-4 w-2/5 rounded-full"></div>
            </div>
          </div>
        </div>
        <!-- Secciones -->
        <div class="skel-card">
          <div class="skel h-4 w-44 rounded"></div>
          <div class="skel-row mt-4">
            <div class="skel h-7 w-7 rounded-full shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skel h-4 w-3/4 rounded"></div>
              <div class="skel h-3 w-2/5 rounded"></div>
            </div>
          </div>
          <div class="skel-row mt-4">
            <div class="skel h-7 w-7 rounded-full shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skel h-4 w-2/3 rounded"></div>
              <div class="skel h-3 w-1/3 rounded"></div>
            </div>
          </div>
        </div>
        <div class="skel-card">
          <div class="skel h-4 w-36 rounded"></div>
          <div class="skel-row mt-4">
            <div class="skel h-7 w-7 rounded-full shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skel h-4 w-5/6 rounded"></div>
              <div class="skel h-3 w-2/5 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- ══════════ ERROR ══════════ -->
    <div *ngIf="!loading() && error()" class="empty-state fade-in" role="alert">
      <div class="empty-icon-wrap empty-icon-neg">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
        </svg>
      </div>
      <p class="empty-title">No pudimos cargar el resumen</p>
      <p class="empty-body">{{ error() }}</p>
      <button type="button" class="empty-action" (click)="reintentar()">Reintentar</button>
    </div>

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

      <div *ngIf="misAsignaciones().length > 0" class="banner-mis-partes">
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
        </div>
      </div>

      <!-- ── Secciones ── -->
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
                                [style.color]="grupo.color"
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
                  [class.logistica-item-mia]="row.esMia">
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
      --text-3: #6b7590;
      --brand: #6D28D9;
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

    .skel {
      display: block;
      background: linear-gradient(90deg,#e2e8f0 25%,#f1f5f9 50%,#e2e8f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.6s ease-in-out infinite;
      border-radius: 6px;
    }
    :host-context(.dark) .skel {
      background: linear-gradient(90deg,#1e293b 25%,#273549 50%,#1e293b 75%);
      background-size: 200% 100%;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

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
    .empty-icon-neg {
      background: rgba(220, 38, 38, 0.07);
      border: 1px solid rgba(220, 38, 38, 0.16);
      color: #dc2626;
    }
    :host-context(.dark) .empty-icon-neg {
      background: rgba(248, 113, 113, 0.12);
      border-color: rgba(248, 113, 113, 0.2);
      color: #f87171;
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
       HEADER CARD
    ────────────────────────────────────────── */
    .header-card {
      background: rgba(109, 40, 217, 0.026);
      border: 1px solid rgba(109, 40, 217, 0.16);
      border-radius: var(--radius-card);
      padding: 16px 16px 15px;
    }
    .header-card.fade-in {
      animation: fadeUpHero 420ms var(--ease-expo) both;
    }
    :host-context(.dark) .header-card {
      background: rgba(109, 40, 217, 0.08);
      border-color: rgba(167, 139, 250, 0.18);
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
      font-size: 0.6875rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: #6d28d9;
      font-family: var(--font-display);
    }
    :host-context(.dark) .tipo-eyebrow { color: #c4b5fd; }
    .tipo-icon { width: 14px; height: 14px; flex-shrink: 0; }

    .date-badge {
      display: inline-flex; align-items: center;
      padding: 4px 10px;
      border-radius: 8px;
      font-size: 0.6875rem;
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
      font-size: 0.6875rem;
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
      font-size: 0.6875rem;
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
      font-size: 0.6875rem;
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
      font-size: 0.625rem;
      font-weight: 700;
    }
    :host-context(.dark) .badge-reemplazo { background: rgba(245, 158, 11, 0.16); color: #fbbf24; }

    .sala-tag {
      font-size: 0.625rem;
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
      font-size: 0.7rem;
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
      color: #6d28d9;
      font-weight: 700;
    }
    :host-context(.dark) .asignado-mio { color: #c4b5fd; }
    .ayudante-sep {
      color: var(--text-3);
      margin: 0 5px;
      font-size: 0.6875rem;
    }

    /* Badge Tú */
    .badge-tu {
      display: inline-flex; align-items: center;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: rgba(109, 40, 217, 0.14);
      color: #6d28d9;
      font-size: 0.625rem;
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
      font-size: 0.625rem;
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
      font-size: 0.625rem;
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
      font-size: 0.6875rem;
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
      font-size: 0.625rem;
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
      .skel { animation: none; opacity: 0.5; }
    }
    @keyframes fadeOnly {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  

  `],
})
export class ReunionesResumenComponent {
  private reunionesService = inject(ReunionesService);
  private asistenciaService = inject(AsistenciaService);
  private logisticaService = inject(LogisticaService);
  private discursosService = inject(DiscursosService);
  private authStore = inject(AuthStore);
  private congregacionCtx = inject(CongregacionContextService);

  // ─── State ───
  loading = signal(true);
  error = signal<string | null>(null);
  noPublicado = signal(false);
  nextMeeting = signal<NextMeetingInfo | null>(null);
  programa = signal<ProgramaSemana | null>(null);
  logistica = signal<LogisticaData | null>(null);
  logisticaNoPublicada = signal(false);
  discursoInvitado = signal<DiscursoEntranteOut | null>(null);
  private scrollDone = false;

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
      const partes = this.misPartes();
      const isLoading = this.loading();
      if (partes.length > 0 && !isLoading && !this.scrollDone) {
        setTimeout(() => {
          const el = document.querySelector('[data-mi-parte="true"]');
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this.scrollDone = true;
          }
        }, 700);
      }
    });
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
        color: '#8b5cf6',
        borderColor: 'rgba(139, 92, 246, 0.3)',
      };
    }
    const esNeutral = /apertura|intermedio|clausura/i.test(seccion);
    if (esNeutral) {
      return this.isDarkMode
        ? { background: '#1e293b', color: '#94a3b8', borderColor: '#334155' }
        : { background: '#f1f5f9', color: '#64748b', borderColor: '#cbd5e1' };
    }
    return {
      background: this.hexToRgba(color, 0.1),
      color,
      borderColor: this.hexToRgba(color, 0.3),
    };
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

    this.asistenciaService
      .getCongregacionConfigById(idCong)
      .pipe(
        switchMap(config => {
          const next = this.computeNextMeeting(config);
          if (!next) {
            this.noPublicado.set(true);
            return of({ prog: null as ProgramaSemana | null, log: null as LogisticaData | null, disc: null as DiscursoEntranteOut | null });
          }
          this.nextMeeting.set(next);
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
        }),
        catchError(() => {
          this.error.set('No se pudo cargar la información. Verifica tu conexión e intenta de nuevo.');
          return of({ prog: null as ProgramaSemana | null, log: null as LogisticaData | null, disc: null as DiscursoEntranteOut | null });
        })
      )
      .subscribe(({ prog, log, disc }) => {
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
      });
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ─── Próxima reunión ─────────────────────

  private computeNextMeeting(config: CongregacionConfig): NextMeetingInfo | null {
    const now = new Date();
    const today = now.getDay();
    const candidates: NextMeetingInfo[] = [];

    const pairs: ['entre_semana' | 'fin_semana', string, string | null, string | null][] = [
      ['entre_semana', 'Reunión Entre Semana', config.dia_reunion_entre_semana, config.hora_reunion_entre_semana],
      ['fin_semana', 'Reunión Fin de Semana', config.dia_reunion_fin_semana, config.hora_reunion_fin_semana],
    ];

    for (const [tipo, tipoLabel, dia, hora] of pairs) {
      if (!dia) continue;
      const diaKey = dia.toLowerCase().trim();
      let targetDay = DIA_MAP[diaKey] ?? parseInt(diaKey, 10);
      if (isNaN(targetDay)) continue;

      let daysUntil = (targetDay - today + 7) % 7;
      if (daysUntil === 0) {
        const [h = 0, m = 0] = (hora ?? '00:00').split(':').map(Number);
        const meetingTime = new Date(now);
        meetingTime.setHours(h, m, 0, 0);
        if (now > meetingTime) daysUntil = 7;
      }

      const fecha = new Date(now);
      fecha.setDate(now.getDate() + daysUntil);
      fecha.setHours(0, 0, 0, 0);

      candidates.push({
        tipo, tipoLabel, fecha,
        hora: hora ?? '',
        dateLabel: this.computeDateLabel(daysUntil),
        dateFormatted: this.formatDateSpanish(fecha),
      });
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    return candidates[0];
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

