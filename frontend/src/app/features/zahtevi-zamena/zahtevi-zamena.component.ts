import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../core/services/toast.service';
import { procitajGresku } from '../../core/utils/validacija';

@Component({
  selector: 'app-zahtevi-zamena',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-4 sm:p-8 bg-[#e9f0f8] min-h-[94vh] font-montserrat">
      <div class="max-w-5xl mx-auto flex flex-col gap-5">

        <div class="bg-[#1F63A0] border border-[#164f82] rounded-2xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Zahtevi za zamenu dežurstava</h1>
            <p class="text-xs sm:text-sm text-blue-100/80 font-medium mt-1">Saradnici traže zamenu; vi birate ko preuzima dežurstvo.</p>
          </div>
          <div class="inline-flex bg-white/10 p-1 rounded-xl border border-white/20">
            <button type="button" (click)="promeniFilter('na_cekanju')"
                    [ngClass]="filter === 'na_cekanju' ? 'bg-white text-[#1F63A0]' : 'text-white'"
                    class="px-4 py-2 text-xs sm:text-sm font-bold rounded-lg cursor-pointer border-none bg-transparent">
              Na čekanju
            </button>
            <button type="button" (click)="promeniFilter('')"
                    [ngClass]="filter === '' ? 'bg-white text-[#1F63A0]' : 'text-white'"
                    class="px-4 py-2 text-xs sm:text-sm font-bold rounded-lg cursor-pointer border-none bg-transparent">
              Svi zahtevi
            </button>
          </div>
        </div>

        @if (ucitava) {
          <div class="bg-white rounded-xl p-8 text-center text-slate-500 font-bold">Učitavanje…</div>
        } @else {
          @for (z of zahtevi; track z.id) {
            <div class="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col gap-3">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 class="m-0 text-base font-extrabold text-slate-800">{{ z.ispit?.predmet }}</h2>
                  <p class="m-0 text-xs font-semibold text-slate-500">
                    {{ z.ispit?.datum | date:'dd.MM.yyyy.' }}, {{ z.ispit?.vreme }}@if (z.ispit?.vreme_kraja) {–{{ z.ispit.vreme_kraja }}}h
                    @if (z.ispit?.sala) { · sala {{ z.ispit.sala }} }
                  </p>
                </div>
                <span class="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full"
                      [ngClass]="z.status === 'odobren' ? 'bg-emerald-100 text-emerald-800' : z.status === 'odbijen' ? 'bg-rose-100 text-rose-800' : z.status === 'na_cekanju' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'">
                  {{ nazivStatusa(z.status) }}
                </span>
              </div>

              <div class="text-sm text-slate-700 leading-relaxed">
                <p class="m-0"><strong>{{ z.trazilac?.ime }} {{ z.trazilac?.prezime }}</strong> traži zamenu.</p>
                <p class="m-0">Razlog: {{ z.razlog }}</p>
                @if (z.predlozeni && z.status === 'na_cekanju') {
                  <p class="m-0">Predlaže kolegu: <strong>{{ z.predlozeni.ime }} {{ z.predlozeni.prezime }}</strong></p>
                }
                @if (z.status === 'odobren' && z.predlozeni) {
                  <p class="m-0">Preuzima: <strong>{{ z.predlozeni.ime }} {{ z.predlozeni.prezime }}</strong></p>
                }
                @if (z.napomena_admina) { <p class="m-0 text-slate-500">Napomena: {{ z.napomena_admina }}</p> }
              </div>

              @if (z.status === 'na_cekanju') {
                @if (otvoreni === z.id) {
                  <div class="border border-slate-200 rounded-lg p-4 bg-slate-50 flex flex-col gap-3">
                    <span class="text-xs font-extrabold text-slate-600 uppercase">Ko preuzima dežurstvo?</span>
                    @if (kandidati.length === 0) {
                      <span class="text-sm text-slate-500">Na ovom predmetu nema drugih saradnika koji mogu da preuzmu dežurstvo.</span>
                    }
                    @for (k of kandidati; track k.id) {
                      <label class="flex items-start gap-3 p-2 rounded-lg border cursor-pointer"
                             [ngClass]="izabranId === k.id ? 'border-[#1F63A0] bg-white' : 'border-transparent'">
                        <input type="radio" name="kandidat" [value]="k.id" [(ngModel)]="izabranId" class="mt-1" />
                        <span class="flex flex-col">
                          <span class="text-sm font-bold text-slate-800">
                            {{ k.ime }} {{ k.prezime }}
                            @if (z.predlozeni?.id === k.id) { <span class="text-[10px] text-[#1F63A0] font-extrabold uppercase ml-1">predloženo</span> }
                          </span>
                          @if (k.konflikti.length === 0) {
                            <span class="text-xs font-semibold text-emerald-700">Slobodan/na u tom terminu</span>
                          } @else {
                            @for (kf of k.konflikti; track kf) { <span class="text-xs font-semibold text-amber-700">⚠ {{ kf }}</span> }
                          }
                        </span>
                      </label>
                    }
                    @if (greska) { <div class="text-xs font-bold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{{ greska }}</div> }
                    @if (konfliktPoruke.length > 0) {
                      <div class="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Izabrani saradnik ima konflikt:
                        @for (m of konfliktPoruke; track m) { <div>• {{ m }}</div> }
                      </div>
                    }
                    <div class="flex flex-wrap justify-end gap-2">
                      <button (click)="zatvori()" class="h-9 px-4 text-xs font-bold text-slate-600 border border-slate-300 rounded-lg bg-transparent cursor-pointer">Zatvori</button>
                      <button (click)="odobri(z, konfliktPoruke.length > 0)" [disabled]="!izabranId || radi"
                              class="h-9 px-4 text-xs font-extrabold text-white rounded-lg border-none cursor-pointer disabled:opacity-50"
                              [ngClass]="konfliktPoruke.length > 0 ? 'bg-amber-500' : 'bg-emerald-600'">
                        {{ konfliktPoruke.length > 0 ? 'Odobri ipak' : 'Odobri zamenu' }}
                      </button>
                    </div>
                  </div>
                } @else if (odbijanje === z.id) {
                  <div class="border border-slate-200 rounded-lg p-4 bg-slate-50 flex flex-col gap-3">
                    <textarea [(ngModel)]="napomena" rows="2" maxlength="300" placeholder="Obrazloženje (vidi ga saradnik)"
                              class="border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#1F63A0]"></textarea>
                    <div class="flex justify-end gap-2">
                      <button (click)="odbijanje = null" class="h-9 px-4 text-xs font-bold text-slate-600 border border-slate-300 rounded-lg bg-transparent cursor-pointer">Nazad</button>
                      <button (click)="odbij(z)" [disabled]="radi" class="h-9 px-4 text-xs font-extrabold text-white bg-rose-600 rounded-lg border-none cursor-pointer disabled:opacity-50">Odbij zahtev</button>
                    </div>
                  </div>
                } @else {
                  <div class="flex justify-end gap-2">
                    <button (click)="otvoriOdbijanje(z)" class="h-9 px-4 text-xs font-bold text-rose-700 border border-rose-200 bg-rose-50 rounded-lg cursor-pointer">Odbij</button>
                    <button (click)="otvoriOdobravanje(z)" class="h-9 px-4 text-xs font-extrabold text-white bg-[#1F63A0] rounded-lg border-none cursor-pointer">Izaberi zamenu…</button>
                  </div>
                }
              }
            </div>
          } @empty {
            <div class="bg-white rounded-xl p-10 border border-dashed border-slate-200 text-center">
              <p class="m-0 text-slate-600 font-bold">Nema zahteva{{ filter === 'na_cekanju' ? ' na čekanju' : '' }}.</p>
            </div>
          }
        }
      </div>
    </div>
  `
})
export class ZahteviZamenaComponent implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private api = environment.apiUrl;

  zahtevi: any[] = [];
  ucitava = true;
  filter: '' | 'na_cekanju' = 'na_cekanju';

  otvoreni: number | null = null;     // zahtev za koji se bira zamena
  odbijanje: number | null = null;    // zahtev koji se odbija
  kandidati: any[] = [];
  izabranId: number | null = null;
  napomena = '';
  greska = '';
  konfliktPoruke: string[] = [];
  radi = false;

  ngOnInit(): void { this.ucitaj(); }

  promeniFilter(f: '' | 'na_cekanju'): void {
    this.filter = f;
    this.zatvori();
    this.ucitaj();
  }

  ucitaj(): void {
    this.ucitava = true;
    const url = `${this.api}/zamene${this.filter ? '?status=' + this.filter : ''}`;
    this.http.get<any[]>(url).subscribe({
      next: (z) => { this.zahtevi = z; this.ucitava = false; this.cdr.detectChanges(); },
      error: (err) => {
        this.ucitava = false;
        this.toast.show(procitajGresku(err, 'Zahtevi nisu učitani.').opsta, 'error');
        this.cdr.detectChanges();
      }
    });
  }

  nazivStatusa(s: string): string {
    return ({ na_cekanju: 'Na čekanju', odobren: 'Odobren', odbijen: 'Odbijen', otkazan: 'Povučen' } as Record<string, string>)[s] || s;
  }

  zatvori(): void {
    this.otvoreni = null;
    this.odbijanje = null;
    this.kandidati = [];
    this.izabranId = null;
    this.napomena = '';
    this.greska = '';
    this.konfliktPoruke = [];
  }

  otvoriOdobravanje(z: any): void {
    this.zatvori();
    this.otvoreni = z.id;
    this.http.get<any[]>(`${this.api}/zamene/${z.id}/kandidati`).subscribe({
      next: (k) => {
        this.kandidati = k;
        // unapred izabran predloženi kolega, a inače prvi slobodan
        this.izabranId = z.predlozeni?.id ?? k.find((x) => x.konflikti.length === 0)?.id ?? null;
        this.cdr.detectChanges();
      },
      error: (err) => this.greska = procitajGresku(err, 'Kandidati nisu učitani.').opsta
    });
  }

  otvoriOdbijanje(z: any): void {
    this.zatvori();
    this.odbijanje = z.id;
  }

  odobri(z: any, force: boolean): void {
    this.radi = true;
    this.greska = '';
    this.http.post(`${this.api}/zamene/${z.id}/odobri${force ? '?force=1' : ''}`, { zamena_id: this.izabranId }).subscribe({
      next: () => {
        this.radi = false;
        this.toast.show('Zamena je odobrena i raspored je ažuriran.', 'success');
        this.zatvori();
        this.ucitaj();
      },
      error: (err) => {
        this.radi = false;
        if (err.status === 409 && err.error?.poruke) {
          this.konfliktPoruke = err.error.poruke;
        } else {
          this.greska = procitajGresku(err, 'Odobravanje nije uspelo.').opsta;
        }
        this.cdr.detectChanges();
      }
    });
  }

  odbij(z: any): void {
    this.radi = true;
    this.http.post(`${this.api}/zamene/${z.id}/odbij`, { napomena: this.napomena.trim() || null }).subscribe({
      next: () => {
        this.radi = false;
        this.toast.show('Zahtev je odbijen.', 'success');
        this.zatvori();
        this.ucitaj();
      },
      error: (err) => {
        this.radi = false;
        this.toast.show(procitajGresku(err, 'Odbijanje nije uspelo.').opsta, 'error');
      }
    });
  }
}
