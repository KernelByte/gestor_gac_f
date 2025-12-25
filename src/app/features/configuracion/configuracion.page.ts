import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

interface Congregacion {
   id_congregacion?: number;
   nombre_congregacion: string;
   circuito?: string;
   direccion?: string;
   codigo_seguridad?: string;
}

interface ImportResult {
   total: number;
   creadas: number;
   errores: string[];
}

type ConfigTab = 'congregaciones' | 'general';

@Component({
   standalone: true,
   selector: 'app-configuracion-page',
   imports: [CommonModule, FormsModule, ReactiveFormsModule],
   template: `
   <div class="min-h-full bg-gradient-to-br from-slate-50 via-white to-purple-50/20">
      
      <!-- Header -->
      <div class="mb-8">
         <h1 class="text-3xl font-display font-black text-slate-900 tracking-tight mb-2">Configuración</h1>
         <p class="text-slate-500 text-lg leading-relaxed max-w-3xl">Administra la configuración global del sistema.</p>
      </div>

      <!-- Tabs -->
      <div class="bg-slate-100/80 p-1.5 rounded-2xl flex gap-1 w-fit mb-8">
         <button 
            (click)="currentTab.set('congregaciones')" 
            class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300"
            [ngClass]="currentTab() === 'congregaciones' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'"
         >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            Congregaciones
         </button>
         <button 
            (click)="currentTab.set('general')" 
            class="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300"
            [ngClass]="currentTab() === 'general' ? 'bg-white text-purple-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'"
         >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            General
         </button>
      </div>

      <!-- Tab Content: Congregaciones -->
      <div *ngIf="currentTab() === 'congregaciones'" class="flex gap-6 h-[calc(100vh-280px)]">
         
         <!-- Left: List -->
         <div class="flex-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            
            <!-- Toolbar -->
            <div class="p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
               <!-- Search -->
               <div class="relative flex-1 min-w-[200px]">
                  <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                     <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  </div>
                  <input 
                     type="text" 
                     [(ngModel)]="searchQuery"
                     placeholder="Buscar congregación..." 
                     class="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium placeholder:text-slate-400 focus:bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none"
                  >
               </div>

               <!-- Import Button -->
               <button 
                  (click)="triggerFileInput()"
                  class="inline-flex items-center gap-2 px-4 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/30 transition-all active:scale-95"
               >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  <span class="hidden sm:inline">Importar Excel</span>
               </button>
               <input 
                  #fileInput 
                  type="file" 
                  accept=".xlsx,.xls" 
                  (change)="onFileSelected($event)"
                  class="hidden"
               >

               <!-- Add Button -->
               <button 
                  (click)="openCreateForm()"
                  class="inline-flex items-center gap-2 px-4 h-10 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-md shadow-purple-500/20 hover:shadow-lg hover:shadow-purple-500/30 transition-all active:scale-95"
               >
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  <span class="hidden sm:inline">Nueva</span>
               </button>
            </div>

            <!-- Table -->
            <div class="flex-1 overflow-y-auto">
               <table class="w-full">
                  <thead class="sticky top-0 bg-slate-50 border-b border-slate-100">
                     <tr>
                        <th class="text-left px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">Congregación</th>
                        <th class="text-left px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">Circuito</th>
                        <th class="text-left px-6 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Dirección</th>
                        <th class="w-16"></th>
                     </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-50">
                     <tr 
                        *ngFor="let c of filteredCongregaciones()" 
                        (click)="selectCongregacion(c)"
                        class="hover:bg-purple-50/50 cursor-pointer transition-colors group"
                        [class.bg-purple-50]="selectedCongregacion()?.id_congregacion === c.id_congregacion"
                     >
                        <td class="px-6 py-4">
                           <div class="flex items-center gap-4">
                              <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center text-purple-600 font-bold text-sm shadow-sm border border-purple-200/50">
                                 {{ getInitials(c.nombre_congregacion) }}
                              </div>
                              <div>
                                 <p class="font-bold text-slate-800 group-hover:text-purple-600 transition-colors">{{ c.nombre_congregacion }}</p>
                                 <p class="text-xs text-slate-400 font-medium">#{{ c.id_congregacion }}</p>
                              </div>
                           </div>
                        </td>
                        <td class="px-6 py-4 hidden md:table-cell">
                           <span class="text-sm text-slate-600 font-medium">{{ c.circuito || '—' }}</span>
                        </td>
                        <td class="px-6 py-4 hidden lg:table-cell">
                           <span class="text-sm text-slate-500 truncate max-w-[200px] block">{{ c.direccion || '—' }}</span>
                        </td>
                        <td class="px-4 py-4">
                           <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button (click)="$event.stopPropagation(); editCongregacion(c)" class="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-100 transition-colors">
                                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              </button>
                              <button (click)="$event.stopPropagation(); confirmDelete(c)" class="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                 <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                              </button>
                           </div>
                        </td>
                     </tr>

                     <!-- Empty State -->
                     <tr *ngIf="filteredCongregaciones().length === 0 && !loading()">
                        <td colspan="4" class="py-16 text-center">
                           <div class="flex flex-col items-center">
                              <div class="w-16 h-16 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl flex items-center justify-center mb-4 border border-purple-100/50">
                                 <svg class="w-8 h-8 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                              </div>
                              <h3 class="text-slate-800 font-bold mb-1">No hay congregaciones</h3>
                              <p class="text-slate-400 text-sm">Crea una nueva o importa desde Excel</p>
                           </div>
                        </td>
                     </tr>
                  </tbody>
               </table>

               <!-- Loading -->
               <div *ngIf="loading()" class="flex items-center justify-center py-12">
                  <div class="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
               </div>
            </div>

            <!-- Footer -->
            <div class="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
               <span class="text-xs font-semibold text-slate-500">
                  Mostrando {{ filteredCongregaciones().length }} de {{ congregaciones().length }} congregaciones
               </span>
            </div>
         </div>

         <!-- Right: Edit Panel -->
         <div 
            class="shrink-0 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
            [ngClass]="panelOpen() ? 'w-[420px] opacity-100' : 'w-0 opacity-0'"
         >
            <div *ngIf="panelOpen()" class="h-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
               
               <!-- Header -->
               <div class="p-6 border-b border-slate-100 bg-gradient-to-r from-purple-50 via-white to-indigo-50">
                  <div class="flex items-center justify-between">
                     <div class="flex items-center gap-4">
                        <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
                           <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        </div>
                        <div>
                           <h2 class="text-lg font-bold text-slate-800">{{ editingCongregacion() ? 'Editar' : 'Nueva' }} Congregación</h2>
                           <p *ngIf="editingCongregacion()" class="text-sm text-slate-500">{{ editingCongregacion()!.nombre_congregacion }}</p>
                        </div>
                     </div>
                     <button (click)="closePanel()" class="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                     </button>
                  </div>
               </div>

               <!-- Form -->
               <div class="flex-1 overflow-y-auto p-6">
                  <form [formGroup]="form" class="space-y-5">
                     
                     <div class="space-y-2">
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                           Nombre de la Congregación <span class="text-red-400">*</span>
                        </label>
                        <input 
                           formControlName="nombre_congregacion" 
                           class="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium shadow-sm focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none"
                           placeholder="Ej: Congregación Central"
                        >
                     </div>

                     <div class="space-y-2">
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">Circuito</label>
                        <input 
                           formControlName="circuito" 
                           class="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium shadow-sm focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none"
                           placeholder="Ej: C-15"
                        >
                     </div>

                     <div class="space-y-2">
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">Dirección</label>
                        <textarea 
                           formControlName="direccion" 
                           rows="3"
                           class="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium shadow-sm focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none resize-none"
                           placeholder="Dirección física..."
                        ></textarea>
                     </div>

                     <div class="space-y-2">
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider">Código de Seguridad</label>
                        <input 
                           formControlName="codigo_seguridad" 
                           class="w-full h-12 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium shadow-sm focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all outline-none font-mono"
                           placeholder="Código opcional..."
                        >
                     </div>
                  </form>
               </div>

               <!-- Footer -->
               <div class="p-6 border-t border-slate-100 flex gap-3">
                  <button 
                     (click)="closePanel()"
                     class="flex-1 h-12 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                  >
                     Descartar
                  </button>
                  <button 
                     (click)="save()"
                     [disabled]="form.invalid || saving()"
                     class="flex-1 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                     <div *ngIf="saving()" class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                     {{ saving() ? 'Guardando...' : 'Guardar Cambios' }}
                  </button>
               </div>
            </div>
         </div>
      </div>

      <!-- Tab Content: General -->
      <div *ngIf="currentTab() === 'general'" class="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
         <div class="flex flex-col items-center justify-center py-12 text-slate-400">
            <div class="w-20 h-20 bg-slate-50 rounded-2xl flex items-center justify-center mb-4">
               <svg class="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </div>
            <h3 class="text-lg font-bold text-slate-600 mb-2">Configuración General</h3>
            <p class="text-sm">Próximamente más opciones de configuración</p>
         </div>
      </div>

      <!-- Import Progress Modal -->
      <div *ngIf="importing()" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
         <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
            <div class="flex flex-col items-center">
               <div class="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-6">
                  <div class="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin"></div>
               </div>
               <h3 class="text-xl font-bold text-slate-800 mb-2">Importando Congregaciones</h3>
               <p class="text-slate-500 text-center">Procesando archivo Excel, por favor espere...</p>
            </div>
         </div>
      </div>

      <!-- Success Toast -->
      <div *ngIf="showSuccess()" class="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-4 bg-emerald-500 text-white font-semibold rounded-2xl shadow-xl flex items-center gap-3 animate-fadeIn">
         <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
         {{ successMessage() }}
      </div>
   </div>
   `,
   styles: [`
      :host { display: block; }
      .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
   `]
})
export class ConfiguracionPage implements OnInit {
   private http = inject(HttpClient);
   private fb = inject(FormBuilder);
   private API_URL = `${environment.apiUrl}/congregaciones/`;

