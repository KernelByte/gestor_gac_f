import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReunionesService } from '../services/reuniones.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import {
  PublicadorMatrizItem,
  ColumnaPermiso,
  CambioPermisoPublicador,
  UpdateMatrizRequest
} from '../models/reuniones.models';

@Component({
  selector: 'app-reuniones-configuracion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col gap-5 h-full">

       <!-- ===== PAGE HEADER ===== -->
       <div class="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
           <div>
               <h2 class="text-2xl font-display font-black text-slate-900 dark:text-white tracking-tight leading-tight">Configuracion del Motor</h2>
               <p class="text-xs text-slate-400 dark:text-slate-500 mt-1">Ajuste las capacidades de los publicadores para las asignaciones automaticas.</p>
           </div>
           <div class="flex items-center gap-2 shrink-0">
               @if (hasPendingChanges()) {
                 <span class="text-[0.625rem] font-bold text-amber-500 dark:text-amber-400 animate-pulse">
                   {{ pendingCount() }} cambio{{ pendingCount() > 1 ? 's' : '' }}
                 </span>
               }
               <button
                 (click)="guardarCambios()"
                 [disabled]="!hasPendingChanges() || saving()"
                 class="flex items-center gap-1.5 px-3 h-9 rounded-lg bg-[#6D28D9] hover:bg-[#5b21b6] text-white text-xs font-bold shadow-sm shadow-purple-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95">
                   @if (saving()) {
                     <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                   } @else {
                     <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                   }
                   Guardar
               </button>
           </div>
       </div>

       <!-- Toast -->
       @if (toast()) {
         <div class="shrink-0 animate-slideDown flex items-center gap-3 px-4 py-2.5 rounded-xl border shadow-sm"
              [class]="toast()!.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200/60 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200/60 dark:border-red-800/50 text-red-700 dark:text-red-300'">
           <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                [class]="toast()!.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'">
             @if (toast()!.type === 'success') {
               <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
             } @else {
               <svg class="w-3.5 h-3.5 text-red-600 dark:text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
             }
           </div>
           <span class="text-xs font-bold">{{ toast()!.message }}</span>
         </div>
       }

       <!-- ===== COMPACT TOOLBAR: Search + Filters ===== -->
       <div class="shrink-0 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200/60 dark:border-slate-700/60 p-1.5 flex items-center gap-1.5 flex-wrap lg:flex-nowrap">

           <!-- Search -->
           <div class="relative flex-1 min-w-[200px]">
               <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                   <svg class="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
               </div>
               <input type="text"
                 [ngModel]="searchQuery()"
                 (ngModelChange)="searchQuery.set($event)"
                 placeholder="Buscar publicador..."
                 class="w-full h-9 pl-9 pr-3 bg-slate-50 dark:bg-slate-800/50 border border-transparent dark:border-slate-700/50 rounded-lg text-sm text-slate-700 dark:text-slate-200 font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:border-[#6D28D9]/50 focus:ring-2 focus:ring-[#6D28D9]/20 transition-all outline-none">
           </div>

           <!-- Separator -->
           <div class="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden lg:block shrink-0"></div>

           <!-- Sex filter pills -->
           <div class="hidden md:flex items-center gap-1 shrink-0">
               <button
                 (click)="setFiltroSexo('solo_hombres')"
                 class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                 [class]="filtroSexo() === 'solo_hombres'
                   ? 'bg-blue-500 text-white shadow-sm'
                   : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'">
                   Hermanos
               </button>
               <button
                 (click)="setFiltroSexo('solo_mujeres')"
                 class="flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
                 [class]="filtroSexo() === 'solo_mujeres'
                   ? 'bg-rose-500 text-white shadow-sm'
                   : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'">
                   Hermanas
               </button>
           </div>
       </div>

       <!-- ===== MATRIZ DE PUBLICADORES ===== -->
        <div class="flex-1 min-h-0 flex flex-col gap-4">

           <!-- Loading -->
           @if (loading()) {
             <div class="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center">
               <div class="flex flex-col items-center gap-3">
                 <div class="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700 border-t-[#6D28D9] animate-spin"></div>
                 <p class="text-xs text-slate-400 dark:text-slate-500 font-medium">Cargando publicadores...</p>
               </div>
             </div>
           }

           <!-- Error -->
           @if (errorMsg()) {
             <div class="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 flex items-center gap-3">
               <div class="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
                 <svg class="w-4 h-4 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
               </div>
               <div class="flex-1 min-w-0">
                 <p class="text-sm font-bold text-red-700 dark:text-red-300">Error al cargar</p>
                 <p class="text-xs text-red-500 dark:text-red-400/80 truncate">{{ errorMsg() }}</p>
               </div>
               <button (click)="loadMatriz()" class="shrink-0 px-3 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-xs text-red-600 dark:text-red-400 font-bold transition-all">
                 Reintentar
               </button>
             </div>
           }

           @if (!loading() && !errorMsg()) {
             <!-- Stats bar -->
             <div class="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-slate-800 dark:text-white tabular-nums">{{ filteredPublicadores().length }}</p>
                 <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Publicadores</p>
               </div>
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{{ countPrivilegio('Anciano') }}</p>
                 <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Ancianos</p>
               </div>
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-blue-600 dark:text-blue-400 tabular-nums">{{ countPrivilegio('Siervo Ministerial') }}</p>
                 <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">S. Ministeriales</p>
               </div>
               <div class="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-700/60 p-3 text-center shadow-sm">
                 <p class="text-xl font-black text-slate-600 dark:text-slate-300 tabular-nums">{{ countPrecursores() }}</p>
                 <p class="text-[0.625rem] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider mt-0.5">Precursores</p>
               </div>
             </div>

             <!-- Data Table -->
             <div class="flex-1 min-h-0 relative flex flex-col overflow-hidden bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                 <div class="flex-1 min-h-0 overflow-x-auto overflow-y-auto simple-scrollbar">
                     <table class="w-full min-w-max text-left border-collapse">
                         <thead class="sticky top-0 z-10 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
                             <tr class="border-b border-slate-200 dark:border-slate-700">
                                 <th class="px-4 py-2 text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider sticky left-0 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-md z-10 min-w-[150px]">Publicador</th>
                                 <th class="px-2 py-2 text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center min-w-[80px]">Privilegio</th>
                                 <th *ngFor="let col of columnas()"
                                     class="px-2 py-2 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center min-w-[70px] leading-tight whitespace-normal">
                                   {{ col.label }}
                                 </th>
                                 <th class="px-2 py-2 text-[0.625rem] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-center min-w-[90px] leading-tight whitespace-normal">
                                   Nivel Oratoria
                                 </th>
                             </tr>
                         </thead>
                         <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
                              @for (pub of paginatedPublicadores(); track pub.id_publicador) {
                                <tr class="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                    [class.bg-amber-50/30]="isDirty(pub.id_publicador)"
                                    [class.dark:bg-amber-900/10]="isDirty(pub.id_publicador)">

                                   <!-- Publicador -->
                                   <td class="px-4 py-2 sticky left-0 bg-white dark:bg-slate-900 z-10 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/40 transition-colors border-r border-slate-100 dark:border-slate-800/50">
                                       <div class="flex items-center gap-3">
                                           <div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[0.6875rem] shrink-0 ring-1 ring-white dark:ring-slate-800"
                                                [class]="avatarClass(pub)">
                                             {{ pub.primer_nombre[0] }}{{ pub.primer_apellido[0] }}
                                           </div>
                                           <div>
                                               <div class="text-[0.8125rem] font-bold text-slate-800 dark:text-white truncate max-w-[140px] leading-tight" [title]="pub.primer_nombre + ' ' + pub.primer_apellido">
                                         {{ pub.primer_nombre.split(' ')[0] }} {{ pub.primer_apellido.split(' ')[0] }}
                                     </div>
                                     <div class="text-[0.6875rem] text-slate-400 dark:text-slate-500 font-medium">
                                         {{ isHermano(pub) ? 'Hermano' : 'Hermana' }}
                                     </div>
                                           </div>
                                       </div>
                                   </td>

                                   <!-- Privilegio -->
                                   <td class="px-2 py-2 text-center">
                                       <div class="flex flex-wrap gap-1 justify-center">
                                         @for (priv of pub.privilegios; track priv) {
                                           <div class="text-[9px] font-bold px-1.5 py-0.5 inline-block rounded-md"
                                                [title]="priv"
                                                [class]="privilegioBadgeClass(priv)">
                                             {{ privilegioLabel(priv) }}
                                           </div>
                                         }
                                       </div>
                                   </td>

                                   <!-- Permisos checkboxes -->
                                   <td *ngFor="let col of columnas()"
                                       class="px-1 py-2 text-center">
                                         <label class="inline-flex items-center justify-center cursor-pointer p-1">
                                           <input type="checkbox"
                                             [checked]="getPermiso(pub, col.key)"
                                             (change)="togglePermiso(pub, col.key)"
                                             class="w-4 h-4 text-[#6D28D9] rounded border-slate-300 dark:border-slate-600 focus:ring-[#6D28D9] focus:ring-offset-0 cursor-pointer transition-colors">
                                         </label>
                                   </td>
                                   
                                   <!-- Nivel Oratoria Selector -->
                                   <td class="px-2 py-2 text-center">
                                     <select
                                       [ngModel]="getOratoria(pub)"
                                       (ngModelChange)="setOratoria(pub, $event)"
                                       class="h-7 px-1 w-[85px] rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-[9px] font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#6D28D9]/20 transition-all cursor-pointer truncate"
                                       [class.border-amber-400]="isOratoriaDirty(pub.id_publicador)">
                                       <option [value]="1">Principiante</option>
                                       <option [value]="2">Básico</option>
                                       <option [value]="3">Intermedio</option>
                                       <option [value]="4">Avanzado</option>
                                       <option [value]="5">Experto</option>
                                     </select>
                                   </td>
                               </tr>
                             }
                         </tbody>
                     </table>
                  </div>

                  <!-- Pagination -->
                  <div class="shrink-0 px-5 py-2.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                    <span class="text-[0.6875rem] text-slate-400 dark:text-slate-500 font-medium tabular-nums">
                      {{ (currentPage() - 1) * pageSize() + 1 }}–{{ Math.min(currentPage() * pageSize(), filteredPublicadores().length) }}
                      <span class="text-slate-300 dark:text-slate-600">de</span>
                      {{ filteredPublicadores().length }}
                    </span>
                    <div class="flex items-center gap-0.5">
                        <button (click)="prevPage()"
                                [disabled]="currentPage() === 1"
                                class="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-slate-400 dark:text-slate-500 flex items-center justify-center">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 18l-6-6 6-6"/></svg>
                        </button>

                        @for (item of getPagesArray(); track $index) {
                          @if (item === null) {
                            <span class="w-7 h-7 flex items-center justify-center text-[0.6875rem] text-slate-300 dark:text-slate-600 select-none">···</span>
                          } @else {
                            <button (click)="setPage(item)"
                                    class="w-7 h-7 rounded-lg text-xs font-bold transition-all"
                                    [class]="currentPage() === item
                                      ? 'bg-[#6D28D9] text-white shadow-sm'
                                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200'">
                              {{ item }}
                            </button>
                          }
                        }

                        <button (click)="nextPage()"
                                [disabled]="currentPage() === totalPages()"
                                class="w-7 h-7 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-slate-400 dark:text-slate-500 flex items-center justify-center">
                          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 18l6-6-6-6"/></svg>
                        </button>
                    </div>
                  </div>
              </div>
            }
        </div>

    </div>
  `,
  styles: [`
     :host { display: block; height: 100%; }
     .animate-fadeIn {
       animation: fadeIn 0.2s ease-out;
     }
     .animate-slideDown {
       animation: slideDown 0.25s ease-out;
     }
     @keyframes fadeIn {
       from { opacity: 0; transform: translateY(4px); }
       to { opacity: 1; transform: translateY(0); }
     }
     @keyframes slideDown {
       from { opacity: 0; transform: translateY(-8px); }
       to { opacity: 1; transform: translateY(0); }
     }
     /* Sticky column shadow */
     td.sticky, th.sticky {
       box-shadow: 2px 0 6px -2px rgba(0,0,0,0.06);
     }
  `]
})
export class ReunionesConfiguracionComponent implements OnInit {

  private reunionesSvc = inject(ReunionesService);
  private congregacionCtx = inject(CongregacionContextService);

  // ── Data ──
  publicadores = signal<PublicadorMatrizItem[]>([]);
  columnas = signal<ColumnaPermiso[]>([]);
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal<string | null>(null);
  toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);

  // ── Filters & Pagination ──
  searchQuery = signal('');
  filtroSexo = signal<'todos' | 'solo_hombres' | 'solo_mujeres'>('todos');
  currentPage = signal(1);
  pageSize = signal(11);
  protected readonly Math = Math;

  // ── Change tracking ──
  private dirtyMap = new Map<number, Record<string, boolean>>();
  private dirtyOratoriaMap = new Map<number, number>();

  // ── Computed ──
  filteredPublicadores = computed(() => {
    let list = this.publicadores();
    const q = this.searchQuery().toLowerCase().trim();
    const sexoFilter = this.filtroSexo();

    if (q) {
      list = list.filter(p =>
        `${p.primer_nombre} ${p.primer_apellido}`.toLowerCase().includes(q)
      );
    }

    if (sexoFilter === 'solo_hombres') {
      list = list.filter(p => this.isHermano(p));
    } else if (sexoFilter === 'solo_mujeres') {
      list = list.filter(p => !this.isHermano(p));
    }
    return list;
  });

  paginatedPublicadores = computed(() => {
    const list = this.filteredPublicadores();
    const start = (this.currentPage() - 1) * this.pageSize();
    return list.slice(start, start + this.pageSize());
  });

  totalPages = computed(() => Math.ceil(this.filteredPublicadores().length / this.pageSize()));

  hasPendingChanges = computed(() => this.pendingCount() > 0);
  pendingCount = signal(0);

  // ── Lifecycle ──
  ngOnInit(): void {
    this.loadMatriz();
  }

  loadMatriz(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) {
      this.errorMsg.set('No hay congregación seleccionada. Selecciona una en el panel de administración.');
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);
    this.dirtyMap.clear();
    this.dirtyOratoriaMap.clear();
    this.pendingCount.set(0);

    this.reunionesSvc.getMatrizConfiguracion(idCong).subscribe({
      next: (res) => {
        this.publicadores.set(res.publicadores);
        this.columnas.set(res.columnas);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.detail ?? err?.message ?? 'Error al cargar la configuración.';
        this.errorMsg.set(msg);
        this.loading.set(false);
      }
    });
  }

  // ── Permission Handling ──
  getPermiso(pub: PublicadorMatrizItem, key: string): boolean {
    // Check dirty first
    const dirty = this.dirtyMap.get(pub.id_publicador);
    if (dirty && key in dirty) {
      return dirty[key];
    }
    return pub.permisos[key] ?? false;
  }

  togglePermiso(pub: PublicadorMatrizItem, key: string): void {
    const current = this.getPermiso(pub, key);
    const newVal = !current;

    // Check if it's the same as original (undo)
    const original = pub.permisos[key] ?? false;
    let dirty = this.dirtyMap.get(pub.id_publicador);

    if (newVal === original) {
      // Revert — remove from dirty
      if (dirty) {
        delete dirty[key];
        if (Object.keys(dirty).length === 0) {
          this.dirtyMap.delete(pub.id_publicador);
        }
      }
    } else {
      // Mark as dirty
      if (!dirty) {
        dirty = {};
        this.dirtyMap.set(pub.id_publicador, dirty);
      }
      dirty[key] = newVal;
    }

    // Update signal
    this.pendingCount.set(this.dirtyMap.size + this.dirtyOratoriaMap.size);

    // Force reactivity update
    this.publicadores.update(list => [...list]);
  }

  isDirty(id: number): boolean {
    return this.dirtyMap.has(id) || this.dirtyOratoriaMap.has(id);
  }

  isOratoriaDirty(id: number): boolean {
    return this.dirtyOratoriaMap.has(id);
  }

  getOratoria(pub: PublicadorMatrizItem): number {
    return this.dirtyOratoriaMap.get(pub.id_publicador) ?? pub.nivel_oratoria ?? 3;
  }

  setOratoria(pub: PublicadorMatrizItem, value: any): void {
    const numValue = Number(value);
    const original = pub.nivel_oratoria ?? 3;
    
    if (numValue === original) {
      this.dirtyOratoriaMap.delete(pub.id_publicador);
    } else {
      this.dirtyOratoriaMap.set(pub.id_publicador, numValue);
    }
    
    this.pendingCount.set(this.dirtyMap.size + this.dirtyOratoriaMap.size);
    this.publicadores.update(list => [...list]);
  }

  setFiltroSexo(filter: 'solo_hombres' | 'solo_mujeres'): void {
    if (this.filtroSexo() === filter) {
      this.filtroSexo.set('todos'); // Toggle off
    } else {
      this.filtroSexo.set(filter); // Toggle on
    }
  }

  // ── Save ──
  guardarCambios(): void {
    const idCong = this.congregacionCtx.effectiveCongregacionId();
    if (!idCong) return;

    if (this.pendingCount() > 0) {
      this.saving.set(true);
      this.toast.set(null);

      const cambios: CambioPermisoPublicador[] = [];
      const changedIds = new Set([...this.dirtyMap.keys(), ...this.dirtyOratoriaMap.keys()]);
      
      changedIds.forEach(id_publicador => {
        const permisos = this.dirtyMap.get(id_publicador);
        const nivel_oratoria = this.dirtyOratoriaMap.get(id_publicador);
        
        const cambio: CambioPermisoPublicador = { id_publicador, permisos: permisos || {} };
        if (nivel_oratoria !== undefined) {
           cambio.nivel_oratoria = nivel_oratoria;
        }
        cambios.push(cambio);
      });

      const payload: UpdateMatrizRequest = {
        id_congregacion: idCong,
        cambios,
      };

      this.reunionesSvc.updateMatrizConfiguracion(payload).subscribe({
        next: (res) => {
          // Apply dirty changes to the model as official values
          this.publicadores.update(list =>
            list.map(pub => {
              const dirty = this.dirtyMap.get(pub.id_publicador);
              const dirtyOratoria = this.dirtyOratoriaMap.get(pub.id_publicador);
              if (!dirty && dirtyOratoria === undefined) return pub;
              
              return {
                ...pub,
                permisos: dirty ? { ...pub.permisos, ...dirty } : pub.permisos,
                nivel_oratoria: dirtyOratoria ?? pub.nivel_oratoria
              };
            })
          );
          this.saving.set(false);
          this.dirtyMap.clear();
          this.dirtyOratoriaMap.clear();
          this.pendingCount.set(0);
          this.publicadores.update(list => [...list]);
          this.showToast('success', res.message);
        },
        error: (err) => {
          const msg = err?.error?.detail ?? 'Error al guardar los cambios.';
          this.saving.set(false);
          this.showToast('error', msg);
        }
      });
    }
  }

  // ── Pagination Helpers ──
  setPage(p: number) {
    this.currentPage.set(p);
  }

  prevPage() {
    if (this.currentPage() > 1) this.setPage(this.currentPage() - 1);
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) this.setPage(this.currentPage() + 1);
  }

  getPagesArray(): (number | null)[] {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: (number | null)[] = [1];
    if (current > 3) pages.push(null);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push(null);
    pages.push(total);
    return pages;
  }

  // ── Helpers ──
  isHermano(pub: PublicadorMatrizItem): boolean {
    return pub.sexo === 'M' || pub.sexo === 'Masculino';
  }

  countPrivilegio(nombre: string): number {
    return this.filteredPublicadores().filter(p => p.privilegios.includes(nombre)).length;
  }

  countHombres(): number {
    return this.filteredPublicadores().filter(p => this.isHermano(p)).length;
  }

  countPrecursores(): number {
    return this.filteredPublicadores().filter(p =>
      p.privilegios.includes('Precursor Regular') ||
      p.privilegios.includes('Precursor Especial')
    ).length;
  }

  avatarClass(pub: PublicadorMatrizItem): string {
    const base = 'bg-gradient-to-br ';
    if (pub.privilegios.includes('Anciano') || pub.privilegios.includes('Superintendente')) {
      return base + 'from-amber-100 to-yellow-100 text-amber-700';
    }
    if (pub.privilegios.includes('Siervo Ministerial')) {
      return base + 'from-blue-100 to-cyan-100 text-blue-700';
    }
    if (!this.isHermano(pub)) {
      return base + 'from-pink-100 to-rose-100 text-pink-600';
    }
    return base + 'from-slate-100 to-slate-200 text-slate-600';
  }

  privilegioLabel(priv: string): string {
    const abreviaciones: Record<string, string> = {
      'Superintendente': 'Sup.',
      'Anciano': 'Anciano',
      'Siervo Ministerial': 'S.M.',
      'Precursor Especial': 'P. Esp.',
      'Precursor Regular': 'P. Reg.',
      'Precursor Auxiliar': 'P. Aux.',
      'Publicador': 'Pub.',
    };
    return abreviaciones[priv] ?? priv;
  }

  privilegioBadgeClass(priv: string): string {
    switch (priv) {
      case 'Anciano':
      case 'Superintendente':
        return 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700/50';
      case 'Siervo Ministerial':
        return 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50';
      case 'Precursor Regular':
      case 'Precursor Especial':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700/50';
      case 'Precursor Auxiliar':
        return 'bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-700/50';
      default:
        return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400';
    }
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
