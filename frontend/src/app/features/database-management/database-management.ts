import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { HttpClient } from '@angular/common/http';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CrudModal } from '../../shared/components/crud-modal/crud-modal.component';
import { ToastService } from '../../core/services/toast.service';
import { forkJoin } from 'rxjs';
export type EntityType = 'profesori' | 'predmeti' | 'ispiti' | 'saradnici' | 'korisnici' | 'dnevnik';

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
  allSaradnici: any[] = []; // Dodaj ovu liniju blizu vrha klase
  allProfesori: any[] = []; // DODATO
  allPredmeti: any[] = [];
  allRoles: any[] = [];

  private columnConfigurations: Record<EntityType, ColumnDef[]> = {
    dnevnik: [
      { key: 'id', label: 'ID' },
      { key: 'created_at', label: 'Vreme' },
      { key: 'korisnik', label: 'Korisnik' },
      { key: 'akcija', label: 'Akcija' },
      { key: 'entitet', label: 'Entitet' },
      { key: 'detalji', label: 'Detalji' }
    ],
    korisnici: [
      { key: 'id', label: 'ID' },
      { key: 'username', label: 'Korisničko ime' },
      { key: 'email', label: 'E-mail' },
      { key: 'password', label: 'Lozinka' }, // Popravljen naziv
      { key: 'uloga', label: 'Uloga' }
    ],
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
      { key: 'profesor_id', label: 'Glavni profesor (ID)' }, 
      { key: 'status', label: 'Status (O / I)' },// Ako i to želiš
      { key: 'broj_studenata', label: 'Broj studenata' },
      { key: 'saradnici_ids', label: 'Saradnici na predmetu' } // <--- DODATO
    ],
    ispiti: [
      { key: 'id', label: 'ID' },
      { key: 'predmet_id', label: 'Predmet' }, // Postaje padajući meni
      { key: 'datum', label: 'Datum polaganja' },
      { key: 'vreme', label: 'Vreme početka' },
      { key: 'vreme_kraja', label: 'Vreme kraja' }, // <--- DODATO
      { key: 'sala_id', label: 'Sala' }
    ]
  };

  constructor(
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {}

 ngOnInit(): void {
  this.selectEntity('profesori');
  
  this.http.get<any[]>(`${this.API_URL}/profesors/saradnici`).subscribe(data => this.allSaradnici = data);
  this.http.get<any[]>(`${this.API_URL}/profesors`).subscribe(data => this.allProfesori = data);
  this.http.get<any[]>(`${this.API_URL}/predmet`).subscribe(data => this.allPredmeti = data);
  this.http.get<any[]>(`${this.API_URL}/users/roles`).subscribe(data => this.allRoles = data); // <--- DODATO
}
  getSingularName(entity: string): string {
    if (entity === 'predmeti') return 'predmet';
    if (entity === 'ispiti') return 'ispit';
    if (entity === 'profesori') return 'profesora';
    if (entity === 'sale') return 'salu';
    if (entity === 'saradnici') return 'saradnik';
    if (entity === 'korisnici') return 'korisnika';
    return entity;
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
      ispiti: '/ispit',
      korisnici: '/users',
      dnevnik: '/admin/logs'
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
      width: '850px',
      data: {
        title: `Dodaj ${this.activeEntity === 'profesori' ? 'profesora' : this.activeEntity === 'saradnici' ? 'saradnika' : this.activeEntity === 'predmeti' ? 'predmet' : 'ispit'}`,
        columns: this.currentColumnsDef,
        saradniciList: this.allSaradnici,
        profesoriList: this.allProfesori, 
        predmetiList: this.allPredmeti,
        rolesList: this.allRoles
      },
      disableClose: true
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
    // Ako editujemo predmet, moramo njegove saradnike (objekte) da svedemo na niz ID-jeva za multiselect
    const formDataRow = { ...row };
    if (this.activeEntity === 'predmeti' && row.saradnici) {
      formDataRow.saradnici_ids = row.saradnici.map((s: any) => s.id);
    }

    const dialogRef = this.dialog.open(CrudModal, {
      width: '850px',
      data: {
        title: `Izmeni ${this.activeEntity === 'profesori' ? 'profesora' : this.activeEntity === 'saradnici' ? 'saradnika' : this.activeEntity === 'predmeti' ? 'predmet' : 'ispit'}`,
        columns: this.currentColumnsDef,
        rowData: formDataRow, 
        saradniciList: this.allSaradnici, // <--- DODATO
        profesoriList: this.allProfesori, // <--- ŠALJEMO PROFESORE
        predmetiList: this.allPredmeti,
        rolesList: this.allRoles
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
 formatCellValue(row: any, colKey: string): string {
    if (colKey === 'password') return '********';

    const val = row[colKey];
    if (val === null || val === undefined || val === '') return '-';

    // 1. Formatiranje za vreme kreiranja loga (Dnevnik rada)
    if (colKey === 'created_at') {
      const d = new Date(val);
      return `${d.toLocaleDateString('sr-RS')} ${d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit' })}`;
    }

    // 2. Ako je u pitanju polje za vreme (vreme ili vreme_kraja)
    if (colKey.includes('vreme') && typeof val === 'string' && val.includes('T')) {
      return val.substring(11, 16); // Vraća samo "08:00"
    }

    // 3. Ako je u pitanju datum polaganja
    if (colKey.includes('datum') && typeof val === 'string' && val.includes('T')) {
      return val.split('T')[0]; // Vraća "2026-08-01"
    }

    // 4. Ako je relacija (npr. objekat predmeta ili sale)
    if (typeof val === 'object') {
      return val.naziv || `${val.ime || ''} ${val.prezime || ''}`.trim() || '-';
    }

    return val;
  }
  refreshDropdownData(callback?: () => void): void {
    forkJoin({
      saradnici: this.http.get<any[]>(`${this.API_URL}/profesors/saradnici`),
      profesori: this.http.get<any[]>(`${this.API_URL}/profesors`),
      predmeti: this.http.get<any[]>(`${this.API_URL}/predmet`)
    }).subscribe({
      next: (res) => {
        this.allSaradnici = res.saradnici;
        this.allProfesori = res.profesori;
        this.allPredmeti = res.predmeti;
        if (callback) callback();
      },
      error: (err) => console.error('Greška pri osvežavanju podataka:', err)
    });
  }
}