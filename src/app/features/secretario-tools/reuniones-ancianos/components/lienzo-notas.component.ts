import { Component, computed, ElementRef, EventEmitter, inject, Input, OnDestroy, Output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ReunionAncianosService } from '../../services/reunion-ancianos.service';
import { PuntoOut, PuntoUpdate } from '../../models/reunion-ancianos.model';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { PickerOption, SelectPickerComponent } from '../../../../shared/components/select-picker/select-picker.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { AutosizeTextareaDirective } from '../../../../shared/directives/autosize-textarea.directive';
import { LucideAngularModule } from '../../../../shared/icons';
import { fusionar, moverPosicion } from './fusionar-texto';

/**
 * Las notas del acta de un tema (o las generales), escritas entre varios.
 *
 * - Notas: un solo texto corrido por persona, como una transcripción. Se
 *   escribe sin botones y se guarda solo. Las de los demás se ven arriba con
 *   su nombre (quien toma las notas también puede corregirlas).
 * - Acuerdos: uno por uno, porque cada uno es distinto y puede volverse una
 *   tarea. Se escribe y se pulsa Enter; luego se elige quién y para cuándo.
 *
 * Mientras alguien corrige un bloque, el servidor lo «aparta» unos segundos y
 * los demás ven «Fulano está escribiendo…»; así nadie pisa lo de otro.
 */
