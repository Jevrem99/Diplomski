import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { HttpClient } from '@angular/common/http';

export type EntityType = 'profesori' | 'predmeti' | 'ispiti' | 'saradnici';

interface ColumnDef {
  key: string;      // ključ u JSON objektu sa bekena
  label: string;    // naziv u zaglavlju tabele
}

@Component({
  selector: 'app-database-management',
  standalone: true,
  imports: [
    SidebarMenu
  ],
  templateUrl: './database-management.html',
  styleUrl: './database-management.css',
})
export class DatabaseManagement implements OnInit {
  activeEntity: EntityType = 'profesori';
  tableData: any[] = [];
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

  fetchData(entity: EntityType): void {
    this.loading = true;
    const endpointMap: Record<EntityType, string> = {
      profesori: '/profesors/profesori',
      saradnici: '/profesors/saradnici',
      predmeti: '/predmet',
      ispiti: '/ispit'
    };

    this.http.get<any[]>(`${this.API_URL}${endpointMap[entity]}`).subscribe({
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