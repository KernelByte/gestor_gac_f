import { Component, computed, effect, untracked, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, HostListener, Pipe, PipeTransform } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthStore } from '../core/auth/auth.store';
import { etiquetaRol } from '../core/auth/rol-label';
import {
  puedeVerConfiguracion, puedeVerExhibidores, puedeVerInformes, puedeVerPublicadores,
  puedeVerReportes, puedeVerReuniones, puedeVerTerritorios,
  esSecretarioOAdmin, puedeVerActas, puedeVerAdministracion, puedeVerAgenda, puedeVerReunionesAncianos,
} from '../core/auth/acceso-modulos';
import { AuthService } from '../core/auth/auth.service';
import { ThemeService } from '../core/services/theme.service';
import { CongregacionContextService } from '../core/congregacion-context/congregacion-context.service';
import { NotificacionesService } from '../core/notificaciones/notificaciones.service';
import { Notificacion } from '../core/notificaciones/notificacion.model';
import { ForcePasswordChangeComponent } from '../core/components/force-password-change.component';
import { ForceTwoFactorComponent } from '../core/components/force-two-factor.component';
import { ModalBackdropService } from '../core/services/modal-backdrop.service';
import { ToastContainerComponent } from '../shared/components/toast/toast-container.component';
import { ConfirmDialogComponent } from '../shared/components/confirm-dialog/confirm-dialog.component';
import { ConfirmHostComponent } from '../shared/components/confirm-dialog/confirm-host.component';
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
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TimeAgoPipe, ForcePasswordChangeComponent, ForceTwoFactorComponent, ToastContainerComponent, ConfirmHostComponent, ConfirmDialogComponent, CommandPaletteComponent],
  template: `
    <div class="flex h-screen overflow-hidden bg-app-bg dark:bg-slate-950 transition-colors duration-300" [class.dark]="themeService.darkMode()">

      <!-- Cambio de Contraseña Obligatorio (Overlay) -->
      <app-force-password-change *ngIf="mustChangePassword()"></app-force-password-change>
      <app-force-two-factor *ngIf="!mustChangePassword() && mustEnableTwoFactor()"></app-force-two-factor>
      
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
            <img src="images/logo-gac-96.webp" alt="GAC" class="w-7 h-7 object-contain" width="28" height="28">
          </div>

          <!-- Expanded: brand left + chevron right -->
          <div *ngIf="!collapsed()" class="flex items-center justify-between w-full">
            <div class="flex items-center gap-2.5">
              <img src="images/logo-gac-96.webp" alt="GAC Logo"
                   class="w-8 h-8 object-contain shrink-0" width="32" height="32">
              <span class="font-display font-extrabold text-lg tracking-[-0.04em] text-[#a240e3] dark:text-white leading-none">
                GAC
              </span>
            </div>
            <svg class="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>

        <!-- Navigation (Scrollable) -->
        <div class="sidebar-nav flex-1 min-h-0 overflow-y-auto py-6 custom-scrollbar" [ngClass]="{ 'px-5': !collapsed(), 'px-3': collapsed() }"
             (mouseover)="onNavHover($event)" (mouseleave)="hideNavTooltip()" (scroll)="hideNavTooltip(); closeFlyout()">
          <nav class="space-y-1.5">
            <!-- Main Section -->
            <div class="mb-8">
              <p *ngIf="!collapsed()" class="px-3 mb-2 text-xs font-bold tracking-[0.08em] uppercase text-slate-500 dark:text-slate-400">Principal</p>
              
              <!-- Inicio -->
              <a routerLink="/" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active" [routerLinkActiveOptions]="{ exact: true }"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Inicio">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M3 9.5L12 4l9 5.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V9.5z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Inicio</span>
              </a>


              <!-- Roles -->
              <a *ngIf="hasRole('Administrador')" routerLink="/roles" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Roles">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Roles</span>
              </a>

              <!-- Usuarios -->
              <a *ngIf="hasRole('Administrador') || hasRole('Gestor Aplicación') || hasRole('Coordinador') || hasRole('Secretario')" routerLink="/usuarios" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Usuarios">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Usuarios</span>
              </a>
            </div>
            
            <!-- Colaboración Section — independiente del rol: visible solo si el usuario
                 fue invitado como colaborador de alguna visita del superintendente.
                 Va aparte del menú "Secretario" (que es exclusivo del rol Secretario). -->
            <div *ngIf="hasColaboraciones()" class="mb-8">
              <div class="h-px bg-slate-100 dark:bg-slate-800/60 mx-2 mb-4 mt-2"></div>
              <p *ngIf="!collapsed()" class="px-3 mb-2 text-xs font-bold tracking-[0.08em] uppercase text-slate-500 dark:text-slate-400">Colaboración</p>

              <a routerLink="/herramientas/visita-colaborador" routerLinkActive="text-brand-purple dark:text-purple-400 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Visita del circuito">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Visita del circuito</span>
              </a>
            </div>

            <!-- Modules Section -->
            <div *ngIf="hasAnyModulo()">
              <div class="h-px bg-slate-100 dark:bg-slate-800/60 mx-2 mb-4 mt-2"></div>
              <p *ngIf="!collapsed()" class="px-3 mb-2 text-xs font-bold tracking-[0.08em] uppercase text-slate-500 dark:text-slate-400">Módulos</p>
              
              <!-- Mi Agenda: calendario y tareas de cada persona -->
              <a *ngIf="puedeVerAgenda()" routerLink="/agenda" routerLinkActive="text-rose-600 dark:text-rose-400 font-semibold [&_.nav-icon]:!text-rose-500 dark:[&_.nav-icon]:!text-rose-400 bg-rose-500/10 dark:bg-rose-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Mi Agenda">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 3v3m8-3v3M4 9h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1Zm4 9 2 2 4-4"/></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Mi Agenda</span>
              </a>

              <!-- Reuniones Accordion -->
              <div *ngIf="hasAnyReunionesPermission()" class="relative mt-1">
                <button (click)="toggleReunionesMenu($event)" data-flyout-trigger
                  [attr.aria-haspopup]="collapsed() ? 'menu' : null"
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
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </div>
                    <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Reuniones</span>
                  </div>
                  <svg *ngIf="!collapsed()" class="w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" [ngClass]="{ 'rotate-180': reunionesMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                
                <!-- Submenu -->
                <div *ngIf="collapsed() ? flyout()?.menu === 'reuniones' : reunionesMenuOpen()" id="reuniones-submenu"
                     [ngClass]="collapsed() ? 'nav-flyout fixed z-[70] w-60 p-1.5 space-y-0.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xl shadow-slate-900/10 dark:shadow-black/40' : 'relative mt-1 ml-4 pl-3 pr-1 space-y-0.5 reuniones-submenu border-l border-slate-200 dark:border-slate-800'"
                     [style.top.px]="collapsed() ? flyout()?.top : null" [style.left.px]="collapsed() ? flyout()?.left : null"
                     [attr.data-title]="collapsed() ? 'Reuniones' : null" [attr.role]="collapsed() ? 'menu' : null">
                   <a *ngIf="hasPermission('reuniones.ver')" routerLink="/reuniones/resumen" routerLinkActive="sub-active" #rlaResumen="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaResumen.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                      <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                            [ngClass]="rlaResumen.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Resumen de hoy</span>
                   </a>
                   <a *ngIf="hasPermission('reuniones.entre_semana') || hasPermission('reuniones.fin_semana') || hasPermission('reuniones.logistica') || hasPermission('reuniones.discursos')" routerLink="/reuniones/programacion" routerLinkActive="sub-active" #rlaProg="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaProg.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                      <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                            [ngClass]="rlaProg.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Programación</span>
                   </a>
                   <a *ngIf="hasPermission('reuniones.asistencia')" routerLink="/reuniones/asistencia" routerLinkActive="sub-active" #rlaAsist="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaAsist.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                      <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                            [ngClass]="rlaAsist.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Asistencia</span>
                   </a>
                   <a *ngIf="hasPermission('reuniones.configuracion')" routerLink="/reuniones/configuracion" routerLinkActive="sub-active" #rlaConfigPl="routerLinkActive"
                      class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                      [ngClass]="rlaConfigPl.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                      <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                            [ngClass]="rlaConfigPl.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                      <span class="truncate">Configuración</span>
                   </a>
                </div>
              </div>

              <!-- Publicadores: una sola entrada. Adentro, la página decide qué
                   pestañas mostrar según el permiso de cada quien (Listado,
                   Grupos, Contactos, Acceso app), así que el sidebar solo
                   necesita saber si a esta persona le corresponde alguna. Sin
                   'publicadores.ver' pero con 'publicadores.acceso_app'
                   -p. ej. un superintendente de grupo a quien se le delegó
                   solo eso- entra igual y ve nada más la pestaña de acceso. -->
              <a *ngIf="puedeVerPublicadores()"
                routerLink="/secretario/publicadores"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500"
                [ngClass]="{
                  'justify-center p-3': collapsed(),
                  'gap-3 px-3 py-2.5': !collapsed(),
                  'text-brand-orange dark:text-orange-300 font-semibold [&_.nav-icon]:!text-brand-orange dark:[&_.nav-icon]:!text-orange-400 bg-brand-orange/10 dark:bg-orange-500/[0.13] nav-active': isPublicadoresActive()
                }" title="Publicadores">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Publicadores</span>
              </a>

              <!-- Informes -->
              <a *ngIf="hasAnyInformesPermission()" routerLink="/secretario/informes" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Informes">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Informes</span>
              </a>

              <!-- Administración (antes «Secretario»). Cada rol ve solo sus
                   opciones; el grupo se oculta si no le toca ninguna. Reglas en
                   core/auth/acceso-modulos.ts, las mismas de los guards. -->
              <div *ngIf="puedeVerAdministracion()" class="relative mt-1">
                <button (click)="toggleAdministracionMenu($event)" data-flyout-trigger
                  [attr.aria-haspopup]="collapsed() ? 'menu' : null"
                  [attr.aria-expanded]="administracionMenuOpen()"
                  class="w-full group flex items-center justify-between text-sm transition-all duration-200 relative rounded-lg"
                  [ngClass]="{
                    'p-3': collapsed(),
                    'px-3 py-2.5': !collapsed(),
                    'text-brand-purple dark:text-purple-300 font-semibold bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active': isAdministracionActive(),
                    'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-white/[0.04]': !isAdministracionActive()
                  }" title="Administración">
                  <div class="flex items-center" [ngClass]="{ 'justify-center w-full': collapsed(), 'gap-3': !collapsed() }">
                    <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 group-hover:-translate-y-[1px]"
                         [ngClass]="isAdministracionActive() ? '!text-brand-purple dark:!text-purple-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300'">
                      <!-- Maletín -->
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                    </div>
                    <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Administración</span>
                  </div>
                  <svg *ngIf="!collapsed()" class="w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" [ngClass]="{ 'rotate-180': administracionMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>

                <div *ngIf="collapsed() ? flyout()?.menu === 'administracion' : administracionMenuOpen()"
                     [ngClass]="collapsed() ? 'nav-flyout fixed z-[70] w-60 p-1.5 space-y-0.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xl shadow-slate-900/10 dark:shadow-black/40' : 'relative mt-1 ml-4 pl-3 pr-1 space-y-0.5 reuniones-submenu border-l border-slate-200 dark:border-slate-800'"
                     [style.top.px]="collapsed() ? flyout()?.top : null" [style.left.px]="collapsed() ? flyout()?.left : null"
                     [attr.data-title]="collapsed() ? 'Administración' : null" [attr.role]="collapsed() ? 'menu' : null">
                  <a *ngIf="puedeVerReunionesAncianos()" routerLink="/administracion/reuniones-teocraticas" routerLinkActive="sub-active" #rlaRA="routerLinkActive"
                     class="relative flex items-center pl-4 pr-1.5 py-2 text-sm leading-snug transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaRA.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaRA.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span>Reuniones teocráticas</span>
                  </a>
                  <a *ngIf="esSecretarioOAdmin()" routerLink="/administracion/visita-superintendente" routerLinkActive="sub-active" #rlaVS="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaVS.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaVS.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Visita del SC</span>
                  </a>
                  <a *ngIf="puedeVerActas()" routerLink="/administracion/actas-reunion" routerLinkActive="sub-active" #rlaAR="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaAR.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaAR.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Actas de reunión</span>
                  </a>
                  <a *ngIf="esSecretarioOAdmin()" routerLink="/administracion/transferencias" routerLinkActive="sub-active" #rlaTR="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaTR.isActive ? '!text-brand-purple dark:!text-purple-400 font-medium bg-brand-purple/[0.03] dark:bg-purple-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaTR.isActive ? 'bg-brand-purple dark:bg-purple-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Transferencias</span>
                  </a>
                </div>
              </div>

              <!-- Territorios Accordion -->
              <div *ngIf="hasPermission('territorios.ver')" class="relative mt-1">
                <button (click)="toggleTerritoriosMenu($event)" data-flyout-trigger
                  [attr.aria-haspopup]="collapsed() ? 'menu' : null"
                  [attr.aria-expanded]="territoriosMenuOpen()"
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
                    <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Territorios</span>
                  </div>
                  <svg *ngIf="!collapsed()" class="w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" [ngClass]="{ 'rotate-180': territoriosMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>

                <!-- Submenu -->
                <div *ngIf="collapsed() ? flyout()?.menu === 'territorios' : territoriosMenuOpen()"
                     [ngClass]="collapsed() ? 'nav-flyout fixed z-[70] w-60 p-1.5 space-y-0.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xl shadow-slate-900/10 dark:shadow-black/40' : 'relative mt-1 ml-4 pl-3 pr-1 space-y-0.5 reuniones-submenu border-l border-slate-200 dark:border-slate-800'"
                     [style.top.px]="collapsed() ? flyout()?.top : null" [style.left.px]="collapsed() ? flyout()?.left : null"
                     [attr.data-title]="collapsed() ? 'Territorios' : null" [attr.role]="collapsed() ? 'menu' : null">
                  <a routerLink="/territorios" routerLinkActive="sub-active" #rlaTerr="routerLinkActive" [routerLinkActiveOptions]="{exact: true}"
                     class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaTerr.isActive ? '!text-brand-green dark:!text-green-400 font-medium bg-brand-green/[0.03] dark:bg-green-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaTerr.isActive ? 'bg-brand-green dark:bg-green-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Congregación</span>
                  </a>
                  <a routerLink="/horarios" routerLinkActive="sub-active" #rlaHor="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaHor.isActive ? '!text-brand-green dark:!text-green-400 font-medium bg-brand-green/[0.03] dark:bg-green-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaHor.isActive ? 'bg-brand-green dark:bg-green-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Horarios</span>
                  </a>
                  <a routerLink="/seguimiento-predicacion" routerLinkActive="sub-active" #rlaPred="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaPred.isActive ? '!text-brand-green dark:!text-green-400 font-medium bg-brand-green/[0.03] dark:bg-green-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaPred.isActive ? 'bg-brand-green dark:bg-green-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Predicación</span>
                  </a>
                  <a routerLink="/territorios/registro" routerLinkActive="sub-active" #rlaS13="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaS13.isActive ? '!text-brand-green dark:!text-green-400 font-medium bg-brand-green/[0.03] dark:bg-green-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaS13.isActive ? 'bg-brand-green dark:bg-green-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Registro S-13</span>
                  </a>
                </div>
              </div>

              <!-- Reportes Accordion -->
              <div *ngIf="hasAnyReportesPermission()" class="relative mt-1">
                <button (click)="toggleReportesMenu($event)" data-flyout-trigger
                  [attr.aria-haspopup]="collapsed() ? 'menu' : null"
                  [attr.aria-expanded]="reportesMenuOpen()"
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
                    <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Reportes</span>
                  </div>
                  <svg *ngIf="!collapsed()" class="w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]" [ngClass]="{ 'rotate-180': reportesMenuOpen() }" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </button>

                <!-- Submenu -->
                <div *ngIf="collapsed() ? flyout()?.menu === 'reportes' : reportesMenuOpen()"
                     [ngClass]="collapsed() ? 'nav-flyout fixed z-[70] w-60 p-1.5 space-y-0.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xl shadow-slate-900/10 dark:shadow-black/40' : 'relative mt-1 ml-4 pl-3 pr-1 space-y-0.5 reuniones-submenu border-l border-slate-200 dark:border-slate-800'"
                     [style.top.px]="collapsed() ? flyout()?.top : null" [style.left.px]="collapsed() ? flyout()?.left : null"
                     [attr.data-title]="collapsed() ? 'Reportes' : null" [attr.role]="collapsed() ? 'menu' : null">
                  <a *ngIf="hasPermission('reportes.precursores')" routerLink="/reportes/precursores" routerLinkActive="sub-active" #rlaRepPrec="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaRepPrec.isActive ? '!text-brand-blue dark:!text-blue-400 font-medium bg-brand-blue/[0.03] dark:bg-blue-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaRepPrec.isActive ? 'bg-brand-blue dark:bg-blue-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Precursores</span>
                  </a>
                  <a *ngIf="hasPermission('reportes.publicadores')" routerLink="/reportes/publicadores" routerLinkActive="sub-active" #rlaRepPub="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaRepPub.isActive ? '!text-brand-blue dark:!text-blue-400 font-medium bg-brand-blue/[0.03] dark:bg-blue-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaRepPub.isActive ? 'bg-brand-blue dark:bg-blue-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Publicadores</span>
                  </a>
                  <a *ngIf="hasPermission('reportes.predicacion')" routerLink="/reportes/predicacion" routerLinkActive="sub-active" #rlaRepPred="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaRepPred.isActive ? '!text-brand-blue dark:!text-blue-400 font-medium bg-brand-blue/[0.03] dark:bg-blue-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaRepPred.isActive ? 'bg-brand-blue dark:bg-blue-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Predicación</span>
                  </a>
                  <a *ngIf="hasPermission('reportes.logistica')" routerLink="/reportes/logistica" routerLinkActive="sub-active" #rlaRepLog="routerLinkActive"
                     class="relative flex items-center px-4 py-2 text-sm transition-colors duration-200 rounded-lg group"
                     [ngClass]="rlaRepLog.isActive ? '!text-brand-blue dark:!text-blue-400 font-medium bg-brand-blue/[0.03] dark:bg-blue-500/[0.03]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]'">
                    <span class="-ml-[17px] absolute w-[6px] h-[6px] rounded-full ring-2 ring-white dark:ring-slate-900 transition-all duration-300"
                          [ngClass]="rlaRepLog.isActive ? 'bg-brand-blue dark:bg-blue-400 scale-110' : 'bg-slate-300 dark:bg-slate-600 scale-[0.6] group-hover:scale-75'"></span>
                    <span class="truncate">Carga de logística</span>
                  </a>
                </div>
              </div>

              <!-- Exhibidores -->
              <a *ngIf="hasAnyExhibidoresPermission()" routerLink="/exhibidores" routerLinkActive="text-brand-blue dark:text-blue-300 font-semibold [&_.nav-icon]:!text-brand-blue dark:[&_.nav-icon]:!text-blue-400 bg-brand-blue/10 dark:bg-blue-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Exhibidores">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Exhibidores</span>
              </a>
            </div>

            <!-- Configuración: un solo item, basta el separador sin encabezado -->
            <div *ngIf="puedeVerConfiguracion()" class="mt-4">
              <div class="h-px bg-slate-100 dark:bg-slate-800/60 mx-2 mb-3"></div>
              
              <!-- Configuracion Normal -->
              <a *ngIf="!hasRole('Administrador') && puedeVerConfiguracion()" routerLink="/configuracion" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Configuración">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Configuración</span>
              </a>

              <!-- Configuracion Admin -->
              <a *ngIf="hasRole('Administrador')" routerLink="/admin/configuracion" routerLinkActive="text-brand-purple dark:text-purple-300 font-semibold [&_.nav-icon]:!text-brand-purple dark:[&_.nav-icon]:!text-purple-400 bg-brand-purple/10 dark:bg-purple-500/[0.13] nav-active"
                class="group flex items-center text-sm text-slate-500 dark:text-slate-400 hover:!text-slate-900 dark:hover:!text-white transition-all duration-200 relative rounded-lg hover:bg-slate-100/70 dark:hover:bg-white/[0.04] mt-1"
                [ngClass]="{'justify-center p-3': collapsed(), 'gap-3 px-3 py-2.5': !collapsed()}" title="Configuración del Sistema">
                <div class="nav-icon w-5 h-5 flex items-center justify-center shrink-0 transition duration-200 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-y-[1px]">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <span *ngIf="!collapsed()" class="font-medium relative z-10 text-sm">Configuración</span>
              </a>

            </div>
          </nav>
        </div>

        <!-- Sidebar Footer Action Block (Notifs, Config, User Profile) -->
        <div class="sidebar-footer shrink-0 flex flex-col p-3 border-t border-gray-100 dark:border-white/5">
           
           <!-- Fila de acciones: tema y notificaciones (solo desktop; en móvil están en la barra superior) -->
           <div class="hidden lg:block pb-2">
             <div class="grid gap-0.5 p-0.5 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-100/80 dark:border-white/[0.05]" [ngClass]="collapsed() ? 'grid-cols-1' : 'grid-cols-2'">
               <button
                  class="flex items-center justify-center w-full h-10 rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  [ngClass]="collapsed() ? 'hover:bg-amber-100 dark:hover:bg-amber-900/30 text-slate-400 hover:text-amber-600 dark:hover:text-amber-400' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
                  (click)="toggleTheme()" [title]="themeService.darkMode() ? 'Usar modo claro' : 'Usar modo oscuro'" [attr.aria-label]="themeService.darkMode() ? 'Usar modo claro' : 'Usar modo oscuro'">
                   <svg *ngIf="!themeService.darkMode()" class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                   <svg *ngIf="themeService.darkMode()" class="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
               </button>

                <div class="relative flex">
                <button
                  id="notif-button"
                  class="flex items-center justify-center w-full h-10 rounded-lg transition-all relative group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  [ngClass]="notifService.count() > 0 ? 'bg-brand-purple/10 dark:bg-purple-500/[0.13] text-brand-purple dark:text-purple-400 hover:bg-brand-purple/20 dark:hover:bg-purple-500/20' : 'hover:bg-white dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
                  (click)="toggleNotifications()" title="Notificaciones">
                  <svg class="w-5 h-5 relative z-10 transition-transform" [ngClass]="{'notif-bell-shake': notifService.count() > 0}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <div *ngIf="notifService.count() > 0" class="absolute top-1.5 right-1.5 sm:top-1 sm:right-1 z-20 transition-opacity duration-300">
                     <span class="absolute inset-0 rounded-full bg-red-400 notif-badge-ping opacity-40"></span>
                     <span class="relative flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-gradient-to-br from-red-500 to-rose-600 text-white text-xs font-extrabold rounded-full shadow-sm">
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
                      <span *ngIf="notifService.count() > 0" class="text-xs font-bold text-brand-purple dark:text-purple-400 bg-brand-purple/10 px-1.5 py-0.5 rounded">
                        {{ notifService.count() }}
                      </span>
                    </div>
                    <button *ngIf="notifService.count() > 0" (click)="marcarTodasLeidas()" class="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-brand-purple">Marcar leídas</button>
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
                         <p class="text-sm leading-tight" [ngClass]="!n.leida ? 'font-bold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-300'">{{ n.titulo }}</p>
                         <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{{ n.mensaje }}</p>
                         <p class="text-xs text-slate-400 mt-1">{{ n.creado_en | timeAgo }}</p>
                       </div>
                     </div>
                     <div *ngIf="notifService.notificaciones().length === 0" class="py-8 text-center">
                       <p class="text-xs text-slate-400">Estás al día</p>
                     </div>
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
                   <span *ngIf="!collapsed()" class="truncate text-xs font-semibold text-slate-600 dark:text-slate-300 text-left">
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
                class="flex items-center w-full p-2 min-h-[44px] rounded-xl transition-all bg-slate-50/80 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-slate-100/80 dark:border-white/5 hover:border-slate-200 dark:hover:border-slate-700 group focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                [ngClass]="collapsed() ? 'justify-center' : 'justify-between'"
                (click)="toggleUserMenu()"
                title="Menú de Usuario"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-brand-purple to-[#4C1D95] dark:from-purple-600 dark:to-indigo-900 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-inner [text-shadow:_0_1px_2px_rgb(0_0_0_/_40%)] group-hover:scale-110 transition-transform duration-200 ease-out">
                    {{ (u.nombre || u.username || 'U').charAt(0).toUpperCase() }}
                  </div>
                  <div *ngIf="!collapsed()" class="flex flex-col items-start min-w-0 text-left">
                     <span class="text-sm font-bold text-slate-800 dark:text-white truncate max-w-full leading-tight">{{ u.nombre || u.username }}</span>
                     <span class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-normal leading-tight mt-1 max-w-full break-words" [title]="etiquetaRol(u.roles?.[0]) || 'User'">{{ etiquetaRol(u.roles?.[0]) || 'User' }}</span>
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
                      <span class="text-xs text-slate-500 truncate">{{ u.correo }}</span>
                    </div>
                 </div>

                 <div class="p-1.5 space-y-0.5 mt-1">
                   <button (click)="editProfile()" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors">
                     <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                     Mi perfil
                   </button>
                 </div>
                 <div class="px-3 py-1.5">
                   <div class="h-px w-full bg-slate-100 dark:bg-slate-800"></div>
                 </div>
                 <div class="px-1.5 pb-1">
                   <button (click)="logout()" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 text-sm font-medium transition-colors">
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
                 [ngClass]="notifService.count() > 0 ? 'text-brand-purple dark:text-purple-400' : 'text-slate-500 dark:text-slate-400'"
                 (click)="toggleNotifications()" title="Notificaciones">
                 <svg class="w-5 h-5" [ngClass]="{'notif-bell-shake': notifService.count() > 0}" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                   <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                 </svg>
                 <div *ngIf="notifService.count() > 0" class="absolute top-0 right-0 z-20">
                   <span class="absolute inset-0 rounded-full bg-red-400 notif-badge-ping opacity-40"></span>
                   <span class="relative flex items-center justify-center min-w-[16px] h-[16px] px-1 bg-gradient-to-br from-red-500 to-rose-600 text-white text-xs font-extrabold rounded-full shadow-sm">
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
                       <span *ngIf="notifService.count() > 0" class="text-xs font-bold text-brand-purple dark:text-purple-400 bg-brand-purple/10 px-1.5 py-0.5 rounded">
                         {{ notifService.count() }}
                       </span>
                     </div>
                     <div class="flex items-center gap-3">
                       <button *ngIf="notifService.count() > 0" (click)="marcarTodasLeidas()" class="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-brand-purple">Marcar leídas</button>
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
                          [ngClass]="!n.leida ? 'bg-brand-purple/[0.03] hover:bg-brand-purple/[0.06]' : 'hover:bg-slate-50 dark:hover:bg-slate-800'"
                          (click)="onNotificacionClick(n)">
                       <div *ngIf="!n.leida" class="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-md bg-brand-purple"></div>
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
                         <p class="text-xs text-slate-400 mt-1">{{ n.creado_en | timeAgo }}</p>
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
                    <span class="text-xs text-slate-500 truncate">{{ u.correo }}</span>
                  </div>
                </div>

                <!-- Mi perfil -->
                <div class="p-1.5 space-y-0.5 mt-1">
                  <button (click)="editProfile()" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-medium transition-colors">
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
                  <button (click)="logout()" class="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 text-sm font-medium transition-colors">
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
        <main class="print:!overflow-visible print:!m-0 flex-1 overflow-hidden relative flex flex-col pt-4 md:pt-6 px-4 md:px-8 pb-6 lg:pb-3">
          <div class="router-container print:!overflow-visible print:!h-auto flex-1 min-h-0 relative overflow-hidden flex flex-col">
             <router-outlet></router-outlet>
          </div>
        </main>
      </div>
    </div>

    <!-- Delete Group Modal — rendered at shell root so fixed positioning escapes all overflow/stacking contexts -->
    @if (modalBackdropService.deleteGroup(); as modal) {
      <app-confirm-dialog [open]="true" title="Eliminar Grupo"
        [message]="'Esta acción no se puede deshacer. Grupo a eliminar: ' + modal.groupName"
        confirmLabel="Sí, eliminar" cancelLabel="Cancelar" severity="danger" [busy]="modal.isDeleting"
        (confirmed)="modalBackdropService.confirm()"
        (openChange)="$event || modalBackdropService.cancel()" />
    }

    <!-- Design System v2 — Globales -->
    <app-toast-container></app-toast-container>
    <app-confirm-host></app-confirm-host>
    <app-command-palette></app-command-palette>
  `,
  styles: [`
    :host {
      display: block;
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
    /* Submenú flotante (sidebar comprimido) */
    .nav-flyout {
      animation: flyoutIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
      transform-origin: left top;
    }
    .nav-flyout::before {
      content: attr(data-title);
      display: block;
      padding: 0.5rem 0.75rem 0.5rem;
      margin-bottom: 0.25rem;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #94a3b8;
      border-bottom: 1px solid #f1f5f9;
    }
    :host-context(.dark) .nav-flyout::before { color: #64748b; border-bottom-color: rgba(255,255,255,0.06); }
    .nav-flyout > a { padding-left: 0.75rem; padding-right: 0.75rem; }
    .nav-flyout > a > span:first-child { display: none; }
    .nav-flyout > a.sub-active { background: rgba(148, 163, 184, 0.14); }
    :host-context(.dark) .nav-flyout > a.sub-active { background: rgba(255, 255, 255, 0.06); }
    @keyframes flyoutIn {
      from { opacity: 0; transform: translateX(-4px) scale(0.98); }
      to   { opacity: 1; transform: translateX(0) scale(1); }
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
  administracionMenuOpen = signal(false);

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
    if (!this.collapsed() || this.flyout()) { this.navTooltip.set(null); return; }
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

  // Con el sidebar comprimido los submenús no caben en línea: se abren como
  // panel flotante a la derecha del icono. El <aside> tiene transform, así que
  // las coordenadas de un hijo `fixed` son relativas a él, no a la ventana.
  flyout = signal<{ menu: 'reuniones' | 'administracion' | 'territorios' | 'reportes'; top: number; left: number } | null>(null);

  private toggleFlyout(menu: 'reuniones' | 'administracion' | 'territorios' | 'reportes', event?: MouseEvent) {
    if (this.flyout()?.menu === menu) { this.closeFlyout(); return; }
    const btn = event?.currentTarget as HTMLElement | null;
    const aside = btn?.closest('aside');
    if (!btn || !aside) return;
    const rect = btn.getBoundingClientRect();
    const asideRect = aside.getBoundingClientRect();
    this.hideNavTooltip();
    this.flyout.set({ menu, top: rect.top - asideRect.top - 6, left: asideRect.width + 10 });
    // Si el panel no cabe hacia abajo, se sube lo justo para que quede visible.
    setTimeout(() => {
      const panel = aside.querySelector('.nav-flyout') as HTMLElement | null;
      const actual = this.flyout();
      if (!panel || !actual || actual.menu !== menu) return;
      const sobrante = asideRect.top + actual.top + panel.offsetHeight - (window.innerHeight - 12);
      if (sobrante > 0) this.flyout.set({ ...actual, top: Math.max(8 - asideRect.top, actual.top - sobrante) });
    });
  }

  closeFlyout() {
    if (this.flyout()) this.flyout.set(null);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClickFlyout(event: MouseEvent) {
    if (!this.flyout()) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.nav-flyout, [data-flyout-trigger]')) return;
    this.closeFlyout();
  }

  @HostListener('document:keydown.escape')
  onEscapeFlyout() {
    this.closeFlyout();
  }

  @HostListener('window:resize')
  onWindowResize() {
    this.hideNavTooltip();
    this.closeFlyout();
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
        this.closeFlyout();
        }
      }
    } catch (err) { }
  };

  user = computed(() => this.store.user());
  mustChangePassword = computed(() => this.store.user()?.debe_cambiar_contrasena === true);
  mustEnableTwoFactor = computed(() => this.store.user()?.mfa_pendiente === true);

  // SSE de notificaciones: con la verificación en dos pasos pendiente el
  // backend lo rechaza (403) y reintentaría en bucle; se abre al activarla.
  private conectarNotificaciones = effect(() => {
    if (this.mustEnableTwoFactor()) return;
    untracked(() => this.notifService.connectSSE());
  });

  router = inject(Router); // Re-injecting Router as it might be missing or private

  ngOnInit(): void {
    document.addEventListener('click', this.outsideClickHandler);
    
    // El SSE de notificaciones lo abre `conectarNotificaciones`.

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
    if (this.isAdministracionActive()) {
      this.administracionMenuOpen.set(true);
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
        if (event.urlAfterRedirects.startsWith('/administracion')) {
          this.administracionMenuOpen.set(true);
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
      if (url.includes('tab=acceso')) {
        this.pageTitle.set({ title: 'Acceso a la app', subtitle: 'Invitaciones y credenciales para la app móvil.' });
      } else {
        this.pageTitle.set({ title: 'Publicadores', subtitle: 'Base de datos de hermanos y publicadores.' });
      }
    } else if (url.includes('/horarios')) {
      this.pageTitle.set({ title: 'Programa de salidas', subtitle: 'Qué días se predica, dónde y con quién.' });
    } else if (url.includes('/seguimiento-predicacion')) {
      this.pageTitle.set({ title: 'Predicación', subtitle: 'Seguimiento de estado de predicación por manzana.' });
    } else if (url.includes('/territorios')) {
      this.pageTitle.set({ title: 'Territorios', subtitle: 'Gestión de mapas y asignaciones.' });
    } else if (url.includes('/exhibidores')) {
      this.pageTitle.set({ title: 'Exhibidores', subtitle: 'Gestión de puntos de predicación pública.' });
    } else if (url.includes('/administracion/reuniones-teocraticas')) {
      this.pageTitle.set({ title: 'Reuniones teocráticas', subtitle: 'Programa, convocatoria y puntos propuestos.' });
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
    } else if (url.includes('/reportes/logistica')) {
      this.pageTitle.set({ title: 'Carga de Logística', subtitle: 'Reparto del trabajo de las reuniones por persona, categoría y grupo.' });
    } else if (url.includes('/reportes')) {
      this.pageTitle.set({ title: 'Reportes', subtitle: 'Análisis e indicadores de la congregación.' });
    } else if (url === '/agenda' || url.startsWith('/agenda?')) {
      this.pageTitle.set({ title: 'Mi Agenda', subtitle: 'Lo que tiene por fecha y sus tareas, en un solo lugar.' });
    } else if (url.includes('/administracion/visita-superintendente')) {
      this.pageTitle.set({ title: 'Visita del Superintendente', subtitle: 'Documentos y agenda para la visita del SC.' });
    } else if (url.includes('/administracion/actas-reunion')) {
      this.pageTitle.set({ title: 'Actas de Reunión', subtitle: 'Toma notas y redacta actas con asistencia de IA.' });
    } else if (url.includes('/administracion/transferencias')) {
      this.pageTitle.set({ title: 'Transferencias', subtitle: 'Paquete completo para transferencia de publicadores.' });
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

  // Roles efectivos: el Gestor Aplicación cuenta también como Publicador.
  hasRole = (r: string) => this.store.hasRole(r);

  hasPermission = (p: string) => this.store.hasPermission(p);

  etiquetaRol = etiquetaRol;

  logout() { this.auth.logout(); }

  toggleReunionesMenu(event?: MouseEvent) {
    if (this.collapsed()) { this.toggleFlyout('reuniones', event); return; }
    this.reunionesMenuOpen.update(v => !v);
  }

  isReunionesActive(): boolean {
    return this.router.url.startsWith('/reuniones');
  }

  toggleTerritoriosMenu(event?: MouseEvent) {
    if (this.collapsed()) { this.toggleFlyout('territorios', event); return; }
    this.territoriosMenuOpen.update(v => !v);
  }

  isTerritoriosActive(): boolean {
    const url = this.router.url;
    return url.startsWith('/territorios') || url.startsWith('/horarios') || url.startsWith('/seguimiento-predicacion');
  }

  toggleReportesMenu(event?: MouseEvent) {
    if (this.collapsed()) { this.toggleFlyout('reportes', event); return; }
    this.reportesMenuOpen.update(v => !v);
  }

  isReportesActive(): boolean {
    return this.router.url.startsWith('/reportes');
  }

  toggleAdministracionMenu(event?: MouseEvent) {
    if (this.collapsed()) { this.toggleFlyout('administracion', event); return; }
    this.administracionMenuOpen.update(v => !v);
  }

  isAdministracionActive(): boolean {
    return this.router.url.startsWith('/administracion');
  }

  isPublicadoresActive(): boolean {
    return this.router.url.startsWith('/secretario/publicadores');
  }

  // Reglas de acceso por módulo: core/auth/acceso-modulos.ts (las comparte
  // la paleta de comandos).
  hasAnyReunionesPermission(): boolean { return puedeVerReuniones(this.store); }
  hasAnyInformesPermission(): boolean { return puedeVerInformes(this.store); }
  puedeVerPublicadores(): boolean { return puedeVerPublicadores(this.store); }
  hasAnyExhibidoresPermission(): boolean { return puedeVerExhibidores(this.store); }
  hasAnyReportesPermission(): boolean { return puedeVerReportes(this.store); }
  puedeVerConfiguracion(): boolean { return puedeVerConfiguracion(this.store); }
  puedeVerAdministracion(): boolean { return puedeVerAdministracion(this.store); }
  esSecretarioOAdmin(): boolean { return esSecretarioOAdmin(this.store); }
  puedeVerReunionesAncianos(): boolean { return puedeVerReunionesAncianos(this.store); }
  puedeVerActas(): boolean { return puedeVerActas(this.store); }
  puedeVerAgenda(): boolean { return puedeVerAgenda(this.store); }

  hasAnyModulo(): boolean {
    return (
      this.puedeVerAgenda() ||
      this.hasAnyReunionesPermission() ||
      this.puedeVerPublicadores() ||
      this.hasAnyInformesPermission() ||
      puedeVerTerritorios(this.store) ||
      this.hasAnyExhibidoresPermission() ||
      this.hasAnyReportesPermission() ||
      this.puedeVerAdministracion()
    );
  }

  toggleSidebar() {
    this.collapsed.update(v => !v);
    this.hideNavTooltip();
    this.closeFlyout();
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
    } else if ((n.tipo === 'tarea_asignada' || n.tipo === 'tarea_completada') && n.payload?.['id_tarea']) {
      this.notificationsOpen.set(false);
      this.router.navigate(
        ['/herramientas/tareas', n.payload['id_tarea']],
        { queryParams: { desde: 'mis-tareas' } }
      );
    } else if (n.tipo === 'agenda_aviso') {
      this.notificationsOpen.set(false);
      const fecha = n.payload?.['fecha'];
      // Secretaría y agenda personal comparten la misma pantalla (cada uno ve la suya).
      this.router.navigate(['/agenda'], fecha ? { queryParams: { fecha } } : {});
    } else if (n.tipo === 'visita_colaborador') {
      this.hasColaboraciones.set(true);
      this.notificationsOpen.set(false);
      this.router.navigate(['/herramientas/visita-colaborador']);
    } else if (n.tipo.startsWith('reunion_ancianos_')) {
      this.notificationsOpen.set(false);
      const id = n.payload?.['id_reunion'];
      this.router.navigate(id ? ['/administracion/reuniones-teocraticas', id] : ['/administracion/reuniones-teocraticas']);
    } else if (n.tipo === 'transferencia_recibida') {
      this.notificationsOpen.set(false);
      // Transferencias es solo del Secretario (y el Administrador): el
      // Coordinador y el S. de servicio también reciben este aviso y para ellos
      // el módulo no existe, así que los lleva a la lista de publicadores.
      const id = n.payload?.['id_transferencia'];
      if (this.hasRole('Secretario') || this.hasRole('Administrador')) {
        this.router.navigate(['/administracion/transferencias'], id ? { queryParams: { id } } : {});
      } else {
        this.router.navigate(['/secretario/publicadores']);
      }
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
      case 'tarea_asignada':
      case 'tarea_completada':   return 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400';
      case 'visita_colaborador': return 'bg-violet-100 dark:bg-violet-900/30 text-brand-purple dark:text-violet-400';
      case 'agenda_aviso':       return 'bg-violet-100 dark:bg-violet-900/30 text-brand-purple dark:text-violet-400';
      case 'reunion_ancianos_convocada':
      case 'reunion_ancianos_actualizada':
      case 'reunion_ancianos_propuesta':
      case 'reunion_ancianos_recordatorio': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400';
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
