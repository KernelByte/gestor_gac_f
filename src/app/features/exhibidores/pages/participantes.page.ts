import {
  AfterViewInit, Component, ElementRef, OnDestroy, OnInit, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import {
  PublicadorPickerComponent,
} from '../../../shared/components/publicador-picker/publicador-picker.component';
import { PublicadorLite } from '../../../shared/components/publicador-picker/publicador-lookup.service';
import { ExhibidoresTabsComponent } from '../components/exhibidores-tabs.component';
import { ExhibidoresService } from '../services/exhibidores.service';
import {
  AccionVinculo, DIAS_SEMANA_CORTO, FranjaDia, HistorialParticipante,
  MESES_ES, Participante, ParticipanteUpdate, TipoVinculo, UbicacionExhibidor, Vinculo,
} from '../models/exhibidor.model';

/** Las dos franjas marcadas = todo el día; es el default de una ficha nueva. */
const TODO_EL_DIA: readonly FranjaDia[] = ['manana', 'tarde'];

@Component({
  selector: 'app-participantes-exhibidores-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, PageHeaderComponent, ModalComponent,
    PublicadorPickerComponent, ExhibidoresTabsComponent,
  ],
  template: `
    <app-page-header class="shrink-0"
      title="Exhibidores"
      subtitle="Quién participa, su disponibilidad y las parejas que van juntas.">
      <!-- flex-1 solo en móvil: la cabecera apila sus acciones bajo el título
           y dos botones al 50% cada uno son un blanco cómodo para el pulgar.
           min-h-11 sube los 38px de btn-secondary al mínimo táctil de 44px. -->
      <button class="btn-secondary flex-1 md:flex-none justify-center min-h-11 md:min-h-0"
              (click)="abrirVinculos()">Vínculos</button>
      <button class="btn-secondary flex-1 md:flex-none justify-center min-h-11 md:min-h-0"
              (click)="abrirHistorial()">Historial</button>
    </app-page-header>

    <app-exhibidores-tabs class="shrink-0" />

    <!-- Buscador y resumen.
         En móvil el buscador va primero y a todo el ancho: con 109 publicadores
         es la vía real de llegar a alguien, y antes quedaba encogido contra el
         borde derecho por el ml-auto. order-last lo devuelve a la derecha en
         escritorio, donde los contadores sí se leen primero. -->
    <div class="shrink-0 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 mb-4 md:mb-5">
      <div class="relative md:order-last md:w-72">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none"
             fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
        </svg>
        <!-- text-base en móvil a propósito: Safari de iOS hace zoom automático
             al enfocar un input de menos de 16px y deja la página descuadrada. -->
        <input class="search-input min-h-11 md:min-h-0 text-base md:text-sm"
               type="search" placeholder="Buscar publicador…" aria-label="Buscar publicador"
               [ngModel]="filtro()" (ngModelChange)="filtro.set($event)" />
      </div>
      <div class="flex items-center gap-x-5 gap-y-1 flex-wrap md:mr-auto">
        <p class="flex items-baseline gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span class="data-num font-bold text-lg text-slate-900 dark:text-slate-100">{{ totalPublicadores() }}</span>
          total publicadores
        </p>
        <p class="flex items-baseline gap-2 text-sm text-slate-600 dark:text-slate-300">
          <span class="data-num font-bold text-lg text-slate-900 dark:text-slate-100">{{ totalExhibidores() }}</span>
          participantes activos
        </p>
      </div>
    </div>

    <!-- Skeleton -->
    <div *ngIf="cargando()" class="space-y-2">
      <div class="skeleton h-16 md:h-14 rounded-xl" *ngFor="let i of [1,2,3,4,5,6]"></div>
    </div>

    <!-- Sin resultados -->
    <div *ngIf="!cargando() && filtrados().length === 0" class="table-wrapper flex-1 min-h-0 flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <svg class="w-9 h-9 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"/>
      </svg>
      <p class="text-sm font-medium text-slate-500 dark:text-slate-400 text-balance">
        {{ filtro() ? 'Ningún publicador coincide con "' + filtro() + '".' : 'Aún no hay participantes registrados.' }}
      </p>
    </div>

    <!--
      Dos presentaciones del mismo listado. Cuál se usa lo decide el ancho REAL
      disponible (ver vistaTabla), no el de la ventana: la tabla necesita 916px
      para caber, y con media queries de viewport se mostraba ya desde 768px y
      se desbordaba. A 1024px era todavía peor, porque justo ahí aparece la
      barra lateral y el contenido baja a 660px — el viewport crece mientras el
      espacio real se encoge, así que ninguna media query lo puede acertar.

      Se elige con *ngIf y no ocultando una de las dos con CSS: son 109 filas,
      y renderizar las dos versiones dejaría en el DOM del celular una tabla
      completa que nadie va a ver, más su detección de cambios en cada toque.
    -->
    <div *ngIf="!cargando() && filtrados().length > 0"
         class="flex-1 min-h-0 flex flex-col mbp16:max-w-[1440px] mbp16:mx-auto mbp16:w-full">

      <!-- ══ Lista apilada (contenedor angosto: móvil, tablet y portátil con barra lateral) ══ -->
      <!-- max-w-3xl para que en 900px no quede un nombre a la izquierda y su
           interruptor perdido a 800px de distancia. Una lista de nombres no
           necesita más medida que ésa, y en móvil el tope no llega a actuar. -->
      <div *ngIf="!vistaTabla()" class="table-wrapper w-full max-w-3xl flex-1 min-h-0 flex flex-col">
        <!-- Rotula la columna de interruptores una sola vez, en vez de repetir
             una etiqueta en cada fila: conserva el modelo mental de la tabla
             sin el ruido de 109 rótulos iguales. -->
        <!-- pr-2 en vez de pr-4: el interruptor de cada fila lleva -mr-2 para
             que su blanco táctil llegue al borde, así que el rótulo necesita
             el mismo desplazamiento para quedar alineado justo encima de él. -->
        <div class="shrink-0 flex items-center justify-between gap-3 pl-4 pr-2 py-2.5
                    bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
          <span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-600 dark:text-slate-400">Publicador</span>
          <span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-600 dark:text-slate-400">Exhibidor</span>
        </div>

        <ul class="flex-1 min-h-0 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-slate-700/60">
          <li *ngFor="let p of filtrados()" class="px-4 py-3 transition-opacity"
              [class.opacity-50]="estaGuardandoInline(p.id_publicador)"
              [class.pointer-events-none]="estaGuardandoInline(p.id_publicador)">
            <div class="flex items-center gap-3">
              <!-- El nombre completo no se trunca aquí: en 390px de ancho un
                   "Ana Clara Hinestroza Palacio" cortado obliga a abrir la
                   ficha solo para saber de quién se trata. Que ocupe dos
                   líneas cuesta menos que ese viaje. -->
              <button type="button"
                      class="flex flex-1 min-w-0 items-center gap-3 text-left rounded-xl py-1 -my-1 focus-ring-blue active:opacity-70"
                      (click)="editar(p)" [attr.aria-label]="'Ver ficha de ' + p.nombre_completo">
                <span class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      [ngClass]="p.es_exhibidor ? 'bg-exh-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'">
                  {{ iniciales(p.nombre_completo) }}
                </span>
                <span class="min-w-0">
                  <span class="block text-[15px] font-semibold leading-snug text-slate-800 dark:text-slate-100">
                    {{ p.nombre_completo }}
                  </span>
                  <span *ngIf="p.es_exhibidor && !p.activo"
                        class="block mt-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">En pausa</span>
                </span>
              </button>

              <!-- Interruptor en vez de la insignia Sí/No de la tabla: el
                   blanco táctil pasa de 34x22 a 56x44 y el estado se lee sin
                   tener que descifrar una palabra de 11px. -->
              <button type="button" role="switch" [attr.aria-checked]="p.es_exhibidor"
                      class="relative shrink-0 grid place-items-center w-14 h-11 -mr-2 rounded-xl focus-ring-blue"
                      [attr.aria-label]="(p.es_exhibidor ? 'Quitar a' : 'Marcar a') + ' ' + p.nombre_completo + ' como exhibidor'"
                      (click)="toggleEsExhibidorInline(p)">
                <span class="block w-11 h-6 rounded-full transition-colors duration-200"
                      [ngClass]="p.es_exhibidor ? 'bg-exh-600' : 'bg-slate-200 dark:bg-slate-700'"></span>
                <span class="absolute left-2 w-5 h-5 rounded-full bg-white shadow-sm toggle-thumb"
                      [class.translate-x-5]="p.es_exhibidor"></span>
              </button>
            </div>

            <!-- Los ajustes solo aparecen para quien participa: quien no lo
                 hace se queda en una fila de 64px y la lista se recorre
                 rápido. Es la misma progresión que en escritorio, donde estas
                 celdas van vacías si no es exhibidor. -->
            <!-- max-w-md: la lista también se usa con 900px de ancho (portátil
                 con la barra lateral abierta). Sin tope, siete botones con
                 flex-1 se estirarían a 120px cada uno y el bloque de ajustes
                 se leería como una barra de herramientas, no como los ajustes
                 de esta persona. -->
            <div *ngIf="p.es_exhibidor" class="mt-3 space-y-2 max-w-md">
              <div class="flex gap-1" role="group" aria-label="Días en que puede salir">
                <button *ngFor="let d of diasCorto; let di = index" type="button"
                        class="flex-1 min-w-0 h-10 rounded-lg text-[11px] font-bold transition-colors
                               focus-ring-blue active:scale-95"
                        [ngClass]="diaDisponible(p, di)
                          ? 'bg-exh-100 text-exh-700 dark:bg-exh-950/70 dark:text-exh-300'
                          : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600'"
                        [attr.aria-pressed]="diaDisponible(p, di)"
                        [attr.aria-label]="d + (diaDisponible(p, di) ? ': disponible' : ': no disponible')"
                        (click)="toggleDiaInline(p, di)">
                  {{ d }}
                </button>
              </div>

              <div class="flex gap-2">
                <button type="button"
                        class="shrink-0 h-10 px-3.5 rounded-lg text-xs font-bold border transition-colors
                               focus-ring-blue active:scale-95"
                        [ngClass]="p.tiene_fluidez
                          ? 'bg-violet-100 border-violet-200 text-violet-700 dark:bg-violet-950/60 dark:border-violet-800/50 dark:text-violet-300'
                          : 'bg-transparent border-slate-200 text-slate-400 dark:border-slate-700 dark:text-slate-500'"
                        [attr.aria-pressed]="p.tiene_fluidez"
                        [attr.aria-label]="(p.tiene_fluidez ? 'Quitar' : 'Marcar') + ' fluidez a ' + p.nombre_completo"
                        (click)="toggleFluidezInline(p)">
                  Fluidez
                </button>
                <!-- Franja, tope de turnos, puntos vetados y notas se editan en
                     la ficha, que ya tiene controles de 44px. Aquí se muestra
                     el resumen para no obligar a abrirla solo por consultar. -->
                <button type="button"
                        class="flex-1 min-w-0 h-10 pl-3.5 pr-2.5 rounded-lg flex items-center justify-between gap-2
                               border border-slate-200 dark:border-slate-700 text-xs font-medium
                               text-slate-600 dark:text-slate-300 transition-colors focus-ring-blue active:scale-[0.98]"
                        (click)="editar(p)"
                        [attr.aria-label]="'Ajustar horario y turnos de ' + p.nombre_completo">
                  <span class="truncate">{{ resumenAjustes(p) }}</span>
                  <svg class="w-4 h-4 shrink-0 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5"/>
                  </svg>
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>

      <!-- ══ Tabla (contenedor ancho) ══ -->
      <div *ngIf="vistaTabla()" class="table-wrapper flex-1 min-h-0 flex flex-col">
      <div class="overflow-y-auto flex-1 min-h-0 custom-scrollbar">
        <table class="w-full border-collapse table-fixed">
          <!--
            table-fixed siempre: esta tabla solo se pinta cuando el contenedor
            pasa de 920px, así que ya hay espacio de sobra y el reparto
            automático del navegador estorba más que ayuda. Sin anchos fijos
            dejaba a "Franja" tan angosta que "Todo el día" partía en dos
            líneas, y en contenedores más anchos abría huecos absurdos entre
            columnas. Con anchos fijos, solo "Publicador" absorbe el espacio
            libre: es la única columna donde eso se ve intencional.
          -->
          <colgroup>
            <col />
            <col class="w-[92px]" />
            <col class="w-[92px]" />
            <col class="w-[220px]" />
            <col class="w-[104px]" />
            <col class="w-[122px]" />
            <col class="w-[96px]" />
          </colgroup>
          <thead class="sticky top-0 z-10">
            <tr>
              <th class="table-header-cell text-left">Publicador</th>
              <th class="table-header-cell text-center">Exhibidor</th>
              <th class="table-header-cell text-center">Fluidez</th>
              <th class="table-header-cell text-left">Días disponibles</th>
              <th class="table-header-cell text-left">Franja</th>
              <th class="table-header-cell text-center">Turnos/mes</th>
              <th class="table-header-cell text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let p of filtrados(); let i = index"
                [class]="i % 2 === 0 ? 'table-row' : 'table-row-alt'"
                [class.opacity-50]="estaGuardandoInline(p.id_publicador)"
                [class.pointer-events-none]="estaGuardandoInline(p.id_publicador)">
              <td class="table-cell">
                <!-- w-full es imprescindible con table-fixed: sin él el botón
                     se dimensiona por su contenido, se sale de la celda y el
                     truncate del nombre nunca llega a aplicarse — un nombre
                     largo terminaba pisando la insignia de la columna
                     Exhibidor cuando el contenedor ronda los 920px. -->
                <button type="button" class="flex w-full items-center gap-2.5 text-left group -my-1 py-1 rounded-lg
                               focus-ring-blue"
                        (click)="editar(p)" [attr.aria-label]="'Ver ficha de ' + p.nombre_completo">
                  <span class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        [ngClass]="p.es_exhibidor ? 'bg-exh-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'">
                    {{ iniciales(p.nombre_completo) }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <!-- title porque la columna recorta: en la tabla el nombre
                         es el único identificador y no debe quedar ilegible. -->
                    <p class="font-medium text-sm text-slate-800 dark:text-slate-200 truncate group-hover:text-exh-600 dark:group-hover:text-exh-400 group-hover:underline"
                       [title]="p.nombre_completo">
                      {{ p.nombre_completo }}
                    </p>
                    <p *ngIf="p.es_exhibidor && !p.activo" class="text-xs text-amber-600 dark:text-amber-400">En pausa</p>
                  </div>
                </button>
              </td>
              <td class="table-cell text-center">
                <button type="button" class="focus-ring-blue rounded-full transition-transform active:scale-90"
                        [attr.aria-pressed]="p.es_exhibidor"
                        [attr.aria-label]="(p.es_exhibidor ? 'Quitar a' : 'Marcar a') + ' ' + p.nombre_completo + ' como exhibidor'"
                        (click)="toggleEsExhibidorInline(p)">
                  <span *ngIf="p.es_exhibidor" class="badge-active">Sí</span>
                  <span *ngIf="!p.es_exhibidor" class="badge-neutral">No</span>
                </button>
              </td>
              <td class="table-cell text-center">
                <button type="button"
                        class="focus-ring-blue rounded-full transition-transform"
                        [class.active:scale-90]="p.es_exhibidor"
                        [class.cursor-not-allowed]="!p.es_exhibidor"
                        [disabled]="!p.es_exhibidor"
                        [attr.aria-pressed]="p.tiene_fluidez"
                        [attr.aria-label]="(p.tiene_fluidez ? 'Quitar' : 'Marcar') + ' fluidez a ' + p.nombre_completo"
                        (click)="toggleFluidezInline(p)">
                  <span *ngIf="p.tiene_fluidez" class="badge-role">Fluidez</span>
                  <span *ngIf="!p.tiene_fluidez" class="text-slate-300 dark:text-slate-600">—</span>
                </button>
              </td>
              <td class="table-cell">
                <div *ngIf="p.es_exhibidor" class="flex gap-1">
                  <button *ngFor="let d of diasCorto; let di = index" type="button"
                          class="w-6 h-6 rounded-md text-[10px] font-bold flex items-center justify-center
                                 transition-colors focus-ring-blue hover:ring-2 hover:ring-exh-300 dark:hover:ring-exh-700"
                          [ngClass]="diaDisponible(p, di)
                            ? 'bg-exh-100 text-exh-700 dark:bg-exh-950/70 dark:text-exh-300'
                            : 'bg-slate-100 text-slate-300 dark:bg-slate-800 dark:text-slate-600'"
                          [attr.aria-pressed]="diaDisponible(p, di)"
                          [attr.aria-label]="d + (diaDisponible(p, di) ? ': disponible' : ': no disponible')"
                          (click)="toggleDiaInline(p, di)">
                    {{ d[0] }}
                  </button>
                </div>
              </td>
              <td class="table-cell">
                <select *ngIf="p.es_exhibidor" class="inline-select-compact h-7 pl-2 pr-6 rounded-lg border
                               border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900
                               text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer
                               hover:border-slate-400 dark:hover:border-slate-500
                               focus:border-exh-600 dark:focus:border-exh-600 focus:ring-2 focus:ring-exh-600/20 transition-all"
                        [ngModel]="franjaSeleccionadaDe(p)" (ngModelChange)="cambiarFranjaInline(p, $event)"
                        [attr.aria-label]="'Horario en que puede salir: ' + p.nombre_completo">
                  <option *ngFor="let f of opcionesFranja" [value]="f.key">{{ f.label }}</option>
                </select>
              </td>
              <td class="table-cell text-center">
                <select *ngIf="p.es_exhibidor" class="inline-select-compact h-7 pl-2 pr-6 rounded-lg border
                               border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900
                               text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer
                               hover:border-slate-400 dark:hover:border-slate-500
                               focus:border-exh-600 dark:focus:border-exh-600 focus:ring-2 focus:ring-exh-600/20 transition-all"
                        [ngModel]="p.max_turnos_mes" (ngModelChange)="cambiarMaxTurnosInline(p, $event)"
                        [attr.aria-label]="'Turnos máximos al mes: ' + p.nombre_completo">
                  <option [ngValue]="null">Default</option>
                  <option *ngFor="let n of opcionesMaxTurnos" [ngValue]="n">{{ n }}</option>
                </select>
              </td>
              <td class="table-cell text-right">
                <button class="btn-icon-edit" (click)="editar(p)" aria-label="Editar participante">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Z"/>
                  </svg>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    </div>

    <!-- ══ Modal Ficha de participante ══ -->
    <app-modal [open]="modalFicha()" (openChange)="modalFicha.set($event)"
               [title]="editando()?.nombre_completo ?? ''"
               subtitle="Disponibilidad y reglas de esta persona." size="lg" [hasFooter]="true">
      <div class="space-y-5" *ngIf="editando()">
        <!-- Los tres interruptores en columna hasta sm: en una fila que envuelve,
             "Activo (desmarcar = pausa temporal)" se parte y deja al de al lado
             desalineado. En columna cada uno ocupa su renglón y el área
             pulsable de la etiqueta cubre el ancho entero. -->
        <div class="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-1 sm:gap-y-3">
          <label class="inline-flex items-center gap-2.5 min-h-11 sm:min-h-0 cursor-pointer select-none">
            <span class="relative inline-flex shrink-0">
              <input type="checkbox" class="peer sr-only" [(ngModel)]="ficha.es_exhibidor" />
              <span class="block w-9 h-5 rounded-full transition-colors duration-200
                           bg-slate-200 dark:bg-slate-700 peer-checked:bg-exh-600
                           peer-focus-visible:ring-2 peer-focus-visible:ring-exh-600 peer-focus-visible:ring-offset-2
                           dark:peer-focus-visible:ring-offset-slate-900"></span>
              <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm toggle-thumb
                           peer-checked:translate-x-4"></span>
            </span>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Participa en exhibidores</span>
          </label>
          <label class="inline-flex items-center gap-2.5 min-h-11 sm:min-h-0 select-none"
                 [class.cursor-pointer]="ficha.es_exhibidor" [class.cursor-not-allowed]="!ficha.es_exhibidor"
                 [class.opacity-40]="!ficha.es_exhibidor">
            <span class="relative inline-flex shrink-0">
              <input type="checkbox" class="peer sr-only" [(ngModel)]="ficha.tiene_fluidez"
                     [disabled]="!ficha.es_exhibidor" />
              <span class="block w-9 h-5 rounded-full transition-colors duration-200
                           bg-slate-200 dark:bg-slate-700 peer-checked:bg-exh-600
                           peer-focus-visible:ring-2 peer-focus-visible:ring-exh-600 peer-focus-visible:ring-offset-2
                           dark:peer-focus-visible:ring-offset-slate-900"></span>
              <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm toggle-thumb
                           peer-checked:translate-x-4"></span>
            </span>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Se expresa con fluidez</span>
          </label>
          <label class="inline-flex items-center gap-2.5 min-h-11 sm:min-h-0 select-none"
                 [class.cursor-pointer]="ficha.es_exhibidor" [class.cursor-not-allowed]="!ficha.es_exhibidor"
                 [class.opacity-40]="!ficha.es_exhibidor">
            <span class="relative inline-flex shrink-0">
              <input type="checkbox" class="peer sr-only" [(ngModel)]="ficha.activo"
                     [disabled]="!ficha.es_exhibidor" />
              <span class="block w-9 h-5 rounded-full transition-colors duration-200
                           bg-slate-200 dark:bg-slate-700 peer-checked:bg-exh-600
                           peer-focus-visible:ring-2 peer-focus-visible:ring-exh-600 peer-focus-visible:ring-offset-2
                           dark:peer-focus-visible:ring-offset-slate-900"></span>
              <span class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm toggle-thumb
                           peer-checked:translate-x-4"></span>
            </span>
            <span class="text-sm font-medium text-slate-700 dark:text-slate-300">Activo <span class="text-slate-400 font-normal">(desmarcar = pausa temporal)</span></span>
          </label>
        </div>

        <div [class.opacity-40]="!ficha.es_exhibidor" [class.pointer-events-none]="!ficha.es_exhibidor">
          <label class="form-label">Días en que puede salir <span class="text-slate-400 font-normal">(ninguno = todos)</span></label>
          <!-- flex-1 en vez de w-10 fijo: reparte el ancho real disponible, así
               en un móvil de 360px los siete botones siguen midiendo 44px de
               alto y ocupan la fila completa sin desbordarse. -->
          <div class="flex gap-1.5 mt-1">
            <button *ngFor="let d of diasCorto; let i = index"
                    class="flex-1 min-w-0 sm:flex-none sm:w-11 h-11 rounded-xl text-xs font-bold transition-colors focus-ring-blue active:scale-95"
                    [ngClass]="(ficha.dias.length === 0 || ficha.dias.includes(i))
                      ? 'bg-exh-600 text-white'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'"
                    (click)="toggleDia(i)">
              {{ d }}
            </button>
          </div>

          <div class="mt-4">
            <label class="form-label" id="franja-label">Horario en que puede salir</label>
            <!--
              Un solo grupo de 3 opciones excluyentes (Mañana / Tarde / Libre)
              en vez de dos interruptores independientes donde "las dos
              marcadas" significaba "todo el día": eso obligaba a explicar la
              regla con texto. Con 3 botones donde solo uno queda activo a la
              vez, la opción se entiende con solo mirarla — mismo patrón que
              "Días en que puede salir" arriba, así que no hay que aprender
              una interacción nueva. Objetivo táctil de 44px (h-11) para uso
              cómodo en celular, no solo con mouse en desktop.
            -->
            <div class="flex gap-1.5 mt-1" role="radiogroup" aria-labelledby="franja-label">
              <button *ngFor="let f of opcionesFranja" type="button"
                      role="radio"
                      class="flex-1 sm:flex-initial px-4 h-11 rounded-xl text-xs font-bold transition-colors focus-ring-blue"
                      [ngClass]="franjaSeleccionada() === f.key
                        ? 'bg-exh-600 text-white'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'"
                      [attr.aria-checked]="franjaSeleccionada() === f.key"
                      (click)="seleccionarFranja(f.key)">
                {{ f.label }}
              </button>
            </div>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              {{ descripcionFranja() }}
            </p>
          </div>

          <div class="mt-4">
            <label class="form-label">Máx. turnos al mes</label>
            <select class="form-select min-h-11" [(ngModel)]="ficha.max_turnos_mes">
              <option [ngValue]="null">Default del sistema</option>
              <option *ngFor="let n of opcionesMaxTurnos" [ngValue]="n">{{ n }}</option>
            </select>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
              Sugerido: {{ semanasEsteMes }} — {{ nombreMesActual }} tiene {{ semanasEsteMes }} semanas.
              Ajústalo si esta persona puede salir más o menos seguido.
            </p>
          </div>

          <div class="mt-4">
            <label class="form-label">Puntos vetados <span class="text-slate-400 font-normal">(no se le asignan)</span></label>
            <div class="flex flex-wrap gap-2 mt-1">
              <button *ngFor="let u of ubicaciones()"
                      class="px-3.5 min-h-10 sm:min-h-0 sm:py-1.5 rounded-full text-xs font-medium border transition-colors focus-ring-blue active:scale-95"
                      [ngClass]="ficha.vetadas.includes(u.id_ubicacion_exhibidor)
                        ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950/50 dark:border-red-800 dark:text-red-300'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300'"
                      (click)="toggleVeto(u.id_ubicacion_exhibidor)">
                {{ u.nombre }}
              </button>
            </div>
          </div>

          <div class="mt-4">
            <label class="form-label">Notas</label>
            <textarea class="form-control" rows="2" [(ngModel)]="ficha.notas"
                      placeholder="Ej. prefiere salir con su hermana"></textarea>
          </div>
        </div>
      </div>
      <!-- En el pie fijo del modal, no al final del cuerpo: la ficha es más
           alta que la pantalla de un móvil, así que antes había que recorrer
           todo el formulario hasta abajo cada vez solo para pulsar Guardar. -->
      <ng-container slot="footer">
        <button class="btn-secondary flex-1 sm:flex-none justify-center min-h-11 sm:min-h-0"
                (click)="modalFicha.set(false)">Cancelar</button>
        <button class="btn-primary-blue flex-1 sm:flex-none justify-center min-h-11 sm:min-h-0"
                [disabled]="guardando()" (click)="guardarFicha()">
          {{ guardando() ? 'Guardando…' : 'Guardar' }}
        </button>
      </ng-container>
    </app-modal>

    <!-- ══ Modal Vínculos ══ -->
    <app-modal [open]="modalVinculos()" (openChange)="modalVinculos.set($event)"
               title="Vínculos entre personas"
               subtitle="Matrimonios o hermanos que salen juntos, y personas que no deben coincidir."
               size="lg" [hasFooter]="true">
      <div *ngIf="vinculos().length > 0" class="space-y-2 mb-5 max-h-[38vh] sm:max-h-52 overflow-y-auto custom-scrollbar">
        <div *ngFor="let v of vinculos()"
             class="flex items-center justify-between gap-2 sm:gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
          <div class="min-w-0">
            <!-- Sin truncate: con dos nombres completos en 358px se cortaba
                 justo el segundo, que es la mitad que da sentido al vínculo. -->
            <p class="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-200">
              {{ v.publicador_a.nombre_completo }} <span class="font-normal text-slate-400 dark:text-slate-500">y</span> {{ v.publicador_b.nombre_completo }}
            </p>
            <p class="flex items-center gap-1.5 mt-1">
              <span class="inline-flex items-center gap-1 text-xs font-semibold"
                    [ngClass]="accionDe(v.accion).textClass">
                <span class="w-1.5 h-1.5 rounded-full" [ngClass]="accionDe(v.accion).dotClass"></span>
                {{ accionDe(v.accion).label }}
              </span>
              <span class="badge-neutral !text-[10px] shrink-0">{{ etiquetaTipo(v.tipo) }}</span>
            </p>
          </div>
          <button class="btn-icon-delete shrink-0 !p-2.5 sm:!p-1.5" (click)="eliminarVinculo(v)"
                  [attr.aria-label]="'Eliminar vínculo entre ' + v.publicador_a.nombre_completo + ' y ' + v.publicador_b.nombre_completo">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
      <div *ngIf="vinculos().length === 0"
           class="mb-5 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-6 text-center">
        <p class="text-sm text-slate-400 dark:text-slate-500">Todavía no hay vínculos configurados.</p>
      </div>

      <!--
        Formulario guiado en 3 pasos en vez de dos <select> genéricos: la
        audiencia de esta pantalla incluye coordinadores mayores o con poca
        práctica en sistemas, así que se prioriza reconocer sobre recordar
        (elegir de opciones grandes y visibles, no leer un desplegable de una
        sola línea) y se cierra con una frase en español llano que confirma
        justo lo que se va a guardar antes de tocar "Crear vínculo".
      -->
      <div class="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
        <p class="eyebrow mb-3">Nuevo vínculo</p>

        <label class="form-label">Paso 1 — ¿Quiénes van juntos?</label>
        <div class="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-2 sm:gap-3 sm:items-center mt-1">
          <app-publicador-picker class="min-w-0" [idCongregacion]="idCong" colorScheme="blue" [showMeta]="false"
                                 placeholder="Primera persona…"
                                 [ngModel]="nuevoVinculo.a?.nombre_completo ?? null"
                                 (seleccionado)="nuevoVinculo.a = $event" />
          <span class="hidden sm:block text-center text-xs font-bold text-slate-300 dark:text-slate-600">Y</span>
          <app-publicador-picker class="min-w-0" [idCongregacion]="idCong" colorScheme="blue" [showMeta]="false"
                                 placeholder="Segunda persona…"
                                 [ngModel]="nuevoVinculo.b?.nombre_completo ?? null"
                                 (seleccionado)="nuevoVinculo.b = $event" />
        </div>

        <label class="form-label mt-4 block">Paso 2 — ¿Qué relación tienen?</label>
        <div class="flex gap-1.5 mt-1">
          <button *ngFor="let t of tiposVinculo" type="button"
                  class="flex-1 px-3 h-11 rounded-xl text-xs font-bold transition-colors focus-ring-blue"
                  [ngClass]="nuevoVinculo.tipo === t.key
                    ? 'bg-exh-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'"
                  [attr.aria-pressed]="nuevoVinculo.tipo === t.key"
                  (click)="nuevoVinculo.tipo = t.key">
            {{ t.label }}
          </button>
        </div>

        <label class="form-label mt-4 block">Paso 3 — ¿Cómo deben salir?</label>
        <div class="flex gap-1.5 mt-1">
          <button *ngFor="let ac of accionesVinculo" type="button"
                  class="flex-1 min-w-0 px-2 h-11 rounded-xl text-xs font-bold truncate transition-colors focus-ring-blue"
                  [ngClass]="nuevoVinculo.accion === ac.key
                    ? ac.borderActiveClass + ' ' + ac.bgActiveClass + ' border-2 ' + ac.textClass
                    : 'border-2 border-transparent bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'"
                  [attr.aria-pressed]="nuevoVinculo.accion === ac.key"
                  (click)="nuevoVinculo.accion = ac.key">
            {{ ac.shortLabel }}
          </button>
        </div>
        <p class="text-xs text-slate-400 dark:text-slate-500 mt-1.5">{{ accionDe(nuevoVinculo.accion).desc }}</p>

        <!-- Confirmación en lenguaje llano de lo que se va a guardar. -->
        <div *ngIf="nuevoVinculo.a && nuevoVinculo.b"
             class="flex items-start gap-2 mt-4 rounded-xl bg-exh-50 dark:bg-exh-950/30 px-3.5 py-3">
          <svg class="w-4 h-4 mt-0.5 shrink-0 text-exh-600 dark:text-exh-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
          </svg>
          <p class="text-sm text-slate-700 dark:text-slate-300">{{ resumenNuevoVinculo() }}</p>
        </div>
      </div>

      <ng-container slot="footer">
        <button class="btn-primary-blue flex-1 sm:flex-none justify-center min-h-11 sm:min-h-0"
                [disabled]="!nuevoVinculo.a || !nuevoVinculo.b || guardando()"
                (click)="crearVinculo()">
          {{ guardando() ? 'Creando…' : 'Crear vínculo' }}
        </button>
      </ng-container>
    </app-modal>

    <!-- ══ Modal Historial ══ -->
    <app-modal [open]="modalHistorial()" (openChange)="modalHistorial.set($event)"
               title="Historial y equidad"
               subtitle="Salidas acumuladas por participante — útil para detectar desequilibrios."
               size="lg">
      <div *ngIf="historial().length === 0"
           class="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-8 text-center">
        <p class="text-sm text-slate-400 dark:text-slate-500">Todavía no hay salidas registradas.</p>
      </div>

      <!-- Cuatro columnas no caben en el ancho de un móvil, y una tabla con
           scroll horizontal dentro de un modal con scroll vertical es de lo
           más incómodo que hay. Debajo de sm: los mismos datos en dos
           renglones por persona; el número de salidas, que es lo que se viene
           a comparar, queda alineado a la derecha para poder recorrerlo en
           vertical de un vistazo. -->
      <ul *ngIf="historial().length > 0"
          class="sm:hidden max-h-[55vh] overflow-y-auto custom-scrollbar rounded-xl border border-gray-200 dark:border-slate-700
                 divide-y divide-gray-100 dark:divide-slate-700/60">
        <li *ngFor="let h of historial()" class="flex items-baseline justify-between gap-3 px-4 py-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-200">{{ h.nombre_completo }}</p>
            <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span class="data-num">{{ h.puntos_distintos }}</span> puntos distintos
              <span class="text-slate-300 dark:text-slate-600">·</span>
              última: <span class="data-num">{{ h.ultima_salida ?? 'nunca' }}</span>
            </p>
          </div>
          <p class="shrink-0 text-right">
            <span class="data-num text-lg font-bold text-slate-900 dark:text-slate-100">{{ h.total_salidas }}</span>
            <span class="block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">salidas</span>
          </p>
        </li>
      </ul>

      <div *ngIf="historial().length > 0" class="hidden sm:block table-wrapper max-h-[55vh] overflow-y-auto custom-scrollbar">
        <table class="w-full">
          <thead class="sticky top-0 z-10">
            <tr>
              <th class="table-header-cell text-left">Participante</th>
              <th class="table-header-cell text-center">Salidas</th>
              <th class="table-header-cell text-center">Puntos distintos</th>
              <th class="table-header-cell text-right">Última salida</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let h of historial(); let i = index"
                [class]="i % 2 === 0 ? 'table-row' : 'table-row-alt'">
              <td class="table-cell text-sm font-medium text-slate-800 dark:text-slate-200">{{ h.nombre_completo }}</td>
              <td class="table-cell text-center data-num">{{ h.total_salidas }}</td>
              <td class="table-cell text-center data-num">{{ h.puntos_distintos }}</td>
              <td class="table-cell text-right data-num text-sm text-slate-500 dark:text-slate-400">
                {{ h.ultima_salida ?? 'Nunca' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </app-modal>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    /* Reserva el ancho del scrollbar SIEMPRE, aparezca o no: si no, la tabla
       con table-fixed se mide sin él, el scrollbar aparece después y empuja
       la última columna (Acciones) fuera de vista por esos ~15px. */
    .custom-scrollbar { scrollbar-gutter: stable; }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; }
    :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #64748b; }

    /* Select compacto para editar franja y turnos/mes sin abrir la ficha
       (mismo patrón de "priv-select" que usan otras tablas, pero con la
       flecha a juego con el resto de esta pantalla). Solo vive en la vista de
       tabla, o sea con 920px o más de contenedor; en la vista apilada esos
       dos ajustes se resumen en una línea y se editan desde la ficha, con
       controles de 44px. */
    .inline-select-compact {
      appearance: none;
      background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8' stroke-width='2'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e");
      background-position: right 0.35rem center;
      background-repeat: no-repeat;
      background-size: 0.9rem;
    }
  `],
})
export class ParticipantesExhibidoresPage implements OnInit, AfterViewInit, OnDestroy {
  private svc = inject(ExhibidoresService);
  private ctx = inject(CongregacionContextService);
  private toast = inject(ToastService);
  private host = inject(ElementRef<HTMLElement>);

