import { zoomDe } from './zoom';

/**
 * Tooltips de toda la app con un solo diseño.
 *
 * Los `title="…"` de las plantillas siguen escritos igual: al pasar el ratón (o
 * al llegar con el teclado) se cambian por este globo, que sigue el estilo de la
 * app, y al salir el `title` vuelve a su sitio. Así no hay que tocar cada pantalla
 * ni queda ningún tooltip del navegador con otro aspecto.
 *
 * - Es un `popover` manual: va en la capa superior, por encima de modales y menús.
 * - Aparece tras una breve pausa; si acaba de verse otro, el cambio es inmediato.
 * - Crece con el zoom de la sección (2K/4K) y no tapa el elemento: sale debajo y,
 *   si no cabe, encima.
 * - El menú lateral comprimido tiene el suyo (shell.page.ts): se deja en paz.
 */
const PAUSA_MS = 450;
const ENCADENADO_MS = 400;
const SEPARACION = 8;
const MARGEN = 8;
const CONTENEDORES = new Set(['app-modal', 'app-confirm-dialog', 'app-import-publicadores-modal']);

const CSS = `
.gac-tip {
  position: fixed; inset: auto; margin: 0; border: 1px solid transparent;
  max-width: min(22em, calc(100vw - 16px)); width: max-content;
  padding: 0.5em 0.75em; border-radius: 0.625em;
  background: #0f172a; color: #f8fafc;
  font-family: inherit; font-size: 0.8125rem; font-weight: 500; line-height: 1.4; text-align: left;
  text-wrap: pretty; overflow-wrap: anywhere;
  box-shadow: 0 8px 24px -6px rgba(15, 23, 42, 0.35), 0 2px 6px rgba(15, 23, 42, 0.2);
  pointer-events: none; opacity: 0; transform: translateY(0.25em);
  transition: opacity 140ms ease-out, transform 140ms ease-out;
}
.gac-tip[data-arriba] { transform: translateY(-0.25em); }
.gac-tip[data-visible] { opacity: 1; transform: none; }
.gac-tip[data-instantaneo] { transition: none; }
:root.dark .gac-tip { background: #334155; border-color: rgba(148, 163, 184, 0.28); }
@media (prefers-reduced-motion: reduce) { .gac-tip { transition: none; transform: none; } }
@media print { .gac-tip { display: none; } }
`;

export function iniciarTooltips(): void {
  if (typeof document === 'undefined' || typeof matchMedia === 'undefined') return;
  const conRaton = matchMedia('(hover: hover)').matches;

  let globo: HTMLElement | null = null;
  let actual: HTMLElement | null = null;
  let textoOriginal = '';
  let pausa: ReturnType<typeof setTimeout> | undefined;
  let visto = 0; // cuándo se ocultó el último globo

  function crear(): HTMLElement {
    if (globo) return globo;
    const estilo = document.createElement('style');
    estilo.textContent = CSS;
    document.head.appendChild(estilo);
    globo = document.createElement('div');
    globo.id = 'gac-tip';
    globo.className = 'gac-tip';
    globo.setAttribute('role', 'tooltip');
    globo.setAttribute('popover', 'manual');
    document.body.appendChild(globo);
    return globo;
  }

  function devolverTitulo() {
    if (!actual) return;
    // Si Angular puso un título nuevo mientras tanto, ese manda.
    if (!actual.hasAttribute('title') && textoOriginal) actual.setAttribute('title', textoOriginal);
    actual.removeAttribute('data-tip');
    actual.removeAttribute('aria-describedby');
    actual = null;
    textoOriginal = '';
  }

  function ocultar() {
    clearTimeout(pausa);
    if (globo?.matches(':popover-open')) {
      visto = Date.now();
      globo.removeAttribute('data-visible');
      globo.hidePopover();
    }
    devolverTitulo();
  }

  function mostrar(el: HTMLElement, texto: string) {
    const g = crear();
    const z = zoomDe(el);
    const encadenado = Date.now() - visto < ENCADENADO_MS;
    g.textContent = texto;
    g.style.fontSize = `${0.8125 * z}rem`;
    g.toggleAttribute('data-instantaneo', encadenado);
    g.removeAttribute('data-visible');
    g.removeAttribute('data-arriba');
    if (!g.matches(':popover-open')) g.showPopover();

    const r = el.getBoundingClientRect();
    const { width: w, height: h } = g.getBoundingClientRect();
    let arriba = false;
    let top = r.bottom + SEPARACION;
    if (top + h > innerHeight - MARGEN && r.top - SEPARACION - h >= MARGEN) {
      top = r.top - SEPARACION - h;
      arriba = true;
    }
    const left = Math.min(Math.max(MARGEN, r.left + r.width / 2 - w / 2), innerWidth - w - MARGEN);
    g.style.top = `${Math.max(MARGEN, top)}px`;
    g.style.left = `${left}px`;
    g.toggleAttribute('data-arriba', arriba);
    el.setAttribute('aria-describedby', g.id);
    requestAnimationFrame(() => g.setAttribute('data-visible', ''));
  }

  function preparar(el: HTMLElement | null, sinPausa: boolean) {
    if (!el || el === actual) return;
    ocultar();
    const texto = el.getAttribute('title')?.trim();
    if (!texto) return;
    actual = el;
    textoOriginal = el.getAttribute('title') ?? '';
    el.setAttribute('data-tip', texto);
    el.removeAttribute('title');
    const fija = actual;
    if (sinPausa) mostrar(fija, texto);
    else {
      const espera = Date.now() - visto < ENCADENADO_MS ? 0 : PAUSA_MS;
      pausa = setTimeout(() => { if (actual === fija) mostrar(fija, texto); }, espera);
    }
  }

  /** El elemento con título más cercano, salvo el menú lateral (tiene el suyo). */
  function conTitulo(destino: EventTarget | null): HTMLElement | null {
    if (!(destino instanceof Element)) return null;
    // `[data-tip]`: el que ya muestra su globo (se le quitó el title mientras tanto). Sin él, al
    // pasar del botón a su icono se saltaría al título de un elemento exterior.
    const el = destino.closest<HTMLElement>('[title], [data-tip]');
    if (!el || el.closest('aside')) return null;
    // Los diálogos y ventanas reciben su título como `title="…"`, que queda también en su
    // elemento contenedor: no es una ayuda para el cursor.
    // Se le quita también el atributo, o el navegador mostraría su propio globo con ese texto.
    if (CONTENEDORES.has(el.localName)) { el.removeAttribute('title'); return null; }
    return el;
  }

  if (conRaton) {
    document.addEventListener('mouseover', e => preparar(conTitulo(e.target), false));
    document.addEventListener('mouseout', e => {
      if (!actual) return;
      const a = e.relatedTarget;
      if (a instanceof Node && actual.contains(a)) return;
      ocultar();
    });
  }
  // Con el teclado el globo sale al instante.
  document.addEventListener('focusin', e => {
    const el = conTitulo(e.target);
    if (el?.matches(':focus-visible')) preparar(el, true);
  });
  document.addEventListener('focusout', () => ocultar());
  document.addEventListener('pointerdown', () => ocultar(), true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ocultar(); }, true);
  document.addEventListener('scroll', () => ocultar(), true);
  addEventListener('blur', () => ocultar());
}
