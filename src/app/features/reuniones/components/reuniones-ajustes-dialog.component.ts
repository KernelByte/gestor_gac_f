import {
  Component,
  signal,
  computed,
  inject,
  Input,
  Output,
  EventEmitter,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ReunionesService } from '../services/reuniones.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { getInitialAvatarStyle } from '../../../core/utils/avatar-style.util';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { SelectPickerComponent, PickerOption } from '../../../shared/components/select-picker/select-picker.component';
import { AusenciaOut, SemanaSinReunion, AlcanceSemana } from '../models/reuniones.models';
import { nombreMostrado } from '../../../core/utils/nombre.util';

type AjustesTab = 'semanas' | 'ausencias';

/**
 * Semanas sin reunión y ausencias de publicadores, al alcance de la mano desde
 * la propia programación.
 *
 * Las dos cosas viven en la pantalla de Configuración, pero se necesitan
 * justo mientras se programa: uno descubre que esa semana hay asamblea, o que
 * un hermano viaja, con el mes ya abierto delante. Obligar a salir, cambiar de
 * pantalla, buscar la pestaña y volver es donde se pierde el hilo -y donde el
 * dato se acaba no registrando-.
 *
 * Es un único componente para las cuatro pestañas (entre semana, fin de
 * semana, logística y discursos) en vez de una copia por pantalla: el
 * formulario, el aviso destructivo y el orden de la lista son idénticos, y
 * cuatro copias serían cuatro sitios donde arreglar el mismo detalle.
 */
