import { Component, signal, computed, effect, inject, OnInit, untracked } from '@angular/core';
import { VacanteTraslado, VacantesTrasladoService, textoVacante, vacantesPor } from '../../../shared/vacantes-traslado';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TerritoriosService } from '../services/territorios.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { Territorio, ResumenTerritorio, textoDiasSinTrabajar } from '../models/territorio.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { nombreMostrado } from '../../../core/utils/nombre.util';
import { SalidaEditorComponent, OpcionTerritorio } from '../components/salida-editor.component';
import { SemanaTipoComponent } from '../components/semana-tipo.component';
import { exportarElemento } from '../utils/territorio-export.util';
import {
  FilaSemanaTipo, GrupoOpcion, Periodo, PersonaRef, SalidaForm, SalidaProgramada, SalidasProgramaService,
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
  imports: [CommonModule, PageHeaderComponent, SalidaEditorComponent, SemanaTipoComponent],
  template: `
    <div class="flex flex-col h-full min-h-0 gap-4">
      <app-page-header
        spacing="none"
        title="Programa de salidas"
        subtitle="Qué días se predica, dónde se reúnen, quién saca el grupo y en qué territorio.">
        @if (puedeEditar()) {
          <button (click)="abrirSemanaTipo()" class="btn-secondary focus-ring-green whitespace-nowrap">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Semana tipo
          </button>
        }
        <div class="relative">
          <button (click)="menuCompartir.set(!menuCompartir())" [disabled]="!salidas().length || exportando()"
            class="btn-secondary focus-ring-green whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed">
            @if (exportando()) {
              <div class="w-4 h-4 border-2 border-slate-300 border-t-emerald-600 rounded-full animate-spin"></div>
            } @else {
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            }
            Compartir
          </button>
          @if (menuCompartir()) {
            <div class="fixed inset-0 z-40" (click)="menuCompartir.set(false)"></div>
            <div class="absolute right-0 mt-2 z-50 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-1.5">
              <button (click)="compartir('image')" class="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors">
                <span class="block text-sm font-bold text-slate-800 dark:text-slate-100">Imagen (WhatsApp)</span>
                <span class="block text-[12px] text-slate-500 dark:text-slate-400">Se descarga una foto de la hoja</span>
              </button>
              <button (click)="compartir('pdf')" class="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors">
                <span class="block text-sm font-bold text-slate-800 dark:text-slate-100">PDF para imprimir</span>
                <span class="block text-[12px] text-slate-500 dark:text-slate-400">Para pegar en el tablero</span>
              </button>
            </div>
          }
        </div>
      </app-page-header>

      <!-- Barra: periodo · resumen · acciones -->
      <div class="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div class="flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl p-1 shadow-sm">
          <button (click)="mover(-1)" [title]="periodo() === 'mes' ? 'Mes anterior' : 'Semana anterior'"
            class="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span class="min-w-[11.5rem] text-center text-[15px] font-black text-slate-900 dark:text-white px-1 tabular-nums">{{ titulo() }}</span>
          <button (click)="mover(1)" [title]="periodo() === 'mes' ? 'Mes siguiente' : 'Semana siguiente'"
            class="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors active:scale-95">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </div>
        @if (!esActual()) {
          <button (click)="irHoy()" class="h-9 px-3 rounded-lg text-[13px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
            Ir a {{ periodo() === 'mes' ? 'este mes' : 'esta semana' }}
          </button>
        }

        @if (salidas().length) {
          <div class="hidden lg:flex items-center gap-2" aria-label="Resumen del periodo">
            <span class="resumen"><b class="tabular-nums">{{ salidas().length }}</b> {{ salidas().length === 1 ? 'salida' : 'salidas' }}</span>
            @if (sinCapitan()) {
              <span class="resumen resumen--aviso"><span class="punto bg-amber-500"></span><b class="tabular-nums">{{ sinCapitan() }}</b> sin capitán</span>
            }
            @if (sinTerritorio()) {
              <span class="resumen"><span class="punto bg-slate-400"></span><b class="tabular-nums">{{ sinTerritorio() }}</b> sin territorio</span>
            }
          </div>
        }

        @if (puedeEditar()) {
          <div class="flex gap-2 ml-auto w-full sm:w-auto">
            <button (click)="nuevaSalida()" class="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors active:scale-[0.97]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Agregar salida
            </button>
            <button (click)="generar()" [disabled]="generando()"
              class="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-bold whitespace-nowrap text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:opacity-60 transition-[background-color,transform] active:scale-[0.97]">
              @if (generando()) {
                <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              } @else {
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="13" x2="12" y2="19"/><line x1="9" y1="16" x2="15" y2="16"/></svg>
              }
              Generar {{ periodo() === 'mes' ? 'mes' : 'semana' }}
            </button>
          </div>
        }
      </div>

      @if (error()) {
        <div class="shrink-0 flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-xl px-4 py-3" role="alert">
          <svg class="w-4 h-4 text-red-500 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <p class="flex-1 text-sm font-semibold text-red-700 dark:text-red-300">{{ error() }}</p>
          <button (click)="error.set(null)" class="text-sm font-bold text-red-700 dark:text-red-300 px-1" title="Cerrar aviso">✕</button>
        </div>
      }

      @if (reemplazo(); as r) {
        <div class="shrink-0 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 flex flex-wrap items-center gap-3" role="alert">
          <p class="flex-1 min-w-[14rem] text-sm font-semibold text-amber-900 dark:text-amber-200">
            {{ r }} ¿Las cambiamos por las de la semana tipo? Se perderán los cambios hechos a mano.
          </p>
          <button (click)="reemplazo.set(null)" class="h-9 px-3 rounded-lg text-sm font-bold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40">No, dejarlas</button>
          <button (click)="generar(true)" class="h-9 px-3 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-700">Sí, reemplazar</button>
        </div>
      }

      <!-- Contenido: ocupa el alto que queda; solo se desplaza por dentro si hace falta -->
      <div class="flex-1 min-h-0">
        @if (sinCongregacion()) {
          <div class="h-full flex items-center justify-center bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/50 px-6 py-10 text-center">
            <div>
              <p class="text-lg font-black text-slate-900 dark:text-white">Elija una congregación</p>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">El programa de salidas es de cada congregación. Elíjala en el selector de arriba para verlo o armarlo.</p>
            </div>
          </div>
        } @else if (loading()) {
          <div class="h-full grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-2">
            @for (i of [1, 2, 3, 4, 5, 6, 7]; track i) {
              <div class="rounded-2xl bg-slate-100 dark:bg-slate-800/60 animate-pulse min-h-24"></div>
            }
          </div>
        } @else if (!salidas().length && !semanaTipo().length && puedeEditar()) {
          <div class="h-full flex items-center justify-center bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/50 px-6 py-10 text-center">
            <div>
              <p class="text-lg font-black text-slate-900 dark:text-white">Arme el programa en 3 pasos</p>
              <ol class="mt-5 max-w-md mx-auto text-left space-y-3">
                @for (paso of pasos; track $index) {
                  <li class="flex gap-3">
                    <span class="w-7 h-7 shrink-0 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[13px] font-black flex items-center justify-center">{{ $index + 1 }}</span>
                    <span class="text-sm text-slate-600 dark:text-slate-300 pt-1">{{ paso }}</span>
                  </li>
                }
              </ol>
              <button (click)="abrirSemanaTipo()" class="mt-6 h-11 px-5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-colors">Armar la semana tipo</button>
            </div>
          </div>
        } @else if (periodo() === 'semana') {
          <!-- Semana: 7 columnas en escritorio, agenda en teléfono -->
          <div class="h-full overflow-y-auto xl:overflow-hidden grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-7 gap-3 xl:gap-4 content-start xl:content-stretch">
            @for (d of semana(); track d.fecha) {
              <section class="dia" [class.dia--hoy]="d.fecha === hoyIso" [class.dia--pasado]="d.fecha < hoyIso"
                       [class.dia--vacio]="!d.salidas.length && d.fecha !== hoyIso">
                <header class="dia__cab flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-[12px] font-bold uppercase tracking-wide" [class]="d.fecha === hoyIso ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'">{{ d.nombre }}</p>
                    <p class="text-xl font-black leading-tight text-slate-900 dark:text-white tabular-nums">{{ d.numero }}@if (d.fecha === hoyIso) {<span class="ml-1.5 align-middle text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">Hoy</span>}</p>
                  </div>
                  @if (puedeEditar()) {
                    <button (click)="nuevaSalida(d.fecha)" [title]="'Agregar salida el ' + d.titulo"
                      class="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                  }
                </header>
                <div class="xl:flex-1 xl:min-h-0 xl:overflow-y-auto pt-3 pb-1 space-y-3 scroll-fino">
                  @for (s of d.salidas; track s.id_horario) {
                    <button type="button" (click)="editar(s)" [disabled]="!puedeEditar()" class="tarjeta">
                      <span class="block text-[16px] font-black text-slate-900 dark:text-white tabular-nums">{{ hora(s.hora_inicio) || 'Sin hora' }}</span>
                      <span class="block mt-1.5 text-[14px] font-semibold text-slate-800 dark:text-slate-100 leading-snug">{{ s.lugar || 'Sin lugar' }}</span>
                      @if (s.grupos.length) {
                        <span class="block mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">{{ gruposCorto(s) }}</span>
                      }
                      <span class="tarjeta__quien flex items-start gap-2 text-[13px] leading-snug" [class]="s.capitanes.length ? 'text-slate-600 dark:text-slate-300' : 'text-amber-700 dark:text-amber-300 font-semibold'">
                        <svg class="w-3.5 h-3.5 mt-[3px] shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        <span class="min-w-0 space-y-0.5">
                          @if (s.capitanes.length) {
                            @for (c of s.capitanes; track c.id_publicador) { <span class="block">{{ c.nombre }}</span> }
                          }
                          @else if (vacante(s); as v) { <span [title]="textoVacante(v)">Sin capitán · {{ v.nombre_publicador }} se trasladó</span> }
                          @else { Sin capitán }
                        </span>
                      </span>
                      @if (s.codigo_territorio) {
                        <span class="mt-2.5 inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/25 text-emerald-800 dark:text-emerald-300 text-[12px] font-bold" [title]="s.nombre_territorio ?? ''">
                          <svg class="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>
                          <span class="truncate">{{ s.codigo_territorio }}</span>
                        </span>
                      }
                    </button>
                  } @empty {
                    <p class="pt-1 text-[13px] text-slate-400 dark:text-slate-500">Sin salidas</p>
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
          <div class="hidden xl:flex h-full flex-col bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden">
            <div class="grid grid-cols-7 shrink-0 border-b border-slate-100 dark:border-slate-700/60">
              @for (n of diasCortos; track n) {
                <span class="px-3 h-9 flex items-center text-[12px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ n }}</span>
              }
            </div>
            <div class="flex-1 min-h-0 grid grid-cols-7" [style.grid-template-rows]="'repeat(' + mes().length / 7 + ', minmax(0, 1fr))'">
              @for (c of mes(); track c.fecha) {
                <div class="min-h-0 flex flex-col border-b border-r border-slate-100 dark:border-slate-700/50 [&:nth-child(7n)]:border-r-0"
                     [class.celda--fuera]="!c.enMes">
                  <div class="flex items-center justify-between px-2 pt-1.5">
                    <span class="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-bold tabular-nums"
                          [class]="c.fecha === hoyIso ? 'bg-emerald-600 text-white' : c.enMes ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'">{{ c.numero }}</span>
                    @if (puedeEditar() && c.enMes) {
                      <button (click)="nuevaSalida(c.fecha)" title="Agregar salida" class="celda-mas w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      </button>
                    }
                  </div>
                  <div class="flex-1 min-h-0 overflow-y-auto px-1.5 pb-1.5 space-y-1 scroll-fino">
                    @for (s of c.salidas; track s.id_horario) {
                      <button type="button" (click)="editar(s)" [disabled]="!puedeEditar()" [title]="detalle(s)"
                        class="w-full text-left px-2 py-1 rounded-md text-[12px] leading-tight bg-emerald-50/80 dark:bg-emerald-900/20 enabled:hover:bg-emerald-100 dark:enabled:hover:bg-emerald-900/40 transition-colors"
                        [class.ring-1]="!s.capitanes.length" [class.ring-amber-400]="!s.capitanes.length">
                        <span class="font-black text-slate-900 dark:text-white tabular-nums">{{ horaCorta(s.hora_inicio) }}</span>
                        <span class="text-slate-700 dark:text-slate-200"> {{ s.lugar || 'Sin lugar' }}</span>
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
                  <p class="px-4 pt-3.5 text-[13px] font-black text-slate-900 dark:text-white">{{ tituloDia(c.fecha) }}</p>
                  <div class="px-3 pb-3 pt-2 space-y-2">
                    @for (s of c.salidas; track s.id_horario) {
                      <button type="button" (click)="editar(s)" [disabled]="!puedeEditar()" class="tarjeta">
                        <span class="text-[15px] font-black text-slate-900 dark:text-white tabular-nums">{{ hora(s.hora_inicio) }}</span>
                        <span class="text-[13px] font-bold text-slate-800 dark:text-slate-100"> · {{ s.lugar || 'Sin lugar' }}</span>
                        <span class="block mt-1 text-[13px] text-slate-600 dark:text-slate-300">{{ capitanes(s) || 'Sin capitán' }}@if (s.codigo_territorio) { · {{ s.codigo_territorio }} }</span>
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
                    @if (hayTerritorios()) { <td style="padding:10px 12px;vertical-align:top;font-weight:700;">{{ s.codigo_territorio ?? '' }}</td> }
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
        [territorios]="opcionesTerritorio()"
        [puedeEliminar]="!!e.salida"
        [guardando]="guardando()"
        (guardar)="guardar($event)"
        (eliminar)="eliminar()"
        (cancelar)="editando.set(null)" />
    }

    @if (mostrarSemanaTipo()) {
      <app-semana-tipo
        [inicial]="semanaTipo()"
        [periodo]="periodo()"
        [publicadores]="personas()"
        [grupos]="gruposOpc()"
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
    :host-context(.dark) .resumen { background: rgb(30 41 59); border-color: rgb(51 65 85); color: rgb(203 213 225); }
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
    .tarjeta:focus-visible { outline: 2px solid rgb(16 185 129); outline-offset: 2px; }
    :host-context(.dark) .tarjeta { background: rgb(30 41 59); border-color: rgb(51 65 85); box-shadow: none; }
    :host-context(.dark) .tarjeta:enabled:hover { border-color: rgb(16 185 129 / 0.6); }

    /* En teléfono la semana es una agenda: los días vacíos no ocupan lugar */
    @media (max-width: 1279px) { .dia--vacio { display: none; } }
    .celda--fuera { background: rgb(248 250 252); }
    :host-context(.dark) .celda--fuera { background: rgb(15 23 42 / 0.35); }

    .celda-mas { opacity: 0; transition: opacity 120ms ease-out; }
    div:hover > div > .celda-mas, .celda-mas:focus-visible { opacity: 1; }

    .scroll-fino { scrollbar-width: thin; scrollbar-color: rgb(203 213 225) transparent; }
    @media (prefers-reduced-motion: reduce) { .tarjeta { transition: none; } .tarjeta:enabled:active { transform: none; } }
  `],
})
export class HorariosPage implements OnInit {
  private http = inject(HttpClient);
  private svc = inject(SalidasProgramaService);
  private territoriosService = inject(TerritoriosService);
  private authStore = inject(AuthStore);
  private congregacionCtx = inject(CongregacionContextService);

