import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VisitaService } from '../../../secretario-tools/services/visita.service';
import { AgendaItem, AgendaSecciones, Visita } from '../../../secretario-tools/models/visita.model';
import { AgendaEditorComponent } from '../../../secretario-tools/visita-superintendente/components/agenda-editor.component';

type Tab = 'agenda' | 'docs';
type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; msg: string; }

/**
 * Pantalla simplificada para COLABORADORES de la Visita del Superintendente:
 * usuarios (p.ej. ancianos) invitados por el secretario para completar la
 * agenda y subir documentos, sin acceso al resto de la gestión (entrega,
 * enlaces, eliminación, etc.).
 */
@Component({
  standalone: true,
  selector: 'app-visita-colaborador',
  imports: [CommonModule, FormsModule, AgendaEditorComponent],
  template: `
  <div class="h-full flex flex-col overflow-hidden">
    <div class="flex-1 flex flex-col m-1 rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800 min-h-0">

      <!-- ───────── HERO ───────── -->
      <header class="hero-grad text-white shrink-0">
        <div class="relative z-10 px-4 sm:px-6 lg:px-10 py-4 sm:py-5">
          <div class="hero-eyebrow">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4z"/></svg>
            <span>Colaboración</span>
          </div>
          <h1 class="hero-title">Visita del Superintendente</h1>
          <p class="hero-desc">Completa la agenda y adjunta los documentos que te corresponden.</p>
        </div>
      </header>

      <!-- ───────── BODY ───────── -->
      <div class="flex-1 bg-white dark:bg-slate-900 min-h-0 overflow-y-auto">

        @if (cargando()) {
          <div class="p-6 space-y-3">
            @for (s of [0,1]; track s) {
              <div class="skeleton-card" [style.--stagger]="s * 60 + 'ms'"></div>
            }
          </div>
        } @else if (!visitas().length) {
          <!-- Empty state: no colabora en ninguna visita -->
          <div class="empty-wrap">
            <div class="empty-icon">
              <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
            </div>
            <h3 class="text-base font-semibold text-slate-700 dark:text-slate-200">No tienes visitas asignadas</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm text-center">
              Cuando el secretario te invite a colaborar en una visita del superintendente,
              aparecerá aquí y recibirás una notificación.
            </p>
          </div>
        } @else {

          <!-- Selector de visita (solo si hay varias) -->
          @if (visitas().length > 1 && !seleccionada()) {
            <div class="p-4 sm:p-6 space-y-2.5 max-w-2xl">
              <h2 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">Visitas donde colaboras</h2>
              @for (v of visitas(); track v.id_visita; let i = $index) {
                <button type="button" (click)="abrir(v)" class="visita-card w-full text-left" [style.--stagger]="i * 40 + 'ms'">
                  <p class="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
                    {{ v.nombre_superintendente || 'Superintendente sin nombre' }}
                  </p>
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {{ v.fecha_inicio }}@if (v.fecha_fin) { <span> — {{ v.fecha_fin }}</span> }
                    @if (v.semestre) { <span class="mx-1.5 text-slate-300">·</span>{{ v.semestre }} }
                  </p>
                </button>
              }
            </div>
          }

          @if (seleccionada(); as v) {
            <!-- Barra de contexto de la visita -->
            <div class="px-4 sm:px-6 lg:px-10 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/95 dark:bg-slate-900/95 sticky top-0 z-10 backdrop-blur-sm">
              <div class="min-w-0">
                <p class="font-semibold text-slate-800 dark:text-slate-100 text-sm sm:text-base truncate">
                  {{ v.nombre_superintendente || 'Visita del superintendente' }}
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {{ v.fecha_inicio }}@if (v.fecha_fin) { <span> — {{ v.fecha_fin }}</span> }
                  @if (v.semestre) { <span class="mx-1.5 text-slate-300">·</span>{{ v.semestre }} }
                </p>
              </div>
              @if (visitas().length > 1) {
                <button (click)="seleccionada.set(null)" class="btn-ghost text-xs shrink-0">Cambiar visita</button>
              }
            </div>

            <!-- Tabs -->
            <div class="px-4 sm:px-6 lg:px-10 pt-3">
              <nav class="tab-bar" role="tablist">
                <button type="button" role="tab" class="tab-btn" [class.is-active]="activeTab() === 'agenda'"
                        [attr.aria-selected]="activeTab() === 'agenda'" (click)="activeTab.set('agenda')">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  Agenda
                  @if (agendaDirty()) { <span class="tab-dirty" title="Cambios sin guardar"></span> }
                </button>
                <button type="button" role="tab" class="tab-btn" [class.is-active]="activeTab() === 'docs'"
                        [attr.aria-selected]="activeTab() === 'docs'" (click)="activeTab.set('docs')">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  Documentos
                  @if (archivos().length) { <span class="tab-badge">{{ archivos().length }}</span> }
                </button>
              </nav>
            </div>

            <!-- Tab: Agenda -->
            @if (activeTab() === 'agenda') {
              <section class="p-4 sm:p-6 lg:px-10 space-y-4">

                @if (conflictoAgenda()) {
                  <div class="conflict-banner">
                    <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z"/></svg>
                    <div class="flex-1 min-w-0">
                      <p class="font-semibold">La agenda fue modificada por otra persona</p>
                      <p class="text-xs opacity-80">Puedes recargar para ver los cambios (perderás tu edición) o guardar de todos modos.</p>
                    </div>
                    <div class="flex items-center gap-2 shrink-0">
                      <button (click)="recargarAgenda()" class="btn-ghost text-xs">Recargar</button>
                      <button (click)="guardarAgenda(true)" class="btn-warn text-xs">Guardar igual</button>
                    </div>
                  </div>
                }

                <app-agenda-editor
                  [items]="agendaItems()"
                  [secciones]="agendaSecciones()"
                  (changed)="markAgendaDirty()">
                </app-agenda-editor>

              </section>
            }

            <!-- Tab: Documentos -->
            @if (activeTab() === 'docs') {
              <section class="p-4 sm:p-6 lg:px-10 space-y-4">
                <label
                  class="dropzone group"
                  [class.is-dragging]="isDragging()"
                  (dragover)="onDragOver($event)"
                  (dragleave)="isDragging.set(false)"
                  (drop)="onDrop($event)">
                  <input #fi type="file" class="hidden" multiple (change)="onFile(fi)" />
                  <div class="text-center pointer-events-none">
                    <div class="mx-auto w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 flex items-center justify-center mb-2">
                      @if (subiendo()) {
                        <span class="spinner spinner-brand"></span>
                      } @else {
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.9 5 5 0 019.9-1A5.5 5.5 0 0118.5 16H17m-5-4v9m0 0l-3-3m3 3l3-3"/></svg>
                      }
                    </div>
                    @if (subiendo()) {
                      <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Subiendo archivos…</p>
                    } @else {
                      <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Arrastra tus archivos aquí</p>
                      <p class="text-xs text-slate-500 mt-1">PDF, Excel, Word o imágenes</p>
                      <span class="btn-elegir">Elegir archivos</span>
                    }
                  </div>
                </label>

                <p class="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  Solo el secretario puede eliminar documentos.
                </p>

                @if (archivos().length) {
                  <ul class="space-y-1.5">
                    @for (a of archivos(); track a.nombre; let i = $index) {
                      <li class="file-row" [style.--stagger]="i * 30 + 'ms'">
                        <div class="flex items-center gap-3 min-w-0">
                          <div class="file-ico">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z M13 3v6h6"/></svg>
                          </div>
                          <span class="text-sm text-slate-700 dark:text-slate-200 truncate flex-1">{{ a.nombre }}</span>
                        </div>
                        <span class="text-xs text-slate-400 tabular-nums shrink-0">{{ (a.tamano_bytes / 1024) | number:'1.0-0' }} KB</span>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="text-sm text-slate-400 italic px-1">Aún no hay documentos en esta visita.</p>
                }
              </section>
            }
          }
        }
      </div>

      <!-- ── Barra de guardado de agenda: pie FIJO del layout, fuera del scroll ── -->
      @if (!cargando() && seleccionada() && activeTab() === 'agenda') {
        <div class="save-bar shrink-0" [class.is-dirty]="agendaDirty()">
          @if (agendaDirty()) {
            <span class="save-hint">
              <span class="save-dot"></span>
              Tienes cambios sin guardar
            </span>
          } @else {
            <span class="save-hint save-hint-ok">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              Todo guardado
            </span>
          }
          <button (click)="guardarAgenda()" [disabled]="guardando() || !agendaDirty()" class="btn-primary justify-center shrink-0" [class.btn-pulse]="agendaDirty()">
            @if (guardando()) { <span class="spinner"></span> Guardando… } @else {
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              Guardar agenda
            }
          </button>
        </div>
      }
    </div>

    <!-- ───────── TOASTS ───────── -->
    <div
      class="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[100] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      role="status">
      @for (n of notifications(); track n.id) {
        <div class="toast-item pointer-events-auto"
             [class.toast-success]="n.type === 'success'"
             [class.toast-error]="n.type === 'error'"
             [class.toast-info]="n.type === 'info'">
          <span class="flex-1 text-sm font-medium">{{ n.msg }}</span>
          <button (click)="dismissToast(n.id)" class="shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5" aria-label="Cerrar notificación">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      }
    </div>
  </div>
  `,
  styles: [`
    :host { display: block; height: 100%; min-height: 0; }
    :host {
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --brand-purple: #6D28D9;
      --brand-purple-hover: #5B21B6;
    }

    .hero-grad {
      position: relative; overflow: hidden;
      background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 60%, #a855f7 100%);
      box-shadow: 0 6px 20px -6px rgba(109,40,217,0.4);
    }
    .hero-eyebrow {
      display: flex; align-items: center; gap: 0.375rem;
      color: rgba(196,181,253,0.9); font-size: 0.6rem; text-transform: uppercase;
      letter-spacing: 0.18em; font-weight: 600; margin-bottom: 0.25rem;
    }
    .hero-title { font-size: 1.375rem; font-weight: 800; line-height: 1.15; color: #fff; letter-spacing: -0.02em; }
    .hero-desc { color: rgba(237,233,254,0.65); font-size: 0.75rem; margin-top: 0.125rem; line-height: 1.35; }
    @media (max-width: 479px) { .hero-title { font-size: 1.25rem; } .hero-desc { display: none; } }

    /* ── Skeleton / empty ── */
    @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    .skeleton-card {
      height: 5rem; border-radius: 0.875rem;
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
      animation-delay: var(--stagger, 0ms);
    }
    :host-context(.dark) .skeleton-card {
      background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
      background-size: 200% 100%;
    }

    .empty-wrap {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 4rem 1.5rem;
    }
    .empty-icon {
      width: 4rem; height: 4rem; border-radius: 9999px;
      background: rgba(109,40,217,0.08); color: var(--brand-purple);
      display: flex; align-items: center; justify-content: center; margin-bottom: 1rem;
    }
    :host-context(.dark) .empty-icon { background: rgba(167,139,250,0.12); color: #a78bfa; }

    /* ── Cards de visita ── */
    @keyframes visitaIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    .visita-card {
      padding: 0.875rem 1rem; border-radius: 0.875rem;
      background: #fff; border: 1px solid #e2e8f0; cursor: pointer;
      transition: all 200ms var(--ease-out);
      animation: visitaIn 320ms var(--ease-out) both;
      animation-delay: var(--stagger, 0ms);
    }
    :host-context(.dark) .visita-card { background: #1e293b; border-color: #334155; }
    @media (hover: hover) {
      .visita-card:hover { border-color: #c4b5fd; box-shadow: 0 4px 12px -4px rgba(109,40,217,0.15); }
    }
    .visita-card:active { transform: scale(0.99); }

    /* ── Tabs ── */
    .tab-bar {
      display: flex; gap: 0.25rem;
      border-bottom: 1px solid #f1f5f9;
    }
    :host-context(.dark) .tab-bar { border-bottom-color: #1e293b; }
    .tab-btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.625rem 0.875rem; min-height: 2.75rem;
      font-size: 0.8125rem; font-weight: 600; color: #94a3b8;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
      cursor: pointer; transition: color 140ms, border-color 140ms;
    }
    .tab-btn.is-active { color: var(--brand-purple); border-bottom-color: var(--brand-purple); }
    :host-context(.dark) .tab-btn.is-active { color: #a78bfa; border-bottom-color: #a78bfa; }
    @media (hover: hover) { .tab-btn:hover:not(.is-active) { color: #475569; } }
    :host-context(.dark) .tab-btn:hover:not(.is-active) { color: #cbd5e1; }

    .tab-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 1.125rem; height: 1.125rem; padding: 0 0.3rem;
      border-radius: 9999px; background: var(--brand-purple); color: #fff;
      font-size: 0.6rem; font-weight: 700;
    }
    :host-context(.dark) .tab-badge { background: #a78bfa; color: #1e293b; }
    .tab-dirty {
      width: 0.5rem; height: 0.5rem; border-radius: 9999px; background: #f59e0b;
    }

    /* ── Botones ── */
    .btn-primary, .btn-ghost, .btn-warn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.875rem; font-size: 0.8125rem; font-weight: 500;
      border-radius: 0.625rem; cursor: pointer; user-select: none;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out);
      min-height: 2.5rem;
    }
    .btn-primary { background: var(--brand-purple); color: #fff; box-shadow: 0 1px 2px rgba(109,40,217,0.18); }
    .btn-ghost { color: #64748b; }
    .btn-warn { background: #f59e0b; color: #fff; }
    @media (hover: hover) and (pointer: fine) {
      .btn-primary:hover:not(:disabled) { background: var(--brand-purple-hover); }
      .btn-ghost:hover { background: rgba(100,116,139,0.08); color: #334155; }
      :host-context(.dark) .btn-ghost:hover { background: rgba(148,163,184,0.12); color: #f1f5f9; }
      .btn-warn:hover { background: #d97706; }
    }
    .btn-primary:active, .btn-ghost:active, .btn-warn:active { transform: scale(0.97); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    :host-context(.dark) .btn-ghost { color: #94a3b8; }

    .spinner {
      display: inline-block; width: 1rem; height: 1rem; border-radius: 9999px;
      border: 2px solid currentColor; border-top-color: transparent;
      animation: spin 700ms linear infinite;
    }
    .spinner-brand { color: var(--brand-purple); }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Barra de guardado ──
       Pie fijo del layout — hermana del contenedor con scroll, no hija:
       siempre pegada al borde inferior, el contenido scrollea por encima. */
    .save-bar {
      display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
      padding: 0.75rem 1rem;
      padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      transition: border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out);
    }
    @media (min-width: 640px) { .save-bar { padding-inline: 1.5rem; } }
    @media (min-width: 1024px) { .save-bar { padding-inline: 2.5rem; } }
    :host-context(.dark) .save-bar { background: #0f172a; border-top-color: #334155; }
    .save-bar.is-dirty {
      border-top-color: rgba(109,40,217,0.35);
      box-shadow: 0 -6px 20px -8px rgba(109,40,217,0.25);
    }
    :host-context(.dark) .save-bar.is-dirty { border-top-color: rgba(167,139,250,0.35); }

    .save-hint {
      display: inline-flex; align-items: center; gap: 0.5rem;
      font-size: 0.75rem; font-weight: 600; color: #b45309;
      min-width: 0;
    }
    :host-context(.dark) .save-hint { color: #fbbf24; }
    .save-hint-ok { color: #059669; font-weight: 500; }
    :host-context(.dark) .save-hint-ok { color: #34d399; }

    @keyframes dotPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.35); opacity: 0.6; }
    }
    .save-dot {
      width: 0.5rem; height: 0.5rem; border-radius: 9999px; background: #f59e0b;
      animation: dotPulse 1.6s ease-in-out infinite;
    }

    @keyframes btnGlow {
      0%, 100% { box-shadow: 0 1px 2px rgba(109,40,217,0.18); }
      50% { box-shadow: 0 0 0 5px rgba(109,40,217,0.18); }
    }
    .btn-pulse:not(:disabled) { animation: btnGlow 2s ease-in-out infinite; }

    /* ── Banner de conflicto ── */
    .conflict-banner {
      display: flex; align-items: flex-start; gap: 0.75rem;
      background: #fffbeb; border: 1px solid #fcd34d; color: #92400e;
      border-radius: 0.875rem; padding: 0.75rem 1rem; font-size: 0.8125rem;
      flex-wrap: wrap;
    }
    :host-context(.dark) .conflict-banner { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.35); color: #fbbf24; }

    /* ── Dropzone ── */
    .dropzone {
      display: flex; align-items: center; justify-content: center;
      min-height: 10rem; border: 2px dashed #e2e8f0; border-radius: 1rem;
      cursor: pointer; transition: border-color 160ms, background-color 160ms;
      padding: 1.5rem;
    }
    :host-context(.dark) .dropzone { border-color: #334155; }
    @media (hover: hover) { .dropzone:hover { border-color: #c4b5fd; background: rgba(109,40,217,0.02); } }
    .dropzone.is-dragging { border-color: var(--brand-purple); background: rgba(109,40,217,0.05); }
    .btn-elegir {
      display: inline-flex; margin-top: 0.75rem;
      padding: 0.4rem 0.9rem; font-size: 0.75rem; font-weight: 600;
      border-radius: 0.625rem; background: rgba(109,40,217,0.08); color: var(--brand-purple);
    }
    :host-context(.dark) .btn-elegir { background: rgba(167,139,250,0.12); color: #a78bfa; }

    /* ── Filas de archivo ── */
    @keyframes rowIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    .file-row {
      display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
      padding: 0.625rem 0.75rem; border-radius: 0.75rem;
      border: 1px solid #f1f5f9; background: #fff;
      animation: rowIn 280ms var(--ease-out) both;
      animation-delay: var(--stagger, 0ms);
    }
    :host-context(.dark) .file-row { background: #1e293b; border-color: #334155; }
    .file-ico {
      width: 2rem; height: 2rem; border-radius: 0.5rem;
      background: #f1f5f9; color: #64748b;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    :host-context(.dark) .file-ico { background: #334155; color: #cbd5e1; }

    /* ── Toasts ── */
    @keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    .toast-item {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.75rem 0.875rem; border-radius: 0.875rem;
      box-shadow: 0 8px 24px -6px rgba(0,0,0,0.18);
      animation: toastIn 240ms var(--ease-out) both;
    }
    .toast-success { background: #059669; color: #fff; }
    .toast-error { background: #e11d48; color: #fff; }
    .toast-info { background: #334155; color: #fff; }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }
  `],
})
export class VisitaColaboradorPage implements OnInit {
  private svc = inject(VisitaService);

