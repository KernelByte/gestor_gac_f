import { RouterLink } from '@angular/router';
import {
  ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, effect, inject, signal, viewChild,
} from '@angular/core';
import { AuthStore } from '../../core/auth/auth.store';
import { CongregacionContextService } from '../../core/congregacion-context/congregacion-context.service';
import { AvisoCambioHorarioComponent } from '../configuracion/aviso-cambio-horario.component';
import { REDUCED_MOTION } from './dashboard-charts';
import {
  PANELES, VISTAS, VistaDashboard, guardarVista, leerVistaGuardada, puedeElegirVista, resolverVista,
} from './dashboard-vista';
import { MedirDirective } from './medir.directive';
import { MiSemanaStore } from './mi-semana.store';
import { recurso } from './recurso';
import { DashboardService, horaLegible } from './services/dashboard.service';
import { MiSemanaComponent } from './components/mi-semana.component';
import { SemanaTimelineComponent } from './components/semana-timeline.component';
import { PanelComponent } from './components/panel.component';
import { VistaSecretarioComponent } from './components/vista-secretario.component';
import { VistaCoordinadorComponent } from './components/vista-coordinador.component';
import { VistaSuperintendenteComponent } from './components/vista-superintendente.component';
import { VistaGeneralComponent } from './components/vista-general.component';

/**
 * Dashboard por rol que cabe entero en la pantalla, sin scroll:
 *  · ancho      → mosaico de 3 columnas («Mi semana» a la izquierda, la pieza del rol al centro)
 *  · mediano    → 2 × 2
 *  · teléfono o pantalla baja → un panel a la vez; se desliza o se elige en las pestañas
 * Los paneles miden su espacio y muestran solo lo que cabe.
 */
