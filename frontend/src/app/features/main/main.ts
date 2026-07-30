import { Component, AfterViewInit, ElementRef, ViewChild, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { FullCalendarModule } from '@fullcalendar/angular';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';
import { EventModal } from '../../shared/components/event-modal/event-modal.component';
import { ToastService } from '../../core/services/toast.service';
interface Profesor {
  id?: number;
  ime: string;
  prezime: string;
  email?: string;
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
  imports: [SidebarMenu, CommonModule, FullCalendarModule, MatDialogModule],
  templateUrl: './main.html',
  styleUrl: './main.css'
})
export class Main implements OnInit, AfterViewInit {
  @ViewChild('draggableContainer') draggableContainer!: ElementRef;

  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private API_URL = 'http://localhost:5000';
  private cdr = inject(ChangeDetectorRef);
  private toastService = inject(ToastService);
  username = localStorage.getItem('username');
  predmeti: Predmet[] = [];
  draggableInstance: Draggable | null = null;
  
  unsavedEvents: any[] = [];
  hasUnsavedChanges: boolean = false;

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    themeSystem: 'standard',
    height: '100%',
    firstDay: 1,
    dragRevertDuration: 0,
    droppable: true,
    editable: true,
    eventReceive: (info) => {
      // 1. Otvaramo modal kada se predmet spusti na kalendar
      const dialogRef = this.dialog.open(EventModal, {
        width: '450px',
        data: { title: info.event.title, date: info.event.startStr },
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          // 2. Ako je korisnik kliknuo "Sačuvaj termin" u modalu, dodajemo u LOKALNI DRAFT umesto na backend
          const predmetId = info.event.extendedProps['predmetId']; // Čitamo ID koji nam treba za bazu

          this.unsavedEvents.push({
            predmet_id: predmetId,
            title: info.event.title,
            datum: info.event.startStr.split('T')[0],
            vreme: result.vreme_pocetka || '09:00', // Povlačimo iz modala ako postoji, inače default
            sala: result.sala || 'Bez sale',
            backgroundColor: info.event.backgroundColor,
            borderColor: info.event.borderColor
          });

          this.hasUnsavedChanges = true;

          // Ažuriramo vizuelno tekst na kalendaru da prikaže i salu
          info.event.setProp('title', `${info.event.title} (${result.sala || 'Bez sale'})`);
          this.cdr.detectChanges();

        } else {
          // Ako je kliknuo "Otkaži" u modalu, brišemo event sa kalendara
          info.event.remove();
        }

        // Čišćenje fokusa/selekcije teksta
        window.getSelection()?.removeAllRanges();
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      });
    },
    titleFormat: (arg) => {
      const meseci = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
      return `${meseci[arg.date.month]} ${arg.date.year}.`;
    },
    dayHeaderContent: (arg) => {
      const daniSkraceno = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
      return daniSkraceno[arg.date.getDay()];
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
    if (!this.hasUnsavedChanges || this.unsavedEvents.length === 0) return;

    this.http.post(`${this.API_URL}/ispit/bulk`, this.unsavedEvents).subscribe({
      next: () => {
        this.toastService.show('Raspored je uspešno sačuvan u bazu!', 'success');
        this.unsavedEvents = [];
        this.hasUnsavedChanges = false;
        this.fetchIspiti();
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Greška pri čuvanju rasporeda:', err);
        this.toastService.show('Došlo je do greške pri čuvanju.', 'error');
      }
    });
  }

  ngOnInit(): void {
    this.fetchPredmeti();
    this.fetchIspiti();
  }

  ngAfterViewInit(): void {
    this.initDraggable();
  }

  getGodinaColor(godina?: number): string {
    switch (godina) {
      case 1: return '#34b9f7';
      case 2: return '#ef4444';
      case 3: return '#eab308';
      case 4: return '#10b981';
      default: return '#34b9f7';
    }
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

  fetchIspiti(): void {
    this.http.get<any[]>(`${this.API_URL}/ispit`).subscribe({
      next: (ispiti) => {
        const events = ispiti.map(i => {
          const boja = this.getGodinaColor(i.predmet?.godina);
          return {
            id: i.id.toString(),
            title: `${i.predmet?.naziv || 'Ispit'} (${i.sala || 'Bez sale'})`,
            start: `${i.datum}T${i.vreme}`,
            display: 'block', // <--- OVO REŠAVA BELU BOJU
            backgroundColor: boja,
            borderColor: boja
          };
        });
        this.calendarOptions.events = events;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Greška pri dohvatanju ispita:', err)
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
}