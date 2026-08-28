import {
  Component,
  signal,
  computed,
  inject,
  effect,
  untracked,
  OnInit,
  HostListener,
  NgZone,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin, of, firstValueFrom } from 'rxjs'; // 'of' used in tryLoadDrafts catchError
import { ReunionesLogisticaComponent } from './reuniones-logistica.component';
import { ReunionesDiscursosComponent } from './reuniones-discursos.component';
import { ReunionesAjustesDialogComponent } from './reuniones-ajustes-dialog.component';
import { catchError, switchMap, tap } from 'rxjs/operators';
import { ReunionesService, PublicadorBusqueda } from '../services/reuniones.service';
import { ConflictosService } from '../services/conflictos.service';
import { AsistenciaService } from '../services/asistencia.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { AuthStore } from '../../../core/auth/auth.store';
import {
  ProgramaSemana,
  SemanaSinReunion,
  AsignacionDraft,
  CandidatoAlternativo,
  PlantillaOption,
  GenerarMesForm,
  GenerarAsignacionesRequest,
  ProgramaMensualCreateRequest,
  PublicarProgramaRequest,
  EditarAsignacionRequest,
  PeriodoConfirmado,
  ConflictoMes,
  GrupoPlantilla,
} from '../models/reuniones.models';
import { whatsappUrl } from '../../../shared/whatsapp';