@Component({
  selector: 'app-lienzo-notas',
  standalone: true,
  host: { '[class.llenar]': 'llenar' },
  imports: [FormsModule, SelectPickerComponent, DatePickerComponent, AutosizeTextareaDirective, LucideAngularModule],
  template: `
  <div class="ln" [class.ln-llenar]="llenar">
    <!-- ══ Notas: una sola hoja por tema, compartida y sincronizada ══ -->
    <section class="ln-sec" aria-labelledby="ln-notas">
      <div class="ln-cab">
        <h4 id="ln-notas" class="ln-tit"><lucide-icon name="file-text" [size]="15" aria-hidden="true"></lucide-icon>Notas</h4>
        @if (otroEscribiendo(); as quien) {
          <span class="escribiendo"><span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>{{ quien }} también está escribiendo</span>
        }
        <span class="ln-estado" role="status" aria-live="polite" [attr.data-estado]="estadoNota()">
          @switch (estadoNota()) {
            @case ('guardando') { <span class="spinner spinner-xs" aria-hidden="true"></span>Guardando… }
            @case ('guardado') { <lucide-icon name="check" [size]="13" aria-hidden="true"></lucide-icon>Guardado }
            @case ('sin-conexion') { <lucide-icon name="wifi-off" [size]="13" aria-hidden="true"></lucide-icon>Sin conexión: se guardará al volver }
          }
        </span>
      </div>
      @if (puedoColaborar) {
        <textarea #area appAutosize [minRows]="8" [maxRows]="40" class="hoja" maxlength="40000" aria-labelledby="ln-notas"
                  [placeholder]="idParte === null ? 'Escriba aquí lo que se diga fuera de los temas…' : 'Escriba aquí lo que se va diciendo en este tema. Se guarda solo y lo ven al instante quienes toman las notas.'"
                  [value]="textoNota()" (input)="escribirNota($any($event.target).value)" (blur)="guardarNotaYa()"></textarea>
      } @else if (textoNota().trim()) {
        <div class="hoja hoja-lectura">{{ textoNota() }}</div>
      } @else {
        <p class="ln-vacio">Todavía no hay notas{{ idParte === null ? ' generales' : ' de este tema' }}.</p>
      }
    </section>

    <!-- ══ Acuerdos: uno por uno ══ -->
    <section class="ln-sec" aria-labelledby="ln-acuerdos">
      <div class="ln-cab">
        <h4 id="ln-acuerdos" class="ln-tit ln-tit-acuerdo"><lucide-icon name="circle-check" [size]="15" aria-hidden="true"></lucide-icon>Acuerdos</h4>
        @if (acuerdos().length) { <span class="caption tabular-nums">{{ acuerdos().length }}</span> }
      </div>

      @if (acuerdos().length) {
        <ol class="ac-lista">
          @for (p of acuerdos(); track p.id_punto; let i = $index) {
            <li class="ac" [class.ac-ocupado]="!!p.editando_nombre" [class.ac-foco]="foco() === p.id_punto">
              <div class="ac-fila">
                <span class="ac-n" aria-hidden="true">{{ i + 1 }}</span>
                <textarea appAutosize [minRows]="1" [maxRows]="6" class="ac-area" [id]="'pt-' + p.id_punto"
                          [readOnly]="!p.puedo_editar || !!p.editando_nombre" maxlength="4000" [attr.aria-label]="'Acuerdo ' + (i + 1)"
                          [value]="valor(p)" (focus)="alEnfocar(p)" (input)="escribir(p, $any($event.target).value)" (blur)="alSalir(p)"></textarea>
                @if (p.puedo_editar && !p.editando_nombre) {
                  <button type="button" class="btn-icon-sm tone-danger" [attr.aria-label]="'Quitar el acuerdo ' + (i + 1)" title="Quitar" (click)="quitar(p)">
                    <lucide-icon name="trash-2"></lucide-icon>
                  </button>
                }
              </div>
              <div class="ac-datos @container">
                <app-select-picker colorScheme="violet" placeholder="¿Quién se encarga?" [ariaLabel]="'Responsable del acuerdo ' + (i + 1)"
                  [options]="opcionesResponsable" [disabled]="!p.puedo_editar || !!p.editando_nombre"
                  [ngModel]="p.id_publicador_responsable" (ngModelChange)="cambiarCampo(p, { id_publicador_responsable: $event })" />
                <app-date-picker colorScheme="violet" [fieldLike]="true" placeholder="¿Para cuándo?" [disabled]="!p.puedo_editar || !!p.editando_nombre"
                  [ngModel]="p.fecha_limite" (ngModelChange)="cambiarCampo(p, { fecha_limite: $event })" />
              </div>
              @if (p.editando_nombre || p.id_tarea || (!p.es_mio && p.autor_nombre)) {
                <p class="ac-pie">
                  @if (p.editando_nombre) {
                    <span class="escribiendo"><span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>{{ p.editando_nombre }} está escribiendo…</span>
                  } @else if (!p.es_mio && p.autor_nombre) { {{ p.autor_nombre }} }
                  @if (p.id_tarea) { <span class="badge-active">Ya es una tarea</span> }
                </p>
              }
            </li>
          }
        </ol>
      } @else if (!puedoColaborar) {
        <p class="ln-vacio">Sin acuerdos.</p>
      }

      @if (puedoColaborar) {
        <div class="ac-nuevo">
          <lucide-icon name="plus" [size]="16" aria-hidden="true" class="ac-nuevo-icono"></lucide-icon>
          <input #nuevoAcuerdo type="text" class="ac-nuevo-input" maxlength="4000" [(ngModel)]="borradorAcuerdo"
                 placeholder="Escriba un acuerdo y pulse Enter" aria-label="Nuevo acuerdo" [disabled]="creando()"
                 (keydown.enter)="$event.preventDefault(); anadirAcuerdo()" />
          @if (borradorAcuerdo.trim()) {
            <button type="button" class="btn-tonal btn-sm shrink-0" [disabled]="creando()" (click)="anadirAcuerdo()">Añadir</button>
          }
        </div>
        <p class="caption">Si tiene responsable, al finalizar la reunión se vuelve una tarea y se le avisa.</p>
      }
    </section>
  </div>
  `,
  styles: [`
    :host { display: block; }
    .ln { display: flex; flex-direction: column; gap: 1.25rem; }
    .ln-sec { display: flex; flex-direction: column; gap: 0.5rem; }
    .ln-cab { display: flex; align-items: center; gap: 0.5rem; }
    .ln-tit { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; font-weight: 700; color: var(--color-slate-800); }
    :host-context(.dark) .ln-tit { color: var(--color-slate-100); }
    .ln-tit > lucide-icon { color: var(--color-slate-500); }
    .ln-tit-acuerdo > lucide-icon { color: var(--color-green-600); }
    :host-context(.dark) .ln-tit-acuerdo > lucide-icon { color: var(--color-green-400); }
    .ln-estado { margin-left: auto; display: inline-flex; align-items: center; gap: 0.3125rem; font-size: 0.75rem; font-weight: 600; color: var(--color-slate-500); }
    :host-context(.dark) .ln-estado { color: var(--color-slate-400); }
    .ln-estado[data-estado='sin-conexion'] { color: var(--color-amber-700); }
    :host-context(.dark) .ln-estado[data-estado='sin-conexion'] { color: var(--color-amber-300); }
    .hoja-lectura { white-space: pre-wrap; min-height: 0; }
    .ln-vacio { font-size: 0.875rem; color: var(--color-slate-500); }
    :host-context(.dark) .ln-vacio { color: var(--color-slate-400); }

    /* La hoja propia: un texto corrido, grande y sin adornos */
    .hoja {
      display: block; width: 100%; resize: none; padding: 0.75rem 0.875rem; border-radius: 0.875rem; outline: none;
      font-size: 1rem; line-height: 1.65; color: var(--color-slate-900);
      background: var(--color-white); border: 1px solid var(--color-slate-300);
      transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
    }
    :host-context(.dark) .hoja { color: var(--color-slate-100); background: var(--color-slate-950); border-color: var(--color-slate-700); }
    .hoja::placeholder { color: var(--color-slate-400); }
    .hoja:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }

    /* Acuerdos */
    .ac-lista { display: flex; flex-direction: column; gap: 0.5rem; margin: 0; padding: 0; list-style: none; }
    .ac {
      padding: 0.5rem 0.625rem 0.625rem; border-radius: 0.75rem; border: 1px solid color-mix(in oklab, var(--color-green-600) 30%, var(--color-slate-200));
      background: color-mix(in oklab, var(--color-green-500) 4%, var(--color-white));
      transition: border-color 150ms ease-out, box-shadow 150ms ease-out;
      animation: entra 220ms cubic-bezier(0.23, 1, 0.32, 1) both;
    }
    :host-context(.dark) .ac { border-color: color-mix(in oklab, var(--color-green-500) 30%, var(--color-slate-800)); background: color-mix(in oklab, var(--color-green-500) 5%, var(--color-slate-900)); }
    .ac-foco { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
    .ac-ocupado { border-style: dashed; border-color: var(--color-amber-400); }
    .ac-fila { display: flex; align-items: flex-start; gap: 0.5rem; }
    .ac-n {
      flex-shrink: 0; margin-top: 0.125rem; width: 1.5rem; height: 1.5rem; border-radius: 9999px; display: grid; place-items: center;
      font-size: 0.75rem; font-weight: 700; color: #fff; background: var(--color-green-600);
    }
    .ac-area {
      flex: 1; min-width: 0; resize: none; border: 0; outline: none; background: transparent; padding: 0.125rem 0;
      font-size: 0.875rem; font-weight: 600; line-height: 1.5; color: var(--color-slate-900);
    }
    :host-context(.dark) .ac-area { color: var(--color-slate-100); }
    .ac-area[readonly] { cursor: default; }
    .ac-datos { display: grid; gap: 0.5rem; margin-top: 0.5rem; padding-left: 2rem; grid-template-columns: minmax(0, 1fr); }
    @container (min-width: 22rem) { .ac-datos { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); } }
    .ac-pie { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin-top: 0.375rem; padding-left: 2rem; font-size: 0.75rem; color: var(--color-slate-500); }
    :host-context(.dark) .ac-pie { color: var(--color-slate-400); }
    .ac-nuevo {
      display: flex; align-items: center; gap: 0.5rem; min-height: 2.75rem; padding: 0.25rem 0.375rem 0.25rem 0.75rem;
      border-radius: 0.75rem; border: 1px dashed var(--color-slate-300); background: transparent;
      transition: border-color 150ms ease-out, background-color 150ms ease-out;
    }
    :host-context(.dark) .ac-nuevo { border-color: var(--color-slate-700); }
    .ac-nuevo:focus-within { border-style: solid; border-color: var(--accent); background: var(--color-white); }
    :host-context(.dark) .ac-nuevo:focus-within { background: var(--color-slate-950); }
    .ac-nuevo-icono { color: var(--color-slate-400); flex-shrink: 0; }
    .ac-nuevo-input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; font-size: 0.875rem; color: var(--color-slate-900); }
    :host-context(.dark) .ac-nuevo-input { color: var(--color-slate-100); }
    .ac-nuevo-input::placeholder { color: var(--color-slate-400); }

    .escribiendo { display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.75rem; line-height: 1.25; font-weight: 600; color: var(--color-amber-700); }
    :host-context(.dark) .escribiendo { color: var(--color-amber-300); }
    .puntos { display: inline-flex; gap: 2px; }
    .puntos i { width: 4px; height: 4px; border-radius: 9999px; background: currentColor; animation: salta 1s infinite ease-in-out; }
    .puntos i:nth-child(2) { animation-delay: 0.15s; }
    .puntos i:nth-child(3) { animation-delay: 0.3s; }
    /* Llenar: la hoja de notas ocupa el alto libre; los acuerdos, lo que necesiten
       hasta casi la mitad, con su propia lista desplazable y el campo nuevo siempre a la vista. */
    :host(.llenar) { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
    :host(.llenar) .ln { flex: 1 1 auto; min-height: 0; gap: 1rem; }
    :host(.llenar) .ln-sec:first-child { flex: 1 1 0; min-height: 9rem; }
    :host(.llenar) .hoja { flex: 1 1 0; min-height: 6rem; height: auto !important; overflow-y: auto; }
    /* Hoja sin caja: fondo apenas distinto y el borde solo aparece al escribir */
    :host(.llenar) .hoja { border-color: transparent; background: var(--color-slate-50); padding: 0.875rem 1rem; }
    :host-context(.dark) .ln-llenar .hoja { border-color: transparent; background: rgb(2 6 23 / 0.45); }
    :host(.llenar) .hoja:hover { border-color: var(--color-slate-200); }
    :host-context(.dark) .ln-llenar .hoja:hover { border-color: var(--color-slate-800); }
    :host(.llenar) .hoja:focus, :host-context(.dark) .ln-llenar .hoja:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-ring); }
    :host(.llenar) .hoja-lectura { flex: 1 1 0; overflow-y: auto; }
    :host(.llenar) .ln-sec:last-child { flex: 0 1 auto; max-height: 48%; min-height: 0; }
    :host(.llenar) .ac-lista { flex: 0 1 auto; min-height: 0; overflow-y: auto; padding: 2px; margin: -2px; }
    :host(.llenar) .ac-nuevo, :host(.llenar) .ln-sec:last-child > .caption { flex-shrink: 0; }
    @keyframes salta { 0%, 80%, 100% { opacity: 0.3; } 40% { opacity: 1; } }
    @keyframes entra { from { opacity: 0; transform: translateY(4px); } }
    @media (prefers-reduced-motion: reduce) { .ac, .puntos i { animation: none; } }
  `],
})
export class LienzoNotasComponent implements OnDestroy {
  private svc = inject(ReunionAncianosService);
  private toast = inject(ToastService);

