import { Component, computed, inject, viewChild } from '@angular/core';
import { NgClass } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import { modoAgenda } from '../../../../core/auth/acceso-modulos';
import { AgendaService } from '../../services/agenda.service';
import { AgendaCalendarioComponent } from '../components/agenda-calendario.component';
import { TareasListaComponent } from '../../../herramientas/mis-tareas/components/tareas-lista.component';

type Vista = 'calendario' | 'tareas';

/**
 * Mi Agenda (/agenda): un solo lugar para lo que tiene fecha y para las tareas.
 *
 * - Secretario / Administrador: calendario de la secretaría + sus tareas.
 * - Coordinador y ancianos: su agenda personal + sus tareas.
 * - Quien solo tiene acceso a Tareas: solo la lista de tareas, sin pestañas.
 *
 * La pestaña va en ?vista=tareas para que los enlaces (y /herramientas/mis-tareas) lleguen directo.
 */
@Component({
  selector: 'app-agenda-page',
  standalone: true,
  imports: [NgClass, AgendaCalendarioComponent, TareasListaComponent],
  // Instancia propia del servicio: el calendario y sus modales usan la agenda de esta persona.
  providers: [AgendaService],
  template: `
  <!-- El calendario ocupa el alto de la ventana desde 1280 px; la lista de tareas crece y hace scroll la página. -->
  <div class="flex flex-col gap-3 xl:gap-4" [ngClass]="{ 'xl:flex-1 xl:min-h-0': vista() === 'calendario' }">
    @if (conPestanas || conTareas) {
    <div class="flex flex-wrap items-center gap-3">
      @if (conPestanas) {
        <div class="tab-nav tab-compact" role="tablist" aria-label="Qué ver">
          <button type="button" role="tab" class="tab-item"
                  [attr.aria-selected]="vista() === 'calendario'" (click)="cambiarVista('calendario')">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1Z"/></svg>
            Calendario
          </button>
          <button type="button" role="tab" class="tab-item"
                  [attr.aria-selected]="vista() === 'tareas'" (click)="cambiarVista('tareas')">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
            Tareas
          </button>
        </div>
      }
      @if (conTareas) {
        <button type="button" class="btn-nueva ml-auto" data-testid="btn-nueva-tarea" aria-label="Nueva tarea" (click)="nuevaTarea()">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path stroke-linecap="round" d="M12 5v14m-7-7h14"/></svg>
          Nueva<span class="hidden sm:inline -ml-0.5">tarea</span>
        </button>
      }
    </div>
    }

    @if (vista() === 'calendario') {
      <app-agenda-calendario/>
    } @else {
      <app-tareas-lista/>
    }
  </div>
  `,
  styles: [`
    /* Acento rosa de la Agenda: lo leen las pestañas (.tab-item) y el resto de piezas globales. */
    :host { --accent: #e11d48; --accent-hover: #be123c; --accent-focus: #e11d48; --accent-ring: rgb(225 29 72 / 0.18); --accent-shadow: 0 1px 2px rgb(225 29 72 / 0.2); }
    .btn-nueva {
      display: inline-flex; align-items: center; gap: 6px; height: 40px; padding: 0 14px; border-radius: 10px;
      font-size: 14px; font-weight: 600; white-space: nowrap; color: #fff;
      background: #e11d48; box-shadow: 0 1px 2px rgb(225 29 72 / 0.2);
      transition: background 120ms ease, transform 100ms ease;
    }
    .btn-nueva:hover { background: rgb(190 18 60); }
    .btn-nueva:active { transform: scale(0.97); }
    .btn-nueva:focus-visible { outline: 2px solid rgb(244 63 94); outline-offset: 2px; }
    @media (pointer: coarse) { .btn-nueva { min-height: 44px; } }
  `],
})
export class AgendaPage {
  private auth = inject(AuthStore);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private svc = inject(AgendaService);

  private readonly modo = modoAgenda(this.auth);
  /** Quien solo tiene Tareas no tiene calendario (no hay /agenda para él en el backend). */
  readonly conCalendario = this.modo === 'secretaria' || this.modo === 'personal';
  readonly conTareas = this.auth.hasPermission('tareas.ver');
  /** Pestañas solo si hay dos vistas: una pestaña sola no aporta nada. */
  readonly conPestanas = this.conCalendario && this.conTareas;

  private readonly params = toSignal(this.route.queryParamMap.pipe(map(p => ({ vista: p.get('vista'), fecha: p.get('fecha') }))));

  vista = computed<Vista>(() => {
    if (!this.conCalendario) return 'tareas';
    const p = this.params();
    // Un aviso con ?fecha= siempre abre el calendario en ese día.
    return p?.vista === 'tareas' && this.conTareas && !p.fecha ? 'tareas' : 'calendario';
  });

  private calendario = viewChild(AgendaCalendarioComponent);
  private tareas = viewChild(TareasListaComponent);

  constructor() {
    if (this.modo === 'personal') this.svc.usarModo('personal');
  }

  cambiarVista(v: Vista) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { vista: v === 'tareas' ? 'tareas' : null, fecha: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  nuevaTarea() {
    if (this.vista() === 'tareas') this.tareas()?.abrirCrear();
    else this.calendario()?.nuevaTarea(null);
  }
}
