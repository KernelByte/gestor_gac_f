import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, Location, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ThemeService } from '../../../core/services/theme.service';
import { LogisticaPublicoOut, ProgramaDiaOut } from '../../reuniones/models/logistica.models';
import { whatsappUrl } from '../../../shared/whatsapp';

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const MESES_ABR_ES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic',
];
const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Mismo agrupamiento visual que `SECCION_PUESTOS` en
 * `reuniones-logistica.component.ts`, duplicado a propósito: esta página no
 * lleva sesión ni ningún otro import de esa pantalla de edición, así que un
 * import cruzado sólo por unas líneas de constante añadiría un acoplamiento
 * que no vale la pena.
 */
const PUESTOS_LABEL: Record<string, string> = {
  acomodador_1: 'Acomodadores', acomodador_2: 'Acomodadores',
  vigilancia_1: 'Vigilancia', vigilancia_2: 'Vigilancia',
  microfono_1: 'Micrófonos', microfono_2: 'Micrófonos',
  plataforma: 'Plataforma', audio: 'Audio', video: 'Video',
};
/** Puestos que van bajo "Apoyo en auditorio" vs. "Técnica". */
const PUESTOS_TECNICA = new Set(['audio', 'video']);

/**
 * Un ícono por rol, igual criterio que `ROL_ICONOS` en la app móvil
 * (`reunion.tsx`) para que la misma tarjeta de logística se reconozca en
 * ambas superficies. Los path son equivalentes dibujados a mano en el mismo
 * estilo lucide (stroke 2, esquinas redondeadas) que usa el resto de la web.
 */
type IconoRol = 'mic' | 'walk' | 'shield' | 'podium' | 'audio' | 'video' | 'aseo' | 'hospitalidad';
const ICONO_POR_ETIQUETA: Record<string, IconoRol> = {
  'Micrófonos': 'mic',
  'Acomodadores': 'walk',
  'Vigilancia': 'shield',
  'Plataforma': 'podium',
  'Audio': 'audio',
  'Video': 'video',
};

/** Mismo orden fijo de tarjetas que usa la app móvil, para reconocer la pantalla. */
const ORDEN_ETIQUETA: Record<string, number> = {
  'Micrófonos': 0,
  'Acomodadores': 1,
  'Vigilancia': 2,
  'Plataforma': 3,
  'Audio': 0,
  'Video': 1,
};

interface FilaPuesto {
  etiqueta: string;
  icono: IconoRol;
  /** Uno o dos nombres -acomodador_1/_2 comparten fila-, cada uno en su línea. */
  nombres: string[];
}

interface FechaVista {
  fecha: string;
  tipoReunion: string;
  diaSemana: string;
  fechaLarga: string;
  filasApoyo: FilaPuesto[];
  filasTecnica: FilaPuesto[];
  /** Aseo + hospitalidad ya normalizados como filas, para reusar el mismo grid. */
  filasGrupos: FilaPuesto[];
}

interface Semana {
  inicio: Date;
  fin: Date;
  fechas: FechaVista[];
}

