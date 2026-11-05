import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeoJSONFeatureCollection } from '../models/territorio.model';
import { TerritorioMapComponent } from './territorio-map.component';
import { RenumeracionManzana } from '../services/territorios.service';
import { avisoNumeroRepetido, NumeracionManzanas, siguienteLibre } from '../utils/numeracion-manzanas.util';

interface ManzanaItem { id: number; numero: string; origen: string }
interface PuntoItem { id: number; nombre: string; tipo: string; notas: string }

const CLAVE_PLEGADO = 'gac.editorTerritorio.panelPlegado';

/**
 * Panel del editor cartográfico: guía los pasos 1-2-3, lista lo dibujado y ofrece, con botones de
 * texto, dibujar / ajustar / renombrar / mover / borrar. Habla con el mapa (`mapa`) para lo visual
 * y emite al padre lo que hay que guardar en el servidor.
 */
@Component({
  standalone: true,
  selector: 'app-editor-panel',
  imports: [CommonModule],
  template: `
  @if (mapa(); as m) {
  <aside class="flex flex-col min-h-0 bg-white dark:bg-slate-800 border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-700 transition-[width,height] duration-200"
         [class]="plegado() ? 'lg:w-14 h-14 lg:h-auto' : 'lg:w-[380px] h-[48dvh] lg:h-auto'">

    <button (click)="alternarPlegado()" type="button"
            class="shrink-0 flex items-center gap-2 px-4 h-14 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors"
            [attr.aria-expanded]="!plegado()">
      <svg class="w-5 h-5 shrink-0 transition-transform" [class.rotate-180]="plegado()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
      @if (!plegado()) { <span>Ocultar panel</span> } @else { <span class="lg:sr-only">Mostrar panel</span> }
    </button>

    @if (!plegado()) {
    <div class="flex-1 min-h-0 overflow-y-auto border-t border-slate-100 dark:border-slate-700/60 divide-y divide-slate-100 dark:divide-slate-700/60">

      <!-- ═════ 1 · Límite ═════ -->
      <section>
        <button (click)="m.setLayerMode('territorio')" type="button" class="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors" [attr.aria-expanded]="m.layerMode() === 'territorio'">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0" [class]="m.layerMode() === 'territorio' ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'">1</span>
          <span class="flex-1 text-base font-extrabold text-slate-900 dark:text-white">Límite del territorio</span>
          @if (m.tieneLimite()) { <span class="text-emerald-600 dark:text-emerald-400 text-sm font-bold">✓ Listo</span> }
        </button>
        @if (m.layerMode() === 'territorio') {
        <div class="px-4 pb-4 space-y-3">
          @if (m.eligiendoCuadras()) {
            <ol class="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-decimal pl-5">
              <li>Toque en el mapa las cuadras que forman el territorio. Se ponen verdes.</li>
              <li>Si mueve el mapa, pulse «Buscar cuadras aquí».</li>
              <li>Pulse «Listo, armar el límite».</li>
            </ol>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
              <span class="inline-flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded-sm bg-emerald-500/60 border border-emerald-700"></span>Elegida</span>
              <span class="inline-flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded-sm border border-dashed border-purple-600"></span>Sin elegir</span>
              <span class="inline-flex items-center gap-1.5"><span class="w-3.5 h-3.5 rounded-sm bg-slate-300 border border-slate-400"></span>De otra tarjeta</span>
            </div>
            <p class="text-base font-bold text-slate-800 dark:text-slate-100" aria-live="polite">
              {{ m.cuadrasCargando() ? 'Buscando cuadras…' : m.cuadrasElegidas() === 1 ? '1 cuadra elegida' : m.cuadrasElegidas() + ' cuadras elegidas' }}
            </p>
            @if (m.cuadrasCargando()) {
              <p class="text-sm text-slate-500 dark:text-slate-400 -mt-2">Si es la primera vez que se usa esta zona puede tardar casi un minuto: el mapa de calles es un servicio público y a veces va lento. Después queda guardada.</p>
            }
            @if (m.cuadrasDesactualizadas()) {
              <button (click)="m.buscarCuadrasAqui()" type="button" [disabled]="m.cuadrasCargando()" class="btn-sec w-full">Buscar cuadras aquí</button>
            }
            <button (click)="m.armarLimiteConCuadras()" type="button" [disabled]="m.cuadrasCargando() || m.cuadrasElegidas() === 0"
                    class="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 text-white text-base font-bold transition-colors active:scale-[0.98]">Listo, armar el límite</button>
            <button (click)="m.cancelarCuadras()" type="button" class="btn-sec w-full">Cancelar</button>
          } @else if (!m.tieneLimite()) {
            @if (m.drawingActive()) {
              <ol class="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-decimal pl-5">
                <li>Haga clic en cada esquina del territorio. El lápiz se pega a las calles.</li>
                <li>Doble clic en la última esquina para terminar.</li>
              </ol>
              <button (click)="m.cancelarDibujoActual()" type="button" class="btn-sec w-full">Cancelar dibujo</button>
            } @else {
              <p class="text-base font-bold text-slate-800 dark:text-slate-100">¿Cómo quiere marcar el límite?</p>

              <button (click)="m.empezarCuadras()" type="button"
                      class="w-full text-left rounded-xl border-2 border-green-500 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 p-4 transition-colors active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-green-500/30">
                <span class="flex items-center gap-3">
                  <span class="w-10 h-10 rounded-lg bg-green-600 text-white flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect><path d="M15 17.5l2 2 3.5-4"></path></svg>
                  </span>
                  <span class="flex-1 min-w-0">
                    <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span class="text-base font-extrabold text-slate-900 dark:text-white">Tocar las cuadras</span>
                      <span class="px-2 py-0.5 rounded-md bg-green-600 text-white text-xs font-bold">Recomendado</span>
                    </span>
                  </span>
                </span>
                <span class="block mt-2 text-sm text-slate-700 dark:text-slate-200">Toque cada cuadra que pertenece a la tarjeta. El borde se traza solo, por la mitad de las calles.</span>
                <span class="block mt-1 text-sm text-slate-500 dark:text-slate-400">Para barrios con calles y cuadras.</span>
              </button>

              <button (click)="m.empezarDibujo()" type="button"
                      class="w-full text-left rounded-xl border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700/50 p-4 transition-colors active:scale-[0.99] focus:outline-none focus-visible:ring-4 focus-visible:ring-green-500/30">
                <span class="flex items-center gap-3">
                  <span class="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0" aria-hidden="true">
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path></svg>
                  </span>
                  <span class="text-base font-extrabold text-slate-900 dark:text-white">Dibujar a mano</span>
                </span>
                <span class="block mt-2 text-sm text-slate-700 dark:text-slate-200">Haga clic en cada esquina del territorio.</span>
                <span class="block mt-1 text-sm text-slate-500 dark:text-slate-400">Para veredas o fincas sin calles en el mapa, o si el borde sigue un río o una cerca.</span>
              </button>
            }
          } @else {
            @if (m.realtimeArea()) { <p class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ m.realtimeArea() }}</p> }
            @if (m.editMode()) {
              <p class="text-sm text-slate-600 dark:text-slate-300">Arrastre las esquinas del mapa para corregir el contorno.</p>
              <button (click)="m.map?.pm?.disableGlobalEditMode()" type="button" class="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold transition-colors active:scale-[0.98]">Listo, terminé de ajustar</button>
            } @else {
              <div class="grid grid-cols-2 gap-2">
                <button (click)="m.alternarEdicion()" type="button" class="btn-sec">Ajustar esquinas</button>
                <button (click)="confirmarRedibujo.set(true)" type="button" class="btn-sec">Dibujar de nuevo</button>
              </div>
              <button (click)="m.empezarCuadras()" type="button" class="btn-sec w-full">Agregar o quitar cuadras</button>
            }
            @if (confirmarRedibujo()) {
              <div class="rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 p-3 space-y-2">
                <p class="text-sm font-semibold text-red-800 dark:text-red-200">¿Borrar el límite y dibujarlo otra vez?</p>
                <div class="flex gap-2">
                  <button (click)="redibujar(m)" type="button" class="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Sí, dibujar de nuevo</button>
                  <button (click)="confirmarRedibujo.set(false)" type="button" class="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">No</button>
                </div>
              </div>
            }
          }
          @if (geoSaveError()) {
            <p class="text-sm font-semibold text-red-600 dark:text-red-400 leading-snug" role="alert">{{ geoSaveError() }}</p>
          }
          <!-- Sin límite no hay nada que guardar: el botón solo confundiría («Límite guardado» sin haber dibujado). -->
          @if (limiteSinGuardar() || saving()) {
          <button (click)="guardarLimite.emit()" type="button" [disabled]="saving()"
                  class="w-full h-12 rounded-xl text-base font-bold transition-colors active:scale-[0.98] text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed">
            {{ saving() ? 'Guardando…' : 'Guardar límite' }}
          </button>
          } @else if (m.tieneLimite() && !m.editMode() && !m.eligiendoCuadras() && !m.drawingActive()) {
          <!-- El límite ya está guardado: lo que sigue es dibujar las manzanas. -->
          <button (click)="m.empezarManzana()" type="button"
                  class="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-base font-bold transition-colors active:scale-[0.98] inline-flex items-center justify-center gap-2">
            {{ manzanas().length ? 'Siguiente: dibujar otra manzana' : 'Siguiente: dibujar las manzanas' }}
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
          }
        </div>
        }
      </section>

      <!-- ═════ 2 · Manzanas ═════ -->
      <section>
        <button (click)="m.setLayerMode('manzana')" type="button" class="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors" [attr.aria-expanded]="m.layerMode() === 'manzana'">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0" [class]="m.layerMode() === 'manzana' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'">2</span>
          <span class="flex-1 text-base font-extrabold text-slate-900 dark:text-white">Manzanas</span>
          <span class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ manzanas().length }}</span>
        </button>
        @if (m.layerMode() === 'manzana') {
        <div class="px-4 pb-4 space-y-3">
          @if (m.drawingActive()) {
            <ol class="text-sm text-slate-600 dark:text-slate-300 space-y-1 list-decimal pl-5">
              <li>Haga clic en cada esquina de la manzana. El lápiz se pega a las calles.</li>
              <li>Doble clic en la última esquina para terminar.</li>
              <li>Confirme el número y se guarda.</li>
            </ol>
            <button (click)="m.cancelarDibujoActual()" type="button" class="btn-sec w-full">Cancelar dibujo</button>
          } @else {
            <button (click)="m.empezarManzana()" type="button" class="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-base font-bold transition-colors active:scale-[0.98]">{{ manzanas().length ? 'Dibujar otra manzana' : 'Dibujar una manzana' }}</button>
            @if (numeracion()) {
              <p class="text-sm text-slate-500 dark:text-slate-400 -mt-1">Le tocará el número {{ siguienteNumero() }} de la secuencia.</p>
            }
            <button (click)="m.detectarManzanas()" type="button" [disabled]="detectando() || m.extrayendo()" class="btn-sec w-full disabled:opacity-60">
              {{ detectando() || m.extrayendo() ? 'Buscando manzanas…' : 'Detectar manzanas automáticamente' }}
            </button>
          }

          @if (manzanas().length === 0) {
            <p class="text-sm text-slate-500 dark:text-slate-400">Todavía no hay manzanas. Dibuje la primera o use la detección automática.</p>
          } @else {
            @if (renumeracion(); as r) {
              <div class="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 p-3 space-y-2" role="status">
                @if (cambiosRenumeracion() === 0) {
                  <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">Las manzanas ya están en orden. No hay nada que cambiar.</p>
                  <button (click)="cancelarRenumeracion.emit()" type="button" class="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">Cerrar</button>
                } @else {
                  <p class="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    En el mapa se ven en naranja los números nuevos de esta tarjeta: {{ rangoPropio() }}, fila por fila desde arriba a la izquierda.
                  </p>
                  <p class="text-sm text-amber-900 dark:text-amber-100">
                    La secuencia sigue entre tarjetas (T01, T02…): cambian {{ cambiosRenumeracion() }} de {{ r.length }} manzanas en toda la congregación.
                  </p>
                  <div class="flex gap-2">
                    <button (click)="confirmarRenumeracion.emit()" type="button" [disabled]="renumerando()" class="flex-1 h-10 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold disabled:opacity-60">{{ renumerando() ? 'Guardando…' : 'Sí, cambiar los números' }}</button>
                    <button (click)="cancelarRenumeracion.emit()" type="button" class="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">No</button>
                  </div>
                }
              </div>
            } @else if (!m.drawingActive()) {
              <button (click)="renumerar.emit()" type="button" [disabled]="renumerando()" class="btn-sec w-full">{{ renumerando() ? 'Calculando…' : 'Numerar en secuencia' }}</button>
            }
            @if (hayDeIA()) {
              <p class="text-sm text-violet-800 dark:text-violet-200 rounded-lg bg-violet-50 dark:bg-violet-900/20 px-3 py-2">
                Las manzanas con borde punteado las marcó la IA. Revíselas: al ajustar su forma quedan como revisadas.
              </p>
            }
            <p class="text-sm text-slate-500 dark:text-slate-400">Toque una manzana, aquí o en el mapa, para corregirla o borrarla.</p>
            <ul class="space-y-1.5">
              @for (z of manzanas(); track z.id) {
                <li>
                  @if (esManzanaElegida(m, z.id)) {
                    <div class="rounded-xl border-2 border-blue-500 bg-blue-50/60 dark:bg-blue-900/20 p-3 space-y-3">
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-base font-extrabold text-slate-900 dark:text-white">Manzana {{ z.numero }}</p>
                        <button (click)="m.quitarSeleccion()" type="button" class="text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white px-2 h-9">Cerrar</button>
                      </div>
                      <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Número de la manzana
                        <div class="mt-1 flex gap-2">
                          <input type="text" [value]="numeroBorrador()" (input)="numeroBorrador.set($any($event.target).value)" (keydown.enter)="guardarNumero(z.id)"
                                 class="flex-1 min-w-0 h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-base font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          <button (click)="guardarNumero(z.id)" type="button" [disabled]="!numeroBorrador().trim() || numeroBorrador().trim() === z.numero || !!avisoNumero(z.id)"
                                  class="px-4 h-11 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 text-white text-sm font-bold">Guardar</button>
                        </div>
                      </label>
                      @if (avisoNumero(z.id); as aviso) {
                        <div class="space-y-1" role="alert">
                          <p class="text-sm font-semibold text-red-700 dark:text-red-300">{{ aviso }}</p>
                          <button type="button" (click)="numeroBorrador.set('' + siguienteLibre(z.id))" class="text-sm font-bold text-blue-700 dark:text-blue-300 underline">Usar el {{ siguienteLibre(z.id) }}</button>
                        </div>
                      }
                      @if (m.borrando()) {
                        <div class="rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 p-3 space-y-2">
                          <p class="text-sm font-semibold text-red-800 dark:text-red-200">¿Borrar la manzana {{ z.numero }}? No se puede deshacer.</p>
                          <div class="flex gap-2">
                            <button (click)="borrarManzana.emit(z.id); m.borrando.set(false)" type="button" class="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Sí, borrar</button>
                            <button (click)="m.borrando.set(false)" type="button" class="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">No</button>
                          </div>
                        </div>
                      } @else if (m.editandoForma()) {
                        <p class="text-sm text-slate-600 dark:text-slate-300">Arrastre las esquinas en el mapa y pulse «Listo, guardar».</p>
                      } @else {
                        <div class="grid grid-cols-2 gap-2">
                          <button (click)="m.ajustarForma()" type="button" class="btn-sec">Ajustar forma</button>
                          <button (click)="m.borrando.set(true)" type="button" class="btn-sec !text-red-700 dark:!text-red-300 !border-red-200 dark:!border-red-800/60">Borrar</button>
                        </div>
                      }
                    </div>
                  } @else {
                    <button (click)="m.seleccionar('manzana', z.id, true)" type="button" class="w-full flex items-center gap-3 px-3 h-12 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors">
                      <span class="min-w-8 h-8 px-1.5 rounded-lg bg-slate-600 text-white text-sm font-black flex items-center justify-center">{{ z.numero }}</span>
                      <span class="flex-1 text-base font-semibold text-slate-800 dark:text-slate-100">Manzana {{ z.numero }}</span>
                      @if (z.origen === 'ia') { <span class="px-2 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 text-xs font-bold">IA · revisar</span> }
                    </button>
                  }
                </li>
              }
            </ul>
          }
        </div>
        }
      </section>

      <!-- ═════ 3 · Puntos ═════ -->
      <section>
        <button (click)="m.setLayerMode('punto')" type="button" class="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors" [attr.aria-expanded]="m.layerMode() === 'punto'">
          <span class="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0" [class]="m.layerMode() === 'punto' ? 'bg-rose-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'">3</span>
          <span class="flex-1 text-base font-extrabold text-slate-900 dark:text-white">Puntos de salida y lugares</span>
          <span class="text-sm font-bold text-slate-500 dark:text-slate-400">{{ puntos().length }}</span>
        </button>
        @if (m.layerMode() === 'punto') {
        <div class="px-4 pb-4 space-y-3">
          @if (m.colocandoPunto()) {
            <p class="text-sm text-slate-600 dark:text-slate-300">Haga clic en el mapa donde va el punto.</p>
            <button (click)="m.detenerPunto()" type="button" class="btn-sec w-full">Terminar de poner puntos</button>
          } @else {
            <button (click)="m.empezarPunto()" type="button" class="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-base font-bold transition-colors active:scale-[0.98]">Poner un punto en el mapa</button>
          }

          @if (puntos().length === 0) {
            <p class="text-sm text-slate-500 dark:text-slate-400">Todavía no hay puntos. Marque, por ejemplo, el lugar donde se reúnen para salir.</p>
          } @else {
            <ul class="space-y-1.5">
              @for (p of puntos(); track p.id) {
                <li>
                  @if (esPuntoElegido(m, p.id)) {
                    <div class="rounded-xl border-2 border-rose-500 bg-rose-50/60 dark:bg-rose-900/20 p-3 space-y-3">
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-base font-extrabold text-slate-900 dark:text-white truncate">{{ p.nombre || 'Punto sin nombre' }}</p>
                        <button (click)="m.quitarSeleccion()" type="button" class="text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white px-2 h-9">Cerrar</button>
                      </div>
                      <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Nombre
                        <input type="text" [value]="pNombre()" (input)="pNombre.set($any($event.target).value)"
                               class="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
                      </label>
                      <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Tipo
                        <select [value]="pTipo()" (change)="pTipo.set($any($event.target).value)"
                                class="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500">
                          <option value="Salida" [selected]="pTipo() === 'Salida'">Salida</option>
                          <option value="Lugar" [selected]="pTipo() === 'Lugar'">Lugar de interés</option>
                          <option value="Otro" [selected]="pTipo() === 'Otro'">Otro</option>
                        </select>
                      </label>
                      <label class="block text-sm font-bold text-slate-700 dark:text-slate-200">Notas (opcional)
                        <input type="text" [value]="pNotas()" (input)="pNotas.set($any($event.target).value)"
                               class="mt-1 w-full h-11 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-base text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500" />
                      </label>
                      <button (click)="guardarPunto(p.id)" type="button" [disabled]="!pNombre().trim() || !puntoCambiado(p)"
                              class="w-full h-11 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 text-white text-sm font-bold">Guardar cambios</button>
                      @if (m.borrando()) {
                        <div class="rounded-lg border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/20 p-3 space-y-2">
                          <p class="text-sm font-semibold text-red-800 dark:text-red-200">¿Borrar este punto? No se puede deshacer.</p>
                          <div class="flex gap-2">
                            <button (click)="borrarPunto.emit(p.id); m.borrando.set(false)" type="button" class="flex-1 h-10 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold">Sí, borrar</button>
                            <button (click)="m.borrando.set(false)" type="button" class="flex-1 h-10 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-bold text-slate-700 dark:text-slate-200">No</button>
                          </div>
                        </div>
                      } @else if (m.editandoForma()) {
                        <p class="text-sm text-slate-600 dark:text-slate-300">Arrastre el punto en el mapa y pulse «Listo, guardar».</p>
                      } @else {
                        <div class="grid grid-cols-2 gap-2">
                          <button (click)="m.moverPunto()" type="button" class="btn-sec">Mover en el mapa</button>
                          <button (click)="m.borrando.set(true)" type="button" class="btn-sec !text-red-700 dark:!text-red-300 !border-red-200 dark:!border-red-800/60">Borrar</button>
                        </div>
                      }
                    </div>
                  } @else {
                    <button (click)="m.seleccionar('punto', p.id, true)" type="button" class="w-full flex items-center gap-3 px-3 h-12 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors">
                      <span class="w-8 h-8 rounded-lg bg-rose-600 text-white text-sm font-black flex items-center justify-center shrink-0">{{ p.tipo === 'Salida' ? 'S' : p.tipo === 'Lugar' ? 'L' : 'P' }}</span>
                      <span class="flex-1 min-w-0 truncate text-base font-semibold text-slate-800 dark:text-slate-100">{{ p.nombre || 'Punto sin nombre' }}</span>
                    </button>
                  }
                </li>
              }
            </ul>
          }
        </div>
        }
      </section>
    </div>
    }
  </aside>
  }
  `,
  styles: [`
    :host { display: contents; }
    .btn-sec {
      display: flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 12px;
      border-radius: 12px; border: 1px solid rgb(203 213 225); background: transparent;
      font-size: 14px; font-weight: 700; color: rgb(51 65 85); transition: background-color 120ms ease-out, transform 120ms;
    }
    .btn-sec:hover { background: rgb(248 250 252); }
    .btn-sec:active { transform: scale(0.98); }
    :host-context(.dark) .btn-sec { border-color: rgb(71 85 105); color: rgb(226 232 240); }
    :host-context(.dark) .btn-sec:hover { background: rgba(51,65,85,0.6); }
    @media (prefers-reduced-motion: reduce) { aside, .btn-sec { transition: none !important; } }
  `],
})
export class EditorPanelComponent {
  /** El mapa del editor: el panel lee sus señales (modo, selección, dibujo) y le pide las acciones visuales. */
  readonly mapa = input<TerritorioMapComponent | undefined>();
  readonly manzanasGeojson = input<GeoJSONFeatureCollection | null>(null);
  readonly puntosGeojson = input<GeoJSONFeatureCollection | null>(null);
  readonly limiteSinGuardar = input(false);
  readonly saving = input(false);
  readonly geoSaveError = input<string | null>(null);
  readonly detectando = input(false);
  /** Vista previa de la renumeración (null: no se está renumerando). */
  readonly renumeracion = input<RenumeracionManzana[] | null>(null);
  readonly renumerando = input(false);
  /** Números usados en toda la congregación (secuencia continua entre tarjetas). */
  readonly numeracion = input<NumeracionManzanas | null>(null);
  readonly idTerritorio = input<number | null>(null);

