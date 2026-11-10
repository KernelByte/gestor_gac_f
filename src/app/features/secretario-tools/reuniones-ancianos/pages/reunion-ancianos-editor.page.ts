import { Component, computed, HostListener, inject, OnInit, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { ReunionAncianosService } from '../../services/reunion-ancianos.service';
import {
  CategoriaOut, ESTADO_REUNION_LABEL, GRUPO_PERSONA_LABEL, GrupoPersona, ParteIn, ParteOut, PersonaOpcion, ReunionOut, ReunionUpdate,
  TIPOS_REUNION, TipoReunion, tipoReunion,
} from '../../models/reunion-ancianos.model';
import { AuthStore } from '../../../../core/auth/auth.store';
import { puedeEditarActas, puedeGestionarReunionesAncianos } from '../../../../core/auth/acceso-modulos';
import { CongregacionContextService } from '../../../../core/congregacion-context/congregacion-context.service';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { TimePickerComponent } from '../../../../shared/components/time-picker/time-picker.component';
import { PickerOption, SelectPickerComponent } from '../../../../shared/components/select-picker/select-picker.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LucideAngularModule } from '../../../../shared/icons';
import { DocumentoReunion, ReunionDocumentoComponent } from '../components/reunion-documento.component';
import { ReunionPasosComponent } from '../components/reunion-pasos.component';
import { AQuienAsignarComponent, PedidoSugerencia } from '../components/a-quien-asignar.component';
import { AutosizeTextareaDirective } from '../../../../shared/directives/autosize-textarea.directive';
import { clasificarTitulo, diaYMes, hoyIso, minutosTexto } from '../reunion-ancianos-formato';

/** Una parte mientras se edita. `temas` va como texto, una línea por tema. */
interface ParteForm {
  uid: number;
  /** La parte ya guardada (para conservar quién la propuso); null si es nueva. */
  id_parte: number | null;
  titulo: string;
  id_responsable: number | null;
  /** Responsable escrito a mano, alguien que no es de la congregación. Solo vale sin id. */
  responsable_texto: string;
  minutos: number | null;
  objetivo: string;
  texto_biblico: string;
  referencias: string;
  temas: string;
  /** La categoría elegida a mano; si categoria_manual es false, se clasifica por el título. */
  id_categoria: number | null;
  categoria_manual: boolean;
  /** Indicación privada para el responsable (solo él y los gestores la ven). */
  nota_asignado: string;
  cancelada: boolean;
  /** Detalles desplegados (objetivo, texto bíblico, referencias, temas). */
  abierta: boolean;
  /** Campos menos usados desplegados (categoría, referencias, temas, cancelar). */
  masCampos: boolean;
}

type PasoSiguiente = 'convocar' | 'avisar' | 'vivo' | 'abrir-acta' | 'leer-acta' | 'acta';

interface FormReunion {
  tipo: TipoReunion;
  /** Título propio; vacío = el del tipo. */
  titulo: string;
  /** Publicadores convocados, de menor a mayor id (para comparar sin falsos cambios). */
  convocados: number[];
  fecha: string | null;
  hora: string | null;
  lugar: string;
  id_secretario: number | null;
  id_oracion_inicial: number | null;
  id_oracion_final: number | null;
  partes: ParteForm[];
  /** Asuntos breves sin responsable, uno por renglón. */
  otros_temas: string;
  /** Papeles en la reunión; null = el de siempre (coordinador / secretario). */
  id_tiempo: number | null;
  id_redactor: number | null;
  colaboradores: number[];
}

type Confirmacion = 'convocar' | 'acta' | 'eliminar' | 'salir' | 'quitar-parte' | 'descartar' | 'cambiar-tipo' | 'cancelar' | null;

/** Una persona en el selector de convocados (de /personas o ya convocada en la reunión). */
interface PersonaSel {
  id: number;
  nombre: string;
  grupo: GrupoPersona;
  tiene_usuario: boolean;
  tiene_app: boolean;
  /** Le llega el aviso (tiene cuenta o tiene la app). */
  recibe_aviso: boolean;
}

/** Compatibilidad: si el backend no manda recibe_aviso, se calcula. */
function recibeAviso(p: { tiene_usuario: boolean; tiene_app?: boolean; recibe_aviso?: boolean }): boolean {
  return p.recibe_aviso ?? (p.tiene_usuario || !!p.tiene_app);
}

const ORDEN_GRUPOS: GrupoPersona[] = ['anciano', 'siervo', 'precursor', 'otro'];
type VistaGrupo = 'todos' | 'elegidos' | GrupoPersona;

const MIN_MAX = 240;

/**
 * Una reunión de organización (`:id`, o `nueva`): del cuerpo de ancianos, del
 * Comité de Servicio, con los precursores, etc. El tipo da el título y a
 * quiénes se convoca; la lista de convocados se puede cambiar.
 *
 * La pantalla ocupa exactamente el alto disponible y no hace scroll de
 * página: lo largo (el programa, la vista previa) se desplaza dentro de su
 * propio panel.
 *
 * - Gestores (puedo_editar): datos en una franja, el programa con una parte
 *   por renglón. Todo el ancho es para armar la reunión; la vista previa del
 *   PDF se alterna con un control «Armar» / «Vista previa» en la cabecera, en
 *   cualquier ancho. Las acciones van en la cabecera; en el teléfono, en una
 *   barra abajo, al alcance del pulgar.
 * - Convocado: solo el documento, descargar el PDF y proponer puntos.
 *
 * Qué puede hacer cada quien lo dicen los puedo_* de la respuesta; aquí no
 * se recalculan las reglas.
 */
@Component({
  selector: 'app-reunion-ancianos-editor',
  standalone: true,
  imports: [
    NgTemplateOutlet, FormsModule, RouterLink, ModalComponent, ConfirmDialogComponent, DatePickerComponent, TimePickerComponent,
    SelectPickerComponent, EmptyStateComponent, LucideAngularModule, ReunionDocumentoComponent, ReunionPasosComponent,
    AutosizeTextareaDirective, AQuienAsignarComponent,
  ],
  template: `
  <div class="ed @container flex-1 min-h-[30rem] w-full flex flex-col gap-3">

    <!-- ══════ Cabecera: volver, título, estado y (desde tableta) las acciones ══════ -->
    <header class="shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2">
      <a routerLink="/administracion/reuniones-teocraticas" class="btn-icon shrink-0" aria-label="Volver a las reuniones" title="Volver a las reuniones">
        <lucide-icon name="arrow-left"></lucide-icon>
      </a>
      <div class="flex-1 min-w-[12rem]">
        <div class="flex items-center gap-x-3 min-w-0">
          <h1 class="page-title ed-titulo min-w-0 truncate" [title]="cargando() ? 'Reunión' : titulo()">
            {{ cargando() ? 'Reunión' : titulo() }}
          </h1>
        </div>
        <!-- Estrecho: los pasos van debajo del título; en ancho, en la misma fila que él (ver abajo) -->
        @if (reunion(); as r) { <div class="mt-1 @7xl:hidden"><app-reunion-pasos [estado]="r.estado" [conEnVivo]="usarEnVivo()" [puedeIniciar]="puedeIniciarEnVivo()" (iniciarEnVivo)="hacerSiguiente('vivo')" /></div> }
      </div>
      <!-- Los pasos miden su propio contenedor: sin un ancho fijo se encogen a cero y el texto se parte palabra por palabra -->
      @if (reunion(); as r) { <div class="hidden @7xl:block shrink-0 w-[28rem]"><app-reunion-pasos [estado]="r.estado" [conEnVivo]="usarEnVivo()" [puedeIniciar]="puedeIniciarEnVivo()" (iniciarEnVivo)="hacerSiguiente('vivo')" /></div> }
      @if (!cargando() && !errorCarga() && modoEdicion()) {
        <!-- Armar / Vista previa: se alternan en cualquier ancho -->
        <div class="segmented seg-movil w-full order-last" role="tablist" aria-label="Armar la reunión o ver cómo queda">
          <button type="button" role="tab" class="segmented-item flex-1" [attr.aria-selected]="pestana() === 'editar'" (click)="pestana.set('editar')">
            <lucide-icon name="edit-2" [size]="16" aria-hidden="true"></lucide-icon>Armar
          </button>
          <button type="button" role="tab" class="segmented-item flex-1" [attr.aria-selected]="pestana() === 'vista'" (click)="pestana.set('vista')">
            <lucide-icon name="eye" [size]="16" aria-hidden="true"></lucide-icon>Vista previa
          </button>
        </div>
      }
      @if (!cargando() && !errorCarga()) {
        <div class="hidden @3xl:flex items-center gap-2">
          @if (modoEdicion()) {
            <ng-container *ngTemplateOutlet="acciones" />
          } @else {
            <ng-container *ngTemplateOutlet="accionesLector" />
          }
        </div>
      }
    </header>

    @if (cargando()) {
      <div class="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)] gap-4 @6xl:grid-cols-[minmax(0,1fr)_minmax(0,0.75fr)]" aria-busy="true" aria-label="Cargando la reunión">
        <div class="flex flex-col gap-4 min-h-0">
          <div class="card p-5 grid grid-cols-2 @3xl:grid-cols-4 gap-4">
            @for (_ of [1, 2, 3, 4, 5, 6]; track $index) { <div class="skeleton h-11"></div> }
          </div>
          <div class="card p-5 flex-1 min-h-0 flex flex-col gap-3 overflow-hidden">
            @for (_ of [1, 2, 3, 4, 5]; track $index) { <div class="skeleton h-12"></div> }
          </div>
        </div>
        <div class="card p-8 hidden @6xl:flex flex-col gap-3 overflow-hidden">
          <div class="skeleton h-3 w-40"></div><div class="skeleton h-7 w-72"></div>
          <div class="skeleton h-16 mt-4"></div><div class="skeleton h-40"></div>
        </div>
      </div>
    } @else if (errorCarga()) {
      <div class="card flex-1 min-h-0 grid place-items-center">
        @if (errorCarga() === 'sin-congregacion') {
          <app-empty-state icon="calendar" accent="violet" title="Elija una congregación"
            description="Las reuniones son de cada congregación. Escójala en el selector del menú lateral y vuelva a crear la reunión."
            actionLabel="Volver a las reuniones" (action)="irALista()" />
        } @else if (errorCarga() === 'no-encontrada') {
          <app-empty-state icon="calendar-off" title="No encontramos esta reunión"
            description="Puede que la hayan borrado o que todavía no esté convocada."
            actionLabel="Volver a las reuniones" (action)="irALista()" />
        } @else {
          <app-empty-state variant="error" title="No se pudo abrir la reunión"
            description="Revise su conexión e intente de nuevo." actionLabel="Intentar de nuevo" (action)="cargar()" />
        }
      </div>
    } @else if (modoEdicion()) {

      <!-- ══════ Aviso de conflicto (409) ══════ -->
      @if (conflicto()) {
        <div role="alert" class="shrink-0 flex flex-col @2xl:flex-row @2xl:items-center gap-3 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
          <lucide-icon name="alert-triangle" [size]="20" class="shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true"></lucide-icon>
          <p class="flex-1 text-sm text-amber-900 dark:text-amber-200">
            <strong>Otra persona cambió esta reunión mientras usted la editaba.</strong>
            Sus cambios no se guardaron. Cargue la versión nueva y vuelva a hacer sus cambios.
          </p>
          <button type="button" class="btn-secondary focus-ring shrink-0" (click)="recargar()">
            <lucide-icon name="refresh-cw" [size]="16" aria-hidden="true"></lucide-icon>
            Cargar la versión nueva
          </button>
        </div>
      }

      <div class="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)] gap-4">

        <!-- ────── Formulario ────── -->
        <div class="panel-edicion lista-interna min-h-0 flex-col gap-3 @4xl:gap-4"
             [class.flex]="pestana() === 'editar'" [class.hidden]="pestana() !== 'editar'">

          <!-- Datos: una sola franja; en ancho, todo en dos renglones -->
          <section class="card datos shrink-0 p-3 @3xl:px-4 @3xl:py-3" aria-labelledby="titulo-datos">
            <h2 id="titulo-datos" class="sr-only">Datos de la reunión</h2>
            <div class="grid gap-x-3 gap-y-2.5 grid-cols-1 @sm:grid-cols-2 @3xl:grid-cols-[repeat(3,minmax(0,1fr))] @6xl:grid-cols-[repeat(4,minmax(0,1fr))]">
              <div class="@sm:col-span-2 @3xl:col-span-1">
                <span class="lbl">Tipo de reunión</span>
                <app-select-picker colorScheme="violet" ariaLabel="Tipo de reunión" placeholder="Elegir tipo"
                  [options]="opcionesTipo" [clearable]="false" [searchable]="false"
                  [ngModel]="form.tipo" (ngModelChange)="cambiarTipo($event)" />
              </div>
              <!-- El título solo se pide en «Otra reunión»; en los demás tipos lo da el tipo
                   (y se muestra si la reunión ya traía uno propio, para poder quitarlo). -->
              @if (mostrarTitulo()) {
              <div class="@sm:col-span-2 @3xl:col-span-1">
                <label class="lbl" for="ra-titulo-reunion">Título
                  @if (form.tipo === 'otra') { <span class="text-rose-600" aria-hidden="true">*</span> }
                  @else { <span class="font-normal text-slate-500 dark:text-slate-400">(opcional)</span> }
                </label>
                <!-- textarea que crece: el título del tipo (placeholder) nunca se corta -->
                <textarea id="ra-titulo-reunion" class="form-control titulo-reunion !py-2 !bg-white dark:!bg-slate-900" rows="1" maxlength="200"
                       [placeholder]="form.tipo === 'otra' ? 'Ej.: Limpieza del salón' : tipoActual().titulo"
                       [attr.aria-invalid]="faltaTitulo()" [attr.aria-required]="form.tipo === 'otra'"
                       (keydown.enter)="$event.preventDefault()"
                       [(ngModel)]="form.titulo" (ngModelChange)="tocar()"></textarea>
                @if (faltaTitulo()) { <p class="error-campo">Escriba el título de la reunión.</p> }
              </div>
              }
              <div>
                <span class="lbl" id="lbl-fecha">Fecha <span class="text-rose-600" aria-hidden="true">*</span></span>
                <app-date-picker colorScheme="violet" [fieldLike]="true" [(ngModel)]="form.fecha" (ngModelChange)="tocar()"
                  placeholder="Elegir fecha" aria-labelledby="lbl-fecha" />
                @if (intento() && !form.fecha) { <p class="error-campo">Elija la fecha.</p> }
              </div>
              <div>
                <span class="lbl">Hora</span>
                <app-time-picker colorScheme="violet" [(ngModel)]="form.hora" (ngModelChange)="tocar()" placeholder="Elegir hora" />
              </div>
              <div class="@sm:col-span-2 @3xl:col-span-1">
                <label class="lbl" for="ra-lugar">Lugar</label>
                <input id="ra-lugar" class="form-control !py-2 !bg-white dark:!bg-slate-900" maxlength="200" placeholder="Ej.: Salón del Reino"
                       [(ngModel)]="form.lugar" (ngModelChange)="tocar()" />
              </div>
              <div class="@sm:col-span-2 @3xl:col-span-1">
                <span class="lbl">Secretario</span>
                <app-select-picker colorScheme="violet" ariaLabel="Secretario de la reunión" placeholder="Elegir persona"
                  [options]="opciones()" [(ngModel)]="form.id_secretario" (ngModelChange)="tocar()" />
              </div>
              <div class="@sm:col-span-2 @3xl:col-span-1">
                <span class="lbl-fila"><span class="lbl">Oración inicial</span>
                  <button type="button" class="sugerir" (click)="sugerirOracion('inicial')"><lucide-icon name="lightbulb" [size]="13" aria-hidden="true"></lucide-icon>¿A quién?</button></span>
                <app-select-picker colorScheme="violet" ariaLabel="Oración inicial" placeholder="Elegir persona"
                  [options]="opciones()" [(ngModel)]="form.id_oracion_inicial" (ngModelChange)="tocar()" />
              </div>
              <div class="@sm:col-span-2 @3xl:col-span-1">
                <span class="lbl-fila"><span class="lbl">Oración final</span>
                  <button type="button" class="sugerir" (click)="sugerirOracion('final')"><lucide-icon name="lightbulb" [size]="13" aria-hidden="true"></lucide-icon>¿A quién?</button></span>
                <app-select-picker colorScheme="violet" ariaLabel="Oración final" placeholder="Elegir persona"
                  [options]="opciones()" [(ngModel)]="form.id_oracion_final" (ngModelChange)="tocar()" />
              </div>
              <!-- Convocados: resumen en una línea; la lista se cambia en una ventana -->
              <div [class]="mostrarTitulo() ? '@sm:col-span-2 @3xl:col-span-1' : '@sm:col-span-2 @3xl:col-span-2 @6xl:col-span-1'">
                <span class="lbl" id="lbl-convocados">Convocados</span>
                <div class="convocados" [attr.data-vacio]="form.convocados.length ? null : 'si'" aria-labelledby="lbl-convocados">
                  <p class="flex-1 min-w-0 leading-snug flex flex-wrap items-baseline gap-x-1.5" aria-live="polite">
                    @if (cargandoConvocados()) {
                      <span class="text-slate-500 dark:text-slate-400">Cargando…</span>
                    } @else if (form.convocados.length) {
                      <span class="font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">{{ resumenConvocados().texto }}</span>
                      @if (resumenConvocados().sinAviso) {
                        <span class="sin-cuenta" title="No tienen la app ni cuenta: no les llega el aviso">{{ resumenConvocados().sinAviso }} sin aviso</span>
                      }
                    } @else {
                      <span class="font-semibold text-amber-800 dark:text-amber-300">Nadie todavía</span>
                    }
                  </p>
                  <button type="button" class="btn-cambiar focus-ring" (click)="abrirConvocados()" [disabled]="cargandoConvocados()">
                    <lucide-icon name="users" [size]="15" aria-hidden="true"></lucide-icon>{{ form.convocados.length ? 'Cambiar' : 'Elegir' }}
                  </button>
                </div>
              </div>
              @if (usarEnVivo()) {
              <!-- Papeles durante la reunión: una línea de pie, sin caja -->
              <div class="@sm:col-span-2 @3xl:col-span-3 @6xl:col-span-4 pie-papeles">
                <span class="text-xs font-semibold text-slate-500 dark:text-slate-400" id="lbl-papeles">Durante la reunión</span>
                <p class="flex-1 min-w-0 text-sm leading-snug flex flex-wrap items-baseline gap-x-3 gap-y-0.5" aria-labelledby="lbl-papeles">
                  <span><span class="text-slate-500 dark:text-slate-400">Toma el tiempo:</span> <strong class="text-slate-900 dark:text-slate-100">{{ papelesResumen().tiempo }}</strong></span>
                  <span><span class="text-slate-500 dark:text-slate-400">Toma las notas:</span> <strong class="text-slate-900 dark:text-slate-100">{{ papelesResumen().notas }}</strong></span>
                  @if (form.colaboradores.length) {
                    <span class="text-slate-600 dark:text-slate-300">y {{ form.colaboradores.length === 1 ? '1 colabora' : form.colaboradores.length + ' colaboran' }}</span>
                  }
                </p>
                <button type="button" class="btn-link focus-ring shrink-0" (click)="abrirPapeles()">
                  <lucide-icon name="square-pen" [size]="14" aria-hidden="true"></lucide-icon>Cambiar
                </button>
              </div>
              }
            </div>
          </section>

          <!-- Puntos propuestos: franja compacta encima del programa -->
          @if (propuestas().length) {
            <section class="propuestas shrink-0" aria-labelledby="titulo-propuestas">
              <h2 id="titulo-propuestas" class="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-200">
                <lucide-icon name="lightbulb" [size]="16" aria-hidden="true"></lucide-icon>
                {{ propuestas().length === 1 ? 'Hay un punto propuesto' : propuestas().length + ' puntos propuestos' }}
                <span class="font-normal text-amber-800/80 dark:text-amber-200/70 hidden @3xl:inline">· si lo acepta, va al final del programa</span>
              </h2>
              <ul class="mt-2 flex flex-col gap-2">
                @for (p of propuestas(); track p.id_parte) {
                  <li class="propuesta">
                    <div class="flex-1 min-w-[12rem]">
                      <p class="font-semibold text-slate-900 dark:text-slate-100">{{ p.titulo }}</p>
                      <p class="text-xs text-slate-500 dark:text-slate-400">
                        {{ p.propuesto_por_nombre || 'Un hermano' }}{{ p.minutos ? ' · ' + p.minutos + ' min' : '' }}{{ p.objetivo ? ' · ' + p.objetivo : '' }}
                      </p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                      @if (p.puedo_descartar) {
                        <button type="button" class="btn-secondary focus-ring !py-1.5" [disabled]="procesandoParte() === p.id_parte" (click)="pedirDescartar(p)">Descartar</button>
                      }
                      <button type="button" class="btn-primary-violet focus-ring !py-1.5" [disabled]="procesandoParte() === p.id_parte" (click)="aceptar(p)">
                        <lucide-icon name="check" [size]="16" aria-hidden="true"></lucide-icon>Aceptar
                      </button>
                    </div>
                  </li>
                }
              </ul>
            </section>
          }

          <!-- Programa: ocupa el resto del alto; si hay muchas partes, solo esta lista se desplaza -->
          <section class="card programa @container flex-1 min-h-[14rem] flex flex-col overflow-hidden" aria-labelledby="titulo-partes">
            <div class="franja-programa shrink-0 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 @3xl:px-5 py-2.5">
              <h2 id="titulo-partes" class="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
                <lucide-icon name="file-text" [size]="17" class="text-brand-purple dark:text-violet-300" aria-hidden="true"></lucide-icon>
                Programa de la reunión
              </h2>
              <p class="flex items-center gap-1.5 tabular-nums" aria-live="polite">
                <span class="dato-prog">{{ form.partes.length }} {{ form.partes.length === 1 ? 'parte' : 'partes' }}</span>
                <span class="dato-prog dato-prog-min"><lucide-icon name="clock" [size]="13" aria-hidden="true"></lucide-icon>{{ minutosTexto(totalMinutos()) }}</span>
              </p>
            </div>

            <div class="lista-interna flex-1 min-h-0 overflow-y-auto px-2 @3xl:px-3 py-2">
              @if (!form.partes.length) {
                <!-- Sin partes: un solo recuadro que explica y deja añadir la primera -->
                <div class="vacio">
                  <div class="vacio-cab">
                    <span class="vacio-icono" aria-hidden="true"><lucide-icon name="file-text" [size]="22"></lucide-icon></span>
                    <div class="min-w-0">
                      <h3 class="card-title">Arme el programa</h3>
                      <p class="text-sm text-slate-600 dark:text-slate-300 mt-0.5">Toque el tipo de parte que va a añadir. Después elija al responsable y los minutos.</p>
                    </div>
                  </div>
                  <div class="losetas" role="group" aria-label="Añadir la primera parte">
                    @for (c of rapidas(); track c.id_categoria) {
                      <button type="button" class="loseta cat-color focus-ring" [attr.data-color]="c.color" (click)="anadirParte(c)">
                        <lucide-icon [name]="c.icono" [size]="18" aria-hidden="true"></lucide-icon>{{ tituloDe(c) }}
                      </button>
                    }
                    <button type="button" class="loseta loseta-neutra focus-ring" (click)="anadirParte()">
                      <lucide-icon name="plus" [size]="18" aria-hidden="true"></lucide-icon>Otro tema
                    </button>
                  </div>
                </div>
              }

              <ol class="flex flex-col gap-1.5">
                @for (p of form.partes; track p.uid; let i = $index; let primera = $first; let ultima = $last) {
                  <li class="parte" [class.abierta]="p.abierta" [class.parte-cancelada]="p.cancelada" [class.parte-error]="intento() && !p.titulo.trim()">
                    <div class="parte-fila">
                      <span class="numero" aria-hidden="true">{{ i + 1 }}</span>

                      <div class="c-titulo min-w-0">
                        <label class="sr-only" [for]="'ra-titulo-' + p.uid">Título de la parte {{ i + 1 }}</label>
                        <textarea [id]="'ra-titulo-' + p.uid" class="titulo-input" rows="1" maxlength="300"
                                  placeholder="Nombre del tema"
                                  [attr.aria-invalid]="intento() && !p.titulo.trim()"
                                  (keydown.enter)="$event.preventDefault()"
                                  [(ngModel)]="p.titulo" (ngModelChange)="tocar()"></textarea>
                        @if (intento() && !p.titulo.trim()) { <p class="error-campo">Escriba el título.</p> }
                        <div class="meta-parte">
                          @if (!p.abierta && categoriaDe(p); as c) {
                            <span class="cat-chip" [attr.data-color]="c.color"
                                  [title]="p.categoria_manual ? 'Categoría elegida a mano' : 'Categoría automática, según el título'">
                              <lucide-icon [name]="c.icono"></lucide-icon>{{ c.etiqueta }}
                              @if (!p.categoria_manual) { <span class="sr-only"> (automática)</span> }
                            </span>
                          }
                          @if (p.cancelada) { <span class="badge-inactive">Cancelado</span> }
                          @if (p.nota_asignado.trim()) {
                            <span class="badge-neutral" title="Tiene una indicación privada para el responsable">
                              <lucide-icon name="lock" [size]="12" aria-hidden="true"></lucide-icon>Indicación
                            </span>
                          }
                        </div>
                      </div>

                      <div class="c-resp min-w-0 flex items-start gap-1.5">
                        <div class="flex-1 min-w-0">
                        <app-select-picker colorScheme="violet" placeholder="Elegir responsable"
                          [ariaLabel]="'Responsable de la parte ' + (i + 1)"
                          [allowCustom]="true"
                          [options]="opcionesResponsable(p)" [ngModel]="valorResponsable(p)"
                          (ngModelChange)="cambiarResponsable(p, $event)"
                          (custom)="responsableEscrito(p, $event)" />
                        </div>
                        <button type="button" class="icono-btn shrink-0 mt-1" (click)="sugerirParte(p, i)"
                                [attr.aria-label]="'¿A quién asignar la parte ' + (i + 1) + '?'" title="¿A quién asignar?">
                          <lucide-icon name="lightbulb" [size]="17" aria-hidden="true"></lucide-icon>
                        </button>
                      </div>

                      <div class="c-min stepper" role="group" [attr.aria-label]="'Minutos de la parte ' + (i + 1)">
                        <button type="button" class="stepper-btn" (click)="sumarMinutos(p, -5)" [disabled]="!p.minutos" aria-label="Quitar 5 minutos">
                          <lucide-icon name="minus" [size]="15" aria-hidden="true"></lucide-icon>
                        </button>
                        <input type="number" inputmode="numeric" min="0" max="240" class="stepper-input"
                               aria-label="Minutos" placeholder="min"
                               [ngModel]="p.minutos" (ngModelChange)="fijarMinutos(p, $event)" />
                        <button type="button" class="stepper-btn" (click)="sumarMinutos(p, 5)" [disabled]="(p.minutos || 0) >= 240" aria-label="Añadir 5 minutos">
                          <lucide-icon name="plus" [size]="15" aria-hidden="true"></lucide-icon>
                        </button>
                      </div>

                      <div class="c-acc flex items-center">
                        <button type="button" class="icono-btn" [class.activo]="p.abierta" (click)="p.abierta = !p.abierta"
                                [attr.aria-expanded]="p.abierta" [attr.aria-controls]="'ra-detalles-' + p.uid"
                                [attr.aria-label]="(p.abierta ? 'Ocultar' : 'Ver') + ' más detalles de la parte ' + (i + 1)"
                                title="Más detalles">
                          <lucide-icon name="file-text" [size]="17" aria-hidden="true"></lucide-icon>
                          @if (detallesLlenos(p)) { <span class="badge-det">{{ detallesLlenos(p) }}</span> }
                        </button>
                        <button type="button" class="icono-btn" [id]="'ra-subir-' + p.uid" [disabled]="primera" (click)="mover(i, -1)"
                                [attr.aria-label]="'Subir la parte ' + (i + 1)" title="Subir">
                          <lucide-icon name="arrow-up" [size]="17" aria-hidden="true"></lucide-icon>
                        </button>
                        <button type="button" class="icono-btn" [id]="'ra-bajar-' + p.uid" [disabled]="ultima" (click)="mover(i, 1)"
                                [attr.aria-label]="'Bajar la parte ' + (i + 1)" title="Bajar">
                          <lucide-icon name="arrow-down" [size]="17" aria-hidden="true"></lucide-icon>
                        </button>
                        <button type="button" class="icono-btn icono-btn-peligro" (click)="pedirQuitar(i)"
                                [attr.aria-label]="'Quitar la parte ' + (i + 1)" title="Quitar">
                          <lucide-icon name="trash-2" [size]="17" aria-hidden="true"></lucide-icon>
                        </button>
                      </div>
                    </div>

                    @if (p.abierta) {
                      <div [id]="'ra-detalles-' + p.uid" class="detalles">
                        <div class="det-ancho">
                          <label class="lbl" [for]="'ra-obj-' + p.uid">Objetivo</label>
                          <textarea [id]="'ra-obj-' + p.uid" appAutosize [minRows]="1" [maxRows]="4" class="form-control !py-2" maxlength="4000"
                                    placeholder="Qué se quiere lograr"
                                    [(ngModel)]="p.objetivo" (ngModelChange)="tocar()"></textarea>
                        </div>
                        <div>
                          <label class="lbl" [for]="'ra-tb-' + p.uid">Texto bíblico</label>
                          <input [id]="'ra-tb-' + p.uid" class="form-control !py-2" placeholder="Ej.: 1 Timoteo 3:1-13"
                                 [(ngModel)]="p.texto_biblico" (ngModelChange)="tocar()" />
                        </div>
                        <div class="nota-asignado">
                          <label class="lbl flex items-center gap-1.5" [for]="'ra-nota-' + p.uid">
                            <lucide-icon name="lock" [size]="13" aria-hidden="true"></lucide-icon>Indicación para el responsable
                            <span class="font-normal text-slate-500 dark:text-slate-400">(opcional)</span>
                          </label>
                          <textarea [id]="'ra-nota-' + p.uid" appAutosize [minRows]="3" [maxRows]="8" class="form-control !py-2" maxlength="4000"
                                    placeholder="Cómo enfocarla, qué destacar o evitar"
                                    [(ngModel)]="p.nota_asignado" (ngModelChange)="tocar()"></textarea>
                          <p class="caption mt-1">Solo la ve el responsable, en su preparación, y le llega con el aviso. No sale en el programa, el PDF ni el acta.</p>
                        </div>
                        @if (!p.masCampos) {
                          <div class="det-ancho">
                            <button type="button" class="btn-link focus-ring" (click)="p.masCampos = true">
                              <lucide-icon name="plus" [size]="14" aria-hidden="true"></lucide-icon>Más campos: categoría, referencias, temas
                            </button>
                          </div>
                        } @else {
                        <div class="det-cat">
                          <span class="lbl" [id]="'ra-cat-lbl-' + p.uid">Categoría</span>
                          <div class="flex flex-wrap gap-1.5" role="radiogroup" [attr.aria-labelledby]="'ra-cat-lbl-' + p.uid">
                            @for (c of categoriasParaElegir(p); track c.id_categoria) {
                              <button type="button" role="radio" class="cat-chip cat-opcion focus-ring" [attr.data-color]="c.color"
                                      [attr.aria-checked]="categoriaDe(p)?.id_categoria === c.id_categoria" (click)="cambiarCategoria(p, c.id_categoria)">
                                <lucide-icon [name]="categoriaDe(p)?.id_categoria === c.id_categoria ? 'check' : c.icono"></lucide-icon>{{ c.etiqueta }}{{ c.activa ? '' : ' (archivada)' }}
                              </button>
                            }
                          </div>
                          <p class="caption mt-1.5">
                            @if (p.categoria_manual) {
                              Elegida a mano. <button type="button" class="btn-link" (click)="cambiarCategoria(p, 'auto')">Volver a automática</button>
                            } @else {
                              Se elige sola según el título. Toque otra para cambiarla.
                            }
                          </p>
                        </div>
                        <div>
                          <label class="lbl" [for]="'ra-ref-' + p.uid">Referencias</label>
                          <textarea [id]="'ra-ref-' + p.uid" appAutosize [minRows]="1" [maxRows]="5" class="form-control !py-2"
                                    placeholder="Publicaciones o cartas a usar"
                                    [(ngModel)]="p.referencias" (ngModelChange)="tocar()"></textarea>
                        </div>
                        <div>
                          <label class="lbl" [for]="'ra-temas-' + p.uid">Temas <span class="font-normal text-slate-500 dark:text-slate-400">(uno por renglón)</span></label>
                          <textarea [id]="'ra-temas-' + p.uid" appAutosize [minRows]="3" [maxRows]="8" class="form-control !py-2"
                                    placeholder="Un tema por renglón"
                                    [(ngModel)]="p.temas" (ngModelChange)="tocar()"></textarea>
                        </div>
                        <div class="det-ancho det-cancelar">
                          <button type="button" role="switch" class="switch" [attr.aria-checked]="p.cancelada" [attr.aria-labelledby]="'ra-canc-' + p.uid"
                                  (click)="p.cancelada = !p.cancelada; tocar()"><span class="toggle-thumb"></span></button>
                          <span [id]="'ra-canc-' + p.uid" class="text-sm text-slate-700 dark:text-slate-300 leading-snug">
                            <strong>Tema cancelado</strong>
                            <span class="caption"> · No se tratará: sale tachado y no suma minutos.</span>
                          </span>
                        </div>
                        }
                      </div>
                    }
                  </li>
                }
              </ol>

              @if (form.partes.length) {
                <div class="mt-2">
                  <button type="button" class="anadir focus-ring" (click)="anadirParte()">
                    <lucide-icon name="plus" [size]="18" aria-hidden="true"></lucide-icon>Añadir parte
                  </button>
                  @if (rapidas().length) {
                    <div class="rapidas" role="group" aria-label="Añadir una parte de un tipo conocido">
                      <span class="caption">O añada:</span>
                      @for (c of rapidas(); track c.id_categoria) {
                        <button type="button" class="cat-chip cat-btn focus-ring" [attr.data-color]="c.color" (click)="anadirParte(c)">
                          <lucide-icon name="plus" [size]="12" aria-hidden="true"></lucide-icon>{{ tituloDe(c) }}
                        </button>
                      }
                    </div>
                  }
                </div>
              }

              <div class="otros mt-3 px-1">
                @if (form.otros_temas.trim() || otrosAbierto()) {
                  <div class="flex items-baseline justify-between gap-3">
                    <label class="lbl" for="ra-otros">Otros temas <span class="font-normal text-slate-500 dark:text-slate-400">· uno por renglón, sin responsable</span></label>
                    @if (!form.otros_temas.trim()) {
                      <button type="button" class="btn-link focus-ring" (click)="otrosAbierto.set(false)">Cancelar</button>
                    }
                  </div>
                  <textarea id="ra-otros" appAutosize [minRows]="2" [maxRows]="8" class="form-control !py-2" maxlength="6000"
                            placeholder="Ej.: Limpieza del salón el sábado"
                            (keydown.escape)="form.otros_temas.trim() || otrosAbierto.set(false)"
                            [(ngModel)]="form.otros_temas" (ngModelChange)="tocar()"></textarea>
                } @else {
                  <button type="button" class="btn-link focus-ring" (click)="abrirOtros()">
                    <lucide-icon name="plus" [size]="14" aria-hidden="true"></lucide-icon>Añadir otros temas
                  </button>
                }
              </div>
            </div>
          </section>
        </div>

        <!-- ────── Vista previa en vivo ────── -->
        <div class="min-h-0 flex-col w-full max-w-7xl mx-auto pt-3" [class.flex]="pestana() === 'vista'" [class.hidden]="pestana() !== 'vista'">
          <p class="eyebrow mb-3 shrink-0">Vista previa · así saldrá el PDF</p>
          <div class="lista-interna flex-1 min-h-0 overflow-y-auto rounded-2xl">
            <app-reunion-documento [doc]="documentoForm()" />
          </div>
        </div>
      </div>

      <!-- Teléfono: acciones al alcance del pulgar -->
      <div class="barra shrink-0 @3xl:hidden">
        <ng-container *ngTemplateOutlet="acciones" />
      </div>

    } @else if (reunion(); as r) {

      <!-- ══════ Vista del convocado (solo lectura) ══════ -->
      <div class="flex-1 min-h-0 grid grid-rows-[minmax(0,1fr)] gap-4 @5xl:grid-cols-[minmax(0,1fr)_20rem] @7xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div class="lista-interna min-h-0 overflow-y-auto rounded-2xl">
          <app-reunion-documento [doc]="documentoGuardado()" />
        </div>

        <aside class="hidden @5xl:flex flex-col gap-4 min-h-0">
          @if (r.puedo_proponer) {
            <div class="card dark:!bg-slate-900 p-5 flex flex-col gap-3 shrink-0">
              <p class="text-sm text-slate-600 dark:text-slate-300">¿Quiere tratar algún asunto? Propóngalo y el coordinador decidirá si lo añade al programa.</p>
              <button type="button" class="btn-primary-violet justify-center focus-ring !py-2.5" (click)="abrirProponer()">
                <lucide-icon name="lightbulb" [size]="18" aria-hidden="true"></lucide-icon>
                Proponer un punto
              </button>
            </div>
          }
          @if (propuestas().length) {
            <ng-container *ngTemplateOutlet="misPropuestas" />
          }
        </aside>
      </div>

      <!-- Teléfono: propuestas propias y acciones abajo -->
      <div class="@5xl:hidden shrink-0 flex flex-col gap-2">
        @if (propuestas().length) {
          <p class="text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <lucide-icon name="lightbulb" [size]="16" aria-hidden="true"></lucide-icon>
            {{ propuestas().length === 1 ? 'Tiene una propuesta esperando respuesta.' : 'Tiene ' + propuestas().length + ' propuestas esperando respuesta.' }}
          </p>
        }
        <div class="barra @3xl:hidden"><ng-container *ngTemplateOutlet="accionesLector" /></div>
      </div>
    }
  </div>

  <!-- ══════ Acciones del gestor (cabecera en escritorio, barra en el teléfono) ══════ -->
  <ng-template #acciones>
    <div class="acciones">
      @if (!esNueva()) {
        <div class="menu-wrap" (focusout)="cerrarMenuSiSale($event)" (keydown.escape)="menuAbierto.set(false)">
          <button type="button" class="btn-icon" aria-label="Más acciones" title="Más acciones" aria-haspopup="menu"
                  [attr.aria-expanded]="menuAbierto()" (click)="menuAbierto.set(!menuAbierto())">
            <lucide-icon name="more-vertical"></lucide-icon>
          </button>
          @if (menuAbierto()) {
            <div class="menu" role="menu" aria-label="Más acciones">
              @if (reunion()?.estado === 'convocada' && !sinAvisar()) {
                <button type="button" role="menuitem" class="menu-item" (click)="accionMenu('avisar')">
                  <lucide-icon name="send" [size]="16" aria-hidden="true"></lucide-icon>Avisar de los cambios
                </button>
              }
              @if (reunion()?.puedo_pasar_a_acta && !reunion()?.id_acta && siguientePaso()?.clave !== 'acta') {
                <button type="button" role="menuitem" class="menu-item" (click)="accionMenu('acta')">
                  <lucide-icon name="book-open" [size]="16" aria-hidden="true"></lucide-icon>Generar el acta
                </button>
              }
              <button type="button" role="menuitem" class="menu-item" (click)="accionMenu('preparar')">
                <lucide-icon name="notebook-pen" [size]="16" aria-hidden="true"></lucide-icon>Mi preparación y mis notas
              </button>
              <button type="button" role="menuitem" class="menu-item" (click)="accionMenu('duplicar')">
                <lucide-icon name="copy" [size]="16" aria-hidden="true"></lucide-icon>Duplicar como plantilla
              </button>
              @if (reunion()?.estado === 'cancelada') {
                <button type="button" role="menuitem" class="menu-item" (click)="accionMenu('reabrir')">
                  <lucide-icon name="rotate-ccw" [size]="16" aria-hidden="true"></lucide-icon>Reabrir la reunión
                </button>
              } @else if (reunion()?.estado !== 'realizada') {
                <button type="button" role="menuitem" class="menu-item" (click)="accionMenu('cancelar')">
                  <lucide-icon name="ban" [size]="16" aria-hidden="true"></lucide-icon>Cancelar la reunión
                </button>
              }
              <div class="menu-sep" role="separator"></div>
              <button type="button" role="menuitem" class="menu-item menu-peligro" (click)="accionMenu('eliminar')">
                <lucide-icon name="trash-2" [size]="16" aria-hidden="true"></lucide-icon>Eliminar
              </button>
            </div>
          }
        </div>
        <button type="button" class="btn-icon" [disabled]="descargando()" (click)="descargarPdf()" aria-label="Descargar el programa en PDF" title="Descargar PDF">
          @if (descargando()) { <span class="spinner spinner-xs" aria-hidden="true"></span> } @else { <lucide-icon name="download"></lucide-icon> }
        </button>
        @if (puedeIniciarEnVivo()) {
          <button type="button" class="btn-primary-violet est-reunion est-boton focus-ring acc-ancho" data-estado="en_curso" [disabled]="ocupado()" (click)="hacerSiguiente('vivo')"
                  title="Abre la reunión en vivo: reloj, temas y notas. Allí se toca «Iniciar la reunión»">
            <lucide-icon name="play" [size]="16" aria-hidden="true"></lucide-icon>Iniciar en vivo
          </button>
        }
        @if (siguientePaso(); as sp) {
          <button type="button" class="focus-ring acc-ancho" [class]="sucio() ? 'btn-secondary' : sp.clave === 'vivo' ? 'btn-primary-violet est-reunion est-boton' : 'btn-primary-violet'"
                  [attr.data-estado]="!sucio() && sp.clave === 'vivo' ? 'en_curso' : null"
                  [disabled]="ocupado() || leyendoActa()" (click)="hacerSiguiente(sp.clave)">
            <lucide-icon [name]="sp.icono" [size]="16" aria-hidden="true"></lucide-icon>{{ sp.texto }}
          </button>
        }
      }
      <button type="button" class="btn-save focus-ring acc-ancho" [disabled]="!sucio() || ocupado()" (click)="guardar()"
              [attr.aria-keyshortcuts]="atajo === '⌘' ? 'Meta+S' : 'Control+S'" [title]="'Guardar (' + atajo + '+S)'">
        <lucide-icon name="save" [size]="16" aria-hidden="true"></lucide-icon>
        {{ esNueva() ? 'Crear reunión' : 'Guardar' }}
      </button>
    </div>
  </ng-template>

  <!-- Acciones del convocado -->
  <ng-template #accionesLector>
    <div class="acciones">
      <button type="button" class="btn-secondary focus-ring acc-ancho" [disabled]="descargando()" (click)="descargarPdf()">
        @if (descargando()) { <span class="spinner spinner-xs" aria-hidden="true"></span> } @else { <lucide-icon name="download" [size]="16" aria-hidden="true"></lucide-icon> }Descargar PDF
      </button>
      @if (reunion()?.puedo_leer_acta) {
        <button type="button" class="btn-secondary focus-ring acc-ancho" [disabled]="leyendoActa()" (click)="leerActa()">
          @if (leyendoActa()) { <span class="spinner spinner-xs" aria-hidden="true"></span> } @else { <lucide-icon name="book-open" [size]="16" aria-hidden="true"></lucide-icon> }Leer el acta
        </button>
      }
      @if (reunion()?.puedo_proponer) {
        <button type="button" class="btn-primary-violet focus-ring acc-ancho @5xl:hidden" (click)="abrirProponer()">
          <lucide-icon name="lightbulb" [size]="16" aria-hidden="true"></lucide-icon>Proponer un punto
        </button>
      }
    </div>
  </ng-template>

  <ng-template #misPropuestas>
    <section class="card p-5 flex-1 min-h-0 flex flex-col" aria-labelledby="titulo-mis-propuestas">
      <h2 id="titulo-mis-propuestas" class="eyebrow shrink-0">Mis propuestas</h2>
      <ul class="lista-interna mt-3 flex-1 min-h-0 overflow-y-auto flex flex-col divide-y divide-slate-100 dark:divide-slate-700/60">
        @for (p of propuestas(); track p.id_parte) {
          <li class="py-3 first:pt-0 last:pb-0">
            <p class="font-semibold text-slate-900 dark:text-slate-100">{{ p.titulo }}</p>
            <p class="text-sm text-amber-700 dark:text-amber-300 mt-0.5">Esperando respuesta del coordinador</p>
            @if (p.puedo_descartar) {
              <button type="button" class="mt-2 text-sm font-semibold text-rose-700 dark:text-rose-400 hover:underline focus-ring rounded"
                      [disabled]="procesandoParte() === p.id_parte" (click)="pedirDescartar(p)">Retirar propuesta</button>
            }
          </li>
        }
      </ul>
    </section>
  </ng-template>

  <!-- ══════ Proponer un punto ══════ -->
  <app-modal [open]="proponerAbierto()" (closed)="proponerAbierto.set(false)" title="Proponer un punto"
             subtitle="El coordinador y el secretario recibirán su propuesta." [hasFooter]="true">
    <div class="flex flex-col gap-5">
      <div>
        <label class="lbl" for="prop-titulo">¿Qué tema quiere tratar? <span class="text-rose-600" aria-hidden="true">*</span></label>
        <input id="prop-titulo" class="form-control" maxlength="300" placeholder="Ej.: Arreglos para la Conmemoración"
               [(ngModel)]="propuesta.titulo" (keydown.enter)="enviarPropuesta()" />
      </div>
      <div>
        <label class="lbl" for="prop-porque">¿Por qué? <span class="font-normal text-slate-500">(opcional)</span></label>
        <textarea id="prop-porque" class="form-control" rows="3" placeholder="Explique en pocas palabras por qué conviene hablarlo"
                  [(ngModel)]="propuesta.objetivo"></textarea>
      </div>
      <div>
        <label class="lbl" for="prop-min">¿Cuántos minutos necesita? <span class="font-normal text-slate-500">(opcional)</span></label>
        <input id="prop-min" type="number" inputmode="numeric" min="0" max="240" class="form-control max-w-[10rem]" placeholder="Ej.: 10"
               [(ngModel)]="propuesta.minutos" />
      </div>
    </div>
    <div slot="footer" class="flex gap-3">
      <button type="button" class="btn-secondary focus-ring" (click)="proponerAbierto.set(false)">Cancelar</button>
      <button type="button" class="btn-save focus-ring" [disabled]="!propuesta.titulo.trim() || enviandoPropuesta()" (click)="enviarPropuesta()">
        @if (enviandoPropuesta()) { <span class="spinner spinner-xs" aria-hidden="true"></span> } @else { <lucide-icon name="send" [size]="16" aria-hidden="true"></lucide-icon> }
        Enviar propuesta
      </button>
    </div>
  </app-modal>

  <!-- ══════ Elegir convocados ══════ -->
  <app-modal [open]="convocadosAbierto()" (closed)="convocadosAbierto.set(false)" title="¿A quién se convoca?" size="3xl"
             subtitle="Reciben el aviso y pueden ver el programa. La campana tachada marca a quien no le llega el aviso."
             [hasFooter]="true" [padding]="false">
    <div class="@container">
    <div class="sel">
      <!-- Grupos: en ancho, columna lateral; en angosto, fila de pestañas que se desliza -->
      <nav class="sel-grupos" aria-label="Grupos">
        @for (g of resumenGrupos(); track g.id) {
          <button type="button" class="sel-g" [attr.aria-current]="grupoVista() === g.id ? 'true' : null" (click)="grupoVista.set(g.id)">
            <span class="sel-g-txt">{{ g.etiqueta }}</span>
            <span class="sel-g-n tabular-nums" [attr.data-hay]="g.elegidos || g.total ? null : 'no'">{{ g.id === 'elegidos' ? g.total : g.elegidos + '/' + g.total }}</span>
          </button>
        }
      </nav>

      <div class="sel-main">
        <div class="sel-barra">
          <div class="buscador sel-buscador">
            <lucide-icon name="search" [size]="17" class="buscador-lupa" aria-hidden="true"></lucide-icon>
            <input #qc id="conv-buscar" type="search" autocomplete="off" spellcheck="false" placeholder="Buscar por nombre"
                   aria-label="Buscar por nombre" [value]="busquedaConv()" (input)="busquedaConv.set(qc.value)"
                   (keydown.escape)="$event.stopPropagation(); busquedaConv.set(''); qc.value = ''" />
          </div>
          @if (visiblesSel().length && grupoVista() !== 'elegidos') {
            <button type="button" class="sel-todos focus-ring" (click)="marcarGrupo(visiblesSel(), !todosVisiblesElegidos())">
              <span class="sel-tri" [attr.data-estado]="estadoVisibles()" aria-hidden="true">
                @if (estadoVisibles() === 'todos') { <lucide-icon name="check" [size]="13"></lucide-icon> }
                @else if (estadoVisibles() === 'algunos') { <lucide-icon name="minus" [size]="13"></lucide-icon> }
              </span>
              {{ todosVisiblesElegidos() ? 'Quitar' : 'Elegir' }} {{ textoVisibles() }}
            </button>
          }
        </div>

        <div class="sel-lista-wrap lista-interna">
          @for (g of gruposSel(); track g.grupo) {
            <section [attr.aria-labelledby]="'sel-g-' + g.grupo">
              @if (gruposSel().length > 1) {
                <div class="sel-subt">
                  <h3 [id]="'sel-g-' + g.grupo" class="sel-subt-t">{{ g.etiqueta }}<span class="sel-subt-n tabular-nums">{{ elegidosEn(g.personas) }} de {{ g.personas.length }}</span></h3>
                  <button type="button" class="sel-subt-accion focus-ring" (click)="marcarGrupo(g.personas, elegidosEn(g.personas) < g.personas.length)"
                          [attr.aria-label]="(elegidosEn(g.personas) < g.personas.length ? 'Elegir a todos en ' : 'Quitar a todos en ') + g.etiqueta">
                    {{ elegidosEn(g.personas) < g.personas.length ? 'Elegir todos' : 'Quitar todos' }}
                  </button>
                </div>
              }
              <ul class="sel-lista">
                @for (a of g.personas; track a.id) {
                  <li>
                    <label class="sel-persona" [attr.data-on]="seleccion().has(a.id) ? 'si' : null">
                      <input type="checkbox" class="sr-only" [checked]="seleccion().has(a.id)" (change)="alternar(a.id)" />
                      <span class="sel-caja" aria-hidden="true"><lucide-icon name="check" [size]="14"></lucide-icon></span>
                      <span class="sel-nombre">{{ a.nombre }}</span>
                      @if (!a.recibe_aviso) {
                        <span class="sel-sin" title="No tiene la app ni cuenta: no le llega el aviso">
                          <lucide-icon name="bell-off" [size]="14" aria-hidden="true"></lucide-icon><span class="sr-only">No tiene la app ni cuenta: no le llega el aviso</span>
                        </span>
                      }
                    </label>
                  </li>
                }
              </ul>
            </section>
          } @empty {
            <div class="h-full grid place-items-center p-8 text-center">
              <p class="text-slate-500 dark:text-slate-400">
                @if (busquedaConv().trim()) { Nadie se llama «{{ busquedaConv().trim() }}». Pruebe con otra palabra. }
                @else if (grupoVista() === 'elegidos') { Todavía no ha elegido a nadie. }
                @else { No hay personas en este grupo. }
              </p>
            </div>
          }
        </div>
      </div>
    </div>
    </div>

    <div slot="footer" class="sel-pie">
      <p class="sel-resumen" aria-live="polite">
        <strong class="text-slate-900 dark:text-slate-100 tabular-nums">{{ seleccion().size }}</strong>
        {{ seleccion().size === 1 ? 'elegida' : 'elegidas' }}
        @if (sinAvisoSeleccion()) {
          <span class="sel-resumen-sin"><lucide-icon name="bell-off" [size]="13" aria-hidden="true"></lucide-icon>{{ sinAvisoSeleccion() }} sin aviso</span>
        }
      </p>
      <div class="flex gap-2 shrink-0">
        <button type="button" class="btn-secondary focus-ring" (click)="convocadosAbierto.set(false)">Cancelar</button>
        <button type="button" class="btn-save focus-ring" (click)="aplicarConvocados()">
          <lucide-icon name="check" [size]="16" aria-hidden="true"></lucide-icon>Listo
        </button>
      </div>
    </div>
  </app-modal>

  <!-- ══════ Papeles durante la reunión ══════ -->
  <app-modal [open]="papelesAbierto()" (closed)="papelesAbierto.set(false)" title="Papeles durante la reunión" size="lg" [hasFooter]="true"
             subtitle="Elija quién lleva el tiempo y quién escribe el acta.">
    <div class="flex flex-col gap-5">
      <div class="grid gap-4">
        <div>
          <span class="lbl">Toma el tiempo</span>
          <app-select-picker colorScheme="violet" ariaLabel="Quién toma el tiempo" placeholder="Elegir persona"
            [options]="opciones()" [(ngModel)]="papeles.tiempo" />
          <p class="caption mt-1">Lleva el cronómetro de cada tema. Si no elige a nadie: {{ porDefectoTiempo() }}.</p>
        </div>
        <div>
          <span class="lbl">Toma las notas del acta</span>
          <app-select-picker colorScheme="violet" ariaLabel="Quién toma las notas" placeholder="Elegir persona"
            [options]="opciones()" [(ngModel)]="papeles.redactor" />
          <p class="caption mt-1">Escribe el acta y decide qué queda. Si no elige a nadie: {{ porDefectoNotas() }}.</p>
        </div>
      </div>
      <fieldset>
        <legend class="lbl w-full flex items-baseline justify-between gap-2">
          <span>Colaboran en las notas <span class="font-normal text-slate-500 dark:text-slate-400">(opcional)</span></span>
          @if (papeles.colaboradores.size) { <span class="caption tabular-nums">{{ papeles.colaboradores.size }} {{ papeles.colaboradores.size === 1 ? 'elegido' : 'elegidos' }}</span> }
        </legend>
        <p class="caption mb-2">Pueden añadir puntos a las notas durante la reunión.</p>
        @if (candidatosColaborar().length) {
          <ul class="sel-lista">
            @for (a of candidatosColaborar(); track a.id) {
              <li>
                <label class="sel-persona" [attr.data-on]="papeles.colaboradores.has(a.id) ? 'si' : null">
                  <input type="checkbox" class="sr-only" [checked]="papeles.colaboradores.has(a.id)" (change)="alternarColaborador(a.id)" />
                  <span class="sel-caja" aria-hidden="true"><lucide-icon name="check" [size]="14"></lucide-icon></span>
                  <span class="sel-nombre">{{ a.label }}</span>
                </label>
              </li>
            }
          </ul>
        } @else {
          <p class="text-sm text-slate-500 dark:text-slate-400">Primero elija a los convocados.</p>
        }
      </fieldset>
    </div>
    <div slot="footer" class="flex gap-3">
      <button type="button" class="btn-ghost" (click)="papelesAbierto.set(false)">Cancelar</button>
      <button type="button" class="btn-save focus-ring" (click)="aplicarPapeles()">
        <lucide-icon name="check" [size]="16" aria-hidden="true"></lucide-icon>Listo
      </button>
    </div>
  </app-modal>

  <app-a-quien-asignar [pedido]="sugerencia()?.pedido ?? null" [idCongregacion]="congregacionAdmin()"
    (elegir)="aplicarSugerencia($event)" (cerrar)="sugerencia.set(null)" />

  <app-confirm-dialog [open]="confirmar() === 'cancelar'" severity="danger" title="¿Cancelar esta reunión?"
    [message]="mensajeCancelar()" confirmLabel="Cancelar la reunión" cancelLabel="No, dejarla"
    [busy]="accionando()" (confirmed)="cancelarReunion()" (cancelled)="confirmar.set(null)" />

  <!-- ══════ Confirmaciones ══════ -->
  <app-confirm-dialog [open]="confirmar() === 'cambiar-tipo'" severity="warning" title="¿Cambiar también los convocados?"
    [message]="'Usted cambió la lista de convocados a mano. ¿Quiere ponerla como corresponde a «' + tipoActual().etiqueta + '», o dejar la suya?'"
    confirmLabel="Poner la lista del tipo" cancelLabel="Dejar mi lista"
    (confirmed)="resolverCambioTipo(true)" (cancelled)="resolverCambioTipo(false)" />

  <!-- Borrador: convocar avisando o sin avisar -->
  <app-modal [open]="confirmar() === 'convocar' && reunion()?.estado !== 'convocada'" (closed)="confirmar.set(null)"
             title="¿Cómo quiere convocarla?" size="lg" [hasFooter]="true">
    <div class="flex flex-col gap-3" role="group" aria-label="Elija una de las dos opciones">
      <button type="button" class="op-convocar op-avisar focus-ring" (click)="convocar(true)">
        <span class="op-icono"><lucide-icon name="send" [size]="22" aria-hidden="true"></lucide-icon></span>
        <span class="op-cuerpo">
          <span class="op-titulo">Convocar y avisar a {{ avisoInfo().conAviso }} {{ avisoInfo().conAviso === 1 ? 'persona convocada' : 'personas convocadas' }}</span>
          <span class="op-texto">Reciben el aviso en el celular y pueden ver el programa. También se avisa al Coordinador y al Secretario.</span>
          @if (avisoInfo().sinAviso) {
            <span class="op-nota">{{ avisoInfo().sinAviso }} no {{ avisoInfo().sinAviso === 1 ? 'tiene' : 'tienen' }} la app ni cuenta: avíseles usted.</span>
          }
        </span>
        <lucide-icon class="op-flecha" name="chevron-right" [size]="20" aria-hidden="true"></lucide-icon>
      </button>
      <button type="button" class="op-convocar op-silencio focus-ring" (click)="convocar(false)">
        <span class="op-icono"><lucide-icon name="bell-off" [size]="22" aria-hidden="true"></lucide-icon></span>
        <span class="op-cuerpo">
          <span class="op-titulo">Convocar sin avisar</span>
          <span class="op-texto">La reunión queda fija, pero nadie recibe aviso ni el recordatorio del día antes. Podrá avisar más tarde con el botón «Avisar».</span>
        </span>
        <lucide-icon class="op-flecha" name="chevron-right" [size]="20" aria-hidden="true"></lucide-icon>
      </button>
    </div>
    <div class="mt-3">
      @if (sucio()) { <p class="text-xs text-slate-500 dark:text-slate-400">Antes se guardarán sus cambios.</p> }
    </div>
    <div slot="footer" class="flex gap-3">
      <button type="button" class="btn-secondary focus-ring" (click)="confirmar.set(null)">Cancelar</button>
    </div>
  </app-modal>

  <!-- Convocada: avisar (primera vez o cambios) -->
  <app-confirm-dialog [open]="confirmar() === 'convocar' && reunion()?.estado === 'convocada'" severity="info"
    [title]="sinAvisar() ? '¿Avisar a los convocados?' : '¿Avisar de los cambios?'"
    [message]="mensajeConvocar()"
    confirmLabel="Avisar"
    (confirmed)="convocar(true)" (cancelled)="confirmar.set(null)" />

  <app-confirm-dialog [open]="confirmar() === 'acta'" severity="info" title="¿Generar el acta de la reunión?"
    [message]="mensajeActa()" confirmLabel="Generar acta"
    (confirmed)="pasarAActa()" (cancelled)="confirmar.set(null)" />

  <app-confirm-dialog [open]="confirmar() === 'eliminar'" severity="danger" title="¿Eliminar esta reunión?"
    message="Se borrará la reunión con todas sus partes y propuestas. Esto no se puede deshacer." confirmLabel="Eliminar"
    (confirmed)="eliminar()" (cancelled)="confirmar.set(null)" />

  <app-confirm-dialog [open]="confirmar() === 'salir'" severity="warning" title="¿Salir sin guardar?"
    message="Hizo cambios que todavía no se guardaron. Si sale ahora, se perderán." confirmLabel="Salir sin guardar" cancelLabel="Seguir editando"
    (confirmed)="resolverSalida(true)" (cancelled)="resolverSalida(false)" />

  <app-confirm-dialog [open]="confirmar() === 'quitar-parte'" severity="danger" title="¿Quitar esta parte?"
    [message]="'Se quitará «' + (parteAQuitarTitulo() || 'la parte') + '» del programa. El cambio se aplica al guardar.'" confirmLabel="Quitar"
    (confirmed)="quitarParte()" (cancelled)="confirmar.set(null)" />

  <app-confirm-dialog [open]="confirmar() === 'descartar'" severity="danger"
    [title]="modoEdicion() ? '¿Descartar este punto?' : '¿Retirar su propuesta?'"
    [message]="'«' + (propuestaADescartar()?.titulo || '') + '» se borrará y no se tratará en la reunión.'"
    [confirmLabel]="modoEdicion() ? 'Descartar' : 'Retirar'"
    (confirmed)="descartar()" (cancelled)="confirmar.set(null)" />
  `,
  styles: [`
    :host { display: block; }

    .chip-estado {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.1875rem 0.625rem; border-radius: 9999px;
      font-size: 0.75rem; font-weight: 700; border: 1px solid transparent; cursor: default;
    }
    .chip-estado::before { content: ''; width: 0.375rem; height: 0.375rem; border-radius: 9999px; background: currentColor; }
    .chip-estado { color: var(--est); background: color-mix(in oklab, var(--est) 11%, transparent); border-color: color-mix(in oklab, var(--est) 32%, transparent); }
    .chip-estado[data-estado='cancelada'] { text-decoration: line-through; text-decoration-thickness: 1px; }
    .op-convocar {
      display: flex; align-items: center; gap: 1rem; width: 100%; text-align: left; cursor: pointer;
      padding: 1rem 1.125rem; border-radius: 1rem; border: 1.5px solid #cbd5e1; background: #fff;
      transition: border-color 150ms ease-out, background-color 150ms ease-out, transform 120ms ease-out;
    }
    .op-convocar:active { transform: scale(0.99); }
    .op-icono {
      flex-shrink: 0; width: 2.75rem; height: 2.75rem; border-radius: 0.75rem;
      display: inline-flex; align-items: center; justify-content: center;
    }
    .op-cuerpo { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.25rem; }
    .op-titulo { font-size: 1rem; font-weight: 700; color: #0f172b; line-height: 1.3; }
    .op-texto { font-size: 0.875rem; color: #45556c; line-height: 1.45; }
    .op-nota { font-size: 0.875rem; font-weight: 600; color: #b45309; }
    .op-flecha { flex-shrink: 0; color: #90a1b9; }
    .op-avisar { border-color: #c4b5fd; background: #f5f3ff; }
    .op-avisar .op-icono { background: #7c3aed; color: #fff; }
    .op-silencio .op-icono { background: #e2e8f0; color: #45556c; }
    .op-avisar:hover { border-color: #7c3aed; background: #ede9fe; }
    .op-silencio:hover { border-color: #62748e; background: #f1f5f9; }
    :host-context(.dark) .op-convocar { background: rgba(30,41,59,0.6); border-color: rgba(148,163,184,0.35); }
    :host-context(.dark) .op-titulo { color: #f1f5f9; }
    :host-context(.dark) .op-texto { color: #cbd5e1; }
    :host-context(.dark) .op-nota { color: #fbbf24; }
    :host-context(.dark) .op-avisar { border-color: rgba(139,92,246,0.55); background: rgba(139,92,246,0.12); }
    :host-context(.dark) .op-avisar .op-icono { background: #7c3aed; color: #fff; }
    :host-context(.dark) .op-silencio .op-icono { background: rgba(148,163,184,0.2); color: #e2e8f0; }
    :host-context(.dark) .op-avisar:hover { border-color: #a78bfa; background: rgba(139,92,246,0.2); }
    :host-context(.dark) .op-silencio:hover { border-color: #90a1b9; background: rgba(148,163,184,0.12); }

    /* Armar / Vista previa: a todo el ancho en el teléfono; en pantallas anchas,
       un control compacto en la cabecera, antes de las acciones. */
    @container (min-width: 48rem) { .segmented.seg-movil { width: auto; order: 0; margin-left: auto; } }
    /* Ancho medio (720p con menú abierto): PDF, Acta y Vista previa solo con
       icono (llevan título emergente y aria-label) para que el título quepa. */
    @container (min-width: 48rem) and (max-width: 75rem) {
      .ed header .acc-txt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    }
    .estado-guardado { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; font-weight: 600; color: #62748e; }
    :host-context(.dark) .estado-guardado { color: #90a1b9; }
    .estado-guardado .punto { width: 0.5rem; height: 0.5rem; border-radius: 9999px; background: #f59e0b; }

    .titulo-reunion { display: block; resize: none; field-sizing: content; min-height: 2.625rem; line-height: 1.35; }
    .titulo-reunion[aria-invalid='true'] { border-color: #fda4af !important; }
    .ed-fecha { font-size: 1rem; font-weight: 500; color: #62748e; }
    :host-context(.dark) .ed-fecha { color: #90a1b9; }

    /* Convocados: se ve como un campo más de la rejilla */
    .convocados {
      /* Sin wrap: si no cabe, el resumen pasa a dos renglones y «Cambiar» queda al lado */
      min-height: 2.625rem; display: flex; align-items: center; gap: 0.25rem 0.5rem;
      padding: 0.25rem 0.25rem 0.25rem 0.75rem; border-radius: 0.75rem; border: 1px solid #e2e8f0; background: #fff;
      font-size: 0.875rem;
    }
    .convocados[data-vacio='si'] { border-color: #fde68a; background: #fffbeb; }
    :host-context(.dark) .convocados { border-color: #314158; background: #0f172b; }
    :host-context(.dark) .convocados[data-vacio='si'] { border-color: rgba(245,158,11,0.35); background: rgba(245,158,11,0.08); }
    .sin-cuenta { font-weight: 600; color: #b45309; white-space: nowrap; }
    :host-context(.dark) .sin-cuenta { color: #fcd34d; }
    .btn-cambiar {
      flex-shrink: 0; margin-left: auto; display: inline-flex; align-items: center; gap: 0.375rem; min-height: 2rem; padding: 0 0.75rem;
      border-radius: 0.5rem; font-size: 0.875rem; font-weight: 700; color: var(--color-brand-purple); background: #f5f3ff; border: 1px solid #ddd6fe;
      transition: background-color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out;
    }
    .btn-cambiar:hover:not(:disabled) { background: #ede9fe; border-color: #c4b5fd; }
    .btn-cambiar:active:not(:disabled) { transform: scale(0.97); }
    .btn-cambiar:disabled { opacity: 0.5; }
    :host-context(.dark) .btn-cambiar { color: #ddd6fe; background: rgba(139,92,246,0.16); border-color: rgba(139,92,246,0.4); }
    :host-context(.dark) .btn-cambiar:hover:not(:disabled) { background: rgba(139,92,246,0.24); }

    /* ── Ventana de convocados ─────────────────────────────── */
    /* Alto fijo (lo que deja la ventana): filtrar no hace saltar el diálogo */
    .sel {
      height: min(calc(90dvh - 9.5rem), 46rem); min-height: 18rem;
      display: grid; grid-template-rows: auto minmax(0, 1fr);
    }
    @container (min-width: 44rem) { .sel { grid-template-rows: none; grid-template-columns: 15.5rem minmax(0, 1fr); } }

    .sel-grupos {
      display: flex; gap: 0.375rem; overflow-x: auto; padding: 0.75rem 1rem; scrollbar-width: none;
      border-bottom: 1px solid #f1f5f9;
    }
    :host-context(.dark) .sel-grupos { border-color: rgba(148,163,184,0.14); }
    @container (min-width: 44rem) {
      .sel-grupos {
        flex-direction: column; overflow: auto; padding: 0.875rem 0.75rem; gap: 0.25rem;
        border-bottom: 0; border-right: 1px solid #f1f5f9; background: #f8fafc;
      }
      :host-context(.dark) .sel-grupos { background: rgba(15,23,42,0.35); border-color: rgba(148,163,184,0.14); }
    }
    /* Grupos: filas iguales, sin adornos. El activo lleva el acento; el contador resume lo elegido. */
    .sel-g {
      flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
      min-height: 2.5rem; padding: 0.375rem 0.75rem; border-radius: 0.75rem; text-align: left;
      font-size: 0.875rem; font-weight: 600; color: var(--color-slate-600); background: transparent;
      transition: background-color 150ms ease-out, color 150ms ease-out, transform 120ms ease-out;
    }
    :host-context(.dark) .sel-g { color: var(--color-slate-300); }
    .sel-g:active { transform: scale(0.98); }
    @media (hover: hover) { .sel-g:hover { background: color-mix(in oklab, var(--accent) 8%, transparent); } }
    .sel-g[aria-current='true'] { background: color-mix(in oklab, var(--accent) 12%, transparent); color: var(--accent); }
    :host-context(.dark) .sel-g[aria-current='true'] { color: color-mix(in oklab, var(--accent) 45%, white); }
    .sel-g:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 1px; }
    .sel-g-txt { white-space: nowrap; }
    @container (min-width: 44rem) { .sel-g-txt { white-space: normal; line-height: 1.25; } }
    .sel-g-n {
      min-width: 1.75rem; padding: 0.0625rem 0.5rem; border-radius: 9999px; text-align: center;
      font-size: 0.75rem; font-weight: 700; color: var(--color-slate-600); background: var(--color-slate-100);
    }
    :host-context(.dark) .sel-g-n { color: var(--color-slate-300); background: rgb(51 65 85 / 0.6); }
    .sel-g[aria-current='true'] .sel-g-n { color: #fff; background: var(--accent); }
    :host-context(.dark) .sel-g[aria-current='true'] .sel-g-n { color: #fff; }

    .sel-main { min-height: 0; display: flex; flex-direction: column; }
    /* El buscador toma la línea entera si no cabe junto a «Elegir a todos» */
    .sel-buscador { flex: 1 1 16rem; min-width: 0; }
    .sel-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; padding: 0.875rem 1rem 0.625rem; }
    .buscador { position: relative; display: flex; align-items: center; }
    .buscador-lupa { position: absolute; left: 0.75rem; color: #90a1b9; pointer-events: none; }
    .buscador input {
      width: 100%; min-height: 2.75rem; padding: 0.5rem 0.75rem 0.5rem 2.375rem; border-radius: 0.75rem;
      font-size: 1rem; color: #0f172b; background: #f8fafc; border: 1px solid #e2e8f0;
      transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
    }
    .buscador input::-webkit-search-cancel-button { cursor: pointer; }
    .buscador input:focus { outline: none; background: #fff; border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.18); }
    :host-context(.dark) .buscador input { color: #f1f5f9; background: rgba(15,23,42,0.6); border-color: #314158; }
    :host-context(.dark) .buscador input:focus { background: rgba(15,23,42,0.85); border-color: #a78bfa; }
    .sel-todos {
      flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.5rem; min-height: 2.75rem; padding: 0 0.875rem;
      border-radius: 0.75rem; font-size: 0.875rem; font-weight: 700; color: var(--color-brand-purple); border: 1px solid #ddd6fe; background: #faf5ff;
      transition: background-color 150ms ease-out, transform 120ms ease-out;
    }
    .sel-todos:active { transform: scale(0.97); }
    @media (hover: hover) { .sel-todos:hover { background: #f3e8ff; } }
    :host-context(.dark) .sel-todos { color: #ddd6fe; border-color: rgba(139,92,246,0.4); background: rgba(139,92,246,0.12); }
    @media (hover: hover) { :host-context(.dark) .sel-todos:hover { background: rgba(139,92,246,0.22); } }
    .sel-tri {
      width: 1.125rem; height: 1.125rem; display: grid; place-items: center; border-radius: 0.3125rem;
      border: 2px solid currentColor; color: #7c3aed;
    }
    .sel-tri[data-estado='todos'], .sel-tri[data-estado='algunos'] { background: #7c3aed; color: #fff; border-color: #7c3aed; }
    :host-context(.dark) .sel-tri { color: #c4b5fd; }
    :host-context(.dark) .sel-tri[data-estado='todos'], :host-context(.dark) .sel-tri[data-estado='algunos'] { background: #8b5cf6; border-color: #8b5cf6; color: #fff; }

    .sel-lista-wrap { flex: 1; min-height: 0; overflow-y: auto; padding: 0 1rem 1rem; }
    /* Rótulo de cada sección: sin banda de color; título, cuántos y la acción de la sección en una línea. */
    .sel-subt {
      position: sticky; top: 0; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;
      padding: 0.625rem 0 0.5rem; background: var(--color-white);
      border-bottom: 1px solid var(--color-slate-200); margin-bottom: 0.5rem;
    }
    :host-context(.dark) .sel-subt { background: var(--color-slate-900); border-bottom-color: rgb(148 163 184 / 0.16); }
    .sel-subt-t { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--color-slate-600); }
    :host-context(.dark) .sel-subt-t { color: var(--color-slate-300); }
    .sel-subt-n { font-weight: 600; letter-spacing: 0; text-transform: none; color: var(--color-slate-500); }
    .sel-subt-accion {
      min-height: 2rem; padding: 0 0.625rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 700; color: var(--accent);
      transition: background-color 150ms ease-out;
    }
    :host-context(.dark) .sel-subt-accion { color: color-mix(in oklab, var(--accent) 45%, white); }
    @media (hover: hover) { .sel-subt-accion:hover { background: color-mix(in oklab, var(--accent) 10%, transparent); } }
    section + section { margin-top: 0.75rem; }
    /* Tantas columnas como quepan: 1 en el teléfono, 2–3 en escritorio, 4 en pantallas grandes */
    .sel-lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr)); gap: 0.5rem; }
    .sel-persona {
      display: flex; align-items: center; gap: 0.75rem; min-height: 2.75rem; padding: 0.375rem 0.75rem;
      border-radius: 0.75rem; cursor: pointer; border: 1px solid var(--color-slate-200); background: var(--color-white); color: var(--color-slate-800);
      transition: background-color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out;
      user-select: none;
    }
    .sel-nombre { flex: 1; min-width: 0; font-size: 0.875rem; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
    .sel-persona:active { transform: scale(0.985); }
    @media (hover: hover) { .sel-persona:hover { border-color: color-mix(in oklab, var(--accent) 45%, var(--color-slate-200)); } }
    .sel-persona[data-on='si'] { background: color-mix(in oklab, var(--accent) 7%, white); border-color: color-mix(in oklab, var(--accent) 55%, white); }
    .sel-persona:has(:focus-visible) { outline: 2px solid var(--accent-focus); outline-offset: 2px; }
    :host-context(.dark) .sel-persona { background: transparent; border-color: var(--color-slate-700); color: var(--color-slate-100); }
    @media (hover: hover) { :host-context(.dark) .sel-persona:hover { border-color: color-mix(in oklab, var(--accent) 55%, var(--color-slate-700)); } }
    :host-context(.dark) .sel-persona[data-on='si'] { background: color-mix(in oklab, var(--accent) 12%, transparent); border-color: color-mix(in oklab, var(--accent) 50%, transparent); }
    /* Casilla propia: más grande y clara que la del navegador */
    .sel-caja {
      flex-shrink: 0; width: 1.375rem; height: 1.375rem; display: grid; place-items: center; border-radius: 0.375rem;
      border: 2px solid #cbd5e1; background: #fff; color: transparent;
      transition: background-color 150ms ease-out, border-color 150ms ease-out;
    }
    .sel-caja lucide-icon { transform: scale(0.4); opacity: 0; transition: transform 180ms cubic-bezier(0.23, 1, 0.32, 1), opacity 120ms ease-out; }
    .sel-persona[data-on='si'] .sel-caja { background: var(--accent); border-color: var(--accent); color: #fff; }
    .sel-persona[data-on='si'] .sel-caja lucide-icon { transform: scale(1); opacity: 1; }
    :host-context(.dark) .sel-caja { background: transparent; border-color: #62748e; }
    :host-context(.dark) .sel-persona[data-on='si'] .sel-caja { background: var(--accent); border-color: var(--accent); }
    .sel-sin { flex-shrink: 0; display: grid; place-items: center; width: 1.5rem; height: 1.5rem; border-radius: 9999px; color: #b45309; background: #fef3c7; }
    :host-context(.dark) .sel-sin { color: #fcd34d; background: rgba(245,158,11,0.16); }

    .sel-pie { width: 100%; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .sel-resumen { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.5rem; font-size: 0.875rem; color: #45556c; }
    :host-context(.dark) .sel-resumen { color: #cbd5e1; }
    .sel-resumen-sin {
      display: inline-flex; align-items: center; gap: 0.3125rem; padding: 0.125rem 0.5rem; border-radius: 9999px;
      font-size: 0.75rem; font-weight: 600; color: #92400e; background: #fef3c7;
    }
    :host-context(.dark) .sel-resumen-sin { color: #fcd34d; background: rgba(245,158,11,0.16); }

    /* Íconos en rem: crecen con el texto en pantallas 2K/4K (la app agranda el rem) */
    .sel-caja ::ng-deep svg, .sel-tri ::ng-deep svg, .sel-sin ::ng-deep svg, .sel-resumen-sin ::ng-deep svg {
      width: 0.875rem; height: 0.875rem;
    }
    .sel-barra .buscador-lupa ::ng-deep svg { width: 1.0625rem; height: 1.0625rem; }

    @media (prefers-reduced-motion: reduce) {
      .sel-g, .sel-persona, .sel-caja, .sel-caja lucide-icon, .sel-todos { transition: none; }
    }

    .lbl { display: block; font-size: 0.875rem; font-weight: 600; color: #45556c; margin: 0 0 0.3125rem 0.125rem; }
    :host-context(.dark) .lbl { color: #cbd5e1; }
    .error-campo { margin-top: 0.25rem; font-size: 0.75rem; font-weight: 600; color: #be123c; }
    :host-context(.dark) .error-campo { color: #fda4af; }

    /* ── Acciones ──────────────────────────────────────────── */
    .acciones { display: flex; align-items: center; gap: 0.5rem; }
    /* En la barra del teléfono: los botones de icono a su tamaño y los
       principales (Convocar, Guardar) repartiéndose el resto del ancho. */
    .barra .acciones { flex-wrap: wrap; gap: 0.375rem; }
    .barra .acciones > * { justify-content: center; padding-inline: 0.75rem; }
    .barra .acciones > .acc-ancho { flex: 1 1 8rem; }
    .barra {
      padding: 0.5rem; border-radius: 1rem; background: rgba(255,255,255,0.92); border: 1px solid #e2e8f0;
      box-shadow: 0 -8px 20px -14px rgba(15,23,42,0.35); backdrop-filter: blur(8px);
    }
    :host-context(.dark) .barra { background: rgba(15,23,42,0.92); border-color: #314158; }


    /* Si el formulario no cabe (teléfono, pantalla muy baja), se desplaza
       dentro de su panel; la página nunca. */
    .panel-edicion { overflow-y: auto; overscroll-behavior: contain; }
    /* En el teléfono no hay listas con scroll dentro de otra: el programa
       crece a su alto natural y se desplaza todo el formulario junto. */
    /* Teléfono: todo el panel se desplaza. Se pregunta por el ancho del EDITOR (contenedor «ed»),
       no por el de la tarjeta: con el menú abierto la tarjeta es angosta aunque la pantalla sea
       grande, y ahí la lista debe seguir desplazándose dentro de su tarjeta. */
    .ed { container-name: ed; }
    @container ed (max-width: 47.99rem) {
      .programa { flex: none; min-height: 0; overflow: visible; }
      .programa .lista-interna { flex: none; overflow: visible; }
    }

    /* ── Propuestas ────────────────────────────────────────── */
    .propuestas {
      padding: 0.75rem 1rem; border-radius: 1rem;
      border: 1px solid #fde68a; background: rgba(255, 251, 235, 0.8);
    }
    :host-context(.dark) .propuestas { border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.07); }
    .propuesta {
      display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem;
      padding: 0.5rem 0.75rem; border-radius: 0.75rem; background: #fff; border: 1px solid #fef3c7;
    }
    :host-context(.dark) .propuesta { background: #1d293d; border-color: #314158; }

    /* ── Programa ──────────────────────────────────────────── */
    .franja-programa { background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
    :host-context(.dark) .franja-programa { background: rgba(15,23,42,0.45); border-bottom-color: rgba(148,163,184,0.18); }
    .dato-prog {
      display: inline-flex; align-items: center; gap: 0.3125rem; padding: 0.125rem 0.625rem;
      border-radius: 9999px; font-size: 0.75rem; font-weight: 700; background: #fff; border: 1px solid #e2e8f0; color: #314158;
    }
    .dato-prog-min { background: #ecfdf5; border-color: #a7f3d0; color: #047857; }
    .dato-prog.dato-prog-anadir, :host-context(.dark) .dato-prog.dato-prog-anadir {
      cursor: pointer; background: #7c3aed; border-color: #7c3aed; color: #fff; font-weight: 700;
    }
    .dato-prog.dato-prog-anadir:hover, :host-context(.dark) .dato-prog.dato-prog-anadir:hover { background: var(--color-brand-purple); border-color: var(--color-brand-purple); }
    :host-context(.dark) .dato-prog.dato-prog-anadir:hover { background: #8b5cf6; border-color: #8b5cf6; }
    :host-context(.dark) .dato-prog { background: #1d293d; border-color: #314158; color: #e2e8f0; }
    :host-context(.dark) .dato-prog-min { background: rgba(16,185,129,0.12); border-color: rgba(16,185,129,0.3); color: #6ee7b7; }
    .parte {
      border-radius: 0.875rem; border: 1px solid transparent;
      transition: background-color 150ms ease-out, border-color 150ms ease-out;
      animation: entra 180ms cubic-bezier(0.23, 1, 0.32, 1) both;
    }
    .parte:hover, .parte:focus-within, .parte.abierta { background: #f8fafc; border-color: #e2e8f0; }
    :host-context(.dark) .parte:hover, :host-context(.dark) .parte:focus-within, :host-context(.dark) .parte.abierta { background: rgba(255,255,255,0.03); border-color: #314158; }
    .parte:focus-within { border-color: #c4b5fd; }
    :host-context(.dark) .parte:focus-within { border-color: rgba(139,92,246,0.5); }
    .parte-error, .parte-error:hover { border-color: #fda4af; }
    @keyframes entra { from { opacity: 0; transform: translateY(4px); } }

    /* Angosto: título arriba; responsable, minutos y botones debajo */
    .parte-fila {
      display: grid; align-items: center; gap: 0.5rem 0.625rem; padding: 0.5rem;
      grid-template-columns: 2rem minmax(0, 1fr) auto;
      grid-template-areas: 'num titulo titulo' 'num resp resp' '. min acc';
    }
    .numero { grid-area: num; align-self: start; margin-top: 0.25rem; }
    .c-titulo { grid-area: titulo; }
    .c-resp { grid-area: resp; }
    .c-min { grid-area: min; justify-self: start; }
    .c-acc { grid-area: acc; min-height: 2.75rem; }
    /* Ancho: una parte = un renglón, como la tabla del PDF */
    @container (min-width: 46rem) {
      .parte-fila {
        grid-template-columns: 2rem minmax(0, 1.4fr) minmax(11rem, 1fr) auto auto;
        grid-template-areas: 'num titulo resp min acc';
        /* Los controles arrancan alineados arriba: bajo el título puede haber la etiqueta de categoría,
           y centrados quedarían más abajo que el campo del título. */
        align-items: start;
      }
      .numero { align-self: start; margin-top: 0.375rem; }
      .c-min, .c-acc { align-self: start; }
    }

    /* Los nombres no se cortan: si no caben, pasan a un segundo renglón */
    .c-resp ::ng-deep .sp-trigger-label, .datos ::ng-deep .sp-trigger-label {
      white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.25; overflow-wrap: anywhere;
    }

    .numero {
      width: 2rem; height: 2rem; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 9999px; background: #f5f3ff; color: var(--color-brand-purple);
      font-weight: 700; font-size: 0.875rem; font-variant-numeric: tabular-nums;
    }
    :host-context(.dark) .numero { background: rgba(139,92,246,0.16); color: #c4b5fd; }

    /* El título es un textarea que crece: nunca se corta, pasa a otro renglón */
    .titulo-input {
      display: block; width: 100%; resize: none; field-sizing: content; min-height: 2.75rem;
      padding: 0.5rem 0.75rem; border-radius: 0.625rem; border: 1px solid #e2e8f0; background: #fff;
      font-weight: 600; line-height: 1.35; color: #0f172b; outline: none;
      transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
    }
    .titulo-input::placeholder { color: #90a1b9; font-weight: 400; }
    .titulo-input:hover { border-color: #cbd5e1; }
    .titulo-input:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
    .titulo-input[aria-invalid='true'] { border-color: #fda4af; }
    :host-context(.dark) .titulo-input { background: #0f172b; border-color: #314158; color: #f1f5f9; }
    :host-context(.dark) .titulo-input:hover { border-color: #45556c; }
    :host-context(.dark) .titulo-input:focus { border-color: #8b5cf6; }

    .stepper {
      display: inline-flex; align-items: stretch; height: 2.75rem;
      border: 1px solid #e2e8f0; border-radius: 0.625rem; overflow: hidden; background: #fff;
    }
    :host-context(.dark) .stepper { border-color: #314158; background: #0f172b; }
    .stepper:focus-within { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.15); }
    .stepper-btn {
      width: 2.25rem; display: inline-flex; align-items: center; justify-content: center;
      color: #45556c; transition: background-color 150ms ease-out;
    }
    .stepper-btn:hover:not(:disabled) { background: #ede9fe; color: var(--color-brand-purple); }
    .stepper-btn:active:not(:disabled) { transform: scale(0.92); }
    .stepper-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .stepper-btn:focus-visible { outline: 2px solid #8b5cf6; outline-offset: -2px; }
    :host-context(.dark) .stepper-btn { color: #cbd5e1; }
    :host-context(.dark) .stepper-btn:hover:not(:disabled) { background: rgba(139,92,246,0.2); color: #ddd6fe; }
    .stepper-input {
      width: 2.75rem; text-align: center; font-weight: 700; font-size: 0.875rem; background: transparent;
      border-inline: 1px solid #e2e8f0; outline: none; color: #0f172b; -moz-appearance: textfield;
    }
    :host-context(.dark) .stepper-input { border-color: #314158; color: #f1f5f9; }
    .stepper-input::-webkit-outer-spin-button, .stepper-input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

    .icono-btn {
      position: relative; width: 2.25rem; height: 2.25rem; display: inline-flex; align-items: center; justify-content: center;
      border-radius: 0.625rem; color: #62748e;
      transition: background-color 150ms ease-out, color 150ms ease-out, transform 120ms ease-out;
    }
    .icono-btn:hover:not(:disabled) { background: #eef2f7; color: #0f172b; }
    .icono-btn:active:not(:disabled) { transform: scale(0.92); }
    .icono-btn:disabled { opacity: 0.3; cursor: not-allowed; }
    .icono-btn:focus-visible { outline: 2px solid #8b5cf6; outline-offset: 1px; }
    .icono-btn.activo { background: #ede9fe; color: var(--color-brand-purple); }
    .icono-btn-peligro:hover:not(:disabled) { background: #fff1f2; color: #be123c; }
    :host-context(.dark) .icono-btn { color: #90a1b9; }
    :host-context(.dark) .icono-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06); color: #f1f5f9; }
    :host-context(.dark) .icono-btn.activo { background: rgba(139,92,246,0.2); color: #ddd6fe; }
    :host-context(.dark) .icono-btn-peligro:hover:not(:disabled) { background: rgba(244,63,94,0.12); color: #fda4af; }
    .badge-det {
      position: absolute; top: 0.0625rem; right: 0.0625rem; min-width: 1rem; height: 1rem; padding: 0 0.25rem;
      border-radius: 9999px; background: #7c3aed; color: #fff; font-size: 0.75rem; font-weight: 700; line-height: 1rem;
    }

    .detalles {
      display: grid; gap: 0.75rem; padding: 0 0.75rem 0.75rem 3.125rem;
      grid-template-columns: minmax(0, 1fr);
      animation: entra 180ms cubic-bezier(0.23, 1, 0.32, 1) both;
    }
    @container (min-width: 46rem) {
      .detalles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @container (max-width: 30rem) { .detalles { padding-left: 0.75rem; } }


    .anadir {
      width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
      padding: 0.625rem; border-radius: 0.875rem; border: 2px dashed #ddd6fe;
      font-size: 0.875rem; font-weight: 700; color: var(--color-brand-purple);
      transition: background-color 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out;
    }
    .anadir:hover { background: #f5f3ff; border-color: #a78bfa; }
    .anadir:active { transform: scale(0.99); }
    :host-context(.dark) .anadir { border-color: rgba(139,92,246,0.35); color: #c4b5fd; }
    :host-context(.dark) .anadir:hover { background: rgba(139,92,246,0.1); }

    .vacio { display: flex; flex-direction: column; gap: 1rem; padding: 1rem 0.5rem 0.5rem; }
    .vacio-cab { display: flex; align-items: flex-start; gap: 0.75rem; }
    .vacio-icono {
      flex-shrink: 0; width: 2.5rem; height: 2.5rem; border-radius: 0.75rem; display: grid; place-items: center;
      color: var(--accent); background: var(--accent-soft, color-mix(in oklab, var(--accent) 12%, transparent));
    }
    .losetas { display: grid; grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr)); gap: 0.625rem; }
    .loseta {
      display: flex; align-items: center; gap: 0.625rem; min-height: 3.25rem; padding: 0.5rem 0.875rem;
      border-radius: 0.875rem; border-width: 1px; border-style: solid; font-size: 0.875rem; font-weight: 700; text-align: left;
      transition: transform 120ms ease-out, filter 150ms ease-out, border-color 150ms ease-out;
    }
    .loseta > lucide-icon { flex-shrink: 0; color: var(--cat, currentColor); }
    .loseta:hover { border-color: var(--cat, var(--accent)); }
    .loseta:active { transform: scale(0.98); }
    .loseta-neutra { border-style: dashed; border-color: var(--color-slate-300); color: var(--color-slate-700); background: transparent; }
    :host-context(.dark) .loseta-neutra { border-color: var(--color-slate-700); color: var(--color-slate-200); }
    .loseta-neutra:hover { border-color: var(--accent); }
    @media (prefers-reduced-motion: reduce) { .loseta:active { transform: none; } }
    .pie-papeles {
      display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.75rem;
      padding-top: 0.5rem; border-top: 1px solid var(--color-slate-200);
    }
    :host-context(.dark) .pie-papeles { border-top-color: var(--color-slate-800); }
    .det-cat, .det-ancho { grid-column: 1 / -1; }
    .detalles { align-items: start; }
    .det-cancelar { display: flex; align-items: center; gap: 0.75rem; padding-top: 0.5rem; border-top: 1px solid var(--color-slate-200); }
    :host-context(.dark) .det-cancelar { border-top-color: var(--color-slate-800); }
    .cat-opcion {
      cursor: pointer; min-height: 2rem; padding: 0 0.625rem; font-size: 0.75rem; opacity: 0.72;
      transition: opacity 150ms ease-out, transform 120ms ease-out, box-shadow 150ms ease-out;
    }
    .cat-opcion:hover { opacity: 1; }
    .cat-opcion:active { transform: scale(0.97); }
    .cat-opcion[aria-checked='true'] { opacity: 1; font-weight: 700; box-shadow: 0 0 0 1px var(--cat); }
    /* Con el dedo, objetivo táctil de 40 px */
    @media (pointer: coarse) { .cat-opcion { min-height: 2.5rem; padding: 0 0.875rem; font-size: 0.875rem; } }
    @media (prefers-reduced-motion: reduce) { .cat-opcion:active { transform: none; } }
    .rapidas { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.625rem; padding: 0 0.25rem; }
    .lbl-fila { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.3125rem; }
    .lbl-fila .lbl { margin-bottom: 0; }
    .sugerir { display: inline-flex; align-items: center; gap: 0.25rem; min-height: 1.75rem; margin-block: -0.25rem; padding: 0 0.375rem; border-radius: 0.5rem;
      font-size: 0.75rem; font-weight: 700; color: var(--color-brand-purple); }
    .sugerir:hover { background: color-mix(in oklab, var(--color-brand-purple) 8%, transparent); }
    .sugerir:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 1px; }
    :host-context(.dark) .sugerir { color: color-mix(in oklab, var(--color-brand-purple) 45%, white); }

    /* Debajo del título: categoría, cancelado, indicación */
    .meta-parte { display: flex; flex-wrap: wrap; align-items: center; gap: 0.375rem; margin-top: 0.375rem; }
    .meta-parte:empty { display: none; }
    .cat-btn { cursor: pointer; transition: transform 120ms ease-out, filter 150ms ease-out; }
    .cat-btn:hover { filter: brightness(0.97); }
    .cat-btn:active { transform: scale(0.97); }
    .parte-cancelada .titulo-input { text-decoration: line-through; color: #62748e; }
    :host-context(.dark) .parte-cancelada .titulo-input { color: #90a1b9; }
    .nota-asignado { padding: 0.75rem; border-radius: 0.75rem; border: 1px dashed #fcd34d; background: rgb(255 251 235 / 0.6); }
    :host-context(.dark) .nota-asignado { border-color: rgb(245 158 11 / 0.35); background: rgb(245 158 11 / 0.06); }

    /* Menú «Más acciones» */
    .menu-wrap { position: relative; }
    .menu {
      position: absolute; right: 0; top: calc(100% + 0.375rem); z-index: var(--z-dropdown, 40); min-width: 15rem;
      padding: 0.375rem; border-radius: 0.875rem; background: #fff; border: 1px solid #e2e8f0;
      box-shadow: 0 12px 32px -12px rgb(15 23 42 / 0.25); transform-origin: top right;
      animation: menu-entra 160ms cubic-bezier(0.23, 1, 0.32, 1) both;
    }
    .barra .menu { top: auto; bottom: calc(100% + 0.5rem); left: 0; right: auto; transform-origin: bottom left; }
    :host-context(.dark) .menu { background: #0f172b; border-color: #1d293d; }
    @keyframes menu-entra { from { opacity: 0; transform: scale(0.96) translateY(-2px); } }
    .menu-item {
      width: 100%; display: flex; align-items: center; gap: 0.625rem; min-height: 2.5rem; padding: 0 0.75rem;
      border-radius: 0.625rem; font-size: 0.875rem; font-weight: 600; color: #314158; text-align: left;
      transition: background-color 120ms ease-out;
    }
    .menu-item:hover, .menu-item:focus-visible { background: #f1f5f9; outline: none; }
    :host-context(.dark) .menu-item { color: #e2e8f0; }
    :host-context(.dark) .menu-item:hover, :host-context(.dark) .menu-item:focus-visible { background: rgb(255 255 255 / 0.06); }
    .menu-peligro { color: #be123c; }
    .menu-peligro:hover, .menu-peligro:focus-visible { background: #fff1f2; }
    :host-context(.dark) .menu-peligro { color: #fda4af; }
    :host-context(.dark) .menu-peligro:hover { background: rgb(244 63 94 / 0.12); }
    .menu-sep { height: 1px; margin: 0.375rem 0.25rem; background: #e2e8f0; }
    :host-context(.dark) .menu-sep { background: #1d293d; }
    @media (prefers-reduced-motion: reduce) { .menu { animation: none; } .cat-btn:active { transform: none; } }

    .lista-interna { scrollbar-width: thin; scrollbar-color: rgba(148,163,184,0.45) transparent; overscroll-behavior: contain; }

    /* Pantallas bajas (720p): menos aire para darle alto al programa */
    @media (max-height: 800px) {
      .ed { gap: 0.5rem; }
      .datos { padding: 0.75rem 1rem !important; }
      .datos .lbl { margin-bottom: 0.125rem; font-size: 0.75rem; }
      .parte-fila { padding-block: 0.3125rem; }
    }


    @media (prefers-reduced-motion: reduce) {
      .parte, .detalles { animation: none; }
      .icono-btn:active, .stepper-btn:active, .anadir:active { transform: none; }
    }
  `],
})
export class ReunionAncianosEditorPage implements OnInit {
  private svc = inject(ReunionAncianosService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private store = inject(AuthStore);
  private ctx = inject(CongregacionContextService);
  private toast = inject(ToastService);

  readonly estadoLabel = ESTADO_REUNION_LABEL;
  readonly minutosTexto = minutosTexto;
  readonly puedeEditarActas = puedeEditarActas(this.store);
  readonly atajo = /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent) ? '⌘' : 'Ctrl';

  /** null mientras es una reunión nueva sin guardar. */
  private id: number | null = null;
  esNueva = signal(false);
  reunion = signal<ReunionOut | null>(null);
  cargando = signal(true);
  errorCarga = signal<'no-encontrada' | 'error' | 'sin-congregacion' | null>(null);
  /** Publicadores activos de la congregación (GET /personas), para elegir convocados. */
  personas = signal<PersonaOpcion[]>([]);
  cargandoConvocados = signal(false);
  /** En una reunión nueva: el usuario cambió la lista a mano (al cambiar el tipo se pregunta). */
  private convocadosEditados = false;
  private tipoPendiente: TipoReunion | null = null;

  readonly opcionesTipo: PickerOption[] = TIPOS_REUNION.map(t => ({ value: t.clave, label: t.etiqueta }));

  // Ventana de convocados: trabaja sobre una copia y se aplica con «Listo».
  convocadosAbierto = signal(false);
  seleccion = signal<Set<number>>(new Set());
  busquedaConv = signal('');
  /** Qué se ve en la ventana de convocados: todos, un grupo o solo los elegidos. */
  grupoVista = signal<VistaGrupo>('todos');

  /**
   * El formulario es un objeto plano para usar [(ngModel)]; cada cambio llama
   * a tocar(), que avanza `version` para que la vista previa y el «hay
   * cambios» se recalculen.
   */
  form: FormReunion = this.formVacio();
  private version = signal(0);
  /** Lo último guardado (o cargado), serializado: si coincide, no hay cambios. */
  private base = signal('');
  private uid = 0;

  pestana = signal<'editar' | 'vista'>('editar');
  intento = signal(false);
  guardando = signal(false);
  descargando = signal(false);
  leyendoActa = signal(false);
  accionando = signal(false);
  conflicto = signal(false);
  procesandoParte = signal<number | null>(null);
  confirmar = signal<Confirmacion>(null);
  private indiceAQuitar: number | null = null;
  parteAQuitarTitulo = signal('');
  propuestaADescartar = signal<ParteOut | null>(null);

  /** Categorías de la congregación (también las archivadas, para mostrar las partes viejas). */
  categorias = signal<CategoriaOut[]>([]);
  menuAbierto = signal(false);
  // Ventana de papeles: trabaja sobre una copia y se aplica con «Listo».
  papelesAbierto = signal(false);
  papeles = { tiempo: null as number | null, redactor: null as number | null, colaboradores: new Set<number>() };

  proponerAbierto = signal(false);
  enviandoPropuesta = signal(false);
  propuesta = { titulo: '', objetivo: '', minutos: null as number | null };

  /** Para no preguntar «¿salir sin guardar?» tras eliminar o pasar a acta. */
  private saliendo = false;
  private salidaPendiente: ((salir: boolean) => void) | null = null;

  modoEdicion = computed(() => this.esNueva() || !!this.reunion()?.puedo_editar);
  // Mientras se acepta un punto, la reunión se vuelve a leer: guardar antes daría un falso conflicto.
  ocupado = computed(() => this.guardando() || this.accionando() || this.procesandoParte() !== null);
  /** Las propuestas pendientes: todas para el gestor; las suyas para el anciano. */
  propuestas = computed(() => (this.reunion()?.partes ?? []).filter(p => p.estado === 'propuesta'));

  tipoActual = computed(() => { this.version(); return tipoReunion(this.form.tipo); });

  /** El título resuelto: el propio o el del tipo. */
  titulo = computed(() => {
    this.version();
    if (this.esNueva()) return 'Nueva reunión';
    if (!this.modoEdicion()) return this.reunion()?.titulo || 'Reunión';
    return this.form.titulo.trim() || tipoReunion(this.form.tipo).titulo;
  });
  /** «4 de noviembre», junto al título. */
  fechaTitulo = computed(() => {
    this.version();
    if (this.esNueva()) return '';
    return diaYMes(this.modoEdicion() ? this.form.fecha : this.reunion()?.fecha);
  });

  mostrarTitulo = computed(() => { this.version(); return this.form.tipo === 'otra' || !!this.form.titulo.trim(); });
  faltaTitulo = computed(() => { this.version(); return this.intento() && this.form.tipo === 'otra' && !this.form.titulo.trim(); });

  private payload = computed<ReunionUpdate>(() => {
    this.version();
    return this.armarPayload();
  });
  sucio = computed(() => this.modoEdicion() && JSON.stringify(this.payload()) !== this.base());

  totalMinutos = computed(() => {
    this.version();
    return this.form.partes.reduce((s, p) => s + (p.minutos || 0), 0);
  });

  /**
   * Todas las personas que se pueden elegir: las de /personas y, por si ya no
   * están activas, las que la reunión ya tenía convocadas. Por grupo y nombre.
   */
  private personasSel = computed<PersonaSel[]>(() => {
    const m = new Map<number, PersonaSel>();
    for (const p of this.personas()) {
      m.set(p.id_publicador, { id: p.id_publicador, nombre: p.nombre, grupo: p.grupo, tiene_usuario: p.tiene_usuario, tiene_app: p.tiene_app, recibe_aviso: recibeAviso(p) });
    }
    for (const c of this.reunion()?.convocados ?? []) {
      if (!m.has(c.id_publicador)) {
        m.set(c.id_publicador, { id: c.id_publicador, nombre: c.nombre, grupo: c.grupo, tiene_usuario: c.tiene_usuario, tiene_app: c.tiene_app ?? false, recibe_aviso: recibeAviso(c) });
      }
    }
    return [...m.values()].sort((a, b) =>
      ORDEN_GRUPOS.indexOf(a.grupo) - ORDEN_GRUPOS.indexOf(b.grupo) || a.nombre.localeCompare(b.nombre, 'es'));
  });
  private personaPorId = computed(() => new Map(this.personasSel().map(p => [p.id, p])));

  /**
   * Responsables, oraciones y secretario se eligen entre los convocados. Si ya
   * había alguien asignado que no está convocado, sigue en la lista para no
   * perderlo.
   */
  opciones = computed<PickerOption[]>(() => {
    this.version();
    const f = this.form;
    const convocados = new Set(f.convocados);
    const asignados = new Set<number>(
      [f.id_secretario, f.id_oracion_inicial, f.id_oracion_final, ...f.partes.map(p => p.id_responsable)]
        .filter((id): id is number => !!id && !convocados.has(id)));
    const nombres = this.nombres();
    const lista: PickerOption[] = [];
    for (const p of this.personasSel()) {
      if (convocados.has(p.id)) lista.push({ value: p.id, label: p.nombre, hint: p.tiene_app ? undefined : 'No tiene la app' });
    }
    for (const id of convocados) {
      if (!this.personaPorId().has(id) && nombres.has(id)) lista.push({ value: id, label: nombres.get(id)! });
    }
    for (const id of asignados) {
      const n = nombres.get(id);
      if (n) lista.push({ value: id, label: n, hint: 'No está convocado' });
    }
    return lista;
  });

  /** Opciones del responsable de una parte: las comunes más, si se escribió a
   *  mano, una opción 'txt' con ese texto. Se guarda por parte y solo se
   *  rehace cuando cambian las opciones o el texto, para que la detección de
   *  cambios no reciba un arreglo nuevo en cada pasada. */
  private cacheResp = new Map<number, { base: PickerOption[]; texto: string; lista: PickerOption[] }>();
  opcionesResponsable(p: ParteForm): PickerOption[] {
    const base = this.opciones();
    const texto = p.id_responsable ? '' : p.responsable_texto.trim();
    const c = this.cacheResp.get(p.uid);
    if (c && c.base === base && c.texto === texto) return c.lista;
    const lista = texto ? [...base, { value: 'txt', label: texto, hint: 'No es de la congregación' }] : base;
    this.cacheResp.set(p.uid, { base, texto, lista });
    return lista;
  }
  valorResponsable(p: ParteForm): number | 'txt' | null {
    return p.id_responsable ?? (p.responsable_texto.trim() ? 'txt' : null);
  }
  cambiarResponsable(p: ParteForm, v: unknown) {
    if (v === 'txt') return;
    if (typeof v === 'number') { p.id_responsable = v; p.responsable_texto = ''; }
    else { p.id_responsable = null; p.responsable_texto = ''; }
    this.tocar();
  }
  responsableEscrito(p: ParteForm, texto: string) {
    p.id_responsable = null;
    p.responsable_texto = texto.trim().slice(0, 120);
    this.tocar();
  }

  /** «12 ancianos», «3 personas»; y cuántos no reciben el aviso. */
  resumenConvocados = computed(() => {
    this.version();
    const ids = this.form.convocados;
    const pers = ids.map(id => this.personaPorId().get(id)).filter((p): p is PersonaSel => !!p);
    const grupos = new Set(pers.map(p => p.grupo));
    const n = ids.length;
    const nombre: Record<GrupoPersona, [string, string]> = {
      anciano: ['anciano', 'ancianos'], siervo: ['siervo ministerial', 'siervos ministeriales'],
      precursor: ['precursor', 'precursores'], otro: ['persona', 'personas'],
    };
    const [uno, varios] = grupos.size === 1 && pers.length === n ? nombre[[...grupos][0]] : ['persona', 'personas'];
    return { texto: `${n} ${n === 1 ? uno : varios}`, sinAviso: pers.filter(p => !p.recibe_aviso).length };
  });

  /** La ventana de convocados: por grupo, filtrada por el grupo elegido y el buscador. */
  gruposSel = computed(() => {
    const q = normalizar(this.busquedaConv().trim());
    const sel = this.seleccion();
    const vista = this.grupoVista();
    const grupos = ORDEN_GRUPOS.map(g => ({ grupo: g, etiqueta: GRUPO_PERSONA_LABEL[g], personas: [] as PersonaSel[], elegidos: 0 }));
    for (const p of this.personasSel()) {
      if (vista === 'elegidos' ? !sel.has(p.id) : vista !== 'todos' && p.grupo !== vista) continue;
      if (q && !normalizar(p.nombre).includes(q)) continue;
      const g = grupos[ORDEN_GRUPOS.indexOf(p.grupo)] ?? grupos[3];
      g.personas.push(p);
      if (sel.has(p.id)) g.elegidos++;
    }
    return grupos.filter(g => g.personas.length);
  });
  /** Pestañas de la columna de grupos, con cuántos hay y cuántos están elegidos. */
  resumenGrupos = computed(() => {
    const sel = this.seleccion();
    const todas = this.personasSel();
    const fila = (id: VistaGrupo, etiqueta: string, ps: PersonaSel[]) =>
      ({ id, etiqueta, total: ps.length, elegidos: ps.filter(p => sel.has(p.id)).length });
    return [
      fila('todos', 'Todos', todas),
      ...ORDEN_GRUPOS.map(g => fila(g, GRUPO_PERSONA_LABEL[g], todas.filter(p => p.grupo === g))).filter(f => f.total),
      { id: 'elegidos' as VistaGrupo, etiqueta: 'Elegidos', total: sel.size, elegidos: sel.size },
    ];
  });
  /** Las personas que se ven ahora (para «Elegir todos»). */
  visiblesSel = computed(() => this.gruposSel().flatMap(g => g.personas));
  todosVisiblesElegidos = computed(() => this.visiblesSel().every(p => this.seleccion().has(p.id)));
  estadoVisibles = computed(() => {
    const n = this.visiblesSel().filter(p => this.seleccion().has(p.id)).length;
    return n === 0 ? 'ninguno' : n === this.visiblesSel().length ? 'todos' : 'algunos';
  });
  /** «a los 10 ancianos», «a los 3 encontrados», «a todos (114)». */
  textoVisibles = computed(() => {
    const n = this.visiblesSel().length;
    if (this.busquedaConv().trim()) return `los ${n} encontrados`;
    const v = this.grupoVista();
    if (v === 'todos' || v === 'elegidos') return `a todos (${n})`;
    return `${GRUPO_PERSONA_LABEL[v].toLowerCase()} (${n})`;
  });
  sinAvisoSeleccion = computed(() => {
    const m = this.personaPorId();
    return [...this.seleccion()].filter(id => m.get(id) && !m.get(id)!.recibe_aviso).length;
  });

  /** id → nombre para la vista previa: las personas de hoy y los ya guardados en la reunión. */
  private nombres = computed(() => {
    const m = new Map<number, string>();
    const r = this.reunion();
    if (r) {
      const par = (id: number | null, n: string | null) => { if (id && n) m.set(id, n); };
      par(r.id_publicador_secretario, r.secretario_nombre);
      par(r.id_publicador_oracion_inicial, r.oracion_inicial_nombre);
      par(r.id_publicador_oracion_final, r.oracion_final_nombre);
      r.partes.forEach(p => par(p.id_publicador_responsable, p.responsable_nombre));
    }
    r?.convocados.forEach(c => m.set(c.id_publicador, c.nombre));
    this.personas().forEach(a => m.set(a.id_publicador, a.nombre));
    return m;
  });

  documentoForm = computed<DocumentoReunion>(() => {
    this.version();
    const n = (id: number | null) => (id ? this.nombres().get(id) ?? null : null);
    const f = this.form;
    const tipo = tipoReunion(f.tipo);
    return {
      congregacion: this.reunion()?.congregacion_nombre ?? this.ctx.selectedCongregacionName() ?? null,
      titulo: f.titulo.trim() || tipo.titulo,
      tipoEtiqueta: tipo.etiqueta,
      fecha: f.fecha,
      hora: f.hora,
      lugar: f.lugar.trim() || null,
      secretario: n(f.id_secretario),
      oracionInicial: n(f.id_oracion_inicial),
      oracionFinal: n(f.id_oracion_final),
      partes: f.partes.map(p => ({
        titulo: p.titulo.trim(),
        responsable: n(p.id_responsable) ?? (p.responsable_texto.trim() || null),
        minutos: p.minutos,
        objetivo: p.objetivo.trim() || null,
        texto_biblico: p.texto_biblico.trim() || null,
        referencias: p.referencias.trim() || null,
        temas: lineas(p.temas),
        cancelada: p.cancelada,
      })),
      otrosTemas: lineas(f.otros_temas),
    };
  });

  documentoGuardado = computed<DocumentoReunion>(() => {
    const r = this.reunion();
    if (!r) return { congregacion: null, titulo: '', tipoEtiqueta: '', fecha: null, hora: null, lugar: null, secretario: null, oracionInicial: null, oracionFinal: null, partes: [] };
    return {
      congregacion: r.congregacion_nombre,
      titulo: r.titulo,
      tipoEtiqueta: r.tipo_etiqueta,
      fecha: r.fecha,
      hora: r.hora,
      lugar: r.lugar,
      secretario: r.secretario_nombre,
      oracionInicial: r.oracion_inicial_nombre,
      oracionFinal: r.oracion_final_nombre,
      partes: r.partes.filter(p => p.estado === 'aceptada').map(p => ({
        titulo: p.titulo,
        responsable: p.responsable_nombre,
        minutos: p.minutos,
        objetivo: p.objetivo,
        texto_biblico: p.texto_biblico,
        referencias: p.referencias,
        temas: p.temas ?? [],
        cancelada: p.cancelada,
      })),
      otrosTemas: r.otros_temas ?? [],
    };
  });

  /** Convocada pero sin primer aviso. */
  sinAvisar = computed(() => {
    const r = this.reunion();
    return !!r && r.estado === 'convocada' && !r.avisada_en;
  });

  /** A cuántos llega el aviso: los convocados con cuenta o con la app (y cuántos al teléfono). */
  avisoInfo = computed(() => {
    this.version();
    const lista = this.form.convocados.map(id => this.personaPorId().get(id)).filter((p): p is PersonaSel => !!p);
    const conAviso = lista.filter(a => a.recibe_aviso).length;
    const conApp = lista.filter(a => a.recibe_aviso && a.tiene_app).length;
    return { conAviso, conApp, sinAviso: this.form.convocados.length - conAviso };
  });

  mensajeConvocar = computed(() => {
    const { conAviso, conApp, sinAviso } = this.avisoInfo();
    const guardar = this.sucio() ? ' Antes se guardarán sus cambios.' : '';
    const personas = `${conAviso} ${conAviso === 1 ? 'persona convocada' : 'personas convocadas'} y al Coordinador y al Secretario`;
    let m = this.sinAvisar()
      ? `Todavía no se les ha avisado. Se avisará a ${personas}; podrán ver el programa y proponer puntos.`
      : `Se avisará a ${personas} que la reunión cambió.`;
    if (conApp) m += ` A ${conApp} también les llegará al teléfono.`;
    if (sinAviso) m += ` ${sinAviso} no ${sinAviso === 1 ? 'tiene' : 'tienen'} la app ni cuenta: avíseles usted.`;
    return m + guardar;
  });

  mensajeActa = computed(() => {
    const r = this.reunion();
    const futura = !!r && r.fecha > hoyIso();
    let m = this.puedeEditarActas
      ? 'Se creará el acta en el módulo de Actas, con las partes del programa, para que tome allí las notas de la reunión. El estado de la reunión no cambia.'
      : 'Se creará el acta en el módulo de Actas, con las partes del programa, para que el secretario tome allí las notas de la reunión. Usted seguirá en esta pantalla.';
    if (futura) m = 'La reunión todavía no se ha hecho. ' + m;
    if (this.sucio()) m += ' Antes se guardarán sus cambios.';
    return m;
  });

  ngOnInit() {
    this.svc.cargarConfig(this.congregacionAdmin()).subscribe({ error: () => {} });
    this.cargar();
  }

  /** Lo que significa el estado, para el título emergente del chip. */
  ayudaEstado(r: ReunionOut): string {
    if (r.estado === 'borrador') return 'Los convocados todavía no la ven. Cuando esté lista, use «Convocar».';
    if (r.estado === 'convocada' && !r.avisada_en) return 'Está confirmada, pero los convocados todavía no recibieron aviso.';
    if (r.estado === 'convocada') return `Los convocados ya recibieron el aviso${r.avisada_en ? ' el ' + this.convocadaTexto(r.avisada_en) : ''}.`;
    if (r.estado === 'cancelada') return 'La reunión se canceló. Puede reabrirla desde «Más acciones».';
    return 'Esta reunión ya se realizó.';
  }

  // ── Categorías ───────────────────────────────────────────────────────────

  private catPorId = computed(() => new Map(this.categorias().map(c => [c.id_categoria, c])));

  /** La de la parte: la elegida a mano o, si no, la que da su título (en vivo, mientras se escribe). */
  categoriaDe(p: ParteForm): CategoriaOut | null {
    if (p.categoria_manual && p.id_categoria) return this.catPorId().get(p.id_categoria) ?? null;
    return clasificarTitulo(p.titulo, this.categorias());
  }

  /** Las activas; la archivada que ya tenía la parte sigue a la vista para no perderla. */
  categoriasParaElegir(p: ParteForm): CategoriaOut[] {
    const actual = p.categoria_manual ? p.id_categoria : null;
    return this.categorias().filter(x => x.activa || x.id_categoria === actual);
  }

  cambiarCategoria(p: ParteForm, v: unknown) {
    if (v === 'auto' || v === null) { p.categoria_manual = false; p.id_categoria = null; }
    else if (typeof v === 'number') { p.categoria_manual = true; p.id_categoria = v; }
    this.tocar();
  }

  // ── ¿A quién asignar? ────────────────────────────────────────────────────

  sugerencia = signal<{ pedido: PedidoSugerencia; aplicar: (id: number) => void } | null>(null);

  /** Quiénes ya tienen algo en esta reunión (sin contar el lugar que se está llenando). */
  private ocupados(excepto: ParteForm | 'inicial' | 'final'): number[] {
    const f = this.form;
    const ids = [
      excepto === 'inicial' ? null : f.id_oracion_inicial,
      excepto === 'final' ? null : f.id_oracion_final,
      ...f.partes.filter(p => p !== excepto && !p.cancelada).map(p => p.id_responsable),
    ];
    return [...new Set(ids.filter((x): x is number => !!x))];
  }

  sugerirParte(p: ParteForm, i: number) {
    const cat = this.categoriaDe(p);
    if (!cat) { this.toast.info('Sin categorías', 'Cree las categorías de las partes para recibir sugerencias.'); return; }
    this.sugerencia.set({
      pedido: {
        idCategoria: cat.id_categoria, fecha: this.form.fecha, ocupados: this.ocupados(p), actual: p.id_responsable,
        para: `Parte ${i + 1}${p.titulo.trim() ? ': ' + p.titulo.trim() : ''}`,
      },
      aplicar: id => { p.id_responsable = id; p.responsable_texto = ''; },
    });
  }

  sugerirOracion(cual: 'inicial' | 'final') {
    const cat = this.categorias().find(c => c.clave === 'oracion');
    if (!cat) return;
    this.sugerencia.set({
      pedido: {
        idCategoria: cat.id_categoria, fecha: this.form.fecha, ocupados: this.ocupados(cual),
        actual: cual === 'inicial' ? this.form.id_oracion_inicial : this.form.id_oracion_final,
        para: cual === 'inicial' ? 'Oración inicial' : 'Oración final',
      },
      aplicar: id => { if (cual === 'inicial') this.form.id_oracion_inicial = id; else this.form.id_oracion_final = id; },
    });
  }

  aplicarSugerencia(id: number) {
    const s = this.sugerencia();
    if (!s) return;
    s.aplicar(id);
    this.sugerencia.set(null);
    this.tocar();
    const n = this.nombres().get(id);
    if (!this.form.convocados.includes(id)) {
      this.toast.info(`${n ?? 'La persona elegida'} no está convocada`, 'Añádala en «Convocados» para que reciba el aviso.');
    }
  }

  // ── Papeles ──────────────────────────────────────────────────────────────

  nombreSecretario = computed(() => {
    this.version();
    return this.form.id_secretario ? this.nombres().get(this.form.id_secretario) ?? null : null;
  });

  papelesResumen = computed(() => {
    this.version();
    const n = (id: number | null) => (id ? this.nombres().get(id) ?? 'Otra persona' : null);
    const r = this.reunion();
    return {
      tiempo: n(this.form.id_tiempo) ?? (r?.tiempo_nombre && !r.id_publicador_tiempo_propio ? r.tiempo_nombre : 'El coordinador'),
      notas: n(this.form.id_redactor) ?? this.nombreSecretario() ?? 'El secretario',
    };
  });

  porDefectoTiempo(): string {
    const r = this.reunion();
    return 'el coordinador' + (r?.tiempo_nombre && !this.form.id_tiempo ? ' (' + r.tiempo_nombre + ')' : '');
  }

  porDefectoNotas(): string {
    const n = this.nombreSecretario();
    return 'el secretario de la reunión' + (n ? ' (' + n + ')' : '');
  }

  /** Quien toma las notas: el elegido en la ventana o, si no hay, el secretario de la reunión. */
  private quienTomaNotas(): number | null {
    return this.papeles.redactor ?? this.form.id_secretario ?? null;
  }

  /**
   * Los convocados, sin quien toma las notas (ya puede escribir todo): de ellos
   * se eligen los colaboradores. Es un método y no un computed porque depende de
   * la selección de la ventana, que no es una señal.
   */
  candidatosColaborar(): { id: number; label: string }[] {
    const convocados = new Set(this.form.convocados);
    const redactor = this.quienTomaNotas();
    return this.opciones()
      .filter(o => typeof o.value === 'number' && convocados.has(o.value) && o.value !== redactor)
      .map(o => ({ id: o.value as number, label: o.label }));
  }

  abrirPapeles() {
    this.papeles = { tiempo: this.form.id_tiempo, redactor: this.form.id_redactor, colaboradores: new Set(this.form.colaboradores) };
    this.papelesAbierto.set(true);
  }

  alternarColaborador(id: number) {
    const c = this.papeles.colaboradores;
    if (c.has(id)) c.delete(id); else c.add(id);
  }

  aplicarPapeles() {
    this.form.id_tiempo = this.papeles.tiempo ?? null;
    this.form.id_redactor = this.papeles.redactor ?? null;
    const redactor = this.quienTomaNotas();
    this.form.colaboradores = ordenar([...this.papeles.colaboradores].filter(id => id !== redactor));
    this.papelesAbierto.set(false);
    this.tocar();
  }

  // ── Menú «Más acciones» ──────────────────────────────────────────────────

  cerrarMenuSiSale(e: FocusEvent) {
    const siguiente = e.relatedTarget as Node | null;
    if (!siguiente || !(e.currentTarget as HTMLElement).contains(siguiente)) this.menuAbierto.set(false);
  }

  /** La congregación usa la reunión en vivo (apagado por defecto). */
  readonly usarEnVivo = this.svc.usarEnVivo;

  /** Lo siguiente que toca hacer con la reunión, a un toque en la cabecera; lo demás queda en «Más acciones». */
  siguientePaso = computed<{ clave: PasoSiguiente; texto: string; icono: string } | null>(() => {
    const r = this.reunion();
    if (!r || this.esNueva()) return null;
    const hoy = hoyIso();
    if (r.estado === 'borrador') return { clave: 'convocar', texto: 'Convocar', icono: 'send' };
    if (this.sinAvisar()) return { clave: 'avisar', texto: 'Avisar', icono: 'send' };
    if (r.estado === 'en_curso' || (this.usarEnVivo() && r.estado === 'convocada' && r.fecha === hoy)) {
      return { clave: 'vivo', texto: r.estado === 'en_curso' ? 'Volver a la reunión' : 'Abrir en vivo', icono: 'play' };
    }
    if (r.id_acta && this.puedeEditarActas) return { clave: 'abrir-acta', texto: 'Abrir el acta', icono: 'book-open' };
    if (r.id_acta && r.puedo_leer_acta) return { clave: 'leer-acta', texto: 'Leer el acta', icono: 'book-open' };
    if (r.puedo_pasar_a_acta && !r.id_acta && r.fecha <= hoy) return { clave: 'acta', texto: 'Generar el acta', icono: 'book-open' };
    return null;
  });

  /**
   * «Iniciar en vivo» a la vista mientras la reunión está convocada (cualquier día):
   * antes solo salía como botón principal el mismo día y el resto del tiempo quedaba
   * escondido en «Más acciones». Si ya es el botón principal, no se repite.
   */
  puedeIniciarEnVivo = computed(() => {
    const r = this.reunion();
    return !!r && !this.esNueva() && this.usarEnVivo() && r.estado === 'convocada' && this.siguientePaso()?.clave !== 'vivo';
  });

  hacerSiguiente(clave: PasoSiguiente) {
    const r = this.reunion();
    if (!r) return;
    switch (clave) {
      case 'convocar': case 'avisar': this.pedirConvocar(); break;
      case 'vivo': this.router.navigate(['/administracion/reuniones-teocraticas', r.id_reunion, 'en-vivo']); break;
      case 'acta': this.confirmar.set('acta'); break;
      case 'abrir-acta': this.router.navigate(['/administracion/actas-reunion', r.id_acta]); break;
      case 'leer-acta': this.leerActa(); break;
    }
  }

  async accionMenu(accion: 'preparar' | 'duplicar' | 'avisar' | 'acta' | 'vivo' | 'cancelar' | 'reabrir' | 'eliminar') {
    this.menuAbierto.set(false);
    if (accion === 'avisar') { this.pedirConvocar(); return; }
    if (accion === 'acta') { this.confirmar.set('acta'); return; }
    if (accion === 'vivo') { this.hacerSiguiente('vivo'); return; }
    if (accion === 'eliminar') { this.confirmar.set('eliminar'); return; }
    if (accion === 'cancelar') { this.confirmar.set('cancelar'); return; }
    if (!this.id) return;
    if (this.sucio() && !(await this.guardar())) return;
    if (accion === 'preparar') { this.router.navigate(['/administracion/reuniones-teocraticas', this.id, 'preparar']); return; }
    if (accion === 'reabrir') { this.reabrir(); return; }
    this.duplicar();
  }

  mensajeCancelar = computed(() => {
    const r = this.reunion();
    const avisada = !!r?.avisada_en;
    return avisada
      ? 'Se avisará a los convocados que la reunión se canceló. Podrá reabrirla más adelante.'
      : 'Nadie ha recibido aviso de esta reunión, así que no se avisará a nadie. Podrá reabrirla más adelante.';
  });

  cancelarReunion() {
    if (!this.id) return;
    this.accionando.set(true);
    this.svc.cancelar(this.id, true).subscribe({
      next: res => {
        this.accionando.set(false);
        this.confirmar.set(null);
        this.reunion.set(res.reunion);
        this.toast.success('Reunión cancelada', res.notificados ? `Se avisó a ${res.notificados} ${res.notificados === 1 ? 'persona' : 'personas'}.` : undefined);
      },
      error: (e: HttpErrorResponse) => {
        this.accionando.set(false);
        this.toast.error('No se pudo cancelar', detalle(e) ?? 'Intente de nuevo en un momento.');
      },
    });
  }

  private reabrir() {
    this.accionando.set(true);
    this.svc.reabrir(this.id!).subscribe({
      next: r => {
        this.accionando.set(false);
        this.reunion.set(r);
        this.toast.success('Reunión reabierta', r.estado === 'convocada' ? 'Si cambió algo, use «Avisar de los cambios».' : 'Sigue en borrador.');
      },
      error: (e: HttpErrorResponse) => {
        this.accionando.set(false);
        this.toast.error('No se pudo reabrir', detalle(e) ?? 'Intente de nuevo en un momento.');
      },
    });
  }

  private duplicar() {
    this.accionando.set(true);
    this.svc.duplicar(this.id!).subscribe({
      next: r => {
        this.accionando.set(false);
        this.toast.success('Reunión duplicada', 'Es un borrador con el mismo programa: revise la fecha y asigne las partes.', 7000);
        this.router.navigate(['/administracion/reuniones-teocraticas', r.id_reunion]).then(() => this.cargar());
      },
      error: (e: HttpErrorResponse) => {
        this.accionando.set(false);
        this.toast.error('No se pudo duplicar', detalle(e) ?? 'Intente de nuevo en un momento.');
      },
    });
  }

  // ── Carga ────────────────────────────────────────────────────────────────

  cargar() {
    const param = this.route.snapshot.paramMap.get('id');
    this.cargando.set(true);
    this.errorCarga.set(null);
    this.conflicto.set(false);

    if (param === 'nueva') {
      if (!puedeGestionarReunionesAncianos(this.store)) { this.irALista(); return; }
      this.esNueva.set(true);
      // El Administrador crea en la congregación del selector: con «Todas» el servidor no sabe dónde.
      if (this.store.isAdministrador() && this.congregacionAdmin() === null) {
        this.errorCarga.set('sin-congregacion');
        this.cargando.set(false);
        return;
      }
      this.cargarNueva();
      return;
    }

    this.id = Number(param);
    if (!Number.isInteger(this.id) || this.id <= 0) {
      this.errorCarga.set('no-encontrada');
      this.cargando.set(false);
      return;
    }
    this.svc.get(this.id).subscribe({
      next: r => {
        // Quien no gestiona ve la reunión como «Mi preparación».
        if (!r.puedo_editar) {
          this.saliendo = true;
          this.router.navigate(['/administracion/reuniones-teocraticas', r.id_reunion, 'preparar'], { replaceUrl: true });
          return;
        }
        this.reunion.set(r);
        this.cargarPersonas(r.id_congregacion);
        this.cargarCategorias(this.store.isAdministrador() ? r.id_congregacion : null);
        this.llenarForm(r);
        this.cargando.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.errorCarga.set(e.status === 404 || e.status === 403 ? 'no-encontrada' : 'error');
        this.cargando.set(false);
      },
    });
  }

  /** Nueva: prellena hora, lugar, secretario y convocados del tipo con /sugerencia. */
  private cargarNueva() {
    const idCong = this.congregacionAdmin();
    this.cargarPersonas(idCong);
    this.cargarCategorias(idCong);
    this.form = this.formVacio();
    this.convocadosEditados = false;
    this.svc.sugerencia(idCong, this.form.tipo).subscribe({
      next: s => {
        this.form.hora = s.hora ? s.hora.slice(0, 5) : null;
        this.form.lugar = s.lugar ?? '';
        this.form.id_secretario = s.id_publicador_secretario ?? null;
        this.form.convocados = ordenar(s.convocados ?? []);
        this.marcarLimpio();
        this.cargando.set(false);
      },
      error: () => { this.marcarLimpio(); this.cargando.set(false); },
    });
  }

  private cargarCategorias(idCong: number | null) {
    this.svc.categorias(idCong).subscribe({ next: c => this.categorias.set(c), error: () => this.categorias.set([]) });
  }

  private cargarPersonas(idCong: number | null) {
    this.svc.personas(null, this.store.isAdministrador() ? idCong : null).subscribe({
      next: a => this.personas.set(a),
      error: () => this.toast.error('No se pudo cargar la lista de publicadores', 'No podrá cambiar los convocados. Recargue la página.'),
    });
  }

  // ── Tipo y convocados ────────────────────────────────────────────────────

  /** En una reunión nueva, el tipo trae sus convocados; si ya se cambiaron a mano, se pregunta. */
  cambiarTipo(tipo: TipoReunion | null) {
    if (!tipo || tipo === this.form.tipo) return;
    this.form.tipo = tipo;
    this.tocar();
    if (tipo === 'otra') setTimeout(() => document.getElementById('ra-titulo-reunion')?.focus());
    if (!this.esNueva()) return;
    if (this.convocadosEditados) {
      this.tipoPendiente = tipo;
      this.confirmar.set('cambiar-tipo');
      return;
    }
    this.cargarConvocadosDelTipo(tipo);
  }

  resolverCambioTipo(poner: boolean) {
    this.confirmar.set(null);
    const tipo = this.tipoPendiente;
    this.tipoPendiente = null;
    if (poner && tipo) this.cargarConvocadosDelTipo(tipo);
  }

  private cargarConvocadosDelTipo(tipo: TipoReunion) {
    this.cargandoConvocados.set(true);
    this.svc.sugerencia(this.congregacionAdmin(), tipo).subscribe({
      next: s => {
        this.cargandoConvocados.set(false);
        if (this.form.tipo !== tipo) return;
        this.form.convocados = ordenar(s.convocados ?? []);
        this.convocadosEditados = false;
        this.tocar();
      },
      error: () => {
        this.cargandoConvocados.set(false);
        this.toast.error('No se pudo cargar la lista del tipo', 'Elija los convocados con «Cambiar».');
      },
    });
  }

  abrirConvocados() {
    this.seleccion.set(new Set(this.form.convocados));
    this.busquedaConv.set('');
    this.grupoVista.set('todos');
    this.convocadosAbierto.set(true);
    setTimeout(() => document.getElementById('conv-buscar')?.focus(), 50);
  }

  alternar(id: number) {
    this.seleccion.update(s => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  elegidosEn(personas: PersonaSel[]): number {
    const sel = this.seleccion();
    return personas.reduce((n, p) => n + (sel.has(p.id) ? 1 : 0), 0);
  }

  marcarGrupo(personas: PersonaSel[], marcar: boolean) {
    this.seleccion.update(s => {
      const n = new Set(s);
      personas.forEach(p => (marcar ? n.add(p.id) : n.delete(p.id)));
      return n;
    });
  }

  aplicarConvocados() {
    const nuevos = ordenar([...this.seleccion()]);
    this.convocadosAbierto.set(false);
    if (JSON.stringify(nuevos) === JSON.stringify(this.form.convocados)) return;
    this.form.convocados = nuevos;
    this.convocadosEditados = true;
    this.tocar();
  }

  /** El Administrador no tiene congregación propia: usa la del selector del portal. */
  congregacionAdmin(): number | null {
    return this.store.isAdministrador() ? this.ctx.effectiveCongregacionId() : null;
  }

  recargar() {
    this.saliendo = false;
    this.cargar();
  }

  irALista() {
    this.router.navigate(['/administracion/reuniones-teocraticas']);
  }

  // ── Formulario ───────────────────────────────────────────────────────────

  tocar() {
    this.version.update(v => v + 1);
  }

  private marcarLimpio() {
    this.tocar();
    this.base.set(JSON.stringify(this.armarPayload()));
  }

  private formVacio(): FormReunion {
    return {
      tipo: 'ancianos', titulo: '', convocados: [], fecha: null, hora: null, lugar: '', id_secretario: null,
      id_oracion_inicial: null, id_oracion_final: null, partes: [], otros_temas: '', id_tiempo: null, id_redactor: null, colaboradores: [],
    };
  }

  private llenarForm(r: ReunionOut) {
    this.form = {
      tipo: r.tipo ?? 'ancianos',
      titulo: r.titulo_propio ?? '',
      convocados: ordenar((r.convocados ?? []).map(c => c.id_publicador)),
      fecha: r.fecha,
      hora: r.hora ? r.hora.slice(0, 5) : null,
      lugar: r.lugar ?? '',
      id_secretario: r.id_publicador_secretario,
      id_oracion_inicial: r.id_publicador_oracion_inicial,
      id_oracion_final: r.id_publicador_oracion_final,
      partes: r.partes.filter(p => p.estado === 'aceptada').map(p => this.parteForm(p)),
      otros_temas: (r.otros_temas ?? []).join('\n'),
      id_tiempo: r.id_publicador_tiempo_propio ?? null,
      id_redactor: r.id_publicador_redactor_propio ?? null,
      colaboradores: ordenar(r.colaboradores ?? []),
    };
    this.intento.set(false);
    this.marcarLimpio();
  }

  private parteForm(p?: ParteOut): ParteForm {
    return {
      uid: ++this.uid,
      id_parte: p?.id_parte ?? null,
      titulo: p?.titulo ?? '',
      id_responsable: p?.id_publicador_responsable ?? null,
      responsable_texto: p?.id_publicador_responsable ? '' : (p?.responsable_texto ?? ''),
      minutos: p?.minutos ?? null,
      objetivo: p?.objetivo ?? '',
      texto_biblico: p?.texto_biblico ?? '',
      referencias: p?.referencias ?? '',
      temas: (p?.temas ?? []).join('\n'),
      id_categoria: p?.categoria_manual ? p.id_categoria : null,
      categoria_manual: !!p?.categoria_manual,
      nota_asignado: p?.nota_asignado ?? '',
      cancelada: !!p?.cancelada,
      abierta: false,
      masCampos: !!(p?.referencias?.trim() || p?.temas?.length || p?.categoria_manual || p?.cancelada),
    };
  }

  private armarPayload(): ReunionUpdate {
    const f = this.form;
    const texto = (v: string) => v.trim() || null;
    return {
      tipo: f.tipo,
      titulo: texto(f.titulo),
      convocados: [...f.convocados],
      fecha: f.fecha ?? '',
      hora: f.hora || null,
      lugar: texto(f.lugar),
      id_publicador_secretario: f.id_secretario,
      id_publicador_oracion_inicial: f.id_oracion_inicial,
      id_publicador_oracion_final: f.id_oracion_final,
      partes: f.partes.map<ParteIn>(p => ({
        id_parte: p.id_parte,
        titulo: p.titulo.trim(),
        id_publicador_responsable: p.id_responsable,
        responsable_texto: p.id_responsable ? null : texto(p.responsable_texto),
        minutos: p.minutos,
        objetivo: texto(p.objetivo),
        texto_biblico: texto(p.texto_biblico),
        referencias: texto(p.referencias),
        temas: lineas(p.temas),
        id_categoria: p.categoria_manual ? p.id_categoria : null,
        categoria_manual: p.categoria_manual,
        nota_asignado: texto(p.nota_asignado),
        cancelada: p.cancelada,
      })),
      otros_temas: lineas(f.otros_temas),
      id_publicador_tiempo: f.id_tiempo,
      id_publicador_redactor: f.id_redactor,
      colaboradores: [...f.colaboradores],
    };
  }

  detallesLlenos(p: ParteForm): number {
    return [p.objetivo, p.texto_biblico, p.referencias, p.temas, p.nota_asignado].filter(v => v.trim()).length;
  }

  /** Tipos con nombre propio (perla, nombramiento…): un toque añade la parte ya titulada y clasificada. */
  otrosAbierto = signal(false);
  abrirOtros() {
    this.otrosAbierto.set(true);
    setTimeout(() => document.getElementById('ra-otros')?.focus());
  }

  /** La perla se llama «Perla espiritual» en el programa; las demás, como su categoría. */
  tituloDe(c: CategoriaOut): string { return c.clave === 'perla' ? 'Perla espiritual' : c.etiqueta; }

  rapidas = computed(() => this.categorias().filter(c => c.activa && !c.es_sistema && !c.por_defecto));

  /** Sin tipo: una parte en blanco. Con tipo: ya lleva su título y categoría, y el foco pasa al responsable. */
  anadirParte(tipo?: CategoriaOut) {
    const nueva = this.parteForm();
    if (tipo) {
      nueva.titulo = this.tituloDe(tipo);
      nueva.id_categoria = tipo.id_categoria;
      nueva.categoria_manual = true;
    }
    this.form.partes.push(nueva);
    this.tocar();
    const n = this.form.partes.length;
    setTimeout(() => {
      const resp = tipo ? document.querySelector<HTMLElement>(`[aria-label="Responsable de la parte ${n}"]`) : null;
      (resp ?? document.getElementById(`ra-titulo-${nueva.uid}`))?.focus();
    });
  }

  /** Mueve la parte y deja el foco en el mismo botón, para seguir moviéndola con el teclado. */
  mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    const partes = this.form.partes;
    if (j < 0 || j >= partes.length) return;
    [partes[i], partes[j]] = [partes[j], partes[i]];
    this.tocar();
    const uid = partes[j].uid;
    setTimeout(() => {
      const propio = document.getElementById(`ra-${dir < 0 ? 'subir' : 'bajar'}-${uid}`) as HTMLButtonElement | null;
      const otro = document.getElementById(`ra-${dir < 0 ? 'bajar' : 'subir'}-${uid}`) as HTMLButtonElement | null;
      (propio && !propio.disabled ? propio : otro)?.focus();
    });
  }

  /** Una parte vacía se quita sin preguntar; con algo escrito, se confirma. */
  pedirQuitar(i: number) {
    const p = this.form.partes[i];
    if (!p.titulo.trim() && !this.detallesLlenos(p) && !p.id_responsable && !p.responsable_texto.trim() && !p.minutos) {
      this.indiceAQuitar = i;
      this.quitarParte();
      return;
    }
    this.indiceAQuitar = i;
    this.parteAQuitarTitulo.set(p.titulo.trim());
    this.confirmar.set('quitar-parte');
  }

  quitarParte() {
    if (this.indiceAQuitar !== null) this.form.partes.splice(this.indiceAQuitar, 1);
    this.indiceAQuitar = null;
    this.confirmar.set(null);
    this.tocar();
  }

  sumarMinutos(p: ParteForm, delta: number) {
    this.fijarMinutos(p, (p.minutos || 0) + delta);
  }

  fijarMinutos(p: ParteForm, valor: number | string | null) {
    const n = Number(valor);
    p.minutos = valor === null || valor === '' || !Number.isFinite(n) || n <= 0 ? null : Math.min(MIN_MAX, Math.round(n));
    this.tocar();
  }

  // ── Guardar ──────────────────────────────────────────────────────────────

  private validar(): boolean {
    this.intento.set(true);
    if (!this.form.fecha) {
      this.pestana.set('editar');
      this.toast.warning('Falta la fecha', 'Elija la fecha de la reunión para poder guardarla.');
      return false;
    }
    if (this.form.tipo === 'otra' && !this.form.titulo.trim()) {
      this.pestana.set('editar');
      this.toast.warning('Falta el título', 'En «Otra reunión» escriba el título, para que todos sepan de qué se trata.');
      setTimeout(() => document.getElementById('ra-titulo-reunion')?.focus());
      return false;
    }
    const sinTitulo = this.form.partes.find(p => !p.titulo.trim());
    if (sinTitulo) {
      this.pestana.set('editar');
      this.toast.warning('Falta un título', 'Cada parte necesita un título. Escríbalo o quite la parte.');
      setTimeout(() => document.getElementById(`ra-titulo-${sinTitulo.uid}`)?.focus());
      return false;
    }
    return true;
  }

  /** true si quedó guardado (o no había nada que guardar). */
  async guardar(): Promise<boolean> {
    if (!this.modoEdicion()) return true;
    if (!this.sucio() && !this.esNueva()) return true;
    if (this.ocupado() || !this.validar()) return false;

    const datos = this.armarPayload();
    this.guardando.set(true);
    try {
      if (this.esNueva()) {
        const idCong = this.congregacionAdmin();
        const r = await lastValueFrom(this.svc.create({ ...datos, ...(idCong ? { id_congregacion: idCong } : {}) }));
        this.reunion.set(r);
        this.id = r.id_reunion;
        this.esNueva.set(false);
        this.base.set(JSON.stringify(datos));
        this.toast.success('Reunión creada', 'Todavía es un borrador: los convocados no la ven hasta que la convoque.');
        this.router.navigate(['/administracion/reuniones-teocraticas', r.id_reunion], { replaceUrl: true });
      } else {
        const r = await lastValueFrom(this.svc.update(this.id!, {
          ...datos, esperado_actualizado_en: this.reunion()?.actualizado_en,
        }));
        this.reunion.set(r);
        this.base.set(JSON.stringify(datos));
        this.toast.success('Cambios guardados');
      }
      this.intento.set(false);
      return true;
    } catch (e) {
      const err = e as HttpErrorResponse;
      if (err.status === 409) {
        this.conflicto.set(true);
        this.toast.warning('No se guardó', 'Otra persona cambió esta reunión. Cargue la versión nueva.');
      } else {
        this.toast.error('No se pudo guardar', detalle(err) ?? 'Revise su conexión e intente de nuevo.');
      }
      return false;
    } finally {
      this.guardando.set(false);
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && this.modoEdicion()) {
      e.preventDefault();
      this.guardar();
    }
  }

  /** Cerrar la pestaña o recargar con cambios: el navegador pide confirmación. */
  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(e: BeforeUnloadEvent) {
    if (this.sucio() && !this.saliendo) e.preventDefault();
  }

  /** Lo llama el canDeactivate de la ruta: cubre el menú lateral, no solo «Volver». */
  puedeSalir(): boolean | Promise<boolean> {
    if (this.saliendo || !this.sucio()) return true;
    this.confirmar.set('salir');
    return new Promise<boolean>(resolve => { this.salidaPendiente = resolve; });
  }

  resolverSalida(salir: boolean) {
    this.confirmar.set(null);
    this.salidaPendiente?.(salir);
    this.salidaPendiente = null;
  }

  // ── Acciones ─────────────────────────────────────────────────────────────

  async descargarPdf() {
    if (!this.id || this.descargando()) return;
    // El PDF sale de lo guardado: si hay cambios, primero se guardan.
    if (this.sucio() && !(await this.guardar())) return;
    this.descargando.set(true);
    this.svc.exportarPdf(this.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Reunion_${this.reunion()?.tipo ?? 'organizacion'}_${this.reunion()?.fecha ?? this.id}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
        this.descargando.set(false);
      },
      error: () => {
        this.descargando.set(false);
        this.toast.error('No se pudo descargar el PDF', 'Intente de nuevo en un momento.');
      },
    });
  }

  pedirConvocar() {
    if (!this.form.partes.length) {
      this.toast.warning('El programa está vacío', 'Añada al menos una parte antes de convocar.');
      return;
    }
    if (!this.form.convocados.length) {
      this.toast.warning('No hay convocados', 'Elija a quiénes se convoca con «Elegir», junto a «Convocados».');
      return;
    }
    this.confirmar.set('convocar');
  }

  async convocar(avisar = true) {
    this.confirmar.set(null);
    if (!this.id || this.accionando()) return;
    if (this.sucio() && !(await this.guardar())) return;
    const primera = this.reunion()?.estado !== 'convocada';
    this.accionando.set(true);
    this.svc.convocar(this.id, avisar).subscribe({
      next: res => {
        this.reunion.set(res.reunion);
        this.accionando.set(false);
        const n = res.notificados;
        if (!avisar) {
          this.toast.success('Reunión convocada', 'Todavía no se avisó a nadie.', 7000);
          return;
        }
        const desc = res.sin_app
          ? `${res.sin_app} ${res.sin_app === 1 ? 'no tiene' : 'no tienen'} la app: lo verán en el portal, o avíseles por teléfono.`
          : undefined;
        this.toast.success(
          primera ? `Reunión convocada y avisada a ${n} ${n === 1 ? 'persona' : 'personas'}` : `Se avisó a ${n} ${n === 1 ? 'persona' : 'personas'}`,
          desc, 7000);
      },
      error: (e: HttpErrorResponse) => {
        this.accionando.set(false);
        this.toast.error('No se pudo convocar', detalle(e) ?? 'Intente de nuevo en un momento.');
      },
    });
  }

  async pasarAActa() {
    this.confirmar.set(null);
    if (!this.id || this.accionando()) return;
    if (this.sucio() && !(await this.guardar())) return;
    this.accionando.set(true);
    this.svc.pasarAActa(this.id).subscribe({
      next: res => {
        this.accionando.set(false);
        // Solo el secretario (o el administrador) toma las notas en Actas: los demás se quedan aquí.
        if (this.puedeEditarActas) {
          this.saliendo = true;
          this.toast.success(res.creada ? 'Acta creada' : 'Esta reunión ya tenía acta', 'Tome allí las notas de la reunión.');
          this.router.navigate(['/administracion/actas-reunion', res.id_acta]);
          return;
        }
        this.toast.success(res.creada ? 'Acta creada' : 'Esta reunión ya tenía acta', 'El secretario tomará allí las notas de la reunión.');
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.accionando.set(false);
        this.toast.error('No se pudo generar el acta', detalle(e) ?? 'Intente de nuevo en un momento.');
      },
    });
  }

  /** Abre la carta del acta (PDF) en otra pestaña: el documento final, no la pantalla de gestión. */
  leerActa() {
    if (!this.id || this.leyendoActa()) return;
    // Se abre la pestaña ya, en el clic, para que el navegador no bloquee la ventana emergente.
    const ventana = window.open('', '_blank');
    this.leyendoActa.set(true);
    this.svc.cartaActa(this.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        if (ventana) ventana.location.href = url;
        else window.location.href = url;
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

  eliminar() {
    this.confirmar.set(null);
    if (!this.id || this.accionando()) return;
    this.accionando.set(true);
    this.svc.remove(this.id).subscribe({
      next: () => {
        this.accionando.set(false);
        this.saliendo = true;
        this.toast.success('Reunión eliminada');
        this.irALista();
      },
      error: (e: HttpErrorResponse) => {
        this.accionando.set(false);
        this.toast.error('No se pudo eliminar', detalle(e) ?? 'Intente de nuevo en un momento.');
      },
    });
  }

  // ── Propuestas ───────────────────────────────────────────────────────────

  /**
   * Aceptar cambia las partes en el servidor (y su actualizado_en), así que
   * se vuelve a leer la reunión. La parte nueva se añade también al
   * formulario: si no había cambios, sigue «todo guardado».
   */
  aceptar(p: ParteOut) {
    if (!this.id) return;
    this.procesandoParte.set(p.id_parte);
    this.svc.aceptarParte(this.id, p.id_parte).subscribe({
      next: parte => {
        const estabaLimpio = !this.sucio();
        this.form.partes.push(this.parteForm(parte));
        if (estabaLimpio) this.marcarLimpio(); else this.tocar();
        // Hasta tener la versión nueva (su actualizado_en) no se deja guardar.
        this.svc.get(this.id!).subscribe({
          next: r => { this.reunion.set(r); this.procesandoParte.set(null); },
          error: () => this.procesandoParte.set(null),
        });
        this.toast.success('Punto añadido al programa', 'Quedó al final. Puede moverlo y completarlo.');
      },
      error: (e: HttpErrorResponse) => {
        this.procesandoParte.set(null);
        this.toast.error('No se pudo aceptar el punto', detalle(e) ?? 'Intente de nuevo.');
      },
    });
  }

  pedirDescartar(p: ParteOut) {
    this.propuestaADescartar.set(p);
    this.confirmar.set('descartar');
  }

  descartar() {
    const p = this.propuestaADescartar();
    this.confirmar.set(null);
    if (!p || !this.id) return;
    this.procesandoParte.set(p.id_parte);
    this.svc.eliminarParte(this.id, p.id_parte).subscribe({
      next: () => {
        this.reunion.update(r => r ? { ...r, partes: r.partes.filter(x => x.id_parte !== p.id_parte) } : r);
        this.procesandoParte.set(null);
        this.propuestaADescartar.set(null);
        this.toast.success(this.modoEdicion() ? 'Punto descartado' : 'Propuesta retirada');
      },
      error: (e: HttpErrorResponse) => {
        this.procesandoParte.set(null);
        this.toast.error('No se pudo quitar', detalle(e) ?? 'Intente de nuevo.');
      },
    });
  }

  abrirProponer() {
    this.propuesta = { titulo: '', objetivo: '', minutos: null };
    this.proponerAbierto.set(true);
    setTimeout(() => document.getElementById('prop-titulo')?.focus(), 50);
  }

  enviarPropuesta() {
    const titulo = this.propuesta.titulo.trim();
    if (!titulo || !this.id || this.enviandoPropuesta()) return;
    const min = Number(this.propuesta.minutos);
    this.enviandoPropuesta.set(true);
    this.svc.proponer(this.id, {
      titulo,
      objetivo: this.propuesta.objetivo.trim() || null,
      minutos: Number.isFinite(min) && min > 0 ? Math.min(MIN_MAX, Math.round(min)) : null,
    }).subscribe({
      next: parte => {
        this.reunion.update(r => r ? { ...r, partes: [...r.partes, parte] } : r);
        this.enviandoPropuesta.set(false);
        this.proponerAbierto.set(false);
        this.toast.success('Propuesta enviada', 'El coordinador y el secretario ya la pueden ver.');
      },
      error: (e: HttpErrorResponse) => {
        this.enviandoPropuesta.set(false);
        this.toast.error('No se pudo enviar la propuesta', detalle(e) ?? 'Intente de nuevo.');
      },
    });
  }

  convocadaTexto(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  }
}

/** Ids de menor a mayor y sin repetir. */
function ordenar(ids: number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b);
}

/** Minúsculas y sin tildes, para que «jose» encuentre «José». */
function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Una línea por tema, sin las vacías. */
function lineas(texto: string): string[] {
  return texto.split('\n').map(t => t.trim()).filter(Boolean);
}

/** El `detail` de FastAPI cuando es un texto legible. */
function detalle(e: HttpErrorResponse): string | null {
  const d = e?.error?.detail;
  return typeof d === 'string' ? d : null;
}
