import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import { GeoJSONFeatureCollection, GeoJSONFeature } from '../models/territorio.model';
import { TerritoriosService } from '../services/territorios.service';

@Component({
  standalone: true,
  selector: 'app-territorio-map',
  imports: [CommonModule],
  template: `
    <div
      #mapContainer
      class="territorio-map-container"
      [style.height]="height"
      [style.width]="'100%'"
    ></div>
  `,
  styles: [`
    :host { display: block; height: 100%; width: 100%; }
    .territorio-map-container {
      border-radius: 12px;
      overflow: hidden;
      z-index: 0;
    }
  `],
})
export class TerritorioMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  @Input() geojson: GeoJSONFeatureCollection | null = null;
  @Input() height = '300px';
  @Input() selectedId: number | null = null;
  @Input() interactive = true;
  @Input() showPopups = false;
  @Input() enableDrawing = false;

  @Output() featureClick = new EventEmitter<any>();
  @Output() geometryChanged = new EventEmitter<GeoJSONFeatureCollection>();

  private map: L.Map | null = null;
  private geoLayer: L.GeoJSON | null = null;
  private tileProvider = 'osm';
  private tileLayer: L.TileLayer | null = null;

  private territoriosService = inject(TerritoriosService);

  ngAfterViewInit(): void {
    this.initMap();
    this.loadTileProvider();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['geojson'] && this.map) {
      this.renderGeoJSON();
    }
    if (changes['selectedId'] && this.map && this.geoLayer) {
      this.highlightSelected();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMap(): void {
    // Fix Leaflet default icon paths
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [4.711, -74.072], // Default: Bogotá
      zoom: 13,
      zoomControl: this.interactive,
      dragging: this.interactive,
      scrollWheelZoom: this.interactive,
      doubleClickZoom: this.interactive,
      touchZoom: this.interactive,
      attributionControl: false,
    });

    this.setTileLayer('osm');

    if (this.geojson) {
      this.renderGeoJSON();
    }

    if (this.enableDrawing) {
      this.initDrawingControls();
    }
  }

  private initDrawingControls(): void {
    if (!this.map) return;

    try {
      if (!this.map.pm) {
        console.warn('Geoman plugin (pm) no disponible en L.Map.');
        return;
      }
      this.map.pm.setLang('es');
      this.map.pm.addControls({
        position: 'topleft',
        drawPolygon: true,
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: false,
        drawCircle: false,
        drawText: false,
        editMode: true,
        dragMode: true,
        cutPolygon: false,
        removalMode: true,
      });

      // Listen to drawing events
      this.map.on('pm:create', (e: any) => {
        e.layer.on('pm:edit', () => this.emitGeometryUpdate());
        this.emitGeometryUpdate();
      });
      this.map.on('pm:remove', () => this.emitGeometryUpdate());
      this.map.on('pm:globaleditmodetoggled', (e: any) => {
        if (!e.enabled) this.emitGeometryUpdate();
      });
      this.map.on('pm:globaldragmodetoggled', (e: any) => {
        if (!e.enabled) this.emitGeometryUpdate();
      });
    } catch (e) {
      console.error('Error inicializando controles de dibujo (Geoman):', e);
    }
  }

  private emitGeometryUpdate(): void {
    if (!this.map) return;
    
    // We get all feature layers (both drawn by Geoman and loaded via initial GeoJSON)
    const features: any[] = [];
    
    this.map.eachLayer((layer: any) => {
      // Check if layer is a Polygon (part of Leaflet / Geoman paths) and not the tile layer
      if (layer instanceof L.Polygon) {
         features.push(layer.toGeoJSON());
      }
    });

    const fc: GeoJSONFeatureCollection = {
      type: 'FeatureCollection',
      features: features as GeoJSONFeature[],
    };
    this.geometryChanged.emit(fc);
  }

  private loadTileProvider(): void {
    this.territoriosService.getTileProvider().subscribe({
      next: (res) => {
        this.tileProvider = res.tile_provider || 'osm';
        this.setTileLayer(this.tileProvider);
      },
      error: () => {
        this.setTileLayer('osm');
      },
    });
  }

  setTileLayer(provider: string): void {
    if (!this.map) return;

    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }

    const tileUrl =
      provider === 'google'
        ? 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    this.tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
    }).addTo(this.map);
  }

  private renderGeoJSON(): void {
    if (!this.map || !this.geojson) return;

    if (this.geoLayer) {
      this.map.removeLayer(this.geoLayer);
    }

    this.geoLayer = L.geoJSON(this.geojson as any, {
      style: (feature: any) => this.getFeatureStyle(feature),
      onEachFeature: (feature: any, layer: L.Layer) => {
        layer.on('click', () => {
          this.featureClick.emit(feature);
        });

        if (this.showPopups && feature.properties) {
          const props = feature.properties;
          const popup = `
            <div style="font-family: system-ui; min-width: 160px;">
              <strong style="font-size: 14px; color: #1e293b;">${props.codigo || ''}</strong>
              <p style="margin: 4px 0 0; color: #64748b; font-size: 12px;">${props.nombre || ''}</p>
              <span style="display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700;
                background: ${props.estado_territorio === 'Disponible' ? '#ecfdf5' : props.estado_territorio === 'Asignado' ? '#f5f3ff' : '#f1f5f9'};
                color: ${props.estado_territorio === 'Disponible' ? '#047857' : props.estado_territorio === 'Asignado' ? '#6d28d9' : '#64748b'};">
                ${props.estado_territorio || 'N/A'}
              </span>
            </div>
          `;
          layer.bindPopup(popup);
        }
      },
    }).addTo(this.map);

    // If drawing is enabled, we need to bind pm:edit to existing layers
    if (this.enableDrawing) {
      try {
         this.geoLayer.eachLayer((layer: any) => {
           if (layer.on) {
             layer.on('pm:edit', () => this.emitGeometryUpdate());
             layer.on('pm:dragend', () => this.emitGeometryUpdate());
           }
         });
      } catch (e) {
         console.warn('Error adjuntando eventos pm:edit a capas base:', e);
      }
    }

    // Fit map bounds to data
    const bounds = this.geoLayer.getBounds();
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [30, 30] });
    }

    this.highlightSelected();
  }

  private getFeatureStyle(feature: any): L.PathOptions {
    const estado = feature?.properties?.estado_territorio || '';
    const isSelected = feature?.id === this.selectedId;

    let color = '#94a3b8'; // gray = En Pausa
    let fillColor = '#f1f5f9';

    if (estado === 'Disponible') {
      color = '#059669';
      fillColor = '#d1fae5';
    } else if (estado === 'Asignado') {
      color = '#7c3aed';
      fillColor = '#ede9fe';
    }

    return {
      color: isSelected ? '#f59e0b' : color,
      weight: isSelected ? 3 : 2,
      fillColor: fillColor,
      fillOpacity: isSelected ? 0.5 : 0.3,
      opacity: 0.9,
    };
  }

  private highlightSelected(): void {
    if (!this.geoLayer) return;
    this.geoLayer.setStyle((feature: any) => this.getFeatureStyle(feature));
  }
}
