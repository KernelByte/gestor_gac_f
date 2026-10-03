import {
  AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy,
  OnInit, Output, ViewChild, computed, effect, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { LogisticaService } from '../services/logistica.service';
import { MesDisponible } from '../models/logistica.models';
import {
  CAMPOS_ESPACIADO,
  CAMPOS_TEXTO,
  CAMPOS_TEXTO_COLOR,
  CampoNumero,
  ClaveTabla,
  ESTILO_IMPRESION_DEFECTO,
  EstiloImpresion,
  OrientacionImpresion,
  PAPEL_MM,
  tintaSeccion,
  PRESETS_IMPRESION,
  PresetImpresion,
  SECCIONES_IMPRESION,
  SeccionesImpresion,
  TamanoPaginaImpresion,
  VistaImprimibleOut,
} from '../models/logistica-impresion.models';
import { aproximarTinta, contraste, nombreMes, renderDocumentoImpresion } from '../utils/logistica-impresion.render';

type EstadoCarga = 'cargando' | 'listo' | 'error';
type EstadoGuardado = 'inactivo' | 'guardando' | 'guardado' | 'error';

/** 1 mm en píxeles CSS (96 dpi): lo que usa el navegador para @page. */
const PX_POR_MM = 96 / 25.4;

/**
 * Estudio de impresión del programa de Logística.
 *
 * Vista previa y estilo en una misma pantalla —sin pestañas "vista" y
 * "configuración" por separado—: cada ajuste se ve en la hoja al instante y se
 * guarda solo, por congregación. La hoja es un iframe con el mismo HTML que se
 * imprime (`renderDocumentoImpresion`), así que no hay sorpresas en el papel.
 */
@Component({
  selector: 'app-logistica-impresion-estudio',
  standalone: true,
  imports: [CommonModule, FormsModule, SelectPickerComponent],
  template: `
    <div
      class="estudio-velo fixed inset-0 z-[70] flex bg-slate-950/50 backdrop-blur-sm"
      [class.saliendo]="saliendo()"
      (click)="cerrar()">
      <div
        #raiz
        role="dialog"
        aria-modal="true"
        aria-labelledby="estudio-titulo"
        data-testid="log-estudio-impresion"
        class="estudio-panel relative m-0 lg:m-3 flex flex-1 min-w-0 flex-col overflow-hidden bg-white dark:bg-slate-900 lg:rounded-2xl shadow-2xl ring-1 ring-slate-900/10 dark:ring-white/10"
        (click)="$event.stopPropagation()">

        <!-- ===== BARRA SUPERIOR ===== -->
        <header class="shrink-0 flex items-center gap-2 sm:gap-3 px-3 sm:px-4 h-16 border-b border-slate-200 dark:border-slate-800">
          <button
            #btnCerrar
            type="button"
            (click)="cerrar()"
            aria-label="Cerrar el estudio de impresión"
            title="Cerrar (Esc)"
            class="shrink-0 w-11 h-11 sm:w-9 sm:h-9 flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>

          <div class="hidden sm:flex items-center gap-2.5 min-w-0">
            <span class="shrink-0 w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 flex items-center justify-center">
              <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
            </span>
            <div class="min-w-0">
              <h2 id="estudio-titulo" class="text-sm font-black text-slate-800 dark:text-white leading-tight truncate">Imprimir programa</h2>
              <p class="text-[0.7rem] text-slate-500 dark:text-slate-400 leading-tight truncate">Logística · lo que ves es lo que sale en papel</p>
            </div>
          </div>

          <div class="w-44 sm:w-52 shrink min-w-0 sm:ml-2" data-testid="log-estudio-mes">
            <app-select-picker
              [ngModel]="claveMes()"
              (ngModelChange)="cambiarMes($event)"
              [options]="opcionesMes()"
              [clearable]="false"
              [searchable]="false"
              colorScheme="violet"
              ariaLabel="Mes a imprimir">
            </app-select-picker>
          </div>

          <span class="flex-1"></span>

          <!-- Hojas y papel: el dato que decide si hay que apretar algo. -->
          @if (estadoCarga() === 'listo') {
            <span
              class="hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-slate-100 dark:bg-slate-800 text-[0.7rem] font-bold text-slate-600 dark:text-slate-300 tabular-nums"
              data-testid="log-estudio-hojas"
              [title]="'Calculado con el papel y los márgenes elegidos'">
              <svg class="w-3.5 h-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg>
              {{ hojas() }} {{ hojas() === 1 ? 'hoja' : 'hojas' }} · {{ papelLabel() }}
            </span>
          }

          <span class="hidden lg:inline-flex items-center gap-1.5 text-[0.7rem] font-semibold min-w-[6.5rem] justify-end" aria-live="polite">
            @switch (guardado()) {
              @case ('guardando') {
                <span class="w-3 h-3 rounded-full border-2 border-slate-300 border-t-violet-500 animate-spin"></span>
                <span class="text-slate-500">Guardando…</span>
              }
              @case ('guardado') {
                <svg class="w-3.5 h-3.5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span class="text-emerald-600 dark:text-emerald-400">Estilo guardado</span>
              }
              @case ('error') {
                <span class="text-red-600 dark:text-red-400">No se pudo guardar</span>
              }
            }
          </span>

          <button
            type="button"
            data-testid="log-estudio-imprimir"
            (click)="imprimir()"
            [disabled]="estadoCarga() !== 'listo'"
            title="Imprimir (Ctrl/⌘ + P)"
            class="shrink-0 flex items-center gap-2 h-11 sm:h-10 px-4 rounded-xl bg-brand-purple text-white text-sm font-bold shadow-violet hover:brightness-110 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
            Imprimir
          </button>
        </header>

        <!-- Conmutador Vista / Estilo: solo en pantallas estrechas, donde no
             caben la hoja y el panel a la vez. -->
        <div class="lg:hidden shrink-0 px-3 py-2 border-b border-slate-200 dark:border-slate-800">
          <div role="tablist" aria-label="Sección del estudio" class="flex items-center gap-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            @for (v of vistasMovil; track v.id) {
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="vistaMovil() === v.id"
                (click)="vistaMovil.set(v.id)"
                class="flex-1 h-9 rounded-lg text-xs font-bold transition-colors"
                [class]="vistaMovil() === v.id
                  ? 'bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'">
                {{ v.label }}
              </button>
            }
          </div>
        </div>

        <div class="flex-1 min-h-0 flex">

          <!-- ===== LIENZO: la hoja ===== -->
          <section
            #lienzo
            aria-label="Vista previa de la hoja"
            class="lienzo flex-1 min-w-0 overflow-auto simple-scrollbar bg-slate-100 dark:bg-slate-950 lg:block"
            [class.hidden]="vistaMovil() !== 'vista'">

            @switch (estadoCarga()) {
              @case ('cargando') {
                <div class="flex justify-center px-4 py-8">
                  <div class="hoja-esqueleto rounded-sm bg-white shadow-card" [style.width.px]="anchoVisible()" [style.height.px]="anchoVisible() * 1.29">
                    <div class="p-[8%] flex flex-col gap-3">
                      <div class="mx-auto h-4 w-1/2 rounded bg-slate-200 animate-pulse"></div>
                      <div class="mx-auto h-2.5 w-1/3 rounded bg-slate-100 animate-pulse"></div>
                      @for (i of [1, 2, 3]; track i) {
                        <div class="mt-4 h-3 w-full rounded bg-slate-200 animate-pulse"></div>
                        <div class="h-20 w-full rounded bg-slate-100 animate-pulse"></div>
                      }
                    </div>
                  </div>
                </div>
              }
              @case ('error') {
                <div class="h-full flex items-center justify-center p-6">
                  <div class="max-w-sm text-center" role="alert">
                    <span class="mx-auto mb-3 w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </span>
                    <p class="text-sm font-bold text-slate-800 dark:text-white">No se puede imprimir este mes</p>
                    <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">{{ errorCarga() }}</p>
                    <button type="button" (click)="cargar()" class="mt-4 h-9 px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors">Reintentar</button>
                  </div>
                </div>
              }
            }

            <!-- El iframe se monta siempre para no perder el documento entre
                 recargas; mientras carga queda fuera de la vista. -->
            <div class="flex justify-center px-4 py-6 lg:py-8" [class.hidden]="estadoCarga() !== 'listo'">
              <div class="relative shrink-0" [style.width.px]="anchoVisible()" [style.height.px]="altoVisible()">
                <div
                  class="hoja absolute top-0 left-0 origin-top-left bg-white rounded-[2px] shadow-card ring-1 ring-slate-900/5"
                  [style.width.px]="anchoPapelPx()"
                  [style.height.px]="altoHojaPx()"
                  [style.transform]="'scale(' + escala() + ')'">
                  <iframe
                    #marco
                    title="Hoja del programa de logística"
                    data-testid="log-estudio-hoja"
                    class="block w-full h-full border-0 bg-white"
                    tabindex="-1"></iframe>

                  <!-- Dónde empieza cada hoja. Se simula como lo hará la
                       impresora: una sección que no cabe entera en lo que
                       queda de hoja pasa completa a la siguiente. -->
                  @for (corte of cortes(); track corte.hoja) {
                    <div class="corte pointer-events-none absolute left-0 right-0 flex items-center" [style.top.px]="corte.y">
                      <span class="flex-1 border-t-2 border-dashed border-violet-400/80"></span>
                      <span class="absolute right-2 -translate-y-1/2 top-0 origin-right px-2 py-0.5 rounded-full bg-violet-600 text-white text-[11px] font-bold shadow-sm whitespace-nowrap" [style.transform]="'translateY(-50%) scale(' + 1 / escala() + ')'">Empieza la hoja {{ corte.hoja }}</span>
                    </div>
                  }
                </div>
              </div>
            </div>
          </section>

          <!-- ===== PANEL DE ESTILO ===== -->
          <aside
            aria-label="Estilo de la hoja"
            class="panel w-full lg:w-[380px] shrink-0 flex flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 lg:flex"
            [class.hidden]="vistaMovil() !== 'estilo'">

            <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar overscroll-contain">

              <!-- Contenido -->
              <details class="grupo" open>
                <summary>Contenido</summary>
                <div class="px-4 pb-4 flex flex-col gap-1">
                  @for (s of seccionesDisponibles; track s.clave) {
                    <label class="fila-toggle">
                      <span class="text-xs font-semibold text-slate-700 dark:text-slate-200">{{ s.label }}</span>
                      <input
                        type="checkbox"
                        role="switch"
                        class="switch"
                        [attr.data-testid]="'log-estudio-seccion-' + s.clave"
                        [checked]="estilo().secciones[s.clave]"
                        (change)="cambiarSeccion(s.clave, $any($event.target).checked)" />
                    </label>
                  }
                  <label class="fila-toggle mt-1 pt-2 border-t border-slate-100 dark:border-slate-800" [class.opacity-50]="!hayHoja2()">
                    <span class="min-w-0">
                      <span class="block text-xs font-semibold text-slate-700 dark:text-slate-200">Añadir {{ mesSiguienteLabel() }} a la 2.ª hoja</span>
                      <span class="block text-[0.68rem] text-slate-400 dark:text-slate-500">Fin de semana y discursos, para que la hoja no quede vieja a fin de mes.</span>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      class="switch"
                      data-testid="log-estudio-mes-siguiente"
                      [disabled]="!hayHoja2()"
                      [checked]="estilo().incluir_mes_siguiente"
                      (change)="cambiar('incluir_mes_siguiente', $any($event.target).checked)" />
                  </label>
                </div>
              </details>

              <!-- Estilos rápidos -->
              <details class="grupo" open>
                <summary>Estilo rápido</summary>
                <div class="px-4 pb-4 grid grid-cols-2 gap-2">
                  @for (p of presets; track p.id) {
                    <button
                      type="button"
                      [attr.data-testid]="'log-estudio-preset-' + p.id"
                      [attr.aria-pressed]="presetActivo() === p.id"
                      (click)="aplicarPreset(p)"
                      class="preset group text-left rounded-xl border p-2 transition-all active:scale-[0.98]"
                      [class]="presetActivo() === p.id
                        ? 'border-violet-500 ring-2 ring-violet-500/20 bg-violet-50/50 dark:bg-violet-900/20'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'">
                      <!-- Miniatura: una franja por tabla, con su color real. -->
                      <span class="block rounded-lg bg-white p-1.5 ring-1 ring-slate-900/5" aria-hidden="true">
                        <span class="flex items-center gap-1 mb-1">
                          <span class="w-[3px] h-2 rounded-full" [style.background]="tinta(p.colores_tablas.acomodadores)"></span>
                          <span class="h-1 w-8 rounded-full" [style.background]="p.color_titulo" style="opacity:.55"></span>
                        </span>
                        <span class="block rounded-[4px] overflow-hidden border border-slate-200">
                          <span class="flex h-2.5">
                            @for (t of tablas; track t.clave) {
                              <span class="flex-1" [style.background]="p.encabezado_suave ? suave(p.colores_tablas[t.clave]) : tinta(p.colores_tablas[t.clave])"></span>
                            }
                          </span>
                          <span class="block h-2 bg-white"></span>
                          <span class="block h-2" [style.background]="velo(p.colores_tablas.acomodadores)"></span>
                        </span>
                      </span>
                      <span class="mt-1.5 flex items-center gap-1">
                        <span class="min-w-0 truncate text-[0.72rem] font-bold text-slate-700 dark:text-slate-200">{{ p.nombre }}</span>
                        @if (p.predeterminado) {
                          <span class="shrink-0 px-1.5 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[0.56rem] font-bold leading-4" title="Estilo predeterminado">Predet.</span>
                        }
                        <span class="flex-1"></span>
                        @if (presetActivo() === p.id) {
                          <svg class="w-3.5 h-3.5 shrink-0 text-violet-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        }
                      </span>
                      <span class="block truncate text-[0.65rem] text-slate-400 dark:text-slate-500">{{ p.descripcion }}</span>
                    </button>
                  }
                </div>
              </details>

              <!-- Colores: uno por tabla y dos de texto. El encabezado, el título
                   de cada sección, las filas alternas y los bordes salen solos
                   del color de su tabla. -->
              <details class="grupo" open>
                <summary>Colores</summary>
                <div class="px-4 pb-4 flex flex-col gap-4">
                  <div>
                    <p class="mb-1 text-[0.62rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tablas</p>
                    <div class="flex flex-col">
                      @for (t of tablas; track t.clave) {
                        <div class="flex items-center gap-2.5 py-1" [attr.data-testid]="'log-estudio-tabla-' + t.clave">
                          <label class="color-chip shrink-0" [style.background]="estilo().colores_tablas[t.clave]" [title]="'Elegir el color de ' + t.label.toLowerCase()">
                            <input
                              type="color"
                              class="sr-only"
                              [attr.aria-label]="'Color de ' + t.label"
                              [value]="estilo().colores_tablas[t.clave]"
                              (input)="cambiarColorTabla(t.clave, $any($event.target).value)" />
                          </label>
                          <span class="flex-1 min-w-0 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{{ t.label }}</span>
                          <input
                            type="text"
                            spellcheck="false"
                            maxlength="7"
                            [attr.aria-label]="'Color de ' + t.label + ' en hexadecimal'"
                            [value]="estilo().colores_tablas[t.clave]"
                            (change)="cambiarHexTabla(t.clave, $any($event.target))"
                            class="w-[5.5rem] h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono uppercase text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400" />
                        </div>
                      }
                    </div>
                  </div>

                  <div>
                    <p class="mb-1 text-[0.62rem] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Textos</p>
                    <div class="flex flex-col">
                      @for (c of camposTextoColor; track c.clave) {
                        <div class="flex items-center gap-2.5 py-1">
                          <label class="color-chip shrink-0" [style.background]="estilo()[c.clave]" [title]="'Elegir ' + c.label.toLowerCase()">
                            <input
                              type="color"
                              class="sr-only"
                              [attr.aria-label]="c.label"
                              [value]="estilo()[c.clave]"
                              (input)="cambiarColorTexto(c.clave, $any($event.target).value)" />
                          </label>
                          <span class="flex-1 min-w-0">
                            <span class="block text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{{ c.label }}</span>
                            <span class="block text-[0.65rem] text-slate-400 dark:text-slate-500 truncate">{{ c.ayuda }}</span>
                          </span>
                          <input
                            type="text"
                            spellcheck="false"
                            maxlength="7"
                            [attr.aria-label]="c.label + ' en hexadecimal'"
                            [value]="estilo()[c.clave]"
                            (change)="cambiarHexTexto(c.clave, $any($event.target))"
                            class="w-[5.5rem] h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-mono uppercase text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400" />
                        </div>
                      }
                    </div>
                  </div>

                  <label class="fila-toggle rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2">
                    <span class="min-w-0">
                      <span class="block text-xs font-semibold text-slate-700 dark:text-slate-200">Encabezados claros</span>
                      <span class="block text-[0.68rem] text-slate-400 dark:text-slate-500">Sin relleno sólido: gasta mucha menos tinta.</span>
                    </span>
                    <input
                      type="checkbox"
                      role="switch"
                      class="switch"
                      data-testid="log-estudio-encabezado-suave"
                      [checked]="estilo().encabezado_suave"
                      (change)="cambiar('encabezado_suave', $any($event.target).checked)" />
                  </label>

                  @for (aviso of avisosContraste(); track aviso) {
                    <p class="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-[0.7rem] text-amber-800 dark:text-amber-300" role="status">
                      <svg class="w-3.5 h-3.5 mt-px shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      {{ aviso }}
                    </p>
                  }
                </div>
              </details>

              <!-- Texto -->
              <details class="grupo">
                <summary>Título y tamaños de letra</summary>
                <div class="px-4 pb-4 flex flex-col gap-2">
                  <label class="block">
                    <span class="block mb-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Título de la hoja</span>
                    <input
                      type="text"
                      maxlength="80"
                      data-testid="log-estudio-titulo"
                      [value]="estilo().titulo"
                      (input)="cambiarTitulo($any($event.target).value)"
                      class="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400" />
                  </label>
                  @for (c of camposTexto; track c.clave) {
                    <ng-container *ngTemplateOutlet="stepper; context: { $implicit: c }"></ng-container>
                  }
                </div>
              </details>

              <!-- Página y espaciado -->
              <details class="grupo" open>
                <summary>Página y espaciado</summary>
                <div class="px-4 pb-4 flex flex-col gap-3">
                  <div class="grid grid-cols-2 gap-2">
                    <div>
                      <p class="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Papel</p>
                      <div class="segmentado" role="radiogroup" aria-label="Tamaño de papel">
                        @for (t of tamanos; track t.id) {
                          <button type="button" role="radio" [attr.aria-checked]="estilo().tamano_pagina === t.id"
                                  (click)="cambiar('tamano_pagina', t.id)" [class.activo]="estilo().tamano_pagina === t.id">{{ t.label }}</button>
                        }
                      </div>
                    </div>
                    <div>
                      <p class="mb-1 text-xs font-semibold text-slate-700 dark:text-slate-200">Orientación</p>
                      <div class="segmentado" role="radiogroup" aria-label="Orientación">
                        @for (o of orientaciones; track o.id) {
                          <button type="button" role="radio" [attr.aria-checked]="estilo().orientacion === o.id"
                                  [attr.aria-label]="o.label" [title]="o.label"
                                  (click)="cambiar('orientacion', o.id)" [class.activo]="estilo().orientacion === o.id">
                            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
                              @if (o.id === 'vertical') { <rect x="6" y="3" width="12" height="18" rx="1.5"/> }
                              @else { <rect x="3" y="6" width="18" height="12" rx="1.5"/> }
                            </svg>
                          </button>
                        }
                      </div>
                    </div>
                  </div>
                  @for (c of camposEspaciado; track c.clave) {
                    <ng-container *ngTemplateOutlet="stepper; context: { $implicit: c }"></ng-container>
                  }
                </div>
              </details>
            </div>

            <!-- Pie del panel -->
            <footer class="shrink-0 border-t border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-col gap-2.5">
              <p class="flex items-start gap-2 text-[0.68rem] leading-snug text-slate-500 dark:text-slate-400">
                <svg class="w-3.5 h-3.5 mt-px shrink-0 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>
                <span>Para quitar la fecha y la dirección web del papel, desactiva <b class="font-bold text-slate-600 dark:text-slate-300">Encabezados y pies de página</b> en el diálogo de impresión. Ahí también puedes elegir <b class="font-bold text-slate-600 dark:text-slate-300">Guardar como PDF</b>.</span>
              </p>
              <div class="flex items-center gap-2">
                @if (!confirmandoReset()) {
                  <button
                    type="button"
                    data-testid="log-estudio-restablecer"
                    (click)="confirmandoReset.set(true)"
                    [disabled]="porDefecto()"
                    class="flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-15-6.7L3 13"/></svg>
                    Restablecer valores
                  </button>
                } @else {
                  <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">¿Volver al estilo original?</span>
                  <button type="button" data-testid="log-estudio-restablecer-si" (click)="restablecer()" class="h-9 px-3 rounded-lg bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold active:scale-[0.97] transition-all">Sí</button>
                  <button type="button" (click)="confirmandoReset.set(false)" class="h-9 px-3 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">No</button>
                }
                <span class="flex-1"></span>
                <span class="lg:hidden text-[0.68rem] font-semibold" aria-hidden="true"
                      [class]="guardado() === 'error' ? 'text-red-600' : 'text-slate-400'">
                  {{ guardado() === 'guardando' ? 'Guardando…' : guardado() === 'guardado' ? 'Guardado ✓' : guardado() === 'error' ? 'No se pudo guardar' : '' }}
                </span>
              </div>
            </footer>
          </aside>
        </div>
      </div>
    </div>

    <ng-template #stepper let-c>
      <div class="flex items-center gap-2">
        <span class="flex-1 min-w-0 text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{{ c.label }}</span>
        <div class="stepper" [attr.data-testid]="'log-estudio-num-' + c.clave">
          <button type="button" [attr.aria-label]="'Reducir ' + c.label" (click)="pasoNumero(c, -1)" [disabled]="valorNumero(c) <= c.min">−</button>
          <input
            type="number"
            inputmode="decimal"
            [attr.aria-label]="c.label + ' en ' + c.unidad"
            [min]="c.min" [max]="c.max" [step]="c.paso"
            [value]="valorNumero(c)"
            (change)="fijarNumero(c, $any($event.target))" />
          <span class="unidad" aria-hidden="true">{{ c.unidad }}</span>
          <button type="button" [attr.aria-label]="'Aumentar ' + c.label" (click)="pasoNumero(c, 1)" [disabled]="valorNumero(c) >= c.max">+</button>
        </div>
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: contents; }

    /* Entrada: el velo se funde y el panel sube un poco. Salida más corta que
       la entrada, como cualquier cierre que no debe hacer esperar. */
    .estudio-velo { animation: velo-in var(--duration-base, 200ms) ease-out both; }
    .estudio-panel { animation: panel-in var(--duration-slow, 320ms) var(--ease-out-strong, cubic-bezier(0.23, 1, 0.32, 1)) both; }
    .estudio-velo.saliendo { animation: velo-out var(--duration-fast, 120ms) ease-in both; }
    .estudio-velo.saliendo .estudio-panel { animation: panel-out var(--duration-fast, 120ms) ease-in both; }
    @keyframes velo-in { from { opacity: 0; } }
    @keyframes velo-out { to { opacity: 0; } }
    @keyframes panel-in { from { opacity: 0; transform: translateY(12px) scale(0.985); } }
    @keyframes panel-out { to { opacity: 0; transform: translateY(6px) scale(0.99); } }

    .hoja { transition: width var(--duration-slow, 320ms) var(--ease-out-strong), height var(--duration-slow, 320ms) var(--ease-out-strong); }

    .grupo { border-bottom: 1px solid rgb(241 245 249); }
    :host-context(.dark) .grupo { border-color: rgb(30 41 59); }
    .grupo > summary {
      list-style: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px 10px;
      font-size: 0.68rem;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgb(100 116 139);
      user-select: none;
    }
    .grupo > summary::-webkit-details-marker { display: none; }
    .grupo > summary::after {
      content: '';
      width: 8px; height: 8px;
      border-right: 2px solid currentColor;
      border-bottom: 2px solid currentColor;
      transform: rotate(45deg) translateY(-2px);
      opacity: 0.6;
      transition: transform var(--duration-base, 200ms) var(--ease-out-strong);
    }
    .grupo[open] > summary::after { transform: rotate(-135deg) translateY(-2px); }
    .grupo > summary:focus-visible { outline: 2px solid rgb(139 92 246); outline-offset: -2px; border-radius: 8px; }

    .fila-toggle {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      min-height: 40px; cursor: pointer;
    }
    .switch {
      appearance: none; flex-shrink: 0; cursor: pointer;
      width: 36px; height: 20px; border-radius: 999px;
      background: rgb(203 213 225); position: relative;
      transition: background var(--duration-base, 200ms) ease;
    }
    .switch::after {
      content: ''; position: absolute; top: 2px; left: 2px;
      width: 16px; height: 16px; border-radius: 999px; background: #fff;
      box-shadow: 0 1px 2px rgb(15 23 42 / 0.25);
      transition: transform var(--duration-base, 200ms) var(--ease-out-strong);
    }
    .switch:checked { background: rgb(124 58 237); }
    .switch:checked::after { transform: translateX(16px); }
    .switch:disabled { cursor: not-allowed; }
    .switch:focus-visible { outline: 2px solid rgb(139 92 246); outline-offset: 2px; }
    :host-context(.dark) .switch:not(:checked) { background: rgb(51 65 85); }

    .color-chip {
      position: relative; display: block; cursor: pointer;
      width: 32px; height: 32px; border-radius: 10px;
      box-shadow: inset 0 0 0 1px rgb(15 23 42 / 0.12);
      transition: transform var(--duration-fast, 120ms) ease;
    }
    .color-chip:hover { transform: scale(1.06); }
    :host-context(.dark) .color-chip { box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.28); }
    .color-chip:focus-within { outline: 2px solid rgb(139 92 246); outline-offset: 2px; }

    .segmentado {
      display: flex; gap: 2px; padding: 3px; border-radius: 10px;
      background: rgb(241 245 249);
    }
    :host-context(.dark) .segmentado { background: rgb(30 41 59); }
    .segmentado button {
      flex: 1; height: 32px; display: flex; align-items: center; justify-content: center;
      border-radius: 8px; font-size: 0.72rem; font-weight: 700; color: rgb(100 116 139);
      transition: background var(--duration-fast, 120ms) ease, color var(--duration-fast, 120ms) ease;
    }
    .segmentado button.activo { background: #fff; color: rgb(109 40 217); box-shadow: 0 1px 2px rgb(15 23 42 / 0.08); }
    :host-context(.dark) .segmentado button.activo { background: rgb(15 23 42); color: rgb(196 181 253); }

    .stepper {
      display: flex; align-items: center; height: 36px; flex-shrink: 0;
      border: 1px solid rgb(226 232 240); border-radius: 10px; overflow: hidden;
      background: rgb(248 250 252);
    }
    :host-context(.dark) .stepper { border-color: rgb(51 65 85); background: rgb(30 41 59); }
    .stepper:focus-within { border-color: rgb(167 139 250); box-shadow: 0 0 0 3px rgb(139 92 246 / 0.15); }
    .stepper button {
      width: 32px; height: 100%; font-size: 1rem; font-weight: 700; color: rgb(100 116 139);
      transition: background var(--duration-fast, 120ms) ease;
    }
    .stepper button:hover:not(:disabled) { background: rgb(226 232 240); }
    :host-context(.dark) .stepper button:hover:not(:disabled) { background: rgb(51 65 85); }
    .stepper button:disabled { opacity: 0.35; cursor: not-allowed; }
    .stepper input {
      width: 40px; height: 100%; text-align: right; background: transparent; border: 0;
      font-size: 0.78rem; font-weight: 700; font-variant-numeric: tabular-nums;
      color: inherit; -moz-appearance: textfield;
    }
    .stepper input::-webkit-outer-spin-button, .stepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    .stepper input:focus { outline: none; }
    .stepper .unidad { padding: 0 4px 0 3px; font-size: 0.65rem; font-weight: 600; color: rgb(148 163 184); }

    @media (prefers-reduced-motion: reduce) {
      .estudio-velo, .estudio-panel, .estudio-velo.saliendo, .estudio-velo.saliendo .estudio-panel { animation: none; }
      .hoja, .switch, .switch::after { transition: none; }
    }
  `],
})
export class LogisticaImpresionEstudioComponent implements OnInit, AfterViewInit, OnDestroy {
  private logisticaSvc = inject(LogisticaService);
  private congregacionCtx = inject(CongregacionContextService);

