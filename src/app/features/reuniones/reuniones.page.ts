import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type TabType = 'asistencia' | 'asignaciones' | 'resumen';

@Component({
   standalone: true,
   selector: 'app-reuniones',
   imports: [CommonModule, FormsModule],
   template: `
    <div class="flex flex-col gap-6 h-full">

      <!-- Header -->
      <div class="shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
           <h1 class="font-display font-black text-3xl text-slate-900 tracking-tight">Gestión de Reuniones</h1>
           <p class="text-slate-500 font-medium">Administración integral de actividades</p>
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

      <!-- Tabs Navigation -->
      <div class="shrink-0 flex items-center gap-1 bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200/60">
        <button *ngFor="let tab of tabs" 
          (click)="activeTab.set(tab.id)"
          class="flex items-center gap-2.5 px-5 py-3 rounded-xl text-sm font-bold transition-all"
          [ngClass]="activeTab() === tab.id 
            ? 'bg-brand-purple text-white shadow-lg shadow-purple-500/20' 
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'"
        >
          <span [innerHTML]="tab.icon"></span>
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab Content -->
      <div class="flex-1 min-h-0 overflow-auto">

        <!-- ==================== TAB 1: ASISTENCIA ==================== -->
        <ng-container *ngIf="activeTab() === 'asistencia'">
          <div class="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fadeIn">
            
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
                            <p class="text-xl font-black text-slate-900 leading-none">Registro de Asistencia Semanal</p>
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
                              <input type="number" [(ngModel)]="midweekData.present" class="w-full h-20 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-4xl font-black text-slate-800 focus:bg-white focus:border-brand-purple focus:ring-4 focus:ring-purple-100 transition-all outline-none">
                           </div>
                           <div class="space-y-2 group">
                              <label class="text-xs font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-blue-500 transition-colors">Zoom</label>
                              <input type="number" [(ngModel)]="midweekData.zoom" class="w-full h-20 bg-blue-50/30 border-2 border-blue-50 rounded-2xl text-center text-4xl font-black text-blue-600 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none">
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
                               <input type="number" [(ngModel)]="weekendData.present" class="w-full h-20 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center text-4xl font-black text-slate-800 focus:bg-white focus:border-brand-purple focus:ring-4 focus:ring-purple-100 transition-all outline-none">
                            </div>
                            <div class="space-y-2 group">
                               <label class="text-xs font-bold text-slate-400 uppercase tracking-wide group-focus-within:text-blue-500 transition-colors">Zoom</label>
                               <input type="number" [(ngModel)]="weekendData.zoom" class="w-full h-20 bg-blue-50/30 border-2 border-blue-50 rounded-2xl text-center text-4xl font-black text-blue-600 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all outline-none">
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
                      <div class="flex items-center gap-2 text-xs">
                         <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                         <span class="text-slate-500 font-medium">Sept 2023 - Ago 2024</span>
                      </div>
                   </div>
                   
                   <div class="overflow-x-auto">
                     <table class="w-full">
                        <thead class="bg-slate-50 border-b border-slate-100">
                           <tr>
                              <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Mes</th>
                              <th colspan="3" class="px-4 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider border-l border-slate-100">Entre Semana</th>
                              <th colspan="3" class="px-4 py-4 text-center text-xs font-bold text-brand-purple uppercase tracking-wider border-l border-slate-100 bg-purple-50/30">Fin de Semana</th>
                           </tr>
                           <tr class="text-[10px] uppercase tracking-wider">
                              <th class="px-6 py-2"></th>
                              <th class="px-2 py-2 text-center text-slate-400 border-l border-slate-100">Reun.</th>
                              <th class="px-2 py-2 text-center text-slate-400">Total</th>
                              <th class="px-2 py-2 text-center text-slate-700 font-extrabold">Prom.</th>
                              <th class="px-2 py-2 text-center text-slate-400 border-l border-slate-100">Reun.</th>
                              <th class="px-2 py-2 text-center text-slate-400">Total</th>
                              <th class="px-2 py-2 text-center text-brand-purple font-extrabold">Prom.</th>
                           </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                           <tr class="hover:bg-slate-50 transition-colors">
                              <td class="px-6 py-4 font-bold text-slate-700">Septiembre</td>
                              <td class="px-2 py-4 text-center text-slate-500 font-medium border-l border-slate-100">4</td>
                              <td class="px-2 py-4 text-center text-slate-500 font-medium">380</td>
                              <td class="px-2 py-4 text-center font-bold text-slate-900">95</td>
                              <td class="px-2 py-4 text-center text-slate-500 font-medium border-l border-slate-100">5</td>
                              <td class="px-2 py-4 text-center text-slate-500 font-medium">425</td>
                              <td class="px-2 py-4 text-center font-bold text-brand-purple">85</td>
                           </tr>
                           <tr class="bg-purple-50/30 hover:bg-purple-50 transition-colors">
                              <td class="px-6 py-4 font-bold text-brand-purple">Octubre (Actual)</td>
                              <td class="px-2 py-4 text-center text-slate-500 font-medium border-l border-slate-100">2</td>
                              <td class="px-2 py-4 text-center text-slate-500 font-medium">192</td>
                              <td class="px-2 py-4 text-center font-bold text-brand-purple">96</td>
                              <td class="px-2 py-4 text-center text-slate-500 font-medium border-l border-slate-100">-</td>
                              <td class="px-2 py-4 text-center text-slate-500 font-medium">-</td>
                              <td class="px-2 py-4 text-center font-bold text-slate-300">-</td>
                           </tr>
                           <tr class="text-slate-300">
                              <td class="px-6 py-4 font-medium">Noviembre</td>
                              <td class="px-2 py-4 text-center border-l border-slate-100">-</td>
                              <td class="px-2 py-4 text-center">-</td>
                              <td class="px-2 py-4 text-center">-</td>
                              <td class="px-2 py-4 text-center border-l border-slate-100">-</td>
                              <td class="px-2 py-4 text-center">-</td>
                              <td class="px-2 py-4 text-center">-</td>
                           </tr>
                        </tbody>
                     </table>
                   </div>
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
                      <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                          <div class="p-2.5 bg-blue-100 text-blue-600 rounded-lg">
                             <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          </div>
                          <div class="flex-1">
                             <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Entre Semana</p>
                             <div class="flex items-baseline gap-2">
                                <span class="text-2xl font-black text-slate-800">96</span>
                                <span class="text-xs font-bold text-emerald-500">+1.5% vs Sep</span>
                             </div>
                          </div>
                      </div>
                      
                      <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                         <div class="p-2.5 bg-orange-100 text-orange-600 rounded-lg">
                            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                         </div>
                         <div class="flex-1">
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Fin de Semana</p>
                            <div class="flex items-baseline gap-2">
                               <span class="text-2xl font-black text-slate-800">83</span>
                               <span class="text-xs font-bold text-slate-400">parciales</span>
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
                     Recuerde contar niños y dispositivos Zoom multiplicados por espectadores.
                  </p>
               </div>

            </div>

          </div>
        </ng-container>

        <!-- ==================== TAB 2: ASIGNACIONES ==================== -->
        <ng-container *ngIf="activeTab() === 'asignaciones'">
          <div class="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 h-full flex items-center justify-center animate-fadeIn">
            <div class="text-center max-w-md">
              <div class="w-24 h-24 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-purple-500/10">
                <svg class="w-12 h-12 text-brand-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
              </div>
              <h3 class="text-2xl font-black text-slate-900 mb-2">Gestión de Asignaciones</h3>
              <p class="text-slate-500 mb-6">Administra las asignaciones de oradores, lectores, audiovisuales y acomodadores para cada reunión.</p>
              <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-700 text-sm font-bold border border-amber-200">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Próximamente disponible
              </div>
            </div>
          </div>
        </ng-container>

        <!-- ==================== TAB 3: RESUMEN DEL DÍA ==================== -->
        <ng-container *ngIf="activeTab() === 'resumen'">
          <div class="bg-white rounded-2xl p-8 shadow-sm border border-slate-200/60 h-full flex items-center justify-center animate-fadeIn">
            <div class="text-center max-w-md">
              <div class="w-24 h-24 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/10">
                <svg class="w-12 h-12 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
              </div>
              <h3 class="text-2xl font-black text-slate-900 mb-2">Resumen de Reunión Hoy</h3>
              <p class="text-slate-500 mb-6">Visualiza un resumen completo de la reunión programada para hoy, incluyendo participantes y materiales.</p>
              <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 text-amber-700 text-sm font-bold border border-amber-200">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Próximamente disponible
              </div>
            </div>
          </div>
        </ng-container>

      </div>
    </div>
  `,
   styles: [`
     :host { display: block; height: 100%; }
     .animate-fadeIn {
       animation: fadeIn 0.3s ease-out;
     }
     @keyframes fadeIn {
       from { opacity: 0; transform: translateY(8px); }
       to { opacity: 1; transform: translateY(0); }
     }
   `]
})
export class ReunionesPageComponent {
   tabs = [
      { id: 'asistencia' as TabType, label: 'Asistencia', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>' },
      { id: 'asignaciones' as TabType, label: 'Asignaciones', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>' },
      { id: 'resumen' as TabType, label: 'Resumen de reunión hoy', icon: '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>' }
   ];

   activeTab = signal<TabType>('asistencia');
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
