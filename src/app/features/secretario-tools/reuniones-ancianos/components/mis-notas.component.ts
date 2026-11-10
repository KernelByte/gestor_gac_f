import {
  Component, computed, ElementRef, EventEmitter, inject, Input, OnChanges, OnDestroy, Output, signal, SimpleChanges, ViewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HttpErrorResponse } from '@angular/common/http';
import { ReunionAncianosService } from '../../services/reunion-ancianos.service';
import { NotaPersonal } from '../../models/reunion-ancianos.model';
import { LucideAngularModule } from '../../../../shared/icons';
import { AutosizeTextareaDirective } from '../../../../shared/directives/autosize-textarea.directive';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { markdownSimpleAHtml } from '../../../../shared/utils/markdown-simple';

type EstadoGuardado = 'listo' | 'pendiente' | 'guardando' | 'guardado' | 'error';

/** ![pie](imagen:12): la marca que cita una imagen dentro del texto. */
const MARCA_IMAGEN = /!\[([^\]\n]*)\]\(imagen:(\d+)\)/g;

/** Piezas listas para insertar: el hermano elige y escribe dentro. */
const ELEMENTOS: { clave: string; titulo: string; ayuda: string; icono: string; texto: string; cursor: number }[] = [
  { clave: 'bosquejo', titulo: 'Bosquejo', ayuda: 'Introducción, puntos principales y conclusión', icono: 'list-ordered',
    texto: '## Introducción\n\n\n## Puntos principales\n- \n- \n\n## Conclusión\n', cursor: 16 },
  { clave: 'leer', titulo: 'Texto para leer', ayuda: 'Un versículo o un párrafo que va a leer', icono: 'book-open',
    texto: '> **Leer:** ', cursor: 12 },
  { clave: 'pregunta', titulo: 'Pregunta para los hermanos', ayuda: 'Para hacer participar o pensar', icono: 'help-circle',
    texto: '> **Pregunta:** ', cursor: 16 },
  { clave: 'clave', titulo: 'Punto clave', ayuda: 'Lo que no se debe olvidar', icono: 'star',
    texto: '**Punto clave:** ', cursor: 17 },
  { clave: 'ejemplo', titulo: 'Ejemplo o ilustración', ayuda: 'Una experiencia o comparación', icono: 'lightbulb',
    texto: '**Ejemplo:** ', cursor: 13 },
  { clave: 'separador', titulo: 'Separador', ayuda: 'Una línea para dividir secciones', icono: 'minus',
    texto: '---\n', cursor: 4 },
];

/**
 * «Mis notas» de una reunión (la general) o de una parte: privadas, solo las
 * ve quien las escribe. Se guardan solas al dejar de escribir y al salir del
 * campo.
 *
 * Formato simple (markdown) que la barra pone por usted: títulos, negrita,
 * listas, citas, enlaces, elementos listos (bosquejo, pregunta, texto para
 * leer…) e imágenes, que se suben aparte y el texto cita con ![pie](imagen:ID).
 *
 * - Normal: con texto y sin foco se ve con formato; un toque vuelve a editar.
 * - Amplia: para preparar la propia parte. Pestañas «Escribir · Ver cómo queda»
 *   y un área grande.
 */
