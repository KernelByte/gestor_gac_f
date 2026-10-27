import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { AgendaService } from '../../services/agenda.service';
import { Recordatorio, RecordatorioForm, Sugerencia } from '../../models/agenda.model';
import { avisoCorto, fechaLarga, frecuenciaCorta, textoFrecuencia } from '../agenda-fechas';

const INTERVALOS = [
  { valor: 1, label: 'Cada mes' },
  { valor: 2, label: 'Cada 2 meses' },
  { valor: 3, label: 'Cada 3 meses' },
  { valor: 4, label: 'Cada 4 meses' },
  { valor: 6, label: 'Cada 6 meses' },
  { valor: 12, label: 'Cada año' },
];

const AVISOS = [
  { valor: 0, label: 'El mismo día' },
  { valor: 1, label: '1 día antes' },
  { valor: 2, label: '2 días antes' },
  { valor: 3, label: '3 días antes' },
  { valor: 7, label: '1 semana antes' },
  { valor: 14, label: '2 semanas antes' },
];

type Pestana = 'mios' | 'sugerencias';

function vacio(): RecordatorioForm {
  return {
    titulo: '', descripcion: null, enlace: null, frecuencia: 'periodica',
    intervalo_meses: 1, fecha_inicio: '', dias_aviso: 1, activo: true,
  };
}

/**
 * Recordatorios periódicos del secretario.
 *
 * Tres vistas dentro de la misma ventana, cada una con su pie de acciones:
 *   - "Mis recordatorios": lo ya configurado, con editar y borrar (con deshacer);
 *   - "Sugerencias": tarjetas para agregar de un clic (consulta de inhabilidades, S-88…);
 *   - formulario de alta o edición.
 * Si todavía no hay ninguno, abre directo en Sugerencias.
 */