  readonly guardarLimite = output<void>();
  readonly renombrarManzana = output<{ id: number; numero: string }>();
  readonly borrarManzana = output<number>();
  readonly actualizarPunto = output<{ id: number; nombre: string; tipo: string; notas: string }>();
  readonly borrarPunto = output<number>();
  readonly renumerar = output<void>();
  readonly confirmarRenumeracion = output<void>();
  readonly cancelarRenumeracion = output<void>();

  private pasoAbierto = false;
  readonly plegado = signal(leerPlegado());
  readonly confirmarRedibujo = signal(false);
  readonly numeroBorrador = signal('');
  readonly pNombre = signal('');
  readonly pTipo = signal('Salida');
  readonly pNotas = signal('');

  readonly manzanas = computed<ManzanaItem[]>(() =>
    (this.manzanasGeojson()?.features ?? [])
      .filter((f: any) => f.id != null)
      .map((f: any) => ({ id: Number(f.id), numero: String(f.properties?.numero_manzana ?? ''), origen: String(f.properties?.origen ?? 'manual') }))
      .sort((a, b) => a.numero.localeCompare(b.numero, 'es', { numeric: true })),
  );

  readonly hayDeIA = computed(() => this.manzanas().some((z) => z.origen === 'ia'));
  /** «Del 5 al 10» para esta tarjeta dentro de la vista previa. */
  readonly rangoPropio = computed(() => {
    const mias = (this.renumeracion() ?? []).filter((f) => f.id_territorio === this.idTerritorio()).map((f) => Number(f.numero_manzana));
    if (!mias.length) return '';
    const [desde, hasta] = [Math.min(...mias), Math.max(...mias)];
    return desde === hasta ? `la manzana ${desde}` : `del ${desde} al ${hasta}`;
  });
  readonly cambiosRenumeracion = computed(() =>
    (this.renumeracion() ?? []).filter((r) => r.numero_anterior !== r.numero_manzana).length,
  );