@Component({
  selector: 'app-reuniones-programacion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ReunionesLogisticaComponent, ReunionesDiscursosComponent, ReunionesAjustesDialogComponent],
  template: `
    <div class="flex flex-col h-full gap-0">

      <!-- ===== MEETING TYPE SELECTOR ===== -->
      <!-- La cabecera se define una vez y cada pestaña la proyecta dentro de
           su propia barra superior, compartiendo fila con los controles del
           mes: esa banda iba de lado a lado con casi todo el ancho vacío y el
           título repetía lo que la píldora activa ya dice. La plantilla es la
           misma en los cuatro casos: duplicar la píldora habría sido
           garantizar que las copias se separaran a la primera corrección. -->
      <ng-template #cabeceraPestanas>
        <!-- Con una sola pestaña visible no hay nada entre lo que elegir y
             la píldora sobra. -->
        @if (showTipoTabs()) {
          <!-- Se ciñe a su contenido: comparte fila con los controles del mes
               y cada pixel de más es ancho que le falta al detalle. -->
          <div class="flex items-center gap-1.5 bg-white dark:bg-[#1a1b26] rounded-2xl p-1.5 shadow-sm border border-slate-200/60 dark:border-slate-800 w-full md:w-auto shrink-0">
            @if (canViewEntreSemana()) {
              <!-- Sólo la activa lleva rótulo: con el título fuera, es la
                   píldora encendida la que dice en qué pantalla estás; las
                   demás se quedan en icono para no gastar ancho. -->
              <button
                (click)="onTipoChange('entre_semana')"
                aria-label="Entre semana"
                class="min-w-0 h-9 rounded-lg text-[10px] md:text-xs font-bold transition-colors flex items-center justify-center gap-1.5 active:scale-[0.97] active:transition-transform"
                [ngClass]="tipoReunionActivo() === 'entre_semana'
                  ? 'flex-none px-3 bg-brand-purple text-white shadow-md shadow-purple-500/20'
                  : 'flex-1 md:flex-none px-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'">
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>
                @if (tipoReunionActivo() === 'entre_semana') {
                  <span class="whitespace-nowrap">Entre semana</span>
                }
              </button>
            }
            @if (canViewFinSemana()) {
              <button
                (click)="onTipoChange('fin_semana')"
                aria-label="Fin de semana"
                class="min-w-0 h-9 rounded-lg text-[10px] md:text-xs font-bold transition-colors flex items-center justify-center gap-1.5 active:scale-[0.97] active:transition-transform"
                [ngClass]="tipoReunionActivo() === 'fin_semana'
                  ? 'flex-none px-3 bg-brand-purple text-white shadow-md shadow-purple-500/20'
                  : 'flex-1 md:flex-none px-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'">
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/></svg>
                @if (tipoReunionActivo() === 'fin_semana') {
                  <span class="whitespace-nowrap">Fin de semana</span>
                }
              </button>
            }
            @if (canViewLogistica()) {
              <button
                (click)="onTipoChange('logistica')"
                aria-label="Logística"
                class="min-w-0 h-9 rounded-lg text-[10px] md:text-xs font-bold transition-colors flex items-center justify-center gap-1.5 active:scale-[0.97] active:transition-transform"
                [ngClass]="tipoReunionActivo() === 'logistica'
                  ? 'flex-none px-3 bg-brand-purple text-white shadow-md shadow-purple-500/20'
                  : 'flex-1 md:flex-none px-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'">
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                @if (tipoReunionActivo() === 'logistica') {
                  <span class="whitespace-nowrap">Logistica</span>
                }
              </button>
            }
            @if (canViewDiscursos()) {
              <button
                (click)="onTipoChange('discursos')"
                aria-label="Discursos públicos"
                class="min-w-0 h-9 rounded-lg text-[10px] md:text-xs font-bold transition-colors flex items-center justify-center gap-1.5 active:scale-[0.97] active:transition-transform"
                [ngClass]="tipoReunionActivo() === 'discursos'
                  ? 'flex-none px-3 bg-brand-purple text-white shadow-md shadow-purple-500/20'
                  : 'flex-1 md:flex-none px-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'">
                <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                @if (tipoReunionActivo() === 'discursos') {
                  <span class="whitespace-nowrap">Discursos</span>
                }
              </button>
            }
          </div>
        }
      </ng-template>

      <!-- ===== BOTÓN DE EXCEPCIONES ===== -->
      <!-- Semanas sin reunión y ausencias se necesitan justo mientras se
           programa -uno se entera de la asamblea con el mes ya abierto-, pero
           vivían sólo en Configuración. Aquí van pegadas a las pestañas, en el
           mismo sitio en las cuatro pantallas: quien lo busca una vez sabe
           dónde está siempre. La plantilla se define una vez y cada pestaña la
           proyecta, igual que la píldora. -->
      <ng-template #botonAjustes>
        <button
          type="button"
          data-testid="btn-ajustes-programacion"
          (click)="ajustesAbierto.set(true)"
          title="Excepciones: semanas sin reunión y ausencias"
          aria-label="Excepciones: semanas sin reunión y ausencias"
          [attr.aria-expanded]="ajustesAbierto()"
          class="flex items-center justify-center w-11 h-11 sm:w-9 sm:h-9 shrink-0 rounded-xl bg-white dark:bg-[#1a1b26] border border-slate-200/60 dark:border-slate-800 shadow-sm text-slate-500 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/25 hover:text-violet-600 dark:hover:text-violet-400 transition-all active:scale-95">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      </ng-template>

      <!-- El diálogo vive en el padre y no dentro de cada pestaña: así lo
           comparten las cuatro sin montarse cuatro veces, y sigue abierto
           aunque se cambie de pestaña por debajo. -->
      <app-reuniones-ajustes-dialog
        [abierto]="ajustesAbierto()"
        (cerrado)="ajustesAbierto.set(false)"
        (cambios)="onAjustesCambiaron()">
      </app-reuniones-ajustes-dialog>

      <!-- ===== ERROR ===== -->
      @if (estado() === 'error') {
        <div class="shrink-0 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 mb-3 flex items-start gap-3">
          <svg class="w-4 h-4 mt-0.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <!-- Sin truncate: estos mensajes enumeran las semanas que no se
               guardaron o las congregaciones que bloquean una guía, y cortarlos
               deja al usuario sin el dato por el que existe el aviso. -->
          <p class="flex-1 min-w-0 text-red-600 dark:text-red-400 text-xs font-medium">{{ errorMsg() }}</p>
          <button
            (click)="estado.set('idle')"
            class="shrink-0 px-3 h-7 rounded-lg bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-xs text-red-600 dark:text-red-400 font-bold transition-all">
            Cerrar
          </button>
        </div>
      }

      <!-- ===== AVISO — se conservó algo ya confirmado ===== -->
      @if (avisoConservados(); as aviso) {
        <div class="shrink-0 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 px-4 py-3 mb-3 flex items-start gap-3">
          <svg class="w-4 h-4 mt-0.5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <p class="flex-1 min-w-0 text-amber-700 dark:text-amber-400 text-xs font-medium">{{ aviso }}</p>
          <button
            (click)="avisoConservados.set(null)"
            class="shrink-0 px-3 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 hover:bg-amber-200 dark:hover:bg-amber-900/60 text-xs text-amber-700 dark:text-amber-400 font-bold transition-all">
            Cerrar
          </button>
        </div>
      }

      <!-- ===== PUBLICADO — banner ===== -->
      @if (estado() === 'publicado' && recienPublicado()) {
        <div class="shrink-0 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/50 px-4 py-3 mb-3 flex items-center gap-3">
          <svg class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          <p class="text-emerald-700 dark:text-emerald-300 text-xs font-bold">Programación publicada. Ya es visible para la congregación.</p>
        </div>
      }

      <!-- ===== LOGÍSTICA ===== -->
      @if (tipoReunionActivo() === 'logistica') {
        <app-reuniones-logistica class="flex-1 min-h-0 block overflow-hidden">
          <div cabecera class="flex items-center gap-3 min-w-0 shrink">
            <ng-container [ngTemplateOutlet]="cabeceraPestanas"></ng-container>
          </div>
          <div accion-derecha class="shrink-0">
            <ng-container [ngTemplateOutlet]="botonAjustes"></ng-container>
          </div>
        </app-reuniones-logistica>
      }

      <!-- ===== DISCURSOS PÚBLICOS ===== -->
      @if (tipoReunionActivo() === 'discursos') {
        <app-reuniones-discursos class="flex-1 min-h-0 block overflow-hidden">
          <div cabecera class="flex items-center gap-3 min-w-0 shrink">
            <ng-container [ngTemplateOutlet]="cabeceraPestanas"></ng-container>
          </div>
          <div accion-derecha class="shrink-0">
            <ng-container [ngTemplateOutlet]="botonAjustes"></ng-container>
          </div>
        </app-reuniones-discursos>
      }

      <!-- ===== ALERTA: NO HAY GUÍAS DE ACTIVIDADES ===== -->
      @if (tipoReunionActivo() === 'entre_semana' && tieneGuias() === false) {
        <div data-testid="aviso-sin-guias" class="shrink-0 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/50 px-4 py-3 mb-3 flex items-start gap-3">
          <svg class="w-5 h-5 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div class="flex-1 min-w-0">
            <p class="text-amber-800 dark:text-amber-300 text-xs font-bold">No hay ninguna guía de actividades cargada en el sistema.</p>
            @if (puedeCargarGuia()) {
              <p class="text-amber-700/90 dark:text-amber-400/90 text-[0.7rem] mt-0.5">
                Para poder crear una programación de la reunión entre semana debes cargar primero una guía de actividades (por ejemplo, "Vida y Ministerio Cristiano") desde la sección de Configuración de Reuniones.
              </p>
              <a routerLink="/reuniones/configuracion"
                [queryParams]="{ tab: 'plantillas' }"
                class="inline-flex items-center gap-1.5 mt-2 px-3 h-10 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[0.7rem] font-bold transition-all shadow-sm active:scale-95">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                Ir a cargar guía
              </a>
            } @else {
              <p class="text-amber-700/90 dark:text-amber-400/90 text-[0.7rem] mt-0.5">
                No puedes crear una programación porque aún no hay una guía de actividades cargada. Contacta al administrador o gestor de la aplicación para que cargue la guía correspondiente.
              </p>
            }
          </div>
        </div>
      }

      <!-- ===== ÁREA PRINCIPAL: sin sidebar, controles arriba ===== -->
      @if (tipoReunionActivo() !== 'logistica' && tipoReunionActivo() !== 'discursos') {

      <!-- ===== BARRA SUPERIOR ===== -->
      <!-- Misma fila para la píldora de pestañas y los controles del mes, como
           en Logística: la banda del título iba de lado a lado con casi todo el
           ancho vacío y repetía lo que la píldora encendida ya dice. Los
           controles sólo aparecen con un mes abierto; sin él, la lista de meses
           vive centrada en la tarjeta del panel. -->
      <div class="shrink-0 flex flex-wrap md:flex-nowrap items-center gap-x-2 gap-y-2 pb-3 min-w-0">

        <ng-container [ngTemplateOutlet]="cabeceraPestanas"></ng-container>

        <!-- Empuja la bandeja del mes y el engranaje juntos al extremo
             derecho, en vez de que cada uno reclame su propio espacio y se
             abra un hueco entre los dos. -->
        <span class="hidden md:block md:flex-1" aria-hidden="true"></span>

        @if (semanas().length > 0 && estado() !== 'loading') {
          <!-- Filete: separa la píldora del resto de la barra. -->
          <span class="hidden md:block w-px h-7 bg-slate-200 dark:bg-slate-700 shrink-0" aria-hidden="true"></span>

          <!-- ===== BANDEJA DE CONTROL DEL MES ===== -->
          <!-- Una sola superficie con su fondo y su borde, como una barra de
               herramientas real; los filetes finos marcan dónde empieza cada
               grupo sin gastar una etiqueta. -->
          <div class="flex flex-wrap items-center gap-0.5 min-w-0 w-full md:w-auto md:ml-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm p-1">

            <!-- Selector de mes: el propio título es el control. Desplegado
                 desde aquí, la lista ocupa ancho sólo mientras se usa. -->
            <div class="relative shrink-0" data-mes-menu>
              <button
                type="button"
                data-testid="selector-mes"
                (click)="menuMesesAbierto.set(!menuMesesAbierto())"
                [attr.aria-expanded]="menuMesesAbierto()"
                aria-haspopup="listbox"
                aria-label="Cambiar de mes"
                class="flex items-center gap-1.5 h-8 px-2.5 rounded-xl transition-colors"
                [class]="menuMesesAbierto()
                  ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                  : 'text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'">
                <svg class="w-3.5 h-3.5 shrink-0 text-violet-500/80 dark:text-violet-400/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 3v3M16 3v3"/></svg>
                <span class="text-sm font-bold whitespace-nowrap">{{ periodoActivoLabel() }}</span>
                <svg class="w-3.5 h-3.5 shrink-0 opacity-50 transition-transform duration-200" [class.rotate-180]="menuMesesAbierto()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>

              @if (menuMesesAbierto()) {
                <div role="listbox" aria-label="Meses programados" class="absolute z-40 top-[calc(100%+4px)] left-0 w-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
                  <div class="max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain simple-scrollbar p-1.5">
                    @for (grupo of periodosPorAno(); track grupo.ano) {
                      <!-- Año como divisor del grupo, no repetido por fila. -->
                      <p class="flex items-center gap-2 px-1.5 pt-2.5 pb-1 first:pt-0.5">
                        <span class="text-[0.65rem] font-bold text-slate-400 dark:text-slate-500 data-num">{{ grupo.ano }}</span>
                        <span class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></span>
                      </p>
                      @for (p of grupo.periodos; track p.ano + '-' + p.mes) {
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            role="option"
                            data-testid="fila-mes"
                            [attr.data-ano]="p.ano"
                            [attr.data-mes]="p.mes"
                            [attr.aria-selected]="esPeriodoActivo(p)"
                            (click)="loadMes(p.mes, p.ano); menuMesesAbierto.set(false)"
                            [disabled]="loadingHistorial()"
                            class="flex-1 min-w-0 flex items-center gap-2 px-2 h-9 rounded-lg text-xs transition-colors disabled:opacity-40"
                            [class]="esPeriodoActivo(p)
                              ? 'bg-violet-50 dark:bg-violet-900/25 text-violet-700 dark:text-violet-300 font-bold'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'">
                            <span class="flex-1 min-w-0 truncate text-left">{{ mesSoloLabel(p) }}</span>
                            @if (esPeriodoActivo(p)) {
                              <svg class="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            }
                          </button>
                          <button
                            (click)="descargarPdfMes(p, $event)"
                            [disabled]="descargandoPdf()"
                            title="Descargar PDF de {{ p.label }}"
                            class="shrink-0 w-9 h-9 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-500 hover:text-emerald-700 dark:text-emerald-400 transition-all active:scale-95 flex items-center justify-center disabled:opacity-40">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3"/></svg>
                          </button>
                          @if (periodoEliminable(p) && hasEditPermission()) {
                            <button
                              (click)="eliminarHistorial(p, $event)"
                              title="Eliminar {{ p.label }}"
                              class="shrink-0 w-9 h-9 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 hover:text-red-600 transition-all active:scale-95 flex items-center justify-center">
                              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                          }
                        </div>
                      }
                    }
                  </div>
                  <!-- Generar cierra la lista: es lo único de aquí que no es
                       elegir entre lo que ya existe. -->
                  @if (hasEditPermission()) {
                    <div class="shrink-0 p-1.5 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        data-testid="btn-generar-mes"
                        (click)="menuMesesAbierto.set(false); openModal()"
                        [disabled]="estado() === 'loading' || (tipoReunionActivo() === 'entre_semana' && tieneGuias() === false)"
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

            <!-- Estado del mes abierto: el texto siempre está, el color sólo
                 refuerza. -->
            <span class="shrink-0 px-2 text-[0.6rem] font-bold uppercase tracking-wider"
              [class]="estado() === 'publicado'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'">
              {{ estadoLabel() }}
            </span>

            <span class="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" aria-hidden="true"></span>

            <!-- Descargar/eliminar el mes ya abierto sin tener que reabrir el
                 desplegable y buscar su fila: son las dos acciones que más se
                 usan sobre el periodo activo y antes sólo vivían ahí dentro.
                 Mismo botón icono-solo que usa Logística (rounded-xl, gris
                 neutro, tinte de color sólo al pasar por encima) para que las
                 acciones de mes se vean igual en todas las pestañas. -->
            @if (estado() === 'publicado' && periodoActivoCompleto(); as mesActivo) {
              <button
                (click)="descargarPdfMes(mesActivo, $event)"
                [disabled]="descargandoPdf()"
                title="Descargar PDF de {{ mesActivo.label }}"
                aria-label="Descargar PDF de {{ mesActivo.label }}"
                class="flex items-center justify-center w-8 h-8 shrink-0 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/25 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6v-8z"/></svg>
              </button>

              <!-- Papeletas S-89-S: solo entre semana, es lo que se reparte a
                   los estudiantes de Seamos Mejores Maestros y Lectura de la
                   Biblia, 4 por hoja para cortar. Para mandarle a uno solo su
                   asignación por WhatsApp está el ícono junto a cada nombre
                   asignado en la lista, que envía solo esa papeleta. -->
              @if (tipoReunionActivo() === 'entre_semana') {
                <button
                  type="button"
                  data-testid="btn-papeletas-s89"
                  (click)="descargarPapeletas(mesActivo, 'x4', $event)"
                  [disabled]="descargandoPapeletas()"
                  title="Formulario S-89-S de {{ mesActivo.label }} (4 por hoja)"
                  aria-label="Formulario S-89-S de {{ mesActivo.label }} (4 por hoja)"
                  class="flex items-center justify-center w-8 h-8 shrink-0 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-900/25 hover:text-violet-600 dark:hover:text-violet-400 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M8 13h8M8 17h8"/></svg>
                </button>
              }
              <!-- Lo que borra vive detrás de un menú, no suelto en la barra.
                   Antes había dos papeleras pegadas -"quitar Sala B" y
                   "eliminar el mes"- que son cosas muy distintas y se veían
                   idénticas: el mismo icono al lado del mismo icono, sin
                   forma de saber cuál era cuál hasta pasar el ratón. Aquí
                   cada acción lleva su nombre escrito, y hace falta un clic
                   deliberado para llegar a algo irreversible. El PDF se
                   queda fuera porque no destruye nada. -->
              @if (accionesDestructivasMes() && hasEditPermission()) {
                <div class="relative shrink-0" data-acciones-menu>
                  <button
                    type="button"
                    data-testid="btn-acciones-mes"
                    (click)="menuAccionesAbierto.set(!menuAccionesAbierto())"
                    [attr.aria-expanded]="menuAccionesAbierto()"
                    aria-haspopup="menu"
                    title="Más acciones sobre {{ mesActivo.label }}"
                    aria-label="Más acciones sobre {{ mesActivo.label }}"
                    class="flex items-center justify-center w-8 h-8 rounded-xl transition-all active:scale-95"
                    [class]="menuAccionesAbierto()
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200'">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
                  </button>

                  @if (menuAccionesAbierto()) {
                    <div role="menu" class="absolute z-40 top-[calc(100%+4px)] right-0 w-60 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden p-1.5 flex flex-col gap-0.5">
                      @if (tipoReunionActivo() === 'entre_semana' && mesTieneSalaB()) {
                        <button
                          type="button"
                          role="menuitem"
                          data-testid="btn-eliminar-sala-b"
                          (click)="menuAccionesAbierto.set(false); eliminarSalaBDelMes($event)"
                          [disabled]="borrandoSalaB()"
                          class="w-full flex items-start gap-2.5 px-2 py-2 rounded-lg text-left text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-40">
                          @if (borrandoSalaB()) {
                            <div class="w-4 h-4 shrink-0 mt-px rounded-full border-2 border-slate-300 border-t-red-500 animate-spin"></div>
                          } @else {
                            <!-- Dos salas, no una papelera: lo que se quita es
                                 el segundo salón, no el mes. -->
                            <svg class="w-4 h-4 shrink-0 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="7" height="16" rx="1.5"/><rect x="14" y="4" width="7" height="16" rx="1.5"/><line x1="15.5" y1="9" x2="19.5" y2="15"/><line x1="19.5" y1="9" x2="15.5" y2="15"/></svg>
                          }
                          <span class="min-w-0 flex-1">
                            <span class="block text-xs font-bold leading-tight">Quitar la Sala B</span>
                            <span class="block text-[0.65rem] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">Sólo el segundo salón. La Sala Principal se queda.</span>
                          </span>
                        </button>
                      }

                      @if (tipoReunionActivo() === 'entre_semana' && mesTieneSalaB() && periodoEliminable(mesActivo)) {
                        <span class="h-px bg-slate-100 dark:bg-slate-800 mx-1 my-0.5" aria-hidden="true"></span>
                      }

                      @if (periodoEliminable(mesActivo)) {
                        <button
                          type="button"
                          role="menuitem"
                          data-testid="btn-eliminar-mes-activo"
                          (click)="menuAccionesAbierto.set(false); eliminarHistorial(mesActivo, $event)"
                          class="w-full flex items-start gap-2.5 px-2 py-2 rounded-lg text-left text-slate-700 dark:text-slate-200 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                          <svg class="w-4 h-4 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          <span class="min-w-0 flex-1">
                            <span class="block text-xs font-bold leading-tight">Eliminar {{ mesActivo.label }}</span>
                            <span class="block text-[0.65rem] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">El mes entero, con todas sus asignaciones.</span>
                          </span>
                        </button>
                      }
                    </div>
                  }
                </div>
              }
              <span class="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0 mx-0.5" aria-hidden="true"></span>
            }

            @if (estado() === 'publicado') {
              <button
                (click)="semanas.set([]); estado.set('idle'); periodoActivo.set(null)"
                title="Volver a la lista"
                aria-label="Volver a la lista"
                class="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[0.7rem] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-[0.97]">
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
                Volver
              </button>
            }
            @if (estado() === 'borrador' && hasEditPermission()) {
              <button
                data-testid="btn-confirmar"
                (click)="publicar()"
                [disabled]="!canPublicar()"
                title="Publicar programación"
                aria-label="Publicar programación"
                class="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[0.7rem] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.97]">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Publicar
              </button>
              <button
                data-testid="btn-borrar-borrador"
                (click)="borrarBorrador()"
                [disabled]="!canBorrarBorrador()"
                title="Borrar borrador"
                aria-label="Borrar borrador"
                class="shrink-0 flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-[0.7rem] font-bold text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors active:scale-[0.97]">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                Borrar
              </button>
            }
          </div>
        }

        <!-- Fuera del @if del mes, igual que en Logística y Discursos: cae
             siempre al extremo derecho, con o sin bandeja delante. -->
        <ng-container [ngTemplateOutlet]="botonAjustes"></ng-container>
      </div>

      <!-- ── PANEL PRINCIPAL ── -->
      <!-- Sin barra lateral: el historial de meses vivía en una columna fija
           de hasta 16rem que sólo se usaba al elegir el mes. Ese ancho es
           ahora de la lista de partes. -->
      <div class="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 relative">

        <!-- Navegador de semanas: sólo con un mes abierto y sólo si hay entre
             qué elegir. -->
        @if (semanas().length > 0 && estado() !== 'loading') {
          <div
            class="shrink-0 flex items-center gap-1.5 px-3 py-2 overflow-x-auto no-scrollbar border-b border-slate-100 dark:border-slate-800 snap-x snap-mandatory"
            role="tablist"
            aria-label="Semanas del mes">
            @for (item of semanasAgrupadas(); track item.sem.semana_iso; let i = $index) {
              @if (item.esNuevoMes) {
                <!-- Marca dónde empieza cada mes en vez de repetirlo en cada
                     píldora: un filete y el mes en versalitas, ajeno al
                     tablist -aria-hidden-, porque cada botón ya lleva el mes
                     completo en su aria-label. -->
                <span class="shrink-0 flex items-center gap-1.5 select-none" aria-hidden="true">
                  @if (i > 0) {
                    <span class="w-px h-5 bg-slate-200 dark:bg-slate-700 shrink-0"></span>
                  }
                  <span class="pl-0.5 text-[0.625rem] font-black uppercase tracking-wide text-slate-400 dark:text-slate-500">{{ item.sem.fecha | date:'MMMM' }}</span>
                </span>
              }
              <button
                data-testid="tab-semana"
                [attr.data-iso]="item.sem.semana_iso"
                (click)="selectedWeekIdx.set(i)"
                role="tab"
                [attr.aria-selected]="selectedWeekIdx() === i"
                [attr.aria-label]="(item.sem.fecha | date:'d MMMM') + (item.sinReunion ? ', sin reunión' : '')"
                class="snap-start shrink-0 flex items-center gap-1 px-3 h-8 rounded-full text-[0.7rem] font-bold whitespace-nowrap transition-[transform,background-color,border-color,color] duration-150 ease-out border active:scale-[0.97]"
                [class]="weekTabClass(i)"
                [attr.title]="item.sinReunion ? ('Sin reunión' + (item.sinReunion.motivo ? ' — ' + item.sinReunion.motivo : '')) : null">
                @if (item.sinReunion) {
                  <svg class="w-3 h-3 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                }
                <span [class.line-through]="!!item.sinReunion" [class.opacity-60]="!!item.sinReunion">{{ item.sem.fecha | date:'d' }}</span>
              </button>
            }
          </div>
        }

          <!-- Loading overlay -->
          @if (estado() === 'loading') {
            <div class="absolute inset-0 z-20 bg-white/85 dark:bg-slate-900/85 backdrop-blur-[2px] flex items-center justify-center rounded-2xl">
              <div class="flex flex-col items-center gap-3 px-6 text-center">
                <div class="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-[#6D28D9] animate-spin"></div>
                <div>
                  <p class="text-xs font-bold text-slate-700 dark:text-slate-200">Generando programa...</p>
                  <p class="text-[0.65rem] text-slate-400 dark:text-slate-500 mt-0.5">Asignando partes y calculando disponibilidad</p>
                </div>
              </div>
            </div>
          }

          <!-- IDLE state -->
          <!-- Es el único momento sin barra de mes, así que la lista y el
               botón de generar viven aquí: sin ellos no habría forma de entrar
               a la pantalla (mismo criterio que Logística). -->
          @if (estado() === 'idle' || (estado() !== 'loading' && estado() !== 'error' && semanas().length === 0)) {
            <div class="flex-1 flex items-center justify-center p-6 overflow-y-auto simple-scrollbar">
              <div class="w-full max-w-sm flex flex-col items-center text-center gap-1.5">

                <div class="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-900/20 flex items-center justify-center mb-2.5">
                  <svg class="w-6 h-6 text-violet-500 dark:text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>

                <h3 class="text-sm font-bold text-slate-700 dark:text-slate-200">Ninguna programación abierta</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-[15rem]">
                  @if (gruposPlantilla().length > 0) {
                    Elige un mes para verlo y editarlo.
                  } @else if (hasEditPermission()) {
                    Genera una nueva programación para comenzar.
                  } @else {
                    Aún no hay programaciones disponibles para esta reunión.
                  }
                </p>

                @if (gruposPlantilla().length > 0) {
                  <!-- Lista en tarjeta y no chips sueltos: filas del mismo
                       ancho, una debajo de otra, se leen como un solo bloque. -->
                  <div class="w-full mt-4 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden bg-white dark:bg-slate-900">
                    @for (grupo of periodosPorAno(); track grupo.ano) {
                      @for (p of grupo.periodos; track p.ano + '-' + p.mes) {
                        <button
                          data-testid="fila-mes"
                          [attr.data-ano]="p.ano"
                          [attr.data-mes]="p.mes"
                          (click)="loadMes(p.mes, p.ano)"
                          [disabled]="loadingHistorial()"
                          class="w-full flex items-center gap-2.5 px-3.5 h-11 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-700 dark:text-slate-200 text-xs font-medium transition-colors active:bg-violet-100 dark:active:bg-violet-900/30 disabled:opacity-40">
                          <span class="min-w-0 truncate text-left flex-1">{{ p.label }}</span>
                          <svg class="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
                        </button>
                      }
                    }
                  </div>
                }

                @if (hasEditPermission()) {
                  <button
                    data-testid="btn-generar-mes"
                    (click)="openModal()"
                    [disabled]="estado() === 'loading' || (tipoReunionActivo() === 'entre_semana' && tieneGuias() === false)"
                    [title]="(tipoReunionActivo() === 'entre_semana' && tieneGuias() === false) ? 'Carga una guía de actividades' : 'Generar nuevo mes'"
                    class="w-full mt-4 flex items-center justify-center gap-2 px-4 h-11 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-all shadow-sm active:scale-[0.98]">
                    <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    Generar mes
                  </button>
                }

              </div>
            </div>
          }

          <!-- DRAFT / CONFIRMADO / HISTORIAL: lista de asignaciones -->
          @if ((estado() === 'borrador' || estado() === 'publicado') && currentSemana(); as semana) {

            @if (semanaSinReunion(semana); as sinReunion) {
              <div class="mx-3 mt-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/50 px-4 py-3 flex items-start gap-2.5">
                <svg class="w-4 h-4 shrink-0 text-amber-500 mt-px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <div class="min-w-0">
                  <p class="text-xs font-bold text-amber-800 dark:text-amber-300">Esta semana está marcada como sin reunión</p>
                  <p class="text-[0.7rem] text-amber-700/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">
                    @if (sinReunion.motivo) { {{ sinReunion.motivo }}. }
                    No se programa a nadie. Puedes quitar la marca en Configuración → Semanas sin reunión.
                  </p>
                </div>
              </div>
            }

            <!-- Lista de partes por sección -->
            <!-- Cada sección es una tarjeta con su propio marco, como en
                 Logística: antes eran bandas de color a todo lo ancho con las
                 filas flotando sueltas debajo sobre un gris de fondo, y no se
                 veía dónde acababa una sección y empezaba la siguiente. El
                 tono de identidad ahora cabe en un punto y un velo tenue de la
                 cabecera; el resto vive en neutros para que lo que se lea sean
                 los nombres. -->
            <div class="flex-1 overflow-y-auto simple-scrollbar bg-slate-50 dark:bg-slate-950 p-2 sm:p-3 flex flex-col gap-3">
              @for (seccion of seccionesActuales(); track seccion.id) {

                <section
                  data-testid="seccion-programa"
                  [attr.data-seccion]="seccion.id"
                  class="sec-card sec-bg sec-frame shrink-0 rounded-2xl border shadow-[var(--shadow-soft)] overflow-hidden"
                  [style.--sec]="seccion.color">

                  <!-- Cabecera de sección -->
                  <header class="sec-surface sec-bg flex items-center gap-2.5 px-3 sm:px-4 py-2.5 border-b">
                    <span class="w-2 h-2 rounded-full shrink-0" [style.background]="seccion.color" aria-hidden="true"></span>
                    <h3 class="sec-ink flex-1 min-w-0 font-display text-[0.8rem] font-bold tracking-tight truncate">{{ seccion.titulo }}</h3>

                    @if (salaCountsPorSeccion()[seccion.id] > 0) {
                      <!-- Segmentado: la sala activa va rellena con el tono de
                           la sección; la otra en tinta apagada. -->
                      <div class="sec-seg flex items-center rounded-lg p-0.5 gap-0.5 shrink-0 border">
                        <button
                          (click)="selectedSala.set('Principal'); $event.stopPropagation()"
                          [attr.aria-pressed]="selectedSala() === 'Principal'"
                          class="sec-seg-btn flex items-center justify-center px-2 h-7 md:h-6 min-w-[48px] rounded-md text-[0.62rem] font-bold whitespace-nowrap transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97]"
                          [class.is-on]="selectedSala() === 'Principal'">
                          Principal
                        </button>
                        <button
                          (click)="selectedSala.set('Auxiliar'); $event.stopPropagation()"
                          [attr.aria-pressed]="selectedSala() === 'Auxiliar'"
                          class="sec-seg-btn flex items-center justify-center px-2 h-7 md:h-6 min-w-[48px] rounded-md text-[0.62rem] font-bold whitespace-nowrap transition-[transform,background-color,color] duration-150 ease-out active:scale-[0.97]"
                          [class.is-on]="selectedSala() === 'Auxiliar'">
                          Sala B
                        </button>
                      </div>
                    }
                  </header>

                  <!-- Filas de partes: separadas por un filete, no por huecos.
                       Las tarjetas sueltas repetían borde y sombra en cada
                       fila para agrupar cosas que ya están agrupadas por estar
                       dentro de la misma tarjeta de sección. -->
                  <div class="sec-line divide-y">
                    @for (grupo of seccion.grupos; track grupo.key) {
                      <div class="parte-row"
                        data-testid="fila-parte"
                        [attr.data-parte]="grupo.partes[0].id_programa_parte"
                        [class.has-conflict]="grupoHasConflict(grupo.partes)"
                        [class.has-swapped]="grupoHasSwapped(grupo.partes)"
                        [class.is-open]="isGroupOpen(grupo)"
                        [class.dropdown-active]="grupoDropdownActivo(grupo.partes)">
                      <div class="px-3 pt-2 pb-2 flex flex-col gap-1.5 lg:flex-row lg:items-center lg:gap-3 lg:px-4 lg:py-2.5">
                        <!-- Fila 1: dot + título + duración + badges de estado -->
                        <div class="flex items-center gap-3 flex-1 min-w-0">
                          <div class="w-1.5 h-1.5 rounded-full shrink-0" [style.background-color]="grupoDotColor(grupo.partes, seccion.color)"></div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-baseline gap-2 min-w-0">
                              <p class="text-sm font-medium text-slate-800 dark:text-slate-100 line-clamp-2 lg:truncate leading-snug flex-1 min-w-0">
                                {{ displayNombreParte(grupo.partes[0]) }}
                              </p>
                              @if (grupo.partes[0].duracion_minutos) {
                                <!-- La duración es un dato, no un adorno: en
                                     mono tabular se lee de un vistazo en la
                                     columna aunque cambie de 4 a 30. -->
                                <span class="sec-badge shrink-0 px-1.5 py-[2px] rounded font-mono tabular-nums text-[0.65rem] font-bold leading-none">
                                  {{ grupo.partes[0].duracion_minutos }}&nbsp;min
                                </span>
                              }
                            </div>
                            @if (grupoHasConflict(grupo.partes) || grupoHasReemplazo(grupo.partes) || grupoHasSwapped(grupo.partes)) {
                              <!-- Estados con punto + texto, no sólo color:
                                   quien no distingue rojo de ámbar sigue
                                   leyendo qué pasa. -->
                              <div class="flex items-center gap-2 mt-1">
                                @if (grupoHasConflict(grupo.partes)) {
                                  <span class="estado-tag" data-estado="conflicto"><span class="estado-dot"></span>Sin candidato</span>
                                } @else if (grupoHasReemplazo(grupo.partes)) {
                                  <span class="estado-tag" data-estado="reemplazo"><span class="estado-dot"></span>Reemplazo</span>
                                }
                                @if (grupoHasSwapped(grupo.partes)) {
                                  <span class="estado-tag" data-estado="modificado"><span class="estado-dot"></span>Modificado</span>
                                }
                              </div>
                            }
                          </div>
                        </div>
                        <!-- Fila 2 (móvil) / columna derecha (sm+): pills de asignados -->
                        <div class="flex flex-wrap items-center gap-1.5 pl-5 lg:pl-0 lg:justify-end lg:shrink-0">
                          @for (asig of grupo.partes; track $index; let pi = $index) {
                            <!-- Las canciones y las partes fijas de la guía no
                                 esperan a nadie: salen en la lista y en el PDF,
                                 pero sin casilla que invite a rellenarlas. -->
                            @if (asig.asignable === false) {
                              <span class="text-[0.65rem] text-slate-400 dark:text-slate-500 italic px-1">Sin asignación</span>
                            } @else {
                            <div class="relative">
                              <button
                                data-testid="pill-asignacion"
                                [attr.data-publicador]="asig.id_publicador"
                                [attr.data-pill]="pillKey(asig)"
                                (click)="onPillClick(asig, seccion)"
                                [disabled]="!hasEditPermission()"
                                [class]="assigneeButtonClass(asig)">
                                @if (grupo.partes.length > 1) {
                                  <span class="text-[0.48rem] font-black uppercase tracking-wide leading-none shrink-0 opacity-60">{{ grupoRoleLabel(grupo, pi) }}</span>
                                  <span class="opacity-30 text-[0.6rem] leading-none shrink-0">·</span>
                                }
                                <span class="truncate max-w-[9rem]">{{ asig.nombre_completo || 'Sin asignar' }}</span>
                                @if (hasEditPermission()) {
                                  <svg class="chevron w-3 h-3 shrink-0"
                                    [class.open]="editingHistorialId() === pillKey(asig)"
                                    fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                                  </svg>
                                }
                                @if (asig.es_ayudante && hasEditPermission()) {
                                  <span
                                    role="button"
                                    tabindex="0"
                                    (click)="onEliminarAyudante(asig, selectedWeekIdx(), $event)"
                                    (keydown.enter)="onEliminarAyudante(asig, selectedWeekIdx(), $event)"
                                    (keydown.space)="onEliminarAyudante(asig, selectedWeekIdx(), $event)"
                                    class="pill-x shrink-0"
                                    aria-label="Quitar ayudante"
                                    title="Quitar ayudante">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                      <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>
                                    </svg>
                                  </span>
                                }
                                @if (!asig.es_ayudante && asig.estado !== 'sin_asignar' && hasEditPermission()) {
                                  <span
                                    role="button"
                                    tabindex="0"
                                    (click)="onQuitarAsignacion(asig, selectedWeekIdx(), $event)"
                                    (keydown.enter)="onQuitarAsignacion(asig, selectedWeekIdx(), $event)"
                                    (keydown.space)="onQuitarAsignacion(asig, selectedWeekIdx(), $event)"
                                    class="pill-x shrink-0"
                                    aria-label="Dejar esta parte sin asignar"
                                    title="Dejar sin asignar">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                                      <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/>
                                    </svg>
                                  </span>
                                }
                              </button>
                              @if (mostrarWhatsappPapeleta(asig)) {
                                <button
                                  type="button"
                                  data-testid="btn-whatsapp-papeleta"
                                  (click)="enviarPapeletaWhatsapp(asig, $event)"
                                  [disabled]="enviandoEstaPapeleta(asig)"
                                  title="Enviar su asignación por WhatsApp"
                                  aria-label="Enviar su asignación por WhatsApp"
                                  class="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 text-white shadow ring-2 ring-white dark:ring-slate-900 hover:bg-emerald-600 transition-all active:scale-90 disabled:opacity-50">
                                  @if (enviandoEstaPapeleta(asig)) {
                                    <svg class="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                                  } @else {
                                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.44 1.32 4.94L2.05 22l5.29-1.39a9.85 9.85 0 0 0 4.7 1.2h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.86 9.86 0 0 0 12.04 2m0 1.67c2.2 0 4.27.86 5.82 2.42a8.2 8.2 0 0 1 2.42 5.82c0 4.54-3.7 8.24-8.25 8.24a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.18 8.18 0 0 1-1.26-4.38c0-4.55 3.7-8.22 8.26-8.22M8.53 6.7c-.17 0-.45.06-.68.32-.24.25-.9.88-.9 2.15s.92 2.5 1.05 2.67c.13.17 1.8 2.87 4.43 3.91 2.19.87 2.64.7 3.11.65.48-.04 1.53-.62 1.75-1.22.22-.6.22-1.11.15-1.22-.06-.1-.24-.16-.5-.29-.26-.13-1.53-.75-1.77-.84-.24-.09-.41-.13-.58.13-.17.26-.67.84-.82 1.01-.15.17-.3.19-.56.06-.26-.13-1.09-.4-2.07-1.28-.77-.68-1.28-1.53-1.44-1.79-.15-.26-.02-.4.11-.53.12-.11.26-.3.4-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45C9.44 8.4 8.94 7.14 8.72 6.63c-.18-.42-.36-.4-.5-.4"/></svg>
                                  }
                                </button>
                              }
                            </div>
                            }
                          }
                          <!-- + Ayudante: acción secundaria, así que va en
                               contorno y no rellena. Sólo toma el tono de la
                               sección al pasar por encima. -->
                          @if (puedeAgregarAyudante(grupo, seccion) && hasEditPermission()) {
                            <button
                              (click)="onAgregarAyudante(grupo, selectedWeekIdx())"
                              [disabled]="loadingAyudante() === grupo.partes[0].id_programa_parte"
                              class="sec-ghost-btn flex items-center gap-1 px-2.5 h-7 rounded-full text-[0.6rem] font-bold border transition-[background-color,border-color,color,transform] duration-150 active:scale-95 disabled:opacity-40">
                              @if (loadingAyudante() === grupo.partes[0].id_programa_parte) {
                                <svg class="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                              } @else {
                                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              }
                              Ayudante
                            </button>
                          }
                        </div>
                      </div>
                      </div>
                    }
                  </div>
                </section>
              }
            </div>
          }

      </div>
      } <!-- end @if tipoReunionActivo !== logistica -->
    </div>

    <!-- ── PANEL DE CANDIDATOS (escritorio) ──
         Vive aquí, fuera de las tarjetas de sección, y no dentro de cada
         píldora como antes: anclado con position:absolute dentro de la
         tarjeta, el overflow-hidden que le da su esquina redondeada lo
         recortaba -"se ven tapados"-, y cerca del borde de la lista quedaba
         mal posicionado o cortado a la mitad. Ahora es fixed, calculado
         desde la posición real de la píldora en pantalla (mismo patrón que
         el combobox de Logística), así que ningún contenedor con scroll o
         esquina redondeada vuelve a tocarlo. -->
    <!-- ── PANEL "CAMBIAR ASIGNADO" (escritorio) ──
         Uno solo para borrador y publicado: son el mismo dato con distinto
         estado, así que se edita por el mismo sitio. Antes había dos paneles
         casi idénticos, uno por estado, y cada uno escribía en un sitio
         distinto. -->
    @if (editingHistorialId() !== null && dropdownPos(); as pos) {
      @if (mobileSheetAsig(); as asig) {
        @if (mobileSheetSeccion(); as seccion) {
          <div
            class="dropdown-panel hidden md:block fixed z-50 w-64 max-w-[16rem] overflow-hidden"
            data-dropdown-popover
            style="border-radius:14px"
            [style.top.px]="pos.top"
            [style.left.px]="pos.left"
            [style.transform]="pos.openUp ? 'translateY(-100%)' : 'none'">
            <div class="dropdown-header px-3.5 py-2.5 flex items-center gap-2">
              <span class="w-[3px] h-3.5 rounded-full shrink-0" [style.background-color]="seccion.color"></span>
              <span class="dropdown-label text-[0.6rem] font-bold uppercase tracking-widest flex-1">Cambiar asignado</span>
              @if (asig.es_ayudante && asig.alternativos?.length) {
                <div class="flex items-center gap-0.5">
                  @for (opt of sexoOpts; track opt.v) {
                    <button
                      (click)="setSexoFilter(asig, opt.v); $event.stopPropagation()"
                      class="px-1.5 h-5 rounded text-[0.55rem] font-black transition-all active:scale-95"
                      [style]="getSexoFilter(asig) === opt.v
                        ? 'background:' + seccion.color + '; color:white'
                        : 'opacity:0.4'">
                      {{ opt.l }}
                    </button>
                  }
                </div>
              }
            </div>
            <!-- Buscador -->
            <div class="px-2 pb-1.5">
              <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <svg class="w-3 h-3 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  placeholder="Buscar persona..."
                  [value]="busquedaCandidato()"
                  (input)="onBusquedaCandidatoChange($any($event.target).value)"
                  class="flex-1 bg-transparent text-[0.72rem] text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none min-w-0"
                />
                @if (loadingBusqueda()) {
                  <div class="w-3 h-3 rounded-full border-2 border-slate-300 border-t-[#6D28D9] animate-spin shrink-0"></div>
                }
              </div>
            </div>
            <div class="px-1.5 pb-1.5 flex flex-col gap-0.5 max-h-56 overflow-y-auto">
              @if (busquedaCandidato().trim()) {
                <!-- Resultados de búsqueda libre -->
                @if (busquedaResultados().length === 0 && !loadingBusqueda()) {
                  <p class="text-[0.65rem] text-slate-400 text-center py-3">Sin resultados</p>
                }
                @for (pub of busquedaResultados(); track pub.id_publicador) {
                  <button
                    (click)="selectHistorialCandidato(selectedWeekIdx(), asig, { id_publicador: pub.id_publicador, nombre_completo: pub.nombre_completo, score: 0, notas_score: [], sexo: pub.sexo })"
                    class="dropdown-alt-row w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-[8px]">
                    <span class="dropdown-alt-name text-[0.75rem] font-semibold truncate flex-1">{{ pub.nombre_completo }}</span>
                    @if (pub.ausente) {
                      <span class="shrink-0 px-1.5 py-0.5 rounded text-[0.6rem] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                            [title]="pub.ausencia_motivo || 'Ausente esta fecha'">Ausente</span>
                    }
                  </button>
                }
              } @else {
                <!-- Sugeridos por algoritmo -->
                @if (loadingCandidatos()) {
                  <div class="flex items-center justify-center py-3">
                    <div class="w-4 h-4 rounded-full border-2 border-slate-200 border-t-[#6D28D9] animate-spin"></div>
                  </div>
                } @else if (candidatosPanel(asig).length === 0) {
                  <p class="text-[0.65rem] text-slate-400 text-center py-3">Sin candidatos disponibles</p>
                } @else {
                  <p class="text-[0.58rem] text-slate-400 uppercase tracking-widest px-2 pb-0.5">Sugeridos</p>
                  @for (alt of candidatosPanel(asig); track alt.id_publicador) {
                    <button
                      data-testid="candidato"
                      [attr.data-id]="alt.id_publicador"
                      (click)="selectHistorialCandidato(selectedWeekIdx(), asig, alt)"
                      class="dropdown-alt-row w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left rounded-[8px]">
                      <span class="dropdown-alt-name text-[0.75rem] font-semibold truncate">{{ alt.nombre_completo }}</span>
                      <span class="score-chip text-[0.6rem] font-black font-mono shrink-0 tabular-nums px-1.5 py-0.5 rounded-[4px]"
                        [style.--sec]="seccion.color">
                        {{ alt.score | number:'1.2-2' }}
                      </span>
                    </button>
                  }
                }
              }
            </div>
          </div>
        }
      }
    }

    <!-- ── SHEET DE CANDIDATOS (móvil) ── -->
    @if (mobileSheetAsig() !== null) {
      <div
        class="md:hidden fixed inset-0 z-[62] bg-black/40 backdrop-blur-sm"
        (click)="closeMobileSheet()"
        aria-hidden="true">
      </div>
      <div
        class="md:hidden fixed left-0 right-0 bottom-0 z-[63] bg-white dark:bg-slate-900 rounded-t-2xl shadow-2xl border-t border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh] animate-slideUp"
        role="dialog" aria-modal="true">
        <!-- Handle -->
        <div class="shrink-0 flex items-center justify-center pt-2.5 pb-1">
          <span class="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
        </div>
        <!-- Header -->
        <div class="shrink-0 flex items-center gap-2 px-4 pb-2.5 border-b border-slate-100 dark:border-slate-800">
          <span class="w-[3px] h-4 rounded-full shrink-0" [style.background-color]="mobileSheetSeccion()?.color"></span>
          <span class="flex-1 text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
            Cambiar asignado
          </span>
          @if (mobileSheetAsig()?.es_ayudante && mobileSheetAsig()?.alternativos?.length) {
            <div class="flex items-center gap-0.5">
              @for (opt of sexoOpts; track opt.v) {
                <button
                  (click)="setSexoFilter(mobileSheetAsig()!, opt.v); $event.stopPropagation()"
                  class="px-1.5 h-5 rounded text-[0.55rem] font-black transition-all active:scale-95"
                  [style]="getSexoFilter(mobileSheetAsig()!) === opt.v
                    ? 'background:' + mobileSheetSeccion()?.color + '; color:white'
                    : 'opacity:0.4'">{{ opt.l }}</button>
              }
            </div>
          }
          <button (click)="closeMobileSheet()"
            class="w-9 h-9 -mr-2 rounded-lg flex items-center justify-center text-slate-400 active:scale-95 transition-transform">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <!-- Search -->
        <div class="shrink-0 px-3 pt-3 pb-2">
          <div class="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="text"
              placeholder="Buscar persona..."
              [value]="busquedaCandidato()"
              (input)="onBusquedaCandidatoChange($any($event.target).value)"
              class="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none min-w-0" />
            @if (loadingBusqueda()) {
              <div class="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-[#6D28D9] animate-spin shrink-0"></div>
            }
          </div>
        </div>
        <!-- Candidate list. Una sola lista para borrador y publicado: mismo
             dato, mismo camino de edición. -->
        <div class="flex-1 min-h-0 px-2 pb-4 flex flex-col gap-0.5 overflow-y-auto simple-scrollbar">
          @if (busquedaCandidato().trim()) {
            @if (busquedaResultados().length === 0 && !loadingBusqueda()) {
              <p class="text-xs text-slate-400 text-center py-5">Sin resultados</p>
            }
            @for (pub of busquedaResultados(); track pub.id_publicador) {
              <button
                (click)="selectHistorialCandidato(selectedWeekIdx(), mobileSheetAsig()!, { id_publicador: pub.id_publicador, nombre_completo: pub.nombre_completo, score: 0, notas_score: [], sexo: pub.sexo }); closeMobileSheet()"
                class="dropdown-alt-row w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl">
                <span class="dropdown-alt-name text-sm font-semibold truncate flex-1">{{ pub.nombre_completo }}</span>
                @if (pub.ausente) {
                  <span class="shrink-0 px-1.5 py-0.5 rounded text-[0.6rem] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
                        [title]="pub.ausencia_motivo || 'Ausente esta fecha'">Ausente</span>
                }
              </button>
            }
          } @else {
            @if (loadingCandidatos()) {
              <div class="flex items-center justify-center py-5">
                <div class="w-5 h-5 rounded-full border-2 border-slate-200 border-t-[#6D28D9] animate-spin"></div>
              </div>
            } @else if (candidatosPanel(mobileSheetAsig()!).length === 0) {
              <p class="text-xs text-slate-400 text-center py-5">Sin candidatos disponibles</p>
            } @else {
              <p class="text-[0.58rem] text-slate-400 uppercase tracking-widest px-2 pb-0.5 pt-1">Sugeridos</p>
              @for (alt of candidatosPanel(mobileSheetAsig()!); track alt.id_publicador) {
                <button
                  (click)="selectHistorialCandidato(selectedWeekIdx(), mobileSheetAsig()!, alt); closeMobileSheet()"
                  class="dropdown-alt-row w-full flex items-center justify-between gap-3 px-3 py-3 text-left rounded-xl">
                  <span class="dropdown-alt-name text-sm font-semibold truncate flex-1">{{ alt.nombre_completo }}</span>
                  <span class="score-chip text-[0.6rem] font-black font-mono shrink-0 tabular-nums px-1.5 py-0.5 rounded-[4px]"
                    [style.--sec]="mobileSheetSeccion()?.color">
                    {{ alt.score | number:'1.2-2' }}
                  </span>
                </button>
              }
            }
          }
        </div>
      </div>
    }

    <!-- ===== MODAL GENERAR MES ===== -->
    @if (showModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" (click)="showModal.set(false)">
        <div
          data-testid="modal-generar-mes"
          class="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col gap-5"
          (click)="$event.stopPropagation()">

          <h2 class="text-base font-black text-slate-800 dark:text-white">Generar Programa del Mes</h2>

          @if (diaReunionSinConfigurar()) {
            <div data-testid="aviso-dia-sin-configurar" class="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50">
              <svg class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div class="min-w-0">
                <p class="text-xs font-bold text-amber-700 dark:text-amber-300">Día de reunión no configurado</p>
                <p class="text-xs text-amber-600 dark:text-amber-400 mt-0.5 leading-relaxed">
                  Esta congregación no tiene configurado el día de
                  {{ tipoReunionActivo() === 'entre_semana' ? 'reunión entre semana' : 'la reunión pública' }},
                  por lo que no es posible generar el programa.
                  Configúralo en <span class="font-semibold">Configuración → Congregación</span> y vuelve a intentarlo.
                </p>
              </div>
            </div>
          }

          <div class="flex flex-col gap-1">
            <label class="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Plantilla</label>
            @if (loadingPlantillas()) {
              <div class="flex items-center gap-2 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-400">
                <div class="w-3.5 h-3.5 border-2 border-slate-300 dark:border-slate-600 border-t-violet-500 rounded-full animate-spin"></div>
                Cargando plantillas...
              </div>
            } @else if (plantillas().length === 0) {
              <div class="h-9 flex items-center px-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-xs text-slate-400">
                No hay plantillas disponibles.
              </div>
            } @else {
              <div class="relative">
                @if (showPlantillaDropdown()) {
                  <div class="fixed inset-0 z-[59]" (click)="showPlantillaDropdown.set(false)"></div>
                }
                <button
                  type="button"
                  data-testid="selector-plantilla"
                  (click)="showPlantillaDropdown.set(!showPlantillaDropdown())"
                  class="h-9 w-full px-3 rounded-xl border bg-white dark:bg-slate-800 text-sm text-left flex items-center justify-between gap-2 outline-none transition-[border-color,background-color] duration-150 ease-out"
                  [class]="showPlantillaDropdown()
                    ? 'border-violet-500 ring-2 ring-violet-400/30'
                    : 'border-slate-200 dark:border-slate-600 hover:border-violet-300 dark:hover:border-violet-700'">
                  <span class="flex-1 min-w-0">
                    @if (plantillaSeleccionada; as sel) {
                      <span class="block truncate text-slate-800 dark:text-slate-100">{{ sel.nombre }}</span>
                    } @else {
                      <span class="block text-slate-400">Seleccionar plantilla...</span>
                    }
                  </span>
                  <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-150" [class.rotate-180]="showPlantillaDropdown()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
                @if (showPlantillaDropdown()) {
                  <div class="absolute left-0 top-full mt-1.5 w-full max-h-64 overflow-y-auto simple-scrollbar bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[60] py-1.5">
                    @for (p of plantillasOrdenadas(); track p.id_plantilla) {
                      <button
                        type="button"
                        data-testid="opcion-plantilla"
                        [attr.data-id]="p.id_plantilla"
                        (click)="updateModal('id_plantilla', p.id_plantilla); showPlantillaDropdown.set(false)"
                        class="w-full px-3.5 py-2 text-sm font-semibold text-left transition-colors duration-100"
                        [class]="modalForm().id_plantilla === p.id_plantilla
                          ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'">
                        {{ p.nombre }}
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>

          @if (plantillaSeleccionada && plantillaSeleccionada.mes_inicio == null) {
            <div class="flex flex-col gap-1">
              <label class="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mes y año</label>
              <div class="relative">
                @if (showMesAnoDropdown()) {
                  <div class="fixed inset-0 z-[59]" (click)="showMesAnoDropdown.set(false)"></div>
                }
                <button
                  type="button"
                  data-testid="selector-mes-ano"
                  (click)="showMesAnoDropdown.set(!showMesAnoDropdown())"
                  class="h-9 w-full px-3 rounded-xl border bg-white dark:bg-slate-800 text-sm text-left flex items-center justify-between gap-2 outline-none transition-[border-color,background-color] duration-150 ease-out"
                  [class]="showMesAnoDropdown()
                    ? 'border-violet-500 ring-2 ring-violet-400/30'
                    : 'border-slate-200 dark:border-slate-600 hover:border-violet-300 dark:hover:border-violet-700'">
                  <span class="flex-1 min-w-0 truncate text-slate-800 dark:text-slate-100">
                    {{ mesLabel(modalForm().mes) }} {{ modalForm().ano }}
                  </span>
                  <svg class="w-3.5 h-3.5 shrink-0 text-slate-400 transition-transform duration-150" [class.rotate-180]="showMesAnoDropdown()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
                @if (showMesAnoDropdown()) {
                  <div class="absolute left-0 top-full mt-1.5 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-[60] overflow-hidden">
                    <div class="p-1.5 border-b border-slate-100 dark:border-slate-700">
                      <input
                        type="text"
                        data-testid="buscador-mes-ano"
                        [ngModel]="mesAnoBusqueda()"
                        (ngModelChange)="mesAnoBusqueda.set($event)"
                        (click)="$event.stopPropagation()"
                        placeholder="Buscar mes o año..."
                        class="h-8 w-full px-2.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-400/30 transition-[border-color] duration-150 ease-out">
                    </div>
                    <div class="max-h-56 overflow-y-auto simple-scrollbar py-1.5">
                      @for (p of periodosMesAnoFiltrados(); track p.ano + '-' + p.mes) {
                        <button
                          type="button"
                          data-testid="opcion-mes-ano"
                          [attr.data-ano]="p.ano"
                          [attr.data-mes]="p.mes"
                          (click)="updateModalMesAno(p.ano + '-' + p.mes); showMesAnoDropdown.set(false)"
                          class="w-full px-3.5 py-2 text-sm font-semibold text-left transition-colors duration-100"
                          [class]="modalForm().mes === p.mes && modalForm().ano === p.ano
                            ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'">
                          {{ p.label }}
                        </button>
                      } @empty {
                        <p class="px-3.5 py-2 text-xs text-slate-400">Sin resultados.</p>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50">
            <p class="text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">{{ fechasPreview().length }} semanas a crear</p>
            <div class="flex flex-wrap justify-center gap-1.5">
              @for (fecha of fechasPreview(); track fecha) {
                <span class="flex items-center justify-center py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[0.65rem] font-mono font-medium text-slate-600 dark:text-slate-500 shadow-sm w-[calc(33.3%-0.25rem)]">
                  {{ fecha }}
                </span>
              }
            </div>
          </div>

          <div class="flex gap-2 justify-end">
            <button
              (click)="showModal.set(false)"
              class="px-4 h-9 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
              Cancelar
            </button>
            <button
              data-testid="btn-generar-programa"
              (click)="onModalSubmit()"
              [disabled]="loadingPlantillas() || plantillas().length === 0 || modalForm().id_plantilla === 0 || diaReunionSinConfigurar() || modalForm().dia_reunion === null || (tipoReunionActivo() === 'entre_semana' && plantillaSeleccionada?.mes_inicio == null)"
              class="px-4 h-9 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-white transition-all active:scale-95">
              Generar Programa
            </button>
          </div>

        </div>
      </div>
    }

    <!-- ===== MODAL CONFLICTOS DE REGENERACIÓN ===== -->
    @if (showConflictoModal()) {
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-fadeIn" (click)="cancelarConflictoModal()"></div>
      <div class="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
        <div class="pointer-events-auto w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-5 animate-slideUp">
          <div class="flex items-start gap-3 mb-4">
            <div class="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <svg class="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">Meses ya generados</h3>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Los siguientes meses ya tienen programa:</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5 mb-4">
            @for (c of conflictosDetectados(); track c.ano + '-' + c.mes) {
              <span class="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 text-xs font-semibold text-amber-700 dark:text-amber-400">
                {{ c.label }}
              </span>
            }
          </div>
          @if (mesesFaltantes().length > 0) {
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">Se pueden generar los meses faltantes:</p>
            <div class="flex flex-wrap gap-1.5 mb-5">
              @for (m of mesesFaltantes(); track m.ano + '-' + m.mes) {
                <span class="px-2.5 py-1 rounded-full bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 text-xs font-semibold text-violet-700 dark:text-violet-400">
                  {{ m.label }}
                </span>
              }
            </div>
            <div class="flex gap-2">
              <button
                (click)="cancelarConflictoModal()"
                class="flex-1 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95">
                Cancelar
              </button>
              <button
                (click)="confirmarGenerarFaltantes()"
                class="flex-1 h-10 rounded-xl bg-[#6D28D9] hover:bg-[#5b21b6] text-xs text-white font-bold transition-all shadow-sm shadow-purple-900/20 active:scale-95">
                Generar faltantes
              </button>
            </div>
          } @else {
            <p class="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Todos los meses de esta guía ya están generados. Para regenerar un mes, elimínalo primero desde el historial.
            </p>
            <button
              (click)="cancelarConflictoModal()"
              class="w-full h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-500 font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95">
              Entendido
            </button>
          }
        </div>
      </div>
    }

    <!-- Cerrar dropdown al hacer clic fuera. Cubre las dos variantes -edición
         de borrador y edición de historial-: antes sólo la primera tenía
         overlay, así que "Cambiar asignado" únicamente se cerraba clicando
         otra vez la misma píldora. -->
    @if (editingHistorialId() !== null) {
      <div class="fixed inset-0 z-30" (click)="cerrarDropdown()"></div>
    }

    <!-- ===== PAPELETA LISTA PARA WHATSAPP =====
         WhatsApp no acepta adjuntos por enlace, así que la imagen se pega o
         se descarga a mano. Esto se muestra ANTES de abrir el chat: después
         el foco ya está en la otra pestaña y nadie lee el aviso. -->
    @if (papeletaPreview(); as prev) {
      <div class="confirm-overlay" (click)="cerrarPapeletaPreview()">
        <div class="papeleta-dialog" (click)="$event.stopPropagation()">
          <div class="papeleta-head">
            <p class="confirm-title">Asignación de {{ prev.nombre }}</p>
            <button class="papeleta-close" (click)="cerrarPapeletaPreview()" aria-label="Cerrar">✕</button>
          </div>

          <img [src]="prev.url" alt="Papeleta de asignación de {{ prev.nombre }}" class="papeleta-img" />

          <div class="papeleta-hint" [class.ok]="prev.copiada">
            @if (prev.copiada) {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              <span>Imagen copiada. En el chat, pégala con <b>Ctrl/Cmd + V</b> y envíala.</span>
            } @else {
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>
              <span>Descarga la imagen y adjúntala en el chat.</span>
            }
          </div>

          @if (!prev.telefono) {
            <p class="papeleta-sin-tel">Sin teléfono registrado: WhatsApp abrirá para que elijas el contacto.</p>
          }

          <div class="confirm-actions">
            <button class="confirm-btn-cancel" (click)="descargarPapeletaPreview()">Descargar imagen</button>
            <button class="papeleta-btn-wa" (click)="abrirChatPapeleta()">Abrir WhatsApp</button>
          </div>
        </div>
      </div>
    }

    <!-- ===== DIÁLOGO DE CONFIRMACIÓN ===== -->
    @if (confirmDialog(); as dlg) {
      <div class="confirm-overlay" (click)="onConfirmDialogAction(false)">
        <div class="confirm-dialog" (click)="$event.stopPropagation()">
          <!-- Icono -->
          <div class="confirm-icon-wrap">
            <svg class="confirm-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <!-- Texto -->
          <div class="confirm-text">
            <p class="confirm-title">{{ dlg.title }}</p>
            <p class="confirm-body">{{ dlg.body }}</p>
          </div>
          <!-- Acciones -->
          <div class="confirm-actions">
            <button class="confirm-btn-cancel" (click)="onConfirmDialogAction(false)">Cancelar</button>
            <button class="confirm-btn-delete" (click)="onConfirmDialogAction(true)">{{ dlg.confirmLabel || 'Eliminar' }}</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }

    /* ── Custom easing curves (Emil: never use browser defaults) ── */
    :host {
      --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
      --ease-in-out-expo: cubic-bezier(0.77, 0, 0.175, 1);
    }

    /* ── Identidad de color por sección ──
       Mismo sistema que Logística: el tono llega como --sec desde la plantilla
       (un solo hex por sección) y de ahí se derivan superficie, tinta y
       bordes. Se deriva en CSS y no en TypeScript porque cada tema necesita
       mezclas distintas del mismo tono -en claro la tinta se oscurece para
       pasar contraste, en oscuro se aclara-, y hacerlo aquí evita que la
       lista entera se recalcule al cambiar de tema. */
    .sec-card {
      --sec-surface: color-mix(in oklch, var(--sec) 12%, transparent);
      --sec-ink:     color-mix(in oklch, var(--sec) 75%, black 25%);
      --sec-edge:    color-mix(in oklch, var(--sec) 30%, transparent);
      --sec-frame:   color-mix(in oklch, var(--sec) 24%, transparent);
      --sec-badge:   color-mix(in oklch, var(--sec) 14%, transparent);
      /* Los filetes entre filas llevan el mismo tono que el marco de la
         tarjeta, pero más tenue: bastante para leerse como "esto sigue
         siendo Tesoros de la Biblia", no tanto como para competir con el
         borde de la tarjeta que sí marca dónde empieza y acaba la sección. */
      --sec-line:    color-mix(in oklch, var(--sec) 16%, transparent);
      --card-bg:       #ffffff;
      --card-bg-hover: #f8fafc;
    }
    :host-context(.dark) .sec-card {
      --sec-surface: color-mix(in oklch, var(--sec) 24%, transparent);
      --sec-ink:     color-mix(in oklch, var(--sec) 45%, white 55%);
      --sec-edge:    color-mix(in oklch, var(--sec) 48%, transparent);
      --sec-frame:   color-mix(in oklch, var(--sec) 40%, transparent);
      --sec-badge:   color-mix(in oklch, var(--sec) 26%, transparent);
      --sec-line:    color-mix(in oklch, var(--sec) 22%, transparent);
      --card-bg:       #161d2c;
      --card-bg-hover: #1d2739;
    }
    .sec-bg    { background-color: var(--card-bg); }
    .sec-frame { border-color: var(--sec-frame); }
    /* border-color no se hereda: divide-y pinta el borde en los HIJOS de
       .sec-line, no en .sec-line misma, así que fijarlo en el propio
       elemento no llegaba a ninguna parte y se veía el gris por defecto de
       Tailwind. Hay que apuntar directo a los hijos que reciben el borde
       -y en Tailwind v4 divide-y pone border-bottom en todos menos el
       último (:not(:last-child)), no border-top en todos menos el primero:
       con "* + *" la primera fila se quedaba con el gris de Tailwind en su
       borde inferior porque ese selector apunta a otro hijo distinto. */
    .sec-line > :not(:last-child) { border-color: var(--sec-line); }
    /* El velo va como background-image sobre el color de fondo que ya pone
       Tailwind, no como background: el atajo pisaría ese color y la cabecera
       quedaría translúcida. */
    .sec-surface {
      background-image: linear-gradient(var(--sec-surface), var(--sec-surface));
      border-color: var(--sec-edge);
    }
    .sec-ink   { color: var(--sec-ink); }
    .sec-badge {
      color: var(--sec-ink);
      background-image: linear-gradient(var(--sec-badge), var(--sec-badge));
    }

    /* Chip de puntuación. Vive en los desplegables y en la hoja móvil, que
       cuelgan fuera de la tarjeta de sección, así que no hereda sus tokens:
       recibe --sec por estilo en línea y deriva los suyos. */
    .score-chip {
      color: color-mix(in oklch, var(--sec) 75%, black 25%);
      background-image: linear-gradient(
        color-mix(in oklch, var(--sec) 14%, transparent),
        color-mix(in oklch, var(--sec) 14%, transparent));
    }
    :host-context(.dark) .score-chip {
      color: color-mix(in oklch, var(--sec) 45%, white 55%);
      background-image: linear-gradient(
        color-mix(in oklch, var(--sec) 26%, transparent),
        color-mix(in oklch, var(--sec) 26%, transparent));
    }

    /* Segmentado de sala dentro de la cabecera */
    .sec-seg { border-color: var(--sec-edge); }
    .sec-seg-btn { color: var(--sec-ink); opacity: 0.6; }
    .sec-seg-btn:hover { opacity: 0.85; }
    .sec-seg-btn.is-on {
      background: var(--sec);
      color: #fff;
      opacity: 1;
      box-shadow: 0 1px 3px rgba(0,0,0,0.18);
    }

    /* Acción secundaria en contorno: sólo se tiñe al pasar por encima. */
    .sec-ghost-btn {
      color: var(--sec-ink);
      border-color: var(--sec-edge);
      background: transparent;
    }
    .sec-ghost-btn:not(:disabled):hover {
      background-image: linear-gradient(var(--sec-badge), var(--sec-badge));
      border-color: var(--sec);
    }

    /* ── Fila de parte ── */
    @keyframes cardIn {
      from { opacity: 0; transform: translateY(5px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .parte-row {
      position: relative;
      z-index: 1;
      transition: background-color 150ms var(--ease-out-expo);
      animation: cardIn 220ms var(--ease-out-expo) backwards;
    }
    .parte-row.is-open,
    .parte-row.dropdown-active { z-index: 50; }
    @media (hover: hover) and (pointer: fine) {
      .parte-row:hover { background-color: var(--card-bg-hover); }
    }
    /* Los estados ya se anuncian con su etiqueta dentro de la fila; aquí un
       velo tenue del mismo color para localizarlos al recorrer la lista. */
    .parte-row.has-conflict { background-color: rgb(239 68 68 / 0.06); }
    .parte-row.has-swapped  { background-color: rgb(245 158 11 / 0.07); }
    :host-context(.dark) .parte-row.has-conflict { background-color: rgb(239 68 68 / 0.12); }
    :host-context(.dark) .parte-row.has-swapped  { background-color: rgb(245 158 11 / 0.12); }

    .parte-row:nth-child(1)  { animation-delay:  15ms; }
    .parte-row:nth-child(2)  { animation-delay:  40ms; }
    .parte-row:nth-child(3)  { animation-delay:  65ms; }
    .parte-row:nth-child(4)  { animation-delay:  90ms; }
    .parte-row:nth-child(5)  { animation-delay: 115ms; }
    .parte-row:nth-child(6)  { animation-delay: 140ms; }
    .parte-row:nth-child(n+7){ animation-delay: 160ms; }

    /* ── Etiquetas de estado ── */
    .estado-tag {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.6rem;
      font-weight: 700;
      line-height: 1;
      white-space: nowrap;
    }
    .estado-dot {
      width: 0.3125rem;
      height: 0.3125rem;
      border-radius: 9999px;
      background: currentColor;
    }
    .estado-tag[data-estado="conflicto"]  { color: #dc2626; }
    .estado-tag[data-estado="reemplazo"]  { color: #64748b; }
    .estado-tag[data-estado="modificado"] { color: #b45309; }
    :host-context(.dark) .estado-tag[data-estado="conflicto"]  { color: #f87171; }
    :host-context(.dark) .estado-tag[data-estado="reemplazo"]  { color: #94a3b8; }
    :host-context(.dark) .estado-tag[data-estado="modificado"] { color: #fbbf24; }

    @media (prefers-reduced-motion: reduce) {
      .parte-row { animation: none; }
    }

    /* ── Assignee pill button ── */
    .assignee-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 14px;
      height: 30px;
      border-radius: 999px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.01em;
      border: 1px solid transparent;
      cursor: pointer;
      transition: transform 120ms var(--ease-out-expo),
                  background-color 120ms ease,
                  box-shadow 120ms ease,
                  border-color 120ms ease;
    }
    .assignee-btn:active:not(:disabled) {
      transform: scale(0.97);
    }
    .assignee-btn:disabled { opacity: 0.5; cursor: default; }

    /* Normal state */
    .assignee-btn.normal {
      background: rgba(109,40,217,0.08);
      color: #5b21b6;
      border-color: rgba(109,40,217,0.18);
      box-shadow: 0 1px 2px rgba(109,40,217,0.06);
    }
    :host-context(.dark) .assignee-btn.normal {
      background: rgba(139,92,246,0.12);
      color: #c4b5fd;
      border-color: rgba(139,92,246,0.22);
    }
    @media (hover: hover) and (pointer: fine) {
      .assignee-btn.normal:not(:disabled):hover {
        background: rgba(109,40,217,0.13);
        box-shadow: 0 2px 6px rgba(109,40,217,0.12);
      }
    }
    /* Conflict state */
    .assignee-btn.conflict {
      background: rgba(239,68,68,0.07);
      color: #dc2626;
      border-color: rgba(239,68,68,0.25);
    }
    :host-context(.dark) .assignee-btn.conflict {
      background: rgba(239,68,68,0.12);
      color: #fca5a5;
      border-color: rgba(239,68,68,0.3);
    }
    /* Swapped state */
    .assignee-btn.swapped {
      background: rgba(245,158,11,0.09);
      color: #b45309;
      border-color: rgba(245,158,11,0.28);
    }
    :host-context(.dark) .assignee-btn.swapped {
      background: rgba(245,158,11,0.12);
      color: #fcd34d;
      border-color: rgba(245,158,11,0.3);
    }

    /* ── Quitar de la píldora (ayudante o titular) ──
       Su propio blanco de impacto de 18px, no el glifo de 8px, así el dedo
       no falla; el tinte pasa a rojo solo al interactuar, para no competir
       con el nombre cuando no se está apuntando a él. */
    .pill-x {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      border-radius: 999px;
      color: currentColor;
      opacity: 0.45;
      cursor: pointer;
      transition: opacity 120ms ease, background-color 120ms ease, color 120ms ease, transform 120ms var(--ease-out-expo);
    }
    .pill-x svg { width: 9px; height: 9px; }
    .pill-x:hover,
    .pill-x:focus-visible {
      opacity: 1;
      color: #dc2626;
      background: rgba(220,38,38,0.12);
    }
    :host-context(.dark) .pill-x:hover,
    :host-context(.dark) .pill-x:focus-visible {
      color: #fca5a5;
      background: rgba(248,113,113,0.16);
    }
    .pill-x:focus-visible { outline: 2px solid #dc2626; outline-offset: 1px; }
    .pill-x:active { transform: scale(0.88); }

    /* ── Dropdown: origin-aware scale (Emil: never scale from center on popovers) ── */
    @keyframes dropIn {
      from { opacity: 0; transform: scale(0.95) translateY(-4px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    .dropdown-panel {
      transform-origin: top right;
      animation: dropIn 160ms var(--ease-out-expo);
      background: white;
      border: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    }
    :host-context(.dark) .dropdown-panel {
      background: #1e293b;
      border-color: rgba(255,255,255,0.1);
      box-shadow: 0 8px 30px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3);
    }
    .dropdown-header {
      border-bottom: 1px solid rgba(0,0,0,0.06);
      background: rgba(0,0,0,0.02);
    }
    :host-context(.dark) .dropdown-header {
      background: rgba(255,255,255,0.03);
      border-bottom-color: rgba(255,255,255,0.08);
    }
    .dropdown-label { color: #94a3b8; }
    :host-context(.dark) .dropdown-label { color: #cbd5e1; }
    .dropdown-alt-name { color: #334155; }
    :host-context(.dark) .dropdown-alt-name { color: #e2e8f0; }
    .dropdown-alt-row {
      transition: background-color 80ms ease-out;
      background: transparent;
    }
    .dropdown-alt-row:hover { background: rgba(0,0,0,0.04); }
    :host-context(.dark) .dropdown-alt-row:hover { background: rgba(255,255,255,0.06); }

    /* ── Chevron rotate ── */
    .chevron {
      transition: transform 180ms var(--ease-out-expo);
    }
    .chevron.open { transform: rotate(180deg); }

    /* ── Section fadeIn (page-level) ── */
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-fadeIn { animation: fadeIn 0.15s ease-out; }

    /* ── Bottom-sheet slide up (mobile meses) ── */
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(100%); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .animate-slideUp { animation: slideUp 0.22s cubic-bezier(0.32, 0.72, 0, 1); }

    /* ── Action buttons (Confirmar / Borrar) ── */
    .btn-confirmar {
      background: rgba(5,150,105,0.08);
      border-color: rgba(5,150,105,0.25);
      color: #047857;
      transition: background-color 120ms ease-out, border-color 120ms ease-out;
    }
    .btn-confirmar:not(:disabled):hover {
      background: rgba(5,150,105,0.14);
    }
    :host-context(.dark) .btn-confirmar {
      background: rgba(52,211,153,0.1);
      border-color: rgba(52,211,153,0.22);
      color: #6ee7b7;
    }
    :host-context(.dark) .btn-confirmar:not(:disabled):hover {
      background: rgba(52,211,153,0.18);
    }
    .btn-borrar {
      background: rgba(220,38,38,0.07);
      border-color: rgba(220,38,38,0.22);
      color: #b91c1c;
      transition: background-color 120ms ease-out, border-color 120ms ease-out;
    }
    .btn-borrar:not(:disabled):hover {
      background: rgba(220,38,38,0.13);
    }
    :host-context(.dark) .btn-borrar {
      background: rgba(248,113,113,0.1);
      border-color: rgba(248,113,113,0.2);
      color: #fca5a5;
    }
    :host-context(.dark) .btn-borrar:not(:disabled):hover {
      background: rgba(248,113,113,0.16);
    }

    /* ── Diálogo de confirmación ── */
    @keyframes overlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes dialogIn {
      from { opacity: 0; transform: scale(0.95) translateY(4px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    /* Vista previa de la papeleta antes de mandarla por WhatsApp. El
       fill-mode de la animación es backwards y no both a propósito: con both
       queda un transform en matriz identidad que crea stacking context y
       atrapa los popups que van por encima. */
    .papeleta-dialog {
      width: 100%;
      max-width: 340px;
      border-radius: 18px;
      padding: 1.15rem;
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
      animation: dialogIn 200ms var(--ease-out-expo) backwards;
      background: white;
      border: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
    }
    :host-context(.dark) .papeleta-dialog {
      background: #1e293b;
      border-color: rgba(255,255,255,0.1);
      box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4);
    }
    .papeleta-head { display: flex; align-items: center; gap: 0.75rem; }
    .papeleta-head .confirm-title { flex: 1; min-width: 0; }
    .papeleta-close {
      width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
      font-size: 0.75rem; color: #94a3b8;
      transition: background-color 140ms, color 140ms;
    }
    .papeleta-close:hover { background: rgba(100,116,139,0.12); color: #475569; }
    :host-context(.dark) .papeleta-close:hover { color: #e2e8f0; }
    /* La papeleta es vertical: sin tope de alto, el diálogo no cabe en
       pantallas de portátil y los botones quedan fuera de vista. */
    .papeleta-img {
      width: 100%;
      max-height: 46vh;
      object-fit: contain;
      border-radius: 10px;
      background: white;
      border: 1px solid rgba(0,0,0,0.1);
    }
    :host-context(.dark) .papeleta-img { border-color: rgba(255,255,255,0.12); }
    .papeleta-hint {
      display: flex; align-items: flex-start; gap: 0.55rem;
      padding: 0.6rem 0.7rem;
      border-radius: 10px;
      font-size: 0.72rem; line-height: 1.45;
      color: #64748b;
      background: rgba(100,116,139,0.08);
    }
    .papeleta-hint svg { width: 15px; height: 15px; flex-shrink: 0; margin-top: 1px; }
    .papeleta-hint.ok { color: #047857; background: rgba(16,185,129,0.1); }
    :host-context(.dark) .papeleta-hint { color: #94a3b8; background: rgba(148,163,184,0.1); }
    :host-context(.dark) .papeleta-hint.ok { color: #6ee7b7; background: rgba(16,185,129,0.14); }
    .papeleta-sin-tel {
      font-size: 0.68rem; line-height: 1.4; color: #94a3b8; margin-top: -0.3rem;
    }
    .papeleta-btn-wa {
      height: 36px; padding: 0 1.1rem;
      border-radius: 10px;
      font-size: 0.78rem; font-weight: 700;
      color: white; background: #059669;
      transition: background-color 140ms, transform 140ms;
    }
    .papeleta-btn-wa:hover { background: #047857; }
    .papeleta-btn-wa:active { transform: scale(0.97); }

    .confirm-overlay {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: rgba(0,0,0,0.45);
      backdrop-filter: blur(4px);
      animation: overlayIn 140ms ease-out;
    }
    .confirm-dialog {
      width: 100%;
      max-width: 380px;
      border-radius: 18px;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      animation: dialogIn 200ms var(--ease-out-expo);
      background: white;
      border: 1px solid rgba(0,0,0,0.08);
      box-shadow: 0 24px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
    }
    :host-context(.dark) .confirm-dialog {
      background: #1e293b;
      border-color: rgba(255,255,255,0.1);
      box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 4px 16px rgba(0,0,0,0.4);
    }
    .confirm-icon-wrap {
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(220,38,38,0.08);
      border: 1px solid rgba(220,38,38,0.18);
      flex-shrink: 0;
    }
    :host-context(.dark) .confirm-icon-wrap {
      background: rgba(239,68,68,0.12);
      border-color: rgba(239,68,68,0.25);
    }
    .confirm-icon { width: 22px; height: 22px; stroke: #dc2626; }
    :host-context(.dark) .confirm-icon { stroke: #f87171; }
    .confirm-text { display: flex; flex-direction: column; gap: 0.3rem; }
    .confirm-title {
      font-size: 0.95rem; font-weight: 800;
      color: #0f172a; line-height: 1.3;
    }
    :host-context(.dark) .confirm-title { color: #f1f5f9; }
    .confirm-body {
      font-size: 0.8rem; line-height: 1.55;
      color: #64748b;
    }
    :host-context(.dark) .confirm-body { color: #94a3b8; }
    .confirm-actions {
      display: flex; gap: 0.5rem; justify-content: flex-end; padding-top: 0.25rem;
    }
    .confirm-btn-cancel, .confirm-btn-delete {
      height: 36px; padding: 0 1.1rem;
      border-radius: 10px;
      font-size: 0.78rem; font-weight: 700;
      cursor: pointer; transition: all 120ms ease;
      border: 1px solid transparent;
    }
    .confirm-btn-cancel:active, .confirm-btn-delete:active { transform: scale(0.97); }
    .confirm-btn-cancel {
      background: rgba(0,0,0,0.04);
      border-color: rgba(0,0,0,0.1);
      color: #475569;
    }
    .confirm-btn-cancel:hover { background: rgba(0,0,0,0.08); }
    :host-context(.dark) .confirm-btn-cancel {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.12);
      color: #94a3b8;
    }
    :host-context(.dark) .confirm-btn-cancel:hover { background: rgba(255,255,255,0.1); }
    .confirm-btn-delete {
      background: #dc2626;
      color: white;
      box-shadow: 0 2px 8px rgba(220,38,38,0.3);
    }
    .confirm-btn-delete:hover { background: #b91c1c; box-shadow: 0 4px 12px rgba(220,38,38,0.4); }
  `]
})
export class ReunionesProgramacionComponent implements OnInit {