@Component({
  selector: 'app-recordatorios-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, DatePickerComponent],
  template: `
    <app-modal [open]="open" (openChange)="cerrar()" size="2xl" [hasFooter]="true"
               [title]="editando() === null ? 'Recordatorios periódicos' : (editando() === 'nuevo' ? 'Nuevo recordatorio' : 'Editar recordatorio')"
               [subtitle]="editando() === null ? 'Lo que debe hacer cada cierto tiempo. Le avisamos por la campana y en el celular, a las 7 de la mañana.' : ''">

      @if (editando() === null) {
        <!-- ── Pestañas ── -->
        <div class="pestanas" role="tablist" aria-label="Recordatorios">
          <button type="button" role="tab" class="pestana" [class.pestana--on]="pestana() === 'mios'"
                  [attr.aria-selected]="pestana() === 'mios'" (click)="pestana.set('mios')">
            Mis recordatorios
            <span class="pestana-n">{{ lista().length }}</span>
          </button>
          <button type="button" role="tab" class="pestana" [class.pestana--on]="pestana() === 'sugerencias'"
                  [attr.aria-selected]="pestana() === 'sugerencias'" (click)="pestana.set('sugerencias')">
            Sugerencias
            @if (sugerenciasPendientes().length) { <span class="pestana-n pestana-n--nuevo">{{ sugerenciasPendientes().length }}</span> }
          </button>
        </div>

        @if (pestana() === 'mios') {
          <div class="panel">
            @if (porBorrar(); as pb) {
              <div class="deshacer" role="status">
                <p class="flex-1 min-w-0 truncate"><span class="font-semibold">«{{ pb.titulo }}»</span> borrado</p>
                <button type="button" class="deshacer-btn" (click)="deshacerBorrado()">Deshacer</button>
              </div>
            }

            @if (cargando()) {
              <div class="grid sm:grid-cols-2 gap-2.5">
                <div class="skeleton h-24 rounded-xl"></div><div class="skeleton h-24 rounded-xl"></div>
              </div>
            } @else if (!lista().length) {
              <div class="vacio">
                <span class="vacio-icono" aria-hidden="true">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"/></svg>
                </span>
                <p class="vacio-titulo">Todavía no tiene recordatorios</p>
                <p class="vacio-texto">Empiece con las sugerencias o cree uno propio.</p>
                <div class="flex flex-wrap justify-center gap-2 mt-3">
                  @if (sugerenciasPendientes().length) {
                    <button type="button" class="btn-pri" (click)="pestana.set('sugerencias')">Ver sugerencias</button>
                  }
                  <button type="button" class="btn-sec" (click)="nuevo()">Crear uno</button>
                </div>
              </div>
            } @else {
              <ul class="grid sm:grid-cols-2 gap-2.5">
                @for (r of lista(); track r.id_recordatorio) {
                  <li class="tarjeta" [class.tarjeta--pausa]="!r.activo">
                    <div class="flex items-start gap-2">
                      <h3 class="tarjeta-titulo flex-1 min-w-0">{{ r.titulo }}</h3>
                      <div class="flex shrink-0 -mr-1.5 -mt-1">
                        <button type="button" class="icono-btn" (click)="editar(r)" [attr.aria-label]="'Editar ' + r.titulo" title="Editar">
                          <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m16.86 4.49 2.65 2.65M4 20l3.6-.8 11.1-11.1a1.87 1.87 0 0 0-2.65-2.65L4.95 16.55 4 20Z"/></svg>
                        </button>
                        <button type="button" class="icono-btn icono-btn--peligro" (click)="borrar(r)" [attr.aria-label]="'Borrar ' + r.titulo" title="Borrar">
                          <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>
                        </button>
                      </div>
                    </div>
                    <p class="meta">{{ frecuenciaCorta(r) }} · {{ avisoCorto(r.dias_aviso).toLowerCase() }}</p>
                    <p class="proxima" [class.proxima--pausa]="!r.activo">
                      @if (!r.activo) { Pausado }
                      @else if (r.proxima) { Próxima: <strong>{{ larga(r.proxima) }}</strong> }
                      @else { Ya no tiene fechas pendientes }
                    </p>
                  </li>
                }
              </ul>
            }
          </div>
        } @else {
          <div class="panel">
            @if (!sugerenciasPendientes().length) {
              <div class="vacio">
                <span class="vacio-icono vacio-icono--ok" aria-hidden="true">
                  <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7"/></svg>
                </span>
                <p class="vacio-titulo">Ya agregó todas las sugerencias</p>
                <p class="vacio-texto">Puede editarlas en «Mis recordatorios».</p>
              </div>
            } @else {
              <div class="flex items-center justify-between gap-3 mb-2.5">
                <p class="text-sm text-slate-600 dark:text-slate-300">Marque las que quiera. Después puede cambiar la fecha o borrarlas.</p>
                <button type="button" class="enlace-btn shrink-0" (click)="alternarTodas()">
                  {{ todasElegidas() ? 'Quitar todas' : 'Marcar todas' }}
                </button>
              </div>
              <ul class="grid sm:grid-cols-2 gap-2.5">
                @for (s of sugerenciasPendientes(); track s.clave) {
                  <li>
                    <label class="tarjeta tarjeta--eleg" [class.tarjeta--on]="elegidas().has(s.clave)">
                      <input type="checkbox" class="sr-only" [checked]="elegidas().has(s.clave)" (change)="alternarSugerencia(s.clave)"/>
                      <span class="check" aria-hidden="true">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7"/></svg>
                      </span>
                      <span class="tarjeta-titulo pr-7">{{ s.titulo }}</span>
                      <span class="meta">{{ frecuenciaCorta(s) }} · {{ avisoCorto(s.dias_aviso).toLowerCase() }}</span>
                      @if (s.descripcion) { <span class="descripcion">{{ s.descripcion }}</span> }
                    </label>
                  </li>
                }
              </ul>
            }
          </div>
        }
      } @else {
        <!-- ── Formulario ── -->
        <form class="panel grid gap-4" (submit)="$event.preventDefault(); guardar()" novalidate>
          <div>
            <label class="etiqueta" for="rec-titulo">¿Qué hay que hacer?</label>
            <input id="rec-titulo" name="titulo" class="campo" maxlength="255" [(ngModel)]="form.titulo"
                   placeholder="Ej. Consultar inhabilidades de los ancianos"
                   [class.campo--error]="intentado() && !form.titulo.trim()"/>
            @if (intentado() && !form.titulo.trim()) { <p class="error" role="alert">Escriba qué hay que hacer.</p> }
          </div>

          <div>
            <span class="etiqueta" id="lbl-repite">¿Se repite?</span>
            <div class="segmento" role="radiogroup" aria-labelledby="lbl-repite">
              <button type="button" role="radio" class="segmento-op" [class.segmento-op--on]="form.frecuencia === 'periodica'"
                      [attr.aria-checked]="form.frecuencia === 'periodica'" (click)="form.frecuencia = 'periodica'">Sí, cada cierto tiempo</button>
              <button type="button" role="radio" class="segmento-op" [class.segmento-op--on]="form.frecuencia === 'unica'"
                      [attr.aria-checked]="form.frecuencia === 'unica'" (click)="form.frecuencia = 'unica'">No, una sola vez</button>
            </div>
          </div>

          <div class="grid gap-4" [ngClass]="form.frecuencia === 'periodica' ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
            @if (form.frecuencia === 'periodica') {
              <div>
                <label class="etiqueta" for="rec-intervalo">¿Cada cuánto?</label>
                <select id="rec-intervalo" name="intervalo" class="campo campo--select" [(ngModel)]="form.intervalo_meses">
                  @for (o of intervalos; track o.valor) { <option [ngValue]="o.valor">{{ o.label }}</option> }
                </select>
              </div>
            }
            <div>
              <span class="etiqueta">{{ form.frecuencia === 'periodica' ? 'Primera fecha' : 'Fecha' }}</span>
              <app-date-picker name="fecha" [(ngModel)]="form.fecha_inicio" [fieldLike]="true" colorScheme="violet" placeholder="Elegir fecha"/>
              @if (intentado() && !form.fecha_inicio) { <p class="error" role="alert">Elija la fecha.</p> }
            </div>
            <div>
              <label class="etiqueta" for="rec-aviso">¿Cuándo avisarle?</label>
              <select id="rec-aviso" name="aviso" class="campo campo--select" [(ngModel)]="form.dias_aviso">
                @for (o of avisos; track o.valor) { <option [ngValue]="o.valor">{{ o.label }}</option> }
              </select>
            </div>
          </div>

          @if (form.fecha_inicio) {
            <p class="resumen">
              <svg class="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6l4 2m6-2a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z"/></svg>
              <span>{{ frecuencia(form) }} A las 7 de la mañana.</span>
            </p>
          }

          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label class="etiqueta" for="rec-desc">Notas <span class="opcional">· opcional</span></label>
              <textarea id="rec-desc" name="descripcion" rows="3" class="campo resize-y" [(ngModel)]="form.descripcion"
                        placeholder="Pasos, a quién llamar, qué revisar…"></textarea>
            </div>
            <div>
              <label class="etiqueta" for="rec-enlace">Página web <span class="opcional">· opcional</span></label>
              <input id="rec-enlace" name="enlace" type="url" class="campo" maxlength="500" [(ngModel)]="form.enlace" placeholder="https://…"/>
              @if (editando() !== 'nuevo') {
                <label class="interruptor mt-4">
                  <input type="checkbox" name="activo" class="sr-only" [(ngModel)]="form.activo"/>
                  <span class="interruptor-pista" aria-hidden="true"><span class="interruptor-bola"></span></span>
                  <span class="text-sm text-slate-700 dark:text-slate-200">Activo <span class="opcional">· si lo apaga, deja de salir en la agenda</span></span>
                </label>
              }
            </div>
          </div>
        </form>
      }

      <ng-container slot="footer">
        @if (editando() !== null) {
          <button type="button" class="btn-sec flex-1 sm:flex-none" (click)="volver()">Volver</button>
          <button type="button" class="btn-pri flex-1 sm:flex-none justify-center" [disabled]="guardando()" (click)="guardar()">
            {{ guardando() ? 'Guardando…' : 'Guardar' }}
          </button>
        } @else if (pestana() === 'sugerencias' && sugerenciasPendientes().length) {
          <button type="button" class="btn-sec flex-1 sm:flex-none" (click)="cerrar()">Cerrar</button>
          <button type="button" class="btn-pri flex-1 sm:flex-none justify-center" [disabled]="!elegidas().size || guardando()" (click)="aplicarSugerencias()">
            {{ guardando() ? 'Agregando…' : elegidas().size ? 'Agregar ' + elegidas().size + (elegidas().size === 1 ? ' recordatorio' : ' recordatorios') : 'Marque al menos uno' }}
          </button>
        } @else {
          <button type="button" class="btn-sec flex-1 sm:flex-none" (click)="cerrar()">Cerrar</button>
          <button type="button" class="btn-pri flex-1 sm:flex-none justify-center" (click)="nuevo()">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path stroke-linecap="round" d="M12 5v14m-7-7h14"/></svg>
            Nuevo recordatorio
          </button>
        }
      </ng-container>
    </app-modal>
  `,
  styles: [`
    /* La fuente de la app (Manrope) también en controles: los navegadores no la heredan en botones, campos ni selects. */
    :host { --ease: var(--ease-out-strong, cubic-bezier(0.23, 1, 0.32, 1)); font-family: var(--font-sans, inherit); }
    :host button, :host input, :host select, :host textarea { font-family: inherit; }

    /* Pestañas */
    .pestanas { display: inline-flex; gap: 2px; padding: 3px; margin-bottom: 14px; border-radius: 12px; background: rgb(241 245 249); }
    :host-context(.dark) .pestanas { background: rgb(15 23 42 / 0.7); }
    .pestana {
      display: inline-flex; align-items: center; gap: 8px; height: 36px; padding: 0 14px; border-radius: 9px;
      font-size: 14px; font-weight: 600; color: rgb(71 85 105);
      transition: background 150ms var(--ease), color 150ms var(--ease), transform 100ms var(--ease);
    }
    .pestana:hover:not(.pestana--on) { color: rgb(15 23 42); }
    .pestana:active { transform: scale(0.97); }
    .pestana--on { background: #fff; color: rgb(15 23 42); box-shadow: 0 1px 2px rgb(15 23 42 / 0.1); }
    :host-context(.dark) .pestana { color: rgb(148 163 184); }
    :host-context(.dark) .pestana:hover:not(.pestana--on) { color: #fff; }
    :host-context(.dark) .pestana--on { background: rgb(51 65 85); color: #fff; box-shadow: none; }
    .pestana-n { min-width: 20px; height: 20px; padding: 0 6px; display: inline-flex; align-items: center; justify-content: center; border-radius: 999px;
      font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; background: rgb(226 232 240); color: rgb(51 65 85); }
    .pestana-n--nuevo { background: rgb(109 40 217); color: #fff; }
    :host-context(.dark) .pestana-n { background: rgb(71 85 105); color: rgb(241 245 249); }
    :host-context(.dark) .pestana-n--nuevo { background: rgb(124 58 237); }

    .panel { animation: entra 200ms var(--ease); }
    @keyframes entra { from { opacity: 0; transform: translateY(4px); } }

    /* Tarjetas (sugerencias y existentes) */
    .tarjeta {
      position: relative; display: flex; flex-direction: column; gap: 4px; height: 100%; padding: 14px 16px; border-radius: 14px;
      background: #fff; border: 1px solid rgb(226 232 240);
      transition: border-color 150ms var(--ease), background 150ms var(--ease), box-shadow 150ms var(--ease), transform 100ms var(--ease);
    }
    :host-context(.dark) .tarjeta { background: rgb(30 41 59 / 0.6); border-color: rgb(51 65 85); }
    .tarjeta--eleg { cursor: pointer; }
    .tarjeta--eleg:hover { border-color: rgb(196 181 253); }
    .tarjeta--eleg:active { transform: scale(0.985); }
    .tarjeta--eleg:has(input:focus-visible) { outline: 2px solid rgb(139 92 246); outline-offset: 2px; }
    .tarjeta--on, .tarjeta--on:hover { border-color: rgb(124 58 237); background: rgb(245 243 255); box-shadow: 0 0 0 1px rgb(124 58 237); }
    :host-context(.dark) .tarjeta--eleg:hover { border-color: rgb(109 40 217); }
    :host-context(.dark) .tarjeta--on, :host-context(.dark) .tarjeta--on:hover { background: rgb(76 29 149 / 0.25); border-color: rgb(139 92 246); box-shadow: 0 0 0 1px rgb(139 92 246); }
    .tarjeta--pausa { opacity: 0.65; }
    .tarjeta-titulo { font-family: var(--font-display, inherit); font-size: 16px; font-weight: 700; line-height: 1.3; color: rgb(15 23 42); }
    :host-context(.dark) .tarjeta-titulo { color: rgb(248 250 252); }
    .meta { font-size: 13px; font-weight: 600; color: rgb(109 40 217); }
    :host-context(.dark) .meta { color: rgb(196 181 253); }
    .descripcion {
      font-size: 13px; line-height: 1.45; color: rgb(71 85 105);
      display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
    }
    :host-context(.dark) .descripcion { color: rgb(148 163 184); }
    .proxima { margin-top: auto; padding-top: 6px; font-size: 13px; color: rgb(71 85 105); }
    .proxima strong { font-weight: 700; color: rgb(15 23 42); }
    :host-context(.dark) .proxima { color: rgb(148 163 184); }
    :host-context(.dark) .proxima strong { color: rgb(241 245 249); }
    .proxima--pausa { font-style: italic; }

    .check {
      position: absolute; top: 14px; right: 14px; width: 22px; height: 22px; border-radius: 7px; display: flex; align-items: center; justify-content: center;
      border: 1.5px solid rgb(148 163 184); color: transparent; background: #fff;
      transition: background 150ms var(--ease), border-color 150ms var(--ease), color 150ms var(--ease), transform 150ms var(--ease);
    }
    :host-context(.dark) .check { background: rgb(15 23 42); border-color: rgb(100 116 139); }
    .tarjeta--on .check { background: rgb(109 40 217); border-color: rgb(109 40 217); color: #fff; transform: scale(1.05); }

    .icono-btn {
      width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 9px; color: rgb(100 116 139);
      transition: background 150ms var(--ease), color 150ms var(--ease), transform 100ms var(--ease);
    }
    .icono-btn:hover { background: rgb(241 245 249); color: rgb(15 23 42); }
    .icono-btn--peligro:hover { background: rgb(254 242 242); color: rgb(185 28 28); }
    .icono-btn:active { transform: scale(0.92); }
    :host-context(.dark) .icono-btn { color: rgb(148 163 184); }
    :host-context(.dark) .icono-btn:hover { background: rgb(51 65 85); color: #fff; }
    :host-context(.dark) .icono-btn--peligro:hover { background: rgb(69 10 10 / 0.6); color: rgb(252 165 165); }

    .enlace-btn { font-size: 14px; font-weight: 600; color: rgb(109 40 217); padding: 4px 8px; border-radius: 8px; transition: background 150ms var(--ease); }
    .enlace-btn:hover { background: rgb(245 243 255); }
    :host-context(.dark) .enlace-btn { color: rgb(196 181 253); }
    :host-context(.dark) .enlace-btn:hover { background: rgb(76 29 149 / 0.3); }

    .deshacer { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; padding: 6px 6px 6px 14px; border-radius: 12px;
      font-size: 14px; background: rgb(15 23 42); color: #fff; animation: entra 200ms var(--ease); }
    :host-context(.dark) .deshacer { background: rgb(51 65 85); }
    .deshacer-btn { height: 32px; padding: 0 12px; border-radius: 8px; font-size: 14px; font-weight: 700; color: rgb(196 181 253); transition: background 150ms var(--ease); }
    .deshacer-btn:hover { background: rgb(255 255 255 / 0.1); }

    .vacio { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 28px 16px; }
    .vacio-icono { width: 48px; height: 48px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: rgb(245 243 255); color: rgb(109 40 217); }
    .vacio-icono--ok { background: rgb(236 253 245); color: rgb(4 120 87); }
    :host-context(.dark) .vacio-icono { background: rgb(76 29 149 / 0.3); color: rgb(196 181 253); }
    :host-context(.dark) .vacio-icono--ok { background: rgb(6 78 59 / 0.4); color: rgb(110 231 183); }
    .vacio-titulo { margin-top: 12px; font-size: 16px; font-weight: 700; color: rgb(15 23 42); }
    :host-context(.dark) .vacio-titulo { color: rgb(248 250 252); }
    .vacio-texto { font-size: 14px; color: rgb(100 116 139); }

    /* Botones */
    .btn-pri, .btn-sec {
      display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 16px; border-radius: 10px; font-size: 14px; font-weight: 600; white-space: nowrap;
      transition: background 150ms var(--ease), border-color 150ms var(--ease), transform 100ms var(--ease);
    }
    .btn-pri { background: var(--color-brand-purple, #6d28d9); color: #fff; box-shadow: 0 1px 2px rgb(109 40 217 / 0.2); }
    .btn-pri:hover:not(:disabled) { background: rgb(91 33 182); }
    .btn-pri:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
    .btn-sec { border: 1px solid rgb(203 213 225); color: rgb(51 65 85); background: #fff; justify-content: center; }
    .btn-sec:hover { background: rgb(248 250 252); border-color: rgb(148 163 184); }
    :host-context(.dark) .btn-sec { background: rgb(30 41 59); border-color: rgb(71 85 105); color: rgb(226 232 240); }
    :host-context(.dark) .btn-sec:hover { background: rgb(51 65 85); }
    .btn-pri:active:not(:disabled), .btn-sec:active { transform: scale(0.97); }

    /* Formulario */
    .etiqueta { display: block; margin-bottom: 6px; font-size: 14px; font-weight: 600; color: rgb(51 65 85); }
    :host-context(.dark) .etiqueta { color: rgb(203 213 225); }
    .opcional { font-weight: 400; color: rgb(100 116 139); }
    .error { margin-top: 6px; font-size: 13px; font-weight: 500; color: rgb(220 38 38); }
    .campo {
      width: 100%; min-height: 44px; padding: 10px 12px; font-size: 15px; line-height: 1.4; border-radius: 12px;
      border: 1px solid rgb(203 213 225); background: #fff; color: rgb(15 23 42);
      transition: border-color 150ms var(--ease), box-shadow 150ms var(--ease);
    }
    .campo::placeholder { color: rgb(148 163 184); }
    .campo:focus { outline: none; border-color: rgb(167 139 250); box-shadow: 0 0 0 4px rgb(139 92 246 / 0.15); }
    .campo--error, .campo--error:focus { border-color: rgb(239 68 68); box-shadow: 0 0 0 4px rgb(239 68 68 / 0.1); }
    .campo--select {
      appearance: none; padding-right: 36px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 12px center; background-size: 16px;
    }
    :host-context(.dark) .campo { background-color: rgb(15 23 42); border-color: rgb(51 65 85); color: rgb(241 245 249); }

    .segmento { display: inline-flex; padding: 3px; gap: 2px; border-radius: 12px; background: rgb(241 245 249); max-width: 100%; }
    :host-context(.dark) .segmento { background: rgb(15 23 42 / 0.7); }
    .segmento-op {
      min-height: 38px; padding: 0 16px; border-radius: 9px; font-size: 14px; font-weight: 600; color: rgb(71 85 105);
      transition: background 150ms var(--ease), color 150ms var(--ease), transform 100ms var(--ease);
    }
    .segmento-op:active { transform: scale(0.97); }
    .segmento-op--on { background: #fff; color: rgb(91 33 182); box-shadow: 0 1px 2px rgb(15 23 42 / 0.1); }
    :host-context(.dark) .segmento-op { color: rgb(148 163 184); }
    :host-context(.dark) .segmento-op--on { background: rgb(76 29 149 / 0.55); color: #fff; box-shadow: none; }

    .resumen { display: flex; gap: 8px; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.45; font-weight: 500;
      color: rgb(91 33 182); background: rgb(245 243 255); }
    :host-context(.dark) .resumen { color: rgb(221 214 254); background: rgb(76 29 149 / 0.25); }

    .interruptor { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; }
    .interruptor-pista { position: relative; width: 40px; height: 24px; border-radius: 999px; flex-shrink: 0; background: rgb(203 213 225); transition: background 150ms var(--ease); }
    .interruptor-bola { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 999px; background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.25); transition: transform 180ms var(--ease); }
    .interruptor input:checked + .interruptor-pista { background: rgb(109 40 217); }
    .interruptor input:checked + .interruptor-pista .interruptor-bola { transform: translateX(16px); }
    .interruptor:has(input:focus-visible) .interruptor-pista { outline: 2px solid rgb(139 92 246); outline-offset: 2px; }
    :host-context(.dark) .interruptor-pista { background: rgb(71 85 105); }

    button:focus-visible { outline: 2px solid rgb(139 92 246); outline-offset: 2px; }

    /* Pantallas táctiles: todo lo que se pulsa mide al menos 44 px. */
    @media (pointer: coarse) {
      .icono-btn { width: 44px; height: 44px; }
      .btn-pri, .btn-sec, .pestana, .segmento-op, .enlace-btn, .deshacer-btn { min-height: 44px; height: auto; }
      .tarjeta--eleg .check { width: 26px; height: 26px; }
    }

    @media (prefers-reduced-motion: reduce) {
      .panel, .deshacer { animation: none; }
      * { transition-duration: 0.01ms !important; }
    }
  `],
})
export class RecordatoriosModalComponent implements OnChanges {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();
  /** Se emite tras cualquier cambio, para que la agenda se recargue. */
  @Output() cambiado = new EventEmitter<void>();

