import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VisitaService } from '../../services/visita.service';
import { AgendaItem, AgendaSecciones, Colaborador, Visita } from '../../models/visita.model';
import { UsuariosService } from '../../../basicas/usuarios/services/usuarios.service';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { EntregaPortalComponent } from '../components/entrega-portal.component';
import { EntregaPortalService } from '../services/entrega-portal.service';
import { AgendaEditorComponent } from '../components/agenda-editor.component';
import { EntregaMetodosComponent } from '../components/entrega-metodos.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';

type Tab = 'docs' | 'agenda' | 'entrega' | 'preview';
type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; msg: string; }

@Component({
  standalone: true,
  selector: 'app-visita-main',
  imports: [CommonModule, FormsModule, EntregaPortalComponent, AgendaEditorComponent, EntregaMetodosComponent, DatePickerComponent],
  template: `
  <div class="h-full flex flex-col overflow-hidden">

    <!-- ───────── HERO + BODY WRAPPER ───────── -->
    <div class="page-shell flex-1 flex flex-col m-1 rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800 min-h-0">

    <!-- ───────── HERO ───────── -->
    <header class="hero-grad text-white shrink-0" [class.hero-compact]="seleccionada() !== null || nuevoVisita()">
      <!-- Misma posición que "Nueva acta" en actas-reunion: CTA en el hero,
           arriba a la derecha del título. Se oculta cuando hay una visita
           seleccionada o el formulario ya está abierto (mismo criterio que
           esconde eyebrow/desc en .hero-compact) — el FAB cubre móvil. -->
      <div class="relative z-10 px-4 sm:px-6 lg:px-10 py-4 sm:py-5 hero-inner">
        <div>
          <div class="hero-eyebrow">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4M3 17l9 4 9-4"/></svg>
            <span>Módulo Secretario</span>
          </div>
          <h1 class="hero-title">Visita del Superintendente</h1>
          <p class="hero-desc">Organiza la documentación, agenda y entrega al superintendente de circuito.</p>
        </div>
        @if (!seleccionada() && !nuevoVisita()) {
          <button (click)="abrirFormulario()" class="btn-hero group hero-btn-desktop" type="button">
            <svg class="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
            <span>Nueva visita</span>
          </button>
        }
      </div>
    </header>

    <!-- ── Barra de detalle: FUERA del scroll container, siempre visible cuando hay visita ── -->
    @if (seleccionada(); as v) {
      <div class="detail-sticky-bar shrink-0 bg-white dark:bg-slate-900
                  border-b border-slate-200 dark:border-slate-800">

        <header class="px-4 sm:px-5 lg:px-7 py-2.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="detail-eyebrow hidden sm:flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-1">
              <span class="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400"></span>
              <span>Detalle de la visita</span>
            </div>
            <h2 class="text-base sm:text-lg lg:text-xl font-bold text-slate-800 dark:text-slate-100 truncate leading-tight">
              {{ v.nombre_superintendente || 'Sin nombre asignado' }}
            </h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {{ v.fecha_inicio }}@if (v.fecha_fin) { <span> — {{ v.fecha_fin }}</span> }
              @if (v.semestre) { <span class="mx-1.5 text-slate-300">·</span><span class="hidden xs:inline">Semestre </span>{{ v.semestre }} }
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button (click)="abrirColaboradores()" class="btn-colab" [title]="'Colaboradores de la visita'">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm8-6a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span class="hidden md:inline">Colaboradores</span>
              @if (colaboradores().length) {
                <span class="colab-count">{{ colaboradores().length }}</span>
              }
            </button>
            <button (click)="seleccionada.set(null)" class="btn-close-detail shrink-0 hidden sm:inline-flex" aria-label="Cerrar detalle">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
              <span class="hidden sm:inline">Cerrar</span>
            </button>
          </div>
        </header>

        <div class="stepper-nav-wrap">
        <nav #stepperNavRef class="stepper-nav" role="tablist" aria-label="Pasos de la visita">
          @for (t of tabsConEstado(); track t.id; let last = $last) {
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === t.id"
              (click)="setActiveTab(t.id, $event.currentTarget)"
              class="stepper-step"
              [class.is-active]="activeTab() === t.id"
              [class.is-done]="t.completado">

              <div class="step-indicator">
                @if (t.completado && activeTab() !== t.id) {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                } @else {
                  {{ t.paso }}
                }
              </div>

              <div class="step-content">
                <span class="step-label">
                  {{ t.label }}
                  @if (t.id === 'docs' && archivos().length) {
                    <span class="step-badge">{{ archivos().length }}</span>
                  }
                  @if (t.id === 'agenda' && agendaDirty()) {
                    <span class="step-dirty" title="Cambios sin guardar"></span>
                  }
                </span>
                <span class="step-desc">{{ t.desc }}</span>
              </div>
            </button>

            @if (!last) {
              <div class="step-connector" [class.done]="t.completado"></div>
            }
          }
        </nav>
        </div><!-- /stepper-nav-wrap -->
      </div>
    }

    <!-- ───────── BODY ───────── -->
    <div class="flex-1 bg-white dark:bg-slate-900 px-4 @2xl/page:px-6 @7xl/page:px-10 min-h-0 overflow-y-auto grid grid-cols-1 @5xl/page:grid-cols-[minmax(17rem,20rem)_1fr] @7xl/page:grid-cols-[minmax(20rem,23.75rem)_1fr] gap-4 content-start"
         [class.pt-4]="activeTab() !== 'preview' || !seleccionada()"
         [class.pb-4]="true">

      <!-- ────────── COLUMNA IZQUIERDA: LISTA ────────── -->
      <!-- max-h relativo al CONTENEDOR de scroll, no al viewport: el body sólo
           mide ~585px en un portátil de 14", así que un 100vh dejaría el aside
           más alto que su scroller y el sticky nunca llegaría a fijarse. -->
      <aside
        class="space-y-4 @5xl/page:sticky @5xl/page:top-4 @5xl/page:self-start @5xl/page:max-h-[calc(100%-2rem)] @5xl/page:overflow-y-auto custom-scrollbar pr-1 @5xl/page:!block"
        [class.hidden]="seleccionada() !== null">

        <!-- Formulario nueva visita -->
        @if (nuevoVisita()) {
          <!-- Sin overflow:hidden en el contenedor — recortaría el popup del
               date-picker (mismo motivo que en .sec-card). El redondeo se
               aplica en el header/body en su lugar. -->
          <div #formContainer class="form-shell card-anim bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
            <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between rounded-t-2xl">
              <h3 class="font-semibold text-slate-800 dark:text-slate-100 text-sm">Crear nueva visita</h3>
              <button (click)="cancelarForm()" class="icon-btn" aria-label="Cerrar formulario">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
              </button>
            </div>
            <div class="p-5 space-y-4 rounded-b-2xl">
              <label class="form-label">
                <span>Superintendente</span>
                <input class="field" [(ngModel)]="form.nombre_superintendente" placeholder="Ej. Carlos Ramírez" />
              </label>
              <label class="form-label">
                <span>Correo electrónico <span class="field-optional">opcional</span></span>
                <input type="email" class="field" [(ngModel)]="form.correo_superintendente" placeholder="nombre@ejemplo.com" />
              </label>

              <!-- Datos de identidad vs. programación: separador sutil, sin decoración -->
              <div class="form-section-divider"></div>

              <!-- Fechas apiladas mientras el formulario sea estrecho, para que
                   el calendario inline quepa a ancho completo; lado a lado sólo
                   cuando la tarjeta pasa de 24rem. Se mide contra el FORMULARIO
                   (container "form"), no contra el viewport: en dos columnas
                   esta tarjeta vive en la lista de 17–23.75rem, así que un
                   md:grid-cols-2 dejaba dos date-pickers de ~150px en cuanto la
                   ventana pasaba de 768px. -->
              <div class="grid grid-cols-1 @sm/form:grid-cols-2 gap-3">
                <label class="form-label">
                  <span>Fecha inicio <span class="field-required">*</span></span>
                  <app-date-picker
                    [ngModel]="form.fecha_inicio"
                    (ngModelChange)="onFechaInicioChange($event)"
                    colorScheme="violet"
                    [fieldLike]="true"
                    [inlineOnMobile]="true"
                    placeholder="dd/mm/aaaa">
                  </app-date-picker>
                </label>
                <label class="form-label">
                  <span>Fecha fin <span class="field-optional">opcional</span></span>
                  <app-date-picker
                    [ngModel]="form.fecha_fin"
                    (ngModelChange)="onFechaFinChange($event)"
                    colorScheme="violet"
                    [fieldLike]="true"
                    [inlineOnMobile]="true"
                    placeholder="dd/mm/aaaa">
                  </app-date-picker>
                  @if (fechaFinEsSugerencia() && form.fecha_fin) {
                    <span class="field-hint">Sugerida: 1 semana después. Puedes cambiarla.</span>
                  }
                </label>
              </div>
              <label class="form-label">
                <span>Semestre <span class="field-optional">opcional</span></span>
                <input class="field" [ngModel]="form.semestre" (ngModelChange)="onSemestreChange($event)" placeholder="Ej. 2026-I" />
                @if (semestreEsSugerencia() && form.semestre) {
                  <span class="field-hint">Calculado según la fecha de inicio. Puedes cambiarlo.</span>
                }
              </label>
              <div class="flex justify-end gap-2 pt-2">
                <button (click)="cancelarForm()" class="btn-ghost">Cancelar</button>
                <button (click)="crearVisita()"
                        [disabled]="!form.fecha_inicio || guardando()"
                        [title]="!form.fecha_inicio ? 'Selecciona una fecha de inicio para continuar' : ''"
                        class="btn-primary">
                  @if (guardando()) { <span class="spinner"></span> Guardando… } @else { Crear visita }
                </button>
              </div>
            </div>
          </div>
        }

        <!-- Encabezado lista -->
        <!-- Una sola acción de crear visible a la vez:
               · < 768px ................ FAB flotante
               · >= 768px ............... botón en el hero (.hero-btn-desktop)
               · lista vacía ............ el CTA del propio empty-state
               · visita seleccionada o formulario abierto ..... ninguna -->
        <div class="flex items-center justify-between gap-2 px-1">
          <h2 class="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Visitas registradas</h2>
          <span class="text-xs text-slate-400">{{ visitas().length }}</span>
        </div>

        <!-- Tarjetas de visita -->
        <div class="space-y-2.5">
          @if (cargandoLista() && !visitas().length) {
            @for (s of [0,1,2]; track s) {
              <div class="skeleton-card" [style.--stagger]="s * 60 + 'ms'"></div>
            }
          } @else {
          @for (v of visitas(); track v.id_visita; let i = $index) {
            <div
              role="button"
              tabindex="0"
              (click)="abrir(v)"
              (keydown.enter)="abrir(v)"
              (keydown.space)="$event.preventDefault(); abrir(v)"
              class="visita-card group w-full text-left"
              [class.is-active]="seleccionada()?.id_visita === v.id_visita"
              [style.--stagger]="i * 40 + 'ms'">
              <div class="flex items-start gap-3">
                <div class="visita-icon">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <p class="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate"
                       [title]="v.nombre_superintendente || 'Superintendente sin nombre'">
                      {{ v.nombre_superintendente || 'Superintendente sin nombre' }}
                    </p>
                    <div class="flex items-center gap-1 shrink-0">
                      @if (v.archivo_agenda) {
                        <span class="badge-emerald" title="Agenda generada">
                          <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                        </span>
                      }
                      @if (pendingDeleteVisitaId() !== v.id_visita) {
                        <button (click)="$event.stopPropagation(); pendingDeleteVisitaId.set(v.id_visita)"
                                class="btn-danger-ghost" aria-label="Eliminar visita">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22"/></svg>
                        </button>
                      }
                    </div>
                  </div>

                  @if (pendingDeleteVisitaId() === v.id_visita) {
                    <!-- Confirmación inline: reemplaza fechas/chips, sin salto de layout -->
                    <div class="flex items-center gap-2 mt-1.5" (click)="$event.stopPropagation()">
                      <span class="text-xs text-rose-600 dark:text-rose-400 font-medium">¿Eliminar esta visita?</span>
                      <button (click)="eliminarVisitaDesdeCard(v)" class="text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded-md transition-colors" style="min-height: 1.75rem">Sí</button>
                      <button (click)="pendingDeleteVisitaId.set(null)" class="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 px-1.5 py-1" style="min-height: 1.75rem">No</button>
                    </div>
                  } @else {
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                      {{ v.fecha_inicio }}@if (v.fecha_fin) { <span> — {{ v.fecha_fin }}</span> }
                    </p>
                    <div class="flex items-center gap-2 mt-1.5">
                      @if (v.semestre) { <span class="chip-slate">{{ v.semestre }}</span> }
                      <span class="chip-state"
                        [class.chip-upcoming]="estadoVisita(v) === 'proxima'"
                        [class.chip-curso]="estadoVisita(v) === 'curso'"
                        [class.chip-done]="estadoVisita(v) === 'realizada'">
                        {{ estadoLabel(v) }}
                      </span>
                    </div>
                  }
                </div>
                <!-- Chevron — affordance de navegación en móvil/tablet -->
                <svg class="@5xl/page:hidden w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5 transition-colors group-hover:text-violet-400 group-active:text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
          } @empty {
            <div class="empty-state">
              <div class="empty-icon">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
              <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Aún no hay visitas</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-[240px] mx-auto"
                 [class.mb-4]="!nuevoVisita()">
                Crea tu primera visita para empezar a organizar la documentación.
              </p>
              <!-- Con el formulario ya abierto justo encima, el CTA sobra -->
              @if (!nuevoVisita()) {
                <button (click)="abrirFormulario()" class="btn-primary">
                  + Crear primera visita
                </button>
              }
            </div>
          }
          }
        </div>
      </aside>

      <!-- ────────── COLUMNA DERECHA: DETALLE ────────── -->
      <main class="min-w-0 @5xl/page:!block" [class.hidden]="seleccionada() === null">

        <!-- Botón volver — sticky en móvil/tablet -->
        <div class="@5xl/page:hidden sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm -mx-4 px-3 border-b border-slate-100 dark:border-slate-800"
             [class.py-1]="activeTab() === 'preview'"
             [class.py-2]="activeTab() !== 'preview'"
             [class.mb-2]="activeTab() !== 'preview'"
             [class.mb-0]="activeTab() === 'preview'">
          <button (click)="seleccionada.set(null)"
                  class="inline-flex items-center gap-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  [class.h-8]="activeTab() === 'preview'"
                  [class.text-xs]="activeTab() === 'preview'"
                  [class.h-11]="activeTab() !== 'preview'"
                  [class.text-sm]="activeTab() !== 'preview'">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Volver
          </button>
        </div>

        @if (seleccionada(); as v) {
          <article class="bg-white dark:bg-slate-900
                          border border-slate-200 dark:border-slate-800
                          rounded-2xl shadow-sm">

            <!-- Tab: Documentos -->
            @if (activeTab() === 'docs') {
              <section class="tab-panel p-5 lg:p-7 space-y-4">
                <label
                  class="dropzone group"
                  [class.is-dragging]="isDragging()"
                  (dragover)="onDragOver($event)"
                  (dragleave)="isDragging.set(false)"
                  (drop)="onDrop($event)">
                  <input #fi type="file" class="hidden" multiple (change)="onFile(fi)" />
                  <div class="text-center pointer-events-none">
                    <div class="mx-auto w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 flex items-center justify-center mb-2 transition-transform duration-200 group-hover:-translate-y-0.5">
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
                          <span class="text-xs text-slate-400 tabular-nums hidden sm:inline">{{ (a.tamano_bytes / 1024) | number:'1.0-0' }} KB</span>
                          @if (pendingDeleteFile() === a.nombre) {
                            <div class="flex items-center gap-1.5 pl-2 border-l border-slate-200 dark:border-slate-700">
                              <span class="text-xs text-rose-600 dark:text-rose-400 font-medium whitespace-nowrap">¿Eliminar?</span>
                              <button (click)="confirmarEliminarArchivo(a.nombre)" class="text-xs font-semibold text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded-md transition-colors" style="min-height: 2rem">Sí</button>
                              <button (click)="pendingDeleteFile.set(null)" class="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 px-1.5 py-1" style="min-height: 2rem">No</button>
                            </div>
                          } @else {
                            <button (click)="pendingDeleteFile.set(a.nombre)" class="btn-danger-ghost" aria-label="Eliminar archivo">
                              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22"/></svg>
                            </button>
                          }
                        </div>
                      </li>
                    }
                  </ul>
                }
              </section>
            }

            <!-- Tab: Agenda -->
            @if (activeTab() === 'agenda') {
              <section class="tab-panel p-5 lg:p-7 space-y-4">
                <app-agenda-editor
                  [items]="agendaItems()"
                  [secciones]="agendaSecciones()"
                  [idCongregacion]="seleccionada()?.id_congregacion ?? null"
                  [puedeVerTarjeta]="true"
                  (verTarjeta)="descargarTarjetaPublicador($event)"
                  (changed)="markAgendaDirty()">
                </app-agenda-editor>

              </section>
            }

            <!-- Tab: Vista del Superintendente (previsualización interna) -->
            @if (activeTab() === 'preview') {
              <section class="tab-panel p-0 flex flex-col">
                <div class="preview-context-banner">
                  <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  <span>Vista previa — así verá el superintendente los datos de la congregación</span>
                </div>
                <app-entrega-portal
                  modo="interno"
                  [idVisita]="v.id_visita"
                  class="flex-1">
                </app-entrega-portal>
              </section>
            }

            <!-- Tab: Entrega -->
            @if (activeTab() === 'entrega') {
              <section class="tab-panel p-5 lg:p-7">
                <app-entrega-metodos
                  [idVisita]="v.id_visita"
                  [correoSugerido]="v.correo_superintendente || null"
                  (aviso)="toast($event.type, $event.msg)"
                  (enlaceCambio)="hayEnlace.set($event)">
                </app-entrega-metodos>
              </section>
            }

          </article>
        } @else {
          <!-- Placeholder -->
          <div class="placeholder-detail">
            <div class="placeholder-icon">
              <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <h3 class="text-base font-semibold text-slate-700 dark:text-slate-200">Selecciona una visita</h3>
            <p class="text-sm text-slate-500 mt-1 max-w-sm text-center">
              Elige una visita del listado para gestionar documentos, agenda y entrega al superintendente.
            </p>
          </div>
        }
      </main>
    </div><!-- /body -->

    <!-- ── Barra de acciones del flujo: pie FIJO del layout, fuera del scroll,
         presente en TODAS las pestañas con el mismo diseño. Estructura única:
         izquierda = estado de la agenda (solo en esa pestaña) · derecha = un
         solo botón primario que indica el siguiente paso del flujo.
         "Eliminar visita" vive en la tarjeta de la lista, no aquí. ── -->
    @if (seleccionada(); as v) {
      <div class="save-bar shrink-0" [class.is-dirty]="activeTab() === 'agenda' && agendaDirty()">

          <!-- Izquierda: estado de la agenda (solo en esa pestaña) -->
          <div class="flex items-center gap-2 min-w-0">
            @if (activeTab() === 'agenda') {
              @if (agendaDirty()) {
                <span class="save-hint">
                  <span class="save-dot"></span>
                  Tienes cambios sin guardar
                </span>
              } @else if (v.archivo_agenda) {
                <span class="save-hint save-hint-ok">
                  <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                  Agenda guardada
                </span>
              }
            }
          </div>

          <!-- Derecha: un solo botón primario según el momento del flujo -->
          <div class="flex items-center gap-2 shrink-0">
            @if (activeTab() === 'agenda') {
              @if (agendaDirty() || !v.archivo_agenda) {
                <button (click)="generarAgenda()" [disabled]="guardando()"
                        class="btn-primary" [class.btn-pulse]="agendaDirty()">
                  @if (guardando()) { <span class="spinner"></span> Generando… } @else {
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-6h13M9 11l-3-3m0 0l3-3m-3 3h7"/></svg>
                    <span class="sm:hidden">Guardar</span>
                    <span class="hidden sm:inline">Guardar y generar agenda</span>
                  }
                </button>
              } @else {
                <button (click)="descargarAgenda()" class="btn-secondary">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
                  <span class="hidden sm:inline">Descargar</span>
                </button>
                <button (click)="irSiguiente()" class="btn-primary" type="button">
                  <span>Siguiente: {{ siguienteLabel() }}</span>
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                </button>
              }
            } @else if (siguienteTab()) {
              <button (click)="irSiguiente()" class="btn-primary" type="button">
                <span>Siguiente: {{ siguienteLabel() }}</span>
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
            } @else {
              <!-- Último paso (Entrega): el flujo termina aquí -->
              <span class="save-hint save-hint-ok">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                Último paso del flujo
              </span>
            }
          </div>
      </div>
    }
    </div><!-- /hero+body wrapper -->

    <!-- ───────── PANEL: Colaboradores ───────── -->
    @if (colabOpen()) {
      <div class="colab-backdrop" (click)="colabOpen.set(false)"></div>
      <div class="colab-panel" role="dialog" aria-modal="true" aria-label="Colaboradores de la visita">
        <header class="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 class="font-bold text-slate-800 dark:text-slate-100 text-sm">Colaboradores de la visita</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Pueden completar la agenda y subir documentos.</p>
          </div>
          <button (click)="colabOpen.set(false)" class="icon-btn" aria-label="Cerrar panel">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
          </button>
        </header>

        <div class="p-5 space-y-4 overflow-y-auto">
          <!-- Colaboradores actuales -->
          @if (colaboradores().length) {
            <ul class="space-y-1.5">
              @for (c of colaboradores(); track c.id_colaborador) {
                <li class="colab-row">
                  <div class="colab-avatar">{{ (c.nombre || '?').charAt(0).toUpperCase() }}</div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{{ c.nombre }}</p>
                    @if (c.correo) { <p class="text-xs text-slate-400 truncate">{{ c.correo }}</p> }
                  </div>
                  <button (click)="quitarColab(c)" class="btn-danger-ghost shrink-0" aria-label="Quitar colaborador">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
                  </button>
                </li>
              }
            </ul>
          } @else {
            <p class="text-sm text-slate-400 italic">Aún no hay colaboradores en esta visita.</p>
          }

          <!-- Buscar e invitar -->
          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <label class="form-label">
              <span>Invitar usuario de la congregación</span>
              <input class="field" [(ngModel)]="colabQuery" (ngModelChange)="buscarUsuariosColab()"
                     placeholder="Buscar por nombre o correo…" />
            </label>
            @if (buscandoColab()) {
              <p class="text-xs text-slate-400 flex items-center gap-2 px-1"><span class="spinner spinner-brand"></span> Buscando…</p>
            } @else if (colabResultados().length) {
              <ul class="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                @for (u of colabResultados(); track u.id_usuario) {
                  <li>
                    <button type="button" (click)="invitarColab(u)"
                            [disabled]="invitandoId() === u.id_usuario"
                            class="colab-result w-full text-left">
                      <div class="colab-avatar colab-avatar-sm">{{ (u.nombre || '?').charAt(0).toUpperCase() }}</div>
                      <div class="flex-1 min-w-0">
                        <p class="text-sm text-slate-700 dark:text-slate-200 truncate">{{ u.nombre }}</p>
                        @if (u.correo) { <p class="text-xs text-slate-400 truncate">{{ u.correo }}</p> }
                      </div>
                      @if (invitandoId() === u.id_usuario) {
                        <span class="spinner spinner-brand shrink-0"></span>
                      } @else {
                        <span class="colab-invite-tag shrink-0">Invitar</span>
                      }
                    </button>
                  </li>
                }
              </ul>
            } @else if (colabQuery.trim().length >= 2) {
              <p class="text-xs text-slate-400 px-1">Sin resultados para "{{ colabQuery }}".</p>
            }
          </div>
        </div>
      </div>
    }

    <!-- ───────── FAB "Nueva visita" (solo móvil, < 768px) ─────────
         Es la acción de crear por debajo de 768px, donde el botón del hero está
         oculto (.hero-btn-desktop). Se retira cuando ya hay otra forma de crear
         delante: con una visita abierta, con el formulario desplegado, o con la
         lista vacía (ahí manda el CTA del empty-state). -->
    @if (!seleccionada() && !nuevoVisita() && visitas().length) {
      <button (click)="abrirFormulario()" class="fab-nueva-visita" aria-label="Nueva visita" type="button">
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
      </button>
    }

    <!-- ───────── TOASTS ───────── -->
    <!-- Con una visita abierta la .save-bar ocupa el borde inferior y contiene
         el botón primario del flujo; los toasts se elevan para no taparlo. -->
    <div
      class="fixed left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[100] flex flex-col gap-2 pointer-events-none"
      [class.bottom-4]="!seleccionada()"
      [class.bottom-20]="seleccionada() !== null"
      aria-live="polite"
      role="status">
      @for (n of notifications(); track n.id) {
        <div class="toast-item pointer-events-auto"
             [class.toast-success]="n.type === 'success'"
             [class.toast-error]="n.type === 'error'"
             [class.toast-info]="n.type === 'info'">
          <span class="toast-icon">
            @if (n.type === 'success') {
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
            } @else if (n.type === 'error') {
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            } @else {
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            }
          </span>
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

    /* ───── Contexto de container queries ─────
       El shell desplaza el contenido 292px (o 92px colapsado) con
       lg:ml-[292px], así que el viewport miente sobre el ancho disponible: en
       un MacBook 14" el viewport es 1512px pero esta página sólo dispone de
       1220px. Todo el layout se mide contra el contenedor, no contra la
       ventana, y así también reacciona al colapsar/expandir el sidebar.

       Va en este wrapper y NO en :host porque container-type implica
       "contain: layout", que convertiría al elemento en bloque contenedor de
       sus descendientes position:fixed. Los overlays (.colab-backdrop,
       .colab-panel, .fab-nueva-visita y los toasts) son HERMANOS de este div,
       así que siguen anclados al viewport. */
    .page-shell { container-type: inline-size; container-name: page; }

    /* La tarjeta "Crear nueva visita" se mide aparte: cambia mucho de ancho
       según viva en la lista (17–23.75rem) o a ancho completo en una columna. */
    .form-shell { container-type: inline-size; container-name: form; }

    :host {
      --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
      --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
      --brand-purple: #6D28D9;
      --brand-purple-hover: #5B21B6;
      --border-light: #e2e8f0;
      --border-dark: #334155;
      --bg-light: #ffffff;
      --bg-dark: #1e293b;
      --text-light: #1e293b;
      --text-dark: #f1f5f9;
    }

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
    /* Objetivo táctil de 44px en móvil, consistente con el resto de la app */
    @media (max-width: 767px) {
      .field { min-height: 2.75rem; }
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

    .field-optional {
      font-size: 0.6875rem; font-weight: 400; font-style: normal;
      color: #94a3b8; letter-spacing: 0.01em;
    }
    :host-context(.dark) .field-optional { color: #475569; }

    .field-required {
      color: #f43f5e; font-style: normal; text-decoration: none;
      line-height: 1;
    }

    .field-hint {
      margin-top: 0.25rem; font-size: 0.6875rem; color: #94a3b8; line-height: 1.4;
    }
    :host-context(.dark) .field-hint { color: #475569; }

    /* Separa "identidad del superintendente" de "programación de la visita"
       dentro del formulario — solo espaciado/jerarquía, sin decoración.
       Sin márgenes propios: el espaciado simétrico lo da el space-y-4 del
       padre a ambos lados, así se lee como línea divisoria y no como un
       subrayado pegado al label siguiente. */
    .form-section-divider { height: 1px; background: var(--border-light); }
    :host-context(.dark) .form-section-divider { background: var(--border-dark); }

    /* ───── Botones ───── */
    .btn-primary, .btn-secondary, .btn-ghost, .btn-danger-ghost {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.875rem; font-size: 0.8125rem; font-weight: 500;
      border-radius: 0.625rem;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out), color 160ms var(--ease-out);
      cursor: pointer; user-select: none;
    }
    .btn-primary { background: var(--brand-purple); color: #fff; box-shadow: 0 1px 2px rgba(109, 40, 217, 0.18); }
    .btn-secondary { border: 1px solid var(--border-light); color: #475569; background: var(--bg-light); }
    .btn-ghost { color: #64748b; }
    .btn-danger-ghost { color: #f43f5e; padding: 0.375rem 0.625rem; font-size: 0.75rem; }

    :host-context(.dark) .btn-secondary { background: var(--bg-dark); border-color: var(--border-dark); color: #cbd5e1; }
    :host-context(.dark) .btn-ghost { color: #94a3b8; }

    @media (max-width: 767px) {
      .btn-danger-ghost { min-height: 2.75rem; min-width: 2.75rem; justify-content: center; }
      .btn-primary, .btn-secondary, .btn-ghost { min-height: 2.75rem; }
    }

    @media (hover: hover) and (pointer: fine) {
      .btn-primary:hover:not(:disabled) { background: var(--brand-purple-hover); box-shadow: 0 4px 14px rgba(109,40,217,0.28); }
      .btn-secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
      .btn-ghost:hover { background: rgba(100,116,139,0.08); color: #334155; }
      .btn-danger-ghost:hover { background: rgba(244,63,94,0.08); }
      :host-context(.dark) .btn-secondary:hover { background: #334155; border-color: #475569; color: #f1f5f9; }
      :host-context(.dark) .btn-ghost:hover { background: rgba(148,163,184,0.12); color: #f1f5f9; }
    }
    .btn-primary:active, .btn-secondary:active, .btn-ghost:active, .btn-danger-ghost:active { transform: scale(0.97); }
    .btn-primary:disabled, .btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

    .icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 2.75rem; height: 2.75rem; border-radius: 0.5rem; color: #94a3b8;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), color 160ms var(--ease-out);
    }
    @media (min-width: 768px) { .icon-btn { width: 2rem; height: 2rem; } }
    @media (hover: hover) { .icon-btn:hover { background: #f1f5f9; color: #475569; } }
    .icon-btn:active { transform: scale(0.92); }
    :host-context(.dark) .icon-btn:hover { background: #1e293b; color: #cbd5e1; }

    /* ── Hero fondo: gradiente brand limpio ── */
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
    @container page (min-width: 64rem) { .hero-title { font-size: 1.5rem; } }

    /* ── Hero inner: flex row que centra el botón respecto a todo el contenido ── */
    .hero-inner {
      display: flex; flex-direction: row; align-items: center;
      justify-content: space-between; gap: 1.5rem;
    }

    /* ── Botón "Nueva visita" en el hero — mismo patrón que "Nueva acta"
         en actas-reunion (.btn-hero / .hero-btn-desktop) ── */
    .btn-hero {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.625rem 1.125rem; font-size: 0.8125rem; font-weight: 600;
      border-radius: 0.75rem; cursor: pointer; user-select: none;
      min-height: 2.75rem; flex-shrink: 0;
      background: rgba(255,255,255,0.16); color: #fff;
      border: 1px solid rgba(255,255,255,0.24);
      box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
    }
    @media (hover: hover) and (pointer: fine) {
      .btn-hero:hover { background: rgba(255,255,255,0.22); }
    }
    .btn-hero:active { transform: scale(0.97); }
    .hero-btn-desktop { display: none; }
    @media (min-width: 768px) { .hero-btn-desktop { display: inline-flex; } }

    /* ── FAB "Nueva visita" (solo móvil) ── */
    .fab-nueva-visita {
      position: fixed; z-index: 90;
      right: 1.25rem; bottom: calc(1.25rem + env(safe-area-inset-bottom));
      width: 3.5rem; height: 3.5rem; border-radius: 9999px;
      display: flex; align-items: center; justify-content: center;
      background: var(--brand-purple); color: #fff;
      box-shadow: 0 8px 20px -4px rgba(109,40,217,0.5), 0 2px 6px rgba(0,0,0,0.15);
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out);
    }
    @media (min-width: 768px) { .fab-nueva-visita { display: none; } }
    .fab-nueva-visita:active { transform: scale(0.94); }
    @media (hover: hover) {
      .fab-nueva-visita:hover { background: var(--brand-purple-hover); box-shadow: 0 10px 24px -4px rgba(109,40,217,0.55), 0 2px 6px rgba(0,0,0,0.18); }
    }

    /* ── Mobile: hero compacto ── */
    @media (max-width: 767px) { .hero-desc { display: none; } }

    /* ── Hero compacto cuando hay visita seleccionada ──
       Ligado al ancho de CONTENEDOR: es el mismo umbral (64rem) en el que el
       body pasa a dos columnas y ambas quedan visibles a la vez. */
    @container page (min-width: 64rem) {
      .hero-compact { transition: padding 200ms var(--ease-out); }
      .hero-compact .hero-inner { padding-top: 0.625rem; padding-bottom: 0.625rem; }
      .hero-compact .hero-desc { display: none; }
      .hero-compact .hero-eyebrow { display: none; }
      .hero-compact .hero-title { font-size: 1rem; }
    }
    /* ── Una sola columna: ocultar hero cuando hay visita seleccionada ── */
    @container page (max-width: 63.9375rem) {
      .hero-compact {
        display: none;
      }
    }
    @media (max-width: 479px) {
      .hero-eyebrow { display: none; }
      .hero-title { font-size: 1.25rem; }
    }

    /* ───── Card entrada animada ───── */
    .card-anim { animation: cardIn 280ms var(--ease-out) both; }
    @keyframes cardIn { from { opacity: 0; transform: translateY(4px) scale(0.99); } to { opacity: 1; transform: none; } }

    /* ───── Visita card (lista) ───── */
    .visita-card {
      width: 100%; padding: 0.875rem; border-radius: 0.875rem;
      background: var(--bg-light);
      border: 1px solid var(--border-light);
      text-align: left;
      transition: all 200ms var(--ease-out);
      animation: visitaIn 320ms var(--ease-out) both;
      animation-delay: var(--stagger, 0ms);
      cursor: pointer;
    }
    :host-context(.dark) .visita-card { background: #1e293b; border-color: var(--border-dark); }
    @keyframes visitaIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @media (hover: hover) {
      .visita-card:hover { border-color: #c4b5fd; box-shadow: 0 4px 12px -4px rgba(109,40,217,0.15); transform: translateX(2px); }
      :host-context(.dark) .visita-card:hover { border-color: var(--brand-purple); }
    }
    .visita-card:active { transform: scale(0.99); }
    .visita-card.is-active {
      border-color: var(--brand-purple);
      background: linear-gradient(135deg, rgba(109,40,217,0.06), rgba(109,40,217,0.02));
      box-shadow: 0 4px 14px -4px rgba(109,40,217,0.25);
    }
    :host-context(.dark) .visita-card.is-active {
      background: linear-gradient(135deg, rgba(167,139,250,0.10), rgba(167,139,250,0.02));
      border-color: #a78bfa;
    }

    .visita-icon {
      width: 2.25rem; height: 2.25rem; border-radius: 0.625rem;
      background: rgba(109,40,217,0.08);
      color: var(--brand-purple);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: transform 200ms var(--ease-out);
    }
    :host-context(.dark) .visita-icon { color: #a78bfa; background: rgba(167,139,250,0.12); }
    .visita-card:hover .visita-icon { transform: rotate(-4deg); }

    /* ───── Badges & chips ───── */
    .badge-emerald {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.125rem; height: 1.125rem; border-radius: 9999px;
      background: #10b981; color: #fff; flex-shrink: 0;
    }

    .chip-slate {
      display: inline-flex; align-items: center;
      padding: 0.125rem 0.5rem; font-size: 0.65rem; font-weight: 600;
      border-radius: 9999px; background: #f1f5f9; color: #64748b;
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    :host-context(.dark) .chip-slate { background: #334155; color: #cbd5e1; }

    .chip-state {
      display: inline-flex; align-items: center;
      padding: 0.125rem 0.5rem; font-size: 0.65rem; font-weight: 600;
      border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .chip-upcoming { background: #ecfdf5; color: #059669; }
    :host-context(.dark) .chip-upcoming { background: rgba(5,150,105,0.15); color: #34d399; }
    .chip-curso { background: #fffbeb; color: #d97706; }
    :host-context(.dark) .chip-curso { background: rgba(217,119,6,0.18); color: #fbbf24; }
    .chip-done { background: #f1f5f9; color: #64748b; }
    :host-context(.dark) .chip-done { background: #334155; color: #94a3b8; }

    /* ───── Workflow Stepper ───── */
    /* Wrapper con fade en los bordes para indicar scroll horizontal */
    .stepper-nav-wrap {
      position: relative;
    }
    .stepper-nav-wrap::before,
    .stepper-nav-wrap::after {
      content: '';
      position: absolute;
      top: 0; bottom: 1px; width: 1.25rem;
      pointer-events: none; z-index: 2;
    }
    .stepper-nav-wrap::before {
      left: 0;
      background: linear-gradient(to right, #fff 30%, transparent);
    }
    .stepper-nav-wrap::after {
      right: 0;
      background: linear-gradient(to left, #fff 30%, transparent);
    }
    :host-context(.dark) .stepper-nav-wrap::before {
      background: linear-gradient(to right, #0f172a 30%, transparent);
    }
    :host-context(.dark) .stepper-nav-wrap::after {
      background: linear-gradient(to left, #0f172a 30%, transparent);
    }
    @media (min-width: 640px) {
      .stepper-nav-wrap::before,
      .stepper-nav-wrap::after { display: none; }
    }

    .stepper-nav {
      display: flex; align-items: center;
      padding: 0.25rem 0.75rem;
      overflow-x: auto; scrollbar-width: none; gap: 0;
      border-bottom: 1px solid #f1f5f9;
    }
    @media (min-width: 640px) {
      .stepper-nav { padding: 0.625rem 1.25rem; }
    }
    @container page (min-width: 64rem) {
      .stepper-nav { justify-content: flex-end; }
    }
    .stepper-nav::-webkit-scrollbar { display: none; }
    :host-context(.dark) .stepper-nav { border-bottom-color: #1e293b; }

    .stepper-step {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.625rem 0.5rem; flex-shrink: 0; min-height: 2.75rem;
      border-radius: 0.5rem; border: none; background: transparent; cursor: pointer;
      transition: background 140ms;
    }
    @media (min-width: 640px) {
      .stepper-step { padding: 0.375rem 0.5rem; min-height: unset; }
    }
    .stepper-step:hover:not(.is-active) { background: rgba(109,40,217,0.05); }
    :host-context(.dark) .stepper-step:hover:not(.is-active) { background: rgba(167,139,250,0.07); }
    .stepper-step:active { transform: scale(0.97); }

    /* Ocultar step-desc en móvil */
    @media (max-width: 639px) {
      .step-desc { display: none; }
      .step-content { gap: 0; }
      .step-label { font-size: 0.75rem; }
    }

    .step-indicator {
      width: 1.375rem; height: 1.375rem; border-radius: 9999px; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 0.6875rem; font-weight: 800;
      border: 1.5px solid #cbd5e1; color: #94a3b8;
      transition: background 220ms cubic-bezier(0.22,1,0.36,1),
                  border-color 220ms cubic-bezier(0.22,1,0.36,1),
                  color 220ms cubic-bezier(0.22,1,0.36,1),
                  transform 220ms cubic-bezier(0.22,1,0.36,1);
    }
    /* Checkmark entra con scale + rotación ligera */
    .step-indicator svg {
      width: 0.65rem; height: 0.65rem;
      animation: checkmarkIn 320ms cubic-bezier(0.22,1,0.36,1) both;
    }
    @keyframes checkmarkIn {
      from { opacity: 0; transform: scale(0.3) rotate(-20deg); }
      to   { opacity: 1; transform: none; }
    }
    /* Pulso sutil al activarse un paso */
    .stepper-step.is-active .step-indicator {
      transform: scale(1.1);
    }
    :host-context(.dark) .step-indicator { border-color: #334155; color: #64748b; }
    .stepper-step.is-active .step-indicator { border-color: var(--brand-purple); background: var(--brand-purple); color: #fff; }
    :host-context(.dark) .stepper-step.is-active .step-indicator { border-color: #a78bfa; background: #a78bfa; color: #1e293b; }
    .stepper-step.is-done .step-indicator { border-color: #10b981; background: rgba(16,185,129,0.1); color: #059669; }
    :host-context(.dark) .stepper-step.is-done .step-indicator { background: rgba(52,211,153,0.1); color: #34d399; border-color: #34d399; }

    .step-content { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }

    .step-label {
      display: inline-flex; align-items: center; gap: 0.25rem;
      font-size: 0.8rem; font-weight: 600; line-height: 1.2;
      color: #94a3b8; white-space: nowrap; transition: color 140ms;
    }
    :host-context(.dark) .step-label { color: #64748b; }
    .stepper-step.is-active .step-label { color: var(--brand-purple); }
    :host-context(.dark) .stepper-step.is-active .step-label { color: #a78bfa; }
    .stepper-step.is-done:not(.is-active) .step-label { color: #475569; }
    :host-context(.dark) .stepper-step.is-done:not(.is-active) .step-label { color: #94a3b8; }

    .step-desc {
      font-size: 0.6rem; line-height: 1.2; white-space: nowrap;
      color: #94a3b8;
    }
    :host-context(.dark) .step-desc { color: #475569; }
    .stepper-step.is-active .step-desc { color: #8b5cf6; }
    :host-context(.dark) .stepper-step.is-active .step-desc { color: #7c3aed; }
    .stepper-step.is-done:not(.is-active) .step-desc { color: #059669; }
    :host-context(.dark) .stepper-step.is-done:not(.is-active) .step-desc { color: #34d399; opacity: 0.75; }

    .step-connector {
      flex-shrink: 0; height: 1px; width: 1.5rem;
      background: #e2e8f0;
      position: relative; overflow: hidden;
    }
    :host-context(.dark) .step-connector { background: #1e293b; }

    /* Fill progresivo de izquierda a derecha al completar el paso */
    .step-connector::after {
      content: '';
      position: absolute; inset: 0;
      background: rgba(16,185,129,0.7);
      transform: scaleX(0);
      transform-origin: left center;
      transition: transform 480ms cubic-bezier(0.22,1,0.36,1);
    }
    :host-context(.dark) .step-connector::after { background: rgba(52,211,153,0.55); }
    .step-connector.done::after { transform: scaleX(1); }

    .step-badge {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 1rem; height: 1rem; padding: 0 0.2rem;
      font-size: 0.5625rem; font-weight: 700; border-radius: 9999px;
      background: rgba(109,40,217,0.1); color: var(--brand-purple);
    }
    .stepper-step.is-active .step-badge { background: var(--brand-purple); color: #fff; }
    .stepper-step.is-done .step-badge { background: rgba(16,185,129,0.12); color: #059669; }

    .step-dirty {
      width: 0.375rem; height: 0.375rem; border-radius: 9999px;
      background: #f59e0b; display: inline-block; flex-shrink: 0;
    }

    /* Botón "Cerrar" del detalle (no destructivo) */
    .btn-close-detail {
      display: inline-flex; align-items: center; gap: 0.375rem; flex-shrink: 0;
      padding: 0.5rem 0.75rem; min-height: 2.5rem; cursor: pointer;
      font-size: 0.8125rem; font-weight: 600;
      border-radius: 0.625rem; border: 1px solid var(--border-light);
      color: #64748b; background: var(--bg-light);
      transition: border-color 160ms var(--ease-out), color 160ms var(--ease-out);
    }
    :host-context(.dark) .btn-close-detail { border-color: var(--border-dark); color: #94a3b8; background: var(--bg-dark); }
    @media (hover: hover) {
      .btn-close-detail:hover { border-color: #cbd5e1; color: #334155; }
      :host-context(.dark) .btn-close-detail:hover { color: #e2e8f0; }
    }

    /* Botón "Elegir archivos" dentro del dropzone */
    .btn-elegir {
      display: inline-flex; align-items: center; justify-content: center;
      margin-top: 0.75rem; padding: 0.5rem 1rem;
      font-size: 0.8125rem; font-weight: 600;
      border-radius: 0.625rem; background: var(--brand-purple); color: #fff;
      box-shadow: 0 1px 2px rgba(109,40,217,0.18);
    }

    /* Spinner en color de marca (para fondos claros) */
    .spinner-brand { width: 1.25rem; height: 1.25rem; border-width: 2.5px; border-color: var(--brand-purple); border-right-color: transparent; }

    /* Skeleton de carga de la lista */
    .skeleton-card {
      height: 5.25rem; border-radius: 0.875rem;
      background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%);
      background-size: 400% 100%;
      animation: shimmer 1.4s ease-in-out infinite, visitaIn 320ms var(--ease-out) both;
      animation-delay: 0ms, var(--stagger, 0ms);
    }
    :host-context(.dark) .skeleton-card {
      background: linear-gradient(90deg, #1e293b 25%, #334155 37%, #1e293b 63%);
      background-size: 400% 100%;
    }
    @keyframes shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

    /* ───── Tab panel transition ───── */
    /* backwards: con "both" el panel conserva un transform identidad que crea
       stacking context y encierra los popups de fecha/hora del editor. */
    .tab-panel { animation: panelIn 280ms cubic-bezier(0.22,1,0.36,1) backwards; }
    @keyframes panelIn {
      from { opacity: 0; transform: translateY(5px) scale(0.995); }
      to   { opacity: 1; transform: none; }
    }

    /* ───── Dropzone ───── */
    .dropzone {
      display: block; cursor: pointer;
      border: 2px dashed #cbd5e1; border-radius: 1rem;
      padding: 1.75rem 1rem;
      background: #f8fafc;
      transition: border-color 200ms var(--ease-out), background 200ms var(--ease-out), transform 200ms var(--ease-out);
    }
    :host-context(.dark) .dropzone { background: #0f172a; border-color: var(--border-dark); }
    .dropzone:hover { border-color: var(--brand-purple); background: rgba(109,40,217,0.03); }
    :host-context(.dark) .dropzone:hover { border-color: #a78bfa; background: rgba(167,139,250,0.05); }
    .dropzone.is-dragging {
      border-color: var(--brand-purple); background: rgba(109,40,217,0.06);
      transform: scale(1.01);
      box-shadow: 0 8px 24px -8px rgba(109,40,217,0.3);
    }

    /* ───── Filas de archivos ───── */
    .file-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 0.625rem 0.875rem; min-height: 2.75rem;
      background: var(--bg-light); border: 1px solid var(--border-light); border-radius: 0.75rem;
      transition: border-color 160ms var(--ease-out), background 160ms var(--ease-out);
      animation: rowIn 280ms var(--ease-out) both;
      animation-delay: var(--stagger, 0ms);
    }
    :host-context(.dark) .file-row { background: #1e293b; border-color: var(--border-dark); }
    @media (hover: hover) {
      .file-row:hover { border-color: #c4b5fd; background: #faf5ff; }
      :host-context(.dark) .file-row:hover { border-color: var(--brand-purple); background: rgba(109,40,217,0.08); }
    }
    @keyframes rowIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    .file-ico {
      width: 2rem; height: 2rem; border-radius: 0.5rem;
      background: #f1f5f9; color: #64748b;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    :host-context(.dark) .file-ico { background: #334155; color: #cbd5e1; }

    /* El section de agenda no debe cortar el popup del date picker */
    .tab-panel { overflow: visible; }

    /* ───── Empty states ───── */
    .empty-state, .placeholder-detail {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 2.5rem 1.5rem;
      background: linear-gradient(180deg, rgba(248,250,252,0.6), transparent);
      border: 1px dashed var(--border-light); border-radius: 1rem;
    }
    :host-context(.dark) .empty-state, :host-context(.dark) .placeholder-detail {
      background: linear-gradient(180deg, rgba(15,23,42,0.4), transparent);
      border-color: var(--border-dark);
    }
    .empty-icon, .placeholder-icon {
      width: 3.5rem; height: 3.5rem; border-radius: 1.25rem;
      background: rgba(109,40,217,0.08);
      color: var(--brand-purple);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 0.875rem;
    }
    :host-context(.dark) .empty-icon, :host-context(.dark) .placeholder-icon { color: #a78bfa; }
    .placeholder-detail { min-height: 320px; }
    .placeholder-icon { animation: floaty 4s ease-in-out infinite; }
    @keyframes floaty { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

    /* ───── Toast notifications ───── */
    .toast-item {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.75rem 0.875rem;
      border-radius: 0.75rem;
      box-shadow: 0 4px 16px -4px rgba(0,0,0,0.16), 0 1px 3px rgba(0,0,0,0.06);
      animation: toastIn 260ms var(--ease-out) both;
    }
    @keyframes toastIn { from { opacity: 0; transform: translateY(8px) scale(0.97); } to { opacity: 1; transform: none; } }
    .toast-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #15803d; }
    .toast-error { background: #fff1f2; border: 1px solid #fecdd3; color: #be123c; }
    .toast-info { background: #f5f3ff; border: 1px solid #ddd6fe; color: #5b21b6; }
    .toast-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.375rem; height: 1.375rem; border-radius: 50%; flex-shrink: 0;
    }
    .toast-success .toast-icon { background: #dcfce7; }
    .toast-error .toast-icon { background: #ffe4e6; }
    .toast-info .toast-icon { background: #ede9fe; }
    :host-context(.dark) .toast-success { background: #052e16; border-color: #166534; color: #86efac; }
    :host-context(.dark) .toast-error { background: #4c0519; border-color: #9f1239; color: #fca5a5; }
    :host-context(.dark) .toast-info { background: #2e1065; border-color: #6d28d9; color: #c4b5fd; }

    /* ── Banner de contexto "Vista previa" ── */
    @keyframes bannerSlide {
      from { opacity: 0; transform: translateX(-6px); }
      to   { opacity: 1; transform: none; }
    }
    .preview-context-banner {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 1rem; font-size: 0.75rem; font-weight: 500;
      background: rgba(109,40,217,0.06); color: #6d28d9;
      border-bottom: 1px solid rgba(109,40,217,0.12);
      animation: bannerSlide 300ms cubic-bezier(0.22,1,0.36,1) both;
    }
    :host-context(.dark) .preview-context-banner {
      background: rgba(167,139,250,0.08); color: #a78bfa;
      border-bottom-color: rgba(167,139,250,0.15);
    }

    /* ───── Spinner ───── */
    .spinner {
      width: 0.875rem; height: 0.875rem; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent;
      animation: spin 600ms linear infinite;
      display: inline-block;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ───── Scrollbar ───── */
    .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.25); border-radius: 999px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.45); }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }

    /* ───── Barra de guardado (tab Agenda) ─────
       Pie fijo del layout — hermana del contenedor con scroll, no hija:
       siempre pegada al borde inferior, el contenido scrollea por encima. */
    .save-bar {
      display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
      flex-wrap: wrap; row-gap: 0.5rem;
      padding: 0.75rem 1rem;
      padding-bottom: max(0.75rem, env(safe-area-inset-bottom));
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      transition: border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out);
    }
    /* Mismos umbrales que el px del body (@2xl/page:px-6, @7xl/page:px-10) para
       que el botón primario quede alineado con el contenido que hay encima. */
    @container page (min-width: 42rem) { .save-bar { padding-inline: 1.5rem; } }
    @container page (min-width: 80rem) { .save-bar { padding-inline: 2.5rem; } }
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
      flex-shrink: 0;
      animation: dotPulse 1.6s ease-in-out infinite;
    }

    @keyframes btnGlow {
      0%, 100% { box-shadow: 0 1px 2px rgba(109,40,217,0.18); }
      50% { box-shadow: 0 0 0 5px rgba(109,40,217,0.18); }
    }
    .btn-pulse:not(:disabled) { animation: btnGlow 2s ease-in-out infinite; }

    /* ───── Colaboradores ───── */
    .btn-colab {
      display: inline-flex; align-items: center; gap: 0.4rem;
      padding: 0.4rem 0.75rem; min-height: 2.25rem;
      font-size: 0.75rem; font-weight: 600;
      color: var(--brand-purple); background: rgba(109,40,217,0.06);
      border: 1px solid rgba(109,40,217,0.18); border-radius: 0.625rem;
      cursor: pointer; transition: background 140ms var(--ease-out), transform 140ms var(--ease-out);
    }
    @media (hover: hover) { .btn-colab:hover { background: rgba(109,40,217,0.12); } }
    .btn-colab:active { transform: scale(0.97); }
    :host-context(.dark) .btn-colab { color: #c4b5fd; background: rgba(167,139,250,0.1); border-color: rgba(167,139,250,0.25); }

    .colab-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 1.125rem; height: 1.125rem; padding: 0 0.3rem;
      border-radius: 9999px; background: var(--brand-purple); color: #fff;
      font-size: 0.6rem; font-weight: 700;
    }
    :host-context(.dark) .colab-count { background: #a78bfa; color: #1e293b; }

    .colab-backdrop {
      position: fixed; inset: 0; z-index: 90;
      background: rgba(15,23,42,0.45);
      backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);
      animation: cardIn 160ms var(--ease-out) both;
    }
    .colab-panel {
      position: fixed; z-index: 95;
      left: 50%; top: 50%; transform: translate(-50%, -50%);
      width: min(28rem, calc(100vw - 2rem));
      max-height: min(34rem, calc(100vh - 4rem));
      display: flex; flex-direction: column;
      background: #fff; border: 1px solid var(--border-light);
      border-radius: 1rem;
      box-shadow: 0 20px 50px -12px rgba(0,0,0,0.3);
      animation: cardIn 200ms var(--ease-out) both;
    }
    :host-context(.dark) .colab-panel { background: #0f172a; border-color: #1e293b; }
    /* Móvil: bottom sheet */
    @media (max-width: 639px) {
      .colab-panel {
        left: 0; right: 0; top: auto; bottom: 0; transform: none;
        width: 100%; max-height: 80vh;
        border-radius: 1rem 1rem 0 0;
      }
    }

    .colab-row {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.5rem 0.625rem; border-radius: 0.75rem;
      border: 1px solid #f1f5f9; background: #f8fafc;
    }
    :host-context(.dark) .colab-row { background: rgba(30,41,59,0.5); border-color: #334155; }

    .colab-avatar {
      width: 2rem; height: 2rem; border-radius: 9999px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(109,40,217,0.1); color: var(--brand-purple);
      font-size: 0.8125rem; font-weight: 700;
    }
    :host-context(.dark) .colab-avatar { background: rgba(167,139,250,0.15); color: #a78bfa; }
    .colab-avatar-sm { width: 1.75rem; height: 1.75rem; font-size: 0.7rem; }

    .colab-result {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.4rem 0.5rem; border-radius: 0.625rem;
      cursor: pointer; transition: background 120ms;
      min-height: 2.75rem;
    }
    @media (hover: hover) { .colab-result:hover { background: rgba(109,40,217,0.05); } }
    :host-context(.dark) .colab-result:hover { background: rgba(167,139,250,0.08); }
    .colab-result:disabled { opacity: 0.6; cursor: wait; }

    .colab-invite-tag {
      font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
      color: var(--brand-purple); background: rgba(109,40,217,0.08);
      padding: 0.2rem 0.5rem; border-radius: 9999px;
    }
    :host-context(.dark) .colab-invite-tag { color: #c4b5fd; background: rgba(167,139,250,0.12); }

    /* ───── Focus visible ───── */
    :focus-visible {
      outline: 2px solid var(--brand-purple);
      outline-offset: 2px;
      border-radius: 0.375rem;
    }
    .field:focus-visible { outline: none; }

    /* ───── Sticky context bar — entrada al seleccionar visita ───── */
    @keyframes stickyBarIn {
      from { opacity: 0; transform: translateY(-10px); }
      to   { opacity: 1; transform: none; }
    }
    .detail-sticky-bar {
      animation: stickyBarIn 340ms cubic-bezier(0.22,1,0.36,1) both;
    }
    /* El header y el stepper-nav dentro se retrasan ligeramente (efecto cascada) */
    .detail-sticky-bar > header {
      animation: stickyBarIn 360ms cubic-bezier(0.22,1,0.36,1) 40ms both;
    }
    .detail-sticky-bar .stepper-nav-wrap {
      animation: stickyBarIn 360ms cubic-bezier(0.22,1,0.36,1) 80ms both;
    }
    /* ───── Densidad compacta en pantallas bajas ─────
       El shell es h-screen: esta página vive en una altura fija. En un MacBook
       14" el viewport útil ronda los 840px y, con una visita abierta, el cromo
       (hero + barra de detalle + stepper + save-bar) se comía ~255px de 585px
       de contenido. Aquí se recupera ~105px sin perder información: sólo cae
       el eyebrow decorativo y el hero, cuyo título ya se repite en la barra de
       detalle — la acción "Nueva visita" del hero ya está oculta en este
       estado (hay una visita seleccionada), así que no hay CTA que perder.

       Un 16" con el dock oculto (~975px) queda fuera y conserva la densidad
       normal. La altura sí es del viewport, no del contenedor, así que esto es
       correctamente un @media. */
    @media (max-height: 900px) and (min-width: 1024px) {
      .hero-compact { display: none; }

      .detail-sticky-bar > header { padding-top: 0.5rem; padding-bottom: 0.5rem; }
      .detail-eyebrow { display: none !important; }

      .stepper-nav { padding-top: 0.375rem; padding-bottom: 0.375rem; }
      .step-desc { font-size: 0.55rem; }

      .save-bar {
        padding-top: 0.5rem;
        padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
      }
    }

    /* ───── Reduced motion ───── */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
      .placeholder-icon { animation: none; }
      .detail-sticky-bar,
      .detail-sticky-bar > header,
      .detail-sticky-bar .stepper-nav-wrap,
      .preview-context-banner,
      .step-connector::after { animation: none; transition: none; }
    }
  `]
})
export class VisitaMainPage implements OnInit {
  private svc = inject(VisitaService);
  private portalSvc = inject(EntregaPortalService);
  private ctx = inject(CongregacionContextService);
  private usuariosSvc = inject(UsuariosService);

