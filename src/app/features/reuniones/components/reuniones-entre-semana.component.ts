import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-reuniones-entre-semana',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fadeIn space-y-8 pb-10">
       
       <!-- Header Section -->
       <div class="flex items-start justify-between bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
           <!-- Decorative Background Elements -->
           <div class="absolute -right-20 -top-20 w-64 h-64 bg-brand-purple rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
           <div class="absolute right-20 -bottom-20 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
           
           <div class="relative z-10 w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
               <div>
                   <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-white border border-white/20 text-xs font-bold mb-3 backdrop-blur-md">
                       <svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                       Borrador Generado
                   </div>
                   <h2 class="text-3xl font-black tracking-tight mb-2">Vida y Ministerio Cristianos</h2>
                   <p class="text-slate-300 font-medium">Programa y asignaciones generadas por IA.</p>
               </div>
               
               <div class="flex flex-col sm:flex-row gap-3">
                    <button class="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold rounded-xl transition-all backdrop-blur-md flex items-center justify-center gap-2" (click)="openConfig()" title="Configuración del Motor">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        Configuración
                    </button>
                    <button class="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold rounded-xl transition-all backdrop-blur-md flex items-center justify-center gap-2">
                       <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                       Generar Mes
                   </button>
                   <button class="px-6 py-3 bg-brand-purple text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:bg-purple-500 transition-all flex items-center justify-center gap-2 group">
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
                  [class.bg-brand-purple]="selectedWeekIdx() === i"
                  [class.text-white]="selectedWeekIdx() === i"
                  [class.border-brand-purple]="selectedWeekIdx() === i"
                  [class.bg-white]="selectedWeekIdx() !== i"
                  [class.text-slate-500]="selectedWeekIdx() !== i"
                  [class.border-slate-200]="selectedWeekIdx() !== i"
                  class="shrink-0 px-6 py-3 rounded-2xl border font-bold text-sm shadow-sm transition-all hover:border-brand-purple/50 snap-start">
              <span class="block text-[10px] uppercase tracking-wider mb-0.5 opacity-80">Semana {{week + 40}}</span>
              {{ i * 7 + 2 }} - {{ i * 7 + 8 }} Oct
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
                           <h4 class="font-bold text-slate-800 dark:text-slate-100">Canto 14 y Oración</h4>
                       </div>
                   </div>
                   <!-- Assignee -->
                   <div class="col-span-12 md:col-span-7">
                       <div class="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50 hover:border-brand-purple transition-colors cursor-pointer group">
                           <div class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900 dark:to-purple-900 flex items-center justify-center text-brand-purple font-black shadow-sm shrink-0">
                               JD
                           </div>
                           <div class="flex-1 min-w-0">
                               <p class="font-bold text-slate-800 dark:text-slate-100 truncate">Juan Diego Pérez</p>
                               <p class="text-xs text-slate-500">Publicador (Score: 0.92)</p>
                           </div>
                           <div class="shrink-0 mr-2 text-slate-300 group-hover:text-brand-purple transition-colors">
                               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 20 8 16"/><line x1="12" y1="12" x2="12" y2="20"/><polyline points="8 8 12 4 16 8"/><line x1="12" y1="12" x2="12" y2="4"/></svg>
                           </div>
                       </div>
                   </div>
               </div>
           </div>

           <!-- Seccion: Tesoros -->
           <div class="p-6 border-b border-slate-100 dark:border-slate-700/50">
               <h3 class="font-black text-slate-800 tracking-tight text-lg mb-4 flex items-center gap-2">
                  <div class="w-2 h-6 rounded-full bg-slate-800"></div>
                  TESOROS DE LA BIBLIA
               </h3>
               
               <div class="space-y-4">
                   <!-- Discurso -->
                   <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                       <div class="col-span-12 md:col-span-5 flex gap-4">
                           <div class="flex flex-col items-center justify-center shrink-0 w-12 pt-1">
                               <span class="text-sm font-black text-slate-800">10m</span>
                           </div>
                           <div>
                               <h4 class="font-bold text-slate-800 dark:text-slate-100">"El amor no es envidioso"</h4>
                               <p class="text-xs text-slate-500 mt-1 line-clamp-1">Discurso basado en 1 Corintios 13</p>
                           </div>
                       </div>
                       <!-- Assignee -->
                       <div class="col-span-12 md:col-span-7">
                           <div class="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 bg-white hover:border-brand-purple transition-colors cursor-pointer group shadow-sm">
                               <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black shrink-0">
                                   CA
                               </div>
                               <div class="flex-1 min-w-0">
                                   <div class="flex items-center gap-2">
                                       <p class="font-bold text-slate-800 truncate">Carlos Andino</p>
                                       <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">Anciano</span>
                                   </div>
                               </div>
                               <div class="shrink-0 mr-2 text-slate-300 group-hover:text-brand-purple transition-colors">
                                   <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 20 8 16"/><line x1="12" y1="12" x2="12" y2="20"/><polyline points="8 8 12 4 16 8"/><line x1="12" y1="12" x2="12" y2="4"/></svg>
                               </div>
                           </div>
                       </div>
                   </div>

                   <!-- Perlas -->
                   <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                       <div class="col-span-12 md:col-span-5 flex gap-4">
                           <div class="flex flex-col items-center justify-center shrink-0 w-12 pt-1">
                               <span class="text-sm font-black text-slate-800">10m</span>
                           </div>
                           <div>
                               <h4 class="font-bold text-slate-800">Busquemos perlas escondidas</h4>
                           </div>
                       </div>
                       <!-- Assignee -->
                       <div class="col-span-12 md:col-span-7">
                           <div class="flex items-center gap-4 p-3 rounded-2xl border border-slate-200 bg-white hover:border-brand-purple transition-colors cursor-pointer group shadow-sm">
                               <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black shrink-0">
                                   RA
                               </div>
                               <div class="flex-1 min-w-0">
                                   <div class="flex items-center gap-2">
                                       <p class="font-bold text-slate-800 truncate">Roberto Alonzo</p>
                                       <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">S. Ministerial</span>
                                   </div>
                               </div>
                               <div class="shrink-0 mr-2 text-slate-300 group-hover:text-brand-purple transition-colors">
                                   <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 20 8 16"/><line x1="12" y1="12" x2="12" y2="20"/><polyline points="8 8 12 4 16 8"/><line x1="12" y1="12" x2="12" y2="4"/></svg>
                               </div>
                           </div>
                       </div>
                   </div>
               </div>
           </div>

           <!-- Seccion: Mejores Maestros -->
           <div class="p-6 border-b border-slate-100 dark:border-slate-700/50 bg-amber-50/30">
               <h3 class="font-black text-amber-700 tracking-tight text-lg mb-4 flex items-center gap-2">
                  <div class="w-2 h-6 rounded-full bg-amber-500"></div>
                  SEAMOS MEJORES MAESTROS
               </h3>
               
               <div class="space-y-4">
                   <!-- Asignacion Estudiantil con Ayudante -->
                   <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                       <div class="col-span-12 md:col-span-5 flex gap-4">
                           <div class="flex flex-col items-center justify-center shrink-0 w-12 pt-1">
                               <span class="text-sm font-black text-amber-700">4m</span>
                           </div>
                           <div>
                               <h4 class="font-bold text-slate-800">Primera Conversación</h4>
                               <div class="flex items-center gap-2 mt-1">
                                    <span class="px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-bold">Sala Principal</span>
                               </div>
                           </div>
                       </div>
                       <!-- Assignee Double -->
                       <div class="col-span-12 md:col-span-7">
                           <div class="flex items-center gap-0 p-1.5 rounded-2xl border border-slate-200 bg-white hover:border-brand-purple transition-colors cursor-pointer group shadow-sm">
                               <!-- Titular -->
                               <div class="flex items-center gap-3 p-2 flex-1 relative z-10">
                                   <div class="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-black shrink-0 text-sm">
                                       MJ
                                   </div>
                                   <div class="flex-1 min-w-0">
                                       <p class="font-bold text-slate-800 text-sm truncate">María Jiménez</p>
                                       <p class="text-[10px] text-slate-500">Titular</p>
                                   </div>
                               </div>
                               <!-- Connector -->
                               <div class="shrink-0 text-slate-300">
                                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                               </div>
                               <!-- Ayudante -->
                               <div class="flex items-center gap-3 p-2 flex-1 bg-slate-50/50 rounded-r-xl">
                                   <div class="w-9 h-9 border border-slate-200 rounded-full bg-white flex items-center justify-center text-slate-500 font-bold shrink-0 text-sm">
                                       SC
                                   </div>
                                   <div class="flex-1 min-w-0">
                                       <p class="font-bold text-slate-700 text-sm truncate">Sara Cruz</p>
                                       <p class="text-[10px] text-slate-500">Ayudante</p>
                                   </div>
                               </div>
                               
                               <div class="shrink-0 px-3 text-slate-300 group-hover:text-brand-purple transition-colors">
                                   <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 20 8 16"/><line x1="12" y1="12" x2="12" y2="20"/><polyline points="8 8 12 4 16 8"/><line x1="12" y1="12" x2="12" y2="4"/></svg>
                               </div>
                           </div>
                       </div>
                   </div>
               </div>
           </div>

           <!-- Seccion: Vida Cristiana -->
           <div class="p-6 bg-red-50/30">
               <h3 class="font-black text-red-700 tracking-tight text-lg mb-4 flex items-center gap-2">
                  <div class="w-2 h-6 rounded-full bg-red-500"></div>
                  NUESTRA VIDA CRISTIANA
               </h3>
               
               <div class="space-y-4">
                   <!-- Canto -->
                   <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                       <div class="col-span-12 md:col-span-5 flex items-center gap-4">
                           <div class="w-12 h-12 rounded-xl bg-transparent flex items-center justify-center shrink-0">
                               <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                           </div>
                           <div>
                               <div class="text-xs font-bold text-slate-400 mb-1">5 min</div>
                               <h4 class="font-bold text-slate-800">Canto 74</h4>
                           </div>
                       </div>
                       <!-- Assignee is Empty for songs usually, but let's put empty -->
                       <div class="col-span-12 md:col-span-7">
                           <div class="text-sm font-bold text-slate-400 italic px-4">Congregación</div>
                       </div>
                   </div>

                   <!-- Estudio Congregacion -->
                   <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                       <div class="col-span-12 md:col-span-5 flex gap-4">
                           <div class="flex flex-col items-center justify-center shrink-0 w-12 pt-1">
                               <span class="text-sm font-black text-red-700">30m</span>
                           </div>
                           <div>
                               <h4 class="font-bold text-slate-800">Estudio Bíblico de la Congregación</h4>
                               <p class="text-xs text-slate-500 mt-1 line-clamp-1">lff lección 54</p>
                           </div>
                       </div>
                       <!-- Assignee Double (Speaker + Reader) -->
                       <div class="col-span-12 md:col-span-7">
                           <div class="flex items-center gap-0 p-1.5 rounded-2xl border border-slate-200 bg-white hover:border-brand-purple transition-colors cursor-pointer group shadow-sm">
                               <!-- Conductor -->
                               <div class="flex items-center gap-3 p-2 flex-1 relative z-10">
                                   <div class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black shrink-0 text-sm">
                                       AL
                                   </div>
                                   <div class="flex-1 min-w-0">
                                       <p class="font-bold text-slate-800 text-sm truncate">Arturo Linares</p>
                                       <p class="text-[10px] text-slate-500 font-bold">Conductor (Anciano)</p>
                                   </div>
                               </div>
                               <!-- Connector -->
                               <div class="shrink-0 text-slate-300">
                                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h20"/><path d="M12 2v20"/></svg>
                               </div>
                               <!-- Lector -->
                               <div class="flex items-center gap-3 p-2 flex-1 bg-slate-50/50 rounded-r-xl">
                                   <div class="w-9 h-9 border border-slate-200 rounded-full bg-white flex items-center justify-center text-slate-500 font-bold shrink-0 text-sm">
                                       DA
                                   </div>
                                   <div class="flex-1 min-w-0">
                                       <p class="font-bold text-slate-700 text-sm truncate">David Alfaro</p>
                                       <p class="text-[10px] text-slate-500 font-bold">Lector (S. Ministerial)</p>
                                   </div>
                               </div>
                               
                               <div class="shrink-0 px-3 text-slate-300 group-hover:text-brand-purple transition-colors">
                                   <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 16 12 20 8 16"/><line x1="12" y1="12" x2="12" y2="20"/><polyline points="8 8 12 4 16 8"/><line x1="12" y1="12" x2="12" y2="4"/></svg>
                               </div>
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
export class ReunionesEntreSemanaComponent {
  private router = inject(Router);
  selectedWeekIdx = signal(0);

  openConfig() {
    this.router.navigate(['/reuniones/configuracion']);
  }
}

