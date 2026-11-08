import {
   Component, ElementRef, EventEmitter, Input, OnChanges, Output, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { hoyIso } from '../../core/utils/fecha.util';
import {
   HorarioReunion, HorariosReunionService, ReunionesMovidas, ResumenHorarios,
   diaTexto, explicacionRecordatorio, fechaLarga, hhmm, preguntaRecordatorio, reunionTexto,
} from './horarios-reunion.service';

/** Botones: respuesta al pulsar (escala), foco visible y 44 px de alto mínimo. */
const BTN = 'inline-flex items-center justify-center gap-2 min-h-11 px-4 rounded-xl text-sm font-semibold ' +
   'transition-[background-color,transform] duration-150 ease-out active:scale-[0.98] ' +
   'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ' +
   'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-purple/25';
const BTN_PRIMARIO = BTN + ' px-5 bg-brand-purple text-white hover:bg-[#5b21b6]';
const BTN_SECUNDARIO = BTN + ' border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 ' +
   'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700';
const CHIP = BTN + ' border';
const CHIP_ON = 'border-brand-purple bg-brand-purple text-white';
const CHIP_OFF = 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 hover:border-slate-400';
const CAMPO = 'h-12 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/60 ' +
   'text-base font-medium text-slate-900 dark:text-white tabular-nums outline-none ' +
   'focus:border-brand-purple focus:ring-4 focus:ring-brand-purple/15 transition-[border-color,box-shadow] duration-150';

/**
 * Cambio de horario con fecha (Configuración → Reuniones).
 *
 * Las congregaciones que comparten salón rotan sus horarios cada año. Aquí se
 * deja dicho "desde el 1 de enero nos reunimos el martes y el domingo" y la app
 * lo aplica sola ese día, moviendo las reuniones que ya estén programadas. Si
 * se les olvidó, se puede fechar hasta unos tres meses atrás. En diciembre y
 * enero pregunta si el horario cambia (ver AvisoCambioHorarioComponent en
 * Inicio). Backend: modules/reuniones/horario_cambios_service.py.
 */
@Component({
   selector: 'app-cambio-horario',
   standalone: true,
   imports: [CommonModule, FormsModule],
   styles: [`
    /* Al llegar desde Inicio se desplaza hasta aquí: que no quede bajo la barra fija de secciones. */
    :host { display: block; scroll-margin-top: 5rem; }
    .aparecer { animation: aparecer 220ms cubic-bezier(0.23, 1, 0.32, 1); }
    @keyframes aparecer { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .aparecer { animation: none; } }
   `],
   template: `
   <div class="space-y-4">
      <div>
         <h3 class="text-base font-semibold text-slate-900 dark:text-white">Cambio de horario con fecha</h3>
         <p class="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Para cuando el horario cambia desde un día concreto, por ejemplo el 1 de enero si comparten el Salón del Reino.
            La app lo aplica sola ese día y las reuniones anteriores no cambian.
         </p>
      </div>

      @if (exito(); as msg) {
         <p role="status" class="aparecer flex items-start gap-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200">
            <svg class="mt-0.5 h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7" /></svg>
            <span>{{ msg }}</span>
         </p>
      }

      @if (error()) {
         <p role="alert" class="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-800 dark:text-red-300">{{ error() }}</p>
      }

      <!-- Pregunta de diciembre/enero -->
      @if (!abierto() && recordatorio(); as r) {
         <div class="aparecer rounded-2xl border border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 px-4 py-4 sm:px-5 space-y-3">
            <p class="text-base font-semibold text-amber-950 dark:text-amber-100">{{ pregunta(r) }}</p>
            <p class="text-sm leading-relaxed text-amber-900 dark:text-amber-200">{{ explicacion(r) }}</p>
            <div class="flex flex-wrap gap-2 pt-1">
               <button type="button" [class]="btnPrimario" (click)="abrir(r.ano)">{{ r.atrasado ? 'Sí, cambió: registrarlo' : 'Sí, cambia: registrarlo' }}</button>
               <button type="button" [class]="btnSecundario" (click)="sinCambio(r.ano)" [disabled]="trabajando()">No, sigue igual</button>
            </div>
         </div>
      }

      <!-- Cambios programados (aún no empiezan) y el reciente (ya en uso, se puede deshacer) -->
      @for (c of tarjetas(); track c.horario.vigente_desde) {
         <div class="aparecer rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/60 dark:bg-purple-950/25 px-4 py-4 sm:px-5 space-y-3">
            <p class="text-sm font-semibold text-slate-900 dark:text-white">
               {{ c.yaEmpezo ? 'Desde el ' : 'A partir del ' }}{{ fechaLarga(c.horario.vigente_desde) }}
               @if (c.yaEmpezo) { <span class="font-normal text-slate-600 dark:text-slate-400">(es el horario actual)</span> }
            </p>
            <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
               <dt class="text-slate-600 dark:text-slate-400">Entre semana</dt>
               <dd class="font-semibold text-slate-900 dark:text-white">{{ reunionTexto(c.horario.dia_entre_semana, c.horario.hora_entre_semana) }}</dd>
               <dt class="text-slate-600 dark:text-slate-400">Fin de semana</dt>
               <dd class="font-semibold text-slate-900 dark:text-white">{{ reunionTexto(c.horario.dia_fin_semana, c.horario.hora_fin_semana) }}</dd>
            </dl>
            @if (canEdit) {
               @if (quitando() === c.horario.vigente_desde) {
                  <div class="aparecer space-y-2 rounded-xl bg-white/70 dark:bg-slate-900/40 px-3 py-3">
                     <p class="text-sm text-slate-800 dark:text-slate-200">
                        {{ c.yaEmpezo ? '¿Deshacer este cambio? Las reuniones vuelven al horario anterior.' : '¿Quitar este cambio? Las reuniones ya movidas vuelven al horario actual.' }}
                     </p>
                     <div class="flex flex-wrap gap-2">
                        <button type="button" (click)="quitar(c.horario.vigente_desde)" [disabled]="trabajando()"
                           [class]="btn + ' bg-red-600 text-white hover:bg-red-700'">{{ trabajando() ? 'Un momento…' : (c.yaEmpezo ? 'Sí, deshacer' : 'Sí, quitar') }}</button>
                        <button type="button" (click)="quitando.set(null)" [disabled]="trabajando()" [class]="btnSecundario">No</button>
                     </div>
                  </div>
               } @else {
                  <button type="button" (click)="quitando.set(c.horario.vigente_desde)" [class]="btnSecundario">
                     {{ c.yaEmpezo ? 'Deshacer este cambio' : 'Quitar este cambio' }}
                  </button>
               }
            }
         </div>
      }

      @if (canEdit && !abierto() && !recordatorio()) {
         <button type="button" (click)="abrir()" [class]="btnSecundario">Programar un cambio de horario</button>
      }

      <!-- Formulario -->
      @if (abierto()) {
         <form class="aparecer rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-5 sm:px-5 space-y-6" (ngSubmit)="movidas() ? confirmar() : revisar()">
            @if (resumen()?.vigente; as v) {
               <p class="text-sm text-slate-600 dark:text-slate-400">
                  Horario actual: entre semana <strong class="text-slate-900 dark:text-white">{{ reunionTexto(v.dia_entre_semana, v.hora_entre_semana) }}</strong>
                  · fin de semana <strong class="text-slate-900 dark:text-white">{{ reunionTexto(v.dia_fin_semana, v.hora_fin_semana) }}</strong>
               </p>
            }

            <!-- 1 -->
            <div class="space-y-2">
               <label for="ch-desde" class="block text-sm font-semibold text-slate-800 dark:text-slate-200">1. ¿Desde qué día empieza el horario nuevo?</label>
               <input id="ch-desde" name="desde" type="date" required [min]="resumen()?.fecha_minima ?? ''"
                  [ngModel]="form().vigente_desde" (ngModelChange)="set('vigente_desde', $event)" [class]="campo" aria-describedby="ch-desde-ayuda">
               <p id="ch-desde-ayuda" class="text-sm text-slate-600 dark:text-slate-400">
                  @if (esFechaPasada()) {
                     <span class="text-amber-800 dark:text-amber-300">Esa fecha ya pasó. Las reuniones desde ese día se pondrán en el día nuevo, también las que ya se hicieron.</span>
                  } @else {
                     Normalmente es el 1 de enero.
                  }
               </p>
            </div>

            <!-- 2 -->
            <fieldset class="space-y-3">
               <legend class="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">2. Reunión entre semana</legend>
               <div class="flex flex-wrap gap-2" role="group" aria-label="Día de la reunión entre semana">
                  @for (d of diasEntreSemana; track d) {
                     <button type="button" (click)="set('dia_entre_semana', d)" [attr.aria-pressed]="form().dia_entre_semana === d"
                        [class]="chip" [ngClass]="form().dia_entre_semana === d ? chipOn : chipOff">{{ diaTexto(d) }}</button>
                  }
               </div>
               <div class="space-y-1">
                  <label for="ch-hora-entre" class="block text-sm text-slate-700 dark:text-slate-300">Hora</label>
                  <input id="ch-hora-entre" name="horaEntre" type="time" step="300" [ngModel]="form().hora_entre_semana" (ngModelChange)="set('hora_entre_semana', $event)" [class]="campo">
               </div>
            </fieldset>

            <!-- 3 -->
            <fieldset class="space-y-3">
               <legend class="block text-sm font-semibold text-slate-800 dark:text-slate-200 mb-2">3. Reunión del fin de semana</legend>
               <div class="flex flex-wrap gap-2" role="group" aria-label="Día de la reunión del fin de semana">
                  @for (d of diasFinSemana; track d) {
                     <button type="button" (click)="set('dia_fin_semana', d)" [attr.aria-pressed]="form().dia_fin_semana === d"
                        [class]="chip" [ngClass]="form().dia_fin_semana === d ? chipOn : chipOff">{{ diaTexto(d) }}</button>
                  }
               </div>
               <div class="space-y-1">
                  <label for="ch-hora-fin" class="block text-sm text-slate-700 dark:text-slate-300">Hora</label>
                  <input id="ch-hora-fin" name="horaFin" type="time" step="300" [ngModel]="form().hora_fin_semana" (ngModelChange)="set('hora_fin_semana', $event)" [class]="campo">
               </div>
            </fieldset>

            @if (igualAlActual()) {
               <p class="text-sm text-amber-800 dark:text-amber-300">Es el mismo horario que ya rige antes de esa fecha. Cambie el día o la hora que corresponda.</p>
            }

            <!-- 4: revisión -->
            @if (movidas(); as m) {
               <div class="aparecer rounded-xl bg-slate-50 dark:bg-slate-800/60 px-4 py-4 text-sm leading-relaxed text-slate-800 dark:text-slate-200 space-y-2" aria-live="polite">
                  <p class="font-semibold text-slate-900 dark:text-white">4. Revise antes de confirmar</p>
                  <p>Desde el <strong>{{ fechaLarga(form().vigente_desde) }}</strong>:</p>
                  <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                     <dt class="text-slate-600 dark:text-slate-400">Entre semana</dt>
                     <dd class="font-semibold text-slate-900 dark:text-white">{{ reunionTexto(form().dia_entre_semana, form().hora_entre_semana) }}</dd>
                     <dt class="text-slate-600 dark:text-slate-400">Fin de semana</dt>
                     <dd class="font-semibold text-slate-900 dark:text-white">{{ reunionTexto(form().dia_fin_semana, form().hora_fin_semana) }}</dd>
                  </dl>
                  @if (totalMovidas() === 0) {
                     <p>No hay reuniones programadas desde ese día, así que no se mueve nada.</p>
                  } @else {
                     <p>Estas reuniones ya preparadas pasan al día nuevo, en la misma semana:</p>
                     <ul class="list-disc pl-5">
                        @if (m.programa) { <li>{{ m.programa }} {{ m.programa === 1 ? 'semana' : 'semanas' }} del programa de reuniones</li> }
                        @if (m.discursos) { <li>{{ m.discursos }} {{ m.discursos === 1 ? 'discurso público' : 'discursos públicos' }}</li> }
                        @if (m.logistica) { <li>{{ m.logistica }} {{ m.logistica === 1 ? 'día' : 'días' }} de acomodadores y aseo</li> }
                     </ul>
                     @if (m.ya_pasadas) {
                        <p class="text-amber-800 dark:text-amber-300">{{ m.ya_pasadas === 1 ? 'Una de estas reuniones ya se hizo; quedará registrada' : m.ya_pasadas + ' de estas reuniones ya se hicieron; quedarán registradas' }} en el día nuevo.</p>
                     }
                     <p>Si el programa ya estaba publicado, avise a los hermanos del cambio de día.</p>
                  }
               </div>
            }

            <div class="flex flex-wrap gap-2">
               @if (movidas()) {
                  <button type="submit" [disabled]="trabajando()" [class]="btnPrimario">{{ trabajando() ? 'Guardando…' : 'Confirmar el cambio' }}</button>
               } @else {
                  <button type="submit" [disabled]="trabajando() || !formCompleto() || igualAlActual()" [class]="btnPrimario">{{ trabajando() ? 'Revisando…' : 'Revisar' }}</button>
               }
               <button type="button" (click)="cerrar()" [disabled]="trabajando()" [class]="btnSecundario">Cancelar</button>
            </div>
         </form>
      }
   </div>
   `,
})
export class CambioHorarioComponent implements OnChanges {
   /** Congregación a la que se le programa el cambio. Sin valor, la del usuario. */
   @Input() idCongregacion: number | null = null;
   @Input() canEdit = false;
   /** Abrir el formulario al cargar (viene del aviso de Inicio). */
   @Input() abrirAlCargar = false;
   /** El horario de HOY cambió (cambio ya empezado, o deshecho): el formulario de arriba debe recargarse. */
   @Output() horarioActualCambio = new EventEmitter<void>();

   private svc = inject(HorariosReunionService);
   private host = inject(ElementRef<HTMLElement>);

   readonly btn = BTN;
   readonly btnPrimario = BTN_PRIMARIO;
   readonly btnSecundario = BTN_SECUNDARIO;
   readonly chip = CHIP;
   readonly chipOn = CHIP_ON;
   readonly chipOff = CHIP_OFF;
   readonly campo = CAMPO;
   readonly diasEntreSemana = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];
   readonly diasFinSemana = ['Sabado', 'Domingo'];
   readonly diaTexto = diaTexto;
   readonly reunionTexto = reunionTexto;
   readonly fechaLarga = fechaLarga;
   readonly pregunta = preguntaRecordatorio;
   readonly explicacion = explicacionRecordatorio;

   resumen = signal<ResumenHorarios | null>(null);
   form = signal<HorarioReunion>({ vigente_desde: '', dia_entre_semana: null, hora_entre_semana: null, dia_fin_semana: null, hora_fin_semana: null });
   abierto = signal(false);
   movidas = signal<ReunionesMovidas | null>(null);
   trabajando = signal(false);
   quitando = signal<string | null>(null);
   error = signal<string | null>(null);
   exito = signal<string | null>(null);

   tarjetas = computed(() => {
      const r = this.resumen();
      if (!r) return [];
      const lista = r.cambios_programados.map(horario => ({ horario, yaEmpezo: false }));
      return r.cambio_reciente ? [{ horario: r.cambio_reciente, yaEmpezo: true }, ...lista] : lista;
   });

   /** La pregunta de diciembre/enero, solo en la configuración de la propia congregación. */
   recordatorio = computed(() => (this.canEdit && !this.idCongregacion ? this.resumen()?.recordatorio ?? null : null));

   totalMovidas = computed(() => {
      const m = this.movidas();
      return m ? m.programa + m.discursos + m.logistica : 0;
   });

   formCompleto = computed(() => {
      const f = this.form();
      return !!(f.vigente_desde && f.dia_entre_semana && f.dia_fin_semana);
   });

   esFechaPasada = computed(() => {
      const hoy = this.resumen()?.hoy;
      const desde = this.form().vigente_desde;
      return !!hoy && !!desde && desde < hoy;
   });

   /**
    * El horario que regirá justo antes de la fecha elegida: con un cambio ya
    * programado, volver al de hoy desde una fecha posterior SÍ es un cambio.
    * null si no se conoce (fecha anterior al horario más antiguo a la vista).
    */
   private horarioPrevio = computed<HorarioReunion | null>(() => {
      const r = this.resumen();
      const desde = this.form().vigente_desde;
      if (!r || !desde) return null;
      const conocidos = [r.vigente, r.cambio_reciente, ...r.cambios_programados]
         .filter((h): h is HorarioReunion => !!h)
         .sort((a, b) => a.vigente_desde.localeCompare(b.vigente_desde));
      return conocidos.filter(h => h.vigente_desde < desde).pop() ?? null;
   });

   igualAlActual = computed(() => {
      const v = this.horarioPrevio();
      const f = this.form();
      return !!v && v.dia_entre_semana === f.dia_entre_semana && v.dia_fin_semana === f.dia_fin_semana &&
         hhmm(v.hora_entre_semana) === f.hora_entre_semana && hhmm(v.hora_fin_semana) === f.hora_fin_semana;
   });

   ngOnChanges(): void {
      this.cargar();
   }

   cargar(): void {
      this.svc.resumen(this.idCongregacion).subscribe({
         next: (r) => {
            this.resumen.set(r);
            if (this.abrirAlCargar && this.canEdit && !this.abierto()) {
               this.abrir(r.recordatorio?.ano);
               // Viene de Inicio: que el formulario quede a la vista.
               setTimeout(() => this.host.nativeElement.scrollIntoView({ block: 'start', behavior: 'smooth' }));
            }
         },
         error: () => this.resumen.set(null),
      });
   }

   /** Abre el formulario con el horario actual y el 1 de enero que corresponde. */
   abrir(ano?: number): void {
      const r = this.resumen();
      const v = r?.vigente;
      const anoCambio = ano ?? Number((r?.hoy ?? hoyIso()).slice(0, 4)) + 1;
      this.form.set({
         vigente_desde: `${anoCambio}-01-01`,
         dia_entre_semana: v?.dia_entre_semana ?? null,
         hora_entre_semana: hhmm(v?.hora_entre_semana),
         dia_fin_semana: v?.dia_fin_semana ?? null,
         hora_fin_semana: hhmm(v?.hora_fin_semana),
      });
      this.movidas.set(null);
      this.error.set(null);
      this.exito.set(null);
      this.abierto.set(true);
   }

   cerrar(): void {
      this.abierto.set(false);
      this.movidas.set(null);
      this.error.set(null);
   }

   /** Cambia un campo; cualquier cambio invalida la revisión anterior. */
   set<K extends keyof HorarioReunion>(campo: K, valor: HorarioReunion[K]): void {
      this.form.update(f => ({ ...f, [campo]: campo.startsWith('hora') ? hhmm(valor) : valor }));
      this.movidas.set(null);
      this.error.set(null);
   }

   /** Llamada al servidor con el estado "trabajando" y el mensaje de error comunes. */
   private ejecutar<T>(llamada: Observable<T>, siFalla: string, alTerminar: (r: T) => void): void {
      this.trabajando.set(true);
      this.error.set(null);
      llamada.subscribe({
         next: (r) => { this.trabajando.set(false); alTerminar(r); },
         error: (e) => { this.trabajando.set(false); this.error.set(e.error?.detail || siFalla); },
      });
   }

   revisar(): void {
      if (!this.formCompleto() || this.igualAlActual()) return;
      this.ejecutar(this.svc.vistaPrevia(this.form(), this.idCongregacion),
         'No se pudo revisar el cambio. Inténtelo otra vez.',
         (r) => this.movidas.set(r.movidas));
   }

   confirmar(): void {
      const cambio = this.form();
      this.ejecutar(this.svc.programar(cambio, this.idCongregacion),
         'No se pudo guardar el cambio. Inténtelo otra vez.',
         (r) => {
            this.resumen.set(r);
            this.cerrar();
            const yaEmpezo = cambio.vigente_desde <= r.hoy;
            this.exito.set(yaEmpezo
               ? `Listo. El horario nuevo ya está en uso desde el ${fechaLarga(cambio.vigente_desde)}.`
               : `Listo. El ${fechaLarga(cambio.vigente_desde)} la app cambiará el horario sola.`);
            if (yaEmpezo) this.horarioActualCambio.emit();
         });
   }

   quitar(desde: string): void {
      const yaEmpezo = desde <= (this.resumen()?.hoy ?? '');
      this.ejecutar(this.svc.quitar(desde, this.idCongregacion),
         'No se pudo quitar el cambio. Inténtelo otra vez.',
         (r) => {
            this.resumen.set(r);
            this.quitando.set(null);
            this.exito.set(yaEmpezo ? 'Listo. Se volvió al horario anterior.' : 'Listo. Se quitó el cambio.');
            if (yaEmpezo) this.horarioActualCambio.emit();
         });
   }

   sinCambio(ano: number): void {
      this.ejecutar(this.svc.sinCambio(ano),
         'No se pudo guardar la respuesta. Inténtelo otra vez.',
         (r) => {
            this.resumen.set(r);
            this.exito.set(`Anotado: el horario sigue igual en ${ano}. No se lo volveremos a preguntar este año.`);
         });
   }
}
