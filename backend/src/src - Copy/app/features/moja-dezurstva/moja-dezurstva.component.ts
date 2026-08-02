import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../core/services/toast.service';

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
    this.http.get<any[]>(`${this.API_URL}/profesors`).subscribe({
      next: (sviZaposleni) => {
        if (!this.userEmail) return;
        const ulogovanMejl = this.userEmail.trim().toLowerCase();
        const ulogovanSaradnik = sviZaposleni.find(s => s.email && s.email.trim().toLowerCase() === ulogovanMejl);

        if (ulogovanSaradnik) {
          this.saradnikId = ulogovanSaradnik.id;
          this.fetchDezurstva();
        } else {
          this.toast.show('Vaš profil nije pronađen.', 'error');
        }
      }
    });
  }

  fetchDezurstva(): void {
    if (!this.saradnikId) return;
    
    this.http.get<any[]>(`${this.API_URL}/dezurstva/saradnik/${this.saradnikId}`).subscribe({
      next: (data) => {
        const danas = new Date();
        danas.setHours(0, 0, 0, 0);

        this.svaDezurstva = [];
        this.predstojecaDezurstva = [];
        this.proslaDezurstva = [];

        data.forEach(dez => {
          if (!dez.ispit) return;

          const datumIspita = new Date(dez.ispit.datum);
          const formatiranoDezurstvo = {
            ...dez,
            datum_obj: datumIspita,
            vreme_str: dez.ispit.vreme ? (dez.ispit.vreme.includes('T') ? dez.ispit.vreme.substring(11, 16) : dez.ispit.vreme.substring(0, 5)) : '??:??',
            vreme_kraja_str: dez.ispit.vreme_kraja ? (dez.ispit.vreme_kraja.includes('T') ? dez.ispit.vreme_kraja.substring(11, 16) : dez.ispit.vreme_kraja.substring(0, 5)) : ''
          };

          this.svaDezurstva.push(formatiranoDezurstvo);

          if (datumIspita >= danas) {
            this.predstojecaDezurstva.push(formatiranoDezurstvo);
          } else {
            this.proslaDezurstva.push(formatiranoDezurstvo);
          }
        });

        // Osiguravamo da Angular odmah przkaže unete podatke
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Greška pri učitavanju dežurstava', err)
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