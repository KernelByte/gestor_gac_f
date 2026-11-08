import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { EstadoRecurso } from '../recurso';
import { Medida, MedirDirective } from '../medir.directive';

export type ColorPanel = 'violeta' | 'naranja' | 'verde' | 'azul' | 'rosa' | 'gris';
export type IconoPanel = 'semana' | 'informes' | 'agenda' | 'grafico' | 'programa' | 'discursos'
  | 'asistencia' | 'mapa' | 'salidas' | 'lectura' | 'tareas';

const ICONOS: Record<IconoPanel, string> = {
  semana: 'M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5',
  informes: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z',
  agenda: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  grafico: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
  programa: 'M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z',
  discursos: 'M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z',
  asistencia: 'M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941',
  mapa: 'M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z',
  salidas: 'M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z',
  lectura: 'M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25',
  tareas: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};

let SIGUIENTE_ID = 0;

/**
 * Un panel del dashboard. El dashboard no hace scroll: el panel ocupa la celda
 * que le toca (`area`) y emite el tamaño de su cuerpo para que el contenido
 * decida cuánto mostrar.
 */
@Component({
  selector: 'app-panel',
  standalone: true,
  imports: [RouterModule, MedirDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    'data-panel': '',
    '[style.grid-area]': 'area()',
    '[style.display]': "estado() === 'oculto' ? 'none' : null",
  },
  template: `
    <section class="panel" [attr.data-color]="color()" [attr.aria-busy]="estado() === 'cargando'" [attr.aria-labelledby]="idTitulo">
      <header class="cab">
        <span class="ic" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" [attr.d]="d()" /></svg>
        </span>
        <div class="tit">
          <h2 [id]="idTitulo">{{ titulo() }}</h2>
          @if (subtitulo()) { <p>{{ subtitulo() }}</p> }
        </div>
        <ng-content select="[cabecera]" />
        @if (enlace() && estado() !== 'error') {
          <a class="ir" [routerLink]="enlace()" [queryParams]="enlaceParams()" [attr.aria-label]="enlaceTexto() + ': ' + titulo()">
            <span class="ir-txt">{{ enlaceTexto() }}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m9 6 6 6-6 6" /></svg>
          </a>
        }
      </header>

      <div class="cuerpo" (medir)="medida.emit($event)">
        @switch (estado()) {
          @case ('cargando') {
            <div class="esq" role="status" aria-label="Cargando">
              <div class="skeleton h-4 w-2/3 rounded"></div>
              <div class="skeleton h-4 w-5/6 rounded"></div>
              <div class="skeleton h-4 w-1/2 rounded"></div>
            </div>
          }
          @case ('error') {
            <div class="err" role="alert">
              <p>No se pudo cargar.</p>
              <button type="button" (click)="reintentar.emit()">Reintentar</button>
            </div>
          }
          @default {
            @if (vacio()) { <p class="vacio">{{ vacio() }}</p> }
            @else { <ng-content /> }
          }
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; min-height: 0; }
    /* Modo carrusel (teléfono o pantalla baja): cada panel es una página completa */
    @container dash ((max-width: 40rem) or (max-height: 30rem)) {
      :host { flex: 0 0 100%; height: 100%; scroll-snap-align: start; scroll-snap-stop: always; }
    }
    .panel { --c: var(--color-brand-purple); --c-suave: #f5f3ff; --c-texto: #6d28d9;
      container: panel / inline-size;
      height: 100%; display: flex; flex-direction: column; gap: var(--panel-gap, 0.875rem);
      padding: var(--panel-pad, 1.125rem 1.25rem); border-radius: 0.75rem; overflow: hidden;
      background: var(--panel-bg, white); border: 1px solid rgb(17 24 39 / 0.07); }
    :host-context(.dark) .panel { --c-suave: rgb(139 92 246 / 0.14); --c-texto: #c4b5fd;
      background: rgb(15 23 42 / 0.72); border-color: rgb(148 163 184 / 0.14); }
    .panel[data-color="naranja"] { --c: #f97316; --c-suave: #fff7ed; --c-texto: #c2410c; }
    .panel[data-color="verde"]   { --c: #16a34a; --c-suave: #f0fdf4; --c-texto: #15803d; }
    .panel[data-color="azul"]    { --c: #2563eb; --c-suave: #eff6ff; --c-texto: #1d4ed8; }
    .panel[data-color="rosa"]    { --c: #e11d48; --c-suave: #fff1f2; --c-texto: #be123c; }
    .panel[data-color="gris"]    { --c: #64748b; --c-suave: #f1f5f9; --c-texto: #475569; }
    :host-context(.dark) .panel[data-color="naranja"] { --c-suave: rgb(249 115 22 / 0.14); --c-texto: #fdba74; }
    :host-context(.dark) .panel[data-color="verde"]   { --c-suave: rgb(34 197 94 / 0.14); --c-texto: #86efac; }
    :host-context(.dark) .panel[data-color="azul"]    { --c-suave: rgb(59 130 246 / 0.16); --c-texto: #93c5fd; }
    :host-context(.dark) .panel[data-color="rosa"]    { --c-suave: rgb(244 63 94 / 0.14); --c-texto: #fda4af; }
    :host-context(.dark) .panel[data-color="gris"]    { --c-suave: rgb(100 116 139 / 0.2); --c-texto: #cbd5e1; }

    .cab { display: flex; align-items: center; gap: 0.625rem; flex-shrink: 0; min-width: 0; }
    .ic { width: 1.875rem; height: 1.875rem; flex-shrink: 0; display: grid; place-items: center; border-radius: 0.5rem;
      background: var(--c-suave); color: var(--c-texto); }
    .ic svg { width: 1rem; height: 1rem; }
    .tit { min-width: 0; flex: 1; }
    .tit h2 { font-family: var(--font-display, 'Urbanist', sans-serif); font-weight: 700; font-size: 1rem; line-height: 1.2;
      letter-spacing: -0.01em; color: var(--color-gray-900, #111827); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* El subtítulo puede pasar a una segunda línea antes de cortarse con «…»:
       dice cosas como cuándo se envía el informe y no debe quedar a medias. */
    .tit p { margin-top: 1px; font-size: 0.8125rem; line-height: 1.25; color: var(--dash-texto-suave);
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow: hidden; }
    :host-context(.dark) .tit h2 { color: var(--color-slate-50, #f8fafc); }

    .ir { display: inline-flex; align-items: center; gap: 0.125rem; flex-shrink: 0; padding: 0.375rem 0.5rem; margin-right: -0.5rem;
      border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 600; color: var(--c-texto); white-space: nowrap;
      transition: background-color 150ms ease; }
    .ir svg { width: 1rem; height: 1rem; transition: transform 200ms cubic-bezier(0.23, 1, 0.32, 1); }
    .ir:focus-visible { outline: 2px solid var(--c); outline-offset: 0; }
    @media (hover: hover) and (pointer: fine) { .ir:hover { background: var(--c-suave); } .ir:hover svg { transform: translateX(2px); } }
    /* Dedo: la zona de toque llega a 44 px sin agrandar el texto */
    @media (pointer: coarse) { .ir { min-height: 2.75rem; padding-inline: 0.75rem; margin-right: -0.75rem; } }
    @container dash (max-width: 30rem) { .ir-txt { display: none; } }

    .cuerpo { flex: 1; min-height: 0; position: relative; display: flex; flex-direction: column; }
    .esq { display: flex; flex-direction: column; gap: 0.75rem; padding-top: 0.25rem; }
    .err { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; font-size: 0.875rem; color: var(--color-red-600, #dc2626); }
    .err button { font-weight: 600; text-decoration: underline; text-underline-offset: 2px; border-radius: 2px; }
    .err button:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
    :host-context(.dark) .err { color: var(--color-red-400, #f87171); }
    .vacio { font-size: 0.875rem; line-height: 1.5; color: var(--dash-texto-suave); max-width: 40ch; }

    /* Muy bajo (teléfono acostado): la pestaña ya dice qué panel es; la cabecera se reduce */
    @container dash (max-height: 26rem) {
      .panel { --panel-pad: 0.625rem 0.875rem; --panel-gap: 0.5rem; }
      .ic, .tit p { display: none; }
    }
  `],
})
export class PanelComponent {
  /** Nombre accesible de la región: el propio título. */
  readonly idTitulo = `panel-titulo-${++SIGUIENTE_ID}`;
  readonly titulo = input.required<string>();
  readonly subtitulo = input<string | null>(null);
  readonly icono = input<IconoPanel>('semana');
  readonly color = input<ColorPanel>('violeta');
  readonly area = input<string | null>(null);
  readonly estado = input<EstadoRecurso>('listo');
  readonly enlace = input<string | null>(null);
  readonly enlaceParams = input<Record<string, string> | null>(null);
  readonly enlaceTexto = input('Ver todo');
  readonly vacio = input<string | null>(null);
  readonly reintentar = output<void>();
  readonly medida = output<Medida>();

  readonly d = computed(() => ICONOS[this.icono()]);
}
