import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { TransferenciaService } from '../../services/transferencia.service';
import { Transferencia } from '../../models/transferencia.model';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { environment } from '../../../../../environments/environment';

type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; msg: string; }

interface PublicadorLite {
  id_publicador: number;
  primer_nombre: string;
  primer_apellido: string;
  segundo_apellido?: string | null;
  archivo_consentimiento?: string | null;
}

@Component({
  standalone: true,
  selector: 'app-transferencias',
  imports: [CommonModule, FormsModule],
  template: `
    <!-- ── TOASTS ── -->
    <div class="toast-container" aria-live="polite" aria-atomic="false">
      <div *ngFor="let n of notifications()"
           [class]="'toast-item toast-' + n.type"
           role="alert">
        <span class="toast-icon" aria-hidden="true">
          <svg *ngIf="n.type === 'success'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
          <svg *ngIf="n.type === 'error'"   viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <svg *ngIf="n.type === 'info'"    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </span>
        <span class="toast-msg">{{ n.msg }}</span>
        <button class="toast-close" (click)="dismissToast(n.id)" aria-label="Cerrar notificación">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <div class="h-full flex flex-col overflow-hidden">

      <!-- ── HERO + BODY WRAPPER ── -->
      <div class="flex-1 flex flex-col m-1 rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800 min-h-0">

        <!-- ── HERO ── -->
        <header class="bg-violet-700 text-white shrink-0">
          <div class="px-4 sm:px-6 lg:px-10 py-3">
            <div class="flex items-start justify-between gap-4 mb-3">
              <div>
                <div class="flex items-center gap-1.5 text-purple-200 text-[0.6rem] uppercase tracking-[0.18em] font-semibold mb-1.5">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4M4 17h12m0 0l-4-4m4 4l-4 4"/></svg>
                  <span>Módulo Secretario</span>
                </div>
                <h1 class="text-2xl lg:text-3xl font-bold tracking-tight leading-tight">Transferencias</h1>
                <p class="text-purple-100/70 text-xs max-w-sm mt-1">
                  Genera el paquete completo cuando un publicador se transfiere a otra congregación.
                </p>
              </div>
              <button (click)="creando.set(true)" class="btn-hero group shrink-0 mt-1">
                <svg class="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
                <span>Nueva transferencia</span>
              </button>
            </div>

            <div class="grid grid-cols-3 gap-2.5">
              <div class="stat-pill">
                <span class="stat-pill__num">{{ items().length }}</span>
                <span class="stat-pill__label">Total</span>
              </div>
              <div class="stat-pill">
                <span class="stat-pill__num">{{ countBorradores() }}</span>
                <span class="stat-pill__label">Borradores</span>
              </div>
              <div class="stat-pill">
                <span class="stat-pill__num">{{ countFinalizadas() }}</span>
                <span class="stat-pill__label">Finalizadas</span>
              </div>
            </div>
          </div>
        </header>

        <!-- ── BODY ── -->
        <div class="flex-1 bg-white dark:bg-slate-900 px-4 sm:px-6 lg:px-10 pt-4 pb-4 min-h-0 overflow-y-auto flex flex-col gap-4">

          <!-- Create form (in-flow card) -->
          <div *ngIf="creando()" class="surface form-card">
            <div class="form-card__head">
              <h3 class="form-card__title">Nueva transferencia</h3>
              <p class="form-card__hint">Completa los datos básicos. La carta se redactará después.</p>
            </div>
            <div class="form-grid">
              <label class="field">
                <span class="field__label">Publicador <span class="req">*</span></span>
                <select [(ngModel)]="form.id_publicador" class="input">
                  <option [ngValue]="null">Selecciona…</option>
                  <option *ngFor="let p of publicadores()" [ngValue]="p.id_publicador">
                    {{ p.primer_nombre }} {{ p.primer_apellido }}{{ !p.archivo_consentimiento ? ' (sin consentimiento)' : '' }}
                  </option>
                </select>
              </label>
              <label class="field">
                <span class="field__label">Congregación destino <span class="req">*</span></span>
                <input class="input" [(ngModel)]="form.congregacion_destino" placeholder="Nombre de la congregación destino" />
              </label>
              <label class="field field--full">
                <span class="field__label">Motivo</span>
                <input class="input" [(ngModel)]="form.motivo" placeholder="Cambio de residencia, etc." />
              </label>
              <label class="field field--full">
                <span class="field__label">Notas para la carta de presentación</span>
                <textarea rows="5" class="input"
                          [(ngModel)]="form.notas_para_carta"
                          placeholder="Describe al publicador: tiempo en la congregación, personalidad, situación familiar, fortalezas espirituales, circunstancias relevantes…"></textarea>
              </label>
            </div>
            <div class="form-card__foot">
              <button (click)="creando.set(false)" class="btn btn--ghost">Cancelar</button>
              <button (click)="crear()" [disabled]="!form.id_publicador || !form.congregacion_destino"
                      class="btn btn--primary">Crear transferencia</button>
            </div>
          </div>

          <!-- Workspace: list + detail -->
          <div class="workspace"
               [class.workspace--with-detail]="seleccionada()"
               [class.workspace--mobile-detail]="mobileView() === 'detalle'">

            <!-- ── LIST PANEL ── -->
            <section class="surface list-panel">
              <div class="list-panel__head">
                <div>
                  <h2 class="panel-title">Listado</h2>
                  <p class="panel-sub">Selecciona una transferencia para gestionarla.</p>
                </div>
              </div>

              <!-- Desktop table -->
              <div class="table-wrap desktop-table">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Publicador</th>
                      <th>Destino</th>
                      <th>Estado</th>
                      <th>Carta</th>
                      <th aria-label="acciones"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr *ngFor="let t of items()"
                        (click)="abrir(t)"
                        [class.is-active]="seleccionada()?.id_transferencia === t.id_transferencia"
                        class="data-row">
                      <td>
                        <div class="person">
                          <div class="avatar">{{ iniciales(t.id_publicador) }}</div>
                          <div class="person__text">
                            <span class="person__name">{{ nombrePublicador(t.id_publicador) }}</span>
                            <span class="person__meta" *ngIf="t.motivo">{{ t.motivo }}</span>
                          </div>
                        </div>
                      </td>
                      <td class="cell-muted">
                        <div class="destino">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          {{ t.congregacion_destino }}
                        </div>
                      </td>
                      <td>
                        <span class="badge"
                              [class.badge--amber]="t.estado === 'borrador'"
                              [class.badge--emerald]="t.estado === 'finalizada'">
                          <span class="badge__dot"></span>
                          {{ t.estado }}
                        </span>
                      </td>
                      <td>
                        <span class="carta-flag" [class.carta-flag--on]="t.carta_redactada">
                          {{ t.carta_redactada ? '✓ Redactada' : 'Pendiente' }}
                        </span>
                      </td>
                      <td class="cell-action">
                        <button (click)="abrir(t); $event.stopPropagation()" class="btn btn--link" aria-label="Abrir transferencia">Abrir →</button>
                      </td>
                    </tr>
                    <tr *ngIf="items().length === 0">
                      <td colspan="5">
                        <div class="empty">
                          <div class="empty__icon" aria-hidden="true">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          </div>
                          <p class="empty__title">No hay transferencias aún</p>
                          <p class="empty__hint">Crea la primera transferencia para empezar.</p>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Mobile card list -->
              <div class="mobile-cards">
                <div *ngFor="let t of items()"
                     (click)="abrir(t)"
                     [class.mobile-card--active]="seleccionada()?.id_transferencia === t.id_transferencia"
                     class="mobile-card">
                  <div class="mobile-card__left">
                    <div class="avatar">{{ iniciales(t.id_publicador) }}</div>
                  </div>
                  <div class="mobile-card__body">
                    <div class="mobile-card__top">
                      <span class="person__name">{{ nombrePublicador(t.id_publicador) }}</span>
                      <span class="badge badge--sm"
                            [class.badge--amber]="t.estado === 'borrador'"
                            [class.badge--emerald]="t.estado === 'finalizada'">
                        {{ t.estado }}
                      </span>
                    </div>
                    <div class="mobile-card__sub">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      <span>{{ t.congregacion_destino }}</span>
                      <span *ngIf="t.motivo" class="meta-sep">·</span>
                      <span *ngIf="t.motivo" class="person__meta">{{ t.motivo }}</span>
                    </div>
                    <span class="carta-flag carta-flag--sm" [class.carta-flag--on]="t.carta_redactada">
                      {{ t.carta_redactada ? '✓ Carta redactada' : 'Carta pendiente' }}
                    </span>
                  </div>
                  <div class="mobile-card__chevron" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </div>

                <div *ngIf="items().length === 0" class="empty">
                  <div class="empty__icon" aria-hidden="true">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  </div>
                  <p class="empty__title">No hay transferencias aún</p>
                  <p class="empty__hint">Toca "+ Nueva transferencia" para empezar.</p>
                </div>
              </div>
            </section>

            <!-- ── DETAIL PANEL ── -->
            <aside *ngIf="seleccionada() as t" class="surface detail-panel">

              <!-- Mobile back button -->
              <button class="mobile-back" (click)="cerrarDetalle()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
                Volver al listado
              </button>

              <!-- Inline delete confirmation -->
              <div *ngIf="confirmandoEliminar()" class="confirm-panel" role="alertdialog" aria-labelledby="confirm-title">
                <div class="confirm-panel__icon" aria-hidden="true">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </div>
                <div class="confirm-panel__body">
                  <p id="confirm-title" class="confirm-panel__title">¿Eliminar esta transferencia?</p>
                  <p class="confirm-panel__hint">Esta acción no se puede deshacer.</p>
                </div>
                <div class="confirm-panel__actions">
                  <button class="btn btn--ghost" (click)="confirmandoEliminar.set(false)">Cancelar</button>
                  <button class="btn btn--danger" (click)="confirmarEliminar()">Eliminar</button>
                </div>
              </div>

              <header class="detail-head">
                <div class="detail-head__main">
                  <div class="avatar avatar--lg">{{ iniciales(t.id_publicador) }}</div>
                  <div>
                    <h2 class="detail-title">{{ nombrePublicador(t.id_publicador) }}</h2>
                    <p class="detail-route">
                      <span>Transferencia</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                      <strong>{{ t.congregacion_destino }}</strong>
                    </p>
                  </div>
                </div>
                <button (click)="cerrarDetalle()" class="icon-btn" aria-label="Cerrar detalle">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </header>

              <div class="detail-section">
                <label class="field">
                  <span class="field__label">Notas para la carta</span>
                  <textarea rows="5" class="input" [(ngModel)]="t.notas_para_carta"
                            placeholder="Tiempo en la congregación, personalidad, fortalezas espirituales…"></textarea>
                </label>

                <div class="action-row">
                  <button (click)="guardarNotas()" [disabled]="guardandoNotas()" class="btn btn--secondary">
                    <span *ngIf="!guardandoNotas()">Guardar notas</span>
                    <span *ngIf="guardandoNotas()" class="loading"><span class="spinner spinner--dark"></span> Guardando…</span>
                  </button>
                  <button (click)="redactarCarta()" [disabled]="redactando() || !t.notas_para_carta"
                          class="btn btn--primary">
                    <span *ngIf="!redactando()" class="btn-inner">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                      Redactar carta con IA
                    </span>
                    <span *ngIf="redactando()" class="loading">
                      <span class="spinner"></span> Redactando…
                    </span>
                  </button>
                </div>
              </div>

              <div class="detail-section">
                <label class="field">
                  <span class="field__label">Carta redactada</span>
                  <textarea rows="14" class="input input--mono" [(ngModel)]="t.carta_redactada"
                            placeholder="Aparecerá aquí el texto generado…"></textarea>
                </label>
              </div>

              <footer class="detail-foot">
                <button (click)="confirmandoEliminar.set(true)" [disabled]="confirmandoEliminar()"
                        class="btn btn--danger-ghost">Eliminar</button>
                <div class="detail-foot__right">
                  <button (click)="guardarTodo()" [disabled]="guardandoTodo()" class="btn btn--secondary">
                    <span *ngIf="!guardandoTodo()">Guardar</span>
                    <span *ngIf="guardandoTodo()" class="loading"><span class="spinner spinner--dark"></span> Guardando…</span>
                  </button>
                  <button (click)="generarPaquete()" [disabled]="!t.carta_redactada || generando()"
                          class="btn btn--primary">
                    <span *ngIf="!generando()" class="btn-inner">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="M3.27 6.96 12 12.01l8.73-5.05"/><path d="m15 5-3 1.5-3-1.5"/></svg>
                      Generar paquete
                    </span>
                    <span *ngIf="generando()" class="loading">
                      <span class="spinner"></span> Generando…
                    </span>
                  </button>
                </div>
              </footer>
            </aside>
          </div><!-- /workspace -->
        </div><!-- /body -->
      </div><!-- /hero+body wrapper -->
    </div>
  `,
  styles: [`
    :host {
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
      --brand: #7c3aed;
      --brand-soft: rgba(124, 58, 237, 0.10);
      display: block;
      height: 100%;
    }

    /* ── Hero btn ── */
    .btn-hero {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.625rem 1.125rem; font-size: 0.8125rem; font-weight: 600;
      border-radius: 0.625rem; cursor: pointer; user-select: none;
      background: rgba(255,255,255,0.16); color: #fff;
      border: 1px solid rgba(255,255,255,0.24);
      box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      transition: background-color 160ms var(--ease-out);
      min-height: 44px;
    }
    .btn-hero:hover { background: rgba(255,255,255,0.24); }
    .btn-hero:active { transform: scale(0.97); }
    .btn-hero:focus-visible {
      outline: 2px solid rgba(255,255,255,0.7);
      outline-offset: 2px;
    }

    /* ── Hero stat pills ── */
    .stat-pill {
      display: flex; flex-direction: row; align-items: center; gap: 0.625rem;
      padding: 0.625rem 0.875rem;
      background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.14);
      border-radius: 0.75rem;
    }
    .stat-pill__num { font-size: 1.625rem; font-weight: 700; line-height: 1; color: #fff; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
    .stat-pill__label { font-size: 0.625rem; color: rgba(255,255,255,0.6); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }

    /* ── Surfaces ── */
    .surface {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 0.875rem;
      box-shadow: 0 1px 3px rgba(15,23,42,0.04);
    }

    /* ── Form card ── */
    .form-card {
      padding: clamp(1rem, 2vw, 1.5rem);
      animation: cardEnter 220ms var(--ease-out);
    }
    @keyframes cardEnter {
      from { opacity: 0; transform: translateY(-4px) scale(0.99); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .form-card__head { margin-bottom: 1rem; }
    .form-card__title { font-size: 1.05rem; font-weight: 600; color: #0f172a; margin: 0; }
    .form-card__hint { font-size: 0.85rem; color: #64748b; margin: 0.25rem 0 0; }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.85rem;
    }
    .field { display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.875rem; }
    .field--full { grid-column: 1 / -1; }
    .field__label { font-size: 0.78rem; font-weight: 600; color: #475569; letter-spacing: 0.01em; }
    .req { color: #ef4444; font-weight: 700; }
    @media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; } }

    .form-card__foot {
      display: flex; justify-content: flex-end; gap: 0.5rem;
      margin-top: 1.1rem;
    }

    /* ── Inputs ── */
    .input {
      width: 100%;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 0.6rem 0.85rem;
      font-size: 0.9rem;
      line-height: 1.35;
      background: #fff;
      color: #0f172a;
      transition: border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
      font-family: inherit;
    }
    .input:hover { border-color: #cbd5e1; }
    .input:focus {
      outline: none;
      border-color: var(--brand);
      box-shadow: 0 0 0 4px var(--brand-soft);
    }
    .input:focus-visible {
      outline: none;
      border-color: var(--brand);
      box-shadow: 0 0 0 4px var(--brand-soft);
    }
    .input--mono {
      font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
      font-size: 0.85rem;
      line-height: 1.55;
    }
    textarea.input { resize: vertical; min-height: 90px; }

    /* ── Workspace ── */
    .workspace {
      display: grid;
      grid-template-columns: 1fr;
      gap: clamp(1rem, 1.5vw, 1.5rem);
      align-items: start;
    }
    @media (min-width: 1100px) {
      .workspace--with-detail {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
      }
    }
    /* Mobile: show only one panel at a time */
    @media (max-width: 1099px) {
      .workspace--mobile-detail .list-panel { display: none; }
    }

    /* ── List panel ── */
    .list-panel { overflow: hidden; display: flex; flex-direction: column; }
    .list-panel__head {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
      display: flex; align-items: center; justify-content: space-between;
    }
    .panel-title { font-size: 1rem; font-weight: 600; margin: 0; color: #0f172a; }
    .panel-sub { font-size: 0.8rem; color: #64748b; margin: 0.15rem 0 0; }

    /* Desktop table */
    .table-wrap { width: 100%; overflow-x: auto; }
    .desktop-table { display: block; }
    .mobile-cards { display: none; }

    @media (max-width: 768px) {
      .desktop-table { display: none; }
      .mobile-cards { display: flex; flex-direction: column; }
    }

    .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .data-table thead th {
      text-align: left;
      font-size: 0.72rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
      color: #64748b; padding: 0.75rem 1rem;
      background: rgba(248, 250, 252, 0.6);
      border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    }
    .data-row {
      cursor: pointer;
      transition: background-color 140ms var(--ease-out);
      border-bottom: 1px solid rgba(148, 163, 184, 0.10);
    }
    .data-row td { padding: 0.85rem 1rem; vertical-align: middle; }
    .data-row:hover { background: rgba(124, 58, 237, 0.04); }
    .data-row:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
    .data-row.is-active { background: rgba(124, 58, 237, 0.08); }

    .cell-muted { color: #64748b; }
    .cell-action { text-align: right; }

    /* Mobile card list */
    .mobile-card {
      display: flex; align-items: center; gap: 0.875rem;
      padding: 0.875rem 1.25rem;
      cursor: pointer;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      transition: background-color 140ms var(--ease-out);
      min-height: 72px;
    }
    .mobile-card:last-child { border-bottom: none; }
    .mobile-card:hover { background: rgba(124, 58, 237, 0.04); }
    .mobile-card:active { background: rgba(124, 58, 237, 0.08); }
    .mobile-card--active { background: rgba(124, 58, 237, 0.08); }
    .mobile-card__left { flex-shrink: 0; }
    .mobile-card__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.3rem; }
    .mobile-card__top { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .mobile-card__sub {
      display: flex; align-items: center; gap: 0.35rem;
      font-size: 0.78rem; color: #64748b;
    }
    .mobile-card__chevron { color: #cbd5e1; flex-shrink: 0; }
    .meta-sep { color: #cbd5e1; }

    /* Person */
    .person { display: flex; align-items: center; gap: 0.7rem; }
    .person__text { display: flex; flex-direction: column; min-width: 0; }
    .person__name { font-weight: 600; color: #0f172a; }
    .person__meta { font-size: 0.75rem; color: #94a3b8; }

    /* Avatar: flat brand color, no gradient */
    .avatar {
      width: 36px; height: 36px;
      border-radius: 10px;
      background: var(--brand);
      color: white;
      display: grid; place-items: center;
      font-size: 0.78rem; font-weight: 700;
      letter-spacing: 0.02em;
      flex-shrink: 0;
    }
    .avatar--lg { width: 48px; height: 48px; font-size: 0.95rem; border-radius: 12px; }

    .destino { display: inline-flex; align-items: center; gap: 0.4rem; color: inherit; }
    .destino svg { color: #94a3b8; flex-shrink: 0; }

    .badge {
      display: inline-flex; align-items: center; gap: 0.4rem;
      font-size: 0.72rem; font-weight: 600;
      padding: 0.25rem 0.6rem;
      border-radius: 999px;
      text-transform: capitalize;
      background: rgba(148, 163, 184, 0.16);
      color: #475569;
    }
    .badge--sm { font-size: 0.68rem; padding: 0.2rem 0.5rem; }
    .badge__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .badge--amber { background: rgba(245, 158, 11, 0.14); color: #b45309; }
    .badge--emerald { background: rgba(16, 185, 129, 0.14); color: #047857; }

    .carta-flag { font-size: 0.78rem; color: #94a3b8; font-weight: 500; }
    .carta-flag--sm { font-size: 0.72rem; }
    .carta-flag--on { color: #059669; font-weight: 600; }

    .empty {
      display: flex; flex-direction: column; align-items: center;
      padding: 3rem 1rem; gap: 0.5rem;
    }
    .empty__icon {
      width: 56px; height: 56px; border-radius: 14px;
      background: var(--brand-soft); color: var(--brand);
      display: grid; place-items: center; margin-bottom: 0.25rem;
    }
    .empty__title { font-weight: 600; color: #475569; margin: 0; }
    .empty__hint { font-size: 0.85rem; color: #94a3b8; margin: 0; text-align: center; }

    /* ── Mobile back button ── */
    .mobile-back {
      display: none;
      align-items: center; gap: 0.5rem;
      padding: 0.75rem 1.25rem;
      font-size: 0.85rem; font-weight: 600;
      color: var(--brand);
      background: transparent;
      border: none; border-bottom: 1px solid rgba(148, 163, 184, 0.18);
      cursor: pointer;
      width: 100%;
      transition: background-color 140ms var(--ease-out);
      min-height: 48px;
    }
    .mobile-back:hover { background: var(--brand-soft); }
    .mobile-back:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
    @media (max-width: 1099px) { .mobile-back { display: flex; } }

    /* ── Inline confirm panel ── */
    .confirm-panel {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.875rem 1rem;
      background: rgba(239, 68, 68, 0.06);
      border: 1px solid rgba(239, 68, 68, 0.20);
      border-radius: 0.75rem;
      flex-wrap: wrap;
    }
    .confirm-panel__icon {
      width: 40px; height: 40px; flex-shrink: 0;
      border-radius: 10px;
      background: rgba(239, 68, 68, 0.10);
      color: #dc2626;
      display: grid; place-items: center;
    }
    .confirm-panel__body { flex: 1; min-width: 0; }
    .confirm-panel__title { font-weight: 600; font-size: 0.9rem; color: #991b1b; margin: 0; }
    .confirm-panel__hint { font-size: 0.8rem; color: #b91c1c; margin: 0.2rem 0 0; }
    .confirm-panel__actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

    /* ── Detail panel ── */
    .detail-panel {
      display: flex; flex-direction: column; gap: 1.1rem;
      overflow: hidden;
      animation: detailEnter 240ms var(--ease-out);
    }
    @keyframes detailEnter {
      from { opacity: 0; transform: translateY(6px) scale(0.99); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (min-width: 1100px) {
      .detail-panel { padding: clamp(1rem, 1.8vw, 1.5rem); position: sticky; top: 1rem; }
    }
    @media (max-width: 1099px) {
      .detail-panel { padding: 0 0 1rem; gap: 0; }
      .detail-panel > .detail-head,
      .detail-panel > .detail-section,
      .detail-panel > .detail-foot,
      .detail-panel > .confirm-panel { padding-left: 1.25rem; padding-right: 1.25rem; margin-top: 1rem; }
    }

    .detail-head {
      display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid rgba(148, 163, 184, 0.18);
    }
    .detail-head__main { display: flex; gap: 0.85rem; align-items: center; min-width: 0; }
    .detail-title { font-size: 1.15rem; font-weight: 700; color: #0f172a; margin: 0; letter-spacing: -0.01em; }
    .detail-route {
      display: flex; align-items: center; gap: 0.4rem;
      margin: 0.2rem 0 0; font-size: 0.85rem; color: #64748b;
    }
    .detail-route strong { color: #0f172a; font-weight: 600; }
    .detail-route svg { color: #cbd5e1; }

    .detail-section { display: flex; flex-direction: column; gap: 0.6rem; }
    .action-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    .detail-foot {
      display: flex; justify-content: space-between; align-items: center;
      padding-top: 0.9rem; gap: 0.5rem; flex-wrap: wrap;
      border-top: 1px solid rgba(148, 163, 184, 0.18);
    }
    .detail-foot__right { display: flex; gap: 0.5rem; flex-wrap: wrap; }

    /* ── Buttons ── */
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 0.45rem;
      padding: 0.625rem 1rem;
      border-radius: 10px;
      font-size: 0.85rem; font-weight: 600; line-height: 1;
      border: 1px solid transparent;
      cursor: pointer; white-space: nowrap;
      font-family: inherit; min-height: 44px;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out), color 160ms var(--ease-out);
      user-select: none;
    }
    .btn:active:not(:disabled) { transform: scale(0.97); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
    .btn-inner { display: inline-flex; align-items: center; gap: 0.45rem; }

    .btn--primary {
      background: var(--brand); color: #fff;
      box-shadow: 0 1px 2px rgba(124,58,237,0.3);
    }
    .btn--primary:hover:not(:disabled) { background: #6d28d9; }
    .btn--primary:focus-visible { outline-color: #6d28d9; }

    .btn--secondary {
      background: rgba(148, 163, 184, 0.10);
      color: #334155;
      border-color: rgba(148, 163, 184, 0.22);
    }
    .btn--secondary:hover:not(:disabled) { background: rgba(148, 163, 184, 0.18); }

    .btn--ghost { background: transparent; color: #64748b; }
    .btn--ghost:hover:not(:disabled) { background: rgba(148, 163, 184, 0.14); color: #0f172a; }

    .btn--danger { background: #dc2626; color: #fff; }
    .btn--danger:hover:not(:disabled) { background: #b91c1c; }

    .btn--danger-ghost { background: transparent; color: #e11d48; }
    .btn--danger-ghost:hover:not(:disabled) { background: rgba(244, 63, 94, 0.10); }

    .btn--link {
      background: transparent;
      padding: 0.625rem 0.75rem;
      color: var(--brand); font-weight: 600;
      min-height: 44px;
    }
    .btn--link:hover { background: var(--brand-soft); }
    .btn--link:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

    /* ── Icon button ── */
    .icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 44px; height: 44px;
      border-radius: 10px;
      background: transparent; color: #94a3b8;
      border: 1px solid transparent; cursor: pointer;
      transition: background-color 160ms var(--ease-out), color 160ms var(--ease-out), transform 160ms var(--ease-out);
      flex-shrink: 0;
    }
    .icon-btn:hover { background: rgba(148, 163, 184, 0.16); color: #0f172a; }
    .icon-btn:active { transform: scale(0.94); }
    .icon-btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

    /* ── Loading / spinner ── */
    .loading { display: inline-flex; align-items: center; gap: 0.5rem; }
    .spinner {
      width: 12px; height: 12px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.35);
      border-top-color: #fff;
      animation: spin 0.7s linear infinite;
    }
    .spinner--dark {
      border-color: rgba(51, 65, 85, 0.25);
      border-top-color: #334155;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Toast ── */
    .toast-container {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex; flex-direction: column; gap: 0.5rem;
      z-index: 100;
      pointer-events: none;
      width: max-content; max-width: min(90vw, 420px);
    }
    @media (min-width: 768px) {
      .toast-container { left: auto; right: 1.5rem; transform: none; }
    }
    .toast-item {
      display: flex; align-items: center; gap: 0.65rem;
      padding: 0.75rem 0.9rem;
      border-radius: 0.75rem;
      font-size: 0.875rem; font-weight: 500;
      box-shadow: 0 4px 16px rgba(15,23,42,0.12);
      pointer-events: all;
      animation: toastIn 220ms var(--ease-out);
      background: #fff;
      border: 1px solid #e2e8f0;
      color: #0f172a;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(6px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .toast-success { border-color: rgba(16,185,129,0.3); background: #f0fdf4; }
    .toast-error   { border-color: rgba(239,68,68,0.3);  background: #fef2f2; }
    .toast-info    { border-color: rgba(124,58,237,0.25); background: #faf5ff; }
    .toast-icon { display: flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex-shrink: 0; }
    .toast-icon svg { width: 16px; height: 16px; }
    .toast-success .toast-icon { color: #059669; }
    .toast-error   .toast-icon { color: #dc2626; }
    .toast-info    .toast-icon { color: #7c3aed; }
    .toast-msg { flex: 1; }
    .toast-close {
      display: flex; align-items: center; justify-content: center;
      width: 24px; height: 24px; border-radius: 6px;
      background: transparent; border: none; cursor: pointer; color: #94a3b8;
      padding: 0; flex-shrink: 0;
    }
    .toast-close:hover { background: rgba(148,163,184,0.18); color: #475569; }
    .toast-close svg { width: 12px; height: 12px; }

    @media (prefers-reduced-motion: reduce) {
      .form-card, .detail-panel { animation: none; }
      .btn, .icon-btn, .data-row, .input, .mobile-card { transition: none; }
      .spinner { animation-duration: 1.4s; }
      .toast-item { animation: none; }
    }

    /* ── Dark mode ── */
    :host-context(.dark) .surface {
      background: #0f172a;
      border-color: #1e293b;
      box-shadow: none;
    }
    :host-context(.dark) .form-card__title { color: #f1f5f9; }
    :host-context(.dark) .form-card__hint  { color: #94a3b8; }
    :host-context(.dark) .field__label     { color: #cbd5e1; }

    :host-context(.dark) .panel-title { color: #f1f5f9; }
    :host-context(.dark) .panel-sub   { color: #94a3b8; }
    :host-context(.dark) .list-panel__head { border-color: rgba(148, 163, 184, 0.12); }

    :host-context(.dark) .data-table thead th {
      color: #94a3b8;
      background: rgba(30, 41, 59, 0.4);
      border-color: rgba(148, 163, 184, 0.12);
    }
    :host-context(.dark) .data-row { border-color: rgba(148, 163, 184, 0.08); }
    :host-context(.dark) .data-row:hover { background: rgba(124, 58, 237, 0.10); }
    :host-context(.dark) .data-row.is-active { background: rgba(124, 58, 237, 0.15); }

    :host-context(.dark) .mobile-card { border-color: rgba(148, 163, 184, 0.10); }
    :host-context(.dark) .mobile-card:hover  { background: rgba(124, 58, 237, 0.10); }
    :host-context(.dark) .mobile-card:active { background: rgba(124, 58, 237, 0.15); }
    :host-context(.dark) .mobile-card--active { background: rgba(124, 58, 237, 0.15); }
    :host-context(.dark) .mobile-card__sub  { color: #94a3b8; }
    :host-context(.dark) .mobile-card__chevron { color: #475569; }

    :host-context(.dark) .cell-muted  { color: #94a3b8; }
    :host-context(.dark) .person__name { color: #f1f5f9; }
    :host-context(.dark) .person__meta { color: #64748b; }

    :host-context(.dark) .badge--amber   { color: #fbbf24; }
    :host-context(.dark) .badge--emerald { color: #34d399; }
    :host-context(.dark) .carta-flag--on { color: #34d399; }

    :host-context(.dark) .empty__title { color: #cbd5e1; }
    :host-context(.dark) .empty__hint  { color: #64748b; }

    :host-context(.dark) .detail-head  { border-color: rgba(148, 163, 184, 0.12); }
    :host-context(.dark) .detail-foot  { border-color: rgba(148, 163, 184, 0.12); }
    :host-context(.dark) .detail-title { color: #f1f5f9; }
    :host-context(.dark) .detail-route       { color: #94a3b8; }
    :host-context(.dark) .detail-route strong { color: #e2e8f0; }
    :host-context(.dark) .detail-route svg    { color: #475569; }

    :host-context(.dark) .confirm-panel { background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.25); }

    :host-context(.dark) .mobile-back {
      color: #a78bfa;
      border-color: rgba(148, 163, 184, 0.12);
    }
    :host-context(.dark) .mobile-back:hover { background: rgba(124, 58, 237, 0.12); }

    :host-context(.dark) .input {
      border-color: #334155;
      background: rgba(15, 23, 42, 0.6);
      color: #f1f5f9;
    }
    :host-context(.dark) .input:hover { border-color: #475569; }

    :host-context(.dark) .btn--secondary {
      background: rgba(148, 163, 184, 0.10);
      color: #e2e8f0;
      border-color: rgba(148, 163, 184, 0.16);
    }
    :host-context(.dark) .btn--secondary:hover:not(:disabled) { background: rgba(148, 163, 184, 0.18); }

    :host-context(.dark) .btn--ghost { color: #94a3b8; }
    :host-context(.dark) .btn--ghost:hover:not(:disabled) { background: rgba(148, 163, 184, 0.14); color: #f1f5f9; }

    :host-context(.dark) .icon-btn:hover { background: rgba(148, 163, 184, 0.16); color: #f1f5f9; }

    :host-context(.dark) .spinner--dark {
      border-color: rgba(226, 232, 240, 0.25);
      border-top-color: #e2e8f0;
    }
  `]
})
export class TransferenciasPage implements OnInit {
  private svc = inject(TransferenciaService);
  private http = inject(HttpClient);
  private ctx = inject(CongregacionContextService);

