import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Grupo } from '../models/grupo.model';

@Injectable({
   providedIn: 'root'
})
export class GruposService {
   private http = inject(HttpClient);
   private readonly API_URL = '/api/grupos/';

   getGrupos(params?: any): Observable<Grupo[]> {
      return this.http.get<Grupo[]>(this.API_URL, { params });
   }

   getGrupo(id: number): Observable<Grupo> {
      return this.http.get<Grupo>(`${this.API_URL}${id}`);
   }

   createGrupo(grupo: Partial<Grupo>): Observable<Grupo> {
      return this.http.post<Grupo>(this.API_URL, grupo);
   }

   updateGrupo(id: number, grupo: Partial<Grupo>): Observable<Grupo> {
      return this.http.put<Grupo>(`${this.API_URL}${id}`, grupo);
   }

   deleteGrupo(id: number): Observable<void> {
      return this.http.delete<void>(`${this.API_URL}${id}`);
   }
}
