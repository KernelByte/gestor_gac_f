export type TipoEvento = 'tarea' | 'recordatorio' | 'visita' | 'transferencia' | 'informes' | 'bautismo' | 'reunion_ancianos' | 'exhibidor';
export type EstadoEvento = 'pendiente' | 'hecho' | 'vencido';
export type Frecuencia = 'unica' | 'periodica';
/** Agenda del secretario, la de cada persona (coordinador y ancianos) o la de quien solo participa en exhibidores. */
export type ModoAgenda = 'secretaria' | 'personal' | 'exhibidor';
/** Dónde sale un recordatorio: agenda del secretario, solo la de su dueño, o la de cada anciano. */
export type AlcanceRecordatorio = 'secretaria' | 'personal' | 'ancianos';

export interface EventoAgenda {
  id: string;
  tipo: TipoEvento;
  titulo: string;
  titulo_corto: string | null;  // para la cuadrícula; null = usar titulo
  detalle: string | null;
  fecha: string | null;      // YYYY-MM-DD; null = sin fecha
  fecha_fin: string | null;
  estado: EstadoEvento;
  en_progreso: boolean;      // tareas ya empezadas (siguen pendientes)
  origen_id: number | null;
  enlace: string | null;     // URL externa
  ruta: string | null;       // ruta del portal
  se_puede_marcar: boolean;
  avisar: boolean;
  clave_hecho: string | null; // eventos automáticos que se marcan por clave (ej. bautismo:123)
  dias_aviso: number;
}

/** Día festivo de Colombia (global). */
export interface Festivo {
  fecha: string;   // YYYY-MM-DD
  nombre: string;
}

export interface Recordatorio {
  id_recordatorio: number;
  id_congregacion: number;
  titulo: string;
  descripcion: string | null;
  enlace: string | null;
  frecuencia: Frecuencia;
  intervalo_meses: number;
  fecha_inicio: string;
  dias_aviso: number;
  activo: boolean;
  plantilla_clave: string | null;
  alcance: AlcanceRecordatorio;
  es_mio: boolean;   // agenda personal: lo puede editar y borrar quien lo ve
  proxima: string | null;
}

export type RecordatorioForm = Omit<Recordatorio, 'id_recordatorio' | 'id_congregacion' | 'plantilla_clave' | 'proxima' | 'alcance' | 'es_mio'>
  & { alcance?: 'personal' | 'ancianos' };

export interface Sugerencia extends RecordatorioForm {
  clave: string;
  ya_agregada: boolean;
}

/**
 * Un color por tipo, con los tonos bien separados en la rueda de color para que el calendario se lea
 * sin abrir el menú (las píldoras solo llevan color, el nombre está en el menú de tipos y en el panel):
 *   rosado (tareas) · violeta (periódicas, la marca) · naranja (informes, color de Secretaría) ·
 *   azul (visita del SC) · esmeralda (bautismos) · gris (transferencias, que son trámites sin urgencia) ·
 *   ámbar (reuniones de ancianos) · cian (salidas de exhibidor).
 * El rojo queda reservado a lo atrasado, y por eso las tareas usan rosado y no rosa-rojizo.
 */
export const TIPOS_EVENTO: Record<TipoEvento, { label: string; pill: string; dot: string }> = {
  tarea:         { label: 'Tareas',         pill: 'bg-pink-50 text-pink-800 border-pink-200 dark:bg-pink-950/40 dark:text-pink-200 dark:border-pink-900/60',             dot: 'bg-pink-500' },
  recordatorio:  { label: 'Periódicas',     pill: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900/60', dot: 'bg-violet-500' },
  informes:      { label: 'Informes',       pill: 'bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900/60', dot: 'bg-orange-500' },
  visita:        { label: 'Visita del SC',  pill: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900/60',             dot: 'bg-blue-500' },
  bautismo:      { label: 'Bautismos',      pill: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60', dot: 'bg-emerald-500' },
  reunion_ancianos: { label: 'Reuniones de ancianos', pill: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60', dot: 'bg-amber-400' },
  exhibidor:     { label: 'Exhibidores',    pill: 'bg-cyan-50 text-cyan-900 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-900/60',             dot: 'bg-cyan-500' },
  transferencia: { label: 'Transferencias', pill: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/70 dark:text-slate-200 dark:border-slate-600',        dot: 'bg-slate-500' },
};