  @ViewChild('formContainer') formContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('stepperNavRef') stepperNavRef?: ElementRef<HTMLElement>;

  visitas = signal<Visita[]>([]);
  seleccionada = signal<Visita | null>(null);
  archivos = signal<{ nombre: string; tamano_bytes: number }[]>([]);
  agendaItems = signal<AgendaItem[]>([]);
  /** ¿La visita ya tiene enlace activo? Lo reporta <app-entrega-metodos>; aquí
   *  solo sirve para marcar el paso "Entrega" como completado en el stepper. */
  hayEnlace = signal(false);
  nuevoVisita = signal(false);
  guardando = signal(false);
  isDragging = signal(false);
  cargandoLista = signal(false);
  subiendo = signal(false);
  activeTab = signal<Tab>('agenda');
  notifications = signal<Toast[]>([]);
  /** id de la visita cuya tarjeta en la lista muestra la confirmación inline de borrado. */
  pendingDeleteVisitaId = signal<number | null>(null);
  pendingDeleteFile = signal<string | null>(null);
  agendaDirty = signal(false);
  /** Snapshot (JSON) de la agenda tal como está guardada — para comparar contenido real, no solo "algo disparó un evento". */
  private agendaBaseline = '';
  agendaSecciones = signal<AgendaSecciones>({});

