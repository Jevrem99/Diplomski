// Testovi prava pristupa po ulogama (admin / profesor / asistent) nad pokrenutim API-jem.
// Pokretanje: pokrenite server (npm start), pa u drugom prozoru:  npm run test:roles
// Tokeni se potpisuju lokalno istim JWT_SECRET-om iz .env, pa nisu potrebni nalozi ni lozinke,
// a testovi ne menjaju podatke (proverava se samo ko sme da prođe kroz zaštitu ruta).
// Ako server nije pokrenut, testovi se preskaču.

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const config = require('../src/config/config');

const BASE = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;

const token = (uloga, email = `${uloga}@test.invalid`) =>
    jwt.sign({ id: 999000 + uloga.length, username: `test_${uloga}`, email, uloga }, config.secret, { algorithm: 'HS256', expiresIn: '10m' });

const TOKENI = { admin: token('admin'), profesor: token('profesor'), asistent: token('asistent') };

const zovi = async (metod, putanja, tok, telo) => {
    const res = await fetch(BASE + putanja, {
        method: metod,
        headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
        body: telo && metod !== 'GET' ? JSON.stringify(telo) : undefined,
    });
    return res.status;
};

let serverRadi = false;
test.before(async () => {
    try { await fetch(BASE + '/ucionice', { signal: AbortSignal.timeout(2000) }); serverRadi = true; } catch { serverRadi = false; }
});

const preskoci = (t) => { if (!serverRadi) { t.skip(`Server nije dostupan na ${BASE}`); return true; } return false; };

// Rute koje sme samo admin. Šaljemo nevažeći/prazan sadržaj: admin prođe zaštitu (pa dobije 400/404 od
// kontrolera, nikad 401/403), a ostali moraju da dobiju 403 pre nego što kontroler uopšte pokrene akciju.
const SAMO_ADMIN = [
    ['GET', '/users'],
    ['POST', '/users'],
    ['DELETE', '/users/0'],
    ['GET', '/admin/logs'],
    ['POST', '/predmet'],
    ['PUT', '/predmet/0'],
    ['DELETE', '/predmet/0'],
    ['POST', '/profesors/profesori'],
    ['PUT', '/profesors/saradnici/0'],
    ['DELETE', '/profesors/saradnici/0'],
    ['POST', '/ispit'],
    ['PUT', '/ispit/0'],
    ['DELETE', '/ispit/0'],
    ['POST', '/ispit/bulk'],
    ['PUT', '/ispit/publish-all'],
    ['POST', '/ispit/proveri-konflikte'],
    ['GET', '/dezurstva/export-excel'],
    ['GET', '/termini-kolokvijuma/sve'],
    ['GET', '/zamene'],
    ['GET', '/grupe'],
    ['GET', '/ispit/rezervacije-sala'],
    ['POST', '/grupe'],
    ['PUT', '/grupe/0'],
    ['DELETE', '/grupe/0'],
    ['POST', '/zamene/0/odobri'],
    ['POST', '/zamene/0/odbij'],
    ['POST', '/auth/admin-reset-password'],
];

// Rute dostupne svakom prijavljenom korisniku
const SVI_PRIJAVLJENI = [
    ['GET', '/ispit'],
    ['GET', '/predmet'],
    ['GET', '/profesors'],
    ['GET', '/ucionice'],
    ['GET', '/ispit/stats'],
    ['GET', '/users/roles'],
];

test('bez tokena sve zaštićene rute vraćaju 401', async (t) => {
    if (preskoci(t)) return;
    for (const [metod, putanja] of [...SAMO_ADMIN, ...SVI_PRIJAVLJENI]) {
        assert.equal(await zovi(metod, putanja, null, {}), 401, `${metod} ${putanja}`);
    }
});

