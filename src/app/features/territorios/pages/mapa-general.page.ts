import { Component, HostListener, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { TerritorioMapComponent } from '../components/territorio-map.component';
import { TerritoriosService } from '../services/territorios.service';
import { AuthStore } from '../../../core/auth/auth.store';
import { GeoJSONFeature, GeoJSONFeatureCollection, Sector, UnidadCongregacion } from '../models/territorio.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  standalone: true,
  selector: 'app-mapa-general-page',
  imports: [CommonModule, FormsModule, DatePipe, TerritorioMapComponent, PageHeaderComponent],
  template: `
    <div class="flex flex-col h-full overflow-hidden gap-5">
      <!-- Header -->
      <app-page-header
        spacing="none"
        title="Mapa General"
        subtitle="El territorio de la congregación, sus barrios y todas las tarjetas.">
        @if (unidad()) {
          <button (click)="alternarFicha()" [attr.aria-expanded]="verFicha()" class="btn-secondary focus-ring-green whitespace-nowrap">
            {{ verFicha() ? 'Ocultar límites' : 'Ver límites' }}
          </button>
        }
        @if (puedeEditar()) {
          <button (click)="elegirArchivo.click()" [disabled]="subiendo()"
            [class]="unidad() ? 'btn-secondary focus-ring-green whitespace-nowrap' : 'btn-primary-green focus-ring-green whitespace-nowrap'">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            {{ unidad() ? 'Subir otro archivo' : 'Subir archivo de JW (.kml)' }}
          </button>
        }
        <input #elegirArchivo type="file" accept=".kml,.kmz" class="hidden" (change)="alElegirArchivo($event)">
        <button (click)="goBack()" class="btn-secondary focus-ring-green whitespace-nowrap">
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Volver a Territorios
        </button>
      </app-page-header>

      @if (aviso()) {
        <div role="alert" class="shrink-0 flex items-start justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <p class="text-sm font-medium text-amber-900 dark:text-amber-200">{{ aviso() }}</p>
          <button (click)="aviso.set(null)" class="text-sm font-bold text-amber-800 dark:text-amber-300 shrink-0">Entendido</button>
        </div>
      }

      <!-- Resumen por estado y filtro por barrio -->
      <div class="flex flex-wrap items-center gap-2 shrink-0">
        @if (hayTerritorios()) {
          @for (e of estados; track e.clave) {
            <div class="inline-flex items-center gap-2.5 h-9 pl-3 pr-3.5 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 shadow-sm">
              <span class="w-3 h-3 rounded-[4px] border-2" [class]="e.punto"></span>
              <span class="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{{ e.label }}</span>
              <span class="text-[13px] font-black text-slate-900 dark:text-white tabular-nums">{{ conteo()[e.clave] ?? 0 }}</span>
            </div>
          }
        }
        @if (sectores().length > 0) {
          <div class="flex flex-wrap items-center gap-2 w-full" role="group" aria-label="Filtrar por barrio o sector">
            <button type="button" (click)="sectorSel.set(null)" [attr.aria-pressed]="sectorSel() === null"
              class="h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors"
              [ngClass]="sectorSel() === null ? 'bg-slate-200 text-slate-800 border-slate-400 dark:bg-slate-700 dark:text-slate-100' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'">Todos los barrios</button>
            @for (s of sectores(); track s.id_sector) {
              <button type="button" (click)="sectorSel.set(sectorSel() === s.id_sector ? null : s.id_sector)" [attr.aria-pressed]="sectorSel() === s.id_sector"
                class="h-9 px-3.5 rounded-full text-[13px] font-semibold border transition-colors inline-flex items-center gap-2"
                [ngClass]="sectorSel() === s.id_sector ? 'bg-slate-200 text-slate-800 border-slate-400 dark:bg-slate-700 dark:text-slate-100' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'">
                <span class="w-2.5 h-2.5 rounded-full" [style.background-color]="s.color || '#94a3b8'"></span>{{ s.nombre }}
              </button>
            }
          </div>
        }
        @if (hayTerritorios()) {
          <span class="ml-auto hidden sm:inline text-xs font-medium text-slate-400">Pase el cursor por un territorio para ver su ficha · clic para abrirlo</span>
        }
      </div>

      <div class="flex-1 min-h-0 flex flex-col lg:flex-row gap-4">
        <!-- Map -->
        <div class="relative flex-1 min-h-[22rem] bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden p-1.5">
          @if (loading()) {
            <div class="w-full h-full rounded-xl bg-slate-100 dark:bg-slate-900/60 animate-pulse flex items-center justify-center">
              <span class="text-sm text-slate-500 dark:text-slate-400 font-medium">Cargando el mapa…</span>
            </div>
          } @else {
            <app-territorio-map
              [geojson]="geojsonFiltrado()"
              [referenciasGeojson]="referencias()"
              [centroInicial]="centro()"
              height="100%"
              [interactive]="true"
              [showPopups]="true"
              (featureClick)="onFeatureClick($event)"
            />
            @if (!unidad() && !hayTerritorios()) {
              <div class="absolute left-1/2 -translate-x-1/2 bottom-6 z-[1000] w-[min(92%,28rem)] rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 shadow-xl p-4 text-center space-y-2">
                <p class="text-base font-bold text-slate-900 dark:text-white">Aún no se ve el territorio de la congregación</p>
                <p class="text-sm text-slate-600 dark:text-slate-400">
                  Suba el archivo <strong>.kml</strong> que descarga del sitio de la organización y aquí aparecerá el límite completo.
                </p>
              </div>
            }
          }
        </div>

        <!-- Ficha del territorio de la congregación, como en JW -->
        @if (verFicha() && unidad(); as u) {
          <aside class="relative lg:w-96 shrink-0 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-4" aria-label="Límites del territorio">
            <button type="button" (click)="cerrarFicha()" aria-label="Cerrar los límites" title="Cerrar (Esc)"
              class="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 focus-ring-green transition-colors active:scale-95">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div class="pr-10"><ng-container *ngTemplateOutlet="ficha; context: { u: u }"></ng-container></div>
            @if (puedeEditar()) {
              <button (click)="editarFicha()" class="btn-secondary focus-ring-green w-full justify-center mt-4">Corregir los datos</button>
            }
          </aside>
        }
      </div>
    </div>

    <ng-template #ficha let-u="u">
      <dl class="space-y-3 text-sm">
        <div><dt class="sr-only">Nombre</dt><dd class="text-lg font-black uppercase text-slate-900 dark:text-white">{{ u.nombre }}</dd></div>
        <div><dt class="text-slate-500 dark:text-slate-400">Tipo</dt><dd class="text-base text-slate-800 dark:text-slate-100">{{ u.tipo || '—' }}</dd></div>
        <div><dt class="text-slate-500 dark:text-slate-400">Idioma</dt><dd class="text-base text-slate-800 dark:text-slate-100">{{ u.idioma || '—' }}</dd></div>
        <div><dt class="text-slate-500 dark:text-slate-400">Última actualización</dt><dd class="text-base text-slate-800 dark:text-slate-100">{{ u.ultima_actualizacion ? (u.ultima_actualizacion | date:'d MMM y') : '—' }}</dd></div>
        <fieldset class="rounded-lg border border-slate-200 dark:border-slate-700 px-3 pb-3 pt-1 space-y-2">
          <legend class="px-1 text-base font-semibold text-slate-800 dark:text-slate-100">Límites</legend>
          <div><dt class="text-slate-500 dark:text-slate-400">Norte</dt><dd class="text-slate-800 dark:text-slate-100">{{ u.limite_norte || '—' }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">Este</dt><dd class="text-slate-800 dark:text-slate-100">{{ u.limite_este || '—' }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">Sur</dt><dd class="text-slate-800 dark:text-slate-100">{{ u.limite_sur || '—' }}</dd></div>
          <div><dt class="text-slate-500 dark:text-slate-400">Oeste</dt><dd class="text-slate-800 dark:text-slate-100">{{ u.limite_oeste || '—' }}</dd></div>
        </fieldset>
      </dl>
    </ng-template>

    <!-- Vista previa del archivo antes de guardarlo -->
    @if (vistaPrevia(); as vp) {
      <div class="fixed inset-0 z-[1100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="tituloPrevia">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="descartarVistaPrevia()"></div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col relative z-10 shadow-2xl overflow-hidden">
          <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
            <h3 id="tituloPrevia" class="text-lg font-black text-slate-900 dark:text-white">Así quedaría el territorio</h3>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Revise los datos. Al guardar, el límite aparecerá en el mapa.</p>
          </div>
          <div class="flex-1 overflow-y-auto p-5">
            <ng-container *ngTemplateOutlet="ficha; context: { u: vp[0] }"></ng-container>
          </div>
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end gap-3">
            <button (click)="descartarVistaPrevia()" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">Cancelar</button>
            <button (click)="guardarImportacion()" [disabled]="subiendo()" class="btn-primary-green focus-ring-green">Guardar territorio</button>
          </div>
        </div>
      </div>
    }

    <!-- Corregir los datos de la ficha -->
    @if (formFicha(); as u) {
      <div class="fixed inset-0 z-[1100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="tituloFicha">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="formFicha.set(null)"></div>
        <div class="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col relative z-10 shadow-2xl overflow-hidden">
          <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
            <h3 id="tituloFicha" class="text-lg font-black text-slate-900 dark:text-white">Corregir datos del territorio</h3>
          </div>
          <div class="flex-1 overflow-y-auto p-5 space-y-3">
            @for (c of camposFicha; track c.clave) {
              <div>
                <label [for]="'f_' + c.clave" class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">{{ c.etiqueta }}</label>
                <input [id]="'f_' + c.clave" [type]="c.clave === 'ultima_actualizacion' ? 'date' : 'text'" [(ngModel)]="$any(u)[c.clave]"
                  class="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-base text-slate-900 dark:text-white">
              </div>
            }
          </div>
          <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/20 flex justify-end gap-3">
            <button (click)="formFicha.set(null)" class="px-5 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl">Cancelar</button>
            <button (click)="guardarFicha()" [disabled]="!u.nombre.trim() || subiendo()" class="btn-primary-green focus-ring-green">Guardar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; height: 100%; }
  `],
})
export class MapaGeneralPage implements OnInit {
  private territoriosService = inject(TerritoriosService);
  private router = inject(Router);
  private authStore = inject(AuthStore);
  @ViewChild(TerritorioMapComponent) private mapa?: TerritorioMapComponent;

