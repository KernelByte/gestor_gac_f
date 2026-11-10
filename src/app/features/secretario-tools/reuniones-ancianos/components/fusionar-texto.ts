/**
 * Junta dos ediciones hechas a la vez sobre el mismo texto. Es la misma regla
 * que aplica el servidor (en_vivo_service.fusionar): si tocan sitios distintos
 * se aplican las dos; si se pisan, se conservan ambas versiones del trozo.
 */

/** El cambio de `base` a `otro` como un solo reemplazo: base[i, j) pasa a ser `ins`. */
export function region(base: string, otro: string): { i: number; j: number; ins: string } {
  const n = Math.min(base.length, otro.length);
  let i = 0;
  while (i < n && base[i] === otro[i]) i++;
  let k = 0;
  while (k < n - i && base[base.length - 1 - k] === otro[otro.length - 1 - k]) k++;
  return { i, j: base.length - k, ins: otro.slice(i, otro.length - k) };
}

export function fusionar(base: string, suyo: string, mio: string): string {
  if (mio === base || suyo === mio) return suyo;
  if (suyo === base) return mio;
  const a = region(base, suyo);
  const b = region(base, mio);
  if (a.j <= b.i) return base.slice(0, a.i) + a.ins + base.slice(a.j, b.i) + b.ins + base.slice(b.j);
  if (b.j <= a.i) return base.slice(0, b.i) + b.ins + base.slice(b.j, a.i) + a.ins + base.slice(a.j);
  const ini = Math.min(a.i, b.i);
  const fin = Math.max(a.j, b.j);
  const trozoSuyo = base.slice(ini, a.i) + a.ins + base.slice(a.j, fin);
  const trozoMio = base.slice(ini, b.i) + b.ins + base.slice(b.j, fin);
  const medio = trozoSuyo.includes(trozoMio) ? trozoSuyo : trozoMio.includes(trozoSuyo) ? trozoMio : trozoSuyo + trozoMio;
  return base.slice(0, ini) + medio + base.slice(fin);
}

/** Dónde queda una posición del texto viejo en el nuevo (para no mover el cursor de quien escribe). */
export function moverPosicion(viejo: string, nuevo: string, pos: number): number {
  const r = region(viejo, nuevo);
  if (pos <= r.i) return pos;
  if (pos >= r.j) return pos + (nuevo.length - viejo.length);
  return r.i + r.ins.length;
}
