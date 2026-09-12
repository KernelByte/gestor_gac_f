import {
  Component, signal, computed, inject, OnInit, effect, untracked, HostListener,
} from '@angular/core';
import { Observable, Subject, debounceTime, distinctUntilChanged, forkJoin, switchMap, EMPTY } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DatePickerComponent } from '../../../shared/components/date-picker/date-picker.component';
import { TimePickerComponent } from '../../../shared/components/time-picker/time-picker.component';
import { whatsappUrl } from '../../../shared/whatsapp';
import { UbicacionPickerComponent } from './ubicacion-picker.component';
import { DiscursoCatalogoInputComponent } from './discurso-catalogo-input.component';
import { CongregacionContactoInputComponent } from './congregacion-contacto-input.component';
import { HistorialDiscursosComponent } from './historial-discursos.component';
import { DiscursosService } from '../services/discursos.service';
import { ConflictosService } from '../services/conflictos.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  CatalogoDiscurso,
  CongregacionContacto,
  ContactoPersona,
  CrearTemaRequest,
  DiscursoEntranteOut,
  DiscursosMesOut,
  DiscursoSalienteOut,
  EditarTemaRequest,
  GrupoSimple,
  HistorialOcurrenciaEntrante,
  MesDiscursosDisponible,
  MESES_ES,
  PublicadorSimple,
  TemaPublicador,
  UbicacionSaliente,
} from '../models/discursos.models';

type Estado = 'idle' | 'loading' | 'ready' | 'error';
type SubTab = 'entrantes' | 'salientes' | 'temas' | 'congregaciones';

