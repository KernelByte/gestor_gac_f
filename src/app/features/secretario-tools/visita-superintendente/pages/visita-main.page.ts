import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VisitaService } from '../../services/visita.service';
import { AgendaItem, Visita } from '../../models/visita.model';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { EntregaPortalComponent } from '../components/entrega-portal.component';
import { EntregaPortalService } from '../services/entrega-portal.service';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';

type Tab = 'docs' | 'agenda' | 'entrega' | 'preview';
type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; msg: string; }

@Component({
  standalone: true,
  selector: 'app-visita-main',
  imports: [CommonModule, FormsModule, EntregaPortalComponent, DatePickerComponent],
  template: `
  <div class="h-full flex flex-col overflow-hidden">

    <!-- ───────── HERO + BODY WRAPPER ───────── -->
    <div class="flex-1 flex flex-col m-1 rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800 min-h-0">

    <!-- ───────── HERO ───────── -->
    <header class="hero-grad text-white shrink-0" [class.hero-compact]="seleccionada() !== null">
      <div class="relative z-10 px-4 sm:px-6 lg:px-10 py-4 sm:py-5 hero-inner">
        <!-- Bloque izquierdo: eyebrow + título + desc + stats -->
        <div>
          <div class="hero-eyebrow">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4M3 17l9 4 9-4"/></svg>
            <span>Módulo Secretario</span>
          </div>
          <h1 class="hero-title">Visita del Superintendente</h1>
          <p class="hero-desc">Organiza la documentación, agenda y entrega al superintendente de circuito.</p>
          <div class="hero-bottom-row mt-3">
            <div class="flex gap-2">
              <div class="stat-card">
                <span class="stat-ico stat-ico-total">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </span>
                <span class="stat-num">{{ visitas().length }}</span>
                <span class="stat-label">Total</span>
              </div>
              <div class="stat-card">
                <span class="stat-ico stat-ico-proximas">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </span>
                <span class="stat-num">{{ proximasCount() }}</span>
                <span class="stat-label">Próximas</span>
              </div>
              <div class="stat-card">
                <span class="stat-ico stat-ico-agenda">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                </span>
                <span class="stat-num">{{ conAgendaCount() }}</span>
                <span class="stat-label">Con agenda</span>
              </div>
            </div>
          </div>
        </div>
        <!-- Bloque derecho: botón centrado verticalmente respecto a todo el contenido -->
        <button (click)="abrirFormulario()" class="btn-hero group hero-btn-desktop" type="button">
          <svg class="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
          <span>Nueva visita</span>
        </button>
      </div>
    </header>

    <!-- ── Barra de detalle: FUERA del scroll container, siempre visible cuando hay visita ── -->
    @if (seleccionada(); as v) {
      <div class="detail-sticky-bar shrink-0 bg-white dark:bg-slate-900
                  border-b border-slate-200 dark:border-slate-800">

        <header class="px-4 sm:px-5 lg:px-7 py-2.5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="hidden sm:flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-1">
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
          <button (click)="seleccionada.set(null)" class="btn-close-detail shrink-0 hidden sm:inline-flex" aria-label="Cerrar detalle">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
            <span class="hidden sm:inline">Cerrar</span>
          </button>
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
    <div class="flex-1 bg-white dark:bg-slate-900 px-4 sm:px-6 lg:px-10 min-h-0 overflow-y-auto grid grid-cols-1 xl:grid-cols-[minmax(320px,380px)_1fr] gap-4 content-start"
         [class.pt-4]="activeTab() !== 'preview' || !seleccionada()"
         [class.pb-4]="true">

      <!-- ────────── COLUMNA IZQUIERDA: LISTA ────────── -->
      <aside
        class="space-y-4 xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto custom-scrollbar pr-1 xl:!block"
        [class.hidden]="seleccionada() !== null">

        <!-- Formulario nueva visita -->
        @if (nuevoVisita()) {
          <div #formContainer class="card-anim bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div class="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 class="font-semibold text-slate-800 dark:text-slate-100 text-sm">Crear nueva visita</h3>
              <button (click)="cancelarForm()" class="icon-btn" aria-label="Cerrar formulario">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
              </button>
            </div>
            <div class="p-5 space-y-3.5">
              <label class="form-label">
                <span>Superintendente</span>
                <input class="field" [(ngModel)]="form.nombre_superintendente" placeholder="Nombre del superintendente" />
              </label>
              <label class="form-label">
                <span>Correo electrónico <span class="field-optional">opcional</span></span>
                <input type="email" class="field" [(ngModel)]="form.correo_superintendente" placeholder="correo@dominio.com" />
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label class="form-label">
                  <span>Fecha inicio <em class="text-rose-500 not-italic">*</em></span>
                  <input type="date" class="field" [(ngModel)]="form.fecha_inicio" />
                </label>
                <label class="form-label">
                  <span>Fecha fin <span class="field-optional">opcional</span></span>
                  <input type="date" class="field" [(ngModel)]="form.fecha_fin" />
                </label>
              </div>
              <label class="form-label">
                <span>Semestre <span class="field-optional">opcional</span></span>
                <input class="field" [(ngModel)]="form.semestre" placeholder="ej. 2026-I" />
              </label>
              <label class="form-label">
                <span>Notas <span class="field-optional">opcional</span></span>
                <textarea rows="2" class="field" [(ngModel)]="form.notas" placeholder="Observaciones internas…"></textarea>
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
        <div class="flex items-center justify-between px-1">
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
            <button
              type="button"
              (click)="abrir(v)"
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
                    @if (v.archivo_agenda) {
                      <span class="badge-emerald" title="Agenda generada">
                        <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                      </span>
                    }
                  </div>
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
                </div>
                <!-- Chevron — affordance de navegación en móvil/tablet -->
                <svg class="xl:hidden w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0 mt-0.5 transition-colors group-hover:text-violet-400 group-active:text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </div>
            </button>
          } @empty {
            <div class="empty-state">
              <div class="empty-icon">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              </div>
              <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Aún no hay visitas</p>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 max-w-[240px] mx-auto">
                Crea tu primera visita para empezar a organizar la documentación.
              </p>
              <button (click)="abrirFormulario()" class="btn-primary">
                + Crear primera visita
              </button>
            </div>
          }
          }
        </div>
      </aside>

      <!-- ────────── COLUMNA DERECHA: DETALLE ────────── -->
      <main class="min-w-0 xl:!block" [class.hidden]="seleccionada() === null">

        <!-- Botón volver — sticky en móvil/tablet -->
        <div class="xl:hidden sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm -mx-4 px-3 border-b border-slate-100 dark:border-slate-800"
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
                <div class="hidden md:grid grid-cols-[1.4fr_0.75fr_0.75fr_1.4fr_1fr_1fr_auto] gap-2 px-2 text-[0.65rem] uppercase tracking-wider font-bold text-slate-400">
                  <span>Fecha</span><span>Inicio</span><span>Fin</span><span>Actividad</span><span>Lugar</span><span>Responsable</span><span></span>
                </div>
                <div class="space-y-2" #agendaList>
                  @for (it of agendaItems(); track $index; let i = $index) {
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
                            (ngModelChange)="markAgendaDirty()"
                            colorScheme="violet"
                            [fieldLike]="true"
                            placeholder="Seleccionar fecha">
                          </app-date-picker>
                        </label>
                        <div class="grid grid-cols-2 gap-2">
                          <label class="form-label">
                            <span>Hora inicio</span>
                            <input type="time" class="field" [(ngModel)]="it.hora_inicio" (ngModelChange)="markAgendaDirty()" />
                          </label>
                          <label class="form-label">
                            <span>Hora fin</span>
                            <input type="time" class="field" [(ngModel)]="it.hora_fin" (ngModelChange)="markAgendaDirty()" />
                          </label>
                        </div>
                        <label class="form-label"><span>Actividad</span><input class="field" placeholder="ej. Discurso público" [(ngModel)]="it.actividad" (ngModelChange)="markAgendaDirty()" /></label>
                        <label class="form-label"><span>Lugar</span><input class="field" placeholder="ej. Salón principal" [(ngModel)]="it.lugar" (ngModelChange)="markAgendaDirty()" /></label>
                        <label class="form-label"><span>Responsable</span><input class="field" placeholder="Nombre del responsable" [(ngModel)]="it.responsable" (ngModelChange)="markAgendaDirty()" /></label>
                      </div>

                      <!-- Desktop: fila en grid -->
                      <div class="hidden md:grid grid-cols-[1.4fr_0.75fr_0.75fr_1.4fr_1fr_1fr_auto] gap-2">
                        <app-date-picker
                          [(ngModel)]="it.dia"
                          (ngModelChange)="markAgendaDirty()"
                          colorScheme="violet"
                          [fieldLike]="true"
                          placeholder="Fecha">
                        </app-date-picker>
                        <input type="time" class="field" [(ngModel)]="it.hora_inicio" (ngModelChange)="markAgendaDirty()" />
                        <input type="time" class="field" [(ngModel)]="it.hora_fin" (ngModelChange)="markAgendaDirty()" />
                        <input class="field" placeholder="Actividad" [(ngModel)]="it.actividad" (ngModelChange)="markAgendaDirty()" />
                        <input class="field" placeholder="Lugar" [(ngModel)]="it.lugar" (ngModelChange)="markAgendaDirty()" />
                        <input class="field" placeholder="Responsable" [(ngModel)]="it.responsable" (ngModelChange)="markAgendaDirty()" />
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

                <div class="flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button (click)="generarAgenda()" [disabled]="guardando()" class="btn-primary">
                    @if (guardando()) { <span class="spinner"></span> Generando… } @else {
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-6h13M9 11l-3-3m0 0l3-3m-3 3h7"/></svg>
                      Guardar y generar agenda
                    }
                  </button>
                  @if (v.archivo_agenda) {
                    <button (click)="descargarAgenda()" class="btn-secondary">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
                      Descargar agenda
                    </button>
                  }
                </div>
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
                <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">Elige cómo entregar la información al superintendente. Puedes usar uno o varios métodos.</p>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

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
                      <span class="delivery-badge delivery-badge-emerald">Portal web · 7 días</span>
                    </div>
                    <h4 class="delivery-title">Portal del superintendente</h4>
                    <p class="delivery-desc">Enlace temporal con registros, totales, contactos, S-88 y documentos. Expira en 7 días.</p>
                    @if (!enlace()) {
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
                        <p class="text-[0.65rem] text-slate-400 mt-1.5">Expira el {{ enlace()!.fecha_expiracion | date:'short' }}</p>
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
              </section>
            }

            <!-- Footer del detalle -->
            <footer class="px-5 lg:px-7 py-4 border-t border-slate-100 dark:border-slate-800">
              @if (confirmandoBorrarVisita()) {
                <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 card-anim">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-rose-700 dark:text-rose-400">
                      ¿Eliminar "{{ seleccionada()?.nombre_superintendente || 'esta visita' }}"?
                    </p>
                    <p class="text-xs text-rose-500 mt-0.5">
                      Se borrarán {{ archivos().length }} archivo(s). Esta acción no se puede deshacer.
                    </p>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <button (click)="confirmandoBorrarVisita.set(false)" class="btn-ghost text-xs">Cancelar</button>
                    <button (click)="confirmarEliminarVisita()" class="px-3 py-1.5 text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors">
                      Sí, eliminar
                    </button>
                  </div>
                </div>
              } @else {
                <div class="flex items-center justify-between gap-2 min-h-[2.75rem]">
                  @if (siguienteTab(); as next) {
                    <button (click)="irSiguiente()" class="btn-next flex-1 sm:flex-none justify-center sm:justify-start" type="button">
                      <span>Siguiente: {{ siguienteLabel() }}</span>
                      <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                    </button>
                  } @else {
                    <span></span>
                  }
                  <button (click)="confirmandoBorrarVisita.set(true)" class="btn-danger-ghost text-xs shrink-0" aria-label="Eliminar visita">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22"/></svg>
                    <span class="font-semibold hidden sm:inline">Eliminar visita</span>
                  </button>
                </div>
              }
            </footer>
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
    </div><!-- /hero+body wrapper -->

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

    .field-hint {
      margin-top: 0.25rem; font-size: 0.6875rem; color: #94a3b8; line-height: 1.4;
    }
    :host-context(.dark) .field-hint { color: #475569; }

    /* ───── Botones ───── */
    .btn-primary, .btn-secondary, .btn-ghost, .btn-hero, .btn-danger-ghost {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.875rem; font-size: 0.8125rem; font-weight: 500;
      border-radius: 0.625rem;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), box-shadow 160ms var(--ease-out), color 160ms var(--ease-out);
      cursor: pointer; user-select: none;
    }
    .btn-primary { background: var(--brand-purple); color: #fff; box-shadow: 0 1px 2px rgba(109, 40, 217, 0.18); }
    .btn-secondary { border: 1px solid var(--border-light); color: #475569; background: var(--bg-light); }
    .btn-ghost { color: #64748b; }
    .btn-hero {
      background: rgba(255,255,255,0.15); color: #fff;
      border: 1px solid rgba(255,255,255,0.30); padding: 0.625rem 1.125rem; font-weight: 600;
      border-radius: 0.75rem;
      backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
      text-shadow: 0 1px 2px rgba(0,0,0,0.15);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2);
    }
    .btn-danger-ghost { color: #f43f5e; padding: 0.375rem 0.625rem; font-size: 0.75rem; }

    :host-context(.dark) .btn-secondary { background: var(--bg-dark); border-color: var(--border-dark); color: #cbd5e1; }
    :host-context(.dark) .btn-ghost { color: #94a3b8; }

    @media (max-width: 767px) {
      .btn-danger-ghost { min-height: 2.75rem; min-width: 2.75rem; justify-content: center; }
    }

    @media (hover: hover) and (pointer: fine) {
      .btn-hero:hover { background: rgba(255,255,255,0.25); border-color: rgba(255,255,255,0.45); box-shadow: 0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3); transform: translateY(-1px); }
      .btn-primary:hover:not(:disabled) { background: var(--brand-purple-hover); box-shadow: 0 4px 14px rgba(109,40,217,0.28); }
      .btn-secondary:hover { background: #f8fafc; border-color: #cbd5e1; }
      .btn-ghost:hover { background: rgba(100,116,139,0.08); color: #334155; }
      .btn-hero:hover { background: rgba(255,255,255,0.26); }
      .btn-danger-ghost:hover { background: rgba(244,63,94,0.08); }
      :host-context(.dark) .btn-secondary:hover { background: #334155; border-color: #475569; color: #f1f5f9; }
      :host-context(.dark) .btn-ghost:hover { background: rgba(148,163,184,0.12); color: #f1f5f9; }
    }
    .btn-primary:active, .btn-secondary:active, .btn-ghost:active, .btn-hero:active, .btn-danger-ghost:active { transform: scale(0.97); }
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
    @media (min-width: 1024px) { .hero-title { font-size: 1.5rem; } }

    /* ── Hero inner: flex row que centra el botón respecto a todo el contenido ── */
    .hero-inner {
      display: flex; flex-direction: row; align-items: center;
      justify-content: space-between; gap: 1.5rem;
    }
    .hero-bottom-row {
      display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;
    }

    /* ── Botón desktop solamente — FAB reemplaza en mobile ── */
    .hero-btn-desktop { display: none; }
    @media (min-width: 768px) { .hero-btn-desktop { display: inline-flex; } }

    /* ── Mobile: hero compacto ── */
    @media (max-width: 767px) { .hero-desc { display: none; } }

    /* ── Hero compacto cuando hay visita seleccionada (xl) ── */
    @media (min-width: 1280px) {
      .hero-compact { transition: padding 200ms var(--ease-out); }
      .hero-compact .hero-inner { padding-top: 0.625rem; padding-bottom: 0.625rem; }
      .hero-compact .hero-desc { display: none; }
      .hero-compact .hero-bottom-row { display: none; }
      .hero-compact .hero-eyebrow { display: none; }
      .hero-compact .hero-title { font-size: 1rem; }
    }
    /* ── En móvil: ocultar hero completamente cuando hay visita seleccionada ── */
    @media (max-width: 1279px) {
      .hero-compact {
        display: none;
      }
    }
    @media (max-width: 479px) {
      .hero-eyebrow { display: none; }
      .hero-title { font-size: 1.25rem; }
      .stat-card { padding: 0.375rem 0.5rem; gap: 0.375rem; }
      .stat-num { font-size: 1.125rem; }
      .stat-label { font-size: 0.55rem; }
      .stat-dot { width: 5px; height: 5px; }
    }

    /* ───── Hero stats ───── */
    .stat-card {
      display: flex; flex-direction: row; align-items: center; gap: 0.5rem;
      padding: 0.375rem 0.75rem;
      background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 0.75rem;
    }
    .stat-ico {
      display: inline-flex; align-items: center; justify-content: center;
      width: 1.5rem; height: 1.5rem; border-radius: 0.5rem; flex-shrink: 0;
    }
    .stat-ico svg { width: 0.875rem; height: 0.875rem; }
    .stat-ico-total    { background: rgba(255,255,255,0.18); color: #fff; }
    .stat-ico-proximas { background: rgba(251,146,60,0.22); color: #fdba74; }
    .stat-ico-agenda   { background: rgba(74,222,128,0.22); color: #86efac; }
    .stat-num {
      font-size: 1.25rem; font-weight: 800; line-height: 1; color: #fff;
      font-variant-numeric: tabular-nums; letter-spacing: -0.02em;
    }
    .stat-label {
      font-size: 0.625rem; color: rgba(255,255,255,0.85);
      font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
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
    @media (min-width: 1280px) {
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

    /* Botón "Siguiente" del flujo */
    .btn-next {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.5rem 0.875rem; font-size: 0.8125rem; font-weight: 600;
      border-radius: 0.625rem; cursor: pointer;
      color: var(--brand-purple); background: rgba(109,40,217,0.08);
      transition: background 200ms cubic-bezier(0.22,1,0.36,1),
                  transform 200ms cubic-bezier(0.22,1,0.36,1);
    }
    :host-context(.dark) .btn-next { color: #c4b5fd; background: rgba(167,139,250,0.14); }
    /* Flecha desliza a la derecha en hover */
    .btn-next svg { transition: transform 240ms cubic-bezier(0.22,1,0.36,1); }
    @media (hover: hover) {
      .btn-next:hover { background: rgba(109,40,217,0.15); transform: translateX(1px); }
      .btn-next:hover svg { transform: translateX(3px); }
    }
    .btn-next:active { transform: scale(0.97); }

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
    .tab-panel { animation: panelIn 280ms cubic-bezier(0.22,1,0.36,1) both; }
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

    /* ───── Agenda rows ───── */
    .agenda-row {
      animation: rowIn 280ms var(--ease-out) both;
      animation-delay: var(--stagger, 0ms);
      /* Permitir que el date picker popup desborde la fila */
      overflow: visible;
    }
    /* El section de agenda no debe cortar el popup del date picker */
    .tab-panel { overflow: visible; }

    .add-row-btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.875rem; font-size: 0.8125rem; font-weight: 500;
      color: var(--brand-purple); border: 1px dashed #c4b5fd; border-radius: 0.625rem; background: transparent;
      transition: transform 160ms var(--ease-out), background-color 160ms var(--ease-out), border-color 160ms var(--ease-out);
    }
    .add-row-btn:active { transform: scale(0.97); }
    @media (hover: hover) { .add-row-btn:hover { background: #faf5ff; border-color: var(--brand-purple); } }
    :host-context(.dark) .add-row-btn { color: #c4b5fd; border-color: var(--brand-purple); }

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
      transition: border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out), transform 200ms var(--ease-out);
    }
    :host-context(.dark) .delivery-card { background: var(--bg-dark); border-color: var(--border-dark); }
    .delivery-card { transition: border-color 240ms cubic-bezier(0.22,1,0.36,1), box-shadow 240ms cubic-bezier(0.22,1,0.36,1), transform 240ms cubic-bezier(0.22,1,0.36,1); }
    @media (hover: hover) {
      .delivery-card:hover { border-color: #c4b5fd; box-shadow: 0 10px 28px -8px rgba(109,40,217,0.2); transform: translateY(-3px); }
      :host-context(.dark) .delivery-card:hover { border-color: var(--brand-purple); }
    }
    .delivery-card:active { transform: translateY(-1px) scale(0.99); }
    .delivery-icon {
      width: 2.75rem; height: 2.75rem; border-radius: 0.875rem;
      display: flex; align-items: center; justify-content: center;
    }
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
    @media (min-width: 1280px) {
      .detail-sticky-bar.xl\:sticky {
        box-shadow: 0 4px 12px -4px rgba(0,0,0,0.10);
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

  @ViewChild('formContainer') formContainerRef?: ElementRef<HTMLElement>;
  @ViewChild('stepperNavRef') stepperNavRef?: ElementRef<HTMLElement>;
  @ViewChild('agendaList')    agendaListRef?: ElementRef<HTMLElement>;

  visitas = signal<Visita[]>([]);
  seleccionada = signal<Visita | null>(null);
  archivos = signal<{ nombre: string; tamano_bytes: number }[]>([]);
  agendaItems = signal<AgendaItem[]>([]);
  enlace = signal<{ url_publica: string; fecha_expiracion: string } | null>(null);
  correoDestino = '';
  nuevoVisita = signal(false);
  guardando = signal(false);
  enviando = signal(false);
  isDragging = signal(false);
  copiado = signal(false);
  cargandoLista = signal(false);
  subiendo = signal(false);
  generandoEnlace = signal(false);
  descargandoZip = signal(false);
  activeTab = signal<Tab>('agenda');
  notifications = signal<Toast[]>([]);
  confirmandoBorrarVisita = signal(false);
  pendingDeleteFile = signal<string | null>(null);
  agendaChangeCount = signal(0);
  agendaSavedAtCount = signal(0);

  agendaDirty = computed(() => this.agendaChangeCount() !== this.agendaSavedAtCount());

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
        if (t.id === 'entrega') return !!this.enlace();
        return false;
      })(),
    }))
  );

  // Orden secuencial del flujo (= orden de los tabs)
  private tabOrder: Tab[] = ['agenda', 'preview', 'docs', 'entrega'];

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

  proximasCount = computed(() =>
    this.visitas().filter(v => this.estadoVisita(v) === 'proxima').length
  );
  conAgendaCount = computed(() => this.visitas().filter(v => !!v.archivo_agenda).length);

  form: any = {
    nombre_superintendente: '',
    correo_superintendente: '',
    fecha_inicio: '',
    fecha_fin: '',
    semestre: '',
    notas: '',
  };

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
    this.nuevoVisita.set(true);
    setTimeout(() => {
      this.formContainerRef?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }

  cancelarForm() {
    this.nuevoVisita.set(false);
    this.resetForm();
  }

  private resetForm() {
    this.form = { fecha_inicio: '', fecha_fin: '', nombre_superintendente: '', correo_superintendente: '', semestre: '', notas: '' };
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
        this.toast('error', e?.error?.detail || 'Error al crear visita');
        this.guardando.set(false);
      },
    });
  }

  abrir(v: Visita) {
    this.seleccionada.set(v);
    this.enlace.set(null);
    this.svc.getEnlaceActivo(v.id_visita).subscribe({
      next: (t) => this.enlace.set(t),
      error: () => {},
    });
    this.activeTab.set('agenda');
    this.confirmandoBorrarVisita.set(false);
    this.pendingDeleteFile.set(null);
    this.correoDestino = v.correo_superintendente || '';
    const items = v.agenda_json?.items?.length ? structuredClone(v.agenda_json.items) : [{ dia: '', actividad: '' }];
    this.agendaItems.set(items);
    this.agendaChangeCount.set(0);
    this.agendaSavedAtCount.set(0);
    this.svc.listarArchivos(v.id_visita).subscribe({
      next: (a) => this.archivos.set(a),
      error: () => this.toast('error', 'No se pudieron cargar los archivos'),
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

  markAgendaDirty() {
    this.agendaChangeCount.update(n => n + 1);
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

  confirmarEliminarArchivo(nombre: string) {
    this.pendingDeleteFile.set(null);
    this.svc.eliminarArchivo(this.seleccionada()!.id_visita, nombre).subscribe({
      next: () => this.archivos.update(a => a.filter(x => x.nombre !== nombre)),
      error: (e) => this.toast('error', e?.error?.detail || 'Error al eliminar archivo'),
    });
  }

  agregarFila() {
    this.agendaItems.update(arr => [...arr, { dia: '', actividad: '' }]);
    this.markAgendaDirty();
    // Scroll automático a la nueva fila después de que Angular la renderice
    setTimeout(() => {
      const list = this.agendaListRef?.nativeElement;
      if (list) {
        const lastRow = list.lastElementChild as HTMLElement | null;
        lastRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        // Enfocar el primer input de la nueva fila para UX fluido
        const firstInput = lastRow?.querySelector('input, button.dp-trigger') as HTMLElement | null;
        firstInput?.focus();
      }
    }, 60);
  }
  eliminarFila(i: number) {
    this.agendaItems.update(arr => arr.filter((_, idx) => idx !== i));
    this.markAgendaDirty();
  }

  generarAgenda() {
    const v = this.seleccionada();
    if (!v) return;
    this.guardando.set(true);
    this.svc.generarAgenda({
      id_visita: v.id_visita,
      titulo: `Agenda Visita del Superintendente — ${v.semestre || ''}`.trim(),
      items: this.agendaItems().filter(i => i.actividad?.trim()),
    }).subscribe({
      next: (updated) => {
        this.seleccionada.set(updated);
        this.visitas.update(arr => arr.map(x => x.id_visita === updated.id_visita ? updated : x));
        this.agendaSavedAtCount.set(this.agendaChangeCount());
        this.toast('success', 'Agenda guardada y generada correctamente');
        this.guardando.set(false);
      },
      error: (e) => {
        this.toast('error', e?.error?.detail || 'Error al generar agenda');
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

  descargarZip() {
    if (this.descargandoZip()) return;
    const v = this.seleccionada()!;
    const now = new Date();
    const anio = now.getMonth() + 1 >= 9 ? now.getFullYear() + 1 : now.getFullYear();
    this.descargandoZip.set(true);
    this.portalSvc.zipFielInterno(v.id_visita, anio).subscribe({
      next: (blob) => {
        this.saveBlob(blob, `visita_circuito_${v.id_visita}_ano${anio}.zip`);
        this.descargandoZip.set(false);
      },
      error: () => {
        this.descargandoZip.set(false);
        this.toast('error', 'Error al descargar el paquete');
      },
    });
  }

  crearEnlace() {
    this.generandoEnlace.set(true);
    this.svc.crearEnlaceTemporal(this.seleccionada()!.id_visita).subscribe({
      next: (t) => { this.enlace.set(t); this.generandoEnlace.set(false); },
      error: (e) => { this.generandoEnlace.set(false); this.toast('error', e?.error?.detail || 'Error al generar el enlace'); },
    });
  }

  copiarLink() {
    const l = this.enlace();
    if (!l) return;
    navigator.clipboard?.writeText(l.url_publica).then(() => {
      this.copiado.set(true);
      this.toast('success', 'Enlace copiado al portapapeles');
      setTimeout(() => this.copiado.set(false), 1800);
    });
  }

  enviarCorreo() {
    if (!this.correoDestino) return;
    this.enviando.set(true);
    this.svc.enviarCorreo({
      id_visita: this.seleccionada()!.id_visita,
      correo_destino: this.correoDestino,
      enviar_zip: true,
      enviar_enlace: true,
    }).subscribe({
      next: () => {
        this.toast('success', 'Correo enviado correctamente');
        this.enviando.set(false);
      },
      error: (e) => {
        this.toast('error', e?.error?.detail || 'Error al enviar correo');
        this.enviando.set(false);
      },
    });
  }

  confirmarEliminarVisita() {
    const v = this.seleccionada();
    if (!v) return;
    this.confirmandoBorrarVisita.set(false);
    this.svc.remove(v.id_visita).subscribe({
      next: () => {
        this.visitas.update(arr => arr.filter(x => x.id_visita !== v.id_visita));
        this.seleccionada.set(null);
        this.toast('success', 'Visita eliminada');
      },
      error: (e) => this.toast('error', e?.error?.detail || 'Error al eliminar visita'),
    });
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
