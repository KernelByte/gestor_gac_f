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
  /** Se manda una nota corta en lugar de la carta (la carta se conserva). */
  sin_carta?:                  boolean;
  nota_destino?:               string | null;
  archivo_carta?:              string | null;
  archivo_zip?:                string | null;
  estado:                      EstadoTransferencia;
  id_congregacion_destino?:    number | null;
  accion_realizada?:           AccionRealizada | null;
  procesada_en?:               string | null;
  miembros:                    TransferenciaMiembro[];
  /** 'ingreso': la recibió esta congregación por un traslado en GAC (solo lectura). */
  direccion?:                  'salida' | 'ingreso';
  congregacion_origen_nombre?: string | null;
  creado_en:                   string;
  actualizado_en:              string;
}

export interface CompletarTransferenciaRequest {
  accion:               AccionTransferencia;
  numero_congregacion?: string | null;
  /** Congregación elegida de la lista (puede no tener número). */
  id_congregacion_destino?: number | null;
  opcion_usuario?:      OpcionUsuarioBorrado;
  /** Trasladar: privilegios (id_publicador_privilegio) que conserva en la destino. */
  privilegios_conservar?: number[];
}

/** Familiares que faltaron en un traslado ya hecho: van a la misma congregación. */
export interface AgregarMiembrosRequest {
  id_publicadores: number[];
  privilegios_conservar?: number[];
}

/** Lo que tocará el traslado de cada miembro (vista previa antes de completar). */
export interface PrivilegioVigente {
  id_publicador_privilegio: number;
  nombre_privilegio:        string;
  fecha_inicio:             string;
  fecha_fin:                string | null;
}

export interface ImpactoMiembro {
  id_publicador:            number;
  nombre_completo:          string;
  rol_usuario:              string | null;
  rol_cambiara:             boolean;
  privilegios:              PrivilegioVigente[];
  asignaciones_futuras:     Record<string, number>;
  territorios_sin_devolver: number;
}

export interface ImpactoTraslado {
  miembros: ImpactoMiembro[];
}

/** Resultado de buscar una congregación por nombre o número. */
export interface CongregacionBuscada {
  id_congregacion:     number;
  nombre_congregacion: string;
  /** Vacío si la congregación aún no tiene número cargado. */
  numero_congregacion: string;
}

export interface CongregacionDestino {
  id_congregacion:     number;
  nombre_congregacion: string;
  numero_congregacion: string | null;
  es_la_misma:         boolean;
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
  sin_carta?:                   boolean;
  nota_destino?:                string | null;
  estado?:                      EstadoTransferencia;
}
