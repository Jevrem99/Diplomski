import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../core/services/toast.service';
import { forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { procitajGresku } from '../../core/utils/validacija';

@Component({
  selector: 'app-moja-dezurstva',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './moja-dezurstva.component.html'
})
export class MojaDezurstva implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private API_URL = environment.apiUrl;

  userEmail = localStorage.getItem('email');
  saradnikId: number | null = null;
  
  viewMode: 'calendar' | 'list' = 'calendar';

  svaDezurstva: any[] = [];
  predstojecaDezurstva: any[] = [];
  proslaDezurstva: any[] = [];

  // Zahtevi za zamenu
  zahtevi: any[] = [];
  zamenaModal = false;
  zamenaDez: any = null;
  zamenaRazlog = '';
  zamenaPredlozeniId: number | null = null;
  zamenaKolege: any[] = [];
  zamenaGreska = '';
  zamenaSlanje = false;

  currentMonth = new Date();
  calendarDays: { date: Date, inMonth: boolean }[] = [];
  nedelje = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

  ngOnInit(): void {
    // 1. GENERIŠEMO DANE ODMAH pri inicijalizaciji
    this.generateCalendar();
    this.pronadjiSaradnika();
  }

  pronadjiSaradnika(): void {
  const storedEmail = (localStorage.getItem('email') || '').trim().toLowerCase();
  const storedUsername = (localStorage.getItem('username') || '').trim().toLowerCase();

  this.http.get<any[]>(`${this.API_URL}/profesors`).subscribe({
    next: (sviZaposleni) => {
      // Tražimo podudaranje po email-u ILI po imenu/prezimenu/username-u
      const ulogovanSaradnik = sviZaposleni.find(s => {
        const dbEmail = (s.email || '').trim().toLowerCase();
        const dbPunoIme = `${s.ime} ${s.prezime}`.trim().toLowerCase();
        const dbIme = (s.ime || '').trim().toLowerCase();

        return (
          (storedEmail && dbEmail === storedEmail) ||
          (storedUsername && (dbPunoIme.includes(storedUsername) || dbIme === storedUsername))
        );
      });

      if (ulogovanSaradnik) {
        this.saradnikId = ulogovanSaradnik.id;
        this.fetchDezurstva();
      } else {
        this.toast.show('Profil saradnika nije pronađen u bazi!', 'error');
      }
    },
    error: (err) => console.error('Greška pri traženju saradnika:', err)
  });
}

  fetchDezurstva(): void {
  if (!this.saradnikId) return;

  // Parallelno povlačimo dežurstva i obaveze (odsustva)
  forkJoin({
    dezurstva: this.http.get<any[]>(`${this.API_URL}/dezurstva/saradnik/${this.saradnikId}`),
    obaveze: this.http.get<any[]>(`${this.API_URL}/obaveze/${this.saradnikId}`)
  }).subscribe({
    next: ({ dezurstva, obaveze }) => {
      const danas = new Date();
      danas.setHours(0, 0, 0, 0);

      this.svaDezurstva = [];
      this.predstojecaDezurstva = [];
      this.proslaDezurstva = [];

      // 1. Obrada dežurstava iz baze
      dezurstva.forEach(dez => {
        if (!dez.ispit) return;
        const datumIspita = new Date(dez.ispit.datum);
        const formatirano = {
          ...dez,
          datum_obj: datumIspita,
          isOdsustvo: false,
          vreme_str: dez.ispit.vreme ? (dez.ispit.vreme.includes('T') ? dez.ispit.vreme.substring(11, 16) : dez.ispit.vreme.substring(0, 5)) : '??:??',
          vreme_kraja_str: dez.ispit.vreme_kraja ? (dez.ispit.vreme_kraja.includes('T') ? dez.ispit.vreme_kraja.substring(11, 16) : dez.ispit.vreme_kraja.substring(0, 5)) : ''
        };
        this.svaDezurstva.push(formatirano);
        if (datumIspita >= danas) this.predstojecaDezurstva.push(formatirano);
        else this.proslaDezurstva.push(formatirano);
      });

      // 2. Obrada obaveza (odsustava) iz baze
      obaveze.forEach(obs => {
        const dStart = new Date(obs.datum);
        const dEnd = obs.datum_do ? new Date(obs.datum_do) : dStart;

        // Prolazimo kroz sve dane u rasponu odsustva
        for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
          const currentD = new Date(d);
          this.svaDezurstva.push({
            id: 'obs_' + obs.id,
            datum_obj: currentD,
            isOdsustvo: true,
            tip: obs.tip_obaveze || 'Odsutan/na',
            vreme_str: obs.vreme_pocetka ? obs.vreme_pocetka.substring(0, 5) : 'CEO DAN',
            ispit: {
              predmet: { naziv: `ODSUSTVO: ${obs.tip_obaveze || 'Privatno'}` },
              sala: { naziv: 'Nije dostupno' }
            }
          });
        }
      });

      this.generateCalendar();
      this.cdr.detectChanges();
      this.ucitajZahteve();
    }
  });
}

  // ---------- Zamena dežurstva ----------

  ucitajZahteve(): void {
    this.http.get<any[]>(`${this.API_URL}/zamene/moje`).subscribe({
      next: (z) => { this.zahtevi = z; this.cdr.detectChanges(); },
      error: () => { /* zahtevi nisu kritični za prikaz rasporeda */ }
    });
  }

  // Zahtev na čekanju za dato dežurstvo (ako postoji)
  zahtevNaCekanju(dez: any): any {
    return this.zahtevi.find((z) => z.dezurstvo_id === dez.id && z.status === 'na_cekanju');
  }

  otvoriZamenu(dez: any): void {
    this.zamenaDez = dez;
    this.zamenaRazlog = '';
    this.zamenaPredlozeniId = null;
    this.zamenaKolege = [];
    this.zamenaGreska = '';
    this.zamenaModal = true;
    this.http.get<any[]>(`${this.API_URL}/zamene/kolege/${dez.id}`).subscribe({
      next: (k) => { this.zamenaKolege = k; this.cdr.detectChanges(); },
      error: () => { this.zamenaKolege = []; }
    });
  }

  posaljiZahtev(): void {
    if (this.zamenaRazlog.trim().length < 5) {
      this.zamenaGreska = 'Navedite razlog (najmanje 5 karaktera).';
      return;
    }
    this.zamenaSlanje = true;
    this.http.post(`${this.API_URL}/zamene`, {
      dezurstvo_id: this.zamenaDez.id,
      razlog: this.zamenaRazlog.trim(),
      predlozeni_id: this.zamenaPredlozeniId
    }).subscribe({
      next: () => {
        this.zamenaSlanje = false;
        this.zamenaModal = false;
        this.toast.show('Zahtev za zamenu je poslat administratoru.', 'success');
        this.ucitajZahteve();
      },
      error: (err) => {
        this.zamenaSlanje = false;
        const { opsta, polja } = procitajGresku(err, 'Zahtev nije poslat.');
        this.zamenaGreska = polja['razlog'] || opsta;
        this.cdr.detectChanges();
      }
    });
  }

  povuciZahtev(z: any): void {
    if (!confirm('Povući zahtev za zamenu?')) return;
    this.http.delete(`${this.API_URL}/zamene/${z.id}`).subscribe({
      next: () => { this.toast.show('Zahtev je povučen.', 'success'); this.ucitajZahteve(); },
      error: (err) => this.toast.show(procitajGresku(err, 'Povlačenje nije uspelo.').opsta, 'error')
    });
  }

  nazivStatusa(status: string): string {
    return ({ na_cekanju: 'Na čekanju', odobren: 'Odobren', odbijen: 'Odbijen', otkazan: 'Povučen' } as Record<string, string>)[status] || status;
  }

  // ---------- Kalendar (.ics) ----------

  izveziKalendar(): void {
    this.http.get(`${this.API_URL}/dezurstva/moj-kalendar.ics`, { responseType: 'blob' }).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'moja-dezurstva.ics';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => this.toast.show(procitajGresku(err, 'Izvoz kalendara nije uspeo.').opsta, 'error')
    });
  }

  generateCalendar(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

    let startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; 
    this.calendarDays = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      this.calendarDays.push({ date: new Date(year, month - 1, prevMonthDays - i), inMonth: false });
    }

    for (let i = 1; i <= daysInCurrentMonth; i++) {
      this.calendarDays.push({ date: new Date(year, month, i), inMonth: true });
    }

    const remainingDays = 42 - this.calendarDays.length; 
    for (let i = 1; i <= remainingDays; i++) {
      this.calendarDays.push({ date: new Date(year, month + 1, i), inMonth: false });
    }
  }

  menjajMesec(offset: number): void {
    this.currentMonth = new Date(this.currentMonth.setMonth(this.currentMonth.getMonth() + offset));
    this.generateCalendar();
  }

  nazivMeseca(): string {
    const meseci = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
    return `${meseci[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}.`;
  }

  getDezurstvaZaDan(date: Date): any[] {
    const dStr = this.formatDateToISO(date);
    return this.svaDezurstva.filter(dez => this.formatDateToISO(dez.datum_obj) === dStr);
  }

  formatDateToISO(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  isDanas(date: Date): boolean {
    return this.formatDateToISO(date) === this.formatDateToISO(new Date());
  }
}