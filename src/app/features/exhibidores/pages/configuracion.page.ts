import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, forkJoin } from 'rxjs';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ExhibidoresTabsComponent } from '../components/exhibidores-tabs.component';
import { ExhibidoresService } from '../services/exhibidores.service';
import { ParametroAlgoritmo, PerfilAlgoritmo, PreferenciaExhibidor } from '../models/exhibidor.model';

const CATEGORIAS: Record<string, string> = {
  peso_heuristico: 'A quién se prefiere al elegir',
  composicion: 'Cómo se forma la pareja',
  rotacion_ubicacion: 'Cambiar de lugar entre salidas',
  restriccion_dura: 'Límites que nunca se pasan',
  ventana_tiempo: 'Periodos de tiempo que se miran',
};

/**
 * El único parámetro numérico que cualquiera entiende y que otras pantallas
 * citan («Lo normal (se define en Configuración)» en la ficha del
 * participante): va arriba, fuera de los ajustes finos.
 */
const PARAM_TOPE_MES = 'exh_max_turnos_mes_default';

@Component({
  selector: 'app-configuracion-exhibidores-page',
  host: { class: 'tema-exhibidores' },
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, ExhibidoresTabsComponent],
  template: `
    <app-page-header
      title="Exhibidores"
      subtitle="Cómo reparte el sistema los turnos al generar un mes. Lo de arriba es lo importante; los ajustes finos casi nunca hace falta tocarlos.">
      <button class="btn-primary-blue" [disabled]="!hayCambios() || guardando()" (click)="guardar()">
        {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </app-page-header>

    <app-exhibidores-tabs />

    <!-- Fila de un parámetro: se usa para el tope del mes (arriba) y para
         cada ajuste fino (abajo), así los dos se manejan igual. -->
    <ng-template #filaParametro let-param>
      <div class="flex flex-col md:flex-row md:items-center gap-3">
        <div class="md:w-2/5">
          <p class="font-medium text-sm text-slate-800 dark:text-slate-200">{{ param.label }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ param.description }}</p>
        </div>
        <div class="flex items-center gap-4 flex-1">
          <input type="range" class="flex-1 min-h-10 accent-exh-600"
                 [min]="param.min_val" [max]="param.max_val" [step]="param.step"
                 [attr.aria-label]="param.label"
                 [ngModel]="valores()[param.key]"
                 (ngModelChange)="setValor(param.key, $event)" />
          <span class="data-num text-sm font-semibold w-14 text-right"
                [ngClass]="valores()[param.key] !== param.default
                  ? 'text-exh-600 dark:text-exh-400'
                  : 'text-slate-600 dark:text-slate-300'">
            {{ valores()[param.key] }}
          </span>
          <!-- Texto visible en vez del antiguo «↺» sin etiqueta: se entiende
               sin adivinar y es un blanco más fácil de acertar. -->
          <button type="button" class="btn-link text-xs w-28 text-left"
                  [class.invisible]="valores()[param.key] === param.default"
                  (click)="setValor(param.key, param.default)">
            Volver a {{ param.default }}
          </button>
        </div>
      </div>
    </ng-template>

    <!-- 1 · Cómo se programa (preferencias de la congregación) -->
    <section class="mb-8" *ngIf="preferenciasVisibles().length > 0">
      <h2 class="section-title mb-1">Cómo se programa</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Se usa la próxima vez que generes un mes; lo ya generado no cambia.
      </p>
      <div class="space-y-5">
        <div *ngFor="let pref of preferenciasVisibles()">
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ pref.label }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">{{ pref.description }}</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3" role="radiogroup" [attr.aria-label]="pref.label">
            <button *ngFor="let op of pref.options" type="button" role="radio"
                    [attr.aria-checked]="prefValores()[pref.key] === op.id"
                    class="text-left p-4 rounded-2xl border-2 transition-all focus-ring-blue"
                    [ngClass]="prefValores()[pref.key] === op.id
                      ? 'border-exh-600 bg-exh-50/70 dark:bg-exh-950/40 dark:border-exh-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-exh-300 dark:hover:border-exh-700'"
                    (click)="setPreferencia(pref.key, op.id)">
              <div class="flex items-center justify-between mb-1">
                <span class="font-semibold text-sm text-slate-900 dark:text-slate-100">{{ op.label }}</span>
                <span *ngIf="prefValores()[pref.key] === op.id" class="badge-active">Elegido</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{{ op.description }}</p>
            </button>
          </div>
        </div>
      </div>
      <p *ngIf="prefValores()['exh_modo_asignacion'] === 'fijo'"
         class="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Con «Equipos fijos» no se aplican el máximo de salidas al mes ni el límite de repetir lugar:
        cada equipo sale en todas las fechas de su turno.
      </p>
    </section>

    <!-- Skeleton -->
    <div *ngIf="cargando()" class="space-y-3">
      <div class="skeleton h-16 rounded-xl" *ngFor="let i of [1,2,3,4,5]"></div>
    </div>

    <!-- 2 · Salidas al mes por persona -->
    <section *ngIf="!cargando() && paramTopeMes() as tope" class="mb-8">
      <h2 class="section-title mb-1">Salidas al mes por persona</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Cada participante sale como máximo estas veces al mes, salvo que en su ficha diga otra cosa.
      </p>
      <div class="card-elevated p-4">
        <ng-container *ngTemplateOutlet="filaParametro; context: { $implicit: tope }" />
      </div>
    </section>

    <!-- 3 · Estilo de reparto (perfiles) -->
    <section class="mb-8">
      <h2 class="section-title mb-1">Estilo de reparto</h2>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Elige uno para ajustar de una vez todos los ajustes finos de abajo. Luego guarda los cambios.
      </p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button *ngFor="let p of perfiles()" type="button"
                class="text-left p-4 rounded-2xl border-2 transition-all focus-ring-blue"
                [attr.aria-pressed]="perfilActivo() === p.id"
                [ngClass]="perfilActivo() === p.id
                  ? 'border-exh-600 bg-exh-50/70 dark:bg-exh-950/40 dark:border-exh-500'
                  : 'border-slate-200 dark:border-slate-700 hover:border-exh-300 dark:hover:border-exh-700'"
                (click)="aplicarPerfil(p)">
          <div class="flex items-center justify-between mb-1">
            <span class="font-semibold text-sm text-slate-900 dark:text-slate-100">{{ p.label }}</span>
            <span *ngIf="perfilActivo() === p.id" class="badge-active">Elegido</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{{ p.description }}</p>
        </button>
      </div>
      <p *ngIf="perfilActivo() === null && !cargando()" class="text-xs text-slate-500 dark:text-slate-400 mt-2">
        Ahora mismo usas ajustes propios (no coinciden con ningún estilo).
      </p>
    </section>

    <!-- 4 · Ajustes finos: plegados. Son pesos del generador; a la mayoría
         le basta con el estilo de reparto, y verlos de entrada asusta. -->
    <section *ngIf="!cargando() && categorias().length > 0" class="mb-8">
      <button type="button" class="flex items-center gap-2 text-left min-h-10 focus-ring-blue rounded-xl"
              [attr.aria-expanded]="avanzadoAbierto()" (click)="avanzadoAbierto.set(!avanzadoAbierto())">
        <svg class="w-4 h-4 shrink-0 text-slate-500 transition-transform duration-200" [class.rotate-90]="avanzadoAbierto()"
             fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/>
        </svg>
        <span>
          <span class="block section-title">Ajustes finos</span>
          <span class="block text-sm text-slate-500 dark:text-slate-400">
            Para quien quiera afinar el reparto a mano. Si no estás seguro, no los cambies.
          </span>
        </span>
      </button>

      <div *ngIf="avanzadoAbierto()" class="space-y-7 mt-4 animate-fadeIn">
        <div *ngFor="let cat of categorias()">
          <h3 class="card-title mb-3">{{ cat.titulo }}</h3>
          <div class="card-elevated divide-y divide-slate-100 dark:divide-slate-700/60">
            <div *ngFor="let param of cat.parametros" class="p-4">
              <ng-container *ngTemplateOutlet="filaParametro; context: { $implicit: param }" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Barra de guardado: el botón de la cabecera queda fuera de vista al
         bajar por los ajustes; esta lo acompaña mientras haya cambios. -->
    <div *ngIf="hayCambios()"
         class="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl
                border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg animate-fadeIn"
         role="status">
      <p class="text-sm font-medium text-slate-700 dark:text-slate-200">Tienes cambios sin guardar.</p>
      <div class="flex gap-2">
        <button type="button" class="btn-ghost" (click)="descartar()">Descartar</button>
        <button type="button" class="btn-primary-blue" [disabled]="guardando()" (click)="guardar()">
          {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
        </button>
      </div>
    </div>
  `,
})
export class ConfiguracionExhibidoresPage implements OnInit {
  private svc = inject(ExhibidoresService);
  private ctx = inject(CongregacionContextService);
  private toast = inject(ToastService);