@Component({
  standalone: true,
  imports: [
    AvisoCambioHorarioComponent, MiSemanaComponent, SemanaTimelineComponent, PanelComponent,
    VistaSecretarioComponent, VistaCoordinadorComponent, VistaSuperintendenteComponent, VistaGeneralComponent,
    MedirDirective, RouterLink,
  ],
  providers: [MiSemanaStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.sin-movimiento]': 'sinMovimiento', '[class.oculto]': 'segundoPlano()', '(document:visibilitychange)': 'alCambiarVisibilidad()' },
  template: `
  <div class="dash">
    <header class="hero">
      <div class="hero-txt">
        <p class="h-fecha">{{ fecha }}@if (pertenencia()) {<span aria-hidden="true"> · </span>{{ pertenencia() }}}</p>
        <h1>{{ saludo }}, {{ nombre() }}</h1>
        @if (fichas().length) {
          <ul class="fichas" aria-label="Lo más próximo">
            @for (f of fichas(); track f.texto; let i = $index) {
              <li class="fh" [attr.data-t]="f.tono" [style.--i]="i">
                <i aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    @switch (f.tono) {
                      @case ('reunion') { <rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/> }
                      @case ('asignacion') { <circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/> }
                      @default { <path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 13h5M10 17h5"/> }
                    }
                  </svg>
                </i>
                @if (f.tono === 'reunion' || f.tono === 'asignacion') {
                  <a class="fh-t fh-a" routerLink="/reuniones/resumen" [attr.aria-label]="f.texto + ': ver el detalle'">{{ f.texto.split(' · ')[0] }}</a>
                } @else {
                  <span class="fh-t">{{ f.texto.split(' · ')[0] }}</span>
                }
                @if (f.texto.includes(' · ')) { <span class="fh-d">{{ f.texto.split(' · ')[1] }}</span> }
              </li>
            }
          </ul>
        } @else {
          <p class="resumen">Esto es lo que viene para ti y tu congregación.</p>
        }
      </div>
      <div class="hero-lado">
        @if (puedeElegir) {
          <div class="selector" role="radiogroup" aria-label="Ver el panel como">
            @for (v of vistas; track v.id) {
              <button type="button" role="radio" [attr.aria-checked]="vista() === v.id" (click)="elegir(v.id)">{{ v.etiqueta }}</button>
            }
          </div>
        }
        <app-semana-timeline />
      </div>
    </header>

    @if (puedeEditarConfiguracion()) { <app-aviso-cambio-horario /> }

    <div class="area" #area [class.sin-a]="!tienePublicador()" (scroll)="alDesplazar()" (medir)="sincronizarCarrusel()"
      [attr.aria-label]="'Panel de ' + tituloVista()" role="region">
      @if (tienePublicador()) { <app-mi-semana /> }
      @if (congregacion(); as c) {
        <!-- La clave recrea la vista al cambiar de congregación en el selector del Administrador -->
        @for (k of [c]; track k) {
          <!-- Cada vista se descarga solo cuando se muestra: quien entra como publicador no baja la del secretario ni su gráfico -->
          @switch (vista()) {
            @case ('secretario') { @defer (on immediate) { <app-vista-secretario /> } }
            @case ('coordinador') { @defer (on immediate) { <app-vista-coordinador /> } }
            @case ('superintendente') { @defer (on immediate) { <app-vista-superintendente /> } }
            @default { @defer (on immediate) { <app-vista-general /> } }
          }
        }
      } @else {
        <app-panel titulo="Elige una congregación" icono="programa" color="gris" area="b"
          vacio="Como administrador no perteneces a una congregación. Elígela en el selector del menú lateral para ver aquí sus informes, programa y territorios." />
      }
    </div>

    <!-- Solo en modo carrusel (teléfono o pantalla baja) -->
    <nav class="tabs" aria-label="Paneles" [style.--n]="pestanas().length">
      <span class="tab-ind" aria-hidden="true" [style.transform]="'translateX(' + activo() * 100 + '%)'"></span>
      @for (p of pestanas(); track p; let i = $index) {
        <button type="button" [attr.aria-current]="activo() === i ? 'true' : null" (click)="irA(i)">{{ p }}</button>
      }
    </nav>
  </div>
  `,
  styles: [`
    /* El shell da a la ruta un contenedor con scroll; aquí no se usa: todo cabe. */
    :host { display: flex !important; flex-direction: column; overflow: hidden !important; min-height: 0; }

    .dash { container: dash / size; flex: 1; min-height: 0; display: flex; flex-direction: column; gap: clamp(0.625rem, 1.6cqh, 1rem);
      width: 100%; max-width: 132rem; margin: 0 auto; }

    /* ── Encabezado ── */
    .hero { position: relative; isolation: isolate; overflow: hidden;
      flex-shrink: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 0.75rem 2.5rem; align-items: center;
      padding: clamp(0.875rem, 2.2cqh, 1.5rem) clamp(1rem, 2.5cqw, 2rem); border-radius: 0.875rem; color: white;
      background:
        radial-gradient(120% 140% at 100% 0%, rgb(167 139 250 / 0.2) 0%, transparent 55%),
        linear-gradient(125deg, #4c1d95 0%, #5b21b6 45%, #7c3aed 100%);
      box-shadow: none;
      animation: entra 520ms cubic-bezier(0.22, 1, 0.36, 1) both; }
    /* Brillo que deriva muy despacio al abrir y luego se queda quieto (solo transform; no gasta batería en reposo) */
    .hero::before { content: ''; position: absolute; z-index: -1; width: 70%; aspect-ratio: 1; right: -12%; top: -70%;
      border-radius: 999px; background: radial-gradient(closest-side, rgb(196 181 253 / 0.22), transparent 72%);
      animation: deriva 16s ease-in-out 2 alternate both; pointer-events: none; }
    @keyframes deriva { from { transform: translate3d(0, 0, 0) scale(1); } to { transform: translate3d(-18%, 22%, 0) scale(1.15); } }
    :host(.sin-movimiento) .hero::before { animation: none; }
    /* Pestaña en segundo plano: no se pinta nada que nadie ve */
    :host(.oculto) .hero::before { animation-play-state: paused; }

    /* Lo más próximo, en fichas cortas en vez de un párrafo */
    .fichas { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-top: 0.625rem; }
    .fh { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.1875rem 0.75rem 0.1875rem 0.1875rem;
      border-radius: 0.625rem; font-size: 0.75rem; font-weight: 600; color: white; white-space: nowrap;
      background: rgb(255 255 255 / 0.12);
      animation: fh-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(var(--i) * 80ms + 200ms); }
    .fh i { display: grid; place-items: center; width: 1.375rem; height: 1.375rem; border-radius: 0.4375rem; flex-shrink: 0;
      background: rgb(255 255 255 / 0.18); color: white; }
    .fh { position: relative; }
    .fh-a { color: inherit; text-decoration: none; }
    .fh-a::after { content: ''; position: absolute; inset: 0; border-radius: inherit; }
    .fh:has(.fh-a):hover { background: rgb(255 255 255 / 0.22); }
    .fh-a:focus-visible::after { outline: 2px solid white; outline-offset: 1px; }
    .fh i svg { width: 0.8125rem; height: 0.8125rem; }
    .fh-d { padding-left: 0.5rem; border-left: 1px solid rgb(255 255 255 / 0.28); font-weight: 500; font-variant-numeric: tabular-nums;
      color: white; }
    .fh[data-t="asignacion"] i { background: rgb(252 211 77 / 0.9); color: #78350f; }
    .fh[data-t="informe"] i { background: rgb(253 164 175 / 0.95); color: #881337; }
    .fh[data-t="alerta"] { background: rgb(253 164 175 / 0.22); }
    .fh[data-t="alerta"] i { background: rgb(253 164 175 / 0.95); color: #881337; }
    @keyframes fh-in { from { opacity: 0; transform: translateX(-8px) scale(0.96); } }
    :host(.sin-movimiento) .fh { animation: none; }
    @container dash (min-width: 46rem) { .hero { grid-template-columns: minmax(0, 0.9fr) minmax(21rem, 1.1fr); } }
    .hero-txt { min-width: 0; }
    .h-fecha { font-size: 0.8125rem; font-weight: 600; color: white; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .h-fecha::first-letter { text-transform: uppercase; }
    h1 { margin-top: 0.25rem; font-family: var(--font-display, 'Urbanist', sans-serif); font-weight: 700;
      font-size: clamp(1.25rem, 2.5cqw, 1.75rem); line-height: 1.15; letter-spacing: -0.02em;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .resumen { margin-top: 0.375rem; font-size: 0.9375rem; line-height: 1.45; color: rgb(245 243 255); max-width: 60ch;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .hero-lado { min-width: 0; display: flex; flex-direction: column; gap: 0.625rem; }

    .selector { display: flex; gap: 0.25rem; padding: 0.25rem; border-radius: 0.75rem; align-self: flex-end;
      background: rgb(30 10 80 / 0.3); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.14); max-width: 100%; overflow-x: auto; scrollbar-width: none; }
    .selector button { flex-shrink: 0; min-height: 1.75rem; padding: 0.3125rem 0.75rem; border-radius: 0.5rem; font-size: 0.75rem; font-weight: 600;
      color: rgb(237 233 254); transition: background-color 160ms ease, color 160ms ease; }
    .selector button[aria-checked="true"] { background: white; color: #5b21b6; }
    .selector button:focus-visible { outline: 2px solid white; outline-offset: 1px; }
    @media (pointer: coarse) { .selector button { min-height: 2.75rem; padding-inline: 1rem; } }
    @media (hover: hover) and (pointer: fine) { .selector button[aria-checked="false"]:hover { background: rgb(255 255 255 / 0.14); } }

    /* Pantallas bajas: el encabezado se reduce a saludo + semana */
    @container dash (max-height: 40rem) { .resumen { -webkit-line-clamp: 1; } .fichas { margin-top: 0.375rem; } }
    @container dash (max-height: 32rem) { .h-fecha, .resumen, .fichas { display: none; } .hero { padding-block: 0.625rem; } }

    /* ── Área de paneles: llena el resto del alto ── */
    .area { flex: 1; min-height: 0; display: grid; gap: clamp(0.625rem, 1.4cqw, 1rem);
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-areas: "a b" "c d"; }
    .area.sin-a { grid-template-areas: "b c" "b d"; }
    @container dash (min-width: 52rem) {
      .area { grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.15fr) minmax(0, 1.1fr); grid-template-areas: "a b c" "a b d"; }
      .area.sin-a { grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr); grid-template-areas: "b c" "b d"; }
    }

    /* Teléfono o pantalla baja: un panel a la vez, deslizable */
    .tabs { display: none; }
    @container dash ((max-width: 40rem) or (max-height: 30rem)) {
      .area { display: flex; overflow-x: auto; overflow-y: hidden; scroll-snap-type: x mandatory; gap: 0;
        overscroll-behavior-x: contain; scrollbar-width: none; scroll-behavior: smooth; }
      .area::-webkit-scrollbar { display: none; }
      .tabs { position: relative; flex-shrink: 0; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr));
        padding: 0.25rem; border-radius: 0.875rem; background: var(--color-gray-100, #f3f4f6); }
      .tabs button { position: relative; z-index: 1; min-height: 2.75rem; padding: 0 0.25rem; border-radius: 0.625rem;
        font-size: 0.8125rem; font-weight: 600; color: var(--color-gray-500, #6b7280); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        transition: color 200ms ease; }
      .tabs button[aria-current="true"] { color: #5b21b6; }
      .tabs button:focus-visible { outline: 2px solid #8b5cf6; outline-offset: -2px; }
      .tab-ind { position: absolute; top: 0.25rem; bottom: 0.25rem; left: 0.25rem; width: calc((100% - 0.5rem) / var(--n));
        border-radius: 0.625rem; background: white; box-shadow: 0 1px 3px rgb(15 23 42 / 0.12);
        transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1); }
      :host-context(.dark) .tabs { background: rgb(30 41 59 / 0.9); }
      :host-context(.dark) .tabs button { color: var(--color-slate-400, #94a3b8); }
      :host-context(.dark) .tabs button[aria-current="true"] { color: white; }
      :host-context(.dark) .tab-ind { background: var(--color-brand-purple); box-shadow: none; }
    }

    @keyframes entra { from { opacity: 0; transform: translateY(8px); } }
    :host(.sin-movimiento) .hero { animation: none; }
  `],
})
export class HomePage implements OnInit {
  private auth = inject(AuthStore);
  private semana = inject(MiSemanaStore);
  private dash = inject(DashboardService);
  private ctx = inject(CongregacionContextService);
  private area = viewChild<ElementRef<HTMLElement>>('area');

