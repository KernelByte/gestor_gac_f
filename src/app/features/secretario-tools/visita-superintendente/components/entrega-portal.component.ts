import {
  Component, Input, OnChanges, SimpleChanges, signal, computed,
  inject, ChangeDetectionStrategy, OnInit, OnDestroy, ElementRef,
  Injector, afterNextRender, viewChild, HostListener
} from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  EntregaPortalService,
  RegistrosOut, TotalesOut, ContactoPublicador, AsistenciaS88Out,
  DocumentoItem, PublicadorRegistro, GrupoRegistro, AgendaOut, AgendaItemPortal
} from '../services/entrega-portal.service';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { ThemeService } from '../../../../core/services/theme.service';
import { SECCIONES_CONFIG, SeccionConfig, SeccionGrupo } from './agenda-secciones.config';

type Seccion = 'registros' | 'totales' | 'contactos' | 'asistencia' | 'documentos' | 'agenda';

/** Tarjeta cargada en memoria para el visor: se descarga desde el mismo blob. */
interface TarjetaPreview {
  nombre: string;
  blob: Blob;
  /** URL cruda del blob, para el enlace de respaldo y para revocarla. */
  href: string;
  /** La misma URL saneada, que es lo que admite el [src] del iframe. */
  url: SafeResourceUrl;
}

/** Icono de cada sección del formulario en las tarjetas de "Detalles de la
 *  visita". Trazo de 1.75 para que se lean a 14px sin engordar la cabecera. */
const ICONO_SECCION_DEFECTO =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>';

const ICONOS_SECCION: Record<string, string> = {
  hospedaje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>',
  servicio_campo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>',
  estudios_superintendente: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>',
  estudios_esposa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/></svg>',
  almuerzos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M8 3v8a2 2 0 002 2h0a2 2 0 002-2V3M10 13v8M17 3c-1.105 0-2 1.79-2 4s.895 4 2 4 2-1.79 2-4-.895-4-2-4zm0 8v10"/></svg>',
  asuntos_ancianos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>',
  pastoreo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>',
  recomendaciones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
  remociones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM17 11h4"/></svg>',
};

