import { Component, EventEmitter, Input, Output, inject, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VisitaService } from '../../services/visita.service';
import { EntregaPortalService } from '../services/entrega-portal.service';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';

export type EntregaAviso = { type: 'success' | 'error' | 'info'; msg: string };

/**
 * Métodos de entrega de la visita al superintendente: paquete ZIP, enlace
 * temporal al portal y envío por correo.
 *
 * Compartido entre la pantalla del secretario y la del colaborador — quien
 * puede gestionar la visita también puede entregarla. El componente no muestra
 * avisos por su cuenta: emite (aviso) y cada pantalla lo pasa a su sistema de
 * toasts.
 */
@Component({
  standalone: true,
  selector: 'app-entrega-metodos',
  imports: [CommonModule, FormsModule, DatePickerComponent],
  template: `
    <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
      Elige cómo entregar la información al superintendente. Puedes usar uno o varios métodos.
    </p>
    <div class="entrega-grid">

      <!-- Card: Paquete -->
      <div class="delivery-card">
        <div class="delivery-card-header">
          <span class="delivery-step">1</span>
          <span class="delivery-badge delivery-badge-amber">Archivos ZIP</span>
        </div>
        <h4 class="delivery-title">Paquete completo</h4>
        <p class="delivery-desc">Documentos adjuntos y agenda comprimidos en un solo archivo.</p>
        <button (click)="descargarZip()" [disabled]="descargandoZip()" class="btn-secondary w-full justify-center">
          @if (descargandoZip()) {
            <span class="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"></span>
            Generando ZIP…
          } @else {
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
            Descargar ZIP
          }
        </button>
      </div>

      <!-- Card: Link temporal -->
      <div class="delivery-card">
        <div class="delivery-card-header">
          <span class="delivery-step">2</span>
          <span class="delivery-badge delivery-badge-emerald">Portal web · enlace temporal</span>
        </div>
        <h4 class="delivery-title">Portal del superintendente</h4>
        <p class="delivery-desc">Enlace temporal con registros, totales, contactos, S-88 y documentos.</p>
        @if (!enlace()) {
          <label class="form-label mb-2">
            <span>Expira el</span>
            <app-date-picker
              [(ngModel)]="fechaEnlace"
              colorScheme="violet"
              [fieldLike]="true"
              [inlineOnMobile]="true"
              [minDate]="minFechaEnlace"
              placeholder="Por defecto, en 7 días">
            </app-date-picker>
          </label>
          <button (click)="crearEnlace()" [disabled]="generandoEnlace()" class="btn-secondary w-full justify-center">
            @if (generandoEnlace()) { <span class="spinner"></span> Generando… } @else {
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
              Generar enlace
            }
          </button>
        } @else {
          <div class="link-result">
            <a [href]="enlace()!.url_publica" target="_blank" rel="noopener" class="link-url">
              {{ enlace()!.url_publica }}
            </a>

            @if (!editandoFechaEnlace()) {
              <p class="text-[0.65rem] text-slate-400 mt-1.5 flex items-center gap-1.5 flex-wrap">
                <span>Expira el {{ enlace()!.fecha_expiracion | date:'short' }}</span>
                <button (click)="abrirEdicionFechaEnlace()" class="link-edit-fecha" type="button">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.5-9.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 8.5-8.5z"/></svg>
                  Cambiar fecha
                </button>
              </p>
            } @else {
              <div class="mt-2 space-y-2">
                <app-date-picker
                  [(ngModel)]="fechaEnlace"
                  colorScheme="violet"
                  [fieldLike]="true"
                  [inlineOnMobile]="true"
                  [minDate]="minFechaEnlace"
                  placeholder="Nueva fecha de expiración">
                </app-date-picker>
                <div class="flex gap-2">
                  <button (click)="guardarFechaEnlace()" [disabled]="actualizandoFechaEnlace() || !fechaEnlace" class="btn-primary text-xs flex-1 justify-center">
                    @if (actualizandoFechaEnlace()) { <span class="spinner"></span> Guardando… } @else { Guardar fecha }
                  </button>
                  <button (click)="editandoFechaEnlace.set(false)" class="btn-ghost text-xs">Cancelar</button>
                </div>
              </div>
            }

            <button (click)="copiarLink()" class="btn-ghost text-xs mt-2 w-full justify-center">
              @if (copiado()) {
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                Copiado
              } @else {
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                Copiar enlace
              }
            </button>
          </div>
        }
      </div>

      <!-- Card: Correo -->
      <div class="delivery-card">
        <div class="delivery-card-header">
          <span class="delivery-step">3</span>
          <span class="delivery-badge delivery-badge-violet">Correo electrónico</span>
        </div>
        <h4 class="delivery-title">Envío por correo</h4>
        <p class="delivery-desc">Envía el paquete directamente al correo del superintendente.</p>
        <label class="form-label">
          <span>Correo destinatario</span>
          <input type="email" [(ngModel)]="correoDestino" placeholder="correo@ejemplo.com" class="field" />
        </label>
        <button (click)="enviarCorreo()"
                [disabled]="!correoDestino || enviando()"
                [title]="!correoDestino ? 'Ingresa el correo del destinatario para enviar' : ''"
                class="btn-primary w-full justify-center">
          @if (enviando()) { <span class="spinner"></span> Enviando… } @else {
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12l5 5L20 7"/></svg>
            Enviar correo
          }
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --brand-purple: #6D28D9;
      --brand-purple-hover: #5B21B6;
      --border-light: #e2e8f0;
      --border-dark: #334155;
      --bg-light: #ffffff;
      --bg-dark: #1e293b;
      --text-light: #1e293b;
      --text-dark: #f1f5f9;
    }

    /* Sin breakpoints: la rejilla se adapta al ancho real que reciba. El panel
       que la contiene mide distinto en cada pantalla (el del secretario pierde
       la columna de la lista) y ninguna media query de viewport lo sabría. */
    .entrega-grid {
      display: grid; gap: 1rem;
      grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
    }

    /* ───── Inputs ───── */
    .field {
      width: 100%;
      border: 1px solid var(--border-light);
      background: var(--bg-light);
      border-radius: 0.625rem;
      padding: 0.5rem 0.75rem;
      font-size: 1rem;
      line-height: 1.25rem;
      min-height: 2.75rem;
      color: var(--text-light);
      transition: border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
    }
    @media (min-width: 768px) { .field { font-size: 0.875rem; min-height: 2.5rem; } }
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
    .btn-primary, .btn-secondary, .btn-ghost {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.875rem; font-size: 0.8125rem; font-weight: 500;
      border-radius: 0.625rem;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out), color 160ms var(--ease-out);
      cursor: pointer; user-select: none;
    }
    .btn-primary { background: var(--brand-purple); color: #fff; box-shadow: 0 1px 2px rgba(109, 40, 217, 0.18); }
    .btn-secondary { border: 1px solid var(--border-light); color: #475569; background: var(--bg-light); }
    .btn-ghost { color: #64748b; }
    .btn-primary:disabled, .btn-secondary:disabled, .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }
    :host-context(.dark) .btn-secondary { background: var(--bg-dark); border-color: var(--border-dark); color: #cbd5e1; }
    :host-context(.dark) .btn-ghost { color: #94a3b8; }
    @media (max-width: 767px) {
      .btn-primary, .btn-secondary, .btn-ghost { min-height: 2.75rem; }
    }
    @media (hover: hover) and (pointer: fine) {
      .btn-primary:hover:not(:disabled) { background: var(--brand-purple-hover); box-shadow: 0 4px 14px rgba(109,40,217,0.28); }
      .btn-secondary:hover:not(:disabled) { background: #f8fafc; border-color: #cbd5e1; }
      .btn-ghost:hover:not(:disabled) { background: rgba(100,116,139,0.08); color: #334155; }
      :host-context(.dark) .btn-secondary:hover:not(:disabled) { background: #334155; border-color: #475569; color: #f1f5f9; }
      :host-context(.dark) .btn-ghost:hover:not(:disabled) { background: rgba(148,163,184,0.12); color: #f1f5f9; }
    }

    /* ───── Delivery cards ───── */
    .delivery-card-header {
      display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;
    }
    .delivery-step {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.375rem; height: 1.375rem; border-radius: 9999px; flex-shrink: 0;
      background: var(--border-light); color: #64748b;
      font-size: 0.6875rem; font-weight: 800;
    }
    :host-context(.dark) .delivery-step { background: var(--border-dark); color: #94a3b8; }
    .delivery-badge {
      display: inline-flex; align-items: center;
      padding: 0.125rem 0.5rem; border-radius: 9999px;
      font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    }
    .delivery-badge-amber { background: #fef3c7; color: #92400e; }
    .delivery-badge-emerald { background: #d1fae5; color: #065f46; }
    .delivery-badge-violet { background: #ede9fe; color: #5b21b6; }
    :host-context(.dark) .delivery-badge-amber { background: rgba(245,158,11,0.15); color: #fbbf24; }
    :host-context(.dark) .delivery-badge-emerald { background: rgba(16,185,129,0.15); color: #34d399; }
    :host-context(.dark) .delivery-badge-violet { background: rgba(139,92,246,0.15); color: #c4b5fd; }

    .delivery-card {
      background: var(--bg-light);
      border: 1px solid var(--border-light);
      border-radius: 1rem;
      padding: 1.25rem;
      display: flex; flex-direction: column; gap: 0.625rem;
      transition: border-color 240ms cubic-bezier(0.22,1,0.36,1), box-shadow 240ms cubic-bezier(0.22,1,0.36,1), transform 240ms cubic-bezier(0.22,1,0.36,1);
    }
    :host-context(.dark) .delivery-card { background: var(--bg-dark); border-color: var(--border-dark); }
    @media (hover: hover) {
      .delivery-card:hover { border-color: #c4b5fd; box-shadow: 0 10px 28px -8px rgba(109,40,217,0.2); transform: translateY(-3px); }
      :host-context(.dark) .delivery-card:hover { border-color: var(--brand-purple); }
    }
    .delivery-card:active { transform: translateY(-1px) scale(0.99); }
    .delivery-title { font-size: 0.95rem; font-weight: 700; color: #0f172a; line-height: 1.3; }
    :host-context(.dark) .delivery-title { color: #f1f5f9; }
    .delivery-desc { font-size: 0.8125rem; color: #64748b; line-height: 1.5; flex: 1; }
    :host-context(.dark) .delivery-desc { color: #94a3b8; }

    .link-result {
      background: #f8fafc; border: 1px solid var(--border-light);
      border-radius: 0.625rem; padding: 0.625rem;
    }
    :host-context(.dark) .link-result { background: #0f172a; border-color: var(--border-dark); }
    .link-url {
      display: block; font-size: 0.7rem; font-family: ui-monospace, monospace;
      color: var(--brand-purple); word-break: break-all;
      text-decoration: underline; text-underline-offset: 2px;
    }
    :host-context(.dark) .link-url { color: #a78bfa; }

    .link-edit-fecha {
      display: inline-flex; align-items: center; gap: 0.25rem;
      font-size: 0.65rem; font-weight: 600; color: var(--brand-purple);
      text-decoration: underline; text-underline-offset: 2px;
      cursor: pointer; background: none; border: none; padding: 0;
    }
    @media (hover: hover) { .link-edit-fecha:hover { color: var(--brand-purple-hover); } }
    :host-context(.dark) .link-edit-fecha { color: #a78bfa; }

    /* ───── Spinner ───── */
    .spinner {
      width: 0.875rem; height: 0.875rem; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent;
      animation: spin 600ms linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `],
})
export class EntregaMetodosComponent implements OnChanges {
  private svc = inject(VisitaService);
  private portalSvc = inject(EntregaPortalService);

