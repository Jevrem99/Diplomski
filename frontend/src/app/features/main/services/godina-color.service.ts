import { Injectable } from '@angular/core';

const KLJUC = 'app_godina_colors'; // isti ključ koristi stranica Podešavanja
const PODRAZUMEVANA_BOJA = '#009bd9';

// Boje po godini studija (kartice termina, banka predmeta). Korisnik ih menja u Podešavanjima.
@Injectable({ providedIn: 'root' })
export class GodinaColorService {
  readonly podrazumevane: Record<number, string> = {
    1: '#009bd9',
    2: '#d81b43',
    3: '#f39c12',
    4: '#27AE60'
  };
  private boje: Record<number, string> = { ...this.podrazumevane };

  getGodinaColor(godina?: number | string): string {
    if (!godina) return PODRAZUMEVANA_BOJA;
    return this.boje[Number(godina)] || PODRAZUMEVANA_BOJA;
  }

  ucitajSacuvane(): void {
    const sacuvano = localStorage.getItem(KLJUC);
    if (!sacuvano) return;
    try {
      this.boje = { ...this.podrazumevane, ...JSON.parse(sacuvano) };
    } catch {
      this.boje = { ...this.podrazumevane };
    }
  }
}
