import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModalComponent } from '../../../shared/components/modal/modal.component';
import { SalidaEditorComponent } from './salida-editor.component';
import { MarcaZoomComponent } from './marca-zoom.component';
import { PuntoSalidaOpcion } from '../models/territorio.model';
import {
  DIAS, FilaSemanaTipo, GrupoOpcion, Periodo, PersonaRef, SalidaForm, SalidasProgramaService, horaLegible,
} from '../services/salidas-programa.service';

/**
 * Las salidas fijas (semana tipo): las que se repiten cada semana. Se arman una vez y con
 * ella se genera la semana o el mes. Aquí también se elige cómo trabaja la
 * congregación (por semana o por mes), que es una preferencia permanente.
 */
@Component({
  standalone: true,
  selector: 'app-semana-tipo',
  imports: [CommonModule, SalidaEditorComponent, ModalComponent, MarcaZoomComponent],
  template: `
    <app-modal [open]="true" size="xl" title="Salidas fijas" subtitle="Las salidas que se repiten cada semana. Con ellas se crea el programa."
               [hasFooter]="true" [dismissible]="!editando()" (openChange)="$event || cerrar.emit(false)">
        <div class="space-y-5">
          <!-- Cómo trabaja la congregación -->
          <section class="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <p class="text-sm font-bold text-slate-800 dark:text-slate-100">¿Cada cuánto crea y comparte el programa?</p>
            <div class="mt-3 grid grid-cols-2 gap-2">
              @for (op of opcionesPeriodo; track op.id) {
                <button type="button" (click)="periodoSel.set(op.id)"
                  class="text-left p-3 rounded-xl border-2 transition-colors"
                  [class]="periodoSel() === op.id ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'">
                  <span class="block text-sm font-bold text-slate-900 dark:text-white">{{ op.titulo }}</span>
                  <span class="block text-sm text-slate-500 dark:text-slate-400 mt-0.5">{{ op.detalle }}</span>
                </button>
              }
            </div>
          </section>

          <!-- Días -->
          <section class="space-y-2">
            @for (d of dias; track $index; let i = $index) {
              <div class="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div class="flex items-center justify-between px-4 h-12 bg-slate-50 dark:bg-slate-900/40">
                  <span class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ d }}</span>
                  <button type="button" (click)="nueva(i + 1)" class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar salida
                  </button>
                </div>
                @for (f of porDia()[i]; track f) {
                  <button type="button" (click)="editar(f)" class="w-full text-left px-4 py-3 border-t border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex items-start gap-3">
                    <span class="w-20 shrink-0 text-sm font-bold text-slate-900 dark:text-white tabular-nums">{{ hora(f.hora_inicio) || 'Sin hora' }}</span>
                    <span class="min-w-0 flex-1">
                      @if (f.por_zoom) {
                        <span class="flex items-center gap-1.5 text-sm font-semibold text-blue-700 dark:text-blue-300"><app-marca-zoom [tam]="16" /> Zoom</span>
                      } @else {
                        <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ f.lugar || 'Sin lugar' }}</span>
                      }
                      <span class="block text-sm text-slate-500 dark:text-slate-400 truncate">
                        {{ nombres(f.capitanes) || 'Capitán: se turnan' }}@if (f.grupos.length) { · {{ gruposTexto(f) }} }@if (f.nombre_barrio && !f.por_zoom) { · Barrio {{ f.nombre_barrio }} }
                      </span>
                    </span>
                  </button>
                }
              </div>
            }
          </section>

          @if (error()) {
            <p class="text-sm font-semibold text-red-600 dark:text-red-400">{{ error() }}</p>
          }
        </div>

        <ng-container slot="footer">
          <span class="mr-auto text-sm text-slate-500 dark:text-slate-400">{{ filas().length }} {{ filas().length === 1 ? 'salida' : 'salidas' }} por semana</span>
          <button (click)="cerrar.emit(false)" class="btn-ghost">Cancelar</button>
          <button (click)="guardarTodo()" [disabled]="guardando()" class="btn-primary">
            {{ guardando() ? 'Guardando…' : 'Guardar salidas fijas' }}
          </button>
        </ng-container>
    </app-modal>

    @if (editando(); as e) {
      <!-- El cajón (z drawer) iría debajo de este diálogo (z modal): la capa lo sube por encima. -->
      <div class="relative" style="z-index: calc(var(--z-modal) + 1)">
      <app-salida-editor
        modo="plantilla"
        [titulo]="e.fila ? 'Editar salida' : 'Nueva salida'"
        subtitulo="De las salidas fijas"
        [inicial]="e.form"
        [capitanesIniciales]="e.fila?.capitanes ?? []"
        [publicadores]="publicadores"
        [grupos]="grupos"
        [barrios]="barrios"
        [puntosSalida]="puntosSalida"
        [capitanesHabilitados]="capitanesHabilitados"
        [usaZoom]="usaZoom"
        [tieneEnlaceZoom]="tieneEnlaceZoom"
        [puedeEliminar]="!!e.fila"
        (guardar)="aplicar($event)"
        (eliminar)="quitar()"
        (cancelar)="editando.set(null)" />
      </div>
    }
  `,
})
export class SemanaTipoComponent implements OnInit {
  private svc = inject(SalidasProgramaService);

