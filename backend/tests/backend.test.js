// Pokretanje: npm test   (koristi ugrađeni node:test, bez dodatnih paketa)
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-test-secret-test-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const { _internal } = require('../src/controllers/excelUploadController');
const { proveriLozinku, jeValidnaUloga, validirajKorisnika, validirajOsobu, validirajPredmet } = require('../src/utils/validators');
const { mapLimit } = require('../src/utils/mapLimit');
const { protect, restrictTo } = require('../src/middlewares/authMiddleware');
const config = require('../src/config/config');

test('parseBrojStudenata uzima "укупно" kad postoji', () => {
    assert.equal(_internal.parseBrojStudenata('68 + 10      (укупно 87)'), 87);
    assert.equal(_internal.parseBrojStudenata('67\r\n(укупно 81)'), 81);
    assert.equal(_internal.parseBrojStudenata('70+13      (укупно 148)'), 148);
});

test('parseBrojStudenata radi sa običnim brojevima, zbirom i praznim ćelijama', () => {
    assert.equal(_internal.parseBrojStudenata(67), 67);
    assert.equal(_internal.parseBrojStudenata('4+5'), 9);
    assert.equal(_internal.parseBrojStudenata(null), null);
    assert.equal(_internal.parseBrojStudenata(''), null);
});

test('ocistiNazivPredmeta seče dodatke iza "+" i napomene', () => {
    assert.equal(_internal.ocistiNazivPredmeta('Рачунарски системи + ОАС Математика'), 'Рачунарски системи');
    assert.equal(_internal.ocistiNazivPredmeta('Аналогна електроника\r\nпредмет са ОАС Физике'), 'Аналогна електроника');
    assert.equal(_internal.ocistiNazivPredmeta('Интеракција човек-рачунар'), 'Интеракција човек-рачунар');
});

test('parseGodinaIzHedera prepoznaje godinu samo iz zaglavlja', () => {
    assert.equal(_internal.parseGodinaIzHedera('II година '), 2);
    assert.equal(_internal.parseGodinaIzHedera('IV година'), 4);
    assert.equal(_internal.parseGodinaIzHedera('Основи програмирања'), null);
});

test('lozinka i uloga se validiraju', () => {
    assert.ok(proveriLozinku('kratka'));
    assert.equal(proveriLozinku('dovoljnoduga1'), null);
    assert.ok(jeValidnaUloga('admin'));
    assert.ok(!jeValidnaUloga('superadmin'));
});

test('mapLimit čuva redosled i poštuje ograničenje paralelizma', async () => {
    let aktivnih = 0;
    let najvise = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
        aktivnih++;
        najvise = Math.max(najvise, aktivnih);
        await new Promise((r) => setTimeout(r, 5));
        aktivnih--;
        return n * 2;
    });
    assert.deepEqual(out, [2, 4, 6, 8, 10, 12]);
    assert.ok(najvise <= 2);
});