@Component({
  selector: 'app-reuniones-ajustes-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePickerComponent, SelectPickerComponent],
  template: `
    @if (abierto) {
      <!-- El overlay cierra al pulsar fuera; el panel detiene la propagación.
           z-[60] queda por encima de los popups de la programación (z-40/50). -->
      <div
        class="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
        (click)="pedirCierre()">

        <div class="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm animate-aj-fade"></div>

        <!-- Hoja inferior en móvil, diálogo centrado desde sm:. En un teléfono
             el pulgar llega antes al borde de abajo que al centro, y el teclado
             al escribir el motivo empuja el panel sin taparlo. -->
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="aj-titulo"
          (click)="$event.stopPropagation()"
          class="aj-panel relative w-full sm:max-w-3xl flex flex-col min-h-0
                 max-h-[92dvh] sm:max-h-[88dvh]
                 bg-white dark:bg-slate-900
                 rounded-t-3xl sm:rounded-2xl
                 border-t sm:border border-slate-200 dark:border-slate-700
                 shadow-2xl shadow-slate-900/10 dark:shadow-black/40">

          <!-- Asa: en móvil dice "esto se arrastra/se cierra" sin gastar texto. -->
          <div class="sm:hidden shrink-0 pt-2.5 pb-1 flex justify-center" aria-hidden="true">
            <span class="w-9 h-1 rounded-full bg-slate-300 dark:bg-slate-700"></span>
          </div>

          <!-- ── CABECERA ── -->
          <div class="shrink-0 px-4 sm:px-5 pt-3 sm:pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-start gap-3">
              <div class="shrink-0 w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-100 dark:border-violet-500/20 flex items-center justify-center">
                <svg class="w-4 h-4 text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
              <div class="min-w-0 flex-1">
                <h2 id="aj-titulo" class="text-sm sm:text-base font-black text-slate-900 dark:text-white leading-tight">
                  Excepciones de programación
                </h2>
                <p class="text-[0.7rem] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Semanas que no se programan y personas que no están disponibles.
                </p>
              </div>
              <button
                (click)="pedirCierre()"
                aria-label="Cerrar"
                title="Cerrar"
                class="shrink-0 flex items-center justify-center w-11 h-11 -mr-2 -mt-1 rounded-xl text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors active:scale-95">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <!-- ── SEGMENTOS ──
                 Dos destinos: el control segmentado los muestra ambos a la vez
                 en vez de esconder uno detrás de un desplegable. El contador
                 dice si ya hay algo registrado sin tener que entrar a mirar. -->
            <div role="tablist" aria-label="Secciones" class="mt-3 flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60">
              <button
                role="tab"
                [attr.aria-selected]="tab() === 'semanas'"
                (click)="tab.set('semanas')"
                class="aj-seg flex-1 min-w-0 flex items-center justify-center gap-1.5 h-9 px-2 rounded-lg text-[0.7rem] sm:text-xs font-bold transition-colors"
                [class]="tab() === 'semanas'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="15" x2="15" y2="19"/><line x1="15" y1="15" x2="9" y2="19"/></svg>
                <span class="truncate">Semanas sin reunión</span>
                @if (semanas().length > 0) {
                  <span class="aj-chip aj-chip-amber shrink-0">{{ semanas().length }}</span>
                }
              </button>
              <button
                role="tab"
                [attr.aria-selected]="tab() === 'ausencias'"
                (click)="tab.set('ausencias')"
                class="aj-seg flex-1 min-w-0 flex items-center justify-center gap-1.5 h-9 px-2 rounded-lg text-[0.7rem] sm:text-xs font-bold transition-colors"
                [class]="tab() === 'ausencias'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                <span class="truncate">Ausencias</span>
                @if (ausencias().length > 0) {
                  <span class="aj-chip aj-chip-violet shrink-0">{{ ausencias().length }}</span>
                }
              </button>
            </div>
          </div>

          <!-- ── CUERPO ── -->
          <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar overscroll-contain px-4 sm:px-5 py-4 flex flex-col gap-4">

            <!-- ═══════ SEMANAS SIN REUNIÓN ═══════ -->
            @if (tab() === 'semanas') {

              <!-- El borrado es irreversible y alcanza a lo confirmado: el
                   aviso va antes del formulario, no debajo del botón. -->
              <div class="shrink-0 flex items-start gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/25 px-3 py-2.5">
                <svg class="w-4 h-4 shrink-0 mt-px text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <p class="text-[0.7rem] leading-relaxed text-amber-800 dark:text-amber-200">
                  Para asambleas o la Conmemoración. No se programará a nadie esa semana.
                  <span class="font-bold text-rose-600 dark:text-rose-400">Se borra lo ya programado, incluso lo confirmado.</span>
                </p>
              </div>

              <!-- Formulario. Sin overflow-hidden: el calendario del
                   date-picker es un popup absolute anclado aquí dentro. -->
              <!-- Dos filas y no tres campos apretados en una: dentro de un
                   modal de 768px como mucho, "Se cancela" se quedaba con
                   menos de 150px y "Ambas reuniones" no cabía. Semana y
                   alcance forman una pareja natural -van juntas al dry_run- y
                   se reparten la fila a la mitad; el motivo, que es texto
                   libre y puede ser largo, se queda con el ancho completo. -->
              <div class="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/30 p-3 sm:p-4 flex flex-col gap-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5 min-w-0">
                    <label class="aj-label">Semana</label>
                    <app-date-picker
                      [(ngModel)]="ssrFecha"
                      [ngModelOptions]="{ standalone: true }"
                      colorScheme="violet"
                      [fieldLike]="true"
                      [inlineOnMobile]="true"
                      placeholder="Cualquier día">
                    </app-date-picker>
                  </div>

                  <div class="flex flex-col gap-1.5 min-w-0">
                    <label class="aj-label">Se cancela</label>
                    <app-select-picker
                      [ngModel]="ssrAlcance"
                      (ngModelChange)="ssrAlcance = $event"
                      [ngModelOptions]="{ standalone: true }"
                      [options]="opcionesAlcance"
                      [clearable]="false"
                      colorScheme="violet"
                      ariaLabel="Alcance"
                      placeholder="Selecciona el alcance">
                    </app-select-picker>
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label for="aj-ssr-motivo" class="aj-label">
                    Motivo <span class="aj-label-opt">(opcional)</span>
                  </label>
                  <div class="flex items-stretch gap-2">
                    <input
                      id="aj-ssr-motivo"
                      type="text"
                      class="form-control aj-field flex-1 min-w-0"
                      [(ngModel)]="ssrMotivo"
                      [ngModelOptions]="{ standalone: true }"
                      maxlength="200"
                      placeholder="Asamblea, Conmemoración...">
                    <button
                      (click)="prepararSemana()"
                      [disabled]="!puedeMarcarSemana() || guardandoSemana()"
                      aria-label="Marcar semana sin reunión"
                      title="Marcar semana sin reunión"
                      class="aj-submit shrink-0 flex items-center justify-center px-4 min-h-[44px] rounded-xl bg-brand-purple text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                      @if (guardandoSemana()) {
                        <div class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                      } @else {
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      }
                    </button>
                  </div>
                </div>

                @if (semanaError()) {
                  <div role="alert" class="aj-error">
                    <svg class="w-4 h-4 shrink-0 text-rose-500 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p class="text-xs font-semibold text-rose-700 dark:text-rose-300 leading-relaxed">{{ semanaError() }}</p>
                  </div>
                }
              </div>

              <!-- Lista de semanas marcadas -->
              @if (loadingSemanas()) {
                <div class="shrink-0 flex flex-col items-center justify-center gap-3 py-10">
                  <div class="w-6 h-6 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-brand-purple animate-spin"></div>
                  <p class="text-xs font-medium text-slate-400 dark:text-slate-500">Cargando semanas...</p>
                </div>

              } @else if (semanas().length === 0) {
                <div class="shrink-0 flex flex-col items-center justify-center gap-2.5 py-10 px-6 text-center">
                  <div class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-center">
                    <svg class="w-6 h-6 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <p class="text-sm font-bold text-slate-700 dark:text-slate-200">No hay semanas marcadas</p>
                  <p class="text-[0.7rem] text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                    Marca arriba la semana de una asamblea, congreso o la Conmemoración y el motor dejará de programarla.
                  </p>
                </div>

              } @else {
                <!-- shrink-0: el cuerpo es un flex column y sin esto flexbox
                     encoge la lista por debajo de su contenido, que el
                     overflow-hidden del borde redondeado recorta. En un
                     teléfono se veían filas cortadas por la mitad. -->
                <div class="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700/70 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  @for (s of semanas(); track s.id_semana_sin_reunion; let i = $index) {
                    <div class="aj-row flex items-center gap-3 px-3 sm:px-4 py-3" [style.--aj-i]="i">
                      <div class="shrink-0 w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 flex items-center justify-center" aria-hidden="true">
                        <svg class="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="15" x2="15" y2="19"/><line x1="15" y1="15" x2="9" y2="19"/></svg>
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                          <p class="text-[0.8125rem] font-bold text-slate-800 dark:text-white data-num">{{ formatRangoSemana(s) }}</p>
                          <span class="aj-chip aj-chip-amber">{{ etiquetaAlcance(s.alcance) }}</span>
                        </div>
                        <p class="text-[0.7rem] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          Semana {{ s.semana_iso }} de {{ s.ano_iso }}@if (s.motivo) { · {{ s.motivo }} }
                        </p>
                      </div>
                      <button
                        (click)="pedirQuitarSemana(s)"
                        [attr.aria-label]="'Quitar la marca de ' + formatRangoSemana(s)"
                        title="Quitar marca"
                        class="aj-del shrink-0 flex items-center justify-center w-11 h-11 -mr-1.5 rounded-xl text-slate-400 dark:text-slate-500">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  }
                </div>
              }
            }

            <!-- ═══════ AUSENCIAS ═══════ -->
            @if (tab() === 'ausencias') {

              <div class="shrink-0 flex items-start gap-2.5 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200/70 dark:border-violet-500/25 px-3 py-2.5">
                <svg class="w-4 h-4 shrink-0 mt-px text-violet-600 dark:text-violet-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <p class="text-[0.7rem] leading-relaxed text-violet-800 dark:text-violet-200">
                  No se le asignará ningún puesto en ese rango, aunque tenga el permiso.
                  Si ya estaba asignado, se avisa sin quitárselo.
                </p>
              </div>

              <!-- Publicador solo en su fila: es el campo que más se busca y
                   el que más se beneficia de ancho. Desde/Hasta son pareja y
                   se reparten la siguiente fila a la mitad -misma lógica que
                   Semana/Se cancela en la otra pestaña, en vez de cuatro
                   campos compitiendo por 768px. -->
              <div class="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700/70 bg-slate-50/60 dark:bg-slate-800/30 p-3 sm:p-4 flex flex-col gap-3">
                <div class="flex flex-col gap-1.5">
                  <label class="aj-label">Publicador</label>
                  <app-select-picker
                    [ngModel]="ausIdPublicador"
                    (ngModelChange)="ausIdPublicador = $event"
                    [ngModelOptions]="{ standalone: true }"
                    [options]="opcionesPublicador()"
                    colorScheme="violet"
                    ariaLabel="Publicador"
                    placeholder="Selecciona un publicador">
                  </app-select-picker>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1.5 min-w-0">
                    <label class="aj-label">Desde</label>
                    <app-date-picker
                      [(ngModel)]="ausFechaInicio"
                      [ngModelOptions]="{ standalone: true }"
                      colorScheme="violet"
                      [fieldLike]="true"
                      [inlineOnMobile]="true"
                      placeholder="Fecha inicio">
                    </app-date-picker>
                  </div>

                  <div class="flex flex-col gap-1.5 min-w-0">
                    <label class="aj-label">Hasta</label>
                    <app-date-picker
                      [(ngModel)]="ausFechaFin"
                      [ngModelOptions]="{ standalone: true }"
                      [minDate]="ausFechaInicio"
                      colorScheme="violet"
                      [fieldLike]="true"
                      [inlineOnMobile]="true"
                      placeholder="Fecha fin">
                    </app-date-picker>
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label for="aj-aus-motivo" class="aj-label">
                    Motivo <span class="aj-label-opt">(opcional)</span>
                  </label>
                  <div class="flex items-stretch gap-2">
                    <input
                      id="aj-aus-motivo"
                      type="text"
                      class="form-control aj-field flex-1 min-w-0"
                      [(ngModel)]="ausMotivo"
                      [ngModelOptions]="{ standalone: true }"
                      maxlength="200"
                      placeholder="Viaje, salud...">
                    <button
                      (click)="registrarAusencia()"
                      [disabled]="!puedeRegistrarAusencia() || guardandoAusencia()"
                      aria-label="Registrar ausencia"
                      title="Registrar ausencia"
                      class="aj-submit shrink-0 flex items-center justify-center px-4 min-h-[44px] rounded-xl bg-brand-purple text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed">
                      @if (guardandoAusencia()) {
                        <div class="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
                      } @else {
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      }
                    </button>
                  </div>
                </div>

                @if (ausenciaError()) {
                  <div role="alert" class="aj-error">
                    <svg class="w-4 h-4 shrink-0 text-rose-500 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <p class="text-xs font-semibold text-rose-700 dark:text-rose-300 leading-relaxed">{{ ausenciaError() }}</p>
                  </div>
                }
              </div>

              <!-- Resumen + buscador: sólo cuando la lista es larga de verdad.
                   Con tres ausencias, un buscador es ruido. -->
              @if (!loadingAusencias() && ausencias().length > 0) {
                <div class="shrink-0 flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <div class="flex items-center gap-2 flex-wrap min-w-0">
                    <p class="text-[0.6rem] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">Registradas</p>
                    <span class="aj-chip aj-chip-neutral">{{ ausencias().length }}</span>
                    @if (ausenciasEnCurso() > 0) {
                      <span class="aj-chip aj-chip-live"><span class="aj-dot"></span>{{ ausenciasEnCurso() }} en curso</span>
                    }
                    @if (ausenciasProximas() > 0) {
                      <span class="aj-chip aj-chip-soon">{{ ausenciasProximas() }} próxima{{ ausenciasProximas() > 1 ? 's' : '' }}</span>
                    }
                  </div>
                  @if (ausencias().length > 5) {
                    <div class="relative sm:ml-auto sm:w-56 shrink-0">
                      <svg class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                      <input
                        type="text"
                        [ngModel]="ausFiltro()"
                        (ngModelChange)="ausFiltro.set($event)"
                        [ngModelOptions]="{ standalone: true }"
                        placeholder="Buscar persona o motivo..."
                        aria-label="Buscar ausencias"
                        class="aj-search w-full min-h-[40px] pl-9 pr-3 bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none">
                    </div>
                  }
                </div>
              }

              @if (loadingAusencias()) {
                <div class="shrink-0 flex flex-col items-center justify-center gap-3 py-10">
                  <div class="w-6 h-6 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-brand-purple animate-spin"></div>
                  <p class="text-xs font-medium text-slate-400 dark:text-slate-500">Cargando ausencias...</p>
                </div>

              } @else if (ausencias().length === 0) {
                <div class="shrink-0 flex flex-col items-center justify-center gap-2.5 py-10 px-6 text-center">
                  <div class="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 flex items-center justify-center">
                    <svg class="w-6 h-6 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  </div>
                  <p class="text-sm font-bold text-slate-700 dark:text-slate-200">Nadie tiene ausencias registradas</p>
                  <p class="text-[0.7rem] text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed">
                    Cuando alguien viaje o no pueda participar por un tiempo, regístralo arriba y dejará de asignarse en esas fechas.
                  </p>
                </div>

              } @else if (ausenciasOrdenadas().length === 0) {
                <div class="shrink-0 flex flex-col items-center justify-center gap-1.5 py-10 px-6 text-center">
                  <p class="text-sm font-bold text-slate-600 dark:text-slate-300">Sin coincidencias</p>
                  <p class="text-xs text-slate-400 dark:text-slate-500">Nadie coincide con "{{ ausFiltro() }}".</p>
                  <button (click)="ausFiltro.set('')" class="mt-1 px-3 min-h-[36px] rounded-lg text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
                    Limpiar búsqueda
                  </button>
                </div>

              } @else {
                <!-- shrink-0: el cuerpo es un flex column y sin esto flexbox
                     encoge la lista por debajo de su contenido, que el
                     overflow-hidden del borde redondeado recorta. En un
                     teléfono se veían filas cortadas por la mitad. -->
                <div class="shrink-0 rounded-2xl border border-slate-200 dark:border-slate-700/70 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  @for (a of ausenciasOrdenadas(); track a.id_ausencia; let i = $index) {
                    <div class="aj-row flex items-center gap-3 px-3 sm:px-4 py-3" [style.--aj-i]="i">
                      <div
                        class="shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-semibold text-[0.7rem] ring-1 ring-white dark:ring-slate-800 border border-white/50"
                        [class]="avatarClass(a)"
                        aria-hidden="true">
                        {{ iniciales(a) }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 min-w-0">
                          <p class="text-[0.8125rem] font-bold text-slate-800 dark:text-white truncate">{{ a.nombre_completo }}</p>
                          <span class="aj-state shrink-0" [attr.data-estado]="estadoAusencia(a)">
                            @if (estadoAusencia(a) === 'en_curso') { <span class="aj-dot"></span> }
                            {{ estadoLabel(a) }}
                          </span>
                        </div>
                        <p class="text-[0.7rem] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap leading-tight">
                          <span class="data-num">{{ formatRangoAusencia(a) }}</span>
                          <span class="text-slate-300 dark:text-slate-600" aria-hidden="true">&#183;</span>
                          <span>{{ duracion(a) }}</span>
                          @if (estadoAusencia(a) !== 'finalizada') {
                            <span class="text-slate-300 dark:text-slate-600" aria-hidden="true">&#183;</span>
                            <span class="font-semibold" [attr.data-estado]="estadoAusencia(a)">{{ estadoDetalle(a) }}</span>
                          }
                        </p>
                        @if (a.motivo) {
                          <p class="text-[0.7rem] text-slate-400 dark:text-slate-500 mt-0.5 truncate italic">{{ a.motivo }}</p>
                        }
                      </div>
                      <button
                        (click)="pedirEliminarAusencia(a)"
                        [attr.aria-label]="'Eliminar la ausencia de ' + a.nombre_completo"
                        title="Eliminar ausencia"
                        class="aj-del shrink-0 flex items-center justify-center w-11 h-11 -mr-1.5 rounded-xl text-slate-400 dark:text-slate-500">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  }
                </div>
              }
            }
          </div>

          <!-- ── PIE ──
               El modal cubre lo que se necesita mientras se programa; lo demás
               -privilegios, plantillas, parámetros- sigue viviendo en su
               pantalla, y desde aquí se llega en un clic. -->
          <div class="shrink-0 flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-slate-100 dark:border-slate-800 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-3">
            <a
              routerLink="/reuniones/configuracion"
              [queryParams]="{ tab: tab() === 'semanas' ? 'sin-reunion' : 'ausencias' }"
              (click)="pedirCierre()"
              class="inline-flex items-center gap-1.5 min-h-[36px] px-2 -ml-2 rounded-lg text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors">
              Configuración completa
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>
            </a>
            <button
              (click)="pedirCierre()"
              class="shrink-0 px-4 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-[0.97]">
              Listo
            </button>
          </div>
        </div>
      </div>

      <!-- ═══ CONFIRMAR MARCAR SEMANA (destructivo) ═══ -->
      @if (semanaAConfirmar(); as previo) {
        <div class="fixed inset-0 z-[70] flex items-center justify-center p-4" (click)="semanaAConfirmar.set(null)">
          <div class="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm"></div>
          <div role="alertdialog" aria-modal="true" (click)="$event.stopPropagation()"
               class="aj-panel relative w-full max-w-sm p-6 flex flex-col gap-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div class="flex flex-col items-center gap-3 text-center">
              <div class="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/25 flex items-center justify-center">
                <svg class="w-6 h-6 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <h3 class="text-sm font-black text-slate-900 dark:text-white">Marcar semana sin reunión</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {{ formatRangoSemana(previo) }} — {{ etiquetaAlcance(previo.alcance) }}.
                </p>
                @if ((previo.borradas ?? 0) > 0) {
                  <p class="text-xs mt-2 leading-relaxed font-bold text-rose-600 dark:text-rose-400">
                    Se borrarán {{ previo.borradas }} asignaciones ya hechas, incluidas las confirmadas. Esto no se puede deshacer.
                  </p>
                } @else {
                  <p class="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    No hay nada programado en esa semana todavía.
                  </p>
                }
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button (click)="semanaAConfirmar.set(null)" class="flex-1 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-[0.97]">Cancelar</button>
              <button (click)="confirmarMarcarSemana()" [disabled]="guardandoSemana()" class="flex-1 min-h-[40px] rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors active:scale-[0.97] disabled:opacity-50">Sí, marcar</button>
            </div>
          </div>
        </div>
      }

      <!-- ═══ CONFIRMAR BORRADO ═══ -->
      <!-- Quitar una marca de semana y eliminar una ausencia se preguntan
           igual: mismo panel, mismo icono, una frase y dos botones. Lo unico
           que cambia es el texto y a quien se llama, asi que va un solo
           dialogo parametrizado en vez de dos copias que se desincronizan. -->
      @if (confirmarBorrado(); as c) {
        <div class="fixed inset-0 z-[70] flex items-center justify-center p-4" (click)="confirmarBorrado.set(null)">
          <div class="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/70 backdrop-blur-sm"></div>
          <div role="alertdialog" aria-modal="true" (click)="$event.stopPropagation()"
               class="aj-panel relative w-full max-w-sm p-6 flex flex-col gap-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div class="flex flex-col items-center gap-3 text-center">
              <div class="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/25 flex items-center justify-center">
                <svg class="w-6 h-6 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </div>
              <div>
                <h3 class="text-sm font-black text-slate-900 dark:text-white">{{ c.titulo }}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{{ c.mensaje }}</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button (click)="confirmarBorrado.set(null)" class="flex-1 min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors active:scale-[0.97]">Cancelar</button>
              <button (click)="ejecutarBorrado()" class="flex-1 min-h-[40px] rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-colors active:scale-[0.97]">{{ c.textoOk }}</button>
            </div>
          </div>
        </div>
      }
    }
  `,
  styles: [`
    :host { display: contents; }

    /* Entrada: hoja desde abajo en movil, escala corta en escritorio. La
       direccion dice de donde viene el panel y a donde vuelve al cerrar. */
    .aj-panel {
      animation: aj-sheet 260ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
    }
    @media (min-width: 640px) {
      .aj-panel { animation-name: aj-pop; animation-duration: 200ms; }
    }
    @keyframes aj-sheet {
      from { transform: translateY(16px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes aj-pop {
      from { transform: scale(0.97); opacity: 0; }
      to   { transform: scale(1);    opacity: 1; }
    }
    .animate-aj-fade { animation: aj-fade 200ms ease-out backwards; }
    @keyframes aj-fade { from { opacity: 0; } to { opacity: 1; } }

    /* Cascada corta al listar: ordena la lectura sin hacerse notar. */
    .aj-row {
      animation: aj-row-in 260ms cubic-bezier(0.16, 1, 0.3, 1) backwards;
      animation-delay: calc(var(--aj-i, 0) * 28ms);
      transition: background-color 150ms ease-out;
    }
    .aj-row:hover { background: rgb(248 250 252 / 0.7); }
    :host-context(.dark) .aj-row:hover { background: rgb(30 41 59 / 0.35); }
    @keyframes aj-row-in {
      from { transform: translateY(4px); opacity: 0; }
      to   { transform: translateY(0);   opacity: 1; }
    }

    @media (prefers-reduced-motion: reduce) {
      .aj-panel, .aj-row, .animate-aj-fade { animation: none; }
    }

    .aj-label {
      font-size: 0.6rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: rgb(100 116 139);
    }
    :host-context(.dark) .aj-label { color: rgb(148 163 184); }
    .aj-label-opt {
      font-weight: 500;
      text-transform: none;
      letter-spacing: normal;
      color: rgb(148 163 184);
    }

    .aj-field, .aj-search { transition: border-color 150ms ease-out, box-shadow 150ms ease-out; }
    .aj-field:focus, .aj-search:focus {
      border-color: rgb(139 92 246);
      box-shadow: 0 0 0 3px rgb(139 92 246 / 0.16);
    }

    .aj-submit { transition: background-color 150ms ease-out, transform 120ms ease-out; }
    .aj-submit:not(:disabled):hover { filter: brightness(1.1); }
    .aj-submit:not(:disabled):active { transform: scale(0.96); }

    .aj-del { transition: background-color 150ms ease-out, color 150ms ease-out, transform 120ms ease-out; }
    .aj-del:hover { background: rgb(254 242 242); color: rgb(220 38 38); }
    :host-context(.dark) .aj-del:hover { background: rgb(127 29 29 / 0.25); color: rgb(248 113 113); }
    .aj-del:active { transform: scale(0.92); }

    .aj-seg { transition: background-color 150ms ease-out, color 150ms ease-out, box-shadow 150ms ease-out; }
    .aj-seg:active { transform: scale(0.98); }

    .aj-error {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      border-radius: 0.75rem;
      background: rgb(255 241 242);
      border: 1px solid rgb(254 205 211 / 0.7);
      padding: 0.625rem 0.75rem;
    }
    :host-context(.dark) .aj-error {
      background: rgb(136 19 55 / 0.2);
      border-color: rgb(159 18 57 / 0.5);
    }

    /* Chips: misma familia que el resto de la app -pildora diminuta, mayuscula
       corta-. El color solo separa categorias, nunca es el unico dato. */
    .aj-chip {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.0625rem 0.4rem;
      border-radius: 9999px;
      font-size: 0.6rem;
      font-weight: 800;
      line-height: 1.5;
      white-space: nowrap;
    }
    .aj-chip-neutral { background: rgb(241 245 249); color: rgb(71 85 105); }
    :host-context(.dark) .aj-chip-neutral { background: rgb(51 65 85 / 0.6); color: rgb(203 213 225); }
    .aj-chip-amber { background: rgb(254 243 199); color: rgb(146 64 14); }
    :host-context(.dark) .aj-chip-amber { background: rgb(120 53 15 / 0.4); color: rgb(252 211 77); }
    .aj-chip-violet { background: rgb(237 233 254); color: rgb(91 33 182); }
    :host-context(.dark) .aj-chip-violet { background: rgb(76 29 149 / 0.45); color: rgb(196 181 253); }
    .aj-chip-live { background: rgb(209 250 229); color: rgb(6 95 70); }
    :host-context(.dark) .aj-chip-live { background: rgb(6 78 59 / 0.45); color: rgb(110 231 183); }
    .aj-chip-soon { background: rgb(224 242 254); color: rgb(7 89 133); }
    :host-context(.dark) .aj-chip-soon { background: rgb(12 74 110 / 0.45); color: rgb(125 211 252); }

    /* Estado de la ausencia: el punto acompana al texto, no lo sustituye. */
    .aj-state {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.0625rem 0.4rem;
      border-radius: 9999px;
      font-size: 0.6rem;
      font-weight: 800;
      line-height: 1.5;
      white-space: nowrap;
    }
    .aj-state[data-estado="en_curso"]   { background: rgb(209 250 229); color: rgb(6 95 70); }
    .aj-state[data-estado="proxima"]    { background: rgb(224 242 254); color: rgb(7 89 133); }
    .aj-state[data-estado="finalizada"] { background: rgb(241 245 249); color: rgb(100 116 139); }
    :host-context(.dark) .aj-state[data-estado="en_curso"]   { background: rgb(6 78 59 / 0.45);  color: rgb(110 231 183); }
    :host-context(.dark) .aj-state[data-estado="proxima"]    { background: rgb(12 74 110 / 0.45); color: rgb(125 211 252); }
    :host-context(.dark) .aj-state[data-estado="finalizada"] { background: rgb(51 65 85 / 0.5);   color: rgb(148 163 184); }

    span[data-estado="en_curso"] { color: rgb(5 150 105); }
    span[data-estado="proxima"]  { color: rgb(2 132 199); }
    :host-context(.dark) span[data-estado="en_curso"] { color: rgb(52 211 153); }
    :host-context(.dark) span[data-estado="proxima"]  { color: rgb(56 189 248); }

    .aj-dot {
      width: 0.3125rem;
      height: 0.3125rem;
      border-radius: 9999px;
      background: currentColor;
      animation: aj-pulse 2s ease-in-out infinite;
    }
    @keyframes aj-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
    @media (prefers-reduced-motion: reduce) { .aj-dot { animation: none; } }
  `],
})
export class ReunionesAjustesDialogComponent {
  private readonly reunionesSvc = inject(ReunionesService);
  private readonly congregacionCtx = inject(CongregacionContextService);

