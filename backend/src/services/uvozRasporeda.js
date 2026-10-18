const ExcelJS = require('exceljs');
const prisma = require('../db/prisma');
const { normalizujNazivSale } = require('../utils/sale');
const { kljucNaziva } = require('../utils/tekst');
const { hhmm } = require('./rezervacijeSala');

// Uvoz i izvoz rasporeda.
// Stavka (posle čitanja fajla): { izvor, predmetNaziv, predmetSifra, datum, vreme, vremeKraja, sala, isIspit, tip,
//   grupaKljuc, dezurniOsobe ([{ email, ime, prezime }]; null = uzmi saradnike sa predmeta), greska }
const FORMAT = 'raspored-termini';

const dvaMesta = (n) => String(n).padStart(2, '0');
const ispravanDatum = (g, m, d) => {
    const dt = new Date(Date.UTC(g, m - 1, d));
    return dt.getUTCFullYear() === g && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

// "8h", "8.15h", "08:15", "8:15", "14 h" -> "08:15"; ostalo -> null
const citajVreme = (v) => {
    const m = String(v ?? '').trim().match(/^(\d{1,2})(?:[.:,](\d{2}))?\s*h?$/i);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2] || 0);
    if (h > 23 || min > 59) return null;
    return `${dvaMesta(h)}:${dvaMesta(min)}`;
};

// "26.09.2026." / "26.9.2026" / Date -> "2026-09-26"; "26.09." uz godinu
const citajDatum = (v, godina = null) => {
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    const s = String(v ?? '').trim();
    let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/);
    if (m) {
        const [d, mes, g] = [Number(m[1]), Number(m[2]), Number(m[3])];
        return ispravanDatum(g, mes, d) ? `${g}-${dvaMesta(mes)}-${dvaMesta(d)}` : null;
    }
    m = s.match(/^(\d{1,2})\.(\d{1,2})\.?$/);
    if (m && godina) {
        const [d, mes] = [Number(m[1]), Number(m[2])];
        return ispravanDatum(godina, mes, d) ? `${godina}-${dvaMesta(mes)}-${dvaMesta(d)}` : null;
    }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m && ispravanDatum(Number(m[1]), Number(m[2]), Number(m[3]))) return `${m[1]}-${m[2]}-${m[3]}`;
    return null;
};

// Opis iz Excel-a -> { isIspit, tip } (vrednosti kao u prozoru za termin)
const citajTip = (opis) => {
    const l = String(opis ?? '').trim().toLowerCase();
    if (!l) return { isIspit: false, tip: 'I' };
    if (l.includes('испит') || l.includes('ispit')) return { isIspit: true, tip: null };
    if (l.includes('поправни тест') || l.includes('popravni test')) return { isIspit: false, tip: 'поправни тест' };
    if (l === 'тест' || l === 'test') return { isIspit: false, tip: 'тест' };
    if (l.includes('поправни') || l.includes('popravni')) return { isIspit: false, tip: 'Поправни I' };
    const rimski = l.match(/^(iii|ii|i)\b/);
    return { isIspit: false, tip: rimski ? rimski[1].toUpperCase() : 'I' };
};

// ---------- JSON ----------
const parsirajJson = (obj) => {
    if (!obj || obj.format !== FORMAT || !Array.isArray(obj.termini)) {
        throw new Error(`Fajl nije izvoz rasporeda (očekuje se format "${FORMAT}").`);
    }
    return obj.termini.map((t, i) => {
        const datum = citajDatum(t?.datum);
        const vreme = citajVreme(t?.vreme);
        return {
            izvor: `termin ${i + 1}`,
            predmetNaziv: t?.predmet?.naziv || '',
            predmetSifra: t?.predmet?.sifra || null,
            datum,
            vreme,
            vremeKraja: citajVreme(t?.vreme_kraja),
            sala: t?.sala || null,
            isIspit: t?.is_ispit !== false,
            tip: t?.tip_kolokvijuma || null,
            grupaKljuc: t?.grupa_kljuc || null,
            dezurniOsobe: Array.isArray(t?.dezurni) ? t.dezurni.filter(Boolean).map((d) => ({ email: d.email || null, ime: d.ime || '', prezime: d.prezime || '' })) : [],
            greska: !datum ? 'Neispravan datum' : !vreme ? 'Neispravno vreme' : null
        };
    });
};

