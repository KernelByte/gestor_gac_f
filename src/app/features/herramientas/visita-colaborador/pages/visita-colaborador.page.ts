import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VisitaService } from '../../../secretario-tools/services/visita.service';
import { AgendaItem, AgendaSecciones, Visita } from '../../../secretario-tools/models/visita.model';
import { AgendaEditorComponent } from '../../../secretario-tools/visita-superintendente/components/agenda-editor.component';
import { EntregaMetodosComponent } from '../../../secretario-tools/visita-superintendente/components/entrega-metodos.component';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { AuthStore } from '../../../../core/auth/auth.store';

type Tab = 'agenda' | 'docs' | 'entrega';
type ToastType = 'success' | 'error' | 'info';

/**
 * Pantalla simplificada para COLABORADORES de la Visita del Superintendente:
 * usuarios (p.ej. ancianos) invitados por el secretario para completar la
 * agenda, subir documentos y entregar la visita. Eliminar documentos queda
 * reservado al coordinador de ancianos y al superintendente de servicio (ver
 * `puedeEliminarDocs`); el resto de la gestión sigue siendo del secretario.
 */
@Component({
  standalone: true,
  selector: 'app-visita-colaborador',
  imports: [CommonModule, FormsModule, AgendaEditorComponent, EntregaMetodosComponent, PageHeaderComponent, EmptyStateComponent],
  template: `
  <div class="h-full flex flex-col overflow-hidden">
    <app-page-header eyebrow="Colaboración" title="Visita del Superintendente"
      subtitle="Completa la agenda y adjunta los documentos que te corresponden."></app-page-header>

    <div class="flex-1 flex flex-col rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800 min-h-0">

      <!-- ───────── BODY ───────── -->
      <div class="flex-1 bg-white dark:bg-slate-900 min-h-0 overflow-y-auto">

        @if (cargando()) {
          <div class="p-6 space-y-3">
            @for (s of [0,1]; track s) {
              <div class="skeleton h-20 rounded-2xl"></div>
            }
          </div>
        } @else if (!visitas().length) {
          <!-- Empty state: no colabora en ninguna visita -->
          <app-empty-state icon="calendar" title="No tienes visitas asignadas"
            description="Cuando el secretario te invite a colaborar en una visita del superintendente, aparecerá aquí y recibirás una notificación."></app-empty-state>
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
            <div class="px-4 sm:px-6 lg:px-10 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white/95 dark:bg-slate-900/95 sticky top-0 z-10">
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
                <button (click)="seleccionada.set(null)" class="btn-ghost btn-sm shrink-0">Cambiar visita</button>
              }
            </div>

            <!-- Tabs -->
            <div class="px-4 sm:px-6 lg:px-10 pt-3">
              <nav class="tab-nav" role="tablist">
                <button type="button" role="tab" class="tab-item"
                        [attr.aria-selected]="activeTab() === 'agenda'" (click)="activeTab.set('agenda')">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  Agenda
                  @if (agendaDirty()) { <span class="tab-dirty" title="Cambios sin guardar"></span> }
                </button>
                <button type="button" role="tab" class="tab-item"
                        [attr.aria-selected]="activeTab() === 'docs'" (click)="activeTab.set('docs')">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  Documentos
                  @if (archivos().length) { <span class="tab-count">{{ archivos().length }}</span> }
                </button>
                <button type="button" role="tab" class="tab-item"
                        [attr.aria-selected]="activeTab() === 'entrega'" (click)="activeTab.set('entrega')">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
                  Entrega
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
                      <button (click)="recargarAgenda()" class="btn-ghost btn-sm">Recargar</button>
                      <button (click)="guardarAgenda(true)" class="btn-primary-orange btn-sm">Guardar igual</button>
                    </div>
                  </div>
                }

                <app-agenda-editor
                  [items]="agendaItems()"
                  [secciones]="agendaSecciones()"
                  [idCongregacion]="seleccionada()?.id_congregacion ?? null"
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
                    <div class="mx-auto w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-900/30 text-brand-purple flex items-center justify-center mb-2">
                      @if (subiendo()) {
                        <span class="spinner" style="color: var(--color-brand-purple)"></span>
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

                @if (!puedeEliminarDocs()) {
                  <p class="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    Solo el secretario, el coordinador de ancianos o el superintendente de servicio pueden eliminar documentos.
                  </p>
                }

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
                        <div class="flex items-center gap-2 shrink-0">
                          <span class="text-xs text-slate-400 tabular-nums">{{ (a.tamano_bytes / 1024) | number:'1.0-0' }} KB</span>
                          @if (puedeEliminarDocs()) {
                            @if (pendingDeleteFile() === a.nombre) {
                              <div class="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
                                <span class="text-xs text-rose-600 dark:text-rose-400 font-medium whitespace-nowrap">¿Eliminar?</span>
                                <button (click)="confirmarEliminarArchivo(a.nombre)" class="text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded-md transition-colors" style="min-height: 2rem">Sí</button>
                                <button (click)="pendingDeleteFile.set(null)" class="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 px-1.5 py-1" style="min-height: 2rem">No</button>
                              </div>
                            } @else {
                              <button (click)="pendingDeleteFile.set(a.nombre)" class="btn-icon-sm tone-danger" [attr.aria-label]="'Eliminar ' + a.nombre">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22"/></svg>
                              </button>
                            }
                          }
                        </div>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="text-sm text-slate-400 italic px-1">Aún no hay documentos en esta visita.</p>
                }
              </section>
            }

            <!-- Tab: Entrega -->
            @if (activeTab() === 'entrega') {
              <section class="p-4 sm:p-6 lg:px-10 space-y-4">
                <app-entrega-metodos
                  [idVisita]="seleccionada()!.id_visita"
                  [correoSugerido]="seleccionada()!.correo_superintendente || null"
                  (aviso)="toast($event.type, $event.msg)">
                </app-entrega-metodos>
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
            @if (guardando()) { <span class="spinner spinner-sm"></span> Guardando… } @else {
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              Guardar agenda
            }
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
      --brand-purple: var(--color-brand-purple);
      --brand-purple-hover: #5B21B6;
    }

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

    .tab-dirty {
      width: 0.5rem; height: 0.5rem; border-radius: 9999px; background: #f59e0b;
    }

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
  private auth = inject(AuthStore);

  /** Nombre del archivo con la confirmación de borrado abierta. */
  pendingDeleteFile = signal<string | null>(null);

  /**
   * El coordinador de ancianos y el superintendente de servicio comparten con
   * el secretario la responsabilidad del arreglo de la visita, así que también
   * retiran documentos. Se compara por prefijo porque el nombre del rol varía
   * ("Coordinador", "Coordinador del cuerpo de ancianos"). El backend aplica la
   * misma regla: esto solo evita mostrar un botón que fallaría.
   */
  puedeEliminarDocs = computed(() => {
    const rol = (this.auth.user()?.rol ?? '').trim().toLowerCase();
    return rol.startsWith('coordinador') || rol.startsWith('superintendente de servicio');
  });

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
  private toastSvc = inject(ToastService);

  agendaDirty = signal(false);
  /** Snapshot (JSON) de la agenda tal como está guardada — comparamos contenido real,
   *  no un contador de eventos (un evento espurio del date/time picker no debe
   *  dejar el botón de guardar activado sin que el usuario haya editado nada). */
  private agendaBaseline = '';

  /** actualizado_en de la visita al cargar la agenda — para detectar ediciones concurrentes. */
  private agendaBase: string | null = null;

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

  confirmarEliminarArchivo(nombre: string) {
    const v = this.seleccionada();
    if (!v) return;
    this.pendingDeleteFile.set(null);
    this.svc.eliminarArchivo(v.id_visita, nombre).subscribe({
      next: () => {
        this.archivos.update(arr => arr.filter(a => a.nombre !== nombre));
        this.toast('success', 'Documento eliminado');
      },
      error: (e) => this.toast('error', e?.error?.detail || 'No se pudo eliminar el documento'),
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
    // Igual que en la página del secretario: una fila con datos pero sin actividad no se
    // descarta en silencio (antes desaparecía al reabrir aunque se veía guardada).
    const vacio = (x: unknown) => !(x ?? '').toString().trim();
    const items: AgendaItem[] = [];
    const incompletas: number[] = [];
    this.agendaItems().forEach((i, idx) => {
      const conDatos = [i.dia, i.hora_inicio, i.hora_fin, i.actividad, i.responsable, i.lugar, i.notas]
        .some(x => !vacio(x));
      if (!conDatos) return; // fila en blanco: se omite
      if (vacio(i.actividad)) { incompletas.push(idx + 1); return; }
      items.push({ ...i, dia: i.dia ?? '' });
    });
    if (incompletas.length) {
      this.toast('error', `Completa la actividad de la fila ${incompletas.join(', ')} o bórrala antes de guardar.`, 6000);
      return;
    }
    this.guardando.set(true);
    this.conflictoAgenda.set(false);

    // El servidor compara la versión con la que se abrió y responde 409 si otro guardó
    // mientras tanto (antes se comprobaba aquí con una lectura previa, que dejaba un hueco).
    this.svc.generarAgenda({
      id_visita: v.id_visita,
      titulo: `Agenda Visita del Superintendente — ${v.semestre || ''}`.trim(),
      items,
      secciones: this.seccionesLimpias(),
      esperado_actualizado_en: forzar ? null : this.agendaBase,
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
        this.guardando.set(false);
        if (e?.status === 409) { this.conflictoAgenda.set(true); return; }
        this.toast('error', e?.error?.detail || 'Error al guardar la agenda');
      },
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
    this.toastSvc[type](msg, undefined, duration);
  }
}
