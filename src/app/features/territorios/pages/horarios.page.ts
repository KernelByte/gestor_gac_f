import { Component, signal, computed, effect, inject, untracked } from '@angular/core';
import { VacanteTraslado, VacantesTrasladoService, textoVacante, vacantesPor } from '../../../shared/vacantes-traslado';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { TerritoriosService } from '../services/territorios.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { Sector, PuntoSalidaOpcion, SugerenciaSalida } from '../models/territorio.model';
import { codigosDe, textoManzanas } from '../utils/rangos-manzanas.util';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AvisoComponent } from '../../../shared/components/aviso/aviso.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { nombreMostrado } from '../../../core/utils/nombre.util';
import { SalidaEditorComponent } from '../components/salida-editor.component';
import { SemanaTipoComponent } from '../components/semana-tipo.component';
import { MarcaZoomComponent } from '../components/marca-zoom.component';
import { exportarElemento } from '../utils/territorio-export.util';
import {
  FilaSemanaTipo, GrupoOpcion, ModoCrear, Periodo, PersonaRef, SalidaForm, SalidaProgramada, SalidasProgramaService,
  DIAS, aIso, horaLegible, moverPeriodo, rangoDe, tituloDia, tituloPeriodo,
} from '../services/salidas-programa.service';

interface Publicador {
  id_publicador: number;
  primer_nombre: string;
  primer_apellido: string;
}

interface DiaPrograma { fecha: string; titulo: string; salidas: SalidaProgramada[]; }

/**
 * Programa de salidas: qué días se predica, a qué hora, dónde se reúnen, quién
 * saca el grupo y en qué territorio. Es informativo; lo que se predicó se
 * registra en Seguimiento de predicación.
 */
