import { Component, EventEmitter, Input, Output, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgendaItem, AgendaSecciones, SeccionFila } from '../../models/visita.model';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { TimePickerComponent } from '../../../../shared/components/time-picker/time-picker.component';
import { SelectPickerComponent } from '../../../../shared/components/select-picker/select-picker.component';
import { SECCIONES_CONFIG, SeccionConfig } from './agenda-secciones.config';

/**
 * Editor de la agenda de la Visita del Superintendente: tabla de programación
 * + secciones del formulario en papel (acordeón). Compartido entre la pantalla
 * del secretario y la del colaborador.
 *
 * El componente edita los arreglos in-place y emite (changed) en cada
 * modificación; el contenedor conserva la propiedad de los datos y decide
 * cuándo guardar (arma el AgendaRequest y llama al servicio).
 */
@Component({
  standalone: true,
  selector: 'app-agenda-editor',
  imports: [CommonModule, FormsModule, DatePickerComponent, TimePickerComponent, SelectPickerComponent],
  template: `
    <div class="space-y-4">
      <div class="agenda-section-head">
        <h3>Programación</h3>
        <p>Reuniones y actividades principales de la semana de visita.</p>
      </div>
      <div class="hidden md:grid grid-cols-[1.4fr_0.75fr_0.75fr_1.4fr_1fr_1fr_auto] gap-2 px-2 text-[0.65rem] uppercase tracking-wider font-bold text-slate-400">
        <span>Fecha</span><span>Inicio</span><span>Fin</span><span>Actividad</span><span>Lugar</span><span>Responsable</span><span></span>
      </div>
      <div class="space-y-2" #agendaList>
        @for (it of items; track $index; let i = $index) {
          <div class="agenda-row group" [style.--stagger]="i * 30 + 'ms'">

            <!-- Móvil: card vertical -->
            <div class="md:hidden bg-slate-50 dark:bg-slate-800/40 rounded-xl p-3 space-y-2 border border-slate-200 dark:border-slate-700">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[0.65rem] uppercase tracking-wider font-bold text-slate-400">Fila #{{ i + 1 }}</span>
                <button (click)="eliminarFila(i)" class="btn-danger-ghost" aria-label="Quitar fila">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
                </button>
              </div>
              <label class="form-label">
                <span>Día</span>
                <app-date-picker
                  [(ngModel)]="it.dia"
                  (ngModelChange)="emitChanged()"
                  colorScheme="violet"
                  [fieldLike]="true"
                  [inlineOnMobile]="true"
                  placeholder="Seleccionar fecha">
                </app-date-picker>
              </label>
              <div class="grid grid-cols-2 gap-2">
                <label class="form-label">
                  <span>Hora inicio</span>
                  <app-time-picker [(ngModel)]="it.hora_inicio" (ngModelChange)="emitChanged()" colorScheme="violet" placeholder="Hora inicio"></app-time-picker>
                </label>
                <label class="form-label">
                  <span>Hora fin</span>
                  <app-time-picker [(ngModel)]="it.hora_fin" (ngModelChange)="emitChanged()" colorScheme="violet" placeholder="Hora fin"></app-time-picker>
                </label>
              </div>
              <label class="form-label"><span>Actividad</span><input class="field" placeholder="ej. Discurso público" [(ngModel)]="it.actividad" (ngModelChange)="emitChanged()" /></label>
              <label class="form-label"><span>Lugar</span><input class="field" placeholder="ej. Salón principal" [(ngModel)]="it.lugar" (ngModelChange)="emitChanged()" /></label>
              <label class="form-label"><span>Responsable</span><input class="field" placeholder="Nombre del responsable" [(ngModel)]="it.responsable" (ngModelChange)="emitChanged()" /></label>
            </div>

            <!-- Desktop: fila en grid -->
            <div class="hidden md:grid grid-cols-[1.4fr_0.75fr_0.75fr_1.4fr_1fr_1fr_auto] gap-2">
              <app-date-picker
                [(ngModel)]="it.dia"
                (ngModelChange)="emitChanged()"
                colorScheme="violet"
                [fieldLike]="true"
                placeholder="Fecha">
              </app-date-picker>
              <app-time-picker [(ngModel)]="it.hora_inicio" (ngModelChange)="emitChanged()" colorScheme="violet" placeholder="Inicio"></app-time-picker>
              <app-time-picker [(ngModel)]="it.hora_fin" (ngModelChange)="emitChanged()" colorScheme="violet" placeholder="Fin"></app-time-picker>
              <input class="field" placeholder="Actividad" [(ngModel)]="it.actividad" (ngModelChange)="emitChanged()" />
              <input class="field" placeholder="Lugar" [(ngModel)]="it.lugar" (ngModelChange)="emitChanged()" />
              <input class="field" placeholder="Responsable" [(ngModel)]="it.responsable" (ngModelChange)="emitChanged()" />
              <button (click)="eliminarFila(i)" class="btn-danger-ghost self-center" aria-label="Quitar fila">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
              </button>
            </div>

          </div>
        }
      </div>
      <button (click)="agregarFila()" class="add-row-btn">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
        Agregar fila
      </button>

      <!-- ── Secciones adicionales (formulario de la visita) ── -->
      <div class="agenda-section-head pt-2">
        <h3>Detalles de la visita</h3>
        <p>Las mismas secciones del formulario en papel. Completa solo las que necesites; las secciones con datos se incluyen en la agenda generada.</p>
      </div>

      <div class="space-y-2">
        @for (sec of seccionesConfig; track sec.id) {
          <div class="sec-card" [class.is-open]="seccionAbierta() === sec.id">
            <button type="button" class="sec-toggle" (click)="toggleSeccion(sec.id)"
                    [attr.aria-expanded]="seccionAbierta() === sec.id">
              <div class="min-w-0 text-left">
                <span class="sec-label">
                  {{ sec.label }}
                  @if (filasConDatos(sec.id); as n) {
                    <span class="sec-badge">{{ n }}</span>
                  }
                </span>
                <span class="sec-desc">{{ sec.desc }}</span>
              </div>
              <svg class="sec-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            @if (seccionAbierta() === sec.id) {
              <div class="sec-body">
                @for (fila of filasDe(sec.id); track $index; let i = $index) {
                  <div class="sec-row">
                    <div class="sec-row-head">
                      <span class="sec-row-num">#{{ i + 1 }}</span>
                      <button (click)="eliminarFilaSeccion(sec.id, i)" class="btn-danger-ghost" aria-label="Quitar fila">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
                      </button>
                    </div>
                    <div class="sec-fields">
                      @for (f of sec.fields; track f.key) {
                        <label class="form-label">
                          <span>{{ f.label }}</span>
                          @if (f.type === 'select') {
                            <app-select-picker
                              [ngModel]="fila[f.key]"
                              (ngModelChange)="setCampoSeccion(fila, f.key, $event)"
                              colorScheme="violet"
                              [options]="f.options || []"
                              [placeholder]="f.placeholder || 'Seleccionar'">
                            </app-select-picker>
                          } @else if (f.type === 'time') {
                            <app-time-picker
                              [ngModel]="fila[f.key]"
                              (ngModelChange)="setCampoSeccion(fila, f.key, $event)"
                              colorScheme="violet"
                              [placeholder]="f.placeholder || 'Hora'">
                            </app-time-picker>
                          } @else {
                            <input class="field"
                                   [type]="f.type"
                                   [attr.inputmode]="f.type === 'tel' ? 'tel' : null"
                                   [placeholder]="f.placeholder || ''"
                                   [ngModel]="fila[f.key]"
                                   (ngModelChange)="setCampoSeccion(fila, f.key, $event)" />
                          }
                        </label>
                      }
                    </div>
                  </div>
                } @empty {
                  <p class="sec-empty">Sin registros. Agrega la primera fila.</p>
                }
                <button (click)="agregarFilaSeccion(sec)" class="add-row-btn">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
                  Agregar fila
                </button>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --brand-purple: #6D28D9;
      --border-light: #e2e8f0;
      --border-dark: #334155;
      --bg-light: #ffffff;
      --bg-dark: #1e293b;
      --text-light: #1e293b;
      --text-dark: #f1f5f9;
      /* Los popups de fecha/hora se posicionan absolute dentro de las filas */
      overflow: visible;
    }

    @keyframes cardIn { from { opacity: 0; transform: translateY(4px) scale(0.99); } to { opacity: 1; transform: none; } }
    @keyframes rowIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

    /* ───── Inputs / Campos ───── */
    .field {
      width: 100%;
      border: 1px solid var(--border-light);
      background: var(--bg-light);
      border-radius: 0.625rem;
      padding: 0.5rem 0.75rem;
      font-size: 1rem;
      color: var(--text-light);
      transition: border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
    }
    @media (min-width: 768px) {
      .field { font-size: 0.875rem; }
    }
    .field:focus {
      outline: none;
      border-color: var(--brand-purple);
      box-shadow: 0 0 0 3px rgba(109, 40, 217, 0.12);
    }
    :host-context(.dark) .field { background: var(--bg-dark); border-color: var(--border-dark); color: var(--text-dark); }
    :host-context(.dark) .field:focus { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167, 139, 250, 0.18); }
    .field::placeholder { color: #94a3b8; font-style: italic; }
    :host-context(.dark) .field::placeholder { color: #475569; }

    .form-label { display: block; font-size: 0.75rem; }
    .form-label > span:first-child { display: flex; align-items: center; gap: 0.375rem; color: #475569; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.8125rem; }
    :host-context(.dark) .form-label > span:first-child { color: #cbd5e1; }

    /* ───── Botones ───── */
    .btn-danger-ghost {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.375rem 0.625rem; font-size: 0.75rem; font-weight: 500;
      border-radius: 0.625rem; color: #f43f5e;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out);
      cursor: pointer; user-select: none;
    }
    @media (max-width: 767px) {
      .btn-danger-ghost { min-height: 2.75rem; min-width: 2.75rem; justify-content: center; }
    }
    @media (hover: hover) and (pointer: fine) {
      .btn-danger-ghost:hover { background: rgba(244,63,94,0.08); }
    }
    .btn-danger-ghost:active { transform: scale(0.97); }

    .add-row-btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.875rem; font-size: 0.8125rem; font-weight: 500;
      color: var(--brand-purple); border: 1px dashed #c4b5fd; border-radius: 0.625rem; background: transparent;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), border-color 160ms var(--ease-out);
      cursor: pointer;
    }
    .add-row-btn:active { transform: scale(0.97); }
    @media (hover: hover) { .add-row-btn:hover { background: #faf5ff; border-color: var(--brand-purple); } }
    :host-context(.dark) .add-row-btn { color: #c4b5fd; border-color: var(--brand-purple); }
    :host-context(.dark) .add-row-btn:hover { background: rgba(109,40,217,0.12); }

    /* ───── Filas de programación ───── */
    .agenda-row {
      animation: rowIn 280ms var(--ease-out) both;
      animation-delay: var(--stagger, 0ms);
      overflow: visible;
    }

    /* ───── Encabezados de sección ───── */
    .agenda-section-head h3 {
      font-size: 0.9375rem; font-weight: 700; color: #1e293b; letter-spacing: -0.01em;
    }
    :host-context(.dark) .agenda-section-head h3 { color: #f1f5f9; }
    .agenda-section-head p {
      font-size: 0.75rem; color: #64748b; margin-top: 0.125rem; line-height: 1.45;
    }
    :host-context(.dark) .agenda-section-head p { color: #94a3b8; }

    /* ───── Secciones (acordeón del formulario) ───── */
    .sec-card {
      border: 1px solid var(--border-light); border-radius: 0.875rem;
      background: var(--bg-light);
      /* Sin overflow:hidden — recortaría el popup del selector de hora/fecha.
         Las esquinas se redondean en .sec-toggle / .sec-body en su lugar. */
      transition: border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
    }
    :host-context(.dark) .sec-card { background: #1e293b; border-color: var(--border-dark); }
    .sec-card.is-open {
      border-color: #c4b5fd;
      box-shadow: 0 4px 12px -4px rgba(109,40,217,0.12);
    }
    :host-context(.dark) .sec-card.is-open { border-color: var(--brand-purple); }

    .sec-toggle {
      width: 100%; display: flex; align-items: center; justify-content: space-between;
      gap: 0.75rem; padding: 0.75rem 1rem; min-height: 2.75rem;
      background: transparent; cursor: pointer; text-align: left;
      border-radius: 0.875rem 0.875rem 0 0;
      transition: background 140ms var(--ease-out);
    }
    .sec-card:not(.is-open) .sec-toggle { border-radius: 0.875rem; }
    @media (hover: hover) {
      .sec-toggle:hover { background: rgba(109,40,217,0.04); }
      :host-context(.dark) .sec-toggle:hover { background: rgba(167,139,250,0.06); }
    }

    .sec-label {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.8125rem; font-weight: 600; color: #334155;
    }
    :host-context(.dark) .sec-label { color: #e2e8f0; }
    .sec-desc {
      display: block; font-size: 0.6875rem; color: #94a3b8; margin-top: 0.125rem; line-height: 1.35;
    }
    :host-context(.dark) .sec-desc { color: #64748b; }

    .sec-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 1.25rem; height: 1.25rem; padding: 0 0.375rem;
      border-radius: 9999px; background: var(--brand-purple); color: #fff;
      font-size: 0.65rem; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    :host-context(.dark) .sec-badge { background: #a78bfa; color: #1e293b; }

    .sec-chevron {
      width: 1rem; height: 1rem; flex-shrink: 0; color: #94a3b8;
      transition: transform 200ms var(--ease-out);
    }
    .sec-card.is-open .sec-chevron { transform: rotate(180deg); color: var(--brand-purple); }
    :host-context(.dark) .sec-card.is-open .sec-chevron { color: #a78bfa; }

    .sec-body {
      padding: 0.75rem 1rem 1rem;
      border-top: 1px solid #f1f5f9;
      border-radius: 0 0 0.875rem 0.875rem;
      display: flex; flex-direction: column; gap: 0.75rem;
      animation: cardIn 220ms var(--ease-out) both;
    }
    :host-context(.dark) .sec-body { border-top-color: #334155; }

    .sec-row {
      border: 1px solid var(--border-light); border-radius: 0.75rem;
      padding: 0.625rem 0.75rem 0.75rem;
      background: #f8fafc;
    }
    :host-context(.dark) .sec-row { background: rgba(15,23,42,0.4); border-color: var(--border-dark); }
    .sec-row-head {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.375rem;
    }
    .sec-row-num {
      font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em;
      font-weight: 700; color: #94a3b8;
    }

    .sec-fields {
      display: grid; gap: 0.625rem;
      grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    }
    @media (max-width: 479px) {
      .sec-fields { grid-template-columns: 1fr; }
    }

    .sec-empty {
      font-size: 0.75rem; color: #94a3b8; font-style: italic; padding: 0.25rem 0.125rem;
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `],
})
export class AgendaEditorComponent {
  /** Filas de programación — el componente las edita in-place. */
  @Input() items: AgendaItem[] = [];
  /** Secciones adicionales — el componente edita las listas in-place. */
  @Input() secciones: AgendaSecciones = {};
  /** Emitido en cada modificación (para marcar "cambios sin guardar"). */
  @Output() changed = new EventEmitter<void>();