  items = signal<Transferencia[]>([]);
  publicadores = signal<PublicadorLite[]>([]);
  seleccionada = signal<Transferencia | null>(null);
  creando = signal(false);
  redactando = signal(false);
  generando = signal(false);
  guardandoNotas = signal(false);
  guardandoTodo = signal(false);
  confirmandoEliminar = signal(false);
  mobileView = signal<'lista' | 'detalle'>('lista');
  notifications = signal<Toast[]>([]);

  private _toastId = 0;

  form: any = { id_publicador: null, congregacion_destino: '', motivo: '', notas_para_carta: '' };

  ngOnInit() {
    this.svc.list().subscribe({
      next: t => this.items.set(t),
      error: () => this.toast('error', 'No se pudieron cargar las transferencias'),
    });
    const idCong = this.ctx.effectiveCongregacionId();
    const params: any = {};
    if (idCong) params.id_congregacion = idCong;
    this.http.get<PublicadorLite[]>(`${environment.apiUrl}/publicadores/`, { params }).subscribe({
      next: p => this.publicadores.set(p),
      error: () => this.toast('error', 'No se pudieron cargar los publicadores'),
    });
  }

  nombrePublicador(id: number): string {
    const p = this.publicadores().find(x => x.id_publicador === id);
    return p ? `${p.primer_nombre} ${p.primer_apellido}` : `#${id}`;
  }