@Component({
  standalone: true,
  selector: 'app-entrega-portal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe, NgTemplateOutlet, NgxEchartsDirective],
  template: `
<div class="portal-root" [class.is-interno]="modo === 'interno'">

  <!-- ───── NAV DE SECCIONES (compartida entre modo público e interno) ───── -->
  <ng-template #seccionNavTpl>
    <div class="seccion-nav-wrap"
         [class.overflow-inicio]="navPuedeIzq()"
         [class.overflow-fin]="navPuedeDer()">
      <button type="button" class="nav-scroll-btn nav-scroll-prev" tabindex="-1" aria-hidden="true"
        (click)="desplazarNav(-1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>

      <nav class="seccion-nav" role="tablist" #navSecciones (scroll)="recalcularNavOverflow()">
        @for (s of secciones(); track s.id) {
          <button type="button" role="tab" class="seccion-btn"
            [class.active]="seccionActiva() === s.id"
            [attr.aria-selected]="seccionActiva() === s.id"
            [attr.aria-label]="s.label"
            [title]="s.label"
            (click)="seccionCambio(s.id)">
            <span class="seccion-icon" [innerHTML]="s.icon"></span>
            <span class="seccion-label seccion-label-largo">{{ s.label }}</span>
            <span class="seccion-label seccion-label-corto" aria-hidden="true">{{ s.labelCorto }}</span>
          </button>
        }
      </nav>

      <button type="button" class="nav-scroll-btn nav-scroll-next" tabindex="-1" aria-hidden="true"
        (click)="desplazarNav(1)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
      </button>
    </div>
  </ng-template>

  <!-- ───── CABECERA PÚBLICA: la meta se desplaza con el scroll, solo las pestañas quedan fijas ───── -->
  @if (modo === 'publico') {
      <header class="portal-topbar">
        <div class="topbar-left">
          @if (metadata()) {
            <div class="meta-info">
              @if (metadata()!.nombre_congregacion) {
                <span class="meta-cong">{{ metadata()!.nombre_congregacion }}</span>
              }
              @if (metadata()!.nombre_superintendente) {
                <span class="meta-sep">·</span>
                <span class="meta-super">Hno. {{ metadata()!.nombre_superintendente }}</span>
              }
              @if (metadata()!.expira_en) {
                <span class="meta-sep">·</span>
                <span class="meta-expira">Expira {{ metadata()!.expira_en | date:'dd/MM/yyyy' }}</span>
              }
            </div>
          }
        </div>

        <div class="topbar-right">
          <div class="anio-servicio" title="Año de servicio: de septiembre a agosto">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span>Año de servicio <strong>{{ anioSel() }}</strong></span>
          </div>
          <button class="btn-zip" (click)="onDescargarZip()" [disabled]="descargandoZip()">
            @if (descargandoZip()) {
              <span class="spinner-sm"></span>
            } @else {
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
            }
            <span class="hidden sm:inline">Descargar todo</span>
            <span class="sm:hidden">ZIP</span>
          </button>
        </div>
      </header>
      @if (zipDownloadError()) {
        <div class="zip-error-banner" role="alert">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
          No se pudo generar el ZIP. Verifica tu conexión e intenta de nuevo.
        </div>
      }

      <ng-container [ngTemplateOutlet]="seccionNavTpl"></ng-container>
  }

  <!-- ───── NAVEGACIÓN DE SECCIONES (solo modo interno) ───── -->
  @if (modo === 'interno') {
    <ng-container [ngTemplateOutlet]="seccionNavTpl"></ng-container>
  }

  <!-- ───── CONTENIDO ───── -->
  <div class="seccion-content">

    <!-- Estado de carga -->
    @if (cargando()) {
      <div class="loading-state">
        <div class="loading-spinner"></div>
        <p class="loading-text">Cargando información…</p>
      </div>
    }

    <!-- Error -->
    @if (error() && !cargando()) {
      <div class="error-state">
        <svg class="w-8 h-8 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
        </svg>
        <p>{{ error() }}</p>
        <button class="btn-retry" (click)="reintentarCarga()" [attr.aria-label]="'Reintentar cargar ' + seccionActiva()">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Reintentar
        </button>
      </div>
    }

    <!-- ═══ SECCIÓN 1: REGISTROS DE PREDICACIÓN ═══ -->
    @if (seccionActiva() === 'registros' && !cargando() && registros()) {
      <div class="seccion-panel">
        <div class="registros-sticky-header">
          <div class="panel-header">
            <h2 class="panel-title">Registros de Predicación — {{ registros()!.anio }}</h2>
            <p class="panel-subtitle">Publicadores activos (por grupo y precursores) e inactivos</p>
          </div>

          <!-- Sub-tabs activos/precursores/inactivos -->
          <div class="sub-tabs">
          <button class="sub-tab" [class.active]="subTabRegistros() === 'activos'" (click)="subTabRegistros.set('activos')">
            Activos
            <span class="sub-count">{{ totalActivos() }}</span>
          </button>
          <button class="sub-tab" [class.active]="subTabRegistros() === 'prec_reg'" (click)="subTabRegistros.set('prec_reg')">
            Prec. Regulares
            <span class="sub-count">{{ totalPrecRegulares() }}</span>
          </button>
          <button class="sub-tab" [class.active]="subTabRegistros() === 'inactivos'" (click)="subTabRegistros.set('inactivos')">
            Inactivos
            <span class="sub-count">{{ registros()!.inactivos.length }}</span>
          </button>
        </div>

          <!-- Buscador + leyenda -->
          <div class="registros-toolbar">
            <div class="filtro-wrap">
              <svg class="filtro-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                class="filtro-input"
                placeholder="Buscar publicador…"
                [ngModel]="filtroPublicadores()"
                (ngModelChange)="filtroPublicadores.set($event)"
                aria-label="Buscar publicador"
              />
              @if (filtroPublicadores()) {
                <button class="filtro-clear" (click)="filtroPublicadores.set('')" aria-label="Limpiar búsqueda">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3.5 h-3.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              }
            </div>
            <div class="tabla-leyenda">
              <span class="leyenda-item">
                <span class="check-dot"></span> Participó
              </span>
              <!-- Los meses de auxiliar también se pintan en la pestaña de
                   precursores regulares (quien fue auxiliar antes de que lo
                   nombraran), así que la leyenda hace falta en las tres. -->
              <span class="leyenda-item">
                <span class="check-dot dot-aux"></span> Prec. auxiliar
              </span>
              <span class="leyenda-item leyenda-cred">
                <span class="cred-horas cred-sola">+h</span> Horas acreditadas (Betel, Salón de Asambleas)
              </span>
              @if (subTabRegistros() === 'prec_reg') {
                <span class="leyenda-item">
                  <span class="leyenda-caja-pre"></span> Antes del nombramiento
                </span>
                <!-- Sólo si alguien la tiene: en la mayoría de congregaciones
                     no hay ningún caso y la clave sería ruido permanente. -->
                @if (hayConsideraciones()) {
                  <span class="leyenda-item leyenda-consid">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round"
                            d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 000-7.8z"/>
                    </svg>
                    Sin requisito de horas
                  </span>
                }
              }
              @if (subTabRegistros() === 'activos') {
                <button type="button" class="btn-expandir-todos" (click)="toggleTodosGrupos()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5" aria-hidden="true">
                    @if (todosExpandidos()) {
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7 15l5-5 5 5"/>
                    } @else {
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7 9l5 5 5-5"/>
                    }
                  </svg>
                  {{ todosExpandidos() ? 'Contraer todo' : 'Expandir todo' }}
                </button>
              }
            </div>
          </div>
        </div><!-- /registros-sticky-header -->

        <!-- Publicadores por grupo (activos sin precursores regulares) -->
        @if (subTabRegistros() === 'activos') {
          @for (grupo of gruposActivosFiltrados(); track grupo.grupo_id) {
            <div class="grupo-section" [style.--i]="$index">
              <button
                type="button"
                class="grupo-header"
                [attr.aria-expanded]="grupoExpandido(grupo.grupo_id)"
                (click)="toggleGrupo(grupo.grupo_id)">
                <div class="flex items-center gap-3">
                  <div class="grupo-badge">{{ grupo.grupo_numero ?? '#' }}</div>
                  <span class="grupo-nombre">{{ grupo.grupo_nombre }}</span>
                  <span class="grupo-count">{{ grupo.publicadores.length }} pub.</span>
                </div>
                <svg
                  class="chevron"
                  [class.rotated]="grupoExpandido(grupo.grupo_id)"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              @if (grupoExpandido(grupo.grupo_id)) {
                <div class="grupo-tabla-wrap">
                  @if (modo === 'interno') {
                    <div class="grupo-acciones">
                      <button class="btn-descargar-grupo"
                        [disabled]="descargandoGrupo() === (grupo.grupo_id ?? 'sin-grupo')"
                        (click)="onDescargarGrupoActivos(grupo)">
                        @if (descargandoGrupo() === (grupo.grupo_id ?? 'sin-grupo')) {
                          <span class="spinner-sm"></span>
                        } @else {
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                          </svg>
                        }
                        Descargar tarjetas del grupo (PDF)
                      </button>
                    </div>
                  }
                  <ng-container *ngTemplateOutlet="tablaPublicadores; context: { pubs: grupo.publicadores, showTarjeta: true }">
                  </ng-container>
                </div>
              }
            </div>
          }
          @empty {
            <div class="empty-section">Sin publicadores activos registrados.</div>
          }
        }

        <!-- Precursores Regulares -->
        @if (subTabRegistros() === 'prec_reg') {
          @if (precRegPlanos().length > 0) {
            @if (modo === 'interno') {
              <div class="grupo-acciones mt-4">
                <button class="btn-descargar-grupo"
                  [disabled]="descargandoGrupo() === 'prec_reg'"
                  (click)="onDescargarGrupoPrecReg()">
                  @if (descargandoGrupo() === 'prec_reg') {
                    <span class="spinner-sm"></span>
                  } @else {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                  }
                  Descargar todas las tarjetas (PDF)
                </button>
              </div>
            }
            <div class="grupo-tabla-wrap mt-2">
              <ng-container *ngTemplateOutlet="tablaPublicadores; context: { pubs: precRegPlanos(), showHoras: true, showTarjeta: true }">
              </ng-container>
            </div>
          } @else {
            <div class="empty-section">Sin precursores regulares para este año.</div>
          }
        }

        <!-- Inactivos -->
        @if (subTabRegistros() === 'inactivos') {
          @if (registros()!.inactivos.length > 0) {
            @if (modo === 'interno') {
              <div class="grupo-acciones mt-4">
                <button class="btn-descargar-grupo"
                  [disabled]="descargandoGrupo() === 'inactivos'"
                  (click)="onDescargarGrupoInactivos()">
                  @if (descargandoGrupo() === 'inactivos') {
                    <span class="spinner-sm"></span>
                  } @else {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                  }
                  Descargar todas las tarjetas (PDF)
                </button>
              </div>
            }
            <div class="grupo-tabla-wrap mt-2">
              <ng-container *ngTemplateOutlet="tablaPublicadores; context: { pubs: registros()!.inactivos, showPriv: false, showTarjeta: true }">
              </ng-container>
            </div>
          } @else {
            <div class="empty-section">Sin publicadores inactivos en el sistema.</div>
          }
        }
      </div>
    }

    <!-- ═══ SECCIÓN 2: TOTALES POR GRUPO ═══ -->
    @if (seccionActiva() === 'totales' && !cargando() && totales()) {
      <div class="seccion-panel">
        <div class="panel-sticky-header">
          <div class="panel-header">
            <h2 class="panel-title">Totales — {{ totales()!.anio }}</h2>
            <p class="panel-subtitle">Resumen mensual consolidado por categoría</p>
          </div>
        </div>

        <div class="totales-grid">
          @for (tarjeta of tarjetasTotales(); track tarjeta.titulo) {
            <div class="tarjeta-total">
              <div class="tarjeta-titulo">{{ tarjeta.titulo }}</div>
              <div class="tabla-responsive">
                <table class="tabla-totales">
                  <thead>
                    <tr>
                      <th>Mes</th>
                      <th>Part.</th>
                      <th>Total</th>
                      <th>Cursos</th>
                      @if (tarjeta.titulo !== 'Total Publicadores') {
                        <th>Horas</th>
                      }
                    </tr>
                  </thead>
                  <tbody>
                    @for (fila of tarjeta.filas; track fila.mes) {
                      <tr [class.row-empty]="fila.participaciones === 0">
                        <td class="mes-cell">{{ fila.mes_nombre | slice:0:3 }}</td>
                        <td class="num-cell">{{ fila.participaciones || '—' }}</td>
                        <td class="num-cell">{{ fila.total_activos || '—' }}</td>
                        <td class="num-cell">{{ fila.cursos_biblicos || '—' }}</td>
                        @if (tarjeta.titulo !== 'Total Publicadores') {
                          <td class="num-cell">{{ fila.horas || '—' }}</td>
                        }
                      </tr>
                    }
                  </tbody>
                  <tfoot>
                    <tr class="total-row">
                      @if (tarjeta.titulo === 'Total Publicadores') {
                        <td colspan="3">Total</td>
                        <td>{{ tarjeta.total_cursos }}</td>
                      } @else {
                        <td colspan="3">Total</td>
                        <td>{{ tarjeta.total_cursos }}</td>
                        <td>{{ tarjeta.total_horas }}</td>
                      }
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          }
        </div>

        <!-- Gráficas resumen -->
        <div class="totales-charts-row">
          <div class="chart-panel">
            <p class="chart-panel-title">Promedio de horas — precursores</p>
            @if (totalesChartOptions().participacion) {
              <div echarts
                   [options]="totalesChartOptions().participacion!"
                   [autoResize]="true"
                   class="totales-chart-canvas"></div>
            }
          </div>
          <div class="chart-panel">
            <p class="chart-panel-title">Cursos bíblicos por mes</p>
            @if (totalesChartOptions().cursos) {
              <div echarts
                   [options]="totalesChartOptions().cursos!"
                   [autoResize]="true"
                   class="totales-chart-canvas"></div>
            }
          </div>
        </div>

      </div>
    }

    <!-- ═══ SECCIÓN 3: CONTACTOS ═══ -->
    @if (seccionActiva() === 'contactos' && !cargando() && !contactos() && errorContactos()) {
      <div class="error-state" role="alert">
        <svg class="w-8 h-8 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
        <p>{{ errorContactos() }}</p>
        <button class="btn-retry" (click)="reintentarContactos()" aria-label="Reintentar cargar contactos">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Reintentar
        </button>
      </div>
    }
    @if (seccionActiva() === 'contactos' && !cargando() && contactos()) {
      <div class="seccion-panel">
        <div class="panel-sticky-header">
          <div class="panel-header">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="panel-title">Contactos de Emergencia</h2>
                <p class="panel-subtitle">
                  {{ contactosFiltrados().length }}
                  @if (filtroContactos()) { resultado(s) de {{ contactos()!.length }} } @else { publicadores con contactos registrados }
                </p>
              </div>
              <button class="btn-download-s88" (click)="onDescargarContactosPdf()" [disabled]="descargandoContactosPdf()">
                @if (descargandoContactosPdf()) { <span class="spinner-sm"></span> } @else {
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/>
                  </svg>
                }
                Descargar PDF
              </button>
            </div>
          </div>
        </div>

        <!-- Buscador de contactos -->
        <div class="filtro-wrap filtro-standalone">
          <svg class="filtro-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            type="text"
            class="filtro-input"
            placeholder="Buscar por nombre…"
            [ngModel]="filtroContactos()"
            (ngModelChange)="filtroContactos.set($event)"
            aria-label="Buscar contacto"
          />
          @if (filtroContactos()) {
            <button class="filtro-clear" (click)="filtroContactos.set('')" aria-label="Limpiar búsqueda">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3.5 h-3.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          }
        </div>

        @if (contactosFiltrados().length === 0) {
          <div class="empty-section">
            @if (filtroContactos()) { Sin resultados para "{{ filtroContactos() }}". }
            @else { No hay contactos de emergencia registrados. }
          </div>
        }

        <div class="contactos-grid">
          @for (cp of contactosFiltrados(); track cp.id_publicador) {
            <div class="contacto-pub-card" [style.--i]="$index">
              <div class="contacto-pub-header">
                <div class="pub-avatar">{{ cp.nombre_publicador | slice:0:1 }}</div>
                <div class="pub-info">
                  <p class="pub-nombre">{{ cp.nombre_publicador }}</p>
                  @if (cp.telefono_publicador) {
                    <p class="pub-tel">
                      <svg class="w-3 h-3 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                      </svg>
                      {{ cp.telefono_publicador }}
                    </p>
                  }
                </div>
              </div>

              <div class="contactos-list">
                @for (c of cp.contactos; track c.id_contacto_emergencia) {
                  <div class="contacto-item">
                    <div class="contacto-item-top">
                      @if (c.parentesco && c.parentesco !== '-') {
                        <span class="parentesco-badge">{{ c.parentesco }}</span>
                      }
                      @if (c.es_principal) {
                        <span class="badge-principal">Principal</span>
                      }
                      @if (c.solo_urgencias) {
                        <span class="badge-urgencias">Solo urgencias</span>
                      }
                    </div>
                    <p class="contacto-nombre">{{ c.nombre }}</p>
                    @if (c.telefono) {
                      <p class="contacto-tel">
                        <svg class="w-3.5 h-3.5 inline mr-1 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                        </svg>
                        {{ c.telefono }}
                      </p>
                    }
                    @if (c.direccion) {
                      <p class="contacto-dir">
                        <svg class="w-3.5 h-3.5 inline mr-1 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                        </svg>
                        {{ c.direccion }}
                      </p>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
      </div>
    }

    <!-- ═══ SECCIÓN 4: ASISTENCIA S-88 ═══ -->
    @if (seccionActiva() === 'asistencia' && !cargando() && asistencia()) {
      <div class="seccion-panel">
        <div class="panel-sticky-header">
          <div class="panel-header">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 class="panel-title">Registro de Asistencia — S-88</h2>
                <p class="panel-subtitle">Reuniones entre semana y fin de semana</p>
              </div>
              <button class="btn-download-s88" (click)="onDescargarS88()" [disabled]="descargandoS88()">
                @if (descargandoS88()) { <span class="spinner-sm"></span> } @else {
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/>
                  </svg>
                }
                Descargar S-88 (PDF)
              </button>
            </div>
          </div>
        </div>

        <!-- Entre semana -->
        <div class="s88-section">
          <h3 class="s88-subtitle">Reunión de entre semana</h3>
          <ng-container *ngTemplateOutlet="tablaS88; context: { tipo: 'midweek' }"></ng-container>
        </div>

        <!-- Fin de semana -->
        <div class="s88-section mt-8">
          <h3 class="s88-subtitle">Reunión del fin de semana</h3>
          <ng-container *ngTemplateOutlet="tablaS88; context: { tipo: 'weekend' }"></ng-container>
        </div>
      </div>
    }

    <!-- ═══ SECCIÓN 5: DOCUMENTOS ═══ -->
    @if (seccionActiva() === 'documentos' && !cargando() && !documentos() && errorDocumentos()) {
      <div class="error-state" role="alert">
        <svg class="w-8 h-8 text-rose-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/></svg>
        <p>{{ errorDocumentos() }}</p>
        <button class="btn-retry" (click)="reintentarDocumentos()" aria-label="Reintentar cargar documentos">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Reintentar
        </button>
      </div>
    }
    @if (seccionActiva() === 'documentos' && !cargando() && documentos()) {
      <div class="seccion-panel">
        <div class="panel-header">
          <h2 class="panel-title">Documentos</h2>
          <p class="panel-subtitle">{{ documentos()!.length }} archivo(s) disponibles</p>
        </div>

        @if (documentos()!.length === 0) {
          <div class="empty-section">No hay documentos adjuntos en esta visita.</div>
        }

        <div class="docs-grid">
          @for (doc of documentos()!; track doc.nombre) {
            <div class="doc-card" [style.--i]="$index">
              <div class="doc-card-header">
                <div class="doc-icon" [class]="docIconClass(doc)">
                  @if (doc.tipo === 'pdf') {
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z M13 3v6h6"/>
                    </svg>
                  } @else if (doc.tipo === 'imagen') {
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                    </svg>
                  } @else if (isExcel(doc)) {
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M3 14h18M10 3v18M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                    </svg>
                  } @else {
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                  }
                </div>
                <div class="doc-meta">
                  <p class="doc-nombre">{{ doc.nombre }}</p>
                  <p class="doc-size">{{ doc.tamano_bytes | number:'1.0-0' }} KB</p>
                </div>
              </div>

              <!-- Botón de descarga.
                   En el portal público el token va en la URL y basta un enlace;
                   en modo interno el endpoint pide cabecera de autorización, que
                   una navegación del navegador no lleva, así que se baja por
                   HttpClient. -->
              @if (modo === 'publico') {
                <a [href]="doc.url" [download]="doc.nombre" class="btn-doc-download">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  {{ doc.tipo === 'word' ? 'Descargar Word' : 'Descargar' }}
                </a>
              } @else {
                <button type="button" class="btn-doc-download"
                        (click)="onDescargarDocumento(doc)"
                        [disabled]="docDescargando() === doc.nombre">
                  @if (docDescargando() === doc.nombre) {
                    <span class="spinner-sm"></span>
                  } @else {
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                    </svg>
                  }
                  {{ doc.tipo === 'word' ? 'Descargar Word' : 'Descargar' }}
                </button>
              }
            </div>
          }
        </div>
      </div>
    }

    <!-- ═══ SECCIÓN 6: AGENDA ═══ -->
    @if (seccionActiva() === 'agenda' && agenda()) {
      <div class="seccion-panel">

        @if (agenda()!.items.length) {
          <div class="panel-header">
            <h2 class="panel-title">{{ agenda()!.titulo || 'Agenda' }}</h2>
            <p class="panel-subtitle">Programa de actividades durante la visita</p>
          </div>

          <div class="agenda-table-wrap g-agenda">
            <table class="agenda-table">
              <thead>
                <tr>
                  <th class="th-dia">Día</th>
                  <th class="th-horario">Horario</th>
                  <th>Actividad</th>
                  <th class="th-responsable">Responsable</th>
                </tr>
              </thead>
              <tbody>
                @for (item of agendaItems(); track $index) {
                  <tr class="agenda-row" [class.agenda-separador-dia]="item.esSeparadorDia">
                    <td class="agenda-dia">
                      @if (item.semana) {
                        <span class="dia-semana">{{ item.semana }}</span>
                      }
                      <span class="dia-fecha">{{ item.fecha }}</span>
                      <span class="dia-fecha-corta">{{ item.fechaCorta }}</span>
                    </td>
                    <td class="agenda-horario">
                      @if (item.horario) {
                        <span class="horario-chip">{{ item.horario }}</span>
                      } @else {
                        <span class="celda-vacia" aria-label="Sin horario">—</span>
                      }
                    </td>
                    <td class="agenda-actividad">
                      {{ item.actividad }}
                      @if (item.lugar) {
                        <span class="agenda-lugar">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                          </svg>
                          {{ item.lugar }}
                        </span>
                      }
                      @if (item.notas) {
                        <span class="agenda-notas">{{ item.notas }}</span>
                      }
                      @if (item.responsable) {
                        <span class="agenda-responsable-movil">
                          <span class="resp-label">Responsable</span>{{ item.responsable }}
                        </span>
                      }
                    </td>
                    <td class="agenda-responsable">
                      @if (item.responsable) {
                        {{ item.responsable }}
                      } @else {
                        <span class="celda-vacia" aria-label="Sin responsable">—</span>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        @if (detalleFamilias().length) {
          <div class="detalles-wrap" [class.mt]="agenda()!.items.length > 0">
            @if (!agenda()!.items.length) {
              <div class="panel-header">
                <h2 class="panel-title">{{ agenda()!.titulo || 'Agenda' }}</h2>
                <p class="panel-subtitle">Detalles de la visita</p>
              </div>
            } @else {
              <h3 class="detalles-titulo">Detalles de la visita</h3>
            }

            @for (familia of detalleFamilias(); track familia.id) {
              <section class="detalles-familia" [class]="'g-' + familia.id">
                <header class="familia-head">
                  <h3 class="familia-nombre">{{ familia.label }}</h3>
                  <p class="familia-desc">{{ familia.desc }}</p>
                </header>

                <div class="familia-cards" [class.pocas]="familia.secciones.length < 3">
                  @for (sec of familia.secciones; track sec.id; let i = $index) {
                    <article class="detalle-card" [class.ancha]="sec.filas.length >= 4" [style.--i]="i">
                      <header class="detalle-head">
                        <span class="detalle-icono" [innerHTML]="sec.icono"></span>
                        <h4 class="detalle-titulo">{{ sec.label }}</h4>
                        @if (sec.filas.length > 1) {
                          <span class="detalle-conteo">{{ sec.filas.length }}</span>
                        }
                      </header>

                      <div class="detalle-cuerpo" [class.cuerpo-rejilla]="sec.filas.length >= 4">
                        @for (fila of sec.filas; track $index) {
                          <div class="detalle-entrada">
                            @if (fila.dia || fila.hora) {
                              <p class="entrada-cuando">
                                @if (fila.dia) { <span class="cuando-dia">{{ fila.dia }}</span> }
                                @if (fila.hora) { <span class="cuando-hora">{{ fila.hora }}</span> }
                              </p>
                            }

                            @if (fila.titulo) {
                              <p class="entrada-titulo">
                                {{ fila.titulo }}
                                @if (fila.insignia) {
                                  <span class="entrada-insignia">{{ fila.insignia }}</span>
                                }
                              </p>
                            }

                            @for (sub of fila.subtitulos; track sub.label) {
                              <p class="entrada-sub">
                                <span class="sub-label">{{ sub.label }}</span>{{ sub.valor }}
                              </p>
                            }

                            @if (fila.metas.length) {
                              <ul class="entrada-metas">
                                @for (meta of fila.metas; track meta.label) {
                                  <li class="meta" [class.meta-tel]="meta.tipo === 'tel'">
                                    @if (meta.tipo === 'tel') {
                                      <svg class="meta-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/>
                                      </svg>
                                    } @else {
                                      <svg class="meta-icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                                      </svg>
                                    }
                                    @if (meta.conEtiqueta) {
                                      <span class="meta-label">{{ meta.label }}</span>
                                    } @else {
                                      <span class="sr-only">{{ meta.label }}</span>
                                    }
                                    @if (meta.tel) {
                                      <a class="meta-valor meta-enlace" [href]="'tel:' + meta.tel">{{ meta.valor }}</a>
                                    } @else {
                                      <span class="meta-valor">{{ meta.valor }}</span>
                                    }
                                  </li>
                                }
                              </ul>
                            }

                            @for (nota of fila.notas; track nota.label) {
                              <div class="entrada-nota">
                                <p class="nota-label">{{ nota.label }}</p>
                                <p class="nota-valor">{{ nota.valor }}</p>
                              </div>
                            }

                            @if (fila.otros.length) {
                              <dl class="entrada-campos">
                                @for (campo of fila.otros; track campo.label) {
                                  <div class="campo">
                                    <dt>{{ campo.label }}</dt>
                                    <dd>{{ campo.valor }}</dd>
                                  </div>
                                }
                              </dl>
                            }

                            @if (fila.tarjeta; as t) {
                              <button type="button" class="btn-ver-tarjeta"
                                      (click)="onVerTarjeta(t.id, t.nombre)"
                                      [disabled]="descargandoTarjeta() === t.id"
                                      [attr.aria-label]="'Ver la tarjeta de ' + t.nombre">
                                @if (descargandoTarjeta() === t.id) {
                                  <span class="spinner-sm"></span>
                                } @else {
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="4" width="18" height="16" rx="2"/>
                                    <path stroke-linecap="round" d="M7 9h4M7 13h10M7 17h7"/>
                                  </svg>
                                }
                                Ver tarjeta del publicador
                              </button>
                            }
                          </div>
                        }
                      </div>
                    </article>
                  }
                </div>
              </section>
            }
          </div>
        }

      </div>
    }

  </div><!-- /seccion-content -->

  <!-- ───── TEMPLATES ───── -->

  <!-- Template: tabla de publicadores -->
  <ng-template #tablaPublicadores let-pubs="pubs" let-showPriv="showPriv" let-showHoras="showHoras" let-showTarjeta="showTarjeta">
    <div class="tabla-responsive">
      <table class="tabla-pubs">
        <thead>
          <tr>
            <th class="th-nombre th-sortable" (click)="sortBy('nombre')" title="Ordenar por nombre">
              Nombre
              <span class="sort-icon">
                @if (sortCol() === 'nombre') {
                  @if (sortDir() === 'desc') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3 h-3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  } @else {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3 h-3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
                  }
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3" style="opacity:0.35" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
                }
              </span>
            </th>
            @if (showPriv !== false) {
              <th class="th-priv">Privilegio</th>
            }
            @for (m of mesesHeaders(); track m.mes) {
              <th class="th-mes">{{ m.nombre | slice:0:3 }}</th>
            }
            <th class="th-total th-sortable" (click)="sortBy('horas')"
                [title]="showHoras ? 'Total de horas en los meses con el nombramiento de precursor vigente' : 'Total de horas en el año'">
              <span class="th-total-label">Horas</span>
              <span class="th-total-sub">{{ showHoras ? 'como prec.' : 'total' }}</span>
              <span class="sort-icon">
                @if (sortCol() === 'horas') {
                  @if (sortDir() === 'desc') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3 h-3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  } @else {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3 h-3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
                  }
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3" style="opacity:0.35" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
                }
              </span>
            </th>
            <th class="th-total th-sortable" (click)="sortBy('cursos')"
                [title]="showHoras ? 'Total de cursos bíblicos en los meses con el nombramiento de precursor vigente' : 'Total de cursos bíblicos en el año'">
              <span class="th-total-label">Cursos</span>
              <span class="th-total-sub">{{ showHoras ? 'como prec.' : 'total' }}</span>
              <span class="sort-icon">
                @if (sortCol() === 'cursos') {
                  @if (sortDir() === 'desc') {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3 h-3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  } @else {
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3 h-3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/></svg>
                  }
                } @else {
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3 h-3" style="opacity:0.35" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
                }
              </span>
            </th>
            @if (showTarjeta) {
              <th class="th-tarjeta"></th>
            }
          </tr>
        </thead>
        <tbody>
          @for (pub of filterAndSortPubs(pubs); track pub.id_publicador) {
            <tr class="pub-row">
              <td class="td-nombre">
                <div class="pub-nombre-cell">
                  <span class="pub-dot" [class]="'dot-' + (pub.privilegio_principal ? 'prec' : 'pub')"></span>
                  {{ pub.nombre_completo }}
                </div>
              </td>
              @if (showPriv !== false) {
                <td class="td-priv">
                  @if (pub.privilegio_principal) {
                    <span class="priv-chip" [title]="pub.privilegio_principal!">{{ privLabel(pub.privilegio_principal) }}</span>
                  }
                  @if (mesesAux(pub).length > 0) {
                    <span class="aux-chip" [title]="tooltipAux(pub)">Aux.</span>
                  }
                  @if (showHoras && inicioPregLabel(pub)) {
                    <!-- Nombrado a mitad del año: sin esto no hay forma de saber
                         desde qué mes los datos son de precursorado. -->
                    <span class="priv-desde" [title]="tooltipInicioPreg(pub)">desde {{ inicioPregLabel(pub) }}</span>
                  }
                  @if (pub.consideracion_motivo) {
                    <!-- Sin esta nota, los meses bajos de quien está exento del
                         requisito se leen como incumplimiento durante la visita.
                         Mismo registro discreto que "desde …": una línea gris
                         bajo el chip, sin caja ni color de alarma. -->
                    <span class="priv-consid" [title]="tooltipConsideracion(pub)">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 000-7.8z"/>
                      </svg>
                      consideración especial
                    </span>
                  }
                </td>
              }
              @for (h of pub.historial; track h.mes) {
                <td class="td-mes" [class.participo]="h.participo" [class.paux]="h.precursor_auxiliar"
                    [class.preg]="h.precursor_regular"
                    [class.pre-nombramiento]="showHoras && esMesFueraNombramiento(pub, h)"
                    [class.inicio-preg]="showHoras && esInicioNombramiento(pub, h)"
                    [title]="tituloMes(h, showHoras ? pub : null)">
                  @if (h.precursor_auxiliar && h.horas) {
                    <span class="aux-horas">{{ h.horas }}</span>
                    @if (h.horas_credito) { <span class="cred-horas">+{{ h.horas_credito }}</span> }
                  } @else if ((h.precursor_regular || showHoras) && h.participo && h.horas) {
                    <!-- Meses en que fue precursor (regular/especial/misionero):
                         se muestran las horas aunque la persona ya no lo sea hoy
                         y esté en la sección de publicadores — así queda claro
                         que esas horas son de precursor, no de un publicador. -->
                    <span class="prec-horas">{{ h.horas }}</span>
                    <!-- Horas acreditadas (Betel, Salón de Asambleas): ya van
                         en el total, pero verlas evita que la suma de la fila
                         parezca no cuadrar con los meses. -->
                    @if (h.horas_credito) { <span class="cred-horas">+{{ h.horas_credito }}</span> }
                  } @else if (h.horas_credito) {
                    <!-- Mes sin horas de campo pero con crédito: sin esto la
                         celda salía vacía y el total no se explicaba. -->
                    <span class="cred-horas cred-sola">+{{ h.horas_credito }}</span>
                  } @else if (h.participo) {
                    <span class="check-dot" [class.dot-aux]="h.precursor_auxiliar"></span>
                  }
                </td>
              }
              <!-- En la pestaña de precursores el total cuenta solo los meses
                   con el nombramiento vigente. -->
              <td class="td-total">{{ (showHoras && pub.preg_desde ? pub.total_horas_preg : pub.total_horas) || '—' }}</td>
              <td class="td-total">{{ (showHoras && pub.preg_desde ? pub.total_cursos_preg : pub.total_cursos) || '—' }}</td>
              @if (showTarjeta) {
                <td class="td-tarjeta">
                  <button class="btn-tarjeta"
                    [disabled]="descargandoTarjeta() === pub.id_publicador"
                    [title]="'Ver tarjeta de ' + pub.nombre_completo"
                    [attr.aria-label]="'Ver tarjeta de ' + pub.nombre_completo"
                    (click)="onDescargarTarjeta(pub)">
                    @if (descargandoTarjeta() === pub.id_publicador) {
                      <span class="spinner-sm"></span>
                    } @else {
                      <!-- Mismo icono que "Ver tarjeta" en la agenda: es la
                           misma acción sobre el mismo documento. -->
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
                        <rect x="3" y="4" width="18" height="16" rx="2"/>
                        <path stroke-linecap="round" d="M7 9h4M7 13h10M7 17h7"/>
                      </svg>
                    }
                  </button>
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  </ng-template>

  <!-- Template: tabla S-88 -->
  <ng-template #tablaS88 let-tipo="tipo">
    @if (asistencia()) {
      <div class="tabla-responsive">
        <table class="tabla-s88">
          <thead>
            <tr>
              <th class="th-mes-s88">{{ tipo === 'midweek' ? 'Año serv. ' + asistencia()!.ano_anterior.ano_servicio : 'Año serv. ' + asistencia()!.ano_anterior.ano_servicio }}</th>
              <th>N° reun.</th>
              <th>Asist. total</th>
              <th>Prom.</th>
              <th class="th-sep"></th>
              <th class="th-mes-s88">Año serv. {{ asistencia()!.ano_actual.ano_servicio }}</th>
              <th>N° reun.</th>
              <th>Asist. total</th>
              <th>Prom.</th>
            </tr>
          </thead>
          <tbody>
            @for (i of [0,1,2,3,4,5,6,7,8,9,10,11]; track i) {
              <tr>
                <td class="td-mes-s88">{{ asistencia()!.ano_anterior.meses[i].nombre_mes }}</td>
                <td class="td-num">{{ fmtS88(asistencia()!.ano_anterior.meses[i], tipo, 'reun') }}</td>
                <td class="td-num">{{ fmtS88(asistencia()!.ano_anterior.meses[i], tipo, 'total') }}</td>
                <td class="td-num">{{ fmtS88(asistencia()!.ano_anterior.meses[i], tipo, 'prom') }}</td>
                <td class="td-sep"></td>
                <td class="td-mes-s88">{{ asistencia()!.ano_actual.meses[i].nombre_mes }}</td>
                <td class="td-num">{{ fmtS88(asistencia()!.ano_actual.meses[i], tipo, 'reun') }}</td>
                <td class="td-num">{{ fmtS88(asistencia()!.ano_actual.meses[i], tipo, 'total') }}</td>
                <td class="td-num">{{ fmtS88(asistencia()!.ano_actual.meses[i], tipo, 'prom') }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr class="s88-total-row">
              <td colspan="3" class="text-right pr-2 font-semibold text-xs">Prom. mensual</td>
              <td class="td-num font-bold">{{ promS88(asistencia()!.ano_anterior, tipo) }}</td>
              <td></td>
              <td colspan="3" class="text-right pr-2 font-semibold text-xs">Prom. mensual</td>
              <td class="td-num font-bold">{{ promS88(asistencia()!.ano_actual, tipo) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    }
  </ng-template>

  <!-- ───── VISOR DE TARJETA ─────
       La tarjeta se consulta para decidir, no para archivarla: descargarla
       obligaba a salir del portal, abrir el archivo y volver. El visor la
       muestra en contexto y deja descargar sólo si de verdad hace falta. -->
  @if (tarjetaPreview(); as tp) {
    <div class="visor-overlay" (click)="cerrarTarjeta()">
      <div class="visor" role="dialog" aria-modal="true" [attr.aria-label]="'Tarjeta de ' + tp.nombre"
           (click)="$event.stopPropagation()">
        <header class="visor-head">
          <div class="visor-titulo">
            <h3>{{ tp.nombre }}</h3>
            <p>Registro de predicación · {{ anioSel() - 1 }}–{{ anioSel() }}</p>
          </div>
          <div class="visor-acciones">
            <button type="button" class="visor-btn" (click)="descargarTarjetaPreview()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
              </svg>
              Descargar
            </button>
            <button type="button" class="visor-btn visor-btn-icono" (click)="cerrarTarjeta()"
                    aria-label="Cerrar la tarjeta">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </header>
        <!-- iOS no renderiza PDF dentro de un iframe: allí el enlace de abajo
             es la única salida, por eso se muestra siempre y no como error. -->
        <iframe class="visor-doc" [src]="tp.url" [title]="'Tarjeta de ' + tp.nombre"></iframe>
        <footer class="visor-pie">
          <a class="visor-enlace" [href]="tp.href" target="_blank" rel="noopener">
            ¿No se ve la tarjeta? Ábrela en una pestaña nueva
          </a>
        </footer>
      </div>
    </div>
  }

</div>
  `,
  styles: [`
    :host {
      display: block;
      --brand: #6D28D9;
      --brand-light: #EDE9FE;
      --border: #e2e8f0;
      --bg: #ffffff;
      --bg-card: #ffffff;
      --bg-subtle: #f8fafc;
      --bg-inset: #f1f5f9;
      --text: #0f172a;
      --muted: #64748b;
      --radius: 0.875rem;
    }
    :host-context(.dark) {
      --brand: #a78bfa;
      --brand-light: rgba(109,40,217,0.18);
      --border: #334155;
      --bg: #0f172a;
      --bg-card: #1e293b;
      --bg-subtle: #0f172a;
      --bg-inset: #334155;
      --text: #f1f5f9;
      --muted: #94a3b8;
    }

    .portal-root { display: flex; flex-direction: column; min-height: 0; }
    .portal-root.is-interno { display: block; }

    /* En modo interno: el article padre tiene su propio scroll, por lo que la nav puede ser sticky dentro de él */
    .is-interno .seccion-nav-wrap {
      position: sticky;
      top: 0;
      z-index: 20;
      background: var(--bg-card);
      box-shadow: 0 2px 8px -4px rgba(0,0,0,0.10);
    }
    .is-interno .seccion-content { overflow-y: visible; flex: none; }
    .is-interno .registros-sticky-header,
    .is-interno .panel-sticky-header {
      position: sticky;
      top: 3rem;
      z-index: 15;
      background: var(--bg-subtle);
      margin: -1.5rem -1.5rem 0;
      padding: 1.5rem 1.5rem 0;
      padding-bottom: 0.75rem;
    }

    /* ── Cabecera pública: la meta se desplaza; solo la nav queda fija ── */
    .portal-root:not(.is-interno) .seccion-nav-wrap {
      position: sticky;
      top: 4rem;        /* justo debajo del header de página */
      z-index: 25;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      box-shadow: 0 2px 8px -6px rgba(0,0,0,0.12);
    }

    /* ── Topbar ── */
    .portal-topbar {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 0.75rem 1.25rem;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
      flex-shrink: 0;
    }
    .meta-info { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .meta-cong { font-weight: 700; font-size: 0.875rem; color: var(--text); }
    .meta-super { font-size: 0.8125rem; color: var(--muted); }
    .meta-sep { color: var(--muted); }
    .meta-expira { font-size: 0.75rem; color: #f59e0b; background: rgba(245,158,11,0.12); padding: 0.1rem 0.5rem; border-radius: 9999px; border: 1px solid rgba(245,158,11,0.3); }
    .topbar-right { display: flex; align-items: center; gap: 0.75rem; }

    .anio-servicio {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.375rem 0.75rem; font-size: 0.8125rem; font-weight: 600;
      border-radius: 0.5rem; border: 1px solid var(--border);
      color: var(--muted); background: var(--bg-subtle); white-space: nowrap;
    }
    .anio-servicio strong { color: var(--text); font-weight: 800; }
    .anio-servicio svg { color: var(--brand); flex-shrink: 0; }

    .btn-zip {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 1rem; font-size: 0.8125rem; font-weight: 600;
      background: var(--brand); color: #fff; border-radius: 0.625rem;
      border: none; cursor: pointer; transition: background 160ms;
      min-height: 2.5rem;
    }
    .btn-zip:hover:not(:disabled) { background: #5B21B6; }
    .btn-zip:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Navegación de secciones ── */
    /* El wrapper es el contenedor de consulta: las pestañas se compactan según
       el ancho REAL disponible (no el del viewport), que es lo que cambia al
       abrir/cerrar el sidebar o al usar pantallas de 13-14". */
    .seccion-nav-wrap {
      position: relative;
      display: flex; align-items: stretch;
      min-width: 0;
      container-type: inline-size;
      container-name: seccionnav;
    }
    .seccion-nav {
      display: flex; gap: 0; overflow-x: auto; overflow-y: hidden;
      scrollbar-width: none;
      background: transparent;  /* el fondo lo da sticky-header-band o is-interno */
      flex: 1 1 auto; min-width: 0;
      min-height: 3rem;
      scroll-behavior: smooth;
      scroll-snap-type: x proximity;
      -webkit-overflow-scrolling: touch;
      overscroll-behavior-x: contain;
    }
    .seccion-nav::-webkit-scrollbar { display: none; }
    .seccion-btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 1rem clamp(0.75rem, 2cqi, 1.25rem);
      font-size: 0.875rem; font-weight: 600;
      color: var(--muted); border-bottom: 2px solid transparent;
      white-space: nowrap; cursor: pointer; flex-shrink: 0;
      transition: color 160ms, border-color 160ms, background 160ms, padding 160ms;
      min-height: 3rem;
      scroll-snap-align: start;
    }

    /* Flechas de desplazamiento: solo aparecen si de verdad hay contenido oculto */
    .nav-scroll-btn {
      position: absolute; top: 0; bottom: 0; width: 2.5rem;
      display: none; align-items: center; justify-content: center;
      border: none; padding: 0; cursor: pointer; z-index: 3;
      color: var(--text);
    }
    .nav-scroll-btn svg { width: 1rem; height: 1rem; }
    .nav-scroll-prev {
      left: 0;
      background: linear-gradient(to right, var(--bg-card) 55%, transparent);
      justify-content: flex-start; padding-left: 0.25rem;
    }
    .nav-scroll-next {
      right: 0;
      background: linear-gradient(to left, var(--bg-card) 55%, transparent);
      justify-content: flex-end; padding-right: 0.25rem;
    }
    .seccion-nav-wrap.overflow-inicio .nav-scroll-prev { display: flex; }
    .seccion-nav-wrap.overflow-fin .nav-scroll-next { display: flex; }
    /* Reserva de espacio para que la flecha no tape la última pestaña */
    .seccion-nav-wrap.overflow-fin .seccion-nav { padding-right: 2rem; }
    .seccion-nav-wrap.overflow-inicio .seccion-nav { padding-left: 2rem; }
    .seccion-btn.active { color: var(--brand); border-bottom-color: var(--brand); }
    .seccion-btn:hover:not(.active) { color: var(--text); background: var(--bg-subtle); }
    .seccion-icon { display: inline-flex; width: 1.125rem; height: 1.125rem; }
    .seccion-icon svg { width: 1.125rem; height: 1.125rem; }

    /* ── Contenido ── */
    /* En modo público el scroll es del documento; en interno es del contenedor padre */
    .seccion-content { flex: 1; overflow-y: visible; background: var(--bg-subtle); padding: 1.5rem; }
    .is-interno .seccion-content { overflow-y: visible; }
    /* 1200px dejaba ~40% de pantalla vacía en un portátil de 16"; el portal es
       denso en datos (tablas y fichas), no texto corrido, así que aguanta más
       ancho sin perder legibilidad. */
    .seccion-panel { max-width: 1400px; margin: 0 auto; }

    .panel-header { margin-bottom: 1.5rem; }
    .panel-title { font-size: 1.25rem; font-weight: 700; color: var(--text); margin-bottom: 0.25rem; }
    .panel-subtitle { font-size: 0.875rem; color: var(--muted); }

    /* ── Loading / Error / Empty ── */
    .loading-state, .error-state, .empty-section {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; padding: 3rem 1.5rem; color: var(--muted); font-size: 0.9375rem;
      gap: 0.75rem;
    }
    .loading-spinner {
      width: 2.5rem; height: 2.5rem; border-radius: 50%;
      border: 3px solid var(--border); border-top-color: var(--brand);
      animation: spin 700ms linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .spinner-sm {
      width: 0.875rem; height: 0.875rem; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff;
      animation: spin 600ms linear infinite; display: inline-block;
    }
    .error-state { color: #be123c; }

    .zip-error-banner {
      display: flex; align-items: center; gap: 0.5rem;
      margin: 0.5rem 1.5rem; padding: 0.625rem 0.875rem;
      background: #fff1f2; border: 1px solid #fecdd3;
      border-radius: 0.625rem; color: #be123c;
      font-size: 0.8125rem; font-weight: 500;
      animation: panelIn 200ms ease-out both;
    }
    :host-context(.dark) .zip-error-banner {
      background: rgba(190,18,60,0.12); border-color: rgba(190,18,60,0.3); color: #fca5a5;
    }

    /* ── Sub-tabs ── */
    .sub-tabs {
      display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap;
    }
    .sub-tab {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.5rem 1rem; font-size: 0.8125rem; font-weight: 600;
      border-radius: 9999px; border: 1px solid var(--border);
      color: var(--muted); background: var(--bg-card); cursor: pointer;
      transition: all 160ms;
    }
    .sub-tab.active { background: var(--brand-light); color: var(--brand); border-color: #c4b5fd; }
    .sub-count {
      display: inline-flex; align-items: center; justify-content: center;
      min-width: 1.25rem; height: 1.25rem; padding: 0 0.3rem;
      font-size: 0.65rem; font-weight: 700; border-radius: 9999px;
      background: rgba(109,40,217,0.1); color: var(--brand);
    }
    .sub-tab.active .sub-count { background: var(--brand); color: #fff; }

    /* ── Grupos ── */
    .grupo-section {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      margin-bottom: 0.75rem; overflow: hidden;
    }
    .grupo-header {
      width: 100%; display: flex; align-items: center; justify-content: space-between;
      padding: 0.875rem 1.25rem; cursor: pointer; background: var(--bg-card);
      transition: background 150ms;
    }
    .grupo-header:hover { background: var(--bg-subtle); }
    .grupo-badge {
      width: 2rem; height: 2rem; border-radius: 0.5rem;
      background: var(--brand-light); color: var(--brand);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 0.875rem;
    }
    .grupo-nombre { font-weight: 700; font-size: 0.9375rem; color: var(--text); }
    .grupo-count { font-size: 0.75rem; color: var(--muted); padding: 0.125rem 0.5rem; background: var(--bg-inset); border-radius: 9999px; }
    .chevron { width: 1rem; height: 1rem; color: var(--muted); transition: transform 200ms; }
    .chevron.rotated { transform: rotate(180deg); }

    .grupo-tabla-wrap { overflow-x: auto; }

    /* La tabla de publicadores desplaza en su propio contenedor para que el
       encabezado (meses, horas, cursos) quede fijo en listas largas. */
    .grupo-tabla-wrap .tabla-responsive {
      overflow: auto;
      max-height: max(22rem, calc(100dvh - 15rem));
    }

    /* ── Tabla publicadores ── */
    .tabla-responsive { overflow-x: auto; }
    .tabla-pubs {
      width: 100%; border-collapse: collapse; font-size: 0.8125rem;
    }
    .tabla-pubs th {
      padding: 0.5rem 0.625rem; background: var(--bg-subtle);
      font-weight: 700;
      color: var(--muted); text-transform: uppercase; font-size: 0.65rem;
      letter-spacing: 0.05em; white-space: nowrap;
      /* Encabezado fijo dentro del contenedor con scroll propio. El borde
         inferior va como sombra: con border-collapse el borde no acompaña
         al sticky y desaparecería al desplazar. */
      position: sticky; top: 0; z-index: 3;
      border-bottom: none;
      box-shadow: inset 0 -2px 0 var(--border);
    }
    .tabla-pubs td {
      padding: 0.5rem 0.625rem; border-bottom: 1px solid var(--border);
      vertical-align: middle;
    }
    .pub-row { transition: background 120ms; }
    .pub-row:hover { background: var(--brand-light); }
    .pub-row:hover .td-nombre { background: var(--brand-light); }
    .pub-nombre-cell { display: flex; align-items: center; gap: 0.5rem; min-width: 160px; }
    .pub-dot { width: 0.5rem; height: 0.5rem; border-radius: 9999px; flex-shrink: 0; }
    .dot-prec { background: #8b5cf6; }
    .dot-pub  { background: #94a3b8; }
    /* Celda esquina: fija en ambos ejes (arriba + izquierda) */
    .th-nombre { position: sticky; left: 0; top: 0; z-index: 4; background: var(--bg-subtle); }
    .td-nombre { min-width: 180px; font-weight: 600; color: var(--text); position: sticky; left: 0; z-index: 1; background: var(--bg-card); }
    .td-priv { white-space: nowrap; }
    .priv-chip {
      font-size: 0.625rem; font-weight: 700; padding: 0.125rem 0.4rem;
      border-radius: 9999px; background: var(--brand-light); color: var(--brand);
      text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;
    }
    .th-mes, .td-mes { width: 1.75rem; min-width: 2.75rem; text-align: center; padding: 0.5rem 0.375rem !important; }
    .td-mes.participo { background: rgba(16,185,129,0.12); }
    .td-mes.paux { background: rgba(234,179,8,0.15); }
    /* Meses de precursor regular/especial/misionero: verde más marcado que la
       participación normal, para leer de un vistazo qué meses fueron de
       precursor aunque hoy la persona ya no lo sea. */
    .td-mes.preg { background: rgba(16,185,129,0.22); }
    .check-dot { display: inline-block; width: 0.5rem; height: 0.5rem; border-radius: 9999px; background: #10b981; }
    .check-dot.dot-aux { background: #eab308; }
    .aux-horas { font-size: 0.6875rem; font-weight: 700; color: #b45309; font-variant-numeric: tabular-nums; }
    :host-context(.dark) .aux-horas { color: #fbbf24; }
    .prec-horas { font-size: 0.6875rem; font-weight: 700; color: #10b981; font-variant-numeric: tabular-nums; }
    :host-context(.dark) .prec-horas { color: #34d399; }
    /* Horas de crédito: en volado y más pequeñas que las de campo. Suman al
       total, pero no son horas de predicación y no deben leerse como tales. */
    .cred-horas {
      font-size: 0.5rem; font-weight: 600; color: #0d9488;
      font-variant-numeric: tabular-nums; vertical-align: super;
      margin-left: 0.05rem;
    }
    /* Sin horas de campo delante, deja de ser un añadido y ocupa la celda. */
    .cred-sola { font-size: 0.625rem; vertical-align: baseline; margin-left: 0; }
    :host-context(.dark) .cred-horas { color: #5eead4; }
    /* Meses anteriores al nombramiento de precursor regular: en gris neutro y
       fuera del total de la columna Horas. El :not(.paux) deja intactos los
       meses de auxiliar — su ámbar es lo que identifica esas horas. */
    .td-mes.pre-nombramiento:not(.paux) { background: rgba(100,116,139,0.13); }
    :host-context(.dark) .td-mes.pre-nombramiento:not(.paux) { background: rgba(15,23,42,0.6); }
    .td-mes.pre-nombramiento:not(.paux) .prec-horas { color: var(--muted); font-weight: 500; }
    .td-mes.pre-nombramiento:not(.paux) .check-dot { background: var(--muted); }
    /* Línea que marca el primer mes con el nombramiento vigente. */
    .td-mes.inicio-preg { box-shadow: inset 2px 0 0 var(--brand); }
    .priv-desde {
      display: block; font-size: 0.5625rem; color: var(--muted);
      white-space: nowrap; margin-top: 0.15rem; font-variant-numeric: tabular-nums;
    }
    /* Mismo peso visual que .priv-desde: es una anotación al pie del chip, no
       un estado que compita con él. Sólo se tiñe de teal para separarla del
       gris de la fecha; el icono la hace legible sin depender del color. */
    .priv-consid {
      display: inline-flex; align-items: center; gap: 0.2rem;
      font-size: 0.5625rem; color: #0f766e;
      white-space: nowrap; margin-top: 0.15rem;
    }
    .priv-consid svg { width: 0.5625rem; height: 0.5625rem; flex: none; }
    :host-context(.dark) .priv-consid { color: #5eead4; }
    /* Color sólido equivalente al de la celda ya compuesta sobre --bg-card: la
       muestra vive sobre otro fondo, así que la capa translúcida daría un tono
       distinto al que se ve en la tabla. */
    .leyenda-caja-pre {
      display: inline-block; width: 0.6rem; height: 0.6rem; border-radius: 0.15rem;
      background: #ebedf0; border: 1px solid var(--border);
    }
    :host-context(.dark) .leyenda-caja-pre { background: #151e31; }
    .th-total { white-space: nowrap; vertical-align: bottom; }
    .th-total-label { display: block; line-height: 1.2; }
    .th-total-sub { display: block; font-size: 0.6rem; font-weight: 400; opacity: 0.5; text-transform: lowercase; letter-spacing: 0.02em; line-height: 1; margin-bottom: 0.1rem; }
    .th-sortable { cursor: pointer; user-select: none; white-space: nowrap; }
    .th-sortable:hover { color: #818cf8; }
    .sort-icon { font-size: 0.65rem; margin-left: 0.15rem; opacity: 0.6; vertical-align: middle; }
    .th-sortable:hover .sort-icon { opacity: 1; }
    .grupo-acciones {
      display: flex; align-items: center; justify-content: flex-end;
      padding: 0.5rem 0.25rem 0.25rem;
    }
    .btn-descargar-grupo {
      display: inline-flex; align-items: center; gap: 0.4rem;
      font-size: 0.75rem; font-weight: 600; padding: 0.35rem 0.85rem;
      border-radius: 0.5rem; border: 1px solid rgba(99,102,241,0.35);
      background: rgba(99,102,241,0.08); color: #818cf8; cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .btn-descargar-grupo:hover:not(:disabled) { background: rgba(99,102,241,0.18); border-color: rgba(99,102,241,0.6); }
    .btn-descargar-grupo:disabled { opacity: 0.5; cursor: not-allowed; }
    :host-context(:not(.dark)) .btn-descargar-grupo { color: #4f46e5; border-color: rgba(79,70,229,0.3); background: rgba(79,70,229,0.06); }
    :host-context(:not(.dark)) .btn-descargar-grupo:hover:not(:disabled) { background: rgba(79,70,229,0.12); }
    .th-tarjeta { width: 2rem; padding: 0; }
    .td-tarjeta { width: 2rem; padding: 0.25rem; text-align: center; }
    .btn-tarjeta {
      display: inline-flex; align-items: center; justify-content: center;
      width: 2.75rem; height: 2.75rem; border-radius: 0.5rem; border: none;
      background: transparent; color: #6b7280; cursor: pointer; transition: background 0.15s, color 0.15s;
    }
    .btn-tarjeta:hover:not(:disabled) { background: rgba(99,102,241,0.12); color: #818cf8; }
    .btn-tarjeta:disabled { opacity: 0.5; cursor: not-allowed; }
    :host-context(.dark) .btn-tarjeta { color: #9ca3af; }
    .aux-chip {
      font-size: 0.625rem; font-weight: 700; padding: 0.125rem 0.4rem; margin-left: 0.25rem;
      border-radius: 9999px; background: rgba(234,179,8,0.15); color: #b45309;
      text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; cursor: default;
    }
    :host-context(.dark) .aux-chip { color: #fbbf24; }
    .th-total { text-align: center; min-width: 3.5rem; color: var(--muted); }
    .td-total { text-align: center; min-width: 3.5rem; color: var(--muted); font-variant-numeric: tabular-nums; }

    /* ── Totales ── */
    .totales-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; }
    .tarjeta-total {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: hidden;
    }
    .tarjeta-titulo {
      padding: 0.875rem 1.25rem; font-weight: 700; font-size: 0.9375rem;
      color: var(--text); border-bottom: 1px solid var(--border);
      background: var(--brand-light);
    }
    .tabla-totales {
      width: 100%; border-collapse: collapse; font-size: 0.8125rem;
    }
    .tabla-totales th {
      padding: 0.5rem 0.75rem; background: var(--bg-subtle);
      border-bottom: 2px solid var(--border); font-weight: 700;
      color: var(--muted); font-size: 0.65rem; text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .tabla-totales td { padding: 0.4375rem 0.75rem; border-bottom: 1px solid var(--border); }
    .mes-cell { font-weight: 600; color: var(--text); }
    .num-cell { text-align: right; font-variant-numeric: tabular-nums; color: var(--muted); }
    .row-empty td { color: var(--muted); opacity: 0.5; }
    .total-row td {
      font-weight: 700; color: var(--text); border-top: 2px solid var(--border);
      background: var(--bg-subtle); text-align: right;
    }
    .total-row td:first-child { text-align: left; }

    /* ── Charts ── */
    .totales-charts-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 2rem; margin-bottom: 0.5rem;
    }
    @media (max-width: 640px) { .totales-charts-row { grid-template-columns: 1fr; } }
    .chart-panel {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      padding: 0.875rem 1rem 0.5rem;
    }
    .chart-panel-title {
      font-size: 0.75rem; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.05em; color: var(--muted); margin-bottom: 0.5rem;
    }
    .totales-chart-canvas { width: 100%; height: 210px; }

    /* ── Contactos ── */
    .contactos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .contacto-pub-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: hidden;
    }
    .contacto-pub-header {
      display: flex; align-items: center; gap: 0.75rem;
      padding: 0.875rem 1rem; border-bottom: 1px solid var(--border);
      background: var(--bg-subtle);
    }
    .pub-avatar {
      width: 2.25rem; height: 2.25rem; border-radius: 9999px;
      background: var(--brand); color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 0.875rem; flex-shrink: 0;
    }
    .pub-nombre { font-weight: 700; font-size: 0.875rem; color: var(--text); }
    .pub-tel { font-size: 0.75rem; color: var(--muted); }
    .contactos-list { padding: 0.75rem; display: flex; flex-direction: column; gap: 0.625rem; }
    .contacto-item {
      padding: 0.625rem; background: var(--bg-subtle); border-radius: 0.625rem;
      border: 1px solid var(--border);
    }
    .contacto-item-top { display: flex; align-items: center; gap: 0.375rem; flex-wrap: wrap; margin-bottom: 0.25rem; }
    .parentesco-badge {
      font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.4rem;
      border-radius: 9999px; background: var(--bg-inset); color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .badge-principal { font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 9999px; background: rgba(21,128,61,0.15); color: #16a34a; }
    .badge-urgencias { font-size: 0.65rem; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 9999px; background: rgba(146,64,14,0.15); color: #d97706; }
    .contacto-nombre { font-weight: 700; font-size: 0.875rem; color: var(--text); }
    .contacto-tel, .contacto-dir { font-size: 0.8125rem; color: var(--muted); margin-top: 0.125rem; }

    /* ── Asistencia S-88 ── */
    .s88-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .s88-subtitle { font-weight: 700; font-size: 1rem; color: var(--text); padding: 0.875rem 1.25rem; border-bottom: 1px solid var(--border); background: var(--brand-light); }
    .tabla-s88 { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
    .tabla-s88 th {
      padding: 0.5rem 0.625rem; background: var(--bg-subtle);
      border-bottom: 2px solid var(--border); font-weight: 700;
      color: var(--muted); font-size: 0.65rem; text-transform: uppercase;
      letter-spacing: 0.04em; text-align: center;
    }
    .th-mes-s88 { text-align: left !important; min-width: 100px; }
    .th-sep { width: 0.75rem; background: transparent; border: none !important; }
    .tabla-s88 td { padding: 0.4375rem 0.625rem; border-bottom: 1px solid var(--border); }
    .td-mes-s88 { font-weight: 600; color: var(--text); }
    .td-num { text-align: center; font-variant-numeric: tabular-nums; color: var(--muted); }
    .td-sep { background: var(--bg-subtle); }
    .s88-total-row td { font-weight: 700; background: var(--bg-subtle); border-top: 2px solid var(--border); }
    .btn-download-s88 {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5625rem 1.125rem; font-size: 0.8125rem; font-weight: 600;
      border: 1px solid #c4b5fd; color: var(--brand); border-radius: 0.625rem;
      background: var(--brand-light); cursor: pointer; transition: all 160ms;
    }
    .btn-download-s88:hover:not(:disabled) { background: var(--brand); color: #fff; border-color: var(--brand); }
    .btn-download-s88:disabled { opacity: 0.5; cursor: not-allowed; }

    /* ── Documentos ── */
    .docs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
    .doc-card {
      background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
      overflow: hidden; display: flex; flex-direction: column;
    }
    .doc-card-header { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.875rem 1rem; }
    .doc-icon {
      width: 2.5rem; height: 2.5rem; border-radius: 0.625rem;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .doc-icon-pdf { background: rgba(239,68,68,0.12); color: #ef4444; }
    .doc-icon-imagen { background: rgba(234,179,8,0.12); color: #ca8a04; }
    .doc-icon-excel { background: rgba(34,197,94,0.12); color: #16a34a; }
    .doc-icon-word { background: rgba(37,99,235,0.12); color: #2563eb; }
    .doc-icon-otro { background: var(--bg-inset); color: var(--muted); }
    .doc-nombre { font-weight: 600; font-size: 0.875rem; color: var(--text); word-break: break-all; }
    .doc-size { font-size: 0.75rem; color: var(--muted); margin-top: 0.125rem; }
    .btn-doc-download {
      display: flex; align-items: center; justify-content: center; gap: 0.5rem;
      padding: 0.625rem; font-size: 0.8125rem; font-weight: 600;
      color: var(--brand); background: var(--brand-light); border-top: 1px solid var(--border);
      text-decoration: none; transition: background 150ms; margin-top: auto;
    }
    .btn-doc-download:hover { background: var(--brand); color: #fff; }

    /* ── Agenda ──
       La tabla es la cuarta familia del mismo sistema que las tarjetas de
       "Detalles": el violeta de la marca con la misma receta de tinte y borde
       que hospitalidad, ministerio y ancianos. Se distingue por ser tabla y por
       su color, no por tener un lenguaje visual aparte. */
    .g-agenda {
      --sec: #6d28d9; --sec-tinte: rgba(109,40,217,0.09); --sec-borde: rgba(109,40,217,0.22);
      --sec-hover: rgba(109,40,217,0.045);
    }
    /* Exactamente el mismo violeta que .g-ancianos: dos violetas distintos en la
       misma página se leen como un descuido, no como dos categorías. */
    :host-context(.dark) .g-agenda {
      --sec: #a78bfa; --sec-tinte: rgba(167,139,250,0.10); --sec-borde: rgba(167,139,250,0.24);
      --sec-hover: rgba(167,139,250,0.055);
    }

    .agenda-table-wrap {
      overflow-x: auto; border-radius: var(--radius);
      border: 1px solid var(--border); background: var(--bg-card);
    }
    .agenda-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }

    /* Misma banda que la cabecera de una tarjeta de sección (.detalle-head):
       tinte de la familia, borde a juego y rótulo diminuto en versalitas. */
    .agenda-table thead th {
      padding: 0.5rem 0.875rem;
      background: var(--sec-tinte); color: var(--sec);
      border-bottom: 1px solid var(--sec-borde);
      font-weight: 800; font-size: 0.6875rem;
      text-transform: uppercase; letter-spacing: 0.06em;
      white-space: nowrap; text-align: left;
    }
    .agenda-table td {
      padding: 0.75rem 0.875rem; border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    .agenda-row:last-child td { border-bottom: none; }
    .agenda-row { transition: background 140ms ease-out; }
    .agenda-row:hover { background: var(--sec-hover); }

    /* Día, horario y responsable se encogen a su contenido; el ancho sobrante
       se lo queda la actividad, que es el texto que puede crecer. */
    .th-dia, .th-horario, .th-responsable { width: 1%; }

    /* Día y hora repiten el par .cuando-dia / .cuando-hora de las tarjetas:
       versalitas en el color de la familia y la hora en píldora teñida. */
    .agenda-dia { white-space: nowrap; }
    .dia-semana {
      font-size: 0.6875rem; font-weight: 800; color: var(--sec);
      text-transform: uppercase; letter-spacing: 0.07em;
    }
    .dia-semana::after { content: ' · '; color: var(--muted); font-weight: 400; letter-spacing: 0; }
    .dia-fecha { font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
    .dia-fecha-corta { display: none; }

    .agenda-horario { white-space: nowrap; }
    .horario-chip {
      display: inline-block; padding: 0.0625rem 0.375rem; border-radius: 0.375rem;
      background: var(--sec-tinte); color: var(--sec);
      font-size: 0.6875rem; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .celda-vacia { color: var(--muted); opacity: 0.45; }

    .agenda-actividad { color: var(--text); font-weight: 600; line-height: 1.4; }
    .agenda-responsable { color: var(--muted); white-space: nowrap; }
    /* Mismo tratamiento que .meta en las tarjetas: icono en el color de la
       familia y el valor a continuación. flex, no inline-flex, para que caiga
       en su propia línea bajo la actividad. */
    .agenda-lugar {
      display: flex; align-items: center; gap: 0.3125rem; width: fit-content;
      margin-top: 0.25rem; font-size: 0.75rem; font-weight: 500; color: var(--muted);
    }
    .agenda-lugar svg {
      width: 0.8125rem; height: 0.8125rem; flex: none;
      color: var(--sec); opacity: 0.85;
    }
    .agenda-notas {
      display: block; font-size: 0.75rem; font-weight: 400;
      color: var(--muted); margin-top: 0.1875rem;
    }

    /* Fila que solo marca el cambio de día: banda, no fila de datos. */
    .agenda-separador-dia td { background: var(--bg-inset); }
    .agenda-separador-dia .dia-fecha { font-weight: 800; }

    /* En móvil el responsable pasa dentro de la actividad en vez de
       desaparecer: la tabla cabe en 3 columnas sin perder el dato. */
    .agenda-responsable-movil { display: none; }
    .resp-label { color: var(--muted); font-size: 0.6875rem; }
    .resp-label::after { content: ' · '; }
    @media (max-width: 640px) {
      .agenda-table th:nth-child(4), .agenda-table td:nth-child(4) { display: none; }
      .agenda-responsable-movil {
        display: block; margin-top: 0.1875rem;
        font-size: 0.75rem; font-weight: 500; color: var(--text);
      }
      /* "Martes 4 de agosto del 2026" en una línea no cabe: el día pasa arriba
         como etiqueta y la fecha, abreviada, debajo. Así la tabla no desborda
         ni parte la fecha en cuatro líneas. */
      .agenda-table th, .agenda-table td { padding-left: 0.625rem; padding-right: 0.625rem; }
      .dia-semana {
        display: block; font-size: 0.625rem;
        text-transform: uppercase; letter-spacing: 0.06em;
      }
      .dia-semana::after { content: none; }
      .dia-fecha { display: none; }
      .dia-fecha-corta {
        display: block; font-size: 0.75rem; font-weight: 600;
        color: var(--text); font-variant-numeric: tabular-nums;
      }
    }

    /* ── Detalles de la visita (secciones del formulario, solo lectura) ──
       Tres familias de color, no nueve: el superintendente busca "dónde como y
       duermo", "qué hago en el ministerio" y "qué trato con los ancianos". El
       icono y el título distinguen las secciones dentro de cada familia. */
    .g-hospitalidad { --sec: #b45309; --sec-tinte: rgba(180,83,9,0.09); --sec-borde: rgba(180,83,9,0.22); }
    .g-ministerio   { --sec: #047857; --sec-tinte: rgba(4,120,87,0.09);  --sec-borde: rgba(4,120,87,0.22); }
    .g-ancianos     { --sec: #6d28d9; --sec-tinte: rgba(109,40,217,0.09); --sec-borde: rgba(109,40,217,0.22); }
    :host-context(.dark) .g-hospitalidad { --sec: #fbbf24; --sec-tinte: rgba(251,191,36,0.10); --sec-borde: rgba(251,191,36,0.24); }
    :host-context(.dark) .g-ministerio   { --sec: #34d399; --sec-tinte: rgba(52,211,153,0.10); --sec-borde: rgba(52,211,153,0.24); }
    :host-context(.dark) .g-ancianos     { --sec: #a78bfa; --sec-tinte: rgba(167,139,250,0.10); --sec-borde: rgba(167,139,250,0.24); }

    .detalles-wrap.mt { margin-top: 2.5rem; }
    .detalles-titulo {
      font-size: 0.75rem; font-weight: 700; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 1.25rem;
    }

    /* Una banda por familia temática. Antes las nueve secciones caían en una
       sola multicolumna y hospedaje, estudios y remociones quedaban vecinas sin
       relación; ahora cada familia es un bloque con su encabezado y el lector
       sabe siempre en qué está. */
    .detalles-familia + .detalles-familia { margin-top: 2.25rem; }
    .familia-head {
      display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.25rem 0.75rem;
      padding-bottom: 0.5rem; margin-bottom: 1.125rem;
      border-bottom: 1px solid var(--sec-borde);
    }
    .familia-nombre {
      font-size: 0.8125rem; font-weight: 800; color: var(--sec);
      text-transform: uppercase; letter-spacing: 0.07em;
    }
    .familia-desc { font-size: 0.75rem; color: var(--muted); }

    /* Rejilla con align-items:start: cada tarjeta conserva su alto natural en
       vez de estirarse hasta la más alta de su fila. Las secciones largas ya no
       compiten aquí —salen a ancho completo (.ancha)— así que lo que queda en
       la rejilla son tarjetas cortas y de alto parecido. */
    .familia-cards {
      display: grid; grid-template-columns: 1fr;
      gap: 1.25rem; align-items: start;
    }
    @media (min-width: 768px) { .familia-cards { grid-template-columns: repeat(2, 1fr); } }
    @media (min-width: 1200px) { .familia-cards:not(.pocas) { grid-template-columns: repeat(3, 1fr); } }

    .detalle-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); overflow: hidden;
    }
    .detalle-head {
      display: flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 0.875rem;
      background: var(--sec-tinte); border-bottom: 1px solid var(--sec-borde);
    }
    /* El SVG entra por [innerHTML] y no lleva el atributo de encapsulación, así
       que el tamaño se fija también en el span (mismo patrón que .seccion-icon). */
    .detalle-icono {
      display: inline-flex; flex-shrink: 0;
      width: 0.9375rem; height: 0.9375rem; color: var(--sec);
    }
    .detalle-icono svg { width: 0.9375rem; height: 0.9375rem; }
    .detalle-titulo {
      font-size: 0.6875rem; font-weight: 800; color: var(--sec);
      text-transform: uppercase; letter-spacing: 0.06em; line-height: 1.3;
    }
    .detalle-conteo {
      margin-left: auto; flex-shrink: 0;
      font-size: 0.625rem; font-weight: 800; color: var(--sec);
      background: var(--sec-borde); border-radius: 9999px;
      min-width: 1.125rem; padding: 0.0625rem 0.375rem; text-align: center;
      font-variant-numeric: tabular-nums;
    }

    .detalle-cuerpo { padding: 0.875rem; }
    .detalle-cuerpo:not(.cuerpo-rejilla) .detalle-entrada + .detalle-entrada {
      margin-top: 0.875rem; padding-top: 0.875rem; border-top: 1px solid var(--border);
    }

    /* Una sección con muchas entradas (servicio del campo, almuerzos, pastoreo)
       necesita ancho, no alto: apilarlas en una columna estrecha dejaba la
       tarjeta larguísima y las vecinas rodeadas de vacío. Ocupa la banda
       entera y reparte sus entradas en rejilla. */
    .detalle-card.ancha { grid-column: 1 / -1; }
    .detalle-cuerpo.cuerpo-rejilla {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
      gap: 1.125rem 1.75rem; align-items: start;
    }
    /* Apiladas en una columna el espacio ya no basta para separar entradas:
       se fija una sola columna (sin depender de auto-fit) y vuelve la línea. */
    @media (max-width: 700px) {
      .detalle-cuerpo.cuerpo-rejilla { grid-template-columns: 1fr; row-gap: 0; }
      .cuerpo-rejilla .detalle-entrada + .detalle-entrada {
        margin-top: 0.875rem; padding-top: 0.875rem; border-top: 1px solid var(--border);
      }
    }

    /* Cuándo → qué/quién → con quién → cómo llegar. El "cuándo" va en pequeño y
       en el color de la familia; el peso tipográfico lo reserva el título. */
    .entrada-cuando {
      display: flex; align-items: center; flex-wrap: wrap; gap: 0.375rem;
      margin-bottom: 0.3125rem;
    }
    .cuando-dia {
      font-size: 0.6875rem; font-weight: 800; color: var(--sec);
      text-transform: uppercase; letter-spacing: 0.07em;
    }
    .cuando-hora {
      font-size: 0.6875rem; font-weight: 700; color: var(--sec);
      background: var(--sec-tinte); border-radius: 0.3125rem;
      padding: 0.0625rem 0.375rem; font-variant-numeric: tabular-nums;
    }

    .entrada-titulo {
      font-size: 0.9375rem; font-weight: 700; color: var(--text);
      line-height: 1.35; word-break: break-word;
    }
    .entrada-insignia {
      display: inline-block; vertical-align: 0.1em; margin-left: 0.4375rem;
      font-size: 0.625rem; font-weight: 700; color: var(--sec);
      background: var(--sec-tinte); border: 1px solid var(--sec-borde);
      border-radius: 9999px; padding: 0.0625rem 0.4375rem;
      text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap;
    }

    /* Etiqueta en línea, no encima: "Anfitrión · Jorge Luis Ricardo" ocupa una
       línea donde antes iban dos y sigue diciendo quién es esa persona. */
    .entrada-sub {
      font-size: 0.8125rem; color: var(--text); line-height: 1.4;
      margin-top: 0.1875rem; word-break: break-word;
    }
    .sub-label {
      color: var(--muted); font-size: 0.6875rem;
    }
    .sub-label::after { content: ' · '; }

    .entrada-metas {
      display: flex; flex-wrap: wrap; gap: 0.25rem 0.875rem;
      margin-top: 0.4375rem;
    }
    .meta {
      display: flex; align-items: flex-start; gap: 0.3125rem;
      min-width: 0; font-size: 0.75rem; color: var(--muted); line-height: 1.4;
    }
    .meta-icono {
      width: 0.8125rem; height: 0.8125rem; flex: none;
      margin-top: 0.125rem; color: var(--sec); opacity: 0.85;
    }
    .meta-label { color: var(--muted); }
    .meta-label::after { content: ' '; }
    .meta-valor { color: var(--text); font-weight: 600; word-break: break-word; }
    .meta-tel .meta-valor { font-variant-numeric: tabular-nums; }
    /* El teléfono es el dato que se usa para actuar: marcar desde el móvil. */
    .meta-enlace { text-decoration: none; }
    .meta-enlace:hover { color: var(--sec); text-decoration: underline; }
    .meta-enlace:focus-visible { outline: 2px solid var(--sec); outline-offset: 2px; border-radius: 0.25rem; }

    .entrada-nota { margin-top: 0.5rem; }
    .nota-label {
      font-size: 0.625rem; font-weight: 700; color: var(--muted);
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .nota-valor {
      font-size: 0.8125rem; color: var(--text); line-height: 1.45;
      margin-top: 0.0625rem; word-break: break-word;
    }

    /* Resto de campos sin rol asignado: etiqueta + valor, como antes. */
    .entrada-campos {
      display: grid; gap: 0.5rem 0.875rem; margin-top: 0.5rem;
      grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
    }
    .campo { min-width: 0; }
    .entrada-campos dt { font-size: 0.6875rem; color: var(--muted); line-height: 1.3; }
    .entrada-campos dd {
      font-size: 0.8125rem; font-weight: 600; color: var(--text);
      line-height: 1.35; word-break: break-word;
    }

    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }

    .btn-ver-tarjeta {
      display: inline-flex; align-items: center; gap: 0.375rem;
      margin-top: 0.625rem; padding: 0.3125rem 0.625rem;
      font-size: 0.6875rem; font-weight: 700; color: var(--sec);
      background: var(--sec-tinte); border: 1px solid var(--sec-borde);
      border-radius: 0.5rem; cursor: pointer; white-space: nowrap;
      transition: background 160ms, color 160ms, transform 120ms;
    }
    .btn-ver-tarjeta svg { width: 0.8125rem; height: 0.8125rem; flex-shrink: 0; }
    .btn-ver-tarjeta:hover:not(:disabled) { background: var(--sec); color: #fff; }
    .btn-ver-tarjeta:active:not(:disabled) { transform: scale(0.97); }
    .btn-ver-tarjeta:disabled { opacity: 0.6; cursor: progress; }

    /* ── Retry button ── */
    .btn-retry {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 0.5rem 1.125rem; font-size: 0.8125rem; font-weight: 600;
      border: 1px solid var(--border); border-radius: 0.625rem;
      background: var(--bg-card); color: var(--muted); cursor: pointer;
      transition: all 160ms; margin-top: 0.5rem;
    }
    .btn-retry:hover { color: var(--brand); border-color: var(--brand); background: var(--brand-light); }

    /* ── dot-aux: diamond shape para distinción sin depender solo del color (a11y) ── */
    .check-dot.dot-aux {
      background: #eab308;
      border-radius: 2px;
      transform: rotate(45deg);
    }
    :host-context(.dark) .check-dot.dot-aux { background: #ca8a04; }

    /* ── Leyenda de Registros ── */
    .registros-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      gap: 1rem; flex-wrap: wrap; padding-bottom: 0.875rem;
    }
    .tabla-leyenda {
      display: flex; align-items: center; gap: 0.875rem; flex-wrap: wrap;
      font-size: 0.6875rem; color: var(--muted); flex-shrink: 0;
    }
    /* ── Visor de tarjeta ─────────────────────────────────────────────── */
    .visor-overlay {
      position: fixed; inset: 0; z-index: 100;
      display: flex; align-items: center; justify-content: center;
      padding: clamp(0.5rem, 3vw, 2rem);
      /* Scrim opaco: el PDF es blanco y necesita separarse del fondo. */
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(2px);
      animation: visor-fade 160ms ease-out;
    }
    .visor {
      display: flex; flex-direction: column;
      width: min(60rem, 100%); height: min(92dvh, 100%);
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: var(--radius); overflow: hidden;
      box-shadow: 0 20px 50px -12px rgba(0, 0, 0, 0.4);
      animation: visor-in 180ms cubic-bezier(0.25, 1, 0.5, 1);
    }
    .visor-head {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 0.75rem 0.9rem; border-bottom: 1px solid var(--border);
      background: var(--bg-subtle); flex: none;
    }
    .visor-titulo { min-width: 0; }
    .visor-titulo h3 {
      margin: 0; font-size: 0.875rem; font-weight: 700; color: var(--text);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .visor-titulo p { margin: 0.1rem 0 0; font-size: 0.6875rem; color: var(--muted); }
    .visor-acciones { display: flex; align-items: center; gap: 0.4rem; flex: none; }
    .visor-btn {
      display: inline-flex; align-items: center; gap: 0.35rem;
      /* 44 px de alto: el portal se usa también en tablet. */
      min-height: 2.75rem; padding: 0 0.75rem;
      border: 1px solid var(--border); border-radius: 0.5rem;
      background: var(--bg-card); color: var(--text);
      font-size: 0.75rem; font-weight: 600; cursor: pointer;
      transition: border-color 140ms ease-out, color 140ms ease-out;
    }
    .visor-btn svg { width: 0.875rem; height: 0.875rem; flex: none; }
    .visor-btn:hover { border-color: var(--brand); color: var(--brand); }
    .visor-btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
    .visor-btn-icono { min-width: 2.75rem; padding: 0; justify-content: center; }
    .visor-doc { flex: 1 1 auto; width: 100%; border: 0; background: var(--bg-inset); }
    .visor-pie {
      flex: none; padding: 0.5rem 0.9rem; border-top: 1px solid var(--border);
      background: var(--bg-subtle); text-align: center;
    }
    .visor-enlace { font-size: 0.6875rem; color: var(--muted); text-decoration: underline; }
    .visor-enlace:hover { color: var(--brand); }

    @keyframes visor-fade { from { opacity: 0; } to { opacity: 1; } }
    @keyframes visor-in {
      from { opacity: 0; transform: translateY(0.5rem) scale(0.985); }
      to   { opacity: 1; transform: none; }
    }
    @media (prefers-reduced-motion: reduce) {
      .visor-overlay, .visor { animation: none; }
    }

    .leyenda-item { display: inline-flex; align-items: center; gap: 0.3rem; white-space: nowrap; }
    .leyenda-consid { color: #0f766e; }
    .leyenda-consid svg { width: 0.65rem; height: 0.65rem; flex: none; }
    :host-context(.dark) .leyenda-consid { color: #5eead4; }
    .leyenda-num {
      font-size: 0.6875rem; font-weight: 700; font-variant-numeric: tabular-nums;
      padding: 0 0.25rem; border-radius: 3px;
    }
    .leyenda-num-verde { color: #10b981; background: rgba(16,185,129,0.12); }
    .leyenda-num-amber { color: #b45309; background: rgba(234,179,8,0.12); }
    :host-context(.dark) .leyenda-num-verde { color: #34d399; }
    :host-context(.dark) .leyenda-num-amber { color: #fbbf24; }

    /* ── Filtro/buscador ── */
    .filtro-wrap {
      position: relative; display: flex; align-items: center;
      flex: 1; min-width: 180px; max-width: 300px;
    }
    .filtro-wrap.filtro-standalone {
      max-width: 340px; margin-bottom: 1.125rem;
    }
    .filtro-icon {
      position: absolute; left: 0.625rem; width: 1rem; height: 1rem;
      color: var(--muted); pointer-events: none; flex-shrink: 0;
    }
    .filtro-input {
      width: 100%; padding: 0.5rem 2rem 0.5rem 2.125rem;
      font-size: 0.8125rem; border: 1px solid var(--border);
      border-radius: 0.625rem; background: var(--bg-card); color: var(--text);
      outline: none; transition: border-color 160ms, box-shadow 160ms;
    }
    .filtro-input::placeholder { color: var(--muted); }
    .filtro-input:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px rgba(109,40,217,0.12);
    }
    :host-context(.dark) .filtro-input:focus {
      box-shadow: 0 0 0 3px rgba(167,139,250,0.18);
    }
    .filtro-clear {
      position: absolute; right: 0.375rem;
      display: grid; place-items: center;
      width: 2rem; height: 2rem; border-radius: 9999px;
      border: none; background: transparent; color: var(--muted);
      cursor: pointer; transition: background 150ms, color 150ms;
    }
    .filtro-clear:hover { background: var(--border); color: var(--text); }

    /* ── btn-zip refinado en dark ── */
    :host-context(.dark) .btn-zip {
      background: #7c3aed;
      box-shadow: 0 0 0 1px rgba(167,139,250,0.25);
    }
    :host-context(.dark) .btn-zip:hover:not(:disabled) { background: #6d28d9; }

    /* ── btn-download-s88 refinado en dark ── */
    :host-context(.dark) .btn-download-s88 {
      background: rgba(109,40,217,0.22);
      border-color: rgba(167,139,250,0.35);
    }
    :host-context(.dark) .btn-download-s88:hover:not(:disabled) {
      background: var(--brand);
      color: #fff;
      border-color: var(--brand);
    }

    /* ─────────── Adaptación móvil (≤640px) ─────────── */
    @media (max-width: 640px) {
      /* Padding lateral más ajustado */
      .seccion-content { padding: 0.75rem 0.875rem; }

      /* Panel header compacto: ocultar subtítulo redundante */
      .panel-header { margin-bottom: 0.5rem; }
      .panel-title { font-size: 0.9375rem; line-height: 1.3; font-weight: 700; }
      .panel-subtitle { display: none; }

      /* En modo interno: desplazar sticky para no solapar con el botón "Volver" (~2.5rem) */
      .is-interno .seccion-nav-wrap { top: 2.5rem; }

      /* Sticky headers internos: alinear márgenes negativos al nuevo padding */
      .is-interno .registros-sticky-header,
      .is-interno .panel-sticky-header {
        top: 5.5rem; /* Volver 2.5rem + seccion-nav 3rem */
        margin: -0.75rem -0.875rem 0;
        padding: 0.75rem 0.875rem 0.625rem;
      }

      /* Sub-tabs en una sola fila horizontal sin wrap */
      .sub-tabs {
        flex-wrap: nowrap;
        gap: 0.375rem;
        margin-bottom: 0.625rem;
        overflow-x: auto;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }
      .sub-tabs::-webkit-scrollbar { display: none; }
      .sub-tab {
        padding: 0.4375rem 0.75rem;
        font-size: 0.75rem;
        min-height: 2.25rem;
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* Topbar pública: meta arriba, acciones en una fila completa abajo */
      .portal-topbar { padding: 0.625rem 0.875rem; gap: 0.625rem; }
      .topbar-right { width: 100%; justify-content: space-between; }
      .anio-servicio { flex: 1; justify-content: center; }
      .btn-zip { flex-shrink: 0; }

      /* Grupos y tablas a todo el ancho disponible */
      .grupo-section { border-radius: 0.75rem; }
      .grupo-header { padding: 0.875rem 1rem; }
      .grupo-nombre { font-size: 0.875rem; }
      .seccion-btn { padding: 0.875rem 1rem; }

      /* Gráficas más bajas para no empujar el contenido */
      .totales-chart-canvas { height: 180px; }

      /* Toolbar de registros: apilar en columna */
      .registros-toolbar { flex-direction: column; align-items: flex-start; gap: 0.625rem; }
      .filtro-wrap { max-width: 100%; min-width: 0; width: 100%; }
      .filtro-wrap.filtro-standalone { max-width: 100%; }
      .tabla-leyenda { gap: 0.625rem; }
    }

    /* ─────────── Pestañas de sección: compactación progresiva ───────────
       Se basa en el ancho disponible del contenedor, no del viewport, para que
       las 6 secciones quepan sin scroll en portátiles de 13-14" y con el
       sidebar abierto. Va al final para ganar a los @media anteriores.
       El aria-label del botón siempre lleva la etiqueta completa, así que
       acortar el texto visible no afecta a lectores de pantalla. */
    .seccion-label-corto { display: none; }

    @container seccionnav (max-width: 1150px) {
      .seccion-btn { font-size: 0.8125rem; gap: 0.4375rem; padding: 1rem 0.875rem; }
      .seccion-icon, .seccion-icon svg { width: 1rem; height: 1rem; }
    }

    /* Ya no caben los nombres completos → etiquetas cortas ("Registros",
       "Totales"…), que siguen siendo legibles y caben las 6 sin scroll. */
    @container seccionnav (max-width: 980px) {
      .seccion-btn { padding: 1rem 0.75rem; }
      .seccion-label-largo { display: none; }
      .seccion-label-corto { display: inline; }
    }

    /* Muy estrecho (móvil): solo iconos, salvo la pestaña activa. */
    @container seccionnav (max-width: 620px) {
      .seccion-btn { padding: 1rem 0.6875rem; min-width: 2.75rem; justify-content: center; }
      .seccion-btn:not(.active) .seccion-label { display: none; }
      .seccion-btn:not(.active) { gap: 0; }
    }

    /* ─────────── Movimiento: entradas suaves con cascada ─────────── */
    @keyframes panelIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes tablaIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: none; }
    }
    .seccion-panel {
      animation: panelIn 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .grupo-section, .contacto-pub-card, .doc-card, .detalle-card {
      animation: panelIn 300ms cubic-bezier(0.16, 1, 0.3, 1) both;
      animation-delay: calc(min(var(--i, 0), 8) * 45ms);
    }
    .grupo-tabla-wrap {
      animation: tablaIn 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
      transform-origin: top;
    }
    /* Feedback táctil en controles */
    .btn-zip:active:not(:disabled),
    .btn-download-s88:active:not(:disabled),
    .btn-doc-download:active,
    .sub-tab:active,
    .btn-retry:active { transform: scale(0.97); }
    .grupo-header:active { background: var(--bg-inset); }
    .btn-zip, .btn-download-s88, .btn-doc-download, .sub-tab, .btn-retry {
      transition-property: background, color, border-color, transform;
      transition-duration: 160ms;
    }

    /* ── Botón expandir/contraer todos los grupos ── */
    .btn-expandir-todos {
      display: inline-flex; align-items: center; gap: 0.3rem;
      padding: 0.3rem 0.7rem; font-size: 0.6875rem; font-weight: 600;
      border-radius: 9999px; border: 1px solid var(--border);
      background: var(--bg-card); color: var(--muted); cursor: pointer;
      transition: color 160ms, border-color 160ms, background 160ms, transform 120ms;
      white-space: nowrap;
    }
    .btn-expandir-todos:hover { color: var(--brand); border-color: var(--brand); background: var(--brand-light); }
    .btn-expandir-todos:active { transform: scale(0.96); }

    /* ── Meta compacta en móvil: una sola línea con truncado ── */
    @media (max-width: 640px) {
      .topbar-left { width: 100%; min-width: 0; }
      .meta-info { flex-wrap: nowrap; min-width: 0; }
      .meta-cong, .meta-super {
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        min-width: 0;
      }
      .meta-cong { flex-shrink: 1; }
      .meta-super { flex-shrink: 2; }
      .meta-sep { flex-shrink: 0; }
      .meta-expira { flex-shrink: 0; margin-left: auto; }
    }

    @media (prefers-reduced-motion: reduce) {
      .seccion-nav { scroll-behavior: auto; }
      .seccion-btn { transition: none; }
      .seccion-panel, .grupo-section, .contacto-pub-card, .doc-card, .detalle-card,
      .grupo-tabla-wrap, .zip-error-banner { animation: none; }
      .btn-zip:active:not(:disabled), .btn-download-s88:active:not(:disabled),
      .btn-doc-download:active, .sub-tab:active, .btn-retry:active,
      .btn-expandir-todos:active { transform: none; }
    }
  `],
})
export class EntregaPortalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() modo: 'publico' | 'interno' = 'publico';
  @Input() token: string = '';
  @Input() idVisita: number = 0;

  private svc = inject(EntregaPortalService);
  private injector = inject(Injector);
  private sanitizer = inject(DomSanitizer);
  theme = inject(ThemeService);

  // ── Nav de secciones: desbordamiento horizontal ─────────────────────────────
  navSecciones = viewChild<ElementRef<HTMLElement>>('navSecciones');
  navPuedeIzq = signal(false);
  navPuedeDer = signal(false);
  private navRO?: ResizeObserver;

  // ── Estado ──────────────────────────────────────────────────────────────────
  seccionActiva = signal<Seccion>('registros');
  subTabRegistros = signal<'activos' | 'prec_reg' | 'inactivos'>('activos');
  anioSel = signal<number>(new Date().getFullYear());
  cargando = signal(false);
  error = signal<string | null>(null);
  errorContactos = signal<string | null>(null);
  errorDocumentos = signal<string | null>(null);
  zipDownloadError = signal(false);
  filtroContactos = signal('');
  filtroPublicadores = signal('');
  descargandoZip = signal(false);
  descargandoS88 = signal(false);
  descargandoContactosPdf = signal(false);
  descargandoTarjeta = signal<number | null>(null);
  /** Nombre del documento que se está bajando en modo interno, o null. */
  docDescargando = signal<string | null>(null);
  /** Tarjeta abierta en el visor; null cuando está cerrado. */
  tarjetaPreview = signal<TarjetaPreview | null>(null);
  descargandoGrupo = signal<number | string | null>(null);
  sortCol = signal<'horas' | 'cursos' | 'nombre' | null>(null);
  sortDir = signal<'asc' | 'desc'>('desc');

  registros = signal<RegistrosOut | null>(null);
  totales = signal<TotalesOut | null>(null);
  contactos = signal<ContactoPublicador[] | null>(null);
  asistencia = signal<any | null>(null);
  documentos = signal<DocumentoItem[] | null>(null);
  agenda = signal<AgendaOut | null>(null);
  metadata = signal<any | null>(null);

  private static readonly DIAS_SEMANA_LARGOS =
    ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  /**
   * "2026-08-04" → { semana: 'Martes', fecha: '4 de agosto del 2026' }.
   *
   * El día es texto libre: el editor guarda ISO, pero hay agendas viejas con la
   * fecha escrita a mano. Si no se encuentra una fecha se devuelve el texto tal
   * cual en vez de inventarse una.
   */
  private formatearDia(dia: string): { semana: string; fecha: string; fechaCorta: string } {
    const texto = (dia ?? '').toString().trim();
    const m = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return { semana: '', fecha: texto, fechaCorta: texto };

    // Constructor numérico, no `new Date('2026-08-04')`: esa forma se interpreta
    // en UTC y en Colombia (UTC-5) retrocede un día al pasar a local.
    const fecha = new Date(+m[1], +m[2] - 1, +m[3]);
    if (Number.isNaN(fecha.getTime())) return { semana: '', fecha: texto, fechaCorta: texto };

    const semana = EntregaPortalComponent.DIAS_SEMANA_LARGOS[fecha.getDay()];
    const dd = fecha.getDate();
    const anio = fecha.getFullYear();
    return {
      semana: semana.charAt(0).toUpperCase() + semana.slice(1),
      fecha: `${dd} de ${EntregaPortalComponent.MESES_LARGOS[fecha.getMonth()]} del ${anio}`,
      // En móvil la forma larga se parte en cuatro líneas y estira la fila.
      fechaCorta: `${dd} ${EntregaPortalComponent.MESES_CORTOS[fecha.getMonth()]} ${anio}`,
    };
  }

  /**
   * Lee una hora en cualquiera de las formas que guarda el editor ("19:00",
   * "7:00 pm", "19:00:00") y la deja en horas y minutos, o null si no la
   * reconoce. Separado del formateo porque el rango necesita comparar los dos
   * extremos antes de decidir cómo se escriben.
   */
  private parsearHora(hora?: string | null): { h: number; m: number } | null {
    const texto = (hora ?? '').toString().trim();
    if (!texto) return null;
    const m = texto.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:([ap])\.?\s*m\.?)?$/i);
    if (!m) return null;

    let h = +m[1];
    const min = +m[2];
    const meridiano = m[3]?.toLowerCase();
    if (meridiano === 'p' && h < 12) h += 12;
    if (meridiano === 'a' && h === 12) h = 0;
    return h > 23 || min > 59 ? null : { h, m: min };
  }

  /** { h: 19, m: 0 } → "7:00 p.m.". Con `conMeridiano` en false, "7:00". */
  private formatearHora12(t: { h: number; m: number }, conMeridiano = true): string {
    const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
    const reloj = `${h12}:${String(t.m).padStart(2, '0')}`;
    return conMeridiano ? `${reloj} ${t.h < 12 ? 'a.m.' : 'p.m.'}` : reloj;
  }

  /** Hora suelta a 12 h; lo que no reconozca lo deja intacto. */
  private horaLegible(hora?: string | null): string {
    const t = this.parsearHora(hora);
    return t ? this.formatearHora12(t) : (hora ?? '').toString().trim();
  }

  /**
   * Une inicio y fin en un solo horario. Cuando ambos caen en la misma mitad
   * del día el a.m./p.m. se dice una sola vez ("7:00 – 8:30 p.m."): repetirlo
   * alarga el chip sin aportar nada.
   */
  private formatearHorario(inicio?: string | null, fin?: string | null): string {
    const crudoIni = (inicio ?? '').toString().trim();
    const crudoFin = (fin ?? '').toString().trim();
    const ini = this.parsearHora(crudoIni);
    const finT = this.parsearHora(crudoFin);

    const mismaMitad = !!ini && !!finT && (ini.h < 12) === (finT.h < 12);
    const textoIni = ini ? this.formatearHora12(ini, !mismaMitad) : crudoIni;
    const textoFin = finT ? this.formatearHora12(finT) : crudoFin;
    return [textoIni, textoFin].filter(Boolean).join(' – ');
  }

  /**
   * Filas de la tabla de agenda ya formateadas. Inicio y fin se juntan en un
   * solo horario: la columna "Fin" estaba vacía en casi todas las agendas y
   * gastaba un quinto de la tabla en pintar guiones.
   */
  agendaItems = computed(() =>
    (this.agenda()?.items ?? []).map(item => {
      const { semana, fecha, fechaCorta } = this.formatearDia(item.dia);
      return {
        semana,
        fecha,
        fechaCorta,
        horario: this.formatearHorario(item.hora_inicio, item.hora_fin),
        actividad: (item.actividad ?? '').trim(),
        lugar: (item.lugar ?? '').trim(),
        notas: (item.notas ?? '').trim(),
        responsable: (item.responsable ?? '').trim(),
        // Fila que solo marca el cambio de día, sin actividad ni hora.
        esSeparadorDia: !item.hora_inicio && !(item.actividad ?? '').trim(),
      };
    })
  );

  /**
   * "Detalles de la visita" listos para pintar: mismas secciones y etiquetas
   * que el editor del secretario, sin campos vacíos.
   *
   * El día y la hora se sacan de la lista de campos y se suben a la cabecera de
   * cada entrada: son lo que convierte una ficha de datos en una agenda, y así
   * el superintendente ubica "cuándo" de un vistazo sin leer etiquetas.
   *
   * El resto de campos se reparte según su `rol` (ver agenda-secciones.config):
   * un título, un subtítulo por contacto, los teléfonos y direcciones como meta
   * con icono, y las notas largas al final. Antes todo era una lista plana de
   * etiqueta + valor y el bloque se leía como un muro de texto.
   */
  detalleSecciones = computed(() => {
    const secciones = this.agenda()?.secciones || {};
    return SECCIONES_CONFIG
      .map(sec => ({
        id: sec.id,
        label: sec.label,
        grupo: sec.grupo,
        icono: this.svgSeguro(ICONOS_SECCION[sec.id] ?? ICONO_SECCION_DEFECTO),
        filas: (secciones[sec.id] || [])
          .map(fila => this.filaDeDetalle(sec, fila))
          .filter(f => f.dia || f.hora || f.titulo || f.subtitulos.length ||
                       f.metas.length || f.notas.length || f.otros.length),
      }))
      .filter(sec => sec.filas.length > 0);
  });

  /**
   * Las nueve secciones agrupadas en las tres familias temáticas, para que el
   * portal las pinte en bloques con encabezado en vez de sueltas en una sola
   * rejilla donde hospedaje, estudios y remociones quedaban intercaladas.
   */
  private static readonly FAMILIAS_DETALLE: { id: SeccionGrupo; label: string; desc: string }[] = [
    { id: 'hospitalidad', label: 'Hospitalidad', desc: 'Dónde se hospeda y con quién come' },
    { id: 'ministerio', label: 'Ministerio', desc: 'Predicación, estudios bíblicos y pastoreo' },
    { id: 'ancianos', label: 'Cuerpo de ancianos', desc: 'Temas para la reunión con el superintendente' },
  ];

  detalleFamilias = computed(() => {
    const secciones = this.detalleSecciones();
    return EntregaPortalComponent.FAMILIAS_DETALLE
      .map(fam => ({ ...fam, secciones: secciones.filter(s => s.grupo === fam.id) }))
      .filter(fam => fam.secciones.length > 0);
  });

  /**
   * Marcadores de "sin dato" que el formulario deja escritos a mano. Pintar
   * "Publicación: N/A" ocupa una línea y no dice nada, así que se descartan.
   */
  private static readonly VALORES_VACIOS = new Set(
    ['n/a', 'n.a.', 'na', '-', '--', 'ninguno', 'ninguna', 'no aplica'],
  );

  private esValorVacio(valor: string): boolean {
    return !valor || EntregaPortalComponent.VALORES_VACIOS.has(valor.toLowerCase());
  }

  /** Reparte los campos de una fila según el `rol` que la config les da. */
  private filaDeDetalle(sec: SeccionConfig, fila: Record<string, string>) {
    const leer = (key: string) => (fila[key] ?? '').toString().trim();
    const detalle = {
      dia: leer('dia'),
      // Mismo formato de 12 horas que la tabla de la agenda.
      hora: this.horaLegible(leer('hora')),
      titulo: '',
      insignia: '',
      subtitulos: [] as { label: string; valor: string }[],
      metas: [] as { tipo: 'tel' | 'dir'; label: string; valor: string; tel: string | null; conEtiqueta: boolean }[],
      notas: [] as { label: string; valor: string }[],
      otros: [] as { label: string; valor: string }[],
      // Mismo criterio que el editor: solo los campos marcados con verTarjeta
      // ofrecen consultar la tarjeta del publicador.
      tarjeta: this.tarjetaDeFila(sec, fila),
    };

    for (const f of sec.fields) {
      if (f.key === 'dia' || f.key === 'hora') continue;
      const valor = leer(f.key);
      if (this.esValorVacio(valor)) continue;

      switch (f.rol) {
        case 'titulo':
          if (!detalle.titulo) detalle.titulo = valor;
          break;
        case 'insignia':
          if (!detalle.insignia) detalle.insignia = valor;
          break;
        case 'subtitulo':
          detalle.subtitulos.push({ label: f.label, valor });
          break;
        case 'tel':
          detalle.metas.push({
            tipo: 'tel', label: f.label, valor,
            tel: valor.replace(/[^+\d]/g, '') || null,
            // "Teléfono del otro contacto" necesita decir cuál es; el teléfono
            // a secas se entiende con el icono.
            conEtiqueta: f.label !== 'Teléfono',
          });
          break;
        case 'dir':
          detalle.metas.push({
            tipo: 'dir', label: f.label, valor, tel: null,
            conEtiqueta: f.label !== 'Dirección',
          });
          break;
        case 'nota':
          detalle.notas.push({ label: f.label, valor });
          break;
        default:
          detalle.otros.push({ label: f.label, valor });
      }
    }

    // Sección sin campo marcado como título: el primer dato hace de encabezado
    // para que la entrada nunca empiece por una etiqueta suelta.
    if (!detalle.titulo && detalle.otros.length) {
      detalle.titulo = detalle.otros.shift()!.valor;
    }
    return detalle;
  }

  /** Publicador cuya tarjeta se puede consultar desde una fila, o null. */
  private tarjetaDeFila(sec: SeccionConfig, fila: Record<string, string>) {
    const campo = sec.fields.find(f => f.verTarjeta);
    if (!campo) return null;
    const id = Number(fila[`${campo.key}_id_publicador`]);
    const nombre = (fila[campo.key] ?? '').toString().trim();
    // Sin id es un nombre escrito a mano: no hay tarjeta que abrir.
    return Number.isFinite(id) && id > 0 ? { id, nombre } : null;
  }

  private gruposExpandidos = signal<Set<number | null>>(new Set());
  private pubsExpandidos = signal<Set<number>>(new Set());

  // ── Computed ─────────────────────────────────────────────────────────────────
  private static readonly PRIVS_PREC_REG = ['precursor regular', 'precursor especial', 'misionero'];

  private esPrivPrecReg(priv: string | null): boolean {
    if (!priv) return false;
    const p = priv.toLowerCase();
    return EntregaPortalComponent.PRIVS_PREC_REG.some(x => p.includes(x));
  }

  private filtrarGrupos(grupos: any[], excluirPrecReg: boolean): any[] {
    return grupos
      .map(g => ({ ...g, publicadores: g.publicadores.filter((p: any) => excluirPrecReg ? !this.esPrivPrecReg(p.privilegio_principal) : this.esPrivPrecReg(p.privilegio_principal)) }))
      .filter(g => g.publicadores.length > 0);
  }

  private mergePorGrupo(...listas: any[][]): any[] {
    const merged = new Map<any, any>();
    listas.flat().forEach(g => {
      if (merged.has(g.grupo_id)) {
        merged.get(g.grupo_id).publicadores.push(...g.publicadores);
      } else {
        merged.set(g.grupo_id, { ...g, publicadores: [...g.publicadores] });
      }
    });
    return [...merged.values()].sort(
      (a, b) => (a.grupo_numero ?? 9999) - (b.grupo_numero ?? 9999)
    );
  }

  gruposActivosFiltrados = computed(() => {
    const r = this.registros();
    if (!r) return [];
    const sinPrecReg = this.filtrarGrupos(r.activos.publicadores_por_grupo, true);
    return this.mergePorGrupo(sinPrecReg, r.activos.precursores_auxiliares);
  });

  gruposPrecRegFiltrados = computed(() => {
    const r = this.registros();
    if (!r) return [];
    const desplazados = this.filtrarGrupos(r.activos.publicadores_por_grupo, false);
    return this.mergePorGrupo(r.activos.precursores_regulares, desplazados);
  });

  // Todos los precursores regulares en una sola lista (sin agrupar), ordenados por nombre
  precRegPlanos = computed(() =>
    this.gruposPrecRegFiltrados()
      .flatMap(g => g.publicadores)
      .sort((a: any, b: any) => a.nombre_completo.localeCompare(b.nombre_completo))
  );

  /** ¿Hay algún precursor con consideración especial? Decide si la clave de la
   *  leyenda aparece: en la mayoría de congregaciones no hay ningún caso. */
  hayConsideraciones = computed(() =>
    this.precRegPlanos().some((p: any) => !!p.consideracion_motivo)
  );

  totalActivos = computed(() => this.gruposActivosFiltrados().reduce((s, g) => s + g.publicadores.length, 0));

  totalPrecRegulares = computed(() => this.gruposPrecRegFiltrados().reduce((s, g) => s + g.publicadores.length, 0));

  totalPrecAuxiliares = computed(() =>
    this.registros()?.activos.precursores_auxiliares.reduce((s, g) => s + g.publicadores.length, 0) ?? 0
  );

  contactosFiltrados = computed(() => {
    const q = this.filtroContactos().toLowerCase().trim();
    const list = this.contactos() ?? [];
    return q ? list.filter(cp => cp.nombre_publicador.toLowerCase().includes(q)) : list;
  });

  tarjetasTotales = computed(() => {
    const t = this.totales();
    if (!t) return [];
    return [t.total_publicadores, t.total_precursores_regulares, t.total_precursores_auxiliares];
  });

  totalesChartOptions = computed<{ participacion: EChartsOption | null; cursos: EChartsOption | null }>(() => {
    const t = this.totales();
    if (!t) return { participacion: null, cursos: null };

    const tarjetas = [t.total_publicadores, t.total_precursores_regulares, t.total_precursores_auxiliares];
    const colores = ['#6D28D9', '#0EA5E9', '#10B981'];
    const nombres = ['Publicadores', 'Prec. Regulares', 'Prec. Auxiliares'];
    const meses = tarjetas[0].filas.map(f => f.mes_nombre.slice(0, 3));

    const dark = this.theme.darkMode();
    const axisStyle = {
      axisLine: { lineStyle: { color: dark ? '#334155' : '#e2e8f0' } },
      axisLabel: { color: dark ? '#94a3b8' : '#64748b', fontSize: 10 },
      splitLine: { lineStyle: { color: dark ? 'rgba(51,65,85,0.7)' : 'rgba(148,163,184,0.15)' } },
    };
    const tooltip = {
      trigger: 'axis' as const,
      backgroundColor: dark ? 'rgba(15,23,42,0.96)' : 'rgba(30,41,59,0.92)',
      borderWidth: 0,
      textStyle: { color: '#f1f5f9', fontSize: 12 },
    };
    const legend = {
      bottom: 0,
      textStyle: { color: dark ? '#94a3b8' : '#64748b', fontSize: 10 },
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
    };

    // Solo precursores (índices 1 y 2)
    const precursores = [
      { tarjeta: t.total_precursores_regulares, nombre: 'Prec. Regulares', color: colores[1] },
      { tarjeta: t.total_precursores_auxiliares, nombre: 'Prec. Auxiliares', color: colores[2] },
    ];

    const participacion: EChartsOption = {
      tooltip: {
        ...tooltip,
        valueFormatter: (v: any) => v != null ? `${v} h` : '—',
      },
      legend,
      grid: { top: 8, right: 12, bottom: 50, left: 40 },
      xAxis: { type: 'category', data: meses, ...axisStyle, axisTick: { show: false } },
      yAxis: {
        type: 'value',
        axisLabel: { ...axisStyle.axisLabel, formatter: '{value} h' },
        splitLine: axisStyle.splitLine,
      },
      series: precursores.map(p => ({
        name: p.nombre,
        type: 'bar' as const,
        color: p.color,
        barMaxWidth: 20,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: p.color },
        data: p.tarjeta.filas.map(f =>
          f.participaciones > 0 && f.horas != null
            ? +(f.horas / f.participaciones).toFixed(1)
            : null
        ),
      })),
    };

    const cursos: EChartsOption = {
      tooltip,
      legend,
      grid: { top: 8, right: 12, bottom: 50, left: 36 },
      xAxis: { type: 'category', data: meses, ...axisStyle, axisTick: { show: false } },
      yAxis: { type: 'value', ...axisStyle },
      series: tarjetas.map((tarjeta, i) => ({
        name: nombres[i],
        type: 'bar' as const,
        color: colores[i],
        barMaxWidth: 16,
        itemStyle: { borderRadius: [4, 4, 0, 0], color: colores[i] },
        data: tarjeta.filas.map(f => f.cursos_biblicos),
      })),
    };

    return { participacion, cursos };
  });

  mesesHeaders = computed(() => {
    const r = this.registros();
    if (!r) return [];
    const pub = r.activos.publicadores_por_grupo[0]?.publicadores[0]
      ?? r.activos.precursores_regulares[0]?.publicadores[0]
      ?? r.activos.precursores_auxiliares[0]?.publicadores[0]
      ?? r.inactivos[0];
    return pub?.historial.map(h => ({ mes: h.mes, nombre: h.mes_nombre })) ?? [];
  });

  /** Angular sanea `[innerHTML]` y descarta los <svg>, así que hay que marcar
   *  estos iconos (constantes del propio componente) como confiables. */
  private svgSeguro = (markup: string): SafeHtml => this.sanitizer.bypassSecurityTrustHtml(markup);

  private readonly seccionesBase = [
    { id: 'registros' as Seccion, label: 'Registros de predicación', labelCorto: 'Registros', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' },
    { id: 'totales' as Seccion, label: 'Totales por grupo', labelCorto: 'Totales', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    { id: 'contactos' as Seccion, label: 'Contactos de emergencia', labelCorto: 'Contactos', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' },
    { id: 'asistencia' as Seccion, label: 'Asistencia (S-88)', labelCorto: 'Asistencia', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' },
    { id: 'documentos' as Seccion, label: 'Documentos', labelCorto: 'Documentos', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>' },
  ];

  secciones = computed(() => {
    const base = this.seccionesBase;
    const todas = this.agenda()
      ? [{ id: 'agenda' as Seccion, label: 'Agenda', labelCorto: 'Agenda', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' }, ...base]
      : base;
    return todas.map(s => ({ ...s, icon: this.svgSeguro(s.icon) }));
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit() {
    this.inicializar();
    // El ancho útil de la nav cambia sin que cambie el viewport (sidebar,
    // scrollbar, zoom), así que se observa el elemento directamente.
    afterNextRender(() => {
      const nav = this.navSecciones()?.nativeElement;
      if (!nav || typeof ResizeObserver === 'undefined') return;
      this.navRO = new ResizeObserver(() => this.recalcularNavOverflow());
      this.navRO.observe(nav);
      this.recalcularNavOverflow();
    }, { injector: this.injector });
  }

  ngOnDestroy() {
    this.navRO?.disconnect();
    // El blob de la tarjeta vive hasta que se revoque: sin esto queda retenido
    // si el portal se destruye con el visor abierto.
    this.revocarTarjeta();
  }

  /** Escape cierra el visor: es la vía de salida esperada en un diálogo. */
  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.tarjetaPreview()) this.cerrarTarjeta();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['token'] || changes['idVisita']) {
      this.inicializar();
    }
  }

  private inicializar() {
    if (this.modo === 'publico' && !this.token) return;
    if (this.modo === 'interno' && !this.idVisita) return;

    // Cargar metadata solo en modo público
    if (this.modo === 'publico') {
      this.svc.metadataPublico(this.token).subscribe({
        next: (d) => this.metadata.set(d),
        error: () => {},
      });
    }

    // Año de servicio implícito (Sep–Ago): no hay selector, se usa el año en curso.
    this.anioSel.set(this.calcularAnioServicio());
    this.cargarSeccion('registros');
    this.cargarContactos();
    this.cargarDocumentos();
    this.cargarAgenda();
  }

  /** Año de servicio que contiene hoy: Sep(N-1)–Ago(N) → devuelve N. */
  private calcularAnioServicio(): number {
    const now = new Date();
    return now.getMonth() + 1 >= 9 ? now.getFullYear() + 1 : now.getFullYear();
  }

  seccionCambio(s: Seccion) {
    this.seccionActiva.set(s);
    this.cargarSeccion(s);
    // Al cambiar de sección la pestaña activa se expande (muestra su etiqueta):
    // hay que asegurarse de que quede visible y recalcular el desbordamiento.
    afterNextRender(() => this.centrarPestanaActiva(), { injector: this.injector });
  }

  // ── Desbordamiento horizontal de las pestañas ────────────────────────────────

  /** Desplaza las pestañas una "página" hacia la izquierda (-1) o derecha (1). */
  desplazarNav(dir: -1 | 1) {
    const nav = this.navSecciones()?.nativeElement;
    if (!nav) return;
    nav.scrollBy({ left: dir * Math.max(160, nav.clientWidth * 0.7), behavior: 'smooth' });
  }

  /** Actualiza los indicadores de scroll según la posición actual. */
  recalcularNavOverflow() {
    const nav = this.navSecciones()?.nativeElement;
    if (!nav) return;
    const max = nav.scrollWidth - nav.clientWidth;
    this.navPuedeIzq.set(nav.scrollLeft > 4);
    this.navPuedeDer.set(nav.scrollLeft < max - 4);
  }

  private centrarPestanaActiva() {
    const nav = this.navSecciones()?.nativeElement;
    const activa = nav?.querySelector<HTMLElement>('.seccion-btn.active');
    activa?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    this.recalcularNavOverflow();
  }

  private cargarSeccion(s: Seccion) {
    const anio = this.anioSel();
    if (s === 'registros' && !this.registros()) this.cargarRegistros(anio);
    if (s === 'totales' && !this.totales()) this.cargarTotales(anio);
    if (s === 'asistencia' && !this.asistencia()) this.cargarAsistencia(anio);
  }

  private cargarRegistros(anio: number) {
    this.cargando.set(true);
    const obs = this.modo === 'publico'
      ? this.svc.registrosPublico(this.token, anio)
      : this.svc.registrosInterno(this.idVisita, anio);
    obs.subscribe({
      next: (d) => {
        this.registros.set(d);
        this.cargando.set(false);
        // El primer grupo se abre solo: la pantalla nunca aterriza vacía.
        if (this.gruposExpandidos().size === 0) {
          const primero = this.gruposActivosFiltrados()[0];
          if (primero) this.toggleGrupo(primero.grupo_id);
        }
      },
      error: () => { this.error.set('Error cargando registros.'); this.cargando.set(false); },
    });
  }

  private cargarTotales(anio: number) {
    this.cargando.set(true);
    const obs = this.modo === 'publico'
      ? this.svc.totalesPublico(this.token, anio)
      : this.svc.totalesInterno(this.idVisita, anio);
    obs.subscribe({
      next: (d) => { this.totales.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error cargando totales.'); this.cargando.set(false); },
    });
  }

  private cargarContactos() {
    this.errorContactos.set(null);
    const obs = this.modo === 'publico'
      ? this.svc.contactosPublico(this.token)
      : this.svc.contactosInterno(this.idVisita);
    obs.subscribe({
      next: (d) => this.contactos.set(d),
      error: () => this.errorContactos.set('No se pudieron cargar los contactos.'),
    });
  }

  reintentarContactos() {
    this.cargarContactos();
  }

  private cargarAsistencia(anio: number) {
    this.cargando.set(true);
    const obs = this.modo === 'publico'
      ? this.svc.asistenciaPublico(this.token, anio)
      : this.svc.asistenciaInterno(this.idVisita, anio);
    obs.subscribe({
      next: (d) => { this.asistencia.set(d); this.cargando.set(false); },
      error: () => { this.error.set('Error cargando asistencia.'); this.cargando.set(false); },
    });
  }

  private cargarDocumentos() {
    this.errorDocumentos.set(null);
    const obs = this.modo === 'publico'
      ? this.svc.documentosPublico(this.token)
      : this.svc.documentosInterno(this.idVisita);
    obs.subscribe({
      next: (d) => this.documentos.set(d),
      error: () => this.errorDocumentos.set('No se pudieron cargar los documentos.'),
    });
  }

  reintentarDocumentos() {
    this.cargarDocumentos();
  }

  private cargarAgenda() {
    const obs = this.modo === 'publico'
      ? this.svc.agendaPublico(this.token)
      : this.svc.agendaInterno(this.idVisita);
    obs.subscribe({
      next: (d) => {
        this.agenda.set(d);
        // Si el usuario no ha navegado aún, mostrar agenda primero
        if (this.seccionActiva() === 'registros') {
          this.seccionActiva.set('agenda');
        }
      },
      error: () => this.agenda.set(null),
    });
  }

  // ── Acciones ─────────────────────────────────────────────────────────────────

  onDescargarZip() {
    this.descargandoZip.set(true);
    const anio = this.anioSel();
    const obs = this.modo === 'publico'
      ? this.svc.zipFielPublico(this.token, anio)
      : this.svc.zipFielInterno(this.idVisita, anio);
    obs.subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, `visita_circuito_${anio}.zip`);
        this.descargandoZip.set(false);
      },
      error: () => {
        this.descargandoZip.set(false);
        this.zipDownloadError.set(true);
        setTimeout(() => this.zipDownloadError.set(false), 4000);
      },
    });
  }

  onDescargarS88() {
    this.descargandoS88.set(true);
    const anio = this.anioSel();
    const obs = this.modo === 'publico'
      ? this.svc.s88PdfPublico(this.token, anio)
      : this.svc.s88PdfInterno(this.idVisita, anio);
    obs.subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, `S-88_${anio}.pdf`);
        this.descargandoS88.set(false);
      },
      error: () => this.descargandoS88.set(false),
    });
  }

  /** Abre la tarjeta de un publicador recomendado en la agenda. */
  onVerTarjeta(idPublicador: number, nombre: string) {
    this.abrirTarjeta(idPublicador, nombre);
  }

  /**
   * Carga la tarjeta y la muestra en el visor del portal.
   *
   * Antes se abría en una pestaña nueva, pero `window.open` fuera del gesto del
   * usuario (el blob llega después) lo bloquean los navegadores, así que la
   * vista previa fallaba en silencio. Dentro del portal siempre aparece, y el
   * superintendente no pierde el sitio en la tabla.
   */
  private abrirTarjeta(idPublicador: number, nombre: string) {
    if (this.descargandoTarjeta()) return;
    this.descargandoTarjeta.set(idPublicador);
    const anio = this.anioSel();
    const obs = this.modo === 'publico'
      ? this.svc.tarjetaPdfPublico(this.token, idPublicador, anio)
      : this.svc.tarjetaPdfInterno(this.idVisita, anio, { publicadorId: idPublicador });
    obs.subscribe({
      next: (blob) => {
        this.revocarTarjeta();
        const href = URL.createObjectURL(blob);
        this.tarjetaPreview.set({
          nombre,
          blob,
          href,
          // El iframe exige URL saneada; el <a> de respaldo usa la cruda.
          url: this.sanitizer.bypassSecurityTrustResourceUrl(href),
        });
        this.descargandoTarjeta.set(null);
      },
      error: () => this.descargandoTarjeta.set(null),
    });
  }

  cerrarTarjeta() {
    this.revocarTarjeta();
    this.tarjetaPreview.set(null);
  }

  /** Guarda la tarjeta que se está viendo, sin volver a pedirla al servidor. */
  descargarTarjetaPreview() {
    const tp = this.tarjetaPreview();
    if (tp) this.svc.saveBlob(tp.blob, `Tarjeta - ${tp.nombre}.pdf`);
  }

  private revocarTarjeta() {
    const previo = this.tarjetaPreview();
    if (previo) URL.revokeObjectURL(previo.href);
  }

  onDescargarDocumento(doc: DocumentoItem) {
    if (this.docDescargando()) return;
    this.docDescargando.set(doc.nombre);
    this.svc.archivoInterno(this.idVisita, doc.nombre).subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, doc.nombre);
        this.docDescargando.set(null);
      },
      error: () => this.docDescargando.set(null),
    });
  }

  onDescargarContactosPdf() {
    this.descargandoContactosPdf.set(true);
    const obs = this.modo === 'publico'
      ? this.svc.contactosPdfPublico(this.token)
      : this.svc.contactosPdfInterno(this.idVisita);
    obs.subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, 'contactos_emergencia.pdf');
        this.descargandoContactosPdf.set(false);
      },
      error: () => this.descargandoContactosPdf.set(false),
    });
  }

  sortBy(col: 'horas' | 'cursos' | 'nombre') {
    if (this.sortCol() === col) {
      this.sortDir.update(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('desc');
    }
  }

  sortPubs(pubs: any[]): any[] {
    const col = this.sortCol();
    if (!col) return pubs;
    const dir = this.sortDir() === 'desc' ? -1 : 1;
    if (col === 'nombre') {
      return [...pubs].sort((a, b) =>
        a.nombre_completo.localeCompare(b.nombre_completo, 'es') * dir
      );
    }
    // En la pestaña de precursores la columna muestra el total de los meses con
    // el nombramiento vigente: hay que ordenar por ese mismo número, no por el
    // del año, o el orden no coincide con lo que se ve.
    const esPrecReg = this.subTabRegistros() === 'prec_reg';
    const field = col === 'horas'
      ? (esPrecReg ? 'total_horas_preg' : 'total_horas')
      : (esPrecReg ? 'total_cursos_preg' : 'total_cursos');
    return [...pubs].sort((a, b) => ((a[field] ?? -1) - (b[field] ?? -1)) * dir);
  }

  filterAndSortPubs(pubs: any[]): any[] {
    const q = this.filtroPublicadores().toLowerCase().trim();
    const filtered = q ? pubs.filter(p => p.nombre_completo.toLowerCase().includes(q)) : pubs;
    return this.sortPubs(filtered);
  }

  reintentarCarga() {
    this.error.set(null);
    this.cargarSeccion(this.seccionActiva());
  }

  /** Abre la tarjeta de un publicador de la tabla en el visor.
   *  Disponible también en el portal público: el superintendente necesita la
   *  tarjeta individual tanto como el secretario, y el endpoint público ya
   *  acota el PDF a un publicador de la congregación de la visita. */
  onDescargarTarjeta(pub: any) {
    this.abrirTarjeta(pub.id_publicador as number, pub.nombre_completo);
  }

  onDescargarGrupoPrecReg() {
    if (this.modo !== 'interno') return;
    this.descargandoGrupo.set('prec_reg');
    this.svc.tarjetaPdfInterno(this.idVisita, this.anioSel(), { soloPrecursores: true }).subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, `Tarjetas - Precursores Regulares - ${this.anioSel()}.pdf`);
        this.descargandoGrupo.set(null);
      },
      error: () => this.descargandoGrupo.set(null),
    });
  }

  onDescargarGrupoActivos(grupo: any) {
    if (this.modo !== 'interno') return;
    const key = grupo.grupo_id ?? 'sin-grupo';
    this.descargandoGrupo.set(key);
    this.svc.tarjetaPdfInterno(this.idVisita, this.anioSel(), { grupoId: grupo.grupo_id }).subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, `Tarjetas - ${grupo.grupo_nombre} - ${this.anioSel()}.pdf`);
        this.descargandoGrupo.set(null);
      },
      error: () => this.descargandoGrupo.set(null),
    });
  }

  onDescargarGrupoInactivos() {
    if (this.modo !== 'interno') return;
    const ids = (this.registros()?.inactivos ?? []).map((p: any) => p.id_publicador as number);
    if (!ids.length) return;
    this.descargandoGrupo.set('inactivos');
    this.svc.tarjetaPdfInterno(this.idVisita, this.anioSel(), { publicadorIds: ids }).subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, `Tarjetas - Inactivos - ${this.anioSel()}.pdf`);
        this.descargandoGrupo.set(null);
      },
      error: () => this.descargandoGrupo.set(null),
    });
  }

  // ── Expandir/colapsar grupos y publicadores ───────────────────────────────

  toggleGrupo(id: number | null) {
    this.gruposExpandidos.update(s => {
      const copy = new Set(s);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  grupoExpandido(id: number | null): boolean {
    return this.gruposExpandidos().has(id);
  }

  todosExpandidos = computed(() => {
    const grupos = this.gruposActivosFiltrados();
    const abiertos = this.gruposExpandidos();
    return grupos.length > 0 && grupos.every(g => abiertos.has(g.grupo_id));
  });

  toggleTodosGrupos() {
    if (this.todosExpandidos()) {
      this.gruposExpandidos.set(new Set());
    } else {
      this.gruposExpandidos.set(new Set(this.gruposActivosFiltrados().map(g => g.grupo_id)));
    }
  }

  togglePub(id: number) {
    this.pubsExpandidos.update(s => {
      const copy = new Set(s);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  }

  pubExpandido(id: number): boolean {
    return this.pubsExpandidos().has(id);
  }

  // ── Helpers privilegios ──────────────────────────────────────────────────────

  privLabel(priv: string | null): string {
    if (!priv) return '';
    const p = priv.toLowerCase();
    if (p.includes('anciano')) return 'Anc.';
    if (p.includes('siervo')) return 'Sie.';
    if (p.includes('especial')) return 'P.Esp.';
    if (p.includes('misionero')) return 'P.Mis.';
    if (p.includes('regular')) return 'P.Reg.';
    if (p.includes('auxiliar')) return 'P.Aux.';
    if (p.includes('precursor')) return 'Prec.';
    return priv.slice(0, 5);
  }

  /** Meses en que el publicador sirvió como precursor auxiliar. */
  mesesAux(pub: any): any[] {
    return (pub?.historial ?? []).filter((h: any) => h.precursor_auxiliar);
  }

  // ── Nombramiento de precursor regular a mitad del año de servicio ───────────
  // Quien fue nombrado en, digamos, noviembre arrastra meses previos en los que
  // informó como publicador o como auxiliar. Sin marcarlos, esas horas se leen
  // como horas de precursorado y el total del año mezcla las dos etapas.

  private static readonly MESES_CORTOS = [
    'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
  ];
  private static readonly MESES_LARGOS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  ];

  /** Parte 'YYYY-MM-DD' a mano: `new Date('2025-11-01')` se interpreta en UTC
   *  y en husos negativos (el nuestro) retrocede al 31 de octubre. */
  private partesFecha(iso: string | null | undefined): { anio: number; mes: number; dia: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
    return m ? { anio: +m[1], mes: +m[2], dia: +m[3] } : null;
  }

  /** 'nov 2025' si el nombramiento empezó dentro del año de servicio mostrado
   *  y deja meses previos en la tabla. null en cualquier otro caso: si empezó
   *  antes del año, o justo en su primer mes, todos los meses son de
   *  precursorado y el chip sería ruido en la mayoría de las filas. */
  inicioPregLabel(pub: any): string | null {
    const f = this.partesFecha(pub?.preg_desde);
    if (!f) return null;
    const anioServicio = this.registros()?.anio ?? this.anioSel();
    const esAnterior = f.anio < anioServicio - 1
      || (f.anio === anioServicio - 1 && f.mes < 9);
    if (esAnterior) return null;
    const meses = (pub?.historial ?? []).length;
    if (!meses || (pub?.meses_preg ?? 0) >= meses) return null;
    return `${EntregaPortalComponent.MESES_CORTOS[f.mes - 1]} ${f.anio}`;
  }

  /** Tooltip del chip "desde …" con la fecha exacta del nombramiento. */
  tooltipInicioPreg(pub: any): string {
    const f = this.partesFecha(pub?.preg_desde);
    const priv = pub?.privilegio_principal || 'Precursor regular';
    if (!f) return priv;
    const mes = EntregaPortalComponent.MESES_LARGOS[f.mes - 1];
    const base = `${priv} desde el ${f.dia} de ${mes} de ${f.anio}`;
    return pub?.meses_preg === 0
      ? `${base}. Todavía no hay meses cerrados con el nombramiento.`
      : `${base}. Los meses anteriores no cuentan en sus totales de precursor.`;
  }

  /** Tooltip de la nota de consideración especial: el motivo y desde cuándo. */
  tooltipConsideracion(pub: any): string {
    const motivo = pub?.consideracion_motivo;
    if (!motivo) return '';
    const f = this.partesFecha(pub?.consideracion_desde);
    const desde = f
      ? ` desde el ${f.dia} de ${EntregaPortalComponent.MESES_LARGOS[f.mes - 1]} de ${f.anio}`
      : '';
    return `Consideración especial${desde} (${motivo}): conserva el nombramiento de `
      + 'precursor regular sin tener que cumplir el requisito de horas.';
  }

  /** Mes fuera del nombramiento de precursor regular. Los meses de auxiliar
   *  quedan excluidos a propósito: conservan su ámbar, que es lo que
   *  identifica esas horas como de precursorado auxiliar. */
  esMesFueraNombramiento(pub: any, h: any): boolean {
    return !!pub?.preg_desde && !h?.precursor_regular && !h?.precursor_auxiliar;
  }

  /** Primer mes con el nombramiento vigente: lleva la línea de inicio. */
  esInicioNombramiento(pub: any, h: any): boolean {
    if (!h?.precursor_regular || !this.inicioPregLabel(pub)) return false;
    const primero = (pub?.historial ?? []).find((x: any) => x.precursor_regular);
    return !!primero && primero.mes === h.mes;
  }

  /** Tooltip de la celda de un mes. */
  tituloMes(h: any, pub?: any): string {
    if (pub && this.esMesFueraNombramiento(pub, h)) {
      const desde = this.inicioPregLabel(pub);
      const detalle = desde ? `antes del nombramiento como precursor (${desde})` : 'antes del nombramiento como precursor';
      return h.horas
        ? `${h.mes_nombre}: ${detalle} · ${h.horas} h — no cuentan en el total`
        : `${h.mes_nombre}: ${detalle}`;
    }
    if (h.precursor_auxiliar) {
      return h.horas
        ? `${h.mes_nombre}: Precursor auxiliar · ${h.horas} h`
        : `${h.mes_nombre}: Precursor auxiliar`;
    }
    // Meses de precursor regular/especial/misionero: nombrar el privilegio en
    // vez de "Participó", para que las horas no se confundan con las de un
    // publicador normal cuando la persona ya no es precursor hoy.
    if (h.precursor_regular) {
      const priv = h.privilegio_mes || 'Precursor regular';
      return h.horas
        ? `${h.mes_nombre}: ${priv} · ${h.horas} h`
        : `${h.mes_nombre}: ${priv}`;
    }
    if (h.participo && h.horas) return `${h.mes_nombre}: Participó · ${h.horas} h`;
    return `${h.mes_nombre}: ${h.participo ? 'Participó' : 'No participó'}`;
  }

  /** Tooltip de la etiqueta "Aux." con el detalle de meses y horas. */
  tooltipAux(pub: any): string {
    const meses = this.mesesAux(pub)
      .map((h: any) => h.horas ? `${h.mes_nombre} (${h.horas} h)` : h.mes_nombre);
    return `Precursor auxiliar en: ${meses.join(', ')}`;
  }

  // ── Helpers documentos ───────────────────────────────────────────────────────

  isExcel(doc: DocumentoItem): boolean {
    const ext = (doc.extension ?? '').toLowerCase();
    return ext === 'xlsx' || ext === 'xls' || doc.tipo === 'excel';
  }

  docIconClass(doc: DocumentoItem): string {
    if (doc.tipo === 'pdf') return 'doc-icon doc-icon-pdf';
    if (doc.tipo === 'imagen') return 'doc-icon doc-icon-imagen';
    if (doc.tipo === 'word') return 'doc-icon doc-icon-word';
    if (this.isExcel(doc)) return 'doc-icon doc-icon-excel';
    return 'doc-icon doc-icon-otro';
  }

  // ── Helpers S-88 ─────────────────────────────────────────────────────────────

  fmtS88(mes: any, tipo: string, campo: string): string {
    if (!mes) return '';
    const prefix = tipo === 'midweek' ? 'midweek' : 'weekend';
    const keys: Record<string, string> = {
      reun: `${prefix}_reuniones`,
      total: `${prefix}_total`,
      prom: `${prefix}_promedio`,
    };
    const val = mes[keys[campo]];
    if (val == null || val === 0) return '';
    if (campo === 'prom') return Number(val).toFixed(2);
    return String(val);
  }

  promS88(resumen: any, tipo: string): string {
    if (!resumen?.meses) return '';
    const prefix = tipo === 'midweek' ? 'midweek' : 'weekend';
    const key = `${prefix}_promedio`;
    const vals = resumen.meses
      .map((m: any) => m[key])
      .filter((v: any) => v != null && v > 0) as number[];
    if (!vals.length) return '';
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
  }
}
