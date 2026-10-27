import { RecordatorioForm } from '../models/agenda.model';

export const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Date → 'YYYY-MM-DD' en hora local (toISOString usaría UTC y cambiaría de día de noche). */
export function iso(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

/** 'YYYY-MM-DD' → Date a medianoche local. */
export function desdeIso(s: string): Date {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, m - 1, d);
}

export function hoyIso(): string {
  return iso(new Date());
}

export function sumarDias(s: string, n: number): string {
  const d = desdeIso(s);
  d.setDate(d.getDate() + n);
  return iso(d);
}

/** 'martes 3 de noviembre' (con el año solo si no es el actual). */
export function fechaLarga(s: string): string {
  const d = desdeIso(s);
  const anio = d.getFullYear() !== new Date().getFullYear() ? ` de ${d.getFullYear()}` : '';
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}${anio}`;
}

/** "Hoy", "Mañana", "Ayer", "En 5 días", "Hace 3 días". */
export function relativo(s: string): string {
  const dias = Math.round((desdeIso(s).getTime() - desdeIso(hoyIso()).getTime()) / 86_400_000);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  return dias > 0 ? `En ${dias} días` : `Hace ${-dias} días`;
}

/** La regla en palabras: "Cada 4 meses, el día 15. Le avisa 3 días antes." */
export function textoFrecuencia(r: Pick<RecordatorioForm, 'frecuencia' | 'intervalo_meses' | 'fecha_inicio' | 'dias_aviso'>): string {
  if (!r.fecha_inicio) return '';
  const d = desdeIso(r.fecha_inicio);
  let cuando: string;
  if (r.frecuencia === 'unica') {
    cuando = `Una sola vez, el ${fechaLarga(r.fecha_inicio)}`;
  } else if (r.intervalo_meses === 12) {
    cuando = `Cada año, el ${d.getDate()} de ${MESES[d.getMonth()]}`;
  } else if (r.intervalo_meses === 1) {
    cuando = `Cada mes, el día ${d.getDate()}`;
  } else {
    cuando = `Cada ${r.intervalo_meses} meses, el día ${d.getDate()} (empezando en ${MESES[d.getMonth()]})`;
  }
  const aviso = r.dias_aviso === 0 ? 'Le avisa el mismo día'
    : r.dias_aviso === 1 ? 'Le avisa 1 día antes'
    : r.dias_aviso === 7 ? 'Le avisa 1 semana antes'
    : r.dias_aviso === 14 ? 'Le avisa 2 semanas antes'
    : `Le avisa ${r.dias_aviso} días antes`;
  return `${cuando}. ${aviso}.`;
}

/** "Cada 4 meses", "Cada año", "Una vez · 1 de noviembre": la frecuencia en pocas palabras, para tarjetas. */
export function frecuenciaCorta(r: Pick<RecordatorioForm, 'frecuencia' | 'intervalo_meses' | 'fecha_inicio'>): string {
  if (r.frecuencia === 'unica') {
    if (!r.fecha_inicio) return 'Una sola vez';
    const d = desdeIso(r.fecha_inicio);
    return `Una vez · ${d.getDate()} de ${MESES[d.getMonth()]}`;
  }
  if (r.intervalo_meses === 12) return 'Cada año';
  if (r.intervalo_meses === 1) return 'Cada mes';
  return `Cada ${r.intervalo_meses} meses`;
}

/** "Aviso 3 días antes", "Aviso el mismo día". */
export function avisoCorto(dias: number): string {
  if (dias === 0) return 'Aviso el mismo día';
  if (dias === 1) return 'Aviso 1 día antes';
  if (dias === 7) return 'Aviso 1 semana antes';
  if (dias === 14) return 'Aviso 2 semanas antes';
  return `Aviso ${dias} días antes`;
}