  // ── Colaboradores ──
  colabOpen = signal(false);
  colaboradores = signal<Colaborador[]>([]);
  colabResultados = signal<{ id_usuario: number; nombre: string; correo?: string }[]>([]);
  buscandoColab = signal(false);
  invitandoId = signal<number | null>(null);
  colabQuery = '';
  private colabSearchTimer?: ReturnType<typeof setTimeout>;

  private _nId = 0;

  tabs: { id: Tab; label: string; paso: number; desc: string; icon: string }[] = [
    { id: 'agenda',  label: 'Agenda',       paso: 1, desc: 'Programa los puntos',  icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>' },
    { id: 'docs',    label: 'Archivos',     paso: 2, desc: 'Adjunta documentos',  icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>' },
    { id: 'preview', label: 'Vista previa', paso: 3, desc: 'Revisa el portal',    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>' },
    { id: 'entrega', label: 'Entrega',      paso: 4, desc: 'Genera el enlace',    icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>' },
  ];

  tabsConEstado = computed(() =>
    this.tabs.map(t => ({
      ...t,
      completado: (() => {
        const v = this.seleccionada();
        if (t.id === 'agenda')  return !!v?.archivo_agenda;
        if (t.id === 'docs')    return this.archivos().length > 0;
        if (t.id === 'entrega') return this.hayEnlace();
        return false;
      })(),
    }))
  );

  // Orden secuencial del flujo — debe coincidir con el stepper visual (`tabs`):
  // Agenda → Archivos → Vista previa → Entrega
  private tabOrder: Tab[] = ['agenda', 'docs', 'preview', 'entrega'];

  siguienteTab = computed<Tab | null>(() => {
    const idx = this.tabOrder.indexOf(this.activeTab());
    return idx >= 0 && idx < this.tabOrder.length - 1 ? this.tabOrder[idx + 1] : null;
  });

  siguienteLabel = computed(() => {
    const next = this.siguienteTab();
    return next ? (this.tabs.find(t => t.id === next)?.label ?? '') : '';
  });

  irSiguiente() {
    const next = this.siguienteTab();
    if (next) this.activeTab.set(next);
    setTimeout(() => this.scrollActiveStepIntoView(), 50);
  }

  setActiveTab(id: Tab, btn: EventTarget | null) {
    this.activeTab.set(id);
    if (btn instanceof HTMLElement) {
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  private scrollActiveStepIntoView() {
    const nav = this.stepperNavRef?.nativeElement;
    if (!nav) return;
    const active = nav.querySelector('.stepper-step.is-active') as HTMLElement | null;
    if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  form: any = {
    nombre_superintendente: '',
    correo_superintendente: '',
    fecha_inicio: '',
    fecha_fin: '',
    semestre: '',
  };

  /** true mientras "Fecha fin" siga siendo la sugerencia automática (+7 días)
   *  y no algo que el usuario haya elegido a mano. Se apaga en cuanto toca
   *  el campo directamente, para no pisarle la elección después. */
  fechaFinEsSugerencia = signal(true);

  /** true mientras "Semestre" siga siendo el calculado automáticamente a
   *  partir de "Fecha inicio" y no algo que el usuario haya editado a mano. */
  semestreEsSugerencia = signal(true);

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.cargandoLista.set(true);
    this.svc.list().subscribe({
      next: (v) => { this.visitas.set(v); this.cargandoLista.set(false); },
      error: () => { this.cargandoLista.set(false); this.toast('error', 'No se pudieron cargar las visitas'); },
    });
  }

  abrirFormulario() {
    // Si había una visita abierta, se cierra: si no, el panel derecho seguía
    // mostrando su detalle (agenda, stepper, etc.) mientras el izquierdo ya
    // pedía datos para una visita distinta — dos flujos mezclados en pantalla.
    // Al limpiarla, el derecho cae en el mismo placeholder "Selecciona una
    // visita" que ya se ve al crear desde cero, así el estado queda igual sin
    // importar desde dónde se abrió el formulario.
    this.seleccionada.set(null);
    this.nuevoVisita.set(true);
    setTimeout(() => {
      this.formContainerRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }

  cancelarForm() {
    this.nuevoVisita.set(false);
    this.resetForm();
  }

  /** "Fecha inicio" cambió: si el usuario aún no tocó "Fecha fin" a mano,
   *  se le sugiere automáticamente una semana después. */
  onFechaInicioChange(value: string | null) {
    this.form.fecha_inicio = value;
    if (value && this.fechaFinEsSugerencia()) {
      this.form.fecha_fin = this.sumarDias(value, 7);
    }
    if (value && this.semestreEsSugerencia()) {
      this.form.semestre = this.calcularSemestre(value);
    }
  }

  /** El usuario tocó "Fecha fin" directamente: respetamos su elección y
   *  dejamos de recalcularla cuando cambie "Fecha inicio". */
  onFechaFinChange(value: string | null) {
    this.form.fecha_fin = value;
    this.fechaFinEsSugerencia.set(false);
  }

  /** El usuario editó "Semestre" a mano: respetamos su elección y dejamos
   *  de recalcularlo cuando cambie "Fecha inicio". */
  onSemestreChange(value: string) {
    this.form.semestre = value;
    this.semestreEsSugerencia.set(false);
  }

  /** Enero–junio → semestre I, julio–diciembre → semestre II. */
  private calcularSemestre(fechaIso: string): string {
    const [anio, mes] = fechaIso.split('-').map(Number);
    return `${anio}-${mes <= 6 ? 'I' : 'II'}`;
  }

  private sumarDias(fechaIso: string, dias: number): string {
    const [y, m, d] = fechaIso.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + dias);
    const yy = date.getFullYear();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  private resetForm() {
    this.fechaFinEsSugerencia.set(true);
    this.semestreEsSugerencia.set(true);
    this.form = { fecha_inicio: '', fecha_fin: '', nombre_superintendente: '', correo_superintendente: '', semestre: '' };
  }

  crearVisita() {
    const idCong = this.ctx.effectiveCongregacionId();
    if (!idCong) {
      this.toast('info', 'Selecciona una congregación en el contexto de la app.');
      return;
    }
    this.guardando.set(true);
    this.svc.create({ ...this.form, id_congregacion: idCong }).subscribe({
      next: (v) => {
        this.visitas.update(arr => [v, ...arr]);
        this.nuevoVisita.set(false);
        this.resetForm();
        this.guardando.set(false);
        this.abrir(v);
        this.toast('success', 'Visita creada correctamente');
      },
      error: (e) => {
        this.toast('error', this.errMsg(e, 'Error al crear visita'));
        this.guardando.set(false);
      },
    });
  }

  abrir(v: Visita) {
    this.seleccionada.set(v);
    this.hayEnlace.set(false);
    this.activeTab.set('agenda');
    this.pendingDeleteFile.set(null);
    const items = v.agenda_json?.items?.length ? structuredClone(v.agenda_json.items) : [{ dia: '', actividad: '' }];
    this.agendaItems.set(items);
    this.agendaSecciones.set(v.agenda_json?.secciones ? structuredClone(v.agenda_json.secciones) : {});
    this.agendaBaseline = this.snapshotAgenda();
    this.agendaDirty.set(false);
    this.svc.listarArchivos(v.id_visita).subscribe({
      next: (a) => this.archivos.set(a),
      error: () => this.toast('error', 'No se pudieron cargar los archivos'),
    });
    this.colabOpen.set(false);
    this.colaboradores.set([]);
    this.svc.listarColaboradores(v.id_visita).subscribe({
      next: (cs) => this.colaboradores.set(cs),
      error: () => {},
    });
  }

  // ── Colaboradores ──

  abrirColaboradores() {
    this.colabQuery = '';
    this.colabResultados.set([]);
    this.colabOpen.set(true);
    const v = this.seleccionada();
    if (!v) return;
    this.svc.listarColaboradores(v.id_visita).subscribe({
      next: (cs) => this.colaboradores.set(cs),
      error: () => {},
    });
  }

  buscarUsuariosColab() {
    clearTimeout(this.colabSearchTimer);
    const q = this.colabQuery.trim();
    const v = this.seleccionada();
    if (q.length < 2 || !v) {
      this.colabResultados.set([]);
      this.buscandoColab.set(false);
      return;
    }
    this.buscandoColab.set(true);
    this.colabSearchTimer = setTimeout(() => {
      // Se pasa la congregación de la VISITA (no la del secretario) para que
      // también funcione cuando quien invita es Administrador/Gestor Aplicación,
      // que no tienen congregación propia vinculada.
      this.usuariosSvc.getUsuariosMiCongregacion(q, v.id_congregacion).subscribe({
        next: (us: any[]) => {
          const yaInvitados = new Set(this.colaboradores().map(c => c.id_usuario));
          this.colabResultados.set(
            (us || []).filter(u => !yaInvitados.has(u.id_usuario))
          );
          this.buscandoColab.set(false);
        },
        error: () => {
          this.buscandoColab.set(false);
          this.toast('error', 'No se pudieron buscar usuarios');
        },
      });
    }, 300);
  }

  invitarColab(u: { id_usuario: number; nombre: string }) {
    const v = this.seleccionada();
    if (!v || this.invitandoId() !== null) return;
    this.invitandoId.set(u.id_usuario);
    this.svc.agregarColaborador(v.id_visita, u.id_usuario).subscribe({
      next: (c) => {
        this.colaboradores.update(arr => [...arr, c]);
        this.colabResultados.update(arr => arr.filter(x => x.id_usuario !== u.id_usuario));
        this.invitandoId.set(null);
        this.toast('success', `${c.nombre} fue invitado como colaborador`);
      },
      error: (e) => {
        this.invitandoId.set(null);
        this.toast('error', this.errMsg(e, 'Error al invitar colaborador'));
      },
    });
  }

  quitarColab(c: Colaborador) {
    const v = this.seleccionada();
    if (!v) return;
    this.svc.quitarColaborador(v.id_visita, c.id_usuario).subscribe({
      next: () => {
        this.colaboradores.update(arr => arr.filter(x => x.id_usuario !== c.id_usuario));
        this.toast('info', `${c.nombre} ya no es colaborador`);
      },
      error: (e) => this.toast('error', this.errMsg(e, 'Error al quitar colaborador')),
    });
  }

  isUpcoming(v: Visita): boolean {
    return this.estadoVisita(v) === 'proxima';
  }

  estadoVisita(v: Visita): 'proxima' | 'curso' | 'realizada' {
    const hoy = new Date().toISOString().slice(0, 10);
    if (v.fecha_inicio > hoy) return 'proxima';
    const fin = v.fecha_fin || v.fecha_inicio;
    if (fin >= hoy) return 'curso';
    return 'realizada';
  }

  estadoLabel(v: Visita): string {
    return { proxima: 'Próxima', curso: 'En curso', realizada: 'Realizada' }[this.estadoVisita(v)];
  }

  /** Serializa el contenido real de la agenda (no un contador de eventos) para comparar contra lo guardado. */
  private snapshotAgenda(): string {
    return JSON.stringify({ items: this.agendaItems(), secciones: this.agendaSecciones() });
  }

  /**
   * Se llama cada vez que el editor de agenda emite un cambio. En vez de asumir
   * que "hubo un evento = hay cambios" (frágil: un evento espurio del date/time
   * picker dejaba el botón de guardar brillando sin que el usuario editara nada),
   * comparamos el contenido real contra la última versión guardada.
   */
  markAgendaDirty() {
    this.agendaDirty.set(this.snapshotAgenda() !== this.agendaBaseline);
  }

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
          this.toast('error', this.errMsg(e, `Error al subir "${file.name}"`));
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

  confirmarEliminarArchivo(nombre: string) {
    this.pendingDeleteFile.set(null);
    this.svc.eliminarArchivo(this.seleccionada()!.id_visita, nombre).subscribe({
      next: () => this.archivos.update(a => a.filter(x => x.nombre !== nombre)),
      error: (e) => this.toast('error', this.errMsg(e, 'Error al eliminar archivo')),
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

  generarAgenda() {
    const v = this.seleccionada();
    if (!v) return;
    this.guardando.set(true);
    this.svc.generarAgenda({
      id_visita: v.id_visita,
      titulo: `Agenda Visita del Superintendente — ${v.semestre || ''}`.trim(),
      items: this.agendaItems().filter(i => i.actividad?.trim()),
      secciones: this.seccionesLimpias(),
    }).subscribe({
      next: (updated) => {
        this.seleccionada.set(updated);
        this.visitas.update(arr => arr.map(x => x.id_visita === updated.id_visita ? updated : x));
        this.agendaBaseline = this.snapshotAgenda();
        this.agendaDirty.set(false);
        this.toast('success', 'Agenda guardada y generada correctamente');
        this.guardando.set(false);
      },
      error: (e) => {
        this.toast('error', this.errMsg(e, 'Error al generar agenda'));
        this.guardando.set(false);
      },
    });
  }

  descargarAgenda() {
    const v = this.seleccionada()!;
    this.svc.descargarAgenda(v.id_visita).subscribe({
      next: (blob) => this.saveBlob(blob, v.archivo_agenda || 'agenda.xlsx'),
      error: () => this.toast('error', 'Error al descargar la agenda'),
    });
  }

  /** Tarjeta (S-21) del publicador elegido en una fila de la agenda. */
  descargarTarjetaPublicador(ev: { idPublicador: number; nombre: string }) {
    const v = this.seleccionada();
    if (!v) return;
    const now = new Date();
    const anio = now.getMonth() + 1 >= 9 ? now.getFullYear() + 1 : now.getFullYear();
    this.portalSvc.tarjetaPdfInterno(v.id_visita, anio, { publicadorId: ev.idPublicador }).subscribe({
      next: (blob) => {
        const slug = (ev.nombre || 'publicador').replace(/\s+/g, '_');
        this.saveBlob(blob, `tarjeta_${slug}_ano${anio}.pdf`);
      },
      error: (e) => this.toast('error', this.errMsg(e, 'No se pudo abrir la tarjeta del publicador')),
    });
  }

  /** Elimina una visita desde su tarjeta en la lista (confirmación inline, sin abrirla). */
  eliminarVisitaDesdeCard(v: Visita) {
    this.pendingDeleteVisitaId.set(null);
    this.svc.remove(v.id_visita).subscribe({
      next: () => {
        this.visitas.update(arr => arr.filter(x => x.id_visita !== v.id_visita));
        if (this.seleccionada()?.id_visita === v.id_visita) this.seleccionada.set(null);
        this.toast('success', 'Visita eliminada');
      },
      error: (e) => this.toast('error', this.errMsg(e, 'Error al eliminar visita')),
    });
  }

  /** Extrae un mensaje legible de un error HTTP. "detail" puede venir como
   *  string o, en errores de validación de FastAPI/Pydantic, como un arreglo
   *  de objetos { msg, loc, ... } que no se debe mostrar tal cual. */
  private errMsg(e: any, fallback: string): string {
    const detail = e?.error?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (Array.isArray(detail) && detail.length) {
      return detail.map((d) => (typeof d === 'string' ? d : d?.msg)).filter(Boolean).join(', ') || fallback;
    }
    return fallback;
  }

  toast(type: ToastType, msg: string, duration = 4000) {
    const id = ++this._nId;
    this.notifications.update(n => [...n, { id, type, msg }]);
    if (duration > 0) setTimeout(() => this.dismissToast(id), duration);
  }

  dismissToast(id: number) {
    this.notifications.update(n => n.filter(x => x.id !== id));
  }

  private saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}
