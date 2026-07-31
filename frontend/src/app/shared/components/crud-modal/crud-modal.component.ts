import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-crud-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './crud-modal.component.html',
  styleUrl: './crud-modal.component.css'
})
export class CrudModal {
  formData: any = {};

  constructor(
    public dialogRef: MatDialogRef<CrudModal>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string, columns: any[], rowData?: any }
  ) {
    // Ako smo kliknuli na Edit (imamo rowData), popunjavamo formu
    // U suprotnom ostaje prazan objekat za dodavanje novog
    if (this.data.rowData) {
      this.formData = { ...this.data.rowData };
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    this.dialogRef.close(this.formData);
  }
}