  @Input() inicial: FilaSemanaTipo[] = [];
  @Input() periodo: Periodo = 'semana';
  @Input() publicadores: PersonaRef[] = [];
  @Input() grupos: GrupoOpcion[] = [];
  @Input() capitanesHabilitados: PersonaRef[] = [];
  @Input() barrios: Array<{ id_sector: number; nombre: string }> = [];
  @Input() puntosSalida: PuntoSalidaOpcion[] = [];
  @Input() usaZoom = false;
  @Input() tieneEnlaceZoom = true;
  /** true si se guardó. */
  @Output() cerrar = new EventEmitter<boolean>();

  readonly dias = DIAS;
  readonly hora = horaLegible;
  readonly opcionesPeriodo: { id: Periodo; titulo: string; detalle: string }[] = [
    { id: 'semana', titulo: 'Por semana', detalle: 'Se crea y se comparte cada semana.' },
    { id: 'mes', titulo: 'Por mes', detalle: 'Se crea y se comparte el mes completo.' },
  ];

  filas = signal<FilaSemanaTipo[]>([]);
  periodoSel = signal<Periodo>('semana');
  editando = signal<{ fila: FilaSemanaTipo | null; form: SalidaForm } | null>(null);
  guardando = signal(false);
  error = signal<string | null>(null);

  porDia = computed(() => {
    const dias: FilaSemanaTipo[][] = [[], [], [], [], [], [], []];
    for (const f of this.filas()) dias[f.dia_semana - 1].push(f);
    for (const d of dias) d.sort((a, b) => (a.hora_inicio ?? '99').localeCompare(b.hora_inicio ?? '99'));
    return dias;
  });

  ngOnInit(): void {
    this.filas.set(this.inicial.map(f => ({ ...f, capitanes: [...f.capitanes], grupos: [...f.grupos] })));
    this.periodoSel.set(this.periodo);
  }

  nombres(l: PersonaRef[]): string { return l.map(p => p.nombre).join(', '); }
  gruposTexto(f: FilaSemanaTipo): string { return f.grupos.map(g => g.nombre).join(', '); }

  nueva(dia: number): void {
    this.editando.set({
      fila: null,
      form: { dia_semana: dia, hora_inicio: null, lugar: null, notas: null, por_zoom: false, id_sector: null, id_punto_salida: null, capitanes: [], grupos: [] },
    });
  }

  editar(f: FilaSemanaTipo): void {
    this.editando.set({
      fila: f,
      form: {
        dia_semana: f.dia_semana, hora_inicio: f.hora_inicio ?? null, lugar: f.lugar ?? null, notas: f.notas ?? null,
        por_zoom: !!f.por_zoom, id_sector: f.id_sector ?? null, id_punto_salida: f.id_punto_salida ?? null,
        capitanes: f.capitanes.map(c => c.id_publicador), grupos: f.grupos.map(g => g.id_grupo),
      },
    });
  }

  aplicar(form: SalidaForm): void {
    const e = this.editando();
    if (!e) return;
    const porId = new Map(this.publicadores.map(p => [p.id_publicador, p]));
    const grupoPorId = new Map(this.grupos.map(g => [g.id_grupo, g]));
    const fila: FilaSemanaTipo = {
      dia_semana: form.dia_semana!,
      hora_inicio: form.hora_inicio,
      lugar: form.por_zoom ? 'Zoom' : form.lugar ?? this.puntosSalida.find(p => p.id_punto === form.id_punto_salida)?.nombre ?? null,
      notas: form.notas,
      por_zoom: !!form.por_zoom,
      id_sector: form.id_sector ?? null,
      nombre_barrio: this.barrios.find(b => b.id_sector === form.id_sector)?.nombre ?? null,
      id_punto_salida: form.id_punto_salida ?? null,
      nombre_punto_salida: this.puntosSalida.find(p => p.id_punto === form.id_punto_salida)?.nombre ?? null,
      capitanes: form.capitanes.map(id => porId.get(id) ?? e.fila?.capitanes.find(c => c.id_publicador === id) ?? { id_publicador: id, nombre: '' }),
      grupos: form.grupos.map(id => ({ id_grupo: id, nombre: grupoPorId.get(id)?.nombre ?? '' })),
    };
    this.filas.update(l => (e.fila ? l.map(x => (x === e.fila ? fila : x)) : [...l, fila]));
    this.editando.set(null);
  }

  quitar(): void {
    const e = this.editando();
    if (e?.fila) this.filas.update(l => l.filter(x => x !== e.fila));
    this.editando.set(null);
  }

  guardarTodo(): void {
    this.guardando.set(true);
    this.error.set(null);
    const payload: SalidaForm[] = this.filas().map(f => ({
      dia_semana: f.dia_semana, hora_inicio: f.hora_inicio ?? null, lugar: f.lugar ?? null, notas: f.notas ?? null,
      por_zoom: !!f.por_zoom, id_sector: f.id_sector ?? null, id_punto_salida: f.id_punto_salida ?? null,
      capitanes: f.capitanes.map(c => c.id_publicador), grupos: f.grupos.map(g => g.id_grupo),
    }));
    this.svc.guardarSemanaTipo(payload).subscribe({
      next: () => {
        const fin = () => { this.guardando.set(false); this.cerrar.emit(true); };
        if (this.periodoSel() === this.periodo) return fin();
        this.svc.guardarPeriodo(this.periodoSel()).subscribe({ next: fin, error: (e) => this.fallo(e) });
      },
      error: (e) => this.fallo(e),
    });
  }

  private fallo(e: any): void {
    this.guardando.set(false);
    this.error.set(typeof e?.error?.detail === 'string' ? e.error.detail : 'No se pudo guardar. Intente de nuevo.');
  }
}
