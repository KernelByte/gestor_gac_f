import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { AuthStore } from '../../../../core/auth/auth.store';
import { PrivilegiosService } from '../../privilegios/infrastructure/privilegios.service';
import { Privilegio } from '../../privilegios/domain/models/privilegio';
import { PublicadorPrivilegio } from '../../privilegios/domain/models/publicador-privilegio';

interface Publicador {
   id_publicador: number;
   primer_nombre: string;
   primer_apellido: string;
   id_grupo_publicador?: number | null;
   id_estado_publicador?: number;
   rol?: any;
   selected?: boolean;
}

interface Grupo {
   id_grupo: number;
   nombre_grupo: string;
   capitan_grupo?: string;
}

@Component({
   standalone: true,
   selector: 'app-formulario-asignacion',
   imports: [CommonModule, FormsModule],
   template: `
    <div class="h-screen bg-[#F8F9FC] flex flex-col font-sans overflow-hidden">
      
      <!-- Minimalist Header -->
      <header class="bg-white/95 backdrop-blur-sm border-b border-slate-100 sticky top-0 z-40 shrink-0">
        <div class="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-4">
           
           <!-- Title & Back -->
           <div class="flex items-center gap-5 min-w-0">
              <button (click)="goBack()" class="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-white hover:shadow-sm transition-all active:scale-95 group">
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
              </button>
              <div class="flex flex-col min-w-0">
                 <h1 class="text-xl font-bold text-slate-900 tracking-tight truncate">Asignar Publicadores</h1>
                 <div class="flex items-center gap-2 text-sm font-medium text-slate-500">
                    <span class="text-xs uppercase tracking-wider font-bold text-slate-400">Grupo</span>
                    <span class="text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded text-xs tracking-wide truncate max-w-[250px]">{{ grupo()?.nombre_grupo || '...' }}</span>
                 </div>
              </div>
           </div>

           <!-- Actions -->
           <div class="flex items-center gap-3 shrink-0">
              <button 
                 (click)="goBack()"
                 class="hidden sm:flex px-5 py-2 rounded-lg text-slate-500 font-bold text-sm hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                 Cancelar
              </button>
              <button 
                 (click)="save()"
                 [disabled]="saving()"
                 class="px-6 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm tracking-wide hover:bg-orange-600 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-sm hover:shadow-orange-200"
              >
                 <svg *ngIf="saving()" class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                 <span>{{ saving() ? 'Guardando...' : 'Guardar Cambios' }}</span>
              </button>
           </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="flex-1 min-h-0 overflow-hidden p-6 sm:p-10 lg:p-12 pb-0">
         <div class="w-full max-w-[1920px] mx-auto h-full grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-8 lg:gap-16 items-start relative pb-8">
            
            <!-- LISTA: Disponibles (Left Panel) -->
            <div class="h-full bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
               
               <!-- Panel Header -->
               <div class="p-5 border-b border-slate-100 bg-white">
                  <div class="flex items-center justify-between mb-4">
                     <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                           <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <div>
                           <h2 class="text-base font-bold text-slate-800">Disponibles</h2>
                           <p class="text-[11px] font-semibold text-slate-400">Sin grupo asignado</p>
                        </div>
                     </div>
                     <span class="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-md">{{ filteredAvailable().length }}</span>
                  </div>
                  
                  <!-- Minimal Search -->
                  <div class="relative">
                     <input 
                        type="text" 
                        placeholder="Buscar..." 
                        class="w-full bg-slate-50 border-none text-slate-700 text-sm rounded-lg pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-orange-100 focus:bg-white transition-all placeholder:text-slate-400 font-medium"
                        [(ngModel)]="searchAvailable"
                     >
                     <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                     </div>
                  </div>
               </div>

               <!-- List Content -->
               <div class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-white">
                  <div 
                     *ngFor="let p of filteredAvailable()"
                     class="group relative flex items-center p-2.5 rounded-xl border border-transparent transition-all cursor-pointer select-none"
                     [ngClass]="{
                        'hover:bg-slate-50 hover:border-slate-100': !p.selected,
                        'bg-orange-50/50 border-orange-100': p.selected
                     }"
                     (click)="toggleSelection(p)"
                  >
                     <!-- Avatar & Info -->
                     <!-- Avatar & Info -->
                     <div class="flex items-center gap-3 min-w-0 flex-1">
                        <!-- Modern Icon: Neutral base, scale & color pop on hover -->
                        <div 
                           class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ease-out group-hover:scale-110 group-hover:shadow-md group-hover:ring-4 group-hover:ring-orange-50/50"
                           [ngClass]="{
                              'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-orange-500': !p.selected,
                              'bg-orange-500 text-white shadow-lg shadow-orange-500/20 ring-2 ring-orange-200': p.selected
                           }"
                        >
                           <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                        
                        <div class="min-w-0 flex-1">
                           <div class="flex items-center justify-between">
                              <p class="text-[13px] font-bold text-slate-700 truncate group-hover:text-slate-900 transition-colors">
                                 {{ p.primer_nombre }} {{ p.primer_apellido }}
                              </p>
                              
                           </div>
                           <div class="flex items-center gap-1 mt-0.5 flex-wrap">
                                 <!-- Privilegios Tags -->
                                 <ng-container *ngIf="getPrivilegioTags(p).length > 0; else noPrivilegioSimple">
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
                                 <ng-template #noPrivilegioSimple>
                                    <p class="text-[11px] text-slate-400 truncate">Publicador</p>
                                 </ng-template>
                           </div>
                        </div>

                        <!-- Checkbox (Minimal) -->
                        <div 
                           class="w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0 ml-1"
                           [ngClass]="{
                              'border-slate-300 bg-white group-hover:border-slate-400': !p.selected,
                              'border-orange-500 bg-orange-500 text-white': p.selected
                           }"
                        >
                           <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg>
                        </div>
                     </div>
                  </div>
                  
                  <!-- Empty State -->
                  <div *ngIf="filteredAvailable().length === 0" class="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                     <p class="text-sm font-bold text-slate-400">Sin resultados</p>
                  </div>
               </div>
            </div>

            <!-- ACTION BUTTONS CENTER (Modern Flat) -->
             <div class="hidden lg:flex flex-col gap-3 justify-center h-full z-10 px-2 lg:px-4">
                <button 
                   (click)="moveToGroup()" 
                   class="w-12 h-12 rounded-xl bg-orange-50 border border-orange-100 text-orange-500 hover:bg-orange-500 hover:text-white hover:border-orange-500 hover:scale-105 transition-all duration-200 flex items-center justify-center shadow-sm"
                   title="Agregar al grupo"
                >  
                   <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                </button>
                <button 
                   (click)="moveToAvailable()" 
                   class="w-12 h-12 rounded-xl bg-white border border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600 hover:border-slate-300 hover:scale-105 transition-all duration-200 flex items-center justify-center shadow-sm"
                   title="Quitar del grupo"
                >
                   <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
                </button>
             </div>
            
            <!-- ACTION BUTTONS MOBILE -->
            <div class="flex lg:hidden justify-center gap-3 py-4 px-4 bg-white/95 backdrop-blur border-t border-slate-100 sticky bottom-0 z-50">
               <button (click)="moveToGroup()" class="flex-1 px-4 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm shadow-sm active:scale-95 transition-transform">
                  Agregar
               </button>
               <button (click)="moveToAvailable()" class="flex-1 px-4 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-sm active:scale-95 transition-transform">
                  Quitar
               </button>
            </div>

            <!-- LISTA: Miembros del Grupo (Right Panel) -->
            <div class="h-full bg-white rounded-2xl border border-orange-200 shadow-[0_4px_20px_rgba(249,115,22,0.04)] flex flex-col overflow-hidden relative">
               
               <!-- Panel Header -->
               <div class="p-5 border-b border-orange-50 bg-orange-50/20">
                  <div class="flex items-center justify-between mb-4">
                     <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-500">
                           <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        </div>
                        <div>
                           <h2 class="text-base font-bold text-slate-900">Miembros</h2>
                           <p class="text-[11px] font-semibold text-orange-500">Asignados al grupo</p>
                        </div>
                     </div>
                     <span class="bg-orange-100 text-orange-600 text-xs font-bold px-2.5 py-1 rounded-md">{{ filteredGroupMembers().length }}</span>
                  </div>
                  
                  <!-- Minimal Search -->
                  <div class="relative">
                     <input 
                        type="text" 
                        placeholder="Buscar..." 
                        class="w-full bg-white border border-orange-100 text-slate-700 text-sm rounded-lg pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-orange-100 focus:border-orange-200 transition-all placeholder:text-orange-300 font-medium"
                        [(ngModel)]="searchGroup"
                     >
                     <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg class="w-4 h-4 text-orange-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                     </div>
                  </div>
               </div>

               <!-- List Content -->
               <div class="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar bg-white">
                  <div 
                     *ngFor="let p of filteredGroupMembers()"
                     class="group relative flex items-center p-2.5 rounded-xl border border-transparent transition-all cursor-pointer select-none"
                     [ngClass]="{
                        'hover:bg-orange-50/30 hover:border-orange-100': !p.selected,
                        'bg-orange-50 border-orange-100': p.selected
                     }"
                     (click)="toggleSelection(p)"
                  >
                     <!-- Avatar & Info -->
                     <!-- Avatar & Info -->
                     <div class="flex items-center gap-3 min-w-0 flex-1">
                        <!-- Modern Icon: Neutral base, scale & color pop on hover -->
                        <div 
                           class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ease-out group-hover:scale-110 group-hover:shadow-md group-hover:ring-4 group-hover:ring-orange-50/50"
                           [ngClass]="{
                              'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-orange-500': !p.selected,
                              'bg-orange-500 text-white shadow-lg shadow-orange-500/20 ring-2 ring-orange-200': p.selected
                           }"
                        >
                           <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        </div>
                        
                        <div class="min-w-0 flex-1">
                           <div class="flex items-center justify-between">
                              <p class="text-[13px] font-bold text-slate-800 truncate group-hover:text-orange-700 transition-colors">
                                 {{ p.primer_nombre }} {{ p.primer_apellido }}
                              </p>
                              
                           </div>
                           <div class="flex items-center gap-1 mt-0.5 flex-wrap">
                                 <!-- Privilegios Tags -->
                                 <ng-container *ngIf="getPrivilegioTags(p).length > 0; else noPrivilegioGroup">
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
                                 <ng-template #noPrivilegioGroup>
                                    <p class="text-[11px] font-medium text-slate-400 truncate">Publicador</p>
                                 </ng-template>
                           </div>
                        </div>

                        <!-- Checkbox (Minimal) -->
                        <div 
                           class="w-5 h-5 rounded-full border flex items-center justify-center transition-all shrink-0 ml-1"
                           [ngClass]="{
                              'border-slate-300 bg-white group-hover:border-orange-300': !p.selected,
                              'border-orange-500 bg-orange-500 text-white': p.selected
                           }"
                        >
                           <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M20 6L9 17l-5-5"/></svg>
                        </div>
                     </div>
                  </div>

                  <!-- Empty State -->
                  <div *ngIf="filteredGroupMembers().length === 0" class="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                     <p class="text-sm font-bold text-orange-400">Grupo vacío</p>
                  </div>
               </div>
            </div>

         </div>
       </main>
    </div>
  `,
   styles: [`
     :host { display: block; height: 100vh; }
     .custom-scrollbar::-webkit-scrollbar { width: 5px; }
     .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
     .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
     .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  `]
})
export class FormularioAsignacionPage implements OnInit {
   private route = inject(ActivatedRoute);
   private router = inject(Router);
   private http = inject(HttpClient);

