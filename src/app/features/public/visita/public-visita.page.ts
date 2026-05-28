import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

interface ArchivoPublico { nombre: string; url: string; tamano_bytes: number; }
interface VistaPublica {
  nombre_congregacion?: string | null;
  fecha_inicio: string;
  fecha_fin?: string | null;
  nombre_superintendente?: string | null;
  archivos: ArchivoPublico[];
  expira_en: string;
}

@Component({
  standalone: true,
  selector: 'app-public-visita',
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50 dark:from-slate-950 dark:to-slate-900 p-6">
      <div class="max-w-3xl mx-auto py-10">
        <header class="text-center mb-8">
          <img src="images/LogoAppMorado.png" class="w-14 h-14 mx-auto mb-3" />
          <h1 class="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-brand-purple to-purple-700">
            Visita del Superintendente
          </h1>
        </header>

        <div *ngIf="loading()" class="text-center text-slate-500">Cargando documentos…</div>
        <div *ngIf="error()" class="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm text-center">
          {{ error() }}
        </div>

        <div *ngIf="data() as d" class="space-y-6">
          <section class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
            <p class="text-sm text-slate-500 dark:text-slate-400">Congregación</p>
            <p class="text-lg font-semibold text-slate-800 dark:text-slate-100">{{ d.nombre_congregacion || '—' }}</p>
            <div class="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <p class="text-slate-500">Fechas</p>
                <p class="font-medium text-slate-700 dark:text-slate-200">{{ d.fecha_inicio }} <span *ngIf="d.fecha_fin">— {{ d.fecha_fin }}</span></p>
              </div>
              <div>
                <p class="text-slate-500">Superintendente</p>
                <p class="font-medium text-slate-700 dark:text-slate-200">{{ d.nombre_superintendente || '—' }}</p>
              </div>
            </div>
            <p class="text-xs text-amber-600 mt-4">Este enlace expira el {{ d.expira_en | date:'medium' }}</p>
          </section>

          <section class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Documentos</h2>
              <button (click)="descargarTodo()" class="text-xs px-3 py-1.5 rounded-lg bg-brand-purple text-white hover:bg-brand-purple/90">
                Descargar todo (.zip)
              </button>
            </div>
            <div class="space-y-2">
              <a *ngFor="let a of d.archivos" [href]="a.url" target="_blank"
                 class="flex items-center justify-between border border-slate-100 dark:border-slate-800 rounded-lg px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <div class="flex items-center gap-3">
                  <span class="text-brand-purple text-xl">📄</span>
                  <span class="text-sm font-medium text-slate-700 dark:text-slate-200">{{ a.nombre }}</span>
                </div>
                <span class="text-xs text-slate-400">{{ (a.tamano_bytes / 1024) | number:'1.0-0' }} KB</span>
              </a>
              <p *ngIf="d.archivos.length === 0" class="text-sm text-slate-400 text-center py-6">
                Aún no hay documentos cargados.
              </p>
            </div>
          </section>

          <p class="text-center text-xs text-slate-400">
            Gracias por su servicio. — Sistema GAC
          </p>
        </div>
      </div>
    </div>
  `,
})
export class PublicVisitaPage implements OnInit {
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  data = signal<VistaPublica | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  token = '';

  ngOnInit() {
    this.token = this.route.snapshot.params['token'];
    this.http.get<VistaPublica>(`${environment.apiUrl}/visita-sc/public/${this.token}`).subscribe({
      next: (d) => { this.data.set(d); this.loading.set(false); },
      error: (e) => {
        this.error.set(e?.error?.detail || 'No se pudo cargar la información.');
        this.loading.set(false);
      },
    });
  }

  descargarTodo() {
    this.http.get(`${environment.apiUrl}/visita-sc/public/${this.token}/zip`, { responseType: 'blob' }).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `visita_circuito.zip`; a.click();
      URL.revokeObjectURL(url);
    });
  }
}
