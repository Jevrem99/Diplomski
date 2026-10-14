# Šta smo uradili i šta sledi

Ovo je za mene, da razumem celu priču sa Mišom (administrator fakulteta).

## Šta je Miša tražio

1. **Adresu** sa koje njegov program može da preuzme rezervacije sala (JSON).
2. Da kažem **na čemu aplikacija radi** i da li može u **Dockeru**, da bi je profesorka Tanja isprobala na serveru.
3. **Prijavu preko PMF naloga**: korisnik ne kuca našu lozinku, nego se prijavi na IMI sajtu i vrati se u našu aplikaciju.

## Šta je urađeno (sve na grani `integracija-pmf`)

### 1. Adresa sa rezervacijama
- Adresa: `https://<adresa-aplikacije>/api/integracije/rezervacije-sala`
- Radi samo sa **tajnim ključem** (lozinkom) koji Miša šalje u zaglavlju `X-API-Key`.
- Vraća samo **kolokvijume** (ne ispite), samo objavljene.
- Svaka rezervacija ima stalan `id`, pa Miša vidi šta je novo, izmenjeno ili otkazano.
- Opis za Mišu: `docs/specifikacija-rezervacije-sala.md` i `docs/rezervacije-sala.schema.json`.

### 2. Docker
- Napravljeno: aplikacija se pokreće jednom komandom na serveru, `docker compose up -d --build`.
- Tri dela: baza, back end, front end. Baza se sama napravi pri prvom pokretanju.
- Uputstvo: `docs/pokretanje-na-serveru.md`.
- **Nisam isprobano do kraja**: Docker nije radio na računaru dok se pravilo, pa slike (images) nisu pravljene.

### 3. Prijava preko PMF naloga
- Dugme „Prijava preko PMF naloga” na stranici za prijavu. Stara prijava lozinkom ostaje.
- Tok: dugme → IMI stranica → IMI vraća korisnika na našu stranicu `/auth/callback?token=...` → naš server pita IMI čiji je token → dobijemo e-mail → ako je u našoj bazi, korisnik je unutra.
- Ulogu (admin/profesor/asistent) uvek određuje **naša baza**, nikad IMI. Nepoznat e-mail ne ulazi.
- Isprobano sa **lažnim PMF serverom** (`npm run lazni-pmf`), ne sa pravim.
- Opis: `docs/prijava-preko-pmf.md`.

## Rečnik (bez stručnih reči)

| Pojam | Šta je |
|---|---|
| **Domen / adresa aplikacije** | Adresa na kojoj će aplikacija živeti, npr. `raspored.pmf.kg.ac.rs`. Daje je fakultet, ne biram je ja. |
| **API ključ** | Lozinka za Mišin program. Ja je izmislim (nasumičan tekst), upišem u `.env` na serveru i pošaljem Miši. Bez nje niko ne može da čita rezervacije. |
| **Docker** | Program koji pokreće aplikaciju na serveru kako treba. Treba na **serveru**, ne na mom računaru. |
| **Callback (`/auth/callback`)** | Stranica naše aplikacije na koju IMI vraća korisnika posle prijave. IMI vraća samo na adrese koje zna, zato Miša mora da je upiše. |
| **Token** | Jednokratni tajni broj koji IMI daje posle prijave, da naš server može da proveri ko je korisnik. |
| **verify_token.php** | Stranica na IMI-ju na kojoj naš server proverava token. |

## Šta ja treba da uradim

1. **Pošaljem mejl Miši** (tekst je u razgovoru): adresa i ključ za rezervacije, na čemu radi, Docker, i pitanja za prijavu.
2. **Čekam njegove odgovore:**
   - koja je adresa aplikacije na njihovom serveru,
   - da li je upisao `https://<adresa>/auth/callback` (i ako može `http://localhost:4200/auth/callback`),
   - primer odgovora `verify_token.php` (uspešan i neuspešan),
   - da li je token jednokratan i koliko traje.
3. **Generišem API ključ** i šaljem ga Miši **posebno** od adrese:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   isti tekst upisujem u `.env` kao `INTEGRACIJA_API_KLJUC=...`
4. **Pošaljem Claude-u Mišin primer odgovora**, da prilagodi čitanje (ako polje sa e-mailom ima drugo ime).
5. **Isprobam Docker** na računaru ili serveru gde on radi (`docker compose up -d --build`), pre nego što to vidi profesorka Tanja.
6. **Spajanje grana:** kad kažem, `integracija-pmf` ide u `luka`, pa PR u `main`.

## Šta nije proveravano (da ne zaboravim)

- Prava IMI prijava (nepoznat je oblik odgovora `verify_token.php`).
- Pravljenje Docker slika i prvo pokretanje na serveru.
- Pravljenje naloga za profesora koji još nema nalog (u bazi trenutno nema takvog slučaja za probu).