   currentTab = signal<ConfigTab>('congregaciones');
   congregaciones = signal<Congregacion[]>([]);
   selectedCongregacion = signal<Congregacion | null>(null);
   editingCongregacion = signal<Congregacion | null>(null);

   searchQuery = '';
   loading = signal(false);
   saving = signal(false);
   importing = signal(false);
   panelOpen = signal(false);
   showSuccess = signal(false);
   successMessage = signal('');

   form: FormGroup;

   filteredCongregaciones = computed(() => {
      const q = this.searchQuery.toLowerCase().trim();
      if (!q) return this.congregaciones();
      return this.congregaciones().filter(c =>
         c.nombre_congregacion.toLowerCase().includes(q) ||
         (c.circuito || '').toLowerCase().includes(q)
      );
   });

   constructor() {
      this.form = this.fb.group({
         nombre_congregacion: ['', Validators.required],
         circuito: [''],
         direccion: [''],
         codigo_seguridad: ['']
      });
   }

   ngOnInit() {
      this.loadCongregaciones();
   }

   async loadCongregaciones() {
      this.loading.set(true);
      try {
         const res = await lastValueFrom(this.http.get<Congregacion[]>(this.API_URL));
         this.congregaciones.set(res || []);
      } catch (err) {
         console.error('Error loading congregaciones', err);
      } finally {
         this.loading.set(false);
      }
   }

