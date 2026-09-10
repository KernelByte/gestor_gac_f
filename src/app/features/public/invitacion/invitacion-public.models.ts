export type EstadoInvitacionPublica =
  | 'valida' | 'expirada' | 'canjeada' | 'revocada' | 'no_encontrada';

export interface InvitacionPublicaOut {
  estado: EstadoInvitacionPublica;
  nombre_publicador: string | null;
  nombre_congregacion: string | null;
  codigo_pin: string | null;
  codigo_seguridad: string | null;
  expira_en: string | null;
  deep_link: string | null;
  play_store_url: string;
  app_store_url: string;
}