  iniciales(id: number): string {
    const p = this.publicadores().find(x => x.id_publicador === id);
    if (!p) return '#';
    const a = (p.primer_nombre || '').charAt(0);
    const b = (p.primer_apellido || '').charAt(0);
    return (a + b).toUpperCase() || '#';
  }

  countBorradores(): number {
    return this.items().filter(t => t.estado === 'borrador').length;
  }

  countFinalizadas(): number {
    return this.items().filter(t => t.estado === 'finalizada').length;
  }

  crear() {
    const idCong = this.ctx.effectiveCongregacionId();
    if (!idCong) { this.toast('error', 'Selecciona una congregación.'); return; }
    this.svc.create({
      id_publicador: this.form.id_publicador,
      id_congregacion_origen: idCong,
      congregacion_destino: this.form.congregacion_destino,
      motivo: this.form.motivo,
      notas_para_carta: this.form.notas_para_carta,
    }).subscribe({
      next: (t) => {
        this.items.update(a => [t, ...a]);
        this.creando.set(false);
        this.form = { id_publicador: null, congregacion_destino: '', motivo: '', notas_para_carta: '' };
        this.abrir(t);
        this.toast('success', 'Transferencia creada correctamente.');
      },
      error: (e) => this.toast('error', e?.error?.detail || 'Error al crear la transferencia'),
    });
  }