  readonly diasCorto = DIAS_SEMANA_CORTO;

  /**
   * Ancho a partir del cual la tabla vale la pena. Caber, cabe desde 916px
   * (las seis columnas de ancho fijo suman 726 y "Publicador" se queda con el
   * resto), pero con 190px esa columna corta nombres como "Ana Clara
   * Hinestroza Palacio" en "Ana Clara Hine…" mientras las cuatro columnas de
   * la derecha están vacías para quien no es exhibidor. A 1000px la columna
   * llega a 274px y los nombres se leen enteros; por debajo gana la lista
   * apilada, que nunca los corta.
   */
  private static readonly ANCHO_MINIMO_TABLA = 1000;

  /**
   * Ancho real del área de contenido, medido — no deducido del viewport. La
   * barra lateral aparece a 1024px y se puede colapsar, así que el mismo
   * viewport da anchos muy distintos y ninguna media query lo puede saber.
   */
  private anchoDisponible = signal(0);
  private observador?: ResizeObserver;

  vistaTabla = computed(() =>
    this.anchoDisponible() >= ParticipantesExhibidoresPage.ANCHO_MINIMO_TABLA);

  cargando = signal(true);
  guardando = signal(false);
  participantes = signal<Participante[]>([]);
  ubicaciones = signal<UbicacionExhibidor[]>([]);
  vinculos = signal<Vinculo[]>([]);
  historial = signal<HistorialParticipante[]>([]);
  filtro = signal('');