const pozovi = (middleware, req) => {
    const res = { statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    return { res, nextCalled };
};

test('protect odbija zahtev bez tokena, sa tuđim potpisom i prihvata ispravan token', () => {
    assert.equal(pozovi(protect, { headers: {} }).res.statusCode, 401);

    const tudji = jwt.sign({ uloga: 'admin' }, 'neki-drugi-kljuc');
    assert.equal(pozovi(protect, { headers: { authorization: `Bearer ${tudji}` } }).res.statusCode, 401);

    const ispravan = jwt.sign({ uloga: 'admin' }, config.secret, { algorithm: 'HS256' });
    const req = { headers: { authorization: `Bearer ${ispravan}` } };
    assert.ok(pozovi(protect, req).nextCalled);
    assert.equal(req.user.uloga, 'admin');
});

test('restrictTo dozvoljava samo navedene uloge', () => {
    const samoAdmin = restrictTo('admin');
    assert.ok(pozovi(samoAdmin, { user: { uloga: 'admin' } }).nextCalled);
    assert.equal(pozovi(samoAdmin, { user: { uloga: 'asistent' } }).res.statusCode, 403);
    assert.equal(pozovi(samoAdmin, {}).res.statusCode, 403);
});

test('lozinka mora imati slovo i cifru', () => {
    assert.ok(proveriLozinku('samoslova'));
    assert.ok(proveriLozinku('12345678'));
    assert.equal(proveriLozinku('abcdefg1'), null);
});

test('validirajKorisnika vraća poruku po polju', () => {
    const polja = validirajKorisnika({ username: 'a b', email: 'nije-mejl', password: 'kratka', uloga: 'x' });
    assert.ok(polja.username && polja.email && polja.password && polja.uloga);
    assert.deepEqual(validirajKorisnika({ username: 'pera.peric', email: 'pera@pmf.kg.ac.rs', password: 'Lozinka123', uloga: 'asistent' }), {});
    // pri izmeni lozinka nije obavezna
    assert.equal(validirajKorisnika({ username: 'pera', email: 'pera@pmf.kg.ac.rs', uloga: 'admin' }, { lozinkaObavezna: false }).password, undefined);
});

test('validirajOsobu i validirajPredmet', () => {
    assert.ok(validirajOsobu({ ime: '', prezime: 'P' }).ime);
    assert.ok(validirajOsobu({ ime: 'A', prezime: 'B', email: 'x' }).email);
    assert.deepEqual(validirajOsobu({ ime: 'A', prezime: 'B' }), {});
    assert.ok(validirajPredmet({ sifra: '', naziv: 'N', godina: 9, semestar: 'Zimski' }).godina);
    assert.deepEqual(validirajPredmet({ sifra: 'S1', naziv: 'N', godina: 2, semestar: 'Letnji', broj_studenata: 40 }), {});
});

test('normalizujNazivSale spaja zapise iste sale, a razlikuje A-II-24 i A-II-24R', () => {
    const { normalizujNazivSale: n } = require('../src/utils/sale');
    assert.equal(n('A-0-15 RS'), 'A-0-15');
    assert.equal(n('  A-II-28   RS '), 'A-II-28');
    assert.equal(n('A-II-24r'), 'A-II-24R');
    assert.equal(n('A-II-24R'), 'A-II-24R');
    assert.equal(n('A-II-24'), 'A-II-24');
    assert.notEqual(n('A-II-24'), n('A-II-24R'));
    assert.equal(n(null), '');
});


test('proveriVremena: kraj mora biti posle početka', () => {
    const { proveriVremena, proveriEmail } = require('../src/utils/validators');
    assert.equal(proveriVremena('09:00', '10:15'), null);
    assert.equal(proveriVremena('09:00:00', '2026-10-06T10:15:00'), null);
    assert.equal(proveriVremena('09:00', null), null);
    assert.ok(proveriVremena('09:00', '08:00'));
    assert.ok(proveriVremena('09:00', '09:00'));
    assert.ok(proveriVremena('09:00', 'abc'));
    assert.equal(proveriEmail('ime.prezime@pmf.kg.ac.rs'), null);
    assert.ok(proveriEmail('ime@'));
    assert.ok(proveriEmail('bez-monkeya.rs'));
});

test('sabloni mejlova ne propuštaju HTML iz podataka', () => {
    const { _sabloni } = require('../src/services/emailService');
    const html = _sabloni.gradiPregledDezurstava('<script>x</script>', [
        { predmet: '<img src=x onerror=alert(1)>', datum: '1.1.2026.', vreme: '09:00', vremeKraja: '10:00', sala: 'A-0-1', isIzmenjen: false }
    ]);
    assert.ok(!html.includes('<script>x</script>'));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(html.includes('&lt;img src=x'));
});


test('semestarIzNapomene: napomena "реализује се у ..." ima prednost nad sekcijom', () => {
    const f = _internal.semestarIzNapomene;
    assert.equal(f('Алгоритми (реализује се у летњем семестру)', 'Zimski'), 'Letnji');
    assert.equal(f('Алгоритми\r\n(реализује се у зимском семестру)', 'Letnji'), 'Zimski');
    assert.equal(f('Базе података држи се у летњем семестру', 'Zimski'), 'Letnji');
    assert.equal(f('Baze podataka (realizuje se u zimskom semestru)', 'Letnji'), 'Zimski');
    assert.equal(f('Математика 1', 'Zimski'), 'Zimski');
    assert.equal(f('Математика 2', 'Letnji'), 'Letnji');
    assert.equal(f(null, 'Zimski'), 'Zimski');
    assert.equal(_internal.ocistiNazivPredmeta('Алгоритми (реализује се у летњем семестру)'), 'Алгоритми');
});


test('potrebnoDezurnih bira polje prema tipu kolokvijuma', () => {
    const { _internal: d } = require('../src/controllers/dezurstvaController');
    const predmet = { terminiKolokvijuma: { k1_dezurni: 3, k2_dezurni: 4, k3_dezurni: null, popravni_dezurni: 2 } };
    assert.equal(d.potrebnoDezurnih({ is_ispit: false, tip_kolokvijuma: 'I', predmet }), 3);
    assert.equal(d.potrebnoDezurnih({ is_ispit: false, tip_kolokvijuma: 'II', predmet }), 4);
    assert.equal(d.potrebnoDezurnih({ is_ispit: false, tip_kolokvijuma: 'III', predmet }), null);
    assert.equal(d.potrebnoDezurnih({ is_ispit: false, tip_kolokvijuma: 'Поправни I', predmet }), 2);
    assert.equal(d.potrebnoDezurnih({ is_ispit: false, tip_kolokvijuma: 'тест', predmet }), null);
    assert.equal(d.potrebnoDezurnih({ is_ispit: true, tip_kolokvijuma: 'I', predmet }), null);
    assert.equal(d.potrebnoDezurnih({ is_ispit: false, tip_kolokvijuma: 'I', predmet: {} }), null);
});


test('validirajGrupu: naziv i bar dva različita predmeta', () => {
    const { validirajGrupu, ocistiGrupaKljuc } = require('../src/utils/validators');
    assert.deepEqual(validirajGrupu({ naziv: 'Logika i jezici', predmet_ids: [1, 2] }), {});
    assert.deepEqual(validirajGrupu({ naziv: 'Logika i jezici', predmeti_ids: ['3', '4', '5'] }), {});
    assert.ok(validirajGrupu({ naziv: '', predmet_ids: [1, 2] }).naziv);
    assert.ok(validirajGrupu({ naziv: 'x', predmet_ids: [1] }).predmeti_ids);
    assert.ok(validirajGrupu({ naziv: 'x', predmet_ids: [1, 1] }).predmeti_ids);
    assert.ok(validirajGrupu({ naziv: 'x' }).predmeti_ids);
    assert.equal(ocistiGrupaKljuc('g_mabc123_x9'), 'g_mabc123_x9');
    assert.equal(ocistiGrupaKljuc(''), null);
    assert.equal(ocistiGrupaKljuc("x'; DROP TABLE"), null);
    assert.equal(ocistiGrupaKljuc(undefined), null);
});


test('rezervacije sala: samo kolokvijumi, grupa je jedna rezervacija, termin bez sale ide u bez_sale', () => {
    const { napraviRezervacije } = require('../src/services/rezervacijeSala');
    const utc = (v) => new Date(`1970-01-01T${v}:00.000Z`);
    const predmet = (id, naziv, studenata, rs) => ({ sifra: `S${id}`, naziv, godina: 3, broj_studenata: studenata, profesor: { ime: 'Ana', prezime: 'Anić' }, terminiKolokvijuma: { k1_racunarska_sala: rs } });
    const sala = { naziv: 'A-0-15' };
    const d = new Date('2026-10-28T00:00:00.000Z');
    const ispiti = [
        { id: 1, is_ispit: true, datum: d, vreme: utc('09:00'), vreme_kraja: utc('11:00'), sala, predmet: predmet(1, 'Ispit X', 10, false), tip_kolokvijuma: 'I' },
        { id: 2, is_ispit: false, datum: d, vreme: utc('13:00'), vreme_kraja: utc('15:00'), sala, grupa_kljuc: 'g1', predmet: predmet(2, 'Logika', 40, true), tip_kolokvijuma: 'I' },
        { id: 3, is_ispit: false, datum: d, vreme: utc('13:00'), vreme_kraja: utc('15:00'), sala, grupa_kljuc: 'g1', predmet: predmet(3, 'Jezici', 35, false), tip_kolokvijuma: 'I' },
        { id: 4, is_ispit: false, datum: d, vreme: utc('16:00'), vreme_kraja: null, sala, is_izmenjen: true, predmet: predmet(4, 'Algebra', 20, false), tip_kolokvijuma: 'II' },
        { id: 6, is_ispit: false, datum: d, vreme: '08:30:00', vreme_kraja: utc('09:15'), sala, predmet: predmet(6, 'Tekstualno vreme', 12, false), tip_kolokvijuma: 'III' },
        { id: 5, is_ispit: false, datum: d, vreme: utc('10:00'), vreme_kraja: utc('11:00'), sala: null, predmet: predmet(5, 'Bez sale', 5, false), tip_kolokvijuma: 'I' }
    ];
    const r = napraviRezervacije(ispiti, { objavio: 'admin', sada: new Date('2026-10-09T10:00:00Z') });
    assert.equal(r.format, 'raspored-rezervacije-sala');
    assert.equal(r.rezervacije.length, 3, 'ispit se ne računa, grupa je jedna rezervacija');
    assert.deepEqual([r.rezervacije[0].od, r.rezervacije[0].do], ['08:30', '09:15'], 'početak koji stiže kao tekst');
    const grupa = r.rezervacije[1];
    assert.deepEqual([grupa.sala, grupa.datum, grupa.od, grupa.do, grupa.racunarska_sala], ['A-0-15', '2026-10-28', '13:00', '15:00', true]);
    assert.equal(grupa.predmeti.length, 2);
    assert.equal(grupa.ukupno_studenata, 75);
    const bezKraja = r.rezervacije[2];
    assert.deepEqual([bezKraja.od, bezKraja.do, bezKraja.do_pretpostavljen, bezKraja.izmena], ['16:00', '18:00', true, true]);
    assert.deepEqual(r.bez_sale.map((x) => x.id), ['kol-5']);
});


test('integracija: API ključ (nije podešen -> 503, pogrešan -> 401, ispravan -> prolazi)', async () => {
    const { napraviApiKljuc } = require('../src/middlewares/apiKljuc');
    const { sazetakHex } = require('../src/services/integracijaPodesavanja');
    const poziv = async (ocekivani, zaglavlje) => {
        const rez = { kod: null, telo: null, status(k) { this.kod = k; return this; }, json(x) { this.telo = x; return this; } };
        let proslo = false;
        const mw = napraviApiKljuc(async () => ({ hash: ocekivani ? sazetakHex(ocekivani) : null }));
        await mw({ get: (ime) => (ime.toLowerCase() === 'x-api-key' ? zaglavlje : undefined) }, rez, () => { proslo = true; });
        return { kod: rez.kod, proslo };
    };
    assert.equal((await poziv(null, 'bilo-sta')).kod, 503, 'ključ nije podešen: isključeno');
    const kljuc = 'a'.repeat(32);
    assert.equal((await poziv(kljuc, undefined)).kod, 401);
    assert.equal((await poziv(kljuc, 'b'.repeat(32))).kod, 401);
    assert.equal((await poziv(kljuc, 'a'.repeat(31))).kod, 401);
    const dobar = await poziv(kljuc, 'a'.repeat(32));
    assert.equal(dobar.proslo, true);
    assert.equal(dobar.kod, null);
    // greška pri čitanju ključa (npr. baza ne radi) ne sme da propusti zahtev
    const rez = { kod: null, status(k) { this.kod = k; return this; }, json() { return this; } };
    let proslo = false;
    await napraviApiKljuc(async () => { throw new Error('baza'); })({ get: () => kljuc }, rez, () => { proslo = true; });
    assert.equal(rez.kod, 500);
    assert.equal(proslo, false);
});

test('integracija: adresa za slanje mora biti http(s)', () => {
    const { jeAdresa } = require('../src/services/integracijaPodesavanja');
    assert.equal(jeAdresa('https://sistem.pmf.kg.ac.rs/rezervacije'), true);
    assert.equal(jeAdresa('http://147.91.204.28:8080/x'), true);
    for (const lose of ['', 'ftp://x.rs', 'javascript:alert(1)', 'sistem.rs/x', 42, null, 'http://' + 'a'.repeat(600)]) {
        assert.equal(jeAdresa(lose), false, String(lose).slice(0, 30));
    }
});

test('jeDatum prihvata samo stvarne datume GGGG-MM-DD', () => {
    const { jeDatum } = require('../src/services/rezervacijeSala');
    assert.equal(jeDatum('2026-10-28'), true);
    assert.equal(jeDatum('2028-02-29'), true);
    assert.equal(jeDatum('2026-02-29'), false);
    assert.equal(jeDatum('2026-13-01'), false);
    assert.equal(jeDatum('28.10.2026'), false);
    assert.equal(jeDatum(undefined), false);
    assert.equal(jeDatum("2026-10-28' OR 1=1"), false);
});

test('odgovor rezervacija sala odgovara objavljenoj JSON šemi (docs/rezervacije-sala.schema.json)', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const { proveriSemu } = require('./helpers/mini-schema');
    const { napraviRezervacije } = require('../src/services/rezervacijeSala');
    const sema = JSON.parse(fs.readFileSync(path.join(__dirname, '../../docs/rezervacije-sala.schema.json'), 'utf-8'));
    const utc = (v) => new Date(`1970-01-01T${v}:00.000Z`);
    const d = new Date('2026-10-28T00:00:00.000Z');
    const sala = { naziv: 'A-0-15' };
    const pr = (id, rs) => ({ sifra: `S${id}`, naziv: `Предмет ${id}`, godina: 3, broj_studenata: 10 * id, profesor: { ime: 'Ана', prezime: 'Анић' }, terminiKolokvijuma: { k1_racunarska_sala: rs } });
    const ispiti = [
        { id: 2, is_ispit: false, datum: d, vreme: utc('13:00'), vreme_kraja: utc('15:00'), sala, grupa_kljuc: 'g1', predmet: pr(2, true), tip_kolokvijuma: 'I' },
        { id: 3, is_ispit: false, datum: d, vreme: '13:00:00', vreme_kraja: utc('15:00'), sala, grupa_kljuc: 'g1', predmet: pr(3, false), tip_kolokvijuma: 'I' },
        { id: 4, is_ispit: false, datum: d, vreme: utc('16:00'), vreme_kraja: null, sala, predmet: { ...pr(4, false), profesor: null, sifra: null, godina: null }, tip_kolokvijuma: 'Поправни I' },
        { id: 5, is_ispit: false, datum: d, vreme: utc('10:00'), vreme_kraja: utc('11:00'), sala: null, predmet: pr(5, false), tip_kolokvijuma: 'I' }
    ];
    const odgovor = napraviRezervacije(ispiti, { objavio: 'integracija' });
    assert.deepEqual(proveriSemu(sema, odgovor), []);
    // šema zaista hvata greške (provera da test ne prolazi "uvek")
    const pokvaren = JSON.parse(JSON.stringify(odgovor));
    pokvaren.rezervacije[0].od = '9:5';
    delete pokvaren.rezervacije[0].sala;
    pokvaren.rezervacije[0].suvisno = 1;
    assert.equal(proveriSemu(sema, pokvaren).length, 3);
});

