import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef } from '@angular/material/dialog';
import { ToastService } from '../../../core/services/toast.service';
import { PotvrdaService } from '../../../core/services/potvrda.service';
import { environment } from '../../../../environments/environment';

interface Osoba {
  id: number; ime: string; prezime: string; email: string | null; is_saradnik: boolean;
  dezurstva: number; predmeti: number; angazovanja: number; obaveze: number;
  nalog: { username: string; uloga: string } | null;
}

// Osobe sa istim imenom i prezimenom u različitom zapisu (Excel ćirilicom, PMF prijava latinicom): spajanje u jednu
@Component({
  selector: 'app-duplikati-dialog',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="dp">
      <h2 class="dp-naslov">Duplikati</h2>
      <p class="dp-pod">Iste osobe zapisane više puta. Izaberite zapis koji ostaje; dežurstva, predmeti, obaveze i e-mail ostalih prelaze na njega.</p>

      @if (ucitava) {
        <p class="dp-prazno">Učitavanje…</p>
      } @else if (!grupe.length) {
        <p class="dp-prazno">Nema duplikata.</p>
      } @else {
        <div class="dp-lista">
          @for (g of grupe; track $index; let gi = $index) {
            <div class="dp-grupa">
              @for (o of g; track o.id) {
                <label class="dp-osoba" [class.dp-izabrana]="izbor[gi] === o.id">
                  <input type="radio" [name]="'g' + gi" [value]="o.id" [(ngModel)]="izbor[gi]">
                  <span class="dp-ime">{{ o.ime }} {{ o.prezime }}</span>
                  <span class="dp-meta">
                    {{ o.is_saradnik ? 'saradnik' : 'profesor' }} ·
                    @if (o.email) { <span data-lat>{{ o.email }}</span> } @else { bez e-maila }
                    @if (o.nalog) { · nalog <span data-lat>{{ o.nalog.username }}</span> }
                    · dežurstava {{ o.dezurstva }} · predmeta {{ o.predmeti + o.angazovanja }} · obaveza {{ o.obaveze }}
                  </span>
                </label>
              }
              <div class="dp-akcija">
                <button type="button" class="dp-btn" [disabled]="radi" (click)="spoji(gi)">Spoji u izabrani</button>
              </div>
            </div>
          }
        </div>
      }

      <div class="dp-dugmad">
        <button type="button" class="dp-btn dp-btn-sek" (click)="ref.close(spojeno)">Zatvori</button>
      </div>
    </div>
  `,
  styles: [`
    .dp { padding: 22px 24px 18px; color: var(--text); }
    .dp-naslov { margin: 0 0 6px; font-size: 1.1rem; font-weight: 800; }
    .dp-pod { margin: 0 0 14px; font-size: 0.82rem; color: var(--muted); }
    .dp-lista { max-height: 60vh; overflow: auto; display: flex; flex-direction: column; gap: 10px; }
    .dp-grupa { border: 1px solid var(--border); border-radius: 10px; padding: 8px 10px; }
    .dp-osoba { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 6px; cursor: pointer; }
    .dp-izabrana { background: var(--primary-soft); }
    .dp-ime { font-weight: 700; font-size: 0.88rem; }
    .dp-meta { font-size: 0.74rem; color: var(--muted); }
    .dp-akcija { display: flex; justify-content: flex-end; margin-top: 4px; }
    .dp-prazno { margin: 0; padding: 16px; font-size: 0.85rem; color: var(--muted); text-align: center; }
    .dp-dugmad { display: flex; justify-content: flex-end; margin-top: 14px; }
    .dp-btn { height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--primary); background: var(--primary); color: #fff; font: inherit; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
    .dp-btn:disabled { opacity: 0.5; cursor: default; }
    .dp-btn-sek { background: var(--surface-2); color: var(--text); border-color: var(--border-strong); }
  `]
})
export class DuplikatiDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private potvrda = inject(PotvrdaService);
  private cdr = inject(ChangeDetectorRef);
  ref = inject(MatDialogRef<DuplikatiDialogComponent, boolean>);

  grupe: Osoba[][] = [];
  izbor: number[] = [];
  ucitava = true;
  radi = false;
  spojeno = false;

  ngOnInit(): void {
    this.ucitaj();
  }

  private ucitaj(): void {
    this.ucitava = true;
    this.http.get<Osoba[][]>(`${environment.apiUrl}/admin/duplikati`).subscribe({
      next: (g) => {
        this.grupe = g;
        // podrazumevano ostaje zapis sa najviše veza (obično onaj iz Excel tabele)
        this.izbor = g.map((osobe) => [...osobe].sort((a, b) => this.tezina(b) - this.tezina(a))[0].id);
        this.ucitava = false;
        this.cdr.detectChanges();
      },
      error: () => { this.ucitava = false; this.toast.show('Duplikati nisu učitani.', 'error'); this.cdr.detectChanges(); }
    });
  }

  private tezina(o: Osoba): number {
    return o.dezurstva + o.predmeti + o.angazovanja + o.obaveze;
  }

  async spoji(gi: number): Promise<void> {
    const zadrzi = this.grupe[gi].find((o) => o.id === this.izbor[gi]);
    const ostali = this.grupe[gi].filter((o) => o.id !== this.izbor[gi]);
    if (!zadrzi || !ostali.length) return;
    const ok = await this.potvrda.pitaj({
      naslov: 'Spajanje',
      poruka: `Ostaje „${zadrzi.ime} ${zadrzi.prezime}“. Ostali zapisi (${ostali.length}) se brišu, a njihove veze prelaze na izabrani.`,
      potvrdi: 'Spoji',
      opasno: true
    });
    if (!ok) return;
    this.radi = true;
    for (const o of ostali) {
      try {
        await new Promise<void>((resolve, reject) =>
          this.http.post(`${environment.apiUrl}/admin/duplikati/spoji`, { zadrzi: zadrzi.id, spoji: o.id }).subscribe({ next: () => resolve(), error: reject }));
      } catch (err: any) {
        this.radi = false;
        this.toast.show(err?.error?.error || 'Spajanje nije uspelo.', 'error');
        this.ucitaj();
        return;
      }
    }
    this.radi = false;
    this.spojeno = true;
    this.toast.show('Spojeno.', 'success');
    this.ucitaj();
  }
}
