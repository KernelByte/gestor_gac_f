import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ToastService } from '../../shared/components/toast/toast.service';
import {
   HorariosReunionService, RecordatorioHorario, explicacionRecordatorio, preguntaRecordatorio,
} from './horarios-reunion.service';

const CLAVE_MAS_TARDE = 'gac.aviso-cambio-horario.mas-tarde';

/**
 * Aviso de Inicio en diciembre y enero: "¿Cambia su horario de reuniones?".
 *
 * Las congregaciones que comparten salón rotan el 1 de enero y es fácil que a
 * nadie se le ocurra decírselo a la app. Dos respuestas claras: "Sí" lleva al
 * formulario ya abierto en Configuración; "No, sigue igual" lo silencia el
 * resto del año. "Más tarde" solo lo oculta en esta sesión.
 * Se muestra solo a quien puede editar la configuración (lo decide Inicio).
 */
@Component({
   selector: 'app-aviso-cambio-horario',
   standalone: true,
   imports: [RouterModule],
   styles: [`
    :host { display: contents; }
    .aparecer { animation: aparecer 240ms cubic-bezier(0.23, 1, 0.32, 1); }
    @keyframes aparecer { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .aparecer { animation: none; } }
   `],
   template: `
   @if (recordatorio(); as r) {
      <section aria-labelledby="aviso-horario-titulo"
         class="aparecer flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800/70 dark:bg-amber-950/30 sm:flex-row sm:items-center sm:p-5">
         <div class="flex min-w-0 flex-1 items-start gap-4">
            <div aria-hidden="true" class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-300/70 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
               <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm7 7v3l2 1.5" /></svg>
            </div>
            <div class="min-w-0">
               <h2 id="aviso-horario-titulo" class="text-base font-semibold text-amber-950 dark:text-amber-100">{{ pregunta(r) }}</h2>
               <p class="mt-1 text-sm leading-relaxed text-amber-900 dark:text-amber-200">{{ explicacion(r) }}</p>
            </div>
         </div>
         <div class="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            <a routerLink="/configuracion" [queryParams]="{ 'cambio-horario': 1 }"
               class="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-purple px-5 text-sm font-semibold text-white transition-[background-color,transform] duration-150 ease-out hover:bg-purple-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-purple-500/30">
               {{ r.atrasado ? 'Sí, cambió' : 'Sí, cambia' }}
            </a>
            <button type="button" (click)="sinCambio(r.ano)" [disabled]="trabajando()"
               class="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-sm font-semibold text-amber-950 transition-[background-color,transform] duration-150 ease-out hover:bg-amber-100 active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/30 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-100 dark:hover:bg-slate-800">
               No, sigue igual
            </button>
            <button type="button" (click)="masTarde()"
               class="inline-flex min-h-11 items-center justify-center rounded-xl px-3 text-sm font-medium text-amber-900 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-500/30 dark:text-amber-200">
               Más tarde
            </button>
         </div>
      </section>
   }
   `,
})
export class AvisoCambioHorarioComponent implements OnInit {
   private svc = inject(HorariosReunionService);
   private toast = inject(ToastService);

   readonly pregunta = preguntaRecordatorio;
   readonly explicacion = explicacionRecordatorio;

   recordatorio = signal<RecordatorioHorario | null>(null);
   trabajando = signal(false);

   ngOnInit(): void {
      if (this.leerMasTarde()) return;
      // Sin permiso o sin congregación (403/404) simplemente no se muestra.
      this.svc.resumen().subscribe({
         next: (r) => this.recordatorio.set(r.recordatorio),
         error: () => {},
      });
   }

   sinCambio(ano: number): void {
      this.trabajando.set(true);
      this.svc.sinCambio(ano).subscribe({
         next: () => {
            this.recordatorio.set(null);
            this.toast.success('Anotado', `El horario de reuniones sigue igual en ${ano}. No se lo volveremos a preguntar este año.`);
         },
         error: () => {
            this.trabajando.set(false);
            this.toast.error('No se pudo guardar la respuesta', 'Inténtelo otra vez.');
         },
      });
   }

   masTarde(): void {
      this.recordatorio.set(null);
      try { sessionStorage.setItem(CLAVE_MAS_TARDE, '1'); } catch { /* sin almacenamiento: solo se oculta ahora */ }
   }

   private leerMasTarde(): boolean {
      try { return sessionStorage.getItem(CLAVE_MAS_TARDE) === '1'; } catch { return false; }
   }
}