  readonly sinMovimiento = REDUCED_MOTION;
  readonly vistas = VISTAS;
  readonly puedeElegir = puedeElegirVista(this.auth);
  readonly vista = signal<VistaDashboard>(resolverVista(this.auth, leerVistaGuardada()));
  readonly tituloVista = computed(() => VISTAS.find(v => v.id === this.vista())?.etiqueta ?? '');
  readonly congregacion = computed(() => this.ctx.effectiveCongregacionId());
  /** El Administrador no tiene publicador: no hay reunión, informe ni asignaciones propias. */
  readonly tienePublicador = computed(() => !!this.auth.user()?.id_usuario_publicador);
  readonly pestanas = computed(() => {
    const p = PANELES[this.vista()];
    if (!this.congregacion()) return this.tienePublicador() ? [p[0], 'Congregación'] : ['Congregación'];
    return this.tienePublicador() ? p : p.slice(1);
  });
  readonly activo = signal(0);
  readonly segundoPlano = signal(false);

  constructor() {
    // En carrusel, el panel que no se ve sale del orden de tabulación y del lector de pantalla.
    effect(() => { this.activo(); this.area(); this.sincronizarCarrusel(); });
  }

  readonly saludo = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  })();
  readonly fecha = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  readonly nombre = computed(() => {
    const u = this.auth.user();
    return (u?.nombre || u?.username || '').trim().split(/\s+/).slice(0, 2).join(' ') || 'hermano';
  });

  private readonly publicador = recurso(() => this.dash.miPublicador());
  readonly pertenencia = computed(() => {
    const p = this.publicador.datos();
    return [p?.nombre_grupo, p?.nombre_congregacion].filter(Boolean).join(' · ');
  });

  readonly puedeEditarConfiguracion = computed(() =>
    ['Coordinador', 'Secretario'].some(r => this.auth.hasRole(r)) || this.auth.hasPermission('configuracion.editar'));

  /** Lo más próximo en fichas cortas: la reunión, mis asignaciones y el informe si apremia. */
  readonly fichas = computed(() => {
    const out: { texto: string; tono: 'reunion' | 'asignacion' | 'informe' | 'alerta' }[] = [];
    const r = this.semana.proxima();
    if (r?.fecha) {
      const d = r.dias_restantes ?? null;
      const cuando = d === 0 ? 'hoy' : d === 1 ? 'mañana'
        : new Date(`${r.fecha}T00:00:00`).toLocaleDateString('es-ES', { weekday: 'long' });
      const hora = horaLegible(r.hora);
      out.push({ texto: `Reunión ${cuando}${hora ? ' · ' + hora : ''}`, tono: 'reunion' });
      const mias = this.semana.misAsignaciones().filter(a => a.fecha === r.fecha).length;
      if (mias) out.push({ texto: mias === 1 ? 'Tienes una asignación' : `Tienes ${mias} asignaciones`, tono: 'asignacion' });
    }
    const i = this.semana.informe.datos();
    const pd = this.semana.plazoDias();
    if (i && !i.enviado) {
      if (pd < 0) out.push({ texto: 'Informe atrasado', tono: 'alerta' });
      else if (pd <= 7) out.push({ texto: pd === 0 ? 'Informe · vence hoy' : pd === 1 ? 'Informe · vence mañana' : `Informe · faltan ${pd} días`, tono: pd <= 1 ? 'alerta' : 'informe' });
    }
    return out;
  });

  ngOnInit() {
    if (!this.tienePublicador()) return;
    this.semana.iniciar();
    this.publicador.cargar();
  }

  elegir(v: VistaDashboard) {
    this.vista.set(v);
    guardarVista(v);
    this.irA(0);
  }

  alCambiarVisibilidad() { this.segundoPlano.set(document.hidden); }

  sincronizarCarrusel() {
    const el = this.area()?.nativeElement;
    if (!el) return;
    const carrusel = getComputedStyle(el).display === 'flex';
    const todos = Array.from(el.querySelectorAll<HTMLElement>('[data-panel]'));
    let i = 0;
    for (const p of todos) {
      const visible = getComputedStyle(p).display !== 'none';
      p.inert = carrusel && visible && i !== this.activo();
      if (visible) i++;
    }
  }

  alDesplazar() {
    const el = this.area()?.nativeElement;
    if (!el || !el.clientWidth) return;
    this.activo.set(Math.round(el.scrollLeft / el.clientWidth));
  }

  irA(i: number) {
    this.activo.set(i);
    const el = this.area()?.nativeElement;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
  }
}
