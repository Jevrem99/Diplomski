import { Component, AfterViewInit, ElementRef, ViewChild, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { forkJoin, Observable } from 'rxjs';
import { FullCalendarModule, FullCalendarComponent } from '@fullcalendar/angular';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { EventModal } from '../../shared/components/event-modal/event-modal.component';
import { ToastService } from '../../core/services/toast.service';
import { FormsModule } from '@angular/forms'; // <--- OBAVEZNO DODATI U IMPORTS
import { HostListener } from '@angular/core';

interface Profesor {
  id?: number;
  ime: string;
  prezime: string;
  email?: string;
}
function presloviULatinicu(tekst: string): string {
  if (!tekst) return '';
  
  const cirilicaToLatinica: { [key: string]: string } = {
    'а':'a', 'б':'b', 'в':'v', 'г':'g', 'д':'d', 'ђ':'dj', 'е':'e', 'ж':'z', 'з':'z', 'и':'i',
    'ј':'j', 'к':'k', 'л':'l', 'љ':'lj', 'м':'m', 'н':'n', 'њ':'nj', 'о':'o', 'п':'p', 'р':'r',
    'с':'s', 'т':'t', 'ћ':'c', 'у':'u', 'ф':'f', 'х':'h', 'ц':'c', 'ч':'c', 'џ':'dz', 'ш':'s',
    'А':'a', 'Б':'b', 'В':'v', 'Г':'g', 'Д':'d', 'Ђ':'dj', 'Е':'e', 'Ж':'z', 'З':'z', 'И':'i',
    'Ј':'j', 'К':'k', 'Л':'l', 'Љ':'lj', 'М':'m', 'Н':'n', 'Њ':'nj', 'О':'o', 'П':'p', 'Р':'r',
    'С':'s', 'Т':'t', 'Ћ':'c', 'У':'u', 'Ф':'f', 'Х':'h', 'Ц':'c', 'Ч':'c', 'Џ':'dz', 'Ш':'s',
    'č':'c', 'ć':'c', 'š':'s', 'ž':'z', 'đ':'dj', 'Č':'c', 'Ć':'c', 'Š':'s', 'Ž':'z', 'Đ':'dj'
  };

  return tekst.split('').map(char => cirilicaToLatinica[char] || char).join('').toLowerCase();
}
interface Predmet {
  id: number;
  sifra: string;
  naziv: string;
  godina: number;
  semestar?: string;
  status?: string;
  profesor_id?: number;
  profesor?: Profesor;
  profesorImePrezime?: string;
}

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [SidebarMenu, CommonModule, FullCalendarModule, MatDialogModule,FormsModule,MatSelectModule, MatFormFieldModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
  
})
export class Main implements OnInit, AfterViewInit {
  @ViewChild('draggableContainer') draggableContainer!: ElementRef;
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private API_URL = 'http://localhost:5000';
  private cdr = inject(ChangeDetectorRef);
  private toastService = inject(ToastService);
  username = localStorage.getItem('username');
  predmeti: Predmet[] = [];
  draggableInstance: Draggable | null = null;
  modifiedEvents: any[] = [];
  unsavedEvents: any[] = [];
  hasUnsavedChanges: boolean = false;
  filterGodina: string = 'sve';
  filterSala: string = 'sve';
  allLoadedEvents: any[] = [];
  dostupneSale: any[] = [];
  isDashboardOpen: boolean = false;
  sviSaradnici: any[] = [];
  sveObaveze: any[] = [];
  filterSaradnici: number[] = [];
  searchPredmet: string = ''; // <--- Search term za pretragu predmeta u banci predmeta
  prikazaniBrojPredmeta: number = 1000; // Koliko predmeta da se prikaže po defaultu u banci predmeta
  izabranaGodinaBanka: 'sve' | number = 'sve';

  defaultGodinaColors: Record<number, string> = {
    1: '#34b9f7',
    2: '#ef4444',
    3: '#eab308',
    4: '#10b981'
  };

  godinaColors: Record<number, string> = { ...this.defaultGodinaColors };

stats = {
    totalIspiti: 0,
    totalSaradnici: 0,
    topDezurni: 'Učitavanje...',
    konflikti: 0
  };
  fetchStats(): void {
    this.http.get<any>(`${this.API_URL}/ispit/stats`).subscribe({
      next: (data) => {
        this.stats.totalIspiti = data.totalIspiti;
        this.stats.totalSaradnici = data.totalSaradnici;
        this.stats.topDezurni = data.topDezurni;
      },
      error: (err) => console.error('Greška pri dohvatanju statistike:', err)
    });
  }

  @HostListener('window:storage', ['$event'])
  onStorageChange(event: StorageEvent): void {
    if (event.key === 'app_godina_colors') {
      this.loadSavedColors();
      this.cdr.detectChanges(); // primorava Angular da preboji UI
    }
  }

