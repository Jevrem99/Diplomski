import { Component, AfterViewInit, ElementRef, ViewChild, inject, OnInit, ChangeDetectorRef, ViewEncapsulation, NgZone } from '@angular/core';
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
  // --- KONTROLA PRIKAZA FILTER PANELA ---
  prikaziLevoFiltere: boolean = false;
  prikaziDesnoFiltere: boolean = false;
  username = localStorage.getItem('username');
  predmeti: Predmet[] = [];
  draggableInstance: Draggable | null = null;
  modifiedEvents: any[] = [];
  unsavedEvents: any[] = [];
  hasUnsavedChanges: boolean = false;
  
  prikaziIspite: boolean = true;
  prikaziKolokvijume: boolean = true;
  isDashboardOpen: boolean = false;
  
  // --- VARIJABLE ZA NOVO BRZO UREĐIVANJE ---
  daniSaIspitima = new Set<string>(); 
  rezimKopiranjaDana: boolean = false;
  danZaKopiranje: string = '';
  ciljniDatumiZaKopiranje = new Set<string>(); 
  
  prikaziDanModal: boolean = false;
  danModalPrikaz: 'meni' | 'preuredi' = 'meni';
  selektovanDan: string = '';
  ciljniDatum: string = '';
  ispitiZaPreuredjivanje: any[] = [];
  ispitiZaBrisanje: string[] = [];

  // --- FILTERI ---
  filterGodina: string = 'sve';
  filterSala: string = 'sve';
  filterLevoGodina: string = 'sve';
  filterLevoProfesor: string = 'svi';
  izabranaGodinaBanka: string | number = 'sve';
  
  defaultGodinaColors: any = { 1: '#34b9f7', 2: '#ef4444', 3: '#eab308', 4: '#10b981' };
  godinaColors: any = { ...this.defaultGodinaColors };
  
  dostupneSale: any[] = [];
  allLoadedEvents: any[] = [];
  sviSaradnici: any[] = [];
  sveObaveze: any[] = [];
  filterSaradnici: number[] = [];
  searchPredmet: string = '';
  prikazaniBrojPredmeta: number = 5;

  stats = { totalIspiti: 0, totalSaradnici: 0, topDezurni: 'Učitavanje...', konflikti: 0 };

  // ============================================
  // FUNKCIJE ZA MODAL DANA (BRZO UREĐIVANJE I KOPIRANJE)
  // ============================================

  otvoriKopiranjeDanaIzModala() {
    this.rezimKopiranjaDana = true;
    this.danZaKopiranje = this.selektovanDan;
    this.ciljniDatumiZaKopiranje.clear(); 
    this.prikaziDanModal = false;
    this.applyFilters(); 
  }

  otkaziKopiranjeDana() {
    this.rezimKopiranjaDana = false;
    this.danZaKopiranje = '';
    this.ciljniDatumiZaKopiranje.clear();
    this.applyFilters(); 
  }

  izvrsiVisestrukoKopiranje() {
    if (this.ciljniDatumiZaKopiranje.size === 0) {
      this.toastService.show('Izaberite barem jedan ciljni datum klikom na kružić u kalendaru.', 'error');
      return;
    }

    if (this.ciljniDatumiZaKopiranje.has(this.danZaKopiranje)) {
      this.toastService.show('Ne možete kopirati dan na samog sebe. Odznačite taj datum.', 'error');
      return;
    }

    const ispitiIzDana = this.allLoadedEvents.filter(e => e.start.startsWith(this.danZaKopiranje) && !e.extendedProps?.isNastava);
    
    this.hasUnsavedChanges = true;

    this.ciljniDatumiZaKopiranje.forEach(ciljniDatum => {
      ispitiIzDana.forEach(stariEvent => {
        const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const noviStart = stariEvent.start.replace(this.danZaKopiranje, ciljniDatum);
        const noviEnd = stariEvent.end ? stariEvent.end.replace(this.danZaKopiranje, ciljniDatum) : undefined;
        
        const noviEvent = { ...stariEvent, id: tempId, start: noviStart, end: noviEnd };
        this.allLoadedEvents.push(noviEvent);
        
        this.unsavedEvents.push({
           tempId: tempId,
           predmet_id: stariEvent.extendedProps.predmetId,
           title: stariEvent.title.split(' (')[0],
           datum: ciljniDatum,
           vreme: stariEvent.extendedProps.vreme,
           vreme_kraja: stariEvent.extendedProps.vremeKraja,
           sala: stariEvent.extendedProps.sala,
           is_ispit: stariEvent.extendedProps.is_ispit,
           dezurni_ids: stariEvent.extendedProps.dezurni?.map((d:any)=>d.id) || []
        });
      });
    });

    this.rezimKopiranjaDana = false;
    this.danZaKopiranje = '';
    this.ciljniDatumiZaKopiranje.clear();
    this.applyFilters();
    this.toastService.show(`Ispiti uspešno kopirani!`, 'success');
    setTimeout(() => this.detectConflicts(), 150);
  }

  otvoriPreuredjivanje() {
    this.danModalPrikaz = 'preuredi';
    this.ispitiZaBrisanje = [];
    const ispitiIzDana = this.allLoadedEvents.filter(e => e.start.startsWith(this.selektovanDan) && !e.extendedProps?.isNastava);
    this.ispitiZaPreuredjivanje = JSON.parse(JSON.stringify(ispitiIzDana));
  }

  obrisiIspitIzDana(id: string) {
    this.ispitiZaPreuredjivanje = this.ispitiZaPreuredjivanje.filter(i => i.id !== id);
    this.ispitiZaBrisanje.push(id);
  }

  sacuvajPreuredjivanje() {
    this.hasUnsavedChanges = true;

    this.ispitiZaBrisanje.forEach(id => {
       if (!id.startsWith('temp_')) this.http.delete(`${this.API_URL}/ispit/${id}`).subscribe();
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
             dezurni_ids: modIspit.extendedProps.dezurni?.map((d:any)=>d.id) || []
          };
          if (mIdx > -1) this.modifiedEvents[mIdx] = payload; else this.modifiedEvents.push(payload);
       }
    });

    this.applyFilters();
    this.prikaziDanModal = false;
    this.toastService.show('Izmene u danu su sačuvane!', 'success');
    setTimeout(() => this.detectConflicts(), 150);
  }

  obrisiCeoDan() {
    if(confirm(`Da li ste sigurni da želite da obrišete SVE ispite na dan ${this.selektovanDan}?`)) {
      const ispitiIzDana = this.allLoadedEvents.filter(e => e.start.startsWith(this.selektovanDan) && !e.extendedProps?.isNastava);
      ispitiIzDana.forEach(stariEvent => {
         if (!stariEvent.id.startsWith('temp_')) this.http.delete(`${this.API_URL}/ispit/${stariEvent.id}`).subscribe();
      });
      const idsToRemove = ispitiIzDana.map(e => e.id);
      this.allLoadedEvents = this.allLoadedEvents.filter(e => !idsToRemove.includes(e.id));
      this.unsavedEvents = this.unsavedEvents.filter(e => !idsToRemove.includes(e.tempId));
      this.modifiedEvents = this.modifiedEvents.filter(e => !idsToRemove.includes(e.id));

      this.hasUnsavedChanges = true;
      this.applyFilters();
      this.prikaziDanModal = false;
      this.toastService.show('Svi ispiti u danu su obrisani.', 'success');
      setTimeout(() => this.detectConflicts(), 150);
    }
  }

  // ============================================
  // FULLCALENDAR OPCIJE (Integracija olovčice)
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
      const hasEvents = this.daniSaIspitima.has(dateStr);
      
      let html = `<div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:10px;">`; 
      
      if (this.rezimKopiranjaDana) {
         const isSelected = this.ciljniDatumiZaKopiranje.has(dateStr);
         if (isSelected) {
            html += `<div class="target-circle" data-date="${dateStr}" style="width:20px; height:20px; border-radius:50%; background-color:#6366f1; border:2px solid #6366f1; display:flex; align-items:center; justify-content:center; flex-shrink:0; pointer-events:auto; cursor:pointer; z-index:50;">
                        <svg width="12" height="12" fill="none" stroke="white" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path></svg>
                     </div>`;
         } else {
            html += `<div class="target-circle hover:border-indigo-400 hover:bg-indigo-50" data-date="${dateStr}" style="width:20px; height:20px; border-radius:50%; border:2px solid #cbd5e1; background-color:#f8fafc; flex-shrink:0; pointer-events:auto; cursor:pointer; z-index:50; transition:all 0.2s;"></div>`;
         }
      } else if (hasEvents) {
         html += `<div class="edit-day-icon hover:bg-slate-200 transition-colors" data-date="${dateStr}" style="padding:4px; border-radius:6px; flex-shrink:0; pointer-events:auto; cursor:pointer; z-index:50;">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                  </div>`;
      } else {
         html += `<div></div>`;
      }
      
      html += `<span style="font-size:12px; font-weight:700; color:#475569; pointer-events:none;">${arg.dayNumberText}</span></div>`;
      return { html };
    },

    dateClick: (info) => {
      if (this.rezimKopiranjaDana) {
        const eventDate = info.dateStr;
        if (this.ciljniDatumiZaKopiranje.has(eventDate)) {
           this.ciljniDatumiZaKopiranje.delete(eventDate);
        } else {
           this.ciljniDatumiZaKopiranje.add(eventDate);
        }
        this.applyFilters();
        return;
      }
    },

    eventClick: (info) => {
      if (info.event.display === 'background') return;

      const eventDate = info.event.startStr ? info.event.startStr.split('T')[0] : (info.event.start?.toISOString().split('T')[0] || '');

      if (this.rezimKopiranjaDana) {
        if (this.ciljniDatumiZaKopiranje.has(eventDate)) {
           this.ciljniDatumiZaKopiranje.delete(eventDate);
        } else {
           this.ciljniDatumiZaKopiranje.add(eventDate);
        }
        this.applyFilters();
        return; 
      }

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
        maxWidth: '95vw', width: '1000px', maxHeight: '90vh',
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
              this.http.delete(`${this.API_URL}/ispit/${info.event.id}`).subscribe({
                next: () => {
                  this.allLoadedEvents = this.allLoadedEvents.filter(e => e.id !== info.event.id);
                  this.applyFilters();
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
        maxWidth: '95vw', width: '1000px', maxHeight: '90vh',
        data: {
          title: originalEvent.title, date: eventDate, predmetId: predmetId,
          dezurni: droppedPredmet?.saradnici || [], is_ispit: true, zauzeteSaleNaDan: zauzecaNaDan
        },
        disableClose: true
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
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

      const title = arg.event.title.split(' (')[0];
      const isIspit = arg.event.extendedProps['is_ispit'] ?? true;
      const vreme = arg.event.extendedProps['vreme'] || '00:00';
      const boja = arg.event.borderColor || '#34b9f7';

      const bg = isIspit ? boja : '#ffffff';
      const textColor = isIspit ? '#ffffff' : boja;
      const border = `1.5px solid ${boja}`;
      const timeBg = isIspit ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.05)';

      return {
        html: `
          <div class="clean-cal-card" style="display: flex; align-items: center; width: 100%; height: 22px; background-color: ${bg}; color: ${textColor}; border: ${border}; border-radius: 4px; overflow: hidden; box-sizing: border-box; cursor: pointer;">
            <div style="flex-shrink: 0; background-color: ${timeBg}; font-size: 10px; font-weight: 800; padding: 0 4px; height: 100%; display: flex; align-items: center; border-right: 1px solid ${isIspit ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)'};">
              ${vreme}
            </div>
            <div class="cal-title-container" style="flex: 1; overflow: hidden; white-space: nowrap; padding: 0 4px; position: relative;">
              <span class="cal-title-text" style="display: inline-block; font-size: 11px; font-weight: 700; color: ${textColor};">${title}</span>
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
      const vremeKraja = props['vremeKraja'] ? ` - ${props['vremeKraja']}h` : 'h';
      const vremePocetka = props['vreme'] || '00:00';
      const sala = props['sala'] || 'Bez sale';
      const naslov = info.event.title.split(' (')[0];
      const dezurniImena = (props['dezurni'] || []).map((d: any) => `${d.ime} ${d.prezime}`).join(', ') || 'Nema dodeljenih';

      const tooltip = document.createElement('div');
      tooltip.id = 'brief-info-popup';
      tooltip.style.cssText = `position: fixed; z-index: 9999999; background: #ffffff; color: #1e293b; border-radius: 10px; padding: 10px 14px; box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05); pointer-events: none; font-family: inherit; min-width: 210px; max-width: 300px;`;

      tooltip.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; background: ${props['is_ispit'] === false ? '#dcfce7' : '#e0f2fe'}; color: ${props['is_ispit'] === false ? '#15803d' : '#0369a1'};">${tip}</span>
          <span style="font-size: 11px; font-weight: 600; color: #64748b;">${sala}</span>
        </div>
        <div style="font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 6px; line-height: 1.3;">${naslov}</div>
        <div style="font-size: 11.5px; font-weight: 600; color: #0284c7; margin-bottom: 6px;">Termin: ${vremePocetka}${vremeKraja}</div>
        <div style="font-size: 11px; color: #64748b; border-top: 1px solid #f1f5f9; padding-top: 6px; margin-top: 2px;">Dežurni: <strong style="color: #334155;">${dezurniImena}</strong></div>
      `;
      document.body.appendChild(tooltip);

      const rect = info.el.getBoundingClientRect();
      const topPos = rect.top - tooltip.offsetHeight - 8;
      tooltip.style.top = `${topPos < 10 ? rect.bottom + 8 : topPos}px`;
      tooltip.style.left = `${rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2)}px`;
    },

    eventMouseLeave: () => {
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
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    buttonText: { today: 'Danas', month: 'Mesec', week: 'Nedelja', day: 'Dan' }
  };

  // ============================================
  // OSTALE FUNKCIJE 
  // ============================================

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
    this.calendarOptions = { ...this.calendarOptions }; 
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

  get jedinstveniProfesori() {
    const map = new Map<number, any>();
    this.predmeti.forEach(p => {
      if (p.profesor && p.profesor.id) map.set(p.profesor.id, p.profesor);
    });
    return Array.from(map.values());
  }

  odaberiGodinuFilter(god: string | number) {
    this.izabranaGodinaBanka = god;
    this.filterLevoGodina = god.toString(); 
  }

  fetchUcionice() {
    console.log('fetchUcionice pozvan');
  }

  get filtriraniPredmeti() {
    let filtrirano = this.predmeti;

    if (this.filterLevoGodina !== 'sve') {
      filtrirano = filtrirano.filter(p => p.godina === Number(this.filterLevoGodina));
    }
    if (this.filterLevoProfesor !== 'svi') {
      filtrirano = filtrirano.filter(p => p.profesor_id === Number(this.filterLevoProfesor));
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

  vidiVisePredmeta() {
    this.prikazaniBrojPredmeta += 10;
  }

  saveDraftSchedule() {
    if (!this.hasUnsavedChanges) return;
    const requests: Observable<any>[] = [];

    if (this.unsavedEvents.length > 0) requests.push(this.http.post(`${this.API_URL}/ispit/bulk`, this.unsavedEvents));
    if (this.modifiedEvents.length > 0) {
      this.modifiedEvents.forEach(evt => requests.push(this.http.put(`${this.API_URL}/ispit/${evt.id}`, evt)));
    }
    if (requests.length === 0) return;

    forkJoin(requests).subscribe({
      next: () => {
        this.toastService.show('Raspored je uspešno sačuvan!', 'success');
        this.unsavedEvents = []; this.modifiedEvents = []; this.hasUnsavedChanges = false;
        this.fetchIspiti(); this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Greška pri čuvanju rasporeda:', err);
        this.toastService.show('Došlo je do greške pri čuvanju.', 'error');
      }
    });
  }

  fetchSviSaradniciIObaveze() {
    forkJoin({ saradnici: this.http.get<any[]>(`${this.API_URL}/profesors`), obaveze: this.http.get<any[]>(`${this.API_URL}/obaveze`) }).subscribe({
      next: ({ saradnici, obaveze }) => { this.sviSaradnici = saradnici; this.sveObaveze = obaveze; }
    });
  }

  ngOnInit(): void {
    this.fetchPredmeti(); this.fetchIspiti(); this.fetchSviSaradniciIObaveze();
    this.fetchStats(); this.fetchUcionice(); this.loadSavedColors();
    
    // --- GLOBALNI OSLUŠKIVAČ (OČIŠĆEN OD DUPLIKATA ZA KRUŽIĆE) ---
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      const editIcon = target.closest('.edit-day-icon');
      if (editIcon) {
        const dateStr = editIcon.getAttribute('data-date');
        if (dateStr) {
          this.ngZone.run(() => {
            this.selektovanDan = dateStr;
            this.danModalPrikaz = 'meni';
            this.prikaziDanModal = true;
            this.cdr.detectChanges();
          });
        }
      }
    });
  }

  ngAfterViewInit(): void { this.initDraggable(); }

  getGodinaColor(godina?: number | string): string {
    if (!godina) return '#34b9f7';
    return this.godinaColors[Number(godina)] || '#34b9f7';
  }

  fetchPredmeti(): void {
    this.http.get<Predmet[]>(`${this.API_URL}/predmet`).subscribe({
      next: (data) => {
        this.predmeti = data.map(p => ({ ...p, profesorImePrezime: p.profesor ? `Prof. ${p.profesor.ime} ${p.profesor.prezime}` : `Šifra: ${p.sifra}` }));
        this.cdr.detectChanges(); this.initDraggable();
      },
      error: (err) => console.error('Greška pri dohvatanju predmeta:', err)
    });
  }

  loadSavedColors(): void {
    const saved = localStorage.getItem('app_godina_colors');
    if (saved) {
      try { this.godinaColors = { ...this.defaultGodinaColors, ...JSON.parse(saved) }; } catch (e) { this.godinaColors = { ...this.defaultGodinaColors }; }
    }
  }

  fetchIspiti(): void {
    forkJoin({ ispiti: this.http.get<any[]>(`${this.API_URL}/ispit`), redovnaNastava: this.http.get<any[]>(`${this.API_URL}/ispit/zauzeti-termini`) }).subscribe({
      next: ({ ispiti, redovnaNastava }) => {
        const ispitEvents = ispiti.map(i => {
          const boja = this.getGodinaColor(i.predmet?.godina);
          const isIspit = i.is_ispit ?? true;
          const salaNaziv = i.sala?.naziv || i.sala || 'Bez sale';
          const formatiranoVreme = i.vreme ? (i.vreme.includes('T') ? i.vreme.substring(11, 16) : i.vreme.substring(0, 5)) : '00:00';
          const formatiranoVremeKraja = i.vreme_kraja ? (i.vreme_kraja.includes('T') ? i.vreme_kraja.substring(11, 16) : i.vreme_kraja.substring(0, 5)) : '';

          return {
            id: i.id.toString(), title: `${i.predmet?.naziv || 'Ispit'} (${salaNaziv})`,
            start: `${i.datum}T${formatiranoVreme}`, end: formatiranoVremeKraja ? `${i.datum}T${formatiranoVremeKraja}` : undefined,
            display: 'block', backgroundColor: isIspit ? boja : '#ffffff', textColor: isIspit ? '#ffffff' : boja, borderColor: boja,
            extendedProps: { vreme: formatiranoVreme, vremeKraja: formatiranoVremeKraja, sala: salaNaziv, predmetId: i.predmet_id, godina: i.predmet?.godina, is_ispit: isIspit, dezurni: i.dezurstva ? i.dezurstva.map((d: any) => d.saradnik) : [] }
          };
        });

        const nastavaEvents: any[] = [];
        if (Array.isArray(redovnaNastava)) {
          redovnaNastava.forEach(cas => {
            const dStr = cas.datum ? cas.datum.split('T')[0] : null;
            if (!dStr) return;
            nastavaEvents.push({
              id: `nastava_${cas.id}`, title: `Nastava: ${cas.predmet} (${cas.sala?.naziv || 'Sala'})`,
              start: `${dStr}T${cas.vreme_pocetka}:00`, end: `${dStr}T${cas.vreme_kraja}:00`, display: 'block',
              backgroundColor: '#f3f4f6', borderColor: '#ef4444', textColor: '#1f2937', editable: false,
              extendedProps: { vreme: cas.vreme_pocetka, vremeKraja: cas.vreme_kraja, sala: cas.sala?.naziv, isNastava: true }
            });
          });
        }

        const sviDogadjaji = [...ispitEvents, ...nastavaEvents];
        this.allLoadedEvents = sviDogadjaji; this.calendarOptions.events = sviDogadjaji;
        this.dostupneSale = [...new Set(ispitEvents.map(e => e.extendedProps.sala).filter(s => s && s !== 'Bez sale'))];
        
        this.applyFilters();
        setTimeout(() => this.detectConflicts(), 200);
      },
      error: (err) => console.error('Greška pri dohvatanju ispita i nastave:', err)
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
          return { title: eventEl.querySelector('h3')?.innerText || 'Nepoznat predmet', backgroundColor: boja, borderColor: boja, extendedProps: { predmetId: id } };
        }
      });
    }
  }

  detectConflicts() {
    if (!this.calendarComponent) return;

    if (!(window as any)._conflictTooltipListener) {
      document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('.conflict-warning')) {
          document.querySelectorAll('.custom-conflict-tooltip').forEach((el: any) => { el.style.setProperty('display', 'none', 'important'); });
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
          const e1 = evts[i]; const e2 = evts[j];
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
              if (dezurni2.some(d2 => d2.id === d1.id)) razlozi.push(`Saradnik ${d1.ime} ${d1.prezime} je duplo angažovan kao dežurni!`);
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
          warning.innerHTML = `<div style="position: relative; display: inline-block;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#f59e0b" style="width: 22px; height: 22px; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.15));">
                <path fill-rule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clip-rule="evenodd" />
              </svg>
              <div class="custom-conflict-tooltip" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: #ffffff; color: #334155; border: 1px solid #cbd5e1; padding: 16px 20px; border-radius: 12px; font-size: 14px; font-weight: 700; line-height: 1.5; white-space: normal; width: max-content; max-width: 320px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 9999px rgba(0, 0, 0, 0.1); z-index: 999999; pointer-events: none; text-align: center;">${conflictsByDate.get(date)!.join('<br><br>')}</div>
            </div>`;
          warning.style.position = 'absolute'; warning.style.top = '4px'; warning.style.left = '4px'; warning.style.cursor = 'pointer'; warning.style.zIndex = '10';

          warning.addEventListener('click', (e) => {
            e.stopPropagation();
            const tooltip = warning.querySelector('.custom-conflict-tooltip') as HTMLElement;
            const isCurrentlyVisible = tooltip.style.display === 'block';
            document.querySelectorAll('.custom-conflict-tooltip').forEach((el: any) => { el.style.setProperty('display', 'none', 'important'); });
            if (!isCurrentlyVisible) tooltip.style.setProperty('display', 'block', 'important');
          });
          let ukupanBrojKonflikata = 0;
          for (const razlozi of conflictsByDate.values()) ukupanBrojKonflikata += razlozi.length;
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
    if (events.length === 0) { alert('Nema ispita na rasporedu za izvoz.'); return; }

    const sorted = [...events].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const weeksMap = new Map<string, Record<number, any[]>>();

    sorted.forEach(evt => {
      const d = new Date(evt.start);
      const dayOfWeek = (d.getDay() + 6) % 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - dayOfWeek);
      const weekKey = monday.toISOString().split('T')[0];
      if (!weeksMap.has(weekKey)) weeksMap.set(weekKey, { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] });
      weeksMap.get(weekKey)![dayOfWeek].push(evt);
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    let htmlContent = `<!DOCTYPE html><html><head><title>Raspored kolokvijuma - PMF Kragujevac</title><style>body { font-family: 'Arial', sans-serif; padding: 20px; color: #1e293b; } h1 { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 5px; } h2 { text-align: center; font-size: 16px; color: #475569; margin-bottom: 25px; } .week-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; page-break-inside: avoid; } .week-table th, .week-table td { border: 1.5px solid #000; width: 14.28%; vertical-align: top; text-align: center; font-size: 12px; } .week-table th { background-color: #e2e8f0; padding: 6px 2px; font-weight: bold; } .date-sub { font-weight: normal; font-size: 11px; display: block; } .exam-box { padding: 6px 4px; margin: 4px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 11px; font-weight: bold; } .exam-time { font-weight: normal; font-size: 10px; color: #334155; margin-top: 2px; } @media print { body { padding: 0; } .no-print { display: none; } }</style></head><body><div class="no-print" style="margin-bottom: 20px; text-align: right;"><button onclick="window.print()" style="padding: 10px 20px; background: #34b9f7; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Štampaj / Snimi u PDF</button></div><h1>Raspored kolokvijuma na OAS Informatika</h1><h2>Fakultet (PMF Kragujevac) - Letnji semestar</h2>`;

    const dayNames = ['ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota', 'nedelja'];

    weeksMap.forEach((days, mondayStr) => {
      const mondayDate = new Date(mondayStr);
      htmlContent += `<table class="week-table"><thead><tr>`;
      for (let i = 0; i < 7; i++) {
        const currentDay = new Date(mondayDate);
        currentDay.setDate(mondayDate.getDate() + i);
        const formatDatum = `${String(currentDay.getDate()).padStart(2, '0')}.${String(currentDay.getMonth() + 1).padStart(2, '0')}.${currentDay.getFullYear()}.`;
        htmlContent += `<th>${dayNames[i]}<span class="date-sub">${formatDatum}</span></th>`;
      }
      htmlContent += `</tr></thead><tbody><tr>`;
      for (let i = 0; i < 7; i++) {
        const dayExams = days[i] || [];
        htmlContent += `<td>`;
        dayExams.forEach(e => {
          const title = e.title.split(' (')[0];
          const sala = e.extendedProps?.sala || '';
          const vreme = e.extendedProps?.vreme || '';
          const isIspit = e.extendedProps?.is_ispit ?? true;
          const tipTekst = isIspit ? '- Ispit -' : '- Kolokvijum -';
          const bg = e.backgroundColor || '#f1f5f9';
          htmlContent += `<div class="exam-box" style="background-color: ${bg}22; border-color: ${bg};">${title}<div class="exam-time">${tipTekst} ${vreme}h (${sala})</div></div>`;
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
    this.http.post(`${this.API_URL}/admin/sync-imi`, {}).subscribe({
      next: (res: any) => { this.toastService.show(res.poruka || 'Sinhronizacija uspešna!', 'success'); },
      error: (err) => { console.error('Greška:', err); this.toastService.show('Došlo je do greške pri sinhronizaciji.', 'error'); }
    });
  }

  objaviRaspored() {
    if (confirm('Da li ste sigurni da želite da objavite raspored? Svi saradnici će od ovog trenutka moći da vide svoja zaduženja na portalu.')) {
      this.http.put(`${this.API_URL}/ispit/publish-all`, {}).subscribe({
        next: (res: any) => { this.toastService.show('Raspored je uspešno objavljen!', 'success'); },
        error: (err) => { console.error('Greška:', err); this.toastService.show('Došlo je do greške pri objavljivanju.', 'error'); }
      });
    }
  }
}