  modalFicha = signal(false);
  editando = signal<Participante | null>(null);
  ficha = this.fichaVacia();

  /**
   * 3 opciones excluyentes en la UI (Mañana / Tarde / Libre), aunque el
   * modelo de datos solo conoce 'manana'/'tarde' (ver FranjaDia): "Libre" es
   * las dos a la vez, no un tercer valor propio — el coordinador no necesita
   * saber eso, solo elegir una de tres tarjetas. El backend clasifica cada
   * turno del mes en una de las dos franjas reales por su punto medio (ver
   * engine/franjas.py), así que no hay horarios "entre medias" que dejen a
   * alguien fuera sin que se note.
   */
  readonly opcionesFranja: { key: 'manana' | 'tarde' | 'libre'; label: string }[] = [
    { key: 'manana', label: 'Mañana' },
    { key: 'tarde', label: 'Tarde' },
    { key: 'libre', label: 'Libre' },
  ];

  /** Mismas opciones para el select de la ficha y el select rápido de la tabla. */
  readonly opcionesMaxTurnos = [1, 2, 3, 4, 5, 6, 8, 10];

  /** Nº de semanas del mes actual, para sugerir un tope razonable de turnos. */
  readonly semanasEsteMes = (() => {
    const hoy = new Date();
    const diasDelMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
    return Math.ceil(diasDelMes / 7);
  })();
  readonly nombreMesActual = MESES_ES[new Date().getMonth()];