  cargando = signal(true);
  guardando = signal(false);
  parametros = signal<ParametroAlgoritmo[]>([]);
  perfiles = signal<PerfilAlgoritmo[]>([]);
  perfilActivo = signal<string | null>(null);
  valores = signal<Record<string, number>>({});
  private valoresOriginales: Record<string, number> = {};
  private perfilOriginal: string | null = null;

  avanzadoAbierto = signal(false);

  preferencias = signal<PreferenciaExhibidor[]>([]);
  prefValores = signal<Record<string, string>>({});
  private prefOriginales: Record<string, string> = {};

  /** Oculta las preferencias que dependen de otra (ej. titulares solo en modo fijo). */
  preferenciasVisibles = computed(() => {
    const vals = this.prefValores();
    return this.preferencias().filter(p =>
      !p.solo_si || Object.entries(p.solo_si).every(([k, v]) => vals[k] === v),
    );
  });

  hayCambios = computed(() => {
    const v = this.valores();
    const p = this.prefValores();
    return Object.keys(v).some(k => v[k] !== this.valoresOriginales[k])
      || Object.keys(p).some(k => p[k] !== this.prefOriginales[k]);
  });

  categorias = computed(() => {
    const grupos = new Map<string, ParametroAlgoritmo[]>();
    for (const p of this.parametros()) {
      if (!grupos.has(p.category)) grupos.set(p.category, []);
      grupos.get(p.category)!.push(p);
    }
    const orden = [
      'peso_heuristico', 'composicion', 'rotacion_ubicacion',
      'restriccion_dura', 'ventana_tiempo',
    ];
    return orden
      .filter(c => grupos.has(c))
      .map(c => ({
        titulo: CATEGORIAS[c] ?? c,
        parametros: grupos.get(c)!.filter(p => p.key !== PARAM_TOPE_MES),
      }))
      .filter(c => c.parametros.length > 0);
  });

