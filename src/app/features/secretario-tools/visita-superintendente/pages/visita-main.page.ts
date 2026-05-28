import { Component, inject, signal, computed, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VisitaService } from '../../services/visita.service';
import { AgendaItem, Visita } from '../../models/visita.model';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';

type Tab = 'docs' | 'agenda' | 'entrega';
type ToastType = 'success' | 'error' | 'info';
interface Toast { id: number; type: ToastType; msg: string; }

@Component({
  standalone: true,
  selector: 'app-visita-main',
  imports: [CommonModule, FormsModule],
  template: `
  <div class="h-full flex flex-col overflow-hidden">

    <!-- ───────── HERO + BODY WRAPPER ───────── -->
    <div class="flex-1 flex flex-col m-1 rounded-2xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-800 min-h-0">

    <!-- ───────── HERO ───────── -->
    <header class="bg-violet-700 text-white shrink-0">
      <div class="px-4 sm:px-6 lg:px-10 py-5">
        <div class="flex items-start justify-between gap-4 mb-4">
          <div>
            <div class="flex items-center gap-1.5 text-violet-200 text-[0.6rem] uppercase tracking-[0.18em] font-semibold mb-1.5">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7l9-4 9 4-9 4-9-4zm0 6l9 4 9-4M3 17l9 4 9-4"/></svg>
              <span>Módulo Secretario</span>
            </div>
            <h1 class="text-2xl lg:text-3xl font-bold tracking-tight leading-tight">Visita del Superintendente</h1>
            <p class="text-violet-200/80 text-xs max-w-sm mt-1">
              Organiza la documentación, agenda y entrega al superintendente de circuito.
            </p>
          </div>
          <button (click)="abrirFormulario()" class="btn-hero group shrink-0 mt-1">
            <svg class="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
            <span>Nueva visita</span>
          </button>
        </div>

        <!-- Stats strip — sin glassmorphism -->
        <div class="grid grid-cols-3 gap-2.5">
          <div class="stat-card">
            <span class="stat-num">{{ visitas().length }}</span>
            <span class="stat-label">Total</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">{{ proximasCount() }}</span>
            <span class="stat-label">Próximas</span>
          </div>
          <div class="stat-card">
            <span class="stat-num">{{ conAgendaCount() }}</span>
            <span class="stat-label">Con agenda</span>
          </div>
        </div>
      </div>
    </header>

    <!-- ───────── BODY ───────── -->
    <div class="flex-1 bg-white dark:bg-slate-900 px-4 sm:px-6 lg:px-10 pt-4 pb-4 min-h-0 overflow-y-auto grid grid-cols-1 xl:grid-cols-[minmax(320px,380px)_1fr] gap-4 content-start">

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
            <div class="p-5 space-y-3">
              <label class="form-label">
                <span>Superintendente</span>
                <input class="field" [(ngModel)]="form.nombre_superintendente" placeholder="Hno. Juan Pérez" />
              </label>
              <label class="form-label">
                <span>Correo electrónico</span>
                <input type="email" class="field" [(ngModel)]="form.correo_superintendente" placeholder="correo@ejemplo.com" />
              </label>
              <div class="grid grid-cols-2 gap-3">
                <label class="form-label">
                  <span>Fecha inicio <em class="text-rose-500 not-italic">*</em></span>
                  <input type="date" class="field" [(ngModel)]="form.fecha_inicio" />
                </label>
                <label class="form-label">
                  <span>Fecha fin</span>
                  <input type="date" class="field" [(ngModel)]="form.fecha_fin" />
                </label>
              </div>
              <label class="form-label">
                <span>Semestre</span>
                <input class="field" [(ngModel)]="form.semestre" placeholder="2026-I" />
              </label>
              <label class="form-label">
                <span>Notas</span>
                <textarea rows="2" class="field" [(ngModel)]="form.notas" placeholder="Observaciones internas"></textarea>
              </label>
              <div class="flex justify-end gap-2 pt-2">
                <button (click)="cancelarForm()" class="btn-ghost">Cancelar</button>
                <button (click)="crearVisita()" [disabled]="!form.fecha_inicio || guardando()" class="btn-primary">
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
                    <p class="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate">
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
                    <span class="chip-state" [class.chip-upcoming]="isUpcoming(v)" [class.chip-done]="!isUpcoming(v)">
                      {{ isUpcoming(v) ? 'Próxima' : 'Realizada' }}
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
              <button (click)="abrirFormulario()" class="btn-primary text-xs">
                + Crear primera visita
              </button>
            </div>
          }
        </div>
      </aside>

      <!-- ────────── COLUMNA DERECHA: DETALLE ────────── -->
      <main class="min-w-0 xl:!block" [class.hidden]="seleccionada() === null">

        <!-- Botón volver — sticky en móvil/tablet -->
        <div class="xl:hidden sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm -mx-4 px-4 py-2 border-b border-slate-100 dark:border-slate-800 mb-3">
          <button (click)="seleccionada.set(null)" class="inline-flex items-center gap-2 px-3 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Volver a la lista
          </button>
        </div>

        @if (seleccionada(); as v) {
          <article class="card-anim bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">

            <!-- Header del detalle -->
            <header class="px-5 lg:px-7 py-5 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="flex items-center gap-2 text-[0.65rem] font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-violet-600 dark:bg-violet-400"></span>
                  <span>Visita #{{ v.id_visita }}</span>
                </div>
                <h2 class="text-xl lg:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate">
                  {{ v.nombre_superintendente || 'Sin nombre asignado' }}
                </h2>
                <p class="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {{ v.fecha_inicio }}@if (v.fecha_fin) { <span> — {{ v.fecha_fin }}</span> }
                  @if (v.semestre) { <span class="mx-1.5 text-slate-300">·</span> Semestre {{ v.semestre }} }
                </p>
              </div>
              <button (click)="seleccionada.set(null)" class="icon-btn" aria-label="Cerrar detalle">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M6 18L18 6"/></svg>
              </button>
            </header>

            <!-- Tabs -->
            <nav class="tabs-bar" role="tablist">
              @for (t of tabs; track t.id) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="activeTab() === t.id"
                  (click)="activeTab.set(t.id)"
                  class="tab-btn"
                  [class.is-active]="activeTab() === t.id">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" [innerHTML]="t.icon"></svg>
                  <span>{{ t.label }}</span>
                  @if (t.id === 'docs' && archivos().length) {
                    <span class="tab-count">{{ archivos().length }}</span>
                  }
                  @if (t.id === 'agenda' && agendaDirty()) {
                    <span class="tab-dirty" title="Cambios sin guardar"></span>
                  }
                </button>
              }
            </nav>

            <!-- Tab: Documentos -->
            @if (activeTab() === 'docs') {
              <section class="tab-panel p-5 lg:p-7 space-y-4">
                <label
                  class="dropzone group"
                  [class.is-dragging]="isDragging()"
                  (dragover)="onDragOver($event)"
                  (dragleave)="isDragging.set(false)"
                  (drop)="onDrop($event)">
                  <input #fi type="file" class="hidden" (change)="onFile(fi)" />
                  <div class="text-center pointer-events-none">
                    <div class="mx-auto w-12 h-12 rounded-full bg-violet-50 dark:bg-violet-900/30 text-violet-600 flex items-center justify-center mb-2 transition-transform duration-200 group-hover:-translate-y-0.5">
                      <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.9 5 5 0 019.9-1A5.5 5.5 0 0118.5 16H17m-5-4v9m0 0l-3-3m3 3l3-3"/></svg>
                    </div>
                    <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Arrastra archivos o toca para subir</p>
                    <p class="text-xs text-slate-500 mt-1">PDF, Excel, Word, imágenes — todos los documentos de la visita</p>
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
                <div class="hidden md:grid grid-cols-[1.5fr_0.8fr_0.8fr_1.5fr_1fr_auto] gap-2 px-2 text-[0.65rem] uppercase tracking-wider font-bold text-slate-400">
                  <span>Día</span><span>Inicio</span><span>Fin</span><span>Actividad</span><span>Responsable</span><span></span>
                </div>
                <div class="space-y-2">
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
                        <label class="form-label"><span>Día</span><input class="field" placeholder="Martes 12/05" [(ngModel)]="it.dia" (ngModelChange)="markAgendaDirty()" /></label>
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
                        <label class="form-label"><span>Actividad</span><input class="field" placeholder="Actividad" [(ngModel)]="it.actividad" (ngModelChange)="markAgendaDirty()" /></label>
                        <label class="form-label"><span>Responsable</span><input class="field" placeholder="Responsable" [(ngModel)]="it.responsable" (ngModelChange)="markAgendaDirty()" /></label>
                      </div>

                      <!-- Desktop: fila en grid -->
                      <div class="hidden md:grid grid-cols-[1.5fr_0.8fr_0.8fr_1.5fr_1fr_auto] gap-2">
                        <input class="field" placeholder="Martes 12/05" [(ngModel)]="it.dia" (ngModelChange)="markAgendaDirty()" />
                        <input type="time" class="field" [(ngModel)]="it.hora_inicio" (ngModelChange)="markAgendaDirty()" />
                        <input type="time" class="field" [(ngModel)]="it.hora_fin" (ngModelChange)="markAgendaDirty()" />
                        <input class="field" placeholder="Actividad" [(ngModel)]="it.actividad" (ngModelChange)="markAgendaDirty()" />
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

            <!-- Tab: Entrega -->
            @if (activeTab() === 'entrega') {
              <section class="tab-panel p-5 lg:p-7">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

                  <!-- Card: Paquete -->
                  <div class="delivery-card">
                    <div class="delivery-icon bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v3m0 4v3m0 4v4m-6-7l6-3 6 3M5 21h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z"/></svg>
                    </div>
                    <h4 class="delivery-title">Paquete completo</h4>
                    <p class="delivery-desc">Descarga todos los documentos y la agenda en un archivo comprimido.</p>
                    <button (click)="descargarZip()" class="btn-secondary w-full justify-center">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/></svg>
                      Descargar
                    </button>
                  </div>

                  <!-- Card: Link temporal -->
                  <div class="delivery-card">
                    <div class="delivery-icon bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                    </div>
                    <h4 class="delivery-title">Enlace web <span class="text-[0.6rem] font-medium text-slate-400">(expira en 7 días)</span></h4>
                    <p class="delivery-desc">Comparte un enlace con expiración automática.</p>
                    @if (!enlace()) {
                      <button (click)="crearEnlace()" class="btn-secondary w-full justify-center">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
                        Generar enlace
                      </button>
                    } @else {
                      <div class="link-result">
                        <a [href]="enlace()!.url_publica" target="_blank" rel="noopener" class="link-url">
                          {{ enlace()!.url_publica }}
                        </a>
                        <p class="text-[0.65rem] text-slate-400 mt-1.5">Expira el {{ enlace()!.fecha_expiracion | date:'short' }}</p>
                        <button (click)="copiarLink()" class="btn-ghost text-xs mt-2 w-full justify-center">
                          @if (copiado()) { ✓ Copiado } @else { Copiar enlace }
                        </button>
                      </div>
                    }
                  </div>

                  <!-- Card: Correo -->
                  <div class="delivery-card">
                    <div class="delivery-icon bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    </div>
                    <h4 class="delivery-title">Envío por correo</h4>
                    <p class="delivery-desc">Envía el paquete al correo del superintendente.</p>
                    <label class="form-label">
                      <span>Correo destinatario</span>
                      <input type="email" [(ngModel)]="correoDestino" placeholder="correo@ejemplo.com" class="field" />
                    </label>
                    <button (click)="enviarCorreo()" [disabled]="!correoDestino || enviando()" class="btn-primary w-full justify-center">
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
                <div class="flex justify-end">
                  <button (click)="confirmandoBorrarVisita.set(true)" class="btn-danger-ghost text-xs">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22"/></svg>
                    <span class="font-semibold">Eliminar visita</span>
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
    :host { display: block; height: 100%; }

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

    .form-label { display: block; font-size: 0.75rem; }
    .form-label > span:first-child { display: block; color: #475569; margin-bottom: 0.25rem; font-weight: 500; font-size: 0.8125rem; }
    :host-context(.dark) .form-label > span:first-child { color: #cbd5e1; }

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
      background: rgba(255,255,255,0.16); color: #fff;
      border: 1px solid rgba(255,255,255,0.24); padding: 0.625rem 1.125rem; font-weight: 600;
      box-shadow: 0 2px 12px rgba(0,0,0,0.14);
    }
    .btn-danger-ghost { color: #f43f5e; padding: 0.375rem 0.625rem; font-size: 0.75rem; }

    :host-context(.dark) .btn-secondary { background: var(--bg-dark); border-color: var(--border-dark); color: #cbd5e1; }
    :host-context(.dark) .btn-ghost { color: #94a3b8; }

    @media (max-width: 767px) {
      .btn-danger-ghost { min-height: 2.75rem; min-width: 2.75rem; justify-content: center; }
    }

    @media (hover: hover) and (pointer: fine) {
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

    /* ───── Hero stats (sin glassmorphism) ───── */
    .stat-card {
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 0.875rem;
      padding: 0.625rem 0.75rem;
      display: flex; flex-direction: column; gap: 2px;
      transition: background 200ms var(--ease-out);
    }
    @media (hover: hover) { .stat-card:hover { background: rgba(255,255,255,0.20); } }
    .stat-num {
      font-size: 1.25rem; font-weight: 800; color: #fff;
      line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
    }
    @media (min-width: 640px) { .stat-num { font-size: 1.5rem; } }
    .stat-label {
      font-size: 0.6rem; color: rgba(255,255,255,0.65);
      font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em;
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
    .chip-done { background: #f1f5f9; color: #64748b; }
    :host-context(.dark) .chip-done { background: #334155; color: #94a3b8; }

    /* ───── Tabs ───── */
    .tabs-bar {
      display: flex; gap: 0;
      padding: 0 1.25rem;
      border-bottom: 1px solid #f1f5f9;
      overflow-x: auto; scrollbar-width: none;
    }
    .tabs-bar::-webkit-scrollbar { display: none; }
    :host-context(.dark) .tabs-bar { border-bottom-color: #1e293b; }
    .tab-btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.875rem 1rem; min-height: 2.75rem;
      font-size: 0.8125rem; font-weight: 600; color: #64748b;
      border-bottom: 2px solid transparent;
      transition: color 160ms var(--ease-out), border-color 160ms var(--ease-out);
      white-space: nowrap; flex-shrink: 0;
    }
    .tab-btn:active { transform: scale(0.97); }
    :host-context(.dark) .tab-btn { color: #94a3b8; }
    .tab-btn.is-active { color: var(--brand-purple); border-bottom-color: var(--brand-purple); }
    :host-context(.dark) .tab-btn.is-active { color: #a78bfa; border-bottom-color: #a78bfa; }
    .tab-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 1.25rem; height: 1.25rem; padding: 0 0.375rem;
      font-size: 0.65rem; font-weight: 700; border-radius: 9999px;
      background: rgba(109, 40, 217, 0.1); color: var(--brand-purple);
    }
    .tab-btn.is-active .tab-count { background: var(--brand-purple); color: #fff; }
    .tab-dirty {
      width: 0.4375rem; height: 0.4375rem; border-radius: 9999px;
      background: #f59e0b; flex-shrink: 0;
    }

    /* ───── Tab panel transition ───── */
    .tab-panel { animation: panelIn 240ms var(--ease-out) both; }
    @keyframes panelIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: none; } }

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
    }

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
    .delivery-card {
      background: var(--bg-light);
      border: 1px solid var(--border-light);
      border-radius: 1rem;
      padding: 1.25rem;
      display: flex; flex-direction: column; gap: 0.625rem;
      transition: border-color 200ms var(--ease-out), box-shadow 200ms var(--ease-out), transform 200ms var(--ease-out);
    }
    :host-context(.dark) .delivery-card { background: var(--bg-dark); border-color: var(--border-dark); }
    @media (hover: hover) {
      .delivery-card:hover { border-color: #c4b5fd; box-shadow: 0 8px 24px -8px rgba(109,40,217,0.18); transform: translateY(-2px); }
      :host-context(.dark) .delivery-card:hover { border-color: var(--brand-purple); }
    }
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

    /* ───── Reduced motion ───── */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
      }
      .placeholder-icon { animation: none; }
    }
  `]
})
export class VisitaMainPage implements OnInit {
  private svc = inject(VisitaService);
  private ctx = inject(CongregacionContextService);

