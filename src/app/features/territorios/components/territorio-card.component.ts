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
      border: 2px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .card-header {
      background: linear-gradient(135deg, #5b3c88, #6d28d9);
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
      height: 200px;
      background: #f1f5f9;
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
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      font-size: 10px;
      color: #94a3b8;
      font-weight: 600;
      text-align: center;
    }
  `],
})
export class TerritorioCardComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('miniMap', { static: false }) miniMapEl!: ElementRef;

  @Input() territorio: Territorio | null = null;
  @Input() geojson: GeoJSONFeatureCollection | null = null;
  @Input() stats: { manzanas_count: number; viviendas_count: number; cobertura_promedio: number } | null = null;

  today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  private map: L.Map | null = null;

  ngAfterViewInit(): void {
    setTimeout(() => this.initMiniMap(), 200);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['geojson'] || changes['territorio']) && this.map) {
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
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

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
    if (!this.map || !this.geojson) return;

    const layer = L.geoJSON(this.geojson as any, {
      style: {
        color: '#6d28d9',
        weight: 2,
        fillColor: '#ede9fe',
        fillOpacity: 0.4,
      },
    }).addTo(this.map);

    const bounds = layer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [20, 20] });
    }
  }

  getStateColor(): string {
    switch (this.territorio?.estado_territorio) {
      case 'Disponible': return '#059669';
      case 'Asignado': return '#7c3aed';
      case 'En Pausa': return '#64748b';
      default: return '#1e293b';
    }
  }
}