  visitas = signal<Visita[]>([]);
  seleccionada = signal<Visita | null>(null);
  archivos = signal<{ nombre: string; tamano_bytes: number }[]>([]);
  agendaItems = signal<AgendaItem[]>([]);
  agendaSecciones = signal<AgendaSecciones>({});
  activeTab = signal<Tab>('agenda');

  cargando = signal(true);
  guardando = signal(false);
  subiendo = signal(false);
  isDragging = signal(false);
  conflictoAgenda = signal(false);
  notifications = signal<Toast[]>([]);

  agendaDirty = signal(false);
  /** Snapshot (JSON) de la agenda tal como está guardada — comparamos contenido real,
   *  no un contador de eventos (un evento espurio del date/time picker no debe
   *  dejar el botón de guardar activado sin que el usuario haya editado nada). */
  private agendaBaseline = '';

  /** actualizado_en de la visita al cargar la agenda — para detectar ediciones concurrentes. */
  private agendaBase: string | null = null;
  private _nId = 0;

  ngOnInit() {
    this.svc.misColaboraciones().subscribe({
      next: (vs) => {
        this.visitas.set(vs);
        this.cargando.set(false);
        if (vs.length === 1) this.abrir(vs[0]);
      },
      error: () => {
        this.cargando.set(false);
        this.toast('error', 'No se pudieron cargar tus visitas');
      },
    });
  }

