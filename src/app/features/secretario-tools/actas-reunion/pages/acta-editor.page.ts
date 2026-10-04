import {
  Component, inject, signal, computed, effect, untracked, OnInit, OnDestroy, HostListener, ViewChild, ElementRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActaService } from '../../services/acta.service';
import { Acta, Tarea, TipoReunion } from '../../models/acta.model';
import { TareaDetailPanelComponent } from '../../tareas/components/tarea-detail-panel.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { LucideAngularModule } from '../../../../shared/icons';

type MobileTab = 'notas' | 'acta' | 'tareas';
type Capa = 'eliminar' | 'regenerar' | 'tarea' | 'acciones' | 'estado';

const TIPO_LABEL: Record<TipoReunion, string> = {
  ancianos: 'Reunión de ancianos',
  trimestral: 'Reunión trimestral',
  comite_servicio: 'Comité de servicio',
  otra: 'Otra reunión',
};

const PRIORIDAD_LABEL: Record<Tarea['prioridad'], string> = { baja: 'Baja', media: 'Media', alta: 'Alta' };

/**
 * Editor de un acta: notas en bruto → acta redactada (a mano o con IA) → tareas
 * de seguimiento. En escritorio las tres columnas conviven sin scroll de página;
 * por debajo de 768 px se reparten en pestañas y el editor ocupa la pantalla.
 *
 * Nada aquí usa `container-type` ni deja `transform` aplicado en reposo: el
 * popover del date-picker compartido se posiciona con `position: fixed` en
 * coordenadas de viewport, y cualquier ancestro que sea bloque contenedor lo
 * desplazaría.
 */
