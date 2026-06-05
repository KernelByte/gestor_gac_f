import { Component, Input, Output, EventEmitter, inject, signal, computed, OnInit, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActaService } from '../../services/acta.service';
import { Tarea } from '../../models/acta.model';
import { UsuariosService } from '../../../basicas/usuarios/services/usuarios.service';
import { Usuario } from '../../../basicas/usuarios/models/usuario.model';
import { AuthStore } from '../../../../core/auth/auth.store';

@Component({
  standalone: true,
  selector: 'app-tarea-detail-panel',
  imports: [CommonModule, FormsModule],
  template: `
  <div class="panel-root" [class.modo-drawer]="modoDrawer" [class.modo-editando]="editando()">

    @if (modoDrawer) {
      <header class="panel-header">
        <div class="panel-header-left">
          <div class="panel-header-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
          <span class="panel-header-title">Detalle de tarea</span>
        </div>
        <button (click)="cerrar.emit()" class="btn-close" type="button" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </header>
    }

    @if (loading()) {
      <div class="panel-body skeleton-body">
        <div class="skel-chips">
          <div class="skel skel-chip"></div>
          <div class="skel skel-chip skel-chip-sm"></div>
          <div class="skel skel-chip skel-chip-xs"></div>
        </div>
        <div class="skel skel-title"></div>
        <div class="skel skel-title skel-title-sm"></div>
        <div class="skel skel-line"></div>
        <div class="skel skel-line skel-line-sm"></div>
        <div class="skel-props-grid">
          <div class="skel skel-prop"></div>
          <div class="skel skel-prop"></div>
          <div class="skel skel-prop"></div>
          <div class="skel skel-prop"></div>
        </div>
      </div>
    } @else if (error()) {
      <div class="state-error">
        <div class="error-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="22" height="22">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>
        <p class="error-state-title">No se pudo cargar la tarea</p>
        <p class="error-state-sub">{{ error() }}</p>
        <button (click)="cerrar.emit()" class="btn-ghost" type="button">Cerrar</button>
      </div>
    } @else if (tarea(); as t) {

      <div class="panel-body">

        @if (errorMsg()) {
          <div class="inline-error" role="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            {{ errorMsg() }}
          </div>
        }

        <!-- ── Chips ── -->
        <div class="chips-row">
          <span class="chip chip-estado" [attr.data-estado]="t.estado">
            <span class="chip-dot"></span>
            {{ estadoLabel(t.estado) }}
          </span>
          <span class="chip chip-prio" [attr.data-prio]="t.prioridad">
            {{ prioLabel(t.prioridad) }}
          </span>
          @if (t.origen_tipo === 'acta_reunion' && t.origen_id) {
            <button class="chip chip-acta" type="button" (click)="irAActa(t.origen_id!)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Acta #{{ t.origen_id }}
            </button>
          }
        </div>

        <!-- ── Título ── -->
        <div class="title-block">
          @if (editando()) {
            <input
              class="title-input"
              [(ngModel)]="form.titulo"
              placeholder="Título de la tarea"
              maxlength="255"
              aria-label="Título de la tarea"
            />
          } @else {
            <h2 class="task-title" (click)="iniciarEdicion()" title="Clic para editar">{{ t.titulo }}</h2>
          }
        </div>

        <!-- ── Descripción ── -->
        <div class="content-section">
          <span class="section-label">Descripción</span>
          @if (editando()) {
            <textarea
              class="field-input field-textarea"
              [(ngModel)]="form.descripcion"
              rows="3"
              placeholder="Sin descripción…"
              aria-label="Descripción"
            ></textarea>
          } @else {
            <p class="field-text" [class.text-muted-val]="!t.descripcion" (click)="iniciarEdicion()">
              {{ t.descripcion || 'Sin descripción' }}
            </p>
          }
        </div>

        <!-- ── Propiedades ── -->
        <div class="props-grid">

          <!-- Estado -->
          <div class="prop-card" (click)="!editando() && iniciarEdicion()">
            <div class="prop-icon" [attr.data-tipo]="'estado'" [attr.data-val]="t.estado">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                @if (t.estado === 'completada') {
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                } @else if (t.estado === 'en_progreso') {
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                } @else if (t.estado === 'cancelada') {
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                } @else {
                  <circle cx="12" cy="12" r="9"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4"/>
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 16h.01"/>
                }
              </svg>
            </div>
            <div class="prop-body">
              <span class="prop-label">Estado</span>
              @if (editando()) {
                <div class="custom-select" (click)="$event.stopPropagation()">
                  <button type="button" class="csd-btn" (click)="estadoDropdownOpen.set(!estadoDropdownOpen())">
                    <span class="csd-dot" [attr.data-estado]="form.estado"></span>
                    <span class="csd-label">{{ estadoLabel(form.estado!) }}</span>
                    <svg class="csd-chevron" [class.open]="estadoDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  @if (estadoDropdownOpen()) {
                    <div class="csd-menu">
                      <button type="button" class="csd-option" [class.is-selected]="form.estado==='pendiente'" (click)="form.estado='pendiente'; estadoDropdownOpen.set(false)">
                        <span class="csd-dot" data-estado="pendiente"></span>Pendiente
                      </button>
                      <button type="button" class="csd-option" [class.is-selected]="form.estado==='en_progreso'" (click)="form.estado='en_progreso'; estadoDropdownOpen.set(false)">
                        <span class="csd-dot" data-estado="en_progreso"></span>En progreso
                      </button>
                      <button type="button" class="csd-option" [class.is-selected]="form.estado==='completada'" (click)="form.estado='completada'; estadoDropdownOpen.set(false)">
                        <span class="csd-dot" data-estado="completada"></span>Completada
                      </button>
                      <button type="button" class="csd-option" [class.is-selected]="form.estado==='cancelada'" (click)="form.estado='cancelada'; estadoDropdownOpen.set(false)">
                        <span class="csd-dot" data-estado="cancelada"></span>Cancelada
                      </button>
                    </div>
                  }
                </div>
              } @else {
                <span class="prop-value">{{ estadoLabel(t.estado) }}</span>
              }
            </div>
          </div>

          <!-- Prioridad -->
          <div class="prop-card" (click)="!editando() && iniciarEdicion()">
            <div class="prop-icon" [attr.data-tipo]="'prio'" [attr.data-val]="t.prioridad">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div class="prop-body">
              <span class="prop-label">Prioridad</span>
              @if (editando()) {
                <div class="custom-select" (click)="$event.stopPropagation()">
                  <button type="button" class="csd-btn" (click)="prioDropdownOpen.set(!prioDropdownOpen())">
                    <span class="csd-dot" [attr.data-prio]="form.prioridad"></span>
                    <span class="csd-label">{{ prioLabel(form.prioridad!) }}</span>
                    <svg class="csd-chevron" [class.open]="prioDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                  @if (prioDropdownOpen()) {
                    <div class="csd-menu">
                      <button type="button" class="csd-option" [class.is-selected]="form.prioridad==='baja'" (click)="form.prioridad='baja'; prioDropdownOpen.set(false)">
                        <span class="csd-dot" data-prio="baja"></span>Baja
                      </button>
                      <button type="button" class="csd-option" [class.is-selected]="form.prioridad==='media'" (click)="form.prioridad='media'; prioDropdownOpen.set(false)">
                        <span class="csd-dot" data-prio="media"></span>Media
                      </button>
                      <button type="button" class="csd-option" [class.is-selected]="form.prioridad==='alta'" (click)="form.prioridad='alta'; prioDropdownOpen.set(false)">
                        <span class="csd-dot" data-prio="alta"></span>Alta
                      </button>
                    </div>
                  }
                </div>
              } @else {
                <span class="prop-value">{{ prioLabel(t.prioridad) }}</span>
              }
            </div>
          </div>

          <!-- Fecha límite -->
          <div class="prop-card" (click)="!editando() && iniciarEdicion()">
            <div class="prop-icon prop-icon-neutral">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
              </svg>
            </div>
            <div class="prop-body">
              <span class="prop-label">Fecha límite</span>
              @if (editando()) {
                <div class="fecha-picker" (click)="$event.stopPropagation()">
                  <button type="button" class="fecha-trigger" (click)="abrirCalendario()">
                    <span class="fecha-value" [class.empty]="!form.fecha_limite">
                      {{ form.fecha_limite ? formatDate(form.fecha_limite) : 'Sin fecha límite' }}
                    </span>
                    @if (form.fecha_limite) {
                      <span class="fecha-clear" (click)="$event.stopPropagation(); form.fecha_limite = ''" role="button" tabindex="0" title="Quitar fecha">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                      </span>
                    } @else {
                      <svg class="fecha-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    }
                  </button>
                  @if (fechaCalendarOpen()) {
                    <div class="cal-panel" role="dialog" aria-label="Calendario">
                      <div class="cal-header">
                        <button type="button" class="cal-nav" (click)="prevMes()" title="Mes anterior">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                        </button>
                        <span class="cal-title">{{ calMeses[calMes()] }} {{ calYear() }}</span>
                        <button type="button" class="cal-nav" (click)="nextMes()" title="Mes siguiente">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                        </button>
                      </div>
                      <div class="cal-grid">
                        @for (dow of calDow; track dow) {
                          <span class="cal-dow">{{ dow }}</span>
                        }
                        @for (d of diasCalendario(); track d.key) {
                          <button type="button" class="cal-day"
                            [class.fuera-mes]="!d.esMesActual"
                            [class.es-hoy]="d.esHoy"
                            [class.es-sel]="esDiaSeleccionado(d)"
                            (click)="seleccionarDia(d)">
                            {{ d.day }}
                          </button>
                        }
                      </div>
                      <div class="cal-footer">
                        <button type="button" class="cal-btn-hoy" (click)="seleccionarHoy()">Hoy</button>
                        <button type="button" class="cal-btn-quitar" (click)="form.fecha_limite=''; fechaCalendarOpen.set(false)">Sin fecha</button>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <span class="prop-value" [class.prop-value-empty]="!t.fecha_limite">{{ t.fecha_limite ? formatDate(t.fecha_limite) : '—' }}</span>
              }
            </div>
          </div>

          <!-- Asignado a -->
          @if (puedeAsignar()) {
            <div class="prop-card" (click)="!editando() && iniciarEdicion()">
              <div class="prop-icon prop-icon-neutral">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                </svg>
              </div>
              <div class="prop-body">
                <span class="prop-label">Asignado a</span>
                @if (editando()) {
                  <div class="user-picker" (click)="$event.stopPropagation()">
                    <!-- Trigger -->
                    <button type="button" class="user-trigger" (click)="usuarioDropdownOpen.set(!usuarioDropdownOpen())">
                      @if (form.asignado_a) {
                        <span class="uavatar" [style.background]="avatarColor(nombreUsuario(form.asignado_a))">{{ inicialNom(nombreUsuario(form.asignado_a)) }}</span>
                        <span class="user-trigger-name">{{ nombreUsuario(form.asignado_a) }}</span>
                      } @else {
                        <svg class="user-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        <span class="user-trigger-none">Sin asignar</span>
                      }
                      <svg class="csd-chevron" [class.open]="usuarioDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    <!-- Dropdown -->
                    @if (usuarioDropdownOpen()) {
                      <div class="user-menu">
                        <div class="user-search-row">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12" class="user-search-icon"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="M21 21l-4.35-4.35"/></svg>
                          <input #userSearch type="text" class="user-search-input" [ngModel]="usuarioBusqueda" (ngModelChange)="usuarioBusqueda=$event" placeholder="Buscar usuario..." autocomplete="off" aria-label="Buscar usuario" />
                          @if (usuarioBusqueda) {
                            <button type="button" class="user-search-clear" (click)="usuarioBusqueda=''">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                          }
                        </div>
                        <div class="user-list" role="listbox">
                          <button type="button" class="user-opt" role="option" [class.is-sel]="!form.asignado_a" (click)="seleccionarUsuario(null)">
                            <span class="uavatar uavatar-none">—</span>
                            <span class="user-opt-name">Sin asignar</span>
                            @if (!form.asignado_a) { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11" class="user-check"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> }
                          </button>
                          @for (u of usuariosFiltrados(); track u.id_usuario) {
                            <button type="button" class="user-opt" role="option" [class.is-sel]="form.asignado_a===u.id_usuario" (click)="seleccionarUsuario(u)">
                              <span class="uavatar" [style.background]="avatarColor(u.nombre)">{{ inicialNom(u.nombre) }}</span>
                              <span class="user-opt-name">{{ u.nombre }}</span>
                              @if (form.asignado_a===u.id_usuario) { <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11" class="user-check"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg> }
                            </button>
                          }
                          @if (usuariosFiltrados().length === 0) {
                            <div class="user-empty">Sin resultados para "{{ usuarioBusqueda }}"</div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                } @else {
                  <span class="prop-value" [class.prop-value-empty]="!tarea()?.asignado_a_nombre">
                    {{ tarea()?.asignado_a_nombre || '— Sin asignar —' }}
                  </span>
                }
              </div>
            </div>
          }

        </div>

        <!-- ── Meta ── -->
        <div class="meta-row">
          <span class="meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Creada {{ formatDate(t.creado_en) }}
          </span>
          @if (t.completado_en) {
            <span class="meta-item meta-done">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              Completada {{ formatDate(t.completado_en) }}
            </span>
          }
        </div>

      </div><!-- /panel-body -->

      <!-- ── Action bar ── -->
      <div class="action-bar">
        @if (confirmandoEliminar()) {
          <div class="delete-confirm" role="alertdialog" aria-label="Confirmar eliminación">
            <div class="delete-confirm-info">
              <div class="delete-warn-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
              </div>
              <div>
                <p class="delete-confirm-title">¿Eliminar esta tarea?</p>
                <p class="delete-confirm-sub">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div class="delete-confirm-actions">
              <button class="btn-ghost" type="button" [disabled]="eliminando()" (click)="confirmandoEliminar.set(false)">Cancelar</button>
              <button class="btn-danger-solid" type="button" [disabled]="eliminando()" (click)="confirmarEliminar()">
                @if (eliminando()) { <span class="spinner spinner-sm"></span> Eliminando… }
                @else { Eliminar }
              </button>
            </div>
          </div>
        } @else if (editando()) {
          <div class="action-row">
            <button (click)="cancelarEdicion()" class="btn-ghost" type="button">Cancelar</button>
            <button (click)="guardar()" [disabled]="guardando() || !form.titulo?.trim()" class="btn-primary" type="button">
              @if (guardando()) {
                <span class="spinner spinner-sm"></span> Guardando…
              } @else {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
                </svg>
                Guardar cambios
              }
            </button>
          </div>
        } @else {
          <div class="action-row">
            <button (click)="iniciarEdicion()" class="btn-edit" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Editar
            </button>
            <button (click)="confirmandoEliminar.set(true)" class="btn-danger" type="button">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                <polyline points="3 6 5 6 21 6"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M10 11v6M14 11v6"/>
              </svg>
              Eliminar
            </button>
          </div>
        }
      </div>

    }
  </div>
  `,
  styles: [`
    /* ── Tokens ── */
    :host {
      --surface:       #ffffff;
      --surface-alt:   #f8fafc;
      --bg:            #f1f5f9;
      --border:        #e2e8f0;
      --border-sub:    #f1f5f9;
      --text:          #0f172a;
      --text-2:        #475569;
      --text-3:        #94a3b8;
      --primary:       #7c3aed;
      --primary-bg:    #ede9fe;
      --primary-dim:   #6d28d9;
      --danger:        #dc2626;
      --danger-bg:     #fef2f2;
      --danger-dim:    #b91c1c;
      --success:       #059669;
      display: block;
      height: 100%;
    }
    :host-context(.dark) {
      --surface:       #0a1120;
      --surface-alt:   #111827;
      --bg:            #020618;
      --border:        #1e2d45;
      --border-sub:    #161f2e;
      --text:          #f1f5f9;
      --text-2:        #94a3b8;
      --text-3:        #475569;
      --primary-bg:    #2e1065;
      --danger-bg:     #450a0a;
    }

    /* ── Root ── */
    .panel-root {
      display: flex;
      flex-direction: column;
      background: var(--surface);
    }
    .modo-drawer {
      height: 100%;
    }
    .modo-drawer .panel-body {
      flex: 1;
      overflow-y: auto;
    }
    .modo-drawer .action-bar {
      position: sticky;
      bottom: 0;
    }

    /* ── Header ── */
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.875rem 1.25rem;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      background: var(--surface);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .panel-header-left {
      display: flex;
      align-items: center;
      gap: 0.625rem;
    }
    .panel-header-badge {
      width: 28px;
      height: 28px;
      background: var(--primary-bg);
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--primary);
      flex-shrink: 0;
    }
    .panel-header-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text);
      font-family: 'Urbanist', sans-serif;
    }
    .btn-close {
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-alt);
      border: 1px solid var(--border);
      border-radius: 7px;
      cursor: pointer;
      color: var(--text-2);
      transition: all 150ms;
      flex-shrink: 0;
    }
    .btn-close:hover { background: var(--bg); color: var(--text); border-color: var(--text-3); }

    /* ── Body ── */
    .panel-body {
      padding: 1.5rem 1.25rem 1rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* ── Error state ── */
    .state-error {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.75rem;
      padding: 3rem 1.5rem;
      text-align: center;
    }
    .error-icon-wrap {
      width: 48px; height: 48px;
      border-radius: 50%;
      background: var(--danger-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--danger);
    }
    .error-state-title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text);
      margin: 0;
    }
    .error-state-sub {
      font-size: 0.8125rem;
      color: var(--text-2);
      margin: 0;
    }

    /* ── Inline error toast ── */
    .inline-error {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--danger-bg);
      color: #991b1b;
      border-radius: 8px;
      padding: 0.625rem 0.875rem;
      font-size: 0.8125rem;
      animation: slideDown 180ms ease-out;
    }
    :host-context(.dark) .inline-error { color: #fca5a5; }

    /* ── Chips ── */
    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.6875rem;
      font-weight: 700;
      padding: 0.25rem 0.6rem;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      white-space: nowrap;
    }
    .chip-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    /* Estado chips */
    .chip-estado[data-estado="pendiente"]            { background: #fef3c7; color: #92400e; }
    .chip-estado[data-estado="pendiente"] .chip-dot  { background: #f59e0b; }
    .chip-estado[data-estado="en_progreso"]           { background: #dbeafe; color: #1e40af; }
    .chip-estado[data-estado="en_progreso"] .chip-dot { background: #3b82f6; }
    .chip-estado[data-estado="completada"]            { background: #d1fae5; color: #065f46; }
    .chip-estado[data-estado="completada"] .chip-dot  { background: #10b981; }
    .chip-estado[data-estado="cancelada"]             { background: #fee2e2; color: #991b1b; }
    .chip-estado[data-estado="cancelada"] .chip-dot   { background: #ef4444; }
    :host-context(.dark) .chip-estado[data-estado="pendiente"]   { background: #451a03; color: #fcd34d; }
    :host-context(.dark) .chip-estado[data-estado="en_progreso"] { background: #1e3a5f; color: #93c5fd; }
    :host-context(.dark) .chip-estado[data-estado="completada"]  { background: #064e3b; color: #6ee7b7; }
    :host-context(.dark) .chip-estado[data-estado="cancelada"]   { background: #450a0a; color: #fca5a5; }

    /* Prioridad chips */
    .chip-prio[data-prio="alta"]  { background: #fee2e2; color: #991b1b; }
    .chip-prio[data-prio="media"] { background: #fff7ed; color: #9a3412; }
    .chip-prio[data-prio="baja"]  { background: #f0fdf4; color: #166534; }
    :host-context(.dark) .chip-prio[data-prio="alta"]  { background: #450a0a; color: #fca5a5; }
    :host-context(.dark) .chip-prio[data-prio="media"] { background: #431407; color: #fdba74; }
    :host-context(.dark) .chip-prio[data-prio="baja"]  { background: #052e16; color: #86efac; }

    /* Acta chip */
    .chip-acta {
      background: var(--primary-bg);
      color: var(--primary);
      border: none;
      cursor: pointer;
      transition: background 150ms;
    }
    .chip-acta:hover { background: color-mix(in srgb, var(--primary) 18%, transparent); }

    /* ── Title ── */
    .title-block { margin-top: -0.125rem; }
    .task-title {
      font-size: 1.1875rem;
      font-weight: 700;
      color: var(--text);
      margin: 0;
      line-height: 1.45;
      cursor: text;
      font-family: 'Urbanist', sans-serif;
      word-break: break-word;
      padding: 0.25rem 0;
      border-radius: 6px;
      transition: color 150ms;
    }
    .task-title:hover { color: var(--primary); }
    .title-input {
      font-size: 1.0625rem;
      font-weight: 700;
      color: var(--text);
      background: var(--surface-alt);
      border: 1.5px solid var(--primary);
      border-radius: 8px;
      padding: 0.5rem 0.75rem;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      font-family: 'Urbanist', sans-serif;
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
      transition: box-shadow 150ms;
    }

    /* ── Content section ── */
    .content-section {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
    }
    .section-label {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-3);
    }
    .field-text {
      font-size: 0.875rem;
      color: var(--text-2);
      margin: 0;
      line-height: 1.65;
      cursor: text;
      white-space: pre-wrap;
      word-break: break-word;
      padding: 0.125rem 0;
    }
    .text-muted-val { color: var(--text-3); font-style: italic; }

    /* ── Properties grid ── */
    .props-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.625rem;
    }
    @media (max-width: 380px) {
      .props-grid { grid-template-columns: 1fr; }
    }

    .prop-card {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
      padding: 0.75rem;
      background: var(--surface-alt);
      border: 1px solid var(--border-sub);
      border-radius: 10px;
      cursor: pointer;
      transition: border-color 150ms, background 150ms;
    }
    .prop-card:hover { border-color: var(--border); background: var(--bg); }
    .modo-editando .prop-card { cursor: default; }
    .modo-editando .prop-card:hover { border-color: var(--border-sub); background: var(--surface-alt); }

    /* Prop icon */
    .prop-icon {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: var(--bg);
      color: var(--text-3);
    }
    .prop-icon-neutral { background: var(--bg); color: var(--text-3); }

    /* Estado icon color */
    .prop-icon[data-tipo="estado"][data-val="pendiente"]   { background: #fef3c7; color: #92400e; }
    .prop-icon[data-tipo="estado"][data-val="en_progreso"] { background: #dbeafe; color: #1d4ed8; }
    .prop-icon[data-tipo="estado"][data-val="completada"]  { background: #d1fae5; color: #059669; }
    .prop-icon[data-tipo="estado"][data-val="cancelada"]   { background: #fee2e2; color: #dc2626; }
    :host-context(.dark) .prop-icon[data-tipo="estado"][data-val="pendiente"]   { background: #451a03; color: #fcd34d; }
    :host-context(.dark) .prop-icon[data-tipo="estado"][data-val="en_progreso"] { background: #1e3a5f; color: #60a5fa; }
    :host-context(.dark) .prop-icon[data-tipo="estado"][data-val="completada"]  { background: #064e3b; color: #34d399; }
    :host-context(.dark) .prop-icon[data-tipo="estado"][data-val="cancelada"]   { background: #450a0a; color: #f87171; }

    /* Prioridad icon color */
    .prop-icon[data-tipo="prio"][data-val="alta"]  { background: #fee2e2; color: #dc2626; }
    .prop-icon[data-tipo="prio"][data-val="media"] { background: #fff7ed; color: #ea580c; }
    .prop-icon[data-tipo="prio"][data-val="baja"]  { background: #f0fdf4; color: #16a34a; }
    :host-context(.dark) .prop-icon[data-tipo="prio"][data-val="alta"]  { background: #450a0a; color: #f87171; }
    :host-context(.dark) .prop-icon[data-tipo="prio"][data-val="media"] { background: #431407; color: #fb923c; }
    :host-context(.dark) .prop-icon[data-tipo="prio"][data-val="baja"]  { background: #052e16; color: #4ade80; }

    .prop-body {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      min-width: 0;
      flex: 1;
    }
    .prop-label {
      font-size: 0.6875rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--text-3);
    }
    .prop-value {
      font-size: 0.875rem;
      color: var(--text);
      font-weight: 500;
      line-height: 1.4;
      word-break: break-word;
    }
    .prop-value-empty { color: var(--text-3); }

    /* ── Field inputs (edit mode) ── */
    .field-input {
      font-size: 0.8125rem;
      color: var(--text);
      background: var(--bg);
      border: 1.5px solid var(--border);
      border-radius: 7px;
      padding: 0.4375rem 0.625rem;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 150ms, box-shadow 150ms;
      font-family: inherit;
    }
    .field-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
    }
    .field-textarea {
      resize: vertical;
      min-height: 80px;
      line-height: 1.6;
    }
    /* ── Select wrappado (Asignado a) ── */
    .select-wrap { position: relative; width: 100%; }
    .field-select-clean {
      appearance: none;
      padding-right: 1.75rem;
      cursor: pointer;
    }
    .select-chevron {
      position: absolute;
      right: 0.625rem;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      opacity: 0.4;
      color: var(--text);
    }

    /* ── Custom select (Estado / Prioridad) ── */
    .custom-select { position: relative; width: 100%; }

    .csd-btn {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      width: 100%;
      background: var(--bg);
      border: 1.5px solid var(--border);
      border-radius: 7px;
      padding: 0.4375rem 0.5625rem;
      cursor: pointer;
      font-size: 0.8125rem;
      font-family: inherit;
      color: var(--text);
      text-align: left;
      transition: border-color 150ms, box-shadow 150ms;
    }
    .csd-btn:hover { border-color: color-mix(in srgb, var(--border) 70%, var(--primary)); }
    .csd-btn:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
    }
    .csd-label { flex: 1; font-weight: 500; }
    .csd-chevron { opacity: 0.4; transition: transform 150ms; flex-shrink: 0; }
    .csd-chevron.open { transform: rotate(180deg); opacity: 0.7; }

    .csd-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      min-width: 100%;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 0.3rem;
      z-index: 200;
      box-shadow: 0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06);
      animation: slideDown 140ms ease-out;
    }
    :host-context(.dark) .csd-menu {
      box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3);
    }

    .csd-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.4375rem 0.625rem;
      font-size: 0.8125rem;
      font-family: inherit;
      font-weight: 500;
      color: var(--text-2);
      background: transparent;
      border: none;
      border-radius: 7px;
      cursor: pointer;
      text-align: left;
      transition: background 100ms, color 100ms;
    }
    .csd-option:hover { background: var(--bg); color: var(--text); }
    .csd-option.is-selected {
      color: var(--text);
      background: color-mix(in srgb, var(--primary) 8%, var(--bg));
    }
    .csd-option.is-selected::after {
      content: '';
      display: block;
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--primary);
      margin-left: auto;
      flex-shrink: 0;
    }

    /* Dots */
    .csd-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
      display: inline-block;
    }
    .csd-dot[data-estado="pendiente"]   { background: #f59e0b; }
    .csd-dot[data-estado="en_progreso"] { background: #3b82f6; }
    .csd-dot[data-estado="completada"]  { background: #10b981; }
    .csd-dot[data-estado="cancelada"]   { background: #f43f5e; }
    .csd-dot[data-prio="baja"]  { background: #22c55e; }
    .csd-dot[data-prio="media"] { background: #f59e0b; }
    .csd-dot[data-prio="alta"]  { background: #ef4444; }

    /* ── User Picker (Asignado a) ── */
    .user-picker { position: relative; width: 100%; }

    .user-trigger {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      width: 100%;
      background: var(--bg);
      border: 1.5px solid var(--border);
      border-radius: 7px;
      padding: 0.375rem 0.5rem;
      cursor: pointer;
      font-size: 0.8125rem;
      font-family: inherit;
      color: var(--text);
      text-align: left;
      transition: border-color 150ms, box-shadow 150ms;
      min-height: 33px;
    }
    .user-trigger:hover { border-color: color-mix(in srgb, var(--border) 60%, var(--primary)); }
    .user-trigger:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent); }
    .user-trigger-name { flex: 1; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .user-trigger-none { flex: 1; color: var(--text-3); font-weight: 400; }
    .user-trigger-icon { color: var(--text-3); flex-shrink: 0; }

    /* Avatar circle */
    .uavatar {
      width: 20px; height: 20px;
      border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 0.5625rem;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
      letter-spacing: 0;
    }
    .uavatar-none {
      background: var(--border) !important;
      color: var(--text-3);
      font-size: 0.75rem;
      font-weight: 600;
    }

    /* Dropdown panel */
    .user-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 50%;
      transform: translateX(-50%);
      width: 260px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 11px;
      z-index: 300;
      box-shadow: 0 10px 28px rgba(0,0,0,0.11), 0 3px 8px rgba(0,0,0,0.07);
      animation: slideDown 140ms ease-out;
      overflow: hidden;
    }
    :host-context(.dark) .user-menu {
      box-shadow: 0 10px 36px rgba(0,0,0,0.45), 0 3px 8px rgba(0,0,0,0.3);
    }

    .user-search-row {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 0.625rem;
      border-bottom: 1px solid var(--border-sub);
    }
    .user-search-icon { color: var(--text-3); flex-shrink: 0; }
    .user-search-input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 0.8125rem;
      font-family: inherit;
      color: var(--text);
      outline: none;
      min-width: 0;
    }
    .user-search-input::placeholder { color: var(--text-3); }
    .user-search-clear {
      display: flex; align-items: center; justify-content: center;
      width: 16px; height: 16px;
      background: transparent; border: none;
      color: var(--text-3); cursor: pointer; border-radius: 3px;
      transition: color 100ms;
    }
    .user-search-clear:hover { color: var(--text); }

    .user-list {
      max-height: 180px;
      overflow-y: auto;
      padding: 0.25rem;
    }

    .user-opt {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0.4rem 0.5rem;
      font-size: 0.8125rem;
      font-family: inherit;
      font-weight: 500;
      color: var(--text-2);
      background: transparent;
      border: none;
      border-radius: 7px;
      cursor: pointer;
      text-align: left;
      transition: background 100ms, color 100ms;
    }
    .user-opt:hover { background: var(--bg); color: var(--text); }
    .user-opt.is-sel { color: var(--text); background: color-mix(in srgb, var(--primary) 8%, var(--bg)); }
    .user-opt-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .user-check { color: var(--primary); flex-shrink: 0; }

    .user-empty {
      padding: 0.625rem 0.625rem;
      font-size: 0.75rem;
      color: var(--text-3);
      text-align: center;
    }

    /* ── Fecha Picker ── */
    .fecha-picker { position: relative; width: 100%; }

    .fecha-trigger {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      width: 100%;
      background: var(--bg);
      border: 1.5px solid var(--border);
      border-radius: 7px;
      padding: 0.4375rem 0.5625rem;
      cursor: pointer;
      font-size: 0.8125rem;
      font-family: inherit;
      color: var(--text);
      text-align: left;
      transition: border-color 150ms, box-shadow 150ms;
    }
    .fecha-trigger:hover { border-color: color-mix(in srgb, var(--border) 60%, var(--primary)); }
    .fecha-trigger:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 15%, transparent);
    }
    .fecha-value { flex: 1; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fecha-value.empty { color: var(--text-3); font-weight: 400; }
    .fecha-caret { opacity: 0.4; flex-shrink: 0; }

    .fecha-clear {
      display: flex; align-items: center; justify-content: center;
      width: 16px; height: 16px;
      flex-shrink: 0;
      border-radius: 4px;
      cursor: pointer;
      color: var(--text-3);
      transition: color 100ms, background 100ms;
    }
    .fecha-clear:hover { color: var(--danger); background: var(--danger-bg); }

    /* Calendar panel */
    .cal-panel {
      position: absolute;
      top: calc(100% + 4px);
      left: 50%;
      transform: translateX(-50%);
      width: 268px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 13px;
      padding: 0.75rem;
      z-index: 300;
      box-shadow: 0 12px 32px rgba(0,0,0,0.12), 0 3px 10px rgba(0,0,0,0.07);
      animation: slideDown 140ms ease-out;
    }
    :host-context(.dark) .cal-panel {
      box-shadow: 0 12px 40px rgba(0,0,0,0.5), 0 3px 10px rgba(0,0,0,0.35);
    }

    .cal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 0.625rem;
    }
    .cal-nav {
      display: flex; align-items: center; justify-content: center;
      width: 26px; height: 26px;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 7px;
      cursor: pointer;
      color: var(--text-2);
      flex-shrink: 0;
      transition: background 100ms, color 100ms;
    }
    .cal-nav:hover { background: var(--bg); color: var(--text); }
    .cal-title {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text);
      text-transform: capitalize;
    }

    .cal-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
    }
    .cal-dow {
      display: flex; align-items: center; justify-content: center;
      height: 26px;
      font-size: 0.6563rem;
      font-weight: 700;
      color: var(--text-3);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .cal-day {
      display: flex; align-items: center; justify-content: center;
      height: 34px;
      font-size: 0.8rem;
      font-weight: 500;
      color: var(--text);
      background: transparent;
      border: none;
      border-radius: 7px;
      cursor: pointer;
      transition: background 100ms, color 100ms;
      line-height: 1;
    }
    .cal-day:hover:not(.es-sel):not(.fuera-mes) { background: var(--bg); }
    .cal-day.fuera-mes { color: var(--text-3); opacity: 0.38; cursor: default; }
    .cal-day.es-hoy:not(.es-sel) {
      color: var(--primary);
      font-weight: 700;
      background: color-mix(in srgb, var(--primary) 10%, transparent);
    }
    .cal-day.es-sel {
      background: var(--primary);
      color: #fff;
      font-weight: 700;
      box-shadow: 0 2px 6px color-mix(in srgb, var(--primary) 40%, transparent);
    }

    .cal-footer {
      display: flex;
      gap: 0.375rem;
      margin-top: 0.5rem;
      padding-top: 0.5rem;
      border-top: 1px solid var(--border-sub);
    }
    .cal-btn-hoy, .cal-btn-quitar {
      flex: 1;
      font-size: 0.75rem;
      font-family: inherit;
      font-weight: 600;
      border-radius: 7px;
      padding: 0.3125rem 0;
      cursor: pointer;
      transition: background 100ms, color 100ms;
      border: 1px solid var(--border);
    }
    .cal-btn-hoy { background: color-mix(in srgb, var(--primary) 10%, var(--bg)); color: var(--primary); border-color: color-mix(in srgb, var(--primary) 25%, var(--border)); }
    .cal-btn-hoy:hover { background: color-mix(in srgb, var(--primary) 18%, var(--bg)); }
    .cal-btn-quitar { background: transparent; color: var(--text-3); }
    .cal-btn-quitar:hover { background: var(--bg); color: var(--text-2); }

    /* ── Meta ── */
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.875rem;
      padding-top: 0.875rem;
      border-top: 1px solid var(--border-sub);
    }
    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.75rem;
      color: var(--text-3);
    }
    .meta-done { color: var(--success); }
    :host-context(.dark) .meta-done { color: #34d399; }

    /* ── Action bar ── */
    .action-bar {
      flex-shrink: 0;
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--border);
      background: var(--surface);
    }
    .action-row {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }

    /* ── Delete confirm ── */
    .delete-confirm {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      animation: slideDown 180ms ease-out;
    }
    .delete-confirm-info {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
    }
    .delete-warn-icon {
      width: 28px;
      height: 28px;
      border-radius: 7px;
      background: var(--danger-bg);
      color: var(--danger);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .delete-confirm-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text);
      margin: 0 0 0.125rem;
    }
    .delete-confirm-sub {
      font-size: 0.75rem;
      color: var(--text-2);
      margin: 0;
    }
    .delete-confirm-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }

    /* ── Buttons ── */
    .btn-primary {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: var(--primary); color: #fff;
      border: none; border-radius: 8px;
      padding: 0.5rem 1.125rem;
      font-size: 0.8125rem; font-weight: 600;
      cursor: pointer; font-family: inherit;
      transition: background 150ms, transform 100ms;
    }
    .btn-primary:hover:not(:disabled) { background: var(--primary-dim); }
    .btn-primary:active:not(:disabled) { transform: scale(0.98); }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-ghost {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: transparent; color: var(--text-2);
      border: 1px solid var(--border); border-radius: 8px;
      padding: 0.5rem 1rem;
      font-size: 0.8125rem; font-weight: 500;
      cursor: pointer; font-family: inherit;
      transition: all 150ms;
    }
    .btn-ghost:hover:not(:disabled) {
      color: var(--text);
      border-color: var(--text-3);
      background: var(--surface-alt);
    }
    .btn-ghost:disabled { opacity: 0.5; cursor: not-allowed; }

    .btn-edit {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: var(--primary-bg); color: var(--primary);
      border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
      border-radius: 8px; padding: 0.5rem 1.125rem;
      font-size: 0.8125rem; font-weight: 600;
      cursor: pointer; font-family: inherit;
      transition: background 150ms, transform 100ms;
    }
    .btn-edit:hover { background: color-mix(in srgb, var(--primary) 16%, transparent); }
    .btn-edit:active { transform: scale(0.98); }

    .btn-danger {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: transparent; color: var(--danger);
      border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
      border-radius: 8px; padding: 0.5rem 1.125rem;
      font-size: 0.8125rem; font-weight: 600;
      cursor: pointer; font-family: inherit;
      transition: background 150ms, border-color 150ms, transform 100ms;
    }
    .btn-danger:hover { background: var(--danger-bg); border-color: var(--danger); }
    .btn-danger:active { transform: scale(0.98); }

    .btn-danger-solid {
      display: inline-flex; align-items: center; gap: 0.4rem;
      background: var(--danger); color: #fff;
      border: none; border-radius: 8px; padding: 0.5rem 1rem;
      font-size: 0.8125rem; font-weight: 600;
      cursor: pointer; font-family: inherit;
      transition: background 150ms, transform 100ms;
    }
    .btn-danger-solid:hover:not(:disabled) { background: var(--danger-dim); }
    .btn-danger-solid:active:not(:disabled) { transform: scale(0.98); }
    .btn-danger-solid:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Skeleton ── */
    .skeleton-body {
      gap: 1rem;
    }
    .skel {
      background: var(--border);
      border-radius: 6px;
      animation: pulse 1.6s ease-in-out infinite;
    }
    .skel-chips    { display: flex; gap: 0.5rem; }
    .skel-chip     { height: 22px; width: 80px; border-radius: 6px; }
    .skel-chip-sm  { width: 60px; }
    .skel-chip-xs  { width: 70px; }
    .skel-title    { height: 26px; width: 92%; }
    .skel-title-sm { height: 26px; width: 62%; margin-top: -0.375rem; }
    .skel-line     { height: 13px; width: 100%; }
    .skel-line-sm  { height: 13px; width: 72%; }
    .skel-props-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.625rem; }
    .skel-prop     { height: 64px; border-radius: 10px; }

    /* ── Spinner ── */
    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }
    .spinner-sm { width: 11px; height: 11px; }

    /* ── Keyframes ── */
    @keyframes spin    { to { transform: rotate(360deg); } }
    @keyframes pulse   { 0%,100% { opacity:1 } 50% { opacity:.35 } }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: none; }
    }
  `],
})
export class TareaDetailPanelComponent implements OnInit, OnChanges {
  @Input() tareaId!: number;
  @Input() modoDrawer = false;
  @Output() cerrar = new EventEmitter<void>();
  @Output() tareaActualizada = new EventEmitter<Tarea>();
  @Output() tareaEliminada = new EventEmitter<number>();