@Component({
  standalone: true,
  selector: 'app-horarios-page',
  host: { class: 'tema-territorios', '(document:click)': 'alClicFuera($event)' },
  imports: [CommonModule, PageHeaderComponent, SalidaEditorComponent, SemanaTipoComponent, ModalComponent, ConfirmDialogComponent, AvisoComponent, MarcaZoomComponent],
  template: `
    <div class="flex flex-col h-full min-h-0 gap-4">
      <app-page-header
        spacing="none"
        title="Programa de salidas"
        subtitle="Qué días se predica, dónde se reúnen, quién saca el grupo y en qué barrio.">
        <div class="relative" data-menu="compartir">
          <button (click)="menuCompartir.set(!menuCompartir())" [disabled]="!salidas().length || exportando()"
            class="btn-secondary whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
            @if (exportando()) {
              <div class="spinner-sm text-emerald-600"></div>
            } @else {
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            }
            Compartir
          </button>
          @if (menuCompartir()) {
            <div class="absolute right-0 mt-2 z-50 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5">
              <button (click)="compartir('image')" class="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors">
                <span class="block text-sm font-bold text-slate-800 dark:text-slate-100">Imagen (WhatsApp)</span>
                <span class="block text-xs text-slate-500 dark:text-slate-400">Se descarga una foto de la hoja</span>
              </button>
              <button (click)="compartir('pdf')" class="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors">
                <span class="block text-sm font-bold text-slate-800 dark:text-slate-100">PDF para imprimir</span>
                <span class="block text-xs text-slate-500 dark:text-slate-400">Para pegar en el tablero</span>
              </button>
            </div>
          }
        </div>
      </app-page-header>

      <!-- Barra: periodo · resumen · acciones -->
      <div class="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div class="flex items-center gap-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-1 shadow-sm">
          <button (click)="mover(-1)" [title]="periodo() === 'mes' ? 'Mes anterior' : 'Semana anterior'"
            class="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="min-w-[11.5rem] text-center text-base font-bold text-slate-900 dark:text-white px-1 tabular-nums">{{ titulo() }}</span>
          <button (click)="mover(1)" [title]="periodo() === 'mes' ? 'Mes siguiente' : 'Semana siguiente'"
            class="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        @if (!esActual()) {
          <button (click)="irHoy()" class="h-9 px-3 rounded-lg text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
            Ir a {{ periodo() === 'mes' ? 'este mes' : 'esta semana' }}
          </button>
        }

        @if (sinCapitan()) {
          <div class="hidden lg:flex items-center gap-2" aria-label="Resumen del periodo">
            <span class="resumen resumen--aviso"><span class="punto bg-amber-500"></span><b class="tabular-nums">{{ sinCapitan() }}</b> sin capitán</span>
          </div>
        }

        @if (puedeEditar() && !sinCongregacion() && !loading() && fijasListas()) {
          <div class="flex gap-2 ml-auto w-full sm:w-auto">
            @if (estado() === 'sin-fijas') {
              <button (click)="abrirSemanaTipo()" class="btn-primary flex-1 sm:flex-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                Configurar salidas fijas
              </button>
            } @else {
              <button (click)="nuevaSalida()" class="btn-secondary flex-1 sm:flex-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Agregar salida
              </button>
              <div class="relative" data-menu="programa">
                <button (click)="menuPrograma.set(!menuPrograma())" class="btn-secondary !px-3" aria-haspopup="menu" [attr.aria-expanded]="menuPrograma()" title="Más opciones del programa">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
                  <span class="sr-only">Más opciones</span>
                </button>
                @if (menuPrograma()) {
                  <div class="menu-pop absolute right-0 mt-2 z-50 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-1.5" role="menu" (keydown.escape)="menuPrograma.set(false)">
                    @if (estado() === 'con-programa') {
                      <button role="menuitem" (click)="menuPrograma.set(false); pedirRecrear()" class="opcion-menu">
                        <span class="block text-sm font-bold text-slate-800 dark:text-slate-100">Volver a crear con las salidas fijas</span>
                        <span class="block text-xs text-slate-500 dark:text-slate-400">Agregar las que falten o empezar de nuevo</span>
                      </button>
                    }
                    <button role="menuitem" (click)="menuPrograma.set(false); abrirSemanaTipo()" class="opcion-menu">
                      <span class="block text-sm font-bold text-slate-800 dark:text-slate-100">Cambiar las salidas fijas</span>
                      <span class="block text-xs text-slate-500 dark:text-slate-400">Días, horas, lugares y capitanes que se repiten</span>
                    </button>
                    @if (estado() === 'con-programa') {
                      <div class="my-1 border-t border-slate-100 dark:border-slate-700/60"></div>
                      <button role="menuitem" (click)="menuPrograma.set(false); dialogoBorrar.set(true)" class="opcion-menu">
                        <span class="block text-sm font-bold text-red-700 dark:text-red-400">Borrar {{ periodo() === 'mes' ? 'el programa del mes' : 'el programa de la semana' }}</span>
                        <span class="block text-xs text-slate-500 dark:text-slate-400">Quita las {{ salidas().length }} salidas de {{ periodo() === 'mes' ? 'este mes' : 'esta semana' }}</span>
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>

      @if (error()) {
        <app-aviso tone="danger" class="shrink-0 block" [dismissible]="true" (dismissed)="error.set(null)">{{ error() }}</app-aviso>
      }

      @if (hecho(); as h) {
        <app-aviso tone="success" class="shrink-0 block aviso-hecho" [dismissible]="true" (dismissed)="hecho.set(null)">{{ h }}</app-aviso>
      }

      <!-- Contenido: ocupa el alto que queda; solo se desplaza por dentro si hace falta -->
      <div class="flex-1 min-h-0">
        @if (sinCongregacion()) {
          <div class="h-full flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-6 py-10 text-center">
            <div>
              <p class="text-lg font-bold text-slate-900 dark:text-white">Elija una congregación</p>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">El programa de salidas es de cada congregación. Elíjala en el selector de arriba para verlo o armarlo.</p>
            </div>
          </div>
        } @else if (loading() || !fijasListas()) {
          <div class="h-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-2">
            @for (i of [1, 2, 3, 4, 5, 6, 7]; track i) {
              <div class="rounded-2xl skeleton min-h-24"></div>
            }
          </div>
        } @else if (!salidas().length && !semanaTipo().length && puedeEditar()) {
          <div class="h-full flex items-center justify-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-6 py-10 text-center">
            <div>
              <p class="text-lg font-bold text-slate-900 dark:text-white">Arme el programa en 3 pasos</p>
              <ol class="mt-5 max-w-md mx-auto text-left space-y-3">
                @for (paso of pasos; track $index) {
                  <li class="flex gap-3">
                    <span class="w-7 h-7 shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-sm font-bold flex items-center justify-center">{{ $index + 1 }}</span>
                    <span class="text-sm text-slate-600 dark:text-slate-300 pt-1">{{ paso }}</span>
                  </li>
                }
              </ol>
              <button (click)="abrirSemanaTipo()" class="mt-6 btn-primary">Configurar salidas fijas</button>
            </div>
          </div>
        } @else if (estado() === 'vacio' && puedeEditar()) {
          <div class="h-full overflow-y-auto flex items-start sm:items-center justify-center py-2">
            <section class="vacio-card w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 sm:p-7">
              <p class="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">{{ titulo() }}</p>
              <h2 class="mt-1 text-xl font-bold text-slate-900 dark:text-white">{{ periodo() === 'mes' ? 'Este mes' : 'Esta semana' }} aún no tiene programa</h2>
              <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Se crearán <b class="text-slate-900 dark:text-white tabular-nums">{{ totalPrevio() }}</b> {{ totalPrevio() === 1 ? 'salida' : 'salidas' }} con sus salidas fijas{{ periodo() === 'mes' ? ' (cada semana del mes)' : '' }}. Después puede cambiar lo que quiera.
              </p>
              <ul class="mt-4 divide-y divide-slate-100 dark:divide-slate-700/60 rounded-xl border border-slate-100 dark:border-slate-700/60 overflow-hidden">
                @for (d of vistaPrevia(); track d.dia) {
                  <li class="flex gap-3 px-4 py-2.5">
                    <span class="w-24 shrink-0 text-sm font-bold text-slate-900 dark:text-white">{{ d.dia }}</span>
                    <span class="min-w-0 flex-1 space-y-1">
                      @for (f of d.filas; track $index) {
                        <span class="block text-sm leading-snug text-slate-700 dark:text-slate-200">
                          <b class="tabular-nums">{{ hora(f.hora_inicio) || 'Sin hora' }}</b> · @if (f.por_zoom) { <app-marca-zoom class="align-middle" [tam]="14" /> Zoom } @else { {{ f.lugar || 'Sin lugar' }} }
                          <span class="text-slate-500 dark:text-slate-400"> · {{ f.capitanes.length ? nombresDe(f.capitanes) : 'Capitán: se turnan' }}</span>
                        </span>
                      }
                    </span>
                  </li>
                }
              </ul>
              <div class="mt-5 flex flex-col-reverse sm:flex-row sm:items-center gap-2">
                <button (click)="abrirSemanaTipo()" class="h-11 px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cambiar las salidas fijas</button>
                <button (click)="crear('nuevo')" [disabled]="generando()" class="btn-primary btn-lg sm:ml-auto">
                  @if (generando()) { <span class="spinner-sm text-white"></span> }
                  {{ textoCrear() }}
                </button>
              </div>
              @if (sinFijoCuantas()) {
                <p class="mt-3 text-xs leading-snug text-slate-500 dark:text-slate-400">Las salidas sin capitán fijo reciben por turnos a uno de los habilitados como capitán. Revíselos después y cámbielos si hace falta.</p>
              }
            </section>
          </div>
        } @else if (periodo() === 'semana') {
          <!-- Semana: 7 columnas en escritorio, agenda en teléfono -->
          <div [class.entra]="recienCreado()" class="h-full overflow-y-auto xl:overflow-hidden grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3 xl:gap-4 content-start xl:content-stretch">
            @for (d of semana(); track d.fecha) {
              <section class="dia" [class.dia--hoy]="d.fecha === hoyIso" [class.dia--pasado]="d.fecha < hoyIso"
                       [class.dia--vacio]="!d.salidas.length && d.fecha !== hoyIso">
                <header class="dia__cab flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-xs font-bold uppercase tracking-wide" [class]="d.fecha === hoyIso ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'">{{ d.nombre }}</p>
                    <p class="text-xl font-bold leading-tight text-slate-900 dark:text-white tabular-nums">{{ d.numero }}@if (d.fecha === hoyIso) {<span class="ml-1.5 align-middle text-xs font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">Hoy</span>}</p>
                  </div>
                  @if (puedeEditar()) {
                    <button type="button" (click)="nuevaSalida(d.fecha)" [title]="'Agregar salida el ' + d.titulo"
                      [attr.aria-label]="'Agregar salida el ' + d.titulo" class="btn-icon-sm">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  }
                </header>
                <div class="xl:flex-1 xl:min-h-0 xl:overflow-y-auto pt-3 pb-1 space-y-3 scroll-fino">
                  @for (s of d.salidas; track s.id_horario) {
                    <button type="button" (click)="editar(s)" [disabled]="!puedeEditar()" class="tarjeta" [class.tarjeta--zoom]="s.por_zoom">
                      <span class="block text-base font-bold text-slate-900 dark:text-white tabular-nums">{{ hora(s.hora_inicio) || 'Sin hora' }}</span>
                      @if (s.por_zoom) {
                        <span class="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300 leading-snug">
                          <app-marca-zoom [tam]="18" /> Zoom
                        </span>
                      } @else {
                        <span class="block mt-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{{ s.lugar || 'Sin lugar' }}</span>
                      }
                      @if (s.grupos.length) {
                        <span class="block mt-0.5 text-xs text-slate-500 dark:text-slate-400">{{ gruposCorto(s) }}</span>
                      }
                      <span class="tarjeta__quien flex items-start gap-2 text-sm leading-snug" [class]="s.capitanes.length ? 'text-slate-600 dark:text-slate-300' : 'text-amber-700 dark:text-amber-300 font-semibold'">
                        <svg class="w-3.5 h-3.5 mt-[3px] shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span class="min-w-0 space-y-0.5">
                          @if (s.capitanes.length) {
                            @for (c of s.capitanes; track c.id_publicador) { <span class="block">{{ c.nombre }}</span> }
                          }
                          @else if (vacante(s); as v) { <span [title]="textoVacante(v)">Sin capitán · {{ v.nombre_publicador }} se trasladó</span> }
                          @else { Sin capitán }
                        </span>
                      </span>
                      @if (s.codigo_territorio && !s.por_zoom) {
                        <span class="mt-2.5 inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/25 text-emerald-800 dark:text-emerald-300 text-xs font-bold" [title]="s.nombre_territorio ?? ''">
                          <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>
                          <span class="truncate">{{ s.codigo_territorio }}</span>
                        </span>
                      }
                      @if (s.nombre_barrio && !s.por_zoom) {
                        <span class="mt-1.5 block text-xs text-slate-500 dark:text-slate-400">Barrio {{ s.nombre_barrio }}</span>
                      }
                      @if (plan(s); as p) {
                        <span class="mt-2 block rounded-lg px-2 py-1.5 text-xs leading-snug font-semibold"
                              [class]="p.tipo === 'hecho' ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-900/25 dark:text-emerald-300' : p.tipo === 'toca' ? 'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300'"
                              [title]="p.aviso ?? ''">{{ p.texto }}</span>
                      }
                    </button>
                  } @empty {
                    <p class="pt-1 text-sm text-slate-400 dark:text-slate-500">Sin salidas</p>
                  }
                </div>
              </section>
            }
            @if (!salidas().length) {
              <p class="xl:hidden sm:col-span-2 text-center text-sm text-slate-500 dark:text-slate-400 py-8">No hay salidas esta semana.</p>
            }
          </div>
        } @else {
          <!-- Mes: calendario en escritorio, agenda en teléfono -->
          <div class="hidden xl:flex h-full flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div class="grid grid-cols-7 shrink-0 border-b border-slate-100 dark:border-slate-700/60">
              @for (n of diasCortos; track n) {
                <span class="px-3 h-9 flex items-center text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ n }}</span>
              }
            </div>
            <div class="flex-1 min-h-0 grid grid-cols-7" [style.grid-template-rows]="'repeat(' + mes().length / 7 + ', minmax(0, 1fr))'">
              @for (c of mes(); track c.fecha) {
                <div class="min-h-0 flex flex-col border-b border-r border-slate-100 dark:border-slate-700/50 [&:nth-child(7n)]:border-r-0"
                     [class.celda--fuera]="!c.enMes">
                  <div class="flex items-center justify-between px-2 pt-1.5">
                    <span class="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold tabular-nums"
                          [class]="c.fecha === hoyIso ? 'bg-emerald-600 text-white' : c.enMes ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'">{{ c.numero }}</span>
                    @if (puedeEditar() && c.enMes) {
                      <button type="button" (click)="nuevaSalida(c.fecha)" title="Agregar salida" [attr.aria-label]="'Agregar salida el ' + tituloDia(c.fecha)" class="celda-mas w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    }
                  </div>
                  <div class="flex-1 min-h-0 overflow-y-auto px-1.5 pb-1.5 space-y-1 scroll-fino">
                    @for (s of c.salidas; track s.id_horario) {
                      <button type="button" (click)="editar(s)" [disabled]="!puedeEditar()" [title]="detalle(s)"
                        class="w-full text-left px-2 py-1 rounded-md text-xs leading-tight transition-colors"
                        [class]="s.por_zoom ? 'bg-blue-50 dark:bg-blue-900/25 enabled:hover:bg-blue-100 dark:enabled:hover:bg-blue-900/40' : 'bg-emerald-50/80 dark:bg-emerald-900/20 enabled:hover:bg-emerald-100 dark:enabled:hover:bg-emerald-900/40'"
                        [class.ring-1]="!s.capitanes.length" [class.ring-amber-400]="!s.capitanes.length">
                        <span class="font-bold text-slate-900 dark:text-white tabular-nums">{{ horaCorta(s.hora_inicio) }}</span>
                        @if (s.por_zoom) {
                          <span class="inline-flex items-center gap-1 align-middle text-blue-800 dark:text-blue-200 font-semibold"> <app-marca-zoom [tam]="13" />Zoom</span>
                        } @else {
                          <span class="text-slate-700 dark:text-slate-200"> {{ s.lugar || 'Sin lugar' }}</span>
                        }
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
          <!-- Mes en teléfono -->
          <div class="xl:hidden h-full overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 content-start">
            @for (c of mes(); track c.fecha) {
              @if (c.enMes && c.salidas.length) {
                <section class="dia dia--movil" [class.dia--hoy]="c.fecha === hoyIso">
                  <p class="px-4 pt-3.5 text-sm font-bold text-slate-900 dark:text-white">{{ tituloDia(c.fecha) }}</p>
                  <div class="px-3 pb-3 pt-2 space-y-2">
                    @for (s of c.salidas; track s.id_horario) {
                      <button type="button" (click)="editar(s)" [disabled]="!puedeEditar()" class="tarjeta">
                        <span class="text-base font-bold text-slate-900 dark:text-white tabular-nums">{{ hora(s.hora_inicio) }}</span>
                        @if (s.por_zoom) {
                          <span class="inline-flex items-center gap-1.5 align-middle ml-1.5 text-sm font-bold text-blue-700 dark:text-blue-300"><app-marca-zoom [tam]="16" />Zoom</span>
                        } @else {
                          <span class="text-sm font-bold text-slate-800 dark:text-slate-100"> · {{ s.lugar || 'Sin lugar' }}</span>
                        }
                        <span class="block mt-1 text-sm text-slate-600 dark:text-slate-300">{{ capitanes(s) || 'Sin capitán' }}@if (s.codigo_territorio && !s.por_zoom) { · {{ s.codigo_territorio }} }</span>
                        @if (plan(s); as p) { <span class="block mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">{{ p.texto }}</span> }
                      </button>
                    }
                  </div>
                </section>
              }
            }
            @if (!salidas().length) {
              <p class="sm:col-span-2 text-center text-sm text-slate-500 dark:text-slate-400 py-8">No hay salidas este mes.</p>
            }
          </div>
        }
      </div>
    </div>

    <!-- Hoja para compartir (fuera de pantalla; colores fijos para que html2canvas la lea) -->
    @if (exportando()) {
      <div style="position:fixed;left:-10000px;top:0;">
        <div id="hoja-salidas" style="width:820px;background:#ffffff;padding:36px 40px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;">
          <div style="text-align:center;padding:14px;border-radius:12px;background:#ecfdf5;border:1px solid #a7f3d0;">
            <div style="font-size:24px;font-weight:900;letter-spacing:0.08em;color:#065f46;">SALIDAS A PREDICAR</div>
            <div style="font-size:15px;font-weight:600;margin-top:4px;color:#047857;">{{ titulo() }}{{ nombreCongregacion() ? ' · ' + nombreCongregacion() : '' }}</div>
          </div>
          <table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:14px;">
            <thead>
              <tr style="background:#0f766e;color:#ffffff;">
                <th style="text-align:left;padding:10px 12px;">Día</th>
                <th style="text-align:left;padding:10px 12px;">Hora</th>
                <th style="text-align:left;padding:10px 12px;">Lugar</th>
                <th style="text-align:left;padding:10px 12px;">Capitán</th>
                @if (hayTerritorios()) { <th style="text-align:left;padding:10px 12px;">Territorio</th> }
              </tr>
            </thead>
            <tbody>
              @for (d of dias(); track d.fecha; let par = $even) {
                @for (s of d.salidas; track s.id_horario; let primera = $first) {
                  <tr [style.background]="par ? '#f8fafc' : '#ffffff'" style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:10px 12px;font-weight:800;vertical-align:top;white-space:nowrap;">{{ primera ? diaCorto(d.fecha) : '' }}</td>
                    <td style="padding:10px 12px;font-weight:700;white-space:nowrap;vertical-align:top;">{{ hora(s.hora_inicio) }}</td>
                    <td style="padding:10px 12px;vertical-align:top;">{{ s.lugar }}@if (s.grupos.length) {<div style="font-size:12px;color:#475569;">{{ gruposCorto(s) }}</div>}</td>
                    <td style="padding:10px 12px;vertical-align:top;">{{ capitanes(s) }}</td>
                    @if (hayTerritorios()) { <td style="padding:10px 12px;vertical-align:top;font-weight:700;">{{ s.por_zoom ? '' : (s.codigo_territorio ?? '') }}</td> }
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>
      </div>
    }

    @if (editando(); as e) {
      <app-salida-editor
        modo="salida"
        [titulo]="e.salida ? 'Editar salida' : 'Nueva salida'"
        [subtitulo]="e.salida ? tituloDia(e.salida.fecha_programada) : ''"
        [inicial]="e.form"
        [capitanesIniciales]="e.salida?.capitanes ?? []"
        [publicadores]="personas()"
        [grupos]="gruposOpc()"
        [barrios]="barrios()"
        [puntosSalida]="puntosSalida()"
        [capitanesHabilitados]="capitanesHabilitados()"
        [usaZoom]="usaZoom()"
        [tieneEnlaceZoom]="tieneEnlaceZoom()"
        [puedeEliminar]="!!e.salida"
        [guardando]="guardando()"
        (guardar)="guardar($event)"
        (eliminar)="eliminar()"
        (cancelar)="editando.set(null)" />
    }

    @if (dialogoRecrear()) {
      <app-modal [open]="true" variant="sheet" size="md" [title]="'Volver a crear ' + (periodo() === 'mes' ? 'el mes' : 'la semana')"
                 [subtitle]="titulo() + ' ya tiene ' + salidas().length + ' ' + (salidas().length === 1 ? 'salida' : 'salidas') + '. ¿Qué desea hacer?'"
                 [hasFooter]="true" (openChange)="$event || dialogoRecrear.set(false)">
        <div class="space-y-2">
          <button (click)="crear('faltantes')" [disabled]="generando()" class="opcion-dialogo opcion-dialogo--ok">
            <span class="block text-base font-bold">Agregar solo las que faltan</span>
            <span class="block text-sm font-medium opacity-80">No se toca nada de lo que ya está ni lo cambiado a mano.</span>
          </button>
          <button (click)="crear('reemplazar')" [disabled]="generando()" class="opcion-dialogo opcion-dialogo--peligro">
            <span class="block text-base font-bold">Empezar de nuevo</span>
            <span class="block text-sm font-medium opacity-80">Se borran las salidas de {{ periodo() === 'mes' ? 'este mes' : 'esta semana' }} y se crean otra vez. Se perderán los cambios hechos a mano; las que ya se registraron en Seguimiento se conservan.</span>
          </button>
        </div>
        <ng-container slot="footer">
          <button (click)="dialogoRecrear.set(false)" class="btn-ghost">Cancelar</button>
        </ng-container>
      </app-modal>
    }

    @if (dialogoBorrar()) {
      <app-confirm-dialog [open]="true" severity="danger" [busy]="generando()"
        [title]="'¿Borrar el programa ' + (periodo() === 'mes' ? 'del mes' : 'de la semana') + '?'"
        [message]="'Se borrarán las ' + salidas().length + ' salidas ' + (periodo() === 'mes' ? 'de ' : 'de la ') + tituloEnFrase() + '. Lo que ya registró en Seguimiento de predicación no se pierde. Después puede volver a crearlo con las salidas fijas.'"
        confirmLabel="Sí, borrar" cancelLabel="Cancelar"
        (confirmed)="borrarPeriodo()" (openChange)="$event || dialogoBorrar.set(false)" />
    }

    @if (mostrarSemanaTipo()) {
      <app-semana-tipo
        [inicial]="semanaTipo()"
        [periodo]="periodo()"
        [publicadores]="personas()"
        [grupos]="gruposOpc()"
        [barrios]="barrios()"
        [puntosSalida]="puntosSalida()"
        [capitanesHabilitados]="capitanesHabilitados()"
        [usaZoom]="usaZoom()"
        [tieneEnlaceZoom]="tieneEnlaceZoom()"
        (cerrar)="cerrarSemanaTipo($event)" />
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; min-height: 0; }
    .resumen {
      display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 999px;
      font-size: 13px; color: rgb(71 85 105); background: #fff; border: 1px solid rgb(226 232 240);
    }
    .resumen b { color: rgb(15 23 42); font-weight: 800; }
    .resumen--aviso { background: rgb(255 251 235); border-color: rgb(253 230 138); color: rgb(146 64 14); }
    .resumen--aviso b { color: rgb(120 53 15); }
    .punto { width: 8px; height: 8px; border-radius: 999px; }
    :host-context(.dark) .resumen { background: rgb(15 23 42); border-color: rgb(30 41 59); color: rgb(203 213 225); }
    :host-context(.dark) .resumen b { color: #fff; }
    :host-context(.dark) .resumen--aviso { background: rgba(120,53,15,0.25); border-color: rgba(180,83,9,0.5); color: rgb(252 211 77); }

    /* Columna de un día: sin caja propia; las tarjetas son lo que se ve */
    .dia { display: flex; flex-direction: column; }
    .dia__cab { padding: 0 4px 12px; border-bottom: 2px solid rgb(226 232 240); }
    .dia--hoy .dia__cab { border-bottom-color: rgb(16 185 129); }
    .dia--pasado { opacity: 0.6; }
    :host-context(.dark) .dia__cab { border-bottom-color: rgb(51 65 85 / 0.8); }
    :host-context(.dark) .dia--hoy .dia__cab { border-bottom-color: rgb(16 185 129 / 0.8); }
    @media (min-width: 1280px) { .dia { min-height: 0; } }
    /* Teléfono y tablet: cada día es un bloque con su propio fondo */
    @media (max-width: 1279px) {
      .dia { padding: 14px; border-radius: 16px; background: rgb(248 250 252); border: 1px solid rgb(226 232 240); }
      .dia--hoy { border-color: rgb(110 231 183); background: rgb(236 253 245 / 0.6); }
      :host-context(.dark) .dia { background: rgb(15 23 42 / 0.5); border-color: rgb(51 65 85 / 0.7); }
      :host-context(.dark) .dia--hoy { background: rgb(6 78 59 / 0.18); border-color: rgb(16 185 129 / 0.6); }
      .dia__cab { padding: 0 0 12px; }
    }
    /* Mes en teléfono */
    .dia--movil { padding: 0; }

    /* Tarjeta de una salida */
    .tarjeta {
      display: block; width: 100%; text-align: left; padding: 14px 14px 13px; border-radius: 14px;
      background: #fff; border: 1px solid rgb(226 232 240);
      box-shadow: 0 1px 2px rgba(15,23,42,0.05);
      transition: border-color 150ms ease-out, box-shadow 150ms ease-out, transform 120ms ease-out;
    }
    .tarjeta:enabled:hover { border-color: rgb(167 243 208); box-shadow: 0 4px 14px -6px rgba(15,23,42,0.18); }
    .tarjeta:enabled:active { transform: scale(0.98); }
    /* Separa "quién" de "dónde" con una línea tenue */
    .tarjeta__quien { margin-top: 12px; padding-top: 10px; border-top: 1px solid rgb(241 245 249); }
    :host-context(.dark) .tarjeta__quien { border-top-color: rgb(51 65 85 / 0.7); }
    /* Por Zoom: un filete azul tenue la distingue de las salidas a la calle sin gritar */
    .tarjeta--zoom { border-color: rgb(191 219 254); background: rgb(239 246 255); }
    .tarjeta--zoom:enabled:hover { border-color: rgb(147 197 253); }
    :host-context(.dark) .tarjeta--zoom { border-color: rgb(30 64 175 / 0.55); background: rgb(23 37 84 / 0.35); }
    :host-context(.dark) .tarjeta--zoom:enabled:hover { border-color: rgb(59 130 246 / 0.7); }
    .tarjeta:focus-visible { outline: 2px solid rgb(16 185 129); outline-offset: 2px; }
    :host-context(.dark) .tarjeta { background: rgb(15 23 42); border-color: rgb(30 41 59); box-shadow: none; }
    :host-context(.dark) .tarjeta:enabled:hover { border-color: rgb(16 185 129 / 0.6); }

    /* En teléfono la semana es una agenda: los días vacíos no ocupan lugar */
    @media (max-width: 1279px) { .dia--vacio { display: none; } }
    .celda--fuera { background: rgb(248 250 252); }
    :host-context(.dark) .celda--fuera { background: rgb(15 23 42 / 0.35); }

    .celda-mas { opacity: 0; transition: opacity 120ms ease-out; }
    div:hover > div > .celda-mas, .celda-mas:focus-visible { opacity: 1; }

    .opcion-menu:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

    .opcion-menu { display: block; width: 100%; text-align: left; padding: 10px 12px; border-radius: 8px; transition: background-color 120ms ease-out; }
    .opcion-menu:hover { background: rgb(248 250 252); }
    :host-context(.dark) .opcion-menu:hover { background: rgb(51 65 85 / 0.6); }

    .opcion-dialogo { display: block; width: 100%; text-align: left; padding: 14px 16px; border-radius: 14px; border: 2px solid; transition: background-color 150ms ease-out, transform 120ms ease-out; }
    .opcion-dialogo:active:enabled { transform: scale(0.98); }
    .opcion-dialogo:disabled { opacity: 0.6; }
    .opcion-dialogo--ok { border-color: rgb(16 185 129); background: rgb(236 253 245); color: rgb(6 78 59); }
    .opcion-dialogo--ok:hover:enabled { background: rgb(209 250 229); }
    .opcion-dialogo--peligro { border-color: rgb(254 202 202); background: #fff; color: rgb(153 27 27); }
    .opcion-dialogo--peligro:hover:enabled { background: rgb(254 242 242); }
    :host-context(.dark) .opcion-dialogo--ok { background: rgb(6 78 59 / 0.3); border-color: rgb(16 185 129 / 0.7); color: rgb(167 243 208); }
    :host-context(.dark) .opcion-dialogo--peligro { background: transparent; border-color: rgb(127 29 29 / 0.8); color: rgb(252 165 165); }
    :host-context(.dark) .opcion-dialogo--peligro:hover:enabled { background: rgb(127 29 29 / 0.25); }

    /* Entradas cortas (ease-out); se omiten con «reducir movimiento» */
    .menu-pop { animation: pop 140ms cubic-bezier(0.23, 1, 0.32, 1); transform-origin: top right; }
    .vacio-card, .aviso-hecho { animation: subir 220ms cubic-bezier(0.23, 1, 0.32, 1); }
    .entra .tarjeta { animation: subir 180ms cubic-bezier(0.23, 1, 0.32, 1) both; }
    @keyframes pop { from { opacity: 0; transform: scale(0.96); } }
    @keyframes subir { from { opacity: 0; transform: translateY(6px); } }

    .scroll-fino { scrollbar-width: thin; scrollbar-color: rgb(203 213 225) transparent; }
    @media (prefers-reduced-motion: reduce) {
      .tarjeta { transition: none; } .tarjeta:enabled:active { transform: none; }
      .menu-pop, .vacio-card, .aviso-hecho, .entra .tarjeta { animation: none; }
      .opcion-dialogo:active:enabled { transform: none; }
    }
  `],
})
export class HorariosPage {
  private http = inject(HttpClient);
  private svc = inject(SalidasProgramaService);
  private territoriosService = inject(TerritoriosService);
  private authStore = inject(AuthStore);
  private congregacionCtx = inject(CongregacionContextService);