  private reunionesSvc = inject(ReunionesService);
  private asistenciaSvc = inject(AsistenciaService);
  private conflictosSvc = inject(ConflictosService);
  congregacionCtx = inject(CongregacionContextService);
  private authStore = inject(AuthStore);
  private zone = inject(NgZone);
  private destroyRef = inject(DestroyRef);

  hasEditPermission = computed(() => {
    const tipo = this.tipoReunionActivo();
    const perm = tipo === 'fin_semana' ? 'reuniones.fin_semana' : 'reuniones.entre_semana';
    return this.authStore.hasPermission(perm);
  });

  puedeCargarGuia = computed(() => {
    const roles = this.authStore.user()?.roles ?? [];
    return roles.includes('Administrador') || roles.includes('Gestor Aplicación');
  });

  // ── State machine ──────────────────────────────────────────────
  //
  // Dos estados, no cinco: 'borrador' es lo que todavía no ve la congregación
  // y 'publicado' lo que ya sí. Antes había además 'confirmado' e 'historial',
  // que eran lo mismo leído de dos sitios distintos.
  estado = signal<'idle' | 'loading' | 'borrador' | 'publicado' | 'error'>('idle');
  errorMsg = signal<string | null>(null);
  /** Aviso no bloqueante: la generación fue bien pero se respetó algo que ya
   *  estaba publicado. Va aparte de errorMsg porque el estado sigue siendo
   *  'borrador' y la pantalla tiene que poder pintar el borrador igualmente. */
  avisoConservados = signal<string | null>(null);
  /** Sólo para el banner de "publicada correctamente": distingue acabar de
   *  publicarla de abrir un mes que ya lo estaba. */
  recienPublicado = signal(false);

