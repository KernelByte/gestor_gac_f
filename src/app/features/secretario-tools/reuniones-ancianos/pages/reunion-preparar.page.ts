import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ReunionAncianosService } from '../../services/reunion-ancianos.service';
import { CategoriaOut, ESTADO_REUNION_LABEL, MiParticipacion, NotaPersonal, ParteOut, ReunionOut } from '../../models/reunion-ancianos.model';
import { AuthStore } from '../../../../core/auth/auth.store';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { AvisoComponent } from '../../../../shared/components/aviso/aviso.component';
import { LucideAngularModule } from '../../../../shared/icons';
import { markdownSimpleAHtml } from '../../../../shared/utils/markdown-simple';
import { MisNotasComponent } from '../components/mis-notas.component';
import { ReunionPasosComponent } from '../components/reunion-pasos.component';
import { cuandoRelativo, fechaCompleta, hora12 } from '../reunion-ancianos-formato';

const MIN_MAX = 240;

/** Dirección de búsqueda en WOL (español) para un texto o una referencia. */
export function enlaceWol(q: string): string {
  return `https://wol.jw.org/es/wol/s/r4/lp-s?q=${encodeURIComponent(q.trim())}&p=par`;
}

/**
 * «Mi preparación»: la reunión vista por quien va a asistir. Primero sus
 * partes (con la indicación privada que le dejó quien programó), luego el
 * programa completo; en cada parte y en general puede escribir sus notas
 * privadas, que tendrá a mano el día de la reunión. Nadie más las ve.
 *
 * La usan los convocados (también es su vista de la reunión) y los gestores
 * (desde el editor, «Preparar»).
 */