  private router = inject(Router);
  private svc = inject(ActaService);
  private usuariosSvc = inject(UsuariosService);
  private store = inject(AuthStore);

  tarea = signal<Tarea | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  editando = signal(false);
  guardando = signal(false);
  eliminando = signal(false);
  confirmandoEliminar = signal(false);
  errorMsg = signal<string | null>(null);
  usuarios = signal<Usuario[]>([]);
  estadoDropdownOpen = signal(false);
  prioDropdownOpen = signal(false);
  fechaCalendarOpen = signal(false);
  usuarioDropdownOpen = signal(false);
  usuarioBusqueda = '';
  calMes = signal(new Date().getMonth());
  calYear = signal(new Date().getFullYear());

  readonly calDow = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  readonly calMeses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  diasCalendario = computed(() => {
    const mes = this.calMes();
    const year = this.calYear();
    const today = new Date();
    const days: { key: string; day: number; mes: number; year: number; esHoy: boolean; esMesActual: boolean }[] = [];
    const firstDow = (new Date(year, mes, 1).getDay() + 6) % 7; // Mon=0
    const prevLast = new Date(year, mes, 0).getDate();
    const daysInMonth = new Date(year, mes + 1, 0).getDate();

    for (let i = firstDow - 1; i >= 0; i--) {
      const d = prevLast - i; const m = mes === 0 ? 11 : mes - 1; const y = mes === 0 ? year - 1 : year;
      days.push({ key: `${y}-${m}-${d}`, day: d, mes: m, year: y, esHoy: false, esMesActual: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ key: `${year}-${mes}-${d}`, day: d, mes, year, esHoy: d === today.getDate() && mes === today.getMonth() && year === today.getFullYear(), esMesActual: true });
    }
    const rem = 42 - days.length;
    for (let d = 1; d <= rem; d++) {
      const m = mes === 11 ? 0 : mes + 1; const y = mes === 11 ? year + 1 : year;
      days.push({ key: `${y}-${m}-${d}-next`, day: d, mes: m, year: y, esHoy: false, esMesActual: false });
    }
    return days;
  });