  abrir(t: Transferencia) {
    this.seleccionada.set({ ...t });
    this.confirmandoEliminar.set(false);
    this.mobileView.set('detalle');
  }

  cerrarDetalle() {
    this.seleccionada.set(null);
    this.confirmandoEliminar.set(false);
    this.mobileView.set('lista');
  }

  guardarNotas() {
    const t = this.seleccionada();
    if (!t) return;
    this.guardandoNotas.set(true);
    this.svc.update(t.id_transferencia, { notas_para_carta: t.notas_para_carta }).subscribe({
      next: updated => {
        this.seleccionada.set(updated);
        this.items.update(arr => arr.map(x => x.id_transferencia === updated.id_transferencia ? updated : x));
        this.guardandoNotas.set(false);
        this.toast('success', 'Notas guardadas.');
      },
      error: (e) => {
        this.guardandoNotas.set(false);
        this.toast('error', e?.error?.detail || 'Error al guardar las notas');
      },
    });
  }

  guardarTodo() {
    const t = this.seleccionada();
    if (!t) return;
    this.guardandoTodo.set(true);
    this.svc.update(t.id_transferencia, {
      notas_para_carta: t.notas_para_carta,
      carta_redactada: t.carta_redactada,
      congregacion_destino: t.congregacion_destino,
      motivo: t.motivo,
      estado: t.estado,
    }).subscribe({
      next: updated => {
        this.seleccionada.set(updated);
        this.items.update(arr => arr.map(x => x.id_transferencia === updated.id_transferencia ? updated : x));
        this.guardandoTodo.set(false);
        this.toast('success', 'Transferencia guardada.');
      },
      error: (e) => {
        this.guardandoTodo.set(false);
        this.toast('error', e?.error?.detail || 'Error al guardar');
      },
    });
  }

