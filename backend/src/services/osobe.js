const prisma = require('../db/prisma');
const { kljucNaziva } = require('../utils/tekst');

// Ista osoba se u bazi može naći pod različitim zapisom imena: iz Excel tabele ćirilicom ("Ненад Стојановић"),
// iz PMF prijave latinicom, ponekad bez dijakritika ("Nenad Stojanovic"). Ključ poredi reči imena bez obzira na
// pismo, dijakritike, velika slova i redosled (ime prezime / prezime ime).
const kljucOsobe = (ime, prezime) => kljucNaziva(`${ime || ''} ${prezime || ''}`).split(' ').filter(Boolean).sort().join(' ');

// Sve osobe sa istim ključem imena
const nadjiPoImenu = async (ime, prezime) => {
    const k = kljucOsobe(ime, prezime);
    if (!k || !k.includes(' ')) return []; // samo jedno ime je premalo za sigurno poklapanje
    const sve = await prisma.profesor.findMany();
    return sve.filter((o) => kljucOsobe(o.ime, o.prezime) === k);
};

// Grupe verovatnih duplikata (isti ključ imena), sa onim što je vezano za svaku osobu
const grupeDuplikata = async () => {
    const osobe = await prisma.profesor.findMany({
        include: { _count: { select: { dezurstva: true, predmeti: true, angazovanja: true, obaveze: true } } },
        orderBy: { id: 'asc' }
    });
    const poKljucu = new Map();
    for (const o of osobe) {
        const k = kljucOsobe(o.ime, o.prezime);
        if (!k) continue;
        if (!poKljucu.has(k)) poKljucu.set(k, []);
        poKljucu.get(k).push(o);
    }
    const emailovi = osobe.map((o) => o.email).filter(Boolean);
    const nalozi = emailovi.length
        ? await prisma.user.findMany({ where: { email: { in: emailovi, mode: 'insensitive' } }, select: { username: true, email: true, uloga: true } })
        : [];
    const nalogZa = (email) => nalozi.find((n) => email && n.email.toLowerCase() === email.toLowerCase()) || null;
    return [...poKljucu.values()]
        .filter((g) => g.length > 1)
        .map((g) => g.map((o) => ({
            id: o.id, ime: o.ime, prezime: o.prezime, email: o.email || null, is_saradnik: o.is_saradnik,
            dezurstva: o._count.dezurstva, predmeti: o._count.predmeti, angazovanja: o._count.angazovanja, obaveze: o._count.obaveze,
            nalog: nalogZa(o.email)
        })));
};

// Spaja osobu "spoji" u osobu "zadrzi": sve veze prelaze na nju, pa se duplikat briše (sve ili ništa)
const spojiOsobe = async (zadrziId, spojiId) => {
    if (!Number.isInteger(zadrziId) || !Number.isInteger(spojiId) || zadrziId === spojiId) throw new Error('Izaberite dve različite osobe.');
    return prisma.$transaction(async (tx) => {
        const zadrzi = await tx.profesor.findUnique({ where: { id: zadrziId } });
        const spoji = await tx.profesor.findUnique({ where: { id: spojiId }, include: { angazovanja: { select: { id: true } } } });
        if (!zadrzi || !spoji) throw new Error('Osoba ne postoji.');

        // dežurstva: isti termin dva puta se ne prenosi
        const vec = new Set((await tx.dezurstva.findMany({ where: { saradnik_id: zadrziId }, select: { ispit_id: true } })).map((d) => d.ispit_id));
        const njegova = await tx.dezurstva.findMany({ where: { saradnik_id: spojiId } });
        let prenetoDezurstava = 0;
        for (const d of njegova) {
            if (vec.has(d.ispit_id)) await tx.dezurstva.delete({ where: { id: d.id } });
            else { await tx.dezurstva.update({ where: { id: d.id }, data: { saradnik_id: zadrziId } }); prenetoDezurstava++; }
        }
        const predmeti = await tx.predmet.updateMany({ where: { profesor_id: spojiId }, data: { profesor_id: zadrziId } });
        for (const p of spoji.angazovanja) {
            await tx.predmet.update({ where: { id: p.id }, data: { saradnici: { disconnect: { id: spojiId }, connect: { id: zadrziId } } } });
        }
        await tx.obaveza.updateMany({ where: { saradnik_id: spojiId }, data: { saradnik_id: zadrziId } });
        await tx.zahtevZamene.updateMany({ where: { trazilac_id: spojiId }, data: { trazilac_id: zadrziId } });
        await tx.zahtevZamene.updateMany({ where: { predlozeni_id: spojiId }, data: { predlozeni_id: zadrziId } });

        // e-mail (veza sa nalogom za prijavu) prelazi ako ga zadržana osoba nema
        const email = zadrzi.email || spoji.email || null;
        await tx.profesor.update({ where: { id: zadrziId }, data: { email } });
        await tx.profesor.delete({ where: { id: spojiId } });
        return {
            zadrzana: `${zadrzi.ime} ${zadrzi.prezime}`,
            email,
            preneto: { dezurstva: prenetoDezurstava, predmeti: predmeti.count, angazovanja: spoji.angazovanja.length },
            drugiEmail: zadrzi.email && spoji.email && zadrzi.email.toLowerCase() !== spoji.email.toLowerCase() ? spoji.email : null
        };
    });
};

module.exports = { kljucOsobe, nadjiPoImenu, grupeDuplikata, spojiOsobe };