  getFechaSeleccionada(): { year: number; mes: number; day: number } | null {
    const v = this.form.fecha_limite as string | undefined;
    if (!v) return null;
    const parts = v.split('-').map(Number);
    return { year: parts[0], mes: parts[1] - 1, day: parts[2] };
  }

  esDiaSeleccionado(d: { day: number; mes: number; year: number }): boolean {
    const sel = this.getFechaSeleccionada();
    return !!sel && sel.year === d.year && sel.mes === d.mes && sel.day === d.day;
  }

  abrirCalendario() {
    const sel = this.getFechaSeleccionada();
    if (sel) { this.calMes.set(sel.mes); this.calYear.set(sel.year); }
    else { const n = new Date(); this.calMes.set(n.getMonth()); this.calYear.set(n.getFullYear()); }
    this.fechaCalendarOpen.set(!this.fechaCalendarOpen());
  }

  seleccionarDia(d: { day: number; mes: number; year: number; esMesActual: boolean }) {
    if (!d.esMesActual) return;
    const m = String(d.mes + 1).padStart(2, '0');
    const day = String(d.day).padStart(2, '0');
    this.form.fecha_limite = `${d.year}-${m}-${day}`;
    this.fechaCalendarOpen.set(false);
  }

  seleccionarHoy() {
    const n = new Date();
    const m = String(n.getMonth() + 1).padStart(2, '0');
    const d = String(n.getDate()).padStart(2, '0');
    this.form.fecha_limite = `${n.getFullYear()}-${m}-${d}`;
    this.fechaCalendarOpen.set(false);
  }

