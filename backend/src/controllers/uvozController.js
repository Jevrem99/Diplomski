const prisma = require('../db/prisma');
const uvoz = require('../services/uvozRasporeda');
const { jeDatum } = require('../services/rezervacijeSala');
const { logAction } = require('../services/auditService');

const korisnik = (req) => req.user?.username || 'Administrator';

// Godina za datume bez godine ("26.09.") iz ispitne tabele
const godinaIzUpita = (req) => {
    const g = Number(req.query.godina);
    return Number.isInteger(g) && g >= 2000 && g <= 2100 ? g : new Date().getFullYear();
};

// POST /ispit/uvoz/pregled (fajl .xlsx ili .json): ništa ne upisuje, vraća stavke za pregled
const pregledUvoza = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Izaberite fajl (.xlsx ili .json).' });
    try {
        const ime = String(req.file.originalname || '').toLowerCase();
        let stavke;
        let izvor;
        if (ime.endsWith('.json')) {
            let obj;
            try { obj = JSON.parse(req.file.buffer.toString('utf8')); } catch { return res.status(400).json({ error: 'Fajl nije ispravan JSON.' }); }
            stavke = uvoz.parsirajJson(obj);
            izvor = 'json';
        } else {
            ({ stavke, izvor } = await uvoz.parsirajExcel(req.file.buffer, { godina: godinaIzUpita(req) }));
        }
        if (!stavke.length) return res.status(400).json({ error: 'U fajlu nisu pronađeni termini.' });
        res.status(200).json({ izvor, stavke: await uvoz.pripremiStavke(stavke) });
    } catch (err) {
        if (/format|Excel|zip|signature/i.test(err.message)) return res.status(400).json({ error: err.message.startsWith('Fajl') ? err.message : 'Fajl nije moguće pročitati.' });
        console.error('Greška pri pregledu uvoza:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

// GET /ispit/izvoz?od=&do=&tip=ispiti|kolokvijumi
const izvozJson = async (req, res) => {
    try {
        const od = jeDatum(req.query.od) ? req.query.od : null;
        const doDatuma = jeDatum(req.query.do) ? req.query.do : null;
        const tip = ['ispiti', 'kolokvijumi'].includes(req.query.tip) ? req.query.tip : null;
        res.status(200).json(await uvoz.izveziTermine({ od, doDatuma, tip }));
    } catch (err) {
        console.error('Greška pri izvozu:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

// ---------- Sačuvane verzije ----------
const listaVerzija = async (req, res) => {
    try {
        const verzije = await prisma.sacuvaniRaspored.findMany({
            orderBy: { created_at: 'desc' },
            select: { id: true, naziv: true, autor: true, created_at: true, broj_termina: true, datum_od: true, datum_do: true }
        });
        res.status(200).json(verzije);
    } catch (err) {
        console.error('Greška pri čitanju verzija:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

// POST /verzije { naziv, od?, do? }
const sacuvajVerziju = async (req, res) => {
    try {
        const naziv = String(req.body?.naziv ?? '').trim();
        if (!naziv || naziv.length > 120) return res.status(400).json({ error: 'Unesite naziv (do 120 znakova).' });
        const od = jeDatum(req.body?.od) ? req.body.od : null;
        const doDatuma = jeDatum(req.body?.do) ? req.body.do : null;
        if (od && doDatuma && doDatuma < od) return res.status(400).json({ error: 'Datum "do" je pre datuma "od".' });
        const podaci = await uvoz.izveziTermine({ od, doDatuma });
        if (!podaci.termini.length) return res.status(400).json({ error: 'Nema termina za čuvanje.' });
        const v = await prisma.sacuvaniRaspored.create({
            data: { naziv, autor: korisnik(req), datum_od: od, datum_do: doDatuma, broj_termina: podaci.termini.length, podaci },
            select: { id: true, naziv: true, autor: true, created_at: true, broj_termina: true, datum_od: true, datum_do: true }
        });
        await logAction(korisnik(req), 'CREATE', 'Verzija', `Sačuvana verzija "${naziv}" (${v.broj_termina} termina)`);
        res.status(201).json(v);
    } catch (err) {
        console.error('Greška pri čuvanju verzije:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

const nadjiVerziju = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) { res.status(400).json({ error: 'Neispravan ID.' }); return null; }
    const v = await prisma.sacuvaniRaspored.findUnique({ where: { id } });
    if (!v) { res.status(404).json({ error: 'Verzija ne postoji.' }); return null; }
    return v;
};

// GET /verzije/:id -> JSON fajl
const preuzmiVerziju = async (req, res) => {
    try {
        const v = await nadjiVerziju(req, res);
        if (v) res.status(200).json(v.podaci);
    } catch (err) {
        console.error('Greška pri preuzimanju verzije:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

// POST /verzije/:id/pregled -> iste stavke kao pri uvozu fajla
const pregledVerzije = async (req, res) => {
    try {
        const v = await nadjiVerziju(req, res);
        if (!v) return;
        res.status(200).json({ izvor: 'verzija', stavke: await uvoz.pripremiStavke(uvoz.parsirajJson(v.podaci)) });
    } catch (err) {
        console.error('Greška pri pregledu verzije:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

const obrisiVerziju = async (req, res) => {
    try {
        const v = await nadjiVerziju(req, res);
        if (!v) return;
        await prisma.sacuvaniRaspored.delete({ where: { id: v.id } });
        await logAction(korisnik(req), 'DELETE', 'Verzija', `Obrisana verzija "${v.naziv}"`);
        res.status(200).json({ ok: true });
    } catch (err) {
        console.error('Greška pri brisanju verzije:', err);
        res.status(500).json({ error: 'Greška na serveru.' });
    }
};

module.exports = { pregledUvoza, izvozJson, listaVerzija, sacuvajVerziju, preuzmiVerziju, pregledVerzije, obrisiVerziju };
