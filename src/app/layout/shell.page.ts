import { Component, computed, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthStore } from '../core/auth/auth.store';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { CongregacionContextService } from '../core/congregacion-context/congregacion-context.service';
import { NotificacionesService } from '../core/notificaciones/notificaciones.service';
import { Notificacion } from '../core/notificaciones/notificacion.model';

@Pipe({ name: 'timeAgo', standalone: true })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | null): string {
    if (!value) return '';
    const date = new Date(value);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Ahora';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days}d`;
    return date.toLocaleDateString('es', { day: 'numeric', month: 'short' });
  }
}

@Component({
  standalone: true,
  selector: 'app-shell',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TimeAgoPipe],
  template: `
    <div class="flex h-screen overflow-hidden bg-app-bg dark:bg-slate-950 transition-colors duration-300" [class.dark]="themeService.darkMode()">
      
      <!-- Mobile Overlay -->
      <div 
        *ngIf="mobileMenuOpen()" 
        class="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm transition-opacity duration-300"
        (click)="closeMobileMenu()"
      ></div>
      
      <!-- Sidebar Unified (Option A) -->
      <aside
        class="print:hidden fixed inset-y-0 left-0 bg-white dark:bg-slate-900 lg:border-r border-gray-100/80 dark:border-white/5 flex flex-col z-50 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]"
        [ngClass]="{
          'w-[280px]': !collapsed(),
          'w-[80px]': collapsed(),
          'translate-x-0': mobileMenuOpen(),
          '-translate-x-full lg:translate-x-0': !mobileMenuOpen()
        }"
      >
        <!-- Sidebar Header -->
        <div class="h-[72px] flex items-center shrink-0 border-b border-gray-100/50 dark:border-white/5 transition-all duration-300" [ngClass]="collapsed() ? 'px-3 justify-center' : 'px-5'">
          <div
            class="flex items-center w-full rounded-[14px] transition-all duration-200 group cursor-pointer select-none"
            [ngClass]="collapsed() ? 'justify-center p-2 hover:bg-slate-50 dark:hover:bg-white/[0.04]' : 'hover:bg-slate-50 dark:hover:bg-white/[0.04] px-3 py-2 flex-grow justify-between'"
            (click)="toggleSidebar()"
            [title]="collapsed() ? 'Expandir menú' : 'Colapsar menú'"
          >
            <!-- Logo Icon -->
            <div class="relative flex items-center justify-center shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.2,1.2,0.3,1)] group-hover:scale-105"
                 [ngClass]="!collapsed() ? 'w-[28px]' : ''">
              <div class="absolute inset-0 bg-brand-purple/20 dark:bg-purple-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full"></div>
              <img
                src="images/LogoAppMorado.png"
                alt="GAC Logo"
                class="w-[28px] h-[28px] object-contain relative z-10 transition-transform duration-500 group-hover:-rotate-3 drop-shadow-sm"
              >
            </div>
            
            <!-- App Name -->
            <div *ngIf="!collapsed()" class="flex flex-col flex-1 items-center justify-center animate-fadeIn pt-0.5">
               <span class="font-black text-[1.25rem] tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-brand-purple to-[#4C1D95] dark:from-purple-400 dark:to-purple-200 leading-none pb-[2px]">
                 GAC
               </span>
            </div>
            
            <!-- Collapse Indicator -->
            <div *ngIf="!collapsed()" class="shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-brand-purple/70 dark:group-hover:text-purple-400/80 transition-colors duration-200 flex justify-end w-[28px]">
               <svg class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
               </svg>
            </div>
          </div>
        </div>

        <!-- Navigation (Scrollable) -->
        <div class="flex-1 overflow-y-auto py-6 custom-scrollbar" [ngClass]="{ 'px-5': !collapsed(), 'px-3': collapsed() }">
          <nav class="space-y-1.5">
            <!-- Main Section -->
            <div class="mb-8">
              <p *ngIf="!collapsed()" class="px-3 mb-2 text-[0.75rem] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Principal</p>
              
              <!-- Inicio -->
              <a routerLink="/" routerLinkActive="!text-brand-purple dark:!text-purple-400 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/[0.08] dark:bg-white/[0.02]" [routerLinkActiveOptions]="{ exact: true }"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-50/80 dark:hover:bg-white/[0.02]"
                [ngClass]="{'justify-center p-2.5': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Inicio">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 9.5L12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Inicio</span>
              </a>

              <!-- Roles -->
              <a *ngIf="hasRole('Administrador')" routerLink="/roles" routerLinkActive="!text-brand-purple dark:!text-purple-400 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/[0.08] dark:bg-white/[0.02]"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-50/80 dark:hover:bg-white/[0.02] mt-1"
                [ngClass]="{'justify-center p-2.5': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Roles">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Roles</span>
              </a>

              <!-- Usuarios -->
              <a *ngIf="hasRole('Administrador') || hasRole('Gestor Aplicación') || hasRole('Coordinador') || hasRole('Secretario')" routerLink="/usuarios" routerLinkActive="!text-brand-purple dark:!text-purple-400 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/[0.08] dark:bg-white/[0.02]"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-50/80 dark:hover:bg-white/[0.02] mt-1"
                [ngClass]="{'justify-center p-2.5': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Usuarios">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Usuarios</span>
              </a>
            </div>
            
            <!-- Modules Section -->
            <div *ngIf="hasPermission('reuniones.ver') || hasPermission('reuniones.entre_semana_ver') || hasPermission('reuniones.fin_semana_ver') || hasPermission('reuniones.asistencia_ver') || hasPermission('reuniones.configuracion_ver') || hasPermission('publicadores.ver') || hasPermission('informes.ver') || hasPermission('informes.editar') || hasPermission('informes.historial') || hasPermission('informes.enviar') || hasPermission('territorios.ver') || hasPermission('exhibidores.ver')">
              <p *ngIf="!collapsed()" class="px-3 mb-2 mt-6 text-[0.75rem] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Módulos</p>
              
              <!-- Reuniones Accordion -->
              <div *ngIf="hasPermission('reuniones.ver') || hasPermission('reuniones.entre_semana_ver') || hasPermission('reuniones.fin_semana_ver') || hasPermission('reuniones.asistencia_ver') || hasPermission('reuniones.configuracion_ver')" class="relative mt-1">
                <button (click)="toggleReunionesMenu()"
                  class="w-full group flex items-center justify-between text-sm transition-all duration-200 relative overflow-hidden rounded-lg"
                  [ngClass]="{
                    'p-2.5': collapsed(),
                    'px-3 py-2.5': !collapsed(),
                    '!text-brand-purple dark:!text-purple-400 font-semibold bg-brand-purple/[0.08] dark:bg-white/[0.02]': isReunionesActive(),
                    'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/80 dark:hover:bg-white/[0.02]': !isReunionesActive()
                  }" title="Reuniones">
                  <div class="flex items-center" [ngClass]="{ 'justify-center w-full': collapsed(), 'gap-3': !collapsed() }">
                    <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300"
                         [ngClass]="isReunionesActive() ? '!text-brand-purple dark:!text-purple-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Reuniones</span>
                  </div>
                  <svg *ngIf="!collapsed()" class="w-4 h-4 transition-transform duration-300 ease-out" [ngClass]="{ 'rotate-180': reunionesMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                
                <!-- Submenu -->
                <div *ngIf="!collapsed() && reunionesMenuOpen()" class="relative mt-1 ml-4 pl-3 pr-1 space-y-0.5 reuniones-submenu border-l border-slate-200 dark:border-slate-800">
                   <a *ngIf="hasPermission('reuniones.ver')" routerLink="/reuniones/resumen" routerLinkActive="sub-active" #rlaResumen="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaResumen.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'">
                      <span class="-ml-[17px] absolute w-[5px] h-[5px] rounded-full shadow-[0_0_0_3px_#ffffff] dark:shadow-[0_0_0_3px_#0f172a] transition-all duration-300"
                            [ngClass]="rlaResumen.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-100' : 'bg-slate-200 dark:bg-slate-800 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Resumen Hoy</span>
                   </a>
                   <a *ngIf="hasPermission('reuniones.entre_semana_ver')" routerLink="/reuniones/entre-semana" routerLinkActive="sub-active" #rlaEntre="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaEntre.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'">
                      <span class="-ml-[17px] absolute w-[5px] h-[5px] rounded-full shadow-[0_0_0_3px_#ffffff] dark:shadow-[0_0_0_3px_#0f172a] transition-all duration-300"
                            [ngClass]="rlaEntre.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-100' : 'bg-slate-200 dark:bg-slate-800 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Entre Semana</span>
                   </a>
                   <a *ngIf="hasPermission('reuniones.fin_semana_ver')" routerLink="/reuniones/fin-semana" routerLinkActive="sub-active" #rlaFin="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaFin.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'">
                      <span class="-ml-[17px] absolute w-[5px] h-[5px] rounded-full shadow-[0_0_0_3px_#ffffff] dark:shadow-[0_0_0_3px_#0f172a] transition-all duration-300"
                            [ngClass]="rlaFin.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-100' : 'bg-slate-200 dark:bg-slate-800 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Fin de Semana</span>
                   </a>
                   <a *ngIf="hasPermission('reuniones.asistencia_ver')" routerLink="/reuniones/asistencia" routerLinkActive="sub-active" #rlaAsist="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaAsist.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'">
                      <span class="-ml-[17px] absolute w-[5px] h-[5px] rounded-full shadow-[0_0_0_3px_#ffffff] dark:shadow-[0_0_0_3px_#0f172a] transition-all duration-300"
                            [ngClass]="rlaAsist.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-100' : 'bg-slate-200 dark:bg-slate-800 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Asistencia</span>
                   </a>
                   <a *ngIf="hasPermission('reuniones.configuracion_ver')" routerLink="/reuniones/configuracion" routerLinkActive="sub-active" #rlaConfigPl="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaConfigPl.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'">
                      <span class="-ml-[17px] absolute w-[5px] h-[5px] rounded-full shadow-[0_0_0_3px_#ffffff] dark:shadow-[0_0_0_3px_#0f172a] transition-all duration-300"
                            [ngClass]="rlaConfigPl.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-100' : 'bg-slate-200 dark:bg-slate-800 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Configuración</span>
                   </a>
                </div>
              </div>

              <!-- Publicadores -->
              <a *ngIf="hasPermission('publicadores.ver')" routerLink="/secretario/publicadores" routerLinkActive="!text-brand-orange dark:!text-orange-400 font-semibold [&_.nav-icon]:!text-brand-orange dark:[&_.nav-icon]:!text-orange-400 bg-brand-orange/10 dark:bg-white/[0.02]"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-50/80 dark:hover:bg-white/[0.02] mt-1"
                [ngClass]="{'justify-center p-2.5': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Publicadores">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Publicadores</span>
              </a>

              <!-- Informes -->
              <a *ngIf="hasPermission('informes.ver') || hasPermission('informes.editar') || hasPermission('informes.historial') || hasPermission('informes.enviar')" routerLink="/secretario/informes" routerLinkActive="!text-brand-purple dark:!text-purple-400 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/[0.08] dark:bg-white/[0.02]"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-50/80 dark:hover:bg-white/[0.02] mt-1"
                [ngClass]="{'justify-center p-2.5': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Informes">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Informes</span>
              </a>

              <!-- Territorios Accordion -->
              <div *ngIf="hasPermission('territorios.ver')" class="relative mt-1">
                <button (click)="toggleTerritoriosMenu()"
                  class="w-full group flex items-center justify-between text-sm transition-all duration-200 relative overflow-hidden rounded-lg"
                  [ngClass]="{
                    'p-2.5': collapsed(),
                    'px-3 py-2.5': !collapsed(),
                    '!text-brand-green dark:!text-green-400 font-semibold bg-brand-green/10 dark:bg-white/[0.02]': isTerritoriosActive(),
                    'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/80 dark:hover:bg-white/[0.02]': !isTerritoriosActive()
                  }" title="Territorios">
                  <div class="flex items-center" [ngClass]="{ 'justify-center w-full': collapsed(), 'gap-3': !collapsed() }">
                    <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-200"
                         [ngClass]="isTerritoriosActive() ? '!text-brand-green dark:!text-green-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    </div>
                    <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Territorios</span>
                  </div>
                  <svg *ngIf="!collapsed()" class="w-4 h-4 transition-transform duration-300 ease-out" [ngClass]="{ 'rotate-180': territoriosMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>

                <!-- Submenu -->
                <div *ngIf="!collapsed() && territoriosMenuOpen()" class="relative mt-1 ml-4 pl-3 pr-1 space-y-0.5 reuniones-submenu border-l border-slate-200 dark:border-slate-800">
                  <a routerLink="/territorios" routerLinkActive="sub-active" #rlaTerr="routerLinkActive" [routerLinkActiveOptions]="{exact: true}"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaTerr.isActive ? '!text-brand-green dark:!text-green-400 font-medium bg-brand-green/[0.03] dark:bg-green-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'">
                    <span class="-ml-[17px] absolute w-[5px] h-[5px] rounded-full shadow-[0_0_0_3px_#ffffff] dark:shadow-[0_0_0_3px_#0f172a] transition-all duration-300"
                          [ngClass]="rlaTerr.isActive ? 'bg-brand-green dark:bg-green-400 scale-100' : 'bg-slate-200 dark:bg-slate-800 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Congregación</span>
                  </a>
                  <a routerLink="/horarios" routerLinkActive="sub-active" #rlaHor="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaHor.isActive ? '!text-brand-green dark:!text-green-400 font-medium bg-brand-green/[0.03] dark:bg-green-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'">
                    <span class="-ml-[17px] absolute w-[5px] h-[5px] rounded-full shadow-[0_0_0_3px_#ffffff] dark:shadow-[0_0_0_3px_#0f172a] transition-all duration-300"
                          [ngClass]="rlaHor.isActive ? 'bg-brand-green dark:bg-green-400 scale-100' : 'bg-slate-200 dark:bg-slate-800 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Horarios</span>
                  </a>
                  <a routerLink="/seguimiento-predicacion" routerLinkActive="sub-active" #rlaPred="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaPred.isActive ? '!text-brand-green dark:!text-green-400 font-medium bg-brand-green/[0.03] dark:bg-green-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'">
                    <span class="-ml-[17px] absolute w-[5px] h-[5px] rounded-full shadow-[0_0_0_3px_#ffffff] dark:shadow-[0_0_0_3px_#0f172a] transition-all duration-300"
                          [ngClass]="rlaPred.isActive ? 'bg-brand-green dark:bg-green-400 scale-100' : 'bg-slate-200 dark:bg-slate-800 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Predicación</span>
                  </a>
                </div>
              </div>

              <!-- Exhibidores -->
              <a *ngIf="hasPermission('exhibidores.ver')" routerLink="/exhibidores" routerLinkActive="!text-brand-blue dark:!text-blue-400 font-semibold [&_.nav-icon]:!text-brand-blue dark:[&_.nav-icon]:!text-blue-400 bg-brand-blue/10 dark:bg-white/[0.02]"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-50/80 dark:hover:bg-white/[0.02] mt-1"
                [ngClass]="{'justify-center p-2.5': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Exhibidores">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Exhibidores</span>
              </a>
            </div>

            <!-- Extras Section -->
            <div *ngIf="hasPermission('configuracion.ver') || hasRole('Secretario') || hasRole('Coordinador') || hasRole('Administrador')" class="mt-8">
              <p *ngIf="!collapsed()" class="px-3 mb-2 mt-6 text-[0.75rem] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">Extras</p>
              
              <!-- Configuracion Normal -->
              <a *ngIf="!hasRole('Administrador') && (hasPermission('configuracion.ver') || hasRole('Secretario') || hasRole('Coordinador'))" routerLink="/configuracion" routerLinkActive="!text-brand-purple dark:!text-purple-400 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/[0.08] dark:bg-white/[0.02]"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-50/80 dark:hover:bg-white/[0.02] mt-1"
                [ngClass]="{'justify-center p-2.5': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Configuración">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Configuración</span>
              </a>

              <!-- Configuracion Admin -->
              <a *ngIf="hasRole('Administrador')" routerLink="/admin/configuracion" routerLinkActive="!text-brand-purple dark:!text-purple-400 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/[0.08] dark:bg-white/[0.02]"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-50/80 dark:hover:bg-white/[0.02] mt-1"
                [ngClass]="{'justify-center p-2.5': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Configuración del Sistema">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition-colors duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Configuración</span>
              </a>
            </div>
          </nav>
        </div>

        <!-- Sidebar Footer Action Block (Notifs, Config, User Profile) -->
        <div class="shrink-0 flex flex-col p-3 border-t border-gray-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50 gap-2">
           
           <!-- Action Row: Theme & Notifications -->
           <div class="grid gap-2" [ngClass]="collapsed() ? 'grid-cols-1' : 'grid-cols-2'">
             <button 
                class="flex items-center justify-center p-2 rounded-xl transition-all w-full"
                [ngClass]="collapsed() ? 'hover:bg-amber-100 dark:hover:bg-amber-900/20 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400' : 'flex-1 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'"
                (click)="toggleTheme()" title="Cambiar tema">
                 <svg *ngIf="!themeService.darkMode()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                 <svg *ngIf="themeService.darkMode()" class="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
             </button>

             <div class="relative w-full flex">
               <div *ngIf="notificationsOpen()" class="fixed inset-0 z-40" (click)="notificationsOpen.set(false)"></div>
               <button 
                 class="flex items-center justify-center p-2 rounded-xl transition-all w-full relative group" 
                 [ngClass]="notifService.count() > 0 ? 'bg-brand-purple/10 dark:bg-purple-500/10 text-brand-purple dark:text-purple-400 hover:bg-brand-purple/20' : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'"
                 (click)="toggleNotifications()" title="Notificaciones">
                 <svg class="w-5 h-5 relative z-10 transition-transform" [ngClass]="{'animate-[bellShake_0.6s_ease-in-out_infinite_3s]': notifService.count() > 0}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                 </svg>
                 <div *ngIf="notifService.count() > 0" class="absolute top-1.5 right-1.5 sm:top-1 sm:right-1 z-20">
                    <span class="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40"></span>
                    <span class="relative flex items-center justify-center min-w-[16px] h-[16px] px-0.5 bg-gradient-to-br from-red-500 to-rose-600 text-white text-[0.55rem] font-extrabold rounded-full shadow-sm">
                      {{ notifService.count() > 99 ? '99+' : notifService.count() }}
                    </span>
                 </div>
               </button>
               
               <!-- Dropdown Panel Notifications (upwards) -->
               <div *ngIf="notificationsOpen()" 
                 class="absolute bottom-[calc(100%+8px)] left-0 sm:left-auto sm:right-[-60px] lg:right-[-100px] mt-2.5 w-[280px] sm:w-[340px] bg-white dark:bg-slate-900 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-slate-200/60 dark:border-slate-700/60 z-50 overflow-hidden animate-fadeIn pb-1">
                 <div class="px-3 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                   <div class="flex items-center gap-2">
                     <h3 class="font-bold text-slate-800 dark:text-white text-xs">Notificaciones</h3>
                     <span *ngIf="notifService.count() > 0" class="text-[0.6rem] font-bold text-brand-purple dark:text-purple-400 bg-brand-purple/10 px-1.5 py-0.5 rounded">
                       {{ notifService.count() }}
                     </span>
                   </div>
                   <button *ngIf="notifService.count() > 0" (click)="marcarTodasLeidas()" class="text-[0.65rem] text-slate-400 hover:text-brand-purple">Marcar leídas</button>
                 </div>
                 <div class="max-h-[300px] overflow-y-auto custom-scrollbar divide-y divide-slate-50 dark:divide-slate-800/50">
                    <div *ngFor="let n of notifService.notificaciones()" 
                      class="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer relative"
                      [ngClass]="!n.leida ? 'bg-brand-purple/[0.02] hover:bg-brand-purple/[0.05]' : 'hover:bg-slate-50 dark:hover:bg-slate-800'"
                      (click)="onNotificacionClick(n)">
                      <div *ngIf="!n.leida" class="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-md bg-brand-purple"></div>
                      <div class="shrink-0 w-7 h-7 rounded-md flex items-center justify-center" [ngClass]="getNotifIconBg(n.tipo)">
                        <svg *ngIf="n.tipo === 'solicitud_acceso'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <svg *ngIf="n.tipo !== 'solicitud_acceso'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                      </div>
                      <div class="flex-1 min-w-0">
                        <p class="text-[0.75rem] leading-tight" [ngClass]="!n.leida ? 'font-bold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-300'">{{ n.titulo }}</p>
                        <p class="text-[0.65rem] text-slate-400 mt-0.5">{{ n.mensaje }}</p>
                        <p class="text-[0.6rem] text-slate-400/80 mt-1">{{ n.creado_en | timeAgo }}</p>
                      </div>
                    </div>
                    <div *ngIf="notifService.notificaciones().length === 0" class="py-8 text-center">
                      <p class="text-xs text-slate-400">Estás al día</p>
                    </div>
                 </div>
               </div>
             </div>
           </div>

           <!-- Congregacion Selector (Admin) -->
           <div *ngIf="hasRole('Administrador')" class="relative">
              <div *ngIf="congregacionDropdownOpen()" class="fixed inset-0 z-40" (click)="congregacionDropdownOpen.set(false)"></div>
              <button 
                type="button"
                (click)="toggleCongregacionDropdown()"
                class="flex items-center w-full rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700 bg-transparent hover:bg-white dark:hover:bg-slate-800 group"
                [ngClass]="collapsed() ? 'p-2 justify-center' : 'px-2 py-1.5 justify-between'"
                title="Congregación Contexto"
              >
                 <div class="flex items-center gap-2 min-w-0">
                   <div class="w-6 h-6 rounded-md bg-slate-200/50 dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-500 group-hover:text-amber-500 transition-colors">
                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                   </div>
                   <span *ngIf="!collapsed()" class="truncate text-[0.75rem] font-semibold text-slate-600 dark:text-slate-300 text-left">
                     {{ congregacionContext.selectedCongregacionName() || 'Todas las congre...' }}
                   </span>
                 </div>
                 <svg *ngIf="!collapsed()" class="w-3.5 h-3.5 text-slate-400 shrink-0 mr-1" [class.rotate-180]="congregacionDropdownOpen()" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
              </button>
              
              <div *ngIf="congregacionDropdownOpen()" 
                class="absolute bottom-[calc(100%+8px)] left-0 w-[240px] max-h-[40vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-xl shadow-xl dark:shadow-black/50 border border-slate-100 dark:border-slate-800 z-50 py-1 custom-scrollbar"
              >
                <button (click)="selectCongregacion(null, null)" class="w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2" [ngClass]="congregacionContext.selectedCongregacionId() === null ? 'bg-brand-purple/10 text-brand-purple' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'">
                  <span>Todas las congregaciones</span>
                </button>
                <div class="border-t border-slate-100 dark:border-slate-800 my-0.5"></div>
                <button *ngFor="let c of congregacionesList()" (click)="selectCongregacion(c.id_congregacion, c.nombre_congregacion)" class="w-full px-3 py-2 text-left text-xs font-medium truncate flex items-center gap-2" [ngClass]="congregacionContext.selectedCongregacionId() === c.id_congregacion ? 'bg-brand-purple/10 text-brand-purple' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'">
                  {{ c.nombre_congregacion }}
                </button>
              </div>
           </div>

           <!-- User Profile Item -->
           <div *ngIf="user() as u" class="relative mt-1">
              <div *ngIf="userMenuOpen()" class="fixed inset-0 z-40" (click)="userMenuOpen.set(false)"></div>
              <button 
                id="user-menu-button"
                class="flex items-center w-full p-1.5 rounded-xl transition-all hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-transparent hover:border-slate-200 dark:hover:border-slate-700 group focus:outline-none"
                [ngClass]="collapsed() ? 'justify-center' : 'justify-between'"
                (click)="toggleUserMenu()"
                title="Menú de Usuario"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-[#4C1D95] dark:from-purple-600 dark:to-indigo-900 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-inner [text-shadow:_0_1px_2px_rgb(0_0_0_/_40%)]">
                    {{ (u.nombre || u.username || 'U').charAt(0).toUpperCase() }}
                  </div>
                  <div *ngIf="!collapsed()" class="flex flex-col items-start min-w-0 text-left">
                     <span class="text-[0.8125rem] font-bold text-slate-800 dark:text-white truncate w-[140px] leading-tight">{{ u.nombre || u.username }}</span>
                     <span class="text-[0.625rem] font-semibold text-slate-400 uppercase tracking-widest leading-none mt-1">{{ u.roles?.[0] || 'User' }}</span>
                  </div>
                </div>
                <svg *ngIf="!collapsed()" class="w-4 h-4 text-slate-400 transition-transform group-hover:text-slate-600 mr-1 shrink-0" [ngClass]="{ 'rotate-180': userMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
              </button>

              <!-- User Menu Popup (upwards) -->
              <div *ngIf="userMenuOpen()" 
                   id="user-menu-panel" 
                   class="absolute bottom-[calc(100%+12px)] left-0 w-[240px] bg-white dark:bg-slate-900 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] dark:shadow-black/60 ring-1 ring-slate-200 dark:ring-slate-800 z-50 overflow-hidden animate-fadeIn origin-bottom-left pb-1">
                 
                 <div class="px-4 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-brand-purple to-[#4C1D95] dark:from-purple-600 dark:to-indigo-900 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-inner">
                      {{ (u.nombre || u.username || 'U').charAt(0).toUpperCase() }}
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="text-sm font-bold text-slate-800 dark:text-white truncate">{{ u.nombre || u.username }}</span>
                      <span class="text-[0.65rem] text-slate-500 truncate">{{ u.correo }}</span>
                    </div>
                 </div>

                 <div class="p-1.5 space-y-0.5 mt-1">
                   <button (click)="editProfile()" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[0.8125rem] font-medium transition-colors">
                     <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                     Mi perfil
                   </button>
                 </div>
                 <div class="px-3 py-1.5">
                   <div class="h-px w-full bg-slate-100 dark:bg-slate-800"></div>
                 </div>
                 <div class="px-1.5 pb-1">
                   <button (click)="logout()" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 text-[0.8125rem] font-medium transition-colors">
                     <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                     Cerrar sesión
                   </button>
                 </div>
              </div>
           </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <div 
        class="flex-1 flex flex-col min-w-0 h-screen transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] print:!ml-0 print:!h-auto print:!overflow-visible" 
        [ngClass]="{
          'lg:ml-[280px]': !collapsed(),
          'lg:ml-[80px]': collapsed()
        }"
      >
        
        <!-- Mobile Top Navbar (Sólo en dispositivos pequeños lg:hidden) -->
        <header class="print:hidden lg:hidden h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-4 border-b border-gray-100 dark:border-white/5 sticky top-0 z-30">
          <div class="flex items-center gap-3">
            <button class="p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all" (click)="openMobileMenu()">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <span class="font-bold text-slate-800 dark:text-white text-sm tracking-tight truncate">{{ pageTitle().title }}</span>
          </div>
          
          <!-- Quick action mobile (User profile popup) -->
          <div class="flex items-center relative" *ngIf="user() as u">
             <div *ngIf="mobileUserMenuOpen()" class="fixed inset-0 z-40" (click)="mobileUserMenuOpen.set(false)"></div>
             <button 
                id="mobile-user-menu-button"
                class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-[#4C1D95] dark:from-purple-600 dark:to-indigo-900 flex items-center justify-center text-white text-xs font-bold shadow-inner [text-shadow:_0_1px_2px_rgb(0_0_0_/_40%)] transition-all hover:opacity-90 active:scale-95" 
                (click)="toggleMobileUserMenu()"
                title="Menú de Usuario"
             >
                {{ (u.nombre || u.username || 'U').charAt(0).toUpperCase() }}
             </button>

             <!-- Mobile User Menu Popup (downwards) -->
             <div *ngIf="mobileUserMenuOpen()" 
                  id="mobile-user-menu-panel" 
                  class="absolute top-[calc(100%+12px)] right-0 w-[240px] bg-white dark:bg-slate-900 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] dark:shadow-black/60 ring-1 ring-slate-200 dark:ring-slate-800 z-50 overflow-hidden animate-fadeIn origin-top-right pb-1">
                
                <div class="px-4 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                   <div class="w-10 h-10 rounded-full bg-gradient-to-br from-brand-purple to-[#4C1D95] dark:from-purple-600 dark:to-indigo-900 flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-inner">
                     {{ (u.nombre || u.username || 'U').charAt(0).toUpperCase() }}
                   </div>
                   <div class="flex flex-col min-w-0">
                     <span class="text-sm font-bold text-slate-800 dark:text-white truncate">{{ u.nombre || u.username }}</span>
                     <span class="text-[0.65rem] text-slate-500 truncate">{{ u.correo }}</span>
                   </div>
                </div>

                <div class="p-1.5 space-y-0.5 mt-1">
                  <button (click)="editProfile()" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[0.8125rem] font-medium transition-colors">
                    <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Mi perfil
                  </button>
                </div>
                <div class="px-3 py-1.5">
                  <div class="h-px w-full bg-slate-100 dark:bg-slate-800"></div>
                </div>
                <div class="px-1.5 pb-1">
                  <button (click)="logout()" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 text-[0.8125rem] font-medium transition-colors">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Cerrar sesión
                  </button>
                </div>
             </div>
          </div>
        </header>

        <!-- Page Content -->
        <!-- Note: We removed the mx-4 mt-6 from main so it embraces the top -->
        <!-- But typical router-outlets expect padding. Let's provide a wrap padding if needed, or let views handle it -->
        <!-- Standardizing padding to p-5 lg:p-8 -->
        <main class="print:!overflow-visible print:!m-0 flex-1 overflow-hidden relative flex flex-col pt-4 md:pt-6 px-4 md:px-8 pb-6">
          <div class="router-container print:!overflow-visible print:!h-auto flex-1 min-h-0 relative overflow-hidden flex flex-col">
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
    .router-container ::ng-deep > router-outlet + * {
      flex: 1 1 0%;
      min-height: 0;
      max-height: 100%;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
      overflow-x: hidden;
    }
    /* Reuniones submenu slide animation */
    .reuniones-submenu {
      animation: submenuSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .reuniones-submenu > a {
      animation: submenuItemFade 0.3s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .reuniones-submenu > a:nth-child(2) { animation-delay: 0.03s; }
    .reuniones-submenu > a:nth-child(3) { animation-delay: 0.06s; }
    .reuniones-submenu > a:nth-child(4) { animation-delay: 0.09s; }
    .reuniones-submenu > a:nth-child(5) { animation-delay: 0.12s; }
    @keyframes submenuSlide {
      from { opacity: 0; max-height: 0; }
      to   { opacity: 1; max-height: 300px; }
    }
    @keyframes submenuItemFade {
      from { opacity: 0; transform: translateX(-8px); }
      to   { opacity: 1; transform: translateX(0); }
    }
  `]
})
// ... Inside Component
export class ShellPage implements OnInit, OnDestroy {
  private store = inject(AuthStore);
  private auth = inject(AuthService);
  themeService = inject(ThemeService);
  congregacionContext = inject(CongregacionContextService);
  notifService = inject(NotificacionesService);

