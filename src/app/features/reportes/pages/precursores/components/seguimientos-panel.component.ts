import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportesService, Seguimiento, TipoSeguimiento } from '../../../services/reportes.service';

const TIPO_META: Record<TipoSeguimiento, { label: string; clase: string }> = {
  reunion_ayuda:   { label: 'Reunión de ayuda',   clase: 'tipo-ayuda' },
  decision_comite: { label: 'Decisión del comité', clase: 'tipo-comite' },
  nota:            { label: 'Nota',                clase: 'tipo-nota' },
};

/** Registro de seguimientos de la pauta: reuniones de ayuda, decisiones del comité y notas. */
@Component({
  selector: 'app-seguimientos-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  styleUrls: ['../../../shared/reportes-tokens.scss'],
  styles: [`
    .panel {
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      background: var(--superficie);
    }
    .panel-titulo {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--txt-3);
    }
    .panel-apostilla { font-size: 0.8125rem; line-height: 1.5; color: var(--txt-1); margin-top: 0.125rem; }

    /* Una sola acción primaria en el panel; el resto son fantasma. */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      height: 2rem;
      padding-inline: 0.75rem;
      border-radius: 0.5rem;
      border: 1px solid transparent;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      cursor: pointer;
      transition: background-color 140ms var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1)),
                  border-color 140ms var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1)),
                  color 140ms var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1)),
                  transform 140ms var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1));
    }
    .btn:active:not(:disabled) { transform: scale(0.97); }
    .btn:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }
    .btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .btn-primario { background: var(--acento); color: #ffffff; }
    :host-context(.dark) .btn-primario { color: #0f172a; }
    .btn-fantasma { border-color: var(--linea); color: var(--txt-2); background: transparent; }
    @media (hover: hover) and (pointer: fine) {
      .btn-primario:hover:not(:disabled) { background: color-mix(in oklch, var(--acento) 88%, black); }
      :host-context(.dark) .btn-primario:hover:not(:disabled) { background: color-mix(in oklch, var(--acento) 88%, white); }
      .btn-fantasma:hover:not(:disabled) { border-color: var(--txt-4); color: var(--txt-1); }
    }

    /* ── Formulario ────────────────────────────────────────────────── */
    .formulario { border: 1px solid var(--linea); border-radius: 0.625rem; background: var(--superficie-alt); }
    .campo-rotulo {
      display: block;
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--txt-3);
      margin-bottom: 0.375rem;
    }
    .campo {
      width: 100%;
      border: 1px solid var(--linea);
      border-radius: 0.5rem;
      background: var(--superficie);
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      color: var(--txt-1);
      transition: border-color 140ms var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1));
    }
    .campo::placeholder { color: var(--txt-4); }
    .campo:focus-visible { outline: 2px solid var(--acento); outline-offset: 1px; border-color: transparent; }
    .error { font-size: 0.75rem; color: var(--neg); }

    /* ── Entradas del registro ─────────────────────────────────────────
       Cada entrada es una anotación fechada, no una tarjeta: separadas por
       un filete, sin caja propia. Anidar tarjetas dentro de tarjetas sólo
       añade ruido. */
    .entrada { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem 0; box-shadow: inset 0 1px 0 var(--linea-suave); }
    .entrada:first-child { box-shadow: none; }
    .tipo {
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
    }
    .tipo-ayuda  { color: var(--aviso); }
    .tipo-comite { color: var(--acento); }
    .tipo-nota   { color: var(--txt-3); }
    .meta-entrada { font-family: var(--font-mono); font-size: 0.6875rem; color: var(--txt-4); }
    .descripcion { font-size: 0.8125rem; line-height: 1.6; color: var(--txt-2); margin-top: 0.3125rem; white-space: pre-line; max-width: 68ch; }

    .eliminar {
      padding: 0.375rem;
      border-radius: 0.375rem;
      color: var(--txt-4);
      transition: color 140ms var(--ease-out-quart, cubic-bezier(0.25, 1, 0.5, 1));
      cursor: pointer;
    }
    @media (hover: hover) and (pointer: fine) {
      .eliminar:hover { color: var(--neg); }
    }
    .eliminar:focus-visible { outline: 2px solid var(--acento); outline-offset: 1px; }

    /* El vacío enseña qué se registra aquí, no anuncia que no hay nada. */
    .vacio { font-size: 0.8125rem; line-height: 1.6; color: var(--txt-4); max-width: 52ch; padding: 0.25rem 0 0.5rem; }

    @media (prefers-reduced-motion: reduce) {
      .btn, .campo, .eliminar { transition: none; }
    }
  `],
  template: `
    <div class="panel p-4 space-y-3.5">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="panel-titulo">Seguimiento</h3>
          <p class="panel-apostilla">
            Reuniones de ayuda, decisiones del comité de servicio y notas.
          </p>
        </div>
        <button type="button"
                (click)="mostrarForm.set(!mostrarForm())"
                [attr.aria-expanded]="mostrarForm()"
                class="btn btn-primario shrink-0">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Registrar
        </button>
      </div>

      <form *ngIf="mostrarForm()" (ngSubmit)="guardar()" class="formulario p-3 space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="seg-tipo" class="campo-rotulo">Tipo</label>
            <select id="seg-tipo" name="tipo" [(ngModel)]="tipo" required class="campo">
              <option value="reunion_ayuda">Reunión de ayuda</option>
              <option value="decision_comite">Decisión del comité</option>
              <option value="nota">Nota</option>
            </select>
          </div>
          <div>
            <label for="seg-fecha" class="campo-rotulo">Fecha</label>
            <input id="seg-fecha" type="date" name="fecha" [(ngModel)]="fecha" required class="campo" />
          </div>
        </div>
        <div>
          <label for="seg-desc" class="campo-rotulo">Descripción</label>
          <textarea id="seg-desc" name="descripcion" [(ngModel)]="descripcion" required rows="3"
                    minlength="3" maxlength="2000"
                    placeholder="Ej.: Se conversó sobre sus circunstancias; se acordó acompañarle en la predicación los sábados…"
                    class="campo"></textarea>
        </div>
        <p *ngIf="errorForm()" class="error" role="alert">{{ errorForm() }}</p>
        <div class="flex justify-end gap-2">
          <button type="button" (click)="mostrarForm.set(false)" class="btn btn-fantasma">Cancelar</button>
          <button type="submit" [disabled]="guardando() || descripcion.trim().length < 3" class="btn btn-primario">
            {{ guardando() ? 'Guardando…' : 'Guardar' }}
          </button>
        </div>
      </form>

      <div *ngIf="items().length; else vacioTpl">
        <div *ngFor="let s of items(); trackBy: trackSeg" class="entrada">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="tipo" [ngClass]="tipoClases(s.tipo)">{{ tipoLabel(s.tipo) }}</span>
              <span class="meta-entrada">{{ s.fecha | date:'d MMM y' }}</span>
              <span *ngIf="s.creado_por_nombre" class="meta-entrada">· {{ s.creado_por_nombre }}</span>
            </div>
            <p class="descripcion">{{ s.descripcion }}</p>
          </div>
          <button type="button"
                  (click)="confirmarEliminar(s)"
                  class="eliminar shrink-0"
                  [attr.aria-label]="'Eliminar seguimiento del ' + s.fecha">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.87 12.14A2 2 0 0116.14 21H7.86a2 2 0 01-1.99-1.86L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h12"/>
            </svg>
          </button>
        </div>
      </div>
      <ng-template #vacioTpl>
        <p class="vacio">
          Aún no hay nada anotado. Registra aquí las reuniones de ayuda, las decisiones
          del comité de servicio y cualquier nota que convenga recordar el año que viene.
        </p>
      </ng-template>
    </div>
  `,
})
export class SeguimientosPanelComponent {
  private api = inject(ReportesService);

