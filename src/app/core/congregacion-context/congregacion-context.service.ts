import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AuthStore } from '../auth/auth.store';

const STORAGE_KEY = 'gac_admin_congregacion_id';
const STORAGE_NAME_KEY = 'gac_admin_congregacion_name';

export interface CongregacionItem {
  id_congregacion: number;
  nombre_congregacion: string;
}

@Injectable({ providedIn: 'root' })
export class CongregacionContextService {
  private authStore = inject(AuthStore);
  private http = inject(HttpClient);

  selectedCongregacionId = signal<number | null>(null);
  selectedCongregacionName = signal<string | null>(null);

  effectiveCongregacionId = computed(() => {
    const user = this.authStore.user();
    if (!user) return null;
    const isAdmin = user.rol === 'Administrador' || user.roles?.includes('Administrador');
    if (!isAdmin) return user.id_congregacion ?? null;
    return this.selectedCongregacionId();
  });

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const name = localStorage.getItem(STORAGE_NAME_KEY);
      if (raw !== null) {
        const id = parseInt(raw, 10);
        if (!Number.isNaN(id)) {
          this.selectedCongregacionId.set(id);
          this.selectedCongregacionName.set(name || null);
        }
      }
    } catch {
      // ignore
    }
  }

  setSelected(id: number | null, name: string | null): void {
    this.selectedCongregacionId.set(id);
    this.selectedCongregacionName.set(name);
    try {
      if (id !== null) {
        localStorage.setItem(STORAGE_KEY, String(id));
        localStorage.setItem(STORAGE_NAME_KEY, name ?? '');
      } else {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_NAME_KEY);
      }
    } catch {
      // ignore
    }
  }

  isAdmin(): boolean {
    const user = this.authStore.user();
    if (!user) return false;
    return !!(user.rol === 'Administrador' || user.roles?.includes('Administrador'));
  }

  listCongregaciones() {
    return this.http.get<CongregacionItem[]>('/api/congregaciones/', {
      params: { limit: 500, offset: 0 }
    });
  }
}