  // ── Data signals ───────────────────────────────────────────────
  semanas = signal<ProgramaSemana[]>([]);
  selectedWeekIdx = signal(0);
  plantillas = signal<PlantillaOption[]>([]);
  /** Mismas plantillas, la más reciente arriba: es como se busca una guía en
   *  este desplegable, no de la más vieja hacia adelante. */
  plantillasOrdenadas = computed(() => {
    const clave = (p: PlantillaOption) => (p.ano_inicio ?? 0) * 12 + (p.mes_inicio ?? 0);
    return [...this.plantillas()].sort((a, b) => clave(b) - clave(a));
  });
  loadingPlantillas = signal(false);
  tieneGuias = signal<boolean | null>(null);
  verificandoGuias = signal(false);

  // ── Historial signals ──────────────────────────────────────────
  periodos = signal<PeriodoConfirmado[]>([]);
  loadingPeriodos = signal(false);
  loadingHistorial = signal(false);
  descargandoPdf = signal(false);
  descargandoPapeletas = signal(false);
  /** Ranura (id_programa_parte + sala) cuya papeleta se está preparando para
   *  WhatsApp; deshabilita ese ícono en particular mientras carga. */
  enviandoPapeletaKey = signal<string | null>(null);
  /** Papeleta lista para mandar: se enseña antes de saltar a WhatsApp, que es
   *  el único momento en que el usuario todavía está mirando esta pestaña. */
  papeletaPreview = signal<{
    nombre: string; telefono: string | null; mensaje: string;
    url: string; copiada: boolean;
  } | null>(null);

