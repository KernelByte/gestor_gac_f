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
  id_sesion?: number | null;
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

export interface Punto {
  id_punto: number;
  id_territorio: number;
  nombre?: string;
  tipo?: string; // 'Salida' | 'Lugar' | 'Otro'
  coordenadas?: GeoJSONGeometry | null;
  notas?: string;
}

export interface Sesion {
  id_sesion: number;
  id_territorio: number;
  codigo: string;
  nombre: string;
  notas?: string;
  coordenada?: GeoJSONGeometry | null;
}

export interface AsignacionTerritorio {
  id_asignacion: number;
  id_territorio: number;
  id_sesion?: number | null;
  id_publicador: number;
  nombre_publicador?: string | null;
  fecha_asignacion: string;
  fecha_devolucion?: string | null;
  notas?: string | null;
  activa: boolean;
}

export interface TerritorioStats {
  manzanas_count: number;
  viviendas_count: number;
  cobertura_promedio: number;
}

export interface SalidaPredicacion {
  id_salida: number;
  id_territorio: number;
  id_sesion?: number | null;
  fecha_salida: string;
  id_capitan?: number | null;
  nombre_capitan?: string | null;
  id_punto_salida?: number | null;
  nombre_punto_salida?: string | null;
  notas?: string | null;
  manzanas_predicadas: number;
}

export interface ProgresoTerritorio {
  total_manzanas: number;
  manzanas_predicadas: number;
  manzanas_pendientes: number;
  porcentaje: number;
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
