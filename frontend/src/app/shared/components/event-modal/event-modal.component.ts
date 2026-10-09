import { ChangeDetectorRef, Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { HttpClient } from '@angular/common/http';
import { MatIcon } from "@angular/material/icon";

import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DataCacheService } from '../../../core/services/data-cache.service';
import { trajanjeUSatima, formatSati } from '../../../core/utils/vreme';

@Component({
  selector: 'app-event-modal',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, MatDialogModule,
    MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatIcon
  ],
  templateUrl: './event-modal.component.html',
  styleUrl: './event-modal.component.css'
})
export class EventModal implements OnInit {
  private http = inject(HttpClient);
  private cache = inject(DataCacheService);
  private cdr = inject(ChangeDetectorRef);
  formData = {
    startTime: '',
    endTime: '',
    tip_kolokvijuma: 'I',
    room: '',
    is_ispit: true,
    dezurni_ids: [] as number[]
  };
  
  showError = false;
  odsustvoErrorPoruka = ''; 
  timeSlots: string[] = [];
  slobodniSaradnici: any[] = [];
  izabraniSaradnici: any[] = [];
  sveUcionice: any[] = [];
  odsutniSaradniciMap = new Map<number, string>();

  // Sortiranje liste dostupnih saradnika (podrazumevano: ko ima najmanje sati dežurstva)
  sortiranje: 'manje' | 'vise' | 'prezime' = 'manje';

  satiSaradnika(s: any): number {
    return this.data.satiPoSaradniku?.[Number(s.id)]?.sati ?? 0;
  }
  brojDezurstava(s: any): number {
    return this.data.satiPoSaradniku?.[Number(s.id)]?.broj ?? 0;
  }
  jeNaPredmetu(s: any): boolean {
    return (this.data.saradniciPredmeta || []).includes(Number(s.id));
  }
  // Trajanje termina koji se upravo zakazuje (0 dok vreme početka nije izabrano)
  get trajanjeOvogTermina(): number {
    return this.formData.startTime ? trajanjeUSatima(this.formData.startTime, this.formData.endTime) : 0;
  }
  sati(n: number): string {
    return formatSati(n);
  }

  get sortiraniSaradnici(): any[] {
    const prezime = (a: any, b: any) => `${a.prezime} ${a.ime}`.localeCompare(`${b.prezime} ${b.ime}`, 'sr');
    return [...this.slobodniSaradnici].sort((a, b) => {
      // odsutni uvek na dnu
      const oa = this.odsutniSaradniciMap.has(a.id) ? 1 : 0;
      const ob = this.odsutniSaradniciMap.has(b.id) ? 1 : 0;
      if (oa !== ob) return oa - ob;
      if (this.sortiranje === 'prezime') return prezime(a, b);
      const razlika = this.satiSaradnika(a) - this.satiSaradnika(b);
      return (this.sortiranje === 'manje' ? razlika : -razlika) || prezime(a, b);
    });
  }

  // Potreban broj dežurnih koji je saradnik uneo na stranici "Termini kolokvijuma" (samo za kolokvijume)
  get potrebnoDezurnih(): number | null {
    const t = this.data.potrebnoDezurnih;
    if (!t || this.formData.is_ispit) return null;
    const tip = String(this.formData.tip_kolokvijuma || 'I').trim().toLowerCase();
    let v: number | null | undefined = null;
    if (tip.includes('поправни') || tip.includes('popravni')) v = t.popravni_dezurni;
    else if (tip === 'iii') v = t.k3_dezurni;
    else if (tip === 'ii') v = t.k2_dezurni;
    else if (tip === 'i') v = t.k1_dezurni;
    return typeof v === 'number' ? v : null;
  }

