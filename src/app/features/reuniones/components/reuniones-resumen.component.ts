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
  esMia: boolean;
  esMiaAyudante: boolean;
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

        <!-- Hora -->
        <div *ngIf="nextMeeting()!.hora" class="header-hora">
          <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>{{ nextMeeting()!.hora }} h</span>
        </div>

        <!-- Título guía -->
        <div *ngIf="programa()!.titulo_guia" class="titulo-guia">
          <svg class="w-3 h-3 shrink-0 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <span>{{ programa()!.titulo_guia }}</span>
        </div>

        <!-- Meta: partes + duración -->
        <div class="header-meta" *ngIf="getPartesPrincipales() > 0">
          <span class="meta-pill">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
              <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
              <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            {{ getPartesPrincipales() }} partes
          </span>
          <span class="meta-pill">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {{ getDuracionTotal() }} min
          </span>
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
        <div class="seccion-block" [style.animation-delay]="(gi * 70 + 60) + 'ms'">

          <!-- Cabecera de sección -->
          <div class="seccion-header" [ngStyle]="getSeccionHeaderStyle(grupo.color)">
            <div class="seccion-icon-wrap" [ngStyle]="{ background: grupo.color }">
              <svg class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path [attr.d]="grupo.iconPath"/>
              </svg>
            </div>
            <span class="seccion-titulo" [ngStyle]="{ color: grupo.color }">{{ grupo.seccion }}</span>
            <div class="seccion-count" [ngStyle]="{ color: grupo.color, background: hexToRgba(grupo.color, 0.1) }">
              {{ grupo.partes.length }}
            </div>
          </div>

          <!-- Partes -->
          <div class="partes-list">
            <ng-container *ngFor="let parte of grupo.partes; let pi = index">
              <div class="parte-card"
                   [class.parte-mia]="parte.esMia || parte.esMiaAyudante"
                   [attr.data-mi-parte]="(parte.esMia || parte.esMiaAyudante) ? 'true' : null"
                   [style.animation-delay]="(gi * 70 + pi * 40 + 100) + 'ms'">

                <!-- Barra lateral de color de sección -->
                <div class="parte-bar"
                     [ngStyle]="{ background: (parte.esMia || parte.esMiaAyudante) ? '#6D28D9' : grupo.color }"></div>

                <div class="parte-content">
                  <!-- Fila superior: orden + nombre + badges + duración -->
                  <div class="parte-top">
                    <!-- Número de orden -->
                    <div class="orden-circle"
                         [ngStyle]="getOrdenStyle(grupo.color, parte.esMia)">
                      {{ parte.principal.orden_visual ?? (pi + 1) }}
                    </div>

                    <!-- Nombre + badges -->
                    <div class="parte-name-wrap">
                      <span class="parte-name">{{ parte.principal.nombre_parte }}</span>
                      <div class="parte-badges">
                        <span *ngIf="parte.esMia" class="badge-tu">
                          <svg class="w-2 h-2" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                          Tú
                        </span>
                        <span *ngIf="parte.principal.aplica_sala_b || parte.principal.sala" class="badge-sala">
                          {{ parte.principal.sala ? 'Sala ' + parte.principal.sala : 'Sala B' }}
                        </span>
                        <span *ngIf="parte.principal.es_reemplazo" class="badge-reemplazo">Reemplazo</span>
                      </div>
                    </div>

                    <!-- Duración -->
                    <div *ngIf="parte.principal.duracion_minutos"
                         class="duracion-badge"
                         [ngStyle]="getDuracionStyle(grupo.color)">
                      {{ parte.principal.duracion_minutos }}<span class="duracion-unit">m</span>
                    </div>
                  </div>

                  <!-- Fuente de información -->
                  <p *ngIf="parte.principal.fuente_informacion" class="fuente-info">
                    {{ parte.principal.fuente_informacion }}
                  </p>

                  <!-- Asignado a -->
                  <div class="asignado-row">
                    <div class="asignado-dot" [ngStyle]="{ background: grupo.color }"></div>

                    <!-- Principal -->
                    <div class="asignado-nombres">
                      <ng-container *ngIf="parte.principal.nombre_completo; else sinAsignar">
                        <span class="asignado-nombre" [class.asignado-mio]="parte.esMia">
                          {{ parte.principal.nombre_completo }}
                        </span>
                      </ng-container>
                      <ng-template #sinAsignar>
                        <span class="sin-asignar">Sin asignar</span>
                      </ng-template>

                      <!-- Ayudante -->
                      <ng-container *ngIf="parte.ayudante">
                        <span class="asignado-separator">·</span>
                        <span class="ayudante-label">con</span>
                        <span class="asignado-nombre" [class.asignado-mio]="parte.esMiaAyudante">
                          {{ parte.ayudante.nombre_completo }}
                        </span>
                        <span *ngIf="parte.esMiaAyudante" class="badge-tu-ayudante">
                          <svg class="w-2 h-2" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
                          Tú
                        </span>
                      </ng-container>
                    </div>
                  </div>

                </div><!-- /parte-content -->
              </div><!-- /parte-card -->
            </ng-container>
          </div><!-- /partes-list -->

        </div><!-- /seccion-block -->
      </ng-container>

      <!-- Pie -->
      <p class="footer-note">Programa confirmado · Solo lectura</p>

    </ng-container>
  </div><!-- /resumen-container -->
