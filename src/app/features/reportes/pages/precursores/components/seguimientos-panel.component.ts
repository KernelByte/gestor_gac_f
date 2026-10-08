import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportesService, Seguimiento, TipoSeguimiento } from '../../../services/reportes.service';
import { ConfirmDialogComponent } from '../../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ModalComponent } from '../../../../../shared/components/modal/modal.component';
import { ToastService } from '../../../../../shared/components/toast/toast.service';

const TIPO_META: Record<TipoSeguimiento, { label: string; clase: string; ayuda: string }> = {
  reunion_ayuda: {
    label: 'Reunión de ayuda',
    clase: 'tipo-ayuda',
    ayuda: 'Conversación con el precursor(a) para animarle o ayudarle con su pauta.',
  },
  decision_comite: {
    label: 'Decisión del comité',
    clase: 'tipo-comite',
    ayuda: 'Acuerdo del comité de servicio sobre su nombramiento o circunstancias.',
  },
  nota: {
    label: 'Nota',
    clase: 'tipo-nota',
    ayuda: 'Cualquier dato que convenga recordar más adelante.',
  },
};

/** Registro de seguimientos de la pauta: reuniones de ayuda, decisiones del comité y notas. */
@Component({
  selector: 'app-seguimientos-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, FormsModule, ConfirmDialogComponent, ModalComponent],
  styleUrls: ['../../../shared/reportes-tokens.scss'],
  // Sin seguimientos no hay panel; el alta es un modal que se abre desde la
  // cabecera de la página. `contents` evita que el host ocupe una celda vacía.
  host: { '[class.vacio]': 'items().length === 0', style: 'display: contents' },
  styles: [`
    .panel {
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      background: var(--superficie);
    }
    .panel-titulo {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 1rem;
      letter-spacing: -0.015em;
      color: var(--txt-1);
    }
    .panel-titulo::before {
      content: '';
      width: 0.1875rem;
      height: 1.05em;
      border-radius: 9999px;
      background: var(--acento);
    }
    .panel-titulo .contador {
      font-family: var(--font-mono);
      font-size: 0.6875rem;
      font-weight: 500;
      color: var(--txt-3);
    }
    .panel-apostilla { font-size: 0.8125rem; line-height: 1.5; color: var(--txt-3); margin-top: 0.125rem; padding-left: 0.6875rem; }

    /* Una sola acción primaria en el panel; el resto son secundarias. */
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.375rem;
      min-height: 2.25rem;
      padding-inline: 0.875rem;
      border-radius: 0.5rem;
      border: 1px solid transparent;
      font-size: 0.8125rem;
      font-weight: 600;
      letter-spacing: 0.005em;
      white-space: nowrap;
      cursor: pointer;
      transition: background-color 160ms var(--ease-out-quart),
                  border-color 160ms var(--ease-out-quart),
                  color 160ms var(--ease-out-quart),
                  transform 160ms var(--ease-out-quart);
    }
    .btn svg { width: 0.875rem; height: 0.875rem; flex: none; }
    .btn:active:not(:disabled) { transform: scale(0.97); }
    .btn:focus-visible { outline: 2px solid var(--acento); outline-offset: 2px; }
    .btn:disabled { opacity: 0.45; cursor: not-allowed; }

    .btn-primario { background: var(--acento); color: #ffffff; }
    :host-context(.dark) .btn-primario { color: #0f172a; }
    .btn-secundario { border-color: var(--linea); color: var(--txt-2); background: var(--superficie); }
    @media (hover: hover) and (pointer: fine) {
      .btn-primario:hover:not(:disabled) { background: color-mix(in oklch, var(--acento) 88%, black); }
      :host-context(.dark) .btn-primario:hover:not(:disabled) { background: color-mix(in oklch, var(--acento) 88%, white); }
      .btn-secundario:hover:not(:disabled) { border-color: var(--txt-4); color: var(--txt-1); }
    }

    /* ── Formulario (dentro del modal) ─────────────────────────────── */
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
      min-height: 2.5rem;
      border: 1px solid var(--linea);
      border-radius: 0.5rem;
      background: var(--superficie);
      padding: 0.5rem 0.75rem;
      font-size: 0.8125rem;
      color: var(--txt-1);
      transition: border-color 160ms var(--ease-out-quart);
    }
    .campo::placeholder { color: var(--txt-4); }
    .campo:focus-visible { outline: 2px solid var(--acento); outline-offset: 1px; border-color: transparent; }
    .ayuda { margin-top: 0.3125rem; font-size: 0.75rem; line-height: 1.45; color: var(--txt-3); }
    .ayuda-fila { display: flex; justify-content: space-between; gap: 0.75rem; }
    .ayuda .cuenta { font-family: var(--font-mono); font-variant-numeric: tabular-nums; white-space: nowrap; }
    .error { font-size: 0.75rem; color: var(--neg); }

    /* ── Entradas del registro ─────────────────────────────────────────
       Cada entrada es una anotación fechada, no una tarjeta: separadas por
       un filete, sin caja propia. El icono del tipo, en su color, permite
       distinguir de un vistazo una reunión de ayuda de una decisión. */
    .entrada { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.75rem 0; box-shadow: inset 0 1px 0 var(--linea-suave); }
    .entrada:first-child { box-shadow: none; padding-top: 0.25rem; }
    .entrada-icono {
      --tono: var(--txt-3);
      width: 1.75rem;
      height: 1.75rem;
      flex: none;
      display: grid;
      place-items: center;
      border-radius: 9999px;
      color: var(--tono);
      background: color-mix(in oklch, var(--tono) 12%, transparent);
    }
    .entrada-icono svg { width: 0.875rem; height: 0.875rem; }
    .tipo {
      font-size: 0.625rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--tono);
    }
    .tipo-ayuda  { --tono: var(--aviso); }
    .tipo-comite { --tono: var(--acento); }
    .tipo-nota   { --tono: var(--txt-3); }
    .meta-entrada { font-family: var(--font-mono); font-size: 0.6875rem; color: var(--txt-3); }
    .descripcion { font-size: 0.8125rem; line-height: 1.6; color: var(--txt-2); margin-top: 0.25rem; white-space: pre-line; max-width: 68ch; overflow-wrap: anywhere; }

    .eliminar {
      width: 2.25rem;
      height: 2.25rem;
      flex: none;
      display: grid;
      place-items: center;
      border-radius: 0.5rem;
      color: var(--txt-3);
      transition: color 160ms var(--ease-out-quart), background-color 160ms var(--ease-out-quart);
      cursor: pointer;
    }
    .eliminar svg { width: 1rem; height: 1rem; }
    @media (hover: hover) and (pointer: fine) {
      .eliminar:hover { color: var(--neg); background: color-mix(in oklch, var(--neg) 8%, transparent); }
    }
    .eliminar:focus-visible { outline: 2px solid var(--acento); outline-offset: 1px; }

    /* El vacío enseña qué se registra aquí, no anuncia que no hay nada. */
    @keyframes aparecer {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: none; }
    }

    @media (pointer: coarse) {
      .btn, .eliminar { min-height: 2.75rem; }
      .eliminar { width: 2.75rem; }
      .campo { min-height: 2.75rem; }
    }
    @media (max-width: 479.98px) {
      .acciones-form { flex-direction: column-reverse; }
      .acciones-form .btn { width: 100%; }
    }

    @media (prefers-reduced-motion: reduce) {
      .btn, .campo, .eliminar { transition: none; }
      .btn:active:not(:disabled) { transform: none; }
    }
  `],
  template: `
    @if (items().length) {
    <section class="panel p-4 space-y-3.5" aria-labelledby="titulo-seguimiento">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 id="titulo-seguimiento" class="panel-titulo">
            Seguimiento
            @if (items().length) { <span class="contador">{{ items().length }}</span> }
          </h2>
        </div>
      </div>

      @if (items().length) {
        <ul class="list-none" aria-label="Seguimientos registrados">
          @for (s of items(); track s.id_seguimiento) {
            <li class="entrada">
              <span class="entrada-icono" [class]="tipoClases(s.tipo)" aria-hidden="true">
                @switch (s.tipo) {
                  @case ('reunion_ayuda') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.36-1.86M17 20H7m10 0v-2c0-.66-.13-1.28-.36-1.86M7 20H2v-2a3 3 0 015.36-1.86M7 20v-2c0-.66.13-1.28.36-1.86m0 0a5 5 0 019.28 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                    </svg>
                  }
                  @case ('decision_comite') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.62-4.02A11.96 11.96 0 0112 2.94a11.96 11.96 0 01-8.62 3.04A12.02 12.02 0 003 9c0 5.59 3.82 10.29 9 11.62 5.18-1.33 9-6.03 9-11.62 0-1.04-.13-2.05-.38-3.02z"/>
                    </svg>
                  }
                  @default {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.41-9.41a2 2 0 112.83 2.83L11.83 15H9v-2.83l8.59-8.59z"/>
                    </svg>
                  }
                }
              </span>
              <div class="flex-1 min-w-0" [class]="tipoClases(s.tipo)">
                <div class="flex items-center gap-x-2 gap-y-0.5 flex-wrap">
                  <span class="tipo">{{ tipoLabel(s.tipo) }}</span>
                  <span class="meta-entrada">{{ s.fecha | date:'d MMM y' }}</span>
                  @if (s.creado_por_nombre) {
                    <span class="meta-entrada">· {{ s.creado_por_nombre }}</span>
                  }
                </div>
                <p class="descripcion">{{ s.descripcion }}</p>
              </div>
              <button type="button"
                      (click)="pedirEliminar(s)"
                      class="eliminar"
                      title="Eliminar seguimiento"
                      [attr.aria-label]="'Eliminar ' + tipoLabel(s.tipo).toLowerCase() + ' del ' + (s.fecha | date:'d MMM y')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.87 12.14A2 2 0 0116.14 21H7.86a2 2 0 01-1.99-1.86L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m-9 0h12"/>
                </svg>
              </button>
            </li>
          }
        </ul>
      }
    </section>
    }

    <app-modal [open]="mostrarForm()" title="Nuevo seguimiento" size="md" [hasFooter]="true"
               (closed)="cerrarFormulario()">
      <form id="form-seguimiento" (ngSubmit)="guardar()" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="seg-tipo" class="campo-rotulo">Tipo</label>
              <select #primerCampo id="seg-tipo" name="tipo" [(ngModel)]="tipo" required class="campo"
                      aria-describedby="seg-tipo-ayuda">
                <option value="reunion_ayuda">Reunión de ayuda</option>
                <option value="decision_comite">Decisión del comité</option>
                <option value="nota">Nota</option>
              </select>
              <p id="seg-tipo-ayuda" class="ayuda">{{ tipoAyuda(tipo) }}</p>
            </div>
            <div>
              <label for="seg-fecha" class="campo-rotulo">Fecha</label>
              <input id="seg-fecha" type="date" name="fecha" [(ngModel)]="fecha" required class="campo"
                     aria-describedby="seg-fecha-ayuda" />
              <p id="seg-fecha-ayuda" class="ayuda">Cuándo ocurrió, no cuándo se anota.</p>
            </div>
          </div>
          <div>
            <label for="seg-desc" class="campo-rotulo">Descripción</label>
            <textarea id="seg-desc" name="descripcion" [(ngModel)]="descripcion" required rows="3"
                      minlength="3" maxlength="2000"
                      aria-describedby="seg-desc-ayuda"
                      placeholder="Ej.: Se conversó sobre sus circunstancias; se acordó acompañarle en la predicación los sábados…"
                      class="campo"></textarea>
            <p id="seg-desc-ayuda" class="ayuda ayuda-fila">
              <span>Mínimo 3 caracteres.</span>
              <span class="cuenta">{{ descripcion.length }} / 2000</span>
            </p>
          </div>
          @if (errorForm()) {
            <p class="error" role="alert">{{ errorForm() }} Revisa los datos y vuelve a intentarlo.</p>
          }
      </form>
      <button slot="footer" type="button" (click)="cerrarFormulario()" class="btn btn-secundario">Cancelar</button>
      <button slot="footer" type="submit" form="form-seguimiento" [disabled]="guardando() || descripcion.trim().length < 3" class="btn btn-primario">
        {{ guardando() ? 'Guardando…' : 'Guardar seguimiento' }}
      </button>
    </app-modal>

    <app-confirm-dialog
      [open]="!!porEliminar()"
      title="¿Eliminar este seguimiento?"
      [message]="mensajeEliminar()"
      confirmLabel="Eliminar seguimiento"
      cancelLabel="Conservar"
      severity="danger"
      (confirmed)="eliminar()"
      (cancelled)="porEliminar.set(null)" />
  `,
})
export class SeguimientosPanelComponent {
  private api = inject(ReportesService);
  private toast = inject(ToastService);

