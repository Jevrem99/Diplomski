import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Observable } from 'rxjs';
import { HINTOVI, Polja, procitajGresku, validirajGrupu, validirajIspit, validirajKorisnika, validirajOsobu, validirajPredmet } from '../../../core/utils/validacija';

type Vrsta = 'korisnik' | 'predmet' | 'osoba' | 'ispit' | 'grupa' | 'drugo';
type TipPolja = 'text' | 'password' | 'number' | 'date' | 'time' | 'pills' | 'select' | 'multi';

// SVG putanje (24x24, linije) za ikone u poljima i zaglavlju
const IKONE: Record<string, string> = {
  korisnik: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  osobe: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  email: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  lozinka: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
  broj: 'M7 20l4-16m2 16l4-16M6 9h14M4 15h14',
  knjiga: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  kalendar: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  sat: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  oznaka: 'M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z',
};

@Component({
  selector: 'app-crud-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './crud-modal.component.html',
  styleUrl: './crud-modal.component.css'
})
export class CrudModal {
  formData: any = {};
  searchQuery: string = '';
  generalError = '';
  saving = false;

  // Stanje provere u realnom vremenu
  touched: Record<string, boolean> = {};
  submitted = false;
  liveErrors: Polja = {};
  serverErrors: Polja = {};
  prikaziLozinku = false;

