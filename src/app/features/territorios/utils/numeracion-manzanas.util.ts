/**
 * Numeración de manzanas: una sola secuencia 1, 2, 3… para toda la congregación.
 * Las tarjetas van por código (T01, T02…) y cada una continúa donde terminó la anterior.
 * El servidor (manzana_service) es quien manda; esto solo avisa antes de guardar.
 */

export interface NumeroUsado {
  id_manzana: number;
  numero: string;
  id_territorio: number;
  codigo: string | null;
}

/** Lo que devuelve GET /territorios/{id}/manzanas/numeracion. */
export interface NumeracionManzanas {
  usados: NumeroUsado[];
  /** El número que sigue en la secuencia para una manzana nueva de esa tarjeta. */
  siguiente: number;
}

/** '03' y '3' son la misma manzana; 'a' y 'A' también. */
export function claveNumero(numero: string | null | undefined): string {
  const n = (numero ?? '').trim().toLowerCase();
  return /^\d+$/.test(n) ? String(Number(n)) : n;
}

/**
 * Aviso listo para mostrar si `numero` ya lo tiene otra manzana (null si está libre).
 * `exceptoId` es la manzana que se está editando; `extras` son números recién guardados que
 * el servidor aún no devolvió.
 */
export function avisoNumeroRepetido(
  numero: string,
  num: NumeracionManzanas | null,
  idTerritorio: number | null,
  exceptoId?: number,
  extras: string[] = [],
): string | null {
  const clave = claveNumero(numero);
  if (!clave) return null;
  const otra = num?.usados.find((u) => u.id_manzana !== exceptoId && claveNumero(u.numero) === clave);
  const reciente = extras.some((e) => claveNumero(e) === clave);
  if (!otra && !reciente) return null;
  const donde = otra && otra.id_territorio !== idTerritorio ? `la tarjeta ${otra.codigo ?? '#' + otra.id_territorio}` : 'esta tarjeta';
  return `Ya existe la manzana ${numero.trim()} en ${donde}. La que sigue en la secuencia es la ${siguienteLibre(num, extras)}.`;
}

/** El que sigue según el servidor, saltando los recién guardados que aún no aparecen en la lista. */
export function siguienteLibre(num: NumeracionManzanas | null, extras: string[] = []): number {
  const usados = new Set([...(num?.usados ?? []).map((u) => claveNumero(u.numero)), ...extras.map(claveNumero)]);
  let n = num?.siguiente ?? 1;
  while (usados.has(String(n))) n++;
  return n;
}
