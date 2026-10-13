// Lažni PMF (IMI) sistem za prijavu, samo za lokalno isprobavanje dok adresa aplikacije nije prijavljena kod fakulteta.
//   npm run lazni-pmf                       (port 5050)
//   u backend/.env:  PMF_VERIFY_URL=http://localhost:5050/cp/verify_token.php
//   u frontend/src/environments/environment.ts:  pmfPrijavaUrl: 'http://localhost:5050/cp/'
// Stranica /cp/ nudi unos e-maila (ili LAZNI_PMF_EMAIL iz okruženja) i vraća pregledač na redirect_uri sa ?token=...
// Oblik odgovora verify_token.php je POGAĐAN ({ email, ime, prezime }) dok ne stigne primer od fakulteta.
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.LAZNI_PMF_PORT || 5050);
const tokeni = new Map(); // token -> { email, istice }
const ZIVOT_MS = 2 * 60 * 1000;

const html = (res, kod, telo) => {
    res.writeHead(kod, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>Lažni PMF</title><body style="font-family:sans-serif;max-width:420px;margin:60px auto">${telo}</body>`);
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/cp/' || url.pathname === '/cp') {
        const redirect = url.searchParams.get('redirect_uri') || '';
        if (!/^https?:\/\//.test(redirect)) return html(res, 400, '<h3>Nedostaje redirect_uri</h3>');
        const unapred = process.env.LAZNI_PMF_EMAIL;
        if (unapred) return izdaj(res, unapred, redirect);
        return html(res, 200, `<h3>Lažna PMF prijava</h3>
            <form method="post" action="/cp/prijava?redirect_uri=${encodeURIComponent(redirect)}">
            <p><input name="email" placeholder="e-mail" style="width:100%;padding:8px"></p>
            <button style="padding:8px 16px">Prijavi me</button></form>`);
    }

    if (url.pathname === '/cp/prijava' && req.method === 'POST') {
        let telo = '';
        req.on('data', (d) => { telo += d; });
        req.on('end', () => {
            const email = new URLSearchParams(telo).get('email') || '';
            const redirect = url.searchParams.get('redirect_uri') || '';
            if (!/^https?:\/\//.test(redirect)) return html(res, 400, '<h3>Nedostaje redirect_uri</h3>');
            izdaj(res, email, redirect);
        });
        return;
    }

    if (url.pathname === '/cp/verify_token.php') {
        const t = tokeni.get(url.searchParams.get('token'));
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        if (!t || t.istice < Date.now()) {
            res.writeHead(401);
            return res.end(JSON.stringify({ success: false, error: 'invalid token' }));
        }
        tokeni.delete(url.searchParams.get('token')); // jednokratan
        res.writeHead(200);
        return res.end(JSON.stringify({ success: true, email: t.email, ime: 'Lazni', prezime: 'Korisnik' }));
    }

    html(res, 404, '<h3>404</h3>');
});

function izdaj(res, email, redirect) {
    const token = crypto.randomBytes(32).toString('hex');
    tokeni.set(token, { email: email.trim(), istice: Date.now() + ZIVOT_MS });
    const cilj = new URL(redirect);
    cilj.searchParams.set('token', token);
    res.writeHead(302, { Location: cilj.toString() });
    res.end(`<a href="${esc(cilj.toString())}">Nastavi</a>`);
}

server.listen(PORT, () => console.log(`Lažni PMF radi na http://localhost:${PORT}/cp/`));
