import { Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { SelectPickerComponent, PickerOption } from '../../../../shared/components/select-picker/select-picker.component';
import { DatePickerComponent } from '../../../../shared/components/date-picker/date-picker.component';
import { ToastService } from '../../../../shared/components/toast/toast.service';
import { ActaService } from '../../../secretario-tools/services/acta.service';
import { Tarea, UsuarioAsignable } from '../../../secretario-tools/models/acta.model';
import { AuthStore } from '../../../../core/auth/auth.store';

/**
 * Alta de una tarea desde Mis tareas. Cualquier usuario puede crearla para sí
 * mismo (por defecto) o asignarla a otra cuenta de su congregación; el asignado
 * recibe aviso en la campana y en la app móvil.
 */
@Component({
  standalone: true,
  selector: 'app-tarea-crear-modal',
  imports: [CommonModule, FormsModule, ModalComponent, SelectPickerComponent, DatePickerComponent],
  template: `
    <app-modal [open]="open" (openChange)="cerrar($event)" title="Nueva tarea" size="lg" [hasFooter]="true">
      <form class="flex flex-col gap-5" (submit)="$event.preventDefault(); crear()" novalidate>

        <div>
          <label class="etiqueta" for="tarea-titulo">¿Qué hay que hacer?</label>
          <input #tituloEl id="tarea-titulo" name="titulo" type="text" maxlength="255" autocomplete="off"
                 [(ngModel)]="titulo" placeholder="Ej. Confirmar el discurso del domingo"
                 class="campo campo--titulo" [class.campo--error]="intentado() && !titulo.trim()"
                 [attr.aria-invalid]="intentado() && !titulo.trim()" aria-describedby="tarea-titulo-error"/>
          @if (intentado() && !titulo.trim()) {
            <p id="tarea-titulo-error" class="error" role="alert">Escribe qué hay que hacer.</p>
          }
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
          <div>
            <span class="etiqueta" id="lbl-para">Para</span>
            <app-select-picker name="asignado" [options]="opcionesAsignables()" [(ngModel)]="asignadoA"
                               [clearable]="false" [searchable]="true" colorScheme="rose"
                               [placeholder]="cargandoAsignables() ? 'Cargando personas…' : 'Elegir persona'"
                               ariaLabel="Para quién es la tarea"/>
            <p class="ayuda">
              {{ asignadoA !== miId ? 'Le llegará un aviso. Tú la verás en "Creadas por mí".' : 'Solo tú la verás.' }}
              <span class="block mt-0.5">¿Falta alguien? Necesita acceso a Mis Tareas (Usuarios → Permisos).</span>
            </p>
          </div>

          <div>
            <span class="etiqueta">Prioridad</span>
            <div class="segmentos" role="radiogroup" aria-label="Prioridad">
              @for (p of prioridades; track p.value) {
                <button type="button" role="radio" class="segmento" [attr.aria-checked]="prioridad === p.value"
                        [attr.data-prio]="p.value" [class.segmento--on]="prioridad === p.value" (click)="prioridad = p.value">
                  <span class="punto"></span>{{ p.label }}
                </button>
              }
            </div>
          </div>
        </div>

        <div>
          <span class="etiqueta">Fecha límite <span class="opcional">· opcional</span></span>
          <div class="flex flex-wrap items-center gap-2">
            @for (r of rapidas; track r.dias) {
              <button type="button" class="rapida" [class.rapida--on]="fechaLimite === enDias(r.dias)"
                      [attr.aria-pressed]="fechaLimite === enDias(r.dias)"
                      (click)="fechaLimite = fechaLimite === enDias(r.dias) ? null : enDias(r.dias)">{{ r.label }}</button>
            }
            <div class="w-full sm:w-auto sm:flex-1 sm:min-w-[11rem]">
              <app-date-picker name="fecha" [(ngModel)]="fechaLimite" [minDate]="hoy" [fieldLike]="true" colorScheme="rose" placeholder="Otra fecha"/>
            </div>
          </div>
        </div>

        <div>
          @if (mostrarDescripcion() || descripcion) {
            <label class="etiqueta" for="tarea-desc">Descripción <span class="opcional">· opcional</span></label>
            <textarea #descEl id="tarea-desc" name="descripcion" rows="3" [(ngModel)]="descripcion"
                      placeholder="Detalles, contexto o enlaces que ayuden a hacerla" class="campo resize-y"></textarea>
          } @else {
            <button type="button" class="mas" (click)="abrirDescripcion()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-width="2.2" d="M12 5v14m-7-7h14"/></svg>
              Añadir descripción
            </button>
          }
        </div>

        <div>
          <span class="etiqueta">Pasos <span class="opcional">· opcional</span></span>
          @if (pasos().length) {
            <ol class="pasos">
              @for (paso of pasos(); track $index; let i = $index) {
                <li class="paso">
                  <span class="paso-num">{{ i + 1 }}</span>
                  <span class="flex-1 min-w-0 break-words">{{ paso }}</span>
                  <button type="button" class="paso-quitar" (click)="quitarPaso(i)" [attr.aria-label]="'Quitar paso: ' + paso">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-width="2.2" d="M6 6l12 12M18 6L6 18"/></svg>
                  </button>
                </li>
              }
            </ol>
          }
          <div class="flex gap-2">
            <input #pasoEl type="text" name="nuevoPaso" maxlength="255" [(ngModel)]="nuevoPaso" autocomplete="off"
                   (keydown.enter)="agregarPaso(); $event.preventDefault()"
                   placeholder="Añadir un paso" class="campo flex-1" aria-label="Nuevo paso"/>
            <button type="button" (click)="agregarPaso()" [disabled]="!nuevoPaso.trim()" class="btn-sec shrink-0">Añadir</button>
          </div>
        </div>
      </form>

      <ng-container slot="footer">
        <button type="button" class="btn-sec flex-1 sm:flex-none" (click)="cerrar(false)">Cancelar</button>
        <button type="button" class="btn-primario flex-1 sm:flex-none" [disabled]="guardando()" (click)="crear()">
          {{ guardando() ? 'Creando…' : (asignadoA !== miId ? 'Crear y asignar' : 'Crear tarea') }}
        </button>
      </ng-container>
    </app-modal>
  `,
  styles: [`
    :host { --ease: cubic-bezier(0.23, 1, 0.32, 1); }
    .etiqueta { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: rgb(55 65 81); }
    :host-context(.dark) .etiqueta { color: rgb(203 213 225); }
    .opcional { font-weight: 400; color: rgb(156 163 175); }
    .ayuda { margin-top: 6px; font-size: 12px; line-height: 1.4; color: rgb(107 114 128); }
    :host-context(.dark) .ayuda { color: rgb(148 163 184); }
    .error { margin-top: 6px; font-size: 12px; font-weight: 500; color: rgb(220 38 38); }

    .campo {
      width: 100%; min-height: 44px; padding: 10px 12px; font-size: 15px; line-height: 1.4; border-radius: 12px;
      border: 1px solid rgb(229 231 235); background: #fff; color: rgb(17 24 39);
      transition: border-color 150ms ease, box-shadow 150ms ease;
    }
    .campo::placeholder { color: rgb(156 163 175); }
    .campo:focus { outline: none; border-color: rgb(253 164 175); box-shadow: 0 0 0 4px rgb(244 63 94 / 0.1); }
    .campo--titulo { min-height: 52px; font-size: 17px; font-weight: 600; }
    .campo--error, .campo--error:focus { border-color: rgb(239 68 68); box-shadow: 0 0 0 4px rgb(239 68 68 / 0.1); }
    :host-context(.dark) .campo { background: rgb(15 23 42); border-color: rgb(51 65 85); color: rgb(241 245 249); }
    :host-context(.dark) .campo:focus { border-color: rgb(159 18 57); }

    .segmentos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; padding: 3px; border-radius: 12px; background: rgb(243 244 246); }
    :host-context(.dark) .segmentos { background: rgb(15 23 42); }
    .segmento { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 38px; border-radius: 9px; font-size: 13px; font-weight: 600; color: rgb(107 114 128); transition: background-color 160ms var(--ease), color 160ms ease, transform 160ms var(--ease); }
    .segmento:hover { color: rgb(17 24 39); }
    .segmento:active { transform: scale(0.97); }
    .segmento--on { background: #fff; color: rgb(17 24 39); box-shadow: 0 1px 2px rgb(15 23 42 / 0.08); }
    :host-context(.dark) .segmento { color: rgb(148 163 184); }
    :host-context(.dark) .segmento:hover, :host-context(.dark) .segmento--on { color: #fff; }
    :host-context(.dark) .segmento--on { background: rgb(51 65 85); box-shadow: none; }
    .punto { width: 8px; height: 8px; border-radius: 999px; background: rgb(156 163 175); }
    [data-prio="alta"] .punto { background: rgb(239 68 68); }
    [data-prio="media"] .punto { background: rgb(245 158 11); }

    .rapida { min-height: 40px; padding: 0 14px; border-radius: 999px; font-size: 13px; font-weight: 600; border: 1px solid rgb(229 231 235); color: rgb(75 85 99); background: #fff; transition: background-color 150ms ease, border-color 150ms ease, color 150ms ease, transform 160ms var(--ease); }
    .rapida:hover { border-color: rgb(209 213 219); color: rgb(17 24 39); }
    .rapida:active { transform: scale(0.97); }
    .rapida--on, .rapida--on:hover { background: rgb(255 241 242); border-color: rgb(253 164 175); color: rgb(190 18 60); }
    :host-context(.dark) .rapida { background: rgb(15 23 42); border-color: rgb(51 65 85); color: rgb(203 213 225); }
    :host-context(.dark) .rapida--on { background: rgb(136 19 55 / 0.3); border-color: rgb(159 18 57); color: rgb(253 164 175); }

    .mas { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 4px; font-size: 13px; font-weight: 600; color: rgb(190 18 60); border-radius: 8px; }
    .mas svg { width: 15px; height: 15px; }
    .mas:hover { text-decoration: underline; text-underline-offset: 3px; }
    :host-context(.dark) .mas { color: rgb(251 113 133); }

    .pasos { list-style: none; margin: 0 0 8px; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .paso { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 0 4px 0 10px; border-radius: 10px; font-size: 14px; background: rgb(249 250 251); color: rgb(31 41 55); }
    :host-context(.dark) .paso { background: rgb(15 23 42); color: rgb(226 232 240); }
    .paso-num { width: 20px; font-size: 12px; font-weight: 700; color: rgb(156 163 175); font-variant-numeric: tabular-nums; }
    .paso-quitar { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: rgb(156 163 175); }
    .paso-quitar svg { width: 15px; height: 15px; }
    .paso-quitar:hover { color: rgb(220 38 38); background: rgb(254 242 242); }

    .btn-sec, .btn-primario {
      display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 18px; border-radius: 12px;
      font-size: 14px; font-weight: 600; transition: background-color 150ms ease, transform 160ms var(--ease);
    }
    .btn-sec { border: 1px solid rgb(229 231 235); background: #fff; color: rgb(55 65 81); }
    .btn-sec:hover:not(:disabled) { background: rgb(249 250 251); }
    .btn-sec:disabled { opacity: 0.45; }
    :host-context(.dark) .btn-sec { background: rgb(30 41 59); border-color: rgb(51 65 85); color: rgb(226 232 240); }
    .btn-primario { background: rgb(225 29 72); color: #fff; box-shadow: 0 6px 16px -8px rgb(225 29 72 / 0.6); }
    .btn-primario:hover:not(:disabled) { background: rgb(190 18 60); }
    .btn-primario:disabled { opacity: 0.6; }
    .btn-sec:active:not(:disabled), .btn-primario:active:not(:disabled) { transform: scale(0.97); }
    .btn-sec:focus-visible, .btn-primario:focus-visible, .segmento:focus-visible, .rapida:focus-visible, .mas:focus-visible, .paso-quitar:focus-visible {
      outline: 2px solid rgb(244 63 94); outline-offset: 2px;
    }
    @media (prefers-reduced-motion: reduce) { .segmento, .rapida, .btn-sec, .btn-primario { transition: none; } }
  `],
})
export class TareaCrearModalComponent implements OnChanges {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();
  @Output() creada = new EventEmitter<Tarea>();
  @ViewChild('tituloEl') tituloEl?: ElementRef<HTMLInputElement>;
  @ViewChild('descEl') descEl?: ElementRef<HTMLTextAreaElement>;
  @ViewChild('pasoEl') pasoEl?: ElementRef<HTMLInputElement>;

  private svc = inject(ActaService);
  private store = inject(AuthStore);
  private toast = inject(ToastService);

  readonly hoy = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
  readonly prioridades: { value: Tarea['prioridad']; label: string }[] = [
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
  ];
  readonly rapidas = [
    { label: 'Hoy', dias: 0 },
    { label: 'Mañana', dias: 1 },
    { label: 'En una semana', dias: 7 },
  ];

  titulo = '';
  descripcion = '';
  asignadoA: number | null = null;
  prioridad: Tarea['prioridad'] = 'media';
  fechaLimite: string | null = null;
  nuevoPaso = '';
  pasos = signal<string[]>([]);
  mostrarDescripcion = signal(false);

  asignables = signal<UsuarioAsignable[]>([]);
  cargandoAsignables = signal(false);
  guardando = signal(false);
  intentado = signal(false);

  get miId(): number | null {
    const id = this.store.user()?.id;
    return id != null ? Number(id) : null;
  }

  opcionesAsignables = computed<PickerOption[]>(() => {
    const yo = this.miId;
    const lista = this.asignables();
    const opciones: PickerOption[] = [];
    if (yo != null) opciones.push({ value: yo, label: 'Yo', hint: lista.find(u => u.id_usuario === yo)?.nombre });
    for (const u of lista) if (u.id_usuario !== yo) opciones.push({ value: u.id_usuario, label: u.nombre });
    return opciones;
  });

  enDias(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toLocaleDateString('en-CA');
  }

  ngOnChanges(ch: SimpleChanges) {
    if (ch['open']?.currentValue && !ch['open'].previousValue) this.reiniciar();
  }

  private reiniciar() {
    this.titulo = '';
    this.descripcion = '';
    this.asignadoA = this.miId;
    this.prioridad = 'media';
    this.fechaLimite = null;
    this.nuevoPaso = '';
    this.pasos.set([]);
    this.mostrarDescripcion.set(false);
    this.intentado.set(false);
    setTimeout(() => this.tituloEl?.nativeElement.focus(), 60);
    if (!this.asignables().length) {
      this.cargandoAsignables.set(true);
      this.svc.listarAsignables().subscribe({
        next: (l) => { this.asignables.set(l); this.cargandoAsignables.set(false); },
        error: () => this.cargandoAsignables.set(false),
      });
    }
  }

  abrirDescripcion() {
    this.mostrarDescripcion.set(true);
    setTimeout(() => this.descEl?.nativeElement.focus());
  }

  agregarPaso() {
    const t = this.nuevoPaso.trim();
    if (!t) return;
    this.pasos.update(l => [...l, t]);
    this.nuevoPaso = '';
    // ngModel no repinta '' si el modelo ya valía '' en el último ciclo: se limpia a mano.
    if (this.pasoEl) this.pasoEl.nativeElement.value = '';
  }

  quitarPaso(i: number) { this.pasos.update(l => l.filter((_, j) => j !== i)); }

  cerrar(abierto: boolean) {
    if (!abierto) this.openChange.emit(false);
  }

  crear() {
    this.intentado.set(true);
    if (!this.titulo.trim()) { this.tituloEl?.nativeElement.focus(); return; }
    if (this.guardando()) return;
    // Un paso escrito pero sin pulsar Enter también cuenta.
    if (this.nuevoPaso.trim()) this.agregarPaso();

    this.guardando.set(true);
    this.svc.crearTareaGlobal({
      titulo: this.titulo.trim(),
      descripcion: this.descripcion.trim() || null,
      asignado_a: this.asignadoA,
      prioridad: this.prioridad,
      fecha_limite: this.fechaLimite || null,
      subtareas: this.pasos(),
    }).subscribe({
      next: (t) => {
        this.guardando.set(false);
        // Si es para uno mismo, verla aparecer en la lista ya confirma; el aviso solo aporta al asignar.
        if (t.asignado_a != null && t.asignado_a !== this.miId) {
          this.toast.success('Tarea asignada', `Le avisamos a ${t.asignado_a_nombre}.`);
        }
        this.creada.emit(t);
        this.openChange.emit(false);
      },
      error: (err) => {
        this.guardando.set(false);
        this.toast.error('No se pudo crear la tarea', err?.error?.detail ?? 'Revisa tu conexión e inténtalo de nuevo.');
      },
    });
  }
}
