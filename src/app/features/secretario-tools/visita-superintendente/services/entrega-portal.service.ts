import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface AgendaItemPortal {
  dia: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  actividad: string;
  responsable?: string | null;
  lugar?: string | null;
  notas?: string | null;
}

export interface AgendaOut {
  titulo: string;
  items: AgendaItemPortal[];
  /** Secciones del formulario en papel (hospedaje, estudios, almuerzos, etc.)
   *  con datos; clave = id de sección, valor = sus filas ya filtradas. */
  secciones?: Record<string, Record<string, string>[]>;
}

export interface FilaMensualRegistro {
  mes: number;
  mes_nombre: string;
  participo: boolean;
  horas: number | null;
  cursos_biblicos: number | null;
  precursor_auxiliar: boolean;
  /**
   * Horas acreditadas por otro servicio (Betel, Salón de Asambleas) anotadas en
   * las observaciones. Ya van incluidas en los totales de la fila.
   */
  horas_credito?: number | null;
  /** Tenía nombramiento de precursor regular/especial/misionero ese mes. */
  precursor_regular: boolean;
  /** Nombre del privilegio de precursor vigente ese mes; null si no aplica. */
  privilegio_mes: string | null;
  observaciones: string | null;
}

export interface PublicadorRegistro {
  id_publicador: number;
  nombre_completo: string;
  sexo: string | null;
  ungido: string | null;
  fecha_bautismo: string | null;
  grupo_id: number | null;
  grupo_nombre: string | null;
  grupo_numero: number | null;
  privilegio_principal: string | null;
  /** Inicio del nombramiento de precursor vigente (ISO); null si hoy no lo es. */
  preg_desde: string | null;
  /**
   * Consideración especial vigente: conserva el nombramiento sin cumplir el
   * requisito de horas (edad avanzada, salud delicada). null si no la tiene.
   */
  consideracion_motivo?: string | null;
  consideracion_desde?: string | null;
  historial: FilaMensualRegistro[];
  total_horas: number;
  total_cursos: number;
  meses_participados: number;
  /** Totales solo de los meses con el nombramiento de precursor vigente. */
  total_horas_preg: number;
  total_cursos_preg: number;
  meses_preg: number;
}

export interface GrupoRegistro {
  grupo_id: number | null;
  grupo_nombre: string;
  grupo_numero: number | null;
  publicadores: PublicadorRegistro[];
}

export interface RegistrosOut {
  anio: number;
  activos: {
    publicadores_por_grupo: GrupoRegistro[];
    precursores_regulares: GrupoRegistro[];
    precursores_auxiliares: GrupoRegistro[];
  };
  inactivos: PublicadorRegistro[];
}

export interface FilaMensualTotal {
  mes: number;
  mes_nombre: string;
  participaciones: number;
  total_activos: number;
  cursos_biblicos: number;
  horas: number | null;
}

export interface TarjetaTotal {
  titulo: string;
  filas: FilaMensualTotal[];
  total_participaciones: number;
  total_cursos: number;
  total_horas: number;
}

export interface TotalesOut {
  anio: number;
  total_publicadores: TarjetaTotal;
  total_precursores_regulares: TarjetaTotal;
  total_precursores_auxiliares: TarjetaTotal;
}

export interface ContactoItem {
  id_contacto_emergencia: number;
  nombre: string;
  parentesco: string | null;
  telefono: string | null;
  direccion: string | null;
  es_principal: boolean;
  solo_urgencias: boolean;
}

export interface ContactoPublicador {
  id_publicador: number;
  nombre_publicador: string;
  telefono_publicador: string | null;
  contactos: ContactoItem[];
}

export interface FilaMensualS88 {
  nombre_mes: string;
  midweek_reuniones: number;
  midweek_total: number | null;
  midweek_promedio: number | null;
  weekend_reuniones: number;
  weekend_total: number | null;
  weekend_promedio: number | null;
}

export interface ResumenAnioS88 {
  ano_servicio: number;
  meses: FilaMensualS88[];
}

export interface AsistenciaS88Out {
  anio_seleccionado: number;
  ano_anterior: ResumenAnioS88;
  ano_actual: ResumenAnioS88;
}

export interface DocumentoItem {
  nombre: string;
  tamano_bytes: number;
  tipo: 'pdf' | 'imagen' | 'word' | 'excel' | 'otro';
  extension: string;
  url: string;
}