  /** Visita que se va a entregar. Al cambiar se recarga el enlace activo. */
  @Input({ required: true }) idVisita!: number;
  /** Correo del superintendente registrado en la visita, si lo hay. */
  @Input() correoSugerido: string | null = null;

  /** Mensajes para el sistema de toasts de la pantalla contenedora. */
  @Output() aviso = new EventEmitter<EntregaAviso>();
  /** Si la visita ya tiene enlace activo — el stepper lo usa para marcar el paso. */
  @Output() enlaceCambio = new EventEmitter<boolean>();

  enlace = signal<{ url_publica: string; fecha_expiracion: string } | null>(null);
  generandoEnlace = signal(false);
  editandoFechaEnlace = signal(false);
  actualizandoFechaEnlace = signal(false);
  descargandoZip = signal(false);
  copiado = signal(false);
  enviando = signal(false);

  fechaEnlace = '';
  correoDestino = '';
  /** Un enlace que expira hoy no serviría de nada: el mínimo es mañana. */
  minFechaEnlace = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  ngOnChanges(cambios: SimpleChanges) {
    if (cambios['correoSugerido']) this.correoDestino = this.correoSugerido || '';
    if (cambios['idVisita'] && this.idVisita) {
      this.setEnlace(null);
      this.editandoFechaEnlace.set(false);
      this.fechaEnlace = '';
      this.svc.getEnlaceActivo(this.idVisita).subscribe({
        next: (t) => this.setEnlace(t),
        error: () => {},
      });
    }
  }