  gruposPlantilla = computed<GrupoPlantilla[]>(() => {
    const mapa = new Map<string, GrupoPlantilla>();
    for (const p of this.periodos()) {
      const key = p.id_plantilla !== null ? String(p.id_plantilla) : 'sin-plantilla';
      if (!mapa.has(key)) {
        mapa.set(key, {
          id_plantilla: p.id_plantilla,
          nombre_plantilla: p.nombre_plantilla ?? 'Sin guía asociada',
          periodos: [],
        });
      }
      mapa.get(key)!.periodos.push(p);
    }
    return Array.from(mapa.values());
  });

  totalPeriodos = computed(() => this.gruposPlantilla().reduce((acc, g) => acc + g.periodos.length, 0));

  /**
   * Agrupa el historial por año consecutivo, para mostrar el año una sola
   * vez por grupo en vez de repetirlo en cada fila (mismo criterio que
   * Logística y Discursos). Se agrupa sobre la lista plana, sin importar de
   * qué guía viene cada mes: esa agrupación no se muestra en este listado.
   */
  periodosPorAno = computed<{ ano: number; periodos: PeriodoConfirmado[] }[]>(() => {
    const grupos: { ano: number; periodos: PeriodoConfirmado[] }[] = [];
    for (const p of this.periodos()) {
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && ultimo.ano === p.ano) {
        ultimo.periodos.push(p);
      } else {
        grupos.push({ ano: p.ano, periodos: [p] });
      }
    }
    return grupos;
  });

  /** Solo el nombre del mes, para listas ya agrupadas por año. */
  mesSoloLabel(p: PeriodoConfirmado): string {
    return p.label.split(' ')[0];
  }

  gruposExpandidos = signal<Set<string>>(new Set());

  showPlantillaDropdown = signal(false);
  showMesAnoDropdown = signal(false);
  mesAnoBusqueda = signal('');

  get plantillaSeleccionada(): PlantillaOption | undefined {
    return this.plantillas().find(p => p.id_plantilla === this.modalForm().id_plantilla);
  }

  mesesList = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];
  anosList = Array.from({length: 5}, (_, i) => new Date().getFullYear() - 1 + i);

  mesLabel(mes: number): string {
    return this.mesesList.find((m) => m.value === mes)?.label ?? '';
  }

  /** Periodos del combo "Mes y año": del año pasado hasta el mes actual +2
   *  -no tiene sentido ofrecer programar más allá de eso-, del más
   *  reciente al más antiguo porque es lo que casi siempre se busca. */
  periodosMesAno = computed(() => {
    const ahora = new Date();
    const anoActual = ahora.getFullYear();
    const anoDesde = anoActual - 1;
    let anoTope = anoActual;
    let mesTope = ahora.getMonth() + 1 + 2;
    if (mesTope > 12) { mesTope -= 12; anoTope += 1; }

    const periodos: { ano: number; mes: number; label: string }[] = [];
    for (let ano = anoTope; ano >= anoDesde; ano--) {
      const mesInicio = ano === anoTope ? mesTope : 12;
      for (let mes = mesInicio; mes >= 1; mes--) {
        periodos.push({ ano, mes, label: `${this.mesLabel(mes)} ${ano}` });
      }
    }
    return periodos;
  });

  periodosMesAnoFiltrados = computed(() => {
    const q = this.mesAnoBusqueda().trim().toLowerCase();
    if (!q) return this.periodosMesAno();
    return this.periodosMesAno().filter((p) => p.label.toLowerCase().includes(q));
  });

  // ── Diálogo de confirmación personalizado ─────────────────────
  confirmDialog = signal<{
    title: string; body: string; confirmLabel?: string; resolve: (v: boolean) => void;
  } | null>(null);

  private openConfirmDialog(title: string, body: string, confirmLabel?: string): Promise<boolean> {
    return new Promise(resolve => this.confirmDialog.set({ title, body, confirmLabel, resolve }));
  }

  onConfirmDialogAction(accept: boolean): void {
    const d = this.confirmDialog();
    this.confirmDialog.set(null);
    d?.resolve(accept);
  }

  // ── Conflictos de regeneración ────────────────────────────────
  showConflictoModal = signal(false);
  conflictosDetectados = signal<ConflictoMes[]>([]);
  mesesFaltantes = signal<ConflictoMes[]>([]);
  pendingCreatePayload = signal<ProgramaMensualCreateRequest | null>(null);
  pendingGenPayload = signal<GenerarAsignacionesRequest | null>(null);
  // Se identifica por pillKey y no por id_asignacion: una parte puede tener
  // varias ranuras vacías a la vez —Principal, Sala B y sus ayudantes— y
  // todas comparten id_programa_parte, así que cualquier clave derivada de él
  // abriría el panel de las cuatro de golpe.
  editingHistorialId = signal<string | null>(null);
  historialCandidatos = signal<CandidatoAlternativo[]>([]);
  loadingCandidatos = signal(false);
  busquedaCandidato = signal('');
  busquedaResultados = signal<PublicadorBusqueda[]>([]);
  loadingBusqueda = signal(false);
  private _busquedaTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Modal ──────────────────────────────────────────────────────
  showModal = signal(false);
  diaReunionSinConfigurar = signal(false);
  modalForm = signal<GenerarMesForm>({
    mes:      new Date().getMonth() + 1,
    ano:      new Date().getFullYear(),
    mes_fin:  new Date().getMonth() + 1,
    ano_fin:  new Date().getFullYear(),
    id_plantilla: 0,
    dia_reunion:  null,
  });

  // ── UI ─────────────────────────────────────────────────────────
  /** Posición en pantalla del panel de candidatos, calculada desde la
   *  píldora que lo abrió. Igual que en Logística: el panel es `fixed` y
   *  vive fuera de la tarjeta de sección, así que el borde redondeado de
   *  ésta -que recorta con overflow-hidden- nunca vuelve a cortarlo. */
  dropdownPos = signal<{ top: number; left: number; openUp: boolean } | null>(null);
  selectedSala = signal<'Principal' | 'Auxiliar'>('Principal');
  periodoActivo = signal<{ mes: number; ano: number } | null>(null);
  mobileSheetAsig = signal<AsignacionDraft | null>(null);
  mobileSheetSeccion = signal<any>(null);

  // Selector de mes de la barra superior. Sustituye a la barra lateral fija:
  // la lista de meses y el botón de generar sólo ocupan ancho mientras se
  // usan, igual que en Logística.
  menuMesesAbierto = signal(false);

  /** Menú "…" con lo que borra: se abre sobre el mes que está a la vista. */
  menuAccionesAbierto = signal(false);

  /** Si hay al menos una acción destructiva disponible para el mes abierto.
   *  Sin ninguna, el botón "…" abriría un menú vacío, así que no se pinta. */
  accionesDestructivasMes = computed(() => {
    const mes = this.periodoActivoCompleto();
    if (!mes) return false;
    const puedeQuitarSalaB = this.tipoReunionActivo() === 'entre_semana' && this.mesTieneSalaB();
    return puedeQuitarSalaB || this.periodoEliminable(mes);
  });

  /** Periodo confirmado que corresponde al mes actualmente abierto. */
  periodoActivoCompleto = computed<PeriodoConfirmado | undefined>(() => {
    const activo = this.periodoActivo();
    if (!activo) return undefined;
    return this.periodos().find((x) => x.ano === activo.ano && x.mes === activo.mes);
  });

  /** Mes y año del periodo abierto, para el rótulo del selector. */
  periodoActivoLabel = computed(() => this.periodoActivoCompleto()?.label ?? 'Meses');

  esPeriodoActivo(p: { ano: number; mes: number }): boolean {
    const activo = this.periodoActivo();
    return !!activo && activo.ano === p.ano && activo.mes === p.mes;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (this.menuMesesAbierto() && !target.closest('[data-mes-menu]')) {
      this.menuMesesAbierto.set(false);
    }
    if (this.menuAccionesAbierto() && !target.closest('[data-acciones-menu]')) {
      this.menuAccionesAbierto.set(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.menuMesesAbierto()) this.menuMesesAbierto.set(false);
    if (this.menuAccionesAbierto()) this.menuAccionesAbierto.set(false);
  }

  // ── Meeting type toggle ────────────────────────────────────────
  tipoReunionActivo = signal<'entre_semana' | 'fin_semana' | 'logistica' | 'discursos'>('entre_semana');

  canViewEntreSemana = computed(() => this.authStore.hasPermission('reuniones.entre_semana'));
  canViewFinSemana   = computed(() => this.authStore.hasPermission('reuniones.fin_semana'));
  canViewLogistica   = computed(() => this.authStore.hasPermission('reuniones.logistica'));
  canViewDiscursos   = computed(() => this.authStore.hasPermission('reuniones.discursos'));
  showTipoTabs = computed(() =>
    [this.canViewEntreSemana(), this.canViewFinSemana(), this.canViewLogistica(), this.canViewDiscursos()]
      .filter(Boolean).length > 1
  );

  // ── Excepciones: semanas sin reunión y ausencias ────────────────
  // Sin permiso propio: programacionGuard ya exige alguno de los cuatro
  // reuniones.* para entrar a esta ruta, así que una comprobación aquí sería
  // la misma lista escrita por segunda vez y siempre cierta.
  ajustesAbierto = signal(false);

  /**
   * Marcar una semana borra lo programado en ella, y una ausencia cambia a
   * quién puede tocarle: lo que hay en pantalla puede haber dejado de ser
   * cierto, así que se recarga en vez de dejarlo desfasado.
   *
   * Son dos recargas porque son dos cosas distintas: el mes abierto (las
   * asignaciones que se acaban de borrar) y la lista de semanas marcadas, que
   * esta pantalla mantiene aparte para teñir las semanas del navegador. Sin la
   * segunda, marcar una semana desde el diálogo la dejaba sin teñir hasta
   * recargar la página entera.
   */
  onAjustesCambiaron(): void {
    this.loadSemanasSinReunion();
    const activo = this.periodoActivo();
    if (activo) this.loadMes(activo.mes, activo.ano);
  }

  tituloReunion = computed(() => {
    switch (this.tipoReunionActivo()) {
      case 'entre_semana': return 'Vida y Ministerio Cristianos';
      case 'fin_semana':   return 'Reunión Pública y Atalaya';
      case 'logistica':    return 'Logística de Reuniones';
      case 'discursos':    return 'Discursos Públicos';
      default:             return '';
    }
  });

  // Logística no lleva subtítulo -era texto fijo que ya repetía el rótulo de
  // cada tabla-; los demás sí cambian según lo que se está mostrando.
  subtituloReunion = computed(() => {
    switch (this.tipoReunionActivo()) {
      case 'entre_semana': return 'Tesoros · Seamos Mejores Maestros';
      case 'fin_semana':   return 'Discurso Público · Estudio de La Atalaya';
      case 'logistica':    return '';
      case 'discursos':    return 'Salientes · Entrantes · Hospitalidad';
      default:             return '';
    }
  });

  // ── Section config ─────────────────────────────────────────────
  private readonly SECCIONES_ENTRE_SEMANA: Record<string, { titulo: string; color: string; orden: number; iconPath: string; iconViewBox?: string }> = {
    tesoros: {
      titulo: 'Tesoros de la Biblia',
      color: '#3b7f8b',
      orden: 0,
      iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    },
    seamos_mejores: {
      titulo: 'Seamos Mejores Maestros',
      color: '#d58f00',
      orden: 1,
      iconPath: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    },
    nuestra_vida: {
      titulo: 'Nuestra Vida Cristiana',
      color: '#bf2f13',
      orden: 2,
      iconPath: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
    },
  };

  private readonly SECCIONES_FIN_SEMANA: Record<string, { titulo: string; color: string; orden: number; iconPath: string; iconViewBox?: string }> = {
    introduccion: {
      titulo: 'Introducción',
      color: '#4f46e5',
      orden: 0,
      iconPath: 'M9 18V5l12-2v13M6 18a3 3 0 100-6 3 3 0 000 6zM18 16a3 3 0 100-6 3 3 0 000 6z',
    },
    discurso_publico: {
      titulo: 'Discurso Público',
      color: '#2563eb',
      orden: 1,
      iconPath: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
    },
    estudio_atalaya: {
      titulo: 'Estudio de La Atalaya',
      color: '#059669',
      orden: 2,
      iconPath: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
    },
    conclusion: {
      titulo: 'Conclusión',
      color: '#c2410c',
      orden: 3,
      iconPath: 'M9 18V5l12-2v13M6 18a3 3 0 100-6 3 3 0 000 6zM18 16a3 3 0 100-6 3 3 0 000 6z',
    },
  };

  private get seccionesConfig() {
    return this.tipoReunionActivo() === 'entre_semana'
      ? this.SECCIONES_ENTRE_SEMANA
      : this.SECCIONES_FIN_SEMANA;
  }


  // ── Computed ───────────────────────────────────────────────────
  currentSemana = computed(() => this.semanas()[this.selectedWeekIdx()] ?? null);

  /**
   * Las semanas del navegador superior, ya resueltas para pintarse sin
   * recalcular nada dentro del `@for`:
   *
   *  - `esNuevoMes`: si esta píldora abre un mes distinto al de la anterior.
   *    Antes cada píldora repetía el mes completo ("7 jul", "14 jul", "21
   *    jul"...); con dos meses abiertos a la vez, esa repetición no ayuda a
   *    ver DÓNDE cambia el mes, solo lo dice de más en cada una. Se compara
   *    tomando `MM` directo del ISO (`fecha.slice(5, 7)`) y no con
   *    `new Date(fecha).getMonth()`: un string de solo fecha ("2026-07-07")
   *    lo interpreta como UTC medianoche, y en husos horarios negativos
   *    `.getMonth()` puede devolver el mes anterior.
   *
   *  - `sinReunion`: el resultado de `semanaSinReunion(sem)`, para no
   *    llamarlo como método hasta 5 veces por píldora (aria-label, title,
   *    icono y las dos clases del texto) en cada ciclo de detección de
   *    cambios.
   *
   * Todo esto se recalcula una sola vez por cambio de `semanas()`.
   */
  semanasAgrupadas = computed(() => {
    let mesAnterior: string | null = null;
    return this.semanas().map((sem) => {
      const mes = sem.fecha.slice(5, 7);
      const esNuevoMes = mes !== mesAnterior;
      mesAnterior = mes;
      // Se resuelve aquí y no en el template: sin esto, semanaSinReunion(sem)
      // -que recorre semanasSinReunion() con un find()- se llamaba hasta 5
      // veces por píldora en cada ciclo de detección de cambios.
      return { sem, esNuevoMes, sinReunion: this.semanaSinReunion(sem) };
    });
  });

  salaCounts = computed(() => {
    const semana = this.currentSemana();
    if (!semana) return { principal: 0, auxiliar: 0 };
    const aux = semana.partes.filter(p => p.sala === 'Auxiliar').length;
    return { principal: semana.partes.length - aux, auxiliar: aux };
  });

  /**
   * Si el mes abierto tiene Sala B en alguna de sus semanas. Mira todas y no
   * sólo la que se está viendo: el botón de quitarla borra el mes entero, así
   * que esconderlo por estar parado en una semana sin Sala B lo haría
   * aparecer y desaparecer al cambiar de semana.
   */
  mesTieneSalaB = computed(() =>
    this.semanas().some(sem => sem.partes.some(p => p.sala === 'Auxiliar')));

  salaCountsPorSeccion = computed(() => {
    const semana = this.currentSemana();
    if (!semana) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    for (const p of semana.partes) {
      if (p.sala === 'Auxiliar') {
        const sec = this._inferSeccion(p);
        counts[sec] = (counts[sec] ?? 0) + 1;
      }
    }
    return counts;
  });

  canPublicar = computed(() => this.estado() === 'borrador' && this.semanas().length > 0);
  canBorrarBorrador = computed(() => this.estado() === 'borrador' && this.semanas().length > 0);
  fechasPreview = computed(() => {
    const { mes, ano, mes_fin, ano_fin, dia_reunion } = this.modalForm();
    if (dia_reunion === null) return [];
    return this.calcFechasRango(ano, mes, ano_fin, mes_fin, dia_reunion);
  });

  seccionesActuales = computed(() => {
    const semana = this.currentSemana();
    if (!semana) return [];
    const sala = this.selectedSala();
    const filtered = semana.partes.filter(p => {
      // Filtrar partes de logística si estamos en una vista de programa regular
      const isLogistica = (p.seccion || '').toLowerCase() === 'logistica' || 
                          ['acomodador', 'vigilancia', 'micrófono', 'microfono', 'audio', 'video', 'plataforma']
                            .some(key => (p.nombre_parte || '').toLowerCase().includes(key));
      
      if (this.tipoReunionActivo() !== 'logistica' && isLogistica) {
        return false;
      }

      if (p.sala === 'Auxiliar') return sala === 'Auxiliar';
      if (p.aplica_sala_b) return sala === 'Principal';
      return true;
    });
    return this._buildSecciones(filtered);
  });

  private _inferSeccion(p: AsignacionDraft): string {
    const cfg = this.seccionesConfig;
    // 1. Key exacto (seed-based programs)
    if (p.seccion && cfg[p.seccion]) return p.seccion;

    // 2. Mapeo flexible del string de sección
    const s = (p.seccion || '').toLowerCase();

    // -- Fin de semana mappings --
    if (this.tipoReunionActivo() === 'fin_semana') {
      if (s.includes('discurso') || s.includes('publico') || s.includes('público')) return 'discurso_publico';
      if (s.includes('atalaya') || s.includes('estudio')) return 'estudio_atalaya';
      if (s.includes('apertura') || s.includes('introduccion') || s.includes('introducción')) return 'introduccion';
      if (s.includes('clausura') || s.includes('conclusion') || s.includes('conclusión') || s.includes('final')) return 'conclusion';
      // fallback by part name
      const n = (p.nombre_parte || '').toLowerCase();
      if (n.includes('discurso') || n.includes('orador')) return 'discurso_publico';
      if (n.includes('atalaya') || n.includes('conductor') || n.includes('lector')) return 'estudio_atalaya';
      if (n.includes('presidente') || n.includes('oración inicial') || n.includes('oracion inicial') || n.includes('canto')) return 'introduccion';
      if (n.includes('oración final') || n.includes('oracion final')) return 'conclusion';
      return 'introduccion';
    }

    // -- Entre semana mappings --
    if (s.includes('tesoro')) return 'tesoros';
    if (s.includes('mejor') || s.includes('maestro')) return 'seamos_mejores';
    if (s.includes('vida') || s.includes('cristian')) return 'nuestra_vida';
    if (s.includes('apertura')) return 'tesoros';
    if (s.includes('clausura')) return 'nuestra_vida';

    // 3. Inferencia por nombre de parte
    const n = (p.nombre_parte || '').toLowerCase();
    if (n.includes('tesoros') || n.includes('lectura de la biblia') || n.includes('busquemos') || n.includes('perlas') || n.includes('presidente') || n.includes('oración inicial') || n.includes('oracion inicial')) return 'tesoros';
    if (n.includes('empiece') || n.includes('revisita') || n.includes('discípulo') || n.includes('haga discí') || n.includes('seamos') || n.includes('maestro')) return 'seamos_mejores';
    if (n.includes('estudio bíblico') || n.includes('estudio biblico') || n.includes('necesidades') || n.includes('oración final') || n.includes('oracion final') || n.includes('conductor') || n.includes('hospitalario') || n.includes('anuncio')) return 'nuestra_vida';

    return 'tesoros';
  }

  private _buildSecciones(partes: AsignacionDraft[]) {
    const map = new Map<string, AsignacionDraft[]>();
    for (const p of partes.filter(p => {
      const n = (p.nombre_parte || '').toLowerCase();
      if (n.startsWith('canción') || n.startsWith('cancion') || n.startsWith('canto')) return false;
      if (n.includes('palabras de conclusión') || n.includes('palabras de conclusion')) return false;
      if (this.tipoReunionActivo() === 'fin_semana' &&
          (n.includes('conductor') || n.includes('estudio de la atalaya')) &&
          !n.includes('lector')) return false;
      return true;
    })) {
      const key = this._inferSeccion(p);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }

    const result: any[] = [];
    for (const [seccionKey, seccionPartes] of map) {
      const cfg = this.seccionesConfig[seccionKey] ?? Object.values(this.seccionesConfig)[0];
      const grupos = this._buildGrupos(seccionPartes);
      result.push({
        id: seccionKey,
        titulo: cfg.titulo,
        color: cfg.color,
        orden: cfg.orden,
        iconPath: cfg.iconPath,
        partes: seccionPartes,
        grupos,
      });
    }
    return result.sort((a: any, b: any) => a.orden - b.orden);
  }

  private _buildGrupos(partes: AsignacionDraft[]) {
    const grupos: { key: string; partes: AsignacionDraft[]; role0: string; role1: string }[] = [];
    // Track by object reference — avoids key collisions when conductor+lector share id_programa_parte
    const used = new Set<AsignacionDraft>();
    // Nunca deriva de id_asignacion: quitar/reasignar a alguien lo cambia (o
    // lo deja undefined) y eso movía la fila a otra key, que Angular lee como
    // "otro elemento" — destruye el DOM y lo vuelve a montar con `cardIn`,
    // que en su fotograma 0 está invisible. El resultado se veía como si la
    // fila entera hubiese desaparecido en vez de quedar "Sin asignar".
    const uid = (p: AsignacionDraft, i: number) =>
      `p${p.id_programa_parte}-${p.es_ayudante ? 'ayu' : 'tit'}-${i}`;

    const maestros = partes.filter(p => !p.es_ayudante);
    const ayudantes = partes.filter(p => p.es_ayudante);

    maestros.forEach((p, i) => {
      if (used.has(p)) return;
      used.add(p);

      const nombre = (p.nombre_parte || '').toLowerCase();
      const esConductor = nombre.includes('conductor') || 
                          (nombre.includes('estudio bíblico') && !nombre.includes('lector')) ||
                          (nombre.includes('estudio biblico') && !nombre.includes('lector')) ||
                          (nombre.includes('estudio de la atalaya') && !nombre.includes('lector'));
      const esMaestro = nombre.includes('empiece') || nombre.includes('revisita') || nombre.includes('discípulo') || nombre.includes('haga disc');
      const key = uid(p, i);

      if (esConductor) {
        // EBC lector shares same id_programa_parte, has "lector" in nombre_parte, es_ayudante=false
        const lectorM = maestros.find(q => {
          if (used.has(q)) return false;
          const qn = (q.nombre_parte || '').toLowerCase();
          return (q.id_programa_parte === p.id_programa_parte && qn.includes('lector')) ||
                 (qn === nombre) ||
                 (qn.includes('lector') && (nombre.includes('estudio') || nombre.includes('atalaya')));
        });
        const lectorA = !lectorM ? ayudantes.find(q => {
          if (used.has(q)) return false;
          const qn = (q.nombre_parte || '').toLowerCase();
          return qn.includes('lector') && (qn.includes('estudio') || qn.includes('atalaya'));
        }) : null;
        const lector = lectorM ?? lectorA;
        if (lector) {
          used.add(lector);
          grupos.push({ key, partes: [p, lector], role0: 'Conductor', role1: 'Lector' });
        } else {
          grupos.push({ key, partes: [p], role0: '', role1: '' });
        }
      } else if (esMaestro || p.aplica_sala_b) {
        const stripSuffix = (n: string) =>
          n.replace(/\s*\((sala b[^)]*|ayudante[^)]*)\)/gi, '').trim();
        const nombreBase = stripSuffix(nombre);
        const misAyudantes = nombreBase.length > 2
          ? ayudantes.filter(q => {
              if (used.has(q)) return false;
              // Misma sala: sin esto, el ayudante de Sala B de esta misma
              // parte también hacía match por nombre y se lo llevaba el
              // maestro de la Sala Principal, dejando un "Ayudante 2" que
              // en realidad era el ayudante de la otra sala -y la Sala B
              // se quedaba sin el suyo, con el botón "+ Ayudante" vacío-.
              return q.sala === p.sala
                && stripSuffix((q.nombre_parte || '').toLowerCase()).startsWith(nombreBase);
            }).slice(0, 2)
          : [];
        misAyudantes.forEach(a => used.add(a));
        grupos.push({ key, partes: [p, ...misAyudantes], role0: 'Maestro', role1: 'Ayudante' });
      } else {
        grupos.push({ key, partes: [p], role0: '', role1: '' });
      }
    });

    // Ayudantes huérfanos (sin maestro emparejado)
    ayudantes.forEach((a, i) => {
      if (!used.has(a)) {
        grupos.push({ key: uid(a, maestros.length + i), partes: [a], role0: '', role1: '' });
      }
    });

    return grupos;
  }

  // ── Lifecycle ──────────────────────────────────────────────────
  constructor() {
    effect(() => {
      const idCong = this.congregacionCtx.effectiveCongregacionId();
      // Reset state whenever the congregation changes
      untracked(() => {
        this.semanas.set([]);
        this.selectedWeekIdx.set(0);
        this.estado.set('idle');
        this.errorMsg.set(null);
        this.avisoConservados.set(null);
        this.periodos.set([]);
        this.editingHistorialId.set(null);
        // Las semanas sin reunión son de la congregación, no de la sesión: solo
        // se cargaban en ngOnInit, así que al cambiar de congregación seguían
        // tiñendo las semanas marcadas por la anterior.
        this.semanasSinReunion.set([]);
      });
      if (!idCong) {
        untracked(() => {
          this.errorMsg.set('No hay congregación seleccionada. Selecciona una en el panel de administración.');
          this.estado.set('error');
        });
        return;
      }
      untracked(() => {
        const tipo = this.tipoReunionActivo();
        if (tipo === 'logistica' || tipo === 'discursos') return;
        this.loadPeriodos(idCong, { abrirBorrador: true });
        this.verificarGuiasDisponibles(idCong);
        this.loadSemanasSinReunion();
      });
    });

    // El panel de candidatos es `fixed` y calcula su posición una sola vez,
    // al abrirse: si algo lo cierra (clic fuera, elegir un candidato, cambiar
    // de semana...) basta con que editingHistorialId vuelva a null para que la
    // posición se olvide también, en vez de acordarse de limpiarla en cada uno
    // de esos sitios por separado.
    effect(() => {
      if (this.editingHistorialId() === null) {
        untracked(() => this.dropdownPos.set(null));
      }
    });

    this.vigilarScrollParaCerrarDropdown();
  }

  ngOnInit(): void {
    // Seleccionar el primer tab al que el usuario tiene acceso
    if (this.canViewEntreSemana()) {
      this.tipoReunionActivo.set('entre_semana');
    } else if (this.canViewFinSemana()) {
      this.tipoReunionActivo.set('fin_semana');
    } else if (this.canViewLogistica()) {
      this.tipoReunionActivo.set('logistica');
    } else if (this.canViewDiscursos()) {
      this.tipoReunionActivo.set('discursos');
    }
    this.loadSemanasSinReunion();
  }

  // ── Semanas sin reunión (asamblea, congreso, Conmemoración) ──
  semanasSinReunion = signal<SemanaSinReunion[]>([]);

  private loadSemanasSinReunion(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    this.reunionesSvc.getSemanasSinReunion(idCong).subscribe({
      next: (res) => this.semanasSinReunion.set(res),
      error: () => this.semanasSinReunion.set([]),
    });
  }

  /**
   * Se compara contra el rango de fechas que ya calculó el backend, en vez de
   * recalcular la semana ISO en JavaScript: el año ISO no coincide con el
   * natural en el borde de año y es una fuente clásica de errores.
   */
  semanaSinReunion(sem: ProgramaSemana): SemanaSinReunion | null {
    const tipo = this.tipoReunionActivo();
    if (tipo !== 'entre_semana' && tipo !== 'fin_semana') return null;
    const fecha = (sem.fecha ?? '').slice(0, 10);
    if (!fecha) return null;
    return this.semanasSinReunion().find((s) =>
      (s.alcance === 'ambas' || s.alcance === tipo) &&
      fecha >= s.fecha_inicio && fecha <= s.fecha_fin
    ) ?? null;
  }

  /**
   * Carga la lista de meses con programación.
   *
   * Con `abrirBorrador`, además abre el borrador que haya pendiente. Antes esto
   * era `tryLoadDrafts`, que disparaba nueve peticiones en paralelo —una por
   * mes de una ventana de ±4— rastreando la caché de Redis a ciegas. Ahora los
   * borradores están en la misma lista que lo publicado y basta con mirarla.
   */
  private loadPeriodos(idCong: number, opciones: { abrirBorrador?: boolean } = {}): void {
    this.loadingPeriodos.set(true);
    if (opciones.abrirBorrador) this.estado.set('loading');
    this.reunionesSvc.getPeriodosConfirmados(this.tipoReunionActivo(), idCong).subscribe({
      next: (p) => {
        this.periodos.set(p);
        this.loadingPeriodos.set(false);
        if (!opciones.abrirBorrador) return;
        // Todos los meses en borrador, no solo el primero: generar puede
        // abarcar dos meses de una vez y el borrador es uno solo. Abrir la
        // mitad dejaría media programación fuera de la vista sin decirlo.
        const borradores = p
          .filter((m) => m.estado === 'borrador')
          .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
        if (borradores.length > 0) this.abrirBorradorPendiente(idCong, borradores);
        else this.estado.set('idle');
      },
      error: () => {
        this.loadingPeriodos.set(false);
        if (opciones.abrirBorrador) this.estado.set('idle');
      },
    });
  }

  private verificarGuiasDisponibles(idCong: number): void {
    this.verificandoGuias.set(true);
    this.tieneGuias.set(null);
    this.reunionesSvc.getPlantillas(this.tipoReunionActivo(), idCong).subscribe({
      next: (lista) => {
        const guiasReales = (lista ?? []).filter((p) => p.mes_inicio != null);
        this.tieneGuias.set(guiasReales.length > 0);
        this.verificandoGuias.set(false);
      },
      error: () => {
        this.tieneGuias.set(null);
        this.verificandoGuias.set(false);
      },
    });
  }

  // ── Modal ──────────────────────────────────────────────────────
  openModal(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    if (this.tipoReunionActivo() === 'entre_semana' && this.tieneGuias() === false) {
      return;
    }
    this.showModal.set(true);
    this.loadingPlantillas.set(true);
    const configReq = this.congregacionCtx.isAdmin() 
      ? this.asistenciaSvc.getCongregacionConfigById(idCong).pipe(catchError(() => of(null)))
      : this.asistenciaSvc.getCongregacionConfig().pipe(catchError(() => of(null)));

    forkJoin({
      plantillas: this.reunionesSvc.getPlantillas(this.tipoReunionActivo(), idCong),
      config: configReq,
    }).subscribe({
      next: ({ plantillas, config }) => {
        const configKey = this.tipoReunionActivo() === 'entre_semana' ? 'dia_reunion_entre_semana' : 'dia_reunion_fin_semana';
        const diaRaw = config?.[configKey as keyof typeof config] as string | null ?? null;
        const diaReunion = this.diaReunionToNumber(diaRaw);
        this.diaReunionSinConfigurar.set(diaReunion === null);
        this.plantillas.set(plantillas);
        this.modalForm.update((f) => ({ ...f, dia_reunion: diaReunion }));
        if (plantillas.length > 0) {
          // Sin selección previa, se abre en la guía más reciente: es la
          // misma que ahora aparece arriba en el desplegable.
          const selected =
            plantillas.find((p) => p.id_plantilla === this.modalForm().id_plantilla)
            ?? this.plantillasOrdenadas()[0];
          this.applyPlantillaPeriodo(selected);
        }
        this.loadingPlantillas.set(false);
      },
      error: () => {
        this.plantillas.set([]);
        this.loadingPlantillas.set(false);
        this.errorMsg.set('No se pudieron cargar las plantillas.');
      },
    });
  }

  updateModal(field: keyof GenerarMesForm, value: number): void {
    if (field === 'id_plantilla') {
      const plantilla = this.plantillas().find((p) => p.id_plantilla === value);
      if (plantilla) {
        this.applyPlantillaPeriodo(plantilla);
        return;
      }
    }
    // El selector del modal solo pide un mes y un año: mes_fin/ano_fin
    // se mantienen espejados para reutilizar calcFechasRango sin cambiar su firma.
    if (field === 'mes') {
      this.modalForm.update((f) => ({ ...f, mes: value, mes_fin: value }));
      return;
    }
    if (field === 'ano') {
      this.modalForm.update((f) => ({ ...f, ano: value, ano_fin: value }));
      return;
    }
    this.modalForm.update((f) => ({ ...f, [field]: value }));
  }

  /** El combo "Mes y año" viaja como un único valor "ano-mes"; aquí se
   *  reparte en los cuatro campos que ya usa el resto del formulario. */
  updateModalMesAno(value: string): void {
    const [anoStr, mesStr] = value.split('-');
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    this.modalForm.update((f) => ({ ...f, mes, ano, mes_fin: mes, ano_fin: ano }));
  }

  private applyPlantillaPeriodo(plantilla: PlantillaOption): void {
    const f = this.modalForm();
    const isGeneric = plantilla.mes_inicio == null;
    const mesIni = isGeneric ? f.mes : plantilla.mes_inicio!;
    const anoIni = isGeneric ? f.ano : plantilla.ano_inicio!;
    const mesFin = isGeneric ? f.mes_fin : plantilla.mes_fin!;
    const anoFin = isGeneric ? f.ano_fin : plantilla.ano_fin!;
    this.modalForm.update((prev) => ({
      ...prev,
      id_plantilla: plantilla.id_plantilla,
      mes: mesIni, ano: anoIni,
      mes_fin: mesFin, ano_fin: anoFin,
    }));
  }

  private diaReunionToNumber(dia: string | null): number | null {
    if (!dia) return null;
    const norm = dia.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const map: Record<string, number> = {
      lunes: 1,
      martes: 2,
      miercoles: 3,
      jueves: 4,
      viernes: 5,
      sabado: 6,
      domingo: 7,
    };
    return map[norm] ?? null;
  }

  onModalSubmit(): void {
    const form = this.modalForm();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || form.id_plantilla === 0) return;
    // Sin día de reunión configurado no se genera: evita hornear fechas con un día falso
    if (this.diaReunionSinConfigurar() || form.dia_reunion === null) return;

    const fechas = this.calcFechasRango(form.ano, form.mes, form.ano_fin, form.mes_fin, form.dia_reunion);
    if (fechas.length === 0) return;

    const createPayload: ProgramaMensualCreateRequest = {
      id_congregacion: idCong,
      tipo_reunion: this.tipoReunionActivo(),
      mes: form.mes,
      ano: form.ano,
      semanas: fechas,
      id_plantilla: form.id_plantilla,
    };

    const genPayload: GenerarAsignacionesRequest = {
      tipo_reunion: this.tipoReunionActivo(),
      fecha_inicio: fechas[0],
      fecha_fin: fechas[fechas.length - 1],
      id_congregacion: idCong,
    };

    // Verificar conflictos antes de generar
    this.reunionesSvc.verificarConflictosPlantilla(createPayload).subscribe({
      next: (resultado) => {
        if (resultado.tiene_conflictos) {
          this.showModal.set(false);
          this.conflictosDetectados.set(resultado.conflictos);
          this.mesesFaltantes.set(resultado.meses_faltantes);
          this.pendingCreatePayload.set(createPayload);
          this.pendingGenPayload.set(genPayload);
          this.showConflictoModal.set(true);
        } else {
          this.showModal.set(false);
          this._ejecutarGeneracion(createPayload, genPayload);
        }
      },
      error: () => {
        // Si falla la verificación, proceder directamente
        this.showModal.set(false);
        this._ejecutarGeneracion(createPayload, genPayload);
      },
    });
  }

  confirmarGenerarFaltantes(): void {
    const createPayload = this.pendingCreatePayload();
    const genPayload = this.pendingGenPayload();
    const faltantes = this.mesesFaltantes();
    this.showConflictoModal.set(false);
    if (!createPayload || !genPayload) return;

    if (faltantes.length === 0) return;

    const mesesSet = new Set(faltantes.map(m => `${m.ano}-${m.mes}`));
    const semanasFiltradas = createPayload.semanas.filter(f => {
      const d = new Date(f + 'T00:00:00');
      return mesesSet.has(`${d.getFullYear()}-${d.getMonth() + 1}`);
    });
    if (semanasFiltradas.length === 0) return;

    // generar solo trae las semanas nuevas al UI
    const genFiltrado: GenerarAsignacionesRequest = {
      ...genPayload,
      fecha_inicio: semanasFiltradas[0],
      fecha_fin: semanasFiltradas[semanasFiltradas.length - 1],
    };

    // `semanas` va completa para que el backend calcule bien los ordinales de
    // la guía, y `meses_a_crear` le dice cuáles puede tocar. Mandar solo la
    // lista completa hacía que también creara —y borrara— en los meses que el
    // usuario acababa de excluir en este mismo diálogo.
    const createFiltrado: ProgramaMensualCreateRequest = {
      ...createPayload,
      meses_a_crear: faltantes.map(m => ({ ano: m.ano, mes: m.mes })),
    };
    this._ejecutarGeneracion(createFiltrado, genFiltrado);
  }

  cancelarConflictoModal(): void {
    this.showConflictoModal.set(false);
    this.pendingCreatePayload.set(null);
    this.pendingGenPayload.set(null);
  }

  private _ejecutarGeneracion(createPayload: ProgramaMensualCreateRequest, genPayload: GenerarAsignacionesRequest): void {
    this.estado.set('loading');
    this.errorMsg.set(null);
    // Si el backend conservó algún mes por tener asignaciones confirmadas, hay
    // que decirlo: el usuario pidió reemplazar y no se reemplazó todo.
    let conservados: Array<{ fecha: string; titulo_guia?: string | null }> = [];

    this.reunionesSvc
      .crearProgramaMensual(createPayload)
      .pipe(
        tap((res: any) => { conservados = res?.conservados ?? []; }),
        switchMap(() => this.reunionesSvc.generarAsignaciones(genPayload)),
      )
      .subscribe({
        next: (resp) => {
          const seen = new Set<number>();
          const unicas = resp.semanas.filter(s => seen.has(s.semana_iso) ? false : (seen.add(s.semana_iso), true));
          this.semanas.set(unicas);
          this.selectedWeekIdx.set(0);
          this.selectedSala.set('Principal');
          this.estado.set('borrador');
          this.avisoConservados.set(
            conservados.length > 0
              ? `Se conservaron ${conservados.length} semana(s) que ya tenían asignaciones ` +
                `publicadas (${conservados.map(c => c.fecha).join(', ')}). ` +
                'Elimina su programación desde el historial si quieres regenerarlas.'
              : null
          );
          this.loadPeriodos(this.congregacionCtx.effectiveCongregacionId()!);
        },
        error: (err) => {
          const msg = err?.error?.detail ?? err?.message ?? 'Error al generar el programa.';
          this.errorMsg.set(msg);
          this.estado.set('error');
        },
      });
  }

  // ── Manual swap ────────────────────────────────────────────────
  // Unique key per pill — disambiguates conductor vs lector sharing the same id_programa_parte
  pillKey(asig: AsignacionDraft): string {
    return asig.id_asignacion != null
      ? `a${asig.id_asignacion}`
      : `p${asig.id_programa_parte}|${asig.nombre_parte ?? ''}|${asig.es_ayudante ? '1' : '0'}`;
  }

  cerrarDropdown(): void {
    this.editingHistorialId.set(null);
  }

  /**
   * Calcula dónde plantar el panel `fixed`, igual que en Logística: parte de
   * la posición real de la píldora en pantalla, no de dónde vive en el
   * árbol -que es justo lo que hacía que el panel viejo, anclado con
   * `absolute` dentro de la tarjeta de sección, se recortara contra su
   * `overflow-hidden` en vez de flotar libre.
   */
  private posicionarDropdown(key: string, intentos = 5): void {
    requestAnimationFrame(() => {
      const disparador = document.querySelector<HTMLElement>(`[data-pill="${key}"]`);
      if (!disparador) {
        if (intentos > 0) this.posicionarDropdown(key, intentos - 1);
        return;
      }
      const PANEL_ANCHO = 256; // w-64
      const PANEL_ALTO_ESTIMADO = 320;
      const MARGEN = 8;
      const rect = disparador.getBoundingClientRect();
      const espacioAbajo = window.innerHeight - rect.bottom;
      const espacioArriba = rect.top;
      const openUp = espacioAbajo < PANEL_ALTO_ESTIMADO && espacioArriba > espacioAbajo;
      const left = Math.min(
        Math.max(rect.right - PANEL_ANCHO, MARGEN),
        window.innerWidth - PANEL_ANCHO - MARGEN,
      );
      this.dropdownPos.set({
        top: openUp ? rect.top - MARGEN : rect.bottom + MARGEN,
        left,
        openUp,
      });
    });
  }

  /**
   * El panel es `fixed`, pero la píldora que lo abrió viaja con el scroll de
   * la lista: sin esto quedaban separados y el panel terminaba flotando
   * sobre partes que no eran la suya. Un único listener en `document` y en
   * fase de captura porque el scroll puede venir de la lista, del contenedor
   * horizontal de una fila o de la ventana, y ese evento no burbujea.
   */
  private vigilarScrollParaCerrarDropdown(): void {
    const alScroll = (ev: Event) => {
      if (this.editingHistorialId() === null) return;
      const t = ev.target as HTMLElement | null;
      if (t?.closest?.('[data-dropdown-popover]')) return;
      this.zone.run(() => {
        this.editingHistorialId.set(null);
      });
    };
    this.zone.runOutsideAngular(() => {
      document.addEventListener('scroll', alScroll, { capture: true, passive: true });
    });
    this.destroyRef.onDestroy(() => {
      document.removeEventListener('scroll', alScroll, { capture: true });
    });
  }

  onPillClick(asig: AsignacionDraft, seccion: any): void {
    this.mobileSheetAsig.set(asig);
    this.mobileSheetSeccion.set(seccion);
    // El mismo camino en borrador y publicado: escriben en la misma fila.
    this.openHistorialEdit(asig);
  }

  closeMobileSheet(): void {
    this.mobileSheetAsig.set(null);
    this.editingHistorialId.set(null);
    this.busquedaCandidato.set('');
    this.busquedaResultados.set([]);
  }

  isGroupOpen(grupo: any): boolean {
    const openId = this.editingHistorialId();
    if (openId === null) return false;
    return grupo.partes.some((p: any) => this.pillKey(p) === openId);
  }

  // ── Publicar ───────────────────────────────────────────────────
  publicar(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    const semanas = this.semanas();
    if (semanas.length === 0) return;

    this.estado.set('loading');

    // Va la fecha de CADA semana, no un único año para todas: es lo que
    // identifica la semana en el backend, sin cálculos de semana ISO por medio.
    const payload: PublicarProgramaRequest = {
      tipo_reunion: this.tipoReunionActivo(),
      id_congregacion: idCong,
      fechas: semanas.map((s) => s.fecha.slice(0, 10)),
    };

    this.reunionesSvc.publicarPrograma(payload).subscribe({
      next: (res) => {
        this.loadPeriodos(idCong);
        // Publicar "a medias" tiene que verse. Antes el backend se saltaba en
        // silencio las semanas sin borrador y la pantalla decía "confirmado".
        const perdidas = res.semanas_sin_borrador ?? [];
        if (perdidas.length > 0) {
          this.estado.set('error');
          this.errorMsg.set(
            `Se publicaron ${res.publicadas} asignaciones, pero ${perdidas.length} ` +
            `semana(s) no tenían nada en borrador: ${perdidas.join(', ')}. ` +
            'Vuelve a generarlas antes de publicar.'
          );
          return;
        }
        this.estado.set('publicado');
        this.recienPublicado.set(true);
      },
      error: (err) => {
        const msg = err?.error?.detail ?? 'Error al publicar la programación.';
        this.errorMsg.set(msg);
        this.estado.set('error');
      },
    });
  }

  async borrarBorrador(): Promise<void> {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    const semanas = this.semanas();
    if (!idCong || semanas.length === 0 || this.estado() !== 'borrador') return;
    const ok = await this.openConfirmDialog(
      'Borrar borrador',
      '¿Deseas borrar este borrador? Las asignaciones generadas se perderán y no se podrán recuperar.'
    );
    if (!ok) return;

    this.estado.set('loading');
    this.errorMsg.set(null);

    // Va la fecha de cada semana. Antes iba un único año —el de la primera— y
    // los borradores del año siguiente no se borraban.
    this.reunionesSvc.borrarBorrador(
      this.tipoReunionActivo(), idCong, semanas.map((s) => s.fecha.slice(0, 10)),
    ).subscribe({
      next: () => {
        this.semanas.set([]);
        this.selectedWeekIdx.set(0);
        this.periodoActivo.set(null);
        this.estado.set('idle');
        this.loadPeriodos(idCong);
      },
      error: (err) => {
        const msg = err?.error?.detail ?? 'Error al borrar el borrador.';
        this.errorMsg.set(msg);
        this.estado.set('error');
      },
    });
  }


  // ── CSS helpers ────────────────────────────────────────────────
  estadoBadgeClass = computed(() => {
    const base = 'px-2.5 py-1 rounded-full text-xs font-bold border ';
    const map: Record<string, string> = {
      idle:       base + 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
      loading:    base + 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 animate-pulse',
      borrador:   base + 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
      publicado:  base + 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
      error:      base + 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    };
    return map[this.estado()] ?? map['idle'];
  });

  estadoLabel = computed(() => {
    const map: Record<string, string> = {
      idle: 'Sin programa',
      loading: 'Procesando...',
      borrador: 'Borrador',
      publicado: 'Publicado',
      error: 'Error',
    };
    return map[this.estado()] ?? '';
  });

  weekTabClass(i: number): string {
    return i === this.selectedWeekIdx()
      ? 'bg-[#6D28D9] text-white border-[#6D28D9] shadow-sm shadow-purple-900/20'
      : 'text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#6D28D9]/40 hover:text-[#6D28D9] dark:hover:border-[#6D28D9]/30 dark:hover:text-[#a78bfa] bg-white dark:bg-slate-800';
  }

  salaTabClass(sala: 'Principal' | 'Auxiliar'): string {
    const base = 'flex items-center gap-1 px-2 h-6 rounded text-[0.65rem] font-bold whitespace-nowrap transition-all shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ';
    return sala === this.selectedSala()
      ? base + 'bg-white/80 shadow-sm'
      : base + 'opacity-60 hover:opacity-90';
  }

  /** Un hueco de verdad: sin nadie y de las que sí esperan a alguien. */
  private esHueco(asig: AsignacionDraft): boolean {
    return asig.estado === 'sin_asignar' && asig.asignable !== false;
  }

  parteCardClass(asig: AsignacionDraft): string {
    if (this.esHueco(asig))
      return 'bg-red-50/40 dark:bg-red-900/10';
    if (asig._swapped)
      return 'bg-amber-50/40 dark:bg-amber-900/10';
    return 'hover:bg-slate-50 dark:hover:bg-slate-800/40';
  }

  grupoCardClass(grupo: { partes: AsignacionDraft[] }): string {
    const hasConflict = grupo.partes.some(p => this.esHueco(p));
    const hasSwapped = grupo.partes.some(p => p._swapped);
    if (hasConflict) return 'bg-red-50/30 dark:bg-red-900/10';
    if (hasSwapped)  return 'bg-amber-50/30 dark:bg-amber-900/10';
    return 'hover:bg-slate-50/60 dark:hover:bg-slate-800/20';
  }

  assigneeButtonClass(asig: AsignacionDraft): string {
    if (this.esHueco(asig)) return 'assignee-btn conflict';
    if (asig._swapped)              return 'assignee-btn swapped';
    return 'assignee-btn normal';
  }

  grupoHasConflict(partes: AsignacionDraft[]): boolean {
    return partes.some(p => this.esHueco(p));
  }
  grupoHasSwapped(partes: AsignacionDraft[]): boolean {
    return partes.some(p => p._swapped === true);
  }
  grupoDropdownActivo(partes: AsignacionDraft[]): boolean {
    const editId = this.editingHistorialId();
    return partes.some(p => editId === this.pillKey(p));
  }
  grupoHasReemplazo(partes: AsignacionDraft[]): boolean {
    return partes.some(p => p.es_reemplazo);
  }
  grupoDotColor(partes: AsignacionDraft[], seccionColor: string): string {
    if (partes.some(p => this.esHueco(p))) return '#ef4444';
    if (partes.some(p => p._swapped)) return '#f59e0b';
    return seccionColor;
  }

  displayNombreParte(asig: AsignacionDraft): string {
    const n = asig.nombre_parte || '';
    const nl = n.toLowerCase();
    if ((nl.includes('palabras de introducci') || nl.includes('introducción y oración') || nl.includes('introduccion y oracion'))
        && !nl.includes('presidente')) {
      return `${n} (Presidente)`;
    }
    return n;
  }

  grupoRoleLabel(grupo: { partes: AsignacionDraft[]; role0: string; role1: string }, pi: number): string {
    if (pi === 0) return grupo.role0;
    if (pi === 1) return grupo.role1;
    return 'Ayudante 2';
  }

  // ── Ayudantes: add / remove ─────────────────────────────────────
  loadingAyudante = signal<number | null>(null);

  readonly sexoOpts = [
    { v: null as string | null, l: 'Todos' },
    { v: 'F', l: '♀' },
    { v: 'M', l: '♂' },
  ];

  private _sexoFilters = new Map<string, string | null>();

  setSexoFilter(asig: AsignacionDraft, sexo: string | null): void {
    this._sexoFilters.set(this.pillKey(asig), sexo);
  }

  getSexoFilter(asig: AsignacionDraft): string | null {
    return this._sexoFilters.get(this.pillKey(asig)) ?? null;
  }

  filteredAlternativos(asig: AsignacionDraft): CandidatoAlternativo[] {
    const alternativos = asig.alternativos ?? [];
    if (!asig.es_ayudante) return alternativos;
    const filtro = this._sexoFilters.get(this.pillKey(asig)) ?? null;
    if (!filtro) return alternativos;
    return alternativos.filter(a => {
      const sexo = (a as any).sexo;
      if (!sexo) return true;
      return sexo.toUpperCase().startsWith(filtro);
    });
  }

  puedeAgregarAyudante(grupo: { partes: AsignacionDraft[] }, seccion: any): boolean {
    if (seccion?.id !== 'seamos_mejores') return false;
    const ayudantes = grupo.partes.filter(p => p.es_ayudante);
    return ayudantes.length < 2 && grupo.partes[0]?.aplica_sala_b === true;
  }

  onAgregarAyudante(grupo: { partes: AsignacionDraft[] }, semanaIdx: number): void {
    const maestro = grupo.partes.find(p => !p.es_ayudante);
    if (!maestro) return;
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    this.loadingAyudante.set(maestro.id_programa_parte);
    this.reunionesSvc.agregarAyudante(maestro.id_programa_parte, idCong).subscribe({
      next: (nuevaAsig) => {
        this.semanas.update(semanas => semanas.map((sem, si) => {
          if (si !== semanaIdx) return sem;
          return { ...sem, partes: [...sem.partes, nuevaAsig] };
        }));
        this.loadingAyudante.set(null);
      },
      error: () => this.loadingAyudante.set(null),
    });
  }

  onEliminarAyudante(asig: AsignacionDraft, semanaIdx: number, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    this.reunionesSvc.eliminarAyudante(asig.id_programa_parte, idCong).subscribe({
      next: () => {
        this.semanas.update(semanas => semanas.map((sem, si) => {
          if (si !== semanaIdx) return sem;
          // Un ayudante declarado por la guía comparte id_programa_parte con
          // su maestro: el backend solo borra la fila del ayudante y la
          // ranura sigue existiendo (vacía). Filtrar por id_programa_parte
          // se llevaba también al maestro, y la fila entera desaparecía
          // hasta recargar. Uno añadido a mano no tiene maestro con quien
          // compartir id_programa_parte, así que ahí sí desaparece del todo
          // porque el backend borró su ProgramaPartes completa.
          const tieneMaestro = sem.partes.some(p => p.id_programa_parte === asig.id_programa_parte && !p.es_ayudante);
          return {
            ...sem,
            partes: tieneMaestro
              ? sem.partes.map(p => p === asig
                  ? { ...p, id_asignacion: undefined, id_publicador: 0, nombre_completo: '', telefono: null, estado: 'sin_asignar' as const }
                  : p)
              : sem.partes.filter(p => p !== asig),
          };
        }));
        this._sexoFilters.delete(this.pillKey(asig));
      },
    });
  }

  async onQuitarAsignacion(asig: AsignacionDraft, semanaIdx: number, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (!asig.id_asignacion) return;
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    const ok = await this.openConfirmDialog(
      'Dejar sin asignar',
      `¿Quitar a ${asig.nombre_completo} de esta parte? La ranura queda libre para asignar a alguien más.`,
    );
    if (!ok) return;
    this.reunionesSvc.eliminarAsignacion(asig.id_asignacion, idCong).subscribe({
      next: () => {
        this.semanas.update(semanas => semanas.map((sem, si) => {
          if (si !== semanaIdx) return sem;
          return {
            ...sem,
            // Por id_asignacion, no solo id_programa_parte: el conductor y el
            // lector del EBC comparten id_programa_parte y ambos son
            // !es_ayudante, así que sin este filtro quitar uno se llevaba
            // los dos.
            partes: sem.partes.map(p => p.id_asignacion === asig.id_asignacion && !p.es_ayudante
              ? { ...p, id_asignacion: undefined, id_publicador: 0, nombre_completo: '', telefono: null, estado: 'sin_asignar' as const }
              : p),
          };
        }));
      },
    });
  }

  // ── Historial ──────────────────────────────────────────────────
  readonly MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  periodoEliminable(p: { ano: number; mes: number }): boolean {
    const hoy = new Date();
    const limite = new Date(hoy.getFullYear(), hoy.getMonth() - 4, 1);
    const periodo = new Date(p.ano, p.mes - 1, 1);
    return periodo >= limite;
  }

  toggleGrupo(key: string, event: Event): void {
    event.stopPropagation();
    this.gruposExpandidos.update(set => {
      const next = new Set(set);
      if (next.has(key)) { next.delete(key); } else { next.add(key); }
      return next;
    });
  }

  abreviarNombreGuia(nombre: string): string {
    // "Guía de Actividades - Mayo 2026" → "GDA - Mayo 2026"
    return nombre.replace(/Gu[ií]a\s+de\s+Actividades/i, 'GDA');
  }

  descargarPdfMes(p: PeriodoConfirmado, event: Event): void {
    event.stopPropagation();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || this.descargandoPdf()) return;
    this.descargandoPdf.set(true);
    this.reunionesSvc
      .descargarProgramacionPdf(this.tipoReunionActivo(), p.ano, p.mes, idCong)
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `programacion_${this.tipoReunionActivo()}_${p.ano}_${String(p.mes).padStart(2, '0')}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          this.descargandoPdf.set(false);
        },
        error: () => this.descargandoPdf.set(false),
      });
  }

  descargarPapeletas(p: PeriodoConfirmado, formato: 'x4', event: Event): void {
    event.stopPropagation();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong || this.descargandoPapeletas()) return;
    this.descargandoPapeletas.set(true);
    this.reunionesSvc
      .descargarPapeletasPdf(p.ano, p.mes, idCong, formato)
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `papeletas_${p.ano}_${String(p.mes).padStart(2, '0')}_${formato}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          this.descargandoPapeletas.set(false);
        },
        error: () => this.descargandoPapeletas.set(false),
      });
  }

  /** Ícono de WhatsApp que aparece junto al nombre del titular, cuando la
   *  parte lleva papeleta S-89-S (lo decide el backend) y ya tiene a alguien
   *  asignado. */
  mostrarWhatsappPapeleta(asig: AsignacionDraft): boolean {
    return !!asig.id_publicador && !asig.es_ayudante && !!asig.papeleta_s89;
  }

  private papeletaKey(asig: AsignacionDraft): string {
    return `${asig.id_programa_parte}:${asig.sala || 'Principal'}`;
  }

  enviandoEstaPapeleta(asig: AsignacionDraft): boolean {
    return this.enviandoPapeletaKey() === this.papeletaKey(asig);
  }

  /** En escritorio, navigator.share con archivos abre el panel nativo de
   *  "Compartir" del sistema operativo (busca extensiones instaladas, no
   *  WhatsApp). Solo en móvil ese panel incluye de verdad la app de WhatsApp
   *  como destino, que es el único camino donde la imagen viaja adjunta. */
  private esMovil(): boolean {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /** Deja el PNG en el portapapeles. Recibe la promesa y no el blob porque
   *  Safari exige que el ClipboardItem se construya dentro del gesto del
   *  usuario: con el blob ya resuelto, la escritura se rechaza. */
  private async copiarPapeletaAlPortapapeles(imagen: Promise<Blob>): Promise<boolean> {
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) return false;
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': imagen })]);
      return true;
    } catch {
      return false;
    }
  }

  /** No era para sacar una papeleta por hoja: el pedido real era mandarle a
   *  este publicador, por WhatsApp, la imagen de su propia asignación (sea
   *  sala principal o auxiliar), sin imprimir ni recortar nada.
   *
   *  Ningún enlace de WhatsApp admite adjuntos —ni wa.me ni api.whatsapp.com
   *  aceptan más que texto—, así que la imagen se hace llegar por el camino
   *  más corto que permita el navegador: adjunto real en móvil, y en
   *  escritorio portapapeles o descarga, pegándola a mano en el chat.
   *
   *  En escritorio el chat NO se abre solo: abrirlo mueve el foco a la otra
   *  pestaña y cualquier aviso de "pega la imagen" se queda sin leer detrás
   *  —así se mandó un mensaje sin la papeleta—. Primero se muestra qué se va
   *  a enviar, y el salto a WhatsApp lo da el usuario. */
  async enviarPapeletaWhatsapp(asig: AsignacionDraft, event: Event): Promise<void> {
    event.stopPropagation();
    const p = this.periodoActivo();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!p || !idCong || this.enviandoPapeletaKey()) return;
    this.enviandoPapeletaKey.set(this.papeletaKey(asig));

    const imagen = firstValueFrom(
      this.reunionesSvc.descargarPapeletaImagen(
        p.ano, p.mes, idCong, asig.id_programa_parte, asig.sala || 'Principal',
      ),
    );
    // Si solo la consume el portapapeles, su rechazo quedaría sin manejar.
    imagen.catch(() => undefined);

    const mensaje = `Hola ${asig.nombre_completo}, te comparto tu asignación para la reunión Vida y Ministerio Cristianos.`;

    // El portapapeles se intenta antes de esperar la descarga, para no perder
    // el gesto del usuario (ver copiarPapeletaAlPortapapeles).
    const copiada = this.esMovil() ? false : await this.copiarPapeletaAlPortapapeles(imagen);

    let blob: Blob;
    try {
      blob = await imagen;
    } catch {
      this.enviandoPapeletaKey.set(null);
      return;
    }
    this.enviandoPapeletaKey.set(null);

    // Móvil: el panel de compartir sí lleva la imagen adjunta de verdad, así
    // que no hay nada que pegar ni que explicar.
    const file = new File([blob], 'asignacion.png', { type: 'image/png' });
    if (this.esMovil() && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Asignación', text: mensaje });
      } catch {
        // Canceló el panel de compartir: ya decidió no mandarlo.
      }
      return;
    }

    this.papeletaPreview.set({
      nombre: asig.nombre_completo,
      telefono: asig.telefono ?? null,
      mensaje,
      url: URL.createObjectURL(blob),
      copiada,
    });
  }

  cerrarPapeletaPreview(): void {
    const prev = this.papeletaPreview();
    if (prev) URL.revokeObjectURL(prev.url);
    this.papeletaPreview.set(null);
  }

  descargarPapeletaPreview(): void {
    const prev = this.papeletaPreview();
    if (!prev) return;
    const a = document.createElement('a');
    a.href = prev.url;
    a.download = `asignacion_${prev.nombre.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  abrirChatPapeleta(): void {
    const prev = this.papeletaPreview();
    if (!prev) return;
    window.open(whatsappUrl(prev.mensaje, prev.telefono), '_blank');
    this.cerrarPapeletaPreview();
  }

  async eliminarHistorial(p: PeriodoConfirmado, event: Event): Promise<void> {
    event.stopPropagation();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    const ok = await this.openConfirmDialog(
      `Eliminar ${p.label}`,
      `Se borrarán todas las semanas, partes y asignaciones de este mes. Esta acción no se puede deshacer.`
    );
    if (!ok) return;
    this.reunionesSvc.eliminarHistorialMes(this.tipoReunionActivo(), p.ano, p.mes, idCong).subscribe({
      next: () => {
        this.periodos.update(list => list.filter(x => !(x.ano === p.ano && x.mes === p.mes)));
        this.semanas.set([]);
        this.estado.set('idle');
      },
    });
  }

  borrandoSalaB = signal(false);

  /**
   * Quita la Sala B del mes abierto: borra sus asignaciones Y deja de
   * ofrecer sus casillas, dejando la Sala Principal intacta.
   *
   * Primero un dry_run para poder decir cuántas asignaciones se van a perder
   * -mismo patrón que marcar una semana sin reunión-: sin ese número, la
   * confirmación sería un "¿seguro?" a ciegas sobre algo irreversible.
   *
   * Se pide confirmación aunque `borradas` sea 0: un mes al que el motor no
   * pudo asignarle a nadie en Sala B no tiene nada que borrar, pero sus
   * casillas vacías siguen ahí y también hay que quitarlas.
   */
  async eliminarSalaBDelMes(event: Event): Promise<void> {
    event.stopPropagation();
    const activo = this.periodoActivo();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!activo || !idCong || this.borrandoSalaB()) return;

    this.borrandoSalaB.set(true);
    this.reunionesSvc.eliminarSalaBConfirmada(activo.ano, activo.mes, idCong, true).subscribe({
      next: async (previo) => {
        this.borrandoSalaB.set(false);

        const mensaje = previo.borradas > 0
          ? `Se borrarán ${previo.borradas} asignaciones y las casillas de Sala B de este mes. ` +
            'La Sala Principal no se toca. Esta acción no se puede deshacer.'
          : 'Las casillas de Sala B de este mes dejarán de ofrecerse. ' +
            'La Sala Principal no se toca. Esta acción no se puede deshacer.';
        const ok = await this.openConfirmDialog('Quitar la Sala B de este mes', mensaje);
        if (!ok) return;

        this.borrandoSalaB.set(true);
        this.reunionesSvc.eliminarSalaBConfirmada(activo.ano, activo.mes, idCong, false).subscribe({
          next: () => {
            this.borrandoSalaB.set(false);
            // La vista puede estar parada en "Sala B", que ya no existe.
            this.selectedSala.set('Principal');
            this.loadMes(activo.mes, activo.ano);
          },
          error: (err) => {
            this.borrandoSalaB.set(false);
            this.errorMsg.set(err?.error?.detail ?? 'No se pudo quitar la Sala B.');
            this.estado.set('error');
          },
        });
      },
      error: (err) => {
        this.borrandoSalaB.set(false);
        this.errorMsg.set(err?.error?.detail ?? 'No se pudo comprobar la Sala B de este mes.');
        this.estado.set('error');
      },
    });
  }

  async eliminarGuiaCompleta(grupo: GrupoPlantilla, event: Event): Promise<void> {
    event.stopPropagation();
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    const mesesLabel = grupo.periodos.map(p => p.label).join(', ');
    const ok = await this.openConfirmDialog(
      `Eliminar "${grupo.nombre_plantilla}"`,
      `Se eliminarán todos los programas de ${mesesLabel}. Las semanas, partes y asignaciones se perderán permanentemente.`
    );
    if (!ok) return;

    const mesSet = new Set(grupo.periodos.map(p => `${p.ano}-${p.mes}`));
    const limpiar = () => {
      this.periodos.update(list => list.filter(p => !mesSet.has(`${p.ano}-${p.mes}`)));
      this.semanas.set([]);
      this.estado.set('idle');
    };

    if (grupo.id_plantilla !== null) {
      this.reunionesSvc.eliminarHistorialPlantilla(grupo.id_plantilla, idCong).subscribe({ next: limpiar });
    } else {
      // "Sin guía asociada": eliminar mes a mes en serie
      const tipo = this.tipoReunionActivo();
      const periodos = [...grupo.periodos];
      const deleteNext = (idx: number) => {
        if (idx >= periodos.length) { limpiar(); return; }
        const p = periodos[idx];
        this.reunionesSvc.eliminarHistorialMes(tipo, p.ano, p.mes, idCong).subscribe({
          next: () => deleteNext(idx + 1),
          error: () => deleteNext(idx + 1),
        });
      };
      deleteNext(0);
    }
  }

  /** Abre de una vez todos los meses que tengan borrador pendiente. */
  private abrirBorradorPendiente(idCong: number, meses: PeriodoConfirmado[]): void {
    this.estado.set('loading');
    this.errorMsg.set(null);
    this.recienPublicado.set(false);
    forkJoin(
      meses.map((m) =>
        this.reunionesSvc
          .getProgramaMes(this.tipoReunionActivo(), m.ano, m.mes, idCong)
          .pipe(catchError(() => of([] as ProgramaSemana[]))),
      ),
    ).subscribe((porMes) => {
      const semanas = porMes.flat();
      if (semanas.length === 0) { this.estado.set('idle'); return; }
      this.semanas.set(semanas);
      this.selectedWeekIdx.set(0);
      this.selectedSala.set('Principal');
      this.periodoActivo.set({ mes: meses[0].mes, ano: meses[0].ano });
      this.estado.set('borrador');
    });
  }

  /**
   * Abre un mes, esté en borrador o publicado.
   *
   * Es el único camino para poner semanas en pantalla. Antes había dos —uno
   * para el borrador cacheado y otro para el historial confirmado— y cada uno
   * leía de un sitio distinto, que es de donde salía que un cambio hecho en
   * borrador no llegara a lo confirmado.
   */
  loadMes(mes: number, ano: number): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    this.periodoActivo.set({ mes, ano });
    this.loadingHistorial.set(true);
    this.errorMsg.set(null);
    this.recienPublicado.set(false);
    this.reunionesSvc.getProgramaMes(this.tipoReunionActivo(), ano, mes, idCong).subscribe({
      next: (semanas) => {
        if (semanas.length === 0) {
          this.errorMsg.set(`No hay programación para ${this.MESES[mes - 1]} ${ano}.`);
          this.estado.set('error');
        } else {
          this.semanas.set(semanas);
          this.selectedWeekIdx.set(0);
          this.selectedSala.set('Principal');
          // Basta una semana en borrador para que el mes entero lo esté:
          // publicar es todo o nada.
          this.estado.set(
            semanas.some((s) => s.estado === 'borrador') ? 'borrador' : 'publicado'
          );
        }
        this.loadingHistorial.set(false);
      },
      error: () => {
        this.errorMsg.set('Error al cargar la programación del mes.');
        this.estado.set('error');
        this.loadingHistorial.set(false);
      },
    });
  }

  openHistorialEdit(asig: AsignacionDraft): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;
    const toggleKey = this.pillKey(asig);
    if (this.editingHistorialId() === toggleKey) {
      this.editingHistorialId.set(null);
      this.busquedaCandidato.set('');
      this.busquedaResultados.set([]);
      return;
    }
    this.editingHistorialId.set(toggleKey);
    this.posicionarDropdown(this.pillKey(asig));
    this.historialCandidatos.set([]);
    this.busquedaCandidato.set('');
    this.busquedaResultados.set([]);
    // La semana recién generada ya trae los candidatos que calculó el motor.
    if (asig.alternativos?.length) return;
    // Si no, se piden. Por ranura y no por asignación: una casilla vacía no
    // tiene `id_asignacion` que pasar, y antes se quedaba solo con la búsqueda
    // libre porque sus candidatos venían dentro del borrador cacheado.
    this.loadingCandidatos.set(true);
    const peticion = asig.id_asignacion
      ? this.reunionesSvc.getCandidatosAsignacion(asig.id_asignacion, idCong)
      : this.reunionesSvc.getCandidatosRanura(
          asig.id_programa_parte, idCong,
          asig.sala === 'Auxiliar' ? 'Auxiliar' : 'Principal', !!asig.es_ayudante,
        );
    peticion.subscribe({
      next: (candidatos) => {
        this.historialCandidatos.set(candidatos);
        this.loadingCandidatos.set(false);
      },
      error: () => this.loadingCandidatos.set(false),
    });
  }

  /**
   * Los candidatos que pinta el panel, venga la semana de donde venga.
   *
   * Recién generada trae los del motor pegados a cada ranura; al reabrirla más
   * tarde no vienen y se piden al abrir el panel.
   */
  candidatosPanel(asig: AsignacionDraft): CandidatoAlternativo[] {
    return asig.alternativos?.length
      ? this.filteredAlternativos(asig)
      : this.historialCandidatos();
  }

  onBusquedaCandidatoChange(q: string): void {
    this.busquedaCandidato.set(q);
    if (this._busquedaTimer) clearTimeout(this._busquedaTimer);
    if (!q.trim()) {
      this.busquedaResultados.set([]);
      this.loadingBusqueda.set(false);
      return;
    }
    this.loadingBusqueda.set(true);
    this._busquedaTimer = setTimeout(() => {
      const idCong = this.congregacionCtx.effectiveCongregacionId();
      if (!idCong) return;
      // Va la fecha de la semana abierta para que el servidor marque a quien
      // esté ausente ese día. Esta búsqueda se salta al motor a propósito, así
      // que el ausente sigue en la lista: se avisa, no se esconde.
      const fecha = this.currentSemana()?.fecha?.slice(0, 10);
      this.reunionesSvc.buscarPublicadoresCong(idCong, q, fecha).subscribe({
        next: (res) => {
          this.busquedaResultados.set(res);
          this.loadingBusqueda.set(false);
        },
        error: () => this.loadingBusqueda.set(false),
      });
    }, 300);
  }

  selectHistorialCandidato(semanaIdx: number, asig: AsignacionDraft, candidato: CandidatoAlternativo): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    const semana = this.semanas()[semanaIdx];
    if (!idCong || !semana) return;

    const applyResult = (result: { id_asignacion: number; id_publicador: number; nombre_completo: string }) => {
      this.semanas.update((semanas) =>
        semanas.map((sem, si) => {
          if (si !== semanaIdx) return sem;
          return {
            ...sem,
            // Se compara por pillKey y no por id_programa_parte: Principal,
            // Sala B y sus ayudantes comparten ese id, así que rellenar una
            // ranura vacía escribía el nombre en las cuatro filas a la vez.
            partes: sem.partes.map((p) =>
              this.pillKey(p) === this.pillKey(asig)
                ? { ...p, id_asignacion: result.id_asignacion, id_publicador: result.id_publicador, nombre_completo: result.nombre_completo, estado: this.estado() === 'publicado' ? 'publicado' as const : 'borrador' as const, _swapped: true }
                : p
            ),
          };
        })
      );
      this.editingHistorialId.set(null);
      this.mobileSheetAsig.set(null);
    };

    const alFallar = (err: any) => {
      // El error se enseña. Cuando esto se lo tragaba, el clic simplemente no
      // hacía nada y no había forma de saber por qué.
      this.editingHistorialId.set(null);
      this.mobileSheetAsig.set(null);
      this.errorMsg.set(err?.error?.detail ?? 'No se pudo guardar la asignación.');
      this.estado.set('error');
    };

    const doEdit = () => {
      if (!asig.id_asignacion) {
        // Ranura vacía: se crea la asignación indicando CUÁL es, porque la
        // parte puede tener hasta cuatro y todas comparten id.
        this.reunionesSvc.crearAsignacion(
          asig.id_programa_parte,
          candidato.id_publicador,
          idCong,
          asig.sala === 'Auxiliar' ? 'Auxiliar' : 'Principal',
          !!asig.es_ayudante,
        ).subscribe({ next: applyResult, error: alFallar });
        return;
      }
      const payload: EditarAsignacionRequest = { id_publicador_nuevo: candidato.id_publicador };
      this.reunionesSvc.editarAsignacion(asig.id_asignacion, payload, idCong).subscribe({
        next: applyResult,
        error: alFallar,
      });
    };

    // La comprobación de conflictos se hace también al rellenar un hueco. Antes
    // se saltaba justo en ese caso —el único en el que no hay una asignación
    // previa que excluir— y era además donde más falta hacía: se estaba
    // eligiendo a alguien de cero para un día que puede tenerlo ya ocupado.
    this.conflictosSvc
      .confirmarSiHayConflicto(
        candidato.id_publicador,
        semana.fecha,
        idCong,
        candidato.nombre_completo,
        asig.id_asignacion ? { tipo: 'entre_semana', id: asig.id_asignacion } : undefined,
      )
      .subscribe((proceder) => {
        if (proceder) doEdit();
        else this.editingHistorialId.set(null);
      });
  }

  // ── Date utilities ─────────────────────────────────────────────
  private calcFechasRango(
    anoInicio: number, mesInicio: number,
    anoFin: number,   mesFin: number,
    diaSemana: number
  ): string[] {
    const fechas: string[] = [];
    const primerDia = new Date(anoInicio, mesInicio - 1, 1);
    const isoDay = primerDia.getDay() === 0 ? 7 : primerDia.getDay();
    let offset = diaSemana - isoDay;
    if (offset < 0) offset += 7;
    let current = new Date(anoInicio, mesInicio - 1, 1 + offset);
    // límite: primer día del mes siguiente al mes de fin
    const limite = new Date(anoFin, mesFin, 1);
    while (true) {
      // Límite estricto por mes calendario de la fecha de reunión.
      if (current >= limite) break;
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      fechas.push(`${y}-${m}-${d}`);
      current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7);
    }
    return fechas;
  }

  private calcFechas(ano: number, mes: number, diaSemana: number): string[] {
    return this.calcFechasRango(ano, mes, ano, mes, diaSemana);
  }

  /**
   * (año ISO, semana ISO) de una fecha — la clave con la que el backend guarda
   * los borradores en Redis (ssr.iso_key en Python).
   *
   * Las dos mitades salen del mismo cálculo a propósito. Antes la semana venía
   * de aquí y el año de `new Date(fecha).getFullYear()`, y en el borde de año
   * no son lo mismo: el 2025-12-31 es la semana 1 de 2026, no la 1 de 2025.
   * Mezclarlos apuntaba a una celda de Redis que no existía —o peor, a la de
   * otra semana.
   */
  private isoKey(dateStr: string): { ano: number; semana: number } {
    const d = new Date(dateStr);
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Jueves de esa semana: su año natural ES el año ISO de la semana.
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const ano = date.getUTCFullYear();
    const yearStart = new Date(Date.UTC(ano, 0, 1));
    const semana = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return { ano, semana };
  }

  /** La clave ISO de una semana ya cargada. Prefiere el `ano_iso` que manda el
   *  backend y solo lo recalcula si viene de un draft antiguo sin ese campo. */
  private isoKeyDeSemana(sem: ProgramaSemana): { ano: number; semana: number } {
    if (sem.ano_iso != null) return { ano: sem.ano_iso, semana: sem.semana_iso };
    return this.isoKey(sem.fecha);
  }

  // ── Meeting type toggle ────────────────────────────────────────
  onTipoChange(tipo: 'entre_semana' | 'fin_semana' | 'logistica' | 'discursos'): void {
    if (tipo === this.tipoReunionActivo()) return;
    this.tipoReunionActivo.set(tipo);
    if (tipo === 'logistica' || tipo === 'discursos') return;
    // Reset state for new type
    this.semanas.set([]);
    this.selectedWeekIdx.set(0);
    this.selectedSala.set('Principal');
    this.estado.set('idle');
    this.errorMsg.set(null);
    this.periodos.set([]);
    this.editingHistorialId.set(null);
    // Reload for the new type
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (idCong) this.loadPeriodos(idCong, { abrirBorrador: true });
  }
}