  modalVinculos = signal(false);
  nuevoVinculo: { a: PublicadorLite | null; b: PublicadorLite | null; tipo: TipoVinculo; accion: AccionVinculo } = {
    a: null, b: null, tipo: 'matrimonio', accion: 'siempre_juntos',
  };

  readonly tiposVinculo: { key: TipoVinculo; label: string }[] = [
    { key: 'matrimonio', label: 'Matrimonio' },
    { key: 'hermanos', label: 'Hermanos' },
    { key: 'otro', label: 'Otro' },
  ];

  /**
   * Mismos 3 colores que ya usa la lista de vínculos (verde/azul/rojo) y las
   * "notas" de la ficha — para alguien con poca práctica en sistemas, el
   * color + el punto de color son un atajo más rápido que leer la palabra,
   * y la frase de abajo evita tener que adivinar qué significa cada opción.
   */
  readonly accionesVinculo: {
    key: AccionVinculo; label: string; shortLabel: string; desc: string;
    dotClass: string; textClass: string; borderActiveClass: string; bgActiveClass: string;
  }[] = [
    {
      key: 'siempre_juntos', label: 'Siempre juntos', shortLabel: 'Siempre',
      desc: 'Se les asigna el mismo turno cada vez, sin excepción.',
      dotClass: 'bg-green-500', textClass: 'text-green-700 dark:text-green-400',
      borderActiveClass: 'border-green-400 dark:border-green-600',
      bgActiveClass: 'bg-green-50 dark:bg-green-950/30',
    },
    {
      key: 'preferir_juntos', label: 'Preferir juntos', shortLabel: 'Preferir',
      desc: 'Se procura ponerlos en el mismo turno, pero no es obligatorio.',
      dotClass: 'bg-exh-500', textClass: 'text-exh-700 dark:text-exh-400',
      borderActiveClass: 'border-exh-400 dark:border-exh-600',
      bgActiveClass: 'bg-exh-50 dark:bg-exh-950/30',
    },
    {
      key: 'nunca_juntos', label: 'Nunca juntos', shortLabel: 'Nunca',
      desc: 'Jamás se les asigna el mismo turno.',
      dotClass: 'bg-red-500', textClass: 'text-red-700 dark:text-red-400',
      borderActiveClass: 'border-red-400 dark:border-red-600',
      bgActiveClass: 'bg-red-50 dark:bg-red-950/30',
    },
  ];