  abrir(v: Visita) {
    this.seleccionada.set(v);
    this.activeTab.set('agenda');
    this.conflictoAgenda.set(false);
    this.cargarAgendaDesde(v);
    this.svc.listarArchivos(v.id_visita).subscribe({
      next: (a) => this.archivos.set(a),
      error: () => this.toast('error', 'No se pudieron cargar los archivos'),
    });
  }

  private cargarAgendaDesde(v: Visita) {
    const items = v.agenda_json?.items?.length ? structuredClone(v.agenda_json.items) : [{ dia: '', actividad: '' }];
    this.agendaItems.set(items);
    this.agendaSecciones.set(v.agenda_json?.secciones ? structuredClone(v.agenda_json.secciones) : {});
    this.agendaBase = v.actualizado_en;
    this.agendaBaseline = this.snapshotAgenda();
    this.agendaDirty.set(false);
  }

  private snapshotAgenda(): string {
    return JSON.stringify({ items: this.agendaItems(), secciones: this.agendaSecciones() });
  }

  markAgendaDirty() {
    this.agendaDirty.set(this.snapshotAgenda() !== this.agendaBaseline);
  }

  recargarAgenda() {
    const v = this.seleccionada();
    if (!v) return;
    this.conflictoAgenda.set(false);
    this.svc.get(v.id_visita).subscribe({
      next: (fresh) => {
        this.seleccionada.set(fresh);
        this.visitas.update(arr => arr.map(x => x.id_visita === fresh.id_visita ? fresh : x));
        this.cargarAgendaDesde(fresh);
        this.toast('info', 'Agenda recargada con la última versión');
      },
      error: () => this.toast('error', 'No se pudo recargar la visita'),
    });
  }