  /** Armar o cambiar el programa exige 'territorios.editar'. */
  puedeEditar = computed(() => {
    this.authStore.user();
    return this.authStore.hasPermission('territorios.editar');
  });

  readonly hora = horaLegible;
  readonly tituloDia = tituloDia;
  readonly textoVacante = textoVacante;
  readonly hoyIso = aIso(new Date());
  readonly pasos = [
    'Arme la semana tipo: los días, horas, lugares y capitanes que se repiten.',
    'Genere la semana o el mes. A cada salida se le sugiere un territorio.',
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
  territorios = signal<Territorio[]>([]);
  resumen = signal<Map<number, ResumenTerritorio>>(new Map());

  loading = signal(true);
  generando = signal(false);
  guardando = signal(false);
  exportando = signal(false);
  menuCompartir = signal(false);
  mostrarSemanaTipo = signal(false);
  error = signal<string | null>(null);
  reemplazo = signal<string | null>(null);
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

  /** Para elegir territorio: nunca trabajados, luego los de más días sin salir. */
  opcionesTerritorio = computed<OpcionTerritorio[]>(() => {
    const r = this.resumen();
    const peso = (id: number) => {
      const d = r.get(id)?.dias_sin_trabajar;
      return d === null || d === undefined ? Number.MAX_SAFE_INTEGER : d;
    };
    return [...this.territorios()]
      .sort((a, b) => peso(b.id_territorio) - peso(a.id_territorio))
      .map(t => ({ id_territorio: t.id_territorio, etiqueta: `${t.codigo} — ${t.nombre}`, detalle: this.etiquetaTrabajo(t.id_territorio) }));
  });

  /** La congregación de los datos que se ven (la da el backend). */
  nombreCongregacion = signal('');
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

  ngOnInit(): void {
    if (this.sinCongregacion()) { this.loading.set(false); return; }
    this.svc.periodo().subscribe({
      next: (p) => { this.periodo.set(p.periodo); this.nombreCongregacion.set(p.nombre_congregacion ?? ''); this.cargar(); },
      error: () => this.cargar(),
    });
    this.svc.semanaTipo().subscribe({ next: (l) => this.semanaTipo.set(l) });
    this.svc.grupos().subscribe({ next: (l) => this.gruposOpc.set(l) });
    this.territoriosService.getTerritorios(0, 500).subscribe({ next: (l) => this.territorios.set(l) });
    this.territoriosService.getResumen().subscribe({
      next: (filas) => this.resumen.set(new Map(filas.map(f => [f.id_territorio, f]))),
    });
    const congId = this.congregacionCtx.effectiveCongregacionId();
    const params: any = { limit: 1000 };
    if (congId) params.id_congregacion = congId;
    this.http.get<Publicador[]>('/api/publicadores/', { params }).subscribe({
      next: (l) => this.personas.set(
        l.map(p => ({ id_publicador: p.id_publicador, nombre: nombreMostrado(p) }))
          .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      ),
    });
  }

  cargar(): void {
    this.loading.set(true);
    const { desde, hasta } = this.rango();
    this.svc.listar(aIso(desde), aIso(hasta)).subscribe({
      next: (l) => { this.salidas.set(l); this.loading.set(false); },
      error: (e) => { this.loading.set(false); this.mostrarError(e, 'No se pudo cargar el programa.'); },
    });
  }

  mover(paso: number): void {
    this.referencia.set(moverPeriodo(this.rango().desde, this.periodo(), paso));
    this.reemplazo.set(null);
    this.cargar();
  }

  irHoy(): void {
    this.referencia.set(new Date());
    this.cargar();
  }

  readonly diasCortos = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  sinCapitan = computed(() => this.salidas().filter(s => !s.capitanes.length).length);
  sinTerritorio = computed(() => this.salidas().filter(s => !s.id_territorio).length);

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
    return [horaLegible(s.hora_inicio), s.lugar, this.capitanes(s) || 'Sin capitán', s.codigo_territorio].filter(Boolean).join(' · ');
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

  etiquetaTrabajo(id: number): string {
    const f = this.resumen().get(id);
    if (!f) return '';
    const base = textoDiasSinTrabajar(f.dias_sin_trabajar);
    const avance = f.en_curso ? ` · ${f.porcentaje} %` : '';
    return base === 'Nunca trabajado' ? base : `última salida ${base}${avance}`;
  }

  // ── Generar ───────────────────────────────────────────────────────────────

  generar(reemplazar = false): void {
    if (!this.semanaTipo().length) {
      this.abrirSemanaTipo();
      return;
    }
    const { desde, hasta } = this.rango();
    this.generando.set(true);
    this.reemplazo.set(null);
    this.svc.generar(aIso(desde), aIso(hasta), reemplazar).subscribe({
      next: (l) => { this.salidas.set(l); this.generando.set(false); },
      error: (e) => {
        this.generando.set(false);
        if (e?.status === 409) {
          this.reemplazo.set(e.error?.detail?.mensaje ?? 'Este periodo ya tiene salidas.');
          return;
        }
        this.mostrarError(e, 'No se pudo generar el programa.');
      },
    });
  }

  // ── Editar una salida ─────────────────────────────────────────────────────

  nuevaSalida(dia?: string): void {
    const { desde } = this.rango();
    const fecha = dia ?? (this.esActual() ? this.hoyIso : aIso(desde));
    this.editando.set({
      salida: null,
      form: { fecha_programada: fecha, hora_inicio: null, lugar: null, notas: null, id_territorio: null, capitanes: [], grupos: [] },
    });
  }

  editar(s: SalidaProgramada): void {
    if (!this.puedeEditar()) return;
    this.editando.set({
      salida: s,
      form: {
        fecha_programada: s.fecha_programada, hora_inicio: s.hora_inicio ?? null, lugar: s.lugar ?? null, notas: s.notas ?? null,
        id_territorio: s.id_territorio ?? null, capitanes: s.capitanes.map(c => c.id_publicador), grupos: s.grupos.map(g => g.id_grupo),
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
      next: () => { this.editando.set(null); this.salidas.update(l => l.filter(x => x.id_horario !== s.id_horario)); },
      error: (err) => this.mostrarError(err, 'No se pudo quitar la salida.'),
    });
  }

  // ── Semana tipo ───────────────────────────────────────────────────────────

  abrirSemanaTipo(): void { this.mostrarSemanaTipo.set(true); }

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