  modalHistorial = signal(false);

  totalPublicadores = computed(() => this.participantes().length);
  totalExhibidores = computed(() => this.participantes().filter(p => p.es_exhibidor && p.activo).length);

  filtrados = computed(() => {
    const q = this.filtro().trim().toLowerCase();
    const lista = [...this.participantes()].sort((a, b) =>
      Number(b.es_exhibidor) - Number(a.es_exhibidor)
      || a.nombre_completo.localeCompare(b.nombre_completo));
    if (!q) return lista;
    return lista.filter(p => p.nombre_completo.toLowerCase().includes(q));
  });

  get idCong(): number | null {
    return this.ctx.effectiveCongregacionId();
  }

  // ── Edición rápida desde el listado ─────────────────────────
  // El objetivo es agilizar la configuración masiva: Exhibidor, Fluidez y
  // Días se guardan al toque, sin abrir la ficha. Lo que necesita más
  // contexto (franja horaria con su explicación, tope de turnos, puntos
  // vetados, notas) se queda en la ficha — cabe mal en una celda y son
  // ajustes puntuales, no algo que se repita fila tras fila.
  private guardandoInline = signal<ReadonlySet<number>>(new Set());

  estaGuardandoInline(idPublicador: number): boolean {
    return this.guardandoInline().has(idPublicador);
  }

