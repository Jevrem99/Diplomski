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
