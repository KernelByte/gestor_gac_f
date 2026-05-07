import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReunionesProgramacionComponent } from './reuniones-entre-semana.component';
import { ReunionesLogisticaComponent } from './reuniones-logistica.component';

type Tab = 'programacion' | 'logistica';

@Component({
  selector: 'app-programacion-wrapper',
  standalone: true,
  imports: [CommonModule, ReunionesProgramacionComponent, ReunionesLogisticaComponent],
  template: `
    <div class="flex flex-col h-full gap-0 overflow-hidden">

      <!-- ===== SELECTOR DE PESTAÑAS ===== -->
      <div class="shrink-0 flex items-center pb-3">
        <div class="inline-flex items-center gap-1 bg-white dark:bg-[#1a1b26] rounded-2xl p-1.5 shadow-sm border border-slate-200/60 dark:border-slate-800">
          <!-- Programación -->
          <button
            (click)="tabActivo.set('programacion')"
            class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] whitespace-nowrap"
            [class]="tabActivo() === 'programacion'
              ? 'bg-[#6D28D9] text-white shadow-md shadow-purple-500/20'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'">
            <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
            </svg>
            Programación
          </button>

          <!-- Logística -->
          <button
            (click)="tabActivo.set('logistica')"
            class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold transition-[background-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] whitespace-nowrap"
            [class]="tabActivo() === 'logistica'
              ? 'bg-[#6D28D9] text-white shadow-md shadow-purple-500/20'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/80'">
            <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
            </svg>
            Logística
          </button>
        </div>
      </div>

      <!-- ===== CONTENIDO ===== -->
      <div class="flex-1 min-h-0 overflow-hidden">
        @if (tabActivo() === 'programacion') {
          <app-reuniones-programacion class="block h-full" />
        }
        @if (tabActivo() === 'logistica') {
          <app-reuniones-logistica class="block h-full" />
        }
      </div>

    </div>
  `,
})
export class ProgramacionWrapperComponent {
  tabActivo = signal<Tab>('programacion');
}
