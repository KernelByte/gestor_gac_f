import {
  Component, ElementRef, EventEmitter, HostListener, Input, Output,
  ViewChild, computed, inject, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectPickerComponent, PickerOption } from '../../../../../../shared/components/select-picker/select-picker.component';
import { SimpleDateFieldComponent } from './simple-date-field/simple-date-field.component';
import { Privilegio } from '../../../../privilegios/domain/models/privilegio';
import { formatearNombre, nombreMostrado } from '../../../../../../core/utils/nombre.util';
import { FormatoNombreService } from '../../../../../../core/utils/formato-nombre.service';

export interface WizardGrupo {
  id_grupo: number;
  nombre_grupo: string;
  capitan_grupo?: string;
}

/** Un privilegio elegido en el asistente, listo para POST tras crear al publicador. */
export interface PrivilegioSeleccionado {
  id_privilegio: number;
  fecha_inicio: string;
  fecha_fin: string | null;
}

export interface NuevoPublicadorResult {
  publicador: Record<string, unknown>;
  privilegios: PrivilegioSeleccionado[];
}

type StepId = 'nombre' | 'personal' | 'congregacion' | 'privilegios';

/** Fecha de hoy en el formato ISO corto que usan el date-picker y la API. */
function hoyIso(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Asistente de alta rápida de publicadores.
 *
 * Existe porque crear y editar son tareas distintas: el panel lateral de la
 * ficha pide ~25 campos y muestra secciones que sólo tienen sentido sobre un
 * registro ya existente (PIN, consentimiento, contactos). Aquí sólo se piden
 * los datos sin los que el registro no sirve, repartidos en cuatro pantallas
 * cortas para que quepan en un móvil sin scroll.
 *
 * No conoce el facade ni ningún servicio HTTP: emite lo que hay que crear y la
 * página se encarga de las llamadas. Los privilegios viajan aparte porque
 * necesitan un id_publicador que todavía no existe cuando se rellena el paso 4.
 */
@Component({
  selector: 'app-nuevo-publicador-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, SelectPickerComponent, SimpleDateFieldComponent],
  templateUrl: './nuevo-publicador-wizard.component.html',
  styleUrl: './nuevo-publicador-wizard.component.scss',
})
export class NuevoPublicadorWizardComponent {
  private fb = inject(FormBuilder);
  /** Para la vista previa: es lo único que necesita saber la regla. */
  readonly formatoNombre = inject(FormatoNombreService);

  @Input() set open(value: boolean) {
    const wasOpen = this.isOpen();
    this.isOpen.set(value);
    if (value && !wasOpen) this.reset();
  }

  @Input() grupos: WizardGrupo[] = [];
  @Input() privilegios: Privilegio[] = [];
  @Input() estadoActivoId: number | null = null;
  @Input() congregacionId: number | null = null;
  @Input() saving = false;

  @Output() cancelled = new EventEmitter<void>();
  @Output() created = new EventEmitter<NuevoPublicadorResult>();

  @ViewChild('primerCampo') primerCampoRef?: ElementRef<HTMLInputElement>;
  @ViewChild('dialogo') dialogoRef?: ElementRef<HTMLElement>;

  isOpen = signal(false);
  confirmarDescarte = signal(false);

  readonly maxFecha = hoyIso();

  form: FormGroup = this.fb.group({
    primer_nombre: ['', [Validators.required, Validators.maxLength(100)]],
    segundo_nombre: ['', Validators.maxLength(100)],
    primer_apellido: ['', [Validators.required, Validators.maxLength(100)]],
    segundo_apellido: ['', Validators.maxLength(100)],
    nombre_visible: ['', Validators.maxLength(150)],
    sexo: [null as string | null, Validators.required],
    fecha_nacimiento: [null as string | null],
    fecha_bautismo: [null as string | null],
    id_grupo_publicador: [null as number | null],
  });

  // ── Pasos ────────────────────────────────────────────────────────────────

  readonly steps: { id: StepId; label: string }[] = [
    { id: 'nombre', label: 'Nombre' },
    { id: 'personal', label: 'Personal' },
    { id: 'congregacion', label: 'Congregación' },
    { id: 'privilegios', label: 'Privilegios' },
  ];

  private readonly STEP_FIELDS: Record<StepId, string[]> = {
    nombre: ['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'nombre_visible'],
    personal: ['sexo', 'fecha_nacimiento'],
    congregacion: ['fecha_bautismo', 'id_grupo_publicador'],
    privilegios: [],
  };

  activeStep = signal<StepId>('nombre');
  maxStepReached = signal(0);

  /** Dirección del último salto, para que el paso entre por el lado correcto. */
  avanzando = signal(true);

  currentStepIndex = computed(() => this.steps.findIndex(s => s.id === this.activeStep()));
  isFirstStep = computed(() => this.currentStepIndex() === 0);
  isLastStep = computed(() => this.currentStepIndex() === this.steps.length - 1);
  currentStepLabel = computed(() => this.steps[this.currentStepIndex()]?.label ?? '');

  capitalizeInput(controlName: string) {
    const control = this.form.get(controlName);
    if (control && control.value) {
      const value = control.value.toString();
      if (value.length > 0) {
        const newValue = value.charAt(0).toUpperCase() + value.slice(1);
        if (value !== newValue) {
          control.setValue(newValue, { emitEvent: false });
        }
      }
    }
  }

  stepIsValid(step: StepId): boolean {
    return this.STEP_FIELDS[step].every(f => this.form.get(f)?.valid !== false);
  }

  stepHasErrors(step: StepId): boolean {
    return this.STEP_FIELDS[step].some(f => {
      const c = this.form.get(f);
      return !!c && c.invalid && c.touched;
    });
  }

  /** Hacia atrás se navega libre; hacia delante sólo hasta donde ya se llegó. */
  stepIsReachable(i: number): boolean {
    return i <= this.maxStepReached();
  }

  goToStep(i: number) {
    if (!this.stepIsReachable(i)) return;
    this.avanzando.set(i > this.currentStepIndex());
    this.activeStep.set(this.steps[i].id);
  }

  goBack() {
    const i = this.currentStepIndex();
    if (i > 0) {
      this.avanzando.set(false);
      this.activeStep.set(this.steps[i - 1].id);
    }
  }

  goNext() {
    const i = this.currentStepIndex();
    const step = this.steps[i].id;
    // El botón nunca se deshabilita: se pulsa y explica qué falta, en vez de
    // quedarse apagado sin decir por qué.
    if (!this.stepIsValid(step)) {
      this.revealStepErrors(step);
      return;
    }
    if (i < this.steps.length - 1) {
      const next = i + 1;
      this.avanzando.set(true);
      this.maxStepReached.set(Math.max(this.maxStepReached(), next));
      this.activeStep.set(this.steps[next].id);
    }
  }

  private revealStepErrors(step: StepId) {
    for (const f of this.STEP_FIELDS[step]) this.form.get(f)?.markAsTouched();
    const invalido = this.STEP_FIELDS[step].find(f => this.form.get(f)?.invalid);
    if (!invalido) return;
    setTimeout(() => {
      const el = this.dialogoRef?.nativeElement
        ?.querySelector<HTMLElement>(`[data-field="${invalido}"] input, [data-field="${invalido}"] button`);
      el?.focus();
    });
  }

  /** Primer paso con algún campo inválido, tocado o no. */
  private firstInvalidStep(): StepId | null {
    for (const { id } of this.steps) {
      if (this.STEP_FIELDS[id].some(f => this.form.get(f)?.invalid)) return id;
    }
    return null;
  }

  // ── Paso 1: nombre ───────────────────────────────────────────────────────

  /**
   * Cómo se verá esta persona en el resto de la app: su alias si lo escribe,
   * si no los campos según la regla de la congregación. Confirma de paso el
   * orden de los apellidos antes de que sea un registro que hay que corregir.
   */
  nombreCompleto = computed(() =>
    nombreMostrado(this.formValue() as any, this.formatoNombre.formato()),
  );

  /** Lo que se vería SIN alias. El texto de ayuda del campo lo compara. */
  nombreSegunRegla = computed(() =>
    formatearNombre(
      { ...(this.formValue() as any), nombre_visible: null, nombre_mostrado: null },
      this.formatoNombre.formato(),
    ),
  );

  /** Espejo del valor del formulario para que los computed reaccionen. */
  private formValue = signal<Record<string, any>>({});

  constructor() {
    this.form.valueChanges.subscribe(v => this.formValue.set(v));
  }

  // ── Paso 3: grupo y fecha de informe ─────────────────────────────────────

  grupoOptions = computed<PickerOption[]>(() =>
    this.grupos.map(g => ({
      value: g.id_grupo,
      label: g.nombre_grupo,
      hint: g.capitan_grupo ?? undefined,
    }))
  );

  // ── Paso 4: privilegios ──────────────────────────────────────────────────

  /** id_privilegio → fechas. Vacío = "ninguno por ahora". */
  seleccion = signal<Map<number, { fecha_inicio: string; fecha_fin: string | null }>>(new Map());

  avisoPrecursor = signal(false);

  /** ids de privilegio cuyo campo "Hasta" está desplegado. Se abre solo al
   *  pedirlo o si ya trae una fecha de fin cargada. */
  finExpandido = signal<Set<number>>(new Set());

  sinPrivilegios = computed(() => this.seleccion().size === 0);

  estaSeleccionado(id: number): boolean {
    return this.seleccion().has(id);
  }

  fechaInicioDe(id: number): string {
    return this.seleccion().get(id)?.fecha_inicio ?? hoyIso();
  }

  fechaFinDe(id: number): string | null {
    return this.seleccion().get(id)?.fecha_fin ?? null;
  }

  finVisible(id: number): boolean {
    return this.finExpandido().has(id) || !!this.fechaFinDe(id);
  }

  mostrarFinPara(id: number) {
    const set = new Set(this.finExpandido());
    set.add(id);
    this.finExpandido.set(set);
  }

  ocultarFinPara(id: number) {
    const set = new Set(this.finExpandido());
    set.delete(id);
    this.finExpandido.set(set);
    this.setFechaFinPrivilegio(id, null);
  }

  /** Sólo el precursorado auxiliar está acotado en el tiempo; el resto de
   *  nombramientos son indefinidos y van siempre con fecha_fin nula, igual que
   *  hace la ficha al asignar un privilegio. */
  esAuxiliar(p: Privilegio): boolean {
    return p.nombre_privilegio.toLowerCase().includes('auxiliar');
  }

  private esPrecursor(p: Privilegio): boolean {
    return p.nombre_privilegio.toLowerCase().includes('precursor');
  }

  togglePrivilegio(p: Privilegio) {
    const mapa = new Map(this.seleccion());
    this.avisoPrecursor.set(false);

    if (mapa.has(p.id_privilegio)) {
      mapa.delete(p.id_privilegio);
      this.seleccion.set(mapa);
      const finSet = new Set(this.finExpandido());
      finSet.delete(p.id_privilegio);
      this.finExpandido.set(finSet);
      return;
    }

    // Un publicador sólo puede tener un tipo de precursor activo a la vez. En
    // vez de dejar que choque contra el error del backend, el anterior se
    // desmarca solo y se explica por qué.
    if (this.esPrecursor(p)) {
      let habiaOtro = false;
      for (const otro of this.privilegios) {
        if (otro.id_privilegio !== p.id_privilegio && this.esPrecursor(otro) && mapa.has(otro.id_privilegio)) {
          mapa.delete(otro.id_privilegio);
          habiaOtro = true;
        }
      }
      this.avisoPrecursor.set(habiaOtro);
    }

    mapa.set(p.id_privilegio, { fecha_inicio: hoyIso(), fecha_fin: null });
    this.seleccion.set(mapa);
  }

  limpiarPrivilegios() {
    this.seleccion.set(new Map());
    this.avisoPrecursor.set(false);
    this.finExpandido.set(new Set());
  }

  setFechaInicioPrivilegio(id: number, valor: string | null) {
    const mapa = new Map(this.seleccion());
    const actual = mapa.get(id);
    if (!actual) return;
    mapa.set(id, { ...actual, fecha_inicio: valor || hoyIso() });
    this.seleccion.set(mapa);
  }

  setFechaFinPrivilegio(id: number, valor: string | null) {
    const mapa = new Map(this.seleccion());
    const actual = mapa.get(id);
    if (!actual) return;
    mapa.set(id, { ...actual, fecha_fin: valor || null });
    this.seleccion.set(mapa);
  }

  // ── Cierre y envío ───────────────────────────────────────────────────────

  puedeCrear = computed(() => this.congregacionId != null);

  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.isOpen()) this.intentarCerrar();
  }

  intentarCerrar() {
    if (this.form.dirty && !this.confirmarDescarte()) {
      this.confirmarDescarte.set(true);
      return;
    }
    this.cerrar();
  }

  cerrar() {
    this.confirmarDescarte.set(false);
    this.cancelled.emit();
  }

  seguirEditando() {
    this.confirmarDescarte.set(false);
  }

  /** Enter avanza de paso; en el último, envía. */
  onEnter(event: Event) {
    event.preventDefault();
    if (this.isLastStep()) this.submit();
    else this.goNext();
  }

  submit() {
    if (!this.puedeCrear() || this.saving) return;

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const paso = this.firstInvalidStep();
      if (paso) {
        this.maxStepReached.set(Math.max(this.maxStepReached(), this.steps.findIndex(s => s.id === paso)));
        this.activeStep.set(paso);
        this.revealStepErrors(paso);
      }
      return;
    }

    const v = this.form.value;
    const publicador: Record<string, unknown> = {
      primer_nombre: (v.primer_nombre ?? '').trim(),
      segundo_nombre: (v.segundo_nombre ?? '').trim() || null,
      primer_apellido: (v.primer_apellido ?? '').trim(),
      segundo_apellido: (v.segundo_apellido ?? '').trim() || null,
      nombre_visible: (v.nombre_visible ?? '').trim() || null,
      sexo: v.sexo || null,
      fecha_nacimiento: v.fecha_nacimiento || null,
      fecha_bautismo: v.fecha_bautismo || null,
      id_grupo_publicador: v.id_grupo_publicador || null,
      id_congregacion_publicador: this.congregacionId,
      id_estado_publicador: this.estadoActivoId,
      // El asistente no pregunta por estos, pero el backend los espera con un
      // valor concreto; son los mismos que aplicaba el panel al crear.
      ungido: null,
      consentimiento_datos: false,
      permite_login_simple: true,
    };

    const privilegios: PrivilegioSeleccionado[] = [];
    for (const [id, fechas] of this.seleccion()) {
      const priv = this.privilegios.find(p => p.id_privilegio === id);
      privilegios.push({
        id_privilegio: id,
        fecha_inicio: fechas.fecha_inicio,
        // Indefinido salvo que sea auxiliar y se haya puesto un fin explícito.
        fecha_fin: priv && this.esAuxiliar(priv) ? fechas.fecha_fin : null,
      });
    }

    this.created.emit({ publicador, privilegios });
  }

  /** Deja el asistente listo para un alta nueva. */
  reset() {
    this.form.reset({
      primer_nombre: '',
      segundo_nombre: '',
      primer_apellido: '',
      segundo_apellido: '',
      nombre_visible: '',
      sexo: null,
      fecha_nacimiento: null,
      fecha_bautismo: null,
      id_grupo_publicador: null,
    });
    this.formValue.set(this.form.value);
    this.seleccion.set(new Map());
    this.avisoPrecursor.set(false);
    this.confirmarDescarte.set(false);
    this.activeStep.set('nombre');
    this.maxStepReached.set(0);
    this.avanzando.set(true);
    setTimeout(() => this.primerCampoRef?.nativeElement?.focus(), 80);
  }

  /** Mantiene el foco dentro del diálogo mientras está abierto. */
  @HostListener('document:keydown.tab', ['$event'])
  @HostListener('document:keydown.shift.tab', ['$event'])
  onTab(event: Event) {
    if (!this.isOpen() || !(event instanceof KeyboardEvent)) return;
    const raiz = this.dialogoRef?.nativeElement;
    if (!raiz) return;
    const focusables = Array.from(
      raiz.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => el.offsetParent !== null);
    if (focusables.length === 0) return;

    const primero = focusables[0];
    const ultimo = focusables[focusables.length - 1];
    const activo = document.activeElement as HTMLElement | null;

    if (event.shiftKey && activo === primero) {
      event.preventDefault();
      ultimo.focus();
    } else if (!event.shiftKey && activo === ultimo) {
      event.preventDefault();
      primero.focus();
    } else if (activo && !raiz.contains(activo)) {
      event.preventDefault();
      primero.focus();
    }
  }
}
