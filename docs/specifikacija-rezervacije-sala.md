# Specifikacija: preuzimanje rezervacija sala za kolokvijume

Aplikacija „Raspored ispita” (PMF Kragujevac) izlaže adresu sa koje sistem fakulteta preuzima
**termine kolokvijuma kojima treba rezervisati učionicu**. Ispiti se ne šalju: njih rezerviše služba fakulteta.

- Format: JSON, UTF-8 (nazivi predmeta su na ćirilici).
- Samo čitanje; ništa se ne upisuje u aplikaciju.
- Šema (JSON Schema, draft-07): [`rezervacije-sala.schema.json`](rezervacije-sala.schema.json)

## Adresa i pristup

```
GET https://<adresa-aplikacije>/api/integracije/rezervacije-sala
X-API-Key: <tajni ključ>
```

Tajni ključ dobijate od administratora aplikacije i šalje se **samo u zaglavlju** `X-API-Key`
(ne u adresi). Ključ se može promeniti u svakom trenutku, pa ga čuvajte kao lozinku.
Preporučuje se samo HTTPS.

### Parametri (opcioni)

| Parametar | Značenje | Podrazumevano |
|---|---|---|
| `od` | Prvi dan, `GGGG-MM-DD` | današnji dan |
| `do` | Poslednji dan (uključen), `GGGG-MM-DD` | bez ograničenja |

### Primer

```bash
curl -H "X-API-Key: $KLJUC" "https://<adresa-aplikacije>/api/integracije/rezervacije-sala?od=2026-10-01"
```

## Šta odgovor znači

Odgovor je **snimak trenutnog stanja** svih *objavljenih* kolokvijuma u periodu.
Svaki poziv vraća celu sliku, a svaka rezervacija ima stalan `id`. Zato je preuzimanje jednostavno:

- `id` koji ranije nije postojao: **nova** rezervacija;
- `id` koji postoji, ali su se polja promenila (datum, vreme, sala): **izmena** postojeće rezervacije;
- `id` koji je ranije postojao, a sada ga nema u odgovoru: rezervacija je **otkazana**.

Termini koji su još u pripremi (nisu objavljeni) nisu u odgovoru.

### Polja

| Polje | Tip | Opis |
|---|---|---|
| `format`, `verzija` | tekst, broj | Uvek `"raspored-rezervacije-sala"` i `1`. Promena strukture povećava `verzija`. |
| `generisano` | tekst | Trenutak odgovora (ISO 8601, UTC). |
| `objavio` | tekst | Uvek `"integracija"`. |
| `rezervacije` | niz | Rezervacije koje treba uneti (vidi dole). |
| `bez_sale` | niz | Objavljeni kolokvijumi kojima sala još nije izabrana (`id`, `datum`, `od`, `naziv`). Nema šta da se rezerviše. |

Jedna **rezervacija**:

| Polje | Tip | Opis |
|---|---|---|
| `id` | tekst | Stalan identifikator, npr. `kol-45`. |
| `izmena` | da/ne | Termin je posle prethodne objave menjan. |
| `sala` | tekst | Naziv sale, npr. `A-0-15`. |
| `datum` | tekst | `GGGG-MM-DD`. |
| `od`, `do` | tekst | `HH:MM`, lokalno vreme u Srbiji (bez vremenske zone). |
| `do_pretpostavljen` | da/ne | `true` ako kraj nije unet; tada je uzeto trajanje od 2 sata. |
| `namena` | tekst | Uvek `"Kolokvijum"`. |
| `tip`, `tip_opis` | tekst | Oznaka (`I`, `II`, `III`, `test`, popravni…) i opis za prikaz. |
| `racunarska_sala` | da/ne | Nastavnik je tražio računarsku salu. |
| `predmeti` | niz | Predmet(i) koji se drže u tom terminu; **više njih = grupa u istoj sali istovremeno**. Svaki ima `sifra`, `naziv`, `godina` (5 = master), `nosilac`, `broj_studenata`. |
| `ukupno_studenata` | broj | Zbir studenata svih predmeta u rezervaciji (za proveru kapaciteta). |

### Primer odgovora

```json
{
  "format": "raspored-rezervacije-sala",
  "verzija": 1,
  "generisano": "2026-10-13T09:30:12.481Z",
  "objavio": "integracija",
  "rezervacije": [
    {
      "id": "kol-45",
      "izmena": false,
      "sala": "A-0-15",
      "datum": "2026-10-28",
      "od": "13:00",
      "do": "15:00",
      "do_pretpostavljen": false,
      "namena": "Kolokvijum",
      "tip": "I",
      "tip_opis": "I колоквијум",
      "racunarska_sala": true,
      "predmeti": [
        { "sifra": "19.INF012", "naziv": "Логичко и функционално програмирање", "godina": 3, "nosilac": "Ненад Стојановић", "broj_studenata": 40 },
        { "sifra": "19.INF015", "naziv": "Формални језици", "godina": 3, "nosilac": "Вишња Симић", "broj_studenata": 35 }
      ],
      "ukupno_studenata": 75
    }
  ],
  "bez_sale": []
}
```

## Greške

| Kod | Značenje |
|---|---|
| `400` | Neispravan parametar `od` / `do` (očekuje se `GGGG-MM-DD`, `do` ne sme biti pre `od`). |
| `401` | Nedostaje ili je pogrešan `X-API-Key`. |
| `429` | Previše poziva (ograničenje: 120 poziva u 15 minuta). |
| `503` | Integracija nije uključena na serveru (ključ nije podešen). |

Telo greške je JSON oblika `{ "error": "poruka" }`.

## Preporuka za učestalost

Podaci se menjaju samo kada administrator objavi raspored, pa je dovoljno preuzimanje
na svakih 15 do 60 minuta (ili na zahtev administratora fakulteta).