  private svc = inject(AgendaService);
  private toast = inject(ToastService);

  readonly intervalos = INTERVALOS;
  readonly avisos = AVISOS;

  lista = signal<Recordatorio[]>([]);
  sugerenciasPendientes = signal<Sugerencia[]>([]);
  elegidas = signal<Set<string>>(new Set());
  pestana = signal<Pestana>('mios');
  cargando = signal(false);
  guardando = signal(false);
  intentado = signal(false);
  /** null = pestañas; 'nuevo' = alta; número = edición de ese id. */
  editando = signal<null | 'nuevo' | number>(null);
  form: RecordatorioForm = vacio();
  /** Recordatorio ya quitado de la lista que se borra de verdad al pasar unos segundos, salvo que se deshaga. */
  porBorrar = signal<Recordatorio | null>(null);
  private temporizadorBorrado: ReturnType<typeof setTimeout> | null = null;

  frecuencia = textoFrecuencia;
  frecuenciaCorta = frecuenciaCorta;
  avisoCorto = avisoCorto;
  larga = fechaLarga;

  ngOnChanges(ch: SimpleChanges) {
    if (ch['open'] && !ch['open'].currentValue) this.confirmarBorrado();
    if (ch['open']?.currentValue && !ch['open'].previousValue) {
      this.editando.set(null);
      this.cargar(true);
    }
  }

