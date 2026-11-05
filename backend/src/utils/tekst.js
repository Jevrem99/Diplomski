// Ćirilica i latinica sa dijakriticima -> latinica bez dijakritika, mala slova (za poređenje naziva)
const MAPA = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ђ': 'dj', 'е': 'e', 'ж': 'z', 'з': 'z', 'и': 'i',
    'ј': 'j', 'к': 'k', 'л': 'l', 'љ': 'lj', 'м': 'm', 'н': 'n', 'њ': 'nj', 'о': 'o', 'п': 'p', 'р': 'r',
    'с': 's', 'т': 't', 'ћ': 'c', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'c', 'ч': 'c', 'џ': 'dz', 'ш': 's',
    'č': 'c', 'ć': 'c', 'š': 's', 'ž': 'z', 'đ': 'dj'
};

const uLatinicu = (tekst) =>
    String(tekst ?? '').toLowerCase().split('').map((c) => MAPA[c] ?? c).join('');

// Ključ za poređenje naziva: "Основи програмирања 1" i "Osnovi programiranja  1" daju isto
const kljucNaziva = (tekst) => uLatinicu(tekst).replace(/[^a-z0-9]+/g, ' ').trim();

module.exports = { uLatinicu, kljucNaziva };
