import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TerritorioMapComponent } from '../components/territorio-map.component';
import { TerritoriosService } from '../services/territorios.service';
import { GeoJSONFeatureCollection } from '../models/territorio.model';

@Component({
  standalone: true,
  selector: 'app-mapa-general-page',
  imports: [CommonModule, TerritorioMapComponent],
  template: `
    <div class="h-full flex flex-col w-full max-w-[1920px] mx-auto p-4 sm:p-8 gap-6">
      <!-- Header -->
      <header class="flex items-center justify-between shrink-0">
        <div>
          <h1 class="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-display">Mapa General</h1>
          <p class="text-slate-500 dark:text-slate-400 mt-1">Vista completa de todos los territorios de la congregación.</p>
        </div>
        <button
          (click)="goBack()"
          class="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-sm hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all flex items-center gap-2"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
          Volver a Territorios
        </button>
      </header>

      <!-- Legend -->
      <div class="flex items-center gap-6 shrink-0 px-2">
        <div class="flex items-center gap-2">
          <span class="w-4 h-4 rounded-sm bg-emerald-200 border-2 border-emerald-600"></span>
          <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Disponible</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-4 h-4 rounded-sm bg-purple-200 border-2 border-purple-600"></span>
          <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Asignado</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="w-4 h-4 rounded-sm bg-slate-200 border-2 border-slate-500"></span>
          <span class="text-xs font-bold text-slate-600 dark:text-slate-300">En Pausa</span>
        </div>
      </div>

      <!-- Map -->
      <div class="flex-1 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm overflow-hidden">
        @if (loading()) {
          <div class="w-full h-full flex items-center justify-center">
            <div class="flex flex-col items-center gap-3">
              <div class="w-8 h-8 border-3 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
              <span class="text-sm text-slate-500 font-medium">Cargando mapa...</span>
            </div>
          </div>
        } @else {
          <app-territorio-map
            [geojson]="geojsonData()"
            height="100%"
            [interactive]="true"
            [showPopups]="true"
            (featureClick)="onFeatureClick($event)"
          />
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
  `],
})
export class MapaGeneralPage implements OnInit {
  private territoriosService = inject(TerritoriosService);
  private router = inject(Router);

  geojsonData = signal<GeoJSONFeatureCollection | null>(null);
  loading = signal(true);

  ngOnInit(): void {
    this.loadGeoJSON();
  }

  loadGeoJSON(): void {
    this.loading.set(true);
    this.territoriosService.getTerritoriosGeoJSON().subscribe({
      next: (data) => {
        this.geojsonData.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onFeatureClick(feature: any): void {
    if (feature?.id) {
      this.router.navigate(['/territorios'], { queryParams: { selected: feature.id } });
    }
  }

  goBack(): void {
    this.router.navigate(['/territorios']);
  }
}
