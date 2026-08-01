import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-crud-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule,MatSelectModule],
  templateUrl: './crud-modal.component.html',
  styleUrl: './crud-modal.component.css'
})
export class CrudModal {
  formData: any = {};
  searchQuery: string = '';
  showError: boolean = false;
  constructor(
    public dialogRef: MatDialogRef<CrudModal>,
    // OBAVEZNO DODATI profesoriList i predmetiList ispod
    @Inject(MAT_DIALOG_DATA) public data: { title: string, columns: any[], rowData?: any, saradniciList?: any[], profesoriList?: any[], predmetiList?: any[] }
  ) {
    if (this.data.rowData) {
      this.formData = { ...this.data.rowData };
      
      // Ako formatiramo datum iz baze (YYYY-MM-DDTHH:mm:ss -> YYYY-MM-DD)
      if (this.formData.datum && this.formData.datum.includes('T')) {
        this.formData.datum = this.formData.datum.split('T')[0];
      }
    }
    if (this.hasSaradniciColumn && !this.formData.saradnici_ids) {
      this.formData.saradnici_ids = [];
    }
  }
  
  // Proverava da li trenutna tabela ima kolonu za saradnike
  get hasSaradniciColumn(): boolean {
    return this.data.columns.some(c => c.key === 'saradnici_ids');
  }

  // GORNJA LISTA: Filtrira po pretrazi i sklanja one koji su već izabrani
  get dostupniSaradnici() {
    if (!this.data.saradniciList) return [];
    return this.data.saradniciList.filter(s => 
      !this.formData.saradnici_ids.includes(s.id) &&
      `${s.ime} ${s.prezime}`.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

  // DONJA LISTA (Spakovani): Nalazi cele objekte na osnovu ID-jeva iz formData
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

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    // 1. Nalazimo sve kolone koje korisnik mora da popuni (preskačemo ID i saradnici_ids)
    const requiredCols = this.data.columns.filter(c => c.key !== 'id' && c.key !== 'saradnici_ids');

    // 2. Proveravamo da li je baš svako polje popunjeno
    const isFormValid = requiredCols.every(col => {
      const val = this.formData[col.key];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });

    if (!isFormValid) {
      this.showError = true;
      return;
    }

    this.showError = false;

    // 3. Sanitizacija podataka - pretvaramo brojevna polja u Number
    const sanitizedData = { ...this.formData };
    
    if (sanitizedData.godina) sanitizedData.godina = Number(sanitizedData.godina);
    if (sanitizedData.broj_studenata) sanitizedData.broj_studenata = Number(sanitizedData.broj_studenata);
    if (sanitizedData.profesor_id) sanitizedData.profesor_id = Number(sanitizedData.profesor_id);
    if (sanitizedData.predmet_id) sanitizedData.predmet_id = Number(sanitizedData.predmet_id);
    if (sanitizedData.sala_id) sanitizedData.sala_id = Number(sanitizedData.sala_id);

    this.dialogRef.close(sanitizedData);
  }
}