  @Input({ required: true }) idPublicador!: number;
  @Input() set seguimientos(v: Seguimiento[]) { this.items.set(v ?? []); }
  @Output() changed = new EventEmitter<void>();

  @ViewChild('primerCampo') private primerCampo?: ElementRef<HTMLSelectElement>;

  readonly items = signal<Seguimiento[]>([]);
  readonly mostrarForm = signal(false);
  readonly guardando = signal(false);
  readonly errorForm = signal<string | null>(null);
  readonly porEliminar = signal<Seguimiento | null>(null);

  tipo: TipoSeguimiento = 'reunion_ayuda';
  fecha = new Date().toISOString().slice(0, 10);
  descripcion = '';

  tipoLabel(t: TipoSeguimiento): string { return TIPO_META[t]?.label ?? t; }
  tipoClases(t: TipoSeguimiento): string { return TIPO_META[t]?.clase ?? TIPO_META.nota.clase; }
  tipoAyuda(t: TipoSeguimiento): string { return TIPO_META[t]?.ayuda ?? ''; }

  /**
   * Abre el formulario, lo trae a la vista y pone el foco en el primer campo.
   * Público: la cabecera del detalle lo usa como atajo "Registrar seguimiento".
   */
  abrirFormulario(): void {
    this.errorForm.set(null);
    this.mostrarForm.set(true);
    setTimeout(() => {
      this.primerCampo?.nativeElement.focus({ preventScroll: true });
    });
  }

