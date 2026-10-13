# Pokretanje aplikacije na serveru (Docker)

Aplikacija se sastoji od tri kontejnera koje pokreće jedna komanda:

| Kontejner | Šta je | Zadatak |
|---|---|---|
| `frontend` | nginx + Angular 21 (statički fajlovi) | jedina adresa koja je dostupna korisnicima; `/api/…` prosleđuje back end-u |
| `backend` | Node.js 22 + Express 4 + Prisma 5 | poslovna logika, mejlovi, noćna sinhronizacija sa IMI sajtom |
| `db` | PostgreSQL 16 | podaci (čuvaju se u Docker volumenu `dbdata`) |

## Šta je potrebno

- Server sa **Docker Engine 24+ i Docker Compose v2** (ili Docker Desktop). Oko 2 GB slobodne memorije.
- Jedan slobodan port za aplikaciju (podrazumevano `8080`). HTTPS se obično rešava reverse proxy-jem fakulteta ispred njega.
- **Izlazni pristup** sa servera ka: `imi.pmf.kg.ac.rs` (sinhronizacija nastave i provera PMF prijave) i, ako se šalju
  mejlovi, ka Gmail SMTP-u (`smtp.gmail.com:465`).
- Za PMF prijavu: adresa `https://<domen>/auth/callback` mora biti prijavljena na PMF sistemu.

## Prvo pokretanje

```bash
git clone <repozitorijum> raspored && cd raspored
cp .env.docker.example .env      # popunite vrednosti (vidi dole)
docker compose up -d --build
```

Prvi put se pravi i baza (tabele), a administrator se pravi sa podacima iz `.env`.
Aplikacija je tada na `http://<server>:8080` (ili na adresi iz `FRONTEND_URL`).

### Obavezne vrednosti u `.env`

| Promenljiva | Čemu služi |
|---|---|
| `POSTGRES_PASSWORD` | lozinka baze; samo slova i cifre (ulazi u adresu baze) |
| `JWT_SECRET` | tajni ključ prijave: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_URL` | adresa kojom korisnici otvaraju aplikaciju (bez kose crte na kraju), npr. `https://raspored.pmf.kg.ac.rs` |
| `ADMIN_PASSWORD` | lozinka prvog administratora (promenite je posle prve prijave u Podešavanjima) |

Opciono: `EMAIL_USER` / `EMAIL_PASS` (Gmail „lozinka za aplikacije”, bez toga se mejlovi ne šalju),
`INTEGRACIJA_API_KLJUC` (ključ za preuzimanje rezervacija sala, vidi `specifikacija-rezervacije-sala.md`),
`NOCNI_SYNC` i `NOCNI_SYNC_SAT`.

## Svakodnevno

```bash
docker compose ps                    # stanje kontejnera
docker compose logs -f backend       # dnevnik back end-a
docker compose restart backend       # restart posle promene .env
docker compose down                  # gašenje (podaci ostaju)
```

### Nova verzija aplikacije

```bash
git pull
docker compose up -d --build         # podaci se ne diraju; nova polja seme se dodaju sama
```

### Rezervna kopija

```bash
docker compose exec backend npm run backup     # pravi JSON kopiju u volumenu "backups"
docker compose cp backend:/app/backups ./kopije
```

Za potpunu kopiju baze: `docker compose exec db pg_dump -U raspored raspored > raspored.sql`.

## Provera da radi

1. `http://<server>:8080` otvara stranicu za prijavu.
2. `http://<server>:8080/api/health` vraća `{"status":"ok"}`.
3. Prijava kao `admin` sa lozinkom iz `.env`.

## Česti problemi

| Simptom | Uzrok / rešenje |
|---|---|
| `required variable … is missing` | nedostaje obavezna vrednost u `.env` |
| prijava ne radi, „Network error” | `FRONTEND_URL` nije tačna adresa iz pregledača (važi i za CORS) |
| kontejner `backend` se stalno restartuje | `docker compose logs backend`; najčešće pogrešna lozinka baze posle promene `POSTGRES_PASSWORD` (volumen čuva staru) |
| port zauzet | promenite `HTTP_PORT` u `.env` |
| sati noćne sinhronizacije nisu pravi | kontejneri koriste `Europe/Belgrade`; proverite `docker compose exec backend date` |
