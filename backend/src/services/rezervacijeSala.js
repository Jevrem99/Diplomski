// Izvoz rezervacija sala za kolokvijume (JSON koji administrator fakulteta uvozi da rezerviše učionice).
// Samo kolokvijumi: ispite rezerviše sama služba fakulteta, pa ih ovde nema.
//
// Oblik fajla (verzija 1):
// {
//   "format": "raspored-rezervacije-sala", "verzija": 1, "generisano": "<ISO vreme>", "objavio": "<korisnik>",
//   "rezervacije": [{
//     "id": "kol-123",               stalan ključ (id termina): ponovni uvoz ažurira istu rezervaciju
//     "izmena": false,               true = termin je posle prethodne objave pomeren / izmenjen
//     "sala": "A-0-15", "datum": "2026-10-28", "od": "13:00", "do": "15:00",
//     "do_pretpostavljen": false,    true = kraj nije unet, uzeto je trajanje od 2 sata
//     "namena": "Kolokvijum", "tip": "I", "tip_opis": "I колоквијум",
//     "racunarska_sala": false,      saradnik je tražio računarsku salu
//     "predmeti": [{ "sifra": "...", "naziv": "...", "godina": 1, "nosilac": "Ime Prezime", "broj_studenata": 80 }],
//     "ukupno_studenata": 80
//   }],
//   "bez_sale": [{ "id": "kol-124", "datum": "...", "od": "...", "naziv": "..." }]   termini bez izabrane sale
// }
// Termini iste grupe predmeta (isti dan, vreme i sala) čine JEDNU rezervaciju sa više predmeta.

const DEFAULT_TRAJANJE_MIN = 120;

// Vreme termina stiže iz baze kao Date (1970-01-01T..Z) ili kao tekst "07:30:00" / "...T07:30:00": oba se čitaju
const hhmm = (v) => {
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().substring(11, 16);
    const m = String(v ?? '').match(/(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};
const dan = (d) => (d instanceof Date ? d.toISOString().substring(0, 10) : String(d).split('T')[0]);

const dodajMinute = (vreme, min) => {
    const [h, m] = vreme.split(':').map(Number);
    const ukupno = Math.min(h * 60 + m + min, 23 * 60 + 59);
    return `${String(Math.floor(ukupno / 60)).padStart(2, '0')}:${String(ukupno % 60).padStart(2, '0')}`;
};

// I -> k1, II -> k2, III -> k3, "popravni" -> popravni (isto pravilo kao u tabeli dežurstava)
const trazenaRacunarskaSala = (ispit) => {
    const t = ispit.predmet?.terminiKolokvijuma;
    if (!t) return false;
    const tip = String(ispit.tip_kolokvijuma || 'I').trim().toLowerCase();
    if (tip.includes('поправни') || tip.includes('popravni')) return Boolean(t.popravni_racunarska_sala);
    if (tip === 'iii') return Boolean(t.k3_racunarska_sala);
    if (tip === 'ii') return Boolean(t.k2_racunarska_sala);
    if (tip === 'i') return Boolean(t.k1_racunarska_sala);
    return false;
};

const opisTipa = (ispit) => {
    const tip = String(ispit.tip_kolokvijuma || 'I').trim();
    const l = tip.toLowerCase();
    if (l === 'тест' || l === 'test') return 'тест';
    if (l.includes('тест') || l.includes('test')) return 'поправни тест';
    if (l.includes('поправни') || l.includes('popravni')) return 'поправни колоквијум';
    return `${tip} колоквијум`;
};

// ispiti: zapisi iz baze sa include { predmet: { include: { profesor, terminiKolokvijuma } }, sala }
const napraviRezervacije = (ispiti, { objavio = null, sada = new Date() } = {}) => {
    const kolokvijumi = ispiti.filter((i) => i && i.is_ispit === false);
    const poKljucu = new Map();
    const bezSale = [];

    kolokvijumi
        .slice()
        .sort((a, b) => dan(a.datum).localeCompare(dan(b.datum)) || String(hhmm(a.vreme)).localeCompare(String(hhmm(b.vreme))))
        .forEach((i) => {
            const od = hhmm(i.vreme);
            const naziv = i.predmet?.naziv || 'Kolokvijum';
            if (!i.sala?.naziv) {
                bezSale.push({ id: `kol-${i.id}`, datum: dan(i.datum), od, naziv });
                return;
            }
            const kraj = hhmm(i.vreme_kraja);
            const doVreme = kraj || (od ? dodajMinute(od, DEFAULT_TRAJANJE_MIN) : null);
            const kljuc = [i.sala.naziv, dan(i.datum), od, doVreme, i.tip_kolokvijuma || 'I', i.grupa_kljuc || `bez-grupe-${i.id}`].join('|');
            const predmet = {
                sifra: i.predmet?.sifra || null,
                naziv,
                godina: i.predmet?.godina ?? null,
                nosilac: i.predmet?.profesor ? `${i.predmet.profesor.ime} ${i.predmet.profesor.prezime}` : null,
                broj_studenata: i.predmet?.broj_studenata ?? 0
            };
            const postojeca = poKljucu.get(kljuc);
            if (postojeca) {
                postojeca.predmeti.push(predmet);
                postojeca.izmena = postojeca.izmena || Boolean(i.is_izmenjen);
                postojeca.racunarska_sala = postojeca.racunarska_sala || trazenaRacunarskaSala(i);
                return;
            }
            poKljucu.set(kljuc, {
                id: `kol-${i.id}`,
                izmena: Boolean(i.is_izmenjen),
                sala: i.sala.naziv,
                datum: dan(i.datum),
                od,
                do: doVreme,
                do_pretpostavljen: !kraj,
                namena: 'Kolokvijum',
                tip: String(i.tip_kolokvijuma || 'I'),
                tip_opis: opisTipa(i),
                racunarska_sala: trazenaRacunarskaSala(i),
                predmeti: [predmet]
            });
        });

    const rezervacije = [...poKljucu.values()].map((r) => ({
        ...r,
        ukupno_studenata: r.predmeti.reduce((zbir, p) => zbir + (p.broj_studenata || 0), 0)
    }));

    return {
        format: 'raspored-rezervacije-sala',
        verzija: 1,
        generisano: sada.toISOString(),
        objavio,
        rezervacije,
        bez_sale: bezSale
    };
};

module.exports = { napraviRezervacije, hhmm, _internal: { trazenaRacunarskaSala, opisTipa, dodajMinute } };
