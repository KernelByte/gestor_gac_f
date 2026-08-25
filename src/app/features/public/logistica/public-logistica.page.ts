import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ThemeService } from '../../../core/services/theme.service';
import { LogisticaPublicoOut } from '../../reuniones/models/logistica.models';

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Mismo agrupamiento visual que `SECCION_PUESTOS` en
 * `reuniones-logistica.component.ts`, duplicado a propósito: esta página no
 * lleva sesión ni ningún otro import de esa pantalla de edición, así que un
 * import cruzado sólo por 3 líneas de constante añadiría un acoplamiento que
 * no vale la pena.
 */
const PUESTOS_LABEL: Record<string, string> = {
  acomodador_1: 'Acomodador', acomodador_2: 'Acomodador',
  vigilancia_1: 'Vigilancia', vigilancia_2: 'Vigilancia',
  microfono_1: 'Micrófono', microfono_2: 'Micrófono',
  plataforma: 'Plataforma', audio: 'Audio', video: 'Video',
};

interface FilaPuesto {
  etiqueta: string;
  nombres: string;
}

interface FechaVista {
  fecha: string;
  diaSemana: string;
  fechaLarga: string;
  filas: FilaPuesto[];
  aseo: string | null;
}

@Component({
  standalone: true,
  selector: 'app-public-logistica',
  imports: [CommonModule],
  template: `
<div class="min-h-dvh flex flex-col bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 transition-colors">

  <header class="sticky top-0 z-30 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md">
    <div class="px-4 sm:px-5 h-16 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <span class="grid place-items-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm shrink-0">
          <img src="images/logo-gac-96.webp" class="w-7 h-7 object-contain" alt="GAC" width="28" height="28" />
        </span>
        <div class="min-w-0 leading-tight">
          <h1 class="font-display text-sm sm:text-base font-bold text-slate-800 dark:text-slate-50 truncate">
            {{ data()?.nombre_congregacion || 'Programa de la congregación' }}
          </h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
            {{ tituloMes() }}
          </p>
        </div>
      </div>

      <button
        type="button"
        (click)="theme.toggleTheme()"
        [attr.aria-label]="theme.darkMode() ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'"
        class="grid place-items-center w-10 h-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-violet-600 dark:hover:text-violet-300 transition-colors shrink-0">
        @if (theme.darkMode()) {
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"/></svg>
        } @else {
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"/></svg>
        }
      </button>
    </div>
  </header>

  @if (cargando()) {
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="text-center">
        <div class="loading-spin mx-auto mb-4"></div>
        <p class="text-sm text-slate-500 dark:text-slate-400">Cargando el programa…</p>
      </div>
    </div>
  }

  @if (error() && !cargando()) {
    <div class="flex-1 flex items-center justify-center p-6">
      <div class="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900/50 rounded-2xl p-8 max-w-sm w-full text-center shadow-sm">
        <div class="w-14 h-14 mx-auto mb-4 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
          <svg class="w-7 h-7 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
        </div>
        <h2 class="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Enlace no disponible</h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">{{ error() }}</p>
      </div>
    </div>
  }

  @if (data() && !cargando() && !error()) {
    <main class="flex-1 max-w-2xl w-full mx-auto px-4 py-5 space-y-3">
      @for (f of fechasVista(); track f.fecha) {
        <article class="rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <header class="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
            <p class="text-xs font-black uppercase tracking-wide text-violet-600 dark:text-violet-400">{{ f.diaSemana }}</p>
            <p class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ f.fechaLarga }}</p>
          </header>
          <dl class="px-4 py-3 space-y-1.5">
            @for (fila of f.filas; track fila.etiqueta) {
              <div class="flex items-baseline gap-2 text-sm">
                <dt class="w-24 shrink-0 text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wide">{{ fila.etiqueta }}</dt>
                <dd class="text-slate-700 dark:text-slate-200 min-w-0">{{ fila.nombres }}</dd>
              </div>
            }
            @if (f.aseo) {
              <div class="flex items-baseline gap-2 text-sm pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
                <dt class="w-24 shrink-0 text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wide">Aseo</dt>
                <dd class="text-slate-700 dark:text-slate-200 min-w-0">{{ f.aseo }}</dd>
              </div>
            }
            @if (!f.filas.length && !f.aseo) {
              <p class="text-xs text-slate-400 dark:text-slate-500">Sin asignaciones registradas para esta fecha.</p>
            }
          </dl>
        </article>
      }

      @if (!fechasVista().length) {
        <p class="text-center text-sm text-slate-400 dark:text-slate-500 py-10">Este mes todavía no tiene fechas programadas.</p>
      }
    </main>

    <footer class="text-center py-4 px-4 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900">
      Este enlace expira el {{ data()!.expira_en | date:'d MMM y':'':'es' }} &mdash; Sistema GAC
    </footer>
  }
</div>
  `,
  styles: [`
    :host { display: block; }
    .loading-spin {
      width: 2.25rem; height: 2.25rem; border-radius: 50%;
      border: 3px solid rgba(148,163,184,0.35); border-top-color: #7c3aed;
      animation: spin 700ms linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class PublicLogisticaPage implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  theme = inject(ThemeService);

  data = signal<LogisticaPublicoOut | null>(null);
  cargando = signal(true);
  error = signal<string | null>(null);

  tituloMes = computed(() => {
    const d = this.data();
    return d ? `${MESES_ES[d.mes - 1]} ${d.ano}` : '';
  });

  fechasVista = computed<FechaVista[]>(() => {
    const d = this.data();
    if (!d) return [];

    const porFecha = new Map<string, Map<string, string>>();
    for (const a of d.asignaciones) {
      if (!a.publicador) continue;
      if (!porFecha.has(a.fecha)) porFecha.set(a.fecha, new Map());
      const fila = porFecha.get(a.fecha)!;
      const etiqueta = PUESTOS_LABEL[a.puesto] ?? a.puesto;
      const previo = fila.get(etiqueta);
      fila.set(etiqueta, previo ? `${previo} / ${a.publicador.nombre_completo}` : a.publicador.nombre_completo);
    }

    const aseoPorFecha = new Map<string, string>();
    for (const s of d.aseo) {
      if (s.grupo) aseoPorFecha.set(s.fecha, s.grupo.nombre_grupo);
    }

    return d.fechas.map((f) => {
      const dt = new Date(f.fecha + 'T00:00:00');
      const fila = porFecha.get(f.fecha) ?? new Map();
      return {
        fecha: f.fecha,
        diaSemana: DIAS_ES[dt.getDay()],
        fechaLarga: `${dt.getDate()} de ${MESES_ES[dt.getMonth()].toLowerCase()}`,
        filas: [...fila.entries()].map(([etiqueta, nombres]) => ({ etiqueta, nombres })),
        aseo: aseoPorFecha.get(f.fecha) ?? null,
      };
    });
  });

  ngOnInit(): void {
    const token = this.route.snapshot.params['token'];
    this.http
      .get<LogisticaPublicoOut>(`${environment.apiUrl}/reuniones/logistica/public/${token}`)
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.cargando.set(false);
        },
        error: (e) => {
          this.error.set(e?.error?.detail || 'El enlace es inválido o ha expirado.');
          this.cargando.set(false);
        },
      });
  }
}
