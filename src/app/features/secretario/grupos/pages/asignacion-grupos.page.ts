import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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
  cantidad_publicadores?: number;
}

interface Publicador {
  id_publicador: number;
  primer_nombre: string;
  primer_apellido: string;
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
    <div class="h-full flex flex-col w-full bg-slate-50/50 overflow-hidden font-sans">
      
      <!-- Premium Header -->
      <header class="shrink-0 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 flex items-center justify-between px-8 py-4 z-30 sticky top-0">
        <div class="flex items-center gap-6">
           <button (click)="goBack()" class="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all active:scale-95 group">
              <svg class="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
           </button>
           
           <div>
              <h1 class="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                 <span>Tablero de Asignación</span>
                 <span class="px-2 py-0.5 rounded-md bg-orange-50 text-brand-orange text-[10px] font-bold uppercase tracking-widest border border-orange-100">Dinámico</span>
              </h1>
              <p class="text-slate-500 text-xs font-medium mt-0.5">Gestione la distribución de los publicadores arrastrando y soltando.</p>
           </div>
        </div>
        
        <div class="flex items-center gap-6">
             <!-- Status Indicators -->
             <div class="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100" *ngIf="pendingChangesCount() > 0">
                <div class="flex -space-x-2">
                   <div *ngFor="let p of draggingAvatars();" class="w-7 h-7 rounded-full border-2 border-white bg-white shadow-sm flex items-center justify-center overflow-hidden">
                      <div class="w-full h-full flex items-center justify-center text-[9px] font-black text-white" [style.background-color]="getAvatarColor(p.id_publicador)">
                        {{ getInitials(p) }}
                      </div>
                   </div>
                   <div *ngIf="pendingChangesCount() > 5" class="w-7 h-7 rounded-full border-2 border-white bg-slate-800 text-white flex items-center justify-center text-[9px] font-bold z-10">
                      +{{ pendingChangesCount() - 5 }}
                   </div>
                </div>
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-slate-800 leading-none">{{ pendingChangesCount() }} cambios</span>
                    <span class="text-[10px] text-slate-400 font-medium leading-none mt-0.5">Pendientes de guardar</span>
                </div>
             </div>

             <div class="h-8 w-px bg-slate-200" *ngIf="pendingChangesCount() > 0"></div>

             <div class="flex items-center gap-3">
                 <div class="text-right hidden sm:block">
                    <p class="text-xs font-bold text-slate-700">Guardado Automático</p>
                    <p class="text-[10px] text-slate-400">Desactivado</p>
                 </div>
                 
                 <button 
                   (click)="saveChanges()"
                   [disabled]="isSaving() || pendingChangesCount() === 0"
                   class="relative overflow-hidden pl-5 pr-6 py-2.5 bg-brand-orange text-white rounded-xl font-bold text-sm shadow-lg shadow-orange-500/30 transition-all hover:bg-orange-600 hover:shadow-orange-500/40 active:scale-95 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed group flex items-center gap-2"
                 >
                   <div *ngIf="isSaving()" class="absolute inset-0 bg-white/20 animate-pulse"></div>
                   <svg *ngIf="isSaving()" class="animate-spin h-4 w-4 text-white relative z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                   <svg *ngIf="!isSaving()" class="w-4 h-4 relative z-10 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><path stroke-linecap="round" stroke-linejoin="round" d="M17 21v-8H7v8"/><path stroke-linecap="round" stroke-linejoin="round" d="M7 3v5h8"/></svg>
                   <span class="relative z-10">{{ isSaving() ? 'Guardando...' : 'Aplicar Cambios' }}</span>
                 </button>
             </div>
        </div>
      </header>

      <!-- Kanban Board Area -->
      <div class="flex-1 overflow-x-auto overflow-y-hidden p-8 relative">
         <div class="flex h-full gap-8 pb-4 w-max mx-auto min-w-full justify-start md:justify-center">
            