  @Input({ required: true }) idReunion!: number;
  /** null = notas generales. */
  @Input() idParte: number | null = null;
  @Input() set puntos(v: PuntoOut[]) {
    this.todos.set(v ?? []);
    this.recibirNota();
    this.verPresencia();
  }
  @Input() puedoColaborar = false;
  /** Ocupa todo el alto del panel (la reunión en vivo en pantalla ancha). */
  @Input() llenar = false;
  @Input() opcionesResponsable: PickerOption[] = [];
  /** Algo cambió aquí: que la pantalla pida el estado nuevo. */
  @Output() cambio = new EventEmitter<void>();

  @ViewChild('nuevoAcuerdo') nuevoAcuerdo?: ElementRef<HTMLInputElement>;

  private todos = signal<PuntoOut[]>([]);
  foco = signal<number | null>(null);
  creando = signal(false);
  borradorAcuerdo = '';

  private delTema = computed(() => this.todos()
    .filter(p => p.id_parte === this.idParte)
    .sort((a, b) => a.orden - b.orden || a.id_punto - b.id_punto));
  /** La nota del tema: una sola, compartida por quienes anotan. */
  private nota = computed(() => this.delTema().find(p => p.tipo === 'nota') ?? null);
  /**
   * «Fulano también está escribiendo»: se enciende cuando llega un cambio suyo y
   * se apaga sola a los pocos segundos sin cambios nuevos (el servidor no avisa
   * cuando alguien deja de escribir).
   */
  otroEscribiendo = signal<string | null>(null);
  private ultimaVersion = '';
  private tPresencia: ReturnType<typeof setTimeout> | null = null;

