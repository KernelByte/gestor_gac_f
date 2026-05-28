import { Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

const PALETTE = [
  { bg: 'bg-violet-100', fg: 'text-violet-700' },
  { bg: 'bg-orange-100', fg: 'text-orange-700' },
  { bg: 'bg-green-100', fg: 'text-green-700' },
  { bg: 'bg-blue-100', fg: 'text-blue-700' },
  { bg: 'bg-pink-100', fg: 'text-pink-700' },
  { bg: 'bg-amber-100', fg: 'text-amber-700' },
  { bg: 'bg-teal-100', fg: 'text-teal-700' },
  { bg: 'bg-indigo-100', fg: 'text-indigo-700' },
];

function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="rounded-full flex items-center justify-center shrink-0 font-semibold select-none"
      [class.w-7]="size === 'xs'" [class.h-7]="size === 'xs'" [class.text-[10px]]="size === 'xs'"
      [class.w-9]="size === 'sm'" [class.h-9]="size === 'sm'" [class.text-xs]="size === 'sm'"
      [class.w-11]="size === 'md'" [class.h-11]="size === 'md'" [class.text-sm]="size === 'md'"
      [class.w-14]="size === 'lg'" [class.h-14]="size === 'lg'" [class.text-base]="size === 'lg'"
      [ngClass]="colors().bg + ' ' + colors().fg"
      [attr.title]="name"
    >
      {{ initials() }}
    </div>
  `,
})
export class AvatarComponent {
  @Input({ required: true }) set name(v: string) { this._name.set(v ?? ''); }
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'sm';

  private _name = signal('');
  get name(): string { return this._name(); }

  initials = computed(() => {
    const parts = this._name().trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  });

  colors = computed(() => PALETTE[hash(this._name()) % PALETTE.length]);
}
