import { Component, computed, EventEmitter, inject, Input, OnChanges, Output, signal, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ReunionAncianosService } from '../../services/reunion-ancianos.service';
import {
  CategoriaIn, CategoriaOut, COLORES_CATEGORIA, ColorCategoria, ICONOS_CATEGORIA, IconoCategoria,
} from '../../models/reunion-ancianos.model';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { LucideAngularModule } from '../../../../shared/icons';
import { clasificarTitulo } from '../reunion-ancianos-formato';

const NOMBRE_COLOR: Record<ColorCategoria, string> = {
  indigo: 'Índigo', cyan: 'Cian', amber: 'Ámbar', green: 'Verde', rose: 'Rosa', violet: 'Violeta', teal: 'Verde azulado', slate: 'Gris',
};

interface Borrador {
  id: number | null;
  etiqueta: string;
  plural: string;
  icono: IconoCategoria;
  color: ColorCategoria;
  palabras: string;
  por_defecto: boolean;
}

/**
 * Gestionar las categorías de las partes: una lista a la izquierda y la ficha
 * de la elegida (o una nueva) a la derecha. Las palabras clave deciden la
 * clasificación automática; una prueba en vivo muestra qué categoría tomaría
 * un título. Las que se usan no se borran: se archivan.
 */
@Component({
  selector: 'app-categorias-modal',
  standalone: true,
  imports: [FormsModule, ModalComponent, LucideAngularModule],
  template: `
  <app-modal [open]="open" (closed)="cerrar()" title="Categorías de las partes" size="3xl" [hasFooter]="false" [padding]="false"
             subtitle="Cada parte se clasifica sola por su título. Aquí decide con qué palabras.">
    <div class="@container">
      <div class="cm">
        <!-- Lista -->
        <div class="cm-lista">
          <ul class="flex flex-col gap-1" aria-label="Categorías">
            @for (c of categorias(); track c.id_categoria) {
              <li>
                <button type="button" class="cm-item" [attr.aria-current]="b()?.id === c.id_categoria ? 'true' : null" (click)="editar(c)">
                  <span class="cat-chip" [attr.data-color]="c.color"><lucide-icon [name]="c.icono"></lucide-icon>{{ c.etiqueta }}</span>
                  <span class="flex-1"></span>
                  @if (c.por_defecto) { <span class="caption">Por defecto</span> }
                  @if (!c.activa) { <span class="badge-neutral">Archivada</span> }
                  @if (c.usos) { <span class="caption tabular-nums" [title]="c.usos + ' partes la usan'">{{ c.usos }}</span> }
                </button>
              </li>
            }
          </ul>
          <button type="button" class="btn-secondary w-full justify-center mt-3" (click)="nueva()">
            <lucide-icon name="plus" [size]="16" aria-hidden="true"></lucide-icon>Nueva categoría
          </button>
        </div>

        <!-- Ficha -->
        <div class="cm-ficha">
          @if (b(); as f) {
            <div class="flex flex-col gap-4">
              <div class="grid gap-3 @lg:grid-cols-2">
                <div>
                  <label class="form-label" for="cm-etq">Nombre</label>
                  <input id="cm-etq" class="form-control" maxlength="60" placeholder="Ej.: Informe" [(ngModel)]="f.etiqueta" />
                </div>
                <div>
                  <label class="form-label" for="cm-plural">En plural</label>
                  <input id="cm-plural" class="form-control" maxlength="60" [placeholder]="f.etiqueta ? f.etiqueta + 's' : 'Ej.: Informes'" [(ngModel)]="f.plural" />
                </div>
              </div>

              <fieldset>
                <legend class="form-label">Color</legend>
                <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
                  @for (col of colores; track col) {
                    <button type="button" role="radio" class="cm-color cat-color" [attr.data-color]="col" [attr.aria-checked]="f.color === col"
                            [attr.aria-label]="nombreColor[col]" [title]="nombreColor[col]" (click)="f.color = col">
                      @if (f.color === col) { <lucide-icon name="check" [size]="14" aria-hidden="true"></lucide-icon> }
                    </button>
                  }
                </div>
              </fieldset>

              <fieldset>
                <legend class="form-label">Icono</legend>
                <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Icono">
                  @for (ic of iconos; track ic) {
                    <button type="button" role="radio" class="cm-icono" [attr.aria-checked]="f.icono === ic" [attr.aria-label]="ic" (click)="f.icono = ic">
                      <lucide-icon [name]="ic" [size]="18" aria-hidden="true"></lucide-icon>
                    </button>
                  }
                </div>
              </fieldset>

              <div>
                <label class="form-label" for="cm-palabras">Palabras clave <span class="font-normal text-slate-500">(una por renglón)</span></label>
                <textarea id="cm-palabras" class="form-control" rows="4" placeholder="informe&#10;cuentas"
                          [(ngModel)]="f.palabras"></textarea>
                <p class="caption mt-1">Si el título de una parte tiene una de estas palabras, toma esta categoría. Sin tildes ni mayúsculas: «informe» también reconoce «Informes».</p>
              </div>

              <div class="card-section !p-3">
                <label class="form-label" for="cm-prueba">Pruebe con un título</label>
                <input id="cm-prueba" class="form-control" placeholder="Ej.: Informe de cuentas del mes" [(ngModel)]="prueba" />
                @if (prueba.trim()) {
                  <p class="mt-2 text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">Quedaría como
                    @if (resultadoPrueba(); as c) {
                      <span class="cat-chip" [attr.data-color]="c.color"><lucide-icon [name]="c.icono"></lucide-icon>{{ c.etiqueta }}</span>
                    }
                  </p>
                }
              </div>

              <label class="flex items-center gap-3">
                <button type="button" role="switch" class="switch" [attr.aria-checked]="f.por_defecto" aria-label="Usar por defecto"
                        [disabled]="esDefectoGuardada()" (click)="f.por_defecto = !f.por_defecto"><span class="toggle-thumb"></span></button>
                <span class="text-sm text-slate-700 dark:text-slate-300">Usar cuando ninguna palabra coincida</span>
              </label>

              <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                @if (actual(); as c) {
                  @if (!c.es_sistema && !c.por_defecto) {
                    @if (c.usos) {
                      <button type="button" class="btn-ghost" [disabled]="guardando()" (click)="archivar(c, c.activa)">
                        {{ c.activa ? 'Archivar' : 'Volver a usar' }}
                      </button>
                    } @else {
                      <button type="button" class="btn-ghost-danger" [disabled]="guardando()" (click)="eliminar(c)">
                        <lucide-icon name="trash-2" [size]="16" aria-hidden="true"></lucide-icon>Eliminar
                      </button>
                    }
                  }
                }
                <span class="flex-1"></span>
                <button type="button" class="btn-ghost" (click)="b.set(null)">Cancelar</button>
                <button type="button" class="btn-primary" [disabled]="!f.etiqueta.trim() || guardando()" (click)="guardar()">
                  @if (guardando()) { <span class="spinner-sm" aria-hidden="true"></span> }
                  {{ f.id ? 'Guardar cambios' : 'Crear categoría' }}
                </button>
              </div>
            </div>
          } @else {
            <div class="h-full grid place-items-center text-center p-6">
              <p class="text-sm text-slate-500 dark:text-slate-400 max-w-xs">Elija una categoría para cambiarla, o cree una nueva.
                El orden de la lista decide cuál gana si un título coincide con varias.</p>
            </div>
          }
        </div>
      </div>
    </div>
  </app-modal>
  `,
  styles: [`
    .cm { display: grid; grid-template-rows: auto minmax(0, 1fr); max-height: min(78dvh, 44rem); }
    @container (min-width: 44rem) { .cm { grid-template-rows: none; grid-template-columns: 17rem minmax(0, 1fr); min-height: 30rem; } }
    .cm-lista { padding: 1rem; overflow-y: auto; border-bottom: 1px solid var(--color-slate-200); }
    @container (min-width: 44rem) { .cm-lista { border-bottom: 0; border-right: 1px solid var(--color-slate-200); background: var(--color-slate-50); } }
    :host-context(.dark) .cm-lista { border-color: var(--color-slate-800); }
    @container (min-width: 44rem) { :host-context(.dark) .cm-lista { background: rgb(2 6 23 / 0.4); } }
    .cm-ficha { padding: 1.25rem; overflow-y: auto; }
    .cm-item {
      width: 100%; display: flex; align-items: center; gap: 0.5rem; min-height: 2.75rem; padding: 0.375rem 0.625rem;
      border-radius: 0.75rem; text-align: left; transition: background-color 150ms ease-out;
    }
    .cm-item:hover { background: var(--color-slate-100); }
    :host-context(.dark) .cm-item:hover { background: rgb(255 255 255 / 0.05); }
    .cm-item[aria-current='true'] { background: #fff; box-shadow: inset 0 0 0 1px var(--accent-ring), 0 1px 2px rgb(15 23 42 / 0.06); }
    :host-context(.dark) .cm-item[aria-current='true'] { background: var(--color-slate-900); }
    .cm-item:focus-visible, .cm-color:focus-visible, .cm-icono:focus-visible { outline: 2px solid var(--accent-focus); outline-offset: 2px; }
    .cm-color {
      width: 2.5rem; height: 2.5rem; border-radius: 9999px; display: grid; place-items: center; color: #fff;
      background: var(--cat); border: 2px solid transparent; transition: transform 120ms ease-out;
    }
    .cm-color[aria-checked='true'] { box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--cat); }
    :host-context(.dark) .cm-color[aria-checked='true'] { box-shadow: 0 0 0 2px var(--color-slate-900), 0 0 0 4px var(--cat); }
    .cm-color:active, .cm-icono:active { transform: scale(0.94); }
    .cm-icono {
      width: 2.5rem; height: 2.5rem; border-radius: 0.75rem; display: grid; place-items: center;
      color: var(--color-slate-600); border: 1px solid var(--color-slate-200); transition: background-color 150ms ease-out, transform 120ms ease-out;
    }
    :host-context(.dark) .cm-icono { color: var(--color-slate-300); border-color: var(--color-slate-700); }
    .cm-icono[aria-checked='true'] { color: var(--accent); border-color: var(--accent); background: color-mix(in oklab, var(--accent) 8%, transparent); }
    @media (prefers-reduced-motion: reduce) { .cm-color:active, .cm-icono:active { transform: none; } }
  `],
})
export class CategoriasModalComponent implements OnChanges {
  private svc = inject(ReunionAncianosService);
  private toast = inject(ToastService);