@Component({
  selector: 'app-mis-notas',
  standalone: true,
  host: { '[class.llenar]': 'llenar' },
  imports: [NgTemplateOutlet, LucideAngularModule, AutosizeTextareaDirective],
  template: `
  <div class="mn" [class.mn-compacta]="compacta" [class.mn-amplia]="amplia" [class.mn-llenar]="llenar">
    <div class="mn-cab">
      <span class="mn-titulo text-slate-900 dark:text-slate-100" [id]="idEtiqueta">{{ etiqueta }}</span>
      <span class="mn-privada text-slate-500 dark:text-slate-400"><lucide-icon name="lock" [size]="13" aria-hidden="true"></lucide-icon>Solo usted la ve{{ soloLectura ? ' · solo lectura' : '' }}</span>
      <span class="mn-estado text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
        @if (subiendo()) { <span class="spinner spinner-xs" aria-hidden="true"></span>Subiendo imagen… }
        @else {
          @switch (estado()) {
            @case ('guardando') { <span class="spinner spinner-xs" aria-hidden="true"></span>Guardando… }
            @case ('pendiente') { Escribiendo… }
            @case ('guardado') { <lucide-icon name="check" [size]="14" aria-hidden="true"></lucide-icon>Guardado }
            @case ('error') {
              <button type="button" class="mn-reintentar focus-ring text-rose-700 dark:text-rose-300" (click)="guardarYa()">No se guardó · Reintentar</button>
            }
          }
        }
      </span>
    </div>

    @if (soloLectura) {
      @if (texto().trim()) {
        <div class="mn-vista mn-fija prosa bg-slate-50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200" [innerHTML]="html()"></div>
      } @else {
        <p class="text-sm text-slate-500 dark:text-slate-400">No escribió notas.</p>
      }
    } @else if (amplia) {
      <!-- Amplia: se lee con formato; un toque en el texto (o «Escribir») lo abre para escribir y al salir vuelve a verse con formato -->
      <div class="mn-marco" [class.mn-soltar]="soltando()" (focusout)="alSalirDelMarco($event)"
           (dragover)="alArrastrar($event)" (dragleave)="soltando.set(false)" (drop)="alSoltar($event)">
        <div class="mn-barra mn-barra-amplia" role="toolbar" [attr.aria-label]="'Herramientas de ' + etiqueta">
          <ng-container *ngTemplateOutlet="herramientas" />
          @if (leyendo()) {
            <button type="button" class="btn-tonal btn-sm mn-modo" (click)="editar()">
              <lucide-icon name="square-pen" [size]="15" aria-hidden="true"></lucide-icon>Escribir
            </button>
          } @else if (texto().trim()) {
            <button type="button" class="btn-ghost btn-sm mn-modo" (mousedown)="$event.preventDefault()" (click)="terminar()">
              <lucide-icon name="check" [size]="15" aria-hidden="true"></lucide-icon>Listo
            </button>
          }
        </div>
        @if (leyendo()) {
          <div class="mn-vista mn-hoja mn-leer prosa text-slate-800 dark:text-slate-200" role="button" tabindex="0"
               [attr.aria-label]="'Escribir en ' + etiqueta" title="Toque para escribir"
               (click)="editar()" (keydown.enter)="editar()" (keydown.space)="$event.preventDefault(); editar()">
            <div [innerHTML]="html()"></div>
          </div>
        } @else {
          <textarea #area appAutosize [minRows]="12" [maxRows]="60" class="mn-area mn-area-amplia"
                    [attr.aria-labelledby]="idEtiqueta" [placeholder]="placeholder" maxlength="20000"
                    [value]="texto()" (input)="escribir(area.value)" (focus)="editando.set(true)" (blur)="alSalir()" (paste)="alPegar($event)"></textarea>
        }
        @if (soltando()) { <div class="mn-velo" aria-hidden="true"><lucide-icon name="image-plus" [size]="22"></lucide-icon>Suelte la imagen aquí</div> }
      </div>
      @if (!leyendo() && imagenes().length) { <ng-container *ngTemplateOutlet="tira" /> }
      @if (!llenar) { <p class="caption">Puede pegar o arrastrar imágenes. Todo se guarda solo.</p> }
    } @else if (editando() || !texto().trim()) {
      @if (editando()) {
        <div class="mn-barra" role="toolbar" [attr.aria-label]="'Formato de ' + etiqueta">
          <ng-container *ngTemplateOutlet="herramientas" />
        </div>
      }
      <textarea #area appAutosize [minRows]="compacta ? 2 : 3" [maxRows]="14" class="form-control mn-area"
                [attr.aria-labelledby]="idEtiqueta" [placeholder]="placeholder" maxlength="20000"
                [value]="texto()" (input)="escribir(area.value)" (focus)="editando.set(true)" (blur)="alSalir()" (paste)="alPegar($event)"></textarea>
      @if (editando() && imagenes().length) { <ng-container *ngTemplateOutlet="tira" /> }
    } @else {
      <div class="mn-vista prosa bg-slate-50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 hover:border-slate-200 dark:hover:border-slate-700" role="button" tabindex="0" [attr.aria-label]="'Editar ' + etiqueta"
           (click)="editar()" (keydown.enter)="editar()" (keydown.space)="$event.preventDefault(); editar()"
           [innerHTML]="html()"></div>
    }
  </div>

  <input #archivo type="file" accept="image/*" class="sr-only" tabindex="-1" aria-hidden="true" (change)="alElegirArchivo(archivo)" />

  <!-- Barra: formato, imagen y elementos listos. mousedown no roba el foco del texto. -->
  <ng-template #herramientas>
    <div class="mn-grupo">
      <button type="button" class="mn-fmt focus-ring" (mousedown)="$event.preventDefault()" (click)="titulo()" aria-label="Título" title="Título">
        <lucide-icon name="heading-2" [size]="16" aria-hidden="true"></lucide-icon>
      </button>
      <button type="button" class="mn-fmt focus-ring" (mousedown)="$event.preventDefault()" (click)="envolver('**', '**')" aria-label="Negrita" title="Negrita">
        <lucide-icon name="bold" [size]="16" aria-hidden="true"></lucide-icon>
      </button>
      <button type="button" class="mn-fmt focus-ring" (mousedown)="$event.preventDefault()" (click)="lista('- ')" aria-label="Lista con viñetas" title="Lista con viñetas">
        <lucide-icon name="list" [size]="16" aria-hidden="true"></lucide-icon>
      </button>
      <button type="button" class="mn-fmt focus-ring" (mousedown)="$event.preventDefault()" (click)="lista('1. ')" aria-label="Lista numerada" title="Lista numerada">
        <lucide-icon name="list-ordered" [size]="16" aria-hidden="true"></lucide-icon>
      </button>
      <button type="button" class="mn-fmt focus-ring" (mousedown)="$event.preventDefault()" (click)="cita()" aria-label="Cita o texto para leer" title="Cita o texto para leer">
        <lucide-icon name="quote" [size]="16" aria-hidden="true"></lucide-icon>
      </button>
      <button type="button" class="mn-fmt focus-ring" (mousedown)="$event.preventDefault()" (click)="enlace()" aria-label="Enlace" title="Enlace (pegue la dirección)">
        <lucide-icon name="link" [size]="16" aria-hidden="true"></lucide-icon>
      </button>
    </div>
    <div class="mn-grupo">
      <button type="button" class="mn-accion focus-ring" (mousedown)="$event.preventDefault()" (click)="archivo.click()" [disabled]="subiendo()">
        <lucide-icon name="image-plus" [size]="16" aria-hidden="true"></lucide-icon><span>Imagen</span>
      </button>
      <div class="mn-menu-wrap" (focusout)="cerrarMenuSiSale($event)">
        <button type="button" class="mn-accion focus-ring" (mousedown)="$event.preventDefault()" (click)="menuAbierto.set(!menuAbierto())"
                aria-haspopup="menu" [attr.aria-expanded]="menuAbierto()">
          <lucide-icon name="layout-template" [size]="16" aria-hidden="true"></lucide-icon><span>Elementos</span>
        </button>
        @if (menuAbierto()) {
          <div class="mn-menu" role="menu" (keydown.escape)="menuAbierto.set(false); enfocar()">
            @for (e of elementos; track e.clave) {
              <button type="button" role="menuitem" class="mn-menu-item" (mousedown)="$event.preventDefault()" (click)="insertarElemento(e)">
                <lucide-icon [name]="e.icono" [size]="16" aria-hidden="true"></lucide-icon>
                <span class="flex flex-col min-w-0"><strong>{{ e.titulo }}</strong><span class="caption">{{ e.ayuda }}</span></span>
              </button>
            }
          </div>
        }
      </div>
    </div>
  </ng-template>

  <!-- Las imágenes del texto, a la vista mientras se escribe (la marca sola no se entiende) -->
  <ng-template #tira>
    <ul class="mn-tira" aria-label="Imágenes de estas notas">
      @for (im of imagenes(); track im.id; let i = $index) {
        <li class="mn-mini">
          @if (urls()[im.id]; as src) { <img [src]="src" [alt]="im.pie || 'Imagen ' + (i + 1)" /> }
          @else if (urls()[im.id] === '') { <span class="mn-mini-falla" title="No se pudo cargar"><lucide-icon name="image-off" [size]="16" aria-hidden="true"></lucide-icon></span> }
          @else { <span class="skeleton w-full h-full"></span> }
          <button type="button" class="mn-mini-quitar focus-ring" (mousedown)="$event.preventDefault()" (click)="quitarImagen(im.id)"
                  [attr.aria-label]="'Quitar la imagen ' + (i + 1)" title="Quitar">
            <lucide-icon name="x" [size]="14" aria-hidden="true"></lucide-icon>
          </button>
        </li>
      }
    </ul>
  </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .mn { display: flex; flex-direction: column; gap: 0.5rem; }
    .mn-cab { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.625rem; min-height: 1.5rem; }
    .mn-titulo { font-size: 0.875rem; font-weight: 700; }
    .mn-privada { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; font-weight: 600; }
    .mn-estado { margin-left: auto; display: inline-flex; align-items: center; gap: 0.3125rem; font-size: 0.75rem; font-weight: 600; }
    .mn-reintentar { font-weight: 700; border-radius: 0.375rem; }

    /* Barra */
    .mn-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem 0.5rem; }
    .mn-grupo { display: flex; flex-wrap: wrap; align-items: center; gap: 0.125rem; }
    .mn-fmt, .mn-accion {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.375rem; height: 2.25rem; border-radius: 0.5rem;
      color: var(--color-slate-600); transition: background-color 150ms ease-out, color 150ms ease-out, transform 120ms ease-out;
    }
    .mn-fmt { width: 2.25rem; }
    .mn-accion { padding: 0 0.625rem; font-size: 0.875rem; font-weight: 600; }
    :host-context(.dark) .mn-fmt, :host-context(.dark) .mn-accion { color: var(--color-slate-300); }
    @media (hover: hover) {
      .mn-fmt:hover, .mn-accion:hover:not(:disabled) { background: color-mix(in oklab, var(--accent) 10%, transparent); color: var(--accent); }
      :host-context(.dark) .mn-fmt:hover, :host-context(.dark) .mn-accion:hover:not(:disabled) { color: color-mix(in oklab, var(--accent) 45%, white); }
    }
    .mn-fmt:active, .mn-accion:active { transform: scale(0.95); }
    .mn-accion:disabled { opacity: 0.5; }
    @media (pointer: coarse) { .mn-fmt { width: 2.75rem; height: 2.75rem; } .mn-accion { height: 2.75rem; } }

    /* Menú de elementos listos */
    .mn-menu-wrap { position: relative; }
    .mn-menu {
      position: absolute; z-index: var(--z-dropdown, 30); top: calc(100% + 0.25rem); right: 0; width: min(20rem, 85vw);
      padding: 0.375rem; border-radius: 0.875rem; border: 1px solid var(--color-slate-200); background: var(--color-white);
      box-shadow: 0 12px 32px -8px rgb(15 23 42 / 0.25); transform-origin: top right;
      animation: menu-entra 160ms cubic-bezier(0.23, 1, 0.32, 1) both;
    }
    :host-context(.dark) .mn-menu { border-color: var(--color-slate-700); background: var(--color-slate-900); }
    @keyframes menu-entra { from { opacity: 0; transform: scale(0.96) translateY(-2px); } }
    /* En el teléfono el botón queda a media barra y un menú anclado a él se sale por la izquierda: se ancla a la barra entera. */
    @media (max-width: 40rem) {
      .mn-barra { position: relative; }
      .mn-menu-wrap { position: static; }
      .mn-menu { left: 0; right: 0; width: auto; transform-origin: top center; }
    }
    .mn-menu-item {
      width: 100%; display: flex; align-items: flex-start; gap: 0.625rem; padding: 0.5rem 0.625rem; border-radius: 0.625rem;
      text-align: left; font-size: 0.875rem; color: var(--color-slate-800);
    }
    .mn-menu-item > lucide-icon { margin-top: 0.125rem; color: var(--accent); flex-shrink: 0; }
    :host-context(.dark) .mn-menu-item { color: var(--color-slate-100); }
    :host-context(.dark) .mn-menu-item > lucide-icon { color: color-mix(in oklab, var(--accent) 45%, white); }
    .mn-menu-item:hover, .mn-menu-item:focus-visible { background: color-mix(in oklab, var(--accent) 8%, transparent); outline: none; }

    /* Campo */
    .mn-area { font-size: 0.875rem; line-height: 1.5; resize: vertical; }
    .mn-fija { cursor: default; }
    .mn-vista {
      cursor: text; padding: 0.625rem 0.875rem; border-radius: 0.75rem; min-height: 2.75rem;
      font-size: 0.875rem; line-height: 1.55; border: 1px solid transparent;
      transition: border-color 150ms ease-out;
    }
    .mn-vista:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 2px; }

    /* Amplia: un marco con la barra arriba y el texto como una hoja */
    .mn-marco {
      position: relative; display: flex; flex-direction: column; border-radius: 1rem; overflow: clip;
      border: 1px solid var(--color-slate-300); background: var(--color-white);
      transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
    }
    :host-context(.dark) .mn-marco { border-color: var(--color-slate-700); background: var(--color-slate-950); }
    .mn-marco:focus-within { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-ring); }
    .mn-barra-amplia {
      position: sticky; top: 0; z-index: 1; padding: 0.375rem 0.5rem; border-bottom: 1px solid var(--color-slate-200);
      background: var(--color-slate-50);
    }
    :host-context(.dark) .mn-barra-amplia { border-bottom-color: var(--color-slate-800); background: var(--color-slate-900); }
    .mn-modo { flex-shrink: 0; margin-left: auto; }
    .mn-leer { cursor: text; border-radius: 0.75rem; transition: background-color 150ms ease-out; }
    @media (hover: hover) { .mn-leer:hover { background: color-mix(in oklab, var(--accent) 4%, transparent); } }
    .mn-area-amplia {
      width: 100%; border: 0; outline: none; resize: none; background: transparent; padding: 1rem 1.125rem;
      font-size: 1rem; line-height: 1.65; color: var(--color-slate-900);
    }
    :host-context(.dark) .mn-area-amplia { color: var(--color-slate-100); }
    .mn-area-amplia::placeholder { color: var(--color-slate-400); }
    .mn-hoja { padding: 1rem 1.125rem; min-height: 18rem; font-size: 1rem; line-height: 1.65; border-radius: 0; }
    .mn-soltar { border-color: var(--accent); border-style: dashed; }
    .mn-velo {
      position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 0.375rem; pointer-events: none;
      font-size: 0.875rem; font-weight: 700; color: var(--accent); background: color-mix(in oklab, var(--accent) 8%, transparent);
    }

    /* Miniaturas */
    .mn-tira { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    .mn-mini {
      position: relative; width: 4.5rem; height: 4.5rem; border-radius: 0.625rem; overflow: hidden;
      border: 1px solid var(--color-slate-200); background: var(--color-slate-100);
    }
    :host-context(.dark) .mn-mini { border-color: var(--color-slate-700); background: var(--color-slate-800); }
    .mn-mini img { width: 100%; height: 100%; object-fit: cover; }
    .mn-mini-falla { width: 100%; height: 100%; display: grid; place-items: center; color: var(--color-slate-400); }
    .mn-mini-quitar {
      position: absolute; top: 0.25rem; right: 0.25rem; width: 1.5rem; height: 1.5rem; display: grid; place-items: center;
      border-radius: 9999px; color: #fff; background: rgb(15 23 42 / 0.7);
    }

    /* Lo que se ve con formato */
    .prosa ::ng-deep p { margin: 0 0 0.5rem; }
    .prosa ::ng-deep p:last-child { margin-bottom: 0; }
    .prosa ::ng-deep ul { list-style: disc; padding-left: 1.25rem; margin: 0 0 0.5rem; }
    .prosa ::ng-deep ol { list-style: decimal; padding-left: 1.25rem; margin: 0 0 0.5rem; }
    .prosa ::ng-deep h4 { font-family: var(--font-display, inherit); font-size: 1rem; font-weight: 700; margin: 0.75rem 0 0.25rem; }
    .prosa ::ng-deep h4:first-child { margin-top: 0; }
    .prosa ::ng-deep a { font-weight: 600; text-decoration: underline; text-underline-offset: 2px; color: var(--accent); overflow-wrap: anywhere; }
    .prosa ::ng-deep blockquote {
      margin: 0 0 0.625rem; padding: 0.5rem 0.75rem; border-radius: 0.625rem;
      background: color-mix(in oklab, var(--accent) 7%, transparent); border: 1px solid color-mix(in oklab, var(--accent) 22%, transparent);
    }
    .prosa ::ng-deep hr { margin: 0.75rem 0; border: 0; border-top: 1px solid var(--color-slate-300); }
    :host-context(.dark) .prosa ::ng-deep hr { border-top-color: var(--color-slate-700); }
    .prosa ::ng-deep figure { margin: 0.5rem 0 0.75rem; }
    .prosa ::ng-deep figure img { display: block; max-width: 100%; max-height: 28rem; border-radius: 0.625rem; }
    .prosa ::ng-deep figcaption { margin-top: 0.25rem; font-size: 0.75rem; color: var(--color-slate-500); }
    .prosa ::ng-deep .img-cargando { display: block; width: 12rem; height: 8rem; border-radius: 0.625rem; background: var(--color-slate-200); }
    :host-context(.dark) .prosa ::ng-deep .img-cargando { background: var(--color-slate-800); }

    /* Llenar: ocupa todo el alto del panel y el texto se desplaza por dentro */
    :host(.llenar) { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
    :host(.llenar) .mn { flex: 1 1 auto; min-height: 0; }
    /* Sin marco propio: la tarjeta ya es la hoja. La barra queda arriba con una línea fina. */
    :host(.llenar) .mn-marco { flex: 1 1 auto; min-height: 10rem; border: 0; border-radius: 0; background: transparent; overflow: visible; }
    :host-context(.dark) .mn-llenar .mn-marco { background: transparent; }
    :host(.llenar) .mn-marco:focus-within { box-shadow: none; }
    :host(.llenar) .mn-barra-amplia {
      padding: 0 0 0.5rem; background: transparent; border-bottom: 1px solid var(--color-slate-200);
      gap: 0.5rem;
    }
    :host-context(.dark) .mn-llenar .mn-barra-amplia { background: transparent; border-bottom-color: var(--color-slate-800); }
        :host(.llenar) .mn-area-amplia, :host(.llenar) .mn-hoja { padding: 0.875rem 0.125rem 0.25rem; }
    :host(.llenar) .mn-area-amplia::placeholder { color: var(--color-slate-400); }
    :host(.llenar) .mn-area-amplia { flex: 1 1 0; min-height: 6rem; height: auto !important; overflow-y: auto; }
    :host(.llenar) .mn-hoja { flex: 1 1 0; min-height: 0; overflow-y: auto; }
    :host(.llenar) .mn-fija:not(.mn-hoja) { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
    @media (prefers-reduced-motion: reduce) { .mn-fmt:active, .mn-accion:active { transform: none; } .mn-menu { animation: none; } }
  `],
})
export class MisNotasComponent implements OnChanges, OnDestroy {
  private svc = inject(ReunionAncianosService);
  private sanitizer = inject(DomSanitizer);
  private toast = inject(ToastService);

