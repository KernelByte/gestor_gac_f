import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
   standalone: true,
   imports: [CommonModule],
   template: `
    <div class="h-full flex flex-col gap-4 overflow-hidden animate-fadeIn">
      
      <!-- 1. Welcome Header Section -->
      <div class="shrink-0 relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#6D28D9] to-[#4C1D95] px-8 py-16 text-white shadow-sm flex items-center justify-between">
        <div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle at 2px 2px, white 1px, transparent 0); background-size: 16px 16px;"></div>
        <div class="relative z-10">
           <h1 class="text-3xl sm:text-4xl font-bold tracking-tight">Hola, {{ userName() }}! 👋</h1>
           <p class="text-purple-100 text-sm sm:text-base font-medium opacity-90 mt-1">
              Bienvenido a tu panel de gestión. Hoy es {{ currentDate() }}.
           </p>
        </div>
        <div class="hidden sm:block p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10 transform rotate-3">
           <svg class="w-8 h-8 text-purple-100" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
      </div>

      <!-- 2. Stats Cards Section (Fixed Height for consistency) -->
      <div class="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Card 1 -->
        <div class="h-32 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-purple-100 transition-colors group">
           <div class="flex justify-between items-start">
              <div class="p-2 rounded-xl bg-purple-50 text-[#6D28D9] group-hover:scale-110 transition-transform">
                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </div>
              <span class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">+12%</span>
           </div>
           <div>
              <h3 class="text-2xl font-black text-slate-800">156</h3>
              <p class="text-xs font-bold text-slate-400">Publicadores</p>
           </div>
        </div>

        <!-- Card 2 -->
        <div class="h-32 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-orange-100 transition-colors group">
           <div class="flex justify-between items-start">
              <div class="p-2 rounded-xl bg-orange-50 text-orange-500 group-hover:scale-110 transition-transform">
                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              </div>
              <span class="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Pend.</span>
           </div>
           <div>
              <h3 class="text-2xl font-black text-slate-800">23</h3>
              <p class="text-xs font-bold text-slate-400">Informes</p>
           </div>
        </div>

        <!-- Card 3 -->
        <div class="h-32 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-emerald-100 transition-colors group">
           <div class="flex justify-between items-start">
              <div class="p-2 rounded-xl bg-emerald-50 text-emerald-500 group-hover:scale-110 transition-transform">
                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
              </div>
              <span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">8 Asig.</span>
           </div>
           <div>
              <h3 class="text-2xl font-black text-slate-800">42</h3>
              <p class="text-xs font-bold text-slate-400">Territorios</p>
           </div>
        </div>

        <!-- Card 4 -->
        <div class="h-32 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col justify-between hover:border-blue-100 transition-colors group">
           <div class="flex justify-between items-start">
              <div class="p-2 rounded-xl bg-blue-50 text-blue-500 group-hover:scale-110 transition-transform">
                 <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <span class="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Próx.</span>
           </div>
           <div>
              <h3 class="text-2xl font-black text-slate-800">15</h3>
              <p class="text-xs font-bold text-slate-400">Turnos</p>
           </div>
        </div>
      </div>

      <!-- 3. Bottom Section: Activity Feed (Left) & Quick Actions (Right) -->
      <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-3 gap-4">
         
         <!-- Activity Feed -->
         <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between shrink-0">
               <h2 class="font-bold text-slate-800">Actividad Reciente</h2>
               <button class="text-xs font-bold text-[#6D28D9] bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors">Ver todo</button>
            </div>
            <div class="flex-1 overflow-y-auto p-5 relative custom-scrollbar">
               <div class="absolute left-[41px] top-6 bottom-6 w-0.5 bg-slate-100 z-0"></div>
               <div class="space-y-6 relative z-10">
                  <!-- Activity items -->
                  <div class="flex gap-4 group">
                      <div class="w-10 h-10 rounded-xl bg-white border-2 border-slate-50 shadow-sm flex items-center justify-center shrink-0">
                         <svg class="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div class="flex-1">
                         <div class="flex justify-between items-start">
                            <h4 class="text-sm font-bold text-slate-800">Informe registrado</h4>
                            <span class="text-[10px] text-slate-400 font-bold">Hace 2h</span>
                         </div>
                         <p class="text-xs text-slate-500 mt-0.5">María García entregó su informe.</p>
                      </div>
                  </div>
                  
                   <div class="flex gap-4 group">
                      <div class="w-10 h-10 rounded-xl bg-white border-2 border-slate-50 shadow-sm flex items-center justify-center shrink-0">
                         <svg class="w-5 h-5 text-[#6D28D9]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>
                      </div>
                      <div class="flex-1">
                         <div class="flex justify-between items-start">
                            <h4 class="text-sm font-bold text-slate-800">Publicador agregado</h4>
                            <span class="text-[10px] text-slate-400 font-bold">Hace 5h</span>
                         </div>
                         <p class="text-xs text-slate-500 mt-0.5">Carlos Rodríguez añadido a grupo.</p>
                      </div>
                  </div>

                   <div class="flex gap-4 group">
                      <div class="w-10 h-10 rounded-xl bg-white border-2 border-slate-50 shadow-sm flex items-center justify-center shrink-0">
                         <svg class="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                      </div>
                      <div class="flex-1">
                         <div class="flex justify-between items-start">
                            <h4 class="text-sm font-bold text-slate-800">Territorio asignado</h4>
                            <span class="text-[10px] text-slate-400 font-bold">Ayer</span>
                         </div>
                         <p class="text-xs text-slate-500 mt-0.5">Territorio #15 a Juan Pérez.</p>
                      </div>
                  </div>
                  
                    <div class="flex gap-4 group">
                      <div class="w-10 h-10 rounded-xl bg-white border-2 border-slate-50 shadow-sm flex items-center justify-center shrink-0">
                         <svg class="w-5 h-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                      <div class="flex-1">
                         <div class="flex justify-between items-start">
                            <h4 class="text-sm font-bold text-slate-800">Turno programado</h4>
                            <span class="text-[10px] text-slate-400 font-bold">Hace 2d</span>
                         </div>
                         <p class="text-xs text-slate-500 mt-0.5">Exh. Centro, Sáb. 10AM.</p>
                      </div>
                  </div>
                   <div class="flex gap-4 group">
                      <div class="w-10 h-10 rounded-xl bg-white border-2 border-slate-50 shadow-sm flex items-center justify-center shrink-0">
                         <svg class="w-5 h-5 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <div class="flex-1">
                         <div class="flex justify-between items-start">
                            <h4 class="text-sm font-bold text-slate-800">Informe registrado</h4>
                            <span class="text-[10px] text-slate-400 font-bold">Hace 3d</span>
                         </div>
                         <p class="text-xs text-slate-500 mt-0.5">Pedro Gomez entregó su informe.</p>
                      </div>
                  </div>
               </div>
            </div>
         </div>

         <!-- Quick Actions -->
         <div class="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col overflow-hidden">
            <div class="px-5 py-4 border-b border-gray-50 flex items-center justify-between shrink-0">
               <h2 class="font-bold text-slate-800">Acciones</h2>
            </div>
            <!-- Expanded Area for Buttons -->
            <div class="flex-1 p-4 grid grid-cols-2 grid-rows-2 gap-4">
               <button class="flex flex-col items-center justify-center text-center p-2 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md hover:border-purple-100 border border-transparent transition-all group h-full">
                 <div class="w-12 h-12 rounded-xl bg-purple-100 text-[#6D28D9] flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                   <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                 </div>
                 <span class="text-xs font-bold text-slate-600">Nuevo Publicador</span>
               </button>
               
               <button class="flex flex-col items-center justify-center text-center p-2 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md hover:border-emerald-100 border border-transparent transition-all group h-full">
                 <div class="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                   <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                 </div>
                 <span class="text-xs font-bold text-slate-600">Registrar Informe</span>
               </button>
               
               <button class="flex flex-col items-center justify-center text-center p-2 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md hover:border-orange-100 border border-transparent transition-all group h-full">
                 <div class="w-12 h-12 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                   <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                 </div>
                 <span class="text-xs font-bold text-slate-600">Asignar Territorio</span>
               </button>
               
               <button class="flex flex-col items-center justify-center text-center p-2 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md hover:border-blue-100 border border-transparent transition-all group h-full">
                 <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                   <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                 </div>
                 <span class="text-xs font-bold text-slate-600">Programar Turno</span>
               </button>
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

   userName = signal('Usuario');
   currentDate = signal('');

   ngOnInit() {
      const user = this.store.user();
      if (user?.username) {
         this.userName.set(user.username);
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
}