  cerrarFormulario(): void {
    this.mostrarForm.set(false);
    this.errorForm.set(null);
  }

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
        this.toast.success('Seguimiento guardado');
        this.changed.emit();
      },
      error: (err) => {
        this.guardando.set(false);
        this.errorForm.set(err?.error?.detail ?? 'No fue posible guardar el seguimiento.');
      },
    });
  }

  mensajeEliminar(): string {
    const s = this.porEliminar();
    if (!s) return '';
    const fecha = new Date(s.fecha + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
    return `Se borrará «${this.tipoLabel(s.tipo)}» del ${fecha}. Esta acción no se puede deshacer.`;
  }

  pedirEliminar(s: Seguimiento): void {
    this.porEliminar.set(s);
  }

  eliminar(): void {
    const s = this.porEliminar();
    this.porEliminar.set(null);
    if (!s) return;
    this.api.eliminarSeguimiento(this.idPublicador, s.id_seguimiento).subscribe({
      next: () => {
        this.items.update(list => list.filter(x => x.id_seguimiento !== s.id_seguimiento));
        this.toast.success('Seguimiento eliminado');
        this.changed.emit();
      },
      error: (err) => this.toast.error(
        'No se pudo eliminar el seguimiento',
        err?.error?.detail ?? 'Comprueba la conexión y vuelve a intentarlo.',
      ),
    });
  }
}
