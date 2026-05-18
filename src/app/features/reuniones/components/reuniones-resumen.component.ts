import {
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, NgStyle } from '@angular/common';
import { catchError, map, of, switchMap } from 'rxjs';
import { ReunionesService } from '../services/reuniones.service';
import { AsistenciaService, CongregacionConfig } from '../services/asistencia.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AsignacionDraft, ProgramaSemana } from '../models/reuniones.models';

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

// ─────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────

@Component({
  standalone: true,
  selector: 'app-reuniones-resumen',
  imports: [CommonModule, NgStyle],
  template: `
<div class="resumen-host">
  <div class="resumen-container">

    <!-- ══════════ SKELETON ══════════ -->
    <ng-container *ngIf="loading()">
      <div class="skeleton-wrap">
        <!-- Header card -->
        <div class="skel-card">
          <div class="skel-row">
            <div class="skel h-5 w-32 rounded-full"></div>
            <div class="skel h-5 w-16 rounded-full"></div>
          </div>
          <div class="skel h-8 w-3/4 rounded-lg mt-3"></div>
          <div class="skel h-4 w-24 rounded mt-2"></div>
          <div class="skel h-7 w-48 rounded-lg mt-3"></div>
        </div>
        <!-- Section -->
        <div class="skel h-10 w-full rounded-xl mt-1"></div>
        <div class="skel-card">
          <div class="skel-row">
            <div class="skel h-9 w-9 rounded-full shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skel h-4 w-3/4 rounded"></div>
              <div class="skel h-3 w-1/2 rounded"></div>
              <div class="skel h-3 w-2/5 rounded"></div>
            </div>
            <div class="skel h-7 w-12 rounded-lg shrink-0"></div>
          </div>
        </div>
        <div class="skel-card">
          <div class="skel-row">
            <div class="skel h-9 w-9 rounded-full shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skel h-4 w-2/3 rounded"></div>
              <div class="skel h-3 w-1/3 rounded"></div>
            </div>
            <div class="skel h-7 w-12 rounded-lg shrink-0"></div>
          </div>
        </div>
        <div class="skel h-10 w-full rounded-xl mt-1"></div>
        <div class="skel-card">
          <div class="skel-row">
            <div class="skel h-9 w-9 rounded-full shrink-0"></div>
            <div class="flex-1 space-y-2">
              <div class="skel h-4 w-5/6 rounded"></div>
              <div class="skel h-3 w-2/5 rounded"></div>
            </div>
            <div class="skel h-7 w-12 rounded-lg shrink-0"></div>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- ══════════ ERROR ══════════ -->
    <div *ngIf="!loading() && error()" class="empty-state fade-in">
      <div class="empty-icon-wrap" style="background:rgba(239,68,68,0.1)">
        <svg class="w-7 h-7" style="color:#ef4444" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <p class="empty-title">Algo salió mal</p>
      <p class="empty-body">{{ error() }}</p>
    </div>

    <!-- ══════════ NO PUBLICADO ══════════ -->
    <div *ngIf="!loading() && !error() && noPublicado()" class="empty-state fade-in">
      <div class="empty-icon-wrap" style="background:rgba(109,40,217,0.1)">
        <svg class="w-8 h-8" style="color:#7c3aed" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>
        </svg>
      </div>
      <p class="empty-title">Programa no publicado</p>
      <p class="empty-body">
        El programa de la próxima reunión aún no ha sido publicado por tu congregación.
        <ng-container *ngIf="nextMeeting()">
          Vuelve a consultar más cerca del
          <strong class="empty-date">{{ nextMeeting()!.dateFormatted }}</strong>.
        </ng-container>
      </p>
    </div>

    <!-- ══════════ CONTENIDO ══════════ -->
    <ng-container *ngIf="!loading() && !error() && !noPublicado() && programa()">

      <!-- ── Header: info de la reunión ── -->
      <div class="header-card fade-in">
        <!-- Row 1: tipo + badge fecha -->
        <div class="header-top-row">
          <div class="tipo-badge">
            <svg class="tipo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          </div>
          <span class="date-badge" [ngClass]="getDateBadgeClass(nextMeeting()!.dateLabel)">
            {{ nextMeeting()!.dateLabel }}
          </span>
        </div>

        <!-- Fecha larga -->
        <p class="header-date">{{ nextMeeting()!.dateFormatted }}</p>

        <!-- Hora + duración -->
        <div class="header-hora-row">
          <div *ngIf="nextMeeting()!.hora" class="header-hora">
            <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>{{ formatHora12(nextMeeting()!.hora) }}</span>
          </div>
          <span *ngIf="getDuracionTotal() > 0" class="duracion-inline">{{ getDuracionTotal() }} min</span>
        </div>
      </div>

      <!-- ── Banner: mis partes ── -->
      <div *ngIf="misPartes().length > 0" class="banner-mis-partes">
        <div class="banner-icon-wrap">
          <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>
        <div class="banner-body">
          <p class="banner-title">
            {{ misPartes().length === 1 ? 'Tienes una parte asignada' : 'Tienes ' + misPartes().length + ' partes asignadas' }}
          </p>
          <div class="banner-partes-list">
            <span *ngFor="let p of misPartes(); let last = last" class="banner-parte-chip">
              {{ p.nombre_parte }}
            </span>
          </div>
        </div>
      </div>

      <!-- ── Secciones ── -->
      <ng-container *ngFor="let grupo of partesAgrupadas(); let gi = index">
        <section class="seccion-card" [style.animation-delay]="(gi * 50 + 40) + 'ms'">

          <!-- Cabecera de sección -->
          <header class="seccion-header"
                  [style.border-left-color]="grupo.color">
            <div class="seccion-header-left">
              <svg class="seccion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   [style.color]="grupo.color">
                <path [attr.d]="grupo.iconPath"/>
              </svg>
              <h3 class="seccion-titulo" [style.color]="grupo.color">{{ grupo.seccion }}</h3>
            </div>
          </header>

          <!-- Partes -->
          <div class="partes-list">
            <ng-container *ngFor="let parte of grupo.partes; let pi = index">
              <article class="parte-card"
                   [class.parte-mia]="parte.esMia || parte.esMiaAyudante || parte.esMiaSalaB || parte.esMiaAyudanteB"
                   [attr.data-mi-parte]="(parte.esMia || parte.esMiaAyudante || parte.esMiaSalaB || parte.esMiaAyudanteB) ? 'true' : null"
                   [style.animation-delay]="(gi * 50 + pi * 30 + 80) + 'ms'">

                <!-- Círculo de número -->
                <div *ngIf="extraerNumero(parte.principal.nombre_parte)"
                     class="orden-num"
                     [ngStyle]="getOrdenStyle(grupo.color, parte.esMia, grupo.seccion)">
                  {{ extraerNumero(parte.principal.nombre_parte) }}
                </div>

                <div class="parte-body">
                  <!-- Título + duración -->
                  <div class="parte-title-row">
                    <h4 class="parte-name">{{ quitarPrefijoNumero(formatNombreParte(parte.principal.nombre_parte ?? '')) }}</h4>
                    <span *ngIf="parte.principal.duracion_minutos" class="duracion-text">
                      {{ parte.principal.duracion_minutos }}m
                    </span>
                  </div>

                  <!-- Badge Reemplazo -->
                  <div *ngIf="parte.principal.es_reemplazo" class="parte-badges-row">
                    <span class="badge-reemplazo">Reemplazo</span>
                  </div>

                  <!-- ── Caso 1: Sin Sala B (layout simple) ── -->
                  <ng-container *ngIf="!parte.salaB">
                    <div *ngIf="requiereEtiquetaSala(parte.principal.nombre_parte)" class="sala-tag-row">
                      <span class="sala-tag">Sala Principal</span>
                    </div>
                    <div *ngIf="parte.principal.nombre_completo || parte.ayudante" class="asignado-row">
                      <span class="asignado-dot"
                            [style.background]="(parte.esMia || parte.esMiaAyudante) ? '#8b5cf6' : grupo.color"></span>
                      <p class="asignado-text">
                        <span *ngIf="parte.principal.nombre_completo" [class.asignado-mio]="parte.esMia">{{ parte.principal.nombre_completo }}</span>
                        <ng-container *ngIf="parte.ayudante">
                          <span class="ayudante-sep">{{ esEstudioBiblico(parte.principal.nombre_parte) ? 'Lector:' : 'con' }}</span>
                          <span [class.asignado-mio]="parte.esMiaAyudante">{{ parte.ayudante.nombre_completo }}</span>
                        </ng-container>
                      </p>
                      <span *ngIf="parte.esMia || parte.esMiaAyudante" class="badge-tu">Tú</span>
                    </div>
                  </ng-container>

                  <!-- ── Caso 2: Con Sala B (layout stacked) ── -->
                  <ng-container *ngIf="parte.salaB">
                    <div class="salas-stack">
                      <!-- Sala Principal -->
                      <div class="sala-block">
                        <div class="sala-block-header">
                          <span class="sala-letter sala-letter-p"
                                [style.color]="grupo.color"
                                [style.background]="hexToRgba(grupo.color, 0.12)"
                                [style.border-color]="hexToRgba(grupo.color, 0.3)">P</span>
                          <span class="sala-block-label">Sala Principal</span>
                        </div>
                        <p class="asignado-text sala-block-text">
                          <span [class.asignado-mio]="parte.esMia">{{ parte.principal.nombre_completo || 'Sin asignar' }}</span>
                          <ng-container *ngIf="parte.ayudante">
                            <span class="ayudante-sep">con</span>
                            <span [class.asignado-mio]="parte.esMiaAyudante">{{ parte.ayudante.nombre_completo }}</span>
                          </ng-container>
                          <span *ngIf="parte.esMia || parte.esMiaAyudante" class="badge-tu inline-badge">Tú</span>
                        </p>
                      </div>

                      <!-- Sala B -->
                      <div class="sala-block">
                        <div class="sala-block-header">
                          <span class="sala-letter sala-letter-b">B</span>
                          <span class="sala-block-label">Sala B</span>
                        </div>
                        <p class="asignado-text sala-block-text">
                          <span [class.asignado-mio]="parte.esMiaSalaB">{{ parte.salaB!.nombre_completo || 'Sin asignar' }}</span>
                          <ng-container *ngIf="parte.ayudanteB">
                            <span class="ayudante-sep">con</span>
                            <span [class.asignado-mio]="parte.esMiaAyudanteB">{{ parte.ayudanteB!.nombre_completo }}</span>
                          </ng-container>
                          <span *ngIf="parte.esMiaSalaB || parte.esMiaAyudanteB" class="badge-tu inline-badge">Tú</span>
                        </p>
                      </div>
                    </div>
                  </ng-container>

                  <!-- Fuente de información -->
                  <p *ngIf="parte.principal.fuente_informacion" class="fuente-info">
                    {{ parte.principal.fuente_informacion }}
                  </p>
                </div>
              </article>
            </ng-container>
          </div>

        </section><!-- /seccion-card -->
      </ng-container>

      <!-- Pie -->

    </ng-container>
  </div><!-- /resumen-container -->
</div><!-- /resumen-host -->
  `,
  styles: [`
    /* ──────────────────────────────────────────
       TOKENS
    ────────────────────────────────────────── */
    :host {
      display: block;
      height: 100%;
      overflow-y: auto;
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --ease-spring: cubic-bezier(0.34, 1.36, 0.64, 1);
      --bg: #f7f8fb;
      --surface: #ffffff;
      --border: rgba(15, 23, 42, 0.08);
      --border-soft: rgba(15, 23, 42, 0.05);
      --text: #0f172a;
      --text-2: #475569;
      --text-3: #94a3b8;
      --brand: #6D28D9;
      --brand-2: #7c3aed;
      --radius-card: 14px;
      --radius-soft: 10px;
      --radius-pill: 999px;
    }
    :host-context(.dark) {
      --bg: #0b0f1a;
      --surface: #131826;
      --border: rgba(255, 255, 255, 0.07);
      --border-soft: rgba(255, 255, 255, 0.04);
      --text: #f1f5f9;
      --text-2: #cbd5e1;
      --text-3: #94a3b8;
    }

    /* ──────────────────────────────────────────
       HOST & LAYOUT (mobile-first)
    ────────────────────────────────────────── */
    .resumen-host {
      min-height: 100%;
      padding: 10px 8px max(16px, env(safe-area-inset-bottom));
    }

    .resumen-container {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    /* ≥ sm — tablet */
    @media (min-width: 640px) {
      .resumen-host { padding: 16px 16px 48px; }
      .resumen-container { gap: 10px; max-width: 860px; }
    }
    /* ≥ md */
    @media (min-width: 768px) {
      .resumen-host { padding: 20px 24px 56px; }
      .resumen-container { max-width: 960px; }
    }
    /* ≥ lg */
    @media (min-width: 1024px) {
      .resumen-host { padding: 24px 32px 64px; }
      .resumen-container { max-width: 1100px; gap: 12px; }
    }
    /* ≥ xl */
    @media (min-width: 1280px) {
      .resumen-container { max-width: 1200px; }
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

    .skel-row { display: flex; align-items: center; gap: 8px; }
    .space-y-2 > * + * { margin-top: 8px; }

    /* ──────────────────────────────────────────
       ESTADOS VACÍOS
    ────────────────────────────────────────── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: 48px 20px;
      gap: 10px;
    }
    @media (min-width: 640px) { .empty-state { padding: 72px 24px; } }
    .empty-icon-wrap {
      width: 56px; height: 56px;
      border-radius: 18px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 2px;
    }
    .empty-title {
      font-size: 1rem; font-weight: 800;
      color: var(--text); margin: 0;
      letter-spacing: -0.01em;
    }
    .empty-body {
      font-size: 0.875rem;
      color: var(--text-2);
      line-height: 1.55;
      max-width: 300px;
      margin: 0;
    }
    .empty-date { color: var(--text); font-weight: 600; }

    /* ──────────────────────────────────────────
       HEADER CARD
    ────────────────────────────────────────── */
    .header-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      padding: 14px 14px 12px;
    }
    @media (min-width: 640px) {
      .header-card { padding: 20px 20px 16px; border-radius: 16px; }
    }

    .header-top-row {
      display: flex; align-items: center;
      flex-wrap: wrap; gap: 6px;
      margin-bottom: 10px;
    }

    .tipo-badge {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 10px;
      border-radius: 6px;
      background: rgba(109, 40, 217, 0.1);
      border: 1px solid rgba(109, 40, 217, 0.2);
      color: var(--brand);
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    :host-context(.dark) .tipo-badge {
      background: rgba(167, 139, 250, 0.14);
      border-color: rgba(167, 139, 250, 0.2);
      color: #a78bfa;
    }
    .tipo-icon { width: 12px; height: 12px; }

    .date-badge {
      display: inline-flex; align-items: center;
      padding: 4px 9px;
      border-radius: 6px;
      font-size: 0.65rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .date-hoy    { background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.25); }
    .date-manana { background: rgba(245, 158, 11, 0.14); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.3); }
    .date-pronto { background: rgba(59, 130, 246, 0.12); color: #1d4ed8; border: 1px solid rgba(59, 130, 246, 0.25); }
    :host-context(.dark) .date-hoy    { background: rgba(16, 185, 129, 0.16); color: #34d399; border-color: rgba(16, 185, 129, 0.3); }
    :host-context(.dark) .date-manana { background: rgba(245, 158, 11, 0.16); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3); }
    :host-context(.dark) .date-pronto { background: rgba(59, 130, 246, 0.16); color: #60a5fa; }

    .header-date {
      font-size: 1.375rem;
      font-weight: 900;
      color: var(--text);
      margin: 0 0 8px;
      line-height: 1.15;
      letter-spacing: -0.025em;
    }
    @media (min-width: 640px) {
      .header-date { font-size: 1.75rem; }
    }

    .header-hora-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 8px;
    }
    .header-hora {
      display: inline-flex; align-items: center; gap: 5px;
      color: var(--text-2);
      font-size: 0.8125rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .duracion-inline {
      font-size: 0.8125rem;
      color: var(--text-3);
      font-variant-numeric: tabular-nums;
    }

    .titulo-guia {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px;
      border-radius: 8px;
      background: rgba(15, 23, 42, 0.04);
      color: var(--text-2);
      font-size: 0.75rem;
      font-style: italic;
      margin-bottom: 10px;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host-context(.dark) .titulo-guia {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-3);
    }

    .header-meta {
      display: flex; flex-wrap: wrap; gap: 6px;
      margin-top: 2px;
    }
    .meta-pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 9px;
      border-radius: var(--radius-pill);
      background: rgba(15, 23, 42, 0.05);
      color: var(--text-2);
      font-size: 0.7rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    :host-context(.dark) .meta-pill {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-3);
    }

    /* ──────────────────────────────────────────
       BANNER MIS PARTES
    ────────────────────────────────────────── */
    .banner-mis-partes {
      display: flex; align-items: flex-start; gap: 10px;
      background: linear-gradient(135deg, #6D28D9 0%, #7c3aed 60%, #8b5cf6 100%);
      border-radius: var(--radius-card);
      padding: 12px 14px;
      animation: slideDown 220ms var(--ease-out) 40ms both;
    }
    @media (min-width: 640px) {
      .banner-mis-partes { padding: 14px 16px; gap: 12px; }
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .banner-icon-wrap {
      width: 34px; height: 34px; min-width: 34px;
      border-radius: 9px;
      background: rgba(255, 255, 255, 0.18);
      display: flex; align-items: center; justify-content: center;
    }
    .banner-body { flex: 1; min-width: 0; }
    .banner-title {
      color: #fff;
      font-size: 0.875rem;
      font-weight: 800;
      margin: 0 0 5px;
      line-height: 1.3;
      letter-spacing: -0.005em;
    }
    @media (min-width: 640px) { .banner-title { font-size: 1rem; } }
    .banner-partes-list {
      display: flex; flex-wrap: wrap; gap: 4px;
    }
    .banner-parte-chip {
      display: inline-block;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: rgba(255, 255, 255, 0.18);
      color: rgba(255, 255, 255, 0.96);
      font-size: 0.7rem;
      font-weight: 600;
    }

    /* ──────────────────────────────────────────
       SECCIÓN (card unificada)
    ────────────────────────────────────────── */
    .seccion-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      animation: fadeUp 240ms var(--ease-out) both;
      will-change: transform, opacity;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    :host-context(.dark) .seccion-card {
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .seccion-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border-soft);
      border-left: 2px solid transparent;
      background: rgba(15, 23, 42, 0.04);
    }
    :host-context(.dark) .seccion-header { background: rgba(30, 41, 59, 0.4); }

    .seccion-header-left {
      display: flex; align-items: center; gap: 8px;
      min-width: 0;
    }
    .seccion-icon {
      width: 16px; height: 16px;
      flex-shrink: 0;
    }
    .seccion-titulo {
      font-size: 0.7rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      line-height: 1;
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      -webkit-font-smoothing: antialiased;
      filter: brightness(1.3);
    }
    .seccion-count {
      min-width: 22px;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: rgba(15, 23, 42, 0.06);
      color: var(--text-2);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 0.7rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    :host-context(.dark) .seccion-count {
      background: rgba(30, 41, 59, 0.6);
      color: var(--text-3);
    }

    /* ──────────────────────────────────────────
       LISTA DE PARTES
    ────────────────────────────────────────── */
    .partes-list {
      display: flex;
      flex-direction: column;
      padding: 0 8px;
    }

    /* ──────────────────────────────────────────
       PARTE CARD
    ────────────────────────────────────────── */
    .parte-card {
      display: flex; gap: 12px;
      padding: 12px 8px;
      border-bottom: 1px solid var(--border-soft);
      border-radius: 8px;
      margin: 2px 0;
      animation: fadeUp 200ms var(--ease-out) both;
      transition: background 160ms ease;
      will-change: transform, opacity;
    }
    .parte-card:last-child { border-bottom: none; }
    .parte-card:hover { background: rgba(15, 23, 42, 0.03); }
    :host-context(.dark) .parte-card:hover { background: rgba(30, 41, 59, 0.3); }
    .parte-card.parte-mia { background: rgba(139, 92, 246, 0.06); }
    :host-context(.dark) .parte-card.parte-mia { background: rgba(139, 92, 246, 0.08); }

    /* Círculo de número */
    .orden-num {
      width: 28px; height: 28px; min-width: 28px;
      border-radius: 999px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem;
      font-weight: 600;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
      border-width: 1px;
      border-style: solid;
      border-color: transparent;
    }

    .orden-spacer {
      width: 28px; min-width: 28px;
      flex-shrink: 0;
    }

    /* Cuerpo */
    .parte-body {
      flex: 1; min-width: 0;
    }

    .parte-title-row {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;
    }
    .parte-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text);
      line-height: 1.35;
      margin: 0;
      letter-spacing: -0.005em;
    }
    .duracion-text {
      font-size: 0.65rem;
      color: var(--text-3);
      white-space: nowrap;
      margin-top: 2px;
      font-variant-numeric: tabular-nums;
      flex-shrink: 0;
    }

    /* Badge Reemplazo */
    .parte-badges-row {
      display: flex; gap: 4px;
      margin-bottom: 6px;
    }
    .badge-reemplazo {
      display: inline-flex; align-items: center;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: rgba(245, 158, 11, 0.12);
      color: #b45309;
      font-size: 0.6rem;
      font-weight: 700;
    }
    :host-context(.dark) .badge-reemplazo { background: rgba(245, 158, 11, 0.16); color: #fbbf24; }

    /* "Sala Principal" tag (caso simple) */
    .sala-tag-row {
      display: flex; gap: 6px;
      margin-bottom: 6px;
    }
    .sala-tag {
      font-size: 0.6rem;
      font-weight: 500;
      line-height: 1;
      padding: 3px 6px;
      border-radius: 4px;
      background: rgba(15, 23, 42, 0.05);
      color: var(--text-2);
      border: 1px solid var(--border);
    }
    :host-context(.dark) .sala-tag {
      background: rgba(30, 41, 59, 0.5);
      color: var(--text-3);
      border-color: rgba(51, 65, 85, 0.6);
    }

    /* Asignado */
    .asignado-row {
      display: flex; align-items: center; gap: 6px;
      flex-wrap: wrap;
    }
    .asignado-dot {
      width: 6px; height: 6px; min-width: 6px;
      border-radius: 999px;
      flex-shrink: 0;
      display: inline-block;
    }
    .asignado-text {
      font-size: 0.75rem;
      font-weight: 400;
      color: var(--text-2);
      margin: 0;
      line-height: 1.4;
    }
    :host-context(.dark) .asignado-text { color: #cbd5e1; }
    .sin-asignar {
      font-style: italic;
      color: var(--text-3);
    }
    .asignado-mio {
      color: #8b5cf6 !important;
      font-weight: 600;
    }
    :host-context(.dark) .asignado-mio { color: #a78bfa !important; }
    .ayudante-sep {
      color: var(--text-3);
      margin: 0 4px;
      font-size: 0.7rem;
    }

    /* Badge Tú */
    .badge-tu {
      display: inline-flex; align-items: center;
      padding: 1px 6px;
      border-radius: var(--radius-pill);
      background: rgba(139, 92, 246, 0.14);
      color: #8b5cf6;
      font-size: 0.6rem;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    :host-context(.dark) .badge-tu { background: rgba(167, 139, 250, 0.18); color: #a78bfa; }
    .inline-badge { margin-left: 4px; }

    /* Salas stack (Sala Principal + Sala B) */
    .salas-stack {
      display: flex; flex-direction: column; gap: 10px;
      margin-top: 4px;
    }
    .sala-block {
      display: flex; flex-direction: column; gap: 4px;
    }
    .sala-block-header {
      display: flex; align-items: center; gap: 6px;
    }
    .sala-letter {
      width: 18px; height: 18px;
      border-radius: 4px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 0.6rem;
      font-weight: 700;
      border: 1px solid;
      flex-shrink: 0;
    }
    .sala-letter-p {
      /* colores definidos inline desde la sección */
    }
    .sala-letter-b {
      background: rgba(45, 212, 191, 0.12);
      color: #14b8a6;
      border-color: rgba(45, 212, 191, 0.3);
    }
    :host-context(.dark) .sala-letter-b {
      background: rgba(45, 212, 191, 0.14);
      color: #2dd4bf;
    }
    .sala-block-label {
      font-size: 0.625rem;
      color: var(--text-3);
      font-weight: 500;
    }
    .sala-block-text {
      padding-left: 24px;
    }

    /* Fuente */
    .fuente-info {
      font-size: 0.7rem;
      font-style: italic;
      color: var(--text-3);
      margin: 6px 0 0;
      line-height: 1.4;
    }

    /* ──────────────────────────────────────────
       PIE
    ────────────────────────────────────────── */
    .footer-note {
      text-align: center;
      font-size: 0.6875rem;
      color: var(--text-3);
      opacity: 0.65;
      margin: 6px 0 0;
      letter-spacing: 0.01em;
    }

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
      .fade-in {
        animation: fadeOnly 150ms ease both;
      }
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
  private authStore = inject(AuthStore);
  private congregacionCtx = inject(CongregacionContextService);

  // ─── State ───
  loading = signal(true);
  error = signal<string | null>(null);
  noPublicado = signal(false);
  nextMeeting = signal<NextMeetingInfo | null>(null);
  programa = signal<ProgramaSemana | null>(null);
  private scrollDone = false;

  // ─── Computed ───
  misPartes = computed(() => {
    const userId = this.authStore.user()?.id_usuario_publicador;
    if (!userId) return [];
    return (this.programa()?.partes ?? []).filter(p => p.id_publicador === userId);
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

  getPartesPrincipales(): number {
    return (this.programa()?.partes ?? []).filter(p => !p.es_ayudante).length;
  }

  getDuracionTotal(): number {
    return (this.programa()?.partes ?? [])
      .filter(p => !p.es_ayudante)
      .reduce((acc, p) => acc + (p.duracion_minutos ?? 0), 0);
  }

  getDateBadgeClass(label: string): string {
    if (label === 'Hoy') return 'date-hoy';
    if (label === 'Mañana') return 'date-manana';
    return 'date-pronto';
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

  getSeccionHeaderStyle(color: string): Record<string, string> {
    return {
      background: this.hexToRgba(color, 0.08),
      boxShadow: `inset 3px 0 0 ${color}`,
    };
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
      return {
        background: '#1e293b',
        color: '#cbd5e1',
        borderColor: '#334155',
      };
    }
    return {
      background: this.hexToRgba(color, 0.1),
      color,
      borderColor: this.hexToRgba(color, 0.3),
    };
  }

  getDuracionStyle(color: string): Record<string, string> {
    return { background: this.hexToRgba(color, 0.1), color };
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
            return of(null);
          }
          this.nextMeeting.set(next);
          const ano = next.fecha.getFullYear();
          const mes = next.fecha.getMonth() + 1;
          const tipo = next.tipo;
          const targetWeek = this.getISOWeek(next.fecha);

          return this.reunionesService
            .getHistorialConfirmado(tipo, ano, mes, idCong)
            .pipe(
              switchMap(semanas => {
                const match = semanas.find(s => s.semana_iso === targetWeek);
                if (match) return of(match);
                const prevMes = mes === 1 ? 12 : mes - 1;
                const prevAno = mes === 1 ? ano - 1 : ano;
                return this.reunionesService
                  .getHistorialConfirmado(tipo, prevAno, prevMes, idCong)
                  .pipe(map(s2 => s2.find(s => s.semana_iso === targetWeek) ?? null));
              }),
              catchError(() => of(null))
            );
        }),
        catchError(() => {
          this.error.set('No se pudo cargar la información. Verifica tu conexión e intenta de nuevo.');
          return of(null);
        })
      )
      .subscribe(prog => {
        if (prog) {
          this.programa.set(prog);
        } else if (!this.noPublicado()) {
          this.noPublicado.set(true);
        }
        this.loading.set(false);
      });
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