// ---------- Excel ----------
const tekstCelije = (cell) => {
    const v = cell.value;
    if (v instanceof Date) return v;
    if (v && typeof v === 'object' && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if (v && typeof v === 'object' && 'result' in v) return v.result ?? '';
    return v ?? '';
};

const mrezaLista = (ws) => {
    const redovi = [];
    ws.eachRow({ includeEmpty: true }, (row, r) => {
        const red = [];
        for (let c = 1; c <= Math.max(ws.columnCount, row.cellCount); c++) red[c - 1] = tekstCelije(row.getCell(c));
        redovi[r - 1] = red;
    });
    return redovi.map((r) => r || []);
};

const DATUM_PUN = /^\d{1,2}\.\d{1,2}\.\d{4}\.?$/;

// Kolokvijumi: nedeljni blokovi, red sa datumima, ćelije "Naziv\n - I колоквијум - 8.15h"
const parsirajKolokvijume = (redovi, list) => {
    const stavke = [];
    let datumiKolona = null;
    redovi.forEach((red, r) => {
        const datumi = red.map((v) => (v instanceof Date || DATUM_PUN.test(String(v).trim()) ? citajDatum(v) : null));
        if (datumi.filter(Boolean).length >= 3) {
            datumiKolona = datumi;
            return;
        }
        if (!datumiKolona) return;
        red.forEach((v, c) => {
            const s = String(v ?? '').trim();
            if (!s || !datumiKolona[c] || v instanceof Date) return;
            const linije = s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
            if (linije.length < 2) return;
            const ostatak = linije.slice(1).join(' ').replace(/^-\s*/, '');
            const delovi = ostatak.split(/\s+-\s*|\s*-\s+/).map((x) => x.trim()).filter(Boolean);
            const vreme = citajVreme(delovi[delovi.length - 1]);
            const { isIspit, tip } = citajTip(vreme ? delovi.slice(0, -1).join(' ') : delovi.join(' '));
            stavke.push({
                izvor: `${list}!${String.fromCharCode(65 + c)}${r + 1}`,
                predmetNaziv: linije[0],
                predmetSifra: null,
                datum: datumiKolona[c],
                vreme,
                vremeKraja: null,
                sala: null,
                isIspit,
                tip,
                grupaKljuc: null,
                dezurniOsobe: null,
                greska: vreme ? null : 'Nedostaje vreme početka'
            });
        });
    });
    return stavke;
};

// Ispiti: po godinama, zaglavlje "Предмет" pa redovi "rb | Predmet | DD.MM. | 8h | DD.MM. | 8h ..."
const parsirajIspite = (redovi, list, godina) => {
    const stavke = [];
    let uTabeli = false;
    let poslednjiNaziv = '';
    redovi.forEach((red, r) => {
        const b = String(red[1] ?? '').trim();
        if (kljucNaziva(b) === 'predmet') {
            uTabeli = true;
            poslednjiNaziv = '';
            return;
        }
        if (!uTabeli) return;
        const ostalo = red.slice(2).map((v) => String(v ?? '').trim());
        if (!b && !ostalo.some(Boolean)) {
            uTabeli = false;
            return;
        }
        const naziv = b || poslednjiNaziv;
        if (b) poslednjiNaziv = b;
        for (let c = 2; c < red.length; c += 2) {
            const sirovDatum = red[c];
            if (!String(sirovDatum ?? '').trim()) continue;
            const datum = citajDatum(sirovDatum, godina);
            const vreme = citajVreme(red[c + 1]);
            stavke.push({
                izvor: `${list}!${String.fromCharCode(65 + c)}${r + 1}`,
                predmetNaziv: naziv,
                predmetSifra: null,
                datum,
                vreme,
                vremeKraja: null,
                sala: null,
                isIspit: true,
                tip: null,
                grupaKljuc: null,
                dezurniOsobe: null,
                greska: !datum ? 'Neispravan datum' : !vreme ? 'Nedostaje vreme početka' : null
            });
        }
    });
    return stavke;
};

const parsirajExcel = async (buffer, { godina } = {}) => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const stavke = [];
    let izvor = null;
    wb.eachSheet((ws) => {
        const redovi = mrezaLista(ws);
        const jeIspitni = redovi.some((red) => kljucNaziva(red[1]) === 'predmet');
        const deo = jeIspitni ? parsirajIspite(redovi, ws.name, godina) : parsirajKolokvijume(redovi, ws.name);
        if (deo.length) izvor = izvor || (jeIspitni ? 'excel-ispiti' : 'excel-kolokvijumi');
        stavke.push(...deo);
    });
    return { stavke, izvor: izvor || 'excel' };
};

