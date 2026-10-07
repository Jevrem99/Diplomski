const nodemailer = require('nodemailer');
const config = require('../config/config');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const POSILJALAC = () => `"Raspored ispita - PMF Kragujevac" <${process.env.EMAIL_USER}>`;

// Sve što dolazi iz baze (nazivi predmeta, imena) ide kroz esc(): sprečava ubacivanje HTML-a u mejl
const esc = (v) => String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const BOJE = {
    primarna: '#1F63A0', primarnaTamna: '#164f82', akcent: '#F39C12',
    tekst: '#1e293b', sporedni: '#64748b', linija: '#e2e8f0', pozadina: '#eef2f7',
    izmenaPoz: '#fff7ed', izmenaTekst: '#c2410c', svetla: '#f8fafc'
};
const FONT = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Zajednički okvir svih mejlova (tabele i inline stilovi: tako ga čitaju i Gmail i Outlook)
const okvir = ({ naslov, uvod, sadrzaj, dugme, napomena, preheader }) => `<!DOCTYPE html>
<html lang="sr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(naslov)}</title></head>
<body style="margin:0; padding:0; background-color:${BOJE.pozadina};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${esc(preheader || naslov)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BOJE.pozadina}; padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px; background-color:#ffffff; border-radius:14px; overflow:hidden; border:1px solid ${BOJE.linija};">
        <tr><td style="background-color:${BOJE.primarna}; padding:22px 28px; font-family:${FONT};">
          <div style="font-size:11px; letter-spacing:1.2px; text-transform:uppercase; color:#cfe3f5; font-weight:600;">Prirodno-matematički fakultet · Kragujevac</div>
          <div style="font-size:20px; font-weight:700; color:#ffffff; margin-top:4px;">Raspored ispita</div>
        </td></tr>
        <tr><td style="padding:28px; font-family:${FONT}; color:${BOJE.tekst}; font-size:15px; line-height:1.6;">
          <h1 style="margin:0 0 12px 0; font-size:22px; line-height:1.3; color:${BOJE.primarnaTamna};">${esc(naslov)}</h1>
          ${uvod ? `<p style="margin:0 0 18px 0;">${uvod}</p>` : ''}
          ${sadrzaj || ''}
          ${dugme ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 8px 0;"><tr><td style="background-color:${BOJE.akcent}; border-radius:10px;">
            <a href="${esc(dugme.url)}" style="display:inline-block; padding:13px 26px; font-family:${FONT}; font-size:15px; font-weight:700; color:#ffffff; text-decoration:none;">${esc(dugme.tekst)}</a>
          </td></tr></table>` : ''}
          ${napomena ? `<p style="margin:18px 0 0 0; font-size:13px; color:${BOJE.sporedni};">${napomena}</p>` : ''}
        </td></tr>
        <tr><td style="background-color:${BOJE.svetla}; padding:16px 28px; font-family:${FONT}; font-size:12px; color:${BOJE.sporedni}; border-top:1px solid ${BOJE.linija};">
          Ovo je automatska poruka sistema za raspored ispita, na nju nije potrebno odgovarati.<br>
          <a href="${esc(config.frontendUrl)}" style="color:${BOJE.primarna}; text-decoration:none; font-weight:600;">Otvori portal</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const vremeTekst = (vreme, kraj) => `${esc(vreme)}${kraj ? '–' + esc(kraj) : ''}h`;

