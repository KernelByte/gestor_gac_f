import { ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, computed, effect, inject, signal, viewChild } from '@angular/core';
import { MarcaSemana, MiSemanaStore, TipoMarca } from '../mi-semana.store';
import { isoLocal } from '../services/dashboard.service';

interface DiaLinea { iso: string; corto: string; largo: string; num: number; hoy: boolean; marcas: MarcaSemana[] }

const ORDEN: TipoMarca[] = ['asignacion', 'informe', 'reunion', 'salida'];

/**
 * Los próximos siete días. Sin leyenda: al apuntar (o enfocar) un día, una ficha
 * se desliza hasta él y la línea de abajo dice qué hay. En «Hoy», una barra fina
 * avanza con la hora.
 */
@Component({
  selector: 'app-semana-timeline',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tl">
      <div class="dias" role="group" aria-label="Tus próximos siete días" (mouseleave)="apuntado.set(null)">
        <span class="ficha" aria-hidden="true" [class.visible]="apuntado() !== null && apuntado() !== 0"
          [style.transform]="'translateX(' + (apuntado() ?? 0) * 100 + '%)'"></span>
        @for (d of dias(); track d.iso; let i = $index) {
          <button type="button" class="dia" [class.hoy]="d.hoy" [class.activo]="foco() === i" [style.--i]="i"
            [attr.aria-label]="d.largo + ': ' + (d.marcas.length ? textoMarcas(d) : 'nada programado')"
            (mouseenter)="apuntado.set(i)" (focus)="apuntado.set(i)" (blur)="apuntado.set(null)" (click)="fijado.set(i)">
            <span class="nom">{{ d.hoy ? 'Hoy' : d.corto }}</span>
            <span class="disco" [class.con]="d.marcas.length" [style.--p]="d.hoy ? avance() : 0"><span class="num">{{ d.num }}</span></span>
            <span class="marcas" aria-hidden="true">
              @for (m of d.marcas.slice(0, 3); track $index; let j = $index) {
                <span class="m" [attr.data-t]="m.tipo" [style.--j]="j"></span>
              }
            </span>
          </button>
        }
      </div>

      <!-- Qué hay el día enfocado: sustituye a la leyenda -->
      <p class="caption" #cap (wheel)="rueda($event)">
        @if (diaFoco(); as d) {
          @for (_ of [d.iso]; track _) {
            <span class="cap-in">
              <b>{{ d.hoy ? 'Hoy' : d.largo }}</b>
              @if (d.marcas.length) {
                @for (m of d.marcas; track $index) {
                  <span class="cap-item"><i class="m" [attr.data-t]="m.tipo"></i>{{ m.texto }}</span>
                }
              } @else {
                <span class="cap-item vacio">Nada programado</span>
              }
            </span>
          }
        }
      </p>
    </div>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .tl { display: flex; flex-direction: column; gap: 0.5rem; }

    .dias { position: relative; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
    /* Ficha que sigue al día apuntado: un solo elemento que se desliza, no 7 hovers */
    .ficha { position: absolute; top: 0; bottom: 0; left: 0; width: calc(100% / 7); border-radius: 0.75rem;
      background: rgb(255 255 255 / 0.12); opacity: 0; pointer-events: none;
      transition: transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease; }
    .ficha.visible { opacity: 1; }

    .dia { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
      padding: 0.5rem 0 0.5rem; border-radius: 0.75rem; color: rgb(245 243 255); cursor: pointer; min-height: 2.75rem;
      -webkit-tap-highlight-color: transparent;
      animation: dia-in 560ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(var(--i) * 45ms + 80ms); }
    .dia:focus-visible { outline: 2px solid white; outline-offset: -2px; }
    .nom { font-size: 0.75rem; font-weight: 600; text-transform: capitalize; letter-spacing: 0.01em; }
    .disco { position: relative; display: grid; place-items: center; width: 2.25rem; aspect-ratio: 1; border-radius: 999px;
      background: rgb(255 255 255 / 0.08); transition: background 240ms ease, transform 240ms cubic-bezier(0.22, 1, 0.36, 1); }
    .disco.con { background: rgb(255 255 255 / 0.18); }
    .dia.activo:not(.hoy) .disco { background: rgb(255 255 255 / 0.28); transform: scale(1.06); }
    .num { font-family: var(--font-display, 'Urbanist', sans-serif); font-size: 1.125rem; font-weight: 700; line-height: 1;
      font-variant-numeric: tabular-nums; color: white; }

    /* Hoy: ficha clara; el aro del número es el avance del día */
    .dia.hoy { background: white; color: var(--color-brand-purple); box-shadow: none; }
    .dia.hoy .disco { background: conic-gradient(var(--color-brand-purple) calc(var(--p) * 360deg), rgb(124 58 237 / 0.16) 0); }
    .dia.hoy .disco::before { content: ''; position: absolute; inset: 3px; border-radius: inherit; background: #f5f3ff; }
    .dia.hoy .num { position: relative; color: #3b0764; }

    .marcas { display: flex; gap: 3px; height: 4px; align-items: center; margin-top: 4px; }
    .marcas .m { width: 0.75rem; height: 4px; }
    .m { display: inline-block; width: 0.4375rem; height: 0.4375rem; border-radius: 999px; flex-shrink: 0; background: white;
      animation: m-in 380ms cubic-bezier(0.22, 1, 0.36, 1) both; animation-delay: calc(var(--i, 0) * 45ms + var(--j, 0) * 70ms + 420ms); }
    .m[data-t="reunion"] { background: rgb(255 255 255 / 0.9); }
    .m[data-t="asignacion"] { background: #fcd34d; }
    .m[data-t="salida"] { background: #86efac; }
    .m[data-t="informe"] { background: #fda4af; }
    .dia.hoy .m[data-t="reunion"] { background: var(--color-brand-purple); }
    .dia.hoy .m[data-t="asignacion"] { background: #f59e0b; }
    .dia.hoy .m[data-t="salida"] { background: #16a34a; }
    .dia.hoy .m[data-t="informe"] { background: #e11d48; }

    .caption { min-height: 1.75rem; display: flex; align-items: center; font-size: 0.8125rem; color: rgb(250 248 255);
      white-space: nowrap; overflow-x: auto; overscroll-behavior-x: contain; scrollbar-width: none;
      padding-right: 2rem; mask-image: linear-gradient(90deg, #000 calc(100% - 2rem), transparent); }
    .caption::-webkit-scrollbar { display: none; }
    .cap-in { display: inline-flex; align-items: center; gap: 0.375rem; animation: cap-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both; }
    .caption b { display: inline-block; font-weight: 700; color: white; margin-right: 0.25rem; }
    .caption b::first-letter { text-transform: uppercase; }
    .cap-item { display: inline-flex; align-items: center; gap: 0.4375rem; padding: 0.1875rem 0.6875rem 0.1875rem 0.5rem;
      border-radius: 999px; background: rgb(255 255 255 / 0.1); }
    .cap-item .m { animation: none; }
    .cap-item.vacio { padding-left: 0.6875rem; }

    @keyframes dia-in { from { opacity: 0; transform: translateY(6px); } }
    @keyframes m-in { from { opacity: 0; transform: scale(0); } }
    @keyframes cap-in { from { opacity: 0; transform: translateY(3px); } }
    @media (prefers-reduced-motion: reduce) {
      .dia, .m, .cap-in { animation: none !important; }
      .ficha, .disco { transition: none; }
    }
  `],
})
export class SemanaTimelineComponent implements OnDestroy {
  private store = inject(MiSemanaStore);
  private ahora = signal(new Date());
  private zone = inject(NgZone);
  /** El temporizador corre fuera de la zona: no despierta a toda la app cada minuto, solo actualiza esta señal. */
  private reloj = this.zone.runOutsideAngular(() => setInterval(() => this.ahora.set(new Date()), 60_000));

  private cap = viewChild<ElementRef<HTMLElement>>('cap');
  private volverAlInicio = effect(() => { this.foco(); const el = this.cap()?.nativeElement; if (el) el.scrollLeft = 0; });

  /** La rueda vertical del ratón recorre la línea de lado a lado. */
  rueda(e: WheelEvent) {
    const el = e.currentTarget as HTMLElement;
    if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    el.scrollLeft += e.deltaY;
  }

  readonly apuntado = signal<number | null>(null);
  readonly fijado = signal<number | null>(null);

  readonly dias = computed<DiaLinea[]>(() => {
    const base = new Date(this.ahora());
    base.setHours(0, 0, 0, 0);
    const porFecha = new Map<string, MarcaSemana[]>();
    for (const m of this.store.marcas()) porFecha.set(m.fecha, [...(porFecha.get(m.fecha) ?? []), m]);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const iso = isoLocal(d);
      return {
        iso,
        corto: d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''),
        largo: d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }),
        num: d.getDate(),
        hoy: i === 0,
        marcas: (porFecha.get(iso) ?? []).sort((a, b) => ORDEN.indexOf(a.tipo) - ORDEN.indexOf(b.tipo)),
      };
    });
  });

  /** Día que describe la línea de abajo: el apuntado, el elegido, o el primero con algo. */
  readonly foco = computed(() => {
    const a = this.apuntado() ?? this.fijado();
    if (a !== null) return a;
    const i = this.dias().findIndex(d => d.marcas.length);
    return i >= 0 ? i : 0;
  });
  readonly diaFoco = computed(() => this.dias()[this.foco()]);

  /** Fracción del día ya transcurrida (0–1). */
  readonly avance = computed(() => {
    const a = this.ahora();
    return (a.getHours() * 60 + a.getMinutes()) / 1440;
  });

  textoMarcas(d: DiaLinea) { return d.marcas.map(m => m.texto).join('; '); }

  ngOnDestroy() { clearInterval(this.reloj); }
}
