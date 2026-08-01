export type EstadoTransferencia = 'borrador' | 'finalizada';
export type AccionTransferencia = 'trasladar' | 'eliminar';
export type AccionRealizada     = 'trasladado' | 'eliminado';
export type OpcionUsuarioBorrado = 'sin_usuario' | 'eliminar_con_usuario' | 'reasignar_usuario';

export interface TransferenciaMiembro {
  id_publicador:        number | null;
  nombre_completo:      string;
  orden:                number;
  falta_consentimiento: boolean;
}

export interface Transferencia {
  id_transferencia:            number;
  id_publicador:               number | null;
  id_congregacion_origen:      number;
  congregacion_destino?:       string | null;
  correo_congregacion_destino?: string | null;
  etiqueta_familia?:           string | null;
  es_familiar:                 number;
  motivo?:                     string | null;
  fecha_transferencia?:        string | null;
  notas_para_carta?:           string | null;
  carta_redactada?:            string | null;
  archivo_carta?:              string | null;
  archivo_zip?:                string | null;
  estado:                      EstadoTransferencia;
  id_congregacion_destino?:    number | null;
  accion_realizada?:           AccionRealizada | null;
  procesada_en?:               string | null;
  miembros:                    TransferenciaMiembro[];
  creado_en:                   string;
  actualizado_en:              string;
}

export interface CompletarTransferenciaRequest {
  accion:               AccionTransferencia;
  numero_congregacion?: string | null;
  opcion_usuario?:      OpcionUsuarioBorrado;
}

export interface TransferenciaCreate {
  id_publicadores:             number[];
  id_congregacion_origen:      number;
  congregacion_destino?:       string | null;
  correo_congregacion_destino?: string | null;
  etiqueta_familia?:           string | null;
  motivo?:                     string | null;
  fecha_transferencia?:        string | null;
  notas_para_carta:            string;
  estado?:                     EstadoTransferencia;
}

export interface TransferenciaUpdate {
  congregacion_destino?:        string | null;
  correo_congregacion_destino?: string | null;
  etiqueta_familia?:            string | null;
  motivo?:                      string | null;
  fecha_transferencia?:         string | null;
  notas_para_carta?:            string | null;
  carta_redactada?:             string | null;
  estado?:                      EstadoTransferencia;
}
