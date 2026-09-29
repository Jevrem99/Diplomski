import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface RokIzvoz {
  naziv: string;
  datumOd: string;
  datumDo: string;
}

export interface ExportDataResult {
  tip: 'ispiti' | 'kolokvijumi';
  naslovRasporeda: string;
  isApsolventski?: boolean;
  datumOd?: string;
  datumDo?: string;
  rokovi?: RokIzvoz[];
  action?: 'export' | 'pick_range';
  pickingTarget?: 'kolokvijumi' | number; // 'kolokvijumi' ili indeks roka
}

@Component({
  selector: 'app-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './export-modal.component.html',
  styleUrls: ['./export-modal.component.css']
})
export class ExportModalComponent {
  private dialogRef = inject(MatDialogRef);
  public data = inject(MAT_DIALOG_DATA, { optional: true });

  izvozPodaci: ExportDataResult = {
    tip: 'ispiti',
    isApsolventski: false,
    naslovRasporeda: '',
    datumOd: '',
    datumDo: '',
    rokovi: [
      { naziv: 'I ispitni rok', datumOd: '', datumDo: '' }
    ]
  };

  constructor() {
    if (this.data && this.data.tip) {
      this.izvozPodaci = JSON.parse(JSON.stringify(this.data));
    } else {
      const danas = new Date();
      this.izvozPodaci.datumOd = danas.toISOString().split('T')[0];
      const sledeciMesec = new Date();
      sledeciMesec.setMonth(sledeciMesec.getMonth() + 1);
      this.izvozPodaci.datumDo = sledeciMesec.toISOString().split('T')[0];
    }
  }

  // OVO JE NEDOSTAJALO:
  formatirajDatumPrikaz(datumStr: string): string {
  if (!datumStr) return '';
  const cistDatum = datumStr.includes('T') ? datumStr.split('T')[0] : datumStr;
  const delovi = cistDatum.split('-');
  if (delovi.length !== 3) return datumStr;
  
  const y = delovi[0];
  const m = delovi[1];
  const d = delovi[2];
  
  return d + '.' + m + '.' + y + '.';
}

  promeniTip(): void {
    if (this.izvozPodaci.tip === 'ispiti') {
      this.izvozPodaci.naslovRasporeda = 'Распоред испита у апсолвентским роковима\nза предмете са ОАС и МАС Информатике';
    } else {
      this.izvozPodaci.naslovRasporeda = 'Распоред колоквијума на ОАС Информатика\nлетњи семестар 2025/26';
    }
  }

  dodajRok(): void {
    const rBr = (this.izvozPodaci.rokovi?.length || 0) + 1;
    this.izvozPodaci.rokovi?.push({ naziv: `${rBr}. ispitni rok`, datumOd: '', datumDo: '' });
  }

  obrisiRok(index: number): void {
    if (this.izvozPodaci.rokovi && this.izvozPodaci.rokovi.length > 1) {
      this.izvozPodaci.rokovi.splice(index, 1);
    }
  }

  izaberiNaKalendaru(target: 'kolokvijumi' | number): void {
    this.dialogRef.close({
      ...this.izvozPodaci,
      action: 'pick_range',
      pickingTarget: target
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  onSave(): void {
    if (this.izvozPodaci.tip === 'kolokvijumi') {
      if (!this.izvozPodaci.datumOd || !this.izvozPodaci.datumDo) {
        alert('Molimo unesite oba datuma za kolokvijume.');
        return;
      }
    } else {
      const neispravniRokovi = this.izvozPodaci.rokovi?.some(r => !r.naziv || !r.datumOd || !r.datumDo);
      if (neispravniRokovi || !this.izvozPodaci.rokovi || this.izvozPodaci.rokovi.length === 0) {
        alert('Molimo popunite sve podatke za odabrane rokove.');
        return;
      }
    }

    this.dialogRef.close({
      ...this.izvozPodaci,
      action: 'export'
    });
  }
}