  /** `inicial`: al abrir, si no hay nada configurado y sí sugerencias, se abre en Sugerencias. */
  private cargar(inicial = false) {
    this.cargando.set(true);
    forkJoin({ lista: this.svc.recordatorios(), sug: this.svc.sugerencias() }).subscribe({
      next: ({ lista, sug }) => {
        const pendientes = sug.filter(x => !x.ya_agregada);
        this.lista.set(lista);
        this.sugerenciasPendientes.set(pendientes);
        this.elegidas.set(new Set(pendientes.map(x => x.clave)));
        if (inicial) this.pestana.set(!lista.length && pendientes.length ? 'sugerencias' : 'mios');
        this.cargando.set(false);
      },
      error: () => { this.cargando.set(false); this.toast.error('No se pudieron cargar los recordatorios'); },
    });
  }

  alternarSugerencia(clave: string) {
    const s = new Set(this.elegidas());
    s.has(clave) ? s.delete(clave) : s.add(clave);
    this.elegidas.set(s);
  }

  todasElegidas(): boolean {
    const p = this.sugerenciasPendientes();
    return p.length > 0 && p.every(x => this.elegidas().has(x.clave));
  }

  alternarTodas() {
    this.elegidas.set(this.todasElegidas() ? new Set() : new Set(this.sugerenciasPendientes().map(x => x.clave)));
  }