  @Input({ required: true }) idPublicador!: number;
  @Input() set seguimientos(v: Seguimiento[]) { this.items.set(v ?? []); }
  @Output() changed = new EventEmitter<void>();

  readonly items = signal<Seguimiento[]>([]);
  readonly mostrarForm = signal(false);
  readonly guardando = signal(false);
  readonly errorForm = signal<string | null>(null);

  tipo: TipoSeguimiento = 'reunion_ayuda';
  fecha = new Date().toISOString().slice(0, 10);
  descripcion = '';

  tipoLabel(t: TipoSeguimiento): string { return TIPO_META[t]?.label ?? t; }
  tipoClases(t: TipoSeguimiento): string { return TIPO_META[t]?.clase ?? TIPO_META.nota.clase; }
  trackSeg = (_: number, s: Seguimiento) => s.id_seguimiento;

  guardar(): void {
    if (this.descripcion.trim().length < 3 || this.guardando()) return;
    this.guardando.set(true);
    this.errorForm.set(null);
    this.api.crearSeguimiento(this.idPublicador, {
      tipo: this.tipo,
      fecha: this.fecha || null,
      descripcion: this.descripcion.trim(),
    }).subscribe({
      next: (s) => {
        this.items.update(list => [s, ...list]);
        this.guardando.set(false);
        this.mostrarForm.set(false);
        this.descripcion = '';
        this.changed.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorForm.set(err?.error?.detail ?? 'No fue posible guardar el seguimiento.');
      },
    });
  }

  confirmarEliminar(s: Seguimiento): void {
    if (!confirm(`¿Eliminar el seguimiento "${this.tipoLabel(s.tipo)}" del ${s.fecha}?`)) return;
    this.api.eliminarSeguimiento(this.idPublicador, s.id_seguimiento).subscribe({
      next: () => {
        this.items.update(list => list.filter(x => x.id_seguimiento !== s.id_seguimiento));
        this.changed.emit();
      },
    });
  }
}
