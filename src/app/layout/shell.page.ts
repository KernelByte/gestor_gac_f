import { Component, computed, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthStore } from '../core/auth/auth.store';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { CongregacionContextService } from '../core/congregacion-context/congregacion-context.service';
import { NotificacionesService } from '../core/notificaciones/notificaciones.service';
import { Notificacion } from '../core/notificaciones/notificacion.model';
import { ForcePasswordChangeComponent } from '../core/components/force-password-change.component';
import { ModalBackdropService } from '../core/services/modal-backdrop.service';
import { ToastContainerComponent } from '../shared/components/toast/toast-container.component';
import { CommandPaletteComponent } from '../shared/components/command-palette/command-palette.component';
import { VisitaService } from '../features/secretario-tools/services/visita.service';

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
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TimeAgoPipe, ForcePasswordChangeComponent, ToastContainerComponent, CommandPaletteComponent],
  template: `
    <div class="flex h-screen overflow-hidden bg-app-bg dark:bg-slate-950 transition-colors duration-300" [class.dark]="themeService.darkMode()">

      <!-- Cambio de Contraseña Obligatorio (Overlay) -->
      <app-force-password-change *ngIf="mustChangePassword()"></app-force-password-change>
      
      <!-- Mobile Overlay -->
      <div 
        *ngIf="mobileMenuOpen()" 
        class="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"
        (click)="closeMobileMenu()"
      ></div>
      
      <!-- Sidebar Unified (Option A) -->
      <aside
        class="print:hidden fixed inset-y-0 left-0 lg:top-3 lg:bottom-3 lg:left-3 bg-white dark:bg-slate-900 flex flex-col z-50 transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] lg:rounded-2xl sidebar-float"
        [ngClass]="{
          'w-[280px]': !collapsed(),
          'w-[80px]': collapsed(),
          'translate-x-0': mobileMenuOpen(),
          '-translate-x-full lg:translate-x-0': !mobileMenuOpen()
        }"
      >
        <!-- Sidebar Header — click anywhere to toggle -->
        <div class="h-16 flex items-center shrink-0 border-b border-gray-100/50 dark:border-white/5 transition-all duration-300 cursor-pointer select-none active:scale-[0.98]"
             [ngClass]="collapsed() ? 'px-3 justify-center' : 'px-4'"
             (click)="toggleSidebar()"
             [title]="collapsed() ? 'Expandir menú' : 'Colapsar menú'">

          <!-- Collapsed: logo centered -->
          <div *ngIf="collapsed()" class="flex items-center justify-center w-10 h-10 rounded-xl mx-auto">
            <img src="images/LogoAppMorado.png" alt="GAC" class="w-7 h-7 object-contain">
          </div>

          <!-- Expanded: brand left + chevron right -->
          <div *ngIf="!collapsed()" class="flex items-center justify-between w-full">
            <div class="flex items-center gap-2.5">
              <img src="images/LogoAppMorado.png" alt="GAC Logo"
                   class="w-8 h-8 object-contain shrink-0">
              <span class="font-display font-extrabold text-[1.1rem] tracking-[-0.04em] text-[#a240e3] dark:text-white leading-none">
                GAC
              </span>
            </div>
            <svg class="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>

        <!-- Navigation (Scrollable) -->
        <div class="sidebar-nav flex-1 min-h-0 overflow-y-auto py-6 custom-scrollbar" [ngClass]="{ 'px-5': !collapsed(), 'px-3': collapsed() }"
             (mouseover)="onNavHover($event)" (mouseleave)="hideNavTooltip()" (scroll)="hideNavTooltip()">
          <nav class="space-y-1.5">
            <!-- Main Section -->
            <div class="mb-8">
              <p *ngIf="!collapsed()" class="px-3 mb-2 text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-slate-400/70 dark:text-slate-600">Principal</p>
              
              <!-- Inicio -->
              <a routerLink="/" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active" [routerLinkActiveOptions]="{ exact: true }"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Inicio">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 9.5L12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Inicio</span>
              </a>

              <!-- Roles -->
              <a *ngIf="hasRole('Administrador')" routerLink="/roles" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Roles">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Roles</span>
              </a>

              <!-- Usuarios -->
              <a *ngIf="hasRole('Administrador') || hasRole('Gestor Aplicación') || hasRole('Coordinador') || hasRole('Secretario')" routerLink="/usuarios" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Usuarios">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Usuarios</span>
              </a>
            </div>
            
            <!-- Colaboración Section — independiente del rol: visible solo si el usuario
                 fue invitado como colaborador de alguna visita del superintendente.
                 Va aparte del menú "Secretario" (que es exclusivo del rol Secretario). -->
            <div *ngIf="hasColaboraciones()" class="mb-8">
              <div class="h-px bg-slate-100 dark:bg-slate-800/60 mx-2 mb-4 mt-2"></div>
              <p *ngIf="!collapsed()" class="px-3 mb-2 text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-slate-400/70 dark:text-slate-600">Colaboración</p>

              <a routerLink="/herramientas/visita-colaborador" routerLinkActive="text-brand-purple dark:text-purple-400 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Visita del circuito">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Visita del circuito</span>
              </a>
            </div>

            <!-- Modules Section -->
            <div *ngIf="hasAnyReunionesPermission() || hasPermission('publicadores.ver') || hasPermission('informes.ver') || hasPermission('informes.editar') || hasPermission('informes.historial') || hasPermission('informes.enviar') || hasPermission('territorios.ver') || hasPermission('exhibidores.ver') || hasAnyReportesPermission() || hasRole('Secretario') || hasRole('Coordinador') || hasRole('Administrador')">
              <div class="h-px bg-slate-100 dark:bg-slate-800/60 mx-2 mb-4 mt-2"></div>
              <p *ngIf="!collapsed()" class="px-3 mb-2 text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-slate-400/70 dark:text-slate-600">Módulos</p>
              
              <!-- Reuniones Accordion -->
              <div *ngIf="hasAnyReunionesPermission()" class="relative mt-1">
                <button (click)="toggleReunionesMenu()"
                  [attr.aria-expanded]="reunionesMenuOpen()"
                  aria-controls="reuniones-submenu"
                  class="w-full group flex items-center justify-between text-sm transition-all duration-200 relative rounded-lg"
                  [ngClass]="{
                    'p-3': collapsed(),
                    'px-3 py-2.5': !collapsed(),
                    'text-brand-purple dark:text-purple-300 font-semibold bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active': isReunionesActive(),
                    'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]': !isReunionesActive()
                  }" title="Reuniones">
                  <div class="flex items-center" [ngClass]="{ 'justify-center w-full': collapsed(), 'gap-3': !collapsed() }">
                    <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]"
                         [ngClass]="isReunionesActive() ? '!text-brand-purple dark:!text-purple-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Reuniones</span>
                  </div>
                  <svg *ngIf="!collapsed()" class="w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]" [ngClass]="{ 'rotate-180': reunionesMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                
                <!-- Submenu -->
                <div *ngIf="!collapsed() && reunionesMenuOpen()" id="reuniones-submenu" class="relative mt-1 ml-4 pl-3 pr-1 space-y-0.5 reuniones-submenu border-l border-slate-200 dark:border-slate-800">
                   <a *ngIf="hasPermission('reuniones.ver')" routerLink="/reuniones/resumen" routerLinkActive="sub-active" #rlaResumen="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaResumen.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                      <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                            [ngClass]="rlaResumen.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Resumen Hoy</span>
                   </a>
                   <a *ngIf="hasPermission('reuniones.entre_semana') || hasPermission('reuniones.fin_semana') || hasPermission('reuniones.logistica') || hasPermission('reuniones.discursos')" routerLink="/reuniones/programacion" routerLinkActive="sub-active" #rlaProg="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaProg.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                      <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                            [ngClass]="rlaProg.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Programación</span>
                   </a>
                   <a *ngIf="hasPermission('reuniones.asistencia')" routerLink="/reuniones/asistencia" routerLinkActive="sub-active" #rlaAsist="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaAsist.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                      <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                            [ngClass]="rlaAsist.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Asistencia</span>
                   </a>
                   <a *ngIf="hasPermission('reuniones.configuracion')" routerLink="/reuniones/configuracion" routerLinkActive="sub-active" #rlaConfigPl="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaConfigPl.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                      <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                            [ngClass]="rlaConfigPl.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Configuración</span>
                   </a>
                </div>
              </div>

              <!-- Publicadores -->
              <a *ngIf="hasPermission('publicadores.ver')" routerLink="/secretario/publicadores" routerLinkActive="text-brand-orange dark:text-orange-300 font-semibold [&_.nav-icon]:!text-brand-orange dark:[&_.nav-icon]:!text-orange-400 bg-brand-orange/10 dark:bg-orange-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Publicadores">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Publicadores</span>
              </a>

              <!-- Informes -->
              <a *ngIf="hasPermission('informes.ver') || hasPermission('informes.editar') || hasPermission('informes.historial') || hasPermission('informes.enviar')" routerLink="/secretario/informes" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Informes">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Informes</span>
              </a>

              <!-- Secretario Tools Accordion — exclusivo de Secretario/Administrador -->
              <div *ngIf="hasRole('Secretario') || hasRole('Administrador')" class="relative mt-1">
                <button (click)="toggleSecretarioToolsMenu()"
                  class="w-full group flex items-center justify-between text-sm transition-all duration-200 relative rounded-lg"
                  [ngClass]="{
                    'p-3': collapsed(),
                    'px-3 py-2.5': !collapsed(),
                    'text-brand-purple dark:text-purple-300 font-semibold bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active': isSecretarioToolsActive(),
                    'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]': !isSecretarioToolsActive()
                  }" title="Secretario">
                  <div class="flex items-center" [ngClass]="{ 'justify-center w-full': collapsed(), 'gap-3': !collapsed() }">
                    <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 group-hover:-translate-y-[1px]"
                         [ngClass]="isSecretarioToolsActive() ? '!text-brand-purple dark:!text-purple-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    </div>
                    <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Secretario</span>
                  </div>
                  <svg *ngIf="!collapsed()" class="w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]" [ngClass]="{ 'rotate-180': secretarioToolsMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>

                <div *ngIf="!collapsed() && secretarioToolsMenuOpen()" class="relative mt-1 ml-4 pl-3 pr-1 space-y-0.5 reuniones-submenu border-l border-slate-200 dark:border-slate-800">
                  <a routerLink="/secretario-tools/visita-superintendente" routerLinkActive="sub-active" #rlaVS="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaVS.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaVS.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Visita del SC</span>
                  </a>
                  <a routerLink="/secretario-tools/actas-reunion" routerLinkActive="sub-active" #rlaAR="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaAR.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaAR.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Actas de reunión</span>
                  </a>
                  <a routerLink="/secretario-tools/transferencias" routerLinkActive="sub-active" #rlaTR="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaTR.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaTR.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Transferencias</span>
                  </a>
                </div>
              </div>

              <!-- Mis Tareas -->
              <a *ngIf="hasPermission('tareas.ver')" routerLink="/herramientas/mis-tareas" routerLinkActive="text-rose-600 dark:text-rose-400 font-semibold [&_.nav-icon]:!text-rose-500 dark:[&_.nav-icon]:!text-rose-400 bg-rose-500/10 dark:bg-rose-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Mis Tareas">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Mis Tareas</span>
              </a>

              <!-- Territorios Accordion -->
              <div *ngIf="hasPermission('territorios.ver')" class="relative mt-1">
                <button (click)="toggleTerritoriosMenu()"
                  class="w-full group flex items-center justify-between text-sm transition-all duration-200 relative rounded-lg"
                  [ngClass]="{
                    'p-3': collapsed(),
                    'px-3 py-2.5': !collapsed(),
                    'text-brand-green dark:text-green-300 font-semibold bg-brand-green/10 dark:bg-green-500/[0.13] nav-active': isTerritoriosActive(),
                    'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]': !isTerritoriosActive()
                  }" title="Territorios">
                  <div class="flex items-center" [ngClass]="{ 'justify-center w-full': collapsed(), 'gap-3': !collapsed() }">
                    <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 group-hover:-translate-y-[1px]"
                         [ngClass]="isTerritoriosActive() ? '!text-brand-green dark:!text-green-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
                    </div>
                    <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Territorios</span>
                  </div>
                  <svg *ngIf="!collapsed()" class="w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]" [ngClass]="{ 'rotate-180': territoriosMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>

                <!-- Submenu -->
                <div *ngIf="!collapsed() && territoriosMenuOpen()" class="relative mt-1 ml-4 pl-3 pr-1 space-y-0.5 reuniones-submenu border-l border-slate-200 dark:border-slate-800">
                  <a routerLink="/territorios" routerLinkActive="sub-active" #rlaTerr="routerLinkActive" [routerLinkActiveOptions]="{exact: true}"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaTerr.isActive ? '!text-brand-green dark:!text-green-400 font-medium bg-brand-green/[0.03] dark:bg-green-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaTerr.isActive ? 'bg-brand-green dark:bg-green-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Congregación</span>
                  </a>
                  <a routerLink="/horarios" routerLinkActive="sub-active" #rlaHor="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaHor.isActive ? '!text-brand-green dark:!text-green-400 font-medium bg-brand-green/[0.03] dark:bg-green-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaHor.isActive ? 'bg-brand-green dark:bg-green-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Horarios</span>
                  </a>
                  <a routerLink="/seguimiento-predicacion" routerLinkActive="sub-active" #rlaPred="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaPred.isActive ? '!text-brand-green dark:!text-green-400 font-medium bg-brand-green/[0.03] dark:bg-green-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaPred.isActive ? 'bg-brand-green dark:bg-green-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Predicación</span>
                  </a>
                </div>
              </div>

              <!-- Reportes Accordion -->
              <div *ngIf="hasAnyReportesPermission()" class="relative mt-1">
                <button (click)="toggleReportesMenu()"
                  class="w-full group flex items-center justify-between text-sm transition-all duration-200 relative rounded-lg"
                  [ngClass]="{
                    'p-3': collapsed(),
                    'px-3 py-2.5': !collapsed(),
                    'text-brand-blue dark:text-blue-300 font-semibold bg-brand-blue/10 dark:bg-blue-500/[0.13] nav-active': isReportesActive(),
                    'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]': !isReportesActive()
                  }" title="Reportes">
                  <div class="flex items-center" [ngClass]="{ 'justify-center w-full': collapsed(), 'gap-3': !collapsed() }">
                    <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 group-hover:-translate-y-[1px]"
                         [ngClass]="isReportesActive() ? '!text-brand-blue dark:!text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 3v18h18M7 15l4-4 4 4 6-6" /></svg>
                    </div>
                    <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Reportes</span>
                  </div>
                  <svg *ngIf="!collapsed()" class="w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]" [ngClass]="{ 'rotate-180': reportesMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>

                <!-- Submenu -->
                <div *ngIf="!collapsed() && reportesMenuOpen()" class="relative mt-1 ml-4 pl-3 pr-1 space-y-0.5 reuniones-submenu border-l border-slate-200 dark:border-slate-800">
                  <a *ngIf="hasPermission('reportes.precursores')" routerLink="/reportes/precursores" routerLinkActive="sub-active" #rlaRepPrec="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaRepPrec.isActive ? '!text-brand-blue dark:!text-blue-400 font-medium bg-brand-blue/[0.03] dark:bg-blue-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaRepPrec.isActive ? 'bg-brand-blue dark:bg-blue-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Precursores</span>
                  </a>
                  <a *ngIf="hasPermission('reportes.publicadores')" routerLink="/reportes/publicadores" routerLinkActive="sub-active" #rlaRepPub="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaRepPub.isActive ? '!text-brand-blue dark:!text-blue-400 font-medium bg-brand-blue/[0.03] dark:bg-blue-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaRepPub.isActive ? 'bg-brand-blue dark:bg-blue-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Publicadores</span>
                  </a>
                  <a *ngIf="hasPermission('reportes.predicacion')" routerLink="/reportes/predicacion" routerLinkActive="sub-active" #rlaRepPred="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-[0.8125rem] transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaRepPred.isActive ? '!text-brand-blue dark:!text-blue-400 font-medium bg-brand-blue/[0.03] dark:bg-blue-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaRepPred.isActive ? 'bg-brand-blue dark:bg-blue-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Predicación</span>
                  </a>
                </div>
              </div>

              <!-- Exhibidores -->
              <a *ngIf="hasPermission('exhibidores.ver')" routerLink="/exhibidores" routerLinkActive="text-brand-blue dark:text-blue-300 font-semibold [&_.nav-icon]:!text-brand-blue dark:[&_.nav-icon]:!text-blue-400 bg-brand-blue/10 dark:bg-blue-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Exhibidores">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Exhibidores</span>
              </a>
            </div>

            <!-- Extras Section -->
            <div *ngIf="hasPermission('configuracion.ver') || hasRole('Secretario') || hasRole('Coordinador') || hasRole('Administrador')" class="mt-4">
              <div class="h-px bg-slate-100 dark:bg-slate-800/60 mx-2 mb-4"></div>
              <p *ngIf="!collapsed()" class="px-3 mb-2 text-[0.6875rem] font-bold tracking-[0.08em] uppercase text-slate-400/70 dark:text-slate-600">Extras</p>
              
              <!-- Configuracion Normal -->
              <a *ngIf="!hasRole('Administrador') && (hasPermission('configuracion.ver') || hasRole('Secretario') || hasRole('Coordinador'))" routerLink="/configuracion" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Configuración">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Configuración</span>
              </a>

              <!-- Configuracion Admin -->
              <a *ngIf="hasRole('Administrador')" routerLink="/admin/configuracion" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Configuración del Sistema">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-[0.875rem]">Configuración</span>
              </a>
            </div>
          </nav>
        </div>

        <!-- Sidebar Footer Action Block (Notifs, Config, User Profile) -->
        <div class="sidebar-footer shrink-0 flex flex-col p-3 border-t border-gray-100 dark:border-white/5 divide-y divide-slate-100 dark:divide-slate-800">
           
           <!-- Action Row: Theme & Notifications (solo desktop) -->
           <div class="hidden lg:grid gap-1 pb-2 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl p-1 border border-slate-100/80 dark:border-white/[0.05]" [ngClass]="collapsed() ? 'grid-cols-1' : 'grid-cols-2'">
             <button
                class="flex items-center justify-center p-2.5 min-h-[44px] rounded-lg transition-all w-full"
                [ngClass]="collapsed() ? 'hover:bg-amber-100 dark:hover:bg-amber-900/30 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400' : 'flex-1 hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
                (click)="toggleTheme()" title="Cambiar tema">
                 <svg *ngIf="!themeService.darkMode()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                 <svg *ngIf="themeService.darkMode()" class="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
             </button>

             <div class="relative w-full flex">
               <button
                 id="notif-button"
                 class="flex items-center justify-center p-2.5 min-h-[44px] rounded-lg transition-all w-full relative group"
                 [ngClass]="notifService.count() > 0 ? 'bg-brand-purple/10 dark:bg-purple-500/[0.13] text-brand-purple dark:text-purple-400 hover:bg-brand-purple/20 dark:hover:bg-purple-500/20' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
                 (click)="toggleNotifications()" title="Notificaciones">
                 <svg class="w-5 h-5 relative z-10 transition-transform" [ngClass]="{'animate-[bellShake_0.6s_ease-in-out_infinite_3s]': notifService.count() > 0}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                 </svg>
                 <div *ngIf="notifService.count() > 0" class="absolute top-1.5 right-1.5 sm:top-1 sm:right-1 z-20 transition-opacity duration-300">
                    <span class="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40"></span>
                    <span class="relative flex items-center justify-center min-w-[16px] h-[16px] px-0.5 bg-gradient-to-br from-red-500 to-rose-600 text-white text-[0.55rem] font-extrabold rounded-full shadow-sm">
                      {{ notifService.count() > 99 ? '99+' : notifService.count() }}
                    </span>
                 </div>
               </button>
               
               <!-- Dropdown Panel Notifications (upwards cuando expandido, a la derecha cuando colapsado) -->
               <div *ngIf="notificationsOpen()"
                 id="notif-panel"
                 class="hidden lg:block absolute bg-white dark:bg-slate-900 rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-slate-200/60 dark:border-slate-700/60 z-50 overflow-hidden animate-fadeIn pb-1"
                 [ngClass]="collapsed() ? 'w-[300px] left-[calc(100%+12px)] bottom-0' : 'w-[248px] bottom-[calc(100%+8px)] right-0'">
                 <div class="px-3 py-2 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                   <div class="flex items-center gap-2">
                     <h3 class="font-bold text-slate-800 dark:text-white text-xs">Notificaciones</h3>
                     <span *ngIf="notifService.count() > 0" class="text-[0.6rem] font-bold text-brand-purple dark:text-purple-400 bg-brand-purple/10 px-1.5 py-0.5 rounded">
                       {{ notifService.count() }}
                     </span>
                   </div>
                   <button *ngIf="notifService.count() > 0" (click)="marcarTodasLeidas()" class="text-[0.65rem] text-slate-400 hover:text-brand-purple">Marcar leídas</button>
                 </div>
                 <div class="max-h-[min(300px,45vh)] overflow-y-auto overscroll-contain custom-scrollbar divide-y divide-slate-50 dark:divide-slate-800/50">
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
           <div *ngIf="hasRole('Administrador')" class="relative py-2">
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
           <div *ngIf="user() as u" class="relative pt-2">
              <div *ngIf="userMenuOpen()" class="fixed inset-0 z-40" (click)="userMenuOpen.set(false)"></div>
              <button 
                id="user-menu-button"
                class="flex items-center w-full p-2 min-h-[44px] rounded-xl transition-all bg-slate-50/80 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-slate-100/80 dark:border-white/5 hover:border-slate-200 dark:hover:border-slate-700 group focus:outline-none"
                [ngClass]="collapsed() ? 'justify-center' : 'justify-between'"
                (click)="toggleUserMenu()"
                title="Menú de Usuario"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-[#4C1D95] dark:from-purple-600 dark:to-indigo-900 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-inner [text-shadow:_0_1px_2px_rgb(0_0_0_/_40%)] group-hover:scale-110 transition-transform duration-200 ease-out">
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

      <!-- Tooltip flotante del sidebar colapsado (position: fixed → nunca lo recorta el scroll del nav) -->
      <div *ngIf="navTooltip() as tip"
           class="hidden lg:block fixed -translate-y-1/2 px-2.5 py-1.5 text-xs font-semibold bg-slate-900 dark:bg-slate-700 text-white rounded-lg whitespace-nowrap shadow-lg pointer-events-none z-[70] animate-fadeIn"
           [style.top.px]="tip.top" [style.left.px]="tip.left">
        {{ tip.text }}
      </div>

      <!-- Main Content Area -->
      <div 
        class="flex-1 flex flex-col min-w-0 h-screen transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)] print:!ml-0 print:!h-auto print:!overflow-visible" 
        [ngClass]="{
          'lg:ml-[292px]': !collapsed(),
          'lg:ml-[92px]': collapsed()
        }"
      >
        
        <!-- Mobile Top Navbar (Sólo en dispositivos pequeños lg:hidden) -->
        <header class="print:hidden lg:hidden h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md flex items-center justify-between px-4 border-b border-gray-100 dark:border-white/5 sticky top-0 z-30">
          <div class="flex items-center gap-3">
            <button class="w-10 h-10 -ml-1 flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-95 transition-all" (click)="openMobileMenu()">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <span class="font-bold text-slate-800 dark:text-white text-sm tracking-tight truncate">{{ pageTitle().title }}</span>
          </div>
          
          <!-- Quick action mobile (Theme + Notifications + User profile popup) -->
          <div class="flex items-center gap-2 relative" *ngIf="user() as u">
             <!-- Tema móvil -->
             <button
               class="w-10 h-10 flex items-center justify-center rounded-full transition-all active:scale-95 text-slate-500 dark:text-slate-400"
               (click)="toggleTheme()" title="Cambiar tema">
               <svg *ngIf="!themeService.darkMode()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
               </svg>
               <svg *ngIf="themeService.darkMode()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
               </svg>
             </button>

             <!-- Notificaciones móvil -->
             <div class="relative lg:hidden">
               <button
                 id="mobile-notif-button"
                 class="w-10 h-10 flex items-center justify-center rounded-full relative transition-all active:scale-95"
                 [ngClass]="notifService.count() > 0 ? 'text-[#6d28d9] dark:text-purple-400' : 'text-slate-500 dark:text-slate-400'"
                 (click)="toggleNotifications()" title="Notificaciones">
                 <svg class="w-5 h-5" [ngClass]="{'animate-[bellShake_0.6s_ease-in-out_infinite_3s]': notifService.count() > 0}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                 </svg>
                 <div *ngIf="notifService.count() > 0" class="absolute top-0 right-0 z-20">
                   <span class="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40"></span>
                   <span class="relative flex items-center justify-center min-w-[14px] h-[14px] px-0.5 bg-gradient-to-br from-red-500 to-rose-600 text-white text-[0.5rem] font-extrabold rounded-full shadow-sm">
                     {{ notifService.count() > 99 ? '99+' : notifService.count() }}
                   </span>
                 </div>
               </button>

               <!-- Panel notificaciones móvil (hacia abajo, alineado a la derecha) -->
               <div *ngIf="notificationsOpen()"
                    id="mobile-notif-panel"
                    class="fixed z-50 animate-fadeIn"
                    style="top: 64px; right: 8px; left: 8px;"
                    (mouseenter)="startNotifAutoClose()"
                    (touchstart)="startNotifAutoClose()">
                 <div class="bg-white dark:bg-slate-900 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] border border-slate-200/60 dark:border-slate-700/60 overflow-hidden pb-1">
                   <div class="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
                     <div class="flex items-center gap-2">
                       <h3 class="font-bold text-slate-800 dark:text-white text-sm">Notificaciones</h3>
                       <span *ngIf="notifService.count() > 0" class="text-[0.6rem] font-bold text-[#6d28d9] dark:text-purple-400 bg-[#6d28d9]/10 px-1.5 py-0.5 rounded">
                         {{ notifService.count() }}
                       </span>
                     </div>
                     <div class="flex items-center gap-3">
                       <button *ngIf="notifService.count() > 0" (click)="marcarTodasLeidas()" class="text-[0.65rem] text-slate-400 hover:text-[#6d28d9]">Marcar leídas</button>
                       <button (click)="closeNotifications()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                         <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                           <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
                         </svg>
                       </button>
                     </div>
                   </div>
                   <div class="max-h-[60vh] overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/50">
                     <div *ngFor="let n of notifService.notificaciones()"
                          class="flex items-start gap-3 px-4 py-3 cursor-pointer relative"
                          [ngClass]="!n.leida ? 'bg-[#6d28d9]/[0.03] hover:bg-[#6d28d9]/[0.06]' : 'hover:bg-slate-50 dark:hover:bg-slate-800'"
                          (click)="onNotificacionClick(n)">
                       <div *ngIf="!n.leida" class="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-md bg-[#6d28d9]"></div>
                       <div class="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center" [ngClass]="getNotifIconBg(n.tipo)">
                         <svg *ngIf="n.tipo === 'solicitud_acceso'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                         </svg>
                         <svg *ngIf="n.tipo !== 'solicitud_acceso'" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                         </svg>
                       </div>
                       <div class="flex-1 min-w-0">
                         <p class="text-sm leading-tight" [ngClass]="!n.leida ? 'font-semibold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-300'">{{ n.titulo }}</p>
                         <p class="text-xs text-slate-400 mt-0.5 leading-snug">{{ n.mensaje }}</p>
                         <p class="text-[0.65rem] text-slate-400/70 mt-1">{{ n.creado_en | timeAgo }}</p>
                       </div>
                     </div>
                     <div *ngIf="notifService.notificaciones().length === 0" class="py-10 text-center">
                       <svg class="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                         <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                       </svg>
                       <p class="text-sm text-slate-400">Estás al día</p>
                     </div>
                   </div>
                 </div>
               </div>
             </div>

             <div *ngIf="mobileUserMenuOpen()" class="fixed inset-0 z-40" (click)="mobileUserMenuOpen.set(false)"></div>
             <!-- Avatar button -->
             <button
                id="mobile-user-menu-button"
                class="w-10 h-10 rounded-full bg-gradient-to-br from-brand-purple to-[#4C1D95] dark:from-purple-600 dark:to-indigo-900 flex items-center justify-center text-white text-sm font-bold shadow-inner [text-shadow:_0_1px_2px_rgb(0_0_0_/_40%)] transition-all active:scale-95 focus:outline-none"
                (click)="toggleMobileUserMenu()"
                title="Menú de Usuario"
             >
                {{ (u.nombre || u.username || 'U').charAt(0).toUpperCase() }}
             </button>

             <!-- Mobile User Menu Popup (downwards) -->
             <div *ngIf="mobileUserMenuOpen()"
                  id="mobile-user-menu-panel"
                  class="absolute top-[calc(100%+8px)] right-0 w-[260px] bg-white dark:bg-slate-900 rounded-2xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] dark:shadow-black/60 ring-1 ring-slate-200 dark:ring-slate-800 z-50 overflow-hidden animate-fadeIn origin-top-right pb-1">

                <!-- Header -->
                <div class="px-4 py-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
                  <div class="w-12 h-12 rounded-full bg-gradient-to-br from-brand-purple to-[#4C1D95] dark:from-purple-600 dark:to-indigo-900 flex items-center justify-center text-white text-lg font-bold shrink-0 shadow-inner">
                    {{ (u.nombre || u.username || 'U').charAt(0).toUpperCase() }}
                  </div>
                  <div class="flex flex-col min-w-0">
                    <span class="text-sm font-bold text-slate-800 dark:text-white truncate">{{ u.nombre || u.username }}</span>
                    <span class="text-[0.65rem] text-slate-500 truncate">{{ u.correo }}</span>
                  </div>
                </div>

                <!-- Mi perfil -->
                <div class="p-1.5 space-y-0.5 mt-1">
                  <button (click)="editProfile()" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[0.8125rem] font-medium transition-colors">
                    <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Mi perfil
                  </button>
                </div>

                <!-- Separador -->
                <div class="px-3 py-1.5">
                  <div class="h-px w-full bg-slate-100 dark:bg-slate-800"></div>
                </div>

                <!-- Cerrar sesión -->
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

    <!-- Delete Group Modal — rendered at shell root so fixed positioning escapes all overflow/stacking contexts -->
    @if (modalBackdropService.deleteGroup(); as modal) {
      <!-- Backdrop -->
      <div class="delete-modal-backdrop" (click)="modal.isDeleting ? null : modalBackdropService.cancel()"></div>

      <!-- Card wrapper (pointer-events-none so backdrop clicks pass through) -->
      <div class="delete-modal-positioner" role="dialog" aria-modal="true" aria-labelledby="del-modal-title">
        <div class="delete-modal-card" (click)="$event.stopPropagation()">

          <!-- Header -->
          <div class="delete-modal-header">
            <div class="delete-modal-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
            </div>
            <div class="delete-modal-header-text">
              <p id="del-modal-title" class="delete-modal-title">Eliminar Grupo</p>
              <p class="delete-modal-subtitle">Esta acción no se puede deshacer.</p>
            </div>
          </div>

          <!-- Divider -->
          <div class="delete-modal-divider"></div>

          <!-- Body -->
          <div class="delete-modal-body">
            <p class="delete-modal-label">Grupo a eliminar</p>
            <div class="delete-modal-group-row">
              <div class="delete-modal-group-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
              </div>
              <span class="delete-modal-group-name">{{ modal.groupName }}</span>
            </div>
          </div>

          <!-- Actions -->
          <div class="delete-modal-actions">
            <button class="delete-modal-btn-cancel"
              (click)="modalBackdropService.cancel()"
              [disabled]="modal.isDeleting">
              Cancelar
            </button>
            <button class="delete-modal-btn-confirm"
              (click)="modalBackdropService.confirm()"
              [disabled]="modal.isDeleting">
              @if (modal.isDeleting) {
                <svg class="delete-modal-spinner" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="32" stroke-dashoffset="32" stroke-linecap="round"/>
                </svg>
                Eliminando…
              } @else {
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
                Sí, eliminar
              }
            </button>
          </div>

        </div>
      </div>
    }

    <!-- Design System v2 — Globales -->
    <app-toast-container></app-toast-container>
    <app-command-palette></app-command-palette>
  `,
  styles: [`
    :host {
      display: block;
    }
    /* ── Delete Group Modal ── */
    @keyframes del-overlay-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes del-card-in {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to   { opacity: 1; transform: scale(1)    translateY(0); }
    }
    @keyframes del-spin {
      to { stroke-dashoffset: -32; }
    }

    .delete-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: rgba(0, 0, 0, 0.55);
      backdrop-filter: blur(7px);
      -webkit-backdrop-filter: blur(7px);
      animation: del-overlay-in 200ms ease both;
    }
    .delete-modal-positioner {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      pointer-events: none;
    }
    .delete-modal-card {
      pointer-events: all;
      width: 100%;
      max-width: 400px;
      border-radius: 20px;
      overflow: hidden;
      background: #ffffff;
      border: 1px solid rgba(0, 0, 0, 0.07);
      box-shadow:
        0 0 0 1px rgba(0,0,0,0.03),
        0 8px 24px rgba(0,0,0,0.08),
        0 32px 64px rgba(0,0,0,0.13);
      animation: del-card-in 260ms cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    /* Dark mode */
    :host-context(.dark) .delete-modal-card {
      background: #161b27;
      border-color: rgba(255,255,255,0.07);
      box-shadow:
        0 0 0 1px rgba(255,255,255,0.04),
        0 8px 24px rgba(0,0,0,0.35),
        0 32px 64px rgba(0,0,0,0.6);
    }

    /* Header */
    .delete-modal-header {
      display: flex;
      align-items: flex-start;
      gap: 0.875rem;
      padding: 1.375rem 1.375rem 0;
    }
    .delete-modal-icon {
      flex-shrink: 0;
      width: 44px; height: 44px;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(239, 68, 68, 0.09);
      border: 1px solid rgba(239, 68, 68, 0.2);
    }
    .delete-modal-icon svg {
      width: 21px; height: 21px;
      stroke: #dc2626;
    }
    :host-context(.dark) .delete-modal-icon {
      background: rgba(239, 68, 68, 0.07);
      border-color: rgba(239, 68, 68, 0.18);
    }
    :host-context(.dark) .delete-modal-icon svg { stroke: #f87171; }

    .delete-modal-header-text {
      display: flex; flex-direction: column; gap: 3px; padding-top: 2px;
    }
    .delete-modal-title {
      font-family: 'Urbanist', sans-serif;
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
      line-height: 1.2;
    }
    :host-context(.dark) .delete-modal-title { color: #f1f5f9; }

    .delete-modal-subtitle {
      font-size: 0.775rem;
      font-weight: 500;
      color: #94a3b8;
    }

    /* Divider */
    .delete-modal-divider {
      height: 1px;
      background: rgba(0,0,0,0.06);
      margin: 1.125rem 0 0;
    }
    :host-context(.dark) .delete-modal-divider { background: rgba(255,255,255,0.06); }

    /* Body */
    .delete-modal-body {
      padding: 1.125rem 1.375rem;
      display: flex; flex-direction: column; gap: 0.625rem;
    }
    .delete-modal-label {
      font-size: 0.675rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
    }
    :host-context(.dark) .delete-modal-label { color: #64748b; }

    .delete-modal-group-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 0.875rem;
      border-radius: 12px;
      background: rgba(0,0,0,0.025);
      border: 1px solid rgba(0,0,0,0.05);
    }
    :host-context(.dark) .delete-modal-group-row {
      background: rgba(255,255,255,0.03);
      border-color: rgba(255,255,255,0.07);
    }
    .delete-modal-group-icon {
      flex-shrink: 0;
      width: 34px; height: 34px;
      border-radius: 9px;
      display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.04);
      border: 1px solid rgba(0,0,0,0.06);
    }
    :host-context(.dark) .delete-modal-group-icon {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.08);
    }
    .delete-modal-group-icon svg {
      width: 17px; height: 17px;
      stroke: #64748b;
    }
    :host-context(.dark) .delete-modal-group-icon svg { stroke: #94a3b8; }

    .delete-modal-group-name {
      font-family: 'Urbanist', sans-serif;
      font-size: 0.9rem;
      font-weight: 700;
      color: #1e293b;
      letter-spacing: -0.01em;
    }
    :host-context(.dark) .delete-modal-group-name { color: #e2e8f0; }

    /* Actions */
    .delete-modal-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
      padding: 0.875rem 1.375rem 1.375rem;
      border-top: 1px solid rgba(0,0,0,0.05);
    }
    :host-context(.dark) .delete-modal-actions { border-top-color: rgba(255,255,255,0.05); }

    .delete-modal-btn-cancel,
    .delete-modal-btn-confirm {
      height: 40px;
      padding: 0 1.25rem;
      border-radius: 11px;
      font-size: 0.825rem;
      font-weight: 700;
      cursor: pointer;
      transition: all 130ms cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid transparent;
      white-space: nowrap;
      display: flex; align-items: center; gap: 0.4rem;
    }
    .delete-modal-btn-cancel:active,
    .delete-modal-btn-confirm:active { transform: scale(0.96); }
    .delete-modal-btn-cancel:disabled,
    .delete-modal-btn-confirm:disabled { opacity: 0.55; cursor: not-allowed; }

    .delete-modal-btn-cancel {
      background: rgba(0,0,0,0.04);
      border-color: rgba(0,0,0,0.08);
      color: #475569;
    }
    .delete-modal-btn-cancel:hover:not(:disabled) { background: rgba(0,0,0,0.07); }
    :host-context(.dark) .delete-modal-btn-cancel {
      background: rgba(255,255,255,0.05);
      border-color: rgba(255,255,255,0.09);
      color: #94a3b8;
    }
    :host-context(.dark) .delete-modal-btn-cancel:hover:not(:disabled) { background: rgba(255,255,255,0.09); }

    .delete-modal-btn-confirm {
      background: #dc2626;
      color: #fff;
      box-shadow: 0 2px 10px rgba(220,38,38,0.3), 0 1px 3px rgba(220,38,38,0.18);
    }
    .delete-modal-btn-confirm svg { width: 15px; height: 15px; stroke: #fff; }
    .delete-modal-btn-confirm:hover:not(:disabled) {
      background: #b91c1c;
      box-shadow: 0 4px 16px rgba(220,38,38,0.4), 0 2px 6px rgba(220,38,38,0.22);
    }

    /* Spinner */
    .delete-modal-spinner {
      width: 15px; height: 15px;
      animation: del-spin 0.7s linear infinite;
    }

    /* ── Submenu bullet ring — uses Tailwind ring-2 ring-white dark:ring-slate-900 inline ── */

    /* ── Sidebar colapsado: los tooltips ya NO dependen de overflow:visible
       (se renderizan con position:fixed fuera del contenedor), así el nav
       siempre puede encoger y hacer scroll sin empujar el footer fuera. ── */

    /* ── Pantallas de poca altura (MacBook 14", 13", ventanas reducidas):
       densificamos el sidebar para que el nav no quede sin aire y el bloque
       inferior (tema / notificaciones / perfil) siga completo dentro. ── */
    @media (min-width: 1024px) and (max-height: 900px) {
      aside .sidebar-nav { padding-top: 0.875rem; padding-bottom: 0.875rem; }
      aside .sidebar-nav nav > div { margin-bottom: 1rem; }
      aside .sidebar-nav nav > div > .h-px { margin-bottom: 0.75rem; margin-top: 0.25rem; }
      aside .sidebar-footer { padding: 0.5rem; }
    }
    @media (min-width: 1024px) and (max-height: 720px) {
      aside .sidebar-nav { padding-top: 0.5rem; padding-bottom: 0.5rem; }
      aside .sidebar-nav nav > div { margin-bottom: 0.625rem; }
      aside .sidebar-footer .min-h-\\[44px\\] { min-height: 38px; padding-top: 0.375rem; padding-bottom: 0.375rem; }
    }


    /* ── Ensure routed components fill the available space ── */
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
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes submenuItemFade {
      from { opacity: 0; transform: translateX(-6px); }
      to   { opacity: 1; transform: translateX(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
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
  modalBackdropService = inject(ModalBackdropService);
  private visitaService = inject(VisitaService);

  /** true si el usuario fue invitado como colaborador en alguna visita del SC
      — controla la visibilidad del ítem "Visita del circuito" en Herramientas. */
  hasColaboraciones = signal(false);

  collapsed = signal(false);
  mobileMenuOpen = signal(false);
  userMenuOpen = signal(false);
  mobileUserMenuOpen = signal(false);
  notificationsOpen = signal(false);
  private notifAutoCloseTimer: ReturnType<typeof setTimeout> | null = null;
  congregacionDropdownOpen = signal(false);
  congregacionesList = signal<{ id_congregacion: number; nombre_congregacion: string }[]>([]);
  reunionesMenuOpen = signal(false);
  territoriosMenuOpen = signal(false);
  reportesMenuOpen = signal(false);
  secretarioToolsMenuOpen = signal(false);
  herramientasMenuOpen = signal(false);

  // New Signals & Props
  // darkMode = signal(false); // Removed local signal
  // Page Title State
  pageTitle = signal<{ title: string, subtitle: string }>({ title: 'Sistema GAC', subtitle: 'Panel de Administración' });

  // notificationCount ahora viene de notifService.count()
  @ViewChild('searchInput') searchInput!: ElementRef;

  /** Tooltip del sidebar colapsado. Se posiciona con position:fixed sobre el
      viewport, de modo que el contenedor del nav puede seguir con scroll propio
      sin recortarlo (antes se forzaba overflow:visible y el nav dejaba de
      encoger, empujando el bloque inferior fuera del sidebar). */
  navTooltip = signal<{ text: string; top: number; left: number } | null>(null);

  onNavHover(event: MouseEvent) {
    if (!this.collapsed()) { this.navTooltip.set(null); return; }
    const el = (event.target as HTMLElement | null)?.closest('a[title], button[title]') as HTMLElement | null;
    if (!el) { this.navTooltip.set(null); return; }
    const text = el.getAttribute('title');
    if (!text) { this.navTooltip.set(null); return; }
    const rect = el.getBoundingClientRect();
    const aside = el.closest('aside')?.getBoundingClientRect();
    this.navTooltip.set({
      text,
      top: rect.top + rect.height / 2,
      left: (aside?.right ?? rect.right) + 10,
    });
  }

  hideNavTooltip() {
    if (this.navTooltip()) this.navTooltip.set(null);
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.hideNavTooltip();
  }

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
      if (this.notificationsOpen() && target) {
        // El panel vive dentro del <aside> transformado, así que un backdrop
        // fixed no cubre el resto de la pantalla: se cierra por click global.
        const inside = ['notif-button', 'notif-panel', 'mobile-notif-button', 'mobile-notif-panel']
          .some(id => document.getElementById(id)?.contains(target));
        if (!inside) {
          this.closeNotifications();
        }
      }
    } catch (err) { }
  };

  user = computed(() => this.store.user());
  mustChangePassword = computed(() => this.store.user()?.debe_cambiar_contrasena === true);

  router = inject(Router); // Re-injecting Router as it might be missing or private

  ngOnInit(): void {
    document.addEventListener('click', this.outsideClickHandler);
    
    // Conectar SSE para notificaciones en tiempo real
    this.notifService.connectSSE();

    // ¿El usuario colabora en alguna visita del SC? (ítem del menú Herramientas)
    this.visitaService.misColaboraciones().subscribe({
      next: (vs) => this.hasColaboraciones.set(vs.length > 0),
      error: () => {},
    });

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
    if (this.isSecretarioToolsActive()) {
      this.secretarioToolsMenuOpen.set(true);
    }
    if (this.isHerramientasActive()) {
      this.herramientasMenuOpen.set(true);
    }

    // Listen to route changes
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.updateTitle(event.urlAfterRedirects);
        this.closeMobileMenu();
        this.closeNotifications();
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
        if (event.urlAfterRedirects.startsWith('/secretario-tools')) {
          this.secretarioToolsMenuOpen.set(true);
        }
        if (event.urlAfterRedirects.startsWith('/herramientas')) {
          this.herramientasMenuOpen.set(true);
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
    } else if (url.includes('/reuniones/programacion') || url.includes('/reuniones/entre-semana') || url.includes('/reuniones/fin-semana')) {
      this.pageTitle.set({ title: 'Programación de Reuniones', subtitle: 'Programa y asignaciones por congregación.' });
    } else if (url.includes('/reuniones/asistencia')) {
      this.pageTitle.set({ title: 'Asistencia', subtitle: 'Registro y seguimiento de asistencia semanal.' });
    } else if (url.includes('/reuniones/configuracion')) {
      this.pageTitle.set({ title: 'Configuración de Reuniones', subtitle: 'Asignación de privilegios, plantillas y parámetros del motor.' });
    } else if (url.includes('/reuniones')) {
      this.pageTitle.set({ title: 'Reuniones', subtitle: 'Resumen general de reuniones.' });
    } else if (url.includes('/reportes/precursores')) {
      this.pageTitle.set({ title: 'Análisis Precursores', subtitle: 'Panorama general de precursores activos.' });
    } else if (url.includes('/reportes/publicadores')) {
      this.pageTitle.set({ title: 'Análisis Publicadores', subtitle: 'Distribución demográfica y por grupo.' });
    } else if (url.includes('/reportes/predicacion')) {
      this.pageTitle.set({ title: 'Análisis Predicación', subtitle: 'Resumen de informes de servicio.' });
    } else if (url.includes('/reportes')) {
      this.pageTitle.set({ title: 'Reportes', subtitle: 'Análisis e indicadores de la congregación.' });
    } else if (url.includes('/secretario-tools/visita-superintendente')) {
      this.pageTitle.set({ title: 'Visita del Superintendente', subtitle: 'Documentos y agenda para la visita del SC.' });
    } else if (url.includes('/secretario-tools/actas-reunion')) {
      this.pageTitle.set({ title: 'Actas de Reunión', subtitle: 'Toma notas y redacta actas con asistencia de IA.' });
    } else if (url.includes('/secretario-tools/transferencias')) {
      this.pageTitle.set({ title: 'Transferencias', subtitle: 'Paquete completo para transferencia de publicadores.' });
    } else if (url.includes('/herramientas/mis-tareas')) {
      this.pageTitle.set({ title: 'Mis Tareas', subtitle: 'Asignaciones y recordatorios personales.' });
    } else if (url.includes('/herramientas/visita-colaborador')) {
      this.pageTitle.set({ title: 'Visita del circuito', subtitle: 'Completa la agenda y sube tus documentos.' });
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

  toggleReportesMenu() {
    this.reportesMenuOpen.update(v => !v);
  }

  isReportesActive(): boolean {
    return this.router.url.startsWith('/reportes');
  }

  toggleSecretarioToolsMenu() {
    this.secretarioToolsMenuOpen.update(v => !v);
  }

  isSecretarioToolsActive(): boolean {
    return this.router.url.startsWith('/secretario-tools');
  }

  toggleHerramientasMenu() {
    this.herramientasMenuOpen.update(v => !v);
  }

  isHerramientasActive(): boolean {
    return this.router.url.startsWith('/herramientas');
  }

  hasAnyReunionesPermission(): boolean {
    return (
      this.hasPermission('reuniones.ver') ||
      this.hasPermission('reuniones.entre_semana') ||
      this.hasPermission('reuniones.fin_semana') ||
      this.hasPermission('reuniones.logistica') ||
      this.hasPermission('reuniones.discursos') ||
      this.hasPermission('reuniones.asistencia') ||
      this.hasPermission('reuniones.configuracion') ||
      (this.store.user()?.roles?.includes('Secretario') ?? false)
    );
  }

  hasAnyReportesPermission(): boolean {
    return (
      this.hasPermission('reportes.ver') ||
      this.hasPermission('reportes.precursores') ||
      this.hasPermission('reportes.publicadores') ||
      this.hasPermission('reportes.predicacion')
    );
  }

  toggleSidebar() {
    this.collapsed.update(v => !v);
    this.hideNavTooltip();
  }

  openMobileMenu() { this.mobileMenuOpen.set(true); }
  closeMobileMenu() { this.mobileMenuOpen.set(false); }

  toggleUserMenu() { this.userMenuOpen.update(v => !v); }
  toggleMobileUserMenu() { this.mobileUserMenuOpen.update(v => !v); }
  toggleNotifications() {
    const next = !this.notificationsOpen();
    this.notificationsOpen.set(next);
    if (next) {
      this.startNotifAutoClose();
    } else {
      this.clearNotifAutoClose();
    }
  }

  startNotifAutoClose() {
    this.clearNotifAutoClose();
    this.notifAutoCloseTimer = setTimeout(() => {
      this.notificationsOpen.set(false);
    }, 8000);
  }

  private clearNotifAutoClose() {
    if (this.notifAutoCloseTimer) {
      clearTimeout(this.notifAutoCloseTimer);
      this.notifAutoCloseTimer = null;
    }
  }

  closeNotifications() {
    this.notificationsOpen.set(false);
    this.clearNotifAutoClose();
  }

  onNotificacionClick(n: Notificacion) {
    if (!n.leida) {
      this.notifService.marcarLeida(n.id_notificacion).subscribe();
    }
    if (n.tipo === 'solicitud_acceso') {
      this.notificationsOpen.set(false);
      this.router.navigate(['/admin/configuracion'], { queryParams: { tab: 'solicitudes' } });
    } else if (n.tipo === 'tarea_asignada' && n.payload?.['id_tarea']) {
      this.notificationsOpen.set(false);
      this.router.navigate(
        ['/herramientas/tareas', n.payload['id_tarea']],
        { queryParams: { desde: 'mis-tareas' } }
      );
    } else if (n.tipo === 'visita_colaborador') {
      this.hasColaboraciones.set(true);
      this.notificationsOpen.set(false);
      this.router.navigate(['/herramientas/visita-colaborador']);
    } else if (n.tipo === 'transferencia_recibida') {
      this.notificationsOpen.set(false);
      this.router.navigate(['/secretario/publicadores']);
    }
  }

  marcarTodasLeidas() {
    this.notifService.marcarTodasLeidas().subscribe();
  }

  getNotifIconBg(tipo: string): string {
    switch (tipo) {
      case 'solicitud_acceso':    return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
      case 'usuario_activado':   return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400';
      case 'backup_completado':  return 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
      case 'tarea_asignada':     return 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400';
      case 'visita_colaborador': return 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400';
      case 'transferencia_recibida': return 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400';
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