@Component({
  selector: 'app-reunion-preparar',
  standalone: true,
  imports: [
    NgTemplateOutlet, FormsModule, RouterLink, ModalComponent, ConfirmDialogComponent, EmptyStateComponent, AvisoComponent,
    LucideAngularModule, MisNotasComponent, ReunionPasosComponent,
  ],
  template: `
  <div class="tema-reuniones prep @container flex-1 min-h-0 flex flex-col gap-4 pb-6 @5xl:pb-0">

    <header class="flex flex-wrap items-start gap-x-4 gap-y-3">
      <a routerLink="/administracion/reuniones-teocraticas" class="btn-icon shrink-0" aria-label="Volver a las reuniones" title="Volver a las reuniones">
        <lucide-icon name="arrow-left"></lucide-icon>
      </a>
      <div class="flex-1 min-w-[14rem]">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 class="page-title leading-tight min-w-0">{{ r()?.titulo || 'Reunión' }}</h1>
          @if (r(); as r) {
            <span class="chip-estado est-reunion" [attr.data-estado]="r.estado">{{ estadoLabel[r.estado] }}</span>
          }
        </div>
        @if (r(); as r) {
          <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {{ fechaCompleta(r.fecha) }}@if (r.hora) { · {{ hora12(r.hora) }} }@if (r.lugar) { · {{ r.lugar }} }
            <span class="text-slate-500 dark:text-slate-400"> · {{ cuandoRelativo(r.fecha) }}</span>
          </p>
          <!-- Los pasos solo orientan mientras la reunión no ha terminado -->
          @if (r.estado !== 'realizada' && r.estado !== 'cancelada') {
            <div class="mt-2"><app-reunion-pasos [estado]="r.estado" [conEnVivo]="usarEnVivo()" /></div>
          }
        }
      </div>
      @if (r(); as r) {
        <div class="flex flex-wrap items-center gap-2">
          @if (r.puedo_editar) {
            <a class="btn-secondary" [routerLink]="['/administracion/reuniones-teocraticas', r.id_reunion]">
              <lucide-icon name="square-pen" [size]="16" aria-hidden="true"></lucide-icon>Editar programa
            </a>
          }
          <button type="button" class="btn-secondary" [disabled]="descargando()" (click)="descargarPdf()">
            @if (descargando()) { <span class="spinner-sm" aria-hidden="true"></span> } @else { <lucide-icon name="download" [size]="16" aria-hidden="true"></lucide-icon> }
            Programa en PDF
          </button>
          @if (r.puedo_leer_acta) {
            <button type="button" class="btn-secondary" [disabled]="leyendoActa()" (click)="leerActa()">
              <lucide-icon name="book-open" [size]="16" aria-hidden="true"></lucide-icon>Leer el acta
            </button>
          }
        </div>
      }
    </header>

    @if (cargando()) {
      <div class="grid gap-4 @5xl:grid-cols-[minmax(0,1fr)_22rem]" aria-busy="true" aria-label="Cargando la reunión">
        <div class="card p-5 flex flex-col gap-3">@for (_ of [1, 2, 3, 4]; track $index) { <div class="skeleton h-14"></div> }</div>
        <div class="card p-5 hidden @5xl:flex flex-col gap-3"><div class="skeleton h-5 w-40"></div><div class="skeleton h-28"></div></div>
      </div>
    } @else if (error()) {
      <div class="card p-6">
        @if (error() === 'no-encontrada') {
          <app-empty-state icon="calendar-off" title="No encontramos esta reunión"
            description="Puede que la hayan borrado o que todavía no esté convocada." actionLabel="Volver a las reuniones" (action)="irALista()" />
        } @else {
          <app-empty-state variant="error" title="No se pudo abrir la reunión" description="Revise su conexión e intente de nuevo."
            actionLabel="Intentar de nuevo" (action)="cargar()" />
        }
      </div>
    } @else if (r(); as r) {

      @if (r.estado === 'en_curso' || (usarEnVivo() && r.estado === 'convocada' && esHoy(r.fecha))) {
        <div class="en-vivo-banner" role="status">
          <span class="badge-live">{{ r.estado === 'en_curso' ? 'En curso' : 'Hoy' }}</span>
          <p class="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
            {{ r.estado === 'en_curso' ? 'La reunión ya empezó.' : 'La reunión es hoy.' }}
            <span class="font-normal text-slate-600 dark:text-slate-300">Siga el tiempo en vivo con sus notas a mano.</span>
          </p>
          <a class="btn-primary" [routerLink]="['/administracion/reuniones-teocraticas', r.id_reunion, 'en-vivo']">
            <lucide-icon name="play" [size]="16" aria-hidden="true"></lucide-icon>{{ r.estado === 'en_curso' ? 'Seguir en vivo' : 'Abrir en vivo' }}
          </a>
        </div>
      }
      @if (r.estado === 'cancelada') {
        <app-aviso tone="warning" title="Esta reunión se canceló">Si se vuelve a programar, recibirá un aviso.</app-aviso>
      }
      @if (!r.puedo_preparar) {
        <app-aviso tone="info" title="Para escribir sus notas, entre con su cuenta">
          Con el PIN de la app puede ver el programa, pero las notas privadas necesitan una cuenta propia.
        </app-aviso>
      }

      <div class="grid gap-4 items-start @5xl:items-stretch @5xl:flex-1 @5xl:min-h-0 @5xl:grid-rows-[minmax(0,1fr)] @5xl:grid-cols-[minmax(0,1fr)_22rem] @7xl:grid-cols-[minmax(0,1fr)_26rem]">
        <div class="flex flex-col gap-4 min-w-0 @5xl:min-h-0">

          <!-- ══════ Sus partes ══════ -->
          @if (misPartes().length) {
            <section class="card p-4 @3xl:p-5 flex flex-col gap-4 @5xl:overflow-y-auto lista-interna"
                     [class]="enfoque() ? '@5xl:flex-1 @5xl:min-h-0' : '@5xl:shrink-0 @5xl:max-h-[55%]'" aria-labelledby="t-mis-partes">
              <div>
                <h2 id="t-mis-partes" class="section-title">{{ misPartes().length === 1 ? 'Su parte' : 'Sus partes' }}</h2>
                <p class="caption mt-0.5">{{ notasCerradas() ? 'Lo que preparó para esta reunión.' : 'Escriba aquí lo que va a presentar. Lo tendrá a mano el día de la reunión.' }}</p>
              </div>
              @for (p of misPartes(); track p.id_parte) {
                <article class="card-section flex flex-col gap-3" [attr.aria-label]="'Parte ' + numero(p) + ': ' + p.titulo">
                  <div class="flex flex-wrap items-start gap-x-3 gap-y-2">
                    <span class="num" aria-hidden="true">{{ numero(p) }}</span>
                    <div class="flex-1 min-w-[12rem]">
                      <h3 class="card-title leading-snug">{{ p.titulo }}</h3>
                      <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                        @if (categoria(p); as c) {
                          <span class="cat-chip" [attr.data-color]="c.color"><lucide-icon [name]="c.icono"></lucide-icon>{{ c.etiqueta }}</span>
                        }
                        @if (p.minutos) { <span class="badge-neutral"><lucide-icon name="clock" [size]="12" aria-hidden="true"></lucide-icon>{{ p.minutos }} min</span> }
                        @if (p.cancelada) { <span class="badge-inactive">Cancelado</span> }
                      </div>
                    </div>
                  </div>

                  @if (p.nota_asignado) {
                    <div class="nota-privada" role="note" aria-label="Indicación para su preparación (solo usted la ve)">
                      <span class="nota-privada-tit" title="Indicación para su preparación · solo usted la ve">
                        <lucide-icon name="lock" [size]="13" aria-hidden="true"></lucide-icon>Indicación
                      </span>
                      <div class="prosa flex-1 min-w-0" [innerHTML]="md(p.nota_asignado)"></div>
                    </div>
                  }

                  <ng-container *ngTemplateOutlet="detalle; context: { $implicit: p }" />

                  @if (r.puedo_preparar) {
                    <app-mis-notas [soloLectura]="notasCerradas()" [amplia]="enfoque()" [idReunion]="r.id_reunion" [idParte]="p.id_parte" [valor]="nota(p.id_parte)"
                      etiqueta="Lo que va a presentar" placeholder="Escriba sus puntos, los textos que va a leer y las preguntas que hará. Use «Elementos» para empezar con un bosquejo."
                      (guardada)="notaGuardada(p.id_parte, $event)" />
                  }
                </article>
              }
            </section>
          }

          <!-- ══════ Programa (con parte propia por preparar, va compacto a la derecha) ══════ -->
          @if (!enfoque()) {
          <section class="card overflow-hidden flex flex-col @5xl:flex-1 @5xl:min-h-0" aria-labelledby="t-programa">
            <div class="shrink-0 px-4 @3xl:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <h2 id="t-programa" class="section-title">Programa</h2>
              <p class="caption tabular-nums">{{ aceptadas().length }} {{ aceptadas().length === 1 ? 'parte' : 'partes' }} · {{ r.total_minutos }} min</p>
            </div>
            <ol class="divide-y divide-slate-100 dark:divide-slate-800 @5xl:flex-1 @5xl:min-h-0 @5xl:overflow-y-auto lista-interna">
              <li class="fila-fija">
                <span class="w-8"></span><span class="flex-1 text-slate-500 dark:text-slate-400">Oración inicial</span>
                <span class="persona">{{ r.oracion_inicial_nombre || '—' }}</span>
              </li>
              @for (p of aceptadas(); track p.id_parte; let i = $index) {
                <li [class.mia]="p.es_mia">
                  <button type="button" class="fila" [attr.aria-expanded]="abierta() === p.id_parte" [attr.aria-controls]="'prep-det-' + p.id_parte"
                          (click)="alternar(p.id_parte)">
                    <span class="num num-sm" aria-hidden="true">{{ i + 1 }}</span>
                    <span class="flex-1 min-w-0 text-left">
                      <span class="block font-semibold text-slate-900 dark:text-slate-100 leading-snug" [class.tachada]="p.cancelada">{{ p.titulo }}</span>
                      <span class="mt-1 flex flex-wrap items-center gap-1.5">
                        @if (categoria(p); as c) {
                          <span class="cat-chip" [attr.data-color]="c.color"><lucide-icon [name]="c.icono"></lucide-icon>{{ c.etiqueta }}</span>
                        }
                        @if (p.cancelada) { <span class="badge-inactive">Cancelado</span> }
                        @if (p.es_mia) { <span class="badge-role">Su parte</span> }
                        @if (nota(p.id_parte)) { <span class="badge-neutral"><lucide-icon name="notebook-pen" [size]="12" aria-hidden="true"></lucide-icon>Con notas</span> }
                      </span>
                    </span>
                    <span class="persona text-right">{{ p.responsable_nombre || 'Sin asignar' }}</span>
                    <span class="w-14 text-right text-sm font-semibold tabular-nums text-slate-600 dark:text-slate-300">{{ p.minutos ? p.minutos + ' min' : '' }}</span>
                    <lucide-icon name="chevron-down" [size]="18" class="flecha shrink-0 text-slate-400" [class.girada]="abierta() === p.id_parte" aria-hidden="true"></lucide-icon>
                  </button>
                  @if (abierta() === p.id_parte) {
                    <div [id]="'prep-det-' + p.id_parte" class="px-4 @3xl:px-5 pb-4 pl-14 @3xl:pl-16 flex flex-col gap-3 entra">
                      <ng-container *ngTemplateOutlet="detalle; context: { $implicit: p }" />
                      @if (r.puedo_preparar) {
                        <app-mis-notas [soloLectura]="notasCerradas()" [idReunion]="r.id_reunion" [idParte]="p.id_parte" [valor]="nota(p.id_parte)" [compacta]="true"
                          placeholder="Lo que quiere tener presente en este tema" (guardada)="notaGuardada(p.id_parte, $event)" />
                      }
                    </div>
                  }
                </li>
              }
              <li class="fila-fija">
                <span class="w-8"></span><span class="flex-1 text-slate-500 dark:text-slate-400">Oración final</span>
                <span class="persona">{{ r.oracion_final_nombre || '—' }}</span>
              </li>
            </ol>
          </section>
          }
        </div>

        <!-- ══════ Columna lateral: notas generales y proponer ══════ -->
        <aside class="lateral flex flex-col gap-4 @5xl:min-h-0 @5xl:overflow-y-auto lista-interna">
          <section class="card p-4 @3xl:p-5 flex flex-col gap-3" aria-labelledby="t-datos">
            <h2 id="t-datos" class="card-title">La reunión</h2>
            <dl class="datos-reunion">
              <div><dt>Duración</dt><dd>{{ aceptadas().length }} {{ aceptadas().length === 1 ? 'parte' : 'partes' }} · {{ r.total_minutos }} min</dd></div>
              @if (r.hora) { <div><dt>Hora</dt><dd>{{ hora12(r.hora) }}</dd></div> }
              @if (r.lugar) { <div><dt>Lugar</dt><dd>{{ r.lugar }}</dd></div> }
              @if (r.secretario_nombre) { <div><dt>Secretario</dt><dd>{{ r.secretario_nombre }}</dd></div> }
              @if (r.tiempo_nombre) { <div><dt>Toma el tiempo</dt><dd>{{ r.tiempo_nombre }}</dd></div> }
              @if (r.redactor_nombre) { <div><dt>Toma las notas</dt><dd>{{ r.redactor_nombre }}</dd></div> }
              <div><dt>Convocados</dt><dd>{{ r.num_convocados }}</dd></div>
            </dl>
            @if (r.otros_temas.length) {
              <div class="pt-3 border-t border-slate-200 dark:border-slate-800">
                <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-100">Otros temas</h3>
                <ul class="mt-1.5 list-disc pl-5 text-sm text-slate-700 dark:text-slate-300 flex flex-col gap-1">
                  @for (t of r.otros_temas; track $index) { <li>{{ t }}</li> }
                </ul>
              </div>
            }
          </section>
          @if (enfoque()) {
            <!-- El programa, compacto: para ubicar su parte sin perder de vista lo que escribe -->
            <section class="card overflow-hidden flex flex-col @5xl:min-h-0" aria-labelledby="t-programa-mini">
              <div class="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                <h2 id="t-programa-mini" class="card-title">Programa</h2>
                <span class="caption tabular-nums">{{ aceptadas().length }} {{ aceptadas().length === 1 ? 'parte' : 'partes' }}</span>
              </div>
              <ol class="mini-prog lista-interna @5xl:flex-1 @5xl:min-h-0 @5xl:overflow-y-auto">
                <li class="mini-fila mini-fija"><span class="mini-n"></span><span class="flex-1">Oración inicial</span><span class="mini-quien">{{ r.oracion_inicial_nombre || '—' }}</span></li>
                @for (p of aceptadas(); track p.id_parte) {
                  <li class="mini-fila" [class.mini-mia]="p.es_mia" [attr.aria-current]="p.es_mia ? 'true' : null">
                    <span class="mini-n" aria-hidden="true">{{ numero(p) }}</span>
                    <span class="flex-1 min-w-0">
                      <span class="block font-semibold leading-snug" [class.tachada]="p.cancelada">{{ p.titulo }}</span>
                      <span class="caption">{{ p.es_mia ? 'Usted' : (p.responsable_nombre || 'Sin asignar') }}{{ p.minutos ? ' · ' + p.minutos + ' min' : '' }}</span>
                    </span>
                  </li>
                }
                <li class="mini-fila mini-fija"><span class="mini-n"></span><span class="flex-1">Oración final</span><span class="mini-quien">{{ r.oracion_final_nombre || '—' }}</span></li>
              </ol>
            </section>
          }
          @if (r.puedo_editar && mia(); as m) {
            <section class="card p-4 @3xl:p-5 flex flex-col gap-3" aria-labelledby="t-mi-cuenta">
              <div>
                <h2 id="t-mi-cuenta" class="card-title">Cuántas veces le ha tocado</h2>
                <p class="caption mt-0.5">Solo usted ve este conteo.</p>
              </div>
              <ul class="flex flex-col gap-2">
                @for (c of m.categorias; track c.id_categoria) {
                  <li class="flex items-center gap-2">
                    <span class="cat-chip" [attr.data-color]="c.color"><lucide-icon [name]="c.icono"></lucide-icon>{{ c.plural }}</span>
                    <span class="flex-1"></span>
                    <span class="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">{{ c.total }}</span>
                    @if (c.programadas) { <span class="caption">+{{ c.programadas }} {{ c.programadas === 1 ? 'programada' : 'programadas' }}</span> }
                  </li>
                }
              </ul>
            </section>
          }
          @if (r.puedo_preparar && (r.puedo_editar || nota(null))) {
            <section class="card p-4 @3xl:p-5 flex flex-col gap-2" aria-label="Sus notas">
              <!-- La explicación es para quien programa; cada cuadro de notas ya dice «Solo usted la ve». -->
              @if (r.puedo_editar) {
                <h2 class="card-title flex items-center gap-2"><lucide-icon name="lock" [size]="15" aria-hidden="true"></lucide-icon>Sus notas son privadas</h2>
                <p class="text-sm text-slate-600 dark:text-slate-300">{{ notasCerradas() ? 'La reunión ya terminó: sus notas quedan solo para consulta.' : 'Escríbalas dentro de cada parte.' }} No salen en el programa, el PDF ni el acta, y nadie más las ve.</p>
              }
              @if (nota(null)) {
                <div class="mt-2">
                  <app-mis-notas [soloLectura]="notasCerradas()" [idReunion]="r.id_reunion" [idParte]="null" [valor]="nota(null)"
                    etiqueta="Nota anterior" (guardada)="notaGuardada(null, $event)" />
                </div>
              }
            </section>
          }
          @if (r.puedo_proponer) {
            <section class="card p-4 @3xl:p-5 flex flex-col gap-3">
              <h2 class="card-title">¿Quiere tratar algún asunto?</h2>
              <p class="text-sm text-slate-600 dark:text-slate-300">Propóngalo y el coordinador decidirá si lo añade al programa.</p>
              <button type="button" class="btn-secondary justify-center" (click)="abrirProponer()">
                <lucide-icon name="lightbulb" [size]="16" aria-hidden="true"></lucide-icon>Proponer un punto
              </button>
              @if (misPropuestas().length) {
                <ul class="flex flex-col gap-2 pt-1">
                  @for (p of misPropuestas(); track p.id_parte) {
                    <li class="card-section !p-3 flex items-start gap-2">
                      <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{{ p.titulo }}</p>
                        <p class="caption text-amber-700 dark:text-amber-300">Esperando respuesta</p>
                      </div>
                      @if (p.puedo_descartar) {
                        <button type="button" class="btn-icon-sm tone-danger" aria-label="Retirar la propuesta" title="Retirar la propuesta"
                                (click)="propuestaARetirar.set(p)"><lucide-icon name="trash-2"></lucide-icon></button>
                      }
                    </li>
                  }
                </ul>
              }
            </section>
          }
        </aside>
      </div>
    }
  </div>

  <ng-template #detalle let-p>
    @if (p.objetivo || p.texto_biblico || p.referencias || p.temas.length) {
      <dl class="detalle">
        @if (p.objetivo) { <dt>Objetivo</dt><dd class="whitespace-pre-line">{{ p.objetivo }}</dd> }
        @if (p.texto_biblico) {
          <dt>Texto bíblico</dt>
          <dd>
            <span class="font-semibold">{{ p.texto_biblico }}</span>
            <a class="btn-link ml-2 inline-flex items-center gap-1" [href]="wol(p.texto_biblico)" target="_blank" rel="noopener noreferrer">
              Ver en WOL<lucide-icon name="external-link" [size]="13" aria-hidden="true"></lucide-icon>
            </a>
          </dd>
        }
        @if (p.referencias) { <dt>Referencias</dt><dd class="prosa" [innerHTML]="md(p.referencias)"></dd> }
        @if (p.temas.length) {
          <dt>Temas</dt>
          <dd><ul class="list-disc pl-5">@for (t of p.temas; track $index) { <li>{{ t }}</li> }</ul></dd>
        }
      </dl>
    }
  </ng-template>

  <app-modal [open]="proponerAbierto()" (closed)="proponerAbierto.set(false)" title="Proponer un punto"
             subtitle="El coordinador y el secretario recibirán su propuesta." variant="sheet" [hasFooter]="true">
    <div class="flex flex-col gap-5">
      <div>
        <label class="form-label" for="pp-titulo">¿Qué tema quiere tratar?</label>
        <input id="pp-titulo" class="form-control" maxlength="300" placeholder="Ej.: Arreglos para la Conmemoración"
               [(ngModel)]="propuesta.titulo" (keydown.enter)="enviarPropuesta()" />
      </div>
      <div>
        <label class="form-label" for="pp-porque">¿Por qué? <span class="font-normal text-slate-500">(opcional)</span></label>
        <textarea id="pp-porque" class="form-control" rows="3" placeholder="En pocas palabras, por qué conviene hablarlo"
                  [(ngModel)]="propuesta.objetivo"></textarea>
      </div>
      <div>
        <label class="form-label" for="pp-min">¿Cuántos minutos necesita? <span class="font-normal text-slate-500">(opcional)</span></label>
        <input id="pp-min" type="number" inputmode="numeric" min="0" max="240" class="form-control max-w-[10rem]" placeholder="Ej.: 10"
               [(ngModel)]="propuesta.minutos" />
      </div>
    </div>
    <div slot="footer" class="flex gap-3">
      <button type="button" class="btn-ghost" (click)="proponerAbierto.set(false)">Cancelar</button>
      <button type="button" class="btn-primary" [disabled]="!propuesta.titulo.trim() || enviando()" (click)="enviarPropuesta()">
        @if (enviando()) { <span class="spinner-sm" aria-hidden="true"></span> } Enviar propuesta
      </button>
    </div>
  </app-modal>

  <app-confirm-dialog [open]="!!propuestaARetirar()" severity="danger" title="¿Retirar su propuesta?"
    [message]="'«' + (propuestaARetirar()?.titulo || '') + '» se borrará y no se tratará en la reunión.'"
    confirmLabel="Retirar" [busy]="retirando()"
    (confirmed)="retirar()" (cancelled)="propuestaARetirar.set(null)" />
  `,
  styles: [`
    :host { display: block; }
    /* En ancho, la última tarjeta de la columna lateral llena el alto: así las dos columnas terminan juntas. */
    /* Las tarjetas laterales no se encogen (con varias, el programa compacto quedaba en una raya): la columna se desplaza. */
    @container (min-width: 64rem) { .lateral > section { flex-shrink: 0; } .lateral > section:last-child { flex: 1 0 auto; } }
    .lista-interna { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.45) transparent; overscroll-behavior: contain; }
    .num {
      flex-shrink: 0; width: 2rem; height: 2rem; border-radius: 0.625rem; display: inline-grid; place-items: center;
      font-weight: 700; font-size: 0.875rem; font-variant-numeric: tabular-nums;
      background: color-mix(in oklab, var(--accent) 10%, white); color: var(--accent);
    }
    .en-vivo-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1rem; padding: 0.875rem 1rem; border-radius: 1rem;
      border: 1px solid color-mix(in oklab, var(--accent) 30%, transparent); background: color-mix(in oklab, var(--accent) 6%, transparent); }
    .num-sm { width: 1.75rem; height: 1.75rem; font-size: 0.75rem; }
    :host-context(.dark) .num { background: color-mix(in oklab, var(--accent) 22%, transparent); color: color-mix(in oklab, var(--accent) 45%, white); }
    .fila, .fila-fija {
      width: 100%; display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; font-size: 0.875rem;
    }
    @container (min-width: 48rem) { .fila, .fila-fija { padding-inline: 1.25rem; } }
    .fila { text-align: left; min-height: 3.5rem; transition: background-color 150ms ease-out; }
    .fila:hover { background: var(--color-slate-50); }
    :host-context(.dark) .fila:hover { background: rgb(255 255 255 / 0.03); }
    .fila:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: -2px; }
    .mia > .fila { background: color-mix(in oklab, var(--accent) 6%, transparent); }
    .persona { font-weight: 600; color: var(--color-slate-700); max-width: 12rem; }
    :host-context(.dark) .persona { color: var(--color-slate-200); }
    @container (max-width: 36rem) { .fila .persona { display: none; } }
    .tachada { text-decoration: line-through; color: var(--color-slate-500); }
    .flecha { transition: transform 200ms var(--ease-out-strong); }
    .flecha.girada { transform: rotate(180deg); }
    .entra { animation: entra 200ms var(--ease-out-strong) both; }
    @keyframes entra { from { opacity: 0; transform: translateY(-4px); } }

    .chip-estado {
      display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.1875rem 0.625rem; border-radius: 9999px;
      font-size: 0.75rem; font-weight: 700; border: 1px solid color-mix(in oklab, var(--est) 32%, transparent);
      color: var(--est); background: color-mix(in oklab, var(--est) 11%, transparent);
    }
    .chip-estado::before { content: ''; width: 0.375rem; height: 0.375rem; border-radius: 9999px; background: currentColor; }
    .mini-prog { margin: 0; padding: 0.25rem 0; list-style: none; }
    .mini-fila { display: flex; align-items: flex-start; gap: 0.625rem; padding: 0.5rem 1rem; font-size: 0.875rem; color: var(--color-slate-800); }
    :host-context(.dark) .mini-fila { color: var(--color-slate-100); }
    .mini-fija { align-items: center; color: var(--color-slate-500); }
    :host-context(.dark) .mini-fija { color: var(--color-slate-400); }
    .mini-n {
      flex-shrink: 0; width: 1.5rem; height: 1.5rem; border-radius: 0.5rem; display: grid; place-items: center;
      font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-slate-500);
    }
    .mini-fila:not(.mini-fija) .mini-n { background: var(--color-slate-100); }
    :host-context(.dark) .mini-fila:not(.mini-fija) .mini-n { background: var(--color-slate-800); color: var(--color-slate-300); }
    .mini-quien { font-size: 0.75rem; font-weight: 600; color: var(--color-slate-600); }
    :host-context(.dark) .mini-quien { color: var(--color-slate-300); }
    .mini-mia { background: color-mix(in oklab, var(--accent) 8%, transparent); }
    .mini-mia .mini-n { background: var(--accent) !important; color: #fff !important; }
    .datos-reunion { display: grid; gap: 0.5rem; margin: 0; }
    .datos-reunion > div { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
    .datos-reunion dt { font-size: 0.75rem; font-weight: 600; color: var(--color-slate-500); }
    .datos-reunion dd { margin: 0; font-size: 0.875rem; font-weight: 600; text-align: right; color: var(--color-slate-900); }
    :host-context(.dark) .datos-reunion dd { color: var(--color-slate-100); }
    .detalle { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.25rem 1rem; font-size: 0.875rem; line-height: 1.5; }
    @container (min-width: 40rem) { .detalle { grid-template-columns: 8rem minmax(0, 1fr); } }
    .detalle dt { font-size: 0.75rem; font-weight: 600; color: var(--color-slate-500); padding-top: 0.125rem; }
    .detalle dd { margin: 0 0 0.375rem; color: var(--color-slate-800); }
    :host-context(.dark) .detalle dt { color: var(--color-slate-400); }
    :host-context(.dark) .detalle dd { color: var(--color-slate-200); }

    .nota-privada {
      display: flex; align-items: baseline; gap: 0.25rem 0.625rem; flex-wrap: wrap;
      padding: 0.375rem 0.75rem; border-radius: 0.625rem; font-size: 0.875rem; line-height: 1.45;
      background: var(--color-amber-50); border: 1px solid var(--color-amber-200); color: var(--color-amber-950);
    }
    :host-context(.dark) .nota-privada { background: rgb(245 158 11 / 0.08); border-color: rgb(245 158 11 / 0.3); color: var(--color-amber-100); }
    .nota-privada-tit { flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.3125rem; font-size: 0.75rem; font-weight: 700; color: var(--color-amber-800); }
    :host-context(.dark) .nota-privada-tit { color: var(--color-amber-300); }

    .prosa ::ng-deep p { margin: 0 0 0.375rem; }
    .prosa ::ng-deep p:last-child { margin-bottom: 0; }
    .prosa ::ng-deep ul { list-style: disc; padding-left: 1.25rem; }
    .prosa ::ng-deep ol { list-style: decimal; padding-left: 1.25rem; }
    .prosa ::ng-deep a { font-weight: 600; text-decoration: underline; text-underline-offset: 2px; color: var(--accent); overflow-wrap: anywhere; }
    :host-context(.dark) .prosa ::ng-deep a { color: color-mix(in oklab, var(--accent) 45%, white); }

    @media (prefers-reduced-motion: reduce) { .entra { animation: none; } .flecha { transition: none; } }
  `],
})
export class ReunionPrepararPage implements OnInit {
  private svc = inject(ReunionAncianosService);
  readonly usarEnVivo = this.svc.usarEnVivo;
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(AuthStore);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);

  readonly fechaCompleta = fechaCompleta;
  readonly hora12 = hora12;
  readonly cuandoRelativo = cuandoRelativo;
  readonly wol = enlaceWol;

  r = signal<ReunionOut | null>(null);
  categorias = signal<CategoriaOut[]>([]);
  notas = signal<Map<number | null, string>>(new Map());
  cargando = signal(true);
  error = signal<'no-encontrada' | 'error' | null>(null);
  abierta = signal<number | null>(null);
  descargando = signal(false);
  leyendoActa = signal(false);

  proponerAbierto = signal(false);
  enviando = signal(false);
  propuesta = { titulo: '', objetivo: '', minutos: null as number | null };
  propuestaARetirar = signal<ParteOut | null>(null);
  retirando = signal(false);

  aceptadas = computed(() => (this.r()?.partes ?? []).filter(p => p.estado === 'aceptada'));
  readonly estadoLabel = ESTADO_REUNION_LABEL;
  mia = signal<MiParticipacion | null>(null);
  /** Terminada o cancelada: las notas personales se consultan, ya no se editan. */
  /** Tiene parte y la reunión no ha terminado: la pantalla se centra en preparar su parte. */
  enfoque = computed(() => !!this.r()?.puedo_preparar && this.misPartes().length > 0 && !this.notasCerradas());
  notasCerradas = computed(() => ['realizada', 'cancelada'].includes(this.r()?.estado ?? ''));
  misPartes = computed(() => this.aceptadas().filter(p => p.es_mia));
  /** Solo las que hizo quien mira: el gestor recibe todas, pero las ajenas se revisan en el editor. */
  misPropuestas = computed(() => (this.r()?.partes ?? []).filter(p => p.estado === 'propuesta' && String(p.propuesto_por) === String(this.store.user()?.id)));
  private catPorId = computed(() => new Map(this.categorias().map(c => [c.id_categoria, c])));
  private cacheMd = new Map<string, SafeHtml>();

  ngOnInit() {
    this.svc.cargarConfig().subscribe({ error: () => {} });
    this.cargar();
  }

  esHoy(fecha: string): boolean {
    const h = new Date();
    return fecha === `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
  }

  cargar() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) { this.error.set('no-encontrada'); this.cargando.set(false); return; }
    this.cargando.set(true);
    this.error.set(null);
    this.svc.get(id).subscribe({
      next: r => {
        this.r.set(r);
        forkJoin({
          notas: r.puedo_preparar ? this.svc.misNotas(id).pipe(catchError(() => of([] as NotaPersonal[]))) : of([] as NotaPersonal[]),
          cats: this.svc.categorias().pipe(catchError(() => of([] as CategoriaOut[]))),
          mia: r.puedo_editar ? this.svc.miParticipacion().pipe(catchError(() => of(null))) : of(null),
        }).subscribe(({ notas, cats, mia }) => {
          this.mia.set(mia && mia.configurada && mia.categorias.length ? mia : null);
          this.notas.set(new Map(notas.map(n => [n.id_parte, n.texto])));
          this.categorias.set(cats);
          this.cargando.set(false);
        });
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(e.status === 404 || e.status === 403 ? 'no-encontrada' : 'error');
        this.cargando.set(false);
      },
    });
  }

  irALista() { this.router.navigate(['/administracion/reuniones-teocraticas']); }

  numero(p: ParteOut): number { return this.aceptadas().indexOf(p) + 1; }
  categoria(p: ParteOut): CategoriaOut | null { return p.id_categoria ? this.catPorId().get(p.id_categoria) ?? null : null; }
  nota(idParte: number | null): string { return this.notas().get(idParte) ?? ''; }
  alternar(id: number) { this.abierta.update(a => (a === id ? null : id)); }

  md(texto: string): SafeHtml {
    let h = this.cacheMd.get(texto);
    if (!h) { h = this.sanitizer.bypassSecurityTrustHtml(markdownSimpleAHtml(texto)); this.cacheMd.set(texto, h); }
    return h;
  }

  notaGuardada(idParte: number | null, n: NotaPersonal | null) {
    this.notas.update(m => { const c = new Map(m); if (n) c.set(idParte, n.texto); else c.delete(idParte); return c; });
  }

  descargarPdf() {
    const r = this.r();
    if (!r || this.descargando()) return;
    this.descargando.set(true);
    this.svc.exportarPdf(r.id_reunion).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reunion_${r.tipo}_${r.fecha}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.descargando.set(false);
      },
      error: () => { this.descargando.set(false); this.toast.error('No se pudo descargar el PDF', 'Intente de nuevo en un momento.'); },
    });
  }

  leerActa() {
    const r = this.r();
    if (!r || this.leyendoActa()) return;
    const ventana = window.open('', '_blank');
    this.leyendoActa.set(true);
    this.svc.cartaActa(r.id_reunion).subscribe({
      next: blob => {
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        if (ventana) ventana.location.href = url; else window.location.href = url;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        this.leyendoActa.set(false);
      },
      error: async (e: HttpErrorResponse) => {
        ventana?.close();
        this.leyendoActa.set(false);
        let msg: string | null = null;
        try { msg = JSON.parse(await (e.error as Blob).text()).detail ?? null; } catch { /* sin detalle */ }
        this.toast.error('No se pudo abrir el acta', msg ?? 'Intente de nuevo en un momento.');
      },
    });
  }

  abrirProponer() {
    this.propuesta = { titulo: '', objetivo: '', minutos: null };
    this.proponerAbierto.set(true);
    setTimeout(() => document.getElementById('pp-titulo')?.focus(), 50);
  }

  enviarPropuesta() {
    const r = this.r();
    const titulo = this.propuesta.titulo.trim();
    if (!r || !titulo || this.enviando()) return;
    const min = Number(this.propuesta.minutos);
    this.enviando.set(true);
    this.svc.proponer(r.id_reunion, {
      titulo, objetivo: this.propuesta.objetivo.trim() || null,
      minutos: Number.isFinite(min) && min > 0 ? Math.min(MIN_MAX, Math.round(min)) : null,
    }).subscribe({
      next: parte => {
        this.r.update(x => (x ? { ...x, partes: [...x.partes, parte] } : x));
        this.enviando.set(false);
        this.proponerAbierto.set(false);
        this.toast.success('Propuesta enviada', 'El coordinador y el secretario ya la pueden ver.');
      },
      error: (e: HttpErrorResponse) => {
        this.enviando.set(false);
        this.toast.error('No se pudo enviar la propuesta', typeof e?.error?.detail === 'string' ? e.error.detail : 'Intente de nuevo.');
      },
    });
  }

  retirar() {
    const r = this.r();
    const p = this.propuestaARetirar();
    if (!r || !p) return;
    this.retirando.set(true);
    this.svc.eliminarParte(r.id_reunion, p.id_parte).subscribe({
      next: () => {
        this.r.update(x => (x ? { ...x, partes: x.partes.filter(y => y.id_parte !== p.id_parte) } : x));
        this.retirando.set(false);
        this.propuestaARetirar.set(null);
        this.toast.success('Propuesta retirada');
      },
      error: () => { this.retirando.set(false); this.toast.error('No se pudo retirar', 'Intente de nuevo.'); },
    });
  }
}
