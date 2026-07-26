import { Component, OnInit, ChangeDetectorRef} from '@angular/core';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { HttpClient } from '@angular/common/http';

export type EntityType = 'profesori' | 'predmeti' | 'ispiti';

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
export class DatabaseManagement implements OnInit{
  activeEntity: EntityType = 'profesori';
  tableData: any[] = [];
  displayedColumnsKeys: string[] = [];
  currentColumnsDef: ColumnDef[] = [];
  loading: boolean = false;

  private API_URL = 'http://localhost:5000';

  // Konfiguracija kolona za svaku tabelu
  private columnConfigurations: Record<EntityType, ColumnDef[]> = {
    profesori: [
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
      profesori: '/profesors',
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
}
