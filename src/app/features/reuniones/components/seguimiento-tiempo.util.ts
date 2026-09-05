import { NivelTiempo } from '../models/reuniones.models';

/**
 * El tiempo de una parte, en los dos sentidos.
 *
 * Vive fuera de los componentes porque lo usan los dos que registran tiempo
 * —el panel de una asignación y la hoja de trabajo por reunión— y una segunda
 * copia de `parseTiempo` es una segunda forma de interpretar "5:70".
 */

/** Segundos a "m:ss". */
export function formatSegundos(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Acepta "5:30", "5:70" (se recorta a :59), "90" (segundos sueltos) y vacío.
 *  Devuelve `null` cuando no hay nada que interpretar, que es distinto de 0. */
export function parseTiempo(txt: string): number | null {
  const limpio = (txt || '').trim();
  if (!limpio) return null;
  if (limpio.includes(':')) {
    const [m, s] = limpio.split(':');
    const min = parseInt(m, 10) || 0;
    const seg = parseInt(s, 10) || 0;
    return min * 60 + Math.min(seg, 59);
  }
  const n = parseInt(limpio, 10);
  return isNaN(n) ? null : n;
}

/** Contra la duración prevista de la parte. Se calcula también en el cliente
 *  —el servidor manda su propio veredicto— para que la etiqueta reaccione
 *  mientras se escribe, sin esperar al guardado. */
export function nivelDeTiempo(
  segundos: number | null,
  duracionMinutos: number | null | undefined,
): NivelTiempo | null {
  if (segundos == null || !duracionMinutos) return null;
  const limite = duracionMinutos * 60;
  if (segundos > limite) return 'pasado';
  if (segundos < limite * 0.75) return 'corto';
  return 'ok';
}

/** "Se pasó 1:20" / "Corto 0:45" / "En tiempo". */
export function etiquetaNivel(
  nivel: NivelTiempo,
  segundos: number | null,
  duracionMinutos: number | null | undefined,
): string {
  const dif = Math.abs((segundos ?? 0) - (duracionMinutos ?? 0) * 60);
  if (nivel === 'pasado') return `Se pasó ${formatSegundos(dif)}`;
  if (nivel === 'corto') return `Corto ${formatSegundos(dif)}`;
  return 'En tiempo';
}

/** Las clases del chip de nivel. En un sitio para que la hoja de trabajo, el
 *  panel y el historial no se pinten de tres verdes distintos. */
export function claseNivel(nivel: NivelTiempo | null | undefined): string {
  if (nivel === 'pasado') return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  if (nivel === 'corto') return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400';
  if (nivel === 'ok') return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400';
  return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
}

/** "Hoy" / "Ayer" / "Hace 3 días" / "Hace 2 meses". Negativo = aún no ha pasado. */
export function hace(dias: number): string {
  if (dias < 0) return 'Próximamente';
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 30) return `Hace ${dias} días`;
  const meses = Math.round(dias / 30);
  if (meses < 12) return `Hace ${meses} mes${meses === 1 ? '' : 'es'}`;
  const anos = Math.round(dias / 365);
  return `Hace ${anos} año${anos === 1 ? '' : 's'}`;
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "1 sep 2026". Se construye con 'T00:00:00' para que la fecha no se corra un
 *  día en los husos al oeste de Greenwich. */
export function formatFecha(fechaStr: string): string {
  const d = new Date(fechaStr + 'T00:00:00');
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Miércoles 1 sep": la reunión se recuerda por su día de la semana. */
export function formatFechaLarga(fechaStr: string): string {
  const d = new Date(fechaStr + 'T00:00:00');
  const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return `${dias[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}
