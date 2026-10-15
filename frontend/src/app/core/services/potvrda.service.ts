import { inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogComponent, PotvrdaPodaci } from '../../shared/components/confirm-dialog/confirm-dialog.component';

// Zamena za confirm() i alert(): isti izgled kao ostatak aplikacije, radi i u tamnoj temi
@Injectable({ providedIn: 'root' })
export class PotvrdaService {
  private dialog = inject(MatDialog);

  // Pitanje sa dva dugmeta; vraća true samo ako je korisnik potvrdio (Esc / klik pored = false)
  async pitaj(podaci: PotvrdaPodaci): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialogComponent, PotvrdaPodaci, boolean>(ConfirmDialogComponent, {
      data: podaci,
      width: '440px',
      maxWidth: '92vw',
      autoFocus: 'first-tabbable',
      panelClass: 'potvrda-panel'
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }

  // Obaveštenje sa jednim dugmetom (umesto alert())
  async obavesti(poruka: string, naslov = 'Obaveštenje'): Promise<void> {
    await this.pitaj({ naslov, poruka, odustani: null, potvrdi: 'U redu' });
  }
}
