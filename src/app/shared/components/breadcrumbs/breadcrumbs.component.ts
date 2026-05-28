import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

export interface BreadcrumbItem {
  label: string;
  link?: string | any[];
}

@Component({
  selector: 'app-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  template: `
    <nav class="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      <ol class="flex items-center gap-1.5 flex-wrap">
        <li *ngFor="let item of items; let last = last; let first = first" class="flex items-center gap-1.5">
          <lucide-icon *ngIf="!first" name="chevron-right" [size]="14" class="text-gray-300 dark:text-slate-600"></lucide-icon>
          <a
            *ngIf="!last && item.link; else plain"
            [routerLink]="item.link"
            class="text-gray-500 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition focus-ring rounded px-1 -mx-1"
          >{{ item.label }}</a>
          <ng-template #plain>
            <span
              [class.text-gray-900]="last"
              [class.dark:text-slate-100]="last"
              [class.font-semibold]="last"
              [class.text-gray-500]="!last"
              [class.dark:text-slate-400]="!last"
              aria-current="page"
            >{{ item.label }}</span>
          </ng-template>
        </li>
      </ol>
    </nav>
  `,
})
export class BreadcrumbsComponent {
  @Input() items: BreadcrumbItem[] = [];
}