  guardarAgenda(forzar = false) {
    const v = this.seleccionada();
    if (!v) return;
    this.guardando.set(true);
    this.conflictoAgenda.set(false);

    const enviar = () => {
      this.svc.generarAgenda({
        id_visita: v.id_visita,
        titulo: `Agenda Visita del Superintendente — ${v.semestre || ''}`.trim(),
        items: this.agendaItems().filter(i => i.actividad?.trim()),
        secciones: this.seccionesLimpias(),
      }).subscribe({
        next: (updated) => {
          this.seleccionada.set(updated);
          this.visitas.update(arr => arr.map(x => x.id_visita === updated.id_visita ? updated : x));
          this.agendaBase = updated.actualizado_en;
          this.agendaBaseline = this.snapshotAgenda();
          this.agendaDirty.set(false);
          this.toast('success', 'Agenda guardada correctamente');
          this.guardando.set(false);
        },
        error: (e) => {
          this.toast('error', e?.error?.detail || 'Error al guardar la agenda');
          this.guardando.set(false);
        },
      });
    };

    if (forzar) { enviar(); return; }

    // Detección simple de edición concurrente (last write wins con aviso)
    this.svc.get(v.id_visita).subscribe({
      next: (fresh) => {
        if (this.agendaBase && fresh.actualizado_en !== this.agendaBase) {
          this.conflictoAgenda.set(true);
          this.guardando.set(false);
          return;
        }
        enviar();
      },
      error: () => enviar(), // si la verificación falla, no bloqueamos el guardado
    });
  }