</div><!-- /resumen-host -->
  `,
  styles: [`
    /* ──────────────────────────────────────────
       HOST & LAYOUT
    ────────────────────────────────────────── */
    :host { display: block; height: 100%; overflow-y: auto; }

    .resumen-host {
      min-height: 100%;
      background: #f8f9fb;
      padding: 16px 12px 64px;
    }
    :host-context(.dark) .resumen-host { background: #0f172a; }

    .resumen-container {
      width: 100%;
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    @media (min-width: 640px) {
      .resumen-host { padding: 24px 20px 80px; }
      .resumen-container { gap: 12px; }
    }
    @media (min-width: 1024px) {
      .resumen-host { padding: 32px 24px 80px; }
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
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
    }
    :host-context(.dark) .skel-card { background: #1e293b; border-color: rgba(255,255,255,0.07); }

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
      padding: 60px 16px;
      gap: 12px;
    }
    .empty-icon-wrap {
      width: 64px; height: 64px;
      border-radius: 20px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 4px;
    }
    .empty-title {
      font-size: 1.125rem; font-weight: 700;
      color: #0f172a; margin: 0;
    }
    :host-context(.dark) .empty-title { color: #f1f5f9; }
    .empty-body {
      font-size: 0.9375rem; color: #64748b; line-height: 1.6;
      max-width: 320px; margin: 0;
    }
    :host-context(.dark) .empty-body { color: #94a3b8; }
    .empty-date { color: #334155; }
    :host-context(.dark) .empty-date { color: #e2e8f0; }

    /* ──────────────────────────────────────────
       HEADER CARD
    ────────────────────────────────────────── */
    .header-card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    }
    :host-context(.dark) .header-card {
      background: #1e293b;
      border-color: rgba(255,255,255,0.07);
      box-shadow: none;
    }

    .header-top-row {
      display: flex; align-items: center;
      flex-wrap: wrap; gap: 8px;
      margin-bottom: 10px;
    }

    .tipo-badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 4px 10px; border-radius: 999px;
      background: rgba(109,40,217,0.08);
      color: #6D28D9;
      font-size: 0.75rem; font-weight: 700;
    }
    :host-context(.dark) .tipo-badge {
      background: rgba(167,139,250,0.12);
      color: #a78bfa;
    }
    .tipo-icon { width: 14px; height: 14px; }

    .date-badge {
      display: inline-flex; align-items: center;
      padding: 4px 10px; border-radius: 999px;
      font-size: 0.7rem; font-weight: 800;
      letter-spacing: 0.03em;
    }
    .date-hoy {
      background: rgba(16,185,129,0.1); color: #059669;
    }
    .date-manana {
      background: rgba(245,158,11,0.1); color: #d97706;
    }
    .date-pronto {
      background: rgba(59,130,246,0.1); color: #2563eb;
    }
    :host-context(.dark) .date-hoy   { background:rgba(16,185,129,0.15); color:#34d399; }
    :host-context(.dark) .date-manana{ background:rgba(245,158,11,0.15); color:#fbbf24; }
    :host-context(.dark) .date-pronto{ background:rgba(59,130,246,0.15); color:#60a5fa; }

    .header-date {
      font-size: 1.375rem; font-weight: 900;
      color: #0f172a; margin: 0 0 6px;
      line-height: 1.2; letter-spacing: -0.02em;
    }
    :host-context(.dark) .header-date { color: #f1f5f9; }

    @media (min-width: 640px) {
      .header-card { padding: 20px; }
      .header-date { font-size: 1.625rem; }
    }

    .header-hora {
      display: inline-flex; align-items: center; gap: 5px;
      color: #64748b; font-size: 0.875rem; font-weight: 600;
      margin-bottom: 10px;
    }
    :host-context(.dark) .header-hora { color: #94a3b8; }

    .titulo-guia {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 10px; border-radius: 8px;
      background: #f1f5f9; border: 1px solid #e2e8f0;
      color: #475569; font-size: 0.8125rem; font-style: italic;
      margin-bottom: 10px;
    }
    :host-context(.dark) .titulo-guia {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.08);
      color: #94a3b8;
    }

    .header-meta {
      display: flex; flex-wrap: wrap; gap: 6px;
      margin-top: 4px;
    }
    .meta-pill {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 9px; border-radius: 999px;
      background: #f1f5f9; color: #64748b;
      font-size: 0.75rem; font-weight: 600;
    }
    :host-context(.dark) .meta-pill {
      background: rgba(255,255,255,0.06); color: #94a3b8;
    }

    /* ──────────────────────────────────────────
       BANNER MIS PARTES
    ────────────────────────────────────────── */
    .banner-mis-partes {
      display: flex; align-items: flex-start; gap: 12px;
      background: linear-gradient(135deg,#6D28D9 0%,#7c3aed 60%,#8b5cf6 100%);
      border-radius: 14px; padding: 14px 16px;
      animation: slideDown 0.38s cubic-bezier(0.23,1,0.32,1) 0.04s both;
    }
    @keyframes slideDown {
      from { opacity:0; transform:translateY(-10px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .banner-icon-wrap {
      width: 38px; height: 38px; min-width: 38px;
      border-radius: 10px; background: rgba(255,255,255,0.18);
      display: flex; align-items: center; justify-content: center;
    }
    .banner-body { flex: 1; min-width: 0; }
    .banner-title {
      color: #fff; font-size: 0.9375rem; font-weight: 800;
      margin: 0 0 6px; line-height: 1.3;
    }
    @media (min-width: 640px) { .banner-title { font-size: 1rem; } }
    .banner-partes-list {
      display: flex; flex-wrap: wrap; gap: 5px;
    }
    .banner-parte-chip {
      display: inline-block;
      padding: 3px 9px; border-radius: 999px;
      background: rgba(255,255,255,0.2);
      color: rgba(255,255,255,0.95);
      font-size: 0.75rem; font-weight: 600;
    }

    /* ──────────────────────────────────────────
       SECCIÓN
    ────────────────────────────────────────── */
    .seccion-block {
      animation: fadeUp 0.36s cubic-bezier(0.23,1,0.32,1) both;
    }
    @keyframes fadeUp {
      from { opacity:0; transform:translateY(8px); }
      to   { opacity:1; transform:translateY(0); }
    }

    .seccion-header {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px 8px 10px;
      border-radius: 10px 10px 0 0;
      border-bottom: 1px solid rgba(0,0,0,0.06);
      position: sticky; top: 0; z-index: 5;
    }
    :host-context(.dark) .seccion-header {
      border-bottom-color: rgba(255,255,255,0.06);
    }
    .seccion-icon-wrap {
      width: 24px; height: 24px; min-width: 24px;
      border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
    }
    .seccion-titulo {
      flex: 1; font-size: 0.65rem; font-weight: 900;
      text-transform: uppercase; letter-spacing: 0.1em;
      line-height: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .seccion-count {
      width: 20px; height: 20px;
      border-radius: 999px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.65rem; font-weight: 800;
    }

    /* ──────────────────────────────────────────
       LISTA DE PARTES
    ────────────────────────────────────────── */
    .partes-list {
      border-radius: 0 0 12px 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      border-top: none;
    }
    :host-context(.dark) .partes-list { border-color: rgba(255,255,255,0.07); }

    /* ──────────────────────────────────────────
       PARTE CARD
    ────────────────────────────────────────── */
    .parte-card {
      display: flex; align-items: stretch;
      background: #fff;
      border-bottom: 1px solid #f1f5f9;
      animation: fadeUp 0.3s cubic-bezier(0.23,1,0.32,1) both;
      transition: background 160ms ease;
    }
    .parte-card:last-child { border-bottom: none; }
    :host-context(.dark) .parte-card {
      background: #1e293b;
      border-bottom-color: rgba(255,255,255,0.04);
    }
    .parte-card.parte-mia {
      background: rgba(109,40,217,0.04);
    }
    :host-context(.dark) .parte-card.parte-mia {
      background: rgba(109,40,217,0.1);
    }

    .parte-bar {
      width: 3px; min-width: 3px; align-self: stretch;
      flex-shrink: 0;
    }

    .parte-content {
      flex: 1; min-width: 0;
      padding: 12px 12px 12px 10px;
    }
    @media (min-width: 640px) {
      .parte-content { padding: 14px 16px 14px 12px; }
    }

    /* Fila superior */
    .parte-top {
      display: flex; align-items: flex-start; gap: 10px;
      margin-bottom: 6px;
    }

    .orden-circle {
      width: 28px; height: 28px; min-width: 28px;
      border-radius: 999px;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.7rem; font-weight: 800;
      margin-top: 1px; flex-shrink: 0;
    }
    @media (min-width: 640px) {
      .orden-circle { width: 32px; height: 32px; min-width: 32px; font-size: 0.75rem; }
    }

    .parte-name-wrap {
      flex: 1; min-width: 0;
      display: flex; flex-direction: column; gap: 4px;
    }
    .parte-name {
      font-size: 0.9375rem; font-weight: 600;
      color: #1e293b; line-height: 1.3;
    }
    :host-context(.dark) .parte-name { color: #f1f5f9; }
    @media (min-width: 640px) { .parte-name { font-size: 1rem; } }

    .parte-badges {
      display: flex; flex-wrap: wrap; gap: 4px;
    }

    .badge-tu {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 2px 8px; border-radius: 999px;
      background: rgba(109,40,217,0.1);
      color: #6D28D9; border: 1px solid rgba(109,40,217,0.2);
      font-size: 0.7rem; font-weight: 800;
    }
    :host-context(.dark) .badge-tu {
      background: rgba(167,139,250,0.15);
      color: #a78bfa; border-color: rgba(167,139,250,0.25);
    }
    .badge-tu-ayudante {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 2px 8px; border-radius: 999px;
      background: rgba(109,40,217,0.08);
      color: #7c3aed; border: 1px solid rgba(109,40,217,0.15);
      font-size: 0.65rem; font-weight: 700;
    }
    .badge-sala {
      display: inline-flex; align-items: center;
      padding: 2px 8px; border-radius: 999px;
      background: #f1f5f9; color: #64748b;
      font-size: 0.7rem; font-weight: 600;
    }
    :host-context(.dark) .badge-sala { background:rgba(255,255,255,0.08); color:#94a3b8; }
    .badge-reemplazo {
      display: inline-flex; align-items: center;
      padding: 2px 8px; border-radius: 999px;
      background: rgba(245,158,11,0.1); color: #b45309;
      font-size: 0.7rem; font-weight: 600;
    }
    :host-context(.dark) .badge-reemplazo { background:rgba(245,158,11,0.15); color:#fbbf24; }

    /* Duración */
    .duracion-badge {
      flex-shrink: 0;
      display: flex; align-items: baseline; gap: 1px;
      padding: 3px 8px; border-radius: 8px;
      font-size: 0.8rem; font-weight: 800;
      margin-top: 2px;
    }
    @media (min-width: 640px) { .duracion-badge { padding: 4px 10px; } }
    .duracion-unit { font-size: 0.65rem; font-weight: 500; opacity: 0.65; }

    /* Fuente */
    .fuente-info {
      font-size: 0.75rem; font-style: italic;
      color: #94a3b8; margin: 0 0 6px;
      padding-left: 38px;
      line-height: 1.4;
    }
    @media (min-width: 640px) { .fuente-info { padding-left: 42px; } }

    /* Asignado */
    .asignado-row {
      display: flex; align-items: center; gap: 7px;
      flex-wrap: wrap;
    }
    .asignado-dot {
      width: 7px; height: 7px; min-width: 7px;
      border-radius: 999px; flex-shrink: 0;
    }
    .asignado-nombres {
      display: flex; flex-wrap: wrap; align-items: center; gap: 4px;
      min-width: 0;
    }
    .asignado-nombre {
      font-size: 0.875rem; font-weight: 600;
      color: #334155;
    }
    :host-context(.dark) .asignado-nombre { color: #cbd5e1; }
    .asignado-mio { color: #6D28D9 !important; }
    :host-context(.dark) .asignado-mio { color: #a78bfa !important; }
    .sin-asignar {
      font-size: 0.8125rem; color: #94a3b8; font-style: italic;
    }
    .asignado-separator { color: #cbd5e1; font-size: 0.875rem; }
    :host-context(.dark) .asignado-separator { color: #475569; }
    .ayudante-label { font-size: 0.75rem; color: #94a3b8; }

    /* ──────────────────────────────────────────
       PIE
    ────────────────────────────────────────── */
    .footer-note {
      text-align: center; font-size: 0.7rem;
      color: #cbd5e1; margin: 4px 0 0; padding-top: 4px;
    }
    :host-context(.dark) .footer-note { color: #334155; }

    /* ──────────────────────────────────────────
       FADE-IN GENÉRICO
    ────────────────────────────────────────── */
    .fade-in {
      animation: fadeUp 0.35s cubic-bezier(0.23,1,0.32,1) both;
    }

    /* ──────────────────────────────────────────
       REDUCE MOTION
    ────────────────────────────────────────── */
    @media (prefers-reduced-motion: reduce) {
      .banner-mis-partes,
      .seccion-block,
      .parte-card,
      .header-card,
      .fade-in {
        animation: fadeOnly 0.15s ease both;
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

    const rows: ParteRow[] = [];
    for (let i = 0; i < partes.length; i++) {
      if (partes[i].es_ayudante) continue;
      const principal = partes[i];
      const next = partes[i + 1];
      const ayudante = next?.es_ayudante ? next : undefined;
      rows.push({
        principal,
        ayudante,
        esMia: !!userId && principal.id_publicador === userId,
        esMiaAyudante: !!userId && !!ayudante && ayudante.id_publicador === userId,
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

  getSeccionHeaderStyle(color: string): Record<string, string> {
    return {
      background: this.hexToRgba(color, 0.07),
      borderLeft: `3px solid ${color}`,
    };
  }

  getOrdenStyle(color: string, esMia: boolean): Record<string, string> {
    if (esMia) return { background: 'rgba(109,40,217,0.12)', color: '#6D28D9' };
    return { background: this.hexToRgba(color, 0.12), color };
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
