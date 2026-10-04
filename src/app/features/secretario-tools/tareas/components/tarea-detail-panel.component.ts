import { Component, ElementRef, Input, Output, EventEmitter, inject, signal, computed, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActaService } from '../../services/acta.service';
import { Subtarea, Tarea, UsuarioAsignable } from '../../models/acta.model';
import { AuthStore } from '../../../../core/auth/auth.store';
import { SelectPickerComponent, PickerOption } from '../../../../shared/components/select-picker/select-picker.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

type Guardado = 'idle' | 'guardando' | 'guardado' | 'error';

/** Quien puede abrir actas (acta_router.ROLES) gestiona también las tareas que salen de ellas. */
const ROLES_ACTAS = ['administrador', 'gestor aplicación', 'secretario', 'anciano'];

/**
 * Detalle de una tarea. Cada campo se guarda al cambiarlo (sin modo "Editar").
 * Quién puede qué lo decide el backend; aquí solo se refleja:
 *  - creador: todo (título, descripción, asignado, fecha, prioridad, pasos, borrar).
 *  - asignado: estado y marcar pasos.
 */
@Component({
  selector: 'app-tarea-detail-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectPickerComponent, DatePickerComponent, ConfirmDialogComponent],
  template: `
  <div class="panel" [class.panel--drawer]="modoDrawer">

    @if (modoDrawer) {
      <header class="cab">
        <div class="cab-izq">
          <span class="cab-etiqueta">Tarea</span>
          @if (tarea(); as t) {
            @if (t.origen_tipo === 'acta_reunion' && t.origen_id) {
              <span class="cab-sep" aria-hidden="true">·</span>
              <button type="button" class="enlace" (click)="irAActa(t.origen_id!)">Acta #{{ t.origen_id }}</button>
            }
          }
        </div>
        <span class="guardado" [attr.data-estado]="guardado()" aria-live="polite">
          @switch (guardado()) {
            @case ('guardando') { Guardando… }
            @case ('guardado') { Guardado }
            @case ('error') { No se guardó }
          }
        </span>
        <button type="button" class="btn-icono" (click)="cerrar.emit()" aria-label="Cerrar detalle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-width="2.2" d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </header>
    }

    @if (loading()) {
      <div class="cuerpo" aria-busy="true">
        <div class="skel h-7 w-4/5 rounded-lg"></div>
        <div class="skel h-4 w-1/2 rounded mt-3"></div>
        <div class="mt-8 space-y-4">
          @for (i of [1,2,3,4]; track i) { <div class="skel h-10 rounded-lg"></div> }
        </div>
      </div>
    } @else if (error()) {
      <div class="cuerpo vacio">
        <p class="vacio-titulo">No se pudo abrir la tarea</p>
        <p class="vacio-texto">{{ error() }}</p>
        <button type="button" class="btn-sec mt-4" (click)="cerrar.emit()">Volver</button>
      </div>
    } @else if (tarea(); as t) {

      <div class="cuerpo">
        @if (errorMsg()) {
          <div class="aviso-error" role="alert">{{ errorMsg() }}</div>
        }

        <!-- Título -->
        @if (puedeEditar()) {
          <textarea class="titulo titulo--editable" rows="1" maxlength="255" aria-label="Título de la tarea"
            [ngModel]="borradorTitulo" (ngModelChange)="borradorTitulo = $event; autoAltura($event, tituloEl)" #tituloEl
            (focus)="autoAltura(null, tituloEl)" (blur)="guardarTitulo()" (keydown.enter)="$event.preventDefault(); tituloEl.blur()"
            (keydown.escape)="borradorTitulo = t.titulo; tituloEl.blur(); $event.stopPropagation()"></textarea>
        } @else {
          <h2 class="titulo">{{ t.titulo }}</h2>
        }

        <p class="linea-meta">
          @if (t.creado_por === miId) { Creada por ti }
          @else if (t.creado_por_nombre) { Creada por {{ t.creado_por_nombre }} }
          @else { Creada }
          el {{ fechaLarga(t.creado_en) }}
          @if (t.completado_en && t.estado === 'completada') {
            <span class="hecha"> · Completada el {{ fechaLarga(t.completado_en) }}</span>
          }
        </p>

        <!-- Propiedades -->
        <dl class="props">
          <div class="prop">
            <dt>Estado</dt>
            <dd>
              <app-select-picker [options]="opcionesEstado()" [ngModel]="t.estado" (ngModelChange)="cambiarEstado($event)"
                [clearable]="false" [searchable]="false" colorScheme="rose" ariaLabel="Estado"/>
            </dd>
          </div>

          <div class="prop">
            <dt>Asignada a</dt>
            <dd>
              @if (puedeEditar()) {
                <app-select-picker [options]="opcionesAsignado()" [ngModel]="t.asignado_a ?? null" (ngModelChange)="cambiarAsignado($event)"
                  [clearable]="true" [searchable]="true" placeholder="Sin asignar" colorScheme="rose" ariaLabel="Asignada a"
                  (click)="cargarAsignables()"/>
              } @else {
                <span class="valor">{{ t.asignado_a === miId ? 'Ti' : (t.asignado_a_nombre || 'Sin asignar') }}</span>
              }
            </dd>
          </div>

          <div class="prop">
            <dt>Fecha límite</dt>
            <dd>
              @if (puedeEditar()) {
                <app-date-picker [ngModel]="t.fecha_limite ?? null" (ngModelChange)="guardarCampo({ fecha_limite: $event || null })"
                  [fieldLike]="true" colorScheme="rose" placeholder="Sin fecha"/>
              } @else {
                <span class="valor" [class.valor--vacio]="!t.fecha_limite">{{ t.fecha_limite ? fechaLarga(t.fecha_limite + 'T00:00:00') : 'Sin fecha' }}</span>
              }
            </dd>
          </div>

          <div class="prop">
            <dt>Prioridad</dt>
            <dd>
              @if (puedeEditar()) {
                <div class="segmentos" role="radiogroup" aria-label="Prioridad">
                  @for (p of prioridades; track p.value) {
                    <button type="button" role="radio" class="segmento" [attr.aria-checked]="t.prioridad === p.value"
                      [attr.data-prio]="p.value" [class.segmento--on]="t.prioridad === p.value"
                      (click)="t.prioridad !== p.value && guardarCampo({ prioridad: p.value })">
                      <span class="punto"></span>{{ p.label }}
                    </button>
                  }
                </div>
              } @else {
                <span class="valor"><span class="punto" [attr.data-prio]="t.prioridad"></span>{{ prioLabel(t.prioridad) }}</span>
              }
            </dd>
          </div>
        </dl>

        <!-- Descripción -->
        <section class="seccion">
          <h3 class="seccion-titulo">Descripción</h3>
          @if (puedeEditar()) {
            <textarea class="desc" rows="3" placeholder="Añade detalles, contexto o enlaces…" aria-label="Descripción"
              [ngModel]="borradorDesc" (ngModelChange)="borradorDesc = $event; autoAltura($event, descEl)" #descEl
              (focus)="autoAltura(null, descEl)" (blur)="guardarDescripcion()"></textarea>
          } @else if (t.descripcion) {
            <p class="desc-texto">{{ t.descripcion }}</p>
          } @else {
            <p class="valor--vacio text-sm">Sin descripción.</p>
          }
        </section>

        <!-- Pasos -->
        @if ((t.subtareas?.length ?? 0) > 0 || puedeEditar()) {
          <section class="seccion">
            <div class="flex items-center gap-3">
              <h3 class="seccion-titulo">Pasos</h3>
              @if (t.subtareas_total) {
                <span class="pasos-num">{{ t.subtareas_completadas }} de {{ t.subtareas_total }}</span>
                <span class="barra" role="progressbar" [attr.aria-valuenow]="t.subtareas_completadas" aria-valuemin="0" [attr.aria-valuemax]="t.subtareas_total">
                  <span class="barra-relleno" [style.transform]="'scaleX(' + ((t.subtareas_completadas ?? 0) / t.subtareas_total) + ')'"></span>
                </span>
              }
            </div>
            <ul class="pasos">
              @for (s of t.subtareas ?? []; track s.id_subtarea) {
                <li class="paso" [class.paso--hecho]="s.completada">
                  <label class="paso-check">
                    <input type="checkbox" [checked]="s.completada" [disabled]="subOcupadas().has(s.id_subtarea)"
                      (change)="alternarSubtarea(s)"/>
                    <span class="caja" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>
                    </span>
                    <span class="paso-titulo">{{ s.titulo }}</span>
                  </label>
                  @if (puedeEditar()) {
                    <button type="button" class="paso-quitar" (click)="eliminarSubtarea(s)" [disabled]="subOcupadas().has(s.id_subtarea)"
                      [attr.aria-label]="'Quitar paso: ' + s.titulo">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-width="2.2" d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                  }
                </li>
              }
            </ul>
            @if (puedeEditar()) {
              <form class="paso-nuevo" (submit)="$event.preventDefault(); agregarSubtarea(pasoEl)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-width="2.2" d="M12 5v14m-7-7h14"/></svg>
                <input #pasoEl type="text" maxlength="255" name="nuevoPaso" [(ngModel)]="nuevaSubtarea" placeholder="Añadir un paso"
                  aria-label="Nuevo paso" [disabled]="agregandoSub()"/>
                @if (nuevaSubtarea.trim()) {
                  <button type="submit" class="paso-nuevo-ok" [disabled]="agregandoSub()">Añadir</button>
                }
              </form>
            }
          </section>
        }

        @if (!puedeEditar()) {
          <p class="nota">Solo quien creó la tarea puede cambiar sus datos. Tú puedes actualizar el estado y marcar los pasos.</p>
        }
      </div>

      <!-- Acción principal, al alcance del pulgar -->
      <footer class="pie">
        @if (puedeEditar()) {
          <button type="button" class="btn-borrar" (click)="confirmandoEliminar.set(true)" aria-label="Eliminar tarea" title="Eliminar tarea">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16M10 3h4a1 1 0 011 1v3H9V4a1 1 0 011-1z"/></svg>
          </button>
        }
        @if (t.estado === 'completada' || t.estado === 'cancelada') {
          <button type="button" class="btn-sec flex-1" [disabled]="guardado() === 'guardando'" (click)="cambiarEstado('pendiente')">Reabrir tarea</button>
        } @else {
          @if (t.estado === 'pendiente') {
            <button type="button" class="btn-sec" [disabled]="guardado() === 'guardando'" (click)="cambiarEstado('en_progreso')">Empezar</button>
          }
          <button type="button" class="btn-hecho flex-1" [disabled]="guardado() === 'guardando'" (click)="cambiarEstado('completada')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            <span class="sm:hidden">Completar</span><span class="hidden sm:inline">Marcar como completada</span>
          </button>
        }
      </footer>

      <app-confirm-dialog [open]="confirmandoEliminar()" (openChange)="confirmandoEliminar.set($event)"
        title="¿Eliminar esta tarea?"
        [message]="'Se borrará «' + t.titulo + '» con sus pasos.' + (t.asignado_a && t.asignado_a !== miId ? ' ' + (t.asignado_a_nombre || 'La persona asignada') + ' dejará de verla.' : '') + ' No se puede deshacer.'"
        confirmLabel="Eliminar tarea" severity="danger" (confirmed)="eliminar()"/>
    }
  </div>
  `,
  styles: [`
    :host { display: block; height: 100%; --ease: cubic-bezier(0.23, 1, 0.32, 1); }
    .panel { display: flex; flex-direction: column; min-height: 100%; background: #fff; color: rgb(17 24 39); }
    .panel--drawer { height: 100%; }
    :host-context(.dark) .panel { background: rgb(15 23 42); color: rgb(241 245 249); }

    /* Cabecera */
    .cab { position: relative; display: flex; align-items: center; gap: 8px; padding: 14px 12px 12px 20px; border-bottom: 1px solid rgb(243 244 246); flex-shrink: 0; }
    :host-context(.dark) .cab { border-color: rgb(30 41 59); }
    .cab-izq { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; font-size: 13px; }
    .cab-etiqueta { font-family: var(--font-display); font-weight: 700; color: rgb(107 114 128); }
    .cab-sep { color: rgb(209 213 219); }
    .enlace { color: rgb(190 18 60); font-weight: 600; border-radius: 4px; }
    .enlace:hover { text-decoration: underline; text-underline-offset: 2px; }
    :host-context(.dark) .enlace { color: rgb(251 113 133); }
    .guardado { font-size: 12px; color: rgb(156 163 175); transition: opacity 200ms ease; }
    .guardado[data-estado="idle"] { opacity: 0; }
    .guardado[data-estado="guardado"] { color: rgb(5 150 105); }
    .guardado[data-estado="error"] { color: rgb(220 38 38); }
    .btn-icono { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 10px; color: rgb(107 114 128); transition: background-color 150ms ease, color 150ms ease, transform 160ms var(--ease); }
    .btn-icono svg { width: 18px; height: 18px; }
    .btn-icono:hover { background: rgb(243 244 246); color: rgb(17 24 39); }
    .btn-icono:active { transform: scale(0.94); }
    :host-context(.dark) .btn-icono:hover { background: rgb(30 41 59); color: #fff; }

    /* Cuerpo */
    .cuerpo { flex: 1; min-height: 0; overflow-y: auto; padding: 20px 20px 28px; overscroll-behavior: contain; }
    @media (min-width: 640px) { .cuerpo { padding: 24px 28px 32px; } }
    .aviso-error { margin-bottom: 16px; padding: 10px 12px; border-radius: 10px; font-size: 13px; background: rgb(254 242 242); color: rgb(185 28 28); }
    :host-context(.dark) .aviso-error { background: rgb(127 29 29 / 0.3); color: rgb(252 165 165); }

    .titulo {
      display: block; width: calc(100% + 16px); margin: 0 -8px; padding: 4px 8px; box-sizing: border-box;
      font-family: var(--font-display); font-size: 22px; font-weight: 700; line-height: 1.25; letter-spacing: -0.01em;
      color: inherit; background: transparent; border: 1px solid transparent; border-radius: 10px; resize: none; overflow: hidden;
      overflow-wrap: anywhere; field-sizing: content;
    }
    .titulo--editable:hover { background: rgb(249 250 251); }
    .titulo--editable:focus { outline: none; background: #fff; border-color: rgb(253 164 175); box-shadow: 0 0 0 4px rgb(244 63 94 / 0.1); }
    :host-context(.dark) .titulo--editable:hover { background: rgb(30 41 59); }
    :host-context(.dark) .titulo--editable:focus { background: rgb(30 41 59); border-color: rgb(159 18 57); }
    .linea-meta { margin-top: 6px; font-size: 13px; color: rgb(107 114 128); }
    .hecha { color: rgb(5 150 105); }
    :host-context(.dark) .linea-meta { color: rgb(148 163 184); }

    /* Propiedades */
    .props { margin: 24px 0 0; display: flex; flex-direction: column; gap: 4px; }
    .prop { display: grid; grid-template-columns: 112px 1fr; align-items: center; gap: 12px; min-height: 44px; }
    .prop dt { font-size: 13px; font-weight: 500; color: rgb(107 114 128); }
    .prop dd { margin: 0; min-width: 0; }
    :host-context(.dark) .prop dt { color: rgb(148 163 184); }
    @media (max-width: 380px) { .prop { grid-template-columns: 1fr; gap: 4px; padding: 6px 0; } }
    .valor { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
    .valor--vacio { color: rgb(156 163 175); font-weight: 500; }

    .segmentos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 3px; border-radius: 10px; background: rgb(243 244 246); }
    :host-context(.dark) .segmentos { background: rgb(30 41 59); }
    .segmento { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; border-radius: 8px; font-size: 13px; font-weight: 600; color: rgb(107 114 128); transition: background-color 160ms var(--ease), color 160ms ease, transform 160ms var(--ease); }
    .segmento:hover { color: rgb(17 24 39); }
    .segmento:active { transform: scale(0.97); }
    .segmento--on { background: #fff; color: rgb(17 24 39); box-shadow: 0 1px 2px rgb(15 23 42 / 0.08); }
    :host-context(.dark) .segmento { color: rgb(148 163 184); }
    :host-context(.dark) .segmento:hover, :host-context(.dark) .segmento--on { color: #fff; }
    :host-context(.dark) .segmento--on { background: rgb(51 65 85); box-shadow: none; }
    .punto { width: 8px; height: 8px; border-radius: 999px; background: rgb(156 163 175); flex-shrink: 0; }
    [data-prio="alta"] .punto, .punto[data-prio="alta"] { background: rgb(239 68 68); }
    [data-prio="media"] .punto, .punto[data-prio="media"] { background: rgb(245 158 11); }

    /* Secciones */
    .seccion { margin-top: 28px; }
    .seccion-titulo { font-family: var(--font-display); font-size: 14px; font-weight: 700; color: rgb(55 65 81); margin: 0 0 8px; }
    :host-context(.dark) .seccion-titulo { color: rgb(203 213 225); }
    .desc {
      width: 100%; min-height: 84px; padding: 10px 12px; font-size: 14px; line-height: 1.55; resize: none; overflow: hidden; field-sizing: content;
      color: inherit; background: rgb(249 250 251); border: 1px solid rgb(229 231 235); border-radius: 12px;
      transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
    }
    .desc:focus { outline: none; background: #fff; border-color: rgb(253 164 175); box-shadow: 0 0 0 4px rgb(244 63 94 / 0.1); }
    :host-context(.dark) .desc { background: rgb(30 41 59); border-color: rgb(51 65 85); }
    :host-context(.dark) .desc:focus { border-color: rgb(159 18 57); }
    .desc::placeholder { color: rgb(156 163 175); }
    .desc-texto { font-size: 14px; line-height: 1.6; color: rgb(55 65 81); white-space: pre-line; max-width: 65ch; }
    :host-context(.dark) .desc-texto { color: rgb(203 213 225); }

    /* Pasos */
    .pasos-num { font-size: 12px; font-weight: 600; color: rgb(107 114 128); font-variant-numeric: tabular-nums; margin-bottom: 8px; }
    .barra { flex: 1; max-width: 140px; height: 4px; border-radius: 999px; background: rgb(229 231 235); overflow: hidden; margin-bottom: 8px; }
    :host-context(.dark) .barra { background: rgb(51 65 85); }
    .barra-relleno { display: block; height: 100%; background: rgb(16 185 129); border-radius: 999px; transform-origin: left; transition: transform 320ms var(--ease); }
    .pasos { list-style: none; margin: 0; padding: 0; }
    .paso { display: flex; align-items: center; gap: 4px; border-radius: 10px; margin: 0 -8px; padding: 0 8px; }
    @media (hover: hover) { .paso:hover { background: rgb(249 250 251); } :host-context(.dark) .paso:hover { background: rgb(30 41 59); } }
    .paso-check { flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px; min-height: 44px; cursor: pointer; }
    .paso-check input { position: absolute; opacity: 0; pointer-events: none; }
    .caja { width: 18px; height: 18px; flex-shrink: 0; border-radius: 6px; border: 1.75px solid rgb(209 213 219); display: flex; align-items: center; justify-content: center; color: transparent; transition: background-color 160ms var(--ease), border-color 160ms var(--ease), transform 160ms var(--ease); }
    .caja svg { width: 11px; height: 11px; }
    .paso-check:active .caja { transform: scale(0.88); }
    .paso-check input:focus-visible + .caja { outline: 2px solid rgb(244 63 94); outline-offset: 2px; }
    .paso--hecho .caja { background: rgb(16 185 129); border-color: rgb(16 185 129); color: #fff; }
    :host-context(.dark) .caja { border-color: rgb(100 116 139); }
    .paso-titulo { font-size: 14px; line-height: 1.4; overflow-wrap: anywhere; transition: color 200ms ease; }
    .paso--hecho .paso-titulo { color: rgb(156 163 175); text-decoration: line-through; }
    .paso-quitar { width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: rgb(156 163 175); opacity: 0; transition: opacity 150ms ease, color 150ms ease, background-color 150ms ease; }
    .paso-quitar svg { width: 15px; height: 15px; }
    .paso:hover .paso-quitar, .paso-quitar:focus-visible { opacity: 1; }
    .paso-quitar:hover { color: rgb(220 38 38); background: rgb(254 242 242); }
    @media (hover: none) { .paso-quitar { opacity: 1; } }
    .paso-nuevo { display: flex; align-items: center; gap: 10px; min-height: 44px; margin: 2px -8px 0; padding: 0 8px; border-radius: 10px; color: rgb(156 163 175); }
    .paso-nuevo svg { width: 18px; height: 18px; flex-shrink: 0; }
    .paso-nuevo input { flex: 1; min-width: 0; height: 40px; font-size: 14px; background: transparent; border: none; color: rgb(17 24 39); }
    .paso-nuevo input:focus { outline: none; }
    .paso-nuevo:focus-within { background: rgb(249 250 251); color: rgb(225 29 72); }
    :host-context(.dark) .paso-nuevo input { color: rgb(241 245 249); }
    :host-context(.dark) .paso-nuevo:focus-within { background: rgb(30 41 59); }
    .paso-nuevo-ok { font-size: 13px; font-weight: 700; color: rgb(225 29 72); padding: 6px 8px; border-radius: 6px; }

    .nota { margin-top: 28px; font-size: 13px; line-height: 1.5; color: rgb(107 114 128); max-width: 52ch; }
    :host-context(.dark) .nota { color: rgb(148 163 184); }

    /* Pie */
    .pie {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid rgb(243 244 246); background: inherit;
    }
    @media (min-width: 640px) { .pie { padding: 14px 28px; } }
    :host-context(.dark) .pie { border-color: rgb(30 41 59); }
    .btn-hecho, .btn-sec {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 16px;
      border-radius: 12px; font-size: 14px; font-weight: 600;
      transition: background-color 160ms ease, border-color 160ms ease, transform 160ms var(--ease);
    }
    .btn-hecho:active:not(:disabled), .btn-sec:active:not(:disabled), .btn-borrar:active { transform: scale(0.97); }
    .btn-hecho:disabled, .btn-sec:disabled { opacity: 0.6; }
    .btn-hecho { background: rgb(5 150 105); color: #fff; }
    .btn-hecho:hover:not(:disabled) { background: rgb(4 120 87); }
    .btn-hecho svg { width: 16px; height: 16px; }
    .btn-sec { border: 1px solid rgb(229 231 235); background: #fff; color: rgb(55 65 81); }
    .btn-sec:hover:not(:disabled) { background: rgb(249 250 251); }
    :host-context(.dark) .btn-sec { background: rgb(30 41 59); border-color: rgb(51 65 85); color: rgb(226 232 240); }
    .btn-borrar { width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 12px; color: rgb(156 163 175); transition: color 150ms ease, background-color 150ms ease, transform 160ms var(--ease); }
    .btn-borrar svg { width: 18px; height: 18px; }
    .btn-borrar:hover { color: rgb(220 38 38); background: rgb(254 242 242); }
    :host-context(.dark) .btn-borrar:hover { background: rgb(127 29 29 / 0.3); color: rgb(252 165 165); }

    .btn-hecho:focus-visible, .btn-sec:focus-visible, .btn-borrar:focus-visible, .btn-icono:focus-visible, .segmento:focus-visible, .paso-quitar:focus-visible, .enlace:focus-visible {
      outline: 2px solid rgb(244 63 94); outline-offset: 2px;
    }

    /* Vacío / esqueleto */
    .vacio { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .vacio-titulo { font-family: var(--font-display); font-size: 16px; font-weight: 700; }
    .vacio-texto { margin-top: 4px; font-size: 14px; color: rgb(107 114 128); max-width: 40ch; }
    .skel { background: linear-gradient(90deg, rgb(243 244 246) 0%, rgb(249 250 251) 50%, rgb(243 244 246) 100%); background-size: 200% 100%; animation: brillo 1.4s linear infinite; }
    :host-context(.dark) .skel { background: linear-gradient(90deg, rgb(30 41 59) 0%, rgb(51 65 85) 50%, rgb(30 41 59) 100%); background-size: 200% 100%; }
    @keyframes brillo { from { background-position: 200% 0; } to { background-position: -200% 0; } }

    @media (prefers-reduced-motion: reduce) {
      .skel { animation: none; }
      .barra-relleno, .caja, .segmento { transition: none; }
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
  private store = inject(AuthStore);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  tarea = signal<Tarea | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  errorMsg = signal<string | null>(null);
  guardado = signal<Guardado>('idle');
  confirmandoEliminar = signal(false);
  usuarios = signal<UsuarioAsignable[]>([]);
  subOcupadas = signal<Set<number>>(new Set());
  agregandoSub = signal(false);
  nuevaSubtarea = '';
  borradorTitulo = '';
  borradorDesc = '';

  readonly prioridades: { value: Tarea['prioridad']; label: string }[] = [
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
  ];

  private errorTimer: ReturnType<typeof setTimeout> | null = null;
  private guardadoTimer: ReturnType<typeof setTimeout> | null = null;

  get miId(): number | null {
    const id = this.store.user()?.id;
    return id != null ? Number(id) : null;
  }

  /**
   * Mismo criterio que el backend: el creador (o el asignado si la cuenta creadora
   * ya no existe), y para las tareas de un acta, quien gestiona actas.
   */
  puedeEditar = computed(() => {
    const t = this.tarea();
    if (!t) return false;
    const yo = this.miId;
    if (t.creado_por === yo || (t.creado_por == null && t.asignado_a === yo)) return true;
    const rol = (this.store.user()?.rol ?? '').toLowerCase();
    return t.origen_tipo === 'acta_reunion' && ROLES_ACTAS.includes(rol);
  });

  opcionesEstado = computed<PickerOption[]>(() => {
    const base: PickerOption[] = [
      { value: 'pendiente', label: 'Pendiente' },
      { value: 'en_progreso', label: 'En progreso' },
      { value: 'completada', label: 'Completada' },
    ];
    // Cancelar es una decisión de quien encargó la tarea.
    if (this.puedeEditar() || this.tarea()?.estado === 'cancelada') base.push({ value: 'cancelada', label: 'Cancelada' });
    return base;
  });

  opcionesAsignado = computed<PickerOption[]>(() => {
    const yo = this.miId;
    const t = this.tarea();
    const lista = this.usuarios();
    const ops: PickerOption[] = [];
    if (yo != null) ops.push({ value: yo, label: 'Yo', hint: lista.find(u => u.id_usuario === yo)?.nombre });
    for (const u of lista) if (u.id_usuario !== yo) ops.push({ value: u.id_usuario, label: u.nombre });
    // Mientras carga la lista, que el asignado actual se vea con su nombre.
    if (t?.asignado_a && !ops.some(o => o.value === t.asignado_a)) {
      ops.push({ value: t.asignado_a, label: t.asignado_a_nombre ?? 'Asignado' });
    }
    return ops;
  });

  ngOnInit() { this.cargar(); }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tareaId'] && !changes['tareaId'].firstChange) this.cargar();
  }

  private cargar() {
    this.loading.set(true);
    this.error.set(null);
    this.errorMsg.set(null);
    this.guardado.set('idle');
    this.svc.getTarea(this.tareaId).subscribe({
      next: (t) => {
        this.aplicar(t, false);
        this.loading.set(false);
        if (this.puedeEditar()) this.cargarAsignables();
      },
      error: (err) => {
        this.error.set(err?.status === 404
          ? 'No existe o no es tuya: solo ves las tareas que creaste o que te asignaron.'
          : 'Revisa tu conexión e inténtalo de nuevo.');
        this.loading.set(false);
      },
    });
  }

  private aplicar(t: Tarea, emitir = true) {
    this.tarea.set(t);
    this.borradorTitulo = t.titulo;
    this.borradorDesc = t.descripcion ?? '';
    if (emitir) this.tareaActualizada.emit(t);
    // Tras pintar, que título y descripción muestren todo su texto.
    setTimeout(() => this.host.nativeElement.querySelectorAll('textarea').forEach(el => this.autoAltura(null, el)));
  }

  cargarAsignables() {
    if (this.usuarios().length) return;
    this.svc.listarAsignables().subscribe({ next: (l) => this.usuarios.set(l), error: () => {} });
  }

  /** Ajusta la altura del textarea a su contenido (sin barra de scroll interna). */
  autoAltura(_: unknown, el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  // ── Guardado por campo ──
  private marcarGuardado(estado: Guardado) {
    this.guardado.set(estado);
    if (this.guardadoTimer) clearTimeout(this.guardadoTimer);
    if (estado === 'guardado') this.guardadoTimer = setTimeout(() => this.guardado.set('idle'), 1800);
  }

  guardarCampo(patch: Partial<Tarea>) {
    const t = this.tarea();
    if (!t) return;
    const previo = t;
    this.tarea.set({ ...t, ...patch });
    this.marcarGuardado('guardando');
    this.svc.updateTarea(t.id_tarea, patch).subscribe({
      next: (u) => { this.aplicar(u); this.marcarGuardado('guardado'); },
      error: (err) => {
        this.aplicar(previo, false);
        this.marcarGuardado('error');
        this.mostrarError(err?.error?.detail ?? 'No se pudo guardar el cambio. Inténtalo de nuevo.');
      },
    });
  }

  guardarTitulo() {
    const t = this.tarea();
    const nuevo = this.borradorTitulo.trim();
    if (!t) return;
    if (!nuevo) { this.borradorTitulo = t.titulo; this.mostrarError('El título no puede quedar vacío.'); return; }
    if (nuevo !== t.titulo) this.guardarCampo({ titulo: nuevo });
  }

  guardarDescripcion() {
    const t = this.tarea();
    if (!t) return;
    const nuevo = this.borradorDesc.trim();
    if (nuevo !== (t.descripcion ?? '')) this.guardarCampo({ descripcion: nuevo || null });
  }

  cambiarAsignado(id: number | null) {
    const t = this.tarea();
    if (!t || (t.asignado_a ?? null) === id) return;
    const u = this.usuarios().find(x => x.id_usuario === id);
    this.guardarCampo({ asignado_a: id, asignado_a_nombre: u?.nombre ?? null } as Partial<Tarea>);
  }

  cambiarEstado(estado: Tarea['estado']) {
    const t = this.tarea();
    if (!t || t.estado === estado) return;
    const previo = t;
    this.tarea.set({ ...t, estado });
    this.marcarGuardado('guardando');
    this.svc.actualizarEstadoTarea(t.id_tarea, estado).subscribe({
      next: (u) => { this.aplicar(u); this.marcarGuardado('guardado'); },
      error: (err) => {
        this.aplicar(previo, false);
        this.marcarGuardado('error');
        this.mostrarError(err?.error?.detail ?? 'No se pudo cambiar el estado.');
      },
    });
  }

  // ── Subtareas ──
  private aplicarSubtareas(lista: Subtarea[]) {
    const t = this.tarea();
    if (!t) return;
    const ordenada = [...lista].sort((a, b) => a.orden - b.orden || a.id_subtarea - b.id_subtarea);
    const actualizada: Tarea = {
      ...t,
      subtareas: ordenada,
      subtareas_total: ordenada.length,
      subtareas_completadas: ordenada.filter(s => s.completada).length,
    };
    this.tarea.set(actualizada);
    this.tareaActualizada.emit(actualizada);
  }

  private marcarOcupada(id: number, ocupada: boolean) {
    this.subOcupadas.update(s => { const n = new Set(s); ocupada ? n.add(id) : n.delete(id); return n; });
  }

  agregarSubtarea(input?: HTMLInputElement) {
    const t = this.tarea();
    const titulo = this.nuevaSubtarea.trim();
    if (!t || !titulo || this.agregandoSub()) return;
    this.agregandoSub.set(true);
    this.svc.crearSubtarea(t.id_tarea, titulo).subscribe({
      next: (s) => {
        this.nuevaSubtarea = '';
        if (input) { input.value = ''; setTimeout(() => input.focus()); }
        this.agregandoSub.set(false);
        this.aplicarSubtareas([...(this.tarea()?.subtareas ?? []), s]);
      },
      error: () => { this.agregandoSub.set(false); this.mostrarError('No se pudo añadir el paso.'); },
    });
  }

  alternarSubtarea(sub: Subtarea) {
    const t = this.tarea();
    if (!t) return;
    const completada = !sub.completada;
    // Optimista: el check responde al instante.
    this.aplicarSubtareas((t.subtareas ?? []).map(s => s.id_subtarea === sub.id_subtarea ? { ...s, completada } : s));
    this.marcarOcupada(sub.id_subtarea, true);
    this.svc.actualizarSubtarea(t.id_tarea, sub.id_subtarea, { completada }).subscribe({
      next: (s) => {
        this.marcarOcupada(sub.id_subtarea, false);
        this.aplicarSubtareas((this.tarea()?.subtareas ?? []).map(x => x.id_subtarea === s.id_subtarea ? s : x));
      },
      error: () => {
        this.marcarOcupada(sub.id_subtarea, false);
        this.aplicarSubtareas((this.tarea()?.subtareas ?? []).map(x => x.id_subtarea === sub.id_subtarea ? sub : x));
        this.mostrarError('No se pudo actualizar el paso.');
      },
    });
  }

  eliminarSubtarea(sub: Subtarea) {
    const t = this.tarea();
    if (!t) return;
    this.marcarOcupada(sub.id_subtarea, true);
    this.svc.eliminarSubtarea(t.id_tarea, sub.id_subtarea).subscribe({
      next: () => {
        this.marcarOcupada(sub.id_subtarea, false);
        this.aplicarSubtareas((this.tarea()?.subtareas ?? []).filter(x => x.id_subtarea !== sub.id_subtarea));
      },
      error: () => { this.marcarOcupada(sub.id_subtarea, false); this.mostrarError('No se pudo quitar el paso.'); },
    });
  }

  eliminar() {
    const t = this.tarea();
    if (!t) return;
    this.svc.eliminarTarea(t.id_tarea).subscribe({
      next: () => { this.tareaEliminada.emit(t.id_tarea); this.cerrar.emit(); },
      error: (err) => this.mostrarError(err?.error?.detail ?? 'No se pudo eliminar la tarea.'),
    });
  }

  irAActa(actaId: number) {
    this.router.navigate(['/secretario-tools/actas-reunion', actaId]);
  }

  private mostrarError(msg: string) {
    this.errorMsg.set(msg);
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => this.errorMsg.set(null), 6000);
  }

  prioLabel(p: Tarea['prioridad']): string {
    return { baja: 'Baja', media: 'Media', alta: 'Alta' }[p] ?? p;
  }

  fechaLarga(d: string): string {
    if (!d) return '';
    const f = new Date(d);
    const mismoAno = f.getFullYear() === new Date().getFullYear();
    return f.toLocaleDateString('es', { day: 'numeric', month: 'long', year: mismoAno ? undefined : 'numeric' });
  }
}