// ---------- Prijava preko PMF naloga ----------
const http = require('node:http');
const pmf = require('../src/services/pmfPrijava');

const POKRENI_LAZNI_PMF = async (handler) => {
    const srv = http.createServer(handler);
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const stara = config.pmfVerifyUrl;
    config.pmfVerifyUrl = `http://127.0.0.1:${srv.address().port}/verify`;
    return async () => { config.pmfVerifyUrl = stara; await new Promise((r) => srv.close(r)); };
};
const TOKEN = 'a1'.repeat(32);

test('PMF: ispravan token vraća e-mail malim slovima, token ide kao parametar', async () => {
    let videoUrl;
    const stani = await POKRENI_LAZNI_PMF((req, res) => {
        videoUrl = req.url;
        res.end(JSON.stringify({ success: true, korisnik: { Email: 'Pera.Peric@pmf.kg.ac.rs', uloga: 'admin' } }));
    });
    try {
        const r = await pmf.proveriToken(TOKEN);
        assert.deepEqual(r, { email: 'pera.peric@pmf.kg.ac.rs', korisnickoIme: null, imePrezime: null, vrsta: ['admin'] }); // vrsta služi samo za proveru zaposlen/student, uloga u aplikaciji je iz naše baze
        assert.ok(videoUrl.includes(`token=${TOKEN}`));
    } finally { await stani(); }
});

