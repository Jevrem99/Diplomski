import { Component, AfterViewInit, ElementRef, ViewChild, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';

import { FullCalendarModule, FullCalendarComponent } from '@fullcalendar/angular'; // Dodat FullCalendarComponent
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
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;
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
          const predmetId = info.event.extendedProps['predmetId'];
          const droppedPredmet = this.predmeti.find(p => p.id == predmetId);

          this.unsavedEvents.push({
            predmet_id: predmetId,
            title: info.event.title,
            datum: info.event.startStr.split('T')[0],
            vreme: result.startTime, // POPRAVLJENO: bilo vreme_pocetka
            sala: result.room,       // POPRAVLJENO: bilo sala
            backgroundColor: info.event.backgroundColor,
            borderColor: info.event.borderColor
          });

          // Pripajamo atribute dogadjaju kako bi funkcija za konflikte mogla da ih čita
          info.event.setExtendedProp('vreme', result.startTime);
          info.event.setExtendedProp('sala', result.room);
          info.event.setExtendedProp('profesorId', droppedPredmet?.profesor_id);
          info.event.setExtendedProp('profesorIme', droppedPredmet?.profesorImePrezime);
          
          this.hasUnsavedChanges = true;
          info.event.setProp('title', `${info.event.title} (${result.room || 'Bez sale'})`);
          this.cdr.detectChanges();

          // POKRETANJE PROVERE!
          setTimeout(() => this.detectConflicts(), 100);

        } else {
          info.event.remove();
        }
        
        // ... (tvoj postojeći kod za brisanje fokusa) ...

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
          const salaNaziv = i.sala?.naziv || i.sala || 'Bez sale'; // Podržava i string i novu relaciju
          const formatiranoVreme = i.vreme ? i.vreme.substring(0, 5) : '00:00';

          return {
            id: i.id.toString(),
            title: `${i.predmet?.naziv || 'Ispit'} (${salaNaziv})`,
            start: `${i.datum}T${i.vreme}`,
            display: 'block', 
            backgroundColor: boja,
            borderColor: boja,
            extendedProps: { // Pripajamo atribute iz baze da bi funkcija za konflikte radila
              vreme: formatiranoVreme,
              sala: salaNaziv,
              profesorId: i.predmet?.profesor?.id,
              profesorIme: i.predmet?.profesor ? `${i.predmet.profesor.ime} ${i.predmet.profesor.prezime}` : 'Nepoznat'
            }
          };
        });
        
        this.calendarOptions.events = events;
        this.cdr.detectChanges();
        
        // Pokretanje provere čim se kalendar učita iz baze!
        setTimeout(() => this.detectConflicts(), 200);
      },
      error: (err) => console.error('Gre ka pri dohvatanju ispita:', err)
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
    
    // Uzimamo SVE evente sa kalendara (i one iz baze, i one tek prevučene)
    const allEvents = this.calendarComponent.getApi().getEvents();
    const conflictsByDate = new Map<string, string[]>();

    // Grupišemo sve događaje po datumu (npr. "2026-08-15")
    const eventsByDate: Record<string, any[]> = {};
    allEvents.forEach(evt => {
      const dateStr = evt.startStr.split('T')[0];
      if (!eventsByDate[dateStr]) eventsByDate[dateStr] = [];
      eventsByDate[dateStr].push(evt);
    });

    // Prolazimo kroz svaki dan i tražimo preklapanja
    for (const date in eventsByDate) {
      const evts = eventsByDate[date];
      const razlozi: string[] = [];

      for (let i = 0; i < evts.length; i++) {
        for (let j = i + 1; j < evts.length; j++) {
          const e1 = evts[i];
          const e2 = evts[j];

          const v1 = e1.extendedProps['vreme'];
          const v2 = e2.extendedProps['vreme'];

          if (v1 && v2 && v1 === v2) {
            const s1 = e1.extendedProps['sala'];
            const s2 = e2.extendedProps['sala'];
            
            // 1. Sukob sala
            if (s1 && s2 && s1 === s2 && s1 !== 'Bez sale') {
              razlozi.push(`⚠️ Sala "${s1}" se preklapa u ${v1}.`);
            }

            // 2. Sukob profesora
            const p1 = e1.extendedProps['profesorId'];
            const p2 = e2.extendedProps['profesorId'];
            
            if (p1 && p2 && p1 === p2) {
              const profIme = e1.extendedProps['profesorIme'];
              razlozi.push(`⚠️ ${profIme} drži 2 ispita u ${v1}.`);
            }
          }
        }
      }

      if (razlozi.length > 0) {
        conflictsByDate.set(date, [...new Set(razlozi)]); // Sklanja duplikate
      }
    }

    // VIZUELNO MENJANJE KALENDARA
    document.querySelectorAll('.fc-daygrid-day').forEach((cell: any) => {
      const date = cell.getAttribute('data-date');
      const frame = cell.querySelector('.fc-daygrid-day-frame');
      
      // Resetujemo boju i brišemo stare ikonice (za slučaj da je korisnik pomerio event)
      cell.style.backgroundColor = '';
      const oldWarning = frame?.querySelector('.conflict-warning');
      if (oldWarning) oldWarning.remove();

      // Ako za ovaj dan postoji konflikt, pali alarm!
      if (date && conflictsByDate.has(date)) {
        cell.style.backgroundColor = '#fff9c4'; // Žuta pozadina
        
        if (frame) {
          frame.style.position = 'relative';
          const warning = document.createElement('div');
          warning.className = 'conflict-warning';
          warning.innerHTML = '⚠️';
          warning.style.position = 'absolute';
          warning.style.top = '4px';
          warning.style.right = '4px';
          warning.style.fontSize = '18px';
          warning.style.cursor = 'help';
          warning.style.zIndex = '10';
          warning.title = conflictsByDate.get(date)!.join('\n'); // Popunjava popup na hover
          
          frame.appendChild(warning);
        }
      }
    });
  }
}