import { Medida } from '../medir.directive';

/**
 * El lado más grande (entre `min` y `max` px) con el que `n` piezas cuadradas,
 * separadas por `gap`, caben en la caja sin desbordar. Así los puntos y las
 * teselas llenan el espacio disponible en cualquier pantalla.
 */
export function tamanoQueCabe(n: number, caja: Medida, gap: number, min: number, max: number): number {
  if (!n || !caja.ancho || !caja.alto) return min;
  for (let s = max; s > min; s--) {
    const cols = Math.max(1, Math.floor((caja.ancho + gap) / (s + gap)));
    const filas = Math.ceil(n / cols);
    if (filas * (s + gap) - gap <= caja.alto) return s;
  }
  return min;
}
