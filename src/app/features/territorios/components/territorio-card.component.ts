import {
  Component,
  Input,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import { Territorio, GeoJSONFeatureCollection } from '../models/territorio.model';
import { geoCentroid } from '../utils/geo-math.util';

@Component({
  standalone: true,
  selector: 'app-territorio-card',
  imports: [CommonModule],
  template: `
    <div
      [id]="'territorio-card-' + territorio?.id_territorio"
      class="territorio-card"
    >
      <!-- Card Header -->
      <div class="card-header">
        <div class="card-badge">TARJETA DE TERRITORIO</div>
        <div class="card-code">{{ territorio?.codigo }}</div>
        <div class="card-name">{{ territorio?.nombre }}</div>
      </div>

      <!-- Mini Map -->
      <div class="card-map-wrapper">
        <div #miniMap class="card-map"></div>
      </div>

      <!-- Card Info -->
      <div class="card-info">
        <div class="card-info-row">
          <span class="card-label">Estado</span>
          <span class="card-value" [style.color]="getStateColor()">{{ territorio?.estado_territorio }}</span>
        </div>
        <div class="card-info-row" *ngIf="stats">
          <span class="card-label">Manzanas</span>
          <span class="card-value">{{ stats.manzanas_count }}</span>
        </div>
        <div class="card-info-row" *ngIf="stats">
          <span class="card-label">Viviendas</span>
          <span class="card-value">{{ stats.viviendas_count }}</span>
        </div>
        <div class="card-info-row" *ngIf="stats">
          <span class="card-label">Cobertura</span>
          <span class="card-value">{{ stats.cobertura_promedio }}%</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="card-footer">
        <span>Generado: {{ today }}</span>
      </div>
    </div>
  `,
  styles: [`
    .territorio-card {
      width: 400px;
      background: #fff;
      border: 2px solid #d1fae5;
      border-radius: 16px;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .card-header {
      background: linear-gradient(135deg, #065f46, #059669);
      padding: 20px 24px;
      color: #fff;
    }
    .card-badge {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      opacity: 0.7;
      margin-bottom: 8px;
    }
    .card-code {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .card-name {
      font-size: 14px;
      font-weight: 600;
      opacity: 0.85;
      margin-top: 2px;
    }
    .card-map-wrapper {
      height: 220px;
      background: #f0fdf4;
    }
    .card-map {
      width: 100%;
      height: 100%;
    }
    .card-info {
      padding: 16px 24px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .card-info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .card-label {
      font-size: 12px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .card-value {
      font-size: 14px;
      font-weight: 800;
      color: #1e293b;
    }
    .card-footer {
      padding: 12px 24px;
      background: #f0fdf4;
      border-top: 1px solid #d1fae5;
      font-size: 10px;
      color: #6b7280;
      font-weight: 600;
      text-align: center;
    }
  `],
})
export class TerritorioCardComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('miniMap', { static: false }) miniMapEl!: ElementRef;

  @Input() territorio: Territorio | null = null;
  @Input() geojson: GeoJSONFeatureCollection | null = null;
  @Input() manzanasGeojson: GeoJSONFeatureCollection | null = null;
  @Input() stats: { manzanas_count: number; viviendas_count: number; cobertura_promedio: number } | null = null;

  today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  private map: L.Map | null = null;
  private manzanaLabels: L.Marker[] = [];

  ngAfterViewInit(): void {
    setTimeout(() => this.initMiniMap(), 200);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['geojson'] || changes['territorio'] || changes['manzanasGeojson']) && this.map) {
      this.renderGeo();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMiniMap(): void {
    if (!this.miniMapEl?.nativeElement) return;

    delete (L.Icon.Default.prototype as any)._getIconUrl;

    this.map = L.map(this.miniMapEl.nativeElement, {
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    this.renderGeo();
  }

  private renderGeo(): void {
    if (!this.map) return;

    // Remove previous manzana labels
    this.manzanaLabels.forEach(m => m.remove());
    this.manzanaLabels = [];

    // Render territory boundary (only territorio polygon, not manzanas)
    const territorioFeatures = this.geojson?.features.filter(
      f => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
    ) ?? [];

    if (territorioFeatures.length === 0) return;

    const territorioFC: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: territorioFeatures,
    };

    // Clear existing geo layers (except tile layer)
    this.map.eachLayer(layer => {
      if (!(layer instanceof L.TileLayer)) {
        layer.remove();
      }
    });

    // Draw territory boundary in emerald
    const boundaryLayer = L.geoJSON(territorioFC as any, {
      style: {
        color: '#059669',
        weight: 2.5,
        fillColor: '#d1fae5',
        fillOpacity: 0.25,
      },
    }).addTo(this.map);

    // Draw manzanas with green fill + numbers
    if (this.manzanasGeojson && this.manzanasGeojson.features.length > 0) {
      L.geoJSON(this.manzanasGeojson as any, {
        style: {
          color: '#065f46',
          weight: 1.5,
          fillColor: '#6ee7b7',
          fillOpacity: 0.35,
        },
      }).addTo(this.map);

      // Add number labels at centroid of each manzana
      for (const feature of this.manzanasGeojson.features) {
        const numero = feature.properties?.['numero_manzana'] ?? feature.properties?.['numero'];
        if (!numero) continue;
        const centroid = geoCentroid(feature);
        if (!centroid) continue;

        const label = L.marker([centroid[1], centroid[0]], {
          icon: L.divIcon({
            className: '',
            html: `<div style="
              background: #065f46;
              color: #fff;
              font-size: 10px;
              font-weight: 800;
              padding: 2px 5px;
              border-radius: 4px;
              white-space: nowrap;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
              font-family: system-ui, sans-serif;
            ">${numero}</div>`,
            iconAnchor: [12, 10],
          }),
          interactive: false,
        }).addTo(this.map!);

        this.manzanaLabels.push(label);
      }
    }

    // Fit bounds to territory
    const bounds = boundaryLayer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [16, 16] });
    }
  }

  getStateColor(): string {
    switch (this.territorio?.estado_territorio) {
      case 'Disponible': return '#059669';
      case 'Asignado': return '#0369a1';
      case 'En Pausa': return '#64748b';
      default: return '#1e293b';
    }
  }
}
