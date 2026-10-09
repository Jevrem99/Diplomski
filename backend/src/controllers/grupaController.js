const prisma = require('../db/prisma');
const { logAction } = require('../services/auditService');
const { validirajGrupu, odbaciAkoImaGresaka } = require('../utils/validators');

// Grupa predmeta: predmeti koji se uvek zakazuju istog dana u isto vreme (npr. apsolventski rokovi).
// Grupe pravi i održava administrator u banci predmeta.

const SA_PREDMETIMA = {
    predmeti: {
        select: { id: true, naziv: true, godina: true, semestar: true, profesor_id: true },
        orderBy: { naziv: 'asc' }
    }
};

const idjeviPredmeta = (b) => [...new Set((b.predmet_ids || b.predmeti_ids || []).map(Number).filter(Number.isInteger))];

const getGrupe = async (req, res) => {
    try {
        res.json(await prisma.grupaPredmeta.findMany({ include: SA_PREDMETIMA, orderBy: { naziv: 'asc' } }));
    } catch (err) {
        console.error('Greška pri dohvatanju grupa:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Vraća false (i šalje 400) ako neki od predmeta ne postoji
const predmetiPostoje = async (ids, res) => {
    const nadjeno = await prisma.predmet.count({ where: { id: { in: ids } } });
    if (nadjeno === ids.length) return true;
    const poruka = 'Neki od izabranih predmeta više ne postoji.';
    res.status(400).json({ error: poruka, polja: { predmeti_ids: poruka } });
    return false;
};

const createGrupa = async (req, res) => {
    if (odbaciAkoImaGresaka(res, validirajGrupu(req.body))) return;
    try {
        const ids = idjeviPredmeta(req.body);
        if (!(await predmetiPostoje(ids, res))) return;
        const grupa = await prisma.grupaPredmeta.create({
            data: { naziv: String(req.body.naziv).trim(), predmeti: { connect: ids.map((id) => ({ id })) } },
            include: SA_PREDMETIMA
        });
        await logAction(req.user?.username || 'Korisnik', 'CREATE', 'Grupa predmeta', `Napravljena grupa "${grupa.naziv}" (${ids.length} predmeta)`);
        res.status(201).json(grupa);
    } catch (err) {
        console.error('Greška pri pravljenju grupe:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const updateGrupa = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Nevalidan ID grupe.' });
    if (odbaciAkoImaGresaka(res, validirajGrupu(req.body))) return;
    try {
        const postojeca = await prisma.grupaPredmeta.findUnique({ where: { id } });
        if (!postojeca) return res.status(404).json({ error: 'Grupa nije pronađena.' });
        const ids = idjeviPredmeta(req.body);
        if (!(await predmetiPostoje(ids, res))) return;
        const grupa = await prisma.grupaPredmeta.update({
            where: { id },
            data: { naziv: String(req.body.naziv).trim(), predmeti: { set: ids.map((pid) => ({ id: pid })) } },
            include: SA_PREDMETIMA
        });
        await logAction(req.user?.username || 'Korisnik', 'UPDATE', 'Grupa predmeta', `Izmenjena grupa "${grupa.naziv}"`);
        res.json(grupa);
    } catch (err) {
        console.error('Greška pri izmeni grupe:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Briše se samo grupa; termini koji su već zakazani preko nje ostaju u rasporedu
const deleteGrupa = async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Nevalidan ID grupe.' });
    try {
        const postojeca = await prisma.grupaPredmeta.findUnique({ where: { id } });
        if (!postojeca) return res.status(404).json({ error: 'Grupa nije pronađena.' });
        await prisma.grupaPredmeta.delete({ where: { id } });
        await logAction(req.user?.username || 'Korisnik', 'DELETE', 'Grupa predmeta', `Obrisana grupa "${postojeca.naziv}"`);
        res.json({ message: 'Grupa je obrisana.' });
    } catch (err) {
        console.error('Greška pri brisanju grupe:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { getGrupe, createGrupa, updateGrupa, deleteGrupa };