  readonly puntos = computed<PuntoItem[]>(() =>
    (this.puntosGeojson()?.features ?? [])
      .filter((f: any) => f.id != null)
      .map((f: any) => ({
        id: Number(f.id),
        nombre: String(f.properties?.nombre ?? ''),
        tipo: String(f.properties?.tipo ?? 'Otro'),
        notas: String(f.properties?.notas ?? ''),
      })),
  );

  constructor() {
    // Con el límite ya guardado lo siguiente es dibujar manzanas: se abre el paso 2 una sola vez.
    effect(() => {
      const m = this.mapa();
      if (!m || this.pasoAbierto || !m.tieneLimite() || this.limiteSinGuardar()) return;
      this.pasoAbierto = true;
      untracked(() => { if (m.layerMode() === 'territorio') m.setLayerMode('manzana'); });
    });
    // Al elegir otra figura (o al recargar la lista) los campos parten de lo guardado.
    effect(() => {
      const sel = this.mapa()?.seleccion();
      const zs = this.manzanas();
      const ps = this.puntos();
      untracked(() => {
        this.confirmarRedibujo.set(false);
        if (sel?.tipo === 'manzana') this.numeroBorrador.set(zs.find((z) => z.id === sel.id)?.numero ?? '');
        if (sel?.tipo === 'punto') {
          const p = ps.find((x) => x.id === sel.id);
          this.pNombre.set(p?.nombre ?? '');
          this.pTipo.set(p?.tipo || 'Salida');
          this.pNotas.set(p?.notas ?? '');
        }
      });
    });
  }