  /** Mes con el que se abre el estudio. */
  @Input({ required: true }) ano!: number;
  @Input({ required: true }) mes!: number;
  /** Meses de la congregación; el selector solo ofrece los publicados. */
  @Input() meses: MesDisponible[] = [];
  @Output() cerrado = new EventEmitter<void>();

  @ViewChild('raiz') raiz?: ElementRef<HTMLElement>;
  @ViewChild('btnCerrar') btnCerrar?: ElementRef<HTMLButtonElement>;
  @ViewChild('marco') marco?: ElementRef<HTMLIFrameElement>;
  @ViewChild('lienzo') lienzo?: ElementRef<HTMLElement>;

  readonly presets = PRESETS_IMPRESION;
  readonly tablas = SECCIONES_IMPRESION;
  readonly camposTextoColor = CAMPOS_TEXTO_COLOR;
  /** Las mismas derivaciones que usa la hoja, para las miniaturas. */
  readonly tinta = tintaSeccion;
  readonly suave = (c: string) => `color-mix(in oklch, ${c} 13%, white)`;
  readonly velo = (c: string) => `color-mix(in oklch, ${c} 9%, white)`;
  readonly camposTexto = CAMPOS_TEXTO;
  readonly camposEspaciado = CAMPOS_ESPACIADO;
  readonly seccionesDisponibles = SECCIONES_IMPRESION;
  readonly tamanos: { id: TamanoPaginaImpresion; label: string }[] = [
    { id: 'carta', label: 'Carta' },
    { id: 'a4', label: 'A4' },
  ];
  readonly orientaciones: { id: OrientacionImpresion; label: string }[] = [
    { id: 'vertical', label: 'Vertical' },
    { id: 'horizontal', label: 'Horizontal' },
  ];
  readonly vistasMovil = [
    { id: 'vista' as const, label: 'Vista previa' },
    { id: 'estilo' as const, label: 'Estilo' },
  ];

