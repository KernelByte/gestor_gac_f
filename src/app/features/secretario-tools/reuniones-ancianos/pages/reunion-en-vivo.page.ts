import { Component, computed, effect, ElementRef, HostListener, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';
import { ReunionAncianosService } from '../../services/reunion-ancianos.service';
import { ReunionVivoStore } from '../../services/reunion-vivo.store';
import { CategoriaOut, NotaPersonal, ParteVivo } from '../../models/reunion-ancianos.model';
import { AuthStore } from '../../../../core/auth/auth.store';
import { puedeEditarActas } from '../../../../core/auth/acceso-modulos';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { AvisoComponent } from '../../../../shared/components/aviso/aviso.component';
import { PickerOption } from '../../../../shared/components/select-picker/select-picker.component';
import { LucideAngularModule } from '../../../../shared/icons';
import { markdownSimpleAHtml } from '../../../../shared/utils/markdown-simple';
import { MisNotasComponent } from '../components/mis-notas.component';
import { LienzoNotasComponent } from '../components/lienzo-notas.component';
import { fechaCompleta, hora12 } from '../reunion-ancianos-formato';
import { enlaceWol } from './reunion-preparar.page';

type Semaforo = 'sin_limite' | 'en_tiempo' | 'por_terminar' | 'excedido';
type Vista = 'tiempo' | 'acta' | 'mis';
/** Cómo se reparte la pantalla según el ancho disponible (ver los estilos). */
type Modo = 'angosto' | 'dos' | 'tres' | 'acta';

/** Al 80 % del tiempo planeado se avisa que está por terminar. */
const UMBRAL_AVISO = 0.8;

/** «1:05:09» o «5:09». */
export function reloj(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`;
}

/**
 * La reunión en vivo. Una sola pantalla que se adapta al papel de quien la abre:
 *
 * - Quien toma el tiempo (o un gestor): cronómetro con Iniciar / Pausar /
 *   Siguiente / No se trató, receso y Finalizar. Atajos: Espacio y →.
 * - Quien toma las notas y los colaboradores: las notas del acta del tema, por
 *   bloques, compartidas en tiempo real.
 * - Todos: el reloj del tema y el general (iguales en todas las pantallas),
 *   quién tiene la palabra y sus notas privadas de preparación.
 *
 * En ancho: programa · tema · notas del acta. En el teléfono, una columna con
 * «Tiempo · Notas del acta · Mis notas».
 */
@Component({
  selector: 'app-reunion-en-vivo',
  standalone: true,
  providers: [ReunionVivoStore],
  imports: [
    RouterLink, ModalComponent, EmptyStateComponent, AvisoComponent, LucideAngularModule,
    MisNotasComponent, LienzoNotasComponent,
  ],
  template: `
  <div #raiz class="tema-reuniones vivo @container flex-1 min-h-0 flex flex-col gap-3" [attr.data-modo]="modo()">

    @if (st.error(); as e) {
      <div class="card p-6">
        @if (e === 'no-encontrada') {
          <app-empty-state icon="calendar-off" title="No encontramos esta reunión" description="Puede que la hayan borrado o que no esté convocada."
            actionLabel="Volver a las reuniones" (action)="irALista()" />
        } @else {
          <app-empty-state variant="error" title="No se pudo abrir la reunión" description="Revise su conexión e intente de nuevo."
            actionLabel="Intentar de nuevo" (action)="st.refrescar()" />
        }
      </div>
    } @else if (st.datos(); as d) {

      <!-- ══════ Barra superior ══════ -->
      <header class="card barra-vivo">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <a routerLink="/administracion/reuniones-teocraticas" class="btn-icon shrink-0" aria-label="Volver a las reuniones" title="Volver a las reuniones">
            <lucide-icon name="arrow-left"></lucide-icon>
          </a>
          <div class="min-w-0">
            <p class="flex items-center gap-2 flex-wrap">
              @if (d.estado === 'en_curso') {
                <span class="badge-live">{{ d.pausada_en ? 'En receso' : 'En curso' }}</span>
              } @else if (d.estado === 'realizada') {
                <span class="badge-active">Terminó</span>
              } @else {
                <span class="badge-neutral">Por empezar</span>
              }
              <span class="conexion" [attr.data-c]="st.conexion()" [title]="textoConexion()">
                <lucide-icon [name]="st.conexion() === 'sin-conexion' ? 'wifi-off' : 'wifi'" [size]="13" aria-hidden="true"></lucide-icon>
                <span class="hidden @3xl:inline">{{ textoConexion() }}</span>
              </span>
            </p>
            <h1 class="card-title truncate mt-0.5">{{ d.titulo }}</h1>
            <p class="caption truncate fecha-barra">{{ fechaCompleta(d.fecha) }}@if (d.lugar) { · {{ d.lugar }} }</p>
          </div>
        </div>
        <dl class="cifras">
          <div><dt>Transcurrido</dt><dd>{{ d.iniciada_en ? reloj(st.transcurrido()) : '—' }}</dd></div>
          <div><dt>Temas</dt><dd>{{ resumen().hechos }} / {{ resumen().total }}</dd></div>
          <div class="hidden @md:block"><dt>Tiempo de temas</dt><dd>{{ reloj(resumen().real) }} <span class="de">/ {{ resumen().plan }} min</span></dd></div>
          <div><dt>Fin estimado</dt><dd>{{ finEstimado() }}</dd></div>
        </dl>
      </header>

      @if (d.estado === 'convocada') {
        <!-- ══════ Antes de empezar ══════ -->
        <section class="card p-6 @3xl:p-8 flex flex-col items-center text-center gap-4 max-w-2xl mx-auto w-full shrink-0">
          <span class="icono-grande"><lucide-icon name="timer" [size]="28" aria-hidden="true"></lucide-icon></span>
          <div>
            <h2 class="section-title">La reunión todavía no empieza</h2>
            <p class="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-prose">
              {{ d.partes.length }} {{ d.partes.length === 1 ? 'tema' : 'temas' }} · {{ resumen().plan }} min planeados.
              Toma el tiempo: <strong>{{ d.tiempo_nombre || 'el coordinador' }}</strong>. Toma las notas: <strong>{{ d.redactor_nombre || 'el secretario' }}</strong>.
            </p>
          </div>
          @if (d.puedo_controlar) {
            @if (!esHoy(d.fecha)) {
              <app-aviso tone="warning" [dense]="true">La reunión está programada para el {{ fechaCompleta(d.fecha) }}.</app-aviso>
            }
            <button type="button" class="btn-primary btn-lg w-full max-w-sm justify-center" [disabled]="st.ocupado()" (click)="empezar()">
              <lucide-icon name="play" [size]="20" aria-hidden="true"></lucide-icon>Iniciar la reunión
            </button>
            <p class="caption">Al iniciar, todos los convocados la pueden seguir en vivo.</p>
          } @else {
            <p class="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <span class="spinner-sm" aria-hidden="true"></span>Esperando a que {{ d.tiempo_nombre || 'el coordinador' }} la inicie…
            </p>
          }
        </section>

      } @else {

        @if (d.pausada_en && d.estado === 'en_curso') {
          <div class="receso" role="status">
            <lucide-icon name="coffee" [size]="22" aria-hidden="true"></lucide-icon>
            <p class="flex-1"><strong>En receso</strong> desde las {{ horaDe(d.pausada_en) }}: el tiempo de los temas está detenido.</p>
            @if (d.puedo_controlar) {
              <button type="button" class="btn-primary" [disabled]="st.ocupado()" (click)="st.receso(false)">
                <lucide-icon name="play" [size]="16" aria-hidden="true"></lucide-icon>Reanudar
              </button>
            }
          </div>
        }

        @if (d.estado === 'realizada') {
          <app-aviso class="shrink-0" tone="success" title="La reunión terminó">
            Duró {{ reloj(st.transcurrido()) }}.
            @if (d.id_acta) { El acta ya se generó: las notas quedan solo para leer. }
            @if (d.id_acta && puedeActas) { <a class="btn-link" [routerLink]="['/administracion/actas-reunion', d.id_acta]">Abrir el acta</a> }
            <a class="btn-link ml-3" routerLink="/administracion/reuniones-teocraticas">Volver a las reuniones</a>
          </app-aviso>
        }

        <!-- Teléfono y tableta: una vista a la vez -->
        @if (modo() === 'angosto' && vistas().length > 1) {
          <div class="segmented w-full shrink-0" role="tablist" aria-label="Qué ver">
            @for (v of vistas(); track v.id) {
              <button type="button" role="tab" class="segmented-item flex-1" [attr.aria-selected]="vista() === v.id" (click)="vista.set(v.id)">
                <lucide-icon [name]="v.icono" [size]="15" aria-hidden="true"></lucide-icon>{{ v.texto }}
              </button>
            }
          </div>
        }

        <!-- Fuera de «Tiempo», el reloj del tema sigue a la vista: quien presenta lee sus notas sin perder el tiempo -->
        @if (modo() === 'angosto' && vista() !== 'tiempo' && parteActual(); as pa) {
          <button type="button" class="mini-reloj shrink-0" [attr.data-s]="semaforo(pa)" (click)="vista.set('tiempo')"
                  [attr.aria-label]="'Tiempo del tema ' + indice(pa) + ': ' + reloj(st.segundos(pa)) + '. Ver el reloj'">
            <span class="mini-num">{{ reloj(st.segundos(pa)) }}</span>
            <span class="flex-1 min-w-0 truncate text-left">{{ indice(pa) }}. {{ pa.titulo }}</span>
            <span class="mini-sem">
              @switch (semaforo(pa)) {
                @case ('en_tiempo') { Quedan {{ reloj(restante(pa)) }} }
                @case ('por_terminar') { <lucide-icon name="clock" [size]="14" aria-hidden="true"></lucide-icon>Quedan {{ reloj(restante(pa)) }} }
                @case ('excedido') { <lucide-icon name="alert-triangle" [size]="14" aria-hidden="true"></lucide-icon>Se pasó {{ reloj(-restante(pa)) }} }
              }
            </span>
          </button>
        }

        <div class="rejilla" [attr.data-vista]="vista()">

          <!-- ══════ Programa ══════ -->
          <nav class="card programa" data-panel="tiempo" aria-label="Programa">
            <p class="eyebrow px-4 pt-4 pb-2 shrink-0">Programa</p>
            <div class="programa-lista lista-interna">
              <ol class="flex flex-col pb-2">
                <li class="fila-fija"><span class="estado-ico"></span><span class="flex-1">Oración inicial</span><span class="caption">{{ d.oracion_inicial_nombre || '—' }}</span></li>
                @for (p of d.partes; track p.id_parte; let i = $index) {
                  <li>
                    <button type="button" class="fila-prog" [attr.aria-current]="p.id_parte === d.id_parte_actual ? 'step' : null"
                            [class.vista]="p.id_parte === parteVista()?.id_parte" (click)="verParte(p)">
                      <span class="estado-ico" [attr.data-e]="p.cancelada ? 'no_tratada' : p.estado_vivo" [attr.aria-label]="textoEstado(p)">
                        @switch (p.cancelada ? 'no_tratada' : p.estado_vivo) {
                          @case ('terminada') { <lucide-icon name="circle-check" [size]="18"></lucide-icon> }
                          @case ('en_curso') { <lucide-icon name="circle-dot" [size]="18"></lucide-icon> }
                          @case ('pausada') { <lucide-icon name="circle-pause" [size]="18"></lucide-icon> }
                          @case ('no_tratada') { <lucide-icon name="ban" [size]="18"></lucide-icon> }
                          @default { <span class="num">{{ i + 1 }}</span> }
                        }
                      </span>
                      <span class="flex-1 min-w-0 text-left">
                        <span class="block font-semibold leading-snug" [class.tachada]="p.cancelada || p.estado_vivo === 'no_tratada'">{{ p.titulo }}</span>
                        <span class="caption block truncate">{{ p.responsable_nombre || 'Sin asignar' }}</span>
                      </span>
                      <span class="tiempo-fila" [attr.data-s]="semaforo(p)">
                        {{ p.estado_vivo === 'pendiente' ? (p.minutos ? p.minutos + ' min' : '') : reloj(st.segundos(p)) }}
                      </span>
                    </button>
                  </li>
                }
                <li class="fila-fija"><span class="estado-ico"></span><span class="flex-1">Oración final</span><span class="caption">{{ d.oracion_final_nombre || '—' }}</span></li>
              </ol>
              @if (d.otros_temas.length) {
                <div class="px-4 pb-4">
                  <p class="eyebrow mb-1">Otros temas</p>
                  <ul class="list-disc pl-5 text-sm text-slate-700 dark:text-slate-300">@for (t of d.otros_temas; track $index) { <li>{{ t }}</li> }</ul>
                </div>
              }
            </div>
            @if (d.puedo_controlar && d.estado === 'en_curso') {
              <div class="programa-pie">
                <button type="button" class="btn-secondary justify-center" [disabled]="st.ocupado()" (click)="st.receso(!d.pausada_en)">
                  <lucide-icon [name]="d.pausada_en ? 'play' : 'coffee'" [size]="16" aria-hidden="true"></lucide-icon>{{ d.pausada_en ? 'Terminar el receso' : 'Receso' }}
                </button>
                <button type="button" class="btn-danger justify-center" [disabled]="st.ocupado()" (click)="finalizarAbierto.set(true)">
                  <lucide-icon name="square" [size]="16" aria-hidden="true"></lucide-icon>Finalizar la reunión
                </button>
              </div>
            }
          </nav>

          <!-- ══════ Tema y reloj ══════ -->
          @if (parteVista(); as p) {
            <section class="card tema lista-interna" [class.compacta]="temaCompacto()" [class.sola]="!hayMis()" data-panel="tiempo"
                     [attr.data-e]="p.cancelada ? 'no_tratada' : p.estado_vivo" [attr.data-s]="semaforo(p)" [attr.aria-label]="'Tema: ' + p.titulo">
              <div class="tema-info">
                <div class="tema-meta">
                  <span class="eyebrow">Tema {{ indice(p) }} de {{ d.partes.length }}</span>
                  <span class="estado-pill" aria-live="polite">
                    @switch (p.cancelada ? 'no_tratada' : p.estado_vivo) {
                      @case ('en_curso') { <span class="punto-vivo" aria-hidden="true"></span> }
                      @case ('pausada') { <lucide-icon name="pause" [size]="12" aria-hidden="true"></lucide-icon> }
                      @case ('terminada') { <lucide-icon name="check" [size]="12" aria-hidden="true"></lucide-icon> }
                      @case ('no_tratada') { <lucide-icon name="ban" [size]="12" aria-hidden="true"></lucide-icon> }
                    }
                    {{ textoEstado(p) }}
                  </span>
                  @if (categoria(p); as c) { <span class="cat-chip" [attr.data-color]="c.color"><lucide-icon [name]="c.icono"></lucide-icon>{{ c.etiqueta }}</span> }
                  @if (p.id_parte !== d.id_parte_actual && d.estado === 'en_curso') { <span class="badge-neutral">Viendo otro tema</span> }
                </div>
                <h2 class="tema-titulo">{{ p.titulo }}</h2>
                <p class="tema-quien">
                  <lucide-icon name="user" [size]="15" aria-hidden="true"></lucide-icon>
                  <span class="truncate">{{ p.responsable_nombre || 'Sin asignar' }}</span>@if (p.es_mia) { <span class="badge-role">Usted</span> }
                </p>
              </div>

              <div class="escenario">
              <p class="reloj-num" role="timer" [attr.aria-label]="'Tiempo del tema: ' + reloj(st.segundos(p))">{{ reloj(st.segundos(p)) }}</p>

              <div class="progreso">
                <div class="barra-t" aria-hidden="true"><span [style.transform]="'scaleX(' + progreso(p) / 100 + ')'"></span></div>
                <div class="progreso-fila">
                  <p class="semaforo">
                    @switch (semaforo(p)) {
                      @case ('en_tiempo') { <lucide-icon name="check" [size]="14" aria-hidden="true"></lucide-icon>En tiempo · quedan {{ reloj(restante(p)) }} }
                      @case ('por_terminar') { <lucide-icon name="clock" [size]="14" aria-hidden="true"></lucide-icon>Por terminar · quedan {{ reloj(restante(p)) }} }
                      @case ('excedido') { <lucide-icon name="alert-triangle" [size]="14" aria-hidden="true"></lucide-icon>Se pasó por {{ reloj(-restante(p)) }} }
                      @default { Sin tiempo planeado }
                    }
                  </p>
                  @if (p.minutos) { <span class="plan">de {{ p.minutos }} min</span> }
                </div>
              </div>
              </div>

              <div class="tema-ctrl">
                @if (d.puedo_controlar && d.estado === 'en_curso' && !d.pausada_en && todosTratados() && p.estado_vivo !== 'en_curso') {
                  <!-- Ya no queda ningún tema: lo que sigue es finalizar -->
                  <div class="fin-temas" role="status">
                    <p class="fin-texto"><lucide-icon name="circle-check" [size]="18" aria-hidden="true"></lucide-icon>Ya se trataron todos los temas</p>
                    <button type="button" class="btn-primary btn-lg justify-center w-full" [disabled]="st.ocupado()" (click)="finalizarAbierto.set(true)">
                      <lucide-icon name="square" [size]="18" aria-hidden="true"></lucide-icon>Finalizar la reunión
                    </button>
                    @if (p.estado_vivo === 'terminada') {
                      <button type="button" class="btn-ghost btn-sm justify-center" [disabled]="st.ocupado()" (click)="st.crono('iniciar', p.id_parte)">
                        <lucide-icon name="play" [size]="15" aria-hidden="true"></lucide-icon>Volver a este tema
                      </button>
                    }
                  </div>
                } @else if (d.puedo_controlar && d.estado === 'en_curso' && !d.pausada_en) {
                  <div class="controles">
                    @if (p.estado_vivo === 'en_curso') {
                      <button type="button" class="btn-secondary btn-lg justify-center" [disabled]="st.ocupado()" (click)="st.crono('pausar', p.id_parte)"
                              aria-keyshortcuts="Space" title="Pausar (Espacio)">
                        <lucide-icon name="pause" [size]="20" aria-hidden="true"></lucide-icon>Pausar
                      </button>
                      <button type="button" class="btn-primary btn-lg justify-center ctrl-principal" [disabled]="st.ocupado()" (click)="terminarTema(p)"
                              aria-keyshortcuts="ArrowRight" title="Flecha derecha">
                        {{ hayOtra(p) ? 'Terminar y seguir' : 'Terminar el último tema' }}<lucide-icon name="skip-forward" [size]="20" aria-hidden="true"></lucide-icon>
                      </button>
                    } @else {
                      <button type="button" class="btn-primary btn-lg justify-center ctrl-principal ctrl-ancho" [disabled]="st.ocupado() || p.cancelada" (click)="st.crono('iniciar', p.id_parte)"
                              aria-keyshortcuts="Space" title="Espacio">
                        <lucide-icon name="play" [size]="20" aria-hidden="true"></lucide-icon>
                        {{ p.estado_vivo === 'pausada' ? 'Reanudar este tema' : p.estado_vivo === 'terminada' ? 'Volver a este tema' : 'Iniciar este tema' }}
                      </button>
                    }
                    @if (p.estado_vivo !== 'no_tratada' && p.estado_vivo !== 'terminada') {
                      <button type="button" class="btn-ghost justify-center ctrl-no" [disabled]="st.ocupado()" (click)="st.crono('no_tratada', p.id_parte)">
                        <lucide-icon name="ban" [size]="16" aria-hidden="true"></lucide-icon>No se trató
                      </button>
                    }
                  </div>
                  <p class="caption atajos text-center">Atajos: Espacio inicia o pausa · → pasa al siguiente</p>
                } @else if (d.estado === 'en_curso' && !d.puedo_controlar) {
                  <p class="caption text-center">Lleva el tiempo {{ d.tiempo_nombre || 'el coordinador' }}.</p>
                }
              </div>

              @if (p.objetivo || p.texto_biblico || p.referencias || p.temas.length || p.nota_asignado) {
                <details class="detalle-tema" [open]="p.es_mia && !temaCompacto()">
                  <summary><span>Objetivo, texto y referencias</span><lucide-icon name="chevron-down" [size]="16" aria-hidden="true" class="det-chevron"></lucide-icon></summary>
                  <dl class="detalle">
                    @if (p.objetivo) { <dt>Objetivo</dt><dd class="whitespace-pre-line">{{ p.objetivo }}</dd> }
                    @if (p.texto_biblico) {
                      <dt>Texto bíblico</dt>
                      <dd><strong>{{ p.texto_biblico }}</strong>
                        <a class="btn-link ml-2" [href]="wol(p.texto_biblico)" target="_blank" rel="noopener noreferrer">Ver en WOL</a></dd>
                    }
                    @if (p.referencias) { <dt>Referencias</dt><dd class="prosa" [innerHTML]="md(p.referencias)"></dd> }
                    @if (p.temas.length) { <dt>Temas</dt><dd><ul class="list-disc pl-5">@for (t of p.temas; track $index) { <li>{{ t }}</li> }</ul></dd> }
                    @if (p.nota_asignado && p.es_mia) {
                      <dt class="flex items-center gap-1"><lucide-icon name="lock" [size]="13" aria-hidden="true"></lucide-icon>Para usted</dt>
                      <dd class="prosa" [innerHTML]="md(p.nota_asignado)"></dd>
                    }
                  </dl>
                </details>
              }
            </section>

            <!-- ══════ Notas personales ══════ -->
            @if (hayMis()) {
              <section class="card mis" data-panel="mis" aria-label="Mis notas">
                @for (x of [p.id_parte]; track x) {
                  <app-mis-notas [llenar]="true" [amplia]="true" [soloLectura]="d.estado === 'realizada'"
                    [idReunion]="d.id_reunion" [idParte]="p.id_parte" [valor]="notaPrivada(p.id_parte)"
                    [etiqueta]="p.es_mia ? 'Notas personales de su parte' : 'Notas personales de esta parte'"
                    [placeholder]="p.es_mia ? 'Sus puntos, los textos que va a leer y las preguntas que hará' : 'Lo que quiere tener presente en este tema'"
                    (guardada)="notaGuardada(p.id_parte, $event)" />
                }
                @if (notaPrivada(null)) {
                  <details class="nota-anterior shrink-0">
                    <summary>Nota anterior de la reunión</summary>
                    <app-mis-notas [soloLectura]="d.estado === 'realizada'" [idReunion]="d.id_reunion" [idParte]="null" [valor]="notaPrivada(null)" [compacta]="true"
                      etiqueta="Nota anterior" (guardada)="notaGuardada(null, $event)" />
                  </details>
                }
              </section>
            }
          } @else {
            <section class="card tema sola p-6" data-panel="tiempo">
              <app-empty-state [compact]="true" icon="file-text" title="El programa no tiene temas" description="Añádalos desde el editor de la reunión." />
            </section>
          }

          <!-- ══════ Notas del acta (quien toma las notas y colaboradores) ══════ -->
          @if (d.puedo_colaborar) {
            <section class="card acta" data-panel="acta" aria-labelledby="t-acta">
              <div class="acta-cab">
                <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h2 id="t-acta" class="card-title">Notas para el acta</h2>
                  <p class="caption min-w-0 truncate">
                    Toma las notas: <strong>{{ d.redactor_nombre || 'el secretario' }}</strong>@if (d.colaboradores_nombres.length) { · colaboran: {{ d.colaboradores_nombres.join(', ') }} }
                  </p>
                </div>
                <!-- Dónde se anota: el tema que se está tratando o lo general de la reunión -->
                <div class="segmented w-full" role="tablist" aria-label="Dónde anotar">
                  <button type="button" role="tab" class="segmented-item flex-1 min-w-0" [attr.aria-selected]="ambitoActa() === 'tema'" (click)="ambitoActa.set('tema')">
                    <span class="truncate">@if (parteVista(); as p) { {{ indice(p) }}. {{ p.titulo }} } @else { Este tema }</span>
                    @if (cuantos('tema')) { <span class="tab-count">{{ cuantos('tema') }}</span> }
                  </button>
                  <button type="button" role="tab" class="segmented-item shrink-0" [attr.aria-selected]="ambitoActa() === 'general'" (click)="ambitoActa.set('general')">
                    Generales
                    @if (cuantos('general')) { <span class="tab-count">{{ cuantos('general') }}</span> }
                  </button>
                </div>
              </div>
              <div class="acta-cuerpo">
                @if (ambitoActa() === 'tema') {
                  @if (parteVista(); as p) {
                    @for (x of [p.id_parte]; track x) {
                      <app-lienzo-notas [llenar]="true" [idReunion]="d.id_reunion" [idParte]="p.id_parte" [puntos]="d.puntos"
                        [puedoColaborar]="!(d.estado === 'realizada' && d.id_acta) && (d.estado !== 'realizada' || d.puedo_redactar)" [opcionesResponsable]="opcionesResponsable()" (cambio)="st.refrescar()" />
                    }
                  } @else {
                    <p class="text-sm text-slate-500 dark:text-slate-400">Elija un tema del programa para anotar.</p>
                  }
                } @else {
                  <app-lienzo-notas [llenar]="true" [idReunion]="d.id_reunion" [idParte]="null" [puntos]="d.puntos"
                    [puedoColaborar]="!(d.estado === 'realizada' && d.id_acta) && (d.estado !== 'realizada' || d.puedo_redactar)" [opcionesResponsable]="opcionesResponsable()" (cambio)="st.refrescar()" />
                }
              </div>
            </section>
          }
        </div>
      }
    } @else {
      <div class="card p-6 flex flex-col gap-3" aria-busy="true" aria-label="Cargando la reunión">
        <div class="skeleton h-6 w-64"></div><div class="skeleton h-40"></div>
      </div>
    }
  </div>

  <!-- ══════ Finalizar ══════ -->
  <app-modal [open]="finalizarAbierto()" (closed)="finalizarAbierto.set(false)" title="¿Finalizar la reunión?" size="lg" [hasFooter]="true">
    @if (st.datos(); as d) {
      <div class="flex flex-col gap-4">
        <dl class="resumen-fin">
          <div><dt>Temas tratados</dt><dd>{{ resumen().hechos }} de {{ resumen().total }}</dd></div>
          <div><dt>Tiempo de los temas</dt><dd>{{ reloj(resumen().real) }} <span class="de">de {{ resumen().plan }} min</span></dd></div>
          <div><dt>Acuerdos</dt><dd>{{ conteo('acuerdo') }}</dd></div>
          <div><dt>Con responsable</dt><dd>{{ conAcuerdoResponsable() }}</dd></div>
        </dl>
        @if (resumen().sinTratar) {
          <app-aviso tone="warning" [dense]="true">{{ resumen().sinTratar === 1 ? 'Queda 1 tema' : 'Quedan ' + resumen().sinTratar + ' temas' }} sin tratar: saldrán en el acta como «No se trató».</app-aviso>
        }
        <p class="text-sm text-slate-600 dark:text-slate-300">
          @if (d.con_acta) { Se generará el acta con lo escrito en cada tema, para que el secretario la revise y la finalice. }
          @if (conAcuerdoResponsable()) { Los acuerdos con responsable se convertirán en tareas y se les avisará. }
        </p>
      </div>
    }
    <div slot="footer" class="flex gap-3">
      <button type="button" class="btn-ghost" (click)="finalizarAbierto.set(false)">Seguir en la reunión</button>
      <button type="button" class="btn-danger" [disabled]="finalizando()" (click)="finalizar()">
        @if (finalizando()) { <span class="spinner-sm" aria-hidden="true"></span> }
        {{ st.datos()?.con_acta ? 'Finalizar y generar el acta' : 'Finalizar' }}
      </button>
    </div>
  </app-modal>
  `,
  styles: [`
    :host { display: block; }
    .lista-interna { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.45) transparent; overscroll-behavior: contain; }

    /* ── Barra superior ── */
    .barra-vivo { flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 1.5rem; padding: 0.625rem 1rem; }
    .cifras { display: flex; flex-wrap: wrap; gap: 0.25rem 1.5rem; margin-left: auto; }
    .cifras dt, .resumen-fin dt { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-slate-500); }
    .cifras dd, .resumen-fin dd { font-family: var(--font-display, inherit); font-size: 1.125rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-slate-900); }
    :host-context(.dark) .cifras dt, :host-context(.dark) .resumen-fin dt { color: var(--color-slate-400); }
    :host-context(.dark) .cifras dd, :host-context(.dark) .resumen-fin dd { color: var(--color-slate-50); }
    .vivo[data-modo='angosto'] .barra-vivo { padding: 0.5rem 0.75rem; gap: 0.375rem 1rem; }
    .vivo[data-modo='angosto'] .fecha-barra { display: none; }
    .vivo[data-modo='angosto'] .cifras { margin-left: 0; width: 100%; justify-content: space-between; gap: 0.25rem 0.75rem; }
    .vivo[data-modo='angosto'] .cifras dd { font-size: 1rem; }
    .de { font-size: 0.875rem; font-weight: 600; color: var(--color-slate-500); }
    .resumen-fin { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
    .resumen-fin > div { padding: 0.75rem; border-radius: 0.75rem; background: var(--color-slate-50); }
    :host-context(.dark) .resumen-fin > div { background: rgb(2 6 23 / 0.4); }

    .conexion { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; font-weight: 600; color: var(--color-slate-500); }
    .conexion[data-c='en-vivo'] { color: var(--color-green-700); }
    .conexion[data-c='sin-conexion'] { color: var(--color-rose-700); }
    :host-context(.dark) .conexion[data-c='en-vivo'] { color: var(--color-green-400); }
    :host-context(.dark) .conexion[data-c='sin-conexion'] { color: var(--color-rose-300); }

    .icono-grande { width: 3.5rem; height: 3.5rem; border-radius: 1rem; display: grid; place-items: center; color: var(--accent); background: color-mix(in oklab, var(--accent) 10%, transparent); }
    .receso { flex-shrink: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1rem; padding: 0.75rem 1rem; border-radius: 1rem;
      background: var(--color-amber-50); border: 1px solid var(--color-amber-200); color: var(--color-amber-950); }
    :host-context(.dark) .receso { background: rgb(245 158 11 / 0.1); border-color: rgb(245 158 11 / 0.3); color: var(--color-amber-100); }

    /* ── Reloj pequeño (teléfono, fuera de «Tiempo») ── */
    .mini-reloj {
      --s: var(--color-slate-500);
      display: flex; align-items: center; gap: 0.75rem; min-height: 2.75rem; padding: 0.375rem 0.875rem; border-radius: 0.875rem;
      font-size: 0.875rem; font-weight: 600; color: var(--color-slate-800); background: var(--color-white);
      border: 1px solid color-mix(in oklab, var(--s) 40%, var(--color-slate-200));
      transition: border-color 300ms ease-out, transform 120ms ease-out;
      animation: aparece 180ms cubic-bezier(0.23, 1, 0.32, 1) both;
    }
    :host-context(.dark) .mini-reloj { color: var(--color-slate-100); background: var(--color-slate-900); border-color: color-mix(in oklab, var(--s) 45%, var(--color-slate-800)); }
    .mini-reloj:active { transform: scale(0.98); }
    .mini-reloj:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 2px; }
    .mini-reloj[data-s='en_tiempo'] { --s: var(--color-green-600); }
    .mini-reloj[data-s='por_terminar'] { --s: var(--color-amber-500); }
    .mini-reloj[data-s='excedido'] { --s: var(--color-rose-600); }
    .mini-num { font-family: var(--font-display, inherit); font-size: 1.5rem; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; color: var(--color-slate-900); }
    :host-context(.dark) .mini-num { color: var(--color-slate-50); }
    .mini-reloj[data-s='excedido'] .mini-num { color: var(--color-rose-600); }
    :host-context(.dark) .mini-reloj[data-s='excedido'] .mini-num { color: var(--color-rose-400); }
    .mini-sem { flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--s); }
    .mini-reloj[data-s='en_tiempo'] .mini-sem { color: var(--color-green-700); }
    :host-context(.dark) .mini-reloj[data-s='en_tiempo'] .mini-sem { color: var(--color-green-400); }
    .mini-reloj[data-s='por_terminar'] .mini-sem { color: var(--color-amber-700); }
    :host-context(.dark) .mini-reloj[data-s='por_terminar'] .mini-sem { color: var(--color-amber-300); }
    :host-context(.dark) .mini-reloj[data-s='excedido'] .mini-sem { color: var(--color-rose-300); }

    /* ── Distribución ──
       La pantalla no se desplaza entera: el alto se reparte y cada panel se
       desplaza por dentro, así el reloj y las notas siempre quedan a la vista.
       - angosto: una vista a la vez (Tiempo · Notas del acta · Mis notas).
       - dos:     programa | tema arriba y mis notas debajo.
       - tres:    programa | tema | mis notas (quien presenta: el tiempo al lado de sus notas).
       - acta:    programa | tema arriba y mis notas debajo | notas del acta. */
    .rejilla { flex: 1 1 0; min-height: 0; }
    .rejilla > .card { min-height: 0; display: flex; flex-direction: column; }

    .vivo[data-modo='angosto'] .rejilla { display: flex; flex-direction: column; gap: 0.75rem; overflow-y: auto; padding-bottom: 1rem; }
    .vivo[data-modo='angosto'] .rejilla > .card { flex-shrink: 0; }
    .vivo[data-modo='angosto'] .tema { order: -1; }
    .vivo[data-modo='angosto'] .mis, .vivo[data-modo='angosto'] .acta { flex: 1 0 auto; min-height: 24rem; }
    .vivo[data-modo='angosto'] .rejilla[data-vista='tiempo'] [data-panel]:not([data-panel~='tiempo']),
    .vivo[data-modo='angosto'] .rejilla[data-vista='acta'] [data-panel]:not([data-panel~='acta']),
    .vivo[data-modo='angosto'] .rejilla[data-vista='mis'] [data-panel]:not([data-panel~='mis']) { display: none; }

    .vivo:not([data-modo='angosto']) .rejilla {
      display: grid; gap: 0.75rem; overflow: hidden;
      grid-template-columns: 15rem minmax(0, 1fr); grid-template-rows: fit-content(62%) minmax(0, 1fr);
    }
    .vivo:not([data-modo='angosto']) .programa { grid-column: 1; grid-row: 1 / -1; }
    .vivo:not([data-modo='angosto']) .tema { grid-column: 2; grid-row: 1; }
    .vivo:not([data-modo='angosto']) .tema.sola { grid-row: 1 / -1; }
    .vivo:not([data-modo='angosto']) .mis { grid-column: 2; grid-row: 2; }
    .vivo[data-modo='tres'] .rejilla { grid-template-columns: 15rem minmax(0, 1fr) minmax(0, 1.15fr); grid-template-rows: minmax(0, 1fr); }
    .vivo[data-modo='tres'] .tema { grid-row: 1; }
    .vivo[data-modo='tres'] .mis { grid-column: 3; grid-row: 1; }
    .vivo[data-modo='acta'] .rejilla { grid-template-columns: 15rem minmax(0, 1fr) minmax(0, 1fr); }
    .vivo[data-modo='acta'] .acta { grid-column: 3; grid-row: 1 / -1; }

    /* ── Programa ── */
    .programa { overflow: hidden; }
    .vivo:not([data-modo='angosto']) .programa-lista { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
    .programa-pie { flex-shrink: 0; display: flex; flex-direction: column; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid var(--color-slate-200); }
    :host-context(.dark) .programa-pie { border-color: var(--color-slate-800); }
    .fila-fija { display: flex; align-items: center; gap: 0.625rem; padding: 0.5rem 1rem; font-size: 0.75rem; color: var(--color-slate-500); }
    :host-context(.dark) .fila-fija { color: var(--color-slate-400); }
    .fila-prog { width: 100%; display: flex; align-items: center; gap: 0.625rem; padding: 0.625rem 0.75rem 0.625rem 1rem; font-size: 0.875rem;
      border-left: 3px solid transparent; transition: background-color 150ms ease-out; color: var(--color-slate-800); }
    :host-context(.dark) .fila-prog { color: var(--color-slate-100); }
    .fila-prog:hover { background: var(--color-slate-50); }
    :host-context(.dark) .fila-prog:hover { background: rgb(255 255 255 / 0.04); }
    .fila-prog.vista { background: color-mix(in oklab, var(--accent) 7%, transparent); }
    .fila-prog[aria-current='step'] { border-left-color: var(--accent); }
    .fila-prog:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: -2px; }
    .estado-ico { width: 1.75rem; height: 1.75rem; flex-shrink: 0; display: grid; place-items: center; color: var(--color-slate-400); }
    .estado-ico[data-e='terminada'] { color: var(--color-green-600); }
    .estado-ico[data-e='en_curso'] { color: var(--accent); }
    .estado-ico[data-e='pausada'] { color: var(--color-amber-600); }
    .num { width: 1.5rem; height: 1.5rem; border-radius: 9999px; display: grid; place-items: center; font-size: 0.75rem; font-weight: 700;
      border: 1px solid var(--color-slate-300); color: var(--color-slate-600); }
    :host-context(.dark) .num { border-color: var(--color-slate-700); color: var(--color-slate-300); }
    .tachada { text-decoration: line-through; color: var(--color-slate-500); }
    .tiempo-fila { font-size: 0.75rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--color-slate-500); }
    .tiempo-fila[data-s='por_terminar'] { color: var(--color-amber-700); }
    .tiempo-fila[data-s='excedido'] { color: var(--color-rose-700); }
    :host-context(.dark) .tiempo-fila[data-s='por_terminar'] { color: var(--color-amber-300); }
    :host-context(.dark) .tiempo-fila[data-s='excedido'] { color: var(--color-rose-300); }

    /* ── Tema y reloj ──
       La tarjeta es su propio contenedor: se acomoda a su ancho, no al de la pantalla.
       - Sola (columna propia o teléfono): reloj grande y centrado en el alto.
       - Compacta (comparte columna con las notas): título a la izquierda, reloj a
         la derecha en la misma línea, barra a todo el ancho y botones en una fila. */
    .tema {
      --s: var(--color-slate-400);
      container: tema / inline-size;
      padding: 1.25rem; gap: 1rem; overflow-y: auto;
    }
    .tema[data-s='en_tiempo'] { --s: var(--color-green-600); }
    .tema[data-s='por_terminar'] { --s: var(--color-amber-500); }
    .tema[data-s='excedido'] { --s: var(--color-rose-600); }
    :host-context(.dark) .tema[data-s='en_tiempo'] { --s: var(--color-green-400); }
    :host-context(.dark) .tema[data-s='por_terminar'] { --s: var(--color-amber-300); }
    :host-context(.dark) .tema[data-s='excedido'] { --s: var(--color-rose-400); }

    .tema-info { display: flex; flex-direction: column; gap: 0.375rem; min-width: 0; }
    .tema-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem 0.5rem; }
    .tema-titulo { font-family: var(--font-display, inherit); font-size: 1.5rem; font-weight: 700; line-height: 1.2; letter-spacing: -0.01em;
      color: var(--color-slate-900); text-wrap: balance; }
    :host-context(.dark) .tema-titulo { color: var(--color-slate-50); }
    .tema-quien { display: flex; align-items: center; gap: 0.375rem; min-width: 0; font-size: 0.875rem; color: var(--color-slate-600); }
    :host-context(.dark) .tema-quien { color: var(--color-slate-300); }

    /* Estado del tema: punto que late en curso, pausa en ámbar */
    .estado-pill {
      display: inline-flex; align-items: center; gap: 0.3125rem; height: 1.5rem; padding: 0 0.5rem; border-radius: 9999px;
      font-size: 0.75rem; font-weight: 700; color: var(--color-slate-600); background: var(--color-slate-100);
      transition: color 200ms ease-out, background-color 200ms ease-out;
    }
    :host-context(.dark) .estado-pill { color: var(--color-slate-300); background: var(--color-slate-800); }
    .tema[data-e='en_curso'] .estado-pill { color: var(--color-green-700); background: color-mix(in oklab, var(--color-green-500) 12%, transparent); }
    :host-context(.dark) .tema[data-e='en_curso'] .estado-pill { color: var(--color-green-300); }
    .tema[data-e='pausada'] .estado-pill { color: var(--color-amber-700); background: color-mix(in oklab, var(--color-amber-500) 14%, transparent); }
    :host-context(.dark) .tema[data-e='pausada'] .estado-pill { color: var(--color-amber-300); }
    .punto-vivo { position: relative; width: 0.5rem; height: 0.5rem; border-radius: 9999px; background: currentColor; }
    .punto-vivo::after { content: ''; position: absolute; inset: 0; border-radius: inherit; background: currentColor; animation: late 1.6s cubic-bezier(0.23, 1, 0.32, 1) infinite; }
    @keyframes late { from { transform: scale(1); opacity: 0.55; } to { transform: scale(2.6); opacity: 0; } }

    /* Reloj */
    .reloj-num {
      font-family: var(--font-display, inherit); font-size: clamp(4.5rem, 24cqi, 8rem); font-weight: 700; line-height: 0.95;
      font-variant-numeric: tabular-nums; letter-spacing: -0.035em; text-align: center; color: var(--color-slate-900);
      transition: color 300ms ease-out, opacity 300ms ease-out;
    }
    :host-context(.dark) .reloj-num { color: var(--color-slate-50); }
    .tema[data-s='excedido'] .reloj-num { color: var(--color-rose-600); }
    :host-context(.dark) .tema[data-s='excedido'] .reloj-num { color: var(--color-rose-400); }
    /* En pausa el número respira: se ve detenido sin tener que leer la etiqueta */
    .tema[data-e='pausada'] .reloj-num { animation: respira 2.4s ease-in-out infinite; }
    @keyframes respira { 50% { opacity: 0.45; } }
    .tema[data-e='pendiente'] .reloj-num, .tema[data-e='no_tratada'] .reloj-num { color: var(--color-slate-400); }

    .progreso { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; max-width: 26rem; }
    .barra-t { position: relative; height: 0.5rem; border-radius: 9999px; background: var(--color-slate-200); overflow: hidden; }
    :host-context(.dark) .barra-t { background: var(--color-slate-800); }
    .barra-t > span {
      position: absolute; inset: 0; border-radius: inherit; background: var(--s); transform-origin: left center;
      transition: transform 1s linear, background-color 300ms ease-out;
    }
    .progreso-fila { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.25rem 0.75rem; }
    .semaforo { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--s); }
    .tema[data-s='en_tiempo'] .semaforo { color: var(--color-green-700); }
    :host-context(.dark) .tema[data-s='en_tiempo'] .semaforo { color: var(--color-green-400); }
    .tema[data-s='por_terminar'] .semaforo { color: var(--color-amber-700); }
    :host-context(.dark) .tema[data-s='por_terminar'] .semaforo { color: var(--color-amber-300); }
    .tema[data-s='sin_limite'] .semaforo { color: var(--color-slate-500); font-weight: 600; }
    .plan { font-size: 0.75rem; font-weight: 600; color: var(--color-slate-500); font-variant-numeric: tabular-nums; }
    :host-context(.dark) .plan { color: var(--color-slate-400); }

    /* El escenario: el reloj flota en el centro con un halo del color del semáforo.
       Sola: ocupa el alto libre. Compacta: más pequeño, para dejar sitio a las notas. */
    .escenario { position: relative; isolation: isolate; display: flex; flex-direction: column; align-items: center; gap: 0.875rem; padding: 0.75rem 0 0.25rem; }
    .escenario::before {
      content: ''; position: absolute; z-index: -1; left: 50%; top: 38%; width: min(90%, 26rem); aspect-ratio: 2.2 / 1;
      border-radius: 9999px; transform: translate(-50%, -50%);
      background: radial-gradient(closest-side, color-mix(in oklab, var(--s) 20%, transparent), transparent);
      transition: background 400ms ease-out;
    }
    .tema[data-e='en_curso'] .escenario::before { animation: halo 3.2s ease-in-out infinite; }
    @keyframes halo { 50% { transform: translate(-50%, -50%) scale(1.08); opacity: 0.7; } }
    .vivo:not([data-modo='angosto']) .tema:not(.compacta) .escenario { margin-top: auto; }
    .vivo:not([data-modo='angosto']) .tema:not(.compacta) .tema-ctrl { margin-bottom: auto; }
    .tema-ctrl { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; max-width: 32rem; margin-inline: auto; }
    .tema-ctrl:empty { display: none; }
    .controles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem; }
    .ctrl-ancho, .ctrl-no { grid-column: 1 / -1; }

    /* Compacta */
    .tema.compacta { gap: 0.75rem; }
    .tema.compacta .tema-titulo { font-size: 1.125rem; }
    .tema.compacta .escenario { padding: 0.25rem 0 0; gap: 0.625rem; }
    .tema.compacta .reloj-num { font-size: clamp(3.5rem, 15cqi, 5rem); }
    .tema.compacta .controles { display: flex; flex-wrap: wrap; }
    .tema.compacta .controles > * { flex: 1 1 9rem; }
    .tema.compacta .controles > .ctrl-principal { flex-grow: 1.6; }
    .tema.compacta .controles > .ctrl-no { flex: 0 0 auto; }
    .tema.compacta .atajos { display: none; }
    .vivo[data-modo='angosto'] .atajos { display: none; }

    /* Detalle plegable */
    .detalle-tema { border-top: 1px solid var(--color-slate-200); padding-top: 0.25rem; }
    :host-context(.dark) .detalle-tema { border-color: var(--color-slate-800); }
    .detalle-tema > summary {
      list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;
      min-height: 2.5rem; margin: 0 -0.5rem; padding: 0 0.5rem; border-radius: 0.625rem;
      font-size: 0.875rem; font-weight: 600; color: var(--color-slate-700); transition: background-color 150ms ease-out;
    }
    .detalle-tema > summary::-webkit-details-marker { display: none; }
    :host-context(.dark) .detalle-tema > summary { color: var(--color-slate-200); }
    @media (hover: hover) { .detalle-tema > summary:hover { background: var(--color-slate-50); } :host-context(.dark) .detalle-tema > summary:hover { background: rgb(255 255 255 / 0.04); } }
    .detalle-tema > summary:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 0; }
    .det-chevron { color: var(--color-slate-400); transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1); }
    .detalle-tema[open] .det-chevron { transform: rotate(180deg); }
    .detalle-tema[open] .detalle { animation: aparece 200ms cubic-bezier(0.23, 1, 0.32, 1) both; }
    .nota-anterior > summary { cursor: pointer; font-size: 0.875rem; font-weight: 600; color: var(--color-slate-700); min-height: 2.25rem; display: flex; align-items: center; }
    :host-context(.dark) .nota-anterior > summary { color: var(--color-slate-200); }
    .detalle { display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.25rem 1rem; font-size: 0.875rem; padding: 0.25rem 0 0.5rem; }
    @container tema (min-width: 36rem) { .detalle { grid-template-columns: 8rem minmax(0, 1fr); } }
    .detalle dt { font-size: 0.75rem; font-weight: 600; color: var(--color-slate-500); }
    .detalle dd { margin: 0 0 0.375rem; }
    .prosa ::ng-deep p { margin: 0 0 0.375rem; }
    .prosa ::ng-deep ul { list-style: disc; padding-left: 1.25rem; }
    .prosa ::ng-deep a { font-weight: 600; text-decoration: underline; color: var(--accent); overflow-wrap: anywhere; }
    @media (prefers-reduced-motion: reduce) {
      .punto-vivo::after, .tema[data-e='pausada'] .reloj-num, .tema[data-e='en_curso'] .escenario::before, .detalle-tema[open] .detalle { animation: none; }
      .barra-t > span, .det-chevron { transition: none; }
    }

    .fin-temas { display: flex; flex-direction: column; align-items: center; gap: 0.625rem; padding: 0.875rem; border-radius: 1rem;
      border: 1px solid color-mix(in oklab, var(--color-green-500) 30%, transparent); background: color-mix(in oklab, var(--color-green-500) 6%, transparent);
      animation: aparece 220ms cubic-bezier(0.23, 1, 0.32, 1) both; }
    .fin-texto { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; font-weight: 700; color: var(--color-green-700); }
    :host-context(.dark) .fin-texto { color: var(--color-green-300); }
    @media (prefers-reduced-motion: reduce) { .fin-temas { animation: none; } }

    /* ── Mis notas ── */
    .mis { padding: 0.875rem 1rem 1rem; gap: 0.5rem; overflow: hidden; }
    .nota-anterior { border-top: 1px solid var(--color-slate-200); padding-top: 0.25rem; }
    :host-context(.dark) .nota-anterior { border-color: var(--color-slate-800); }

    /* ── Notas del acta ── */
    .acta { overflow: hidden; }
    .acta-cab { flex-shrink: 0; display: flex; flex-direction: column; gap: 0.625rem; padding: 0.875rem 1rem 0.75rem; border-bottom: 1px solid var(--color-slate-200); }
    :host-context(.dark) .acta-cab { border-color: var(--color-slate-800); }
    .acta-cuerpo { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; padding: 0.875rem 1rem 1rem; }

    @keyframes aparece { from { opacity: 0; transform: translateY(-4px); } }
    @media (prefers-reduced-motion: reduce) { .mini-reloj { animation: none; } .mini-reloj:active { transform: none; } }
  `],
})
export class ReunionEnVivoPage implements OnInit, OnDestroy {
  st = inject(ReunionVivoStore);
  private svc = inject(ReunionAncianosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);
  private sanitizer = inject(DomSanitizer);
  private store = inject(AuthStore);

  readonly reloj = reloj;
  readonly fechaCompleta = fechaCompleta;
  readonly wol = enlaceWol;
  readonly puedeActas = puedeEditarActas(this.store);

  vista = signal<Vista>('tiempo');
  /** El tema que se mira; null = el que se está tratando. */
  private vistaId = signal<number | null>(null);
  finalizarAbierto = signal(false);
  finalizando = signal(false);
  categorias = signal<CategoriaOut[]>([]);
  notas = signal<Map<number | null, string>>(new Map());
  opcionesResponsable = signal<PickerOption[]>([]);
  /** Ancho del contenido en rem: decide la distribución. */
  private anchoRem = signal(0);
  private observador: ResizeObserver | null = null;
  @ViewChild('raiz', { static: true }) raiz!: ElementRef<HTMLElement>;
  private wakeLock: { release: () => Promise<void> } | null = null;
  private cacheMd = new Map<string, SafeHtml>();

  constructor() {
    // La pantalla no se apaga mientras la reunión está en curso.
    effect(() => {
      const enCurso = this.st.datos()?.estado === 'en_curso';
      if (enCurso && !this.wakeLock) void this.pedirPantalla();
      if (!enCurso && this.wakeLock) { void this.wakeLock.release(); this.wakeLock = null; }
    });
  }

  async ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isInteger(id) || id <= 0) { this.irALista(); return; }
    this.medir();
    this.observador = new ResizeObserver(() => this.medir());
    this.observador.observe(this.raiz.nativeElement);
    await this.st.iniciar(id);
    const d = this.st.datos();
    if (!d) return;
    this.svc.categorias().subscribe({ next: c => this.categorias.set(c), error: () => undefined });
    if (d.puedo_preparar) {
      this.svc.misNotas(id).subscribe({ next: n => this.notas.set(new Map(n.map(x => [x.id_parte, x.texto]))), error: () => undefined });
    }
    if (d.puedo_colaborar) {
      // Los responsables de los pendientes se eligen entre los convocados.
      this.svc.get(id).subscribe({
        next: r => this.opcionesResponsable.set(r.convocados.map(c => ({ value: c.id_publicador, label: c.nombre }))),
        error: () => undefined,
      });
    }
  }

  ngOnDestroy() {
    this.observador?.disconnect();
    void this.wakeLock?.release();
  }

  private medir() {
    const el = this.raiz.nativeElement;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    this.anchoRem.set(el.clientWidth / rem);
  }

  @HostListener('document:visibilitychange')
  alVolver() {
    if (document.visibilityState === 'visible' && this.st.datos()?.estado === 'en_curso') void this.pedirPantalla();
  }

  /** Atajos para quien toma el tiempo: Espacio inicia o pausa; → pasa al siguiente. */
  @HostListener('document:keydown', ['$event'])
  atajos(e: KeyboardEvent) {
    const d = this.st.datos();
    const destino = e.target as HTMLElement;
    if (!d?.puedo_controlar || d.estado !== 'en_curso' || d.pausada_en || this.st.ocupado()) return;
    if (destino.closest('input, textarea, select, button, [contenteditable], [role="dialog"]')) return;
    const p = this.parteVista();
    if (!p) return;
    if (e.key === ' ') {
      e.preventDefault();
      void this.st.crono(p.estado_vivo === 'en_curso' ? 'pausar' : 'iniciar', p.id_parte);
    } else if (e.key === 'ArrowRight' && p.estado_vivo === 'en_curso') {
      e.preventDefault();
      void this.terminarTema(p);
    }
  }

  private async pedirPantalla() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } };
      this.wakeLock = (await nav.wakeLock?.request('screen')) ?? null;
    } catch { this.wakeLock = null; }
  }

  // ── Vistas ───────────────────────────────────────────────────────────────

  /** Programa, tema, notas personales y notas del acta: cuántas columnas caben. */
  modo = computed<Modo>(() => {
    const w = this.anchoRem(), d = this.st.datos();
    if (!w || !d) return 'angosto';
    if (d.puedo_colaborar) return w >= 64 ? 'acta' : 'angosto';
    if (w < 48) return 'angosto';
    return this.hayMis() && w >= 72 ? 'tres' : 'dos';
  });

  /** Las notas personales del tema que se ve (quien entra con su cuenta). */
  hayMis = computed(() => !!this.st.datos()?.puedo_preparar && !!this.parteVista());

  /** El tema comparte la columna con las notas personales: datos y reloj en una franja. */
  temaCompacto = computed(() => this.hayMis() && (this.modo() === 'acta' || this.modo() === 'dos'));

  /** El tema que se está tratando ahora (para el reloj pequeño del teléfono). */
  parteActual = computed<ParteVivo | null>(() => {
    const d = this.st.datos();
    if (d?.estado !== 'en_curso') return null;
    const p = d.partes.find(x => x.id_parte === d.id_parte_actual);
    return p && (p.estado_vivo === 'en_curso' || p.estado_vivo === 'pausada') ? p : null;
  });

  vistas = computed(() => {
    const d = this.st.datos();
    const lista: { id: Vista; texto: string; icono: string }[] = [{ id: 'tiempo', texto: 'Tiempo', icono: 'timer' }];
    if (d?.puedo_colaborar) lista.push({ id: 'acta', texto: 'Notas del acta', icono: 'file-text' });
    if (d?.puedo_preparar) lista.push({ id: 'mis', texto: 'Mis notas', icono: 'notebook-pen' });
    return lista;
  });

  parteVista = computed<ParteVivo | null>(() => {
    const d = this.st.datos();
    if (!d) return null;
    const id = this.vistaId() ?? d.id_parte_actual;
    return d.partes.find(p => p.id_parte === id) ?? d.partes[0] ?? null;
  });

  verParte(p: ParteVivo) {
    const d = this.st.datos();
    this.vistaId.set(p.id_parte === d?.id_parte_actual ? null : p.id_parte);
    if (this.vista() === 'mis') this.vista.set('tiempo');
  }

  // ── Cálculos ─────────────────────────────────────────────────────────────

  indice(p: ParteVivo): number { return (this.st.datos()?.partes.indexOf(p) ?? 0) + 1; }

  hayOtra(p: ParteVivo): boolean {
    return !!this.st.datos()?.partes.some(x => x.id_parte !== p.id_parte && !x.cancelada && (x.estado_vivo === 'pendiente' || x.estado_vivo === 'pausada'));
  }

  restante(p: ParteVivo): number { return (p.minutos || 0) * 60 - this.st.segundos(p); }

  semaforo(p: ParteVivo): Semaforo {
    if (!p.minutos) return 'sin_limite';
    const s = this.st.segundos(p), plan = p.minutos * 60;
    if (s > plan) return 'excedido';
    if (s >= plan * UMBRAL_AVISO) return 'por_terminar';
    return 'en_tiempo';
  }

  progreso(p: ParteVivo): number {
    if (!p.minutos) return 0;
    return Math.min(100, (this.st.segundos(p) / (p.minutos * 60)) * 100);
  }

  textoEstado(p: ParteVivo): string {
    if (p.cancelada) return 'Cancelado';
    return { pendiente: 'Pendiente', en_curso: 'En curso', pausada: 'En pausa', terminada: 'Terminado', no_tratada: 'No se trató' }[p.estado_vivo];
  }

  resumen = computed(() => {
    const d = this.st.datos();
    this.st.ahora();
    const partes = d?.partes ?? [];
    const activas = partes.filter(p => !p.cancelada);
    return {
      total: activas.length,
      hechos: activas.filter(p => p.estado_vivo === 'terminada').length,
      sinTratar: activas.filter(p => p.estado_vivo === 'pendiente' || p.estado_vivo === 'pausada').length,
      real: partes.reduce((s, p) => s + this.st.segundos(p), 0),
      plan: activas.reduce((s, p) => s + (p.minutos || 0), 0),
    };
  });

  /** Ahora + lo que falta: los minutos de los temas por tratar y lo que le queda al actual. */
  finEstimado = computed(() => {
    const d = this.st.datos();
    if (!d) return '—';
    if (d.finalizada_en) return this.horaDe(d.finalizada_en);
    let faltan = 0;
    for (const p of d.partes) {
      if (p.cancelada || p.estado_vivo === 'terminada' || p.estado_vivo === 'no_tratada') continue;
      faltan += Math.max(0, (p.minutos || 0) * 60 - this.st.segundos(p));
    }
    const base = d.estado === 'convocada' && d.hora ? null : this.st.ahora();
    if (base === null) {
      const [h, m] = d.hora!.split(':').map(Number);
      const fin = new Date();
      fin.setHours(h, m + Math.round(faltan / 60), 0, 0);
      return hora12(`${fin.getHours()}:${fin.getMinutes()}`);
    }
    const fin = new Date(base + faltan * 1000);
    return hora12(`${fin.getHours()}:${fin.getMinutes()}`);
  });

  textoConexion = computed(() => ({
    'conectando': 'Conectando…',
    'en-vivo': 'En vivo',
    'sondeo': 'Se actualiza cada 5 s',
    'sin-conexion': 'Sin conexión: reintentando',
  })[this.st.conexion()]);

  conAcuerdoResponsable(): number {
    return (this.st.datos()?.puntos ?? []).filter(p => p.tipo === 'acuerdo' && p.texto.trim() && p.id_publicador_responsable).length;
  }

  conteo(tipo: 'nota' | 'acuerdo'): number {
    return (this.st.datos()?.puntos ?? []).filter(p => p.tipo === tipo && p.texto.trim()).length;
  }

  /** En el panel del acta: el tema que se ve o las notas generales. */
  ambitoActa = signal<'tema' | 'general'>('tema');

  cuantos(ambito: 'tema' | 'general'): number {
    const id = ambito === 'tema' ? this.parteVista()?.id_parte ?? -1 : null;
    return (this.st.datos()?.puntos ?? []).filter(p => p.id_parte === id && p.texto.trim()).length;
  }

  hayGenerales = computed(() => (this.st.datos()?.puntos ?? []).some(p => p.id_parte === null));

  private catPorId = computed(() => new Map(this.categorias().map(c => [c.id_categoria, c])));
  categoria(p: ParteVivo): CategoriaOut | null { return p.id_categoria ? this.catPorId().get(p.id_categoria) ?? null : null; }

  horaDe(iso: string): string {
    const d = new Date(iso);
    return hora12(`${d.getHours()}:${d.getMinutes()}`);
  }

  esHoy(fecha: string): boolean {
    const h = new Date();
    return fecha === `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
  }

  md(texto: string): SafeHtml {
    let h = this.cacheMd.get(texto);
    if (!h) { h = this.sanitizer.bypassSecurityTrustHtml(markdownSimpleAHtml(texto)); this.cacheMd.set(texto, h); }
    return h;
  }

  notaPrivada(id: number | null): string { return this.notas().get(id) ?? ''; }

  notaGuardada(id: number | null, n: NotaPersonal | null) {
    this.notas.update(m => { const c = new Map(m); if (n) c.set(id, n.texto); else c.delete(id); return c; });
  }

  // ── Acciones ─────────────────────────────────────────────────────────────

  /** No queda ningún tema por tratar (los cancelados no cuentan). */
  todosTratados = computed(() => {
    const activas = (this.st.datos()?.partes ?? []).filter(p => !p.cancelada);
    return activas.length > 0 && activas.every(p => p.estado_vivo === 'terminada' || p.estado_vivo === 'no_tratada');
  });

  /** Termina el tema y pasa al siguiente; si era el último, abre el resumen para finalizar. */
  async terminarTema(p: ParteVivo) {
    const ultimo = !this.hayOtra(p);
    if (await this.st.crono('siguiente', p.id_parte) && ultimo) this.finalizarAbierto.set(true);
  }

  async empezar() {
    if (await this.st.empezar()) this.toast.success('La reunión empezó', 'Los convocados ya la pueden seguir en vivo.');
    else this.toast.error('No se pudo iniciar', 'Intente de nuevo en un momento.');
  }

  async finalizar() {
    const d = this.st.datos();
    if (!d) return;
    this.finalizando.set(true);
    try {
      const res = await firstValueFrom(this.svc.finalizar(d.id_reunion));
      this.finalizarAbierto.set(false);
      const partes: string[] = [];
      if (res.tareas_creadas) partes.push(`${res.tareas_creadas} ${res.tareas_creadas === 1 ? 'tarea creada' : 'tareas creadas'}`);
      if (res.acuerdos_sin_cuenta) partes.push(`${res.acuerdos_sin_cuenta} ${res.acuerdos_sin_cuenta === 1 ? 'acuerdo queda' : 'acuerdos quedan'} solo en el acta (su responsable no tiene cuenta o no tiene acceso a Mis tareas)`);
      if (res.id_acta && this.puedeActas) partes.push('El acta quedó en borrador, en Actas de reunión');
      this.toast.success('Reunión finalizada', partes.join(' · ') || undefined, 8000);
      this.irALista();
    } catch (e) {
      const err = e as HttpErrorResponse;
      this.toast.error('No se pudo finalizar', typeof err?.error?.detail === 'string' ? err.error.detail : 'Intente de nuevo.');
    } finally {
      this.finalizando.set(false);
    }
  }

  irALista() { this.router.navigate(['/administracion/reuniones-teocraticas']); }
}