   grupoId: number | null = null;
   grupo = signal<Grupo | null>(null);

   // Arrays originales
   availablePublishers = signal<Publicador[]>([]);
   groupMembers = signal<Publicador[]>([]);

   // Privilegios
   privilegiosCatalogo = signal<Privilegio[]>([]);
   publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map()); // id_publicador -> id_privilegio[]

   private authStore = inject(AuthStore);
   private privilegiosService = inject(PrivilegiosService);


   // Search
   searchAvailable = '';
   searchGroup = '';

   saving = signal(false);

   // Initial State Tracking for Diff
   initialMap = new Map<number, number | null>();

   ngOnInit() {
      this.route.paramMap.subscribe(params => {
         const id = params.get('id');
         if (id) {
            this.grupoId = +id;
            this.loadData();
         }
      });
   }

   async loadData() {
      if (!this.grupoId) return;
      try {
         const user = this.authStore.user();
         const params: any = {};
         if (user?.id_congregacion) {
            params.id_congregacion = user.id_congregacion;
         }
         // Asegurar traer todos los registros (evitar paginación por defecto)
         params.skip = 0;
         params.limit = 1000;

         const [grupoRes, allPubs, privilegiosData] = await Promise.all([
            lastValueFrom(this.http.get<Grupo>(`/api/grupos/${this.grupoId}`)),
            lastValueFrom(this.http.get<Publicador[]>('/api/publicadores/', { params })),
            lastValueFrom(this.privilegiosService.getPrivilegios())
         ]);

         this.grupo.set(grupoRes);
         this.privilegiosCatalogo.set(privilegiosData || []);

         // Load privileges map efficiently
         await this.loadAllPublicadorPrivilegios(allPubs || []); // Assuming this populates publicadorPrivilegiosMap

         const members: Publicador[] = [];
         const available: Publicador[] = [];

         allPubs.forEach(p => {
            this.initialMap.set(p.id_publicador, p.id_grupo_publicador || null);

            // Safer comparison: convert both to numbers to avoid string/number mismatch
            if (p.id_grupo_publicador != null && Number(p.id_grupo_publicador) === Number(this.grupoId)) {
               members.push({ ...p, selected: false });
            } else if (!p.id_grupo_publicador) {
               available.push({ ...p, selected: false });
            }
         });

         this.groupMembers.set(members);
         this.availablePublishers.set(available);

      } catch (err) {
         console.error(err);
         alert('Error cargando datos del grupo o publicadores.');
         this.goBack();
      }
   }

   filteredAvailable() {
      return this.availablePublishers().filter(p =>
         (p.primer_nombre + ' ' + p.primer_apellido).toLowerCase().includes(this.searchAvailable.toLowerCase())
      ).sort((a, b) => a.primer_nombre.localeCompare(b.primer_nombre));
   }

   filteredGroupMembers() {
      return this.groupMembers().filter(p =>
         (p.primer_nombre + ' ' + p.primer_apellido).toLowerCase().includes(this.searchGroup.toLowerCase())
      ).sort((a, b) => a.primer_nombre.localeCompare(b.primer_nombre));
   }

   toggleSelection(p: Publicador) {
      p.selected = !p.selected;
   }

   moveToGroup() {
      const selected = this.availablePublishers().filter(p => p.selected);
      const remaining = this.availablePublishers().filter(p => !p.selected);

      selected.forEach(p => { p.selected = false; p.id_grupo_publicador = this.grupoId; });

      this.availablePublishers.set(remaining);
      this.groupMembers.update(curr => [...curr, ...selected]);
   }

   moveToAvailable() {
      const selected = this.groupMembers().filter(p => p.selected);
      const remaining = this.groupMembers().filter(p => !p.selected);

      selected.forEach(p => { p.selected = false; p.id_grupo_publicador = null; });

      this.groupMembers.set(remaining);
      this.availablePublishers.update(curr => [...curr, ...selected]);
   }

   async save() {
      this.saving.set(true);
      try {
         const allCurrent = [...this.availablePublishers(), ...this.groupMembers()];
         const modified: Publicador[] = [];

         for (const p of allCurrent) {
            const initialGrp = this.initialMap.get(p.id_publicador);
            const currentGrp = p.id_grupo_publicador || null;
            if (initialGrp !== currentGrp) {
               modified.push(p);
            }
         }

         if (modified.length === 0) {
            this.goBack();
            return;
         }

         await Promise.all(modified.map(p =>
            lastValueFrom(this.http.put(`/api/publicadores/${p.id_publicador}`, {
               id_grupo_publicador: p.id_grupo_publicador
            }))
         ));

         alert('Asignaciones guardadas.');
         this.goBack();

      } catch (err) {
         console.error(err);
         alert('Error guardando cambios.');
      } finally {
         this.saving.set(false);
      }
   }

   getInitials(p: Publicador): string {
      return (p.primer_nombre.charAt(0) + p.primer_apellido.charAt(0)).toUpperCase();
   }

   getAvatarColor(id: number): string {
      const colors = ['#EF476F', '#FFD166', '#06D6A0', '#118AB2', '#073B4C', '#9D4EDD', '#FF9F1C'];
      return colors[id % colors.length];
   }

   goBack() {
      this.router.navigate(['/secretario/publicadores'], { queryParams: { tab: 'grupos' } });
   }

   // --- Logic for Privileges ---

   async loadAllPublicadorPrivilegios(publicadores: Publicador[]) {
      try {
         const allPrivilegios = await lastValueFrom(
            this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/')
         );

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
         this.publicadorPrivilegiosMap.set(privilegiosMap);
      } catch (err) {
         console.error('❌ Error cargando privilegios de publicadores', err);
      }
   }

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
}
