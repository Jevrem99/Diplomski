import { Component, Inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-event-modal',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule
  ],
  templateUrl: './event-modal.component.html',
  styleUrl: './event-modal.component.css'
})
export class EventModal implements OnInit {
  formData = {
    startTime: '',
    endTime: '',
    room: ''
  };

  showError = false;
  timeSlots: string[] = [];

  constructor(
    public dialogRef: MatDialogRef<EventModal>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; date: string }
  ) {}

  ngOnInit(): void {
    this.generateTimeSlots();
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

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.formData.startTime && this.formData.endTime && this.formData.room) {
      this.showError = false;
      this.dialogRef.close({ ...this.data, ...this.formData });
    } else {
      this.showError = true;
    }
  }
}