  @Input() open = false;
  @Input() idCongregacion: number | null = null;
  @Output() openChange = new EventEmitter<boolean>();
  /** Al cerrar, con la lista al día, para que quien abrió recargue sus chips. */
  @Output() cambiaron = new EventEmitter<CategoriaOut[]>();

  readonly colores = COLORES_CATEGORIA;
  readonly iconos = ICONOS_CATEGORIA;
  readonly nombreColor = NOMBRE_COLOR;

  categorias = signal<CategoriaOut[]>([]);
  b = signal<Borrador | null>(null);
  guardando = signal(false);
  prueba = '';
  private huboCambios = false;

  actual = computed(() => {
    const f = this.b();
    return f?.id ? this.categorias().find(c => c.id_categoria === f.id) ?? null : null;
  });
  esDefectoGuardada = computed(() => !!this.actual()?.por_defecto);

  ngOnChanges(c: SimpleChanges) {
    if (c['open'] && this.open) {
      this.b.set(null);
      this.prueba = '';
      this.huboCambios = false;
      this.cargar();
    }
  }

  private cargar() {
    this.svc.categorias(this.idCongregacion).subscribe({
      next: cs => this.categorias.set(cs),
      error: () => this.toast.error('No se pudieron cargar las categorías', 'Intente de nuevo.'),
    });
  }

