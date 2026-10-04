import { Component, AfterViewInit, ElementRef, ViewChild, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
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
import { DataCacheService } from '../../core/services/data-cache.service';
import { FormsModule } from '@angular/forms';
import { ExportModalComponent, ExportDataResult } from '../../shared/components/export-modal/export-modal.component';
import { environment } from '../../../environments/environment';
interface Profesor {
  id?: number;
  ime: string;
  prezime: string;
  email?: string;
}

function presloviULatinicu(tekst: string): string {
  if (!tekst) return '';
  const cirilicaToLatinica: { [key: string]: string } = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ђ': 'dj', 'е': 'e', 'ж': 'z', 'з': 'z', 'и': 'i',
    'ј': 'j', 'к': 'k', 'л': 'l', 'љ': 'lj', 'м': 'm', 'н': 'n', 'њ': 'nj', 'о': 'o', 'п': 'p', 'р': 'r',
    'с': 's', 'т': 't', 'ћ': 'c', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'c', 'џ': 'dz', 'ш': 's',
    'А': 'a', 'Б': 'b', 'В': 'v', 'Г': 'g', 'Д': 'd', 'Ђ': 'dj', 'Е': 'e', 'Ж': 'z', 'З': 'z', 'И': 'i',
    'Ј': 'j', 'К': 'k', 'Л': 'l', 'Љ': 'lj', 'М': 'm', 'Н': 'n', 'Њ': 'nj', 'О': 'o', 'П': 'p', 'Р': 'r',
    'С': 's', 'Т': 't', 'Ћ': 'c', 'У': 'u', 'Ф': 'f', 'Х': 'h', 'Ц': 'c', 'Ч': 'c', 'Џ': 'dz', 'Ш': 's',
    'č': 'c', 'ć': 'c', 'š': 's', 'ž': 'z', 'đ': 'dj', 'Č': 'c', 'Ć': 'c', 'Š': 's', 'Ž': 'z', 'Đ': 'dj'
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
  saradnici?: any[];
}

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [SidebarMenu, CommonModule, FullCalendarModule, MatDialogModule, FormsModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './main.html',
  styleUrl: './main.css',
})
export class Main implements OnInit, AfterViewInit {
  @ViewChild('draggableContainer') draggableContainer!: ElementRef;
  @ViewChild('calendar') calendarComponent!: FullCalendarComponent;

  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private API_URL = environment.apiUrl;
  private cdr = inject(ChangeDetectorRef);
  private toastService = inject(ToastService);
  private cache = inject(DataCacheService);
  private ngZone = inject(NgZone);

  // --- KONTROLA PRIKAZA PANELA I STATUSA ---
  prikaziLevoFiltere: boolean = false;
  prikaziDesnoFiltere: boolean = false;
  username = localStorage.getItem('username');
  predmeti: Predmet[] = [];
  draggableInstance: Draggable | null = null;
  modifiedEvents: any[] = [];
  unsavedEvents: any[] = [];
  obrisaniIspitiServerIds: number[] = [];
  hasUnsavedChanges: boolean = false;

  prikaziIspite: boolean = true;
  prikaziKolokvijume: boolean = true;
  isDashboardOpen: boolean = false;

  // --- MASOVNO UREĐIVANJE I KOPIRANJE DANA ---
  rezimUredjivanjaDana: boolean = false;
  selektovaniDani = new Set<string>();
  kopiranjeAktivno: boolean = false;

  // --- STARI MODAL ZA UPRAVLJANJE JEDNIM DANOM ---
  prikaziDanModal: boolean = false;
  danModalPrikaz: 'meni' | 'preuredi' = 'meni';
  selektovanDan: string = '';
  ispitiZaPreuredjivanje: any[] = [];
  ispitiZaBrisanje: string[] = [];

  // --- MODALI ---
  prikaziObrisiModal: boolean = false;
  prikaziKonfliktiModal: boolean = false;
  prikaziKonfliktePriCuvanju: boolean = false;
  konfliktiPriCuvanju: any[] = [];
  proveraUToku: boolean = false;
  prikaziIzvozModal: boolean = false;

  // --- FILTERI ---
  izabraneGodine: number[] = [];
  godineOpcije = [
    { id: 1, label: '1. God' },
    { id: 2, label: '2. God' },
    { id: 3, label: '3. God' },
    { id: 4, label: '4. God' }
  ];
  filterGodina: string = 'sve';
  filterSala: string = 'sve';
  filterLevoGodina: string = 'sve';
  filterLevoProfesor: string = 'svi';
  izabranaGodinaBanka: string | number = 'sve';
  searchPredmet: string = '';
  prikazaniBrojPredmeta: number = 5;
  filterSaradnici: number[] = [];

  defaultGodinaColors: any = {
    1: '#009bd9',
    2: '#d81b43',
    3: '#f39c12',
    4: '#27AE60'
  };
  godinaColors: any = { ...this.defaultGodinaColors };

  // --- IZVOZ PODACI ---
  izvozPodaci = {
    tip: 'kolokvijumi',
    datumOd: '',
    datumDo: '',
    nazivRoka: '',
    naslovRasporeda: ''
  };
  rezimBiranjaOpsegaIzvoza: boolean = false;
  tempExportData: any = null;
  tempPickingTarget: any = null;
  exportStartPickedDate: string | null = null;
  exportHoveredDate: string | null = null;
  // --- PODACI SA SERVERA ---
  dostupneSale: any[] = [];
  allLoadedEvents: any[] = [];
  sviSaradnici: any[] = [];
  sveObaveze: any[] = [];
  daniSaIspitima = new Set<string>();
  conflictsByDateMap = new Map<string, string[]>();
  listaSvihKonflikata: { datum: string; razlozi: string[] }[] = [];
  stats = { totalIspiti: 0, totalSaradnici: 0, topDezurni: 'Učitavanje...', konflikti: 0 };

  // ============================================
  // FULLCALENDAR KONFIGURACIJA
  // ============================================
  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    height: '100%',
    firstDay: 1,
    displayEventEnd: false,
    dayMaxEvents: false,
    dayMaxEventRows: false,
    eventOrder: 'start,title',
    dragRevertDuration: 0,
    droppable: true,
    editable: true,
    dayCellClassNames: (arg) => {
      const classes: string[] = [];
      if (!this.rezimBiranjaOpsegaIzvoza) return classes;

      const d = arg.date;
      const currentStr = d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');

      const start = this.exportStartPickedDate;
      const hover = this.exportHoveredDate;

      if (start) {
        if (currentStr === start) {
          classes.push('fc-day-range-edge');
          return classes;
        }

        if (hover) {
          let d1 = start;
          let d2 = hover;
          if (d1 > d2) {
            const tmp = d1; d1 = d2; d2 = tmp;
          }

          if (currentStr === d2) {
            classes.push('fc-day-range-edge');
          } else if (currentStr > d1 && currentStr < d2) {
            classes.push('fc-day-in-range');
          }
        }
      }
      return classes;
    },
    dayCellContent: (arg) => {
      const d = arg.date;
      const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const today = new Date();
      const isToday = d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();

      // Izgled se definiše u CSS-u (main.css i theme.css), ovde samo klase
      let html = `<div class="cal-day-row">`;
      html += `<span class="cal-day-num${isToday ? ' is-today' : ''}">${arg.dayNumberText}</span>`;
      html += `<div class="day-actions-wrapper" data-date="${dateStr}">`;

      if (this.rezimUredjivanjaDana) {
        const isSelected = this.selektovaniDani.has(dateStr);
        if (isSelected) {
          html += `
            <div class="day-select-circle is-selected" data-date="${dateStr}">
              <svg width="12" height="12" fill="none" stroke="white" stroke-width="3.5" viewBox="0 0 24 24" style="pointer-events:none;"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
            </div>`;
        } else if (this.kopiranjeAktivno) {
          html += `<div class="day-select-circle is-copy" data-date="${dateStr}"></div>`;
        } else {
          html += `<div class="day-select-circle" data-date="${dateStr}"></div>`;
        }
      }

      html += `</div></div>`;
      return { html };
    },

    dateClick: (info) => {
      if (this.rezimBiranjaOpsegaIzvoza) {
        this.ngZone.run(() => {
          this.obradiIzborDatumaZaIzvoz(info.dateStr);
        });
        return;
      }

      if (this.rezimUredjivanjaDana) {
        this.ngZone.run(() => {
          this.toggleSelektovanDan(info.dateStr);
          this.cdr.detectChanges();
        });
      }
    },