            <!-- Columna: Sin Asignar (Staging Area) -->
            <div 
               class="w-72 shrink-0 flex flex-col rounded-3xl bg-slate-100/60 border-2 border-dashed border-slate-300 max-h-full transition-all duration-300"
               [class.bg-slate-200]="isDraggingOver() === 'unassigned'"
               [class.border-slate-400]="isDraggingOver() === 'unassigned'"
               [class.scale-[1.02]]="isDraggingOver() === 'unassigned'"
               (dragover)="onDragOver($event, 'unassigned')"
               (dragleave)="onDragLeave()"
               (drop)="onDrop($event, null)"
            >
               <!-- Header -->
               <div class="px-5 py-4 border-b border-slate-200/50 flex items-center justify-between rounded-t-3xl bg-slate-50/50 backdrop-blur-sm">
                  <div class="flex items-center gap-2">
                      <div class="w-2 h-2 rounded-full bg-slate-400"></div>
                      <span class="font-bold text-slate-700 text-sm uppercase tracking-wide">Sin Asignar</span>
                  </div>
                  <span class="bg-white text-slate-600 px-2.5 py-1 rounded-lg text-xs font-black shadow-sm border border-slate-200">{{ unassignedPublishers().length }}</span>
               </div>
               
               <!-- List -->
               <div class="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                  <ng-container *ngFor="let p of unassignedPublishers()">
                     <ng-container *ngTemplateOutlet="cardTemplate; context: { $implicit: p }"></ng-container>
                  </ng-container>
                  
                   <div *ngIf="unassignedPublishers().length === 0" class="h-32 flex flex-col items-center justify-center text-slate-400 text-xs italic border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <svg class="w-8 h-8 opacity-20 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                      <span>Zona de espera vacía</span>
                   </div>
               </div>
            </div>

            <!-- Columnas: Grupos -->
            <div 
               *ngFor="let grupo of grupos()"
               class="w-80 shrink-0 flex flex-col rounded-3xl bg-white border border-slate-100 shadow-xl shadow-slate-200/40 max-h-full transition-all duration-300 transform"
               [class.ring-2]="isDraggingOver() === grupo.id_grupo"
               [class.ring-brand-orange]="isDraggingOver() === grupo.id_grupo"
               [class.scale-[1.02]]="isDraggingOver() === grupo.id_grupo"
               (dragover)="onDragOver($event, grupo.id_grupo)"
               (dragleave)="onDragLeave()"
               (drop)="onDrop($event, grupo.id_grupo)"
            >
               <!-- Header con Color -->
               <div class="px-5 py-4 border-b border-slate-50 relative overflow-hidden rounded-t-3xl bg-white group-header z-10">
                   <!-- Decoración de fondo suave -->
                   <div class="absolute inset-x-0 -top-full h-full opacity-5 pointer-events-none transition-opacity duration-300" [ngClass]="getGroupColorClass(grupo.id_grupo)"></div>
                   
                   <div class="flex items-start justify-between">
                      <div class="flex items-start gap-3">
                         <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg font-black shadow-md mt-0.5" 
                              [ngClass]="getGroupColorClass(grupo.id_grupo)">
                            {{ grupo.nombre_grupo.charAt(0) }}
                         </div>
                         <div>
                             <h3 class="font-bold text-slate-800 text-sm truncate w-40 leading-snug" [title]="grupo.nombre_grupo">{{ grupo.nombre_grupo }}</h3>
                             
                             <div class="flex items-center gap-1.5 mt-1" *ngIf="grupo.capitan_grupo">
                                <div class="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center">
                                    <svg class="w-2.5 h-2.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                                </div>
                                <span class="text-[10px] text-slate-500 font-medium truncate w-32">{{ grupo.capitan_grupo }}</span>
                             </div>

                             <div class="flex items-center gap-1.5 mt-1" *ngIf="!grupo.capitan_grupo">
                                <div class="w-4 h-4 rounded-full bg-red-50 flex items-center justify-center">
                                    <svg class="w-2.5 h-2.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                                </div>
                                <span class="text-[10px] text-red-400 font-medium italic">Sin Capitán asignado</span>
                             </div>
                         </div>
                      </div>

                      <span class="bg-slate-900 text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-lg shadow-slate-900/20">
                         {{ getGroupMembers(grupo.id_grupo).length }}
                      </span>
                   </div>
               </div>