test('nevažeći, istekao i krivotvoren token se odbijaju', async (t) => {
    if (preskoci(t)) return;
    const istekao = jwt.sign({ id: 1, uloga: 'admin' }, config.secret, { algorithm: 'HS256', expiresIn: -10 });
    const tudjiKljuc = jwt.sign({ id: 1, uloga: 'admin' }, 'neki-drugi-tajni-kljuc', { algorithm: 'HS256' });
    for (const lose of ['bla.bla.bla', istekao, tudjiKljuc]) {
        assert.equal(await zovi('GET', '/users', lose), 401);
    }
});

test('profesor i asistent ne smeju na admin rute (403)', async (t) => {
    if (preskoci(t)) return;
    for (const uloga of ['profesor', 'asistent']) {
        for (const [metod, putanja] of SAMO_ADMIN) {
            assert.equal(await zovi(metod, putanja, TOKENI[uloga], {}), 403, `${uloga}: ${metod} ${putanja}`);
        }
    }
});

test('admin prolazi zaštitu admin ruta (nikad 401/403)', async (t) => {
    if (preskoci(t)) return;
    // Samo bezbedna čitanja i pozivi sa nepostojećim id-jem; ništa se ne menja u bazi.
    const bezbedno = [['GET', '/users'], ['GET', '/admin/logs'], ['GET', '/zamene'], ['GET', '/grupe'], ['DELETE', '/grupe/0'], ['GET', '/termini-kolokvijuma/sve'], ['DELETE', '/ispit/0'], ['PUT', '/ispit/0']];
    for (const [metod, putanja] of bezbedno) {
        const status = await zovi(metod, putanja, TOKENI.admin, {});
        assert.ok(status !== 401 && status !== 403, `admin: ${metod} ${putanja} -> ${status}`);
    }
});

test('sve tri uloge mogu da čitaju zajedničke podatke', async (t) => {
    if (preskoci(t)) return;
    for (const uloga of ['admin', 'profesor', 'asistent']) {
        for (const [metod, putanja] of SVI_PRIJAVLJENI) {
            const status = await zovi(metod, putanja, TOKENI[uloga]);
            assert.ok(status < 400, `${uloga}: ${metod} ${putanja} -> ${status}`);
        }
    }
});

test('asistent ne može da čita tuđa dežurstva ni obaveze', async (t) => {
    if (preskoci(t)) return;
    // Nepostojeći saradnik: nije "moj", pa mora 403 (admin bi dobio 200/404)
    for (const uloga of ['profesor', 'asistent']) {
        assert.equal(await zovi('GET', '/dezurstva/saradnik/0', TOKENI[uloga]), 403, `${uloga} dežurstva`);
        assert.equal(await zovi('POST', '/obaveze', TOKENI[uloga], { saradnik_id: 0 }), 403, `${uloga} obaveze`);
    }
    const adminStatus = await zovi('GET', '/dezurstva/saradnik/0', TOKENI.admin);
    assert.ok(adminStatus !== 403 && adminStatus !== 401, `admin dežurstva -> ${adminStatus}`);
});

test('zahtevi za zamenu: saradnici imaju pristup svojim rutama', async (t) => {
    if (preskoci(t)) return;
    for (const uloga of ['profesor', 'asistent']) {
        const status = await zovi('GET', '/zamene/moje', TOKENI[uloga]);
        assert.ok(status !== 401 && status !== 403, `${uloga}: /zamene/moje -> ${status}`);
    }
});

test('prijava: pogrešni podaci daju 4xx, a prazno telo ne ruši server', async (t) => {
    if (preskoci(t)) return;
    const pogresno = await zovi('POST', '/auth/login', null, { username: 'nepostojeci_korisnik_xyz', password: 'pogresnaLozinka1' });
    assert.ok(pogresno >= 400 && pogresno < 500, `login -> ${pogresno}`);
    const prazno = await zovi('POST', '/auth/login', null, {});
    assert.ok(prazno >= 400 && prazno < 500, `prazan login -> ${prazno}`);
});

test('ruta koja ne postoji vraća 404', async (t) => {
    if (preskoci(t)) return;
    assert.equal(await zovi('GET', '/nema-takve-rute', TOKENI.admin), 404);
});