  constructor(
    public dialogRef: MatDialogRef<CrudModal>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string, columns: any[], rowData?: any, saradniciList?: any[], profesoriList?: any[], predmetiList?: any[], rolesList?: any[], submit?: (payload: any) => Observable<any> }
  ) {
    if (this.data.rowData) {
      this.formData = { ...this.data.rowData };

      if ('password' in this.formData) {
        this.formData.password = '********';
      }

      if (this.formData.datum && this.formData.datum.includes('T')) {
        this.formData.datum = this.formData.datum.split('T')[0];
      }
      if (this.formData.vreme && String(this.formData.vreme).length > 5) this.formData.vreme = String(this.formData.vreme).substring(0, 5);
      if (this.formData.vreme_kraja && String(this.formData.vreme_kraja).length > 5) this.formData.vreme_kraja = String(this.formData.vreme_kraja).substring(0, 5);

      // Prisma vraća 'angazovanja' (a ponegde 'predmeti')
      const predmetiNiz = this.formData.angazovanja || this.formData.predmeti;

      if (predmetiNiz && Array.isArray(predmetiNiz)) {
        this.formData.predmeti_ids = predmetiNiz.map((p: any) => Number(p.id));
      } else if (Array.isArray(this.formData.predmeti_ids)) {
        this.formData.predmeti_ids = this.formData.predmeti_ids.map((id: any) => Number(id));
      } else {
        this.formData.predmeti_ids = [];
      }
    } else {
      this.formData.predmeti_ids = [];
    }

    if (this.hasSaradniciColumn && !this.formData.saradnici_ids) {
      this.formData.saradnici_ids = [];
    }
    this.osveziProveru();
  }

  // ---------- vrsta zapisa i opis polja ----------

  get jeIzmena(): boolean { return !!this.formData.id; }

  get vrsta(): Vrsta {
    const k = this.data.columns.map((c) => c.key);
    if (k.includes('username')) return 'korisnik';
    if (k.includes('sifra')) return 'predmet';
    if (k.includes('ime') && k.includes('prezime')) return 'osoba';
    if (k.includes('predmet_id') && k.includes('datum')) return 'ispit';
    if (k.length === 2 && k.includes('naziv') && k.includes('predmeti_ids')) return 'grupa';
    return 'drugo';
  }

  get ikonaZaglavlja(): string {
    return ({ korisnik: IKONE['korisnik'], predmet: IKONE['knjiga'], osoba: IKONE['osobe'], ispit: IKONE['kalendar'], grupa: IKONE['knjiga'], drugo: IKONE['oznaka'] } as Record<string, string>)[this.vrsta];
  }

  get podnaslov(): string {
    return this.jeIzmena
      ? 'Izmenite podatke i sačuvajte.'
      : 'Popunite podatke. Polja označena zvezdicom su obavezna.';
  }

  // Polja koja forma prikazuje u mreži (id i liste idu na druga mesta)
  get polja(): any[] {
    return this.data.columns.filter((c) => !['id', 'saradnici_ids'].includes(c.key));
  }

  tipPolja(key: string): TipPolja {
    if (key === 'password') return 'password';
    if (key === 'uloga' || key === 'semestar' || key === 'status') return 'pills';
    if (key === 'profesor_id' || key === 'predmet_id') return 'select';
    if (key === 'predmeti_ids') return 'multi';
    if (key === 'godina' || key === 'broj_studenata') return 'number';
    if (key.includes('datum')) return 'date';
    if (key.includes('vreme')) return 'time';
    return 'text';
  }

  ikonaPolja(key: string): string {
    if (['ime', 'prezime', 'username'].includes(key)) return IKONE['korisnik'];
    if (key === 'email') return IKONE['email'];
    if (key === 'password') return IKONE['lozinka'];
    if (key === 'sifra' || key === 'godina' || key === 'broj_studenata' || key === 'sala_id') return IKONE['broj'];
    if (key === 'naziv' || key === 'predmet_id') return IKONE['knjiga'];
    if (key.includes('datum')) return IKONE['kalendar'];
    if (key.includes('vreme')) return IKONE['sat'];
    return IKONE['oznaka'];
  }

  opcije(key: string): { value: any; label: string }[] {
    if (key === 'uloga') return (this.data.rolesList || []).map((r: any) => ({ value: r.id, label: r.naziv }));
    if (key === 'semestar') return [{ value: 'Zimski', label: 'Zimski' }, { value: 'Letnji', label: 'Letnji' }];
    if (key === 'status') return [{ value: 'О', label: 'Obavezan' }, { value: 'И', label: 'Izborni' }]; // ćirilica, kao u bazi
    return [];
  }

  izborZaSelect(key: string): { id: any; naziv: string }[] {
    if (key === 'profesor_id') return (this.data.profesoriList || []).map((p: any) => ({ id: p.id, naziv: `${p.ime} ${p.prezime}` }));
    if (key === 'predmet_id') return (this.data.predmetiList || []).map((p: any) => ({ id: p.id, naziv: p.naziv }));
    return [];
  }

  obavezno(key: string): boolean {
    if (key === 'predmeti_ids') return this.vrsta === 'grupa';
    if (['id', 'saradnici_ids'].includes(key)) return false;
    if (key === 'password' && this.jeIzmena) return false;
    if (this.vrsta === 'osoba' && key === 'email') return false;
    if (this.vrsta === 'predmet' && ['broj_studenata', 'status', 'profesor_id'].includes(key)) return false;
    if (this.vrsta === 'ispit' && ['vreme_kraja', 'sala_id'].includes(key)) return false;
    return true;
  }

  hint(key: string): string {
    return HINTOVI[key] || '';
  }

  // ---------- provera u realnom vremenu ----------

  private podaciZaProveru(): any {
    const p = { ...this.formData };
    if (p.password === '********' || !p.password) delete p.password;
    return p;
  }

  private proveriPolja(podaci: any): Polja {
    switch (this.vrsta) {
      case 'korisnik': return validirajKorisnika(podaci, !this.jeIzmena);
      case 'predmet': return validirajPredmet(podaci);
      case 'osoba': return validirajOsobu(podaci);
      case 'ispit': return validirajIspit(podaci);
      case 'grupa': return validirajGrupu(podaci);
      default: return {};
    }
  }

  osveziProveru(): void {
    this.liveErrors = this.proveriPolja(this.podaciZaProveru());
  }

  // Poziva se pri svakoj izmeni polja
  promena(key: string): void {
    this.touched[key] = true;
    delete this.serverErrors[key];
    this.generalError = '';
    this.osveziProveru();
  }

  dodir(key: string): void {
    this.touched[key] = true;
  }

  greska(key: string): string {
    if (!this.touched[key] && !this.submitted) return '';
    return this.serverErrors[key] || this.liveErrors[key] || '';
  }

  prazno(key: string): boolean {
    const v = this.formData[key];
    if (Array.isArray(v)) return v.length === 0;
    return v === undefined || v === null || String(v).trim() === '' || (key === 'password' && v === '********');
  }

  valjano(key: string): boolean {
    return (this.touched[key] || this.submitted) && !this.prazno(key) && !this.liveErrors[key] && !this.serverErrors[key];
  }

  get napredak(): { gotovo: number; ukupno: number; procenat: number } {
    const obavezna = this.polja.filter((c) => this.obavezno(c.key));
    const gotovo = obavezna.filter((c) => !this.prazno(c.key) && !this.liveErrors[c.key]).length;
    const ukupno = obavezna.length;
    return { gotovo, ukupno, procenat: ukupno ? Math.round((gotovo / ukupno) * 100) : 100 };
  }

  // ---------- lozinka ----------

  fokusLozinke(): void {
    // pri izmeni se prikazuje "********"; pri unosu nove lozinke polje se prvo isprazni
    if (this.formData.password === '********') {
      this.formData.password = '';
      this.promena('password');
    }
  }

  get jacinaLozinke(): { nivo: 0 | 1 | 2 | 3; tekst: string } {
    const l = String(this.formData.password || '');
    if (!l || l === '********') return { nivo: 0, tekst: '' };
    let bodovi = 0;
    if (l.length >= 8) bodovi++;
    if (/[A-Za-z]/.test(l) && /\d/.test(l)) bodovi++;
    if (l.length >= 12 || (/[A-Z]/.test(l) && /[a-z]/.test(l) && /[^A-Za-z0-9]/.test(l))) bodovi++;
    const nivo = (bodovi === 0 ? 1 : bodovi) as 1 | 2 | 3;
    return { nivo, tekst: ['', 'Slaba', 'Srednja', 'Jaka'][nivo] };
  }

  // ---------- brojevi i izbori ----------

  korak(key: string, delta: number): void {
    const min = key === 'godina' ? 1 : 0;
    const trenutno = Number(this.formData[key]);
    const novo = Math.max(min, (Number.isFinite(trenutno) ? trenutno : min) + delta);
    this.formData[key] = novo;
    this.promena(key);
  }

  izaberi(key: string, vrednost: any): void {
    this.formData[key] = vrednost;
    this.promena(key);
  }

  // ---------- predmeti / saradnici ----------

  get hasSaradniciColumn(): boolean {
    return this.data.columns.some(c => c.key === 'saradnici_ids');
  }

  getPredmetById(id: number): any {
    if (!this.data.predmetiList) return null;
    return this.data.predmetiList.find((p: any) => p.id === Number(id));
  }

  ukloniPredmet(predmetId: number): void {
    if (this.formData.predmeti_ids) {
      this.formData.predmeti_ids = this.formData.predmeti_ids.filter((id: number) => Number(id) !== Number(predmetId));
      this.promena('predmeti_ids');
    }
  }

  get dostupniSaradnici() {
    if (!this.data.saradniciList) return [];
    return this.data.saradniciList.filter(s =>
      !this.formData.saradnici_ids.includes(s.id) &&
      `${s.ime} ${s.prezime}`.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  get izabraniSaradniciObjekti() {
    if (!this.data.saradniciList || !this.formData.saradnici_ids) return [];
    return this.data.saradniciList.filter(s => this.formData.saradnici_ids.includes(s.id));
  }

  dodajSaradnika(id: number): void {
    if (!this.formData.saradnici_ids.includes(id)) {
      this.formData.saradnici_ids.push(id);
    }
  }

  ukloniSaradnika(id: number): void {
    this.formData.saradnici_ids = this.formData.saradnici_ids.filter((sId: number) => sId !== id);
  }

  // ---------- čuvanje ----------

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.submitted = true;
    this.osveziProveru();

    if (Object.keys(this.liveErrors).length > 0) {
      const broj = Object.keys(this.liveErrors).length;
      this.generalError = broj === 1 ? 'Ima jedno polje koje treba ispraviti.' : `Ima ${broj} polja koja treba ispraviti.`;
      return;
    }

    // ostale vrste (bez pravila): bar obavezna polja moraju biti popunjena
    const nedostaje = this.polja.filter((c) => this.obavezno(c.key) && this.prazno(c.key));
    if (nedostaje.length > 0) {
      nedostaje.forEach((c) => (this.touched[c.key] = true));
      this.generalError = 'Popunite sva obavezna polja.';
      return;
    }
    this.generalError = '';

    const sanitizedData = { ...this.formData };

    if (sanitizedData.password === '********' || !sanitizedData.password) {
      delete sanitizedData.password;
    }

    if (sanitizedData.godina) sanitizedData.godina = Number(sanitizedData.godina);
    if (sanitizedData.broj_studenata) sanitizedData.broj_studenata = Number(sanitizedData.broj_studenata);
    if (sanitizedData.profesor_id) sanitizedData.profesor_id = Number(sanitizedData.profesor_id);
    if (sanitizedData.predmet_id) sanitizedData.predmet_id = Number(sanitizedData.predmet_id);
    if (sanitizedData.sala_id) sanitizedData.sala_id = Number(sanitizedData.sala_id);

    if (this.data.submit) {
      // Prozor ostaje otvoren dok server ne potvrdi; ako odbije, razlog se prikazuje u formi
      this.saving = true;
      this.data.submit(sanitizedData).subscribe({
        next: () => this.dialogRef.close(true),
        error: (err) => {
          const { opsta, polja } = procitajGresku(err, 'Greška pri čuvanju podataka.');
          this.serverErrors = polja;
          Object.keys(polja).forEach((k) => (this.touched[k] = true));
          this.generalError = opsta;
          this.saving = false;
        },
      });
      return;
    }

    this.dialogRef.close(sanitizedData);
  }
}
