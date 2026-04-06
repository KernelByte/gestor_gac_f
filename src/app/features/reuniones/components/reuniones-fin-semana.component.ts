import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthStore } from '../../../core/auth/auth.store';

@Component({
  selector: 'app-reuniones-fin-semana',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fadeIn space-y-8 pb-10">
       
       <!-- Header Section -->
       <div class="flex items-start justify-between bg-gradient-to-r from-orange-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl shadow-orange-900/20 relative overflow-hidden">
           <!-- Decorative Background Elements -->
           <div class="absolute -right-20 -top-20 w-64 h-64 bg-orange-600 rounded-full mix-blend-multiply filter blur-3xl opacity-40 animate-blob"></div>
           <div class="absolute right-20 -bottom-20 w-64 h-64 bg-red-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
           
           <div class="relative z-10 w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
               <div>
                   <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white border border-white/20 text-xs font-bold mb-3 backdrop-blur-md">
                       <svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                       Borrador Generado
                   </div>
                   <h2 class="text-3xl font-black tracking-tight mb-2">Reunión Pública y Estudio de La Atalaya</h2>
                   <p class="text-orange-100 font-medium">Programa y asignaciones generadas por IA.</p>
               </div>
               
               <div class="flex flex-col sm:flex-row gap-3">
                   <button class="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold rounded-xl transition-all backdrop-blur-md flex items-center justify-center gap-2" (click)="openConfig()" title="Configuración del Motor">
                       <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                       Configuración
                   </button>
                   <button *ngIf="hasEditPermission()" class="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold rounded-xl transition-all backdrop-blur-md flex items-center justify-center gap-2">
                       <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                       Generar Mes
                   </button>
                   <button *ngIf="hasEditPermission()" class="px-6 py-3 bg-orange-500 text-white font-bold rounded-xl shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all flex items-center justify-center gap-2 group">
                       Confirmar Asignaciones
                       <svg class="w-4 h-4 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                   </button>
               </div>
           </div>
       </div>

       <!-- Week Selector Navigator -->
       <div class="flex items-center gap-3 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
          <button *ngFor="let week of [1,2,3,4,5]; let i = index" 
                  (click)="selectedWeekIdx.set(i)"
                  [class.bg-orange-500]="selectedWeekIdx() === i"
                  [class.text-white]="selectedWeekIdx() === i"
                  [class.border-orange-500]="selectedWeekIdx() === i"
                  [class.bg-white]="selectedWeekIdx() !== i"
                  [class.text-slate-500]="selectedWeekIdx() !== i"
                  [class.border-slate-200]="selectedWeekIdx() !== i"
                  class="shrink-0 px-6 py-3 rounded-2xl border font-bold text-sm shadow-sm transition-all hover:border-orange-500/50 snap-start">
              <span class="block text-[0.625rem] uppercase tracking-wider mb-0.5 opacity-80">Semana {{week + 40}}</span>
              {{ i * 7 + 3 }} - {{ i * 7 + 9 }} Oct
          </button>
       </div>

       <!-- Schedule Card (Main Meeting Grid) -->
       <div class="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
           
           <!-- Seccion: Introducción -->
           <div class="p-6 border-b border-slate-100 dark:border-slate-700/50">
               <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                   <!-- Canto y Oracion -->
                   <div class="col-span-12 md:col-span-5 flex items-center gap-4">
                       <div class="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center shrink-0">
                           <svg class="w-6 h-6 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                       </div>
                       <div>
                           <div class="text-xs font-bold text-slate-400 mb-1">5 min</div>
                           <h4 class="font-bold text-slate-800 dark:text-slate-100">Canto 114 y Oración</h4>
                       </div>
                   </div>
                   <!-- Assignee -->
                   <div class="col-span-12 md:col-span-7">
                       <div class="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 hover:border-orange-500 transition-colors cursor-pointer group">
                           <div class="w-10 h-10 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900 dark:to-orange-800 flex items-center justify-center text-orange-600 font-black shadow-sm shrink-0">
                               PR
                           </div>
                           <div class="flex-1 min-w-0">
                               <p class="font-bold text-slate-800 dark:text-slate-100 truncate">Pedro Ramírez</p>
                               <p class="text-xs text-slate-500">Presidente (Score: 0.88)</p>
                           </div>
                           <div class="shrink-0 mr-2 text-slate-300 group-hover:text-orange-500 transition-colors">
                               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 20 8 16"/><line x1="12" y1="12" x2="12" y2="20"/><polyline points="8 8 12 4 16 8"/><line x1="12" y1="12" x2="12" y2="4"/></svg>
                           </div>
                       </div>
                   </div>
               </div>
           </div>

           <!-- Seccion: Discurso Público -->
           <div class="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-blue-50/30">
               <h3 class="font-black text-blue-800 tracking-tight text-lg mb-4 flex items-center gap-2">
                  <div class="w-2 h-6 rounded-full bg-blue-600"></div>
                  DISCURSO PÚBLICO
               </h3>
               
               <div class="space-y-4">
                   <!-- Discurso -->
                   <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                       <div class="col-span-12 md:col-span-5 flex gap-4">
                           <div class="flex flex-col items-center justify-center shrink-0 w-12 pt-1">
                               <span class="text-sm font-black text-blue-700">30m</span>
                           </div>
                           <div>
                               <h4 class="font-bold text-slate-800 dark:text-slate-100">"¿Está usted preparado para el día de Jehová?"</h4>
                               <p class="text-xs text-slate-500 mt-1 line-clamp-1">Bosquejo Núm. 14</p>
                           </div>
                       </div>
                       <!-- Assignee -->
                       <div class="col-span-12 md:col-span-7">
                           <div class="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 bg-white hover:border-orange-500 transition-colors cursor-pointer group shadow-sm">
                               <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black shrink-0">
                                   MH
                               </div>
                               <div class="flex-1 min-w-0">
                                   <div class="flex items-center gap-2">
                                       <p class="font-bold text-slate-800 truncate text-sm">Mario Hernández</p>
                                       <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[0.625rem] font-bold">Orador Invitado</span>
                                   </div>
                                   <p class="text-[0.625rem] text-slate-500 mt-0.5">Congregación Las Colinas</p>
                               </div>
                               <div class="shrink-0 mr-2 text-slate-300 group-hover:text-orange-500 transition-colors">
                                   <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 20 8 16"/><line x1="12" y1="12" x2="12" y2="20"/><polyline points="8 8 12 4 16 8"/><line x1="12" y1="12" x2="12" y2="4"/></svg>
                               </div>
                           </div>
                       </div>
                   </div>
               </div>
           </div>
           
           <!-- Seccion: Transición -->
           <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50">
               <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                   <!-- Canto Intermedio -->
                   <div class="col-span-12 md:col-span-5 flex items-center gap-4">
                       <div class="w-12 h-12 rounded-xl bg-transparent flex items-center justify-center shrink-0">
                           <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                       </div>
                       <div>
                           <div class="text-xs font-bold text-slate-400 mb-1">5 min</div>
                           <h4 class="font-bold text-slate-800">Canto 22</h4>
                       </div>
                   </div>
                   <!-- Assignee Empty -->
                   <div class="col-span-12 md:col-span-7">
                       <div class="text-sm font-bold text-slate-400 italic px-4">Congregación</div>
                   </div>
               </div>
           </div>

           <!-- Seccion: Estudio Atalaya -->
           <div class="p-6 bg-emerald-50/30 border-b border-slate-100">
               <h3 class="font-black text-emerald-800 tracking-tight text-lg mb-4 flex items-center gap-2">
                  <div class="w-2 h-6 rounded-full bg-emerald-500"></div>
                  ESTUDIO DE LA ATALAYA
               </h3>
               
               <div class="space-y-4">
                   <!-- Estudio Atalaya -->
                   <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                       <div class="col-span-12 md:col-span-5 flex gap-4">
                           <div class="flex flex-col items-center justify-center shrink-0 w-12 pt-1">
                               <span class="text-sm font-black text-emerald-700">60m</span>
                           </div>
                           <div>
                               <h4 class="font-bold text-slate-800">Estudio de La Atalaya</h4>
                               <p class="text-xs text-slate-500 mt-1 line-clamp-1">Artículo de Estudio 34 (15-21 Oct)</p>
                           </div>
                       </div>
                       <!-- Assignee Double (Conductor + Lector) -->
                       <div class="col-span-12 md:col-span-7">
                           <div class="flex items-center gap-0 p-1.5 rounded-2xl border border-slate-200 bg-white hover:border-orange-500 transition-colors cursor-pointer group shadow-sm">
                               <!-- Conductor -->
                               <div class="flex items-center gap-3 p-2 flex-1 relative z-10">
                                   <div class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black shrink-0 text-sm">
                                       EM
                                   </div>
                                   <div class="flex-1 min-w-0">
                                       <p class="font-bold text-slate-800 text-sm truncate">Eduardo Martínez</p>
                                       <p class="text-[0.625rem] text-slate-500 font-bold">Conductor (Anciano)</p>
                                   </div>
                               </div>
                               <!-- Connector -->
                               <div class="shrink-0 text-slate-300">
                                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h20"/><path d="M12 2v20"/></svg>
                               </div>
                               <!-- Lector -->
                               <div class="flex items-center gap-3 p-2 flex-1 bg-slate-50/50 rounded-r-xl">
                                   <div class="w-9 h-9 border border-slate-200 rounded-full bg-white flex items-center justify-center text-slate-500 font-bold shrink-0 text-sm">
                                       FP
                                   </div>
                                   <div class="flex-1 min-w-0">
                                       <p class="font-bold text-slate-700 text-sm truncate">Fernando Ponce</p>
                                       <p class="text-[0.625rem] text-slate-500 font-bold">Lector (S. Ministerial)</p>
                                   </div>
                               </div>
                               
                               <div class="shrink-0 px-3 text-slate-300 group-hover:text-orange-500 transition-colors">
                                   <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 20 8 16"/><line x1="12" y1="12" x2="12" y2="20"/><polyline points="8 8 12 4 16 8"/><line x1="12" y1="12" x2="12" y2="4"/></svg>
                               </div>
                           </div>
                       </div>
                   </div>
               </div>
           </div>

           <!-- Seccion: Conclusión -->
           <div class="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50">
               <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                   <!-- Canto y Oracion Final -->
                   <div class="col-span-12 md:col-span-5 flex items-center gap-4">
                       <div class="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                           <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                       </div>
                       <div>
                           <div class="text-xs font-bold text-slate-400 mb-1">5 min</div>
                           <h4 class="font-bold text-slate-800">Canto 142 y Oración Final</h4>
                       </div>
                   </div>
                   <!-- Assignee -->
                   <div class="col-span-12 md:col-span-7">
                       <div class="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 bg-white hover:border-orange-500 transition-colors cursor-pointer group shadow-sm">
                           <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black shrink-0">
                               MH
                           </div>
                           <div class="flex-1 min-w-0">
                               <div class="flex items-center gap-2">
                                   <p class="font-bold text-slate-800 truncate text-sm">Mario Hernández</p>
                               </div>
                           </div>
                           <div class="shrink-0 mr-2 text-slate-300 group-hover:text-orange-500 transition-colors">
                               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 20 8 16"/><line x1="12" y1="12" x2="12" y2="20"/><polyline points="8 8 12 4 16 8"/><line x1="12" y1="12" x2="12" y2="4"/></svg>
                           </div>
                       </div>
                   </div>
               </div>
           </div>


       </div>
    </div>
  `,
  styles: [`
     .animate-fadeIn {
       animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
     }
     .animate-blob {
       animation: blob 7s infinite;
     }
     .animation-delay-2000 {
       animation-delay: 2s;
     }
     @keyframes blob {
       0% { transform: translate(0px, 0px) scale(1); }
       33% { transform: translate(30px, -50px) scale(1.1); }
       66% { transform: translate(-20px, 20px) scale(0.9); }
       100% { transform: translate(0px, 0px) scale(1); }
     }
  `]
})
export class ReunionesFinSemanaComponent {
  private router = inject(Router);
  private authStore = inject(AuthStore);
  selectedWeekIdx = signal(0);

  hasEditPermission = computed(() => {
    return this.authStore.hasPermission('reuniones.fin_semana_editar') || !!this.authStore.user()?.roles?.includes('Secretario');
  });

  openConfig() {
    this.router.navigate(['/reuniones/configuracion']);
  }
}