@Component({
  selector: 'app-reuniones-discursos',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePickerComponent, TimePickerComponent, UbicacionPickerComponent, DiscursoCatalogoInputComponent, CanticoCatalogoInputComponent, CongregacionContactoInputComponent, OradorCatalogoInputComponent, HistorialDiscursosComponent, Hora12Pipe],
  template: `
    <div class="flex flex-col h-full gap-0">

      <!-- ===== BARRA SUPERIOR ===== -->
      <!-- Comparte fila la píldora de pestañas que proyecta el shell con los
           controles del mes: la banda del título iba de lado a lado con casi
           todo el ancho vacío y repetía lo que la píldora encendida ya dice.
           Los controles sólo aparecen con un mes abierto; sin él, la lista
           vive centrada en la tarjeta del panel. -->
      <div class="shrink-0 flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-2 pb-3 min-w-0">

        <ng-content select="[cabecera]"></ng-content>

        <!-- Empuja la bandeja y lo que venga en [accion-derecha] juntos al
             extremo derecho, sin hueco entre ellos. -->
        <span class="hidden md:block md:flex-1" aria-hidden="true"></span>

        <!-- Filete: separa la píldora del resto de la barra. Sólo con un mes
             abierto: sin él la bandeja se va al otro extremo y el filete
             quedaba suelto a media fila. -->
        @if (mesDatos() && estado() !== 'loading') {
          <span class="hidden md:block w-px h-7 bg-slate-200 dark:bg-slate-700 shrink-0" aria-hidden="true"></span>
        }

        <!-- ===== BANDEJA DE CONTROL ===== -->
        <div class="flex flex-wrap items-center gap-0.5 min-w-0 w-full md:w-auto md:ml-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-1">

          <!-- El selector de mes sólo con un mes abierto: sin él, la lista
               vive centrada en la tarjeta del panel. -->
          @if (mesDatos() && estado() !== 'loading') {
            <div class="relative shrink-0" data-mes-menu>
              <button
                type="button"
                data-testid="disc-selector-mes"
                (click)="menuMesesAbierto.set(!menuMesesAbierto())"
                [attr.aria-expanded]="menuMesesAbierto()"
                aria-haspopup="listbox"
                aria-label="Cambiar de mes"
                class="flex items-center gap-1.5 h-8 px-2.5 rounded-xl transition-colors"
                [class]="menuMesesAbierto()
                  ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                  : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'">
                <svg class="w-3.5 h-3.5 shrink-0 text-violet-500/80 dark:text-violet-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 3v3M16 3v3"/></svg>
                <span class="text-sm font-bold whitespace-nowrap">{{ mesLabel(mesDatos()!.ano, mesDatos()!.mes) }}</span>
                <svg class="w-3.5 h-3.5 shrink-0 opacity-50 transition-transform duration-200" [class.rotate-180]="menuMesesAbierto()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>

              @if (menuMesesAbierto()) {
                <div role="listbox" aria-label="Meses programados" class="disc-dropdown absolute z-40 top-[calc(100%+4px)] left-0 w-64 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
                  <div class="max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain simple-scrollbar p-1.5">
                    @for (grupo of mesesPorAno(); track grupo.ano) {
                      <!-- Año como divisor del grupo, no repetido por fila. -->
                      <p class="flex items-center gap-2 px-1.5 pt-2.5 pb-1 first:pt-0.5">
                        <span class="text-[0.65rem] font-bold text-slate-400 dark:text-slate-500 data-num">{{ grupo.ano }}</span>
                        <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
                      </p>
                      @for (m of grupo.meses; track m.ano + '-' + m.mes) {
                        <button
                          type="button"
                          role="option"
                          data-testid="disc-fila-mes"
                          [attr.data-ano]="m.ano"
                          [attr.data-mes]="m.mes"
                          [attr.aria-selected]="esMesActivo(m)"
                          (click)="cargarMes(m.ano, m.mes); menuMesesAbierto.set(false)"
                          [disabled]="estado() === 'loading'"
                          class="w-full flex items-center gap-2 px-2 h-9 rounded-lg text-xs transition-colors disabled:opacity-40"
                          [class]="esMesActivo(m)
                            ? 'bg-violet-50 dark:bg-violet-900/25 text-violet-700 dark:text-violet-300 font-bold'
                            : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'">
                          @if (m.confirmado) {
                            <svg class="w-3 h-3 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                          }
                          <span class="flex-1 min-w-0 truncate text-left">{{ mesSoloLabel(m.mes) }}</span>
                          @if (esMesActivo(m)) {
                            <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          }
                        </button>
                      }
                    }
                  </div>
                  @if (hasEditPermission()) {
                    <div class="shrink-0 p-1.5 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        data-testid="disc-btn-generar-mes"
                        (click)="menuMesesAbierto.set(false); abrirModalGenerar()"
                        [disabled]="estado() === 'loading'"
                        class="w-full flex items-center justify-center gap-2 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 text-xs font-bold text-white transition-all active:scale-[0.98]">
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Generar Mes
                      </button>
                    </div>
                  }
                </div>
              }
            </div>

            <span class="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" aria-hidden="true"></span>
          }

            <!-- Historial / Temas / Congregaciones: catálogos que no dependen
                 del mes abierto, así que están siempre. -->
            <button (click)="abrirModalHistorial()"
              title="Historial de discursos" aria-label="Historial de discursos"
              class="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[0.7rem] font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 transition-colors active:scale-[0.97]">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="9"/>
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 7v5l3 3"/>
              </svg>
              <span class="hidden sm:inline">Historial</span>
            </button>
            <button (click)="subTab.set('temas')"
              role="tab" [attr.aria-selected]="subTab() === 'temas'"
              title="Portafolio de temas"
              class="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[0.7rem] font-bold transition-colors active:scale-[0.97]"
              [class]="subTab() === 'temas'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
              </svg>
              <span>Temas</span>
            </button>
            <button (click)="subTab.set('congregaciones')"
              role="tab" [attr.aria-selected]="subTab() === 'congregaciones'"
              title="Congregaciones de contacto"
              class="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[0.7rem] font-bold transition-colors active:scale-[0.97]"
              [class]="subTab() === 'congregaciones'
                ? 'bg-teal-500 text-white shadow-sm'
                : 'text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20'">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
              <span class="hidden sm:inline">Congregaciones</span>
            </button>
        </div>

        <!-- Fuera de la bandeja: siempre cae al extremo derecho de la fila,
             justo después de ella. -->
        <ng-content select="[accion-derecha]"></ng-content>
      </div>


      <!-- ERROR -->
      @if (estado() === 'error') {
        <div class="shrink-0 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 mb-3 flex items-center gap-3">
          <svg class="w-4 h-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p class="flex-1 min-w-0 text-red-600 dark:text-red-400 text-xs font-medium truncate">{{ errorMsg() }}</p>
          <button (click)="estado.set('idle')" class="shrink-0 px-3 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 text-xs text-red-600 font-bold">Cerrar</button>
        </div>
      }

      <!-- CONFIRMADO banner -->
      @if (confirmadoBanner()) {
        <div class="shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/50 px-4 py-3 mb-3 flex items-center gap-3">
          <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <p class="text-emerald-700 dark:text-emerald-300 text-xs font-bold">Discursos confirmados correctamente.</p>
        </div>
      }

      <!-- MODAL DE CONFIRMACIÓN (reemplaza window.confirm) -->
      @if (confirmPendiente()) {
        <div class="disc-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div class="disc-dialog bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 flex flex-col gap-4 border border-slate-200 dark:border-slate-700">
            <div class="flex items-start gap-3">
              <div class="shrink-0 w-9 h-9 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg class="w-4.5 h-4.5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
              </div>
              <div>
                <p class="text-sm font-bold text-slate-900 dark:text-white">{{ confirmPendiente()!.titulo }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">{{ confirmPendiente()!.mensaje }}</p>
              </div>
            </div>
            <div class="flex gap-2 justify-end">
              <button (click)="cancelarConfirm()"
                class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                Cancelar
              </button>
              <button (click)="aceptarConfirm()"
                class="px-4 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-xs font-bold text-white transition-all active:scale-95">
                {{ confirmPendiente()!.accionLabel }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- LAYOUT -->
      <!-- Sin barra lateral: el historial de meses vivía en una columna fija
           de hasta 16rem que sólo se usaba al elegir el mes. Ahora es un
           selector desplegable dentro de la barra de pestañas (igual que
           Logística), y ese ancho es de la lista de discursos el resto del
           tiempo. -->
      <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative">

          <!-- Sub-pestañas del mes abierto. Los catálogos que no dependen
               del mes (Historial, Temas, Congregaciones) viven arriba, en la
               bandeja de control. -->
          @if (mesDatos()) {
            <div class="shrink-0 flex items-center gap-2 px-1.5 py-1.5 border-b border-slate-100 dark:border-slate-800">
              <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl p-1" role="tablist">
                <button (click)="subTab.set('entrantes')"
                  role="tab" [attr.aria-selected]="subTab() === 'entrantes'"
                  class="flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]"
                  [class]="subTab() === 'entrantes'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
                  <!-- Entrantes: flecha apuntando hacia adentro (recepción) -->
                  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 12h13M10 6l-6 6 6 6"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 5v14" opacity=".4"/>
                  </svg>
                  <span>Entrantes</span>
                </button>
                <button (click)="subTab.set('salientes')"
                  role="tab" [attr.aria-selected]="subTab() === 'salientes'"
                  class="flex items-center justify-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97]"
                  [class]="subTab() === 'salientes'
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
                  <!-- Salientes: flecha apuntando hacia afuera (salida) -->
                  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 12H8M14 6l6 6-6 6"/>
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 5v14" opacity=".4"/>
                  </svg>
                  <span>Salientes</span>
                </button>
              </div>
            </div>
          }

          @if (subTab() === 'congregaciones') {
            <!-- CONGREGACIONES DE CONTACTO tab -->
            <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar flex flex-col gap-3 p-3 sm:p-4">
              @if (hasEditPermission()) {
                <button (click)="abrirModalCongregacionContacto()"
                  class="self-start flex items-center gap-2 px-4 h-9 rounded-xl border-2 border-dashed border-teal-400 dark:border-teal-600 text-xs font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all active:scale-95">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Añadir congregación
                </button>
              }
              @if (loadingCongregacionesContacto()) {
                <div class="flex items-center justify-center py-12">
                  <div class="w-7 h-7 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-teal-500 animate-spin"></div>
                </div>
              } @else if (congregacionesContacto().length === 0) {
                <div class="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <svg class="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  </div>
                  <div>
                    <p class="text-sm font-bold text-slate-600 dark:text-slate-500">Sin congregaciones registradas</p>
                    <p class="text-xs text-slate-400 mt-0.5">Guarda las congregaciones con las que coordinas discursos para autocompletar hora y ubicación</p>
                  </div>
                </div>
              } @else {
                @for (c of congregacionesContacto(); track c.id_congregacion_contacto) {
                  <!-- shrink-0: la lista es un flex column con scroll, y sin esto
                       las tarjetas se comprimen para caber en la altura visible
                       en vez de desbordar, recortando su propio contenido. -->
                  <div class="shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden transition-shadow duration-150"
                    [class.shadow-sm]="congregacionContactoExpandidaId() === c.id_congregacion_contacto">

                    <!-- Fila compacta: toda la tarjeta es clicable para expandir,
                         salvo los botones de acción, que paran la propagación.
                         div en vez de button porque contiene botones reales
                         (editar/eliminar) y un button no puede anidar otro. -->
                    <div role="button" tabindex="0"
                      [attr.aria-expanded]="congregacionContactoExpandidaId() === c.id_congregacion_contacto"
                      (click)="toggleCongregacionContacto(c.id_congregacion_contacto)"
                      (keydown.enter)="toggleCongregacionContacto(c.id_congregacion_contacto)"
                      (keydown.space)="$event.preventDefault(); toggleCongregacionContacto(c.id_congregacion_contacto)"
                      class="w-full flex items-center gap-3 px-3 py-3 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                      <div class="w-9 h-9 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center text-sm font-black text-teal-600 dark:text-teal-400 shrink-0">
                        {{ c.nombre.charAt(0).toUpperCase() }}
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{{ c.nombre }}</p>
                        <div class="flex flex-wrap items-center gap-x-2 gap-y-1 mt-0.5">
                          @if (c.dia_reunion_fin_semana || c.hora_reunion_fin_semana) {
                            <span class="inline-flex items-center gap-1 text-[0.7rem] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              <svg class="w-3 h-3 text-slate-400 dark:text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                              {{ diaLabel(c.dia_reunion_fin_semana) }}{{ c.hora_reunion_fin_semana ? ' · ' + (c.hora_reunion_fin_semana | hora12) : '' }}
                            </span>
                          }
                          <!-- Cada chip lleva el color e icono de su sección en el
                               detalle: lo que se cuenta aquí se encuentra abajo por
                               el mismo color, sin leer los rótulos. -->
                          @if (c.discursantes.length) {
                            <span class="shrink-0 inline-flex items-center gap-1 text-[0.65rem] font-bold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-400/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>
                              {{ c.discursantes.length }} discursante{{ c.discursantes.length === 1 ? '' : 's' }}
                            </span>
                          }
                          @if (c.personas.length) {
                            <span class="shrink-0 inline-flex items-center gap-1 text-[0.65rem] font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-400/10 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                              <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                              {{ c.personas.length }} contacto{{ c.personas.length === 1 ? '' : 's' }}
                            </span>
                          }
                        </div>
                      </div>
                      @if (hasEditPermission()) {
                        <div class="shrink-0 flex items-center gap-1" (click)="$event.stopPropagation()">
                          <button (click)="abrirModalCongregacionContacto(c)" title="Editar"
                            class="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button (click)="confirmarEliminarCongregacionContacto(c)" title="Eliminar"
                            class="w-9 h-9 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      }
                      <svg class="shrink-0 w-4 h-4 text-slate-300 dark:text-slate-600 transition-transform duration-200"
                        [class.rotate-180]="congregacionContactoExpandidaId() === c.id_congregacion_contacto"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                      </svg>
                    </div>

                    <!-- Detalle: sólo se pinta cuando la tarjeta está abierta, así
                         una lista larga no obliga a renderizar (ni cargar el
                         mapa de) cada ubicación a la vez.
                         Tres secciones que se distinguen por color + icono, no
                         sólo por un rótulo gris: violeta = dónde se reúnen,
                         teal = discursantes, azul = contactos. Los mismos
                         colores que los chips de la fila compacta. -->
                    @if (congregacionContactoExpandidaId() === c.id_congregacion_contacto) {
                      <div class="cong-detalle @container flex flex-col gap-4 border-t border-slate-100 dark:border-slate-800 px-3 pt-3 pb-4 sm:px-4">

                        <!-- Dónde se reúnen -->
                        <section class="flex flex-col gap-2" [attr.aria-label]="'Ubicación de ' + c.nombre">
                          <h4 class="flex items-center gap-2 text-[0.8rem] font-bold text-violet-700 dark:text-violet-300">
                            <span class="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-400/15 flex items-center justify-center shrink-0" aria-hidden="true">
                              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                            </span>
                            Dónde se reúnen
                          </h4>
                          @if (ubicacionDeContacto(c)) {
                            <app-ubicacion-picker size="sm" [ngModel]="ubicacionDeContacto(c)" [ngModelOptions]="{ standalone: true }" [disabled]="true"></app-ubicacion-picker>
                          } @else {
                            <p class="text-xs text-slate-400 dark:text-slate-500">Sin dirección registrada.</p>
                          }
                          @if (c.notas) {
                            <!-- La nota suele ser una indicación para coordinar
                                 ("con dos semanas de anticipación"): ámbar para
                                 que se lea antes de escribirles, no gris de relleno. -->
                            <div class="flex items-start gap-2.5 rounded-lg bg-amber-50 dark:bg-amber-400/[0.07] ring-1 ring-inset ring-amber-200/70 dark:ring-amber-400/20 px-3 py-2.5">
                              <svg class="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                              <div class="min-w-0 flex-1">
                                <p class="text-[0.65rem] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Nota</p>
                                <p class="text-xs text-amber-900 dark:text-amber-100/90 leading-relaxed whitespace-pre-line max-w-[70ch]">{{ c.notas }}</p>
                              </div>
                            </div>
                          }
                          @if (archivosDeCongregacion(c).length) {
                            <!-- Antes era un chip de 28px gris-sobre-gris que se
                                 perdía debajo de la nota ámbar; ahora lleva su
                                 propia etiqueta (como las demás secciones) y el
                                 violeta de "Dónde se reúnen", con más alto y
                                 el peso del archivo visible, para que se note
                                 que hay algo que abrir. -->
                            <div class="flex flex-col gap-1.5">
                              <span class="text-[0.65rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                Archivo{{ archivosDeCongregacion(c).length === 1 ? '' : 's' }} adjunto{{ archivosDeCongregacion(c).length === 1 ? '' : 's' }}
                              </span>
                              <div class="flex flex-col gap-1.5">
                                @for (a of archivosDeCongregacion(c); track a.nombre) {
                                  <button type="button" (click)="abrirArchivoDeCongregacion(c, a.nombre)" [title]="'Abrir ' + a.nombre"
                                    class="w-full flex items-center gap-2.5 h-11 pl-2.5 pr-3 rounded-xl border border-violet-200 dark:border-violet-400/25 bg-violet-50/70 dark:bg-violet-400/[0.07] hover:bg-violet-100 dark:hover:bg-violet-400/[0.12] hover:border-violet-300 dark:hover:border-violet-400/40 transition-[background-color,border-color] duration-150 ease-out active:scale-[0.99]">
                                    <span class="shrink-0 w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-400/15 text-violet-600 dark:text-violet-300 flex items-center justify-center" aria-hidden="true">
                                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                                    </span>
                                    <span class="min-w-0 flex-1 truncate text-left text-xs font-semibold text-slate-700 dark:text-slate-200">{{ a.nombre }}</span>
                                    <span class="shrink-0 text-[0.65rem] font-medium text-slate-400 dark:text-slate-500">{{ formatoTamanoArchivo(a.tamano_bytes) }}</span>
                                    <svg class="shrink-0 w-3.5 h-3.5 text-violet-400 dark:text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17L17 7M7 7h10v10"/></svg>
                                  </button>
                                }
                              </div>
                            </div>
                          }
                        </section>

                        <!-- Personas: lado a lado cuando la tarjeta es ancha, así el
                             teléfono queda cerca del nombre en vez de al otro
                             extremo de la pantalla; apiladas en móvil. -->
                        <div class="grid gap-3 @3xl:grid-cols-2 @3xl:items-start">

                          <section class="@container rounded-xl bg-teal-50/60 dark:bg-teal-400/[0.04] ring-1 ring-inset ring-teal-200/60 dark:ring-teal-400/15" [attr.aria-label]="'Discursantes de ' + c.nombre">
                            <header class="flex items-center gap-2 px-3 pt-3 pb-2">
                              <span class="w-6 h-6 rounded-md bg-teal-100 dark:bg-teal-400/15 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0" aria-hidden="true">
                                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>
                              </span>
                              <div class="min-w-0 flex-1">
                                <h4 class="text-[0.8rem] font-bold text-teal-800 dark:text-teal-200 leading-tight">Discursantes</h4>
                                <p class="text-[0.7rem] text-teal-700/70 dark:text-teal-300/60 leading-tight">Oradores que envía esta congregación</p>
                              </div>
                              <span class="shrink-0 min-w-6 h-6 px-1.5 rounded-full bg-teal-100 dark:bg-teal-400/15 text-[0.7rem] font-bold text-teal-700 dark:text-teal-300 flex items-center justify-center tabular-nums">{{ c.discursantes.length }}</span>
                            </header>
                            <ul class="flex flex-col divide-y divide-teal-100 dark:divide-teal-400/10 px-1.5 pb-1.5">
                              @for (d of c.discursantes; track d.id_discursante) {
                                <li class="flex flex-col @md:flex-row @md:items-center gap-2 @md:gap-3 rounded-lg px-1.5 py-2 hover:bg-white/70 dark:hover:bg-slate-800/40 transition-colors">
                                  <div class="min-w-0 flex-1 flex items-start gap-2.5">
                                    <span class="w-8 h-8 rounded-full bg-teal-600 dark:bg-teal-500/80 text-white text-xs font-black flex items-center justify-center shrink-0" aria-hidden="true">{{ d.nombre.charAt(0).toUpperCase() }}</span>
                                    <div class="min-w-0 flex-1">
                                      <p class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{{ d.nombre }}</p>
                                      @if (d.bosquejos.length > 0) {
                                        <!-- Un renglón por bosquejo: son los que se ofrecen al
                                             programarlo como entrante, así que se leen todos. -->
                                        <ul class="flex flex-col gap-1 mt-1">
                                          @for (b of d.bosquejos; track b) {
                                            @let t = partirTema(b);
                                            <li class="flex items-baseline gap-1.5 min-w-0" [title]="b">
                                              <span class="shrink-0 font-mono text-[0.65rem] font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-400/15 px-1.5 py-px rounded tabular-nums">{{ t.numero ? 'Nº ' + t.numero : 'Sin nº' }}</span>
                                              <span class="min-w-0 text-xs text-slate-600 dark:text-slate-300 leading-snug line-clamp-2">{{ t.titulo }}</span>
                                            </li>
                                          }
                                        </ul>
                                      } @else {
                                        <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Sin bosquejos registrados</p>
                                      }
                                    </div>
                                  </div>
                                  <ng-container *ngTemplateOutlet="accionesContacto; context: { $implicit: d }"></ng-container>
                                </li>
                              }
                              @if (c.discursantes.length === 0) {
                                <li class="px-1.5 pb-2 text-xs text-teal-800/60 dark:text-teal-200/50">Aún no hay discursantes. Edita la congregación para añadirlos.</li>
                              }
                            </ul>
                          </section>

                          <section class="@container rounded-xl bg-sky-50/60 dark:bg-sky-400/[0.04] ring-1 ring-inset ring-sky-200/60 dark:ring-sky-400/15" [attr.aria-label]="'Contactos de ' + c.nombre">
                            <header class="flex items-center gap-2 px-3 pt-3 pb-2">
                              <span class="w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-400/15 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0" aria-hidden="true">
                                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                              </span>
                              <div class="min-w-0 flex-1">
                                <h4 class="text-[0.8rem] font-bold text-sky-800 dark:text-sky-200 leading-tight">Contactos de la congregación</h4>
                                <p class="text-[0.7rem] text-sky-700/70 dark:text-sky-300/60 leading-tight">Con quién coordinar el intercambio</p>
                              </div>
                              <span class="shrink-0 min-w-6 h-6 px-1.5 rounded-full bg-sky-100 dark:bg-sky-400/15 text-[0.7rem] font-bold text-sky-700 dark:text-sky-300 flex items-center justify-center tabular-nums">{{ c.personas.length }}</span>
                            </header>
                            <ul class="flex flex-col divide-y divide-sky-100 dark:divide-sky-400/10 px-1.5 pb-1.5">
                              @for (p of c.personas; track p.id_contacto_persona) {
                                <li class="flex flex-col @md:flex-row @md:items-center gap-2 @md:gap-3 rounded-lg px-1.5 py-2 hover:bg-white/70 dark:hover:bg-slate-800/40 transition-colors">
                                  <div class="min-w-0 flex-1 flex items-start gap-2.5">
                                    <span class="w-8 h-8 rounded-full bg-sky-600 dark:bg-sky-500/80 text-white text-xs font-black flex items-center justify-center shrink-0" aria-hidden="true">{{ p.nombre.charAt(0).toUpperCase() }}</span>
                                    <div class="min-w-0 flex-1">
                                      <p class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{{ p.nombre }}</p>
                                      @if (p.cargo) {
                                        <span class="inline-block max-w-full mt-0.5 text-[0.65rem] font-bold text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-400/15 px-1.5 py-px rounded truncate align-top">{{ p.cargo }}</span>
                                      }
                                    </div>
                                  </div>
                                  <ng-container *ngTemplateOutlet="accionesContacto; context: { $implicit: p }"></ng-container>
                                </li>
                              }
                              @if (c.personas.length === 0) {
                                <li class="px-1.5 pb-2 text-xs text-sky-800/60 dark:text-sky-200/50">Aún no hay contactos. Edita la congregación para añadirlos.</li>
                              }
                            </ul>
                          </section>
                        </div>
                      </div>
                    }
                  </div>
                }
              }
              </div>
            </div>
          } @else if (subTab() === 'temas') {
            <!-- TEMAS tab -->
            <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar flex flex-col gap-3 p-3 sm:p-4 bg-slate-50 dark:bg-slate-950/40">
              @if (hasEditPermission()) {
                <button (click)="abrirModalTema()"
                  class="self-start flex items-center gap-2 px-4 h-9 rounded-xl border-2 border-dashed border-amber-400 dark:border-amber-600 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-95">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Añadir tema
                </button>
              }
              @if (loadingTemas()) {
                <div class="flex items-center justify-center py-12">
                  <div class="w-7 h-7 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-amber-500 animate-spin"></div>
                </div>
              } @else if (temas().length === 0) {
                <div class="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <svg class="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                  </div>
                  <div>
                    <p class="text-sm font-bold text-slate-600 dark:text-slate-500">Sin temas registrados</p>
                    <p class="text-xs text-slate-400 mt-0.5">Registra los temas preparados de los discursantes</p>
                  </div>
                </div>
              } @else {
                @for (grupo of temasAgrupados(); track grupo.nombre) {
                  <div class="disc-card rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                    <div class="bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2">
                        <div class="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-black text-amber-600 dark:text-amber-400 shrink-0">
                          {{ grupo.nombre.charAt(0).toUpperCase() }}
                        </div>
                        <span class="text-sm font-black text-slate-800 dark:text-slate-100">{{ grupo.nombre }}</span>
                        <span class="text-[0.6rem] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">{{ grupo.temas.length }}</span>
                      </div>
                      @if (hasEditPermission()) {
                        <button (click)="abrirModalTema(); nuevoTema.id_publicador = grupo.temas[0].id_publicador"
                          title="Añadir tema a este publicador"
                          class="w-9 h-9 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all active:scale-95">
                          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                      }
                    </div>
                    <div class="flex flex-col">
                      @for (tema of grupo.temas; track tema.id_tema; let last = $last) {
                        <div class="flex items-center gap-2 px-3 py-2.5" [class]="!last ? 'border-b border-slate-100 dark:border-slate-800' : ''">
                          @if (tema.numero_tema != null) {
                            <span class="shrink-0 w-8 h-6 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[0.65rem] font-black flex items-center justify-center border border-amber-200 dark:border-amber-800/50">{{ tema.numero_tema }}</span>
                          }
                          <span class="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200">{{ tema.titulo }}</span>
                          @if (!tema.activo) {
                            <span class="shrink-0 text-[0.6rem] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full">Inactivo</span>
                          }
                          @if (hasEditPermission()) {
                            <button (click)="abrirModalTema(tema)" title="Editar"
                              class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                            </button>
                            <button (click)="confirmarEliminarTema(tema)" title="Eliminar"
                              class="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          }
                        </div>
                      }
                    </div>
                  </div>
                }
              }
            </div>
          } @else if (estado() === 'loading') {
            <div class="flex-1 flex items-center justify-center">
              <div class="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-violet-500 animate-spin"></div>
            </div>
          } @else if (!mesDatos()) {
            <!-- Es el único momento sin barra de mes, así que la lista y el
                 botón de generar viven aquí: sin ellos no habría forma de
                 entrar a la pantalla (mismo criterio que Logística). -->
            <div class="flex-1 flex items-center justify-center p-6 overflow-y-auto simple-scrollbar">
              <div class="w-full max-w-sm flex flex-col items-center text-center gap-1.5">

                <div class="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center mb-2.5">
                  <svg class="w-6 h-6 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                </div>

                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200">Ninguna programación abierta</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-[15rem]">
                  @if (mesesDisponibles().length > 0) {
                    Elige un mes para verlo y editarlo.
                  } @else if (hasEditPermission()) {
                    Genera una nueva programación para comenzar.
                  } @else {
                    No hay discursos programados. Consulta con el secretario.
                  }
                </p>

                @if (mesesDisponibles().length > 0) {
                  <!-- Lista en tarjeta y no chips sueltos: filas del mismo
                       ancho, una debajo de otra, se leen como un solo bloque. -->
                  <div class="w-full mt-4 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                    @for (m of mesesDisponibles(); track m.ano + '-' + m.mes) {
                      <button
                        data-testid="disc-fila-mes"
                        [attr.data-ano]="m.ano"
                        [attr.data-mes]="m.mes"
                        (click)="cargarMes(m.ano, m.mes)"
                        [disabled]="estado() === 'loading'"
                        class="w-full flex items-center gap-2.5 px-3.5 h-11 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors active:bg-violet-100 dark:active:bg-violet-900/30 disabled:opacity-40">
                        <span class="w-1.5 h-1.5 rounded-full shrink-0" [class]="m.confirmado ? 'bg-emerald-500' : 'bg-amber-400'" [title]="m.confirmado ? 'Confirmado' : 'Borrador'"></span>
                        <span class="min-w-0 truncate text-left flex-1">{{ mesLabel(m.ano, m.mes) }}</span>
                        <svg class="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                      </button>
                    }
                  </div>
                }

                @if (hasEditPermission()) {
                  <button data-testid="disc-btn-generar-mes" (click)="abrirModalGenerar()"
                    [disabled]="estado() === 'loading'"
                    class="w-full mt-4 flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 text-xs font-bold text-white transition-all shadow-sm active:scale-[0.98]">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Generar mes
                  </button>
                }

              </div>
            </div>
          } @else {
            <!-- CONTENT area -->
            <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar p-3 sm:p-4 bg-slate-50 dark:bg-slate-950/40">

              <!-- ENTRANTES -->
              <!-- Resumen de una fecha ya confirmada: discurso, orador,
                   congregación y hospitalidad en una sola línea, en vez del
                   formulario completo deshabilitado. Con 8 fechas seguidas
                   cerradas, cuatro campos grises por fecha eran ruido para
                   reconocer "quién viene y con qué" de un vistazo; el
                   formulario sigue a un clic (fila o lápiz) para quien
                   necesite tocar algo. -->
              <ng-template #resumenEntrante let-entrante>
                <div class="min-w-0 flex-1 basis-full sm:basis-0 flex items-baseline gap-x-2 gap-y-0.5 flex-wrap">
                  @if (entrante.titulo_discurso) {
                    <span class="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ entrante.titulo_discurso }}</span>
                  } @else {
                    <span class="text-sm text-slate-400 dark:text-slate-500 italic">Sin discurso registrado</span>
                  }
                  @if (urlBosquejo(entrante.meps_document_id); as urlBosq) {
                    <button type="button" (click)="abrirBosquejo($event, urlBosq)" title="Ver bosquejo en jw.org" aria-label="Ver bosquejo en jw.org"
                      class="shrink-0 w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-violet-600 dark:text-slate-600 dark:hover:text-violet-400 transition-colors">
                      <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                    </button>
                  }
                  @if (entrante.notas) {
                    <svg class="shrink-0 w-3.5 h-3.5 text-slate-300 dark:text-slate-600" [attr.aria-label]="'Nota: ' + entrante.notas" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                  }
                </div>
                <div class="shrink-0 w-full sm:w-40 flex items-center gap-1.5">
                  <svg class="shrink-0 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path stroke-linecap="round" stroke-linejoin="round" d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/></svg>
                  @if (entrante.nombre_orador) {
                    <span class="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{{ entrante.nombre_orador }}</span>
                  } @else {
                    <span class="text-xs font-semibold text-amber-600 dark:text-amber-400">Sin orador</span>
                  }
                </div>
                <div class="shrink-0 w-full sm:w-40 flex items-center gap-1.5 text-slate-400 dark:text-slate-500">
                  <svg class="shrink-0 w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                  <span class="text-xs text-slate-600 dark:text-slate-400 truncate">{{ entrante.congregacion_origen || '—' }}</span>
                </div>
                @if (nombreGrupoHospitalidad(entrante); as grupo) {
                  <span class="shrink-0 text-[0.65rem] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">{{ grupo }}</span>
                }
              </ng-template>

              <div [hidden]="subTab() !== 'entrantes'" class="flex flex-col gap-3">
                  <!-- Cuántas llamadas quedan por hacer este mes -->
                  @if (mesDatos()!.entrantes.length > 0) {
                    <div class="flex items-center gap-2.5 px-3 py-2 rounded-xl border"
                      [class]="entrantesConfirmados() === mesDatos()!.entrantes.length
                        ? 'bg-emerald-50 dark:bg-emerald-900/15 border-emerald-200/70 dark:border-emerald-800/40'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-700/60'">
                      <svg class="w-3.5 h-3.5 shrink-0"
                        [class]="entrantesConfirmados() === mesDatos()!.entrantes.length ? 'text-emerald-500' : 'text-slate-400'"
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>
                      </svg>
                      <span class="text-[0.7rem] font-bold text-slate-600 dark:text-slate-300">
                        Oradores confirmados: {{ entrantesConfirmados() }} de {{ mesDatos()!.entrantes.length }}
                      </span>
                      @if (mesDatos()!.entrantes.length > entrantesConfirmados()) {
                        <span class="text-[0.65rem] text-slate-400">
                          Faltan {{ mesDatos()!.entrantes.length - entrantesConfirmados() }} por llamar
                        </span>
                      }
                      <!-- Antes de llamar hay que tener a quién: sin este dato,
                           "faltan N por llamar" cuenta también fechas que
                           todavía no tienen orador y no se pueden trabajar. -->
                      @if (entrantesSinOrador() > 0) {
                        <span class="flex items-center gap-1.5 text-[0.65rem] font-bold text-amber-600 dark:text-amber-400">
                          <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12" stroke-linecap="round"/><line x1="12" y1="16" x2="12.01" y2="16" stroke-linecap="round"/></svg>
                          {{ entrantesSinOrador() }} sin orador
                        </span>
                      }
                      @if (entrantesPresentados() > 0) {
                        <span class="ml-auto flex items-center gap-1.5 text-[0.65rem] font-bold text-violet-600 dark:text-violet-400">
                          <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                          {{ entrantesPresentados() }} ya presentado{{ entrantesPresentados() === 1 ? '' : 's' }}
                        </span>
                      }
                      @if (entrantesRepetidos() > 0) {
                        <span class="flex items-center gap-1.5 text-[0.65rem] font-bold text-amber-600 dark:text-amber-400"
                          [class.ml-auto]="entrantesPresentados() === 0">
                          <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          {{ entrantesRepetidos() }} repetido{{ entrantesRepetidos() === 1 ? '' : 's' }}
                        </span>
                      }
                    </div>
                  }
                  @for (entrante of mesDatos()!.entrantes; track entrante.id_discurso_entrante) {
                    <div class="disc-card rounded-xl border bg-white dark:bg-slate-900 overflow-hidden transition-colors"
                      [class]="isEditandoEntrante(entrante.id_discurso_entrante)
                        ? 'border-amber-400 dark:border-amber-500'
                        : 'border-slate-200 dark:border-slate-700'">
                      <!-- Cabecera de fecha: lleva el estado de la tarjeta, que
                           es lo que permite recorrer el mes sin abrir cada una. -->
                      <div class="px-3 py-2.5 flex items-center gap-2 border-b transition-colors duration-200"
                        [class]="cabeceraEntranteClass(entrante)">
                        <svg class="w-3.5 h-3.5 shrink-0 transition-colors duration-200"
                          [class]="iconoEntranteClass(entrante)"
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        <span class="text-sm font-black text-slate-800 dark:text-slate-200">{{ formatFecha(entrante.fecha) }}</span>

                        <!-- El único estado sin palabras propias: los otros tres
                             ya los dicen los botones de confirmar y presentar, y
                             repetirlos sería ruido. Sin esta etiqueta, "falta
                             orador" viviría solo en el color. -->
                        @if (estadoEntrante(entrante) === 'pendiente') {
                          <span class="shrink-0 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[0.6rem] font-bold">
                            Falta orador
                          </span>
                        }

                        <div class="ml-auto flex items-center gap-2">
                          <!-- Confirmación del orador: seguimiento del organizador.
                               Sigue disponible con el mes cerrado, porque la llamada a
                               la congregación de origen se hace casi siempre después. -->
                          @if (hasEditPermission()) {
                            <button type="button"
                              (click)="toggleOradorConfirmado(entrante)"
                              [disabled]="confirmandoOrador().has(entrante.id_discurso_entrante)"
                              [title]="tituloConfirmacion(entrante)"
                              class="flex items-center gap-1.5 pl-1.5 pr-2.5 h-7 rounded-full border text-[0.65rem] font-bold transition-[background-color,border-color,color] duration-150 ease-out active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                              [class]="entrante.orador_confirmado
                                ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600 hover:border-emerald-600'
                                : 'bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400'">
                              @if (entrante.orador_confirmado) {
                                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                <span>Orador confirmado</span>
                              } @else {
                                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                                <span>Sin confirmar</span>
                              }
                            </button>
                          } @else if (entrante.orador_confirmado) {
                            <span class="flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[0.65rem] font-bold">
                              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                              Orador confirmado
                            </span>
                          }

                          <!-- Presentado: el discurso ya se dio. El sistema lo marca
                               solo al pasar la hora de la reunión; esto permite
                               adelantarlo o deshacerlo si el orador no vino. -->
                          @if (hasEditPermission()) {
                            <button type="button"
                              (click)="togglePresentado(entrante)"
                              [disabled]="marcandoPresentado().has(entrante.id_discurso_entrante)"
                              [title]="tituloPresentado(entrante)"
                              class="flex items-center gap-1.5 pl-1.5 pr-2.5 h-7 rounded-full border text-[0.65rem] font-bold transition-[background-color,border-color,color] duration-150 ease-out active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                              [class]="entrante.presentado
                                ? 'bg-violet-500 border-violet-500 text-white hover:bg-violet-600 hover:border-violet-600'
                                : 'bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400'">
                              <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/>
                                <path stroke-linecap="round" stroke-linejoin="round" d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4M8 22h8"/>
                              </svg>
                              <span>{{ entrante.presentado ? 'Presentado' : 'Sin presentar' }}</span>
                            </button>
                          } @else if (entrante.presentado) {
                            <span class="flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 text-[0.65rem] font-bold">
                              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                              Presentado
                            </span>
                          }

                          @if (entrante.confirmado) {
                            @if (isEditandoEntrante(entrante.id_discurso_entrante)) {
                              <button (click)="toggleEditEntrante(entrante.id_discurso_entrante)"
                                class="flex items-center gap-1.5 px-3 h-6 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[0.65rem] font-bold transition-all active:scale-95">
                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                                Guardar
                              </button>
                            } @else {
                              <span class="text-[0.6rem] font-bold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700/70 px-2 py-0.5 rounded-full" title="El mes está cerrado: para cambiar los datos usa el lápiz.">Mes cerrado</span>
                              @if (hasEditPermission()) {
                                <button (click)="toggleEditEntrante(entrante.id_discurso_entrante)" title="Editar"
                                  class="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-500 transition-all active:scale-95">
                                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                                </button>
                              }
                            }
                          }
                        </div>
                      </div>
                      <!-- fields -->
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 p-3 sm:p-4">
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Discurso / Tema</label>
                          <app-discurso-catalogo-input
                            [value]="entrante.titulo_discurso ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (commit)="guardarCampoEntrante(entrante, 'titulo_discurso', $event)"
                            placeholder="Nº o palabra del discurso"
                            inputClass="h-10 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full"></app-discurso-catalogo-input>
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Orador</label>
                          <input type="text"
                            [value]="entrante.nombre_orador ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (blur)="onEntranteChange(entrante, 'nombre_orador', $event)"
                            placeholder="Nombre del orador"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Congregación Origen</label>
                          <!-- Mismo campo del directorio que usa Salientes: la
                               congregación de la que viene un orador es una
                               congregación del circuito, igual que aquella a la
                               que se sale. Con permitirCrear se ofrece además
                               apuntarla si es la primera vez que viene. -->
                          <app-congregacion-contacto-input
                            [value]="entrante.congregacion_origen ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            [idCong]="idCongActual()"
                            [permitirCrear]="hasEditPermission()"
                            (commit)="guardarCampoEntrante(entrante, 'congregacion_origen', $event)"
                            (seleccion)="elegirCongregacionOrigen(entrante, $event)"
                            placeholder="Congregación"
                            inputClass="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full"></app-congregacion-contacto-input>
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="flex items-center gap-1 text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19a3 3 0 11-6 0 3 3 0 016 0zm12-3a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                            Cántico
                          </label>
                          <app-cantico-catalogo-input
                            [value]="entrante.cantico ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (commit)="guardarCampoEntrante(entrante, 'cantico', $event)"
                            placeholder="Nº o título del cántico"
                            inputClass="h-10 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full"></app-cantico-catalogo-input>
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="flex items-center gap-1 text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                            Hospitalidad
                          </label>
                          <select
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (change)="onEntranteGrupoChange(entrante, $event)"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
                            <option value="" [selected]="!entrante.id_grupo_hospitalidad">— Sin asignar —</option>
                            @for (g of grupos(); track g.id_grupo) {
                              <option [value]="g.id_grupo + ''" [selected]="entrante.id_grupo_hospitalidad === g.id_grupo">{{ g.nombre_grupo }}</option>
                            }
                          </select>
                        </div>
                        <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3 xl:col-span-5">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Notas</label>
                          <input type="text"
                            [value]="entrante.notas ?? ''"
                            [disabled]="!hasEditPermission() || (entrante.confirmado && !isEditandoEntrante(entrante.id_discurso_entrante))"
                            (blur)="onEntranteChange(entrante, 'notas', $event)"
                            placeholder="Notas adicionales"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 dark:focus:border-slate-300 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
                        </div>
                      </div>
                      </div>
                      }

                      <!-- Algo de la fila dejó de cuadrar al elegir de una lista
                           (un discurso que no es del orador, un orador que no es
                           de la congregación) y se corrigió. Se ofrece deshacerlo
                           por si esa vez es realmente así. -->
                      @if (avisosFila()[entrante.id_discurso_entrante]; as cambio) {
                        <div class="flex items-start gap-2.5 px-3 sm:px-4 py-2.5 border-t border-amber-200/60 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/15" role="status">
                          <svg class="w-4 h-4 mt-0.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                          <div class="flex-1 min-w-0">
                            <p class="text-[0.7rem] font-bold text-amber-700 dark:text-amber-400">{{ cambio.mensaje }}</p>
                            <p class="text-[0.65rem] text-amber-600/90 dark:text-amber-400/80">{{ cambio.detalle }}</p>
                          </div>
                          <div class="shrink-0 flex items-center gap-1">
                            <button type="button" (click)="deshacerAvisoFila(entrante)"
                              class="px-2.5 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-[0.65rem] font-bold text-amber-800 dark:text-amber-300 transition-colors active:scale-95">
                              {{ cambio.accion }}
                            </button>
                            <button type="button" (click)="descartarAvisoFila(entrante.id_discurso_entrante)" aria-label="Cerrar aviso"
                              class="w-7 h-7 rounded-lg flex items-center justify-center text-amber-600/70 dark:text-amber-400/70 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                          </div>
                        </div>
                      } @else if (discursoFueraDeBosquejos(entrante); as fuera) {
                        <!-- Discurso puesto a mano que no es de los bosquejos del
                             orador registrado: se permite, solo se avisa. -->
                        <div class="flex items-start gap-2.5 px-3 sm:px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                          <svg class="w-4 h-4 mt-0.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path stroke-linecap="round" d="M12 16v-4M12 8h.01"/></svg>
                          <p class="flex-1 min-w-0 text-[0.7rem] text-slate-500 dark:text-slate-400">
                            Este discurso no está entre los bosquejos registrados de <span class="font-semibold text-slate-700 dark:text-slate-200">{{ fuera.orador }}</span>
                            ({{ fuera.etiquetas }}).
                          </p>
                        </div>
                      }

                      <!-- Aviso de discurso repetido: solo informa, nunca bloquea. -->
                      @if ((repeticiones()[entrante.id_discurso_entrante] ?? []).length > 0) {
                        <div class="flex items-start gap-2.5 px-3 sm:px-4 py-2.5 border-t border-amber-200/60 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/15">
                          <svg class="w-4 h-4 mt-0.5 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                          <div class="flex-1 min-w-0">
                            <p class="text-[0.7rem] font-bold text-amber-700 dark:text-amber-400">
                              Ya se presentó en esta congregación en los últimos 12 meses
                            </p>
                            <p class="text-[0.65rem] text-amber-600/90 dark:text-amber-400/80">
                              @for (r of (repeticiones()[entrante.id_discurso_entrante] ?? []).slice(0, 3); track r.fecha; let last = $last) {
                                {{ formatFecha(r.fecha) }}@if (r.nombre_orador) { · {{ r.nombre_orador }} }@if (!last) {, }
                              }
                              @if ((repeticiones()[entrante.id_discurso_entrante] ?? []).length > 3) {
                                <span> y {{ (repeticiones()[entrante.id_discurso_entrante] ?? []).length - 3 }} más</span>
                              }
                            </p>
                          </div>
                        </div>
                      }
                    </div>
                  }
              </div>

              <!-- SALIENTES -->
              <div [hidden]="subTab() !== 'salientes'" class="flex flex-col gap-3">
                  @if (hasEditPermission()) {
                    <button (click)="abrirModalSaliente()"
                      class="self-start flex items-center gap-2 px-4 h-9 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-700 text-xs font-bold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all active:scale-95">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Añadir saliente
                    </button>
                  }

                  @if (mesDatos()!.salientes.length > 0) {
                    <div class="flex flex-wrap items-center gap-2.5 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-700/60">
                      <span class="text-[0.7rem] font-bold text-slate-600 dark:text-slate-300">
                        {{ salientesProgramados() }} programado{{ salientesProgramados() === 1 ? '' : 's' }}
                      </span>
                      @if (salientesRealizados() > 0) {
                        <span class="flex items-center gap-1.5 text-[0.65rem] font-bold text-violet-600 dark:text-violet-400">
                          <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                          {{ salientesRealizados() }} realizada{{ salientesRealizados() === 1 ? '' : 's' }}
                        </span>
                      }
                      @if (salientesCancelados() > 0) {
                        <span class="flex items-center gap-1.5 text-[0.65rem] font-bold text-red-600 dark:text-red-400">
                          <svg class="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          {{ salientesCancelados() }} cancelada{{ salientesCancelados() === 1 ? '' : 's' }}
                        </span>
                      }
                    </div>
                  }

                  @if (mesDatos()!.salientes.length === 0) {
                    <div class="flex flex-col items-center justify-center py-10 text-center gap-3">
                      <div class="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <svg class="w-6 h-6 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                      </div>
                      <div>
                        <p class="text-sm font-bold text-slate-500 dark:text-slate-400">Sin salientes programados</p>
                        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Añade publicadores que salen a dar discursos</p>
                      </div>
                    </div>
                  }

                  @for (saliente of mesDatos()!.salientes; track saliente.id_discurso_saliente) {
                    <div class="disc-card rounded-xl border bg-white dark:bg-slate-900 overflow-hidden transition-colors"
                      [class]="isEditandoSaliente(saliente.id_discurso_saliente)
                        ? 'border-amber-400 dark:border-amber-500'
                        : 'border-slate-200 dark:border-slate-700'">
                      <div class="bg-slate-50 dark:bg-slate-800/80 px-3 py-2.5 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800">
                        <svg class="w-3.5 h-3.5 text-violet-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
                        <span class="text-sm font-black text-slate-800 dark:text-slate-200">{{ formatFecha(saliente.fecha) }}</span>
                        @if (saliente.confirmado) {
                          @if (isEditandoSaliente(saliente.id_discurso_saliente)) {
                            <button (click)="toggleEditSaliente(saliente.id_discurso_saliente)"
                              class="ml-auto flex items-center gap-1.5 px-3 h-6 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[0.65rem] font-bold transition-all active:scale-95">
                              <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                              Guardar
                            </button>
                          } @else {
                            <span class="ml-auto text-[0.6rem] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">Confirmado</span>
                            @if (hasEditPermission()) {
                              <button (click)="toggleEditSaliente(saliente.id_discurso_saliente)" title="Editar"
                                class="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-500 transition-all active:scale-95">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                              </button>
                            }
                          }
                        }
                        <div class="ml-auto flex items-center gap-2">
                          <!-- Estado: Programado / Realizada / Cancelado. El chip alterna
                               Programado↔Realizada (marca a mano, el planificador la marca
                               solo al pasar fecha+hora); reactivar una cancelada vuelve a
                               Programado. Cancelar (programado→cancelado) es el botón aparte
                               de más abajo, porque no es un simple toggle. -->
                          @if (hasEditPermission()) {
                            @if (saliente.estado === 'cancelado') {
                              <button type="button"
                                (click)="reactivarSaliente(saliente)"
                                [disabled]="cancelandoSaliente().has(saliente.id_discurso_saliente)"
                                [title]="tituloEstadoSaliente(saliente)"
                                class="flex items-center gap-1.5 pl-1.5 pr-2.5 h-7 rounded-full border text-[0.65rem] font-bold transition-[background-color,border-color,color] duration-150 ease-out active:scale-95 disabled:opacity-60 disabled:cursor-wait bg-red-500 border-red-500 text-white hover:bg-red-600 hover:border-red-600">
                                <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                <span>Cancelado</span>
                              </button>
                            } @else {
                              <button type="button"
                                (click)="togglePresentadoSaliente(saliente)"
                                [disabled]="marcandoPresentadoSaliente().has(saliente.id_discurso_saliente)"
                                [title]="tituloEstadoSaliente(saliente)"
                                class="flex items-center gap-1.5 pl-1.5 pr-2.5 h-7 rounded-full border text-[0.65rem] font-bold transition-[background-color,border-color,color] duration-150 ease-out active:scale-95 disabled:opacity-60 disabled:cursor-wait"
                                [class]="saliente.estado === 'realizada'
                                  ? 'bg-violet-500 border-violet-500 text-white hover:bg-violet-600 hover:border-violet-600'
                                  : 'bg-white dark:bg-slate-900 border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400'">
                                @if (saliente.estado === 'realizada') {
                                  <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                }
                                <span>{{ saliente.estado === 'realizada' ? 'Realizada' : 'Programado' }}</span>
                              </button>
                            }
                          } @else if (saliente.estado !== 'programado') {
                            <span class="flex items-center gap-1.5 px-2.5 h-7 rounded-full text-[0.65rem] font-bold"
                              [class]="saliente.estado === 'realizada'
                                ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400'">
                              {{ saliente.estado === 'realizada' ? 'Realizada' : 'Cancelado' }}
                            </span>
                          }
                          @if (saliente.id_publicador) {
                            <button (click)="abrirWhatsapp(saliente)"
                              title="Notificar al orador por WhatsApp"
                              aria-label="Notificar al orador por WhatsApp"
                              class="w-9 h-9 rounded-lg flex items-center justify-center text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all active:scale-95">
                              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                            </button>
                          }
                          @if (hasEditPermission() && saliente.estado === 'programado' && !isEditandoSaliente(saliente.id_discurso_saliente)) {
                            <button (click)="cancelarSaliente(saliente)"
                              title="Cancelar esta salida"
                              aria-label="Cancelar esta salida"
                              class="w-9 h-9 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-500 hover:text-amber-600 flex items-center justify-center transition-all active:scale-95">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><line x1="7" y1="17" x2="17" y2="7"/></svg>
                            </button>
                          }
                          @if (hasEditPermission() && !isEditandoSaliente(saliente.id_discurso_saliente)) {
                            <button (click)="eliminarSaliente(saliente)"
                              aria-label="Eliminar saliente"
                              class="w-9 h-9 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 flex items-center justify-center transition-all active:scale-95">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          }
                        </div>
                      </div>
                      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 p-3 sm:p-4">
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Publicador</label>
                          <select
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            (change)="onSalientePublicadorChange(saliente, $event)"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
                            <option value="" [selected]="!saliente.id_publicador">— Sin asignar —</option>
                            @for (p of opcionesPublicador(saliente); track p.id_publicador) {
                              <option [value]="p.id_publicador + ''" [selected]="saliente.id_publicador === p.id_publicador">{{ p.nombre_completo }}</option>
                            }
                          </select>
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Congregación Destino</label>
                          <app-congregacion-contacto-input
                            [value]="saliente.congregacion_destino ?? ''"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            [idCong]="idCongActual()"
                            (commit)="guardarCampoSaliente(saliente, 'congregacion_destino', $event)"
                            (seleccion)="onSalienteCongregacionSeleccionada(saliente, $event)"
                            placeholder="Congregación destino"
                            inputClass="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full"></app-congregacion-contacto-input>
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Hora</label>
                          <app-time-picker
                            [ngModel]="saliente.hora"
                            (ngModelChange)="onSalienteHoraChange(saliente, $event)"
                            [ngModelOptions]="{ standalone: true }"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            colorScheme="violet" placeholder="Hora"></app-time-picker>
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="flex items-center gap-1 text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">
                            Tema del Discurso
                            @if (urlBosquejo(saliente.meps_document_id); as urlBosq) {
                              <button type="button" (click)="abrirBosquejo($event, urlBosq)" title="Ver bosquejo en jw.org" aria-label="Ver bosquejo en jw.org"
                                class="shrink-0 w-4 h-4 rounded flex items-center justify-center normal-case text-slate-300 hover:text-violet-600 dark:text-slate-600 dark:hover:text-violet-400 transition-colors">
                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
                              </button>
                            }
                          </label>
                          <app-discurso-catalogo-input
                            [value]="saliente.tema_discurso ?? ''"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            (commit)="guardarCampoSaliente(saliente, 'tema_discurso', $event)"
                            placeholder="Nº o palabra del tema"
                            inputClass="h-10 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full"></app-discurso-catalogo-input>
                        </div>
                        <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Ubicación del Salón</label>
                          <app-ubicacion-picker
                            size="sm"
                            [ngModel]="ubicacionDe(saliente)"
                            (ngModelChange)="onSalienteUbicacionChange(saliente, $event)"
                            [ngModelOptions]="{ standalone: true }"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))">
                          </app-ubicacion-picker>
                        </div>
                        <div class="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
                          <label class="text-[0.65rem] font-bold text-slate-500 uppercase tracking-wider">Notas</label>
                          <input type="text"
                            [value]="saliente.notas ?? ''"
                            [disabled]="!hasEditPermission() || (saliente.confirmado && !isEditandoSaliente(saliente.id_discurso_saliente))"
                            (blur)="onSalienteChange(saliente, 'notas', $event)"
                            placeholder="Notas adicionales"
                            class="h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:bg-slate-50 dark:disabled:bg-slate-800/50 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 disabled:cursor-default transition-[border-color,background-color] duration-150 ease-out w-full">
                        </div>
                      </div>
                    </div>
                  }
              </div>
            </div>
          }
        </div>
    </div>

    <!-- ===== MODAL GENERAR MES ===== -->
    @if (modalGenerarVisible()) {
      <div class="disc-overlay fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="cerrarModalGenerar()">
        <div data-testid="disc-modal-generar" class="disc-dialog w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-5" (click)="$event.stopPropagation()">
          <h2 class="text-base font-black text-slate-800 dark:text-white">Generar Mes — Discursos Públicos</h2>

          <!-- Período: mes (desplegable propio, coherente con el resto del aplicativo) + año (numérico) -->
          <div class="flex gap-3">
            <div class="flex-1 flex flex-col gap-1">
              <label class="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mes</label>
              <div class="relative">
                @if (mesDropdownAbierto()) {
                  <div class="fixed inset-0 z-[59]" (click)="mesDropdownAbierto.set(false)"></div>
                }
                <button type="button" data-testid="disc-generar-mes" (click)="mesDropdownAbierto.set(!mesDropdownAbierto())"
                  class="h-9 w-full px-3 rounded-xl border bg-white dark:bg-slate-800 text-sm text-left flex items-center justify-between gap-2 outline-none transition-[border-color,background-color] duration-150 ease-out"
                  [class]="mesDropdownAbierto() ? 'border-violet-500 ring-2 ring-violet-400/30' : 'border-slate-200 dark:border-slate-600 hover:border-violet-300 dark:hover:border-violet-700'">
                  <span class="text-slate-800 dark:text-slate-100">{{ mesSoloLabel(genMes) }}</span>
                  <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-150" [class.rotate-180]="mesDropdownAbierto()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
                @if (mesDropdownAbierto()) {
                  <div class="disc-dropdown absolute left-0 top-full mt-1.5 w-full max-h-64 overflow-y-auto simple-scrollbar bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[60] py-1.5">
                    @for (m of mesesOpciones; track m.value) {
                      <button type="button" data-testid="disc-opcion-mes" [attr.data-mes]="m.value"
                        (click)="genMes = m.value; mesDropdownAbierto.set(false)"
                        class="w-full px-3.5 py-2 text-sm font-semibold text-left transition-colors duration-100"
                        [class]="genMes === m.value ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'">
                        {{ m.label }}
                      </button>
                    }
                  </div>
                }
              </div>
            </div>
            <div class="w-24 flex flex-col gap-1">
              <label class="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Año</label>
              <input data-testid="disc-generar-ano" type="number"
                [(ngModel)]="genAno" min="2024" max="2030"
                class="h-9 w-full px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-400/30 transition-[border-color] duration-150 ease-out">
            </div>
          </div>
          <div class="flex gap-2 justify-end">
            <button (click)="cerrarModalGenerar()" class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">Cancelar</button>
            <button data-testid="disc-btn-generar" (click)="generarMes()" [disabled]="estado() === 'loading'"
              class="px-4 h-9 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 text-xs font-bold text-white transition-all active:scale-95">
              Generar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL AÑADIR/EDITAR CONGREGACIÓN DE CONTACTO =====
         Más ancho que los demás modales (max-w-4xl): las filas de discursantes
         y contactos son tabulares y en 384px cada campo quedaba cortado.
         Las secciones repiten el color de la tarjeta de detalle (violeta =
         cuándo y dónde, teal = discursantes, azul = contactos) para que
         editar sea reconocer lo mismo que se lee. -->
    @if (modalCongregacionContactoVisible()) {
      <div class="disc-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" (click)="cerrarModalCongregacionContacto()">
        <div class="disc-sheet bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-4xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col border border-slate-200/60 dark:border-slate-700/60 overflow-hidden"
          role="dialog" aria-modal="true" aria-labelledby="titulo-modal-cong" (click)="$event.stopPropagation()">
          <div class="flex justify-center pt-3 pb-1 sm:hidden">
            <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          </div>
          <div class="shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800">
            <div class="min-w-0">
              <h2 id="titulo-modal-cong" class="text-base font-black text-slate-900 dark:text-white">{{ editandoCongregacionContacto() ? 'Editar congregación' : 'Añadir congregación' }}</h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Solo el nombre es obligatorio. Lo demás autocompleta hora, ubicación y orador al programar un entrante.</p>
            </div>
            <button type="button" (click)="cerrarModalCongregacionContacto()" aria-label="Cerrar"
              class="shrink-0 -mr-2 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-[background-color,color] duration-150 ease-out active:scale-[0.95]">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar flex flex-col gap-6 px-5 sm:px-6 py-5">

            <!-- 1 · Congregación: cuándo y dónde -->
            <section class="flex flex-col gap-3">
              <h3 class="flex items-center gap-2 text-[0.8rem] font-bold text-violet-700 dark:text-violet-300">
                <span class="w-6 h-6 rounded-md bg-violet-100 dark:bg-violet-400/15 flex items-center justify-center shrink-0" aria-hidden="true">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                </span>
                Congregación y reunión del fin de semana
              </h3>
              <div class="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_auto_minmax(0,0.9fr)]">
                <div class="flex flex-col gap-1.5">
                  <label for="cong-nombre" class="text-xs font-semibold text-slate-600 dark:text-slate-300">Nombre <span class="text-red-500" aria-hidden="true">*</span></label>
                  <input id="cong-nombre" type="text" [(ngModel)]="nuevaCongregacionContacto.nombre" placeholder="Ej. Cañaveral" autocomplete="off" required
                    [class]="campoModal + ' h-10 text-sm'">
                </div>
                <!-- Sólo hay dos días posibles: dos botones se eligen de un
                     toque; un desplegable pedía dos. Volver a pulsar el día
                     elegido lo deja sin definir. -->
                <div class="flex flex-col gap-1.5">
                  <span id="cong-dia" class="text-xs font-semibold text-slate-600 dark:text-slate-300">Día</span>
                  <div role="radiogroup" aria-labelledby="cong-dia" class="h-10 grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 sm:w-[12.5rem]">
                    @for (dia of diasFinSemanaOpciones; track dia) {
                      <button type="button" role="radio" [attr.aria-checked]="nuevaCongregacionContacto.dia_reunion_fin_semana === dia"
                        (click)="seleccionarDiaCongregacionContacto(nuevaCongregacionContacto.dia_reunion_fin_semana === dia ? null : dia)"
                        class="rounded-lg text-sm font-bold transition-[background-color,color,box-shadow] duration-150 ease-out active:scale-[0.97]"
                        [class]="nuevaCongregacionContacto.dia_reunion_fin_semana === dia
                          ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'">
                        {{ diaLabel(dia) }}
                      </button>
                    }
                  </div>
                </div>
                <div class="flex flex-col gap-1.5">
                  <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">Hora</span>
                  <app-time-picker [(ngModel)]="nuevaCongregacionContacto.hora_reunion_fin_semana" [ngModelOptions]="{ standalone: true }"
                    colorScheme="violet" placeholder="Hora"></app-time-picker>
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">Ubicación del salón</span>
                <app-ubicacion-picker [ngModel]="nuevaCongregacionContacto.ubicacion" (ngModelChange)="nuevaCongregacionContacto.ubicacion = $event"
                  [ngModelOptions]="{ standalone: true }"></app-ubicacion-picker>
              </div>
            </section>

            <!-- 2 · Discursantes -->
            <section class="flex flex-col gap-2.5 rounded-2xl bg-teal-50/60 dark:bg-teal-400/[0.04] ring-1 ring-inset ring-teal-200/60 dark:ring-teal-400/15 p-3 sm:p-4">
              <header class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-md bg-teal-100 dark:bg-teal-400/15 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0" aria-hidden="true">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg>
                </span>
                <div class="min-w-0 flex-1">
                  <h3 class="text-[0.8rem] font-bold text-teal-800 dark:text-teal-200 leading-tight">Discursantes <span class="font-medium text-teal-700/60 dark:text-teal-300/50">· opcional</span></h3>
                  <p class="text-[0.7rem] text-teal-700/70 dark:text-teal-300/60 leading-tight">Oradores que suelen venir; se ofrecen al programar un entrante.</p>
                </div>
              </header>

              @if (nuevaCongregacionContacto.discursantes.length) {
                <!-- Un bloque por discursante (no una fila de tabla): sus
                     bosquejos son una lista que crece, y en una columna de
                     tabla quedaba un solo campo apretado. -->
                <div class="flex flex-col gap-2">
                  @for (d of nuevaCongregacionContacto.discursantes; track $index; let i = $index) {
                    <div class="flex flex-col gap-2 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/50 ring-1 ring-inset ring-teal-200/60 dark:ring-teal-400/15">
                      <div class="grid grid-cols-[minmax(0,1fr)_2.25rem] sm:grid-cols-[minmax(0,1fr)_9.5rem_2.25rem] gap-2 items-center">
                        <input type="text" [(ngModel)]="d.nombre" [ngModelOptions]="{ standalone: true }" placeholder="Nombre del discursante" autocomplete="off"
                          data-fila-discursante [attr.aria-label]="'Nombre del discursante ' + (i + 1)"
                          [class]="campoModal + ' h-10 text-sm font-semibold'">
                        <input type="tel" inputmode="tel" [(ngModel)]="d.telefono" [ngModelOptions]="{ standalone: true }" placeholder="Teléfono" autocomplete="off"
                          [attr.aria-label]="'Teléfono del discursante ' + (i + 1)"
                          [class]="campoModal + ' h-10 text-sm tabular-nums max-sm:col-span-1 max-sm:row-start-2'">
                        <button type="button" (click)="quitarDiscursanteModal(i)" [title]="'Quitar discursante ' + (i + 1)" [attr.aria-label]="'Quitar discursante ' + (i + 1)"
                          class="max-sm:row-start-1 max-sm:col-start-2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-[background-color,color,transform] duration-150 ease-out active:scale-95">
                          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>

                      <!-- Bosquejos preparados: se añaden del catálogo (o a mano,
                           con Enter) y se quitan con la ×. Al programar un
                           entrante con este orador se ofrecen primero. -->
                      <div class="flex flex-col gap-1.5">
                        <span class="text-[0.7rem] font-semibold text-teal-800/70 dark:text-teal-200/60">
                          Bosquejos preparados
                          @if (d.bosquejos.length) { <span class="font-normal text-teal-700/60 dark:text-teal-300/50">· {{ d.bosquejos.length }}</span> }
                        </span>
                        @if (d.bosquejos.length) {
                          <ul class="flex flex-wrap gap-1.5">
                            @for (b of d.bosquejos; track b; let j = $index) {
                              @let t = partirTema(b);
                              <li class="max-w-full flex items-center gap-1.5 h-8 pl-1.5 pr-1 rounded-lg bg-teal-50 dark:bg-teal-400/10 ring-1 ring-inset ring-teal-200/70 dark:ring-teal-400/20" [title]="b">
                                <span class="shrink-0 font-mono text-[0.65rem] font-bold text-teal-700 dark:text-teal-300 bg-teal-100 dark:bg-teal-400/15 px-1.5 py-px rounded tabular-nums">{{ t.numero ? 'Nº ' + t.numero : 'Sin nº' }}</span>
                                <span class="min-w-0 truncate text-xs text-slate-700 dark:text-slate-200 max-w-[16rem]">{{ t.titulo }}</span>
                                <button type="button" (click)="quitarBosquejoModal(d, j)" [attr.aria-label]="'Quitar bosquejo ' + b"
                                  class="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-teal-700/60 dark:text-teal-300/60 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                              </li>
                            }
                          </ul>
                        }
                        <app-discurso-catalogo-input #nuevoBosquejo
                          formato="numerado"
                          [placeholder]="d.bosquejos.length ? 'Añadir otro: nº o título del bosquejo' : 'Añadir bosquejo: nº o título'"
                          [inputClass]="campoModal + ' h-9 text-sm'"
                          (commit)="anadirBosquejoModal(d, $event, nuevoBosquejo)"
                          (keydown.enter)="$event.preventDefault(); nuevoBosquejo.confirmar()"
                          class="relative block min-w-0">
                        </app-discurso-catalogo-input>
                      </div>
                    </div>
                  }
                </div>
              }
              <button type="button" (click)="anadirDiscursanteModal()"
                class="flex items-center justify-center gap-1.5 h-10 rounded-xl border border-dashed border-teal-300 dark:border-teal-400/30 text-xs font-bold text-teal-700 dark:text-teal-300 hover:bg-teal-100/60 dark:hover:bg-teal-400/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.99]">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {{ nuevaCongregacionContacto.discursantes.length ? 'Añadir otro discursante' : 'Añadir discursante' }}
              </button>
            </section>

            <!-- 3 · Personas de contacto -->
            <section class="flex flex-col gap-2.5 rounded-2xl bg-sky-50/60 dark:bg-sky-400/[0.04] ring-1 ring-inset ring-sky-200/60 dark:ring-sky-400/15 p-3 sm:p-4">
              <header class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-md bg-sky-100 dark:bg-sky-400/15 text-sky-700 dark:text-sky-300 flex items-center justify-center shrink-0" aria-hidden="true">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </span>
                <div class="min-w-0 flex-1">
                  <h3 class="text-[0.8rem] font-bold text-sky-800 dark:text-sky-200 leading-tight">Contactos de la congregación <span class="font-medium text-sky-700/60 dark:text-sky-300/50">· opcional</span></h3>
                  <p class="text-[0.7rem] text-sky-700/70 dark:text-sky-300/60 leading-tight">Con quién coordinar el intercambio de oradores.</p>
                </div>
              </header>

              @if (nuevaCongregacionContacto.personas.length) {
                <div class="hidden sm:grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8.5rem_2.25rem] gap-2 px-0.5 text-[0.7rem] font-semibold text-sky-800/70 dark:text-sky-200/60" aria-hidden="true">
                  <span>Nombre</span><span>Cargo</span><span>Teléfono</span><span></span>
                </div>
                <div class="flex flex-col gap-2">
                  @for (p of nuevaCongregacionContacto.personas; track $index; let i = $index) {
                    <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.25rem] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_8.5rem_2.25rem] gap-2 items-center max-sm:p-2 max-sm:rounded-xl max-sm:bg-white/70 max-sm:dark:bg-slate-900/40 max-sm:ring-1 max-sm:ring-sky-200/60 max-sm:dark:ring-sky-400/15">
                      <input type="text" [(ngModel)]="p.nombre" [ngModelOptions]="{ standalone: true }" placeholder="Nombre" autocomplete="off"
                        data-fila-persona [attr.aria-label]="'Nombre del contacto ' + (i + 1)"
                        [class]="campoModal + ' h-10 text-sm max-sm:col-span-2'">
                      <input type="text" [(ngModel)]="p.cargo" [ngModelOptions]="{ standalone: true }" placeholder="Cargo" autocomplete="off"
                        list="cargos-contacto" [attr.aria-label]="'Cargo del contacto ' + (i + 1)"
                        [class]="campoModal + ' h-10 text-sm max-sm:col-span-2'">
                      <input type="tel" inputmode="tel" [(ngModel)]="p.telefono" [ngModelOptions]="{ standalone: true }" placeholder="Teléfono" autocomplete="off"
                        [attr.aria-label]="'Teléfono del contacto ' + (i + 1)"
                        [class]="campoModal + ' h-10 text-sm tabular-nums max-sm:col-span-2'">
                      <button type="button" (click)="quitarPersonaModal(i)" [title]="'Quitar contacto ' + (i + 1)" [attr.aria-label]="'Quitar contacto ' + (i + 1)"
                        class="max-sm:row-start-1 max-sm:col-start-3 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-[background-color,color,transform] duration-150 ease-out active:scale-95">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  }
                </div>
                <!-- Sugerencias, no una lista cerrada: se puede escribir
                     cualquier otro cargo. -->
                <datalist id="cargos-contacto">
                  @for (cargo of cargosContactoSugeridos; track cargo) { <option [value]="cargo"></option> }
                </datalist>
              }
              <button type="button" (click)="anadirPersonaModal()"
                class="flex items-center justify-center gap-1.5 h-10 rounded-xl border border-dashed border-sky-300 dark:border-sky-400/30 text-xs font-bold text-sky-700 dark:text-sky-300 hover:bg-sky-100/60 dark:hover:bg-sky-400/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.99]">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {{ nuevaCongregacionContacto.personas.length ? 'Añadir otro contacto' : 'Añadir contacto' }}
              </button>
            </section>

            <!-- 4 · Notas y archivos -->
            <section class="grid gap-4 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <label for="cong-notas" class="text-xs font-semibold text-slate-600 dark:text-slate-300">Notas <span class="font-normal text-slate-400">· opcional</span></label>
                <textarea id="cong-notas" rows="3" [(ngModel)]="nuevaCongregacionContacto.notas" placeholder="Ej. Prefieren coordinar con dos semanas de anticipación."
                  [class]="campoModal + ' py-2.5 text-sm leading-relaxed resize-y min-h-[5.5rem]'"></textarea>
              </div>
              <div class="flex flex-col gap-1.5">
                <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">Archivos adjuntos <span class="font-normal text-slate-400">· opcional</span></span>
                @if (archivosCongregacionContacto().length || archivosNuevosCongregacionContacto().length) {
                  <div class="flex flex-col gap-1">
                    @for (a of archivosCongregacionContacto(); track a.nombre) {
                      <div class="flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <svg class="w-3.5 h-3.5 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                        <button type="button" (click)="abrirArchivoCongregacionContacto(a)" class="flex-1 min-w-0 truncate text-left text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-teal-600 dark:hover:text-teal-400">
                          {{ a.nombre }}
                        </button>
                        <span class="shrink-0 text-[0.65rem] text-slate-400">{{ formatoTamanoArchivo(a.tamano_bytes) }}</span>
                        <button type="button" (click)="eliminarArchivoCongregacionContactoModal(a.nombre)" title="Quitar"
                          class="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95">
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    }
                    @for (f of archivosNuevosCongregacionContacto(); track $index; let i = $index) {
                      <div class="flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-dashed border-teal-300 dark:border-teal-700 bg-teal-50/50 dark:bg-teal-900/10">
                        <svg class="w-3.5 h-3.5 shrink-0 text-teal-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                        <span class="flex-1 min-w-0 truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{{ f.name }}</span>
                        <span class="shrink-0 text-[0.65rem] text-teal-600 dark:text-teal-400 font-bold">Pendiente</span>
                        <button type="button" (click)="quitarArchivoNuevoCongregacionContacto(i)" title="Quitar"
                          class="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all active:scale-95">
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                      </div>
                    }
                  </div>
                }
                <input #archivoCongInput type="file" multiple class="hidden" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  (change)="onArchivosCongregacionContactoSeleccionados(archivoCongInput)">
                <button type="button" (click)="archivoCongInput.click()"
                  class="flex flex-col items-center justify-center gap-1 min-h-[5.5rem] flex-1 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:border-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99]">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                  <span class="text-xs font-bold">Adjuntar archivo</span>
                  <span class="text-[0.65rem] text-slate-400">Listado de discursantes en PDF, Word o imagen</span>
                </button>
              </div>
            </section>
          </div>

          <div class="shrink-0 flex gap-2 sm:justify-end px-5 sm:px-6 pt-3 pb-6 sm:pb-4 border-t border-slate-100 dark:border-slate-800">
            <button type="button" (click)="cerrarModalCongregacionContacto()"
              class="flex-1 sm:flex-none sm:px-5 h-11 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color] duration-150 ease-out active:scale-[0.97]">
              Cancelar
            </button>
            <button type="button" (click)="guardarCongregacionContacto()" [disabled]="!nuevaCongregacionContacto.nombre.trim()"
              class="flex-1 sm:flex-none sm:px-6 h-11 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-sm font-bold text-white transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] shadow-md shadow-teal-500/20">
              {{ editandoCongregacionContacto() ? 'Guardar cambios' : 'Añadir congregación' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (modalTemaVisible()) {
      <div class="disc-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" (click)="cerrarModalTema()">
        <div class="disc-sheet bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm flex flex-col border border-slate-200/60 dark:border-slate-700/60 overflow-hidden" (click)="$event.stopPropagation()">
          <div class="flex justify-center pt-3 pb-1 sm:hidden">
            <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          </div>
          <div class="px-5 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-black text-slate-900 dark:text-white">{{ editandoTema() ? 'Editar Tema' : 'Añadir Tema' }}</h2>
              <button (click)="cerrarModalTema()"
                class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-[background-color,color] duration-150 ease-out active:scale-[0.95]">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-3 px-5 py-4">
            @if (!editandoTema()) {
              <div class="flex flex-col gap-1.5">
                <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Publicador</label>
                <select [(ngModel)]="nuevoTema.id_publicador"
                  class="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-500 transition-[border-color,background-color] duration-150 ease-out w-full">
                  <option [value]="null">— Seleccionar publicador —</option>
                  @for (p of publicadores(); track p.id_publicador) {
                    <option [value]="p.id_publicador">{{ p.nombre_completo }}</option>
                  }
                </select>
              </div>
            }
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nº Tema <span class="normal-case font-normal opacity-60">(opcional)</span></label>
              <input type="number" [(ngModel)]="nuevoTema.numero_tema" placeholder="Ej. 15"
                class="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-[border-color,background-color] duration-150 ease-out w-full">
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Título del Discurso</label>
              <app-discurso-catalogo-input
                [(ngModel)]="nuevoTema.titulo"
                [ngModelOptions]="{ standalone: true }"
                formato="titulo"
                (seleccion)="onTemaDelCatalogo($event)"
                placeholder="Nº o palabra del discurso"
                inputClass="h-11 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-amber-500 transition-[border-color,background-color] duration-150 ease-out w-full"></app-discurso-catalogo-input>
              <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1">Al elegir del catálogo se rellena también el número.</p>
            </div>
          </div>
          <div class="flex gap-2 px-5 pb-6 sm:pb-5 pt-1">
            <button (click)="cerrarModalTema()"
              class="flex-1 h-11 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color] duration-150 ease-out active:scale-[0.97]">
              Cancelar
            </button>
            <button (click)="guardarTema()" [disabled]="!nuevoTema.titulo.trim() || (!editandoTema() && !nuevoTema.id_publicador)"
              class="flex-1 h-11 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-sm font-bold text-white transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] shadow-md shadow-amber-500/20">
              {{ editandoTema() ? 'Guardar cambios' : 'Añadir' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL AÑADIR SALIENTE ===== -->
    @if (modalSalienteVisible()) {
      <div class="disc-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" (click)="cerrarModalSaliente()">
        <div class="disc-sheet bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm flex flex-col gap-0 border border-slate-200/60 dark:border-slate-700/60 overflow-hidden" (click)="$event.stopPropagation()">

          <!-- Handle bar (móvil) -->
          <div class="flex justify-center pt-3 pb-1 sm:hidden">
            <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          </div>

          <!-- Header -->
          <div class="px-5 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-black text-slate-900 dark:text-white">Añadir Saliente</h2>
              <button (click)="cerrarModalSaliente()"
                class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-[background-color,color] duration-150 ease-out active:scale-[0.95]">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <!-- Fields -->
          <div class="flex flex-col gap-3 px-5 py-4">
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Fecha</label>
              <app-date-picker
                [(ngModel)]="nuevoSaliente.fecha"
                [minDate]="mesMinDate()"
                [maxDate]="mesMaxDate()"
                placeholder="Seleccionar fecha">
              </app-date-picker>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hora de la reunión</label>
              <app-time-picker [(ngModel)]="nuevoSaliente.hora" [ngModelOptions]="{ standalone: true }"
                colorScheme="violet" placeholder="Seleccionar hora"></app-time-picker>
              <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1">Hora de la reunión en la congregación destino.</p>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Publicador</label>
              <div class="relative">
                <input
                  type="text"
                  [value]="busquedaPublicador()"
                  (input)="onBusquedaPublicadorInput($any($event.target).value)"
                  (focus)="mostrarDropdownBusqueda.set(true); resultadosBusqueda.set(publicadores())"
                  (blur)="$any($event.relatedTarget)?.closest('.pub-dropdown') ? null : mostrarDropdownBusqueda.set(false)"
                  placeholder="Buscar conferenciante…"
                  class="h-11 px-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out">
                @if (nuevoSaliente.id_publicador) {
                  <button type="button"
                    (click)="nuevoSaliente.id_publicador = null; nuevoSaliente.tema_discurso = ''; busquedaPublicador.set(''); buscarEnCatalogo.set(false)"
                    class="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color,color] duration-150 ease-out">
                    <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                }
                @if (mostrarDropdownBusqueda()) {
                  <div class="disc-dropdown pub-dropdown absolute z-10 mt-1.5 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-xl shadow-black/10 max-h-48 overflow-y-auto py-1">
                    @if (buscandoPublicador()) {
                      <div class="px-4 py-3 text-xs text-slate-400">Buscando…</div>
                    } @else if (resultadosBusqueda().length === 0) {
                      <div class="px-4 py-3 text-xs text-slate-400">Sin resultados</div>
                    } @else {
                      @for (p of resultadosBusqueda(); track p.id_publicador) {
                        <button type="button"
                          (mousedown)="seleccionarPublicadorBusqueda(p)"
                          class="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-[background-color] duration-100 ease-out">
                          {{ p.nombre_completo }}
                        </button>
                      }
                    }
                  </div>
                }
              </div>
              @if (nuevoSaliente.id_publicador) {
                <p class="text-[0.7rem] text-violet-600 dark:text-violet-400 font-semibold flex items-center gap-1">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                  {{ publicadorSeleccionadoNombre() }}
                </p>
              }
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Congregación Destino</label>
              <app-congregacion-contacto-input [(ngModel)]="nuevoSaliente.congregacion_destino" [ngModelOptions]="{ standalone: true }"
                [idCong]="idCongActual()"
                (commit)="autorellenarUbicacion()"
                (seleccion)="onNuevoSalienteCongregacionSeleccionada($event)"
                placeholder="Nombre congregación"
                inputClass="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out w-full"></app-congregacion-contacto-input>
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ubicación del Salón</label>
              <app-ubicacion-picker [ngModel]="nuevoSaliente.ubicacion" (ngModelChange)="onUbicacionModalChange($event)"
                [ngModelOptions]="{ standalone: true }"></app-ubicacion-picker>
              @if (ubicacionAutorellenada() && nuevoSaliente.ubicacion) {
                <p class="text-[0.65rem] text-violet-600 dark:text-violet-400 px-1">Ubicación recordada de una asignación anterior.</p>
              }
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tema del Discurso</label>
              @if (temasDelPublicadorSeleccionado().length > 0 && !buscarEnCatalogo()) {
                <!-- Custom dropdown -->
                <div class="relative tema-dropdown">
                  <button type="button"
                    (click)="mostrarDropdownTemas.set(!mostrarDropdownTemas())"
                    (blur)="$any($event.relatedTarget)?.closest('.tema-dropdown') ? null : mostrarDropdownTemas.set(false)"
                    class="w-full h-11 px-3 pr-9 rounded-xl border text-left text-sm transition-[border-color,background-color] duration-150 ease-out flex items-center gap-2"
                    [class]="mostrarDropdownTemas()
                      ? 'border-violet-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100'">
                    @if (nuevoSaliente.tema_discurso) {
                      @for (t of temasDelPublicadorSeleccionado(); track t.id_tema) {
                        @if (t.titulo === nuevoSaliente.tema_discurso) {
                          @if (t.numero_tema != null) {
                            <span class="shrink-0 min-w-[1.5rem] h-5 px-1.5 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[0.65rem] font-black flex items-center justify-center">{{ t.numero_tema }}</span>
                          }
                          <span class="truncate font-medium">{{ t.titulo }}</span>
                        }
                      }
                    } @else {
                      <span class="text-slate-400">Seleccionar tema…</span>
                    }
                    <!-- chevron -->
                    <svg class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 transition-transform duration-150"
                      [class.rotate-180]="mostrarDropdownTemas()"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                    </svg>
                  </button>
                  @if (mostrarDropdownTemas()) {
                    <div class="disc-dropdown tema-dropdown absolute z-30 left-0 right-0 mt-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                      <div class="flex flex-col p-1.5 gap-0.5 max-h-52 overflow-y-auto simple-scrollbar">
                        @for (t of temasDelPublicadorSeleccionado(); track t.id_tema) {
                          <button type="button"
                            (mousedown)="nuevoSaliente.tema_discurso = t.titulo; mostrarDropdownTemas.set(false)"
                            class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-[background-color] duration-100 ease-out active:scale-[0.98] group"
                            [class]="nuevoSaliente.tema_discurso === t.titulo
                              ? 'bg-amber-50 dark:bg-amber-900/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'">
                            <!-- número badge -->
                            @if (t.numero_tema != null) {
                              <span class="shrink-0 min-w-[2rem] h-6 px-1.5 rounded-md text-[0.65rem] font-black flex items-center justify-center transition-colors duration-100"
                                [class]="nuevoSaliente.tema_discurso === t.titulo
                                  ? 'bg-amber-200 dark:bg-amber-800/60 text-amber-800 dark:text-amber-200'
                                  : 'bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/30 group-hover:text-amber-700 dark:group-hover:text-amber-300'">
                                {{ t.numero_tema }}
                              </span>
                            } @else {
                              <span class="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400 dark:bg-amber-500 mt-0.5"></span>
                            }
                            <!-- título -->
                            <span class="flex-1 min-w-0 text-sm font-medium truncate transition-colors duration-100"
                              [class]="nuevoSaliente.tema_discurso === t.titulo
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-slate-700 dark:text-slate-200'">
                              {{ t.titulo }}
                            </span>
                            <!-- check activo -->
                            @if (nuevoSaliente.tema_discurso === t.titulo) {
                              <svg class="shrink-0 w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" stroke-linecap="round"/></svg>
                            }
                          </button>
                        }
                      </div>
                    </div>
                  }
                </div>
                <button type="button" (click)="buscarEnCatalogo.set(true)"
                  class="self-start text-[0.65rem] font-bold text-violet-600 dark:text-violet-400 hover:underline px-1">
                  ¿Otro discurso? Buscar en el catálogo
                </button>
              } @else {
                <app-discurso-catalogo-input
                  [(ngModel)]="nuevoSaliente.tema_discurso"
                  [ngModelOptions]="{ standalone: true }"
                  placeholder="Nº o palabra del discurso"
                  [disabled]="!nuevoSaliente.id_publicador"
                  inputClass="h-11 pl-3 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out w-full disabled:opacity-50 disabled:cursor-not-allowed"></app-discurso-catalogo-input>
                @if (!nuevoSaliente.id_publicador) {
                  <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1">Selecciona primero un publicador.</p>
                } @else if (temasDelPublicadorSeleccionado().length > 0) {
                  <button type="button" (click)="buscarEnCatalogo.set(false)"
                    class="self-start text-[0.65rem] font-bold text-violet-600 dark:text-violet-400 hover:underline px-1">
                    Volver a sus temas registrados
                  </button>
                } @else {
                  <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 px-1">Sin temas registrados: escribe el número o una palabra para buscar en el catálogo.</p>
                }
              }
            </div>
          </div>

          <!-- Actions -->
          <div class="flex gap-2 px-5 pb-6 sm:pb-5 pt-1">
            <button (click)="cerrarModalSaliente()"
              class="flex-1 h-11 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color] duration-150 ease-out active:scale-[0.97]">
              Cancelar
            </button>
            <button (click)="guardarSaliente()" [disabled]="!nuevoSaliente.fecha || estado() === 'loading'"
              class="flex-1 h-11 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-sm font-bold text-white transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] shadow-md shadow-violet-500/20">
              Añadir
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ===== MODAL NOTIFICAR POR WHATSAPP ===== -->
    @if (whatsappPendiente(); as wa) {
      <div class="disc-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm" (click)="cerrarWhatsapp()">
        <div class="disc-sheet bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md flex flex-col border border-slate-200/60 dark:border-slate-700/60 overflow-hidden" (click)="$event.stopPropagation()">

          <div class="flex justify-center pt-3 pb-1 sm:hidden">
            <div class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
          </div>

          <div class="px-5 pt-3 pb-4 sm:pt-5 border-b border-slate-100 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <h2 class="text-base font-black text-slate-900 dark:text-white">Notificar por WhatsApp</h2>
              <button (click)="cerrarWhatsapp()"
                class="w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-[background-color,color] duration-150 ease-out active:scale-[0.95]">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>

          <div class="flex flex-col gap-3 px-5 py-4">
            <div class="flex items-center gap-2 text-sm">
              <span class="text-slate-500 dark:text-slate-400">Para:</span>
              <span class="font-bold text-slate-800 dark:text-slate-100">{{ wa.nombre }}</span>
              @if (wa.telefono) {
                <span class="text-slate-400 dark:text-slate-500">· +{{ wa.telefono }}</span>
              }
            </div>
            @if (!wa.telefono) {
              <div class="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5">
                <svg class="w-4 h-4 shrink-0 mt-0.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                </svg>
                <p class="text-xs text-amber-700 dark:text-amber-300">
                  Este publicador no tiene teléfono registrado. Se abrirá WhatsApp para que elijas el contacto.
                </p>
              </div>
            }
            <div class="flex flex-col gap-1.5">
              <label class="text-[0.7rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mensaje</label>
              <textarea rows="11"
                [value]="wa.mensaje"
                (input)="onMensajeWhatsappChange($any($event.target).value)"
                class="px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-800 transition-[border-color,background-color] duration-150 ease-out w-full resize-none leading-relaxed"></textarea>
            </div>
          </div>

          <div class="flex gap-2 px-5 pb-6 sm:pb-5 pt-1">
            <button (click)="cerrarWhatsapp()"
              class="flex-1 h-11 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color] duration-150 ease-out active:scale-[0.97]">
              Cancelar
            </button>
            <button (click)="enviarWhatsapp()" [disabled]="!wa.mensaje.trim()"
              class="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-sm font-bold text-white flex items-center justify-center gap-2 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] shadow-md shadow-emerald-500/20">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.988 2.896 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              Abrir WhatsApp
            </button>
          </div>
        </div>
      </div>
    }

    @if (modalHistorialVisible()) {
      <app-historial-discursos
        [idCong]="idCongActual()"
        [desdeInicial]="rangoHistorialPorDefecto().desde"
        [hastaInicial]="rangoHistorialPorDefecto().hasta"
        (cerrar)="modalHistorialVisible.set(false)">
      </app-historial-discursos>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }

    /* Mismo vocabulario de movimiento que Entre semana / Logística / Ajustes:
       esta pestaña compartía estructura con ellas pero no llevaba animación
       propia, así que al cambiar a Discursos todo aparecía de golpe. */
    :host {
      --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
    }

    /* ── Entrada de tarjetas (entrantes / salientes / temas / congregaciones) ── */
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(5px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .disc-card {
      animation: cardIn 220ms var(--ease-out-expo) backwards;
    }
    .disc-card:nth-child(1)  { animation-delay:  15ms; }
    .disc-card:nth-child(2)  { animation-delay:  40ms; }
    .disc-card:nth-child(3)  { animation-delay:  65ms; }
    .disc-card:nth-child(4)  { animation-delay:  90ms; }
    .disc-card:nth-child(5)  { animation-delay: 115ms; }
    .disc-card:nth-child(6)  { animation-delay: 140ms; }
    .disc-card:nth-child(n+7){ animation-delay: 160ms; }

    /* ── Dropdown origin-aware (Emil: never scale from center on popovers) ── */
    @keyframes dropIn {
      from { opacity: 0; transform: scale(0.95) translateY(-4px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .disc-dropdown {
      transform-origin: top;
      animation: dropIn 160ms var(--ease-out-expo);
    }

    /* ── Overlay + diálogo centrado (confirmación, generar mes) ── */
    @keyframes overlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes dialogIn {
      from { opacity: 0; transform: scale(0.95) translateY(4px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .disc-overlay { animation: overlayIn 140ms ease-out; }
    .disc-dialog  { animation: dialogIn 200ms var(--ease-out-expo) backwards; }

    /* ── Hoja móvil / diálogo en escritorio ──
       Estos modales cambian de posición con el viewport (items-end en móvil,
       items-center desde sm:) así que la animación cambia con ellos: sube
       desde abajo como una hoja en móvil y entra centrada en escritorio. */
    @keyframes sheetUp {
      from { opacity: 0; transform: translateY(100%); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .disc-sheet { animation: sheetUp 220ms cubic-bezier(0.32, 0.72, 0, 1) backwards; }
    @media (min-width: 640px) {
      .disc-sheet { animation: dialogIn 200ms var(--ease-out-expo) backwards; }
    }

    @media (prefers-reduced-motion: reduce) {
      .disc-card, .disc-dropdown, .disc-overlay, .disc-dialog, .disc-sheet {
        animation: none !important;
      }
    }
  `],
})
export class ReunionesDiscursosComponent implements OnInit {
  private svc = inject(DiscursosService);
  private conflictosSvc = inject(ConflictosService);
  private congCtx = inject(CongregacionContextService);
  private auth = inject(AuthStore);

