# Prijava preko PMF naloga

1. Korisnik klikne „Prijava preko PMF naloga” i ode na IMI stranicu za prijavu.
2. IMI ga vrati na našu stranicu `/auth/callback` sa tajnim tokenom u adresi.
3. Naš server pita IMI (`verify_token.php`) čiji je to token i dobije e-mail.
4. Ako je taj e-mail u našoj bazi, korisnik je prijavljen. Ulogu (admin/profesor/asistent) određuje naša baza,
   ne IMI. Nepoznat e-mail ne ulazi. Stara prijava lozinkom i dalje radi.

Podešavanje: adresa za proveru tokena je `PMF_VERIFY_URL` u `.env` (podrazumevano prava IMI adresa), a adresa
`https://<adresa-aplikacije>/auth/callback` mora biti prijavljena kod fakulteta.

Isprobavanje bez fakulteta: `cd backend && npm run lazni-pmf`, pa u `backend/.env` postaviti
`PMF_VERIFY_URL=http://localhost:5050/cp/verify_token.php` i u `frontend/src/environments/environment.ts`
`pmfPrijavaUrl: 'http://localhost:5050/cp/'`.

Nepoznato: tačan oblik odgovora `verify_token.php`. Parser traži polje `email`/`mail`/`e_mail`; treba potvrda primerom.