  prevMes() {
    if (this.calMes() === 0) { this.calMes.set(11); this.calYear.update(y => y - 1); }
    else { this.calMes.update(m => m - 1); }
  }

  nextMes() {
    if (this.calMes() === 11) { this.calMes.set(0); this.calYear.update(y => y + 1); }
    else { this.calMes.update(m => m + 1); }
  }

  form: Partial<Tarea> = {};

  @HostListener('document:click')
  onDocClick() {
    this.estadoDropdownOpen.set(false);
    this.prioDropdownOpen.set(false);
    this.fechaCalendarOpen.set(false);
    this.usuarioDropdownOpen.set(false);
  }

  usuariosFiltrados(): Usuario[] {
    const q = this.usuarioBusqueda.toLowerCase().trim();
    return q ? this.usuarios().filter(u => u.nombre.toLowerCase().includes(q)) : this.usuarios();
  }

  nombreUsuario(id: number | null | undefined): string {
    if (!id) return '';
    return this.usuarios().find(u => u.id_usuario === id)?.nombre ?? '';
  }

  inicialNom(nombre: string): string {
    return nombre.trim().split(/\s+/).map(p => p[0] ?? '').slice(0, 2).join('').toUpperCase() || '?';
  }

  avatarColor(nombre: string): string {
    const palette = ['#6d28d9','#0891b2','#059669','#d97706','#0284c7','#7c3aed','#be185d','#b45309'];
    const hash = Array.from(nombre).reduce((a, c) => a + c.charCodeAt(0), 0);
    return palette[hash % palette.length];
  }

