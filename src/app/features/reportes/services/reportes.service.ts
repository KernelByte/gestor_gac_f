import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { Observable } from 'rxjs';

export interface KPIItem {
  label: string;
  value: number;
  hint?: string | null;
}

export interface SeriePunto {
  label: string;
  value: number;
}

export interface PrecursoresReporte {
  kpis: KPIItem[];
  distribucion_tipo: SeriePunto[];
  horas_promedio_tipo: SeriePunto[];
  tendencia_activos: SeriePunto[];
}

export interface PublicadoresReporte {
  kpis: KPIItem[];
  distribucion_genero: SeriePunto[];
  distribucion_edad: SeriePunto[];
  distribucion_grupo: SeriePunto[];
}

export interface PredicacionReporte {
  kpis: KPIItem[];
  horas_mensuales: SeriePunto[];
  cursos_mensuales: SeriePunto[];
  horas_por_grupo: SeriePunto[];
}

@Injectable({ providedIn: 'root' })
export class ReportesService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/reportes`;

  getPrecursores(): Observable<PrecursoresReporte> {
    return this.http.get<PrecursoresReporte>(`${this.base}/precursores`);
  }

  getPublicadores(): Observable<PublicadoresReporte> {
    return this.http.get<PublicadoresReporte>(`${this.base}/publicadores`);
  }

  getPredicacion(): Observable<PredicacionReporte> {
    return this.http.get<PredicacionReporte>(`${this.base}/predicacion`);
  }
}