test('PMF: pogrešan oblik tokena -> 400 bez poziva IMI-ja', async () => {
    let pozvan = false;
    const stani = await POKRENI_LAZNI_PMF((req, res) => { pozvan = true; res.end('{}'); });
    try {
        for (const losi of [undefined, '', 'abc', 'a'.repeat(300), 'ab"<script>'.repeat(3), `${TOKEN} OR 1=1`, { $ne: 1 }]) {
            await assert.rejects(pmf.proveriToken(losi), (e) => e.status === 400 && e.kod === 'TOKEN_OBLIK');
        }
        assert.equal(pozvan, false);
    } finally { await stani(); }
});

test('PMF: IMI javlja da token ne važi -> 401, bez e-maila u odgovoru -> 401, ne-JSON -> 401', async () => {
    const odgovori = [
        [401, '{"error":"invalid"}'],
        [200, '{"success":false,"email":"a@b.rs"}'],
        [200, '{"status":"error","email":"a@b.rs"}'],
        [200, '{"ime":"Pera"}'],
        [200, '<html>prijavite se</html>']
    ];
    let i = 0;
    const stani = await POKRENI_LAZNI_PMF((req, res) => {
        const [kod, telo] = odgovori[i++];
        res.writeHead(kod);
        res.end(telo);
    });
    try {
        for (let k = 0; k < odgovori.length; k++) {
            await assert.rejects(pmf.proveriToken(TOKEN), (e) => e.status === 401 && e.kod === 'TOKEN_NEVAZECI', `slučaj ${k}`);
        }
    } finally { await stani(); }
});

