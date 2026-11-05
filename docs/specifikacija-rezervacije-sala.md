# Rezervacije sala: kako da preuzmete podatke

Aplikacija daje spisak kolokvijuma kojima treba rezervisati salu (ispiti se ne šalju).

**Adresa:** `GET https://<adresa-aplikacije>/api/integracije/rezervacije-sala`

**Lozinka:** u zaglavlju zahteva `X-API-Key: <ključ>` (ključ dobijate od nas).

Opciono: `?od=2026-10-01&do=2026-12-31` (datumi GGGG-MM-DD; bez toga se vraća sve od danas).

Primer: `curl -H "X-API-Key: KLJUC" "https://<adresa-aplikacije>/api/integracije/rezervacije-sala"`

## Šta dobijate
Spisak svih objavljenih kolokvijuma, svaki put ceo. Svaka rezervacija ima stalan `id`:
- novi `id` = nova rezervacija,
- isti `id` a drugi datum/vreme/sala = izmena,
- `id` koji je ranije bio, a sada ga nema = otkazano.

Svaka rezervacija ima: `id`, `sala`, `datum`, `od`, `do` (vreme u Srbiji), `predmeti` (ako ih je više,
drže se zajedno u istoj sali) i `ukupno_studenata`. `do_pretpostavljen: true` znači da kraj nije unet pa je
uzeto 2 sata. Kolokvijumi bez izabrane sale su u spisku `bez_sale` (njih ne treba rezervisati).

Tačan oblik: `rezervacije-sala.schema.json`.

## Primer
```json
{
  "format": "raspored-rezervacije-sala",
  "verzija": 1,
  "rezervacije": [
    {
      "id": "kol-45",
      "sala": "A-0-15",
      "datum": "2026-10-28",
      "od": "13:00",
      "do": "15:00",
      "predmeti": [{ "sifra": "19.INF012", "naziv": "Логичко и функционално програмирање", "godina": 3, "nosilac": "Ненад Стојановић", "broj_studenata": 40 }],
      "ukupno_studenata": 40
    }
  ],
  "bez_sale": []
}
```
(U pravom odgovoru ima još nekoliko polja, vidi šemu.)

## Greške
`401` pogrešan ili nedostaje ključ · `400` loš datum · `429` previše poziva · `503` integracija nije uključena.

Podaci se menjaju samo kad se objavi raspored, pa je dovoljno preuzimati na 15 do 60 minuta.