               <!-- List -->
               <div class="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar bg-slate-50/50">
                  <ng-container *ngFor="let p of getGroupMembers(grupo.id_grupo)">
                     <ng-container *ngTemplateOutlet="cardTemplate; context: { $implicit: p, inGroup: true }"></ng-container>
                  </ng-container>
                  
                  <div *ngIf="getGroupMembers(grupo.id_grupo).length === 0" class="h-32 flex flex-col items-center justify-center text-slate-300 text-xs italic border border-dashed border-slate-200 rounded-2xl bg-slate-50 mx-2 mb-2">
                       <svg class="w-8 h-8 opacity-30 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                      Grupo sin miembros
                  </div>
               </div>
            </div>

         </div>
      </div>
    </div>

    <!-- Template de Card de Publicador PREMIUM -->
    <ng-template #cardTemplate let-p let-inGroup="inGroup">
      <div 
         class="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-lg hover:border-slate-300 hover:scale-[1.02] transition-all duration-200 group relative flex items-center gap-3 select-none"
         draggable="true"
         (dragstart)="onDragStart($event, p)"
      >
         <!-- Drag Handle (Visible on Hover) -->
         <div class="absolute left-1 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8h16M4 16h16"/></svg>
         </div>

         <!-- Avatar -->
         <div 
            class="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0 shadow-sm transition-transform group-hover:scale-110 ml-1"
            [style.background-color]="getAvatarColor(p.id_publicador)"
         >
            {{ getInitials(p) }}
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
                   <span class="inline-flex items-center gap-1 text-[9px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                      <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
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
  `]
})
export class AsignacionGruposPage implements OnInit {
  private http = inject(HttpClient);
  private router = inject(Router);
  private privilegiosService = inject(PrivilegiosService);

  // Data
  grupos = signal<Grupo[]>([]);
  publicadores = signal<Publicador[]>([]);

  // Privilegios Data
  privilegiosCatalogo = signal<Privilegio[]>([]);
  publicadorPrivilegiosMap = signal<Map<number, number[]>>(new Map()); // id_publicador -> id_privilegio[]

  // State
  isSaving = signal(false);
  isDraggingOver = signal<number | 'unassigned' | null>(null);
  draggedItem: Publicador | null = null;
  initialState = new Map<number, number | null>(); // id_pub -> id_grupo (original)

  // Computed
  pendingChangesCount = computed(() => {
    let count = 0;
    for (const p of this.publicadores()) {
      const original = this.initialState.get(p.id_publicador);
      const current = p.id_grupo_publicador || null;
      // Comparar teniendo en cuenta null/undefined
      if (original !== current) {
        count++;
      }
    }
    return count;
  });

  unassignedPublishers = computed(() =>
    this.publicadores().filter(p => !p.id_grupo_publicador).sort((a, b) => a.primer_nombre.localeCompare(b.primer_nombre))
  );

  draggingAvatars = computed(() => {
    // Return list of modified user avatars for header
    return this.publicadores().filter(p => this.isModified(p)).slice(0, 5);
  });

  ngOnInit() {
    console.log('AsignacionGruposPage loaded - Kanban Compact Version');
    this.loadData();
  }

  async loadData() {
    try {
      // Cargar grupos, publicadores y catálogo de privilegios en paralelo
      const [gruposData, pubsData, privilegiosData] = await Promise.all([
        lastValueFrom(this.http.get<Grupo[]>('/api/grupos/')),
        lastValueFrom(this.http.get<Publicador[]>('/api/publicadores/')),
        lastValueFrom(this.privilegiosService.getPrivilegios())
      ]);

      this.grupos.set(gruposData || []);
      this.privilegiosCatalogo.set(privilegiosData || []);

      // Guardar estado inicial para detectar cambios
      this.initialState.clear();
      (pubsData || []).forEach(p => {
        this.initialState.set(p.id_publicador, p.id_grupo_publicador || null);
      });

      // Cargar privilegios para todos los publicadores
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
      // Obtener todos los publicador-privilegios de la API
      const allPrivilegios = await lastValueFrom(
        this.http.get<PublicadorPrivilegio[]>('/api/publicador-privilegios/')
      );

      console.log('📌 Privilegios cargados desde API:', allPrivilegios);
      console.log('📌 Catálogo de privilegios:', this.privilegiosCatalogo());

      // Filtrar solo los privilegios activos (sin fecha_fin o fecha_fin en el futuro)
      const today = new Date().toISOString().split('T')[0];
      const privilegiosMap = new Map<number, number[]>();

      for (const pp of (allPrivilegios || [])) {
        // Solo privilegios activos (sin fecha_fin o fecha_fin >= hoy)
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
      // Continue without failing - just won't show privileges
    }
  }

  // Helpers
  getGroupMembers(groupId: number): Publicador[] {
    return this.publicadores()
      .filter(p => p.id_grupo_publicador === groupId)
      .sort((a, b) => a.primer_nombre.localeCompare(b.primer_nombre));
  }

  isModified(p: Publicador): boolean {
    const original = this.initialState.get(p.id_publicador);
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

    // Definir el mapeo de privilegios a etiquetas visuales más descriptivas
    // icon: SVG path para íconos inline compactos
    const privilegioConfig: { [key: string]: { label: string; class: string; icon: string } } = {
      'anciano': {
        label: 'Anciano',
        class: 'text-indigo-700 bg-indigo-50 border border-indigo-200',
        icon: 'M12 14l9-5-9-5-9 5 9 5zm0 7l-9-5 9-5 9 5-9 5z' // libro/enseñanza
      },
      'siervo ministerial': {
        label: 'Siervo Ministerial',
        class: 'text-purple-700 bg-purple-50 border border-purple-200',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' // grupo/servicio
      },
      'precursor regular': {
        label: 'Precursor Regular',
        class: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' // check/tiempo completo
      },
      'precursor auxiliar': {
        label: 'Precursor Auxiliar',
        class: 'text-amber-700 bg-amber-50 border border-amber-200',
        icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' // reloj/temporal
      },
    };

    // Recorrer privilegios asignados al publicador
    for (const idPrivilegio of privilegiosIds) {
      const privilegio = catalogo.find(pr => pr.id_privilegio === idPrivilegio);
      if (privilegio) {
        const nombreLower = privilegio.nombre_privilegio.toLowerCase().trim();

        // Buscar coincidencia en la configuración
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

  goBack() {
    if (this.pendingChangesCount() > 0) {
      if (!confirm('Tienes cambios sin guardar. ¿Seguro que quieres salir?')) return;
    }
    this.router.navigate(['/secretario/grupos']);
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
    e.preventDefault(); // Necessary to allow dropping
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    this.isDraggingOver.set(targetId);
  }

  onDragLeave() {
    // Optional: add debounce or logic to prevent flickering
    this.isDraggingOver.set(null);
  }

  onDrop(e: DragEvent, targetGroupId: number | null) {
    e.preventDefault();
    this.isDraggingOver.set(null);

    if (!this.draggedItem) return;

    const p = this.draggedItem;
    this.draggedItem = null;

    // Update Local State
    if (p.id_grupo_publicador !== targetGroupId) {
      // We create a new array ref to trigger change detection if needed, 
      // though updating the object prop inside signal array might need explicit update
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

  // Save
  async saveChanges() {
    const modified = this.publicadores().filter(p => this.isModified(p));
    if (modified.length === 0) return;

    this.isSaving.set(true);
    try {
      // Batch updates: call endpoint for each modified publisher
      // Ideally backend should have a bulk update endpoint
      const updatePromises = modified.map(p => {
        // Assuming PUT /api/publicadores/{id} accepts partial updates or we send what we have
        // If endpoint is strict, we might need full object. 
        // Safe bet: send id_grupo_publicador if backend allows it.
        // Based on publicador_router.py, it expects PublicadorUpdate which likely has Optional fields.
        const payload = {
          id_grupo_publicador: p.id_grupo_publicador
        };
        return lastValueFrom(this.http.put(`/api/publicadores/${p.id_publicador}`, payload));
      });

      await Promise.all(updatePromises);

      // Update initial state
      this.initialState.clear();
      this.publicadores().forEach(p => {
        this.initialState.set(p.id_publicador, p.id_grupo_publicador || null);
      });

      alert('Cambios guardados correctamente.');

    } catch (err) {
      console.error('Error guardando cambios', err);
      alert('Hubo un error al guardar algunos cambios. Revisa la consola.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
