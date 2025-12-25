import { Component, computed, inject, OnInit, signal, OnDestroy, Renderer2 } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { lastValueFrom, forkJoin } from 'rxjs';
import { PrivilegiosService } from '../../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../privilegios/domain/models/publicador-privilegio';

// Interfaces simplificadas para la vista
interface Grupo {
  id_grupo: number;
  nombre_grupo: string;
  capitan_grupo?: string;
  auxiliar_grupo?: string;
  cantidad_publicadores?: number;
}

interface Publicador {
  id_publicador: number;
  primer_nombre: string;
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido?: string | null;
  id_grupo_publicador?: number | null;
  sexo?: string;
  // Ajustar según la respuesta real de tu API si hay privilegio/rol
  rol?: any;
  privilegio?: any;
  // Privilegios activos del publicador (cargados desde el frontend)
  privilegios_activos?: number[]; // Array de id_privilegio
}

@Component({
  standalone: true,
  selector: 'app-asignacion-grupos',
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col w-full bg-gradient-to-br from-slate-50 via-white to-slate-100 overflow-hidden font-sans">
      
      <!-- Header Moderno Responsivo -->
      <header class="shrink-0 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 shadow-sm z-30 sticky top-0">
        <div class="px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div class="flex items-center justify-between gap-4">
            <!-- Left Section -->
            <div class="flex items-center gap-3 sm:gap-4 min-w-0">
               <button (click)="goBack()" class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all active:scale-95 shrink-0">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
               </button>
               
               <div class="min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                     <h1 class="text-lg sm:text-xl lg:text-2xl font-extrabold text-slate-900 tracking-tight truncate">Asignación Dinámica</h1>
                     <span class="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-brand-orange text-white text-[9px] font-bold uppercase tracking-wider shadow-sm">Beta</span>
                  </div>
                  <p class="text-slate-500 text-[11px] sm:text-xs font-medium mt-0.5 hidden sm:block">Arrastra y suelta para reorganizar los grupos</p>
               </div>
            </div>
            
            <!-- Right Section -->
            <div class="flex items-center gap-2 sm:gap-3 shrink-0">
                 <!-- Full Screen Toggle Button -->
                 <button 
                   (click)="toggleFullScreen()"
                   class="hidden sm:flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
                   title="Pantalla Completa"
                 >
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>
                 </button>

                 <!-- Separator -->
                 <div class="hidden sm:block w-px h-6 bg-slate-200 mx-1"></div>

                 <!-- Cambios Pendientes Indicator -->
                 <div class="hidden lg:flex items-center gap-3 bg-slate-50/80 px-3 py-2 rounded-xl border border-slate-200/60" *ngIf="pendingChangesCount() > 0">
                    <div class="w-8 h-8 rounded-lg bg-brand-orange flex items-center justify-center text-white">
                       <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </div>
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-slate-800 leading-tight">{{ pendingChangesCount() }} cambios</span>
                        <span class="text-[10px] text-slate-500 font-medium">sin guardar</span>
                    </div>
                 </div>

                 <!-- Mobile Changes Badge -->
                 <div class="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-brand-orange-soft text-brand-orange font-bold text-sm" *ngIf="pendingChangesCount() > 0">
                    {{ pendingChangesCount() }}
                 </div>
                 
                 <!-- Save Button -->
                 <button 
                   (click)="saveChanges()"
                   [disabled]="isSaving() || pendingChangesCount() === 0"
                   class="relative overflow-hidden px-3 sm:px-5 py-2 sm:py-2.5 bg-brand-orange text-white rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-orange-500/30 transition-all hover:bg-orange-600 hover:shadow-orange-500/40 active:scale-95 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2"
                 >
                   <svg *ngIf="isSaving()" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                   <svg *ngIf="!isSaving()" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                   <span class="hidden sm:inline">{{ isSaving() ? 'Guardando...' : 'Guardar' }}</span>
                 </button>
            </div>
          </div>
        </div>
      </header>

      <!-- Kanban Board Area - Responsivo con Diseño Estético -->
      <div class="flex-1 min-h-0 p-4 sm:p-6 lg:p-8 bg-slate-50/50 transition-all duration-300" 
           [class.p-0]="isFullScreen()" 
           [class.sm:p-0]="isFullScreen()" 
           [class.lg:p-0]="isFullScreen()">
         
         <div class="w-full h-full bg-white rounded-3xl border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col relative transition-all duration-300"
              [ngClass]="{'fixed inset-0 z-[9999] rounded-none border-0': isFullScreen()}">
            
            <!-- Controls Overlay for FullScreen Mode -->
            <div *ngIf="isFullScreen()" class="absolute top-2 right-4 sm:right-1/2 sm:translate-x-1/2 z-50 animate-fade-in-down">
               <button 
                  (click)="toggleFullScreen()"
                  class="flex items-center gap-2 px-4 py-2 bg-slate-900/90 hover:bg-slate-800 text-white backdrop-blur-md rounded-full shadow-xl border border-white/10 transition-all active:scale-95 group"
               >
                  <span class="text-xs font-bold tracking-wide">Salir de Pantalla Completa</span>
                  <svg class="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
               </button>
            </div>

            <!-- Sombras decorativas laterales (Fade effect manual) -->
            <div class="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none"></div>
            <div class="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none"></div>

            <div class="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scrollbar" 
                 [class.px-8]="isFullScreen()"
                 [class.pb-8]="isFullScreen()"
                 [class.pt-14]="isFullScreen()">
               <div class="flex h-full gap-5 pb-2">
            
            <!-- Columna: Sin Asignar (Staging Area) -->
            <div 
               class="w-64 sm:w-72 shrink-0 flex flex-col rounded-2xl bg-gradient-to-b from-slate-100 to-slate-50 border border-slate-200/80 max-h-full transition-all duration-300 snap-start shadow-sm"
               [class.bg-brand-orange-soft]="isDraggingOver() === 'unassigned'"
               [class.border-brand-orange]="isDraggingOver() === 'unassigned'"
               [class.shadow-lg]="isDraggingOver() === 'unassigned'"
               (dragover)="onDragOver($event, 'unassigned')"
               (dragleave)="onDragLeave()"
               (drop)="onDrop($event, null)"
            >
               <!-- Header -->
               <div class="px-4 py-3 border-b border-slate-200/60 flex items-center justify-between rounded-t-2xl bg-white/60 backdrop-blur-sm">
                  <div class="flex items-center gap-2.5">
                      <div class="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center">
                         <svg class="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>
                      </div>
                      <div>
                         <p class="font-bold text-slate-700 text-sm">Sin Asignar</p>
                         <p class="text-[10px] text-slate-400">Zona de espera</p>
                      </div>
                  </div>
                  <span class="bg-slate-800 text-white px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums">{{ unassignedPublishers().length }}</span>
               </div>
               
               <!-- List -->
               <div class="p-3 flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                  <ng-container *ngFor="let p of unassignedPublishers()">
                     <ng-container *ngTemplateOutlet="cardTemplate; context: { $implicit: p }"></ng-container>
                  </ng-container>
                  
                   <div *ngIf="unassignedPublishers().length === 0" class="py-12 flex flex-col items-center justify-center text-slate-400 text-xs">
                      <div class="w-12 h-12 rounded-xl bg-slate-100/80 flex items-center justify-center mb-3">
                         <svg class="w-6 h-6 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                      </div>
                      <span class="font-medium">Sin publicadores pendientes</span>
                      <span class="text-[10px] text-slate-300 mt-1">Todos están asignados</span>
                   </div>
               </div>
            </div>

            <!-- Columnas: Grupos - Diseño Profesional -->
            <div 
               *ngFor="let grupo of grupos()"
               class="w-64 sm:w-72 shrink-0 flex flex-col rounded-2xl bg-white border border-slate-200/80 shadow-md hover:shadow-lg max-h-full transition-all duration-300 snap-start"
               [class.ring-2]="isDraggingOver() === grupo.id_grupo"
               [class.ring-brand-orange]="isDraggingOver() === grupo.id_grupo"
               [class.shadow-xl]="isDraggingOver() === grupo.id_grupo"
               (dragover)="onDragOver($event, grupo.id_grupo)"
               (dragleave)="onDragLeave()"
               (drop)="onDrop($event, grupo.id_grupo)"
            >
                <!-- Header con color de marca (Naranja) -->
               <div class="px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 rounded-t-2xl">
                   <div class="flex flex-col">
                       <h3 class="font-bold text-white text-base truncate" [title]="grupo.nombre_grupo">{{ grupo.nombre_grupo }}</h3>
                       <div class="flex items-center gap-3 mt-1">
                          <p class="text-orange-100 text-[11px] font-medium flex items-center gap-1">
                             <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                             {{ getGroupMembers(grupo.id_grupo).length }} miembros
                          </p>
                          <span class="text-orange-300/50 text-[10px]">•</span>
                          <p class="text-white text-[11px] font-bold flex items-center gap-1">
                              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                              {{ getPrecursoresCount(grupo.id_grupo) }} Precursores
                          </p>
                       </div>
                   </div>
               </div>

                <!-- Sección de Liderazgo -->
                <div class="px-4 py-3 bg-slate-50 border-b border-slate-100">
                   <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Encargados del grupo</p>
                   <div class="space-y-2">
                      <!-- Capitán Drop Zone -->
                      <div 
                        class="relative flex items-start gap-2.5 p-2 rounded-lg transition-all duration-200 group/leader"
                        [ngClass]="{
                           'bg-white border border-slate-100': !isDraggingOverLeader() || isDraggingOverLeader()?.groupId !== grupo.id_grupo || isDraggingOverLeader()?.role !== 'capitan',
                           'bg-indigo-50 border-2 border-dashed border-indigo-300 scale-[1.02] shadow-sm z-10': isDraggingOverLeader()?.groupId === grupo.id_grupo && isDraggingOverLeader()?.role === 'capitan',
                           'bg-amber-50/50 border border-dashed border-amber-200': !grupo.capitan_grupo && (!isDraggingOverLeader() || isDraggingOverLeader()?.groupId !== grupo.id_grupo || isDraggingOverLeader()?.role !== 'capitan')
                        }"
                        (dragover)="onDragOverLeader($event, grupo.id_grupo, 'capitan')"
                        (dragleave)="onDragLeaveLeader()"
                        (drop)="onDropLeader($event, grupo.id_grupo, 'capitan')"
                      >
                         <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors pointer-events-none"
                              [ngClass]="{
                                 'bg-indigo-100 text-indigo-600': grupo.capitan_grupo || (isDraggingOverLeader()?.groupId === grupo.id_grupo && isDraggingOverLeader()?.role === 'capitan'),
                                 'bg-amber-100 text-amber-500': !grupo.capitan_grupo && !(isDraggingOverLeader()?.groupId === grupo.id_grupo && isDraggingOverLeader()?.role === 'capitan')
                              }">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                         </div>
                         <div class="flex-1 min-w-0 pointer-events-none">
                            <div class="flex items-center justify-between">
                               <p class="text-[9px] font-bold text-slate-400 uppercase">Capitán</p>
                               <button *ngIf="grupo.capitan_grupo" (click)="removeLeader(grupo.id_grupo, 'capitan')" class="pointer-events-auto opacity-0 group-hover/leader:opacity-100 p-0.5 hover:bg-red-50 hover:text-red-500 rounded transition-all" title="Quitar asignación">
                                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                               </button>
                            </div>
                            <p class="text-xs font-bold truncate transition-colors" 
                               [ngClass]="{'text-indigo-700': isLeaderModified(grupo.id_grupo, 'capitan'), 'text-slate-800': !isLeaderModified(grupo.id_grupo, 'capitan') && grupo.capitan_grupo, 'text-amber-600 italic': !grupo.capitan_grupo}">
                               {{ grupo.capitan_grupo || 'Arrastra aquí...' }}
                            </p>
                            <!-- Tags de privilegios del Capitán -->
                            <div class="flex flex-wrap gap-1 mt-1" *ngIf="getPrivilegioTagsByName(grupo.capitan_grupo).length > 0">
                               <span *ngFor="let tag of getPrivilegioTagsByName(grupo.capitan_grupo)" 
                                     class="inline-flex items-center gap-0.5 text-[8px] font-bold px-1 py-0.5 rounded whitespace-nowrap"
                                     [ngClass]="tag.class">
                                  {{ tag.label }}
                               </span>
                            </div>
                         </div>
                      </div>

                      <!-- Auxiliar Drop Zone -->
                      <div 
                        class="relative flex items-start gap-2.5 p-2 rounded-lg transition-all duration-200 group/leader"
                        [ngClass]="{
                           'bg-white border border-slate-100': !isDraggingOverLeader() || isDraggingOverLeader()?.groupId !== grupo.id_grupo || isDraggingOverLeader()?.role !== 'auxiliar',
                           'bg-purple-50 border-2 border-dashed border-purple-300 scale-[1.02] shadow-sm z-10': isDraggingOverLeader()?.groupId === grupo.id_grupo && isDraggingOverLeader()?.role === 'auxiliar',
                           'bg-slate-50 border border-dashed border-slate-200': !grupo.auxiliar_grupo && (!isDraggingOverLeader() || isDraggingOverLeader()?.groupId !== grupo.id_grupo || isDraggingOverLeader()?.role !== 'auxiliar')
                        }"
                        (dragover)="onDragOverLeader($event, grupo.id_grupo, 'auxiliar')"
                        (dragleave)="onDragLeaveLeader()"
                        (drop)="onDropLeader($event, grupo.id_grupo, 'auxiliar')"
                      >
                         <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 transition-colors pointer-events-none"
                              [ngClass]="{
                                 'bg-purple-100 text-purple-600': grupo.auxiliar_grupo || (isDraggingOverLeader()?.groupId === grupo.id_grupo && isDraggingOverLeader()?.role === 'auxiliar'),
                                 'bg-slate-100 text-slate-400': !grupo.auxiliar_grupo && !(isDraggingOverLeader()?.groupId === grupo.id_grupo && isDraggingOverLeader()?.role === 'auxiliar')
                              }">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                         </div>
                         <div class="flex-1 min-w-0 pointer-events-none">
                            <div class="flex items-center justify-between">
                               <p class="text-[9px] font-bold text-slate-400 uppercase">Auxiliar</p>
                               <button *ngIf="grupo.auxiliar_grupo" (click)="removeLeader(grupo.id_grupo, 'auxiliar')" class="pointer-events-auto opacity-0 group-hover/leader:opacity-100 p-0.5 hover:bg-red-50 hover:text-red-500 rounded transition-all" title="Quitar asignación">
                                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                               </button>
                            </div>
                            <p class="text-xs font-medium truncate transition-colors"
                               [ngClass]="{'text-purple-700 font-bold': isLeaderModified(grupo.id_grupo, 'auxiliar'), 'text-slate-700': !isLeaderModified(grupo.id_grupo, 'auxiliar') && grupo.auxiliar_grupo, 'text-slate-400 italic': !grupo.auxiliar_grupo}">
                               {{ grupo.auxiliar_grupo || 'Arrastra aquí...' }}
                            </p>
                            <!-- Tags de privilegios del Auxiliar -->
                            <div class="flex flex-wrap gap-1 mt-1" *ngIf="getPrivilegioTagsByName(grupo.auxiliar_grupo).length > 0">
                               <span *ngFor="let tag of getPrivilegioTagsByName(grupo.auxiliar_grupo)" 
                                     class="inline-flex items-center gap-0.5 text-[8px] font-bold px-1 py-0.5 rounded whitespace-nowrap"
                                     [ngClass]="tag.class">
                                  {{ tag.label }}
                               </span>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

               <!-- Listado de Publicadores -->
               <div class="px-3 py-2 flex-1 overflow-y-auto custom-scrollbar">
                  <p class="text-[9px] font-bold text-orange-500 uppercase tracking-widest mb-2 px-1">Publicadores</p>
                  <div class="space-y-2">
                     <ng-container *ngFor="let p of getGroupMembers(grupo.id_grupo)">
                        <ng-container *ngTemplateOutlet="cardTemplate; context: { $implicit: p, inGroup: true }"></ng-container>
                     </ng-container>
                  </div>
                  
                  <div *ngIf="getGroupMembers(grupo.id_grupo).length === 0" class="py-8 flex flex-col items-center justify-center text-slate-300 text-xs border border-dashed border-slate-200 rounded-xl bg-slate-50/50 mt-2">
                       <svg class="w-6 h-6 opacity-40 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      <span>Arrastra publicadores aquí</span>
                  </div>
               </div>
            </div>

          </div>
       </div>
    </div>
 </div>
      <!-- Toast de Éxito -->
     <div *ngIf="showSuccessMessage()" class="fixed bottom-6 right-6 z-50 slide-in-bottom">
        <div class="bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700/50 backdrop-blur-md bg-opacity-95">
           <div class="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
           </div>
           <div>
              <h4 class="font-bold text-sm text-white">Cambios guardados</h4>
              <p class="text-[11px] font-medium text-slate-400">La asignación se ha actualizado correctamente.</p>
           </div>
           <button (click)="showSuccessMessage.set(false)" class="text-slate-500 hover:text-white transition-colors ml-2 -mr-1 p-1">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
           </button>
        </div>
     </div>
    </div>

    <!-- Template de Card de Publicador - Diseño Limpio -->
    <ng-template #cardTemplate let-p let-inGroup="inGroup">
      <div 
         class="bg-white p-2.5 rounded-xl border border-slate-100 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-slate-200 transition-all duration-200 group relative flex items-center gap-2.5 select-none"
         draggable="true"
         (dragstart)="onDragStart($event, p)"
      >
         <!-- Avatar - Icono de Usuario -->
         <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
            <svg class="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
               <circle cx="12" cy="7" r="4"></circle>
            </svg>
         </div>

         <!-- Info -->
         <div class="min-w-0 flex-1 flex flex-col justify-center"> 
            <p class="text-[13px] font-black text-slate-800 truncate leading-tight group-hover:text-brand-orange transition-colors">
                {{ p.primer_nombre }} {{ p.primer_apellido }}
            </p>
            <div class="flex items-center gap-1 mt-1 flex-wrap">
                <!-- Privilegios Tags con iconos -->
                <ng-container *ngIf="getPrivilegioTags(p).length > 0; else noPrivilegio">
                   <span *ngFor="let tag of getPrivilegioTags(p)" 
                         class="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                         [ngClass]="tag.class"
                         [title]="tag.label">
                      <svg class="w-2.5 h-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path [attr.d]="tag.icon"></path>
                      </svg>
                      {{ tag.label }}
                   </span>
                </ng-container>
                <ng-template #noPrivilegio>
                   <span class="text-[9px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                      Publicador
                   </span>
                </ng-template>
            </div>
         </div>
         
         <!-- Modified Indicator (Full Badge) -->
         <div class="absolute top-2 right-2" *ngIf="isModified(p)">
             <span class="flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-orange opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-brand-orange"></span>
              </span>
         </div>
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; height: 100vh; }
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    
    @keyframes slideInBottom {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .slide-in-bottom {
      animation: slideInBottom 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    /* Global FullScreen Override Styles */
    ::ng-deep body.gac-fullscreen-active app-shell aside,
    ::ng-deep body.gac-fullscreen-active app-shell header {
      display: none !important;
    }
    
    ::ng-deep body.gac-fullscreen-active app-shell aside + div {
      margin-left: 0 !important;
    }
    
    ::ng-deep body.gac-fullscreen-active app-shell main {
      padding: 0 !important;
      height: 100vh !important;
    }
    
    ::ng-deep body.gac-fullscreen-active app-shell .router-container {
      height: 100vh !important;
    }
  `]
})
export class AsignacionGruposPage implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private router = inject(Router);
  private privilegiosService = inject(PrivilegiosService);
  private renderer = inject(Renderer2);
  private document = inject(DOCUMENT);

  // Data
  grupos = signal<Grupo[]>([]);
  publicadores = signal<Publicador[]>([]);

  // Privilegios Data
  privilegiosCatalogo = signal<Privilegio[]>([]);
  publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map()); // id_publicador -> id_privilegio[]

  // UI State
  isDraggingOver = signal<'unassigned' | number | null>(null);
  draggedItem: Publicador | null = null;
  draggedLeader: { type: 'capitan' | 'auxiliar', groupId: number, publicador: Publicador } | null = null;
  isSaving = signal(false);
  showSuccessMessage = signal(false);
  isFullScreen = signal(false); // Estado para pantalla completa

  toggleFullScreen() {
    this.isFullScreen.update(v => !v);
    if (this.isFullScreen()) {
      this.renderer.addClass(this.document.body, 'gac-fullscreen-active');
    } else {
      this.renderer.removeClass(this.document.body, 'gac-fullscreen-active');
    }
  }

  ngOnDestroy() {
    this.renderer.removeClass(this.document.body, 'gac-fullscreen-active');
  }
  isDraggingOverLeader = signal<{ groupId: number, role: 'capitan' | 'auxiliar' } | null>(null);

  // Convertimos los estados iniciales a señales para que pendingChangesCount reaccione a sus cambios
  initialState = signal(new Map<number, number | null>());
  initialLeaderState = signal(new Map<number, { capitan: string | undefined, auxiliar: string | undefined }>());
  pendingLeaderChanges = new Map<number, { capitan?: string, auxiliar?: string }>();

  // Computed
  pendingChangesCount = computed(() => {
    let count = 0;
    const initialMap = this.initialState();
    const initialLeaderMap = this.initialLeaderState();

    // Cambios en publicadores
    for (const p of this.publicadores()) {
      const original = initialMap.get(p.id_publicador);
      const current = p.id_grupo_publicador || null;
      if (original !== current) {
        count++;
      }
    }
    // Cambios en líderes
    for (const g of this.grupos()) {
      const initial = initialLeaderMap.get(g.id_grupo);
      if (initial) {
        if ((g.capitan_grupo || '') !== (initial.capitan || '')) count++;
        if ((g.auxiliar_grupo || '') !== (initial.auxiliar || '')) count++;
      }
    }
    return count;
  });

  unassignedPublishers = computed(() =>
    this.publicadores().filter(p => !p.id_grupo_publicador).sort((a, b) => a.primer_nombre.localeCompare(b.primer_nombre))
  );

  draggingAvatars = computed(() => {
    return this.publicadores().filter(p => this.isModified(p)).slice(0, 5);
  });

  ngOnInit() {
    console.log('AsignacionGruposPage loaded - Kanban Compact Version');
    this.loadData();
  }

  async loadData() {
    try {
      const [gruposData, pubsData, privilegiosData] = await Promise.all([
        lastValueFrom(this.http.get<Grupo[]>('/api/grupos/')),
        lastValueFrom(this.http.get<Publicador[]>('/api/publicadores/')),
        lastValueFrom(this.privilegiosService.getPrivilegios())
      ]);

      this.grupos.set(gruposData || []);
      this.privilegiosCatalogo.set(privilegiosData || []);

      // Guardar estado inicial para detectar cambios
      const newInitialState = new Map<number, number | null>();
      (pubsData || []).forEach(p => {
        newInitialState.set(p.id_publicador, p.id_grupo_publicador || null);
      });
      this.initialState.set(newInitialState);

      // Guardar estado inicial de líderes
      const newInitialLeaderState = new Map<number, { capitan: string | undefined, auxiliar: string | undefined }>();
      this.pendingLeaderChanges.clear();
      (gruposData || []).forEach(g => {
        newInitialLeaderState.set(g.id_grupo, {
          capitan: g.capitan_grupo,
          auxiliar: g.auxiliar_grupo
        });
      });
      this.initialLeaderState.set(newInitialLeaderState);

      await this.loadAllPublicadorPrivilegios(pubsData || []);
      this.publicadores.set(pubsData || []);

    } catch (err) {
      console.error('Error cargando datos', err);
      alert('Error al cargar datos. Ver consola.');
    }
  }

  // Cargar privilegios de todos los publicadores de forma eficiente
  async loadAllPublicadorPrivilegios(publicadores: Publicador[]) {
    try {
      const allPrivilegios = await lastValueFrom(
        this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/')
      );

      console.log('📌 Privilegios cargados desde API:', allPrivilegios);
      console.log('📌 Catálogo de privilegios:', this.privilegiosCatalogo());

      const today = new Date().toISOString().split('T')[0];
      const privilegiosMap = new Map<number, number[]>();

      for (const pp of (allPrivilegios || [])) {
        if (!pp.fecha_fin || pp.fecha_fin >= today) {
          if (!privilegiosMap.has(pp.id_publicador)) {
            privilegiosMap.set(pp.id_publicador, []);
          }
          privilegiosMap.get(pp.id_publicador)!.push(pp.id_privilegio);
        }
      }

      console.log('📌 Mapa de privilegios por publicador:', Object.fromEntries(privilegiosMap));

      this.publicadorPrivilegiosMap.set(privilegiosMap);
    } catch (err) {
      console.error('❌ Error cargando privilegios de publicadores', err);
    }
  }

  // Helpers
  getGroupMembers(groupId: number): Publicador[] {
    return this.publicadores()
      .filter(p => p.id_grupo_publicador === groupId)
      .sort((a, b) => a.primer_nombre.localeCompare(b.primer_nombre));
  }

  isModified(p: Publicador): boolean {
    const original = this.initialState().get(p.id_publicador);
    const current = p.id_grupo_publicador || null;
    return original !== current;
  }

  getInitials(p: Publicador): string {
    return (p.primer_nombre.charAt(0) + p.primer_apellido.charAt(0)).toUpperCase();
  }

  getAvatarColor(id: number): string {
    const colors = ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#9D4EDD', '#FF9F1C'];
    return colors[id % colors.length];
  }

  getGroupColorClass(id: number): string {
    const colors = ['bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500'];
    return colors[id % colors.length];
  }

  // Obtener tags de privilegios para mostrar en la tarjeta del publicador
  getPrivilegioTags(p: Publicador): { label: string; class: string; icon: string }[] {
    const tags: { label: string; class: string; icon: string }[] = [];
    const privilegiosMap = this.publicadorPrivilegiosMap();
    const privilegiosIds = privilegiosMap.get(p.id_publicador) || [];
    const catalogo = this.privilegiosCatalogo();

    const privilegioConfig: { [key: string]: { label: string; class: string; icon: string } } = {
      'anciano': {
        label: 'Anciano',
        class: 'text-indigo-700 bg-indigo-50 border border-indigo-200',
        icon: 'M12 14l9-5-9-5-9 5 9 5zm0 7l-9-5 9-5 9 5-9 5z'
      },
      'siervo ministerial': {
        label: 'Siervo Ministerial',
        class: 'text-purple-700 bg-purple-50 border border-purple-200',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z'
      },
      'precursor regular': {
        label: 'Precursor Regular',
        class: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
      },
      'precursor auxiliar': {
        label: 'Precursor Auxiliar',
        class: 'text-amber-700 bg-amber-50 border border-amber-200',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
      },
    };

    for (const idPrivilegio of privilegiosIds) {
      const privilegio = catalogo.find(pr => pr.id_privilegio === idPrivilegio);
      if (privilegio) {
        const nombreLower = privilegio.nombre_privilegio.toLowerCase().trim();
        for (const [key, config] of Object.entries(privilegioConfig)) {
          if (nombreLower.includes(key)) {
            tags.push(config);
            break;
          }
        }
      }
    }

    return tags;
  }

  getPrivilegioTagsByName(nombreCompleto: string | undefined): { label: string; class: string; icon: string }[] {
    if (!nombreCompleto) return [];

    const nombreBuscado = nombreCompleto.toLowerCase().trim();

    const publicador = this.publicadores().find(p => {
      const nombres = [
        `${p.primer_nombre} ${p.primer_apellido}`,
        `${p.primer_nombre} ${p.segundo_nombre || ''} ${p.primer_apellido}`.replace(/\s+/g, ' '),
        `${p.primer_nombre} ${p.primer_apellido} ${p.segundo_apellido || ''}`.replace(/\s+/g, ' '),
        `${p.primer_nombre} ${p.segundo_nombre || ''} ${p.primer_apellido} ${p.segundo_apellido || ''}`.replace(/\s+/g, ' ')
      ].map(n => n.toLowerCase().trim());

      return nombres.some(n => n === nombreBuscado);
    });

    if (!publicador) return [];

    return this.getPrivilegioTags(publicador);
  }

  goBack() {
    if (this.pendingChangesCount() > 0) {
      if (!confirm('Tienes cambios sin guardar. ¿Seguro que quieres salir?')) return;
    }
    this.router.navigate(['/secretario/publicadores'], { queryParams: { tab: 'grupos' } });
  }

  // Drag & Drop Logic
  onDragStart(e: DragEvent, p: Publicador) {
    this.draggedItem = p;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(p));
    }
  }

  onDragOver(e: DragEvent, targetId: number | 'unassigned') {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    this.isDraggingOver.set(targetId);
  }

  onDragLeave() {
    this.isDraggingOver.set(null);
  }

  onDrop(e: DragEvent, targetGroupId: number | null) {
    e.preventDefault();
    this.isDraggingOver.set(null);

    if (!this.draggedItem) return;

    const p = this.draggedItem;
    const oldGroupId = p.id_grupo_publicador;

    this.draggedItem = null;

    if (oldGroupId !== targetGroupId) {
      this.publicadores.update(current => {
        return current.map(item => {
          if (item.id_publicador === p.id_publicador) {
            return { ...item, id_grupo_publicador: targetGroupId };
          }
          return item;
        });
      });
    }
  }

  // --- Leader Drag & Drop ---

  onDragOverLeader(e: DragEvent, groupId: number, role: 'capitan' | 'auxiliar') {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    this.isDraggingOverLeader.set({ groupId, role });
    this.isDraggingOver.set(null);
  }

  onDragLeaveLeader() {
    this.isDraggingOverLeader.set(null);
  }

  onDropLeader(e: DragEvent, groupId: number, role: 'capitan' | 'auxiliar') {
    e.preventDefault();
    e.stopPropagation();
    this.isDraggingOverLeader.set(null);

    if (!this.draggedItem) return;
    const p = this.draggedItem;
    this.draggedItem = null;

    const fullName = `${p.primer_nombre} ${p.primer_apellido}${p.segundo_apellido ? ' ' + p.segundo_apellido : ''}`.trim();

    this.grupos.update(currentGrupos => {
      return currentGrupos.map(g => {
        if (g.id_grupo === groupId) {
          if (role === 'capitan') {
            return { ...g, capitan_grupo: fullName };
          } else {
            return { ...g, auxiliar_grupo: fullName };
          }
        }
        return g;
      });
    });
  }

  removeLeader(groupId: number, role: 'capitan' | 'auxiliar') {
    if (!confirm(`¿Estás seguro de quitar al ${role} de este grupo?`)) return;

    this.grupos.update(currentGrupos => {
      return currentGrupos.map(g => {
        if (g.id_grupo === groupId) {
          if (role === 'capitan') {
            return { ...g, capitan_grupo: undefined };
          } else {
            return { ...g, auxiliar_grupo: undefined };
          }
        }
        return g;
      });
    });
  }

  isLeaderModified(groupId: number, role: 'capitan' | 'auxiliar'): boolean {
    const group = this.grupos().find(g => g.id_grupo === groupId);
    const initial = this.initialLeaderState().get(groupId);
    if (!group || !initial) return false;

    if (role === 'capitan') {
      return (group.capitan_grupo || '') !== (initial.capitan || '');
    } else {
      return (group.auxiliar_grupo || '') !== (initial.auxiliar || '');
    }
  }

  getPrecursoresCount(groupId: number): number {
    const members = this.getGroupMembers(groupId);
    let count = 0;
    const catalogo = this.privilegiosCatalogo();
    const map = this.publicadorPrivilegiosMap();

    for (const p of members) {
      const ids = map.get(p.id_publicador);
      if (ids) {
        const isPrec = ids.some(id => {
          const priv = catalogo.find(pr => pr.id_privilegio === id);
          return priv && priv.nombre_privilegio.toLowerCase().includes('precursor');
        });
        if (isPrec) count++;
      }
    }
    return count;
  }

  // Save
  async saveChanges() {
    const modifiedPubs = this.publicadores().filter(p => this.isModified(p));

    const modifiedGroups = this.grupos().filter(g =>
      this.isLeaderModified(g.id_grupo, 'capitan') || this.isLeaderModified(g.id_grupo, 'auxiliar')
    );

    if (modifiedPubs.length === 0 && modifiedGroups.length === 0) return;

    this.isSaving.set(true);
    try {
      const promises: Promise<any>[] = [];

      // 1. Save Publisher Changes
      if (modifiedPubs.length > 0) {
        const pubPromises = modifiedPubs.map(p => {
          const payload = {
            id_grupo_publicador: p.id_grupo_publicador
          };
          return lastValueFrom(this.http.put(`/api/publicadores/${p.id_publicador}`, payload));
        });
        promises.push(...pubPromises);
      }

      // 2. Save Group Leader Changes
      if (modifiedGroups.length > 0) {
        const groupPromises = modifiedGroups.map(g => {
          const payload = {
            capitan_grupo: g.capitan_grupo,
            auxiliar_grupo: g.auxiliar_grupo
          };
          return lastValueFrom(this.http.put(`/api/grupos/${g.id_grupo}`, payload));
        });
        promises.push(...groupPromises);
      }

      await Promise.all(promises);

      // Update initial state to match current state (This triggers pendingChangesCount to drop to 0)
      const newInitialState = new Map<number, number | null>();
      this.publicadores().forEach(p => {
        newInitialState.set(p.id_publicador, p.id_grupo_publicador || null);
      });
      this.initialState.set(newInitialState);

      const newInitialLeaderState = new Map<number, { capitan: string | undefined, auxiliar: string | undefined }>();
      this.grupos().forEach(g => {
        newInitialLeaderState.set(g.id_grupo, {
          capitan: g.capitan_grupo,
          auxiliar: g.auxiliar_grupo
        });
      });
      this.initialLeaderState.set(newInitialLeaderState);

      // Show success message
      this.showSuccessMessage.set(true);
      setTimeout(() => {
        this.showSuccessMessage.set(false);
      }, 4000);

    } catch (err) {
      console.error('Error saving changes', err);
      alert('Error al guardar cambios. Intenta nuevamente.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
