import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { Observable, tap, finalize } from 'rxjs';

export interface ProviderConfig {
  api_key: string;
  base_url?: string;
}

export interface ProcessConfig {
  provider: string;
  model: string;
  prompt: string;
  description?: string;
}

export interface AIConfig {
  providers: { [key: string]: ProviderConfig };
  processes: { [key: string]: ProcessConfig };
}

@Injectable({
  providedIn: 'root'
})
export class AIConfigService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/config/ai`;

  config = signal<AIConfig | null>(null);
  loading = signal<boolean>(false);

  getConfig(): Observable<AIConfig> {
    this.loading.set(true);
    return this.http.get<AIConfig>(this.apiUrl).pipe(
      tap(cfg => this.config.set(cfg)),
      finalize(() => this.loading.set(false))
    );
  }

  saveConfig(config: AIConfig): Observable<any> {
    this.loading.set(true);
    return this.http.post(this.apiUrl, config).pipe(
      tap(() => this.config.set(config)),
      finalize(() => this.loading.set(false))
    );
  }
}
