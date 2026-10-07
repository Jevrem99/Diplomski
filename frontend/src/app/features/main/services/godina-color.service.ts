import { Injectable } from '@angular/core';

const KLJUC = 'app_godina_colors'; // isti ključ koristi stranica Podešavanja
const PODRAZUMEVANA_BOJA = '#8EA9DB';
const VERZIJA_KLJUC = 'app_godina_colors_v';
const VERZIJA = '2'; // v2: boje iz Excel izvoza; starije sačuvane boje se odbacuju jednom

// Boje po godini studija (kartice termina, banka predmeta). Korisnik ih menja u Podešavanjima.
@Injectable({ providedIn: 'root' })
export class GodinaColorService {
  // Iste boje kao u Excel izvozu kolokvijuma (excel-izvoz.service.ts)
  readonly podrazumevane: Record<number, string> = {
    1: '#8EA9DB',
    2: '#F4B183',
    3: '#FFD966',
    4: '#A9D18E',
    5: '#00B0F0'
  };
  private boje: Record<number, string> = { ...this.podrazumevane };

  getGodinaColor(godina?: number | string): string {
    if (!godina) return PODRAZUMEVANA_BOJA;
    return this.boje[Number(godina)] || PODRAZUMEVANA_BOJA;
  }

  ucitajSacuvane(): void {
    if (localStorage.getItem(VERZIJA_KLJUC) !== VERZIJA) {
      localStorage.removeItem(KLJUC);
      localStorage.setItem(VERZIJA_KLJUC, VERZIJA);
    }
    const sacuvano = localStorage.getItem(KLJUC);
    if (!sacuvano) return;
    try {
      this.boje = { ...this.podrazumevane, ...JSON.parse(sacuvano) };
    } catch {
      this.boje = { ...this.podrazumevane };
    }
  }
}
