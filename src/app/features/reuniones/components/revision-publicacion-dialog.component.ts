import {
  Component, Input, Output, EventEmitter, ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReunionRecargada } from '../models/reuniones.models';

/**
 * Lo que quedó cargado de más, enseñado justo antes de publicar.
 *
 * No es un error que haya que arreglar: en una congregación pequeña repetir es
 * lo normal, y el umbral que trae cada reunión ya lo tiene en cuenta. Por eso
 * el botón de publicar sigue estando y es el de la derecha —el camino
 * principal—: esto informa, no bloquea.
 */
@Component({
  selector: 'app-revision-publicacion-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      data-testid="dialogo-revision-publicacion"
      class="rev-overlay"
      (click)="onAction(false)"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rev-title"
    >
      <div class="rev-card" (click)="$event.stopPropagation()">

        <div class="rev-header">
          <div class="rev-icon-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div class="rev-header-text">
            <p class="rev-title" id="rev-title">Antes de publicar</p>
            <p class="rev-subtitle">
              {{ totalPersonas }} {{ totalPersonas === 1 ? 'persona lleva' : 'personas llevan' }}
              más de una parte en la misma reunión
            </p>
          </div>
        </div>

        <div class="rev-divider"></div>

        <div class="rev-body">
          @for (reunion of reuniones; track reunion.fecha) {
            <section class="rev-reunion">
              <header class="rev-reunion-head">
                <span class="rev-reunion-fecha">{{ formatFecha(reunion.fecha) }}</span>
                <span class="rev-reunion-meta">
                  {{ reunion.ranuras }} partes · {{ reunion.personas_disponibles }} disponibles
                </span>
              </header>

              @for (persona of reunion.personas; track persona.id_publicador) {
                <div class="rev-persona">
                  <div class="rev-persona-head">
                    <span class="rev-persona-nombre">{{ persona.nombre_completo }}</span>
                    <span class="rev-persona-chip">{{ persona.partes.length }} partes</span>
                  </div>
                  <ul class="rev-lista">
                    @for (parte of persona.partes; track $index) {
                      <li class="rev-item">
                        <span class="rev-punto"></span>
                        <span class="rev-item-body">
                          @if (parte.rol || parte.sala) {
                            <span class="rev-rol">
                              @if (parte.rol) { {{ parte.rol }} }
                              @if (parte.sala) { <span class="rev-sala">{{ parte.sala }}</span> }
                            </span>
                          }
                          <span class="rev-item-text">{{ parte.detalle }}</span>
                        </span>
                      </li>
                    }
                  </ul>
                </div>
              }
            </section>
          }

          <div class="rev-question">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <p>¿Deseas publicar el programa así?</p>
          </div>
        </div>

        <div class="rev-actions">
          <button data-testid="revision-cancelar" class="rev-btn-cancel" (click)="onAction(false)">
            Revisar antes
          </button>
          <button data-testid="revision-aceptar" class="rev-btn-confirm" (click)="onAction(true)">
            Publicar igual
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

    @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes cardIn {
      from { opacity: 0; transform: scale(0.94) translateY(12px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }

    .rev-overlay {
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

    .rev-card {
      width: 100%;
      max-width: 460px;
      max-height: min(80vh, 640px);
      display: flex;
      flex-direction: column;
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
    :host-context(.dark) .rev-card {
      background: #1a1b26;
      border-color: rgba(255,255,255,0.08);
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.04),
        0 8px 24px rgba(0,0,0,0.3),
        0 32px 64px rgba(0,0,0,0.55);
    }

    /* ── Header ── */
    .rev-header {
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      padding: 1.375rem 1.375rem 0;
    }
    .rev-icon-badge {
      flex-shrink: 0;
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.22);
    }
    .rev-icon-badge svg { width: 22px; height: 22px; stroke: #d97706; }
    :host-context(.dark) .rev-icon-badge {
      background: rgba(251, 191, 36, 0.08);
      border-color: rgba(251, 191, 36, 0.2);
    }
    :host-context(.dark) .rev-icon-badge svg { stroke: #fbbf24; }

    .rev-header-text {
      display: flex; flex-direction: column; gap: 2px;
      padding-top: 2px;
      min-width: 0;
    }
    .rev-title {
      font-size: 0.975rem;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      letter-spacing: -0.01em;
    }
    :host-context(.dark) .rev-title { color: #f1f5f9; }
    .rev-subtitle {
      font-size: 0.75rem;
      color: #94a3b8;
      font-weight: 500;
      line-height: 1.4;
    }

    .rev-divider {
      flex-shrink: 0;
      height: 1px;
      background: rgba(0,0,0,0.06);
      margin: 1.125rem 0 0;
    }
    :host-context(.dark) .rev-divider { background: rgba(255,255,255,0.06); }

    /* ── Body ── */
    .rev-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: 1.125rem 1.375rem;
      display: flex; flex-direction: column; gap: 1rem;
    }

    .rev-reunion { display: flex; flex-direction: column; gap: 0.5rem; }

    .rev-reunion-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .rev-reunion-fecha {
      font-size: 0.78rem;
      font-weight: 800;
      color: #0f172a;
      text-transform: capitalize;
    }
    :host-context(.dark) .rev-reunion-fecha { color: #e2e8f0; }
    .rev-reunion-meta {
      flex-shrink: 0;
      font-size: 0.66rem;
      font-weight: 600;
      color: #94a3b8;
      font-variant-numeric: tabular-nums;
    }

    .rev-persona {
      display: flex; flex-direction: column; gap: 0.4rem;
      padding: 0.7rem 0.8rem;
      border-radius: 12px;
      background: rgba(0,0,0,0.025);
      border: 1px solid rgba(0,0,0,0.04);
    }
    :host-context(.dark) .rev-persona {
      background: rgba(255,255,255,0.03);
      border-color: rgba(255,255,255,0.06);
    }

    .rev-persona-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.625rem;
    }
    .rev-persona-nombre {
      font-size: 0.82rem;
      font-weight: 700;
      color: #0f172a;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    :host-context(.dark) .rev-persona-nombre { color: #f1f5f9; }

    .rev-persona-chip {
      flex-shrink: 0;
      font-size: 0.65rem;
      font-weight: 800;
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(245, 158, 11, 0.12);
      color: #b45309;
      font-variant-numeric: tabular-nums;
    }
    :host-context(.dark) .rev-persona-chip {
      background: rgba(251, 191, 36, 0.14);
      color: #fbbf24;
    }

    .rev-lista {
      list-style: none;
      margin: 0; padding: 0;
      display: flex; flex-direction: column; gap: 0.3rem;
    }
    .rev-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }
    .rev-punto {
      flex-shrink: 0;
      width: 4px; height: 4px;
      border-radius: 999px;
      background: #94a3b8;
      margin-top: 0.5rem;
    }
    .rev-item-body {
      display: flex; flex-direction: column; gap: 1px;
      min-width: 0;
    }
    .rev-rol {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.63rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #475569;
    }
    :host-context(.dark) .rev-rol { color: #cbd5e1; }
    .rev-sala {
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(109, 40, 217, 0.1);
      color: #6D28D9;
    }
    :host-context(.dark) .rev-sala {
      background: rgba(196, 181, 253, 0.16);
      color: #c4b5fd;
    }
    .rev-item-text {
      font-size: 0.78rem;
      font-weight: 500;
      color: #334155;
      line-height: 1.4;
    }
    :host-context(.dark) .rev-item-text { color: #cbd5e1; }

    /* ── Pregunta ── */
    .rev-question {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.7rem 0.875rem;
      border-radius: 10px;
      background: rgba(109, 40, 217, 0.04);
      border: 1px solid rgba(109, 40, 217, 0.1);
    }
    :host-context(.dark) .rev-question {
      background: rgba(109, 40, 217, 0.07);
      border-color: rgba(109, 40, 217, 0.18);
    }
    .rev-question svg {
      flex-shrink: 0;
      width: 15px; height: 15px;
      stroke: #6D28D9;
      margin-top: 1px;
    }
    :host-context(.dark) .rev-question svg { stroke: #a78bfa; }
    .rev-question p {
      font-size: 0.78rem;
      font-weight: 600;
      color: #5b21b6;
      line-height: 1.5;
    }
    :host-context(.dark) .rev-question p { color: #a78bfa; }

    /* ── Actions ── */
    .rev-actions {
      flex-shrink: 0;
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      padding: 0.875rem 1.375rem 1.375rem;
      border-top: 1px solid rgba(0,0,0,0.05);
    }
    :host-context(.dark) .rev-actions { border-top-color: rgba(255,255,255,0.05); }

    .rev-btn-cancel,
    .rev-btn-confirm {
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
    .rev-btn-cancel:active,
    .rev-btn-confirm:active { transform: scale(0.96); }

    .rev-btn-cancel {
      background: rgba(0,0,0,0.04);
      border-color: rgba(0,0,0,0.08);
      color: #475569;
    }
    .rev-btn-cancel:hover { background: rgba(0,0,0,0.07); }
    :host-context(.dark) .rev-btn-cancel {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.1);
      color: #94a3b8;
    }
    :host-context(.dark) .rev-btn-cancel:hover { background: rgba(255,255,255,0.09); }

    .rev-btn-confirm {
      background: #6D28D9;
      color: white;
      box-shadow: 0 2px 10px rgba(109,40,217,0.35), 0 1px 3px rgba(109,40,217,0.2);
    }
    .rev-btn-confirm:hover {
      background: #5b21b6;
      box-shadow: 0 4px 16px rgba(109,40,217,0.45), 0 2px 6px rgba(109,40,217,0.25);
    }
  `],
})
export class RevisionPublicacionDialogComponent {
  @Input() reuniones: ReunionRecargada[] = [];
  @Output() resolved = new EventEmitter<boolean>();

  get totalPersonas(): number {
    return this.reuniones.reduce((n, r) => n + r.personas.length, 0);
  }

  formatFecha(fecha: string): string {
    try {
      const [y, m, d] = fecha.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
        weekday: 'long', day: 'numeric', month: 'long',
      });
    } catch {
      return fecha;
    }
  }

  onAction(accept: boolean): void {
    this.resolved.emit(accept);
  }
}