test('PMF: IMI 5xx ili nedostupan -> 502', async () => {
    const stani = await POKRENI_LAZNI_PMF((req, res) => { res.writeHead(503); res.end('x'); });
    try {
        await assert.rejects(pmf.proveriToken(TOKEN), (e) => e.status === 502 && e.kod === 'PMF_NEDOSTUPAN');
    } finally { await stani(); }
    config.pmfVerifyUrl = 'http://127.0.0.1:1/verify'; // niko ne sluša
    try {
        await assert.rejects(pmf.proveriToken(TOKEN), (e) => e.status === 502);
    } finally { config.pmfVerifyUrl = 'https://imi.pmf.kg.ac.rs/cp/verify_token.php'; }
});

test('PMF: nadjiEmail prepoznaje poznata polja i ugnježdene objekte, ignoriše tekst koji nije e-mail', () => {
    const { nadjiEmail } = pmf._internal;
    assert.equal(nadjiEmail({ email: 'a@b.rs' }), 'a@b.rs');
    assert.equal(nadjiEmail({ data: { user: { e_mail: 'x@y.rs' } } }), 'x@y.rs');
    assert.equal(nadjiEmail({ ime: 'Pera', prezime: 'Peric' }), null);
    assert.equal(nadjiEmail('nije mejl'), null);
});

