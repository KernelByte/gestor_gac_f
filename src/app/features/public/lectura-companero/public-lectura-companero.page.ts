import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ThemeService } from '../../../core/services/theme.service';

type Plataforma = 'android' | 'ios' | 'otro';

interface InvitacionLecturaPublica {
  estado: 'valida' | 'no_encontrada';
  nombre_publicador: string | null;
  codigo: string | null;
  deep_link: string | null;
  play_store_url: string;
  app_store_url: string;
}

/**
 * Landing del enlace de "Compañeros de lectura".
 *
 * Misma mecánica que la invitación de acceso (`public-invitacion.page.ts`):
 * se abre desde WhatsApp en el teléfono, intenta abrir la app y, si no está,
 * ofrece la tienda. Diferencias: el código es permanente (sin "un solo uso" ni
 * vencimiento) y no hay sesión que canjear: la app pregunta y vincula.
 * Los estilos son los de aquella página a propósito, para que se lea como la
 * misma familia de pantallas.
 */
@Component({
  standalone: true,
  selector: 'app-public-lectura-companero',
  imports: [CommonModule],
  template: `
<div class="lienzo min-h-dvh flex flex-col">

  <header class="filo-inf">
    <div class="mx-auto w-full max-w-md md:max-w-4xl px-5 md:px-8 h-14 md:h-16 flex items-center gap-2.5">
      <img src="images/logo-gac-96.webp" class="w-6 h-6 object-contain" alt="" width="24" height="24" />
      <span class="text-[13px] font-semibold tinta tracking-tight">Sistema GAC</span>
    </div>
  </header>

  <main class="flex-1 w-full max-w-md md:max-w-4xl mx-auto px-5 md:px-8 pb-[max(2.5rem,env(safe-area-inset-bottom))]">

    @if (cargando()) {
      <div class="pt-12 md:pt-16 max-w-md" aria-hidden="true">
        <div class="sk h-6 w-32 rounded-full"></div>
        <div class="sk mt-4 h-9 w-56 rounded-lg"></div>
        <div class="sk mt-5 h-4 w-full rounded"></div>
        <div class="sk mt-8 h-[3.25rem] w-full rounded-2xl"></div>
      </div>
      <p class="sr-only" role="status">Comprobando tu enlace</p>
    }

    @if (!cargando() && esValida()) {
      <div class="pt-12 md:pt-20 md:grid md:grid-cols-[minmax(0,1fr)_21rem] md:gap-x-16 md:items-start">

        <section class="reveal" style="--i:0">
          <p class="etiqueta etiqueta--marca">Lectura de la Biblia</p>

          <h1 class="mt-4 font-display text-[clamp(1.75rem,6vw,2.25rem)] leading-[1.08] font-extrabold tracking-[-0.03em] titulo">
            {{ data()!.nombre_publicador }} te invita a leer la Biblia juntos
          </h1>

          <p class="mt-4 text-[16px] leading-[1.6] cuerpo max-w-[42ch]">
            {{ esMovil()
                ? 'Al abrir la app te preguntará si quieres vincularte. Así podrán ver el progreso de lectura el uno del otro.'
                : 'Este enlace solo abre la app desde un teléfono. Ábrelo allí, o escribe el código en la app: Lectura de la Biblia, Compañeros.' }}
          </p>

          @if (esMovil()) {
            <button type="button" (click)="abrirApp()" class="btn btn--marca mt-8 w-full md:max-w-xs">
              Abrir la app
              <svg class="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6.5 18.5 12 13 17.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>

            @if (mostrarInstalar()) {
              <p class="aviso mt-3.5 md:max-w-xs" role="status">
                <span>No se abrió nada: parece que aún no tienes la app. Instálala aquí abajo y vuelve a tocar este enlace.</span>
              </p>
            } @else {
              <p class="mt-3.5 md:max-w-xs text-center text-[13px] apagado">
                Si aún no la tienes, te lleva a la tienda. Después de instalarla, vuelve a tocar este enlace.
              </p>
            }
          } @else {
            <button type="button" (click)="abrirApp()" class="btn btn--sobrio mt-8 md:max-w-xs">
              Intentar abrirla igualmente
            </button>
          }
        </section>

        <div class="flex flex-col mt-14 md:mt-1.5 gap-11 md:gap-10">
          <section class="order-2 md:order-1 reveal" style="--i:2">
            <h2 class="rotulo">Vincular a mano</h2>
            <p class="mt-3 text-[14px] leading-[1.55] cuerpo max-w-[42ch]">
              En la app abre <b class="fuerte">Lectura de la Biblia</b>, luego <b class="fuerte">Compañeros</b>, y escribe este código. Toca para copiarlo.
            </p>
            <div class="mt-4 grid gap-2">
              <button type="button" (click)="copiar(data()!.codigo)" class="tarjeta codigo" aria-label="Copiar código">
                <span class="flex-1 min-w-0">
                  <span class="rotulo block">Código</span>
                  <span class="valor">{{ data()!.codigo }}</span>
                </span>
                <ng-container *ngTemplateOutlet="marcaCopia; context: { $implicit: copiado() }"></ng-container>
              </button>
            </div>
          </section>

          <section class="order-1 md:order-2 reveal" style="--i:1">
            <ng-container *ngTemplateOutlet="instalar"></ng-container>
          </section>
        </div>
      </div>
    }

    @if (!cargando() && !esValida()) {
      <div class="pt-12 md:pt-20 md:grid md:grid-cols-[minmax(0,1fr)_21rem] md:gap-x-16 md:items-start">
        <section class="reveal" style="--i:0">
          <p class="etiqueta etiqueta--aviso">Enlace no válido</p>
          <h1 class="mt-4 font-display text-[clamp(1.75rem,6vw,2.25rem)] leading-[1.08] font-extrabold tracking-[-0.03em] titulo">
            No encontramos esta invitación
          </h1>
          <p class="mt-4 text-[16px] leading-[1.6] cuerpo max-w-[42ch]">
            Puede que el enlace se haya cortado al copiarlo o que tu compañero haya generado un código nuevo. Pídele que te vuelva a compartir su invitación desde la app.
          </p>
        </section>
        <section class="mt-14 md:mt-1.5 reveal" style="--i:1">
          <ng-container *ngTemplateOutlet="instalar"></ng-container>
        </section>
      </div>
    }
  </main>
</div>

<!-- ── Bloques reutilizados por los dos estados de la página ─────────────── -->

<ng-template #instalar>
  <h2 class="rotulo">Instalar la app</h2>

  <div class="mt-4 grid gap-2">
    <a [href]="playStoreUrl()" target="_blank" rel="noopener" class="tarjeta tienda">
      <span class="glifo glifo--play">
        <svg class="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z"/></svg>
      </span>
      <span class="flex-1 min-w-0">
        <span class="block text-[15px] font-semibold tinta">Google Play</span>
        <span class="block text-[12.5px] apagado">Android</span>
      </span>
      @if (plataforma() === 'android') { <span class="sello">Tu teléfono</span> }
      <svg class="flecha" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>

    @if (data()?.app_store_url) {
      <a [href]="data()!.app_store_url" target="_blank" rel="noopener" class="tarjeta tienda">
        <span class="glifo glifo--apple">
          <svg class="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.2.9-1.2 1.3-2.5 1.3-2.5s-2.5-1-2.5-3.6ZM14.2 5.9c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3Z"/></svg>
        </span>
        <span class="flex-1 min-w-0">
          <span class="block text-[15px] font-semibold tinta">App Store</span>
          <span class="block text-[12.5px] apagado">iPhone y iPad</span>
        </span>
        @if (plataforma() === 'ios') { <span class="sello">Tu teléfono</span> }
        <svg class="flecha" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </a>
    } @else {
      <div class="tarjeta tienda tienda--inerte">
        <span class="glifo glifo--inerte">
          <svg class="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M16.4 12.8c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .8 1.1 1.7 2.3 2.9 2.2 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.2.9-1.2 1.3-2.5 1.3-2.5s-2.5-1-2.5-3.6ZM14.2 5.9c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3Z"/></svg>
        </span>
        <span class="flex-1 min-w-0">
          <span class="block text-[15px] font-semibold apagado">App Store</span>
          <span class="block text-[12.5px] apagado">iPhone y iPad</span>
        </span>
        <span class="rotulo">Pronto</span>
      </div>
    }
  </div>
</ng-template>

<!-- Indicador de copia: el mismo en los dos códigos -->
<ng-template #marcaCopia let-activo>
  <span class="marca" [class.marca--hecho]="activo">
    @if (activo) {
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 5 5L19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Copiado
    } @else {
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M15 6.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h.5" stroke-linecap="round"/></svg>
      Copiar
    }
  </span>
</ng-template>
  `,
  styles: [`
    /* ── Tokens ──────────────────────────────────────────────────────────
       Naranja de marca (--color-brand-orange en styles.scss, el mismo tono
       del módulo "Publicadores" en el sidebar del panel). Neutros tintados
       hacia ese matiz cálido: el fondo y la tinta comparten hue con el
       acento, que es lo que hace que la pantalla se lea como una sola pieza
       y no como color pegado encima.

       El relleno del botón necesita su propio tono por tema: #f97316 puro
       con texto blanco da 2.9:1 (falla AA), así que en claro se profundiza a
       ~#c2410c y en oscuro se aclara con texto oscuro encima — el mismo
       patrón que ya usa la pantalla de administración de accesos. */
    :host {
      display: block;

      --marca:        oklch(58%   0.190 45);   /* ~#e2530f, texto AA sobre blanco */
      --marca-viva:   oklch(63%   0.190 45);
      --marca-tenue:  oklch(58%   0.190 45 / 0.10);
      --marca-texto:  #fff;

      --lienzo:   oklch(98.6% 0.006 60);
      --papel:    oklch(99.6% 0.003 60);
      --filo:     oklch(91.5% 0.010 55);
      --filo-vivo:oklch(86%   0.014 55);

      --titulo:   oklch(24%   0.020 55);
      --tinta:    oklch(36%   0.017 55);
      --cuerpo:   oklch(48%   0.014 55);
      --apagado:  oklch(61%   0.012 55);

      --exito:    oklch(52%   0.130 158);
      --exito-bg: oklch(52%   0.130 158 / 0.12);
      --aviso:    oklch(52%   0.130  70);
      --aviso-bg: oklch(52%   0.130  70 / 0.11);
      --play:     oklch(52%   0.130 158);
      --apple:    oklch(48%   0.170 262);
    }

    :host-context(.dark) {
      --marca:        oklch(73%   0.170 55);   /* ~#fb923c */
      --marca-viva:   oklch(78%   0.160 55);
      --marca-tenue:  oklch(73%   0.170 55 / 0.16);
      --marca-texto:  oklch(24% 0.06 45);       /* ~#431407, AA sobre naranja claro */

      --lienzo:   oklch(16.5% 0.014 55);
      --papel:    oklch(20.5% 0.016 55);
      --filo:     oklch(29%   0.018 55);
      --filo-vivo:oklch(37%   0.022 55);

      --titulo:   oklch(97%   0.008 60);
      --tinta:    oklch(88%   0.012 60);
      --cuerpo:   oklch(73%   0.014 60);
      --apagado:  oklch(59%   0.015 60);

      --exito:    oklch(78%   0.150 158);
      --exito-bg: oklch(78%   0.150 158 / 0.15);
      --aviso:    oklch(80%   0.140  75);
      --aviso-bg: oklch(80%   0.140  75 / 0.13);
      --play:     oklch(76%   0.150 158);
      --apple:    oklch(74%   0.130 262);
    }

    .lienzo   { background: var(--lienzo); color: var(--cuerpo); }
    .titulo   { color: var(--titulo); }
    .tinta    { color: var(--tinta); }
    .cuerpo   { color: var(--cuerpo); }
    .apagado  { color: var(--apagado); }
    .tenue    { color: var(--filo-vivo); }
    .fuerte   { color: var(--titulo); font-weight: 700; }
    .filo-inf { border-bottom: 1px solid var(--filo); }
    .filo-sup { border-top: 1px solid var(--filo); }

    /* ── Tipografía de servicio ──────────────────────────────────────── */
    .rotulo {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--apagado);
    }

    .valor {
      display: block;
      margin-top: 0.25rem;
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 1.25rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.06em;
      color: var(--titulo);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .etiqueta {
      display: inline-flex; align-items: center; gap: 0.375rem;
      height: 1.5rem; padding: 0 0.625rem;
      border-radius: 9999px;
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.09em;
    }
    .etiqueta--marca { background: var(--marca-tenue); color: var(--marca); }
    .etiqueta--aviso { background: var(--aviso-bg);    color: var(--aviso); padding-left: 0.5rem; }

    /* ── Botones ─────────────────────────────────────────────────────── */
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
      width: 100%;
      min-height: 3.25rem;          /* 52px: pulgar cómodo, sin parecer banner */
      border-radius: 1rem;
      font-size: 15px; font-weight: 700; letter-spacing: -0.01em;
      transition: transform 130ms cubic-bezier(0.16,1,0.3,1),
                  background-color 160ms ease, border-color 160ms ease;
    }
    .btn:active { transform: scale(0.985); }

    .btn--marca  { background: var(--marca); color: var(--marca-texto); }
    .btn--marca:hover { background: var(--marca-viva); }

    /* En escritorio abrir la app casi nunca funciona: el botón existe, pero no
       compite con los códigos, que sí sirven ahí. */
    .btn--sobrio {
      background: transparent;
      color: var(--tinta);
      border: 1px solid var(--filo-vivo);
    }
    .btn--sobrio:hover { border-color: var(--marca); color: var(--marca); }

    /* ── Superficies ─────────────────────────────────────────────────── */
    .tarjeta {
      display: flex; align-items: center; gap: 0.875rem;
      width: 100%;
      min-height: 3.5rem;           /* 56px de objetivo táctil */
      padding: 0.75rem 0.875rem;
      text-align: left;
      border-radius: 1rem;
      background: var(--papel);
      border: 1px solid var(--filo);
      transition: border-color 180ms ease, background-color 180ms ease,
                  transform 130ms cubic-bezier(0.16,1,0.3,1);
    }
    .codigo { padding: 0.875rem 0.875rem 0.875rem 1rem; }
    .tarjeta:hover { border-color: var(--filo-vivo); }
    .tarjeta:active { transform: scale(0.99); }
    .tienda--inerte, .tienda--inerte:hover, .tienda--inerte:active {
      background: transparent; border-color: var(--filo); transform: none;
    }

    /* Glifo de tienda: cuadro tintado, no un icono suelto sobre el fondo. */
    .glifo {
      width: 2.25rem; height: 2.25rem; flex-shrink: 0;
      display: inline-flex; align-items: center; justify-content: center;
      border-radius: 0.7rem;
    }
    .glifo--play   { background: color-mix(in oklch, var(--play)  14%, transparent); color: var(--play); }
    .glifo--apple  { background: color-mix(in oklch, var(--apple) 13%, transparent); color: var(--apple); }
    .glifo--inerte { background: color-mix(in oklch, var(--apagado) 12%, transparent); color: var(--apagado); }

    .flecha {
      width: 1rem; height: 1rem; flex-shrink: 0;
      color: var(--filo-vivo);
      transition: color 180ms ease, transform 180ms cubic-bezier(0.16,1,0.3,1);
    }
    .tarjeta:hover .flecha { color: var(--marca); transform: translateX(2px); }

    /* "Tu teléfono": la única señal de marca fuera del CTA, y solo cuando
       la detección de plataforma aporta algo. */
    .sello {
      flex-shrink: 0;
      display: inline-flex; align-items: center;
      height: 1.375rem; padding: 0 0.5rem;
      border-radius: 9999px;
      background: var(--marca-tenue); color: var(--marca);
      font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.07em;
      white-space: nowrap;
    }

    /* ── Copiar / copiado ────────────────────────────────────────────── */
    .marca {
      flex-shrink: 0;
      display: inline-flex; align-items: center; gap: 0.375rem;
      height: 2rem; padding: 0 0.625rem;
      border-radius: 0.625rem;
      font-size: 12.5px; font-weight: 700;
      color: var(--apagado);
      transition: background-color 150ms ease, color 150ms ease;
    }
    .codigo:hover .marca { background: color-mix(in oklch, var(--apagado) 12%, transparent); color: var(--tinta); }
    .marca--hecho,
    .codigo:hover .marca--hecho { background: var(--exito-bg); color: var(--exito); }

    /* ── Aviso ───────────────────────────────────────────────────────── */
    .aviso {
      display: flex; align-items: flex-start; gap: 0.5rem;
      padding: 0.625rem 0.875rem;
      border-radius: 0.875rem;
      background: var(--aviso-bg); color: var(--aviso);
      font-size: 13px; line-height: 1.45;
      animation: subir 300ms cubic-bezier(0.16,1,0.3,1) both;
    }

    /* ── Movimiento ──────────────────────────────────────────────────── */
    .reveal {
      opacity: 0;
      transform: translateY(10px);
      animation: subir 460ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
      animation-delay: calc(var(--i, 0) * 70ms);
    }
    @keyframes subir { to { opacity: 1; transform: none; } }

    .sk {
      background: linear-gradient(90deg,
        color-mix(in oklch, var(--apagado) 14%, transparent) 25%,
        color-mix(in oklch, var(--apagado) 24%, transparent) 37%,
        color-mix(in oklch, var(--apagado) 14%, transparent) 63%);
      background-size: 400% 100%;
      animation: brillo 1.4s ease infinite;
    }
    @keyframes brillo { 0% { background-position: 100% 50%; } 100% { background-position: 0 50%; } }

    /* Foco visible y consistente en todo lo interactivo. */
    a:focus-visible, button:focus-visible {
      outline: 2px solid var(--marca);
      outline-offset: 3px;
      border-radius: 1rem;
    }

    /* Puntero fino: los hover cuentan. Táctil: no existen, así que el estado
       de reposo ya tiene que ser legible por sí solo (y lo es). */
    @media (hover: none) {
      .tarjeta:hover { border-color: var(--filo); }
      .tarjeta:hover .flecha { color: var(--filo-vivo); transform: none; }
      .codigo:hover .marca { background: transparent; color: var(--apagado); }
      .codigo:hover .marca--hecho { background: var(--exito-bg); color: var(--exito); }
    }

    @media (prefers-reduced-motion: reduce) {
      .reveal, .aviso { animation: none; opacity: 1; transform: none; }
      .sk { animation: none; }
      .btn:active, .tarjeta:active { transform: none; }
      .tarjeta:hover .flecha { transform: none; }
    }
  `],
})
export class PublicLecturaCompaneroPage implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  /** Se inyecta para que la página pública también respete el tema guardado. */
  theme = inject(ThemeService);

  data = signal<InvitacionLecturaPublica | null>(null);
  cargando = signal(true);
  copiado = signal(false);
  /** Se enciende cuando el intento de abrir la app no cambió de aplicación. */
  mostrarInstalar = signal(false);
  plataforma = signal<Plataforma>('otro');

  esValida = computed(() => this.data()?.estado === 'valida');
  esMovil = computed(() => this.plataforma() !== 'otro');
  playStoreUrl = computed(() => this.data()?.play_store_url || '');

  ngOnInit(): void {
    const codigo = this.route.snapshot.params['codigo'] ?? '';
    this.plataforma.set(this.detectarPlataforma());

    this.http
      .get<InvitacionLecturaPublica>(`${environment.apiUrl}/lectura-biblia/public/${encodeURIComponent(codigo)}`)
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.cargando.set(false);
          if (d.estado === 'valida' && this.plataforma() === 'android') this.abrirApp();
        },
        error: () => {
          // Un código muerto responde 200; llegar aquí es red o un 429. Se
          // pinta como "no válido" para que la página siga ofreciendo la tienda.
          this.data.set({
            estado: 'no_encontrada', nombre_publicador: null, codigo: null, deep_link: null,
            play_store_url: 'https://play.google.com/store/apps/details?id=com.gestorgac.mobile',
            app_store_url: '',
          });
          this.cargando.set(false);
        },
      });
  }

  private detectarPlataforma(): Plataforma {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    return 'otro';
  }

  abrirApp(): void {
    const deepLink = this.data()?.deep_link;
    if (!deepLink) return;
    // Nunca navegar a esquemas ejecutables si el enlace llegara alterado.
    if (/^\s*(javascript|data|vbscript|file|blob):/i.test(deepLink)) return;

    if (this.plataforma() === 'android') {
      // intent:// con browser_fallback_url: Chrome abre la app si está y, si
      // no, va solo a Play Store.
      const fallback = encodeURIComponent(this.playStoreUrl());
      const [scheme, ruta] = deepLink.split('://');
      window.location.href =
        `intent://${ruta}#Intent;scheme=${scheme};package=com.gestorgac.mobile;` +
        `S.browser_fallback_url=${fallback};end`;
      return;
    }

    window.location.href = deepLink;
    setTimeout(() => {
      if (document.visibilityState === 'visible') this.mostrarInstalar.set(true);
    }, 1200);
  }

  async copiar(valor: string | null | undefined): Promise<void> {
    if (!valor) return;
    try {
      await navigator.clipboard.writeText(valor);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = valor;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* sin nada más que hacer */ }
      document.body.removeChild(ta);
    }
    this.copiado.set(true);
    setTimeout(() => this.copiado.set(false), 1800);
  }
}