export interface PortalMetadata {
  nombre_congregacion: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  nombre_superintendente: string | null;
  expira_en: string | null;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class EntregaPortalService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/visita-sc`;

  // ── Rutas según modo ──────────────────────────────────────────────────────

  private publicBase(token: string) {
    return `${this.base}/public/${token}`;
  }

  private internoBase(idVisita: number) {
    return `${this.base}/${idVisita}/preview`;
  }

  // ── Años disponibles ─────────────────────────────────────────────────────

  aniosPublico(token: string): Observable<{ anios: number[] }> {
    return this.http.get<{ anios: number[] }>(`${this.publicBase(token)}/anios`);
  }

  aniosInterno(idVisita: number): Observable<{ anios: number[] }> {
    return this.http.get<{ anios: number[] }>(`${this.internoBase(idVisita)}/anios`);
  }

  // ── Metadata de la visita (solo para portal público) ──────────────────────

  metadataPublico(token: string): Observable<any> {
    return this.http.get<any>(`${this.publicBase(token)}`);
  }

  // ── Registros de predicación ──────────────────────────────────────────────

  registrosPublico(token: string, anio: number): Observable<RegistrosOut> {
    return this.http.get<RegistrosOut>(
      `${this.publicBase(token)}/registros`, { params: { anio } }
    );
  }

  registrosInterno(idVisita: number, anio: number): Observable<RegistrosOut> {
    return this.http.get<RegistrosOut>(
      `${this.internoBase(idVisita)}/registros`, { params: { anio } }
    );
  }

  // ── Totales ───────────────────────────────────────────────────────────────

  totalesPublico(token: string, anio: number): Observable<TotalesOut> {
    return this.http.get<TotalesOut>(
      `${this.publicBase(token)}/totales`, { params: { anio } }
    );
  }

  totalesInterno(idVisita: number, anio: number): Observable<TotalesOut> {
    return this.http.get<TotalesOut>(
      `${this.internoBase(idVisita)}/totales`, { params: { anio } }
    );
  }

  // ── Contactos ─────────────────────────────────────────────────────────────

  contactosPublico(token: string): Observable<ContactoPublicador[]> {
    return this.http.get<ContactoPublicador[]>(`${this.publicBase(token)}/contactos`);
  }

  contactosInterno(idVisita: number): Observable<ContactoPublicador[]> {
    return this.http.get<ContactoPublicador[]>(`${this.internoBase(idVisita)}/contactos`);
  }

  // ── Asistencia ────────────────────────────────────────────────────────────

  asistenciaPublico(token: string, anio: number): Observable<AsistenciaS88Out> {
    return this.http.get<AsistenciaS88Out>(
      `${this.publicBase(token)}/asistencia`, { params: { anio } }
    );
  }

  asistenciaInterno(idVisita: number, anio: number): Observable<AsistenciaS88Out> {
    return this.http.get<AsistenciaS88Out>(
      `${this.internoBase(idVisita)}/asistencia`, { params: { anio } }
    );
  }

  // ── Documentos ────────────────────────────────────────────────────────────

  documentosPublico(token: string): Observable<DocumentoItem[]> {
    return this.http.get<DocumentoItem[]>(`${this.publicBase(token)}/documentos`);
  }

  documentosInterno(idVisita: number): Observable<DocumentoItem[]> {
    return this.http.get<DocumentoItem[]>(`${this.internoBase(idVisita)}/documentos`);
  }

  // ── Descargas (S-88 PDF + ZIP) ────────────────────────────────────────────

  contactosPdfPublico(token: string): Observable<Blob> {
    return this.http.get(
      `${this.publicBase(token)}/contactos/contactos.pdf`,
      { responseType: 'blob' }
    );
  }

  contactosPdfInterno(idVisita: number): Observable<Blob> {
    return this.http.get(
      `${this.internoBase(idVisita)}/contactos/contactos.pdf`,
      { responseType: 'blob' }
    );
  }

  s88PdfPublico(token: string, anio: number): Observable<Blob> {
    return this.http.get(
      `${this.publicBase(token)}/asistencia/s88.pdf`,
      { responseType: 'blob', params: { anio } }
    );
  }

  s88PdfInterno(idVisita: number, anio: number): Observable<Blob> {
    return this.http.get(
      `${this.internoBase(idVisita)}/asistencia/s88.pdf`,
      { responseType: 'blob', params: { anio } }
    );
  }

  zipFielPublico(token: string, anio: number): Observable<Blob> {
    return this.http.get(
      `${this.publicBase(token)}/zip-fiel`,
      { responseType: 'blob', params: { anio } }
    );
  }

  /**
   * Descarga un documento adjunto en modo interno.
   *
   * No vale enlazar la URL directamente: ese endpoint exige token y un <a href>
   * es una navegación del navegador, sin la cabecera Authorization que pone el
   * interceptor. Por eso se pide con HttpClient y se guarda el blob. En el
   * portal público no hace falta — allí el token va en la propia ruta.
   */
  archivoInterno(idVisita: number, nombre: string): Observable<Blob> {
    return this.http.get(
      `${this.internoBase(idVisita)}/archivo/${encodeURIComponent(nombre)}`,
      { responseType: 'blob' },
    );
  }

  /** Tarjeta de un publicador desde el portal público. Solo individual: el
   *  endpoint no admite modos por grupo ni masivos. */
  tarjetaPdfPublico(token: string, publicadorId: number, anoServicio: number): Observable<Blob> {
    return this.http.get(`${this.publicBase(token)}/tarjeta-pdf`, {
      responseType: 'blob',
      params: { publicador_id: String(publicadorId), ano_servicio: String(anoServicio) },
    });
  }

  tarjetaPdfInterno(idVisita: number, anoServicio: number, opts: {
    publicadorId?: number;
    grupoId?: number;
    soloPrecursores?: boolean;
    publicadorIds?: number[];
  }): Observable<Blob> {
    let params: Record<string, string> = { ano_servicio: String(anoServicio) };
    if (opts.publicadorId)       params['publicador_id']    = String(opts.publicadorId);
    if (opts.grupoId)            params['grupo_id']         = String(opts.grupoId);
    if (opts.soloPrecursores)    params['solo_precursores'] = 'true';
    if (opts.publicadorIds?.length) params['publicador_ids'] = opts.publicadorIds.join(',');
    return this.http.get(
      `${this.internoBase(idVisita)}/tarjeta-pdf`,
      { responseType: 'blob', params }
    );
  }

  agendaPublico(token: string): Observable<AgendaOut> {
    return this.http.get<AgendaOut>(`${this.publicBase(token)}/agenda`);
  }

  agendaInterno(idVisita: number): Observable<AgendaOut> {
    return this.http.get<AgendaOut>(`${this.internoBase(idVisita)}/agenda`);
  }

  zipFielInterno(idVisita: number, anio: number): Observable<Blob> {
    return this.http.get(
      `${this.internoBase(idVisita)}/zip-fiel`,
      { responseType: 'blob', params: { anio } }
    );
  }

  // ── Helper descarga ───────────────────────────────────────────────────────

  saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
