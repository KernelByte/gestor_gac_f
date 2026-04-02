import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthStore } from '../../core/auth/auth.store';

import { RouterModule } from '@angular/router';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
  <div class="h-full flex flex-col gap-6 overflow-y-auto overflow-x-hidden p-1 custom-scrollbar pb-10">
   
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
    <div *ngIf="canViewPublicadores()" class="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between hover:border-purple-200 transition-all hover:shadow-md group h-36">
      <div class="flex justify-between items-start mb-2">
       <div class="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-[#6D28D9] dark:text-purple-400 group-hover:scale-105 transition-transform shadow-sm">
         <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
       </div>
       <div class="flex flex-col items-end">
       </div>
      </div>
      <div>
       <h3 class="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{{ totalPublicadores() }}</h3>
       <p class="text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wide">Publicadores</p>
      </div>
      <div class="mt-2 h-1 w-full bg-slate-50 dark:bg-slate-700 rounded-full overflow-hidden flex items-end gap-0.5 opacity-50">
        <div class="h-1/3 w-full bg-purple-200"></div>
        <div class="h-1/2 w-full bg-purple-200"></div>
        <div class="h-2/3 w-full bg-purple-300"></div>
        <div class="h-1/2 w-full bg-purple-300"></div>
        <div class="h-full w-full bg-purple-500"></div>
      </div>
    </div>

    <!-- Informes (Orange) -->
    <div *ngIf="canViewInformes()" class="bg-white dark:bg-slate-800 rounded-2xl p-4 pb-6 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between hover:border-orange-200 transition-all hover:shadow-md group h-36">
      <div class="flex justify-between items-start">
       <div class="p-2 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-500 group-hover:scale-105 transition-transform shadow-sm">
         <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
       </div>
       <div *ngIf="informesPendientes() > 0" class="flex items-center gap-1.5 bg-red-50 dark:bg-red-900/30 px-2 py-1 rounded-lg border border-red-100">
          <span class="relative flex h-1.5 w-1.5">
           <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
           <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
          </span>
          <span class="text-[0.625rem] font-bold text-red-600 leading-none">{{ informesPendientes() }} Pendientes</span>
        </div>
      </div>
      
      <div class="flex-1 flex flex-col justify-center">
       <div class="flex items-baseline gap-1.5">
         <h3 class="text-2xl font-black text-slate-800 dark:text-white tracking-tight leading-none">{{ informesRecibidos() }}</h3>
         <span class="text-xs font-bold text-slate-400 dark:text-slate-400">/ {{ totalPublicadores() }}</span>
       </div>
       <p class="text-[0.625rem] font-bold text-slate-400 dark:text-slate-400 tracking-wide mt-0.5">Informes Rec. Último Mes</p>
      </div>
      
      <div class="w-full">
        <div class="h-1.5 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden flex">
         <div class="h-full bg-orange-400 rounded-full shadow-[0_0_8px_rgba(251,146,60,0.4)] transition-all duration-1000" [style.width.%]="porcentajeInformes()"></div>
        </div>
      </div>
    </div>

   </div>

   <!-- 3. New Visual Insights Section -->
   <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    
    <!-- Left Column: Charts & Activity (2 Cols) -->
    <div class="lg:col-span-2 flex flex-col gap-6">
      
      <!-- Reports Performance Chart (Compact & Horizontal) -->
      <div *ngIf="canViewInformes()" class="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-row items-center justify-between h-32">
        <div class="flex flex-col justify-center h-full">
          <div>
           <h3 class="font-bold text-slate-800 dark:text-white text-lg">Rendimiento</h3>
           <p class="text-xs text-slate-400 dark:text-slate-400 font-medium">Cursos y Horas (Último mes)</p>
          </div>
          <div class="mt-3 flex items-center gap-3">
           <span class="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{{ totalCursos() }}</span>
           <div class="flex flex-col">
            <span class="text-[0.625rem] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded w-fit">Cursos Bíblicos</span>
           </div>
          </div>
        </div>

        <div class="h-full flex items-end justify-end gap-2 sm:gap-4 flex-1 pb-2">
            <div class="flex flex-col items-center justify-end h-full">
              <span class="text-2xl font-black text-purple-600 dark:text-purple-400 pb-1">{{ totalHorasPrecursores() }}</span>
              <span class="text-[0.625rem] text-slate-400 dark:text-slate-400 uppercase font-bold tracking-wider">Horas Precursores</span>
            </div>
        </div>
      </div>


    </div>

    <!-- Right Column: Quick Actions (1 Col) -->
    <div class="flex flex-col gap-6">
      
      <!-- Quick Actions Grid (Color Corrected) -->
       <div class="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden h-full">
        <div class="px-5 py-4 border-b border-slate-50">
          <h2 class="font-bold text-slate-800 dark:text-white">Accesos Rápidos</h2>
        </div>
        <div class="p-4 grid grid-cols-1 gap-3">
          
          <!-- Publicadores (Purple) -->
          <button *ngIf="canManagePublicadores()" routerLink="/secretario/publicadores" class="flex flex-row items-center gap-4 p-4 rounded-xl bg-purple-50 dark:bg-purple-900/30 hover:bg-[#6D28D9] group hover:text-white dark:hover:text-white border border-transparent dark:border-slate-700/50 transition-all duration-300">
           <span class="w-10 h-10 rounded-lg bg-white/60 dark:bg-slate-800/60 flex items-center justify-center text-[#6D28D9] dark:text-purple-400 group-hover:bg-white/20 group-hover:text-white transition-colors">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
           </span>
           <div class="text-left">
            <span class="block text-sm font-bold">Gestionar Publicadores</span>
            <span class="text-[0.625rem] opacity-70 dark:opacity-80 dark:text-slate-300">Añadir o editar</span>
           </div>
          </button>
          
          <!-- Informes (Orange) (Was Green) -->
          <button *ngIf="canViewInformes()" routerLink="/mi-informe" class="flex flex-row items-center gap-4 p-4 rounded-xl bg-orange-50 dark:bg-orange-900/30 hover:bg-orange-500 group hover:text-white dark:hover:text-white border border-transparent dark:border-slate-700/50 transition-all duration-300">
           <span class="w-10 h-10 rounded-lg bg-white/60 dark:bg-slate-800/60 flex items-center justify-center text-orange-500 group-hover:bg-white/20 group-hover:text-white transition-colors">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
           </span>
           <div class="text-left">
            <span class="block text-sm font-bold">Mi Informe</span>
            <span class="text-[0.625rem] opacity-70 dark:opacity-80 dark:text-slate-300">Registrar tu actividad</span>
           </div>
          </button>

          <button *ngIf="canManageInformes()" routerLink="/secretario/informes" class="flex flex-row items-center gap-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-500 group hover:text-white dark:hover:text-white border border-transparent dark:border-slate-700/50 transition-all duration-300">
           <span class="w-10 h-10 rounded-lg bg-white/60 dark:bg-slate-800/60 flex items-center justify-center text-blue-500 group-hover:bg-white/20 group-hover:text-white transition-colors">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
           </span>
           <div class="text-left">
            <span class="block text-sm font-bold">Resumen de Informes</span>
            <span class="text-[0.625rem] opacity-70 dark:opacity-80 dark:text-slate-300">Ver mes actual</span>
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
  informesPendientes = signal(0);
  informesRecibidos = signal(0);
  porcentajeInformes = signal(0);
  totalCursos = signal(0);
  totalHorasPrecursores = signal(0);

  // Role verification checks
  canViewPublicadores = signal(false);
  canManagePublicadores = signal(false);
  canViewInformes = signal(false);
  canManageInformes = signal(false);

  ngOnInit() {
   const user = this.store.user();
   if (user) {
     this.userName.set(user.nombre || user.username);
     
     // Set permissions based on role
     const rolesPublicadores = ['Administrador', 'Gestor Aplicación', 'Coordinador', 'Secretario', 'Superintendente de servicio', 'Gestor', 'Publicador'];
     const rolesManagePublicadores = ['Administrador', 'Gestor Aplicación', 'Secretario', 'Coordinador'];
     const rolesInformes = ['Administrador', 'Secretario', 'Coordinador', 'Publicador', 'Superintendente de servicio'];
     const rolesManageInformes = ['Administrador', 'Secretario', 'Coordinador'];

     const currentRole = user.rol || '';
     
     this.canViewPublicadores.set(rolesPublicadores.includes(currentRole));
     this.canManagePublicadores.set(rolesManagePublicadores.includes(currentRole));
     this.canViewInformes.set(rolesInformes.includes(currentRole));
     this.canManageInformes.set(rolesManageInformes.includes(currentRole));

     if(this.canViewPublicadores()) {
        this.loadPublicadoresCount();
     }
     if(this.canViewInformes()) {
        this.loadInformesStats(user.id_congregacion);
     }
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
   this.http.get<any[]>('/api/publicadores/?limit=1000').subscribe({
     next: (publicadores) => {
      this.totalPublicadores.set(publicadores.length);
     },
     error: (err) => {
      console.error('Error cargando publicadores:', err);
     }
   });
  }

  private loadInformesStats(congregacionId: number | null | undefined) {
    if (!congregacionId) return;

    // Primero obtener los periodos disponibles
    this.http.get<any>('/api/informes/periodos-disponibles').subscribe({
      next: (res) => {
        if (res.periodos && res.periodos.length > 0) {
          const latest = res.periodos[0]; // El más reciente (están ordenados por backend desc)
          
          // Ahora buscar el id_periodo - Oh, la api de periodos disponibles no da el id base, vamos a deducirlo 
          // O podemos simplemente consultar el historial de este año o buscar el id_periodo
          // Si no tenemos el ID, podemos llamar get_periodo buscando por ano y mes, o iterar.
          // Wait, the API for periodos-disponibles does not return the 'id_periodo', just ano and mes.
          // Let's use the current date to find out the recent data if needed, or better, 
          // fetch /api/periodos/actual? No, there is no such endpoint specified here.
          // We can call /api/informes/resumen-mensual by looking up the ID. Since we need ID,
          // Let's first search periodos:
          this.http.get<any[]>('/api/periodos/').subscribe(periodos => {
            const p = periodos.find(x => x.codigo_ano === latest.ano && x.codigo_mes === latest.mes);
            if(p && p.id_periodo) {
               this.http.get<any>(`/api/informes/resumen-mensual?periodo_id=${p.id_periodo}&congregacion_id=${congregacionId}`).subscribe({
                  next: (stats) => {
                     this.informesRecibidos.set(stats.informes_recibidos);
                     
                     // Pendientes depends on total allowed, or from total_publicadores reported in that stats
                     const pending = stats.total_publicadores - stats.informes_recibidos;
                     this.informesPendientes.set(pending > 0 ? pending : 0);
                     
                     const pct = stats.total_publicadores > 0 ? Math.round((stats.informes_recibidos / stats.total_publicadores) * 100) : 0;
                     this.porcentajeInformes.set(pct);
                     
                     this.totalCursos.set(stats.total_cursos);
                     this.totalHorasPrecursores.set(stats.total_horas_precursores);
                     
                     // If we are getting the real total_publicadores for the period, lets also update the general one to match
                     if (stats.total_publicadores > 0) {
                        this.totalPublicadores.set(stats.total_publicadores);
                     }
                  },
                  error: err => console.error('Error loading resumen', err)
               });
            }
          });
        }
      },
      error: err => console.error('Error periodos', err)
    });
  }
}
