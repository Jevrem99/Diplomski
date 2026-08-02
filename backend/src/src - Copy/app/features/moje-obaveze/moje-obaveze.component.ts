import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-moje-obaveze',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './moje-obaveze.component.html',
  styleUrls: ['./moje-obaveze.component.css']
})
export class MojeObaveze implements OnInit {
  private http = inject(HttpClient);
  private toast = inject(ToastService);
  private cdr = inject(ChangeDetectorRef); // <-- REŠAVA PROBLEM OSVEŽAVANJA LISTE
  private API_URL = 'http://localhost:5000';

  userEmail = localStorage.getItem('email');
  saradnikId: number | null = null;
  obaveze: any[] = [];

  // --- CUSTOM KALENDAR LOGIKA ---
  currentDate = new Date();
  daysInMonth: { date: Date, inMonth: boolean }[] = [];
  nedelje = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

  isVisednevno: boolean = false;
  
  formData = {
    datum: null as Date | string | null,
    datum_do: null as Date | string | null,
    vreme_pocetka: '',
    vreme_kraja: '',
    tip_obaveze: ''
  };

  ngOnInit(): void {
    this.generateCalendar();
    this.pronadjiSaradnika();
  }

  // Povezivanje profila
  pronadjiSaradnika(): void {
    this.http.get<any[]>(`${this.API_URL}/profesors`).subscribe({
      next: (sviZaposleni) => {
        if (!this.userEmail) return;
        const ulogovanMejl = this.userEmail.trim().toLowerCase();
        const ulogovanSaradnik = sviZaposleni.find(s => s.email && s.email.trim().toLowerCase() === ulogovanMejl);

        if (ulogovanSaradnik) {
          this.saradnikId = ulogovanSaradnik.id;
          this.fetchObaveze();
        } else {
          this.toast.show('Vaš email nije povezan ni sa jednim profilom!', 'error');
        }
      }
    });
  }

  fetchObaveze(): void {
    if (!this.saradnikId) return;
    this.http.get<any[]>(`${this.API_URL}/obaveze/${this.saradnikId}`).subscribe({
      next: (data) => {
        this.obaveze = data.map(item => ({
          ...item,
          vreme_pocetka_str: item.vreme_pocetka ? (item.vreme_pocetka.includes('T') ? item.vreme_pocetka.substring(11, 16) : item.vreme_pocetka.substring(0, 5)) : '',
          vreme_kraja_str: item.vreme_kraja ? (item.vreme_kraja.includes('T') ? item.vreme_kraja.substring(11, 16) : item.vreme_kraja.substring(0, 5)) : ''
        }));
        // FORSIRANO OSVEŽAVANJE HTML-a:
        this.cdr.detectChanges(); 
      }
    });
  }

  // --- GENERISANJE CUSTOM KALENDARA ---
  generateCalendar(): void {
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();

    let startDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1; // Pon = 0
    this.daysInMonth = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = startDay - 1; i >= 0; i--) {
      this.daysInMonth.push({ date: new Date(year, month - 1, prevMonthDays - i), inMonth: false });
    }

    for (let i = 1; i <= daysInCurrentMonth; i++) {
      this.daysInMonth.push({ date: new Date(year, month, i), inMonth: true });
    }

    const remainingDays = 42 - this.daysInMonth.length;
    for (let i = 1; i <= remainingDays; i++) {
      this.daysInMonth.push({ date: new Date(year, month + 1, i), inMonth: false });
    }
  }

  menjajMesec(offset: number): void {
    this.currentDate = new Date(this.currentDate.setMonth(this.currentDate.getMonth() + offset));
    this.generateCalendar();
  }

  nazivMeseca(): string {
    const meseci = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
    return `${meseci[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}.`;
  }

  // --- LOGIKA KLIKANJA NA DANE ---
  onDateClick(day: { date: Date, inMonth: boolean }): void {
    const clickedDate = day.date;

    if (!this.isVisednevno) {
      this.formData.datum = clickedDate;
      this.formData.datum_do = null;
    } else {
      if (!this.formData.datum || (this.formData.datum && this.formData.datum_do)) {
        this.formData.datum = clickedDate;
        this.formData.datum_do = null;
      } else {
        const start = new Date(this.formData.datum as any);
        if (clickedDate < start) {
          this.formData.datum = clickedDate;
        } else {
          this.formData.datum_do = clickedDate;
        }
      }
    }
  }

  formatDateToISO(date: any): string {
    if (!date) return '';
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  }

  // --- BOJENJE KALENDARA ---
  isSelected(date: Date): boolean {
    if (!this.formData.datum) return false;
    const dStr = this.formatDateToISO(date);
    const startStr = this.formatDateToISO(this.formData.datum);
    const endStr = this.formData.datum_do ? this.formatDateToISO(this.formData.datum_do) : null;
    return dStr === startStr || dStr === endStr;
  }

  isInRange(date: Date): boolean {
    if (!this.isVisednevno || !this.formData.datum || !this.formData.datum_do) return false;
    const d = new Date(this.formatDateToISO(date)).getTime();
    const s = new Date(this.formatDateToISO(this.formData.datum)).getTime();
    const e = new Date(this.formatDateToISO(this.formData.datum_do)).getTime();
    return d > s && d < e;
  }

  toggleRezim(visednevno: boolean): void {
    this.isVisednevno = visednevno;
    this.formData.datum = null;
    this.formData.datum_do = null;
  }

  // ---  ČUVANJE ---
  onSubmit(): void {
    if (!this.saradnikId) return;
    if (!this.formData.datum) {
      this.toast.show('Izaberite datum na kalendaru!', 'error');
      return;
    }
    if (this.isVisednevno && !this.formData.datum_do) {
      this.toast.show('Izaberite krajnji datum na kalendaru!', 'error');
      return;
    }
    if (!this.isVisednevno && (!this.formData.vreme_pocetka || !this.formData.vreme_kraja)) {
      this.toast.show('Unesite vreme početka i kraja!', 'error');
      return;
    }

    const payload = {
      saradnik_id: this.saradnikId,
      datum: this.formatDateToISO(this.formData.datum),
      datum_do: this.isVisednevno ? this.formatDateToISO(this.formData.datum_do) : null,
      vreme_pocetka: !this.isVisednevno ? this.formData.vreme_pocetka : null,
      vreme_kraja: !this.isVisednevno ? this.formData.vreme_kraja : null,
      tip_obaveze: this.formData.tip_obaveze
    };

    this.http.post(`${this.API_URL}/obaveze`, payload).subscribe({
      next: () => {
        this.toast.show('Zauzetost uspešno prijavljena!', 'success');
        this.fetchObaveze(); // Momentalno osvežava listu desno!
        this.toggleRezim(this.isVisednevno);
        this.formData.vreme_pocetka = '';
        this.formData.vreme_kraja = '';
        this.formData.tip_obaveze = '';
      }
    });
  }

  obrisiObavezu(id: number): void {
    if (confirm('Da li želite da obrišete ovu prijavu?')) {
      this.http.delete(`${this.API_URL}/obaveze/${id}`).subscribe({
        next: () => {
          this.toast.show('Zauzetost obrisana.', 'success');
          this.fetchObaveze();
        }
      });
    }
  }
}