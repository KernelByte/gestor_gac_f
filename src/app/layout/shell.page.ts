import { Component, computed, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthStore } from '../core/auth/auth.store';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/services/theme.service';

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen overflow-hidden bg-[#f3f4f6]" [class.dark]="themeService.darkMode()">
      
      <!-- Mobile Overlay -->
      <div 
        *ngIf="mobileMenuOpen()" 
        class="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
        (click)="closeMobileMenu()"
      ></div>
      
      <!-- Sidebar -->
      <aside
        class="fixed top-0 left-0 h-screen bg-white shadow-[4px_0_24px_rgba(0,0,0,0.02)] border-r border-gray-100 flex flex-col z-50 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]"
        [ngClass]="{
          'w-[280px]': !collapsed(),
          'w-[80px]': collapsed(),
          'translate-x-0': mobileMenuOpen(),
          '-translate-x-full lg:translate-x-0': !mobileMenuOpen()
        }"
      >
        <!-- Sidebar Header -->
        <div class="flex flex-col items-center justify-center py-6 border-b border-transparent transition-all duration-300">
             <!-- Logo Image -->
             <div class="relative w-12 h-12 shrink-0 transform transition-transform duration-500 hover:rotate-6 mb-2">
                <img 
                  src="images/LogoAppMorado.png" 
                  alt="Logo" 
                  class="w-full h-full object-contain drop-shadow-sm"
                >
             </div>

             <!-- Brand Name -->
             <div *ngIf="!collapsed()" class="animate-fadeIn text-center">
               <span class="font-display font-black text-slate-900 text-xl tracking-tight leading-none block">
                 Gestor<span class="text-[#6D28D9]">GAC</span>
               </span>
             </div>
        </div>

        <!-- Navigation -->
        <div class="flex-1 overflow-y-auto py-6" [ngClass]="{ 'px-6': !collapsed(), 'px-3': collapsed() }">
          <nav class="space-y-1.5">
            
            <!-- Main Section -->
            <div class="mb-8">
              <p 
                *ngIf="!collapsed()"
                class="px-4 mb-3 mt-2 text-[11px] font-extrabold text-slate-600 uppercase tracking-widest pl-2"
              >Principal</p>
              
              <!-- Inicio -->
              <a
                routerLink="/"
                                                                routerLinkActive="bg-brand-purple text-white shadow-lg shadow-purple-500/30 ring-1 ring-purple-600 [&_.nav-icon]:text-white [&_.nav-icon]:bg-white/20 [&_.nav-icon]:group-hover:!bg-white/20 font-bold hover:!bg-brand-purple hover:!text-white"
                [routerLinkActiveOptions]="{ exact: true }"
                class="group flex items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] relative overflow-hidden"
                [ngClass]="{
                  'justify-center p-2.5': collapsed(),
                  'gap-3.5 px-3.5 py-3': !collapsed()
                }"
                title="Inicio"
              >
                <!-- Hover Effect Background handled by CSS or utility if simple, but here handled by standard hover:bg -->
                
                <div class="nav-icon w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-slate-100/80">
                  <svg class="w-5 h-5 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 9.5L12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-semibold relative z-10">Inicio</span>
                
                <!-- Active Indicator (Right Border) handled by ring in active class for now, or add specific span -->
              </a>

              <!-- Roles -->
              <a
                *ngIf="hasRole('Administrador')"
                routerLink="/roles"
                                                                routerLinkActive="bg-brand-purple text-white shadow-lg shadow-purple-500/30 ring-1 ring-purple-600 [&_.nav-icon]:text-white [&_.nav-icon]:bg-white/20 [&_.nav-icon]:group-hover:!bg-white/20 font-bold hover:!bg-brand-purple hover:!text-white"
                class="group flex items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] relative overflow-hidden"
                [ngClass]="{
                  'justify-center p-2.5': collapsed(),
                  'gap-3.5 px-3.5 py-3': !collapsed()
                }"
                title="Roles"
              >
                <div class="nav-icon w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-slate-100/80">
                  <svg class="w-5 h-5 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-semibold relative z-10">Roles</span>
              </a>

              <!-- Usuarios (Admin only) -->
              <a
                *ngIf="hasRole('Administrador')"
                routerLink="/usuarios"
                                                                routerLinkActive="bg-brand-purple text-white shadow-lg shadow-purple-500/30 ring-1 ring-purple-600 [&_.nav-icon]:text-white [&_.nav-icon]:bg-white/20 [&_.nav-icon]:group-hover:!bg-white/20 font-bold hover:!bg-brand-purple hover:!text-white"
                class="group flex items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] relative overflow-hidden"
                [ngClass]="{
                  'justify-center p-2.5': collapsed(),
                  'gap-3.5 px-3.5 py-3': !collapsed()
                }"
                title="Usuarios"
              >
                <div class="nav-icon w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-slate-100/80">
                  <svg class="w-5 h-5 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-semibold relative z-10">Usuarios</span>
              </a>
              <a
                routerLink="/reuniones"
                routerLinkActive="bg-brand-purple text-white shadow-lg shadow-purple-500/30 ring-1 ring-purple-600 [&_.nav-icon]:text-white [&_.nav-icon]:bg-white/20 [&_.nav-icon]:group-hover:!bg-white/20 font-bold hover:!bg-brand-purple hover:!text-white"
                class="group flex items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] relative overflow-hidden"
                [ngClass]="{
                  'justify-center p-2.5': collapsed(),
                  'gap-3.5 px-3.5 py-3': !collapsed()
                }"
                title="Reuniones"
              >
                <div class="nav-icon w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-slate-100/80">
                  <svg class="w-5 h-5 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-semibold relative z-10">Reuniones</span>
              </a>
            </div>

            <!-- Modules Section -->
            <div>
              <p 
                *ngIf="!collapsed()"
                class="px-4 mb-3 text-[11px] font-extrabold text-slate-600 uppercase tracking-widest pl-2"
              >Módulos</p>
              
              <!-- Publicadores -->
              <a 
                routerLink="/secretario/publicadores" 
                routerLinkActive="bg-brand-orange text-white shadow-lg shadow-orange-500/30 ring-1 ring-orange-600 [&_.nav-icon]:text-white [&_.nav-icon]:bg-white/20 [&_.nav-icon]:group-hover:!bg-white/20 font-bold hover:!bg-brand-orange hover:!text-white"
                class="group flex items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] relative overflow-hidden"
                [ngClass]="{
                  'justify-center p-2.5': collapsed(),
                  'gap-3.5 px-3.5 py-3': !collapsed()
                }"
                title="Publicadores"
              >
                <div class="nav-icon w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-slate-100/80">
                  <svg class="w-5 h-5 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-semibold relative z-10">Publicadores</span>
              </a>

              <!-- Informes -->
              <a 
                routerLink="/secretario/informes" 
                routerLinkActive="bg-brand-purple text-white shadow-lg shadow-purple-500/30 ring-1 ring-purple-600 [&_.nav-icon]:text-white [&_.nav-icon]:bg-white/20 [&_.nav-icon]:group-hover:!bg-white/20 font-bold hover:!bg-brand-purple hover:!text-white"
                class="group flex items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] relative overflow-hidden"
                [ngClass]="{
                  'justify-center p-2.5': collapsed(),
                  'gap-3.5 px-3.5 py-3': !collapsed()
                }"
                title="Informes"
              >
                <div class="nav-icon w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-slate-100/80">
                  <svg class="w-5 h-5 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-semibold relative z-10">Informes</span>
              </a>

              <!-- Territorios -->
              <a 
                routerLink="/territorios" 
                routerLinkActive="bg-brand-green text-white shadow-lg shadow-green-500/30 ring-1 ring-green-600 [&_.nav-icon]:text-white [&_.nav-icon]:bg-white/20 [&_.nav-icon]:group-hover:!bg-white/20 font-bold hover:!bg-brand-green hover:!text-white"
                class="group flex items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] relative overflow-hidden"
                [ngClass]="{
                  'justify-center p-2.5': collapsed(),
                  'gap-3.5 px-3.5 py-3': !collapsed()
                }"
                title="Territorios"
              >
                <div class="nav-icon w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-slate-100/80">
                  <svg class="w-5 h-5 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-semibold relative z-10">Territorios</span>
              </a>

              <!-- Exhibidores -->
              <a 
                routerLink="/exhibidores" 
                routerLinkActive="bg-brand-blue text-white shadow-lg shadow-blue-500/30 ring-1 ring-blue-600 [&_.nav-icon]:text-white [&_.nav-icon]:bg-white/20 [&_.nav-icon]:group-hover:!bg-white/20 font-bold hover:!bg-brand-blue hover:!text-white"
                class="group flex items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] relative overflow-hidden"
                [ngClass]="{
                  'justify-center p-2.5': collapsed(),
                  'gap-3.5 px-3.5 py-3': !collapsed()
                }"
                title="Exhibidores"
              >
                <div class="nav-icon w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-slate-100/80">
                  <svg class="w-5 h-5 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-semibold relative z-10">Exhibidores</span>
              </a>


            </div>

            <!-- Extras Section -->
            <div class="mt-8">
              <p 
                *ngIf="!collapsed()"
                class="px-4 mb-3 text-[11px] font-extrabold text-slate-600 uppercase tracking-widest pl-2"
              >Extras</p>
              
              <!-- Configuracion -->
              <a 
                routerLink="/configuracion" 
                routerLinkActive="bg-brand-purple text-white shadow-lg shadow-purple-500/30 ring-1 ring-purple-600 [&_.nav-icon]:text-white [&_.nav-icon]:bg-white/20 [&_.nav-icon]:group-hover:!bg-white/20 font-bold hover:!bg-brand-purple hover:!text-white"
                class="group flex items-center rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] relative overflow-hidden"
                [ngClass]="{
                  'justify-center p-2.5': collapsed(),
                  'gap-3.5 px-3.5 py-3': !collapsed()
                }"
                title="Configuración"
              >
                <div class="nav-icon w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-transparent transition-all duration-300 group-hover:scale-105 group-hover:bg-slate-100/80">
                  <svg class="w-5 h-5 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <span *ngIf="!collapsed()" class="text-sm font-semibold relative z-10">Configuración</span>
              </a>
            </div>
          </nav>
        </div>

        <!-- Modern Floating Collapse Button (Enhanced Area & Micro-interaction) -->
        <button 
          class="absolute -right-5 top-[44px] w-10 h-10 flex items-center justify-center cursor-pointer z-50 focus:outline-none group/toggle"
          (click)="toggleSidebar()"
          [title]="collapsed() ? 'Expandir' : 'Colapsar'"
        >
          <!-- Visual Circle -->
          <div class="w-7 h-7 bg-white border border-slate-200 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.05)] flex items-center justify-center text-slate-400 group-hover/toggle:text-brand-purple group-hover/toggle:border-brand-purple group-hover/toggle:shadow-md transition-all duration-300 group-hover/toggle:translate-x-0.5">
              <svg 
                class="w-4 h-4 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]" 
                [ngClass]="{ 'rotate-180': collapsed() }"
                viewBox="0 0 24 24" fill="none" stroke="currentColor"
              >
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
              </svg>
          </div>
        </button>
      </aside>

      <!-- Main Content Area -->
      <div 
        class="flex-1 flex flex-col min-w-0 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]" 
        [ngClass]="{
          'lg:ml-[280px]': !collapsed(),
          'lg:ml-[80px]': collapsed()
        }"
      >
        
        <!-- Top Header -->
        <header class="h-20 bg-white/80 backdrop-blur-md flex items-center justify-between px-6 sm:px-8 sticky top-0 z-30 transition-shadow duration-300" [class.shadow-sm]="true">
          <div class="flex items-center gap-4">
            <!-- Mobile Menu Toggle -->
            <button 
              class="p-2.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors lg:hidden active:scale-95" 
              (click)="openMobileMenu()"
            >
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            
            <!-- Breadcrumb / Page Title Removed -->
          </div>

          <!-- Right Actions -->
          <div class="flex items-center gap-2 sm:gap-4">
            <!-- Search -->
            <div 
              class="hidden md:flex items-center bg-slate-50 border border-slate-200 rounded-full px-4 py-2.5 w-64 focus-within:w-80 focus-within:ring-2 focus-within:ring-purple-100 focus-within:border-purple-300 transition-all duration-300 group cursor-text"
              (click)="searchInput.focus()"
            >
              <svg class="w-4 h-4 text-slate-400 group-focus-within:text-purple-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                #searchInput
                type="text" 
                placeholder="Buscar..." 
                class="bg-transparent border-none outline-none ml-2 text-sm text-slate-700 w-full placeholder:text-slate-400"
              >
              <div class="hidden lg:flex items-center gap-1">
                <kbd class="hidden sm:inline-block min-h-[20px] px-1.5 py-0.5 text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded-md shadow-[0_1px_1px_rgba(0,0,0,0.05)]">⌘K</kbd>
              </div>
            </div>

            <!-- Theme Toggle -->
            <button 
              class="p-2.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-amber-500 transition-all active:scale-95 hidden sm:flex" 
              (click)="toggleTheme()"
              title="Cambiar tema"
            >
               <svg *ngIf="!themeService.darkMode()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
               <svg *ngIf="themeService.darkMode()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
            </button>

            <div class="h-6 w-px bg-slate-200 hidden sm:block"></div>

            <!-- Notifications -->
            <div class="relative">
              <button 
                class="p-2.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-purple-600 transition-all duration-200 relative group active:scale-95" 
                (click)="toggleNotifications()"
              >
                <div class="absolute inset-0 bg-purple-50 rounded-full scale-0 group-hover:scale-100 transition-transform duration-200"></div>
                <svg class="w-5 h-5 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                
                <!-- Badge Logic -->
                <div *ngIf="notificationCount() > 0" class="absolute -top-0.5 -right-0.5 z-20 flex items-center justify-center">
                   <span *ngIf="notificationCount() < 9" class="bg-[#EF4444] text-white text-[9px] font-bold h-4 w-4 rounded-full flex items-center justify-center border border-white">{{ notificationCount() }}</span>
                   <span *ngIf="notificationCount() >= 9" class="h-2.5 w-2.5 bg-[#EF4444] rounded-full border border-white animate-bounce"></span>
                </div>
              </button>
              
              <div 
                *ngIf="notificationsOpen()" 
                class="absolute right-0 mt-3 w-80 bg-white rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] border border-slate-100 z-50 overflow-hidden animate-fadeIn origin-top-right transform transition-all"
              >
                <div class="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                  <h3 class="font-bold text-slate-800">Notificaciones</h3>
                  <span class="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full uppercase tracking-wide">{{ notificationCount() }} nuevas</span>
                </div>
                <div class="p-8 text-sm text-slate-400 text-center flex flex-col items-center gap-3">
                   <div class="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                      <svg class="w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                   </div>
                   <p>¡Estás al día!</p>
                </div>
              </div>
            </div>

            <!-- User Menu -->
            <div *ngIf="user() as u" class="relative">
              <button 
                id="user-menu-button"
                class="flex items-center gap-3 p-1.5 pl-2 pr-4 rounded-full hover:bg-slate-100 transition-all duration-200 group focus:outline-none" 
                (click)="toggleUserMenu()"
              >
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-[#4C1D95] flex items-center justify-center text-white text-xs font-bold shrink-0 ring-2 ring-transparent group-hover:ring-purple-100 transition-all">
                  {{ (u.nombre || u.username || 'U').charAt(0).toUpperCase() }}
                </div>
                <div class="hidden sm:block text-left">
                  <p class="text-sm font-bold text-slate-700 group-hover:text-purple-700 transition-colors whitespace-nowrap">{{ u.nombre || u.username }}</p>
                  <p *ngIf="u.roles?.[0]" class="text-[10px] font-bold text-slate-400 uppercase tracking-wide leading-none mt-0.5">{{ u.roles?.[0] }}</p>
                </div>
                <svg class="w-4 h-4 text-slate-400 hidden sm:block transition-transform duration-200 group-hover:text-purple-500" [ngClass]="{ 'rotate-180': userMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div 
                *ngIf="userMenuOpen()" 
                id="user-menu-panel" 
                class="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl ring-1 ring-slate-900/5 z-50 overflow-hidden animate-fadeIn origin-top-right scale-100"
              >
                <!-- User Header (Premium) -->
                <div class="py-6 px-5 bg-gradient-to-br from-brand-purple to-[#4C1D95] border-b border-purple-800/20">
                   <div class="flex flex-col relative z-10">
                      <h3 class="font-display font-bold text-white text-lg leading-tight tracking-tight">{{ u.nombre || u.username }}</h3>
                      <p class="font-sans text-purple-200 text-xs font-medium mt-0.5 truncate">{{ u.correo }}</p>
                      <div class="mt-3">
                        <span class="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/10 text-white text-[10px] font-bold border border-white/10 uppercase tracking-wider backdrop-blur-md shadow-sm">
                          {{ u.roles?.[0] || 'Usuario' }}
                        </span>
                      </div>
                   </div>
                </div>
                
                <!-- Menu Items -->
                <div class="p-2 space-y-1">
                  <button 
                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-600 font-medium text-sm transition-all duration-200 group" 
                    (click)="editProfile()"
                  >
                    <div class="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                        <svg class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <span>Mi perfil</span>
                  </button>
                  
                  <button 
                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-600 font-medium text-sm transition-all duration-200 group" 
                    (click)="openSettings()"
                  >
                     <div class="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                        <svg class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                     </div>
                    <span>Configuración</span>
                  </button>
                </div>

                <div class="p-2 border-t border-slate-100 mt-1">
                  <button 
                    class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-slate-600 hover:text-red-600 font-medium text-sm transition-all duration-200 group" 
                    (click)="logout()"
                  >
                     <div class="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center text-red-400 group-hover:bg-red-100 group-hover:text-red-500 transition-colors">
                        <svg class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                     </div>
                    <span>Cerrar sesión</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        <!-- Page Content -->
        <main class="flex-1 overflow-hidden relative flex flex-col p-4 md:p-8">
          <div class="router-container flex-1 min-h-0 relative overflow-hidden flex flex-col">
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
    /* Ensure routed components fill the available space */
    /* The router-outlet renders components as siblings, so we target them with + */
    .router-container ::ng-deep > router-outlet + * {
      flex: 1 1 0%;
      min-height: 0;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
  `]
})
// ... Inside Component
export class ShellPage implements OnInit, OnDestroy {
  private store = inject(AuthStore);
  private auth = inject(AuthService);
  themeService = inject(ThemeService); // Inject public service

  collapsed = signal(false);
  mobileMenuOpen = signal(false);
  userMenuOpen = signal(false);
  notificationsOpen = signal(false);

  // New Signals & Props
  // darkMode = signal(false); // Removed local signal
  // Page Title State
  pageTitle = signal<{ title: string, subtitle: string }>({ title: 'Gestor GAC', subtitle: 'Panel de Administración' });

  notificationCount = signal(3);
  @ViewChild('searchInput') searchInput!: ElementRef;

  // Search Shortcut
  @HostListener('window:keydown.control.k', ['$event'])
  @HostListener('window:keydown.meta.k', ['$event'])
  handleSearchShortcut(event: any) {
    event.preventDefault();
    this.searchInput?.nativeElement?.focus();
  }

  // Uses Service method directly in template or here as proxy
  toggleTheme() {
    this.themeService.toggleTheme();
  }

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

  router = inject(Router); // Re-injecting Router as it might be missing or private

  ngOnInit(): void {
    document.addEventListener('click', this.outsideClickHandler);

    // Initial Title update
    this.updateTitle(this.router.url);

    // Listen to route changes
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateTitle(event.urlAfterRedirects);
      }
    });
  }

  private updateTitle(url: string) {
    if (url.includes('/roles')) {
      this.pageTitle.set({ title: 'Gestión de Roles', subtitle: 'Administra los roles y permisos del sistema.' });
    } else if (url.includes('/usuarios')) {
      this.pageTitle.set({ title: 'Gestión de Usuarios', subtitle: 'Administra y crea los usuarios.' });
    } else if (url.includes('/secretario/informes')) {
      this.pageTitle.set({ title: 'Informes de Servicio', subtitle: 'Gestiona los informes mensuales de la congregación.' });
    } else if (url.includes('/secretario/grupos')) {
      this.pageTitle.set({ title: 'Grupos de Predicación', subtitle: 'Organiza los grupos y asignaciones.' });
    } else if (url.includes('/secretario/publicadores')) {
      this.pageTitle.set({ title: 'Publicadores', subtitle: 'Base de datos de hermanos y publicadores.' });
    } else if (url.includes('/territorios')) {
      this.pageTitle.set({ title: 'Territorios', subtitle: 'Gestión de mapas y asignaciones.' });
    } else if (url.includes('/exhibidores')) {
      this.pageTitle.set({ title: 'Exhibidores', subtitle: 'Gestión de puntos de predicación pública.' });
    } else if (url.includes('/reuniones')) {
      this.pageTitle.set({ title: 'Reuniones', subtitle: 'Seguimiento de Asistencia' });
    } else {
      this.pageTitle.set({ title: 'Inicio', subtitle: 'Bienvenido al panel principal de gestión.' });
    }
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
  }

  openMobileMenu() { this.mobileMenuOpen.set(true); }
  closeMobileMenu() { this.mobileMenuOpen.set(false); }

  toggleUserMenu() { this.userMenuOpen.update(v => !v); }
  toggleNotifications() { this.notificationsOpen.update(v => !v); }

  editProfile() {
    this.userMenuOpen.set(false);
  }

  openSettings() {
    this.userMenuOpen.set(false);
  }
}