  esManzanaElegida(m: TerritorioMapComponent, id: number): boolean {
    const s = m.seleccion();
    return s?.tipo === 'manzana' && s.id === id;
  }

  esPuntoElegido(m: TerritorioMapComponent, id: number): boolean {
    const s = m.seleccion();
    return s?.tipo === 'punto' && s.id === id;
  }

  puntoCambiado(p: PuntoItem): boolean {
    return this.pNombre().trim() !== p.nombre || this.pTipo() !== p.tipo || this.pNotas().trim() !== p.notas;
  }

  avisoNumero(id: number): string | null {
    return avisoNumeroRepetido(this.numeroBorrador(), this.numeracion(), this.idTerritorio(), id);
  }

  /** El número que le toca a la próxima manzana nueva. */
  siguienteNumero(): number {
    return siguienteLibre(this.numeracion());
  }

  siguienteLibre(_id: number): number {
    return siguienteLibre(this.numeracion());
  }

  guardarNumero(id: number): void {
    const numero = this.numeroBorrador().trim();
    if (numero && !this.avisoNumero(id)) this.renombrarManzana.emit({ id, numero });
  }

  guardarPunto(id: number): void {
    const nombre = this.pNombre().trim();
    if (nombre) this.actualizarPunto.emit({ id, nombre, tipo: this.pTipo(), notas: this.pNotas().trim() });
  }

  redibujar(m: TerritorioMapComponent): void {
    this.confirmarRedibujo.set(false);
    m.dibujarLimiteDeNuevo();
  }

  alternarPlegado(): void {
    this.plegado.update((v) => !v);
    try { localStorage.setItem(CLAVE_PLEGADO, this.plegado() ? '1' : '0'); } catch { /* sin almacenamiento */ }
  }
}

function leerPlegado(): boolean {
  try { return localStorage.getItem(CLAVE_PLEGADO) === '1'; } catch { return false; }
}

