import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
   standalone: true,
   imports: [CommonModule],
   template: `
    <div class="h-full flex flex-col gap-6 overflow-y-auto overflow-x-hidden p-1 custom-scrollbar">
      
      <!-- 1. Compact Welcome Header (Taller now) -->
      <div class="shrink-0 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#6D28D9] to-[#4C1D95] px-8 py-10 text-white shadow-lg flex items-center justify-between">
        <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle at 2px 2px, white 1px, transparent 0); background-size: 16px 16px;"></div>
        <div class="relative z-10 flex flex-col md:flex-row md:items-center gap-1 md:gap-4">
           <div>
              <h1 class="text-3xl sm:text-4xl font-bold tracking-tight mb-2">Hola, {{ userName() }}! 👋</h1>
              <p class="text-purple-100 text-sm sm:text-base font-medium opacity-90">
                 Aquí tienes el resumen de actividad del {{ currentDate() }}.
              </p>
           </div>
        </div>
        <div class="hidden sm:block p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10 transform rotate-3 shadow-xl">
           <svg class="w-8 h-8 text-purple-50" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
      </div>

      <!-- 2. Optimized KPI Cards + Sparklines -->
      <div class="shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- Publicadores (Purple) -->
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between hover:border-purple-200 transition-all hover:shadow-md group h-36">
           <div class="flex justify-between items-start mb-2">
              <div class="p-2 rounded-xl bg-purple-50 text-[#6D28D9] group-hover:scale-105 transition-transform shadow-sm">
                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <div class="flex flex-col items-end">
                <span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mb-1">+12%</span>
                <span class="text-[10px] text-slate-400">vs mes ant.</span>
              </div>
           </div>
           <div>
              <h3 class="text-2xl font-black text-slate-800 tracking-tight">{{ totalPublicadores() }}</h3>
              <p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Publicadores</p>
           </div>
           <div class="mt-2 h-1 w-full bg-slate-50 rounded-full overflow-hidden flex items-end gap-0.5 opacity-50">
                <div class="h-1/3 w-full bg-purple-200"></div>
                <div class="h-1/2 w-full bg-purple-200"></div>
                <div class="h-2/3 w-full bg-purple-300"></div>
                <div class="h-1/2 w-full bg-purple-300"></div>
                <div class="h-full w-full bg-purple-500"></div>
           </div>
        </div>

        <!-- Informes (Orange) -->
        <div class="bg-white rounded-2xl p-4 pb-6 shadow-sm border border-slate-100 flex flex-col justify-between hover:border-orange-200 transition-all hover:shadow-md group h-36">
           <div class="flex justify-between items-start">
              <div class="p-2 rounded-xl bg-orange-50 text-orange-500 group-hover:scale-105 transition-transform shadow-sm">
                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <div class="flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded-lg border border-red-100">
                    <span class="relative flex h-1.5 w-1.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                    </span>
                    <span class="text-[10px] font-bold text-red-600 leading-none">2 Pendientes</span>
               </div>
           </div>
           
           <div class="flex-1 flex flex-col justify-center">
              <div class="flex items-baseline gap-1.5">
                 <h3 class="text-2xl font-black text-slate-800 tracking-tight leading-none">23</h3>
                 <span class="text-xs font-bold text-slate-400">/ 30</span>
              </div>
              <p class="text-xs font-bold text-slate-400 uppercase tracking-wide mt-0.5">Informes Rec.</p>
           </div>
           
           <div class="w-full">
               <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div class="h-full bg-orange-400 rounded-full w-[76%] shadow-[0_0_8px_rgba(251,146,60,0.4)]"></div>
               </div>
           </div>
        </div>

        <!-- Territorios (Green) -->
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between hover:border-emerald-200 transition-all hover:shadow-md group h-36">
           <div class="flex justify-between items-start mb-2">
              <div class="p-2 rounded-xl bg-emerald-50 text-emerald-500 group-hover:scale-105 transition-transform shadow-sm">
                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div class="text-right">
                <span class="text-xs font-bold text-emerald-700 block">8 / 42</span>
                <span class="text-[10px] text-slate-400">Asignados</span>
              </div>
           </div>
           <div>
               <h3 class="text-2xl font-black text-slate-800 tracking-tight">19%</h3>
               <p class="text-xs font-bold text-slate-400 uppercase tracking-wide">Cobertura</p>
           </div>
           <div class="mt-2 text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg text-center truncate">
               Terr. #14, #22, #05 activos
           </div>
        </div>

        <!-- Turnos / Exhibidores (Blue) -->
        <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between hover:border-blue-200 transition-all hover:shadow-md group h-36 relative overflow-hidden">
           <div class="absolute right-0 top-0 w-16 h-16 bg-blue-50/50 rounded-bl-full -mr-4 -mt-4 z-0 pointer-events-none"></div>
           <div class="flex justify-between items-start mb-2 relative z-10">
              <div class="p-2 rounded-xl bg-blue-50 text-blue-500 group-hover:scale-105 transition-transform shadow-sm">
                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Próx. 24h</span>
           </div>
           <div class="relative z-10 flex-1 flex flex-col justify-end">
               <p class="text-[10px] text-slate-400 font-bold uppercase mb-1">Siguiente Turno</p>
               <div class="bg-blue-50/50 border border-blue-100 rounded-lg p-2 flex items-center justify-between">
                   <div class="flex flex-col">
                       <span class="text-xs font-black text-slate-700">Mañana</span>
                       <span class="text-[10px] text-blue-600 font-bold">10:00 AM</span>
                   </div>
                   <div class="w-6 h-6 rounded-full bg-blue-200 text-blue-700 text-[10px] flex items-center justify-center font-bold">
                      JG
                   </div>
               </div>
           </div>
        </div>
      </div>

      <!-- 3. New Visual Insights Section -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Left Column: Charts & Activity (2 Cols) -->
        <div class="lg:col-span-2 flex flex-col gap-6">
            
            <!-- Reports Performance Chart (Compact & Horizontal) -->
            <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex flex-row items-center justify-between h-32">
                <div class="flex flex-col justify-center h-full">
                   <div>
                      <h3 class="font-bold text-slate-800 text-lg">Rendimiento</h3>
                      <p class="text-xs text-slate-400 font-medium">Informes últimos 6 meses</p>
                   </div>
                   <div class="mt-3 flex items-center gap-3">
                      <span class="text-3xl font-black text-slate-800 tracking-tight">142</span>
                      <div class="flex flex-col">
                        <span class="text-[10px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded w-fit">+12%</span>
                        <span class="text-[9px] text-slate-400 mt-0.5">Media Semanal</span>
                      </div>
                   </div>
                </div>

                <!-- Mini Bar Chart (Right Side) -->
                <div class="h-full flex items-end gap-2 sm:gap-3">
                    <div class="group flex flex-col items-center gap-1 cursor-pointer">
                        <div class="w-2 sm:w-2.5 bg-orange-100 group-hover:bg-orange-400 rounded-full h-8 transition-all duration-300"></div>
                        <span class="text-[9px] text-slate-300 font-bold">Jul</span>
                    </div>
                    <div class="group flex flex-col items-center gap-1 cursor-pointer">
                        <div class="w-2 sm:w-2.5 bg-orange-100 group-hover:bg-orange-400 rounded-full h-12 transition-all duration-300"></div>
                        <span class="text-[9px] text-slate-300 font-bold">Ago</span>
                    </div>
                    <div class="group flex flex-col items-center gap-1 cursor-pointer">
                        <div class="w-2 sm:w-2.5 bg-orange-200 group-hover:bg-orange-400 rounded-full h-10 transition-all duration-300"></div>
                        <span class="text-[9px] text-slate-300 font-bold">Sep</span>
                    </div>
                     <div class="group flex flex-col items-center gap-1 cursor-pointer">
                        <div class="w-2 sm:w-2.5 bg-orange-300 group-hover:bg-orange-400 rounded-full h-16 transition-all duration-300"></div>
                        <span class="text-[9px] text-slate-300 font-bold">Oct</span>
                    </div>
                     <div class="group flex flex-col items-center gap-1 cursor-pointer">
                         <div class="w-2 sm:w-2.5 bg-orange-400 group-hover:bg-orange-500 rounded-full h-14 transition-all duration-300"></div>
                        <span class="text-[9px] text-slate-300 font-bold">Nov</span>
                    </div>
                     <div class="group flex flex-col items-center gap-1 cursor-pointer">
                         <div class="w-2 sm:w-2.5 bg-orange-500 shadow-lg shadow-orange-200 rounded-full h-20 transition-all duration-300"></div>
                        <span class="text-[9px] text-slate-500 font-bold">Dic</span>
                    </div>
                </div>
            </div>

            <!-- Enhanced Activity Feed (Color Corrected) -->
            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden flex-1">
                <div class="px-5 py-4 border-b border-slate-50 flex items-center justify-between shrink-0 bg-slate-50/30">
                   <h2 class="font-bold text-slate-800 flex items-center gap-2">
                       <svg class="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       Actividad Reciente
                   </h2>
                   <button class="text-[11px] font-bold text-slate-500 hover:text-purple-600 transition-colors">Ver historial completo</button>
                </div>
                <div class="p-0">
                   <!-- Item 1: Informe (Orange) -->
                   <button class="w-full text-left p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 flex gap-4 group">
                       <div class="w-10 h-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <svg class="w-4 h-4 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                       </div>
                       <div class="flex-1 min-w-0">
                          <div class="flex justify-between items-baseline mb-0.5">
                             <h4 class="text-sm font-bold text-slate-800 truncate">Informe Completado</h4>
                             <span class="text-[10px] text-slate-400 font-medium">Hace 15m</span>
                          </div>
                          <p class="text-xs text-slate-500 truncate">Maria García entregó su informe mensual sin novedades.</p>
                       </div>
                   </button>

                    <!-- Item 2: Territorio (Green) -->
                   <button class="w-full text-left p-4 hover:bg-slate-50 transition-colors border-b border-slate-50 flex gap-4 group">
                       <div class="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <svg class="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       </div>
                       <div class="flex-1 min-w-0">
                          <div class="flex justify-between items-baseline mb-0.5">
                             <h4 class="text-sm font-bold text-slate-800 truncate">Territorio Entregado</h4>
                             <span class="text-[10px] text-slate-400 font-medium">Hace 2h</span>
                          </div>
                          <p class="text-xs text-slate-500 truncate">El Territorio #09 fue completado por Juan Perez.</p>
                       </div>
                   </button>

                    <!-- Item 3: Publicador (Purple) -->
                   <button class="w-full text-left p-4 hover:bg-slate-50 transition-colors flex gap-4 group">
                       <div class="w-10 h-10 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <svg class="w-4 h-4 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                       </div>
                       <div class="flex-1 min-w-0">
                          <div class="flex justify-between items-baseline mb-0.5">
                             <h4 class="text-sm font-bold text-slate-800 truncate">Nuevo Publicador</h4>
                             <span class="text-[10px] text-slate-400 font-medium">Ayer</span>
                          </div>
                          <p class="text-xs text-slate-500 truncate">Carlos Rodriguez se unió al Grupo 3.</p>
                       </div>
                   </button>
                </div>
            </div>
        </div>

        <!-- Right Column: Quick Actions (1 Col) -->
        <div class="flex flex-col gap-6">
            
            <!-- Quick Actions Grid (Color Corrected) -->
             <div class="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden h-full">
                <div class="px-5 py-4 border-b border-slate-50">
                   <h2 class="font-bold text-slate-800">Accesos Rápidos</h2>
                </div>
                <div class="p-4 grid grid-cols-1 gap-3">
                   
                   <!-- Publicadores (Purple) -->
                   <button class="flex flex-row items-center gap-4 p-4 rounded-xl bg-purple-50 hover:bg-[#6D28D9] group hover:text-white border border-transparent transition-all duration-300">
                     <span class="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center text-[#6D28D9] group-hover:bg-white/20 group-hover:text-white transition-colors">
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                     </span>
                     <div class="text-left">
                        <span class="block text-sm font-bold">Nuevo Miembro</span>
                        <span class="text-[10px] opacity-70">Añadir publicador</span>
                     </div>
                   </button>
                   
                   <!-- Informes (Orange) (Was Green) -->
                   <button class="flex flex-row items-center gap-4 p-4 rounded-xl bg-orange-50 hover:bg-orange-500 group hover:text-white border border-transparent transition-all duration-300">
                     <span class="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center text-orange-500 group-hover:bg-white/20 group-hover:text-white transition-colors">
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                     </span>
                     <div class="text-left">
                        <span class="block text-sm font-bold">Informe</span>
                        <span class="text-[10px] opacity-70">Registrar actividad</span>
                     </div>
                   </button>
                   
                   <!-- Territorios (Green) (Was Orange) -->
                   <button class="flex flex-row items-center gap-4 p-4 rounded-xl bg-emerald-50 hover:bg-emerald-600 group hover:text-white border border-transparent transition-all duration-300">
                     <span class="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center text-emerald-600 group-hover:bg-white/20 group-hover:text-white transition-colors">
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /></svg>
                     </span>
                     <div class="text-left">
                        <span class="block text-sm font-bold">Territorio</span>
                        <span class="text-[10px] opacity-70">Asignar o devolver</span>
                     </div>
                   </button>
                   
                   <!-- Turnos (Blue) -->
                   <button class="flex flex-row items-center gap-4 p-4 rounded-xl bg-blue-50 hover:bg-blue-600 group hover:text-white border border-transparent transition-all duration-300">
                     <span class="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center text-blue-600 group-hover:bg-white/20 group-hover:text-white transition-colors">
                        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                     </span>
                     <div class="text-left">
                        <span class="block text-sm font-bold">Turno</span>
                        <span class="text-[10px] opacity-70">Programar carrito</span>
                     </div>
                   </button>
                </div>
             </div>
        </div>

      </div>

    </div>
  `,
   styles: [`
    :host {
      display: block;
      height: 100%;
    }
    .custom-scrollbar::-webkit-scrollbar {
       width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }
  `]
})
export class HomePage implements OnInit {
   private store = inject(AuthStore);
   private http = inject(HttpClient);

   userName = signal('Usuario');
   currentDate = signal('');
   totalPublicadores = signal(0);

   ngOnInit() {
      const user = this.store.user();
      if (user) {
         this.userName.set(user.nombre || user.username);
         this.loadPublicadoresCount();
      }

      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
         weekday: 'long',
         year: 'numeric',
         month: 'long',
         day: 'numeric'
      };
      this.currentDate.set(now.toLocaleDateString('es-ES', options));
   }

   private loadPublicadoresCount() {
      this.http.get<any[]>('/api/publicadores/').subscribe({
         next: (publicadores) => {
            this.totalPublicadores.set(publicadores.length);
         },
         error: (err) => {
            console.error('Error cargando publicadores:', err);
            // Mantener el valor por defecto en caso de error
         }
      });
   }
}
