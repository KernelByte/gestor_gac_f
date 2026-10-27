export type TipoEvento = 'tarea' | 'recordatorio' | 'visita' | 'transferencia' | 'informes' | 'bautismo';
export type EstadoEvento = 'pendiente' | 'hecho' | 'vencido';
export type Frecuencia = 'unica' | 'periodica';

export interface EventoAgenda {
  id: string;
  tipo: TipoEvento;
  titulo: string;
  titulo_corto: string | null;  // para la cuadrícula; null = usar titulo
  detalle: string | null;
  fecha: string | null;      // YYYY-MM-DD; null = sin fecha
  fecha_fin: string | null;
  estado: EstadoEvento;
  origen_id: number | null;
  enlace: string | null;     // URL externa
  ruta: string | null;       // ruta del portal
  se_puede_marcar: boolean;
  avisar: boolean;
  clave_hecho: string | null; // eventos automáticos que se marcan por clave (ej. bautismo:123)
  dias_aviso: number;
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
  proxima: string | null;
}

export type RecordatorioForm = Omit<Recordatorio, 'id_recordatorio' | 'id_congregacion' | 'plantilla_clave' | 'proxima'>;

export interface Sugerencia extends RecordatorioForm {
  clave: string;
  ya_agregada: boolean;
}

/**
 * Un color por tipo, con los tonos bien separados en la rueda de color para que el calendario se lea
 * sin abrir el menú (las píldoras solo llevan color, el nombre está en el menú de tipos y en el panel):
 *   rosado (tareas) · violeta (periódicas, la marca) · naranja (informes, color de Secretaría) ·
 *   azul (visita del SC) · esmeralda (bautismos) · gris (transferencias, que son trámites sin urgencia).
 * El rojo queda reservado a lo atrasado, y por eso las tareas usan rosado y no rosa-rojizo.
 */
export const TIPOS_EVENTO: Record<TipoEvento, { label: string; pill: string; dot: string }> = {
  tarea:         { label: 'Tareas',         pill: 'bg-pink-50 text-pink-800 border-pink-200 dark:bg-pink-950/40 dark:text-pink-200 dark:border-pink-900/60',             dot: 'bg-pink-500' },
  recordatorio:  { label: 'Periódicas',     pill: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900/60', dot: 'bg-violet-500' },
  informes:      { label: 'Informes',       pill: 'bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900/60', dot: 'bg-orange-500' },
  visita:        { label: 'Visita del SC',  pill: 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900/60',             dot: 'bg-blue-500' },
  bautismo:      { label: 'Bautismos',      pill: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60', dot: 'bg-emerald-500' },
  transferencia: { label: 'Transferencias', pill: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/70 dark:text-slate-200 dark:border-slate-600',        dot: 'bg-slate-500' },
};
