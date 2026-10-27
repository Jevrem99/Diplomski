const prisma = require('../db/prisma');
const pod = require('./integracijaPodesavanja');
const { ucitajObjavljeneRezervacije } = require('./rezervacijeSala');
const { kljucNaziva } = require('../utils/tekst');

// Rezervacija sala u sistemu fakulteta (IMI, kolokvijumi.php):
//  - svaka sala u terminu je jedan zahtev { password, termin: { datum, vreme_od, trajanje_minuta, idProstorije },
//    rezervisao, username, naziv }; uspeh je { status: "uspeh", idRezervacije }, greška { status: "greska", poruka }
//  - idRezervacije se čuva (tabela RezervacijaFakulteta), da bi se rezervacija mogla obrisati
//    ({ password, akcija: "obrisi", idRezervacije }) kad se termin izmeni ili obriše
//  - ishod se upisuje na termine: rezervacija_status 'ok' | 'greska' (null = nije poslato)

// Oznake prostorija u sistemu fakulteta (prema IMI-ju); naziv se poredi bez obzira na pismo i velika slova
const PROSTORIJE = new Map([
    ['a ii 1', 1], ['a ii 24r', 3], ['a ii 20', 20], ['a ii 21', 21], ['a ii 24', 24], ['a ii 25', 25], ['a ii 28', 28],
    ['a 0 3', 101], ['fizika', 102], ['a 0 15', 103], ['svecana sala', 104]
]);
const idProstorije = (naziv) => {
    const k = kljucNaziva(naziv);
    if (PROSTORIJE.has(k)) return PROSTORIJE.get(k);
    if (k.startsWith('fizika')) return 102; // "Физика Рачунарска" je kod IMI-ja "fizika"
    return null;
};

const minuta = (hhmm) => { const [h, m] = String(hhmm || '').split(':').map(Number); return h * 60 + (m || 0); };

// Telo zahteva za jednu rezervaciju (r: element iz napraviRezervacije)
const zahtevZaRezervaciju = (r, { lozinka, username, rezervisao }) => ({
    password: lozinka,
    termin: {
        datum: r.datum,
        vreme_od: r.od,
        trajanje_minuta: Math.max(minuta(r.do) - minuta(r.od), 15),
        idProstorije: idProstorije(r.sala)
    },
    rezervisao,
    username,
    naziv: `${r.tip_opis} – ${(r.predmeti || []).map((p) => p.naziv).join(', ')}`.slice(0, 200)
});

// Ko rezerviše: IMI nalog iz podešavanja ili korisnik koji objavljuje; ime iz spiska nastavnika/saradnika
const odrediRezervisao = async (korisnik, usernameIzPodesavanja) => {
    const username = usernameIzPodesavanja || korisnik?.username || 'admin';
    const user = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } }, select: { email: true } });
    const osoba = user?.email ? await prisma.profesor.findFirst({ where: { email: { equals: user.email, mode: 'insensitive' } } }) : null;
    const ime = osoba ? `${osoba.ime} ${osoba.prezime}`.trim() : '';
    return { username, rezervisao: ime || username };
};

// Briše u sistemu fakulteta sve naše rezervacije u kojima učestvuje neki od ovih termina.
// Vraća id-jeve OSTALIH termina iz tih rezervacija (njih treba ponovo rezervisati) i upozorenja.
const otkaziZaIspite = async (ispitIds) => {
    const ids = [...new Set((ispitIds || []).map(Number).filter(Boolean))];
    if (!ids.length) return { ostali: [], upozorenja: [] };
    const redovi = await prisma.rezervacijaFakulteta.findMany({ where: { ispiti: { hasSome: ids } } });
    if (!redovi.length) return { ostali: [], upozorenja: [] };
    const { lozinka } = await pod.podesavanjaSlanja();
    const upozorenja = [];
    const ostali = new Set();
    for (const red of redovi) {
        const odgovor = await pod.posaljiJson({ password: lozinka, akcija: 'obrisi', idRezervacije: red.id_rezervacije });
        const ocena = pod.oceniOdgovor(odgovor.httpStatus, odgovor.telo);
        if (!ocena.poslato) upozorenja.push(`Brisanje rezervacije ${red.id_rezervacije} (${red.sala} ${red.datum} ${red.vreme_od}): ${odgovor.greska || ocena.greska}`);
        await prisma.rezervacijaFakulteta.delete({ where: { id: red.id } });
        red.ispiti.filter((x) => !ids.includes(x)).forEach((x) => ostali.add(x));
    }
    if (ostali.size) {
        await prisma.ispit.updateMany({ where: { id: { in: [...ostali] } }, data: { rezervacija_status: null, rezervacija_poruka: null, rezervacija_vreme: null } });
    }
    return { ostali: [...ostali], upozorenja };
};

