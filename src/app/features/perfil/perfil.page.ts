import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../core/auth/auth.store';
import { etiquetaRol } from '../../core/auth/rol-label';
import { HttpClient } from '@angular/common/http';
import { PerfilDosPasosComponent } from './perfil-dos-pasos.component';
import { PanelComponent } from '../home/components/panel.component';
import { LucideAngularModule } from '../../shared/icons';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, PerfilDosPasosComponent, PanelComponent, LucideAngularModule],
  templateUrl: './perfil.page.html',
  styles: [`
    :host { display: block; }
    .perfil { display: flex; flex-direction: column; gap: 1rem; width: 100%; max-width: 80rem; margin: 0 auto; }

    /* ── Cabecera: el mismo violeta del dashboard ── */
    .hero { position: relative; isolation: isolate; overflow: hidden; flex-shrink: 0; display: flex; align-items: center; gap: 1.125rem;
      padding: clamp(0.875rem, 2.2vh, 1.375rem) clamp(1rem, 2.5vw, 1.75rem); border-radius: 0.875rem; color: white;
      background: radial-gradient(120% 140% at 100% 0%, rgb(167 139 250 / 0.22) 0%, transparent 55%),
                  linear-gradient(125deg, #4c1d95 0%, #5b21b6 45%, #7c3aed 100%); }
    .hero::before { content: ''; position: absolute; z-index: -1; width: 60%; aspect-ratio: 1; right: -10%; top: -90%;
      border-radius: 999px; background: radial-gradient(closest-side, rgb(196 181 253 / 0.22), transparent 72%);
      animation: deriva 16s ease-in-out 2 alternate both; pointer-events: none; }
    @keyframes deriva { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(-18%, 22%, 0) scale(1.15); } }
    .avatar { width: clamp(3.25rem, 8vh, 4.25rem); aspect-ratio: 1; flex-shrink: 0; border-radius: 999px; display: grid; place-items: center;
      font-family: var(--font-display); font-size: clamp(1.125rem, 3vh, 1.5rem); font-weight: 700; color: white;
      background: rgb(255 255 255 / 0.16); box-shadow: inset 0 0 0 1.5px rgb(255 255 255 / 0.38), 0 6px 18px -6px rgb(30 10 80 / 0.55); }
    .hero-txt { min-width: 0; }
    .h-rol { font-size: 0.8125rem; font-weight: 600; color: rgb(237 233 254); }
    .hero h1 { margin-top: 0.125rem; font-family: var(--font-display); font-weight: 700; letter-spacing: -0.02em; line-height: 1.15;
      font-size: clamp(1.25rem, 2.4vw, 1.75rem); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .fichas { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.625rem; }
    .fh { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.1875rem 0.75rem 0.1875rem 0.1875rem; border-radius: 0.625rem;
      font-size: 0.75rem; font-weight: 600; background: rgb(255 255 255 / 0.12); white-space: nowrap;
      animation: fh-in 520ms cubic-bezier(0.22, 1, 0.36, 1) backwards; animation-delay: 220ms; }
    .fh:not(:has(i)) { padding-left: 0.75rem; }
    .fh i { display: grid; place-items: center; width: 1.375rem; height: 1.375rem; border-radius: 0.4375rem; background: rgb(255 255 255 / 0.18); }
    .fh i svg { width: 0.8125rem; height: 0.8125rem; }
    @keyframes fh-in { from { opacity: 0; transform: translateX(-8px) scale(0.96); } }

    /* ── Cuadrícula simétrica 2×2: mismas columnas, mismas filas ── */
    .area { display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr); }
    @media (min-width: 768px) { .area { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (min-width: 1024px) {
      :host { height: 100%; }
      .perfil { height: 100%; min-height: 0; }
      .area { flex: 1; min-height: 0; grid-template-rows: repeat(2, minmax(0, 1fr)); }
    }

    /* ── Filas de datos: etiqueta a la izquierda, valor a la derecha; la altura se adapta al alto de la ventana ── */
    .datos { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; margin: 0 -0.5rem; }
    .dato { flex: 1 1 0; min-height: clamp(2.25rem, 5.2vh, 3rem); display: flex; align-items: center; justify-content: space-between; gap: 1rem;
      min-width: 0; padding: 0 0.5rem; border-radius: 0.625rem; position: relative; transition: background-color 150ms ease; }
    .dato + .dato::before { content: ''; position: absolute; top: 0; left: 0.5rem; right: 0.5rem; height: 1px; background: var(--dash-borde); }
    .dato dt { flex-shrink: 0; font-size: 0.875rem; color: var(--dash-texto-suave); }
    .dato dd { min-width: 0; text-align: right; font-size: 0.875rem; font-weight: 600; color: var(--dash-tesela-fg); }
    .dato dd.vacio { font-weight: 500; color: var(--dash-texto-suave); }
    @media (hover: hover) and (pointer: fine) { .dato:hover { background: var(--dash-hover); } }

    /* PIN */
    .pin-fila { display: inline-flex; align-items: center; gap: 0.25rem; margin-right: -0.5rem; }
    .pin { font-family: var(--font-display); font-size: 1.125rem; font-weight: 700; letter-spacing: 0.2em; }

    /* Chips de estado: los mismos tokens que el dashboard */
    .chip { display: inline-flex; align-items: center; white-space: nowrap; padding: 0.125rem 0.625rem; border-radius: 999px;
      font-size: 0.75rem; font-weight: 600; line-height: 1.25rem; }
    .chip-ok     { background: var(--estado-ok-bg);     color: var(--estado-ok-fg); }
    .chip-neutro { background: var(--estado-neutro-bg); color: var(--estado-neutro-fg); }

    /* Entrada escalonada. Fill "backwards": al terminar no queda transform
       puesto (un transform persistente encierra los modales position:fixed). */
    .entra { animation: perfil-entra 380ms cubic-bezier(0.22, 1, 0.36, 1) backwards; animation-delay: calc(var(--i, 0) * 60ms); }
    @keyframes perfil-entra { from { opacity: 0; transform: translateY(10px); } }
    @media (prefers-reduced-motion: reduce) { .entra, .fh, .hero::before { animation: none; } .dato { transition: none; } }
  `],
})
export class PerfilPage implements OnInit {
  /** Texto visible del rol (el nombre real es un identificador). */
  etiquetaRol = etiquetaRol;

