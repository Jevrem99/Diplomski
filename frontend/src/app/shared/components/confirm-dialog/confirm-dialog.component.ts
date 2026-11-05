import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

export interface PotvrdaPodaci {
  naslov?: string;
  poruka: string;
  potvrdi?: string;
  odustani?: string | null; // null = samo jedno dugme (obaveštenje)
  opasno?: boolean;
}

// Naš prozor umesto ugrađenih confirm() / alert() prozora pregledača
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <div class="potvrda" role="alertdialog" aria-modal="true">
      <h2 class="potvrda-naslov">{{ data.naslov || 'Potvrda' }}</h2>
      <p class="potvrda-poruka">{{ data.poruka }}</p>
      <div class="potvrda-dugmad">
        @if (data.odustani !== null) {
          <button type="button" class="potvrda-btn potvrda-btn-sek" (click)="zatvori(false)">{{ data.odustani || 'Odustani' }}</button>
        }
        <button type="button" class="potvrda-btn" [class.potvrda-btn-opasno]="data.opasno" (click)="zatvori(true)">{{ data.potvrdi || 'U redu' }}</button>
      </div>
    </div>
  `,
  styles: [`
    .potvrda { padding: 22px 24px 18px; color: var(--text); }
    .potvrda-naslov { margin: 0 0 8px; font-size: 1.05rem; font-weight: 800; color: var(--text); }
    .potvrda-poruka { margin: 0 0 20px; font-size: 0.9rem; line-height: 1.45; color: var(--text-2); white-space: pre-line; }
    .potvrda-dugmad { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
    .potvrda-btn {
      min-width: 92px; height: 38px; padding: 0 16px; border-radius: 8px; border: 1px solid var(--primary);
      background: var(--primary); color: #fff; font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer;
    }
    .potvrda-btn:hover { background: var(--primary-dark); }
    .potvrda-btn-sek { background: var(--surface-2); color: var(--text); border-color: var(--border-strong); }
    .potvrda-btn-sek:hover { background: var(--surface-3); }
    .potvrda-btn-opasno { background: var(--danger-text); border-color: var(--danger-text); }
    .potvrda-btn-opasno:hover { background: var(--danger); }
  `]
})
export class ConfirmDialogComponent {
  constructor(
    private ref: MatDialogRef<ConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: PotvrdaPodaci
  ) {}

  zatvori(vrednost: boolean): void {
    this.ref.close(vrednost);
  }
}