  /**
   * Las dos listas se piden la primera vez que se abre, no al arrancar la
   * pantalla: la mayoría de las sesiones de programación nunca tocan esto.
   */
  @Input() set abierto(v: boolean) {
    this._abierto = v;
    if (!v) return;
    if (!this.semanasCargadas) this.cargarSemanas();
    if (!this.ausenciasCargadas) this.cargarAusencias();
    if (!this.publicadoresCargados) this.cargarPublicadores();
  }
  get abierto(): boolean { return this._abierto; }
  private _abierto = false;

  @Output() cerrado = new EventEmitter<void>();

  /** Algo cambió que afecta a lo programado: la pantalla anfitriona recarga. */
  @Output() cambios = new EventEmitter<void>();

  tab = signal<AjustesTab>('semanas');

  // ── Semanas sin reunión ──
  semanas = signal<SemanaSinReunion[]>([]);
  loadingSemanas = signal(false);
  guardandoSemana = signal(false);
  semanaError = signal<string | null>(null);
  /** Resultado del dry_run: lo que se borraría si se confirma. */
  semanaAConfirmar = signal<SemanaSinReunion | null>(null);
  ssrFecha: string | null = null;
  ssrAlcance: AlcanceSemana = 'ambas';
  ssrMotivo = '';
  private semanasCargadas = false;

