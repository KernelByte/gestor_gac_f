export interface Notificacion {
  id_notificacion: number;
  tipo: 'solicitud_acceso' | 'usuario_activado' | 'backup_completado' | string;
  titulo: string;
  mensaje: string | null;
  leida: boolean;
  creado_en: string;
  payload?: Record<string, any>;
}