  mesSel = signal<{ ano: number; mes: number }>({ ano: 0, mes: 0 });
  datos = signal<VistaImprimibleOut | null>(null);
  estadoCarga = signal<EstadoCarga>('cargando');
  errorCarga = signal('');

  estilo = signal<EstiloImpresion>(structuredClone(ESTILO_IMPRESION_DEFECTO));
  porDefecto = signal(true);
  private estiloCargado = signal(false);
  guardado = signal<EstadoGuardado>('inactivo');
  confirmandoReset = signal(false);

  vistaMovil = signal<'vista' | 'estilo'>('vista');
  saliendo = signal(false);

  /** Alto del contenido del iframe (px CSS, sin escalar). */
  private altoContenido = signal(0);
  /** Dónde empieza cada hoja a partir de la 2.ª, en px desde el inicio del contenido. */
  private saltos = signal<number[]>([]);
  private anchoLienzo = signal(0);

  private subDatos?: Subscription;
  private temporizadorGuardado?: ReturnType<typeof setTimeout>;
  private temporizadorRender?: ReturnType<typeof setTimeout>;
  private observador?: ResizeObserver;
  private focoPrevio: Element | null = null;

  // ── Derivados ──────────────────────────────────────────────

  claveMes = computed(() => `${this.mesSel().ano}-${this.mesSel().mes}`);

