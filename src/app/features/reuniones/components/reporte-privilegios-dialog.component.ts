import { Component, computed, input, output, signal, ChangeDetectionStrategy, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ColumnaPermiso,
  GrupoMatrizOption,
  PublicadorMatrizItem,
  ReportePrivilegiosOpciones,
} from '../models/reuniones.models';

/**
 * Diálogo "Reporte de permisos" de Reuniones → Configuración → Privilegios.
 *
 * Elegir qué sale en el papel y verlo contado ANTES de generarlo: la matriz
 * tiene 130 filas y 14 columnas, y el error caro es imprimir siete hojas para
 * descubrir que el filtro estaba mal puesto. Por eso el panel derecho cuenta
 * en vivo, con los mismos criterios que aplica el backend al armar el PDF.
 *
 * El diálogo NO descarga: emite las opciones y el componente padre —que ya
 * tiene el servicio y la congregación activa— hace la petición.
 */

/** Un permiso con su conteo dentro de la población filtrada. */
interface ConteoPermiso {
  key: string;
  label: string;
  total: number;
}

@Component({
  selector: 'app-reporte-privilegios-dialog',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-fadeIn"
         (click)="cerrar.emit()">
      <div class="rp-panel w-full max-w-5xl max-h-full flex flex-col bg-white dark:bg-[#12131c] rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-slideDown"
           (click)="$event.stopPropagation()"
           role="dialog" aria-modal="true" aria-labelledby="rp-titulo">

        <!-- ── Cabecera ── -->
        <header class="shrink-0 flex items-start gap-3 px-5 sm:px-6 py-4 border-b border-slate-200/80 dark:border-slate-800">
          <div class="w-9 h-9 rounded-xl bg-[#6D28D9]/10 dark:bg-[#6D28D9]/20 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <h2 id="rp-titulo" class="text-sm font-bold text-slate-800 dark:text-white leading-tight">Reporte de permisos</h2>
            <p class="text-[0.6875rem] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              Elige qué entra en el documento. El resumen de la derecha se recalcula al instante.
            </p>
          </div>
          <button (click)="cerrar.emit()" aria-label="Cerrar"
                  class="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </header>

        <!-- ── Cuerpo ── -->
        <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[1fr_19rem] overflow-hidden">

          <!-- Opciones -->
          <div class="min-h-0 overflow-y-auto simple-scrollbar px-5 sm:px-6 py-5 flex flex-col gap-6">

            <!-- Formato -->
            <section>
              <h3 class="rp-label">Formato</h3>
              <div class="grid grid-cols-2 gap-2.5">
                @for (f of FORMATOS; track f.id) {
                  <button (click)="formato.set(f.id)" type="button"
                          class="rp-card text-left"
                          [class.rp-card-on]="formato() === f.id">
                    <span class="rp-card-title">{{ f.titulo }}</span>
                    <span class="rp-card-desc">{{ f.descripcion }}</span>
                  </button>
                }
              </div>
            </section>

            <!-- Quién entra -->
            <section class="flex flex-col gap-4">
              <h3 class="rp-label">Quiénes entran</h3>

              <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div>
                  <span class="rp-sublabel">Sexo</span>
                  <div class="rp-segmented">
                    @for (s of SEXOS; track s.id) {
                      <button type="button" (click)="sexo.set(s.id)"
                              [class.rp-seg-on]="sexo() === s.id">{{ s.label }}</button>
                    }
                  </div>
                </div>

                <div>
                  <span class="rp-sublabel">Nombramiento</span>
                  <div class="rp-segmented">
                    <button type="button" (click)="privilegio.set(null)"
                            [class.rp-seg-on]="privilegio() === null">Todos</button>
                    @for (p of PRIVILEGIOS; track p) {
                      <button type="button" (click)="privilegio.set(p)"
                              [class.rp-seg-on]="privilegio() === p">{{ etiquetaPrivilegio(p) }}</button>
                    }
                  </div>
                </div>
              </div>

              @if (grupos().length) {
                <div>
                  <div class="flex items-baseline justify-between gap-3 mb-1.5">
                    <span class="rp-sublabel !mb-0">Grupos de predicación</span>
                    @if (idsGrupo().size) {
                      <button type="button" (click)="limpiarGrupos()" class="rp-link">Todos</button>
                    }
                  </div>
                  <div class="flex flex-wrap gap-1.5">
                    @for (g of grupos(); track g.id_grupo) {
                      <button type="button" (click)="toggleGrupo(g.id_grupo)"
                              class="rp-chip" [class.rp-chip-on]="idsGrupo().has(g.id_grupo)">
                        {{ g.nombre_grupo }}
                      </button>
                    }
                  </div>
                  @if (!idsGrupo().size) {
                    <p class="rp-hint">Sin selección se incluyen todos los grupos.</p>
                  }
                </div>
              }

              <label class="flex items-center gap-2.5 cursor-pointer select-none w-fit">
                <input type="checkbox" class="rp-check"
                       [checked]="soloConPermiso()"
                       (change)="soloConPermiso.set(!soloConPermiso())">
                <span class="text-[0.6875rem] font-semibold text-slate-600 dark:text-slate-300">
                  Omitir a quien no tenga ninguno de los permisos elegidos
                </span>
              </label>
            </section>

            <!-- Permisos -->
            <section>
              <div class="flex items-baseline justify-between gap-3 mb-2">
                <h3 class="rp-label !mb-0">Permisos incluidos</h3>
                <div class="flex items-center gap-2">
                  <button type="button" (click)="seleccionarTodosLosPermisos()" class="rp-link">Todos</button>
                  <span class="text-slate-300 dark:text-slate-700">·</span>
                  <button type="button" (click)="limpiarPermisos()" class="rp-link">Ninguno</button>
                </div>
              </div>
              <div class="flex flex-wrap gap-1.5">
                @for (c of columnas(); track c.key) {
                  <button type="button" (click)="togglePermiso(c.key)"
                          class="rp-chip" [class.rp-chip-on]="permisos().has(c.key)"
                          [title]="c.nombre_largo">
                    {{ c.label }}
                  </button>
                }
              </div>
              @if (!permisos().size) {
                <p class="rp-hint rp-hint-alerta">Elige al menos un permiso para generar el reporte.</p>
              }
            </section>

            <!-- Agrupación (solo tiene sentido en la matriz) -->
            @if (formato() === 'matriz') {
              <section>
                <h3 class="rp-label">Agrupar filas por</h3>
                <div class="rp-segmented">
                  @for (a of AGRUPACIONES; track a.id) {
                    <button type="button" (click)="agruparPor.set(a.id)"
                            [class.rp-seg-on]="agruparPor() === a.id">{{ a.label }}</button>
                  }
                </div>
              </section>
            }
          </div>

          <!-- Resumen en vivo -->
          <aside class="min-h-0 border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col">
            <div class="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800">
              <p class="rp-label !mb-1">En el reporte</p>
              <p class="text-2xl font-black text-slate-800 dark:text-white tabular-nums leading-none">
                {{ incluidos().length }}
              </p>
              <p class="text-[0.6875rem] text-slate-400 dark:text-slate-500 font-medium mt-1">
                de {{ publicadores().length }} publicadores ·
                {{ permisos().size }} permiso{{ permisos().size === 1 ? '' : 's' }}
              </p>
            </div>

            <div class="flex-1 min-h-0 overflow-y-auto simple-scrollbar px-5 py-4">
              @if (conteos().length) {
                <ul class="flex flex-col gap-2.5">
                  @for (c of conteos(); track c.key) {
                    <li>
                      <div class="flex items-baseline justify-between gap-2">
                        <span class="text-[0.6875rem] font-semibold text-slate-600 dark:text-slate-300 truncate" [title]="c.label">{{ c.label }}</span>
                        <span class="text-[0.6875rem] font-bold tabular-nums shrink-0"
                              [class]="c.total ? 'text-slate-700 dark:text-slate-200' : 'text-amber-600 dark:text-amber-400'">{{ c.total }}</span>
                      </div>
                      <div class="mt-1 h-1 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                        <div class="h-full rounded-full bg-[#6D28D9] transition-[width] duration-300 ease-out"
                             [style.width.%]="porcentaje(c)"></div>
                      </div>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-[0.6875rem] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                  Selecciona permisos para ver cuánta gente cubre cada uno.
                </p>
              }
            </div>
          </aside>
        </div>

        <!-- ── Pie ── -->
        <footer class="shrink-0 flex items-center justify-between gap-3 px-5 sm:px-6 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#12131c]">
          <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 font-medium hidden sm:block">
            {{ pistaFormato() }}
          </p>
          <div class="flex items-center gap-2 ml-auto">
            <button type="button" (click)="cerrar.emit()"
                    class="h-9 px-4 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              Cancelar
            </button>
            <!-- Excel en esmeralda: el mismo verde que ya usa la app para
                 "positivo" (badge de Precursor Regular, toast de éxito), no
                 el verde de marca de Office — así el botón se siente propio
                 del sistema y no un sticker pegado encima. PDF se queda con
                 el violeta de marca: es el mismo acento del botón "Guardar",
                 así que sigue leyéndose como LA acción principal del diálogo. -->
            <button type="button" (click)="emitirDescarga('xlsx')"
                    [disabled]="!puedeDescargar()"
                    class="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-emerald-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98]">
              @if (descargando() === 'xlsx') {
                <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Generando...
              } @else {
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
                </svg>
                Excel
              }
            </button>
            <button type="button" (click)="emitirDescarga('pdf')"
                    [disabled]="!puedeDescargar()"
                    class="h-9 px-4 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] text-white text-xs font-bold flex items-center gap-2 shadow-sm shadow-purple-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color,box-shadow,transform,opacity] duration-150 ease-out active:scale-[0.98]">
              @if (descargando() === 'pdf') {
                <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Generando...
              } @else {
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Descargar PDF
              }
            </button>
          </div>
        </footer>
      </div>
    </div>
  `,
  styles: [`
    /* Un solo acento y hairlines de 1px: el diálogo es un formulario largo y
       cualquier sombra o color extra lo vuelve ruido. */
    .rp-panel { box-shadow: 0 24px 60px -20px rgb(15 23 42 / 0.28); }

    .rp-label {
      font-size: 0.625rem; font-weight: 800; letter-spacing: 0.06em;
      text-transform: uppercase; color: rgb(100 116 139); margin-bottom: 0.625rem;
    }
    :host-context(.dark) .rp-label { color: rgb(100 116 139); }

    .rp-sublabel {
      display: block; font-size: 0.625rem; font-weight: 700;
      color: rgb(148 163 184); margin-bottom: 0.375rem;
    }

    .rp-hint { margin-top: 0.5rem; font-size: 0.625rem; font-weight: 500; color: rgb(148 163 184); }
    .rp-hint-alerta { color: rgb(217 119 6); }

    .rp-link {
      font-size: 0.625rem; font-weight: 700; color: #6D28D9;
      transition: opacity 150ms ease-out;
    }
    .rp-link:hover { opacity: 0.7; }

    /* Tarjeta de formato */
    .rp-card {
      display: flex; flex-direction: column; gap: 0.25rem;
      padding: 0.75rem 0.875rem; border-radius: 0.75rem;
      border: 1px solid rgb(226 232 240); background: #fff;
      transition: border-color 150ms ease-out, background-color 150ms ease-out;
    }
    .rp-card:hover { border-color: rgb(203 213 225); }
    .rp-card-on { border-color: #6D28D9; background: rgb(109 40 217 / 0.05); }
    .rp-card-title { font-size: 0.75rem; font-weight: 700; color: rgb(30 41 59); }
    .rp-card-desc { font-size: 0.625rem; font-weight: 500; color: rgb(148 163 184); line-height: 1.45; }
    .rp-card-on .rp-card-title { color: #6D28D9; }
    :host-context(.dark) .rp-card { background: rgb(15 23 42 / 0.5); border-color: rgb(51 65 85); }
    :host-context(.dark) .rp-card-title { color: rgb(226 232 240); }
    :host-context(.dark) .rp-card-on { border-color: #6D28D9; background: rgb(109 40 217 / 0.15); }
    :host-context(.dark) .rp-card-on .rp-card-title { color: rgb(196 181 253); }

    /* Segmented control */
    .rp-segmented {
      display: inline-flex; align-items: center; gap: 0.125rem; padding: 0.1875rem;
      border-radius: 0.625rem; background: rgb(241 245 249); flex-wrap: wrap;
    }
    .rp-segmented > button {
      height: 1.75rem; padding: 0 0.625rem; border-radius: 0.5rem;
      font-size: 0.6875rem; font-weight: 700; color: rgb(100 116 139);
      transition: background-color 150ms ease-out, color 150ms ease-out;
    }
    .rp-segmented > button:hover { color: rgb(51 65 85); }
    .rp-seg-on { background: #fff; color: #6D28D9 !important; box-shadow: 0 1px 2px rgb(15 23 42 / 0.06); }
    :host-context(.dark) .rp-segmented { background: rgb(30 41 59 / 0.6); }
    :host-context(.dark) .rp-seg-on { background: rgb(109 40 217 / 0.25); color: rgb(196 181 253) !important; box-shadow: none; }

    /* Chips */
    .rp-chip {
      height: 1.75rem; padding: 0 0.625rem; border-radius: 0.5rem;
      font-size: 0.6875rem; font-weight: 700; color: rgb(100 116 139);
      background: #fff; border: 1px solid rgb(226 232 240);
      transition: border-color 150ms ease-out, color 150ms ease-out, background-color 150ms ease-out;
    }
    .rp-chip:hover { border-color: rgb(203 213 225); color: rgb(51 65 85); }
    .rp-chip-on { border-color: #6D28D9; background: rgb(109 40 217 / 0.08); color: #6D28D9; }
    :host-context(.dark) .rp-chip { background: rgb(15 23 42 / 0.5); border-color: rgb(51 65 85); }
    :host-context(.dark) .rp-chip-on { background: rgb(109 40 217 / 0.2); border-color: #6D28D9; color: rgb(196 181 253); }

    .rp-check {
      width: 0.9375rem; height: 0.9375rem; border-radius: 0.25rem;
      accent-color: #6D28D9; cursor: pointer;
    }

    @media (prefers-reduced-motion: reduce) {
      .rp-panel, .rp-card, .rp-chip, .rp-segmented > button { transition: none; animation: none; }
    }
  `],
})
export class ReportePrivilegiosDialogComponent implements OnInit {
  // ── Entradas ──
  publicadores = input.required<PublicadorMatrizItem[]>();
  columnas = input.required<ColumnaPermiso[]>();
  grupos = input.required<GrupoMatrizOption[]>();
  /** Filtros que el usuario ya tenía puestos en la matriz; el diálogo arranca ahí. */
  sexoInicial = input<'todos' | 'solo_hombres' | 'solo_mujeres'>('todos');
  privilegioInicial = input<string | null>(null);
  /** Cuál de los dos archivos se está generando, si hay alguno en curso. */
  descargando = input<'pdf' | 'xlsx' | null>(null);

  // ── Salidas ──
  cerrar = output<void>();
  descargar = output<{ opciones: ReportePrivilegiosOpciones; archivo: 'pdf' | 'xlsx' }>();

  // ── Opciones elegidas ──
  formato = signal<'matriz' | 'resumen'>('matriz');
  agruparPor = signal<'ninguno' | 'grupo' | 'privilegio'>('grupo');
  sexo = signal<'todos' | 'solo_hombres' | 'solo_mujeres'>('todos');
  privilegio = signal<string | null>(null);
  idsGrupo = signal<Set<number>>(new Set());
  permisos = signal<Set<string>>(new Set());
  soloConPermiso = signal(false);

  readonly FORMATOS = [
    { id: 'matriz' as const, titulo: 'Matriz completa',
      descripcion: 'Una fila por publicador y una columna por permiso. Para revisar y corregir.' },
    { id: 'resumen' as const, titulo: 'Resumen por permiso',
      descripcion: 'Quién tiene cada permiso, con los totales arriba. Para armar la reunión.' },
  ];

  readonly SEXOS = [
    { id: 'todos' as const, label: 'Todos' },
    { id: 'solo_hombres' as const, label: 'Hermanos' },
    { id: 'solo_mujeres' as const, label: 'Hermanas' },
  ];

  readonly AGRUPACIONES = [
    { id: 'ninguno' as const, label: 'Sin agrupar' },
    { id: 'grupo' as const, label: 'Grupo' },
    { id: 'privilegio' as const, label: 'Nombramiento' },
  ];

  readonly PRIVILEGIOS = ['Anciano', 'Siervo Ministerial', 'Precursor Regular'];

  private readonly ETIQUETAS_PRIVILEGIO: Record<string, string> = {
    'Siervo Ministerial': 'S. Ministerial',
    'Precursor Regular': 'P. Regular',
  };

  ngOnInit(): void {
    // El diálogo arranca donde está el usuario: hereda los filtros de la
    // matriz y trae todos los permisos marcados, que es el caso frecuente.
    this.sexo.set(this.sexoInicial());
    this.privilegio.set(this.privilegioInicial());
    this.seleccionarTodosLosPermisos();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { this.cerrar.emit(); }

  etiquetaPrivilegio(p: string): string { return this.ETIQUETAS_PRIVILEGIO[p] ?? p; }

  toggleGrupo(id: number): void {
    this.idsGrupo.update(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  togglePermiso(key: string): void {
    this.permisos.update(s => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  seleccionarTodosLosPermisos(): void {
    this.permisos.set(new Set(this.columnas().map(c => c.key)));
  }

  limpiarPermisos(): void { this.permisos.set(new Set()); }

  limpiarGrupos(): void { this.idsGrupo.set(new Set()); }

  /** Mismos criterios que `exportar_reporte_privilegios_pdf` en el backend. */
  incluidos = computed<PublicadorMatrizItem[]>(() => {
    const sexo = this.sexo();
    const priv = this.privilegio();
    const gruposSel = this.idsGrupo();
    const claves = [...this.permisos()];
    const soloCon = this.soloConPermiso();

    return this.publicadores().filter(p => {
      const esHermano = (p.sexo ?? 'Masculino').toLowerCase().startsWith('m');
      if (sexo === 'solo_hombres' && !esHermano) return false;
      if (sexo === 'solo_mujeres' && esHermano) return false;
      if (gruposSel.size && (p.id_grupo == null || !gruposSel.has(p.id_grupo))) return false;
      if (priv && !p.privilegios.includes(priv)) return false;
      if (soloCon && !claves.some(k => p.permisos[k])) return false;
      return true;
    });
  });

  conteos = computed<ConteoPermiso[]>(() => {
    const incluidos = this.incluidos();
    const elegidos = this.permisos();
    return this.columnas()
      .filter(c => elegidos.has(c.key))
      .map(c => ({
        key: c.key,
        label: c.nombre_largo || c.label,
        total: incluidos.filter(p => p.permisos[c.key]).length,
      }));
  });

  private maxConteo = computed(() =>
    Math.max(1, ...this.conteos().map(c => c.total)));

  porcentaje(c: ConteoPermiso): number {
    return Math.round((c.total / this.maxConteo()) * 100);
  }

  puedeDescargar = computed(() =>
    !this.descargando() && this.permisos().size > 0 && this.incluidos().length > 0);

  /** Qué va a salir, según formato y tipo de archivo. */
  pistaFormato = computed(() =>
    this.formato() === 'matriz'
      ? 'PDF: hoja horizontal. Excel: una fila por publicador, con filtros.'
      : 'PDF: una sección por permiso. Excel: cobertura + detalle para tabla dinámica.');

  emitirDescarga(archivo: 'pdf' | 'xlsx'): void {
    if (!this.puedeDescargar()) return;
    this.descargar.emit({
      archivo,
      opciones: {
        formato: this.formato(),
        // El resumen lista nombres por permiso: agrupar filas no aplica.
        agrupar_por: this.formato() === 'matriz' ? this.agruparPor() : 'ninguno',
        sexo: this.sexo(),
        ids_grupo: [...this.idsGrupo()],
        privilegio: this.privilegio(),
        permisos: [...this.permisos()],
        solo_con_permiso: this.soloConPermiso(),
      },
    });
  }
}
