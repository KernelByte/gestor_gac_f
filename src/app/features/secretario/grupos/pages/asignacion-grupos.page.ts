import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';

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
}

@Component({
  standalone: true,
  selector: 'app-asignacion-grupos',
  imports: [CommonModule],
  template: `
    <div class="h-full flex flex-col w-full max-w-[1920px] mx-auto bg-slate-50 overflow-hidden">
      
      <!-- Header -->
      <div class="shrink-0 bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between z-20 shadow-sm">
        <div>
          <h1 class="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
             <button (click)="goBack()" class="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
             </button>
             Tablero de Asignación de Grupos
          </h1>
          <p class="text-slate-500 text-sm mt-1 ml-9">Arrastra los publicadores para asignarlos a los grupos.</p>
        </div>
        
        <div class="flex items-center gap-4">
             <div class="flex items-center gap-2 mr-4">
                <div class="flex -space-x-2">
                   <div *ngFor="let p of draggingAvatars(); let i = index" class="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] z-10">
                      {{ getInitials(p) }}
                   </div>
                   <div *ngIf="pendingChangesCount() > 0" class="w-8 h-8 rounded-full border-2 border-white bg-[#5B3C88] text-white flex items-center justify-center text-[10px] font-bold z-20">
                      +{{ pendingChangesCount() }}
                   </div>
                </div>
                <span class="text-xs font-bold text-slate-500" *ngIf="pendingChangesCount() > 0">Cambios pendientes</span>
             </div>

             <button 
               (click)="saveChanges()"
               [disabled]="isSaving() || pendingChangesCount() === 0"
               class="px-6 py-2.5 bg-[#5B3C88] hover:bg-[#4a2f73] text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-900/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale flex items-center gap-2"
             >
               <svg *ngIf="isSaving()" class="animate-spin -ml-1 mr-1 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
               {{ isSaving() ? 'Guardando...' : 'Guardar Cambios' }}
             </button>
        </div>
      </div>

      <!-- Kanban Board Area -->
      <div class="flex-1 overflow-x-auto overflow-y-hidden p-6 relative">
         <div class="flex h-full gap-6 pb-4">
            
            <!-- Columna: Sin Asignar -->
            <div 
               class="w-80 shrink-0 flex flex-col rounded-2xl bg-slate-100/50 border border-slate-200/60 max-h-full transition-colors"
               [class.bg-slate-200]="isDraggingOver() === 'unassigned'"
               (dragover)="onDragOver($event, 'unassigned')"
               (dragleave)="onDragLeave()"
               (drop)="onDrop($event, null)"
            >
               <!-- Header -->
               <div class="px-4 py-3 border-b border-slate-200/60 flex items-center justify-between bg-white rounded-t-2xl">
                  <span class="font-bold text-slate-700">Sin Asignar</span>
                  <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-bold">{{ unassignedPublishers().length }}</span>
               </div>
               
               <!-- List -->
               <div class="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                  <ng-container *ngFor="let p of unassignedPublishers()">
                     <ng-container *ngTemplateOutlet="cardTemplate; context: { $implicit: p }"></ng-container>
                  </ng-container>
                  
                   <div *ngIf="unassignedPublishers().length === 0" class="h-20 flex items-center justify-center text-slate-400 text-xs italic border-2 border-dashed border-slate-200 rounded-xl">
                      Arrastra aquí para desasignar
                   </div>
               </div>
            </div>

            <!-- Columnas: Grupos -->
            <div 
               *ngFor="let grupo of grupos()"
               class="w-80 shrink-0 flex flex-col rounded-2xl bg-white border border-slate-200 shadow-sm max-h-full transition-shadow hover:shadow-md"
               [class.ring-2]="isDraggingOver() === grupo.id_grupo"
               [class.ring-[#5B3C88]]="isDraggingOver() === grupo.id_grupo"
               (dragover)="onDragOver($event, grupo.id_grupo)"
               (dragleave)="onDragLeave()"
               (drop)="onDrop($event, grupo.id_grupo)"
            >
               <!-- Header con Color -->
               <div class="px-4 py-3 border-b border-slate-100 relative overflow-hidden rounded-t-2xl">
                   <!-- Decoración de color top -->
                   <div class="absolute top-0 left-0 w-full h-1" [ngClass]="getGroupColorClass(grupo.id_grupo)"></div>
                   
                   <div class="flex items-start justify-between mt-1">
                      <div>
                         <h3 class="font-bold text-slate-800 text-sm truncate pr-2" [title]="grupo.nombre_grupo">{{ grupo.nombre_grupo }}</h3>
                         <p class="text-[11px] text-slate-400 mt-0.5" *ngIf="grupo.capitan_grupo">Capitán: <span class="text-slate-600 font-medium">{{ grupo.capitan_grupo }}</span></p>
                         <p class="text-[11px] text-slate-300 italic mt-0.5" *ngIf="!grupo.capitan_grupo">Sin Capitán</p>
                      </div>
                      <span class="bg-slate-50 text-slate-600 px-2 py-0.5 rounded-md text-xs font-bold border border-slate-100 shadow-sm">
                         {{ getGroupMembers(grupo.id_grupo).length }}
                      </span>
                   </div>
               </div>

               <!-- List -->
               <div class="p-3 flex-1 overflow-y-auto space-y-3 custom-scrollbar bg-slate-50/30">
                  <ng-container *ngFor="let p of getGroupMembers(grupo.id_grupo)">
                     <ng-container *ngTemplateOutlet="cardTemplate; context: { $implicit: p, inGroup: true }"></ng-container>
                  </ng-container>
                  
                  <div *ngIf="getGroupMembers(grupo.id_grupo).length === 0" class="h-20 flex items-center justify-center text-slate-300 text-xs italic border-2 border-dashed border-slate-100 rounded-xl">
                      Grupo vacío
                  </div>
               </div>
            </div>

         </div>
      </div>
    </div>

    <!-- Template de Card de Publicador -->
    <ng-template #cardTemplate let-p let-inGroup="inGroup">
      <div 
         class="bg-white p-3 rounded-xl border border-slate-200 shadow-sm cursor-move select-none hover:shadow-md hover:border-[#5B3C88]/30 active:scale-95 transition-all group relative"
         draggable="true"
         (dragstart)="onDragStart($event, p)"
      >
         <!-- Drag Handle visible on hover -->
         <div class="absolute top-2 right-2 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
         </div>

         <!-- Status Indicator Line -->
         <div class="w-8 h-1 rounded-full mb-3" [style.background-color]="getAvatarColor(p.id_publicador)"></div>

         <div class="flex items-center gap-3">
            <div 
               class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm"
               [style.background-color]="getAvatarColor(p.id_publicador)"
            >
               {{ getInitials(p) }}
            </div>
            <div class="min-w-0"> 
               <p class="text-sm font-bold text-slate-800 truncate leading-tight">{{ p.primer_nombre }} {{ p.primer_apellido }}</p>
               <!-- Aqui podriamos mostrar privilegio si viniera en la API -->
               <p class="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  {{ p.rol?.descripcion_rol || 'Publicador' }}
               </p>
            </div>
         </div>
         
         <div class="mt-2 flex justify-end" *ngIf="isModified(p)">
             <span class="text-[9px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">Modificado</span>
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

  // Data
  grupos = signal<Grupo[]>([]);
  publicadores = signal<Publicador[]>([]);

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
    console.log('AsignacionGruposPage loaded - Kanban Version');
    this.loadData();
  }

  async loadData() {
    try {
      // Cargar grupos y publicadores en paralelo
      const [gruposData, pubsData] = await Promise.all([
        lastValueFrom(this.http.get<Grupo[]>('/api/grupos/')),
        lastValueFrom(this.http.get<Publicador[]>('/api/publicadores/')) // Ajustar endpoint si necesita limit=1000
      ]);

      this.grupos.set(gruposData || []);
      this.publicadores.set(pubsData || []);

      // Guardar estado inicial para detectar cambios
      this.initialState.clear();
      (pubsData || []).forEach(p => {
        this.initialState.set(p.id_publicador, p.id_grupo_publicador || null);
      });

    } catch (err) {
      console.error('Error cargando datos', err);
      alert('Error al cargar datos. Ver consola.');
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