  opcionesMes = computed(() => {
    const publicados = this.meses.filter((m) => m.estado === 'publicado');
    const actual = this.mesSel();
    // El mes abierto siempre figura, aunque la lista aún no lo traiga.
    if (!publicados.some((m) => m.ano === actual.ano && m.mes === actual.mes)) {
      publicados.unshift({ ano: actual.ano, mes: actual.mes, estado: 'publicado' });
    }
    return publicados.map((m) => ({ value: `${m.ano}-${m.mes}`, label: nombreMes(m.ano, m.mes) }));
  });

  /** La 2.ª hoja existe si lleva fin de semana o discursos. */
  hayHoja2 = computed(() => this.estilo().secciones.fin_semana || this.estilo().secciones.discursos);

  mesSiguienteLabel = computed(() => {
    const { ano, mes } = this.mesSel();
    return mes === 12 ? nombreMes(ano + 1, 1) : nombreMes(ano, mes + 1);
  });

  private papel = computed(() => {
    const e = this.estilo();
    const p = PAPEL_MM[e.tamano_pagina];
    const [ancho, alto] = e.orientacion === 'vertical' ? [p.ancho, p.alto] : [p.alto, p.ancho];
    return { ancho, alto, label: p.label };
  });

  anchoPapelPx = computed(() => this.papel().ancho * PX_POR_MM);
  private altoPapelPx = computed(() => this.papel().alto * PX_POR_MM);
  private margenPx = computed(() => this.estilo().margen_pagina * PX_POR_MM);
  private altoUtilPx = computed(() => this.altoPapelPx() - 2 * this.margenPx());

