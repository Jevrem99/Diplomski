import { CalendarOptions } from '@fullcalendar/core';

// Nazivi na srpskom (na jednom mestu)
export const MESECI = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar'];
export const DANI_KRATKO = ['Ned', 'Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub'];
export const DANI_PUNO = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota'];

// Podešavanja kalendara koja ne zavise od stanja stranice (naslovi, zaglavlja dana, dugmad)
export const KALENDAR_STATICKA_PODESAVANJA: Partial<CalendarOptions> = {
  // Dani prethodnog/sledećeg meseca se ne prikazuju (ni ne crtaju njihovi termini): brži kalendar
  showNonCurrentDates: false,
  fixedWeekCount: false,
  // Srpski za sve što FullCalendar sam ispisuje (opisi dugmadi, nazivi dana za čitače ekrana, sati u nedeljnom prikazu)
  locale: 'sr-Latn',
  allDayText: 'Ceo dan',
  buttonHints: { prev: 'Prethodni period', next: 'Sledeći period', today: 'Idi na današnji dan' },
  viewHint: (naziv: string) => `Prikaz: ${naziv}`,
  navLinkHint: 'Idi na $0',
  moreLinkHint: (n: number) => `Prikaži još ${n}`,
  closeHint: 'Zatvori',
  timeHint: 'Vreme',
  eventHint: 'Termin',
  titleFormat: (arg) => `${MESECI[arg.date.month]} ${arg.date.year}.`,
  dayHeaderContent: (arg) => DANI_KRATKO[arg.date.getDay()],
  views: {
    timeGridWeek: {
      dayHeaderContent: (arg) => {
        const d = arg.date;
        return `${DANI_KRATKO[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
      }
    },
    timeGridDay: {
      dayHeaderContent: (arg) => {
        const d = arg.date;
        return `${DANI_PUNO[d.getDay()]}, ${d.getDate()}. ${MESECI[d.getMonth()]}`;
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
