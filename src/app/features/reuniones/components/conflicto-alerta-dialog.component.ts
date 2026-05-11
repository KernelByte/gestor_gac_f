import {
  Component, signal, Input, Output, EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConflictoAsignacion } from '../services/conflictos.service';

const TIPO_LABEL: Record<string, string> = {
  entre_semana:     'Entre semana',
  fin_semana:       'Fin de semana',
  logistica:        'Logística',
  discurso_saliente:'Discurso saliente',
};

const TIPO_COLOR: Record<string, string> = {
  entre_semana:     '#6D28D9',
  fin_semana:       '#0369a1',
  logistica:        '#0891b2',
  discurso_saliente:'#7c3aed',
};

@Component({
  selector: 'app-conflicto-alerta-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Overlay -->
    <div
      class="conflicto-overlay"
      (click)="onAction(false)"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflicto-title"
    >
      <!-- Card -->
      <div class="conflicto-card" (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="conflicto-header">
          <div class="conflicto-icon-badge">
            <!-- Warning triangle -->
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div class="conflicto-header-text">
            <p class="conflicto-title" id="conflicto-title">Conflicto de asignación</p>
            <p class="conflicto-subtitle">Se detectaron asignaciones existentes</p>
          </div>
        </div>

        <!-- Divider -->
        <div class="conflicto-divider"></div>

        <!-- Body -->
        <div class="conflicto-body">
          <p class="conflicto-desc">
            <span class="conflicto-nombre">{{ nombre }}</span>
            ya tiene la{{ asignaciones.length === 1 ? '' : 's' }} siguiente{{ asignaciones.length === 1 ? '' : 's' }}
            asignación{{ asignaciones.length === 1 ? '' : 'es' }}
            el <span class="conflicto-fecha">{{ fechaFormateada }}</span>:
          </p>

          <ul class="conflicto-list">
            @for (a of asignaciones; track a.tipo + a.detalle) {
              <li class="conflicto-item">
                <span class="conflicto-badge" [style.background]="badgeBg(a.tipo)" [style.color]="badgeColor(a.tipo)">
                  {{ tipoLabel(a.tipo) }}
                </span>
                <span class="conflicto-item-text">{{ a.detalle }}</span>
              </li>
            }
          </ul>

          <div class="conflicto-question">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p>¿Deseas asignar a esta persona de todas formas?</p>
          </div>
        </div>

        <!-- Actions -->
        <div class="conflicto-actions">
          <button class="conflicto-btn-cancel" (click)="onAction(false)">
            Cancelar
          </button>
          <button class="conflicto-btn-confirm" (click)="onAction(true)">
            Asignar igualmente
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host {
      --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
      display: block;
    }

    @keyframes overlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes cardIn {
      from { opacity: 0; transform: scale(0.94) translateY(12px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }

    .conflicto-overlay {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      animation: overlayIn 180ms ease;
    }

    .conflicto-card {
      width: 100%;
      max-width: 420px;
      border-radius: 20px;
      background: white;
      border: 1px solid rgba(0, 0, 0, 0.06);
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.03),
        0 8px 24px rgba(0,0,0,0.08),
        0 32px 64px rgba(0,0,0,0.14);
      animation: cardIn 240ms var(--ease-out-expo);
      overflow: hidden;
    }

    :host-context(.dark) .conflicto-card {
      background: #1a1b26;
      border-color: rgba(255,255,255,0.08);
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.04),
        0 8px 24px rgba(0,0,0,0.3),
        0 32px 64px rgba(0,0,0,0.55);
    }

    /* ── Header ── */
    .conflicto-header {
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      padding: 1.375rem 1.375rem 0;
    }

    .conflicto-icon-badge {
      flex-shrink: 0;
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.22);
    }
    .conflicto-icon-badge svg {
      width: 22px; height: 22px;
      stroke: #d97706;
    }
    :host-context(.dark) .conflicto-icon-badge {
      background: rgba(251, 191, 36, 0.08);
      border-color: rgba(251, 191, 36, 0.2);
    }
    :host-context(.dark) .conflicto-icon-badge svg {
      stroke: #fbbf24;
    }

    .conflicto-header-text {
      display: flex; flex-direction: column; gap: 2px;
      padding-top: 2px;
    }
    .conflicto-title {
      font-size: 0.975rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      letter-spacing: -0.01em;
    }
    :host-context(.dark) .conflicto-title { color: #f1f5f9; }

    .conflicto-subtitle {
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: 500;
    }

    /* ── Divider ── */
    .conflicto-divider {
      height: 1px;
      background: rgba(0,0,0,0.06);
      margin: 1.125rem 0 0;
    }
    :host-context(.dark) .conflicto-divider {
      background: rgba(255,255,255,0.06);
    }

    /* ── Body ── */
    .conflicto-body {
      padding: 1.125rem 1.375rem;
      display: flex; flex-direction: column; gap: 0.875rem;
    }

    .conflicto-desc {
      font-size: 0.82rem;
      line-height: 1.6;
      color: #475569;
    }
    :host-context(.dark) .conflicto-desc { color: #94a3b8; }

    .conflicto-nombre {
      font-weight: 700;
      color: #0f172a;
    }
    :host-context(.dark) .conflicto-nombre { color: #e2e8f0; }

    .conflicto-fecha {
      font-weight: 700;
      color: #0f172a;
    }
    :host-context(.dark) .conflicto-fecha { color: #e2e8f0; }

    /* ── Lista de conflictos ── */
    .conflicto-list {
      list-style: none;
      margin: 0; padding: 0;
      display: flex; flex-direction: column; gap: 0.5rem;
    }

    .conflicto-item {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.6rem 0.75rem;
      border-radius: 10px;
      background: rgba(0,0,0,0.025);
      border: 1px solid rgba(0,0,0,0.04);
    }
    :host-context(.dark) .conflicto-item {
      background: rgba(255,255,255,0.03);
      border-color: rgba(255,255,255,0.06);
    }

    .conflicto-badge {
      flex-shrink: 0;
      font-size: 0.68rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }

    .conflicto-item-text {
      font-size: 0.8rem;
      font-weight: 500;
      color: #334155;
      line-height: 1.4;
    }
    :host-context(.dark) .conflicto-item-text { color: #cbd5e1; }

    /* ── Pregunta ── */
    .conflicto-question {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.7rem 0.875rem;
      border-radius: 10px;
      background: rgba(109, 40, 217, 0.04);
      border: 1px solid rgba(109, 40, 217, 0.1);
    }
    :host-context(.dark) .conflicto-question {
      background: rgba(109, 40, 217, 0.07);
      border-color: rgba(109, 40, 217, 0.18);
    }
    .conflicto-question svg {
      flex-shrink: 0;
      width: 15px; height: 15px;
      stroke: #6D28D9;
      margin-top: 1px;
    }
    :host-context(.dark) .conflicto-question svg { stroke: #a78bfa; }
    .conflicto-question p {
      font-size: 0.78rem;
      font-weight: 600;
      color: #5b21b6;
      line-height: 1.5;
    }
    :host-context(.dark) .conflicto-question p { color: #a78bfa; }

    /* ── Actions ── */
    .conflicto-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      padding: 0.875rem 1.375rem 1.375rem;
      border-top: 1px solid rgba(0,0,0,0.05);
    }
    :host-context(.dark) .conflicto-actions {
      border-top-color: rgba(255,255,255,0.05);
    }

    .conflicto-btn-cancel,
    .conflicto-btn-confirm {
      height: 38px;
      padding: 0 1.125rem;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 130ms cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .conflicto-btn-cancel:active,
    .conflicto-btn-confirm:active {
      transform: scale(0.96);
    }

    .conflicto-btn-cancel {
      background: rgba(0,0,0,0.04);
      border-color: rgba(0,0,0,0.08);
      color: #475569;
    }
    .conflicto-btn-cancel:hover {
      background: rgba(0,0,0,0.07);
    }
    :host-context(.dark) .conflicto-btn-cancel {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.1);
      color: #94a3b8;
    }
    :host-context(.dark) .conflicto-btn-cancel:hover {
      background: rgba(255,255,255,0.09);
    }

    .conflicto-btn-confirm {
      background: #6D28D9;
      color: white;
      box-shadow: 0 2px 10px rgba(109,40,217,0.35), 0 1px 3px rgba(109,40,217,0.2);
    }
    .conflicto-btn-confirm:hover {
      background: #5b21b6;
      box-shadow: 0 4px 16px rgba(109,40,217,0.45), 0 2px 6px rgba(109,40,217,0.25);
    }
  `],
})
export class ConflictoAlertaDialogComponent {
  @Input() nombre = '';
  @Input() fecha = '';
  @Input() asignaciones: ConflictoAsignacion[] = [];
  @Output() resolved = new EventEmitter<boolean>();

  get fechaFormateada(): string {
    if (!this.fecha) return this.fecha;
    try {
      const [y, m, d] = this.fecha.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
    } catch {
      return this.fecha;
    }
  }

  tipoLabel(tipo: string): string {
    return TIPO_LABEL[tipo] ?? tipo;
  }

  badgeBg(tipo: string): string {
    const hex = TIPO_COLOR[tipo] ?? '#6D28D9';
    return `${hex}18`;
  }

  badgeColor(tipo: string): string {
    return TIPO_COLOR[tipo] ?? '#6D28D9';
  }

  onAction(accept: boolean): void {
    this.resolved.emit(accept);
  }
}