  hojas = computed(() => this.saltos().length + 1);

  papelLabel = computed(() =>
    `${this.papel().label} ${this.estilo().orientacion === 'vertical' ? 'vertical' : 'horizontal'}`,
  );

  /** Alto del papel mostrado: al menos una hoja entera. */
  altoHojaPx = computed(() => Math.max(this.altoContenido(), this.altoPapelPx()));

  escala = computed(() => {
    const disponible = this.anchoLienzo() - 32;
    if (disponible <= 0) return 1;
    return Math.min(1, disponible / this.anchoPapelPx());
  });

  anchoVisible = computed(() => this.anchoPapelPx() * this.escala());
  altoVisible = computed(() => this.altoHojaPx() * this.escala());

  cortes = computed(() =>
    // La línea va en el hueco entre secciones, no encima del título.
    this.saltos().map((y, i) => ({
      hoja: i + 2,
      y: this.margenPx() + y - this.estilo().espacio_secciones / 2,
    })),
  );

  presetActivo = computed(() => {
    const e = this.estilo();
    const igual = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
    const p = this.presets.find((pr) =>
      !!pr.encabezado_suave === e.encabezado_suave
      && igual(pr.color_titulo, e.color_titulo)
      && igual(pr.color_texto, e.color_texto)
      && this.tablas.every((t) => igual(pr.colores_tablas[t.clave], e.colores_tablas[t.clave])),
    );
    return p?.id ?? null;
  });

