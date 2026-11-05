import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AgendaService } from '../../../secretario-tools/services/agenda.service';
import { Festivo } from '../../../secretario-tools/models/agenda.model';
import { ToastService } from '../../../../shared/components/toast/toast.service';

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «2026-12-08» → «martes 8 de diciembre» (sin pasar por zonas horarias). */
function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return `${DIAS_SEMANA[new Date(a, m - 1, d).getDay()]} ${d} de ${MESES[m - 1]}`;
}

@Component({
  selector: 'app-festivos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="h-full overflow-y-auto overscroll-contain">
      <div class="px-4 sm:px-6 lg:px-7 py-5 lg:py-6 max-w-3xl flex flex-col gap-6">

        <div>
          <h2 class="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">Festivos de Colombia</h2>
          <p class="text-sm text-slate-600 dark:text-slate-300">
            Estos días se marcan en amarillo en la Agenda del secretario. Escoja un año; si todavía no tiene festivos, pulse «Cargar festivos de ley».
          </p>
        </div>

        <div class="flex flex-wrap items-end gap-3">
          <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Año
            <div class="flex items-center gap-2">
              <button type="button" class="h-11 w-11 rounded-xl border border-slate-300 dark:border-slate-600 text-lg font-bold" aria-label="Año anterior" (click)="cambiarAnio(-1)">‹</button>
              <input type="number" min="2000" max="2100" class="h-11 w-24 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-center text-base font-bold"
                     [ngModel]="anio()" (ngModelChange)="anio.set($event); cargar()"/>
              <button type="button" class="h-11 w-11 rounded-xl border border-slate-300 dark:border-slate-600 text-lg font-bold" aria-label="Año siguiente" (click)="cambiarAnio(1)">›</button>
            </div>
          </label>
          <button type="button" class="h-11 px-4 rounded-xl bg-violet-700 text-white text-sm font-bold disabled:opacity-60" [disabled]="trabajando()" (click)="generar()">
            Cargar festivos de ley de {{ anio() }}
          </button>
        </div>

        @if (error()) {
          <p class="text-sm font-semibold text-red-700 dark:text-red-300">No se pudieron leer los festivos. Intente de nuevo.</p>
        }

        <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 overflow-hidden">
          @if (cargando()) {
            <p class="p-4 text-sm text-slate-600 dark:text-slate-300">Cargando…</p>
          } @else if (!festivos().length) {
            <p class="p-4 text-sm text-slate-600 dark:text-slate-300">El {{ anio() }} todavía no tiene festivos. Pulse «Cargar festivos de ley de {{ anio() }}».</p>
          } @else {
            <p class="px-4 pt-3 text-sm font-semibold text-slate-700 dark:text-slate-200">{{ festivos().length }} festivos en {{ anio() }}</p>
            <ul class="divide-y divide-slate-100 dark:divide-slate-700/60">
              @for (f of festivos(); track f.fecha) {
                <li class="flex items-center justify-between gap-3 px-4 py-3">
                  <div class="min-w-0">
                    <p class="text-sm font-bold text-slate-900 dark:text-slate-100 first-letter:uppercase">{{ larga(f.fecha) }}</p>
                    <p class="text-sm text-slate-600 dark:text-slate-300">{{ f.nombre }}</p>
                  </div>
                  <button type="button" class="h-10 px-3 rounded-lg text-sm font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-60"
                          [disabled]="trabajando()" (click)="quitar(f)" [attr.aria-label]="'Quitar festivo ' + f.nombre">Quitar</button>
                </li>
              }
            </ul>
          }
        </div>

        <form class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40 p-4 flex flex-col gap-3" (ngSubmit)="agregar()">
          <h3 class="text-base font-bold text-slate-900 dark:text-white">Agregar un festivo a mano</h3>
          <p class="text-sm text-slate-600 dark:text-slate-300">Úselo si el gobierno decreta un día festivo extra o si un día cambia.</p>
          <div class="flex flex-wrap gap-3">
            <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              Fecha
              <input type="date" name="fecha" required class="h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-base" [(ngModel)]="nuevaFecha"/>
            </label>
            <label class="flex flex-col gap-1 text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1 min-w-[12rem]">
              Nombre
              <input type="text" name="nombre" required maxlength="120" class="h-11 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-base" [(ngModel)]="nuevoNombre"/>
            </label>
          </div>
          <div>
            <button type="submit" class="h-11 px-4 rounded-xl border border-violet-700 text-violet-800 dark:text-violet-200 text-sm font-bold disabled:opacity-60"
                    [disabled]="trabajando() || !nuevaFecha || !nuevoNombre.trim()">Agregar festivo</button>
          </div>
        </form>

      </div>
    </div>
  `,
})
export class FestivosComponent implements OnInit {
  private svc = inject(AgendaService);
  private toast = inject(ToastService);

  anio = signal(new Date().getFullYear());
  festivos = signal<Festivo[]>([]);
  cargando = signal(false);
  trabajando = signal(false);
  error = signal(false);
  nuevaFecha = '';
  nuevoNombre = '';

  private anioValido = computed(() => { const a = Number(this.anio()); return a >= 2000 && a <= 2100; });

  ngOnInit() { this.cargar(); }

  larga = fechaLarga;

  cambiarAnio(delta: number) {
    this.anio.set(Number(this.anio()) + delta);
    this.cargar();
  }

  cargar() {
    if (!this.anioValido()) { this.festivos.set([]); return; }
    const a = Number(this.anio());
    this.cargando.set(true);
    this.svc.festivos(`${a}-01-01`, `${a}-12-31`).subscribe({
      next: f => { this.festivos.set(f); this.error.set(false); this.cargando.set(false); },
      error: () => { this.error.set(true); this.cargando.set(false); },
    });
  }

  generar() {
    if (!this.anioValido()) { this.toast.warning('Escriba un año entre 2000 y 2100.'); return; }
    this.trabajando.set(true);
    this.svc.generarFestivos(Number(this.anio())).subscribe({
      next: f => {
        this.festivos.set(f);
        this.trabajando.set(false);
        this.toast.success(`Festivos de ${this.anio()} cargados`, `${f.length} días marcados.`);
      },
      error: () => { this.trabajando.set(false); this.toast.error('No se pudieron cargar los festivos.'); },
    });
  }

  agregar() {
    this.trabajando.set(true);
    this.svc.crearFestivo(this.nuevaFecha, this.nuevoNombre.trim()).subscribe({
      next: () => {
        this.trabajando.set(false);
        this.toast.success('Festivo agregado');
        this.nuevaFecha = ''; this.nuevoNombre = '';
        this.cargar();
      },
      error: e => {
        this.trabajando.set(false);
        this.toast.error(e?.status === 409 ? 'Ese día ya es festivo.' : 'No se pudo agregar el festivo.');
      },
    });
  }

  quitar(f: Festivo) {
    if (!confirm(`¿Quitar «${f.nombre}» (${fechaLarga(f.fecha)}) de los festivos?`)) return;
    this.trabajando.set(true);
    this.svc.eliminarFestivo(f.fecha).subscribe({
      next: () => { this.trabajando.set(false); this.festivos.update(l => l.filter(x => x.fecha !== f.fecha)); },
      error: () => { this.trabajando.set(false); this.toast.error('No se pudo quitar el festivo.'); },
    });
  }
}