   getInitials(name: string): string {
      return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
   }

   selectCongregacion(c: Congregacion) {
      this.selectedCongregacion.set(c);
   }

   openCreateForm() {
      this.editingCongregacion.set(null);
      this.form.reset();
      this.panelOpen.set(true);
   }

   editCongregacion(c: Congregacion) {
      this.editingCongregacion.set(c);
      this.form.patchValue(c);
      this.panelOpen.set(true);
   }

   closePanel() {
      this.panelOpen.set(false);
      this.editingCongregacion.set(null);
   }

   async save() {
      if (this.form.invalid || this.saving()) return;

      this.saving.set(true);
      try {
         const data = this.form.value;

         if (this.editingCongregacion()) {
            await lastValueFrom(
               this.http.put(`${this.API_URL}${this.editingCongregacion()!.id_congregacion}`, data)
            );
            this.showSuccessToast('Congregación actualizada');
         } else {
            await lastValueFrom(this.http.post(this.API_URL, data));
            this.showSuccessToast('Congregación creada');
         }

         this.closePanel();
         await this.loadCongregaciones();
      } catch (err: any) {
         alert(err.error?.detail || 'Error al guardar');
      } finally {
         this.saving.set(false);
      }
   }

   async confirmDelete(c: Congregacion) {
      if (!confirm(`¿Eliminar congregación "${c.nombre_congregacion}"? Esta acción no se puede deshacer.`)) return;

      try {
         await lastValueFrom(this.http.delete(`${this.API_URL}${c.id_congregacion}`));
         this.showSuccessToast('Congregación eliminada');
         if (this.selectedCongregacion()?.id_congregacion === c.id_congregacion) {
            this.selectedCongregacion.set(null);
         }
         await this.loadCongregaciones();
      } catch (err: any) {
         alert(err.error?.detail || 'Error al eliminar');
      }
   }

   triggerFileInput() {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      input?.click();
   }

   async onFileSelected(event: Event) {
      const input = event.target as HTMLInputElement;
      const file = input.files?.[0];
      if (!file) return;

      this.importing.set(true);
      try {
         const formData = new FormData();
         formData.append('archivo', file);

         const res = await lastValueFrom(
            this.http.post<any>(`${environment.apiUrl}/import/congregaciones`, formData)
         );

         console.log('Import result:', res);

         // El backend devuelve { success, detalle, resumen }
         const resumen = res?.resumen || {};
         const insertados = resumen.insertados ?? 0;
         const actualizados = resumen.actualizados ?? 0;
         const omitidos = resumen.omitidos ?? 0;
         const errores = resumen.errores ?? 0;
         const filas = resumen.filas ?? 0;

         // Mostrar resumen detallado
         const mensaje = `Importación completada:\n` +
            `• Filas procesadas: ${filas}\n` +
            `• Publicadores insertados: ${insertados}\n` +
            `• Publicadores actualizados: ${actualizados}\n` +
            `• Filas omitidas: ${omitidos}\n` +
            `• Errores: ${errores}`;

         alert(mensaje);
         this.showSuccessToast(`${insertados + actualizados} publicadores importados`);
         await this.loadCongregaciones();
      } catch (err: any) {
         console.error('Import error:', err);
         const detail = err.error?.detail || err.message || 'Error al importar';
         alert(typeof detail === 'string' ? detail : JSON.stringify(detail));
      } finally {
         this.importing.set(false);
         input.value = '';
      }
   }

   showSuccessToast(message: string) {
      this.successMessage.set(message);
      this.showSuccess.set(true);
      setTimeout(() => this.showSuccess.set(false), 3000);
   }
}