  @ViewChild('formContainer') formContainerRef?: ElementRef<HTMLElement>;

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
  activeTab = signal<Tab>('docs');
  notifications = signal<Toast[]>([]);
  confirmandoBorrarVisita = signal(false);
  pendingDeleteFile = signal<string | null>(null);
  agendaChangeCount = signal(0);
  agendaSavedAtCount = signal(0);

  agendaDirty = computed(() => this.agendaChangeCount() !== this.agendaSavedAtCount());

  private _nId = 0;

  tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'docs', label: 'Documentos', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>' },
    { id: 'agenda', label: 'Agenda', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>' },
    { id: 'entrega', label: 'Entrega', icon: '<path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>' },
  ];

  proximasCount = computed(() => {
    const today = new Date().toISOString().slice(0, 10);
    return this.visitas().filter(v => v.fecha_inicio >= today).length;
  });
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
    this.svc.list().subscribe({
      next: (v) => this.visitas.set(v),
      error: () => this.toast('error', 'No se pudieron cargar las visitas'),
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
    this.activeTab.set('docs');
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
    return v.fecha_inicio >= new Date().toISOString().slice(0, 10);
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
    const file = e.dataTransfer?.files?.[0];
    if (file && this.seleccionada()) this.uploadFile(file);
  }

  onFile(input: HTMLInputElement) {
    const f = input.files?.[0];
    if (!f) return;
    this.uploadFile(f);
    input.value = '';
  }

  private uploadFile(file: File) {
    const v = this.seleccionada();
    if (!v) return;
    this.svc.subirArchivo(v.id_visita, file).subscribe({
      next: () => this.svc.listarArchivos(v.id_visita).subscribe({
        next: (a) => this.archivos.set(a),
        error: () => this.toast('error', 'Error al recargar la lista de archivos'),
      }),
      error: (e) => this.toast('error', e?.error?.detail || 'Error al subir archivo'),
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
    const v = this.seleccionada()!;
    this.svc.descargarZip(v.id_visita).subscribe({
      next: (blob) => this.saveBlob(blob, `visita_circuito_${v.id_visita}.zip`),
      error: () => this.toast('error', 'Error al descargar el paquete'),
    });
  }

  crearEnlace() {
    this.svc.crearEnlaceTemporal(this.seleccionada()!.id_visita).subscribe({
      next: (t) => this.enlace.set(t),
      error: (e) => this.toast('error', e?.error?.detail || 'Error al generar el enlace'),
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
