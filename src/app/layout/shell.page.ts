import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthStore } from '../core/auth/auth.store';
import { AuthService } from '../core/auth/auth.service';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen overflow-hidden bg-[#f8f9fc]">
      
      <!-- Mobile Overlay -->
      <div 
        *ngIf="mobileMenuOpen()" 
        class="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
        (click)="closeMobileMenu()"
      ></div>
      
      <!-- Sidebar -->
      <aside
        class="fixed top-0 left-0 h-screen bg-white border-r border-gray-200 flex flex-col z-50 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
        [ngClass]="{
          'w-72': !collapsed(),
          'w-[70px]': collapsed(),
          'translate-x-0': mobileMenuOpen(),
          '-translate-x-full lg:translate-x-0': !mobileMenuOpen()
        }"
      >
        <!-- Sidebar Header -->
        <div class="h-16 flex items-center justify-center border-b border-gray-100 px-4">
          <div class="flex items-center gap-3" [ngClass]="{ 'justify-center': collapsed() }">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5B3C88] to-[#332244] flex items-center justify-center font-bold text-white text-lg shadow-lg shadow-purple-500/20 shrink-0">
              G
            </div>
            <div 
              *ngIf="!collapsed()" 
              class="flex flex-col animate-fadeIn"
            >
              <span class="font-bold text-gray-800 whitespace-nowrap">Gestor GAC</span>
              <span class="text-xs text-gray-400 whitespace-nowrap">Panel de administración</span>
            </div>
          </div>
        </div>

        <!-- Navigation -->
        <div class="flex-1 overflow-y-auto py-4" [ngClass]="{ 'px-3': !collapsed(), 'px-2': collapsed() }">
          <nav class="space-y-1">
            
            <!-- Main Section -->
            <div class="mb-6">
              <p 
                *ngIf="!collapsed()"
                class="px-3 mb-3 text-[11px] font-semibold text-gray-400 uppercase tracking-widest"
              >Principal</p>
              
              <!-- Inicio -->
              <a
                routerLink="/"
                routerLinkActive="bg-[#5B3C88] text-white shadow-md shadow-purple-500/20 [&_.nav-icon]:bg-white/20"
                [routerLinkActiveOptions]="{ exact: true }"
                class="group flex items-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200"
                [ngClass]="{
                  'justify-center p-2': collapsed(),
                  'gap-3 px-3 py-2.5': !collapsed()
                }"
                title="Inicio"
              >
                <div class="nav-icon w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 group-hover:bg-[#5B3C88]/10 transition-colors">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 9.5L12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-medium">Inicio</span>
              </a>

              <!-- Roles -->
              <a
                *ngIf="hasRole('Administrador')"
                routerLink="/roles"
                routerLinkActive="bg-[#5B3C88] text-white shadow-md shadow-purple-500/20 [&_.nav-icon]:bg-white/20"
                class="group flex items-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200"
                [ngClass]="{
                  'justify-center p-2': collapsed(),
                  'gap-3 px-3 py-2.5': !collapsed()
                }"
                title="Roles"
              >
                <div class="nav-icon w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 group-hover:bg-[#5B3C88]/10 transition-colors">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-medium">Roles</span>
              </a>
            </div>

            <!-- Modules Section -->
            <div>
              <p 
                *ngIf="!collapsed()"
                class="px-3 mb-3 text-[11px] font-semibold text-gray-400 uppercase tracking-widest"
              >Módulos</p>
              
              <!-- Configuracion -->
              <a 
                routerLink="/configuracion" 
                routerLinkActive="bg-[#5B3C88] text-white shadow-md shadow-purple-500/20 [&_.nav-icon]:bg-white/20" 
                class="group flex items-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200" 
                [ngClass]="{
                  'justify-center p-2': collapsed(),
                  'gap-3 px-3 py-2.5': !collapsed()
                }"
                title="Configuración"
              >
                <div class="nav-icon w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 group-hover:bg-[#5B3C88]/10 transition-colors">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-medium">Configuración</span>
              </a>

              <!-- Exhibidores -->
              <a 
                routerLink="/exhibidores" 
                routerLinkActive="bg-[#5B3C88] text-white shadow-md shadow-purple-500/20 [&_.nav-icon]:bg-white/20" 
                class="group flex items-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200" 
                [ngClass]="{
                  'justify-center p-2': collapsed(),
                  'gap-3 px-3 py-2.5': !collapsed()
                }"
                title="Exhibidores"
              >
                <div class="nav-icon w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 group-hover:bg-[#5B3C88]/10 transition-colors">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-medium">Exhibidores</span>
              </a>

              <!-- Territorios -->
              <a 
                routerLink="/territorios" 
                routerLinkActive="bg-[#5B3C88] text-white shadow-md shadow-purple-500/20 [&_.nav-icon]:bg-white/20" 
                class="group flex items-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200" 
                [ngClass]="{
                  'justify-center p-2': collapsed(),
                  'gap-3 px-3 py-2.5': !collapsed()
                }"
                title="Territorios"
              >
                <div class="nav-icon w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 group-hover:bg-[#5B3C88]/10 transition-colors">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-medium">Territorios</span>
              </a>

              <!-- Secretario submenu -->
              <div>
                <button 
                  (click)="toggleSecretario()" 
                  class="w-full group flex items-center rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200"
                  [ngClass]="{
                    'justify-center p-2': collapsed(),
                    'gap-3 px-3 py-2.5': !collapsed(),
                    'bg-gray-100': secretarioOpen() && !collapsed()
                  }"
                  title="Secretario"
                >
                  <div class="nav-icon w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gray-100 group-hover:bg-[#5B3C88]/10 transition-colors">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <span *ngIf="!collapsed()" class="text-sm font-medium flex-1 text-left">Secretario</span>
                  <svg 
                    *ngIf="!collapsed()" 
                    [ngClass]="{ 'rotate-90': secretarioOpen() }" 
                    class="w-4 h-4 text-gray-400 transition-transform duration-300 mr-1" 
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                  </svg>
                </button>

                <!-- Submenu -->
                <div 
                  *ngIf="!collapsed()"
                  class="overflow-hidden transition-all duration-300 ease-in-out"
                  [ngClass]="{ 
                    'max-h-0 opacity-0': !secretarioOpen(), 
                    'max-h-40 opacity-100': secretarioOpen() 
                  }"
                >
                  <div class="mt-2 ml-[22px] pl-4 border-l-2 border-[#5B3C88]/20 space-y-1">
                    <a 
                      routerLink="/secretario/publicadores" 
                      routerLinkActive="text-[#5B3C88] bg-[#5B3C88]/10 font-semibold" 
                      class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 text-sm transition-all"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>Publicadores</span>
                    </a>

                    <a 
                      routerLink="/secretario/grupos" 
                      routerLinkActive="text-[#5B3C88] bg-[#5B3C88]/10 font-semibold" 
                      class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 text-sm transition-all"
                    >
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                         <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <span>Grupos</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </nav>
        </div>

        <!-- Sidebar Footer -->
        <div class="border-t border-gray-100" [ngClass]="{ 'p-2': collapsed(), 'p-3': !collapsed() }">
          <!-- User Info (only when expanded) -->
          <div 
            *ngIf="!collapsed()"
            class="flex items-center gap-3 px-3 py-3 rounded-xl bg-gray-50 mb-3"
          >
            <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B3C88] to-[#332244] flex items-center justify-center text-white text-sm font-bold shrink-0">
              {{ user()?.username?.charAt(0)?.toUpperCase() || 'U' }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-gray-800 truncate">{{ user()?.username || 'Usuario' }}</p>
              <p class="text-xs text-gray-400 truncate">{{ user()?.roles?.[0] || 'Sin rol' }}</p>
            </div>
          </div>
          
          <!-- Collapse Toggle Button -->
          <button 
            class="w-full flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all duration-200"
            [ngClass]="{
              'p-2': collapsed(),
              'gap-2 px-3 py-2.5': !collapsed()
            }"
            (click)="toggleSidebar()"
            [title]="collapsed() ? 'Expandir menú' : 'Colapsar menú'"
          >
            <svg 
              class="w-5 h-5 transition-transform duration-300" 
              [ngClass]="{ 'rotate-180': collapsed() }"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
            <span *ngIf="!collapsed()" class="text-sm font-medium">Colapsar</span>
          </button>
        </div>
      </aside>

      <!-- Main Content Area -->
      <div 
        class="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]" 
        [ngClass]="{
          'lg:ml-72': !collapsed(),
          'lg:ml-[70px]': collapsed()
        }"
      >
        
        <!-- Top Header -->
        <header class="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20">
          <div class="flex items-center gap-3">
            <!-- Mobile Menu Toggle -->
            <button 
              class="p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors lg:hidden" 
              (click)="openMobileMenu()"
            >
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <!-- Page Title -->
            <div>
              <h1 class="text-lg font-semibold text-gray-800">Dashboard</h1>
              <p class="text-xs text-gray-400 hidden sm:block">Bienvenido al panel de administración</p>
            </div>
          </div>

          <!-- Right Actions -->
          <div class="flex items-center gap-1 sm:gap-2">
            <!-- Search -->
            <div class="hidden md:flex items-center bg-gray-100 rounded-xl px-4 py-2.5 w-48 lg:w-64 focus-within:ring-2 focus-within:ring-[#5B3C88]/20 transition-all">
              <svg class="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input type="text" placeholder="Buscar..." class="bg-transparent border-none outline-none ml-2 text-sm text-gray-600 w-full placeholder-gray-400">
            </div>

            <!-- Notifications -->
            <div class="relative">
              <button 
                class="p-2.5 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors relative" 
                (click)="toggleNotifications()"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span class="absolute top-2 right-2 w-2 h-2 bg-[#E55934] rounded-full"></span>
              </button>
              
              <div 
                *ngIf="notificationsOpen()" 
                class="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fadeIn"
              >
                <div class="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 class="font-semibold text-gray-800">Notificaciones</h3>
                  <span class="text-xs text-[#5B3C88] font-medium bg-[#5B3C88]/10 px-2 py-1 rounded-full">3 nuevas</span>
                </div>
                <div class="p-6 text-sm text-gray-400 text-center">
                  <svg class="w-12 h-12 mx-auto mb-3 text-gray-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  No hay notificaciones nuevas
                </div>
              </div>
            </div>

            <!-- User Menu -->
            <div *ngIf="user() as u" class="relative">
              <button 
                id="user-menu-button"
                class="flex items-center gap-2 sm:gap-3 p-1.5 rounded-xl hover:bg-gray-100 transition-colors" 
                (click)="toggleUserMenu()"
              >
                <div class="w-9 h-9 rounded-full bg-gradient-to-br from-[#5B3C88] to-[#332244] flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {{ u.username.charAt(0).toUpperCase() || 'U' }}
                </div>
                <div class="hidden sm:block text-left">
                  <p class="text-sm font-medium text-gray-700">{{ u.username }}</p>
                  <p class="text-xs text-gray-400">{{ u.roles?.[0] || 'Usuario' }}</p>
                </div>
                <svg class="w-4 h-4 text-gray-400 hidden sm:block transition-transform duration-200" [ngClass]="{ 'rotate-180': userMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div 
                *ngIf="userMenuOpen()" 
                id="user-menu-panel" 
                class="absolute right-0 mt-2 w-56 sm:w-64 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-fadeIn"
              >
                <div class="p-4 border-b border-gray-100 bg-gradient-to-br from-[#5B3C88] to-[#332244] text-white">
                  <p class="font-semibold">{{ u.username }}</p>
                  <p class="text-sm text-white/70">{{ u.roles?.[0] || 'Usuario' }}</p>
                </div>
                
                <div class="p-2">
                  <button 
                    class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700 text-sm transition-colors" 
                    (click)="editProfile()"
                  >
                    <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Mi perfil
                  </button>
                  <button 
                    class="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-100 text-gray-700 text-sm transition-colors" 
                    (click)="openSettings()"
                  >
                    <svg class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Configuración
                  </button>
                </div>

                <div class="p-2 border-t border-gray-100">
                  <button 
                    class="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#E55934]/10 hover:bg-[#E55934]/20 text-[#E55934] text-sm font-medium transition-colors" 
                    (click)="logout()"
                  >
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- Page Content -->
        <main class="flex-1 overflow-hidden relative flex flex-col">
          <div class="flex-1 h-full w-full overflow-hidden p-3 sm:p-4 md:p-6 flex flex-col">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class ShellPage implements OnInit, OnDestroy {
  private store = inject(AuthStore);
  private auth = inject(AuthService);

  collapsed = signal(false);
  mobileMenuOpen = signal(false);
  userMenuOpen = signal(false);
  secretarioOpen = signal(false);
  notificationsOpen = signal(false);

  private outsideClickHandler = (e: MouseEvent) => {
    try {
      const btn = document.getElementById('user-menu-button');
      const menu = document.getElementById('user-menu-panel');
      const target = e.target as Node;
      if (this.userMenuOpen() && btn && menu && target) {
        if (!btn.contains(target) && !menu.contains(target)) {
          this.userMenuOpen.set(false);
        }
      }
    } catch (err) { }
  };

  user = computed(() => this.store.user());

  ngOnInit(): void {
    document.addEventListener('click', this.outsideClickHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.outsideClickHandler);
  }

  hasRole = (r: string) => {
    const u = this.store.user();
    const roles = u?.roles ?? (u?.rol ? [u.rol] : []);
    return roles.map(x => (x || '').toLowerCase()).includes(r.toLowerCase());
  };

  logout() { this.auth.logout(); }

  toggleSidebar() {
    this.collapsed.update(v => !v);
    if (this.collapsed()) {
      this.secretarioOpen.set(false);
    }
  }

  openMobileMenu() { this.mobileMenuOpen.set(true); }
  closeMobileMenu() { this.mobileMenuOpen.set(false); }

  toggleUserMenu() { this.userMenuOpen.update(v => !v); }
  toggleSecretario() { this.secretarioOpen.update(v => !v); }
  toggleNotifications() { this.notificationsOpen.update(v => !v); }

  editProfile() {
    this.userMenuOpen.set(false);
  }

  openSettings() {
    this.userMenuOpen.set(false);
  }
}