  collapsed = signal(false);
  mobileMenuOpen = signal(false);
  userMenuOpen = signal(false);
  mobileUserMenuOpen = signal(false);
  notificationsOpen = signal(false);
  congregacionDropdownOpen = signal(false);
  congregacionesList = signal<{ id_congregacion: number; nombre_congregacion: string }[]>([]);
  reunionesMenuOpen = signal(false);
  territoriosMenuOpen = signal(false);

  // New Signals & Props
  // darkMode = signal(false); // Removed local signal
  // Page Title State
  pageTitle = signal<{ title: string, subtitle: string }>({ title: 'Sistema GAC', subtitle: 'Panel de Administración' });

  // notificationCount ahora viene de notifService.count()
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
      const mBtn = document.getElementById('mobile-user-menu-button');
      const mMenu = document.getElementById('mobile-user-menu-panel');
      const target = e.target as Node;
      if (this.userMenuOpen() && btn && menu && target) {
        if (!btn.contains(target) && !menu.contains(target)) {
          this.userMenuOpen.set(false);
        }
      }
      if (this.mobileUserMenuOpen() && mBtn && mMenu && target) {
        if (!mBtn.contains(target) && !mMenu.contains(target)) {
          this.mobileUserMenuOpen.set(false);
        }
      }
    } catch (err) { }
  };

  user = computed(() => this.store.user());

  router = inject(Router); // Re-injecting Router as it might be missing or private

  ngOnInit(): void {
    document.addEventListener('click', this.outsideClickHandler);
    
    // Conectar SSE para notificaciones en tiempo real
    this.notifService.connectSSE();

    // Initial Title update
    this.updateTitle(this.router.url);

    // Auto-open the reuniones accordion if we're on a reuniones route
    if (this.router.url.startsWith('/reuniones')) {
      this.reunionesMenuOpen.set(true);
    }
    // Auto-open the territorios accordion if we're on a territorios-related route
    if (this.isTerritoriosActive()) {
      this.territoriosMenuOpen.set(true);
    }

    // Listen to route changes
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateTitle(event.urlAfterRedirects);
        this.closeMobileMenu();
        // Keep accordion open when navigating between reuniones sub-routes
        if (event.urlAfterRedirects.startsWith('/reuniones')) {
          this.reunionesMenuOpen.set(true);
        }
        // Keep accordion open when navigating between territorios sub-routes
        if (event.urlAfterRedirects.startsWith('/territorios') ||
            event.urlAfterRedirects.startsWith('/horarios') ||
            event.urlAfterRedirects.startsWith('/seguimiento-predicacion')) {
          this.territoriosMenuOpen.set(true);
        }
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
    } else if (url.includes('/horarios')) {
      this.pageTitle.set({ title: 'Horarios de Predicación', subtitle: 'Programa y registra salidas de predicación.' });
    } else if (url.includes('/seguimiento-predicacion')) {
      this.pageTitle.set({ title: 'Predicación', subtitle: 'Seguimiento de estado de predicación por manzana.' });
    } else if (url.includes('/territorios')) {
      this.pageTitle.set({ title: 'Territorios', subtitle: 'Gestión de mapas y asignaciones.' });
    } else if (url.includes('/exhibidores')) {
      this.pageTitle.set({ title: 'Exhibidores', subtitle: 'Gestión de puntos de predicación pública.' });
    } else if (url.includes('/reuniones/entre-semana')) {
      this.pageTitle.set({ title: 'Vida y Ministerio', subtitle: 'Programa y asignaciones de la reunión entre semana.' });
    } else if (url.includes('/reuniones/fin-semana')) {
      this.pageTitle.set({ title: 'Reunión Fin de Semana', subtitle: 'Discurso público y Atalaya.' });
    } else if (url.includes('/reuniones/asistencia')) {
      this.pageTitle.set({ title: 'Asistencia', subtitle: 'Registro y seguimiento de asistencia semanal.' });
    } else if (url.includes('/reuniones/configuracion')) {
      this.pageTitle.set({ title: 'Configuración de Reuniones', subtitle: 'Asignación de privilegios, plantillas y parámetros del motor.' });
    } else if (url.includes('/reuniones')) {
      this.pageTitle.set({ title: 'Reuniones', subtitle: 'Resumen general de reuniones.' });
    } else if (url.includes('/admin/configuracion')) {
      this.pageTitle.set({ title: 'Configuración del Sistema', subtitle: 'Administración global de la plataforma' });
    } else if (url.includes('/configuracion')) {
      this.pageTitle.set({ title: 'Configuración', subtitle: 'Ajustes generales de la congregación' });
    } else if (url.includes('/perfil')) {
      this.pageTitle.set({ title: 'Mi Perfil', subtitle: 'Información general de tu cuenta y datos personales.' });
    } else {
      this.pageTitle.set({ title: 'Inicio', subtitle: 'Bienvenido al panel principal de gestión.' });
    }
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.outsideClickHandler);
    this.notifService.disconnectSSE();
  }

  hasRole = (r: string) => {
    const u = this.store.user();
    const roles = u?.roles ?? (u?.rol ? [u.rol] : []);
    return roles.map(x => (x || '').toLowerCase()).includes(r.toLowerCase());
  };

  hasPermission = (p: string) => this.store.hasPermission(p);

  logout() { this.auth.logout(); }

  toggleReunionesMenu() {
    this.reunionesMenuOpen.update(v => !v);
  }

  isReunionesActive(): boolean {
    return this.router.url.startsWith('/reuniones');
  }

  toggleTerritoriosMenu() {
    this.territoriosMenuOpen.update(v => !v);
  }

  isTerritoriosActive(): boolean {
    const url = this.router.url;
    return url.startsWith('/territorios') || url.startsWith('/horarios') || url.startsWith('/seguimiento-predicacion');
  }

  toggleSidebar() {
    this.collapsed.update(v => !v);
  }

  openMobileMenu() { this.mobileMenuOpen.set(true); }
  closeMobileMenu() { this.mobileMenuOpen.set(false); }

  toggleUserMenu() { this.userMenuOpen.update(v => !v); }
  toggleMobileUserMenu() { this.mobileUserMenuOpen.update(v => !v); }
  toggleNotifications() { this.notificationsOpen.update(v => !v); }

  onNotificacionClick(n: Notificacion) {
    if (!n.leida) {
      this.notifService.marcarLeida(n.id_notificacion).subscribe();
    }
    // Navegar según tipo si corresponde
    if (n.tipo === 'solicitud_acceso') {
      this.notificationsOpen.set(false);
      this.router.navigate(['/admin/configuracion'], { queryParams: { tab: 'solicitudes' } });
    }
  }

  marcarTodasLeidas() {
    this.notifService.marcarTodasLeidas().subscribe();
  }

  getNotifIconBg(tipo: string): string {
    switch (tipo) {
      case 'solicitud_acceso': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
      case 'usuario_activado': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
      case 'backup_completado': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
      default: return 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400';
    }
  }

  editProfile() {
    this.userMenuOpen.set(false);
    this.mobileUserMenuOpen.set(false);
    this.router.navigate(['/perfil']);
  }

  openSettings() {
    this.userMenuOpen.set(false);
    this.mobileUserMenuOpen.set(false);
  }

  toggleCongregacionDropdown(): void {
    const next = !this.congregacionDropdownOpen();
    this.congregacionDropdownOpen.set(next);
    if (next && this.congregacionesList().length === 0) {
      this.congregacionContext.listCongregaciones().subscribe({
        next: (list) => this.congregacionesList.set(list || []),
        error: () => this.congregacionesList.set([])
      });
    }
  }

  selectCongregacion(id: number | null, name: string | null): void {
    this.congregacionContext.setSelected(id, name);
    this.congregacionDropdownOpen.set(false);
    this.router.navigateByUrl(this.router.url, { replaceUrl: true });
  }
}