  private actualizarInline(p: Participante, cambios: Partial<Participante>): void {
    const anterior = { ...p };
    const actualizado = { ...p, ...cambios };

    this.participantes.update(lista =>
      lista.map(x => x.id_publicador === p.id_publicador ? actualizado : x));
    this.guardandoInline.update(s => new Set(s).add(p.id_publicador));

    const payload: ParticipanteUpdate = {
      es_exhibidor: actualizado.es_exhibidor,
      tiene_fluidez: actualizado.tiene_fluidez,
      dias_disponibles: actualizado.dias_disponibles,
      franjas: actualizado.franjas,
      max_turnos_mes: actualizado.max_turnos_mes,
      notas: actualizado.notas,
      activo: actualizado.activo,
      ubicaciones_vetadas: actualizado.ubicaciones_vetadas,
    };

    this.svc.guardarParticipante(p.id_publicador, payload, this.idCong).subscribe({
      next: () => {
        this.guardandoInline.update(s => { const n = new Set(s); n.delete(p.id_publicador); return n; });
      },
      error: err => {
        this.guardandoInline.update(s => { const n = new Set(s); n.delete(p.id_publicador); return n; });
        this.participantes.update(lista =>
          lista.map(x => x.id_publicador === p.id_publicador ? anterior : x));
        this.toast.error('Error al guardar', err?.error?.detail ?? 'Inténtalo de nuevo.');
      },
    });
  }

