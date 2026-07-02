import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthStore } from '../../core/auth/auth.store';
import { CongregacionContextService } from '../../core/congregacion-context/congregacion-context.service';
import { RouterModule } from '@angular/router';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import {
  trigger,
  transition,
  style,
  animate,
  query,
  stagger
} from '@angular/animations';

@Component({
  standalone: true,
  imports: [CommonModule, RouterModule, NgxEchartsDirective],
  animations: [
    trigger('staggerIn', [
      transition(':enter', [
        query(':scope > *', [
          style({ opacity: 0, transform: 'translateY(12px)' }),
          stagger(80, [
            animate('300ms cubic-bezier(0.23,1,0.32,1)', style({ opacity: 1, transform: 'translateY(0)' }))
          ])
        ], { optional: true })
      ])
    ])
  ],
  template: `
  <div class="flex flex-col gap-4 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-6 md:px-8 md:py-7 custom-scrollbar pb-10">

    <!-- 1. Hero Banner -->
    <div class="relative bg-gradient-to-br from-violet-600 via-violet-700 to-violet-800 rounded-2xl px-6 py-10 sm:px-8 md:px-10 md:py-12">
      <div class="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
        <div class="absolute -top-10 -right-10 w-56 h-56 bg-violet-400/25 rounded-full blur-3xl"></div>
        <div class="absolute bottom-0 left-1/3 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl"></div>
      </div>
      <div class="relative flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h1 class="font-display font-bold text-3xl sm:text-4xl text-white leading-tight">Hola, {{ userName() }}! 👋</h1>
          <p class="text-xs sm:text-sm text-white/70 mt-2 leading-snug font-medium">Aquí tienes el resumen de actividad del {{ currentDate() }}.</p>
        </div>
        <button class="hidden sm:flex p-3 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 transform rotate-3 shadow-xl items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] shrink-0 mt-0.5">
          <svg class="w-8 h-8 text-purple-50" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </button>
      </div>
    </div>

    <!-- 2. Stats Row — 2-col mobile · 4-col md+ -->
    <div @staggerIn class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">

      <!-- Publicadores -->
      <div *ngIf="canViewPublicadores()" class="relative bg-white dark:bg-slate-800/95 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4 sm:p-5 md:p-6 shadow-sm shadow-black/[0.04] dark:shadow-black/30 hover:shadow-md hover:shadow-black/[0.08] dark:hover:shadow-black/40 hover:-translate-y-px transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">
        <div class="mb-3">
          <p class="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.07em] sm:tracking-[0.14em] text-gray-400 dark:text-slate-500">Publicadores</p>
        </div>
        <p class="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight">{{ totalPublicadores() }}</p>
      </div>

      <!-- Informes % -->
      <div *ngIf="canViewInformes()" class="relative bg-white dark:bg-slate-800/95 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4 sm:p-5 md:p-6 shadow-sm shadow-black/[0.04] dark:shadow-black/30 hover:shadow-md hover:shadow-black/[0.08] dark:hover:shadow-black/40 hover:-translate-y-px transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">

        <div class="flex items-center gap-1.5 flex-wrap mb-3">
          <p class="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.07em] sm:tracking-[0.14em] text-gray-400 dark:text-slate-500">Informes</p>
          @if (informesPendientes() > 0) {
            <span class="px-1.5 py-0.5 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-[9px] font-bold text-red-600 dark:text-red-400">{{ informesPendientes() }}p</span>
          }
        </div>
        <p class="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight">{{ porcentajeInformes() }}<span class="text-sm font-semibold text-gray-400 dark:text-slate-500 ml-0.5">%</span></p>
        <div class="h-1.5 w-full bg-gray-100 dark:bg-slate-700/70 rounded-full mt-3 overflow-hidden">
          <div class="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]" [style.width.%]="porcentajeInformes() || 2"></div>
        </div>
      </div>

      <!-- Cursos Bíblicos -->
      <div *ngIf="canViewInformes()" class="relative bg-white dark:bg-slate-800/95 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4 sm:p-5 md:p-6 shadow-sm shadow-black/[0.04] dark:shadow-black/30 hover:shadow-md hover:shadow-black/[0.08] dark:hover:shadow-black/40 hover:-translate-y-px transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">

        <div class="mb-3">
          <p class="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.07em] sm:tracking-[0.14em] text-gray-400 dark:text-slate-500">Cursos Bíblicos</p>
        </div>
        <p class="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight">{{ totalCursos() }}</p>
      </div>

      <!-- Horas Precursores (solo si hay datos) -->
      @if (canViewInformes()) {
        <div class="relative bg-white dark:bg-slate-800/95 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4 sm:p-5 md:p-6 shadow-sm shadow-black/[0.04] dark:shadow-black/30 hover:shadow-md hover:shadow-black/[0.08] dark:hover:shadow-black/40 hover:-translate-y-px transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]">

          <div class="mb-3">
            <p class="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.07em] sm:tracking-[0.14em] text-gray-400 dark:text-slate-500">Hrs. Precursores</p>
          </div>
          <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            @if (horasPrecursoresRegulares() === 0 && horasPrecursoresAuxiliares() === 0) {
              <span class="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white tabular-nums tracking-tight">0</span>
            }
            @if (horasPrecursoresRegulares() > 0) {
              <span class="text-xl sm:text-3xl font-bold text-violet-600 dark:text-violet-400 tabular-nums tracking-tight">{{ horasPrecursoresRegulares() }}</span>
              <span class="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-bold tracking-wider">Reg.</span>
            }
            @if (horasPrecursoresRegulares() > 0 && horasPrecursoresAuxiliares() > 0) {
              <span class="text-gray-200 dark:text-slate-600 hidden sm:inline">·</span>
            }
            @if (horasPrecursoresAuxiliares() > 0) {
              <span class="text-lg sm:text-2xl font-bold text-violet-500 dark:text-violet-400 tabular-nums tracking-tight">{{ horasPrecursoresAuxiliares() }}</span>
              <span class="text-[10px] text-gray-400 dark:text-slate-500 uppercase font-bold tracking-wider">Aux.</span>
            }
          </div>
        </div>
      }

    </div>

    <!-- 3. Gráficos — stack mobile · side-by-side md+ -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

      <!-- Asistencia — Trend Chart -->
      @if (asistenciaChartOption() !== null) {
        <div class="hidden sm:block bg-white dark:bg-slate-800/95 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-5 shadow-sm shadow-black/[0.04] dark:shadow-black/30">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
            <div>
              <p class="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.07em] sm:tracking-[0.14em] text-gray-400 dark:text-slate-500">Asistencia a Reuniones</p>
              <p class="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 font-medium">Tendencia · {{ asistenciaMesNombre() }}</p>
            </div>
            <div class="flex items-center gap-4 self-start">
              @if (asistenciaMidweekActual() !== null) {
                <div class="text-right">
                  <div class="flex items-baseline gap-1 justify-end">
                    <span class="text-sm font-bold text-gray-900 dark:text-white tabular-nums">{{ asistenciaMidweekActual() | number:'1.0-0' }}</span>
                    @if (asistenciaMidweekAnterior() !== null) {
                      <span class="text-[10px] font-bold"
                        [class.text-emerald-600]="delta(asistenciaMidweekActual()!, asistenciaMidweekAnterior()!) >= 0"
                        [class.text-red-500]="delta(asistenciaMidweekActual()!, asistenciaMidweekAnterior()!) < 0">
                        {{ delta(asistenciaMidweekActual()!, asistenciaMidweekAnterior()!) >= 0 ? '↑' : '↓' }}{{ delta(asistenciaMidweekActual()!, asistenciaMidweekAnterior()!) | number:'1.0-0' }}
                      </span>
                    }
                  </div>
                  <p class="text-[9px] text-gray-400 dark:text-slate-500 uppercase font-bold tracking-wider">Entre sem</p>
                </div>
              }
              @if (asistenciaWeekendActual() !== null) {
                <div class="text-right">
                  <div class="flex items-baseline gap-1 justify-end">
                    <span class="text-sm font-bold text-orange-600 dark:text-orange-400 tabular-nums">{{ asistenciaWeekendActual() | number:'1.0-0' }}</span>
                    @if (asistenciaWeekendAnterior() !== null) {
                      <span class="text-[10px] font-bold"
                        [class.text-emerald-600]="delta(asistenciaWeekendActual()!, asistenciaWeekendAnterior()!) >= 0"
                        [class.text-red-500]="delta(asistenciaWeekendActual()!, asistenciaWeekendAnterior()!) < 0">
                        {{ delta(asistenciaWeekendActual()!, asistenciaWeekendAnterior()!) >= 0 ? '↑' : '↓' }}{{ delta(asistenciaWeekendActual()!, asistenciaWeekendAnterior()!) | number:'1.0-0' }}
                      </span>
                    }
                  </div>
                  <p class="text-[9px] text-gray-400 dark:text-slate-500 uppercase font-bold tracking-wider">Fin sem</p>
                </div>
              }
            </div>
          </div>
          <div class="flex items-center gap-4 mb-3">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-violet-600 inline-block"></span>
              <span class="text-[10px] font-bold tracking-wider text-gray-400 dark:text-slate-500 uppercase">Entre sem.</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block"></span>
              <span class="text-[10px] font-bold tracking-wider text-gray-400 dark:text-slate-500 uppercase">Fin sem.</span>
            </div>
          </div>
          <div echarts [options]="asistenciaChartOption()!" [autoResize]="true" class="w-full h-36 md:h-48"></div>
        </div>
      }

      <!-- Informes — Bar Chart -->
      @if (informesChartOption() !== null) {
        <div class="bg-white dark:bg-slate-800/95 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-5 shadow-sm shadow-black/[0.04] dark:shadow-black/30">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
            <div>
              <p class="text-[9px] sm:text-[11px] font-bold uppercase tracking-[0.07em] sm:tracking-[0.14em] text-gray-400 dark:text-slate-500">% Informes recibidos</p>
              <p class="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5 font-medium">Año de servicio actual</p>
            </div>
          </div>
          <div echarts [options]="informesChartOption()!" [autoResize]="true" class="w-full h-36 mt-5"></div>
        </div>
      }

    </div>

    <!-- 4. Accesos Rápidos — mobile: 1 col · sm: 2 col · md: 3 col -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">

      <button *ngIf="canManagePublicadores()" routerLink="/secretario/publicadores"
        class="flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-orange-50 dark:bg-orange-500/[0.07] hover:bg-orange-500 dark:hover:bg-orange-500 border border-orange-100 dark:border-orange-500/20 hover:border-orange-500 shadow-sm hover:shadow-lg hover:shadow-orange-500/20 dark:hover:shadow-orange-500/15 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group text-left active:scale-[0.98]">
        <div class="w-11 h-11 rounded-xl bg-orange-100 dark:bg-orange-500/15 border border-orange-200/70 dark:border-orange-500/20 group-hover:bg-white/20 group-hover:border-white/20 flex items-center justify-center shrink-0 transition-all duration-300">
          <svg class="w-5 h-5 text-orange-600 dark:text-orange-400 group-hover:text-white transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" /></svg>
        </div>
        <div>
          <span class="block text-sm font-semibold text-gray-800 dark:text-slate-100 group-hover:text-white transition-colors duration-300">Gestionar Publicadores</span>
          <span class="text-xs text-gray-500 dark:text-slate-400 group-hover:text-orange-100 transition-colors duration-300">Añadir o editar</span>
        </div>
      </button>

      <button *ngIf="canViewReuniones()" routerLink="/reuniones/resumen"
        class="flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-purple-50 dark:bg-purple-500/[0.07] hover:bg-purple-600 dark:hover:bg-purple-600 border border-purple-100 dark:border-purple-500/20 hover:border-purple-600 shadow-sm hover:shadow-lg hover:shadow-purple-500/20 dark:hover:shadow-purple-500/15 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group text-left active:scale-[0.98]">
        <div class="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-500/15 border border-purple-200/70 dark:border-purple-500/20 group-hover:bg-white/20 group-hover:border-white/20 flex items-center justify-center shrink-0 transition-all duration-300">
          <svg class="w-5 h-5 text-purple-600 dark:text-purple-400 group-hover:text-white transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        </div>
        <div>
          <span class="block text-sm font-semibold text-gray-800 dark:text-slate-100 group-hover:text-white transition-colors duration-300">Reuniones</span>
          <span class="text-xs text-gray-500 dark:text-slate-400 group-hover:text-purple-100 transition-colors duration-300">Ver resumen de asistencia</span>
        </div>
      </button>

      <button *ngIf="canManageInformes()" routerLink="/secretario/informes"
        class="flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-blue-50 dark:bg-blue-500/[0.07] hover:bg-blue-600 dark:hover:bg-blue-600 border border-blue-100 dark:border-blue-500/20 hover:border-blue-600 shadow-sm hover:shadow-lg hover:shadow-blue-500/20 dark:hover:shadow-blue-500/15 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group text-left active:scale-[0.98]">
        <div class="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-500/15 border border-blue-200/70 dark:border-blue-500/20 group-hover:bg-white/20 group-hover:border-white/20 flex items-center justify-center shrink-0 transition-all duration-300">
          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        </div>
        <div>
          <span class="block text-sm font-semibold text-gray-800 dark:text-slate-100 group-hover:text-white transition-colors duration-300">Resumen de Informes</span>
          <span class="text-xs text-gray-500 dark:text-slate-400 group-hover:text-blue-100 transition-colors duration-300">Ver mes actual</span>
        </div>
      </button>

    </div>

    <!-- 5. Estado del Sistema -->
    <div class="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-800/60 rounded-xl border border-gray-100 dark:border-slate-700/40 shadow-sm shadow-black/[0.03] dark:shadow-black/20">
      <div class="relative shrink-0">
        <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
        <div class="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50"></div>
      </div>
      <span class="text-xs font-medium text-gray-500 dark:text-slate-400">Todos los servicios operando con normalidad.</span>
    </div>

  </div>
 `,
  styles: [`
  :host {
   display: block;
  }
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #475569;
  }
  :host-context(.dark) .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
 `]
})
export class HomePage implements OnInit {
  private store = inject(AuthStore);
  private http = inject(HttpClient);
  private congregacionContext = inject(CongregacionContextService);