  /** Armar o cambiar el programa exige 'territorios.horarios_editar'. */
  puedeEditar = computed(() => {
    this.authStore.user();
    return this.authStore.hasPermission('territorios.horarios_editar');
  });

  readonly hora = horaLegible;
  readonly tituloDia = tituloDia;
  readonly textoVacante = textoVacante;
  readonly hoyIso = aIso(new Date());
  readonly pasos = [
    'Configure las salidas fijas: los días, horas y lugares que se repiten. El capitán es opcional; si no lo pone, se turnan los habilitados.',
    'Cree el programa de la semana o del mes con un botón. Cada salida mostrará qué manzanas le tocan, según el recorrido.',
    'Revise, cambie lo que haga falta y compártalo con la congregación.',
  ];

  periodo = signal<Periodo>('semana');
  referencia = signal(new Date());
  rango = computed(() => rangoDe(this.referencia(), this.periodo()));
  titulo = computed(() => tituloPeriodo(this.rango().desde, this.periodo()));
  esActual = computed(() => aIso(rangoDe(new Date(), this.periodo()).desde) === aIso(this.rango().desde));

  salidas = signal<SalidaProgramada[]>([]);
  semanaTipo = signal<FilaSemanaTipo[]>([]);
  gruposOpc = signal<GrupoOpcion[]>([]);
  personas = signal<PersonaRef[]>([]);
  capitanesHabilitados = signal<PersonaRef[]>([]);
  barrios = signal<Sector[]>([]);
  puntosSalida = signal<PuntoSalidaOpcion[]>([]);
  /** Lo que le toca a cada salida aún sin registrar del periodo visible (clave = id_horario). */
  sugerencias = signal<Record<string, SugerenciaSalida>>({});

