const prisma = require('../db/prisma');
const pod = require('./integracijaPodesavanja');
const { ucitajObjavljeneRezervacije } = require('./rezervacijeSala');

// Slanje rezervacija sistemu fakulteta: svaka rezervacija ide posebnim zahtevom (odgovor se tako odnosi na tačno
// jednu salu i termin), a ishod se upisuje na termine: 'ok' (rezervisano) ili 'greska' sa porukom primaoca.
// Termin bez upisa nije poslat. Izmena termina briše upis, pa se termin šalje ponovo.

const BEZ_SLANJA = { ukljuceno: false, poslato: false, uspesno: 0, ukupno: 0, greska: null };

// paket: rezultat napraviRezervacije (rezervacije imaju nevidljivo polje ispitIds)
const posaljiIZabelezi = async (paket) => {
    const lista = paket?.rezervacije || [];
    if (!lista.length || !(await pod.adresaSlanja())) return BEZ_SLANJA;

    const poIspitu = new Map();
    const greske = [];
    let uspesno = 0;
    for (const r of lista) {
        const ishod = await pod.posaljiRezervacije({ ...paket, rezervacije: [r], bez_sale: [] });
        if (ishod.poslato) uspesno++;
        else greske.push(`${r.sala} ${r.datum} ${r.od}: ${ishod.greska}`);
        (r.ispitIds || []).forEach((id) => {
            const s = poIspitu.get(id) || { ok: true, poruke: [] };
            if (!ishod.poslato) { s.ok = false; s.poruke.push(`${r.sala}: ${ishod.greska}`); }
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
        greska: greske.length ? `${greske.length} od ${lista.length} nije prošlo. ${greske[0]}` : null
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
const posaljiNeposlate = async (objavio = null) => {
    const danas = new Date().toISOString().substring(0, 10);
    const paket = await ucitajObjavljeneRezervacije({ od: danas, objavio });
    const statusi = await statusiRezervacija(paket);
    const za = paket.rezervacije.filter((r) => statusi[r.id]?.status !== 'ok');
    if (!za.length) return { ...BEZ_SLANJA, ukljuceno: Boolean(await pod.adresaSlanja()) };
    return posaljiIZabelezi({ ...paket, rezervacije: za });
};

module.exports = { posaljiIZabelezi, statusiRezervacija, posaljiNeposlate };
