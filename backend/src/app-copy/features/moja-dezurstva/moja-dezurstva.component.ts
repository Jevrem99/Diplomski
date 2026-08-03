import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../core/services/toast.service';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-moja-dezurstva',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './moja-dezurstva.component.html'
})
export class MojaDezurstva implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);
  private API_URL = 'http://localhost:5000';

  userEmail = localStorage.getItem('email');
  saradnikId: number | null = null;
  
  viewMode: 'calendar' | 'list' = 'calendar';

  svaDezurstva: any[] = [];
  predstojecaDezurstva: any[] = [];
  proslaDezurstva: any[] = [];

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
    }
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