const gradiPregledDezurstava = (ime, dezurstva) => {
    const imaIzmena = dezurstva.some((d) => d.isIzmenjen);
    const redovi = dezurstva.map((d, i) => {
        const poz = d.isIzmenjen ? BOJE.izmenaPoz : (i % 2 ? BOJE.svetla : '#ffffff');
        const celija = `padding:12px 10px; border-bottom:1px solid ${BOJE.linija}; background-color:${poz}; font-size:14px;`;
        return `<tr>
          <td style="${celija} font-weight:600;">${esc(d.predmet)}${d.isIzmenjen ? `<br><span style="display:inline-block; margin-top:4px; padding:2px 8px; border-radius:6px; background-color:#ffedd5; color:${BOJE.izmenaTekst}; font-size:11px; font-weight:700; letter-spacing:0.4px;">IZMENA RASPOREDA</span>` : ''}</td>
          <td style="${celija} text-align:center; white-space:nowrap;">${esc(d.datum)}</td>
          <td style="${celija} text-align:center; white-space:nowrap;">${vremeTekst(d.vreme, d.vremeKraja)}</td>
          <td style="${celija} text-align:center; white-space:nowrap;">${esc(d.sala)}</td>
        </tr>`;
    }).join('');
    const glava = `padding:10px; background-color:${BOJE.primarnaTamna}; color:#ffffff; font-size:12px; text-transform:uppercase; letter-spacing:0.6px;`;
    const tabela = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:0; border:1px solid ${BOJE.linija}; border-radius:10px; overflow:hidden;">
        <thead><tr>
          <th align="left" style="${glava}">Predmet</th>
          <th style="${glava}">Datum</th><th style="${glava}">Vreme</th><th style="${glava}">Sala</th>
        </tr></thead>
        <tbody>${redovi}</tbody></table>`;
    return okvir({
        naslov: 'Pregled vaših dežurstava',
        preheader: `Imate ${dezurstva.length} ${dezurstva.length === 1 ? 'dežurstvo' : 'dežurstava'} u rasporedu.`,
        uvod: `Poštovani/a <strong>${esc(ime)}</strong>, u nastavku je ažuran pregled vaših zaduženja${imaIzmena ? '. Termini koji su naknadno menjani označeni su narandžastom bojom' : ''}.`,
        sadrzaj: tabela,
        dugme: { tekst: 'Otvori portal', url: config.frontendUrl },
        napomena: 'Sva zaduženja možete pratiti i u svom nalogu na portalu.'
    });
};

const gradiIzmenuDezurstva = (ime, predmet, datum, vreme, vremeKraja, sala) => {
    const red = (naziv, vrednost) => `<tr>
        <td style="padding:12px 14px; border-bottom:1px solid ${BOJE.linija}; background-color:${BOJE.svetla}; width:34%; font-size:13px; color:${BOJE.sporedni}; font-weight:600;">${naziv}</td>
        <td style="padding:12px 14px; border-bottom:1px solid ${BOJE.linija}; font-size:15px; font-weight:600;">${vrednost}</td></tr>`;
    return okvir({
        naslov: 'Izmena vašeg dežurstva',
        preheader: `Izmenjen je termin: ${predmet}`,
        uvod: `Poštovani/a <strong>${esc(ime)}</strong>, došlo je do izmene termina za dežurstvo na kojem ste raspoređeni.`,
        sadrzaj: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:0; border:1px solid ${BOJE.linija}; border-radius:10px; overflow:hidden; border-left:5px solid ${BOJE.izmenaTekst};">
            ${red('Predmet', esc(predmet))}${red('Datum', esc(datum))}${red('Vreme', vremeTekst(vreme, vremeKraja))}${red('Sala', esc(sala))}</table>`,
        dugme: { tekst: 'Pogledaj detalje', url: config.frontendUrl }
    });
};

const gradiResetLozinke = (korisnik, resetUrl) => okvir({
    naslov: 'Postavite novu lozinku',
    preheader: 'Link za novu lozinku važi 15 minuta.',
    uvod: `Primili smo zahtev za resetovanje lozinke za nalog <strong>${esc(korisnik)}</strong>. Kliknite na dugme ispod i izaberite novu lozinku. Link važi <strong>15 minuta</strong>.`,
    sadrzaj: `<p style="margin:0; font-size:13px; color:${BOJE.sporedni};">Nova lozinka mora imati najmanje 8 karaktera, bar jedno slovo i jednu cifru.</p>`,
    dugme: { tekst: 'Postavi novu lozinku', url: resetUrl },
    napomena: `Ako dugme ne radi, kopirajte ovaj link u pregledač:<br><a href="${esc(resetUrl)}" style="color:${BOJE.primarna}; word-break:break-all;">${esc(resetUrl)}</a><br><br>Ako niste vi poslali zahtev, slobodno ignorišite ovu poruku: lozinka ostaje nepromenjena.`
});

const posalji = async (opcije, opis) => {
    try {
        await transporter.sendMail({ from: POSILJALAC(), ...opcije });
        return true;
    } catch (error) {
        console.error(`Greška pri slanju mejla (${opis}):`, error.message);
        return false;
    }
};

const sendGrupniDezurstvoEmail = (asistentEmail, asistentIme, dezurstvaNiz) =>
    posalji({
        to: asistentEmail,
        subject: 'Raspored dežurstava - ažurirano',
        html: gradiPregledDezurstava(asistentIme, dezurstvaNiz),
        text: `Poštovani/a ${asistentIme}, ažuran je raspored vaših dežurstava (${dezurstvaNiz.length}). Pogledajte ga na portalu: ${config.frontendUrl}`
    }, asistentEmail);

const sendIzmenaDezurstvaEmail = (asistentEmail, asistentIme, predmetNaziv, datum, vreme, vremeKraja, salaNaziv) =>
    posalji({
        to: asistentEmail,
        subject: `Izmena rasporeda: ${predmetNaziv}`,
        html: gradiIzmenuDezurstva(asistentIme, predmetNaziv, datum, vreme, vremeKraja, salaNaziv),
        text: `Izmena dežurstva: ${predmetNaziv}, ${datum}, ${vreme}${vremeKraja ? '-' + vremeKraja : ''}h, sala ${salaNaziv}. Detalji: ${config.frontendUrl}`
    }, asistentEmail);

const sendResetLozinkeEmail = (email, korisnik, resetUrl) =>
    posalji({
        to: email,
        subject: 'Resetovanje lozinke - Raspored ispita',
        html: gradiResetLozinke(korisnik, resetUrl),
        text: `Zahtev za novu lozinku za nalog ${korisnik}. Link (važi 15 minuta): ${resetUrl}`
    }, email);

module.exports = {
    sendGrupniDezurstvoEmail, sendIzmenaDezurstvaEmail, sendResetLozinkeEmail,
    _sabloni: { gradiPregledDezurstava, gradiIzmenuDezurstva, gradiResetLozinke, esc }
};