  private store = inject(AuthStore);
  private http = inject(HttpClient);

  user = this.store.user; // Signal from the store
  publicadorData = signal<any>(null);
  loading = signal(false);
  pinVisible = signal(false);

  ngOnInit() {
    const usr = this.user();
    if (usr?.id_usuario_publicador) {
      this.fetchPublicadorInfo(usr.id_usuario_publicador);
    }
  }

  fetchPublicadorInfo(id: number | string) {
    this.loading.set(true);
    this.http.get(`/api/publicadores/${id}`).subscribe({
      next: (data) => {
        this.publicadorData.set(data);
        this.loading.set(false);
      },
      error: () => {
        // Fallback gracefully on error
        this.loading.set(false);
      }
    });
  }

  /** El alias o el nombre según la regla de la congregación; si no hay ficha, el de la cuenta. */
  nombreMostrado(): string {
    const usr = this.user();
    return this.publicadorData()?.nombre_mostrado || usr?.nombre || usr?.username || '';
  }

  nombreGrupo(): string {
    const p = this.publicadorData();
    if (!p) return '';
    return p.nombre_grupo || (p.id_grupo_publicador ? `Grupo ${p.id_grupo_publicador}` : '');
  }

  direccion(p: any): string {
    return [p?.direccion, p?.barrio].filter(Boolean).join(', ');
  }

  /** `ungido` llega como texto («Sí» / «No»), no como booleano. */
  esUngido(): boolean {
    const v = String(this.publicadorData()?.ungido ?? '').trim().toLowerCase();
    return v === 'sí' || v === 'si';
  }

  getInitials(): string {
    const usr = this.user();
    if (!usr) return 'U';
    const name = usr.nombre || usr.username;
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
}