// ---------- Povezivanje sa bazom ----------
const pripremiStavke = async (stavke) => {
    const predmeti = await prisma.predmet.findMany({
        include: { saradnici: { select: { id: true, ime: true, prezime: true, email: true } } }
    });
    const poSifri = new Map(predmeti.map((p) => [String(p.sifra).toLowerCase(), p]));
    const poNazivu = new Map();
    predmeti.forEach((p) => { if (!poNazivu.has(kljucNaziva(p.naziv))) poNazivu.set(kljucNaziva(p.naziv), p); });

    const ljudi = await prisma.profesor.findMany({ select: { id: true, ime: true, prezime: true, email: true } });
    const poEmailu = new Map(ljudi.filter((o) => o.email).map((o) => [o.email.toLowerCase(), o]));
    const poImenu = new Map(ljudi.map((o) => [kljucNaziva(`${o.ime} ${o.prezime}`), o]));
    const nadjiOsobu = (d) => (d.email && poEmailu.get(String(d.email).toLowerCase())) || poImenu.get(kljucNaziva(`${d.ime} ${d.prezime}`));

    const sale = await prisma.sala.findMany({ select: { naziv: true } });
    const saleMapa = new Map(sale.map((s) => [s.naziv.toLowerCase(), s.naziv]));

    const datumi = stavke.map((s) => s.datum).filter(Boolean).sort();
    const postojeci = datumi.length
        ? await prisma.ispit.findMany({
            where: { datum: { gte: new Date(`${datumi[0]}T00:00:00Z`), lte: new Date(`${datumi[datumi.length - 1]}T00:00:00Z`) } },
            select: { predmet_id: true, datum: true, vreme: true }
        })
        : [];
    const zauzeto = new Set(postojeci.map((i) => `${i.predmet_id}|${i.datum}|${hhmm(i.vreme)}`));
    const uFajlu = new Set();

    return stavke.map((s) => {
        const predmet = (s.predmetSifra && poSifri.get(String(s.predmetSifra).toLowerCase())) || poNazivu.get(kljucNaziva(s.predmetNaziv)) || null;
        const napomene = [];

        let dezurni;
        if (s.dezurniOsobe === null) {
            dezurni = predmet ? predmet.saradnici.map(({ id, ime, prezime }) => ({ id, ime, prezime })) : [];
        } else {
            dezurni = s.dezurniOsobe.map(nadjiOsobu).filter(Boolean).map(({ id, ime, prezime }) => ({ id, ime, prezime }));
            if (dezurni.length < s.dezurniOsobe.length) napomene.push('Neki dežurni nisu u bazi');
        }

        const sala = s.sala ? (saleMapa.get(normalizujNazivSale(s.sala).toLowerCase()) || normalizujNazivSale(s.sala)) : null;
        if (s.sala && !saleMapa.has(normalizujNazivSale(s.sala).toLowerCase())) napomene.push('Nova sala');

        let status = 'ok';
        let razlog = null;
        if (s.greska) { status = 'neispravno'; razlog = s.greska; }
        else if (!predmet) { status = 'nepoznat_predmet'; razlog = 'Predmet nije u bazi'; }
        else {
            const kljuc = `${predmet.id}|${s.datum}|${s.vreme}`;
            if (zauzeto.has(kljuc) || uFajlu.has(kljuc)) { status = 'duplikat'; razlog = 'Već postoji u rasporedu'; }
            uFajlu.add(kljuc);
        }

        return {
            izvor: s.izvor,
            predmetNaziv: s.predmetNaziv,
            predmet: predmet ? { id: predmet.id, naziv: predmet.naziv, sifra: predmet.sifra, godina: predmet.godina } : null,
            datum: s.datum,
            vreme: s.vreme,
            vremeKraja: s.vremeKraja,
            sala,
            isIspit: s.isIspit,
            tip: s.isIspit ? null : (s.tip || 'I'),
            grupaKljuc: s.grupaKljuc,
            dezurni,
            status,
            razlog,
            napomena: napomene.join('; ') || null
        };
    });
};

// ---------- Izvoz ----------
// tip: 'ispiti' | 'kolokvijumi' | undefined (sve)
const izveziTermine = async ({ od = null, doDatuma = null, tip = null } = {}) => {
    const where = {};
    if (od || doDatuma) {
        where.datum = {
            ...(od ? { gte: new Date(`${od}T00:00:00Z`) } : {}),
            ...(doDatuma ? { lte: new Date(`${doDatuma}T00:00:00Z`) } : {})
        };
    }
    if (tip === 'ispiti') where.is_ispit = true;
    if (tip === 'kolokvijumi') where.is_ispit = false;
    const ispiti = await prisma.ispit.findMany({
        where,
        orderBy: [{ datum: 'asc' }, { vreme: 'asc' }],
        include: { predmet: true, sala: true, dezurstva: { include: { saradnik: true } } }
    });
    return {
        format: FORMAT,
        verzija: 1,
        napravljeno: new Date().toISOString(),
        termini: ispiti.map((i) => ({
            predmet: i.predmet ? { sifra: i.predmet.sifra, naziv: i.predmet.naziv } : null,
            datum: i.datum,
            vreme: hhmm(i.vreme),
            vreme_kraja: hhmm(i.vreme_kraja) || null,
            sala: i.sala?.naziv || null,
            is_ispit: i.is_ispit,
            tip_kolokvijuma: i.is_ispit ? null : (i.tip_kolokvijuma || 'I'),
            grupa_kljuc: i.grupa_kljuc || null,
            objavljeno: i.is_published,
            dezurni: i.dezurstva.filter((d) => d.saradnik).map((d) => ({
                email: d.saradnik.email, ime: d.saradnik.ime, prezime: d.saradnik.prezime
            }))
        }))
    };
};

module.exports = {
    FORMAT, parsirajJson, parsirajExcel, pripremiStavke, izveziTermine,
    _internal: { citajVreme, citajDatum, citajTip, parsirajKolokvijume, parsirajIspite }
};
