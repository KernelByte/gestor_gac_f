import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActaService } from '../../services/acta.service';
import { Acta, TipoReunion } from '../../models/acta.model';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../../core/auth/auth.store';
import { PageHeaderComponent, ModalComponent, ConfirmDialogComponent, EmptyStateComponent, ToastService } from '../../../../shared/components';
import { puedeEditarActas } from '../../../../core/auth/acceso-modulos';

const TIPO_LABEL: Record<TipoReunion, string> = {
  ancianos: 'Reunión de ancianos',
  trimestral: 'Reunión trimestral',
  comite_servicio: 'Comité de servicio',
  otra: 'Otra reunión',
};

type ToastType = 'error' | 'success' | 'info';

@Component({
  standalone: true,
  selector: 'app-actas-list',
  imports: [CommonModule, FormsModule, PageHeaderComponent, ModalComponent, ConfirmDialogComponent, EmptyStateComponent],
  template: `
  <div class="h-full flex flex-col overflow-hidden">

    <app-page-header eyebrow="Administración" title="Actas de reunión"
      [subtitle]="puedeEditar ? 'Crea o busca un acta — cada reunión queda registrada aquí.' : 'Actas de las reuniones de ancianos. Puede leerlas y descargarlas.'">
      @if (puedeEditar) {
        <button (click)="abrirNueva()" class="btn-primary max-md:hidden" type="button">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
          <span>Nueva acta</span>
        </button>
      }
    </app-page-header>

    <!-- ───────── BODY ───────── -->
    <div class="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">

      <label class="search-field max-w-sm">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z"/></svg>
        <input class="search-input" placeholder="Buscar acta…" aria-label="Buscar acta"
               [ngModel]="busqueda()"
               (ngModelChange)="onBusqueda($event)" />
      </label>

      <!-- Formulario nueva acta -->
      @if (creando()) {
        <app-modal [open]="true" title="Nueva acta" variant="sheet" size="xl" [hasFooter]="true" (openChange)="$event || creando.set(false)">
          <div #formNueva class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label class="block">
              <span class="form-label">Tipo <em class="text-rose-500 not-italic">*</em></span>
              <div class="tipo-select" [class.is-open]="tipoOpen()">
                @if (tipoOpen()) {
                  <div class="tipo-backdrop" (click)="tipoOpen.set(false)"></div>
                }
                <button type="button" class="tipo-trigger" (click)="tipoOpen.set(!tipoOpen())" [attr.aria-expanded]="tipoOpen()">
                  <span class="tipo-trigger-ico">
                    @switch (form.tipo_reunion) {
                      @case ('ancianos')        { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-5.356-3.771M9 20H4v-2a4 4 0 015.356-3.771M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0zm-18 0a3 3 0 116 0 3 3 0 01-6 0z"/></svg> }
                      @case ('trimestral')      { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 2v4M8 2v4M3 10h18"/></svg> }
                      @case ('comite_servicio') { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> }
                      @default                  { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> }
                    }
                  </span>
                  <span class="tipo-trigger-label">{{ getTipoLabel(form.tipo_reunion) }}</span>
                  <svg class="tipo-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6"/></svg>
                </button>
                @if (tipoOpen()) {
                  <div class="tipo-dropdown" role="listbox">
                    @for (op of tipoOpciones; track op.value) {
                      <button type="button" class="tipo-option" role="option"
                              [class.is-selected]="form.tipo_reunion === op.value"
                              (click)="seleccionarTipo(op.value)">
                        <span class="tipo-opt-ico">
                          @switch (op.value) {
                            @case ('ancianos')        { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-5.356-3.771M9 20H4v-2a4 4 0 015.356-3.771M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0zm-18 0a3 3 0 116 0 3 3 0 01-6 0z"/></svg> }
                            @case ('trimestral')      { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 2v4M8 2v4M3 10h18"/></svg> }
                            @case ('comite_servicio') { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg> }
                            @default               { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> }
                          }
                        </span>
                        <span class="tipo-opt-text">
                          <span class="tipo-opt-label">{{ op.label }}</span>
                          <span class="tipo-opt-desc">{{ op.desc }}</span>
                        </span>
                        @if (form.tipo_reunion === op.value) {
                          <svg class="tipo-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        }
                      </button>
                    }
                  </div>
                }
              </div>
            </label>
            <label class="block">
              <span class="form-label">Título <em class="text-rose-500 not-italic">*</em></span>
              <input class="form-control" [(ngModel)]="form.titulo" placeholder="Ej. Reunión semanal de ancianos" />
            </label>
            <div>
              <span class="form-label">Fecha <em class="text-rose-500 not-italic">*</em></span>

              <!-- Custom date picker -->
              <div class="fecha-wrap" [class.is-open]="fechaPickerOpen()">
                @if (fechaPickerOpen()) {
                  <div class="fecha-backdrop" (click)="fechaPickerOpen.set(false)"></div>
                }

                <!-- Trigger -->
                <button type="button" class="fecha-trigger" (click)="abrirFechaPicker()" [class.has-value]="form.fecha_reunion">
                  <svg class="fecha-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path stroke-linecap="round" stroke-linejoin="round" d="M16 2v4M8 2v4M3 10h18"/></svg>
                  @if (form.fecha_reunion) {
                    <span class="fecha-value">{{ formatFechaDisplay(form.fecha_reunion) }}</span>
                    <button type="button" class="fecha-clear" (click)="clearFecha($event)" aria-label="Borrar fecha">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
                    </button>
                  } @else {
                    <span class="fecha-placeholder">Seleccionar fecha</span>
                  }
                </button>

                <!-- Calendar panel -->
                @if (fechaPickerOpen()) {
                  <div class="cal-panel" role="dialog" aria-label="Seleccionar fecha">
                    <div class="cal-handle-row" aria-hidden="true"><div class="cal-handle"></div></div>

                    <!-- Header -->
                    <div class="cal-header">
                      <button type="button" class="cal-nav" (click)="prevMonth()" aria-label="Mes anterior">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6"/></svg>
                      </button>
                      <div class="cal-month-label">{{ calMonthName() }} <span class="cal-year">{{ calYear() }}</span></div>
                      <button type="button" class="cal-nav" (click)="nextMonth()" aria-label="Mes siguiente">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"/></svg>
                      </button>
                    </div>

                    <!-- Weekdays -->
                    <div class="cal-weekdays">
                      @for (wd of calWeekdays; track wd) { <span>{{ wd }}</span> }
                    </div>

                    <!-- Days grid -->
                    <div class="cal-grid">
                      @for (day of calendarDays(); track day.key) {
                        <button type="button" class="cal-day"
                                [class.other-month]="!day.currentMonth"
                                [class.is-today]="day.isToday"
                                [class.is-selected]="form.fecha_reunion === day.key"
                                (click)="selectDay(day.key)">
                          {{ day.day }}
                        </button>
                      }
                    </div>

                    <!-- Footer: hoy -->
                    <div class="cal-footer">
                      <button type="button" class="cal-today-btn" (click)="selectToday()">Hoy</button>
                    </div>
                  </div>
                }
              </div>

              @if (fechaEsFutura) {
                <span class="field-hint-warn">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                  La fecha es futura
                </span>
              }
            </div>
          </div>
          <ng-container slot="footer">
            
              <button (click)="creando.set(false)" class="btn-ghost" type="button">Cancelar</button>
              <button (click)="crear()" [disabled]="!form.titulo || !form.fecha_reunion || guardando()" class="btn-primary" type="button">
                @if (guardando()) {
                  <span class="spinner spinner-xs" aria-hidden="true"></span>
                  Creando…
                } @else {
                  Crear y abrir
                }
              </button>
            
          </ng-container>
        </app-modal>
      }

      <!-- Filtros + Grid -->
      <div class="w-full flex-1 flex flex-col gap-5">


        <!-- Estado de carga -->
        @if (cargando()) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            @for (_ of skeletons; track $index) {
              <div class="card card-padded">
                <div class="skeleton h-9 w-9 rounded-xl"></div>
                <div class="skeleton h-4 w-4/5 mt-3"></div>
                <div class="skeleton h-3 w-1/2 mt-2"></div>
                <div class="skeleton h-3 w-full mt-4"></div>
              </div>
            }
          </div>
        }

        <!-- Empty state — lista vacía sin búsqueda -->
        @else if (!actas().length) {
          <app-empty-state [compact]="true" icon="file-text" title="Aún no hay actas"
            [description]="puedeEditar ? 'Crea tu primera acta para empezar a registrar reuniones.' : 'Cuando el secretario pase una reunión de ancianos a acta, aparecerá aquí.'"
            [actionLabel]="puedeEditar ? 'Nueva acta' : ''" (action)="abrirNueva()"></app-empty-state>
        }

        <!-- Grid de actas -->
        @else {
          <div class="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            @for (a of filtradas(); track a.id_acta; let i = $index) {
              <div class="acta-card-wrap">
                <button type="button"
                        (click)="abrir(a)"
                        class="acta-card group text-left"
                        [class.acta-card--draft]="a.estado !== 'finalizada'"
                        [style.--stagger]="i * 35 + 'ms'">
                  <div class="card-glow"></div>
                  <div class="flex items-center justify-between gap-3 mb-3 relative z-10 card-top-row">
                    <div class="acta-icon">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    </div>
                    <span class="badge" [class.badge-active]="a.estado === 'finalizada'" [class.badge-warning]="a.estado !== 'finalizada'">
                      <span class="badge-dot"></span>
                      {{ a.estado === 'finalizada' ? 'Finalizada' : 'Borrador' }}
                    </span>
                  </div>

                  <div class="acta-card-body relative z-10">
                    <h3 class="card-title line-clamp-2">{{ a.titulo }}</h3>
                    <p class="card-tipo">{{ tipoLabel[a.tipo_reunion] }}</p>
                  </div>

                  <div class="acta-card-footer relative z-10">
                    <span class="card-date">
                      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      {{ formatFecha(a.fecha_reunion) }}
                    </span>
                    <span class="card-open-link">
                      Abrir
                      <svg class="card-open-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </span>
                  </div>
                </button>

                <!-- Solo borradores: eliminar (por si se creó por error) -->
                @if (puedeEditar && a.estado !== 'finalizada') {
                  <button type="button" class="card-delete-btn"
                          (click)="pedirEliminar(a, $event)"
                          aria-label="Eliminar borrador" title="Eliminar borrador">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                }
              </div>
            }

            <!-- Tarjeta "nueva acta" — oculta cuando hay búsqueda activa -->
            @if (puedeEditar && !busqueda()) {
              <button type="button" (click)="abrirNueva()" class="acta-card-new group"
                      [style.--stagger]="filtradas().length * 35 + 'ms'">
                <div class="new-card-plus">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
                </div>
                <span class="new-card-label">Crear nueva acta</span>
                <span class="new-card-sub">Inicia un documento en blanco</span>
              </button>
            }
          </div>

          @if (!filtradas().length && busquedaDebounced().trim()) {
            <p class="text-sm text-center text-slate-400 dark:text-slate-600 py-2">
              Sin resultados para "<strong class="text-slate-600 dark:text-slate-400">{{ busquedaDebounced() }}</strong>". Prueba con otro término.
            </p>
          }
        }

      </div><!-- /filtros+grid wrapper -->
    </div><!-- /body -->

    <!-- Mobile FAB — Nueva acta (fijo en esquina inferior derecha) -->
    @if (puedeEditar) {
    <button type="button" (click)="abrirNueva()" class="mobile-fab-nueva" aria-label="Nueva acta">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/>
      </svg>
    </button>
    }

    <!-- ───────── MODAL: Eliminar borrador ───────── -->
    @if (actaAEliminar(); as aDel) {
      <app-confirm-dialog [open]="true" title="Eliminar borrador" severity="danger"
        [message]="'Se eliminará esta acta de forma permanente. Esta acción no se puede deshacer. ' + aDel.titulo"
        confirmLabel="Eliminar" [busy]="eliminando()"
        (confirmed)="eliminarConfirmado()" (openChange)="$event || actaAEliminar.set(null)"></app-confirm-dialog>
    }

  </div>
  `,
  styles: [`
    :host {
      display: block; height: 100%;
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --brand-purple: var(--color-brand-purple);
      --brand-purple-hover: #5B21B6;
      --brand-emerald: #10B981;
      --brand-amber: #F59E0B;
      --brand-rose: #F43F5E;
    }

    @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    .field-hint-warn {
      display: inline-flex; align-items: center; gap: 0.25rem;
      margin-top: 0.3rem; font-size: 0.75rem; color: #92400e; font-weight: 500;
    }
    :host-context(.dark) .field-hint-warn { color: #fbbf24; }

    /* ── Custom tipo select ── */
    .tipo-select { position: relative; }
    .tipo-backdrop { position: fixed; inset: 0; z-index: 20; }

    .tipo-trigger {
      display: flex; align-items: center; gap: 0.625rem; width: 100%;
      padding: 0.5625rem 0.75rem; min-height: 2.75rem;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem;
      font-size: 0.8125rem; color: #1e293b; text-align: left; cursor: pointer;
      transition: border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
    }
    .tipo-select.is-open .tipo-trigger { border-color: var(--color-brand-purple); box-shadow: 0 0 0 3px rgba(109,40,217,0.12); }
    :host-context(.dark) .tipo-trigger { background: #1e293b; border-color: #334155; color: #f1f5f9; }
    :host-context(.dark) .tipo-select.is-open .tipo-trigger { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.18); }

    .tipo-trigger-ico {
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      width: 1.5rem; height: 1.5rem; border-radius: 0.4rem;
      background: rgba(109,40,217,0.08); color: var(--color-brand-purple);
    }
    .tipo-trigger-ico svg { width: 0.875rem; height: 0.875rem; }
    :host-context(.dark) .tipo-trigger-ico { background: rgba(167,139,250,0.12); color: #a78bfa; }

    .tipo-trigger-label { flex: 1; font-weight: 500; }
    .tipo-chevron {
      width: 1rem; height: 1rem; color: #94a3b8; flex-shrink: 0;
      transition: transform 200ms var(--ease-out);
    }
    .tipo-select.is-open .tipo-chevron { transform: rotate(180deg); }

    .tipo-dropdown {
      position: absolute; top: calc(100% + 4px); left: 0; right: 0; z-index: 21;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 0.875rem;
      box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
      padding: 0.375rem; overflow: hidden;
      animation: dropdownIn 140ms var(--ease-out) both;
    }
    :host-context(.dark) .tipo-dropdown { background: #1a2236; border-color: #2d3f5e; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
    @keyframes dropdownIn { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: none; } }

    .tipo-option {
      display: flex; align-items: center; gap: 0.75rem; width: 100%;
      padding: 0.625rem 0.75rem; border-radius: 0.625rem; text-align: left; cursor: pointer;
      transition: background 120ms var(--ease-out);
    }
    @media (hover: hover) { .tipo-option:hover { background: #f8f5ff; } }
    :host-context(.dark) .tipo-option:hover { background: rgba(109,40,217,0.12); }
    .tipo-option.is-selected { background: #f3f0ff; }
    :host-context(.dark) .tipo-option.is-selected { background: rgba(109,40,217,0.18); }

    .tipo-opt-ico {
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      width: 2rem; height: 2rem; border-radius: 0.5rem;
      background: rgba(109,40,217,0.07); color: var(--color-brand-purple);
      transition: background 120ms;
    }
    .tipo-opt-ico svg { width: 1rem; height: 1rem; }
    .tipo-option.is-selected .tipo-opt-ico { background: rgba(109,40,217,0.14); }
    :host-context(.dark) .tipo-opt-ico { background: rgba(167,139,250,0.1); color: #a78bfa; }

    .tipo-opt-text { flex: 1; display: flex; flex-direction: column; gap: 0.1rem; }
    .tipo-opt-label { font-size: 0.8125rem; font-weight: 600; color: #1e293b; line-height: 1.3; }
    .tipo-opt-desc  { font-size: 0.75rem; color: #94a3b8; line-height: 1.3; }
    .tipo-option.is-selected .tipo-opt-label { color: var(--color-brand-purple); }
    :host-context(.dark) .tipo-opt-label { color: #e2e8f0; }
    :host-context(.dark) .tipo-option.is-selected .tipo-opt-label { color: #c4b5fd; }
    :host-context(.dark) .tipo-opt-desc { color: #64748b; }

    .tipo-check { width: 0.9rem; height: 0.9rem; color: var(--color-brand-purple); flex-shrink: 0; }
    :host-context(.dark) .tipo-check { color: #a78bfa; }

    /* ── Custom date picker ── */
    .fecha-wrap { position: relative; }
    .fecha-backdrop { position: fixed; inset: 0; z-index: 44; }

    .fecha-trigger {
      display: flex; align-items: center; gap: 0.5rem; width: 100%;
      padding: 0.5625rem 0.75rem; min-height: 2.75rem;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 0.75rem;
      font-size: 0.8125rem; color: #1e293b; text-align: left; cursor: pointer;
      transition: border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
    }
    .fecha-wrap.is-open .fecha-trigger,
    .fecha-trigger:focus { outline: none; border-color: var(--color-brand-purple); box-shadow: 0 0 0 3px rgba(109,40,217,0.12); }
    :host-context(.dark) .fecha-trigger { background: #1e293b; border-color: #334155; color: #f1f5f9; }
    :host-context(.dark) .fecha-wrap.is-open .fecha-trigger { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.18); }

    .fecha-ico { width: 1rem; height: 1rem; color: #94a3b8; flex-shrink: 0; }
    .fecha-wrap.is-open .fecha-ico, .fecha-trigger.has-value .fecha-ico { color: var(--color-brand-purple); }
    :host-context(.dark) .fecha-ico { color: #64748b; }
    :host-context(.dark) .fecha-trigger.has-value .fecha-ico { color: #a78bfa; }

    .fecha-value { flex: 1; font-weight: 500; text-transform: capitalize; }
    .fecha-placeholder { flex: 1; color: #94a3b8; font-style: italic; }
    :host-context(.dark) .fecha-placeholder { color: #475569; }

    .fecha-clear {
      display: flex; align-items: center; justify-content: center;
      width: 1.25rem; height: 1.25rem; border-radius: 50%;
      color: #94a3b8; flex-shrink: 0; margin-left: auto;
      transition: background 120ms, color 120ms;
    }
    .fecha-clear svg { width: 0.75rem; height: 0.75rem; }
    .fecha-clear:hover { background: #f1f5f9; color: #475569; }
    :host-context(.dark) .fecha-clear:hover { background: #334155; color: #cbd5e1; }

    /* ── Calendar panel ── */
    .cal-panel {
      position: absolute; top: calc(100% + 4px); left: 0; z-index: 45;
      background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
      padding: 0.875rem; width: 18rem;
      animation: dropdownIn 140ms var(--ease-out) both;
    }
    :host-context(.dark) .cal-panel { background: #1a2236; border-color: #2d3f5e; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }

    .cal-handle-row { display: none; justify-content: center; padding-bottom: 0.75rem; }
    .cal-handle { width: 2.5rem; height: 4px; border-radius: 999px; background: #e2e8f0; }
    :host-context(.dark) .cal-handle { background: #334155; }

    .cal-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.875rem; }
    .cal-month-label { font-size: 0.875rem; font-weight: 700; color: #1e293b; text-transform: capitalize; }
    :host-context(.dark) .cal-month-label { color: #e2e8f0; }
    .cal-year { color: var(--color-brand-purple); }
    :host-context(.dark) .cal-year { color: #a78bfa; }

    .cal-nav {
      width: 2rem; height: 2rem; border-radius: 0.5rem; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      color: #64748b; transition: background 120ms, color 120ms;
    }
    .cal-nav svg { width: 1rem; height: 1rem; }
    .cal-nav:hover { background: #f3f0ff; color: var(--color-brand-purple); }
    :host-context(.dark) .cal-nav { color: #94a3b8; }
    :host-context(.dark) .cal-nav:hover { background: rgba(109,40,217,0.15); color: #a78bfa; }

    .cal-weekdays {
      display: grid; grid-template-columns: repeat(7, 1fr);
      margin-bottom: 0.25rem;
    }
    .cal-weekdays span {
      text-align: center; font-size: 0.75rem; font-weight: 700;
      color: #94a3b8; text-transform: uppercase; padding: 0.25rem 0;
    }
    :host-context(.dark) .cal-weekdays span { color: #475569; }

    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }

    .cal-day {
      aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
      font-size: 0.8125rem; border-radius: 0.5rem; cursor: pointer; color: #1e293b;
      transition: background 100ms, color 100ms;
      min-height: 2.25rem;
    }
    :host-context(.dark) .cal-day { color: #cbd5e1; }
    .cal-day.other-month { color: #cbd5e1; }
    :host-context(.dark) .cal-day.other-month { color: #334155; }
    .cal-day.is-today { font-weight: 700; color: var(--color-brand-purple); }
    :host-context(.dark) .cal-day.is-today { color: #a78bfa; }
    .cal-day.is-today:not(.is-selected)::after {
      content: ''; position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%);
      width: 3px; height: 3px; border-radius: 50%; background: var(--color-brand-purple);
    }
    .cal-day { position: relative; }
    .cal-day.is-selected {
      background: var(--color-brand-purple) !important; color: #fff !important;
      font-weight: 700; border-radius: 50%;
    }
    @media (hover: hover) { .cal-day:not(.is-selected):hover { background: #f3f0ff; color: var(--color-brand-purple); } }
    :host-context(.dark) .cal-day:not(.is-selected):hover { background: rgba(109,40,217,0.15); color: #a78bfa; }

    .cal-footer {
      margin-top: 0.75rem; padding-top: 0.625rem;
      border-top: 1px solid #f1f5f9; display: flex; justify-content: center;
    }
    :host-context(.dark) .cal-footer { border-top-color: #2d3f5e; }
    .cal-today-btn {
      font-size: 0.75rem; font-weight: 600; color: var(--color-brand-purple);
      padding: 0.375rem 0.875rem; border-radius: 0.5rem;
      transition: background 120ms;
    }
    .cal-today-btn:hover { background: #f3f0ff; }
    :host-context(.dark) .cal-today-btn { color: #a78bfa; }
    :host-context(.dark) .cal-today-btn:hover { background: rgba(109,40,217,0.15); }

    /* Mobile: bottom sheet para el calendario */
    @media (max-width: 767px) {
      .fecha-backdrop { z-index: 48; }
      .cal-panel {
        position: fixed; bottom: 0; left: 0; right: 0; top: auto;
        width: auto; border-radius: 1.25rem 1.25rem 0 0;
        z-index: 49; padding: 0 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
        animation: sheetUp 280ms cubic-bezier(0.32, 0.72, 0, 1) both;
        max-height: 80dvh; overflow-y: auto;
      }
      .cal-handle-row { display: flex; padding-top: 0.75rem; }
      .cal-day { min-height: 2.75rem; font-size: 0.9375rem; }
      .cal-weekdays span { font-size: 0.75rem; padding: 0.375rem 0; }
    }

    /* ── Acta card ── */
    .acta-card {
      width: 100%; min-height: 9rem; background: #f8fafc;
      display: flex; flex-direction: column;
      border: 1px solid #e2e8f0; border-radius: 1rem;
      padding: 1.25rem; position: relative; overflow: hidden;
      transition: transform 220ms var(--ease-out), border-color 220ms var(--ease-out), box-shadow 220ms var(--ease-out), background-color 220ms;
      animation: acIn 340ms var(--ease-out) both;
      animation-delay: var(--stagger, 0ms);
      cursor: pointer; touch-action: manipulation;
    }
    @media (max-width: 767px) {
      .acta-card { padding: 1rem; border-radius: 0.875rem; min-height: unset; }
    }
    :host-context(.dark) .acta-card { background: #131b2e; border-color: #1e293b; }
    @keyframes acIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @media (hover: hover) {
      .acta-card:hover { background: #fff; border-color: #c4b5fd; box-shadow: 0 8px 24px rgba(0,0,0,0.13); transform: translateY(-2px); }
      :host-context(.dark) .acta-card:hover { border-color: rgba(109,40,217,0.5); box-shadow: 0 8px 24px rgba(0,0,0,0.32); }
      .acta-card:hover .card-glow { opacity: 1; }
      .acta-card:hover .card-title { color: var(--color-brand-purple); }
      :host-context(.dark) .acta-card:hover .card-title { color: #c4b5fd; }
    }
    .acta-card:active { transform: scale(0.99); }

    .card-glow {
      position: absolute; top: -2.5rem; right: -2.5rem;
      width: 8rem; height: 8rem; border-radius: 9999px;
      background: rgba(109,40,217,0.12); filter: blur(40px);
      opacity: 0; pointer-events: none; transition: opacity 500ms ease;
    }
    :host-context(.dark) .card-glow { background: rgba(109,40,217,0.18); }

    .acta-card-body { flex: 1; display: flex; flex-direction: column; margin-bottom: 0.75rem; }
    .card-title {
      font-size: 0.9375rem; font-weight: 600; line-height: 1.4;
      color: #0f172a; margin-bottom: 0.375rem;
      transition: color 200ms var(--ease-out);
    }
    :host-context(.dark) .card-title { color: #dae2fd; }
    .card-tipo { font-size: 0.75rem; color: #64748b; }
    :host-context(.dark) .card-tipo { color: #94a3b8; }

    .acta-card-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding-top: 0.75rem; border-top: 1px solid #f1f5f9; margin-top: auto;
    }
    :host-context(.dark) .acta-card-footer { border-top-color: #1e293b; }
    .card-date {
      display: inline-flex; align-items: center; gap: 0.375rem;
      font-size: 0.75rem; color: #64748b; font-variant-numeric: tabular-nums;
    }
    :host-context(.dark) .card-date { color: #94a3b8; }
    .card-open-link {
      display: inline-flex; align-items: center; gap: 0.25rem;
      font-size: 0.75rem; font-weight: 600; color: var(--color-brand-purple);
      min-height: 2.75rem; padding: 0 0.25rem;
    }
    :host-context(.dark) .card-open-link { color: #c4b5fd; }
    .card-open-arrow { width: 0.875rem; height: 0.875rem; transition: transform 200ms var(--ease-out); }
    .acta-card:hover .card-open-arrow { transform: translateX(2px); }

    .acta-icon {
      width: 2.25rem; height: 2.25rem; border-radius: 0.625rem; flex-shrink: 0;
      background: linear-gradient(135deg, #ede9fe, #ddd6fe);
      color: var(--color-brand-purple); display: flex; align-items: center; justify-content: center;
      transition: transform 200ms var(--ease-out);
    }
    :host-context(.dark) .acta-icon { background: linear-gradient(135deg, rgba(109,40,217,0.25), rgba(124,58,237,0.2)); color: #c4b5fd; }
    .acta-card:hover .acta-icon { transform: rotate(-4deg); }

    .badge-dot { width: 0.375rem; height: 0.375rem; border-radius: 999px; background: currentColor; }

    /* ── New acta card ── */
    .acta-card-new {
      width: 100%; min-height: 10rem;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.625rem;
      border: 1.5px dashed #cbd5e1; border-radius: 1rem; padding: 1.5rem 1rem;
      color: #94a3b8; cursor: pointer; opacity: 0.55;
      background: rgba(248,250,252,0.5);
      animation: acIn 340ms var(--ease-out) both;
      animation-delay: var(--stagger, 0ms);
      transition: border-color 250ms var(--ease-out), color 250ms var(--ease-out),
                  background-color 250ms var(--ease-out), transform 160ms var(--ease-out),
                  opacity 250ms var(--ease-out);
    }
    :host-context(.dark) .acta-card-new { border-color: rgba(255,255,255,0.1); color: #475569; background: rgba(11,19,38,0.4); }
    @media (hover: hover) and (pointer: fine) {
      .acta-card-new:hover { opacity: 1; border-color: #7c3aed; border-style: solid; color: var(--color-brand-purple); background: #faf5ff; }
      :host-context(.dark) .acta-card-new:hover { opacity: 1; border-color: rgba(109,40,217,0.55); color: #c4b5fd; background: rgba(109,40,217,0.07); }
      .acta-card-new:hover .new-card-plus { background: #ede9fe; color: var(--color-brand-purple); transform: scale(1.1); }
      :host-context(.dark) .acta-card-new:hover .new-card-plus { background: rgba(109,40,217,0.2); color: #c4b5fd; }
    }
    .acta-card-new:active { transform: scale(0.97); }
    .new-card-plus {
      width: 3rem; height: 3rem; border-radius: 999px;
      background: #f1f5f9; color: #94a3b8;
      display: flex; align-items: center; justify-content: center;
      transition: background-color 250ms var(--ease-out), color 250ms var(--ease-out), transform 250ms var(--ease-out);
    }
    :host-context(.dark) .new-card-plus { background: #1e293b; color: #334155; }
    .new-card-label { font-size: 0.875rem; font-weight: 600; color: inherit; }
    .new-card-sub { font-size: 0.75rem; color: inherit; opacity: 0.7; }

    .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }


    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    /* ── Mobile FAB — Nueva acta ── */
    .mobile-fab-nueva {
      display: none;
      position: fixed;
      bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
      right: 1.25rem;
      width: 3.5rem; height: 3.5rem; border-radius: 50%;
      background: var(--brand-purple); color: #fff;
      align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(109,40,217,0.45), 0 1px 4px rgba(0,0,0,0.2);
      z-index: 30;
      transition: transform 200ms var(--ease-out), box-shadow 200ms var(--ease-out);
      touch-action: manipulation;
      animation: fabIn 300ms var(--ease-out) both;
    }
    @keyframes fabIn {
      from { opacity: 0; transform: scale(0.7) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @media (max-width: 767px) { .mobile-fab-nueva { display: flex; } }
    @media (hover: hover) {
      .mobile-fab-nueva:hover { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(109,40,217,0.55), 0 2px 8px rgba(0,0,0,0.15); }
    }
    .mobile-fab-nueva:active { transform: scale(0.9); box-shadow: 0 2px 8px rgba(109,40,217,0.3); }

    /* ── Card wrapper + botón eliminar (solo borradores) ── */
    .acta-card-wrap { position: relative; }
    /* Reserva espacio a la derecha del badge para que no lo tape el botón eliminar */
    .acta-card--draft .card-top-row { padding-right: 1.875rem; }

    .card-delete-btn {
      position: absolute; top: 0.625rem; right: 0.625rem; z-index: 6;
      display: flex; align-items: center; justify-content: center;
      width: 1.875rem; height: 1.875rem; border-radius: 0.5rem;
      background: transparent; color: #94a3b8; cursor: pointer;
      transition: background 150ms var(--ease-out), color 150ms var(--ease-out), opacity 150ms var(--ease-out);
    }
    /* Desktop: aparece al hacer hover sobre la tarjeta (menos ruido visual) */
    @media (hover: hover) and (pointer: fine) {
      .card-delete-btn { opacity: 0; }
      .acta-card-wrap:hover .card-delete-btn, .card-delete-btn:focus-visible { opacity: 1; }
      .card-delete-btn:hover { background: #fef2f2; color: var(--brand-rose); }
      :host-context(.dark) .card-delete-btn:hover { background: rgba(244,63,94,0.14); color: #fda4af; }
    }
    /* Touch: siempre visible (no hay hover) */
    @media (hover: none) {
      .card-delete-btn { opacity: 1; background: rgba(148,163,184,0.1); }
      .card-delete-btn:active { background: rgba(244,63,94,0.14); color: var(--brand-rose); transform: scale(0.92); }
    }

  `]
})
export class ActasListPage implements OnInit {
  private svc  = inject(ActaService);
  private router = inject(Router);
  private ctx  = inject(CongregacionContextService);
  private destroyRef = inject(DestroyRef);
  private toastSvc = inject(ToastService);

