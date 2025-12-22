import { inject, signal, effect, Injectable } from '@angular/core';
import { Publicador } from '../domain/models/publicador';
import { PUBLICADOR_REPO } from './tokens';
import type { PublicadorListParams } from '../domain/ports/publicador-repo';
import { loadPublicadores } from '../domain/use-cases/load-publicadores';

export type VM = {
  list: Publicador[];
  loading: boolean;
  error?: string | null;
  params: PublicadorListParams;
};

@Injectable()
export class PublicadoresFacade {
  private repo = inject(PUBLICADOR_REPO);
  vm = signal<VM>({ list: [], loading: false, error: null, params: { limit: 10, offset: 0 } });

  constructor() {
    // effect reservado si se necesita
    effect(() => { });
  }

  async load(params?: PublicadorListParams) {
    this.vm.update((s: VM) => ({ ...s, loading: true, error: null, params: params ? { ...s.params, ...params } : s.params }));
    try {
      const mergedParams = { ...this.vm().params, ...(params || {}) };
      const list = await loadPublicadores(this.repo, mergedParams);
      this.vm.update((s: VM) => ({ ...s, list, loading: false, params: mergedParams }));
    } catch (err: any) {
      const errorMsg = err?.error?.detail || err?.message || String(err);
      this.vm.update((s: VM) => ({ ...s, loading: false, error: errorMsg }));
    }
  }

  async create(payload: Partial<Publicador>) {
    this.vm.update((s: VM) => ({ ...s, loading: true }));
    try {
      await this.repo.create(payload);
      await this.load();
    } finally {
      this.vm.update((s: VM) => ({ ...s, loading: false }));
    }
  }

  async update(id: number, payload: Partial<Publicador>) {
    this.vm.update((s: VM) => ({ ...s, loading: true }));
    try {
      await this.repo.update(id, payload);
      await this.load();
    } finally {
      this.vm.update((s: VM) => ({ ...s, loading: false }));
    }
  }

  async remove(id: number) {
    this.vm.update((s: VM) => ({ ...s, loading: true }));
    try {
      await this.repo.delete(id);
      await this.load();
    } finally {
      this.vm.update((s: VM) => ({ ...s, loading: false }));
    }
  }

  async exportExcel() {
    return this.repo.exportExcel?.(this.vm().params);
  }

  async exportPdf() {
    return this.repo.exportPdf?.(this.vm().params);
  }
}