  seleccionarUsuario(u: Usuario | null) {
    this.form.asignado_a = u?.id_usuario ?? null;
    this.usuarioDropdownOpen.set(false);
    this.usuarioBusqueda = '';
  }
  private errorTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() { this.cargar(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tareaId'] && !changes['tareaId'].firstChange) this.cargar();
  }

  private cargar() {
    this.loading.set(true);
    this.error.set(null);
    this.editando.set(false);
    this.confirmandoEliminar.set(false);
    this.errorMsg.set(null);

    this.svc.getTarea(this.tareaId).subscribe({
      next: (t) => { this.tarea.set(t); this.loading.set(false); },
      error: () => { this.error.set('No se pudo cargar la tarea.'); this.loading.set(false); },
    });

    if (this.puedeAsignar()) {
      this.usuariosSvc.getUsuariosMiCongregacion().subscribe({
        next: (list) => this.usuarios.set(list),
        error: () => {},
      });
    }
  }

  puedeAsignar(): boolean {
    const rol = this.store.user()?.rol ?? '';
    return ['Administrador', 'Coordinador', 'Secretario'].includes(rol);
  }

  irAActa(actaId: number) {
    this.router.navigate(['/secretario-tools/actas-reunion', actaId]);
  }

  iniciarEdicion() {
    const t = this.tarea();
    if (!t) return;
    this.form = {
      titulo: t.titulo,
      descripcion: t.descripcion ?? '',
      estado: t.estado,
      prioridad: t.prioridad,
      fecha_limite: t.fecha_limite ?? '',
      asignado_a: t.asignado_a ?? null,
    };
    this.editando.set(true);
  }

  cancelarEdicion() {
    this.editando.set(false);
    this.estadoDropdownOpen.set(false);
    this.prioDropdownOpen.set(false);
    this.fechaCalendarOpen.set(false);
    this.usuarioDropdownOpen.set(false);
    this.usuarioBusqueda = '';
  }

  guardar() {
    const t = this.tarea();
    if (!t || !this.form.titulo?.trim()) return;
    this.guardando.set(true);
    const payload: Partial<Tarea> = {
      titulo: this.form.titulo!.trim(),
      descripcion: this.form.descripcion || null,
      estado: this.form.estado,
      prioridad: this.form.prioridad,
      fecha_limite: this.form.fecha_limite || null,
      asignado_a: this.form.asignado_a ?? null,
    };
    this.svc.updateTarea(t.id_tarea, payload).subscribe({
      next: (updated) => {
        this.tarea.set(updated);
        this.editando.set(false);
        this.guardando.set(false);
        this.tareaActualizada.emit(updated);
      },
      error: () => {
        this.mostrarError('Error al guardar los cambios. Intenta de nuevo.');
        this.guardando.set(false);
      },
    });
  }

  confirmarEliminar() {
    const t = this.tarea();
    if (!t) return;
    this.eliminando.set(true);
    this.svc.eliminarTarea(t.id_tarea).subscribe({
      next: () => {
        this.eliminando.set(false);
        this.tareaEliminada.emit(t.id_tarea);
        this.cerrar.emit();
      },
      error: () => {
        this.mostrarError('Error al eliminar la tarea. Intenta de nuevo.');
        this.eliminando.set(false);
        this.confirmandoEliminar.set(false);
      },
    });
  }

  private mostrarError(msg: string) {
    this.errorMsg.set(msg);
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => this.errorMsg.set(null), 5000);
  }

  estadoLabel(e: Tarea['estado']): string {
    return { pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada', cancelada: 'Cancelada' }[e] ?? e;
  }

  prioLabel(p: Tarea['prioridad']): string {
    return { baja: 'Baja', media: 'Media', alta: 'Alta' }[p] ?? p;
  }

  formatDate(d: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
