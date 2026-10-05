import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export type DesignId = 'klasik' | 'panel' | 'minimal' | 'mekano' | 'organski' | 'staklo' | 'kontrast';

export interface DesignInfo {
  id: DesignId;
  naziv: string;
  opis: string;
  skriven?: boolean; // skriven dizajn se ne nudi u izboru (CSS ostaje, ukloni "skriven" da se vrati)
}

const SVI_DIZAJNI: DesignInfo[] = [
  { id: 'klasik', naziv: 'Klasik', opis: 'Trenutni izgled: plava gornja traka, ravne kartice.' },
  { id: 'panel', naziv: 'Panel', skriven: true, opis: 'Bočni meni levo, pregledan i kompaktan raspored; termini kao čipovi sa trakom u boji godine.' },
  { id: 'minimal', naziv: 'Minimal', skriven: true, opis: 'Samo tipografija i tanke linije: bez senki i punih ploča, termini kao tanki redovi.' },
  { id: 'mekano', naziv: 'Mekano', opis: 'Neumorfizam: meke uzdignute i udubljene površine, ćelije kalendara kao udubljenja.' },
  { id: 'organski', naziv: 'Organski', opis: 'Zemljani tonovi, zaobljeni oblici i serifni naslovi; termini kao pastelne pilule.' },
  { id: 'staklo', naziv: 'Staklo', opis: 'Glassmorphism: providne kartice, mutna pozadina, plutajuća traka.' },
  { id: 'kontrast', naziv: 'Kontrast', opis: 'Debele ivice i jake boje: maksimalna čitljivost, kartice sa oštrom senkom.' },
];

export const DESIGNS: DesignInfo[] = SVI_DIZAJNI.filter((d) => !d.skriven);

const KLJUC = 'design';

// Izbor dizajna se pamti u pregledaču (po računaru); tema (svetla/tamna) je nezavisna od dizajna.
@Injectable({ providedIn: 'root' })
export class DesignService {
  private router = inject(Router);

  design = signal<DesignId>('klasik');

  constructor() {
    try {
      const sacuvan = localStorage.getItem(KLJUC) as DesignId | null;
      if (sacuvan && DESIGNS.some((d) => d.id === sacuvan)) this.design.set(sacuvan);
    } catch { /* localStorage nedostupan - ostaje klasik */ }

    this.apply();
    // Prijava uvek izgleda isto (kao i kod teme)
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      if (String(e.urlAfterRedirects).includes('/login')) document.body.removeAttribute('data-design');
      else this.apply();
    });
  }

  set(id: DesignId): void {
    this.design.set(id);
    try { localStorage.setItem(KLJUC, id); } catch { /* ignoriši */ }
    this.apply();
  }

  private apply(): void {
    const id = this.design();
    if (id === 'klasik') document.body.removeAttribute('data-design');
    else document.body.setAttribute('data-design', id);
  }
}
