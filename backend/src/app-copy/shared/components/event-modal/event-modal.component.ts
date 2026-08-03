import { Component, Inject, OnInit, inject } from '@angular/core';
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
  
  formData = {
    startTime: '',
    endTime: '',
    room: '',
    dezurni_ids: [] as number[]
  };
  
  showError = false;
  odsustvoErrorPoruka = ''; // Poruka ako korisnik pokuša da sačuva odsutnog
  timeSlots: string[] = [];
  slobodniSaradnici: any[] = [];
  izabraniSaradnici: any[] = [];
  odsutniSaradniciMap = new Map<number, string>();

  constructor(
    public dialogRef: MatDialogRef<EventModal>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; date: string; startTime?: string; endTime?: string; room?: string; predmetId?: number; dezurni?: any[] } 
  ) {
    if (this.data.startTime) this.formData.startTime = this.data.startTime;
    if (this.data.endTime) this.formData.endTime = this.data.endTime;
    if (this.data.room) this.formData.room = this.data.room;
    if (this.data.dezurni) {
      this.izabraniSaradnici = [...this.data.dezurni];
      this.formData.dezurni_ids = this.izabraniSaradnici.map(s => s.id);
    }
  }

  ngOnInit(): void {
    this.generateTimeSlots();
    this.fetchDostupneSaradnikeIOdsustva();
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

  fetchDostupneSaradnikeIOdsustva(): void {
    console.log('--- DEBUG START ---');
    console.log('Datum modala (data.date):', this.data.date);

    forkJoin({
      saradnici: this.http.get<any[]>('http://localhost:5000/profesors'),
      obaveze: this.http.get<any[]>('http://localhost:5000/obaveze')
    }).subscribe({
      next: ({ saradnici, obaveze }) => {
        console.log('Svi dohvaćeni saradnici:', saradnici);
        console.log('Sve dohvaćene obaveze iz baze:', obaveze);

        const datumModala = new Date(this.data.date).setHours(0, 0, 0, 0);
        this.odsutniSaradniciMap.clear();

        if (Array.isArray(obaveze)) {
          obaveze.forEach((o, index) => {
            // Normalizacija datuma od-do
            const odStr = o.datum ? o.datum.split('T')[0] : '';
            const doStr = o.datum_do ? o.datum_do.split('T')[0] : odStr;

            const odDate = new Date(odStr).setHours(0, 0, 0, 0);
            const doDate = new Date(doStr).setHours(0, 0, 0, 0);

            console.log(`Obaveza #${index + 1}:`, {
              saradnik_id: o.saradnik_id,
              odDatum: odStr,
              doDatum: doStr,
              pogodak: datumModala >= odDate && datumModala <= doDate
            });

            // Ako se datum poklapa
            if (datumModala >= odDate && datumModala <= doDate) {
              const razlog = o.tip_obaveze ? `: ${o.tip_obaveze}` : '';
              // Preveravamo i brojčani i tekstualni ID za svaki slučaj
              this.odsutniSaradniciMap.set(Number(o.saradnik_id), `Nedostupan/na u ovom terminu${razlog}`);
            }
          });
        }

        console.log('Mapa odsutnih saradnika (ID -> Poruka):', Array.from(this.odsutniSaradniciMap.entries()));

        // Provera i izbacivanje iz već izabranih dežurnih
        const ocisceniIzabrani = this.izabraniSaradnici.filter(s => {
          const sId = Number(s.id);
          const jeOdsutan = this.odsutniSaradniciMap.has(sId);
          if (jeOdsutan) {
            console.warn(`[BLOKADA] Saradnik ${s.ime} (ID: ${sId}) je uklonjen iz izabranih jer ima odsustvo!`);
          }
          return !jeOdsutan;
        });

        this.izabraniSaradnici = ocisceniIzabrani;
        this.formData.dezurni_ids = this.izabraniSaradnici.map(s => Number(s.id));

        // Filtriranje slobodnih saradnika u desnoj koloni
        this.slobodniSaradnici = saradnici.filter(s => !this.formData.dezurni_ids.includes(Number(s.id)));
        console.log('Konačna lista slobodnih saradnika u desnoj koloni:', this.slobodniSaradnici);
        console.log('--- DEBUG END ---');
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
    if (confirm('Da li ste sigurni da želite da obrišete ovaj termin?')) {
      this.dialogRef.close({ action: 'delete', eventId: this.data.predmetId });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }
  
  onSave(): void {
    // Provera da li slučajno u izabranim postoji odsutan saradnik
    const imaOdsutnih = this.izabraniSaradnici.some(s => this.odsutniSaradniciMap.has(s.id));
    
    if (imaOdsutnih) {
      this.odsustvoErrorPoruka = 'Jedan ili više izabranih saradnika su odsutni u ovom terminu!';
      return;
    }

    if (this.formData.startTime && this.formData.endTime && this.formData.room) {
      this.showError = false;
      this.odsustvoErrorPoruka = '';
      this.dialogRef.close({ ...this.data, ...this.formData, izabraniSaradnici: this.izabraniSaradnici });
    } else {
      this.showError = true;
    }
  }
}