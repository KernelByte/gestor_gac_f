import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Publicador } from '../../domain/models/publicador';
import { PublicadorRepo, PublicadorListParams } from '../../domain/ports/publicador-repo';
import { dtoToModel } from '../mappers/publicador.mapper';

const API_BASE = '/api/publicadores/';

@Injectable()
export class HttpPublicadorRepo implements PublicadorRepo {
  constructor(private http: HttpClient) { }

  async list(params?: PublicadorListParams): Promise<Publicador[]> {
    const qs: any = { ...(params || {}) };
    const dtos = await lastValueFrom(this.http.get<any[]>(API_BASE, { params: qs }));
    return (dtos || []).map(dtoToModel);
  }

  async get(id: number): Promise<Publicador | null> {
    const dto = await lastValueFrom(this.http.get<any>(`${API_BASE}${id}`));
    return dto ? dtoToModel(dto) : null;
  }

  async create(data: Partial<Publicador>): Promise<Publicador> {
    const dto = await lastValueFrom(this.http.post<any>(API_BASE, data));
    return dtoToModel(dto);
  }

  async update(id: number, data: Partial<Publicador>): Promise<Publicador> {
    const dto = await lastValueFrom(this.http.put<any>(`${API_BASE}${id}`, data));
    return dtoToModel(dto);
  }

  async delete(id: number): Promise<void> {
    await lastValueFrom(this.http.delete(`${API_BASE}${id}`));
  }

  async exportExcel(params?: PublicadorListParams): Promise<Blob> {
    return await lastValueFrom(this.http.get(`${API_BASE}export/excel`, { params: { ...(params || {}) }, responseType: 'blob' }));
  }

  async exportPdf(params?: PublicadorListParams): Promise<Blob> {
    return await lastValueFrom(this.http.get(`${API_BASE}export/pdf`, { params: { ...(params || {}) }, responseType: 'blob' }));
  }
}