  private setEnlace(t: { url_publica: string; fecha_expiracion: string } | null) {
    this.enlace.set(t);
    this.enlaceCambio.emit(!!t);
  }

  descargarZip() {
    if (this.descargandoZip()) return;
    const now = new Date();
    // El año de servicio arranca en septiembre.
    const anio = now.getMonth() + 1 >= 9 ? now.getFullYear() + 1 : now.getFullYear();
    this.descargandoZip.set(true);
    this.portalSvc.zipFielInterno(this.idVisita, anio).subscribe({
      next: (blob) => {
        this.portalSvc.saveBlob(blob, `visita_circuito_${this.idVisita}_ano${anio}.zip`);
        this.descargandoZip.set(false);
      },
      error: (e) => {
        this.descargandoZip.set(false);
        this.aviso.emit({ type: 'error', msg: this.errMsg(e, 'Error al descargar el paquete') });
      },
    });
  }

  crearEnlace() {
    this.generandoEnlace.set(true);
    this.svc.crearEnlaceTemporal(this.idVisita, this.fechaEnlace || undefined).subscribe({
      next: (t) => {
        this.setEnlace(t);
        this.generandoEnlace.set(false);
        this.fechaEnlace = '';
      },
      error: (e) => {
        this.generandoEnlace.set(false);
        this.aviso.emit({ type: 'error', msg: this.errMsg(e, 'Error al generar el enlace') });
      },
    });
  }

