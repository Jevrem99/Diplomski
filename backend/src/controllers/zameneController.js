const prisma = require('../db/prisma');
const { _proveriKonflikte: proveriKonflikte } = require('./ispitController');
const { logAction } = require('../services/auditService');

// Zamena dežurstva: asistent traži zamenu (uz razlog, a može i da predloži kolegu sa istog predmeta),
// a administrator odobrava ili odbija. Asistent nikada ne vidi tuđi raspored - samo imena kolega
// koji su u tom terminu slobodni.

const MIN_RAZLOG = 5;
const MAX_RAZLOG = 300;

const danStr = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : String(d).split('T')[0]);
const vremeStr = (t) => (t instanceof Date ? t.toISOString().substring(11, 16) : String(t).substring(0, 5));

const nadjiMene = (req) =>
    prisma.profesor.findFirst({ where: { email: { equals: req.user.email || '', mode: 'insensitive' } } });

const ucitajDezurstvo = (id) =>
    prisma.dezurstva.findUnique({
        where: { id: Number(id) },
        include: {
            saradnik: true,
            ispit: {
                include: {
                    sala: true,
                    dezurstva: true,
                    predmet: { include: { saradnici: true } }
                }
            }
        }
    });

const terminPocinjeUBuducnosti = (ispit) => {
    const pocetak = new Date(`${danStr(ispit.datum)}T${vremeStr(ispit.vreme)}:00`);
    return pocetak.getTime() > Date.now();
};

const konfliktiZaSaradnika = (dezurstvo, saradnikId) =>
    proveriKonflikte({
        datum: danStr(dezurstvo.ispit.datum),
        vreme: vremeStr(dezurstvo.ispit.vreme),
        vreme_kraja: dezurstvo.ispit.vreme_kraja ? vremeStr(dezurstvo.ispit.vreme_kraja) : null,
        dezurni_ids: [saradnikId],
        sala_id: null,
        excludeIspitId: dezurstvo.ispit.id
    });

// Saradnici istog predmeta koji mogu da preuzmu dežurstvo (isključen je onaj ko ga ima i već raspoređeni na tom ispitu)
const kandidatiZa = async (dezurstvo) => {
    const vecNaIspitu = new Set(dezurstvo.ispit.dezurstva.map((d) => d.saradnik_id));
    const moguci = (dezurstvo.ispit.predmet?.saradnici || []).filter((s) => !vecNaIspitu.has(s.id));
    const rezultat = [];
    for (const s of moguci) {
        const konflikti = await konfliktiZaSaradnika(dezurstvo, s.id);
        rezultat.push({ id: s.id, ime: s.ime, prezime: s.prezime, konflikti: konflikti.map((k) => k.tekst) });
    }
    return rezultat;
};

const uPrikaz = (z) => ({
    id: z.id,
    status: z.status,
    razlog: z.razlog,
    napomena_admina: z.napomena_admina,
    created_at: z.created_at,
    resolved_at: z.resolved_at,
    dezurstvo_id: z.dezurstvo_id,
    trazilac: z.trazilac ? { id: z.trazilac.id, ime: z.trazilac.ime, prezime: z.trazilac.prezime } : null,
    predlozeni: z.predlozeni ? { id: z.predlozeni.id, ime: z.predlozeni.ime, prezime: z.predlozeni.prezime } : null,
    ispit: z.dezurstvo?.ispit
        ? {
            id: z.dezurstvo.ispit.id,
            datum: danStr(z.dezurstvo.ispit.datum),
            vreme: vremeStr(z.dezurstvo.ispit.vreme),
            vreme_kraja: z.dezurstvo.ispit.vreme_kraja ? vremeStr(z.dezurstvo.ispit.vreme_kraja) : null,
            predmet: z.dezurstvo.ispit.predmet?.naziv || '',
            sala: z.dezurstvo.ispit.sala?.naziv || ''
        }
        : null
});

const UKLJUCI_PRIKAZ = {
    trazilac: true,
    predlozeni: true,
    dezurstvo: { include: { ispit: { include: { predmet: true, sala: true } } } }
};

// ---------- asistent ----------