  // <--- DODATO: Automatski filtrira listu predmeta levo
  get filtriraniPredmeti() {
    if (!this.predmeti) return [];

    // 1. Prvo filtriramo po godini (ako nije izabrano 'sve')
    let rez = [...this.predmeti];
    if (this.izabranaGodinaBanka !== 'sve') {
      rez = rez.filter(p => Number(p.godina) === Number(this.izabranaGodinaBanka));
    }

    // 2. Ako ima pretrage (koristimo tvoju presloviULatinicu logiku)
    if (this.searchPredmet && this.searchPredmet.trim() !== '') {
      const q = presloviULatinicu(this.searchPredmet);

      return rez.filter(p => {
        const nazivLat = presloviULatinicu(p.naziv || '');
        const profLat = presloviULatinicu(p.profesorImePrezime || '');
        const sifraLat = presloviULatinicu(p.sifra || '');

        return nazivLat.includes(q) || profLat.includes(q) || sifraLat.includes(q);
      });
    }

    // 3. Ako nema pretrage i izabrano je 'sve', sečemo na prikazaniBrojPredmeta
    // (Ako je izabrana konkretna godina, prikazujemo sve predmete te godine)
    if (this.izabranaGodinaBanka === 'sve') {
      return rez.slice(0, this.prikazaniBrojPredmeta);
    }

    return rez;
  }

  odaberiGodinuFilter(godina: 'sve' | number): void {
    this.izabranaGodinaBanka = godina;
  }

  fetchUcionice(): void {
    this.http.get<any[]>('http://localhost:5000/ucionice').subscribe({
      next: (res) => {
        console.log('Učionice stigle sa beka:', res);
        this.dostupneSale = res;
        this.cdr.detectChanges(); // <--- OBAVEZNO: primorava Angular da osveži padajući meni
      },
      error: (err) => console.error('Greška pri dohvatanju učionica:', err)
    });
  }
  
  // <--- DODATA FUNKCIJA ZA DUGME --->
  vidiVisePredmeta() {
    this.prikazaniBrojPredmeta += 10;
  }
  
  applyFilters(): void {
    let filtered = [...this.allLoadedEvents];

    if (this.filterGodina !== 'sve') {
      const godNum = Number(this.filterGodina);
      filtered = filtered.filter(e => Number(e.extendedProps?.godina) === godNum);
    }


    if (this.filterSala !== 'sve') {
      filtered = filtered.filter(e => {
        const eventSala = e.extendedProps?.sala;
        const salaVal = typeof eventSala === 'object' ? eventSala?.naziv : eventSala;
        

        const selectedSalaVal = typeof this.filterSala === 'object' 
          ? (this.filterSala as any)?.naziv 
          : this.filterSala;

        return salaVal === selectedSalaVal;
      });
    }

    
    if (this.filterSaradnici && this.filterSaradnici.length > 0) {
      const selectedIds = this.filterSaradnici.map(id => String(id));

      filtered = filtered.filter(ispit => {
        
        const dezurni = ispit.extendedProps?.dezurni || ispit.extendedProps?.saradnici || [];
        
        return dezurni.some((d: any) => {
          const dId = String(typeof d === 'object' ? d.id : d);
          return selectedIds.includes(dId);
        });
      });
    }

    // --- DODAVANJE POZADINSKIH DOGAĐAJA ZA SARADNIKE ---
    const backgroundEvents: any[] = [];

    if (this.filterSaradnici && this.filterSaradnici.length > 0) {
      this.filterSaradnici.forEach(saradnikId => {
        const saradnik = this.sviSaradnici.find(s => s.id === saradnikId);
        const imePrezime = saradnik ? `${saradnik.ime} ${saradnik.prezime}` : 'Saradnik';

        // 1. Zauzetost zbog odsustva (Crvenkasta boja)
        this.sveObaveze.forEach(obs => {
          if (obs.saradnik_id === saradnikId) {
            const odStr = obs.datum ? obs.datum.split('T')[0] : '';
            const doStr = obs.datum_do ? obs.datum_do.split('T')[0] : odStr;
            
            const dStart = new Date(odStr);
            const dEnd = new Date(doStr);
            for (let d = new Date(dStart); d <= dEnd; d.setDate(d.getDate() + 1)) {
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              const currentDStr = `${y}-${m}-${day}`;

              const start = obs.vreme_pocetka ? `${currentDStr}T${obs.vreme_pocetka.substring(11, 16)}:00` : `${currentDStr}`;
              const end = obs.vreme_kraja ? `${currentDStr}T${obs.vreme_kraja.substring(11, 16)}:00` : undefined;

              backgroundEvents.push({
                start: start,
                end: end,
                display: 'background',
                backgroundColor: 'rgba(239, 68, 68, 0.25)', 
                title: `${imePrezime} - Odsustvo: ${obs.tip_obaveze || 'Nedostupan/na'}` 
              });
            }
          }
        });

  
        this.allLoadedEvents.forEach(ispit => {
          const dezurni = ispit.extendedProps?.['dezurni'] || [];
          if (dezurni.some((d: any) => String(d.id || d) === String(saradnikId))) {
            backgroundEvents.push({
              start: ispit.start,
              end: ispit.end,
              display: 'background',
              backgroundColor: 'rgba(100, 116, 139, 0.25)',
              title: `${imePrezime} - Dežura na: ${ispit.title ? ispit.title.split(' (')[0] : ''}` 
            });
          }
        });
      });
    }

    this.calendarOptions.events = [...filtered, ...backgroundEvents];
    this.cdr.detectChanges();
  }

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    themeSystem: 'standard',
    height: '100%',
    firstDay: 1,
    displayEventEnd: true,
    eventTimeFormat: {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    },
    dragRevertDuration: 0,
    droppable: true,
    editable: true,
    eventDidMount: (info) => {
      if (info.event.title) {
        info.el.setAttribute('title', info.event.title); // Ubacuje nativni oblačić
        
      }
    },
    