  loading = signal(true);
  /** Las salidas fijas ya llegaron: antes no se ofrece editarlas (guardar reemplaza la semana tipo completa). */
  fijasListas = signal(false);
  generando = signal(false);
  guardando = signal(false);
  exportando = signal(false);
  menuCompartir = signal(false);
  mostrarSemanaTipo = signal(false);
  error = signal<string | null>(null);
  menuPrograma = signal(false);
  dialogoRecrear = signal(false);
  dialogoBorrar = signal(false);
  /** Aviso breve al terminar de crear el programa. */
  hecho = signal<string | null>(null);
  /** Anima la entrada de las salidas recién creadas. */
  recienCreado = signal(false);
  private quitarAviso?: ReturnType<typeof setTimeout>;
  editando = signal<{ salida: SalidaProgramada | null; form: SalidaForm } | null>(null);

  dias = computed<DiaPrograma[]>(() => {
    const por = new Map<string, SalidaProgramada[]>();
    for (const s of this.salidas()) {
      if (!por.has(s.fecha_programada)) por.set(s.fecha_programada, []);
      por.get(s.fecha_programada)!.push(s);
    }
    return [...por.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([fecha, salidas]) => ({ fecha, titulo: tituloDia(fecha), salidas }));
  });

  /** La congregación de los datos que se ven (la da el backend). */
  nombreCongregacion = signal('');
  /** La congregación usa videoconferencia: el editor ofrece «Por Zoom». */
  usaZoom = signal(false);
  tieneEnlaceZoom = signal(false);
  /** Administrador con «Todas las congregaciones»: el programa es por congregación. */
  sinCongregacion = computed(() => this.authStore.isAdministrador() && !this.congregacionCtx.effectiveCongregacionId());