// GET /zamene/kolege/:dezurstvo_id - kolege sa istog predmeta koji su u tom terminu slobodni
const getKolege = async (req, res) => {
    try {
        const ja = await nadjiMene(req);
        const dezurstvo = await ucitajDezurstvo(req.params.dezurstvo_id);
        if (!ja || !dezurstvo || dezurstvo.saradnik_id !== ja.id) {
            return res.status(403).json({ error: 'Ovo dežurstvo nije vaše.' });
        }
        const kandidati = await kandidatiZa(dezurstvo);
        res.json(kandidati.filter((k) => k.konflikti.length === 0).map(({ id, ime, prezime }) => ({ id, ime, prezime })));
    } catch (err) {
        console.error('Greška pri dohvatanju kolega:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

// POST /zamene { dezurstvo_id, razlog, predlozeni_id? }
const napraviZahtev = async (req, res) => {
    try {
        const { dezurstvo_id, razlog, predlozeni_id } = req.body || {};
        const polja = {};
        const cistRazlog = String(razlog || '').trim();
        if (cistRazlog.length < MIN_RAZLOG) polja.razlog = `Navedite razlog (najmanje ${MIN_RAZLOG} karaktera).`;
        if (cistRazlog.length > MAX_RAZLOG) polja.razlog = `Razlog može imati najviše ${MAX_RAZLOG} karaktera.`;
        if (Object.keys(polja).length) return res.status(400).json({ error: 'Neispravni podaci.', polja });

        const ja = await nadjiMene(req);
        const dezurstvo = await ucitajDezurstvo(dezurstvo_id);
        if (!ja) return res.status(403).json({ error: 'Vaš nalog nije povezan sa profilom saradnika.' });
        if (!dezurstvo || dezurstvo.saradnik_id !== ja.id) return res.status(403).json({ error: 'Ovo dežurstvo nije vaše.' });
        if (!dezurstvo.ispit.is_published) return res.status(400).json({ error: 'Termin još nije objavljen.' });
        if (!terminPocinjeUBuducnosti(dezurstvo.ispit)) return res.status(400).json({ error: 'Zamena se ne može tražiti za termin koji je već prošao.' });

        const postoji = await prisma.zahtevZamene.findFirst({ where: { dezurstvo_id: dezurstvo.id, status: 'na_cekanju' } });
        if (postoji) return res.status(409).json({ error: 'Za ovo dežurstvo već postoji zahtev na čekanju.' });

        let predlozeniId = null;
        if (predlozeni_id) {
            const kandidati = await kandidatiZa(dezurstvo);
            const k = kandidati.find((x) => x.id === Number(predlozeni_id));
            if (!k) return res.status(400).json({ error: 'Predloženi kolega ne može da preuzme ovo dežurstvo.' });
            if (k.konflikti.length > 0) return res.status(400).json({ error: 'Predloženi kolega nije slobodan u tom terminu.' });
            predlozeniId = k.id;
        }

        const zahtev = await prisma.zahtevZamene.create({
            data: { dezurstvo_id: dezurstvo.id, trazilac_id: ja.id, predlozeni_id: predlozeniId, razlog: cistRazlog },
            include: UKLJUCI_PRIKAZ
        });
        await logAction(req.user.username, 'CREATE', 'Zahtev za zamenu', `${ja.ime} ${ja.prezime}: „${dezurstvo.ispit.predmet?.naziv || ''}“ ${danStr(dezurstvo.ispit.datum)}`);
        res.status(201).json(uPrikaz(zahtev));
    } catch (err) {
        console.error('Greška pri pravljenju zahteva za zamenu:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

// GET /zamene/moje
const mojiZahtevi = async (req, res) => {
    try {
        const ja = await nadjiMene(req);
        if (!ja) return res.json([]);
        const zahtevi = await prisma.zahtevZamene.findMany({
            where: { trazilac_id: ja.id },
            include: UKLJUCI_PRIKAZ,
            orderBy: { created_at: 'desc' },
            take: 100
        });
        res.json(zahtevi.map(uPrikaz));
    } catch (err) {
        console.error('Greška pri dohvatanju zahteva:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

// DELETE /zamene/:id - asistent povlači svoj zahtev koji je još na čekanju
const otkaziZahtev = async (req, res) => {
    try {
        const ja = await nadjiMene(req);
        const zahtev = await prisma.zahtevZamene.findUnique({ where: { id: Number(req.params.id) } });
        if (!ja || !zahtev || zahtev.trazilac_id !== ja.id) return res.status(403).json({ error: 'Ovo nije vaš zahtev.' });
        if (zahtev.status !== 'na_cekanju') return res.status(400).json({ error: 'Zahtev je već obrađen.' });
        await prisma.zahtevZamene.update({ where: { id: zahtev.id }, data: { status: 'otkazan', resolved_at: new Date() } });
        res.json({ message: 'Zahtev je povučen.' });
    } catch (err) {
        console.error('Greška pri otkazivanju zahteva:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

// ---------- administrator ----------

// GET /zamene?status=na_cekanju
const sviZahtevi = async (req, res) => {
    try {
        const status = ['na_cekanju', 'odobren', 'odbijen', 'otkazan'].includes(req.query.status) ? req.query.status : undefined;
        const zahtevi = await prisma.zahtevZamene.findMany({
            where: status ? { status } : {},
            include: UKLJUCI_PRIKAZ,
            orderBy: { created_at: 'desc' },
            take: 300
        });
        res.json(zahtevi.map(uPrikaz));
    } catch (err) {
        console.error('Greška pri dohvatanju zahteva:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

// GET /zamene/:id/kandidati - ko sve može da preuzme (sa razlozima zašto neko ne može)
const kandidati = async (req, res) => {
    try {
        const zahtev = await prisma.zahtevZamene.findUnique({ where: { id: Number(req.params.id) } });
        if (!zahtev) return res.status(404).json({ error: 'Zahtev nije pronađen.' });
        const dezurstvo = await ucitajDezurstvo(zahtev.dezurstvo_id);
        if (!dezurstvo) return res.status(404).json({ error: 'Dežurstvo više ne postoji.' });
        res.json(await kandidatiZa(dezurstvo));
    } catch (err) {
        console.error('Greška pri dohvatanju kandidata:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

// POST /zamene/:id/odobri { zamena_id }
const odobri = async (req, res) => {
    try {
        const zahtev = await prisma.zahtevZamene.findUnique({ where: { id: Number(req.params.id) }, include: { trazilac: true } });
        if (!zahtev) return res.status(404).json({ error: 'Zahtev nije pronađen.' });
        if (zahtev.status !== 'na_cekanju') return res.status(400).json({ error: 'Zahtev je već obrađen.' });

        const zamenaId = Number(req.body?.zamena_id || zahtev.predlozeni_id);
        if (!Number.isInteger(zamenaId)) return res.status(400).json({ error: 'Izaberite ko preuzima dežurstvo.', polja: { zamena_id: 'Izbor je obavezan.' } });

        const dezurstvo = await ucitajDezurstvo(zahtev.dezurstvo_id);
        if (!dezurstvo) return res.status(404).json({ error: 'Dežurstvo više ne postoji.' });
        if (dezurstvo.saradnik_id !== zahtev.trazilac_id) {
            return res.status(409).json({ error: 'Dežurstvo je u međuvremenu promenjeno. Odbijte zahtev i napravite novu dodelu ručno.' });
        }

        const lista = await kandidatiZa(dezurstvo);
        const izabran = lista.find((k) => k.id === zamenaId);
        if (!izabran) return res.status(400).json({ error: 'Izabrani saradnik nije na ovom predmetu ili je već na ovom ispitu.' });
        if (izabran.konflikti.length > 0 && req.query.force !== '1') {
            return res.status(409).json({ error: 'Konflikt u rasporedu', poruke: izabran.konflikti });
        }

        await prisma.$transaction([
            prisma.dezurstva.update({ where: { id: dezurstvo.id }, data: { saradnik_id: zamenaId } }),
            prisma.zahtevZamene.update({
                where: { id: zahtev.id },
                data: { status: 'odobren', predlozeni_id: zamenaId, resolved_at: new Date(), napomena_admina: req.body?.napomena ? String(req.body.napomena).slice(0, 300) : null }
            })
        ]);
        await logAction(req.user.username, 'SWAP', 'Dežurstvo', `${zahtev.trazilac.ime} ${zahtev.trazilac.prezime} → ${izabran.ime} ${izabran.prezime} („${dezurstvo.ispit.predmet?.naziv || ''}“ ${danStr(dezurstvo.ispit.datum)})`);
        res.json({ message: 'Zamena je odobrena.' });
    } catch (err) {
        console.error('Greška pri odobravanju zamene:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

// POST /zamene/:id/odbij { napomena? }
const odbij = async (req, res) => {
    try {
        const zahtev = await prisma.zahtevZamene.findUnique({ where: { id: Number(req.params.id) } });
        if (!zahtev) return res.status(404).json({ error: 'Zahtev nije pronađen.' });
        if (zahtev.status !== 'na_cekanju') return res.status(400).json({ error: 'Zahtev je već obrađen.' });
        await prisma.zahtevZamene.update({
            where: { id: zahtev.id },
            data: { status: 'odbijen', resolved_at: new Date(), napomena_admina: req.body?.napomena ? String(req.body.napomena).slice(0, 300) : null }
        });
        await logAction(req.user.username, 'REJECT', 'Zahtev za zamenu', `Zahtev ID ${zahtev.id} odbijen`);
        res.json({ message: 'Zahtev je odbijen.' });
    } catch (err) {
        console.error('Greška pri odbijanju zahteva:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

module.exports = { getKolege, napraviZahtev, mojiZahtevi, otkaziZahtev, sviZahtevi, kandidati, odobri, odbij };
