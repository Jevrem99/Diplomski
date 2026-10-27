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

// Briše u sistemu fakulteta naše rezervacije u kojima učestvuje neki od ovih termina; zadrzi(red) = true ostavlja red
// (npr. sala koja je već rezervisana i ne šalje se ponovo). Vraća id-jeve OSTALIH termina iz obrisanih rezervacija
// (njih treba ponovo rezervisati) i upozorenja.
const otkaziZaIspite = async (ispitIds, zadrzi = () => false) => {
    const ids = [...new Set((ispitIds || []).map(Number).filter(Boolean))];
    if (!ids.length) return { ostali: [], upozorenja: [] };
    const redovi = (await prisma.rezervacijaFakulteta.findMany({ where: { ispiti: { hasSome: ids } } })).filter((red) => !zadrzi(red));
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

// Rezervacija je ista kao zapamćeni red ako su sala, datum i vreme isti
const istiTermin = (red, r) => red.kljuc === r.id && red.sala === r.sala && red.datum === r.datum && red.vreme_od === r.od && red.vreme_do === r.do;

// paket: rezultat napraviRezervacije (rezervacije imaju nevidljivo polje ispitIds); korisnik: ko objavljuje.
// sve: sve trenutne rezervacije tih termina (kad se šalje samo deo, npr. neposlate); podrazumevano = paket.
const posaljiIZabelezi = async (paket, korisnik = null, sve = null) => {
    const lista = paket?.rezervacije || [];
    const cfg = await pod.podesavanjaSlanja();
    if (!lista.length || !cfg.url) return BEZ_SLANJA;
    const identitet = await odrediRezervisao(korisnik, cfg.username);

    // Prvo se brišu zapamćene rezervacije ovih termina koje se šalju ponovo ili više ne važe (izmenjen termin,
    // uklonjena sala); rezervisane sale koje se ne šalju ostaju netaknute
    const kljuceviSlanja = new Set(lista.map((r) => r.id));
    const vazece = sve || lista;
    const { upozorenja } = await otkaziZaIspite(
        lista.flatMap((r) => r.ispitIds || []),
        (red) => !kljuceviSlanja.has(red.kljuc) && vazece.some((r) => istiTermin(red, r))
    );

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

    // Sale termina koje su ranije rezervisane, a sada se nisu slale, ne kvare status termina
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

// Status po sali (za pregled): 'ok' ako postoji zapamćena rezervacija fakulteta za tu salu i termin; 'greska' ako je
// sala odbijena (poruka samo za tu salu); inače 'neposlato'
const statusiRezervacija = async (paket) => {
    const lista = paket.rezervacije || [];
    const ids = [...new Set(lista.flatMap((r) => r.ispitIds || []))];
    const [ispiti, redovi] = ids.length
        ? await Promise.all([
            prisma.ispit.findMany({ where: { id: { in: ids } }, select: { id: true, rezervacija_status: true, rezervacija_poruka: true } }),
            prisma.rezervacijaFakulteta.findMany({ where: { kljuc: { in: lista.map((r) => r.id) } } })
        ])
        : [[], []];
    const poId = new Map(ispiti.map((i) => [i.id, i]));
    const statusi = {};
    for (const r of lista) {
        const red = redovi.find((x) => istiTermin(x, r));
        if (red) { statusi[r.id] = { status: 'ok', idRezervacije: red.id_rezervacije }; continue; }
        const poruke = (r.ispitIds || [])
            .map((id) => poId.get(id))
            .filter((s) => s && s.rezervacija_status === 'greska')
            .flatMap((s) => String(s.rezervacija_poruka || '').split(' | '))
            .filter((p) => p.startsWith(`${r.sala}: `))
            .map((p) => p.slice(r.sala.length + 2));
        statusi[r.id] = poruke.length ? { status: 'greska', poruka: [...new Set(poruke)].join(' | ') } : { status: 'neposlato' };
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
    return posaljiIZabelezi({ ...paket, rezervacije: za }, korisnik, paket.rezervacije);
};

module.exports = {
    posaljiIZabelezi, statusiRezervacija, posaljiNeposlate, otkaziZaIspite,
    _internal: { idProstorije, zahtevZaRezervaciju }
};
