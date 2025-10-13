import { Publicador } from '../models/publicador';

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
  exportExcel?(params?: PublicadorListParams): Promise<Blob | string>;
  exportPdf?(params?: PublicadorListParams): Promise<Blob | string>;
}