  paramTopeMes = computed(() => this.parametros().find(p => p.key === PARAM_TOPE_MES) ?? null);

  private get idCong(): number | null {
    return this.ctx.effectiveCongregacionId();
  }

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
    this.cargarParametros();
    this.cargarPreferencias();
  }

  private cargarParametros(): void {
    this.cargando.set(true);
    this.svc.getParametros(this.idCong).subscribe({
      next: res => {
        this.parametros.set(res.parametros);
        const vals: Record<string, number> = {};
        for (const p of res.parametros) vals[p.key] = p.value;
        this.valores.set(vals);
        this.valoresOriginales = { ...vals };
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.toast.error('Error', 'No se pudo cargar la configuración.');
      },
    });
    this.svc.getPerfiles(this.idCong).subscribe({
      next: res => {
        this.perfiles.set(res.perfiles);
        this.perfilActivo.set(res.perfil_activo);
        this.perfilOriginal = res.perfil_activo;
      },
      error: () => {},
    });
  }

  private cargarPreferencias(): void {
    this.svc.getPreferencias(this.idCong).subscribe({
      next: res => {
        this.preferencias.set(res.preferencias);
        this.prefValores.set({ ...res.valores });
        this.prefOriginales = { ...res.valores };
      },
      error: () => {},
    });
  }

  setValor(key: string, valor: number): void {
    this.valores.update(v => ({ ...v, [key]: Number(valor) }));
    const v = this.valores();
    const coincide = this.perfiles().find(p =>
      Object.entries(p.valores).every(([k, val]) => k === PARAM_TOPE_MES || v[k] === val));
    this.perfilActivo.set(coincide?.id ?? null);
  }

  descartar(): void {
    this.valores.set({ ...this.valoresOriginales });
    this.prefValores.set({ ...this.prefOriginales });
    this.perfilActivo.set(this.perfilOriginal);
  }

  setPreferencia(key: string, valor: string): void {
    this.prefValores.update(v => ({ ...v, [key]: valor }));
  }

  guardar(): void {
    this.guardando.set(true);
    const v = this.valores();
    const cambios: Record<string, number> = {};
    for (const k of Object.keys(v)) {
      if (v[k] !== this.valoresOriginales[k]) cambios[k] = v[k];
    }
    const p = this.prefValores();
    const cambiosPref: Record<string, string> = {};
    for (const k of Object.keys(p)) {
      if (p[k] !== this.prefOriginales[k]) cambiosPref[k] = p[k];
    }

    const peticiones: Observable<unknown>[] = [];
    if (Object.keys(cambios).length) peticiones.push(this.svc.setParametros(cambios, this.idCong));
    if (Object.keys(cambiosPref).length) peticiones.push(this.svc.setPreferencias(cambiosPref, this.idCong));
    if (!peticiones.length) {
      this.guardando.set(false);
      return;
    }

    forkJoin(peticiones).subscribe({
      next: () => {
        this.guardando.set(false);
        this.valoresOriginales = { ...v };
        this.prefOriginales = { ...p };
        this.toast.success('Configuración guardada', 'Se usará la próxima vez que generes un mes.');
        this.svc.getPerfiles(this.idCong).subscribe({
          next: res => {
            this.perfilActivo.set(res.perfil_activo);
            this.perfilOriginal = res.perfil_activo;
          },
        });
      },
      error: err => {
        this.guardando.set(false);
        this.toast.error('Error al guardar', err?.error?.detail ?? 'Revisa los valores.');
      },
    });
  }

  /** Aplica el perfil en pantalla; se guarda con «Guardar cambios» y se
   *  deshace con «Descartar», igual que cualquier otro ajuste. */
  aplicarPerfil(p: PerfilAlgoritmo): void {
    // El tope mensual tiene su propia sección: un estilo no debe pisarlo.
    const { [PARAM_TOPE_MES]: _tope, ...sinTope } = p.valores;
    this.valores.update(v => ({ ...v, ...sinTope }));
    this.perfilActivo.set(p.id);
  }

}

