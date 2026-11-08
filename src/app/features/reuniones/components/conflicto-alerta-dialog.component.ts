import {
  Component, signal, Input, Output, EventEmitter,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ConflictoAsignacion } from '../services/conflictos.service';

const TIPO_LABEL: Record<string, string> = {
  entre_semana:     'Entre semana',
  fin_semana:       'Fin de semana',
  logistica:        'Logística',
  discurso_saliente:'Discurso saliente',
  exhibidor:        'Exhibidor',
  ausencia:         'Ausencia',
};

const TIPO_COLOR: Record<string, string> = {
  entre_semana:     'var(--color-brand-purple)',
  fin_semana:       '#0369a1',
  logistica:        '#0891b2',
  discurso_saliente:'#7c3aed',
  exhibidor:        '#165cfc',
  // Ámbar, no uno de los tonos de agenda: una ausencia no es una doble-reserva.
  ausencia:         '#d97706',
};

@Component({
  selector: 'app-conflicto-alerta-dialog',
  standalone: true,
  imports: [CommonModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="true" size="md" [padding]="false" [hasFooter]="true" [closeOnBackdrop]="true" testId="dialogo-conflicto" (closed)="onAction(false)">
      <div>

        <!-- Cabecera -->
        <div class="conflicto-header">
          <div class="conflicto-icon-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div class="conflicto-header-text">
            <h2 class="conflicto-title" id="conflicto-title">{{ sinVerificar ? 'No se pudo comprobar la agenda' : soloAusencia ? 'Publicador ausente' : 'Conflicto de asignación' }}</h2>
            <p class="conflicto-subtitle">{{ sinVerificar ? 'No hubo respuesta del servidor' : soloAusencia ? 'Tiene una ausencia registrada en esta fecha' : 'Se detectaron asignaciones existentes' }}</p>
          </div>
        </div>

        <!-- Body -->
        <div class="conflicto-body">
          @if (sinVerificar) {
            <p class="conflicto-desc">
              No se pudo comprobar si
              <span class="conflicto-nombre">{{ nombre }}</span>
              ya tiene otra asignación el <span class="conflicto-fecha">{{ fechaFormateada }}</span>.
              Revisa tu conexión o asígnale igualmente si estás seguro.
            </p>
          } @else if (soloAusencia) {
            <p class="conflicto-desc">
              <span class="conflicto-nombre">{{ nombre }}</span>
              tiene una ausencia registrada
              el <span class="conflicto-fecha">{{ fechaFormateada }}</span>:
            </p>
          } @else {
            <p class="conflicto-desc">
              <span class="conflicto-nombre">{{ nombre }}</span>
              ya tiene la{{ asignaciones.length === 1 ? '' : 's' }} siguiente{{ asignaciones.length === 1 ? '' : 's' }}
              asignación{{ asignaciones.length === 1 ? '' : 'es' }}
              el <span class="conflicto-fecha">{{ fechaFormateada }}</span>:
            </p>
          }

          <ul class="conflicto-list">
            @for (a of asignaciones; track a.tipo + a.detalle) {
              <li class="conflicto-item">
                <span class="conflicto-badge" [style.background]="badgeBg(a.tipo)" [style.color]="badgeColor(a.tipo)">
                  {{ tipoLabel(a.tipo) }}
                </span>
                <span class="conflicto-item-body">
                  @if (a.rol || a.sala) {
                    <span class="conflicto-rol">
                      @if (a.rol) { {{ a.rol }} }
                      @if (a.sala) { <span class="conflicto-sala">{{ a.sala }}</span> }
                    </span>
                  }
                  <span class="conflicto-item-text">{{ a.detalle }}</span>
                </span>
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

      </div>
      <ng-container slot="footer">
        <button type="button" data-testid="conflicto-cancelar" class="btn-secondary" (click)="onAction(false)">Cancelar</button>
        <button type="button" data-testid="conflicto-aceptar" class="btn-primary" (click)="onAction(true)">Asignar igualmente</button>
      </ng-container>
    </app-modal>
  `,
  styles: [`
    :host { display: contents; }

    /* ── Header ── */
    .conflicto-header {
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      padding: 1.375rem 1.375rem 1.125rem;
      border-bottom: 1px solid rgba(0,0,0,0.06);
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

    /* ── Body ── */
    .conflicto-body {
      padding: 1.125rem 1.375rem;
      display: flex; flex-direction: column; gap: 0.875rem;
    }

    .conflicto-desc {
      font-size: 0.875rem;
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
      align-items: flex-start;
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
      font-size: 0.75rem;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      letter-spacing: 0.01em;
      white-space: nowrap;
    }

    /* El badge de tipo ya lleva color; el papel se distingue por peso y caja
       alta para no competir con el. */
    .conflicto-item-body {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
    }

    .conflicto-rol {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      font-size: 0.75rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #0f172a;
    }
    :host-context(.dark) .conflicto-rol { color: #f1f5f9; }

    .conflicto-sala {
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0;
      text-transform: none;
      padding: 1px 6px;
      border-radius: 999px;
      background: color-mix(in oklab, var(--color-brand-purple) 10%, transparent);
      color: var(--color-brand-purple);
    }
    :host-context(.dark) .conflicto-sala {
      background: rgba(196, 181, 253, 0.16);
      color: #c4b5fd;
    }

    .conflicto-item-text {
      font-size: 0.875rem;
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
      background: color-mix(in oklab, var(--color-brand-purple) 4%, transparent);
      border: 1px solid color-mix(in oklab, var(--color-brand-purple) 10%, transparent);
    }
    :host-context(.dark) .conflicto-question {
      background: color-mix(in oklab, var(--color-brand-purple) 7%, transparent);
      border-color: color-mix(in oklab, var(--color-brand-purple) 18%, transparent);
    }
    .conflicto-question svg {
      flex-shrink: 0;
      width: 15px; height: 15px;
      stroke: var(--color-brand-purple);
      margin-top: 1px;
    }
    :host-context(.dark) .conflicto-question svg { stroke: #a78bfa; }
    .conflicto-question p {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--color-brand-purple);
      line-height: 1.5;
    }
    :host-context(.dark) .conflicto-question p { color: #a78bfa; }

  `],
})
export class ConflictoAlertaDialogComponent {
  @Input() nombre = '';
  @Input() fecha = '';
  @Input() asignaciones: ConflictoAsignacion[] = [];
  /** La consulta de conflictos falló: no se sabe si hay choque, y se dice así. */
  @Input() sinVerificar = false;
  @Output() resolved = new EventEmitter<boolean>();

  /** True cuando el único "conflicto" detectado es una ausencia registrada. */
  get soloAusencia(): boolean {
    return this.asignaciones.length > 0 && this.asignaciones.every((a) => a.tipo === 'ausencia');
  }

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
    const color = TIPO_COLOR[tipo] ?? 'var(--color-brand-purple)';
    return `color-mix(in oklab, ${color} 9%, transparent)`;
  }

  badgeColor(tipo: string): string {
    return TIPO_COLOR[tipo] ?? 'var(--color-brand-purple)';
  }

  onAction(accept: boolean): void {
    this.resolved.emit(accept);
  }
}
