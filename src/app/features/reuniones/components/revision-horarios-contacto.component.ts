import { Component, EventEmitter, Input, Output, computed, effect, inject, signal, untracked } from '@angular/core';
import { ContactoPorRevisar, DiscursosService, RevisionHorariosContacto } from '../services/discursos.service';
import { horaLegible } from '../utils/mensajes-discursos';
import { diaTexto } from '../../configuracion/horarios-reunion.service';

const BTN = 'inline-flex items-center justify-center min-h-11 px-4 rounded-xl text-sm font-semibold ' +
  'transition-[background-color,transform] duration-150 ease-out active:scale-[0.98] disabled:opacity-50 ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-500/25';

/**
 * Aviso de diciembre/enero en Discursos → Congregaciones: confirmar el horario
 * de las congregaciones que visitan nuestros oradores. Muchas comparten salón y
 * rotan el 1 de enero; si nadie actualiza el directorio, las salidas de enero
 * llevan el día o la hora viejos.
 *
 * Por cada una: "Cambió: actualizar" (abre la edición del directorio, que al
 * guardar la da por revisada y corrige la hora de sus salidas futuras) o
 * "Sigue igual". Backend: discursos_service.revision_horarios_contacto.
 */
@Component({
  selector: 'app-revision-horarios-contacto',
  standalone: true,
  styles: [`
    .aparecer { animation: aparecer 220ms cubic-bezier(0.23, 1, 0.32, 1); }
    @keyframes aparecer { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .aparecer { animation: none; } }
  `],
  template: `
  @if (revision(); as r) {
    <section aria-labelledby="rev-contacto-titulo" class="aparecer rounded-2xl border border-amber-300 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/30 px-4 py-4 sm:px-5 space-y-3">
      <div>
        <h3 id="rev-contacto-titulo" class="text-base font-semibold text-amber-950 dark:text-amber-100">
          {{ r.atrasado ? 'Ya empezó ' + r.ano + ': ¿cambió el horario de las congregaciones que visitan?' : '¿Cambia en ' + r.ano + ' el horario de las congregaciones que visitan?' }}
        </h3>
        <p class="mt-1 text-sm leading-relaxed text-amber-900 dark:text-amber-200">
          Muchas comparten el Salón del Reino y cambian de horario el 1 de enero. Confirme el día y la hora de cada una
          para que los oradores lleguen a tiempo.
        </p>
      </div>

      <ul class="divide-y divide-amber-200/70 dark:divide-amber-900/50 rounded-xl bg-white/70 dark:bg-slate-900/40">
        @for (c of visibles(); track c.id_congregacion_contacto) {
          <li class="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ c.nombre }}@if (c.ciudad) {<span class="font-normal text-slate-600 dark:text-slate-400"> · {{ c.ciudad }}</span>}</p>
              <p class="text-sm text-slate-700 dark:text-slate-300">
                Hoy figura: <strong>{{ horarioTexto(c) }}</strong>
                @if (c.salidas_proximas) {
                  <span class="text-amber-800 dark:text-amber-300"> · {{ c.salidas_proximas }} {{ c.salidas_proximas === 1 ? 'salida programada' : 'salidas programadas' }}</span>
                }
              </p>
            </div>
            @if (puedeEditar) {
              <div class="flex flex-wrap gap-2">
                <button type="button" [class]="btn + ' bg-brand-purple text-white hover:bg-violet-800'" (click)="editar.emit(c.id_congregacion_contacto)">Cambió: actualizar</button>
                <button type="button" [class]="btnSecundario" [disabled]="trabajando()" (click)="sigueIgual([c.id_congregacion_contacto])">Sigue igual</button>
              </div>
            }
          </li>
        }
      </ul>

      <div class="flex flex-wrap items-center gap-2">
        @if (r.pendientes.length > visibles().length) {
          <button type="button" [class]="btnSecundario" (click)="verTodas.set(true)">Ver las {{ r.pendientes.length }}</button>
        }
        @if (puedeEditar && r.pendientes.length > 1) {
          @if (confirmandoTodas()) {
            <span class="text-sm text-amber-950 dark:text-amber-100">¿Ninguna cambió de horario?</span>
            <button type="button" [class]="btn + ' bg-brand-purple text-white hover:bg-violet-800'" [disabled]="trabajando()" (click)="sigueIgual()">Sí, todas siguen igual</button>
            <button type="button" [class]="btnSecundario" (click)="confirmandoTodas.set(false)">No</button>
          } @else {
            <button type="button" [class]="btn + ' text-amber-900 dark:text-amber-200 underline-offset-4 hover:underline'" (click)="confirmandoTodas.set(true)">Ninguna cambió</button>
          }
        }
      </div>
    </section>
  }
  `,
})
export class RevisionHorariosContactoComponent {
  @Input() idCong: number | null = null;
  @Input() puedeEditar = false;
  /** Abrir la edición de esa congregación en el directorio. */
  @Output() editar = new EventEmitter<number>();

  private svc = inject(DiscursosService);

  readonly btn = BTN;
  readonly btnSecundario = BTN + ' border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-amber-950 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-slate-800';

  revision = signal<RevisionHorariosContacto | null>(null);
  trabajando = signal(false);
  verTodas = signal(false);
  confirmandoTodas = signal(false);

  visibles = computed<ContactoPorRevisar[]>(() => {
    const p = this.revision()?.pendientes ?? [];
    return this.verTodas() ? p : p.slice(0, 3);
  });

  /** Cada vez que cambia el directorio (p. ej. al guardar una edición) se vuelve a preguntar. */
  private readonly alCambiarDirectorio = effect(() => {
    this.svc.directorioContacto(this.idCong)();
    untracked(() => this.cargar());
  });

  private cargar(): void {
    this.svc.getRevisionHorariosContacto(this.idCong).subscribe({
      next: (r) => this.revision.set(r),
      error: () => this.revision.set(null),
    });
  }

  sigueIgual(ids?: number[]): void {
    this.trabajando.set(true);
    this.svc.horarioContactoSigueIgual(this.idCong, ids).subscribe({
      next: (r) => { this.revision.set(r); this.trabajando.set(false); this.confirmandoTodas.set(false); },
      error: () => this.trabajando.set(false),
    });
  }

  horarioTexto(c: ContactoPorRevisar): string {
    if (!c.dia_reunion_fin_semana && !c.hora_reunion_fin_semana) return 'sin día ni hora';
    const hora = horaLegible(c.hora_reunion_fin_semana);
    return c.dia_reunion_fin_semana ? (hora ? `${diaTexto(c.dia_reunion_fin_semana)}, ${hora}` : diaTexto(c.dia_reunion_fin_semana)) : hora;
  }
}
