# Prijava preko PMF (IMI) naloga

## Tok
1. Korisnik na stranici za prijavu klikne „Prijava preko PMF naloga” i odlazi na
   `https://imi.pmf.kg.ac.rs/cp/?redirect_uri=<adresa aplikacije>/auth/callback`.
2. Posle prijave IMI vraća pregledač na `<adresa aplikacije>/auth/callback?token=<64 heks. znaka>`.
3. Stranica `/auth/callback` odmah skida token iz adrese i šalje ga na `POST /auth/pmf`.
4. Server proverava token kod IMI-ja (`GET https://imi.pmf.kg.ac.rs/cp/verify_token.php?token=…`), iz odgovora
   uzima **e-mail** i traži ga u našoj bazi (korisnik, pa profesor/saradnik). Izdaje običnu sesiju (isti JWT kao pri prijavi lozinkom).

## Pravila
- Uloga se **nikad** ne uzima od IMI-ja, već iz naše baze. E-mail koji nije u bazi dobija poruku „obratite se administratoru”.
- Profesor/saradnik koji još nema nalog dobija ga pri prvom PMF ulasku (nasumična, nekorišćena lozinka).
- Prijava korisničkim imenom i lozinkom ostaje.
- Provera tokena nikad ne prelazi na nesigurnu TLS vezu sama; samo ako se izričito postavi `PMF_INSECURE_TLS=true`.

## Podešavanje
| Šta | Gde |
|---|---|
| Adresa provere tokena | `PMF_VERIFY_URL` u `.env` (podrazumevano prava IMI adresa) |
| Adresa PMF prijave | `pmfPrijavaUrl` u `frontend/src/environments/environment*.ts` |
| Registracija adrese | fakultet mora da prijavi `https://<domen>/auth/callback` (test i produkcija) |

## Lokalno isprobavanje bez fakulteta
```bash
cd backend && npm run lazni-pmf        # lažni PMF na portu 5050
```
U `backend/.env`: `PMF_VERIFY_URL=http://localhost:5050/cp/verify_token.php`, a u `environment.ts`
`pmfPrijavaUrl: 'http://localhost:5050/cp/'`. Lažni server pita za e-mail i pravi jednokratan token.

## Nepoznato
Oblik odgovora `verify_token.php` nije dokumentovan; parser traži e-mail u poljima `email`/`mail`/`e_mail`
(i ugnježdeno) i odbija odgovore sa `error`/`success:false`. Treba potvrditi primerom odgovora od fakulteta.