  puedeEditar = computed(() => {
    this.authStore.user();
    return this.authStore.hasPermission('territorios.editar');
  });

  readonly camposFicha: { clave: keyof UnidadCongregacion; etiqueta: string }[] = [
    { clave: 'nombre', etiqueta: 'Nombre' },
    { clave: 'tipo', etiqueta: 'Tipo' },
    { clave: 'idioma', etiqueta: 'Idioma' },
    { clave: 'ultima_actualizacion', etiqueta: 'Última actualización' },
    { clave: 'limite_norte', etiqueta: 'Límite norte' },
    { clave: 'limite_este', etiqueta: 'Límite este' },
    { clave: 'limite_sur', etiqueta: 'Límite sur' },
    { clave: 'limite_oeste', etiqueta: 'Límite oeste' },
  ];

  geojsonData = signal<GeoJSONFeatureCollection | null>(null);
  sectores = signal<Sector[]>([]);
  sectorSel = signal<number | null>(null);
  unidades = signal<UnidadCongregacion[]>([]);
  unidad = computed(() => this.unidades()[0] ?? null);
  centro = signal<{ lat: number; lng: number } | null>(null);
  loading = signal(true);
  aviso = signal<string | null>(null);
  verFicha = signal(false);
  subiendo = signal(false);
  vistaPrevia = signal<UnidadCongregacion[] | null>(null);
  formFicha = signal<UnidadCongregacion | null>(null);
  private archivoPrevia: File | null = null;

