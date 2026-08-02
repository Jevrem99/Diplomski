import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-event-modal',
  standalone: true,
  imports: [
    CommonModule, DatePipe, FormsModule, MatDialogModule,
    MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule
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
  timeSlots: string[] = [];
  
  slobodniSaradnici: any[] = [];
  izabraniSaradnici: any[] = [];

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
    this.fetchDostupneSaradnike();
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

  fetchDostupneSaradnike(): void {
    // Ovde možemo napraviti logiku da dovuče samo saradnike sa ovog predmeta, 
    // ali za početak vučemo sve saradnike da bi radilo vizuelno
    this.http.get<any[]>('http://localhost:5000/profesors/saradnici').subscribe({
      next: (data) => {
        // Prikazujemo samo one koji nisu već izabrani
        this.slobodniSaradnici = data.filter(s => !this.formData.dezurni_ids.includes(s.id));
      }
    });
  }

  dodajDezurnog(saradnik: any): void {
    this.izabraniSaradnici.push(saradnik);
    this.formData.dezurni_ids.push(saradnik.id);
    this.slobodniSaradnici = this.slobodniSaradnici.filter(s => s.id !== saradnik.id);
  }

  ukloniDezurnog(saradnik: any): void {
    this.izabraniSaradnici = this.izabraniSaradnici.filter(s => s.id !== saradnik.id);
    this.formData.dezurni_ids = this.formData.dezurni_ids.filter(id => id !== saradnik.id);
    this.slobodniSaradnici.push(saradnik);
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.formData.startTime && this.formData.endTime && this.formData.room) {
      this.showError = false;
      this.dialogRef.close({ ...this.data, ...this.formData, izabraniSaradnici: this.izabraniSaradnici });
    } else {
      this.showError = true;
    }
  }
}