  /** La categoría que tomaría el título de prueba, con lo que se está editando aplicado. */
  resultadoPrueba(): CategoriaOut | null {
    const f = this.b();
    let lista = this.categorias();
    if (f) {
      const editada: CategoriaOut = {
        ...(this.actual() ?? { id_categoria: -1, clave: '', es_sistema: false, activa: true, orden: 999, usos: 0 } as CategoriaOut),
        etiqueta: f.etiqueta || 'Nueva', plural: f.plural, icono: f.icono, color: f.color,
        palabras_clave: lineas(f.palabras), por_defecto: f.por_defecto,
      };
      lista = [...lista.filter(c => c.id_categoria !== editada.id_categoria).map(c => (f.por_defecto ? { ...c, por_defecto: false } : c)), editada];
    }
    return clasificarTitulo(this.prueba, lista);
  }

  editar(c: CategoriaOut) {
    this.b.set({
      id: c.id_categoria, etiqueta: c.etiqueta, plural: c.plural, icono: c.icono, color: c.color,
      palabras: c.palabras_clave.join('\n'), por_defecto: c.por_defecto,
    });
  }

  nueva() {
    const usados = new Set(this.categorias().map(c => c.color));
    this.b.set({
      id: null, etiqueta: '', plural: '', icono: 'tag', color: COLORES_CATEGORIA.find(c => !usados.has(c)) ?? 'violet',
      palabras: '', por_defecto: false,
    });
    setTimeout(() => document.getElementById('cm-etq')?.focus(), 30);
  }

