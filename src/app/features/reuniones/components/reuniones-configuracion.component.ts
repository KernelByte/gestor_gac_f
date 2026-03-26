import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-reuniones-configuracion',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="animate-fadeIn space-y-6 pb-10">
       <div class="flex items-center justify-between">
           <div>
               <h2 class="text-2xl font-black text-slate-800 dark:text-white">Configuración del Motor</h2>
               <p class="text-slate-500 text-sm mt-1">Ajuste las características de los publicadores y preferencias de asignación.</p>
           </div>
           <div>
               <button class="px-5 py-2.5 bg-brand-purple text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 hover:bg-purple-700 transition-colors flex items-center gap-2">
                   <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                   Guardar Cambios
               </button>
           </div>
       </div>

       <!-- Inner Navigation Tabs -->
       <div class="flex items-center gap-2 border-b border-slate-200 dark:border-slate-700">
           <button *ngFor="let tab of configTabs" 
              (click)="activeTab.set(tab.id)"
              [class.text-brand-purple]="activeTab() === tab.id"
              [class.border-brand-purple]="activeTab() === tab.id"
              [class.border-transparent]="activeTab() !== tab.id"
              [class.text-slate-500]="activeTab() !== tab.id"
              class="px-6 py-3 border-b-2 font-bold text-sm transition-colors hover:text-slate-800 dark:hover:text-white flex items-center gap-2">
              <span [innerHTML]="tab.icon"></span>
              {{ tab.label }}
           </button>
       </div>

       <!-- Tab Content: Matriz de Publicadores -->
       <div *ngIf="activeTab() === 'publicadores'" class="animate-fadeIn space-y-4">
           
           <!-- Actions List -->
           <div class="flex justify-between items-center mb-6">
               <div class="relative w-72">
                   <svg class="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                   <input type="text" placeholder="Buscar publicador..." class="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-brand-purple focus:border-brand-purple outline-none transition-all">
               </div>
               <div class="flex gap-2">
                   <button class="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors">Filtros</button>
               </div>
           </div>

           <!-- Data table for publishers capabilities -->
           <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
               <div class="overflow-x-auto">
                   <table class="w-full text-sm text-left align-middle">
                       <thead class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700">
                           <tr class="text-xs font-bold text-slate-400 uppercase tracking-wider">
                               <th class="px-6 py-4">Publicador</th>
                               <th class="px-4 py-4 text-center">Nombramiento</th>
                               <th class="px-4 py-4 text-center">Presidente</th>
                               <th class="px-4 py-4 text-center">Orador</th>
                               <th class="px-4 py-4 text-center">Lector</th>
                               <th class="px-4 py-4 text-center">Audio/Video</th>
                           </tr>
                       </thead>
                       <tbody class="divide-y divide-slate-100 dark:divide-slate-700">
                           
                           <!-- Row 1 -->
                           <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                               <td class="px-6 py-4">
                                   <div class="flex items-center gap-3">
                                       <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-brand-purple font-bold text-xs shrink-0">
                                           CA
                                       </div>
                                       <div>
                                           <p class="font-bold text-slate-800 dark:text-slate-100">Carlos Andino</p>
                                           <p class="text-xs text-slate-500">Oratoria: Nivel 4</p>
                                       </div>
                                   </div>
                               </td>
                               <td class="px-4 py-4 text-center">
                                   <select class="text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-2 py-1 outline-none">
                                       <option>Anciano</option>
                                       <option>S. Ministerial</option>
                                       <option>Publicador</option>
                                   </select>
                               </td>
                               <td class="px-4 py-4 text-center"><input type="checkbox" checked class="w-4 h-4 text-brand-purple rounded border-slate-300 focus:ring-brand-purple"></td>
                               <td class="px-4 py-4 text-center"><input type="checkbox" checked class="w-4 h-4 text-brand-purple rounded border-slate-300 focus:ring-brand-purple"></td>
                               <td class="px-4 py-4 text-center"><input type="checkbox" checked class="w-4 h-4 text-brand-purple rounded border-slate-300 focus:ring-brand-purple"></td>
                               <td class="px-4 py-4 text-center"><input type="checkbox" class="w-4 h-4 text-brand-purple rounded border-slate-300 focus:ring-brand-purple"></td>
                           </tr>

                           <!-- Row 2 -->
                           <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                               <td class="px-6 py-4">
                                   <div class="flex items-center gap-3">
                                       <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                                           DA
                                       </div>
                                       <div>
                                           <p class="font-bold text-slate-800 dark:text-slate-100">David Alfaro</p>
                                           <p class="text-xs text-slate-500">Oratoria: Nivel 3</p>
                                       </div>
                                   </div>
                               </td>
                               <td class="px-4 py-4 text-center">
                                   <select class="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-2 py-1 outline-none">
                                       <option>Anciano</option>
                                       <option selected>S. Ministerial</option>
                                       <option>Publicador</option>
                                   </select>
                               </td>
                               <td class="px-4 py-4 text-center"><input type="checkbox" class="w-4 h-4 text-brand-purple rounded border-slate-300 focus:ring-brand-purple"></td>
                               <td class="px-4 py-4 text-center"><input type="checkbox" checked class="w-4 h-4 text-brand-purple rounded border-slate-300 focus:ring-brand-purple"></td>
                               <td class="px-4 py-4 text-center"><input type="checkbox" checked class="w-4 h-4 text-brand-purple rounded border-slate-300 focus:ring-brand-purple"></td>
                               <td class="px-4 py-4 text-center"><input type="checkbox" checked class="w-4 h-4 text-brand-purple rounded border-slate-300 focus:ring-brand-purple"></td>
                           </tr>
                           
                           <!-- Row 3 -->
                           <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                               <td class="px-6 py-4">
                                   <div class="flex items-center gap-3">
                                       <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0">
                                           MJ
                                       </div>
                                       <div>
                                           <p class="font-bold text-slate-800 dark:text-slate-100">María Jiménez</p>
                                           <p class="text-xs text-slate-500">Oratoria: Nivel 2</p>
                                       </div>
                                   </div>
                               </td>
                               <td class="px-4 py-4 text-center">
                                   <div class="text-xs font-bold text-slate-500 bg-slate-100 rounded-lg px-2 py-1 inline-block">Publicadora</div>
                               </td>
                               <td class="px-4 py-4 text-center">-</td>
                               <td class="px-4 py-4 text-center">-</td>
                               <td class="px-4 py-4 text-center">-</td>
                               <td class="px-4 py-4 text-center">-</td>
                           </tr>

                       </tbody>
                   </table>
               </div>
           </div>
       </div>

       <!-- Tab Content: Plantillas (Mock) -->
       <div *ngIf="activeTab() === 'plantillas'" class="animate-fadeIn">
           <div class="bg-white dark:bg-slate-800 rounded-2xl p-8 border border-slate-200/60 shadow-sm text-center">
               <div class="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
               </div>
               <h3 class="font-bold text-slate-800 mb-2 text-lg">Plantillas Estructurales</h3>
               <p class="text-slate-500 font-medium">Gestione la estructura de partes para Entre Semana y Fin de Semana. Próximamente.</p>
           </div>
       </div>

    </div>
  `,
  styles: [`
     .animate-fadeIn {
       animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
     }
     @keyframes fadeIn {
       from { opacity: 0; transform: translateY(8px); }
       to { opacity: 1; transform: translateY(0); }
     }
  `]
})
export class ReunionesConfiguracionComponent {
  configTabs = [
     { id: 'publicadores', label: 'Matriz de Publicadores', icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
     { id: 'plantillas', label: 'Plantillas de Reunión', icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>' },
     { id: 'parametros', label: 'Parámetros del Algoritmo', icon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>' }
  ];

  activeTab = signal('publicadores');
}