const BEZ_SLANJA = { ukljuceno: false, poslato: false, uspesno: 0, ukupno: 0, greska: null };

// paket: rezultat napraviRezervacije (rezervacije imaju nevidljivo polje ispitIds); korisnik: ko objavljuje
const posaljiIZabelezi = async (paket, korisnik = null) => {
    const lista = paket?.rezervacije || [];
    const cfg = await pod.podesavanjaSlanja();
    if (!lista.length || !cfg.url) return BEZ_SLANJA;
    const identitet = await odrediRezervisao(korisnik, cfg.username);

    // Stare rezervacije ovih termina (npr. pre izmene vremena ili sale) se prvo brišu, pa se prave nove
    const { upozorenja } = await otkaziZaIspite(lista.flatMap((r) => r.ispitIds || []));

    const poIspitu = new Map();
    const greske = [];
    let uspesno = 0;
    for (const r of lista) {
        let ocena;
        if (!idProstorije(r.sala)) {
            ocena = { poslato: false, greska: `Sala ${r.sala} nema oznaku u sistemu fakulteta.` };
        } else {
            const odgovor = await pod.posaljiJson(zahtevZaRezervaciju(r, { lozinka: cfg.lozinka, ...identitet }));
            ocena = odgovor.greska ? { poslato: false, greska: odgovor.greska } : pod.oceniOdgovor(odgovor.httpStatus, odgovor.telo);
        }
        if (ocena.poslato) {
            uspesno++;
            await prisma.rezervacijaFakulteta.create({
                data: { kljuc: r.id, id_rezervacije: Number(ocena.idRezervacije) || 0, ispiti: r.ispitIds || [], sala: r.sala, datum: r.datum, vreme_od: r.od, vreme_do: r.do }
            });
        } else {
            greske.push(`${r.sala} ${r.datum} ${r.od}: ${ocena.greska}`);
        }
        (r.ispitIds || []).forEach((id) => {
            const s = poIspitu.get(id) || { ok: true, poruke: [] };
            if (!ocena.poslato) { s.ok = false; s.poruke.push(`${r.sala}: ${ocena.greska}`); }
            poIspitu.set(id, s);
        });
    }

    const sada = new Date();
    for (const [id, s] of poIspitu) {
        await prisma.ispit.update({
            where: { id },
            data: {
                rezervacija_status: s.ok ? 'ok' : 'greska',
                rezervacija_poruka: s.ok ? null : s.poruke.join(' | ').slice(0, 1000),
                rezervacija_vreme: sada
            }
        });
    }

    return {
        ukljuceno: true,
        poslato: greske.length === 0,
        uspesno,
        ukupno: lista.length,
        greska: greske.length ? `${greske.length} od ${lista.length} nije prošlo. ${greske[0]}` : null,
        upozorenja
    };
};

// Status slanja po rezervaciji (za pregled): 'ok' ako su svi termini rezervisani, 'greska' ako je bar jedan
// odbijen, inače 'neposlato'
const statusiRezervacija = async (paket) => {
    const ids = [...new Set((paket.rezervacije || []).flatMap((r) => r.ispitIds || []))];
    const ispiti = ids.length
        ? await prisma.ispit.findMany({ where: { id: { in: ids } }, select: { id: true, rezervacija_status: true, rezervacija_poruka: true } })
        : [];
    const poId = new Map(ispiti.map((i) => [i.id, i]));
    const statusi = {};
    for (const r of paket.rezervacije || []) {
        const stanja = (r.ispitIds || []).map((id) => poId.get(id)).filter(Boolean);
        const losi = stanja.find((s) => s.rezervacija_status === 'greska');
        if (losi) statusi[r.id] = { status: 'greska', poruka: losi.rezervacija_poruka };
        else if (stanja.length && stanja.every((s) => s.rezervacija_status === 'ok')) statusi[r.id] = { status: 'ok' };
        else statusi[r.id] = { status: 'neposlato' };
    }
    return statusi;
};

// Ponovo šalje sve objavljene kolokvijume od danas koji još nisu rezervisani (neposlati ili odbijeni)
const posaljiNeposlate = async (korisnik = null) => {
    const danas = new Date().toISOString().substring(0, 10);
    const paket = await ucitajObjavljeneRezervacije({ od: danas, objavio: korisnik?.username || null });
    const statusi = await statusiRezervacija(paket);
    const za = paket.rezervacije.filter((r) => statusi[r.id]?.status !== 'ok');
    if (!za.length) return { ...BEZ_SLANJA, ukljuceno: Boolean((await pod.podesavanjaSlanja()).url) };
    return posaljiIZabelezi({ ...paket, rezervacije: za }, korisnik);
};

module.exports = {
    posaljiIZabelezi, statusiRezervacija, posaljiNeposlate, otkaziZaIspite,
    _internal: { idProstorije, zahtevZaRezervaciju }
};
