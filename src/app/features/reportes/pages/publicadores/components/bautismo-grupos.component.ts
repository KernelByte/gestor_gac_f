import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { BautismoGrupo } from '../../../services/reportes.service';

/**
 * Reparto de bautizados y no bautizados, grupo por grupo.
 *
 * Es el panel más "de lectura" de la página: la respuesta tiene que caber en
 * una frase y verse sin interpretar ejes ni leyendas de colores. Por eso no es
 * una gráfica sino una lista de dos líneas por grupo — nombre y cifras arriba,
 * proporción abajo — que se lee igual en un móvil de 375 px que en el portátil.
 *
 * El color nunca es el único canal: cada cifra va acompañada de su palabra
 * ("bautizados", "sin bautizar") y el tramo pendiente lleva trama diagonal,
 * así que se distingue también en escala de grises o con daltonismo.
 *
 * Deliberadamente sin semáforo: no estar bautizado todavía no es una alarma,
 * es una etapa. El tramo pendiente es neutro tramado, no rojo.
 *
 * El conmutador de alcance cambia entre la cohorte activa (el mismo alcance
 * que el resto del dashboard) y la foto completa con los inactivos. Los dos
 * repartos vienen ya calculados del backend, así que conmutar es instantáneo
 * y no vuelve a pedir el reporte. El orden se recalcula en cada alcance: un
 * grupo sin pendientes entre los activos puede tenerlos al sumar inactivos.
 */
