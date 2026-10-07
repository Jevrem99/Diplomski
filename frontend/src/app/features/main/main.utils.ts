// Pomoćne funkcije glavne stranice

// Čirilica/dijakritici -> latinica bez dijakritika, mala slova (za pretragu)
export function presloviULatinicu(tekst: string): string {
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

// "2026-04-15" -> "sreda, 15.04.2026."
export function formatDatumKonflikta(datum: string): string {
  const d = new Date(`${datum}T12:00:00`);
  if (isNaN(d.getTime())) return datum;
  const dani = ['nedelja', 'ponedeljak', 'utorak', 'sreda', 'četvrtak', 'petak', 'subota'];
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dani[d.getDay()]}, ${dd}.${mm}.${d.getFullYear()}.`;
}

// Vrsta konflikta (za bojenje u prozoru)
export function tipKonflikta(tekst: string): 'sala' | 'dezurni' | 'odsustvo' {
  if (/^Sala\b/.test(tekst)) return 'sala';
  if (/odsutan/.test(tekst)) return 'odsustvo';
  return 'dezurni';
}

// "09:30" -> 570 (minuta od ponoći); prazno/neispravno -> 0
export function timeToMins(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + m;
}


// Boja teksta koja se čita na zadatoj pozadini: tamna na svetlim bojama, bela na tamnim
export function bojaTeksta(hex: string): { ink: string; chip: string } {
  const h = (hex || '').replace('#', '');
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(v.substring(0, 2), 16), g = parseInt(v.substring(2, 4), 16), b = parseInt(v.substring(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6
    ? { ink: '#1f2937', chip: 'rgba(0, 0, 0, 0.13)' }
    : { ink: '#ffffff', chip: 'rgba(0, 0, 0, 0.25)' };
}