  readonly mesesOpciones = MESES_ES.map((label, i) => ({ value: i + 1, label }));

  estado = signal<Estado>('idle');
  errorMsg = signal('');
  confirmadoBanner = signal(false);
  mesDatos = signal<DiscursosMesOut | null>(null);
  mesesDisponibles = signal<MesDiscursosDisponible[]>([]);

  /**
   * Agrupa `mesesDisponibles` por año consecutivo, para mostrar el año una
   * sola vez por grupo en vez de repetirlo en cada fila del historial.
   * Asume que la lista ya llega ordenada por año/mes (la da así el backend).
   */
  mesesPorAno = computed<{ ano: number; meses: MesDiscursosDisponible[] }[]>(() => {
    const grupos: { ano: number; meses: MesDiscursosDisponible[] }[] = [];
    for (const m of this.mesesDisponibles()) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.ano === m.ano) {
        ultimo.meses.push(m);
      } else {
        grupos.push({ ano: m.ano, meses: [m] });
      }
    }
    return grupos;
  });
  grupos = signal<GrupoSimple[]>([]);
  publicadores = signal<PublicadorSimple[]>([]);
  descargandoPdf = signal(false);
  subTab = signal<SubTab>('entrantes');

  // Selector de mes de la barra de pestañas. Sustituye a la barra lateral
  // fija: la lista de meses y el botón de generar sólo ocupan ancho mientras
  // se usan, igual que en Logística.
  menuMesesAbierto = signal(false);

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.menuMesesAbierto() && !target.closest('[data-mes-menu]')) {
      this.menuMesesAbierto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuMesesAbierto()) this.menuMesesAbierto.set(false);
  }

  temas = signal<TemaPublicador[]>([]);
  loadingTemas = signal(false);
  temasLoaded = signal(false);

  congregacionesContacto = signal<CongregacionContacto[]>([]);
  loadingCongregacionesContacto = signal(false);
  congregacionesContactoLoaded = signal(false);
  temasAgrupados = computed(() => {
    const map = new Map<number, { nombre: string; temas: TemaPublicador[] }>();
    for (const t of this.temas()) {
      if (!map.has(t.id_publicador)) map.set(t.id_publicador, { nombre: t.nombre_publicador, temas: [] });
      map.get(t.id_publicador)!.temas.push(t);
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  });
  temasDelPublicadorSeleccionado(): TemaPublicador[] {
    const id = this.nuevoSaliente?.id_publicador;
    if (!id) return [];
    return this.temas().filter(t => t.id_publicador === id && t.activo);
  }

  modalTemaVisible = signal(false);
  editandoTema = signal<TemaPublicador | null>(null);
  nuevoTema: { id_publicador: number | null; numero_tema: string; titulo: string } = {
    id_publicador: null, numero_tema: '', titulo: '',
  };

  modalCongregacionContactoVisible = signal(false);
  editandoCongregacionContacto = signal<CongregacionContacto | null>(null);
  nuevaCongregacionContacto: {
    nombre: string; dia_reunion_fin_semana: string | null;
    hora_reunion_fin_semana: string | null; notas: string | null; ubicacion: UbicacionSaliente | null;
    personas: { id_contacto_persona?: number; nombre: string; cargo: string | null; telefono: string | null }[];
  } = { nombre: '', dia_reunion_fin_semana: null, hora_reunion_fin_semana: null, notas: null, ubicacion: null, personas: [] };

  modalGenerarVisible = signal(false);
  modalSalienteVisible = signal(false);
  modalHistorialVisible = signal(false);

  /**
   * Rango por defecto al abrir el historial: desde el primer día de hace 12
   * meses hasta el último mes ya programado (incluye lo agendado a futuro),
   * o el mes actual si todavía no hay ningún mes generado.
   */
  rangoHistorialPorDefecto = computed<{ desde: string; hasta: string }>(() => {
    const hoy = new Date();
    const desdeD = new Date(hoy.getFullYear(), hoy.getMonth() - 11, 1);
    const desde = `${desdeD.getFullYear()}-${String(desdeD.getMonth() + 1).padStart(2, '0')}-01`;

    const meses = this.mesesDisponibles();
    let anoHasta = hoy.getFullYear();
    let mesHasta = hoy.getMonth() + 1;
    if (meses.length > 0) {
      // mesesDisponibles llega ordenada desc (ano, mes) desde el backend.
      anoHasta = meses[0].ano;
      mesHasta = meses[0].mes;
    }
    const ultimoDia = new Date(anoHasta, mesHasta, 0).getDate();
    const hasta = `${anoHasta}-${String(mesHasta).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    return { desde, hasta };
  });

  abrirModalHistorial(): void {
    this.modalHistorialVisible.set(true);
  }

  busquedaPublicador = signal('');
  resultadosBusqueda = signal<PublicadorSimple[]>([]);
  buscandoPublicador = signal(false);
  mostrarDropdownBusqueda = signal(false);
  mostrarDropdownTemas = signal(false);
  /** En el modal de saliente: buscar en el catálogo del S-34 en vez de en los
      temas ya registrados del publicador. */
  buscarEnCatalogo = signal(false);
  private busqueda$ = new Subject<string>();

  confirmPendiente = signal<{ titulo: string; mensaje: string; accionLabel: string; callback: () => void } | null>(null);
  editandoEntrantes = signal<Set<number>>(new Set());
  editandoSalientes = signal<Set<number>>(new Set());

  aceptarConfirm(): void {
    this.confirmPendiente()?.callback();
    this.confirmPendiente.set(null);
  }

  cancelarConfirm(): void {
    this.confirmPendiente.set(null);
  }

  isEditandoEntrante(id: number): boolean {
    return this.editandoEntrantes().has(id);
  }

  toggleEditEntrante(id: number): void {
    const s = new Set(this.editandoEntrantes());
    s.has(id) ? s.delete(id) : s.add(id);
    this.editandoEntrantes.set(s);
  }

  isEditandoSaliente(id: number): boolean {
    return this.editandoSalientes().has(id);
  }

  toggleEditSaliente(id: number): void {
    const s = new Set(this.editandoSalientes());
    s.has(id) ? s.delete(id) : s.add(id);
    this.editandoSalientes.set(s);
  }

  genMes = new Date().getMonth() + 1;
  genAno = new Date().getFullYear();
  mesDropdownAbierto = signal(false);

  nuevoSaliente: {
    fecha: string; id_publicador: number | null; congregacion_destino: string;
    tema_discurso: string; hora: string; ubicacion: UbicacionSaliente | null; notas: string;
  } = {
    fecha: '', id_publicador: null, congregacion_destino: '', tema_discurso: '', hora: '', ubicacion: null, notas: '',
  };

  /** true cuando la ubicación del modal viene del autorelleno por congregación. */
  readonly ubicacionAutorellenada = signal(false);

  private get idCong(): number | null {
    return this.congCtx.effectiveCongregacionId();
  }

  /** Expone `idCong` a la plantilla: el getter es privado, `strictTemplates` no deja enlazarlo directo. */
  idCongActual(): number | null {
    return this.idCong;
  }

  constructor() {
    effect(() => {
      const id = this.idCong;
      if (id) {
        untracked(() => {
          this.cargarMeses();
          this.cargarGrupos();
          this.cargarPublicadores();
          this.temasLoaded.set(false);
          this.temas.set([]);
          this.loadTemas();
          this.congregacionesContactoLoaded.set(false);
          this.congregacionesContacto.set([]);
          this.loadCongregacionesContacto();
        });
      }
    });
  }

  ngOnInit(): void {
    this.busqueda$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((q) => {
        if (!q.trim()) {
          this.resultadosBusqueda.set(this.publicadores());
          this.buscandoPublicador.set(false);
          return EMPTY;
        }
        this.buscandoPublicador.set(true);
        return this.svc.buscarPublicadores(this.idCong, q.trim());
      }),
    ).subscribe({
      next: (r) => { this.resultadosBusqueda.set(r); this.buscandoPublicador.set(false); },
      error: () => this.buscandoPublicador.set(false),
    });
  }

  hasEditPermission(): boolean {
    return this.auth.hasPermission('reuniones.discursos');
  }

  mesLabel(ano: number, mes: number): string {
    return `${MESES_ES[mes - 1]} ${ano}`;
  }

  /** Solo el nombre del mes, para listas ya agrupadas por año. */
  mesSoloLabel(mes: number): string {
    return MESES_ES[mes - 1];
  }

  /** El mes que está abierto ahora mismo, para marcarlo en el selector. */
  esMesActivo(m: { ano: number; mes: number }): boolean {
    const abierto = this.mesDatos();
    return !!abierto && abierto.ano === m.ano && abierto.mes === m.mes;
  }

  mesMinDate(): string {
    const d = this.mesDatos();
    if (!d) return '';
    return `${d.ano}-${String(d.mes).padStart(2, '0')}-01`;
  }

  mesMaxDate(): string {
    const d = this.mesDatos();
    if (!d) return '';
    const last = new Date(d.ano, d.mes, 0).getDate();
    return `${d.ano}-${String(d.mes).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }

  formatFecha(fechaStr: string): string {
    const d = new Date(fechaStr + 'T00:00:00');
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]}`;
  }

  private cargarMeses(): void {
    if (!this.idCong) return;
    this.svc.getMeses(this.idCong).subscribe({
      next: (m) => this.mesesDisponibles.set(m),
      error: () => {},
    });
  }

  private cargarGrupos(): void {
    if (!this.idCong) return;
    this.svc.getGrupos(this.idCong).subscribe({
      next: (g) => this.grupos.set(g),
      error: () => {},
    });
  }

  private cargarPublicadores(): void {
    if (!this.idCong) return;
    this.svc.getPublicadores(this.idCong).subscribe({
      next: (p) => {
        // Si la congregación aún no tiene nadie con el permiso "orador",
        // caemos a todos los activos para que el desplegable sea usable.
        if (p.length === 0) {
          this.svc.getPublicadores(this.idCong, false).subscribe({
            next: (todos) => this.publicadores.set(todos),
            error: () => {},
          });
          return;
        }
        this.publicadores.set(p);
      },
      error: () => {},
    });
  }

  /**
   * Opciones del desplegable de una tarjeta: la lista de conferenciantes más el
   * publicador ya asignado si no figura en ella (p. ej. porque perdió el
   * permiso "orador"), para que la asignación guardada siempre se vea.
   */
  opcionesPublicador(saliente: DiscursoSalienteOut): PublicadorSimple[] {
    const lista = this.publicadores();
    const asignado = saliente.publicador;
    if (!asignado || lista.some(p => p.id_publicador === asignado.id_publicador)) return lista;
    return [asignado, ...lista];
  }

  cargarMes(ano: number, mes: number): void {
    this.estado.set('loading');
    this.editandoEntrantes.set(new Set());
    this.editandoSalientes.set(new Set());
    this.svc.getMes(ano, mes, this.idCong).subscribe({
      next: (data) => {
        this.mesDatos.set(data);
        this.estado.set('ready');
        // También avisa de los que ya traían título antes de esta sesión.
        data.entrantes.filter(e => e.titulo_discurso?.trim()).forEach(e => this.verificarRepetido(e));
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'Error al cargar el mes');
        this.estado.set('error');
      },
    });
  }

  abrirModalGenerar(): void {
    this.modalGenerarVisible.set(true);
  }

  cerrarModalGenerar(): void {
    this.modalGenerarVisible.set(false);
  }

  generarMes(): void {
    this.estado.set('loading');
    this.cerrarModalGenerar();
    this.svc.generar({ ano: this.genAno, mes: this.genMes }, this.idCong).subscribe({
      next: (data) => {
        this.mesDatos.set(data);
        this.estado.set('ready');
        this.cargarMeses();
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'Error al generar el mes');
        this.estado.set('error');
      },
    });
  }

  confirmarMes(): void {
    const d = this.mesDatos();
    if (!d) return;
    this.estado.set('loading');
    this.svc.confirmar({ ano: d.ano, mes: d.mes }, this.idCong).subscribe({
      next: (data) => {
        this.mesDatos.set(data);
        this.estado.set('ready');
        this.confirmadoBanner.set(true);
        this.cargarMeses();
        setTimeout(() => this.confirmadoBanner.set(false), 4000);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'Error al confirmar');
        this.estado.set('error');
      },
    });
  }

  borrarMes(): void {
    const d = this.mesDatos();
    if (!d) return;
    this.confirmPendiente.set({
      titulo: `Eliminar ${this.mesLabel(d.ano, d.mes)}`,
      mensaje: 'Se eliminará toda la programación de discursos de este mes. Esta acción no se puede deshacer.',
      accionLabel: 'Eliminar',
      callback: () => {
        this.estado.set('loading');
        this.svc.eliminarMes(d.ano, d.mes, this.idCong).subscribe({
          next: () => {
            this.mesDatos.set(null);
            this.estado.set('idle');
            this.cargarMeses();
          },
          error: (e) => {
            this.errorMsg.set(e?.error?.detail ?? 'Error al borrar el mes');
            this.estado.set('error');
          },
        });
      },
    });
  }

  descargarPdf(tipo: 'entrantes' | 'salientes', ano: number, mes: number, event: Event): void {
    event.stopPropagation();
    this.descargandoPdf.set(true);
    const obs = tipo === 'entrantes'
      ? this.svc.descargarPdfEntrantes(ano, mes, this.idCong)
      : this.svc.descargarPdfSalientes(ano, mes, this.idCong);
    obs.subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `discursos_${tipo}_${MESES_ES[mes - 1]}_${ano}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.descargandoPdf.set(false);
      },
      error: () => this.descargandoPdf.set(false),
    });
  }

  onEntranteChange(entrante: DiscursoEntranteOut, campo: string, event: Event): void {
    this.guardarCampoEntrante(entrante, campo, (event.target as HTMLInputElement).value);
  }

  /**
   * Guarda un campo del entrante con el valor ya resuelto. Los inputs normales
   * llegan por `onEntranteChange` (evento de blur) y el campo con catálogo por
   * su salida `(commit)`, que emite el texto directamente.
   */
  guardarCampoEntrante(entrante: DiscursoEntranteOut, campo: string, valor: string | null): void {
    const val = (valor ?? '').trim() || null;
    if ((entrante as any)[campo] === val) return;
    this.svc.editarEntrante(entrante.id_discurso_entrante, { [campo]: val }, this.idCong).subscribe({
      next: (updated) => {
        this.updateEntrante(updated);
        if (campo === 'titulo_discurso') this.verificarRepetido(updated);
      },
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  private static readonly SIN_BOSQUEJOS: readonly string[] = [];

  /**
   * El discursante registrado que corresponde al orador escrito en la fila,
   * buscado por nombre (sin tildes ni mayúsculas) en el directorio compartido.
   * Si el mismo nombre está en varias congregaciones, gana la de origen de la
   * fila. Un nombre escrito a mano que no está registrado no da nada.
   */
  private discursanteDeLaFila(nombreOrador: string | null, congregacionOrigen: string | null): Discursante | undefined {
    const nombre = this.normalizarTexto((nombreOrador ?? '').trim());
    if (!nombre) return undefined;
    const origen = this.normalizarTexto((congregacionOrigen ?? '').trim());
    let candidato: Discursante | undefined;
    for (const c of this.directorioContactoSig()) {
      const d = c.discursantes.find(x => this.normalizarTexto(x.nombre) === nombre);
      if (!d) continue;
      if (origen && this.normalizarTexto(c.nombre) === origen) return d;
      candidato ??= d;
    }
    return candidato;
  }

  /**
   * Bosquejos preparados del orador de la fila, para ofrecerlos primero en el
   * campo Discurso. Devuelve el mismo array del directorio (no una copia) para
   * que el input del campo no cambie en cada detección de cambios.
   */
  bosquejosDelOrador(entrante: DiscursoEntranteOut): readonly string[] {
    return this.discursanteDeLaFila(entrante.nombre_orador, entrante.congregacion_origen)?.bosquejos
      ?? ReunionesDiscursosComponent.SIN_BOSQUEJOS;
  }

  private normalizarTexto(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /**
   * El orador escrito a mano (no elegido de la lista): se guarda solo el
   * nombre, sin autocompletar nada. La única excepción es el teléfono: si era
   * el del orador registrado que había antes, ya no corresponde a nadie —los
   * botones de llamar y WhatsApp marcarían a otra persona— y se quita.
   */
  guardarOradorEscrito(entrante: DiscursoEntranteOut, valor: string | null): void {
    const nombre = (valor ?? '').trim() || null;
    if (entrante.nombre_orador === nombre) return;
    const payload: EditarEntranteRequest = { nombre_orador: nombre };
    const anterior = this.discursanteDeLaFila(entrante.nombre_orador, entrante.congregacion_origen);
    if (anterior?.telefono && entrante.telefono_orador === anterior.telefono) {
      payload.telefono_orador = null;
    }
    this.svc.editarEntrante(entrante.id_discurso_entrante, payload, this.idCong).subscribe({
      next: (updated) => this.updateEntrante(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  /**
   * Si dos textos de discurso son el mismo bosquejo: por número cuando los
   * dos lo llevan ("120" y "120. Razones…"), y si no, por el texto sin
   * tildes ni mayúsculas.
   */
  private mismoBosquejo(a: string, b: string): boolean {
    const num = (t: string) => /^\s*(\d{1,3})(?:\s*[.\-–]|\s*$)/.exec(t)?.[1];
    const na = num(a), nb = num(b);
    if (na && nb) return na === nb;
    return this.normalizarTexto(a.trim()) === this.normalizarTexto(b.trim());
  }

  /** "120. Razones…" → "Nº 120"; sin número, el título recortado. */
  private etiquetaBosquejo(b: string): string {
    const m = /^\s*(\d{1,3})\s*[.\-–]/.exec(b);
    return m ? `Nº ${m[1]}` : (b.length > 30 ? b.slice(0, 30) + '…' : b);
  }

  /**
   * Corrección hecha en una fila al elegir de una lista, con lo necesario
   * para deshacerla de un clic. Una por fila: la última manda.
   */
  avisosFila = signal<Record<number, { mensaje: string; detalle: string; accion: string; deshacer: EditarEntranteRequest }>>({});
  /** Discursos que el usuario decidió mantener aunque no sean del orador (no se vuelve a avisar). */
  private discursosMantenidos = new Map<number, string>();

  descartarAvisoFila(id: number): void {
    this.avisosFila.update(m => {
      if (!(id in m)) return m;
      const { [id]: _, ...resto } = m;
      return resto;
    });
  }

  /** Deshace la corrección: devuelve la fila a lo que había antes de elegir. */
  deshacerAvisoFila(entrante: DiscursoEntranteOut): void {
    const aviso = this.avisosFila()[entrante.id_discurso_entrante];
    if (!aviso) return;
    const titulo = aviso.deshacer.titulo_discurso;
    // Lo devuelto a mano no se vuelve a señalar como "no es suyo".
    if (titulo) this.discursosMantenidos.set(entrante.id_discurso_entrante, titulo);
    this.descartarAvisoFila(entrante.id_discurso_entrante);
    this.svc.editarEntrante(entrante.id_discurso_entrante, aviso.deshacer, this.idCong).subscribe({
      next: (updated) => {
        this.updateEntrante(updated);
        if ('titulo_discurso' in aviso.deshacer) this.verificarRepetido(updated);
      },
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  /**
   * Al elegir una congregación de la lista: si el orador que había es un
   * discursante registrado de OTRA congregación, deja de cuadrar con la fila,
   * así que se quita junto con su teléfono y con el bosquejo suyo que hubiera
   * puesto. Un orador escrito a mano no se toca: no hay nada que validar.
   */
  elegirCongregacionOrigen(entrante: DiscursoEntranteOut, c: CongregacionContacto): void {
    const payload: EditarEntranteRequest = { congregacion_origen: c.nombre };
    const anterior = this.discursanteDeLaFila(entrante.nombre_orador, entrante.congregacion_origen);
    const esDeLaNueva = !!anterior && c.discursantes.some(d => this.normalizarTexto(d.nombre) === this.normalizarTexto(anterior.nombre));

    let aviso: { mensaje: string; detalle: string; accion: string; deshacer: EditarEntranteRequest } | null = null;
    if (anterior && !esDeLaNueva) {
      const titulo = (entrante.titulo_discurso ?? '').trim();
      const eraSuyo = !!titulo && anterior.bosquejos.some(b => this.mismoBosquejo(b, titulo));
      payload.nombre_orador = null;
      payload.telefono_orador = null;
      if (eraSuyo) payload.titulo_discurso = null;
      aviso = {
        mensaje: `${anterior.nombre} no es discursante de ${c.nombre}`,
        detalle: eraSuyo ? 'Se quitaron el orador y su discurso.' : 'Se quitó el orador.',
        accion: 'Mantener el orador',
        deshacer: {
          nombre_orador: entrante.nombre_orador,
          telefono_orador: entrante.telefono_orador,
          ...(eraSuyo ? { titulo_discurso: entrante.titulo_discurso } : {}),
        },
      };
    }

    this.svc.editarEntrante(entrante.id_discurso_entrante, payload, this.idCong).subscribe({
      next: (updated) => {
        this.updateEntrante(updated);
        if ('titulo_discurso' in payload) this.verificarRepetido(updated);
        if (aviso) this.avisosFila.update(m => ({ ...m, [entrante.id_discurso_entrante]: aviso! }));
        else this.descartarAvisoFila(entrante.id_discurso_entrante);
      },
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  /**
   * Aviso informativo: el discurso de la fila no está entre los bosquejos del
   * orador registrado. Nada si el orador no está registrado o no tiene
   * bosquejos (no hay contra qué comparar), o si ya se decidió mantenerlo.
   */
  discursoFueraDeBosquejos(entrante: DiscursoEntranteOut): { orador: string; etiquetas: string } | null {
    const titulo = (entrante.titulo_discurso ?? '').trim();
    if (!titulo) return null;
    const d = this.discursanteDeLaFila(entrante.nombre_orador, entrante.congregacion_origen);
    if (!d || d.bosquejos.length === 0) return null;
    if (d.bosquejos.some(b => this.mismoBosquejo(b, titulo))) return null;
    const mantenido = this.discursosMantenidos.get(entrante.id_discurso_entrante);
    if (mantenido && this.mismoBosquejo(mantenido, titulo)) return null;
    return { orador: d.nombre, etiquetas: d.bosquejos.map(b => this.etiquetaBosquejo(b)).join(', ') };
  }

  /**
   * Al elegir un discursante desde el campo "Orador": rellena de una vez
   * nombre, teléfono y congregación de origen, y valida el discurso contra
   * sus bosquejos. Elegir de la lista es decir "es esta persona", así que el
   * resto de la fila tiene que cuadrar con ella:
   *  - Si el discurso ya es uno de sus bosquejos, se deja.
   *  - Si no lo es (esté vacío, venga de otro orador o se haya escrito
   *    antes), pasa a su único bosquejo; con varios, se vacía y se abre su
   *    lista en el campo Discurso para elegir.
   *  - Si no tiene bosquejos registrados no hay contra qué validar: se deja.
   * Cuando se sustituye un discurso que ya había, se avisa en la fila con la
   * opción de mantenerlo (puede que esa vez dé uno distinto).
   */
  elegirOradorDelDirectorio(
    entrante: DiscursoEntranteOut,
    r: DiscursanteConCongregacion,
    campoDiscurso?: DiscursoCatalogoInputComponent,
  ): void {
    const payload: EditarEntranteRequest = {
      nombre_orador: r.discursante.nombre,
      telefono_orador: r.discursante.telefono,
      congregacion_origen: r.congregacion.nombre,
    };

    const actual = (entrante.titulo_discurso ?? '').trim();
    const nuevos = r.discursante.bosquejos;
    const cuadra = !!actual && nuevos.some(b => this.mismoBosquejo(b, actual));

    let elegirDespues = false;
    let aviso: { mensaje: string; detalle: string; accion: string; deshacer: EditarEntranteRequest } | null = null;
    if (nuevos.length > 0 && !cuadra) {
      const reemplazo = nuevos.length === 1 ? nuevos[0] : null;
      if (reemplazo !== null || actual) payload.titulo_discurso = reemplazo;
      elegirDespues = reemplazo === null;
      if (actual) {
        aviso = {
          mensaje: `«${actual}» no está entre los bosquejos de ${r.discursante.nombre}`,
          detalle: reemplazo
            ? `Se cambió por su bosquejo «${reemplazo}».`
            : 'Se quitó: elige uno de sus bosquejos en Discurso / Tema.',
          accion: 'Mantener el anterior',
          deshacer: { titulo_discurso: actual },
        };
      }
    }

    this.discursosMantenidos.delete(entrante.id_discurso_entrante);
    this.svc.editarEntrante(entrante.id_discurso_entrante, payload, this.idCong).subscribe({
      next: (updated) => {
        this.updateEntrante(updated);
        if ('titulo_discurso' in payload) this.verificarRepetido(updated);
        if (aviso) this.avisosFila.update(m => ({ ...m, [entrante.id_discurso_entrante]: aviso! }));
        else this.descartarAvisoFila(entrante.id_discurso_entrante);
        // Con varios bosquejos no se elige por él: se abre su lista en el
        // campo Discurso, una vez que la fila ya muestra al nuevo orador.
        if (elegirDespues && campoDiscurso) {
          afterNextRender(() => campoDiscurso.enfocar(), { injector: this.injector });
        }
      },
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  // ── Aviso de discurso repetido ──────────────────────────────────────────────
  //
  // Al escribir el título de un entrante, avisa si ese mismo discurso (por
  // número de bosquejo o por texto) ya se dio en esta congregación en los
  // últimos meses. Es solo informativo: nunca bloquea el guardado, y si la
  // consulta falla se ignora en silencio para no molestar por algo accesorio.

  repeticiones = signal<Record<number, HistorialOcurrenciaEntrante[]>>({});

  private verificarRepetido(entrante: DiscursoEntranteOut): void {
    const id = entrante.id_discurso_entrante;
    if (!entrante.titulo_discurso?.trim()) {
      this.repeticiones.update(m => {
        if (!(id in m)) return m;
        const { [id]: _, ...resto } = m;
        return resto;
      });
      return;
    }
    this.svc.verificarRepeticion(entrante.titulo_discurso, entrante.fecha, id, this.idCong).subscribe({
      next: (res) => {
        this.repeticiones.update(m => {
          if (res.repeticiones.length === 0) {
            if (!(id in m)) return m;
            const { [id]: _, ...resto } = m;
            return resto;
          }
          return { ...m, [id]: res.repeticiones };
        });
      },
      error: () => {}, // aviso de cortesía: un fallo aquí no debe interrumpir nada
    });
  }

  onEntranteGrupoChange(entrante: DiscursoEntranteOut, event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const id = val ? +val : null;
    this.svc.editarEntrante(entrante.id_discurso_entrante, { id_grupo_hospitalidad: id }, this.idCong).subscribe({
      next: (updated) => this.updateEntrante(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  private updateEntrante(updated: DiscursoEntranteOut): void {
    const d = this.mesDatos();
    if (!d) return;
    this.mesDatos.set({
      ...d,
      entrantes: d.entrantes.map(e => e.id_discurso_entrante === updated.id_discurso_entrante ? updated : e),
    });
  }

  onSalienteChange(saliente: DiscursoSalienteOut, campo: string, event: Event): void {
    this.guardarCampoSaliente(saliente, campo, (event.target as HTMLInputElement).value);
  }

  // ── Confirmación telefónica del orador entrante ────────────────────────────

  /** Ids con una petición en vuelo, para no permitir doble clic. */
  confirmandoOrador = signal<Set<number>>(new Set());

  /** Cuántos entrantes del mes tienen ya confirmado el orador. */
  entrantesConfirmados = computed(() =>
    (this.mesDatos()?.entrantes ?? []).filter(e => e.orador_confirmado).length
  );

  /** Fechas del mes que todavía no tienen a nadie asignado. */
  entrantesSinOrador = computed(() =>
    (this.mesDatos()?.entrantes ?? []).filter(e => !e.nombre_orador?.trim()).length
  );

  // ── Estado de cada fecha, para poder leer el mes de un vistazo ─────────────
  //
  // Doce sábados pintados todos igual no dicen dónde queda trabajo por hacer:
  // hay que abrir cada tarjeta y mirar si el campo Orador está vacío. Con el
  // estado en la cabecera, recorrer la columna de fechas basta para saberlo.
  //
  // Los cuatro estados son excluyentes y van en orden de avance: sin nadie
  // asignado → asignado pero sin llamar → llamada hecha → ya se dio.
  //
  // Ojo con el orden: "sin orador" pesa MÁS que "confirmado". Los dos campos
  // son independientes en la base de datos y se ven fechas con la confirmación
  // puesta y el nombre vacío, que es imposible —no se confirma una llamada a
  // nadie— y casi siempre significa que alguien pulsó el botón antes de
  // apuntar el nombre. Dando prioridad a "confirmado" la fecha se pintaría de
  // verde y el hueco pasaría inadvertido justo hasta el sábado.

  estadoEntrante(e: DiscursoEntranteOut): 'pendiente' | 'asignado' | 'confirmado' | 'presentado' {
    if (e.presentado) return 'presentado';
    if (!e.nombre_orador?.trim()) return 'pendiente';
    return e.orador_confirmado ? 'confirmado' : 'asignado';
  }

  /**
   * Fondo de la cabecera de fecha según su estado.
   *
   * Tintes muy bajos (de 40 a 60 de saturación en claro, /20 en oscuro): la
   * cabecera tiene que distinguirse al recorrer la lista, no competir con el
   * contenido de la tarjeta. El color reutiliza el significado que ya tiene en
   * el resto del módulo —ámbar avisa, esmeralda confirma, violeta es Reuniones—
   * en vez de estrenar una paleta propia.
   */
  cabeceraEntranteClass(e: DiscursoEntranteOut): string {
    switch (this.estadoEntrante(e)) {
      case 'pendiente':
        return 'bg-amber-50/80 dark:bg-amber-950/25 border-amber-100 dark:border-amber-900/40';
      case 'confirmado':
        return 'bg-emerald-50/80 dark:bg-emerald-950/25 border-emerald-100 dark:border-emerald-900/40';
      case 'presentado':
        return 'bg-violet-50/70 dark:bg-violet-950/20 border-violet-100 dark:border-violet-900/40';
      default:
        return 'bg-slate-50 dark:bg-slate-800/80 border-slate-100 dark:border-slate-800';
    }
  }

  /** Color del icono de calendario, del mismo estado que la cabecera. */
  iconoEntranteClass(e: DiscursoEntranteOut): string {
    switch (this.estadoEntrante(e)) {
      case 'pendiente':   return 'text-amber-500';
      case 'confirmado':  return 'text-emerald-500';
      case 'presentado':  return 'text-violet-400 dark:text-violet-500';
      default:            return 'text-violet-500';
    }
  }

  toggleOradorConfirmado(entrante: DiscursoEntranteOut): void {
    const id = entrante.id_discurso_entrante;
    if (this.confirmandoOrador().has(id)) return;

    this.confirmandoOrador.update(s => new Set(s).add(id));
    const nuevoValor = !entrante.orador_confirmado;

    this.svc.confirmarOrador(id, nuevoValor, this.idCong).subscribe({
      next: (updated) => {
        this.updateEntrante(updated);
        this.confirmandoOrador.update(s => { const n = new Set(s); n.delete(id); return n; });
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'No se pudo guardar la confirmación');
        this.confirmandoOrador.update(s => { const n = new Set(s); n.delete(id); return n; });
      },
    });
  }

  /** Texto del tooltip: quién confirmó y cuándo, o qué significa marcarlo. */
  tituloConfirmacion(entrante: DiscursoEntranteOut): string {
    if (!entrante.orador_confirmado) {
      return 'Marcar cuando hayas llamado a la congregación de origen y te confirmen que el orador viene';
    }
    const partes: string[] = ['Orador confirmado'];
    if (entrante.orador_confirmado_por) partes.push(`por ${entrante.orador_confirmado_por}`);
    if (entrante.orador_confirmado_en) {
      const f = new Date(entrante.orador_confirmado_en);
      partes.push(`el ${f.toLocaleDateString('es')} a las ${f.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`);
    }
    return partes.join(' ') + '. Pulsa para quitar la confirmación.';
  }

  // ── Discurso presentado ────────────────────────────────────────────────────

  /** Ids con una petición en vuelo, para no permitir doble clic. */
  marcandoPresentado = signal<Set<number>>(new Set());

  /** Cuántos discursos del mes ya se dieron. */
  entrantesPresentados = computed(() =>
    (this.mesDatos()?.entrantes ?? []).filter(e => e.presentado).length
  );

  /**
   * Cuántos entrantes del mes tienen un aviso de repetición activo. Filtra por
   * los ids del mes actual (no cuenta el mapa entero) porque `repeticiones()`
   * puede conservar entradas de meses vistos antes en la misma sesión.
   */
  entrantesRepetidos = computed(() =>
    (this.mesDatos()?.entrantes ?? []).filter(e => (this.repeticiones()[e.id_discurso_entrante] ?? []).length > 0).length
  );

  togglePresentado(entrante: DiscursoEntranteOut): void {
    const id = entrante.id_discurso_entrante;
    if (this.marcandoPresentado().has(id)) return;

    this.marcandoPresentado.update(s => new Set(s).add(id));
    const quitar = (n: Set<number>) => { const c = new Set(n); c.delete(id); return c; };

    this.svc.marcarPresentado(id, !entrante.presentado, this.idCong).subscribe({
      next: (updated) => {
        this.updateEntrante(updated);
        this.marcandoPresentado.update(quitar);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'No se pudo guardar la marca de presentado');
        this.marcandoPresentado.update(quitar);
      },
    });
  }

  /** Tooltip: si lo marcó el sistema o una persona, y cuándo. */
  tituloPresentado(entrante: DiscursoEntranteOut): string {
    if (!entrante.presentado) {
      return 'El sistema lo marcará solo al pasar la hora de la reunión. Púlsalo para marcarlo ya.';
    }
    const cuando = entrante.presentado_en
      ? (() => {
          const f = new Date(entrante.presentado_en!);
          return ` el ${f.toLocaleDateString('es')} a las ${f.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
        })()
      : '';
    const quien = entrante.presentado_por
      ? `Marcado por ${entrante.presentado_por}`
      : 'Marcado automáticamente al pasar la hora de la reunión';
    return `${quien}${cuando}. Pulsa si el discurso no llegó a darse.`;
  }

  /** Igual que `guardarCampoEntrante`, para el saliente. */
  guardarCampoSaliente(saliente: DiscursoSalienteOut, campo: string, valor: string | null): void {
    const val = (valor ?? '').trim() || null;
    if ((saliente as any)[campo] === val) return;
    this.svc.editarSaliente(saliente.id_discurso_saliente, { [campo]: val }, this.idCong).subscribe({
      next: (updated) => this.updateSaliente(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  onSalientePublicadorChange(saliente: DiscursoSalienteOut, event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    const id = val ? +val : null;
    const idCong = this.idCong;

    const doEditar = () => {
      this.svc.editarSaliente(saliente.id_discurso_saliente, { id_publicador: id }, this.idCong).subscribe({
        next: (updated) => this.updateSaliente(updated),
        error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
      });
    };

    if (!id || !idCong) {
      doEditar();
      return;
    }

    const pub = this.publicadores().find(p => p.id_publicador === id);
    const nombre = pub?.nombre_completo ?? 'Este publicador';

    this.conflictosSvc
      .confirmarSiHayConflicto(
        id, saliente.fecha, idCong, nombre,
        { tipo: 'discurso_saliente', id: saliente.id_discurso_saliente },
      )
      .subscribe((proceder) => { if (proceder) doEditar(); });
  }

  private updateSaliente(updated: DiscursoSalienteOut): void {
    const d = this.mesDatos();
    if (!d) return;
    this.mesDatos.set({
      ...d,
      salientes: d.salientes.map(s => s.id_discurso_saliente === updated.id_discurso_saliente ? updated : s),
    });
  }

  eliminarSaliente(saliente: DiscursoSalienteOut): void {
    const pubNombre = saliente.publicador?.nombre_completo ?? 'este saliente';
    this.confirmPendiente.set({
      titulo: 'Eliminar saliente',
      mensaje: `Se eliminará a ${pubNombre} del ${this.formatFecha(saliente.fecha)}. Esta acción no se puede deshacer.`,
      accionLabel: 'Eliminar',
      callback: () => {
        this.svc.eliminarSaliente(saliente.id_discurso_saliente, this.idCong).subscribe({
          next: () => {
            const d = this.mesDatos();
            if (!d) return;
            this.mesDatos.set({
              ...d,
              salientes: d.salientes.filter(s => s.id_discurso_saliente !== saliente.id_discurso_saliente),
            });
          },
          error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al eliminar'),
        });
      },
    });
  }

  // ── Estado de la salida: Programado / Realizada / Cancelado ───────────────

  /** Ids con una petición en vuelo, para no permitir doble clic. */
  marcandoPresentadoSaliente = signal<Set<number>>(new Set());
  cancelandoSaliente = signal<Set<number>>(new Set());

  salientesProgramados = computed(() =>
    (this.mesDatos()?.salientes ?? []).filter(s => s.estado === 'programado').length
  );
  salientesRealizados = computed(() =>
    (this.mesDatos()?.salientes ?? []).filter(s => s.estado === 'realizada').length
  );
  salientesCancelados = computed(() =>
    (this.mesDatos()?.salientes ?? []).filter(s => s.estado === 'cancelado').length
  );

  /** Alterna Programado↔Realizada a mano. El planificador la marca solo al pasar fecha+hora. */
  togglePresentadoSaliente(saliente: DiscursoSalienteOut): void {
    const id = saliente.id_discurso_saliente;
    if (this.marcandoPresentadoSaliente().has(id)) return;

    this.marcandoPresentadoSaliente.update(s => new Set(s).add(id));
    const quitar = (n: Set<number>) => { const c = new Set(n); c.delete(id); return c; };

    this.svc.marcarPresentadoSaliente(id, saliente.estado !== 'realizada', this.idCong).subscribe({
      next: (updated) => {
        this.updateSaliente(updated);
        this.marcandoPresentadoSaliente.update(quitar);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'No se pudo guardar el estado');
        this.marcandoPresentadoSaliente.update(quitar);
      },
    });
  }

  /** Cancela una salida antes de la fecha; el orador queda libre para otra. */
  cancelarSaliente(saliente: DiscursoSalienteOut): void {
    const pubNombre = saliente.publicador?.nombre_completo ?? 'este saliente';
    this.confirmPendiente.set({
      titulo: 'Cancelar salida',
      mensaje: `Se marcará como cancelada la salida de ${pubNombre} del ${this.formatFecha(saliente.fecha)}. Podrás reactivarla o volver a programar a la misma persona en otra fecha.`,
      accionLabel: 'Cancelar salida',
      callback: () => this.marcarCanceladoSaliente(saliente, true),
    });
  }

  /** Deshace la cancelación: la salida vuelve a Programado. */
  reactivarSaliente(saliente: DiscursoSalienteOut): void {
    this.marcarCanceladoSaliente(saliente, false);
  }

  private marcarCanceladoSaliente(saliente: DiscursoSalienteOut, cancelado: boolean): void {
    const id = saliente.id_discurso_saliente;
    if (this.cancelandoSaliente().has(id)) return;

    this.cancelandoSaliente.update(s => new Set(s).add(id));
    const quitar = (n: Set<number>) => { const c = new Set(n); c.delete(id); return c; };

    this.svc.marcarCanceladoSaliente(id, cancelado, this.idCong).subscribe({
      next: (updated) => {
        this.updateSaliente(updated);
        this.cancelandoSaliente.update(quitar);
      },
      error: (e) => {
        this.errorMsg.set(e?.error?.detail ?? 'No se pudo guardar la cancelación');
        this.cancelandoSaliente.update(quitar);
      },
    });
  }

  /** Tooltip del chip de estado: quién lo marcó y cuándo. */
  tituloEstadoSaliente(saliente: DiscursoSalienteOut): string {
    if (saliente.estado === 'cancelado') {
      const cuando = saliente.cancelado_en
        ? (() => {
            const f = new Date(saliente.cancelado_en!);
            return ` el ${f.toLocaleDateString('es')} a las ${f.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
          })()
        : '';
      const quien = saliente.cancelado_por ? `Cancelado por ${saliente.cancelado_por}` : 'Cancelado';
      return `${quien}${cuando}. Pulsa para reactivar.`;
    }
    if (saliente.estado === 'realizada') {
      const cuando = saliente.presentado_en
        ? (() => {
            const f = new Date(saliente.presentado_en!);
            return ` el ${f.toLocaleDateString('es')} a las ${f.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
          })()
        : '';
      const quien = saliente.presentado_por
        ? `Marcado por ${saliente.presentado_por}`
        : 'Marcado automáticamente al pasar la fecha de la reunión';
      return `${quien}${cuando}. Pulsa si el discurso no llegó a darse.`;
    }
    return 'El sistema lo marcará solo al pasar la fecha de la reunión. Púlsalo para marcarlo ya.';
  }

  abrirModalSaliente(): void {
    this.nuevoSaliente = { fecha: '', id_publicador: null, congregacion_destino: '', tema_discurso: '', hora: '', ubicacion: null, notas: '' };
    this.ubicacionAutorellenada.set(false);
    this.busquedaPublicador.set('');
    this.resultadosBusqueda.set(this.publicadores());
    this.mostrarDropdownBusqueda.set(false);
    this.buscarEnCatalogo.set(false);
    this.modalSalienteVisible.set(true);
  }

  onBusquedaPublicadorInput(valor: string): void {
    this.busquedaPublicador.set(valor);
    this.mostrarDropdownBusqueda.set(true);
    this.busqueda$.next(valor);
  }

  seleccionarPublicadorBusqueda(p: PublicadorSimple): void {
    this.nuevoSaliente.id_publicador = p.id_publicador;
    this.nuevoSaliente.tema_discurso = '';
    this.busquedaPublicador.set(p.nombre_completo);
    this.mostrarDropdownBusqueda.set(false);
    this.mostrarDropdownTemas.set(false);
    this.buscarEnCatalogo.set(false);
  }

  /**
   * En el modal de Temas el número y el título se guardan por separado, así que
   * al elegir del catálogo se rellenan los dos campos de una vez.
   */
  onTemaDelCatalogo(d: CatalogoDiscurso): void {
    this.nuevoTema.numero_tema = String(d.numero);
    this.nuevoTema.titulo = d.titulo;
  }

  publicadorSeleccionadoNombre(): string {
    if (!this.nuevoSaliente.id_publicador) return '';
    const p = [...this.publicadores(), ...this.resultadosBusqueda()].find(x => x.id_publicador === this.nuevoSaliente.id_publicador);
    return p?.nombre_completo ?? '';
  }

  cerrarModalSaliente(): void {
    this.modalSalienteVisible.set(false);
  }

  // ── Notificación por WhatsApp al orador ────────────────────────────────────

  readonly whatsappPendiente = signal<{
    nombre: string; telefono: string | null; mensaje: string;
  } | null>(null);

  abrirWhatsapp(saliente: DiscursoSalienteOut): void {
    const nombre = saliente.publicador?.nombre_completo ?? 'Publicador';
    this.whatsappPendiente.set({
      nombre,
      telefono: this.normalizarTelefono(saliente.publicador?.telefono),
      mensaje: this.mensajeWhatsapp(saliente),
    });
  }

  cerrarWhatsapp(): void {
    this.whatsappPendiente.set(null);
  }

  onMensajeWhatsappChange(texto: string): void {
    const actual = this.whatsappPendiente();
    if (actual) this.whatsappPendiente.set({ ...actual, mensaje: texto });
  }

  /** Abre WhatsApp con el mensaje; sin teléfono deja elegir el contacto. */
  enviarWhatsapp(): void {
    const w = this.whatsappPendiente();
    if (!w) return;
    window.open(whatsappUrl(w.mensaje, w.telefono), '_blank');
    this.cerrarWhatsapp();
  }

  private mensajeWhatsapp(s: DiscursoSalienteOut): string {
    const primerNombre = (s.publicador?.nombre_completo ?? '').split(' ')[0] || 'hermano';
    const lineas = [
      `Hola ${primerNombre},`,
      '',
      'Has sido programado para dar un discurso público:',
      '',
      `◆ *Fecha:* ${this.fechaLarga(s.fecha)}`,
    ];
    if (s.hora) lineas.push(`◆ *Hora:* ${this.formatHora(s.hora)}`);
    if (s.congregacion_destino) lineas.push(`◆ *Congregación:* ${s.congregacion_destino}`);
    if (s.tema_discurso) lineas.push(`◆ *Discurso:* ${s.tema_discurso}`);
    if (s.direccion_destino) lineas.push(`◆ *Lugar:* ${s.direccion_destino}`);
    if (s.url_mapa) lineas.push(`◆ *Cómo llegar:* ${s.url_mapa}`);
    if (s.notas) lineas.push(`◆ *Notas:* ${s.notas}`);
    lineas.push('', 'Por favor confirma que puedes atender esta asignación. ¡Gracias!');
    return lineas.join('\n');
  }

  private fechaLarga(fechaStr: string): string {
    const d = new Date(fechaStr + 'T00:00:00');
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
  }

  /** "14:30" → "2:30 p. m." */
  private formatHora(hora: string): string {
    const [h, m] = hora.split(':').map(Number);
    if (isNaN(h)) return hora;
    const sufijo = h < 12 ? 'a. m.' : 'p. m.';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m ?? 0).padStart(2, '0')} ${sufijo}`;
  }

  /** Deja sólo dígitos y antepone el indicativo de Colombia a los móviles. */
  private normalizarTelefono(telefono?: string | null): string | null {
    if (!telefono) return null;
    const limpio = telefono.replace(/\D/g, '');
    if (!limpio) return null;
    return !limpio.startsWith('57') && limpio.length === 10 ? `57${limpio}` : limpio;
  }

  onUbicacionModalChange(ubic: UbicacionSaliente | null): void {
    this.nuevoSaliente.ubicacion = ubic;
    this.ubicacionAutorellenada.set(false);
  }

  /**
   * Al salir de "Congregación Destino" sin haber elegido del directorio,
   * recupera hora y ubicación de la última vez que se fue a esa congregación
   * (fallback histórico; el directorio de contacto, si la tiene guardada, ya
   * autocompletó al elegirla — ver `onNuevoSalienteCongregacionSeleccionada`).
   */
  autorellenarUbicacion(): void {
    const nombre = this.nuevoSaliente.congregacion_destino?.trim();
    if (!nombre || !this.idCong) return;
    if (this.nuevoSaliente.ubicacion && this.nuevoSaliente.hora) return;
    this.svc.ubicacionSugerida(nombre, this.idCong).subscribe({
      next: (u) => {
        if (!this.nuevoSaliente.ubicacion && u?.url_mapa) {
          this.nuevoSaliente.ubicacion = {
            direccion_destino: u.direccion_destino ?? null,
            url_mapa: u.url_mapa,
            lat: u.lat ?? null,
            lon: u.lon ?? null,
          };
          this.ubicacionAutorellenada.set(true);
        }
        if (!this.nuevoSaliente.hora && u?.hora) {
          this.nuevoSaliente.hora = u.hora;
        }
      },
      error: () => {},
    });
  }

  /** Al elegir una congregación del directorio en el modal "Añadir saliente": autocompleta hora y ubicación sin pisar lo ya escrito. */
  onNuevoSalienteCongregacionSeleccionada(c: CongregacionContacto): void {
    if (!this.nuevoSaliente.hora && c.hora_reunion_fin_semana) {
      this.nuevoSaliente.hora = c.hora_reunion_fin_semana;
    }
    if (!this.nuevoSaliente.ubicacion && c.url_mapa) {
      this.nuevoSaliente.ubicacion = { direccion_destino: c.direccion, url_mapa: c.url_mapa, lat: c.lat, lon: c.lon };
      this.ubicacionAutorellenada.set(true);
    }
  }

  /** Igual que la anterior, pero al elegir en la tarjeta inline de un saliente ya creado. */
  onSalienteCongregacionSeleccionada(saliente: DiscursoSalienteOut, c: CongregacionContacto): void {
    if (!this.idCong) return;
    const payload: { congregacion_destino: string; hora?: string; direccion_destino?: string | null; url_mapa?: string; lat?: number | null; lon?: number | null } = {
      congregacion_destino: c.nombre,
    };
    if (!saliente.hora && c.hora_reunion_fin_semana) payload.hora = c.hora_reunion_fin_semana;
    if (!saliente.url_mapa && c.url_mapa) {
      payload.direccion_destino = c.direccion;
      payload.url_mapa = c.url_mapa;
      payload.lat = c.lat;
      payload.lon = c.lon;
    }
    this.svc.editarSaliente(saliente.id_discurso_saliente, payload, this.idCong).subscribe({
      next: (updated) => this.updateSaliente(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
    });
  }

  /**
   * Objeto de ubicación memoizado por saliente: devolver una referencia nueva
   * en cada ciclo de detección haría que ngModel reescribiera el picker sin
   * parar (bucle infinito).
   */
  private ubicacionCache = new Map<number, UbicacionSaliente | null>();

  ubicacionDe(saliente: DiscursoSalienteOut): UbicacionSaliente | null {
    const cacheado = this.ubicacionCache.get(saliente.id_discurso_saliente);
    if (cacheado !== undefined
      && (cacheado?.url_mapa ?? null) === (saliente.url_mapa ?? null)
      && (cacheado?.direccion_destino ?? null) === (saliente.direccion_destino ?? null)) {
      return cacheado;
    }
    const ubic: UbicacionSaliente | null = (saliente.url_mapa || saliente.direccion_destino)
      ? {
          direccion_destino: saliente.direccion_destino,
          url_mapa: saliente.url_mapa,
          lat: saliente.lat,
          lon: saliente.lon,
        }
      : null;
    this.ubicacionCache.set(saliente.id_discurso_saliente, ubic);
    return ubic;
  }

  onSalienteHoraChange(saliente: DiscursoSalienteOut, hora: string | null): void {
    const nueva = hora || null;
    if ((saliente.hora ?? null) === nueva) return;
    this.svc.editarSaliente(saliente.id_discurso_saliente, { hora: nueva }, this.idCong).subscribe({
      next: (updated) => this.updateSaliente(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar la hora'),
    });
  }

  onSalienteUbicacionChange(saliente: DiscursoSalienteOut, ubic: UbicacionSaliente | null): void {
    if ((saliente.url_mapa ?? null) === (ubic?.url_mapa ?? null)
      && (saliente.direccion_destino ?? null) === (ubic?.direccion_destino ?? null)) return;
    this.svc.editarSaliente(saliente.id_discurso_saliente, {
      direccion_destino: ubic?.direccion_destino ?? null,
      url_mapa: ubic?.url_mapa ?? null,
      lat: ubic?.lat ?? null,
      lon: ubic?.lon ?? null,
    }, this.idCong).subscribe({
      next: (updated) => this.updateSaliente(updated),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar la ubicación'),
    });
  }

  loadTemas(): void {
    if (this.temasLoaded() || !this.idCong) return;
    this.loadingTemas.set(true);
    this.svc.getTemas(this.idCong).subscribe({
      next: (t) => { this.temas.set(t); this.temasLoaded.set(true); this.loadingTemas.set(false); },
      error: () => this.loadingTemas.set(false),
    });
  }

  // ── Directorio de congregaciones de contacto ──────────────────────────────

  loadCongregacionesContacto(): void {
    if (this.congregacionesContactoLoaded() || !this.idCong) return;
    this.loadingCongregacionesContacto.set(true);
    this.svc.getCongregacionesContacto(this.idCong).subscribe({
      next: (r) => {
        this.congregacionesContacto.set(r);
        this.congregacionesContactoLoaded.set(true);
        this.loadingCongregacionesContacto.set(false);
        this.cargarArchivosDeCongregaciones(r);
      },
      error: () => this.loadingCongregacionesContacto.set(false),
    });
  }

  /**
   * Trae de una vez los adjuntos de cada congregación del directorio, para que
   * la tarjeta los muestre directamente: sin esto, "ver los archivos" exigía
   * abrir "Editar" en cada una.
   */
  private cargarArchivosDeCongregaciones(rows: CongregacionContacto[]): void {
    const idCong = this.idCong;
    if (!rows.length || !idCong) return;
    forkJoin(
      rows.map((r) =>
        this.svc.listarArchivosCongregacionContacto(r.id_congregacion_contacto, idCong).pipe(
          map((a) => [r.id_congregacion_contacto, a] as const),
          catchError(() => of([r.id_congregacion_contacto, [] as ArchivoCongregacionContacto[]] as const)),
        ),
      ),
    ).subscribe((pares) => {
      const mapa: Record<number, ArchivoCongregacionContacto[]> = {};
      for (const [id, a] of pares) mapa[id] = a;
      this.archivosPorCongregacion.set(mapa);
    });
  }

  private refrescarArchivosCongregacion(id: number): void {
    this.svc.listarArchivosCongregacionContacto(id, this.idCong).subscribe({
      next: (a) => this.archivosPorCongregacion.update((m) => ({ ...m, [id]: a })),
      error: () => {},
    });
  }

  archivosDeCongregacion(c: CongregacionContacto): ArchivoCongregacionContacto[] {
    return this.archivosPorCongregacion()[c.id_congregacion_contacto] ?? [];
  }

  readonly diaLabelMap: Record<string, string> = { Sabado: 'Sábado', Domingo: 'Domingo' };
  readonly diasFinSemanaOpciones = ['Sabado', 'Domingo'];
  diaLabel(dia: string | null): string {
    return dia ? (this.diaLabelMap[dia] ?? dia) : '';
  }

  seleccionarDiaCongregacionContacto(dia: string | null): void {
    this.nuevaCongregacionContacto.dia_reunion_fin_semana = dia;
  }

  /** Estilo común de los campos del modal de congregación de contacto (el alto y el tamaño de letra los pone cada campo). */
  readonly campoModal = 'min-w-0 w-full px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-[border-color,box-shadow] duration-150 ease-out';

  /** Sugerencias para el cargo de un contacto; se puede escribir cualquier otro. */
  readonly cargosContactoSugeridos = ['Coordinador del cuerpo de ancianos', 'Secretario', 'Coordinador de discursos', 'Superintendente de servicio'];

  private ubicacionContactoCache = new Map<number, UbicacionSaliente | null>();
  ubicacionDeContacto(c: CongregacionContacto): UbicacionSaliente | null {
    const cacheado = this.ubicacionContactoCache.get(c.id_congregacion_contacto);
    if (cacheado !== undefined && cacheado?.url_mapa === c.url_mapa && cacheado?.direccion_destino === c.direccion) return cacheado;
    const u: UbicacionSaliente | null = (c.url_mapa || c.direccion)
      ? { direccion_destino: c.direccion, url_mapa: c.url_mapa, lat: c.lat, lon: c.lon }
      : null;
    this.ubicacionContactoCache.set(c.id_congregacion_contacto, u);
    return u;
  }

  abrirModalCongregacionContacto(c?: CongregacionContacto): void {
    this.archivosNuevosCongregacionContacto.set([]);
    if (c) {
      this.editandoCongregacionContacto.set(c);
      this.nuevaCongregacionContacto = {
        nombre: c.nombre, dia_reunion_fin_semana: c.dia_reunion_fin_semana,
        hora_reunion_fin_semana: c.hora_reunion_fin_semana, notas: c.notas,
        ubicacion: c.url_mapa ? { direccion_destino: c.direccion, url_mapa: c.url_mapa, lat: c.lat, lon: c.lon } : null,
        personas: c.personas.map(p => ({ id_contacto_persona: p.id_contacto_persona, nombre: p.nombre, cargo: p.cargo, telefono: p.telefono })),
        discursantes: c.discursantes.map(d => ({ id_discursante: d.id_discursante, nombre: d.nombre, telefono: d.telefono, bosquejos: [...d.bosquejos] })),
      };
      this.archivosCongregacionContacto.set([]);
      this.svc.listarArchivosCongregacionContacto(c.id_congregacion_contacto, this.idCong).subscribe({
        next: (a) => this.archivosCongregacionContacto.set(a),
        error: () => this.archivosCongregacionContacto.set([]),
      });
    } else {
      this.editandoCongregacionContacto.set(null);
      this.nuevaCongregacionContacto = { nombre: '', dia_reunion_fin_semana: null, hora_reunion_fin_semana: null, notas: null, ubicacion: null, personas: [], discursantes: [] };
      this.archivosCongregacionContacto.set([]);
    }
    this.modalCongregacionContactoVisible.set(true);
  }

  cerrarModalCongregacionContacto(): void {
    this.modalCongregacionContactoVisible.set(false);
    this.editandoCongregacionContacto.set(null);
    this.archivosCongregacionContacto.set([]);
    this.archivosNuevosCongregacionContacto.set([]);
  }

  formatoTamanoArchivo(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  onArchivosCongregacionContactoSeleccionados(input: HTMLInputElement): void {
    const files = Array.from(input.files ?? []);
    if (files.length) this.archivosNuevosCongregacionContacto.update(f => [...f, ...files]);
    input.value = '';
  }

  quitarArchivoNuevoCongregacionContacto(i: number): void {
    this.archivosNuevosCongregacionContacto.update(f => f.filter((_, idx) => idx !== i));
  }

  /** Borra de una un archivo ya subido: no vale la pena una confirmación aparte, igual que "quitar persona". */
  eliminarArchivoCongregacionContactoModal(nombre: string): void {
    const actual = this.editandoCongregacionContacto();
    if (!actual) return;
    this.svc.eliminarArchivoCongregacionContacto(actual.id_congregacion_contacto, nombre, this.idCong).subscribe({
      next: () => {
        this.archivosCongregacionContacto.update(a => a.filter(x => x.nombre !== nombre));
        this.archivosPorCongregacion.update(m => ({
          ...m,
          [actual.id_congregacion_contacto]: (m[actual.id_congregacion_contacto] ?? []).filter(x => x.nombre !== nombre),
        }));
      },
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al eliminar el archivo'),
    });
  }

  abrirArchivoCongregacionContacto(a: ArchivoCongregacionContacto): void {
    const actual = this.editandoCongregacionContacto();
    if (!actual) return;
    this.abrirArchivoBlob(actual.id_congregacion_contacto, a.nombre);
  }

  /** Igual que abrir un archivo desde el modal, pero llamado desde la tarjeta del directorio. */
  abrirArchivoDeCongregacion(c: CongregacionContacto, nombre: string): void {
    this.abrirArchivoBlob(c.id_congregacion_contacto, nombre);
  }

  private abrirArchivoBlob(idCongContacto: number, nombre: string): void {
    this.svc.descargarArchivoCongregacionContacto(idCongContacto, nombre, this.idCong).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al abrir el archivo'),
    });
  }

  anadirPersonaModal(): void {
    this.nuevaCongregacionContacto.personas = [...this.nuevaCongregacionContacto.personas, { nombre: '', cargo: null, telefono: null }];
    this.enfocarUltimaFila('data-fila-persona');
  }

  quitarPersonaModal(i: number): void {
    this.nuevaCongregacionContacto.personas = this.nuevaCongregacionContacto.personas.filter((_, idx) => idx !== i);
  }

  anadirDiscursanteModal(): void {
    this.nuevaCongregacionContacto.discursantes = [...this.nuevaCongregacionContacto.discursantes, { nombre: '', telefono: null, bosquejos: [] }];
    this.enfocarUltimaFila('data-fila-discursante');
  }

  /** Tras añadir una fila, el cursor salta a su nombre: añadir y escribir sin volver al ratón. */
  private readonly injector = inject(Injector);
  private enfocarUltimaFila(atributo: string): void {
    afterNextRender(() => {
      const campos = document.querySelectorAll<HTMLInputElement>(`[${atributo}]`);
      campos[campos.length - 1]?.focus();
    }, { injector: this.injector });
  }

  quitarDiscursanteModal(i: number): void {
    this.nuevaCongregacionContacto.discursantes = this.nuevaCongregacionContacto.discursantes.filter((_, idx) => idx !== i);
  }

  /**
   * Añade un bosquejo al discursante del modal y deja el campo vacío para el
   * siguiente. Un bosquejo repetido (sin distinguir tildes ni mayúsculas) se
   * ignora: el backend también lo descarta, pero así no parpadea en la lista.
   */
  anadirBosquejoModal(
    d: { bosquejos: string[] },
    texto: string | null,
    campo: DiscursoCatalogoInputComponent,
  ): void {
    const b = (texto ?? '').trim();
    campo.limpiar();
    if (!b) return;
    const nuevo = this.normalizarTexto(b);
    if (d.bosquejos.some(x => this.normalizarTexto(x) === nuevo)) return;
    d.bosquejos = [...d.bosquejos, b];
  }

  quitarBosquejoModal(d: { bosquejos: string[] }, j: number): void {
    d.bosquejos = d.bosquejos.filter((_, idx) => idx !== j);
  }

  guardarCongregacionContacto(): void {
    if (!this.nuevaCongregacionContacto.nombre.trim() || !this.idCong) return;
    const n = this.nuevaCongregacionContacto;
    const payload = {
      nombre: n.nombre.trim(),
      dia_reunion_fin_semana: n.dia_reunion_fin_semana || null,
      hora_reunion_fin_semana: n.hora_reunion_fin_semana || null,
      direccion: n.ubicacion?.direccion_destino ?? null,
      url_mapa: n.ubicacion?.url_mapa ?? null,
      lat: n.ubicacion?.lat ?? null,
      lon: n.ubicacion?.lon ?? null,
      notas: n.notas || null,
    };
    const actual = this.editandoCongregacionContacto();
    const guardarBase$ = actual
      ? this.svc.editarCongregacionContacto(actual.id_congregacion_contacto, payload, this.idCong)
      : this.svc.crearCongregacionContacto(payload, this.idCong);

    guardarBase$.subscribe({
      next: (base) => this.guardarPersonasDelModal(base, actual?.personas ?? [], actual?.discursantes ?? []),
      error: (e) => this.errorMsg.set(e?.error?.detail ?? (actual ? 'Error al guardar' : 'Error al crear')),
    });
  }

  /**
   * Reconcilia personas y discursantes del modal contra lo que tenía la
   * congregación antes de abrirlo: crea lo nuevo (sin id), edita lo que ya
   * existía y borra lo que se quitó de la lista. Al terminar, recarga el
   * directorio para reflejar los ids reales de lo recién creado.
   */
  private guardarPersonasDelModal(base: CongregacionContacto, originales: ContactoPersona[], originalesDiscursantes: Discursante[]): void {
    const idCong = this.idCong;
    if (!idCong) { this.cerrarModalCongregacionContacto(); return; }
    const idCongContacto = base.id_congregacion_contacto;
    const actuales = this.nuevaCongregacionContacto.personas;
    const idsConservados = new Set(actuales.filter(p => p.id_contacto_persona != null).map(p => p.id_contacto_persona));

    const peticiones: Observable<unknown>[] = [];
    for (const p of actuales) {
      if (!p.nombre.trim()) continue;
      const datos = { nombre: p.nombre.trim(), cargo: p.cargo || null, telefono: p.telefono || null };
      peticiones.push(
        p.id_contacto_persona != null
          ? this.svc.editarContactoPersona(idCongContacto, p.id_contacto_persona, datos, idCong)
          : this.svc.crearContactoPersona(idCongContacto, datos, idCong)
      );
    }
    for (const orig of originales) {
      if (!idsConservados.has(orig.id_contacto_persona)) {
        peticiones.push(this.svc.eliminarContactoPersona(idCongContacto, orig.id_contacto_persona, idCong));
      }
    }

    const discursantesActuales = this.nuevaCongregacionContacto.discursantes;
    const idsDiscursantesConservados = new Set(discursantesActuales.filter(d => d.id_discursante != null).map(d => d.id_discursante));
    for (const d of discursantesActuales) {
      if (!d.nombre.trim()) continue;
      const datos = { nombre: d.nombre.trim(), telefono: d.telefono || null, bosquejos: d.bosquejos };
      peticiones.push(
        d.id_discursante != null
          ? this.svc.editarDiscursante(idCongContacto, d.id_discursante, datos, idCong)
          : this.svc.crearDiscursante(idCongContacto, datos, idCong)
      );
    }
    for (const orig of originalesDiscursantes) {
      if (!idsDiscursantesConservados.has(orig.id_discursante)) {
        peticiones.push(this.svc.eliminarDiscursante(idCongContacto, orig.id_discursante, idCong));
      }
    }

    const finalizar = () => {
      this.svc.getCongregacionesContacto(idCong).subscribe({
        next: (lista) => this.congregacionesContacto.set(lista),
        error: () => {},
      });
      // El directorio que alimenta los autocompletados es otro y vive en el
      // servicio: sin invalidarlo, renombrar una congregación aquí la seguiría
      // ofreciendo con el nombre viejo en las tarjetas del mes.
      this.svc.invalidarDirectorioContacto();
      this.refrescarArchivosCongregacion(idCongContacto);
      this.cerrarModalCongregacionContacto();
    };

    const subirArchivosYFinalizar = () => {
      const pendientes = this.archivosNuevosCongregacionContacto();
      if (!pendientes.length) { finalizar(); return; }
      forkJoin(pendientes.map(f => this.svc.subirArchivoCongregacionContacto(idCongContacto, f, idCong))).subscribe({
        next: finalizar,
        error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al subir los archivos adjuntos'),
      });
    };

    if (peticiones.length === 0) { subirArchivosYFinalizar(); return; }
    forkJoin(peticiones).subscribe({
      next: subirArchivosYFinalizar,
      error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar los contactos'),
    });
  }

  confirmarEliminarCongregacionContacto(c: CongregacionContacto): void {
    this.confirmPendiente.set({
      titulo: 'Eliminar congregación',
      mensaje: `Se eliminará "${c.nombre}" y sus ${c.personas.length} contacto(s). Esta acción no se puede deshacer.`,
      accionLabel: 'Eliminar',
      callback: () => {
        this.svc.eliminarCongregacionContacto(c.id_congregacion_contacto, this.idCong).subscribe({
          next: () => {
            this.congregacionesContacto.set(this.congregacionesContacto().filter(x => x.id_congregacion_contacto !== c.id_congregacion_contacto));
            this.archivosPorCongregacion.update(m => {
              const { [c.id_congregacion_contacto]: _eliminado, ...resto } = m;
              return resto;
            });
            this.svc.invalidarDirectorioContacto();
          },
          error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al eliminar'),
        });
      },
    });
  }

  /** Reutiliza el modal de WhatsApp ya existente para escribir a un contacto o discursante. */
  contactarPersona(p: { nombre: string; telefono: string | null }): void {
    this.whatsappPendiente.set({
      nombre: p.nombre,
      telefono: this.normalizarTelefono(p.telefono),
      mensaje: `Hola${p.nombre ? ' ' + p.nombre : ''}, te escribo para coordinar un discurso público.`,
    });
  }

  /**
   * Recordatorio con los datos completos de la asignación para un orador
   * entrante (discurso, cántico, fecha, hora y hospitalidad si aplica). Usa
   * el nombre/hora del fin de semana de la propia congregación desde
   * /configuracion/, que se carga una sola vez y se cachea.
   */
  enviarRecordatorioEntrante(entrante: DiscursoEntranteOut): void {
    const cfg = this.configuracionPropia();
    if (cfg) {
      this.abrirRecordatorioEntrante(entrante);
      return;
    }
    this.http.get<{ nombre_congregacion: string; hora_reunion_fin_semana: string }>(`${environment.apiUrl}/configuracion/`).subscribe({
      next: (c) => {
        this.configuracionPropia.set({ nombre_congregacion: c.nombre_congregacion, hora_reunion_fin_semana: c.hora_reunion_fin_semana });
        this.abrirRecordatorioEntrante(entrante);
      },
      error: () => this.abrirRecordatorioEntrante(entrante),
    });
  }

  private abrirRecordatorioEntrante(entrante: DiscursoEntranteOut): void {
    this.whatsappPendiente.set({
      nombre: entrante.nombre_orador || 'Orador',
      telefono: this.normalizarTelefono(entrante.telefono_orador),
      mensaje: this.mensajeWhatsappEntrante(entrante),
    });
  }

  private mensajeWhatsappEntrante(e: DiscursoEntranteOut): string {
    const primerNombre = (e.nombre_orador ?? '').split(' ')[0] || 'hermano';
    const cfg = this.configuracionPropia();
    const lineas = [
      `Hola, ${primerNombre} 👋`,
      '',
      'Esperamos que estés muy bien.',
      '',
      'Te recordamos que estás programado para visitarnos y presentar el discurso:',
      '',
    ];
    if (e.titulo_discurso) lineas.push(`📖 ${e.titulo_discurso}`);
    if (e.cantico) lineas.push(`🎵 Cántico: ${e.cantico}`);
    lineas.push('');
    if (cfg?.nombre_congregacion) lineas.push(`📍 Congregación: ${cfg.nombre_congregacion}`);
    lineas.push(`📅 Fecha: ${this.fechaLarga(e.fecha)}`);
    if (cfg?.hora_reunion_fin_semana) lineas.push(`🕕 Hora: ${this.formatHora(cfg.hora_reunion_fin_semana)}`);
    const grupo = this.nombreGrupoHospitalidad(e);
    if (grupo) {
      lineas.push(
        '',
        `Además, el ${grupo} quisiera compartir con ustedes al finalizar la reunión.`,
        '¿Nos confirmas si se quedarán durante toda la reunión y cuántas personas serían?',
      );
    }
    lineas.push('', 'Por favor, avísanos si surge algún cambio.', '', 'Muchas gracias. Quedamos atentos.');
    return lineas.join('\n');
  }

  /**
   * Separa "110. La familia feliz…" (formato del catálogo) en número y título
   * para pintar el número como etiqueta. Un tema escrito a mano sin número
   * se muestra tal cual.
   */
  partirTema(tema: string): { numero: string | null; titulo: string } {
    const m = /^\s*(\d{1,3})\s*[.\-–]\s*(.+)$/.exec(tema);
    return m ? { numero: m[1], titulo: m[2] } : { numero: null, titulo: tema };
  }

  /**
   * URL del bosquejo en docs.jw.org a partir del meps_document_id ya
   * congelado en la fila al momento de escribir el título/tema (no se
   * recalcula contra el catálogo vigente): null si esa fila no tiene id
   * (título sin número, discurso fuera de catálogo, o fila anterior a esta
   * columna que aún no pasó por el backfill).
   */
  urlBosquejo(mepsDocumentId: number | null | undefined): string | null {
    return mepsDocumentId ? `https://docs.jw.org/es/-/doc-${mepsDocumentId}` : null;
  }

  /** Para el botón "Ver bosquejo": para la propagación (la fila es clicable) y abre en pestaña nueva. */
  abrirBosquejo(event: Event, url: string): void {
    event.stopPropagation();
    window.open(url, '_blank', 'noopener');
  }

  /** 3145678902 → "314 567 8902": un celular de 10 dígitos se lee y dicta mejor en grupos. */
  telefonoLegible(tel: string): string {
    const d = tel.replace(/\D/g, '');
    return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : tel;
  }

  abrirModalTema(tema?: TemaPublicador): void {
    if (tema) {
      this.editandoTema.set(tema);
      this.nuevoTema = { id_publicador: tema.id_publicador, numero_tema: tema.numero_tema != null ? String(tema.numero_tema) : '', titulo: tema.titulo };
    } else {
      this.editandoTema.set(null);
      this.nuevoTema = { id_publicador: null, numero_tema: '', titulo: '' };
    }
    this.modalTemaVisible.set(true);
  }

  cerrarModalTema(): void {
    this.modalTemaVisible.set(false);
    this.editandoTema.set(null);
  }

  guardarTema(): void {
    if (!this.nuevoTema.titulo.trim() || !this.idCong) return;
    const numeroTema = this.nuevoTema.numero_tema ? +this.nuevoTema.numero_tema : null;
    const tema = this.editandoTema();
    if (tema) {
      const payload: EditarTemaRequest = { titulo: this.nuevoTema.titulo.trim(), numero_tema: numeroTema };
      this.svc.editarTema(tema.id_tema, payload, this.idCong).subscribe({
        next: (updated) => {
          this.temas.set(this.temas().map(t => t.id_tema === updated.id_tema ? updated : t));
          this.cerrarModalTema();
        },
        error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al guardar'),
      });
    } else {
      if (!this.nuevoTema.id_publicador) return;
      const payload: CrearTemaRequest = { id_publicador: this.nuevoTema.id_publicador, titulo: this.nuevoTema.titulo.trim(), numero_tema: numeroTema };
      this.svc.crearTema(payload, this.idCong).subscribe({
        next: (nuevo) => { this.temas.set([...this.temas(), nuevo]); this.cerrarModalTema(); },
        error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al crear'),
      });
    }
  }

  confirmarEliminarTema(tema: TemaPublicador): void {
    this.confirmPendiente.set({
      titulo: 'Eliminar tema',
      mensaje: `Se eliminará "${tema.titulo}" de ${tema.nombre_publicador}. Esta acción no se puede deshacer.`,
      accionLabel: 'Eliminar',
      callback: () => {
        this.svc.eliminarTema(tema.id_tema, this.idCong).subscribe({
          next: () => this.temas.set(this.temas().filter(t => t.id_tema !== tema.id_tema)),
          error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al eliminar'),
        });
      },
    });
  }

  guardarSaliente(): void {
    if (!this.nuevoSaliente.fecha) return;
    const idCong = this.idCong;
    if (!idCong) return;

    const doCrear = () => {
      this.cerrarModalSaliente();
      this.svc.crearSaliente({
        fecha: this.nuevoSaliente.fecha!,
        id_publicador: this.nuevoSaliente.id_publicador,
        congregacion_destino: this.nuevoSaliente.congregacion_destino || null,
        tema_discurso: this.nuevoSaliente.tema_discurso || null,
        hora: this.nuevoSaliente.hora || null,
        direccion_destino: this.nuevoSaliente.ubicacion?.direccion_destino ?? null,
        url_mapa: this.nuevoSaliente.ubicacion?.url_mapa ?? null,
        lat: this.nuevoSaliente.ubicacion?.lat ?? null,
        lon: this.nuevoSaliente.ubicacion?.lon ?? null,
      }, idCong).subscribe({
        next: (nuevo) => {
          const d = this.mesDatos();
          if (!d) return;
          this.mesDatos.set({ ...d, salientes: [...d.salientes, nuevo] });
        },
        error: (e) => this.errorMsg.set(e?.error?.detail ?? 'Error al añadir saliente'),
      });
    };

    // Solo verificar conflicto si hay publicador seleccionado
    if (!this.nuevoSaliente.id_publicador) {
      doCrear();
      return;
    }

    const pub = this.publicadores().find(p => p.id_publicador === this.nuevoSaliente.id_publicador);
    const nombre = pub?.nombre_completo ?? 'Este publicador';

    this.conflictosSvc
      .confirmarSiHayConflicto(this.nuevoSaliente.id_publicador, this.nuevoSaliente.fecha, idCong, nombre)
      .subscribe((proceder) => { if (proceder) doCrear(); });
  }
}

