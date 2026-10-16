# Pokretanje aplikacije na serveru

Aplikacija radi u Dockeru (tri kontejnera: baza, back end, front end). Na serveru treba Docker sa Compose-om,
oko 2 GB memorije i izlazni internet ka `imi.pmf.kg.ac.rs` (a za mejlove i ka `smtp.gmail.com`).

## Prvo pokretanje
```bash
git clone <repozitorijum> raspored && cd raspored
cp .env.docker.example .env      # otvorite .env i popunite vrednosti
docker compose up -d --build
```
Baza i admin se prave sami. Aplikacija je na `http://<server>:8080`.

## Šta se popunjava u `.env`
- `POSTGRES_PASSWORD`: izmislite lozinku (samo slova i cifre).
- `JWT_SECRET`: dugačak nasumičan tekst (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
- `FRONTEND_URL`: adresa aplikacije kakva se kuca u pregledaču, bez kose crte na kraju.
- `ADMIN_PASSWORD`: lozinka za administratora (`admin`).
- `INTEGRACIJA_API_KLJUC`: ključ koji dobija služba za preuzimanje rezervacija sala.
  Može i bez toga: administrator ga pravi u aplikaciji (Podešavanja, Integracija); ključ iz aplikacije ima prednost nad ovim.
- Mejlovi (nije obavezno): `EMAIL_USER`, `EMAIL_PASS`.

## Svakodnevno
```bash
docker compose ps                  # da li radi
docker compose logs -f backend     # dnevnik
docker compose restart backend     # posle izmene .env
docker compose down                # gašenje (podaci ostaju)
git pull && docker compose up -d --build    # nova verzija
```

## Provera
Otvorite `http://<server>:8080` (stranica za prijavu) i `http://<server>:8080/api/health` (treba da piše `ok`).
Ako nešto ne radi, pogledajte `docker compose logs backend`.