  /**
   * Activar (no desactivar) a alguien sin días configurados abre la ficha de
   * una vez: un arreglo de días vacío significa "todos" para el sistema
   * (backend incluido), así que dejarlo así en silencio equivale a decir
   * "disponible cualquier día" sin que nadie lo haya decidido. Forzar la
   * elección aquí es más barato que arrastrar ese default incorrecto hasta la
   * programación real. Si ya tenía datos (se había desactivado y se
   * reactiva), el toggle sigue siendo instantáneo, sin abrir nada.
   */
  toggleEsExhibidorInline(p: Participante): void {
    const activando = !p.es_exhibidor;
    const sinConfigurar = p.dias_disponibles.length === 0;
    this.actualizarInline(p, { es_exhibidor: activando });
    if (activando && sinConfigurar) {
      this.editar({ ...p, es_exhibidor: true });
    }
  }

  toggleFluidezInline(p: Participante): void {
    if (!p.es_exhibidor) return;
    this.actualizarInline(p, { tiene_fluidez: !p.tiene_fluidez });
  }

  /**
   * Togglea contra lo que el coordinador VE resaltado (diaDisponible, donde
   * lista vacía = "todos"), no contra el arreglo crudo: si no, apagar un día
   * resaltado por venir de una lista vacía dejaría encendido solo ESE día en
   * vez de los otros seis, justo lo contrario de lo que se acaba de pedir.
   */
  toggleDiaInline(p: Participante, dia: number): void {
    if (!p.es_exhibidor) return;
    const dias = this.diaDisponible(p, dia)
      ? (p.dias_disponibles.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : p.dias_disponibles).filter(d => d !== dia)
      : [...p.dias_disponibles, dia].sort();
    this.actualizarInline(p, { dias_disponibles: dias });
  }

  /** Misma lógica que franjaSeleccionada(), pero para una fila de la tabla en vez de la ficha abierta. */
  franjaSeleccionadaDe(p: Participante): 'manana' | 'tarde' | 'libre' {
    return p.franjas.length === 1 ? p.franjas[0] : 'libre';
  }

  cambiarFranjaInline(p: Participante, opcion: 'manana' | 'tarde' | 'libre'): void {
    if (!p.es_exhibidor) return;
    const franjas: FranjaDia[] = opcion === 'libre' ? [...TODO_EL_DIA] : [opcion];
    this.actualizarInline(p, { franjas });
  }

  cambiarMaxTurnosInline(p: Participante, valor: number | null): void {
    if (!p.es_exhibidor) return;
    this.actualizarInline(p, { max_turnos_mes: valor });
  }

  ngOnInit(): void {
    this.cargar();
  }

  /**
   * La primera medición llega mucho antes que los datos (la lista no se pinta
   * hasta que responde la API), así que no hay un parpadeo de lista-y-luego-
   * tabla: cuando hay filas que mostrar, el ancho ya se conoce.
   */
  ngAfterViewInit(): void {
    const el = this.host.nativeElement as HTMLElement;
    this.observador = new ResizeObserver(([entrada]) => {
      this.anchoDisponible.set(entrada.contentRect.width);
    });
    this.observador.observe(el);
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }

  private cargar(): void {
    this.cargando.set(true);
    this.svc.getParticipantes(this.idCong).subscribe({
      next: data => { this.participantes.set(data); this.cargando.set(false); },
      error: () => {
        this.cargando.set(false);
        this.toast.error('Error', 'No se pudieron cargar los participantes.');
      },
    });
    this.svc.getUbicaciones(this.idCong).subscribe({
      next: data => this.ubicaciones.set(data),
      error: () => {},
    });
  }

  private fichaVacia() {
    return {
      es_exhibidor: true, tiene_fluidez: false, activo: true,
      dias: [] as number[], franjas: [...TODO_EL_DIA] as FranjaDia[],
      max_turnos_mes: null as number | null,
      vetadas: [] as number[], notas: '',
    };
  }