  userName = signal('Usuario');
  currentDate = signal('');
  currentDateShort = signal('');
  totalPublicadores = signal(0);
  informesPendientes = signal(0);
  informesRecibidos = signal(0);
  porcentajeInformes = signal(0);
  totalCursos = signal(0);
  totalHorasPrecursores = signal(0);
  horasPrecursoresRegulares = signal(0);
  horasPrecursoresAuxiliares = signal(0);

  asistenciaMidweekActual   = signal<number | null>(null);
  asistenciaWeekendActual   = signal<number | null>(null);
  asistenciaMidweekAnterior = signal<number | null>(null);
  asistenciaWeekendAnterior = signal<number | null>(null);
  asistenciaMesNombre       = signal<string>('');
  asistenciaChartOption     = signal<EChartsOption | null>(null);

  informesChartOption = signal<EChartsOption | null>(null);

  canViewPublicadores = signal(false);
  canManagePublicadores = signal(false);
  canViewInformes = signal(false);
  canManageInformes = signal(false);
  canViewReuniones = signal(false);

  ngOnInit() {
   const user = this.store.user();
   if (user) {
     this.userName.set(user.nombre || user.username);

     const rolesPublicadores = ['Administrador', 'Gestor Aplicación', 'Coordinador', 'Secretario', 'Superintendente de servicio', 'Gestor', 'Publicador'];
     const rolesManagePublicadores = ['Administrador', 'Gestor Aplicación', 'Secretario', 'Coordinador'];
     const rolesInformes = ['Administrador', 'Gestor Aplicación', 'Secretario', 'Coordinador', 'Publicador', 'Superintendente de servicio'];
     const rolesManageInformes = ['Administrador', 'Gestor Aplicación', 'Secretario', 'Coordinador'];

     const currentRole = user.rol || '';

     this.canViewPublicadores.set(rolesPublicadores.includes(currentRole));
     this.canManagePublicadores.set(rolesManagePublicadores.includes(currentRole));
     this.canViewInformes.set(rolesInformes.includes(currentRole));
     this.canManageInformes.set(rolesManageInformes.includes(currentRole));
     this.canViewReuniones.set(this.store.hasPermission('reuniones.ver'));

     const congregacionId = this.congregacionContext.effectiveCongregacionId();

     if (this.canViewPublicadores()) {
        this.loadPublicadoresCount();
     }
     if (this.canViewInformes()) {
        this.loadInformesStats(congregacionId);
        this.loadAsistenciaStats(congregacionId);
        this.loadInformesChart(congregacionId);
     }
   }

   const now = new Date();
   const options: Intl.DateTimeFormatOptions = {
     weekday: 'long',
     year: 'numeric',
     month: 'long',
     day: 'numeric'
   };
   this.currentDate.set(now.toLocaleDateString('es-ES', options));
   this.currentDateShort.set(now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
  }

  private loadPublicadoresCount() {
   this.http.get<any[]>('/api/publicadores/?limit=1000').subscribe({
     next: (publicadores) => {
      this.totalPublicadores.set(publicadores.length);
     },
     error: (err) => {
      console.error('Error cargando publicadores:', err);
     }
   });
  }

  private loadInformesStats(congregacionId: number | null | undefined) {
    if (!congregacionId) return;

    const now = new Date();
    const mesActual = now.getMonth() + 1;
    const anoActual = now.getFullYear();

    this.http.get<any[]>('/api/periodos/').subscribe({
      next: (periodos) => {
        const pasados = periodos
          .filter(p => {
            const ano = parseInt(p.codigo_ano, 10);
            const mes = parseInt(p.codigo_mes, 10);
            return ano < anoActual || (ano === anoActual && mes <= mesActual);
          })
          .sort((a, b) => {
            const da = parseInt(a.codigo_ano, 10) * 100 + parseInt(a.codigo_mes, 10);
            const db = parseInt(b.codigo_ano, 10) * 100 + parseInt(b.codigo_mes, 10);
            return db - da;
          });

        if (pasados.length === 0) return;
        // Check up to 3 recent periods to find one with submitted informes
        this.tryLoadInformesStatsFromPeriods(pasados.slice(0, 3), 0, congregacionId);
      },
      error: err => console.error('Error cargando periodos para stats', err)
    });
  }

  private tryLoadInformesStatsFromPeriods(periods: any[], index: number, congregacionId: number) {
    if (index >= periods.length) return;
    const p = periods[index];

    this.http.get<any>(`/api/informes/resumen-mensual?periodo_id=${p.id_periodo}&congregacion_id=${congregacionId}`).subscribe({
      next: (stats) => {
        if (stats.informes_recibidos === 0 && index < periods.length - 1) {
          this.tryLoadInformesStatsFromPeriods(periods, index + 1, congregacionId);
          return;
        }
        this.informesRecibidos.set(stats.informes_recibidos);
        const pending = stats.total_publicadores - stats.informes_recibidos;
        this.informesPendientes.set(pending > 0 ? pending : 0);
        const pct = stats.total_publicadores > 0 ? Math.round((stats.informes_recibidos / stats.total_publicadores) * 100) : 0;
        this.porcentajeInformes.set(pct);
        this.totalCursos.set(stats.total_cursos);
        this.totalHorasPrecursores.set(stats.total_horas_precursores);
        this.horasPrecursoresRegulares.set(stats.horas_precursores_regulares ?? 0);
        this.horasPrecursoresAuxiliares.set(stats.horas_precursores_auxiliares ?? 0);
        if (stats.total_publicadores > 0) {
          this.totalPublicadores.set(stats.total_publicadores);
        }
      },
      error: err => console.error('Error loading resumen', err)
    });
  }

  private loadAsistenciaStats(congregacionId: number | null | undefined) {
    if (!congregacionId) return;
    const now = new Date();
    const anoServicio = now.getMonth() + 1 >= 9 ? now.getFullYear() + 1 : now.getFullYear();

    this.http.get<any>(`/api/asistencias/resumen-anual?congregacion_id=${congregacionId}&ano_servicio=${anoServicio}`).subscribe({
      next: (res) => {
        const conDatos = (res.meses as any[]).filter(
          m => m.midweek_promedio !== null || m.weekend_promedio !== null
        );
        if (conDatos.length === 0) return;

        const actual   = conDatos[conDatos.length - 1];
        const anterior = conDatos.length > 1 ? conDatos[conDatos.length - 2] : null;

        this.asistenciaMidweekActual.set(actual.midweek_promedio);
        this.asistenciaWeekendActual.set(actual.weekend_promedio);
        this.asistenciaMidweekAnterior.set(anterior?.midweek_promedio ?? null);
        this.asistenciaWeekendAnterior.set(anterior?.weekend_promedio ?? null);
        this.asistenciaMesNombre.set(actual.nombre_mes);

        const last6 = conDatos.slice(-6);
        this.asistenciaChartOption.set(this.buildAsistenciaChart(last6));
      },
      error: err => console.error('Error asistencia stats', err)
    });
  }

  private buildAsistenciaChart(meses: any[]): EChartsOption {
    const labels = meses.map(m => (m.nombre_mes as string).substring(0, 3).toUpperCase());
    return {
      color: ['#6d28d9', '#f97316'],
      grid: { top: 12, right: 4, bottom: 22, left: 28 },
      xAxis: {
        type: 'category',
        data: labels,
        boundaryGap: false,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 9,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
        },
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.06)', width: 1 } },
        splitNumber: 3,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: '#e2e8f0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
        formatter: (params: any) => {
          const label = params[0]?.axisValueLabel ?? '';
          const rows = params.map((p: any) =>
            `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${p.color};margin-right:6px;vertical-align:middle"></span>${p.seriesName}: <strong>${p.value ?? '—'}</strong>`
          ).join('<br/>');
          return `<div style="font-size:10px;letter-spacing:.05em;opacity:.6;margin-bottom:4px">${label}</div>${rows}`;
        },
        axisPointer: {
          type: 'line',
          lineStyle: { color: 'rgba(148,163,184,0.15)', width: 1, type: 'solid' },
        },
      },
      series: [
        {
          name: 'Entre Semana',
          type: 'line',
          smooth: 0.4,
          data: meses.map(m => m.midweek_promedio),
          symbol: 'none',
          lineStyle: { width: 1.5, color: '#7c3aed' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(109,40,217,0.12)' },
                { offset: 1, color: 'rgba(109,40,217,0)' }
              ]
            }
          },
          connectNulls: false,
          emphasis: { disabled: true },
        },
        {
          name: 'Fin de Semana',
          type: 'line',
          smooth: 0.4,
          data: meses.map(m => m.weekend_promedio),
          symbol: 'none',
          lineStyle: { width: 1.5, color: '#f97316' },
          areaStyle: {
            color: {
              type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(249,115,22,0.10)' },
                { offset: 1, color: 'rgba(249,115,22,0)' }
              ]
            }
          },
          connectNulls: false,
          emphasis: { disabled: true },
        }
      ]
    };
  }

  private loadInformesChart(congregacionId: number | null | undefined) {
    if (!congregacionId) return;
    const now = new Date();
    const mesActual = now.getMonth() + 1;
    const anoActual = now.getFullYear();
    const anoServicio = mesActual >= 9 ? anoActual + 1 : anoActual;

    // Fetch all periods then filter to current service year (Sep–Aug), excluding future months
    this.http.get<any[]>('/api/periodos/').subscribe({
      next: (periodos) => {
        // Service year Sep(anoServicio-1) → Aug(anoServicio), up to current month only
        const startYear = anoServicio - 1;
        const inYear = periodos.filter(p => {
          const mes = parseInt(p.codigo_mes, 10);
          const ano = parseInt(p.codigo_ano, 10);
          const inServiceYear = (ano === startYear && mes >= 9) || (ano === anoServicio && mes <= 8);
          // Exclude months that haven't arrived yet
          const notFuture = ano < anoActual || (ano === anoActual && mes <= mesActual);
          return inServiceYear && notFuture;
        }).sort((a, b) => {
          const dateA = parseInt(a.codigo_ano) * 100 + parseInt(a.codigo_mes);
          const dateB = parseInt(b.codigo_ano) * 100 + parseInt(b.codigo_mes);
          return dateA - dateB;
        });

        // Fetch resumen for each period in parallel — cap to last 6 with data
        const requests = inYear.map(p =>
          this.http.get<any>(`/api/informes/resumen-mensual?periodo_id=${p.id_periodo}&congregacion_id=${congregacionId}`)
        );

        const MESES_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

        Promise.all(
          requests.map((req, i) =>
            new Promise<{label: string; pct: number; recibidos: number; total: number} | null>(resolve => {
              req.subscribe({
                next: (stats) => {
                  if (!stats.total_publicadores) { resolve(null); return; }
                  const pct = Math.round((stats.informes_recibidos / stats.total_publicadores) * 100);
                  const p = inYear[i];
                  const mesIdx = parseInt(p.codigo_mes, 10) - 1;
                  resolve({ label: MESES_ES[mesIdx], pct, recibidos: stats.informes_recibidos, total: stats.total_publicadores });
                },
                error: () => resolve(null)
              });
            })
          )
        ).then(results => {
          const conDatos = results.filter(Boolean) as {label: string; pct: number; recibidos: number; total: number}[];
          if (conDatos.length === 0) return;
          const last6 = conDatos.slice(-6);
          this.informesChartOption.set(this.buildInformesChart(last6));
        });
      },
      error: err => console.error('Error cargando periodos para chart', err)
    });
  }

  private buildInformesChart(meses: {label: string; pct: number; recibidos: number; total: number}[]): EChartsOption {
    return {
      grid: { top: 22, right: 4, bottom: 22, left: 28 },
      xAxis: {
        type: 'category',
        data: meses.map(m => m.label.toUpperCase()),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 9,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 600,
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        splitLine: { lineStyle: { color: 'rgba(148,163,184,0.06)', width: 1 } },
        splitNumber: 4,
      },
      tooltip: {
        trigger: 'axis',
        triggerOn: 'mousemove',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: '#e2e8f0', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
        formatter: (params: any) => {
          const d = params[0];
          const m = meses[d.dataIndex];
          const color = m.pct >= 80 ? '#10b981' : m.pct >= 60 ? '#f97316' : '#ef4444';
          return `<div style="font-size:10px;letter-spacing:.05em;opacity:.6;margin-bottom:4px">${m.label}</div><span style="color:${color};font-size:15px;font-weight:700">${m.pct}%</span><br/><span style="opacity:.6;font-size:10px">${m.recibidos} / ${m.total} informes</span>`;
        },
        axisPointer: { type: 'none' },
      },
      series: [
        {
          name: 'Informes recibidos',
          type: 'bar',
          data: meses.map(m => {
            const color = m.pct >= 80 ? '#10b981' : m.pct >= 60 ? '#f97316' : '#ef4444';
            return {
              value: m.pct,
              itemStyle: { color, borderRadius: [3, 3, 0, 0] },
              label: { show: true, color },
            };
          }),
          barMaxWidth: 28,
          barCategoryGap: '45%',
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => `${meses[params.dataIndex].pct}%`,
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
          },
        }
      ]
    };
  }

  delta(actual: number, anterior: number): number {
    return Math.round(actual - anterior);
  }
}
