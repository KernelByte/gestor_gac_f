export interface Visita {
  id_visita: number;
  id_congregacion: number;
  nombre_superintendente?: string | null;
  correo_superintendente?: string | null;
  telefono_superintendente?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  semestre?: string | null;
  notas?: string | null;
  agenda_json?: { titulo?: string; items: AgendaItem[] } | null;
  archivo_agenda?: string | null;
  creado_en: string;
  actualizado_en: string;
}

export interface VisitaCreate {
  id_congregacion: number;
  fecha_inicio: string;
  fecha_fin?: string | null;
  nombre_superintendente?: string | null;
  correo_superintendente?: string | null;
  telefono_superintendente?: string | null;
  semestre?: string | null;
  notas?: string | null;
}

export interface AgendaItem {
  dia: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  actividad: string;
  responsable?: string | null;
  lugar?: string | null;
  notas?: string | null;
}

export interface AgendaRequest {
  id_visita: number;
  titulo?: string;
  items: AgendaItem[];
}

export interface TokenVisita {
  token: string;
  url_publica: string;
  fecha_expiracion: string;
}

export interface EnvioCorreoRequest {
  id_visita: number;
  correo_destino: string;
  asunto?: string;
  mensaje?: string;
  enviar_zip: boolean;
  enviar_enlace: boolean;
}

export interface ArchivoAdjunto {
  nombre: string;
  tamano_bytes: number;
}

export interface VistaPublica {
  nombre_congregacion?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  nombre_superintendente?: string | null;
  archivos: { nombre: string; url: string; tamano_bytes: number }[];
  expira_en: string;
}
