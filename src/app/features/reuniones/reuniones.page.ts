import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
   standalone: true,
   selector: 'app-reuniones',
   imports: [CommonModule, FormsModule],
   template: `
    <div class="flex flex-col gap-6">

      <!-- Header -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 class="font-display font-black text-3xl text-slate-900 tracking-tight">Seguimiento de Asistencia</h1>
           <p class="text-slate-500 font-medium">Registro Semanal y Anual Integrado</p>
        </div>
        <div class="flex gap-3">
           <button class="inline-flex items-center gap-2 px-5 h-12 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95">
              <svg class="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
              Imprimir Informe
           </button>
           <button class="inline-flex items-center gap-2 px-6 h-12 bg-brand-purple hover:bg-purple-800 text-white rounded-xl font-display font-bold text-sm shadow-xl shadow-purple-900/20 transition-all active:scale-95">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Guardar Cambios
           </button>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        <!-- Left Column: Main Entry (2/3 width) -->
        <div class="xl:col-span-2 flex flex-col gap-6">
           
           <!-- Weekly Entry Card -->
           <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
              
              <!-- Card Header / Tabs -->
              <div class="flex flex-col md:flex-row items-center justify-between gap-6 mb-8 border-b border-slate-100 pb-6">
                 <div class="flex items-center gap-3">
                    <div class="p-2.5 rounded-xl bg-purple-50 text-brand-purple">
                       <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    </div>
                    <div>
                        <h2 class="text-sm font-bold text-slate-400 uppercase tracking-wider">Octubre 2023</h2>
                        <p class="text-xl font-black text-slate-900 leading-none">Registro de Asistencia</p>
                    </div>
                 </div>

                 <!-- Week Selector Tabs -->
                 <div class="flex bg-slate-50 p-1 rounded-xl">
                    <button 
                      *ngFor="let week of [1,2,3,4,5]"
                      (click)="selectedWeek.set(week)"
                      class="px-4 py-2 rounded-lg text-xs font-bold transition-all relative"
                      [ngClass]="{
                        'bg-white text-brand-purple shadow-sm': selectedWeek() === week,
                        'text-slate-500 hover:text-slate-700 hover:bg-slate-100': selectedWeek() !== week
                      }"
                    >
                       Semana<br><span class="text-base">{{ week }}</span>
                    </button>
                 </div>
              </div>

              <!-- Input Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-8 md:divide-x md:divide-slate-100">
                 
                 <!-- Midweek Meeting -->
                 <div class="md:pr-4">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                           <svg class="w-5 h-5 text-brand-purple" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                           <h3 class="font-bold text-slate-800">Entre Semana</h3>
                        </div>
                        <span class="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100">Jueves, 12 Oct</span>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                       <div class="space-y-2 group">
                          <label class="text-xs font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-brand-purple transition-colors">Presencial</label>
                          <div class="relative">
                             <input 
                                type="number" 
                                [(ngModel)]="midweekData.present" 
                                class="w-full h-20 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-4xl font-black text-slate-800 focus:bg-white focus:border-brand-purple focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                             >
                          </div>
                       </div>
                       <div class="space-y-2 group">
                          <label class="text-xs font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-blue-500 transition-colors">Zoom</label>
                          <div class="relative">
                             <input 
                                type="number" 
                                [(ngModel)]="midweekData.zoom" 
                                class="w-full h-20 bg-blue-50/30 border-2 border-blue-50 rounded-2xl text-center text-4xl font-black text-blue-600 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                             >
                          </div>
                       </div>
                    </div>
                    
                    <!-- Total Row -->
                    <div class="mt-6 flex items-center justify-between p-4 bg-purple-50/50 rounded-2xl border border-purple-100">
                        <span class="font-bold text-slate-500">Total</span>
                        <span class="text-2xl font-black text-brand-purple">{{ midweekTotal() }}</span>
                    </div>
                 </div>

                 <!-- Weekend Meeting -->
                 <div class="md:pl-4">
                    <div class="flex items-center justify-between mb-4">
                        <div class="flex items-center gap-2">
                           <svg class="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                           <h3 class="font-bold text-slate-800">Fin de Semana</h3>
                        </div>
                        <span class="px-2.5 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-bold border border-orange-100 text-center leading-tight">Domingo, 15<br>Oct</span>
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2 group">
                           <label class="text-xs font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-brand-purple transition-colors">Presencial</label>
                           <div class="relative">
                              <input 
                                 type="number" 
                                 [(ngModel)]="weekendData.present" 
                                 class="w-full h-20 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-4xl font-black text-slate-800 focus:bg-white focus:border-brand-purple focus:ring-4 focus:ring-purple-100 transition-all outline-none"
                              >
                           </div>
                        </div>
                        <div class="space-y-2 group">
                           <label class="text-xs font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-blue-500 transition-colors">Zoom</label>
                           <div class="relative">
                              <input 
                                 type="number" 
                                 [(ngModel)]="weekendData.zoom" 
                                 class="w-full h-20 bg-blue-50/30 border-2 border-blue-50 rounded-2xl text-center text-4xl font-black text-blue-600 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                              >
                           </div>
                        </div>
                     </div>

                    <!-- Total Row -->
                    <div class="mt-6 flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span class="font-bold text-slate-500">Total</span>
                        <span class="text-2xl font-black text-slate-400">{{ weekendTotal() }}</span>
                    </div>
                 </div>

              </div>
           </div>

           <!-- Annual Summary Table -->
           <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
               <div class="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div class="flex items-center gap-3">
                      <div class="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                         <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                      </div>
                      <h3 class="font-bold text-slate-800 text-lg">Resumen Anual (Año de Servicio 2024)</h3>
                  </div>
                  <div class="flex text-xs font-bold gap-2">
                     <span class="text-slate-400">Entre Semana</span>
                     <span class="text-brand-purple bg-purple-50 px-2 py-0.5 rounded-md">Fin de Semana</span>
                  </div>
               </div>
               
               <table class="w-full">
                  <thead class="bg-slate-50 border-b border-slate-100">
                     <tr>
                        <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Mes</th>
                        <th class="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Nº Reuniones</th>
                        <th class="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Asistencia Total</th>
                        <th class="px-6 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Promedio Semanal</th>
                     </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50">
                     <tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-6 py-4 font-bold text-slate-700">Septiembre</td>
                        <td class="px-6 py-4 text-center text-slate-500 font-medium">4</td>
                        <td class="px-6 py-4 text-center text-slate-500 font-medium">380</td>
                        <td class="px-6 py-4 text-right font-bold text-slate-900">95</td>
                     </tr>
                     <tr class="bg-purple-50/30 hover:bg-purple-50 transition-colors">
                        <td class="px-6 py-4 font-bold text-brand-purple">Octubre (Actual)</td>
                        <td class="px-6 py-4 text-center text-slate-500 font-medium">2</td>
                        <td class="px-6 py-4 text-center text-slate-500 font-medium">192</td>
                        <td class="px-6 py-4 text-right font-bold text-brand-purple">96</td>
                     </tr>
                     <tr class="text-slate-300">
                        <td class="px-6 py-4 font-medium">Noviembre</td>
                        <td class="px-6 py-4 text-center">-</td>
                        <td class="px-6 py-4 text-center">-</td>
                        <td class="px-6 py-4 text-right">-</td>
                     </tr>
                  </tbody>
               </table>
           </div>

        </div>

        <!-- Right Column: Sidebar Widgets -->
        <div class="flex flex-col gap-6">
           
           <!-- Calendar Widget -->
           <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
               <div class="flex items-center justify-between mb-6">
                   <button class="p-1 hover:bg-slate-100 rounded-full text-slate-400"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button>
                   <h3 class="font-bold text-slate-800">Octubre 2023</h3>
                   <button class="p-1 hover:bg-slate-100 rounded-full text-slate-400"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button>
               </div>
               
               <!-- Simplified Calendar Grid Mockup -->
               <div class="grid grid-cols-7 text-center gap-y-4 text-xs">
                  <span class="text-slate-400 font-bold">D</span>
                  <span class="text-slate-400 font-bold">L</span>
                  <span class="text-slate-400 font-bold">M</span>
                  <span class="text-slate-400 font-bold">M</span>
                  <span class="text-slate-400 font-bold">J</span>
                  <span class="text-slate-400 font-bold">V</span>
                  <span class="text-slate-400 font-bold">S</span>

                  <span class="text-slate-300"></span><span class="text-slate-300"></span><span class="text-slate-300"></span><span class="text-slate-300"></span><span class="text-slate-300"></span>
                  <span class="text-slate-500 font-medium">1</span><span class="text-slate-500 font-medium">2</span>
                  
                  <span class="text-slate-500 font-medium">3</span><span class="text-slate-500 font-medium">4</span>
                  <span class="w-7 h-7 flex items-center justify-center rounded-full bg-purple-100 text-brand-purple font-bold mx-auto">5</span>
                  <span class="text-slate-500 font-medium">6</span><span class="text-slate-500 font-medium">7</span><span class="text-slate-500 font-medium">8</span><span class="text-slate-500 font-medium">9</span>

                  <span class="text-slate-500 font-medium">10</span><span class="text-slate-500 font-medium">11</span>
                  <span class="w-7 h-7 flex items-center justify-center rounded-full bg-brand-purple text-white font-bold mx-auto shadow-lg shadow-purple-500/30">12</span>
                  <span class="text-slate-500 font-medium">13</span><span class="text-slate-500 font-medium">14</span><span class="w-7 h-7 flex items-center justify-center rounded-full bg-orange-100 text-orange-600 font-bold mx-auto">15</span><span class="text-slate-500 font-medium">16</span>
               </div>
           </div>

           <!-- Averages Widget -->
           <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
               <div class="flex items-center gap-3 mb-6">
                   <div class="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                       <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>
                   </div>
                   <h3 class="font-bold text-slate-800 leading-tight">Promedios Mes<br>Actual</h3>
               </div>

               <div class="space-y-4">
                  <!-- Midweek Avg -->
                  <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div class="p-2.5 bg-blue-100 text-blue-600 rounded-lg">
                         <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                      </div>
                      <div>
                         <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Entre Semana</p>
                         <div class="flex items-baseline gap-2">
                            <span class="text-2xl font-black text-slate-800">96</span>
                            <span class="text-xs font-bold text-emerald-500">+1.5% vs Sep</span>
                         </div>
                      </div>
                  </div>
                  
                  <!-- Weekend Avg -->
                  <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                     <div class="p-2.5 bg-orange-100 text-orange-600 rounded-lg">
                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                     </div>
                     <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Fin de Semana</p>
                        <div class="flex items-baseline gap-2">
                           <span class="text-2xl font-black text-slate-800">--</span>
                           <span class="text-xs font-bold text-slate-400">Sin datos</span>
                        </div>
                     </div>
                 </div>
               </div>
           </div>

           <!-- Info Tip -->
           <div class="bg-orange-50 rounded-2xl p-5 border border-orange-100 flex gap-4">
              <div class="shrink-0">
                 <svg class="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
              </div>
              <p class="text-xs font-medium text-orange-800 leading-relaxed">
                 Recuerde contar niños y dispositivos Zoom multiplicados por espectadores para un registro exacto.
              </p>
           </div>

        </div>

      </div>
    </div>
  `,
   styles: [`:host { display: block; }`]
})
export class ReunionesPageComponent {
   selectedWeek = signal(2);

   midweekData = {
      present: 82,
      zoom: 14
   };

   weekendData = {
      present: 0,
      zoom: 0
   };

   midweekTotal = computed(() => (this.midweekData.present || 0) + (this.midweekData.zoom || 0));
   weekendTotal = computed(() => (this.weekendData.present || 0) + (this.weekendData.zoom || 0));

}