  readonly opcionesAlcance: PickerOption[] = [
    { value: 'ambas', label: 'Ambas reuniones' },
    { value: 'entre_semana', label: 'Solo entre semana' },
    { value: 'fin_semana', label: 'Solo fin de semana' },
  ];

  // ── Ausencias ──
  ausencias = signal<AusenciaOut[]>([]);
  loadingAusencias = signal(false);
  guardandoAusencia = signal(false);
  ausenciaError = signal<string | null>(null);
  ausFiltro = signal('');
  ausIdPublicador: number | null = null;
  ausFechaInicio: string | null = null;
  ausFechaFin: string | null = null;
  ausMotivo = '';
  private ausenciasCargadas = false;

  private publicadores = signal<{ id_publicador: number; primer_nombre: string; primer_apellido: string }[]>([]);
  private publicadoresCargados = false;

  /** El valor que viaja es el id, no el nombre. Ordenado por apellido, igual
   *  que en la matriz de privilegios: la gente se busca por apellido. */
  opcionesPublicador = computed<PickerOption[]>(() =>
    [...this.publicadores()]
      .sort((a, b) =>
        (a.primer_apellido + ' ' + a.primer_nombre).localeCompare(b.primer_apellido + ' ' + b.primer_nombre))
      .map((p) => ({
        value: p.id_publicador,
        label: nombreMostrado(p),
      })),
  );