  @ViewChild('agendaList') agendaListRef?: ElementRef<HTMLElement>;

  seccionesConfig = SECCIONES_CONFIG;
  seccionAbierta = signal<string | null>(null);

  emitChanged() {
    this.changed.emit();
  }

  // ── Programación ──

  agregarFila() {
    this.items.push({ dia: '', actividad: '' });
    this.emitChanged();
    // Scroll automático a la nueva fila después de que Angular la renderice
    setTimeout(() => {
      const list = this.agendaListRef?.nativeElement;
      if (list) {
        const lastRow = list.lastElementChild as HTMLElement | null;
        lastRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        const firstInput = lastRow?.querySelector('input, button.dp-trigger') as HTMLElement | null;
        firstInput?.focus();
      }
    }, 60);
  }

  eliminarFila(i: number) {
    this.items.splice(i, 1);
    this.emitChanged();
  }

  // ── Secciones ──

  toggleSeccion(id: string) {
    this.seccionAbierta.update(cur => (cur === id ? null : id));
  }

  filasDe(id: string): SeccionFila[] {
    return this.secciones[id] ?? [];
  }

  filasConDatos(id: string): number {
    return this.filasDe(id).filter(f => Object.values(f).some(v => (v ?? '').toString().trim())).length;
  }

  agregarFilaSeccion(sec: SeccionConfig) {
    const fila: SeccionFila = {};
    sec.fields.forEach(f => (fila[f.key] = ''));
    if (!this.secciones[sec.id]) this.secciones[sec.id] = [];
    this.secciones[sec.id].push(fila);
    this.emitChanged();
  }

  eliminarFilaSeccion(id: string, i: number) {
    this.secciones[id]?.splice(i, 1);
    this.emitChanged();
  }

  setCampoSeccion(fila: SeccionFila, key: string, valor: string) {
    fila[key] = valor;
    this.emitChanged();
  }
}
