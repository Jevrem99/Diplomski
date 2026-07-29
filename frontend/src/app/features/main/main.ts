import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { FullCalendarModule } from '@fullcalendar/angular'; 
import { MatDialogModule } from '@angular/material/dialog'; 

import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [SidebarMenu, CommonModule, FullCalendarModule, MatDialogModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main implements AfterViewInit {
  // Hvatamo div koji sadrži predmete (onaj sa #draggableContainer u HTML-u)
  @ViewChild('draggableContainer') draggableContainer!: ElementRef;
  
  username = localStorage.getItem('username');

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    themeSystem: 'standard', 
    height: '100%',
    firstDay: 1,
    
    // OVO JE KLJUČNO ZA DRAG & DROP
    droppable: true, // Dozvoljava prevlačenje elemenata spolja na kalendar
    editable: true,  // Dozvoljava pomeranje predmeta kada se već nalaze na kalendaru
    
    // Funkcija koja se okida kada pustiš predmet na datum
    drop: (info) => {
      console.log('Spustio si predmet na datum:', info.dateStr);
      // Ovde ćemo kasnije pozivati funkciju da se otvori onaj Modal prozor za unos vremena i sale!
    },

    titleFormat: (arg) => {
      const meseci = [
        'Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 
        'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'
      ];
      const mesec = meseci[arg.date.month];
      const godina = arg.date.year;
      return `${mesec} ${godina}.`;
    },
    dayHeaderContent: (arg) => {
      const daniSkraceno = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
      const daniPuni = ['Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota', 'Nedelja'];
             
      const indeksDana = arg.date.getDay();
      const danUMesecu = arg.date.getDate();
      const mesec = arg.date.getMonth() + 1;
      
      if (arg.view.type === 'dayGridMonth') {
        return daniSkraceno[indeksDana];
      }
      return `${daniPuni[indeksDana]} ${danUMesecu}.${mesec}.`;
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
    },
  };

  ngAfterViewInit() {
    // Kada se stranica učita, govorimo FullCalendar-u da obrati pažnju na levi panel
    if (this.draggableContainer) {
      new Draggable(this.draggableContainer.nativeElement, {
        itemSelector: '.fc-event', // Traži sve HTML elemente sa ovom klasom
        eventData: function(eventEl) {
          // Kada uhvatimo predmet, uzimamo njegov naziv (iz h3 taga)
          return {
            title: eventEl.querySelector('h3')?.innerText || 'Nepoznat predmet'
          };
        }
      });
    }
  }
}