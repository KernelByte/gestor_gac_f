import { Injectable, signal } from '@angular/core';

export interface DeleteGroupModalState {
  groupName: string;
  isDeleting: boolean;
}

@Injectable({ providedIn: 'root' })
export class ModalBackdropService {
  readonly deleteGroup = signal<DeleteGroupModalState | null>(null);

  private _onConfirm: (() => Promise<void>) | null = null;

  openDeleteGroup(groupName: string, onConfirm: () => Promise<void>) {
    this.deleteGroup.set({ groupName, isDeleting: false });
    this._onConfirm = onConfirm;
  }

  async confirm() {
    const state = this.deleteGroup();
    if (!state || !this._onConfirm) return;
    this.deleteGroup.set({ ...state, isDeleting: true });
    try {
      await this._onConfirm();
    } finally {
      this.close();
    }
  }

  cancel() {
    this.close();
  }

  close() {
    this.deleteGroup.set(null);
    this._onConfirm = null;
  }
}