  /** El Coordinador solo lee las actas de ancianos: sin crear ni eliminar. */
  readonly puedeEditar = puedeEditarActas(inject(AuthStore));

  @ViewChild('formNueva') formNuevaEl?: ElementRef<HTMLElement>;

  actas    = signal<Acta[]>([]);
  creando  = signal(false);
  cargando = signal(true);
  guardando = signal(false);
  tipoLabel = TIPO_LABEL;

  actaAEliminar = signal<Acta | null>(null);
  eliminando    = signal(false);

  /** Valor vinculado al input (reactivo inmediato para ngModel) */
  busqueda = signal('');
  /** Valor con debounce usado para filtrar */
  busquedaDebounced = signal('');
  private busquedaSubject = new Subject<string>();

  readonly skeletons = Array(6);

  form: any = { tipo_reunion: 'ancianos', titulo: '', fecha_reunion: '' };

  tipoOpen       = signal(false);
  fechaPickerOpen = signal(false);
  calMonth        = signal(new Date().getMonth());
  calYear         = signal(new Date().getFullYear());

  readonly calWeekdays = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

  private readonly MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  calMonthName = computed(() => this.MONTH_NAMES[this.calMonth()]);

  calendarDays = computed(() => {
    const year  = this.calYear();
    const month = this.calMonth();
    const today = new Date(); today.setHours(0,0,0,0);
    const firstDow   = new Date(year, month, 1).getDay();
    const startDow   = firstDow === 0 ? 6 : firstDow - 1; // Lun=0
    const lastDay    = new Date(year, month + 1, 0).getDate();
    const prevLast   = new Date(year, month, 0).getDate();
    const days: { key: string; day: number; currentMonth: boolean; isToday: boolean }[] = [];

    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevLast - i);
      days.push({ key: d.toISOString().slice(0,10), day: d.getDate(), currentMonth: false, isToday: false });
    }
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(year, month, d);
      days.push({ key: date.toISOString().slice(0,10), day: d, currentMonth: true, isToday: date.getTime() === today.getTime() });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(year, month + 1, d);
      days.push({ key: date.toISOString().slice(0,10), day: d, currentMonth: false, isToday: false });
    }
    return days;
  });

  readonly tipoOpciones: { value: TipoReunion; label: string; desc: string }[] = [
    { value: 'ancianos',        label: 'Reunión de ancianos',  desc: 'Cuerpo de ancianos de la congregación' },
    { value: 'trimestral',      label: 'Reunión trimestral',   desc: 'Visita de circuito o distrito' },
    { value: 'comite_servicio', label: 'Comité de servicio',   desc: 'Asuntos administrativos de servicio' },
    { value: 'otra',            label: 'Otra reunión',         desc: 'Otro tipo de reunión especial' },
  ];

  readonly tipoLabelMap: Record<TipoReunion, string> = {
    ancianos:        'Reunión de ancianos',
    trimestral:      'Reunión trimestral',
    comite_servicio: 'Comité de servicio',
    otra:            'Otra reunión',
  };

  seleccionarTipo(valor: TipoReunion) {
    this.form.tipo_reunion = valor;
    this.tipoOpen.set(false);
  }

  getTipoLabel(valor: unknown): string {
    return this.tipoLabelMap[valor as TipoReunion] ?? '';
  }

  abrirFechaPicker() {
    if (this.form.fecha_reunion) {
      const d = new Date(this.form.fecha_reunion + 'T00:00:00');
      this.calMonth.set(d.getMonth());
      this.calYear.set(d.getFullYear());
    } else {
      const now = new Date();
      this.calMonth.set(now.getMonth());
      this.calYear.set(now.getFullYear());
    }
    this.fechaPickerOpen.set(!this.fechaPickerOpen());
  }

  prevMonth() {
    const m = this.calMonth(), y = this.calYear();
    m === 0 ? (this.calMonth.set(11), this.calYear.set(y - 1)) : this.calMonth.set(m - 1);
  }

  nextMonth() {
    const m = this.calMonth(), y = this.calYear();
    m === 11 ? (this.calMonth.set(0), this.calYear.set(y + 1)) : this.calMonth.set(m + 1);
  }

  selectDay(key: string) {
    this.form.fecha_reunion = key;
    this.fechaPickerOpen.set(false);
  }

  selectToday() {
    this.selectDay(hoyLocal());
  }

  clearFecha(e: Event) {
    e.stopPropagation();
    this.form.fecha_reunion = '';
  }

  formatFechaDisplay(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
  }

  borradoresCount  = computed(() => this.actas().filter(a => a.estado !== 'finalizada').length);
  finalizadasCount = computed(() => this.actas().filter(a => a.estado === 'finalizada').length);

  filtradas = computed(() => {
    const q = this.busquedaDebounced().trim().toLowerCase();
    if (!q) return this.actas();
    return this.actas().filter(a =>
      a.titulo.toLowerCase().includes(q) || TIPO_LABEL[a.tipo_reunion].toLowerCase().includes(q)
    );
  });

  get fechaEsFutura(): boolean {
    return !!this.form.fecha_reunion && this.form.fecha_reunion > hoyLocal();
  }

  ngOnInit() {
    this.busquedaSubject.pipe(debounceTime(220), takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.busquedaDebounced.set(v));

    // El backend ya acota al Coordinador a las de ancianos; el filtro lo hace explícito.
    this.svc.list(this.puedeEditar ? {} : { tipo_reunion: 'ancianos' }).subscribe({
      next: a => { this.actas.set(a); this.cargando.set(false); },
      error: () => { this.cargando.set(false); this.showToast('No se pudieron cargar las actas.', 'error'); },
    });
  }

  onBusqueda(val: string) {
    this.busqueda.set(val);
    this.busquedaSubject.next(val);
  }

  abrirNueva() {
    this.creando.set(true);
    setTimeout(() => this.formNuevaEl?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }), 40);
  }

  crear() {
    const idCong = this.ctx.effectiveCongregacionId();
    if (!idCong) { this.showToast('Selecciona una congregación en el contexto.', 'error'); return; }
    this.guardando.set(true);
    this.svc.create({ id_congregacion: idCong, ...this.form }).subscribe({
      next:  (a) => { this.guardando.set(false); this.router.navigate(['/administracion/actas-reunion', a.id_acta]); },
      error: (e) => { this.guardando.set(false); this.showToast(e?.error?.detail || 'Error al crear el acta.', 'error'); },
    });
  }

  abrir(a: Acta) {
    this.router.navigate(['/administracion/actas-reunion', a.id_acta]);
  }

  pedirEliminar(a: Acta, e: Event) {
    e.stopPropagation();   // no abrir la tarjeta
    if (a.estado === 'finalizada') return;   // solo borradores
    this.actaAEliminar.set(a);
  }

  eliminarConfirmado() {
    const a = this.actaAEliminar();
    if (!a || this.eliminando()) return;
    this.eliminando.set(true);
    this.svc.remove(a.id_acta).subscribe({
      next: () => {
        this.actas.update(list => list.filter(x => x.id_acta !== a.id_acta));
        this.eliminando.set(false);
        this.actaAEliminar.set(null);
        this.showToast('Borrador eliminado.', 'success');
      },
      error: (err) => {
        this.eliminando.set(false);
        this.showToast(err?.error?.detail || 'No se pudo eliminar el acta. Intenta de nuevo.', 'error');
      },
    });
  }

  formatFecha(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  private showToast(msg: string, type: ToastType = 'info') {
    this.toastSvc[type](msg);
  }
}

/** Hoy en la hora local (AAAA-MM-DD). `toISOString` usa UTC: en Colombia, después de las 19:00 ya daba mañana. */
function hoyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