  /** Límite de la congregación y barrios dibujados, detrás de las tarjetas. */
  referencias = computed<GeoJSONFeatureCollection | null>(() => {
    const features: GeoJSONFeature[] = [
      ...this.unidades().filter(u => u.coordenada).map(u => ({
        type: 'Feature' as const, id: `u${u.id_unidad}`, properties: { codigo: '', limite: true }, geometry: u.coordenada!,
      })),
      ...this.sectores().filter(s => s.coordenada).map(s => ({
        type: 'Feature' as const, id: `s${s.id_sector}`, properties: { codigo: s.nombre, color: s.color || '#94a3b8' }, geometry: s.coordenada!,
      })),
    ];
    return features.length ? { type: 'FeatureCollection', features } : null;
  });

  geojsonFiltrado = computed<GeoJSONFeatureCollection | null>(() => {
    const g = this.geojsonData();
    const sel = this.sectorSel();
    if (!g || sel === null) return g;
    return { ...g, features: g.features.filter(f => f.properties?.['id_sector'] === sel) };
  });

  readonly estados = [
    { clave: 'Disponible', label: 'Disponible', punto: 'bg-emerald-200 border-emerald-600' },
    { clave: 'Asignado',   label: 'Asignado',   punto: 'bg-purple-200 border-purple-600' },
    { clave: 'En Pausa',   label: 'En pausa',   punto: 'bg-slate-200 border-slate-500' },
  ];
  private features = computed(() => ((this.geojsonData() as any)?.features ?? []) as any[]);
  hayTerritorios = computed(() => this.features().length > 0);
  conteo = computed(() => {
    const c: Partial<Record<string, number>> = {};
    for (const f of this.features()) {
      const e = f?.properties?.estado_territorio;
      if (e) c[e] = (c[e] ?? 0) + 1;
    }
    return c;
  });

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      tarjetas: this.territoriosService.getTerritoriosGeoJSON(),
      unidades: this.territoriosService.getCongregacionLimite(),
      sectores: this.territoriosService.getSectores(),
    }).subscribe({
      next: ({ tarjetas, unidades, sectores }) => {
        this.geojsonData.set(tarjetas);
        this.unidades.set(unidades);
        this.sectores.set(sectores.sectores);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.aviso.set('No se pudo cargar el mapa. Revise la conexión e intente de nuevo.');
      },
    });
    // Sin nada dibujado, el mapa abre en el salón.
    this.territoriosService.getMapaContexto().subscribe({ next: (r) => this.centro.set(r.centro) });
  }

  alElegirArchivo(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    this.subiendo.set(true);
    this.territoriosService.importarKml(archivo, false).subscribe({
      next: (r) => {
        this.subiendo.set(false);
        this.archivoPrevia = archivo;
        this.vistaPrevia.set(r.unidades);
      },
      error: (err) => {
        this.subiendo.set(false);
        this.aviso.set(err?.error?.detail ?? 'No se pudo leer el archivo. Verifique que sea el KML descargado del sitio de la organización.');
      },
    });
  }

  guardarImportacion(): void {
    if (!this.archivoPrevia) return;
    this.subiendo.set(true);
    this.territoriosService.importarKml(this.archivoPrevia, true).subscribe({
      next: (r) => {
        this.subiendo.set(false);
        this.unidades.set(r.unidades);
        this.descartarVistaPrevia();
        this.verFicha.set(true);
        // Esperar a que el mapa pinte el límite nuevo y llevarlo a la vista.
        setTimeout(() => this.mapa?.encuadrarReferencias());
      },
      error: (err) => {
        this.subiendo.set(false);
        this.aviso.set(err?.error?.detail ?? 'No se pudo guardar el territorio. Intente de nuevo.');
      },
    });
  }

  alternarFicha(): void {
    this.verFicha.set(!this.verFicha());
    setTimeout(() => this.mapa?.encuadrarReferencias());
  }

  /** Esc cierra el panel, salvo que haya una ventana encima (esa se cierra primero). */
  @HostListener('document:keydown.escape')
  cerrarFicha(): void {
    if (!this.verFicha() || this.vistaPrevia() || this.formFicha()) return;
    this.alternarFicha();
  }

  descartarVistaPrevia(): void {
    this.vistaPrevia.set(null);
    this.archivoPrevia = null;
  }

  editarFicha(): void {
    const u = this.unidad();
    if (u) this.formFicha.set({ ...u });
  }

  guardarFicha(): void {
    const u = this.formFicha();
    if (!u?.id_unidad) return;
    this.subiendo.set(true);
    this.territoriosService.actualizarCongregacionLimite(u.id_unidad, {
      nombre: u.nombre, tipo: u.tipo ?? null, idioma: u.idioma ?? null,
      ultima_actualizacion: u.ultima_actualizacion || null,
      limite_norte: u.limite_norte ?? null, limite_este: u.limite_este ?? null,
      limite_sur: u.limite_sur ?? null, limite_oeste: u.limite_oeste ?? null,
    }).subscribe({
      next: (nueva) => {
        this.subiendo.set(false);
        this.unidades.update(l => l.map(x => x.id_unidad === nueva.id_unidad ? nueva : x));
        this.formFicha.set(null);
      },
      error: (err) => {
        this.subiendo.set(false);
        this.aviso.set(err?.error?.detail ?? 'No se pudieron guardar los cambios.');
      },
    });
  }

  onFeatureClick(feature: any): void {
    if (feature?.id) {
      this.router.navigate(['/territorios'], { queryParams: { selected: feature.id } });
    }
  }

  goBack(): void {
    this.router.navigate(['/territorios']);
  }
}