  /** Solo filas con al menos un campo diligenciado, por sección. */
  private seccionesLimpias(): AgendaSecciones {
    const out: AgendaSecciones = {};
    for (const [id, filas] of Object.entries(this.agendaSecciones())) {
      const conDatos = (filas ?? []).filter(f =>
        Object.values(f).some(v => (v ?? '').toString().trim())
      );
      if (conDatos.length) out[id] = conDatos;
    }
    return out;
  }

  // ── Archivos ──

  onDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(true);
  }
  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length && this.seleccionada()) this.uploadFiles(files);
  }
  onFile(input: HTMLInputElement) {
    const files = Array.from(input.files ?? []);
    if (!files.length) return;
    this.uploadFiles(files);
    input.value = '';
  }

  private uploadFiles(files: File[]) {
    const v = this.seleccionada();
    if (!v || !files.length) return;
    this.subiendo.set(true);
    let pendientes = files.length;
    let subidos = 0;
    files.forEach(file => {
      this.svc.subirArchivo(v.id_visita, file).subscribe({
        next: () => { subidos++; if (--pendientes === 0) this.finalizarSubida(v.id_visita, subidos); },
        error: (e) => {
          this.toast('error', e?.error?.detail || `Error al subir "${file.name}"`);
          if (--pendientes === 0) this.finalizarSubida(v.id_visita, subidos);
        },
      });
    });
  }

  private finalizarSubida(idVisita: number, subidos: number) {
    this.svc.listarArchivos(idVisita).subscribe({
      next: (a) => {
        this.archivos.set(a);
        this.subiendo.set(false);
        if (subidos > 0) this.toast('success', subidos === 1 ? 'Archivo subido' : `${subidos} archivos subidos`);
      },
      error: () => { this.subiendo.set(false); this.toast('error', 'Error al recargar la lista de archivos'); },
    });
  }

  // ── Toasts ──

  toast(type: ToastType, msg: string, duration = 4000) {
    const id = ++this._nId;
    this.notifications.update(n => [...n, { id, type, msg }]);
    if (duration > 0) setTimeout(() => this.dismissToast(id), duration);
  }

  dismissToast(id: number) {
    this.notifications.update(n => n.filter(x => x.id !== id));
  }
}
