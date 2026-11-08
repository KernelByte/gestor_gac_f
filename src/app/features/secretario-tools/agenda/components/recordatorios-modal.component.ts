import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, forkJoin, of } from 'rxjs';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { AgendaService } from '../../services/agenda.service';
import { ModoAgenda, Recordatorio, RecordatorioForm, Sugerencia } from '../../models/agenda.model';
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
 *
 * En la agenda personal (coordinador y ancianos) no hay sugerencias: cada uno crea
 * los suyos, y el coordinador puede crear uno para todos los ancianos. Los que
 * comparte el coordinador se ven aquí, pero solo él los edita o borra.
 */
@Component({
  selector: 'app-recordatorios-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent, DatePickerComponent, EmptyStateComponent],
  template: `
    <app-modal [open]="open" (openChange)="cerrar()" size="2xl" [hasFooter]="true"
               [title]="editando() === null ? 'Recordatorios periódicos' : (editando() === 'nuevo' ? 'Nuevo recordatorio' : 'Editar recordatorio')"
               [subtitle]="editando() === null ? 'Lo que debe hacer cada cierto tiempo. Le avisamos por la campana y en el celular, a las 7 de la mañana.' : ''">

      @if (editando() === null) {
        <!-- ── Pestañas ── -->
        <div class="segmented mb-3.5" role="tablist" aria-label="Recordatorios">
          <button type="button" role="tab" class="segmented-item"
                  [attr.aria-selected]="pestana() === 'mios'" (click)="pestana.set('mios')">
            Mis recordatorios
            <span class="tab-count">{{ lista().length }}</span>
          </button>
          @if (modo === 'secretaria') {
            <button type="button" role="tab" class="segmented-item"
                    [attr.aria-selected]="pestana() === 'sugerencias'" (click)="pestana.set('sugerencias')">
              Sugerencias
              @if (sugerenciasPendientes().length) { <span class="tab-count">{{ sugerenciasPendientes().length }}</span> }
            </button>
          }
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
              <app-empty-state [compact]="true" icon="clock" title="Todavía no tiene recordatorios"
                [description]="modo === 'secretaria' ? 'Empiece con las sugerencias o cree uno propio.' : 'Cree uno y la agenda le avisará cuando toque.'"
                [actionLabel]="sugerenciasPendientes().length ? 'Ver sugerencias' : 'Crear uno'"
                (action)="sugerenciasPendientes().length ? pestana.set('sugerencias') : nuevo()"
                [secondaryLabel]="sugerenciasPendientes().length ? 'Crear uno' : ''" (secondary)="nuevo()"></app-empty-state>
            } @else {
              <ul class="grid sm:grid-cols-2 gap-2.5">
                @for (r of lista(); track r.id_recordatorio) {
                  <li class="tarjeta" [class.tarjeta--pausa]="!r.activo">
                    <div class="flex items-start gap-2">
                      <h3 class="tarjeta-titulo flex-1 min-w-0">{{ r.titulo }}</h3>
                      @if (r.es_mio !== false) {
                      <div class="row-actions shrink-0 -mr-1.5 -mt-1">
                        <button type="button" class="btn-icon-sm" (click)="editar(r)" [attr.aria-label]="'Editar ' + r.titulo" title="Editar">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m16.86 4.49 2.65 2.65M4 20l3.6-.8 11.1-11.1a1.87 1.87 0 0 0-2.65-2.65L4.95 16.55 4 20Z"/></svg>
                        </button>
                        <button type="button" class="btn-icon-sm tone-danger" (click)="borrar(r)" [attr.aria-label]="'Borrar ' + r.titulo" title="Borrar">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>
                        </button>
                      </div>
                      }
                    </div>
                    @if (r.alcance === 'ancianos') {
                      <p class="compartido">
                        <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m18 0v-1a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75M14 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"/></svg>
                        Para todos los ancianos{{ r.es_mio ? '' : ' · lo maneja el coordinador' }}
                      </p>
                    }
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
              <app-empty-state [compact]="true" variant="success" title="Ya agregó todas las sugerencias"
                description="Puede editarlas en «Mis recordatorios»."></app-empty-state>
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

          @if (modo === 'personal' && coordinador) {
            <div>
              <span class="etiqueta" id="lbl-quien">¿Para quién es?</span>
              <div class="segmented w-full" role="radiogroup" aria-labelledby="lbl-quien">
                <button type="button" role="radio" class="segmented-item flex-1"
                        [attr.aria-checked]="form.alcance !== 'ancianos'" (click)="form.alcance = 'personal'">Solo para mí</button>
                <button type="button" role="radio" class="segmented-item flex-1"
                        [attr.aria-checked]="form.alcance === 'ancianos'" (click)="form.alcance = 'ancianos'">Para todos los ancianos</button>
              </div>
              @if (form.alcance === 'ancianos') {
                <p class="ayuda">Saldrá en la agenda de cada anciano, y cada uno marca «Ya lo hice» por su cuenta.</p>
              } @else if (alcanceOriginal === 'ancianos') {
                <p class="ayuda ayuda--aviso" role="status">Al guardar, dejará de salir en la agenda de los demás ancianos y solo lo verá usted.</p>
              }
            </div>
          }

          <div>
            <span class="etiqueta" id="lbl-repite">¿Se repite?</span>
            <div class="segmented w-full" role="radiogroup" aria-labelledby="lbl-repite">
              <button type="button" role="radio" class="segmented-item flex-1"
                      [attr.aria-checked]="form.frecuencia === 'periodica'" (click)="form.frecuencia = 'periodica'">Sí, cada cierto tiempo</button>
              <button type="button" role="radio" class="segmented-item flex-1"
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
              <app-date-picker name="fecha" [(ngModel)]="form.fecha_inicio" [fieldLike]="true" colorScheme="rose" placeholder="Elegir fecha"/>
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
                <div class="flex items-center gap-3 mt-4">
                  <button type="button" class="switch" role="switch" id="rec-activo" aria-labelledby="rec-activo-txt"
                          [attr.aria-checked]="form.activo" (click)="form.activo = !form.activo"><span class="toggle-thumb"></span></button>
                  <span id="rec-activo-txt" class="text-sm text-slate-700 dark:text-slate-200">Activo <span class="opcional">· si lo apaga, deja de salir en la agenda</span></span>
                </div>
              }
            </div>
          </div>
        </form>
      }

      <ng-container slot="footer">
        @if (editando() !== null) {
          <button type="button" class="btn-secondary flex-1 sm:flex-none" (click)="volver()">Volver</button>
          <button type="button" class="btn-primary flex-1 sm:flex-none justify-center" [disabled]="guardando()" (click)="guardar()">
            {{ guardando() ? 'Guardando…' : 'Guardar' }}
          </button>
        } @else if (pestana() === 'sugerencias' && sugerenciasPendientes().length) {
          <button type="button" class="btn-secondary flex-1 sm:flex-none" (click)="cerrar()">Cerrar</button>
          <button type="button" class="btn-primary flex-1 sm:flex-none justify-center" [disabled]="!elegidas().size || guardando()" (click)="aplicarSugerencias()">
            {{ guardando() ? 'Agregando…' : elegidas().size ? 'Agregar ' + elegidas().size + (elegidas().size === 1 ? ' recordatorio' : ' recordatorios') : 'Marque al menos uno' }}
          </button>
        } @else {
          <button type="button" class="btn-secondary flex-1 sm:flex-none" (click)="cerrar()">Cerrar</button>
          <button type="button" class="btn-primary flex-1 sm:flex-none justify-center" (click)="nuevo()">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path stroke-linecap="round" d="M12 5v14m-7-7h14"/></svg>
            Nuevo recordatorio
          </button>
        }
      </ng-container>
    </app-modal>
  `,
  styles: [`
    :host { --accent: #e11d48; --accent-hover: #be123c; --accent-focus: #e11d48; --accent-ring: color-mix(in oklab, #e11d48 20%, transparent); --accent-shadow: 0 6px 16px -8px rgb(225 29 72 / 0.6); }
    /* La fuente de la app (Manrope) también en controles: los navegadores no la heredan en botones, campos ni selects. */
    :host { --ease: var(--ease-out-strong, cubic-bezier(0.23, 1, 0.32, 1)); font-family: var(--font-sans, inherit); }
    :host button, :host input, :host select, :host textarea { font-family: inherit; }

    .panel { animation: entra 200ms var(--ease); }
    @keyframes entra { from { opacity: 0; transform: translateY(4px); } }

    /* Tarjetas (sugerencias y existentes) */
    .tarjeta {
      position: relative; display: flex; flex-direction: column; gap: 4px; height: 100%; padding: 14px 16px; border-radius: 14px;
      background: #fff; border: 1px solid rgb(226 232 240);
      transition: border-color 150ms var(--ease), background 150ms var(--ease), box-shadow 150ms var(--ease), transform 100ms var(--ease);
    }
    :host-context(.dark) .tarjeta { background: rgb(30 41 59 / 0.6); border-color: rgb(30 41 59); }
    .tarjeta--eleg { cursor: pointer; }
    .tarjeta--eleg:hover { border-color: rgb(253 164 175); }
    .tarjeta--eleg:active { transform: scale(0.985); }
    .tarjeta--eleg:has(input:focus-visible) { outline: 2px solid rgb(244 63 94); outline-offset: 2px; }
    .tarjeta--on, .tarjeta--on:hover { border-color: rgb(225 29 72); background: rgb(255 241 242); box-shadow: 0 0 0 1px rgb(225 29 72); }
    :host-context(.dark) .tarjeta--eleg:hover { border-color: rgb(225 29 72); }
    :host-context(.dark) .tarjeta--on, :host-context(.dark) .tarjeta--on:hover { background: rgb(136 19 55 / 0.25); border-color: rgb(244 63 94); box-shadow: 0 0 0 1px rgb(244 63 94); }
    .tarjeta--pausa { opacity: 0.65; }
    .tarjeta-titulo { font-family: var(--font-display, inherit); font-size: 16px; font-weight: 700; line-height: 1.3; color: rgb(15 23 42); }
    :host-context(.dark) .tarjeta-titulo { color: rgb(248 250 252); }
    .meta { font-size: 13px; font-weight: 600; color: rgb(225 29 72); }
    .compartido { display: inline-flex; align-items: center; gap: 6px; align-self: flex-start; padding: 2px 8px; border-radius: 999px;
      font-size: 12px; font-weight: 600; color: rgb(3 105 161); background: rgb(240 249 255); border: 1px solid rgb(186 230 253); }
    :host-context(.dark) .compartido { color: rgb(125 211 252); background: rgb(12 74 110 / 0.35); border-color: rgb(3 105 161 / 0.6); }
    .ayuda { margin-top: 6px; font-size: 13px; color: rgb(100 116 139); }
    .ayuda--aviso { font-weight: 600; color: rgb(180 83 9); }
    :host-context(.dark) .ayuda--aviso { color: rgb(252 211 77); }
    :host-context(.dark) .ayuda { color: rgb(148 163 184); }
    :host-context(.dark) .meta { color: rgb(253 164 175); }
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
    .tarjeta--on .check { background: rgb(225 29 72); border-color: rgb(225 29 72); color: #fff; transform: scale(1.05); }

    .enlace-btn { font-size: 14px; font-weight: 600; color: rgb(225 29 72); padding: 4px 8px; border-radius: 8px; transition: background 150ms var(--ease); }
    .enlace-btn:hover { background: rgb(255 241 242); }
    :host-context(.dark) .enlace-btn { color: rgb(253 164 175); }
    :host-context(.dark) .enlace-btn:hover { background: rgb(136 19 55 / 0.3); }

    .deshacer { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; padding: 6px 6px 6px 14px; border-radius: 12px;
      font-size: 14px; background: rgb(15 23 42); color: #fff; animation: entra 200ms var(--ease); }
    :host-context(.dark) .deshacer { background: rgb(51 65 85); }
    .deshacer-btn { height: 32px; padding: 0 12px; border-radius: 8px; font-size: 14px; font-weight: 700; color: rgb(253 164 175); transition: background 150ms var(--ease); }
    .deshacer-btn:hover { background: rgb(255 255 255 / 0.1); }


    /* Botones */

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
    .campo:focus { outline: none; border-color: rgb(167 139 250); box-shadow: 0 0 0 4px rgb(244 63 94 / 0.15); }
    .campo--error, .campo--error:focus { border-color: rgb(239 68 68); box-shadow: 0 0 0 4px rgb(239 68 68 / 0.1); }
    .campo--select {
      appearance: none; padding-right: 36px;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
      background-repeat: no-repeat; background-position: right 12px center; background-size: 16px;
    }
    :host-context(.dark) .campo { background-color: rgb(15 23 42); border-color: rgb(30 41 59); color: rgb(241 245 249); }


    .resumen { display: flex; gap: 8px; padding: 10px 14px; border-radius: 12px; font-size: 14px; line-height: 1.45; font-weight: 500;
      color: rgb(190 18 60); background: rgb(255 241 242); }
    :host-context(.dark) .resumen { color: rgb(254 205 211); background: rgb(136 19 55 / 0.25); }


    button:focus-visible { outline: 2px solid rgb(244 63 94); outline-offset: 2px; }

    /* Pantallas táctiles: todo lo que se pulsa mide al menos 44 px. */
    @media (pointer: coarse) {
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
  /** Agenda del secretario (con sugerencias) o personal. */
  @Input() modo: ModoAgenda = 'secretaria';
  /** Agenda personal: el coordinador puede crear recordatorios para todos los ancianos. */
  @Input() coordinador = false;

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
  /** Alcance con el que se abrió para editar: avisa si uno compartido pasa a ser solo propio. */
  alcanceOriginal: 'personal' | 'ancianos' | null = null;
  /** Recordatorio ya quitado de la lista que se borra de verdad al pasar unos segundos, salvo que se deshaga. */
  porBorrar = signal<Recordatorio | null>(null);
  private pideLista?: Subscription;
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
    this.pideLista?.unsubscribe();
    const sugerencias = this.modo === 'secretaria' ? this.svc.sugerencias() : of<Sugerencia[]>([]);
    this.pideLista = forkJoin({ lista: this.svc.recordatorios(), sug: sugerencias }).subscribe({
      next: ({ lista, sug }) => {
        const pendientes = sug.filter(x => !x.ya_agregada);
        // El que está esperando el «Deshacer» sigue en el servidor: no debe volver a aparecer.
        const porBorrar = this.porBorrar()?.id_recordatorio;
        this.lista.set(porBorrar == null ? lista : lista.filter(x => x.id_recordatorio !== porBorrar));
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
    this.form = this.modo === 'personal' ? { ...vacio(), alcance: 'personal' } : vacio();
    this.alcanceOriginal = null;
    this.intentado.set(false);
    this.editando.set('nuevo');
  }

  editar(r: Recordatorio) {
    const { titulo, descripcion, enlace, frecuencia, intervalo_meses, fecha_inicio, dias_aviso, activo } = r;
    this.form = { titulo, descripcion, enlace, frecuencia, intervalo_meses, fecha_inicio, dias_aviso, activo };
    if (this.modo === 'personal' && r.alcance !== 'secretaria') this.form.alcance = r.alcance;
    this.alcanceOriginal = r.alcance === 'secretaria' ? null : r.alcance;
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
    this.lista.update(l => [...l.filter(x => x.id_recordatorio !== r.id_recordatorio), r].sort((a, b) => Number(b.activo) - Number(a.activo) || a.titulo.localeCompare(b.titulo)));
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