  private verPresencia() {
    const n = this.nota();
    const version = n ? `${n.id_punto}:${n.actualizado_en}` : '';
    if (version === this.ultimaVersion) return;
    this.ultimaVersion = version;
    if (this.tPresencia) clearTimeout(this.tPresencia);
    const quien = n?.editando_nombre ?? null;
    this.otroEscribiendo.set(quien);
    if (quien) this.tPresencia = setTimeout(() => this.otroEscribiendo.set(null), 6000);
  }
  acuerdos = computed(() => this.delTema().filter(p => p.tipo === 'acuerdo'));

  // ── La nota compartida ───────────────────────────────────────────────────
  //
  // `servidor` es el último texto confirmado; lo que el usuario escribe encima se
  // manda con esa base y el servidor junta lo que otros guardaron mientras tanto.
  // Si llega un cambio de otro mientras uno escribe, se junta aquí con la misma
  // regla y el cursor no salta.

  @ViewChild('area') area?: ElementRef<HTMLTextAreaElement>;
  @ViewChild(AutosizeTextareaDirective) autosize?: AutosizeTextareaDirective;

  textoNota = signal('');
  estadoNota = signal<'' | 'guardando' | 'guardado' | 'sin-conexion'>('');
  private servidor = '';
  private enVuelo = false;
  private tNota: ReturnType<typeof setTimeout> | null = null;

