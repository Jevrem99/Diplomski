import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error';

@Injectable({ providedIn: 'root' })
export class ToastService {
  showToast = signal(false);
  message = signal('');
  type = signal<ToastType>('success');

  show(msg: string, t: ToastType = 'success') {
    this.message.set(msg);
    this.type.set(t);
    this.showToast.set(true);
    
    setTimeout(() => {
      this.showToast.set(false);
    }, 3000);
  }
}