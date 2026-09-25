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
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './crud-modal.component.html',
  styleUrl: './crud-modal.component.css'
})
export class CrudModal {
  formData: any = {};
  searchQuery: string = '';
  showError: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<CrudModal>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string, columns: any[], rowData?: any, saradniciList?: any[], profesoriList?: any[], predmetiList?: any[], rolesList?: any[] }
  ) {
      if (this.data.rowData) {
        this.formData = { ...this.data.rowData };

        if ('password' in this.formData) {
          this.formData.password = '********';
        }

        if (this.formData.datum && this.formData.datum.includes('T')) {
          this.formData.datum = this.formData.datum.split('T')[0];
        }

        // ⬇️ PROVJERAVAMO I 'angazovanja' (kako Prisma vraća) I 'predmeti' ⬇️
        const predmetiNiz = this.formData.angazovanja || this.formData.predmeti;

        if (predmetiNiz && Array.isArray(predmetiNiz)) {
          this.formData.predmeti_ids = predmetiNiz.map((p: any) => Number(p.id));
        } else if (Array.isArray(this.formData.predmeti_ids)) {
          this.formData.predmeti_ids = this.formData.predmeti_ids.map((id: any) => Number(id));
        } else {
          this.formData.predmeti_ids = [];
        }
      } else {
        this.formData.predmeti_ids = [];
      }

      if (this.hasSaradniciColumn && !this.formData.saradnici_ids) {
        this.formData.saradnici_ids = [];
      }
    }

  get hasSaradniciColumn(): boolean {
    return this.data.columns.some(c => c.key === 'saradnici_ids');
  }

  getPredmetById(id: number): any {
    if (!this.data.predmetiList) return null;
    return this.data.predmetiList.find((p: any) => p.id === Number(id));
  }

  // ⬇️ DODATO: Uklanjanje predmeta direktno klikom na 'x' na bedžu ⬇️
  ukloniPredmet(predmetId: number): void {
    if (this.formData.predmeti_ids) {
      this.formData.predmeti_ids = this.formData.predmeti_ids.filter((id: number) => Number(id) !== Number(predmetId));
    }
  }

  get dostupniSaradnici() {
    if (!this.data.saradniciList) return [];
    return this.data.saradniciList.filter(s => 
      !this.formData.saradnici_ids.includes(s.id) &&
      `${s.ime} ${s.prezime}`.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }

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
    const requiredCols = this.data.columns.filter(c => {
      if (c.key === 'id' || c.key === 'saradnici_ids' || c.key === 'predmeti_ids') return false;
      if (c.key === 'password' && this.formData.id) return false; 
      return true;
    });

    const isFormValid = requiredCols.every(col => {
      const val = this.formData[col.key];
      return val !== undefined && val !== null && String(val).trim() !== '';
    });

    if (!isFormValid) {
      this.showError = true;
      return;
    }
    this.showError = false;

    const sanitizedData = { ...this.formData };
    
    if (sanitizedData.password === '********' || !sanitizedData.password) {
      delete sanitizedData.password;
    }

    if (sanitizedData.godina) sanitizedData.godina = Number(sanitizedData.godina);
    if (sanitizedData.broj_studenata) sanitizedData.broj_studenata = Number(sanitizedData.broj_studenata);
    if (sanitizedData.profesor_id) sanitizedData.profesor_id = Number(sanitizedData.profesor_id);
    if (sanitizedData.predmet_id) sanitizedData.predmet_id = Number(sanitizedData.predmet_id);
    if (sanitizedData.sala_id) sanitizedData.sala_id = Number(sanitizedData.sala_id);

    this.dialogRef.close(sanitizedData);
  }
}