  /** Llegó el estado de la reunión: si la nota cambió en el servidor, se incorpora. */
  private recibirNota() {
    const remoto = this.nota()?.texto ?? '';
    if (this.enVuelo || remoto === this.servidor) return;
    const local = this.textoNota();
    const nuevo = local === this.servidor ? remoto : fusionar(this.servidor, remoto, local);
    this.servidor = remoto;
    this.ponerTexto(nuevo);
    if (nuevo !== remoto) this.programarEnvio(0);
  }

  escribirNota(v: string) {
    this.textoNota.set(v);
    this.programarEnvio(400);
  }

  guardarNotaYa() {
    this.programarEnvio(0);
  }

  private programarEnvio(ms: number) {
    if (this.tNota) clearTimeout(this.tNota);
    this.tNota = setTimeout(() => void this.enviarNota(), ms);
  }

  private async enviarNota() {
    this.tNota = null;
    if (this.enVuelo) return;  // al volver la respuesta se vuelve a mirar
    const enviado = this.textoNota();
    if (enviado === this.servidor) return;
    this.enVuelo = true;
    this.estadoNota.set('guardando');
    try {
      const p = await firstValueFrom(this.svc.notaCompartida(this.idReunion, this.idParte, this.servidor, enviado));
      this.servidor = p.texto;
      this.todos.update(l => (l.some(x => x.id_punto === p.id_punto) ? l.map(x => (x.id_punto === p.id_punto ? p : x)) : [...l, p]));
      // Lo que se siguió escribiendo mientras tanto se junta con lo que devolvió el servidor.
      const local = this.textoNota();
      this.ponerTexto(local === enviado ? p.texto : fusionar(enviado, p.texto, local));
      this.estadoNota.set('guardado');
    } catch {
      this.estadoNota.set('sin-conexion');
      this.enVuelo = false;
      this.programarEnvio(3000);
      return;
    }
    this.enVuelo = false;
    if (this.textoNota() !== this.servidor) this.programarEnvio(300);
  }

  /** Cambia el texto de la hoja sin mover el cursor de quien escribe. */
  private ponerTexto(nuevo: string) {
    const viejo = this.textoNota();
    if (nuevo === viejo) return;
    const ta = this.area?.nativeElement;
    this.textoNota.set(nuevo);
    if (!ta) return;
    const enFoco = document.activeElement === ta;
    const ini = ta.selectionStart, fin = ta.selectionEnd;
    ta.value = nuevo;
    if (enFoco) ta.setSelectionRange(moverPosicion(viejo, nuevo, ini), moverPosicion(viejo, nuevo, fin));
    this.autosize?.ajustar();
  }

  ngOnDestroy() {
    if (this.tPresencia) clearTimeout(this.tPresencia);
    if (this.tNota) { clearTimeout(this.tNota); void this.enviarNota(); }
    for (const [id, t] of this.temporizadores) { clearTimeout(t); void this.enviar(id); }
  }

  // ── Acuerdos nuevos ──────────────────────────────────────────────────────