  redactarCarta() {
    const t = this.seleccionada();
    if (!t) return;
    this.guardarNotas();
    this.redactando.set(true);
    this.svc.redactarCarta(t.id_transferencia).subscribe({
      next: (res) => {
        this.seleccionada.update(x => x ? { ...x, carta_redactada: res.carta_redactada } : x);
        this.redactando.set(false);
        this.toast('success', 'Carta redactada correctamente.');
      },
      error: (e) => {
        this.redactando.set(false);
        this.toast('error', e?.error?.detail || 'Error al redactar la carta');
      },
    });
  }

  generarPaquete() {
    const t = this.seleccionada();
    if (!t) return;
    this.guardarTodo();
    this.generando.set(true);
    this.svc.generarPaquete(t.id_transferencia).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transferencia_${this.nombrePublicador(t.id_publicador).replace(/\s+/g, '_')}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        this.generando.set(false);
        this.toast('success', 'Paquete generado y descargado.');
      },
      error: (e) => {
        this.generando.set(false);
        this.toast('error', e?.error?.detail || 'Error al generar el paquete');
      },
    });
  }

  confirmarEliminar() {
    const t = this.seleccionada();
    if (!t) return;
    this.svc.remove(t.id_transferencia).subscribe({
      next: () => {
        this.items.update(arr => arr.filter(x => x.id_transferencia !== t.id_transferencia));
        this.cerrarDetalle();
        this.toast('success', 'Transferencia eliminada.');
      },
      error: (e) => {
        this.confirmandoEliminar.set(false);
        this.toast('error', e?.error?.detail || 'Error al eliminar');
      },
    });
  }

  toast(type: ToastType, msg: string, duration = 4000) {
    const id = ++this._toastId;
    this.notifications.update(n => [...n, { id, type, msg }]);
    setTimeout(() => this.dismissToast(id), duration);
  }

  dismissToast(id: number) {
    this.notifications.update(n => n.filter(x => x.id !== id));
  }
}
