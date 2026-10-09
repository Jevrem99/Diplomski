import { describe, expect, it } from 'vitest';
import { uCirilicu } from './pismo';

describe('uCirilicu', () => {
  it('preslovljava obične reči i rečenice', () => {
    expect(uCirilicu('Raspored kolokvijuma')).toBe('Распоред колоквијума');
    expect(uCirilicu('Sačuvaj izmene')).toBe('Сачувај измене');
    expect(uCirilicu('Dežurni saradnici: žuto, đak, ćošak, čaša, šuma')).toBe('Дежурни сарадници: жуто, ђак, ћошак, чаша, шума');
  });

  it('spaja lj, nj i dž u jedno slovo, u svim veličinama', () => {
    expect(uCirilicu('Ljubljana, njiva, džep')).toBe('Љубљана, њива, џеп');
    expect(uCirilicu('PRIJAVLJENIH')).toBe('ПРИЈАВЉЕНИХ');
    expect(uCirilicu('Zaduženja i dežurstva')).toBe('Задужења и дежурства');
  });

  it('ne spaja nj / dž tamo gde su dva glasa', () => {
    expect(uCirilicu('injekcija')).toBe('инјекција');
    expect(uCirilicu('Konjunkcija')).toBe('Конјункција');
    expect(uCirilicu('nadživeti')).toBe('надживети');
  });

  it('ne dira šifre sala, brojeve, vreme i rimske brojeve', () => {
    expect(uCirilicu('Sala A-II-24R')).toBe('Сала A-II-24R');
    expect(uCirilicu('A-0-15')).toBe('A-0-15');
    expect(uCirilicu('07:30–09:00h')).toBe('07:30–09:00h');
    expect(uCirilicu('II kolokvijum, IV godina')).toBe('II колоквијум, IV година');
    expect(uCirilicu('12,5 h · 6 dež.')).toBe('12,5 h · 6 деж.');
    expect(uCirilicu('+6 još')).toBe('+6 још');
  });

  it('ne dira e-mail adrese, veb adrese i strane reči', () => {
    expect(uCirilicu('npr. ime@pmf.kg.ac.rs')).toBe('нпр. ime@pmf.kg.ac.rs');
    expect(uCirilicu('Otvori http://localhost:4200/login odmah')).toBe('Отвори http://localhost:4200/login одмах');
    expect(uCirilicu('Izvezi Excel')).toBe('Извези Excel');
  });

  it('utvrđeni oblici', () => {
    expect(uCirilicu('IMI sinhronizacija')).toBe('ИМИ синхронизација');
    expect(uCirilicu('E-mail adresa')).toBe('Имејл адреса');
    expect(uCirilicu('E-MAIL')).toBe('ИМЕЈЛ');
    expect(uCirilicu('PMF, MAS, OAS')).toBe('ПМФ, МАС, ОАС');
  });

  it('ćirilični i prazan tekst ostaju isti', () => {
    expect(uCirilicu('Рачунарски системи')).toBe('Рачунарски системи');
    expect(uCirilicu('Рачунарски системи (sala A-I-1)')).toBe('Рачунарски системи (сала A-I-1)');
    expect(uCirilicu('')).toBe('');
    expect(uCirilicu('2026.')).toBe('2026.');
  });

  it('tačka i crtica na kraju reči pripadaju rečenici', () => {
    expect(uCirilicu('Termin je pomeren.')).toBe('Термин је померен.');
    expect(uCirilicu('Prirodno-matematički fakultet')).toBe('Природно-математички факултет');
  });
});
