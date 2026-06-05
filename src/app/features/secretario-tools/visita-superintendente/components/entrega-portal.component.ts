import {
  Component, Input, OnChanges, SimpleChanges, signal, computed,
  inject, ChangeDetectionStrategy, OnInit
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
import { ThemeService } from '../../../../core/services/theme.service';

type Seccion = 'registros' | 'totales' | 'contactos' | 'asistencia' | 'documentos' | 'agenda';

@Component({
  standalone: true,
  selector: 'app-entrega-portal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DecimalPipe, DatePipe, NgTemplateOutlet, NgxEchartsDirective],
  template: `
<div class="portal-root" [class.is-interno]="modo === 'interno'">

  <!-- ───── BANDA STICKY PÚBLICA (topbar + tabs como una unidad) ───── -->
  @if (modo === 'publico') {
    <div class="sticky-header-band">
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

      <nav class="seccion-nav" role="tablist">
        @for (s of secciones(); track s.id) {
          <button type="button" role="tab" class="seccion-btn"
            [class.active]="seccionActiva() === s.id"
            [attr.aria-selected]="seccionActiva() === s.id"
            (click)="seccionCambio(s.id)">
            <span class="seccion-icon" [innerHTML]="s.icon"></span>
            <span class="seccion-label">{{ s.label }}</span>
          </button>
        }
      </nav>
    </div>
  }

  <!-- ───── NAVEGACIÓN DE SECCIONES (solo modo interno) ───── -->
  @if (modo === 'interno') {
    <nav class="seccion-nav" role="tablist">
      @for (s of secciones(); track s.id) {
        <button type="button" role="tab" class="seccion-btn"
          [class.active]="seccionActiva() === s.id"
          [attr.aria-selected]="seccionActiva() === s.id"
          (click)="seccionCambio(s.id)">
          <span class="seccion-icon" [innerHTML]="s.icon"></span>
          <span class="seccion-label">{{ s.label }}</span>
        </button>
      }
    </nav>
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
              @if (subTabRegistros() !== 'prec_reg') {
                <span class="leyenda-item">
                  <span class="check-dot dot-aux"></span> Prec. auxiliar
                </span>
              }
            </div>
          </div>
        </div><!-- /registros-sticky-header -->

        <!-- Publicadores por grupo (activos sin precursores regulares) -->
        @if (subTabRegistros() === 'activos') {
          @for (grupo of gruposActivosFiltrados(); track grupo.grupo_id) {
            <div class="grupo-section">
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
            <div class="contacto-pub-card">
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
            <div class="doc-card">
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

              <!-- Botón de descarga -->
              <a [href]="doc.url" [download]="doc.nombre" class="btn-doc-download">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                {{ doc.tipo === 'word' ? 'Descargar Word' : 'Descargar' }}
              </a>
            </div>
          }
        </div>
      </div>
    }

    <!-- ═══ SECCIÓN 6: AGENDA ═══ -->
    @if (seccionActiva() === 'agenda' && agenda()) {
      <div class="seccion-panel">
        <div class="panel-header">
          <h2 class="panel-title">{{ agenda()!.titulo || 'Agenda' }}</h2>
          <p class="panel-subtitle">Programa de actividades durante la visita</p>
        </div>

        <div class="agenda-table-wrap">
          <table class="agenda-table">
            <thead>
              <tr>
                <th>Día</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th>Actividad</th>
                <th>Responsable</th>
              </tr>
            </thead>
            <tbody>
              @for (item of agenda()!.items; track $index) {
                <tr class="agenda-row" [class.agenda-day-header]="!item.hora_inicio && !item.actividad">
                  <td class="agenda-dia">{{ item.dia }}</td>
                  <td class="agenda-hora">{{ item.hora_inicio || '—' }}</td>
                  <td class="agenda-hora">{{ item.hora_fin || '—' }}</td>
                  <td class="agenda-actividad">
                    {{ item.actividad }}
                    @if (item.lugar) {
                      <span class="agenda-lugar">{{ item.lugar }}</span>
                    }
                    @if (item.notas) {
                      <span class="agenda-notas">{{ item.notas }}</span>
                    }
                  </td>
                  <td class="agenda-responsable">{{ item.responsable || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
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
            <th class="th-total th-sortable" (click)="sortBy('horas')" title="Total de horas en el año">
              <span class="th-total-label">Horas</span>
              <span class="th-total-sub">total</span>
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
            <th class="th-total th-sortable" (click)="sortBy('cursos')" title="Total de cursos bíblicos en el año">
              <span class="th-total-label">Cursos</span>
              <span class="th-total-sub">total</span>
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
            @if (showTarjeta && modo === 'interno') {
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
                </td>
              }
              @for (h of pub.historial; track h.mes) {
                <td class="td-mes" [class.participo]="h.participo" [class.paux]="h.precursor_auxiliar"
                    [title]="tituloMes(h)">
                  @if (h.precursor_auxiliar && h.horas) {
                    <span class="aux-horas">{{ h.horas }}</span>
                  } @else if (showHoras && h.participo && h.horas) {
                    <span class="prec-horas">{{ h.horas }}</span>
                  } @else if (h.participo) {
                    <span class="check-dot" [class.dot-aux]="h.precursor_auxiliar"></span>
                  }
                </td>
              }
              <td class="td-total">{{ pub.total_horas || '—' }}</td>
              <td class="td-total">{{ pub.total_cursos || '—' }}</td>
              @if (showTarjeta && modo === 'interno') {
                <td class="td-tarjeta">
                  <button class="btn-tarjeta"
                    [disabled]="descargandoTarjeta() === pub.id_publicador"
                    [title]="'Descargar tarjeta de ' + pub.nombre_completo"
                    [attr.aria-label]="'Descargar tarjeta de ' + pub.nombre_completo"
                    (click)="onDescargarTarjeta(pub)">
                    @if (descargandoTarjeta() === pub.id_publicador) {
                      <span class="spinner-sm"></span>
                    } @else {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-3.5 h-3.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-2-2m2 2l2-2"/>
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
    .is-interno .seccion-nav {
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

    /* ── Sticky band pública (topbar + nav como unidad) ── */
    .sticky-header-band {
      position: sticky;
      top: 4rem;        /* justo debajo del header de página */
      z-index: 25;
      background: var(--bg-card);
      border-bottom: 1px solid var(--border);
      flex-shrink: 0;
    }

    /* ── Topbar ── */
    .portal-topbar {
      display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      padding: 0.75rem 1.25rem;
      background: transparent;   /* el fondo lo da sticky-header-band */
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
    .seccion-nav {
      display: flex; gap: 0; overflow-x: auto; overflow-y: hidden;
      scrollbar-width: none;
      background: transparent;  /* el fondo lo da sticky-header-band o is-interno */
      flex-shrink: 0;
      min-height: 3rem;
    }
    .seccion-nav::-webkit-scrollbar { display: none; }
    .seccion-btn {
      display: inline-flex; align-items: center; gap: 0.5rem;
      padding: 1rem 1.25rem; font-size: 0.875rem; font-weight: 600;
      color: var(--muted); border-bottom: 2px solid transparent;
      white-space: nowrap; cursor: pointer; flex-shrink: 0;
      transition: color 160ms, border-color 160ms, background 160ms;
      min-height: 3rem;
    }
    .seccion-btn.active { color: var(--brand); border-bottom-color: var(--brand); }
    .seccion-btn:hover:not(.active) { color: var(--text); background: var(--bg-subtle); }
    .seccion-icon { display: inline-flex; width: 1.125rem; height: 1.125rem; }
    .seccion-icon svg { width: 1.125rem; height: 1.125rem; }

    /* ── Contenido ── */
    /* En modo público el scroll es del documento; en interno es del contenedor padre */
    .seccion-content { flex: 1; overflow-y: visible; background: var(--bg-subtle); padding: 1.5rem; }
    .is-interno .seccion-content { overflow-y: visible; }
    .seccion-panel { max-width: 1200px; margin: 0 auto; }

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

    /* ── Tabla publicadores ── */
    .tabla-responsive { overflow-x: auto; }
    .tabla-pubs {
      width: 100%; border-collapse: collapse; font-size: 0.8125rem;
    }
    .tabla-pubs th {
      padding: 0.5rem 0.625rem; background: var(--bg-subtle);
      border-bottom: 2px solid var(--border); font-weight: 700;
      color: var(--muted); text-transform: uppercase; font-size: 0.65rem;
      letter-spacing: 0.05em; white-space: nowrap;
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
    .th-nombre { position: sticky; left: 0; z-index: 2; background: var(--bg-subtle); }
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
    .check-dot { display: inline-block; width: 0.5rem; height: 0.5rem; border-radius: 9999px; background: #10b981; }
    .check-dot.dot-aux { background: #eab308; }
    .aux-horas { font-size: 0.6875rem; font-weight: 700; color: #b45309; font-variant-numeric: tabular-nums; }
    :host-context(.dark) .aux-horas { color: #fbbf24; }
    .prec-horas { font-size: 0.6875rem; font-weight: 700; color: #10b981; font-variant-numeric: tabular-nums; }
    :host-context(.dark) .prec-horas { color: #34d399; }
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

    /* ── Agenda ── */
    .agenda-table-wrap { overflow-x: auto; border-radius: var(--radius); border: 1px solid var(--border); }
    .agenda-table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
    .agenda-table th {
      padding: 0.5rem 0.875rem; background: var(--bg-subtle);
      border-bottom: 2px solid var(--border); font-weight: 700;
      color: var(--muted); font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.05em;
      white-space: nowrap; text-align: left;
    }
    .agenda-table td { padding: 0.625rem 0.875rem; border-bottom: 1px solid var(--border); vertical-align: top; }
    .agenda-row:last-child td { border-bottom: none; }
    .agenda-row:hover { background: var(--brand-light); }
    .agenda-dia { font-weight: 700; color: var(--text); white-space: nowrap; min-width: 120px; }
    .agenda-hora { color: var(--muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .agenda-actividad { color: var(--text); font-weight: 600; }
    .agenda-responsable { color: var(--muted); white-space: nowrap; }
    .agenda-lugar {
      display: block; font-size: 0.75rem; font-weight: 400;
      color: var(--brand); margin-top: 0.125rem;
    }
    .agenda-notas {
      display: block; font-size: 0.75rem; font-weight: 400;
      color: var(--muted); margin-top: 0.125rem; font-style: italic;
    }
    @media (max-width: 640px) {
      .agenda-table th:nth-child(2), .agenda-table th:nth-child(3),
      .agenda-table td:nth-child(2), .agenda-table td:nth-child(3) { display: none; }
    }

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
    .leyenda-item { display: inline-flex; align-items: center; gap: 0.3rem; white-space: nowrap; }
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
      .is-interno .seccion-nav { top: 2.5rem; }

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
  `],
})
export class EntregaPortalComponent implements OnInit, OnChanges {
  @Input() modo: 'publico' | 'interno' = 'publico';
  @Input() token: string = '';
  @Input() idVisita: number = 0;

