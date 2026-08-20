import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

type PasswordStrength = 'weak' | 'medium' | 'strong' | null;

@Component({
  standalone: true,
  selector: 'app-password-strength',
  imports: [CommonModule],
  template: `
    <div *ngIf="password" class="mt-1.5 space-y-1">
      <div class="flex gap-1">
        <div class="h-1 flex-1 rounded-full transition-colors duration-300"
          [ngClass]="strength === 'weak' ? 'bg-red-400' : strength === 'medium' ? 'bg-amber-400' : strength === 'strong' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'"></div>
        <div class="h-1 flex-1 rounded-full transition-colors duration-300"
          [ngClass]="strength === 'medium' ? 'bg-amber-400' : strength === 'strong' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'"></div>
        <div class="h-1 flex-1 rounded-full transition-colors duration-300"
          [ngClass]="strength === 'strong' ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'"></div>
      </div>
      <p class="text-[10px] font-bold ml-0.5 transition-colors"
        [ngClass]="strength === 'weak' ? 'text-red-500' : strength === 'medium' ? 'text-amber-500' : 'text-emerald-500'">
        {{ strength === 'weak' ? 'Contraseña débil' : strength === 'medium' ? 'Contraseña moderada' : 'Contraseña fuerte' }}
      </p>
    </div>
  `
})
export class PasswordStrengthComponent {
  @Input() password = '';

  get strength(): PasswordStrength {
    const pwd = this.password || '';
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;
    if (score <= 1) return 'weak';
    if (score <= 3) return 'medium';
    return 'strong';
  }
}
