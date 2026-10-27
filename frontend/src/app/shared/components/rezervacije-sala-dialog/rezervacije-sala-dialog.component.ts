import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

// Pregled rezervacija sala za objavljene kolokvijume (isti podaci koje preuzima sistem fakulteta)
@Component({
  selector: 'app-rezervacije-sala-dialog',
  standalone: true,
  template: `
    <div class="rez">
      <h2 class="rez-naslov">Pregled rezervacija sala</h2>
      <p class="rez-pod">
        Objavljeni kolokvijumi od danas nadalje: {{ grupe.length }} (sala: {{ data.rez.rezervacije.length }}).
        Kolokvijum u više sala ima po jednu rezervaciju za svaku salu.
      </p>

      <div class="rez-lista">
        <table class="rez-tabela">
          <thead>
            <tr><th>Datum</th><th>Vreme</th><th>Predmeti</th><th class="num">Studenata</th><th>Sale i rezervacija na fakultetu</th></tr>
          </thead>
          <tbody>
            @for (g of grupe; track g.kljuc) {
              <tr>
                <td>{{ datum(g.prva.datum) }}</td>
                <td>{{ g.prva.od }}–{{ g.prva.do }}@if (g.prva.do_pretpostavljen) { <span class="rez-napomena" title="Kraj nije unet, uzeto je 2 sata">*</span> }</td>
                <td>{{ nazivi(g.prva) }}@if (g.prva.racunarska_sala) { <span class="rez-oznaka">račun.</span> }</td>
                <td class="num">{{ g.prva.ukupno_studenata }}</td>
                <td>
                  @for (r of g.sale; track r.id) {
                    <div class="rez-sala">
                      <span class="rez-sala-ime">{{ r.sala }}</span>
                      @switch (data.rez.statusi?.[r.id]?.status) {
                        @case ('ok') { <span class="rez-st rez-st-ok">Rezervisano</span> }
                        @case ('greska') { <span class="rez-st rez-st-greska">Odbijeno</span><div class="rez-poruka" data-lat>{{ data.rez.statusi[r.id].poruka }}</div> }
                        @default { <span class="rez-st">Nije poslato</span> }
                      }
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (data.rez.bez_sale?.length) {
        <p class="rez-upozorenje">Bez izabrane sale ({{ data.rez.bez_sale.length }}): nisu u rezervacijama dok se sala ne izabere.</p>
      }

      <div class="rez-dugmad">
        <button type="button" class="rez-btn rez-btn-sek" (click)="ref.close(false)">Zatvori</button>
        <button type="button" class="rez-btn" (click)="ref.close(true)">Preuzmi <span data-lat>JSON</span> fajl</button>
      </div>
    </div>
  `,
  styles: [`
    .rez { padding: 22px 24px 18px; color: var(--text); }
    .rez-naslov { margin: 0 0 6px; font-size: 1.1rem; font-weight: 800; }
    .rez-pod { margin: 0 0 14px; font-size: 0.82rem; color: var(--muted); }
    .rez-lista { max-height: 52vh; overflow: auto; border: 1px solid var(--border); border-radius: 10px; }
    .rez-tabela { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
    .rez-tabela th { position: sticky; top: 0; background: var(--surface-3); text-align: left; padding: 8px 10px; font-size: 0.72rem; text-transform: uppercase; letter-spacing: .03em; color: var(--muted); }
    .rez-tabela td { padding: 8px 10px; border-top: 1px solid var(--border); vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .rez-oznaka { margin-left: 6px; padding: 1px 6px; border-radius: 4px; font-size: 0.66rem; font-weight: 700; background: var(--primary-soft); color: var(--primary-text); }
    .rez-napomena { margin-left: 3px; color: var(--muted); }
    .rez-st { display: inline-block; padding: 1px 7px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; white-space: nowrap; background: var(--surface-3); color: var(--muted); }
    .rez-st-ok { background: var(--tint-green-bg); color: var(--tint-green-fg); }
    .rez-st-greska { background: var(--danger-soft); color: var(--danger-text); }
    .rez-poruka { margin-top: 3px; font-size: 0.7rem; color: var(--muted); max-width: 220px; }
    .rez-sala { margin: 2px 0 6px; }
    .rez-sala-ime { display: inline-block; min-width: 64px; font-weight: 700; margin-right: 6px; }
    .rez-upozorenje { margin: 12px 0 0; font-size: 0.8rem; color: var(--danger-text); }
    .rez-dugmad { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
    .rez-btn { height: 38px; padding: 0 16px; border-radius: 8px; border: 1px solid var(--primary); background: var(--primary); color: #fff; font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; }
    .rez-btn-sek { background: var(--surface-2); color: var(--text); border-color: var(--border-strong); }
  `]
})
export class RezervacijeSalaDialogComponent {
  // Jedan red po kolokvijumu: rezervacije "kol-45" i "kol-45-s7" su isti termin u dve sale
  grupe: { kljuc: string; prva: any; sale: any[] }[] = [];

  constructor(
    public ref: MatDialogRef<RezervacijeSalaDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: { rez: any }
  ) {
    const poKljucu = new Map<string, { kljuc: string; prva: any; sale: any[] }>();
    for (const r of data.rez?.rezervacije || []) {
      const kljuc = String(r.id).replace(/-s\d+$/, '');
      if (!poKljucu.has(kljuc)) poKljucu.set(kljuc, { kljuc, prva: r, sale: [] });
      poKljucu.get(kljuc)!.sale.push(r);
    }
    this.grupe = [...poKljucu.values()];
  }

  datum(d: string): string {
    const [g, m, dan] = String(d).split('-');
    return `${dan}. ${m}. ${g}.`;
  }

  nazivi(r: any): string {
    return (r.predmeti || []).map((p: any) => p.naziv).join(', ');
  }
}
