import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SidebarMenu } from '../sidebar-menu/sidebar-menu';
import { FullCalendarModule } from '@fullcalendar/angular'; 
import { MatDialogModule } from '@angular/material/dialog'; 

import { CalendarOptions } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import timeGridPlugin from '@fullcalendar/timegrid';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [SidebarMenu, CommonModule, FullCalendarModule, MatDialogModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main {

  username = localStorage.getItem('username');

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin], 
    
    initialView: 'dayGridMonth',
    themeSystem: 'standard', 
    height: '100%', 
    
    firstDay: 1,

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
}