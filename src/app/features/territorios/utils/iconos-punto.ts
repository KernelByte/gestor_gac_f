import {
  Ban, Building2, Bus, Church, Coffee, DoorClosed, Dog, Flag, Fuel, Hospital, House, Landmark,
  School, SquareParking, Store, Trees, TriangleAlert, Users, Utensils,
} from 'lucide-angular';

type DatosIcono = typeof Dog;

export interface IconoPunto {
  /** Lo que se guarda en `puntos.icono`. No cambiar una clave ya usada: quedaría sin dibujo. */
  clave: string;
  etiqueta: string;
  datos: DatosIcono;
}

/** Iconos que se pueden poner en un punto. Ordenados por lo que más se marca al predicar. */
export const ICONOS_PUNTO: readonly IconoPunto[] = [
  { clave: 'encuentro', etiqueta: 'Lugar de encuentro', datos: Users },
  { clave: 'salon', etiqueta: 'Salón del Reino', datos: Landmark },
  { clave: 'casa', etiqueta: 'Casa', datos: House },
  { clave: 'edificio', etiqueta: 'Edificio o conjunto', datos: Building2 },
  { clave: 'porteria', etiqueta: 'Portería', datos: DoorClosed },
  { clave: 'no-visitar', etiqueta: 'No visitar', datos: Ban },
  { clave: 'perro', etiqueta: 'Perro bravo', datos: Dog },
  { clave: 'precaucion', etiqueta: 'Precaución', datos: TriangleAlert },
  { clave: 'iglesia', etiqueta: 'Iglesia', datos: Church },
  { clave: 'escuela', etiqueta: 'Escuela', datos: School },
  { clave: 'hospital', etiqueta: 'Hospital o puesto de salud', datos: Hospital },
  { clave: 'tienda', etiqueta: 'Tienda', datos: Store },
  { clave: 'restaurante', etiqueta: 'Restaurante', datos: Utensils },
  { clave: 'cafe', etiqueta: 'Cafetería', datos: Coffee },
  { clave: 'parque', etiqueta: 'Parque', datos: Trees },
  { clave: 'bus', etiqueta: 'Parada de bus', datos: Bus },
  { clave: 'parqueadero', etiqueta: 'Parqueadero', datos: SquareParking },
  { clave: 'gasolinera', etiqueta: 'Gasolinera', datos: Fuel },
  { clave: 'bandera', etiqueta: 'Otro lugar', datos: Flag },
];

const POR_CLAVE = new Map(ICONOS_PUNTO.map((i) => [i.clave, i]));

export function iconoPunto(clave: string | null | undefined): IconoPunto | null {
  return clave ? POR_CLAVE.get(clave) ?? null : null;
}

/** Color del marcador según el tipo (el icono no cambia el color, así el tipo se sigue leyendo). */
export function colorTipoPunto(tipo: string | null | undefined): string {
  return tipo === 'Salida' ? '#e11d48' : tipo === 'Lugar' ? '#2563eb' : '#64748b';
}

export function letraTipoPunto(tipo: string | null | undefined): string {
  return tipo === 'Salida' ? 'S' : tipo === 'Lugar' ? 'L' : 'P';
}

/** SVG en texto, para los marcadores de Leaflet (que se pintan con HTML, fuera de Angular). */
export function svgIconoPunto(icono: IconoPunto, tamano = 16, color = '#fff'): string {
  const hijos = icono.datos
    .map(([etiqueta, atributos]) => {
      const attrs = Object.entries(atributos)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${k}="${String(v).replace(/"/g, '&quot;')}"`)
        .join(' ');
      return `<${etiqueta} ${attrs}/>`;
    })
    .join('');
  return `<svg width="${tamano}" height="${tamano}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${hijos}</svg>`;
}
