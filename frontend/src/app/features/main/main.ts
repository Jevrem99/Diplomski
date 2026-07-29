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
  username = localStorage.getItem('username');
  predmeti: Predmet[] = [];
  draggableInstance: Draggable | null = null;

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
      const dialogRef = this.dialog.open(EventModal, {
        width: '450px',
        data: {
          title: info.event.title,
          date: info.event.startStr
        },
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          // Slanje novog termina na backend
          this.http.post(`${this.API_URL}/ispit`, result).subscribe({
            next: (res) => {
              console.log('Termin uspešno sačuvan u bazi:', res);
            },
            error: (err) => {
              console.error('Greška pri čuvanju termina:', err);
              info.event.remove(); // Brišemo sa kalendara ako backend odbije
            }
          });
        } else {
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

  ngOnInit(): void {
    this.fetchPredmeti();
    this.fetchIspiti();
  }

  ngAfterViewInit(): void {
    this.initDraggable();
  }

  getGodinaColor(godina?: number): string {
  switch (godina) {
    case 1: return '#34b9f7'; // 1. godina -> Plava
    case 2: return '#ef4444'; // 2. godina -> Crvena
    case 3: return '#eab308'; // 3. godina -> Žuta
    case 4: return '#10b981'; // 4. godina -> Zelena
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
      eventData: function(eventEl) {
        // Izvlačimo godinu iz dataset-a koji smo stavili u HTML
        const godina = parseInt(eventEl.getAttribute('data-godina') || '1');
        const boja = self.getGodinaColor(godina);

        return {
          title: eventEl.querySelector('h3')?.innerText || 'Nepoznat predmet',
          backgroundColor: boja,
          borderColor: boja
        };
      }
    });
  }
}
}