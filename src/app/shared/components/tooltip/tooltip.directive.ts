import { Directive, ElementRef, HostListener, Input, OnDestroy, Renderer2, inject } from '@angular/core';

@Directive({
  selector: '[appTooltip]',
  standalone: true,
})
export class TooltipDirective implements OnDestroy {
  @Input('appTooltip') text: string = '';
  @Input() tooltipPlacement: 'top' | 'bottom' = 'top';
  @Input() tooltipDelay: number = 400;

  private host = inject(ElementRef<HTMLElement>);
  private renderer = inject(Renderer2);
  private el: HTMLElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('mouseenter') @HostListener('focus')
  onShow() {
    if (!this.text || this.el) return;
    this.timer = setTimeout(() => this.create(), this.tooltipDelay);
  }

  @HostListener('mouseleave') @HostListener('blur')
  onHide() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    this.destroy();
  }

  private create() {
    const tip = this.renderer.createElement('div');
    this.renderer.addClass(tip, 'tooltip');
    this.renderer.addClass(tip, this.tooltipPlacement === 'top' ? 'tooltip-top' : 'tooltip-bottom');
    this.renderer.appendChild(tip, this.renderer.createText(this.text));
    this.renderer.appendChild(document.body, tip);

    const rect = this.host.nativeElement.getBoundingClientRect();
    const tipRect = tip.getBoundingClientRect();
    const top = this.tooltipPlacement === 'top'
      ? rect.top - tipRect.height - 8
      : rect.bottom + 8;
    const left = rect.left + (rect.width - tipRect.width) / 2;
    this.renderer.setStyle(tip, 'top', `${top + window.scrollY}px`);
    this.renderer.setStyle(tip, 'left', `${left + window.scrollX}px`);
    this.el = tip;
  }

  private destroy() {
    if (this.el) { this.el.remove(); this.el = null; }
  }

  ngOnDestroy() { this.destroy(); }
}
