import { DeleteOpcion, Publicador, UsuarioVinculado } from '../models/publicador';

export type PublicadorListParams = {
  limit?: number;
  offset?: number;
  q?: string;
  id_estado?: number | string;
  id_congregacion?: number | string;
  id_grupo?: number | string;
};

export interface PublicadorRepo {
  list(params?: PublicadorListParams): Promise<Publicador[]>;
  get(id: number): Promise<Publicador | null>;
  create(data: Partial<Publicador>): Promise<Publicador>;
  update(id: number, data: Partial<Publicador>): Promise<Publicador>;
  delete(id: number): Promise<void>;
  checkUsuarioVinculado(id: number): Promise<UsuarioVinculado>;
  deleteWithOpcion(id: number, opcion: DeleteOpcion, id_nuevo_publicador?: number): Promise<void>;
  exportExcel?(params?: PublicadorListParams): Promise<Blob | string>;
  exportPdf?(params?: PublicadorListParams): Promise<Blob | string>;
  // Consentimiento PDF
  uploadConsentimientoPdf(id: number, file: File): Promise<Publicador>;
  downloadConsentimientoPdf(id: number): Promise<Blob>;
  deleteConsentimientoPdf(id: number): Promise<Publicador>;
}