  async anadirAcuerdo() {
    const texto = this.borradorAcuerdo.trim();
    if (!texto || this.creando()) return;
    this.creando.set(true);
    try {
      const p = await firstValueFrom(this.svc.crearPunto(this.idReunion, { id_parte: this.idParte, tipo: 'acuerdo', texto }));
      this.borradorAcuerdo = '';
      this.todos.update(l => [...l, { ...p, editando_nombre: null }]);
      // Recién creado, el servidor lo aparta para su autor: se suelta para que otros puedan corregirlo.
      this.svc.soltarPunto(this.idReunion, p.id_punto).subscribe({ next: () => this.cambio.emit(), error: () => this.cambio.emit() });
    } catch (e) {
      const err = e as HttpErrorResponse;
      this.toast.error('No se pudo añadir el acuerdo', typeof err?.error?.detail === 'string' ? err.error.detail : 'Intente de nuevo.');
    } finally {
      this.creando.set(false);
      setTimeout(() => this.nuevoAcuerdo?.nativeElement.focus());
    }
  }

  // ── Corregir lo escrito (acuerdos y notas de otros) ──────────────────────

  /** Lo que se está escribiendo en el bloque con foco: lo de afuera no lo pisa. */
  private borrador = new Map<number, string>();
  private temporizadores = new Map<number, ReturnType<typeof setTimeout>>();

  valor(p: PuntoOut): string {
    return this.foco() === p.id_punto && this.borrador.has(p.id_punto) ? this.borrador.get(p.id_punto)! : p.texto;
  }

  alEnfocar(p: PuntoOut) {
    if (!p.puedo_editar || p.editando_nombre) return;
    this.foco.set(p.id_punto);
    this.borrador.set(p.id_punto, p.texto);
  }

  escribir(p: PuntoOut, texto: string) {
    this.borrador.set(p.id_punto, texto);
    const t = this.temporizadores.get(p.id_punto);
    if (t) clearTimeout(t);
    this.temporizadores.set(p.id_punto, setTimeout(() => void this.enviar(p.id_punto), 700));
  }

  async alSalir(p: PuntoOut) {
    if (this.foco() !== p.id_punto) return;
    const t = this.temporizadores.get(p.id_punto);
    if (t) clearTimeout(t);
    const texto = this.borrador.get(p.id_punto) ?? p.texto;
    this.foco.set(null);
    // Un acuerdo que quedó vacío no sirve: se quita.
    if (!texto.trim() && p.tipo === 'acuerdo') {
      this.borrador.delete(p.id_punto);
      await this.quitar(p, true);
      return;
    }
    await this.enviar(p.id_punto);
    this.borrador.delete(p.id_punto);
    this.svc.soltarPunto(this.idReunion, p.id_punto).subscribe({ next: () => this.cambio.emit(), error: () => this.cambio.emit() });
  }

  private async enviar(id: number) {
    this.temporizadores.delete(id);
    const texto = this.borrador.get(id);
    const actual = this.todos().find(x => x.id_punto === id);
    if (texto === undefined || !actual || texto === actual.texto) return;
    await this.guardar(id, { texto });
  }

  cambiarCampo(p: PuntoOut, cambio: PuntoUpdate) {
    void this.guardar(p.id_punto, cambio).then(() =>
      this.svc.soltarPunto(this.idReunion, p.id_punto).subscribe({ next: () => this.cambio.emit() }));
  }

  private async guardar(id: number, cambio: PuntoUpdate) {
    try {
      const p = await firstValueFrom(this.svc.actualizarPunto(this.idReunion, id, cambio));
      this.todos.update(lista => lista.map(x => (x.id_punto === id ? p : x)));
    } catch (e) {
      const err = e as HttpErrorResponse;
      this.toast.warning('No se guardó', typeof err?.error?.detail === 'string' ? err.error.detail : 'Revise su conexión.');
      this.cambio.emit();
    }
  }

  async quitar(p: PuntoOut, silencioso = false) {
    try {
      await firstValueFrom(this.svc.borrarPunto(this.idReunion, p.id_punto));
      this.todos.update(lista => lista.filter(x => x.id_punto !== p.id_punto));
      this.cambio.emit();
    } catch (e) {
      if (!silencioso) {
        const err = e as HttpErrorResponse;
        this.toast.error('No se pudo quitar', typeof err?.error?.detail === 'string' ? err.error.detail : 'Intente de nuevo.');
      }
    }
  }
}