  private svc = inject(EntregaPortalService);
  theme = inject(ThemeService);

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

  private readonly seccionesBase = [
    { id: 'registros' as Seccion, label: 'Registros de predicación', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>' },
    { id: 'totales' as Seccion, label: 'Totales por grupo', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
    { id: 'contactos' as Seccion, label: 'Contactos de emergencia', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>' },
    { id: 'asistencia' as Seccion, label: 'Asistencia (S-88)', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' },
    { id: 'documentos' as Seccion, label: 'Documentos', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>' },
  ];

  secciones = computed(() => {
    const base = this.seccionesBase;
    if (!this.agenda()) return base;
    return [{ id: 'agenda' as Seccion, label: 'Agenda', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>' }, ...base];
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit() {
    this.inicializar();
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
      next: (d) => { this.registros.set(d); this.cargando.set(false); },
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
    const field = col === 'horas' ? 'total_horas' : 'total_cursos';
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

  onDescargarTarjeta(pub: any) {
    if (this.modo !== 'interno') return;
    const id = pub.id_publicador as number;
    this.descargandoTarjeta.set(id);
    this.svc.tarjetaPdfInterno(this.idVisita, this.anioSel(), { publicadorId: id }).subscribe({
      next: (blob) => {
        this.svc.saveBlob(blob, `Tarjeta - ${pub.nombre_completo}.pdf`);
        this.descargandoTarjeta.set(null);
      },
      error: () => this.descargandoTarjeta.set(null),
    });
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

  /** Tooltip de la celda de un mes. */
  tituloMes(h: any): string {
    if (h.precursor_auxiliar) {
      return h.horas
        ? `${h.mes_nombre}: Precursor auxiliar · ${h.horas} h`
        : `${h.mes_nombre}: Precursor auxiliar`;
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
