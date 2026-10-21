import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ToastService } from '../core/services/toast.service';

interface KolokvijumForma {
  datum: string;
  trajanje: number | null;
  racunarskaSala: boolean;
  dezurni: number | null;
}

interface RedPredmeta {
  id: number;
  naziv: string;
  godina: number;
  semestar: string;
  status: string;
  profesor?: { ime: string; prezime: string } | null;
  broj_studenata?: number | null;
  saradniciTekst: string;
  terminiKolokvijuma: any;
  k: KolokvijumForma[];
  popravniDatum: string;
  popravniUTerminuIspita: boolean;
  popravniTrajanje: number | null;
  popravniRacunarskaSala: boolean;
  popravniDezurni: number | null;
  napomena: string;
  cuva: boolean;
  izmenjen: boolean;
}

// Server koristi DD.MM.GGGG, a input type="date" koristi GGGG-MM-DD.
const izServera = (d?: string | null): string => {
  const datum = String(d || '').trim();

  // Podržava i datum koji API eventualno već vrati u ISO formatu.
  if (/^\d{4}-\d{2}-\d{2}$/.test(datum)) {
    return datum;
  }

  const m = datum.match(/^(\d{2})\.(\d{2})\.(\d{4})\.?$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
};

const naServer = (d: string): string | null => {
  const m = String(d || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
};

@Component({
  selector: 'app-termini-kolokvijuma',
  imports: [CommonModule, FormsModule],
  templateUrl: './termini-kolokvijuma.html',
  styleUrl: './termini-kolokvijuma.css',
})
export class TerminiKolokvijuma implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private api = environment.apiUrl;

  uloga = localStorage.getItem('uloga') || 'asistent';
  jeAdmin = this.uloga === 'admin';

  rows = signal<RedPredmeta[]>([]);
  ucitava = signal(true);
  greska = signal('');

  // Pretraga i filteri za administratorsku tabelu.
  tekstPretrage = '';
  filterGodina = 'sve';
  filterSemestar = 'sve';

  ngOnInit(): void {
    const url = this.jeAdmin
      ? '/termini-kolokvijuma/sve'
      : '/termini-kolokvijuma/moji';

    this.http.get<any[]>(`${this.api}${url}`).subscribe({
      next: (predmeti) => {
        this.rows.set(predmeti.map((p) => this.uRed(p)));
        this.ucitava.set(false);
      },
      error: (err) => {
        this.greska.set(
          err.error?.message || 'Greška pri učitavanju predmeta.'
        );
        this.ucitava.set(false);
      },
    });
  }

  private uRed(p: any): RedPredmeta {
    const t = p.terminiKolokvijuma || {};

    return {
      id: p.id,
      naziv: p.naziv,
      godina: p.godina,
      semestar: p.semestar,
      status: p.status,
      profesor: p.profesor || null,
      broj_studenata: p.broj_studenata ?? null,
      saradniciTekst: this.izvuciSaradnike(p),
      terminiKolokvijuma: t,

      k: [1, 2, 3].map((n) => ({
        datum: izServera(t[`k${n}_datum`]),
        trajanje: t[`k${n}_trajanje`] ?? null,
        racunarskaSala: !!t[`k${n}_racunarska_sala`],
        dezurni: t[`k${n}_dezurni`] ?? null,
      })),

      popravniDatum: izServera(t.popravni_datum),
      popravniUTerminuIspita: !!t.popravni_u_terminu_ispita,
      popravniTrajanje: t.popravni_trajanje ?? null,
      popravniRacunarskaSala: !!t.popravni_racunarska_sala,
      popravniDezurni: t.popravni_dezurni ?? null,
      napomena: t.napomena || '',
      cuva: false,
      izmenjen: false,
    };
  }

  private izvuciSaradnike(p: any): string {
    const vrednost =
      p.saradniciTekst ??
      p.saradnici_tekst ??
      p.saradnici ??
      '';

    if (typeof vrednost === 'string') {
      return vrednost;
    }

    if (Array.isArray(vrednost)) {
      return vrednost
        .map((s: any) => {
          if (typeof s === 'string') {
            return s;
          }

          const ime = s?.ime ?? s?.firstName ?? s?.first_name ?? '';
          const prezime = s?.prezime ?? s?.lastName ?? s?.last_name ?? '';

          return (
            `${ime} ${prezime}`.trim() ||
            s?.naziv ||
            s?.name ||
            ''
          );
        })
        .filter((s: string) => Boolean(s))
        .join(', ');
    }

    return '';
  }

  private normalizujTekst(vrednost: unknown): string {
    return String(vrednost ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'dj')
      .toLowerCase()
      .trim();
  }

  filtriraniRedovi(): RedPredmeta[] {
    const pretraga = this.normalizujTekst(this.tekstPretrage);

    return this.rows().filter((r) => {
      const odgovaraGodina =
        this.filterGodina === 'sve' ||
        String(r.godina) === this.filterGodina;

      const semestar = this.normalizujTekst(this.nazivSemestra(r.semestar));
      const odgovaraSemestar =
        this.filterSemestar === 'sve' ||
        semestar.startsWith(this.normalizujTekst(this.filterSemestar));

      const imeProfesora =
        `${r.profesor?.ime ?? ''} ${r.profesor?.prezime ?? ''}`;

      const tekstReda = this.normalizujTekst(
        [r.naziv, imeProfesora, r.saradniciTekst].join(' ')
      );

      const odgovaraPretraga =
        !pretraga || tekstReda.includes(pretraga);

      return odgovaraGodina && odgovaraSemestar && odgovaraPretraga;
    });
  }

  datumZaPrikaz(datum: string): string {
    const m = String(datum || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : datum;
  }

  oznaciIzmenu(r: RedPredmeta): void {
    r.izmenjen = true;
  }

  sacuvaj(r: RedPredmeta): void {
    r.cuva = true;

    const telo: any = {
      predmet_id: r.id,
      popravni_datum: r.popravniUTerminuIspita
        ? null
        : naServer(r.popravniDatum),
      popravni_u_terminu_ispita: r.popravniUTerminuIspita,
      popravni_trajanje: r.popravniTrajanje,
      popravni_racunarska_sala: r.popravniRacunarskaSala,
      popravni_dezurni: r.popravniDezurni,
      napomena: r.napomena || null,
    };

    r.k.forEach((k, i) => {
      telo[`k${i + 1}_datum`] = naServer(k.datum);
      telo[`k${i + 1}_trajanje`] = k.trajanje;
      telo[`k${i + 1}_racunarska_sala`] = k.racunarskaSala;
      telo[`k${i + 1}_dezurni`] = k.dezurni;
    });

    this.http
      .post<any>(`${this.api}/termini-kolokvijuma/sacuvaj`, telo)
      .subscribe({
        next: () => {
          r.cuva = false;
          r.izmenjen = false;

          // Ažuriramo lokalni prikaz nakon uspešnog odgovora servera.
          r.terminiKolokvijuma = {
            ...r.terminiKolokvijuma,
            popravni_datum: telo.popravni_datum,
            popravni_u_terminu_ispita: r.popravniUTerminuIspita,
            popravni_trajanje: r.popravniTrajanje,
            popravni_racunarska_sala: r.popravniRacunarskaSala,
            popravni_dezurni: r.popravniDezurni,
            napomena: r.napomena || null,
          };

          this.rows.set([...this.rows()]);
          this.toast.show(
            `Sačuvani termini za predmet „${r.naziv}“.`,
            'success'
          );
        },
        error: (err) => {
          r.cuva = false;
          this.rows.set([...this.rows()]);
          this.toast.show(
            err.error?.message || 'Greška pri čuvanju termina.',
            'error'
          );
        },
      });
  }

  izveziExcel(): void {
    this.http
      .get(`${this.api}/termini-kolokvijuma/export-excel`, {
        responseType: 'blob',
      })
      .subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'Izbor_termina_kolokvijuma.xlsx';
          a.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.toast.show('Greška pri izvozu Excel fajla.', 'error');
        },
      });
  }

  nazivSemestra(s: string): string {
    return String(s ?? '').toLowerCase().startsWith('z')
      ? 'Zimski semestar'
      : 'Letnji semestar';
  }
}
