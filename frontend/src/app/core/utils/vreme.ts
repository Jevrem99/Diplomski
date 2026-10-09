// Zajednička pravila za trajanje termina i granice semestra (kalendar, prozor termina, pregled zaduženja)

export const PODRAZUMEVANO_TRAJANJE_SATI = 2;

// "09:30", "09:30:00" ili "…T09:30:00" -> minuti od ponoći (null ako nije vreme)
export function uMinute(v?: string | null): number | null {
  const m = String(v ?? '').match(/(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Trajanje termina u satima; bez kraja (ili sa krajem pre početka) računa se podrazumevano trajanje
export function trajanjeUSatima(vreme?: string | null, kraj?: string | null): number {
  const a = uMinute(vreme);
  const b = uMinute(kraj);
  if (a === null || b === null || b <= a) return PODRAZUMEVANO_TRAJANJE_SATI;
  return (b - a) / 60;
}

// Semestar kome pripada datum: zimski (1. oktobar – kraj februara) ili letnji (1. mart – 30. septembar).
// Granice su "GGGG-MM-DD", obe uključene, pa se porede kao običan tekst.
export function semestarOpseg(datum: string): { od: string; do: string; zimski: boolean } {
  const [g, m] = String(datum).split('T')[0].split('-').map(Number);
  if (m >= 10) return { od: `${g}-10-01`, do: `${g + 1}-02-29`, zimski: true };
  if (m <= 2) return { od: `${g - 1}-10-01`, do: `${g}-02-29`, zimski: true };
  return { od: `${g}-03-01`, do: `${g}-09-30`, zimski: false };
}

// 12.5 -> "12,5"; 12 -> "12"
export function formatSati(n: number): string {
  const z = Math.round(n * 100) / 100;
  return (Number.isInteger(z) ? String(z) : z.toFixed(z * 10 % 1 === 0 ? 1 : 2)).replace('.', ',');
}