  aplicarSugerencias() {
    this.guardando.set(true);
    this.svc.aplicarSugerencias([...this.elegidas()]).subscribe({
      next: nuevos => {
        this.guardando.set(false);
        this.toast.success(nuevos.length === 1 ? 'Recordatorio agregado' : `${nuevos.length} recordatorios agregados`);
        this.pestana.set('mios');
        this.cargar();
        this.cambiado.emit();
      },
      error: () => { this.guardando.set(false); this.toast.error('No se pudieron agregar'); },
    });
  }

  nuevo() {
    this.form = vacio();
    this.intentado.set(false);
    this.editando.set('nuevo');
  }

  editar(r: Recordatorio) {
    const { titulo, descripcion, enlace, frecuencia, intervalo_meses, fecha_inicio, dias_aviso, activo } = r;
    this.form = { titulo, descripcion, enlace, frecuencia, intervalo_meses, fecha_inicio, dias_aviso, activo };
    this.intentado.set(false);
    this.editando.set(r.id_recordatorio);
  }

  volver() {
    this.editando.set(null);
  }

  guardar() {
    this.intentado.set(true);
    if (!this.form.titulo.trim() || !this.form.fecha_inicio) return;
    const datos: RecordatorioForm = {
      ...this.form,
      descripcion: this.form.descripcion?.trim() || null,
      enlace: this.form.enlace?.trim() || null,
    };
    const id = this.editando();
    const peticion = id === 'nuevo' ? this.svc.crear(datos) : this.svc.actualizar(id as number, datos);
    this.guardando.set(true);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.toast.success('Recordatorio guardado');
        this.editando.set(null);
        this.pestana.set('mios');
        this.cargar();
        this.cambiado.emit();
      },
      error: () => { this.guardando.set(false); this.toast.error('No se pudo guardar', 'Revise los datos e inténtelo de nuevo.'); },
    });
  }

  /** Quita el recordatorio de la lista y da 6 segundos para deshacer antes de borrarlo en el servidor. */
  borrar(r: Recordatorio) {
    this.confirmarBorrado();
    this.lista.update(l => l.filter(x => x.id_recordatorio !== r.id_recordatorio));
    this.porBorrar.set(r);
    this.temporizadorBorrado = setTimeout(() => this.confirmarBorrado(), 6000);
  }

  deshacerBorrado() {
    const r = this.porBorrar();
    if (!r) return;
    if (this.temporizadorBorrado) clearTimeout(this.temporizadorBorrado);
    this.temporizadorBorrado = null;
    this.porBorrar.set(null);
    this.lista.update(l => [...l, r].sort((a, b) => Number(b.activo) - Number(a.activo) || a.titulo.localeCompare(b.titulo)));
  }

  /** Borra de verdad el pendiente (al vencer el plazo, al borrar otro o al cerrar la ventana). */
  private confirmarBorrado() {
    const r = this.porBorrar();
    if (this.temporizadorBorrado) clearTimeout(this.temporizadorBorrado);
    this.temporizadorBorrado = null;
    if (!r) return;
    this.porBorrar.set(null);
    this.svc.eliminar(r.id_recordatorio).subscribe({
      next: () => { this.cargar(); this.cambiado.emit(); },
      error: () => {
        this.toast.error('No se pudo borrar', 'El recordatorio sigue en la lista.');
        this.cargar();
      },
    });
  }

  cerrar() {
    this.confirmarBorrado();
    this.openChange.emit(false);
  }
}
