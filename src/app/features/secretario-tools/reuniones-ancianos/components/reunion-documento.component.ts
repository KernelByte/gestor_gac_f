import { Component, computed, input } from '@angular/core';
import { diaSemana, diaYMes, fechaLocal, hora12 } from '../reunion-ancianos-formato';

/** Lo que el documento necesita: sale del formulario (vista previa) o de la reunión guardada. */
export interface DocumentoReunion {
  congregacion: string | null;
  /** Título del programa (el propio o el del tipo). */
  titulo: string;
  /** Nombre corto del tipo, para el pie («Comité de mantenimiento»). */
  tipoEtiqueta: string;
  fecha: string | null;
  hora: string | null;
  lugar: string | null;
  secretario: string | null;
  oracionInicial: string | null;
  oracionFinal: string | null;
  partes: DocumentoParte[];
  /** Asuntos breves sin responsable. */
  otrosTemas?: string[];
}

export interface DocumentoParte {
  titulo: string;
  responsable: string | null;
  minutos: number | null;
  objetivo: string | null;
  texto_biblico: string | null;
  referencias: string | null;
  temas: string[];
  cancelada?: boolean;
}

/**
 * La hoja de la reunión tal como sale en el PDF (backend:
 * reunion_ancianos_export_service.py): encabezado, fila de datos, Programa (con
 * la duración de las partes al pie) y Desarrollo de los temas, este solo con las
 * partes que tienen algo más que título, responsable y minutos.
 *
 * Usa container queries (`@container`) y no el ancho de la ventana, porque en
 * el editor ocupa media pantalla y en la vista del convocado la pantalla entera.
 */