  /**
   * Ordena por relevancia, no por fecha bruta: lo que pasa ahora va primero,
   * luego lo que viene y al final lo que ya terminó. Ordenada sólo por fecha,
   * la lista entierra lo urgente debajo de lo caducado.
   */
  ausenciasOrdenadas = computed<AusenciaOut[]>(() => {
    const peso: Record<string, number> = { en_curso: 0, proxima: 1, finalizada: 2 };
    const q = this.ausFiltro().trim().toLowerCase();

    return [...this.ausencias()]
      .filter((a) => !q
        || a.nombre_completo.toLowerCase().includes(q)
        || (a.motivo ?? '').toLowerCase().includes(q))
      .sort((a, b) => {
        const da = peso[this.estadoAusencia(a)];
        const db = peso[this.estadoAusencia(b)];
        if (da !== db) return da - db;
        return da === 2
          ? b.fecha_fin.localeCompare(a.fecha_fin)
          : a.fecha_inicio.localeCompare(b.fecha_inicio);
      });
  });

  ausenciasEnCurso = computed(
    () => this.ausencias().filter((a) => this.estadoAusencia(a) === 'en_curso').length);
  ausenciasProximas = computed(
    () => this.ausencias().filter((a) => this.estadoAusencia(a) === 'proxima').length);

