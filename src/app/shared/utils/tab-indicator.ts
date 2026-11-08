/**
 * Indicador deslizante de pestañas (global).
 *
 * Toda barra `.tab-nav` / `.segmented` recibe un único <span.tab-indicator> que
 * se desplaza (transform) y se redimensiona hasta la pestaña activa, en vez de
 * que el relleno aparezca y desaparezca en cada botón. Las pantallas no hacen
 * nada: siguen marcando la activa con aria-selected / aria-checked / .is-active /
 * .tab-item-active. Si no hay pestaña activa visible, el indicador se oculta y
 * el CSS vuelve al relleno normal de cada botón.
 */
const PISTAS = '.tab-nav, .segmented';
const ACTIVA = '[aria-selected="true"], [aria-checked="true"], .is-active, .tab-item-active';
const ITEM = '.tab-item, .tab-item-active, .segmented-item';

export function iniciarIndicadorDePestanas(): void {
  if (typeof document === 'undefined' || typeof ResizeObserver === 'undefined') return;

  const ro = new ResizeObserver(entries => entries.forEach(e => colocar(e.target as HTMLElement)));
  const vistas = new WeakSet<HTMLElement>();
  const ultima = new WeakMap<HTMLElement, HTMLElement>();
  /** Última posición por barra (firma = textos de sus pestañas). Si la pantalla se
   *  vuelve a crear al navegar entre rutas, el indicador parte de donde estaba. */
  const recuerdo = new Map<string, { x: number; y: number; w: number; h: number }>();
  const firma = (pista: HTMLElement) =>
    Array.from(pista.querySelectorAll<HTMLElement>(ITEM)).map(el => el.textContent?.trim()).join('|');
  let pendiente = false;

  function colocar(pista: HTMLElement): void {
    let ind = pista.querySelector<HTMLElement>(':scope > .tab-indicator');
    const activa = Array.from(pista.querySelectorAll<HTMLElement>(ACTIVA)).find(
      el => el.matches(ITEM) && el.offsetWidth > 0,
    );
    // classList.add/remove reescriben el atributo `class` aunque no cambie, y el
    // MutationObserver de abajo lo vigila: tocarlo sin necesidad reprograma
    // otra pasada en cada fotograma y satura el hilo principal.
    if (!activa) {
      if (pista.classList.contains('con-indicador')) pista.classList.remove('con-indicador');
      if (ind) ind.style.opacity = '0';
      return;
    }
    if (!ind) {
      ind = document.createElement('span');
      ind.className = 'tab-indicator';
      ind.setAttribute('aria-hidden', 'true');
      pista.prepend(ind);
    }
    const primera = !pista.classList.contains('con-indicador');
    const clave = firma(pista);
    const previo = primera ? recuerdo.get(clave) : undefined;
    const nuevo = { x: activa.offsetLeft, y: activa.offsetTop, w: activa.offsetWidth, h: activa.offsetHeight };
    if (primera) {
      ind.style.transition = 'none';
      // Si la pantalla se volvió a crear al navegar, parte de la posición anterior y
      // desliza hasta la nueva; sin posición previa, aparece ya en su sitio.
      const ini = previo ?? nuevo;
      ind.style.width = ini.w + 'px';
      ind.style.height = ini.h + 'px';
      ind.style.transform = `translate(${ini.x}px, ${ini.y}px)`;
      pista.classList.add('con-indicador');
      // fuerza el cálculo de estilos y devuelve la transición para el movimiento
      void ind.offsetWidth;
      ind.style.transition = '';
    }
    ind.style.opacity = '1';
    ind.style.width = nuevo.w + 'px';
    ind.style.height = nuevo.h + 'px';
    ind.style.transform = `translate(${nuevo.x}px, ${nuevo.y}px)`;
    recuerdo.set(clave, nuevo);
    // con scroll horizontal, lleva la pestaña activa a la vista
    const cambio = ultima.get(pista) !== activa;
    ultima.set(pista, activa);
    if (cambio && !primera && pista.scrollWidth > pista.clientWidth + 1) {
      activa.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }
  }

  function revisar(): void {
    pendiente = false;
    document.querySelectorAll<HTMLElement>(PISTAS).forEach(p => {
      if (!vistas.has(p)) { vistas.add(p); ro.observe(p); }
      colocar(p);
    });
  }

  const programar = () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(revisar);
  };

  new MutationObserver(programar).observe(document.body, {
    subtree: true, childList: true,
    attributes: true, attributeFilter: ['aria-selected', 'aria-checked', 'class'],
  });
  window.addEventListener('resize', programar, { passive: true });
  document.fonts?.ready.then(programar);
  programar();
}