@Component({
  selector: 'app-reunion-documento',
  standalone: true,
  template: `
  <article class="@container hoja bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm"
           aria-label="Documento de la reunión">
    <div class="px-5 py-6 @lg:px-10 @lg:py-9">

      <!-- Encabezado -->
      <header class="flex flex-col gap-1 @xl:flex-row @xl:items-end @xl:justify-between @xl:gap-6">
        <div class="min-w-0">
          <p class="rotulo">{{ doc().congregacion ? 'Congregación ' + doc().congregacion : 'Congregación' }}</p>
          <h2 class="mt-2 text-[1.375rem] @lg:text-[1.625rem] font-bold leading-tight tracking-tight">{{ doc().titulo || 'Reunión' }}</h2>
        </div>
        <div class="@xl:text-right shrink-0">
          <p class="rotulo hidden @xl:block">{{ diaYAnio() }}</p>
          @if (doc().fecha) {
            <p class="mt-1 text-[1.125rem] @xl:text-[1.625rem] font-medium @xl:font-bold leading-tight text-brand-purple dark:text-violet-300 @xl:text-slate-900 @xl:dark:text-slate-50">
              <span class="@xl:hidden capitalize">{{ dia() }} </span>{{ fechaTexto() }}
            </p>
          } @else {
            <p class="mt-1 text-base text-slate-400 dark:text-slate-500 italic">Sin fecha</p>
          }
        </div>
      </header>

      <!-- Datos -->
      <dl class="mt-5 grid grid-cols-2 @md:grid-cols-[auto_auto_1fr] gap-x-10 gap-y-4 py-4 border-y border-slate-200 dark:border-slate-700/70">
        <div><dt class="rotulo">Hora</dt><dd class="dato">{{ horaTexto() || '—' }}</dd></div>
        <div><dt class="rotulo">Lugar</dt><dd class="dato">{{ doc().lugar || '—' }}</dd></div>
        <div><dt class="rotulo">Secretario</dt><dd class="dato">{{ doc().secretario || '—' }}</dd></div>
      </dl>

      <!-- Programa -->
      <section class="mt-7" aria-labelledby="doc-programa">
        <h3 id="doc-programa" class="seccion">Programa</h3>
        <div class="mt-3 hidden @xl:grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(8rem,auto)_4.5rem] gap-x-3 pb-2 border-b border-slate-200 dark:border-slate-700/70 cabecera">
          <span></span><span>Parte</span><span>Responsable</span><span class="text-right">Minutos</span>
        </div>
        <ol class="list-none m-0 p-0">
          <li class="fila">
            <span class="hidden @xl:block"></span>
            <span class="text-slate-500 dark:text-slate-400">Oración inicial</span>
            <span class="persona">{{ doc().oracionInicial || '—' }}</span>
            <span class="hidden @xl:block"></span>
          </li>
          @for (p of doc().partes; track $index; let i = $index) {
            <li class="fila">
              <span class="hidden @xl:block text-slate-500 dark:text-slate-400 tabular-nums">{{ i + 1 }}</span>
              <span class="font-medium @xl:font-normal" [class.cancelada]="p.cancelada">
                <span class="@xl:hidden">{{ i + 1 }}. </span>{{ p.titulo || 'Parte sin título' }}
                @if (p.cancelada) { <span class="badge-neutral ml-1 align-middle">Cancelado</span> }
                @if (p.minutos) { <span class="@xl:hidden minutos-txt"> · {{ p.minutos }} min</span> }
              </span>
              <span class="persona">{{ p.responsable || '—' }}</span>
              <span class="hidden @xl:block text-right minutos tabular-nums">{{ p.minutos || '' }}</span>
            </li>
          }
          <li class="fila">
            <span class="hidden @xl:block"></span>
            <span class="text-slate-500 dark:text-slate-400">Oración final</span>
            <span class="persona">{{ doc().oracionFinal || '—' }}</span>
            <span class="hidden @xl:block"></span>
          </li>
        </ol>
        @if (total()) {
          <p class="mt-3 flex justify-end items-center gap-3 text-base">
            <span class="text-slate-500 dark:text-slate-400">Duración de las partes</span>
            <span class="pildora-min tabular-nums">{{ total() }} min</span>
          </p>
        }
      </section>

      @if (otros().length) {
        <section class="mt-7" aria-labelledby="doc-otros">
          <h3 id="doc-otros" class="seccion">Otros temas</h3>
          <ul class="mt-3 list-disc pl-5 columns-1 @xl:columns-2 gap-8 text-base text-slate-800 dark:text-slate-200">
            @for (t of otros(); track $index) { <li class="break-inside-avoid py-0.5">{{ t }}</li> }
          </ul>
        </section>
      }

      <!-- Desarrollo de los temas: solo las partes que tienen algo que leer -->
      @if (conDetalle().length) {
        <section class="mt-9" aria-labelledby="doc-desarrollo">
          <h3 id="doc-desarrollo" class="seccion">Desarrollo de los temas</h3>
          <ol class="list-none m-0 p-0 mt-2">
            @for (d of conDetalle(); track d.n) {
              <li class="grid grid-cols-[2.75rem_minmax(0,1fr)] @lg:grid-cols-[3.5rem_minmax(0,1fr)] py-4 border-b border-slate-200 dark:border-slate-700/70 last:border-b-0">
                <span class="num">{{ d.n }}</span>
                <div class="min-w-0">
                  <p class="text-[1.0625rem] font-bold leading-snug">{{ d.p.titulo || 'Parte sin título' }}</p>
                  @if (d.p.responsable || d.p.minutos) {
                    <div class="flex flex-wrap gap-2 mt-2">
                      @if (d.p.responsable) {
                        <span class="pildora-persona">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                          {{ d.p.responsable }}
                        </span>
                      }
                      @if (d.p.minutos) {
                        <span class="pildora-min">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 7v5l3 2"/></svg>
                          {{ d.p.minutos }} min
                        </span>
                      }
                    </div>
                  }
                  <dl class="mt-3 grid grid-cols-1 @lg:grid-cols-[8.5rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-base">
                    @if (d.p.objetivo) {
                      <dt class="campo-etq">Objetivo</dt><dd class="whitespace-pre-line text-slate-700 dark:text-slate-300">{{ d.p.objetivo }}</dd>
                    }
                    @if (d.p.texto_biblico) {
                      <dt class="campo-etq">Texto bíblico</dt><dd class="font-semibold">{{ d.p.texto_biblico }}</dd>
                    }
                    @if (d.p.referencias) {
                      <dt class="campo-etq">Referencias</dt><dd class="whitespace-pre-line text-slate-700 dark:text-slate-300">{{ d.p.referencias }}</dd>
                    }
                    @if (d.p.temas.length) {
                      <dt class="campo-etq">Temas</dt>
                      <dd>
                        <ul class="list-disc pl-5 columns-1 @xl:columns-2 gap-8 text-slate-800 dark:text-slate-200">
                          @for (t of d.p.temas; track $index) { <li class="break-inside-avoid">{{ t }}</li> }
                        </ul>
                      </dd>
                    }
                  </dl>
                </div>
              </li>
            }
          </ol>
        </section>
      }
    </div>
  </article>
  `,
  styles: [`
    :host { display: block; }
    .rotulo {
      font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
      letter-spacing: 0.08em; color: #64748b;
    }
    .seccion {
      display: flex; align-items: center; gap: 0.625rem;
      font-size: 1.0625rem; font-weight: 700; letter-spacing: -0.01em;
    }
    .seccion::before {
      content: ''; width: 0.25rem; height: 1.125rem; border-radius: 9999px; background: #7c3aed;
    }
    .cabecera { font-size: 0.8125rem; font-weight: 600; color: #64748b; }
    .num {
      display: inline-flex; align-items: center; justify-content: center;
      width: 2rem; height: 2rem; border-radius: 0.625rem;
      background: #f1f5f9; color: #475569;
      font-size: 0.9375rem; font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .minutos { font-weight: 700; color: #166534; }
    .minutos-txt { font-weight: 600; color: #166534; }
    .pildora-persona, .pildora-min {
      display: inline-flex; align-items: center; gap: 0.375rem;
      padding: 0.25rem 0.75rem; border-radius: 9999px;
      font-size: 0.875rem; font-weight: 600; line-height: 1.25;
    }
    .pildora-persona { background: #f5f3ff; color: var(--color-brand-purple); }
    .pildora-min { background: #dcfce7; color: #166534; }
    .dato { margin-top: 0.25rem; font-size: 1rem; color: #0f172a; }
    .fila {
      display: grid; grid-template-columns: minmax(0, 1fr); row-gap: 0.125rem;
      padding: 0.75rem 0; border-bottom: 1px solid #e2e8f0; font-size: 0.9375rem;
    }
    @container (min-width: 36rem) {
      .fila {
        grid-template-columns: 1.75rem minmax(0, 1fr) minmax(8rem, auto) 4.5rem;
        column-gap: 0.75rem; align-items: baseline;
      }
    }
    .persona { font-weight: 700; color: #4338ca; }
    .cancelada { color: #64748b; text-decoration: line-through; text-decoration-thickness: 1px; }
    .cancelada .badge-neutral { text-decoration: none; }
    :host-context(.dark) .cancelada { color: #94a3b8; }
    .campo-etq { font-size: 0.875rem; color: #64748b; }
    :host-context(.dark) .rotulo, :host-context(.dark) .campo-etq, :host-context(.dark) .cabecera { color: #94a3b8; }
    :host-context(.dark) .seccion::before { background: #a78bfa; }
    :host-context(.dark) .num { background: rgba(148, 163, 184, 0.14); color: #cbd5e1; }
    :host-context(.dark) .minutos, :host-context(.dark) .minutos-txt { color: #86efac; }
    :host-context(.dark) .pildora-persona { background: rgba(139, 92, 246, 0.16); color: #ddd6fe; }
    :host-context(.dark) .pildora-min { background: rgba(16, 185, 129, 0.14); color: #6ee7b7; }
    :host-context(.dark) .dato { color: #f1f5f9; }
    :host-context(.dark) .fila { border-color: rgba(148, 163, 184, 0.18); }
    :host-context(.dark) .persona { color: #c4b5fd; }
  `],
})
export class ReunionDocumentoComponent {
  doc = input.required<DocumentoReunion>();

  total = computed(() => this.doc().partes.reduce((s, p) => s + (p.cancelada ? 0 : p.minutos || 0), 0));
  otros = computed(() => (this.doc().otrosTemas ?? []).filter(t => t.trim()));
  fechaTexto = computed(() => diaYMes(this.doc().fecha));
  dia = computed(() => diaSemana(this.doc().fecha));
  horaTexto = computed(() => hora12(this.doc().hora));
  /** «DOMINGO · 2026», como en la esquina del PDF. */
  diaYAnio = computed(() => {
    const d = fechaLocal(this.doc().fecha);
    return d ? `${this.dia()} · ${d.getFullYear()}` : '';
  });

  /** Partes con objetivo, texto, referencias o temas, con su número del programa.
   *  Las que solo tienen título, responsable y minutos ya están completas en el programa. */
  conDetalle = computed(() =>
    this.doc().partes
      .map((p, i) => ({ p, n: i + 1 }))
      .filter(({ p }) => !p.cancelada && !!(p.objetivo || p.texto_biblico || p.referencias || p.temas.length)),
  );
}
