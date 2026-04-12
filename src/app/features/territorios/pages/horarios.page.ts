import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TerritoriosService } from '../services/territorios.service';
import { CongregacionContextService } from '../../../core/congregacion-context/congregacion-context.service';
import { Territorio } from '../models/territorio.model';

interface Horario {
  id_horario: number;
  id_congregacion?: number | null;
  id_territorio?: number | null;
  id_capitan?: number | null;
  nombre_capitan?: string | null;
  id_punto_salida?: number | null;
  nombre_punto_salida?: string | null;
  fecha_programada: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  id_salida?: number | null;
  notas?: string | null;
  nombre_territorio?: string | null;
  codigo_territorio?: string | null;
}

interface Publicador {
  id_publicador: number;
  primer_nombre: string;
  primer_apellido: string;
}

@Component({
  standalone: true,
  selector: 'app-horarios-page',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#f3f4f6] dark:bg-slate-950 p-4 lg:p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-xl font-black text-slate-900 dark:text-white">Horarios de Predicación</h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Programa y registra salidas de predicación</p>
        </div>
        <button (click)="openNuevoHorarioModal()"
          class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/10 transition-all flex items-center gap-2">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Nuevo Horario
        </button>
      </div>

      <!-- Filters -->
      <div class="flex gap-3 mb-5 flex-wrap">
        <select [(ngModel)]="filtroTerritorio" (ngModelChange)="loadHorarios()"
          class="text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option [ngValue]="null">Todos los territorios</option>
          @for (t of territorios(); track t.id_territorio) {
            <option [ngValue]="t.id_territorio">{{ t.codigo }} — {{ t.nombre }}</option>
          }
        </select>
        <select [(ngModel)]="filtroEstado" (ngModelChange)="loadHorarios()"
          class="text-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="todos">Todos</option>
          <option value="pendiente">Pendientes</option>
          <option value="ejecutado">Ejecutados</option>
        </select>
      </div>

      <!-- Content -->
      @if (loading()) {
        <div class="flex justify-center py-16">
          <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      } @else if (horariosFiltrados().length === 0) {
        <div class="text-center py-16 text-slate-400">
          <svg class="w-12 h-12 mx-auto mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <p class="font-semibold text-slate-500 dark:text-slate-400">No hay horarios programados</p>
          <p class="text-sm mt-1">Crea el primer horario para comenzar</p>
        </div>
      } @else {
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          @for (h of horariosFiltrados(); track h.id_horario) {
            <div class="bg-white dark:bg-slate-800 rounded-2xl border p-4 shadow-sm hover:shadow-md transition-shadow"
              [class]="h.id_salida ? 'border-emerald-200 dark:border-emerald-800/40' : 'border-slate-200 dark:border-slate-700/50'">
              <!-- Status badge -->
              <div class="flex items-start justify-between mb-3">
                <span class="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
                  [class]="h.id_salida ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'">
                  {{ h.id_salida ? 'Ejecutado' : 'Pendiente' }}
                </span>
                <div class="flex gap-1">
                  @if (!h.id_salida) {
                    <button (click)="ejecutar(h)" [disabled]="ejecutandoId() === h.id_horario"
                      class="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-40"
                      title="Ejecutar → crear salida">
                      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    </button>
                  }
                  <button (click)="openEditHorarioModal(h)"
                    class="p-1.5 text-slate-400 hover:text-blue-500 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                  </button>
                  <button (click)="deleteHorario(h.id_horario)"
                    class="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>
                  </button>
                </div>
              </div>

              <!-- Date & time -->
              <p class="text-base font-black text-slate-800 dark:text-white">{{ h.fecha_programada }}</p>
              @if (h.hora_inicio) {
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ h.hora_inicio }}{{ h.hora_fin ? ' – ' + h.hora_fin : '' }}</p>
              }

              <!-- Territory -->
              @if (h.codigo_territorio) {
                <div class="mt-2 flex items-center gap-1.5">
                  <span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">{{ h.codigo_territorio }}</span>
                  <span class="text-xs text-slate-600 dark:text-slate-300 truncate">{{ h.nombre_territorio }}</span>
                </div>
              }

              <!-- Captain & departure -->
              @if (h.nombre_capitan) {
                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                  <span class="font-semibold">Capitán:</span> {{ h.nombre_capitan }}
                </p>
              }
              @if (h.nombre_punto_salida) {
                <p class="text-xs text-slate-500 dark:text-slate-400 truncate">
                  <span class="font-semibold">Desde:</span> {{ h.nombre_punto_salida }}
                </p>
              }
              @if (h.notas) {
                <p class="text-[11px] text-slate-400 mt-1 italic truncate">{{ h.notas }}</p>
              }

              <!-- Link to salida if executed -->
              @if (h.id_salida) {
                <a routerLink="/territorios" class="mt-2 inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  Ver salida #{{ h.id_salida }}
                </a>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- Modal Horario -->
    @if (showModal()) {
    <div class="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" (click)="showModal.set(false)"></div>
      <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md relative z-10 shadow-2xl overflow-hidden">
        <div class="p-5 border-b border-slate-100 dark:border-slate-700/50">
          <h3 class="text-base font-black text-slate-900 dark:text-white">{{ editingId() ? 'Editar Horario' : 'Nuevo Horario' }}</h3>
        </div>
        <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Fecha *</label>
            <input type="date" [(ngModel)]="form.fecha_programada"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hora inicio</label>
              <input type="time" [(ngModel)]="form.hora_inicio"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hora fin</label>
              <input type="time" [(ngModel)]="form.hora_fin"
                class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Territorio</label>
            <select [(ngModel)]="form.id_territorio"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option [ngValue]="null">— Sin asignar —</option>
              @for (t of territorios(); track t.id_territorio) {
                <option [ngValue]="t.id_territorio">{{ t.codigo }} — {{ t.nombre }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Capitán</label>
            <select [(ngModel)]="form.id_capitan"
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option [ngValue]="null">— Sin asignar —</option>
              @for (p of publicadores(); track p.id_publicador) {
                <option [ngValue]="p.id_publicador">{{ p.primer_nombre }} {{ p.primer_apellido }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Notas (opcional)</label>
            <input type="text" [(ngModel)]="form.notas" placeholder="Observaciones..."
              class="w-full px-3 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <div class="p-5 border-t border-slate-100 dark:border-slate-700/50 flex gap-3">
          <button (click)="showModal.set(false)" class="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">Cancelar</button>
          <button (click)="save()" [disabled]="!form.fecha_programada || saving()"
            class="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition-colors disabled:opacity-50">
            {{ saving() ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </div>
    </div>
    }
  `,
})
export class HorariosPage implements OnInit {
  private http = inject(HttpClient);
  private territoriosService = inject(TerritoriosService);
  private congregacionCtx = inject(CongregacionContextService);

  horarios = signal<Horario[]>([]);
  territorios = signal<Territorio[]>([]);
  publicadores = signal<Publicador[]>([]);
  loading = signal(false);
  saving = signal(false);
  ejecutandoId = signal<number | null>(null);
  showModal = signal(false);
  editingId = signal<number | null>(null);

  filtroTerritorio: number | null = null;
  filtroEstado: 'todos' | 'pendiente' | 'ejecutado' = 'todos';

  form: Partial<Horario> = {};

  horariosFiltrados = computed(() => {
    let list = this.horarios();
    if (this.filtroTerritorio) {
      list = list.filter(h => h.id_territorio === this.filtroTerritorio);
    }
    if (this.filtroEstado === 'pendiente') list = list.filter(h => !h.id_salida);
    if (this.filtroEstado === 'ejecutado') list = list.filter(h => !!h.id_salida);
    return list;
  });

  ngOnInit(): void {
    this.loadHorarios();
    this.loadTerritorios();
    this.loadPublicadores();
  }

  loadHorarios(): void {
    this.loading.set(true);
    const congId = this.congregacionCtx.effectiveCongregacionId();
    let params: any = {};
    if (congId) params.id_congregacion = congId;
    if (this.filtroTerritorio) params.id_territorio = this.filtroTerritorio;
    this.http.get<Horario[]>('/api/horarios', { params }).subscribe({
      next: (list) => { this.horarios.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadTerritorios(): void {
    this.territoriosService.getTerritorios(0, 500).subscribe({
      next: (list) => this.territorios.set(list),
    });
  }

  loadPublicadores(): void {
    const congId = this.congregacionCtx.effectiveCongregacionId();
    let params: any = { limit: 1000 };
    if (congId) params.id_congregacion = congId;
    this.http.get<Publicador[]>('/api/publicadores/', { params }).subscribe({
      next: (list) => this.publicadores.set(list),
    });
  }

  openNuevoHorarioModal(): void {
    this.form = { fecha_programada: new Date().toISOString().slice(0, 10) };
    this.editingId.set(null);
    this.showModal.set(true);
  }

  openEditHorarioModal(h: Horario): void {
    this.form = {
      fecha_programada: h.fecha_programada,
      hora_inicio: h.hora_inicio ?? '',
      hora_fin: h.hora_fin ?? '',
      id_territorio: h.id_territorio ?? null,
      id_capitan: h.id_capitan ?? null,
      notas: h.notas ?? '',
    };
    this.editingId.set(h.id_horario);
    this.showModal.set(true);
  }

  save(): void {
    if (!this.form.fecha_programada) return;
    this.saving.set(true);
    const id = this.editingId();
    const congId = this.congregacionCtx.effectiveCongregacionId();
    const payload = { ...this.form, id_congregacion: congId };
    const obs = id
      ? this.http.put<Horario>(`/api/horarios/${id}`, payload)
      : this.http.post<Horario>('/api/horarios', payload);
    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.showModal.set(false);
        this.loadHorarios();
      },
      error: () => this.saving.set(false),
    });
  }

  deleteHorario(id: number): void {
    this.http.delete(`/api/horarios/${id}`).subscribe({
      next: () => this.horarios.update(list => list.filter(h => h.id_horario !== id)),
    });
  }

  ejecutar(h: Horario): void {
    this.ejecutandoId.set(h.id_horario);
    this.http.post<Horario>(`/api/horarios/${h.id_horario}/ejecutar`, {}).subscribe({
      next: (updated) => {
        this.ejecutandoId.set(null);
        this.horarios.update(list => list.map(x => x.id_horario === updated.id_horario ? updated : x));
      },
      error: () => this.ejecutandoId.set(null),
    });
  }
}
