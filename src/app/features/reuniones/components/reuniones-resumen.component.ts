import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-reuniones-resumen',
  imports: [CommonModule],
  template: `
    <div class="h-full flex items-center justify-center p-6 animate-fadeIn">
      <div class="text-center max-w-sm">
        <h3 class="text-3xl font-black text-slate-900 dark:text-white mb-4 tracking-tight">Resumen de Reunión</h3>
        <p class="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">Visualiza un resumen completo de la reunión programada para hoy, incluyendo participantes y materiales.</p>
        <div class="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-sm font-black border border-amber-200/50 dark:border-amber-800/50 shadow-sm">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Próximamente disponible
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .animate-fadeIn {
      animation: fadeIn 0.4s cubic-bezier(0.23, 1, 0.32, 1) forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class ReunionesResumenComponent {}