  @Input({ required: true }) idReunion!: number;
  /** null = la nota general de la reunión. */
  @Input() idParte: number | null = null;
  @Input() valor = '';
  @Input() etiqueta = 'Mis notas';
  @Input() placeholder = 'Ideas, preguntas o lo que quiere tener presente';
  @Input() compacta = false;
  /** Para preparar la propia parte: área grande, «Escribir · Ver cómo queda». */
  @Input() amplia = false;
  /** La reunión ya terminó: se ven con formato, pero no se editan. */
  @Input() soloLectura = false;
  /** Ocupa todo el alto del contenedor (la reunión en vivo). */
  @Input() llenar = false;
  @Output() guardada = new EventEmitter<NotaPersonal | null>();

  @ViewChild('area') area?: ElementRef<HTMLTextAreaElement>;

  private static siguiente = 0;
  readonly idEtiqueta = `mn-etq-${++MisNotasComponent.siguiente}`;
  readonly elementos = ELEMENTOS;

  texto = signal('');
  editando = signal(false);
  /** Amplia: con texto y sin escribir, se ve con formato. */
  leyendo = computed(() => this.amplia && !this.editando() && !!this.texto().trim());
  menuAbierto = signal(false);
  soltando = signal(false);
  subiendo = signal(false);
  estado = signal<EstadoGuardado>('listo');

