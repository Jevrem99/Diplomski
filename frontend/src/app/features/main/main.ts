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
import { FormsModule } from '@angular/forms';
import * as XLSX from 'xlsx-js-style';

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
  private API_URL = 'http://localhost:5000';
  private cdr = inject(ChangeDetectorRef);
  private toastService = inject(ToastService);
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
    tip: 'ispiti',
    datumOd: '',
    datumDo: '',
    nazivRoka: 'Испитни рок'
  };

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

dayCellContent: (arg) => {
      const d = arg.date;
      const dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const today = new Date();
      const isToday = d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();

      const isDark = document.body.classList.contains('dark-theme');

      let html = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:6px; box-sizing:border-box; pointer-events:auto;">`;

      if (isToday) {
        html += `
          <span style="display:inline-flex; align-items:center; justify-content:center; width:24px; height:24px; min-width:24px; border-radius:50%; background-color:#1F63A0; color:#ffffff !important; font-family:'Montserrat', sans-serif; font-size:12px; font-weight:800; line-height:1; pointer-events:none; box-shadow:0 1px 3px rgba(31,99,160,0.35);">
            ${arg.dayNumberText}
          </span>`;
      } else {
        const numColor = isDark ? '#94a3b8' : '#475569';
        html += `
          <span style="font-family:'Montserrat', sans-serif; font-size:13px; font-weight:800; color:${numColor}; pointer-events:none; padding:2px;">
            ${arg.dayNumberText}
          </span>`;
      }

      html += `<div class="day-actions-wrapper" data-date="${dateStr}" style="display:flex; align-items:center; gap:4px; pointer-events:auto;">`;

      if (this.rezimUredjivanjaDana) {
        const isSelected = this.selektovaniDani.has(dateStr);
        if (isSelected) {
          html += `
            <div class="day-select-circle" data-date="${dateStr}" style="width:20px; height:20px; border-radius:6px; background-color:#1F63A0; border:2px solid ${isDark ? '#38bdf8' : '#164f82'}; display:flex; align-items:center; justify-content:center; cursor:pointer; pointer-events:auto !important; z-index:50;">
              <svg width="12" height="12" fill="none" stroke="white" stroke-width="3.5" viewBox="0 0 24 24" style="pointer-events:none;"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
            </div>`;
        } else if (this.kopiranjeAktivno) {
          html += `
            <div class="day-select-circle" data-date="${dateStr}" style="width:20px; height:20px; border-radius:6px; border:2px dashed ${isDark ? '#38bdf8' : '#1F63A0'}; background-color:${isDark ? 'rgba(56,189,248,0.2)' : 'rgba(31,99,160,0.12)'}; cursor:pointer; pointer-events:auto !important; z-index:50;"></div>`;
        } else {
          const defaultBg = isDark ? '#0d1a44' : '#ffffff';
          const defaultBorder = isDark ? '#334155' : '#cbd5e1';
          html += `
            <div class="day-select-circle" data-date="${dateStr}" style="width:20px; height:20px; border-radius:6px; border:2px solid ${defaultBorder}; background-color:${defaultBg}; cursor:pointer; pointer-events:auto !important; z-index:50;"></div>`;
        }
      }

      html += `</div></div>`;
      return { html };
    },

    dateClick: (info) => {
      if (this.rezimUredjivanjaDana) {
        this.ngZone.run(() => {
          this.toggleSelektovanDan(info.dateStr);
          this.cdr.detectChanges();
        });
      }
    },

    eventClick: (info) => {
      if (info.event.display === 'background') return;

      const eventDate = info.event.startStr ? info.event.startStr.split('T')[0] : (info.event.start?.toISOString().split('T')[0] || '');

      const cistNaslov = info.event.title.split(' (')[0];
      const sviDogadjaji = this.calendarComponent.getApi().getEvents();

      const zauzecaNaDan = sviDogadjaji
        .filter(e => {
          const dStr = e.startStr.split('T')[0] || (e.start?.toISOString().split('T')[0] || '');
          return dStr === eventDate && e.id !== info.event.id;
        })
        .map(e => ({
          sala: e.extendedProps['sala'],
          vreme: e.extendedProps['vreme'],
          vremeKraja: e.extendedProps['vremeKraja']
        }));

      const dialogRef = this.dialog.open(EventModal, {
        maxWidth: '95vw', width: '1100px', maxHeight: '120vh',
        data: {
          title: cistNaslov, date: eventDate,
          startTime: info.event.extendedProps['vreme'], endTime: info.event.extendedProps['vremeKraja'],
          room: info.event.extendedProps['sala'], predmetId: info.event.extendedProps['predmetId'],
          is_ispit: info.event.extendedProps['is_ispit'] ?? true, dezurni: info.event.extendedProps['dezurni'] || [],
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

          if (info.event.id && info.event.id.startsWith('temp_')) {
            const draftEvt = this.unsavedEvents.find(e => e.tempId === info.event.id);
            if (draftEvt) {
              draftEvt.vreme = result.startTime; draftEvt.vreme_kraja = result.endTime;
              draftEvt.sala = result.room; draftEvt.is_ispit = isIspit; draftEvt.dezurni_ids = dezurniIds;
            }
          } else {
            const payload = {
              id: info.event.id, datum: eventDate, vreme: result.startTime, vreme_kraja: result.endTime,
              sala: result.room, predmet_id: info.event.extendedProps['predmetId'], is_ispit: isIspit, dezurni_ids: dezurniIds
            };
            const existingIndex = this.modifiedEvents.findIndex(e => e.id === info.event.id);
            if (existingIndex > -1) this.modifiedEvents[existingIndex] = payload; else this.modifiedEvents.push(payload);
          }

          const evtIndex = this.allLoadedEvents.findIndex(e => e.id === info.event.id);
          if (evtIndex > -1) {
            const boja = this.getGodinaColor(this.allLoadedEvents[evtIndex].extendedProps.godina);
            this.allLoadedEvents[evtIndex] = {
              ...this.allLoadedEvents[evtIndex],
              start: `${eventDate}T${result.startTime}:00`, end: result.endTime ? `${eventDate}T${result.endTime}:00` : undefined,
              title: `${cistNaslov} (${result.room})`,
              backgroundColor: isIspit ? boja : '#ffffff', textColor: isIspit ? '#ffffff' : boja, borderColor: boja,
              extendedProps: {
                ...this.allLoadedEvents[evtIndex].extendedProps,
                vreme: result.startTime, vremeKraja: result.endTime, sala: result.room, is_ispit: isIspit, dezurni: izabraniSaradnici
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
          dezurni: droppedPredmet?.saradnici || [], is_ispit: true, zauzeteSaleNaDan: zauzecaNaDan
        },
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
          const dezurniIds = result.dezurni_ids || result.formData?.dezurni_ids || [];
          const izabraniSaradnici = result.izabraniSaradnici || [];
          const isIspit = result.is_ispit ?? true;

          this.unsavedEvents.push({
            tempId: tempId, predmet_id: predmetId, title: result.title,
            datum: eventDate, vreme: result.startTime, vreme_kraja: result.endTime,
            sala: result.room, is_ispit: isIspit, dezurni_ids: dezurniIds,
            backgroundColor: originalEvent.backgroundColor, borderColor: originalEvent.borderColor
          });

          const noviEvent = {
            id: tempId, title: `${result.title} (${result.room})`,
            start: `${eventDate}T${result.startTime}:00`, end: result.endTime ? `${eventDate}T${result.endTime}:00` : undefined,
            display: 'block', backgroundColor: isIspit ? originalEvent.backgroundColor : '#ffffff',
            borderColor: originalEvent.borderColor,
            extendedProps: {
              vreme: result.startTime, vremeKraja: result.endTime, sala: result.room,
              predmetId: predmetId, godina: droppedPredmet?.godina, profesorId: droppedPredmet?.profesor_id,
              profesorIme: droppedPredmet?.profesorImePrezime, is_ispit: isIspit, dezurni: izabraniSaradnici
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
      const newDate = info.event.startStr.split('T')[0];
      const dezurniLica = info.event.extendedProps['dezurni'] || [];
      const dezurniIds = dezurniLica.map((d: any) => d.id || d);

      if (info.event.id && !info.event.id.startsWith('temp_')) {
        const existingIndex = this.modifiedEvents.findIndex(e => e.id === info.event.id);
        const payload = {
          id: info.event.id, datum: newDate, vreme: info.event.extendedProps['vreme'],
          vreme_kraja: info.event.extendedProps['vremeKraja'], sala: info.event.extendedProps['sala'],
          predmet_id: info.event.extendedProps['predmetId'], is_ispit: info.event.extendedProps['is_ispit'] ?? true, dezurni_ids: dezurniIds
        };
        if (existingIndex > -1) this.modifiedEvents[existingIndex] = payload; else this.modifiedEvents.push(payload);
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
    },

    eventContent: (arg) => {
      if (arg.event.display === 'background') return null;

      const title = arg.event.title ? arg.event.title.split(' (')[0] : '';
      const isIspit = arg.event.extendedProps['is_ispit'] ?? true;
      const vreme = arg.event.extendedProps['vreme'] || '00:00';
      const godina = arg.event.extendedProps['godina'] || 1;
      const boja = this.getGodinaColor(godina);

      const bg = isIspit ? boja : '#ffffff';
      const textColor = isIspit ? '#ffffff' : '#0f172a';
      const border = isIspit ? `none` : `1.5px solid ${boja}`;
      const timeBg = isIspit ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.08)';
      const timeTextColor = isIspit ? '#ffffff' : boja;

      return {
        html: `
          <div class="clean-cal-card ${!isIspit ? 'is-kolokvijum' : ''}" 
               style="display: flex !important; align-items: center !important; width: 100% !important; height: 32px !important; background-color: ${bg} !important; border: ${border} !important; border-radius: 6px !important; overflow: hidden !important; box-sizing: border-box !important; cursor: pointer !important; box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important;">
            <div style="flex-shrink: 0 !important; background-color: ${timeBg} !important; font-size: 11.5px !important; font-weight: 800 !important; font-family: 'Montserrat', sans-serif !important; padding: 0 7px !important; height: 100% !important; display: flex !important; align-items: center !important; color: ${timeTextColor} !important; border-right: 1px solid rgba(255,255,255,0.2) !important;">
              ${vreme}
            </div>
            <div class="cal-title-container cal-ticker-wrap" style="flex: 1 !important; overflow: hidden !important; position: relative !important; padding: 0 6px !important;">
              <span class="cal-title-text cal-ticker-text" style="display: inline-block !important; font-size: 12.5px !important; font-weight: 800 !important; font-family: 'Montserrat', sans-serif !important; color: ${textColor} !important; line-height: 32px !important; white-space: nowrap !important;">
                ${title}
              </span>
            </div>
          </div>
        `
      };
    },

    eventMouseEnter: (info) => {
      if (info.event.display === 'background') return;

      const wrap = info.el.querySelector('.cal-ticker-wrap') as HTMLElement;
      const text = info.el.querySelector('.cal-ticker-text') as HTMLElement;
      if (wrap && text) {
        const overflowDistance = text.scrollWidth - wrap.clientWidth;
        if (overflowDistance > 0) {
          const trajanje = Math.max(2, overflowDistance / 35);
          text.style.transition = `transform ${trajanje}s linear`;
          text.style.transform = `translateX(-${overflowDistance + 8}px)`;
        }
      }

      const postojeci = document.getElementById('brief-info-popup');
      if (postojeci) postojeci.remove();

      const props = info.event.extendedProps;
      const tip = props['is_ispit'] === false ? 'Kolokvijum' : 'Ispit';
      const vremeKraja = props['vremeKraja'] ? ` - ${props['vremeKraja']}h` : 'h';
      const vremePocetka = props['vreme'] || '00:00';
      const sala = props['sala'] || 'Bez sale';
      const naslov = info.event.title.split(' (')[0];
      const dezurniImena = (props['dezurni'] || []).map((d: any) => `${d.ime} ${d.prezime}`).join(', ') || 'Nema dodeljenih';

      const tooltip = document.createElement('div');
      tooltip.id = 'brief-info-popup';
      tooltip.style.cssText = `
        position: fixed;
        z-index: 9999999;
        background: #ffffff;
        color: #1e293b;
        border-radius: 12px;
        padding: 12px 15px;
        box-shadow: 0 15px 30px -5px rgba(15, 23, 42, 0.2), 0 0 0 1px rgba(31, 99, 160, 0.1);
        pointer-events: none;
        font-family: 'Montserrat', sans-serif;
        min-width: 220px;
        max-width: 320px;
      `;

      tooltip.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px;">
          <span style="font-size: 10px; font-weight: 800; text-transform: uppercase; padding: 2.5px 8px; border-radius: 6px; background: ${props['is_ispit'] === false ? '#fef3c7' : '#e0f2fe'}; color: ${props['is_ispit'] === false ? '#b45309' : '#1F63A0'};">${tip}</span>
          <span style="font-size: 11px; font-weight: 700; color: #64748b;">${sala}</span>
        </div>
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px; line-height: 1.3;">${naslov}</div>
        <div style="font-size: 12px; font-weight: 700; color: #1F63A0; margin-bottom: 7px;">Termin: ${vremePocetka}${vremeKraja}</div>
        <div style="font-size: 11px; font-weight: 600; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 7px;">Dežurni: <strong style="color: #334155;">${dezurniImena}</strong></div>
      `;
      document.body.appendChild(tooltip);

      const rect = info.el.getBoundingClientRect();
      const topPos = rect.top - tooltip.offsetHeight - 8;
      tooltip.style.top = `${topPos < 10 ? rect.bottom + 8 : topPos}px`;
      tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
    },

    eventMouseLeave: (info) => {
      const text = info.el.querySelector('.cal-ticker-text') as HTMLElement;
      if (text) {
        text.style.transition = 'transform 0.3s ease-out';
        text.style.transform = 'translateX(0px)';
      }
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

    if (!imaNovih && !imaIzmenjenih && !imaObrisanih) {
      this.toastService.show('Nema izmena za čuvanje.', 'success');
      return;
    }

    const requests: Observable<any>[] = [];

    if (imaObrisanih) {
      this.obrisaniIspitiServerIds.forEach(id => {
        requests.push(this.http.delete(`${this.API_URL}/ispit/${id}`));
      });
    }

    if (imaNovih) {
      requests.push(this.http.post(`${this.API_URL}/ispit/bulk`, this.unsavedEvents));
    }

    if (imaIzmenjenih) {
      this.modifiedEvents.forEach(evt => {
        requests.push(this.http.put(`${this.API_URL}/ispit/${evt.id}`, evt));
      });
    }

    forkJoin(requests).subscribe({
      next: () => {
        this.toastService.show('Raspored je uspešno sačuvan!', 'success');
        this.unsavedEvents = [];
        this.modifiedEvents = [];
        this.obrisaniIspitiServerIds = [];
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

  ngAfterViewInit(): void {
    this.initDraggable();
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
    if (this.calendarComponent && this.calendarComponent.getApi()) {
      this.calendarComponent.getApi().refetchEvents();
    }
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
      saradnici: this.http.get<any[]>(`${this.API_URL}/profesors`),
      obaveze: this.http.get<any[]>(`${this.API_URL}/obaveze`)
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
      ispiti: this.http.get<any[]>(`${this.API_URL}/ispit`),
      redovnaNastava: this.http.get<any[]>(`${this.API_URL}/ispit/zauzeti-termini`)
    }).subscribe({
      next: ({ ispiti, redovnaNastava }) => {
        const ispitEvents = ispiti.map(i => {
          const pronadjeniPredmet = this.predmeti.find(p => p.id === (i.predmet_id || i.predmet?.id));
          const godina = i.predmet?.godina || pronadjeniPredmet?.godina || i.godina || 1;
          const boja = this.getGodinaColor(godina);

          const isIspit = i.is_ispit ?? true;
          const salaNaziv = i.sala?.naziv || i.sala || 'Bez sale';
          const formatiranoVreme = i.vreme ? (i.vreme.includes('T') ? i.vreme.substring(11, 16) : i.vreme.substring(0, 5)) : '00:00';
          const formatiranoVremeKraja = i.vreme_kraja ? (i.vreme_kraja.includes('T') ? i.vreme_kraja.substring(11, 16) : i.vreme_kraja.substring(0, 5)) : '';
          const nazivPredmeta = i.predmet?.naziv || pronadjeniPredmet?.naziv || 'Ispit';

          return {
            id: i.id.toString(),
            title: `${nazivPredmeta} (${salaNaziv})`,
            start: `${i.datum}T${formatiranoVreme}`,
            end: formatiranoVremeKraja ? `${i.datum}T${formatiranoVremeKraja}` : undefined,
            display: 'block',
            backgroundColor: isIspit ? boja : '#ffffff',
            textColor: isIspit ? '#ffffff' : boja,
            borderColor: boja,
            extendedProps: {
              vreme: formatiranoVreme,
              vremeKraja: formatiranoVremeKraja,
              sala: salaNaziv,
              predmetId: i.predmet_id,
              godina: godina,
              is_ispit: isIspit,
              dezurni: i.dezurstva ? i.dezurstva.map((d: any) => d.saradnik) : []
            }
          };
        });

        const nastavaEvents: any[] = [];
        if (Array.isArray(redovnaNastava)) {
          redovnaNastava.forEach(cas => {
            const dStr = cas.datum ? cas.datum.split('T')[0] : null;
            if (!dStr) return;
            nastavaEvents.push({
              id: `nastava_${cas.id}`,
              title: `Nastava: ${cas.predmet} (${cas.sala?.naziv || 'Sala'})`,
              start: `${dStr}T${cas.vreme_pocetka}:00`,
              end: `${dStr}T${cas.vreme_kraja}:00`,
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
    this.http.get<any[]>(`${this.API_URL}/ucionice`).subscribe({
      next: (res) => this.dostupneSale = res,
      error: (err) => console.error('Greška pri dohvatanju svih učionica:', err)
    });
  }

  private initDraggable(): void {
    const self = this;
    if (this.draggableContainer && this.draggableContainer.nativeElement) {
      if (this.draggableInstance) this.draggableInstance.destroy();
      this.draggableInstance = new Draggable(this.draggableContainer.nativeElement, {
        itemSelector: '.fc-event',
        eventData: function (eventEl) {
          const godina = parseInt(eventEl.getAttribute('data-godina') || '1');
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

  detectConflicts(): void {
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
              razlozi.push(`Sala "${s1}" je zauzeta u periodu od ${e1.extendedProps['vreme']}h do ${e1.extendedProps['vremeKraja'] || '(?)'}`);
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
      cell.style.backgroundColor = '';

      const oldWarning = cell.querySelector('.conflict-warning');
      if (oldWarning) oldWarning.remove();

      if (date && conflictsByDate.has(date)) {
        cell.style.backgroundColor = '#fff9c4';
        const actionsWrapper = cell.querySelector('.day-actions-wrapper');

        if (actionsWrapper) {
          const warning = document.createElement('div');
          warning.className = 'conflict-warning';
          warning.style.cssText = 'display:inline-flex; align-items:center; cursor:pointer; z-index:50; flex-shrink:0;';
          warning.innerHTML = `
            <div style="position: relative; display: inline-flex; align-items: center;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" style="width: 18px; height: 18px; filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.15));">
                <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
              </svg>
              <div class="custom-conflict-tooltip" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: #ffffff; color: #334155; border: 1px solid #cbd5e1; padding: 16px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; line-height: 1.5; white-space: normal; width: max-content; max-width: 320px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 9999px rgba(0, 0, 0, 0.1); z-index: 999999; pointer-events: none; text-align: center;">
                ${conflictsByDate.get(date)!.join('<br><br>')}
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

  private timeToMins(timeStr: string): number {
    if (!timeStr || !timeStr.includes(':')) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
  }

  // ============================================
  // IZVOZ U EXCEL I ŠTAMPA
  // ============================================

  otvoriIzvozModal(): void {
    this.prikaziIzvozModal = true;
    const danas = new Date();
    this.izvozPodaci.datumOd = danas.toISOString().split('T')[0];
    const sledeciMesec = new Date();
    sledeciMesec.setMonth(sledeciMesec.getMonth() + 1);
    this.izvozPodaci.datumDo = sledeciMesec.toISOString().split('T')[0];
  }

  generisiExcel(): void {
    const { tip, datumOd, datumDo, nazivRoka } = this.izvozPodaci;
    if (!datumOd || !datumDo) {
      this.toastService.show('Izaberite oba datuma!', 'error');
      return;
    }

    const dOd = new Date(datumOd).getTime();
    const dDo = new Date(datumDo).getTime();

    const ispitiUPeriodu = this.allLoadedEvents.filter(e => {
      const isIspitEvent = e.extendedProps?.is_ispit ?? true;
      if (tip === 'ispiti' && !isIspitEvent) return false;
      if (tip === 'kolokvijumi' && isIspitEvent) return false;
      if (e.extendedProps?.isNastava) return false;

      const evtStartStr = e.start.split('T')[0];
      const evtDatumMs = new Date(evtStartStr).getTime();
      return evtDatumMs >= dOd && evtDatumMs <= dDo;
    });

    if (ispitiUPeriodu.length === 0) {
      this.toastService.show('Nema zakazanih termina u izabranom periodu.', 'error');
      return;
    }

    ispitiUPeriodu.sort((a, b) => {
      const godA = a.extendedProps.godina || 99;
      const godB = b.extendedProps.godina || 99;
      if (godA !== godB) return godA - godB;
      const datumA = new Date(a.start.split('T')[0]).getTime();
      const datumB = new Date(b.start.split('T')[0]).getTime();
      if (datumA !== datumB) return datumA - datumB;
      return a.title.localeCompare(b.title);
    });

    const wsData: any[][] = [];
    const cellStyles: any = {};
    let rowIndex = 1;

    wsData.push(['ОАС и МАС', 'Информатике', null, null]);
    cellStyles[`A${rowIndex}`] = { font: { sz: 12, name: 'Calibri' } };
    cellStyles[`B${rowIndex}`] = { font: { sz: 12, name: 'Calibri' } };
    rowIndex++;

    const bojaPoGodini: any = {
      1: 'FF8EA9DB',
      2: 'FFF4B083',
      3: 'FFFFD965',
      4: 'FFA8D08D',
      5: 'FF00B0F0'
    };

    const tankiOkvir = {
      top: { style: 'thin', color: { rgb: 'FF000000' } },
      bottom: { style: 'thin', color: { rgb: 'FF000000' } },
      left: { style: 'thin', color: { rgb: 'FF000000' } },
      right: { style: 'thin', color: { rgb: 'FF000000' } }
    };

    let trenutnaGodina = -1;
    let redniBroj = 1;

    ispitiUPeriodu.forEach(ispit => {
      const ispitGodina = ispit.extendedProps.godina || 1;
      if (ispitGodina !== trenutnaGodina) {
        trenutnaGodina = ispitGodina;
        redniBroj = 1;
        const rimska = ['I', 'II', 'III', 'IV', 'Мастер'][trenutnaGodina - 1] || trenutnaGodina;

        wsData.push([`${rimska} година`, null, null, null]);
        cellStyles[`A${rowIndex}`] = { font: { bold: true, sz: 12, name: 'Calibri' } };
        rowIndex++;

        wsData.push([null, 'Предмет', nazivRoka, null]);
        cellStyles[`B${rowIndex}`] = { font: { sz: 11, name: 'Calibri' } };
        cellStyles[`C${rowIndex}`] = { font: { sz: 11, name: 'Calibri' } };
        rowIndex++;
      }

      const nazivPredmeta = ispit.title.split(' (')[0];
      const datumSirovo = ispit.start.split('T')[0].split('-');
      const datumPrikaz = `${datumSirovo[2]}.${datumSirovo[1]}.`;
      const vremePrikaz = ispit.extendedProps.vreme + 'h';

      wsData.push([redniBroj, nazivPredmeta, datumPrikaz, vremePrikaz]);
      const bgColor = bojaPoGodini[trenutnaGodina] || 'FFFFFFFF';

      cellStyles[`A${rowIndex}`] = { border: tankiOkvir, alignment: { horizontal: 'right' }, font: { name: 'Calibri', sz: 11 } };
      cellStyles[`B${rowIndex}`] = { fill: { fgColor: { rgb: bgColor } }, border: tankiOkvir, font: { name: 'Calibri', sz: 11 } };
      cellStyles[`C${rowIndex}`] = { border: tankiOkvir, font: { name: 'Calibri', sz: 11 } };
      cellStyles[`D${rowIndex}`] = { border: tankiOkvir, font: { name: 'Calibri', sz: 11 } };

      rowIndex++;
      redniBroj++;
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    for (const key in cellStyles) {
      if (ws[key]) ws[key].s = cellStyles[key];
    }

    ws['!cols'] = [{ wch: 15 }, { wch: 45 }, { wch: 15 }, { wch: 10 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Raspored');
    XLSX.writeFile(wb, `Raspored_${tip}_${datumOd}.xlsx`);

    this.prikaziIzvozModal = false;
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