@Component({
  standalone: true,
  selector: 'app-acta-editor',
  imports: [FormsModule, TareaDetailPanelComponent, DatePickerComponent, LucideAngularModule],
  styleUrls: ['../../../reportes/shared/reportes-tokens.scss'],
  template: `
  <div class="editor" [class.modo-escritura]="isMobileMode() && (notasFocused() || actaFocused())">

  @if (acta(); as a) {

    <!-- ══════════════ CABECERA ══════════════ -->
    <header class="cab">
      <button type="button" class="ctrl ctrl-icono cab-volver" (click)="volver()"
              aria-label="Volver a actas" title="Volver a actas">
        <lucide-icon name="arrow-left" [size]="18" aria-hidden="true"></lucide-icon>
      </button>

      <div class="cab-titulos">
        <p class="cab-ceja">{{ tipoLabel(a.tipo_reunion) }}</p>
        <h1 class="cab-titulo" [title]="a.titulo">{{ a.titulo }}</h1>
        <div class="senas">
          <span class="sena">
            <lucide-icon name="calendar" [size]="13" aria-hidden="true"></lucide-icon>
            <time [attr.datetime]="a.fecha_reunion">
              <span class="solo-escritorio">{{ fechaLarga(a.fecha_reunion) }}</span>
              <span class="solo-movil">{{ formatFecha(a.fecha_reunion) }}</span>
            </time>
          </span>
          <span class="sena sena-estado" [attr.data-estado]="a.estado">
            <span class="punto" aria-hidden="true"></span>{{ a.estado === 'finalizada' ? 'Finalizada' : 'Borrador' }}
          </span>
          <span class="sena sena-guardado" role="status" aria-live="polite">
            @switch (estadoGuardado()) {
              @case ('guardando') { <span class="spinner" aria-hidden="true"></span>Guardando… }
              @case ('pendiente') { Cambios sin guardar }
              @case ('guardado') {
                <lucide-icon name="check" [size]="13" aria-hidden="true"></lucide-icon>Guardado {{ savedAgo() }}
              }
            }
          </span>
        </div>
      </div>

      <div class="cab-acciones">
        <div class="grupo-export" role="group" aria-label="Exportar acta">
          <button type="button" class="ctrl" (click)="exportar('pdf')" title="Descargar como PDF">
            <lucide-icon name="download" [size]="15" aria-hidden="true"></lucide-icon>PDF
          </button>
          <button type="button" class="ctrl" (click)="exportar('docx')" title="Descargar como Word">Word</button>
        </div>

        @if (!isReadonly()) {
          <button type="button" class="ctrl btn-guardar" (click)="guardar()" [disabled]="guardando()"
                  [attr.aria-keyshortcuts]="atajo === '⌘' ? 'Meta+S' : 'Control+S'">
            Guardar <kbd class="kbd">{{ atajo }} S</kbd>
          </button>
        }

        <div class="estado-wrap" #estadoWrap (focusout)="onEstadoFocusOut($event)">
          <button #estadoTrigger type="button" class="ctrl ctrl-estado" [attr.data-estado]="a.estado"
                  aria-haspopup="true"
                  [attr.aria-expanded]="estadoOpen()"
                  [attr.aria-controls]="isMobileMode() ? 'acciones-hoja' : 'estado-menu'"
                  [attr.aria-label]="isMobileMode() ? 'Más acciones' : null"
                  (click)="alternarEstado()">
            <span class="solo-escritorio ctrl-estado-txt">
              @if (a.estado === 'finalizada') {
                <lucide-icon name="check" [size]="15" class="ico-pos" aria-hidden="true"></lucide-icon>Finalizada
              } @else {
                Finalizar acta
              }
              <lucide-icon name="chevron-down" [size]="15" class="chevron" [class.girado]="estadoOpen()" aria-hidden="true"></lucide-icon>
            </span>
            <lucide-icon name="more-horizontal" [size]="18" class="solo-movil" aria-hidden="true"></lucide-icon>
          </button>

          @if (estadoOpen() && !isMobileMode()) {
            <div id="estado-menu" class="menu" role="menu" aria-label="Estado del acta"
                 data-capa="estado" (keydown)="onMenuKeydown($event)">
              <p class="menu-titulo" aria-hidden="true">Estado del acta</p>
              <button type="button" class="menu-op" role="menuitemradio"
                      [attr.aria-checked]="a.estado !== 'finalizada'"
                      [attr.data-autofocus]="a.estado !== 'finalizada' ? '' : null"
                      (click)="setEstado(a, 'borrador')">
                <span class="punto punto-borrador" aria-hidden="true"></span>
                <span class="menu-op-txt">
                  <span class="menu-op-etq">Borrador</span>
                  <span class="menu-op-sub">Se puede seguir editando</span>
                </span>
                @if (a.estado !== 'finalizada') {
                  <lucide-icon name="check" [size]="16" class="menu-op-check" aria-hidden="true"></lucide-icon>
                }
              </button>
              <button type="button" class="menu-op" role="menuitemradio"
                      [attr.aria-checked]="a.estado === 'finalizada'"
                      [attr.data-autofocus]="a.estado === 'finalizada' ? '' : null"
                      (click)="setEstado(a, 'finalizada')">
                <span class="punto punto-final" aria-hidden="true"></span>
                <span class="menu-op-txt">
                  <span class="menu-op-etq">Finalizada</span>
                  <span class="menu-op-sub">Queda cerrada y en solo lectura</span>
                </span>
                @if (a.estado === 'finalizada') {
                  <lucide-icon name="check" [size]="16" class="menu-op-check" aria-hidden="true"></lucide-icon>
                }
              </button>
            </div>
          }
        </div>
      </div>
    </header>

    <!-- ══════════════ AVISO SOLO LECTURA ══════════════ -->
    @if (isReadonly()) {
      <div class="aviso-lectura" role="note">
        <lucide-icon name="lock" [size]="16" class="ico-pos" aria-hidden="true"></lucide-icon>
        <p><strong>Acta finalizada.</strong> Está en solo lectura; las tareas siguen pudiéndose actualizar.</p>
        <button type="button" class="ctrl ctrl-sm" (click)="setEstado(a, 'borrador')">
          <lucide-icon name="unlock" [size]="14" aria-hidden="true"></lucide-icon>Reabrir
        </button>
      </div>
    }

    <!-- ══════════════ PESTAÑAS (móvil) ══════════════ -->
    <div class="pestanas" role="tablist" aria-label="Secciones del acta" (keydown)="onTabsKeydown($event)">
      @for (t of mobileTabs; track t.id) {
        <button type="button" role="tab" class="pestana"
                [id]="'pestana-' + t.id"
                [attr.aria-controls]="'panel-' + t.id"
                [attr.aria-selected]="activeTab() === t.id"
                [attr.tabindex]="activeTab() === t.id ? 0 : -1"
                [class.activa]="activeTab() === t.id"
                (click)="activeTab.set(t.id)">
          {{ t.label }}
          @if (t.id === 'tareas' && tareas().length) {
            <span class="pestana-cifra">{{ tareas().length }}</span>
          }
        </button>
      }
    </div>

    <!-- ══════════════ MESA DE TRABAJO ══════════════ -->
    <div class="mesa">

      <!-- ── Notas ── -->
      <section id="panel-notas" class="panel panel-notas"
               [class.tab-hidden]="isMobileMode() && activeTab() !== 'notas'"
               [attr.role]="isMobileMode() ? 'tabpanel' : 'region'"
               [attr.aria-labelledby]="isMobileMode() ? 'pestana-notas' : 'titulo-notas'">
        <header class="panel-cab">
          <div class="panel-cab-txt">
            <h2 id="titulo-notas" class="panel-titulo">Notas</h2>
            <p id="notas-ayuda" class="panel-sub">
              {{ a.notas_originales || isReadonly() ? 'Apuntes en bruto de la reunión' : 'Escribe aquí y luego genera el acta' }}
            </p>
          </div>
          @if (!isReadonly()) {
            <button type="button" class="btn-primario btn-generar" (click)="redactarIA()"
                    [disabled]="redactando() || !a.notas_originales || rateLimitSecondsLeft() > 0"
                    [title]="tituloGenerar(a)" aria-describedby="notas-ayuda"
                    [attr.aria-keyshortcuts]="atajo === '⌘' ? 'Meta+Enter' : 'Control+Enter'">
              @if (redactando()) {
                <span class="spinner" aria-hidden="true"></span>Generando…
              } @else if (rateLimitSecondsLeft() > 0) {
                <lucide-icon name="clock" [size]="15" aria-hidden="true"></lucide-icon>Disponible en {{ formatoEspera(rateLimitSecondsLeft()) }}
              } @else {
                <lucide-icon name="sparkles" [size]="15" aria-hidden="true"></lucide-icon>Generar acta
                <kbd class="kbd kbd-solido">{{ atajo }} ↵</kbd>
              }
            </button>
          }
        </header>
        <label for="notas-texto" class="sr-only">Notas de la reunión</label>
        <textarea #notasTextarea id="notas-texto"
                  class="texto texto-notas"
                  [(ngModel)]="a.notas_originales"
                  (ngModelChange)="markDirty()"
                  (focus)="notasFocused.set(true)"
                  (blur)="notasFocused.set(false)"
                  [readonly]="isReadonly()"
                  spellcheck="true"
                  placeholder="Puntos tratados, acuerdos, responsables…&#10;&#10;- Punto 1:&#10;- Acuerdo:&#10;- Responsable:"></textarea>
      </section>

      <!-- ── Acta redactada ── -->
      <section id="panel-acta" class="panel panel-acta"
               [class.tab-hidden]="isMobileMode() && activeTab() !== 'acta'"
               [attr.role]="isMobileMode() ? 'tabpanel' : 'region'"
               [attr.aria-labelledby]="isMobileMode() ? 'pestana-acta' : 'titulo-acta'">
        <header class="panel-cab">
          <div class="panel-cab-txt">
            <h2 id="titulo-acta" class="panel-titulo">Acta</h2>
            <p class="panel-sub">Documento formal · es lo que se exporta</p>
          </div>
          @if (!isReadonly() && !redactando() && (a.contenido_redactado || actaFocused())) {
            <!-- mousedown sin foco: si el textarea perdiera el foco antes del click,
                 el botón ya mostraría "Editar" y volvería a abrir la edición. -->
            <button type="button" class="ctrl ctrl-sm" (mousedown)="$event.preventDefault()"
                    (click)="actaFocused() ? blurActiveTextarea() : focusActa()">
              @if (actaFocused()) {
                <lucide-icon name="eye" [size]="14" aria-hidden="true"></lucide-icon>Vista previa
              } @else {
                <lucide-icon name="edit-2" [size]="14" aria-hidden="true"></lucide-icon>Editar
              }
            </button>
          }
        </header>
        <div class="panel-cuerpo acta-cuerpo">
          @if (redactando()) {
            <div class="generando" role="status" aria-live="polite">
              <p class="generando-titulo"><span class="spinner" aria-hidden="true"></span>Redactando el acta…</p>
              <p class="generando-sub">Tarda unos segundos. Tus notas no se modifican.</p>
              <div class="esqueleto" aria-hidden="true">
                <span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span>
              </div>
            </div>
          } @else if (!a.contenido_redactado && !actaFocused()) {
            <div class="vacio">
              <lucide-icon name="file-text" [size]="24" class="vacio-ico" aria-hidden="true"></lucide-icon>
              @if (isReadonly()) {
                <p class="vacio-titulo">Sin texto redactado</p>
                <p class="vacio-sub">Esta acta se finalizó sin redacción.</p>
              } @else {
                <p class="vacio-titulo">Todavía no hay acta</p>
                <p class="vacio-sub">Genera un borrador a partir de las notas o escríbela tú mismo.</p>
                <div class="vacio-acciones">
                  @if (isMobileMode()) {
                    <button type="button" class="ctrl" (click)="activeTab.set('notas')">
                      <lucide-icon name="arrow-left" [size]="15" aria-hidden="true"></lucide-icon>Ir a notas
                    </button>
                  }
                  <button type="button" class="ctrl" (click)="focusActa()">
                    <lucide-icon name="edit-2" [size]="15" aria-hidden="true"></lucide-icon>Escribir a mano
                  </button>
                </div>
              }
            </div>
          } @else if (!actaFocused()) {
            <article class="prosa" [class.editable]="!isReadonly()"
                     (click)="!isReadonly() && focusActa()"
                     [innerHTML]="actaHtml()"></article>
          }
          <textarea #actaTextarea id="acta-texto"
                    class="texto texto-acta"
                    [class.oculto]="!actaFocused()"
                    [attr.tabindex]="actaFocused() ? null : -1"
                    [attr.aria-hidden]="actaFocused() ? null : 'true'"
                    aria-label="Texto del acta (admite Markdown: # títulos, - listas, **negrita**)"
                    [(ngModel)]="a.contenido_redactado"
                    (ngModelChange)="markDirty()"
                    (blur)="onActaBlur()"
                    [readonly]="isReadonly()"
                    spellcheck="true"
                    placeholder="Escribe el acta aquí…"></textarea>
        </div>
      </section>

      <!-- ── Tareas ── -->
      <section id="panel-tareas" class="panel panel-tareas"
               [class.tab-hidden]="isMobileMode() && activeTab() !== 'tareas'"
               [attr.role]="isMobileMode() ? 'tabpanel' : 'region'"
               [attr.aria-labelledby]="isMobileMode() ? 'pestana-tareas' : 'titulo-tareas'">
        <header class="panel-cab">
          <div class="panel-cab-txt">
            <h2 id="titulo-tareas" class="panel-titulo">
              Tareas <span class="cifra-titulo">{{ tareas().length }}</span>
            </h2>
            <p class="panel-sub">{{ resumenTareas() }}</p>
          </div>
          @if (!isReadonly()) {
            <button type="button" class="ctrl ctrl-sm" (click)="alternarFormularioTarea()"
                    [attr.aria-expanded]="agregandoTarea()" aria-controls="form-tarea">
              <lucide-icon [name]="agregandoTarea() && !isMobileMode() ? 'x' : 'plus'" [size]="14" aria-hidden="true"></lucide-icon>
              {{ agregandoTarea() && !isMobileMode() ? 'Cerrar' : 'Nueva' }}
            </button>
          }
        </header>

        <!-- Escritorio: formulario en línea. En móvil va en una hoja (al final del template). -->
        @if (agregandoTarea() && !isMobileMode()) {
          <div id="form-tarea" class="form-tarea" role="group" aria-label="Nueva tarea">
            <div class="campo-grupo">
              <label for="tarea-titulo" class="etq-campo">Título <span class="req" aria-hidden="true">*</span></label>
              <input id="tarea-titulo" class="campo" data-autofocus-tarea required aria-required="true"
                     placeholder="¿Qué hay que hacer?" autocomplete="off"
                     [(ngModel)]="tareaForm.titulo"
                     (keydown.enter)="tareaForm.titulo && crearTarea()" />
            </div>
            <div class="form-tarea-fila">
              <div class="campo-grupo" role="group" aria-labelledby="etq-fecha-inline">
                <span id="etq-fecha-inline" class="etq-campo">Fecha límite</span>
                <app-date-picker class="selector-fecha"
                                 [(ngModel)]="tareaForm.fecha_limite"
                                 placeholder="Sin fecha"
                                 colorScheme="violet"
                                 [fieldLike]="true"></app-date-picker>
              </div>
              <fieldset class="campo-grupo">
                <legend class="etq-campo">Prioridad</legend>
                <div class="segmento">
                  @for (p of prioridades; track p) {
                    <label>
                      <input type="radio" name="prio-inline" [value]="p" [(ngModel)]="tareaForm.prioridad" />
                      <span class="punto" [attr.data-prio]="p" aria-hidden="true"></span>{{ prioridadLabel(p) }}
                    </label>
                  }
                </div>
              </fieldset>
            </div>
            <div class="campo-grupo">
              <label for="tarea-desc" class="etq-campo">Descripción <span class="opcional">(opcional)</span></label>
              <textarea id="tarea-desc" class="campo" rows="2" [(ngModel)]="tareaForm.descripcion"></textarea>
            </div>
            <div class="form-tarea-acciones">
              <button type="button" class="ctrl" (click)="cerrarFormularioTarea()">Cancelar</button>
              <button type="button" class="btn-primario" (click)="crearTarea()" [disabled]="!tareaForm.titulo">Crear tarea</button>
            </div>
          </div>
        }

        <div class="panel-cuerpo">
          @if (tareas().length) {
            <ul class="tareas">
              @for (t of tareas(); track t.id_tarea; let i = $index) {
                <li class="tarea" [attr.data-estado]="t.estado" [style.--i]="i">
                  <button type="button" class="tarea-check" [attr.data-estado]="t.estado"
                          (click)="cambiarEstado(t, nextEstado(t.estado))"
                          [attr.aria-label]="t.titulo + ': ' + estadoShort(t.estado) + '. Cambiar a ' + estadoShort(nextEstado(t.estado))"
                          [title]="'Cambiar a ' + estadoShort(nextEstado(t.estado))">
                    @if (t.estado === 'completada') {
                      <lucide-icon name="check" [size]="12" aria-hidden="true"></lucide-icon>
                    } @else if (t.estado === 'en_progreso') {
                      <span class="tarea-check-punto" aria-hidden="true"></span>
                    } @else if (t.estado === 'cancelada') {
                      <lucide-icon name="x" [size]="11" aria-hidden="true"></lucide-icon>
                    }
                  </button>
                  <div class="tarea-cuerpo">
                    <button type="button" class="tarea-titulo" (click)="verTarea(t)">{{ t.titulo }}</button>
                    <p class="tarea-meta">
                      <span class="prio" [attr.data-prio]="t.prioridad">
                        <span class="punto" aria-hidden="true"></span>{{ prioridadLabel(t.prioridad) }}
                      </span>
                      <span>{{ estadoShort(t.estado) }}</span>
                      @if (t.fecha_limite) {
                        <span [class.vencida]="vencida(t)">
                          {{ vencida(t) ? 'Venció' : 'Vence' }} <time [attr.datetime]="t.fecha_limite">{{ fechaCorta(t.fecha_limite) }}</time>
                        </span>
                      }
                      @if (t.asignado_a_nombre) {
                        <span>{{ t.asignado_a_nombre }}</span>
                      }
                    </p>
                  </div>
                  @if (!isReadonly()) {
                    <button type="button" class="ctrl-icono-sm tarea-borrar" (click)="eliminarTarea(t)"
                            [attr.aria-label]="'Eliminar tarea: ' + t.titulo" title="Eliminar tarea">
                      <lucide-icon name="trash-2" [size]="14" aria-hidden="true"></lucide-icon>
                    </button>
                  }
                </li>
              }
            </ul>
          } @else if (!agregandoTarea()) {
            <div class="vacio">
              <p class="vacio-titulo">Sin tareas</p>
              @if (isReadonly()) {
                <p class="vacio-sub">No se registraron tareas para esta reunión.</p>
              } @else {
                <p class="vacio-sub">Al generar el acta, la IA propone las tareas acordadas. También puedes crearlas tú.</p>
                <div class="vacio-acciones">
                  <button type="button" class="ctrl" (click)="alternarFormularioTarea()">
                    <lucide-icon name="plus" [size]="15" aria-hidden="true"></lucide-icon>Nueva tarea
                  </button>
                </div>
              }
            </div>
          }
        </div>
      </section>
    </div><!-- /mesa -->

    <!-- ══════════════ BARRA DE ESCRITURA (móvil, teclado abierto) ══════════════ -->
    @if (isMobileMode() && (notasFocused() || actaFocused())) {
      <div class="barra-escritura">
        <span class="barra-estado">
          @switch (estadoGuardado()) {
            @case ('guardando') { <span class="spinner" aria-hidden="true"></span>Guardando… }
            @case ('pendiente') { Sin guardar }
            @case ('guardado') { <lucide-icon name="check" [size]="13" aria-hidden="true"></lucide-icon>Guardado }
          }
        </span>
        @if (notasFocused() && !isReadonly()) {
          <button type="button" class="ctrl barra-accion" (mousedown)="$event.preventDefault()" (click)="redactarIA()"
                  [disabled]="redactando() || !a.notas_originales || rateLimitSecondsLeft() > 0">
            <lucide-icon name="sparkles" [size]="15" aria-hidden="true"></lucide-icon>Generar acta
          </button>
        }
        <button type="button" class="btn-primario" (click)="blurActiveTextarea()">Listo</button>
      </div>
    }

    <!-- ══════════════ HOJA DE ACCIONES (móvil) ══════════════
         Fuera de la cabecera y de los paneles: ningún ancestro con transform
         debe atrapar su position: fixed. -->
    @if (estadoOpen() && isMobileMode()) {
      <div class="velo" (click)="estadoOpen.set(false)" aria-hidden="true"></div>
      <div id="acciones-hoja" class="hoja" role="dialog" aria-modal="true" aria-labelledby="acciones-hoja-titulo"
           data-capa="acciones" (keydown)="atraparFoco($event)">
        <span class="hoja-asa" aria-hidden="true"></span>
        <div class="hoja-cab">
          <h2 id="acciones-hoja-titulo" class="hoja-titulo">Acciones del acta</h2>
          <button type="button" class="ctrl ctrl-icono" (click)="estadoOpen.set(false)" aria-label="Cerrar">
            <lucide-icon name="x" [size]="18" aria-hidden="true"></lucide-icon>
          </button>
        </div>
        <div class="hoja-cuerpo">
          <div class="hoja-seccion" role="group" aria-labelledby="hoja-estado-etq">
            <p id="hoja-estado-etq" class="etq">Estado</p>
            <button type="button" class="opcion" [attr.aria-pressed]="a.estado !== 'finalizada'"
                    [attr.data-autofocus]="a.estado !== 'finalizada' ? '' : null"
                    (click)="setEstado(a, 'borrador')">
              <span class="punto punto-borrador" aria-hidden="true"></span>
              <span class="menu-op-txt">
                <span class="menu-op-etq">Borrador</span>
                <span class="menu-op-sub">Se puede seguir editando</span>
              </span>
              @if (a.estado !== 'finalizada') {
                <lucide-icon name="check" [size]="18" class="menu-op-check" aria-hidden="true"></lucide-icon>
              }
            </button>
            <button type="button" class="opcion" [attr.aria-pressed]="a.estado === 'finalizada'"
                    [attr.data-autofocus]="a.estado === 'finalizada' ? '' : null"
                    (click)="setEstado(a, 'finalizada')">
              <span class="punto punto-final" aria-hidden="true"></span>
              <span class="menu-op-txt">
                <span class="menu-op-etq">Finalizada</span>
                <span class="menu-op-sub">Queda cerrada y en solo lectura</span>
              </span>
              @if (a.estado === 'finalizada') {
                <lucide-icon name="check" [size]="18" class="menu-op-check" aria-hidden="true"></lucide-icon>
              }
            </button>
          </div>
          <div class="hoja-seccion" role="group" aria-labelledby="hoja-export-etq">
            <p id="hoja-export-etq" class="etq">Exportar</p>
            <div class="hoja-fila">
              <button type="button" class="ctrl ctrl-bloque" (click)="exportar('pdf'); estadoOpen.set(false)">
                <lucide-icon name="download" [size]="16" aria-hidden="true"></lucide-icon>PDF
              </button>
              <button type="button" class="ctrl ctrl-bloque" (click)="exportar('docx'); estadoOpen.set(false)">
                <lucide-icon name="download" [size]="16" aria-hidden="true"></lucide-icon>Word
              </button>
            </div>
          </div>
          @if (!isReadonly()) {
            <button type="button" class="ctrl ctrl-bloque" [disabled]="guardando()" (click)="guardar(); estadoOpen.set(false)">
              Guardar ahora
            </button>
          }
        </div>
      </div>
    }

    <!-- ══════════════ NUEVA TAREA — hoja móvil ══════════════ -->
    @if (agregandoTarea() && isMobileMode()) {
      <div class="velo" (click)="cerrarFormularioTarea()" aria-hidden="true"></div>
      <div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-tarea-titulo"
           data-capa="tarea" (keydown)="atraparFoco($event)">
        <span class="hoja-asa" aria-hidden="true"></span>
        <div class="hoja-cab">
          <h2 id="hoja-tarea-titulo" class="hoja-titulo">Nueva tarea</h2>
          <button type="button" class="ctrl ctrl-icono" (click)="cerrarFormularioTarea()" aria-label="Cerrar">
            <lucide-icon name="x" [size]="18" aria-hidden="true"></lucide-icon>
          </button>
        </div>
        <div class="hoja-cuerpo">
          <div class="campo-grupo">
            <label for="hoja-tarea-input" class="etq-campo">Título <span class="req" aria-hidden="true">*</span></label>
            <input id="hoja-tarea-input" class="campo" data-autofocus required aria-required="true"
                   autocomplete="off" enterkeyhint="done" placeholder="¿Qué hay que hacer?"
                   [(ngModel)]="tareaForm.titulo" />
          </div>
          <fieldset class="campo-grupo">
            <legend class="etq-campo">Prioridad</legend>
            <div class="segmento">
              @for (p of prioridades; track p) {
                <label>
                  <input type="radio" name="prio-hoja" [value]="p" [(ngModel)]="tareaForm.prioridad" />
                  <span class="punto" [attr.data-prio]="p" aria-hidden="true"></span>{{ prioridadLabel(p) }}
                </label>
              }
            </div>
          </fieldset>
          <div class="campo-grupo">
            <label for="hoja-tarea-desc" class="etq-campo">Descripción <span class="opcional">(opcional)</span></label>
            <textarea id="hoja-tarea-desc" class="campo" rows="3" [(ngModel)]="tareaForm.descripcion"></textarea>
          </div>
          <!-- Fecha al final: el calendario se despliega en línea y tiene todo el
               espacio inferior de la hoja sin recortarse. -->
          <div class="campo-grupo" role="group" aria-labelledby="etq-fecha-hoja">
            <span id="etq-fecha-hoja" class="etq-campo">Fecha límite</span>
            <app-date-picker class="selector-fecha"
                             [(ngModel)]="tareaForm.fecha_limite"
                             placeholder="Sin fecha límite"
                             colorScheme="violet"
                             [fieldLike]="true"
                             [inlineOnMobile]="true"></app-date-picker>
          </div>
        </div>
        <div class="hoja-pie">
          <button type="button" class="ctrl" (click)="cerrarFormularioTarea()">Cancelar</button>
          <button type="button" class="btn-primario hoja-pie-principal" (click)="crearTarea()" [disabled]="!tareaForm.titulo">
            <lucide-icon name="plus" [size]="16" aria-hidden="true"></lucide-icon>Crear tarea
          </button>
        </div>
      </div>
    }

    <!-- ══════════════ DIÁLOGO: eliminar tarea ══════════════ -->
    @if (tareaAEliminar(); as tDel) {
      <div class="dialogo-capa" (click)="cancelarEliminarTarea()">
        <div class="dialogo" role="alertdialog" aria-modal="true"
             aria-labelledby="dlg-eliminar-titulo" aria-describedby="dlg-eliminar-texto"
             data-capa="eliminar" (click)="$event.stopPropagation()" (keydown)="atraparFoco($event)">
          <h2 id="dlg-eliminar-titulo" class="dialogo-titulo">Eliminar tarea</h2>
          <p id="dlg-eliminar-texto" class="dialogo-texto">Esta acción no se puede deshacer.</p>
          <p class="dialogo-objetivo">{{ tDel.titulo }}</p>
          <div class="dialogo-acciones">
            <button type="button" class="ctrl" data-autofocus
                    [disabled]="eliminandoTarea()" (click)="cancelarEliminarTarea()">Cancelar</button>
            <button type="button" class="btn-primario btn-peligro"
                    [disabled]="eliminandoTarea()" (click)="confirmarEliminarTarea()">
              @if (eliminandoTarea()) { <span class="spinner" aria-hidden="true"></span>Eliminando… } @else { Eliminar }
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══════════════ DIÁLOGO: generar de nuevo ══════════════ -->
    @if (confirmRegenerar()) {
      <div class="dialogo-capa" (click)="confirmRegenerar.set(false)">
        <div class="dialogo" role="alertdialog" aria-modal="true"
             aria-labelledby="dlg-regen-titulo" aria-describedby="dlg-regen-texto"
             data-capa="regenerar" (click)="$event.stopPropagation()" (keydown)="atraparFoco($event)">
          <h2 id="dlg-regen-titulo" class="dialogo-titulo">¿Generar el acta de nuevo?</h2>
          <p id="dlg-regen-texto" class="dialogo-texto">
            La versión actual se reemplaza por una nueva. Podrás deshacerlo desde el aviso que aparece después.
          </p>
          <div class="dialogo-acciones">
            <button type="button" class="ctrl" (click)="confirmRegenerar.set(false)">Cancelar</button>
            <button type="button" class="btn-primario" data-autofocus (click)="confirmarRegenerar()">
              <lucide-icon name="sparkles" [size]="15" aria-hidden="true"></lucide-icon>Generar de nuevo
            </button>
          </div>
        </div>
      </div>
    }

    <!-- ══════════════ CAJÓN: detalle de tarea (≥ 768 px) ══════════════ -->
    @if (tareaDrawerId()) {
      <div class="velo" (click)="tareaDrawerId.set(null)" aria-hidden="true"></div>
      <aside class="cajon" aria-label="Detalle de la tarea">
        <app-tarea-detail-panel
          [tareaId]="tareaDrawerId()!"
          [modoDrawer]="true"
          (cerrar)="tareaDrawerId.set(null)"
          (tareaActualizada)="onTareaActualizadaEnDrawer($event)"
          (tareaEliminada)="onTareaEliminadaEnDrawer($event)"
        />
      </aside>
    }

  } @else if (cargaError()) {

    <!-- ══════════════ ERROR DE CARGA ══════════════ -->
    <div class="estado-carga" role="alert">
      <lucide-icon name="alert-circle" [size]="24" class="ico-neg" aria-hidden="true"></lucide-icon>
      <h1 class="estado-carga-titulo">No se pudo abrir el acta</h1>
      <p class="estado-carga-sub">Puede que ya no exista o que se haya perdido la conexión.</p>
      <div class="vacio-acciones">
        <button type="button" class="ctrl" (click)="volver()">
          <lucide-icon name="arrow-left" [size]="15" aria-hidden="true"></lucide-icon>Volver a actas
        </button>
        <button type="button" class="btn-primario" (click)="cargar()">
          <lucide-icon name="refresh-cw" [size]="15" aria-hidden="true"></lucide-icon>Reintentar
        </button>
      </div>
    </div>

  } @else {

    <!-- ══════════════ CARGANDO ══════════════ -->
    <div class="cargando" role="status" aria-label="Cargando acta">
      <div class="cargando-cab">
        <span class="sk sk-icono"></span>
        <div class="cargando-titulos">
          <span class="sk sk-ceja"></span>
          <span class="sk sk-titulo"></span>
          <span class="sk sk-senas"></span>
        </div>
      </div>
      <div class="cargando-paneles">
        <span class="sk"></span><span class="sk"></span><span class="sk"></span>
      </div>
    </div>
  }

    <!-- ══════════════ AVISO (toast) ══════════════ -->
    @if (toast(); as t) {
      <div class="toast" [attr.data-tipo]="t.type" [attr.role]="t.type === 'error' ? 'alert' : 'status'">
        <lucide-icon class="toast-icono" aria-hidden="true" [size]="16"
                     [name]="t.type === 'error' ? 'alert-circle' : t.type === 'success' ? 'check' : 'info'"></lucide-icon>
        <p class="toast-msg">{{ t.msg }}</p>
        @if (t.action) {
          <button type="button" class="toast-accion" (click)="ejecutarToastAction()">{{ t.action.label }}</button>
        }
        <button type="button" class="ctrl-icono-sm" (click)="toast.set(null)" aria-label="Cerrar aviso">
          <lucide-icon name="x" [size]="14" aria-hidden="true"></lucide-icon>
        </button>
      </div>
    }
  </div>
  `,
  styles: [`
    /* ── Alias locales ─────────────────────────────────────────────────
       Todo deriva de reportes-tokens.scss: aquí solo se mezclan tokens para
       los fondos tenues, no se introduce ningún color nuevo. */
    :host {
      height: 100%;
      --acento-tenue: color-mix(in oklch, var(--acento) 10%, var(--superficie));
      --acento-borde: color-mix(in oklch, var(--acento) 55%, var(--linea));
      --pos-tenue:    color-mix(in oklch, var(--pos) 9%, var(--superficie));
      --neg-tenue:    color-mix(in oklch, var(--neg) 10%, var(--superficie));
      /* Texto sobre un relleno sólido de acento/peligro. La superficie da
         contraste AA en ambos temas: blanco sobre violeta oscuro en claro,
         slate-900 sobre violeta claro en oscuro. */
      --sobre-solido: var(--superficie);
      --radio-panel: 0.75rem;
      --radio-ctrl: 0.5rem;
      --ease: var(--ease-out-strong, cubic-bezier(0.23, 1, 0.32, 1));
      --ease-hoja: cubic-bezier(0.32, 0.72, 0, 1);
    }

    .editor {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      height: 100%;
      min-height: 0;
      width: 100%;
      max-width: 110rem;
      margin-inline: auto;
      color: var(--txt-1);
      font-family: var(--font-sans);
    }

    lucide-icon { display: inline-flex; flex-shrink: 0; }
    .sr-only {
      position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
    }
    .solo-movil { display: none; }
    .ico-pos { color: var(--pos); }
    .ico-neg { color: var(--neg); }

    :where(button, input, textarea, [tabindex]):focus-visible {
      outline: 2px solid var(--acento);
      outline-offset: 2px;
    }

    /* ── Controles ───────────────────────────────────────────────────
       Mismo control que Reportes: filete, sin sombra. Un único relleno de
       acento por zona (Generar acta) marca la acción principal. */
    .ctrl, .btn-primario {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.4375rem;
      height: 2.25rem; padding-inline: 0.75rem;
      border: 1px solid var(--linea); border-radius: var(--radio-ctrl);
      background: var(--superficie); color: var(--txt-2);
      font-family: inherit; font-size: 0.8125rem; font-weight: 500; line-height: 1;
      white-space: nowrap; cursor: pointer; touch-action: manipulation;
      transition: border-color 140ms var(--ease), color 140ms var(--ease),
                  background-color 140ms var(--ease), transform 120ms var(--ease);
    }
    .ctrl:active:not(:disabled), .btn-primario:active:not(:disabled) { transform: scale(0.97); }
    .ctrl:disabled, .btn-primario:disabled { opacity: 0.45; cursor: not-allowed; }
    @media (hover: hover) and (pointer: fine) {
      .ctrl:hover:not(:disabled) { border-color: var(--txt-4); color: var(--txt-1); }
      .btn-primario:hover:not(:disabled) { background: color-mix(in oklch, var(--acento) 86%, var(--txt-1)); }
    }
    .ctrl-icono { width: 2.25rem; padding-inline: 0; }
    .ctrl-sm { height: 2rem; padding-inline: 0.625rem; font-size: 0.75rem; }
    .ctrl-bloque { width: 100%; height: 2.75rem; font-size: 0.875rem; }

    .btn-primario {
      border-color: transparent;
      background: var(--acento);
      color: var(--sobre-solido);
      font-weight: 600;
    }
    .btn-peligro { background: var(--neg); }
    @media (hover: hover) and (pointer: fine) {
      .btn-peligro:hover:not(:disabled) { background: color-mix(in oklch, var(--neg) 86%, var(--txt-1)); }
    }

    .ctrl-icono-sm {
      position: relative;
      display: inline-grid; place-items: center; flex-shrink: 0;
      width: 2rem; height: 2rem; border-radius: 0.375rem;
      border: 0; background: transparent; color: var(--txt-3); cursor: pointer;
      transition: color 140ms var(--ease), background-color 140ms var(--ease), opacity 140ms var(--ease);
    }
    @media (hover: hover) and (pointer: fine) {
      .ctrl-icono-sm:hover { color: var(--txt-1); background: var(--superficie-alt); }
    }

    .kbd {
      display: inline-flex; align-items: center;
      padding: 0.1875rem 0.3125rem;
      font: 500 0.6875rem/1 var(--font-mono);
      color: var(--txt-2);
      background: var(--superficie-alt);
      border: 1px solid var(--linea);
      border-radius: 0.25rem;
    }
    .kbd-solido {
      color: inherit; background: transparent;
      border-color: color-mix(in oklch, var(--sobre-solido) 40%, transparent);
    }

    /* En táctil el blanco de 36 px se queda corto del mínimo de 44 px; con
       puntero fino la densidad de escritorio es la correcta. */
    @media (pointer: coarse) {
      .ctrl, .btn-primario, .ctrl-sm { min-height: 2.75rem; }
      .ctrl-icono { width: 2.75rem; height: 2.75rem; }
      .ctrl-icono-sm { width: 2.75rem; height: 2.75rem; }
      .kbd { display: none; }
    }

    .spinner {
      display: inline-block; flex-shrink: 0;
      width: 0.8125rem; height: 0.8125rem; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent;
      animation: gira 650ms linear infinite;
    }
    @keyframes gira { to { transform: rotate(360deg); } }

    .punto { display: inline-block; flex-shrink: 0; width: 0.4375rem; height: 0.4375rem; border-radius: 50%; background: currentColor; }
    .punto-borrador { background: var(--aviso); }
    .punto-final    { background: var(--pos); }

    /* ── Cabecera ──────────────────────────────────────────────────────
       El título es el contenido de la pantalla: peso de título, con las señas
       (fecha, estado, guardado) debajo como anotaciones al margen. */
    .cab {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: start;
      gap: 0.75rem 1rem;
      flex-shrink: 0;
    }
    .cab-volver { margin-top: 0.125rem; }
    .cab-ceja {
      font-size: 0.6875rem; font-weight: 600;
      letter-spacing: 0.08em; text-transform: uppercase;
      color: var(--acento);
    }
    .cab-titulo {
      margin-top: 0.125rem;
      font-family: var(--font-display);
      font-size: 1.625rem; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em;
      color: var(--txt-1);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .senas {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.625rem;
      margin-top: 0.4375rem;
      font-size: 0.75rem; color: var(--txt-2);
    }
    .sena { display: inline-flex; align-items: center; gap: 0.3125rem; }
    .sena lucide-icon { color: var(--txt-3); }
    /* Punto medio como separador: menos ruido que una píldora por dato. */
    .sena + .sena::before { content: '·'; margin-right: 0.3125rem; color: var(--txt-4); }
    .sena:empty { display: none; }
    .sena-estado { color: var(--txt-1); font-weight: 600; }
    .sena-estado[data-estado="borrador"] .punto { background: var(--aviso); }
    .sena-estado[data-estado="finalizada"] .punto { background: var(--pos); }
    .sena-guardado { font-variant-numeric: tabular-nums; }

    .cab-acciones {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 0.5rem;
    }
    .grupo-export { display: inline-flex; }
    .grupo-export .ctrl { position: relative; }
    .grupo-export .ctrl:first-child { border-start-end-radius: 0; border-end-end-radius: 0; }
    .grupo-export .ctrl + .ctrl { margin-inline-start: -1px; border-start-start-radius: 0; border-end-start-radius: 0; }
    .grupo-export .ctrl:hover, .grupo-export .ctrl:focus-visible { z-index: 1; }

    .ctrl-estado-txt { display: inline-flex; align-items: center; gap: 0.4375rem; }
    .ctrl-estado[data-estado="borrador"] { color: var(--txt-1); font-weight: 600; }
    .chevron { color: var(--txt-3); transition: transform 180ms var(--ease); }
    .chevron.girado { transform: rotate(180deg); }

    .estado-wrap { position: relative; }
    .menu {
      position: absolute; top: calc(100% + 0.375rem); right: 0;
      z-index: var(--z-dropdown, 30);
      min-width: 17rem; padding: 0.375rem;
      background: var(--superficie);
      border: 1px solid var(--linea); border-radius: 0.75rem;
      box-shadow: var(--shadow-card-hover);
      transform-origin: top right;
      animation: entra-menu 160ms var(--ease);
    }
    @keyframes entra-menu { from { opacity: 0; transform: translateY(-4px) scale(0.98); } }
    .menu-titulo {
      padding: 0.375rem 0.625rem 0.25rem;
      font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
      color: var(--txt-2);
    }
    .menu-op, .opcion {
      display: flex; align-items: center; gap: 0.75rem;
      width: 100%; padding: 0.625rem;
      border: 1px solid transparent; border-radius: 0.5rem;
      background: transparent; color: var(--txt-1);
      font-family: inherit; text-align: left; cursor: pointer;
      transition: background-color 120ms var(--ease), border-color 120ms var(--ease);
    }
    .menu-op:hover, .menu-op:focus-visible { background: var(--superficie-alt); }
    .menu-op:focus-visible { outline-offset: -2px; }
    .menu-op-txt { display: flex; flex-direction: column; gap: 0.125rem; flex: 1; min-width: 0; }
    .menu-op-etq { font-size: 0.875rem; font-weight: 600; }
    .menu-op-sub { font-size: 0.75rem; color: var(--txt-2); }
    .menu-op-check { color: var(--acento); }
    .menu-op[aria-checked="true"] .menu-op-etq { color: var(--acento); }

    /* ── Aviso de solo lectura ── */
    .aviso-lectura {
      display: flex; align-items: center; gap: 0.625rem;
      padding: 0.4375rem 0.4375rem 0.4375rem 0.875rem;
      border: 1px solid var(--linea); border-radius: var(--radio-panel);
      background: var(--pos-tenue);
      font-size: 0.8125rem; color: var(--txt-1);
      flex-shrink: 0;
    }
    .aviso-lectura p { flex: 1; min-width: 0; }
    .aviso-lectura strong { font-weight: 700; }

    /* ── Pestañas (solo móvil) ── */
    .pestanas { display: none; }
    .pestana {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem;
      height: 2.75rem; min-width: 0;
      border: 1px solid transparent; border-radius: 0.5rem;
      background: transparent; color: var(--txt-2);
      font-family: inherit; font-size: 0.8125rem; font-weight: 600;
      cursor: pointer; touch-action: manipulation;
      transition: background-color 160ms var(--ease), color 160ms var(--ease), border-color 160ms var(--ease);
    }
    .pestana.activa { background: var(--superficie); border-color: var(--linea); color: var(--txt-1); }
    .pestana:focus-visible { outline-offset: -2px; }
    .pestana-cifra {
      display: inline-grid; place-items: center;
      min-width: 1.25rem; height: 1.25rem; padding-inline: 0.3125rem;
      border-radius: 999px;
      font: 600 0.6875rem/1 var(--font-mono);
      background: var(--acento-tenue); color: var(--acento);
    }

    /* ── Mesa de trabajo ──────────────────────────────────────────────
       ≥ 1280 px: tres columnas, nada de scroll de página (cada panel lo
       lleva dentro). 768–1279: notas y acta lado a lado, tareas como
       franja inferior. */
    .mesa {
      flex: 1 1 0; min-height: 0;
      display: grid;
      gap: 0.75rem;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
      grid-template-rows: minmax(0, 1fr) auto;
      grid-template-areas: "notas acta" "tareas tareas";
    }
    .panel-notas  { grid-area: notas; }
    .panel-acta   { grid-area: acta; }
    .panel-tareas { grid-area: tareas; }
    @media (min-width: 1280px) {
      .mesa {
        grid-template-columns: minmax(15rem, 1fr) minmax(0, 1.4fr) minmax(15rem, 0.85fr);
        grid-template-rows: minmax(0, 1fr);
        grid-template-areas: "notas acta tareas";
      }
    }

    /* Etiqueta pequeña en mayúsculas (secciones de la hoja de acciones). */
    .etq {
      font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase;
      color: var(--txt-2);
    }

    /* ── Paneles ───────────────────────────────────────────────────────
       Un filete, sin sombra ni franjas de color: el contenido es lo que
       separa. El panel donde se escribe se marca con el acento. */
    .panel {
      display: flex; flex-direction: column;
      min-width: 0; min-height: 0;
      background: var(--superficie);
      border: 1px solid var(--linea); border-radius: var(--radio-panel);
      overflow: hidden;
      transition: border-color 160ms var(--ease), box-shadow 160ms var(--ease);
    }
    .panel:has(.texto:focus) { border-color: var(--acento); box-shadow: 0 0 0 1px var(--acento); }
    .panel-cab {
      display: flex; align-items: center; gap: 0.75rem;
      min-height: 3.5rem; padding: 0.625rem 0.75rem 0.625rem 1rem;
      border-bottom: 1px solid var(--linea-suave);
      flex-shrink: 0;
    }
    .panel-cab-txt { flex: 1; min-width: 0; }
    .panel-titulo {
      display: flex; align-items: baseline; gap: 0.4375rem;
      font-family: var(--font-display);
      font-size: 1rem; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2;
      color: var(--txt-1);
    }
    .cifra-titulo {
      font-family: var(--font-mono); font-size: 0.75rem; font-weight: 500;
      font-variant-numeric: tabular-nums; color: var(--txt-2);
    }
    .panel-sub {
      margin-top: 0.125rem;
      font-size: 0.75rem; color: var(--txt-2);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .panel-cuerpo {
      position: relative;
      flex: 1; min-height: 0;
      overflow-y: auto; overscroll-behavior: contain;
      scrollbar-width: thin; scrollbar-color: var(--linea) transparent;
    }

    .texto {
      display: block; flex: 1; min-height: 0;
      width: 100%; height: 100%;
      padding: 1rem 1.125rem 1.5rem;
      border: 0; outline: 0; resize: none;
      background: transparent; color: var(--txt-1);
      font-family: var(--font-sans); font-size: 0.9375rem; line-height: 1.7;
      caret-color: var(--acento);
      scrollbar-width: thin; scrollbar-color: var(--linea) transparent;
    }
    .texto:focus-visible { outline: none; }
    .texto::placeholder { color: var(--txt-2); }
    .texto[readonly] { cursor: default; }
    .texto-notas { font-family: var(--font-mono); font-size: 0.875rem; line-height: 1.75; }
    .texto-acta.oculto {
      position: absolute; width: 1px; height: 1px; padding: 0;
      opacity: 0; pointer-events: none; overflow: hidden;
    }

    /* ── Acta: vista de documento ──────────────────────────────────────
       El HTML llega por innerHTML y no lleva el atributo de encapsulación,
       así que los selectores interiores necesitan ::ng-deep (acotado a
       .prosa). Sin esto el preflight de Tailwind dejaba títulos y listas
       como texto plano. */
    .prosa {
      max-width: 72ch;
      padding: 1.25rem 1.5rem 2.5rem;
      font-size: 0.9375rem; line-height: 1.75;
      color: var(--txt-1);
      overflow-wrap: anywhere;
    }
    .prosa.editable { cursor: text; }
    .prosa ::ng-deep > :first-child { margin-top: 0; }
    .prosa ::ng-deep h1 {
      margin: 1.75rem 0 0.75rem;
      font-family: var(--font-display); font-size: 1.3125rem; font-weight: 800;
      line-height: 1.2; letter-spacing: -0.02em; text-wrap: balance;
    }
    .prosa ::ng-deep h2 {
      margin: 1.625rem 0 0.5rem;
      font-family: var(--font-display); font-size: 1.0625rem; font-weight: 700;
      line-height: 1.3; letter-spacing: -0.01em; text-wrap: balance;
    }
    .prosa ::ng-deep h3 {
      margin: 1.25rem 0 0.375rem;
      font-size: 0.9375rem; font-weight: 600; color: var(--txt-2);
    }
    .prosa ::ng-deep p { margin: 0 0 0.875rem; text-wrap: pretty; }
    .prosa ::ng-deep strong { font-weight: 700; }
    .prosa ::ng-deep em { font-style: italic; }
    .prosa ::ng-deep ul, .prosa ::ng-deep ol { margin: 0.25rem 0 1rem; padding-left: 1.25rem; }
    .prosa ::ng-deep ul { list-style: disc; }
    .prosa ::ng-deep ol { list-style: decimal; }
    .prosa ::ng-deep li { margin-block: 0.3125rem; padding-left: 0.25rem; }
    .prosa ::ng-deep ul li::marker { color: var(--acento); }
    .prosa ::ng-deep ol li::marker { color: var(--txt-2); font-variant-numeric: tabular-nums; }
    .prosa ::ng-deep hr { margin: 1.5rem 0; border: 0; border-top: 1px solid var(--linea); }

    .generando { padding: 1.25rem 1.5rem; }
    .generando-titulo {
      display: flex; align-items: center; gap: 0.5rem;
      font-size: 0.875rem; font-weight: 600; color: var(--txt-1);
    }
    .generando-titulo .spinner { color: var(--acento); }
    .generando-sub { margin-top: 0.25rem; font-size: 0.8125rem; color: var(--txt-2); }
    /* El esqueleto imita la forma del documento: título, párrafo, subtítulo, párrafo. */
    .esqueleto { display: grid; gap: 0.625rem; max-width: 34rem; margin-top: 1.5rem; }
    .esqueleto span {
      display: block; height: 0.625rem; border-radius: 999px;
      background: var(--acento-tenue);
      animation: respira 1.4s ease-in-out infinite;
    }
    .esqueleto span:nth-child(1) { width: 45%; height: 0.875rem; margin-bottom: 0.25rem; }
    .esqueleto span:nth-child(2) { width: 100%; }
    .esqueleto span:nth-child(3) { width: 93%; }
    .esqueleto span:nth-child(4) { width: 97%; }
    .esqueleto span:nth-child(5) { width: 62%; }
    .esqueleto span:nth-child(6) { width: 36%; height: 0.75rem; margin-top: 0.75rem; }
    .esqueleto span:nth-child(7) { width: 100%; }
    .esqueleto span:nth-child(8) { width: 84%; }
    @keyframes respira { 50% { opacity: 0.45; } }

    .vacio {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.375rem; min-height: 100%;
      padding: 2rem 1.25rem; text-align: center;
    }
    .vacio-ico { color: var(--txt-3); margin-bottom: 0.25rem; }
    .vacio-titulo { font-size: 0.875rem; font-weight: 600; color: var(--txt-1); }
    .vacio-sub { max-width: 32ch; font-size: 0.8125rem; line-height: 1.5; color: var(--txt-2); text-wrap: pretty; }
    .vacio-acciones { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; margin-top: 0.75rem; }

    /* ── Tareas ── */
    .form-tarea {
      /* z-index propio: la lista de abajo anima opacidad (crea contextos de
         apilamiento) y sin esto se pintaría encima del calendario. */
      position: relative; z-index: 2;
      display: grid; gap: 0.75rem;
      padding: 0.875rem 1rem 1rem;
      border-bottom: 1px solid var(--linea);
      background: var(--superficie-alt);
      flex-shrink: 0;
      /* Solo opacidad: un transform persistente desplazaría el popover fijo. */
      animation: aparece 160ms var(--ease);
    }
    .form-tarea-fila { display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr)); gap: 0.75rem; }
    .form-tarea-acciones { display: flex; justify-content: flex-end; gap: 0.5rem; }
    @keyframes aparece { from { opacity: 0; } }

    .campo-grupo { display: grid; gap: 0.375rem; min-width: 0; margin: 0; padding: 0; border: 0; }
    .etq-campo { padding: 0; font-size: 0.75rem; font-weight: 600; color: var(--txt-2); }
    .req { color: var(--neg); }
    .opcional { font-weight: 400; }
    .campo {
      width: 100%; height: 2.25rem; padding-inline: 0.75rem;
      border: 1px solid var(--linea); border-radius: var(--radio-ctrl);
      background: var(--superficie); color: var(--txt-1);
      font-family: inherit; font-size: 0.875rem;
      transition: border-color 140ms var(--ease), box-shadow 140ms var(--ease);
    }
    textarea.campo { height: auto; min-height: 4rem; padding-block: 0.5rem; line-height: 1.5; resize: vertical; }
    .campo::placeholder { color: var(--txt-2); }
    .campo:focus { outline: none; border-color: var(--acento); box-shadow: 0 0 0 3px var(--acento-tenue); }
    .selector-fecha { display: block; width: 100%; }

    .segmento {
      display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.25rem;
      padding: 0.1875rem;
      border: 1px solid var(--linea); border-radius: var(--radio-ctrl);
      background: var(--superficie);
    }
    .segmento label {
      position: relative;
      display: flex; align-items: center; justify-content: center; gap: 0.375rem;
      height: 1.75rem; border-radius: 0.3125rem;
      font-size: 0.8125rem; font-weight: 500; color: var(--txt-2);
      cursor: pointer;
      transition: background-color 140ms var(--ease), color 140ms var(--ease);
    }
    .segmento input { position: absolute; inset: 0; margin: 0; opacity: 0; cursor: pointer; }
    .segmento label:has(input:checked) { background: var(--acento-tenue); color: var(--txt-1); font-weight: 600; }
    .segmento label:has(input:focus-visible) { outline: 2px solid var(--acento); outline-offset: 1px; }
    .punto[data-prio="alta"]  { background: var(--neg); }
    .punto[data-prio="media"] { background: var(--aviso); }
    .punto[data-prio="baja"]  { background: var(--txt-3); }

    .tareas { margin: 0; padding: 0.375rem; list-style: none; }
    .tarea {
      display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: start;
      gap: 0.625rem;
      padding: 0.625rem 0.375rem 0.625rem 0.625rem;
      border-radius: var(--radio-ctrl);
      transition: background-color 140ms var(--ease);
      animation: entra-fila 200ms var(--ease) both;
      animation-delay: calc(min(var(--i, 0), 8) * 30ms);
    }
    .tarea + .tarea { box-shadow: 0 -1px 0 var(--linea-suave); }
    @keyframes entra-fila { from { opacity: 0; transform: translateY(4px); } }
    @media (hover: hover) and (pointer: fine) {
      .tarea:hover { background: var(--superficie-alt); }
    }

    .tarea-check {
      position: relative;
      display: grid; place-items: center;
      width: 1.25rem; height: 1.25rem; margin-top: 0.0625rem;
      border: 1.5px solid var(--txt-4); border-radius: 50%;
      background: transparent; color: transparent; cursor: pointer;
      transition: background-color 160ms var(--ease), border-color 160ms var(--ease),
                  color 160ms var(--ease), transform 120ms var(--ease);
    }
    .tarea-check::after { content: ''; position: absolute; inset: -0.75rem; }
    .tarea-check:active { transform: scale(0.9); }
    @media (hover: hover) and (pointer: fine) {
      .tarea-check[data-estado="pendiente"]:hover { border-color: var(--acento); }
    }
    .tarea-check[data-estado="en_progreso"] { border-color: var(--acento); color: var(--acento); }
    .tarea-check[data-estado="completada"]  { border-color: var(--pos); background: var(--pos); color: var(--sobre-solido); }
    .tarea-check[data-estado="cancelada"]   { border-color: var(--txt-4); color: var(--txt-3); }
    .tarea-check-punto { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: currentColor; }

    .tarea-cuerpo { min-width: 0; }
    .tarea-titulo {
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
      max-width: 100%; padding: 0; border: 0; background: transparent;
      font-family: inherit; font-size: 0.875rem; font-weight: 500; line-height: 1.4;
      color: var(--txt-1); text-align: left; cursor: pointer;
      text-decoration-line: underline; text-decoration-color: transparent; text-underline-offset: 0.2em;
      transition: color 120ms var(--ease), text-decoration-color 120ms var(--ease);
    }
    @media (hover: hover) and (pointer: fine) {
      .tarea-titulo:hover { color: var(--acento); text-decoration-color: currentColor; }
    }
    .tarea[data-estado="completada"] .tarea-titulo,
    .tarea[data-estado="cancelada"] .tarea-titulo {
      color: var(--txt-2); text-decoration-line: line-through; text-decoration-color: var(--txt-3);
    }
    .tarea-meta {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.125rem 0.5rem;
      margin-top: 0.25rem;
      font-size: 0.75rem; color: var(--txt-2);
    }
    .tarea-meta > * + *::before { content: '·'; margin-right: 0.5rem; color: var(--txt-4); }
    .prio { display: inline-flex; align-items: center; gap: 0.3125rem; }
    .vencida { color: var(--neg); font-weight: 600; }

    /* El borrado no compite con la tarea: aparece al pasar o al llegar con el
       teclado; en táctil está siempre visible. */
    .tarea-borrar { opacity: 0; }
    .tarea:hover .tarea-borrar, .tarea:focus-within .tarea-borrar { opacity: 1; }
    .tarea-borrar:hover, .tarea-borrar:focus-visible { color: var(--neg); background: var(--neg-tenue); }
    @media (hover: none), (pointer: coarse) { .tarea-borrar { opacity: 1; } }

    /* ── Hojas inferiores (móvil) ── */
    .velo {
      position: fixed; inset: 0;
      z-index: var(--z-modal-backdrop, 50);
      background: var(--velo);
      animation: aparece 180ms var(--ease);
    }
    .hoja {
      position: fixed; left: 0; right: 0; bottom: 0;
      z-index: var(--z-modal, 60);
      display: flex; flex-direction: column;
      max-height: 90dvh;
      padding-bottom: max(1rem, env(safe-area-inset-bottom));
      background: var(--superficie);
      border: 1px solid var(--linea); border-bottom: 0;
      border-radius: 1rem 1rem 0 0;
      box-shadow: var(--shadow-card-hover);
      /* Sin fill-mode: al terminar no queda transform aplicado. */
      animation: sube 260ms var(--ease-hoja);
    }
    @keyframes sube { from { transform: translateY(100%); } }
    .hoja-asa { display: block; width: 2.5rem; height: 0.25rem; margin: 0.625rem auto 0; border-radius: 999px; background: var(--linea); }
    .hoja-cab {
      display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
      padding: 0.5rem 0.75rem 0.5rem 1.25rem;
    }
    .hoja-titulo { font-family: var(--font-display); font-size: 1.125rem; font-weight: 700; color: var(--txt-1); }
    .hoja-cuerpo {
      flex: 1; min-height: 0; overflow-y: auto;
      display: flex; flex-direction: column; gap: 1.25rem;
      padding: 0.25rem 1.25rem 1.25rem;
    }
    .hoja-seccion { display: flex; flex-direction: column; gap: 0.5rem; }
    .hoja-fila { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
    .hoja-pie { display: flex; gap: 0.75rem; padding: 0.75rem 1.25rem 0; border-top: 1px solid var(--linea); }
    .hoja-pie .ctrl, .hoja-pie .btn-primario { height: 3rem; font-size: 0.9375rem; }
    .hoja-pie-principal { flex: 1; }
    .opcion { min-height: 3.75rem; padding: 0.75rem 0.875rem; border-color: var(--linea); }
    .opcion[aria-pressed="true"] { border-color: var(--acento-borde); background: var(--acento-tenue); }
    .hoja .campo { height: 2.75rem; font-size: 1rem; }
    .hoja textarea.campo { height: auto; }
    .hoja .segmento label { height: 2.5rem; font-size: 0.875rem; }

    /* ── Diálogos ── */
    .dialogo-capa {
      position: fixed; inset: 0;
      z-index: var(--z-modal, 60);
      display: grid; place-items: center;
      padding: 1rem;
      background: var(--velo);
      animation: aparece 160ms var(--ease);
    }
    .dialogo {
      width: 100%; max-width: 25rem;
      padding: 1.25rem 1.25rem 1rem;
      background: var(--superficie);
      border: 1px solid var(--linea); border-radius: 0.875rem;
      box-shadow: var(--shadow-card-hover);
      animation: entra-dialogo 200ms var(--ease);
    }
    @keyframes entra-dialogo { from { opacity: 0; transform: translateY(6px) scale(0.98); } }
    .dialogo-titulo { font-family: var(--font-display); font-size: 1.125rem; font-weight: 700; line-height: 1.25; color: var(--txt-1); }
    .dialogo-texto { margin-top: 0.375rem; font-size: 0.875rem; line-height: 1.5; color: var(--txt-2); }
    .dialogo-objetivo {
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden;
      margin-top: 0.875rem; padding: 0.5rem 0.75rem;
      background: var(--superficie-alt);
      border: 1px solid var(--linea); border-radius: var(--radio-ctrl);
      font-size: 0.875rem; font-weight: 500; color: var(--txt-1); overflow-wrap: anywhere;
    }
    .dialogo-acciones { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem; }

    /* ── Cajón de detalle de tarea ── */
    .cajon {
      position: fixed; top: 0; right: 0; bottom: 0;
      z-index: var(--z-modal, 60);
      display: flex; flex-direction: column;
      width: min(30rem, 100vw);
      padding: 1.25rem;
      overflow-y: auto;
      background: var(--superficie);
      border-inline-start: 1px solid var(--linea);
      box-shadow: var(--shadow-card-hover);
      /* Sin fill-mode, por el date-picker del panel de detalle. */
      animation: entra-cajon 240ms var(--ease);
    }
    @keyframes entra-cajon { from { transform: translateX(100%); } }

    /* ── Aviso flotante ── */
    .toast {
      position: fixed; top: 1rem; right: 1rem;
      z-index: var(--z-toast, 100);
      display: flex; align-items: center; gap: 0.625rem;
      max-width: 26rem;
      padding: 0.5rem 0.375rem 0.5rem 0.875rem;
      background: var(--superficie);
      border: 1px solid var(--linea); border-radius: 0.75rem;
      box-shadow: var(--shadow-card-hover);
      font-size: 0.8125rem; color: var(--txt-1);
      animation: entra-toast 220ms var(--ease);
    }
    @keyframes entra-toast { from { opacity: 0; transform: translateY(-6px); } }
    .toast[data-tipo="error"] .toast-icono   { color: var(--neg); }
    .toast[data-tipo="success"] .toast-icono { color: var(--pos); }
    .toast[data-tipo="info"] .toast-icono    { color: var(--acento); }
    .toast-msg { flex: 1; min-width: 0; line-height: 1.4; }
    .toast-accion {
      flex-shrink: 0; height: 2rem; padding-inline: 0.625rem;
      border: 0; border-radius: 0.375rem; background: var(--acento-tenue);
      font-family: inherit; font-size: 0.8125rem; font-weight: 600; color: var(--acento); cursor: pointer;
    }

    /* ── Carga y error ── */
    .cargando { display: flex; flex-direction: column; gap: 0.75rem; height: 100%; }
    .cargando-cab { display: flex; gap: 1rem; }
    .cargando-titulos { display: grid; gap: 0.5rem; flex: 1; }
    .sk {
      display: block; border-radius: var(--radio-ctrl);
      background: var(--superficie-alt);
      border: 1px solid var(--linea-suave);
      animation: respira 1.4s ease-in-out infinite;
    }
    .sk-icono  { width: 2.25rem; height: 2.25rem; }
    .sk-ceja   { width: 8rem; height: 0.625rem; }
    .sk-titulo { width: min(26rem, 70%); height: 1.75rem; }
    .sk-senas  { width: min(18rem, 50%); height: 0.75rem; }
    .cargando-paneles { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1.3fr; gap: 0.75rem; }
    .cargando-paneles .sk { border-radius: var(--radio-panel); }
    .cargando-paneles .sk:nth-child(3) { display: none; }
    @media (min-width: 1280px) {
      .cargando-paneles { grid-template-columns: 1fr 1.4fr 0.85fr; }
      .cargando-paneles .sk:nth-child(3) { display: block; }
    }

    .estado-carga {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 0.375rem; height: 100%; padding: 2rem 1rem; text-align: center;
    }
    .estado-carga-titulo { font-family: var(--font-display); font-size: 1.25rem; font-weight: 700; color: var(--txt-1); margin-top: 0.375rem; }
    .estado-carga-sub { max-width: 36ch; font-size: 0.875rem; color: var(--txt-2); }

    .barra-escritura { display: none; }

    /* ═══ Tableta y portátil estrecho (768–1279) ═══ */
    @media (min-width: 768px) and (max-width: 1279px) {
      .panel-tareas { max-height: 16rem; }
      /* Con el formulario abierto la franja crece; notas y acta ceden alto. */
      .panel-tareas:has(.form-tarea) { max-height: none; }
      .tareas { display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); column-gap: 0.5rem; }
      .tarea + .tarea { box-shadow: none; }
    }
    @media (min-width: 768px) and (max-width: 1023px) {
      .cab { grid-template-columns: auto minmax(0, 1fr); }
      .cab-acciones { grid-column: 2; justify-content: flex-start; }
    }

    /* ═══ Móvil (< 768) ═══ */
    @media (max-width: 767px) {
      .editor { gap: 0.5rem; }
      .solo-escritorio { display: none; }
      .solo-movil { display: inline; }
      lucide-icon.solo-movil { display: inline-flex; }

      .cab { grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 0.5rem; }
      .cab-volver { margin-top: 0; }
      .cab-ceja, .grupo-export, .btn-guardar { display: none; }
      .cab-titulo { margin-top: 0; font-size: 1.125rem; letter-spacing: -0.02em; }
      .senas { margin-top: 0.1875rem; }
      .ctrl-estado { width: 2.75rem; height: 2.75rem; padding-inline: 0; }

      .aviso-lectura { padding: 0.375rem 0.375rem 0.375rem 0.75rem; font-size: 0.75rem; }

      .pestanas {
        display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.25rem;
        padding: 0.25rem;
        background: var(--superficie-alt);
        border: 1px solid var(--linea); border-radius: 0.625rem;
        flex-shrink: 0;
      }

      .mesa { display: flex; flex-direction: column; gap: 0; }
      .mesa > section { flex: 1 1 0; min-height: 0; animation: aparece 160ms var(--ease); }
      .mesa > .tab-hidden { display: none !important; }

      .panel-notas .panel-cab { flex-wrap: wrap; }
      .btn-generar { width: 100%; height: 2.75rem; }
      .texto, .texto-notas { font-size: 1rem; }
      .prosa { padding: 1rem 1rem 2.5rem; }

      .barra-escritura {
        position: fixed; left: 0; right: 0; bottom: 0;
        z-index: var(--z-sticky, 40);
        display: flex; align-items: center; gap: 0.5rem;
        padding: 0.5rem 0.75rem max(0.5rem, env(safe-area-inset-bottom));
        background: var(--superficie);
        border-top: 1px solid var(--linea);
      }
      .barra-estado { flex: 1; display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; color: var(--txt-2); }
      .barra-accion { color: var(--acento); border-color: var(--acento-borde); background: var(--acento-tenue); }

      /* Modo escritura: teclado abierto → todo el alto para el texto. */
      .modo-escritura .cab,
      .modo-escritura .pestanas,
      .modo-escritura .aviso-lectura,
      .modo-escritura .panel-cab { display: none; }
      .modo-escritura .texto { padding-bottom: 4.5rem; }

      .toast { top: 0.75rem; left: 0.75rem; right: 0.75rem; max-width: none; }

      .cargando-paneles { grid-template-columns: 1fr; }
      .cargando-paneles .sk:nth-child(n + 2) { display: none; }
    }

    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        animation-delay: 0ms !important;
        transition-duration: 0.01ms !important;
      }
    }
  `],
})
export class ActaEditorPage implements OnInit, OnDestroy {
  private svc = inject(ActaService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  @ViewChild('actaTextarea')  actaTextareaRef!:  ElementRef<HTMLTextAreaElement>;
  @ViewChild('notasTextarea') notasTextareaRef!: ElementRef<HTMLTextAreaElement>;
  @ViewChild('estadoWrap')    estadoWrapRef?:    ElementRef<HTMLElement>;

  acta = signal<Acta | null>(null);
  cargaError = signal(false);
  isReadonly = computed(() => this.acta()?.estado === 'finalizada');
  tareas = signal<Tarea[]>([]);
  guardando = signal(false);
  redactando = signal(false);
  agregandoTarea = signal(false);
  tareaForm: any = { titulo: '', descripcion: '', prioridad: 'media', fecha_limite: null };
  readonly prioridades: Tarea['prioridad'][] = ['baja', 'media', 'alta'];
  tareaAEliminar = signal<Tarea | null>(null);
  eliminandoTarea = signal(false);
  tareaDrawerId = signal<number | null>(null);
  confirmRegenerar = signal(false);
  toast = signal<{ msg: string; type: 'error' | 'success' | 'info'; action?: { label: string; fn: () => void } } | null>(null);
  rateLimitSecondsLeft = signal(0);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private rateLimitTimer: ReturnType<typeof setInterval> | null = null;
  private prevContenido: string | null = null;

  hasUnsaved = signal(false);
  savedAgo = signal<string | null>(null);
  estadoGuardado = computed<'guardando' | 'pendiente' | 'guardado' | null>(() =>
    this.guardando() ? 'guardando'
      : this.hasUnsaved() ? 'pendiente'
      : this.savedAgo() !== null ? 'guardado'
      : null);
  activeTab = signal<MobileTab>('notas');
  isMobileMode = signal(false);
  estadoOpen = signal(false);
  actaFocused = signal(false);
  notasFocused = signal(false);
  actaHtml = computed<SafeHtml>(() => this.markdownToHtml(this.acta()?.contenido_redactado ?? ''));

  resumenTareas = computed(() => {
    const ts = this.tareas();
    if (!ts.length) return 'Seguimiento de lo acordado';
    const abiertas = ts.filter(t => t.estado === 'pendiente' || t.estado === 'en_progreso').length;
    const listas = ts.filter(t => t.estado === 'completada').length;
    const partes: string[] = [];
    if (abiertas) partes.push(`${abiertas} abierta${abiertas !== 1 ? 's' : ''}`);
    if (listas) partes.push(`${listas} lista${listas !== 1 ? 's' : ''}`);
    return partes.join(' · ') || 'Todas canceladas';
  });

  /** Tecla modificadora que se muestra en los atajos. */
  readonly atajo = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

  /** Capa superpuesta abierta: decide a dónde va el foco al abrir y al cerrar. */
  private capa = computed<Capa | null>(() =>
    this.tareaAEliminar() ? 'eliminar'
      : this.confirmRegenerar() ? 'regenerar'
      : this.agregandoTarea() && this.isMobileMode() ? 'tarea'
      : this.estadoOpen() ? (this.isMobileMode() ? 'acciones' : 'estado')
      : null);
  private focoPrevio: HTMLElement | null = null;

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private savedAt: Date | null = null;
  private savedAgoTimer: ReturnType<typeof setInterval> | null = null;
  private resizeObserver: ResizeObserver | null = null;

  mobileTabs: { id: MobileTab; label: string }[] = [
    { id: 'notas', label: 'Notas' },
    { id: 'acta', label: 'Acta' },
    { id: 'tareas', label: 'Tareas' },
  ];

  constructor() {
    // Al abrir un diálogo, hoja o menú el foco entra en él; al cerrarlo vuelve
    // a quien lo abrió, salvo que el usuario ya lo haya llevado a otra parte.
    effect(() => {
      const capa = this.capa();
      untracked(() => {
        if (capa) {
          if (!this.focoPrevio) this.focoPrevio = document.activeElement as HTMLElement | null;
          setTimeout(() => {
            const cont = this.host.nativeElement.querySelector<HTMLElement>(`[data-capa="${capa}"]`);
            const destino = cont?.querySelector<HTMLElement>('[data-autofocus]') ?? this.focusables(cont)[0];
            destino?.focus();
          });
        } else if (this.focoPrevio) {
          const previo = this.focoPrevio;
          this.focoPrevio = null;
          setTimeout(() => {
            const activo = document.activeElement;
            if ((!activo || activo === document.body) && previo.isConnected) previo.focus();
          });
        }
      });
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (!this.isReadonly()) this.guardar(); }
    if (mod && e.key === 'Enter') { e.preventDefault(); this.redactarIA(); }
    if (e.key === 'Escape') {
      if (this.confirmRegenerar()) this.confirmRegenerar.set(false);
      else if (this.tareaAEliminar()) this.cancelarEliminarTarea();
      else if (this.tareaDrawerId()) this.tareaDrawerId.set(null);
      else if (this.agregandoTarea() && this.isMobileMode()) this.cerrarFormularioTarea();
      else if (this.estadoOpen()) this.estadoOpen.set(false);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent) {
    if (!this.estadoOpen() || this.isMobileMode()) return;
    const wrap = this.estadoWrapRef?.nativeElement;
    if (wrap && !wrap.contains(e.target as Node)) this.estadoOpen.set(false);
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent) {
    if (this.hasUnsaved()) e.preventDefault();
  }

  ngOnInit() {
    this.cargar();

    this.resizeObserver = new ResizeObserver(() => {
      this.isMobileMode.set(window.innerWidth < 768);
    });
    this.resizeObserver.observe(document.documentElement);
    this.isMobileMode.set(window.innerWidth < 768);

    this.savedAgoTimer = setInterval(() => this.updateSavedAgo(), 10_000);
  }

  ngOnDestroy() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    if (this.savedAgoTimer) clearInterval(this.savedAgoTimer);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (this.rateLimitTimer) clearInterval(this.rateLimitTimer);
    this.resizeObserver?.disconnect();
  }

  cargar() {
    const id = Number(this.route.snapshot.params['id']);
    this.cargaError.set(false);
    this.svc.get(id).subscribe({
      next: a => this.acta.set(a),
      error: () => this.cargaError.set(true),
    });
    this.svc.listarTareas(id).subscribe(t => this.tareas.set(t));
  }

  markDirty() {
    if (this.isReadonly()) return;
    this.hasUnsaved.set(true);
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const delay = window.innerWidth < 768 ? 1500 : 3000;
    this.saveTimer = setTimeout(() => this.guardar(true), delay);
  }

  private updateSavedAgo() {
    if (!this.savedAt) return;
    const secs = Math.round((Date.now() - this.savedAt.getTime()) / 1000);
    if (secs < 60) this.savedAgo.set(`hace ${secs}s`);
    else this.savedAgo.set(`hace ${Math.round(secs / 60)}min`);
  }

  tipoLabel(t: TipoReunion): string {
    return TIPO_LABEL[t] ?? 'Reunión';
  }

  prioridadLabel(p: Tarea['prioridad']): string {
    return PRIORIDAD_LABEL[p] ?? p;
  }

  formatFecha(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /** "Jueves, 2 de octubre de 2026" — la fecha es dato principal en la cabecera. */
  fechaLarga(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso.slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    const txt = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  }

  /** "3 oct" (o "3 oct 2027" si no es de este año) para vencimientos de tareas. */
  fechaCorta(iso: string): string {
    const d = new Date(iso.slice(0, 10) + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    const mismoAnio = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString('es-ES', mismoAnio
      ? { day: 'numeric', month: 'short' }
      : { day: 'numeric', month: 'short', year: 'numeric' });
  }

  vencida(t: Tarea): boolean {
    if (!t.fecha_limite || t.estado === 'completada' || t.estado === 'cancelada') return false;
    const hoy = new Date();
    const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    return t.fecha_limite.slice(0, 10) < hoyIso;
  }

  formatoEspera(segundos: number): string {
    return segundos < 60 ? `${segundos} s` : `${Math.ceil(segundos / 60)} min`;
  }

  tituloGenerar(a: Acta): string {
    if (this.rateLimitSecondsLeft() > 0) return `Límite alcanzado. Disponible en ${this.formatoEspera(this.rateLimitSecondsLeft())}`;
    if (!a.notas_originales) return 'Escribe notas primero para generar el acta';
    return `Generar acta con IA (${this.atajo}+Enter)`;
  }

  volver() {
    // Flush del autoguardado pendiente antes de salir — cumple la promesa del autosave
    if (this.hasUnsaved() && !this.isReadonly()) {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.guardar(true);
    }
    this.router.navigate(['/secretario-tools/actas-reunion']);
  }

  guardar(auto = false) {
    const a = this.acta();
    if (!a) return;
    if (!auto) this.guardando.set(true);
    this.svc.update(a.id_acta, {
      titulo: a.titulo,
      fecha_reunion: a.fecha_reunion,
      tipo_reunion: a.tipo_reunion,
      notas_originales: a.notas_originales,
      contenido_redactado: a.contenido_redactado,
      estado: a.estado,
    }).subscribe({
      next: (updated) => {
        this.acta.set(updated);
        this.guardando.set(false);
        this.hasUnsaved.set(false);
        this.savedAt = new Date();
        this.savedAgo.set('justo ahora');
      },
      error: (e) => {
        this.guardando.set(false);
        this.showToast(e?.error?.detail || 'No se pudieron guardar los cambios. Intenta de nuevo.', 'error');
      },
    });
  }

  private showToast(msg: string, type: 'error' | 'success' | 'info' = 'info', action?: { label: string; fn: () => void }) {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set({ msg, type, action });
    this.toastTimer = setTimeout(() => this.toast.set(null), action ? 7000 : 4000);
  }

  ejecutarToastAction() {
    const t = this.toast();
    this.toast.set(null);
    t?.action?.fn();
  }

  redactarIA() {
    const a = this.acta();
    if (!a || !a.notas_originales || this.redactando() || this.isReadonly() || this.rateLimitSecondsLeft() > 0) return;
    if (a.contenido_redactado?.trim()) {
      this.confirmRegenerar.set(true);
      return;
    }
    this.ejecutarRedactarIA();
  }

  confirmarRegenerar() {
    this.confirmRegenerar.set(false);
    this.ejecutarRedactarIA();
  }

  private ejecutarRedactarIA() {
    const a = this.acta();
    if (!a) return;
    this.prevContenido = a.contenido_redactado?.trim() ? a.contenido_redactado : null;
    this.guardar(true);
    this.redactando.set(true);
    this.svc.redactarIA({ id_acta: a.id_acta }).subscribe({
      next: (res) => {
        this.acta.update(x => x ? { ...x, contenido_redactado: res.contenido_redactado } : x);
        this.svc.listarTareas(a.id_acta).subscribe(t => this.tareas.set(t));
        this.redactando.set(false);
        this.hasUnsaved.set(true);
        this.actaFocused.set(false);
        if (this.isMobileMode()) this.activeTab.set('acta');
        if (this.prevContenido) {
          this.showToast('Acta generada.', 'success', { label: 'Deshacer', fn: () => this.restaurarContenidoAnterior() });
        }
      },
      error: (e) => {
        this.redactando.set(false);
        const detail = e?.error?.detail;
        if (e?.status === 429 && detail && typeof detail === 'object') {
          this.startRateLimitCountdown(detail.reset_in_seconds ?? 3600);
          this.showToast(detail.message ?? 'Límite de generaciones alcanzado. Intenta más tarde.', 'error');
        } else {
          this.showToast(detail || 'No se pudo generar el acta. Intenta de nuevo.', 'error');
        }
      },
    });
  }

  private startRateLimitCountdown(seconds: number) {
    if (this.rateLimitTimer) clearInterval(this.rateLimitTimer);
    this.rateLimitSecondsLeft.set(seconds);
    this.rateLimitTimer = setInterval(() => {
      const left = this.rateLimitSecondsLeft() - 1;
      if (left <= 0) {
        this.rateLimitSecondsLeft.set(0);
        clearInterval(this.rateLimitTimer!);
        this.rateLimitTimer = null;
      } else {
        this.rateLimitSecondsLeft.set(left);
      }
    }, 1000);
  }

  restaurarContenidoAnterior() {
    if (this.prevContenido === null) return;
    const anterior = this.prevContenido;
    this.prevContenido = null;
    this.acta.update(x => x ? { ...x, contenido_redactado: anterior } : x);
    this.markDirty();
    this.showToast('Se restauró la versión anterior del acta.', 'info');
  }

  exportar(formato: 'pdf' | 'docx') {
    const a = this.acta();
    if (!a) return;
    this.svc.exportar(a.id_acta, formato).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${a.titulo.replace(/\s+/g, '_')}.${formato}`;
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.showToast(`No se pudo exportar el documento ${formato.toUpperCase()}. Intenta de nuevo.`, 'error'),
    });
  }

  focusActa() {
    this.actaFocused.set(true);
    setTimeout(() => this.actaTextareaRef?.nativeElement?.focus(), 0);
  }

  blurActiveTextarea() {
    this.actaTextareaRef?.nativeElement?.blur();
    this.notasTextareaRef?.nativeElement?.blur();
    this.actaFocused.set(false);
    this.notasFocused.set(false);
  }

  onActaBlur() {
    this.actaFocused.set(false);
  }

  markdownToHtml(text: string): SafeHtml {
    if (!text) return this.sanitizer.bypassSecurityTrustHtml('');
    let html = text
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+?)\*/g, '<em>$1</em>')
      .replace(/_([^_\n]+?)_/g, '<em>$1</em>')
      .replace(/^---+$/gm, '<hr>')
      .replace(/((?:^[ \t]*[-*] .+\n?)+)/gm, block => {
        const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*[-*] /, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
      })
      .replace(/((?:^[ \t]*\d+\. .+\n?)+)/gm, block => {
        const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*\d+\. /, '')}</li>`).join('');
        return `<ol>${items}</ol>`;
      });
    html = html.split(/\n{2,}/).map(block => {
      const t = block.trim();
      if (!t) return '';
      if (/^<(h[1-3]|ul|ol|hr)/.test(t)) return t;
      return `<p>${t.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  setEstado(a: any, val: string) {
    a.estado = val;
    this.estadoOpen.set(false);
    this.hasUnsaved.set(true);
    this.guardar();
  }

  alternarEstado() {
    this.estadoOpen.update(v => !v);
  }

  /** Cierra el menú cuando el foco sale de él con el teclado (Tab). */
  onEstadoFocusOut(e: FocusEvent) {
    if (this.isMobileMode() || !this.estadoOpen()) return;
    const siguiente = e.relatedTarget as Node | null;
    if (siguiente && !this.estadoWrapRef?.nativeElement.contains(siguiente)) this.estadoOpen.set(false);
  }

  onMenuKeydown(e: KeyboardEvent) {
    const items = Array.from((e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('[role="menuitemradio"]'));
    const i = items.indexOf(document.activeElement as HTMLElement);
    let destino = -1;
    if (e.key === 'ArrowDown') destino = (i + 1) % items.length;
    else if (e.key === 'ArrowUp') destino = (i - 1 + items.length) % items.length;
    else if (e.key === 'Home') destino = 0;
    else if (e.key === 'End') destino = items.length - 1;
    if (destino < 0) return;
    e.preventDefault();
    items[destino]?.focus();
  }

  /** Flechas, Inicio y Fin entre pestañas (patrón ARIA de tabs con activación automática). */
  onTabsKeydown(e: KeyboardEvent) {
    const ids = this.mobileTabs.map(t => t.id);
    let i = ids.indexOf(this.activeTab());
    if (e.key === 'ArrowRight') i = (i + 1) % ids.length;
    else if (e.key === 'ArrowLeft') i = (i - 1 + ids.length) % ids.length;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = ids.length - 1;
    else return;
    e.preventDefault();
    this.activeTab.set(ids[i]);
    setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>(`#pestana-${ids[i]}`)?.focus());
  }

  /** Mantiene el Tab dentro de un diálogo u hoja modal. */
  atraparFoco(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const f = this.focusables(e.currentTarget as HTMLElement);
    if (!f.length) return;
    const primero = f[0];
    const ultimo = f[f.length - 1];
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }

  private focusables(cont: HTMLElement | null | undefined): HTMLElement[] {
    if (!cont) return [];
    return Array.from(cont.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter(el => el.offsetParent !== null);
  }

  alternarFormularioTarea() {
    const abrir = !this.agregandoTarea();
    this.agregandoTarea.set(abrir);
    // En móvil el foco lo coloca el effect de capas (la hoja es modal).
    if (abrir && !this.isMobileMode()) {
      setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[data-autofocus-tarea]')?.focus());
    }
  }

  cerrarFormularioTarea() {
    this.agregandoTarea.set(false);
  }

  crearTarea() {
    const a = this.acta()!;
    this.svc.crearTarea(a.id_acta, this.tareaForm).subscribe({
      next: (t) => {
        this.tareas.update(arr => [t, ...arr]);
        this.tareaForm = { titulo: '', descripcion: '', prioridad: 'media', fecha_limite: null };
        this.agregandoTarea.set(false);
      },
      error: (e) => this.showToast(e?.error?.detail || 'No se pudo crear la tarea. Intenta de nuevo.', 'error'),
    });
  }

  cambiarEstado(t: Tarea, estado: Tarea['estado']) {
    this.svc.actualizarEstadoTarea(t.id_tarea, estado).subscribe({
      next: (updated) => this.tareas.update(arr => arr.map(x => x.id_tarea === t.id_tarea ? updated : x)),
      error: () => this.showToast('No se pudo actualizar el estado de la tarea.', 'error'),
    });
  }

  eliminarTarea(t: Tarea) {
    this.tareaAEliminar.set(t);
  }

  confirmarEliminarTarea() {
    const t = this.tareaAEliminar();
    if (!t) return;
    this.eliminandoTarea.set(true);
    this.svc.eliminarTarea(t.id_tarea).subscribe({
      next: () => {
        this.tareas.update(arr => arr.filter(x => x.id_tarea !== t.id_tarea));
        this.tareaAEliminar.set(null);
        this.eliminandoTarea.set(false);
      },
      error: () => {
        this.eliminandoTarea.set(false);
        this.showToast('No se pudo eliminar la tarea. Intenta de nuevo.', 'error');
      },
    });
  }

  cancelarEliminarTarea() {
    if (this.eliminandoTarea()) return;
    this.tareaAEliminar.set(null);
  }

  estadoShort(e: Tarea['estado']): string {
    return { pendiente: 'Pendiente', en_progreso: 'En curso', completada: 'Lista', cancelada: 'Cancelada' }[e] ?? e;
  }

  nextEstado(e: Tarea['estado']): Tarea['estado'] {
    const cycle: Tarea['estado'][] = ['pendiente', 'en_progreso', 'completada'];
    const i = cycle.indexOf(e);
    return i >= 0 ? cycle[(i + 1) % cycle.length] : 'pendiente';
  }

  verTarea(t: Tarea) {
    if (window.innerWidth >= 768) {
      this.tareaDrawerId.set(t.id_tarea);
    } else {
      const a = this.acta();
      this.router.navigate(
        ['/secretario-tools/tareas', t.id_tarea],
        { queryParams: { desde: 'acta-editor', ...(a ? { origen_acta: a.id_acta } : {}) } },
      );
    }
  }

  onTareaActualizadaEnDrawer(updated: Tarea) {
    this.tareas.update(list => list.map(t => t.id_tarea === updated.id_tarea ? updated : t));
  }

  onTareaEliminadaEnDrawer(id: number) {
    this.tareas.update(list => list.filter(t => t.id_tarea !== id));
    this.tareaDrawerId.set(null);
  }
}