  /** id → blob: URL; '' si no se pudo cargar. Sin entrada = cargando. */
  urls = signal<Record<number, string>>({});
  private pedidas = new Set<number>();

  imagenes = computed(() => {
    const vistas = new Set<number>();
    const lista: { id: number; pie: string }[] = [];
    for (const m of this.texto().matchAll(MARCA_IMAGEN)) {
      const id = Number(m[2]);
      if (!vistas.has(id)) { vistas.add(id); lista.push({ id, pie: m[1] }); }
    }
    return lista;
  });

  html = computed<SafeHtml>(() => {
    const urls = this.urls();
    return this.sanitizer.bypassSecurityTrustHtml(markdownSimpleAHtml(this.texto(), { imagen: id => urls[id] || null }));
  });

  private guardadoTexto = '';
  private temporizador: ReturnType<typeof setTimeout> | null = null;

  ngOnChanges(c: SimpleChanges) {
    // Solo se toma el valor de fuera si no hay nada pendiente de guardar aquí.
    if (c['valor'] && this.estado() !== 'pendiente' && this.estado() !== 'guardando') {
      this.texto.set(this.valor ?? '');
      this.guardadoTexto = this.valor ?? '';
    }

    this.cargarImagenes();
  }

  ngOnDestroy() {
    // Al salir de la pantalla no se pierde lo último escrito.
    if (this.temporizador) { clearTimeout(this.temporizador); this.enviar(); }
    Object.values(this.urls()).forEach(u => u && URL.revokeObjectURL(u));
  }

