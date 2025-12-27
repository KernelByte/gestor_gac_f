import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.page.html'
})
export class LoginPage implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = signal(false);
  error = signal<string | null>(null);
  showPassword = signal(false);

  form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
    remember: [false]
  });

  private readonly EMAIL_KEY = 'app_login_email_v1';
  private readonly EMAIL_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

  ngOnInit(): void {
    // load saved email if present and not expired
    const raw = localStorage.getItem(this.EMAIL_KEY);
    if (raw) {
      try {
        const obj = JSON.parse(raw);
        if (obj?.email && obj?.ts && (Date.now() - obj.ts) <= this.EMAIL_TTL_MS) {
          this.form.patchValue({ username: obj.email, remember: true });
        } else {
          localStorage.removeItem(this.EMAIL_KEY);
        }
      } catch (e) {
        localStorage.removeItem(this.EMAIL_KEY);
      }
    }
  }

  onSubmit() {
    if (this.form.invalid) return;
    this.loading.set(true); this.error.set(null);

    const { username, password, remember } = this.form.getRawValue() as { username: string; password: string; remember: boolean };

    this.auth.login({ username, password }).subscribe({
      next: () => {
        // store or remove email according to remember
        try {
          if (remember) {
            localStorage.setItem(this.EMAIL_KEY, JSON.stringify({ email: username, ts: Date.now() }));
          } else {
            localStorage.removeItem(this.EMAIL_KEY);
          }
        } catch { }

        this.auth.me().subscribe({
          next: () => { this.loading.set(false); this.router.navigateByUrl('/'); },
          error: () => { this.loading.set(false); this.router.navigateByUrl('/'); }
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'No se pudo iniciar sesión');
      }
    });
  }
}
