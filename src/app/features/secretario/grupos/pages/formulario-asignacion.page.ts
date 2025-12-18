import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

interface Publicador {
   id_publicador: number;
   primer_nombre: string;
   primer_apellido: string;
   id_grupo_publicador?: number | null;
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
    <div class="min-h-screen bg-[#f8f9fc] p-6">
      <div class="max-w-7xl mx-auto">
        
        <!-- Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div class="flex items-center gap-3 mb-1">
                <button (click)="goBack()" class="p-1 rounded-lg hover:bg-white text-slate-400 transition-colors">
                    <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <h1 class="text-3xl font-extrabold text-[#1a1a1a]">Asignar Publicadores</h1>
            </div>
            <p class="text-gray-500 text-sm md:text-base ml-10">
               Gestionando miembros para: <span class="font-bold text-[#5B3C88]">{{ grupo()?.nombre_grupo || 'Cargando...' }}</span>
            </p>
          </div>
          <div class="flex items-center gap-3">
            <button 
              (click)="goBack()"
              class="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
            >
              Cancelar
            </button>
            <button 
              (click)="save()"
              [disabled]="saving()"
              class="px-5 py-2.5 rounded-xl bg-[#5B3C88] text-white font-medium hover:bg-[#4a3170] transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              <svg *ngIf="saving()" class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {{ saving() ? 'Guardando...' : 'Guardar Cambios' }}
            </button>
          </div>
        </div>

        <!-- Grid de Listas -->
        <div class="grid grid-cols-1 xl:grid-cols-[1fr_auto_1fr] gap-6 items-start h-[calc(100vh-200px)]">
          
          <!-- Lista Disponibles (Sin Grupo) -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
            <div class="p-5 border-b border-gray-100 bg-slate-50/50">
              <div class="flex items-center justify-between mb-4">
                <div class="flex items-center gap-2">
                    <h2 class="text-lg font-bold text-gray-800">Publicadores Disponibles</h2>
                    <span class="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded-full">{{ filteredAvailable().length }}</span>
                </div>
              </div>
              
              <div class="relative">
                <input 
                  type="text" 
                  placeholder="Buscar..." 
                  class="bg-white border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-[#5B3C88] focus:border-[#5B3C88] block w-full pl-10 p-2.5 transition-shadow"
                  [(ngModel)]="searchAvailable"
                >
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </div>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              <div 
                *ngFor="let p of filteredAvailable()"
                class="flex items-center p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-all select-none"
                [class.bg-purple-50]="p.selected"
                [class.border-purple-200]="p.selected"
                (click)="toggleSelection(p)"
              >
                <div class="flex items-center h-5 mr-3">
                  <input 
                    type="checkbox" 
                    [checked]="p.selected"
                    class="w-4 h-4 text-[#5B3C88] rounded focus:ring-[#5B3C88] cursor-pointer pointer-events-none"
                  >
                </div>
                <div 
                  class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white mr-3 shrink-0 uppercase"
                  [style.background-color]="getAvatarColor(p.id_publicador)"
                >
                  {{ getInitials(p) }}
                </div>
                <div>
                  <p class="text-sm font-bold text-slate-700">{{ p.primer_nombre }} {{ p.primer_apellido }}</p>
                  <p class="text-xs text-slate-400">{{ p.rol?.descripcion_rol || 'Publicador' }}</p>
                </div>
              </div>
              <div *ngIf="filteredAvailable().length === 0" class="p-8 text-center text-slate-400 text-sm italic">
                  No hay publicadores disponibles
              </div>
            </div>
          </div>

          <!-- Botones de Transferencia -->
          <div class="hidden xl:flex flex-col gap-4 justify-center h-full">
            <button (click)="moveToGroup()" class="p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-[#5B3C88] hover:scale-105 transition-all">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M13 18l6-6"/><path d="M13 6l6 6"/></svg>
            </button>
            <button (click)="moveToAvailable()" class="p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:bg-gray-50 text-gray-500 hover:scale-105 transition-all">
               <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="M5 12l6 6"/><path d="M5 12l6-6"/></svg>
            </button>
          </div>
          
          <!-- Botones Mobile -->
          <div class="flex xl:hidden justify-center gap-4 py-2">
             <button (click)="moveToGroup()" class="px-4 py-2 bg-white border rounded-lg shadow text-[#5B3C88] font-bold">Agregar ↓</button>
             <button (click)="moveToAvailable()" class="px-4 py-2 bg-white border rounded-lg shadow text-gray-500 font-bold">Quitar ↑</button>
          </div>

          <!-- Lista Miembros del Grupo -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full border-t-4 border-t-[#5B3C88]">
            <div class="p-5 border-b border-gray-100 bg-slate-50/50">
               <div class="flex items-center justify-between mb-4">
                  <div class="flex items-center gap-2">
                     <h2 class="text-lg font-bold text-gray-800">Miembros del Grupo</h2>
                     <span class="bg-[#5B3C88] text-white text-xs font-bold px-2 py-0.5 rounded-full">{{ filteredGroupMembers().length }}</span>
                  </div>
               </div>

               <div class="relative">
                 <input 
                   type="text" 
                   placeholder="Buscar en grupo..." 
                   class="bg-white border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-[#5B3C88] focus:border-[#5B3C88] block w-full pl-10 p-2.5 transition-shadow"
                   [(ngModel)]="searchGroup"
                 >
                 <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   <svg class="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                 </div>
               </div>
            </div>

            <div class="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
               <div 
                 *ngFor="let p of filteredGroupMembers()"
                 class="flex items-center p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 cursor-pointer transition-all select-none"
                 [class.bg-purple-50]="p.selected"
                 [class.border-purple-200]="p.selected"
                 (click)="toggleSelection(p)"
               >
                 <div class="flex items-center h-5 mr-3">
                   <input 
                     type="checkbox" 
                     [checked]="p.selected"
                     class="w-4 h-4 text-[#5B3C88] rounded focus:ring-[#5B3C88] cursor-pointer pointer-events-none"
                   >
                 </div>
                 <div 
                   class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white mr-3 shrink-0 uppercase"
                   [style.background-color]="getAvatarColor(p.id_publicador)"
                 >
                   {{ getInitials(p) }}
                 </div>
                 <div>
                   <p class="text-sm font-bold text-slate-700">{{ p.primer_nombre }} {{ p.primer_apellido }}</p>
                   <p class="text-xs text-slate-400">{{ p.rol?.descripcion_rol || 'Publicador' }}</p>
                 </div>
               </div>
               <div *ngIf="filteredGroupMembers().length === 0" class="p-8 text-center text-slate-400 text-sm italic">
                  Este grupo aún no tiene miembros.
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
   styles: [`
    :host { display: block; }
    .custom-scrollbar::-webkit-scrollbar { width: 6px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
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
         const [grupoRes, allPubs] = await Promise.all([
            lastValueFrom(this.http.get<Grupo>(`/api/grupos/${this.grupoId}`)),
            lastValueFrom(this.http.get<Publicador[]>('/api/publicadores/'))
         ]);

         this.grupo.set(grupoRes);

         const members: Publicador[] = [];
         const available: Publicador[] = [];

         allPubs.forEach(p => {
            this.initialMap.set(p.id_publicador, p.id_grupo_publicador || null);

            if (p.id_grupo_publicador === this.grupoId) {
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
      this.router.navigate(['/secretario/grupos']);
   }
}