  // Salidas cuyo capitán se trasladó a otra congregación: se avisa hasta que
  // alguien lo reemplaza (el backend da la vacante por resuelta solo).
  private vacantesSvc = inject(VacantesTrasladoService);
  private vacantes = signal<Map<number, VacanteTraslado>>(new Map());
  private recargarVacantes = effect(() => {
    if (!this.salidas().length) return;
    const cong = this.congregacionCtx.effectiveCongregacionId();
    untracked(() => this.vacantesSvc.listar(['horario_predicacion'], cong).subscribe((lista) =>
      this.vacantes.set(vacantesPor(lista, 'id_horario'))
    ));
  });

  /** Todo depende de la congregación: el Administrador puede cambiarla en el selector sin salir de la pantalla. */
  private alCambiarCongregacion = effect(() => {
    const cong = this.congregacionCtx.effectiveCongregacionId();
    untracked(() => this.cargarTodo(cong));
  });

  private cargarTodo(congId: number | null): void {
    this.pedidas.forEach(p => p.unsubscribe());
    this.subSugerencias?.unsubscribe();
    this.editando.set(null);
    this.mostrarSemanaTipo.set(false);
    this.error.set(null);
    this.hecho.set(null);
    this.salidas.set([]);
    this.semanaTipo.set([]);
    this.sugerencias.set({});
    this.vacantes.set(new Map());
    this.fijasListas.set(false);
    if (this.sinCongregacion()) { this.loading.set(false); return; }
    this.svc.periodo().subscribe({
      next: (p) => {
        this.periodo.set(p.periodo);
        this.nombreCongregacion.set(p.nombre_congregacion ?? '');
        this.usaZoom.set(!!p.usa_zoom);
        this.tieneEnlaceZoom.set(!!p.tiene_enlace_zoom);
        this.cargar();
      },
      error: () => this.cargar(),
    });
    this.svc.semanaTipo().subscribe({
      next: (l) => { this.semanaTipo.set(l); this.fijasListas.set(true); },
      error: (e) => this.mostrarError(e, 'No se pudieron cargar las salidas fijas. Recargue la página.'),
    });
    this.svc.grupos().subscribe({ next: (l) => this.gruposOpc.set(l) });
    this.svc.capitanes().subscribe({ next: (l) => this.capitanesHabilitados.set(l), error: () => this.capitanesHabilitados.set([]) });
    this.territoriosService.getSectores().subscribe({ next: (r) => this.barrios.set(r.sectores), error: () => this.barrios.set([]) });
    this.territoriosService.getPuntosSalida().subscribe({ next: (l) => this.puntosSalida.set(l), error: () => this.puntosSalida.set([]) });
    const params: any = { limit: 1000 };
    if (congId) params.id_congregacion = congId;
    this.http.get<Publicador[]>('/api/publicadores/', { params }).subscribe({
      next: (l) => this.personas.set(
        l.map(p => ({ id_publicador: p.id_publicador, nombre: nombreMostrado(p) }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      ),
    });
  }

  /** Peticiones del periodo en curso: al cambiar de semana se cancelan, para que una respuesta atrasada no pise la nueva. */
  private pedidas: Subscription[] = [];

  cargar(): void {
    this.pedidas.forEach(p => p.unsubscribe());
    this.loading.set(true);
    const { desde, hasta } = this.rango();
    const lista = this.svc.listar(aIso(desde), aIso(hasta)).subscribe({
      next: (l) => { this.salidas.set(l); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.mostrarError(e, 'No se pudo cargar el programa.'); },
    });
    this.pedidas = [lista];
    this.cargarSugerencias();
  }

  /** Lo que le toca a cada salida; es una ayuda: si falla, la agenda se ve igual, solo sin «Le toca…». */
  private subSugerencias?: Subscription;
  private cargarSugerencias(): void {
    // Solo vale la última: una respuesta atrasada de otro periodo no pisa la actual.
    this.subSugerencias?.unsubscribe();
    const { desde, hasta } = this.rango();
    this.subSugerencias = this.territoriosService.getSugerencias(aIso(desde), aIso(hasta)).subscribe({
      next: (r) => this.sugerencias.set(r),
      error: () => this.sugerencias.set({}),
    });
  }

  /**
   * Una línea por salida: lo que ya se predicó, o lo que le toca, o que falta registrarla.
   * Es informativo: no obliga a nada.
   */
  plan(s: SalidaProgramada): { tipo: 'hecho' | 'toca' | 'falta'; texto: string; aviso: string | null } | null {
    const reg = s.registro;
    if (reg?.registrada) {
      if (!reg.numeros.length) return { tipo: 'hecho', texto: '✓ Registrada, sin manzanas marcadas', aviso: null };
      return { tipo: 'hecho', texto: `✓ Predicaron ${textoManzanas(reg.numeros)}${reg.hasta ? ' · hasta la ' + reg.hasta : ''}`, aviso: null };
    }
    if (s.sin_salida) return { tipo: 'falta', texto: 'No se salió', aviso: null };
    // Por Zoom no se predica en el territorio: no hay manzanas que tocan ni nada que registrar.
    if (s.por_zoom) return null;
    if (s.fecha_programada < this.hoyIso) return { tipo: 'falta', texto: 'Sin registrar lo que se predicó', aviso: null };
    const g = this.sugerencias()[String(s.id_horario)];
    if (!g || !g.manzanas.length) return null;
    const donde = g.origen === 'general' ? '' : g.origen === 'barrio' ? ` · barrio ${s.nombre_barrio ?? ''}` : '';
    const medias = g.manzanas.filter(m => m.a_medias).map(m => m.numero);
    const terminar = medias.length ? ` · terminar la ${medias.join(', ')}, que quedó a medias` : '';
    return { tipo: 'toca', texto: `Le toca: ${textoManzanas(g.manzanas.map(m => m.numero))} (${codigosDe(g.manzanas)})${donde}${terminar}`, aviso: g.aviso };
  }

  mover(paso: number): void {
    this.referencia.set(moverPeriodo(this.rango().desde, this.periodo(), paso));
    this.hecho.set(null);
    this.cargar();
  }

  irHoy(): void {
    this.referencia.set(new Date());
    this.cargar();
  }

  readonly diasCortos = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  sinCapitan = computed(() => this.salidas().filter(s => !s.capitanes.length).length);

  private porFecha = computed(() => {
    const m = new Map<string, SalidaProgramada[]>();
    for (const s of this.salidas()) {
      if (!m.has(s.fecha_programada)) m.set(s.fecha_programada, []);
      m.get(s.fecha_programada)!.push(s);
    }
    return m;
  });

  /** Los 7 días de la semana, tengan o no salidas. */
  semana = computed(() => {
    const { desde } = this.rango();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + i);
      const fecha = aIso(d);
      return { fecha, titulo: tituloDia(fecha), nombre: DIAS[i], numero: d.getDate(), salidas: this.porFecha().get(fecha) ?? [] };
    });
  });

  /** Celdas del calendario del mes, de lunes a domingo (incluye días de los meses vecinos). */
  mes = computed(() => {
    const { desde, hasta } = this.rango();
    const inicio = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() - ((desde.getDay() + 6) % 7));
    const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate() + (6 - ((hasta.getDay() + 6) % 7)));
    const celdas = [];
    for (let d = inicio; d <= fin; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const fecha = aIso(d);
      celdas.push({ fecha, numero: d.getDate(), enMes: d.getMonth() === desde.getMonth(), salidas: this.porFecha().get(fecha) ?? [] });
    }
    return celdas;
  });

  /** "9:00" sin a. m./p. m., para el calendario del mes. */
  horaCorta(h?: string | null): string { return horaLegible(h).replace(/ [ap]\. m\./, ''); }

  detalle(s: SalidaProgramada): string {
    return [horaLegible(s.hora_inicio), s.por_zoom ? 'Por Zoom' : s.lugar, this.capitanes(s) || 'Sin capitán', s.por_zoom ? null : s.codigo_territorio].filter(Boolean).join(' · ');
  }

  /** "Grupos 1, 3 y 5" cuando se llaman "Grupo # N"; si no, los nombres tal cual. */
  gruposCorto(s: SalidaProgramada): string {
    const nums = s.grupos.map(g => /^Grupo\s*#?\s*(\d+)$/i.exec(g.nombre.trim())?.[1]);
    if (nums.every(Boolean)) {
      const l = nums as string[];
      const lista = l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0];
      return `${l.length > 1 ? 'Grupos' : 'Grupo'} ${lista}`;
    }
    return this.grupos(s);
  }

  hayTerritorios = computed(() => this.salidas().some(s => !!s.codigo_territorio));

  /** "Martes 20" para la hoja (el mes ya va en el título). */
  diaCorto(iso: string): string { return tituloDia(iso).replace(/ de \S+$/, ''); }

  capitanes(s: SalidaProgramada): string { return s.capitanes.map(c => c.nombre).join(', '); }
  grupos(s: SalidaProgramada): string { return s.grupos.map(g => g.nombre).join(', '); }
  vacante(s: SalidaProgramada): VacanteTraslado | null { return this.vacantes().get(s.id_horario) ?? null; }

  // ── Generar ───────────────────────────────────────────────────────────────

  /**
   * Qué ve el encargado y cuál es la única acción principal:
   * sin salidas fijas → configurarlas · periodo vacío → crear el programa · con programa → ajustarlo.
   */
  estado = computed<'sin-fijas' | 'vacio' | 'con-programa'>(() =>
    this.salidas().length ? 'con-programa' : this.semanaTipo().length ? 'vacio' : 'sin-fijas');

  textoCrear = computed(() => {
    if (this.periodo() === 'semana') return 'Crear programa de la semana';
    const mes = this.rango().desde.toLocaleDateString('es', { month: 'long' });
    return `Crear programa de ${mes}`;
  });

  /** Las salidas fijas agrupadas por día, para mostrar qué se va a crear. */
  vistaPrevia = computed(() => {
    const por: FilaSemanaTipo[][] = [[], [], [], [], [], [], []];
    for (const f of this.semanaTipo()) por[f.dia_semana - 1].push(f);
    return por
      .map((filas, i) => ({ dia: DIAS[i], filas: [...filas].sort((a, b) => (a.hora_inicio ?? '99').localeCompare(b.hora_inicio ?? '99')) }))
      .filter(d => d.filas.length);
  });

  /** Cuántas salidas saldrán en el periodo visible (en el mes, cada día cuenta las veces que cae). */
  totalPrevio = computed(() => {
    const { desde, hasta } = this.rango();
    const porDia = new Map<number, number>();
    for (const f of this.semanaTipo()) porDia.set(f.dia_semana, (porDia.get(f.dia_semana) ?? 0) + 1);
    let total = 0;
    for (let d = new Date(desde); d <= hasta; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      total += porDia.get(((d.getDay() + 6) % 7) + 1) ?? 0;
    }
    return total;
  });

  /** «semana del 23 de noviembre» / «noviembre de 2026», para meterlo en una frase. */
  tituloEnFrase = computed(() => this.titulo().replace(/^./, c => c.toLowerCase()));

  sinFijoCuantas = computed(() => this.semanaTipo().filter(f => !f.capitanes.length).length);

  nombresDe(l: PersonaRef[]): string { return l.map(p => p.nombre).join(', '); }

  pedirRecrear(): void { this.dialogoRecrear.set(true); }

  /** Quita todas las salidas del periodo visible. */
  borrarPeriodo(): void {
    const { desde, hasta } = this.rango();
    this.generando.set(true);
    const clave = aIso(desde);
    this.svc.borrarPeriodo(aIso(desde), aIso(hasta)).subscribe({
      next: (r) => {
        this.generando.set(false);
        this.dialogoBorrar.set(false);
        if (aIso(this.rango().desde) !== clave) return;  // ya se ve otro periodo
        this.salidas.set([]);
        this.sugerencias.set({});
        this.hecho.set(r.borradas === 1 ? 'Se borró 1 salida.' : `Se borraron ${r.borradas} salidas.`);
        clearTimeout(this.quitarAviso);
        this.quitarAviso = setTimeout(() => this.hecho.set(null), 5000);
      },
      error: (e) => {
        this.generando.set(false);
        this.dialogoBorrar.set(false);
        this.mostrarError(e, 'No se pudo borrar el programa.');
      },
    });
  }

  crear(modo: ModoCrear): void {
    if (!this.semanaTipo().length) { this.abrirSemanaTipo(); return; }
    const { desde, hasta } = this.rango();
    const antes = new Set(this.salidas().map(s => s.id_horario));
    this.generando.set(true);
    const clave = aIso(desde);
    this.svc.generar(aIso(desde), aIso(hasta), modo).subscribe({
      next: (l) => {
        this.generando.set(false);
        this.dialogoRecrear.set(false);
        if (aIso(this.rango().desde) !== clave) return;  // ya se ve otro periodo
        this.salidas.set(l);
        // También al empezar de nuevo: las registradas que se conservan no son nuevas.
        this.avisarCreadas(l.filter(s => !antes.has(s.id_horario)), modo);
        this.recienCreado.set(true);
        setTimeout(() => this.recienCreado.set(false), 600);
        this.cargarSugerencias();
      },
      error: (e) => {
        this.generando.set(false);
        if (e?.status === 409) { this.dialogoRecrear.set(true); this.cargar(); return; }
        this.dialogoRecrear.set(false);
        this.mostrarError(e, 'No se pudo crear el programa.');
      },
    });
  }

  /** «Se crearon 9 salidas. A 6 se les puso capitán por turnos…» */
  private avisarCreadas(nuevas: SalidaProgramada[], modo: ModoCrear): void {
    const n = nuevas.length;
    let texto: string;
    if (modo === 'faltantes' && !n) texto = 'No faltaba ninguna: el programa ya tenía todas las salidas fijas.';
    else if (modo === 'faltantes') texto = n === 1 ? 'Se agregó 1 salida que faltaba.' : `Se agregaron ${n} salidas que faltaban.`;
    else texto = n === 1 ? 'Se creó 1 salida.' : `Se crearon ${n} salidas.`;
    // Salidas fijas sin capitán: el sistema puso a alguien por turnos.
    const sinFijo = new Set(this.semanaTipo().filter(f => !f.capitanes.length).map(f => `${f.dia_semana}|${f.hora_inicio ?? ''}`));
    const auto = nuevas.filter(s => {
      const dia = ((new Date(s.fecha_programada + 'T12:00:00').getDay() + 6) % 7) + 1;
      return s.capitanes.length && sinFijo.has(`${dia}|${s.hora_inicio ?? ''}`);
    }).length;
    if (auto) texto += auto === 1
      ? ' A 1 se le puso capitán por turnos; revíselo y cámbielo si hace falta.'
      : ` A ${auto} se les puso capitán por turnos; revíselos y cámbielos si hace falta.`;
    this.hecho.set(texto);
    clearTimeout(this.quitarAviso);
    this.quitarAviso = setTimeout(() => this.hecho.set(null), auto ? 9000 : 5000);
  }

  // ── Editar una salida ─────────────────────────────────────────────────────

  nuevaSalida(dia?: string): void {
    const { desde } = this.rango();
    const fecha = dia ?? (this.esActual() ? this.hoyIso : aIso(desde));
    this.editando.set({
      salida: null,
      form: { fecha_programada: fecha, hora_inicio: null, lugar: null, notas: null, por_zoom: false, id_territorio: null, id_sector: null, id_punto_salida: null, capitanes: [], grupos: [] },
    });
  }

  editar(s: SalidaProgramada): void {
    if (!this.puedeEditar()) return;
    this.editando.set({
      salida: s,
      form: {
        fecha_programada: s.fecha_programada, hora_inicio: s.hora_inicio ?? null, lugar: s.lugar ?? null, notas: s.notas ?? null,
        por_zoom: !!s.por_zoom, id_territorio: s.id_territorio ?? null, id_sector: s.id_sector ?? null, id_punto_salida: s.id_punto_salida ?? null,
        capitanes: s.capitanes.map(c => c.id_publicador), grupos: s.grupos.map(g => g.id_grupo),
      },
    });
  }

  guardar(f: SalidaForm): void {
    const e = this.editando();
    if (!e) return;
    this.guardando.set(true);
    const obs = e.salida ? this.svc.actualizar(e.salida.id_horario, f) : this.svc.crear(f);
    obs.subscribe({
      next: () => { this.guardando.set(false); this.editando.set(null); this.cargar(); },
      error: (err) => { this.guardando.set(false); this.mostrarError(err, 'No se pudo guardar la salida.'); },
    });
  }

  eliminar(): void {
    const s = this.editando()?.salida;
    if (!s) return;
    this.svc.eliminar(s.id_horario).subscribe({
      next: () => {
        this.editando.set(null);
        this.salidas.update(l => l.filter(x => x.id_horario !== s.id_horario));
        this.cargarSugerencias();  // las manzanas que le tocaban pasan a las salidas siguientes
      },
      error: (err) => this.mostrarError(err, 'No se pudo quitar la salida.'),
    });
  }

  // ── Semana tipo ───────────────────────────────────────────────────────────

  abrirSemanaTipo(): void { if (this.fijasListas()) this.mostrarSemanaTipo.set(true); }

  /** Cierra los menús desplegables al hacer clic fuera de ellos. */
  alClicFuera(ev: MouseEvent): void {
    const dentro = (ev.target as HTMLElement | null)?.closest?.('[data-menu]')?.getAttribute('data-menu');
    if (dentro !== 'compartir' && this.menuCompartir()) this.menuCompartir.set(false);
    if (dentro !== 'programa' && this.menuPrograma()) this.menuPrograma.set(false);
  }

  cerrarSemanaTipo(guardado: boolean): void {
    this.mostrarSemanaTipo.set(false);
    if (!guardado) return;
    this.svc.semanaTipo().subscribe({ next: (l) => this.semanaTipo.set(l) });
    this.svc.periodo().subscribe({
      next: (p) => {
        if (p.periodo !== this.periodo()) { this.periodo.set(p.periodo); this.cargar(); }
      },
    });
  }

  // ── Compartir ─────────────────────────────────────────────────────────────

  async compartir(formato: 'image' | 'pdf'): Promise<void> {
    this.menuCompartir.set(false);
    this.exportando.set(true);
    // Deja que Angular pinte la hoja fuera de pantalla antes de capturarla.
    await new Promise(r => setTimeout(r, 50));
    try {
      await exportarElemento('hoja-salidas', `Salidas_${aIso(this.rango().desde)}`, formato);
    } catch {
      this.error.set('No se pudo crear el archivo. Intente de nuevo.');
    } finally {
      this.exportando.set(false);
    }
  }

  private mostrarError(e: any, porDefecto: string): void {
    const d = e?.error?.detail;
    this.error.set(typeof d === 'string' ? d : porDefecto);
  }
}
