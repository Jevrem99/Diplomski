import { ChangeDetectorRef, Component, Inject, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Observable, forkJoin } from 'rxjs';
import { CrudModal } from '../crud-modal/crud-modal.component';
import { ToastService } from '../../../core/services/toast.service';
import { environment } from '../../../../environments/environment';

export interface UvozStavka {
  izvor: string;
  predmetNaziv: string;
  predmet: { id: number; naziv: string; sifra: string; godina: number } | null;
  datum: string | null;
  vreme: string | null;
  vremeKraja: string | null;
  sala: string | null;
  isIspit: boolean;
  tip: string | null;
  grupaKljuc: string | null;
  dezurni: { id: number; ime: string; prezime: string }[];
  status: 'ok' | 'duplikat' | 'nepoznat_predmet' | 'neispravno';
  razlog: string | null;
  napomena: string | null;
}
export interface UvozPregled { izvor: string; stavke: UvozStavka[] }

const OZNAKE: Record<string, string> = {
  ok: 'U redu', duplikat: 'Već postoji', nepoznat_predmet: 'Nepoznat predmet', neispravno: 'Neispravno'
};

// Pregled termina iz fajla ili sačuvane verzije pre dodavanja u raspored
@Component({
  selector: 'app-uvoz-pregled-dialog',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="uv">
      <div class="uv-glava">
        <h2 class="uv-naslov" data-lat>{{ data.naslov }}</h2>
        @if (pregled.izvor === 'excel-ispiti') {
          <label class="uv-godina">Godina
            <input type="number" [(ngModel)]="godina" (change)="osvezi()" min="2000" max="2100">
          </label>
        }
      </div>
      <p class="uv-pod">{{ izabrane().length }} od {{ pregled.stavke.length }} izabrano</p>

      <div class="uv-lista">
        <table class="uv-tabela">
          <thead>
            <tr>
              <th><input type="checkbox" [checked]="sveIzabrane()" (change)="izaberiSve($any($event.target).checked)"></th>
              <th>Datum</th><th>Vreme</th><th>Predmet</th><th>Vrsta</th><th>Sala</th><th>Dežurni</th><th>Status</th>
            </tr>
          </thead>
          <tbody>
            @for (s of pregled.stavke; track $index; let i = $index) {
              <tr [class.uv-siva]="!izbor[i]">
                <td><input type="checkbox" [(ngModel)]="izbor[i]" [disabled]="!mozeSe(s)"></td>
                <td>{{ datum(s.datum) }}</td>
                <td>{{ s.vreme || '–' }}{{ s.vremeKraja ? '–' + s.vremeKraja : '' }}</td>
                <td>{{ s.predmet?.naziv || s.predmetNaziv }}</td>
                <td>{{ s.isIspit ? 'ispit' : s.tip }}</td>
                <td>{{ s.sala || '–' }}</td>
                <td class="uv-dez">{{ dezurni(s) }}</td>
                <td>
                  <span class="uv-status" [class]="'uv-status uv-' + s.status">{{ oznaka(s.status) }}</span>
                  @if (s.status === 'nepoznat_predmet') {
                    <button type="button" class="uv-link" (click)="napraviPredmet(s)">Napravi predmet</button>
                  }
                  @if (s.razlog && s.status !== 'nepoznat_predmet') { <div class="uv-razlog">{{ s.razlog }}</div> }
                  @if (s.napomena) { <div class="uv-razlog">{{ s.napomena }}</div> }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="uv-dugmad">
        <button type="button" class="uv-btn uv-btn-sek" (click)="ref.close(null)">Odustani</button>
        <button type="button" class="uv-btn" [disabled]="!izabrane().length || radi" (click)="ref.close(izabrane())">Dodaj u raspored</button>
      </div>
    </div>
  `,
  styles: [`
    .uv { padding: 22px 24px 18px; color: var(--text); }
    .uv-glava { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .uv-naslov { margin: 0; font-size: 1.1rem; font-weight: 800; }
    .uv-godina { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; font-weight: 700; color: var(--muted); }
    .uv-godina input { width: 90px; height: 32px; padding: 0 8px; border-radius: 6px; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text); font: inherit; }
    .uv-pod { margin: 6px 0 12px; font-size: 0.8rem; color: var(--muted); }
    .uv-lista { max-height: 56vh; overflow: auto; border: 1px solid var(--border); border-radius: 10px; }
    .uv-tabela { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
    .uv-tabela th { position: sticky; top: 0; z-index: 1; background: var(--surface-3); text-align: left; padding: 8px; font-size: 0.7rem; text-transform: uppercase; color: var(--muted); }
    .uv-tabela td { padding: 7px 8px; border-top: 1px solid var(--border); vertical-align: top; }
    .uv-siva td { opacity: 0.55; }
    .uv-dez { max-width: 220px; }
    .uv-status { display: inline-block; padding: 1px 7px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; white-space: nowrap; }
    .uv-ok { background: var(--tint-green-bg); color: var(--tint-green-fg); }
    .uv-duplikat { background: var(--surface-3); color: var(--muted); }
    .uv-nepoznat_predmet, .uv-neispravno { background: var(--danger-soft); color: var(--danger-text); }
    .uv-razlog { margin-top: 3px; font-size: 0.7rem; color: var(--muted); }
    .uv-link { display: block; margin-top: 4px; padding: 0; border: none; background: none; color: var(--primary-text); font: inherit; font-size: 0.74rem; font-weight: 700; text-decoration: underline; cursor: pointer; }
    .uv-dugmad { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
    .uv-btn { height: 38px; padding: 0 16px; border-radius: 8px; border: 1px solid var(--primary); background: var(--primary); color: #fff; font: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; }
    .uv-btn:disabled { opacity: 0.5; cursor: default; }
    .uv-btn-sek { background: var(--surface-2); color: var(--text); border-color: var(--border-strong); }
  `]
})
export class UvozPregledDialogComponent {
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  pregled: UvozPregled;
  izbor: boolean[] = [];
  godina: number;
  radi = false;

  constructor(
    public ref: MatDialogRef<UvozPregledDialogComponent, UvozStavka[] | null>,
    @Inject(MAT_DIALOG_DATA) public data: { naslov: string; pregled: UvozPregled; godina?: number; ucitaj: (godina: number) => Observable<UvozPregled> }
  ) {
    this.pregled = data.pregled;
    this.godina = data.godina ?? new Date().getFullYear();
    this.postaviIzbor();
  }

  private postaviIzbor(): void {
    this.izbor = this.pregled.stavke.map((s) => s.status === 'ok');
  }

  mozeSe(s: UvozStavka): boolean {
    return !!s.predmet && !!s.datum && !!s.vreme;
  }

  izabrane(): UvozStavka[] {
    return this.pregled.stavke.filter((s, i) => this.izbor[i] && this.mozeSe(s));
  }

  sveIzabrane(): boolean {
    const moguce = this.pregled.stavke.filter((s) => this.mozeSe(s)).length;
    return moguce > 0 && this.izabrane().length === moguce;
  }

  izaberiSve(da: boolean): void {
    this.izbor = this.pregled.stavke.map((s) => da && this.mozeSe(s));
  }

  oznaka(status: string): string {
    return OZNAKE[status] || status;
  }

  datum(d: string | null): string {
    if (!d) return '–';
    const [g, m, dan] = d.split('-');
    return `${dan}.${m}.${g}.`;
  }

  dezurni(s: UvozStavka): string {
    return s.dezurni.length ? s.dezurni.map((d) => `${d.ime} ${d.prezime}`).join(', ') : '–';
  }

  osvezi(): void {
    this.radi = true;
    this.data.ucitaj(this.godina).subscribe({
      next: (p) => { this.pregled = p; this.postaviIzbor(); this.radi = false; this.cdr.detectChanges(); },
      error: (err) => { this.radi = false; this.toast.show(err.error?.error || 'Učitavanje nije uspelo.', 'error'); this.cdr.detectChanges(); }
    });
  }

  // Predmet koji nije u bazi: ista forma kao u "Upravljaj bazom", sa unetim nazivom
  napraviPredmet(s: UvozStavka): void {
    forkJoin({ ljudi: this.http.get<any[]>(`${environment.apiUrl}/profesors`) }).subscribe(({ ljudi }) => {
      const ref = this.dialog.open(CrudModal, {
        width: '850px',
        data: {
          title: 'Novi predmet',
          columns: [
            { key: 'sifra', label: 'Šifra' },
            { key: 'naziv', label: 'Naziv predmeta' },
            { key: 'godina', label: 'Godina' },
            { key: 'semestar', label: 'Semestar' },
            { key: 'profesor_id', label: 'Glavni profesor (ID)' },
            { key: 'status', label: 'Status (O / I)' },
            { key: 'broj_studenata', label: 'Broj studenata' },
            { key: 'saradnici_ids', label: 'Saradnici na predmetu' }
          ],
          rowData: { naziv: s.predmetNaziv },
          saradniciList: ljudi.filter((o) => o.is_saradnik),
          profesoriList: ljudi.filter((o) => !o.is_saradnik),
          submit: (payload: any) => this.http.post(`${environment.apiUrl}/predmet`, payload)
        },
        disableClose: true
      });
      ref.afterClosed().subscribe((ok) => {
        if (ok === true) {
          this.toast.show('Predmet je dodat.', 'success');
          this.osvezi();
        }
      });
    });
  }
}
