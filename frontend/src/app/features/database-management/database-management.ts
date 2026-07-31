import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CrudModal } from '../../shared/components/crud-modal/crud-modal.component';
import { ToastService } from '../../core/services/toast.service';
export type EntityType = 'profesori' | 'predmeti' | 'ispiti' | 'saradnici';

interface ColumnDef {
  key: string;      // ključ u JSON objektu sa bekena
  label: string;    // naziv u zaglavlju tabele
}

@Component({
  selector: 'app-database-management',
  standalone: true,
  imports: [
    SidebarMenu,MatDialogModule
  ],
  templateUrl: './database-management.html',
  styleUrl: './database-management.css',
})
export class DatabaseManagement implements OnInit {
  activeEntity: EntityType = 'profesori';
  tableData: any[] = [];
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);
  displayedColumnsKeys: string[] = [];
  currentColumnsDef: ColumnDef[] = [];
  loading: boolean = false;
  uploading: boolean = false; // Status za učitavanje fajla
  
  private API_URL = 'http://localhost:5000';

  // Konfiguracija kolona za svaku tabelu
  private columnConfigurations: Record<EntityType, ColumnDef[]> = {
    profesori: [
      { key: 'id', label: 'ID' },
      { key: 'ime', label: 'Ime' },
      { key: 'prezime', label: 'Prezime' },
      { key: 'email', label: 'E-mail' }
    ],
    saradnici: [
      { key: 'id', label: 'ID' },
      { key: 'ime', label: 'Ime' },
      { key: 'prezime', label: 'Prezime' },
      { key: 'email', label: 'E-mail' }
    ],
    predmeti: [
      { key: 'id', label: 'ID' },
      { key: 'sifra', label: 'Šifra' },
      { key: 'naziv', label: 'Naziv predmeta' },
      { key: 'godina', label: 'Godina' },
      { key: 'semestar', label: 'Semestar' },
      { key: 'status', label: 'Status' },
    ],
    ispiti: [
      { key: 'id', label: 'ID' },
      { key: 'predmet_id', label: 'ID Predmeta' },
      { key: 'datum', label: 'Datum polaganja' },
      { key: 'vreme', label: 'Vreme' }
    ]
  };

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Po učitavanju stranice odmah prikazujemo profesore
    this.selectEntity('profesori');
  }

  selectEntity(entity: EntityType): void {
    this.activeEntity = entity;
    this.currentColumnsDef = this.columnConfigurations[entity];
    this.displayedColumnsKeys = this.currentColumnsDef.map(col => col.key);
    
    this.fetchData(entity);
  }
  private getEndpoint(entity: EntityType): string {
    const endpointMap: Record<EntityType, string> = {
      profesori: '/profesors/profesori',
      saradnici: '/profesors/saradnici',
      predmeti: '/predmet',
      ispiti: '/ispit'
    };
    return `${this.API_URL}${endpointMap[entity]}`;
  }

  fetchData(entity: EntityType): void {
    this.loading = true;
    this.http.get<any[]>(this.getEndpoint(entity)).subscribe({
      next: (data) => {
        this.tableData = data;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Greška pri dohvatanju podataka:', err);
        this.tableData = [];
        this.loading = false;
      }
    });
  }

  // --- CRUD OPERACIJE ---

  openCrudModal(): void {
    const dialogRef = this.dialog.open(CrudModal, {
      width: '500px',
      data: {
        title: `Dodaj: ${this.activeEntity}`,
        columns: this.currentColumnsDef
      },
      disableClose: true // Sprečava zatvaranje klikom sa strane
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // HTTP POST za kreiranje novog entiteta
        this.http.post(this.getEndpoint(this.activeEntity), result).subscribe({
          next: () => {
            this.toast.show('Uspešno dodato u bazu!', 'success');
            this.fetchData(this.activeEntity); // Osvežavamo tabelu
          },
          error: (err) => {
            console.error('Greška pri dodavanju:', err);
            this.toast.show('Greška pri čuvanju podataka.', 'error');
          }
        });
      }
    });
  }

  editRow(row: any): void {
    const dialogRef = this.dialog.open(CrudModal, {
      width: '500px',
      data: {
        title: `Izmeni: ${this.activeEntity}`,
        columns: this.currentColumnsDef,
        rowData: row // Šaljemo postojeće podatke da bi forma bila popunjena
      },
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        // HTTP PUT za ažuriranje postojećeg entiteta (gađamo /ruta/:id)
        this.http.put(`${this.getEndpoint(this.activeEntity)}/${row.id}`, result).subscribe({
          next: () => {
            this.toast.show('Uspešno izmenjeno!', 'success');
            this.fetchData(this.activeEntity);
          },
          error: (err) => {
            console.error('Greška pri izmeni:', err);
            this.toast.show('Greška pri izmeni podataka.', 'error');
          }
        });
      }
    });
  }

  deleteRow(id: number): void {
    if (confirm('Da li ste sigurni da želite da obrišete ovaj zapis?')) {
      // HTTP DELETE za brisanje entiteta (gađamo /ruta/:id)
      this.http.delete(`${this.getEndpoint(this.activeEntity)}/${id}`).subscribe({
        next: () => {
          this.toast.show('Zapis je obrisan!', 'success');
          this.fetchData(this.activeEntity);
        },
        error: (err) => {
          console.error('Greška pri brisanju:', err);
          this.toast.show('Greška pri brisanju zapisa.', 'error');
        }
      });
    }
  }
  

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];

    if (file) {
      const formData = new FormData();
      // Ključ mora biti tačno 'excelFile' jer ga Multer tako očekuje
      formData.append('excelFile', file);

      this.uploading = true;

      // Zameniti '/api/import-excel' sa tačnom putanjom rute sa tvog bekenda
      this.http.post<any>(`${this.API_URL}/upload/import-excel`, formData).subscribe({
        next: (response) => {
          this.uploading = false;
          // Osveži trenutno aktivnu tabelu da se vide novi podaci
          this.fetchData(this.activeEntity);
        },
        error: (err) => {
          console.error('Greška pri slanju Excel fajla:', err);
          alert('Greška pri uvozu: ' + (err.error?.message || err.message));
          this.uploading = false;
        }
      });
      
      // Resetuj vrednost inputa kako bi korisnik mogao ponovo odabrati isti fajl ako zeli
      event.target.value = '';
    }
  }

  deleteDatabase(): void {
    if (confirm('Da li ste sigurni da želite da obrišete celu bazu podataka? Ova akcija je nepovratna.')) {
      this.http.post<any>(`${this.API_URL}/admin/reset-database`,{}).subscribe({
        next: () => {
          alert('Baza podataka je uspešno obrisana.');
          this.tableData = [];
          this.fetchData(this.activeEntity);
        },
        error: (err) => {
          console.error('Greška pri brisanju baze podataka:', err);
          alert('Greška pri brisanju baze podataka: ' + (err.error?.message || err.message));
        }
      });
    }
  }
  
}