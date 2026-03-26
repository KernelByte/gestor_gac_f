import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-reuniones-resumen',
  imports: [CommonModule],
  template: `
    <div class="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-sm border border-slate-200/60 dark:border-slate-700/60 h-full flex items-center justify-center animate-fadeIn">
      <div class="text-center max-w-md">
        <div class="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
          <svg class="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
        </div>
        <h3 class="text-2xl font-black text-slate-900 dark:text-white mb-2">Resumen de Reunión Hoy</h3>
        <p class="text-slate-500 mb-6">Visualiza un resumen completo de la reunión programada para hoy, incluyendo participantes y materiales.</p>
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-700 text-sm font-bold border border-amber-200">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Próximamente disponible
        </div>
      </div>
    </div>
  `,
  styles: [`
    .animate-fadeIn {
      animation: fadeIn 0.3s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class ReunionesResumenComponent {}
