import { Component, computed, input, output, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
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
  imports: [CommonModule, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [open]="true" variant="dialog" size="3xl" title="Reporte de permisos"
      subtitle="Elige qué entra en el documento. El resumen de la derecha se recalcula al instante."
      [padding]="false" [hasFooter]="true" (closed)="cerrar.emit()">
        <!-- ── Cuerpo ── -->
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_19rem]">

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
                  <div class="segmented" role="radiogroup">
                    @for (s of SEXOS; track s.id) {
                      <button type="button" role="radio" class="segmented-item" (click)="sexo.set(s.id)"
                              [attr.aria-checked]="sexo() === s.id">{{ s.label }}</button>
                    }
                  </div>
                </div>

                <div>
                  <span class="rp-sublabel">Nombramiento</span>
                  <div class="segmented" role="radiogroup">
                    <button type="button" role="radio" class="segmented-item" (click)="privilegio.set(null)"
                            [attr.aria-checked]="privilegio() === null">Todos</button>
                    @for (p of PRIVILEGIOS; track p) {
                      <button type="button" role="radio" class="segmented-item" (click)="privilegio.set(p)"
                              [attr.aria-checked]="privilegio() === p">{{ etiquetaPrivilegio(p) }}</button>
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
                <span class="text-xs font-semibold text-slate-600 dark:text-slate-300">
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
                <div class="segmented" role="radiogroup">
                  @for (a of AGRUPACIONES; track a.id) {
                    <button type="button" role="radio" class="segmented-item" (click)="agruparPor.set(a.id)"
                            [attr.aria-checked]="agruparPor() === a.id">{{ a.label }}</button>
                  }
                </div>
              </section>
            }
          </div>

          <!-- Resumen en vivo -->
          <aside class="min-h-0 border-t lg:border-t-0 lg:border-l border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 flex flex-col">
            <div class="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800">
              <p class="rp-label !mb-1">En el reporte</p>
              <p class="text-2xl font-bold text-slate-800 dark:text-white tabular-nums leading-none">
                {{ incluidos().length }}
              </p>
              <p class="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">
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
                        <span class="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate" [title]="c.label">{{ c.label }}</span>
                        <span class="text-xs font-bold tabular-nums shrink-0"
                              [class]="c.total ? 'text-slate-700 dark:text-slate-200' : 'text-amber-600 dark:text-amber-400'">{{ c.total }}</span>
                      </div>
                      <div class="mt-1 h-1 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                        <div class="h-full rounded-full bg-brand-purple transition-[width] duration-300 ease-out"
                             [style.width.%]="porcentaje(c)"></div>
                      </div>
                    </li>
                  }
                </ul>
              } @else {
                <p class="text-xs text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
                  Selecciona permisos para ver cuánta gente cubre cada uno.
                </p>
              }
            </div>
          </aside>
        </div>

        <ng-container slot="footer">
          <p class="text-xs text-slate-400 dark:text-slate-500 font-medium hidden sm:block mr-auto">
            {{ pistaFormato() }}
          </p>
          <button type="button" (click)="cerrar.emit()" class="btn-secondary btn-sm">Cancelar</button>
          <!-- Excel en esmeralda: el mismo verde que ya usa la app para «positivo». -->
          <button type="button" (click)="emitirDescarga('xlsx')" [disabled]="!puedeDescargar()"
                  class="btn-primary btn-sm" style="--accent: #059669; --accent-hover: #047857">
            @if (descargando() === 'xlsx') {
              <span class="spinner-xs"></span>
              Generando...
            } @else {
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>
              </svg>
              Excel
            }
          </button>
          <button type="button" (click)="emitirDescarga('pdf')" [disabled]="!puedeDescargar()" class="btn-primary btn-sm">
            @if (descargando() === 'pdf') {
              <span class="spinner-xs"></span>
              Generando...
            } @else {
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Descargar PDF
            }
          </button>
        </ng-container>
    </app-modal>
  `,
  styles: [`
    /* Un solo acento y hairlines de 1px: el diálogo es un formulario largo y
       cualquier sombra o color extra lo vuelve ruido. */
    .rp-label {
      font-size: 0.75rem; font-weight: 800; letter-spacing: 0.06em;
      text-transform: uppercase; color: rgb(100 116 139); margin-bottom: 0.625rem;
    }
    :host-context(.dark) .rp-label { color: rgb(100 116 139); }

    .rp-sublabel {
      display: block; font-size: 0.75rem; font-weight: 700;
      color: rgb(148 163 184); margin-bottom: 0.375rem;
    }

    .rp-hint { margin-top: 0.5rem; font-size: 0.75rem; font-weight: 500; color: rgb(148 163 184); }
    .rp-hint-alerta { color: rgb(217 119 6); }

    .rp-link {
      font-size: 0.75rem; font-weight: 700; color: var(--color-brand-purple);
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
    .rp-card-on { border-color: var(--color-brand-purple); background: color-mix(in oklab, var(--color-brand-purple) 5%, transparent); }
    .rp-card-title { font-size: 0.75rem; font-weight: 700; color: rgb(30 41 59); }
    .rp-card-desc { font-size: 0.75rem; font-weight: 500; color: rgb(148 163 184); line-height: 1.45; }
    .rp-card-on .rp-card-title { color: var(--color-brand-purple); }
    :host-context(.dark) .rp-card { background: rgb(15 23 42 / 0.5); border-color: rgb(51 65 85); }
    :host-context(.dark) .rp-card-title { color: rgb(226 232 240); }
    :host-context(.dark) .rp-card-on { border-color: var(--color-brand-purple); background: color-mix(in oklab, var(--color-brand-purple) 15%, transparent); }
    :host-context(.dark) .rp-card-on .rp-card-title { color: rgb(196 181 253); }

    /* Chips */
    .rp-chip {
      height: 1.75rem; padding: 0 0.625rem; border-radius: 0.5rem;
      font-size: 0.75rem; font-weight: 700; color: rgb(100 116 139);
      background: #fff; border: 1px solid rgb(226 232 240);
      transition: border-color 150ms ease-out, color 150ms ease-out, background-color 150ms ease-out;
    }
    .rp-chip:hover { border-color: rgb(203 213 225); color: rgb(51 65 85); }
    .rp-chip-on { border-color: var(--color-brand-purple); background: color-mix(in oklab, var(--color-brand-purple) 8%, transparent); color: var(--color-brand-purple); }
    :host-context(.dark) .rp-chip { background: rgb(15 23 42 / 0.5); border-color: rgb(51 65 85); }
    :host-context(.dark) .rp-chip-on { background: color-mix(in oklab, var(--color-brand-purple) 20%, transparent); border-color: var(--color-brand-purple); color: rgb(196 181 253); }

    .rp-check {
      width: 0.9375rem; height: 0.9375rem; border-radius: 0.25rem;
      accent-color: var(--color-brand-purple); cursor: pointer;
    }

    @media (prefers-reduced-motion: reduce) {
      .rp-card, .rp-chip { transition: none; animation: none; }
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
