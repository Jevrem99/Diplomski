import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class ToastService {
  showToast = signal(false);
  message = signal('');
  type = signal<ToastType>('success');
  // Opciona akcija u poruci (npr. "Poništi"); ostaje duže da stigne da se klikne
  action = signal<{ label: string; fn: () => void } | null>(null);
  private tajmer: any;

  show(msg: string, t: ToastType = 'success', akcija?: { label: string; fn: () => void }) {
    this.message.set(msg);
    this.type.set(t);
    this.action.set(akcija ?? null);
    this.showToast.set(true);

    clearTimeout(this.tajmer);
    this.tajmer = setTimeout(() => {
      this.showToast.set(false);
      this.action.set(null);
    }, akcija ? 7000 : Math.min(3000 + msg.length * 50, 10000)); // duža poruka ostaje duže
  }

  pokreniAkciju() {
    const a = this.action();
    this.showToast.set(false);
    this.action.set(null);
    a?.fn();
  }
}