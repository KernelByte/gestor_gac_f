import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthStore } from '../../core/auth/auth.store';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perfil.page.html'
})
export class PerfilPage implements OnInit {
  private store = inject(AuthStore);
  private http = inject(HttpClient);

  user = this.store.user; // Signal from the store
  publicadorData = signal<any>(null);
  loading = signal(false);

  ngOnInit() {
    const usr = this.user();
    if (usr?.id_usuario_publicador) {
      this.fetchPublicadorInfo(usr.id_usuario_publicador);
    }
  }

  fetchPublicadorInfo(id: number | string) {
    this.loading.set(true);
    this.http.get(`/api/publicadores/${id}`).subscribe({
      next: (data) => {
        this.publicadorData.set(data);
        this.loading.set(false);
      },
      error: () => {
        // Fallback gracefully on error
        this.loading.set(false);
      }
    });
  }

  getInitials(): string {
    const usr = this.user();
    if (!usr) return 'U';
    const name = usr.nombre || usr.username;
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
}
