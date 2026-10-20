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
  motivo_no_visitar?: string | null;
  fecha_no_visitar?: string | null;
  fecha_revision?: string | null;
  /** "No visitar" sin confirmar desde hace más de un año. */
  por_revisar?: boolean;
  idioma?: string;
  notas?: string;
}

/** Vivienda tal como la devuelve GET /territorios/{id}/viviendas. */
export interface ViviendaDeTerritorio extends Vivienda {
  numero_manzana?: string | null;
}

/** Texto de una dirección para listas: "Calle 5 #12, Edif. Sol, Apto 3". */
export function textoDireccion(v: Vivienda): string {
  const partes = [
    [v.direccion, v.numero ? `#${v.numero}` : ''].filter(Boolean).join(' '),
    v.edificio ? `Edif. ${v.edificio}` : '',
    v.apartamento ? `Apto ${v.apartamento}` : '',
  ].filter(Boolean);
  return partes.join(', ') || 'Sin dirección';
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

export interface AsignacionTerritorio {
  id_asignacion: number;
  id_territorio: number;
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
  fecha_salida: string;
  id_capitan?: number | null;
  nombre_capitan?: string | null;
  id_punto_salida?: number | null;
  nombre_punto_salida?: string | null;
  notas?: string | null;
  manzanas_predicadas: number;
}

export interface CicloTerritorio {
  id_ciclo: number;
  fecha_inicio: string;
  fecha_fin: string | null;
  completado: boolean;
  cierre_manual: boolean;
}

export interface ProgresoTerritorio {
  total_manzanas: number;
  manzanas_predicadas: number;
  manzanas_pendientes: number;
  porcentaje: number;
  ciclo?: CicloTerritorio | null;
}

/** Una fila de GET /territorios/resumen (alertas y orden por "más tiempo sin trabajar"). */
export interface ResumenTerritorio {
  id_territorio: number;
  ultima_salida: string | null;
  dias_sin_trabajar: number | null;
  ciclo: CicloTerritorio | null;
  en_curso: boolean;
  porcentaje: number;
  ultimo_completado: string | null;
  asignado_a: string | null;
}

export interface RegistroS13Ciclo {
  fecha_inicio: string;
  fecha_fin: string | null;
  capitanes: string[];
}

export interface RegistroS13Territorio {
  id_territorio: number;
  codigo: string;
  nombre: string;
  completado_antes: string | null;
  ciclos: RegistroS13Ciclo[];
}

export interface RegistroS13 {
  anio_servicio: number;
  desde: string;
  hasta: string;
  territorios: RegistroS13Territorio[];
}

/** "hace 3 meses" / "hoy" / "Nunca trabajado", para listas y selectores. */
export function textoDiasSinTrabajar(dias: number | null | undefined): string {
  if (dias === null || dias === undefined) return 'Nunca trabajado';
  if (dias <= 0) return 'hoy';
  if (dias < 30) return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  if (meses >= 12) return 'hace más de un año';
  return meses === 1 ? 'hace 1 mes' : `hace ${meses} meses`;
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