function lunesDeSemana(d: Date): Date {
  const dt = new Date(d);
  const dow = dt.getDay(); // 0=domingo
  const diff = dow === 0 ? -6 : 1 - dow;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Component({
  standalone: true,
  selector: 'app-public-logistica',
  imports: [CommonModule, NgTemplateOutlet],
  template: `
<div class="min-h-dvh flex flex-col bg-app-bg dark:bg-slate-900 text-gray-700 dark:text-slate-300 transition-colors">

  <header class="sticky top-0 z-40 border-b border-gray-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/85 backdrop-blur-md">
    <div class="max-w-2xl md:max-w-3xl lg:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <span class="grid place-items-center w-10 h-10 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0" style="box-shadow: var(--shadow-soft)">
          <img src="images/logo-gac-96.webp" class="w-6 h-6 object-contain" alt="GAC" width="24" height="24" />
        </span>
        <div class="min-w-0 leading-tight">
          <h1 class="font-display text-sm sm:text-base font-bold text-gray-900 dark:text-slate-100 truncate">
            {{ data()?.nombre_congregacion || 'Programa de reuniones' }}
          </h1>
          <p class="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
            @if (data()?.actualizado_en) {
              Actualizado el {{ data()!.actualizado_en | date:'d MMM':'':'es' }}
            } @else {
              {{ tituloMes() }}
            }
          </p>
        </div>
      </div>

      <button
        type="button"
        (click)="theme.toggleTheme()"
        [attr.aria-label]="theme.darkMode() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
        class="grid place-items-center w-10 h-10 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-violet-600 dark:hover:text-violet-300 transition shrink-0">
        @if (theme.darkMode()) {
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/></svg>
        } @else {
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>
        }
      </button>
    </div>
  </header>

  @if (cargando()) {
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="text-center text-violet-600 dark:text-violet-400">
        <span class="spinner mx-auto mb-3"></span>
        <p class="text-sm text-gray-500 dark:text-slate-400">Cargando el programa…</p>
      </div>
    </div>
  }

  @if (error() && !cargando()) {
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="card-padded max-w-sm w-full text-center !border-red-200 dark:!border-red-900/50">
        <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-red-50 dark:bg-red-950/40 grid place-items-center">
          <svg class="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
        </div>
        <h2 class="font-display text-base font-bold text-gray-900 dark:text-slate-100 mb-1.5">Enlace no disponible</h2>
        <p class="text-sm text-gray-500 dark:text-slate-400">{{ error() }}</p>
      </div>
    </div>
  }

  @if (data() && !cargando() && !error()) {
    <main class="flex-1 w-full max-w-2xl md:max-w-3xl lg:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 space-y-2.5">

      <!-- Navegación entre semanas + compartir, en una sola fila -->
      <div class="flex items-stretch gap-2">
        <div class="card flex-1 flex items-center gap-1 px-1.5 py-1.5 min-w-0">
          <button type="button" (click)="semanaAnterior()" [disabled]="semanaIndex() === 0"
            class="grid place-items-center w-9 h-9 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/60 hover:text-gray-800 dark:hover:text-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>

          <div class="flex-1 min-w-0 flex items-center justify-center flex-wrap gap-x-2 gap-y-0.5">
            <p class="font-display font-bold text-sm text-gray-900 dark:text-slate-100 whitespace-nowrap">
              Semana {{ semanaIndex() + 1 }} <span class="font-normal text-gray-400 dark:text-slate-500">de {{ semanas().length }}</span>
            </p>
            <span class="text-gray-300 dark:text-slate-600" aria-hidden="true">·</span>
            <p class="text-xs text-gray-500 dark:text-slate-400 tabular-nums whitespace-nowrap">{{ rangoSemana() }}</p>
            @if (esSemanaActual()) {
              <span class="badge-live">Semana actual</span>
            }
          </div>

          <button type="button" (click)="semanaSiguiente()" [disabled]="semanaIndex() >= semanas().length - 1"
            class="grid place-items-center w-9 h-9 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700/60 hover:text-gray-800 dark:hover:text-slate-100 transition disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent shrink-0">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
          </button>
        </div>

        <button type="button" (click)="compartirSemana()" class="btn-secondary !text-xs !px-3 shrink-0"
          [attr.aria-label]="copiado() ? 'Enlace copiado' : 'Compartir semana'">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"/></svg>
          <span class="hidden sm:inline">{{ copiado() ? 'Enlace copiado' : 'Compartir semana' }}</span>
        </button>
      </div>

      <!-- Reuniones de la semana: se apilan en móvil, se ven una junto a otra desde lg -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 items-stretch">
        @for (f of semanaActualFechas(); track f.fecha; let i = $index) {
          <article class="card overflow-hidden h-full flex flex-col" [class.animate-fadeInUp]="true" [style.animation-delay.ms]="i * 70">
            <header class="flex items-center gap-3 px-4 sm:px-5 py-2 bg-gray-50 dark:bg-slate-900/60 border-b border-gray-200 dark:border-slate-700">
              <span class="grid place-items-center w-9 h-9 rounded-lg bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 shrink-0">
                @if (f.tipoReunion === 'entre_semana') {
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
                } @else {
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/><path d="M12 12.5l.9 1.85 2.05.3-1.48 1.44.35 2.04L12 17.1l-1.82 1.03.35-2.04-1.48-1.44 2.05-.3z"/></svg>
                }
              </span>
              <div class="min-w-0">
                <p class="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                  {{ f.tipoReunion === 'entre_semana' ? 'Entre semana' : 'Fin de semana' }}
                </p>
                <p class="font-display font-bold text-base sm:text-lg text-gray-900 dark:text-slate-100 tracking-tight">{{ f.diaSemana }}, {{ f.fechaLarga }}</p>
              </div>
            </header>

            <div class="px-4 sm:px-5 pt-2.5 flex-1">
              <div class="space-y-3">
                @if (f.filasApoyo.length) {
                  <div>
                    <div class="flex items-center gap-1.5 mb-1.5">
                      <span class="w-1.5 h-1.5 rounded-full bg-sky-500 dark:bg-sky-400"></span>
                      <p class="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Apoyo en auditorio</p>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      @for (fila of f.filasApoyo; track fila.etiqueta) {
                        <div class="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/50 px-2.5 py-2 flex flex-col gap-0.5">
                          <div class="flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
                            <ng-container [ngTemplateOutlet]="iconoRol" [ngTemplateOutletContext]="{ $implicit: fila.icono }"></ng-container>
                            <span class="text-[10px] font-bold uppercase tracking-wide">{{ fila.etiqueta }}</span>
                          </div>
                          <div class="flex flex-col gap-0.5">
                            @for (nombre of fila.nombres; track nombre) {
                              <span class="text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug">{{ nombre }}</span>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (f.filasTecnica.length) {
                  <div>
                    <div class="flex items-center gap-1.5 mb-1.5">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400"></span>
                      <p class="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Técnica</p>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      @for (fila of f.filasTecnica; track fila.etiqueta) {
                        <div class="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/50 px-2.5 py-2 flex flex-col gap-0.5">
                          <div class="flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
                            <ng-container [ngTemplateOutlet]="iconoRol" [ngTemplateOutletContext]="{ $implicit: fila.icono }"></ng-container>
                            <span class="text-[10px] font-bold uppercase tracking-wide">{{ fila.etiqueta }}</span>
                          </div>
                          <div class="flex flex-col gap-0.5">
                            @for (nombre of fila.nombres; track nombre) {
                              <span class="text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug">{{ nombre }}</span>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                @if (f.filasGrupos.length) {
                  <div>
                    <div class="flex items-center gap-1.5 mb-1.5">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                      <p class="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Grupos</p>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      @for (fila of f.filasGrupos; track fila.etiqueta) {
                        <div class="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-900/50 px-2.5 py-2 flex flex-col gap-0.5" [class.col-span-full]="f.filasGrupos.length === 1">
                          <div class="flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
                            <ng-container [ngTemplateOutlet]="iconoRol" [ngTemplateOutletContext]="{ $implicit: fila.icono }"></ng-container>
                            <span class="text-[10px] font-bold uppercase tracking-wide">{{ fila.etiqueta }}</span>
                          </div>
                          <span class="text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug">{{ fila.nombres[0] }}</span>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>

              @if (!f.filasApoyo.length && !f.filasTecnica.length && !f.filasGrupos.length) {
                <p class="text-sm text-gray-400 dark:text-slate-500 pb-1">Sin asignaciones registradas para esta fecha.</p>
              }
            </div>

            <div class="p-4 sm:p-5 pt-3 flex flex-col gap-2">
              <button type="button" (click)="compartirWhatsApp(f)" [disabled]="enviando() === f.fecha"
                [class.btn-loading]="enviando() === f.fecha"
                class="btn-primary-green w-full !py-2.5 justify-center">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.4-1.35a9.85 9.85 0 004.64 1.18h.01c5.46 0 9.9-4.45 9.9-9.91C21.95 6.45 17.5 2 12.04 2zm0 17.87h-.01a8.2 8.2 0 01-4.17-1.14l-.3-.18-3.1.78.83-3.02-.2-.31a8.18 8.18 0 01-1.26-4.4c0-4.53 3.69-8.22 8.23-8.22 2.2 0 4.26.86 5.82 2.41a8.16 8.16 0 012.4 5.82c0 4.54-3.7 8.26-8.24 8.26zm4.52-6.18c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.54.06-.25-.12-1.04-.38-1.98-1.22-.73-.65-1.23-1.46-1.37-1.7-.15-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.15.16-.25.24-.42.08-.16.04-.31-.02-.43-.06-.12-.56-1.36-.77-1.86-.2-.49-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.73 2.65 4.2 3.71.59.25 1.04.4 1.4.52.59.19 1.12.16 1.54.1.47-.07 1.47-.6 1.67-1.19.21-.58.21-1.08.15-1.19-.07-.11-.23-.17-.48-.29z"/></svg>
                Copiar para WhatsApp
              </button>

              <!-- Descarga (o comparte, en móvil) una imagen de la tarjeta.
                   Ver nota en compartirImagenPrueba() sobre el comportamiento
                   distinto entre escritorio y móvil. -->
              <button type="button" (click)="compartirImagenPrueba(f)" [disabled]="generandoImagen() === f.fecha"
                [class.btn-loading]="generandoImagen() === f.fecha"
                class="btn-primary-blue w-full !py-2.5 justify-center">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
                Descargar imagen de la programación
              </button>
            </div>
          </article>

          <!-- Tarjeta de exportación: formato fijo (ancho estable, con marca,
               claro u oscuro según el tema activo) para que la imagen
               compartida se vea igual sin importar el tamaño de pantalla de
               quien la genera. Fuera de pantalla a propósito -no en la
               página, solo para capturar. -->
          <div [id]="'export-tarjeta-' + f.fecha" class="fixed -left-[9999px] top-0 w-[520px] bg-white dark:bg-slate-900" aria-hidden="true">
            <div class="p-7">
              <div class="flex items-center gap-3 pb-5 mb-5 border-b border-gray-100 dark:border-slate-800">
                <span class="grid place-items-center w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/50 shrink-0">
                  <img src="images/logo-gac-96.webp" class="w-7 h-7 object-contain" alt="" width="28" height="28" />
                </span>
                <div class="min-w-0">
                  <p class="font-display font-bold text-lg text-gray-900 dark:text-slate-100 leading-tight truncate">{{ data()?.nombre_congregacion }}</p>
                  <p class="text-xs text-gray-400 dark:text-slate-500 mt-0.5">Programa de reuniones</p>
                </div>
              </div>

              <div class="flex items-center gap-3 mb-6">
                <span class="grid place-items-center w-11 h-11 rounded-xl bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-300 shrink-0">
                  @if (f.tipoReunion === 'entre_semana') {
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
                  } @else {
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/><path d="M12 12.5l.9 1.85 2.05.3-1.48 1.44.35 2.04L12 17.1l-1.82 1.03.35-2.04-1.48-1.44 2.05-.3z"/></svg>
                  }
                </span>
                <div class="min-w-0">
                  <p class="text-[11px] font-bold uppercase tracking-wide text-gray-400 dark:text-slate-500">
                    {{ f.tipoReunion === 'entre_semana' ? 'Entre semana' : 'Fin de semana' }}
                  </p>
                  <p class="font-display font-bold text-xl text-gray-900 dark:text-slate-100 tracking-tight">{{ f.diaSemana }}, {{ f.fechaLarga }}</p>
                </div>
              </div>

              @if (f.filasApoyo.length) {
                <div class="mb-5">
                  <div class="flex items-center gap-1.5 mb-2.5">
                    <span class="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400"></span>
                    <p class="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Apoyo en auditorio</p>
                  </div>
                  <div class="grid grid-cols-2 gap-2.5">
                    @for (fila of f.filasApoyo; track fila.etiqueta) {
                      <div class="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-3.5 py-3 flex flex-col gap-1">
                        <div class="flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
                          <ng-container [ngTemplateOutlet]="iconoRol" [ngTemplateOutletContext]="{ $implicit: fila.icono }"></ng-container>
                          <span class="text-[10px] font-bold uppercase tracking-wide">{{ fila.etiqueta }}</span>
                        </div>
                        <div class="flex flex-col gap-0.5">
                          @for (nombre of fila.nombres; track nombre) {
                            <span class="text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug">{{ nombre }}</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (f.filasTecnica.length) {
                <div class="mb-5">
                  <div class="flex items-center gap-1.5 mb-2.5">
                    <span class="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400"></span>
                    <p class="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Técnica</p>
                  </div>
                  <div class="grid grid-cols-2 gap-2.5">
                    @for (fila of f.filasTecnica; track fila.etiqueta) {
                      <div class="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-3.5 py-3 flex flex-col gap-1">
                        <div class="flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
                          <ng-container [ngTemplateOutlet]="iconoRol" [ngTemplateOutletContext]="{ $implicit: fila.icono }"></ng-container>
                          <span class="text-[10px] font-bold uppercase tracking-wide">{{ fila.etiqueta }}</span>
                        </div>
                        <div class="flex flex-col gap-0.5">
                          @for (nombre of fila.nombres; track nombre) {
                            <span class="text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug">{{ nombre }}</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              @if (f.filasGrupos.length) {
                <div>
                  <div class="flex items-center gap-1.5 mb-2.5">
                    <span class="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                    <p class="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400">Grupos</p>
                  </div>
                  <div class="grid grid-cols-2 gap-2.5">
                    @for (fila of f.filasGrupos; track fila.etiqueta) {
                      <div class="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-3.5 py-3 flex flex-col gap-1" [class.col-span-2]="f.filasGrupos.length === 1">
                        <div class="flex items-center gap-1.5 text-gray-400 dark:text-slate-500">
                          <ng-container [ngTemplateOutlet]="iconoRol" [ngTemplateOutletContext]="{ $implicit: fila.icono }"></ng-container>
                          <span class="text-[10px] font-bold uppercase tracking-wide">{{ fila.etiqueta }}</span>
                        </div>
                        <span class="text-sm font-bold text-gray-900 dark:text-slate-100 leading-snug">{{ fila.nombres[0] }}</span>
                      </div>
                    }
                  </div>
                </div>
              }

              <div class="mt-6 pt-4 border-t border-gray-100 dark:border-slate-800 text-center">
                <p class="text-[10px] text-gray-400 dark:text-slate-500 tracking-wide">Sistema GAC · Programa de logística</p>
              </div>
            </div>
          </div>
        }
      </div>

      @if (!semanas().length) {
        <p class="text-center text-sm text-gray-400 dark:text-slate-500 py-10">Este mes todavía no tiene fechas programadas.</p>
      }
    </main>

    <footer class="text-center py-2.5 px-4 text-xs text-gray-400 dark:text-slate-500 border-t border-gray-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900">
      Este enlace expira el {{ data()!.expira_en | date:'d MMM y':'':'es' }} &mdash; Sistema GAC
    </footer>
  }

  <!-- Un ícono por rol -- mismo criterio visual que la tarjeta de logística
       de la app móvil, para que ambas superficies se reconozcan como la
       misma pantalla. -->
  <ng-template #iconoRol let-tipo>
    @switch (tipo) {
      @case ('mic') {
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z"/><path d="M19 11a7 7 0 01-14 0M12 18v3"/></svg>
      }
      @case ('walk') {
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
      }
      @case ('shield') {
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>
      }
      @case ('podium') {
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>
      }
      @case ('audio') {
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 010 7.07"/></svg>
      }
      @case ('video') {
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8.5l-6 3.5 6 3.5v-7z"/></svg>
      }
      @case ('aseo') {
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5L9.5 14.5"/><path d="M14 4l4 4"/><path d="M3 18l3.5-1.2M4 21l2.5-2.5M2 15.5L5 14"/></svg>
      }
      @case ('hospitalidad') {
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-4.35-9-8.28C1.5 9.5 3 6 6.5 6c2 0 3.3 1.2 4 2.3.7-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.72C18.5 16.65 12 21 12 21z"/></svg>
      }
    }
  </ng-template>
</div>
  `,
})
export class PublicLogisticaPage implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private location = inject(Location);
  theme = inject(ThemeService);

  private token = '';
  data = signal<LogisticaPublicoOut | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);
  semanaIndex = signal(0);
  copiado = signal(false);
  /** Fecha (iso) del bloque cuyo resumen de WhatsApp se está pidiendo, o null. */
  enviando = signal<string | null>(null);
  /** Fecha (iso) de la tarjeta cuya imagen de prueba se está generando, o null. */
  generandoImagen = signal<string | null>(null);

  tituloMes = computed(() => {
    const d = this.data();
    return d ? `${MESES_ES[d.mes - 1]} ${d.ano}` : '';
  });

  private fechasVista = computed<FechaVista[]>(() => {
    const d = this.data();
    if (!d) return [];

    const tipoPorFecha = new Map<string, string>();
    for (const f of d.fechas) tipoPorFecha.set(f.fecha, f.tipo_reunion);

    // Un puesto con dos turnos (acomodador_1 y _2) llega como dos filas del
    // backend con la misma etiqueta; se acumulan en una lista en vez de unirse
    // en un string, para que cada persona quede en su propia línea al mostrar.
    const porFecha = new Map<string, Map<string, string[]>>();
    for (const a of d.asignaciones) {
      if (!a.publicador) continue;
      if (!porFecha.has(a.fecha)) porFecha.set(a.fecha, new Map());
      const fila = porFecha.get(a.fecha)!;
      const clave = `${PUESTOS_TECNICA.has(a.puesto) ? 'T' : 'A'}:${PUESTOS_LABEL[a.puesto] ?? a.puesto}`;
      const nombres = fila.get(clave) ?? [];
      nombres.push(a.publicador.nombre_completo);
      fila.set(clave, nombres);
    }

    const aseoPorFecha = new Map<string, string>();
    for (const s of d.aseo) {
      if (s.grupo) aseoPorFecha.set(s.fecha, s.grupo.nombre_grupo);
    }

    const programaPorFecha = new Map<string, ProgramaDiaOut>();
    for (const p of d.programa) programaPorFecha.set(p.fecha, p);

    return d.fechas.map((f) => {
      const dt = new Date(f.fecha + 'T00:00:00');
      const fila = porFecha.get(f.fecha) ?? new Map();
      const programa = programaPorFecha.get(f.fecha);
      const filasApoyo: FilaPuesto[] = [];
      const filasTecnica: FilaPuesto[] = [];
      for (const [clave, nombres] of fila.entries()) {
        const [seccion, etiqueta] = clave.split(':', 2);
        const icono = ICONO_POR_ETIQUETA[etiqueta] ?? 'mic';
        (seccion === 'T' ? filasTecnica : filasApoyo).push({ etiqueta, icono, nombres });
      }
      // Mismo orden fijo que la tarjeta de logística de la app móvil, en vez
      // del orden en que llegaron las asignaciones del backend.
      filasApoyo.sort((a, b) => (ORDEN_ETIQUETA[a.etiqueta] ?? 99) - (ORDEN_ETIQUETA[b.etiqueta] ?? 99));
      filasTecnica.sort((a, b) => (ORDEN_ETIQUETA[a.etiqueta] ?? 99) - (ORDEN_ETIQUETA[b.etiqueta] ?? 99));
      const tipoReunion = tipoPorFecha.get(f.fecha) ?? f.tipo_reunion;
      const aseo = aseoPorFecha.get(f.fecha) ?? null;
      const hospitalidad = programa?.hospitalidad ?? null;
      const filasGrupos: FilaPuesto[] = [];
      if (aseo) filasGrupos.push({ etiqueta: 'Aseo del salón', icono: 'aseo', nombres: [aseo] });
      if (hospitalidad) filasGrupos.push({ etiqueta: 'Hospitalidad', icono: 'hospitalidad', nombres: [hospitalidad] });
      return {
        fecha: f.fecha,
        tipoReunion,
        diaSemana: DIAS_ES[dt.getDay()],
        fechaLarga: `${dt.getDate()} de ${MESES_ES[dt.getMonth()].toLowerCase()}`,
        filasApoyo,
        filasTecnica,
        filasGrupos,
      };
    });
  });

  semanas = computed<Semana[]>(() => {
    const porSemana = new Map<string, FechaVista[]>();
    for (const f of this.fechasVista()) {
      const lunes = lunesDeSemana(new Date(f.fecha + 'T00:00:00'));
      const clave = isoLocal(lunes);
      if (!porSemana.has(clave)) porSemana.set(clave, []);
      porSemana.get(clave)!.push(f);
    }
    return [...porSemana.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([inicioIso, fechas]) => {
        const inicio = new Date(inicioIso + 'T00:00:00');
        const fin = new Date(inicio);
        fin.setDate(fin.getDate() + 6);
        return { inicio, fin, fechas };
      });
  });

  semanaActualFechas = computed<FechaVista[]>(() => {
    const semanas = this.semanas();
    return semanas[this.semanaIndex()]?.fechas ?? [];
  });

  esSemanaActual = computed(() => {
    const semana = this.semanas()[this.semanaIndex()];
    if (!semana) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return hoy >= semana.inicio && hoy <= semana.fin;
  });

  rangoSemana(): string {
    const semana = this.semanas()[this.semanaIndex()];
    if (!semana) return '';
    const { inicio, fin } = semana;
    const mismoMes = inicio.getMonth() === fin.getMonth();
    const dIni = inicio.getDate();
    const dFin = fin.getDate();
    if (mismoMes) {
      return `${dIni} – ${dFin} ${MESES_ABR_ES[inicio.getMonth()]}`;
    }
    return `${dIni} ${MESES_ABR_ES[inicio.getMonth()]} – ${dFin} ${MESES_ABR_ES[fin.getMonth()]}`;
  }

  semanaAnterior(): void {
    if (this.semanaIndex() > 0) {
      this.semanaIndex.update((i) => i - 1);
      this.sincronizarUrl();
    }
  }

  semanaSiguiente(): void {
    if (this.semanaIndex() < this.semanas().length - 1) {
      this.semanaIndex.update((i) => i + 1);
      this.sincronizarUrl();
    }
  }

  private sincronizarUrl(): void {
    const semana = this.semanas()[this.semanaIndex()];
    if (!semana) return;
    const url = this.location.path().split('?')[0];
    this.location.replaceState(url, `semana=${isoLocal(semana.inicio)}`);
  }

  async compartirSemana(): Promise<void> {
    const semana = this.semanas()[this.semanaIndex()];
    if (!semana) return;
    const url = `${window.location.origin}${window.location.pathname}?semana=${isoLocal(semana.inicio)}`;
    const titulo = `Programa de reuniones — Semana del ${this.rangoSemana()}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: titulo, url });
        return;
      } catch {
        // El usuario canceló el share sheet: no es un error, no hacer nada más.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      // Sin permiso de portapapeles: no hay mucho más que ofrecer aquí.
    }
  }

  compartirWhatsApp(f: FechaVista): void {
    this.enviando.set(f.fecha);
    this.http
      .get<{ mensaje: string }>(
        `${environment.apiUrl}/reuniones/logistica/public/${this.token}/resumen-dia`,
        { params: { fecha: f.fecha } },
      )
      .subscribe({
        next: ({ mensaje }) => {
          this.enviando.set(null);
          window.open(whatsappUrl(mensaje), '_blank');
        },
        error: () => {
          this.enviando.set(null);
        },
      });
  }

  /**
   * Prueba: en vez del mensaje de texto, comparte una captura (PNG) de la
   * tarjeta. Sólo funciona bien en móvil -el share sheet nativo permite
   * elegir WhatsApp y ya llega con la imagen adjunta-, porque WhatsApp no
   * tiene ningún enlace tipo `api.whatsapp.com/send` que acepte una imagen:
   * a diferencia del texto, no hay forma de "pre-adjuntarla" desde una URL.
   * En desktop no existe ese share sheet, así que ahí sólo se puede descargar
   * la imagen para adjuntarla a mano en WhatsApp Web.
   *
   * Captura la tarjeta de exportación (`export-tarjeta-*`), no la visible en
   * pantalla: esa es responsiva y cambia de ancho/columnas/tema según quien
   * la mire, lo que haría que la imagen compartida saliera distinta cada vez.
   * La de exportación tiene un formato fijo pensado para verse igual siempre.
   */
  async compartirImagenPrueba(f: FechaVista): Promise<void> {
    const el = document.getElementById('export-tarjeta-' + f.fecha);
    if (!el) return;

    this.generandoImagen.set(f.fecha);
    try {
      // html2canvas (usado en Territorios) no soporta oklch() -el espacio de
      // color que usa Tailwind v4 para toda la paleta por defecto- y tira
      // "Attempting to parse an unsupported color function" apenas encuentra
      // una clase como bg-gray-50. modern-screenshot renderiza vía un
      // <foreignObject> SVG real (el motor del navegador pinta los estilos,
      // no un parser propio), así que oklch/color-mix/CSS vars funcionan tal
      // cual.
      const { domToBlob } = await import('modern-screenshot');
      const blob = await domToBlob(el as HTMLElement, {
        scale: 2,
        backgroundColor: this.theme.darkMode() ? '#0f172a' : '#ffffff',
      });
      if (!blob) return;

      const nombreArchivo = `logistica-${f.fecha}.png`;
      const file = new File([blob], nombreArchivo, { type: 'image/png' });
      const nav = navigator as Navigator & {
        canShare?: (data: { files: File[] }) => boolean;
        share?: (data: { files: File[]; title?: string }) => Promise<void>;
      };

      // El share sheet nativo con archivos es el único que llega a WhatsApp
      // con la imagen ya adjunta, pero en escritorio (mouse, no táctil) es
      // poco fiable: en Mac `canShare` devuelve true aunque no haya ningún
      // destino instalado que acepte el archivo, y `share()` puede quedarse
      // esperando sin avisar en vez de fallar. Por eso sólo se intenta en
      // dispositivos táctiles, y con un tiempo límite por si aun así se cuelga.
      const esTactil = matchMedia('(pointer: coarse)').matches;
      if (esTactil && nav.canShare?.({ files: [file] }) && nav.share) {
        const comparte = nav.share({ files: [file], title: 'Programa de reuniones' });
        const tiempoLimite = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Tiempo de espera agotado')), 8000),
        );
        await Promise.race([comparte, tiempoLimite]);
        return;
      }

      // Sin share sheet fiable (desktop, o táctil sin app compatible
      // instalada): se descarga para adjuntarla a mano en WhatsApp Web.
      const link = document.createElement('a');
      link.download = nombreArchivo;
      link.href = URL.createObjectURL(blob);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      // Prueba: se deja el error visible en consola a propósito para poder
      // diagnosticar por qué falló (share sheet cancelado vs. html2canvas
      // que no logró capturar la tarjeta).
      console.error('[prueba imagen] fallo al generar/compartir la captura', err);
    } finally {
      this.generandoImagen.set(null);
    }
  }

  ngOnInit(): void {
    this.token = this.route.snapshot.params['token'];
    const semanaParam = this.route.snapshot.queryParams['semana'] as string | undefined;

    this.http
      .get<LogisticaPublicoOut>(`${environment.apiUrl}/reuniones/logistica/public/${this.token}`)
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.cargando.set(false);

          const semanas = this.semanas();
          if (semanaParam) {
            const idx = semanas.findIndex((s) => isoLocal(s.inicio) === semanaParam);
            if (idx >= 0) {
              this.semanaIndex.set(idx);
              return;
            }
          }
          const hoy = new Date();
          hoy.setHours(0, 0, 0, 0);
          const idxActual = semanas.findIndex((s) => hoy >= s.inicio && hoy <= s.fin);
          this.semanaIndex.set(idxActual >= 0 ? idxActual : 0);
        },
        error: (e) => {
          this.error.set(e?.error?.detail || 'El enlace es inválido o ha expirado.');
          this.cargando.set(false);
        },
      });
  }
}
