export type EstadoTransferencia = 'borrador' | 'finalizada';

export interface Transferencia {
  id_transferencia: number;
  id_publicador: number;
  id_congregacion_origen: number;
  congregacion_destino?: string | null;
  motivo?: string | null;
  fecha_transferencia?: string | null;
  notas_para_carta?: string | null;
  carta_redactada?: string | null;
  archivo_carta?: string | null;
  archivo_zip?: string | null;
  estado: EstadoTransferencia;
  creado_en: string;
  actualizado_en: string;
}

export interface TransferenciaCreate {
  id_publicador: number;
  id_congregacion_origen: number;
  congregacion_destino?: string | null;
  motivo?: string | null;
  fecha_transferencia?: string | null;
  notas_para_carta?: string | null;
  estado?: EstadoTransferencia;
}

export interface TransferenciaUpdate {
  congregacion_destino?: string | null;
  motivo?: string | null;
  fecha_transferencia?: string | null;
  notas_para_carta?: string | null;
  carta_redactada?: string | null;
  estado?: EstadoTransferencia;
}
