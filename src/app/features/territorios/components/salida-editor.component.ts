import { Component, EventEmitter, Input, OnInit, Output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PickerOption, SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';
import { DIAS, GrupoOpcion, PersonaRef, SalidaForm } from '../services/salidas-programa.service';

export interface OpcionTerritorio { id_territorio: number; etiqueta: string; detalle: string; }

/**
 * Panel lateral para una salida del programa o una fila de la semana tipo.
 * Pensado para el encargado de territorios: pocos campos, en orden, sin jerga.
 */
@Component({
  standalone: true,
  selector: 'app-salida-editor',
  imports: [CommonModule, FormsModule, SelectPickerComponent],
  template: `
    <div class="fixed inset-0 z-[120] flex justify-end">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] anim-fade" (click)="cancelar.emit()"></div>

      <aside class="relative w-full sm:max-w-md h-full bg-white dark:bg-slate-800 sm:border-l border-slate-200 dark:border-slate-700 shadow-2xl flex flex-col anim-panel"
             role="dialog" aria-modal="true" [attr.aria-label]="titulo">
        <header class="px-5 py-4 border-b border-slate-100 dark:border-slate-700/60 flex items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white">{{ titulo }}</h3>
            @if (subtitulo) { <p class="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">{{ subtitulo }}</p> }
          </div>
          <button (click)="cancelar.emit()" title="Cerrar" class="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <!-- Cuándo -->
          @if (modo === 'plantilla') {
            <div>
              <label class="lbl">Día</label>
              <div class="grid grid-cols-7 gap-1.5">
                @for (d of dias; track $index) {
                  <button type="button" (click)="form.dia_semana = $index + 1" [title]="d"
                    class="h-10 rounded-xl text-sm font-bold transition-colors"
                    [class]="form.dia_semana === $index + 1 ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-700/70 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'">
                    {{ d.slice(0, 2) }}
                  </button>
                }
              </div>
            </div>
          } @else {
            <div>
              <label class="lbl" for="se-fecha">Fecha</label>
              <input id="se-fecha" type="date" [(ngModel)]="form.fecha_programada" class="campo" />
            </div>
          }
          <div>
            <label class="lbl" for="se-hora">Hora</label>
            <input id="se-hora" type="time" [(ngModel)]="form.hora_inicio" class="campo" />
          </div>

          <!-- Dónde -->
          <div>
            <label class="lbl" for="se-lugar">Lugar de reunión</label>
            <input id="se-lugar" type="text" [(ngModel)]="form.lugar" maxlength="200" placeholder="Ej.: Familia Sierra, Zoom, Salón del Reino" class="campo" />
          </div>

          <!-- Quién -->
          <div>
            <label class="lbl">Grupos <span class="opc">(opcional)</span></label>
            @if (grupos.length) {
              <div class="flex flex-wrap gap-1.5">
                @for (g of grupos; track g.id_grupo) {
                  <button type="button" (click)="alternarGrupo(g)"
                    class="h-9 px-3 rounded-full text-[13px] font-semibold border transition-colors"
                    [class]="tieneGrupo(g.id_grupo) ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-200' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-300'">
                    {{ g.nombre }}
                  </button>
                }
              </div>
              <p class="ayuda">Al elegir un grupo se agrega su capitán.</p>
            } @else {
              <p class="ayuda">La congregación todavía no tiene grupos.</p>
            }
          </div>

          <div>
            <label class="lbl" for="se-capitan">Capitanes</label>
            @if (capitanes().length) {
              <div class="flex flex-wrap gap-1.5 mb-2">
                @for (c of capitanes(); track c.id_publicador) {
                  <span class="inline-flex items-center gap-1 h-9 pl-3 pr-1 rounded-full bg-slate-100 dark:bg-slate-700 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    {{ c.nombre }}
                    <button type="button" (click)="quitarCapitan(c.id_publicador)" [title]="'Quitar a ' + c.nombre"
                      class="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-white dark:hover:bg-slate-600 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </span>
                }
              </div>
            }
            <div class="relative">
              <input id="se-capitan" type="text" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)"
                (keydown.enter)="$event.preventDefault(); primerResultado()"
                placeholder="Escriba un nombre para agregar" autocomplete="off" class="campo" />
              @if (resultados().length) {
                <ul class="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl overflow-hidden">
                  @for (p of resultados(); track p.id_publicador) {
                    <li>
                      <button type="button" (click)="agregarCapitan(p)" class="w-full text-left px-3.5 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">{{ p.nombre }}</button>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>

          <!-- Territorio -->
          @if (modo === 'plantilla') {
            <label class="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
              <input type="checkbox" [(ngModel)]="form.sugerir_territorio" class="mt-0.5 w-5 h-5 accent-emerald-600" />
              <span>
                <span class="block text-sm font-bold text-slate-800 dark:text-slate-100">Ponerle territorio al generar</span>
                <span class="block text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">Se elige el que lleva más tiempo sin trabajarse. Desmárquelo para salidas por Zoom o cartas.</span>
              </span>
            </label>
          } @else {
            <div>
              <label class="lbl" for="se-terr">Territorio <span class="opc">(opcional)</span></label>
              <app-select-picker colorScheme="emerald" ariaLabel="Territorio" [(ngModel)]="form.id_territorio"
                [options]="opcionesTerritorio()" placeholder="Sin territorio" />
              <p class="ayuda">Primero los que llevan más tiempo sin trabajarse.</p>
            </div>
          }

          <div>
            <label class="lbl" for="se-notas">Notas <span class="opc">(opcional)</span></label>
            <input id="se-notas" type="text" [(ngModel)]="form.notas" placeholder="Ej.: traer tarjetas de invitación" class="campo" />
          </div>
        </div>

        <footer class="px-5 py-4 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-2">
          @if (puedeEliminar) {
            @if (!confirmarEliminar()) {
              <button type="button" (click)="confirmarEliminar.set(true)" class="h-11 px-4 rounded-xl text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">Quitar</button>
            } @else {
              <button type="button" (click)="eliminar.emit()" class="h-11 px-4 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition-colors">Sí, quitar</button>
            }
          }
          <button type="button" (click)="cancelar.emit()" class="ml-auto h-11 px-4 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
          <button type="button" (click)="enviar()" [disabled]="!valido() || guardando"
            class="h-11 px-5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-[background-color,transform] active:scale-[0.97]">
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
        </footer>
      </aside>
    </div>
  `,
  styles: [`
    .lbl { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 700; color: rgb(51 65 85); }
    :host-context(.dark) .lbl { color: rgb(226 232 240); }
    .opc { font-weight: 500; color: rgb(148 163 184); }
    .ayuda { margin-top: 6px; font-size: 12px; color: rgb(100 116 139); }
    :host-context(.dark) .ayuda { color: rgb(148 163 184); }
    .campo {
      width: 100%; height: 44px; padding: 0 12px; border-radius: 12px; font-size: 15px;
      border: 1px solid rgb(203 213 225); background: #fff; color: rgb(15 23 42);
    }
    .campo:focus { outline: none; border-color: rgb(16 185 129); box-shadow: 0 0 0 3px rgba(16,185,129,0.2); }
    :host-context(.dark) .campo { background: rgb(51 65 85); border-color: rgb(71 85 105); color: #fff; }
    .anim-fade { animation: fade 160ms ease-out; }
    .anim-panel { animation: panel 220ms cubic-bezier(0.32, 0.72, 0, 1); }
    @keyframes fade { from { opacity: 0; } }
    @keyframes panel { from { transform: translateX(24px); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .anim-fade, .anim-panel { animation: none; } }
  `],
})
export class SalidaEditorComponent implements OnInit {
  @Input() modo: 'salida' | 'plantilla' = 'salida';
  @Input() titulo = 'Salida';
  @Input() subtitulo = '';
  @Input() inicial!: SalidaForm;
  @Input() capitanesIniciales: PersonaRef[] = [];
  @Input() publicadores: PersonaRef[] = [];
  @Input() grupos: GrupoOpcion[] = [];
  @Input() set territorios(v: OpcionTerritorio[]) { this.territoriosSig.set(v ?? []); }
  private territoriosSig = signal<OpcionTerritorio[]>([]);
  opcionesTerritorio = computed<PickerOption[]>(() =>
    this.territoriosSig().map(t => ({ value: t.id_territorio, label: t.etiqueta, hint: t.detalle })));
  @Input() puedeEliminar = false;
  @Input() guardando = false;
  @Output() guardar = new EventEmitter<SalidaForm>();
  @Output() eliminar = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  readonly dias = DIAS;
  form!: SalidaForm;
  capitanes = signal<PersonaRef[]>([]);
  busqueda = signal('');
  confirmarEliminar = signal(false);

  resultados = computed(() => {
    const q = this.normalizar(this.busqueda());
    if (q.length < 2) return [];
    const ya = new Set(this.capitanes().map(c => c.id_publicador));
    return this.publicadores.filter(p => !ya.has(p.id_publicador) && this.normalizar(p.nombre).includes(q)).slice(0, 8);
  });

  ngOnInit(): void {
    this.form = { ...this.inicial, grupos: [...this.inicial.grupos], capitanes: [...this.inicial.capitanes] };
    this.capitanes.set([...this.capitanesIniciales]);
  }

  valido(): boolean {
    return this.modo === 'plantilla' ? !!this.form.dia_semana : !!this.form.fecha_programada;
  }

  tieneGrupo(id: number): boolean { return this.form.grupos.includes(id); }

  alternarGrupo(g: GrupoOpcion): void {
    if (this.tieneGrupo(g.id_grupo)) {
      this.form.grupos = this.form.grupos.filter(x => x !== g.id_grupo);
      return;
    }
    this.form.grupos = [...this.form.grupos, g.id_grupo];
    const cap = g.id_capitan ? this.publicadores.find(p => p.id_publicador === g.id_capitan) : null;
    if (cap) this.agregarCapitan(cap);
  }

  agregarCapitan(p: PersonaRef): void {
    if (!this.capitanes().some(c => c.id_publicador === p.id_publicador)) this.capitanes.update(l => [...l, p]);
    this.busqueda.set('');
  }

  primerResultado(): void {
    const r = this.resultados();
    if (r.length) this.agregarCapitan(r[0]);
  }

  quitarCapitan(id: number): void { this.capitanes.update(l => l.filter(c => c.id_publicador !== id)); }

  enviar(): void {
    if (!this.valido()) return;
    this.guardar.emit({
      ...this.form,
      hora_inicio: this.form.hora_inicio || null,
      lugar: this.form.lugar?.trim() || null,
      notas: this.form.notas?.trim() || null,
      capitanes: this.capitanes().map(c => c.id_publicador),
    });
  }

  private normalizar(s: string): string {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
