import { Injectable, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { ExportDataResult } from '../../../shared/components/export-modal/export-modal.component';
import { Predmet } from '../main.models';

// Pravi Excel fajlove rasporeda (ispiti i kolokvijumi). Ne zavisi od komponente: sve što mu treba dobija kao argumente.
@Injectable({ providedIn: 'root' })
export class ExcelIzvozService {
  private toast = inject(ToastService);

  async generisiIspite(podaci: ExportDataResult, events: any[], predmeti: Predmet[]): Promise<void> {
    const XLSX = await import('xlsx-js-style');
    const rokovi = podaci.rokovi || [];
    if (rokovi.length === 0) {
      this.toast.show('Niste uneli nijedan ispitni rok!', 'error');
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

    const ispitiDogadjaji = events.filter((e: any) => {
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
    predmeti.forEach(predmet => {
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
    this.toast.show('Excel tabela ispita je uspešno generisana!', 'success');
  }

  async generisiKolokvijume(podaci: ExportDataResult, events: any[], predmeti: Predmet[]): Promise<void> {
    const XLSX = await import('xlsx-js-style');

    if (!podaci.datumOd || !podaci.datumDo) {
      this.toast.show('Izaberite oba datuma!', 'error');
      return;
    }
    const tip = podaci.tip;
    const dOd = new Date(podaci.datumOd).getTime();
    const dDo = new Date(podaci.datumDo).getTime();

    const ispitiUPeriodu = events.filter((e: any) => {
      const isIspitEvent = e.extendedProps?.is_ispit ?? true;
      if (podaci.tip === 'ispiti' && !isIspitEvent) return false;
      if (podaci.tip === 'kolokvijumi' && isIspitEvent) return false;
      if (e.extendedProps?.isNastava) return false;

      const evtStartStr = e.start.split('T')[0];
      const evtDatumMs = new Date(evtStartStr).getTime();
      return evtDatumMs >= dOd && evtDatumMs <= dDo;
    });

    if (ispitiUPeriodu.length === 0) {
      this.toast.show('Nema zakazanih termina u izabranom periodu.', 'error');
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
    const naslovZaPrikaz = podaci.naslovRasporeda || 'Распоред';
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
    this.toast.show('Excel fajl je uspešno generisan!', 'success');
  }
}