  /** Abre el editor inline de fecha, precargado con la expiración actual del enlace. */
  abrirEdicionFechaEnlace() {
    const l = this.enlace();
    this.fechaEnlace = l ? l.fecha_expiracion.slice(0, 10) : '';
    this.editandoFechaEnlace.set(true);
  }

  guardarFechaEnlace() {
    if (!this.fechaEnlace) return;
    this.actualizandoFechaEnlace.set(true);
    this.svc.actualizarExpiracionEnlace(this.idVisita, this.fechaEnlace).subscribe({
      next: (t) => {
        this.setEnlace(t);
        this.actualizandoFechaEnlace.set(false);
        this.editandoFechaEnlace.set(false);
        this.aviso.emit({ type: 'success', msg: 'Fecha de expiración actualizada' });
      },
      error: (e) => {
        this.actualizandoFechaEnlace.set(false);
        this.aviso.emit({ type: 'error', msg: this.errMsg(e, 'Error al actualizar la fecha') });
      },
    });
  }

  copiarLink() {
    const l = this.enlace();
    if (!l) return;
    navigator.clipboard?.writeText(l.url_publica).then(() => {
      this.copiado.set(true);
      this.aviso.emit({ type: 'success', msg: 'Enlace copiado al portapapeles' });
      setTimeout(() => this.copiado.set(false), 1800);
    });
  }

  enviarCorreo() {
    if (!this.correoDestino) return;
    this.enviando.set(true);
    this.svc.enviarCorreo({
      id_visita: this.idVisita,
      correo_destino: this.correoDestino,
      enviar_zip: true,
      enviar_enlace: true,
    }).subscribe({
      next: () => {
        this.aviso.emit({ type: 'success', msg: 'Correo enviado correctamente' });
        this.enviando.set(false);
      },
      error: (e) => {
        this.aviso.emit({ type: 'error', msg: this.errMsg(e, 'Error al enviar correo') });
        this.enviando.set(false);
      },
    });
  }

  private errMsg(e: any, fallback: string): string {
    const d = e?.error?.detail;
    return typeof d === 'string' && d.trim() ? d : fallback;
  }
}
