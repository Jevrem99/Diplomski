import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { forkJoin } from 'rxjs';
import * as XLSX from 'xlsx-js-style';
@Component({
  selector: 'app-zaduzenja',
  standalone: true,
  imports: [CommonModule, FormsModule, SidebarMenu],
  template: `
    <div class="flex flex-col lg:flex-row min-h-screen w-full bg-[#f4f7fb] p-3 sm:p-4 md:p-6 gap-4 md:gap-6">
      
      <main class="flex-1 flex flex-col min-w-0 w-full">
        <!-- HEADER SA FILTERIMA -->
        <header class="mb-4 sm:mb-6 p-4 flex flex-col xl:flex-row items-stretch xl:items-center justify-between bg-white rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div>
            <h1 class="text-xl font-bold text-gray-800 tracking-tight">Pregled Zaduženja</h1>
            <p class="text-xs text-gray-500 mt-1">Ukupan broj sati angažovanja po saradniku</p>
          </div>
          
          <!-- FILTERI -->
          <div class="flex flex-col sm:flex-row items-center gap-2">
            <select [(ngModel)]="filterGodina" (change)="primeniFiltere()" class="w-full sm:w-32 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#34b9f7]/50">
              <option value="sve">Sve godine</option>
              @for (god of dostupneGodine; track god) {
                <option [value]="god">{{ god }}.</option>
              }
            </select>

            <select [(ngModel)]="filterSemestar" (change)="primeniFiltere()" class="w-full sm:w-44 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#34b9f7]/50">
              <option value="sve">Svi semestri</option>
              <option value="zimski">Zimski semestar</option>
              <option value="letnji">Letnji semestar</option>
            </select>

            <select [(ngModel)]="filterMesec" (change)="primeniFiltere()" class="w-full sm:w-36 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#34b9f7]/50">
              <option value="sve">Svi meseci</option>
              <option value="1">Januar</option>
              <option value="2">Februar</option>
              <option value="3">Mart</option>
              <option value="4">April</option>
              <option value="5">Maj</option>
              <option value="6">Jun</option>
              <option value="7">Jul</option>
              <option value="8">Avgust</option>
              <option value="9">Septembar</option>
              <option value="10">Oktobar</option>
              <option value="11">Novembar</option>
              <option value="12">Decembar</option>
            </select>

            <button (click)="izveziUExcel()" class="w-full sm:w-auto px-5 py-2 text-sm font-bold text-white bg-green-500 rounded-xl hover:bg-green-600 transition-all shadow-md flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Izvezi u Excel
            </button>
          </div>
        </header>

        <!-- TABELA -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex-1">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-slate-50 border-b border-gray-100 text-slate-500 uppercase text-[11px] font-extrabold tracking-wider">
                <tr>
                  <th class="px-6 py-4">Saradnik / Profesor</th>
                  <th class="px-6 py-4 text-center">Broj ispita/kolokvijuma</th>
                  <th class="px-6 py-4 text-right">Ukupno zaduženje (Sati)</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                @for (saradnik of zaduzenjaSati; track saradnik.id) {
                  <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 font-bold text-gray-800">{{ saradnik.ime }} {{ saradnik.prezime }}</td>
                    <td class="px-6 py-4 font-semibold text-gray-500 text-center">{{ saradnik.brojIspita }}</td>
                    <td class="px-6 py-4 font-black text-indigo-600 text-right">{{ saradnik.ukupnoSati | number:'1.2-2' }}h</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3" class="px-6 py-8 text-center text-gray-400 font-semibold">Nema podataka o zaduženjima za izabrani filter.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  `
})
export class ZaduzenjaComponent implements OnInit {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef); // OVO REŠAVA PROBLEM SA UČITAVANJEM!
  private API_URL = 'http://localhost:5000';

  sviSaradnici: any[] = [];
  sviIspiti: any[] = [];
  filtriraniIspiti: any[] = [];
  zaduzenjaSati: any[] = [];

  // FILTERI
  dostupneGodine: string[] = [];
  filterGodina: string = 'sve';
  filterSemestar: string = 'sve';
  filterMesec: string = 'sve';

  ngOnInit() {
    this.ucitajPodatke();
  }

  ucitajPodatke() {
    forkJoin({
      saradnici: this.http.get<any[]>(`${this.API_URL}/profesors`),
      ispiti: this.http.get<any[]>(`${this.API_URL}/ispit`)
    }).subscribe({
      next: ({ saradnici, ispiti }) => {
        this.sviSaradnici = saradnici;
        this.sviIspiti = ispiti;

        // Izdvoji dostupne godine iz ispita
        const godine = new Set<string>();
        this.sviIspiti.forEach(i => {
          if (i.datum) godine.add(i.datum.split('-')[0]);
        });
        this.dostupneGodine = Array.from(godine).sort((a, b) => b.localeCompare(a)); // Najnovije prvo

        // Primeni filtere čim podaci stignu
        this.primeniFiltere();
      },
      error: (err) => console.error("Greška pri učitavanju:", err)
    });
  }

  primeniFiltere() {
    this.filtriraniIspiti = this.sviIspiti.filter(ispit => {
      if (!ispit.datum) return false;
      const [godinaStr, mesecStr, danStr] = ispit.datum.split('-');
      const mesecNum = parseInt(mesecStr, 10);

      // Filter po godini
      if (this.filterGodina !== 'sve' && godinaStr !== this.filterGodina) return false;

      // Filter po mesecu
      if (this.filterMesec !== 'sve' && mesecNum.toString() !== this.filterMesec) return false;

      // Filter po semestru (Zimski: Okt-Feb, Letnji: Mar-Sep)
      if (this.filterSemestar !== 'sve') {
        const isZimski = mesecNum >= 10 || mesecNum <= 2;
        const isLetnji = mesecNum >= 3 && mesecNum <= 9;
        if (this.filterSemestar === 'zimski' && !isZimski) return false;
        if (this.filterSemestar === 'letnji' && !isLetnji) return false;
      }

      return true;
    });

    this.izracunajSate(this.filtriraniIspiti);
  }

  izracunajSate(ispiti: any[]) {
    const zaduzenjaMap = new Map<number, any>();
    this.sviSaradnici.forEach(s => {
      zaduzenjaMap.set(s.id, { ...s, ukupnoSati: 0, brojIspita: 0 });
    });

    ispiti.forEach(ispit => {
      const sati = this.razlikaUSatima(ispit.vreme, ispit.vreme_kraja);
      const dezurstva = ispit.dezurstva || [];
      
      dezurstva.forEach((dez: any) => {
        const sId = typeof dez.saradnik === 'object' ? dez.saradnik.id : dez.saradnik_id;
        if (sId && zaduzenjaMap.has(sId)) {
          const saradnikInfo = zaduzenjaMap.get(sId);
          saradnikInfo.ukupnoSati += sati;
          saradnikInfo.brojIspita += 1;
        }
      });
    });

    // Prikazujemo i serviramo samo saradnike koji imaju barem neko zaduženje u ovom filteru
    this.zaduzenjaSati = Array.from(zaduzenjaMap.values())
      .filter(s => s.ukupnoSati > 0)
      .sort((a, b) => b.ukupnoSati - a.ukupnoSati);

    // Forsiramo Angular da osveži HTML tabelu
    this.cdr.detectChanges(); 
  }

  private razlikaUSatima(vremeOd: string, vremeDo: string): number {
    if (!vremeOd || !vremeDo) return 2; 
    const getMin = (v: string) => {
      const val = v.includes('T') ? v.substring(11, 16) : v.substring(0, 5);
      const [h, m] = val.split(':').map(Number);
      return (h * 60) + m;
    };
    const start = getMin(vremeOd);
    const end = getMin(vremeDo);
    return Math.max(0, (end - start) / 60);
  }

  izveziUExcel() {
    if (this.filtriraniIspiti.length === 0) {
      alert("Nema ispita za izvoz pod izabranim filterima.");
      return;
    }

    // 1. Red (Zaglavlje)
    const header = [
      'Predmet - kolokvijum', 
      'Datum', 
      'Broj sati', 
      'Potreban broj dežurnih', 
      'Broj dežurnih', 
      'Broj prijavljenih studenata'
    ];
    
    // Formatiramo imena (L. Krstić)
    const imenaSaradnika = this.zaduzenjaSati.map(s => `${s.ime.charAt(0)}. ${s.prezime}`);
    header.push(...imenaSaradnika);
    header.push('Unnamed: 19'); // Po ugledu na tvoj Excel fajl za status

    // 2. Red (Ukupni sati)
    const totalsRow = [null, null, null, null, null, null];
    const ukupniSati = this.zaduzenjaSati.map(s => s.ukupnoSati);
    totalsRow.push(...ukupniSati);
    totalsRow.push(null);

    const wsData: any[][] = [header, totalsRow];

    // 3. Ostali redovi (Ispiti sortirani po datumu)
    const sortiraniIspiti = [...this.filtriraniIspiti].sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime());
    
    sortiraniIspiti.forEach(ispit => {
      const naziv = ispit.predmet?.naziv || 'Nepoznato';
      // Format datuma 15.4.2026.
      const datum = ispit.datum ? ispit.datum.split('-').reverse().join('.') + '.' : '';
      const sati = this.razlikaUSatima(ispit.vreme, ispit.vreme_kraja);
      const dezurstva = ispit.dezurstva || [];
      const brojDezurnih = dezurstva.length;
      const potrebanBroj = brojDezurnih || 2; 
      
      const red = [
        naziv, datum, sati, potrebanBroj, brojDezurnih, null
      ];

      // Gde god se poklapa ID, upisujemo '1.0'
      this.zaduzenjaSati.forEach(s => {
        const dežura = dezurstva.some((d: any) => (typeof d.saradnik === 'object' ? d.saradnik.id : d.saradnik_id) === s.id);
        red.push(dežura ? 1.0 : null);
      });

      red.push('OK');
      wsData.push(red);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Formatiranje širine kolona da izgleda lepo i uredno
    const wscols = [
      { wch: 35 }, // Predmet
      { wch: 12 }, // Datum
      { wch: 10 }, // Broj sati
      { wch: 22 }, // Potreban broj
      { wch: 15 }, // Broj dežurnih
      { wch: 25 }, // Prijavljeni studenti
      ...imenaSaradnika.map(() => ({ wch: 10 })), // Imena saradnika
      { wch: 8 }   // Unnamed (OK)
    ];
    ws['!cols'] = wscols;

    const wb = XLSX.utils.book_new();
    const sheetName = this.filterSemestar !== 'sve' ? `Raspored - ${this.filterSemestar}` : 'Raspored dezurstava';
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${sheetName}.xlsx`);
  }
}