import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      
      <!-- Welcome Header -->
      <div class="bg-gradient-to-r from-[#5B3C88] to-[#332244] rounded-2xl p-6 sm:p-8 text-white shadow-xl">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold mb-2">
              ¡Bienvenido, {{ userName() }}! 👋
            </h1>
            <p class="text-white/70 text-sm sm:text-base">
              Aquí está el resumen de tu congregación
            </p>
          </div>
          <div class="flex items-center gap-3">
            <span class="px-4 py-2 bg-white/10 rounded-xl text-sm font-medium backdrop-blur-sm">
              {{ currentDate() }}
            </span>
          </div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        <!-- Stat Card 1 -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow group">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 rounded-xl bg-[#5B3C88]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg class="w-6 h-6 text-[#5B3C88]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span class="text-xs font-medium text-[#9BC53D] bg-[#9BC53D]/10 px-2 py-1 rounded-full">+12%</span>
          </div>
          <h3 class="text-2xl font-bold text-gray-800 mb-1">156</h3>
          <p class="text-sm text-gray-500">Publicadores activos</p>
        </div>

        <!-- Stat Card 2 -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow group">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 rounded-xl bg-[#FDE74C]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg class="w-6 h-6 text-[#E55934]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span class="text-xs font-medium text-[#E55934] bg-[#E55934]/10 px-2 py-1 rounded-full">Pendientes</span>
          </div>
          <h3 class="text-2xl font-bold text-gray-800 mb-1">23</h3>
          <p class="text-sm text-gray-500">Informes este mes</p>
        </div>

        <!-- Stat Card 3 -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow group">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 rounded-xl bg-[#9BC53D]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg class="w-6 h-6 text-[#9BC53D]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <span class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">8 asignados</span>
          </div>
          <h3 class="text-2xl font-bold text-gray-800 mb-1">42</h3>
          <p class="text-sm text-gray-500">Territorios disponibles</p>
        </div>

        <!-- Stat Card 4 -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition-shadow group">
          <div class="flex items-center justify-between mb-4">
            <div class="w-12 h-12 rounded-xl bg-[#332244]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <svg class="w-6 h-6 text-[#332244]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span class="text-xs font-medium text-[#5B3C88] bg-[#5B3C88]/10 px-2 py-1 rounded-full">Próximo</span>
          </div>
          <h3 class="text-2xl font-bold text-gray-800 mb-1">15</h3>
          <p class="text-sm text-gray-500">Turnos de exhibidores</p>
        </div>
      </div>

      <!-- Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <!-- Recent Activity -->
        <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-800">Actividad Reciente</h2>
            <button class="text-sm text-[#5B3C88] hover:underline font-medium">Ver todo</button>
          </div>
          <div class="divide-y divide-gray-50">
            
            <div class="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
              <div class="w-10 h-10 rounded-full bg-[#9BC53D]/10 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-[#9BC53D]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800">Nuevo informe registrado</p>
                <p class="text-xs text-gray-500 mt-1">María García entregó su informe de servicio</p>
              </div>
              <span class="text-xs text-gray-400 whitespace-nowrap">Hace 2h</span>
            </div>

            <div class="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
              <div class="w-10 h-10 rounded-full bg-[#5B3C88]/10 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-[#5B3C88]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800">Nuevo publicador agregado</p>
                <p class="text-xs text-gray-500 mt-1">Carlos Rodríguez fue añadido al grupo 3</p>
              </div>
              <span class="text-xs text-gray-400 whitespace-nowrap">Hace 5h</span>
            </div>

            <div class="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
              <div class="w-10 h-10 rounded-full bg-[#FDE74C]/20 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-[#E55934]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800">Territorio asignado</p>
                <p class="text-xs text-gray-500 mt-1">Territorio #15 asignado a Juan Pérez</p>
              </div>
              <span class="text-xs text-gray-400 whitespace-nowrap">Ayer</span>
            </div>

            <div class="p-4 hover:bg-gray-50 transition-colors flex items-start gap-4">
              <div class="w-10 h-10 rounded-full bg-[#332244]/10 flex items-center justify-center shrink-0">
                <svg class="w-5 h-5 text-[#332244]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-800">Turno programado</p>
                <p class="text-xs text-gray-500 mt-1">Exhibidor Centro - Sábado 10:00 AM</p>
              </div>
              <span class="text-xs text-gray-400 whitespace-nowrap">Hace 2 días</span>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div class="p-6 border-b border-gray-100">
            <h2 class="text-lg font-semibold text-gray-800">Acciones Rápidas</h2>
          </div>
          <div class="p-4 space-y-3">
            
            <button class="w-full flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-[#5B3C88] to-[#332244] text-white hover:opacity-90 transition-opacity group">
              <div class="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span class="font-medium">Nuevo Publicador</span>
            </button>

            <button class="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors group">
              <div class="w-10 h-10 rounded-lg bg-[#9BC53D]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg class="w-5 h-5 text-[#9BC53D]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span class="font-medium">Registrar Informe</span>
            </button>

            <button class="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors group">
              <div class="w-10 h-10 rounded-lg bg-[#E55934]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg class="w-5 h-5 text-[#E55934]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <span class="font-medium">Asignar Territorio</span>
            </button>

            <button class="w-full flex items-center gap-4 p-4 rounded-xl bg-gray-50 text-gray-700 hover:bg-gray-100 transition-colors group">
              <div class="w-10 h-10 rounded-lg bg-[#FDE74C]/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <svg class="w-5 h-5 text-[#332244]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span class="font-medium">Programar Turno</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `
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
