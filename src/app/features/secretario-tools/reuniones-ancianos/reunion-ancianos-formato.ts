// Textos de fecha y hora de las reuniones de ancianos, con la misma forma que
// el PDF del backend («Miércoles 4 de noviembre», «7:00 p. m.»).

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto',
  'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "YYYY-MM-DD" como fecha local (sin el corrimiento de zona de new Date(iso)). */
export function fechaLocal(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function hoyIso(): string {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`;
}

/** «4 de noviembre» */
export function diaYMes(iso: string | null | undefined): string {
  const d = fechaLocal(iso);
  return d ? `${d.getDate()} de ${MESES[d.getMonth()]}` : '';
}

/** «miércoles» */
export function diaSemana(iso: string | null | undefined): string {
  const d = fechaLocal(iso);
  return d ? DIAS[d.getDay()] : '';
}

/** «Miércoles 4 de noviembre» (con el año si no es el actual). */
export function fechaCompleta(iso: string | null | undefined): string {
  const d = fechaLocal(iso);
  if (!d) return '';
  const dia = DIAS[d.getDay()];
  const anio = d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : '';
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${diaYMes(iso)}${anio}`;
}

/** «7:00 p. m.» a partir de "19:00" o "19:00:00". */
export function hora12(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  const sufijo = h < 12 ? 'a. m.' : 'p. m.';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${sufijo}`;
}

/** «En 3 días», «Mañana», «Hoy», «Hace 5 días». */
export function cuandoRelativo(iso: string | null | undefined): string {
  const d = fechaLocal(iso);
  if (!d) return '';
  const hoy = fechaLocal(hoyIso())!;
  const dias = Math.round((d.getTime() - hoy.getTime()) / 86_400_000);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  return dias > 0 ? `En ${dias} días` : `Hace ${-dias} días`;
}

export function minutosTexto(min: number | null | undefined): string {
  if (!min) return '0 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