   eventReceive: (info) => {
      const originalEvent = info.event;
      const eventDate = originalEvent.startStr.split('T')[0];
      const predmetId = originalEvent.extendedProps['predmetId'];
      const droppedPredmet = this.predmeti.find(p => p.id == predmetId);

      originalEvent.remove();

      // Provera zauzetosti sala za taj dan
      const sviDogadjaji = this.calendarComponent.getApi().getEvents();
      const zauzecaNaDan = sviDogadjaji
        .filter(e => {
          const dStr = e.startStr.split('T')[0] || e.start?.toISOString().split('T')[0];
          return dStr === eventDate && e.id !== originalEvent.id; 
        })
        .map(e => ({
          sala: e.extendedProps['sala'],
          vreme: e.extendedProps['vreme'],
          vremeKraja: e.extendedProps['vremeKraja']
        }));

      const dialogRef = this.dialog.open(EventModal, {
        maxWidth: '95vw',
        width: '1000px',
        maxHeight: '90vh',
        data: { 
          title: originalEvent.title,
          date: eventDate,
          predmetId: predmetId,
          zauzeteSaleNaDan: zauzecaNaDan // <--- Šaljemo u modal
        },
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
          const dezurniIds = result.dezurni_ids || result.formData?.dezurni_ids || [];
          const izabraniSaradnici = result.izabraniSaradnici || [];

          this.unsavedEvents.push({
            tempId: tempId,
            predmet_id: predmetId,
            title: result.title,
            datum: eventDate,
            vreme: result.startTime,
            vreme_kraja: result.endTime,
            sala: result.room,
            dezurni_ids: dezurniIds,
            backgroundColor: originalEvent.backgroundColor,
            borderColor: originalEvent.borderColor
          });

          // OVO JE NOVO: Guramo događaj u glavni niz umesto direktno u kalendar
          const noviEvent = {
            id: tempId,
            title: `${result.title} (${result.room})`,
            start: `${eventDate}T${result.startTime}:00`,
            end: result.endTime ? `${eventDate}T${result.endTime}:00` : undefined,
            display: 'block',
            backgroundColor: originalEvent.backgroundColor,
            borderColor: originalEvent.borderColor,
            extendedProps: {
              vreme: result.startTime,
              vremeKraja: result.endTime,
              sala: result.room,
              predmetId: predmetId,
              godina: droppedPredmet?.godina,
              profesorId: droppedPredmet?.profesor_id,
              profesorIme: droppedPredmet?.profesorImePrezime,
              dezurni: izabraniSaradnici
            }
          };

          this.allLoadedEvents.push(noviEvent);
          this.hasUnsavedChanges = true;
          this.applyFilters(); // Automatski će iscrtati event i primeniti trenutne filtere!
          
          setTimeout(() => this.detectConflicts(), 150);
        }
        window.getSelection()?.removeAllRanges();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      });
    },
  eventClick: (info) => {
      // 1. ZABRANA KLIKA NA POZADINSKE BLOKOVE (Odsustva i preseci)
      if (info.event.display === 'background') {
        return; // Odmah prekida funkciju, modal se neće otvoriti!
      }

      // 2. Ostatak tvog postojećeg koda...
      const cistNaslov = info.event.title.split(' (')[0];
      const eventDate = info.event.startStr ? info.event.startStr.split('T')[0] : info.event.start?.toISOString().split('T')[0];
      // Provera zauzetosti sala za taj dan (ovde koristimo info.event)
      const sviDogadjaji = this.calendarComponent.getApi().getEvents();
      const zauzecaNaDan = sviDogadjaji
        .filter(e => {
          const dStr = e.startStr.split('T')[0] || e.start?.toISOString().split('T')[0];
          return dStr === eventDate && e.id !== info.event.id; 
        })
        .map(e => ({
          sala: e.extendedProps['sala'],
          vreme: e.extendedProps['vreme'],
          vremeKraja: e.extendedProps['vremeKraja']
        }));

      const dialogRef = this.dialog.open(EventModal, {
        maxWidth: '95vw',
        width: '1000px',
        maxHeight: '90vh',
        data: { 
          title: cistNaslov,
          date: eventDate,
          startTime: info.event.extendedProps['vreme'],
          endTime: info.event.extendedProps['vremeKraja'],
          room: info.event.extendedProps['sala'],
          predmetId: info.event.extendedProps['predmetId'],
          dezurni: info.event.extendedProps['dezurni'] || [],
          zauzeteSaleNaDan: zauzecaNaDan // <--- Šaljemo u modal
        },
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          
          // --- BRISANJE TERMINA ---
          if (result.action === 'delete') {
            if (info.event.id && !info.event.id.startsWith('temp_')) {
              this.http.delete(`${this.API_URL}/ispit/${info.event.id}`).subscribe({
                next: () => {
                  this.allLoadedEvents = this.allLoadedEvents.filter(e => e.id !== info.event.id);
                  this.applyFilters(); // Crtamo ponovo bez ovog događaja
                  this.toastService.show('Termin je uspešno obrisan.', 'success');
                },
                error: (err) => console.error('Greška pri brisanju ispita:', err)
              });
            } else {
              this.unsavedEvents = this.unsavedEvents.filter(e => e.tempId !== info.event.id);
              this.allLoadedEvents = this.allLoadedEvents.filter(e => e.id !== info.event.id);
              this.hasUnsavedChanges = this.unsavedEvents.length > 0 || this.modifiedEvents.length > 0;
              this.applyFilters();
            }
            setTimeout(() => this.detectConflicts(), 150);
            return;
          }

          // --- IZMENA TERMINA ---
          this.hasUnsavedChanges = true;
          const dezurniIds = result.dezurni_ids || result.formData?.dezurni_ids || [];
          const izabraniSaradnici = result.izabraniSaradnici || [];

          if (info.event.id && info.event.id.startsWith('temp_')) {
            const draftEvt = this.unsavedEvents.find(e => e.tempId === info.event.id);
            if (draftEvt) {
              draftEvt.vreme = result.startTime;
              draftEvt.vreme_kraja = result.endTime;
              draftEvt.sala = result.room;
              draftEvt.dezurni_ids = dezurniIds;
            }
          } else {
            const payload = {
              id: info.event.id,
              datum: eventDate,
              vreme: result.startTime,
              vreme_kraja: result.endTime,
              sala: result.room,
              predmet_id: info.event.extendedProps['predmetId'],
              is_ispit: true,
              dezurni_ids: dezurniIds
            };
            const existingIndex = this.modifiedEvents.findIndex(e => e.id === info.event.id);
            if (existingIndex > -1) {
              this.modifiedEvents[existingIndex] = payload;
            } else {
              this.modifiedEvents.push(payload);
            }
          }

          // Ažuriramo glavni niz da bi filteri videli promene!
          const evtIndex = this.allLoadedEvents.findIndex(e => e.id === info.event.id);
          if (evtIndex > -1) {
            this.allLoadedEvents[evtIndex] = {
              ...this.allLoadedEvents[evtIndex],
              start: `${eventDate}T${result.startTime}:00`,
              end: result.endTime ? `${eventDate}T${result.endTime}:00` : undefined,
              title: `${cistNaslov} (${result.room})`,
              extendedProps: {
                ...this.allLoadedEvents[evtIndex].extendedProps,
                vreme: result.startTime,
                vremeKraja: result.endTime,
                sala: result.room,
                dezurni: izabraniSaradnici
              }
            };
          }
          this.applyFilters();
          setTimeout(() => this.detectConflicts(), 150);
        }
      });
    },

    eventDrop: (info) => {
    this.hasUnsavedChanges = true;
    const newDate = info.event.startStr.split('T')[0];
    
    // Izvlačimo ID-jeve dežurnih asistenata da ne bi bili prazni
    const dezurniLica = info.event.extendedProps['dezurni'] || [];
    const dezurniIds = dezurniLica.map((d: any) => d.id || d);

    if (info.event.id && !info.event.id.startsWith('temp_')) {
      const existingIndex = this.modifiedEvents.findIndex(e => e.id === info.event.id);
      const payload = {
        id: info.event.id,
        datum: newDate,
        vreme: info.event.extendedProps['vreme'],
        vreme_kraja: info.event.extendedProps['vremeKraja'],
        sala: info.event.extendedProps['sala'],
        predmet_id: info.event.extendedProps['predmetId'],
        is_ispit: true,
        dezurni_ids: dezurniIds // <--- DODATO DA PUT ZAHTEV IMA DEŽURNE
      };
      if (existingIndex > -1) {
        this.modifiedEvents[existingIndex] = payload;
      } else {
        this.modifiedEvents.push(payload);
      }
    } else {
      const unsavedEvent = this.unsavedEvents.find(e => e.tempId === info.event.id);
      if (unsavedEvent) unsavedEvent.datum = newDate;
    }

    const evtIndex = this.allLoadedEvents.findIndex(e => e.id === info.event.id);
    if (evtIndex > -1) {
      this.allLoadedEvents[evtIndex].start = `${newDate}T${info.event.extendedProps['vreme']}:00`;
      if (info.event.extendedProps['vremeKraja']) {
        this.allLoadedEvents[evtIndex].end = `${newDate}T${info.event.extendedProps['vremeKraja']}:00`;
      }
    }
    this.applyFilters();
    setTimeout(() => this.detectConflicts(), 300);
  }, // Kraj eventDrop funkcije
    titleFormat: (arg) => {
      const meseci = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
      return `${meseci[arg.date.month]} ${arg.date.year}.`;
    },
    // MESEČNI PRIKAZ: Prikazuje samo dane (Pon, Uto, Sre...)
    dayHeaderContent: (arg) => {
      const daniSkraceno = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
      return daniSkraceno[arg.date.getDay()];
    },

    // SPECIFIČNE PODEŠAVANJA PO PRIKAZIMA
    views: {
      timeGridWeek: {
        dayHeaderContent: (arg) => {
          const daniSkraceno = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
          const d = arg.date;
          // Format za nedeljni prikaz: "Pon 15.8."
          return `${daniSkraceno[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
        }
      },
      timeGridDay: {
        dayHeaderContent: (arg) => {
          const daniPuni = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'];
          const meseci = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
          const d = arg.date;
          // Format za dnevni prikaz: "Subota, 8. Avgust"
          return `${daniPuni[d.getDay()]}, ${d.getDate()}. ${meseci[d.getMonth()]}`;
        }
      }
    },
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    buttonText: {
      today: 'Danas',
      month: 'Mesec',
      week: 'Nedelja',
      day: 'Dan'
    }
  };

  

  saveDraftSchedule() {
    if (!this.hasUnsavedChanges) return;

    const requests: Observable<any>[] = [];

    // 1. Snimanje novih dodatih ispita (POST)
    if (this.unsavedEvents.length > 0) {
      requests.push(this.http.post(`${this.API_URL}/ispit/bulk`, this.unsavedEvents));
    }

    // 2. Snimanje izmenjenih starih ispita (PUT)
    if (this.modifiedEvents.length > 0) {
      this.modifiedEvents.forEach(evt => {
        requests.push(this.http.put(`${this.API_URL}/ispit/${evt.id}`, evt));
      });
    }

    if (requests.length === 0) return;

    // forkJoin izvršava SVE zahteve odjednom
    forkJoin(requests).subscribe({
      next: () => {
        this.toastService.show('Raspored je uspešno sačuvan!', 'success');

        // Resetujemo stanja
        this.unsavedEvents = [];
        this.modifiedEvents = [];
        this.hasUnsavedChanges = false;

        // Osvežavamo kalendar čistim podacima iz baze
        this.fetchIspiti();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Greška pri čuvanju rasporeda:', err);
        this.toastService.show('Došlo je do greške pri čuvanju.', 'error');
      }
    });
  }
  fetchSviSaradniciIObaveze() {
    forkJoin({
      saradnici: this.http.get<any[]>(`${this.API_URL}/profesors`),
      obaveze: this.http.get<any[]>(`${this.API_URL}/obaveze`)
    }).subscribe({
      next: ({ saradnici, obaveze }) => {
        this.sviSaradnici = saradnici;
        this.sveObaveze = obaveze;
      }
    });
  }
  ngOnInit(): void {
    this.fetchPredmeti();
    this.fetchIspiti();
    this.fetchSviSaradniciIObaveze();
    this.fetchStats();
    this.fetchUcionice();
    this.loadSavedColors();
  }

  ngAfterViewInit(): void {
    this.initDraggable();
  }

  getGodinaColor(godina?: number | string): string {
    if (!godina) return '#34b9f7';
    const godNum = Number(godina);
    return this.godinaColors[godNum] || '#34b9f7';
  }

  fetchPredmeti(): void {
    this.http.get<Predmet[]>(`${this.API_URL}/predmet`).subscribe({
      next: (data) => {
        this.predmeti = data.map(p => ({
          ...p,
          profesorImePrezime: p.profesor
            ? `Prof. ${p.profesor.ime} ${p.profesor.prezime}`
            : `Šifra: ${p.sifra}`
        }));
        this.cdr.detectChanges();
        this.initDraggable();
      },
      error: (err) => console.error('Greška pri dohvatanju predmeta:', err)
    });
  }

  loadSavedColors(): void {
    const saved = localStorage.getItem('app_godina_colors');
    if (saved) {
      try {
        this.godinaColors = { ...this.defaultGodinaColors, ...JSON.parse(saved) };
      } catch (e) {
        this.godinaColors = { ...this.defaultGodinaColors };
      }
    }
  }

  fetchIspiti(): void {
    forkJoin({
      ispiti: this.http.get<any[]>(`${this.API_URL}/ispit`),
      redovnaNastava: this.http.get<any[]>(`${this.API_URL}/ispit/zauzeti-termini`)
    }).subscribe({
      next: ({ ispiti, redovnaNastava }) => {
        // 1. Obrada regularnih ispita/kolokvijuma
        const ispitEvents = ispiti.map(i => {
          const boja = this.getGodinaColor(i.predmet?.godina);
          const salaNaziv = i.sala?.naziv || i.sala || 'Bez sale';
          const formatiranoVreme = i.vreme ? (i.vreme.includes('T') ? i.vreme.substring(11, 16) : i.vreme.substring(0, 5)) : '00:00';
          const formatiranoVremeKraja = i.vreme_kraja ? (i.vreme_kraja.includes('T') ? i.vreme_kraja.substring(11, 16) : i.vreme_kraja.substring(0, 5)) : '';
          
          return {
            id: i.id.toString(),
            title: `${i.predmet?.naziv || 'Ispit'} (${salaNaziv})`,
            start: `${i.datum}T${formatiranoVreme}`,
            end: formatiranoVremeKraja ? `${i.datum}T${formatiranoVremeKraja}` : undefined,
            display: 'block',
            backgroundColor: boja,
            borderColor: boja,
            extendedProps: {
              vreme: formatiranoVreme,
              vremeKraja: formatiranoVremeKraja,
              sala: salaNaziv,
              predmetId: i.predmet_id,
              godina: i.predmet?.godina,
              dezurni: i.dezurstva ? i.dezurstva.map((d: any) => d.saradnik) : []
            }
          };
        });

        // 2. Obrada redovne nastave DIRECTNO iz baze (BEZ IKAKVIH HARDKODOVANIH DATUMA)
        const nastavaEvents: any[] = [];
        if (Array.isArray(redovnaNastava)) {
          redovnaNastava.forEach(cas => {
            // Datum iz baze u formatu YYYY-MM-DD
            const dStr = cas.datum ? cas.datum.split('T')[0] : null;
            if (!dStr) return;

            nastavaEvents.push({
              id: `nastava_${cas.id}`,
              title: `Nastava: ${cas.predmet} (${cas.sala?.naziv || 'Sala'})`,
              start: `${dStr}T${cas.vreme_pocetka}:00`,
              end: `${dStr}T${cas.vreme_kraja}:00`,
              display: 'block',
              backgroundColor: '#f3f4f6', // Svetlo siva kartica
              borderColor: '#ef4444',     // Crvena ivica sa strane
              textColor: '#1f2937',
              editable: false,
              extendedProps: {
                vreme: cas.vreme_pocetka,
                vremeKraja: cas.vreme_kraja,
                sala: cas.sala?.naziv,
                isNastava: true
              }
            });
          });
        }

        const sviDogadjaji = [...ispitEvents, ...nastavaEvents];
        this.allLoadedEvents = sviDogadjaji;
        this.calendarOptions.events = sviDogadjaji;
        
        this.dostupneSale = [...new Set(ispitEvents.map(e => e.extendedProps.sala).filter(s => s && s !== 'Bez sale'))];
        this.cdr.detectChanges();
        setTimeout(() => this.detectConflicts(), 200);
      },
      error: (err) => console.error('Greška pri dohvatanju ispita i nastave:', err)
    });
  }

  private initDraggable(): void {
    const self = this;
    if (this.draggableContainer && this.draggableContainer.nativeElement) {
      if (this.draggableInstance) {
        this.draggableInstance.destroy();
      }
      this.draggableInstance = new Draggable(this.draggableContainer.nativeElement, {
        itemSelector: '.fc-event',
        eventData: function (eventEl) {
          const godina = parseInt(eventEl.getAttribute('data-godina') || '1');
          const boja = self.getGodinaColor(godina);

          // DODATO: Izvlačimo ID predmeta kako bi bek znao koji predmet se čuva
          const id = eventEl.getAttribute('data-id');

          return {
            title: eventEl.querySelector('h3')?.innerText || 'Nepoznat predmet',
            backgroundColor: boja,
            borderColor: boja,
            extendedProps: {
              predmetId: id // Prosleđujemo u FullCalendar podatak da ga pokupimo u eventReceive
            }
          };
        }
      });
    }
  }
 detectConflicts() {
    if (!this.calendarComponent) return;

    // 1. GLOBALNI LISTENER: Zatvara tooltip kad klikneš van njega
    if (!(window as any)._conflictTooltipListener) {
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.conflict-warning')) {
          document.querySelectorAll('.custom-conflict-tooltip').forEach((el: any) => {
            el.style.setProperty('display', 'none', 'important');
          });
        }
      });
      (window as any)._conflictTooltipListener = true;
    }

    const allEvents = this.calendarComponent.getApi().getEvents();
    const conflictsByDate = new Map<string, string[]>();
    const eventsByDate: Record<string, any[]> = {};
    
    allEvents.forEach(evt => {
      const dateStr = evt.start?.toISOString().split('T')[0] || evt.startStr.split('T')[0];
      if (!eventsByDate[dateStr]) eventsByDate[dateStr] = [];
      eventsByDate[dateStr].push(evt);
    });

    for (const date in eventsByDate) {
      const evts = eventsByDate[date];
      const razlozi: string[] = [];
      for (let i = 0; i < evts.length; i++) {
        for (let j = i + 1; j < evts.length; j++) {
          const e1 = evts[i];
          const e2 = evts[j];
          const start1 = this.timeToMins(String(e1.extendedProps['vreme'] || '').trim());
          const end1 = this.timeToMins(String(e1.extendedProps['vremeKraja'] || '').trim()) || (start1 + 120);
          const start2 = this.timeToMins(String(e2.extendedProps['vreme'] || '').trim());
          const end2 = this.timeToMins(String(e2.extendedProps['vremeKraja'] || '').trim()) || (start2 + 120);
          
          if (start1 < end2 && start2 < end1) {
            const s1 = String(e1.extendedProps['sala'] || '').trim();
            const s2 = String(e2.extendedProps['sala'] || '').trim();
            if (s1 && s2 && s1 === s2 && s1 !== 'Bez sale' && s1 !== 'undefined') {
              razlozi.push(`Sala "${s1}" je zauzeta u periodu od ${e1.extendedProps['vreme']}h do ${e1.extendedProps['vremeKraja'] || '(?)'}`);
            }
            
            const p1 = String(e1.extendedProps['profesorId'] || '');
            const p2 = String(e2.extendedProps['profesorId'] || '');
            if (p1 && p2 && p1 === p2 && p1 !== 'undefined') {
              const profIme = e1.extendedProps['profesorIme'] || 'Profesor';
              razlozi.push(`${profIme} ima ispit/kolokvijum u preklapajućem terminu.`);
            }
            
            const dezurni1: any[] = e1.extendedProps['dezurni'] || [];
            const dezurni2: any[] = e2.extendedProps['dezurni'] || [];
            dezurni1.forEach(d1 => {
              if (dezurni2.some(d2 => d2.id === d1.id)) {
                razlozi.push(`Saradnik ${d1.ime} ${d1.prezime} je duplo angažovan kao dežurni!`);
              }
            });
          }
        }
      }
      if (razlozi.length > 0) conflictsByDate.set(date, [...new Set(razlozi)]);
    }

    document.querySelectorAll('.fc-daygrid-day').forEach((cell: any) => {
      const date = cell.getAttribute('data-date');
      const frame = cell.querySelector('.fc-daygrid-day-frame');
      cell.style.backgroundColor = '';
      
      const oldWarning = frame?.querySelector('.conflict-warning');
      if (oldWarning) oldWarning.remove();
      
      if (date && conflictsByDate.has(date)) {
        cell.style.backgroundColor = '#fff9c4';
        
        if (frame) {
          frame.style.position = 'relative';
          const warning = document.createElement('div');
          warning.className = 'conflict-warning';
          
          // 2. Crtanje Pop-upa
          warning.innerHTML = `
            <div style="position: relative; display: inline-block;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" style="width: 22px; height: 22px; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.15));">
                <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
              </svg>
              <div class="custom-conflict-tooltip" style="
                display: none; 
                position: fixed; 
                top: 50%; 
                left: 50%; 
                transform: translate(-50%, -50%); 
                background-color: #ffffff; 
                color: #334155; 
                border: 1px solid #cbd5e1; 
                padding: 16px 20px; 
                border-radius: 12px; 
                font-size: 14px; 
                font-weight: 700;
                line-height: 1.5; 
                white-space: normal; 
                width: max-content; 
                max-width: 320px; 
                
                /* Dodajemo jaku senku i lažnu prozirnu pozadinu oko njega da izgleda kao pravi modal */
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 9999px rgba(0, 0, 0, 0.1); 
                
                z-index: 999999; 
                pointer-events: none;
                text-align: center;
              ">${conflictsByDate.get(date)!.join('<br><br>')}</div>
            </div>
          `;
          
          warning.style.position = 'absolute';
          warning.style.top = '4px';
          warning.style.right = '4px';
          warning.style.cursor = 'pointer';
          warning.style.zIndex = '10';
          
          warning.addEventListener('click', (e) => {
            e.stopPropagation();
            const tooltip = warning.querySelector('.custom-conflict-tooltip') as HTMLElement;
            const isCurrentlyVisible = tooltip.style.display === 'block';
            
            // Zatvori sve ostale
            document.querySelectorAll('.custom-conflict-tooltip').forEach((el: any) => {
              el.style.setProperty('display', 'none', 'important');
            });
            
            // Otvori samo ovaj ako nije bio otvoren
            if (!isCurrentlyVisible) {
              tooltip.style.setProperty('display', 'block', 'important');
            }
          });
          let ukupanBrojKonflikata = 0;
          for (const razlozi of conflictsByDate.values()) {
              ukupanBrojKonflikata += razlozi.length;
          }
          this.stats.konflikti = ukupanBrojKonflikata;
          
          frame.appendChild(warning);
        }
      }
    });
  }
  private timeToMins(timeStr: string): number {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
  }
  exportToPrintView(): void {
    const events = (this.calendarOptions.events as any[]) || [];
    if (events.length === 0) {
      alert('Nema ispita na rasporedu za izvoz.');
      return;
    }

    // Sortiramo događaje po datumu
    const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
    // Grupišemo po nedeljama (Pon - Ned)
    const weeksMap = new Map<string, Record<number, any[]>>();

    sorted.forEach(evt => {
      const d = new Date(evt.start);
      const dayOfWeek = (d.getDay() + 6) % 7; // 0 = Ponedeljak, 6 = Nedelja
      
      // Računamo ponedeljak te nedelje
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const weekKey = monday.toISOString().split('T')[0];

      if (!weeksMap.has(weekKey)) {
        weeksMap.set(weekKey, { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
      }

      weeksMap.get(weekKey)![dayOfWeek].push(evt);
    });

    // Pravimo HTML prozor za štampu
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="icon" type="image/png" href="assets/logopmf.png">
        <title>Raspored kolokvijuma - PMF Kragujevac</title>
        <style>
          body { font-family: 'Arial', sans-serif; padding: 20px; color: #1e293b; }
          h1 { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 5px; }
          h2 { text-align: center; font-size: 16px; color: #475569; margin-bottom: 25px; }
          .week-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; page-break-inside: avoid; }
          .week-table th, .week-table td { border: 1.5px solid #000; width: 14.28%; vertical-align: top; text-align: center; font-size: 12px; }
          .week-table th { background-color: #e2e8f0; padding: 6px 2px; font-weight: bold; }
          .date-sub { font-weight: normal; font-size: 11px; display: block; }
          .exam-box { padding: 6px 4px; margin: 4px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold; }
          .exam-time { font-weight: normal; font-size: 10px; color: #334155; margin-top: 2px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: right;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #34b9f7; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Štampaj / Snimi u PDF</button>
        </div>

        <h1>Raspored kolokvijuma na OAS Informatika</h1>
        <h2>Fakultet (PMF Kragujevac) - Letnji semestar</h2>
    `;

    const dayNames = ['ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota', 'nedelja'];

    weeksMap.forEach((days, mondayStr) => {
      const mondayDate = new Date(mondayStr);

      htmlContent += `<table class="week-table"><thead><tr>`;
      
      // Zaglavlje za 7 dana sa tačnim datumima
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(mondayDate);
        currentDay.setDate(mondayDate.getDate() + i);
        const formatDatum = `${String(currentDay.getDate()).padStart(2, '0')}.${String(currentDay.getMonth() + 1).padStart(2, '0')}.${currentDay.getFullYear()}.`;

        htmlContent += `
          <th>
            ${dayNames[i]}
            <span class="date-sub">${formatDatum}</span>
          </th>`;
      }

      htmlContent += `</tr></thead><tbody><tr>`;

      // Ćelije za svaki dan
      for (let i = 0; i < 7; i++) {
        const dayExams = days[i] || [];
        htmlContent += `<td>`;

        dayExams.forEach(e => {
          const title = e.title.split(' (')[0];
          const sala = e.extendedProps?.sala || '';
          const vreme = e.extendedProps?.vreme || '';
          const bg = e.backgroundColor || '#f1f5f9';

          htmlContent += `
            <div class="exam-box" style="background-color: ${bg}22; border-color: ${bg};">
              ${title}
              <div class="exam-time">- I kolokvijum - ${vreme}h (${sala})</div>
            </div>`;
        });

        htmlContent += `</td>`;
      }

      htmlContent += `</tr></tbody></table>`;
    });

    htmlContent += `</body></html>`;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
  sinhronizujIMI() {
    this.toastService.show('Započinjem sinhronizaciju sa IMI serverom, molimo sačekajte...', 'success');
    
    // Gađamo onu rutu koju smo napravili u adminRoutes.js
    this.http.post(`${this.API_URL}/admin/sync-imi`, {}).subscribe({
      next: (res: any) => {
        console.log('Odgovor sa bekenda:', res);
        this.toastService.show(res.poruka || 'Sinhronizacija uspešna!', 'success');
      },
      error: (err) => {
        console.error('Greška pri IMI sinhronizaciji:', err);
        this.toastService.show('Došlo je do greške pri sinhronizaciji.', 'error');
      }
    });
  }
  objaviRaspored() {
    if (confirm('Da li ste sigurni da želite da objavite raspored? Svi saradnici će od ovog trenutka moći da vide svoja zaduženja na portalu.')) {
      this.http.put(`${this.API_URL}/ispit/publish-all`, {}).subscribe({
        next: (res: any) => {
          this.toastService.show('Raspored je uspešno objavljen!', 'success');
        },
        error: (err) => {
          console.error('Greška pri objavljivanju:', err);
          this.toastService.show('Došlo je do greške pri objavljivanju.', 'error');
        }
      });
    }
  }
}