  constructor(
    public dialogRef: MatDialogRef<EventModal>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; date: string; startTime?: string; endTime?: string; room?: string; predmetId?: number; dezurni?: any[], zauzeteSaleNaDan?: any[], is_ispit?: boolean, tip_kolokvijuma?: string,
      satiPoSaradniku?: Record<number, { sati: number; broj: number }>, saradniciPredmeta?: number[], grupaPredmeti?: string[],
      potrebnoDezurnih?: { k1_dezurni?: number | null; k2_dezurni?: number | null; k3_dezurni?: number | null; popravni_dezurni?: number | null } | null } 
  ) {
    if (this.data.startTime) this.formData.startTime = this.data.startTime;
    if (this.data.endTime) this.formData.endTime = this.data.endTime;
    if (this.data.room) this.formData.room = this.data.room;
    if (this.data.is_ispit !== undefined) this.formData.is_ispit = this.data.is_ispit;
    if (this.data.tip_kolokvijuma) this.formData.tip_kolokvijuma = this.data.tip_kolokvijuma; // <--- DODANO OVDJ
    if (this.data.dezurni) {
      this.izabraniSaradnici = [...this.data.dezurni];
      this.formData.dezurni_ids = this.izabraniSaradnici.map(s => s.id);
    }
  }

  ngOnInit(): void {
    this.generateTimeSlots();
    this.fetchDostupneSaradnikeIOdsustva();
    this.fetchUcionice();
  }

  generateTimeSlots(): void {
    const slots: string[] = [];
    for (let hour = 7; hour <= 21; hour++) {
      const hStr = hour < 10 ? `0${hour}` : `${hour}`;
      slots.push(`${hStr}:00`, `${hStr}:15`, `${hStr}:30`, `${hStr}:45`);
    }
    slots.push('22:00');
    this.timeSlots = slots;
  }

  fetchUcionice(): void {
    this.cache.get<any[]>('/ucionice', 300_000).subscribe({
      next: (res) => {
        console.log('Učionice stigle sa beka:', res);
        this.sveUcionice = res;
        this.cdr.detectChanges(); // <--- OBAVEZNO: primorava Angular da osveži padajući meni
      },
      error: (err) => console.error('Greška pri dohvatanju učionica:', err)
    });
  }

  fetchDostupneSaradnikeIOdsustva(): void {
    forkJoin({
      saradnici: this.cache.get<any[]>('/profesors'),
      obaveze: this.cache.get<any[]>('/obaveze')
    }).subscribe({
      next: ({ saradnici, obaveze }) => {
        const datumModala = new Date(this.data.date).setHours(0, 0, 0, 0);
        this.odsutniSaradniciMap.clear();

        if (Array.isArray(obaveze)) {
          obaveze.forEach((o) => {
            const odStr = o.datum ? o.datum.split('T')[0] : '';
            const doStr = o.datum_do ? o.datum_do.split('T')[0] : odStr;
            const odDate = new Date(odStr).setHours(0, 0, 0, 0);
            const doDate = new Date(doStr).setHours(0, 0, 0, 0);

            if (datumModala >= odDate && datumModala <= doDate) {
              const razlog = o.tip_obaveze ? `: ${o.tip_obaveze}` : '';
              this.odsutniSaradniciMap.set(Number(o.saradnik_id), `Nedostupan/na u ovom terminu${razlog}`);
            }
          });
        }

        const ocisceniIzabrani = this.izabraniSaradnici.filter(s => !this.odsutniSaradniciMap.has(Number(s.id)));
        this.izabraniSaradnici = ocisceniIzabrani;
        this.formData.dezurni_ids = this.izabraniSaradnici.map(s => Number(s.id));
        this.slobodniSaradnici = saradnici.filter(s => !this.formData.dezurni_ids.includes(Number(s.id)));
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Greška pri dohvatanju obaveza ili saradnika:', err);
      }
    });
  }

  dodajDezurnog(saradnik: any): void {
    if (this.odsutniSaradniciMap.has(saradnik.id)) return;
    this.izabraniSaradnici.push(saradnik);
    this.formData.dezurni_ids.push(saradnik.id);
    this.slobodniSaradnici = this.slobodniSaradnici.filter(s => s.id !== saradnik.id);
  }

  ukloniDezurnog(saradnik: any): void {
    this.izabraniSaradnici = this.izabraniSaradnici.filter(s => s.id !== saradnik.id);
    this.formData.dezurni_ids = this.formData.dezurni_ids.filter(id => id !== saradnik.id);
    this.slobodniSaradnici.push(saradnik);
  }

  onDelete(): void {
    const pitanje = this.data.grupaPredmeti?.length
      ? `Termin je deo grupe (${this.data.grupaPredmeti.length} predmeta). Obrisati termine svih predmeta iz grupe?`
      : 'Da li ste sigurni da želite da obrišete ovaj termin?';
    if (confirm(pitanje)) {
      this.dialogRef.close({ action: 'delete', eventId: this.data.predmetId });
    }
  }

  private timeToMins(timeStr: string): number {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
  }

  isSalaZauzeta(salaNaziv: string): boolean {
    if (!this.formData.startTime || !this.data.zauzeteSaleNaDan) return false;
    const start1 = this.timeToMins(this.formData.startTime);
    const end1 = this.formData.endTime ? this.timeToMins(this.formData.endTime) : (start1 + 120);

    return this.data.zauzeteSaleNaDan.some((z: any) => {
      if (z.sala !== salaNaziv || z.sala === 'Bez sale') return false;
      const start2 = this.timeToMins(z.vreme);
      const end2 = z.vremeKraja ? this.timeToMins(z.vremeKraja) : (start2 + 120);
      return start1 < end2 && start2 < end1; 
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
  
  // Kraj termina mora biti posle početka (isto pravilo proverava i server)
  get vremeGreska(): string {
    const { startTime, endTime } = this.formData;
    if (startTime && endTime && this.timeToMins(endTime) <= this.timeToMins(startTime)) {
      return 'Vreme kraja mora biti posle vremena početka.';
    }
    return '';
  }

  onSave(): void {
    if (this.vremeGreska) return;
    const imaOdsutnih = this.izabraniSaradnici.some(s => this.odsutniSaradniciMap.has(s.id));
    if (imaOdsutnih) {
      this.odsustvoErrorPoruka = 'Jedan ili više izabranih saradnika su odsutni u ovom terminu!';
      return;
    }

    if (this.formData.startTime && this.formData.endTime && this.formData.room) {
      this.showError = false;
      this.odsustvoErrorPoruka = '';
      this.dialogRef.close({ 
        ...this.data, 
        ...this.formData, 
        tip_kolokvijuma: this.formData.tip_kolokvijuma || 'I', // <--- EKSPLICITNO PROSLEDITI
        izabraniSaradnici: this.izabraniSaradnici 
      });
    } else {
      this.showError = true;
    }
  }
}