import { Injectable, signal } from '@angular/core';
import { imaLatinice, uCirilicu } from '../utils/pismo';

export type Pismo = 'cirilica' | 'latinica';

const KLJUC = 'pismo';
// Atributi čiji tekst korisnik vidi (podsetnik u polju, opis pri prelasku mišem, čitači ekrana)
const ATRIBUTI = ['placeholder', 'title', 'aria-label', 'alt'];
// Ovde se tekst ne dira: podaci koji su po prirodi latinični ([data-lat]: korisnička imena, e-mail),
// kôd i stilovi, sadržaj koji korisnik kuca, i ikone koje su zapravo tekst (Material ligature)
const PRESKOCI = '[data-lat], script, style, textarea, code, pre, svg, mat-icon, .material-icons';

/**
 * Pismo aplikacije. Podrazumevano je ćirilica: svi tekstovi (koji su u kodu na latinici) preslovljavaju se
 * u trenutku prikaza, pa su pokriveni i poruke sa servera, kalendar i dijalozi. Izbor se pamti u pregledaču.
 * Prelazak na latinicu ponovo učitava stranicu, jer se izvorni tekst ne čuva.
 */
@Injectable({ providedIn: 'root' })
export class PismoService {
  pismo = signal<Pismo>('cirilica');
  private posmatrac: MutationObserver | null = null;

  constructor() {
    try {
      if (localStorage.getItem(KLJUC) === 'latinica') this.pismo.set('latinica');
    } catch { /* localStorage nedostupan - ostaje ćirilica */ }
  }

  /** Poziva se jednom pri pokretanju aplikacije. */
  pokreni(): void {
    if (this.pismo() !== 'cirilica' || this.posmatrac) return;
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    document.documentElement.lang = 'sr-Cyrl';
    document.title = uCirilicu(document.title);
    this.presloviSistemskeDijaloge();
    this.obradi(document.body);

    this.posmatrac = new MutationObserver((promene) => {
      for (const p of promene) {
        if (p.type === 'characterData') this.obradiTekst(p.target as Text);
        else if (p.type === 'attributes') this.obradiAtribut(p.target as Element, p.attributeName!);
        else p.addedNodes.forEach((n) => this.obradi(n));
      }
    });
    this.posmatrac.observe(document.body, {
      childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTI,
    });
  }

  postavi(pismo: Pismo): void {
    if (pismo === this.pismo()) return;
    try { localStorage.setItem(KLJUC, pismo); } catch { /* ignoriši */ }
    this.pismo.set(pismo);
    if (pismo === 'cirilica') this.pokreni();
    else location.reload();
  }

  private obradi(cvor: Node): void {
    if (cvor.nodeType === Node.TEXT_NODE) {
      this.obradiTekst(cvor as Text);
      return;
    }
    if (cvor.nodeType !== Node.ELEMENT_NODE) return;
    const el = cvor as Element;
    if (el.closest(PRESKOCI)) return;

    const setac = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let t = setac.nextNode(); t; t = setac.nextNode()) this.obradiTekst(t as Text);

    ATRIBUTI.forEach((a) => {
      if (el.hasAttribute(a)) this.obradiAtribut(el, a);
      el.querySelectorAll(`[${a}]`).forEach((e) => this.obradiAtribut(e, a));
    });
  }

  private obradiTekst(cvor: Text): void {
    const tekst = cvor.nodeValue;
    if (!imaLatinice(tekst)) return;
    if (cvor.parentElement?.closest(PRESKOCI)) return;
    const novo = uCirilicu(tekst!);
    if (novo !== tekst) cvor.nodeValue = novo; // upis samo kad ima razlike: nema beskonačne petlje sa posmatračem
  }

  private obradiAtribut(el: Element, atribut: string): void {
    const tekst = el.getAttribute(atribut);
    if (!imaLatinice(tekst)) return;
    if (el.closest('[data-lat]')) return;
    const novo = uCirilicu(tekst!);
    if (novo !== tekst) el.setAttribute(atribut, novo);
  }

  // confirm / alert / prompt nisu deo stranice, pa se njihov tekst preslovljava pri pozivu
  private presloviSistemskeDijaloge(): void {
    const w = window as any;
    if (w.__pismoDijalozi) return;
    w.__pismoDijalozi = true;
    const uPismu = (poruka?: unknown) => (this.pismo() === 'cirilica' && poruka !== undefined ? uCirilicu(String(poruka)) : poruka);
    const potvrda = window.confirm.bind(window);
    const upozorenje = window.alert.bind(window);
    const pitanje = window.prompt.bind(window);
    window.confirm = (poruka?: string) => potvrda(uPismu(poruka) as string);
    window.alert = (poruka?: any) => upozorenje(uPismu(poruka));
    window.prompt = (poruka?: string, podrazumevano?: string) => pitanje(uPismu(poruka) as string, podrazumevano);
  }
}