  guardar() {
    const f = this.b();
    if (!f || !f.etiqueta.trim()) return;
    const datos: CategoriaIn = {
      etiqueta: f.etiqueta.trim(), plural: f.plural.trim() || null, icono: f.icono, color: f.color,
      palabras_clave: lineas(f.palabras), por_defecto: f.por_defecto,
    };
    this.guardando.set(true);
    const peticion = f.id ? this.svc.actualizarCategoria(f.id, datos, this.idCongregacion) : this.svc.crearCategoria(datos, this.idCongregacion);
    peticion.subscribe({
      next: () => {
        this.guardando.set(false);
        this.huboCambios = true;
        this.toast.success(f.id ? 'Categoría guardada' : 'Categoría creada', 'Las partes nuevas se clasificarán con ella.');
        this.b.set(null);
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.toast.error('No se pudo guardar', typeof e?.error?.detail === 'string' ? e.error.detail : 'Intente de nuevo.');
      },
    });
  }

  archivar(c: CategoriaOut, archivar: boolean) {
    this.guardando.set(true);
    this.svc.actualizarCategoria(c.id_categoria, { activa: !archivar }, this.idCongregacion).subscribe({
      next: () => {
        this.guardando.set(false);
        this.huboCambios = true;
        this.toast.success(archivar ? 'Categoría archivada' : 'Categoría activa de nuevo',
          archivar ? 'Las partes que ya la tienen la conservan; las nuevas ya no la toman.' : undefined);
        this.b.set(null);
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.toast.error('No se pudo cambiar', typeof e?.error?.detail === 'string' ? e.error.detail : 'Intente de nuevo.');
      },
    });
  }

  eliminar(c: CategoriaOut) {
    this.guardando.set(true);
    this.svc.eliminarCategoria(c.id_categoria, this.idCongregacion).subscribe({
      next: () => {
        this.guardando.set(false);
        this.huboCambios = true;
        this.toast.success('Categoría eliminada');
        this.b.set(null);
        this.cargar();
      },
      error: (e: HttpErrorResponse) => {
        this.guardando.set(false);
        this.toast.error('No se pudo eliminar', typeof e?.error?.detail === 'string' ? e.error.detail : 'Intente de nuevo.');
      },
    });
  }

  cerrar() {
    this.openChange.emit(false);
    if (this.huboCambios) this.cambiaron.emit(this.categorias());
  }
}

function lineas(t: string): string[] {
  return t.split('\n').map(x => x.trim()).filter(Boolean);
}
