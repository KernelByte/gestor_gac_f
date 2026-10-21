import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SalidaEditorComponent } from './salida-editor.component';
import {
  DIAS, FilaSemanaTipo, GrupoOpcion, Periodo, PersonaRef, SalidaForm, SalidasProgramaService, horaLegible,
} from '../services/salidas-programa.service';

/**
 * La semana tipo: las salidas que se repiten cada semana. Se arma una vez y con
 * ella se genera la semana o el mes. Aquí también se elige cómo trabaja la
 * congregación (por semana o por mes), que es una preferencia permanente.
 */
@Component({
  standalone: true,
  selector: 'app-semana-tipo',
  imports: [CommonModule, SalidaEditorComponent],
  template: `
    <div class="fixed inset-0 z-[110] flex items-center justify-center sm:p-4">
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" (click)="cerrar.emit(false)"></div>

      <div class="relative w-full max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[90vh] bg-white dark:bg-slate-800 sm:rounded-2xl sm:border border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-fadeIn">
        <header class="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-4 bg-gradient-to-r from-emerald-50/60 to-white dark:from-emerald-900/10 dark:to-slate-800">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
              <svg class="text-emerald-600 dark:text-emerald-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
            </div>
            <div class="min-w-0">
              <h3 class="text-base sm:text-lg font-black text-slate-900 dark:text-white leading-tight">Semana tipo</h3>
              <p class="text-[13px] text-slate-500 dark:text-slate-400">Las salidas que se repiten cada semana. Se usan para generar el programa.</p>
            </div>
          </div>
          <button (click)="cerrar.emit(false)" title="Cerrar" class="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors shrink-0">
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          <!-- Cómo trabaja la congregación -->
          <section class="rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <p class="text-sm font-bold text-slate-800 dark:text-slate-100">¿Cómo arma el programa su congregación?</p>
            <div class="mt-3 grid grid-cols-2 gap-2">
              @for (op of opcionesPeriodo; track op.id) {
                <button type="button" (click)="periodoSel.set(op.id)"
                  class="text-left p-3 rounded-xl border-2 transition-colors"
                  [class]="periodoSel() === op.id ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'">
                  <span class="block text-sm font-bold text-slate-900 dark:text-white">{{ op.titulo }}</span>
                  <span class="block text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">{{ op.detalle }}</span>
                </button>
              }
            </div>
          </section>

          <!-- Días -->
          <section class="space-y-2">
            @for (d of dias; track $index; let i = $index) {
              <div class="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div class="flex items-center justify-between px-4 h-12 bg-slate-50 dark:bg-slate-900/40">
                  <span class="text-sm font-black text-slate-800 dark:text-slate-100">{{ d }}</span>
                  <button type="button" (click)="nueva(i + 1)" class="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar salida
                  </button>
                </div>
                @for (f of porDia()[i]; track f) {
                  <button type="button" (click)="editar(f)" class="w-full text-left px-4 py-3 border-t border-slate-100 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex items-start gap-3">
                    <span class="w-20 shrink-0 text-sm font-bold text-slate-900 dark:text-white tabular-nums">{{ hora(f.hora_inicio) || 'Sin hora' }}</span>
                    <span class="min-w-0 flex-1">
                      <span class="block text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{{ f.lugar || 'Sin lugar' }}</span>
                      <span class="block text-[13px] text-slate-500 dark:text-slate-400 truncate">
                        {{ nombres(f.capitanes) || 'Sin capitán' }}@if (f.grupos.length) { · {{ gruposTexto(f) }} }@if (!f.sugerir_territorio) { · sin territorio }
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

        <footer class="px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700/50 flex items-center gap-2">
          <span class="mr-auto text-[13px] text-slate-500 dark:text-slate-400">{{ filas().length }} {{ filas().length === 1 ? 'salida' : 'salidas' }} por semana</span>
          <button (click)="cerrar.emit(false)" class="h-11 px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
          <button (click)="guardarTodo()" [disabled]="guardando()"
            class="h-11 px-5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-[background-color,transform] active:scale-[0.97]">
            {{ guardando() ? 'Guardando…' : 'Guardar semana tipo' }}
          </button>
        </footer>
      </div>
    </div>

    @if (editando(); as e) {
      <app-salida-editor
        modo="plantilla"
        [titulo]="e.fila ? 'Editar salida' : 'Nueva salida'"
        subtitulo="De la semana tipo"
        [inicial]="e.form"
        [capitanesIniciales]="e.fila?.capitanes ?? []"
        [publicadores]="publicadores"
        [grupos]="grupos"
        [puedeEliminar]="!!e.fila"
        (guardar)="aplicar($event)"
        (eliminar)="quitar()"
        (cancelar)="editando.set(null)" />
    }
  `,
})
export class SemanaTipoComponent implements OnInit {
  private svc = inject(SalidasProgramaService);

  @Input() inicial: FilaSemanaTipo[] = [];
  @Input() periodo: Periodo = 'semana';
  @Input() publicadores: PersonaRef[] = [];
  @Input() grupos: GrupoOpcion[] = [];
  /** true si se guardó. */
  @Output() cerrar = new EventEmitter<boolean>();

  readonly dias = DIAS;
  readonly hora = horaLegible;
  readonly opcionesPeriodo: { id: Periodo; titulo: string; detalle: string }[] = [
    { id: 'semana', titulo: 'Por semana', detalle: 'Se genera y se comparte cada semana.' },
    { id: 'mes', titulo: 'Por mes', detalle: 'Se genera y se comparte el mes completo.' },
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
      form: { dia_semana: dia, hora_inicio: null, lugar: null, notas: null, sugerir_territorio: true, capitanes: [], grupos: [] },
    });
  }

  editar(f: FilaSemanaTipo): void {
    this.editando.set({
      fila: f,
      form: {
        dia_semana: f.dia_semana, hora_inicio: f.hora_inicio ?? null, lugar: f.lugar ?? null, notas: f.notas ?? null,
        sugerir_territorio: f.sugerir_territorio, capitanes: f.capitanes.map(c => c.id_publicador), grupos: f.grupos.map(g => g.id_grupo),
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
      lugar: form.lugar,
      notas: form.notas,
      sugerir_territorio: form.sugerir_territorio ?? true,
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
      sugerir_territorio: f.sugerir_territorio, capitanes: f.capitanes.map(c => c.id_publicador), grupos: f.grupos.map(g => g.id_grupo),
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