  /** Borrado pendiente de confirmar, sea de una semana o de una ausencia. */
  confirmarBorrado = signal<{ titulo: string; mensaje: string; textoOk: string; accion: () => void } | null>(null);

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this._abierto) return;
    // Escape cierra de dentro hacia fuera: primero la confirmación abierta,
    // y sólo si no hay ninguna, el modal entero.
    if (this.semanaAConfirmar()) { this.semanaAConfirmar.set(null); return; }
    if (this.confirmarBorrado()) { this.confirmarBorrado.set(null); return; }
    this.pedirCierre();
  }

  ejecutarBorrado(): void {
    const c = this.confirmarBorrado();
    if (!c) return;
    this.confirmarBorrado.set(null);
    c.accion();
  }

  pedirCierre(): void {
    this.semanaError.set(null);
    this.ausenciaError.set(null);
    this.cerrado.emit();
  }

  // ── Carga ──────────────────────────────────────────────────────
  private cargarSemanas(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    this.loadingSemanas.set(true);
    this.semanasCargadas = true;
    this.reunionesSvc.getSemanasSinReunion(idCong).subscribe({
      next: (res) => { this.semanas.set(res); this.loadingSemanas.set(false); },
      error: () => this.loadingSemanas.set(false),
    });
  }

  private cargarAusencias(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    this.loadingAusencias.set(true);
    this.ausenciasCargadas = true;
    this.reunionesSvc.getAusencias(idCong).subscribe({
      next: (res) => { this.ausencias.set(res); this.loadingAusencias.set(false); },
      error: () => this.loadingAusencias.set(false),
    });
  }

  /** El picker de publicador se surte de la misma matriz de configuración que
   *  usa la pantalla de privilegios. */
  private cargarPublicadores(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    this.publicadoresCargados = true;
    this.reunionesSvc.getMatrizConfiguracion(idCong).subscribe({
      next: (res) => this.publicadores.set(res.publicadores),
      error: () => { this.publicadoresCargados = false; },
    });
  }

  // ── Semanas sin reunión ────────────────────────────────────────
  /** Plano y no computed: los campos del formulario son propiedades para
   *  poder usar [(ngModel)], no señales, y un computed no se reevaluaría. */
  puedeMarcarSemana(): boolean {
    return !!this.ssrFecha;
  }

  /** Primero un dry_run para saber cuántas asignaciones se perderían, y sólo
   *  entonces se pide confirmación: el borrado es irreversible. */
  prepararSemana(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || !this.puedeMarcarSemana()) return;

    this.guardandoSemana.set(true);
    this.semanaError.set(null);

    this.reunionesSvc.crearSemanaSinReunion({
      id_congregacion: idCong,
      fecha: this.ssrFecha!,
      alcance: this.ssrAlcance,
      motivo: this.ssrMotivo.trim() || null,
      dry_run: true,
    }).subscribe({
      next: (previo) => {
        this.guardandoSemana.set(false);
        this.semanaAConfirmar.set(previo);
      },
      error: (err) => {
        this.guardandoSemana.set(false);
        this.semanaError.set(err?.error?.detail ?? 'No se pudo comprobar la semana.');
      },
    });
  }

  confirmarMarcarSemana(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || !this.ssrFecha) return;

    this.guardandoSemana.set(true);
    this.reunionesSvc.crearSemanaSinReunion({
      id_congregacion: idCong,
      fecha: this.ssrFecha,
      alcance: this.ssrAlcance,
      motivo: this.ssrMotivo.trim() || null,
    }).subscribe({
      next: (nueva) => {
        this.guardandoSemana.set(false);
        this.semanaAConfirmar.set(null);
        // Puede ser un alta o la actualización de la misma semana.
        this.semanas.update((list) => [
          nueva,
          ...list.filter((x) => x.id_semana_sin_reunion !== nueva.id_semana_sin_reunion),
        ]);
        this.ssrFecha = null;
        this.ssrAlcance = 'ambas';
        this.ssrMotivo = '';
        this.cambios.emit();
      },
      error: (err) => {
        this.guardandoSemana.set(false);
        this.semanaAConfirmar.set(null);
        this.semanaError.set(err?.error?.detail ?? 'No se pudo marcar la semana.');
      },
    });
  }

  pedirQuitarSemana(s: SemanaSinReunion): void {
    this.confirmarBorrado.set({
      titulo: 'Quitar la marca',
      mensaje: this.formatRangoSemana(s) + ' volverá a programarse. Las asignaciones ya borradas'
        + ' no se recuperan: hay que generar el mes de nuevo.',
      textoOk: 'Quitar',
      accion: () => this.quitarSemana(s),
    });
  }

  private quitarSemana(s: SemanaSinReunion): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;

    this.reunionesSvc.eliminarSemanaSinReunion(s.id_semana_sin_reunion, idCong).subscribe({
      next: () => {
        this.semanas.update((list) =>
          list.filter((x) => x.id_semana_sin_reunion !== s.id_semana_sin_reunion));
        this.cambios.emit();
      },
      error: (err) => this.semanaError.set(err?.error?.detail ?? 'No se pudo quitar la marca.'),
    });
  }

  etiquetaAlcance(alcance: AlcanceSemana): string {
    return this.opcionesAlcance.find((o) => o.value === alcance)?.label ?? alcance;
  }

  /** "8 – 14 jun 2026", omitiendo el mes repetido cuando no lo cruza. */
  formatRangoSemana(s: SemanaSinReunion): string {
    const ini = new Date(s.fecha_inicio + 'T00:00:00');
    const fin = new Date(s.fecha_fin + 'T00:00:00');
    const mesIni = ini.toLocaleDateString('es', { month: 'short' });
    const mesFin = fin.toLocaleDateString('es', { month: 'short' });
    const cabecera = mesIni === mesFin
      ? ini.getDate() + ' – ' + fin.getDate() + ' ' + mesFin
      : ini.getDate() + ' ' + mesIni + ' – ' + fin.getDate() + ' ' + mesFin;
    return cabecera + ' ' + fin.getFullYear();
  }

  // ── Ausencias ──────────────────────────────────────────────────
  /** Plano por el mismo motivo que puedeMarcarSemana. */
  puedeRegistrarAusencia(): boolean {
    return this.ausIdPublicador !== null && !!this.ausFechaInicio && !!this.ausFechaFin;
  }

  registrarAusencia(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || !this.puedeRegistrarAusencia()) return;

    if (this.ausFechaFin! < this.ausFechaInicio!) {
      this.ausenciaError.set('La fecha de fin no puede ser anterior a la de inicio.');
      return;
    }

    this.guardandoAusencia.set(true);
    this.ausenciaError.set(null);

    this.reunionesSvc.crearAusencia({
      id_congregacion: idCong,
      id_publicador: this.ausIdPublicador!,
      fecha_inicio: this.ausFechaInicio!,
      fecha_fin: this.ausFechaFin!,
      motivo: this.ausMotivo.trim() || null,
    }).subscribe({
      next: (nueva) => {
        this.ausencias.update((list) => [nueva, ...list]);
        this.guardandoAusencia.set(false);
        this.ausIdPublicador = null;
        this.ausFechaInicio = null;
        this.ausFechaFin = null;
        this.ausMotivo = '';
        this.cambios.emit();
      },
      error: (err) => {
        this.guardandoAusencia.set(false);
        this.ausenciaError.set(err?.error?.detail ?? 'No se pudo registrar la ausencia.');
      },
    });
  }

  pedirEliminarAusencia(a: AusenciaOut): void {
    this.confirmarBorrado.set({
      titulo: 'Eliminar ausencia',
      mensaje: a.nombre_completo + ' volverá a estar disponible del ' + this.formatRangoAusencia(a) + '.',
      textoOk: 'Eliminar',
      accion: () => this.eliminarAusencia(a),
    });
  }

  private eliminarAusencia(a: AusenciaOut): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;

    this.reunionesSvc.eliminarAusencia(a.id_ausencia, idCong).subscribe({
      next: () => {
        this.ausencias.update((list) => list.filter((x) => x.id_ausencia !== a.id_ausencia));
        this.cambios.emit();
      },
      error: (err) => this.ausenciaError.set(err?.error?.detail ?? 'No se pudo eliminar la ausencia.'),
    });
  }

  /**
   * Estado respecto a hoy. Es lo que separa "no está disponible ahora mismo"
   * de "esto ya pasó": sin esto la lista es plana y hay que leer fecha a fecha.
   */
  estadoAusencia(a: AusenciaOut): 'en_curso' | 'proxima' | 'finalizada' {
    const hoy = this.hoyISO();
    if (a.fecha_fin < hoy) return 'finalizada';
    if (a.fecha_inicio > hoy) return 'proxima';
    return 'en_curso';
  }

  estadoLabel(a: AusenciaOut): string {
    switch (this.estadoAusencia(a)) {
      case 'en_curso': return 'En curso';
      case 'proxima':  return 'Próxima';
      default:         return 'Finalizada';
    }
  }

  /** Cuánto falta o cuánto queda: evita hacer la cuenta mentalmente. */
  estadoDetalle(a: AusenciaOut): string {
    const estado = this.estadoAusencia(a);
    if (estado === 'en_curso') {
      const faltan = this.diasEntre(this.hoyISO(), a.fecha_fin);
      if (faltan === 0) return 'Termina hoy';
      return faltan === 1 ? 'Termina mañana' : 'Termina en ' + faltan + ' días';
    }
    if (estado === 'proxima') {
      const faltan = this.diasEntre(this.hoyISO(), a.fecha_inicio);
      return faltan === 1 ? 'Empieza mañana' : 'Empieza en ' + faltan + ' días';
    }
    return 'Finalizada';
  }

  /** Duración total del rango, inclusiva en ambos extremos. */
  duracion(a: AusenciaOut): string {
    const dias = this.diasEntre(a.fecha_inicio, a.fecha_fin) + 1;
    return dias === 1 ? '1 día' : dias + ' días';
  }

  iniciales(a: AusenciaOut): string {
    const partes = a.nombre_completo.trim().split(/\s+/);
    const primera = partes[0]?.[0] ?? '';
    const segunda = partes.length > 1 ? partes[partes.length - 1][0] : '';
    return (primera + segunda).toUpperCase();
  }

  avatarClass(a: AusenciaOut): string {
    return getInitialAvatarStyle(a.nombre_completo.trim() || '');
  }

  /**
   * Rango compacto: el año se escribe una sola vez al final cuando ambos
   * extremos caen en el mismo. El formato largo partía la línea en móvil.
   */
  formatRangoAusencia(a: AusenciaOut): string {
    const partes = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      const fecha = new Date(y, m - 1, d);
      const mes = fecha.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
      return { dia: d, mes, ano: y };
    };

    const ini = partes(a.fecha_inicio);
    const fin = partes(a.fecha_fin);

    if (a.fecha_inicio === a.fecha_fin) {
      return ini.dia + ' ' + ini.mes + ' ' + ini.ano;
    }
    if (ini.ano === fin.ano) {
      return ini.dia + ' ' + ini.mes + ' – ' + fin.dia + ' ' + fin.mes + ' ' + fin.ano;
    }
    return ini.dia + ' ' + ini.mes + ' ' + ini.ano + ' – ' + fin.dia + ' ' + fin.mes + ' ' + fin.ano;
  }

  private hoyISO(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + mm + '-' + dd;
  }

  private diasEntre(desdeISO: string, hastaISO: string): number {
    const toDate = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    return Math.round((toDate(hastaISO).getTime() - toDate(desdeISO).getTime()) / 86400000);
  }
}
