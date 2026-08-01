import { AfterViewInit, Directive, ElementRef, HostListener, Input, inject } from '@angular/core';

/**
 * Textarea que crece con su contenido: arranca en `minRows` y se estira hasta
 * `maxRows` (a partir de ahí hace scroll interno).
 *
 * Sirve para campos de texto corto pero variable —un motivo, un asunto, una
 * actividad— donde con un `input` de una línea el usuario no alcanza a releer
 * lo que escribió.
 */
@Directive({
  standalone: true,
  selector: 'textarea[appAutosize]',
})
export class AutosizeTextareaDirective implements AfterViewInit {
  private el: HTMLTextAreaElement = inject(ElementRef).nativeElement;

  @Input() minRows = 2;
  @Input() maxRows = 8;

  ngAfterViewInit() {
    // Tras el primer render: el valor inicial ya está puesto y el elemento
    // tiene ancho, así que el salto de línea es el definitivo.
    setTimeout(() => this.ajustar());
  }

  /** Al cambiar el ancho cambia el punto de corte de las líneas. */
  @HostListener('window:resize')
  @HostListener('input')
  ajustar() {
    const ta = this.el;
    // Un elemento oculto (p. ej. la variante móvil de una fila que ahora se
    // muestra en escritorio) mide 0: guardaríamos una altura falsa. Se
    // recalcula solo cuando vuelva a ser visible.
    if (!ta.offsetParent && ta.offsetHeight === 0) return;

    // `height: auto` en un textarea se resuelve contra el atributo `rows`
    // (2 por defecto), no contra el contenido: sin esto un campo vacío mediría
    // siempre dos líneas y rompería la alineación con los inputs vecinos.
    if (ta.rows !== this.minRows) ta.rows = this.minRows;

    const cs = getComputedStyle(ta);
    const linea = parseFloat(cs.lineHeight) || 20;
    const relleno = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const bordes = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);

    // scrollHeight solo es fiable si antes soltamos la altura fijada.
    ta.style.height = 'auto';
    const contenido = ta.scrollHeight; // incluye el padding, no los bordes
    const alto = Math.min(
      Math.max(contenido, linea * this.minRows + relleno),
      linea * this.maxRows + relleno,
    );
    ta.style.height = `${alto + bordes}px`;
  }
}
