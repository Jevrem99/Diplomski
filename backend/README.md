# Backend – Raspored ispita i dežurstava

Node.js + Express + Prisma (PostgreSQL).

## Pokretanje

```bash
npm install
cp .env.example .env        # popuni DATABASE_URL i JWT_SECRET (vidi .env.example)
npx prisma generate
npx prisma db push          # pravi tabele i indekse iz prisma/schema.prisma
npm run dev                 # ili: npm start
```

Server sluša na `PORT` (podrazumevano 5000). Provera: `GET /health`.

### Admin nalog (seed)

Pri svakom startu server proverava da li postoji admin i, ako ga nema, pravi ga
(`src/db/ensureAdmin.js`). Ručno: `npm run seed`.

- `ADMIN_USERNAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` iz `.env`.
- Bez `ADMIN_PASSWORD`: u razvoju je lozinka `admin123` (promeni je), a u produkciji
  se generiše nasumična lozinka i ispiše jednom u konzoli.
- Postojeći korisnici se nikada ne brišu ni menjaju. Posle „reset baze“ admin se ponovo pravi.

## Bezbednost

- `JWT_SECRET` je obavezan (server se ne pokreće bez njega); tokeni važe `JWT_EXPIRES_IN` (12h).
- Sve rute traže prijavu (`protect`). Glavni raspored, predmeti/profesori, korisnici, uvoz Excela,
  sync IMI, reset baze, Excel izveštaji i odobravanje zamena su samo za `admin`.
  `profesor` i `asistent` imaju ista prava: vide samo objavljene termine, svoja dežurstva/odsustva,
  unose termine kolokvijuma za svoje predmete i traže zamenu dežurstva.
- Helmet, rate-limit na prijavi i resetovanju lozinke, CORS samo za `CORS_ORIGINS`.
- Reset baze traži `{ "confirm": "RESET" }` u telu zahteva.

## Korisne rute

| Ruta | Opis |
| --- | --- |
| `POST /auth/login` | prijava, vraća JWT |
| `GET /ispit?od=YYYY-MM-DD&do=YYYY-MM-DD` | termini (opciono samo za period) |
| `POST /ispit/bulk` | čuva više termina u jednoj transakciji uz proveru konflikata |
| `PUT /ispit/publish-all` | objavljuje nacrte i šalje obaveštenja asistentima |
| `GET /dezurstva/export-excel?ids=1,2,3` | Excel „Raspored dežurstava“ (admin) |
| `POST /upload/import-excel` | uvoz predmeta, profesora i broja studenata (OAS + MAS) |
| `POST /ispit/proveri-konflikte` | proverava celu seriju izmena pre čuvanja (ništa ne upisuje) |
| `POST /zamene`, `GET /zamene/moje` | asistent traži zamenu dežurstva / vidi svoje zahteve |
| `GET /zamene`, `POST /zamene/:id/odobri`, `POST /zamene/:id/odbij` | admin obrađuje zahteve |
| `GET /dezurstva/moj-kalendar.ics` | moja dežurstva kao kalendar (Google/Outlook/telefon) |
| `GET /termini-kolokvijuma/moji`, `POST /termini-kolokvijuma/sacuvaj` | željeni termini kolokvijuma po predmetu |
| `POST /admin/sync-imi` | preuzima redovnu nastavu sa IMI sajta (`{ "od": "...", "do": "..." }` opciono) |

## Rezervne kopije

```bash
npm run backup                              # nova kopija u backend/backups (poslednjih 15 se čuva)
npm run backup -- list
npm run backup -- restore <fajl> --yes      # VRAĆA bazu na stanje iz kopije (briše trenutne podatke)
```

Kopija se pravi automatski pre „reset baze“ i pre uvoza Excela. Folder `backups/` sadrži i heširane
lozinke, zato je van git-a.

## Testovi

```bash
npm test
```

## Napomene o bazi

`prisma db push` je dovoljan za razvoj. Indeksi i `ON DELETE CASCADE` za `Dezurstva` su deo `schema.prisma`.
Foldera `prisma/migrations` se trenutno ne drži u sinhronizaciji sa bazom.
