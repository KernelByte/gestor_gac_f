export type EstadoTransferencia = 'borrador' | 'finalizada';

export interface TransferenciaMiembro {
  id_publicador:        number;
  nombre_completo:      string;
  orden:                number;
  falta_consentimiento: boolean;
}

export interface Transferencia {
  id_transferencia:            number;
  id_publicador:               number;
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
  miembros:                    TransferenciaMiembro[];
  creado_en:                   string;
  actualizado_en:              string;
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
