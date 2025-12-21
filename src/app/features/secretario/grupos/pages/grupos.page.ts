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
   selector: 'app-grupos-page',
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
    <div class="h-full flex flex-col w-full max-w-[1600px] mx-auto p-6 md:p-8 space-y-8 overflow-y-auto scroll-smooth simple-scrollbar">
      
      <!-- 1. Header & Main Action -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-3xl font-black text-slate-900 tracking-tight">Gestión de Grupos</h1>
          <p class="text-slate-500 mt-1 text-base">Administra los grupos de predicación y sus asignaciones actuales.</p>
        </div>
        <div class="flex items-center gap-3">
            <button 
              (click)="goToDynamicAssignment()"
              class="inline-flex items-center gap-2 px-5 py-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95"
            >
              <svg class="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
              Asignación Dinámica
            </button>
            <button 
              (click)="openCreatePanel()"
              class="inline-flex items-center gap-2 px-6 py-3 bg-[#5B3C88] hover:bg-[#4a2f73] text-white rounded-xl font-bold text-sm shadow-xl shadow-purple-900/20 transition-all active:scale-95 group"
            >
              <svg class="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M5 12h14"/></svg>
              Nuevo Grupo
            </button>
        </div>
      </div>

      <!-- 2. KPI Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
         <!-- Total Grupos -->
         <div class="bg-white rounded-2xl p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 flex items-center gap-5 relative overflow-hidden">
            <div class="absolute right-0 top-0 w-32 h-32 bg-purple-50/50 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div class="w-14 h-14 rounded-2xl bg-purple-50 text-[#5B3C88] flex items-center justify-center shrink-0 relative z-10">
               <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
            </div>
            <div class="relative z-10">
               <p class="text-sm font-semibold text-slate-500 mb-0.5">Total Grupos</p>
               <h3 class="text-3xl font-black text-slate-800 tracking-tight">{{ grupos().length }}</h3>
            </div>
         </div>

         <!-- Publicadores Asignados (Mock) -->
         <div class="bg-white rounded-2xl p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 flex items-center gap-5 relative overflow-hidden">
            <div class="absolute right-0 top-0 w-32 h-32 bg-emerald-50/50 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div class="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 relative z-10">
               <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </div>
            <div class="relative z-10">
               <p class="text-sm font-semibold text-slate-500 mb-0.5">Publicadores Asignados</p>
               <h3 class="text-3xl font-black text-slate-800 tracking-tight">{{ totalAsignados() }}</h3>
            </div>
         </div>

         <!-- Sin Asignar (Mock) -->
         <div class="bg-white rounded-2xl p-6 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] border border-slate-100 flex items-center gap-5 relative overflow-hidden">
            <div class="absolute right-0 top-0 w-32 h-32 bg-orange-50/50 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <div class="w-14 h-14 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 relative z-10">
               <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <div class="relative z-10">
               <p class="text-sm font-semibold text-slate-500 mb-0.5">Sin Asignar</p>
               <h3 class="text-3xl font-black text-slate-800 tracking-tight">{{ totalSinAsignar() }}</h3>
            </div>
         </div>
      </div>



      <!-- 4. Main Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <div class="overflow-x-auto simple-scrollbar">
             <table class="w-full min-w-[800px]">
                <thead>
                   <tr class="border-b border-slate-100 bg-white sticky top-0 z-20 shadow-sm">
                      <th class="px-8 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-white">Nombre del Grupo</th>
                      <th class="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-white">Capitán</th>
                      <th class="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-white">Auxiliar</th>
                      <th class="px-6 py-5 text-left text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-white">Miembros</th>
                      <th class="px-8 py-5 text-right text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-white">Acciones</th>
                   </tr>
                </thead>
                <tbody class="divide-y divide-slate-50">
                   <tr *ngFor="let grupo of filteredGrupos(); let i = index" class="group hover:bg-slate-50/80 transition-colors">
                      
                      <!-- Nombre -->
                      <td class="px-8 py-5">
                         <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 shadow-sm border border-white"
                                 [ngClass]="getAvatarColor(i)">
                               {{ grupo.nombre_grupo.charAt(0).toUpperCase() }}
                            </div>
                            <div>
                               <p class="font-bold text-slate-900 text-base">{{ grupo.nombre_grupo }}</p>
                               <p class="text-xs text-slate-400 font-medium mt-0.5">ID: #{{ grupo.id_grupo }}</p>
                            </div>
                         </div>
                      </td>

                      <!-- Capitán (Antes Supervisor) -->
                      <td class="px-6 py-5">
                         <div class="flex items-center gap-3" *ngIf="grupo.capitan_grupo; else noCapitan">
                             <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                             </div>
                             <span class="font-semibold text-slate-700">{{ grupo.capitan_grupo }}</span>
                         </div>
                         <ng-template #noCapitan>
                             <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-xs font-bold">
                                Sin Asignar
                             </span>
                         </ng-template>
                      </td>

                      <!-- Auxiliar (Movido después de Capitán) -->
                      <td class="px-6 py-5">
                          <span *ngIf="grupo.auxiliar_grupo" class="text-sm font-medium text-slate-600">{{ grupo.auxiliar_grupo }}</span>
                          <span *ngIf="!grupo.auxiliar_grupo" class="text-slate-300 text-sm italic">--</span>
                      </td>

                      <!-- Miembros (Pill) -->
                      <td class="px-6 py-5">
                         <div class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-50 border border-slate-100">
                            <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            <span class="text-sm font-bold text-slate-700">{{ grupo.cantidad_publicadores || 0 }} Publicadores</span>
                         </div>
                      </td>

                      <!-- Acciones -->
                      <td class="px-8 py-5 text-right">
                         <div class="flex items-center justify-end gap-3">
                            <button (click)="goToAssignment(grupo)" class="hidden lg:flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-50 text-[#5B3C88] border border-purple-100 text-xs font-bold hover:bg-purple-100 transition-colors">
                               <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                               Asignar
                            </button>
                            
                            <div class="relative group/menu">
                                <button class="p-2 rounded-lg hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-colors">
                                   <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                </button>
                                <!-- Tooltip Menu -->
                                <div class="absolute right-0 top-10 w-40 bg-white rounded-xl shadow-xl border border-slate-100 p-1 opacity-0 group-hover/menu:opacity-100 invisible group-hover/menu:visible transition-all z-20 flex flex-col transform translate-y-2 group-hover/menu:translate-y-0">
                                   <button (click)="editGrupo(grupo)" class="flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg text-left">
                                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                      Editar Grupo
                                   </button>
                                   <button (click)="confirmDelete(grupo)" class="flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg text-left">
                                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
          
           <!-- Footer Pagination (Removed as requested) -->
           <div class="px-8 py-5 border-t border-slate-50 flex items-center justify-between bg-white/50" *ngIf="grupos().length > 0">
               <p class="text-xs font-semibold text-slate-400">
                   Total: <span class="text-slate-900 font-bold">{{ grupos().length }}</span> grupos
               </p>
           </div>
      </div>

      <!-- 5. Slide Over Panel (Create/Edit) -->
      <div *ngIf="panelOpen()" class="fixed inset-0 z-50 overflow-hidden" @fadeIn>
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" (click)="closePanel()"></div>
          
          <!-- Panel -->
          <div class="absolute inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col" @slideOver>
             <!-- Header -->
             <div class="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div>
                    <h2 class="text-xl font-black text-slate-900">{{ editingGrupo() ? 'Editar Grupo' : 'Nuevo Grupo' }}</h2>
                    <p class="text-xs font-medium text-slate-500 mt-1">Completa los detalles del grupo de servicio.</p>
                 </div>
                 <button (click)="closePanel()" class="p-2 rounded-lg text-slate-400 hover:bg-white hover:text-slate-600 hover:shadow-sm transition-all">
                    <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                 </button>
             </div>
             
             <!-- Body -->
             <div class="flex-1 overflow-y-auto p-8 bg-white simple-scrollbar">
                <form [formGroup]="grupoForm" (ngSubmit)="save()" class="space-y-6">
                    
                    <div class="space-y-2">
                       <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Nombre del Grupo</label>
                       <input formControlName="nombre_grupo" type="text" placeholder="Ej: Grupo Centro" class="w-full px-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-[#5B3C88] focus:ring-4 focus:ring-[#5B3C88]/10 transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                       <p *ngIf="grupoForm.get('nombre_grupo')?.touched && grupoForm.get('nombre_grupo')?.invalid" class="text-xs text-red-500 font-bold">Campo requerido</p>
                    </div>

                    <div class="space-y-2">
                       <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Capitán (Supervisor)</label>
                       <div class="relative">
                          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                             <svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                          </div>
                          <input formControlName="capitan_grupo" type="text" placeholder="Nombre completo" class="w-full pl-11 pr-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-[#5B3C88] focus:ring-4 focus:ring-[#5B3C88]/10 transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                       </div>
                    </div>

                    <div class="space-y-2">
                       <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Auxiliar</label>
                       <div class="relative">
                          <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                             <svg class="w-5 h-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                          </div>
                          <input formControlName="auxiliar_grupo" type="text" placeholder="Nombre completo" class="w-full pl-11 pr-4 py-3 bg-[#f8f9fc] border border-transparent rounded-xl text-sm font-semibold text-slate-700 focus:bg-white focus:border-[#5B3C88] focus:ring-4 focus:ring-[#5B3C88]/10 transition-all outline-none placeholder:text-slate-400 placeholder:font-normal">
                       </div>
                    </div>

                </form>
             </div>

             <!-- Footer -->
             <div class="p-6 border-t border-slate-100 flex items-center justify-end gap-3 bg-white">
                <button (click)="closePanel()" class="px-6 py-3 rounded-xl text-slate-500 hover:bg-slate-50 font-bold text-sm transition-colors">Cancelar</button>
                <button (click)="save()" [disabled]="grupoForm.invalid || saving()" class="px-8 py-3 rounded-xl bg-[#5B3C88] text-white font-bold text-sm hover:bg-[#4a2f73] shadow-lg shadow-purple-900/20 active:scale-95 transition-all disabled:opacity-50">
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
export class GruposPage implements OnInit {
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
      this.http.get<any[]>('/api/publicadores/').subscribe({
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
         const data = await lastValueFrom(this.gruposService.getGrupos());
         this.grupos.set(data);
      } catch (err) {
         console.error('Error cargando grupos', err);
      } finally {
         this.loading.set(false);
      }
   }

   // Helpers
   getAvatarColor(index: number): string {
      const colors = [
         'bg-purple-100 text-[#5B3C88]',
         'bg-blue-100 text-blue-600',
         'bg-emerald-100 text-emerald-600',
         'bg-orange-100 text-orange-600',
         'bg-pink-100 text-pink-600'
      ];
      return colors[index % colors.length];
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
