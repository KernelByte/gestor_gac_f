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
  peso_heuristico: 'Prioridades del algoritmo',
  composicion: 'Composición de la pareja',
  rotacion_ubicacion: 'Rotación por punto',
  restriccion_dura: 'Límites (reglas duras)',
  ventana_tiempo: 'Ventanas de tiempo',
};

@Component({
  selector: 'app-configuracion-exhibidores-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PageHeaderComponent, ExhibidoresTabsComponent],
  template: `
    <app-page-header
      title="Exhibidores"
      subtitle="Ajusta cómo decide el generador automático de turnos.">
      <button class="btn-primary-blue" [disabled]="!hayCambios() || guardando()" (click)="guardar()">
        {{ guardando() ? 'Guardando…' : 'Guardar cambios' }}
      </button>
    </app-page-header>

    <app-exhibidores-tabs />

    <!-- Modo de programación (preferencias de la congregación) -->
    <div class="mb-7" *ngIf="preferenciasVisibles().length > 0">
      <p class="section-title mb-1">Modo de programación</p>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Define cómo programa esta congregación. Se aplica en la próxima generación.
      </p>
      <div class="space-y-5">
        <div *ngFor="let pref of preferenciasVisibles()">
          <p class="text-sm font-semibold text-slate-800 dark:text-slate-200">{{ pref.label }}</p>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">{{ pref.description }}</p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button *ngFor="let op of pref.options"
                    class="text-left p-4 rounded-2xl border-2 transition-all focus-ring-blue"
                    [ngClass]="prefValores()[pref.key] === op.id
                      ? 'border-exh-600 bg-exh-50/70 dark:bg-exh-950/40 dark:border-exh-500'
                      : 'border-slate-200 dark:border-slate-700 hover:border-exh-300 dark:hover:border-exh-700'"
                    (click)="setPreferencia(pref.key, op.id)">
              <div class="flex items-center justify-between mb-1">
                <span class="font-semibold text-sm text-slate-900 dark:text-slate-100">{{ op.label }}</span>
                <span *ngIf="prefValores()[pref.key] === op.id" class="badge-active !text-[10px]">Activo</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{{ op.description }}</p>
            </button>
          </div>
        </div>
      </div>
      <p *ngIf="prefValores()['exh_modo_asignacion'] === 'fijo'"
         class="mt-3 text-xs text-slate-500 dark:text-slate-400 italic">
        En «Equipos fijos» el tope de turnos al mes y el límite de repeticiones por punto no se
        aplican: el titular sale todas las fechas de su turno.
      </p>
    </div>

    <!-- Perfiles -->
    <div class="mb-7">
      <p class="section-title mb-1">Perfiles rápidos</p>
      <p class="text-sm text-slate-500 dark:text-slate-400 mb-3">
        Un perfil ajusta todos los parámetros de una vez. Puedes afinar cualquier valor después.
      </p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button *ngFor="let p of perfiles()"
                class="text-left p-4 rounded-2xl border-2 transition-all focus-ring-blue"
                [ngClass]="perfilActivo() === p.id
                  ? 'border-exh-600 bg-exh-50/70 dark:bg-exh-950/40 dark:border-exh-500'
                  : 'border-slate-200 dark:border-slate-700 hover:border-exh-300 dark:hover:border-exh-700'"
                (click)="aplicarPerfil(p)">
          <div class="flex items-center justify-between mb-1">
            <span class="font-semibold text-sm text-slate-900 dark:text-slate-100">{{ p.label }}</span>
            <span *ngIf="perfilActivo() === p.id" class="badge-active !text-[10px]">Activo</span>
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{{ p.description }}</p>
        </button>
      </div>
      <p *ngIf="perfilActivo() === null && !cargando()" class="text-xs text-slate-400 mt-2 italic">
        Configuración personalizada (no coincide con ningún perfil).
      </p>
    </div>

    <!-- Skeleton -->
    <div *ngIf="cargando()" class="space-y-3">
      <div class="skeleton h-16 rounded-xl" *ngFor="let i of [1,2,3,4,5]"></div>
    </div>

    <!-- Parámetros por categoría -->
    <div *ngIf="!cargando()" class="space-y-7">
      <section *ngFor="let cat of categorias()">
        <p class="section-title mb-3">{{ cat.titulo }}</p>
        <div class="card-elevated divide-y divide-slate-100 dark:divide-slate-700/60">
          <div *ngFor="let param of cat.parametros" class="p-4">
            <div class="flex flex-col md:flex-row md:items-center gap-3">
              <div class="md:w-2/5">
                <p class="font-medium text-sm text-slate-800 dark:text-slate-200">{{ param.label }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{{ param.description }}</p>
              </div>
              <div class="flex items-center gap-4 flex-1">
                <input type="range" class="flex-1 accent-exh-600"
                       [min]="param.min_val" [max]="param.max_val" [step]="param.step"
                       [ngModel]="valores()[param.key]"
                       (ngModelChange)="setValor(param.key, $event)" />
                <span class="data-num text-sm font-semibold w-14 text-right"
                      [ngClass]="valores()[param.key] !== param.default
                        ? 'text-exh-600 dark:text-exh-400'
                        : 'text-slate-600 dark:text-slate-300'">
                  {{ valores()[param.key] }}
                </span>
                <button class="text-xs text-slate-400 hover:text-exh-600 dark:hover:text-exh-400 transition-colors"
                        [class.invisible]="valores()[param.key] === param.default"
                        (click)="setValor(param.key, param.default)"
                        title="Restaurar valor por defecto">
                  ↺
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
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
      .map(c => ({ titulo: CATEGORIAS[c] ?? c, parametros: grupos.get(c)! }));
  });

  private get idCong(): number | null {
    return this.ctx.effectiveCongregacionId();
  }

  ngOnInit(): void {
    this.cargar();
  }

  private cargar(): void {
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
      },
      error: () => {},
    });
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
    this.perfilActivo.set(null);
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
        this.toast.success('Configuración guardada', 'Se aplicará en la próxima generación.');
        this.svc.getPerfiles(this.idCong).subscribe({
          next: res => this.perfilActivo.set(res.perfil_activo),
        });
      },
      error: err => {
        this.guardando.set(false);
        this.toast.error('Error al guardar', err?.error?.detail ?? 'Revisa los valores.');
      },
    });
  }

  aplicarPerfil(p: PerfilAlgoritmo): void {
    this.svc.setPerfil(p.id, this.idCong).subscribe({
      next: () => {
        this.toast.success(`Perfil «${p.label}» aplicado`);
        this.cargar();
      },
      error: err => this.toast.error('Error', err?.error?.detail ?? 'No se pudo aplicar el perfil.'),
    });
  }
}