  editar(p: Participante): void {
    this.editando.set(p);
    this.ficha = {
      es_exhibidor: p.es_exhibidor,
      tiene_fluidez: p.tiene_fluidez,
      activo: p.activo,
      dias: [...p.dias_disponibles],
      franjas: p.franjas.length ? [...p.franjas] : [...TODO_EL_DIA],
      // Sin tope propio todavía: sugerimos las semanas del mes en vez de
      // dejarlo en blanco — un número concreto ayuda más que "automático" a
      // quien no tiene por qué saber cuál es el default del sistema. Sigue
      // siendo editable, y "Default del sistema" sigue en la lista.
      max_turnos_mes: p.max_turnos_mes ?? this.semanasEsteMes,
      vetadas: [...p.ubicaciones_vetadas],
      notas: p.notas ?? '',
    };
    this.modalFicha.set(true);
  }

  /** Togglea contra lo resaltado (vacío = todos), no contra el arreglo crudo — ver toggleDiaInline. */
  toggleDia(i: number): void {
    const disponible = this.ficha.dias.length === 0 || this.ficha.dias.includes(i);
    this.ficha.dias = disponible
      ? (this.ficha.dias.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : this.ficha.dias).filter(d => d !== i)
      : [...this.ficha.dias, i].sort();
  }

  /** Opción activa del selector de 3: 'libre' cubre tanto ['manana','tarde'] como el arreglo vacío. */
  franjaSeleccionada(): 'manana' | 'tarde' | 'libre' {
    return this.ficha.franjas.length === 1 ? this.ficha.franjas[0] : 'libre';
  }

  seleccionarFranja(opcion: 'manana' | 'tarde' | 'libre'): void {
    this.ficha.franjas = opcion === 'libre' ? [...TODO_EL_DIA] : [opcion];
  }

  descripcionFranja(): string {
    switch (this.franjaSeleccionada()) {
      case 'manana': return 'Solo se le asignan los turnos de la mañana.';
      case 'tarde': return 'Solo se le asignan los turnos de la tarde.';
      default: return 'Puede salir en cualquier turno, de mañana o de tarde.';
    }
  }

  toggleVeto(id: number): void {
    this.ficha.vetadas = this.ficha.vetadas.includes(id)
      ? this.ficha.vetadas.filter(v => v !== id)
      : [...this.ficha.vetadas, id];
  }

  guardarFicha(): void {
    const p = this.editando();
    if (!p) return;
    this.guardando.set(true);
    this.svc.guardarParticipante(p.id_publicador, {
      es_exhibidor: this.ficha.es_exhibidor,
      tiene_fluidez: this.ficha.tiene_fluidez,
      dias_disponibles: this.ficha.dias,
      franjas: this.ficha.franjas,
      max_turnos_mes: this.ficha.max_turnos_mes,
      notas: this.ficha.notas.trim() || null,
      activo: this.ficha.activo,
      ubicaciones_vetadas: this.ficha.vetadas,
    }, this.idCong).subscribe({
      next: () => {
        this.guardando.set(false);
        this.modalFicha.set(false);
        this.toast.success('Participante guardado');
        this.cargar();
      },
      error: err => {
        this.guardando.set(false);
        this.toast.error('Error al guardar', err?.error?.detail ?? 'Inténtalo de nuevo.');
      },
    });
  }

  // ── Vínculos ───────────────────────────────────────────────
  abrirVinculos(): void {
    this.modalVinculos.set(true);
    this.cargarVinculos();
  }

  private cargarVinculos(): void {
    this.svc.getVinculos(this.idCong).subscribe({
      next: data => this.vinculos.set(data),
      error: () => {},
    });
  }

  crearVinculo(): void {
    const { a, b, tipo, accion } = this.nuevoVinculo;
    if (!a || !b) return;
    if (a.id_publicador === b.id_publicador) {
      this.toast.warning('Vínculo inválido', 'Elige dos personas distintas.');
      return;
    }
    this.guardando.set(true);
    this.svc.crearVinculo({
      id_publicador_a: a.id_publicador,
      id_publicador_b: b.id_publicador,
      tipo, accion,
    }, this.idCong).subscribe({
      next: () => {
        this.guardando.set(false);
        this.toast.success('Vínculo creado');
        this.nuevoVinculo = { a: null, b: null, tipo: 'matrimonio', accion: 'siempre_juntos' };
        this.cargarVinculos();
      },
      error: err => {
        this.guardando.set(false);
        this.toast.error('Error', err?.error?.detail ?? 'No se pudo crear el vínculo.');
      },
    });
  }

  eliminarVinculo(v: Vinculo): void {
    this.svc.eliminarVinculo(v.id_vinculo, this.idCong).subscribe({
      next: () => this.cargarVinculos(),
      error: err => this.toast.error('Error', err?.error?.detail ?? 'No se pudo eliminar.'),
    });
  }

  // ── Historial ──────────────────────────────────────────────
  abrirHistorial(): void {
    this.modalHistorial.set(true);
    this.svc.getHistorial(this.idCong).subscribe({
      next: data => this.historial.set(data),
      error: () => {},
    });
  }

  // ── Helpers ────────────────────────────────────────────────
  /** Primera letra del primer nombre + primera del último apellido, sin importar cuántos nombres intermedios haya. */
  iniciales(nombre: string): string {
    const partes = nombre.split(/\s+/).filter(Boolean);
    const letras = partes.length > 1 ? [partes[0], partes[partes.length - 1]] : partes;
    return letras.map(p => p[0]).join('').toUpperCase();
  }

  diaDisponible(p: Participante, dia: number): boolean {
    return p.dias_disponibles.length === 0 || p.dias_disponibles.includes(dia);
  }

  /**
   * Franja y tope de turnos en una línea, para la vista apilada: ahí esos dos
   * ajustes no tienen columna propia y se editan dentro de la ficha, así que
   * el resumen evita tener que abrirla solo para consultarlos.
   */
  resumenAjustes(p: Participante): string {
    const franja = this.opcionesFranja.find(f => f.key === this.franjaSeleccionadaDe(p))?.label ?? 'Libre';
    const turnos = p.max_turnos_mes == null
      ? 'turnos por defecto'
      : `${p.max_turnos_mes} turnos/mes`;
    return `${franja} · ${turnos}`;
  }

  etiquetaTipo(tipo: TipoVinculo): string {
    return this.tiposVinculo.find(t => t.key === tipo)?.label ?? 'Otro';
  }

  accionDe(accion: AccionVinculo) {
    return this.accionesVinculo.find(a => a.key === accion) ?? this.accionesVinculo[0];
  }

  /** Frase en español llano que confirma justo lo que "Crear vínculo" va a guardar. */
  resumenNuevoVinculo(): string {
    const { a, b, tipo, accion } = this.nuevoVinculo;
    if (!a || !b) return '';
    const relacion = tipo === 'matrimonio' ? 'Son esposos.' : tipo === 'hermanos' ? 'Son hermanos.' : '';
    const regla = accion === 'siempre_juntos'
      ? 'Siempre saldrán en el mismo turno.'
      : accion === 'preferir_juntos'
        ? 'Se procurará ponerlos en el mismo turno cuando se pueda.'
        : 'Nunca se les asignará el mismo turno.';
    return [`${a.nombre_completo} y ${b.nombre_completo}.`, relacion, regla].filter(Boolean).join(' ');
  }
}
