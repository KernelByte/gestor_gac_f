import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
import { lastValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';

import { GruposService } from '../services/grupos.service';
import { Grupo } from '../models/grupo.model';
import { AuthStore } from '../../../../core/auth/auth.store';

@Component({
   standalone: true,
   selector: 'app-grupos-list',
   imports: [CommonModule, ReactiveFormsModule],
   animations: [
      trigger('slideOver', [
         transition(':enter', [
            style({ transform: 'translateX(100%)', opacity: 0 }),
            animate('500ms cubic-bezier(0.25, 1, 0.5, 1)', style({ transform: 'translateX(0)', opacity: 1 }))
         ]),
         transition(':leave', [
            animate('400ms cubic-bezier(0.25, 1, 0.5, 1)', style({ transform: 'translateX(100%)', opacity: 0 }))
         ])
      ]),
      trigger('fadeIn', [
         transition(':enter', [
            style({ opacity: 0 }),
            animate('300ms ease-out', style({ opacity: 1 }))
         ]),
         transition(':leave', [
            animate('200ms ease-in', style({ opacity: 0 }))
         ])
      ])
   ],
   template: `
    <div class="flex flex-col gap-6">
      
      <!-- Top Actions -->
      <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <!-- Title removed (handled by parent) -->
            <div></div>
            
            <div class="flex gap-3">
               <button 
                  (click)="goToDynamicAssignment()"
                  class="inline-flex items-center gap-2 px-5 h-12 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-display font-bold text-sm shadow-sm transition-all active:scale-95"
               >
                  <svg class="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                  Asignación Dinámica
               </button>
               <button 
                  (click)="openCreatePanel()"
                  class="inline-flex items-center gap-2 px-6 h-12 bg-brand-orange hover:bg-orange-600 text-white rounded-xl font-display font-bold text-sm shadow-xl shadow-orange-900/20 transition-all active:scale-95 group"
               >
                  <svg class="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
                  Nuevo Grupo
               </button>
            </div>
      </div>

      <!-- KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
         <!-- Total Grupos -->
         <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden group hover:shadow-md transition-all">
            <div class="absolute right-0 top-0 w-32 h-32 bg-orange-50/50 rounded-full -mr-10 -mt-10 blur-2xl transition-opacity opacity-50 group-hover:opacity-100"></div>
            <div class="w-14 h-14 rounded-2xl bg-orange-50 text-brand-orange flex items-center justify-center shrink-0 relative z-10 ring-1 ring-orange-100">
               <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            </div>
            <div class="relative z-10">
               <p class="text-sm font-bold text-slate-500 uppercase tracking-wide mb-0.5">Total Grupos</p>
               <h3 class="text-3xl font-display font-black text-slate-800 tracking-tight">{{ grupos().length }}</h3>
            </div>
         </div>

         <!-- Publicadores Asignados -->
         <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden group hover:shadow-md transition-all">
            <div class="absolute right-0 top-0 w-32 h-32 bg-emerald-50/50 rounded-full -mr-10 -mt-10 blur-2xl transition-opacity opacity-50 group-hover:opacity-100"></div>
            <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 relative z-10 ring-1 ring-emerald-100">
               <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div class="relative z-10">
               <p class="text-sm font-bold text-slate-500 uppercase tracking-wide mb-0.5">Asignados</p>
               <h3 class="text-3xl font-display font-black text-slate-800 tracking-tight">{{ totalAsignados() }}</h3>
            </div>
         </div>

         <!-- Sin Asignar -->
         <!-- Sin Asignar -->
         <div class="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex items-center gap-5 relative overflow-hidden group hover:shadow-md transition-all">
            <!-- Background Blob -->
            <div class="absolute right-0 top-0 w-32 h-32 rounded-full -mr-10 -mt-10 blur-2xl transition-opacity opacity-50 group-hover:opacity-100"
                 [ngClass]="totalSinAsignar() > 0 ? 'bg-red-50/50' : 'bg-slate-100/50'"></div>
            
            <!-- Icon -->
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 relative z-10 ring-1"
                 [ngClass]="totalSinAsignar() > 0 ? 'bg-red-50 text-red-500 ring-red-100' : 'bg-slate-50 text-slate-400 ring-slate-100'">
               <svg *ngIf="totalSinAsignar() > 0" class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
               <svg *ngIf="totalSinAsignar() === 0" class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            
            <div class="relative z-10">
               <p class="text-sm font-bold text-slate-500 uppercase tracking-wide mb-0.5">Sin Asignar</p>
               <h3 class="text-3xl font-display font-black tracking-tight"
                   [ngClass]="totalSinAsignar() > 0 ? 'text-red-900' : 'text-slate-700'">
                   {{ totalSinAsignar() }}
               </h3>
               <p *ngIf="totalSinAsignar() === 0" class="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1">
                  ¡Todo en orden!
               </p>
            </div>
         </div>
      </div>

      <!-- Main Table -->
      <div *ngIf="filteredGrupos().length > 0; else emptyState" class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div class="overflow-x-auto simple-scrollbar">
             <table class="w-full min-w-[800px]">
                <thead>
                   <tr class="border-b border-slate-200 bg-slate-50/80 backdrop-blur-md sticky top-0 z-20">
                      <th class="px-8 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Nombre del Grupo</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Capitán</th>
                      <th class="px-6 py-4 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">Auxiliar</th>
                      <th class="px-6 py-4 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">Miembros</th>
                      <th class="px-8 py-4 text-right text-xs font-bold text-slate-400 uppercase tracking-wider">Acciones</th>
                   </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                   <tr *ngFor="let grupo of filteredGrupos(); let i = index" class="group hover:bg-slate-50 transition-colors">
                      
                      <!-- Nombre -->
                      <td class="px-8 py-5">
                         <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                                 [ngClass]="getAvatarClass(grupo.id_grupo)">
                               <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                                  <circle cx="9" cy="7" r="4"></circle>
                                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                               </svg>
                            </div>
                            <div>
                               <p class="font-bold text-slate-700 text-base font-display">{{ grupo.nombre_grupo }}</p>
                               <p *ngIf="isAdminOrGestor()" class="text-xs text-slate-400 font-medium mt-0.5">ID: #{{ grupo.id_grupo }}</p>
                            </div>
                         </div>
                      </td>

                      <!-- Capitán -->
                      <td class="px-6 py-5">
                         <div class="flex items-center gap-3" *ngIf="grupo.capitan_grupo; else noCapitan">
                             <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 ring-1 ring-white">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                             </div>
                             <span class="text-sm font-medium text-slate-600">{{ grupo.capitan_grupo }}</span>
                         </div>
                         <ng-template #noCapitan>
                             <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-slate-400 text-[11px] font-bold border border-slate-100/50">
                                Sin Asignar
                             </span>
                         </ng-template>
                      </td>

                      <!-- Auxiliar -->
                      <td class="px-6 py-5">
                         <div class="flex items-center gap-3" *ngIf="grupo.auxiliar_grupo; else noAuxiliar">
                             <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 ring-1 ring-white">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                             </div>
                             <span class="text-sm font-medium text-slate-600">{{ grupo.auxiliar_grupo }}</span>
                         </div>
                         <ng-template #noAuxiliar>
                             <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 text-slate-400 text-[11px] font-bold border border-slate-100/50">
                                Sin Asignar
                             </span>
                         </ng-template>
                      </td>

                      <!-- Miembros -->
                      <td class="px-6 py-5 text-center">
                          <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-[11px] font-bold">
                             {{ grupo.cantidad_publicadores || 0 }} Publicadores
                          </span>
                      </td>

                      <!-- Acciones -->
                      <td class="px-8 py-5 text-right">
                         <div class="flex items-center justify-end gap-2">
                            <button (click)="goToAssignment(grupo)" class="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-50 text-brand-orange border border-orange-100/50 text-xs font-bold hover:bg-orange-100 transition-colors shadow-sm">
                               <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                               Asignar
                            </button>
                            
                            <div class="relative group/menu">
                                <button class="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                                   <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                                </button>
                                <!-- Dropdown -->
                                <div class="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl shadow-slate-200/50 border border-slate-100 p-1.5 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 transform translate-y-2 group-hover/menu:translate-y-0">
                                   <button (click)="editGrupo(grupo)" class="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-lg text-left transition-colors">
                                      <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                      Editar Grupo
                                   </button>
                                   <button (click)="confirmDelete(grupo)" class="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 rounded-lg text-left transition-colors">
                                      <svg class="w-4 h-4 text-rose-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                      Eliminar
                                   </button>
                                </div>
                            </div>
                         </div>
                      </td>
                   </tr>
                </tbody>
             </table>
          </div>
          
          <div class="px-8 py-4 border-t border-slate-50 bg-slate-50/50 flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-400">Total: {{ grupos().length }} registros</span>
          </div>
      </div>

      <!-- Empty State -->
      <ng-template #emptyState>
        <div class="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-12 flex flex-col items-center justify-center text-center">
            <div class="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
                <svg class="w-8 h-8 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <h3 class="text-lg font-bold text-slate-900 mb-1">No hay grupos creados</h3>
            <p class="text-slate-500 max-w-sm mb-6">Comienza creando tu primer grupo de predicación para asignar publicadores.</p>
            <button (click)="openCreatePanel()" class="inline-flex items-center gap-2 px-6 py-3 bg-brand-orange text-white rounded-xl font-bold shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all active:scale-95">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                Crear Grupo
            </button>
        </div>
      </ng-template>

      <!-- Slide Over Panel -->
      <div *ngIf="panelOpen()" class="fixed inset-0 z-50 overflow-hidden" @fadeIn>
          <div class="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" (click)="closePanel()"></div>
          
          <div class="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col" @slideOver>
             <!-- Header -->
             <div class="px-8 pt-8 pb-6 shrink-0 bg-white border-b border-slate-50">
                 <div class="flex items-start justify-between">
                      <div class="flex gap-4">
                          <div class="w-12 h-12 rounded-xl bg-orange-50 text-brand-orange flex items-center justify-center shrink-0">
                               <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
                          </div>
                          <div>
                              <div class="flex items-center gap-2 mb-1">
                                 <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                                   {{ editingGrupo() ? 'Edición' : 'Nuevo' }}
                                 </span>
                              </div>
                              <h2 class="text-2xl font-display font-black text-slate-900 tracking-tight">
                                  {{ editingGrupo() ? 'Editar Grupo' : 'Crear Grupo' }}
                              </h2>
                          </div>
                      </div>
                     <button (click)="closePanel()" class="p-2 -mr-2 text-slate-300 hover:text-slate-500 transition-colors rounded-full hover:bg-slate-50">
                         <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                     </button>
                 </div>
             </div>
             
             <!-- Body -->
             <div class="flex-1 overflow-y-auto p-8 bg-white simple-scrollbar">
                <form [formGroup]="grupoForm" (ngSubmit)="save()" class="space-y-6">
                    
                    <div class="space-y-2">
                       <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre del Grupo</label>
                       <input formControlName="nombre_grupo" type="text" placeholder="Ej: Grupo Centro" class="w-full px-4 py-3 bg-slate-50 border border-transparent rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                       <p *ngIf="grupoForm.get('nombre_grupo')?.touched && grupoForm.get('nombre_grupo')?.invalid" class="text-xs text-red-500 font-bold">Campo requerido</p>
                    </div>

                    <div class="space-y-2">
                       <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Capitán (Supervisor)</label>
                       <div class="relative">
                          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                             <svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          </div>
                          <input formControlName="capitan_grupo" type="text" placeholder="Nombre completo" class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                       </div>
                    </div>

                    <div class="space-y-2">
                       <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Auxiliar</label>
                       <div class="relative">
                          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                             <svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                          </div>
                          <input formControlName="auxiliar_grupo" type="text" placeholder="Nombre completo" class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-transparent rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-brand-orange focus:ring-4 focus:ring-brand-orange/10 transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                       </div>
                    </div>

                </form>
             </div>

             <!-- Footer -->
             <div class="px-8 py-6 border-t border-slate-100 bg-slate-50/80 backdrop-blur-sm flex items-center justify-end gap-3 shrink-0 relative z-20">
                <button (click)="closePanel()" class="px-6 h-12 rounded-xl hover:bg-white border border-transparent hover:border-slate-200 text-slate-500 font-bold text-sm transition-all focus:outline-none">Cancelar</button>
                <button (click)="save()" [disabled]="grupoForm.invalid || saving()" class="px-8 h-12 rounded-xl bg-brand-orange text-white font-bold text-sm hover:bg-orange-600 shadow-lg shadow-orange-900/20 active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500">
                   {{ saving() ? 'Guardando...' : 'Guardar Cambios' }}
                </button>
             </div>
          </div>
      </div>
    </div>
  `,
   styles: [`
    :host { display: block; height: 100%; }
    .simple-scrollbar::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    .simple-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .simple-scrollbar::-webkit-scrollbar-thumb {
      background: #e2e8f0;
      border-radius: 4px;
    }
    .simple-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #cbd5e1;
    }
  `]
})
export class GruposListComponent implements OnInit {
   private gruposService = inject(GruposService);
   private authStore = inject(AuthStore);
   private fb = inject(FormBuilder);
   private router = inject(Router);
   private http = inject(HttpClient);

   grupos = signal<Grupo[]>([]);
   totalSinAsignar = signal(0);
   searchControl = this.fb.control('');

   // Pagination
   // Pagination (Removed)
   // currentPage = signal(1);
   // pageSize = signal(5);

   // Computed & Filtering is simple for now, can be improved with streams
   // Computed & Filtering (No Pagination)
   filteredGrupos = computed(() => {
      let data = this.grupos();
      const query = this.searchControl.value?.toLowerCase() || '';
      if (query) {
         data = data.filter(g => g.nombre_grupo.toLowerCase().includes(query) || g.capitan_grupo?.toLowerCase().includes(query));
      }
      return data;
   });

   // totalPages = computed(() => Math.ceil(this.grupos().length / this.pageSize()));

   totalAsignados = computed(() => this.grupos().reduce((acc, g) => acc + (g.cantidad_publicadores || 0), 0));

   // Check if current user is Admin or Gestor Aplicación
   isAdminOrGestor = computed(() => {
      const user = this.authStore.user();
      const rol = user?.rol?.toLowerCase() || '';
      return rol.includes('admin') || rol.includes('gestor');
   });

   loading = signal(false);
   saving = signal(false);
   panelOpen = signal(false);
   editingGrupo = signal<Grupo | null>(null);

   grupoForm: FormGroup;

   constructor() {
      this.grupoForm = this.fb.group({
         nombre_grupo: ['', [Validators.required]],
         capitan_grupo: [''],
         auxiliar_grupo: ['']
      });

      // this.searchControl.valueChanges.subscribe(() => {
      //    this.currentPage.set(1);
      // });
   }

   ngOnInit() {
      this.loadGrupos();
      this.loadSinAsignar();
   }

   loadSinAsignar() {
      const user = this.authStore.user();
      const params: any = {};

      if (user?.id_congregacion) {
         params.id_congregacion = user.id_congregacion;
      }

      this.http.get<any[]>('/api/publicadores/', { params }).subscribe({
         next: (pubs) => {
            const count = pubs.filter(p => !p.id_grupo_publicador).length;
            this.totalSinAsignar.set(count);
         },
         error: (err) => console.error('Error loading unassigned stats', err)
      });
   }

   async loadGrupos() {
      this.loading.set(true);
      try {
         const user = this.authStore.user();
         const params: any = {};

         if (user?.id_congregacion) {
            params.id_congregacion = user.id_congregacion;
         }

         const data = await lastValueFrom(this.gruposService.getGrupos(params));
         console.log('Grupos cargados:', data);
         console.log('Total asignados calculado:', data.reduce((acc, g) => acc + (g.cantidad_publicadores || 0), 0));
         this.grupos.set(data);
      } catch (err: any) {
         console.error('Error cargando grupos', err);
         // Optional: show toast or alert if needed for debugging
         // alert(err?.error?.detail || 'Error al cargar grupos');
      } finally {
         this.loading.set(false);
      }
   }

   // Helpers - Same orange style for all groups
   getAvatarClass(id: number): string {
      return 'bg-orange-50 text-brand-orange';
   }

   // CRUD Actions
   openCreatePanel() {
      this.editingGrupo.set(null);
      this.grupoForm.reset();
      this.panelOpen.set(true);
   }

   editGrupo(grupo: Grupo) {
      this.editingGrupo.set(grupo);
      this.grupoForm.patchValue({
         nombre_grupo: grupo.nombre_grupo,
         capitan_grupo: grupo.capitan_grupo,
         auxiliar_grupo: grupo.auxiliar_grupo
      });
      this.panelOpen.set(true);
   }

   closePanel() {
      this.panelOpen.set(false);
      setTimeout(() => { // Wait for animation
         this.grupoForm.reset();
         this.editingGrupo.set(null);
      }, 300);
   }

   async save() {
      if (this.grupoForm.invalid) return;

      const user = this.authStore.user();

      // Validar si tiene congregación o es Admin/Gestor (que no tienen)
      const isAdminOrGestor = user?.rol?.toLowerCase().includes('admin') || user?.rol?.toLowerCase().includes('gestor');

      if (!user?.id_congregacion && !isAdminOrGestor) {
         alert('Error: No se ha detectado tu congregación.');
         return;
      }

      this.saving.set(true);
      const formVal = this.grupoForm.value;

      // Determinar ID congregación
      let idCongregacion = user?.id_congregacion;

      // Si soy Admin y estoy editando, mantengo la congregación del grupo original
      if (this.editingGrupo()) {
         idCongregacion = this.editingGrupo()!.id_congregacion_grupo;
      }
      // Nota: Si soy Admin y creo uno nuevo, actualmente fallará si no hay selector.
      // Pero el usuario pidió arreglar la EDICIÓN.

      const payload = {
         ...formVal,
         id_congregacion_grupo: idCongregacion
      };

      try {
         if (this.editingGrupo()) {
            const id = this.editingGrupo()!.id_grupo;
            await lastValueFrom(this.gruposService.updateGrupo(id, payload));
         } else {
            await lastValueFrom(this.gruposService.createGrupo(payload));
         }
         this.closePanel();
         this.loadGrupos();
         this.loadSinAsignar(); // Reload unassigned count after saving
      } catch (err) {
         console.error('Error guardando grupo', err);
      } finally {
         this.saving.set(false);
      }
   }

   confirmDelete(grupo: Grupo) {
      if (confirm(`¿Estás seguro de eliminar el grupo "${grupo.nombre_grupo}"?`)) {
         this.deleteGrupo(grupo.id_grupo);
      }
   }

   async deleteGrupo(id: number) {
      try {
         await lastValueFrom(this.gruposService.deleteGrupo(id));
         this.loadGrupos();
      } catch (err) {
         console.error("Error al eliminar", err);
         alert("No se pudo eliminar el grupo. Puede tener publicadores asignados.");
      }
   }

   goToDynamicAssignment() {
      this.router.navigate(['/secretario/grupos/asignacion']);
   }

   goToAssignment(grupo: Grupo) {
      this.router.navigate(['/secretario/grupos/detalle-asignacion', grupo.id_grupo]);
   }

   // Pagination (Removed)
   // nextPage() { ... }
   // prevPage() { ... }
}
