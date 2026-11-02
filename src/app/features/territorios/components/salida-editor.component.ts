import { Component, ElementRef, EventEmitter, Input, OnInit, Output, ViewChild, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TimePickerComponent } from '../../../shared/components/time-picker/time-picker.component';
import { PickerOption, SelectPickerComponent } from '../../../shared/components/select-picker/select-picker.component';
import { DIAS, GrupoOpcion, PersonaRef, SalidaForm } from '../services/salidas-programa.service';
import { PuntoSalidaOpcion } from '../models/territorio.model';


/**
 * Panel lateral para una salida del programa o una de las salidas fijas (semana tipo).
 * Pensado para el encargado de territorios: pocos campos, en orden, sin jerga.
 */
@Component({
  standalone: true,
  selector: 'app-salida-editor',
  imports: [CommonModule, FormsModule, SelectPickerComponent, TimePickerComponent],
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
            <span class="lbl">Hora</span>
            <app-time-picker colorScheme="emerald" [(ngModel)]="form.hora_inicio" />
          </div>

          <!-- Dónde -->
          <!-- Un solo campo: el lugar de reunión ES el punto de salida; si no es un punto marcado (Zoom, una casa), se escribe -->
          <div>
            <span class="lbl">Lugar de reunión</span>
            @if (!otroLugar() && opcionesPunto().length) {
              <app-select-picker colorScheme="emerald" ariaLabel="Lugar de reunión" [(ngModel)]="form.id_punto_salida"
                (ngModelChange)="alElegirPunto($event)" [options]="opcionesPunto()" placeholder="Elija el punto de salida" />
              <button type="button" (click)="usarOtroLugar()" class="mt-2 text-[13px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline">Es otro lugar (Zoom, una casa…)</button>
            } @else {
              <input id="se-lugar" type="text" [(ngModel)]="form.lugar" maxlength="200" placeholder="Ej.: Zoom, Familia Sierra, Salón del Reino" class="campo" />
              @if (opcionesPunto().length) {
                <button type="button" (click)="usarPunto()" class="mt-2 text-[13px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline">Elegir un punto de salida</button>
              } @else {
                <p class="ayuda">Aún no hay puntos de salida. Márquelos en el mapa de cada tarjeta y podrá elegirlos aquí.</p>
              }
            }
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
            @if (modo === 'plantilla') {
              <p class="-mt-0.5 mb-2 text-[12px] leading-snug text-slate-500 dark:text-slate-400">Opcional. Si lo deja vacío, al crear el programa se turnan los habilitados como capitán.</p>
            }
            @if (capitanes().length) {
              <div class="flex flex-wrap gap-1.5 mb-2">
                @for (c of capitanes(); track c.id_publicador) {
                  <span class="chip-cap inline-flex items-center gap-1 h-9 pl-3 pr-1 rounded-full bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-800/60 text-[13px] font-semibold text-emerald-900 dark:text-emerald-100">
                    {{ c.nombre }}
                    <button type="button" (click)="quitarCapitan(c.id_publicador)" [attr.aria-label]="'Quitar a ' + c.nombre"
                      class="w-7 h-7 rounded-full flex items-center justify-center text-emerald-700/70 dark:text-emerald-300/70 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                  </span>
                }
              </div>
            }

            <!-- Buscador: escribir filtra; con el campo vacío se abre la lista de habilitados (con scroll) -->
            <div class="relative" (focusout)="alSalir($event)" #combo>
              <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input #inputCap id="se-capitan" type="text" role="combobox" autocomplete="off"
                [attr.aria-expanded]="abierto()" aria-controls="se-capitan-lista" aria-autocomplete="list"
                [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event); abrir(); indice.set(0)"
                (focus)="abrir()" (click)="abrir()"
                (keydown.arrowdown)="mover($event, 1)" (keydown.arrowup)="mover($event, -1)"
                (keydown.enter)="$event.preventDefault(); elegirActual()" (keydown.escape)="cerrarLista($event)"
                [placeholder]="habilitados.length ? 'Buscar o elegir de la lista' : 'Escriba un nombre para agregar'"
                class="campo !pl-10 !pr-10" />
              <button type="button" tabindex="-1" (mousedown)="$event.preventDefault()" (click)="abierto() ? abierto.set(false) : abrir(); inputCap.focus()"
                [attr.aria-label]="abierto() ? 'Cerrar la lista' : 'Abrir la lista'"
                class="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <svg class="w-4 h-4 transition-transform duration-150" [class.rotate-180]="abierto()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
              </button>

              @if (abierto() && opcionesCap().length) {
                <ul id="se-capitan-lista" role="listbox" class="lista-cap absolute z-20 left-0 right-0 mt-1.5 max-h-64 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl p-1">
                  @for (o of opcionesCap(); track o.p.id_publicador; let i = $index) {
                    @if (o.cabecera) {
                      <li role="presentation" class="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{{ o.cabecera }}</li>
                    }
                    <li role="option" [attr.aria-selected]="i === indice()">
                      <button type="button" tabindex="-1" (mousedown)="$event.preventDefault()" (click)="agregarCapitan(o.p); inputCap.focus()" (mouseenter)="indice.set(i)"
                        class="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
                        [class]="i === indice() ? 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-900 dark:text-emerald-100' : ''">
                        {{ o.p.nombre }}
                      </button>
                    </li>
                  }
                </ul>
              } @else if (abierto() && busqueda().trim().length >= 2) {
                <p class="lista-cap absolute z-20 left-0 right-0 mt-1.5 px-3.5 py-3 text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl">Nadie coincide con «{{ busqueda().trim() }}».</p>
              }
            </div>
            <!-- Con la lista abierta se reserva su alto: así el panel se desplaza y la lista se ve completa -->
            @if (abierto()) { <div class="h-64" aria-hidden="true"></div> }
            @if (!habilitados.length) {
              <p class="ayuda">Nadie tiene aún el permiso «Cap. Predicación» (Reuniones → Configuración); puede buscar a cualquier publicador.</p>
            } @else {
              <p class="ayuda">Salen primero los habilitados como capitán de predicación; escriba para buscar a cualquier otro publicador.</p>
            }
          </div>

          <!-- Dónde se predica: primero el barrio; de aquí salen las manzanas que se le sugieren a la salida -->
          <div>
            <span class="lbl">Barrio donde se predica <span class="opc">(opcional)</span></span>
            <app-select-picker colorScheme="emerald" ariaLabel="Barrio" [(ngModel)]="form.id_sector"
              [options]="opcionesBarrio()" placeholder="Cualquiera: sigue el recorrido" />
            <p class="ayuda">Se le sugerirán las manzanas que siguen en ese barrio. Si lo deja vacío, las que siguen en el recorrido general.</p>
          </div>

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
    .lista-cap { transform-origin: top center; animation: lista 140ms cubic-bezier(0.23, 1, 0.32, 1); }
    .chip-cap { animation: chip 160ms cubic-bezier(0.23, 1, 0.32, 1); }
    @keyframes lista { from { opacity: 0; transform: translateY(-4px) scale(0.98); } }
    @keyframes chip { from { opacity: 0; transform: scale(0.92); } }
    .anim-fade { animation: fade 160ms ease-out; }
    .anim-panel { animation: panel 220ms cubic-bezier(0.32, 0.72, 0, 1); }
    @keyframes fade { from { opacity: 0; } }
    @keyframes panel { from { transform: translateX(24px); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .anim-fade, .anim-panel, .lista-cap, .chip-cap { animation: none; } }
  `],
})
export class SalidaEditorComponent implements OnInit {
  @Input() modo: 'salida' | 'plantilla' = 'salida';
  @Input() titulo = 'Salida';
  @Input() subtitulo = '';
  @Input() inicial!: SalidaForm;
  @Input() capitanesIniciales: PersonaRef[] = [];
  @Input() publicadores: PersonaRef[] = [];
  /** Los que tienen el permiso «Cap. Predicación»; si hay, se ofrecen primero. */
  @Input() set capitanesHabilitados(v: PersonaRef[]) { this.habilitadosSig.set(v ?? []); }
  private habilitadosSig = signal<PersonaRef[]>([]);
  get habilitados(): PersonaRef[] { return this.habilitadosSig(); }
  @Input() grupos: GrupoOpcion[] = [];
  @Input() set barrios(v: Array<{ id_sector: number; nombre: string }>) { this.barriosSig.set(v ?? []); }
  private barriosSig = signal<Array<{ id_sector: number; nombre: string }>>([]);
  @Input() set puntosSalida(v: PuntoSalidaOpcion[]) { this.puntosSig.set(v ?? []); }
  private puntosSig = signal<PuntoSalidaOpcion[]>([]);
  opcionesPunto = computed<PickerOption[]>(() =>
    this.puntosSig().map(p => ({ value: p.id_punto, label: p.nombre, hint: `Tarjeta ${p.codigo}` })));
  opcionesBarrio = computed<PickerOption[]>(() => this.barriosSig().map(b => ({ value: b.id_sector, label: b.nombre })));
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

  abierto = signal(false);
  @ViewChild('combo') private comboEl?: ElementRef<HTMLElement>;

  /** Abre la lista y centra el campo en el panel para que no quede cortada por el borde. */
  abrir(): void {
    if (this.abierto()) return;
    this.abierto.set(true);
    setTimeout(() => this.comboEl?.nativeElement.scrollIntoView({ block: 'center', behavior: 'smooth' }), 30);
  }
  indice = signal(0);

  /** Lo que se ofrece al buscar: primero los habilitados (todos, con el campo vacío), luego otros publicadores si se escribe. */
  opcionesCap = computed<Array<{ p: PersonaRef; cabecera: string | null }>>(() => {
    const q = this.normalizar(this.busqueda());
    const ya = new Set(this.capitanes().map(c => c.id_publicador));
    const hab = new Set(this.habilitadosSig().map(p => p.id_publicador));
    const coincide = (p: PersonaRef) => !q || this.normalizar(p.nombre).includes(q);
    const primeros = this.habilitadosSig().filter(p => !ya.has(p.id_publicador) && coincide(p));
    const otros = q.length >= 2
      ? this.publicadores.filter(p => !ya.has(p.id_publicador) && !hab.has(p.id_publicador) && coincide(p)).slice(0, 8)
      : [];
    const sinHabilitados = !this.habilitadosSig().length;
    return [
      ...primeros.map((p, i) => ({ p, cabecera: i === 0 && !sinHabilitados ? 'Habilitados como capitán' : null })),
      ...otros.map((p, i) => ({ p, cabecera: i === 0 && !sinHabilitados ? 'Otros publicadores' : null })),
    ];
  });

  mover(e: Event, paso: 1 | -1): void {
    e.preventDefault();
    const n = this.opcionesCap().length;
    if (!n) return;
    this.abrir();
    this.indice.set((this.indice() + paso + n) % n);
  }

  elegirActual(): void {
    const o = this.opcionesCap()[this.indice()];
    if (this.abierto() && o) this.agregarCapitan(o.p);
  }

  cerrarLista(e: Event): void {
    if (!this.abierto()) return; // Esc con la lista cerrada cierra el panel, no solo la lista
    e.stopPropagation();
    this.abierto.set(false);
  }

  alSalir(e: FocusEvent): void {
    const dentro = (e.currentTarget as HTMLElement).contains(e.relatedTarget as Node | null);
    if (!dentro) this.abierto.set(false);
  }

  /** Escribir el lugar a mano (Zoom, una casa) en vez de elegir un punto de salida. */
  otroLugar = signal(false);

  usarOtroLugar(): void { this.form.id_punto_salida = null; this.otroLugar.set(true); }
  usarPunto(): void { this.form.lugar = null; this.otroLugar.set(false); }

  ngOnInit(): void {
    this.form = { ...this.inicial, grupos: [...this.inicial.grupos], capitanes: [...this.inicial.capitanes] };
    this.otroLugar.set(!this.form.id_punto_salida && !!this.form.lugar?.trim());
    this.capitanes.set([...this.capitanesIniciales]);
  }

  /** Al elegir el punto, el barrio de su tarjeta se propone solo (si aún no hay uno); se puede cambiar. */
  alElegirPunto(id: number | null): void {
    if (id == null || this.form.id_sector != null) return;
    const barrio = this.puntosSig().find(p => p.id_punto === id)?.id_sector;
    if (barrio != null) this.form.id_sector = barrio;
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
    this.indice.set(0);
  }

  quitarCapitan(id: number): void { this.capitanes.update(l => l.filter(c => c.id_publicador !== id)); }

  enviar(): void {
    if (!this.valido()) return;
    this.guardar.emit({
      ...this.form,
      hora_inicio: this.form.hora_inicio || null,
      // Con punto de salida el lugar es su nombre (el servidor lo pone); si no, el texto escrito.
      lugar: this.form.id_punto_salida ? null : (this.form.lugar?.trim() || null),
      notas: this.form.notas?.trim() || null,
      capitanes: this.capitanes().map(c => c.id_publicador),
    });
  }

  private normalizar(s: string): string {
    return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
}
