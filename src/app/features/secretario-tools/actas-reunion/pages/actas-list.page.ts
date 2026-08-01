import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, debounceTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActaService } from '../../services/acta.service';
import { Acta, TipoReunion } from '../../models/acta.model';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';

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
  imports: [CommonModule, FormsModule],
  template: `
  <div class="h-full flex flex-col overflow-hidden">

    <!-- ───────── TOAST ───────── -->
    @if (toast()) {
      <div class="toast-wrap" [class.toast-error]="toast()!.type === 'error'" [class.toast-success]="toast()!.type === 'success'" [class.toast-info]="toast()!.type === 'info'">
        @if (toast()!.type === 'success') {
          <span class="toast-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
          </span>
        } @else if (toast()!.type === 'error') {
          <span class="toast-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </span>
        } @else {
          <span class="toast-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 8h.01M12 12v4"/></svg>
          </span>
        }
        <span class="toast-msg">{{ toast()!.msg }}</span>
        <button class="toast-close" (click)="toast.set(null)" type="button" aria-label="Cerrar notificación">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
        </button>
      </div>
    }

    <!-- ───────── HERO + BODY WRAPPER ───────── -->
    <div class="flex-1 flex flex-col m-1 rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800 min-h-0">

    <!-- ───────── HERO ───────── -->
    <header class="hero-grad text-white shrink-0">

      <div class="px-4 sm:px-6 lg:px-10 py-4 sm:py-5">
        <!-- Row 1: eyebrow + button (botón oculto en mobile — FAB lo reemplaza) -->
        <div class="hero-row mb-2 sm:mb-3">
          <div>
            <div class="hero-eyebrow">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              <span>Módulo Secretario</span>
            </div>
            <h1 class="hero-title">Actas de reunión</h1>
            <p class="hero-desc">Crea o busca un acta — cada reunión queda registrada aquí.</p>
          </div>
          <button (click)="abrirNueva()" class="btn-hero group hero-btn-desktop" type="button">
            <svg class="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
            <span>Nueva acta</span>
          </button>
        </div>

        <!-- Row 2: search -->
        <div class="hero-bottom-row">
          <div class="hero-search-wrap">
            <svg class="hero-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z"/></svg>
            <input class="hero-search-input" placeholder="Buscar acta…"
                   [ngModel]="busqueda()"
                   (ngModelChange)="onBusqueda($event)" />
          </div>
        </div>
      </div>
    </header>

    <!-- ───────── BODY ───────── -->
    <div class="flex-1 flex flex-col bg-white dark:bg-slate-900 px-4 pt-3 pb-4 gap-4 min-h-0 overflow-y-auto">

      <!-- Formulario nueva acta -->
      @if (creando()) {
        <!-- Overlay mobile — cierra al tocar fuera -->
        <div class="sheet-overlay" (click)="creando.set(false)" aria-hidden="true"></div>

        <section #formNueva class="form-nueva-section card-anim bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <!-- Handle pill — solo mobile -->
          <div class="sheet-handle-wrap" aria-hidden="true">
            <div class="sheet-handle"></div>
          </div>

          <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 class="font-semibold text-slate-800 dark:text-slate-100 text-sm">Nueva acta</h3>
            <button (click)="creando.set(false)" class="icon-btn" aria-label="Cerrar" type="button">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
            </button>
          </div>
          <div class="p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
            <label class="form-label">
              <span>Tipo <em class="text-rose-500 not-italic">*</em></span>
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
            <label class="form-label">
              <span>Título <em class="text-rose-500 not-italic">*</em></span>
              <input class="field" [(ngModel)]="form.titulo" placeholder="Ej. Reunión semanal de ancianos" />
            </label>
            <div class="form-label">
              <span>Fecha <em class="text-rose-500 not-italic">*</em></span>

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
            <div class="md:col-span-3 form-actions">
              <button (click)="creando.set(false)" class="btn-ghost form-btn-cancel" type="button">Cancelar</button>
              <button (click)="crear()" [disabled]="!form.titulo || !form.fecha_reunion || guardando()" class="btn-primary form-btn-submit" type="button">
                @if (guardando()) {
                  <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
                  Creando…
                } @else {
                  Crear y abrir
                }
              </button>
            </div>
          </div>
        </section>
      }

      <!-- Filtros + Grid -->
      <div class="w-full flex-1 flex flex-col gap-5">


        <!-- Estado de carga -->
        @if (cargando()) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
            @for (_ of skeletons; track $index) {
              <div class="skeleton-card">
                <div class="skel skel-icon"></div>
                <div class="skel skel-title mt-3"></div>
                <div class="skel skel-sub mt-2"></div>
                <div class="skel skel-footer mt-4"></div>
              </div>
            }
          </div>
        }

        <!-- Empty state — lista vacía sin búsqueda -->
        @else if (!actas().length) {
          <div class="empty-state">
            <div class="empty-icon">
              <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <p class="text-slate-700 dark:text-slate-300 font-semibold text-sm mb-1">Aún no hay actas</p>
            <p class="text-slate-400 dark:text-slate-600 text-xs mb-4">Crea tu primera acta para empezar a registrar reuniones.</p>
            <button type="button" (click)="abrirNueva()" class="btn-primary">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
              Nueva acta
            </button>
          </div>
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
                    <span class="badge" [class.badge-emerald]="a.estado === 'finalizada'" [class.badge-amber]="a.estado !== 'finalizada'">
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
                @if (a.estado !== 'finalizada') {
                  <button type="button" class="card-delete-btn"
                          (click)="pedirEliminar(a, $event)"
                          aria-label="Eliminar borrador" title="Eliminar borrador">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="15" height="15"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                }
              </div>
            }

            <!-- Tarjeta "nueva acta" — oculta cuando hay búsqueda activa -->
            @if (!busqueda()) {
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
    </div><!-- /hero+body wrapper -->

    <!-- Mobile FAB — Nueva acta (fijo en esquina inferior derecha) -->
    <button type="button" (click)="abrirNueva()" class="mobile-fab-nueva" aria-label="Nueva acta">
      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/>
      </svg>
    </button>

    <!-- ───────── MODAL: Eliminar borrador ───────── -->
    @if (actaAEliminar(); as aDel) {
      <div class="confirm-overlay" (click)="actaAEliminar.set(null)">
        <div class="confirm-dialog" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="confirm-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="22" height="22"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </div>
          <h3 class="confirm-title">Eliminar borrador</h3>
          <p class="confirm-message">Se eliminará esta acta de forma permanente. Esta acción no se puede deshacer.</p>
          <p class="confirm-target">{{ aDel.titulo }}</p>
          <div class="confirm-actions">
            <button class="confirm-btn confirm-btn-ghost" type="button" (click)="actaAEliminar.set(null)" [disabled]="eliminando()">Cancelar</button>
            <button class="confirm-btn confirm-btn-danger" type="button" (click)="eliminarConfirmado()" [disabled]="eliminando()">
              @if (eliminando()) {
                <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
                Eliminando…
              } @else {
                Eliminar
              }
            </button>
          </div>
        </div>
      </div>
    }

  </div>
  `,
  styles: [`
    :host {
      display: block; height: 100%;
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --brand-purple: #6D28D9;
      --brand-purple-hover: #5B21B6;
      --brand-emerald: #10B981;
      --brand-amber: #F59E0B;
      --brand-rose: #F43F5E;
    }

    /* ── Toast ── */
    .toast-wrap {
      position: fixed; top: 1.25rem; right: 1.25rem; z-index: 9999;
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.75rem 1rem; border-radius: 1rem; max-width: 22rem;
      font-size: 0.8125rem; font-weight: 500;
      box-shadow: 0 8px 28px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.08);
      animation: toastSlideIn 260ms var(--ease-out) both;
    }
    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateX(20px) scale(0.97); }
      to   { opacity: 1; transform: translateX(0) scale(1); }
    }
    .toast-error   { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
    .toast-success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
    .toast-info    { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
    :host-context(.dark) .toast-error   { background: #450a0a; color: #fca5a5; border-color: #7f1d1d; }
    :host-context(.dark) .toast-success { background: #052e16; color: #86efac; border-color: #14532d; }
    :host-context(.dark) .toast-info    { background: #0c1a3a; color: #93c5fd; border-color: #1e3a5f; }

    .toast-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.375rem; height: 1.375rem; border-radius: 50%;
      background: currentColor; color: #fff; flex-shrink: 0;
      opacity: 0.15;
    }
    .toast-wrap .toast-icon { opacity: 1; }
    .toast-error   .toast-icon { background: rgba(239,68,68,0.12);   color: #ef4444; }
    .toast-success .toast-icon { background: rgba(34,197,94,0.12);   color: #16a34a; }
    .toast-info    .toast-icon { background: rgba(59,130,246,0.12);  color: #2563eb; }
    :host-context(.dark) .toast-error   .toast-icon { background: rgba(239,68,68,0.15);   color: #fca5a5; }
    :host-context(.dark) .toast-success .toast-icon { background: rgba(34,197,94,0.15);   color: #86efac; }
    :host-context(.dark) .toast-info    .toast-icon { background: rgba(59,130,246,0.15);  color: #93c5fd; }

    .toast-msg { flex: 1; }
    .toast-close {
      flex-shrink: 0; width: 1.375rem; height: 1.375rem;
      display: flex; align-items: center; justify-content: center;
      opacity: 0.5; cursor: pointer; border-radius: 0.375rem;
      transition: opacity 150ms, background 150ms;
    }
    .toast-close:hover { opacity: 1; background: rgba(0,0,0,0.06); }
    :host-context(.dark) .toast-close:hover { background: rgba(255,255,255,0.1); }

    /* ── Inputs ── */
    .field {
      width: 100%; border: 1px solid #e2e8f0; background: #fff;
      border-radius: 0.75rem; padding: 0.5625rem 0.75rem;
      font-size: 0.8125rem; color: #1e293b;
      min-height: 2.75rem;
      transition: border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
    }
    .field:focus { outline: none; border-color: #6D28D9; box-shadow: 0 0 0 3px rgba(109,40,217,0.12); }
    .field::placeholder { color: #94a3b8; font-style: italic; }
    :host-context(.dark) .field { background: #1e293b; border-color: #334155; color: #f1f5f9; }
    :host-context(.dark) .field:focus { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.18); }
    :host-context(.dark) .field::placeholder { color: #475569; }

    /* Anti-zoom iOS: ≥16px on mobile */
    @media (max-width: 767px) {
      .field { font-size: 1rem; }
    }

    .form-label { display: block; font-size: 0.75rem; }
    .form-label > span:first-child { display: block; color: #475569; margin-bottom: 0.25rem; font-weight: 500; }
    :host-context(.dark) .form-label > span:first-child { color: #cbd5e1; }

    .field-hint-warn {
      display: inline-flex; align-items: center; gap: 0.25rem;
      margin-top: 0.3rem; font-size: 0.7rem; color: #92400e; font-weight: 500;
    }
    :host-context(.dark) .field-hint-warn { color: #fbbf24; }

    /* ── Buttons ── */
    .btn-primary, .btn-ghost, .btn-hero {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.875rem; font-size: 0.8125rem; font-weight: 600;
      border-radius: 0.75rem; cursor: pointer; user-select: none;
      min-height: 2.75rem;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out), color 160ms var(--ease-out);
    }
    .btn-primary { background: var(--brand-purple); color: #fff; box-shadow: 0 1px 2px rgba(109,40,217,0.18); }
    .btn-ghost { color: #64748b; }
    .btn-hero {
      background: rgba(255,255,255,0.16); color: #fff;
      border: 1px solid rgba(255,255,255,0.24); padding: 0.625rem 1.125rem; font-weight: 600;
      box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    }
    :host-context(.dark) .btn-ghost { color: #94a3b8; }
    @media (hover: hover) and (pointer: fine) {
      .btn-primary:hover:not(:disabled) { background: var(--brand-purple-hover); box-shadow: 0 4px 14px rgba(109,40,217,0.28); }
      .btn-ghost:hover { background: rgba(100,116,139,0.08); color: #334155; }
      .btn-hero:hover { background: rgba(255,255,255,0.22); }
      :host-context(.dark) .btn-ghost:hover { background: rgba(148,163,184,0.12); color: #f1f5f9; }
    }
    .btn-primary:active, .btn-ghost:active, .btn-hero:active { transform: scale(0.97); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 2rem; height: 2rem; border-radius: 0.625rem; color: #94a3b8;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), color 160ms var(--ease-out);
    }
    @media (hover: hover) { .icon-btn:hover { background: #f1f5f9; color: #475569; } }
    .icon-btn:active { transform: scale(0.92); }
    :host-context(.dark) .icon-btn:hover { background: #1e293b; color: #cbd5e1; }

    /* ── Stats ── */
    .hero-bottom-row {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
    }
    .stat-card {
      display: flex; flex-direction: row; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.875rem;
      background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.28);
      border-radius: 0.75rem;
    }
    .stat-dot {
      width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    }
    .stat-dot-total   { background: rgba(255,255,255,0.8); }
    .stat-dot-borrador { background: #fb923c; box-shadow: 0 0 7px rgba(251,146,60,0.85); }
    .stat-dot-final   { background: #4ade80; box-shadow: 0 0 7px rgba(74,222,128,0.85); }
    .stat-num { font-size: 1.375rem; font-weight: 800; line-height: 1; color: #fff; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
    .stat-label { font-size: 0.625rem; color: rgba(255,255,255,0.8); font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; }

    /* ── Hero search ── */
    .hero-search-wrap {
      position: relative; flex: 1; min-width: 0; max-width: 22rem;
    }
    .hero-search-icon {
      position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%);
      color: rgba(255,255,255,0.7); pointer-events: none; width: 0.9rem; height: 0.9rem;
    }
    .hero-search-input {
      width: 100%; padding: 0.5rem 0.75rem 0.5rem 2.25rem;
      background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
      border-radius: 0.75rem; font-size: 0.8125rem; color: #fff;
      min-height: 2.25rem;
      transition: background 160ms var(--ease-out), border-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
    }
    .hero-search-input::placeholder { color: rgba(255,255,255,0.6); }
    .hero-search-input:focus {
      outline: none; background: rgba(255,255,255,0.22);
      border-color: rgba(255,255,255,0.55); box-shadow: 0 0 0 3px rgba(255,255,255,0.12);
    }
    @media (max-width: 767px) { .hero-search-input { font-size: 1rem; } }

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
    .tipo-select.is-open .tipo-trigger { border-color: #6D28D9; box-shadow: 0 0 0 3px rgba(109,40,217,0.12); }
    :host-context(.dark) .tipo-trigger { background: #1e293b; border-color: #334155; color: #f1f5f9; }
    :host-context(.dark) .tipo-select.is-open .tipo-trigger { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.18); }

    .tipo-trigger-ico {
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      width: 1.5rem; height: 1.5rem; border-radius: 0.4rem;
      background: rgba(109,40,217,0.08); color: #6D28D9;
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
      background: rgba(109,40,217,0.07); color: #6D28D9;
      transition: background 120ms;
    }
    .tipo-opt-ico svg { width: 1rem; height: 1rem; }
    .tipo-option.is-selected .tipo-opt-ico { background: rgba(109,40,217,0.14); }
    :host-context(.dark) .tipo-opt-ico { background: rgba(167,139,250,0.1); color: #a78bfa; }

    .tipo-opt-text { flex: 1; display: flex; flex-direction: column; gap: 0.1rem; }
    .tipo-opt-label { font-size: 0.8125rem; font-weight: 600; color: #1e293b; line-height: 1.3; }
    .tipo-opt-desc  { font-size: 0.7rem; color: #94a3b8; line-height: 1.3; }
    .tipo-option.is-selected .tipo-opt-label { color: #6D28D9; }
    :host-context(.dark) .tipo-opt-label { color: #e2e8f0; }
    :host-context(.dark) .tipo-option.is-selected .tipo-opt-label { color: #c4b5fd; }
    :host-context(.dark) .tipo-opt-desc { color: #64748b; }

    .tipo-check { width: 0.9rem; height: 0.9rem; color: #6D28D9; flex-shrink: 0; }
    :host-context(.dark) .tipo-check { color: #a78bfa; }

    /* ── Card entrance ── */
    .card-anim { animation: cardIn 280ms var(--ease-out) both; }
    @keyframes cardIn { from { opacity: 0; transform: translateY(4px) scale(0.99); } to { opacity: 1; transform: none; } }

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
    .fecha-trigger:focus { outline: none; border-color: #6D28D9; box-shadow: 0 0 0 3px rgba(109,40,217,0.12); }
    :host-context(.dark) .fecha-trigger { background: #1e293b; border-color: #334155; color: #f1f5f9; }
    :host-context(.dark) .fecha-wrap.is-open .fecha-trigger { border-color: #a78bfa; box-shadow: 0 0 0 3px rgba(167,139,250,0.18); }

    .fecha-ico { width: 1rem; height: 1rem; color: #94a3b8; flex-shrink: 0; }
    .fecha-wrap.is-open .fecha-ico, .fecha-trigger.has-value .fecha-ico { color: #6D28D9; }
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
    .cal-year { color: #6D28D9; }
    :host-context(.dark) .cal-year { color: #a78bfa; }

    .cal-nav {
      width: 2rem; height: 2rem; border-radius: 0.5rem; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      color: #64748b; transition: background 120ms, color 120ms;
    }
    .cal-nav svg { width: 1rem; height: 1rem; }
    .cal-nav:hover { background: #f3f0ff; color: #6D28D9; }
    :host-context(.dark) .cal-nav { color: #94a3b8; }
    :host-context(.dark) .cal-nav:hover { background: rgba(109,40,217,0.15); color: #a78bfa; }

    .cal-weekdays {
      display: grid; grid-template-columns: repeat(7, 1fr);
      margin-bottom: 0.25rem;
    }
    .cal-weekdays span {
      text-align: center; font-size: 0.625rem; font-weight: 700;
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
    .cal-day.is-today { font-weight: 700; color: #6D28D9; }
    :host-context(.dark) .cal-day.is-today { color: #a78bfa; }
    .cal-day.is-today:not(.is-selected)::after {
      content: ''; position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%);
      width: 3px; height: 3px; border-radius: 50%; background: #6D28D9;
    }
    .cal-day { position: relative; }
    .cal-day.is-selected {
      background: #6D28D9 !important; color: #fff !important;
      font-weight: 700; border-radius: 50%;
    }
    @media (hover: hover) { .cal-day:not(.is-selected):hover { background: #f3f0ff; color: #6D28D9; } }
    :host-context(.dark) .cal-day:not(.is-selected):hover { background: rgba(109,40,217,0.15); color: #a78bfa; }

    .cal-footer {
      margin-top: 0.75rem; padding-top: 0.625rem;
      border-top: 1px solid #f1f5f9; display: flex; justify-content: center;
    }
    :host-context(.dark) .cal-footer { border-top-color: #2d3f5e; }
    .cal-today-btn {
      font-size: 0.75rem; font-weight: 600; color: #6D28D9;
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
      .cal-weekdays span { font-size: 0.6875rem; padding: 0.375rem 0; }
    }

    /* ── Bottom sheet (mobile) ── */
    .sheet-handle-wrap { display: none; justify-content: center; padding: 0.625rem 0 0; }
    .sheet-handle { width: 2.5rem; height: 4px; border-radius: 999px; background: #e2e8f0; }
    :host-context(.dark) .sheet-handle { background: #334155; }

    .sheet-overlay { display: none; }

    /* ── Form action buttons ── */
    .form-actions { display: flex; justify-content: flex-end; gap: 0.5rem; padding-top: 0.25rem; }

    @media (max-width: 767px) {
      .sheet-overlay {
        display: block;
        position: fixed; inset: 0; z-index: 39;
        background: rgba(0,0,0,0.45);
        animation: overlayIn 220ms ease both;
      }
      @keyframes overlayIn { from { opacity: 0; } to { opacity: 1; } }

      .form-nueva-section {
        position: fixed !important; bottom: 0; left: 0; right: 0; z-index: 40;
        border-radius: 1.25rem 1.25rem 0 0 !important;
        max-height: 92dvh; overflow-y: auto;
        padding-bottom: env(safe-area-inset-bottom, 0px);
        animation: sheetUp 280ms cubic-bezier(0.32, 0.72, 0, 1) both !important;
        box-shadow: 0 -8px 40px rgba(0,0,0,0.2);
      }
      @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }

      .sheet-handle-wrap { display: flex; }

      .form-actions {
        flex-direction: column-reverse; gap: 0.625rem; padding-top: 0.5rem;
      }
      .form-btn-cancel, .form-btn-submit {
        width: 100%; justify-content: center; min-height: 3rem;
      }
      .form-btn-submit { font-size: 0.9375rem; }
    }

    /* ── Skeleton loader ── */
    .skeleton-card {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 1rem;
      padding: 1.25rem; min-height: 10rem;
    }
    :host-context(.dark) .skeleton-card { background: #131b2e; border-color: #1e293b; }
    .skel {
      border-radius: 0.5rem;
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s infinite;
    }
    :host-context(.dark) .skel {
      background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
      background-size: 200% 100%;
    }
    @keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    .skel-icon  { width: 2.25rem; height: 2.25rem; border-radius: 0.625rem; }
    .skel-title { height: 1rem; width: 80%; }
    .skel-sub   { height: 0.75rem; width: 55%; }
    .skel-footer{ height: 0.75rem; width: 100%; }

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
      .acta-card:hover .card-title { color: #6D28D9; }
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
      font-size: 0.75rem; font-weight: 600; color: #6D28D9;
      min-height: 2.75rem; padding: 0 0.25rem;
    }
    :host-context(.dark) .card-open-link { color: #c4b5fd; }
    .card-open-arrow { width: 0.875rem; height: 0.875rem; transition: transform 200ms var(--ease-out); }
    .acta-card:hover .card-open-arrow { transform: translateX(2px); }

    .acta-icon {
      width: 2.25rem; height: 2.25rem; border-radius: 0.625rem; flex-shrink: 0;
      background: linear-gradient(135deg, #ede9fe, #ddd6fe);
      color: #6D28D9; display: flex; align-items: center; justify-content: center;
      transition: transform 200ms var(--ease-out);
    }
    :host-context(.dark) .acta-icon { background: linear-gradient(135deg, rgba(109,40,217,0.25), rgba(124,58,237,0.2)); color: #c4b5fd; }
    .acta-card:hover .acta-icon { transform: rotate(-4deg); }

    /* ── Badges ── */
    .badge {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.1875rem 0.5rem; font-size: 0.65rem; font-weight: 700;
      border-radius: 999px;
    }
    .badge-dot { width: 0.375rem; height: 0.375rem; border-radius: 999px; background: currentColor; }
    .badge-emerald { background: #d1fae5; color: #047857; }
    .badge-amber   { background: #fef3c7; color: #92400e; }
    :host-context(.dark) .badge-emerald { background: rgba(16,185,129,0.16);  color: #6ee7b7; }
    :host-context(.dark) .badge-amber   { background: rgba(245,158,11,0.16);  color: #fcd34d; }

    /* ── Empty state ── */
    .empty-state {
      text-align: center; padding: 3.5rem 1rem;
      background: #fff; border: 1px dashed #e2e8f0; border-radius: 1.25rem;
    }
    :host-context(.dark) .empty-state { background: #0f172a; border-color: #1e293b; }
    .empty-icon {
      width: 3.5rem; height: 3.5rem; border-radius: 1rem;
      background: linear-gradient(135deg, #ede9fe, #ddd6fe); color: #6D28D9;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 0.875rem;
    }
    :host-context(.dark) .empty-icon { background: linear-gradient(135deg, rgba(109,40,217,0.25), rgba(124,58,237,0.2)); color: #c4b5fd; }

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
      .acta-card-new:hover { opacity: 1; border-color: #7c3aed; border-style: solid; color: #6D28D9; background: #faf5ff; }
      :host-context(.dark) .acta-card-new:hover { opacity: 1; border-color: rgba(109,40,217,0.55); color: #c4b5fd; background: rgba(109,40,217,0.07); }
      .acta-card-new:hover .new-card-plus { background: #ede9fe; color: #6D28D9; transform: scale(1.1); }
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

    /* ── Spin ── */
    .animate-spin { animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
    }

    /* ── Hero fondo: mismo degradado que visita-superintendente y transferencias ── */
    .hero-grad {
      position: relative; overflow: hidden;
      background: linear-gradient(135deg, #5b21b6 0%, #7c3aed 60%, #a855f7 100%);
      box-shadow: 0 6px 20px -6px rgba(109,40,217,0.4);
    }

    /* ── Hero typography ── */
    .hero-eyebrow {
      display: flex; align-items: center; gap: 0.375rem;
      color: rgba(196,181,253,0.9); font-size: 0.6rem; text-transform: uppercase;
      letter-spacing: 0.18em; font-weight: 600; margin-bottom: 0.25rem;
    }
    .hero-title {
      font-size: 1.375rem; font-weight: 800; line-height: 1.15; color: #fff; letter-spacing: -0.02em;
    }
    .hero-desc {
      color: rgba(237,233,254,0.65); font-size: 0.75rem; margin-top: 0.125rem; line-height: 1.35;
    }
    @media (min-width: 1024px) { .hero-title { font-size: 1.5rem; } }

    /* ── Hero row ── */
    .hero-row {
      display: flex; flex-direction: row; align-items: flex-start;
      justify-content: space-between; gap: 1rem;
    }

    /* ── Botón desktop solamente — FAB reemplaza en mobile ── */
    .hero-btn-desktop { display: none; }
    @media (min-width: 768px) { .hero-btn-desktop { display: inline-flex; } }

    /* ── Mobile: hero compacto ── */
    @media (max-width: 767px) {
      .hero-desc { display: none; }
      .hero-bottom-row { flex-direction: row; align-items: center; gap: 0.75rem; flex-wrap: nowrap; }
      .hero-search-wrap { flex: 1; min-width: 0; max-width: none; }
    }

    @media (max-width: 479px) {
      .hero-eyebrow { display: none; }
      .hero-title { font-size: 1.25rem; }
      .stat-card { padding: 0.375rem 0.5rem; gap: 0.375rem; }
      .stat-num { font-size: 1.125rem; }
      .stat-label { font-size: 0.55rem; }
      .stat-dot { width: 5px; height: 5px; }
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

    /* ── Confirm modal (eliminar) ── */
    .confirm-overlay {
      position: fixed; inset: 0; z-index: 9998;
      display: flex; align-items: center; justify-content: center; padding: 1rem;
      background: rgba(8,10,14,0.55);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      animation: cfOverlayIn 160ms ease-out;
    }
    @keyframes cfOverlayIn { from { opacity: 0; } to { opacity: 1; } }
    .confirm-dialog {
      width: 100%; max-width: 360px;
      background: #fff; border: 1px solid rgba(0,0,0,0.08);
      border-radius: 1rem; padding: 1.5rem 1.5rem 1.25rem;
      box-shadow: 0 20px 50px -12px rgba(0,0,0,0.35);
      text-align: center; animation: cfDialogIn 200ms var(--ease-out);
    }
    :host-context(.dark) .confirm-dialog { background: #0f172a; border-color: #1e293b; }
    @keyframes cfDialogIn { from { opacity: 0; transform: translateY(8px) scale(0.96); } to { opacity: 1; transform: none; } }

    .confirm-icon-wrap {
      width: 44px; height: 44px; margin: 0 auto 0.875rem;
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; background: rgba(244,63,94,0.1); color: var(--brand-rose);
    }
    .confirm-title { font-size: 1.0625rem; font-weight: 700; color: #1e293b; margin: 0 0 0.25rem; }
    :host-context(.dark) .confirm-title { color: #f1f5f9; }
    .confirm-message { font-size: 0.8125rem; color: #64748b; margin: 0 0 0.625rem; line-height: 1.5; }
    :host-context(.dark) .confirm-message { color: #94a3b8; }
    .confirm-target {
      font-size: 0.8125rem; color: #1e293b; margin: 0 0 1.25rem; font-weight: 600;
      padding: 0.5rem 0.75rem; background: rgba(0,0,0,0.03); border-radius: 0.5rem;
      word-break: break-word;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    :host-context(.dark) .confirm-target { background: rgba(255,255,255,0.04); color: #e2e8f0; }

    .confirm-actions { display: flex; gap: 0.5rem; }
    .confirm-btn {
      flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
      padding: 0.625rem 1rem; border-radius: 0.75rem; min-height: 2.75rem;
      font-size: 0.8125rem; font-weight: 600; font-family: inherit;
      border: 1px solid transparent; cursor: pointer;
      transition: background 140ms var(--ease-out), transform 140ms var(--ease-out);
    }
    .confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .confirm-btn:active:not(:disabled) { transform: scale(0.97); }
    .confirm-btn-ghost { background: transparent; border-color: #e2e8f0; color: #475569; }
    .confirm-btn-ghost:hover:not(:disabled) { background: rgba(0,0,0,0.04); }
    :host-context(.dark) .confirm-btn-ghost { border-color: #334155; color: #cbd5e1; }
    :host-context(.dark) .confirm-btn-ghost:hover:not(:disabled) { background: rgba(255,255,255,0.05); }
    .confirm-btn-danger { background: var(--brand-rose); color: #fff; box-shadow: 0 1px 2px rgba(244,63,94,0.3); }
    .confirm-btn-danger:hover:not(:disabled) { background: #e11d48; }
  `]
})
export class ActasListPage implements OnInit {
  private svc  = inject(ActaService);
  private router = inject(Router);
  private ctx  = inject(CongregacionContextService);
  private destroyRef = inject(DestroyRef);

  @ViewChild('formNueva') formNuevaEl?: ElementRef<HTMLElement>;

  actas    = signal<Acta[]>([]);
  creando  = signal(false);
  cargando = signal(true);
  guardando = signal(false);
  tipoLabel = TIPO_LABEL;

  toast = signal<{ msg: string; type: ToastType } | null>(null);

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
    this.selectDay(new Date().toISOString().slice(0, 10));
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
    return !!this.form.fecha_reunion && this.form.fecha_reunion > new Date().toISOString().slice(0, 10);
  }

  ngOnInit() {
    this.busquedaSubject.pipe(debounceTime(220), takeUntilDestroyed(this.destroyRef))
      .subscribe(v => this.busquedaDebounced.set(v));

    this.svc.list().subscribe({
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
      next:  (a) => { this.guardando.set(false); this.router.navigate(['/secretario-tools/actas-reunion', a.id_acta]); },
      error: (e) => { this.guardando.set(false); this.showToast(e?.error?.detail || 'Error al crear el acta.', 'error'); },
    });
  }

  abrir(a: Acta) {
    this.router.navigate(['/secretario-tools/actas-reunion', a.id_acta]);
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
    this.toast.set({ msg, type });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
