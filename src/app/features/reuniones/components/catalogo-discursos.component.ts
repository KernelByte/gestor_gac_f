import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { ToastService } from '../../../shared/components/toast/toast.service';
import { DiscursosService } from '../services/discursos.service';
import { CatalogoDiscurso, CatalogoPublicacion } from '../models/discursos.models';

/**
 * Panel de la pestaña «Catálogo de Discursos» de la configuración de Reuniones.
 *
 * Carga los bosquejos del S-34 desde el archivo .jwpub. El catálogo es global —
 * la misma publicación para todas las congregaciones—, así que la pestaña sólo
 * se muestra al Administrador, igual que Plantillas. Lo
 * que se importa aquí es lo que autocompleta los títulos en la programación de
 * discursos públicos.
 */
@Component({
  selector: 'app-catalogo-discursos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex-1 min-h-0 flex flex-col overflow-y-auto simple-scrollbar animate-fadeIn pb-6">
    <div class="flex items-start justify-between gap-3 mb-4">
      <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
        Bosquejos oficiales del S-34. Una vez cargados, al programar un discurso basta
        con escribir su número o una palabra del título para completarlo.
      </p>
      @if (discursos().length > 0) {
        <button type="button" (click)="confirmandoBorrado.set(true)" [disabled]="subiendo()"
          class="shrink-0 h-9 px-3.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 disabled:opacity-50 transition-[background-color] duration-150 ease-out active:scale-[0.97]">
          Vaciar catálogo
        </button>
      }
    </div>

    <!-- ===== ZONA DE CARGA ===== -->
    <div class="mb-7">
      <div
        class="relative rounded-2xl border-2 border-dashed transition-[border-color,background-color] duration-150 ease-out"
        [class]="arrastrando()
          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
          : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-violet-400'"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)">

        <input #selector type="file" accept=".jwpub" class="hidden" (change)="onFileInput($event)">

        <button type="button" (click)="selector.click()" [disabled]="subiendo()"
          class="w-full flex flex-col items-center justify-center gap-3 px-6 py-10 text-center disabled:cursor-wait">
          <div class="w-14 h-14 rounded-2xl flex items-center justify-center"
            [class]="arrastrando()
              ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-300'
              : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 shadow-sm'">
            <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4"/>
            </svg>
          </div>
          <div>
            <p class="text-sm font-bold text-slate-700 dark:text-slate-200">
              {{ subiendo() ? 'Procesando el archivo…' : 'Arrastra aquí el archivo S-34_S.jwpub' }}
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {{ subiendo() ? 'No cierres esta pantalla.' : 'o haz clic para seleccionarlo. Se descarga desde la Biblioteca en línea.' }}
            </p>
          </div>
        </button>

        @if (subiendo()) {
          <div class="px-6 pb-6">
            <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div class="h-full rounded-full bg-violet-500 transition-[width] duration-200 ease-out"
                [style.width.%]="progreso()"></div>
            </div>
            <p class="mt-2 text-[0.7rem] text-slate-500 dark:text-slate-400 text-center">
              {{ progreso() >= 100 ? 'Leyendo los bosquejos del archivo…' : 'Subiendo… ' + progreso() + '%' }}
            </p>
          </div>
        }
      </div>

      @if (error()) {
        <div class="mt-3 flex items-start gap-2.5 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/50">
          <svg class="w-4 h-4 mt-0.5 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p class="text-xs font-medium text-rose-700 dark:text-rose-300">{{ error() }}</p>
        </div>
      }
    </div>

    <!-- ===== ESTADO ACTUAL ===== -->
    @if (cargando()) {
      <p class="text-sm text-slate-400">Cargando catálogo…</p>
    } @else if (discursos().length === 0) {
      <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-10 text-center">
        <p class="text-sm font-bold text-slate-600 dark:text-slate-400">Todavía no hay catálogo</p>
        <p class="text-xs text-slate-400 mt-1 max-w-md mx-auto">
          Mientras no se cargue el archivo, los títulos de la programación de discursos
          públicos se siguen escribiendo a mano, como hasta ahora.
        </p>
      </div>
    } @else {
      <div class="flex flex-wrap items-center gap-3 mb-4">
        @if (publicacion(); as p) {
          <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
            <span class="shrink-0 px-2 h-6 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[0.65rem] font-black flex items-center">
              {{ p.simbolo ?? 'S-34' }}
            </span>
            <div class="min-w-0">
              <p class="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{{ p.titulo_publicacion ?? 'Bosquejos de discursos públicos' }}</p>
              <p class="text-[0.7rem] text-slate-400">
                {{ discursos().length }} discursos<span *ngIf="p.ano"> · edición {{ p.ano }}</span>
                <span *ngIf="p.importado_en"> · importado el {{ p.importado_en | date:'d MMM y, HH:mm' }}</span>
              </p>
            </div>
          </div>
        }
        <div class="flex-1 min-w-[200px]">
          <input type="text" [ngModel]="filtro()" (ngModelChange)="filtro.set($event)"
            placeholder="Buscar por número o palabra…"
            class="h-10 px-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 transition-[border-color] duration-150 ease-out">
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <div class="max-h-[48vh] overflow-y-auto custom-scrollbar divide-y divide-slate-50 dark:divide-slate-800/60">
          @for (d of filtrados(); track d.numero) {
            <div class="flex items-center gap-3 px-4 py-2.5">
              <span class="shrink-0 min-w-[2.25rem] h-6 px-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[0.65rem] font-black flex items-center justify-center">
                {{ d.numero }}
              </span>
              <span class="flex-1 min-w-0 text-sm text-slate-700 dark:text-slate-200">{{ d.titulo }}</span>
            </div>
          } @empty {
            <div class="px-4 py-8 text-center">
              <p class="text-sm text-slate-400">Ningún discurso coincide con «{{ filtro() }}».</p>
            </div>
          }
        </div>
      </div>
    }

    </div>

    <!-- ===== CONFIRMAR VACIADO ===== -->
    @if (confirmandoBorrado()) {
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50 backdrop-blur-sm"
        (click)="confirmandoBorrado.set(false)">
        <div class="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm border border-slate-200/60 dark:border-slate-700/60 overflow-hidden"
          (click)="$event.stopPropagation()">
          <div class="px-5 pt-5 pb-3">
            <h3 class="text-base font-black text-slate-800 dark:text-slate-100">Vaciar el catálogo</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
              Se borrarán los {{ discursos().length }} discursos. Los meses ya programados
              conservan sus títulos: sólo dejará de haber sugerencias al escribir.
            </p>
          </div>
          <div class="flex gap-2 px-5 pb-6 sm:pb-5 pt-1">
            <button (click)="confirmandoBorrado.set(false)"
              class="flex-1 h-11 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-[background-color] duration-150 ease-out active:scale-[0.97]">
              Cancelar
            </button>
            <button (click)="vaciar()" [disabled]="borrando()"
              class="flex-1 h-11 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-sm font-bold text-white transition-[background-color] duration-150 ease-out active:scale-[0.97]">
              {{ borrando() ? 'Borrando…' : 'Vaciar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CatalogoDiscursosComponent implements OnInit {
  private svc = inject(DiscursosService);
  private toast = inject(ToastService);

  discursos = signal<CatalogoDiscurso[]>([]);
  publicacion = signal<CatalogoPublicacion | null>(null);
  cargando = signal(true);
  subiendo = signal(false);
  borrando = signal(false);
  confirmandoBorrado = signal(false);
  arrastrando = signal(false);
  progreso = signal(0);
  error = signal<string | null>(null);
  filtro = signal('');

  filtrados = computed(() => {
    const q = this.normalizar(this.filtro().trim());
    if (!q) return this.discursos();
    return this.discursos().filter(d => this.normalizar(`${d.numero}. ${d.titulo}`).includes(q));
  });

  ngOnInit(): void {
    this.recargar();
  }

  private recargar(): void {
    this.cargando.set(true);
    this.svc.invalidarCatalogo();
    this.svc.getCatalogo().subscribe({
      next: (r) => {
        this.discursos.set(r.discursos ?? []);
        this.publicacion.set(r.publicacion);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No se pudo leer el catálogo actual.');
      },
    });
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────────
  onDragOver(ev: DragEvent): void {
    ev.preventDefault();
    if (!this.subiendo()) this.arrastrando.set(true);
  }

  onDragLeave(ev: DragEvent): void {
    ev.preventDefault();
    this.arrastrando.set(false);
  }

  onDrop(ev: DragEvent): void {
    ev.preventDefault();
    this.arrastrando.set(false);
    const file = ev.dataTransfer?.files?.[0];
    if (file) this.subir(file);
  }

  onFileInput(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    // Se limpia para que volver a elegir el mismo archivo dispare otro change.
    input.value = '';
    if (file) this.subir(file);
  }

  private subir(file: File): void {
    if (this.subiendo()) return;
    this.error.set(null);

    if (!file.name.toLowerCase().endsWith('.jwpub')) {
      this.error.set('El archivo debe ser un .jwpub (el que se descarga de la Biblioteca en línea).');
      return;
    }

    this.subiendo.set(true);
    this.progreso.set(0);

    this.svc.importarCatalogo(file).subscribe({
      next: (ev) => {
        if (ev.type === HttpEventType.UploadProgress && ev.total) {
          this.progreso.set(Math.round((ev.loaded / ev.total) * 100));
        } else if (ev.type === HttpEventType.Response) {
          const r = ev.body;
          this.subiendo.set(false);
          this.progreso.set(0);
          this.discursos.set(r?.discursos ?? []);
          this.publicacion.set(r?.publicacion ?? null);
          this.svc.invalidarCatalogo();
          const nuevos = r?.insertados ?? 0;
          const detalle = nuevos > 0
            ? `${nuevos} nuevos y ${r?.actualizados ?? 0} actualizados.`
            : `${r?.actualizados ?? 0} discursos actualizados.`;
          this.toast.success(`${r?.total ?? 0} discursos importados`, detalle);
        }
      },
      error: (e: HttpErrorResponse) => {
        this.subiendo.set(false);
        this.progreso.set(0);
        this.error.set(
          e.status === 413
            ? 'El archivo es demasiado grande para el servidor.'
            : (e?.error?.detail ?? 'No se pudo importar el archivo.')
        );
      },
    });
  }

  vaciar(): void {
    this.borrando.set(true);
    this.svc.borrarCatalogo().subscribe({
      next: (r) => {
        this.borrando.set(false);
        this.confirmandoBorrado.set(false);
        this.discursos.set([]);
        this.publicacion.set(null);
        this.svc.invalidarCatalogo();
        this.toast.success('Catálogo vaciado', `Se borraron ${r.borrados} discursos.`);
      },
      error: (e: HttpErrorResponse) => {
        this.borrando.set(false);
        this.error.set(e?.error?.detail ?? 'No se pudo vaciar el catálogo.');
      },
    });
  }

  private normalizar(s: string): string {
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019\u201c\u201d]/g, '"')
      .toLowerCase();
  }
}
