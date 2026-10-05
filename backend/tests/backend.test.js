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
