export interface Territorio {
  id_territorio: number;
  id_congregacion?: number;
  codigo: string;
  nombre: string;
  estado_territorio: string;
  notas?: string;
  coordenada?: GeoJSONGeometry | null;
}

export interface Manzana {
  id_manzana: number;
  id_territorio: number;
  numero_manzana: string;
  coordenada?: GeoJSONGeometry | null;
}

export interface Vivienda {
  id_vivienda: number;
  id_manzana: number;
  direccion?: string;
  numero?: string;
  edificio?: string;
  apartamento?: string;
  coordenadas?: GeoJSONGeometry | null;
  etiqueta?: string;
  no_visitar?: boolean;
  idioma?: string;
  notas?: string;
}

export interface CoberturaManzana {
  id_cobertura_manzana: number;
  id_manzana: number;
  id_periodo?: number;
  estado?: string;
  porcentaje?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  id_publicador_cobertura?: number;
  notas?: string;
}

export interface TerritorioStats {
  manzanas_count: number;
  viviendas_count: number;
  cobertura_promedio: number;
}

export interface GeoJSONGeometry {
  type: string;
  coordinates: any;
}

export interface GeoJSONFeature {
  type: 'Feature';
  id: number | string;
  properties: Record<string, any>;
  geometry: GeoJSONGeometry;
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}