    eventClick: (info) => {
      if (info.event.display === 'background') return;

      const eventDate = info.event.startStr
        ? info.event.startStr.split('T')[0]
        : (info.event.start ? info.event.start.toISOString().split('T')[0] : '');
      const cistNaslov = info.event.title.split(' (')[0];
      const sviDogadjaji = this.calendarComponent.getApi().getEvents();

      const zauzecaNaDan = sviDogadjaji
        .filter(e => {
          const dStr = e.startStr.split('T')[0] || (e.start ? e.start.toISOString().split('T')[0] : '');
          return dStr === eventDate && e.id !== info.event.id;
        })
        .map(e => ({
          sala: e.extendedProps['sala'],
          vreme: e.extendedProps['vreme'],
          vremeKraja: e.extendedProps['vreme_kraja'] || e.extendedProps['vremeKraja'] || ''
        }));

      // 2. Otvaranje modala (šaljemo vreme_kraja kao endTime)
      const dialogRef = this.dialog.open(EventModal, {
        maxWidth: '95vw',
        width: '1100px',
        maxHeight: '120vh',
        data: {
          title: cistNaslov,
          date: eventDate,
          startTime: info.event.extendedProps['vreme'],
          endTime: info.event.extendedProps['vreme_kraja'] || info.event.extendedProps['vremeKraja'] || '', // <-- OVDJE POVLAČI VREME KRAJA
          room: info.event.extendedProps['sala'],
          predmetId: info.event.extendedProps['predmetId'],
          tip_kolokvijuma: info.event.extendedProps['tip_kolokvijuma'] || 'I',
          is_ispit: info.event.extendedProps['is_ispit'] ?? true,
          dezurni: info.event.extendedProps['dezurni'] || [],
          zauzeteSaleNaDan: zauzecaNaDan
        },
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          if (result.action === 'delete') {
            if (info.event.id && !info.event.id.startsWith('temp_')) {
              const idNum = Number(info.event.id);
              if (!this.obrisaniIspitiServerIds.includes(idNum)) {
                this.obrisaniIspitiServerIds.push(idNum);
              }
              this.allLoadedEvents = this.allLoadedEvents.filter(e => e.id !== info.event.id);
              this.hasUnsavedChanges = true;
              this.applyFilters();
              this.toastService.show('Termin označen za brisanje. Sačuvajte izmene.', 'success');
            } else {
              this.unsavedEvents = this.unsavedEvents.filter(e => e.tempId !== info.event.id);
              this.allLoadedEvents = this.allLoadedEvents.filter(e => e.id !== info.event.id);
              this.hasUnsavedChanges = this.unsavedEvents.length > 0 || this.modifiedEvents.length > 0 || this.obrisaniIspitiServerIds.length > 0;
              this.applyFilters();
            }
            setTimeout(() => this.detectConflicts(), 150);
            return;
          }

          this.hasUnsavedChanges = true;
          const dezurniIds = result.dezurni_ids || result.formData?.dezurni_ids || [];
          const izabraniSaradnici = result.izabraniSaradnici || [];
          const isIspit = result.is_ispit ?? true;
          const tipKolokvijuma = result.tip_kolokvijuma || 'I';

          const krajVreme = result.endTime || '';

          if (info.event.id && info.event.id.startsWith('temp_')) {
            const draftEvt = this.unsavedEvents.find(e => e.tempId === info.event.id);
            if (draftEvt) {
              draftEvt.vreme = result.startTime;
              draftEvt.vreme_kraja = krajVreme;
              draftEvt.sala = result.room;
              draftEvt.is_ispit = isIspit;
              draftEvt.tip_kolokvijuma = tipKolokvijuma;
              draftEvt.dezurni_ids = dezurniIds;
            }
          } else {
            const payload = {
              id: Number(info.event.id),
              datum: eventDate,
              vreme: result.startTime,
              vreme_kraja: krajVreme,
              sala: result.room,
              predmet_id: info.event.extendedProps['predmetId'],
              is_ispit: isIspit,
              tip_kolokvijuma: tipKolokvijuma,
              dezurni_ids: dezurniIds
            };
            const existingIndex = this.modifiedEvents.findIndex(e => String(e.id) === String(info.event.id));
            if (existingIndex > -1) this.modifiedEvents[existingIndex] = payload;
            else this.modifiedEvents.push(payload);
          }

          const evtIndex = this.allLoadedEvents.findIndex(e => String(e.id) === String(info.event.id));
          if (evtIndex > -1) {
            const boja = this.getGodinaColor(this.allLoadedEvents[evtIndex].extendedProps.godina);
            this.allLoadedEvents[evtIndex] = {
              ...this.allLoadedEvents[evtIndex],
              start: eventDate + 'T' + result.startTime + ':00',
              end: krajVreme ? (eventDate + 'T' + krajVreme + ':00') : undefined,
              title: cistNaslov + ' (' + result.room + ')',
              backgroundColor: isIspit ? boja : '#ffffff',
              textColor: isIspit ? '#ffffff' : boja,
              borderColor: boja,
              extendedProps: {
                ...this.allLoadedEvents[evtIndex].extendedProps,
                vreme: result.startTime,
                vreme_kraja: krajVreme,
                tip_kolokvijuma: tipKolokvijuma,
                sala: result.room,
                is_ispit: isIspit,
                dezurni: izabraniSaradnici
              }
            };
          }
          this.applyFilters();
          setTimeout(() => this.detectConflicts(), 150);
        }
      });
    },

    eventReceive: (info) => {
      const originalEvent = info.event;
      const eventDate = originalEvent.startStr.split('T')[0];
      const predmetId = originalEvent.extendedProps['predmetId'];
      const droppedPredmet = this.predmeti.find(p => p.id == predmetId);

      originalEvent.remove();

      const sviDogadjaji = this.calendarComponent.getApi().getEvents();
      const zauzecaNaDan = sviDogadjaji
        .filter(e => {
          const dStr = e.startStr.split('T')[0] || e.start?.toISOString().split('T')[0];
          return dStr === eventDate && e.id !== originalEvent.id;
        })
        .map(e => ({
          sala: e.extendedProps['sala'], vreme: e.extendedProps['vreme'], vremeKraja: e.extendedProps['vremeKraja']
        }));

      const dialogRef = this.dialog.open(EventModal, {
        maxWidth: '95vw', width: '1100px', maxHeight: '120vh',
        data: {
          title: originalEvent.title, date: eventDate, predmetId: predmetId,
          dezurni: droppedPredmet?.saradnici || [], is_ispit: true, zauzeteSaleNaDan: zauzecaNaDan,
          tip_kolokvijuma: info.event.extendedProps['tip_kolokvijuma'] || 'I',
        },
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          const dezurniIds = result.dezurni_ids || result.formData?.dezurni_ids || [];
          const izabraniSaradnici = result.izabraniSaradnici || [];
          const isIspit = result.is_ispit ?? true;
          const tipKolokvijuma = result.tip_kolokvijuma || 'I';

          this.unsavedEvents.push({
            tempId: tempId,
            predmet_id: predmetId,
            title: result.title,
            datum: eventDate,
            vreme: result.startTime,
            vreme_kraja: result.endTime,
            sala: result.room,
            is_ispit: isIspit,
            tip_kolokvijuma: tipKolokvijuma,
            dezurni_ids: dezurniIds,
            backgroundColor: originalEvent.backgroundColor,
            borderColor: originalEvent.borderColor
          });

          const noviEvent = {
            id: tempId, title: `${result.title} (${result.room})`,
            start: `${eventDate}T${result.startTime}:00`, end: result.endTime ? `${eventDate}T${result.endTime}:00` : undefined,
            display: 'block', backgroundColor: isIspit ? originalEvent.backgroundColor : '#ffffff',
            borderColor: originalEvent.borderColor,
            extendedProps: {
              vreme: result.startTime, vremeKraja: result.endTime, sala: result.room,
              predmetId: predmetId, godina: droppedPredmet?.godina, profesorId: droppedPredmet?.profesor_id,
              profesorIme: droppedPredmet?.profesorImePrezime, is_ispit: isIspit, tip_kolokvijuma: tipKolokvijuma, dezurni: izabraniSaradnici
            }
          };

          this.allLoadedEvents.push(noviEvent);
          this.hasUnsavedChanges = true;
          this.applyFilters();
          setTimeout(() => this.detectConflicts(), 150);
        }
        window.getSelection()?.removeAllRanges();
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
    },

    eventDrop: (info) => {
      this.hasUnsavedChanges = true;

      const d = info.event.start;
      if (!d) return;

      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const newDate = y + '-' + m + '-' + day;

      const eventIdStr = String(info.event.id);
      const postojeci = this.allLoadedEvents.find(e => String(e.id) === eventIdStr);
      const prethodnoIzmenjen = this.modifiedEvents.find(e => String(e.id) === eventIdStr);

      // 1. Čitanje početka
      let vreme = postojeci?.extendedProps?.vreme ||
        prethodnoIzmenjen?.vreme ||
        info.oldEvent?.extendedProps?.['vreme'] || '09:00';
      if (vreme.length === 4 && vreme.indexOf(':') === 1) vreme = '0' + vreme;

      // 2. Čitanje kraja (Gledamo postojeci, pa prethodni modifiedEvents, pa info.oldEvent)
      let kraj = postojeci?.extendedProps?.vreme_kraja ||
        prethodnoIzmenjen?.vreme_kraja ||
        info.oldEvent?.extendedProps?.['vreme_kraja'] || '';

      // Rezerva: ako je u postojeci.end stajao puni ISO string (npr. "2026-10-06T09:30:00")
      if (!kraj && postojeci && postojeci.end && String(postojeci.end).includes('T')) {
        kraj = String(postojeci.end).substring(11, 16);
      }

      if (kraj === '00:00') kraj = '';

      const isIspit = postojeci?.extendedProps?.is_ispit ?? true;
      const sala = postojeci?.extendedProps?.sala || 'Bez sale';
      const predmetId = postojeci?.extendedProps?.predmetId;
      const tipKolokvijuma = postojeci?.extendedProps?.tip_kolokvijuma || 'I';
      const dezurniLica = postojeci?.extendedProps?.dezurni || [];
      const dezurniIds = dezurniLica.map((dez: any) => (typeof dez === 'object' ? dez.id : dez));

      // 3. Upis u modifiedEvents (isključivo vreme_kraja)
      if (!eventIdStr.startsWith('temp_')) {
        const existingIndex = this.modifiedEvents.findIndex(e => String(e.id) === eventIdStr);
        const payload = {
          id: Number(info.event.id),
          datum: newDate,
          vreme: vreme,
          vreme_kraja: kraj,
          sala: sala,
          predmet_id: predmetId,
          is_ispit: isIspit,
          tip_kolokvijuma: tipKolokvijuma,
          dezurni_ids: dezurniIds
        };

        console.log('📦 Pripremljen PAYLOAD za modifiedEvents:', payload);

        if (existingIndex > -1) {
          this.modifiedEvents[existingIndex] = payload;
        } else {
          this.modifiedEvents.push(payload);
        }
      } else {
        const unsavedEvent = this.unsavedEvents.find(e => String(e.tempId) === eventIdStr);
        if (unsavedEvent) {
          unsavedEvent.datum = newDate;
          unsavedEvent.vreme = vreme;
          unsavedEvent.vreme_kraja = kraj;
        }
      }

      // 4. Ažuriranje allLoadedEvents
      const startIso = newDate + 'T' + vreme + ':00';
      const endIso = kraj ? (newDate + 'T' + kraj + ':00') : undefined;

      const evtIndex = this.allLoadedEvents.findIndex(e => String(e.id) === eventIdStr);
      if (evtIndex > -1) {
        this.allLoadedEvents[evtIndex] = {
          ...this.allLoadedEvents[evtIndex],
          start: startIso,
          end: endIso,
          extendedProps: {
            ...this.allLoadedEvents[evtIndex].extendedProps,
            vreme: vreme,
            vreme_kraja: kraj
          }
        };
      }

      // 5. Ažuriranje FullCalendar prikaza
      info.event.setAllDay(false);
      info.event.setExtendedProp('vreme', vreme);
      info.event.setExtendedProp('vreme_kraja', kraj);
      info.event.setDates(startIso, endIso || null, { allDay: false });

      this.detectConflicts();
      this.cdr.detectChanges();
    },

    eventContent: (arg) => {
      if (arg.event.display === 'background') return null;

      const title = arg.event.title ? arg.event.title.split(' (')[0] : '';
      const isIspit = arg.event.extendedProps['is_ispit'] ?? true;
      const vreme = arg.event.extendedProps['vreme'] || '00:00';
      const godina = arg.event.extendedProps['godina'] || 1;
      const boja = this.getGodinaColor(godina);

      // --ev = boja godine; sve ostalo (pozadina, ivica, tekst) određuje CSS aktivnog dizajna
      return {
        html: `
          <div class="clean-cal-card ${isIspit ? 'is-ispit' : 'is-kolokvijum'}" style="--ev: ${boja};">
            <div class="cal-card-time">${vreme}</div>
            <div class="cal-title-container cal-ticker-wrap">
              <span class="cal-title-text cal-ticker-text">${title}</span>
            </div>
          </div>
        `
      };
    },

    eventMouseEnter: (info) => {
      if (info.event.display === 'background') return;

      const postojeci = document.getElementById('brief-info-popup');
      if (postojeci) postojeci.remove();

      const props = info.event.extendedProps;
      const tip = props['is_ispit'] === false ? 'Kolokvijum' : 'Ispit';
      const k = props['vremeKraja'] || props['vreme_kraja'];
      const vremeKraja = (k && k !== '00:00' && k !== '0:00') ? ` - ${k}h` : '';
      const vremePocetka = props['vreme'] || '09:00';
      const sala = props['sala'] || 'Bez sale';
      const naslov = info.event.title.split(' (')[0];
      const dezurniImena = (props['dezurni'] || []).map((d: any) => `${d.ime} ${d.prezime}`).join(', ') || 'Nema dodeljenih';

      const tooltip = document.createElement('div');
      tooltip.id = 'brief-info-popup';
      tooltip.style.cssText = `
        position: fixed;
        z-index: 9999999;
        background: var(--surface);
        color: var(--text);
        border-radius: 12px;
        padding: 12px 15px;
        box-shadow: 0 15px 30px -5px rgba(15, 23, 42, 0.2), 0 0 0 1px var(--border-strong);
        pointer-events: none;
        font-family: 'Montserrat', sans-serif;
        min-width: 220px;
        max-width: 320px;
      `;

      tooltip.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px;">
          <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2.5px 8px; border-radius: 6px; background: ${props['is_ispit'] === false ? 'var(--tint-amber-bg)' : 'var(--tint-sky-bg)'}; color: ${props['is_ispit'] === false ? 'var(--tint-amber-fg)' : 'var(--primary-text)'};">${tip}</span>
          <span style="font-size: 11px; font-weight: 700; color: var(--muted);">${sala}</span>
        </div>
        <div style="font-size: 13px; font-weight: 800; color: var(--text); margin-bottom: 6px; line-height: 1.3;">${naslov}</div>
        <div style="font-size: 12px; font-weight: 700; color: var(--primary-text); margin-bottom: 7px;">Termin: ${vremePocetka}${vremeKraja}</div>
        <div style="font-size: 11px; font-weight: 600; color: var(--muted); border-top: 1px solid var(--border); padding-top: 7px;">Dežurni: <strong style="color: var(--text-2);">${dezurniImena}</strong></div>
      `;
      document.body.appendChild(tooltip);

      const rect = info.el.getBoundingClientRect();
      const topPos = rect.top - tooltip.offsetHeight - 8;
      tooltip.style.top = `${topPos < 10 ? rect.bottom + 8 : topPos}px`;
      tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
    },

    eventMouseLeave: (info) => {
      const tooltip = document.getElementById('brief-info-popup');
      if (tooltip) tooltip.remove();
    },

    titleFormat: (arg) => {
      const meseci = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
      return `${meseci[arg.date.month]} ${arg.date.year}.`;
    },
    dayHeaderContent: (arg) => {
      const daniSkraceno = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
      return daniSkraceno[arg.date.getDay()];
    },
    views: {
      timeGridWeek: {
        dayHeaderContent: (arg) => {
          const daniSkraceno = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
          const d = arg.date;
          return `${daniSkraceno[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
        }
      },
      timeGridDay: {
        dayHeaderContent: (arg) => {
          const daniPuni = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'];
          const meseci = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
          const d = arg.date;
          return `${daniPuni[d.getDay()]}, ${d.getDate()}. ${meseci[d.getMonth()]}`;
        }
      }
    },
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    buttonText: { today: 'Danas', month: 'Mesec', week: 'Nedelja', day: 'Dan' }
  };

  // ============================================
  // MASOVNO UREĐIVANJE, KOPIRANJE I BRISANJE
  // ============================================

  toggleRezimUredjivanja(): void {
    this.rezimUredjivanjaDana = !this.rezimUredjivanjaDana;
    this.kopiranjeAktivno = false;
    this.selektovaniDani.clear();
    this.osveziPrikazKalendara();
  }

  toggleKopiranje(): void {
    if (this.selektovaniDani.size === 0) return;
    this.kopiranjeAktivno = !this.kopiranjeAktivno;

    if (this.kopiranjeAktivno) {
      if (this.selektovaniDani.size === 1) {
        this.toastService.show('Kliknite na datume gde želite da iskopirate izabrani dan.', 'success');
      } else {
        this.toastService.show('Kliknite na datum od kog kreće preslikavanje izabranih dana.', 'success');
      }
    }
    this.osveziPrikazKalendara();
  }

  toggleSelektovanDan(datum: string): void {
    if (this.kopiranjeAktivno) {
      this.izvrsiUnificiranoKopiranje(datum);
      return;
    }

    if (this.selektovaniDani.has(datum)) {
      this.selektovaniDani.delete(datum);
    } else {
      this.selektovaniDani.add(datum);
    }

    this.cdr.detectChanges();
    this.osveziPrikazKalendara();
  }

  izvrsiUnificiranoKopiranje(ciljniDatum: string): void {
    const sortiraniDani = Array.from(this.selektovaniDani).sort();
    if (sortiraniDani.length === 0) return;

    // SLUČAJ 1: Kopiranje jednog dana na više mesta
    if (sortiraniDani.length === 1) {
      const izvorniDan = sortiraniDani[0];
      if (ciljniDatum === izvorniDan) return;

      const ispitiIzDana = this.allLoadedEvents.filter(e => e.start.startsWith(izvorniDan) && !e.extendedProps?.isNastava);
      if (ispitiIzDana.length === 0) {
        this.toastService.show('Izabrani dan nema ispita za kopiranje.', 'error');
        return;
      }

      ispitiIzDana.forEach(stari => {
        const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const noviStart = stari.start.replace(izvorniDan, ciljniDatum);
        const noviEnd = stari.end ? stari.end.replace(izvorniDan, ciljniDatum) : undefined;

        this.allLoadedEvents.push({ ...stari, id: tempId, start: noviStart, end: noviEnd });
        this.unsavedEvents.push({
          tempId: tempId,
          predmet_id: stari.extendedProps.predmetId,
          title: stari.title.split(' (')[0],
          datum: ciljniDatum,
          vreme: stari.extendedProps.vreme,
          vreme_kraja: stari.extendedProps.vremeKraja,
          sala: stari.extendedProps.sala,
          is_ispit: stari.extendedProps.is_ispit,
          dezurni_ids: stari.extendedProps.dezurni?.map((d: any) => d.id) || []
        });
      });

      this.hasUnsavedChanges = true;
      this.osveziPrikazKalendara();
      this.toastService.show(`Ispiti prekopirani na ${ciljniDatum}! Možete kliknuti na sledeći datum.`, 'success');
      setTimeout(() => this.detectConflicts(), 150);
      return;
    }

    // SLUČAJ 2: Preslikavanje sekvence dana u novi raspon (OSTAVLJA AKTIVNO ZA VIŠE RASPONA)
    const [yRef, mRef, dRef] = sortiraniDani[0].split('-').map(Number);
    const refDate = new Date(yRef, mRef - 1, dRef);

    const [yCilj, mCilj, dCilj] = ciljniDatum.split('-').map(Number);
    const ciljDate = new Date(yCilj, mCilj - 1, dCilj);

    // Ako je kliknut sam početni dan raspona, ignorišemo
    if (ciljniDatum === sortiraniDani[0]) return;

    const razlikaDanaMs = ciljDate.getTime() - refDate.getTime();
    this.hasUnsavedChanges = true;
    let ukupnoKopirano = 0;

    sortiraniDani.forEach(danStr => {
      const [y, m, d] = danStr.split('-').map(Number);
      const stariDatum = new Date(y, m - 1, d);
      const noviDatumObj = new Date(stariDatum.getTime() + razlikaDanaMs);
      const noviDanStr = noviDatumObj.getFullYear() + '-' +
        String(noviDatumObj.getMonth() + 1).padStart(2, '0') + '-' +
        String(noviDatumObj.getDate()).padStart(2, '0');

      const ispitiIzDana = this.allLoadedEvents.filter(e => e.start.startsWith(danStr) && !e.extendedProps?.isNastava);

      ispitiIzDana.forEach(stari => {
        const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const noviStart = stari.start.replace(danStr, noviDanStr);
        const noviEnd = stari.end ? stari.end.replace(danStr, noviDanStr) : undefined;

        this.allLoadedEvents.push({ ...stari, id: tempId, start: noviStart, end: noviEnd });
        this.unsavedEvents.push({
          tempId: tempId,
          predmet_id: stari.extendedProps.predmetId,
          title: stari.title.split(' (')[0],
          datum: noviDanStr,
          vreme: stari.extendedProps.vreme,
          vreme_kraja: stari.extendedProps.vremeKraja,
          sala: stari.extendedProps.sala,
          is_ispit: stari.extendedProps.is_ispit,
          dezurni_ids: stari.extendedProps.dezurni?.map((d: any) => d.id) || []
        });
        ukupnoKopirano++;
      });
    });

    // Zadržavamo kopiranjeAktivno = true i čuvamo originalni izbor tako da možeš kliknuti novi početni datum
    this.osveziPrikazKalendara();
    this.toastService.show(`Preslikano ${ukupnoKopirano} termina počev od ${ciljniDatum}! Možete kliknuti na još neki raspon.`, 'success');
    setTimeout(() => this.detectConflicts(), 150);
  }

  otvoriObrisiModal(): void {
    if (this.selektovaniDani.size === 0) return;
    this.prikaziObrisiModal = true;
  }

  potvrdiBrisanjeDana(): void {
    const daniNiz = Array.from(this.selektovaniDani);
    if (daniNiz.length === 0) {
      this.prikaziObrisiModal = false;
      return;
    }

    const ispitiZaBrisanje = this.allLoadedEvents.filter(e =>
      !e.extendedProps?.isNastava && daniNiz.some(d => e.start.startsWith(d))
    );

    ispitiZaBrisanje.forEach(stariEvent => {
      if (!stariEvent.id.startsWith('temp_')) {
        const idNum = Number(stariEvent.id);
        if (!this.obrisaniIspitiServerIds.includes(idNum)) {
          this.obrisaniIspitiServerIds.push(idNum);
        }
      }
    });

    const idsToRemove = new Set(ispitiZaBrisanje.map(e => e.id));
    this.allLoadedEvents = this.allLoadedEvents.filter(e => !idsToRemove.has(e.id));
    this.unsavedEvents = this.unsavedEvents.filter(e => !idsToRemove.has(e.tempId));
    this.modifiedEvents = this.modifiedEvents.filter(e => !idsToRemove.has(e.id));

    this.hasUnsavedChanges = true;
    this.selektovaniDani.clear();
    this.kopiranjeAktivno = false;
    this.rezimUredjivanjaDana = false;
    this.prikaziObrisiModal = false;

    this.osveziPrikazKalendara();
    this.toastService.show(`Uspešno obrisani ispiti za ${daniNiz.length} dana. Kliknite 'Sačuvaj' da trajno potvrdite izmene.`, 'success');
    setTimeout(() => this.detectConflicts(), 150);
  }

  osveziPrikazKalendara(): void {
    this.applyFilters();
    if (this.calendarComponent && this.calendarComponent.getApi()) {
      this.calendarComponent.getApi().render();
    }
    this.cdr.detectChanges();
  }

  // ============================================
  // ČUVANJE I SINHRONIZACIJA SA SERVEROM
  // ============================================

  saveDraftSchedule(): void {
    const imaNovih = this.unsavedEvents && this.unsavedEvents.length > 0;
    const imaIzmenjenih = this.modifiedEvents && this.modifiedEvents.length > 0;
    const imaObrisanih = this.obrisaniIspitiServerIds && this.obrisaniIspitiServerIds.length > 0;

    console.group('🚀 [KLIKNUTO SAČUVAJ] Slanje rasporeda na server');
    console.log('📊 Stanje izmena:', { imaNovih, imaIzmenjenih, imaObrisanih });

    if (!imaNovih && !imaIzmenjenih && !imaObrisanih) {
      console.log('⚠️ Nema detektovanih izmena za bazu.');
      console.groupEnd();
      this.toastService.show('Nema izmena za čuvanje.', 'success');
      return;
    }

    const validniIzmenjeni = (this.modifiedEvents || []).filter(e => e.id && !String(e.id).startsWith('temp_'));

    console.log('📤 NOVI ISPITI (POST /ispit/bulk):', JSON.stringify(this.unsavedEvents, null, 2));
    console.log('📤 IZMENJENI ISPITI (PUT /ispit/:id):', JSON.stringify(validniIzmenjeni, null, 2));
    console.log('📤 OBRISANI ID-jevi (DELETE /ispit/:id):', this.obrisaniIspitiServerIds);

    // Server prvo proveri celu seriju izmena (ništa ne čuva); konflikte prikazujemo u čitljivom prozoru
    this.proveraUToku = true;
    this.http.post<any>(this.API_URL + '/ispit/proveri-konflikte', {
      novi: this.unsavedEvents || [],
      izmenjeni: validniIzmenjeni,
      obrisani: this.obrisaniIspitiServerIds || []
    }).subscribe({
      next: (r) => {
        this.proveraUToku = false;
        if (r?.konflikti?.length) {
          console.groupEnd();
          this.konfliktiPriCuvanju = r.konflikti;
          this.prikaziKonfliktePriCuvanju = true;
          this.cdr.detectChanges();
        } else {
          this.posaljiRaspored(validniIzmenjeni);
        }
      },
      error: () => {
        // ako provera ne uspe, čuvanje se ipak nastavlja (server svejedno vodi računa o ispravnosti podataka)
        this.proveraUToku = false;
        this.posaljiRaspored(validniIzmenjeni);
      }
    });
  }

  potvrdiCuvanjeSaKonfliktima(): void {
    this.prikaziKonfliktePriCuvanju = false;
    const validniIzmenjeni = (this.modifiedEvents || []).filter(e => e.id && !String(e.id).startsWith('temp_'));
    this.posaljiRaspored(validniIzmenjeni);
  }

  private posaljiRaspored(validniIzmenjeni: any[]): void {
    const imaNovih = this.unsavedEvents && this.unsavedEvents.length > 0;
    const imaObrisanih = this.obrisaniIspitiServerIds && this.obrisaniIspitiServerIds.length > 0;
    const requests: any[] = [];

    if (imaObrisanih) {
      this.obrisaniIspitiServerIds.forEach(id => {
        requests.push(this.http.delete(this.API_URL + '/ispit/' + id));
      });
    }

    if (imaNovih) {
      requests.push(this.http.post(this.API_URL + '/ispit/bulk?force=1', this.unsavedEvents));
    }

    if (validniIzmenjeni.length > 0) {
      validniIzmenjeni.forEach(evt => {
        const url = this.API_URL + '/ispit/' + evt.id + '?force=1';
        console.log('➡️️ Šaljem PUT na ' + url + ' sa payloadom:', evt);
        requests.push(this.http.put(url, evt));
      });
    }

    forkJoin(requests).subscribe({
      next: (odgovori) => {
        console.log('✅ SERVER JE ODGOVORIO SA USPEHOM:', odgovori);
        console.groupEnd();

        this.toastService.show('Raspored je uspešno sačuvan!', 'success');
        this.unsavedEvents = [];
        this.modifiedEvents = [];
        this.obrisaniIspitiServerIds = [];
        this.hasUnsavedChanges = false;
        this.fetchIspiti(); // Ponovno čitanje iz baze
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ GREŠKA OD STRANE SERVERA PRI ČUVANJU:', err);
        console.log('🔍 Status kod:', err.status);
        console.log('🔍 Detalji tela greške:', err.error);
        console.groupEnd();
        this.toastService.show(err.error?.error || err.error?.message || 'Došlo je do greške pri čuvanju.', 'error');
      }
    });
  }

  objaviRaspored(): void {
    if (confirm('Da li ste sigurni da želite da objavite raspored? Svi saradnici će od ovog trenutka moći da vide svoja zaduženja na portalu.')) {
      this.http.put(`${this.API_URL}/ispit/publish-all`, {}).subscribe({
        next: () => this.toastService.show('Raspored je uspešno objavljen!', 'success'),
        error: (err) => {
          console.error('Greška:', err);
          this.toastService.show('Došlo je do greške pri objavljivanju.', 'error');
        }
      });
    }
  }

  sinhronizujIMI(): void {
    this.toastService.show('Započinjem sinhronizaciju sa IMI serverom, molimo sačekajte...', 'success');
    this.http.post(`${this.API_URL}/admin/sync-imi`, {}).subscribe({
      next: (res: any) => this.toastService.show(res.poruka || 'Sinhronizacija uspešna!', 'success'),
      error: (err) => {
        console.error('Greška:', err);
        this.toastService.show('Došlo je do greške pri sinhronizaciji.', 'error');
      }
    });
  }

  // ============================================
  // UČITAVANJE PODATAKA I FILTRIRANJE
  // ============================================

  ngOnInit(): void {
    this.fetchPredmeti();
    this.fetchIspiti();
    this.fetchSviSaradniciIObaveze();
    this.loadAllUcioniceForFilter();
    this.fetchStats();
    this.loadSavedColors();
  }

  private hoverRaf = 0;

  ngAfterViewInit(): void {
    this.initDraggable();

    // Dohvatamo root element kalendara preko getApi().el ili selektora
    setTimeout(() => {
      const calEl = this.calendarComponent?.getApi()?.el || document.querySelector('full-calendar');
      if (calEl) {
        calEl.addEventListener('mouseover', (e: Event) => {
          if (!this.rezimBiranjaOpsegaIzvoza || !this.exportStartPickedDate) return;
          const cell = (e.target as HTMLElement).closest('.fc-daygrid-day') as HTMLElement;
          if (cell) {
            const dateStr = cell.getAttribute('data-date');
            if (dateStr && dateStr !== this.exportHoveredDate) {
              this.exportHoveredDate = dateStr;
              if (!this.hoverRaf) {
                this.hoverRaf = requestAnimationFrame(() => {
                  this.hoverRaf = 0;
                  this.calendarComponent.getApi().render();
                });
              }
            }
          }
        });
      }
    }, 100);
  }

  trackById(index: number, item: any): any {
    return item?.id ?? index;
  }

  get jedinstveniProfesori() {
    const map = new Map<string, any>();
    this.predmeti.forEach(p => {
      if (p.profesor && p.profesor.id !== undefined) {
        map.set(String(p.profesor.id), p.profesor);
      }
    });
    return Array.from(map.values());
  }

  get filtriraniPredmeti() {
    let filtrirano = this.predmeti;
    if (this.izabraneGodine.length > 0) {
      filtrirano = filtrirano.filter(p => this.izabraneGodine.includes(Number(p.godina)));
    }
    if (this.filterLevoProfesor !== 'svi') {
      filtrirano = filtrirano.filter(p => String(p.profesor_id) === String(this.filterLevoProfesor));
    }
    if (this.searchPredmet) {
      const q = presloviULatinicu(this.searchPredmet);
      filtrirano = filtrirano.filter(p => {
        const nazivLat = presloviULatinicu(p.naziv);
        const profLat = presloviULatinicu(p.profesorImePrezime || '');
        const sifraLat = presloviULatinicu(p.sifra || '');
        return nazivLat.includes(q) || profLat.includes(q) || sifraLat.includes(q);
      });
    }
    return filtrirano.slice(0, this.prikazaniBrojPredmeta);
  }

  toggleSveGodine(): void {
    this.izabraneGodine = [];
  }
  formatirajDatumPrikaz(datumStr: string): string {
    if (!datumStr) return '';
    const [y, m, d] = datumStr.split('-');
    return `\({d}.\){m}.${y}.`;
  }
  toggleGodina(godina: number): void {
    const index = this.izabraneGodine.indexOf(godina);
    if (index > -1) {
      this.izabraneGodine.splice(index, 1);
    } else {
      this.izabraneGodine.push(godina);
    }
  }

  vidiVisePredmeta(): void {
    this.prikazaniBrojPredmeta += 10;
  }

  applyFilters(): void {
    let filtered = [...this.allLoadedEvents];

    filtered = filtered.filter(e => {
      if (e.extendedProps?.isNastava) return true;
      const isIspit = e.extendedProps?.is_ispit ?? true;
      if (isIspit && !this.prikaziIspite) return false;
      if (!isIspit && !this.prikaziKolokvijume) return false;
      return true;
    });

    this.daniSaIspitima.clear();
    filtered.forEach(e => {
      if (e.start && !e.extendedProps?.isNastava) {
        const dStr = e.start.split('T')[0];
        this.daniSaIspitima.add(dStr);
      }
    });

    if (this.filterGodina !== 'sve') {
      const godNum = Number(this.filterGodina);
      filtered = filtered.filter(e => Number(e.extendedProps?.godina) === godNum);
    }

    if (this.filterSala !== 'sve') {
      filtered = filtered.filter(e => {
        const eventSala = e.extendedProps?.sala;
        const salaVal = typeof eventSala === 'object' ? eventSala?.naziv : eventSala;
        const selectedSalaVal = typeof this.filterSala === 'object' ? (this.filterSala as any)?.naziv : this.filterSala;
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

    const backgroundEvents: any[] = [];
    if (this.filterSaradnici && this.filterSaradnici.length > 0) {
      this.filterSaradnici.forEach(saradnikId => {
        const saradnik = this.sviSaradnici.find(s => s.id === saradnikId);
        const imePrezime = saradnik ? `${saradnik.ime} ${saradnik.prezime}` : 'Saradnik';

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
                start: start, end: end, display: 'background', backgroundColor: 'rgba(239, 68, 68, 0.25)',
                title: `${imePrezime} - Odsustvo: ${obs.tip_obaveze || 'Nedostupan/na'}`
              });
            }
          }
        });

        this.allLoadedEvents.forEach(ispit => {
          const dezurni = ispit.extendedProps['dezurni'] || [];
          if (dezurni.some((d: any) => d.id === saradnikId)) {
            backgroundEvents.push({
              start: ispit.start, end: ispit.end, display: 'background', backgroundColor: 'rgba(100, 116, 139, 0.25)',
              title: `${imePrezime} - Dežura na: ${ispit.title.split(' (')[0]}`
            });
          }
        });
      });
    }

    this.calendarOptions.events = [...filtered, ...backgroundEvents];

    this.cdr.detectChanges();
  }

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

  fetchSviSaradniciIObaveze(): void {
    forkJoin({
      saradnici: this.cache.get<any[]>('/profesors'),
      obaveze: this.cache.get<any[]>('/obaveze')
    }).subscribe({
      next: ({ saradnici, obaveze }) => {
        this.sviSaradnici = saradnici;
        this.sveObaveze = obaveze;
      }
    });
  }

  getGodinaColor(godina?: number | string): string {
    if (!godina) return '#009bd9';
    return this.godinaColors[Number(godina)] || '#009bd9';
  }

  fetchPredmeti(): void {
    this.http.get<Predmet[]>(`${this.API_URL}/predmet`).subscribe({
      next: (data) => {
        this.predmeti = data.map(p => ({
          ...p,
          profesorImePrezime: p.profesor ? `Prof. ${p.profesor.ime} ${p.profesor.prezime}` : `Šifra: ${p.sifra}`
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
      ispiti: this.http.get(this.API_URL + '/ispit'),
      redovnaNastava: this.http.get(this.API_URL + '/ispit/zauzeti-termini')
    }).subscribe({
      next: (podaci) => {
        // Ako backend vrati { data: [...] } ili { ispiti: [...] }, izvlači niz; ako je već niz, ostavlja ga
        const siroviIspiti: any = podaci.ispiti;
        const ispitiNiz: any[] = Array.isArray(siroviIspiti)
          ? siroviIspiti
          : (siroviIspiti?.data || siroviIspiti?.ispiti || siroviIspiti?.result || []);

        const redovnaNastava = podaci.redovnaNastava;

        const ispitEvents = ispitiNiz.map(i => {
          const pronadjeniPredmet = this.predmeti.find(p => p.id === (i.predmet_id || i.predmet?.id));
          const godina = i.predmet?.godina || pronadjeniPredmet?.godina || i.godina || 1;
          const boja = this.getGodinaColor(godina);

          const isIspit = i.is_ispit ?? true;
          const salaNaziv = i.sala?.naziv || i.sala || 'Bez sale';

          // 1. ČIŠĆENJE DATUMA KOJI STIGNE IZ BAZE
          // 1. ČIŠĆENJE DATUMA
          const cistDatum = (i.datum && String(i.datum).includes('T'))
            ? String(i.datum).split('T')[0]
            : String(i.datum);

          // 2. ČIŠĆENJE VREMENA POČETKA
          let formatiranoVreme = '09:00';
          if (i.vreme) {
            const s = String(i.vreme);
            formatiranoVreme = s.includes('T') ? s.substring(11, 16) : s.substring(0, 5);
          }
          if (!formatiranoVreme || formatiranoVreme === '00:00') {
            formatiranoVreme = '09:00';
          }

          // 3. ČIŠĆENJE VREMENA KRAJA (Rad sa stringom koji šalje JSON sa servera)
          let formatiranoVremeKraja = '';
          const rawKraj = i.vreme_kraja || i.vremeKraja;
          if (rawKraj) {
            const s = String(rawKraj);
            formatiranoVremeKraja = s.includes('T') ? s.substring(11, 16) : s.substring(0, 5);
          }
          if (formatiranoVremeKraja === '00:00') {
            formatiranoVremeKraja = '';
          }

          const nazivPredmeta = i.predmet?.naziv || pronadjeniPredmet?.naziv || 'Ispit';

          return {
            id: String(i.id),
            title: nazivPredmeta + ' (' + salaNaziv + ')',
            start: cistDatum + 'T' + formatiranoVreme + ':00',
            end: formatiranoVremeKraja ? (cistDatum + 'T' + formatiranoVremeKraja + ':00') : undefined,
            display: 'block',
            backgroundColor: isIspit ? boja : '#ffffff',
            textColor: isIspit ? '#ffffff' : boja,
            borderColor: boja,
            extendedProps: {
              vreme: formatiranoVreme,
              vreme_kraja: formatiranoVremeKraja, // SAMO JEDNO POLJE
              sala: salaNaziv,
              predmetId: i.predmet_id || i.predmet?.id,
              godina: godina,
              tip_kolokvijuma: i.tip_kolokvijuma || 'I',
              is_ispit: isIspit,
              dezurni: i.dezurstva ? i.dezurstva.map((d: any) => d.saradnik) : []
            }
          };
        });
        // ostatak metode ostaje isti...

        const nastavaEvents: any[] = [];
        if (Array.isArray(redovnaNastava)) {
          redovnaNastava.forEach(cas => {
            const dStr = cas.datum ? cas.datum.split('T')[0] : null;
            if (!dStr) return;
            nastavaEvents.push({
              id: 'nastava_' + cas.id,
              title: 'Nastava: ' + cas.predmet + ' (' + (cas.sala?.naziv || 'Sala') + ')',
              start: dStr + 'T' + cas.vreme_pocetka + ':00',
              end: dStr + 'T' + cas.vreme_kraja + ':00',
              display: 'block',
              backgroundColor: '#f3f4f6',
              borderColor: '#ef4444',
              textColor: '#1f2937',
              editable: false,
              extendedProps: { vreme: cas.vreme_pocetka, vremeKraja: cas.vreme_kraja, sala: cas.sala?.naziv, isNastava: true }
            });
          });
        }

        const sviDogadjaji = [...ispitEvents, ...nastavaEvents];
        this.allLoadedEvents = sviDogadjaji;
        this.calendarOptions.events = sviDogadjaji;

        this.applyFilters();
        setTimeout(() => this.detectConflicts(), 200);
      },
      error: (err) => console.error('Greška pri dohvatanju ispita i nastave:', err)
    });
  }

  loadAllUcioniceForFilter(): void {
    this.cache.get<any[]>('/ucionice', 300_000).subscribe({
      next: (res) => this.dostupneSale = res,
      error: (err) => console.error('Greška pri dohvatanju svih učionica:', err)
    });
  }

  private initDraggable(): void {
    const self = this;
    if (this.draggableContainer && this.draggableContainer.nativeElement) {
      if (this.draggableInstance) {
        this.draggableInstance.destroy();
      }
      this.draggableInstance = new Draggable(this.draggableContainer.nativeElement, {
        itemSelector: '.bank-card-item',
        eventData: function (eventEl) {
          const godina = parseInt(eventEl.getAttribute('data-godina') || '1', 10);
          const boja = self.getGodinaColor(godina);
          const id = eventEl.getAttribute('data-id');
          return {
            title: eventEl.querySelector('h3')?.innerText || 'Nepoznat predmet',
            backgroundColor: boja,
            borderColor: boja,
            extendedProps: { predmetId: id }
          };
        }
      });
    }
  }

  // ============================================
  // DETEKCIJA KONFLIKATA
  // ============================================

  otvoriListuKonflikata(): void {
    if (this.stats.konflikti === 0) return;
    this.listaSvihKonflikata = [];
    if (this.conflictsByDateMap) {
      this.conflictsByDateMap.forEach((razlozi: string[], datum: string) => {
        this.listaSvihKonflikata.push({ datum, razlozi });
      });
    }
    this.prikaziKonfliktiModal = true;
  }

  // Poziva se sa ~10 mesta (često više puta za jednu akciju) - skupljamo ih u jedno izvršavanje
  private conflictTimer: any = null;
  detectConflicts(): void {
    clearTimeout(this.conflictTimer);
    this.conflictTimer = setTimeout(() => this.runDetectConflicts(), 80);
  }

  private runDetectConflicts(): void {
    if (!this.calendarComponent) return;

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
              const n1 = String(e1.title).split(' (')[0];
              const n2 = String(e2.title).split(' (')[0];
              razlozi.push(`Sala ${s1}: „${n1}“ (${e1.extendedProps['vreme']}–${e1.extendedProps['vremeKraja'] || '?'}) i „${n2}“ (${e2.extendedProps['vreme']}–${e2.extendedProps['vremeKraja'] || '?'}) se preklapaju.`);
            }
            const dezurni1: any[] = e1.extendedProps['dezurni'] || [];
            const dezurni2: any[] = e2.extendedProps['dezurni'] || [];
            dezurni1.forEach(d1 => {
              if (dezurni2.some(d2 => d2.id === d1.id)) {
                const m1 = String(e1.title).split(' (')[0];
                const m2 = String(e2.title).split(' (')[0];
                razlozi.push(`Saradnik ${d1.ime} ${d1.prezime} je istovremeno dežuran na „${m1}“ (${e1.extendedProps['vreme']}) i „${m2}“ (${e2.extendedProps['vreme']}).`);
              }
            });
          }
        }
      }
      if (razlozi.length > 0) conflictsByDate.set(date, [...new Set(razlozi)]);
    }

    document.querySelectorAll('.fc-daygrid-day').forEach((cell: any) => {
      const date = cell.getAttribute('data-date');
      cell.classList.remove('has-conflict');

      const oldWarning = cell.querySelector('.conflict-warning');
      if (oldWarning) oldWarning.remove();

      if (date && conflictsByDate.has(date)) {
        cell.classList.add('has-conflict');
        const actionsWrapper = cell.querySelector('.day-actions-wrapper');

        if (actionsWrapper) {
          const warning = document.createElement('div');
          warning.className = 'conflict-warning';
          warning.style.cssText = 'display:inline-flex; align-items:center; cursor:pointer; z-index:50; flex-shrink:0;';
          const stavke = conflictsByDate.get(date)!
            .map((r) => `<li style="margin:0 0 8px 0;">${r}</li>`)
            .join('');
          const naslovDatuma = this.formatDatumKonflikta(date);
          warning.innerHTML = `
            <div style="position: relative; display: inline-flex; align-items: center;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" style="width: 18px; height: 18px; filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.15));">
                <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
              </svg>
              <div class="custom-conflict-tooltip" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 14px; width: min(440px, 92vw); max-height: 70vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 9999px rgba(0, 0, 0, 0.18); z-index: 999999; pointer-events: none; text-align: left; font-family: Montserrat, sans-serif;">
                <div style="background:#1F63A0; color:#fff; padding:12px 18px; font-weight:800; font-size:14px; border-radius:14px 14px 0 0;">
                  ⚠ Konflikti – ${naslovDatuma}
                </div>
                <ul style="margin:0; padding:14px 18px 8px 34px; font-size:13px; font-weight:500; line-height:1.55; list-style:disc;">${stavke}</ul>
              </div>
            </div>`;

          warning.addEventListener('click', (e) => {
            e.stopPropagation();
            const tooltip = warning.querySelector('.custom-conflict-tooltip') as HTMLElement;
            const isCurrentlyVisible = tooltip.style.display === 'block';
            document.querySelectorAll('.custom-conflict-tooltip').forEach((el: any) => {
              el.style.setProperty('display', 'none', 'important');
            });
            if (!isCurrentlyVisible) tooltip.style.setProperty('display', 'block', 'important');
          });

          actionsWrapper.appendChild(warning);
        }
      }
    });

    let ukupanBrojKonflikata = 0;
    for (const razlozi of conflictsByDate.values()) ukupanBrojKonflikata += razlozi.length;
    this.stats.konflikti = ukupanBrojKonflikata;
    this.conflictsByDateMap = conflictsByDate;
  }

  // "2026-04-15" -> "sreda, 15.04.2026."
  formatDatumKonflikta(datum: string): string {
    const d = new Date(`${datum}T12:00:00`);
    if (isNaN(d.getTime())) return datum;
    const dani = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dani[d.getDay()]}, ${dd}.${mm}.${d.getFullYear()}.`;
  }

  // Vrsta konflikta za bojenje u prozoru
  tipKonflikta(tekst: string): 'sala' | 'dezurni' | 'odsustvo' {
    if (/^Sala\b/.test(tekst)) return 'sala';
    if (/odsutan/.test(tekst)) return 'odsustvo';
    return 'dezurni';
  }

  private timeToMins(timeStr: string): number {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
  }

  // ============================================
  // IZVOZ U EXCEL I ŠTAMPA
  // ============================================

  otvoriIzvozModal(savedState?: ExportDataResult): void {
    const dialogRef = this.dialog.open(ExportModalComponent, {
      maxWidth: '95vw',
      width: '920px',
      maxHeight: '92vh',
      panelClass: 'custom-export-dialog-panel',
      data: savedState || null,
      disableClose: true
    });

    dialogRef.afterClosed().subscribe((rezultat: ExportDataResult & { action?: string; pickingTarget?: any }) => {
      if (!rezultat) return;

      if (rezultat.action === 'pick_range') {
        // Sakrivamo modal i ulazimo u mod biranja na kalendaru
        this.tempExportData = rezultat;
        this.tempPickingTarget = rezultat.pickingTarget;
        this.rezimBiranjaOpsegaIzvoza = true;
        this.exportStartPickedDate = null;
        this.selektovaniDani.clear();

        this.toastService.show('Kliknite prvi datum opsega na kalendaru.', 'success');
        this.osveziPrikazKalendara();
        return;
      }

      if (rezultat.action === 'export' || !rezultat.action) {
        if (rezultat.tip === 'kolokvijumi') {
          this.generisiExcelKolokvijumi(rezultat);
        } else if (rezultat.tip === 'ispiti') {
          this.generisiExcelIspiti(rezultat);
        }
      }
    });
  }

  obradiIzborDatumaZaIzvoz(kliknutiDatum: string): void {
    if (!this.exportStartPickedDate) {
      this.exportStartPickedDate = kliknutiDatum;
      this.exportHoveredDate = kliknutiDatum;
      this.calendarComponent.getApi().render();
      this.toastService.show(`Početni datum: ${kliknutiDatum}. Sada kliknite krajnji datum.`, 'success');
    } else {
      let dOd = this.exportStartPickedDate;
      let dDo = kliknutiDatum;
      if (new Date(dOd) > new Date(dDo)) {
        const temp = dOd;
        dOd = dDo;
        dDo = temp;
      }

      if (this.tempExportData) {
        if (this.tempPickingTarget === 'kolokvijumi') {
          this.tempExportData.datumOd = dOd;
          this.tempExportData.datumDo = dDo;
        } else if (typeof this.tempPickingTarget === 'number' && this.tempExportData.rokovi) {
          if (this.tempExportData.rokovi[this.tempPickingTarget]) {
            this.tempExportData.rokovi[this.tempPickingTarget].datumOd = dOd;
            this.tempExportData.rokovi[this.tempPickingTarget].datumDo = dDo;
          }
        }
      }

      this.toastService.show(`Izabran opseg: \({dOd} do\){dDo}! Vraćam tabelu...`, 'success');

      this.rezimBiranjaOpsegaIzvoza = false;
      this.exportStartPickedDate = null;
      this.exportHoveredDate = null;
      this.calendarComponent.getApi().render();

      const stateToRestore = this.tempExportData;
      this.tempExportData = null;
      this.tempPickingTarget = null;

      setTimeout(() => {
        this.otvoriIzvozModal(stateToRestore || undefined);
      }, 200);
    }
  }
  async generisiExcelIspiti(podaci: ExportDataResult): Promise<void> {
    const XLSX = await import('xlsx-js-style');
    const rokovi = podaci.rokovi || [];
    if (rokovi.length === 0) {
      this.toastService.show('Niste uneli nijedan ispitni rok!', 'error');
      return;
    }

    const tankaLinija = { style: 'thin', color: { rgb: 'FF000000' } };
    const srednjaLinija = { style: 'medium', color: { rgb: 'FF000000' } };

    const punOkvir = {
      top: tankaLinija,
      bottom: tankaLinija,
      left: tankaLinija,
      right: tankaLinija
    };

    const datumOkvir = {
      top: tankaLinija,
      bottom: tankaLinija,
      left: tankaLinija,
      right: undefined
    };

    const vremeOkvir = {
      top: tankaLinija,
      bottom: tankaLinija,
      left: undefined,
      right: tankaLinija
    };

    let bojePoGodini: { [key: number]: string };
    if (podaci.isApsolventski) {
      bojePoGodini = {
        1: 'FFB4C6E7',
        2: 'FFFCE4D6',
        3: 'FFEAE2ED',
        4: 'FFF8CBAD',
        5: 'FF00B0F0'
      };
    } else {
      bojePoGodini = {
        1: 'FF8EA9DB', // Plava I godina
        2: 'FFF4B183', // Narandžasto-breskva II godina
        3: 'FFFFD966', // Toplo žuta III godina
        4: 'FFA9D18E', // Zelena IV godina
        5: 'FF00B0F0'  // Turquoise Master
      };
    }

    const ispitiDogadjaji = this.allLoadedEvents.filter((e: any) => {
      const isIspit = e.extendedProps?.is_ispit ?? true;
      return isIspit && !e.extendedProps?.isNastava;
    });

    const godineLabele: { [key: number]: string } = {
      1: 'I година',
      2: 'II година',
      3: 'III година',
      4: 'IV година',
      5: 'Мастер'
    };

    const predmetiPoGodinama: { [godina: number]: any[] } = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    this.predmeti.forEach(predmet => {
      let g = Number(predmet.godina) || 1;
      if (g > 5) g = 5;
      if (!predmetiPoGodinama[g]) predmetiPoGodinama[g] = [];
      predmetiPoGodinama[g].push(predmet);
    });

    const formatirajSat = (vremeRaw: string): string => {
      if (!vremeRaw) return '';
      if (vremeRaw.includes('T')) vremeRaw = vremeRaw.substring(11, 16);
      const delovi = vremeRaw.split(':');
      const sati = parseInt(delovi[0], 10);
      const minuti = delovi.length > 1 ? delovi[1] : '00';
      return minuti === '00' || !minuti ? sati + 'h' : sati + '.' + minuti + 'h';
    };

    const formatirajDanMesec = (datumStr: string): string => {
      if (!datumStr) return '';
      const d = new Date(datumStr);
      const dan = String(d.getDate()).padStart(2, '0');
      const mesec = String(d.getMonth() + 1).padStart(2, '0');
      return dan + '.' + mesec + '.';
    };

    const wsData: any[][] = [];
    const cellStyles: any = {};
    const rowHeights: any[] = [];
    const merges: any[] = [];
    let rowIndex = 1;

    const ukupanBrojKolona = 2 + (rokovi.length * 2);

    // --- GLAVNI NASLOV DOKUMENTA ("ОАС и МАС Информатике") ---
    const glavniNaslov = podaci.naslovRasporeda || 'ОАС и МАС Информатике';
    const redGlavniNaslov = new Array(ukupanBrojKolona).fill('');
    redGlavniNaslov[0] = glavniNaslov;
    wsData.push(redGlavniNaslov);
    merges.push({ s: { r: rowIndex - 1, c: 0 }, e: { r: rowIndex - 1, c: ukupanBrojKolona - 1 } });
    cellStyles['A' + rowIndex] = {
      alignment: { horizontal: 'center', vertical: 'center' },
      font: { bold: true, sz: 14, name: 'Calibri' }
    };
    rowHeights.push({ hpt: 28 });
    rowIndex++;

    // Prazan red pre prve tabele
    wsData.push(new Array(ukupanBrojKolona).fill(''));
    rowHeights.push({ hpt: 12 });
    rowIndex++;

    [1, 2, 3, 4, 5].forEach(godina => {
      const predmetiUGodini = predmetiPoGodinama[godina] || [];
      if (predmetiUGodini.length === 0) return;

      // 1. NASLOV GODINE: Calibri 14pt Bold, Centered (sa tvoje slike 1)
      const redGodina = new Array(ukupanBrojKolona).fill('');
      redGodina[0] = godineLabele[godina];
      wsData.push(redGodina);

      merges.push({ s: { r: rowIndex - 1, c: 0 }, e: { r: rowIndex - 1, c: ukupanBrojKolona - 1 } });

      for (let c = 0; c < ukupanBrojKolona; c++) {
        const colLetter = String.fromCharCode(65 + c);
        cellStyles[colLetter + rowIndex] = {
          alignment: { horizontal: 'center', vertical: 'center' },
          font: { bold: true, sz: 14, name: 'Calibri' },
          border: punOkvir
        };
      }
      rowHeights.push({ hpt: 26 });
      rowIndex++;

      // 2. PODHEDER: "Предмет" (Calibri 11pt, Regular, Centrirano kao na slici 2) i Rokovi (11pt Regular)
      const hederTabela = ['', 'Предмет'];
      rokovi.forEach(rok => {
        let nazivRoka = rok.naziv || '';
        if (nazivRoka.includes(' ') && !nazivRoka.includes('\n')) {
          const parts = nazivRoka.split(' ');
          nazivRoka = parts[0] + '\n' + parts.slice(1).join(' ');
        }
        hederTabela.push(nazivRoka, '');
      });
      wsData.push(hederTabela);

      // Spajanje za svaki rok
      let colOffset = 2;
      rokovi.forEach(() => {
        merges.push({ s: { r: rowIndex - 1, c: colOffset }, e: { r: rowIndex - 1, c: colOffset + 1 } });
        colOffset += 2;
      });

      for (let c = 0; c < ukupanBrojKolona; c++) {
        const colLetter = String.fromCharCode(65 + c);
        cellStyles[colLetter + rowIndex] = {
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          font: { bold: false, sz: 11, name: 'Calibri' }, // <--- TAČNO 11pt REGULAR
          border: punOkvir
        };
      }
      rowHeights.push({ hpt: 28 });
      rowIndex++;

      // 3. PREDMETI I TERMINI
      let redniBroj = 1;

      predmetiUGodini.forEach(predmet => {
        const terminiPredmeta = ispitiDogadjaji.filter((ispit: any) => {
          const pId = ispit.extendedProps?.predmetId;
          const naslov = ispit.title.split(' (')[0].trim();
          return (pId && pId === predmet.id) || naslov.toLowerCase() === predmet.naziv.toLowerCase();
        });

        const terminiPoRokovima: { [rokIdx: number]: any[] } = {};
        rokovi.forEach((rok, idx) => {
          terminiPoRokovima[idx] = [];
          const rOd = new Date(rok.datumOd).getTime();
          const rDo = new Date(rok.datumDo).getTime();

          terminiPredmeta.forEach(t => {
            const datumTermina = new Date(t.start.split('T')[0]).getTime();
            if (datumTermina >= rOd && datumTermina <= rDo) {
              terminiPoRokovima[idx].push(t);
            }
          });
        });

        const maxTermina = Math.max(...Object.values(terminiPoRokovima).map(arr => arr.length), 1);
        const startRowIndex = rowIndex;

        for (let subRow = 0; subRow < maxTermina; subRow++) {
          const redPredmeta: any[] = [];

          redPredmeta.push(subRow === 0 ? redniBroj : '');
          redPredmeta.push(subRow === 0 ? predmet.naziv : '');

          rokovi.forEach((rok, idx) => {
            const termin = terminiPoRokovima[idx][subRow];
            if (termin) {
              redPredmeta.push(formatirajDanMesec(termin.start.split('T')[0]));
              redPredmeta.push(formatirajSat(termin.extendedProps?.vreme || ''));
            } else {
              redPredmeta.push('', '');
            }
          });

          wsData.push(redPredmeta);

          // Kolona A: Redni broj
          cellStyles['A' + rowIndex] = {
            alignment: { horizontal: 'right', vertical: 'center' },
            font: { name: 'Calibri', sz: 11 },
            border: punOkvir
          };

          // Kolona B: Predmet
          cellStyles['B' + rowIndex] = {
            alignment: { horizontal: 'left', vertical: 'center' },
            font: { name: 'Calibri', sz: 11 },
            fill: { fgColor: { rgb: bojePoGodini[godina] || 'FFFFFFFF' } },
            border: punOkvir
          };

          // Kolone po rokovima (bez unutrašnjeg vertikalnog bordera)
          let cIdx = 2;
          rokovi.forEach(() => {
            const colDatum = String.fromCharCode(65 + cIdx);
            const colVreme = String.fromCharCode(65 + cIdx + 1);

            cellStyles[colDatum + rowIndex] = {
              alignment: { horizontal: 'center', vertical: 'center' },
              font: { name: 'Calibri', sz: 11 },
              border: datumOkvir
            };

            cellStyles[colVreme + rowIndex] = {
              alignment: { horizontal: 'center', vertical: 'center' },
              font: { name: 'Calibri', sz: 11 },
              border: vremeOkvir
            };

            cIdx += 2;
          });

          rowHeights.push({ hpt: 15 });
          rowIndex++;
        }

        if (maxTermina > 1) {
          merges.push({ s: { r: startRowIndex - 1, c: 0 }, e: { r: rowIndex - 2, c: 0 } });
          merges.push({ s: { r: startRowIndex - 1, c: 1 }, e: { r: rowIndex - 2, c: 1 } });
        }

        redniBroj++;
      });

      // Prazan red između tabela
      wsData.push(new Array(ukupanBrojKolona).fill(''));
      rowHeights.push({ hpt: 15 });
      rowIndex++;
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = merges;
    ws['!rows'] = rowHeights;

    for (const key in cellStyles) {
      if (ws[key]) ws[key].s = cellStyles[key];
    }

    const cols = [
      { wch: 3.5 },
      { wch: 44 }
    ];
    rokovi.forEach(() => {
      cols.push({ wch: 7.5 });
      cols.push({ wch: 5.5 });
    });
    ws['!cols'] = cols;

    const wb = XLSX.utils.book_new();
    const sheetIme = podaci.isApsolventski ? 'Apsolventski' : 'Jun-Septembar';
    XLSX.utils.book_append_sheet(wb, ws, sheetIme);

    let imeFajla = (podaci.naslovRasporeda || (podaci.isApsolventski ? 'Apsolventski_rok' : 'Raspored_ispita_Jun_Septembar'))
      .replace(/[\r\n]+/g, ' ')
      .replace(/[\\/:*?"<>|]/g, '')
      .trim();

    XLSX.writeFile(wb, (imeFajla || 'Raspored_ispita') + '.xlsx');
    this.toastService.show('Excel tabela ispita je uspešno generisana!', 'success');
  }

  async generisiExcelKolokvijumi(podaci: ExportDataResult): Promise<void> {
    const XLSX = await import('xlsx-js-style');

    if (!podaci.datumOd || !podaci.datumDo) {
      this.toastService.show('Izaberite oba datuma!', 'error');
      return;
    }
    const tip = podaci.tip;
    const dOd = new Date(podaci.datumOd).getTime();
    const dDo = new Date(podaci.datumDo).getTime();

    const ispitiUPeriodu = this.allLoadedEvents.filter((e: any) => {
      const isIspitEvent = e.extendedProps?.is_ispit ?? true;
      if (podaci.tip === 'ispiti' && !isIspitEvent) return false;
      if (podaci.tip === 'kolokvijumi' && isIspitEvent) return false;
      if (e.extendedProps?.isNastava) return false;

      const evtStartStr = e.start.split('T')[0];
      const evtDatumMs = new Date(evtStartStr).getTime();
      return evtDatumMs >= dOd && evtDatumMs <= dDo;
    });

    if (ispitiUPeriodu.length === 0) {
      this.toastService.show('Nema zakazanih termina u izabranom periodu.', 'error');
      return;
    }

    const sedmice = new Map();

    const bojaPoGodini: { [key: number]: string } = {
      1: 'FFDDEBF7', // Blue, Accent 5, Lighter 80%[cite: 27]
      2: 'FFFCE4D6', // Orange, Accent 2, Lighter 80%[cite: 26]
      3: 'FFFFF2CC', // Gold, Accent 4, Lighter 80%[cite: 28]
      4: 'FFE2EFDA', // Green, Accent 6, Lighter 80%[cite: 24]
      5: 'FFDDEBF7'  // Master
    };

    const tankiOkvir = {
      top: { style: 'thin', color: { rgb: 'FF000000' } },
      bottom: { style: 'thin', color: { rgb: 'FF000000' } },
      left: { style: 'thin', color: { rgb: 'FF000000' } },
      right: { style: 'thin', color: { rgb: 'FF000000' } }
    };

    ispitiUPeriodu.forEach((ispit: any) => {
      const d = new Date(ispit.start.split('T')[0]);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const ponedeljak = new Date(d.setDate(diff));
      const ponedeljakStr = ponedeljak.toISOString().split('T')[0];

      if (!sedmice.has(ponedeljakStr)) {
        const datumi: Date[] = [];
        for (let i = 0; i < 7; i++) {
          const tekuci = new Date(ponedeljak);
          tekuci.setDate(ponedeljak.getDate() + i);
          datumi.push(tekuci);
        }
        sedmice.set(ponedeljakStr, {
          datumi: datumi,
          dogadjaji: [[], [], [], [], [], [], []]
        });
      }

      const originalDate = new Date(ispit.start.split('T')[0]);
      let danIndex = originalDate.getDay() - 1;
      if (danIndex === -1) danIndex = 6;

      const nazivPredmeta = ispit.title.split(' (')[0];
      const tipKolokvijuma = String(ispit.extendedProps.tip_kolokvijuma || 'I').trim();
      const tipLower = tipKolokvijuma.toLowerCase();

      // 1. Određivanje tipa provjere
      let tipString = '';
      if (ispit.extendedProps.is_ispit) {
        tipString = 'испит';
      } else if (tipLower === 'тест' || tipLower === 'test') {
        tipString = 'тест';
      } else if (tipLower.includes('тест') || tipLower.includes('test')) {
        tipString = 'поправни тест';
      } else if (tipLower.includes('поправни') || tipLower.includes('popravni')) {
        tipString = 'поправни колоквијум';
      } else {
        tipString = tipKolokvijuma + ' колоквијум';
      }

      // 2. Formatiranje vremena (npr. "08:00" -> "8h", "07:15" -> "7.15h", "14:00" -> "14h")
      let vremeRaw = String(ispit.extendedProps.vreme || '').trim();
      let formatiranoVreme = '';

      if (vremeRaw) {
        // Ako sadrži ISO datum "T", uzmi samo sate i minute
        if (vremeRaw.includes('T')) {
          vremeRaw = vremeRaw.substring(11, 16);
        }

        const delovi = vremeRaw.split(':');
        const sati = parseInt(delovi[0], 10); // Uklanja vodeću nulu (08 -> 8, 09 -> 9)
        const minuti = delovi.length > 1 ? delovi[1] : '00';

        if (minuti === '00' || !minuti) {
          formatiranoVreme = sati + 'h';
        } else {
          formatiranoVreme = sati + '.' + minuti + 'h';
        }
      }

      // 3. Spajanje u konačan tekst (ako nema vremena, ne ostavlja praznu crticu na kraju)
      let tekst = nazivPredmeta + '\n - ' + tipString + ' -';
      if (formatiranoVreme) {
        tekst += ' ' + formatiranoVreme;
      }
      const godina = ispit.extendedProps.godina || 1;

      sedmice.get(ponedeljakStr)!.dogadjaji[danIndex].push({
        tekst: tekst,
        boja: bojaPoGodini[godina as number] || 'FFFFFFFF'
      });
    });

    const wsData: any[][] = [];
    const cellStyles: any = {};
    const rowHeights: any[] = [];
    let rowIndex = 1;

    // Glavni naslov
    // Glavni naslov koji si sam uneo u modal
    const naslovZaPrikaz = this.izvozPodaci.naslovRasporeda || 'Распоред';
    wsData.push([naslovZaPrikaz, null, null, null, null, null, null]);
    const merges = [{ s: { r: rowIndex - 1, c: 0 }, e: { r: rowIndex - 1, c: 6 } }];
    cellStyles['A' + rowIndex] = {
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      font: { bold: true, sz: 16, name: 'Calibri' }
    };
    rowHeights.push({ hpt: 45 });
    rowIndex++;

    // Prazan red
    wsData.push([null, null, null, null, null, null, null]);
    rowHeights.push({ hpt: 15 });
    rowIndex++;

    const sortiraneNedelje = Array.from(sedmice.keys()).sort();

    sortiraneNedelje.forEach((ponedeljakStr: string) => {
      const podaci = sedmice.get(ponedeljakStr)!;

      // Red sa danima: center + center (middle)
      wsData.push(['понедељак', 'уторак', 'среда', 'четвртак', 'петак', 'субота', 'недеља']);
      const daniRowIndex = rowIndex;
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((col: string) => {
        cellStyles[col + daniRowIndex] = {
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          font: { name: 'Calibri', sz: 11, bold: false },
          border: tankiOkvir
        };
      });
      rowHeights.push({ hpt: 20 });
      rowIndex++;

      // Red sa datumima: center + center (middle)
      // Red sa datumima: 26.09.2026.
      // Red sa datumima: format 26.09.2026.
      const datumiPrikaz = podaci.datumi.map((d: Date) => {
        const y = String(d.getFullYear());
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return day + '.' + m + '.' + y + '.';
      });
      wsData.push(datumiPrikaz);
      const datumiRowIndex = rowIndex;
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((col: string) => {
        cellStyles[col + datumiRowIndex] = {
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          font: { name: 'Calibri', sz: 11, bold: false },
          border: tankiOkvir
        };
      });
      rowHeights.push({ hpt: 20 });
      rowIndex++;

      // Redovi sa ispitima: center + center (middle) i wrapText
      const maxIspitaUDanu = Math.max(...podaci.dogadjaji.map((dan: any[]) => dan.length), 1);

      for (let i = 0; i < maxIspitaUDanu; i++) {
        const redIspita: string[] = [];
        let imaSadrzaja = false;

        for (let j = 0; j < 7; j++) {
          const dogadjaj = podaci.dogadjaji[j][i];
          if (dogadjaj) {
            imaSadrzaja = true;
            redIspita.push(dogadjaj.tekst);
          } else {
            redIspita.push('');
          }
        }
        wsData.push(redIspita);

        ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((col: string, index: number) => {
          const dogadjaj = podaci.dogadjaji[index][i];
          let bgColor = 'FFFFFFFF';
          if (dogadjaj && dogadjaj.boja) {
            bgColor = dogadjaj.boja;
          }

          cellStyles[col + rowIndex] = {
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, // <--- CENTER I MIDDLE!
            font: { name: 'Calibri', sz: 11, bold: false },
            border: tankiOkvir
          };
          if (bgColor !== 'FFFFFFFF') {
            cellStyles[col + rowIndex].fill = { fgColor: { rgb: bgColor } };
          }
        });
        rowHeights.push({ hpt: imaSadrzaja ? 55 : 20 });
        rowIndex++;
      }

      // Prazan red između tjedana
      wsData.push([null, null, null, null, null, null, null]);
      rowHeights.push({ hpt: 15 });
      rowIndex++;
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!merges'] = merges;
    ws['!rows'] = rowHeights;

    for (const key in cellStyles) {
      if (ws[key]) ws[key].s = cellStyles[key];
    }

    ws['!cols'] = [
      { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 25 },
      { wch: 25 }, { wch: 25 }, { wch: 25 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Raspored');
    let cistoImeFajla = (podaci.naslovRasporeda || ('Raspored_' + tip))
      .replace(/[\r\n]+/g, ' ')
      .replace(/[\\/:*?"<>|]/g, '')
      .trim();

    if (!cistoImeFajla) {
      cistoImeFajla = 'Raspored_' + tip;
    }

    XLSX.writeFile(wb, cistoImeFajla + '.xlsx');
    this.toastService.show('Excel fajl je uspešno generisan!', 'success');
  }
  // ============================================
  // POJEDINAČNO PREUREĐIVANJE DANA (MODAL)
  // ============================================

  otvoriPreuredjivanje(): void {
    this.danModalPrikaz = 'preuredi';
    this.ispitiZaBrisanje = [];
    const ispitiIzDana = this.allLoadedEvents.filter(e => e.start.startsWith(this.selektovanDan) && !e.extendedProps?.isNastava);
    this.ispitiZaPreuredjivanje = JSON.parse(JSON.stringify(ispitiIzDana));
  }

  obrisiIspitIzDana(id: string): void {
    this.ispitiZaPreuredjivanje = this.ispitiZaPreuredjivanje.filter(i => i.id !== id);
    this.ispitiZaBrisanje.push(id);
  }

  sacuvajPreuredjivanje(): void {
    this.hasUnsavedChanges = true;

    this.ispitiZaBrisanje.forEach(id => {
      if (!id.startsWith('temp_')) {
        const idNum = Number(id);
        if (!this.obrisaniIspitiServerIds.includes(idNum)) {
          this.obrisaniIspitiServerIds.push(idNum);
        }
      }
      this.allLoadedEvents = this.allLoadedEvents.filter(e => e.id !== id);
      this.unsavedEvents = this.unsavedEvents.filter(e => e.tempId !== id);
      this.modifiedEvents = this.modifiedEvents.filter(e => e.id !== id);
    });

    this.ispitiZaPreuredjivanje.forEach(modIspit => {
      const idx = this.allLoadedEvents.findIndex(e => e.id === modIspit.id);
      if (idx > -1) {
        this.allLoadedEvents[idx].start = `${this.selektovanDan}T${modIspit.extendedProps.vreme}:00`;
        this.allLoadedEvents[idx].end = modIspit.extendedProps.vremeKraja ? `${this.selektovanDan}T${modIspit.extendedProps.vremeKraja}:00` : undefined;
        this.allLoadedEvents[idx].extendedProps.vreme = modIspit.extendedProps.vreme;
        this.allLoadedEvents[idx].extendedProps.vremeKraja = modIspit.extendedProps.vremeKraja;
        this.allLoadedEvents[idx].extendedProps.sala = modIspit.extendedProps.sala;
        this.allLoadedEvents[idx].title = `${modIspit.title.split(' (')[0]} (${modIspit.extendedProps.sala})`;
      }

      if (modIspit.id.startsWith('temp_')) {
        const uIdx = this.unsavedEvents.findIndex(e => e.tempId === modIspit.id);
        if (uIdx > -1) {
          this.unsavedEvents[uIdx].vreme = modIspit.extendedProps.vreme;
          this.unsavedEvents[uIdx].vreme_kraja = modIspit.extendedProps.vremeKraja;
          this.unsavedEvents[uIdx].sala = modIspit.extendedProps.sala;
        }
      } else {
        const mIdx = this.modifiedEvents.findIndex(e => e.id === modIspit.id);

        const payload = {
          id: modIspit.id, datum: this.selektovanDan, vreme: modIspit.extendedProps.vreme,
          vreme_kraja: modIspit.extendedProps.vremeKraja, sala: modIspit.extendedProps.sala,
          predmet_id: modIspit.extendedProps.predmetId, is_ispit: modIspit.extendedProps.is_ispit,
          dezurni_ids: modIspit.extendedProps.dezurni?.map((d: any) => d.id) || []
        };
        if (mIdx > -1) this.modifiedEvents[mIdx] = payload; else this.modifiedEvents.push(payload);
      }
    });

    this.applyFilters();
    this.prikaziDanModal = false;
    this.toastService.show('Izmene u danu su evidentirane. Sačuvajte raspored.', 'success');
    setTimeout(() => this.detectConflicts(), 150);
  }

  obrisiCeoDan(): void {
    if (confirm(`Da li ste sigurni da želite da obrišete SVE ispite na dan ${this.selektovanDan}?`)) {
      const ispitiIzDana = this.allLoadedEvents.filter(e => e.start.startsWith(this.selektovanDan) && !e.extendedProps?.isNastava);
      ispitiIzDana.forEach(stariEvent => {
        if (!stariEvent.id.startsWith('temp_')) {
          const idNum = Number(stariEvent.id);
          if (!this.obrisaniIspitiServerIds.includes(idNum)) {
            this.obrisaniIspitiServerIds.push(idNum);
          }
        }
      });
      const idsToRemove = ispitiIzDana.map(e => e.id);
      this.allLoadedEvents = this.allLoadedEvents.filter(e => !idsToRemove.includes(e.id));
      this.unsavedEvents = this.unsavedEvents.filter(e => !idsToRemove.includes(e.tempId));
      this.modifiedEvents = this.modifiedEvents.filter(e => !idsToRemove.includes(e.id));

      this.hasUnsavedChanges = true;
      this.applyFilters();
      this.prikaziDanModal = false;
      this.toastService.show('Svi ispiti u danu su uklonjeni.', 'success');
      setTimeout(() => this.detectConflicts(), 150);
    }
  }
}