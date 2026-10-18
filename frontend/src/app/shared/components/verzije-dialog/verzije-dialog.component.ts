import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastService } from '../../../core/services/toast.service';
import { PotvrdaService } from '../../../core/services/potvrda.service';
import { environment } from '../../../../environments/environment';

interface Verzija { id: number; naziv: string; autor: string | null; created_at: string; broj_termina: number; datum_od: string | null; datum_do: string | null }

// Sačuvane verzije rasporeda: čuvanje trenutnog stanja, učitavanje, preuzimanje, brisanje
@Component({
  selector: 'app-verzije-dialog',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="vz">
      <h2 class="vz-naslov">Verzije rasporeda</h2>

      <form class="vz-nova" (ngSubmit)="sacuvaj()">
        <input type="text" [(ngModel)]="naziv" name="naziv" placeholder="Naziv, npr. Jun rok – v1" maxlength="120" class="vz-polje vz-naziv">
        <input type="date" [(ngModel)]="od" name="od" class="vz-polje" title="Od (opciono)">
        <input type="date" [(ngModel)]="doDatuma" name="doDatuma" class="vz-polje" title="Do (opciono)">
        <button type="submit" class="vz-btn" [disabled]="!naziv.trim() || radi">Sačuvaj trenutni</button>
      </form>
      @if (data.imaNesacuvanih) { <p class="vz-upozorenje">Nesačuvane izmene neće ući u verziju.</p> }

      <div class="vz-lista">
        @for (v of verzije; track v.id) {
          <div class="vz-red">
            <div class="vz-info">
              <div class="vz-ime">{{ v.naziv }}</div>
              <div class="vz-meta">{{ vreme(v.created_at) }} · {{ v.autor || '–' }} · {{ v.broj_termina }} termina{{ opseg(v) }}</div>
            </div>
            <div class="vz-akcije">
              <button type="button" class="vz-btn" (click)="ref.close({ akcija: 'ucitaj', verzija: v })">Učitaj</button>
              <button type="button" class="vz-btn vz-btn-sek" (click)="preuzmi(v)">JSON</button>
              <button type="button" class="vz-btn vz-btn-sek" (click)="obrisi(v)">Obriši</button>
            </div>
          </div>
        } @empty {
          <p class="vz-prazno">Nema sačuvanih verzija.</p>
        }
      </div>

      <div class="vz-dugmad">
        <button type="button" class="vz-btn vz-btn-sek" (click)="ref.close(null)">Zatvori</button>
      </div>
    </div>
  `,
  styles: [`
    .vz { padding: 22px 24px 18px; color: var(--text); }
    .vz-naslov { margin: 0 0 14px; font-size: 1.1rem; font-weight: 800; }
    .vz-nova { display: flex; gap: 8px; flex-wrap: wrap; }
    .vz-polje { height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text); font: inherit; font-size: 0.82rem; }
    .vz-naziv { flex: 1; min-width: 200px; }
    .vz-upozorenje { margin: 8px 0 0; font-size: 0.78rem; color: var(--danger-text); }
    .vz-lista { margin-top: 14px; max-height: 50vh; overflow: auto; border: 1px solid var(--border); border-radius: 10px; }
    .vz-red { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-top: 1px solid var(--border); }
    .vz-red:first-child { border-top: none; }
    .vz-ime { font-weight: 700; font-size: 0.88rem; }
    .vz-meta { font-size: 0.74rem; color: var(--muted); margin-top: 2px; }
    .vz-akcije { display: flex; gap: 6px; flex-shrink: 0; }
    .vz-prazno { margin: 0; padding: 16px; font-size: 0.82rem; color: var(--muted); text-align: center; }
    .vz-dugmad { display: flex; justify-content: flex-end; margin-top: 14px; }
    .vz-btn { height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--primary); background: var(--primary); color: #fff; font: inherit; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
    .vz-btn:disabled { opacity: 0.5; cursor: default; }
    .vz-btn-sek { background: var(--surface-2); color: var(--text); border-color: var(--border-strong); }
  `]
})
export class VerzijeDialogComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private potvrda = inject(PotvrdaService);
  private cdr = inject(ChangeDetectorRef);
  private API = `${environment.apiUrl}/verzije`;

  verzije: Verzija[] = [];
  naziv = '';
  od = '';
  doDatuma = '';
  radi = false;

  constructor(
    public ref: MatDialogRef<VerzijeDialogComponent, { akcija: 'ucitaj'; verzija: Verzija } | null>,
    @Inject(MAT_DIALOG_DATA) public data: { imaNesacuvanih: boolean }
  ) {}

  ngOnInit(): void {
    this.ucitaj();
  }

  private ucitaj(): void {
    this.http.get<Verzija[]>(this.API).subscribe({
      next: (v) => { this.verzije = v; this.cdr.detectChanges(); },
      error: () => this.toast.show('Verzije nisu učitane.', 'error')
    });
  }

  vreme(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}. ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  opseg(v: Verzija): string {
    if (!v.datum_od && !v.datum_do) return '';
    const f = (s: string | null) => (s ? s.split('-').reverse().join('.') + '.' : '…');
    return ` · ${f(v.datum_od)} – ${f(v.datum_do)}`;
  }

  sacuvaj(): void {
    this.radi = true;
    this.http.post<Verzija>(this.API, { naziv: this.naziv.trim(), od: this.od || null, do: this.doDatuma || null }).subscribe({
      next: () => {
        this.radi = false;
        this.naziv = '';
        this.toast.show('Verzija je sačuvana.', 'success');
        this.ucitaj();
      },
      error: (err) => { this.radi = false; this.toast.show(err.error?.error || 'Čuvanje nije uspelo.', 'error'); this.cdr.detectChanges(); }
    });
  }

  preuzmi(v: Verzija): void {
    this.http.get(`${this.API}/${v.id}`).subscribe({
      next: (podaci) => {
        const blob = new Blob([JSON.stringify(podaci, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${v.naziv.replace(/[\\/:*?"<>|]/g, '').trim() || 'raspored'}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.toast.show('Preuzimanje nije uspelo.', 'error')
    });
  }

  async obrisi(v: Verzija): Promise<void> {
    if (!(await this.potvrda.pitaj({ naslov: 'Brisanje verzije', poruka: `Obrisati „${v.naziv}“?`, potvrdi: 'Obriši', opasno: true }))) return;
    this.http.delete(`${this.API}/${v.id}`).subscribe({
      next: () => { this.toast.show('Verzija je obrisana.', 'success'); this.ucitaj(); },
      error: () => this.toast.show('Brisanje nije uspelo.', 'error')
    });
  }
}