// ---------- Uvoz rasporeda ----------
const uvozRasporeda = require('../src/services/uvozRasporeda');

const napraviExcel = async (redovi, ime = 'Raspored') => {
    const ExcelJS = require('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(ime);
    redovi.forEach((r) => ws.addRow(r));
    return wb.xlsx.writeBuffer();
};

test('uvoz: vreme, datum i tip iz teksta', () => {
    const { citajVreme, citajDatum, citajTip } = uvozRasporeda._internal;
    assert.equal(citajVreme('8h'), '08:00');
    assert.equal(citajVreme('8.15h'), '08:15');
    assert.equal(citajVreme('14:30'), '14:30');
    assert.equal(citajVreme('25h'), null);
    assert.equal(citajVreme('posle podne'), null);
    assert.equal(citajDatum('26.09.2026.'), '2026-09-26');
    assert.equal(citajDatum('3.2.2027'), '2027-02-03');
    assert.equal(citajDatum('31.02.2026.'), null);
    assert.equal(citajDatum('26.09.', 2027), '2027-09-26');
    assert.equal(citajDatum('26.09.'), null, 'bez godine nema datuma');
    assert.deepEqual(citajTip('II колоквијум'), { isIspit: false, tip: 'II' });
    assert.deepEqual(citajTip('поправни колоквијум'), { isIspit: false, tip: 'Поправни I' });
    assert.deepEqual(citajTip('поправни тест'), { isIspit: false, tip: 'поправни тест' });
    assert.deepEqual(citajTip('тест'), { isIspit: false, tip: 'тест' });
    assert.deepEqual(citajTip('испит'), { isIspit: true, tip: null });
});

test('uvoz: Excel sa kolokvijumima (nedeljni raspored kao pri izvozu)', async () => {
    const buf = await napraviExcel([
        ['Распоред колоквијума'],
        [],
        ['понедељак', 'уторак', 'среда', 'четвртак', 'петак', 'субота', 'недеља'],
        ['26.10.2026.', '27.10.2026.', '28.10.2026.', '29.10.2026.', '30.10.2026.', '31.10.2026.', '01.11.2026.'],
        ['Основи програмирања\n - I колоквијум - 8.15h', '', 'Математика 1\n - поправни колоквијум - 14h', '', '', '', ''],
        ['Физика\n - тест -', '', '', '', '', '', '']
    ]);
    const { stavke, izvor } = await uvozRasporeda.parsirajExcel(buf);
    assert.equal(izvor, 'excel-kolokvijumi');
    assert.equal(stavke.length, 3);
    assert.deepEqual(
        stavke.map((s) => [s.predmetNaziv, s.datum, s.vreme, s.isIspit, s.tip]),
        [
            ['Основи програмирања', '2026-10-26', '08:15', false, 'I'],
            ['Математика 1', '2026-10-28', '14:00', false, 'Поправни I'],
            ['Физика', '2026-10-26', null, false, 'тест']
        ]
    );
    assert.equal(stavke[2].greska, 'Nedostaje vreme početka');
    assert.equal(stavke[0].dezurniOsobe, null, 'dežurni se uzimaju sa predmeta');
});

test('uvoz: Excel sa ispitima (tabela po godinama, datum bez godine)', async () => {
    const buf = await napraviExcel([
        ['ОАС Информатике'],
        [],
        ['I година'],
        ['', 'Предмет', 'Јануарски\nрок', '', 'Фебруарски\nрок', ''],
        [1, 'Основи програмирања', '20.01.', '9h', '10.02.', '12.30h'],
        ['', '', '27.01.', '9h', '', ''],
        [2, 'Математика 1', '45.01.', '9h', '', '']
    ]);
    const { stavke, izvor } = await uvozRasporeda.parsirajExcel(buf, { godina: 2027 });
    assert.equal(izvor, 'excel-ispiti');
    assert.deepEqual(
        stavke.map((s) => [s.predmetNaziv, s.datum, s.vreme, s.isIspit]),
        [
            ['Основи програмирања', '2027-01-20', '09:00', true],
            ['Основи програмирања', '2027-02-10', '12:30', true],
            ['Основи програмирања', '2027-01-27', '09:00', true],
            ['Математика 1', null, '09:00', true]
        ]
    );
    assert.equal(stavke[3].greska, 'Neispravan datum');
});

test('uvoz: JSON izvoz se čita tačno, pogrešan format se odbija', () => {
    const stavke = uvozRasporeda.parsirajJson({
        format: 'raspored-termini',
        verzija: 1,
        termini: [{
            predmet: { sifra: '19.INF012', naziv: 'Логичко програмирање' }, datum: '2026-11-03', vreme: '10:00', vreme_kraja: '12:00',
            sala: 'A-0-15', is_ispit: false, tip_kolokvijuma: 'II', grupa_kljuc: 'g1', dezurni: [{ email: 'a@pmf.kg.ac.rs' }]
        }]
    });
    assert.deepEqual(
        [stavke[0].predmetSifra, stavke[0].datum, stavke[0].vreme, stavke[0].vremeKraja, stavke[0].sala, stavke[0].tip, stavke[0].dezurniOsobe],
        ['19.INF012', '2026-11-03', '10:00', '12:00', 'A-0-15', 'II', [{ email: 'a@pmf.kg.ac.rs', ime: '', prezime: '' }]]
    );
    assert.throws(() => uvozRasporeda.parsirajJson({ format: 'raspored-rezervacije-sala', termini: [] }), /format/);
    assert.throws(() => uvozRasporeda.parsirajJson(null));
});

test('uvoz: nazivi se porede bez obzira na pismo', () => {
    const { kljucNaziva } = require('../src/utils/tekst');
    assert.equal(kljucNaziva('Основи програмирања 1'), kljucNaziva('Osnovi  programiranja 1'));
    assert.equal(kljucNaziva('Рачунарски системи'), kljucNaziva('RAČUNARSKI SISTEMI'));
    assert.notEqual(kljucNaziva('Математика 1'), kljucNaziva('Математика 2'));
});

test('rezervacije sala: termin u više sala daje po jednu rezervaciju za svaku salu', () => {
    const { napraviRezervacije } = require('../src/services/rezervacijeSala');
    const { naziviSala } = require('../src/utils/sale');
    const utc = (v) => new Date(`1970-01-01T${v}:00.000Z`);
    const ispit = {
        id: 7, is_ispit: false, datum: new Date('2026-11-02T00:00:00.000Z'), vreme: utc('10:00'), vreme_kraja: utc('12:00'),
        sala: { id: 1, naziv: 'A-0-15' }, dodatneSale: [{ id: 2, naziv: 'A-0-3' }, { id: 1, naziv: 'A-0-15' }],
        predmet: { sifra: 'S7', naziv: 'Programiranje', godina: 1, broj_studenata: 120 }, tip_kolokvijuma: 'I'
    };
    const r = napraviRezervacije([ispit]);
    assert.deepEqual(r.rezervacije.map((x) => [x.id, x.sala]), [['kol-7', 'A-0-15'], ['kol-7-s2', 'A-0-3']]);
    assert.equal(naziviSala(ispit), 'A-0-15, A-0-3');
});

test('PMF: odgovor samo sa korisničkim imenom i opis oblika bez vrednosti', async () => {
    const stani = await POKRENI_LAZNI_PMF((req, res) => res.end(JSON.stringify({ status: 'ok', data: { username: 'luka.vuksanovic', ime: 'Luka' } })));
    try {
        assert.deepEqual(await pmf.proveriToken(TOKEN), { email: null, korisnickoIme: 'luka.vuksanovic', imePrezime: { ime: 'Luka', prezime: '' }, vrsta: null });
    } finally { await stani(); }
    const { oblik } = pmf._internal;
    assert.equal(oblik({ ok: true, user: { ime: 'Pera', tel: 123 } }), '{ok:boolean, user:{ime:string, tel:number}}');
});

test('PMF: ime i prezime iz odgovora (posebna polja ili puno ime)', () => {
    const { nadjiImePrezime } = pmf._internal;
    assert.deepEqual(nadjiImePrezime({ korisnik: { ime: 'Ana', prezime: 'Anić' } }), { ime: 'Ana', prezime: 'Anić' });
    assert.deepEqual(nadjiImePrezime({ full_name: 'Petar Petrović Njegoš' }), { ime: 'Petar', prezime: 'Petrović Njegoš' });
    assert.equal(nadjiImePrezime({ email: 'a@b.rs' }), null);
});

test('PMF: vrsta naloga - studenti se odbijaju, nalog se pravi samo zaposlenima', () => {
    const { nadjiVrstu, jeStudent, jeZaposlen } = pmf._internal;
    assert.deepEqual(nadjiVrstu({ email: 'a@b.rs', korisnik: { tip: 'Student' } }), ['student']);
    assert.deepEqual(nadjiVrstu({ roles: ['Zaposleni', 'Nastavnik'] }), ['zaposleni', 'nastavnik']);
    assert.equal(nadjiVrstu({ email: 'a@b.rs', ime: 'Ana' }), null);
    assert.equal(jeStudent(['student']), true);
    assert.equal(jeStudent(['студент']), true);
    assert.equal(jeZaposlen(['rezervacija']), true);
    assert.equal(jeZaposlen(['zaposleni']), false, 'samo grupa rezervacija znači predavača');
    assert.equal(jeZaposlen(['student', 'rezervacija']), false, 'student nikad ne dobija nalog');
    assert.equal(jeZaposlen(null), false, 'bez podatka nema automatskog naloga');
});

test('PMF: grupa "rezervacija" u ismemberof znači predavač (stvaran oblik odgovora IMI-ja)', () => {
    const { nadjiVrstu, jeStudent, jeZaposlen } = pmf._internal;
    const stvaran = { username: 'miomir.kovacevic', ime: 'Miomir', prezime: 'Kovačević', email: 'imi.servis@gmail.com',
        ismemberof: { count: 5, 0: 'aktivan', 1: 'imi', 2: 'ms', 3: 'rezervacija', 4: 'eduroam' } };
    const grupe = nadjiVrstu(stvaran);
    assert.deepEqual(grupe, ['aktivan', 'imi', 'ms', 'rezervacija', 'eduroam']);
    assert.equal(jeZaposlen(grupe), true);
    const student = nadjiVrstu({ ...stvaran, ismemberof: { count: 4, 0: 'aktivan', 1: 'imi', 2: 'ms', 3: 'eduroam' } });
    assert.equal(jeZaposlen(student), false, 'bez grupe "rezervacija" nije predavač');
    assert.equal(jeStudent(student), false);
    assert.equal(jeZaposlen(['rezervacija-nesto']), false, 'poredi se tačno ime grupe');
    assert.equal(jeZaposlen(['student', 'rezervacija']), false, 'grupa student uvek isključuje');
});

test('slanje rezervacija: prošlo je samo {"status":"ok"}, ostalo je greška sa tekstom primaoca', () => {
    const { oceniOdgovor } = require('../src/services/integracijaPodesavanja');
    assert.deepEqual(oceniOdgovor(200, '{"status":"ok"}'), { poslato: true, greska: null });
    assert.equal(oceniOdgovor(200, '{"status":"OK"}').poslato, true);
    const postoji = oceniOdgovor(200, '{"status":"greska","poruka":"Rezervacija A-0-15 već postoji"}');
    assert.equal(postoji.poslato, false);
    assert.match(postoji.greska, /već postoji/);
    const eho = oceniOdgovor(200, '--- Kompletan sirovi POST sadržaj ---\n{"format":"x"}');
    assert.equal(eho.poslato, false);
    assert.equal(eho.greska, 'Server fakulteta nije potvrdio rezervaciju.', 'bez sirovog HTML-a u poruci');
    assert.match(oceniOdgovor(500, 'Greška servera').greska, /500/);
    assert.equal(oceniOdgovor(200, '{"status":"ok"}'.repeat(1)).poslato, true);
});

test('rezervacije sala: termini koji čine rezervaciju su zapamćeni, ali ne idu u JSON', () => {
    const { napraviRezervacije } = require('../src/services/rezervacijeSala');
    const utc = (v) => new Date(`1970-01-01T${v}:00.000Z`);
    const d = new Date('2026-11-02T00:00:00.000Z');
    const sala = { id: 1, naziv: 'A-0-15' };
    const p = (n) => ({ sifra: n, naziv: n, godina: 1, broj_studenata: 10 });
    const r = napraviRezervacije([
        { id: 11, is_ispit: false, datum: d, vreme: utc('10:00'), vreme_kraja: utc('12:00'), sala, grupa_kljuc: 'g', predmet: p('A'), tip_kolokvijuma: 'I' },
        { id: 12, is_ispit: false, datum: d, vreme: utc('10:00'), vreme_kraja: utc('12:00'), sala, grupa_kljuc: 'g', predmet: p('B'), tip_kolokvijuma: 'I' }
    ]);
    assert.equal(r.rezervacije.length, 1);
    assert.deepEqual(r.rezervacije[0].ispitIds, [11, 12]);
    assert.equal(JSON.stringify(r).includes('ispitIds'), false);
    assert.equal(JSON.stringify(r).includes('_ispiti'), false);
});
