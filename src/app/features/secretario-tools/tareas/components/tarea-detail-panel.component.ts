import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
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
import { ChipListComponent, ChipItem } from '../../../../shared/components/chip-list/chip-list.component';
import { mensajeError } from '../../../../shared/mensaje-error';
import { puedeVerActas } from '../../../../core/auth/acceso-modulos';

type Guardado = 'idle' | 'guardando' | 'guardado' | 'error';

/** Quien puede abrir actas (acta_router.ROLES) gestiona también las tareas que salen de ellas. */
const ROLES_ACTAS = ['administrador', 'secretario', 'anciano'];

/**
 * Detalle de una tarea. Cada campo se guarda al cambiarlo (sin modo "Editar").
 * Quién puede qué lo decide el backend; aquí solo se refleja:
 *  - creador: todo (título, descripción, asignados, fecha, prioridad, pasos, borrar).
 *  - asignados (puede haber varios): estado y marcar pasos. Si uno la completa,
 *    queda completada para todos.
 */
@Component({
  selector: 'app-tarea-detail-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, EmptyStateComponent, SelectPickerComponent, DatePickerComponent, ConfirmDialogComponent, ChipListComponent],
  template: `
  <div class="panel" [class.panel--drawer]="modoDrawer">

    @if (modoDrawer) {
      <header class="cab">
        <div class="cab-izq">
          <span class="cab-etiqueta">Tarea</span>
          @if (tarea(); as t) {
            @if (t.origen_tipo === 'acta_reunion' && t.origen_id && verActas) {
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
        <div class="skeleton h-7 w-4/5 rounded-lg"></div>
        <div class="skeleton h-4 w-1/2 rounded mt-3"></div>
        <div class="mt-8 space-y-4">
          @for (i of [1,2,3,4]; track i) { <div class="skeleton h-10 rounded-lg"></div> }
        </div>
      </div>
    } @else if (error()) {
      <div class="cuerpo">
        <app-empty-state variant="error" title="No se pudo abrir la tarea" [description]="error() ?? ''"
          actionLabel="Volver" (action)="cerrar.emit()"></app-empty-state>
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

          <div class="prop" [class.prop--arriba]="puedeEditar()">
            <dt>Asignada a</dt>
            <dd class="asignados">
              @if (puedeEditar()) {
                <app-chip-list [items]="chipsAsignados()" [disabled]="guardado() === 'guardando'"
                  ariaLabel="Personas asignadas" (remove)="quitarAsignado(+$event)"/>
                <!-- Desactivado mientras se guarda: cada cambio manda la lista entera y dos en vuelo podían pisarse. -->
                <app-select-picker [options]="opcionesAsignado()" [resetOnSelect]="true" (picked)="anadirAsignado($any($event))"
                  [disabled]="guardado() === 'guardando'" [clearable]="false" [searchable]="true" colorScheme="rose"
                  [placeholder]="asignadosDe(t).length ? 'Añadir otra persona' : 'Sin asignar'"
                  [ariaLabel]="asignadosDe(t).length ? 'Añadir otra persona' : 'Asignada a'"
                  (click)="cargarAsignables()"/>
              } @else {
                @if (asignadosDe(t).length) {
                  <ul class="fichas">
                    @for (a of asignadosDe(t); track a.id_usuario) {
                      <li class="ficha" [class.ficha--yo]="a.id_usuario === miId">
                        <span class="ficha-av" aria-hidden="true">{{ inicial(a.nombre) }}</span>{{ a.id_usuario === miId ? 'Tú' : a.nombre }}
                      </li>
                    }
                  </ul>
                } @else {
                  <span class="valor valor--vacio">Sin asignar</span>
                }
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
              @if (vencimiento(t); as v) {
                <span class="vence" [attr.data-tono]="v.tono">{{ v.texto }}</span>
              }
            </dd>
          </div>

          <div class="prop">
            <dt>Prioridad</dt>
            <dd>
              @if (puedeEditar()) {
                <div class="segmented w-full" role="radiogroup" aria-label="Prioridad">
                  @for (p of prioridades; track p.value) {
                    <button type="button" role="radio" class="segmented-item flex-1" [attr.aria-checked]="t.prioridad === p.value"
                      [attr.data-prio]="p.value"
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
            <div class="desc-texto">
              @for (p of parrafos(t.descripcion); track $index) { <p>{{ p }}</p> }
            </div>
          } @else {
            <p class="valor--vacio text-sm">Sin descripción.</p>
          }
        </section>

        <!-- Pasos -->
        @if ((t.subtareas?.length ?? 0) > 0 || puedeAnadirPasos()) {
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
                  @if (puedeQuitarPaso(s)) {
                    <button type="button" class="paso-quitar" (click)="eliminarSubtarea(s)" [disabled]="subOcupadas().has(s.id_subtarea)"
                      [attr.aria-label]="'Quitar paso: ' + s.titulo">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-width="2.2" d="M6 6l12 12M18 6L6 18"/></svg>
                    </button>
                  }
                </li>
              }
            </ul>
            @if (puedeAnadirPasos()) {
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
          <p class="nota">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16v-4m0-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span>Solo quien creó la tarea puede cambiar sus datos. Tú puedes actualizar el estado y marcar los pasos.</span>
          </p>
        }
      </div>

      <!-- Acción principal, al alcance del pulgar -->
      <footer class="pie">
        @if (puedeEditar()) {
          <button type="button" class="btn-borrar" (click)="confirmandoEliminar.set(true)" aria-label="Eliminar tarea" title="Eliminar tarea">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16M10 3h4a1 1 0 011 1v3H9V4a1 1 0 011-1z"/></svg>
          </button>
        }
        @if (t.estado === 'cancelada' && !puedeEditar()) {
          <!-- Solo quien la creó puede reabrir una tarea que canceló (el servidor también lo exige). -->
          <p class="flex-1 text-sm text-slate-500 dark:text-slate-400">La canceló quien la creó.</p>
        } @else if (t.estado === 'completada' || t.estado === 'cancelada') {
          <button type="button" class="btn-secondary flex-1" [disabled]="guardado() === 'guardando'" (click)="cambiarEstado('pendiente')">Reabrir tarea</button>
        } @else {
          @if (t.estado === 'pendiente') {
            <button type="button" class="btn-secondary" [disabled]="guardado() === 'guardando'" (click)="cambiarEstado('en_progreso')">Empezar</button>
          }
          <button type="button" class="btn-hecho flex-1" [disabled]="guardado() === 'guardando'" (click)="cambiarEstado('completada')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
            <span class="sm:hidden">Completar</span><span class="hidden sm:inline">Marcar como completada</span>
          </button>
        }
      </footer>

      <app-confirm-dialog [open]="confirmandoEliminar()" (openChange)="confirmandoEliminar.set($event)"
        title="¿Eliminar esta tarea?"
        [message]="mensajeEliminar(t)"
        confirmLabel="Eliminar tarea" severity="danger" (confirmed)="eliminar()"/>
    }
  </div>
  `,
  styles: [`
    :host { display: block; height: 100%; --ease: cubic-bezier(0.23, 1, 0.32, 1); }
    .panel { display: flex; flex-direction: column; min-height: 100%; flex: 1; background: #fff; color: rgb(17 24 39); }
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
    :host-context(.dark) .btn-icono:hover { background: rgb(15 23 42); color: #fff; }

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
    :host-context(.dark) .titulo--editable:hover { background: rgb(15 23 42); }
    :host-context(.dark) .titulo--editable:focus { background: rgb(15 23 42); border-color: rgb(159 18 57); }
    .linea-meta { margin-top: 6px; font-size: 13px; color: rgb(107 114 128); }
    .hecha { color: rgb(5 150 105); }
    :host-context(.dark) .linea-meta { color: rgb(148 163 184); }

    /* Propiedades */
    .props { margin: 18px 0 0; padding: 2px 16px; display: flex; flex-direction: column; border: 1px solid rgb(229 231 235); border-radius: 14px; background: rgb(249 250 251 / 0.6); }
    :host-context(.dark) .props { border-color: rgb(30 41 59); background: rgb(30 41 59 / 0.35); }
    .prop { display: grid; grid-template-columns: 112px 1fr; align-items: center; gap: 12px; min-height: 52px; padding: 6px 0; }
    .prop + .prop { border-top: 1px solid rgb(229 231 235); }
    :host-context(.dark) .prop + .prop { border-color: rgb(30 41 59 / 0.7); }
    .prop dd > app-select-picker, .prop dd > app-date-picker { display: block; max-width: 260px; }
    .prop dt { font-size: 13px; font-weight: 500; color: rgb(107 114 128); }
    .prop dd { margin: 0; min-width: 0; }
    :host-context(.dark) .prop dt { color: rgb(148 163 184); }
    @media (max-width: 380px) { .prop { grid-template-columns: 1fr; gap: 4px; padding: 6px 0; } }
    .valor { display: inline-flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
    .valor--vacio { color: rgb(156 163 175); font-weight: 500; }
    .vence { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; background: rgb(243 244 246); color: rgb(75 85 99); }
    .vence[data-tono="mal"] { background: rgb(254 226 226); color: rgb(185 28 28); }
    .vence[data-tono="aviso"] { background: rgb(254 243 199); color: rgb(146 64 14); }
    :host-context(.dark) .vence { background: rgb(51 65 85); color: rgb(203 213 225); }
    :host-context(.dark) .vence[data-tono="mal"] { background: rgb(127 29 29 / 0.4); color: rgb(252 165 165); }
    :host-context(.dark) .vence[data-tono="aviso"] { background: rgb(120 53 15 / 0.45); color: rgb(252 211 77); }

    .fichas { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .ficha { display: inline-flex; align-items: center; gap: 8px; padding: 3px 12px 3px 3px; border-radius: 999px; font-size: 13px; font-weight: 600; background: #fff; border: 1px solid rgb(229 231 235); }
    .ficha-av { width: 24px; height: 24px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; background: rgb(226 232 240); color: rgb(51 65 85); }
    .ficha--yo .ficha-av { background: rgb(255 228 230); color: rgb(190 18 60); }
    :host-context(.dark) .ficha { background: rgb(15 23 42); border-color: rgb(30 41 59); }
    :host-context(.dark) .ficha-av { background: rgb(51 65 85); color: rgb(226 232 240); }
    :host-context(.dark) .ficha--yo .ficha-av { background: rgb(136 19 55 / 0.5); color: rgb(253 164 175); }

    /* Asignados: una ficha por persona y el selector para añadir otra */
    .prop--arriba { align-items: start; }
    .prop--arriba dt { padding-top: 10px; }
    .asignados { display: flex; flex-direction: column; gap: 8px; }
    .asignados app-chip-list { padding-top: 4px; }

    .punto { width: 8px; height: 8px; border-radius: 999px; background: rgb(156 163 175); flex-shrink: 0; }
    [data-prio="alta"] .punto, .punto[data-prio="alta"] { background: rgb(239 68 68); }
    [data-prio="media"] .punto, .punto[data-prio="media"] { background: rgb(245 158 11); }

    /* Secciones */
    .seccion { margin-top: 20px; }
    .seccion-titulo { font-family: var(--font-display); font-size: 14px; font-weight: 700; color: rgb(55 65 81); margin: 0 0 8px; }
    :host-context(.dark) .seccion-titulo { color: rgb(203 213 225); }
    .desc {
      width: 100%; min-height: 84px; padding: 10px 12px; font-size: 14px; line-height: 1.55; resize: none; overflow: hidden; field-sizing: content;
      color: inherit; background: rgb(249 250 251); border: 1px solid rgb(229 231 235); border-radius: 12px;
      transition: border-color 150ms ease, box-shadow 150ms ease, background-color 150ms ease;
    }
    .desc:focus { outline: none; background: #fff; border-color: rgb(253 164 175); box-shadow: 0 0 0 4px rgb(244 63 94 / 0.1); }
    :host-context(.dark) .desc { background: rgb(15 23 42); border-color: rgb(30 41 59); }
    :host-context(.dark) .desc:focus { border-color: rgb(159 18 57); }
    .desc::placeholder { color: rgb(156 163 175); }
    .desc-texto { font-size: 14px; line-height: 1.6; color: rgb(55 65 81); max-width: 65ch; }
    .desc-texto p { margin: 0 0 10px; white-space: pre-line; overflow-wrap: anywhere; }
    .desc-texto p:last-child { margin-bottom: 0; }
    :host-context(.dark) .desc-texto { color: rgb(203 213 225); }

    /* Pasos */
    .pasos-num { font-size: 12px; font-weight: 600; color: rgb(107 114 128); font-variant-numeric: tabular-nums; margin-bottom: 8px; }
    .barra { flex: 1; max-width: 140px; height: 4px; border-radius: 999px; background: rgb(229 231 235); overflow: hidden; margin-bottom: 8px; }
    :host-context(.dark) .barra { background: rgb(51 65 85); }
    .barra-relleno { display: block; height: 100%; background: rgb(16 185 129); border-radius: 999px; transform-origin: left; transition: transform 320ms var(--ease); }
    .pasos { list-style: none; margin: 0; padding: 0; }
    .paso { display: flex; align-items: center; gap: 4px; border-radius: 10px; margin: 0 -8px; padding: 0 8px; }
    @media (hover: hover) { .paso:hover { background: rgb(249 250 251); } :host-context(.dark) .paso:hover { background: rgb(15 23 42); } }
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
    :host-context(.dark) .paso-nuevo:focus-within { background: rgb(15 23 42); }
    .paso-nuevo-ok { font-size: 13px; font-weight: 700; color: rgb(225 29 72); padding: 6px 8px; border-radius: 6px; }

    .nota { display: flex; gap: 10px; align-items: flex-start; margin-top: 20px; padding: 12px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; color: rgb(75 85 99); background: rgb(243 244 246 / 0.7); }
    .nota svg { width: 18px; height: 18px; flex-shrink: 0; margin-top: 1px; color: rgb(156 163 175); }
    :host-context(.dark) .nota { color: rgb(148 163 184); background: rgb(30 41 59 / 0.6); }

    /* Pie */
    .pie {
      display: flex; align-items: center; gap: 8px; flex-shrink: 0;
      position: sticky; bottom: 0; z-index: 2;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid rgb(243 244 246); background: inherit;
    }
    @media (min-width: 640px) { .pie { padding: 14px 28px; } }
    :host-context(.dark) .pie { border-color: rgb(30 41 59); }
    .btn-hecho {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; padding: 0 16px;
      border-radius: 12px; font-size: 14px; font-weight: 600;
      transition: background-color 160ms ease, border-color 160ms ease, transform 160ms var(--ease);
    }
    .btn-hecho:active:not(:disabled), .btn-borrar:active { transform: scale(0.97); }
    .btn-hecho:disabled { opacity: 0.6; }
    .btn-hecho { background: rgb(5 150 105); color: #fff; }
    .btn-hecho:hover:not(:disabled) { background: rgb(4 120 87); }
    .btn-hecho svg { width: 16px; height: 16px; }
    .btn-borrar { width: 44px; height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-radius: 12px; color: rgb(156 163 175); transition: color 150ms ease, background-color 150ms ease, transform 160ms var(--ease); }
    .btn-borrar svg { width: 18px; height: 18px; }
    .btn-borrar:hover { color: rgb(220 38 38); background: rgb(254 242 242); }
    :host-context(.dark) .btn-borrar:hover { background: rgb(127 29 29 / 0.3); color: rgb(252 165 165); }

    .btn-hecho:focus-visible, .btn-borrar:focus-visible, .btn-icono:focus-visible, .paso-quitar:focus-visible, .enlace:focus-visible {
      outline: 2px solid rgb(244 63 94); outline-offset: 2px;
    }

    /* Vacío / esqueleto */

    @media (prefers-reduced-motion: reduce) {
      .barra-relleno, .caja { transition: none; }
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
  /** El enlace al acta solo a quien puede abrirla (si no, actasGuard lo devuelve al inicio). */
  readonly verActas = puedeVerActas(this.store);
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
    if (t.creado_por === yo || (t.creado_por == null && this.asignadosDe(t).some(a => a.id_usuario === yo))) return true;
    const rol = (this.store.user()?.rol ?? '').toLowerCase();
    return t.origen_tipo === 'acta_reunion' && ROLES_ACTAS.includes(rol);
  });

  /** El asignado también añade pasos (los suyos); el resto de la tarea sigue siendo de quien la creó. */
  puedeAnadirPasos = computed(() => {
    const t = this.tarea();
    if (!t) return false;
    return this.puedeEditar() || this.asignadosDe(t).some(a => a.id_usuario === this.miId);
  });

  /** Quitar un paso: quien edita la tarea, o el asignado si ese paso lo añadió él. */
  puedeQuitarPaso(s: { creado_por?: number | null }): boolean {
    return this.puedeEditar() || (s.creado_por != null && s.creado_por === this.miId && this.puedeAnadirPasos());
  }

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

  /** Quienes aún no están asignados (los que ya lo están se ven como fichas). */
  opcionesAsignado = computed<PickerOption[]>(() => {
    const yo = this.miId;
    const t = this.tarea();
    const ya = new Set(t ? this.asignadosDe(t).map(a => a.id_usuario) : []);
    const lista = this.usuarios();
    const ops: PickerOption[] = [];
    if (yo != null && !ya.has(yo)) ops.push({ value: yo, label: 'Mí', hint: lista.find(u => u.id_usuario === yo)?.nombre });
    for (const u of lista) if (u.id_usuario !== yo && !ya.has(u.id_usuario)) ops.push({ value: u.id_usuario, label: u.nombre });
    return ops;
  });

  chipsAsignados = computed<ChipItem[]>(() => {
    const t = this.tarea();
    return t ? this.asignadosDe(t).map(a => ({ id: a.id_usuario, label: a.id_usuario === this.miId ? 'Mí' : a.nombre })) : [];
  });

  /** Asignados de la tarea; las respuestas sin la lista (caché antigua) traen solo `asignado_a`. */
  asignadosDe(t: Tarea): UsuarioAsignable[] {
    if (t.asignados?.length) return t.asignados;
    return t.asignado_a ? [{ id_usuario: t.asignado_a, nombre: t.asignado_a_nombre ?? 'Asignado' }] : [];
  }

  inicial(nombre: string): string {
    return (nombre.trim()[0] ?? '?').toUpperCase();
  }

  /** La descripción en párrafos: un salto simple queda como salto de línea, una línea en blanco separa párrafos. */
  parrafos(texto: string): string[] {
    return texto.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  }

  /** Aviso de plazo solo cuando importa: vencida o a una semana; nada si la tarea ya terminó. */
  vencimiento(t: Tarea): { texto: string; tono: 'mal' | 'aviso' | 'neutro' } | null {
    if (!t.fecha_limite || t.estado === 'completada' || t.estado === 'cancelada') return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const dias = Math.round((new Date(t.fecha_limite + 'T00:00:00').getTime() - hoy.getTime()) / 86400000);
    if (dias < 0) return { texto: dias === -1 ? 'Venció ayer' : `Venció hace ${-dias} días`, tono: 'mal' };
    if (dias === 0) return { texto: 'Vence hoy', tono: 'aviso' };
    if (dias === 1) return { texto: 'Vence mañana', tono: 'aviso' };
    if (dias <= 7) return { texto: `Vence en ${dias} días`, tono: 'neutro' };
    return null;
  }

  mensajeEliminar(t: Tarea): string {
    const otros = this.asignadosDe(t).filter(a => a.id_usuario !== this.miId).map(a => a.nombre);
    const aviso = !otros.length ? ''
      : otros.length === 1 ? ` ${otros[0]} dejará de verla.`
      : ` ${otros.slice(0, -1).join(', ')} y ${otros[otros.length - 1]} dejarán de verla.`;
    return `Se borrará «${t.titulo}» con sus pasos.${aviso} No se puede deshacer.`;
  }

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

  /** `local` se pinta al instante pero no se envía (p. ej. los nombres de los asignados). */
  /** Guardados en curso: van en fila, uno detrás de otro, para que lleguen en orden. */
  private colaGuardado: Promise<void> = Promise.resolve();
  private guardadosPendientes = 0;

  guardarCampo(patch: Partial<Tarea>, local: Partial<Tarea> = {}) {
    const t = this.tarea();
    if (!t) return;
    // Solo los campos que cambia este guardado: si falla, se devuelven esos y no se pisa
    // otro cambio que sí se guardó (antes se restauraba la tarea entera).
    const claves = [...new Set([...Object.keys(patch), ...Object.keys(local)])] as (keyof Tarea)[];
    const antes = Object.fromEntries(claves.map(k => [k, t[k]])) as Partial<Tarea>;
    this.tarea.set({ ...t, ...patch, ...local });
    this.marcarGuardado('guardando');
    this.guardadosPendientes++;
    this.colaGuardado = this.colaGuardado.then(() => new Promise<void>(listo => {
      this.svc.updateTarea(t.id_tarea, patch).subscribe({
        next: (u) => {
          // Con otro guardado detrás, lo local ya va por delante de esta respuesta.
          if (--this.guardadosPendientes === 0) { this.aplicar(u); this.marcarGuardado('guardado'); }
          listo();
        },
        error: (err) => {
          this.guardadosPendientes--;
          const actual = this.tarea();
          if (actual) this.aplicar({ ...actual, ...antes } as Tarea, false);
          this.marcarGuardado('error');
          this.mostrarError(mensajeError(err, 'No se pudo guardar el cambio. Inténtalo de nuevo.'));
          listo();
        },
      });
    }));
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

  anadirAsignado(id: number | null) {
    const t = this.tarea();
    if (!t || id == null) return;
    const actuales = this.asignadosDe(t);
    if (actuales.some(a => a.id_usuario === id)) return;
    const u = this.usuarios().find(x => x.id_usuario === id);
    this.fijarAsignados([...actuales, { id_usuario: id, nombre: u?.nombre ?? 'Asignado' }]);
  }

  quitarAsignado(id: number) {
    const t = this.tarea();
    if (!t) return;
    this.fijarAsignados(this.asignadosDe(t).filter(a => a.id_usuario !== id));
  }

  private fijarAsignados(lista: UsuarioAsignable[]) {
    this.guardarCampo(
      { asignados_ids: lista.map(a => a.id_usuario) },
      { asignados: lista, asignado_a: lista[0]?.id_usuario ?? null, asignado_a_nombre: lista[0]?.nombre ?? null },
    );
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
        this.mostrarError(mensajeError(err, 'No se pudo cambiar el estado.'));
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
      error: (err) => this.mostrarError(mensajeError(err, 'No se pudo eliminar la tarea.')),
    });
  }

  irAActa(actaId: number) {
    this.router.navigate(['/administracion/actas-reunion', actaId]);
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