@Component({
  selector: 'app-bautismo-grupos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  styleUrls: ['../../../shared/reportes-tokens.scss'],
  styles: [`
    :host { display: block; }

    .panel {
      border: 1px solid var(--linea);
      border-radius: 0.75rem;
      background: var(--superficie);
      padding: 1rem 1.125rem 1.125rem;
    }

    .titulo {
      font-size: 0.6875rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--txt-3);
    }
    .apostilla {
      font-size: 0.8125rem;
      line-height: 1.5;
      max-width: 68ch;
      color: var(--txt-1);
      margin-top: 0.125rem;
    }

    .cabecera {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem 1.5rem;
    }

    /* ── Conmutador de alcance ───────────────────────────────────────────
       Dos opciones excluyentes: un par de pestañas en un riel basta y pesa
       menos que un desplegable. La activa se marca con superficie y peso,
       no solo con color, para que se lea sin distinguir tonos. */
    .alcance {
      display: inline-flex;
      flex: none;
      padding: 0.1875rem;
      border: 1px solid var(--linea);
      border-radius: 999px;
      background: var(--superficie-alt);
    }
    .alcance button {
      appearance: none;
      border: 0;
      background: transparent;
      border-radius: 999px;
      padding: 0.3125rem 0.75rem;
      font: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      color: var(--txt-3);
      cursor: pointer;
      white-space: nowrap;
      transition: color 160ms ease, background-color 160ms ease;
    }
    .alcance button:hover { color: var(--txt-1); }
    .alcance button.activo {
      background: var(--superficie);
      color: var(--txt-1);
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
    }
    .alcance button:focus-visible {
      outline: 2px solid var(--acento);
      outline-offset: 1px;
    }
    .alcance button:active { transform: scale(0.97); }

    /* ── Resumen de la congregación ──────────────────────────────────────
       La frase es el titular: quien solo lea esta línea ya tiene la
       respuesta. Las cifras van en la display para que salten sobre el
       texto sin recurrir al color. */
    .resumen {
      margin-top: 1.25rem;
      max-width: 46ch;
      font-size: 0.9375rem;
      /* Interlineado holgado: las cifras van a cuerpo mayor dentro de la
         misma frase y con line-height normal los renglones se pisarían. */
      line-height: 1.85;
      color: var(--txt-2);
    }
    .resumen .dato {
      font-family: var(--font-display);
      font-weight: 800;
      font-size: 1.1875rem;
      letter-spacing: -0.02em;
      font-variant-numeric: tabular-nums;
      color: var(--txt-1);
    }

    /* ── Barras de proporción ────────────────────────────────────────────
       La pista es el tramo pendiente (tramado); el relleno sólido es la
       parte bautizada. Un solo elemento animado por barra: se escala en X
       desde el borde izquierdo, nunca se anima el ancho. */
    .pista {
      position: relative;
      width: 100%;
      border-radius: 999px;
      overflow: hidden;
      background-color: var(--superficie-alt);
      background-image: repeating-linear-gradient(
        -45deg,
        color-mix(in oklch, var(--txt-4) 34%, transparent) 0 1px,
        transparent 1px 6px
      );
      box-shadow: inset 0 0 0 1px var(--linea);
    }
    .pista--resumen { height: 0.875rem; margin-top: 0.75rem; }
    .pista--fila    { height: 0.5rem; }

    .relleno {
      position: absolute;
      inset: 0 auto 0 0;
      border-radius: 999px;
      background: var(--acento);
      transform-origin: left center;
      animation: crecer 620ms cubic-bezier(0.16, 1, 0.3, 1);
      /* backwards, nunca both: con both el transform se queda en la matriz
         identidad y el elemento crea un stacking context permanente. */
      animation-fill-mode: backwards;
    }
    @keyframes crecer {
      from { transform: scaleX(0); }
      to   { transform: scaleX(1); }
    }

    /* ── Leyenda ─────────────────────────────────────────────────────── */
    .leyenda {
      margin-top: 0.75rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem 1.25rem;
      font-size: 0.75rem;
      color: var(--txt-3);
    }
    .leyenda span { display: inline-flex; align-items: center; gap: 0.4375rem; }
    .marca {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 0.25rem;
      flex: none;
    }
    .marca--si { background: var(--acento); }
    .marca--no {
      background-color: var(--superficie-alt);
      background-image: repeating-linear-gradient(
        -45deg,
        color-mix(in oklch, var(--txt-4) 42%, transparent) 0 1px,
        transparent 1px 5px
      );
      box-shadow: inset 0 0 0 1px var(--linea);
    }

    /* ── Filas por grupo ─────────────────────────────────────────────────
       Filete superior en vez de tarjeta anidada: la lista respira sola y no
       mete una caja dentro de otra. */
    .lista { margin-top: 1.5rem; }
    /* En móvil cada grupo ocupa tres renglones apilados: nombre, cifras y
       barra. Nada compite por el ancho y se lee sin entornar los ojos. */
    .fila {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      grid-template-areas:
        "grupo"
        "cifras"
        "barra";
      gap: 0.25rem;
      padding: 0.75rem 0;
      border-top: 1px solid var(--linea-suave);
      animation: entrar 420ms cubic-bezier(0.16, 1, 0.3, 1);
      animation-fill-mode: backwards;
    }
    /* Cascada de entrada por posición: evita bindear una custom property
       desde la plantilla, que Angular no resuelve de forma fiable. */
    .fila:nth-child(1)  { animation-delay: 0ms; }
    .fila:nth-child(2)  { animation-delay: 45ms; }
    .fila:nth-child(3)  { animation-delay: 90ms; }
    .fila:nth-child(4)  { animation-delay: 135ms; }
    .fila:nth-child(5)  { animation-delay: 180ms; }
    .fila:nth-child(6)  { animation-delay: 225ms; }
    .fila:nth-child(7)  { animation-delay: 270ms; }
    .fila:nth-child(8)  { animation-delay: 315ms; }
    .fila:nth-child(n+9) { animation-delay: 360ms; }
    @keyframes entrar {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: none; }
    }

    .grupo {
      grid-area: grupo;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--txt-1);
    }
    .cifras {
      grid-area: cifras;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
      color: var(--txt-3);
      display: inline-flex;
      align-items: baseline;
      gap: 0.5rem;
    }
    .cifras b { font-weight: 600; color: var(--txt-1); }
    .punto { color: var(--txt-4); }
    .completo { color: var(--pos); font-weight: 600; }

    .fila-barra {
      grid-area: barra;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.25rem;
    }
    .fila-barra .pista { flex: 1 1 auto; min-width: 0; }
    .pct {
      flex: none;
      width: 3rem;
      text-align: right;
      font-family: var(--font-mono);
      font-size: 0.75rem;
      font-variant-numeric: tabular-nums;
      color: var(--txt-2);
    }

    .vacio {
      margin-top: 1.5rem;
      padding: 1.5rem 0;
      border-top: 1px solid var(--linea-suave);
      font-size: 0.875rem;
      color: var(--txt-3);
    }

    /* A partir de tablet cada grupo cabe en un solo renglón: nombre, barra y
       cifras en columnas fijas. La barra deja de ocupar todo el ancho, así
       las cifras quedan junto al nombre y el ojo no cruza la pantalla. */
    @media (min-width: 768px) {
      .panel { padding: 1.125rem 1.375rem 1.375rem; }
      .resumen { max-width: none; line-height: 1.7; }
      .resumen .dato { font-size: 1.375rem; }
      .grupo { font-size: 0.9375rem; }
      .cifras { font-size: 0.8125rem; }

      .fila {
        grid-template-columns: minmax(6rem, 10rem) minmax(0, 1fr) auto;
        grid-template-areas: "grupo barra cifras";
        align-items: center;
        gap: 0 1.25rem;
        padding: 0.5625rem 0;
      }
      .fila-barra { margin-top: 0; }
      .cifras { justify-content: flex-end; }
    }

    @media (prefers-reduced-motion: reduce) {
      .relleno, .fila { animation: none; }
    }
  `],
  template: `
    <section class="panel" aria-labelledby="bautismo-grupos-titulo">
      <div class="cabecera">
        <div>
          <h3 class="titulo" id="bautismo-grupos-titulo">Bautizados y no bautizados por grupo</h3>
          <p class="apostilla">
            Cuántos publicadores de cada grupo ya se bautizaron y cuántos todavía no.
            Los grupos con más pendientes aparecen primero.
          </p>
        </div>

        <div class="alcance" role="group" aria-label="A quién contar">
          <button type="button"
                  [class.activo]="!incluirInactivos()"
                  [attr.aria-pressed]="!incluirInactivos()"
                  (click)="incluirInactivos.set(false)">
            Solo activos
          </button>
          <button type="button"
                  [class.activo]="incluirInactivos()"
                  [attr.aria-pressed]="incluirInactivos()"
                  (click)="incluirInactivos.set(true)">
            Con inactivos
          </button>
        </div>
      </div>

      <ng-container *ngIf="filas().length; else vacioTpl">
        <p class="resumen">
          De <span class="dato">{{ total() }}</span>
          {{ incluirInactivos() ? 'publicadores, activos e inactivos,' : 'publicadores activos,' }}
          <span class="dato">{{ bautizados() }}</span> están bautizados
          y <span class="dato">{{ noBautizados() }}</span> todavía no.
        </p>

        <div class="pista pista--resumen"
             role="img"
             [attr.aria-label]="'El ' + pctTotal() + ' por ciento de la congregación está bautizado'">
          <div class="relleno" [style.width.%]="pctTotal()"></div>
        </div>

        <p class="leyenda">
          <span><i class="marca marca--si" aria-hidden="true"></i>Bautizados</span>
          <span><i class="marca marca--no" aria-hidden="true"></i>Todavía no bautizados</span>
        </p>

        <div class="lista">
          <div class="fila" *ngFor="let f of filas()">
            <span class="grupo">{{ f.grupo }}</span>
            <div class="fila-barra">
              <div class="pista pista--fila" aria-hidden="true">
                <div class="relleno" [style.width.%]="f.pct_bautizados"></div>
              </div>
              <span class="pct">{{ f.pct_bautizados | number: '1.0-0' }}%</span>
            </div>
            <span class="cifras">
              <span><b>{{ f.bautizados }}</b> de {{ f.total }} bautizados</span>
              <span class="punto" aria-hidden="true">&middot;</span>
              <span *ngIf="f.no_bautizados; else todosTpl">
                <b>{{ f.no_bautizados }}</b> sin bautizar
              </span>
              <ng-template #todosTpl>
                <span class="completo">todos bautizados</span>
              </ng-template>
            </span>
          </div>
        </div>
      </ng-container>

      <ng-template #vacioTpl>
        <p class="vacio">
          Todavía no hay grupos con publicadores{{ incluirInactivos() ? '' : ' activos' }}.
          En cuanto se asigne a alguien a un grupo, aquí verás el reparto de
          bautizados y no bautizados.
        </p>
      </ng-template>
    </section>
  `,
})
export class BautismoGruposComponent {
  private readonly soloActivos = signal<BautismoGrupo[]>([]);
  private readonly conInactivos = signal<BautismoGrupo[]>([]);

  /** Reparto de la cohorte activa (el mismo alcance que el resto del dashboard). */
  @Input() set datos(v: BautismoGrupo[] | null | undefined) {
    this.soloActivos.set(v ?? []);
  }

  /** Reparto contando además a los inactivos: la foto completa. */
  @Input() set datosConInactivos(v: BautismoGrupo[] | null | undefined) {
    this.conInactivos.set(v ?? []);
  }

  readonly incluirInactivos = signal(false);

  readonly filas = computed(() =>
    this.incluirInactivos() ? this.conInactivos() : this.soloActivos());

  readonly total = computed(() => this.filas().reduce((a, f) => a + f.total, 0));
  readonly bautizados = computed(() => this.filas().reduce((a, f) => a + f.bautizados, 0));
  readonly noBautizados = computed(() => this.total() - this.bautizados());
  readonly pctTotal = computed(() => {
    const t = this.total();
    return t ? Math.round((this.bautizados() / t) * 100) : 0;
  });
}