  avisosContraste = computed(() => {
    const e = this.estilo();
    const avisos: string[] = [];
    // El texto del encabezado es blanco sobre el color de la tabla oscurecido.
    if (!e.encabezado_suave) {
      for (const t of this.tablas) {
        if (contraste('#ffffff', aproximarTinta(e.colores_tablas[t.clave])) < 4.5) {
          avisos.push(`El encabezado de "${t.label}" es demasiado claro: el texto blanco se lee mal. Elige un tono más oscuro.`);
        }
      }
    }
    if (contraste(e.color_texto, '#ffffff') < 4.5) {
      avisos.push('El texto de las tablas tiene poco contraste con el papel.');
    }
    if (contraste(e.color_titulo, '#ffffff') < 4.5) {
      avisos.push('El título de la hoja tiene poco contraste con el papel.');
    }
    return avisos;
  });

  constructor() {
    // En móvil la hoja está oculta mientras se edita el estilo y ahí no se
    // puede medir; al volver a la vista previa se mide de nuevo.
    effect(() => {
      if (this.vistaMovil() !== 'vista') return;
      setTimeout(() => {
        const doc = this.marco?.nativeElement.contentDocument;
        if (doc?.body) this.medir(doc);
      });
    });

    // Repinta la hoja cuando cambian los datos o el estilo. Con un respiro
    // corto: arrastrar el selector de color dispara decenas de eventos.
    effect(() => {
      const datos = this.datos();
      const estilo = this.estilo();
      if (!datos) return;
      clearTimeout(this.temporizadorRender);
      this.temporizadorRender = setTimeout(() => this.pintar(datos, estilo), 40);
    });
  }

