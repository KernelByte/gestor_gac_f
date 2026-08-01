/**
 * Consideración especial de un precursor regular: por edad avanzada o salud
 * delicada queda exento del requisito de 50 h/mes (560 h/año) sin perder el
 * nombramiento.
 *
 * OJO: no confundir con las horas de crédito (Betel, Salón de Asambleas,
 * construcción), que son horas reales acreditadas en el informe del mes.
 */
export type MotivoConsideracion = 'salud' | 'edad_avanzada' | 'circunstancias' | 'otro';

export const MOTIVOS_CONSIDERACION: ReadonlyArray<{ value: MotivoConsideracion; label: string }> = [
   { value: 'salud', label: 'Salud delicada' },
   { value: 'edad_avanzada', label: 'Edad avanzada' },
   { value: 'circunstancias', label: 'Circunstancias familiares' },
   { value: 'otro', label: 'Otro' },
];

export interface PrecursorConsideracion {
   id_consideracion: number;
   id_publicador: number;
   fecha_inicio: string;
   fecha_fin?: string | null;
   motivo: MotivoConsideracion;
   motivo_label: string;
   descripcion?: string | null;
   creado_por_nombre?: string | null;
   fecha_creacion?: string | null;
}

export interface PrecursorConsideracionCreate {
   id_publicador: number;
   fecha_inicio: string;
   fecha_fin?: string | null;
   motivo: MotivoConsideracion;
   descripcion?: string | null;
}

export interface PrecursorConsideracionUpdate {
   fecha_inicio?: string;
   fecha_fin?: string | null;
   motivo?: MotivoConsideracion;
   descripcion?: string | null;
}
