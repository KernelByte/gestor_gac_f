import { Component, Input, Output, EventEmitter, inject, signal, OnInit, OnChanges, SimpleChanges } from '@angular/core';
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
  <div class="panel-root">

    @if (modoDrawer) {
      <header class="drawer-header">
        <h2 class="drawer-title">Detalle de tarea</h2>
        <button (click)="cerrar.emit()" class="btn-close" type="button" aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </header>
    }

    @if (loading()) {
      <div class="state-center">
        <span class="spinner"></span>
        <p>Cargando tarea…</p>
      </div>
    } @else if (error()) {
      <div class="state-center">
        <p class="error-msg">{{ error() }}</p>
        <button (click)="cerrar.emit()" class="btn-primary" type="button">Cerrar</button>
      </div>
    } @else if (tarea(); as t) {
      <div class="detail-card">

        @if (errorMsg()) {
          <div class="error-toast">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            </svg>
            {{ errorMsg() }}
          </div>
        }

        <!-- Chips: estado + prioridad + acta de origen -->
        <div class="chips-row">
          <span class="chip chip-estado" [attr.data-estado]="t.estado">
            {{ estadoLabel(t.estado) }}
          </span>
          <span class="chip chip-prio" [attr.data-prio]="t.prioridad">
            {{ prioLabel(t.prioridad) }}
          </span>
          @if (t.origen_tipo === 'acta_reunion' && t.origen_id) {
            <button class="chip chip-origen" type="button" (click)="irAActa(t.origen_id!)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
              Acta #{{ t.origen_id }}
            </button>
          }
        </div>

        <!-- Título -->
        <div class="field-group">
          <label class="field-label">Título</label>
          @if (editando()) {
            <input class="field-input" [(ngModel)]="form.titulo" placeholder="Título de la tarea" maxlength="255" />
          } @else {
            <div class="field-value-wrap" (click)="iniciarEdicion()">
              <p class="field-value field-title">{{ t.titulo }}</p>
              <span class="pencil-hint" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </span>
            </div>
          }
        </div>

        <!-- Descripción -->
        <div class="field-group">
          <label class="field-label">Descripción</label>
          @if (editando()) {
            <textarea class="field-input field-textarea" [(ngModel)]="form.descripcion" rows="4" placeholder="Descripción opcional…"></textarea>
          } @else {
            <div class="field-value-wrap" (click)="iniciarEdicion()">
              <p class="field-value">{{ t.descripcion || '—' }}</p>
              <span class="pencil-hint" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </span>
            </div>
          }
        </div>

        <!-- Estado + Prioridad + Fecha -->
        <div class="fields-row">
          <div class="field-group">
            <label class="field-label">Estado</label>
            @if (editando()) {
              <select class="field-input" [(ngModel)]="form.estado">
                <option value="pendiente">Pendiente</option>
                <option value="en_progreso">En progreso</option>
                <option value="completada">Completada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            } @else {
              <div class="field-value-wrap" (click)="iniciarEdicion()">
                <p class="field-value">{{ estadoLabel(t.estado) }}</p>
                <span class="pencil-hint" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </span>
              </div>
            }
          </div>
          <div class="field-group">
            <label class="field-label">Prioridad</label>
            @if (editando()) {
              <select class="field-input" [(ngModel)]="form.prioridad">
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            } @else {
              <div class="field-value-wrap" (click)="iniciarEdicion()">
                <p class="field-value">{{ prioLabel(t.prioridad) }}</p>
                <span class="pencil-hint" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </span>
              </div>
            }
          </div>
          <div class="field-group">
            <label class="field-label">Fecha límite</label>
            @if (editando()) {
              <input type="date" class="field-input" [(ngModel)]="form.fecha_limite" />
            } @else {
              <div class="field-value-wrap" (click)="iniciarEdicion()">
                <p class="field-value">{{ t.fecha_limite || '—' }}</p>
                <span class="pencil-hint" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </span>
              </div>
            }
          </div>
        </div>

        <!-- Asignado a -->
        @if (puedeAsignar()) {
          <div class="field-group">
            <label class="field-label">Asignado a</label>
            @if (editando()) {
              <select class="field-input" [(ngModel)]="form.asignado_a">
                <option [ngValue]="null">— Sin asignar —</option>
                <option *ngFor="let u of usuarios()" [ngValue]="u.id_usuario">{{ u.nombre }}</option>
              </select>
            } @else {
              <div class="field-value-wrap" (click)="iniciarEdicion()">
                <p class="field-value">{{ tarea()?.asignado_a_nombre || '— Sin asignar —' }}</p>
                <span class="pencil-hint" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                  </svg>
                </span>
              </div>
            }
          </div>
        }

        <!-- Metadatos -->
        <div class="meta-row">
          <span class="meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Creada {{ formatDate(t.creado_en) }}
          </span>
          @if (t.completado_en) {
            <span class="meta-item meta-done">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              Completada {{ formatDate(t.completado_en) }}
            </span>
          }
        </div>

        <!-- Botones de acción -->
        @if (!confirmandoEliminar()) {
          <div class="actions-row">
            @if (editando()) {
              <button (click)="cancelarEdicion()" class="btn-ghost" type="button">Cancelar</button>
              <button (click)="guardar()" [disabled]="guardando() || !form.titulo?.trim()" class="btn-primary" type="button">
                @if (guardando()) { <span class="spinner spinner-sm"></span> Guardando… }
                @else { Guardar cambios }
              </button>
            } @else {
              <button (click)="iniciarEdicion()" class="btn-edit" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                Editar
              </button>
              <button (click)="confirmandoEliminar.set(true)" class="btn-danger" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polyline points="3 6 5 6 21 6"/><path stroke-linecap="round" stroke-linejoin="round" d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path stroke-linecap="round" stroke-linejoin="round" d="M10 11v6M14 11v6"/></svg>
                Eliminar
              </button>
            }
          </div>
        } @else {
          <!-- Confirmación de eliminación inline -->
          <div class="delete-confirm">
            <div class="delete-confirm-info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" class="delete-confirm-icon">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              <div>
                <p class="delete-confirm-title">¿Eliminar esta tarea?</p>
                <p class="delete-confirm-sub">Esta acción no se puede deshacer.</p>
              </div>
            </div>
            <div class="delete-confirm-actions">
              <button class="btn-ghost" type="button" [disabled]="eliminando()" (click)="confirmandoEliminar.set(false)">Cancelar</button>
              <button class="btn-danger-solid" type="button" [disabled]="eliminando()" (click)="confirmarEliminar()">
                @if (eliminando()) { <span class="spinner spinner-sm spinner-danger"></span> Eliminando… }
                @else { Eliminar }
              </button>
            </div>
          </div>
        }

      </div>
    }

  </div>
  `,
  styles: [`
    :host {
      --bg: #f3f4f6;
      --surface: #ffffff;
      --border: #e5e7eb;
      --text: #111827;
      --text-muted: #6b7280;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --danger: #dc2626;
      --danger-hover: #b91c1c;
      display: block;
    }
    :host-context(.dark) {
      --bg: #020618;
      --surface: #0a1120;
      --border: #1e2d45;
      --text: #f1f5f9;
      --text-muted: #64748b;
    }

    .panel-root {
      display: flex;
      flex-direction: column;
      gap: 0;
      height: 100%;
    }

    /* ─── Drawer header ─────────────────────────── */
    .drawer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
      background: var(--surface);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .drawer-title {
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--text);
      margin: 0;
    }
    .btn-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px; height: 28px;
      background: none;
      border: 1px solid var(--border);
      border-radius: 6px;
      cursor: pointer;
      color: var(--text-muted);
      transition: color 150ms, background 150ms, border-color 150ms;
    }
    .btn-close:hover {
      color: var(--text);
      background: var(--bg);
      border-color: var(--text-muted);
    }

    /* ─── States ────────────────────────────────── */
    .state-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      padding: 4rem 1rem;
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .error-msg { color: var(--danger); }

    /* ─── Card ──────────────────────────────────── */
    .detail-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    /* ─── Error toast ───────────────────────────── */
    .error-toast {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: #fef2f2;
      color: #991b1b;
      border-radius: 8px;
      padding: 0.625rem 0.875rem;
      font-size: 0.8125rem;
      animation: fadeIn 180ms ease-out;
    }
    :host-context(.dark) .error-toast { background: #450a0a; color: #fca5a5; }

    /* ─── Chips ─────────────────────────────────── */
    .chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.72rem;
      font-weight: 600;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .chip-estado[data-estado="pendiente"]   { background: #fef3c7; color: #92400e; }
    .chip-estado[data-estado="en_progreso"] { background: #dbeafe; color: #1e40af; }
    .chip-estado[data-estado="completada"]  { background: #d1fae5; color: #065f46; }
    .chip-estado[data-estado="cancelada"]   { background: #fee2e2; color: #991b1b; }
    :host-context(.dark) .chip-estado[data-estado="pendiente"]   { background: #451a03; color: #fcd34d; }
    :host-context(.dark) .chip-estado[data-estado="en_progreso"] { background: #1e3a5f; color: #93c5fd; }
    :host-context(.dark) .chip-estado[data-estado="completada"]  { background: #064e3b; color: #6ee7b7; }
    :host-context(.dark) .chip-estado[data-estado="cancelada"]   { background: #450a0a; color: #fca5a5; }

    .chip-prio[data-prio="alta"]  { background: #fee2e2; color: #991b1b; }
    .chip-prio[data-prio="media"] { background: #fff7ed; color: #9a3412; }
    .chip-prio[data-prio="baja"]  { background: #f0fdf4; color: #166534; }
    :host-context(.dark) .chip-prio[data-prio="alta"]  { background: #450a0a; color: #fca5a5; }
    :host-context(.dark) .chip-prio[data-prio="media"] { background: #431407; color: #fdba74; }
    :host-context(.dark) .chip-prio[data-prio="baja"]  { background: #052e16; color: #86efac; }

    .chip-origen {
      background: var(--border);
      color: var(--text-muted);
      border: none;
      cursor: pointer;
      transition: background 150ms, color 150ms;
    }
    .chip-origen:hover {
      background: color-mix(in srgb, var(--primary) 12%, var(--border));
      color: var(--primary);
    }

    /* ─── Fields ────────────────────────────────── */
    .field-group {
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }
    .field-label {
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-muted);
    }
    .field-value-wrap {
      display: flex;
      align-items: flex-start;
      gap: 0.375rem;
      padding: 0.5rem 0.625rem;
      border: 1px solid transparent;
      border-radius: 6px;
      cursor: pointer;
      transition: border-color 150ms, background 150ms;
    }
    .field-value-wrap:hover {
      border-color: var(--border);
      background: var(--bg);
    }
    .field-value {
      font-size: 0.875rem;
      color: var(--text);
      margin: 0;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
      flex: 1;
    }
    .field-title { font-size: 1rem; font-weight: 600; }
    .pencil-hint {
      opacity: 0;
      color: var(--text-muted);
      transition: opacity 120ms;
      flex-shrink: 0;
      padding-top: 3px;
    }
    .field-value-wrap:hover .pencil-hint { opacity: 1; }

    .field-input {
      font-size: 0.875rem;
      color: var(--text);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.5rem 0.625rem;
      outline: none;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 150ms;
      font-family: inherit;
    }
    .field-input:focus { border-color: var(--primary); }
    .field-textarea { resize: vertical; min-height: 80px; }

    .fields-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }
    @media (max-width: 480px) {
      .fields-row { grid-template-columns: 1fr; }
    }

    /* ─── Meta ──────────────────────────────────── */
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      border-top: 1px solid var(--border);
      padding-top: 1rem;
    }
    .meta-item {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .meta-done { color: #059669; }
    :host-context(.dark) .meta-done { color: #34d399; }

    /* ─── Actions ───────────────────────────────── */
    .actions-row {
      display: flex;
      gap: 0.625rem;
      justify-content: flex-end;
    }

    /* ─── Delete confirm ────────────────────────── */
    .delete-confirm {
      display: flex;
      flex-direction: column;
      gap: 0.875rem;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 1rem;
      animation: fadeIn 180ms ease-out;
    }
    :host-context(.dark) .delete-confirm { background: #1c0a0a; border-color: #450a0a; }
    .delete-confirm-info {
      display: flex;
      align-items: flex-start;
      gap: 0.625rem;
    }
    .delete-confirm-icon { color: #dc2626; flex-shrink: 0; margin-top: 2px; }
    :host-context(.dark) .delete-confirm-icon { color: #f87171; }
    .delete-confirm-title {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text);
      margin: 0 0 0.2rem;
    }
    .delete-confirm-sub {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin: 0;
    }
    .delete-confirm-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }

    /* ─── Buttons ───────────────────────────────── */
    .btn-primary {
      display: inline-flex; align-items: center; gap: 0.375rem;
      background: var(--primary); color: #fff;
      border: none; border-radius: 7px; padding: 0.5rem 1rem;
      font-size: 0.8125rem; font-weight: 500; cursor: pointer;
      transition: background 150ms;
    }
    .btn-primary:hover:not(:disabled) { background: var(--primary-hover); }
    .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

    .btn-ghost {
      display: inline-flex; align-items: center; gap: 0.375rem;
      background: transparent; color: var(--text-muted);
      border: 1px solid var(--border); border-radius: 7px; padding: 0.5rem 1rem;
      font-size: 0.8125rem; font-weight: 500; cursor: pointer;
      transition: color 150ms, border-color 150ms;
    }
    .btn-ghost:hover:not(:disabled) { color: var(--text); border-color: var(--text-muted); }
    .btn-ghost:disabled { opacity: 0.55; cursor: not-allowed; }

    .btn-edit {
      display: inline-flex; align-items: center; gap: 0.375rem;
      background: transparent; color: var(--primary);
      border: 1px solid var(--primary); border-radius: 7px; padding: 0.5rem 1rem;
      font-size: 0.8125rem; font-weight: 500; cursor: pointer;
      transition: background 150ms;
    }
    .btn-edit:hover { background: color-mix(in srgb, var(--primary) 10%, transparent); }

    .btn-danger {
      display: inline-flex; align-items: center; gap: 0.375rem;
      background: transparent; color: var(--danger);
      border: 1px solid var(--danger); border-radius: 7px; padding: 0.5rem 1rem;
      font-size: 0.8125rem; font-weight: 500; cursor: pointer;
      transition: background 150ms;
    }
    .btn-danger:hover { background: color-mix(in srgb, var(--danger) 10%, transparent); }

    .btn-danger-solid {
      display: inline-flex; align-items: center; gap: 0.375rem;
      background: var(--danger); color: #fff;
      border: none; border-radius: 7px; padding: 0.5rem 1rem;
      font-size: 0.8125rem; font-weight: 500; cursor: pointer;
      transition: background 150ms;
    }
    .btn-danger-solid:hover:not(:disabled) { background: var(--danger-hover); }
    .btn-danger-solid:disabled { opacity: 0.55; cursor: not-allowed; }

    /* ─── Spinner ───────────────────────────────── */
    .spinner {
      display: inline-block;
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    .spinner-sm { width: 11px; height: 11px; }
    .spinner-danger {
      border-color: rgba(220,38,38,0.2);
      border-top-color: #dc2626;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
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

  form: Partial<Tarea> = {};
  private errorTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    this.cargar();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tareaId'] && !changes['tareaId'].firstChange) {
      this.cargar();
    }
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
