import { Component, AfterViewInit, ElementRef, ViewChild, inject, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { forkJoin } from 'rxjs';
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
import { ExcelIzvozService } from './services/excel-izvoz.service';
import { Predmet, Profesor } from './main.models';
import { presloviULatinicu, formatDatumKonflikta, tipKonflikta, timeToMins, bojaTeksta } from './main.utils';
import { MESECI } from './calendar-config';
import { GodinaColorService } from './services/godina-color.service';
import { KALENDAR_STATICKA_PODESAVANJA } from './calendar-config';
import { environment } from '../../../environments/environment';
// Boja kartica redovne nastave (namerno drugačija od boja godina)
const NASTAVA_BOJA = '#7a6fa8';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, FullCalendarModule, MatDialogModule, FormsModule, MatSelectModule, MatFormFieldModule],
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
  private excel = inject(ExcelIzvozService);
  private boje = inject(GodinaColorService);

  // --- KONTROLA PRIKAZA PANELA I STATUSA ---
  prikaziLevoFiltere: boolean = false;
  prikaziDesnoFiltere: boolean = false;
  predmeti: Predmet[] = [];
  draggableInstance: Draggable | null = null;
  modifiedEvents: any[] = [];
  unsavedEvents: any[] = [];
  obrisaniIspitiServerIds: number[] = [];
  hasUnsavedChanges: boolean = false;

  prikaziIspite: boolean = true;
  prikaziKolokvijume: boolean = true;
  prikaziNastavu: boolean = false; // redovna nastava je podrazumevano sakrivena (puno kartica = sporiji kalendar)
  isDashboardOpen: boolean = false;

  // --- MASOVNO UREĐIVANJE I KOPIRANJE DANA ---
  rezimUredjivanjaDana: boolean = false;
  selektovaniDani = new Set<string>();
  kopiranjeAktivno: boolean = false;

  // --- MODALI ---
  prikaziObrisiModal: boolean = false;
  prikaziKonfliktiModal: boolean = false;
  prikaziKonfliktePriCuvanju: boolean = false;
  konfliktiPriCuvanju: any[] = [];
  proveraUToku: boolean = false;

  // --- FILTERI ---
  izabraneGodine: number[] = [];
  // Dugme "MAS" (master, godina 5) se pojavljuje samo ako takvi predmeti postoje
  get godineOpcije() {
    const opcije = [
      { id: 1, label: '1. God' },
      { id: 2, label: '2. God' },
      { id: 3, label: '3. God' },
      { id: 4, label: '4. God' }
    ];
    if (this.predmeti.some(p => Number(p.godina) === 5)) opcije.push({ id: 5, label: 'MAS' });
    return opcije;
  }
  filterGodina: string = 'sve';
  filterSala: string = 'sve';
  filterLevoOsoba: string = ''; // ono što je ukucano u polju (latinica i ćirilica se ne razlikuju)
  izabranaOsobaId: number | null = null; // osoba izabrana iz ponuđene liste
  searchPredmet: string = '';
  prikazaniBrojPredmeta: number = 5;
  filterSaradnici: number[] = [];


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
    dayMaxEvents: 4,
    // ispiti i kolokvijumi uvek ispred redovne nastave, da ih "+N još" nikad ne sakrije
    eventOrder: (a: any, b: any) => (a.extendedProps?.isNastava ? 1 : 0) - (b.extendedProps?.isNastava ? 1 : 0) || String(a.start).localeCompare(String(b.start)),
    moreLinkContent: (arg) => `+${arg.num} još`,
    dayMaxEventRows: false,
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

      const title = arg.event.title ? arg.event.title.replace(/^Nastava:\s*/, '').split(' (')[0] : '';
      const isIspit = arg.event.extendedProps['is_ispit'] ?? true;
      const vreme = arg.event.extendedProps['vreme'] || '00:00';
      const godina = arg.event.extendedProps['godina'] || 1;
      const jeNastava = !!arg.event.extendedProps['isNastava'];
      const boja = jeNastava ? NASTAVA_BOJA : this.getGodinaColor(godina);
      const salaProp = arg.event.extendedProps['sala'];
      const salaNaziv = (typeof salaProp === 'object' ? salaProp?.naziv : salaProp) || '';
      const salaTag = salaNaziv && salaNaziv !== 'Bez sale' ? `<small class="cal-card-sala">${salaNaziv}</small>` : '';
      const krajSirov = String(arg.event.extendedProps['vremeKraja'] || arg.event.extendedProps['vreme_kraja'] || '').substring(0, 5);
      const vremeTekst = krajSirov && krajSirov !== '00:00' && krajSirov !== '0:00' ? `${String(vreme).substring(0, 5)}<span class="cal-card-kraj">–${krajSirov}</span>` : String(vreme).substring(0, 5);
      const { ink, chip } = bojaTeksta(boja);

      // --ev = boja godine; sve ostalo (pozadina, ivica, tekst) određuje CSS aktivnog dizajna
      return {
        html: `
          <div class="clean-cal-card ${isIspit ? 'is-ispit' : 'is-kolokvijum'}${jeNastava ? ' is-nastava' : ''}" style="--ev: ${boja}; --ev-ink: ${ink}; --ev-chip: ${chip};">
            <div class="cal-card-time"><span class="cal-card-vreme">${vremeTekst}</span>${salaTag}</div>
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
      const jeNastava = !!props['isNastava'];
      const tip = jeNastava ? 'Nastava' : (props['is_ispit'] === false ? 'Kolokvijum' : 'Ispit');
      const k = props['vremeKraja'] || props['vreme_kraja'];
      const vremeKraja = (k && k !== '00:00' && k !== '0:00') ? ` - ${k}h` : '';
      const vremePocetka = props['vreme'] || '09:00';
      const sala = props['sala'] || 'Bez sale';
      const naslov = jeNastava ? info.event.title.replace(/^Nastava:\s*/, '').split(' (')[0] : info.event.title.split(' (')[0];
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
        min-width: 260px;
        max-width: 380px;
      `;

      tooltip.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 7px;">
          <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; padding: 3px 10px; border-radius: 6px; background: ${jeNastava ? NASTAVA_BOJA : (props['is_ispit'] === false ? 'var(--tint-amber-bg)' : 'var(--tint-sky-bg)')}; color: ${jeNastava ? '#fff' : (props['is_ispit'] === false ? 'var(--tint-amber-fg)' : 'var(--primary-text)')};">${tip}</span>
          <span style="font-size: 13px; font-weight: 700; color: var(--muted);">${sala}</span>
        </div>
        <div style="font-size: 16px; font-weight: 800; color: var(--text); margin-bottom: 8px; line-height: 1.3;">${naslov}</div>
        <div style="font-size: 14.5px; font-weight: 700; color: var(--primary-text); margin-bottom: 8px;">Termin: ${vremePocetka}${vremeKraja}</div>
        ${jeNastava ? '' : `<div style="font-size: 13.5px; font-weight: 600; color: var(--muted); border-top: 1px solid var(--border); padding-top: 8px;">Dežurni: <strong style="color: var(--text-2);">${dezurniImena}</strong></div>`}
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

    ...KALENDAR_STATICKA_PODESAVANJA
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
    this.boje.ucitajSacuvane();
  }

  private hoverRaf = 0;

  // ---- Birač meseca i godine (klik na naslov kalendara) ----
  biracOtvoren = false;
  biracGodina = new Date().getFullYear();
  biracPrikazGodina = false;
  biracPozicija = { top: 0, left: 0 };
  readonly mesecNazivi = MESECI;

  get biracGodineMreza(): number[] {
    const pocetak = this.biracGodina - 5;
    return Array.from({ length: 12 }, (_, i) => pocetak + i);
  }

  otvoriBirac(naslov: HTMLElement): void {
    const datum = this.calendarComponent.getApi().getDate();
    this.biracGodina = datum.getFullYear();
    this.biracPrikazGodina = false;
    const r = naslov.getBoundingClientRect();
    const sirina = 320;
    this.biracPozicija = {
      top: r.bottom + 8,
      left: Math.max(8, Math.min(r.left + r.width / 2 - sirina / 2, window.innerWidth - sirina - 8))
    };
    this.biracOtvoren = true;
    this.cdr.detectChanges();
  }

  zatvoriBirac(): void {
    this.biracOtvoren = false;
    this.cdr.detectChanges();
  }

  jeTrenutniMesec(m: number): boolean {
    const d = this.calendarComponent?.getApi().getDate();
    return !!d && d.getFullYear() === this.biracGodina && d.getMonth() === m;
  }

  jeOvajMesec(m: number): boolean {
    const d = new Date();
    return d.getFullYear() === this.biracGodina && d.getMonth() === m;
  }

  izaberiMesecBirac(m: number): void {
    this.calendarComponent.getApi().gotoDate(new Date(this.biracGodina, m, 1));
    this.zatvoriBirac();
  }

  izaberiGodinuBirac(g: number): void {
    this.biracGodina = g;
    this.biracPrikazGodina = false;
    this.cdr.detectChanges();
  }

  biracDanas(): void {
    this.calendarComponent.getApi().today();
    this.zatvoriBirac();
  }

  ngAfterViewInit(): void {
    this.initDraggable();

    // Dohvatamo root element kalendara preko getApi().el ili selektora
    setTimeout(() => {
      const calEl = this.calendarComponent?.getApi()?.el || document.querySelector('full-calendar');
      if (calEl) {
        calEl.addEventListener('click', (e: Event) => {
          const naslov = (e.target as HTMLElement).closest('.fc-toolbar-title') as HTMLElement | null;
          if (naslov) this.otvoriBirac(naslov);
        });
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

  // Profesori i saradnici sa predmeta koji se poklapaju sa ukucanim tekstom
  get ponudjeneOsobe(): { id: number; ime: string; prezime: string; uloga: string; brojPredmeta: number }[] {
    const q = presloviULatinicu(this.filterLevoOsoba.trim());
    if (!q) return [];
    const mapa = new Map<number, { id: number; ime: string; prezime: string; uloga: string; brojPredmeta: number }>();
    const dodaj = (o: any, uloga: string) => {
      if (!o || o.id === undefined) return;
      const unos = mapa.get(o.id) ?? { id: o.id, ime: o.ime, prezime: o.prezime, uloga, brojPredmeta: 0 };
      unos.brojPredmeta++;
      mapa.set(o.id, unos);
    };
    this.predmeti.forEach(p => {
      dodaj(p.profesor, 'Profesor');
      (p.saradnici || []).forEach((x: any) => dodaj(x, 'Saradnik'));
    });
    return [...mapa.values()]
      .filter(o => presloviULatinicu(`${o.ime} ${o.prezime}`).includes(q) || presloviULatinicu(`${o.prezime} ${o.ime}`).includes(q))
      .sort((a, b) => `${a.prezime} ${a.ime}`.localeCompare(`${b.prezime} ${b.ime}`))
      .slice(0, 30);
  }

  promenaOsobe(tekst: string): void {
    this.filterLevoOsoba = tekst;
    this.izabranaOsobaId = null; // izmena teksta poništava prethodni izbor
  }

  izaberiOsobu(o: { id: number; ime: string; prezime: string }): void {
    this.izabranaOsobaId = o.id;
    this.filterLevoOsoba = `${o.ime} ${o.prezime}`;
  }

  izaberiPrvuOsobu(): void {
    const prva = this.ponudjeneOsobe[0];
    if (prva && this.izabranaOsobaId === null) this.izaberiOsobu(prva);
  }

  ocistiOsobu(): void {
    this.filterLevoOsoba = '';
    this.izabranaOsobaId = null;
  }

  get filtriraniPredmeti() {
    let filtrirano = this.predmeti;
    if (this.izabraneGodine.length > 0) {
      filtrirano = filtrirano.filter(p => this.izabraneGodine.includes(Number(p.godina)));
    }
    if (this.izabranaOsobaId !== null) {
      const id = this.izabranaOsobaId;
      filtrirano = filtrirano.filter(p => p.profesor_id === id || (p.saradnici || []).some((x: any) => x.id === id));
    }
    if (this.searchPredmet) {
      const q = presloviULatinicu(this.searchPredmet);
      filtrirano = filtrirano.filter(p => {
        const nazivLat = presloviULatinicu(p.naziv);
        const profLat = presloviULatinicu(`${p.profesorImePrezime || ''} ${(p.saradnici || []).map((s: any) => `${s.ime} ${s.prezime}`).join(' ')}`);
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
      if (e.extendedProps?.isNastava) return this.prikaziNastavu;
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
    return this.boje.getGodinaColor(godina);
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
          const kraj1 = String(e1.extendedProps['vremeKraja'] || e1.extendedProps['vreme_kraja'] || '').trim();
          const kraj2 = String(e2.extendedProps['vremeKraja'] || e2.extendedProps['vreme_kraja'] || '').trim();
          const start1 = timeToMins(String(e1.extendedProps['vreme'] || '').trim());
          const end1 = timeToMins(kraj1) || (start1 + 120);
          const start2 = timeToMins(String(e2.extendedProps['vreme'] || '').trim());
          const end2 = timeToMins(kraj2) || (start2 + 120);
          const opseg = (e: any, kraj: string) => kraj ? `${e.extendedProps['vreme']}–${kraj.substring(0, 5)}` : `${e.extendedProps['vreme']}`;

          if (start1 < end2 && start2 < end1) {
            const s1 = String(e1.extendedProps['sala'] || '').trim();
            const s2 = String(e2.extendedProps['sala'] || '').trim();
            if (s1 && s2 && s1 === s2 && s1 !== 'Bez sale' && s1 !== 'undefined') {
              const n1 = String(e1.title).split(' (')[0];
              const n2 = String(e2.title).split(' (')[0];
              razlozi.push(`Sala ${s1}: „${n1}“ (${opseg(e1, kraj1)}) i „${n2}“ (${opseg(e2, kraj2)}) se preklapaju.`);
            }
            const dezurni1: any[] = e1.extendedProps['dezurni'] || [];
            const dezurni2: any[] = e2.extendedProps['dezurni'] || [];
            dezurni1.forEach(d1 => {
              if (dezurni2.some(d2 => d2.id === d1.id)) {
                const m1 = String(e1.title).split(' (')[0];
                const m2 = String(e2.title).split(' (')[0];
                razlozi.push(`Saradnik ${d1.ime} ${d1.prezime} je istovremeno dežuran na „${m1}“ (${opseg(e1, kraj1)}) i „${m2}“ (${opseg(e2, kraj2)}).`);
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
            .map((r) => `<li style="margin:0 0 12px 0;">${r}</li>`)
            .join('');
          const naslovDatuma = this.formatDatumKonflikta(date);
          warning.innerHTML = `
            <div style="position: relative; display: inline-flex; align-items: center;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" style="width: 22px; height: 22px; filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.15));">
                <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
              </svg>
              <div class="custom-conflict-tooltip" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; border-radius: 14px; width: min(620px, 94vw); max-height: 75vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 9999px rgba(0, 0, 0, 0.18); z-index: 999999; pointer-events: none; text-align: left; font-family: Montserrat, sans-serif;">
                <div style="background:#1F63A0; color:#fff; padding:16px 24px; font-weight:800; font-size:19px; border-radius:14px 14px 0 0;">
                  ⚠ Konflikti – ${naslovDatuma}
                </div>
                <ul style="margin:0; padding:18px 24px 10px 44px; font-size:17px; font-weight:500; line-height:1.55; list-style:disc;">${stavke}</ul>
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

  formatDatumKonflikta(datum: string): string {
    return formatDatumKonflikta(datum);
  }

  tipKonflikta(tekst: string): 'sala' | 'dezurni' | 'odsustvo' {
    return tipKonflikta(tekst);
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
          this.excel.generisiKolokvijume(rezultat, this.allLoadedEvents, this.predmeti);
        } else if (rezultat.tip === 'ispiti') {
          this.excel.generisiIspite(rezultat, this.allLoadedEvents, this.predmeti);
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

      this.toastService.show(`Izabran opseg: ${dOd} do ${dDo}! Vraćam tabelu...`, 'success');

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
}