  ngOnInit(): void {
    this.mesSel.set({ ano: this.ano, mes: this.mes });
    this.focoPrevio = document.activeElement;
    this.logisticaSvc.getEstiloImpresion(this.cong()).subscribe({
      next: (r) => {
        this.estilo.set(r.estilo);
        this.porDefecto.set(r.por_defecto);
        this.estiloCargado.set(true);
        this.cargar();
      },
      // Sin estilo guardado accesible, se imprime con el de siempre.
      error: () => {
        this.estiloCargado.set(true);
        this.cargar();
      },
    });
  }

  ngAfterViewInit(): void {
    this.btnCerrar?.nativeElement.focus();
    const lienzo = this.lienzo?.nativeElement;
    if (lienzo && typeof ResizeObserver !== 'undefined') {
      this.observador = new ResizeObserver(([e]) => this.anchoLienzo.set(e.contentRect.width));
      this.observador.observe(lienzo);
    }
  }

  ngOnDestroy(): void {
    this.subDatos?.unsubscribe();
    this.observador?.disconnect();
    clearTimeout(this.temporizadorRender);
    // Un cambio a medio guardar no se pierde al cerrar.
    if (this.temporizadorGuardado) {
      clearTimeout(this.temporizadorGuardado);
      this.logisticaSvc.guardarEstiloImpresion(this.estilo(), this.cong()).subscribe({ error: () => {} });
    }
    (this.focoPrevio as HTMLElement | null)?.focus?.();
  }

  private cong(): number | null {
    return this.congregacionCtx.effectiveCongregacionId();
  }

  // ── Datos ──────────────────────────────────────────────────

  cargar(): void {
    const { ano, mes } = this.mesSel();
    this.subDatos?.unsubscribe();
    this.estadoCarga.set('cargando');
    this.subDatos = this.logisticaSvc
      .getVistaImprimible(ano, mes, this.cong(), this.estilo().incluir_mes_siguiente)
      .subscribe({
        next: (d) => {
          this.datos.set(d);
          this.estadoCarga.set('listo');
        },
        error: (err) => {
          this.datos.set(null);
          this.errorCarga.set(
            err?.status === 409
              ? 'Tiene cambios sin publicar. Publícalo para imprimir la versión que ve la congregación.'
              : err?.error?.detail ?? 'No se pudieron cargar los datos del mes.',
          );
          this.estadoCarga.set('error');
        },
      });
  }

  cambiarMes(clave: string): void {
    const [ano, mes] = String(clave).split('-').map(Number);
    if (!ano || !mes) return;
    this.mesSel.set({ ano, mes });
    this.cargar();
  }

  private pintar(datos: VistaImprimibleOut, estilo: EstiloImpresion): void {
    const iframe = this.marco?.nativeElement;
    const doc = iframe?.contentDocument;
    if (!iframe || !doc) return;
    // Se reescribe el documento en vez de usar srcdoc: srcdoc recarga el
    // iframe entero y la hoja parpadea con cada ajuste.
    const scroll = this.lienzo?.nativeElement.scrollTop ?? 0;
    doc.open();
    doc.write(renderDocumentoImpresion(datos, estilo, location.origin));
    doc.close();
    // El alto del body, no el del documento: el documento mide al menos lo
    // que el iframe, y el iframe crece con el alto medido.
    const medir = () => this.medir(doc);
    medir();
    doc.fonts?.ready.then(() => {
      medir();
      if (this.lienzo) this.lienzo.nativeElement.scrollTop = scroll;
    });
  }

  /**
   * Mide la hoja y reparte sus bloques (cabecera y secciones) en hojas igual
   * que la impresora: `break-inside: avoid` manda una sección entera a la
   * hoja siguiente si no cabe; solo una sección más alta que una hoja se
   * parte, y entonces por filas. La cabecera `.nueva-hoja` fuerza el salto.
   */
  private medir(doc: Document): void {
    const body = doc.body;
    const alto = Math.ceil(body.getBoundingClientRect().height);
    if (alto <= 0) return; // oculto (vista "Estilo" en móvil): se mide al volver
    this.altoContenido.set(alto);

    const util = this.altoUtilPx();
    const inicio = body.getBoundingClientRect().top + this.margenPx();
    const bloques = Array.from(body.querySelectorAll<HTMLElement>(':scope > header, :scope > .seccion'));
    const saltos: number[] = [];
    let hoja = 0;
    for (const b of bloques) {
      const r = b.getBoundingClientRect();
      const arriba = r.top - inicio;
      const abajo = r.bottom - inicio;
      // La 2.ª hoja (fin de semana y discursos) siempre empieza en papel nuevo.
      if (b.classList.contains('nueva-hoja') && arriba > hoja) {
        hoja = arriba;
        saltos.push(hoja);
        continue;
      }
      if (abajo - hoja <= util || util <= 0) continue;
      if (arriba > hoja && r.height <= util) {
        hoja = arriba;
        saltos.push(hoja);
      } else {
        const filas = Array.from(b.querySelectorAll<HTMLElement>('tbody tr'));
        for (const f of filas) {
          const fr = f.getBoundingClientRect();
          if (fr.bottom - inicio - hoja > util) {
            hoja = fr.top - inicio;
            saltos.push(hoja);
          }
        }
      }
    }
    this.saltos.set(saltos);
  }

  // ── Imprimir ───────────────────────────────────────────────

  async imprimir(): Promise<void> {
    if (this.estadoCarga() !== 'listo') return;
    const win = this.marco?.nativeElement.contentWindow;
    if (!win) return;
    // Que no salga con la fuente de reserva si aún no terminó de cargar.
    await win.document.fonts?.ready;
    win.focus();
    win.print();
  }