  escribir(v: string) {
    this.texto.set(v);
    this.estado.set('pendiente');
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.enviar(), 900);
  }

  alSalir() {
    // En la amplia, abrir el menú o la imagen no cierra nada: solo guarda.
    if (!this.amplia) this.editando.set(false);
    if (this.temporizador) { clearTimeout(this.temporizador); this.enviar(); }
  }

  guardarYa() {
    this.enviar();
  }

  editar() {
    this.editando.set(true);
    setTimeout(() => {
      const ta = this.area?.nativeElement;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
  }

  enfocar() {
    setTimeout(() => this.area?.nativeElement.focus());
  }

  /** «Listo»: guarda y vuelve a verse con formato. */
  terminar() {
    this.menuAbierto.set(false);
    if (this.temporizador) { clearTimeout(this.temporizador); this.enviar(); }
    this.editando.set(false);
  }

  /** Amplia: el foco salió del editor (no a su barra ni al menú) → vuelve a verse con formato. */
  alSalirDelMarco(e: FocusEvent) {
    const marco = e.currentTarget as HTMLElement;
    const siguiente = e.relatedTarget as Node | null;
    // Abrir el selector de imagen o cambiar de ventana no cuenta como salir.
    if (!document.hasFocus() || this.subiendo()) return;
    if (siguiente && marco.contains(siguiente)) return;
    // Al tocar el texto para escribir, el navegador avisa de que ese texto (o el botón «Escribir») perdió el foco
    // porque se sustituye por el cuadro de escritura: se espera a ver dónde queda el foco antes de cerrar.
    setTimeout(() => {
      if (marco.contains(document.activeElement)) return;
      this.menuAbierto.set(false);
      this.editando.set(false);
    });
  }

  private enviar() {
    this.temporizador = null;
    const texto = this.texto();
    if (texto === this.guardadoTexto) { this.estado.set(texto.trim() ? 'guardado' : 'listo'); return; }
    this.estado.set('guardando');
    this.svc.guardarNota(this.idReunion, this.idParte, texto).subscribe({
      next: n => {
        this.guardadoTexto = texto;
        // Si siguió escribiendo mientras se guardaba, queda pendiente lo nuevo.
        if (this.texto() !== texto) { this.escribir(this.texto()); return; }
        this.estado.set(texto.trim() ? 'guardado' : 'listo');
        this.guardada.emit(n);
      },
      error: (_e: HttpErrorResponse) => this.estado.set('error'),
    });
  }

  // ── Formato ──────────────────────────────────────────────────────────────

  /** Cambia el texto alrededor de la selección; sin campo a la vista, añade al final. */
  private aplicar(transformar: (antes: string, sel: string, despues: string) => { texto: string; desde: number; hasta: number }) {
    // Amplia leyendo: primero se abre para escribir y el cambio va al final del texto.
    if (this.leyendo() && !this.soloLectura) {
      this.editando.set(true);
      setTimeout(() => {
        const ta = this.area?.nativeElement;
        if (ta) ta.setSelectionRange(ta.value.length, ta.value.length);
        this.aplicar(transformar);
      });
      return;
    }
    const ta = this.area?.nativeElement;
    const valor = this.texto();
    const a = ta ? ta.selectionStart : valor.length;
    const b = ta ? ta.selectionEnd : valor.length;
    const r = transformar(valor.slice(0, a), valor.slice(a, b), valor.slice(b));
    this.escribir(r.texto);
    if (!ta) return;
    ta.value = r.texto;
    ta.focus();
    ta.setSelectionRange(r.desde, r.hasta);
    ta.dispatchEvent(new Event('input'));
  }

  envolver(abre: string, cierra: string) {
    this.aplicar((antes, sel, despues) => {
      const contenido = sel || 'texto';
      return { texto: antes + abre + contenido + cierra + despues, desde: antes.length + abre.length, hasta: antes.length + abre.length + contenido.length };
    });
  }

  /** Antepone algo a cada renglón de la selección (o al renglón del cursor). */
  private prefijar(prefijo: (i: number) => string, yaTiene: RegExp) {
    this.aplicar((antes, sel, despues) => {
      const inicioLinea = antes.lastIndexOf('\n') + 1;
      const previo = antes.slice(0, inicioLinea);
      const bloque = antes.slice(inicioLinea) + sel;
      const nuevo = bloque.split('\n').map((l, i) => (yaTiene.test(l) ? l : prefijo(i) + l)).join('\n');
      const fin = previo.length + nuevo.length;
      return { texto: previo + nuevo + despues, desde: fin, hasta: fin };
    });
  }

  lista(tipo: '- ' | '1. ') {
    if (tipo === '- ') this.prefijar(() => '- ', /^\s*[-*•] /);
    else this.prefijar(i => `${i + 1}. `, /^\s*\d+[.)] /);
  }

  titulo() { this.prefijar(() => '## ', /^#{1,3} /); }

  cita() { this.prefijar(() => '> ', /^> /); }

  enlace() {
    this.aplicar((antes, sel, despues) => {
      const etiqueta = sel || 'enlace';
      const url = 'https://';
      const texto = `${antes}[${etiqueta}](${url})${despues}`;
      const desde = antes.length + etiqueta.length + 3;
      return { texto, desde, hasta: desde + url.length };
    });
  }

  /** Inserta un bloque en su propio renglón, con el cursor donde se escribe. */
  private insertarBloque(bloque: string, cursor: number) {
    this.aplicar((antes, _sel, despues) => {
      const sep1 = !antes || antes.endsWith('\n\n') ? '' : antes.endsWith('\n') ? '\n' : '\n\n';
      const sep2 = !despues || despues.startsWith('\n') ? '' : '\n';
      const pos = antes.length + sep1.length + cursor;
      return { texto: antes + sep1 + bloque + sep2 + despues, desde: pos, hasta: pos };
    });
  }

  insertarElemento(e: (typeof ELEMENTOS)[number]) {
    this.menuAbierto.set(false);
    this.insertarBloque(e.texto, e.cursor);
  }

  cerrarMenuSiSale(e: FocusEvent) {
    const siguiente = e.relatedTarget as Node | null;
    if (!siguiente || !(e.currentTarget as HTMLElement).contains(siguiente)) this.menuAbierto.set(false);
  }

  // ── Imágenes ─────────────────────────────────────────────────────────────

  private cargarImagenes() {
    const ids = [...this.texto().matchAll(MARCA_IMAGEN)].map(m => Number(m[2]));
    for (const id of ids) {
      if (this.pedidas.has(id)) continue;
      this.pedidas.add(id);
      this.svc.imagenNota(this.idReunion, id).subscribe({
        next: blob => this.urls.update(m => ({ ...m, [id]: URL.createObjectURL(blob) })),
        error: () => this.urls.update(m => ({ ...m, [id]: '' })),
      });
    }
  }

  alElegirArchivo(input: HTMLInputElement) {
    const f = input.files?.[0];
    input.value = '';
    if (f) this.subir(f);
  }

  alPegar(e: ClipboardEvent) {
    const f = [...(e.clipboardData?.files ?? [])].find(x => x.type.startsWith('image/'));
    if (!f) return;
    e.preventDefault();
    this.subir(f);
  }

  alArrastrar(e: DragEvent) {
    if (!e.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    this.soltando.set(true);
  }

  alSoltar(e: DragEvent) {
    this.soltando.set(false);
    const f = [...(e.dataTransfer?.files ?? [])][0];
    if (!f) return;
    e.preventDefault();
    this.subir(f);
  }

  private subir(archivo: File) {
    if (!archivo.type.startsWith('image/')) {
      this.toast.warning('Ese archivo no es una imagen', 'Use una foto o captura JPG, PNG o WEBP.');
      return;
    }
    this.subiendo.set(true);
    this.svc.subirImagenNota(this.idReunion, archivo).subscribe({
      next: img => {
        this.subiendo.set(false);
        // La imagen local ya se ve; la del servidor es la misma, enderezada y reducida.
        this.pedidas.add(img.id_imagen);
        this.urls.update(m => ({ ...m, [img.id_imagen]: URL.createObjectURL(archivo) }));
        this.insertarBloque(`![](imagen:${img.id_imagen})`, `![](imagen:${img.id_imagen})`.length);
      },
      error: (e: HttpErrorResponse) => {
        this.subiendo.set(false);
        this.toast.error('No se pudo subir la imagen', typeof e?.error?.detail === 'string' ? e.error.detail : 'Intente de nuevo.');
      },
    });
  }

  quitarImagen(id: number) {
    const marca = new RegExp(`\\n{0,2}!\\[[^\\]\\n]*\\]\\(imagen:${id}\\)\\n?`, 'g');
    const nuevo = this.texto().replace(marca, '\n').replace(/\n{3,}/g, '\n\n');
    if (this.area?.nativeElement) this.area.nativeElement.value = nuevo;
    this.escribir(nuevo);
  }
}