  // ── Edición del estilo ─────────────────────────────────────

  cambiar<K extends keyof EstiloImpresion>(clave: K, valor: EstiloImpresion[K]): void {
    const antes = this.estilo()[clave];
    this.estilo.update((e) => ({ ...e, [clave]: valor }));
    this.programarGuardado();
    // Los discursos del mes siguiente vienen del servidor.
    if (clave === 'incluir_mes_siguiente' && antes !== valor) this.cargar();
  }

  cambiarSeccion(clave: keyof SeccionesImpresion, valor: boolean): void {
    this.estilo.update((e) => ({ ...e, secciones: { ...e.secciones, [clave]: valor } }));
    this.programarGuardado();
  }

  /** El hex escrito a mano admite "1e3a6e", "#1E3A6E" o "#abc". */
  private normalizarHex(texto: string): string | null {
    let v = texto.trim().replace(/^#?/, '#').toLowerCase();
    if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + [...v.slice(1)].map((c) => c + c).join('');
    return /^#[0-9a-f]{6}$/.test(v) ? v : null;
  }

  private fijarColorTabla(clave: ClaveTabla, valor: string): void {
    this.estilo.update((e) => ({ ...e, colores_tablas: { ...e.colores_tablas, [clave]: valor } }));
    this.programarGuardado();
  }

  cambiarColorTabla(clave: ClaveTabla, valor: string): void {
    const v = this.normalizarHex(valor);
    if (v) this.fijarColorTabla(clave, v);
  }

  cambiarHexTabla(clave: ClaveTabla, input: HTMLInputElement): void {
    const v = this.normalizarHex(input.value);
    if (v) {
      this.fijarColorTabla(clave, v);
      input.value = v;
    } else {
      input.value = this.estilo().colores_tablas[clave];
    }
  }

  cambiarColorTexto(clave: 'color_titulo' | 'color_texto', valor: string): void {
    const v = this.normalizarHex(valor);
    if (v) this.cambiar(clave, v);
  }

  cambiarHexTexto(clave: 'color_titulo' | 'color_texto', input: HTMLInputElement): void {
    const v = this.normalizarHex(input.value);
    if (v) {
      this.cambiar(clave, v);
      input.value = v;
    } else {
      input.value = this.estilo()[clave];
    }
  }

  cambiarTitulo(valor: string): void {
    const limpio = valor.slice(0, 80);
    if (!limpio.trim()) return;
    this.cambiar('titulo', limpio);
  }

  aplicarPreset(p: PresetImpresion): void {
    this.estilo.update((e) => ({
      ...e,
      colores_tablas: { ...p.colores_tablas },
      color_titulo: p.color_titulo,
      color_texto: p.color_texto,
      encabezado_suave: !!p.encabezado_suave,
    }));
    this.programarGuardado();
  }

  valorNumero(c: CampoNumero): number {
    return this.estilo()[c.clave];
  }

  pasoNumero(c: CampoNumero, signo: 1 | -1): void {
    this.cambiar(c.clave, this.acotar(c, this.valorNumero(c) + signo * c.paso));
  }

  fijarNumero(c: CampoNumero, input: HTMLInputElement): void {
    const n = parseFloat(input.value.replace(',', '.'));
    const v = Number.isFinite(n) ? this.acotar(c, n) : this.valorNumero(c);
    input.value = String(v);
    this.cambiar(c.clave, v);
  }

  private acotar(c: CampoNumero, v: number): number {
    const redondeado = Math.round(v / c.paso) * c.paso;
    return Math.min(c.max, Math.max(c.min, Number(redondeado.toFixed(2))));
  }

  private programarGuardado(): void {
    if (!this.estiloCargado()) return;
    this.confirmandoReset.set(false);
    clearTimeout(this.temporizadorGuardado);
    this.guardado.set('guardando');
    this.temporizadorGuardado = setTimeout(() => {
      this.temporizadorGuardado = undefined;
      this.logisticaSvc.guardarEstiloImpresion(this.estilo(), this.cong()).subscribe({
        next: () => {
          this.porDefecto.set(false);
          this.guardado.set('guardado');
        },
        error: () => this.guardado.set('error'),
      });
    }, 700);
  }

  restablecer(): void {
    clearTimeout(this.temporizadorGuardado);
    this.temporizadorGuardado = undefined;
    const incluiaSiguiente = this.estilo().incluir_mes_siguiente;
    this.logisticaSvc.restablecerEstiloImpresion(this.cong()).subscribe({
      next: (r) => {
        this.estilo.set(r.estilo);
        this.porDefecto.set(true);
        this.confirmandoReset.set(false);
        this.guardado.set('guardado');
        if (incluiaSiguiente !== r.estilo.incluir_mes_siguiente) this.cargar();
      },
      error: () => this.guardado.set('error'),
    });
  }

  // ── Cierre, teclado y foco ─────────────────────────────────

  cerrar(): void {
    if (this.saliendo()) return;
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducido) {
      this.cerrado.emit();
      return;
    }
    this.saliendo.set(true);
    setTimeout(() => this.cerrado.emit(), 120);
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(ev: KeyboardEvent): void {
    if (ev.key === 'Escape') {
      // Un desplegable abierto (selector de mes) se cierra antes que el estudio.
      try {
        if (document.querySelector(':popover-open')) return;
      } catch { /* navegador sin :popover-open */ }
      ev.preventDefault();
      this.cerrar();
      return;
    }
    // Ctrl/⌘+P imprime la hoja, no la pantalla de la app.
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'p') {
      ev.preventDefault();
      this.imprimir();
      return;
    }
    if (ev.key === 'Tab') this.atraparFoco(ev);
  }

  private atraparFoco(ev: KeyboardEvent): void {
    const raiz = this.raiz?.nativeElement;
    if (!raiz) return;
    const enfocables = Array.from(
      raiz.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), summary, [href], select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => el.offsetParent !== null);
    if (!enfocables.length) return;
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (ev.shiftKey && document.activeElement === primero) {
      ev.preventDefault();
      ultimo.focus();
    } else if (!ev.shiftKey && document.activeElement === ultimo) {
      ev.preventDefault();
      primero.focus();
    }
  }
}
